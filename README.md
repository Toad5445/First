# The System

An isekai-style leveling system for daily habits. It's an installable web app (PWA) that runs on
phone and desktop, works offline, and syncs between devices through Firebase's free plan.

Live app: https://toad5445.github.io/First/

## Layout

- `docs/`: the app itself, served as-is by GitHub Pages (no build step)
  - `js/core.js`: game rules (XP, streaks, perks, buffs, jobs). No DOM, unit-tested.
  - `js/data.js`: skills, jobs, achievements, themes
  - `js/sync.js`: Firebase sync (per-field writes so two devices merge cleanly)
  - `js/app.js`: UI; `js/fx.js` sound/animation; `js/charts.js` charts; `js/card.js` status card PNG
  - `vendor/firebase.js`: bundled Firebase SDK (`npm run build:firebase`)
  - `sw.js`: offline cache. **Bump `VERSION` in it on every release** so installed apps update.
- `tests/`: `npm test` runs the engine tests. Browser checks: `tests/ui-smoke.mjs`, `tests/theme-shots.mjs`,
  `tests/sync-live.mjs` (serve `docs/` on port 8765 first).
- `tools/`: icon generator and Firebase bundle entry.

## Local development

```bash
npm install
python3 -m http.server 8765 --directory docs   # then open http://localhost:8765
npm test
```
