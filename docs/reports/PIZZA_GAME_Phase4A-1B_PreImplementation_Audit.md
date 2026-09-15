# PIZZA GAME Phase 4A-1B Pre-Implementation Audit

## 0. Executive summary

**FINAL VERDICT: B. READY WITH MINOR DESIGN CHANGES**

PR #21の物理iPhone Human Feel PASSは、Phase 4の中心をphysical makingへ置く十分な根拠である。Mozzarella/Basilは現architectureの`PlacedTopping`、normalized dough coordinate、`PLACE_TOPPING`、`findOpenSpot`、Reference/shadow boundaryを再利用して実装できる。Scoring 2.0やsave migrationは不要である。

必要なminor design changesは次の4点。

1. `DRAG_PLACE`を新catalog familyにせず、`TAP_PLACE`の`DRAG_FROM_TRAY` input variantとする。
2. prototype countを現行Margherita requirementと同じMozzarella 3 / Basil 2に固定する。
3. 4A-1B matchingはminimum-distance Hungarian + forgiving falloffだけにし、radial/angular/spacingを延期する。
4. 実装開始時にPR #21を含むbaselineを固定し、PR #25が統合済みなら`GameScreen`へ配線する。

No production code, commit, push, merge, PR mutation, or `PROJECT_HANDOFF.md` change was made in this audit.

## 1. Fresh GitHub state

Checked at 2026-09-15 14:49 JST / 05:49 UTC. 過去レポート記載SHAではなくGitHub APIからfresh取得した。

### main

| Item | Result |
|---|---|
| HEAD | `45362e210a3e99ecc949706e9d007bf42e558881` |
| Commit time | 2026-09-14 15:44:22 UTC |
| Local checked-out HEAD | same SHA |

### PR #21

| Item | Fresh result |
|---|---|
| Title | Phase 4A-1A: Reference Sauce Quantity Prototype (Margherita tomato sauce) |
| State | OPEN, non-draft |
| Head branch | `claude/phase-4a-1a-sauce-quantity-f8kcus` |
| HEAD | `e0e4f1663304e6f7f34c0f0d48381a9e28e6d261` |
| Base | main `45362e210a3e99ecc949706e9d007bf42e558881` |
| Mergeability | mergeable / clean against current main |
| CI | `build` SUCCESS, completed 2026-09-15 03:52:24 UTC |
| Formal reviewDecision | none |
| Reviews | Codex `COMMENTED` on original commit; no approval/request-changes review |
| Review threads | 2 total: one current unresolved coverage-threshold thread; one outdated unresolved gesture-session thread |

The current unresolved coverage thread describes threshold `0.02`, but current HEAD uses `COVERAGE_THRESHOLD=0.015`, below one tick `0.02`; the code condition reported by the comment is fixed, though the thread is administratively unresolved. The gesture-session thread is outdated and current HEAD snapshots session identity and aborts on ingredient changes. Supplied Focused Re-Review result is therefore interpreted as the current technical verdict: P0=0, P1=0, P2=0, P3=1 non-blocking; B. READY WITH NON-BLOCKING MINOR FINDING.

PR #21 latest commit preserves each coalesced sample's own timestamp through`PointerTimestampNormalizer`; 362/362 tests and build are reported in the latest commit and CI is green. This audit inspected the current call boundary and confirmed the timestamp is forwarded to`controller.move()`.

### PR #25

| Item | Fresh result |
|---|---|
| Title | Issue #24: HOME/GAME separation + App Icon/PWA |
| State | OPEN, non-draft |
| Head branch | `claude/teto-pizza-home-game-icon-i8xofr` |
| HEAD | `b6b0c395f8d82d7e88ee3decab3b0f0000f6ed11` |
| Base | main `45362e210a3e99ecc949706e9d007bf42e558881` |
| Mergeability | mergeable / clean against current main |
| CI | `build` SUCCESS, completed 2026-09-15 04:41:49 UTC |
| Formal reviewDecision | none |
| Reviews | Codex/owner `COMMENTED`; no approval/request-changes review |
| Review threads | 2/2 resolved at latest HEAD |

PR #25 changes`App.tsx`/`App.css`and introduces`GameScreen.tsx`. PR #21 also changes`App.tsx`/`App.css`; each is clean against main, but that does not guarantee a conflict-free combination with each other. Phase 4A-1B must not assume either old layout. It should integrate from the consolidated latest baseline and keep drag logic in a small independent module.

## 2. Documentation audit

### `docs/PROJECT_HANDOFF.md`

GitHub main, PR #21 HEAD, PR #25 HEAD, and the local worktree were checked. The file does not exist in any of them. Therefore it could not be audited or updated. This is a documentation gap, not a production blocker.

Suggested future handoff addition, not applied in this read-only audit:

- main/PR #21/PR #25 exact SHAs and merge order
- Phase 4 core principle and Human Feel PASS
- sauce visual polish candidate: “paint” currently reads as a thick red line
- 4A-1B design/report links
- authoritative legacy scoring boundary
- next implementation baseline and physical iPhone gate

### Phase 4A design/report status

- PR #21 tracks its three Phase 4A-1A result reports and the latest implementation.
- The Phase 4A-0 design, broad pre-implementation audit, catalog audits, and post-fix independent re-review are present locally as untracked artifacts, not in GitHub main/PR #21/PR #25.
- These local documents were treated as non-authoritative design inputs and checked against current GitHub code.
- The 181-ingredient audit reports 7 families: SPREAD 12, HOLD_SCATTER 21, TAP_PLACE 98, SPRINKLE 26, DRIZZLE 6, SPECIAL 17, NON_INTERACTIVE 1.
- Quantity evidence is 0/181; all 4A target counts/positions must remain explicitly game-authored prototype values.

## 3. Human Feel result interpretation

| Input | Interpretation |
|---|---|
| Long-hold + drag sauce is fun | interaction direction validated |
| “自分で作っている” adopted | placement should require direct manipulation, not only selection |
| Gesture/timestamp not redesigned | 1B must reuse, not refactor, sauce lifecycle |
| Human Feel PASS | no additional 1A prototype gate before 1B |
| P0/P1/P2 = 0 | no technical blocker carried into 1B |
| P3 = 1 | Reference type/input classification cleanup is non-blocking |
| Thick red line visual | separate Visual Polish backlog; not a 1B blocker |

The right consequence is not to make every material a hold gesture. It is to preserve the manual-making principle while giving each material a distinct physical response.

## 4. Current implementation audit

### Pizza/piece state

- `PizzaState.toppings` already stores stable render key, ingredient ID, normalized x/y.
- Cheese and toppings share this array and generic placement score.
- no round state is persisted; save schema contains progression only.
- `findOpenSpot` enforces minimum distance 9 and can auto-nudge.
- current `PLACE_TOPPING` checks ownership but does not independently check PREPARE phase. 4A-1B should add that defense because a drag can complete after a phase transition.

### Current input

- tray tap selects an ingredient.
- pizza pointerdown/move/up supports sauce painting; non-sauce drag that begins on the pizza commits one topping at release.
- there is no tray-to-pizza drag or floating preview.
- first pointer already wins inside PizzaStage.
- PizzaStage has capture, lost-capture, cancel, blur/visibility and unmount patterns from PR #21 that can guide, but piece drag should have its own single-commit controller.

### Scoring/progression

- legacy weights are recipe correctness 35, purity 15, generic placement 20, bake 30.
-`CONFIRM_BAKE`writes legacy`state.score`.
- Dex registration, Mission scoring, totalStars, unlocks, Shop, Pitz and persistence all depend directly or indirectly on that score.
- PR #21 sauce similarity is shadow-only and does not enter`scorePizza`.

Conclusion: extend the existing shadow path; do not replace or augment authoritative score in 1B.

## 5. Recommended interactions

### Mozzarella

**Recommendation:** tray-to-pizza drag/drop as primary, existing select + pizza tap as fallback. One drop creates one piece. Use a visible shadow/preview and a 220ms squash/bounce. Target count: 3.

This is physical without creating a time/rate calibration problem. Three drags are enough to test the interaction while remaining below the point where transport becomes busywork.

### Basil

**Recommendation:** same single-piece drag transport but a lighter preview and 280ms falling/rotating landing. Target count: 2. Rotation is a deterministic visual projection only.

The shared transport avoids unnecessary input-system duplication; pickup offset, shadow, landing trajectory and rotation distinguish material feel.

### Fallback and accessibility

- keep chip tap → pizza tap.
- suppress duplicate synthetic click after a drag.
- use`aria-pressed`and a polite live announcement.
- make the dough focusable and provide Enter/Space center/open-spot placement as a minimum keyboard path.
- reduced motion removes flourish, not input or commit behavior.

## 6. Reference placement and matching

Use a group model, not per-piece IDs:

- Mozzarella: `(35,35) (65,36) (50,66)`
- Basil: `(31,62) (69,62)`
- full-credit radius: 8 dough units (~24 px at 300 px dough)
- zero-credit radius: 22 dough units (~66 px)

Use a rectangular Hungarian assignment minimizing total Euclidean distance. IDs and order are ignored. When counts differ, match the smaller set to the best subset of the larger set. Convert matched distances with a full-credit plateau and smooth falloff.

Hungarian is slightly more code than exhaustive matching at 3/2 pieces, but avoids a future algorithm replacement for larger`TAP_PLACE`sets. It is appropriate if implemented as a dependency-free pure function with permutation/tie tests.

Do not add radial/angular/centroid/spacing scoring in 1B. They are better suited to future scatter/distribution families and would double-count positional error here.

## 7. Forgiveness and quantity

### Placement bands

| Distance | Band |
|---:|---|
| 0–8 units | Excellent |
| >8–14 | Good |
| >14–<22 | Acceptable |
| >=22 | Miss |

Bands are feedback only; numeric score remains continuous.

### Quantity

Quantity and placement are reported separately.

`quantitySimilarity = clamp01(1 - abs(actual-target)/(target+1))`, with player count 0 explicitly 0.

Placement averages matched pieces only. Unmatched pieces do not contribute a second zero. With no player pieces, placement is`null/not evaluated`, not another zero. This prevents the same missing/extra error being punished twice before Scoring 2.0 balance is designed.

## 8. Animation/state architecture

- canonical drop is committed immediately to`PizzaState.toppings`.
- drag session and preview live in refs/local visual state.
- preview coordinates update through one RAF per frame.
- landing uses CSS keyframes on the canonical render position.
- Basil rotation comes from a stable coordinate hash; no`Math.random()`.
- animation elements do not receive pointer events and do not block subsequent input.
-`prefers-reduced-motion`disables/simplifies transforms.

No animation value is a scoring input.

## 9. State/data decision

| Proposed type | Decision |
|---|---|
| `ReferenceLayout` | not needed in 1B; existing`ReferencePizza`is the layout root |
| `ReferencePiece` with ID | reject; matching must be ID-independent |
| `ReferencePieceGroup` | add; ingredient + positions + tolerance + interaction |
| `PlacedPiece` | reject; reuse`PlacedTopping` |
| `InteractionFamily` | align to existing 7-family catalog; no`DRAG_PLACE`addition |
| `PlacementInput` | add minimal UI/input variant if needed |
| visual rotation field | reject; derive deterministically |
| persisted prototype score | reject |

Put prototype positions in`referencePizza.ts`, not`recipes.ts`. Recipe requirements remain ingredient/minCount truth; Reference positions are game-authored evaluation profile data.

## 10. Test plan

Required automated coverage:

- coordinate conversion, zero rect, boundary and edge-grace clamp
- drag start threshold, preview, valid drop, outside drop
- pointercancel, lost capture, capture failure fallback
- blur, visibility, unmount, BAKE, RESET/order/ingredient change
- first-pointer-wins multi-touch; no duplicate click commit
- exact target, near/far and boundary matching
- permutation and piece-ID invariance
- extra/missing pieces without placement double penalty
- duplicate positions and deterministic tie result
- deterministic Basil rotation
- animation/reduced-motion has no score effect
- PR #21 timestamp/sauce suite stays green
- all seven recipes' legacy placement/scoring regression
- Dex/Mission/Pitz/Shop/progression/persistence invariants

Acceptance gates:

```text
npm test -- --run
npm run lint
npx tsc -b
npm run build
git diff --check
```

The exact scripts should be taken from the current package.json at implementation time because PR #25 changes the test environment.

## 11. Physical iPhone Human Feel Gate

Required on real iPhone Safari and, if supported, installed PWA:

- 3 Mozzarella + 2 Basil repeated drag flow
- tap fallback parity
- horizontal tray scroll vs upward pickup arbitration
- center/rim/near-outside/far-outside drop
- second-finger ingredient/Reference/BAKE races
- app switch, tab switch, Control Center, orientation change mid-drag
- rapid placements and input latency
- material weight differentiation
- reduced motion and VoiceOver smoke
- no scroll lock outside active piece gesture
- no lingering preview or late commit after cancel

PASS requires that five drags feel like making, not transport work; Mozzarella and Basil feel distinct; and the player can predict valid/cancel behavior without reading metrics.

## 12. Future scalability

The design scales to whole pieces (onion, mushroom, ham, olive, sausage, chicken, seafood) through`TAP_PLACE`profiles. Pepperoni can use the same path at small counts and later change to distribution when counts grow. Shredded cheese uses`HOLD_SCATTER`; oregano uses`SPRINKLE`; oil uses`DRIZZLE`; egg can use`SPECIAL`. Those families can reuse lifecycle/coordinates but not necessarily matching or single-drop semantics.

No full-catalog implementation or mapping change belongs in 1B.

## 13. Implementation scope

Estimated delta:

- 3–5 new logic/interaction/test files
- 5–8 modified data/component/style/test files
- approximately 650–1,050 LOC including tests
- no save migration
- no authoritative scoring change

Claude Code estimated processing time at Medium reasoning:

- implementation + automated tests: 90–180 minutes
- browser regression/390×844 verification: 30–60 minutes
- physical iPhone Human Feel: 30–45 minutes of human testing, excluding availability/feedback turnaround

The estimate assumes PR #21/#25 integration conflicts are already resolved. Add 30–90 minutes if the implementation branch must reconcile both App/App.css structures first.

## 14. Risks

1. Two open PRs overlap integration files; stale baseline can waste work.
2. tray horizontal scroll can compete with upward drag.
3. five transports may still feel repetitive on a small screen.
4. reducer currently lacks a PREPARE guard for`PLACE_TOPPING`.
5. auto-nudge can move player intent; score must use visible final coordinates.
6. visual randomness can create nondeterminism if implemented with`Math.random()`.
7. Reference similarity can accidentally leak into progression if wired through`state.score`.
8. sauce thick-line visual remains a polish debt but is unrelated to 1B correctness.

## 15. Severity summary

### Upstream PR #21 Focused Re-Review / Human Feel

| Severity | Count |
|---|---:|
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 1 non-blocking |

### This pre-implementation audit

No production defect requiring a P0/P1/P2 block was found. The minor design finding is the interaction classification/data boundary: physical drag must be an input variant of recipe/form-specific`TAP_PLACE`, not a new global family or global Mozzarella rewrite. Missing`PROJECT_HANDOFF.md`, unresolved-but-fixed PR thread state, PR sequencing, and sauce line appearance are documentation/integration/polish notes, not 1B blockers.

## 16. Final verdict

**B. READY WITH MINOR DESIGN CHANGES**

Implementation can start after fresh baseline confirmation. A separate throwaway prototype is not required; Phase 4A-1B itself is a Margherita-only, shadow-scoring prototype. Do not start from main alone because it does not contain PR #21. Do not assume PR #25's component boundary until its current state is integrated.

## 17. Claude Code implementation prompt

```text
Repository: perusonao/teto-pizza-game
Task: Phase 4A-1B Cheese & Topping Physical Interaction implementation
Recommended reasoning: Medium or higher; Extra High is unnecessary.

Before changing anything:
1. Fresh-check GitHub main HEAD, PR #21 latest HEAD/CI/reviews, and PR #25 latest HEAD/CI/reviews. Do not trust SHAs in this prompt.
2. Confirm the working branch contains the current PR #21 sauce implementation. If PR #25 is integrated, use its GameScreen boundary; otherwise integrate with the actual current component structure. Do not merge/push unless separately authorized.
3. Read:
   - docs/design/PIZZA_GAME_Phase4A-1B_Cheese-Topping-Physical-Interaction_Design.md
   - docs/reports/PIZZA_GAME_Phase4A-1B_PreImplementation_Audit.md
   - current PR #21 Phase 4A-1A reports/code/tests
   - PizzaStage, IngredientTray, pizzaState, gameReducer, referencePizza/referenceScoring, placement/scoring, recipes/ingredients, Dex/Mission/progression/persistence tests
4. Preserve unrelated working-tree changes.

Implement only FREE Margherita:
- Keep PR #21 Sauce interaction/gesture/timestamp/field behavior unchanged.
- Mozzarella: tray-to-pizza drag/drop primary, selected-ingredient + pizza tap fallback, target 3. Preview follows finger with shadow; successful drop gets 220ms squash/bounce.
- Basil: same safe single-piece transport, target 2, but lighter preview and 280ms soft falling/rotation landing.
- Treat both as semantic TAP_PLACE with primaryInput DRAG_FROM_TRAY and fallbackInput TAP_ON_PIZZA. Do not add DRAG_PLACE as an eighth catalog family. Do not globally rewrite Mozzarella's catalog family; this is a Margherita chunk/whole-leaf reference profile.
- Keep tap fallback discoverable and prevent synthetic click double placement.

Pointer lifecycle:
- first primary pointer wins; snapshot token/pointer/ingredient at start
- candidate threshold about 6 CSS px; preserve horizontal tray scroll via pan-x/intent arbitration
- pointer capture with window-level fallback
- RAF-batched preview transform; no canonical state during drag
- fresh pizza rect at drop; clientPointToDoughPercent
- <=48 dough radius valid; 48..52 edge grace clamp; >52/outside/non-finite/zero rect cancel
- exactly one PLACE_TOPPING on successful pointerup
- cancel with no commit on pointercancel, lost capture, blur, hidden, unmount, BAKE/PREPARE exit, RESET/order/ingredient/category change, Reference interaction disable, Escape
- ignore second pointer and late events
- add an independent PREPARE-phase guard to PLACE_TOPPING while retaining ownership guard

State/data:
- reuse PizzaState.toppings and PlacedTopping; do not add PlacedPiece
- extend existing ReferencePizza with ReferencePieceGroup[]; no reference piece IDs
- positions:
  mozzarella: (35,35), (65,36), (50,66)
  basil: (31,62), (69,62)
- game-authored prototype values only; do not present as PIZZA DB fact
- keep prototype positions out of recipes.ts
- temporary pointer/preview/animation state must not enter PizzaState or persistence

Matching/shadow evaluation:
- add dependency-free pure rectangular Hungarian minimum-total-Euclidean-distance matching per ingredient
- ignore piece IDs and input order; match the smaller set to the best subset of the larger set
- full credit <=8 dough units, smoothstep falloff to zero at 22
- UI bands: Excellent 0..8, Good >8..14, Acceptable >14..<22, Miss >=22
- quantitySimilarity = clamp01(1 - abs(playerCount-targetCount)/(targetCount+1)); player 0 => 0
- placement averages matched pairs only; if player count 0 return null/not evaluated
- do not add radial/angular/centroid/spacing scoring in this phase
- do not connect the result to state.score or any authoritative total

Animation/accessibility:
- score/render final canonical reducer coordinates only
- Basil visual rotation must be deterministic from ingredient + rounded x/y; never Math.random and never a scoring input
- preview/landing pointer-events none; allow more input while landing
- CSS landing animation, RAF preview; prefers-reduced-motion support
- aria-pressed on chips, polite placement/cancel announcement, minimum keyboard placement fallback on focused dough

Hard boundaries:
- legacy scorePizza and weights remain authoritative
- no changes to Dex BEST/stars/totalStars, Mission, Pitz, Shop, unlocks/progression, or save schema
- no other recipes, no Mission physical placement, no 181-ingredient runtime rollout
- no Scoring 2.0 authority/migration
- do not fix the sauce thick-red-line visual in this scope; record it as separate polish only

Tests required:
- coordinate/drop boundary conversion and edge grace
- threshold/tap fallback/valid drop/outside drop/exactly-once commit
- cancel/lost capture/capture failure/blur/hidden/unmount/BAKE/RESET/order/ingredient switch/Escape
- multi-touch and synthetic-click suppression
- exact/near/far/boundary matching, permutation and ID invariance
- missing/extra separation, duplicate positions, deterministic ties
- deterministic Basil rotation and animation-score independence
- reduced motion/accessibility smoke
- all PR #21 sauce/timestamp tests
- legacy all-recipe scoring, Dex, Mission, Pitz, Shop, progression, persistence regressions

Run the repository's current test/lint/typecheck/build scripts plus git diff --check. Verify at 390x844 with no console/page errors and no horizontal overflow. Then provide a physical-iPhone Human Feel checklist; do not claim that gate passed unless it was actually run on a physical iPhone.

Report:
- fresh audited SHAs and branch baseline
- files changed
- interaction and cancellation behavior
- reference/matching/count results
- legacy boundary proof
- automated/browser results
- remaining risks and explicit physical iPhone gate status
```
