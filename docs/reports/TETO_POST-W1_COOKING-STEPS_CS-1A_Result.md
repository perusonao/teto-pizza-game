# TETO Post-W1 Cooking Steps — CS-1a Result (Production tab gate + generic post-bake rendering)

Status: **CS-1a implemented and verified — STOP before CS-1b.** Not merged. Issue #294, PR #295.

| Item | Value |
|---|---|
| Audited `main` | `86b48fd51423a8f76db5398ab88ecfd944e2ae10` (fresh fetch; unchanged since PR #295) |
| Branch | `claude/post-w1-cooking-steps-design-2nomy3` |
| Authority | Owner Decisions OD-CS-1 = A, OD-CS-2 = B, OD-CS-9 (a), OD-CS-20 — design §13 |
| Commits | `e439be6` (docs: Owner Decisions), `7356a76` (tab gate), `d5d179d` (GameScreen) |

## 1. Start-of-slice Fresh Check

| Check | Result |
|---|---|
| `main` | `86b48fd`, no new commits |
| PR #275 | OPEN, head `21fbedf`, not touched |
| Hint 5.0 H5-3 overlap (read only) | **No overlap.** No H5-3 commit exists on any remote branch. The pushed Hint 5.0 work (H5-1 / H5-2 on `claude/hint-5-0-fresh-audit-cdgm9e`, head `abce62a`) changes no `GameScreen.tsx`, `App.tsx` or CSS file. H5-3's planned scope (Final Design §15/§16: HintSheet ladder UI, App save/reset wiring) sits in the HintSheet regions of `GameScreen.tsx` (imports `:35-36`, focus effect `:259-265`, sheet mount `:838-839`), which are PREPARE-only. CS-1a touches only the post-bake sites (`:325`, `:423`, `:509-515`, `:626`, `:641`, `:674`) and adds one import line. Different lines and different semantics → proceed. |
| Other parallel branches | `claude/172-recipe-authority-matrix`, `claude/hint-5-0-taxonomy-audit-g9d1u9`: docs only |

## 2. What changed

| File | Change |
|---|---|
| `src/data/cookingProfiles.ts` | + `MAX_VISIBLE_COOKING_TABS = 6`, + `visibleCookingTabCount(profile)` (pure; PREPARE steps + 焼く + POST_BAKE steps). No existing function changed. |
| `src/data/cookingProfiles.tabGate.test.ts` (new) | The Production tab gate. |
| `src/screens/postBakeView.ts` (new) | `renderedPostBakeStep(phase, makingStep)` → `"CUT"` or `null`. |
| `src/screens/postBakeView.test.ts` (new) | Exhaustive 6 phases × 9 steps equivalence with the old condition; FINISH → `null`. |
| `src/screens/GameScreen.tsx` | The 6 hard-coded `phase === "POST_BAKE" && makingStep === "CUT"` sites read the one decision. |
| `docs/reports/screenshots/post-w1-cs-1a/` | before / after screenshots (§5). |

**Not changed:** `gameReducer.ts` (CONFIRM_BAKE, finalization, POST_BAKE walk), scoring, Completion
Gate, inventory, save, recipes, ingredients, `MakingStepTabs`, CSS, e2e, Hint 5.0, TQ, taxonomy,
PR #275.

## 3. `≤ 6` tab gate

| Assertion | Result |
|---|---|
| `MAX_VISIBLE_COOKING_TABS` pinned at 6 (cannot be raised to pass) | ✅ |
| 25 Production recipes (guided / Lunch Rush profile) | ✅ all ≤ 6 · 18 at 6, 7 at 5 · max 6 |
| Free Cooking profile | ✅ 5 |
| Dinner (FREE pre-bake + identified recipe's post-bake; unidentified) | ✅ max 6 |
| 7-tab fixture (`D·S·C·T` + `FINISH` + `CUT`) | ✅ the same violation check reports it → the gate FAILS on 7+ |

## 4. GameScreen generic post-bake rendering

`const postBakeStep = renderedPostBakeStep(state.phase, state.makingStep)`:

| Site (`86b48fd` line) | Before | After | Kind |
|---|---|---|---|
| roomy stage (`:325`) | `BAKE \|\| POST_BAKE&&CUT` | `BAKE \|\| postBakeStepRendered` | layout |
| `isCookingLayout` (`:423`) | `… \|\| POST_BAKE&&CUT` | `… \|\| postBakeStepRendered` | layout |
| step tabs shown (`:509`) | `… \|\| POST_BAKE&&CUT` | `… \|\| postBakeStepRendered` | layout |
| tabs `nextReady` (`:515`) | `POST_BAKE ? cutConfirmReady : …` | `POST_BAKE ? isCutStep && cutConfirmReady : …` | CUT content |
| slice instruction card (`:626`) | `POST_BAKE&&CUT && !dinner` | `isCutStep && !dinner` | CUT content |
| stage interactive (`:641`) | `PREPARE \|\| POST_BAKE&&CUT` | `PREPARE \|\| postBakeStepRendered` | layout |
| cut progress + bar (`:674`) | `POST_BAKE&&CUT` | `isCutStep` | CUT content |

Only CUT is rendered, so every site evaluates exactly as before (pinned by `postBakeView.test.ts`
over every phase × step). The reserved FINISH step renders no Production UI.

## 5. CUT parity

- **DOM:** `.game-screen` outerHTML (canvas nodes and inline `style` removed) at CUT entry and at
  "cut ready" is **identical** between `main` and this branch, in every run pair.
- **Pixels (390×844, margherita guided, same driver):** `main` vs branch = 92 / 86 px (0.03%),
  the same as `main` vs `main` (92 / 86 px). The pizza-canvas raster varies run to run (branch
  vs branch reached 6.6% in one pair, max channel delta 6/255, confined to the pizza disc); that
  is pre-existing timing noise in the sauce / bake canvas, not a CS-1a change, and it appears
  identically on `main`.
- **Tabs text:** 「✓ 生地 ✓ ソース ✓ チーズ ✓ 具材 ✓ 焼く カット」 on both, at 390×844 and 360×800.
- Screenshots (before / after): `docs/reports/screenshots/post-w1-cs-1a/` — CUT entry, cut ready
  and RESULT at 390×844 and 360×800.

## 6. Verification

| Check | Result |
|---|---|
| Focused Vitest (`src/screens`, tab gate, `MakingStepTabs`, `PizzaStage.cutGesture`) | 15 files, 120 tests passed |
| `cookingProfiles.test.ts` + tab gate | 134 passed |
| Full Vitest | **217 files · 4518 passed · 1 skipped** |
| `tsc -b` | pass |
| `oxlint` | 0 findings in changed files; the 2 existing warnings in `scoringV2.noSauceProfile.test.ts` (untouched) are on `main` too |
| `vite build` | pass (existing chunk-size notice) |
| Chromium E2E — `pizza-cutting-phase4b`, `dynamic-cooking-steps`, `making-ui-1screen`, `finished-pizza-visual-2.0`, `stage-size-stability`, `dinner-mission`, `viewport-1screen` (390×844 + 360×800) and `layout-contract` (layout-chromium) | **106 passed · 14 skipped (project guards) · 0 failed**, no spec modified |
| WebKit gate | Not runnable in this container (Chromium only); runs in CI on PR #295 |

## 7. Human Verification

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2, **"内部refactorのみ（見た目/操作が変化しない）"
is 原則不要.** CS-1a changes no visible output or operation (DOM identical, pixel diff within `main`'s
own noise), so **no HV video** was recorded. Before / after screenshots are committed (§5) as the
static parity record. If the Owner wants a video anyway, it is a 390×844 margherita round to RESULT.

## 8. Acceptance Criteria

| # | Criterion | Result |
|---|---|---|
| 1 | 25 Production recipes ≤ 6 tabs | ✅ |
| 2 | Free Cooking ≤ 6 | ✅ (5) |
| 3 | Dinner keeps max 6 | ✅ |
| 4 | 7+ tabs makes the gate FAIL | ✅ (fixture) |
| 5 | 6 GameScreen CUT sites → generic post-bake rendering | ✅ |
| 6 | Current CUT UI / behaviour unchanged | ✅ (DOM identical, E2E green) |
| 7 | No non-CUT post-bake UI in Production | ✅ (FINISH → `null`) |
| 8 | Recipe / scoring / inventory / finalization semantics unchanged | ✅ (no reducer / logic diff) |
| 9 | CONFIRM_BAKE finalization not moved | ✅ |
| 10 | PR #275 behaviour not pre-empted | ✅ (no post-BAKE skip logic added) |

## 9. Not done here

- **CS-1b** (`finalizeRound` extraction + 25-recipe golden) — blocked on PR #275 (OPEN); authority
  for its design = OD-CS-2 = B.
- **FREE POST_BAKE HOME confirm gap** — independent Issue candidate, recorded in the Pre-start Gate
  §10.1; not fixed, not in CS-1.
