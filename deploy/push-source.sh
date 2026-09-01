#!/usr/bin/env bash
# انتقال سورس اپ به سرور برای build.
#
#   bash deploy/push-source.sh                  # از HEAD (توصیه‌شده)
#   bash deploy/push-source.sh --working-tree   # شامل تغییرات کامیت‌نشده
#
# فقط فایل‌های تحت کنترل گیت منتقل می‌شوند: نه .git (۱.۸ گیگ)، نه node_modules،
# نه هیچ .env ای (همه در .gitignore هستند). چیزی روی سرور اجرا نمی‌شود.

set -euo pipefail

HOST="${HOST:-lingospeak}"
DEST="${DEST:-lingospeak/src}"
MODE=head

for arg in "$@"; do
	case "$arg" in
	--working-tree) MODE=worktree ;;
	*)
		echo "آرگومان ناشناخته: $arg" >&2
		exit 2
		;;
	esac
done

cd "$(git rev-parse --show-toplevel)"

dirty="$(git status --porcelain)"
if [[ -n $dirty && $MODE == head ]]; then
	cat >&2 <<-EOF
		درخت کاری تمیز نیست و حالت پیش‌فرض فقط HEAD را می‌فرستد، یعنی این
		تغییرات به سرور **نمی‌روند**:

		$(git status --short | sed 's/^/		  /')

		یا کامیت کن (توصیه‌شده — چیزی که دیپلوی می‌شود بعداً قابل ردیابی باشد):
		    git add -A && git commit -m "..."
		یا اگر عمداً می‌خواهی وضعیت فعلی برود:
		    bash deploy/push-source.sh --working-tree
	EOF
	exit 1
fi

if [[ $MODE == head ]]; then
	ref="$(git rev-parse --short HEAD)"
	echo "منبع : HEAD ($ref)"
	payload=$(mktemp) && trap 'rm -f "$payload"' EXIT
	git archive --format=tar HEAD >"$payload"
else
	echo "منبع : درخت کاری (شامل تغییرات کامیت‌نشده)"
	payload=$(mktemp) && trap 'rm -f "$payload"' EXIT
	# git ls-files تضمین می‌کند فقط فایل‌های ترک‌شده بروند — یعنی .env و
	# node_modules حتی در این حالت هم منتقل نمی‌شوند.
	git ls-files -z | tar --null -T - -cf "$payload"
fi

files=$(tar -tf "$payload" | wc -l)
echo "مقصد : $HOST:~/$DEST"
echo "حجم  : $(numfmt --to=iec "$(stat -c%s "$payload")") در $files فایل"
echo

# مقصد از نو ساخته می‌شود تا فایل حذف‌شده در مخزن روی سرور جا نماند.
ssh "$HOST" "rm -rf ~/$DEST && mkdir -p ~/$DEST"
ssh "$HOST" "tar -xf - -C ~/$DEST" <"$payload"

echo "منتقل شد. هیچ چیزی اجرا نشده."
ssh "$HOST" "echo 'روی سرور: '\$(find ~/$DEST -type f | wc -l)' فایل'"
