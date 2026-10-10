# Hint 5.0 — key-free BASE rung, sub-order gate and #436 tag scope (Owner Decisions + migration spec)

Path: `docs/decisions/TETO_HINT-5_BASE-RUNG_OWNER-DECISIONS.md`

- **Parent:** #292 (Hint 5.0). Related: #360 (closed, OD-360-1..6), #436 (tags, open).
- **Status:** Owner Decisions APPROVED 2026-10-10. The explicit-supersede wording of OD-H5-BASE-3 was **confirmed by the Owner on PR #459 as Option A, conditionally** (see the BASE-3 row for the condition). **One item is open: OD-H5-BASE-3b (free completion, §1), which blocks only the display part of PR-D.** **This document is the authority. It changes no code.**
  Implementation follows in separate PRs (§9). Until PR-E merges, the shipped behaviour is unchanged.
- **Audited `main`:** `e0397aef5af3a665438f7e505b0af10811e506a4` (55 recipes, 47 toppings, 25 keyed + 30 key-free).
- **Why:** the Hint 5.0 audit of 2026-10-10 found that the key-free ladder omits the SAUCE / CHEESE rung
  when the recipe has none (OD-D3-21). The *pre-purchase* label of the next rung therefore tells the player
  that the target has no sauce (12 recipes) or no cheese (6 recipes). That contradicts H5-INV-4,
  OD-H5-P4-CHEESE, OD-TQ1D-1 and the Contract 2.1 §3 rule against conditional row omission, and G15 pinned it
  as accepted.
- **Where the rest lives (do not copy):** the ladder model is `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`
  (§5.4, §9.5, §13 point here); the RESULT panel rules are `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`.

## 1. Owner Decisions

| ID | Decision | Status |
|---|---|---|
| **OD-H5-BASE-1** | The key-free ladder is `BASE → STRUCTURE → SUB_CLASS ①…`. `BASE` is one rung whose subjects are **all sauces and all cheeses** of the recipe. There is no separate SAUCE or CHEESE rung and no KEY_TOPPING rung for a key-free recipe. The 25 keyed recipes are unchanged (SAUCE → CHEESE → KEY_TOPPING → STRUCTURE → SUB_CLASS). Amends **OD-D3-21** ("a rung that does not apply is absent"). | APPROVED |
| **OD-H5-BASE-2** | The BASE price is **10 Pitz**, for every key-free recipe. The price never depends on what BASE contains. | APPROVED |
| **OD-H5-BASE-3** | BASE **never states an absence**: no 「ソース：なし」, no 「チーズ：なし」, no empty line, before or after purchase. **Before purchase** nothing about BASE depends on the target (§3). **After purchase** the board shows exactly the purchased content, i.e. the items that exist, so a player who paid for BASE can *infer* that a missing sauce line means no sauce. **This is an explicit, narrowly scoped supersede** (§8): of OD-TQ1D-1's "do not disclose sauce absence from the target's identity before the Technique is discovered", and of Contract 2.1 §3's "no conditional row omission" **as applied to the purchased board of the Hint ladder only**. It is not the INV-D7 class (INV-D7 concerns RESULT rows, which are built from what the player actually tried). | APPROVED: Q1 = C (2026-10-10); supersede wording **CONFIRMED by the Owner, Option A, conditional** (PR #459, reviewed HEAD `4239883`). **Allowed: only that a player can infer the absence of a sauce from the content of the Hint they bought (the purchased BASE board).** **Must be kept:** BASE's target-independence before purchase; RESULT's disclosure conditions; Notebook's disclosure conditions; the timing of the Technique `no-sauce` reveal; saved keys, prices and the credit spec; every other Anti-Oracle condition of Contract 2.1. |
| **OD-H5-BASE-3b** | **OPEN (Owner decision needed).** A BASE that completes **free** (`ALREADY_KNOWN`: every subject already known) is **outside** the approved OD-H5-BASE-3 supersede, which allows the inference only from a Hint the player **paid for**. If the board listed only the existing items after a free completion, a sauceless recipe's player who already knew the cheese names could infer "no sauce" without paying. **Until the Owner decides, the conservative default applies: a free (`ALREADY_KNOWN`) BASE completion adds no BASE lines to the board; the known names stay in the existing 「これまでにわかったこと」 archive; the completion record is still stored.** Options: **A)** extend the supersede to free completion (same display as a paid BASE); **C)** (default, recommended) no board lines on a free completion. | OPEN; blocks the free-completion display in PR-D only |
| **OD-H5-BASE-4** | Migration rules **M-1…M-8** (§4): completion is derived from the existing `h5:*` markers, a legacy partial purchase is completed for 0 Pitz at request time, nothing is refunded, no save key or schema changes. | APPROVED |
| **OD-H5-BASE-5** | A new request outcome **`ANSWERED_CREDITED`** (charge 0, discloses names, persists). **H5-INV-6 is amended minimally** (§5). | APPROVED |
| **OD-H5-BASE-6** | Roll-out in two PRs: **PR-D** implements BASE behind a build-time flag that is **OFF** (behaviour identical to main); **PR-E** turns it ON (§9). | APPROVED |
| **OD-H5-BASE-7** | **No refund** for a player who already bought both the sauce and the cheese rung of a key-free recipe (paid 20, a new player pays 10). A refund needs provenance, which OD-360-4 forbids. | APPROVED (M-5) |
| **OD-H5-SUBORD-1** (α) | A candidate-count gate on the sub rows (§6). The threshold for a key-free recipe is **≥ 2** assignments. **A violation turns CI RED and waits for an Owner decision. A test, allowlist entry or threshold is never added automatically to make it pass.** | APPROVED |
| **OD-H5-SUBORD-2** (β) | A **new** key-free recipe may declare a sub order that is **not derived from the catalog order** (§7). The 30 existing key-free recipes keep the catalog order forever (saved-hint compatibility). The concrete sort rule is fixed in PR-F; see the open question in §7. | APPROVED (rule: PR-F) |
| **OD-H5-436-A** | Q4: the early recipes whose sub rows become fully determined (marinara, fugazza, pesto-caprese; breakfast-pizza, melanzane-pizza, parmigiana-pizza) are allowed (OD-H5-P1 / P2 / P5, deduction ≠ disclosure). They are the only allowlist entries. | APPROVED |
| **OD-H5-436-B** | Q5 / E1: the 「木の実」 tag is abolished. almond, pine-nuts and egg share the untagged `other` cell (3 members). Tags: 9. | APPROVED |
| **OD-H5-436-C** | Q6: spinach = 葉もの, artichoke = 漬け・缶詰, avocado = 実野菜. | APPROVED |
| **OD-H5-DOCS** | Q7: the design documents and Owner Decisions affected by the above are updated (this PR, §10). | APPROVED |

### Standing conditions (all PRs below)

1. A credit (OD-H5-BASE-4 M-3) is applied **only inside a purchase request**.
2. **Loading a save never changes Pitz, `discoveryHintFacts`, or any purchase information.** All derivation is read-time.
3. The saved keys of the 30 existing key-free recipes are unchanged (§4.2).
4. A rollback to the pre-BASE build must keep working with the saves the BASE build wrote (§4.3), and this is verified.
5. With the flag OFF, every observable output (ladder, view model, request result, facts written, DOM) is **byte-identical** to main.

## 2. BASE rung specification

- `Hint5RungKind` gains `"BASE"`. `HINT5_RUNG_PRICE.BASE = 10`.
- **Subjects:** every sauce and every cheese of the recipe (catalog order). A key-free recipe must have **at least one**; a recipe with neither fails a data gate and must re-audit Hint 5.0 (the same style of tripwire as G7).
- **Pre-purchase label:** 「ヒント1: ベース」 with a constant description that does not say which items exist. The wording is confirmed at Owner HV (PR-D / PR-E).
- **Applicable markers** (derived from recipe data, never stored): `h5:sauce` if the recipe has a sauce, `h5:cheese` if it has a cheese.
- **Purchase** (`ANSWERED`, 10 Pitz) appends, in one patch, `ing:<id>` for every sauce / cheese not yet stored and **every applicable marker**. It never writes a marker for an item the recipe does not have. The facts are exactly the ones the old SAUCE and CHEESE rungs would have written.
- **Board:** one entry per existing item, reusing the existing SAUCE / CHEESE row labels. Two entries can share the BASE rung index, so a UI key must not be the rung index alone.
- **M3 (OD-H5-M3) is unchanged for BASE:** all subjects already known → `ALREADY_KNOWN`, 0 Pitz, markers only (its board display is the open OD-H5-BASE-3b; the default is no BASE lines); some known → `ANSWERED` at 10; none known → `ANSWERED` at 10. Legacy facts never change the pre-purchase view.
- **Unchanged:** strict linearity, STRUCTURE before SUB_CLASS, the other prices (STRUCTURE 5, SUB_CLASS 5), NO_SAUCE, multiple cheeses in one rung, `hint5ReservedRungs = []`, `hint5EmptyFixedRungs = []`, the keyed 25.
- **Residual pre-purchase difference (accepted):** a keyed recipe's first label is 「ソース」 and a key-free recipe's is 「ベース」. This is one bit (legacy 25 vs 30), and it exists today.

## 3. Pre-purchase shape (what G15 now pins)

G15 compares **what has not been bought yet**: before STRUCTURE is owned, for the same completed rungs and balance, **all 30 key-free recipes show byte-identical *unpurchased* offers (kind, label, description, price) and the same rung sequence** (BASE 10, then STRUCTURE 5, then SUB_CLASS 5). The old split by "has a sauce / has a cheese" disappears. The only remaining group split is keyed vs key-free.

**Excluded from the comparison:** the *content* of a completed BASE. Once the player has paid, the board shows the purchased names, so its entry count and names legitimately differ by recipe (sauce only, cheese only, several cheeses). That is purchased information (H5-INV-1), not a FREE LEAK, and it is the post-purchase inference accepted in OD-H5-BASE-3. G15 therefore pins: (a) the next unpurchased offer, (b) the kind / index sequence of the board's rungs, and (c) the price, but never the names or the number of lines inside a completed BASE.

## 4. Migration rules (existing saves)

State read: `discoveryHintFacts[recipeId]` (a list of fact-id strings). Rung indices are never stored (`expectedRungIndex` is a transient sheet token, and the STALE check covers a sheet opened across the update).

| Rule | Text |
|---|---|
| **M-1** | BASE is **COMPLETED** iff **every applicable marker** is stored. |
| **M-2** | BASE is **OPEN** iff **no** applicable marker is stored. Normal M3 pricing: 10 Pitz, or 0 if every subject is already known. |
| **M-3** | **Legacy partial** = some but not all applicable markers are stored. The only reachable case is a recipe with a sauce **and** a cheese where `h5:sauce` is stored and `h5:cheese` is not (the old ladder was strictly linear; 12 recipes). Completing it is **CREDITED**: charge **0** (even if the balance is below 10, as in OD-360-3), appending the missing `ing:` names and markers. Reason: at least 10 Pitz was already paid, which is the BASE price. |
| **M-4** | CREDITED is the new outcome `ANSWERED_CREDITED` (§5). **Precedence at request time:** (1) BASE completed → nothing to buy; (2) **every subject name already known → `ALREADY_KNOWN`** (0 Pitz, markers only), even when the save is a legacy partial, because nothing new is disclosed; (3) otherwise a legacy partial → `ANSWERED_CREDITED` (0 Pitz, discloses the missing names); (4) otherwise `ANSWERED` at 10 Pitz. Migration tests expect exactly this order. |
| **M-5** | **No refund** for a player who bought both old rungs (OD-H5-BASE-7). |
| **M-6** | Progress after BASE (`h5:structure`, `cls:<id>`) is untouched and still valid. It can exist only when BASE is complete (verified, §4.1). |
| **M-7** | **Provenance gap, accepted.** A marker written by a free `ALREADY_KNOWN` is indistinguishable from a paid one, so a legacy-partial save whose sauce was free (known from a RESULT ○) also gets the remainder credited (at most 10 Pitz in the player's favour). The alternative, charging 10, would double-charge real payers. |
| **M-8** | **Parity, with its one exception.** A fresh player pays 10 for BASE. A legacy-partial player who paid for the sauce rung pays 10 in total. A RESULT-○ player with **no** marker keeps the old total: sauce known (free) + cheese 10 = 10. **Exception (M-7):** a legacy-partial save whose `h5:sauce` was written free by `ALREADY_KNOWN` (sauce known from a RESULT ○) is credited, so its total is **0**, not 10. Migration tests must assert this exception explicitly; the parity statement is not unconditional. |

Consequences stated once: the credit is a request-time effective cost, like OD-360-3. The pre-purchase view still shows the normal price 10 (M3 / H5-INV-5) and the CTA is not disabled by balance. Nothing is computed or applied when a save is loaded.

### 4.1 Verification of M-1…M-3 (done on main, reproduced in PR-B as a permanent test)

For each of the 30 key-free recipes, every reachable state of the **real** old ladder was generated by calling the real `requestHint5Rung` rung by rung, then the new rules were applied:

- 0 violations over all states. BASE status always agrees with the old progress, and STRUCTURE / SUB_CLASS never exist before BASE is complete.
- Classes: sauce + cheese (12): OPEN / **PARTIAL (only after the first old rung)** / COMPLETE. cheese only (12) and sauce only (6): OPEN / COMPLETE only (a single applicable marker cannot be partial).
- Not covered by the generator, covered by reasoning: stacked legacy `ing:` facts (M3 is unchanged), and the unreachable "`h5:cheese` without `h5:sauce`" (handled by M-1 for any subset).

### 4.2 Saved keys of the 30 existing key-free recipes

Unchanged: recipe ids, `h5:sauce`, `h5:cheese`, `h5:structure`, `cls:<ingredientId>`, `ing:<ingredientId>`. No key is added, renamed, converted or deleted (E3). Only the *view* of the ladder changes. The existing key-free recipes also keep their catalog sub order (§7), so every `cls:` fact still means the same row.

### 4.3 Rollback to the pre-BASE build

A BASE purchase writes the same facts the two old rungs wrote (§2). Verified on all 30 key-free recipes: starting from the facts a BASE purchase writes, the **old** ladder offers STRUCTURE next, charges nothing for the sauce or cheese, and the remaining total equals the old remaining total (e.g. brazilian-calabresa 25, pesto-gamberi 20, pesto-pollo 15). A credited remainder writes the same facts. So a rollback loses no purchase and double-charges nothing. PR-D and PR-E must re-run this check against the real build before they merge.

## 5. `ANSWERED_CREDITED` and the minimal H5-INV-6 amendment

- Result shape: `{ outcome: "ANSWERED_CREDITED", rungIndex, kind: "BASE", addFactIds, charge: 0, persist }`.
- It is produced only by M-3, and only when at least one subject name is still unknown (M-4 precedence: all-known is `ALREADY_KNOWN`). It never occurs for any other rung or for the keyed ladder.
- The reducer applies it like `ANSWERED` with `charge = 0`: no Pitz change, facts appended, the transient `hintOutcome` set to a new value. The line shown after it is neutral (proposal: 「前に払ったぶんで、ベースのヒントがそろったよ」); the exact copy is confirmed at HV.
- **H5-INV-6 (charging) is amended by one clause only:** "Only ANSWERED **and ANSWERED_CREDITED** are *answers*. ANSWERED charges the rung price. ANSWERED_CREDITED charges 0 and only ever completes a legacy partial BASE. The other no-charge cases are unchanged."
- The "0 Pitz never appears in production" sentence stays true for everything except ALREADY_KNOWN (OD-H5-M3) and ANSWERED_CREDITED.

## 6. α gate: candidate count of the sub rows

Defined as a data/logic test, derived from the code and data at run time (no hard-coded counts):

- **Pool:** toppings whose Discovery Ladder step is ≤ the largest step among the recipe's ingredients (starters = step 0), minus the key topping.
- **Row candidates:** pool members with the same family **and** the same display tag.
- **Assignments:** injective picks, one per sub row. For a recipe whose sub order is the catalog order, picks must be strictly increasing in catalog order (that is the real information the player has).
- **Gate:**
  1. every key-free recipe has **≥ 2** assignments (OD-H5-SUBORD-1);
  2. the set of recipes with exactly 1 assignment equals the explicit allowlist (OD-H5-436-A), in both directions;
  3. the catalog cell gate (#436): no 1-member family × tag cell except capers.
- **Result on current main with the approved tags** (checked with the real code): 13 cells; the only 1-member cell is capers. Lowest key-free counts: bacalhau 2, pesto-pollo 3, pesto-salmone 3, palmito-pizza 3. Exactly the six allowlisted recipes have count 1. **bacalhau sits exactly on the threshold (no margin).**
- **Red rule:** when the gate fails, CI is RED and the work waits for an Owner decision. No automatic exception, allowlist entry or threshold change.
- The allowlist and the tag-dependent part land with #436 (tags). Before the tags exist the same gate holds with the family-only allowlist {breakfast-pizza, melanzane-pizza, parmigiana-pizza}.

## 7. Sub order for new key-free recipes (β) and the 30 existing recipes

- **Existing 30 key-free:** the sub order stays the catalog order, forever. Reason: `cls:<ingredientId>` is keyed by ingredient, but the ordinal (①②…) and "which rung is next" follow the order. Changing it would re-label a partially bought ladder.
- **Pin first:** only the 25 keyed recipes have a golden today (`hint5.production25.json`). The 30 key-free sub orders are **not pinned**, so they silently depend on the catalog being append-only. PR-B pins all 55.
- **New key-free recipes** may declare a sub order that is not the catalog order. A new recipe has no saves, so any order is compatible by construction. **A released recipe's order may never change** (golden + gate).
- **Open question for the Owner (decided before PR-F):** H5-0 §6.1 (authoring guidance) says a *family-sorted* sub order is a free negative fact ("サブ① = 野菜" implies no meat sub). A plain family order therefore leaks. Two candidates: (a) family order, accepting that leak; (b) an **opaque deterministic order** (a hash of `recipeId:ingredientId`), which carries neither the catalog position nor a family implication. The recommendation is (b). OD-H5-SUBORD-2 is APPROVED as "not derived from the catalog order"; the concrete rule is the PR-F decision.

## 8. Contract consistency

| Contract | Result |
|---|---|
| #360 OD-360-1 (no SAUCE auto-skip, no dynamic ladder) | Consistent. BASE is one static shape per ladder class. The credit changes only the effective cost at request time. |
| #360 OD-360-3 (known rung is completable below the price) | Reused for M-3. |
| #360 OD-360-4 (no provenance, no schema) | Kept. M-7 is the accepted price of that. |
| **OD-D3-21** (key-free: a non-applicable rung is absent) | **Amended** by OD-H5-BASE-1: BASE is always present; KEY_TOPPING stays absent. |
| **H5-INV-4** (no rung reveals the absence of sauce) | Reworded: no rung *states* an absence, and **nothing before purchase** (rung kinds, order, label, price) depends on it. This removes the existing pre-purchase omission. The purchased BASE board still shows only existing items (OD-H5-BASE-3 supersede below). |
| OD-H5-P4-SAUCE / OD-TQ1D-1 | Kept: no 「ソース：なし」 anywhere, RESERVED is not revived, no Technique name before discovery, no target-dependent pre-purchase shape. **Narrowly superseded (OD-H5-BASE-3):** after the player pays for BASE, the missing sauce line is inferable. |
| OD-H5-P4-CHEESE | Satisfied: nothing says 「なし」 before purchase. Keyed no-cheese recipes keep their paid 「チーズ：なし」. |
| Contract 2.1 §3 (no conditional row omission) | Applied to the Hint ladder's pre-purchase shape. **Narrowly superseded (OD-H5-BASE-3)** for the content of a purchased BASE entry. |
| **G15** | Rewritten (§3): groups are {keyed, key-free}. |
| G7 / reserved gates | Unchanged. A new data gate: a key-free recipe has at least one sauce or cheese. |
| H5-INV-5 (FREE LEAK) | Kept. The credit is request-time only. |
| H5-INV-6 (charging) | Amended by one clause (§5). |

## 9. Scope of #436 and the PR plan

**#436 keeps its scope: tags only** (`src/data/ingredientFeatureTags.ts`, the HintSheet display, G17 / G18 extensions, the catalog cell gate, the α gate and its allowlist, Owner HV of the labels). Its acceptance criteria are restated for 55 recipes / 47 toppings in §11. #436 does **not** include BASE, the migration, ANSWERED_CREDITED, or β.

| PR | Content | Depends on | Touches |
|---|---|---|---|
| **PR-A** | This document and the doc edits of §10. Docs only. | – | `docs/` only |
| **PR-B** | Tests only, no behaviour change: golden of all 55 ladders (kinds, sub order, facts per prefix), the §4.1 and §4.3 checks as permanent tests against the current build, the α metric as a report. | A | tests |
| **PR-C** | #436 implementation: tags, catalog cell gate, α gate + allowlist. | A, B (golden proves nothing else moved) | data, HintSheet, tests |
| **PR-D** | BASE rung behind the OFF flag: pure layer, ownership (M-1…M-3), `ANSWERED_CREDITED`, reducer, sheet, G15 rewrite, tests (flag OFF byte-identical; flag ON migration + rollback). | A, B | `src/` |
| **PR-E** | Turn the flag ON. DOM golden re-baseline (reason stated), HV (390×844 video delivered directly, before/after screenshots), docs sync. | D (+ C recommended first for the tag display) | flag, golden, docs |
| **PR-F** | β: the new-recipe sub-order option, and the immutability gate. Before the next recipe batch. | A, B, the §7 decision | `src/data`, logic |

Order: A → B → (C ∥ F) → D → E. Rollback: revert E (flag), then D. No PR changes the save format.

## 10. Documents updated by PR-A

| Document | Change |
|---|---|
| `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` | Round 7 status line; §2 rows; §3 H5-INV-4 / H5-INV-6 notes; §4 conflict rows; new §5.4 (key-free BASE); §9.5 (BASE migration pointer); §13 G15 rewritten and G25–G31 added; §15 open items. |
| `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md` | Sync note, and the §3 bullet on conditional omission now names the Hint shape. |
| `docs/reports/TETO_DISCOVERY-3_PR-4a_Pool-Foundation_Result.md` | OD-D3-21 (which is defined only there and in code comments) gets a superseded-by note. |
| `docs/PROJECT_HANDOFF.md` | One addendum and one bullet in the Hint 5.0 section. |
| this file | New. |

## 11. #436 acceptance criteria (restated for 55 recipes / 47 toppings)

1. Counts are derived from the data at implementation time. Baseline at `e0397ae`: 55 recipes, 47 toppings, 30 key-free. The stale "野菜19 / 魚介6" breakdown is dropped.
2. An exhaustive `Record` over all 47 toppings; each value is one of 9 tags or an explicit "no tag". New: spinach = 葉もの, artichoke = 漬け・缶詰, avocado = 実野菜. almond, pine-nuts, egg, capers carry no tag.
3. A cell is the **exact display string**. No 1-member cell except capers.
4. G17 / G18 extended: labels never contain an ingredient name, id or emoji.
5. The α gate (§6) lives in the #436 PR, with the allowlist of six.
6. Unchanged and proven by existing tests passing untouched: 7 families, key-free, prices, order, save format, NO_SAUCE, multiple cheeses, Research Board and Notebook.
7. A production DOM golden re-baseline needs a stated reason. Human Verification per `TETO_HUMAN-VERIFICATION-POLICY.md`.
8. Start by re-running the counts on the latest main; any ingredient added meanwhile must be tagged before merge.

## 12. Remaining risks (recorded)

1. Players who bought both old rungs (12 recipes) paid 20, new players 10. No refund (OD-H5-BASE-7).
2. The M-7 provenance gap gives at most 10 Pitz in the player's favour.
3. After a BASE purchase the absence of a sauce is inferable from the missing line (OD-H5-BASE-3, an explicit narrow supersede of OD-TQ1D-1 / Contract 2.1 §3 for the purchased Hint board). This weakens the Technique `no-sauce` riddle for a player who bought BASE. It cannot be avoided without stating the absence, which is forbidden, or showing a placeholder, which states it. The Technique's *name* is still shown only after the player discovers it from a real composition.
4. bacalhau is exactly on the α threshold. Any later change can turn CI red (by design, OD-H5-SUBORD-1).
5. The 30 existing key-free recipes keep the catalog-order leak. α and β only stop it from growing.
6. The catalog must stay append-only until PR-B pins the 30 orders.
7. UI work in PR-D: duplicate keys for two entries on one rung, the `data-hint5-next` value, the rung description, the DOM golden, the credited line copy.
8. The test files that pin the old key-free shape change in PR-D: `hint5Ladder.keyFree`, `hint5Production.gate` (G15), `HintSheet.hint5`, `hint5Ladder.effectiveCostZero`, `hint5EconomySim`, `recipeBatchValidator` and the four Expansion tests that assert key-free ladders.
9. The β rule (§7) is not fixed yet.
10. The checkout used for the audit is shallow (109 commits). Within the visible history no recipe moved from keyed to key-free; older history cannot be excluded by git alone (the code comments say none did).
