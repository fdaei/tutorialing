#!/usr/bin/env bash
# Plan B: build on the local machine and ship the images.
#
#   bash deploy/bin/build-local.sh
#
# Only needed when the server build OOMs (symptom: Killed, or exit code 137 in
# `deploy.sh build` output). The server has 7.8GB RAM and the Next build
# typically peaks at 2-3GB; the build phase adds swap itself, but if that still
# isn't enough this path works with no Dockerfile changes.
#
# It costs a few hundred MB uploaded to Frankfurt, so it isn't the default.
# Runs on the local machine, not the server.

set -euo pipefail

HOST="${HOST:-lingospeak}"
REMOTE_ENV="${REMOTE_ENV:-lingospeak/env/app.env}"
cd "$(git rev-parse --show-toplevel)"

# apt mirror. Unlike deploy.sh (which runs on the Frankfurt server and can
# reach the official archive), this script runs locally, where the Fastly IPs
# behind deb.debian.org are blocked — so a mirror is the default here.
#
# Two variables are needed, not one: Arvan doesn't carry the debian-security
# archive at the standard path (404s), and the security suite is where openssl
# gets its patch. Both traps are detailed in deploy/docker/api.Dockerfile.
#
# Back to the official archive (e.g. from an unfiltered network):
#   APT_MIRROR=deb.debian.org APT_SECURITY_MIRROR=deb.debian.org \
#     bash deploy/bin/build-local.sh
#
# WARNING: if the build times out on `apt-get update`, check MTU first, not
#   filtering — see the apt build-timeout section in deploy/DEPLOY.md. Setting
#   a mirror does not fix that, and with a WireGuard tunnel up any mirror
#   stalls the same way.
#
# Extra command-line arguments are passed through to all three `docker build`s:
#   bash deploy/bin/build-local.sh --build-arg APT_MIRROR=parspack.repo
apt_args=(
	--build-arg "APT_MIRROR=${APT_MIRROR:-mirror.arvancloud.ir}"
	--build-arg "APT_SECURITY_MIRROR=${APT_SECURITY_MIRROR:-ftp.de.debian.org}"
	"$@"
)

BLD=$'\033[1m' GRN=$'\033[32m' RST=$'\033[0m'
step() { printf '\n%s══ %s%s\n' "$BLD" "$1" "$RST"; }

step "خواندن متغیرهای build از سرور"
# Only NEXT_PUBLIC_* is read. These are embedded in the client bundle and so
# are public by nature — no secret leaves the server for the local machine.
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
# Shares layers with the image above, so this is effectively just an extra tag.
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
