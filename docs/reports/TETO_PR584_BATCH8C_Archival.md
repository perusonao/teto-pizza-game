# PR #584 (Expansion Batch 8c) — Archival Record

Status: **#584 is superseded by #627 (FIN-E4b-ikura, merged as `db6e360`) and closed unmerged.** Docs-only; no runtime, golden, ladder or Preview change.
Owner decision (2026-10-23): the old ladder step 55 `ikura-salmon-pizza` / `salmon-roe` is **not adopted**. #584 must not be merged.

- #584 head `e2ac3012cd96a88c76430f8aa6a9756c2ed01810` (branch `claude/teto-pizza-recipe-expansion-5t77y7`, base `78a4a0f`; 3 commits `2f83b65`, `6e45fd3`, merge `e2ac301`). **The branch is kept** (do not delete it) so the full diff stays reachable.
- Compared against `main` `e1b4ec1` (after #627 / #630). Copies of the evidence live in `docs/reports/archive/pr584-batch8c/` and `docs/reports/screenshots/pr584-batch8c-archive/`.

## 1. Why step 55 is not adopted
1. Source process mismatch (#584 comment 2026-10-20, ChatGPT-fetched `pizzadb.jp/pizzas/ikura-salmon/`): roe and shiso are placed **after baking**; #584 puts every ingredient before the bake. Recorded in #527 / #621 as the reason for HOLD.
2. Redesign chosen by the Owner (#527 comment 2026-10-22, #621): ikura lives in the **post-bake late catalog** (`LATE_LADDER_STEPS`, number derived, no star gate), so the ordinary ladder keeps step 55 for the next ordinary batch. Same recipe id: #584 and #627 cannot coexist.
3. Consequently #584's `credited 57→58`, the star-gate baseline tightening and the `hint5.ladders55.json` +202 lines are **not carried over** (#527 comment 2026-10-22).

## 2. Classification
| #584 item | Disposition | Where it lives now |
|---|---|---|
| `salmon-roe` ingredient, `salmon-roe-grains` SVG, CSS 1.2em correction, reference SVG | **Replaced** — copied into #627 (reference SVG byte-identical on main) | `src/data/lateCatalog.ts`, `IngredientGlyph.tsx`, `App.css`, `docs/design/references/ingredient-icons-2.0/salmon-roe.svg`; `TETO_FIN-E4B-IKURA_Result.md` |
| `ikura-salmon-pizza` recipe row, reference pizza, Hint role, NO_SAUCE profile, order, size class, taxonomy | **Replaced** by late-catalog rows (OFF in Production) | `lateCatalog.ts` + the tables listed in #627 |
| Ladder step 55, credited 58, chapter 27, ledger/pin updates, `hint5.ladders55.json` (+202), `alphaFamilyOnly` | **Dropped by decision** (§1.3) | archived only: `test-pin-changes.pr584.diff`, #584 branch |
| `TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` (21 lines, catalog-size-derived counts: category 51→52 etc.) | **Dropped** — values depend on 62 ordinary recipes, which main does not have; main's JSON stays valid for 61. Regenerate with the audit tool if the ordinary catalog grows | `DH4-1_AUDIT.json.pr584.diff` |
| `e2e/expansion-batch8c.spec.ts` | **Not portable** — drives Shop step 55 → purchase → Research label; late ladder is OFF in Production. Kept as a reference for the E5 ON-build E2E | `expansion-batch8c.spec.ts.txt` (`.txt` so it is not collected as a spec) |
| Result 8C | **Archived verbatim** | `TETO_EXPANSION-BATCH-8C_Result.md` |
| 10 HV screenshots (390×844 / 360×800) | **Archived** (they show the retired step-55 UI, kept as roe-at-18–31px legibility evidence for AC-8) | `screenshots/pr584-batch8c-archive/` |
| Review Playthrough video (`batch8c-review-390x844.mp4`) | Delivered to the Owner directly, never committed (policy) — **not recoverable from the repo** | n/a |
| Codex review + CI record, Preview apply/restore log | Stays in the #584 thread (Preview was restored to #582 on 2026-10-20) | #584 comments |

## 3. Un-ported items (none blocks closing; each needs a decision only if/when the late catalog goes ON)
1. **Selectable-hint free-leak prefix false positive** (`mentionsIngredient`, Result 8C §4.3). `ing:salmon-roe` matches hidden `salmon` by substring. **Not on main** (`selectableHint.test.ts` unchanged). Latent: it can only fire when the late catalog is ON (E5), because OFF Production has no `ing:salmon-roe` chip. When E5 turns ON, re-apply the whole-id match with its two-direction test (diff in `test-pin-changes.pr584.diff`); do **not** loosen the check.
2. **Star-gate baseline (122★ meets goat-cheese 120★ at uniform ★2)** — only if a late recipe is `ladderCredit` or the ordinary credited count reaches 58. #627's late step has no star gate and no credit change, so nothing to do now; re-measure on the next ordinary batch.
3. **Ladder-derivation convention** (freeze steps 1–N−1, derive newest; Codex P2: keep the wider derivation test with a negative control for steps 52–54). Applies to any future ordinary batch; the lesson is in Result 8C §4.1.
4. **AC-8** (roe in 3 states on a post-bake look, ON build) and **Q-5** (ring cap) remain open in `TETO_FIN-E4B-IKURA_Result.md`; pizzadb.jp independent re-fetch (#527 D4) is still open; counts / bake window 58–78 stay provisional.

## 4. Claims
Session `01XFuM…` claim on #527 (#584 files) was released by Owner-approved proxy on 2026-10-22 (#527 comment). The `01QBfq…` claim on #621 (#627) is for already-merged work and touches none of the files in this PR. No open PR (#631, #620, #612, #587, #581, #540) touches `PROJECT_HANDOFF.md` or the archive paths.
