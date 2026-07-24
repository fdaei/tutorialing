# LingoSpeak

LingoSpeak یک پلتفرم چندزبانه آموزش زبان و مارکت‌پلیس مدرس است. این مخزن به‌صورت
monorepo پیاده‌سازی شده و شامل رابط کاربری Next.js، API مبتنی بر NestJS و سرویس‌های
PostgreSQL، Redis و MinIO است.

## فهرست

- [معماری و سرویس‌ها](#معماری-و-سرویسها)
- [پیش‌نیازها](#پیشنیازها)
- [راه‌اندازی سریع](#راهاندازی-سریع)
- [راه‌اندازی مرحله‌به‌مرحله](#راهاندازی-مرحلهبهمرحله)
- [تنظیم متغیرهای محیطی](#تنظیم-متغیرهای-محیطی)
- [دیتابیس و داده‌های نمونه](#دیتابیس-و-دادههای-نمونه)
- [آدرس سرویس‌ها](#آدرس-سرویسها)
- [کاربران نمونه و ورود](#کاربران-نمونه-و-ورود)
- [دستورهای کاربردی](#دستورهای-کاربردی)
- [تست و بررسی کیفیت](#تست-و-بررسی-کیفیت)
- [عیب‌یابی](#عیبیابی)
- [خاموش‌کردن و پاک‌سازی](#خاموشکردن-و-پاکسازی)

## معماری و سرویس‌ها

| بخش | مسیر | فناوری | پورت پیش‌فرض |
|---|---|---|---:|
| رابط کاربری | `apps/web` | Next.js 15 / React 19 | `3000` |
| API | `apps/api` | NestJS 11 / Prisma | `4001` |
| قراردادهای مشترک | `packages/contracts` | TypeScript | — |
| دیتابیس | Docker Compose | PostgreSQL 16 | `5432` |
| صف و cache | Docker Compose | Redis 7 | `6379` |
| ذخیره‌سازی فایل | Docker Compose | MinIO | `9000` |
| پنل MinIO | Docker Compose | MinIO Console | `9001` |

## پیش‌نیازها

قبل از شروع این ابزارها باید نصب و قابل اجرا باشند:

- Node.js نسخه 20 یا جدیدتر
- npm
- Docker Engine یا Docker Desktop
- Docker Compose v2 (`docker compose`)
- Git

نسخه‌ها را بررسی کنید:

```bash
node --version
npm --version
docker --version
docker compose version
```

در لینوکس مطمئن شوید Docker روشن است و کاربر فعلی اجازه دسترسی به آن را دارد:

```bash
docker info
```

## راه‌اندازی سریع

پس از clone کردن مخزن وارد ریشه پروژه شوید:

```bash
git clone <repository-url>
cd tutorialing
```

فایل‌های محیطی و dependencyها را آماده کنید:

```bash
npm run setup
```

این دستور در صورت نبودن فایل‌ها، `.env.example` را در `.env` و
`apps/api/.env` کپی می‌کند و اگر dependencyها نصب نباشند `npm ci` را اجرا
می‌کند. فایل‌های `.env` موجود بازنویسی نمی‌شوند.

سپس دو terminal باز کنید.

Terminal اول، API و سرویس‌های وابسته:

```bash
npm run dev:api
```

Terminal دوم، رابط کاربری:

```bash
npm run dev
```

بعد از آماده‌شدن هر دو برنامه، سایت در
[http://localhost:3000](http://localhost:3000) در دسترس است.

> `npm run dev:api` در اولین اجرا ممکن است چند دقیقه زمان ببرد؛ این دستور
> imageهای Docker را دریافت می‌کند، سرویس‌ها را بالا می‌آورد، Prisma Client را
> تولید می‌کند، migrationها را اعمال می‌کند و دیتابیس را seed می‌کند.

## راه‌اندازی مرحله‌به‌مرحله

اگر می‌خواهید هر مرحله را جداگانه اجرا یا خطای یک مرحله را پیدا کنید، از این
ترتیب استفاده کنید.

### ۱. ساخت فایل‌های محیطی

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

مقادیر دو فایل باید با یکدیگر هماهنگ باشند. در محیط توسعه، مقادیر پیش‌فرض
`.env.example` قابل استفاده‌اند.

### ۲. نصب dependencyها

برای نصب دقیق نسخه‌های ثبت‌شده در `package-lock.json`:

```bash
npm ci
```

اگر عمداً dependency جدیدی اضافه کرده‌اید، به‌جای آن از `npm install` استفاده
کنید و تغییر `package-lock.json` را نیز commit کنید.

### ۳. اعتبارسنجی تنظیمات

```bash
npm run env:check
```

این بررسی موارد زیر را کنترل می‌کند:

- وجود تمام متغیرهای ضروری
- حداقل ۳۲ کاراکتر بودن JWT secretها
- معتبر بودن `DATABASE_URL`
- یکسان بودن نام کاربری، رمز و نام دیتابیس در `DATABASE_URL` و تنظیمات Compose

### ۴. اجرای سرویس‌های زیرساخت

```bash
npm run services:up
```

این دستور PostgreSQL، Redis و MinIO را اجرا می‌کند، تا healthy شدن آن‌ها منتظر
می‌ماند و bucket خصوصی MinIO را نیز می‌سازد.

وضعیت سرویس‌ها:

```bash
npm run services:status
```

### ۵. آماده‌سازی دیتابیس

```bash
npm run db:prepare
```

این دستور به‌ترتیب این عملیات را انجام می‌دهد:

1. تولید Prisma Client
2. اعتبارسنجی schema
3. اعمال migrationهای موجود با `prisma migrate deploy`
4. درج یا به‌روزرسانی داده‌های نمونه

### ۶. اجرای API

```bash
npm run start:dev -w @lingospeak/api
```

API در حالت watch روی پورت `4001` اجرا می‌شود.

### ۷. اجرای وب

در terminal دیگری:

```bash
npm run dev -w @lingospeak/web
```

وب در حالت توسعه روی پورت `3000` اجرا می‌شود.

## تنظیم متغیرهای محیطی

نمونه کامل تنظیمات در `.env.example` قرار دارد.

| متغیر | کاربرد | مقدار توسعه |
|---|---|---|
| `NODE_ENV` | نوع محیط اجرا | `development` |
| `PORT` | پورت API | `4001` |
| `POSTGRES_USER` | کاربر PostgreSQL | `lingospeak` |
| `POSTGRES_PASSWORD` | رمز PostgreSQL | `lingospeak` |
| `POSTGRES_DB` | نام دیتابیس | `lingospeak` |
| `DATABASE_URL` | آدرس اتصال Prisma به PostgreSQL | پورت `5432` محلی |
| `REDIS_URL` | آدرس Redis | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | کلید امضای access token | حداقل ۳۲ کاراکتر |
| `JWT_REFRESH_SECRET` | کلید امضای refresh token | حداقل ۳۲ کاراکتر |
| `WEB_URL` | origin مجاز وب برای CORS | `http://localhost:3000` |
| `API_URL` | آدرس پایه API برای health check | `http://localhost:4001` |
| `NEXT_PUBLIC_API_URL` | آدرس API قابل مشاهده در browser | `http://localhost:4001/api` |
| `NEXT_PUBLIC_WEB_URL` | آدرس عمومی وب | `http://localhost:3000` |
| `S3_ENDPOINT` | endpoint سازگار با S3 | `http://localhost:9000` |
| `S3_ACCESS_KEY` | نام کاربری MinIO | `minio` |
| `S3_SECRET_KEY` | رمز MinIO | `change-me` |
| `S3_BUCKET` | نام bucket فایل‌ها | `lingospeak` |
| `KAVENEGAR_API_KEY` | کلید پیامک کاوه‌نگار | اختیاری در توسعه |
| `ZARINPAL_MERCHANT_ID` | شناسه درگاه زرین‌پال | اختیاری در توسعه |

نکات مهم:

- مقادیر `POSTGRES_*` باید دقیقاً با بخش متناظر در `DATABASE_URL` هماهنگ باشند.
- پس از تغییر متغیرهای `NEXT_PUBLIC_*`، وب‌سرور Next.js را restart کنید.
- secretهای نمونه برای production مناسب نیستند.
- فایل‌های `.env` را commit نکنید.

## دیتابیس و داده‌های نمونه

دستورهای Prisma باید از ریشه مخزن اجرا شوند:

```bash
# تولید Prisma Client
npm run db:generate

# بررسی معتبر بودن schema
npm run db:validate

# اعمال migrationهای ثبت‌شده
npm run db:migrate

# درج داده‌های نمونه
npm run db:seed

# انجام همه موارد بالا
npm run db:prepare
```

برای ساخت migration جدید هنگام توسعه:

```bash
npm run db:migrate:dev -w @lingospeak/api -- --name <migration-name>
```

در production فقط migrationهای ثبت‌شده را با `npm run db:migrate` اعمال کنید.
از `prisma db push` به‌عنوان جایگزین migration استفاده نکنید.

## آدرس سرویس‌ها

| سرویس | آدرس |
|---|---|
| وب | [http://localhost:3000](http://localhost:3000) |
| API | [http://localhost:4001/api](http://localhost:4001/api) |
| سلامت API | [http://localhost:4001/api/health](http://localhost:4001/api/health) |
| Swagger | [http://localhost:4001/docs](http://localhost:4001/docs) |
| MinIO API | [http://localhost:9000](http://localhost:9000) |
| MinIO Console | [http://localhost:9001](http://localhost:9001) |

بعد از اجرای API، سلامت آن را با یکی از این روش‌ها بررسی کنید:

```bash
npm run health:api
```

یا:

```bash
curl http://localhost:4001/api/health
```

پاسخ سالم باید شامل `status: "ok"` و `database: "connected"` باشد.

## کاربران نمونه و اطلاعات ورود

seed چند کاربر با نقش‌های متفاوت ایجاد می‌کند:

| نقش | شماره تلفن | کد ورود در development |
|---|---|---|
| مدیر | `09120000000` | `123456` |
| کارشناس تأیید مدرس | `09120000010` | `123456` |
| پشتیبانی | `09120000011` | `123456` |
| مالی | `09120000012` | `123456` |
| ارزیاب | `09120000013` | `123456` |
| مدرس تأییدشده | `09120000001` | `123456` |
| مدرس آلمانی | `09120000002` | `123456` |
| مدرس در انتظار تأیید | `09120000004` | `123456` |
| زبان‌آموز | `09121111111` | `123456` |
| زبان‌آموز دارای جلسه آینده | `09121111112` | `123456` |
| زبان‌آموز دارای تیکت | `09121111113` | `123456` |

کاربران password ثابت ندارند و ورود با شماره تلفن و OTP انجام می‌شود. در محیط
`development` کد OTP همه حساب‌ها `123456` است.

اطلاعات ورود سرویس‌های محلی با تنظیمات پیش‌فرض `.env.example`:

| سرویس | آدرس | نام کاربری | رمز | دیتابیس یا bucket |
|---|---|---|---|---|
| PostgreSQL | `localhost:5432` | `lingospeak` | `lingospeak` | `lingospeak` |
| MinIO Console | `http://localhost:9001` | `minio` | `change-me` | `lingospeak` |
| Redis | `localhost:6379` | — | بدون رمز | — |

این اطلاعات فقط برای محیط توسعه محلی مناسب‌اند. پیش از انتشار یا در دسترس
قرارگرفتن سرویس‌ها، OTP توسعه، رمزهای PostgreSQL و MinIO، کلیدهای JWT و تنظیمات
providerها را تغییر دهید.

## دستورهای کاربردی

| دستور | توضیح |
|---|---|
| `npm run setup` | ساخت فایل‌های محیطی و نصب dependencyها در صورت نیاز |
| `npm run dev` | آماده‌سازی اولیه و اجرای وب در حالت توسعه |
| `npm run dev:api` | آماده‌سازی، اجرای سرویس‌ها و دیتابیس، سپس اجرای API |
| `npm run start:api` | اجرای API بدون watch |
| `npm run services:up` | اجرای PostgreSQL، Redis و MinIO |
| `npm run services:status` | نمایش وضعیت containerها |
| `npm run services:down` | توقف و حذف containerها و network پروژه |
| `npm run db:setup` | آماده‌سازی کامل سرویس‌ها و دیتابیس بدون اجرای API |
| `npm run health:api` | بررسی API و اتصال دیتابیس |
| `npm run build` | build تمام workspaceها |
| `npm run test` | اجرای unit testهای تمام workspaceها |
| `npm run typecheck` | بررسی TypeScript |
| `npm run lint` | اجرای lint |
| `npm run verify` | اجرای بررسی schema، typecheck، lint، test و build |

## تست و بررسی کیفیت

از ریشه مخزن:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

اجرای همه بررسی‌ها در یک دستور:

```bash
npm run verify
```

تست‌های end-to-end:

```bash
npm run test:e2e
```

## عیب‌یابی

### پورت ۳۰۰۰ یا ۴۰۰۰ اشغال است

پردازش استفاده‌کننده از پورت را پیدا کنید:

```bash
ss -ltnp | grep -E ':(3000|4001)'
```

برای اجرای موقت وب روی پورت دیگر:

```bash
npm run dev -w @lingospeak/web -- --port 3001
```

در این حالت باید `WEB_URL` و `NEXT_PUBLIC_WEB_URL` را نیز به
`http://localhost:3001` تغییر دهید و API را restart کنید تا CORS درست کار کند.

### خطای دسترسی به Docker

اگر خطای `permission denied while trying to connect to the docker API` دیدید،
Docker را روشن و دسترسی کاربر را اصلاح کنید. در Linux معمولاً افزودن کاربر به
گروه Docker و ورود مجدد لازم است:

```bash
sudo usermod -aG docker "$USER"
```

بعد از logout/login، `docker info` را دوباره بررسی کنید.

### سرویس‌ها healthy نمی‌شوند

وضعیت و logها را ببینید:

```bash
docker compose ps
docker compose logs --tail=100 postgres
docker compose logs --tail=100 redis
docker compose logs --tail=100 minio
```

### Prisma به دیتابیس وصل نمی‌شود

ابتدا سرویس‌ها و تنظیمات را بررسی کنید:

```bash
npm run env:check
npm run services:status
npx prisma migrate status --schema apps/api/prisma/schema.prisma
```

اطمینان پیدا کنید که مقادیر `POSTGRES_USER`، `POSTGRES_PASSWORD` و
`POSTGRES_DB` با `DATABASE_URL` یکی هستند و پورت `5432` توسط برنامه دیگری
استفاده نمی‌شود.

### جدول‌هایی مانند `Teacher` یا `OtpChallenge` وجود ندارند

migration و seed را اجرا کنید:

```bash
npm run db:prepare
```

اگر دیتابیس production یا دارای اطلاعات مهم است، قبل از هر تغییر از آن backup
بگیرید.

### bucket ذخیره‌سازی وجود ندارد

دستور زیر سرویس‌ها و `minio-init` را دوباره اجرا می‌کند. ساخت bucket idempotent
است و bucket موجود را حذف نمی‌کند:

```bash
npm run services:up
```

### تغییر dependencyها اعمال نشده است

برای بازسازی نصب بر اساس lockfile:

```bash
npm ci
npm run db:generate
```

## خاموش‌کردن و پاک‌سازی

فرایندهای `npm run dev` و `npm run dev:api` را در terminalهایشان با `Ctrl+C`
متوقف کنید. سپس سرویس‌های Docker را پایین بیاورید:

```bash
npm run services:down
```

این دستور volumeهای دیتابیس و MinIO را حذف نمی‌کند و اطلاعات بین اجراها باقی
می‌مانند.

اگر عمداً می‌خواهید تمام داده‌های محلی PostgreSQL و MinIO را نیز حذف کنید:

```bash
docker compose down --volumes
```

> دستور بالا داده‌های محلی دیتابیس و فایل‌های MinIO را غیرقابل‌بازگشت حذف
> می‌کند؛ فقط زمانی اجرا کنید که به reset کامل محیط توسعه نیاز دارید.
