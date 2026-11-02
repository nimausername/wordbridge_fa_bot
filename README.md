# WordBridge (`@wordbridge_fa_bot`)

English–Persian vocabulary Telegram tutor with spaced repetition (SRS), CEFR content, practice drills, exams, and weak-word diagnostics.

Bot: [@wordbridge_fa_bot](https://t.me/wordbridge_fa_bot)

## Features

- Learn new words by CEFR level (A1–C1 packs)
- Review with SM-2-style SRS + daily limits
- Practice until correct
- Exams on practiced words + history
- Diagnostics: `/report`, `/weak`, weak-card interleave in review
- FA/EN UI, settings, streak, reminders

## Stack

- TypeScript + Node.js + grammY (long polling)
- PostgreSQL + Drizzle ORM
- Docker / Coolify for 24/7 deploy

## Quick start (local)

```bash
cp .env.example .env
# set BOT_TOKEN + DATABASE_URL — never commit .env

docker compose -f docker-compose.local.yml up -d   # optional local Postgres only
pnpm install
pnpm db:migrate
pnpm db:seed           # ~50k lemmas; skip if DB already seeded
pnpm dev
```

Open Telegram → send `/start` to your bot.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `BOT_TOKEN` | yes | From [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | yes | `postgres://USER:PASSWORD@HOST:PORT/DB` |
| `ADMIN_TELEGRAM_IDS` | no | Comma-separated Telegram user ids |
| `TZ` | no | Default `Asia/Tehran` |
| `RUN_SEED` | no | Docker only: `1` to seed on start, default `0` |

**Public repo:** keep real tokens and DB passwords out of git. Coolify (or your host) should inject env vars at runtime.

## Commands

| Command | Purpose |
|---|---|
| `/start` | Onboarding / home |
| `/help` | Help |
| `/learn` | New words |
| `/review` | Due SRS reviews |
| `/practice` | Drill until correct |
| `/exam` | Start exam |
| `/exams` | Exam history |
| `/stats` | Today’s progress |
| `/report` | Diagnostics report |
| `/weak` | Weak-word drill |
| `/settings` | Language, CEFR, limits |

## Deploy (Coolify)

See [docs/coolify-deploy.md](docs/coolify-deploy.md).

Summary: Coolify **Application + Dockerfile** (not Docker Compose) → set env vars → **1 replica** → `RUN_SEED=0` if the database is already seeded.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Bot with hot reload |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled bot |
| `pnpm db:migrate` | Apply SQL migrations |
| `pnpm db:seed` | Load `content/cefr/**/*.json` |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | TypeScript check |

## Docs

- [Product spec](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [SRS & diagnostics](docs/srs-and-diagnostics.md)
- [Content format](docs/content-format.md)
- [Roadmap](docs/roadmap.md)
- [Coolify deploy](docs/coolify-deploy.md)

## License

Private use unless you add a license file. Do not publish your `.env`.
