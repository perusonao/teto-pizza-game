# Teto Pizza Game — Issue #32 Remaining Interaction Consistency — Fresh Audit

**Type:** READ-ONLY audit. No production code was changed to produce this report.

**Audited main SHA:** `6dced18c8bc0da93276c5fd0822eafa636853201` (Merge PR #43: Scoring 2.0
Recipe purity). Confirmed via `git fetch origin && git rev-parse origin/main` immediately
before this audit — matches the task's expected SHA exactly (verified byte-for-byte, not by
truncated inspection). This audit branch (`claude/issue-32-audit-26b8wz`) was reset to this
exact commit before reading any code.

Scope, per task: Issue #32's three remaining P2 items —

1. Sauce interaction parity (tomato / pesto / olive oil)
2. Olive-oil visibility
3. Tap vs drag contract

Current-main code is treated as authority over every prior report referenced below; where a
past report's claim and current code disagree, this document says so explicitly.

---

## 1. Sauce interaction parity

### 1.1 How it actually works today

`src/data/recipeSauceProfiles.ts` maps every one of the 7 recipes to exactly one required
sauce ingredient and an `interaction` kind (`PAINT` or `PAINT_TEMPORARY`):

| recipeId | sauce ingredient | interaction |
|---|---|---|
| margherita | tomato-sauce | PAINT |
| marinara | tomato-sauce | PAINT |
| bismarck | tomato-sauce | PAINT |
| funghi | tomato-sauce | PAINT |
| genovese | pesto | PAINT |
| quattro-formaggi | olive-oil | PAINT_TEMPORARY |
| fugazza | olive-oil | PAINT_TEMPORARY |

**Finding 1-A (confirmed, no defect): `PAINT` vs `PAINT_TEMPORARY` has zero behavioral
difference in current code.** Grepped across the whole `src/` tree: the only places
`PAINT_TEMPORARY` appears are the profile table itself, a catalog-shape test
(`recipeSauceProfiles.test.ts`), and a Scoring 2.0 test that explicitly pins "PAINT_TEMPORARY-
sourced deposits score identically to PAINT-sourced ones ... Sauce component reads only
SauceMetrics, never the interaction kind" (`scoringV2/scoringV2.test.ts:163`). `PizzaStage.tsx`
never reads `.interaction` at all — only `.ingredientId`. The distinction is a forward-looking
label (`// TODO: olive-oil -> DRIZZLE candidate`) for a not-yet-built line/amount-oriented
gesture, not a currently-active behavior fork. Today, painting olive oil, tomato sauce, and
pesto for their own recipe is **one identical code path**.

### 1.2 The shared pipeline (all three sauces, FREE and Lunch Rush alike)

`PizzaStage.tsx` gates on `wantsProfileDispense = isPaintMode && activeIngredient?.id ===
sauceInteractionProfile.ingredientId`. When that's true (the player has the recipe's own
correct sauce selected):

- `pointerdown` inside the dough starts a `SauceDispenseController` session and deposits one
  small "starter tick" immediately (`SAUCE_RATE_PER_TICK = 0.02`, `src/logic/sauceQuantity.ts`).
- `pointermove` never deposits by itself — it only records a timestamped path.
  `requestAnimationFrame`-driven `step()` deposits one fixed-size tick every `SAUCE_TICK_MS`
  (50ms) of real elapsed wall-clock time, interpolated along that path — so quantity is a
  function of hold duration, never of event count or frame rate.
- `pointerup` atomically commits the whole session's buffered deposits via one
  `COMMIT_SAUCE_DISPENSE` action (`gameReducer.ts:271`).
- The visible result for all three is the same 16×16 density-field heatmap
  (`buildSauceField`/`sauceFieldToRgbaPixels`, `src/logic/sauceField.ts`), rendered on a canvas,
  colored only by `sauceIngredient.color`.

`COMMIT_SAUCE_DISPENSE`'s reducer guard (`sauceProfile.ingredientId !== action.ingredientId →
reject`) is recipe-driven, and it is the **same guard, same call site, for FREE and Lunch
Rush** — `gameReducer.ts`'s comment states this explicitly ("FREE and Lunch Rush deliberately
share this same boundary and profile lookup"), and `src/state/onewayFlow.test.ts` runs its
entire SAUCE suite twice, parameterized over `["FREE", false]`/`["Lunch Rush", true]` (56
tests), asserting identical behavior. No FREE-only or Lunch-only sauce code exists anywhere in
`src/`.

**Conclusion: for the golden path (player has their recipe's own sauce selected), tomato,
pesto, and olive oil are fully at parity today** — same gesture semantics, same commit
lifecycle, same coverage/quantity/evenness math, same reset/stale-gesture safety
(`PizzaStage.sauceReset.test.tsx` explicitly covers tomato, pesto, and olive-oil reset-mid-
gesture cases), same FREE/Lunch Rush code path. This is a genuine improvement over the Issue
#32 report text, which was written against an earlier baseline before Phase 4A-1B.2 unified
all three sauces onto one dispense/rendering pipeline (see
`docs/reports/PIZZA_GAME_Phase4A-1B2_Sauce-Interaction-Parity_Result.md`).

### 1.3 Finding 1-B (new, confirmed defect): selecting a non-recipe sauce silently falls back to the legacy one-shot full-spread path

`IngredientTray.tsx`'s palette (`categoryItems = ingredientsByCategory(activeCategory)
.filter(owned)`, line 85) shows **every owned ingredient in the active category**, not just
the current recipe's required one. All three sauce ingredients (`tomato-sauce`, `olive-oil`,
`pesto`) have no `unlockCondition` (`src/data/ingredients.ts`) and are therefore in
`STARTER_INGREDIENT_IDS` — always owned, always visible in the SAUCE step's palette,
regardless of which sauce the current recipe actually requires.

If the player taps/drags a sauce ingredient that is **not** `sauceInteractionProfile
.ingredientId` for the current recipe (e.g. selecting pesto while making a Margherita),
`wantsProfileDispense` is `false`. `PizzaStage` never starts a dispense session for it. Both a
tap and a drag-release instead call `onTap` → `App.tsx`'s `handleTapPizza` →
`dispatch({ type: "APPLY_SAUCE", ... })` (`App.tsx:292-297`) — the pre-Phase-4A-1A **one-shot,
instant, full-pizza** path: `sauceIds: [ingredientId]`, `sauceDeposits: []`, rendered as the
flat `.pizza-sauce-layer` div animated by `@keyframes sauce-spread` (`clip-path: circle(0%) →
circle(150%)` in 380ms — the entire dough covered in well under half a second, unrelated to
where or how the player touched).

So the real, currently-reachable parity gap is not "tomato vs. pesto vs. olive oil" — it's
**"the recipe's own sauce" vs. "any other owned sauce"**: the former paints gradually with a
heatmap; the latter still behaves exactly like the pre-Phase-3A prototype (one tap/drag ⇒
instant 100% coverage). This applies identically to all three sauces (whichever one is "wrong"
for the recipe) and identically in FREE and Lunch Rush (both build round state through the same
`buildOrderState`, and neither restricts the palette by recipe).

- **Reachability:** real. Nothing in the UI prevents or warns before this selection; the
  palette offers the option every time.
- **Not tested:** `PizzaStage.sauceParity.test.tsx` only exercises the 3 profile-matched cases
  (margherita/tomato, genovese/pesto, quattro-formaggi/olive-oil) with the *correct* sauce
  pre-selected. No test exists anywhere for a mismatched sauce selection's resulting visual/
  interaction/scoring path.
- **Scoring impact:** none new — `APPLY_SAUCE` still sets `sauceIds` correctly, so Recipe/
  Purity scoring reacts to the wrong ingredient normally either way. This is a pure interaction-
  consistency/Human-Feel gap, not a scoring bug.

---

## 2. Olive-oil visibility

**Finding 2-A (confirmed defect, the headline finding of this audit): the CSS class the
current heatmap rendering path applies for olive oil does not exist.**

`PizzaStage.tsx:804` renders:

```tsx
className={`pizza-sauce-heatmap ${isOilSauce ? "pizza-sauce-heatmap--oil" : ""} ...`}
```

`grep -rn "sauce-heatmap--oil" src/App.css` returns **nothing**. There is no
`.pizza-sauce-heatmap--oil` rule anywhere in the stylesheet. Olive oil's heatmap canvas
therefore renders with exactly the same generic treatment as tomato/pesto — a flat, blurred
raster of `fieldSauceColor` (`#e9d9a0`) at the shared `densityToAlpha` curve
(`ALPHA_FLOOR = 0.46` to `ALPHA_CAP = 0.93`, `src/logic/sauceField.ts`) — with none of the
glossy-sheen highlight/shadow treatment that exists for olive oil elsewhere in the codebase.

That existing treatment — `.pizza-sauce-layer--oil` (`App.css:322-328`, radial-gradient
highlights + `box-shadow: inset 0 0 10px rgba(90,68,18,0.22)`) — was built for the **flat,
non-heatmap** `.pizza-sauce-layer` div. That div only renders when `!isFieldSauceContext`
(`PizzaStage.tsx:791`). `isFieldSauceContext` is `true` whenever the committed sauce matches
`sauceInteractionProfile.ingredientId` (`committedSauceUsesProfile`) — which, for
quattro-formaggi and fugazza in ordinary play, is **always** true once olive oil is applied via
the (now-standard, since Phase 4A-1B.2) dispense path. **The carefully-designed olive-oil gloss
CSS is dead code on the normal play path today** — it renders only in the Finding 1-B fallback
case (a mis-selected sauce), never for a correctly-applied olive oil.

**Finding 2-B (confirmed, compounding): olive oil's paint color is a near-match for the dough's
own background color.** `.pizza-dough`'s background is `radial-gradient(circle at 40% 35%,
#f3d9a4, #e2b876 85%)` (`App.css:201`) — a warm pale gold. Olive oil's ingredient color is
`#e9d9a0` (`ingredients.ts:53`) — also a warm pale gold, RGB-close to the dough
(`rgb(233,217,160)` vs. `rgb(226,184,118)`/`rgb(243,217,164)`). Tomato (`#c73b2e`, deep red)
and pesto (`#6b8e3d`, deep green) are both far in hue and luminance from the dough background
and read clearly even through the shared alpha curve; olive oil's color was never distinct
enough from the dough to begin with, and losing its dedicated highlight/shadow treatment
(Finding 2-A) removes the one thing that used to compensate for that.

**Net effect:** on current main, painting olive oil for quattro-formaggi/fugazza produces the
least visually distinct feedback of the three sauces, and it is measurably worse than the
game's own design history intended — a Human Feel Fix built specifically to solve "olive oil
is hard to see" (the `.pizza-sauce-layer--oil` gloss) was silently orphaned by the later Sauce
Interaction Parity change that moved all sauces onto the heatmap path, and nobody re-applied an
equivalent treatment to the new rendering target.

**Separation from scoring (per task's own guard):** this is entirely fixable as a presentation-
only change. `sauceFieldToRgbaPixels`/`densityToAlpha`/`buildSauceField` (the values
`computeSauceMetrics` and scoring read) are completely independent of the `className` on the
`<canvas>` element — a `.pizza-sauce-heatmap--oil` CSS rule (contrast boost via
`filter: saturate()/contrast()`, a border/inner-shadow, or a very light background gradient
behind the canvas) can be added without touching a single byte of `sauceField.ts` or any
scoring file. Confirmed no coupling exists between the two.

---

## 3. Tap vs drag contract

### 3.1 Sauce (spread ingredients) — current main's actual contract

For a **profile-matched sauce** (the golden path, §1.2): tap and drag are **not two different
code paths** — they are the same `SauceDispenseController` session, differentiated only by
duration. `DRAG_THRESHOLD_PX = 10` (`PizzaStage.tsx:38`) still exists in the gesture-state
bookkeeping, but it is irrelevant to sauce dispensing: `startDispenseSession` fires
unconditionally at `pointerdown`, before any movement is known. A "tap" (pointerdown →
pointerup with no meaningful movement) simply never lives long enough for `step()`'s
`requestAnimationFrame` loop to fire a full tick, so it only gets the one **starter tick**
deposited at `start()` (`SauceDispenseController.start`, `sauceDispenseController.ts:82-89`):
`amount = SAUCE_RATE_PER_TICK = 0.02` — about 2% of the full dispenser, a small dab, not a full
coat. A drag simply lets more ticks accrue over real elapsed time.

**This directly answers the issue's open question: current main's "tap" is NOT the old
prototype's one-shot full-spread for the recipe-correct sauce.** The code comment at
`sauceDispenseController.ts:76-80` is explicit about why a starter tick exists at all: "so a
quick tap ... still lays down a small dab of sauce, matching the pre-4A-1A 'tap applies sauce'
affordance, rather than requiring a deliberate hold to see anything happen at all" — i.e. tap
was *deliberately* preserved as a light, proportionate touch-up gesture, not eliminated and not
left at full-strength. This is intentional product design already implemented, not a
leftover prototype shortcut. `docs/data/hints.ts`'s copy for every recipe's empty-sauce hint
also only ever says 指でなぞって/なぞると (paint by tracing with your finger) — never
describes a one-tap "fill" action — consistent with drag-to-paint being the advertised primary
gesture and tap being an unadvertised, proportionate convenience.

**Caveat (ties back to Finding 1-B):** this only holds for the recipe-correct sauce. Tap *or*
drag-release on a mismatched sauce both still trigger the old full-100%-instant `APPLY_SAUCE` +
`sauce-spread` keyframe path — so "does tap fill the whole pizza?" currently has two different,
undocumented answers depending on whether the selected ingredient happens to match the recipe.

### 3.2 Cheese/topping (scatter ingredients) — current main's actual contract

For a non-spread (`placement: "scatter"`) ingredient selected in the tray, both tap and
drag-on-the-dough commit **exactly one piece, at exactly one point**, via the same `onTap` →
`PLACE_TOPPING` call:

- Tap (no drag threshold crossed): commits at the **start** point
  (`g.startDough`, `PizzaStage.tsx:571-574`).
- Drag (threshold crossed): commits at the **release** point only
  (`PizzaStage.tsx:577-584`) — explicitly documented as "Topping drag is out of scope for this
  phase: commit a single point at release, matching the previous click-based placement exactly
  (no multi-drop from a drag)". No trail, no incremental placement, no multi-piece drop from
  one drag.

This is a second, independent gesture family from the tray's own **physical drag-and-drop**
system (`IngredientTray.tsx`'s `physicalDragEnabled`/`DragSession`/`onPhysicalDrop`,
gated by `hasPieceDragIntent` in `src/logic/pieceDrag.ts`): pressing and dragging an
ingredient *chip in the tray itself* onto the dough is the actual "pick up from tray, carry,
drop" interaction Issue #37 describes (`GameScreen.physicalDragOverlay.test.tsx`,
`IngredientTray.physicalDragReset.test.tsx`). Dragging *on the dough* after tapping a tray
chip to select it (the code path above) is a narrower, single-drop reposition-before-release
gesture, not a full drag-and-drop. Both exist simultaneously today and are functionally
consistent with each other (both ultimately commit one `PLACE_TOPPING` per placement), but they
are two distinctly different physical motions a player could reasonably expect to behave the
same way and don't fully — this is a real but low-severity Human-Feel nuance, not a defect
(pinned intentionally, not accidentally, per the comment above).

### 3.3 Keyboard/accessibility path

`isKeyboardPlaceable = interactive && !isPaintMode` (`PizzaStage.tsx:373`) intentionally removes
the dough from the tab order entirely while a spread (sauce) ingredient is selected — `Enter`/
`Space` on a `SPREAD` ingredient would otherwise silently dispatch a center-point `APPLY_SAUCE`
without populating `sauceDeposits`, desyncing the Reference/heatmap visual from what
scoring/metrics would see. This is documented as a deliberate trade-off (PR #26 Final P2
Follow-up #2) rather than a bug: scatter (TAP_PLACE) toppings keep full keyboard support
(`onTap(50, 50)` center placement, `event.repeat` guarded against auto-repeat double-placement);
sauce painting has no keyboard-equivalent gesture today. This remains an open accessibility gap
for sauce specifically, already known and explicitly out of this audit's fix scope (tracked
separately per Issue #27, listed as parallel/non-blocking in `PROJECT_HANDOFF.md`).

### 3.4 Multi-touch / stale-gesture safety (applies uniformly to tap and drag, all sauces)

Confirmed unchanged and correct: `gestureRef.current.pointerId !== null` blocks a second finger
mid-gesture (first finger wins); reset (`resetToken`), making-step confirmation
(`makingStepToken`), an ingredient swap mid-hold, `blur`/`visibilitychange`, `pointercancel`,
and `lostpointercapture` all abort an in-flight session (discard, never commit) via the shared
`abortActiveGesture()`. `PizzaStage.sauceReset.test.tsx` and `onewayFlow.test.ts` cover this for
all three sauces and both FREE/Lunch Rush.

---

## 4. FREE / Lunch Rush comparison summary

No sauce- or tap/drag-specific FREE-vs-Lunch-Rush divergence exists anywhere in `src/`:

| Axis | FREE | Lunch Rush | Divergence? |
|---|---|---|---|
| Sauce profile lookup | `getRecipeSauceProfile(state.recipe.id)` | same | No |
| `COMMIT_SAUCE_DISPENSE` gate | same reducer case | same reducer case | No |
| `APPLY_SAUCE` fallback (Finding 1-B) | reachable | reachable | No — same bug, same reach |
| Tap/drag threshold, keyboard gating | `PizzaStage.tsx`, shared | same | No |
| `makingStep`/one-way flow | `buildOrderState` | `buildOrderState` (via `nextMissionOrderState`) | No |
| Tests | `onewayFlow.test.ts` parameterizes both explicitly | | 56/56 identical assertions both ways |

---

## 5. Sauce / tap-drag parity matrix

| Sauce | Input (golden path) | Visual | Commit | Reset | Scoring | FREE | Lunch | Difference from others |
|---|---|---|---|---|---|---|---|---|
| tomato-sauce | tap = 1 starter tick (0.02); drag = time-based ticks | 16×16 heatmap, `#c73b2e`, high contrast vs. dough | `COMMIT_SAUCE_DISPENSE`, atomic | full abort/discard on reset/step-confirm/cancel/blur | Sauce component (Shadow) reads `SauceMetrics` only | identical | identical | none (reference case) |
| pesto | same | same heatmap, `#6b8e3d`, high contrast vs. dough | same | same | same | identical | identical | color only |
| olive-oil | same | same heatmap, `#e9d9a0`, **near-zero contrast vs. dough, no gloss CSS applied (Finding 2-A/2-B)** | same | same | same | identical | identical | **visibility only — mechanic is identical** |
| any sauce, wrong for recipe | tap or drag-release ⇒ single `APPLY_SAUCE`, instant | flat layer, `sauce-spread` 0%→150% clip-path, 380ms | one-shot `APPLY_SAUCE` | reset clears normally (different code path, not separately audited for staleness — see §7 gap) | Recipe/Purity score the wrong ingredient normally | reachable | reachable | **entire mechanic differs (Finding 1-B)** |

---

## 6. Making Game 2.0 (#33 / #37) dependency

Read directly from GitHub (not from stale notes):

- **Issue #37's own M0 gate explicitly lists** "touch drag vs tap policy を確定" and "#32 P1
  Human Feel consistency を解決" as **prerequisites** for M1 (Dough Shaping prototype) to even
  begin. It is not the other direction — #37 does not plan to absorb or re-decide these items
  later; it is *waiting* on #32 to settle them.
- Issue #37 §2 (SAUCE) says explicitly: "既存 physical painting を基盤として継続" (continue
  using the existing physical painting as the foundation) — the current dispense/heatmap
  mechanic audited in §1–§3 above is the thing Making Game 2.0 intends to build on, not replace.
  Fixing it now is not throwaway work.
- Issue #37 §3 (CHEESE/TOPPING) says "Touch tap placement の扱いは #32 で決定" — again, #32 is
  the authority for tap policy, #37 consumes that decision.
- Issue #33 (Dough Shaping) is entirely upstream of SAUCE in the flow (`DOUGH → SAUCE → ...`)
  and has no overlap with sauce/tap-drag mechanics at all — it is unaffected either way by this
  audit's findings.

**Conclusion: none of this audit's findings should be deferred into #33/#37.** They gate #37's
own M0 checklist by the parent issue's own words, and the sauce mechanic being fixed is
explicitly the one #37 plans to keep. Deferring would mean #37 M0 stays blocked and any interim
player-facing confusion (Findings 1-B, 2-A/2-B) persists into and through Dough Shaping
development for no benefit — there is no "M0 will naturally replace this" case here, unlike
(for example) BAKE-step visual work, which #37 M3 genuinely does plan to redesign from
scratch.

---

## 7. Existing test coverage and gaps

**Covered (confirmed by reading each file, not by name alone):**

- `PizzaStage.sauceParity.test.tsx` — 3 profile-matched recipes (margherita/tomato,
  genovese/pesto, quattro-formaggi/olive-oil), pointerdown+move+up (drag), commit path only.
- `PizzaStage.sauceReset.test.tsx` — tomato/pesto/olive-oil reset-mid-gesture (stale pointerup
  after `RESET_PIZZA`), Lunch Rush pesto reset, pointercancel/lostpointercapture/blur/
  visibilitychange after reset.
- `recipeSauceProfiles.test.ts` — catalog shape (7 recipes, correct ingredient/interaction
  per recipe).
- `sauceField.test.ts`, `sauceQuantity.test.ts`, `sauceDispenseController.test.ts` — pure-logic
  coverage of the field/tick-math/controller, sauce-agnostic (color/ingredient never enters
  these).
- `gameReducer.commitSauceDispense.test.ts` — reducer-boundary guards (phase, makingStep,
  profile-ingredient match, ownership, malformed deposit batch).
- `onewayFlow.test.ts` — 56 tests, FREE×Lunch Rush parameterized, SAUCE/CHEESE/TOPPING step
  gating, stale-event rejection after step confirmation, `RESET_PIZZA` determinism.
- `scoringV2/scoringV2.test.ts` — PAINT vs. PAINT_TEMPORARY score identically (pins Finding
  1-A's "no behavioral difference" as a scoring-level guarantee too).

**Gaps (none added this session — audit-only, per task instruction):**

1. **No test for a pure tap (pointerdown→pointerup, zero movement) on the recipe-correct
   sauce**, for any of the 3 sauces — existing parity tests always include a `pointerMove`.
   Should assert the starter-tick-only, small-dab outcome (§3.1).
2. **No test at all for Finding 1-B** (selecting a sauce that doesn't match
   `sauceInteractionProfile.ingredientId` and tapping/dragging it) — the single largest gap
   this audit found; the current fallback-to-`APPLY_SAUCE` behavior is entirely unpinned and
   could silently regress (or silently "fix" itself) without any test noticing.
3. **`PizzaStage.sauceParity.test.tsx` only covers 3 of 7 recipes** — marinara/bismarck/funghi
   (tomato-sauce) and fugazza (olive-oil, the second `PAINT_TEMPORARY` recipe) have no direct
   component-level dispense-parity assertion, only the catalog-shape check in
   `recipeSauceProfiles.test.ts`.
4. **No visual/contrast regression test for olive-oil heatmap rendering** — reasonable, since
   this repo has no pixel/screenshot test harness; noted so a future fix's CSS-only nature is
   verified by rendering, not by a unit test.
5. **No reset/stale-gesture test for the Finding 1-B (`APPLY_SAUCE`) fallback path** — only the
   profile-dispense path's reset safety is covered by `PizzaStage.sauceReset.test.tsx`; the
   legacy one-shot path's own reset behavior was not independently verified in this audit
   (code reading suggests it's fine — `APPLY_SAUCE` is a single synchronous dispatch with no
   held gesture state to leak — but it has no explicit regression pin).
6. **No topping tap-vs-drag-release equivalence test** — nothing currently pins "tap commits at
   start point, drag commits at release point, both are single-drop" as an intentional,
   regression-proof contract (§3.2).

---

## 8. Priority classification

| # | Finding | Classification | Rationale |
|---|---|---|---|
| 1-A | Sauce mechanic parity (tomato/pesto/olive-oil, golden path) | **No change needed** | Already fully unified since Phase 4A-1B.2; confirmed by code and by a dedicated scoring-identity test. |
| 1-B | Wrong-sauce selection falls back to legacy instant full-spread | **P1 — fix before Making Game 2.0** | Real, reachable in FREE and Lunch Rush both, completely undocumented and untested, produces a jarring "why did this suddenly cover the whole pizza instantly" moment that directly contradicts the newly-consistent golden-path feel. Fix is small: either restrict the palette to the recipe's required sauce during the SAUCE step, or route `APPLY_SAUCE`'s spread ingredients through the same dispense/heatmap path regardless of profile match. |
| 2-A/2-B | Olive-oil visibility (no CSS rule applied, near-dough color) | **P1 — fix before Making Game 2.0** | Directly matches Issue #32's own stated P1/P2 acceptance criteria ("painted vs. unpainted area is clearly distinguishable on iPhone at normal brightness"); confirmed currently failing by reading the actual rendered class/color/background values; a former dedicated fix for this exact problem is now dead code. Presentation-only fix, provably separable from scoring (§2). |
| 3.1 | Tap = small dab, not full spread, for golden-path sauce | **No change needed** | Already correctly implemented and intentional; resolves the issue's own open question in the desired direction. |
| 3.2 | Topping tap (start point) vs. drag-release (release point) vs. tray-physical-drag (3 distinct gesture behaviors) | **P2 — polish** | Internally consistent and intentional per code comments; a nuance worth clarifying in a future Human Feel pass but not confusing enough to block progress, and it is squarely inside Making Game 2.0's own CHEESE/TOPPING scope (§6) — the tray-drag system already exists and is the real target for that flow. |
| 3.3 | No keyboard/accessibility gesture for sauce painting | **P2 — polish, tracked separately** | Pre-existing, documented, deliberate trade-off; already tracked under Issue #27 / PROJECT_HANDOFF's parallel/non-blocking list — not new to this audit. |
| §7 gaps 1–3, 6 | Test coverage gaps (pure tap, Finding 1-B, 4 untested recipes, topping tap/drag contract) | **P1 — add alongside the 1-B/2-A fixes** | Cheap to add in the same slice as the code fixes; gap #2 in particular is the regression guard the 1-B fix needs to not silently break again. |
| §7 gaps 4–5 | Visual regression harness, legacy-path reset test | **P2 — polish** | No existing harness for the former; the latter's risk is low per code reading. |

**Nothing in this audit rises to P0.** Nothing here breaks the making loop, corrupts state, or
blocks BAKE/RESULT — both findings are Human-Feel/consistency issues with a well-understood,
narrow, low-risk fix.

---

## 9. Recommendation per item

| Item | Decision |
|---|---|
| Sauce interaction parity (golden path) | **D. No change required.** Already fixed by a prior phase; this audit just confirms and documents it. |
| Sauce interaction parity (wrong-sauce fallback, Finding 1-B) | **A. Fix in Issue #32 first.** Small, self-contained, blocks #37 M0's "touch drag vs tap policy" gate from being genuinely settled while an undocumented second contract exists. |
| Olive-oil visibility (Finding 2-A/2-B) | **A. Fix in Issue #32 first.** This is the item Issue #32 named explicitly; it is currently broken; it is a CSS-only, scoring-decoupled fix; #37 explicitly plans to keep the sauce-painting foundation this sits on. |
| Tap vs drag (sauce, golden path) | **D. No change required.** Confirmed already resolved correctly. |
| Tap vs drag (toppings, 3-gesture nuance) | **C. Current state acceptable; revisit inside #37's own CHEESE/TOPPING slice (M2)**, since that slice already plans to audit "cheese/topping の exact placement" end to end. |
| Keyboard/accessibility sauce gap | **C. Current state acceptable for now; remains Issue #27's separately tracked item.** |

---

## 10. Next implementation slice (2–3 hour Claude Code task)

**Title:** Issue #32 — Sauce off-recipe fallback consistency + olive-oil heatmap visibility.

**Files:**
- `src/components/IngredientTray.tsx` or `src/App.tsx` (Finding 1-B — pick one: either filter
  the SAUCE-step palette to the recipe's required sauce ingredient only, which also removes a
  confusing "why would I pick the wrong one" affordance entirely, or make `wantsProfileDispense`
  independent of `sauceInteractionProfile.ingredientId` so *any* spread ingredient uses the
  dispense/heatmap path — the former is smaller and likely the right product call given the
  palette already exists to let players make deliberate recipe mistakes for Recipe/Purity
  scoring elsewhere; needs an explicit product decision, not a silent pick, since it changes
  what a mis-selection feels like for the first time since Phase 3A).
- `src/App.css` (Finding 2-A/2-B — add a `.pizza-sauce-heatmap--oil` rule: a contrast boost
  via `filter: saturate()/contrast()` and/or a subtle highlight overlay layered behind or
  blended with the existing canvas, tuned against the dough's `#e2b876`/`#f3d9a4` background;
  must not touch `sauceField.ts`/`densityToAlpha`/anything scoring reads).
- `src/components/PizzaStage.sauceParity.test.tsx` (extend to all 7 recipes; add a pure-tap
  case per sauce).
- A new test file or extension covering Finding 1-B's chosen fix (either "palette never offers
  a non-recipe sauce during SAUCE step" or "a non-recipe sauce still uses the dispense path and
  is rejected by `COMMIT_SAUCE_DISPENSE`'s existing profile guard, same as today, with no
  visual regression").

**Explicitly out of scope for this slice:** DOUGH (Issue #33), the tray-physical-drag vs.
on-dough-drag nuance (§3.2, defer to #37 M2), keyboard sauce painting (Issue #27), any DRIZZLE-
family redesign of olive oil's gesture (the `TODO` in `recipeSauceProfiles.ts` — this slice
fixes visibility of the *existing* PAINT_TEMPORARY mechanic, it does not build a new one),
Scoring 2.0 authority, save schema, economy.

**Preview review scenario** (390×844, real device, once implemented):
1. Margherita: paint tomato-sauce with a single tap, confirm a small visible dab (not full
   coverage); then a short drag, confirm gradual incremental coverage.
2. Genovese: same two gestures with pesto; visually compare dab size/contrast against #1 —
   should read the same.
3. Quattro Formaggi: same two gestures with olive-oil; confirm the painted area is now clearly
   distinguishable from bare dough at both a single dab and after a full coat, at normal
   brightness — this is the primary pass/fail check for Finding 2-A/2-B.
4. Margherita again: deliberately select pesto or olive-oil during the SAUCE step and tap/drag
   it. Confirm the new, chosen, consistent behavior (either the ingredient is no longer
   offered, or it now paints gradually like the correct sauce) — there should no longer be an
   instant, undocumented full-pizza fill.
5. Lunch Rush: repeat step 3 (olive-oil visibility) once in Lunch Rush to confirm no
   FREE-only regression.
6. RESET mid-gesture for each of steps 1–4, confirming the pizza returns to bare dough and a
   fresh gesture works normally afterward (regression check against
   `PizzaStage.sauceReset.test.tsx`'s existing guarantees).

---

## Final Verdict

**A. FIX ISSUE #32 BEFORE DOUGH**

Two concrete, confirmed, currently-reachable Human-Feel defects exist on current main — the
off-recipe sauce fallback (Finding 1-B) and olive-oil heatmap visibility (Finding 2-A/2-B) —
and Issue #37's own M0 gate depends on #32's tap/drag and consistency questions being genuinely
settled before Dough Shaping starts, not deferred into it. Both fixes are small, self-contained,
CSS/palette-level changes with no scoring or persistence coupling, fit comfortably in one
2–3 hour slice (§10), and are strictly cheaper to fix now than to carry forward as known-broken
foundation into Making Game 2.0's own SAUCE section (which explicitly plans to keep, not
replace, the current painting mechanic). Every other item audited (golden-path sauce parity,
golden-path tap behavior, the keyboard gap, the three-gesture topping nuance) is either already
correct or is squarely Making Game 2.0's own CHEESE/TOPPING slice's job to revisit — those do
not block progress.

- **Audited SHA:** `6dced18c8bc0da93276c5fd0822eafa636853201`
- **Verdict:** A. FIX ISSUE #32 BEFORE DOUGH
- **Sauce parity truth:** golden path (recipe-correct sauce) is fully unified across tomato/
  pesto/olive-oil already; the real gap is a wrong-sauce selection silently reverting to the
  old instant full-spread mechanic (Finding 1-B), reachable in both FREE and Lunch Rush.
- **Olive-oil truth:** currently broken — the CSS class applied to its heatmap canvas
  (`.pizza-sauce-heatmap--oil`) has no rule, and its paint color is a near-match for the dough's
  own background; a prior dedicated fix for this exact problem is now dead code on the normal
  play path (Findings 2-A/2-B).
- **Tap behavior truth:** for the golden-path sauce, tap already deposits a small proportionate
  dab (not a full-pizza fill) — this is intentional, already-correct, already-shipped behavior,
  not a leftover prototype shortcut; only the off-recipe fallback (1-B) still behaves like the
  old prototype.
- **P1:** Finding 1-B (off-recipe sauce fallback), Finding 2-A/2-B (olive-oil visibility),
  associated test gaps (§7 #1–3, #6).
- **P2:** topping tap/drag/tray-drag three-gesture nuance (defer to #37 M2), keyboard sauce
  gap (Issue #27, unchanged), visual regression harness / legacy-path reset test (§7 #4–5).
- **Issue #33/#37 dependency:** #37's own M0 checklist lists "#32 P1 Human Feel consistency"
  and "touch drag vs tap policy" as prerequisites to starting Dough Shaping (M1); #37 §2
  explicitly says SAUCE continues on the existing physical-painting foundation. Nothing in this
  audit should be deferred into #33/#37 — fixing it now is exactly what #37 is waiting on, not
  duplicate work.
- **Next slice:** §10 above (2–3 hours) — off-recipe sauce fallback decision + olive-oil
  heatmap CSS + parity/tap test coverage for all 7 recipes.
- **Report:** `docs/reports/TETO_ISSUE-32_INTERACTION-CONSISTENCY_Fresh-Audit.md` (this file).
- **PR:** opened against `main` from `claude/issue-32-audit-26b8wz`, docs-only, no production
  code changed.
