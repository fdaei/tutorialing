#!/usr/bin/env bash
# آیا دامنه واقعاً به این سرور اشاره می‌کند؟
#
# پیش از هر تلاشی برای گرفتن گواهی TLS این را اجرا کنید. Caddy در صورت شکست
# اعتبارسنجی ACME مدام تلاش می‌کند و Let's Encrypt سقف ۵ اعتبارسنجی ناموفق
# در ساعت به ازای هر هاست دارد؛ سوختن آن سقف یعنی یک ساعت انتظار اجباری.
#
#   bash dns-check.sh [domain] [expected-ip]
#
# خروج ۰ فقط وقتی هر دو رکورد A (خود دامنه و www) دقیقاً به IP هدف اشاره کنند.

set -euo pipefail

DOMAIN="${1:-lingospeak.org}"
EXPECT_IP="${2:-82.115.18.161}"

RESOLVERS=(1.1.1.1 8.8.8.8 9.9.9.9)

# dig ترجیح داده می‌شود چون اجازه‌ی انتخاب ریزالور را می‌دهد و کش محلی/سیستمی
# را دور می‌زند — دقیقاً همان چیزی که برای بررسی propagate شدن لازم است.
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

# CAA فهرست سفید CA هاست. اگر رکورد وجود داشته باشد و letsencrypt.org در آن
# نباشد، صدور گواهی رد می‌شود — و این خطا در لاگ Caddy گیج‌کننده به نظر می‌رسد.
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
