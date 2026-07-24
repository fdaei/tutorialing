# اجرای سریع پروژه

پیش‌نیاز: Node.js 20 یا جدیدتر، npm و Docker.

## اجرای اولیه

```bash
cp .env.example .env
npm install
```

سپس در ترمینال اول بک‌اند و سرویس‌ها را اجرا کنید:

```bash
npm run dev:api
```

در ترمینال دوم فرانت‌اند را اجرا کنید:

```bash
npm run dev
```

آدرس‌ها:

- سایت: http://localhost:3000
- API: http://localhost:4001/api
- Swagger: http://localhost:4001/docs

برای اجراهای بعدی نیز همان دو دستور `npm run dev:api` و `npm run dev` کافی است.

برای خاموش‌کردن سرویس‌های Docker:

```bash
npm run services:down
```
