# syntax=docker/dockerfile:1.7
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

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps ----------
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

# ---------- builder ----------
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

# ---------- runtime ----------
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
