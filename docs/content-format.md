# Content Format — CEFR Seeds and CSV Import

## Goals

- Ship curated English–Persian vocabulary by CEFR level.
- Upsert seeds idempotently.
- Support admin/CSV import later with the same validation rules.

## Seed location

```text
content/cefr/
  a1/
    core.json
  a2/
    core.json
  b1/
    core.json
  README.md
```

Start with A1–B1. Add B2–C1 as content grows.

## JSON seed schema

Each file is an array of lemma objects:

```json
[
  {
    "sourceKey": "a1-be-verb",
    "lemma": "be",
    "pos": "verb",
    "cefrLevel": "A1",
    "phonetic": "/biː/",
    "glossesFa": ["بودن"],
    "exampleEn": "I am a student.",
    "exampleFa": "من دانش‌آموز هستم.",
    "tags": ["basics", "grammar-adjacent"]
  }
]
```

### Field rules

| Field | Required | Rules |
|---|---|---|
| sourceKey | yes | Stable id; unique within source `cefr_seed` |
| lemma | yes | Non-empty English headword |
| pos | yes | One of: `noun`, `verb`, `adj`, `adv`, `prep`, `conj`, `pron`, `det`, `phrase`, `other` |
| cefrLevel | yes | `A1` \| `A2` \| `B1` \| `B2` \| `C1` |
| phonetic | no | IPA or simple pronunciation |
| glossesFa | yes | ≥1 non-empty Persian gloss |
| exampleEn | yes | Short sentence containing the lemma when practical |
| exampleFa | yes | Natural Persian translation |
| tags | no | Lowercase kebab-case slugs |

### Zod shape (loader)

```ts
import { z } from "zod";

export const seedLemmaSchema = z.object({
  sourceKey: z.string().min(1).max(120),
  lemma: z.string().min(1).max(80),
  pos: z.enum([
    "noun",
    "verb",
    "adj",
    "adv",
    "prep",
    "conj",
    "pron",
    "det",
    "phrase",
    "other",
  ]),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  phonetic: z.string().max(80).optional(),
  glossesFa: z.array(z.string().min(1).max(120)).min(1),
  exampleEn: z.string().min(1).max(240),
  exampleFa: z.string().min(1).max(240),
  tags: z.array(z.string().min(1).max(40)).default([]),
});

export const seedFileSchema = z.array(seedLemmaSchema);
```

## Loader behavior

1. Read all `content/cefr/**/*.json`.
2. Validate with Zod; fail the seed command on any invalid row (report file + index).
3. Upsert lemma by `(source = 'cefr_seed', source_key)`.
4. Replace senses for that lemma in sense_order.
5. Upsert tags and link rows.
6. Never delete user_cards when content updates; inactive lemmas set `is_active = false` only via explicit content retirement.

## CSV import (Phase 5)

### Columns

```text
sourceKey,lemma,pos,cefrLevel,phonetic,glossesFa,exampleEn,exampleFa,tags
```

- `glossesFa`: pipe-separated senses, e.g. `رفتن|حرکت کردن`
- `tags`: pipe-separated slugs
- `phonetic`: optional empty

### Admin flow

1. Dry-run validate → return counts: valid / invalid + first errors.
2. Apply upsert with `source = 'csv_import'`.
3. Restrict to `ADMIN_TELEGRAM_IDS`.
4. Prefer file upload to the bot or a Coolify-mounted import path; document the chosen path in Phase 5.

### Same Zod rules

Map CSV rows into `seedLemmaSchema` after splitting pipes. Reject empty required fields.

## Quality checklist

- Persian glosses are natural, not raw machine-only dumps when avoidable.
- One primary sense first; rarer senses after.
- Examples stay short for Telegram screens.
- No duplicate `sourceKey`.
- Prefer not to duplicate the same `(lemma, pos)` across active seeds without distinct sense intent.

## Content target

| Level | Target size |
|---|---|
| A1 | up to 10,000 |
| A2 | up to 10,000 |
| B1 | up to 10,000 |
| B2 | up to 10,000 |
| C1 | up to 10,000 |

Rebuild with `pnpm vocab:build` (needs files in `content/raw/`), then `pnpm db:seed`.

Official CEFR labels are preferred; remaining slots are filled from frequency + EN–FA dictionary data. Glosses are dataset-quality, not hand-edited.

## Sample starter entry

```json
{
  "sourceKey": "a1-apple-noun",
  "lemma": "apple",
  "pos": "noun",
  "cefrLevel": "A1",
  "phonetic": "/ˈæp.əl/",
  "glossesFa": ["سیب"],
  "exampleEn": "I eat an apple every day.",
  "exampleFa": "من هر روز یک سیب می‌خورم.",
  "tags": ["food"]
}
```
