# Roadmap

## Current status

**Phases 0–4 are implemented** (scaffold, learn/review/practice, exams, diagnostics). Deploy via Coolify using `docs/coolify-deploy.md` (`RUN_SEED=0` if DB already seeded). Next: CSV import / content polish.

## Prerequisites (you)

1. BotFather token ready.
2. Coolify on private server with ability to add an app + PostgreSQL.
3. Git remote for Coolify to deploy from (when you want always-on).

## Phases

### Phase 0 — Scaffold

**Build**

- TypeScript Node project (`pnpm`)
- grammY bot with long polling
- Zod env (`BOT_TOKEN`, `DATABASE_URL`)
- Drizzle + Postgres schema stub + migrations
- Dockerfile + Coolify notes
- `/start` hello + health logging

**Accept**

- Bot replies to `/start` locally
- App boots with valid env; fails fast on invalid env
- Docker image builds

### Phase 1 — Users, settings, content

**Build**

- Onboarding flow
- Settings persistence
- CEFR starter seed (small A1 pack) + loader
- User + lemma tables live

**Accept**

- New user completes onboarding
- Settings change and persist
- Seeds load idempotently

### Phase 2 — Learn, review, SRS, limits

**Build**

- `/learn` and `/review`
- Grade buttons + SRS updates
- Daily new/review limits + `daily_usage`
- Reminder cron (optional if timeboxed)

**Accept**

- New words respect quota
- Due cards reschedule after grades
- Progress survives restart

### Phase 3 — Exams

**Build**

- Exam wizard (quick/standard/custom)
- Practiced-only item pool
- History + miss → priority offer

**Accept**

- Unseen words never appear by default
- Score and history visible

### Phase 4 — Diagnostics and helpers

**Build**

- `/report`, `/weak`
- Direction bias + leech prompts
- Weak-card interleaving
- Mnemonics / hard flag

**Accept**

- Report shows real computed signals
- Weak drill only includes weak cards

### Phase 5 — Import, polish, Coolify production

**Build**

- CSV/admin import dry-run + apply
- i18n polish (FA/EN)
- Coolify deploy verified 24/7
- Expand CEFR content toward targets

**Accept**

- Bot runs on Coolify while laptop is off
- Admin can import validated CSV
- Help text complete in both UI languages

## Success metrics

| Metric | Why |
|---|---|
| D7 return rate | Habit formation |
| Median reviews/day | Healthy engagement |
| Retention on delayed reviews | SRS quality |
| Exam score trend | Learning evidence |
| Review backlog size | Limits/SRS balance |

## Suggested order of work for the agent

1. Phase 0 scaffold
2. Deploy skeleton to Coolify early (even with hello-only bot)
3. Phase 1–2 before exams
4. Diagnostics after enough log volume exists to matter

## Out of scope until later

- Webhook mode
- Pronunciation AI
- Multi-language beyond EN–FA
- Redis/BullMQ unless jobs outgrow in-process cron
