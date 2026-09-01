# دیپلوی production لینگواسپیک

زیرساخت (ufw، fail2ban، Caddy با TLS) در [README.md](README.md) است و باید از قبل
اجرا شده باشد. این سند فقط اپ را بالا می‌آورد.

دامنه: `lingospeak.org` · سرور: `82.115.18.161` · دسترسی: `ssh lingospeak`

## پیش‌نیازها

| مورد | وضعیت |
| --- | --- |
| رکورد A برای `lingospeak.org` و `www` | ✅ ساخته شده |
| رکورد A برای `storage.lingospeak.org` | ⬜ **باید بسازی** — بدون آن آپلود/دانلود فایل کار نمی‌کند |
| کلید کاوه‌نگار (خط خدماتی) | ⬜ در `app.env` بگذار |
| مرچنت زرین‌پال | ⬜ بعد از اینماد — فعلاً مقدار موقت |

## ترتیب اجرا

```bash
# ۱) پیلود دیپلوی و سورس اپ (از ماشین محلی)
bash deploy/push.sh
bash deploy/push-source.sh          # git archive از HEAD؛ درخت کاری باید تمیز باشد

# ۲) فایل env را روی سرور بساز
ssh lingospeak
cp ~/lingospeak/env/.env.production.example ~/lingospeak/env/app.env
chmod 600 ~/lingospeak/env/app.env
nano ~/lingospeak/env/app.env       # مقادیر ⟨تولید کن⟩ را پر کن

# ۳) فاز به فاز
sudo bash ~/lingospeak-provision/deploy.sh env
sudo bash ~/lingospeak-provision/deploy.sh build
sudo bash ~/lingospeak-provision/deploy.sh services
sudo bash ~/lingospeak-provision/deploy.sh backup
sudo bash ~/lingospeak-provision/deploy.sh migrate
sudo bash ~/lingospeak-provision/deploy.sh edge
sudo bash ~/lingospeak-provision/deploy.sh verify
```

`deploy.sh all` هم همه را پشت سر هم می‌زند، ولی برای اولین دیپلوی فاز به فاز
برو تا نقاط تست زیر را ببینی.

### تولید مقادیر env

```bash
openssl rand -hex 24     # POSTGRES_PASSWORD  (hex نه base64: در DATABASE_URL نیاز به انکد ندارد)
openssl rand -base64 48  # JWT_ACCESS_SECRET
openssl rand -base64 48  # JWT_REFRESH_SECRET  ← باید با بالایی فرق کند
openssl rand -hex 16     # S3_ACCESS_KEY
openssl rand -base64 32  # S3_SECRET_KEY
```

`POSTGRES_PASSWORD` را باید **دو جا** بنویسی: خودش، و داخل `DATABASE_URL`.
فاز `env` اگر این دو یکی نباشند جلویت را می‌گیرد.

## نقاط تست بین فازها

**بعد از `env`** — باید بدون خطا رد شود. این فاز گاردهای بوت API را قبل از
اینکه وقت build را تلف کنی چک می‌کند: طول و تمایز سکرت‌های JWT، همخوانی رمز
`DATABASE_URL`، `AUTH_DEV_OTP` نبودن، `ZARINPAL_SANDBOX=false`،
`ZARINPAL_MERCHANT_ID` ناخالی، `KAVENEGAR_API_KEY` ناخالی، `TRUST_PROXY=1`.

**بعد از `build`**

```bash
docker images | grep lingospeak     # سه ایمیج: api، api-migrate، web
```

خود فاز یک گارد مهم را هم می‌زند: `require('@lingospeak/contracts')` داخل ایمیج
API. اگر این بیفتد، کانتینر در زمان بوت می‌افتاد و علتش واضح نبود.

**بعد از `services`**

```bash
docker compose --env-file ~/lingospeak/env/app.env \
  -f ~/lingospeak/app/docker-compose.yml ps        # هر سه healthy
# از ماشین محلی — همه باید timeout بدهند:
nc -zv -w3 82.115.18.161 15432 16379 19000 19001
```

**بعد از `backup`** — این فاز تا وقتی بازگردانی موفق نشود جلو نمی‌رود.

```bash
ls -lh ~/lingospeak/backups/            # یک .sql.gz با اندازه‌ی معقول
crontab -l | grep backup-postgres       # ۳ بامداد
```

**بعد از `migrate`**

```bash
docker exec lingospeak-postgres psql -U lingospeak -d lingospeak \
  -tAc 'SELECT count(*) FROM "User"'      # باید 0 باشد — یعنی seed دمو اجرا نشده
docker exec lingospeak-postgres psql -U lingospeak -d lingospeak \
  -tAc 'SELECT count(*) FROM "Country"'   # باید غیرصفر باشد
```

اگر `User` غیرصفر بود یعنی `prisma/seed.ts` اجرا شده — کاربران نمونه با OTP
ثابت `123456`. آن‌ها نباید در production باشند.

**بعد از `edge`**

```bash
curl -fsS  https://lingospeak.org/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://lingospeak.org/
curl -fsS -o /dev/null -w '%{http_code}\n' https://lingospeak.org/en
curl -sS  -o /dev/null -w '%{http_code}\n' -X POST https://lingospeak.org/api/payments   # 503
curl -sS  -o /dev/null -w '%{http_code}\n' https://lingospeak.org/docs                   # 404
```

## آزمون دستی که هیچ اسکریپتی جایش را نمی‌گیرد

سه مسیر فقط در محیط واقعی شکست می‌خورند:

1. **ثبت‌نام با شماره‌ی خودت** — اثبات می‌کند کلید کاوه‌نگار روی خط خدماتی است و
   قالب `lingospeak-otp` در پنل وجود دارد.
2. **ورود و ماندن در نشست** — اثبات می‌کند سکرت‌های JWT درست‌اند و کوکی روی
   HTTPS ست می‌شود.
3. **آپلود یک فایل** — اثبات می‌کند URL های presigned، CORS مینیو و CSP همه با
   هم جور شده‌اند.

## وضعیت‌های شناخته‌شده و موقت

**درگاه پرداخت بسته است.** `ZARINPAL_MERCHANT_ID` یک مقدار موقت دارد تا گارد
production در `env.validation.ts` دست‌نخورده بماند. با آن مقدار، مسیر توسعه‌ی
`dev_` — که هر پرداختی را موفق اعلام می‌کند — هرگز فعال نمی‌شود و API خودش با
۵۰۲ رد می‌کند. بلاک `@payment_start` در Caddyfile همان رد را به یک پیام تمیز
تبدیل می‌کند.

بعد از دریافت اینماد و مرچنت واقعی:

```bash
nano ~/lingospeak/env/app.env                       # ZARINPAL_MERCHANT_ID
nano ~/lingospeak/edge/Caddyfile                    # بلاک @payment_start را حذف کن
docker compose --env-file ~/lingospeak/env/app.env \
  -f ~/lingospeak/app/docker-compose.yml restart api
docker compose -f ~/lingospeak/edge/docker-compose.yml exec -T caddy \
  caddy reload --adapter caddyfile --config /etc/caddy/Caddyfile
```

**نشان اعتماد (اینماد)** در `NEXT_PUBLIC_ENAMAD_HTML` است و در زمان **build**
جاسازی می‌شود. بعد از پر کردنش `restart` کافی نیست:

```bash
sudo bash ~/lingospeak-provision/deploy.sh build
sudo bash ~/lingospeak-provision/deploy.sh edge
```

همین برای هر تغییر `NEXT_PUBLIC_*` دیگری.

## اگر build روی سرور OOM خورد

علامت: پیام `Killed` یا exit code 137. سرور ۷.۸ گیگ رم دارد و فاز `build` ۴ گیگ
swap می‌سازد، ولی اگر باز هم کم آورد، از ماشین محلی:

```bash
bash deploy/bin/build-local.sh      # build محلی + docker save | ssh docker load
ssh lingospeak 'sudo bash ~/lingospeak-provision/deploy.sh services'
```

هیچ تغییری در Dockerfile لازم نیست.

## به‌روزرسانی اپ بعد از تغییر کد

```bash
git add -A && git commit -m "..."
bash deploy/push-source.sh
ssh lingospeak 'sudo bash ~/lingospeak-provision/deploy.sh build'
ssh lingospeak 'sudo bash ~/lingospeak-provision/deploy.sh migrate'   # اگر migration جدید هست
ssh lingospeak 'sudo bash ~/lingospeak-provision/deploy.sh edge'
```

## عیب‌یابی

```bash
# لاگ‌ها
docker compose --env-file ~/lingospeak/env/app.env \
  -f ~/lingospeak/app/docker-compose.yml logs --tail 100 api
docker compose -f ~/lingospeak/edge/docker-compose.yml logs --tail 50 caddy

# کنسول مینیو (فقط از طریق تونل — پورت ۹۰۰۱ عمومی نیست)
ssh -L 9001:127.0.0.1:19001 lingospeak
# بعد در مرورگر: http://127.0.0.1:9001

# دیتابیس
docker exec -it lingospeak-postgres psql -U lingospeak -d lingospeak

# فضای دیسک داکر
docker system df
docker builder prune          # کش build را پاک می‌کند، ایمیج‌ها را نه
```

### وقتی چیزی می‌شکند، اول اینجا را نگاه کن

| علامت | محتمل‌ترین علت |
| --- | --- |
| کانتینر وب: `Cannot find module` | ردیابی فایل نکست — `outputFileTracingRoot` در `next.config.ts` |
| صفحه بالا می‌آید ولی بدون CSS | `.next/static` یا `public/` در استیج runtime کپی نشده |
| کانتینر API بلافاصله می‌افتد | یکی از گاردهای `env.validation.ts` — لاگ پیام دقیق را می‌دهد |
| `SignatureDoesNotMatch` در آپلود | `S3_ENDPOINT` با نشانی واقعی فرق دارد یا اسلش انتهایی دارد |
| آپلود با خطای CORS رد می‌شود | `MINIO_API_CORS_ALLOW_ORIGIN` ≠ `WEB_URL` |
| `storage.lingospeak.org` اصلاً وصل نمی‌شود | HSTS با `includeSubDomains` فعال است؛ اگر گواهی صادر نشده باشد مرورگر حتی تلاش هم نمی‌کند |
| محدودیت نرخ همه را با هم می‌بندد | `TRUST_PROXY` باید `1` باشد |
| رندر سمت سرور کند یا تایم‌اوت | alias های شبکه روی کانتینر Caddy (`deploy/edge/docker-compose.yml`) |

## بازگشت

```bash
# فقط اپ را پایین بیاور — Caddy و گواهی‌ها دست‌نخورده می‌مانند
docker compose --env-file ~/lingospeak/env/app.env \
  -f ~/lingospeak/app/docker-compose.yml down

# Caddyfile قبلی (فاز edge قبل از هر تغییر بکاپ می‌گیرد)
ls ~/lingospeak/edge/Caddyfile.bak.*
cat ~/lingospeak/edge/Caddyfile.bak.<timestamp> > ~/lingospeak/edge/Caddyfile
docker compose -f ~/lingospeak/edge/docker-compose.yml exec -T caddy \
  caddy reload --adapter caddyfile --config /etc/caddy/Caddyfile

# بازگردانی دیتابیس
~/lingospeak/bin/restore-postgres.sh --verify                  # بی‌خطر، در دیتابیس موقت
~/lingospeak/bin/restore-postgres.sh --into-production <file>  # مخرب، تأیید دستی می‌خواهد
```

داده‌ها در ولوم‌های داکر `lingospeak-app_postgres_data`، `_redis_data` و
`_minio_data` هستند و با `down` پاک نمی‌شوند. `down -v` **پاکشان می‌کند** — نزن.
