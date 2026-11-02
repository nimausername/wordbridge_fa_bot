# Architecture

## Overview

The system is a single Node.js Telegram bot process plus PostgreSQL. Learners talk only to Telegram. Coolify on the private server runs the bot and the database continuously.

```text
User (Telegram) → Telegram API → Bot process (grammY) → PostgreSQL
                                      ↑
                                 Coolify host
```

There is no separate public REST API in V1. The bot process *is* the backend.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript on Node.js |
| Bot framework | grammY |
| Validation | Zod |
| Utilities | Lodash where helpful |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Jobs | `node-cron` in-process for V1 reminders |
| Config | `dotenv` + Zod env schema |
| Deploy | Coolify (Dockerfile) |
| Telegram transport | Long polling (V1) |

## Repository layout (planned)

```text
src/
  index.ts                 # boot: env, db, bot, cron
  env.ts                   # Zod env schema
  bot/
    bot.ts                 # grammY instance
    context.ts             # custom context types
    menus/                 # keyboards
    handlers/              # commands + callbacks
    middleware/            # session, auth, i18n, error
  domain/
    srs/                   # scheduling algorithm
    diagnostics/           # weak words, direction bias
    exams/                 # exam generation + scoring
    limits/                # daily quota rules
    matching/              # answer normalization
  services/                # use-cases composing repos + domain
  repositories/            # Drizzle data access
  db/
    schema.ts
    client.ts
    migrations/
  content/
    load-seeds.ts
  i18n/
    fa.ts
    en.ts
content/cefr/              # seed JSON/CSV
docs/
Dockerfile
```

## Module boundaries

| Module | Responsibility | Must not |
|---|---|---|
| Handlers | Parse Telegram updates, call services, render replies | Contain SRS math or SQL |
| Services | Orchestrate one user action (start learn, grade review) | Talk to Telegram types deeply |
| Domain | Pure rules (SRS, limits, diagnostics, exam pick) | Touch DB or Telegram |
| Repositories | SQL via Drizzle | Encode product policy |
| Jobs | Reminder digests | Duplicate domain logic |

## Request flow (example: grade a review)

1. Callback query `review:grade:good` hits handler.
2. Middleware attaches `user` from Telegram `id`.
3. `ReviewService.grade({ userId, cardId, grade })` runs.
4. Domain SRS computes next `dueAt` / stability.
5. Repository updates `user_cards` and inserts `review_logs`.
6. Diagnostics hooks may flag leeches.
7. Handler sends next card or session summary.

## Persistence

- PostgreSQL is the source of truth for users, content, SRS state, exams, and logs.
- No durable state in Telegram.
- Sessions for multi-step wizards may use grammY session storage backed by Postgres or memory with short TTL; durable learning state always in tables.

## Background jobs (V1)

In-process cron is enough:

| Job | Cadence | Action |
|---|---|---|
| Due reminders | every 5–15 min | Message users whose reminder time matches and who have due cards |
| Streak / inactivity nudge | daily | Soft nudge after N quiet days (respect vacation mode) |

Move to BullMQ + Redis only if job volume or multi-instance deploy requires it.

## Coolify deploy

### Services

1. **Postgres** — Coolify database service; expose `DATABASE_URL` to the app.
2. **Bot app** — builds from Dockerfile; restart policy always.

### Required env

| Variable | Description |
|---|---|
| `BOT_TOKEN` | BotFather token |
| `DATABASE_URL` | Postgres connection string |
| `TZ` | Default `Asia/Tehran` for cron wall-clock (optional) |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram user ids (later import/admin) |

### Runtime notes

- Use **long polling** so Coolify does not need a public HTTPS webhook for V1.
- Run a **single** bot replica to avoid duplicate polling.
- Run migrations on start or as a Coolify pre-deploy command.
- Health: process stays alive; optional `/healthz` HTTP only if Coolify healthcheck needs it (can add a tiny HTTP server beside the bot).

### Dockerfile expectations

- Multi-stage build: install → build TypeScript → run `node dist/index.js`
- Non-root user preferred
- `CMD` starts the bot after migrations

## Security

- Never commit `.env` or tokens.
- Validate all callback payloads; do not trust client-provided user ids beyond Telegram’s update.
- Admin commands gated by `ADMIN_TELEGRAM_IDS`.
- Rate-limit heavy actions per user in middleware if abused.

## Observability (V1)

- Structured logs: `userId`, `action`, `durationMs`, `errorCode`
- No PII beyond Telegram numeric id in logs
- Coolify logs for crash inspection

## Scaling path (later)

- Webhook mode behind Coolify HTTPS domain
- Separate worker for jobs
- Read replicas only if analytics demand it

V1 stays one bot process + one Postgres.
