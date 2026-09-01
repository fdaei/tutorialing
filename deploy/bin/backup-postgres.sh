#!/usr/bin/env bash
# بکاپ روزانه‌ی پستگرس. از cron کاربر deploy اجرا می‌شود.
#
#   backup-postgres.sh
#
# طراحی عمدی: بکاپ جدید اول در یک فایل موقت ساخته و **اعتبارسنجی** می‌شود، و
# فقط بعد از موفقیت جای‌گزین و چرخش قدیمی‌ها انجام می‌شود. ترتیب برعکس یعنی یک
# شب که pg_dump شکست بخورد، بکاپ سالم دیروز هم پاک شده باشد.

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/home/deploy/lingospeak}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/env/app.env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
CONTAINER="${CONTAINER:-lingospeak-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

log() { printf '%s  %s\n' "$(date -Is)" "$*"; }
die() {
	printf '%s  ERROR: %s\n' "$(date -Is)" "$*" >&2
	exit 1
}

[[ -r $ENV_FILE ]] || die "فایل env خوانده نشد: $ENV_FILE"

# فقط خطوط KEY=VALUE خوانده می‌شوند — نه source کردن کل فایل، تا یک خط
# ناخواسته در env تبدیل به اجرای دستور نشود.
read_env() { sed -n "s/^$1=//p" "$ENV_FILE" | head -1; }
PGUSER="$(read_env POSTGRES_USER)"
PGDB="$(read_env POSTGRES_DB)"
[[ -n $PGUSER && -n $PGDB ]] || die "POSTGRES_USER یا POSTGRES_DB در $ENV_FILE نیست"

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true ||
	die "کانتینر $CONTAINER بالا نیست"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
final="$BACKUP_DIR/lingospeak-$stamp.sql.gz"
tmp="$final.tmp"
trap 'rm -f "$tmp"' EXIT

log "شروع pg_dump از $CONTAINER (db=$PGDB)"
# بدون -t: تخصیص TTY کاراکتر CR به خروجی اضافه می‌کند و دامپ را خراب می‌کند.
if ! docker exec "$CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" --clean --if-exists |
	gzip -9 >"$tmp"; then
	die "pg_dump شکست خورد — هیچ بکاپ قدیمی‌ای پاک نشد"
fi

# اعتبارسنجی: هم gzip سالم باشد، هم واقعاً یک دامپ پستگرس باشد. یک فایل
# gzip معتبرِ خالی هم «موفق» به نظر می‌رسد.
gzip -t "$tmp" 2>/dev/null || die "فایل gzip خراب است"
zcat "$tmp" | head -40 | grep -q 'PostgreSQL database dump' ||
	die "خروجی شبیه دامپ پستگرس نیست"

size=$(stat -c%s "$tmp")
[[ $size -gt 1024 ]] || die "بکاپ مشکوک کوچک است ($size بایت)"

mv "$tmp" "$final"
trap - EXIT
chmod 600 "$final"
log "بکاپ ساخته شد: $final ($(numfmt --to=iec "$size"))"

# چرخش فقط بعد از موفقیت بالا.
deleted=$(find "$BACKUP_DIR" -maxdepth 1 -name 'lingospeak-*.sql.gz' \
	-mtime "+$RETENTION_DAYS" -print -delete | wc -l)
log "چرخش: $deleted فایل قدیمی‌تر از $RETENTION_DAYS روز حذف شد"
log "موجودی فعلی: $(find "$BACKUP_DIR" -name 'lingospeak-*.sql.gz' | wc -l) بکاپ"
