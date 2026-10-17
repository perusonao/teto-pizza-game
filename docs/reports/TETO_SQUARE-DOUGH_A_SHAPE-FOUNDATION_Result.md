# Square-Pan Dough A — Shape foundation (`panShape`, pan geometry, square dough model) — Result

Issue #534, Epic #532 (child A). Design: `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` (rev.3) and `TETO_SQUARE-DOUGH_Fresh-Audit-and-Plan.md`. Base: `origin/main` `80e6d10` (after Q0 #539).
No UI, no Technique, no recipe change, no CSS change. Nothing in the game calls the new code (no recipe is square). Not merged, no shared Preview touched.

## What was added (new modules only)
| File | Content |
|---|---|
| `data/panShape.ts` | `PanShape = "round" \| "square"`, `DEFAULT_PAN_SHAPE = "round"`, `resolvePanShape(recipe)` (absent field / unknown recipe = round). No imports. |
| `data/recipes.ts` | one optional field `panShape?: PanShape` on `Recipe` + `import type`. **No recipe sets it.** |
| `logic/pan/panGeometry.ts` | the shape interface `PanGeometry { contains, clamp, bounds, targetArea }`. **Round = thin wrapper** (`contains: isInsideDough`, `clamp: clampToDough`, bounds = the dough circle's box, target = the existing `SAUCE_TARGET_RADIUS` circle): no new logic. **Square** = axis-aligned square of half-side 44 on the same 0–100 box (centre 50): inclusive `contains`, per-axis `clamp` (a hair inside the rim, like the round clamp), `bounds`, `SQUARE_PAN_CORNERS`. |
| `logic/pan/squareDough.ts` | the square dough **model**: a 12×12 grid of `spread` ∈ [0, 1] (not the radial 8-point model), pure `pressAt` (the primitive step B drives), `squareCoverage`, `squareEvenness`, `squareCornerReach` / `squareCornersReached`, `isValidSquareDough`, cell ↔ percent helpers. |

Untouched (deliberately): `doughShape.ts`, `pizzaCoordinates.ts`, `sauceField.ts`, `PizzaStage.tsx`, `App.css`, the reducer, `cookingProfiles`, persistence, every Reference. #474 / #518 / #540 do not overlap (the only shared file is `data/recipes.ts`, where this adds a field to the `Recipe` interface and #540 appends an array entry).

## Square sauce Reference (spec — defined, not borrowed from the circle)
`SQUARE_SAUCE_TARGET_HALF_SIDE = 36`: a 72×72 square centred on the pan, an 8-unit rim margin (the round target's margin is 48 − 40), ≈ 67% of the pan area (round: ≈ 69%). It is **not** derived from `SAUCE_TARGET_RADIUS`; the test pins that a point at (86, 86) is inside the square target and outside the circular one. The value is provisional: step D tunes it with the square Reference on real screens. No Reference / scoring is wired to it yet.

## Initial constants (all in one place each; Owner D5: final values from on-device HV)
`SQUARE_PAN_HALF_SIDE` 44 · `SQUARE_SAUCE_TARGET_HALF_SIDE` 36 · `SQUARE_DOUGH_GRID` 12 · `SQUARE_COVERAGE_MIN_SPREAD` 0.05 · `SQUARE_CORNER_ZONE_CELLS` 3 (a 3×3 corner zone) · **`SQUARE_CORNER_REACH_THRESHOLD` 0.85** (corner reach = mean spread of its zone). Evenness = `1 − stdDev/mean`, clamped (uniform = 1 **whatever the level**, empty = 0, bare cells count); it is a shape measure only, `squareMeanSpread` reads the level, and step C's completion must not use evenness alone. The corner-zone size is derived from a 25% fraction of the grid (3 of 12). **No completion predicate** is defined here: the 4-corners ∧ evenness gate and its threshold belong to step C.

## Acceptance criteria (#534)
| Criterion | Evidence |
|---|---|
| All 57 recipes byte-identical for dough / sauce / topping / cheese / scoring / render | no production file of those areas is edited; the existing suites (Scoring 2.0 parity fixtures, the B1 single-source golden, the sauce / dough / reducer tests) pass **unchanged**; `panShape.test.ts` additionally checks, for every recipe, that the round geometry equals `isInsideDough` / `clampToDough` at its own Reference positions and around the rim |
| `isInsideDough` / `clampToDough` / `applyStretchPoint` / `doughShape.ts` unchanged | no existing test or file edited |
| Square model: coverage / evenness / corner reach (85% default as a constant) by property tests | `squareDough.test.ts`: seeded-PRNG properties (no new dependency, deterministic, no retry): grid stays valid under any press sequence, never lowers a cell, saturates, bad input returns the same object, coverage / reach monotone and in 0..1, evenness in 0..1 and ordered, pressing one corner reaches that corner only |
| Save compatibility | `PersistentSaveV2` unchanged; `persistence.ts` holds no dough / thumbnail / geometry field (grep: none); the Dex stores `{recipeId, discovered, bestScore, bestStars, timesMade}` only; thumbnails (`PizzaThumbnail`, `ReferenceThumbnail`) are drawn from the recipe at render time; `persistence.test.ts` passes unchanged |
| Square Reference (sauce target) defined, circle not implicitly reused | above |
| Unreachable | `panShape.test.ts` scans the production sources: only `data/recipes.ts` (type import) and the pan modules import the new files; no recipe sets `panShape` |

## Circle-clip audit (input for D2) — every place that assumes a round dough
**CSS (`App.css`), dough-bound:**
| Line | Selector | Rule | D2 impact |
|---|---|---|---|
| 243 | `.pizza-dough` | `border-radius: 50%` (and the bake `filter` transition — #518 / #517 area) | the stage box itself; square needs a shape-conditional radius, **not** the bake-filter block |
| 460 | `.pizza-sauce-layer` | `border-radius: 50%` | clip of the sauce layer |
| 477 / 481 | `@keyframes sauce-spread` | `clip-path: circle(0% / 150% at origin)` | the paint reveal animation (circular growth) |
| 508 | `.pizza-paint-trail` | `clip-path: circle(48% at 50% 50%)` | trail clip |
| 537 | `.pizza-cut-layer` | `clip-path: circle(50% at 50% 50%)` | CUT (disabled for square; #429 untouched) |
| 764 / 818 | `.pizza-cheese`, `.pizza-cheese--fontina` | `border-radius: 50%` | cheese layer |
| 929 | `.pizza-bake-overlay` | `border-radius: 50%` | bake overlay (#518 area) |
| 4595 | `.pizza-sauce-oil-sheen` | `border-radius: 50%` | oil sheen |
| 4425 / 4435 | `.pizza-thumbnail`, `__base` | `border-radius: 50%` | thumbnails (Pizza Select / Dex / RESULT) |
| 4666 / 4693 / 4704 | `.reference-mini-pizza`, `__sauce`, `__target-guide` | `border-radius: 50%` | Reference mini preview + target guide |
| 4771 / 4790 | `.reference-thumbnail`, `__base` | `border-radius: 50%` | Reference thumbnail |
| 4837 / 4852 | `.player-reference-mini-pizza`, `__sauce` | `border-radius: 50%` | player Reference |
| 1445 | `.piece-drag-preview` | `border-radius: 50%` | drag ghost (a topping preview; not the dough) |
**CSS, not the dough (no change needed):** 103 `.dialogue-box__portrait`, 446 `.pizza-char-spots`, 945 `.pizza-perfect-glow`, 2573 `.generic-pizza-silhouette`, 3787 / 3879 / 3890 header / home avatars, 4332 `.pizza-select-card__lock-silhouette`, 6744 `.dinner-chip__check`, 1690 `.bake-oven__caption-avatar`. (`.pizza-char-spots`, `.pizza-perfect-glow` and `.generic-pizza-silhouette` decorate a pizza and should be re-checked in D2.)
**TSX / canvas:** `PizzaStage.tsx` 1470 `<circle r={DOUGH_RADIUS}>` and 1483 `<circle r={SAUCE_TARGET_RADIUS}>` (the dough / target guides, `.dough-target-guide`), 1416–1418 `<clipPath id={doughClipId}>` (the player's radial silhouette; round only — square needs its own), 1124 / 1501 `clipPath: url(#…)`, 1514 CUT centre dot; `SauceCanvasFallback.tsx` 46 `borderRadius: "50%"` (dot fallback); canvases (`SauceHeatmapCanvas`, `SauceMergedCanvas`, `CheesePoolCanvas`) are clipped by their parent layers above (no own `arc` clip: `SauceMergedCanvas` 145 / `OverflowMarkerCanvas` 54 draw 3-px dots).
**Logic that assumes the circle (all stay as they are):** `pizzaCoordinates.isInsideDough` / `clampToDough` (reducer drop validity, piece drag), `doughShape.ts` (radial model, `isInsideDoughShape`), `sauceField` (`isCellInsideDough`, `insideDoughFraction`, `SAUCE_TARGET_RADIUS` for `edgeAmount` / the target guide), `cut/*` geometry (`DOUGH_CENTER` / `DOUGH_RADIUS`), `pieceDrag.ts`.

## Review follow-ups applied (`/code-review`, high)
`isValidSquareDough` never throws (null / undefined invalid); `pressAt` returns a malformed grid as it is; the square `clamp` never returns a non-finite coordinate; `bounds()` / `targetArea()` are constant objects; corner-zone size derived from a fraction (never overlapping); evenness doc made explicit about the level; shared seeded PRNG in `logic/testSupport/seededRng.ts`; the unreachability guard also matches dynamic `import()` / `require()`.

## Verification
- `tsc -b`, `oxlint` (0 errors; same warnings as main), `npm run build`, full Vitest: see the PR.
- Round E2E at 390×844 / 360×800 and WebKit: the PR's CI (this slice has no visible change; HV not required).

## Not done / left to later steps
Gestures (B, C), completion predicate and the 85% gate (C), square sauce / piece / cheese / bake / RESULT / thumbnails and the CSS clips above (D), the 天板焼き Technique, `pan` identity, Research behaviour (F), the `grandma-pizza` recipe (E). Player-visible effects: none.
