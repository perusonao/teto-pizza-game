# TETO PINSA-577 — Oval dough (release-required condition)

Owner decision 2026-10-25: the Pinsa Romana dough must be an oval before release. This PR is **independent of #659** and leaves `PINSA_PRODUCTION = false`
(nothing here is reachable by players until the gate opens; `?doughSwitch=open` Preview/DEV only).

## Design (minimal, Pinsa-dough-only)
- `src/logic/dough/doughOutline.ts`: `doughOutlineOf(pizza, recipe)` → `"oval"` only for dough kind `material-multigrain-long-ferment`, else `"round"`.
- One circular dough-percent space is kept for every rule (sauce, placement, scoring, Reference, bake, finish). The oval is that space drawn in a
  `.pizza-dough` box with `aspect-ratio: 3 / 2` (width = the round pizza's, height 2/3). `clientPointToDoughPercent` already normalizes x by width and y by
  height separately, so hit-testing is the ellipse for free. SVG overlays get `preserveAspectRatio="none"`; the paint-trail clip becomes `ellipse(48% 48%)`.
- A square tray stays square. CUT stays unavailable for Pinsa. Small pizzas standing for the recipe (select card, 見本 thumbnail, popovers) get a 2/3-height modifier.

## Before / after (390×844, `docs/reports/screenshots/pinsa-oval-dough/`)
`iphone-390x844-before-round.png` (other-dough chip not chosen) → `iphone-390x844-after-oval-dough.png`; `iphone-390x844-step-3-cheese`, `-step-6-finish`, `-step-7-result` show the same oval through placement, post-bake layer and result.
The stage and 次へ button do not move when the chip is toggled (asserted).

## Regression coverage
- vitest: `doughOutline.test.ts` (matrix + elliptical rim math), `PizzaStage.oval.test.tsx` (classes, SVG stretch, rim accepted / corner refused, tray stays square, thumbnails). Full suite green (523 files).
- e2e `pinsa-oval-dough.spec.ts` (390×844 and 360×800): 3:2 box, no overflow, 7-step walk DOUGH→RESULT, hit-test, round and square unchanged.
- `e2e/gestures.ts` `completeDoughStep` now draws the ring with the box's own aspect (identical for round).
- Existing: dough-kind-chips-p2, dough-size-status-474, square-dough/pizza specs, layout-contract, layout-invariants, tray-family all pass.

## iPhone HV (Owner decides PASS/FAIL)
With the oval Artifact: Free Cooking → ほかの/ピンサ生地 chip → (1) the dough is a wide oval, chips and 次へ do not move; (2) stretch to the edge, 次へ enables;
(3) sauce/cheese/topping can be placed on the whole oval and not in the empty box corners; (4) bake/finish/result keep the oval; (5) ふつうの生地 returns the round pizza;
(6) ○/□ square tray with the other dough stays square; (7) no CUT step for Pinsa.

## Residual risks
- Finger tolerance is anisotropic: logic space is circular but screen distance is not, so vertical precision is ~1.5× stricter; oval area ≈ 2/3 of the round.
- Melted-cheese blobs overhang the rim slightly on the short axis (same effect as round, more visible).
- WebKit not run locally (CI WebKit shards are authoritative). Merge order vs #659: this PR does not touch `vitest.config.ts` / `pinsaGate.ts`.
