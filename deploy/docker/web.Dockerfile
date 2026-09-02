# syntax directive عمداً حذف شده: Docker Hub از ایران در دسترس نیست و
# BuildKit نمی‌تواند frontend را fetch کند. هیچ فیچر 1.7-only استفاده
# نشده (بدون heredoc، --mount، COPY --link). اگر بعداً یکی از آنها لازم
# شد، directive را برگردان و از محیطی با دسترسی به Docker Hub build کن.
# ---------------------------------------------------------------------------
# ایمیج production برای @lingospeak/web (Next.js 15 + React 19).
#
# ⚠ متغیرهای NEXT_PUBLIC_* در زمان build داخل باندل کلاینت جاسازی می‌شوند، نه
#   در زمان اجرا. عوض کردنشان در docker-compose هیچ اثری ندارد — ایمیج باید از
#   نو ساخته شود. مشخصاً NEXT_PUBLIC_ENAMAD_HTML بعد از دریافت اینماد نیازمند
#   rebuild است، نه restart.
#
# ساخت از ریشه‌ی مخزن:
#   docker build -f deploy/docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://lingospeak.org/api ... \
#     -t lingospeak-web:latest .
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:22-bookworm-slim

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
# ‏Error-Mode=any لازم است چون `apt-get update` بدون آن حتی وقتی یک suite کامل
# نمی‌آید هم exit 0 می‌دهد — آینه‌ای که debian-security ندارد فقط یک E: چاپ
# می‌کند و build سبز می‌ماند، ولی وصله‌های امنیتی ca-certificates از قلم می‌افتد.
# با این فلگ همان حالت exit 100 می‌شود، پس تله‌ی بالا به‌جای این‌که فقط در
# کامنت نوشته شده باشد، خودش را اعلام می‌کند.
RUN apt-get -o APT::Update::Error-Mode=any update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
# مثل ایمیج API: اسکریپت `prepare` بسته‌ی contracts بدون سورس شکست می‌خورد —
# و --ignore-scripts به‌تنهایی کافی نیست، چون npm آن را برای پکیج‌های
# workspace/local هم اجرا می‌کند (رفتاری که این فلگ نادیده‌اش می‌گیرد). حذفش
# تنها راه مطمئن است؛ استیج builder با `npm rebuild` هرچه واقعاً لازم است را
# دوباره اجرا می‌کند.
RUN npm pkg delete scripts.prepare -w @lingospeak/contracts
RUN npm ci --ignore-scripts

FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
RUN npm rebuild
# ‏web هم در زمان type-check (نگاشت مسیر در apps/web/tsconfig.json) و هم در
# زمان اجرا (dist/esm از طریق node_modules) به contracts نیاز دارد.
RUN npm run build:contracts

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_S3_ORIGIN
ARG NEXT_PUBLIC_CONTACT_PHONE
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_LOCALE_COOKIE_MAX_AGE_SECONDS=31536000
ARG NEXT_PUBLIC_ENAMAD_HTML=
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
	NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL} \
	NEXT_PUBLIC_S3_ORIGIN=${NEXT_PUBLIC_S3_ORIGIN} \
	NEXT_PUBLIC_CONTACT_PHONE=${NEXT_PUBLIC_CONTACT_PHONE} \
	NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
	NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
	NEXT_PUBLIC_LOCALE_COOKIE_MAX_AGE_SECONDS=${NEXT_PUBLIC_LOCALE_COOKIE_MAX_AGE_SECONDS} \
	NEXT_PUBLIC_ENAMAD_HTML=${NEXT_PUBLIC_ENAMAD_HTML}

# سقف heap: سرور ۷.۸ گیگ رم دارد و swap اضافه‌شده باید تور ایمنی بماند نه
# مسیر عادی. بدون سقف، Next تا جایی که بتواند بالا می‌رود و OOM killer
# می‌آید (exit code 137).
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build -w @lingospeak/web

# گارد: اگر output standalone در next.config.ts برداشته شود، همین‌جا شکست
# بخور نه با یک ایمیج بی‌سرور.
RUN test -f apps/web/.next/standalone/apps/web/server.js

FROM base AS runtime
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0

# ساختار داخل standalone آینه‌ی outputFileTracingRoot (ریشه‌ی مخزن) است، پس
# سرور در apps/web/server.js قرار می‌گیرد و node_modules ردیابی‌شده کنارش.
COPY --from=builder /app/apps/web/.next/standalone ./
# ‏static و public عمداً در خروجی standalone نیستند و باید دستی کپی شوند —
# فراموش کردنشان یعنی سایتی که بالا می‌آید ولی بدون CSS و تصویر.
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
