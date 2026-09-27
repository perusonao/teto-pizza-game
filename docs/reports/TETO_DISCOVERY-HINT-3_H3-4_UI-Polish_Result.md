# Discovery Hint 3.0 — H3-4 UI Polish / Human Verification: Result (Issue #238)

> Status: **Implemented. The PR is OPEN for Owner review. No merge, no auto-merge.**
>
> - Scope: presentation only. The code changes are in `HintSheet.tsx` and the `.hint-sheet*` CSS.
> - Authority, persistence and migration, the reducer, and the double-purchase protection are
>   unchanged.
> - No Dinner / DM-3R-* file and nothing from PR #243 is touched.

## 1. Audited main / Issue / PR / HEAD

| Item | Value |
|---|---|
| `origin/main` at start (fresh check) | `726b0ac` (Merge PR #249, DM-3R-1). It had not moved since the Fresh Audit. No DM-3R-2 PR existed. |
| Fresh Audit | `docs/reports/TETO_DISCOVERY-HINT-3_H3-4_Fresh-Audit.md`, commit `d5a3a90`, verdict B (Owner decisions required) |
| Issue | #238 (the parent of every Hint 3.0 slice; the Duplicate Gate found no H3-4 issue or PR) |
| Branch | `claude/h3-4-fresh-audit-5hhkoi`: `main` + the audit commit + this implementation. That is linear history on top of the latest `main`, so the branch was reused. |
| PR | #251 (`main` ← `claude/h3-4-fresh-audit-5hhkoi`), OPEN, no auto-merge |
| Final HEAD | The docs-only commit that records this table, on top of `9a47b6e`. The code is unchanged since `9b3db21`. CI was verified green on `9a47b6e` (§11). |

## 2. Owner Decisions (Owner Authority, recorded)

| ID | Decision | Implemented as |
|---|---|---|
| OD-H3-4-1 | Z-A: at price 0, 「ヒントをたずねる」 + 「支払いずみ」. Never "sold out" or "free". Never disabled just because the price is 0. No new pre-request signal of whether facts remain. | `capPaid = nextPrice === 0 && !onboarding`. The label and badge change, the CTA stays enabled, and the wallet line reads 「このピザのヒント代は上限まで支払いずみ」. |
| OD-H3-4-2 | A fixed line saying Pitz is spent only when a hint is given | Wallet line: 「所持 {n} Pitz ・ Pitzはヒントが出たときだけ使うよ」 |
| OD-H3-4-3 | Disable + relabel **only after** the authority answered GUIDANCE_ONLY | `outcome === "GUIDANCE_ONLY"` shows 「今あるヒントはここまで」 (disabled) and the wallet line 「今回はPitzを使っていないよ」. Focus moves to 閉じる. |
| OD-H3-4-4 | G-A: 「以前のヒント」 as a separate archive section at the end of the body | A dashed, muted box after the guidance line, with its title and 「前のヒント方式で買ったメモ（そのまま残してあるよ）」. The lines no longer use the step pill. |
| OD-H3-4-5 | The legend says "preference, not availability". A privacy-safe fallback explanation. A light highlight for new chips. | Legend 「知りたいジャンル（ないときは別のジャンルから1つ）」. `.hint-sheet__chip--new` (ring + one pulse; none with reduced motion) on chips revealed by the last request. |
| OD-H3-4-6 | Keep 「？」 and add a fixed legend that some categories go unused | 「？＝まだわからない（使わないジャンルもあるよ）」 under the rows, the same for every target |
| OD-H3-4-7 | Keep 45dvh. Compact the footer as needed. A scroll affordance. Controls and CTA reachable. The stage does not move. | Legend merged into one line. Preferences are a 3-column grid at 44 px height. The Selectable CTA is 44 px. Footer height is unchanged (132 px). A top/bottom fade + 「▾」 cue driven by scroll / ResizeObserver / resize. |
| OD-H3-4-8 | A: Dex-0 Margherita onboarding unchanged | The TARGET branch is untouched (「次のヒントを見る」, 「✨ はじめてのピザはヒント無料！」) |
| OD-H3-4-9 | CTA 「ヒントを1つもらう」, no 🔒 | 「ヒントを1つもらう {n} Pitz」. When unaffordable, the same label, disabled in grey. |
| OD-H3-4-10 | No economy numbers change in H3-4; H3-ECON-1 is a follow-up | No price, ladder, cap or parity change (§14) |

## 3. Changed files

| File | Change |
|---|---|
| `src/components/HintSheet.tsx` | The SELECTABLE body only:<br>- the H3-4 copy table (`SELECTABLE_COPY`, module-private);<br>- the price-0 branch;<br>- the post-GUIDANCE_ONLY CTA state;<br>- a new-chip diff + highlight, with the first new chip scrolled into view;<br>- the archive block moved to the end;<br>- the 「？」 legend;<br>- a `useScrollCue` hook (scroll, ResizeObserver, resize).<br>The TARGET / empty branches and the latch are unchanged. |
| `src/App.css` | `.hint-sheet__*` only: legacy archive box, new-chip ring/pulse, scroll wrapper fades + cue, 44 px preference grid, 44 px Selectable CTA, wallet separator. The sheet's `max-height: 45dvh` is unchanged. |
| `src/components/HintSheet.test.tsx` | 3 H3-3 copy assertions updated; 11 new H3-4 tests (§10) |
| `src/App.hintSheet.test.tsx` | Insufficient copy updated. The GUIDANCE_ONLY → disabled check was added. New: the legacy cap-paid real-fact test through the real App. |
| `e2e/discovery-hint-sheet.spec.ts` | Copy updated. The geometry contract also checks, on every profile: preferences ≥ 44 px and reachable, and the scroll cue matching the body. New "cap paid" state (`07-cap-paid`) and the post-guidance disabled CTA. |
| `e2e/discovery-near-miss-result.spec.ts` | CTA copy updated |
| `docs/reports/TETO_DISCOVERY-HINT-3_H3-4_Fresh-Audit.md` | The Fresh Audit (commit `d5a3a90`) |
| `docs/reports/data/TETO_DISCOVERY-HINT-3_H3-4_HV-SEEDS.md` | **New:** Preview-only seed snippet for real-device HV (§9) |
| `docs/reports/screenshots/discovery-hint-3-h3-4-fresh-audit/` | Before: `main` `726b0ac` |
| `docs/reports/screenshots/discovery-hint-3-h3-4-ui-polish/` | After (`after-*`) |
| this report | |

**Not changed:**

- `selectableHint.ts`, `hintFactMigration.ts`, `persistence.ts`, `hintPurchase.ts`, `hintSteps.ts`;
- `discoveryHint.ts`, `gameReducer.ts`, `App.tsx`, `GameScreen.tsx`;
- `resultNearMiss.ts` / `nearMiss.ts`;
- every Dinner file;
- the inventory, matcher and scoring code.

## 4. 0 Pitz: the two meanings, and how the UI keeps them indistinguishable

The Fresh Audit §4 probe of the pure authority (25 recipes × legacy H0–H4) found two cases:

- **Fresh save:** price 0 only when nothing is left to sell (capricciosa, meat-lovers,
  pizza-portuguesa after 5+10+20+40). The request is GUIDANCE_ONLY.
- **Legacy Economy 1.0 save:** price 0 can sell **real facts**. There are 15 transitions across 6
  recipes (quattro-formaggi, capricciosa, meat-lovers, parmigiana-pizza, pizza-portuguesa,
  puttanesca-pizza). This is ESC_PARITY's lifetime cap plus OD-H3-9's no-loss rule, so it is by
  design.

The H3-4 UI depends only on `nextPrice === 0`, a function of paid count and cap class. Both cases
therefore render **identically before the request**: 「ヒントをたずねる」 + 「支払いずみ」, enabled, with
the same wallet line. This is pinned by:

- `HintSheet.test.tsx`: "at price 0 the pre-request view is identical whether a real fact is left
  (legacy) or not". It compares legacy H1 capricciosa with 3 facts (one real fact left) against
  fresh capricciosa with 4 facts (nothing left), and requires equal CTA text, enabled state, wallet
  and legend.
- `App.hintSheet.test.tsx`: "a legacy buyer at the cap gets the remaining real fact at 「支払いずみ」".
  Through the real reducer and save: 10 + 20 + 40 are paid (balance 130). Then a request at
  「支払いずみ」:
  - adds a chip, highlighted;
  - leaves the balance at 130;
  - writes 4 facts to `discoveryHintFacts`;
  - leaves `discoveryHintPurchases` untouched.

  The next request is GUIDANCE_ONLY: the save is byte-identical and only then is the CTA disabled.

## 5. Legacy parity preservation

- No pricing code changed. The ladder continues at 10 / 20 / 40 / 0 for legacy H1 / H2 / H3 / H4.
  The existing tests (matrix 15–18) are green.
- `discoveryHintPurchases` is never written (App test assertion).
- The legacy 0-price real-fact path is exercised end to end (§4).
- The CTA is never disabled on a price of 0. It is disabled only on `outcome === "GUIDANCE_ONLY"`
  or `!affordable`, and at price 0 `affordable` is always true.

## 6. GUIDANCE_ONLY UX

- **Before a request:** the normal price and an enabled CTA, for every target. That includes
  pizza-bianca (5 Pitz) and exhausted targets at a non-zero price, which is the common case:
  22 / 25 fresh ladders end before the cap. This is pinned per recipe × legacy level (all 24
  non-Margherita recipes × H0–H4: enabled, no guidance, same static copy).
- **After the request (authority returned GUIDANCE_ONLY):**
  - the guidance line is scrolled into view;
  - the CTA reads 「今あるヒントはここまで」 and is disabled;
  - the wallet line says 「今回はPitzを使っていないよ」;
  - focus moves to 閉じる.
- **Re-operation** (click, Enter ×2) changes nothing, and the save stays byte-identical (App test).
  The reducer's identity return for a repeated outcome is unchanged.
- **Close and reopen:** the outcome is transient (reset by SHOW_HINT), so the request is offered
  again and costs nothing.
- **OD-H3-17 compatibility.** 「今あるヒントはここまで」 is the Owner's OD-H3-4-3 wording. It appears
  only after a request (INTERACTION INFERENCE, allowed by OD-H3-17). It names hints, never an
  ingredient count, a category absence or the reserve. The H3-3 privacy test was narrowed
  accordingly: the forbidden-term regex still applies to the whole sheet except that one CTA label.

## 7. grandfatheredSteps UX

- The block is the **last element of the body**, after the guidance line.
- It is a dashed, muted archive box with 「以前のヒント」 and 「前のヒント方式で買ったメモ（そのまま残してあるよ）」.
- Its lines are plain `.hint-sheet__legacy-line` text: no step pill, chip, input, button or price.
- The lines stay verbatim, including legacy negative/count lines (e.g.
  「材料は全部で6種類。チーズを使うみたい」). That is the existing right of the player who bought them.
- They do not affect the price: legacy H2 pesto-tonno with a count line still offers 20 Pitz.
- The authority and persistence of `grandfatheredSteps` are unchanged.

## 8. Category preference / fallback privacy

- The legend is the same for every target: 「知りたいジャンル（ないときは別のジャンルから1つ）」.
- The 「？」 legend is the same for every target: 「？＝まだわからない（使わないジャンルもあるよ）」.
- **No negative fact before a request.** marinara (no cheese) and capricciosa (cheese) render the
  same cheese row, legend, CTA and radios. quattro-formaggi (no topping) shows 「？」 like any other.
- **Fallback.** ソース is preferred, but the authority serves チーズ:
  - only the new cheese chip gets `.hint-sheet__chip--new`;
  - the ソース radio stays selected;
  - no text states an absence.
  Where the chip lands is paid inference (OD-H3-6), as before.
- **The highlight** is computed from this open sheet's own previous vs current chip ids:
  - It is never shown on opening, so a reload or reopen shows no marks.
  - A GUIDANCE_ONLY request adds none.
  - It carries no text and no data attribute.
- The shape sweep over 24 recipes (H3-3) is unchanged and green, so the sheet still carries no
  recipe identity.

## 9. Short viewport measurements

Local Chromium. The body column is `.hint-sheet__selectable`, shown as visible / content height.

| State | 390×844 | 360×800 | 390×664 | 360×640 |
|---|---|---|---|---|
| A fresh (before → after) | 122/122 → 143/143 | 141/141 → 152/162 ▾ | 91/122 → 91/143 ▾ | 80/141 → 80/162 ▾ |
| D price 0 (cap paid) | 150/150 → 171/171 | 152/169 → 152/190 ▾ | 91/150 → 91/171 ▾▴ | 80/169 → 80/190 ▾▴ |
| E after guidance | 172/208 → 172/229 ▴ | 152/227 → 152/248 ▴ | 91/208 → 91/229 ▴ | 80/227 → 80/248 ▴ |
| G legacy H4 | 172/212 → 172/251 ▾ | 152/232 → 152/270 ▾ | 91/212 → 91/251 ▾ | 80/232 → 80/270 ▾ |

- **Sheet height:** unchanged or within 45dvh on every state and profile (contract test).
- **Footer:** 132 px before and after (153 px with the short-Pitz note).
- **Preferences:** 88/88/114×36 px before; **105×44** (360 wide) / **115×44** (390 wide) after.
- **Cue column:** ▾ = more below, ▴ = more above, as reported by the wrapper classes.
- **Body content grew** by one 11 px legend line (the 「？」 legend). At 360×800 the fresh body now
  scrolls by 10 px, and the cue shows it.
- **At 360×640** all 3 rows are not shown initially, as allowed by OD-H3-4-7. The cue marks the
  scroll, and the category controls and CTA stay in the fixed footer.
- **Background:** `.pizza-stage`, tabs, pager, bake bar and order card are unmoved in every
  state/profile (the existing contract assertion). The stage-stability spec is in the full run
  (§11).

## 10. Human Verification package

**Authority:** Fresh Audit §11 HV-1…HV-17.

**Seeds:** `docs/reports/data/TETO_DISCOVERY-HINT-3_H3-4_HV-SEEDS.md`.

- A console snippet for Safari Web Inspector.
- It **refuses to run without the Preview badge** and writes only the Preview key
  `teto-pizza-preview-save-v1`, so the production save (`teto-pizza-save-v1`, same origin) is never
  touched.
- The guide includes a backup/restore one-liner.
- Validated locally against a `VITE_PREVIEW_MODE=1` build: on a page without the badge it throws 「Preview build only」. On a `VITE_PREVIEW_MODE=1` dev server, `h34Seed("HV8_LEGACY_H2_PLUS_NEW")` wrote only `teto-pizza-preview-save-v1`: a production-key sentinel was left untouched, and after the reload the app showed Dex 11/25 and 200 Pitz.

**Preview deployment (done after the Owner asked for it, 2026-09-27):**

- `perusonao/teto-pizza-game-preview` `deploy-from-source.yml` ran with `ref=5dc5f47239ddeadeabd518a1e83ac499decdff7a`, `pr_number=251`: run 36305586289, success, commit `92882c7`.
- The Preview-only seed page `site/h34-seed.html` was committed to the preview repo (`109fe28`). It writes only `teto-pizza-preview-save-v1`, refuses to run outside `/teto-pizza-game-preview/`, and offers backup and restore. It is not in the source repository or the production bundle, and the next deploy removes it.
- `pages.yml` ran for `109fe28`: run 36305634978, success.
- The badge reads 「PREVIEW · PR#251 · 5dc5f47」.
- This sandbox cannot reach `perusonao.github.io`, so the smoke test ran on a byte-equivalent local rebuild: the same commit and the same build and post-processing commands, served under `/teto-pizza-game-preview/` with the seed page, at 390×844 and 360×640. All checks passed:
  - HOME and the badge;
  - normal purchase, highlight, fallback;
  - 「支払いずみ」 enabled;
  - GUIDANCE_ONLY: 0 charged, then disabled;
  - the legacy H1 real fact at 0 Pitz;
  - the 「以前のヒント」 archive last in the body;
  - the zero-fact recipe;
  - the short-viewport scroll cue and 44 px preferences;
  - the production-key sentinel untouched;
  - the seed page refusing outside the Preview path.
- A production build of the same commit contains no seed or debug strings, no Preview key and no Preview badge.
- Note: the Preview has a single slot, so this replaced PR #243's Preview build and its `dm3-setup.html`. PR #243 itself is untouched.

### Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `TETO_H3-4_ui-polish_390x844.webm` | 390×844 | 81.0 s | 3.0 MB (3,144,565 B) | PASS |
| `TETO_H3-4_short-viewport_360x640.webm` | 360×640 | 25.3 s | 0.74 MB (770,814 B) | PASS |

- **Download:** delivered directly in the session. Not committed (`artifacts/` is gitignored).
- **Codec:** VP8 / WebM. The sandbox has no MP4 encoder (no system ffmpeg; Playwright's bundled
  ffmpeg only writes VP8/WebM). The HV Policy §5 allows WebM with this reason.
- **Validation:**
  - Each file loaded in Chromium: metadata 390×844 / 360×640, durations as above.
  - A seek to 0.2 s before the end played.
  - Size > 0.
  - Sample frames at 30 / 50 / 62 / 80 % were checked visually. For example, at 62 %: HV-8, the
    legacy real fact at 「支払いずみ」, balance 130 unchanged.

**Video Verification: PASS**

**What the 390×844 video shows** (each step captioned on screen, held 1–2 s):

1. HV-1: Dex-0 Margherita onboarding, free and unchanged.
2. HV-2/3: a fresh sheet with 「ヒントを1つもらう 5 Pitz」 and 「Pitzはヒントが出たときだけ使うよ」. トッピング is bought, and the new chip is highlighted.
3. HV-4: a double tap buys exactly one fact.
4. HV-5: ソース preferred twice, so the second request falls back to a highlighted チーズ chip. No 「ない」 text.
5. HV-9: after the 4th fact, 「ヒントをたずねる／支払いずみ」, **enabled**. A request gives guidance, 0 Pitz is spent, and **only then** the CTA shows 「今あるヒントはここまで」 (disabled).
6. HV-13: body scroll with the fades and the ▾ cue.
7. HV-12: close, then reopen. The request is offered again.
8. HV-8: legacy H1. 10 → 20 → 40, then 「支払いずみ」 gives **a real chip with the balance unchanged**. The next request gives guidance and stops.
9. HV-7: legacy H4, with the 「以前のヒント」 archive box at the end of the body.
10. HV-6: short Pitz. A grey 40 Pitz CTA with the calm note.
11. HV-10: a recipe with one sellable fact. After it, the sheet shows 10 Pitz; the request gives guidance, charges 0 and stops.

**The 360×640 video** covers HV-15:

- the fresh sheet with the ▾ cue;
- scrolling to every row and the legend;
- a チーズ request whose new chip is scrolled into view;
- legacy H4 at 「支払いずみ」 → guidance, scrolled into view;
- scrolling down to the archive.

**Not in the video:**

- HV-11 (near-miss RESULT): covered by `e2e/discovery-near-miss-result.spec.ts`, which is green.
- HV-17 (Dinner): the reducer block is unchanged, covered by Vitest.
- HV-14/15 on a real iPhone: pending the Owner's device pass.

### Screenshots

- **Before:** `docs/reports/screenshots/discovery-hint-3-h3-4-fresh-audit/` (main `726b0ac`).
- **After:** `docs/reports/screenshots/discovery-hint-3-h3-4-ui-polish/after-*`. The states and seeds
  are the same (A–K, Fresh Audit §18).

Key comparisons:

| State | Before | After |
|---|---|---|
| D / G, price 0 | 「🔒 ヒントを1つ解除 0 Pitz」 | 「ヒントをたずねる 支払いずみ」 + 「上限まで支払いずみ」 |
| E / H, after guidance | Inert enabled 「0 Pitz」 | Disabled 「今あるヒントはここまで」 + 「今回はPitzを使っていないよ」 |
| F / G / H, legacy | Grey label with a step pill, between rows and guidance | Archive box, last |
| C, fallback | No marking | Cheese chip ringed |
| A 360×640 | Cut rows, no cue | Same rows, fade + ▾ |

## 11. Tests

### Focused (new / updated) — Owner list → test

| # | Owner item | Test |
|---|---|---|
| 1 | Normal paid purchase | `HintSheet.test.tsx` "OD-H3-4-9/2 …"; App "opens from 「ヒント」, buys facts …" |
| 2 | 0 Pitz legacy → real fact obtainable | App "H3-4: a legacy buyer at the cap gets the remaining real fact …" |
| 3 | 0 Pitz legacy real fact: CTA not pre-disabled | Same App test + unit "OD-H3-4-1" + "pre-request view is identical …" |
| 4 | GUIDANCE_ONLY → 0 charge | App tests (the first test: balance 285 kept; the legacy test: save byte-identical); reducer matrix 12–14 unchanged |
| 5 | CTA disabled after GUIDANCE_ONLY | Unit "OD-H3-4-3: only after GUIDANCE_ONLY …"; App tests; e2e purchase CTA |
| 6 | Re-operation after guidance leaves state unchanged | App legacy test (click + Enter ×2 → save identical); unit (no report) |
| 7 | Double-click protection | App "a double-click or a burst of taps …" (unchanged); unit latch test (unchanged) |
| 8 | Keyboard Enter repeat protection | The same App test (`{Enter}{Enter}`); the App legacy test after guidance |
| 9 | grandfatheredSteps archive display | Unit "OD-H3-4-4: … archive box at the end of the body …"; App legacy H3 test |
| 10 | grandfatheredSteps not priced | Unit "OD-H3-4-4: … never change the price or the rows"; reducer matrix 19/20 |
| 11 | Category fallback privacy | Unit "OD-H3-4-5: … the fallback states no absence"; App first test (cheese → sauce fallback) |
| 12 | Missing category not leaked as a negative fact | Unit "OD-H3-4-6: 「？」 … without cheese as for one with cheese" |
| 13 | New-fact highlight | Unit OD-H3-4-5 (none on opening, one after the request, none added by guidance); App legacy test; after reopen, none |
| 14 | 「？」 privacy | Unit OD-H3-4-6 + "every recipe, every pre-request paid state …" (24 recipes × H0–H4) |
| 15 | Dex-0 Margherita regression | Unchanged: `HintSheet.test.tsx` target view, `gameReducer.hintSheet/hintPurchase` onboarding tests, e2e "Dex 0 Margherita onboarding" |
| 16 | Persistence / migration regression | Unchanged: `persistence*.test.ts`, `hintFactMigration.test.ts`, reducer matrix 29–31, e2e `discovery-hint-facts-save` |
| 17 | Near-miss regression | Unchanged: `resultNearMiss.test.ts`, `nearMiss.test.ts`, e2e `discovery-near-miss-result` |
| 18 | Dinner action block regression | Unchanged: `DINNER_BLOCKED_ACTIONS` tests (reducer matrix 38, Dinner suites) |
| 19–22 | 390×844 / 360×800 / 390×664 / 360×640 | `e2e/discovery-hint-sheet.spec.ts` geometry contract on N390, N360, S390, S360 (+ 3 safe-area profiles) for H0, one fact, cap paid, longest, purchase, insufficient |
| 23 | Sheet scroll affordance | The same contract: the cue class must match `scrollHeight > clientHeight` on every profile, including the safe-area profiles (polled; this caught the missing ResizeObserver during development) |
| 24 | Underlying stage stability | The same contract ("background unmoved" on every profile/state); `stage-size-stability.spec.ts` in the full run |

### Runs

| Check | Result |
|---|---|
| Hint focused (`HintSheet`, `App.hintSheet`, `App.dexHint`, `GameScreen.hintSheet`, `gameReducer.selectableHint`) | 5 files, **84 passed** |
| Full Vitest | **185 files, 3994 passed, 1 skipped, 0 failed** |
| `tsc -b` | 0 errors |
| `oxlint` | 0 warnings |
| `npm run build` | OK (only the existing chunk-size warning) |
| Hint E2E (Chromium: `iphone-390x844`, `iphone-360x800`, `layout-chromium`) | 13 passed, 11 skipped (width guards) |
| Full Chromium E2E + Layout Contract | `iphone-390x844` + `iphone-360x800` + `layout-chromium` (the full suite, including the Layout Contract LC-* and the DM-3R-0 Stage Size Stability LC-S1..S4): **175 passed, 22 skipped (width guards), 0 failed** |
| CI / WebKit (PR) | PR #251 head `9a47b6e` (the same code as `9b3db21`): **all green**. Runs 36304820218 (E2E) / 36304820216 (build).
- `classify`, `build` (lint + Vitest + build), `layout-chromium`, `Layout Contract Gate`: success.
- `webkit-390x844` shards 1/2 and 2/2: success.
- `webkit-360x800` shards 1/2 and 2/2: success.
- `WebKit Gate`: success.

On the first head `9b3db21`, the WebKit Gate reported *failure*. The only cause was that the docs push `9a47b6e` cancelled shard 390 1/2 mid-run (`WEBKIT_RESULT: cancelled`). The other three shards had passed, and no test failed.
- `main` at the end: still `726b0ac`.
- The PR is mergeable (`clean`). |

## 12. Residual risks

- **Real-device fonts.** iOS font metrics can move the fold slightly. The cue follows the real
  scroll state, so it adapts. Confirm on HV-14/15.
- **Scroll cue on old iOS.** It uses `ResizeObserver` (iOS 13.4+) with window `resize` and
  per-render re-measure as fallbacks. With neither available, the cue can be stale until the first
  scroll; the content itself is unaffected.
- **360×800 fresh body** now scrolls by 10 px (the added 「？」 legend). The cue shows it. All three
  rows stay visible.
- **「今あるヒントはここまで」** is post-request only (§6). If the Owner prefers wording without
  「ここまで」, it is one string in `SELECTABLE_COPY`.
- **The legacy 0-price real facts** remain by design. Their share of real players is unknown
  (→ H3-ECON-1).
- **Preview deployment:** done (§10). The real-device HV ran on it (§13).
- **WebKit** runs in CI only. There is no local WebKit in this sandbox.

## 13. iPhone Human Verification — Owner Finding (2026-09-27)

The Owner verified the PR #251 Preview on an iPhone (HEAD `5dc5f47`).

**Finding (Owner):** material names can be bought per category (ソース / チーズ / トッピング). In late-game search, the player also wants:

1. the number of toppings needed (e.g. 「トッピングは全部で2種類」);
2. a last hint that is **not the ingredient name** but its kind, attribute or family (e.g. 「残りの材料には肉系があるよ」, 「香草系を使うよ」).

Selling the last ingredient by name (「残りはペパロニ」) is to be avoided. The purchase is for deduction material, not for the answer.

**Disposition:**

- **Not implemented in PR #251.** H3-4 keeps its scope: no production code, authority, HintSheet, reducer, persistence or pricing change.
- It is recorded here as an Owner Finding and carried into the next-phase Fresh Design: `docs/reports/TETO_DISCOVERY-HINT-4_DEDUCTION-HINTS_Fresh-Design.md`, proposed name **Discovery Hint 4.0 — Deduction Hints (材料 / 構成 / 特徴)**.
- That design re-opens OD-H3-2 / OD-H3-7 / OD-H3-15 (counts, closure) and Rule W (the attribute of the reserve). Those are Owner decisions for the new phase, not H3-4 changes.

**Verification record for PR #251 after this docs-only addendum:**

- The code HEAD remains `5dc5f47` (the code is identical to `9b3db21`).
- Its full verification stands: full Vitest, Chromium E2E + Layout Contract, and the WebKit matrix (run 36304820218 on `9a47b6e`, the same code).
- Docs-only pushes on this PR are classified as documentation-only by `classify`. The WebKit / layout shards are skipped, and the gates pass on the earlier code evidence (as for `5dc5f47`).

## 14. H3-ECON-1 follow-up (proposal, not started)

The Duplicate Gate found no existing economy follow-up issue. Following OD-H3-4-10, **no separate
issue was opened in H3-4**. It is recorded here and on #238, to be opened after Human Verification
so its scope can include the HV feedback. Candidates:

1. A ★4 / ★3 / ★1 player-profile economy walk under the Hint 3.0 purchase rule (replacing the
   Economy 1.0 knowledge model in `discoveryHintEconomySim.ts`).
2. Legacy 0-price analysis: how often Economy 1.0 buyers get the §4 free facts.
3. Future recipes with more than 4 sellable facts: they would make fresh 0-price facts possible.
4. A test-only invariant: "a fresh save at price 0 has no sellable fact".
5. The long-term fit of caps 35 / 75 with ESC 5 / 10 / 20 / 40.

No economy number changes in H3-4.

## 15. Final Human Verification Gate (2026-09-27)

### 15.1 HEADs

| | SHA | Content |
|---|---|---|
| **Final code HEAD** | `5dc5f47`, code-identical to `9b3db21` | Every production/test/e2e file of H3-4 |
| Docs-only HEADs after it | `1ef9b61` (the Owner Finding + the DH4 Fresh Design docs, Owner-approved in #251) and the commit recording this section | Docs only |

Evidence on the code HEAD, not re-run here because the code is unchanged:

- full Vitest 185 files / 3994 passed;
- `tsc -b` / `oxlint` / build clean;
- full Chromium E2E + Layout Contract (incl. DM-3R-0 LC-S1..S4): 175 passed, 0 failed;
- WebKit CI green: run 36304820218 on `9a47b6e`, the same code;
- Preview `109fe28` (source `5dc5f47`) smoke: all PASS (§10);
- the 390×844 / 360×640 videos: PASS.

### 15.2 Fresh overlap gate

- **`origin/main`** is still `726b0ac`, so there is nothing to integrate. PR #251 is `mergeable_state: clean`.
- **PR #252** (DM-3R-2, OPEN) touches `App.css`, `App.tsx`, `GameScreen.tsx` and `gameReducer.ts`.
  - Its `App.css` change is an append after the hint-sheet block, with no `.hint-sheet*` selector.
  - A trial `git merge-tree` of #251 + #252 has **no conflict**.
  - The H3-3 authority and the DM-3R-0 Layout Contract are not touched by #251's code (HintSheet + `.hint-sheet*` only).
- **PR #254** (DH4-1, OPEN): a trial merge with #251 has **no conflict**. No DH4 code is in #251.
- Neither #252 nor #254 was pulled into #251.

### 15.3 Gate items → evidence

| # | Item | Evidence | Result |
|---|---|---|---|
| 1 | Normal paid hint: category, fact, Pitz, new-chip highlight | Unit OD-H3-4-9/2 + OD-H3-4-5; App purchase test; e2e purchase CTA; Preview smoke (120 → 115, one highlighted chip); video HV-2/3; the Owner's iPhone pass | PASS |
| 2 | 0 Pitz, new save: no pre-request leak → GUIDANCE_ONLY → no charge → CTA stops | Unit "pre-request view identical whether a real fact is left or not"; App test (balance kept, disabled after guidance); e2e "cap paid"; smoke; video HV-9 | PASS |
| 3 | 0 Pitz, legacy: a real fact at 「支払いずみ」, no charge, parity | App legacy H1 test (the chip +1, the balance kept, `discoveryHintPurchases` unchanged); smoke (chips 4 → 5, 130 Pitz kept); video HV-8 | PASS |
| 4 | grandfatheredSteps as an archive, not priced or selectable | Unit OD-H3-4-4 ×2; smoke (the last element of the body); screenshots F/G/H | PASS |
| 5 | Category = preference; fallback leaks no negative fact | Unit OD-H3-4-5; App fallback; smoke fallback | PASS |
| 6 | 「？」 privacy + a fixed unused-category legend | Unit OD-H3-4-6 + the 24 × H0–H4 sweep; smoke legend | PASS |
| 7 | Short viewports: scroll cue, every control and the CTA reachable, stage unmoved | The e2e geometry contract on N390 / N360 / S390 / S360 (+ safe-area) with preferences ≥ 44 px, the cue matching the body and the background unmoved; WebKit CI N/S; §9 measurements; the 360×640 video and smoke | PASS |
| 8 | Near-miss: RESULT → 「ヒントを見る」, no unpaid fact leak | e2e `discovery-near-miss-result` (CI green); `resultNearMiss` / `nearMiss` not in the H3-4 diff | PASS |
| 9 | Dinner: no Hint Sheet or purchase, no regression | The H3-4 code diff touches no reducer / GameScreen / App file. `isHintSheetVisible` is still `freeCook`-gated. Dinner blocks the purchase actions (`gameReducer.dinner.test.ts` "no hint purchase", H3-3 matrix 38). The Dinner suites are green in full Vitest on the code HEAD. | PASS |
| 10 | Dex-0 Margherita onboarding unchanged | The TARGET branch is untouched; e2e "Dex 0 Margherita onboarding"; HintSheet target-view unit tests; video HV-1 | PASS |

### 15.4 Human Verification result

**H3-4 Human Verification PASS.** The Owner checked the Hint Sheet on an iPhone (Preview `109fe28`, source `5dc5f47`), and no H3-4 defect was reported.

Real-device play revealed the need for **Deduction Hints**:

- the topping / total count;
- a non-name last hint (attribute).

That is a **non-blocking Owner Finding** (§13). It was split into **Discovery Hint 4.0: Issue #253**, with its pure layer in **PR #254 (DH4-1)**. It is not implemented in, and not a blocker for, H3-4.

## 16. Verdict

> **Superseded by the final gate (§15): A. H3-4 HUMAN VERIFIED — READY TO MERGE.** The PR stays OPEN, pending the Owner's merge approval. The text below is the pre-HV verdict.


**A. H3-4 READY FOR OWNER REVIEW.**

- OD-H3-4-1…10 are implemented as presentation only.
- Must-preserve items verified:
  - authority, persistence/migration and the reducer are unchanged;
  - the latch and the stale-request guard are green;
  - the legacy 0-price real fact is exercised end to end;
  - GUIDANCE_ONLY charges nothing.
- Full Vitest, Chromium E2E + Layout Contract, and WebKit CI are green.
- The HV package (videos, screenshots, Preview-only seeds) is ready.

Open for the Owner:
- (1) Dispatch the Preview build for PR #251 (outside this session's scope, §10) and do the real-iPhone pass of HV-1…17.
- (2) Optionally re-word 「今あるヒントはここまで」 (§12).
- (3) Merge decision. **Not merged.**
