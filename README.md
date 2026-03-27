This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Docker

This repository now includes Docker workflows for both development and production, including:

- Next.js app container
- BullMQ worker container
- PostgreSQL container
- Redis container

### Docker development

1. Copy `.env.docker.example` to `.env.docker` and replace every placeholder secret before you start.
2. Start the development stack with the Docker env file:

```bash
docker compose --env-file .env.docker up --build
```

The app is available at `http://localhost:3000`.

Postgres data is stored in a named Docker volume that includes the configured `POSTGRES_USER` and `POSTGRES_DB`. This prevents `docker compose up` from reusing an older database cluster that was initialized with different credentials than the current `.env`.

If you intentionally change Postgres credentials for an existing stack, use a different `COMPOSE_PROJECT_NAME` or remove the previous Postgres volume before restarting Compose.

For safety, Postgres and Redis are only exposed on the internal Docker network by default. The app binds to `127.0.0.1` by default so you can place it behind a reverse proxy on production. Change `APP_BIND_HOST` only if you explicitly need remote access to the app itself.

By default, the Docker files now use ArvanCloud mirror images directly:

- `docker.arvancloud.ir/library/node:20-bookworm`
- `docker.arvancloud.ir/library/postgres:16-alpine`
- `docker.arvancloud.ir/library/redis:7-alpine`

You can override them in `.env.docker` with `NODE_IMAGE`, `POSTGRES_IMAGE`, and `REDIS_IMAGE`.

### Docker production

Start the production stack with the production override:

```bash
docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

On first startup, the `postgres` container creates the configured database from `POSTGRES_DB`, and the `app` container applies Prisma migrations so all tables are created automatically. If you reuse an old Postgres volume with different credentials or a different database name, either update the volume name inputs (`COMPOSE_PROJECT_NAME`, `POSTGRES_USER`, `POSTGRES_DB`) or remove the old volume before redeploying.

### Notes

- The container entrypoint runs `prisma generate` and `prisma migrate deploy` before starting the app or worker.
- In development, Docker now regenerates the Prisma client inside the container so the query engine always matches the container architecture.
- In production, the entrypoint now refuses to start if `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`, or `SEED_SECRET` are missing or still use placeholder values.
- By default, Docker sets `PRISMA_SKIP_GENERATE=1` so startup does not depend on downloading Prisma engines at runtime.
- Only the app container runs Prisma migrations; the worker skips them to avoid concurrent migration startup issues.
- The development stack mounts the source tree for live reload.
- Inside Docker, Prisma connects to `postgres` and BullMQ connects to `redis`.
- For the worker, use `yarn worker` or `npx tsc -p tsconfig.worker.build.json && node .worker-dist/workers/notification.worker.js`.

### Docker mirror for Iran

If Docker Hub is blocked or slow in your region, configure Docker Engine or Docker Desktop to use ArvanCloud as a registry mirror before running the Compose stack.

For Docker Desktop on macOS or Windows, open `Settings` → `Docker Engine` and use:

```json
{
  "registry-mirrors": [
    "https://docker.arvancloud.ir"
  ]
}
```

For Docker Engine on Linux, put the same JSON in `/etc/docker/daemon.json` and restart Docker.

If you specifically need `insecure-registries`, Docker expects registry entries in `host[:port]` format, not a URL. That means this form is the valid one:

```json
{
  "insecure-registries": [
    "docker.arvancloud.ir"
  ],
  "registry-mirrors": [
    "https://docker.arvancloud.ir"
  ]
}
```

Use `insecure-registries` only if the mirror requires it. For a normal HTTPS mirror, `registry-mirrors` is usually enough.

If Docker still tries to resolve `docker.io/...` during `docker compose up --build`, the explicit mirror image defaults in this repo avoid that path entirely.
