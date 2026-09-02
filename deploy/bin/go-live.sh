#!/usr/bin/env bash
# Switch Caddy from Let's Encrypt staging to production.
#
#   bash go-live.sh [domain]        # default: lingospeak.org
#
# Confirms the staging certificate was really issued, removes the ACME-STAGING
# block from the Caddyfile, restarts Caddy, and confirms the new certificate is
# trusted by the system.
#
# Restart, not reload: changing acme_ca means issuing from a different CA, and
# Caddy stores certificates under a CA-keyed path
# (/data/caddy/certificates/acme-staging-v02… vs acme-v02…). The staging cert
# stays untouched, and a restart is the cleanest way to get the new one.

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

# --resolve connects straight to localhost with the right SNI, without relying
# on the server reaching its own public IP (hairpin NAT). -k is required: the
# staging certificate has no system-trusted root.
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

# Removing the block leaves a stray blank line; caddy fmt normalizes it so the
# resulting file is exactly what Caddy expects.
if fmt_out="$(docker run --rm -v "$tmp:/tmp/Caddyfile:ro" "$CADDY_IMAGE" \
	caddy fmt /tmp/Caddyfile 2>/dev/null)" && [[ -n $fmt_out ]]; then
	printf '%s\n' "$fmt_out" >"$tmp"
fi

step "اعتبارسنجی"
# Against the temp file in a throwaway container, so a broken config never
# touches the running Caddy.
docker run --rm -v "$tmp:/tmp/Caddyfile:ro" "$CADDY_IMAGE" \
	caddy validate --adapter caddyfile --config /tmp/Caddyfile >/dev/null 2>&1 ||
	die "پیکربندی بعد از حذف بلوک نامعتبر شد. هیچ تغییری اعمال نشد."
ok "پیکربندی معتبر است"

# Important: replaced with cat, not mv. The Caddyfile is bind-mounted as a
# single file; mv swaps the inode and the container keeps seeing the old
# contents until it is recreated.
cat "$tmp" >"$CADDYFILE"

# ---------------------------------------------------------------------------
step "ری‌استارت و صدور گواهی اصلی"
docker compose -f "$COMPOSE" restart caddy >/dev/null
ok "Caddy ری‌استارت شد"

for i in $(seq 1 24); do
	# No -k this time: passing means the certificate validates against the
	# system roots, which is exactly what we're proving.
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
