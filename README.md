# LingoSpeak Backend

A NestJS backend structured by domain.

## Setup

1. Copy `.env.example` to `.env` and fill the variables.
2. Install dependencies:
```bash
npm ci
```
3. Generate Prisma client:
```bash
npm run db:generate
```
4. Run migrations:
```bash
npm run db:migrate:dev
```
5. Start dev server:
```bash
npm run start:dev
```

## Testing

```bash
npm run test
npm run typecheck
npm run lint
```
