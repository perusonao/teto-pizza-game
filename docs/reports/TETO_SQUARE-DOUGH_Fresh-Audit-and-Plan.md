# Square-Pan Dough (Grandma Pizza) — Fresh Audit and Implementation Plan

Status: **READ-ONLY audit + plan. No `src/**`, recipe, save or Design Lock change.** Not merged, not deployed, no shared Preview touched.
Base: `origin/main` `608e65b`. Parent: #521 (Multi-Sauce Recipes). Related: #474, #429, #467, #531, #529.

> **Update (2026-10-17):** this audit is the starting record. Owner decisions D1–D7 and O-1…O-7, Option 4 (pan as the Technique 「天板焼き」), the new Issue F (#538) and the issue numbers (Epic #532, Q0 #533, A #534, B #535, C #536, D #537) are in `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` (rev.3), which takes precedence. The text below is kept as written.

## 0. Owner decision (recorded, 2026-10-17)

Grandma pizza gets its own square-pan dough step, with different controls from the round pizza:

1. Spread dough with a finger (tap / long-press).
2. Pull the dough edge out to the four corners (drag).
3. Show corner reach and thickness evenness visually.
4. Square pan, dough, sauce, toppings, bake and RESULT all consistent.

## 1. Current state of #521

- S1 (#524, oil over tomato, #502 test) and S2 (#525, `buildHintLine` checks every sauce) are **merged**. Design Lock + Fresh Audit are on main (#528).
- **S3 (`grandma-pizza` recipe) is not started.** `grep grandma src` only hits the synthetic fixture in `logic/multiSauce.guards.test.ts`.
- No open Issue/PR covers square dough, pan shape or a grandma-specific dough step (searched issues and PRs for グランマ / 四角 / 天板 / square / grandma / sheet pan: 0 hits).

## 2. Conflict with the existing Design Lock

`TETO_MULTI-SAUCE-RECIPES_Design-Lock.md` §2 states: *"Dough form (round, not sheet pan) is a documented simplification"*, and `TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md` lists the sheet-pan form as "unevidenced / not modelled". The Owner decision above **supersedes that line**. I have **not** edited the Design Lock. Needed: an Owner-approved addendum (see §7, Issue Q0), and S3 must not ship a round grandma in the meantime unless the Owner wants an interim.

Everything else in the Design Lock (S1/S2 done, key-free, `ladderCredit:false`, `lunchRush:false`, CUT excluded, olive-oil presence-only, DH4 gate re-run) is unaffected by pan shape.

## 3. Existing dough implementation (what is reused vs. what collides)

| Area | Fact (file) | Impact on square dough |
|---|---|---|
| Coordinates | Everything is 0–100 percent of the `.pizza-dough` box, centre 50, radius 48 (`logic/pizzaCoordinates.ts`). `isInsideDough`/`clampToDough` are circular. | Square needs an **explicit shape-aware inside/clamp**; the box itself can stay the same square, so the coordinate space does not change. |
| Dough model | `PizzaState.doughShape = { radii[8] }` radial, drag-from-centre, bidirectional (D3A), bounds 10–58 (`logic/doughShape.ts`, `state/pizzaState.ts`). `applyStretchPoint` is radial. | Radial 8-point cannot express a rectangle with corners. Square needs a **different model**, not a parameter tweak. |
| Gesture | `PizzaStage.tsx` DOUGH branch: pointerdown applies a stretch point immediately; pointerup commits; guide ring `dough-target-guide` is a circle. | Tap/long-press/drag need a new branch beside it. Existing branch must stay byte-identical for round. |
| Completion | `doughSizeProgress` mean radius / 48 ≥ 0.75, size-only (`isDoughShapeComplete`); `doughSizeStatus` SMALL/READY/LARGE UI (#474). | New completion = corner reach + evenness, behind a separate predicate. |
| Sauce | `isInsideDoughShape` / `isCellInsideDoughShape` already follow the player's shape (Sauce Free Boundary); `SAUCE_TARGET_RADIUS` circle used for scoring `edgeAmount`/guide ring. | Painting boundary can follow a new shape if routed through one shape interface. **Reference/target area for scoring is circular** (`getReferencePizza`, `SAUCE_TARGET_RADIUS`) — square needs a square target or grandma scores wrong. |
| Toppings / cheese | `isInsideDough` circle in the reducer (drop validity, `clampToDough`), cheese pool `CheesePoolCanvas`, cut footprints. | Drop validity and cheese melt region need the shape interface. |
| BAKE / RESULT | CSS `border-radius: 50%` on `.pizza-dough` (App.css:243), `clip-path: circle(...)` on paint trail/guides/overlays (App.css:477–537), `.pizza-dough-shape` clip-path. Bake filters sit on `.pizza-dough` (#518 area). | Many CSS circle clips. Highest regression surface; shared with #518/#517 bake-filter work. |
| CUT | Edge-to-edge chords, `evaluateCutState(cutState, doughShape)`, regions built from the circle (`logic/cut/*`). #429 already open: CUT counts regions outside shrunk/distorted dough using the ideal circle. | **Out of scope for grandma** (Design Lock: no CUT). Square must disable CUT so the round contract is untouched; #429 should not be widened. |
| Save | `PersistentSaveV2` holds dex, pitz, ownership, inventory, ledgers, missionBest. **In-progress `PizzaState` / `doughShape` is not persisted.** | **Save compatibility risk is low.** New data = recipe in the catalogue (derived) + per-attempt state only. No schema bump needed unless Dex stores a result thumbnail from pizza geometry (verify in step A: `PizzaThumbnail`, `ReferenceThumbnail`, Dex `bestScore` paths). |
| Reference preview / thumbnails | `ReferencePreview`, `ReferenceThumbnail`, `PlayerReferencePreview`, `PizzaThumbnail` draw round pizzas. | Must render a rectangle for grandma in Recipe Select / Dex / RESULT. |

## 4. Duplication and contract checks

- **#474 Dough Shaping Human Feel 2.0 (open)** audits the *round* gesture's feel. Square-pan gesture work must not edit the round `applyStretchPoint` or `doughSizeStatus` while #474 is in flight. → keep square in separate modules; sequence the shared `PizzaStage.tsx` DOUGH branch change after #474 lands or rebase explicitly.
- **#518 / #517 FINISH D2** touch `PizzaStage.tsx` and bake filter CSS. Square CSS must not edit those blocks; touch order: land after #518 or keep the diff outside them.
- **#429 / #467 (CUT)** unaffected as long as grandma has no CUT; do not fold into this work.
- **Anti-Oracle (2.1)**: corner reach / evenness UI is a *player-facing process aid* on the player's own dough. It must not reveal recipe identity (e.g. a square outline shown before the recipe is chosen/discovered in Research or Free Cooking). In Free Cooking / Research the pan shape is a **recipe-identifying fact**: decide whether the square pan appears only after the recipe is known (see Q2). This is the most important contract question.
- **Hint 5.0 / Discovery**: pan shape is not an ingredient; the matcher is unchanged. No new rung unless Owner wants "pan" hinted.
- **HV Policy**: every UI/gameplay slice needs the 390×844 video (delivered to the Owner, never committed) + before/after screenshots under `docs/reports/screenshots/<task>/`.

## 5. Quality conditions → design implications

| Condition | Design response |
|---|---|
| 390×844 and 360×800 playable on iPhone Safari | Pan fills the existing stage width; corner hit areas ≥ 44 px visual, zones sized by **percentage of the stage**, not px. Verify on both viewports and WebKit projects (`webkit-360x800` exists in `playwright.config.ts`). |
| Round pizza controls unchanged | Shape-strategy interface; round implementation = existing functions, unchanged. Golden test: all 57 existing recipes byte-identical for dough, scoring, render. |
| Existing saves unchanged | Per-attempt state is not persisted; add no schema field in A–C. Confirm with `persistence.test.ts` fixtures. |
| No unnecessary precision at corners | Corner counts as reached within a generous radius (proposal: ≥ 85% of the way to the corner, tunable, shown with a soft "pull" assist); no need to touch exact pixels. |
| Tap and drag have distinct meaning | **Tap / long-press = spread thickness** (thins the pressed area, grows coverage, no edge movement). **Drag = move the edge toward a corner** (changes extent, not thickness). Each shows its own feedback. |
| No unnecessary waiting | Tap applies on pointerdown; long-press is *continuous spreading with visible progress*, not a hold-to-confirm delay (the round step is already immediate). No added timers on CTA. |
| Verification | WebKit (Playwright), Codex review, Owner device HV on iPhone. |

## 6. Proposed PR split

Dependency chain: **Q0 → A → (B ∥ partly D-prep) → C → D → E**. Each PR is independently green and leaves round behaviour untouched.

| PR | Scope | Depends on | HV | Notes |
|---|---|---|---|---|
| **Q0 (docs)** | Design Lock addendum: pan shape supersedes round simplification; Owner answers to §8. Also records interaction spec and Anti-Oracle rule. | Owner | No | Docs-only. Blocks everything. |
| **A — Shape foundation** | `PanShape` ("round" \| "square") on recipe/cooking profile (default round); shape-strategy interface (`contains`, `clamp`, `bounds`, `targetArea`); square implementation; round = existing functions; golden parity test for 57 recipes. No UI. | Q0 | No (no visible change) | Includes stage-box and CSS-clip audit table so D knows every circle clip. Square dough model: coverage grid (e.g. 12×12 cells, thickness per cell), **not** radial points. |
| **B — Tap / long-press spread** | Square DOUGH step: finger spreads thickness in a circular brush, grid updates, thickness heat shown; separate component/branch, round branch untouched. | A, ideally after #474 | **Yes** (video + screenshots, 390×844 & 360×800) | Behind a recipe flag; no recipe uses it yet, reachable via DEV/Preview fixture only. |
| **C — Corner drag + completion** | Drag from edge toward corner; corner-reach indicators; evenness readout; completion predicate (4 corners reached ∧ evenness ≥ threshold); "次へ" gating; tolerant corner zones. | B | **Yes** | Thresholds are tuning values for Owner HV, not final. |
| **D — Square downstream** | Sauce painting boundary + square sauce target (scoring), cheese/toppings drop validity, bake overlay/filter, RESULT, thumbnails/preview, CUT disabled for square. Split if >~600 lines: D1 sauce+toppings+cheese logic, D2 render (BAKE/RESULT/thumbnails). | A, C | **Yes** (D2) | D2 is where the #518 bake-filter overlap lives. |
| **E — Apply to grandma (= #521 S3)** | `grandma-pizza` recipe (tomato 1 / olive-oil 1 / mozzarella 3 / garlic 2), `panShape: "square"`, DH4 gate re-run + allowlist, count-pinned tests, `ladderCredit:false`, `lunchRush:false`, normal-flow E2E, full WebKit + Owner device HV. | A–D + Owner §8 answers | **Yes** | Only PR that changes player-visible recipe count. |

Cross-cutting: every UI slice gets Playwright specs at 390×844 and 360×800 on Chromium + WebKit (existing projects). The known intermittent WebKit 360×800 failures (#529, #531) are unrelated but will show up as noise; do not mask them (no skipped tests).

## 7. Proposed Issues (not created — awaiting Owner go)

| Draft | Title | Body gist |
|---|---|---|
| Q0 | Square-pan dough: Owner decisions + Design Lock addendum (#521 follow-up) | §0, §2, §8. Blocks A–E. |
| Parent | Square-Pan Dough Epic (grandma-pizza) | Tracks A–E, dependencies, #474/#518/#429 interactions. Sub-issues A, B, C, D, E. |
| A–D | One Issue each with acceptance criteria from §5/§6 | |
| E | = existing #521 S3 (reuse, retitle comment; do not open a duplicate) | |

#521 itself should only get a comment pointing to the Epic and noting S3 now depends on A–D; do not put the square-dough work inside #521.

## 8. Owner questions (need answers before A can be locked)

1. **Q1 Scope of "square"**: grandma-pizza only, or a reusable `panShape` for later recipes (Detroit, Sicilian, sheet-pan)? Recommendation: reusable field, grandma only for now.
2. **Q2 Anti-Oracle**: in Free Cooking / Research, does the square pan appear from the start (reveals "a sheet-pan recipe exists") or only once the recipe is discovered/selected? Recommendation: pan chosen as a *recipe-select-time fact only for known recipes*; hidden shape in discovery until Dex entry exists.
3. **Q3 Round fallback for non-owners**: until A–D ship, should S3 stay unmerged (recommendation) rather than shipping a round grandma?
4. **Q4 Thickness**: is thickness evenness a scored quantity (affects score/stars) or a visual-only readiness aid? Recommendation: gate completion only; no new scoring in this epic (no Scoring 2.0 change).
5. **Q5 Corner tolerance**: accept "≥85% of the way to each corner, with assist" as the starting value?
6. **Q6 Pan RESULT look**: pan visible at RESULT, or pizza only?
7. Existing S3 questions (§8 of Design Lock: PIZZA DB check of grandma, `ladderCredit:false`, name/id) still open.

## 9. Risks

- **Largest:** CSS circle clips (`border-radius: 50%`, `clip-path: circle(...)`) in D2 and overlap with #518 bake-filter work.
- Scoring reference/target is circular; getting square target wrong silently mis-scores grandma → needs its own Reference test, not reuse.
- Gesture overlap with #474 in `PizzaStage.tsx`.
- Radial 8-point cannot be stretched into a rectangle; attempting that would degrade the round feel — hence a separate model.
- iPhone Safari long-press: suppress text selection / callout / context menu on the dough surface (`-webkit-touch-callout`, `user-select`, `touch-action: none`); must be proven on WebKit, not only Chromium.

## 10. Not done in this stage

No code, no Issues created, no Design Lock edit, no Preview deploy, no merge. Required HV (video/screenshots) begins at PR B.
