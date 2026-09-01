#!/usr/bin/env bash
# سوییچ Caddy از استیجینگ Let's Encrypt به محیط اصلی.
#
#   bash go-live.sh [domain]        # پیش‌فرض: lingospeak.org
#
# کاری که می‌کند: تأیید اینکه گواهی استیجینگ واقعاً صادر شده، حذف بلوک
# ACME-STAGING از Caddyfile، ری‌استارت Caddy، و تأیید اینکه گواهی جدید این بار
# مورد اعتماد سیستم است.
#
# چرا ری‌استارت و نه reload: عوض شدن acme_ca یعنی صدور از یک CA دیگر. Caddy
# گواهی‌ها را در مسیری کلیدخورده به نام CA نگه می‌دارد
# (/data/caddy/certificates/acme-staging-v02… در برابر acme-v02…)، پس گواهی
# استیجینگ دست‌نخورده می‌ماند و ری‌استارت تمیزترین راه برای گرفتن گواهی جدید است.

set -euo pipefail

EDGE_DIR="${EDGE_DIR:-/home/deploy/lingospeak/edge}"
COMPOSE="$EDGE_DIR/docker-compose.yml"
CADDYFILE="$EDGE_DIR/Caddyfile"
CADDY_IMAGE="caddy:2.11.4-alpine"
DOMAIN="${1:-lingospeak.org}"

RED=$'\033[31m' GRN=$'\033[32m' YLW=$'\033[33m' BLD=$'\033[1m' RST=$'\033[0m'
step() { printf '\n%s══ %s%s\n' "$BLD" "$1" "$RST"; }
ok() { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
warn() { printf '  %s!%s %s\n' "$YLW" "$RST" "$1"; }
die() {
	printf '  %s✗%s %s\n' "$RED" "$RST" "$1" >&2
	exit 1
}

[[ -f $CADDYFILE ]] || die "پیدا نشد: $CADDYFILE"

if ! grep -q '^\s*# BEGIN ACME-STAGING' "$CADDYFILE"; then
	ok "بلوک ACME-STAGING وجود ندارد — از قبل روی محیط اصلی هستید."
	exit 0
fi

# ---------------------------------------------------------------------------
step "تأیید اینکه استیجینگ کار کرده"

# --resolve یعنی اتصال مستقیم به لوکال‌هاست با SNI درست، بدون وابستگی به اینکه
# مسیر بازگشتی از خود سرور به IP عمومی (hairpin NAT) کار کند.
# -k لازم است: گواهی استیجینگ ریشه‌ی مورد اعتماد سیستم را ندارد.
if ! curl -fsS -k --max-time 10 --resolve "$DOMAIN:443:127.0.0.1" \
	"https://$DOMAIN/healthz" >/dev/null; then
	die "HTTPS با گواهی استیجینگ جواب نداد. تا این درست نشده سوییچ نکنید:
      docker compose -f $COMPOSE logs --tail 60 caddy"
fi
ok "HTTPS استیجینگ پاسخ می‌دهد"

issuer="$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null |
	openssl x509 -noout -issuer 2>/dev/null || true)"
printf '  صادرکننده‌ی فعلی: %s\n' "${issuer:-نامشخص}"

# ---------------------------------------------------------------------------
step "حذف بلوک استیجینگ"

backup="$CADDYFILE.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$CADDYFILE" "$backup"
ok "پشتیبان: $backup"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
sed '/^\s*# BEGIN ACME-STAGING$/,/^\s*# END ACME-STAGING$/d' "$CADDYFILE" >"$tmp"

grep -q 'acme-staging' "$tmp" && die "هنوز ارجاع به استیجینگ در فایل هست — دستی بررسی کنید."

# حذف بلوک یک خط خالی اضافی جا می‌گذارد؛ caddy fmt نرمالش می‌کند تا فایل بعدی
# دقیقاً همان چیزی باشد که خود Caddy انتظار دارد.
if fmt_out="$(docker run --rm -v "$tmp:/tmp/Caddyfile:ro" "$CADDY_IMAGE" \
	caddy fmt /tmp/Caddyfile 2>/dev/null)" && [[ -n $fmt_out ]]; then
	printf '%s\n' "$fmt_out" >"$tmp"
fi

step "اعتبارسنجی"
# روی فایل موقت و در کانتینر یکبارمصرف، تا اگر خراب بود به Caddyِ در حال اجرا
# دست نزنیم.
docker run --rm -v "$tmp:/tmp/Caddyfile:ro" "$CADDY_IMAGE" \
	caddy validate --adapter caddyfile --config /tmp/Caddyfile >/dev/null 2>&1 ||
	die "پیکربندی بعد از حذف بلوک نامعتبر شد. هیچ تغییری اعمال نشد."
ok "پیکربندی معتبر است"

# مهم: با cat جای‌گزین می‌شود نه mv.
# ‏Caddyfile به صورت تک‌فایل bind-mount شده؛ mv اینود را عوض می‌کند و کانتینر
# تا وقتی recreate نشود همچنان محتوای قدیمی را می‌بیند.
cat "$tmp" >"$CADDYFILE"

# ---------------------------------------------------------------------------
step "ری‌استارت و صدور گواهی اصلی"
docker compose -f "$COMPOSE" restart caddy >/dev/null
ok "Caddy ری‌استارت شد"

for i in $(seq 1 24); do
	# این بار بدون -k: اگر پاس شود یعنی گواهی توسط ریشه‌های سیستم معتبر است،
	# که دقیقاً همان چیزی است که می‌خواهیم اثبات کنیم.
	if curl -fsS --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" \
		"https://$DOMAIN/healthz" >/dev/null 2>&1; then
		echo
		ok "گواهی معتبر محیط اصلی فعال شد."
		echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null |
			openssl x509 -noout -issuer -dates 2>/dev/null | sed 's/^/     /'
		echo
		echo "  از بیرون تست کنید:  curl -I https://$DOMAIN/healthz"
		exit 0
	fi
	printf '  … تلاش %d/24\n' "$i"
	sleep 5
done

echo
warn "بعد از ۲ دقیقه هنوز گواهی معتبر نشد."
cat >&2 <<-EOF

	  لاگ:      docker compose -f $COMPOSE logs --tail 80 caddy
	  بازگشت:   cat "$backup" > "$CADDYFILE" && docker compose -f $COMPOSE restart caddy
EOF
exit 1
