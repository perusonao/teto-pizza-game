# Issue #421 — Finished Pizza Appetite Appeal: implementation result (Pilot)

Status: **implemented on branch `claude/issue-421-finished-pizza-appeal`; no PR, no Preview deploy, not merged. Owner HV / approval pending.** Design: `TETO_FINISHED-PIZZA-APPEAL_421_Design.md`.

## What changed
- `src/logic/bakeVisual.ts`: pure frames from `bakeHeat` — `cheeseMeltShapeFrame` (melt, brown), `sauceBakeFrame` (tint, gloss), `crustBakeIntensity`; `MELT_SHAPE_CHEESE_IDS` (Pilot: `mozzarella`; another cheese joins by adding its id).
- `src/components/PizzaStage.tsx`: passes `--melt` / `--melt-brown` to opted-in cheeses, adds a sauce-tint overlay and a crust overlay. Non-pilot cheeses keep today's scale-only look.
- `src/App.css`: `.pizza-cheese--meltable` (irregular outline, softened ring/shadow, `::before` spread skirt, `::after` local brown spots), `.pizza-bake-overlay--sauce` (multiply tint + gloss), `.pizza-bake-overlay--crust` (rim band + baked blotches). CSS gradients/pseudo-elements only: **no SVG filter, no clip-path added.**
- Tests: `bakeVisual.test.ts` (+5), `PizzaStage.bakeVisual.test.tsx` (+4).

## Unchanged
Scoring, bake judgement, save, economy, CUT logic/geometry, `.pizza-pieces` filters. CSS vars default to 0, so Reference/thumbnail/tray renders of mozzarella are identical to before.

## Verification (final, code HEAD `0bf7cb3`)
- `tsc -b` clean; `oxlint` no new warnings; full vitest 6996 passed / 1 skipped (380 files).
- Chromium E2E (390x844 + 360x800), 15 related specs incl. the new `finished-pizza-appeal-421.spec.ts`: 111 passed, 21 skipped (pre-existing conditional skips), 0 failed.
- WebKit CI (`e2e-webkit.yml`, workflow_dispatch on the branch, no deploy): run #723 on `59c0a21` failed only on one over-strict assertion of the new spec (cheese layers asserted per piece); fixed in `0bf7cb3` (test only). **Run #727 on `0bf7cb3`: all jobs success** (webkit-390x844 shards 1-2, webkit-360x800 shards 1-2, layout-chromium, Layout Contract Gate, WebKit Gate), including the new spec's PREPARE -> BAKE 70% -> BAKE 97% -> CUT -> RESULT run.
- New spec asserts, per viewport and per browser: no bake layers before BAKE; sauce/crust overlays present at 70%; crust + sauce overlay in every piece in CUT and RESULT; every new layer has a non-zero box lying inside the stage; no horizontal page overflow.
- Screenshots (`screenshots/finished-pizza-appeal-421/`): `before-main.png` vs `after-421.png` (0/35/70/100%), `chromium-<viewport>-{1-before-bake,2-bake-70,3-bake-97,4-cut-before-lines,5-cut-pieces,6-result}.png`, and `dough-deform-...png` (ideal / small / lopsided dough at 70%, ideal at 100%).
- **WebKit screenshots were not inspected**: the CI report artifacts hold them, but the session's network policy denies `productionresultssa4.blob.core.windows.net` (CONNECT 403), so they could not be downloaded. WebKit coverage is therefore by passing assertions only, not by eye.
- Yolk-like cheese: the centre-weighted yellow spots were replaced by small uneven flecks plus a toasted edge; compared in `after-421.png` / the deform sheet.
- Dough deformation: crust blotches are now computed from `doughShapeRadiusAtAngle` (95% of the silhouette radius) and drawn directly on the dough, under the sauce; unit-tested for ideal / shrunk / lopsided shapes. Blotches no longer land on the sauce or outside the pizza.
- Render cost (Chromium, 6x CPU throttle, 6 pieces, CDP task time per repainted frame): with layers 2.9 / 3.9 ms vs without 4.2 / 3.5 ms (390 / 360) -- no measurable cost. Software raster only; real-GPU cost unmeasured.
- Conflict check vs PR #466 (`3e22563`): `git merge-tree` is clean (no overlapping files).

## Remaining risks
1. WebKit/iPhone visuals unreviewed by eye (see above); `mix-blend-mode: multiply` on the sauce tint is the main cross-browser item. Owner iPhone HV is still required.
2. Real-GPU / low-end Android paint cost unmeasured; #467 (LINE in-app browser piece rendering) is unresolved and on hold, and these layers live inside the same piece copies.
3. Crust blotches follow the silhouette radius but are not clipped to it; with a very irregular dough they may touch the crust edge.
4. E2E for the unrelated specs ran on Chromium locally and on WebKit in CI; Production DOM goldens passed in vitest.
