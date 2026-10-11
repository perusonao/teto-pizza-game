# Issue #421 — Finished Pizza Appetite Appeal: implementation result (Pilot)

Status: **implemented on branch `claude/issue-421-finished-pizza-appeal`; no PR, no Preview deploy, not merged. Owner HV / approval pending.** Design: `TETO_FINISHED-PIZZA-APPEAL_421_Design.md`.

## What changed
- `src/logic/bakeVisual.ts`: pure frames from `bakeHeat` — `cheeseMeltShapeFrame` (melt, brown), `sauceBakeFrame` (tint, gloss), `crustBakeIntensity`; `MELT_SHAPE_CHEESE_IDS` (Pilot: `mozzarella`; another cheese joins by adding its id).
- `src/components/PizzaStage.tsx`: passes `--melt` / `--melt-brown` to opted-in cheeses, adds a sauce-tint overlay and a crust overlay. Non-pilot cheeses keep today's scale-only look.
- `src/App.css`: `.pizza-cheese--meltable` (irregular outline, softened ring/shadow, `::before` spread skirt, `::after` local brown spots), `.pizza-bake-overlay--sauce` (multiply tint + gloss), `.pizza-bake-overlay--crust` (rim band + baked blotches). CSS gradients/pseudo-elements only: **no SVG filter, no clip-path added.**
- Tests: `bakeVisual.test.ts` (+5), `PizzaStage.bakeVisual.test.tsx` (+4).

## Unchanged
Scoring, bake judgement, save, economy, CUT logic/geometry, `.pizza-pieces` filters. CSS vars default to 0, so Reference/thumbnail/tray renders of mozzarella are identical to before.

## Verification
- `tsc -b` clean; `oxlint` no new warnings; full vitest 6994 passed / 1 skipped (380 files).
- Before/after (5 mozzarella + basil on tomato sauce, progress 0/35/70/100, Chromium 2x): `screenshots/finished-pizza-appeal-421/before-main.png` vs `after-421.png`. Progress 0 and 35 look identical to main; 70 and 100 show the melted/spread/browned cheese, deeper glossy sauce, and rim blotches.
- Not done: CUT/RESULT screenshot, E2E, WebKit, Android, HV video (Preview deploy awaits Owner approval).

## Remaining risks
1. Pieces are copies of the body, so overlays and `::before/::after` are multiplied per piece (CUT): paint cost on low-end phones unmeasured.
2. `mix-blend-mode: multiply` on the sauce tint: WebKit/Android rendering unverified (and #467 is unresolved on Android LINE).
3. The crust overlay is a circle over an irregular dough silhouette; with a heavily hand-shaped dough the rim blotches may sit slightly off the crust.
4. Brown spots on cheese read slightly "egg-yolk-like" at progress 70; colour/opacity are tunable.
5. Production DOM goldens: one extra div per body layer set; unit tests pass, E2E/golden CI not yet run.
