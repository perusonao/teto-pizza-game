# Square-Pan Dough A — panShape and shape foundation — Result

Issue #534 (A) under Epic #532. Design: `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` (D1, D4, D5), Fresh Audit `TETO_SQUARE-DOUGH_Fresh-Audit-and-Plan.md`.
Base: `origin/main` `80e6d10`. **Not merged, not deployed, shared Preview untouched.** No player-visible change.

## What changed

| File | Change |
|---|---|
| `src/logic/pan/panShape.ts` (new) | `PanShape = "round" \| "square"`, `DEFAULT_PAN_SHAPE = "round"`, `isPanShape`, `resolvePanShape` (absent / unknown value → round). |
| `src/logic/pan/panGeometry.ts` (new) | `PanGeometry` interface: `contains`, `clamp`, `bounds`, `targetArea`. `ROUND_PAN_GEOMETRY` **is the existing `isInsideDough` / `clampToDough` by reference**. `SQUARE_PAN_GEOMETRY` is new (half side 44, corners NW/NE/SE/SW, target region in the round proportion 40/48). `getPanGeometry(shape)`. |
| `src/logic/pan/squareDough.ts` (new) | Square dough model: 16 × 16 grid of thickness values; `createInitialSquareDough`, `isValidSquareDough`, `squareDoughCoverage`, `squareDoughEvenness`, `squareCornerReach`, `areAllCornersReached`. `CORNER_REACH_THRESHOLD = 0.85` lives only here. No gestures. |
| `src/data/recipes.ts` | `Recipe.panShape?: PanShape` (one optional field + a type import). **No recipe sets it.** |
| tests (new) | `panShape.test.ts`, `panGeometry.test.ts`, `squareDough.test.ts` (see below). |

**Not touched:** `PizzaState`, `CookingProfile`, `signature.ts`, `persistence.ts`, `doughShape.ts`, `pizzaCoordinates.ts`, `sauceField.ts`, `gameReducer.ts`, `PizzaStage.tsx`, `App.css`, any recipe/ingredient data, any existing test. Existing callers still call the round functions directly; routing them through the interface is D (#537).

## Why the round pizza cannot change
- Nothing imports the new modules except their own tests and one `import type` in `recipes.ts` (type-erased).
- `ROUND_PAN_GEOMETRY.contains === isInsideDough` and `.clamp === clampToDough` are asserted by reference, and by value on a ~80,000-point probe grid (past the box on every side, both rims, 360 angles).
- Production-inert test: no `RECIPES` entry has a `panShape` key and every recipe resolves to `"round"`.
- No existing test file was edited, so every existing golden (`scoreParity.*.json`, `sauceB1.singleSource.json`, `sauceRender.singleSource.json`, hint5 goldens) is its own proof of unchanged behaviour.
- Save compatibility: no persisted type changed (`PizzaState` is not persisted; `PersistentSaveV2` untouched).

## Square model — design choices (all provisional; Owner on-device HV decides, D5)
- Grid 16 × 16 (same as the sauce field, so layers can share it later); 14 × 14 = 196 cells have their centre on the pan.
- Pan half side 44 (area 7744 vs. round 7238, within 10%); corners ~62.2 from the centre, inside the dough box (~70.7).
- Corner reach = the further of the covered on-pan cells' smaller axis extent (outer cell edge, clipped to the pan), over the outermost on-pan edge (43.75). Covering the corner cell = 1; the second ring = 0.857 (counts as reached); the third = 0.714. Because the smaller axis is used, pulling dough along one side only never counts as a corner.
- Evenness = 1 − sd/mean over covered on-pan cells, with a 1e-9 relative noise floor so a uniform sheet reads exactly 1. **No evenness threshold is defined here** — that is C (#536).
- Cell granularity makes 0.85 mean "the corner cell or its inner neighbour"; whether that is generous enough is an on-device question.

## Tests added (41)
- `panShape.test.ts`: default, guard, resolver, Production inertness across all `RECIPES`.
- `panGeometry.test.ts`: round identity (by reference and by value); square edges inclusive and one hair outside exclusive on all four sides; corners inside and just past a corner outside; non-finite points; clamp (unchanged when inside; direction-preserving; lands on the rim; idempotent; far / diagonal / non-finite); bounds; target region (inclusive edge, inside the pan, proportion).
- `squareDough.test.ts`: on-pan cells (196), initial dough (valid, symmetric, small, even, no corner), validity (length, NaN / ±∞, negative, over-thick, off-pan dough), coverage (inclusive cover threshold), evenness (uniform = 1, known two-level value, random bounds), corner reach (order NW/NE/SE/SW, ring boundaries 1 / 0.857 / 0.714, inclusive comparison, one-side pull, per-corner independence, monotonic under growth, range), module guards (the threshold literal appears once; the pan module imports no UI / state / technique code).

## Circle-clip audit for D2 (App.css, 30 matches of `border-radius: 50%` / `clip-path: circle(`)

| Group | Selectors (line) | Relevance to the square pan |
|---|---|---|
| **Pizza body — must become shape-aware** | `.pizza-dough` (243), `.pizza-char-spots` (446), `.pizza-sauce-layer` (460), `.pizza-sauce-layer` reveal keyframes `circle(0%…)` / `circle(150%…)` (477, 481), `.pizza-paint-trail` `circle(48%…)` (508), `.pizza-cut-layer` `circle(50%…)` (537), `.pizza-cheese` (764), `.pizza-cheese--fontina` (818), `.pizza-bake-overlay` (929), `.pizza-perfect-glow` (945), `.pizza-sauce-oil-sheen` (4595) | D2 (#537). `.pizza-dough` also carries the bake filter that #518 is changing — coordinate. The reveal keyframes are circular reveals around the paint origin and probably stay as they are. |
| **Thumbnails / references — shape-neutral until discovery** | `.pizza-thumbnail` (4425), `.pizza-thumbnail__base` (4435), `.reference-mini-pizza` (4666), `__sauce` (4693), `__target-guide` (4704), `.reference-thumbnail` (4771), `__base` (4790), `.player-reference-mini-pizza` (4837), `__sauce` (4852), `.generic-pizza-silhouette` (2573), `.pizza-select-card__lock-silhouette` (4332) | D2 for the discovered square recipe only; undiscovered recipes must keep the round / generic silhouette (Anti-Oracle, addendum §4B.2 AC-9). |
| **Not a pizza** | `.dialogue-box__portrait` (103), `.piece-drag-preview` (1445), `.bake-oven__caption-avatar` (1690), `.app-header__settings-button` (3787), `.home-hero__teto` (3879), `.home-hero__sidekick` (3890), `.dinner-chip__check` (6744) | Unrelated avatars / chips / buttons. |

JS-side circular assumptions D must also route through the interface (not changed here): `gameReducer.ts:1011` (piece drop), `pizzaState.ts:136`, `pieceDrag.ts:41-43`, `sauceField.ts` (`isCellInsideDough`, `SAUCE_TARGET_RADIUS`), `sauceDisplay.ts:137,163`, and `cut/*` (CUT is disabled for the square pan).

## Verification
See the PR description for the command results and CI. Human Verification: not applicable (no visible or behavioural change; `TETO_HUMAN-VERIFICATION-POLICY.md` §2).

## Conflicts
#474, #518: no implementation PR or branch exists; A touches neither `doughShape.ts` / `PizzaStage.tsx` nor the bake-filter CSS. #540 (grandma recipe) and #527: not touched.
