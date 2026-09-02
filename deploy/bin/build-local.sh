#!/usr/bin/env bash
# پلن B: build روی ماشین محلی و انتقال ایمیج‌ها.
#
#   bash deploy/bin/build-local.sh
#
# فقط وقتی لازم است که build روی سرور OOM بخورد (علامتش: پیام Killed یا
# exit code 137 در خروجی `deploy.sh build`). سرور ۷.۸ گیگ رم دارد و build
# نکست معمولاً ۲ تا ۳ گیگ پیک می‌زند؛ فاز build خودش swap می‌سازد، ولی اگر
# باز هم کم آورد این مسیر بدون هیچ تغییری در Dockerfile کار می‌کند.
#
# هزینه‌اش آپلود چند صد مگابایت به فرانکفورت است، پس مسیر پیش‌فرض نیست.
# روی خود ماشین محلی اجرا می‌شود، نه سرور.

set -euo pipefail

HOST="${HOST:-lingospeak}"
REMOTE_ENV="${REMOTE_ENV:-lingospeak/env/app.env}"
cd "$(git rev-parse --show-toplevel)"

# آینه‌ی apt. برخلاف deploy.sh (که روی سرور فرانکفورت اجرا می‌شود و آرشیو رسمی
# را دارد) این اسکریپت روی ماشین محلی اجرا می‌شود، جایی که IPهای فست‌لای
# deb.debian.org مسدودند — پس پیش‌فرض این‌جا آینه است، نه آرشیو رسمی.
#
# دو متغیر لازم است، نه یکی: آروان آرشیو debian-security را روی مسیر استاندارد
# ندارد (۴۰۴ می‌دهد) و suite امنیتی جایی است که openssl وصله‌اش را می‌گیرد.
# جزئیات هر دو تله در deploy/docker/api.Dockerfile.
#
# بازگشت به آرشیو رسمی (مثلاً از شبکه‌ای که فیلتر نیست):
#   APT_MIRROR=deb.debian.org APT_SECURITY_MIRROR=deb.debian.org \
#     bash deploy/bin/build-local.sh
#
# ⚠ اگر build روی `apt-get update` تایم‌اوت می‌خورد، اول MTU را بررسی کن نه
#   فیلترینگ — بخش «تایم‌اوت apt در زمان build» در deploy/DEPLOY.md. آینه
#   دادن آن مشکل را حل نمی‌کند، و با تونل WireGuard بالا هر آینه‌ای همان‌جا
#   می‌ایستد.
#
# هر آرگومان اضافه‌ی خط فرمان هم دست‌نخورده به هر سه `docker build` می‌رود:
#   bash deploy/bin/build-local.sh --build-arg APT_MIRROR=parspack.repo
apt_args=(
	--build-arg "APT_MIRROR=${APT_MIRROR:-mirror.arvancloud.ir}"
	--build-arg "APT_SECURITY_MIRROR=${APT_SECURITY_MIRROR:-ftp.de.debian.org}"
	"$@"
)

BLD=$'\033[1m' GRN=$'\033[32m' RST=$'\033[0m'
step() { printf '\n%s══ %s%s\n' "$BLD" "$1" "$RST"; }

step "خواندن متغیرهای build از سرور"
# فقط NEXT_PUBLIC_* خوانده می‌شود. اینها در باندل کلاینت جاسازی می‌شوند، پس
# ذاتاً عمومی‌اند — هیچ سکرتی از سرور به ماشین محلی نمی‌آید.
mapfile -t pub < <(ssh "$HOST" "grep -E '^NEXT_PUBLIC_[A-Z_0-9]*=' ~/$REMOTE_ENV || true")
[[ ${#pub[@]} -gt 0 ]] || {
	echo "هیچ NEXT_PUBLIC_* در ~/$REMOTE_ENV پیدا نشد — اول فاز env را کامل کن." >&2
	exit 1
}
build_args=()
for line in "${pub[@]}"; do
	printf '  %s\n' "$line"
	build_args+=(--build-arg "$line")
done

step "build ایمیج API"
docker build -f deploy/docker/api.Dockerfile "${apt_args[@]}" \
	--target runtime -t lingospeak-api:latest .

step "build ایمیج migrate (استیج builder)"
# لایه‌هایش با ایمیج بالا مشترک است، پس عملاً فقط یک تگ اضافه می‌شود.
docker build -f deploy/docker/api.Dockerfile "${apt_args[@]}" \
	--target builder -t lingospeak-api-migrate:latest .

step "build ایمیج وب"
docker build -f deploy/docker/web.Dockerfile "${apt_args[@]}" \
	--target runtime "${build_args[@]}" -t lingospeak-web:latest .

step "انتقال"
size=$(docker image inspect lingospeak-api:latest lingospeak-web:latest lingospeak-api-migrate:latest \
	--format '{{.Size}}' | paste -sd+ | bc)
echo "  حجم خام سه ایمیج: $(numfmt --to=iec "$size") (فشرده کمتر می‌شود)"
echo "  در حال ارسال — این مرحله طولانی‌ترین بخش است…"
docker save lingospeak-api:latest lingospeak-api-migrate:latest lingospeak-web:latest |
	gzip -1 | ssh "$HOST" 'gunzip | docker load'

step "تأیید روی سرور"
ssh "$HOST" 'docker images --format "  {{.Repository}}:{{.Tag}}  {{.Size}}" | grep lingospeak'

printf '\n%sانجام شد.%s ادامه از فاز services:\n' "$GRN" "$RST"
echo "  ssh $HOST 'sudo bash ~/lingospeak-provision/deploy.sh services'"
