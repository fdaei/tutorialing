# راهنمای بیلد و دیپلوی روی سرور

این راهنما برای دیپلوی production پروژه‌ی LingoSpeak با Docker Compose و
اسکریپت `deploy/deploy.sh` است. مقادیر واقعی سرور، دامنه و secretها باید فقط
از runbook یا secret manager خصوصی خوانده شوند.

## پیش‌نیاز

سرور باید Linux، Docker و Docker Compose plugin داشته باشد. کاربر کم‌دسترسی
`deploy` (یا مقدار `DEPLOY_USER`) باید به Docker دسترسی داشته باشد. دامنه‌ی اصلی
و دامنه‌ی storage نیز باید به IP سرور اشاره کنند.

در اولین راه‌اندازی، از روی سرور اجرا کنید:

```bash
sudo bash deploy/bootstrap.sh all
```

مسیر پیش‌فرض پروژه روی سرور `/home/deploy/lingospeak` است.

## ساخت env production

فایل env را مستقیماً روی سرور بسازید؛ آن را commit یا از `.env.example` کپی نکنید:

```bash
sudo install -d -o deploy -g deploy -m 700 /home/deploy/lingospeak/env
sudo install -o deploy -g deploy -m 600 /dev/null /home/deploy/lingospeak/env/app.env
sudo -u deploy ${EDITOR:-nano} /home/deploy/lingospeak/env/app.env
```

حداقل متغیرهایی که `deploy.sh env` بررسی می‌کند:

```dotenv
NODE_ENV=production
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
DATABASE_URL=postgresql://...:...@postgres:5432/...
JWT_ACCESS_SECRET=حداقل-۳۲-کاراکتر
JWT_REFRESH_SECRET=یک-مقدار-متفاوت-حداقل-۳۲-کاراکتر
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_ENDPOINT=https://storage.example.com
NEXT_PUBLIC_API_URL=https://example.com/api
NEXT_PUBLIC_S3_ORIGIN=https://storage.example.com
NEXT_PUBLIC_WEB_URL=https://example.com
ZARINPAL_SANDBOX=false
ZARINPAL_MERCHANT_ID=...
KAVENEGAR_API_KEY=...
TRUST_PROXY=1
```

`S3_ENDPOINT` و `NEXT_PUBLIC_S3_ORIGIN` نباید اسلش انتهایی داشته باشند و رمز
داخل `DATABASE_URL` باید با `POSTGRES_PASSWORD` یکی باشد. در production،
`AUTH_DEV_OTP=true` و `AUTH_OTP_ALLOWLIST` نباید فعال باشند.

## ارسال سورس از سیستم توسعه

از ریشه‌ی repository و با SSH alias خصوصی خودتان:

```bash
bash deploy/push-source.sh
```

این دستور فقط آخرین commit را می‌فرستد و اگر working tree کثیف باشد متوقف می‌شود.
برای ارسال تغییرات commit‌نشده:

```bash
bash deploy/push-source.sh --working-tree
```

## بیلد و دیپلوی کامل

پس از آماده بودن source، env و زیرساخت، روی سرور اجرا کنید:

```bash
cd /path/to/provision/deploy
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh all
```

این دستور به‌ترتیب env را اعتبارسنجی می‌کند، ایمیج‌های API/migrate/web را
می‌سازد، سرویس‌های داده را بالا می‌آورد، backup و restore را تست می‌کند،
migration و seedهای production را اجرا می‌کند و در پایان Caddy و health checkها
را فعال می‌کند. buildها عمداً ترتیبی هستند؛ اسکریپت در صورت نبودن swap یک swap
چهار گیگابایتی می‌سازد.

## اجرای مرحله‌ای

برای کنترل بیشتر یا ادامه بعد از خطا:

```bash
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh env
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh build
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh services
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh backup
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh migrate
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh edge
sudo SERVER_IP=<PRIVATE_SERVER_IP> bash deploy.sh verify
```

برای tag مشخص و قابل ردیابی:

```bash
sudo SERVER_IP=<PRIVATE_SERVER_IP> IMAGE_TAG=<git-sha> RELEASE_SHA=<git-sha> bash deploy.sh build
```

اگر mirror داخلی لازم است، `APT_MIRROR` و در صورت نیاز `APT_SECURITY_MIRROR`
را به‌صورت environment variable بدهید.

## بررسی بعد از دیپلوی

```bash
sudo bash deploy.sh verify
curl -fsS https://<DOMAIN>/api/health
sudo -u deploy docker compose --env-file /home/deploy/lingospeak/env/app.env \
  -f /home/deploy/lingospeak/app/docker-compose.yml ps
```

با حساب‌های test رسمی، ورود/OTP، دسترسی ادمین و upload فایل را هم بررسی کنید.

## دیپلوی نسخه‌ی جدید

ابتدا source جدید را push و سپس روی سرور دوباره `all` را اجرا کنید:

```bash
bash deploy/push-source.sh
ssh <SERVER_HOST>
cd /path/to/provision/deploy
sudo SERVER_IP=<PRIVATE_SERVER_IP> RELEASE_SHA=<git-sha> bash deploy.sh all
```

## خطاهای رایج

- `SERVER_IP` تنظیم نشده: آن را از تنظیمات خصوصی عملیات وارد کنید.
- نبودن env: `/home/deploy/lingospeak/env/app.env` را با mode `600` بسازید.
- کمبود حافظه: وضعیت RAM و swap را بررسی کنید و buildها را موازی اجرا نکنید.
- خطای migration: قبل از تلاش مجدد `docker compose ps` و لاگ migrate را بررسی کنید.
- خطای storage: رکورد DNS دامنه‌ی storage باید به `SERVER_IP` اشاره کند.
- خطای 502: `deploy.sh verify` و `docker compose logs api web` را ببینید.

## نکات ایمنی

- پورت‌های عمومی فقط 22، 80 و 443 هستند؛ PostgreSQL، Redis و MinIO نباید عمومی باشند.
- `npm run db:demo:import` و `prisma db push` را روی production اجرا نکنید.
- volumeهای PostgreSQL و MinIO را برای رفع خطا حذف نکنید.
- قبل از تغییر schema، backup و restore verification باید موفق باشد.
- برای rollback، [ROLLBACK.md](ROLLBACK.md) را دنبال کنید.
