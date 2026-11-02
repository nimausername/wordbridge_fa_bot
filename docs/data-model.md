# Data Model

## Design rules

- Resource-oriented tables; camelCase in application types; snake_case in SQL columns.
- Zod schemas define write/read shapes at service boundaries.
- Telegram user id is the external identity; internal UUID primary keys for rows we own.

## Entity overview

```text
users 1─1 user_settings
users 1─* user_cards *─1 lemmas
lemmas 1─* senses
lemmas *─* tags (via lemma_tags)
user_cards 1─* review_logs
users 1─* exam_attempts 1─* exam_items
```

## Tables

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Internal id |
| telegram_id | bigint UNIQUE | Telegram user id |
| username | text NULL | Snapshot; may change |
| first_name | text NULL | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| last_seen_at | timestamptz | |
| onboarding_completed_at | timestamptz NULL | |
| streak_count | int | Consecutive study days |
| last_study_date | date NULL | Calendar date in user TZ |

### user_settings

| Column | Type | Notes |
|---|---|---|
| user_id | uuid PK/FK | |
| ui_locale | text | `fa` \| `en` |
| cefr_level | text | `A1`…`C1` |
| daily_new_limit | int | |
| daily_review_limit | int NULL | null = unlimited |
| practice_direction | text | `en_to_fa` \| `fa_to_en` \| `mixed` |
| timezone | text | e.g. `Asia/Tehran` |
| reminder_time | time NULL | Local time |
| vacation_mode | boolean | |
| updated_at | timestamptz | |

### lemmas

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lemma | text | English headword |
| pos | text | `noun`, `verb`, … |
| cefr_level | text | |
| phonetic | text NULL | |
| example_en | text | |
| example_fa | text | |
| source | text | `cefr_seed` \| `csv_import` |
| source_key | text | Idempotent upsert key |
| is_active | boolean | Soft hide |
| created_at | timestamptz | |

Unique: `(source, source_key)` and practical uniqueness on `(lemma, pos)` for seeds.

### senses

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lemma_id | uuid FK | |
| gloss_fa | text | Persian meaning |
| sense_order | int | 1-based |
| notes | text NULL | |

### tags / lemma_tags

| tags | lemma_tags |
|---|---|
| id, slug, label_en, label_fa | lemma_id, tag_id |

### user_cards

Per-user learning state for one lemma (and optionally one direction).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| lemma_id | uuid FK | |
| direction | text | `en_to_fa` \| `fa_to_en` \| `both` tracking mode |
| state | text | `new` \| `learning` \| `review` \| `relearning` \| `suspended` |
| stability | double | FSRS-style |
| difficulty | double | FSRS-style |
| due_at | timestamptz | |
| last_reviewed_at | timestamptz NULL | |
| reps | int | Successful reviews |
| lapses | int | |
| learning_step | int | Index in learning steps |
| is_hard | boolean | User flag |
| mnemonic | text NULL | User note |
| priority_until | timestamptz NULL | Exam miss boost |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique: `(user_id, lemma_id, direction)` — V1 may use a single row with `mixed` handled at session time; prefer one card per lemma with direction chosen at prompt time unless diagnostics need split stats (store direction on `review_logs`).

**V1 decision:** one `user_card` per `(user_id, lemma_id)`. Store attempt `direction` on `review_logs` for diagnostics.

### review_logs

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| user_card_id | uuid FK | |
| lemma_id | uuid FK | |
| direction | text | `en_to_fa` \| `fa_to_en` |
| mode | text | `mcq` \| `typed` \| `cloze` \| `grade_only` |
| grade | text NULL | `again` \| `hard` \| `good` \| `easy` |
| correct | boolean | |
| latency_ms | int NULL | |
| prompt | text NULL | Snapshot |
| expected | text NULL | |
| answered | text NULL | |
| created_at | timestamptz | |

### exam_attempts

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| mode | text | `quick` \| `standard` \| `custom` |
| item_count | int | |
| score_correct | int | |
| score_total | int | |
| filters_json | jsonb | level/topic/days |
| completed_at | timestamptz NULL | |
| created_at | timestamptz | |

### exam_items

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| exam_attempt_id | uuid FK | |
| lemma_id | uuid FK | |
| direction | text | |
| mode | text | |
| correct | boolean NULL | |
| expected | text | |
| answered | text NULL | |
| order_index | int | |

### daily_usage

Tracks quotas without scanning all logs.

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| usage_date | date | In user timezone |
| new_words_introduced | int | |
| reviews_completed | int | |

Primary key: `(user_id, usage_date)`.

## Zod domain shapes (application)

Illustrative schemas for implementation (exact files later under `src/domain` / `src/db`):

```ts
import { z } from "zod";

export const cefrLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);
export const uiLocaleSchema = z.enum(["fa", "en"]);
export const practiceDirectionSchema = z.enum([
  "en_to_fa",
  "fa_to_en",
  "mixed",
]);
export const srsGradeSchema = z.enum(["again", "hard", "good", "easy"]);
export const cardStateSchema = z.enum([
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
]);

export const userSettingsSchema = z.object({
  uiLocale: uiLocaleSchema,
  cefrLevel: cefrLevelSchema,
  dailyNewLimit: z.number().int().min(1).max(50),
  dailyReviewLimit: z.number().int().min(10).max(500).nullable(),
  practiceDirection: practiceDirectionSchema,
  timezone: z.string().min(1),
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  vacationMode: z.boolean(),
});

export const srsGradeInputSchema = z.object({
  userId: z.string().uuid(),
  userCardId: z.string().uuid(),
  grade: srsGradeSchema,
  direction: z.enum(["en_to_fa", "fa_to_en"]),
  latencyMs: z.number().int().nonnegative().optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
export type SrsGradeInput = z.infer<typeof srsGradeInputSchema>;
```

## Indexing (minimum)

- `users(telegram_id)`
- `user_cards(user_id, due_at)` where not suspended
- `user_cards(user_id, lemma_id)` unique
- `review_logs(user_id, created_at)`
- `lemmas(cefr_level, is_active)`
- `daily_usage(user_id, usage_date)`

## Migration policy

- Drizzle migrations committed to git
- Coolify runs migrate on deploy
- Seeds are idempotent upserts, not one-off destructive loads
