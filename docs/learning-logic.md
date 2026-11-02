# Learning logic (current)

## Three modes

| Mode | Purpose | Changes SRS schedule? |
|---|---|---|
| **Learn** | Introduce unseen words (daily quota) | Yes — first quiz is learning step 0 |
| **Review** | Only cards with `dueAt <= now` | Yes |
| **Practice** | Free drill on known words | **No** |

## Card lifecycle

1. **Learn** creates a card with `state=learning`, `learningStep=0`, `dueAt=now`.
2. User answers the intro MCQ:
   - Correct (`good`) → next learning step (about 10 minutes), or graduate after steps finish.
   - Wrong (`again`) → step resets, `dueAt ≈ now + 30s` (comes back soon in Review).
3. After learning steps succeed, card becomes `state=review` with day-scale intervals.
4. **Review** only shows due cards. Wrong answers resurface in ~30s after other due cards.
5. **Practice** never moves `dueAt`.

## Reset local/test data

```bash
pnpm db:reset
```

This truncates all app tables and reloads CEFR seeds. Use while testing as a single user.
