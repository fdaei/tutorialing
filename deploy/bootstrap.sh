#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# زیرساخت پایه‌ی سرور lingospeak — idempotent و فازبندی‌شده.
#
#   sudo bash bootstrap.sh <phase>
#
#   deps      نصب بسته‌ها (ufw, fail2ban, python3-systemd, dnsutils)
#   dirs      ساخت /home/deploy/lingospeak با مالکیت و پرمیشن درست
#   firewall  قوانین ufw (فقط 22/80/443) + بستن دور زدن ufw توسط داکر
#   fail2ban  نصب jail و راه‌اندازی
#   caddy     شبکه‌ی edge + ریورس‌پراکسی + گواهی استیجینگ Let's Encrypt
#   verify    گزارش وضعیت (فقط خواندنی)
#   all       همه‌ی موارد بالا به ترتیب
#
# اجرای مجدد هر فاز بی‌خطر است.
#
# فاز caddy عمداً روی استیجینگ Let's Encrypt می‌ماند تا مسیر ACME بدون
# سوزاندن سهمیه‌ی محیط اصلی اثبات شود. سوییچ به گواهی معتبر:
#   bash /home/deploy/lingospeak/bin/go-live.sh
#
# متغیرهای اختیاری:
#   ADMIN_IP=1.2.3.4       به ignoreip فایل fail2ban اضافه می‌شود
#   DEPLOY_USER=deploy     کاربر مالک درخت دایرکتوری
#   DOMAIN=lingospeak.org  دامنه‌ای که گواهی برایش تست می‌شود
# ---------------------------------------------------------------------------
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DOMAIN="${DOMAIN:-lingospeak.org}"
ROOT_DIR="/home/${DEPLOY_USER}/lingospeak"
EDGE_DIR="${ROOT_DIR}/edge"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED=$'\033[31m' GRN=$'\033[32m' YLW=$'\033[33m' BLD=$'\033[1m' RST=$'\033[0m'
step() { printf '\n%s══ %s%s\n' "$BLD" "$1" "$RST"; }
ok() { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
warn() { printf '  %s!%s %s\n' "$YLW" "$RST" "$1"; }
die() {
	printf '  %s✗%s %s\n' "$RED" "$RST" "$1" >&2
	exit 1
}

[[ $EUID -eq 0 ]] || die "با sudo اجرا کنید."
id "$DEPLOY_USER" >/dev/null 2>&1 || die "کاربر $DEPLOY_USER وجود ندارد."

# ---------------------------------------------------------------------------
phase_deps() {
	step "نصب بسته‌ها"
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -qq
	# python3-systemd اختیاری به نظر می‌رسد ولی نیست: fail2ban با
	# backend=systemd بدون آن بالا نمی‌آید، و Ubuntu 24.04 در نصب مینیمال
	# /var/log/auth.log ندارد که بک‌اند فایل بتواند بخواند.
	apt-get install -y -qq ufw fail2ban python3-systemd dnsutils ca-certificates curl openssl
	ok "ufw, fail2ban, python3-systemd, dnsutils, openssl نصب شدند"

	command -v docker >/dev/null 2>&1 || die "داکر نصب نیست."
	ok "docker: $(docker --version | cut -d, -f1)"
}

# ---------------------------------------------------------------------------
phase_dirs() {
	step "ساختار دایرکتوری"

	install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 "$ROOT_DIR"
	for d in edge edge/logs app bin provision; do
		install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 "$ROOT_DIR/$d"
	done
	# فقط برای مالک: اینها راز و بکاپ دیتابیس نگه می‌دارند.
	for d in env backups; do
		install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$ROOT_DIR/$d"
	done

	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 \
		"$SRC_DIR/bin/dns-check.sh" "$SRC_DIR/bin/go-live.sh" "$ROOT_DIR/bin/"

	ok "$ROOT_DIR ساخته شد (env/ و backups/ با مود 700)"
	find "$ROOT_DIR" -maxdepth 1 -mindepth 1 -printf '      %M %u:%g %f\n' | sort -k3
}

# ---------------------------------------------------------------------------
phase_firewall() {
	step "فایروال (ufw)"

	# reset عمدی است: تنها راه تضمین «فقط 22/80/443» این است که از حالت
	# پیش‌فرض شروع کنیم، وگرنه اجرای مجدد فقط قانون اضافه می‌کند و هر قانون
	# دستی قدیمی باقی می‌ماند. ufw نسخه‌ی قبلی فایل‌ها را در /etc/ufw/*.YYYYMMDD
	# بکاپ می‌گیرد. اگر بعداً قانون دستی اضافه کردید، بدانید این فاز پاکش می‌کند.
	ufw --force reset >/dev/null 2>&1 || true
	ufw default deny incoming >/dev/null
	ufw default allow outgoing >/dev/null

	# `limit` به جای `allow`: بیش از ۶ کانکشن جدید در ۳۰ ثانیه از یک IP
	# دراپ می‌شود. ssh config محلی ControlMaster دارد، پس ssh/scp های موازی
	# روی یک کانکشن TCP مالتی‌پلکس می‌شوند و به این سقف نمی‌خورند.
	ufw limit 22/tcp comment 'SSH (rate limited)' >/dev/null
	ufw allow 80/tcp comment 'HTTP / ACME' >/dev/null
	ufw allow 443/tcp comment 'HTTPS' >/dev/null
	ufw allow 443/udp comment 'HTTP/3' >/dev/null

	# گارد ضد قفل‌شدن: تحت هیچ شرایطی ufw را بدون قانون ۲۲ فعال نکن.
	ufw show added | grep -qE '(limit|allow) 22/tcp' ||
		die "قانون SSH ثبت نشد — ufw فعال نشد تا از سرور بیرون نمانید."

	ufw --force enable >/dev/null
	ok "ufw فعال شد: 22/tcp (limit)، 80/tcp، 443/tcp+udp، بقیه deny"

	step "بستن دور زدن ufw توسط داکر"

	# اینترفیس عمومی در زمان اجرا تشخیص داده می‌شود، نه هاردکد — نام آن روی
	# ارائه‌دهنده‌های مختلف فرق می‌کند (eth0 / ens3 / enp1s0 / …).
	local pub_if
	pub_if="$(ip -4 route get 1.1.1.1 2>/dev/null |
		awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')"
	[[ -n $pub_if ]] || die "اینترفیس عمومی تشخیص داده نشد."
	ok "اینترفیس عمومی: $pub_if"

	local rules=/etc/ufw/after.rules
	[[ -f "${rules}.lingospeak.bak" ]] || cp -a "$rules" "${rules}.lingospeak.bak"

	# بلوک قبلی حذف و از نو نوشته می‌شود تا اجرای مکرر تکراری تولید نکند.
	sed -i '/^# BEGIN LINGOSPEAK DOCKER-USER$/,/^# END LINGOSPEAK DOCKER-USER$/d' "$rules"
	sed -e "s|__PUB_IF__|$pub_if|g" "$SRC_DIR/ufw/docker-user.after.rules" >>"$rules"

	ufw reload >/dev/null
	ok "بلوک DOCKER-USER نصب شد؛ ufw reload شد"

	# نکته‌ی نگهداری: خط `:DOCKER-USER - [0:0]` باعث می‌شود iptables-restore
	# در هر reload زنجیره را flush کند، پس reload های مکرر قانون تکراری
	# نمی‌سازند. اما اگر دیمن داکر *بعد از* ufw ری‌استارت شود، ممکن است
	# زنجیره را از نو بسازد — بعد از هر `systemctl restart docker` یک بار
	# `ufw reload` بزنید. فاز verify این را چک می‌کند.
}

# ---------------------------------------------------------------------------
phase_fail2ban() {
	step "fail2ban"

	install -m 644 "$SRC_DIR/fail2ban/jail.local" /etc/fail2ban/jail.local

	if [[ -n ${ADMIN_IP:-} ]]; then
		sed -i "s|^ignoreip = .*|& ${ADMIN_IP}|" /etc/fail2ban/jail.local
		ok "ADMIN_IP=${ADMIN_IP} به ignoreip اضافه شد"
	elif [[ -n ${SSH_CLIENT:-} ]]; then
		warn "IP فعلی شما ${SSH_CLIENT%% *} است — خودکار اضافه نشد (معمولاً داینامیک است)."
		warn "برای معاف کردنش: sudo ADMIN_IP=${SSH_CLIENT%% *} bash bootstrap.sh fail2ban"
	fi

	systemctl enable --now fail2ban >/dev/null 2>&1 || true
	systemctl restart fail2ban

	# چند لحظه تا خواندن ژورنال و بالا آمدن jail
	for _ in $(seq 1 10); do
		fail2ban-client status sshd >/dev/null 2>&1 && break
		sleep 1
	done

	if fail2ban-client status sshd >/dev/null 2>&1; then
		ok "jail sshd فعال است"
	else
		journalctl -u fail2ban -n 30 --no-pager >&2 || true
		die "jail sshd بالا نیامد — لاگ بالا را ببینید."
	fi
}

# ---------------------------------------------------------------------------
phase_caddy() {
	step "Caddy (ریورس‌پراکسی)"

	# شبکه external است تا با پایین آوردن پروژه‌ی اپ از بین نرود.
	if docker network inspect edge >/dev/null 2>&1; then
		ok "شبکه‌ی edge از قبل وجود دارد"
	else
		runuser -u "$DEPLOY_USER" -- docker network create edge >/dev/null
		ok "شبکه‌ی edge ساخته شد"
	fi

	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 \
		"$SRC_DIR/edge/docker-compose.yml" "$EDGE_DIR/"

	# با cat جای‌گزین می‌شود نه mv/install: Caddyfile به صورت تک‌فایل
	# bind-mount شده و عوض شدن اینود یعنی کانتینرِ در حال اجرا همچنان محتوای
	# قدیمی را می‌بیند. نوشتن در جای خود اینود را حفظ می‌کند.
	if [[ -f "$EDGE_DIR/Caddyfile" ]]; then
		cat "$SRC_DIR/edge/Caddyfile" >"$EDGE_DIR/Caddyfile"
	else
		install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 \
			"$SRC_DIR/edge/Caddyfile" "$EDGE_DIR/Caddyfile"
	fi

	runuser -u "$DEPLOY_USER" -- \
		docker compose -f "$EDGE_DIR/docker-compose.yml" up -d
	ok "Caddy بالا آمد"

	step "صدور گواهی (استیجینگ Let's Encrypt)"
	# پیکربندی دامنه‌محور است، پس تست باید با SNI درست انجام شود. --resolve
	# اتصال را به لوکال‌هاست می‌بندد تا به hairpin NAT وابسته نباشیم، و -k
	# لازم است چون گواهی استیجینگ ریشه‌ی مورد اعتماد سیستم را ندارد.
	local got=0
	for i in $(seq 1 24); do
		if curl -fsS -k --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1" \
			"https://${DOMAIN}/healthz" >/dev/null 2>&1; then
			got=1
			break
		fi
		printf '  … تلاش %d/24\n' "$i"
		sleep 5
	done

	if [[ $got -eq 1 ]]; then
		ok "HTTPS با گواهی استیجینگ بالا آمد"
		echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null |
			openssl x509 -noout -issuer -dates 2>/dev/null | sed 's/^/     /'
		echo
		echo "  اگر صادرکننده‌ی بالا «(STAGING)» دارد یعنی مسیر ACME سالم است."
		echo "  سوییچ به گواهی معتبر:  bash $ROOT_DIR/bin/go-live.sh $DOMAIN"
	else
		runuser -u "$DEPLOY_USER" -- \
			docker compose -f "$EDGE_DIR/docker-compose.yml" logs --tail 60 caddy >&2
		die "گواهی استیجینگ صادر نشد — لاگ بالا. تا حل نشدن این، go-live.sh را نزنید."
	fi
}

# ---------------------------------------------------------------------------
phase_verify() {
	step "وضعیت ufw"
	ufw status verbose | sed 's/^/  /'

	step "زنجیره‌ی DOCKER-USER"
	local du
	if du="$(iptables -S DOCKER-USER 2>/dev/null)" && [[ -n $du ]]; then
		printf '%s\n' "$du" | sed 's/^/  /'
		if grep -q -- '-j DROP' <<<"$du"; then
			ok "قانون DROP پیش‌فرض سر جایش است"
		else
			warn "DROP پیدا نشد — بعد از هر «systemctl restart docker» یک «sudo ufw reload» لازم است."
		fi
	else
		warn "زنجیره وجود ندارد (داکر بالا نیست؟)"
	fi

	step "fail2ban"
	fail2ban-client status sshd 2>/dev/null | sed 's/^/  /' || warn "jail بالا نیست"

	step "سرویس‌ها"
	for s in ufw fail2ban docker; do
		printf '  %-10s %s\n' "$s" "$(systemctl is-enabled "$s" 2>/dev/null)/$(systemctl is-active "$s" 2>/dev/null)"
	done

	step "Caddy"
	runuser -u "$DEPLOY_USER" -- \
		docker compose -f "$EDGE_DIR/docker-compose.yml" ps 2>/dev/null | sed 's/^/  /' ||
		warn "پروژه‌ی edge بالا نیست"

	step "گواهی TLS برای $DOMAIN"
	local cert
	cert="$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null |
		openssl x509 -noout -issuer -subject -dates 2>/dev/null || true)"
	if [[ -n $cert ]]; then
		printf '%s\n' "$cert" | sed 's/^/  /'
		if grep -qi 'STAGING' <<<"$cert"; then
			warn "گواهی استیجینگ است (مرورگر معتبر نمی‌داند) — برای سوییچ: bash $ROOT_DIR/bin/go-live.sh"
		else
			ok "گواهی محیط اصلی"
		fi
	else
		warn "گواهی‌ای روی :443 ارائه نشد"
	fi

	step "پورت‌های شنونده روی همه‌ی اینترفیس‌ها"
	# هر چیزی جز 22/80/443 در این لیست یعنی یک سرویس ناخواسته در معرض اینترنت.
	ss -tulpnH 2>/dev/null | awk '$5 !~ /127\.0\.0\.1|\[::1\]/ {printf "  %s %s\n", $1, $5}' | sort -u

	step "ساختار دایرکتوری"
	find "$ROOT_DIR" -maxdepth 1 -mindepth 1 -printf '  %M %u:%g %f\n' | sort -k3
}

# ---------------------------------------------------------------------------
case "${1:-}" in
deps) phase_deps ;;
dirs) phase_dirs ;;
firewall) phase_firewall ;;
fail2ban) phase_fail2ban ;;
caddy) phase_caddy ;;
verify) phase_verify ;;
all)
	phase_deps
	phase_dirs
	phase_firewall
	phase_fail2ban
	phase_caddy
	phase_verify
	;;
*)
	# هدر بالای فایل را تا خط جداکننده‌ی بعدی چاپ می‌کند، تا با ویرایش هدر
	# از هم‌گام بودن نیفتد.
	awk 'NR>2 && /^# -{10,}/{exit} NR>2{print}' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
	exit 2
	;;
esac

printf '\n%sتمام.%s\n' "$GRN" "$RST"
