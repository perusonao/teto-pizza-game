# Teto Pizza Game — RESULT 2.0 Slice 1: Completed Pizza Hero + Result Flow Foundation

**Type:** Implementation. Production UI/reducer-wiring change (no Scoring 2.0/Pitz-formula/
Dex-semantics change). PR stays **OPEN**, pending Human Review of the Preview build/video below
— do not merge on CI green alone.

- **Base `main` SHA:** `aaf56edaea533f9efc63b3ba623bf1ae8425a6b5` (`M3A Bake Judgment: fading
  bake guide + continuous bake visuals (#68)`). Confirmed fresh via `git fetch origin main`
  immediately before starting — this matches the SHA the task description named as PR #68's
  expected merge commit, and PR #68 is confirmed MERGED on `main` (not just expected).
- **Final PR head SHA:** `e5d5452a6af05e3f8329a65226a0592df2df5def`
- **PR:** [perusonao/teto-pizza-game#75](https://github.com/perusonao/teto-pizza-game/pull/75)
- **SSOT read first:** `docs/reports/TETO_RESULT-2_Fresh-Audit.md` (Verdict **B — READY,
  MULTIPLE SLICES**) and `docs/PROJECT_HANDOFF.md`. This session implements exactly Slice 1
  from the audit's own section 9 ordering (slices 1+2: merge RESULT+DISCOVERED into one screen,
  then the HERO layout pass) — no Slice 2/3+ work (feedback-line translation layer, Cooking
  Time, Pitz/BEST animation, Dex 2.0/Shop 2.0/Inventory, new scoring, recipe expansion,
  character redesign) was started.

---

## 1. Changed files

```
src/App.css                                        |  78 +++++++++-
src/App.playerReference.test.tsx                   |   3 +-
src/App.test.tsx                                   |  69 ++++++++-
src/App.tsx                                        |  21 ++-
src/components/ResultPanel.test.tsx                | 111 +++++++++++---
src/components/ResultPanel.tsx                     | 170 +++++++++++++++++----
src/screens/GameScreen.keyboardOverlay.test.tsx    |   1 -
src/screens/GameScreen.keyboardSpreadRepeat.test.tsx |   1 -
src/screens/GameScreen.physicalDragOverlay.test.tsx  |   1 -
src/screens/GameScreen.tsx                         | 153 +++++++------------
10 files changed, 438 insertions(+), 170 deletions(-)
```

No changes anywhere under `src/logic/scoringV2/**`, `src/logic/pitzReward.ts`, `src/state/
dex.ts`, `src/data/referencePizza.ts`, `src/logic/scoring.ts`, or `src/state/gameReducer.ts`
(diff-verified: `git diff <base> <head> --stat -- <those paths>` returns empty).

## 2. Architecture decision

The Fresh Audit (section 11, "Reducer atomicity regression") flagged the single biggest risk
as: merging RESULT+DISCOVERED must never create a path where `REGISTER_TO_DEX`'s Dex/BEST/Pitz
side effects fire twice or zero times, and any redesign that decouples "screen the player sees"
from "phase the reducer is in" needs an equally explicit new invariant.

This slice takes the most conservative option that still satisfies the task's "内部eventは維持
してよい" (internal events may stay as-is) allowance: **`REGISTER_TO_DEX` itself, its exactly-
once `state.phase !== "RESULT" || !state.score` guard, and every line of `gameReducer.ts` are
completely unmodified.** Only the *trigger* moved — from a player tap on a "レシピ図鑑に登録す
る" button to an automatic second dispatch in `App.tsx`'s new `handleConfirmBake`:

```ts
function handleConfirmBake(value: number) {
  dispatch({ type: "CONFIRM_BAKE", value });
  if (!state.isMissionRound) {
    dispatch({ type: "REGISTER_TO_DEX" });
  }
}
```

Why this is safe:

- `useReducer`'s dispatch queue applies both actions in order against the accumulated state
  within the same synchronous event handler — the second dispatch sees `phase: "RESULT"` and
  `score` already set by the first, so the guard passes exactly once, exactly as it always has.
  Nothing about *how* the guard evaluates changed; only *when* the second action fires (an
  automatic follow-up dispatch instead of a later button tap) did.
- The guard itself is the same one thing that made this safe before: phase transition and
  side-effect application still happen in the same synchronous chain, just now both dispatches
  are back-to-back instead of separated by a render + user tap.
- Guarded on `state.isMissionRound` — the exact flag `REGISTER_TO_DEX`'s own Pitz-credit branch
  already reads for the identical purpose (`lastPitzCredit = state.isMissionRound ? null : ...`)
  — so Lunch Rush's `CONFIRM_BAKE` (shared action, same reducer case) never also triggers this;
  Mission rounds keep registering exclusively via their own already-existing `MISSION_NEXT_ORDER`
  path, completely untouched.

This means a FREE round's `state.phase` now goes `BAKE` → `RESULT` → `DISCOVERED` inside one
synchronous handler, so React only ever paints the final `DISCOVERED` state — there is no
render frame where the player sees the old score-only RESULT screen. `GameScreen.tsx`'s new
`isFreeResultScreen` flag (`!isMissionActive && (phase === "RESULT" || phase === "DISCOVERED")`)
renders one merged component for both of FREE's internal phases regardless, so even a
hypothetical stray dispatch that left `phase` at `"RESULT"` alone would still render a complete
screen, not the old truncated one.

**No reducer refactor, no new state field, no change to what `REGISTER_TO_DEX`/`CONFIRM_BAKE`
compute or guard.** This is the "UI/reducer decoupling," not "reducer redesign," the audit's
section 5/9 anticipated as the safe path.

## 3. Before/after flow

**Before:**

```
BAKE --取り出す！--> RESULT (score/stars only, ResultPanel)
                       --「レシピ図鑑に登録する」タップ-->
                     DISCOVERED (banner + Pitz summary + retry CTAs, separate action-row)
```

Two renders, two components, one bureaucratic-framed player action in between.

**After:**

```
BAKE --取り出す！--> DISCOVERED
                     (one merged ResultPanel: hero pizza already on screen above it,
                      short heading, de-emphasized score/stars, discovery/BEST banner,
                      Pitz credit, collapsed detail bars, retry CTAs)
```

One render, one component, zero player-facing registration action — `取り出す！` is now the
only tap between "baking" and "seeing everything about this round."

## 4. Reducer semantics preserved (evidence)

- `git diff <base> <head> -- src/state/gameReducer.ts` → **empty**. `CONFIRM_BAKE` and
  `REGISTER_TO_DEX` are byte-for-byte unchanged from `main`.
- Every existing reducer-level test that pins `REGISTER_TO_DEX`'s exactly-once guarantee,
  BEST-never-regresses, and the Mission-round backstop passes unmodified and untouched:
  `src/state/gameReducer.test.ts` (`REGISTER_TO_DEX (reducer)` describe block, including the
  double-dispatch idempotency case), `src/state/gameReducer.pitzReward.test.ts` ("credits Pitz
  exactly once, even if dispatched twice", "a stray REGISTER_TO_DEX dispatched against a Mission
  RESULT never applies a per-pizza credit"), `src/state/gameReducer.scoringV2Authority.test.ts`.
  None of these files were edited this session — their being green is direct evidence the
  invariant they pin still holds.
- New App-level integration test (`src/App.test.tsx`, "RESULT 2.0: auto-registers to Dex/Pitz on
  BAKE confirm...") exercises the real dispatch chain end-to-end through the actual `App`
  component (not a mocked reducer) and confirms: no `"レシピ図鑑に登録する"` button ever
  renders, the discovery banner/CTAs are present on the very first render after `取り出す！`,
  and `PizzaStage`'s DOM node identity is unchanged across the transition (no remount/rebuild).
- New Lunch Rush regression test (`src/App.test.tsx`, "Lunch Rush: CONFIRM_BAKE still shows
  MissionServePanel...") confirms a Mission round's `CONFIRM_BAKE` still lands on
  `MissionServePanel` (`次の注文へ`), never the merged FREE screen, and never applies a stray
  Pitz credit or discovery banner mid-run — i.e. the `state.isMissionRound` guard in
  `handleConfirmBake` does its job.

## 5. Scoring 2.0 unchanged (evidence)

`git diff aaf56edaea533f9efc63b3ba623bf1ae8425a6b5 e5d5452a6af05e3f8329a65226a0592df2df5def
--stat -- src/logic/scoringV2 src/logic/pitzReward.ts src/state/dex.ts src/data/
referencePizza.ts src/logic/scoring.ts src/state/gameReducer.ts` → **empty output**. No component
weights, Sauce/Pieces/Recipe/Bake scoring, Reference fixtures, or total-score calculation were
touched. `ResultPanel`'s score/stars/bars render the exact same `ScoreBreakdown`/
`ScoringV2Result` fields as before (presentation-only reflow: de-emphasized headline styling,
score-breakdown bars moved behind a collapsed `<details>`).

## 6. Pitz exactly-once evidence

See section 4 — the guard and its reducer code are unchanged, and both the pre-existing
double-dispatch idempotency test (`gameReducer.pitzReward.test.ts`) and this session's new
Mission-guard integration test pass. `applyPitzCredit`, `Recipe.baseRewardPitz`, and the
5-band quality-multiplier table are all untouched (zero diff, per section 5).

## 7. Test results

- **1198/1198 tests pass** (11 new: 7 in `src/components/ResultPanel.test.tsx` — heading render,
  no registration button, sauce row present/absent, banner mutual-exclusivity ×3, Pitz-summary
  present/absent/zero-note, CTA wiring; 3 new in `src/App.test.tsx` — auto-registration +
  completed-pizza-hero-persists, Lunch Rush regression, plus the existing retry/reset/
  Pitz-stable/persisted-state tests updated in place to drop the now-gone registration tap).
  0 regressions — every pre-existing test in the 1187-test baseline passes unmodified.
- **typecheck:** `npx tsc -b` — clean.
- **lint:** `npm run lint` (`oxlint`) — clean.
- **build:** `npm run build` (`tsc -b && vite build`) — clean, `dist/` output unchanged in shape
  (same asset graph, no new chunks).

## 8. Preview deployment

Deployed via `teto-pizza-game-preview`'s existing manual pipeline (unmodified, no new workflow
files):

1. `deploy-from-source.yml` (`workflow_dispatch`) with `ref=e5d5452a6af05e3f8329a65226a0592df2df5def`,
   `pr_number=75` → run [35365319803](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35365319803),
   **success**.
2. `pages.yml` (`workflow_dispatch`) dispatched as the documented safety net →
   run [35365391362](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35365391362),
   **success**.
3. `teto-pizza-game-preview`'s `README.md` on `main` confirms: Source ref/commit
   `e5d5452a6af05e3f8329a65226a0592df2df5def`, Source PR `#75`.

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
**Preview deployed SHA:** `e5d5452a6af05e3f8329a65226a0592df2df5def` (confirmed live — the
on-screen PREVIEW badge reads `PR#75 · e5d5452`, visible in every screenshot/frame in this
report and in the delivered video).

## 9. Review Playthrough

Recorded locally at 390×844 against a `VITE_PREVIEW_MODE=1` production build of the exact PR
head commit (same build flags `deploy-from-source.yml` uses), driven with Playwright/Chromium
(the environment's pre-installed browser) and converted to H.264 MP4 — delivered directly to the
user (not committed to the repo, per `docs/PROJECT_HANDOFF.md`'s standing rule).

**Scenario A — HOME → FREE → pizza select → make pizza → BAKE → RESULT:**
HOME's 「ピザを作る」 → Pizza Select (マルゲリータ) → DOUGH (radial stretch to completion) →
SAUCE → CHEESE → TOPPING (basil) → 焼く！ → BAKE gauge → 取り出す！. Lands directly on the
merged RESULT screen with a ~3s hold, exactly as scripted.

**Scenario B — RESULT → next action → Pitz/BEST/Dex → retry:**
On the merged screen: hero pizza (the player's own baked pizza, unchanged since BAKE) at top,
short heading ("マルゲリータ、もう少し焼いてもよかったかもな…"), de-emphasized stars/score/
bake badge, `✨ マルゲリータを発見しました！` discovery banner, Pitz credit summary
(`今回の獲得 +0 Pitz` / `基本報酬 100 Pitz` / `出来栄え倍率 ×0.00` / `所持Pitz 0→0`, this
round scored low on purpose to also confirm the 0-Pitz explanatory note renders), the collapsed
`くわしいスコアを見る` detail toggle (opened briefly on camera, then closed), then
`もう一度つくる` → lands back on a fresh DOUGH step for the same recipe.

**What the video confirms:**
- The player's own completed pizza is the hero — verified structurally too: a dedicated
  assertion in `src/App.test.tsx` confirms the exact same `.pizza-stage .pizza-dough` DOM node
  persists (`toBe`, not just `toBeInTheDocument`) from BAKE through the merged RESULT screen.
- Score/stars are legible but visually secondary to the pizza (smaller headline typography,
  `.result-panel__headline` styled as a compact de-emphasized row).
- The CTA is unambiguous (single primary "もう一度つくる" + secondary "別のピザを作る", no
  "register" framing anywhere).
- RESULT → next flow is a single tap, no intermediate screen.
- The pizza never changes mid-flow (same dough/sauce/toppings/bake-state visible at BAKE and at
  RESULT).
- No horizontal overflow at 390×844 (also independently verified at 360×800 — see below).

**Additional automated verification beyond the video** (Playwright, same local build):

- 360px-width check: `document.documentElement.scrollWidth === clientWidth === 360` both with
  the detail bars collapsed and expanded — zero horizontal overflow at the task's stated minimum
  width.
- 390×844 CTA-reachability check: both `もう一度つくる` (bottom: 776px) and `別のピザを作る`
  (bottom: 834px) render within the 844px viewport with no scroll needed — confirms the "CTAが
  画面外へ追い出されない" requirement structurally, not just by eye.

## 10. Known remaining Slice 2/3+ work

Per the Fresh Audit's own section 9 ordering and this task's explicit "Do NOT implement yet"
list — none of the following were started:

- Slice 3: feedback-line translation layer ("よかったところ" / "次はここ", per-component
  Sauce/Pieces/Recipe/Bake signal → one authored line each).
- Reveal sequencing / staged animation (stars → Pitz → BEST stagger) — audit section 8 found the
  static version is not obviously wrong on its own; left for a future slice only if playtesting
  says otherwise.
- Cooking Time / Efficiency scaffold.
- Pitz reward formula changes, Pitz/BEST animation polish.
- Dex 2.0, Shop 2.0, Inventory.
- New scoring, recipe expansion, character system redesign.
- Restoring `.pizza-perfect-glow`'s one-shot animation to feel intentional across the now-
  instant RESULT→DISCOVERED transition (currently fixed structurally — `resultRevealed` now
  covers both phases so the glow element stays mounted instead of unmounting mid-animation — but
  no visual polish pass was done beyond that structural fix).

## 11. Human Review checklist

- [ ] Open the Preview URL on a real device at/near 390×844: https://perusonao.github.io/teto-pizza-game-preview/
- [ ] Confirm the on-screen PREVIEW badge reads `PR#75 · e5d5452`.
- [ ] Play one FREE round end to end; confirm RESULT reads as "look at what I made," not "confirm
      a score and register it."
- [ ] Confirm the completed pizza is legible as *your own* pizza (matches what was actually
      placed), not a generic/reference image.
- [ ] Confirm score/stars are readable but don't visually dominate over the pizza.
- [ ] Confirm the retry CTA is obvious and reachable without scrolling, at 390×844 and near
      360px width if testing a narrower device.
- [ ] Confirm Pitz/BEST/Dex numbers match what you'd expect from the round just played (no
      double-counting, no missing credit).
- [ ] Try Lunch Rush once; confirm it is completely unaffected (still the compressed serve →
      immediate next-order flow, no merged-screen bleed-through).
- [ ] Decide: approve for merge, or request changes before Slice 2.

---

**PR stays OPEN** pending this Human Review — do not merge on CI green alone, per
`docs/PROJECT_HANDOFF.md`'s standard completion rule.
