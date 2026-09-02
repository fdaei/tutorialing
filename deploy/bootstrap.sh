#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Base server infrastructure for lingospeak — idempotent and phased.
#
#   sudo bash bootstrap.sh <phase>
#
#   deps      install packages (ufw, fail2ban, python3-systemd, dnsutils)
#   dirs      create /home/deploy/lingospeak with correct ownership and modes
#   firewall  ufw rules (22/80/443 only) + close Docker's ufw bypass
#   fail2ban  install the jail and start it
#   caddy     edge network + reverse proxy + Let's Encrypt staging certificate
#   verify    status report (read-only)
#   all       all of the above, in order
#
# Re-running any phase is safe.
#
# The caddy phase deliberately stays on Let's Encrypt staging so the ACME path
# is proven without burning the production quota. To switch to a real cert:
#   bash /home/deploy/lingospeak/bin/go-live.sh
#
# Optional variables:
#   ADMIN_IP=1.2.3.4       added to the fail2ban ignoreip list
#   DEPLOY_USER=deploy     user owning the directory tree
#   DOMAIN=lingospeak.org  domain the certificate is tested against
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
	# python3-systemd looks optional but isn't: fail2ban with backend=systemd
	# won't start without it, and a minimal Ubuntu 24.04 install has no
	# /var/log/auth.log for the file backend to read.
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
	# Owner-only: these hold secrets and database backups.
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

	# The reset is deliberate: starting from defaults is the only way to
	# guarantee "22/80/443 only" — otherwise a re-run just appends rules and
	# any old manual rule survives. ufw backs up the previous files to
	# /etc/ufw/*.YYYYMMDD. Note that this phase wipes manual rules added later.
	ufw --force reset >/dev/null 2>&1 || true
	ufw default deny incoming >/dev/null
	ufw default allow outgoing >/dev/null

	# `limit` rather than `allow`: more than 6 new connections in 30s from one
	# IP get dropped. The local ssh config uses ControlMaster, so parallel
	# ssh/scp multiplex over one TCP connection and never hit this limit.
	ufw limit 22/tcp comment 'SSH (rate limited)' >/dev/null
	ufw allow 80/tcp comment 'HTTP / ACME' >/dev/null
	ufw allow 443/tcp comment 'HTTPS' >/dev/null
	ufw allow 443/udp comment 'HTTP/3' >/dev/null

	# Lockout guard: never enable ufw without a rule for port 22.
	ufw show added | grep -qE '(limit|allow) 22/tcp' ||
		die "قانون SSH ثبت نشد — ufw فعال نشد تا از سرور بیرون نمانید."

	ufw --force enable >/dev/null
	ok "ufw فعال شد: 22/tcp (limit)، 80/tcp، 443/tcp+udp، بقیه deny"

	step "بستن دور زدن ufw توسط داکر"

	# The public interface is detected at runtime, not hardcoded — its name
	# varies across providers (eth0 / ens3 / enp1s0 / …).
	local pub_if
	pub_if="$(ip -4 route get 1.1.1.1 2>/dev/null |
		awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')"
	[[ -n $pub_if ]] || die "اینترفیس عمومی تشخیص داده نشد."
	ok "اینترفیس عمومی: $pub_if"

	local rules=/etc/ufw/after.rules
	[[ -f "${rules}.lingospeak.bak" ]] || cp -a "$rules" "${rules}.lingospeak.bak"

	# The previous block is removed and rewritten so re-runs don't duplicate it.
	sed -i '/^# BEGIN LINGOSPEAK DOCKER-USER$/,/^# END LINGOSPEAK DOCKER-USER$/d' "$rules"
	sed -e "s|__PUB_IF__|$pub_if|g" "$SRC_DIR/ufw/docker-user.after.rules" >>"$rules"

	ufw reload >/dev/null
	ok "بلوک DOCKER-USER نصب شد؛ ufw reload شد"

	# Maintenance note: the `:DOCKER-USER - [0:0]` line makes iptables-restore
	# flush the chain on every reload, so repeated reloads don't duplicate
	# rules. But if the Docker daemon restarts *after* ufw it may rebuild the
	# chain — run `ufw reload` once after any `systemctl restart docker`. The
	# verify phase checks for this.
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

	# Give the jail a moment to read the journal and come up
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

	# The network is external so bringing the app project down doesn't remove it.
	if docker network inspect edge >/dev/null 2>&1; then
		ok "شبکه‌ی edge از قبل وجود دارد"
	else
		runuser -u "$DEPLOY_USER" -- docker network create edge >/dev/null
		ok "شبکه‌ی edge ساخته شد"
	fi

	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 \
		"$SRC_DIR/edge/docker-compose.yml" "$EDGE_DIR/"

	# Replaced with cat, not mv/install: the Caddyfile is bind-mounted as a
	# single file, and changing the inode means the running container keeps
	# seeing the old contents. Writing in place preserves the inode.
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
	# The config is domain-based, so the test needs the right SNI. --resolve
	# points the connection at localhost to avoid depending on hairpin NAT, and
	# -k is required because the staging cert has no system-trusted root.
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
	# Anything but 22/80/443 here means a service is unintentionally exposed.
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
	# Prints the file header down to the next separator line, so editing the
	# header can't leave the usage text out of sync.
	awk 'NR>2 && /^# -{10,}/{exit} NR>2{print}' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
	exit 2
	;;
esac

printf '\n%sتمام.%s\n' "$GRN" "$RST"
