# Discovery Hint 4.0 — DH4-2B: Runtime / Economy / Persistence Wiring (Result)

> **Status:** Implementation, DH4-2B slice (OD-DH4-2-11). Part of #253.
>
> **Scope**
> - It wires the merged DH4-2A pure layer, hardened by the Gate in PR #267 (T1a), into the existing Discovery Hint Economy.
> - It is flag-only (E3, OD-DH4-2-5): DEV and Preview (`VITE_PREVIEW_MODE`) builds only. **A production build is unchanged.**
> - **Not in scope:** no UI redesign (that is DH4-2C), no price authority (DH4-ECON), and no change to the save schema.

## 1. What is wired

| Layer | Change |
|---|---|
| `src/logic/discovery/deductionFlag.ts` (new) | `DEDUCTION_HINTS_ENABLED = DEV \|\| VITE_PREVIEW_MODE`. Production has neither, so it is `false`. |
| `src/state/discoveryHint.ts` | `requestDeductionHintFact(state, family, expectedPaidCount)`: the only runtime entry.<br>- It supplies the inputs of the DH4-2A authority `requestDeductionHint`: the session target, the Dex count, `ownedIngredientIds` (acquisition order, T1a), both ledgers, the price, the paid count and the balance.<br>- It then applies the result as **one patch**. |
| `hintSheetView` (SELECTABLE) | Adds `deduction: DeductionSheetView \| null`, which is `null` when the flag is off. It carries only the player's own stored lines, the owned flags, the price, the paid count and whether it is affordable.<br>It has **no** availability, level, candidate count, remaining count or reserve. |
| `HintOutcome` | Adds `STRUCTURE_GUIDANCE_ONLY`, `STRUCTURE_ALREADY_OWNED`, `ATTRIBUTE_EXISTENCE_ONLY` and `ATTRIBUTE_ALREADY_OWNED`. They are transient: `SHOW_HINT` / `CLOSE_HINT` clear them, and they are never saved. |
| `gameReducer.ts` | `PURCHASE_SELECTABLE_HINT` gains an optional `family`; when omitted it means 材料, today's request.<br>- 構成 and 特徴 go to `requestDeductionHintFact`.<br>- The action is still in `DINNER_BLOCKED_ACTIONS`.<br>- The sheet must be open, in a Free Cooking PREPARE. |
| Boundaries | The only production importer of the Deduction Hint layer is `src/state/discoveryHint.ts`. Both boundary tests match static and dynamic imports. |

## 2. Economy (E3, provisional until DH4-ECON)

**How a request is priced:**
- 構成 and 特徴 share the material ESC rung: 5 / 10 / 20 / 40, then 40.
- **The shared paid count** is the 材料 paid count (legacy rungs included, OD-H3-9), plus one for each deduction family bought under Hint 4.0.
- The price depends only on what this player paid. It is the same for every target before a request, so it is not a FREE LEAK.
- **The 材料 price is unchanged** by deduction purchases.

| Outcome (DH4-2A authority) | Pitz | Ledger | UI state |
|---|---|---|---|
| ANSWERED | − the price, once | New `meta:` / `attr:` ids appended; unknown / future ids kept | none |
| EXISTENCE_ONLY (特徴) | 0 | unchanged | `ATTRIBUTE_EXISTENCE_ONLY` |
| GUIDANCE_ONLY (構成, e.g. a legacy total owner with the clause withheld) | 0 | unchanged | `STRUCTURE_GUIDANCE_ONLY` |
| ALREADY_OWNED | 0 | unchanged | `*_ALREADY_OWNED` |
| REJECTED (any reason) | 0 | unchanged | none. The state object is returned as is, so the reason is never surfaced. |

## 3. Verification

**`src/state/gameReducer.deductionHint.test.ts` (26 tests) covers:**
- the Pitz charge;
- insufficient Pitz, where a balance equal to the price is enough;
- stale requests and duplicate taps: charged exactly once;
- already-owned;
- guidance-only, including the legacy total owner;
- existence-only;
- the legacy total, which is never resold and never counts as もらいずみ;
- save / reload, plus privacy after persistence: the reloaded view is identical and there is no name or level in any line;
- unknown / future ids, which are kept;
- an old save (no `discoveryHintFacts`), where legacy rungs count;
- a hostile stored ledger;
- Full Reset;
- the session target: a target that has since been discovered makes the request a no-op;
- Dex-0 onboarding;
- Dinner, where the request is blocked;
- transient outcomes;
- **T1a through the real reducer:**
  - pepperoni @6 with parmigiano bought late via `PURCHASE_INGREDIENT` gives existence, never `category:cheese`;
  - the same parmigiano owned before the key gives `category:cheese`;
  - an untrusted order is refused.

**`gameReducer.deductionHint.flagOff.test.ts`:** with the production flag value, 構成 / 特徴 are no-ops, the sheet has no deduction part, and 材料 is unchanged.

**Mutation gate: 11 / 11 killed.** The mutants:
- the flag ignored;
- no debit;
- the ledger replaced (unknown ids lost);
- existence charged, guidance charged;
- deduction purchases missing from the paid count;
- legacy rungs ignored;
- the session target not re-checked;
- the reducer ignoring the family;
- the view built with the flag off;
- a legacy total shown as もらいずみ.

A redundant reducer family check was an equivalent mutant (the pure authority returns `INVALID_FAMILY`), so it was removed.

**Checks:**

| Check | Result |
|---|---|
| Full Vitest | 202 files, **4277 passed**, 1 skipped |
| `tsc -b` | clean |
| `oxlint` | 0 warnings |
| `npm run build` | OK |

**Production bundle.** It contains the layer code, but the code is inert: `DEDUCTION_HINTS_ENABLED` is `false`, so every request is a no-op and `deduction` is `null`. The flag-off test pins this.

**No UI change.** 2B adds no production-visible UI; the U3-C sheet is DH4-2C, with Human Verification. No App or HintSheet change beyond a test-fixture field.
