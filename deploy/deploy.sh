#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# دیپلوی production لینگواسپیک — idempotent و فازبندی‌شده.
#
#   sudo bash deploy.sh <phase>
#
#   env       اعتبارسنجی ~/lingospeak/env/app.env در برابر گاردهای production
#   build     swap + build ترتیبی ایمیج‌های api، migrate و web
#   services  بالا آوردن postgres/redis/minio و ساخت باکت
#   backup    نصب بکاپ روزانه و **تست بازگردانی** (قبل از اولین migration)
#   migrate   prisma migrate deploy + داده‌ی مرجع کشورها (بدون seed دمو)
#   edge      بالا آوردن api/web، انتظار برای healthy، سپس نصب Caddyfile
#   verify    گزارش کامل وضعیت (فقط خواندنی)
#   all       همه‌ی موارد بالا به ترتیب
#
# ترتیب عمدی است: env قبل از build چون NEXT_PUBLIC_* در زمان build داخل
# باندل جاسازی می‌شوند؛ backup قبل از migrate چون بکاپی که تست نشده بکاپ نیست.
#
# متغیرهای اختیاری:
#   DOMAIN=lingospeak.org
#   STORAGE_DOMAIN=storage.lingospeak.org
#   SKIP_COUNTRY_SEED=1   از پرکردن جدول کشورها صرف‌نظر کن
# ---------------------------------------------------------------------------
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DOMAIN="${DOMAIN:-lingospeak.org}"
STORAGE_DOMAIN="${STORAGE_DOMAIN:-storage.lingospeak.org}"
SERVER_IP="${SERVER_IP:-82.115.18.161}"

ROOT_DIR="${ROOT_DIR:-/home/${DEPLOY_USER}/lingospeak}"
APP_DIR="$ROOT_DIR/app"
EDGE_DIR="$ROOT_DIR/edge"
SRC_DIR="$ROOT_DIR/src"
ENV_FILE="$ROOT_DIR/env/app.env"
PROV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$APP_DIR/docker-compose.yml")

RED=$'\033[31m' GRN=$'\033[32m' YLW=$'\033[33m' BLD=$'\033[1m' RST=$'\033[0m'
step() { printf '\n%s══ %s%s\n' "$BLD" "$1" "$RST"; }
ok() { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
warn() { printf '  %s!%s %s\n' "$YLW" "$RST" "$1"; }
die() {
	printf '  %s✗%s %s\n' "$RED" "$RST" "$1" >&2
	exit 1
}
as_deploy() { runuser -u "$DEPLOY_USER" -- "$@"; }

[[ $EUID -eq 0 ]] || die "با sudo اجرا کنید."
id "$DEPLOY_USER" >/dev/null 2>&1 || die "کاربر $DEPLOY_USER وجود ندارد."

read_env() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | head -1; }

# ---------------------------------------------------------------------------
phase_env() {
	step "نصب فایل نمونه"
	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 600 \
		"$PROV_DIR/env/.env.production.example" "$ROOT_DIR/env/.env.production.example"
	ok "نمونه: $ROOT_DIR/env/.env.production.example"

	step "اعتبارسنجی $ENV_FILE"
	if [[ ! -f $ENV_FILE ]]; then
		cat >&2 <<-EOF
		  فایل env هنوز ساخته نشده. روی سرور:

		    cp $ROOT_DIR/env/.env.production.example $ENV_FILE
		    chmod 600 $ENV_FILE
		    \${EDITOR:-nano} $ENV_FILE

		  مقادیر علامت‌خورده با «⟨تولید کن⟩» را پر کن، بعد این فاز را دوباره بزن.
		EOF
		exit 1
	fi

	local perms
	perms="$(stat -c '%a' "$ENV_FILE")"
	[[ $perms == 600 ]] || die "پرمیشن $ENV_FILE برابر $perms است، باید 600 باشد: chmod 600 $ENV_FILE"
	ok "پرمیشن 600"

	# متغیرهایی که schema برایشان default ندارد (env.validation.ts).
	local required=(DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET)
	# متغیرهایی که فقط build وب از آنها استفاده می‌کند.
	required+=(POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB NEXT_PUBLIC_API_URL NEXT_PUBLIC_S3_ORIGIN NEXT_PUBLIC_WEB_URL)
	local missing=()
	for k in "${required[@]}"; do
		[[ -n "$(read_env "$k")" ]] || missing+=("$k")
	done
	[[ ${#missing[@]} -eq 0 ]] || die "این متغیرها خالی یا غایب‌اند: ${missing[*]}"
	ok "همه‌ی متغیرهای اجباری مقدار دارند"

	# طول سکرت‌ها. schema حداقل ۳۲ می‌خواهد؛ کوتاه بودنشان باعث می‌شود API
	# در زمان بوت بیفتد، نه اینجا — پس همین‌جا جلویش را می‌گیریم.
	for k in JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
		local v
		v="$(read_env "$k")"
		[[ ${#v} -ge 32 ]] || die "$k فقط ${#v} کاراکتر است، حداقل ۳۲ لازم است"
	done
	[[ "$(read_env JWT_ACCESS_SECRET)" != "$(read_env JWT_REFRESH_SECRET)" ]] ||
		die "JWT_ACCESS_SECRET و JWT_REFRESH_SECRET یکی هستند — باید فرق کنند"
	ok "سکرت‌های JWT به اندازه‌ی کافی بلند و متمایزند"

	# گاردهای production؛ هرکدام API را در زمان بوت می‌اندازند.
	[[ "$(read_env NODE_ENV)" == production ]] || die "NODE_ENV باید production باشد"
	grep -qE '^AUTH_DEV_OTP=true' "$ENV_FILE" &&
		die "AUTH_DEV_OTP=true با NODE_ENV=production ⇒ API بالا نمی‌آید (و OTP ثابت 123456 می‌شود)"
	[[ "$(read_env ZARINPAL_SANDBOX)" == false ]] || die "ZARINPAL_SANDBOX باید false باشد"
	[[ -n "$(read_env ZARINPAL_MERCHANT_ID)" ]] ||
		die "ZARINPAL_MERCHANT_ID خالی است ⇒ مسیر dev_ فعال می‌شود و هر پرداختی موفق اعلام می‌گردد"
	[[ -n "$(read_env KAVENEGAR_API_KEY)" ]] || die "KAVENEGAR_API_KEY خالی است ⇒ API بالا نمی‌آید"
	[[ "$(read_env TRUST_PROXY)" == 1 ]] ||
		die "TRUST_PROXY باید 1 باشد (یک پراکسی: Caddy) وگرنه محدودیت نرخ per-IP بی‌اثر می‌شود"
	ok "گاردهای production رعایت شده‌اند"

	# ‏DATABASE_URL نباید placeholder مانده باشد و باید رمز واقعی داشته باشد.
	local dburl pgpass
	dburl="$(read_env DATABASE_URL)"
	pgpass="$(read_env POSTGRES_PASSWORD)"
	[[ $dburl != *REPLACE_WITH* ]] || die "DATABASE_URL هنوز placeholder دارد"
	[[ $dburl == *"$pgpass"* ]] ||
		die "رمز داخل DATABASE_URL با POSTGRES_PASSWORD یکی نیست — پستگرس اتصال را رد می‌کند"
	[[ $dburl == *@postgres:5432* ]] ||
		warn "DATABASE_URL به postgres:5432 اشاره نمی‌کند؛ داخل شبکه‌ی compose همین درست است"
	ok "DATABASE_URL با POSTGRES_PASSWORD همخوان است"

	# نشانی‌های عمومی
	# ترتیب مهم است: اسلش انتهایی اول چک می‌شود، وگرنه چک ناهمخوانی زودتر
	# می‌گیرد و پیامی می‌دهد که علت واقعی را پنهان می‌کند.
	[[ "$(read_env S3_ENDPOINT)" != */ ]] ||
		die "S3_ENDPOINT اسلش انتهایی دارد — امضای SigV4 را خراب می‌کند"
	[[ "$(read_env NEXT_PUBLIC_S3_ORIGIN)" != */ ]] ||
		die "NEXT_PUBLIC_S3_ORIGIN اسلش انتهایی دارد"
	[[ "$(read_env S3_ENDPOINT)" == "$(read_env NEXT_PUBLIC_S3_ORIGIN)" ]] ||
		die "S3_ENDPOINT و NEXT_PUBLIC_S3_ORIGIN فرق دارند ⇒ CSP آپلود را بلاک می‌کند"
	ok "نشانی ذخیره‌سازی سازگار است"
}

# ---------------------------------------------------------------------------
phase_build() {
	step "حافظه"
	if [[ "$(swapon --show --noheadings | wc -l)" -gt 0 ]]; then
		ok "swap از قبل فعال است: $(free -h | awk '/^Swap:/{print $2}')"
	else
		# سرور ۷.۸ گیگ رم دارد و build نکست ۲ تا ۳ گیگ پیک می‌زند. swap تور
		# ایمنی است نه مسیر عادی: سقف heap در Dockerfile وب باعث می‌شود قبل
		# از رسیدن به swap متوقف شود.
		fallocate -l 4G /swapfile
		chmod 600 /swapfile
		mkswap /swapfile >/dev/null
		swapon /swapfile
		grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
		ok "۴ گیگ swap ساخته و در fstab ثبت شد"
	fi
	free -h | sed 's/^/     /'

	[[ -d $SRC_DIR ]] || die "سورس پیدا نشد در $SRC_DIR — اول از ماشین محلی: bash deploy/push-source.sh"
	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 \
		"$PROV_DIR/app/docker-compose.yml" "$APP_DIR/docker-compose.yml"

	# فایل‌های دیپلوی از پیلود provision می‌آیند، نه از snapshot سورس، تا
	# اصلاح یک Dockerfile نیازمند push دوباره‌ی کل سورس نباشد.
	install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 "$SRC_DIR/deploy/docker"
	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 \
		"$PROV_DIR/docker/api.Dockerfile" "$PROV_DIR/docker/web.Dockerfile" "$SRC_DIR/deploy/docker/"

	step "build ایمیج API"
	# ترتیبی و نه موازی: دو build همزمان روی ۷.۸ گیگ رم قابل اتکا نیست.
	as_deploy docker build -f "$SRC_DIR/deploy/docker/api.Dockerfile" \
		--target runtime -t lingospeak-api:latest "$SRC_DIR"
	ok "lingospeak-api:latest"

	# گارد اصلی‌ترین ریسک ایمیج API: حل شدن @lingospeak/contracts در زمان اجرا.
	if as_deploy docker run --rm --entrypoint node lingospeak-api:latest \
		-e "require('@lingospeak/contracts')" 2>/dev/null; then
		ok "@lingospeak/contracts داخل ایمیج قابل require است"
	else
		die "ایمیج API نمی‌تواند @lingospeak/contracts را حل کند — کانتینر در زمان بوت می‌افتد"
	fi

	step "build ایمیج migrate"
	as_deploy docker build -f "$SRC_DIR/deploy/docker/api.Dockerfile" \
		--target builder -t lingospeak-api-migrate:latest "$SRC_DIR"
	ok "lingospeak-api-migrate:latest (لایه‌ها با api مشترک)"

	step "build ایمیج وب"
	local args=()
	while IFS= read -r line; do args+=(--build-arg "$line"); done \
		< <(grep -E '^NEXT_PUBLIC_[A-Z_0-9]*=' "$ENV_FILE")
	as_deploy docker build -f "$SRC_DIR/deploy/docker/web.Dockerfile" \
		--target runtime "${args[@]}" -t lingospeak-web:latest "$SRC_DIR"
	ok "lingospeak-web:latest"

	# CLAUDE.md: بعد از هر نصب وابستگی، تأیید کن postcss به نسخه‌ی وصله‌شده
	# رسیده باشد (نکست نسخه‌ی قدیمی خودش را همراه دارد).
	step "بررسی override بسته‌ی postcss"
	as_deploy docker run --rm --entrypoint sh lingospeak-api:latest -c \
		'ls node_modules/postcss/package.json >/dev/null 2>&1 && node -p "require(\"postcss/package.json\").version" || echo "(در ایمیج runtime نیست — درست است)"' |
		sed 's/^/     /'

	step "ایمیج‌ها"
	as_deploy docker images --format '  {{.Repository}}:{{.Tag}}  {{.Size}}' | grep lingospeak || true
}

# ---------------------------------------------------------------------------
phase_services() {
	step "بالا آوردن سرویس‌های داده"
	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 640 \
		"$PROV_DIR/app/docker-compose.yml" "$APP_DIR/docker-compose.yml"

	as_deploy "${COMPOSE[@]}" up -d --wait postgres redis minio
	ok "postgres، redis و minio سالم‌اند"

	as_deploy "${COMPOSE[@]}" run --rm --no-deps -T minio-init
	ok "باکت ساخته شد (بدون هیچ فایل نمونه‌ای)"

	step "بررسی اینکه هیچ پورتی عمومی نشده"
	# مهم‌تر از خروجی ufw: داکر زنجیره‌ی خودش را قبل از ufw اعمال می‌کند، پس
	# آنچه واقعاً می‌شمارد این است که چه چیزی روی 0.0.0.0 شنود می‌کند.
	local public
	public="$(ss -tulpnH | awk '$5 ~ /^(0\.0\.0\.0|\*|\[::\])/ {print $1, $5}' |
		grep -vE ':(22|80|443)$' || true)"
	if [[ -z $public ]]; then
		ok "هیچ پورتی جز 22/80/443 روی اینترفیس عمومی شنود نمی‌کند"
	else
		printf '%s\n' "$public" | sed 's/^/     /'
		die "پورت‌های بالا عمومی‌اند — قبل از ادامه بررسی کن"
	fi
}

# ---------------------------------------------------------------------------
phase_backup() {
	step "نصب اسکریپت‌های بکاپ"
	install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 750 \
		"$PROV_DIR/bin/backup-postgres.sh" "$PROV_DIR/bin/restore-postgres.sh" "$ROOT_DIR/bin/"
	ok "نصب شد در $ROOT_DIR/bin/"

	step "ثبت cron روزانه"
	local line="0 3 * * * $ROOT_DIR/bin/backup-postgres.sh >> $ROOT_DIR/backups/backup.log 2>&1"
	local current
	current="$(as_deploy crontab -l 2>/dev/null || true)"
	if grep -qF 'backup-postgres.sh' <<<"$current"; then
		ok "cron از قبل ثبت شده"
	else
		printf '%s\n%s\n' "$current" "$line" | sed '/^$/d' | as_deploy crontab -
		ok "هر روز ساعت ۳ بامداد"
	fi
	as_deploy crontab -l | grep backup-postgres | sed 's/^/     /'

	step "اجرای یک بکاپ واقعی"
	as_deploy "$ROOT_DIR/bin/backup-postgres.sh" | sed 's/^/     /'

	step "تست بازگردانی"
	# این گام دلیل وجود فاز است. بکاپی که هرگز بازگردانده نشده فقط یک فایل
	# است؛ تا اینجا سبز نشود، migrate اجرا نمی‌شود.
	as_deploy "$ROOT_DIR/bin/restore-postgres.sh" --verify | sed 's/^/     /'
}

# ---------------------------------------------------------------------------
phase_migrate() {
	step "وضعیت فعلی migration ها"
	as_deploy "${COMPOSE[@]}" --profile tools run --rm -T migrate \
		npx prisma migrate status 2>&1 | tail -20 | sed 's/^/     /' || true

	step "اعمال migration ها"
	# فقط migrate deploy — هرگز `migrate dev` و هرگز `db push`.
	as_deploy "${COMPOSE[@]}" --profile tools run --rm -T migrate \
		npx prisma migrate deploy | sed 's/^/     /'
	ok "migration ها اعمال شدند"

	step "داده‌ی مرجع کشورها"
	if [[ -n ${SKIP_COUNTRY_SEED:-} ]]; then
		warn "به درخواست SKIP_COUNTRY_SEED رد شد"
	else
		# prisma/seed.ts کاربر نمونه با OTP ثابت می‌سازد و **هرگز** اجرا
		# نمی‌شود. seed-countries.ts فقط جدول Country را پر می‌کند و هیچ
		# کاربری نمی‌سازد — بدون آن هر انتخابگر کشور در سایت خالی می‌ماند.
		as_deploy "${COMPOSE[@]}" --profile tools run --rm -T migrate \
			npx tsx prisma/seed-countries.ts | sed 's/^/     /'
	fi

	step "تأیید: داده‌ی مرجع هست، داده‌ی دمو نیست"
	local users countries
	users="$(as_deploy docker exec lingospeak-postgres psql -U "$(read_env POSTGRES_USER)" \
		-d "$(read_env POSTGRES_DB)" -tAc 'SELECT count(*) FROM "User"' 2>/dev/null || echo '?')"
	countries="$(as_deploy docker exec lingospeak-postgres psql -U "$(read_env POSTGRES_USER)" \
		-d "$(read_env POSTGRES_DB)" -tAc 'SELECT count(*) FROM "Country"' 2>/dev/null || echo '?')"
	printf '     User    = %s\n     Country = %s\n' "$users" "$countries"
	if [[ $users == 0 ]]; then
		ok "هیچ کاربر نمونه‌ای ساخته نشده"
	else
		warn "جدول User خالی نیست ($users) — اگر انتظارش را نداشتی، seed دمو اجرا شده"
	fi
	[[ $countries != 0 ]] || warn "جدول Country خالی است — انتخابگر کشور در سایت خالی می‌ماند"
}

# ---------------------------------------------------------------------------
phase_edge() {
	step "بالا آوردن api و web"
	as_deploy "${COMPOSE[@]}" up -d --wait api web
	ok "هر دو کانتینر healthy شدند"

	step "بررسی مستقیم بک‌اند (قبل از تغییر Caddy)"
	# با نام سرویس از داخل شبکه‌ی edge تست می‌شود، پس اگر چیزی خراب باشد
	# قبل از اینکه Caddy ترافیک واقعی را به آن بدهد معلوم می‌شود.
	as_deploy docker run --rm --network edge curlimages/curl:latest \
		-fsS --max-time 10 http://api:4001/api/health | sed 's/^/     /' ||
		die "api:4001/api/health پاسخ سالم نداد"
	ok "API از داخل شبکه سالم است"
	as_deploy docker run --rm --network edge curlimages/curl:latest \
		-fsS --max-time 10 -o /dev/null -w '     web:3000 → HTTP %{http_code}\n' http://web:3000/ ||
		die "web:3000 پاسخ نداد"

	step "بررسی DNS ساب‌دامین ذخیره‌سازی"
	local storage_ready=0
	local got
	got="$(dig +short A "$STORAGE_DOMAIN" @8.8.8.8 2>/dev/null | tr '\n' ' ')"
	if [[ " $got " == *" $SERVER_IP "* ]]; then
		storage_ready=1
		ok "$STORAGE_DOMAIN → $SERVER_IP"
	else
		warn "$STORAGE_DOMAIN هنوز به $SERVER_IP اشاره نمی‌کند (${got:-بدون رکورد})"
		warn "بلوک storage در Caddyfile غیرفعال می‌ماند تا سهمیه‌ی ACME نسوزد."
		warn "آپلود و دانلود فایل تا آن موقع کار نمی‌کند. بعد از ساخت رکورد A:"
		warn "  sudo bash $PROV_DIR/deploy.sh edge"
	fi

	step "نصب Caddyfile"
	local tmp
	tmp="$(mktemp)"
	if [[ $storage_ready -eq 1 ]]; then
		sed -e '/^# BEGIN STORAGE$/,/^# END STORAGE$/{ /^# BEGIN STORAGE$/d; /^# END STORAGE$/d; s/^# \{0,1\}//; }' \
			"$PROV_DIR/app/Caddyfile" >"$tmp"
	else
		cp "$PROV_DIR/app/Caddyfile" "$tmp"
	fi

	as_deploy docker run --rm -v "$tmp:/tmp/Caddyfile:ro" caddy:2.11.4-alpine \
		caddy validate --adapter caddyfile --config /tmp/Caddyfile >/dev/null 2>&1 ||
		die "Caddyfile نامعتبر است — هیچ تغییری اعمال نشد"
	ok "Caddyfile معتبر است"

	cp -a "$EDGE_DIR/Caddyfile" "$EDGE_DIR/Caddyfile.bak.$(date +%Y%m%d-%H%M%S)"
	# با cat جای‌گزین می‌شود نه mv: فایل به صورت تک‌فایل bind-mount شده و
	# عوض شدن اینود یعنی کانتینر همچنان محتوای قدیمی را می‌بیند.
	cat "$tmp" >"$EDGE_DIR/Caddyfile"
	rm -f "$tmp"

	as_deploy docker compose -f "$EDGE_DIR/docker-compose.yml" up -d
	as_deploy docker compose -f "$EDGE_DIR/docker-compose.yml" exec -T caddy \
		caddy reload --adapter caddyfile --config /etc/caddy/Caddyfile
	ok "Caddy بارگذاری مجدد شد"

	step "تست از بیرونِ کانتینرها"
	sleep 3
	local code
	for probe in "/api/health:200" "/:200"; do
		local path="${probe%:*}" want="${probe##*:}"
		code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMAIN$path" || echo 000)"
		[[ $code == "$want" ]] && ok "GET $path → $code" || warn "GET $path → $code (انتظار $want)"
	done
	code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -X POST "https://$DOMAIN/api/payments" || echo 000)"
	[[ $code == 503 ]] && ok "POST /api/payments → 503 (درگاه عمداً بسته)" ||
		warn "POST /api/payments → $code (انتظار 503)"
}

# ---------------------------------------------------------------------------
phase_verify() {
	step "کانتینرها"
	as_deploy "${COMPOSE[@]}" ps --format '  {{.Name}}\t{{.Status}}' 2>/dev/null | sed 's/^/  /' || true
	as_deploy docker compose -f "$EDGE_DIR/docker-compose.yml" ps --format '  {{.Name}}\t{{.Status}}' 2>/dev/null || true

	step "سلامت اپ"
	curl -fsS --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null | sed 's/^/     /' ||
		warn "/api/health پاسخ سالم نداد"

	step "گواهی‌ها"
	for h in "$DOMAIN" "$STORAGE_DOMAIN"; do
		printf '  %s\n' "$h"
		echo | openssl s_client -connect "$h:443" -servername "$h" 2>/dev/null |
			openssl x509 -noout -issuer -dates 2>/dev/null | sed 's/^/     /' ||
			printf '     (در دسترس نیست)\n'
	done

	step "پورت‌های شنونده روی اینترفیس عمومی"
	ss -tulpnH | awk '$5 ~ /^(0\.0\.0\.0|\*|\[::\])/ {printf "  %s %s\n", $1, $5}' | sort -u

	step "زنجیره‌ی DOCKER-USER"
	if iptables -S DOCKER-USER 2>/dev/null | grep -q -- '-j DROP'; then
		ok "قانون DROP پیش‌فرض سر جایش است"
	else
		warn "DROP پیدا نشد — بعد از تغییرات داکر: sudo ufw reload"
	fi

	step "دیسک و حافظه"
	df -h / | tail -1 | sed 's/^/     /'
	free -h | sed 's/^/     /'
	printf '     docker: %s\n' "$(docker system df --format '{{.Type}}={{.Size}}' 2>/dev/null | paste -sd' ')"

	step "بکاپ‌ها"
	as_deploy ls -lh "$ROOT_DIR/backups"/lingospeak-*.sql.gz 2>/dev/null | tail -8 | sed 's/^/     /' ||
		warn "هیچ بکاپی نیست"
}

# ---------------------------------------------------------------------------
case "${1:-}" in
env) phase_env ;;
build) phase_build ;;
services) phase_services ;;
backup) phase_backup ;;
migrate) phase_migrate ;;
edge) phase_edge ;;
verify) phase_verify ;;
all)
	phase_env
	phase_build
	phase_services
	phase_backup
	phase_migrate
	phase_edge
	phase_verify
	;;
*)
	awk 'NR>2 && /^# -{10,}/{exit} NR>2{print}' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
	exit 2
	;;
esac

printf '\n%sتمام.%s\n' "$GRN" "$RST"
