# Original Pizza Recovery P2 — RESULT Feedback Hardening (Result Report)

- **Audited / base `origin/main` SHA:** `af8d46d1215642090aceeaf2703b5a15145f06e4` (fresh fetch)
- **Branch:** `claude/original-result-feedback-p2` (new, from latest `origin/main`; **not** stacked on P1, and **no dependency on** the Attempt Fingerprint — a gate test asserts no production file references it)
- **Scope:** pure RESULT-feedback hardening + focused ResultPanel wiring + tests + docs. No PR.
- **Verification Policy (`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`):** this task changes **no production-visible UI/copy today** (§6), so no video / screenshot is produced. Any Owner decision below that changes visible copy will trigger it at implementation.
- **Verdict:** **B. OWNER DECISION REQUIRED** (§12). All safe hardening is done; four decisions remain.

## 1. Fresh Audit against latest main

`origin/main` moved from the Fresh Audit's `21dc0a6` to `af8d46d` by **PR #309 only** (Taxonomy / HCG: docs + data + one tool; `git diff 21dc0a6..af8d46d -- src` is empty). Every code claim of the Fresh Audit still holds:

| Item | Latest main | Matches the Fresh Audit? |
|---|---|---|
| matcher states | `NO_MATCH`, `UNIQUE_MATCH`, `AMBIGUOUS` → `ORIGINAL` / `NEW_DISCOVERY` / `ALREADY_DISCOVERED` / `AMBIGUOUS` / `INCOMPLETE_MATCH` | ✅ |
| AMBIGUOUS | shown through the ORIGINAL card with the ordinary lead; `resultNearMiss` returns no line (outcome ≠ ORIGINAL) | ✅ (gap G-1) |
| near-miss | `d = missing + extra + (sauceBase differs)`; classes ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / FAR; nearest DISCOVERABLE candidate, hint-order tie-break | ✅ |
| ORIGINAL copy | "図鑑にはない、あなただけのピザ！" / INCOMPLETE_MATCH lead | ✅ |
| privacy | line = `{kind, textJa}` only; no recipe/ingredient in copy | ✅ |
| Hint 5.0 economy | ladder 25–50 Pitz; near-miss reads no hint fact | ✅ |
| production collisions | **0** (25 recipes, 25 distinct identities) | ✅ |

No discrepancy → implementation proceeded.

## 2. Current behaviour (before P2) and what was wrong

- **G-1 (P2-A)** AMBIGUOUS is presented with the ordinary "あなただけのピザ！" although the composition *is* a recipe identity.
- **F-1 (P2-B)** A colliding target (same items + sauce base as another target) was still a near-miss *candidate*: "add one" toward it would end as AMBIGUOUS = ORIGINAL again. The existing test T-10 even pinned that lie (`ADD_ONE` toward a duplicate pair).
- **G-2 (P2-B)** A sauce-only difference always said "ソースを変える", also when the *target* has no sauce (false, and it would hint at the undiscovered `no-sauce` Technique — H5-INV-4).
- **P2-C** d ≥ 3 says nothing (except the key-unused nudge).
- **P2-D** SAUCE_ONLY already says "your sauce is wrong" (component word) — existing behaviour.

## 3. Changed files

Modified (4): `src/logic/discovery/nearMiss.ts`, `src/state/resultNearMiss.ts`, `src/components/ResultPanel.tsx` (lead line via one table), `src/logic/discovery/nearMiss.test.ts` (T-8 keys, T-10 contract, anti-spoiler key list).

New: `src/state/originalResultCopy.ts` · tests `nearMiss.p2.test.ts` (16), `resultNearMiss.p2.test.ts` (14), `originalResultCopy.test.ts` (9), `ResultPanel.p2.test.tsx` (30), `resultFeedback.gate.test.ts` (13) · `tools/result_feedback_mutation.mjs` · `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P2_RESULT-FEEDBACK_Mutation.json` · this report.

Not touched: matcher, signature, catalog, recipe data, Hint 5.0 (ladder, flag, economy), hint facts, persistence / save, Builder, Pantry, LC-R5b, Cooking Steps, CSS, `GameScreen`.

## 4. P2-A — AMBIGUOUS handling

- `originalResultKind(outcome)` → `ORDINARY | AMBIGUOUS | INCOMPLETE_MATCH` (pure, `originalResultCopy.ts`); `ResultPanel` reads its lead from one table, `ORIGINAL_LEAD_COPY[kind]`.
- **Internally distinguished, externally identical.** The AMBIGUOUS lead is **byte-identical to the ordinary one** until the Owner decides (`AMBIGUOUS_COPY_DECIDED = false`). Production copy is therefore unchanged.
- **Why deferring is safe today:** production has no identity collision, so AMBIGUOUS is unreachable in production. A test (`originalResultCopy.test.ts`) fails the moment a colliding recipe is added, forcing OD-P2-1 first.
- **No leak:** the DOM of an AMBIGUOUS card is **byte-identical** to an ordinary card for every near-miss line (7 comparisons); no candidate id / count / list, no `AMBIGUOUS`, no `data-*` reaches the DOM.
- Collision recipes, matcher semantics and recipe data were not touched.
- **Owner copy candidates (not wired, in `AMBIGUOUS_COPY_CANDIDATES`):**
  - **A** 「図鑑にはまだ載っていないピザ！別の組み合わせも試してみよう。」 — discloses nothing; would replace today's ordinary copy for *both* kinds.
  - **B** 「この組み合わせは、まだ図鑑には載せられないみたい。」 — discloses that this exact set is a recipe identity that cannot be registered (same privacy class as INCOMPLETE_MATCH); no count, no id.
  - **C** keep today's copy (retains the uniqueness claim).

## 5. P2-B — near-miss contract after hardening

| Class | Meaning (unchanged) | P2 change |
|---|---|---|
| ADD_ONE / REMOVE_ONE | d = 1, one ingredient to add / remove | — |
| SAUCE_ONLY | d = 1, only the sauce differs | now carries an internal `sauceStep` = CHANGE / ADD / REMOVE |
| CLOSE | d = 2 | — |
| FAR | d ≥ 3 (only the key-unused nudge) | — |

Hardening:
1. **Unreachable targets are never candidates** (identity = sorted items + sauce base shared with another catalog target ⇒ the matcher says AMBIGUOUS). An exact match with such a target still means "no near-miss statement" — never a line about another recipe. Roles are respected exactly like the matcher (same ids with a different base are *not* a collision).
2. **Sauce step wording.** CHANGE and ADD (the pizza has no sauce yet) keep the existing line — true for both and directional; the Hint-to-discovery reachability walk (`discoveryHint.walk.test.ts`) relies on that direction (I first tried a generic "add one" for ADD; that suite correctly failed, so it was reverted). **REMOVE** (the target has no sauce) now uses the generic "remove one" line: "change the sauce" would be false and would hint at the undiscovered `no-sauce` Technique. Only reachable with a future sauce-less recipe.
3. `kind` semantics are unchanged; only `SAUCE_ONLY` gains `sauceStep`; the result still holds no recipe, ingredient or id.

Verified properties:
- **Truthfulness on the real 25-recipe catalog and the real matcher.** For every recipe, every single-edit neighbour (remove one, add one, swap the sauce, drop the sauce) that is an ORIGINAL and gets a directional line is followed: the promised kind of edit reaches a real `NEW_DISCOVERY`. **> 200 pizzas checked, 0 lies.**
- **Multiple candidates:** the nearest candidate decides; candidate order never changes class or distance; an ADD vs REMOVE tie yields one class and both statements are true.
- **Hidden info:** result keys are only `kind / distance / keyUnused / sauceStep`; no id or name for hidden recipes / ingredients.

## 6. P2-C — FAR feedback decision

**Evaluated: technically safe, but Owner-gated → implemented OFF.**

- The generic line 「🧪 別の組み合わせも試してみよう！」 (`NEAR_MISS_FAR_GENERIC_COPY`, kept **outside** `NEAR_MISS_COPY` so the pinned production copy set is unchanged) asserts nothing about distance, recipes or ingredients; it contains no number.
- Guarantee analysis: it is derived from "an ORIGINAL with candidates and no nearer line". That presence carries **no more information than today's silence** (both mean d ≥ 3), so it cannot leak; it is never shown for a known pizza, a failed bake, a guided round, AMBIGUOUS / INCOMPLETE_MATCH / NEW_DISCOVERY, or when nothing is discoverable (so it never claims something is left to find).
- `RESULT_FAR_GENERIC_ENABLED = false`; `GameScreen` calls `resultNearMiss(state)` with no option (gate-pinned). Showing it needs OD-P2-2 and then triggers the Verification Policy.

## 7. P2-D — component feedback: deferred (not added)

No "sauce/cheese looks right" line was added. **Why the existing lines do not replace a paid Hint 5.0 rung (argument + gates):**
- No class states which component or ingredient is right; the only component word is the pre-existing SAUCE_ONLY "ソース" (a test pins that it is the only one, and that no line says チーズ / トッピング / 具材).
- A line requires the player's *own* pizza to already be within d ≤ 2 of a discoverable recipe; the information is bounded by what the player found by cooking, and costs a full cook plus stock.
- Structural proof of independence: `nearMiss.ts`, `resultNearMiss.ts` and `originalResultCopy.ts` import none of `hint5*`, `discoveryHint`, `hintPurchase`, `selectableHint`, `deduction*`, `persistence`, `economy`, `pitzReward`; `ResultNearMissInput` has no hint-fact / Pitz / ladder field; a runtime test shows the output is identical with extra `discoveryHintFacts` / `pitzBalance` present.
- Reusing already-disclosed facts (e.g. "sauce already known") **is not implemented** — that needs the proof + OD-P2-4.

## 8. Hint 5.0 economy interaction

Unchanged and untouched: ladder, prices (SAUCE 10 / CHEESE 10 / KEY 10 / STRUCTURE 5 / SUB 5), flag, facts, reducer. P2 reads and writes no hint fact and no Pitz value, and cannot make a paid rung redundant beyond what SAUCE_ONLY already did before P2.

## 9. Privacy verification (automated)

`ResultPanel.p2.test.tsx` renders the ORIGINAL card for **ordinary / AMBIGUOUS / INCOMPLETE_MATCH × 7 near-miss variants** and inspects the raw HTML (attributes, aria, `data-*`, classes, titles):
- absent: the hidden recipe's id and name, all hidden target ids (`shipped:…`, `collision-target-…`), `targetIds`, `blockedTargetIds`, `AMBIGUOUS`, `distance`, the selected recipe's sentinel name, hidden ingredients' ids/names;
- present: only the player's own two ingredients as list items;
- AMBIGUOUS ≡ ordinary, byte for byte.
Plus: the copy set is closed (6 strings) and names no recipe / ingredient; `resultFeedback.gate.test.ts` pins the wiring (§10).
Debug output: `ScoringV2DebugPanel` is Preview-only and unchanged; no new log or debug path was added.

## 10. Production wiring and isolation

- `ResultPanel` is rendered by `GameScreen` only; `resultNearMiss` has one production caller (`GameScreen`, no options); `originalResultCopy` one (`ResultPanel`). Dinner Mission, Lunch Rush and guided rounds have no path to any of it (source-scan gate over the mission / dinner / mission-overlay surfaces; `resultNearMiss` still returns `null` for `freeCook = false`).
- Owner-pending pieces stay unwired: `AMBIGUOUS_COPY_CANDIDATES`, `AMBIGUOUS_COPY_DECIDED` and the FAR-generic switch are referenced by no other production file.
- No Attempt Fingerprint, Trial Notebook, persistence, save, Builder, Pantry, LC-R5b, Cooking Steps, rescue-hint or recipe-data change.

## 11. Verification

| Check | Result |
|---|---|
| New tests | 16 + 14 + 9 + 30 + 13 = **82** (plus 4 updated assertions in `nearMiss.test.ts`: T-8 ×2, T-10, the anti-spoiler key list) |
| Full Vitest | **253 files / 4 967 passed, 1 skipped** |
| `tsc -b` | clean |
| `oxlint` | no findings in changed files (the one warning printed is pre-existing in `scoringV2.noSauceProfile.test.ts`) |
| `npm run build` | passes |
| Focused mutation (`node tools/result_feedback_mutation.mjs`) | **23 mutants: 22 killed, 1 equivalent, 0 survived, 0 invalid** (score 22/22 non-equivalent) |

Regression coverage requested: UNIQUE_MATCH regression (existing reducer/matcher suites, unchanged and green), ordinary Original, ADD_ONE, REMOVE_ONE, SAUCE_ONLY, CLOSE, FAR / no-near-match, AMBIGUOUS, no-sauce, multiple near candidates, discovered / undiscovered privacy, Dinner / guided / Lunch Rush isolation.

What the tests taught: the first attempt (generic "add one" for a sauce-less pizza) broke the existing reachability walk (`discoveryHint.walk.test.ts`, Dex 22) and the copy pin in `techniques.tq1c.test.ts`; both were correct guards, so the design was changed rather than the guards. The mutation run also exposed two real test gaps (role-aware collision; known pizza never gets a FAR line), now covered. The one equivalent mutant (unsorted identity key) cannot change behaviour because catalog items are already sorted.

## 12. Remaining Owner Decisions

| ID | Decision | Options | Status |
|---|---|---|---|
| **OD-P2-1** | AMBIGUOUS player-facing copy | A neutral for both / B distinct (discloses "unregistrable identity") / C keep. Needed **before** any colliding recipe ships (a test forces it) | pending |
| **OD-P2-2** | Show the generic FAR line? | off (today) / on with the candidate copy / other copy | pending (mechanism ready, OFF) |
| **OD-P2-3** | Near-miss strength and wording | keep as is / refine the ADD-step wording ("ソースを足す…") / make SAUCE_ONLY generic (removes the only component word) | pending |
| **OD-P2-4** | May RESULT reuse facts already disclosed by Hint 5.0? | no (today) / only for already-bought facts, with an economy proof | pending; nothing implemented |

## 13. P3 readiness

P3 (Trial Notebook, session-only) is **not blocked by P2**: P2 changed no state, save or notebook surface. P3 still needs P1 (fingerprint, approved on its own branch) and OD-ORP-3/4 from the Fresh Audit. P2's remaining decisions (OD-P2-1..4) do not gate P3, except that OD-P2-1 must be settled before collision recipes reach production.

## 14. Verdict

**B. OWNER DECISION REQUIRED.** The pure hardening and tests are complete and green; production behaviour is unchanged for every reachable case today. No PR has been created.
