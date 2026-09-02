#!/usr/bin/env bash
# Does the domain actually point at this server?
#
# Run this before any attempt to obtain a TLS certificate. Caddy retries ACME
# validation on failure, and Let's Encrypt allows only 5 failed validations per
# host per hour; burning that limit means an hour of forced waiting.
#
#   bash dns-check.sh [domain] [expected-ip]
#
# Exits 0 only when both A records (apex and www) point at the target IP.

set -euo pipefail

DOMAIN="${1:-lingospeak.org}"
EXPECT_IP="${2:?expected IP is required from the private operations configuration}"

RESOLVERS=(1.1.1.1 8.8.8.8 9.9.9.9)

# dig is preferred because it lets us pick the resolver and bypass the local
# system cache — exactly what checking propagation requires.
if ! command -v dig >/dev/null 2>&1; then
	echo "!! dig نصب نیست (بسته‌ی dnsutils). گزارش زیر ناقص است." >&2
	echo -n "getent: "
	getent ahostsv4 "$DOMAIN" || echo "(رزولو نشد)"
	exit 2
fi

echo "دامنه‌ی هدف : $DOMAIN"
echo "IP انتظاری  : $EXPECT_IP"
echo

ok=0
total=0

query() { # query <name> <type> <resolver>
	dig +short +time=3 +tries=1 "$2" "$1" "@$3" 2>/dev/null | grep -vE '^;' | tr '\n' ' ' | sed 's/ $//'
}

for host in "$DOMAIN" "www.$DOMAIN"; do
	for r in "${RESOLVERS[@]}"; do
		total=$((total + 1))
		got="$(query "$host" A "$r")"
		if [[ -z $got ]]; then
			printf '  %-28s @%-8s → %s\n' "$host" "$r" "بدون رکورد A"
		elif [[ " $got " == *" $EXPECT_IP "* ]]; then
			printf '  %-28s @%-8s → %s  ✓\n' "$host" "$r" "$got"
			ok=$((ok + 1))
		else
			printf '  %-28s @%-8s → %s  ✗ (IP دیگری)\n' "$host" "$r" "$got"
		fi
	done
done

echo
ns="$(query "$DOMAIN" NS 8.8.8.8)"
soa="$(query "$DOMAIN" SOA 8.8.8.8)"
caa="$(query "$DOMAIN" CAA 8.8.8.8)"
echo "  NS  : ${ns:-—}"
echo "  SOA : ${soa:-—}"
echo "  CAA : ${caa:-— (بدون محدودیت؛ هر CA ای می‌تواند صادر کند)}"

# CAA whitelists CAs. If a record exists without letsencrypt.org in it,
# issuance is refused — and that error looks confusing in Caddy's log.
if [[ -n $caa && $caa != *letsencrypt.org* ]]; then
	echo
	echo "  ⚠ رکورد CAA وجود دارد ولی letsencrypt.org در آن نیست."
	echo "    تا اضافه نشود Let's Encrypt نمی‌تواند برای این دامنه گواهی بدهد."
fi
echo

if [[ -z $ns && -z $soa ]]; then
	cat <<-EOF
		نتیجه: دامنه اصلاً delegate نشده (NXDOMAIN).
		یعنی یا هنوز ثبت نشده، یا nameserver برایش تنظیم نشده. تا این حل نشود
		هیچ CA ای نمی‌تواند برایش گواهی صادر کند.
	EOF
	exit 1
fi

if [[ $ok -eq $total ]]; then
	echo "نتیجه: هر $total کوئری به $EXPECT_IP رسیدند. آماده‌ی go-live.sh است."
	exit 0
fi

cat <<-EOF
	نتیجه: $ok از $total کوئری درست بود.
	احتمالاً DNS هنوز کامل propagate نشده. چند دقیقه صبر کنید و دوباره اجرا کنید؛
	تا سبز شدن کامل go-live.sh را نزنید.
EOF
exit 1
