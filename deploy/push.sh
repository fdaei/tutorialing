#!/usr/bin/env bash
# انتقال پیلود provisioning به سرور. فقط کپی می‌کند — هیچ چیزی اجرا نمی‌شود.
#
#   bash deploy/push.sh
#
# دو دستور روی سرور اجرا می‌شود و هر دو بی‌ضررند:
#   ۱) mkdir -p ~/lingospeak-provision   (مقصد scp باید وجود داشته باشد)
#   ۲) chmod +x روی اسکریپت‌ها           (scp بیت اجرا را حفظ نمی‌کند)
# راه‌اندازی واقعی جداگانه و دستی است:
#   ssh lingospeak 'sudo bash ~/lingospeak-provision/bootstrap.sh all'

set -euo pipefail

HOST="${HOST:-lingospeak}"
DEST="${DEST:-lingospeak-provision}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "مبدأ : $SRC"
echo "مقصد : $HOST:~/$DEST"
echo

# گارد: DEST باید یک نام ساده باشد. بدون این، یک مقدار خالی یا مسیردار،
# دستور پاک‌سازی زیر را به چیز خطرناکی تبدیل می‌کند.
[[ $DEST =~ ^[A-Za-z0-9._-]+$ ]] || {
	echo "DEST نامعتبر: '$DEST' (فقط حروف، عدد، نقطه، خط تیره)" >&2
	exit 2
}

# مقصد از نو ساخته می‌شود تا دقیقاً آینه‌ی محلی باشد: scp فایل‌های حذف‌شده را
# پاک نمی‌کند و یک فایل قدیمیِ جامانده می‌تواند گیج‌کننده باشد. این دایرکتوری
# صرفاً پیلود موقت است — هیچ حالتی (state) در آن نگهداری نمی‌شود.
ssh "$HOST" "rm -rf ~/$DEST && mkdir -p ~/$DEST"

# push.sh خودش لازم نیست منتقل شود (اسکریپت سمت محلی است).
scp -r \
	"$SRC/bootstrap.sh" \
	"$SRC/README.md" \
	"$SRC/fail2ban" \
	"$SRC/ufw" \
	"$SRC/edge" \
	"$SRC/bin" \
	"$HOST:~/$DEST/"

ssh "$HOST" "chmod +x ~/$DEST/bootstrap.sh ~/$DEST/bin/*.sh"

echo
echo "منتقل شد. هیچ چیزی اجرا نشده."
echo "مرحله‌ی بعد (دستی):"
echo "  ssh $HOST"
echo "  sudo bash ~/$DEST/bootstrap.sh all      # یا فاز به فاز، README را ببینید"
