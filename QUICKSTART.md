# اجرای سریع پروژه

پیش‌نیاز: Node.js 20 یا جدیدتر، npm و Docker.

## اجرای اولیه

```bash
cp .env.example .env
npm install
```

فرانت‌اند، بک‌اند و سرویس‌ها را با یک فرمان اجرا کنید:

```bash
npm run dev
```

آدرس‌ها:

- سایت: http://localhost:3000
- API: http://localhost:4001/api
- Swagger: http://localhost:4001/docs

برای اجراهای بعدی نیز همان دستور `npm run dev` کافی است. برای اجرای جداگانه
می‌توانید از `npm run dev:api` و `npm run dev:web` استفاده کنید.

برای خاموش‌کردن سرویس‌های Docker:

```bash
npm run services:down
```
