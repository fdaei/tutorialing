#!/usr/bin/env bash
# بازگردانی بکاپ پستگرس.
#
#   restore-postgres.sh --verify [file]        بازگردانی در یک دیتابیس موقت و حذفش
#   restore-postgres.sh --into-production file  بازنویسی دیتابیس اصلی (مخرب)
#
# بدون آرگومان فایل، جدیدترین بکاپ انتخاب می‌شود.
#
# ‏--verify حالت پیش‌فرض است و عمداً بی‌خطر: بکاپی که هرگز بازگردانده نشده،
# بکاپ نیست — فقط یک فایل است. فاز backup در deploy.sh همین را یک بار اجرا
# می‌کند تا قبل از اولین migration ثابت شود مسیر بازیابی کار می‌کند.

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/deploy/lingospeak}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/env/app.env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
CONTAINER="${CONTAINER:-lingospeak-postgres}"
VERIFY_DB="${VERIFY_DB:-lingospeak_restore_check}"

GRN=$'\033[32m' RED=$'\033[31m' YLW=$'\033[33m' RST=$'\033[0m'
ok() { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
warn() { printf '  %s!%s %s\n' "$YLW" "$RST" "$1"; }
die() {
	printf '  %s✗%s %s\n' "$RED" "$RST" "$1" >&2
	exit 1
}

MODE=verify
FILE=""
for arg in "$@"; do
	case "$arg" in
	--verify) MODE=verify ;;
	--into-production) MODE=production ;;
	-*) die "آرگومان ناشناخته: $arg" ;;
	*) FILE="$arg" ;;
	esac
done

[[ -r $ENV_FILE ]] || die "فایل env خوانده نشد: $ENV_FILE"
read_env() { sed -n "s/^$1=//p" "$ENV_FILE" | head -1; }
PGUSER="$(read_env POSTGRES_USER)"
PGDB="$(read_env POSTGRES_DB)"
[[ -n $PGUSER && -n $PGDB ]] || die "POSTGRES_USER یا POSTGRES_DB در env نیست"

if [[ -z $FILE ]]; then
	FILE="$(find "$BACKUP_DIR" -maxdepth 1 -name 'lingospeak-*.sql.gz' -printf '%T@ %p\n' |
		sort -rn | head -1 | cut -d' ' -f2-)"
	[[ -n $FILE ]] || die "هیچ بکاپی در $BACKUP_DIR پیدا نشد"
fi
[[ -r $FILE ]] || die "فایل بکاپ خوانده نشد: $FILE"
gzip -t "$FILE" 2>/dev/null || die "فایل gzip خراب است: $FILE"

echo "بکاپ : $FILE ($(numfmt --to=iec "$(stat -c%s "$FILE")"))"

psql_as() { docker exec -i "$CONTAINER" psql -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"; }

if [[ $MODE == production ]]; then
	cat <<-EOF

		${RED}اخطار:${RST} این کار محتوای فعلی دیتابیس «$PGDB» را با محتوای بکاپ
		بالا جای‌گزین می‌کند. هر داده‌ای که بعد از آن بکاپ ساخته شده از بین می‌رود.
	EOF
	read -r -p "برای ادامه دقیقاً بنویس: RESTORE $PGDB > " answer
	[[ $answer == "RESTORE $PGDB" ]] || die "لغو شد"

	# یک بکاپ ایمنی از وضعیت فعلی، پیش از بازنویسی.
	safety="$BACKUP_DIR/pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz"
	docker exec "$CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" --clean --if-exists | gzip -9 >"$safety"
	ok "بکاپ ایمنی از وضعیت فعلی: $safety"

	# دامپ با --clean --if-exists ساخته شده، پس خودش اشیاء قبلی را پاک می‌کند.
	zcat "$FILE" | psql_as -d "$PGDB" >/dev/null
	ok "بازگردانی در $PGDB انجام شد"
	tables=$(psql_as -d "$PGDB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
	ok "جدول‌های موجود: $tables"
	exit 0
fi

# ── حالت verify ───────────────────────────────────────────────────────────
echo "حالت : verify (دیتابیس موقت «$VERIFY_DB»، دیتابیس اصلی دست نمی‌خورد)"
echo

cleanup() {
	docker exec -i "$CONTAINER" psql -U "$PGUSER" -d postgres \
		-c "DROP DATABASE IF EXISTS \"$VERIFY_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
psql_as -d postgres -c "CREATE DATABASE \"$VERIFY_DB\";" >/dev/null
ok "دیتابیس موقت ساخته شد"

if ! zcat "$FILE" | psql_as -d "$VERIFY_DB" >/dev/null 2>"$BACKUP_DIR/.restore-check.log"; then
	warn "خروجی خطا:"
	tail -20 "$BACKUP_DIR/.restore-check.log" >&2
	die "بازگردانی شکست خورد — این بکاپ قابل اتکا نیست"
fi
ok "بازگردانی بدون خطا انجام شد"

tables=$(psql_as -d "$VERIFY_DB" -tAc \
	"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
ok "جدول‌های بازگردانده‌شده: $tables"
[[ ${tables:-0} -gt 0 ]] || die "بکاپ هیچ جدولی ندارد"

rm -f "$BACKUP_DIR/.restore-check.log"
echo
printf '%sبکاپ قابل بازگردانی است.%s\n' "$GRN" "$RST"
