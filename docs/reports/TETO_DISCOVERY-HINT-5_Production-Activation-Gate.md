# Discovery Hint 5.0 — Production Activation Gate

- **Issue:** #292.
- **Audited H5-4 code head:** `89451bdc90349ecef79ab2cdc7555e701eb3b549`. This report is the only
  commit on top of it (docs only).
- **Audited `main`:** `86b48fd51423a8f76db5398ab88ecfd944e2ae10`.
- **Date:** 2026-09-29.

**Scope: a read-only Gate.** Nothing was deployed and nothing was merged. The production flag stays OFF.
This Gate did not change:
- `main`, the H5-4 code, or PR #275 / #293 / #295 / #296;
- the W2-A branch (a read-only reference);
- TQ, taxonomy, recipes or the economy.

All trial merges, builds and tests ran in scratch worktrees outside the repo, which were removed
afterwards.

**Resumed run.** The working tree and the stash were clean, so there was no uncommitted Gate diff to
keep. The Gate was rebuilt from `89451bd`, and every check below was run again.

## 0. Verdict

**READY FOR PREVIEW (conditional).** Every code gate (AG-1 to AG-12) passes. Two procedural
prerequisites remain, and both need an Owner go:

1. **Open the H5-4 PR.** CI runs only on `pull_request → main`, so `89451bd` has never run CI.
2. **A Preview-only way to turn the flag on, and to seed states for the iPhone.** Today the flag can be
   turned on only when `import.meta.env.DEV` is true, so a Preview build is always OFF (§7).

## 1. Fresh Check

| Item | State | Changed since the last Gate? |
|---|---|---|
| `origin/main` | `86b48fd` | No |
| H5-4 branch | `89451bd` (local = origin) | No. The working tree is clean. |
| Issue #292 | open. The only comment is the H5-4 completion report. | No |
| PR #275 | head `21fbedf`, base `4f7443a`. CI green, 0 review threads. | No |
| PR #293 | head `1bb4f9d`. Docs/tools only. CI green (WebKit skipped as docs-only). 1 Codex P2 thread on the generator script. | No |
| PR #295 | head `13d6836`, 7 ahead of main. CI 9/9 green. 3 Codex P2 threads on the classifier script. | **No** |
| PR #296 | head `7792bc8`. Docs/tools only. CI 9/9 green. 2 Codex P2 threads on the HCG generator. | No |
| W2-A authority | `claude/w2a-hint5-role-authoring-review` at `ab31da3` (was `be30659`). It is 2 ahead of main and changes only 3 docs/data/tools files. There is no PR. | **Yes, docs only** |

- **The review threads on #293, #295 and #296** are all about generator scripts. None touches Hint 5.0
  runtime code.
- **W2-A and Hint 5.0:**
  - The W2-A pack records OD-W2-H5-ROLE-1 / SUB-1 for 9 new W2-A recipes.
  - It does not change `recipeHintRoles.ts`, which is byte-identical between `5eadb96` and `89451bd`.
  - Its recipes are not in the runtime 25, so gates A / B / C, G7 and the taxonomy gates are unaffected.
  - All 9 are single-sauce and need no Technique, so they satisfy G7.
  - 5 of them (vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille-pizza) have no
    cheese. They can become Hint 5.0 targets only after OD-H5-P4-CHEESE (H5-4) is in `main`.
    That is a **merge-order dependency**, not a blocker for this Gate.

## 2. Integration Gate (PR #295 / CS-1a and the other open branches)

In a scratch worktree, H5-4 was merged with #295, then #275, #296, #293 and W2-A (`ab31da3`).

| Merge | Result |
|---|---|
| H5-4 + #295 | Conflicts in exactly **2 files, 1 hunk each**: the import lines in `GameScreen.tsx`, and adjacent sections in `PROJECT_HANDOFF.md`. Identical to the H5-4 report and the previous Gate. Keeping both sides resolves them. |
| + #275 | Clean (`App.css` and `gameReducer.ts` merge automatically) |
| + #296 / #293 / W2-A | Clean (no shared files) |

### Semantic check (no conflict)

- **The merged `GameScreen.tsx`:**
  - Compared with PR #295, it differs only in Hint 5.0 lines: the import, the prop and the `HintSheet`
    props.
  - Compared with H5-4, the difference contains no Hint code.
  - So #295 (the `postBakeView` decision, the 6-tab ceiling and the CUT sites) never touches the hint
    sheet region, and H5-4 never touches the post-bake or CUT code.
- **The hint sheet exists only in Free Cooking PREPARE.** It cannot coexist with a post-bake or CUT
  screen.
- **Results on the merged tree:**

| Check | Result |
|---|---|
| `tsc -b` / `vite build` | clean / OK |
| `oxlint` | 0 errors, the 2 pre-existing warnings |
| Vitest | **228 files · 4675 passed · 1 skipped** (pre-existing) |
| E2E Chromium 390×844 + 360×800: hint5-ladder, hint-sheet, hint-facts-save, dex-hint, dinner-mission, pizza-cutting-phase4b, dynamic-cooking-steps, making-ui-1screen, lunch-rush-result-ranking | **84 passed**, 16 skipped (pre-existing per-engine skips) |
| E2E layout-contract | **12 / 12** |
| DEV opt-in key in the production bundle | 0 |

- **Semantics that stay unchanged:**
  - Hint 5.0: the same ladder, prices and M3-D behaviour.
  - Post-bake rendering: PR #295's own gate tests pass.
  - 6-tab gate: `cookingProfiles.tabGate`, `postBakeView` and `cookingProfiles` pass (they are part of the 4675 above).
  - CUT: `pizza-cutting-phase4b`.
  - Dinner: `dinner-mission`, plus a scratch test that with the flag ON, a Dinner run cannot open the
    hint sheet and refuses `PURCHASE_HINT5_RUNG`.
- **Conclusion:** there is no semantic conflict.

## 3. Activation Gate

| # | Item | Verdict | Evidence |
|---|---|---|---|
| AG-1 | 25/25 ladders complete | **PASS** | Gate A: every recipe walks from the first rung to the complete line, with every request answered at the P-C price. The reducer also completes all 24 paid targets. |
| AG-2 | Reaching RESERVED = 0 | **PASS** | Gate B: `hint5ReservedRungs` is `[]` for all 25, and no reachable request returns RESERVED, with or without an Economy 1.0 ledger. |
| AG-3 | G7 | **PASS** | Every recipe has a single sauce and needs no Technique. |
| AG-4 | Taxonomy / production eligibility | **PASS** | G1, G2, G16, G17, G18, G22, G23 and G24. |
| AG-5 | M3-D FREE LEAK | **PASS** | The pure sweep (over 500 comparisons), the DOM sweep and E2E all show a pre-purchase view identical to a fresh save. 「なし」 never appears in an offer. |
| AG-6 | Flag OFF parity | **PASS** | See §4. |
| AG-7 | No DEV opt-in in the production bundle | **PASS** | 0 references. This holds for H5-4 alone and for the merged tree. |
| AG-8 | Save / reload / Full Reset / forward compatibility | **PASS** | No schema bump. A bought 「なし」 survives a reload without recharge. Full Reset clears it. Unknown and future ids are kept. |
| AG-9 | Legacy purchases retired | **PASS** | The reducer refuses `PURCHASE_SELECTABLE_HINT`, and the UI has no old purchase entry. |
| AG-10 | Invalid taxonomy fails closed | **PASS** | Pure and reducer: NOT_A_TARGET, 0 Pitz. UI: a sheet with nothing to buy, never the old body. |
| AG-11 | #295 integration has no semantic blocker | **PASS** | §2 |
| AG-12 | Latest `main` has no semantic blocker | **PASS** | `main` is unchanged. H5-4 is 0 behind. |
| AG-13 | The CI matrix can be met | **PASS locally / CI not yet run** | §6 |
| AG-14 | Preview is possible | **Conditional PASS** | §7 |
| AG-15 | Owner iPhone HV is possible | **Conditional PASS** | §7 |

The Hint 5.0 gate tests were also run on their own at `89451bd`: **10 files · 105 tests, all
passed**. Every ID above (G-series, gate A / B / C, M3, the flag-OFF and invalid-taxonomy files, the
economy sim) is one of those assertions.

## 4. Parity results

| Parity | How it was checked | Result |
|---|---|---|
| Flag OFF vs. production behaviour | `gameReducer.hint5.flagOff`: for every target and index, `PURCHASE_HINT5_RUNG` returns the same `state`; the ladder view and request helper are inert; the 材料 / 構成 / 特徴 charges and stored facts are unchanged; the Dex-0 onboarding is unchanged | PASS |
| Flag OFF, the UI | E2E: with no opt-in the old sheet renders (`ヒントをもらう` is present, and the ladder attribute is absent). The existing `discovery-hint-sheet`, `discovery-hint-facts-save` and `discovery-dex-hint` specs pass unchanged. | PASS |
| `hint5LadderActive` with the flag OFF | Tested false for every target | PASS |
| Production bundle | 0 references to the DEV opt-in key, on H5-4 and on the merged tree | PASS |
| Merged tree vs. H5-4 | The same Hint 5.0 tests and E2E pass after merging #295 / #275 / #296 / #293 / W2-A | PASS |

## 5. Economy Gate

**24 paid recipes** (Dex-0 Margherita excluded):

| | H5-2 | H5-4 |
|---|---|---|
| Total | 910 | **970** |
| Mean | 37.9 | **40.4** |
| Min / max | 25 / 50 | **35 / 50** |

**Progression walk** (real reducer, flag ON): every profile × quality completes 25 / 25, the minimum
Pitz is never negative, there is no deadlock, and there are no RESERVED stops.

| Quality | Profile | Hint spend | Margherita replays |
|---|---|---:|---:|
| ★4 | NONE / FIXED4 / FULL | 0 / 840 / 970 | 0 / 0 / 0 |
| ★3 | NONE / FIXED4 / FULL | 0 / 840 / 970 | 0 / 0 / **1** |
| ★1 | NONE / FIXED4 / FULL | 0 / 240 / 240 | 26 / 38 / 38 |

The ★1 figures are unchanged from H5-2 (only the first rung is affordable at each stage).

### The ★3 final-stage replay (left as an Owner question; not adjusted)

- **What happens:** at the last stage (quattro-formaggi, Dex 25) a ★3 player who buys every hint has
  185 Pitz. That stage costs a 35 Pitz ladder plus a 200 Pitz Shop unlock (fontina + gorgonzola),
  against a 130 Pitz discovery reward. One Margherita replay (+80 Pitz) closes the gap. H5-2 needed none.
- **Assessment:** this is **not a bug or a blocker.**
  - There is no deadlock, and the replay is one bake at the final stage only.
  - The cause is the Shop unlock at the last stage, on top of the 「なし」 rungs' +10 each.
- **Owner question:** accept it as the intended economy? If not, the options are to make the 「なし」
  rungs cheaper, to raise the last stage's reward, or to exclude ★3-FULL from the target play. No
  adjustment has been made.

## 6. CI readiness

- **Workflows:** `ci.yml` and `e2e-webkit.yml` run only on `pull_request → main`. The H5-4 branch has no
  PR, so **no CI result exists for `89451bd`**. Opening a PR needs an Owner instruction.
- **Local equivalents:**

| CI job | Local result |
|---|---|
| WebKit CI script tests | 61 / 61 |
| `npm run lint` / `npm test` / `npm run build` | OK |
| layout-chromium | 12 / 12 |
| classify | `webkit_required=true` (25 of the 80 changed files are not docs). WebKit E2E will run. |

- **Not verifiable here:** the WebKit E2E. This environment has only Chromium installed.
  `discovery-hint5-ladder.spec.ts` will run on both WebKit projects (a dev server, so the
  DEV opt-in works). It passes on Chromium at 390×844 and 360×800, but Safari-specific differences can
  only be seen in CI.

## 7. Preview readiness

**What exists today**
- Previews are built by a separate repo (`perusonao/teto-pizza-game-preview`) through a manual dispatch.
  That build sets `VITE_PREVIEW_MODE`, which the production build never sets.
- A Preview uses its own save key (`teto-pizza-preview-save-v1`) on the shared origin, so it does not
  touch the Owner's production save. It also starts empty.
- `hint5Flag.ts` reads its opt-in only when `import.meta.env.DEV` is true, so **a Preview always shows
  the old sheet.**
- On an iPhone the Owner cannot edit localStorage.

**A way forward (proved in a scratch worktree; not in this branch)**
- Gate the opt-in on `DEV || VITE_PREVIEW_MODE`, the same shape as the existing `DINNER_PREVIEW_ALLOWED`.
  It is a one-line change, and production stays unchanged.
- **Scratch results:**
  - The production build had 0 references to the opt-in key. The Preview-style build had 1.
  - With the opt-in ON, a served Preview-style bundle showed the ladder and the old purchase button
    was absent. marinara's cheese rung became 「チーズなし」 after the purchase. It saved only under the
    Preview key, and a planted production-key sentinel was untouched.
  - Without the opt-in, the same bundle showed the old sheet.
- **On an iPhone**, a Preview-only URL switch (for example `?hint5=1`) and named HV seeds (normal /
  cheese-none / key-none / M3 ALL / M3 PARTIAL / candidate = 1) are needed. Both are compiled out of
  production, with a bundle gate to prove it. Without seeds, cheese-none and key-none need a Dex of 14
  or more.
- This is H5-5-sized work and needs an Owner go. It was not started.

**Sequence:** open the H5-4 PR and get CI green (including WebKit) → add the Preview-only switch and seeds
with the bundle gate → dispatch a Preview and check that the badge shows the intended SHA → Preview smoke
test → Owner iPhone HV → the production flag decision (a separate phase).

## 8. Owner iPhone HV checklist (390×844 first)

Open the Preview with the Hint 5.0 switch on.

1. **A normal recipe** (for example meat-lovers): one next rung is visible, with its price.
2. **A cheese-none recipe** (marinara): before the purchase it is the same 「チーズ 10 Pitz」 as any
   other recipe and never says 「なし」. After the purchase the row reads 「チーズ」 | 「なし」, and the
   next rung is the key topping.
3. **quattro-formaggi key-none:** the key rung is a plain 「キートッピング 10 Pitz」. After the purchase
   it reads 「なし」, and buying STRUCTURE completes the ladder.
4. **M3 already-known:** the offer looks the same as a fresh save. After tapping, 「このヒントはもう知っていたよ！」
   appears and Pitz does not drop.
5. **Multiple SUB_CLASS** (meat-lovers): ①②③ show only the class (🥩 肉系), never a name.
6. **The last SUB_CLASS:** its class is answered, then 「ここまでのヒントで、推理してみよう！」 appears.
7. **Reload:** the bought rows and Pitz are kept, and nothing is charged again.
8. **After Full Reset:** the ladder starts again at rung 1.
9. **The old-hint archive:** earlier purchases stay under 「以前のヒント」 and are not repeated on the board.
10. **Horizontal overflow and clipping:** no sideways scroll, no clipped text, and 「たずねる」 and
    「閉じる」 stay fully visible and easy to tap.
11. **Pitz changes:** each purchase costs 10 / 10 / 10 / 5 / 5 …, the button is disabled when Pitz is
    short, and a double tap charges once.
12. **Ladder complete:** the button disappears and nothing more can be bought.

Also check the Preview badge (PREVIEW · SHA) and that the production save is unchanged.

## 9. Remaining blockers

1. The H5-4 branch has no PR, so no CI has run on it. It needs an Owner go to open one.
2. The Preview-only switch and seeds are not implemented (H5-5-sized, needs an Owner go).

Neither is a code defect.

## 10. Remaining Owner Decisions

1. Open the H5-4 PR, and start the Preview-only work.
2. Accept the ★3 final-stage replay as the intended economy, or ask for an adjustment.
3. The production flag ON (after CI, the Preview and the iPhone HV).
4. **OD-H5-P4-SAUCE stays open, waiting on TQ-1D.** It was not decided here. No sauceless or Technique
   recipe is in the production set (G7 and gate B).
5. Merge order across #295 (conflicts are only adjacent lines), H5-4 and the W2-A dependency.

## 11. Final verdict

**READY FOR PREVIEW (conditional on the two prerequisites in §9).**

The production flag is OFF. Nothing was deployed or merged, and no other branch was changed.
