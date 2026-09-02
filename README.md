# LingoSpeak

[![CI](https://github.com/fdaei/tutorialing/actions/workflows/ci.yml/badge.svg)](https://github.com/fdaei/tutorialing/actions/workflows/ci.yml)

LingoSpeak is a multilingual language-learning platform and teacher marketplace.

The project is a monorepo with:

- A Next.js web app
- A NestJS API
- PostgreSQL, Redis, and MinIO

## Requirements

Install these tools before starting:

- Node.js 20 or newer
- npm
- Docker with Docker Compose

## Quick start

From the project root, run:

```bash
npm run setup
npm run dev
```

`npm run setup` creates the local environment files and installs dependencies.
`npm run dev` starts Docker services, prepares the database, and runs both the
web app and API.

The first run may take a few minutes while Docker downloads the required images.

Open the web app at [http://localhost:3000](http://localhost:3000).

## Local URLs

| Service | URL |
| --- | --- |
| Web app | [http://localhost:3000](http://localhost:3000) |
| API | [http://localhost:4001/api](http://localhost:4001/api) |
| API health | [http://localhost:4001/api/health](http://localhost:4001/api/health) |
| Swagger | [http://localhost:4001/docs](http://localhost:4001/docs) |
| MinIO console | [http://localhost:19001](http://localhost:19001) |

## Useful commands

```bash
# Run everything
npm run dev

# Run only the web app
npm run dev:web

# Run the API and its required services
npm run dev:api

# Check the API health
npm run health:api

# Show Docker service status
npm run services:status

# Stop Docker services
npm run services:down

# Run all quality checks
npm run verify
```

## Database

To generate the Prisma client, apply migrations, and seed the database:

```bash
npm run db:prepare
```

To import the larger demo dataset:

```bash
npm run db:demo:import
```

More details about the demo data are available in
[apps/api/prisma/DEMO_DATA.md](apps/api/prisma/DEMO_DATA.md).

## Environment variables

Development defaults are stored in `.env.example`. The setup command copies
them to `.env` and `apps/api/.env` when those files do not already exist.

Do not use the development secrets in production and do not commit `.env`
files.

## Stop the project

Press `Ctrl+C` in the terminal running the apps, then stop the Docker services:

```bash
npm run services:down
```

Docker volumes are kept, so local data remains available the next time the
project starts.
