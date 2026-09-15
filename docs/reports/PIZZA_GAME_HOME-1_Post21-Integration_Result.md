# PIZZA_GAME HOME-1: Post-PR#21 Integration Result

## Summary

PR #25 (`claude/teto-pizza-home-game-icon-i8xofr`, Issue #24: HOME/GAME
separation + App Icon/PWA) was originally built against `origin/main` at
`45362e2` (Phase 3C-6). Since then, PR #21 (Phase 4A-1A: Reference Sauce
Quantity Prototype) merged into `main`, moving `main` to `0c880f6`. This
integration brings PR #25 up to date with that new `main` so it can be
reviewed/merged without losing either feature set.

- **Base before integration:** `origin/main` @ `45362e2` (PR #25's original base)
- **Main after PR #21:** `origin/main` @ `0c880f6` (confirmed via fresh
  `git fetch origin main`)
- **PR #25 branch before integration:** `claude/teto-pizza-home-game-icon-i8xofr`
  @ `b6b0c395f8d82d7e88ee3decab3b0f0000f6ed11`
- **PR #25 branch after integration:** `5a2184fb69bb13101c726b904a18dc7a0f2db3ce`
  (one merge commit of `origin/main` into the PR #25 branch, pushed to the
  same branch/PR)

No `git rebase`/history rewrite was used — a plain `git merge origin/main`
was performed and pushed as a new commit, per instructions not to alter
existing PR #25 or PR #21 history.

## What conflicted and why

`git merge origin/main` produced conflicts in exactly two files:

- `src/App.css` — purely additive on both sides (PR #25 added a `HOME /
  GAME screens` CSS section, PR #21 added a `Phase 4A-1A: Reference Sauce
  Quantity prototype` CSS section). Resolved by keeping both blocks,
  concatenated in the order git presented them. No rule was dropped or
  overwritten on either side.
- `src/App.tsx` — PR #25 restructured the component, extracting the GAME
  view's entire JSX into a new `src/screens/GameScreen.tsx` component
  (`App.tsx` kept only state/reducers/handlers and now renders
  `<HomeScreen>` / `<GameScreen>`). PR #21, working from the pre-split
  `App.tsx`, added its Reference Sauce Quantity prototype (imports,
  `isReferencePopoverOpen`/`pendingSauceDeposits` state, the
  `handleDispenseProgress`/`handleDispenseCommit` handlers,
  `referencePizza`/`referenceModeEnabled`/`sauceMetrics`/`sauceShadowScore`
  derived values, and the `<ReferencePreview>` / `<SauceMetricsPanel>` JSX)
  directly inline in the old flat JSX. Git's 3-way merge auto-resolved most
  of this (state hooks, handlers, effects landed without conflict); the
  only genuine conflicts were the import block and the two JSX regions that
  PR #25's extraction and PR #21's new inline JSX both touched.

## How the semantic merge was done

Rather than mechanically picking one side, PR #21's Reference Sauce
Quantity feature was relocated to live where PR #25's extraction now
expects GAME-view JSX to live:

1. **`src/App.tsx`** keeps owning all state (`isReferencePopoverOpen`,
   `pendingSauceDeposits`), all handlers
   (`handleDispenseProgress`/`handleDispenseCommit`), and the derived
   values (`referencePizza`, `referenceModeEnabled`, `sauceMetrics`,
   `sauceShadowScore`) — matching the existing rule that `App.tsx` never
   duplicates game logic into either screen. These are now passed down to
   `<GameScreen>` as new props alongside the pre-existing HOME/GAME
   navigation props.
2. **`src/screens/GameScreen.tsx`** gained the new props
   (`referenceModeEnabled`, `referencePizza`, `isReferencePopoverOpen`,
   `sauceMetrics`, `sauceShadowScore`, `onReferencePopoverChange`,
   `onDispenseProgress`, `onDispenseCommit`) and now renders
   `<ReferencePreview>` and `<SauceMetricsPanel>` in the same relative
   positions PR #21 placed them (a `.reference-tools-row` under
   `<PizzaStage>`, `<SauceMetricsPanel>` just above the ingredient tray
   during PREPARE), and forwards `referenceModeEnabled` /
   `onDispenseProgress` / `onDispenseCommit` into `<PizzaStage>`.
3. `src/components/PizzaStage.tsx`, `src/state/gameReducer.ts`,
   `src/state/pizzaState.ts` and all of PR #21's new files
   (`src/data/referencePizza.ts`, `src/logic/sauceField.ts`,
   `src/logic/sauceDispenseController.ts`,
   `src/logic/pointerTimestampNormalizer.ts`,
   `src/logic/referenceScoring.ts`, `src/components/ReferencePreview.tsx`,
   `src/components/SauceMetricsPanel.tsx`, and their test files) merged
   automatically with no manual changes — PR #25 never touched any of
   these.

No save schema, scoring, Dex BEST, Mission, Pitz, or Shop semantics were
touched by this integration; only import/JSX wiring was changed to
reconcile the two branches' independent structural changes.

## Feature verification

Both feature sets were confirmed present and working after the merge:

- **PR #25 (HOME/GAME/App Icon/PWA):** HOME screen (Teto hero, Pitz/Dex
  live counts, 2×2 menu), GAME screen with 🏠 ホーム back button and
  in-progress confirmation dialog, `public/manifest.webmanifest`,
  `public/icons/*.png` (16/32/40/58/60/76/120/180/192/512/512-maskable),
  and `index.html`'s favicon/apple-touch-icon/manifest links — all intact.
- **PR #21 (Phase 4A-1A Reference Sauce Quantity):** the 見本 (Reference)
  button and its popover, the Prototype Metrics panel (量/被覆/均一性/
  はみ出し), and the tomato-sauce paint/dispense gesture on `PizzaStage` —
  all present and functional in the new GAME screen for the Margherita
  FREE-play flow, gated correctly to FREE Margherita only (never Mission
  play, never any other recipe), exactly as before the merge.

## Verification commands

All run from a clean `npm install` on the merged branch:

| Check | Result |
|---|---|
| `npx tsc -b` | Clean, no errors |
| `npm run lint` (oxlint 1.82.0) | Clean, 0 errors |
| `npx vitest run` | **374/374 tests passing** (23 test files) |
| `npm run build` (`tsc -b && vite build`) | Clean, `dist/` produced (icons, manifest, index.html all present with correct `/teto-pizza-game/` base paths) |
| `git diff --check` (vs. `origin/main` and vs. merge-base) | Clean, no whitespace errors or stray conflict markers |

## Browser verification (390×844, `vite preview`)

Walked with Playwright (Chromium) at a 390×844 viewport against the
production build:

1. **HOME** — hero, CTA, 2×2 menu render correctly; Pitz `0` / Dex `0/7`
   read live from persisted state.
2. **HOME → GAME (ORDER)** — "ピザを作る" → GAME's ORDER phase with Mito's
   order line; reloaded until a Margherita order came up (recipe rotates).
3. **GAME (ORDER) → PREPARE** — "フリープレイ" → PREPARE phase renders the
   sauce category tray, 見本 button, and Prototype Metrics panel
   (量 0% / 被覆 0% / 均一性 100% / はみ出し 0% on an empty pizza).
4. **見本 (Reference) popover** — opens correctly over a backdrop, shows
   the Margherita reference mini-pizza and its 量/塗り広げ target bars;
   closes correctly via 閉じる.
5. **Sauce Painting** — a pointer drag over the dough produced a visible
   sauce heatmap and live-updated Prototype Metrics (量 6% / 被覆 5% /
   均一性 68% / はみ出し 0%), confirming `onDispenseProgress`/
   `onDispenseCommit` wiring through `App.tsx` → `GameScreen.tsx` →
   `PizzaStage.tsx` survived the merge.
6. **GAME → HOME** — with a round in progress (PREPARE), tapping 🏠 ホーム
   raised the native `confirm()` dialog (accepted), and the app correctly
   returned to HOME.

No console errors or page errors were observed at any step.

## PR #25 state after push

- Pushed to `claude/teto-pizza-home-game-icon-i8xofr` (same PR #25,
  history preserved — no force-push).
- `pull_request_read get` reports `mergeable_state: "clean"` against
  `main` @ `0c880f6`.
- GitHub Actions `build` check on head commit `5a2184f`: **completed,
  conclusion `success`** (run
  [34937613488](https://github.com/perusonao/teto-pizza-game/actions/runs/34937613488)).

## Verdict

**MERGE READY.** All local verification (tsc/oxlint/vitest/build/git diff
--check) passed cleanly, the GitHub Actions `build` check on the pushed
head commit (`5a2184f`) is green, both PR #21's and PR #25's features are
confirmed present and working together at 390×844, `mergeable_state` is
`clean` against `main` @ `0c880f6`, and no save schema / scoring / Dex
BEST / Mission / Pitz / Shop semantics were changed. No Phase 4A-1B work
was introduced. Per instructions, PR #25 was **not** merged — that step
is left for the user.
