# CEFR vocabulary seeds

Generated English–Persian lemma files loaded by `pnpm db:seed`.

## Layout

- `a1/` … `c1/` — up to **10,000** lemmas each (`batch-*.json`)
- Built by `pnpm vocab:build` from:
  - CEFR-J + Octanove C1/C2 lists
  - Open EN–FA dictionary
  - English frequency list (to pad each level)

## Commands

```bash
# Rebuild JSON from content/raw (download raw sources first if missing)
pnpm vocab:build

# Load into Postgres
pnpm db:seed
```

## Notes

- Official CEFR-labeled words are preferred; remaining slots are frequency/dictionary fills.
- Glosses are machine/dataset translations — useful for practice volume, not perfect literary quality.
- Raw downloads live in `content/raw/` (gitignored).
