# Dinner Mission DM-3R-2 (PR #252): Owner Human Verification Preparation

- **Lane:** D (Dinner only). Independent of DH4-x / HintSheet / Recipe Taxonomy lanes.
- **Scope guard:** no production code changed, nothing merged. PR #252, #243 and #242 are untouched. No production deploy.
- **Verdict:** **A. DINNER PREVIEW READY FOR OWNER HUMAN VERIFICATION**
- Captured: 2026-09-27 (UTC ~10:40–10:50)

## 1. Fresh GitHub Gate

| item | state |
|---|---|
| `origin/main` | `5a33d855674652ab3483c3cedb8815859e88ce6e` (Merge PR #254, DH4-1). It moved during this task: `22658f7` (H3-4 #251 merge) was followed by the #254 merge at 10:28Z. |
| PR #252 | OPEN, not draft. Head `5e217ea` (docs-only). No unexpected commits: 94b27ad → daed3dd → 7a18e29 → 5e217ea. |
| Last code HEAD | `7a18e29630fd12b89ecdfb2c644182b51d1bd2a9`. `5e217ea` only edits the Result Report. |
| Mergeability | GitHub `clean` against its base `726b0ac`. Against the latest main, see §2. |
| CI | `7a18e29`: CI and WebKit workflows success. `5e217ea`: build / classify / Layout Contract Gate / WebKit Gate success. The layout and webkit jobs were skipped as docs-only, as designed. |
| Review threads | 2 threads (Codex P2 ×2), both resolved in `7a18e29`. No open blocker. |
| Auto-merge | none |
| Issue #250 | OPEN, linked to #252 |
| PR #243 / Issue #242 | both OPEN, untouched (their close is the Owner's call after HV) |
| Preview repo (before) | `109fe28`. site/ built from `5dc5f47` (PR #251, H3-4), plus the H3-4 seed page. |

## 2. Latest Main Compatibility Gate (no merge performed)

The trial merge ran in a scratch worktree. It was never pushed.

- **Merge:** `5e217ea` + `origin/main 5a33d85` merges automatically, with no conflict. Trial merge commit: `32cfe9c`, local only.
- **File overlap:** main changed 13 non-docs files since `726b0ac`, and PR #252 changed 28. The only shared file is `src/App.css`.
  - main's edits there are all `.hint-sheet__*` rules plus a new `@keyframes hint-chip-new`.
  - The Dinner rules are `.dinner-*` / `.home-menu__card--dinner` / `--dinner-*`. No selector collides.
- **No shared-file edits on main:**
  - `GameScreen.tsx`, `App.tsx`, `gameReducer.ts`: not touched by main.
  - Dinner logic (`src/mission/dinner/*`, `dinnerView`, `useDinnerRuntime`): not touched by main.
  - DH4-1 (`deductionHint.ts`, `ingredientTaxonomy.ts`): unwired pure layer with no importer from the Dinner code.
- **Semantic check: can Dinner reach a Discovery Hint purchase?** No. Checked on the merged tree:
  - GameScreen renders the PREPARE 「ヒント」 button only when `state.dinner === null`. **Dinner PREPARE has no 「ヒント」 button at all.** There is no Mito-dialogue hint in Dinner either.
  - The reducer's `DINNER_BLOCKED_ACTIONS` refuses these three actions during a Dinner session: `SHOW_HINT`, `PURCHASE_DISCOVERY_HINT` and `PURCHASE_SELECTABLE_HINT`.
  - The H3-4 purchase cases also require `state.freeCook && hintSheetOpen && phase === PREPARE`.
  - A Dinner round runs with `freeCook: false`, so `isHintSheetVisible` is false. HintSheet can never mount.
  - On the Dinner result, `BakeOverlay`'s 「💡 ヒントを見る」 is wired to `state.freeCook ? … : undefined`, so it is absent.
- **Checks on the merged tree (`32cfe9c`):**
  - `tsc -b` clean and `oxlint` 0 warnings.
  - **Vitest:** 192 files, 4077 passed / 1 skipped.
  - **Chromium E2E** (iphone-390x844, iphone-360x800, layout-chromium): **201 passed / 25 skipped / 0 failed**, the same as PR #252 alone. This includes `dinner-mission`, LC-S Dinner and `discovery-hint-sheet`.
- **Result:** compatible. No integration branch is needed for the Preview.

## 3. Preview Slot Gate and deploy

- **Slot state before the switch:** H3-4 (#251) was the last user. Its HV gate is PASS and it is merged into main.
  - DH4-1 (#254) is merged. It is an unwired pure layer with no UI to verify.
  - DH4-2 and 172 Taxonomy are audit-stage. No other session had a pending Preview HV.
  - The switch was judged safe.
- **Build source:** `7a18e29630fd12b89ecdfb2c644182b51d1bd2a9` (PR #252 code HEAD). It is code-identical to head `5e217ea`, and it is not the integrated build.
- **Deploy run:** `deploy-from-source.yml` run [36313372602](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36313372602) succeeded. It pushed preview commit `80a0921` ("Deploy preview: 7a18e29… (7a18e29)").
  - The README shows Source commit `7a18e29…`, Source PR #252, built 2026-09-27T10:42:28Z.
- **Helper page:** preview commit `4e29ac4` adds `site/dm3r2-setup.html`. It is Preview-only and writes only `teto-pizza-preview-save-v1`, with backup and restore.
  - That push triggered `pages.yml` run [36313562618](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36313562618), which succeeded with head `4e29ac4`.
- **Production:** not touched.

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
**HV setup helper:** https://perusonao.github.io/teto-pizza-game-preview/dm3r2-setup.html

## 4. HV parameters (HV-only; not balance authority)

These are Human Verification values only. None of them is a DM-5 time limit or ★ threshold. Every mission keeps `timeLimit.seconds: null` / `quality.minimumStars: null`.

Fresh-checked in `7a18e29`:
- `?dinnerDuration=<sec>` and `?dinnerMinStars=1..5` are read only when `import.meta.env.DEV || VITE_PREVIEW_MODE`.
- With no `dinnerMinStars`, the Preview uses a placeholder S=3.
- The production bundle has 0 `location.search` references, so both resolvers receive `""`.

| set | query | purpose |
|---|---|---|
| HV-normal | `?dinnerDuration=600&dinnerMinStars=1` | enough time for 4 pizzas; hand-made targets pass reliably |
| HV-quality-fail | `?dinnerDuration=600&dinnerMinStars=5` | hand-placed pizzas score below ★5, so QUALITY_FAIL (E2E uses the same S=5) |
| HV-time-up | `?dinnerDuration=45&dinnerMinStars=1` | TIME_UP within a minute |
| (optional) | `?dinnerDuration=600` | placeholder S=3 feel. Not a recommendation. |

Seeds on the helper page:
- **通常セーブ:** DM-A targets plus marinara discovered, hawaiian undiscovered, every material 30. It covers NON_TARGET (marinara) and ORIGINAL (hawaiian).
- **INFEASIBLE 用:** the same, with egg = 2.

## 5. Owner HV checklist (390×844 first; 360×800 as a spot check)

Recommended order: 通常セーブ + HV-normal (D1–D6, D8, D10, D12), then HV-quality-fail (D7), then INFEASIBLE 用 (D9), then HV-time-up (D11).

| # | priority | steps | check |
|---|---|---|---|
| HV-D1 Entry | P0 | HOME → 🌙 ディナーミッション → ディナーミッション 1 → Detail → スタート | The path is understandable. START goes straight to cooking. There is no Target Board and no "choose which pizza" step. |
| HV-D2 Target row | P0 | Look at the row under the tabs, then tap a chip | Visible in every step (dough → cut). You can read ⏱, 🌙 N/4, names and ✓. Chips are not too small. **A tap only opens 見本 and selects nothing.** Could the reference tap be mistaken for "choosing the pizza to make"? |
| HV-D3 Auto result | P0 | Make any target with no selection | No recipe name appears before or during BAKE / CUT. The result appears only when the pizza is finished. TARGET_PASS feels good. The chip gets ✓. 「次のピザを作る」 is natural. |
| HV-D12 CLEAR | P0 | Finish all 4 | DINNER CLEAR feels good. 「最後のピザ：○○完成！」 and the clear time show. Next steps (もう一度 / ホーム) are clear. Reward tiers are unimplemented — does it feel too placeholder-like? |
| HV-D4 Free order | P1 | Make the targets in a different order from the list | Any order CLEARs. You decide the next pizza yourself. |
| HV-D8 Invalid | P1 | Take a target out far too early (raw) or late (burnt) | **The CUT step still comes, then 「ピザとして完成しませんでした」.** Does cutting a failed pizza feel wrong? (Owner Finding candidate) |
| HV-D6 Duplicate | P1 | Make an already-✓ target again | 「これはもう完成済み！」, the ✓ count does not rise, ingredients are used. Is the reason clear? |
| HV-D5 ORIGINAL | P1 | Make hawaiian (ham 2 + pineapple 3, mozzarella 2). Optionally marinara (garlic 3 + oregano 2, no cheese) | Hawaiian shows 「オリジナルピザ！」 and never the name 「ハワイアン」. No Dex / Pitz change. No target progress. Marinara is named (NON_TARGET). |
| HV-D10 HOME abandon | P1 | During cooking: ホーム → 続ける, then ホーム → やめる | The in-app dialog shows. Cooking is frozen behind it, and the timer keeps running. 続ける resumes. やめる returns HOME with no reward. |
| HV-D7 Quality fail | P2 | HV-quality-fail: make a target | The name shows at the result: 「もう少し丁寧に作ろう」 + 「○○ ★n（合格は★5以上）」. Target stays open, ingredients are used. Is the threshold understandable? |
| HV-D9 Infeasible | P2 | INFEASIBLE 用 + HV-normal: bismarck, then bismarck again | Immediately FAILED 「材料が足りなくなりました」. The last pizza line shows 「これはもう完成済み！」. Need / have is shown. The inventory pressure makes sense. |
| HV-D11 TIME_UP | P2 | HV-time-up: START and wait (or cook slowly) | At 0: 時間切れ. **No 「最後のピザ」 line.** もう一度 / ホーム work. Clearing at the last second does not race. |

### Owner UX questions

- Q1 Is Dinner without choosing the pizza first intuitive?
- Q2 Does the target row alone tell you what to make?
- Q3 Is it clear that a chip tap is a reference only?
- Q4 Does automatic judging at the finish feel good?
- Q5 Is the tempo of one pizza → next pizza good?
- Q6 Are the ~30px thumbnails distinguishable on iPhone?
- Q7 Is the CLEAR presentation enough?
- Q8 Is QUALITY_FAIL understandable?
- Q9 Is CUT on a raw / burnt pizza acceptable?
- Q10 Fresh fact: Dinner shows **no** 「ヒント」 button in PREPARE and no 「ヒントを見る」 on its results, so the Dinner flow contains no 「ヒント」 wording. Please confirm nothing in Dinner reads as Discovery Hint.

## 6. Residual risks (classification)

| # | risk | class |
|---|---|---|
| 1 | A raw / burnt pizza of a CUT recipe goes through CUT, then gets INVALID. | **Owner decision via HV-D8 / Q9.** Non-blocking for HV. If the Owner rejects it, it becomes a blocking defect for #252, or a separate DM-3R-1 Stage B order change. |
| 2 | The presence of CUT (the 「カット」 tab is shown during BAKE) implies "some CUT recipe matched". It never names the recipe. | non-blocking (inherent to the DM-3R-1 authority) |
| 3 | 30px thumbnails look alike. | non-blocking; HV-D2 / Q6 |
| 4 | The official minimumStars is undecided. | DM-5 deferred |
| 5 | The official time limit is undecided. | DM-5 deferred |
| 6 | Gold / Silver / Bronze and rewards are unimplemented. | DM-4 / DM-5 deferred |
| 7 | Dinner does not mutate the Dex (by design, OD-DM). | non-blocking (spec) |
| 8 | New nit: at 390 wide, the abandon dialog title wraps with 「か？」 alone on line 2. | non-blocking cosmetic |

## 7. Screenshots / videos

### Reuse (PR #252, `docs/reports/screenshots/dinner-mission-dm3r2/`, 46 files)

`7a18e29` changed only two things: the CLEAR overlay's 「最後のピザ」 line, and the abandon-dialog freeze. The freeze is invisible except that cooking is inert. So these are still code-equivalent and are reused as is:
- Mission Detail
- PREPARE (4 steps × 4 viewports)
- BAKE, CUT
- reference popover
- TARGET_PASS / QUALITY_FAIL / NON_TARGET / ORIGINAL / INVALID results
- INFEASIBLE, TIME_UP

Not code-equivalent: `after-clear-390x844.png` (captured at `daed3dd`, no 「最後のピザ」 line) and video A's CLEAR ending.

### New delta captures (`docs/reports/screenshots/dinner-mission-dm3r2-hv-prep/`)

These are from the exact deployed Preview bytes (`teto-pizza-game-preview` site/ at `4e29ac4`), served locally.

- `hvprep-clear-last-pizza-390x844` / `-360x800`: CLEAR with 「最後のピザ：ビスマルク完成！」 (the #252 review fix)
- `hvprep-abandon-dialog-390x844`: the dialog at `7a18e29`
- `hvprep-result-duplicate-390x844`: DUPLICATE_TARGET result panel. The earlier set only had DUPLICATE inside the INFEASIBLE overlay.
- `hvprep-result-invalid-after-cut-390x844`: raw funghi → CUT → INVALID (residual risk 1)
- `hvprep-infeasible-390x844`, `hvprep-timeup-390x844` (no 最後のピザ)
- `hvprep-result-target-pass-390x844` / `-360x800`

### Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `DM-3R-2_HVprep_A2_clear-last-pizza_7a18e29_390x844.mp4` | 390×844 | 40.2 s | 988 KB | PASS |

- **Codec:** H.264 High, yuv420p, 25 fps.
- **Download:** delivered directly in the session. Not committed.
- **Content:** the helper seed, HV-normal, HOME → Detail → START, a bismarck chip tap (見本 only), then funghi → breakfast → margherita → bismarck with no selection, CLEAR with 「最後のピザ」.
- **Reused:** videos B and C from PR #252 are still code-equivalent.

Video Verification: PASS. The file exists, ffprobe reads H.264 390×844 40.2 s, and a frame at 34 s shows the BAKE step with the target row.

## 8. Preview smoke

| item | result |
|---|---|
| Preview badge | 「PREVIEW · PR#252 · 7a18e29」 |
| Source SHA | README, deploy commit and bundle all point to `7a18e29` |
| Route | `/teto-pizza-game-preview/` (+ `dm3r2-setup.html`) |
| Query | HV-normal / quality-fail / time-up all behave as §4 |
| 390×844 + 360×800 | HOME → Dinner → Detail → START → 4 pizzas → CLEAR pass |
| Horizontal overflow | 0 on HOME, Detail, PREPARE, BAKE, CUT and CLEAR |
| Console errors | 0 |
| Hint surface in Dinner | no 「ヒント」 button, no `.hint-sheet` at any step |

**Constraint:** the sandbox proxy returns 403 for `perusonao.github.io`, so the live URL was not fetched from here. What was verified instead:
- `pages.yml` run 36313562618 succeeded on head `4e29ac4`.
- The smoke ran on that commit's `site/`, served locally at the same base path.
- The site/ JS / CSS match a local `VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=252 VITE_PREVIEW_SHA=7a18e29` build byte for byte. Only `index.html` and the manifest differ, from the workflow's noindex and scope post-processing.

The live page itself is to be confirmed by the Owner on iPhone.
