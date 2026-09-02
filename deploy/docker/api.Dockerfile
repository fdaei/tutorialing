# syntax directive عمداً حذف شده: Docker Hub از ایران در دسترس نیست و
# BuildKit نمی‌تواند frontend را fetch کند. هیچ فیچر 1.7-only استفاده
# نشده (بدون heredoc، --mount، COPY --link). اگر بعداً یکی از آنها لازم
# شد، directive را برگردان و از محیطی با دسترسی به Docker Hub build کن.
# ---------------------------------------------------------------------------
# ایمیج production برای @lingospeak/api (NestJS 11 + Prisma 6).
#
# ⚠ ایمیج پایه را به alpine عوض نکنید.
#   `prisma generate` در استیج builder موتور کوئری را برای libc همان ایمیج
#   می‌سازد. اگر builder و runtime از نظر libc فرق کنند (glibc در برابر musl)،
#   موتور در زمان اجرا لود نمی‌شود و خطا («Unable to require libquery_engine»)
#   ربطی به Prisma به نظر نمی‌رسد. هر دو استیج باید یک پایه داشته باشند.
#
# ساخت از ریشه‌ی مخزن:
#   docker build -f deploy/docker/api.Dockerfile -t lingospeak-api:latest .
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
# ‏APT_MIRROR وقتی به کار می‌آید که آرشیو رسمی واقعاً در دسترس نباشد:
#   --build-arg APT_MIRROR=mirror.arvancloud.ir
# مقدارش «هاست[/پیشوند]» است نه URL کامل؛ ‏/debian و /debian-security خودشان
# اضافه می‌شوند. خالی گذاشتنش یعنی همان deb.debian.org.
#
# ⚠ اول مطمئن شو مشکل واقعاً دسترسی است. اگر `apt-get update` در build تایم‌اوت
#   می‌خورد ولی همان URL با curl از خود ماشین جواب می‌دهد، مسئله MTU است نه
#   فیلترینگ و هیچ آینه‌ای حلش نمی‌کند (هر آینه‌ی دیگری هم همان‌جا می‌ایستد).
#   شرح کامل و راه‌حلش: بخش «تایم‌اوت apt در زمان build» در deploy/DEPLOY.md.
#
# ⚠ دو تله‌ی آینه‌های داخلی — هر دو بی‌سروصدا:
#   ۱) آروان آرشیو debian-security را روی مسیر استاندارد ندارد؛
#      ‏/debian-security/dists/… می‌شود ۴۰۴ (فقط zzz-dists دارد که apt بلد
#      نیست بسازدش). آرشیو اصلی‌اش اما به‌روز است.
#   ۲) خیلی‌هاشان debian-security کهنه دارند و apt فایل منقضی را رد می‌کند —
#      در آخرین بررسی parspack روی ۲۰۲۴ مانده بود و iranserver هفته‌ها عقب.
#   حذف کردن suite امنیتی جوابِ هیچ‌کدام نیست (openssl وصله‌اش را از همان‌جا
#   می‌گیرد)، پس suite امنیتی را روی آینه‌ای بگذار که واقعاً به‌روز است:
#     --build-arg APT_MIRROR=mirror.arvancloud.ir \
#     --build-arg APT_SECURITY_MIRROR=ftp.de.debian.org
#   قبل از اعتماد به هر آینه‌ای تازگی‌اش را چک کن؛ باید نزدیک امروز باشد:
#     curl -sSL http://<host>/debian-security/dists/bookworm-security/Release \
#       | grep -E '^(Date|Valid-Until):'
ARG APT_MIRROR=deb.debian.org
ARG APT_SECURITY_MIRROR=

# بوکورم سورس‌لیست را در قالب deb822 و در
# /etc/apt/sources.list.d/debian.sources نگه می‌دارد، نه /etc/apt/sources.list
# (که اصلاً وجود ندارد) — هر دو قالب پوشش داده می‌شوند تا با عوض شدن ایمیج
# پایه بی‌صدا از کار نیفتد.
RUN set -eu; \
	sec="${APT_SECURITY_MIRROR:-$APT_MIRROR}"; \
	if [ "$APT_MIRROR" != deb.debian.org ] || [ "$sec" != deb.debian.org ]; then \
		found=; \
		for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list; do \
			[ -f "$f" ] || continue; \
			found=1; \
			sed -i \
				-e "/^[[:space:]]*#/!s|https\?://[^[:space:]]*/debian-security|http://${sec}/debian-security|g" \
				-e "/^[[:space:]]*#/!s|https\?://[^[:space:]]*/debian\([[:space:]]\)|http://${APT_MIRROR}/debian\1|g" \
				-e "/^[[:space:]]*#/!s|https\?://[^[:space:]]*/debian\$|http://${APT_MIRROR}/debian|g" \
				"$f"; \
		done; \
		[ -n "$found" ] || { echo "APT_MIRROR داده شد ولی هیچ سورس‌لیستی پیدا نشد" >&2; exit 1; }; \
		grep -rh --include='*.sources' --include='*.list' '' /etc/apt/sources.list.d; \
		! grep -RhE '^[[:space:]]*(URIs:|deb(-src)?[[:space:]])' \
			/etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null \
			| grep -oE 'https?://[^[:space:]]+' \
			| grep -v "^http://${APT_MIRROR}/" | grep -v "^http://${sec}/" \
			|| { echo "sed با قالب سورس‌لیست نخواند؛ URIهای بالا هنوز روی آینه‌ی قبلی‌اند" >&2; exit 1; }; \
	fi
# openssl را خود Prisma برای موتور کوئری لازم دارد؛ روی ایمیج slim نصب نیست.
# ‏Error-Mode=any لازم است چون `apt-get update` بدون آن حتی وقتی یک suite کامل
# نمی‌آید هم exit 0 می‌دهد — آینه‌ای که debian-security ندارد فقط یک E: چاپ
# می‌کند و build سبز می‌ماند، ولی وصله‌های امنیتی openssl از قلم می‌افتد.
# با این فلگ همان حالت exit 100 می‌شود، پس تله‌ی بالا به‌جای این‌که فقط در
# کامنت نوشته شده باشد، خودش را اعلام می‌کند.
RUN apt-get -o APT::Update::Error-Mode=any update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps ----------
# فقط مانیفست‌ها کپی می‌شوند تا این لایه با تغییر سورس بی‌اعتبار نشود.
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
# packages/contracts یک اسکریپت `prepare` دارد که tsc اجرا می‌کند. --ignore-scripts
# **آن را برای پکیج‌های workspace/local سرکوب نمی‌کند** (یک رفتار شناخته‌شده و
# مستندنشده‌ی npm) — و سورس اینجا هنوز کپی نشده، پس با «tsconfig.esm.json پیدا
# نشد» شکست می‌خورد. حذفش این‌جا تنها راه مطمئن است. استیج builder با
# `npm rebuild` هر اسکریپت نصبی که واقعاً لازم است را از نو اجرا می‌کند.
RUN npm pkg delete scripts.prepare -w @lingospeak/contracts
RUN npm ci --ignore-scripts

# ---------- builder ----------
# این استیج در فاز migrate هم مستقیم استفاده می‌شود: هم prisma CLI و هم tsx
# اینجا موجودند (هر دو devDependency) و لایه‌ها با runtime مشترک‌اند، پس
# دیسک اضافه‌ای مصرف نمی‌شود.
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
RUN npm rebuild
RUN npm run build:contracts
# apps/api/prisma.config.ts می‌خواند `env('DATABASE_URL')` از پکیج
# `prisma/config` — این هلپر اگر متغیر غایب باشد throw می‌کند، حتی برای
# `generate` که هیچ اتصال واقعی به دیتابیس لازم ندارد. در dev این با
# apps/api/.env (که dotenv/config در همان فایل می‌خواند) پنهان می‌ماند؛ اینجا
# چنین فایلی عمداً کپی نشده (رمز دارد)، پس یک مقدار بی‌معنی فقط برای همین
# دستور کافی است.
RUN DATABASE_URL='postgresql://build:build@localhost:5432/build' npm run db:generate -w @lingospeak/api
RUN npm run build -w @lingospeak/api
# گارد سریع: اگر نقطه‌ی ورود جابه‌جا شود، همین‌جا شکست بخور نه در زمان اجرا.
RUN test -f apps/api/dist/apps/api/src/main.js

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
# همان دلیل استیج deps: `prepare` بدون سورس شکست می‌خورد و --ignore-scripts
# آن را برای پکیج‌های workspace سرکوب نمی‌کند.
RUN npm pkg delete scripts.prepare -w @lingospeak/contracts
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# کلاینت تولیدشده‌ی Prisma و موتورهایش. با --ignore-scripts ساخته نمی‌شوند،
# پس از builder می‌آیند.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# ‏dist کامپایل‌شده‌ی API با require("@lingospeak/contracts") صدا می‌زند؛ در زمان
# اجرا از طریق symlink ورک‌اسپیس (که npm ci ساخته) به همین dist می‌رسد.
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# schema و migrations برای `prisma migrate status` و ابزارهای عیب‌یابی.
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

USER node
WORKDIR /app/apps/api
EXPOSE 4001
# نقطه‌ی ورود تو در تو است چون tsconfig مسیر @lingospeak/contracts را به سورس
# نگاشت می‌کند و rootDir به ریشه‌ی مخزن پهن می‌شود. با apps/api/package.json
# هماهنگ است.
CMD ["node", "dist/apps/api/src/main.js"]
