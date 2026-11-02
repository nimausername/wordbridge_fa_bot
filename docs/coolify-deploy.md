# Coolify Deploy Guide

## What you deploy

1. **PostgreSQL** (existing Coolify DB or a new one)
2. **Bot app** from this git repo (Dockerfile)

Learners only use Telegram. Your laptop can stay off.

## Security (public GitHub)

- Put secrets only in Coolify environment variables — never in git.
- `.env` is gitignored. Use `.env.example` as the template.
- Use **one** replica (long polling). Do not run local `pnpm dev` against the same `BOT_TOKEN` while production is polling.

## Important: use Dockerfile, not Docker Compose

This repo’s `docker-compose.local.yml` is **local Postgres only**.  
If Coolify deploys Compose, you will only get an empty Postgres container and **no bot** (`No services to build`).

In Coolify choose:

- **Resource type:** Application  
- **Build pack:** Dockerfile  
- **Dockerfile location:** `/Dockerfile`  
- **Not** Docker Compose

Point `DATABASE_URL` at your **existing** (already seeded) Postgres service — do not use a Compose-created empty DB for production.

## Steps

1. Push this repository to GitHub (public is fine if secrets stay out of git).
2. In Coolify, ensure PostgreSQL is running. Copy its connection URL.
3. Create a new **Application** → connect the GitHub repo → build pack **Dockerfile** (not Compose).
4. Add environment variables:

| Name | Value |
|---|---|
| `BOT_TOKEN` | BotFather token |
| `DATABASE_URL` | Coolify Postgres URL (prefer **internal** URL on the same host) |
| `TZ` | `Asia/Tehran` |
| `ADMIN_TELEGRAM_IDS` | your Telegram numeric id (optional) |
| `RUN_SEED` | `0` if already seeded; `1` only for first empty DB |

5. Set **replicas = 1**.
6. No public HTTPS domain is required for V1 (long polling).
7. Deploy. Startup always runs migrations, then starts the bot. Seed runs only when `RUN_SEED=1`.
8. Open the bot in Telegram and send `/start`.

## After content or code changes

1. Push to GitHub.
2. Redeploy in Coolify.
3. Keep `RUN_SEED=0` unless you intentionally want to re-upsert CEFR JSON (slow, idempotent).

## Local smoke test before Coolify

```bash
cp .env.example .env
# edit BOT_TOKEN and DATABASE_URL — do not commit .env
docker compose -f docker-compose.local.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

