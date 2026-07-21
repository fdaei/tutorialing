# LingoSpeak setup and database repair

The errors `public.Teacher does not exist`, `public.OtpChallenge does not exist`, and `public.RefreshSession does not exist` mean the API reached PostgreSQL before Prisma migrations were applied, or `DATABASE_URL` targets another database.

```bash
cp .env.example .env
cp .env.example apps/api/.env
npm install
docker compose up -d postgres redis minio
npm run db:setup
npm run dev:api
npm run dev
```

Before migrating an existing production database, verify its URL and back it up. Production deployment uses `npm run db:migrate` and must never use `prisma db push` as a migration replacement.

Useful checks:

```bash
npx prisma migrate status --schema apps/api/prisma/schema.prisma
npm run db:validate
npm run typecheck
npm run test
npm run build
```

Development OTP is `123456` when `SMS_PROVIDER=development`. Configure a real SMS adapter and secrets in production.
