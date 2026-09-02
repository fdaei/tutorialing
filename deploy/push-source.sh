#!/usr/bin/env bash
# Ship the app source to the server for building.
#
#   bash deploy/push-source.sh                  # from HEAD (recommended)
#   bash deploy/push-source.sh --working-tree   # includes uncommitted changes
#
# Only git-tracked files are sent: no .git (1.8GB), no node_modules, no .env
# (all gitignored). Nothing is executed on the server.

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
	# git ls-files guarantees only tracked files go, so .env and node_modules
	# stay out even in this mode.
	git ls-files -z | tar --null -T - -cf "$payload"
fi

files=$(tar -tf "$payload" | wc -l)
echo "مقصد : $HOST:~/$DEST"
echo "حجم  : $(numfmt --to=iec "$(stat -c%s "$payload")") در $files فایل"
echo

# Recreated from scratch so a file deleted in the repo doesn't linger remotely.
ssh "$HOST" "rm -rf ~/$DEST && mkdir -p ~/$DEST"
ssh "$HOST" "tar -xf - -C ~/$DEST" <"$payload"

echo "منتقل شد. هیچ چیزی اجرا نشده."
ssh "$HOST" "echo 'روی سرور: '\$(find ~/$DEST -type f | wc -l)' فایل'"
