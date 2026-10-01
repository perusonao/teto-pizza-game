# Discovery 3.0 — Near/Far Authority Fresh Audit

- Audited main SHA: `ce2c07b9001ea6d7d65d54342252678940b1a328` (fresh `git fetch origin main`; PR #334 merge commit; #334 not re-audited).
- Scope: **audit only**. No code, test, copy, Issue or PR change. No test run (static reading of current main; behaviours below are
  read from code and from the existing focused tests, not re-executed).
- Not touched: R6 / IP-2 / N2 implementation.

## 0. TL;DR

1. 「かなり近づいてるよ」(CLOSE) is **"the pizza you just made is exactly 2 edit-steps away from the nearest *currently DISCOVERABLE, undiscovered* recipe"**.
   The comparison target is the **best-matching candidate recipe in the discoverable pool** (min distance), not a hidden single target, not the Hint target.
2. In OPEN_POOL (2+ DISCOVERABLE) the basis is **min over the whole pool**. Ties are broken by hint-candidate order
   (`recipeKeyStep` → distinct-ingredient count → `RECIPES` index), which **can change the line's kind (ADD_ONE vs REMOVE_ONE) and the FAR key-unused nudge**; it cannot change distance.
3. This is a **recipe-correctness / similarity oracle (class A)** that survives PR #322 Oracle Neutralization by design. Only the INCOMPLETE_MATCH leak was removed there.
4. RESULT computes it **live at render**; the Trial Notebook **stores a snapshot** (`{kind, textJa}`) taken at the commit and **never recomputes**.
5. Class B (recipe-independent execution feedback) today is exactly one line: `SAUCE_THIN_ADVICE_JA`. It is not stored in the Notebook.

## 1. Where near/far copy is generated (all sites)

| # | Location | What |
|---|---|---|
| 1 | `src/state/resultNearMiss.ts` `NEAR_MISS_COPY` | `ADD_ONE` 「材料をあと1つ足すと…」, `REMOVE_ONE` 「材料を1つ減らすと…」, `SAUCE_ONLY` 「ソースを変えると…」, `CLOSE` 「かなり近づいてるよ。少しだけ変えてみよう！」, `FAR_KEY_UNUSED` 「新しく入荷した材料は使ってみた？」 |
| 2 | same file `NEAR_MISS_FAR_GENERIC_COPY` | 「🧪 別の組み合わせも試してみよう！」 (OD-P2-2, `RESULT_FAR_GENERIC_ENABLED = true`) |
| 3 | `src/state/resultNearMiss.ts` `nearMissLine` / `resultNearMiss` | selects the line from the classification |
| 4 | `src/state/executionAdvice.ts` `SAUCE_THIN_ADVICE_JA` | class B line (§7) |
| 5 | `src/state/originalResultCopy.ts` `ORIGINAL_LEAD_COPY` / `duplicateTrialNoticeJa` | lead (neutral for all kinds) and 「前にも同じ材料の組み合わせで作ったよ（試作#n）」 — not near/far; included for completeness |
| 6 | `src/logic/techniques/nearMissPrivacy.ts` `NEAR_MISS_PRIVACY_FALLBACK_JA` | **unwired** (no production importer found; only the file itself and tests) |
| 7 | `src/logic/materialShop.ts:165` 「あと1つ発見で新しい材料が入荷」 | Shop progress hint; **different system** (count of discoveries), unrelated to recipe distance |
| 8 | `src/components/HintSheet.tsx` | Hint ladder text (Hint 5.0); not near/far, no distance |

Render sites: `ResultPanel.tsx` `hintRow(nearMiss, true)` — ORIGINAL card (`freeCook && hintRow(nearMiss…)`, ~l.298) and ALREADY_DISCOVERED card (~l.390).
Single production caller: `GameScreen.tsx:998` `nearMiss={resultNearMiss(state)}` (no options → defaults). Second caller: `trialRecord.ts:46` (Notebook snapshot). Sim-only: `testSupport/discoveryHintEconomySim.ts`.

## 2. The deciding function and its inputs

`resultNearMiss(input)` → `classifyNearMiss(signatureOfPizza(pizza), candidates)` (`src/logic/discovery/nearMiss.ts`) → `nearMissLine`.

Inputs (`ResultNearMissInput`): `freeCook`, `completion`, `lastDiscovery`, `pizza`, `dex`, `ownedIngredientIds`, `unlockedForShopIngredientIds`, `inventory`.
No Hint fact, Pitz, ladder, hidden target or recipe selection is an input (pinned by `resultFeedback.gate.test.ts`).

- `candidates = discoverableHintCandidates(input)` = every recipe with `recipeDiscoveryState === "DISCOVERABLE"` (undiscovered, every required material usable now; starters unlimited, finite materials owned with stock ≥ 1), sorted by `compareHintCandidates`.
  Note: RESULT is reached after `CONFIRM_BAKE`, which consumes inventory, so the pool is evaluated against **post-consumption stock** (a recipe whose last unit was just used can drop out). Read from the reducer; not executed.
- Distance (identity = `RECIPE_DISCOVERY_CATALOG` items + sauceBase, the matcher's own two observed axes):
  `d = |missing non-sauce| + |extra non-sauce| + (sauceBase differs ? 1 : 0)`. Quantity, bake, sauce amount, position are **not** compared.

## 3. Comparison target (item 4)

| Candidate basis | Used? |
|---|---|
| hidden target (single) | **No** — there is none; in the pool every DISCOVERABLE recipe is a peer |
| matcher candidate | Indirect: same catalog/identity source as the matcher, but the matcher result itself is only used to gate *which outcomes get a line* (ORIGINAL / ALREADY_DISCOVERED / INCOMPLETE_MATCH) |
| best-matching recipe | **Yes** — nearest by `d` over all DISCOVERABLE recipes (strict `<`, so first in order wins ties) |
| current Hint target | **No** (`selectHintTarget` is not called; pin/sticky/purchase ignored) |
| recipe-order dependence | **Tie-break only** (see §6.2) |
| reference recipe (R-axis/quality) | **No** |

For a colliding identity (two catalog targets with the same items+sauceBase) the target is skipped as unreachable (matcher says AMBIGUOUS). Production has none today.
An exact match (`d=0`) against any candidate returns `null` (discovery wins).

## 4. Thresholds / conditions (item 5)

Classification (`classify`): `d=1` → ADD_ONE if missing=1, else REMOVE_ONE if extra=1, else SAUCE_ONLY; `d=2` → CLOSE; `d≥3` → FAR.

Line (`nearMissLine`):

| Outcome | Line |
|---|---|
| ORIGINAL | d=1 directional line; d=2 CLOSE; FAR: `keyUnused` → 新材料 nudge, else generic 別の組み合わせ line |
| SAUCE_ONLY with `sauceStep=REMOVE` | rewritten to the generic REMOVE_ONE line (avoids hinting the no-sauce technique) |
| ALREADY_DISCOVERED | **only d=1** lines; no CLOSE, no FAR |
| INCOMPLETE_MATCH | matched recipe **removed** from the comparison; nearest of the others; if none nearer → generic FAR; no candidates at all → no row |
| AMBIGUOUS (`outcome`) | no line (and `resultNearMiss` returns null; unreachable in production) |
| NEW_DISCOVERY, FAILED completion, non-free-cook, nothing DISCOVERABLE | no line |

`keyUnused` (FAR only) = the nearest candidate's key ingredient (`hintKeyIngredientId`) is not on the pizza. A boolean; the ingredient is never named.

## 5. Computed live vs stored (item 6, 7)

- **RESULT**: computed **on the spot every render** from `resultNearMiss(state)`; nothing about the near/far line is held in `GameState` (`lastDiscovery` holds the matcher outcome, `lastTrialAttempt` holds only `{NEW|DUPLICATE, number}`).
- **Trial Notebook**: `recordTrialAttempt` (called once from `REGISTER_TO_DEX`, free-cook ORIGINAL branch) calls `resultNearMiss({...state, lastDiscovery: outcome})` and stores the **snapshot** `{kind, textJa}` or `null`. `TrialNotebookSheet` renders `entry.feedback.textJa` only (kind never rendered). **No recompute at view time.** A retry of the same fingerprint **overwrites** the stored line with the latest one (OD-P3-15b).
  Consequence: the stored line is relative to the pool *at that moment*; the RESULT line is relative to the pool *at render*. They are the same value at commit time (same state), and may diverge if the pool changes while RESULT is open (not verified whether any RESULT-time action does that). Notebook rows can also be stale relative to the current pool by design (session-only, in-memory, not persisted).
- ALREADY_DISCOVERED, NEW_DISCOVERY, FAILED rounds are **not** recorded, so the Notebook never holds a d=1 known-pizza line.

## 6. Behaviour by outcome, and OPEN_POOL (items 8, 9)

### 6.1 Outcome matrix
See §4. ORIGINAL / INCOMPLETE_MATCH / AMBIGUOUS are made visually identical by PR #322 (lead is `NEUTRAL_LEAD` for all; `INCOMPLETE_MATCH` gets a row computed with itself excluded; recorded in the Notebook like any original; DOM byte-identity pinned in `oracleNeutralization.test.tsx`).

### 6.2 Pool ≥ 2
- Basis: **min distance over all DISCOVERABLE recipes**. Not the Hint target (OPEN_POOL deliberately has none, D-1), not a hidden recipe.
- **Order dependence (real, partial)**: the strict-`<` loop keeps the first candidate at an equal distance, order = `compareHintCandidates`. Different candidates at the same `d` can yield different **kind** (e.g. one is "missing 1", another "extra 1" → ADD_ONE vs REMOVE_ONE; or different `sauceStep`) and a different `keyUnused`. Existing test `nearMiss.p2.test.ts` "an ADD and a REMOVE at the same distance" only asserts `kind ∈ {ADD_ONE, REMOVE_ONE}`, i.e. the order-dependence is acknowledged but not pinned. Caller array order is ignored (internal sort), so it is deterministic for a given pool, but it is `recipeKeyStep`/`RECIPES`-order dependent.
- **Leak surface** (reasoned, not exploited in tests):
  - Identity: the line never names a recipe/ingredient, and the Notebook stores no recipe/distance. But **each ADD_ONE/REMOVE_ONE/SAUCE_ONLY line is a true membership statement about some real recipe** ("a recipe exists one edit away"). Repeated experiments are a Mastermind-style oracle over the pool (class A, intended since 229-C).
  - Pool size/identity: min-over-pool means the player cannot tell *which* recipe a line refers to (good), but the line set changes as the pool changes (stock/Dex), so "line disappears / appears" correlates with pool membership.
  - Tie-break leak: FAR `keyUnused` follows the tie-break winner, i.e. the lowest-`recipeKeyStep` nearest recipe — a small ordering fingerprint. It reveals only that "some material the nearest recipe needs is not on the pizza", but because the key material is a newly stocked material, it effectively tells the player the nearest recipe's key is a **new** material.
  - Composition leak by deduction: d=1 REMOVE_ONE / ADD_ONE do not name the component, but CLOSE/ADD/REMOVE ladders across attempts narrow it (see §9).
- No hidden-recipe identity or composition is stored or rendered directly; INCOMPLETE_MATCH self-exclusion (PR #322) removed the one direct leak found in S1.

## 7. A. correctness/similarity vs B. execution feedback

| | Class | Source | Reads recipe/pool/matcher? | Stored in Notebook? |
|---|---|---|---|---|
| ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE | **A** | `resultNearMiss` | **Yes** (discoverable pool + catalog identity) | Yes (snapshot) |
| FAR key-unused 「新しく入荷した材料は使ってみた？」 | **A** (weak; reads nearest recipe's key) | same | Yes | Yes |
| FAR generic 「別の組み合わせも試してみよう」 | A-derived, asserts nothing | same (shown iff ORIGINAL with ≥1 candidate and no nearer line) | Yes (only "there is ≥1 candidate") | Yes |
| ALREADY_DISCOVERED d=1 line | **A** | same | Yes | No (not recorded) |
| Sauce thin 「ソースが少なめかも」 | **B** | `executionAdviceJa(pizza)`: own sauce vs one shared reference (`isSauceBelowMinimum`, same as Completion Gate) | **No** (pizza only) | **No** |
| Bake badge 焼き加減 | B (generic) | bake state | No | No |
| Original/dup notice 「試作#n」 | neither (own-action memory) | `lastTrialAttempt` | No | n/a |

Note the generic FAR line is a **1-bit oracle** in OPEN_POOL: it shows iff there is ≥1 DISCOVERABLE candidate. OD-P2-2 accepted that; it never fires with an empty pool.
Class B has no bake advice by decision (OD-D3-23: a recipe's bake window would identify the recipe).

## 8. Is it still a compatibility authority after PR #322? (item 10)

Yes, by intent. PR #322 (OD-D3-20 / OD-D3-23) neutralised only the **INCOMPLETE_MATCH** oracle (lead copy, missing row, missing Notebook record). `resultNearMiss`, `classifyNearMiss`, the copy set and the Notebook snapshot remain the P2 / 229-C authority. The module comment still cites 229-C + OD-HINT-5 and OD-P2-2/3/4. OD-D3-20's "do not **extend** 「あと少し」 as a new correctness oracle" is satisfied by non-extension; it does not mandate removal of the existing one. (This audit does not decide that.)

## 9. Pinned behaviour today (item 11)

Unit:
- `resultNearMiss.test.ts` / `resultNearMiss.p2.test.ts`: per-outcome lines, ladder table over 25 recipes, FAR generic (+rollback switch), known pizza d=1 only, REMOVE-step wording, copy has no recipe/ingredient name, every directional line followed to a real discovery.
- `nearMiss.test.ts` / `nearMiss.p2.test.ts`: distance math, d=0 → null, hint-order tie-break, collision skipping; "candidate order never changes class/distance" (but **not** kind at ties — only `kind ∈ {…}`).
- `resultFeedback.gate.test.ts`: Free-Cooking-only, no Hint/Pitz/ladder inputs, single production caller.
- `trialRecord.gate.test.ts` / `gameReducer.trialNotebook.test.ts`: snapshot is exactly `{kind,textJa}`; retry replaces feedback; INCOMPLETE recorded; known/NEW/FAILED not recorded; one commit point.
- `oracleNeutralization.test.tsx`: INCOMPLETE vs ordinary DOM byte-identity, execution advice independence from outcome.
- `TrialNotebookSheet.test.tsx`: renders `textJa` only; no kind/recipe/count/match wording.
- `executionAdvice.test.ts`: reference identical for all recipes.
E2E: `discovery-near-miss-result.spec.ts` (ORIGINAL line + CTA; INCOMPLETE reads as ordinary), `discovery3-notebook-n1.spec.ts` (pool=2 incomplete; anti-spoiler sweep).
**Not pinned**: kind/keyUnused under OPEN_POOL ties; Notebook-vs-RESULT divergence if the pool changes between commit and render; behaviour of the 1-bit generic FAR across pool transitions.

## 10. N2 「前回試作との差分」 × near/far (item 12)

N2 would show the composition diff between attempts. With near/far stored per attempt, the player gets (Δcomposition, Δclass) pairs automatically: e.g. add X → FAR→CLOSE or CLOSE→ADD_ONE means X belongs to *some* nearest candidate; add X → the line gets worse/changes to REMOVE_ONE means X is extra for the nearest. This is an automated coordinate-wise oracle (Mastermind with distance buckets). Today the player can already do this by hand from the Notebook (combination + line are both shown), but N2 removes the effort and makes the signal salient, so the practical strength rises materially, especially in a small pool where "nearest" is nearly one recipe. Risk is higher if N2 shows any direction/trend arrow (closer/farther); lower if N2 shows only the composition diff (own actions, no feedback delta) and keeps the stored line as an unadorned secondary row. Not decided here.

## Owner Decision Needed

The facts above are settled; the choice below is the Owner's. Nothing was changed.

**A. Keep current near/far as is.**
- Pros: no risk of regressions; the line is true, truthful (walk-tested), recipe-anonymous, and carries the known 1-bit/Mastermind class-A signal accepted in 229-C / OD-P2-2/3; OD-D3-20 is satisfied by non-extension.
- Cons: class A stays an oracle in OPEN_POOL; N2 diff will make it stronger; tie-break kind/keyUnused order dependence remains un-pinned (could be fixed as a test/ordering note without behaviour change).

**B. Neutralize class A near/far (recipe correctness), keep only class B execution feedback (e.g. sauce-thin; future bake/quantity that is recipe-independent).**
- Pros: removes the correctness oracle and the OPEN_POOL order leak; N2 is safe; consistent with PR #322's direction.
- Cons: removes the main "progress" feedback for free cooking (players lose guidance; may need Hint sheet/Shop to carry it); changes Notebook rows (stored `feedback`) and ~20+ tests/e2e; breaks the hint-to-discovery reachability walk's reliance on directional lines; the Hint 5.0 economy must absorb the lost free signal.

**C. Another option** (not chosen by the audit), for the Owner to consider: keep near/far but (i) gate it to pool=1 only (single unambiguous target) and show only the generic nudge in OPEN_POOL; or (ii) keep it on RESULT but stop storing it in the Notebook so N2 cannot join (composition diff, feedback delta); or (iii) quantise to a coarser two-level cue (「近い / まだ遠い」) in OPEN_POOL and fix tie-break determinism with a pinned test.
