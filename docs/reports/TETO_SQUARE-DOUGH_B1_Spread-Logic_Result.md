# Square-Pan Dough B1 — tap / hold spread logic, reducer action, Preview switch — Result

Issue #535 (B) under Epic #532, first of two PRs (**B1 = logic, no visible change; B2 = the component, CSS, E2E and Human Verification**).
Design: `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md`; foundation: `TETO_SQUARE-DOUGH_A_Shape-Foundation_Result.md`.
Base: `origin/main` `a6a8614`. **Not merged, not deployed, shared Preview untouched.** Nothing a player (or a production build) can reach.

## Owner decisions this implements (2026-10-18)
1. B adjusts the square dough's **thickness only**; the outline and the corners are not changed (C, #536).
2. Two PRs: B1, then B2.
3. `?pan=square` and `?squareStart=lumpy` are **Preview / DEV only**.
4. In B the square DOUGH step's 「次へ」 stays disabled (the completion gate is C's) — B2.
5. **Tap = a local push-in; hold = a continuing spread**, clearly different in feel.
6. All gesture numbers are initial values for Owner iPhone Safari HV.

## What changed

| File | Change |
|---|---|
| `src/logic/pan/squareDoughSpread.ts` (new) | `relaxAt` (the one operator), `pressAt` (tap), `holdStep` / `holdBrushRadius` (hold), `applyPressEffect(s)`, and the named constants. |
| `src/logic/pan/pressGesture.ts` (new) | `stepPressGesture`: the pure tap / hold state machine. Time and position come in with each event; no clock, no timers, no DOM. |
| `src/logic/pan/squareDoughFixtures.ts` (new) | `createLumpySquareDough()`: a full, finger-lumpy sheet for the Preview start and for tests. Production code does not import it. |
| `src/preview/panShapePreview.ts` (new) | `?pan=square`, `?squareStart=lumpy`, `activePanShape(recipe)`, `wantsLumpySquareStart()`. Behind a static `import.meta.env.DEV \|\| VITE_PREVIEW_MODE`. |
| `src/state/gameReducer.ts` | New action `COMMIT_SQUARE_DOUGH`. A no-op outside PREPARE/DOUGH, in a round whose pan is not square, and for an invalid grid. |
| `src/state/pizzaState.ts` | `PizzaState.squareDough?: SquareDough` — **optional and absent from every round pizza**; `createEmptyPizza()` is unchanged. |
| `src/components/PreviewBadge.tsx` | `· PAN square` / `· PAN square (lumpy)` while the switch is on (Preview builds only). |
| tests (new) | `squareDoughSpread.test.ts`, `pressGesture.test.ts` (incl. the Codex-review block), `panShapePreview.test.ts` (11), `panShapePreview.gate.test.ts` (3, real vite builds), `gameReducer.squareDough.test.ts` (7). |

**Not touched:** `PizzaStage.tsx`, `GameScreen.tsx`, `App.tsx`, `App.css`, `doughShape.ts`, every round-dough action, scoring, `signature.ts`, `persistence.ts`, recipes, ingredients. Existing tests: none edited.

## The operator and what it guarantees
`relaxAt(dough, center, radius, strength, falloff)` moves every **covered** cell under a round brush toward the brush's weighted mean thickness, by `strength × weight(distance)` (weight 1 at the centre, 0 at the edge).

- **Conserves the total thickness** exactly (dough moves from thick to thin; none is made or lost) — tested to 1e-9 over 150 random doughs.
- **Never changes the outline**: covered cells stay covered, uncovered cells stay exactly 0, and the dough stays valid (`isValidSquareDough`). Corners and extent are therefore untouched, as decided.
- **Never lowers evenness**: the mean over the pan is unchanged and the variance can only fall (change in variance = Σ (aᵢ² − 2aᵢ) dᵢ² ≤ 0 for aᵢ = strength × weightᵢ ∈ [0, 1]). Tested over 150 random doughs.
- A change that is only floating-point noise is not a change (a level sheet comes back as the very same object).
- It never makes a thin cell thinner or a thick one thicker than the brush mean, so repeated presses cannot over-thin.

**Two feels from one operator**
| | Brush | Strength | Falloff | When |
|---|---|---|---|---|
| **TAP** (local push-in) | radius 11% of the box (~40–50 px on a phone) | 0.9, once | `dome` (firm across most of the disc) | applied the instant the finger goes down |
| **HOLD** (continuing spread) | grows 11% → 22% over 700 ms (ease-out) | rate 2.2 / s, as an exponential so it is frame-rate independent; a long interval is split into equal sub-steps of at most 100 ms (brush grows across them), and at most 5 s (`HOLD_MAX_ACCOUNTED_MS`) is accounted for | `cone` (blends smoothly) | after 200 ms of a still finger, every frame while held |

Measured on the lumpy fixture (evenness 0.739; thickest spot under a middle lump 0.834): one tap lowers the peak under the finger to **0.713**; a 0.9 s hold lowers it to **0.672** over a wider area. A hold step of one frame is far smaller than a tap (tested ≥ 5× smaller). Frame rates of 120 / 60 / 30 steps per second end within 0.03 evenness of each other.

The tap strength is 0.9 rather than 0.85 on purpose: 0.85 is the corner-reach threshold (A), and `squareDough.test.ts` pins that literal to one place in the source; the two are different quantities and both are provisional.

A first draft had a smaller, cone-shaped tap that lowered the peak by only 0.006 — invisible. The test caught it; the tap is now `dome`, r = 11, and the fixture's lumps are finger-sized.

## The gesture state machine (`stepPressGesture`)
- **down** → a TAP effect immediately (no waiting to see if it becomes a hold). One finger at a time; a second finger is ignored with its moves and its up.
- **tick** after `HOLD_START_MS` (200 ms) of a still finger → HOLD effects; elapsed time counts from the start of the hold. The last moment before pointer-up also counts, so the result does not depend on tick timing (dts add up to `up − 200` at tick rates from 4 ms to 100 ms).
- **move** farther than `MOVE_SLOP_PX` (10 px; exactly 10 is still a press) → the hold is accounted up to that instant (even when no tick arrived yet), then the press ends as a spread: **nothing more is applied** (what was done stays). That movement is a drag, which C will claim; B only guarantees a wandering held finger cannot smear the dough.
- **up** → commit. **cancel** (pointer cancel, window blur, hidden tab, a step change) → discard everything; the dough stays as it was.
- Non-finite times / positions are ignored; ticks that go back in time add nothing. A pointer-up with a non-finite time still ends the gesture (at the last accounted time, adding no hold), so a press can never get stuck.

## Preview switch
`?pan=square` (every round's pan is square) and `?squareStart=lumpy` (start from the lumpy full sheet). Whitelisted exact values, read once per page load, applied in exactly one place (`activePanShape`). The production-bundle gate builds the app twice (without / with `VITE_PREVIEW_MODE`): the production bundle contains neither the marker, the `squareStart` name nor the badge attribute; the Preview bundle contains all three. Production's `COMMIT_SQUARE_DOUGH` exists but is inert (no round is a square-pan round).

## Verification
See the PR description (commands and CI). Human Verification: B1 has no visible or behavioural change (`TETO_HUMAN-VERIFICATION-POLICY.md` §2); B2 carries the 390×844 video and the 360×800 check.

## B2 (next)
`SquareDoughLayer` (16 × 16 shading, pan outline, tap ring, hold progress ring offset from the finger), the pointer wiring and `touch-action` / selection / callout / context-menu handling, the `PizzaStage` hook-in (~15 lines, additive), 「次へ」 disabled for the square DOUGH, the E2E (Chromium + WebKit, 390×844 and 360×800, hold driven by Playwright's clock), the dedicated-Preview Human Verification.

## Conflicts
#474 and #518: no implementation PR or branch; B1 touches neither `PizzaStage.tsx` nor any CSS. #540 (Draft, HOLD) and #527: not touched. Shared Preview: not touched.
