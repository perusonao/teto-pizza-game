# Issue #159 — Cooking UI 1-Screen Polish: Result Report

Status: **Implemented, ready for Human Review.** PR opened, not merged (per the task's own
instructions and this repo's standard workflow).

Base audited SHA: `d0085a35c7a5f932deda11ebc5fa74b421ddc86a` (`origin/main`, re-confirmed
unchanged immediately before opening the PR — Duplicate Gate #2). No other open PR implements
Issue #159 (re-checked open PRs: #158 Lunch Rush RESULT navigation, #105 draft dev-automation
worker, #72/#46/#34/#3 unrelated docs/audit PRs — none touch cooking UI/ingredient
selection/step nav).

## 1. Scope

Implements Issue #159's P0 and P1 checklists in full, per the issue body and its own
"Implementation kickoff" comment. Scope guard respected: no changes to scoring formulas,
economy/Pitz, Firebase/Cloud Functions/Firestore, Lunch Rush ranking/result work, recipe
dataset contents, or CI workflows (diff-verified — `git diff --stat` above lists only
`src/`/`e2e/` component, screen, and CSS files plus this report and screenshots).

## 2. Fresh Audit findings (what was actually broken on fresh `main`)

Confirmed against real Chromium (Playwright) before writing any code, not assumed from the
issue's own screenshots:

1. **Ingredient tray showed "このピザにおすすめ"/"その他"** (`IngredientTray.tsx`): every owned
   ingredient in the active category was offered, split into "recipe-required" and "everything
   else owned" — including sauces the current recipe doesn't use. This was also the mechanism
   behind the reported "別ソースへ変更できてしまう" concern: a player could pick a wrong-for-the-
   recipe sauce from the "その他" row mid-SAUCE-step.
2. **Making-step nav strip (`MakingStepTabs`) only ever rendered during PREPARE.** BAKE and
   POST_BAKE/CUT each got their own screen with no step nav at all, so a cut-target recipe's own
   CUT step was invisible until POST_BAKE actually started — the "生地→ソース→チーズ→具材→焼く→
   切る" sequence the issue calls for was never shown consistently.
3. **The TOPPING tab's own label, "トッピング" (5 full-width characters), combined with the
   fixed-width BAKE indicator and up to 6 total items** (once CUT joins the strip) pushed the
   flex row's own content past 361-390px in the worst case — the root cause behind "「焼く」の
   はみ出し".
4. **`.order-card__hint` used `white-space: nowrap` + ellipsis** — several of `data/hints.ts`'s
   own real recipe hint lines silently truncated at 390×844/361×800.
5. **Olive oil's own paint color (`#e9d9a0`) is a near-match for the dough's warm gold
   background** — even with the existing Issue #32 saturate/contrast/drop-shadow filter, it
   still read as barely-there on a real screenshot.
6. **`ingredient-chip__drag-hint` said "上へドラッグ"** for mozzarella/basil's physical-drag
   chips — inaccurate (the real gesture is drag-from-chip-to-dough in any direction, not
   specifically "up").
7. **The mini 見本 thumbnail (`PizzaThumbnail`) and its own popover (`ReferencePreview`/
   `PlayerReferencePreview`) built their piece lists independently** — the thumbnail rendered
   one dot per required ingredient *type* (ignoring `minCount`), the popover rendered the real
   per-unit layout (`minCount`-expanded). For margherita this was 2 dots vs. 5 — a real "見本
   表示が入口によって変わる" bug, not merely a stylistic difference.

Sauce lock itself (CONFIRM_MAKING_STEP/APPLY_SAUCE/COMMIT_SAUCE_DISPENSE's own `makingStep`
gates, `gameReducer.ts`) was already reducer-enforced pre-existing — the gap was purely UI-side
(the tray exposing a second sauce to switch to mid-step).

## 3. P0 implementation

1. **One-screen at 390×844 and 361×800** — achieved primarily as a side effect of removing the
   "その他" ingredient rows (biggest single space cost) plus the nav-width fix; no separate
   shrink of the pizza stage. Verified for every PREPARE step, BAKE, and POST_BAKE/CUT via
   `e2e/making-ui-1screen.spec.ts` (`.game-screen` `scrollHeight <= clientHeight`, no horizontal
   page overflow), at both viewports.
2. **Sauce lock** — `IngredientTray.tsx` now offers only this round's own
   `recipe.requiredIngredients` (still owned-gated); since every recipe has exactly one sauce
   ingredient, the SAUCE-step tray structurally never shows a second option, so there is nothing
   to switch to. The pre-existing reducer-level `makingStep === "SAUCE"` guards
   (`APPLY_SAUCE`/`COMMIT_SAUCE_DISPENSE`) remain the real backstop, unchanged. `やり直す`
   (RESET_PIZZA) still fully resets and re-enables the SAUCE step normally.
3. **Removed the 「このピザにおすすめ」/「その他」 card area; recipe auto-decides per step** —
   `IngredientTray.tsx` renders a single unlabeled list of owned-and-required ingredients only.
   This is a deliberate, explicit supersession of Issue #86's "FREE creativity" behavior — #159's
   own kickoff comment permits changing ingredient-selection behavior where #159 explicitly
   requires it, and this was the exact mechanism the P0 sauce-lock item needed. `IngredientTray.
   recommendedOther.test.tsx`/`.scalability.test.tsx`/`.palette.test.tsx` are all updated to pin
   the new contract (old "Other"/FREE-creativity assertions removed, replaced with "never offers
   an owned-but-not-required ingredient" coverage).
4. **Step nav fits the viewport; CUT is recipe-aware** — `MakingStepTabs.tsx` gained `postSteps`
   (a recipe's own `postBakeSteps`, `["CUT"]` for margherita / `[]` for every other recipe — no
   new per-recipe branching) and `currentPhase`, so the same strip now mounts during PREPARE,
   BAKE, and POST_BAKE/CUT (`GameScreen.tsx`), reading pre-BAKE steps/BAKE/postSteps as
   completed/active/locked consistently across all three phases. The TOPPING tab's own label was
   shortened to "具材" (half the width of "トッピング") — the actual fix for the width overflow,
   confirmed by precise `boundingBox()` measurement (`assertNavFitsViewport` in the new e2e spec;
   the last tab's right edge stayed at x≈378 of 390px even with all 6 items present). `.making-
   step-tab` also gained `min-width: 0` (a flex item's default `auto` refuses to shrink below its
   content) as a structural defense against the same class of bug recurring.
5. **Mini 見本 thumbnail and popover from the same SSOT** — new `ReferenceThumbnail.tsx`
   component renders from the *exact same* `pieceGroups`/sauce-ingredient value `GameScreen.tsx`
   already resolves for the popover (`referencePizza ?? getPlayerReferencePizza(state.recipe)`),
   not an independent recomputation. Confirmed by e2e: `.mini-reference` thumbnail piece count
   now equals the popover's own piece count (5 for margherita, not 2). Deliberately a new
   component rather than changing `PizzaThumbnail.tsx` itself, since that component is also
   Pizza Select's own card preview — unrelated to and out of scope for this issue's "調理画面"
   wording.

## 4. P1 implementation

1. **No clipped hint/instruction text** — `.order-card__hint` switched from `nowrap`+ellipsis to
   `-webkit-line-clamp: 2` (supported on every target browser including iOS Safari).
2. **Olive oil visibility** — added `.pizza-sauce-oil-sheen`, a purely decorative, `pointer-
   events: none` overlay (diagonal gloss sweep + a thin warm boundary ring, both clipped to the
   dough circle) rendered only when the active sauce is olive oil. Carries no sauce data of its
   own; reads and writes nothing Scoring 2.0 touches (`sauceDeposits`/`sauceIds` untouched).
   Screenshot comparison (`before_olive-oil-sauce_390x844.png` / `after_...png`) shows a visibly
   distinct diagonal highlight on the "after" side.
3. **Stale gesture wording** — `ingredient-chip__drag-hint` changed from "上へドラッグ" to
   "ドラッグしてのせる"; grepped the rest of `src/` for the same "上へ/上に...ドラッグ" pattern —
   this was the only occurrence.

## 5. Test coverage added/updated

- `IngredientTray.recommendedOther.test.tsx` (rewritten): recipe-required-only contract, "no
  heading" assertion, owned-but-off-recipe sauce never offered.
- `IngredientTray.scalability.test.tsx` (rewritten): pagination stays bounded even when a
  (synthetic, mocked-catalog) recipe requires more than `MAX_INGREDIENT_PALETTE_SLOTS`
  ingredients in one category; an owned-but-not-required ingredient never renders at catalog
  scale.
- `IngredientTray.palette.test.tsx` (updated): pagination-boundary fixtures now use a widened-
  requirements recipe override instead of a zeroed-requirements one (the old "force everything
  into Other" trick no longer has an "Other" to force into).
- `MakingStepTabs.test.tsx` (extended): new `describe` block for `postSteps`/`currentPhase` —
  PREPARE/BAKE/POST_BAKE visual states, CUT absent for non-cut profiles, defaults unchanged for
  every pre-#159 caller.
- `GameScreen.makingStepNav.test.tsx` (new): drives the real reducer through a full margherita
  round (DOUGH→...→POST_BAKE/CUT→RESULT) and a non-cut recipe override, asserting the nav
  strip's own rendered content at each phase against real `GameScreen` output.
- `GameScreen.keyboardSpreadRepeat.test.tsx` (fixed): one pre-existing test clicked "にんにく"
  (garlic), which margherita's own recipe no longer offers under the new recipe-only filter —
  swapped for "バジル" (margherita's actual topping requirement).
- `e2e/making-ui-1screen.spec.ts` (new): one-screen fit + nav-fit at both 390×844 and 361×800
  across every PREPARE step, BAKE, and POST_BAKE/CUT; sauce-lock (owned-but-off-recipe sauces
  never shown, at any step); thumbnail/popover SSOT parity; full-round console-error regression.
- `e2e/viewport-1screen.spec.ts` (fixed): the quattro-formaggi heavy-inventory fixture's own
  TOPPING step legitimately has zero chips now (quattro-formaggi requires no topping ingredient
  at all) — the test's "click any chip" step now only runs when a chip exists, asserting the
  empty case is specifically TOPPING (the one category this recipe has no requirement in).

## 6. Full verification

- Focused + full Vitest: **2088/2088 passed** (112 files).
- `tsc -b`: clean.
- `npm run lint` (oxlint): clean.
- `npm run build`: clean (pre-existing >500kB chunk-size warning only, unrelated to this change).
- Full Playwright suite, both existing projects (`iphone-390x844`/`iphone-360x800`) plus the new
  spec's own explicit 361×800 checks: **30/30 passed**.

## 7. Human Verification

### Screenshots (`docs/reports/screenshots/ISSUE-159_COOKING-UI-1SCREEN/`)

Before (`origin/main` `d0085a3`, via a disposable `git worktree`) vs. after (this branch), same
gestures, same fresh save:

| File pair | What it shows |
|---|---|
| `01-dough_390x844` | DOUGH step baseline (nav strip is new to this step's context either way) |
| `04-topping_390x844` / `_361x800` | 「このピザにおすすめ」heading gone, hint no longer clipped ("...仕上げに近い" → full 2-line text), drag-hint text updated, CUT tab already present in the strip |
| `05-bake_390x844` | Before: no step nav at all during BAKE. After: full nav strip persists, 焼く shown active |
| `06-cut_390x844` | After: nav strip shows カット active, no overflow at 390px |
| `olive-oil-sauce_390x844` | Before: flat, low-contrast paint + a same-category "その他" sauce still offered (トマトソース). After: visible diagonal gloss sheen, only オリーブオイル offered |

### Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---:|---:|---:|---|---|
| `TETO_ISSUE-159_Margherita-Review-Playthrough_390x844.webm` | 390×844 | 34.9s | 1.33 MB | VP8/WebM | PASS |
| `TETO_ISSUE-159_Margherita-Review-Playthrough_361x800.webm` | 361×800 (recorded frame 360×800 — see note) | 22.9s | 886 KB | VP8/WebM | PASS |

Download: delivered directly to the user in this session (`SendUserFile`), not committed —
`artifacts/`-style large media stays out of the repository per `docs/PROJECT_HANDOFF.md`'s
existing rule, restated in `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §6.

**Format note:** this sandbox's only available `ffmpeg` is Playwright's own minimal trace-only
build (webm/VP8 muxer/encoder only — no `libx264`, no mp4 muxer), and no system `ffmpeg` could
be installed (no network/package access in this environment). Per
`TETO_HUMAN-VERIFICATION-POLICY.md` §5's own explicit fallback ("MP4化できない環境ではWebMでも可。
その場合はResult Reportに理由を明記する"), both videos are delivered as WebM/VP8 with this reason
recorded here. Both play back fully in a standard browser/video player.

**361×800 recording note:** the *tested/measured* viewport is a true 361px-wide browser context
(matching the Playwright assertions in `e2e/making-ui-1screen.spec.ts`, which measure real
361px-wide layout and pass). The *video encoder* (VP8) requires even pixel dimensions, so the
recorded frame itself is clamped to 360×800 — a recording-only rounding, not a discrepancy in
what was actually verified.

Each video covers: HOME → Pizza Select → margherita → DOUGH (gesture) → SAUCE (paint, only one
sauce ever offered) → CHEESE → TOPPING (place, tap the 見本 thumbnail to show the popover's
matching piece count) → BAKE (nav strip persists) → CUT (nav strip shows カット active, cut
gesture) → RESULT. Held 1–3s+ on each phase per the policy's own pacing guidance — this is not
sped-up automated-test-speed footage.

Video Verification: PASS (file exists, size > 0, plays fully, full viewport recorded, target
operations visible, every #159 acceptance-criterion screen/state is directly observable).

## 8. Acceptance Criteria checklist

- [x] 390×844 と 361×800 の両方で主要調理工程が縦スクロール不要 — `e2e/making-ui-1screen.spec.ts`
- [x] 横スクロール/工程タブのクリップなし — same spec, `assertNavFitsViewport`
- [x] カット対象レシピでは「切る」が工程として見える — CUT tab present from PREPARE/DOUGH onward for margherita
- [x] 非カット対象では不要な切る工程を出さない — `postSteps=[]` for every non-margherita profile; e2e + unit coverage
- [x] ソース確定後、別ソースへの変更/重ね塗り不可 — structural (tray offers only the recipe's one sauce) + pre-existing reducer guard
- [x] やり直し後は正しく再操作可能 — `やり直す`/RESET_PIZZA untouched, re-verified by existing regression suite
- [x] 見本表示が入口によって変わらない — `ReferenceThumbnail` shares one resolved value with the popover
- [x] ヒント文言が省略/クリップされない — `-webkit-line-clamp: 2`
- [x] オリーブオイル操作結果が肉眼で判別可能 — `.pizza-sauce-oil-sheen`, screenshot-confirmed
- [x] 既存の生地/ソース/チーズ/トッピング/焼き/カット判定に回帰なし — full Vitest 2088/2088 + Playwright 30/30, scoring/cut logic files untouched (diff-verified)

## 9. Scope guard (diff-verified)

Not touched: `src/logic/scoring*.ts`, `src/logic/scoringV2/**`, `src/logic/economy.ts`,
`src/logic/pitzReward.ts`, `src/firebase/**`, `src/mission/**` production logic, `src/data/
recipes.ts`, `src/logic/cut/**`, `.github/workflows/**`. `IngredientTray.tsx`'s ingredient-
selection *behavior* is the one deliberate exception, explicitly authorized by #159's own scope
guard for exactly this change.

## 10. Definition of Done

- [x] Automated tests PASS (Vitest 2088/2088, Playwright 30/30, tsc/lint/build clean)
- [x] Human Verification screenshots (committed, `docs/reports/screenshots/ISSUE-159_COOKING-UI-1SCREEN/`)
- [x] Human Verification video (delivered directly to the user)
- [x] Video validation PASS
- [x] Download link available (in-session delivery)
- [x] Result Report updated (this file)
