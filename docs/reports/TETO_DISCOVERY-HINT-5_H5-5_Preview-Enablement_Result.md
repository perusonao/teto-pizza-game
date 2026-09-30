# Discovery Hint 5.0 — H5-5 Preview Enablement: Result

- **Issue:** #292.
- **Branch:** `claude/hint-5-5-preview-enablement`, a separate branch from the H5-4 PR (#297).
- **Base:** H5-4 PR head `399b6c8` (H5-4 code `89451bd` + the Activation Gate report). `main` is `86b48fd`.
- **Owner decisions applied:** OD-H5-PREVIEW-1 = GO (Preview only). OD-H5-ECON-1 = ACCEPT (the economy is unchanged).

**Scope.** For the Owner's iPhone Human Verification only. It adds a way to turn Hint 5.0 on in a
**Preview** build, from the URL, and Preview-only scenario seeds.

- **The production flag stays OFF.** A production build ignores every parameter here and contains none
  of the helper code.
- **No Preview deploy was made.**
- **Not changed:**
  - the H5-4 PR (#297) and `main`;
  - PR #275 / #293 / #295 / #296 and the W2-A branch;
  - TQ, taxonomy, recipes and the economy;
  - the ladder code and the reducer (no no-sauce hint).

## 1. What was added

| File | Change |
|---|---|
| `src/preview/hint5PreviewOptIn.ts` (new) | `?hint5=1` turns the ladder on and remembers it in a Preview-only key (`teto-pizza-preview-hint5-optin`); `?hint5=0` turns it off; with no parameter the stored value decides. A failing storage never throws. |
| `src/preview/hvSeeds.ts` (new) | 7 Human Verification scenarios, and `applyPreviewHvSeed` for `?hv=<scenario>`. The seed goes through the game's own `resetSave` / `persistProgress`, so it is a valid save in the build's own save key. |
| `src/logic/discovery/hint5Flag.ts` | The flag is now `devOptIn() \|\| previewOptIn()`. `previewOptIn` runs only behind `import.meta.env.DEV \|\| import.meta.env.VITE_PREVIEW_MODE` (the same principle as `DINNER_PREVIEW_ALLOWED`). |
| `src/main.tsx` | Calls `applyPreviewHvSeed` only behind `import.meta.env.VITE_PREVIEW_MODE`, before the app loads its save. |
| `src/logic/discoveryLadder.test.ts` | One line: `../preview/hvSeeds.ts` is a sanctioned ladder reader in the wiring-boundary allowlist (read-only; compiled out of production). |
| Tests | `src/preview/hint5PreviewOptIn.test.ts`, `src/preview/hvSeeds.test.ts`, `src/preview/previewIsolation.gate.test.ts` (a real production-bundle scan), `e2e/hint5-preview.spec.ts` (real builds) |

**Design points**
- **Seeds run in Preview builds only.** A DEV server does not seed, so a developer's local save is never
  overwritten. The opt-in works in DEV as well, as the existing DEV opt-in did.
- **A seed applies to a fresh navigation only, never to a reload.** So:
  - a reload keeps the Owner's progress;
  - Full Game Reset (which reloads the page) ends in a real initial state;
  - opening a scenario URL again restarts that scenario.
- **Full Game Reset clears the Preview save only.** The opt-in key is separate, so the ladder stays on
  after a reset.

## 2. Gates P1 to P12

| Gate | Result | Evidence |
|---|---|---|
| **P1** Production bundle: Preview Hint 5 code / key = 0 | **PASS** | `previewIsolation.gate.test.ts` runs a real `vite build` of production and of Preview, and scans the output. The production bundle has none of: the helper mark, the opt-in key, 6 seed ids, all 7 seed labels, the Preview save key, the DEV opt-in key. The Preview bundle has all of them (so the scan is proven to see what it looks for). |
| **P2** Production URL `?hint5=1`: flag OFF | **PASS** | E2E on the built production app: the old sheet, no ladder, no Preview badge |
| **P3** Production URL: HV seed parameter has no effect | **PASS** | E2E: with a planted production save (999 Pitz, 8 recipes), `?hv=cheese-none` leaves it as it was; no Preview key and no opt-in key are written |
| **P4** Preview build without opt-in: old behaviour | **PASS** | E2E |
| **P5** Preview `?hint5=1`: Hint 5.0 | **PASS** | E2E: the ladder appears, the old purchase button is gone; the opt-in survives a load without the parameter; `?hint5=0` turns it off |
| **P6** Preview seed: production save unchanged | **PASS** | E2E: a planted production save is byte for byte the same after 3 seeds (the production and Preview builds share one origin in the test, like `perusonao.github.io`). Unit test: the seed reads and writes only the Preview key. |
| **P7** Reload keeps the Preview state | **PASS** | E2E: a bought 「チーズなし」, the Pitz and the next rung survive a reload, with no recharge and no reseed |
| **P8** Full Reset resets the Preview namespace only | **PASS** | E2E through the real settings UI: the production save is unchanged, the Preview save is a real initial state, the opt-in stays on, and the seed does not come back |
| **P9** The HV scenarios reproduce | **PASS** | 7 of 7 (§4), each also restarts when its URL is opened again |
| **P10** 390×844 layout | **PASS** | no horizontal overflow, the sheet inside the viewport, 「たずねる」 and 「閉じる」 at least 44 px, no clipped text, at every scenario state |
| **P11** 360×800 layout | **PASS** | the same |
| **P12** No regression in Dinner / other Preview behaviour | **PASS** | `dinner-mission`, `dinner-settlement-dm4-3`, `save-dinner-records-dm4-2`, `save-forward-compat-3-4b` and the existing hint specs pass; layout-contract 12 / 12 |

**The gates catch a leak (mutation check).** Two mutants were tried and reverted:
- removing the `DEV || VITE_PREVIEW_MODE` guard in `hint5Flag.ts` was killed by the bundle scan and by the
  production-URL E2E;
- removing the guard on the seed call in `main.tsx` was killed by both as well.

The first version of the scan also found a real leak. A top-level `new Set(...)` over the seed table kept
the whole table in the production bundle even though nothing called it. It was removed.

## 3. Isolation results

**Production bundle** (the real `vite build`, no `VITE_PREVIEW_MODE`):

| String | Occurrences |
|---|---:|
| helper mark, opt-in key, every seed id and label | 0 |
| Preview save key, DEV opt-in key | 0 |

**Production save.** The Preview build keeps its save under `teto-pizza-preview-save-v1`, never the
production key. The seed uses the ordinary save writer, so:
- it cannot read or write `teto-pizza-save-v1` (the unit test records every key read);
- in the E2E, a planted production save stayed byte for byte identical through seeds, a reload and a Full
  Game Reset.

## 4. Owner HV scenarios and Preview URLs

**URL pattern:** `https://perusonao.github.io/teto-pizza-game-preview/?hint5=1&hv=<scenario>`
(the Preview repo's URL from the Issue #39 Preview Gate; it applies once a Preview is deployed).

| Scenario | URL | What to check |
|---|---|---|
| **A** normal (meat-lovers) | `…/?hint5=1&hv=normal` | 「ヒント1: ソース 10 Pitz」. Buy it and the next rung is 「ヒント2: チーズ」. |
| **B** cheese-none (marinara) | `…/?hint5=1&hv=cheese-none` | Sauce is already done. 「ヒント2: チーズ 10 Pitz」 says nothing about 「なし」. After buying, the row reads 「チーズ」 \| 「なし」 (290 Pitz). |
| **C** key-none (quattro-formaggi) | `…/?hint5=1&hv=key-none` | Sauce and cheese are done. 「ヒント3: キートッピング 10 Pitz」 shows no 「なし」. After buying: 「キートッピング」 \| 「なし」. Then structure completes the ladder. |
| **D** M3 already-known (meat-lovers) | `…/?hint5=1&hv=already-known` | The offer looks like a fresh save's. Tapping shows 「このヒントはもう知っていたよ！」 and Pitz stays at 300. |
| **E** multiple SUB_CLASS (capricciosa) | `…/?hint5=1&hv=multi-sub` | 「ヒント5: サブトッピング①の分類 5 Pitz」. Buy ①②③: ハーブ・香味系 / 肉系 / 野菜・きのこ系, and no ingredient names. |
| **F** last SUB_CLASS (capricciosa) | `…/?hint5=1&hv=last-sub` | Only 「ヒント7: サブトッピング③の分類」 is left. Buying it completes the ladder: 「ここまでのヒントで、推理してみよう！」. |
| **G** low Pitz (meat-lovers) | `…/?hint5=1&hv=low-pitz` | 12 Pitz. The sauce is buyable; after it (2 Pitz) the button is disabled and a note appears. |

Each URL opens the recipe directly in Free Cooking: tap 「フリークッキング」 then 「ヒント」.

**How the Owner drives it**
- **Restart a scenario:** open its URL again from the address bar or a link (a fresh navigation).
- **Reload check (item 7):** pull to reload. Progress stays, and the seed is not applied again.
- **Full Reset check (item 8):** settings (⚙️) → 「ゲームデータをリセット」. The page reloads into a real
  initial state, with Hint 5.0 still on.
- **Turn Hint 5.0 off:** `…/?hint5=0`. On again: `…/?hint5=1`.
- **The production save is never touched.**

**Note for the clipping check (item 10).** The existing Preview badge (「PREVIEW · PR#… · sha」, bottom
right, `pointer-events: none`) sits over the right end of the sheet's last line (「所持 … Pitz」). It is
Preview infrastructure, not part of the production UI, and it does not block taps. It is not a Hint 5.0
defect.

The Owner iPhone HV checklist itself is in the Activation Gate report §8.

## 5. Preview smoke (a real Preview-form build, run end to end)

A real Preview build (`VITE_PREVIEW_MODE=1`, base `/teto-pizza-game-preview/`) was served and driven in
Chromium at 390×844:

| Scenario | Result |
|---|---|
| normal | offer 「ヒント1: ソース」 (300 Pitz) → bought: 290 Pitz, 「ソース トマトソース」 on the board |
| cheese-none | the offer has no 「なし」 → after buying, 「チーズなし」 (290 Pitz) → **the same after a reload** |
| key-none | the offer has no 「なし」 → after buying, 「キートッピングなし」 → structure → the complete line (285 Pitz) |

**0 page errors.** Deploying it was not part of this step.

## 6. Test results

| Check | Result |
|---|---|
| `tsc -b` | clean |
| `oxlint` | 0 errors; the 2 pre-existing warnings |
| Vitest | **228 files · 4637 passed · 1 skipped** (pre-existing). H5-4 had 4614; the 23 new tests are in `src/preview/`. |
| Focused: `src/preview/*` | 23 / 23 (parser 8, seeds 12, production-bundle scan 3) |
| E2E Chromium 390×844 + 360×800: `hint5-preview` (new), `discovery-hint5-ladder`, hint-sheet, facts-save, dex-hint, Dinner, Dinner settlement, save specs | **86 passed**, 8 skipped (pre-existing per-engine skips) |
| The new `hint5-preview` spec alone | 14 tests on each of the two viewports, all passed |
| E2E `layout-contract` | 12 / 12 |
| `vite build` | OK |

**Screenshots** are committed under `docs/reports/screenshots/hint-5-h5-5/`: for every scenario the
opened state and the state after the action, at 390×844 and 360×800, plus the production-URL case
(`prod-hint5-param-ignored`). No video: nothing in the production UI changed.

## 7. What is not verified

- **WebKit.** The new `hint5-preview` spec builds the app twice, so it takes longer than the other specs,
  and it runs on the WebKit projects in CI. It passes on Chromium only. Safari-specific behaviour, most of
  all the `navigate` / `reload` navigation type the seed relies on (Navigation Timing Level 2), shows only
  in CI or on the Owner's iPhone.
- **The real Preview deployment** and the shared `perusonao.github.io` origin. The E2E reproduces the
  shared origin locally.

## 8. Remaining blockers and next step

There is no code blocker.

1. **A PR for this branch (or an Owner go to open one)** so that CI, including WebKit, runs on the
   H5-5 head before the Preview is deployed. The Preview pipeline builds a chosen source commit; this
   branch contains the H5-4 code, so a Preview of its head shows everything.
2. **The Preview deploy itself** (the Preview repo's manual dispatch), which needs an Owner go. Pass a
   source commit that includes this branch's head, and `VITE_PREVIEW_PR` for the badge.
3. The Owner's iPhone HV (Activation Gate report §8), then the production flag decision (a separate phase).

**Owner Decisions still open:** the production flag ON, and OD-H5-P4-SAUCE (waits on TQ-1D).

**STOP.** The production flag is OFF, nothing was deployed or merged, and no other branch was changed.

## 9. Preview deployed, and the Owner iPhone HV (2026-09-29)

- **Deployed:** the Preview repo built `4d090b599c3782427ad7dc4a71b472f5a3c83cb9` (PR #298) as `a2ffc82`,
  through `deploy-from-source` (run 36513501881) and `pages.yml` (run 36513568094). Badge
  `PREVIEW · PR#298 · 4d090b5`. Production flag OFF; no production deploy.
- **Owner iPhone HV (Owner-reported, public URL): A normal, B cheese-none, C key-none, D already-known,
  E multi-sub, F last-sub, G low-pitz = PASS, 7 / 7.** Details are in the Production Activation Gate
  report §12.2. Screenshots are Owner-held and not committed.
- **Known Preview-only visual issue (recorded, not fixed, not a production blocker):** the Preview badge
  partly overlaps the last Hint-sheet line 「所持 … Pitz ・ …」 (`pointer-events: none`, so no operation is
  blocked). It exists only in Preview builds.
