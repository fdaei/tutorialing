# زیرساخت سرور lingospeak

راه‌اندازی پایه‌ی سرور — **بدون دیپلوی اپ**. فایروال، محافظت SSH، ریورس‌پراکسی با
TLS خودکار، و اسکلت دایرکتوری که دیپلوی بعدی داخلش می‌نشیند.

سرور: `82.115.18.161` · Ubuntu 24 · کاربر `deploy` · دسترسی `ssh lingospeak`
دامنه: `lingospeak.org` (و `www`)

## ترتیب اجرا

```bash
bash deploy/push.sh                                    # فقط کپی، هیچ اجرایی نیست
ssh lingospeak
sudo bash ~/lingospeak-provision/bootstrap.sh all      # یا فاز به فاز ↓
```

فازها مستقل و idempotent هستند؛ اجرای مجدد هرکدام بی‌خطر است:

| فاز | کار |
| --- | --- |
| `deps` | نصب `ufw fail2ban python3-systemd dnsutils openssl` |
| `dirs` | ساخت `/home/deploy/lingospeak` با مالکیت/پرمیشن |
| `firewall` | ufw فقط ۲۲/۸۰/۴۴۳ + بستن دور زدن ufw توسط داکر |
| `fail2ban` | نصب jail و راه‌اندازی |
| `caddy` | شبکه‌ی `edge` + ریورس‌پراکسی + **گواهی استیجینگ** |
| `verify` | گزارش وضعیت (فقط خواندنی) |

اگر IP ثابت دارید و می‌خواهید هرگز توسط fail2ban بن نشوید:

```bash
sudo ADMIN_IP=<your-ip> bash ~/lingospeak-provision/bootstrap.sh fail2ban
```

## TLS: اول استیجینگ، بعد محیط اصلی

DNS آماده است — هر ۶ کوئری (`lingospeak.org` و `www` × سه ریزالور) به
`82.115.18.161` می‌رسند، بدون پروکسی CDN، و رکورد CAA وجود ندارد.

با این حال Caddy **عمداً** روی endpoint استیجینگ Let's Encrypt شروع می‌کند:

```
acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
```

محیط اصلی سقف ۵ اعتبارسنجی ناموفق در ساعت به ازای هر هاست دارد؛ اگر پیکربندی،
فایروال یا مسیر شبکه ایرادی داشته باشد، آن سهمیه در چند دقیقه می‌سوزد و یک ساعت
منتظر می‌مانید. استیجینگ همان مسیر را با سقف بسیار بازتر تست می‌کند.

**گواهی استیجینگ توسط مرورگر معتبر شناخته نمی‌شود — این طبیعی است.** تست‌ها در
این مرحله به `-k` نیاز دارند.

بعد از سبز شدن استیجینگ:

```bash
bash ~/lingospeak/bin/go-live.sh
```

که بلوک `ACME-STAGING` را از Caddyfile حذف، پیکربندی را validate، Caddy را
ری‌استارت و تأیید می‌کند که گواهی جدید **بدون `-k`** هم معتبر است.

ری‌استارت لازم است نه reload: عوض شدن `acme_ca` یعنی صدور از CA دیگر. Caddy
گواهی‌ها را در مسیری کلیدخورده به نام CA نگه می‌دارد
(`acme-staging-v02…` در برابر `acme-v02…`)، پس گواهی استیجینگ پاک نمی‌شود و
هیچ کار دستی‌ای لازم نیست.

اگر اعلان انقضای گواهی می‌خواهید، خط `# email you@example.com` را در بلوک global
فایل `edge/Caddyfile` از کامنت در بیاورید.

## قاعده‌ی ثابت: فقط Caddy پورت عمومی می‌گیرد

داکر ufw را دور می‌زند. قوانین داکر در زنجیره‌ی `DOCKER-USER` پیش از زنجیره‌های
ufw ارزیابی می‌شوند، پس هر `ports: ["5432:5432"]` صرف‌نظر از `ufw deny` از کل
اینترنت قابل دسترسی است.

`docker-compose.yml` ریشه‌ی مخزن برای **توسعه‌ی محلی** نوشته شده و پورت‌های
`15432` (postgres)، `16379` (redis)، `19000/19001` (minio) را بدون بایند به
`127.0.0.1` publish می‌کند. **همان فایل روی این سرور استفاده نشود.**

دو لایه‌ی محافظت:

1. فاز `firewall` زنجیره‌ی `DOCKER-USER` را پیش‌فرض DROP می‌کند و فقط ۸۰/۴۴۳ را
   از اینترفیس عمومی عبور می‌دهد.
2. compose اپ (سشن بعد) هیچ `ports:` ای نمی‌گذارد؛ سرویس‌ها به شبکه‌ی external
   `edge` وصل می‌شوند و Caddy با نام سرویس به آن‌ها می‌رسد. اگر سرویسی واقعاً به
   پورت هاست نیاز داشت، حتماً `"127.0.0.1:PORT:PORT"`.

⚠️ بعد از هر `systemctl restart docker` یک بار `sudo ufw reload` بزنید — داکر
ممکن است زنجیره را از نو بسازد. `bootstrap.sh verify` این را چک می‌کند.

## راستی‌آزمایی

روی سرور:

```bash
sudo bash ~/lingospeak-provision/bootstrap.sh verify
bash ~/lingospeak/bin/dns-check.sh          # پیش‌فرض: lingospeak.org
```

از ماشین محلی:

```bash
# در فاز استیجینگ (گواهی نامعتبر است، -k لازم است):
curl -fsSk https://lingospeak.org/healthz             # ok
curl -sSI  https://lingospeak.org/healthz | head -1   # با -k نبودنش خطای گواهی می‌دهد — طبیعی است

# بعد از go-live.sh (باید بدون -k پاس شود):
curl -fsS  https://lingospeak.org/healthz             # ok
curl -fsS  https://www.lingospeak.org/healthz         # ok، بعد از ریدایرکت ۳۰۸
openssl s_client -connect lingospeak.org:443 -servername lingospeak.org </dev/null 2>/dev/null \
  | openssl x509 -noout -issuer -dates

nc -zv -w3 82.115.18.161 22 80 443                    # باز
nc -zv -w3 82.115.18.161 15432 16379 19000 19001      # باید همه بسته باشند
```

تست عملی سخت‌سازی داکر — تنها راه اثبات واقعی اینکه دور زدن ufw بسته شده:

```bash
ssh lingospeak 'docker run -d --rm --name ufwtest -p 8080:80 nginx:alpine'
nc -zv -w3 82.115.18.161 8080     # باید timeout بدهد؛ اگر وصل شد، سخت‌سازی کار نکرده
ssh lingospeak 'docker rm -f ufwtest'
```

## بازگشت (rollback)

```bash
sudo ufw disable
sudo sed -i '/^# BEGIN LINGOSPEAK DOCKER-USER$/,/^# END LINGOSPEAK DOCKER-USER$/d' /etc/ufw/after.rules
sudo ufw reload
sudo systemctl disable --now fail2ban
docker compose -f ~/lingospeak/edge/docker-compose.yml down
```

پشتیبان `after.rules` دست‌نخورده در `/etc/ufw/after.rules.lingospeak.bak` است.
`ufw --force reset` هم نسخه‌های قبلی را در `/etc/ufw/*.YYYYMMDD` نگه می‌دارد.
`go-live.sh` پیش از هر تغییر از Caddyfile نسخه‌ی `.bak.<timestamp>` می‌گیرد.

در طول فاز `firewall` سشن SSH فعلی را باز نگه دارید. اسکریپت پیش از `ufw enable`
وجود قانون ۲۲ را چک می‌کند و در غیر این صورت متوقف می‌شود، و `ControlPersist 10m`
در ssh config محلی هم تور ایمنی دوم است.

## ساختار روی سرور

```
/home/deploy/lingospeak/          750 deploy:deploy
├── edge/        پروژه‌ی compose ریورس‌پراکسی (Caddyfile, logs/)
├── app/         خالی — سشن بعد: compose اپ
├── env/         700 — فایل‌های راز، هرکدام 600
├── backups/     700 — خروجی pg_dump
└── bin/         dns-check.sh, go-live.sh
```

گواهی‌های ACME در ولوم داکری `lingospeak-edge_caddy_data` هستند. **پاکش نکنید** —
صدور مجدد به سقف نرخ Let's Encrypt می‌خورد.

## خارج از اسکوپ

دیپلوی اپ، بکاپ خودکار، `unattended-upgrades`، مانیتورینگ، swap.
