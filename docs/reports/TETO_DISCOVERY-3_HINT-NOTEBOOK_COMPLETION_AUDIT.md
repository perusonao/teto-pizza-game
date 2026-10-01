# Discovery 3.0 — Hint + Trial Notebook Completion Audit (READ-ONLY)

- Audited `main`: `73aac41ac7a3ee47bfbdea5e9d9f57a4c7def1c0` (= expected; `origin/main` has 0 commits beyond it).
- Scope: audit only. No src / e2e / CSS / save / spec change, no PR, no merge. This file is the only artifact.
- Method: `git log` / `git log -S` / `git diff` on `origin/main`, current source read, GitHub PR/Issue search. Nothing is inferred from memory of earlier sessions.

## 0. Fresh Gate

| Check | Result |
|---|---|
| main vs expected | identical |
| Open PRs touching Hint/Notebook | #293 (Hint 5.0 taxonomy audit docs), #255 (Hint 4.0 172-recipe audit docs), #296 (172 taxonomy docs). None is code. No open Notebook PR. |
| Open Issues | #292 (Hint 5.0), #253 (Hint 4.0), #238 (Hint 3.0). **No Issue mentions "Notebook" / 試作** (search = 0). |
| Notebook-related unmerged branches | `claude/p3-2-discovery-memo-model`, `claude/original-pizza-discovery-p3-audit` (see §6) |

## 1. Hint timeline (git evidence)

| Date | Commit | PR (merge) | What |
|---|---|---|---|
| 09-26 | `995f2ec` | #231 | Hint 2.0: progressive sheet (steps accumulate in one sheet) |
| 09-26 | `f7f1210`,`977d369`,`7761478` | #233 | Economy 1.0: purchases persisted (save v2 `discoveryHintPurchases`), paid levels 5/10/20/40 |
| 09-27 | `d4d558d`,`9b3db21` | #247, #251 | Hint 3.0 Selectable: category-selectable facts, `discoveryHintFacts` ledger |
| 09-28 | `4cf4172` | #284 | DH4-2C: 「わかっていること」 board + 「ヒントをもらう」 panel (構成/特徴) |
| 09-28 | `de11ae2` | #297 | **H5-1 Hint 5.0 ladder pure layer — first introduction** (`hint5Ladder.ts`, `HINT_CLASS_DISPLAY`) |
| 09-28 | `abce62a` | #297 | H5-2 reducer wiring behind flag (off) |
| 09-28 | `1ec4253` | #297 | **H5-3 ladder sheet UI: accumulating board + `サブトッピングの分類` + 「ここまでのヒントで、推理してみよう！」** (first commit containing both strings, `git log -S`) |
| 09-28 | `89451bd` | #297 | H5-4 all 25 recipes, empty CHEESE/KEY rung = 「なし」 |
| 09-29 | `89e9a85` | #298 | H5-5 Preview-only opt-in |
| 09-29 | `363026b` | #300 | **H5-6 production activation: `HINT5_LADDER_PRODUCTION_DEFAULT = true`** |
| 10-01 | `1593833` | #324 | Discovery 3.0 PR-3: key-free roles (`{ keyFree: true }`) |
| 10-01 | `79e1523` | #329 | PR-4b-A: pool>1 safety (no auto-target) |
| 10-01 | — | #331 | PR-4b-B: brazilian-calabresa (first key-free recipe, pool=2) |

Key fact: `git diff 363026b origin/main -- src/components/HintSheet.tsx` is **4 lines**, and since H5-6 the only later commits touching the file are PR-1/P3-3b/PR-4b-A-era changes unrelated to the board. **The accumulating-board UI the Owner saw earlier was never removed, replaced, or reverted. It is in main today, byte-for-byte the H5-3 renderer.**

## 2. Past UI vs current UI — the real reason (最重要)

Both screens are the **same component and same flow** (`Hint5LadderBody`, `HintSheet.tsx:782`):

- Board (top) = every COMPLETED rung, accumulated. Footer = exactly ONE next rung with 「たずねる N Pitz」.
- When no rung is left (`next === null`) the footer disappears and `completeText` = `HINT5_LADDER_COMPLETE_TEXT` (「ここまでのヒントで、推理してみよう！」) is shown (`hint5Ladder.ts:90,528`).
- The earlier screenshot = **ladder fully purchased** (all rungs complete). The current screenshot = **ladder in progress** (rungs 1–4 bought; rung 5 offered). 「ヒント5」 is the **rung index** (SAUCE1, CHEESE2, KEY3, STRUCTURE4, SUB_CLASS①=5), not "Hint 5.0".

Classification: **A (same flow, before/after purchase of the remaining rungs)**, plus a small **D (recipe difference)**: the number of SUB_CLASS rungs is per recipe, so a 1-sub-topping recipe finishes earlier than a 4-sub-topping one. B (revision difference): no. C (regression): **no**. E: none.

Why it feels unclear: the sheet never says how many rungs remain (deliberate: FREE LEAK / H5-INV, count is paid information), and the completed-state line only appears after the last purchase. That is intentional design, but it makes the mid-state look like "an unfinished screen".

## 3. Current Hint architecture (main)

```
recipe (RECIPES) ──► RECIPE_HINT_ROLES[recipeId]  (HintRoles = RecipeHintRoles | {keyFree:true})
   │                     │
   │                     └─► buildHint5Ladder()  → rungs[]  (index, kind, ordinal, subjectIds)  [INTERNAL, answers]
   ▼
state.discoveryHintFacts[recipeId] : string[]   (completion records h5:*, cls:<id>, ing:<id>, meta:ingredient-total)
state.discoveryHintPurchases      (legacy Economy 1.0 levels; read-only compat, M3)
   │
   ▼  hint5Ownership() → statuses / allKnown(INTERNAL)
hint5Presentation() → Hint5Presentation {board[], next{label,price}, completeText, legacyKnownIngredientIds}
   ▼
hint5SheetView(state) (discoveryHint.ts:514) → GameScreen → <HintSheet hint5=…/> → Hint5LadderBody
```

- **Existing 25 (`RecipeHintRoles`)**: 4 fixed rungs always — SAUCE(10) → CHEESE(10) → KEY_TOPPING(10) → STRUCTURE(5) — then one SUB_CLASS(5) per `hintSubToppingOrder` entry. Empty CHEESE/KEY rung is a normal paid rung answering 「なし」; empty SAUCE is RESERVED (no production recipe hits it). Authority = hand-authored `RECIPE_HINT_ROLES` validated by `hint5RolesValid` (G17).
- **No.26 (`{ keyFree: true }`)**: rungs derived from the recipe; only applicable rungs, consecutive indices, no KEY_TOPPING, no placeholder. brazilian-calabresa = SAUCE, STRUCTURE, SUB_CLASS×4 (no CHEESE). (`hint5Ladder.ts:198`)
- **Storage**: purchases live in `discoveryHintFacts` (save v2, written via `persistence.ts` union-merge, **persisted**). Pitz debit and fact append are one patch (`requestHint5RungFact`). **Not stored**: the open flag (`hintSheetOpen`), `hintOutcome`, and `hintSession` (session-only, carried across rounds via `ProgressionCarry`, `gameReducer.ts:1761`).
- **Close/reopen**: board is rebuilt purely from stored facts → identical.
- **FREE/HOME transitions**: `hintSession` is carried; board is derived from facts anyway.
- **Reload**: `hintSession` = null, facts survive. `resolveHintSession` prefers a DISCOVERABLE recipe that already has bought hints (`hasBoughtHints`, HE-UI-4), so bought information is not traded away. Bought Pitz are never lost (facts and balance move in one patch).
- **Escalation**: strictly linear (`expectedRungIndex` STALE check); the Dex-0 Margherita onboarding keeps the free session-only Hint 2.0 reveal (not persisted).
- **pool=1 vs pool>1** (`hintTarget.ts:95-104`): pool=1 → auto target. pool>1 → `OPEN_POOL` (「まだ発見できるピザがあるよ！」) unless a sticky/purchased target exists; a Dex pin cannot choose among several (OD-4b-A-2). With pool=2 live in production (calabresa), a player who has bought nothing and has ≥2 DISCOVERABLE recipes gets **no ladder at all** — only the OPEN_POOL message. This is the most likely explanation if a player reports "no hint available".
- **Entry points**: 💡 button in Free Cooking PREPARE (`GameScreen.tsx:880`), RESULT 「ヒントを見る」(retry with hint), Dex card 🎨 「ヒントを見る」. No hint access outside FREE PREPARE.

## 4. Trial Notebook current state

| Item | Status | Evidence |
|---|---|---|
| Attempt fingerprint (P1) | IMPLEMENTED | `attemptFingerprint.ts`, #313 |
| Pure model: `recordAttempt`, `#n`, retry, REVIVE, 50/2000 limits | IMPLEMENTED (logic) | `trialNotebook.ts`, #315 |
| `notebookView()` display model | IMPLEMENTED but **has no production consumer** | exported, only tests use it |
| ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH recording | IMPLEMENTED | `trialRecord.ts`, REGISTER_TO_DEX exactly-once, #316 / #322 |
| Duplicate notice 「📓 前にも同じ材料の組み合わせで作ったよ（試作#n）」 | IMPLEMENTED | `ResultPanel.tsx:261`, #317 |
| NEW attempt feedback (「試作#1を記録」 etc.) | **NOT IMPLEMENTED** — NEW shows nothing; the notice appears only on a *repeat* of the same combination |
| RESULT → Notebook entry/CTA | NOT IMPLEMENTED (deferred "P3-3c") |
| Overlay / modal / list screen | NOT IMPLEMENTED (deferred) |
| Persistent entry point (HOME/Dex/GameScreen) | **NOT IMPLEMENTED — 入口なし** |
| HintSheet integration | NOT IMPLEMENTED |
| Persistence | NOT IMPLEMENTED by design (session-only; `trialNotebook` in `ProgressionCarry`, absent from `persistence.ts`) → reload loses it |
| Latest-N limit | IMPLEMENTED in model (50 rows / 2000 identities), not visible anywhere |

**「プレイヤーは今どこを押せばNotebookを開けるか」→ 入口なし。** The only player-visible Notebook surface is the duplicate-notice sentence on an ORIGINAL RESULT. Note that the "試作#1" the Owner saw during Human Verification was this duplicate notice (the combination had been tried before). A first-time attempt shows nothing, so the player has no way to learn that a record exists, and the notice can't be tapped.

## 5. Branch / PR status of Notebook slices

| Slice | PR | Status |
|---|---|---|
| P1 Attempt Fingerprint | #313 | merged |
| P2 RESULT feedback hardening | #311 | merged |
| P3-1 Trial Notebook pure model | #315 | merged |
| P3-3a data/state wiring | #316 | merged |
| P3-3b RESULT duplicate notice | #317 | merged |
| Discovery 3.0 PR-1 (INCOMPLETE recorded like ORIGINAL) | #322 | merged |
| P3-2 Discovery Memo pure display model | none | **branch-only**: `origin/claude/p3-2-discovery-memo-model` (`9a50762`, `discoveryMemo.ts` 193 lines + tests; 19 files vs main). Never merged, no PR. |
| P3-3 Fresh Audit / P3-3 impl plan | none | **docs branch-only**: `origin/claude/original-pizza-discovery-p3-audit` |
| P3-3c Notebook CTA + overlay | — | **never implemented** (named as deferred in #316/#317 reports) |
| P3-4 Dex header entry / Memo UI | — | never implemented |

Reusability of `p3-2-discovery-memo-model`: pure, UNWIRED, DISCOVERABLE-only memo of *known* facts. It was written before PR-3/PR-4b (key-free roles, pool>1, `HintRoles` union) and touches `hint5Production.gate.test.ts`, so it needs a rebase and a re-gate against key-free roles before reuse. It is **not** needed for the Notebook entry; it is relevant only to a later "hypothesis" board (§7).

## 6. Discovery loop (per step)

| Step | Rating | Note |
|---|---|---|
| UNKNOWN (Dex shows undiscovered) | GREEN | not re-audited in depth |
| FREE attempt | GREEN | |
| Feedback (RESULT, P2 line, oracle neutralized) | GREEN | PR-1 removed the free "combination was right" signal |
| Notebook | **RED** (record: GREEN; player-visible review: RED) | recorded invisibly; only duplicate sentence exists; no entry, no list |
| Hint | GREEN pool=1 / **YELLOW pool>1** | ladder complete; pool>1 without a bought target = OPEN_POOL only; hints only reachable in FREE PREPARE |
| Hypothesis (compare Notebook + Hint) | **RED** | the two never appear together; Notebook not viewable at all |
| Retry | GREEN | RETRY_SAME_RECIPE / retry-with-hint |
| NEW DISCOVERY → Dex | GREEN | |

## 7. Completion plan (small, independently mergeable; no schema change)

- **H1 — Hint ladder legibility (UI copy only, no authority change).** Keep authority untouched. Make the mid-state read as "in progress by design": e.g. fixed header above the board that is identical for every recipe (no counts), and keep 「ここまでのヒントで…」 as is. Also make the OPEN_POOL message actionable without leaking pool size. Needs Owner decision (see OD-1).
- **H2 — Hint reachability from RESULT/Notebook** (optional): 「ヒントを見る」 already exists on RESULT; only the Notebook-side link is new (depends on N1).
- **N1 — Notebook entry + read-only list.** One persistent entry (candidate: next to the 💡 button in FREE PREPARE and a RESULT CTA on the ORIGINAL card, mobile 390×844 / 360×800). Consume existing `notebookView()`; fixed-height modal like the Ingredients modal. Content = the player's own combination + the P2 line shown at the time + `#n`. No recipe id/name, distance, candidate, hint fact, technique, or retry count. Show NEW attempt `#n` in RESULT so the player learns the Notebook exists. Session-only still (no schema change).
- **N2 — Notebook × Hint view ("hypothesis board").** Read-only side-by-side of Notebook rows and the bought-hint board for the current target. Only after N1. Must not let the combination of Notebook + hints become an exact-match oracle (Notebook never marks a row "right"). Use P3-2 memo branch only if N2 needs it.
- **N3 (optional, Owner decision) — persistence.** Only if the Owner wants the Notebook to survive reload. This is the only item that might need a save change; the current evidence does **not** require one for N1/N2.

Order recommended: **N1 → H1 → N2 → (N3 if decided)**. N1 is the missing link of the loop; H1 is copy-only and can run in parallel.

## 8. Save schema

Not needed for H1, N1, N2. Only N3 (reload persistence of the Notebook) would touch it, and that is an Owner decision, not a requirement of the loop. Do **not** bump schema speculatively.

## 9. Blockers / Owner Decisions

- **OD-1** H1: what wording makes the in-progress ladder clear without showing rung counts (counts are paid information)?
- **OD-2** N1: where is the persistent entry (FREE PREPARE row, RESULT CTA, Dex header, HOME)? All of the above can coexist; pick the minimum.
- **OD-3** N1: show NEW `#n` in RESULT (changes the "no free signal" rule of PR-1 only if copy differs between NEW kinds — copy must be identical for ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH).
- **OD-4** N3: should the Notebook persist across reloads?
- **OD-5** pool>1 UX: is OPEN_POOL's current message enough now that production has pool=2?
- No technical blocker found. Human Verification (390×844 video + screenshots) applies to H1/N1/N2 per `TETO_HUMAN-VERIFICATION-POLICY.md`.

## 10. Honest limits of this audit

- Read-only; I did not run the test suite or a browser. UNKNOWN/FREE/Dex ratings in §6 are from code structure, not a fresh playthrough.
- The statement "screenshots A vs B are rung-complete vs in-progress" is derived from `Hint5LadderBody`/`hint5Presentation`; I did not see the Owner's screenshots, only the strings you quoted.
