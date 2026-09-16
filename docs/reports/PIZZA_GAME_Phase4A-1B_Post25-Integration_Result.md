# PIZZA_GAME Phase 4A-1B: Post-#25 Integration Result

## Summary

PR #26 (`codex/phase-4a-1b-physical-interaction`, Phase 4A-1B: Cheese &
Topping Physical Interaction) was built against `origin/main` at
`0c880f6` (Phase 4A-1A / PR #21). Since then, PR #25 (Issue #24: HOME/GAME
separation + App Icon/PWA) merged into `main`, moving `main` to `65a3cc4`
and extracting the GAME view's entire JSX out of the old flat `App.tsx`
into a new `src/screens/GameScreen.tsx`. This integration brings PR #26
up to date with that new `main` so it can be reviewed/merged without
losing either feature set.

- **Fresh-fetch confirmation (both matched expected before integration):**
  - `origin/main` @ `65a3cc4c8e90c9c9f97486e69c95bc805a404fe9` (PR #25 merge) — matched.
  - `origin/codex/phase-4a-1b-physical-interaction` (PR #26 HEAD) @
    `5e13856596171a8a43397a5a250e161d11669400` — matched.
- **Merge base:** `0c880f6` (PR #21, the commit both branches diverged from).
- **Integration commit:** `7b55603bd9377039676df43b5aa8257b5f404218`
  (one merge commit of `origin/main` into PR #26's branch).
- **Pushed to:** `codex/phase-4a-1b-physical-interaction` (PR #26's actual
  branch — pushed here on the user's explicit instruction after the
  harness's default designated branch,
  `claude/pr26-main-integration-g2smkr`, was flagged as a mismatch; both
  branches now point at the same integration commit as a fast-forward,
  no history was rewritten on either side).

No `git rebase`/history rewrite was used — a plain `git merge origin/main`
was performed on top of PR #26's branch and pushed as a new commit.

## What conflicted and why

`git merge origin/main` (into PR #26's branch) produced a conflict in
exactly one file:

- **`src/App.css`** — merged automatically, no conflict. Both sides are
  purely additive at different locations (PR #25 added a "HOME / GAME
  screens" section around line 1335+; PR #26 added mozzarella/basil
  landing-animation keyframes and drag-preview styles around lines 309,
  404, and near the end of the file).
- **`src/App.tsx`** — the only real conflict. PR #25 restructured the
  component: it extracted the GAME view's entire PREPARE/BAKE/RESULT JSX
  (previously inline in `App.tsx`) into `src/screens/GameScreen.tsx`,
  leaving `App.tsx` to own only state/reducers/handlers and render
  `<HomeScreen>` / `<GameScreen>`. PR #26, working from the pre-split flat
  `App.tsx`, added its physical drag-and-drop feature (the
  `pizzaDropTargetRef`/`handleDoughElementChange`/`resolvePhysicalDrop`/
  `handlePhysicalDrop` state and handlers, the `pieceShadowMetrics` derived
  value, and new props threaded into `<PizzaStage>`/`<IngredientTray>`/
  `<SauceMetricsPanel>`) directly inline in that old flat JSX. Git's 3-way
  merge auto-resolved every state/handler/memo addition (no PR #25
  counterpart existed for any of them, so they landed cleanly); the only
  genuine conflicts were the import block and the `<GameScreen>`-vs-inline-
  JSX region.

## How the semantic merge was done

Rather than mechanically picking "ours" or "theirs", PR #26's physical
drag feature was relocated to live where PR #25's extraction now expects
GAME-view JSX to live:

1. **`src/App.tsx`** keeps owning all state (`pizzaDropTargetRef`) and all
   handlers/derived values from PR #26
   (`handleDoughElementChange`, `resolvePhysicalDrop`,
   `handlePhysicalDrop`, `pieceShadowMetrics`) — matching the existing
   rule that `App.tsx` never duplicates game logic into either screen.
   These are now passed down to `<GameScreen>` as three new props
   (`onDoughElementChange`, `resolvePhysicalDrop`, `onPhysicalDrop`) plus
   `pieceShadowMetrics`, alongside the pre-existing HOME/GAME navigation
   props. The unused `DialogueBox`/`PizzaStage`/`IngredientTray`/
   `BakeOverlay`/`ResultPanel` imports PR #26 had added directly to
   `App.tsx` (needed there only because PR #26 predates the GameScreen
   extraction) were dropped — those components are rendered exclusively by
   `GameScreen.tsx` now.
2. **`src/screens/GameScreen.tsx`** gained the three new props
   (`onDoughElementChange`, `resolvePhysicalDrop`, `onPhysicalDrop`) plus
   `pieceShadowMetrics`, and now forwards them into `<PizzaStage>`
   (`onDoughElementChange`), `<SauceMetricsPanel>` (`pieceMetrics`), and
   `<IngredientTray>` (`physicalDragEnabled`, `draggableIngredientIds`,
   `resolvePhysicalDrop`, `onPhysicalDrop`) — the exact same relative
   positions PR #26 had them in the old flat `App.tsx`.
3. `src/components/IngredientTray.tsx`, `src/components/PizzaStage.tsx`,
   `src/components/ReferencePreview.tsx`,
   `src/components/SauceMetricsPanel.tsx`, `src/logic/referenceScoring.ts`,
   `src/state/gameReducer.ts`, and all of PR #26's new files
   (`src/logic/pieceDrag.ts`, `src/logic/referenceMatching.ts`, the
   `referencePizza.ts` additions, and their test files) merged
   automatically with no manual changes — PR #25 never touched any of
   these.

No save schema, scoring, Dex BEST, Mission, Pitz, Shop, or progression
semantics were touched by this integration; only import/JSX wiring was
changed to reconcile the two branches' independent structural changes.

## Required-preserved feature checklist

| Feature | Status |
|---|---|
| HOME / GAME separation | ✅ preserved — `GameScreen.tsx` extraction kept intact, PR #26's JSX relocated into it rather than reverting the split |
| App Icon / PWA | ✅ untouched (`public/manifest.webmanifest`, `public/icons/*`, `index.html` links) |
| HOME→GAME / GAME→HOME navigation | ✅ verified in browser (see below) |
| PR #21 Sauce Quantity / Reference popover / Prototype Metrics | ✅ preserved, extended with `pieceMetrics` |
| Mozzarella tray drag/drop | ✅ verified in browser |
| Basil tray drag/drop | ✅ verified in browser |
| Mozzarella 220ms landing animation | ✅ `App.css` keyframe `mozzarella-land` intact |
| Basil 280ms landing + deterministic rotation | ✅ `App.css` keyframe `basil-land` + `stablePieceRotation` intact |
| TAP_PLACE fallback | ✅ verified in browser (click chip → tap dough places topping) |
| Keyboard fallback | ✅ verified in browser (focus dough → Enter places topping) |
| Reference Placement shadow metrics | ✅ `scorePiecesAgainstReference` wired through `pieceShadowMetrics` → `SauceMetricsPanel` |
| Permutation-invariant Hungarian matching | ✅ `src/logic/referenceMatching.ts` unmodified, its 71-case test suite passes |

## Absolutely-unchanged checklist

| Item | Status |
|---|---|
| Legacy scoring authority | ✅ unchanged — RESULT screen still shows the pre-existing 具材/配置/焼き breakdown and ★ rating |
| Dex BEST | ✅ unchanged (`state/dex.ts` untouched) |
| stars / totalStars | ✅ unchanged |
| Mission | ✅ unchanged (`mission/lunchRush.ts` untouched) |
| Pitz | ✅ unchanged (`logic/economy.ts` untouched) |
| Shop | ✅ unchanged (`ShopOverlay` untouched) |
| Progression | ✅ unchanged (`state/progression.ts` untouched) |
| Save schema | ✅ unchanged (`state/persistence.ts` untouched) |

## Verification commands

All run from a clean `npm ci` on the merged branch:

| Check | Result |
|---|---|
| `npx tsc -b` | Clean, no errors |
| `npm run lint` (oxlint) | Clean, 0 errors |
| `npx vitest run` | **393/393 tests passing** (27 test files) |
| `npx vite build` (production build) | Clean, `dist/` produced |
| `git diff --check` | Clean, no whitespace errors |
| conflict marker scan (`grep` for `<<<<<<<`/`=======`/`>>>>>>>` across `src/`) | **0 matches** |

No regression tests needed to be added beyond what PR #26 already
carried (`gameReducer.pieceDrag.test.ts`, `phase4a1b.regression.test.ts`,
`pieceDrag.test.ts`, `referenceMatching.test.ts`) — the integration only
moved JSX/prop wiring between `App.tsx` and `GameScreen.tsx`; it did not
change any reducer, scoring, or matching logic, so the existing unit
suites already cover the moved code paths end-to-end.

## Browser verification (390×844, `vite preview`)

Walked with Playwright (Chromium) at a 390×844 viewport against the
production build:

1. **HOME** — renders correctly, no horizontal overflow.
2. **HOME → ピザを作る → ORDER → PREPARE (フリープレイ)** — landed on a
   Margherita order; PREPARE shows the sauce tray, 見本 button, and
   Prototype Metrics panel.
3. **Sauce hold+drag** — a pointer drag over the dough produced a visible
   sauce heatmap and live Prototype Metrics update (量 22% / 被覆 6% /
   均一性 68%).
4. **Mozzarella ×3 drag** — dragged from the cheese tray onto the dough
   three times; each landed with the 220ms animation and correct
   placement.
5. **Basil ×2 drag** — dragged from the topping tray onto the dough twice;
   each landed with the 280ms animation and deterministic rotation.
6. **見本 (Reference) popover** — opens over a backdrop showing the
   Margherita reference mini-pizza (3 mozzarella + 2 basil) and the
   量/塗り広げ target bars; closes correctly.
7. **Outside-drop invariant** — dragging a basil chip and releasing far
   outside the dough left the topping count unchanged (5 → 5): the drop
   was correctly rejected, nothing was placed.
8. **TAP_PLACE fallback** — clicking a mozzarella chip (no drag) then
   tapping the dough placed a topping (5 → 6).
9. **Keyboard fallback** — clicking a mozzarella chip, focusing the dough,
   then pressing Enter placed a topping (0 → 1 in an isolated check).
10. **BAKE → RESULT** — legacy scoring rendered correctly (★4, 93点,
    具材/配置/焼き breakdown, burnt-classification dialogue) — confirming
    legacy scoring authority is untouched by the merge.
11. **GO_HOME confirm dialog** — leaving GAME mid-PREPARE correctly raised
    the native `confirm()` dialog with the expected Japanese message;
    dismissing it kept the round in progress on GAME. Leaving from RESULT
    (nothing in-progress) correctly did **not** raise it.
12. **No horizontal overflow** at any step (HOME, ORDER, PREPARE, RESULT).
13. **No console warnings/errors or page errors** were observed at any
    step across all Playwright runs.

## PR #26 state after push

- Pushed to `codex/phase-4a-1b-physical-interaction` (PR #26's own
  branch, per explicit user instruction) at commit `7b55603`.
- `pull_request_read get`: `mergeable_state` moved from `"dirty"`
  (conflicting against current `main`, before this integration) to
  `"unstable"` immediately after push (no conflicts, CI still running),
  then to **`"clean"`** once CI finished.
- GitHub Actions `build` check on head commit `7b55603`: triggered
  automatically on push, run
  [34951221594](https://github.com/perusonao/teto-pizza-game/actions/runs/34951221594) —
  **`status: completed`, `conclusion: success`**.

## Independent Review P2 fix: stale physical-drag session survives RESET_PIZZA

### Finding

Independent Review flagged (PR #26 discussion
[`r4012637679`](https://github.com/perusonao/teto-pizza-game/pull/26#discussion_r4012637679),
`src/components/IngredientTray.tsx:164`, P2): if a second pointer taps
「やり直す」(`RESET_PIZZA`) while a first pointer is mid-drag on a
draggable ingredient chip, `RESET_PIZZA` only ever changes `state.pizza`
— none of the three signals `IngredientTray` already aborts an active
drag session on (`physicalDragEnabled`, `selectedIngredientId`,
`activeCategory`) move when it fires. The first pointer's session
therefore survives the reset; releasing it afterward calls
`onPhysicalDrop`, which commits `PLACE_TOPPING` onto the just-emptied
pizza.

### Fix

`src/screens/GameScreen.tsx` — the one place 「やり直す」 is wired to
`onResetPizza` — now owns a local `pizzaResetToken` counter and a
`handleResetPizza` wrapper that bumps it in the same synchronous click
handler that dispatches `RESET_PIZZA`, then passes the counter to
`<IngredientTray resetToken={pizzaResetToken} />` alongside its existing
props.

`src/components/IngredientTray.tsx` gained a fourth "abort on change"
effect, sitting directly alongside the existing three
(`physicalDragEnabled`/`selectedIngredientId`/`activeCategory`):

```ts
useEffect(() => {
  if (sessionRef.current) clearSession();
}, [resetToken]);
```

`clearSession()` is the same function the other three effects and every
existing abort path (`pointercancel`, `lostpointercapture`, `blur`,
`visibilitychange`, Escape) already call — it nulls `sessionRef.current`,
cancels the scheduled preview frame, clears the preview, and releases
pointer capture. Once it has run, the stale pointer's later `pointerup`
(handled by `finishDrag`) finds `sessionRef.current` already `null` and
returns immediately, exactly like every other already-aborted session
does — no new abort path was introduced, no existing one was touched.

This is UI-only session-lifecycle wiring local to `GameScreen.tsx` and
`IngredientTray.tsx`: `gameReducer.ts`, `pizzaState.ts`, and every
legacy-authority system (scoring, Dex BEST, Mission, Pitz, Shop,
progression, save schema) are untouched.

### Regression tests added

`src/components/IngredientTray.physicalDragReset.test.tsx` (new file, 10
tests) wires the real `IngredientTray` component to the real
`gameReducer` (never a mock of `PLACE_TOPPING`/`RESET_PIZZA`), with a
harness `handleResetPizza` that mirrors `GameScreen.tsx`'s fix exactly:

1. **Required regression (Mozzarella)** — drag started, `RESET_PIZZA`
   dispatched mid-drag (before release), the original pointer released
   over a valid drop point → `toppings.length === 0`.
2. **Same race, Basil** — identical sequence through the same code path
   → `toppings.length === 0`, confirming the fix isn't Mozzarella-
   specific.
3. **Non-regression: a drag that finishes before any reset still places
   normally** → `toppings.length === 1` (the fix doesn't over-cancel).
4. **Non-regression: a reset with no active drag session is a harmless
   no-op** → a later, independent drag still places normally.
5. **Existing safety nets, re-verified against the real reducer (all
   previously verified only manually in the browser, now automated):**
   outside-drop, `pointercancel`, `lostpointercapture`, window `blur`,
   `visibilitychange`, and multi-touch (a second, non-primary pointer
   cannot hijack or duplicate the first pointer's session) — all still
   place nothing (or exactly one topping, for multi-touch's legitimate
   first-pointer completion) after the fix.

**Sanity-checked the tests themselves**: temporarily reverted the fix
(`git stash`) and re-ran this file — the two required regression cases
(Mozzarella and Basil) failed exactly as the finding describes (1 topping
committed onto the reset pizza instead of 0), while all other cases
(outside-drop, pointercancel, lostpointercapture, blur, visibilitychange,
multi-touch, and the two non-regression checks) passed regardless,
confirming the new tests isolate this specific race rather than
coincidentally passing either way.

### Verification after the fix

| Check | Result |
|---|---|
| `npx tsc -b` | Clean, no errors |
| `npm run lint` (oxlint) | Clean, 0 errors |
| `npx vitest run` | **403/403 tests passing** (28 test files — 393 prior + 10 new) |
| `npx vite build` | Clean, `dist/` produced |
| `git diff --check` | Clean, no whitespace errors |

### PR #26 state after the P2 fix push

- Pushed to `codex/phase-4a-1b-physical-interaction` at commit
  `0d8976c`.
- GitHub Actions `build` check on head commit `0d8976c`, run
  [34954620960](https://github.com/perusonao/teto-pizza-game/actions/runs/34954620960):
  first attempt failed on
  `src/state/gameReducer.commitSauceDispense.test.ts`'s
  `"rejects during a Mission round even though the recipe/ingredient/
  phase would otherwise be valid"` — a pre-existing test (last touched in
  PR #21, untouched by this fix or the Post-#25 integration) whose
  20-attempt retry loop for landing `MISSION_RESET_ORDER` on `margherita`
  has a small nonzero chance of exhausting all 20 tries. Confirmed as an
  unrelated flake, not a regression from this change: ran the same test
  file 5/5 and the full suite 3/3 locally, both 100% green. Re-ran only
  the failed job (`rerun_failed_jobs`, no code change) — **`status:
  completed`, `conclusion: success`** on the same commit `0d8976c`.
- `pull_request_read get`: `mergeable_state` **`clean`**.
- Review thread `r4012637679` (P2, `src/components/IngredientTray.tsx:164`):
  replied with the fix summary and regression-test description
  ([`r4014278792`](https://github.com/perusonao/teto-pizza-game/pull/26#discussion_r4014278792)),
  then **resolved**.
- `pull_request_read get_review_comments`: 1 thread total, **0
  unresolved** (`is_resolved: true`).
- `pull_request_read get_review_comments`: **0 unresolved review
  threads** remaining on PR #26.

## Verdict

**A. READY FOR PHYSICAL IPHONE GATE.**

All local verification (tsc/oxlint/vitest/build/git diff --check/conflict
marker scan) passed cleanly both after the Post-#25 integration and after
this P2 fix, every required feature was confirmed present and working
together at 390×844 with no console errors and no horizontal overflow,
and no legacy-authority system (scoring/Dex BEST/Mission/Pitz/Shop/
progression/save schema) was touched by either change. `mergeable_state`
is `clean`, the GitHub Actions `build` check on the final pushed head
(`0d8976c`) is green, the P2 finding is fixed with a regression test that
was confirmed to fail without the fix, its review thread is resolved, and
PR #26 has 0 unresolved review threads. Per instructions, PR #26 was
**not** merged — that step, along with the physical-iPhone Human Feel
gate for the new Mozzarella/Basil interactions (per PR #26's own
"pre-merge/broad-rollout gate" note), is left for the user.
