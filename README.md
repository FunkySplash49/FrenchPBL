# Alésia — the 12-step story

Scroll-story for the French PBL presentation. Built from
`../Alesia-Research-Brief-and-Team-Split.md` (the 12-beat talk track) and styled by `../DESIGN.md`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ — open with `npm run preview` or upload anywhere
```

## Presenting

- **→ / Space**: next step · **← / Shift+Space**: previous step · **Home**: title
- Top-right button cycles **FR → EN → FR + prononciation**
- Dotted words are vocabulary: hover or Tab to them for English + pronunciation
- Step 11 is the class game ("Où envoyez-vous la réserve ?")

## Where to edit

| What | File |
|---|---|
| Teammate names (Équipier A/B/C) | `src/data/beats.js` → `PRESENTERS` |
| Story text, dates, numbers (FR / EN / pronunciation) | `src/data/beats.js` → `BEATS` |
| Vocabulary tooltips | `src/data/vocab.js` |
| Map shapes and places | `src/data/gaul.js` |
| Colours, fonts, spacing, motion | `src/styles/tokens.css` (mirrors DESIGN.md) |

Rule from the brief: every number on screen must also be in its "Key dates & numbers" table.
