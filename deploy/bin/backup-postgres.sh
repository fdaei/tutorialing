#!/usr/bin/env bash
# Daily Postgres backup: dump, verify, rotate. Installed by deploy.sh's backup
# phase and run from cron at 03:00.
#
# The shebang is load-bearing: `set -o pipefail`, `[[ =~ ]]` and `<<<` are all
# bash-only. Without it an exec of this file falls back to /bin/sh (dash on
# Debian) and it dies on its very first line with "Illegal option -o pipefail".
# deploy.sh and the cron line also spell out `bash` explicitly, so the script
# still runs correctly if the shebang is ever lost again.

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

read_env() { sed -n "s/^$1=//p" "$ENV_FILE" | head -1; }
PGUSER="$(read_env POSTGRES_USER)"
PGDB="$(read_env POSTGRES_DB)"
[[ -n $PGUSER && -n $PGDB ]] || die "POSTGRES_USER یا POSTGRES_DB در $ENV_FILE نیست"

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true ||
	die "کانتینر $CONTAINER بالا نیست"

# A dump of a table-less database is ~370 bytes of pure header: structurally a
# perfect dump of nothing, so none of the checks below can tell it apart from a
# real one. On the cron path an empty production database is an emergency, not a
# backup opportunity, so bail out here — *before* anything is written and before
# the rotation step, so the last good backups survive.
# deploy.sh checks the same thing itself and skips this script entirely on a
# first deploy, where an empty database is expected rather than alarming.
tables="$(docker exec "$CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc \
	"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || true)"
[[ $tables =~ ^[0-9]+$ ]] || die "شمارش جدول‌های «$PGDB» ناموفق بود — پستگرس پاسخ نداد"
if [[ $tables -eq 0 ]]; then
	log "دیتابیس «$PGDB» هیچ جدولی در schema public ندارد"
	log "اگر هنوز migration اجرا نشده این طبیعی است — اول: deploy.sh migrate"
	log "اگر قبلاً داده داشت یعنی اسکیما از دست رفته — به $BACKUP_DIR دست نزن"
	die "از دیتابیس خالی بکاپ گرفته نشد (چرخش بکاپ‌های قدیمی هم اجرا نشد)"
fi
log "جدول‌های مبدأ: $tables"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
final="$BACKUP_DIR/lingospeak-$stamp.sql.gz"
tmp="$final.tmp"
trap 'rm -f "$tmp"' EXIT

log "شروع pg_dump از $CONTAINER (db=$PGDB)"
if ! docker exec "$CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" --clean --if-exists |
	gzip -9 >"$tmp"; then
	die "pg_dump شکست خورد — هیچ بکاپ قدیمی‌ای پاک نشد"
fi

gzip -t "$tmp" 2>/dev/null || die "فایل gzip خراب است"

# Capture first, match after. head and grep exit as soon as they have what they
# need, which SIGPIPEs zcat; `set -o pipefail` turns that into a false failure
# on any dump larger than the 64KB pipe buffer — that is, on every real one.
dump_head="$(zcat "$tmp" | head -40 || true)"
grep -q 'PostgreSQL database dump' <<<"$dump_head" ||
	die "خروجی شبیه دامپ پستگرس نیست"

# pg_dump writes this line last (newer versions follow it with \unrestrict), so
# it is the one exact test for a truncated dump. `gzip -t` passes happily on a
# stream that was closed cleanly halfway through, and a byte-count floor is only
# ever a guess: a valid dump of a small schema is well under 1KB, while an empty
# database — the case a floor looks like it catches — is caught up front by the
# table count instead.
dump_tail="$(zcat "$tmp" | tail -10)"
grep -q 'PostgreSQL database dump complete' <<<"$dump_tail" ||
	die "دامپ ناقص است — خط پایانی pg_dump در فایل نیست"

size=$(stat -c%s "$tmp")

mv "$tmp" "$final"
trap - EXIT
chmod 600 "$final"
log "بکاپ ساخته شد: $final ($(numfmt --to=iec "$size"))"

deleted=$(find "$BACKUP_DIR" -maxdepth 1 -name 'lingospeak-*.sql.gz' \
	-mtime "+$RETENTION_DAYS" -print -delete | wc -l)
log "چرخش: $deleted فایل قدیمی‌تر از $RETENTION_DAYS روز حذف شد"
log "موجودی فعلی: $(find "$BACKUP_DIR" -name 'lingospeak-*.sql.gz' | wc -l) بکاپ"
