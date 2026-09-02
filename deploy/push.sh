#!/usr/bin/env bash
# Copy the provisioning payload to the server. Copy only — nothing is executed.
#
#   bash deploy/push.sh
#
# Two harmless commands do run remotely: mkdir -p for the scp destination, and
# chmod +x on the scripts (scp drops the execute bit). Provisioning itself is a
# separate manual step:
#   ssh lingospeak 'sudo bash ~/lingospeak-provision/bootstrap.sh all'

set -euo pipefail

HOST="${HOST:-lingospeak}"
DEST="${DEST:-lingospeak-provision}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "مبدأ : $SRC"
echo "مقصد : $HOST:~/$DEST"
echo

# Guard: DEST must be a bare name. An empty or path-bearing value would turn
# the rm -rf below into something dangerous.
[[ $DEST =~ ^[A-Za-z0-9._-]+$ ]] || {
	echo "DEST نامعتبر: '$DEST' (فقط حروف، عدد، نقطه، خط تیره)" >&2
	exit 2
}

# Recreated from scratch to mirror local exactly: scp never deletes removed
# files, and a stale leftover is confusing. Throwaway payload dir — no state.
ssh "$HOST" "rm -rf ~/$DEST && mkdir -p ~/$DEST"

# push.sh, push-source.sh and bin/build-local.sh are not shipped: all three
# run locally.
scp -r \
	"$SRC/bootstrap.sh" \
	"$SRC/deploy.sh" \
	"$SRC/README.md" \
	"$SRC/DEPLOY.md" \
	"$SRC/fail2ban" \
	"$SRC/ufw" \
	"$SRC/edge" \
	"$SRC/app" \
	"$SRC/docker" \
	"$SRC/env" \
	"$SRC/bin" \
	"$HOST:~/$DEST/"

ssh "$HOST" "chmod +x ~/$DEST/bootstrap.sh ~/$DEST/deploy.sh ~/$DEST/bin/*.sh"

echo
echo "منتقل شد. هیچ چیزی اجرا نشده."
echo "مرحله‌ی بعد (دستی):"
echo "  زیرساخت : sudo bash ~/$DEST/bootstrap.sh all   (اگر هنوز اجرا نشده)"
echo "  سورس اپ : bash deploy/push-source.sh           (از همین ماشین)"
echo "  دیپلوی  : sudo bash ~/$DEST/deploy.sh env      (فاز به فاز — DEPLOY.md)"
