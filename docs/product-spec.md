# Product Spec — English–Persian Vocabulary Bot

## Summary

This Telegram bot helps Persian-speaking learners memorize English vocabulary. It combines new-word introduction, spaced-repetition reviews, configurable daily limits, practice exams from studied words, and diagnostics that adapt future sessions.

Learners use only Telegram. Progress lives in PostgreSQL on the Coolify-hosted server.

## Goals

- Maximize long-term retention, not raw word count.
- Keep sessions short and controllable.
- Support EN→FA, FA→EN, and mixed practice.
- Surface weak spots and adjust practice automatically.
- Exam only vocabulary the learner has already practiced.

## Non-goals (V1)

- Pronunciation scoring / speech recognition
- Human tutor chat
- Languages beyond English–Persian
- A separate mobile or web learning app

## Personas

| Persona | Need |
|---|---|
| Beginner (A1–A2) | Small daily limits, clear Persian UI, gentle exams |
| Intermediate (B1–B2) | Mixed direction, topic filters, weekly report |
| Power user | Custom limits, weak-word drills, import later |

## Onboarding

Triggered by `/start` for new users.

1. Choose UI language: Persian (default) or English.
2. Choose CEFR level: A1, A2, B1, B2, C1 (self-select for V1).
3. Set daily **new word** limit: 5 / 10 / 20 / custom (1–50).
4. Set preferred direction: EN→FA | FA→EN | Mixed.
5. Optional: set reminder time (HH:MM, Asia/Tehran default timezone unless user overrides).
6. Show home keyboard.

Returning users see a home summary: due reviews, remaining new words today, streak.

## Home keyboard

| Button | Action |
|---|---|
| Learn | Start new-word session (respects daily new limit) |
| Review | Start due SRS reviews |
| Exam | Exam wizard |
| Stats | Streak, due count, recent accuracy |
| Settings | Limits, direction, reminders, UI language |

## Commands

| Command | Behavior |
|---|---|
| `/start` | Onboard or show home |
| `/learn` | New words session |
| `/review` | Due reviews |
| `/practice` | Extra drill (not limited to due cards; still respects soft session size) |
| `/exam` | Exam wizard |
| `/exams` | Past exam history |
| `/settings` | Settings menu |
| `/stats` | Quick stats |
| `/report` | Diagnostics summary (weak words, direction bias) |
| `/weak` | Drill weak / leech cards |
| `/help` | Bilingual help |

## Learning sessions

### New words (`/learn`)

1. Check remaining daily new-word quota.
2. Pick unseen lemmas at the user’s CEFR level (and below, if needed to fill).
3. For each word show: English lemma, POS, Persian gloss(es), example EN + FA.
4. Immediate check (MCQ or typed) after introduction.
5. Create `user_card` in learning state.
6. End with recap of new words and remaining quota.

### Reviews (`/review`)

1. Load due `user_cards` ordered by urgency (overdue first).
2. Present by preferred direction (or random if Mixed).
3. Grade with buttons: Again / Hard / Good / Easy.
4. Update SRS schedule (see [srs-and-diagnostics.md](srs-and-diagnostics.md)).
5. Soft-stop at review cap or when the user taps Done.

### Practice modes

- Multiple choice EN→FA
- Multiple choice FA→EN
- Typed answer (normalized matching)
- Cloze from example sentence

## Daily limits

| Setting | Default | Range |
|---|---|---|
| New words / day | 10 | 1–50 |
| Max reviews / day | unlimited | 10–500 or unlimited |
| Vacation mode | off | pauses new words + reminders |

Rules:

- When the new-word quota is exhausted, offer Review instead.
- When review backlog is large, warn and prefer reviews over new words.
- Changing settings applies from the next session (same calendar day quotas recalculate carefully; do not wipe history).

## Exams

### Eligibility

Include only cards the user has **practiced** (at least one successful review or graduated from learning). Never include unseen lemmas by default.

### Modes

| Mode | Items |
|---|---|
| Quick | 10 |
| Standard | 20 |
| Custom | 5–50; filter by level / last N days / topic |

### Flow

1. Choose mode and filters.
2. Generate item mix: ~50% MCQ, ~30% typed, ~20% cloze.
3. Score immediately per item; show brief feedback.
4. Final score + miss list.
5. Offer “Add misses to priority review”.

### History

`/exams` lists recent attempts with score, date, and top weak tags.

## Settings

Editable anytime:

- UI language
- CEFR level (affects new-word selection)
- Daily new limit
- Daily review cap
- Practice direction
- Reminder time + timezone
- Vacation mode

Destructive actions require confirmation:

- Suspend a card
- Reset schedule for a card (not global wipe in V1)

## Memorization helpers

- User mnemonic note on a card
- Manual “hard” flag → higher review priority
- Leech handling: after repeated lapses, offer suspend / mnemonic / simplify
- End-of-session miss recap

## Localization

- Primary UI: Persian
- Secondary UI: English
- Content always bilingual (EN lemma + FA gloss + examples)
- Error and limit messages available in both UI languages

## Success signals (product)

- Learner returns within 7 days
- Review backlog stays manageable
- Exam scores trend upward on overlapping word sets
- User can finish a session in under 10 minutes when limits are modest
