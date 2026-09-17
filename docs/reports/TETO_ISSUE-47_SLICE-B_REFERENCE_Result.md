# Teto Pizza Game — Issue #47 Slice B — Reference UX — Result

**Base SHA:** `18c801543fe999dcc91d3d41ca5dcefa1a987655` (Merge PR #49: Issue #47 Slice A UX
fixes). Confirmed via `git fetch origin main && git rev-parse origin/main` at session start;
the implementation branch (`claude/teto-pizza-issue-47-slice-b-24m8yr`) was reset directly to
this exact commit (working tree clean).

**Scope:** Issue #47 Slice B only — Findings F (Reference missing for non-Margherita) and H
(no persistent mini Reference during Making), per
`docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` §7/§9/§17. Slice A (Navigation/Retry/
HOME) and Slice C (Making controls) are already merged/deferred and untouched here.

---

## 1. Responsibility boundary — player reference vs. Scoring 2.0 Reference

### Before

`src/data/referencePizza.ts` held exactly one hand-authored `ReferencePizza` fixture
(`MARGHERITA_REFERENCE`) and was the **single SSOT for two different consumers at once**:

- `ReferencePreview.tsx` (the player-facing "見本" popover) read it directly.
- `src/logic/scoringV2/index.ts` (Scoring 2.0 Shadow) read the exact same function
  (`getReferencePizza`) for its sauce/pieces scoring components.

For every recipe but Margherita, `getReferencePizza` returned `null`, so both consumers were
simultaneously blocked by one shared gate. This is exactly the "if current architecture
couples these, introduce the minimum clean separation" case the task described: expanding
Reference data for the player would have meant either (a) hand-authoring 6 more
`ReferencePieceGroup[]` fixtures as if they were reviewed Scoring 2.0 target geometry (which
Issue #47 explicitly forbids fabricating), or (b) leaving 6 of 7 recipes without any
player-facing guidance at all.

### After

Two independent, one-directional data sources now exist side by side:

- **`src/data/referencePizza.ts`** — **unchanged, byte-for-byte**. Still Scoring 2.0's own
  authoritative target geometry/coefficients, still Margherita-only, still `null` for every
  other recipe. Nothing in this file was edited.
- **`src/data/playerReference.ts`** (new) — player-facing recipe guidance, generated
  deterministically for **every** recipe purely from `Recipe.requiredIngredients` +
  `../data/ingredients.ts` (the same SSOT Making Game itself reads). This file never imports
  from `referencePizza.ts` or `../logic/scoringV2/*`, and nothing in Scoring 2.0 imports from
  it. The two are provably independent by import-graph, not just by convention.

`GameScreen.tsx` is the only place that now looks at both: it renders the **existing,
unmodified** `ReferencePreview` (Margherita, real Scoring 2.0-derived content, including its
precise quantity/coverage bars) when `getReferencePizza(recipe.id)` is non-null, and the
**new, generic** `PlayerReferencePreview` (identity + approximate placement only, no numeric
bars, explicit disclaimer) for every other recipe. Scoring 2.0's own gating
(`referenceModeEnabled`, used for `SauceMetricsPanel`'s live shadow score and physical
tray-drag enablement) is **completely untouched** — still Margherita-only, still FREE-only,
still driving exactly what it drove before this slice.

No Scoring 2.0 target coordinate was fabricated anywhere in this change: the generic
generator's positions are explicitly a "spread evenly around a ring" placement guide (reusing
`PIECE_RING_POSITIONS`, the same table `PizzaThumbnail.tsx` already used for Pizza Select's
card preview), never claimed as a researched real-dish layout, and never read by anything that
computes a score.

---

## 2. All-recipe player reference coverage (Finding F)

`getPlayerReferencePizza(recipe: Recipe): PlayerPizzaReference` (`src/data/playerReference.ts`)
returns a non-null result for **every recipe in `RECIPES`**:

| Recipe | Sauce identity | Piece groups (ingredient × count) |
|---|---|---|
| マルゲリータ | tomato-sauce | mozzarella×3, basil×2 |
| マリナーラ | tomato-sauce | garlic×3, oregano×2 |
| クアトロ フォルマッジ | olive-oil | mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2 |
| ジェノベーゼ | pesto | mozzarella×2, cherry-tomato×3 |
| ビスマルク | tomato-sauce | mozzarella×3, egg×1 |
| フンギ | tomato-sauce | mozzarella×2, mushroom×3 |
| フガッサ | olive-oil | onion×4, oregano×1 |

Sauce identity is resolved from the recipe's own required `category: "sauce"` ingredient (its
real color/name from `ingredients.ts`); piece identity/count is resolved from
`requiredIngredients[].minCount`, so approximate appearance is always consistent with what the
player is actually required to place. Positions are assigned by walking
`PIECE_RING_POSITIONS` (8 slots) in `requiredIngredients` order; every recipe's total non-sauce
piece count (4–8) fits with no two pieces of the same recipe ever colliding on the same slot
(pinned by `playerReference.test.ts`).

Locked recipes (only Fugazza today, gated on owning `onion`) are unaffected — they cannot enter
Making, so they never call this generator in practice; the function itself has no lock-state
awareness and does not need one.

---

## 3. Mini Reference (Finding H)

`GameScreen.tsx`'s `.order-card` (already the compact PREPARE header row introduced by Human
Feel Fix 3) now always renders a `.mini-reference` button alongside the recipe name/hint, for
every recipe, unconditionally during `state.phase === "PREPARE"` — no longer gated on
`referenceModeEnabled` (Scoring 2.0's own Margherita/FREE-only flag, which still gates
`SauceMetricsPanel` and physical tray-drag exactly as before).

The mini thumbnail reuses `PizzaThumbnail` (`src/components/PizzaThumbnail.tsx`, previously
only used by Pizza Select's cards) at a smaller fixed size (48px vs. its 64px card usage, via
a `.mini-reference__thumb .pizza-thumbnail` CSS override) — no new rendering primitive, per the
task's "prefer... existing PizzaThumbnail... primitives" instruction. Tapping it calls the same
`onReferencePopoverChange(true)` handler the old inline "見本" button used, opening the
existing full popover.

**390×844 / 360×800 verification** (Playwright/Chromium, both Margherita and Bismarck,
confirmed live this session):

- `.mini-reference` renders without any tap, for both recipes, at both viewports.
- No horizontal overflow (`document.documentElement.scrollWidth` vs. `clientWidth`) at either
  viewport.
- `.order-card`'s bottom edge stays well above both `.prepare-bake-bar` (bottom CTA) and the
  ingredient tray/panel — no overlap at either viewport (order-card already had slack per the
  Fresh Audit's own §9 measurement, unchanged by this small addition).

---

## 4. Expanded Reference (Finding F continued)

- **Margherita:** `ReferencePreview.tsx` is functionally unchanged — same popover markup, same
  Scoring 2.0-derived quantity/coverage bars, same piece positions from `MARGHERITA_REFERENCE`.
  The only edit is a new optional `renderTrigger` prop (default `true`, so every existing
  caller/test that doesn't pass it keeps today's exact behavior) so `GameScreen.tsx` can use the
  new mini thumbnail as the sole trigger instead of duplicating a second "見本" button inside
  `.order-card`.
- **Every other recipe:** a new `PlayerReferencePreview.tsx` component renders a popover from
  `PlayerPizzaReference` — sauce color swatch, cheese pieces via the same shared
  `IngredientPieceVisual` (`.pizza-cheese` for cheese, emoji for everything else — identical
  visual language to the player's own pizza and to Margherita's popover), and a plain-language
  caption ("○○を生地全体にまんべんなく塗って、△△を目安に配置しよう。"). It deliberately
  **never renders `.reference-preview__bar-row` numeric bars** and always shows an explicit
  disclaimer — "※この配置は材料から自動生成したイメージです。採点の基準座標ではありません。"
  — so a generated placement guide can never be mistaken for a real scoring target (pinned by
  `PlayerReferencePreview.test.ts` and the App-level integration tests).

---

## 5. Reset / retry lifecycle

Both the mini and expanded reference derive purely from `state.recipe` (via
`getPlayerReferencePizza(state.recipe)` computed inline in `GameScreen.tsx`, and
`referencePizza`/`getReferencePizza(state.recipe.id)` computed in `App.tsx`, both unchanged
mechanisms). No new persisted or component-local reference state was introduced.

- **`RESET_PIZZA`** (`gameReducer.ts`, untouched by this slice) only ever replaces
  `state.pizza`; it never touches `state.recipe`/`state.order` — so the reference is
  unaffected by construction, verified live (Margherita and Bismarck) and by
  `App.playerReference.test.tsx`.
- **`RETRY_SAME_RECIPE`** (Slice A, untouched here) rebuilds a fresh `PREPARE` state for the
  *same* `state.recipe.id` — the reference naturally follows, verified for Bismarck end to end
  through DISCOVERED → もう一度つくる.
- **Pizza Select → a different recipe** (`SELECT_RECIPE`) sets a new `state.recipe` — both
  reference derivations naturally recompute to the new recipe, verified end to end
  (Bismarck → HOME → Pizza Select → Margherita).

No special persisted reference state exists anywhere — exactly matching the task's own
"Reference should derive from current recipe" requirement.

---

## 6. Exact files changed

New:
- `src/data/playerReference.ts` — `PlayerPizzaReference`/`PlayerReferencePieceGroup` types,
  `getPlayerReferencePizza(recipe)`.
- `src/components/PlayerReferencePreview.tsx` — generic expanded popover for recipes without a
  Scoring 2.0 Reference fixture.
- `src/logic/pizzaReferenceLayout.ts` — `PIECE_RING_POSITIONS`, extracted from
  `PizzaThumbnail.tsx`'s previously-local `PIECE_POSITIONS` constant so both the card thumbnail
  and the new player reference generator draw from one shared table.
- Tests: `src/data/playerReference.test.ts`, `src/components/PlayerReferencePreview.test.tsx`,
  `src/App.playerReference.test.tsx`.

Modified:
- `src/components/PizzaThumbnail.tsx` — imports `PIECE_RING_POSITIONS` instead of a local
  constant (identical values, zero behavior change — `PizzaThumbnail.test.tsx` passes
  unmodified).
- `src/components/ReferencePreview.tsx` — added optional `renderTrigger` prop (default `true`).
- `src/screens/GameScreen.tsx` — `.order-card` now always renders the `.mini-reference` trigger
  and branches between `ReferencePreview`/`PlayerReferencePreview` based on
  `getReferencePizza(state.recipe.id)`'s availability; `SauceMetricsPanel`'s own
  `referenceModeEnabled` gating is untouched.
- `src/App.css` — `.mini-reference`/`.mini-reference__thumb`/`.mini-reference__label` (order-
  card trigger) and `.player-reference-mini-pizza*`/`.player-reference-preview__disclaimer`
  (generic popover) rules added; no existing rule edited.

**Untouched (confirmed by diff review):** `src/data/referencePizza.ts`,
`src/logic/scoringV2/*`, `src/data/recipes.ts`, `src/logic/sauceField.ts`,
`src/logic/referenceScoring.ts`, `src/logic/referenceMatching.ts`, `src/state/persistence.ts`,
`src/logic/economy.ts`, `src/state/gameReducer.ts`.

---

## 7. Tests

**New (24 tests across 3 files):**

- `src/data/playerReference.test.ts` (8 tests): a player reference exists for every recipe in
  `RECIPES`; sauce identity resolves to a real `category: "sauce"` ingredient; piece groups
  match `requiredIngredients` order/counts exactly; no colliding slot positions within a
  recipe; deterministic across repeated calls; Bismarck has a player reference despite
  `getReferencePizza("bismarck")` being `null`; Margherita's groups match its real
  mozzarella×3/basil×2 requirement; a scope-guard test pinning `getReferencePizza` still
  returns non-null only for `"margherita"`.
- `src/components/PlayerReferencePreview.test.tsx` (7 tests): dialog labeled with the recipe's
  own name (Bismarck); mozzarella renders via the shared `.pizza-cheese` visual; egg renders
  via the shared emoji visual; **no** `.reference-preview__bar-row` numeric bars render; the
  "not a scoring target" disclaimer renders; backdrop click closes; `renderTrigger={false}`
  suppresses its own inline button.
- `src/App.playerReference.test.tsx` (9 tests, real `App` end to end): mini reference visible
  during PREPARE (Margherita); tapping it opens the existing unchanged Margherita popover
  (still has its precision bars); closing leaves the mini reference in place; `RESET_PIZZA`
  preserves it; mini reference visible during PREPARE for Bismarck (no Scoring 2.0 fixture);
  tapping it opens the generic panel (no bars, has the disclaimer); `RESET_PIZZA` preserves it
  for Bismarck too; `RETRY_SAME_RECIPE` preserves it; selecting a different recipe from Pizza
  Select swaps the reference to the new recipe.

**Results:**

```
npm test        -> 52 test files, 919 tests passing (895 pre-existing + 24 new), 0 failing
npx tsc -b       -> clean
npm run lint     -> clean (oxlint)
npm run build    -> succeeds (dist/ produced, 313KB JS / 34KB CSS, gzip 100KB/7KB)
```

**Live verification (Playwright/Chromium, 390×844 and 360×800, this session):** see §3 above —
16 live checks per viewport (mini reference presence, no horizontal overflow, no CTA/tray
overlap, tap-to-expand for both Margherita and Bismarck, precision-bar presence/absence,
disclaimer presence, reset-preserves-reference), all passing at both viewports.

---

## 8. Scope guard

Confirmed untouched (grep + diff-stat review):

- **Scoring 2.0 coefficients/target geometry/authority:** `src/data/referencePizza.ts`
  (`MARGHERITA_REFERENCE`, `IDEAL_MARGHERITA_SAUCE_FIXTURE`, `getReferencePizza`) — zero
  edits. `src/logic/scoringV2/*` — zero edits. `referencePizza.test.ts`,
  `scoringV2.test.ts`, `malformedInput.test.ts` all pass unmodified — pinned again by this
  slice's own new scope-guard test in `playerReference.test.ts`.
- **Legacy scoring / stars / BEST / Pitz authority:** `src/logic/scoring.ts`,
  `src/logic/mastery.ts`, `src/logic/economy.ts`, `src/state/dex.ts` — zero edits.
- **Recipe requirements:** `src/data/recipes.ts` — zero edits (read-only, as the SSOT the new
  generator derives from).
- **Sauce/Cheese/Topping gesture mechanics:** `src/components/PizzaStage.tsx`,
  `src/components/IngredientTray.tsx`, `src/logic/pieceDrag.ts`,
  `src/state/gameReducer.ts`'s `PLACE_TOPPING`/`COMMIT_SAUCE_DISPENSE` — zero edits.
  `physicalDragEnabled`/`draggableIngredientIds` in `GameScreen.tsx` are still driven by the
  exact same `referenceModeEnabled` expression as before this slice.
- **Dough / Bake scoring:** untouched (no `doughShape`/`logic/bake.ts` file touched).
- **Save schema:** `src/state/persistence.ts` — zero edits; no new persisted field anywhere.
- **Economy:** `src/logic/economy.ts` — zero edits; `pitzBalance` stability across a
  same-recipe retry remains covered by Slice A's own pre-existing `App.test.tsx` assertion
  (unchanged by this slice).

**One intentional, documented behavior change:** the mini/expanded player reference now renders
during PREPARE regardless of `referenceModeEnabled` (i.e. it also now appears during Lunch Rush
Mission play, where Margherita's Reference was previously hidden entirely). This is purely
additive, informational UI — it exposes no new Scoring 2.0 data, adds no live score readout,
and does not change `SauceMetricsPanel` or physical-drag availability during Mission play
(both still gated on the unchanged `referenceModeEnabled`). This directly serves Issue #47's
own stated goal ("Making中に完成見本を常時小さく確認できる") without narrowing or widening any
existing scoring/gesture contract.

---

## 9. Remaining Issue #47 work

- **Slice C (Making controls):** still fully deferred, per the Fresh Audit's own
  recommendation — Finding I needs no code change (already correct, documented in the Fresh
  Audit); Finding J (Cheese/Topping drag scope) remains explicitly routed to Issue #37 M2,
  which already owns that system.
- **Issue #33 (Dough Shaping):** queued immediately after Issue #47's full Human Feel PASS,
  per `docs/PROJECT_HANDOFF.md`.
- This slice does not expand `draggableIngredientIds` or `physicalDragEnabled` beyond
  Margherita/mozzarella/basil — that stays Issue #37 M2's decision, unchanged here.
