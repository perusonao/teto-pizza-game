# Original Pizza Recovery P3-3b — RESULT duplicate notice (Result)

- **Verdict: A. P3-3b DUPLICATE NOTICE COMPLETE** (PR pending the P3-3a post-merge E2E confirmation, see §9)
- **Base:** `origin/main` = `22263bddf8a80a6c6e1c3c2ab90a43b1cb44a6d7` (P3-3a merged as PR #316). Branch `claude/p3-3b-result-duplicate-notice` = main + this slice only (no P3-2, no P3-3c, no P3-4).
- **Authority:** P3-3 Fresh Audit, OD-P3-19 (order P2 line → notice; `#n` only, never `retryCount`), OD-P3-16 (eligibility unchanged from P3-3a), P3-3a record result `GameState.lastTrialAttempt` as the **only** display authority.
- **Human Verification Policy:** triggered (visible RESULT change); followed — screenshots committed (§6), video delivered directly (§7).

## 1. What changed (production)

| File | Change |
|---|---|
| `src/state/originalResultCopy.ts` | `duplicateTrialNoticeJa(number)`: `📓 前にも同じ材料の組み合わせで作ったよ（試作#n）`; `null` unless `number` is a positive integer. |
| `src/components/ResultPanel.tsx` | new prop `trialNoticeNumber?: number \| null`; on the **ORIGINAL card only**, after the P2 row and before the note: `<p className="original-pizza__trial-notice">` (static paragraph, no `aria-live`, no `role`). Scored / known / FAILED cards never render it. |
| `src/screens/GameScreen.tsx` | one relay expression: `state.freeCook && state.lastTrialAttempt?.kind === "DUPLICATE" ? state.lastTrialAttempt.number : null`. |
| `src/App.css` | one rule `.original-pizza__trial-notice` (12px, weight 700, centered, `max-width: 320px`). |

Nothing else: no Notebook CTA / overlay / entry, no Dex or Builder change, no persistence, no reducer change, P2 line and P3-3a record semantics untouched.

## 2. Authority and eligibility

- **Display authority = the record result.** The notice shows `state.lastTrialAttempt.number`, written once by the P3-3a commit and reset each fresh round. It never looks the notebook up at render time (a test replaces the notebook with an empty one after the commit: the notice is unchanged; another sets a different `number`: the notice follows it).
- **Shown only when** free cook ∧ ORIGINAL card ∧ `kind === "DUPLICATE"`. Not shown for NEW, INCOMPLETE_MATCH, NEW_DISCOVERY, a known pizza, FAILED, guided, Lunch Rush, Dinner (each tested on reducer-produced states). AMBIGUOUS follows the ordinary Original authority (same lead, same notice). Identity eviction after 2 000 → NEW → no notice. REVIVE → the original stable `#n`. A reload starts a session with no notebook → no notice.
- **Privacy:** the DOM holds the exact sentence and `#n` only: no recipe id / name / description, no distance, candidate, collision, hidden ingredient, Hint 5.0 fact, technique answer, `×n` or retry count (panel HTML scanned against all recipes and forbidden words, unit and real browser).

## 3. Accessibility

The notice is a static `<p>` inside no live region; the P2 row keeps exactly one live region (its text paragraph) and is byte-identical with and without the notice; the ORIGINAL card's live-region count does not change. The meaning is in the words (📓 + sentence), not in colour. Gates and mutants pin: no `aria-live` / `role` on or around the notice; the P2 row container has no live region.

## 4. Tests

| Suite | Count | Covers |
|---|---:|---|
| `src/screens/GameScreen.duplicateNotice.test.tsx` | 24 | requested 1–20 through the real GameScreen + ResultPanel on reducer-produced states (and `useReducer(gameReducer)` for re-render stability): NEW none, second → notice, stable `#n` across the third, no `retryCount`, different fingerprint none, re-render stable / DOM byte-identical / no extra record, HOME → FREE → notice, guided / Lunch Rush / Dinner / INCOMPLETE / known / FAILED / NEW_DISCOVERY none, AMBIGUOUS, REVIVE, eviction, no re-lookup, static paragraph + live-region count, privacy, P2 row unchanged and in order |
| `src/components/ResultPanel.duplicateNotice.test.tsx` | 6 | component boundary: number → notice; null / 0 / negative / non-integer / NaN → none; not free cook → none; scored / FAILED / INCOMPLETE cards → none; P2 row semantics |
| `src/state/duplicateTrialNotice.test.ts` | 3 | the copy function |
| `src/state/trialRecord.gate.test.ts` (extended) and `trialNotebook.gate.test.ts` | — | one GameScreen relay expression; the panel never mentions the notebook / `retryCount`; notice placement (after the P2 row, before the note, ORIGINAL branch only); determinism (no clock / randomness / storage); copy has no forbidden words; only GameScreen reads the record result |
| `e2e/original-result-duplicate-notice.spec.ts` (real Chromium, real gestures) | 4 | two real rounds on a Dex 3 save: first has no notice, the identical retry shows 「試作#1」, a third keeps `#1`; FAR (different height); a different combination none, INCOMPLETE_MATCH none, the first combination again is still `#1`; a reload resets |

## 5. Geometry (real Chromium, all 7 Layout Contract profiles; `docs/reports/data/…P3-3b_ResultGeometry.json`)

Checked per profile, with and without the notice: no horizontal overflow; both CTAs fully on screen above the bottom inset, ≥ 44px tall, not overlapping; the notice inside the viewport, in order (P2 row → notice → note), and reachable above the fixed action bar; **the fixed action bar and the primary CTA at exactly the same position with and without the notice**; the end of the content reachable above the bar.

| Profile | Extra scroll without → with notice (px) | Notice height |
|---|---|---|
| 390×844, 360×800, 390×664, 360×640 (and P390i) | 0 → 0 (no scroll at all) | 16.2 (one line) |
| E390i (390×664 + safe area) | 4 → 30 | 16.2 |
| E360i (360×640 + safe area) | 28 → 54 (FAR: 53 → 79) | 16.2 |

Only the safe-area short profiles scroll, exactly as before (`.game-screen` is the scroller; the action bar is fixed; the panel's bottom reserve keeps the last content above it). The notice adds one line (+26px of scrollable height at most) inside that existing scroll; it never pushes the bar.

## 6. Screenshots (committed: `docs/reports/screenshots/p3-3b-duplicate-notice/`)

Before (no notice, first attempt) / after (duplicate notice) at 390×844, 360×800, 390×664, 360×640 for ADD_ONE and FAR, plus INCOMPLETE_MATCH (no notice): `add-one-1-no-notice-*`, `add-one-2-duplicate-notice-*`, `far-1-no-notice-*`, `far-2-duplicate-notice-*`, `incomplete-no-notice-*`.

## 7. Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `p3-3b-duplicate-notice-390x844.webm` | 390×844 | 32.8 s | 1 604 857 B (1.5 MB) | PASS |

Download: delivered directly in the session (never committed; `artifacts/` is gitignored).
Format: **WebM / VP8** (Playwright's recorder; the environment has only Playwright's bundled VP8-only ffmpeg, no H.264 encoder, so an MP4 could not be produced — allowed by the Policy §5 fallback).

What to check in the video:
1. A first ORIGINAL RESULT (P2 「おしい！」 line + hint pill) with **no** notice.
2. 「もう一度じゆうに作る」 and the same combination: the same card now shows 「📓 前にも同じ材料の組み合わせで作ったよ（試作#1）」 **under** the P2 line, above the note; the bottom buttons do not move.
3. A different combination (FAR): no notice (a new attempt).
4. The first combination again: still 「試作#1」.
5. HOME still works.

Video Verification: PASS (exists; 1.5 MB; 390×844 VP8, 25 fps; decoded end to end = 820 frames = 32.8 s; frame inspection shows the notice in state 2 and 4 and its absence in 1 and 3).

## 8. Verification

- Mutation (`node tools/duplicate_notice_mutation.mjs`, data `…P3-3b_DUPLICATE-NOTICE_Mutation.json`): **20 mutants, 20 killed, 0 survived.** (A first run had 3 survivors — the panel-level free-cook guard, a clock/randomness source in the notice, a live region on the P2 row container; each got a test or gate and the suite was re-run in full.) Covers: always-shown, wrong number, NEW shown, missing free-cook guards (screen and panel), render-time re-lookup, retry count in copy, "same result" wording, 0 / non-integer numbers, `aria-live` / `role`, wrong order (before P2, after the note), known-card rendering, notebook mentions, clock / randomness, altered P2 row text, live region on the P2 container.
- Full Vitest: **275 files, 5 323 passed, 1 skipped, 0 failed** (P3-3a: 272 / 5 285).
- `tsc -b` clean · `oxlint`: only the 2 pre-existing warnings · `npm run build` passes.
- Chromium: new spec + Layout Contract + near-miss RESULT + Free Cooking Phase 3-2 specs, `layout-chromium`, `iphone-390x844`, `iphone-360x800`: **24 passed, 8 skipped** (the intentional once-per-engine skips). WebKit runs in CI.

## 9. Process note — P3-3a post-merge E2E WebKit

P3-3a merged as `22263bd`; "Deploy to GitHub Pages" succeeded. The push-triggered "E2E WebKit" run showed **cancelled**: every test step passed on every shard, but `webkit-360x800 shard 1/2` spent 10 min 19 s in "Install WebKit (with system deps)" (14:21:35 → 14:31:54), after which the job ended as *cancelled* at ~15 min (job time limit) although its test step succeeded; the WebKit Gate then failed closed on the cancelled shard. A CI infrastructure timeout, not a test or code failure. The failed jobs were re-run once (see the final report for the result). The PR for P3-3b is opened only after that re-run is green.

## 10. Not done (by scope)

Notebook CTA, overlay, RESULT Notebook entry (P3-3c); Dex header entry, Discovery Memo UI (P3-4 / P3-2); Builder duplicate notice; persistence; any change to record eligibility.
