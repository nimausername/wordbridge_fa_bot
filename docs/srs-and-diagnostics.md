# SRS and Diagnostics

## Purpose

Space reviews so learners remember more with less cramming. Detect failure patterns and adapt the next sessions.

## SRS algorithm (V1)

Use a **simplified FSRS-inspired** scheduler with four grades. Keep the domain pure and unit-testable.

### Grades

| Grade | Meaning | Typical effect |
|---|---|---|
| Again | Forgot | Enter/keep relearning; short delay; `lapses++` |
| Hard | Recalled with difficulty | Smaller interval growth |
| Good | Recalled normally | Standard growth |
| Easy | Effortless | Larger growth |

### Card states

| State | Behavior |
|---|---|
| new | Not yet introduced in a learn session |
| learning | Short steps before graduation (e.g. 1m → 10m → 1d) |
| review | Graduated; interval driven by stability |
| relearning | After Again on a review card; short steps then return to review |
| suspended | Excluded from sessions until resumed |

### Learning steps (defaults)

- Learning: `1m, 10m, 1d` (Good advances a step; Easy can graduate early)
- Relearning: `10m, 1d`

Exact constants live in config; do not hardcode magic numbers in handlers.

### Review scheduling sketch

On each successful **review** grade:

1. Update `difficulty` and `stability` from grade (FSRS-like formulas or a well-documented SM-2 fallback if implementation risk is high).
2. Set `due_at = now + interval(stability)`.
3. Increment `reps` on Good/Easy; on Again reset through relearning.

**Implementation note:** Prefer a small audited helper module. If full FSRS is too heavy for Phase 2, ship SM-2 with the same grade UX and swap the math later without changing Telegram buttons.

### Same-day behavior

- Failed cards can reappear in the same session after a short step.
- Do not burn the whole daily review cap on endless Again loops; cap same-card appearances per session (e.g. 3).

## Daily limits policy

### New words

- Count introductions in `daily_usage.new_words_introduced` for the user’s local date.
- Block further `/learn` when `>= daily_new_limit`.
- Vacation mode blocks new words.

### Reviews

- If `daily_review_limit` is set, stop offering more reviews when reached (allow finishing the current card).
- Unlimited when null.

### Review debt

When `due_count > max(20, 3 * daily_new_limit)`:

- Home screen warns in UI language.
- Prefer Review CTA over Learn.
- Optionally auto-reduce suggested new limit in `/report` (suggestion only; do not silently change settings).

### Streak

A study day counts when the user completes at least one meaningful action: introduce a new word **or** complete a review/exam item. Update `streak_count` using the user’s timezone date.

## Session composition

Priority order when building a review queue:

1. Cards with active `priority_until` (exam misses)
2. Overdue by most days first
3. User-flagged hard cards due today
4. Other due cards
5. Interleaved weak cards from diagnostics (small %)

New-word sessions never pull due reviews except as an optional “warm-up” of 0–2 weak cards if backlog is low.

## Answer matching

### English

- Trim, lowercase
- Collapse internal whitespace
- Accept common articles optional where expected answer is a single lemma

### Persian

- Trim, normalize Arabic/Persian Yeh/Kaf variants
- Remove zero-width characters
- Collapse whitespace
- Accept any configured gloss sense as correct for FA answers
- Optional punctuation strip

MCQ compares option ids, not fuzzy text.

## Diagnostics engine

Computed from `review_logs` and `exam_items` (rolling windows: 7 and 30 days).

### Signals

| Signal | Definition | Action |
|---|---|---|
| Weak word | Success rate &lt; 60% with ≥3 attempts, or ≥3 lapses | Boost in `/weak` and session interleave |
| Direction bias | Accuracy gap EN→FA vs FA→EN ≥ 20 points (≥5 attempts each) | Suggest Mixed / weaker direction for 7 days |
| Leech | Lapses ≥ threshold (default 6) | Prompt suspend / mnemonic / simplify |
| Cramming | ≥5 Again in one session | Suggest lower new limit / shorter session |
| Topic/POS weakness | Tag or POS accuracy lag ≥ 15 points | Prefer those tags in next new words when possible |

### `/report` contents

- Due count and review debt status
- 7-day accuracy overall + by direction
- Top 10 weak lemmas
- Leech count
- One concrete suggestion (limit or direction)

### Adaptation rules

- Never change user settings silently.
- May inject up to ~20% weak/priority cards into a review session.
- Exam misses set `priority_until = now + 3 days` when the user accepts the offer.

## Exams and SRS interaction

- Exams **do not** advance SRS intervals by default (avoids grade noise).
- Exams **do** write `exam_items` and optionally priority flags.
- Optional Phase 4+: “count exam toward review” toggle — off by default.

## Configurable constants (env or settings table)

| Key | Example default |
|---|---|
| learningSteps | `1m,10m,1d` |
| relearningSteps | `10m,1d` |
| leechThreshold | `6` |
| weakMinAttempts | `3` |
| weakMaxSuccessRate | `0.6` |
| directionBiasGap | `0.2` |
| maxSameCardPerSession | `3` |
| examMissPriorityDays | `3` |

## Testing requirements

- Unit tests for: grade transitions, due date math, daily limit edge cases, Persian normalization, weak-word detection.
- Golden-file tests for a short sequence of grades on one card.
