# Discovery Hint 5.0 — H5-0 Final Design (Sub-topping Classification Ladder)

- **Issue:** #292.
- **Input:** the Fresh Audit
  `docs/reports/TETO_HINT-5_SUB-TOPPING-CLASSIFICATION-LADDER_Fresh-Audit.md`.

**Status:**
- **Round 1 (2026-09-28):** the Owner Decisions **P1, P2, P3, C1, C2, C3, C4, U1 and E3** are
  APPROVED.
- **Round 2 (2026-09-28):** these are APPROVED:
  - **E1 = P-C** (the Hint 5.0 price authority, §10);
  - **E2** (no cap);
  - **C4 final** (the 7 existing families, display only, §7);
  - **E3b** (no courtesy grant);
  - **M1** (no free-key carry-over);
  - **T-COV** (taxonomy coverage and the fail-fast gate, §11). PR #293 is the reference audit.
- All of these are recorded here as the Hint 5.0 authority.
- **Round 3 (2026-09-28):** **C1a** (the 5 key toppings) and the **C1 authoring principle** are
  APPROVED (§6.1, §6.4).
- **Round 5 (2026-09-28):** **OD-H5-M3 = D** is APPROVED (§9.0). Legacy facts never complete a
  rung before a request. At request time, a rung whose information is ALL known completes for
  0 Pitz. **H5-3 (the ladder UI behind the flag) is implemented.**
- **Round 4 (2026-09-28):** **C1b** is APPROVED: capricciosa = mushroom, pizza-portuguesa = ham,
  puttanesca-pizza = anchovy. The Hint 5.0 key-topping authority is now final for **all 25**
  runtime recipes, and all 25 are consistent with C1-P (§6.4).
- **Round 6 (2026-09-28, after the H5-4 Fresh Gate `5eadb96`):** these are APPROVED (§5.3):
  - **OD-H5-P4-CHEESE** (a no-cheese target's cheese rung is a normal paid rung → 「チーズ：なし」);
  - **OD-H5-P4b** (the same for the key topping → 「キートッピング：なし」);
  - **OD-H5-M2 = all 25** (the implementation authority for the flag-ON target set, under 6 gates);
  - **OD-H5-RETIRE** (with the flag ON, the 材料 / 構成 / 特徴 purchases end).
  - **OD-H5-P4-SAUCE is RESERVED** until TQ-1D: 「ソース：なし」 is never an answer in Hint 5.0.
  - **H5-4 implements these behind the flag. The production flag stays OFF.**
- **Still open:** OD-H5-P4-SAUCE (TQ-1D), and the production activation itself (flag ON).
- H5-0 itself changed no production code.

This document wins over the Fresh Audit wherever they differ.

- **Audited `main`:** `86b48fd51423a8f76db5398ab88ecfd944e2ae10` (PR #291 merge, re-fetched for
  H5-0).
- **Not changed:** PR #291 / #290, TQ-1D, #275 and #260.

---

## 1. Goal and primary Acceptance Criterion

**The goal is not to tell the player the last ingredient's name.** The goal is that every
sub-topping of a target, **down to the very last one**, can be given a **classification hint**
(「🥩 肉系」…). The player then deduces the ingredient themselves.

> **AC-1 (primary, mandatory):** For every production Hint 5.0 target with at least one
> sub-topping, and in every state (at its own ladder step, with every ingredient owned, and with
> every other rung of the ladder already owned), **the last not-yet-classified sub-topping can
> still be classified**:
> - the request is ANSWERED;
> - one `cls:` fact is stored;
> - a family label is displayed.
>
> The answer never degrades to existence, category or "no hint".

## 2. Owner Decisions (recorded)

| ID | Decision (2026-09-28) | Status |
|---|---|---|
| **OD-H5-P1** | Sub-topping classification is **not** subject to k ≥ 2. The classification may, combined with the player's knowledge, owned inventory or known hints, narrow the candidates to one. The classification must **never display the ingredient's name**. "Identifiable by deduction" and "the game displays the answer" are distinct (§3). | APPROVED |
| **OD-H5-P2** | A classification may be shown even when its family has only one candidate in the catalog, as long as what is displayed is the family label. | APPROVED |
| **OD-H5-P3** | A recipe with 0 sub-toppings gets **no** classification rung. It is acceptable that all ingredients can be deduced from the sauce / cheese / key purchases. Recipe name, id, description and image are never displayed. | APPROVED |
| ~~OD-H5-P4~~ | Round 1: whether "no sauce" or "no cheese" is sold as a paid hint was deferred with the TQ-1D Technique leak. **Split in round 6** into OD-H5-P4-CHEESE (approved) and OD-H5-P4-SAUCE (reserved). H5-1..H5-4 must never leak Technique identity. | superseded |
| **OD-H5-C1** | The key topping and the sub-topping order have **explicit authority**, based on `hintKeyToppingId` / `hintSubToppingOrder`. Array order (for example `requiredIngredients`) is never authority. The field names and their placement are fixed in this document (§6). | APPROVED |
| **OD-H5-C2** | The current **free key** (`hintKeyIngredientId`, the latest-unlocked ingredient on the ladder) and the Hint 5.0 **key topping** are **different concepts**. The key-topping rung is a normal **paid** rung. Making it free is not the default. | APPROVED |
| **OD-H5-C3** | Sub-topping **names are not sold**. There is no "classification → name" upgrade step. | APPROVED |
| **OD-H5-C4** | The UI uses human-friendly classification labels (🥩 肉系 …). Internal taxonomy ids are separate from display text and emoji. They must not contradict DH4-1 or PR #255 OD-TAX. A new family id is never added silently; it goes back to the Owner (§7). | APPROVED |
| **OD-H5-C4 (final, round 2)** | **No new taxonomy family.** The existing **7 families** of DH4-1 / PR #255 OD-TAX are kept. Only the UI display is made human-friendly. **「きのこ系」 is not an independent family**: mushroom stays in `vegetable`, and the display 「野菜・きのこ系」 is wording only. The invariant **"a classification emoji never collides with a real ingredient's emoji" is kept** (H5-INV-2, G18). | APPROVED (C4a / C4b closed) |
| **OD-H5-U1** | The basic UX is a **single ladder**, not the 3-way choice: sauce → cheese → key topping → structure → sub-topping ① … ⓝ. There is **no FREE LEAK**: the final rung count, the sub-topping count and the kinds of later rungs are not visible before purchase. The player always sees **what the next hint is** and **its price**. | APPROVED |
| **OD-H5-E3** | Existing coarse `attr:group:*` / `attr:category:*` facts are **never deleted** and **never converted** to `cls:<ingredientId>`. Stored facts stay forward-compatible. Only facts that map safely are reused. Full Reset, unknown ids and forward compatibility are kept. | APPROVED |
| **OD-H5-E1** | **Pricing = P-C:** sauce **10**, cheese **10**, key topping **10**, structure **5**, sub-topping classification **5 each**. The price depends on the rung kind only. | **APPROVED (price authority)** |
| **OD-H5-E2** | **No per-recipe cap.** At round 2 every runtime recipe totalled ≤ its existing 35 / 75 cap under P-C. With P4-CHEESE (round 6), marinara and fugazza total 40 (above the old 35); no cap still applies. | APPROVED |
| **OD-H5-E3b** | Owning a coarse 特徴 fact (`attr:group:*` / `attr:category:*`) does **not** auto-grant any individual classification. The facts stay stored, forward-compatible. | APPROVED |
| **OD-H5-M1** | The Hint 3.0 **free key**'s shown / purchased state is **not** carried over to the Hint 5.0 paid key-topping rung. They are separate concepts. | APPROVED |
| **OD-H5-T-COV** | Using PR #293: Hint 5.0 proceeds for the **runtime 25 recipes / 29 ingredients**, and the 62 / 172 unclassified-ingredient problem is **not an H5-1 blocker**. For production, the **fail-fast gate "every hint-eligible topping resolves to exactly one valid taxonomy family"** is mandatory. **A silent fallback from a missing classification to existence (or group / category) is forbidden** (§11). | APPROVED |
| **OD-H5-C1a** | **margherita = basil, quattro-formaggi = none, fugazza = onion, parmigiana = eggplant, pesto-tonno = tuna** | **APPROVED (round 3)** |
| **OD-H5-C1-P (authoring principle)** | 「Hint 5.0のkey toppingは、そのレシピを特徴づける主要トッピングとする。香り付け・添え物より主役となる材料を優先し、sauce / cheeseと情報を重複させない。」 The Hint 5.0 key topping is the main topping that characterises the recipe. A main ingredient is preferred over an aroma or garnish, and the key never duplicates sauce or cheese information. | **APPROVED (round 3)** |
| **OD-H5-C1b** | **capricciosa = mushroom, pizza-portuguesa = ham, puttanesca-pizza = anchovy.** The seeds for marinara = garlic, pizza-bianca = rosemary and meat-lovers = ham are kept, as audited. The §6.4 tie-break is **not** authority; it is only a candidate for the 172 authoring guideline. | **APPROVED (round 4)** |
| **OD-H5-M3** | **D (round 5).** The pre-purchase UI never varies with legacy facts: rung visibility, the next rung kind, the displayed price and purchasability are those of a fresh save, and no rung is shown as completed because of a legacy `ing:*` fact. At request time: **ALL** of the rung's information already known → **0 Pitz**, completed, nothing stored twice; **PARTIAL** or **NONE** known → the **normal P-C price**, disclosing the whole rung. The 0-Pitz result is never shown before the request. Existing facts are never deleted, converted or rewritten (§9.0). | **APPROVED (authority)** |
| **OD-H5-P4-CHEESE** | A target without cheese keeps the normal **CHEESE** rung. **Before purchase:** the same 「チーズ」 rung at the normal 10 Pitz as every other target; nothing says "none". **After purchase:** 「チーズ：なし」, completed by `h5:cheese`, never charged again after reload. **M3-D:** if a legacy Economy 1.0 count line already said 「チーズは使わないみたい」, the request completes for 0 Pitz (learnt only after the request); otherwise 10. OD-H3-7 / -15 (no negative facts) are superseded for this paid Hint 5.0 answer only. | **APPROVED (round 6)** |
| **OD-H5-P4b** | A target without a key topping (runtime: quattro-formaggi) keeps the normal **KEY_TOPPING** rung: 「キートッピング」 at 10 Pitz before purchase, 「キートッピング：なし」 after it, completed by `h5:key`. No legacy fact states it, so it always costs 10. | **APPROVED (round 6)** |
| **OD-H5-P4-SAUCE** | 「ソース：なし」 is **not** Hint 5.0 authority: it is the Technique `no-sauce` identity (TQ SSOT P2 / P6). An empty sauce rung stays **RESERVED_EMPTY_RUNG** until TQ-1D decides. G7 and the RESERVED gate keep every such recipe out of the production target set. The TQ authority is not changed. | **RESERVED (TQ-1D)** |
| **OD-H5-M2** | **All 25 recipes at once.** This is the implementation authority for the flag-ON target set; it does not turn the production flag on. Conditions: (1) P4-CHEESE implemented, (2) P4b implemented, (3) no production recipe can reach a RESERVED rung, (4) G7 PASS, (5) taxonomy eligibility PASS, (6) M3-D FREE LEAK gates PASS. | **APPROVED (round 6)** |
| **OD-H5-RETIRE** | With the Hint 5.0 flag ON, the **new-purchase paths** of the old 材料 / 構成 / 特徴 hints end. Bought facts are never deleted or converted and stay in 「以前のヒント」. No save migration, no schema bump. | **APPROVED (round 6)** |

## 3. Authority: deduction vs. disclosure (normative)

> **Deduction ≠ disclosure.** Hint 5.0 may give facts from which a player can **deduce** a
> sub-topping, the whole composition, or even which recipe it is (PAID INFERENCE, P1 / P2 / P3).
> Hint 5.0 must never **display** an identity the player has not bought or discovered.

These invariants are hard. Every H5 phase must keep them and test them.

| Invariant | Rule | Surfaces |
|---|---|---|
| **H5-INV-1 (ingredient)** | Only a purchased **name rung** (sauce / cheese / key topping) displays an ingredient's name or glyph. A sub-topping's name, id, glyph or `IngredientGlyph` is **never** displayed. The one exception is a legacy fact the player already owns (§9). | text, DOM, aria, `data-*`, `title`, img alt / src, test ids visible to the player, the view model |
| **H5-INV-2 (label)** | A classification label is one of the fixed family labels. It is never derived from an ingredient's name. Its emoji is **never equal to any catalog ingredient's emoji** (§7). | the display table plus a data gate |
| **H5-INV-3 (recipe)** | A recipe's name, id, description and image are never displayed, and never placed in the view model. | as above |
| **H5-INV-4 (technique)** | An undiscovered Technique's name, id and riddle are never displayed by a hint. No rung reveals the absence of sauce while P4 is reserved (§12). | as above |
| **H5-INV-5 (FREE LEAK)** | Before a purchase, the presentation depends only on things the player already owns or has bought, and on constants: the rung kind, the rung index and the price. It never depends on the target's unbought content. | the view model |
| **H5-INV-6 (charging)** | Only ANSWERED charges. The following are never charged: owned information, a stale or double request, insufficient Pitz, a no-fact result (ALREADY_KNOWN / RESERVED), and a rejection. 0 Pitz never appears in production. | the reducer |

## 4. Authority conflict table (updated)

"Superseded for Hint 5.0" means that the rule keeps governing Hint 3.0 / 4.0 code and data, but
does not govern Hint 5.0 rungs.

| Authority | Rule | H5-0 resolution |
|---|---|---|
| OD-DH4-3 (`MIN_ATTRIBUTE_CANDIDATES = 2`), OD-DH4-2-2 partition guard, T1a | k ≥ 2 for 特徴 | **Superseded for Hint 5.0 classification** (P1). The DH4 guard code stays for the DH4 path and its tests. It is not deleted in H5-1. |
| **OD-TAX-4** (PR #255, "Keep k ≥ 2") | k ≥ 2 for multi-axis hints | **Superseded for sub-topping classification only** (P1). OD-TAX-4 still governs any *other* axis (subfamily, flavor, a second axis): FR-3 remains. |
| **OD-TAX-5** (never sell the full signature; one fact per hint) | – | **Partly superseded** (P1 / P3). The family signature of a recipe's sub-toppings may be bought, **one rung per fact**, so the "one fact per hint" half is kept. Subfamily (L3) and flavor are still never sold (OD-TAX-3). |
| OD-TAX-1 / 2 / 3 / 6 / 7 / 8 / 9 | 3 layers; the 7 family ids; show at most L2; identity ≠ role / timing; the Human Classification Gate; no weak 「その他」 copy; FR scope | **Kept**. Hint 5.0 shows L2 only and uses the 7 ids (§7). |
| OD-H3-5 Rule W / Hint 2.0 A-4 (n−1 cap) | Never name every ingredient | **Superseded for Hint 5.0** (P3, C3). Hint 5.0 has no reserve. Names are sold only for sauce / cheese / key; sub-toppings are never named. |
| OD-H3-6 / -13 (free key) | The key is free | **Superseded for Hint 5.0** (C2). Hint 5.0 does not display the Hint 3.0 free key (§9.3). |
| OD-H3-7 / -15 (no negative fact) | – | **Kept** for everything except the paid Hint 5.0 「チーズ：なし」 / 「キートッピング：なし」 answers (round 6, §5.3). An empty SAUCE rung stays RESERVED. |
| OD-H3-14 (category preference), DH4-2C 3-card UI | 材料 / 構成 / 特徴 | **Replaced for Hint 5.0 targets** (U1) |
| OD-H3-16 / OD-DH4-10 (FREE LEAK) | – | **Kept** (H5-INV-5) |
| OD-H3-4 ESC + cap 35 / 75, OD-H3-9 (the rung never rolls back), OD-DH4-PROD-1 (5 / 5), OD-HE-5 (Dex-0 onboarding is free), OD-HE-7 ("No H5") | – | **Superseded for Hint 5.0 rungs by OD-H5-E1 (P-C) / E2 (no cap).** The prices are fixed per rung kind, so OD-H3-9 rung continuity has nothing to roll back. The ESC ladder and 5 / 5 still govern non-Hint-5.0 targets. OD-HE-5 is **kept**: the Dex-0 Margherita onboarding is free and never persisted. OD-HE-7 refers to the Hint 2.0 level H5 and is unrelated; player copy must avoid 「H5」. |
| DH4-1 `ingredientTaxonomy.ts` header ("an ingredient without a row has no family; the guard answers at category level") and the DH4 coarsening (`deductionHint.ts`, `deductionGuard.ts` `classOf`) | A missing row silently coarsens | **Not reused by Hint 5.0** (OD-H5-T-COV, PR #293 F-2). The Hint 5.0 answer fails closed (`NOT_A_TARGET`, 0 Pitz) and CI fails first. The DH4 path is unchanged. H5-1 amends the header comment to say the DH4 behaviour does not apply to Hint 5.0. |
| OD-TQ1C-2, INV-TQ-4, the OD-DH4-PROD-1 TQ-1D contract | Re-audit when a Technique recipe ships | **Kept and extended** (§12) |

## 5. The ladder model

### 5.1 Rungs

`recipeHintRoles(recipeId)` is pure and data-driven. It returns the ordered rungs:

| # | Kind | Subject | Reveals | Stored fact |
|---|---|---|---|---|
| 1 | `SAUCE` | **every** sauce of the recipe, in one rung | their names | `ing:<id>` for each |
| 2 | `CHEESE` | **every** cheese of the recipe, in one rung | their names | `ing:<id>` for each |
| 3 | `KEY_TOPPING` | `hintKeyToppingId` | its name | `ing:<id>` |
| 4 | `STRUCTURE` | the recipe | the distinct ingredient total | `meta:ingredient-total` |
| 5..4+n | `SUB_CLASS` (ordinal 1..n) | `hintSubToppingOrder[i]` | its **family label only** | `cls:<ingredientId>` |

**Rules:**
- **R1. One rung per kind for sauce and cheese.** Several sauces or cheeses are revealed together
  (for example quattro-formaggi's 4 cheeses). So rungs 1–4 have the same count and kinds for
  **every** target (H5-INV-5).
- **R2. Strictly linear.** Only the **next** unowned rung can be bought (`expectedRungIndex`
  echoes it). Rungs 5+ exist in the view only after rung 4 is owned. By then the total and all
  names are paid-known, so revealing the remaining rung count is paid inference.
- **R3. P3.** n = 0 means there are no rungs after STRUCTURE. The ladder ends with a
  generic completion line, the same text for every target (the existing
  `SELECTABLE_HINT_GUIDANCE` idea).
- **R4. C3.** No rung ever sells a sub-topping's name.
- **R5. Dex-0 Margherita** (OD-HE-5): every rung is free and nothing is persisted, as today.

### 5.2 STRUCTURE content

The STRUCTURE rung tells **the total only**: 「このピザは全部でN種類の材料を使うよ」, the
existing `meta:ingredient-total` line.
- The DH4 topping clause (`meta:topping-total`, TC-G) is **not** sold by Hint 5.0. After rungs
  1–4 it is derivable anyway.
- A stored `meta:topping-total` is still displayed (§9).

### 5.3 Empty fixed rungs (round 6: P4-CHEESE, P4b, P4-SAUCE)

If a recipe has no sauce, no cheese or no key topping, the rung has no subject. The rung is never
skipped (a visible skip is a FREE LEAK) and it keeps its normal label and price before purchase.

| Empty rung | Authority | Request | Board after the request | Completion |
|---|---|---|---|---|
| CHEESE | OD-H5-P4-CHEESE | `ANSWERED` at 10 Pitz, or `ALREADY_KNOWN` at 0 when a legacy count line said 「チーズは使わないみたい」 | 「チーズ：なし」 | `h5:cheese` only (no `ing:`) |
| KEY_TOPPING | OD-H5-P4b | `ANSWERED` at 10 Pitz (no legacy fact states it) | 「キートッピング：なし」 | `h5:key` only |
| SAUCE | OD-H5-P4-SAUCE (reserved) | `RESERVED_EMPTY_RUNG`: 0 Pitz, no fact, no line | – | – |

- The 「なし」 comes from the recipe data at render time, only for a COMPLETED rung. It is never in
  a pre-purchase view.
- **RESERVED gate (M2 condition 3):** no production recipe may reach `RESERVED_EMPTY_RUNG`. On the
  runtime 25 recipes, no recipe is sauceless, so the reserved set is empty. G7 fails the build as
  soon as a production recipe has a sauce count ≠ 1 or requires a Technique.
- The runtime targets with an empty rung (all now normal paid rungs):
  - no cheese: marinara, fugazza, pizza-bianca, pesto-tonno, puttanesca-pizza;
  - no key topping: quattro-formaggi.
- In the 172 complete rows: 29 have no sauce (reserved, TQ-1D), 16 have no cheese, and 25 have
  0 sub-toppings (allowed by P3, not an empty rung).
- **Mixed mode is not used (M2 = all 25):** "which sheet you get" would reveal the empty rung.

## 6. Data model (C1: field names and placement)

The existing per-recipe data modules use `Readonly<Record<RecipeId, …>>`:
- `src/data/recipeSauceProfiles.ts` (`RECIPE_SAUCE_PROFILES`);
- `src/data/cookingProfiles.ts`.

That shape gives **compile-time exhaustiveness**: a new recipe without an entry does not type-check.
Hint 5.0 follows the same pattern:

```ts
// src/data/recipeHintRoles.ts   (H5-1, new, data only)
export interface RecipeHintRoles {
  /** OD-H5-C1: the key-topping rung's subject, a topping of the recipe, or null (no topping). */
  hintKeyToppingId: string | null;
  /** OD-H5-C1: the SUB_CLASS rung order: a permutation of the recipe's toppings minus the key. */
  hintSubToppingOrder: readonly string[];
}
export const RECIPE_HINT_ROLES: Readonly<Record<RecipeId, RecipeHintRoles>> = { /* 25 entries */ };
```

- `Recipe` (`src/data/recipes.ts`) is **not** changed.
- Nothing is derived at runtime from `requiredIngredients` order.
- Gate G17 checks that the authored fields are consistent with the recipe's ingredients.

### 6.1 Hint 5.0 key-topping authority for the 25 runtime recipes (final: C1a + C1b + C1-P)

The seed below is an **authoring proposal**:
- Where the ladder key is a topping, the key topping is that key.
- Otherwise the key topping is the recipe's identity topping.
- The sub order is a one-time copy of the recipe's own listing order. Once written, it is the
  authority, and later edits to `requiredIngredients` do not move it.

**Row markers:**
- **✅** marks an explicit Owner Decision (C1a / C1b).
- Every other row is the seed that passed the §6.4 check and is kept.

This table is implemented verbatim as `src/data/recipeHintRoles.ts` (H5-1).

| Recipe | `hintKeyToppingId` | `hintSubToppingOrder` |
|---|---|---|
| margherita ✅ | basil | [] |
| marinara | garlic | [oregano] |
| quattro-formaggi ✅ | null (no topping) | [] |
| genovese | cherry-tomato | [] |
| bismarck | egg | [] |
| funghi | mushroom | [] |
| fugazza ✅ | onion | [oregano] |
| salsiccia | sausage | [] |
| pepperoni | pepperoni | [] |
| napoletana | anchovy | [oregano] |
| tonno-e-cipolla | tuna | [onion] |
| pizza-bianca | rosemary | [] |
| breakfast-pizza | bacon | [egg] |
| capricciosa ✅ (C1b) | mushroom | [oregano, ham, black-olive] |
| meat-lovers | ham | [bacon, pepperoni, sausage] |
| melanzane-pizza | eggplant | [basil] |
| parmigiana-pizza ✅ | eggplant | [basil] |
| bambino | corn | [ham] |
| hawaiian | pineapple | [ham] |
| pizza-portuguesa ✅ (C1b) | ham | [egg, onion, black-olive] |
| pesto-tonno ✅ | tuna | [black-olive, onion] |
| new-haven-apizza | clam | [garlic] |
| pesto-caprese | fresh-tomato | [basil] |
| pesto-patate | potato | [bacon] |
| puttanesca-pizza ✅ (C1b) | anchovy | [black-olive, capers, garlic] |

**Summary:**
- sub-topping counts: 0 × 8, 1 × 12, 2 × 1, 3 × 4;
- in the 172 complete rows: 0 × 25, 1 × 43, 2 × 35, 3 × 12, 4 × 4, 5 × 1.

**Authoring guidance.** The sub order should follow the recipe's own presentation, not a family
sort. With a family-sorted order, 「サブ① = 野菜」 would imply "no meat", which is a free negative
fact.

### 6.2 OD-H5-C1a: comparison for the 5 recipes (decided in round 3, as recommended below)

**Common facts:**
- The P-C price per rung is sauce 10, cheese 10, key 10, structure 5 and 5 per sub-class. Empty
  rungs are never charged.
- The sub order listed for each option is the one that option would author.
- 「RESERVED」 means an empty fixed rung (§5.3), as audited in round 3. Since round 6 an empty
  cheese / key rung is a normal paid rung (「なし」 after the purchase, +10 to the totals below);
  only an empty sauce rung stays RESERVED.

| Recipe (composition) | Ladder free key (Hint 3.0) | Key-topping candidates | Sub order with that key | Hint 5.0 ladder (P-C total) | Notes |
|---|---|---|---|---|---|
| **margherita**: tomato-sauce, mozzarella, basil | none (starter-only) | **(a) basil** | [] | sauce → cheese → key basil → structure: 4 rungs (35). **In practice free:** margherita is a Hint target at Dex 0 only, as the onboarding (OD-HE-5: every rung free, nothing persisted). | ★ **Recommended: basil.** It is the only topping. There is no empty rung, and the onboarding is simple. It matches pepperoni / funghi-style 0-sub recipes (P3). |
| | | (b) null | [basil] | Key rung RESERVED (P4b) → sub① 🪴 ハーブ・香味系: 4 non-empty rungs (30) | Makes the onboarding depend on P4b. It teaches classification on the first recipe, but a RESERVED rung on the tutorial is poor UX. |
| **quattro-formaggi**: olive-oil, mozzarella, gorgonzola, parmigiano, fontina (no topping) | gorgonzola (cheese) | **(a) null** (no topping exists) | [] | sauce → cheese (all 4 cheese names in one rung) → key **RESERVED (P4b)** → structure: 3 non-empty rungs (25) | ★ **Recommended: null.** C1 / G17 define the key topping as a topping, and none exists. Because of P4b, this recipe cannot be enabled until P4b is decided. |
| | | (b) a cheese as "key" (e.g. gorgonzola) | [] | The key rung would repeat a name the cheese rung already revealed | **Not recommended.** It breaks C2 (key topping ≠ the free key concept) and G17, and it duplicates information. |
| | | (c) a special rule for recipes with no topping (the rung is omitted) | [] | 3 rungs | This amounts to deciding P4b. It is listed for the Owner's P4b decision, not for C1a. |
| **fugazza**: olive-oil, onion, oregano (no cheese) | olive-oil (sauce) | **(a) onion** | [oregano] | sauce → cheese **RESERVED (P4)** → key onion → structure → sub① 🪴 ハーブ・香味系 (30) | ★ **Recommended: onion.** It is fugazza's identity ingredient: an onion pizza, its description leads with it, and onion's Starter Grant is tied to fugazza. The oregano classification leaves a real herb deduction (basil / garlic / oregano / rosemary). |
| | | (b) oregano | [onion] | … → key oregano → structure → sub① 🥬 野菜・きのこ系 (30) | Oregano is a secondary seasoning (marinara / napoletana use it too), so it makes a weak "key". |
| | | Either way | | | Blocked by **P4** (no cheese), whichever key is chosen |
| **parmigiana-pizza**: tomato-sauce, mozzarella, eggplant, parmigiano, basil | parmigiano (cheese) | **(a) eggplant** | [basil] | sauce → cheese (mozzarella + parmigiano) → key eggplant → structure → sub① 🪴 ハーブ・香味系 (45) | ★ **Recommended: eggplant.** Parmigiana is an eggplant dish, and eggplant is the main topping (×3). It matches melanzane-pizza (key eggplant, sub basil); the two are told apart by the cheese rung (parmigiano), which is good deduction play. |
| | | (b) basil | [eggplant] | … → key basil → structure → sub① 🥬 野菜・きのこ系 (45) | Basil is a garnish, and it is shared with margherita, melanzane and pesto-caprese, so it makes a weak key |
| **pesto-tonno**: pesto, tuna, black-olive, onion (no cheese) | pesto (sauce) | **(a) tuna** | [black-olive, onion] | sauce → cheese **RESERVED (P4)** → key tuna → structure → sub① 🥬, sub② 🥬 (40) | ★ **Recommended: tuna.** It is the named ingredient (tonno = tuna) and the main topping (×3). It mirrors tonno-e-cipolla (key tuna). The two vegetable subs give a two-step vegetable deduction. |
| | | (b) onion | [tuna, black-olive] | … → sub① 🦐 魚介系, sub② 🥬 (40) | Onion is shared with many recipes, so it makes a weak key. It gives a seafood classification instead. |
| | | (c) black-olive | [tuna, onion] | … → sub① 🦐, sub② 🥬 (40) | Black-olive is a secondary topping. Its family is also under review (PR #255 NEEDS_REVIEW), so it would be a fragile key. |
| | | Any choice | | | Blocked by **P4** (no cheese) |

**Summary of the recommendations (Owner to decide):**

| Recipe | Recommended key | Sub order |
|---|---|---|
| margherita | basil | [] |
| quattro-formaggi | null | [] (P4b) |
| fugazza | onion | [oregano] |
| parmigiana-pizza | eggplant | [basil] |
| pesto-tonno | tuna | [black-olive, onion] |

The recommendations follow one principle: **"the key topping is the recipe's identity topping,
never a garnish or seasoning"**. It can be written into the authoring guide for 172.

**Effect on enablement.** With the recommended keys, the targets blocked until P4 / P4b are still
the same 6:
- marinara, fugazza, pizza-bianca, pesto-tonno and puttanesca (P4);
- quattro-formaggi (P4b).

No C1a choice changes that set, **except** margherita option (b), which would add a 7th
(RESERVED key).

### 6.4 C1-P consistency check of the 20 remaining seeds (round 3)

**Method.**
- Every seed came from the Discovery Ladder's free key: the latest-unlocked ingredient. The
  ladder unlocks whatever is new, which can be a seasoning. So each seed was re-checked against
  C1-P, using:
  - the recipe's toppings;
  - their `minCount`, i.e. how much of it goes on the pizza;
  - the recipe's own description;
  - the DH4-1 family.
- `minCount` and description order are **evidence only**, not authority (C1).

| Recipe | Toppings (×minCount, family) | Seed key | C1-P verdict |
|---|---|---|---|
| marinara | garlic ×3 herb, oregano ×2 herb | garlic | ✅ **edge**: every topping is an aroma, so no non-aroma main exists. Garlic is the most prominent (×3, named first). |
| genovese | cherry-tomato ×3 | cherry-tomato | ✅ only topping |
| bismarck | egg ×1 | egg | ✅ only topping, the identity |
| funghi | mushroom ×3 | mushroom | ✅ |
| salsiccia | sausage ×3 | sausage | ✅ |
| pepperoni | pepperoni ×4 | pepperoni | ✅ |
| napoletana | anchovy ×3 seafood, oregano ×1 herb | anchovy | ✅ main over aroma |
| tonno-e-cipolla | onion ×2, tuna ×3 | tuna | ✅ largest, named first ("tonno"); consistent with pesto-tonno (C1a) |
| pizza-bianca | rosemary ×3 | rosemary | ✅ **edge**: the only topping, and it is an aroma |
| breakfast-pizza | egg ×1 other, bacon ×3 meat | bacon | ✅ both are mains; bacon is largest |
| **capricciosa** | mushroom ×2 veg, oregano ×1 herb, ham ×1 meat, black-olive ×2 veg | **oregano** | **✗ breaks C1-P.** Oregano is an aroma (×1), and it is not even named in the description (「マッシュルーム・ハム・ブラックオリーブ」). |
| meat-lovers | bacon ×2, ham ×1, pepperoni ×1, sausage ×2 (all meat) | ham | ✅ **note**: every topping is a main of the same family. Ham is the smallest (×1), but it is not a garnish. |
| melanzane-pizza | eggplant ×3, basil ×2 herb | eggplant | ✅ |
| bambino | ham ×2 meat, corn ×3 veg | corn | ✅ both are mains; corn is largest |
| hawaiian | ham ×2, pineapple ×3 | pineapple | ✅ identity |
| **pizza-portuguesa** | ham ×3 meat, egg ×1 other, onion ×2 veg, black-olive ×2 veg | **onion** | **✗ breaks C1-P (main vs supporting).** Ham is the clear main (×3, named first). Onion is a supporting vegetable. |
| new-haven-apizza | clam ×3 seafood, garlic ×2 herb | clam | ✅ main over aroma |
| pesto-caprese | fresh-tomato ×3, basil ×2 herb | fresh-tomato | ✅ main over aroma. It also avoids duplicating the pesto (basil) sauce information. |
| pesto-patate | potato ×3, bacon ×2 | potato | ✅ identity ("patate") |
| **puttanesca-pizza** | anchovy ×3 seafood, black-olive ×2 veg, capers ×2 **spice**, garlic ×2 herb | **capers** | **✗ breaks C1-P.** Capers are a 薬味 (the spice family). Anchovy is the main (×3, named first). |

**Result:** 17 / 20 are consistent (2 of them are edge cases, plus 1 note). **3 are inconsistent**,
listed below as OD-H5-C1b.

**Proposed corrections (OD-H5-C1b; the Owner decides):**

| Recipe | Recommended key | Sub order with it | Classification rungs | Alternatives |
|---|---|---|---|---|
| capricciosa | **mushroom** (×2, named first) | [oregano, ham, black-olive] | 🪴 🥩 🥬 | ham → [mushroom, oregano, black-olive] 🥬 🪴 🥬. Black-olive is not recommended: it is on PR #255's NEEDS_REVIEW list. |
| pizza-portuguesa | **ham** (×3, named first) | [egg, onion, black-olive] | ✨ 🥬 🥬 | egg → [ham, onion, black-olive] 🥩 🥬 🥬 |
| puttanesca-pizza | **anchovy** (×3, named first) | [black-olive, capers, garlic] | 🥬 🧂 🪴 | black-olive (NEEDS_REVIEW, fragile) → [anchovy, capers, garlic] 🦐 🧂 🪴 |

**Effects of the corrections:**
- **Price:** unchanged. The key rung is 10 whatever the key is. Every total is unchanged, because
  the number of rungs does not change.
- **Enablement set:** unchanged. Capricciosa and portuguesa have a cheese; puttanesca is already
  waiting on P4 because it has no cheese.
- **Deduction:**
  - capricciosa = mushroom shares rungs 1–3 with funghi; the two separate at STRUCTURE (6 vs 3).
  - pizza-portuguesa = ham shares rungs 1–3 with meat-lovers (both have 6 ingredients); they
    separate at sub ① (✨ vs 🥩).

**Round 4:** the Owner approved the three corrections as recommended (C1b). After C1b, all
**25 / 25 recipes are consistent with C1-P** (re-check below).

| Recipe | Final key | Verdict |
|---|---|---|
| margherita | basil (C1a) | ✅ only topping |
| quattro-formaggi | none (C1a) | ✅ no topping exists |
| fugazza | onion (C1a) | ✅ main over the oregano aroma, and identity |
| parmigiana-pizza | eggplant (C1a) | ✅ main (×3) over the basil aroma |
| pesto-tonno | tuna (C1a) | ✅ named ingredient, ×3 |
| capricciosa | mushroom (C1b) | ✅ main (×2, named first), not the oregano aroma |
| pizza-portuguesa | ham (C1b) | ✅ main (×3, named first) |
| puttanesca-pizza | anchovy (C1b) | ✅ main (×3, named first), not the capers 薬味 |
| the other 17 seeds | as in §6.1 | ✅ as in the table above (including the marinara / pizza-bianca edge cases and the meat-lovers note, kept by the Owner) |

No key duplicates a sauce or cheese: every key is a topping, and the recipe's sauce and cheese are
told by their own rungs.

**Authoring tie-break (a candidate for the 172 authoring guideline only; NOT Owner authority).** When C1-P leaves several mains:
1. prefer the topping the recipe is named after;
2. otherwise the largest reference amount;
3. otherwise the first one the description names.

This is guidance for the 172 authoring tool. It is never a runtime rule.

### 6.3 Fact ids

The fact grammar is unchanged: `HINT_FACT_ID_PATTERN` is `<kind>:<value>[:<qualifier>]`, with at
most 64 facts per recipe. **No save schema bump.**

| Fact | Id | Notes |
|---|---|---|
| Name rungs | `ing:<id>` (existing kind) | The same id a Hint 3.0 purchase stored, so legacy purchases are reused as they are |
| STRUCTURE | `meta:ingredient-total` (existing) | |
| SUB_CLASS | **`cls:<ingredientId>`** (new kind) | Keyed by ingredient, so authored reordering never mis-assigns. It lives in the save only, as `ing:` already does. It is **never rendered**: the view model carries the family id, never the ingredient id (H5-INV-1). |

## 7. Classification display (C4)

**Internal ids.** These are the DH4-1 family ids and are unchanged:
`meat`, `seafood`, `vegetable`, `herb`, `spice`, `fruit`, `other`.

**Display layer.** A new, separate table, `HINT_CLASS_DISPLAY: Record<AttributeFamilyId, { emoji,
labelJa }>`. The DH4-1 `labelJa` stays for the legacy 特徴 lines.

| Family id | Display (OD-H5-C4 final; wording may be polished at H5-3) | Note |
|---|---|---|
| meat | 🥩 肉系 | |
| seafood | 🦐 魚介系 | The Owner's example **🐟 is anchovy's glyph** (H5-INV-2), so it must not be used |
| vegetable | 🥬 野菜・きのこ系 | きのこ is folded in (OD-DH4-4 / OD-TAX) |
| herb | 🪴 ハーブ・香味系 | The Owner's example **🌿 is basil's and pesto's glyph**, so it must not be used |
| spice | 🧂 スパイス・薬味系 | |
| fruit | 🍇 果物系 | 🍍 is pineapple's glyph |
| other | ✨ ちょっと変わった材料 | OD-TAX-8: never 「その他系」 |

**Decided (OD-H5-C4 final, round 2):**
- **No new family.** The 7 ids above are the whole Hint 5.0 classification space.
- **「きのこ系」 is not a family.** Mushroom remains `vegetable`, and its display reads
  「野菜・きのこ系」. (A `mushroom` family was also impractical: at runtime it would be a singleton,
  and 🍄 is mushroom's own glyph.)
- The table above is the **display authority H5-1 starts from**. Wording may be polished at H5-3
  Human Verification without touching ids.
- **Gate G18 enforces H5-INV-2 permanently:** no display emoji may equal any catalog ingredient's
  emoji.
  - 🐟 is anchovy's glyph, 🌿 is basil's / pesto's and 🍍 is pineapple's, so none is used.
  - 🦐 is safe today. If shrimp ever lands with 🦐, G18 fails, and the seafood emoji or shrimp's
    glyph must change.
- The garlic / capers / black-olive boundary stays with OD-TAX-7. Hint 5.0 uses the current DH4-1
  rows as they are.

## 8. UX (U1) and FREE LEAK

The sheet shows three things.

**1. The board.** Every owned rung, in ladder order:
- sauce / cheese / key names with their glyphs;
- the total;
- 「サブトッピング① 🥩 肉系」 and so on;
- legacy lines in an archive block (§9).

**2. One "next hint" card.** It shows two things only:
- **the next rung's label**, from a fixed vocabulary:

  | Rung | Label |
  |---|---|
  | 1 | 「ヒント1: ソース」 |
  | 2 | 「ヒント2: チーズ」 |
  | 3 | 「ヒント3: キートッピング」 |
  | 4 | 「ヒント4: 構成（材料の数）」 |
  | 5 onward | 「ヒント5: サブトッピング①の分類」… |

- **its price**.

**3. After the last rung:** the generic completion line, the same text for every target.

**Never shown:**
- the number of rungs left;
- a progress bar;
- 「あとN個」;
- the kinds of later rungs;
- per-target differences before rung 4.

**Why this holds:**
- For every target, rungs 1–4 have identical labels and prices (the price is per rung kind,
  §10).
- Rungs 5+ appear only after rung 4 is paid.

This satisfies both H5-INV-5 and the Owner's priority: the player always knows "what am I
buying, and for how much".

## 9. Migration design (final)

### 9.0 OD-H5-M3 = D (authority; supersedes the view-time settlement in §9.1)

**Completion records.** A rung is **completed** only by a Hint 5.0 completion record. These ids
are inside the persisted grammar, so there is no schema bump.

| Rung | Completion record |
|---|---|
| Sauce | `h5:sauce` |
| Cheese | `h5:cheese` |
| Key topping | `h5:key` |
| Structure | `h5:structure` |
| Sub-topping | `cls:<ingredientId>` |

**Legacy facts never complete a rung.** The legacy facts listed in §9.1 are:
- `ing:` names;
- Economy 1.0 grants;
- `meta:ingredient-total` / the legacy count line;
- the `attr:family` safe mapping.

So the pre-purchase view is the same as a fresh save's in all of these: the next rung, its kind,
its price, whether it can be bought, and the board. The one exception is the 「以前のヒント」
archive of the player's own earlier names and lines, which never depends on the target.

**At request time the order is:** target → STALE → complete → balance at the normal price →
empty rung → known check.

| Known state | Result |
|---|---|
| **ALL** known | `ALREADY_KNOWN`: 0 Pitz, only the completion record is appended, and the sheet then says 「このヒントはもう知っていたよ！（Pitzは使っていないよ）」 |
| **PARTIAL** or **NONE** known | `ANSWERED` at the normal P-C price: the new names or total, plus the completion record |

- The M3 rule applies to **every** rung kind. Structure and sub-topping rungs follow the same rule
  as the name rungs, because a view-time skip of any rung would leak in the same way (H5-2 Result
  §5).
- A request below the normal price is refused, so a 0-Pitz completion can never be learnt without
  an affordable request.

**Principles (E3):**
- never delete, never rewrite, never convert a stored id;
- read-time mapping only;
- append new ids;
- unknown and future ids are kept verbatim (H3-2);
- **Full Reset** clears both ledgers (unchanged).

**No schema bump.**

### 9.1 Mapping table

| Stored today | Hint 5.0 reading | Writes? |
|---|---|---|
| `ing:<sauce>` / `ing:<cheese>` | Counts toward rung 1 / 2. A rung is **owned** when **every** subject of it is known. If only some are known (e.g. 1 of 2 cheeses), the rung is still sold, and it reveals the rest. | none |
| `ing:<key topping>` | Rung 3 owned | none |
| `ing:<sub-topping>` (a Hint 3.0 material purchase) | That SUB_CLASS rung is **ALREADY_KNOWN**: the **name** stays displayed (a legacy exception to H5-INV-1, since it is the player's own fact). It is never sold and charged 0. | none |
| `ing:<ladder free key>` | Never stored (free keys were derived). No mapping (§9.3). | – |
| `meta:ingredient-total`, or a legacy 「材料は全部で○種類」 (OD-DH4-8, `legacyOwnsIngredientTotal`) | Rung 4 owned | none |
| `meta:topping-total` | Displayed as an owned structure line. No rung. | none |
| `attr:family:<f>` | **Safe mapping** only when the Rule W reserve of that recipe is a Hint 5.0 sub-topping **and** its current family is `f`: that SUB_CLASS rung is owned (derived, **no** `cls:` written). Otherwise it goes to the archive. If a future HCG moves that ingredient's family, the condition stops holding, and the fact falls back to archive-only, never deleted (PR #293 F-8). | none |
| `attr:group:*`, `attr:category:*` | **Archive only** (「以前のヒント」). No rung is owned. Never converted (E3). **No courtesy classification is granted (OD-H5-E3b).** | none |
| Legacy `discoveryHintPurchases` (Economy 1.0) | The existing `legacyHintMapping` grants `ing:` facts and archive lines, read as above | none |
| Unknown / future kinds (`tech:`, …) | Kept, not displayed | none |

A purchase appends new `ing:` / `meta:` / `cls:` ids after the stored list, the same way
`requestDeductionHintFact` does today.

### 9.2 Rollback

The previous build:
- ignores `cls:` facts but keeps them (H3-2);
- reads `ing:` and `meta:` exactly as before.

So a rollback loses no data.

### 9.3 Decided consequences (C2, M1, E3b)

- **No free key in Hint 5.0 (OD-H5-M1).** The Hint 3.0 free key's shown / purchased state is
  **not** carried over to the paid key-topping rung.
  - A player who saw 「ペパロニを使うピザ」 under Hint 3.0 does not see it on the Hint 5.0 board
    until they buy rung 3.
  - The Hint 3.0 free key and the Hint 5.0 key topping are separate concepts (C2).
- **No courtesy classification (OD-H5-E3b).** Coarse 特徴 buyers keep their archive line only.

### 9.4 STALE / double-request token

- The request carries `expectedRungIndex`: the 1-based index of the next unowned rung, which is
  what the card showed.
- The authority re-derives the next rung from the ledger. It rejects the request (no charge)
  when the index differs.
- The index reveals nothing unbought.

## 10. Pricing (OD-H5-E1 = P-C, OD-H5-E2 = no cap: APPROVED)

### 10.0 Price authority

| Rung kind | Price (Pitz) |
|---|---:|
| SAUCE (every sauce, one rung) | **10** |
| CHEESE (every cheese, one rung) | **10** |
| KEY_TOPPING | **10** |
| STRUCTURE | **5** |
| SUB_CLASS (each) | **5** |

**Rules:**
- **The price depends only on the rung kind.** This is FREE-LEAK safe, and there is no rung
  continuity (OD-H3-9) to maintain.
- **No per-recipe cap** (E2).
- **Never charged:** an empty rung (RESERVED), a rung that is ALREADY_KNOWN, a completed ladder,
  and the Dex-0 onboarding (OD-HE-5, free).
- **Partly known multi-subject rung:** a rung whose subjects are partly known through legacy
  `ing:` facts (for example 1 of 2 cheeses) costs its full kind price, because it reveals at least
  one new name.
- **0 Pitz** is never a production price.
- **Tests:**
  - G-PRICE asserts the table and the kind-only dependency;
  - H5-2 re-runs the Hint Economy simulation with these prices before H5-4.

The rest of this section is kept as the decision record.

### 10.1 The options, with concrete numbers

| Rung | **P-A** family parity | **P-B** one ladder ESC | **P-C** flat by kind | **P-D** P-A + recipe cap |
|---|---:|---:|---:|---:|
| Sauce | 5 (the 1st name on the ESC) | 5 (rung 1) | 10 | 5 |
| Cheese | 10 (the 2nd name) | 10 (rung 2) | 10 | 10 |
| Key topping | 20 (the 3rd name) | 20 (rung 3) | 10 | 20 |
| Structure | 5 (DH4 fixed) | 40 (rung 4) | 5 | 5 |
| Sub-class ① | 5 | 40 | 5 | 5 |
| Sub-class ② | 5 | 40 | 5 | 5 |
| Sub-class ③ onward | 5 each | 40 each | 5 each | 5 each (cut off at the cap) |

**How the totals were computed:**
- Totals count only non-empty rungs.
- The Dex-0 Margherita onboarding is excluded (free).
- "Current" is today's maximum spend: every 材料 fact (ESC, capped) + 構成 5 + 特徴 5. That is
  more information than Hint 5.0 sells, because today sub-topping names can be bought.

| | Current | P-A | P-B | P-C | P-D |
|---|---:|---:|---:|---:|---:|
| **Typical 0-sub** (pepperoni, 4 rungs) | 15 | 40 | 75 | **35** | 35 |
| **Typical 1-sub** (hawaiian, 5 rungs) | 25 | 45 | 115 | **40** | 45 |
| **Largest runtime** (capricciosa / meat-lovers / portuguesa, 7 rungs) | 85 | 55 | 195 | **50** | 55 |
| **172 near-max** (5 subs, 3 names, 9 rungs) | – | 65 | 275 | **60** | 65 |
| Runtime 24 recipes: total / mean / max | 755 / 31.5 / 85 | 970 / 40.4 / 55 | 2600 / 108.3 / 195 | **910 / 37.9 / 50** | 945 / 39.4 / 55 |

### 10.2 Evaluation

| Criterion | P-A | P-B | P-C | P-D |
|---|---|---|---|---|
| **(4) vs Material ESC 5 / 10 / 20 / 40** | Reuses the ESC curve for names. The key topping (formerly free) costs 20. | The ESC continues along the ladder. The 40 rungs dominate. | Not ESC. Names cost 10 each, the average of ESC rungs 1–3 (35 / 3 ≈ 11.7). | as P-A |
| **(5) vs cap 35 / 75** (`selectableHintPriceCap`) | Exceeds the 35 cap on the 5 three-ingredient targets (40 > 35: genovese, bismarck, funghi, salsiccia, pepperoni). 75-cap recipes are fine. | Exceeds on every recipe (up to 195 vs 75) | **Within the cap for all 25**: every 35-cap recipe totals ≤ 35 and every 75-cap recipe ≤ 50. The 172 near-max of 60 is also ≤ 75. | Within the cap by construction |
| **(6) Pitz economy** (★3 discovery reward = 80 + 50 bonus = 130; the Hint Economy 1.0 baseline) | Mean 40 ≈ 31 % of one discovery | Mean 108 ≈ 83 %; max 195 > 130, **deadlock risk** (Economy 1.0 found soft deadlocks at 75) | Mean 38 ≈ 29 %; max 50 ≈ 38 % | as P-A, capped |
| **FREE LEAK** (H5-INV-5) | Name prices depend on the name's ordinal among names. Rungs 1–3 are fixed for every target (R1), so this is safe while P4 holds. It becomes fragile if empty rungs are ever skipped. | Price depends only on the index. Safe. | **Safe by construction**: the price depends on the rung kind only. | as P-A |
| **Legacy rung continuity** (OD-H3-9) | Needs a rule mapping paid 材料 rungs to name ordinals | Needs the same | **Not needed**: fixed per kind, so nothing to roll back | as P-A |
| **(7) Fit with "buy classifications, then deduce"** | Good. Classifications are cheap, but the key at 20 is the priciest step, just before the cheap part. | Poor. Every classification costs 40, which discourages deduction. | **Best**: every classification costs 5, and the price is easy to read (names 10, the rest 5). | Good, but the cap makes the last classification sometimes cost less than its label suggests (confusing) |
| Explainability (the Owner's priority) | Medium | Low | **High** | Low |

### 10.3 Recommendation (as presented; the Owner adopted P-C on 2026-09-28)

- **Recommended: P-C.** Sauce 10 / cheese 10 / key topping 10 / structure 5 / each sub-topping
  classification 5. **No cap is needed**, because every runtime recipe already fits within the
  existing 35 / 75 caps.
  - It is simple to read ("next: ヒント3 キートッピング 10 Pitz").
  - It is FREE-LEAK-safe by construction.
  - It has no legacy-rung mapping.
  - It is the cheapest way to "buy classifications and deduce".
  - Its economy load (mean 38, max 50; 172 max 60) is close to today's.
- **Runner-up: P-D** (P-A capped at the existing 35 / 75). It stays closest to the current ESC
  habits and never exceeds today's caps. It needs the legacy-rung rule and has the
  cap-truncation oddity.
- **Not recommended:** P-B (economy risk) and plain P-A (breaks the 35 cap on 5 targets).

**H5-2 must re-run the Hint Economy simulation** (`discoveryHintEconomy.sim.test.ts` harness)
with the chosen curve before H5-4.

### 10.4 Pricing sub-decisions (all closed)

| Decision | Outcome |
|---|---|
| E1 | P-C |
| E2 | No cap |
| E3b | No courtesy classification |

## 11. Taxonomy gate and the relation to PR #255

**Authority chain:**
- **`src/data/ingredientTaxonomy.ts` (DH4-1) is the only runtime taxonomy authority.**
- PR #255 (OD-TAX-1..9) is **Owner-approved design direction**, but **not** production authority.
  Its 179 rows are PROPOSED / NEEDS_REVIEW / UNKNOWN.
- A row enters production only through a PR that adds the ingredient to
  `src/data/ingredients.ts`, **after** the OD-TAX-7 Human Classification Gate has decided it.
- Hint 5.0 changes no taxonomy row and adds no family id.

**Relation to PR #293 (Taxonomy Coverage Fresh Audit, OPEN, docs only, not an authority):**
- It is the reference audit for OD-H5-T-COV.
- Its invariants **INV-T1..T7** and gate names are adopted below. It is not merged or changed here.
- **Scope decision (OD-H5-T-COV):**
  - Hint 5.0 proceeds for the runtime 25 recipes / 29 ingredients, where PR #293 F-1 found that
    22 / 22 toppings have a family and 0 / 25 recipes are uncovered.
  - The 62 / 172 gaps are **not H5-1 blockers**. PR #293 F-6: 96 topping ids plus 8 tokens have no
    taxonomy, and 0 new family ids are required.
  - The 62 / 172 gaps are handled when those ingredients enter production, through the HCG
    (OD-TAX-7). PR #293 F-4 recommends that the HCG decide **category** as well as family.
- **No silent fallback (PR #293 F-2).** The DH4 coarsening of a missing family is not reused by
  Hint 5.0. A missing classification at runtime is `NOT_A_TARGET` (0 Pitz, no fact, a uniform
  line), and the gates make that state unreachable in production (INV-T6).

**Required invariant (H5-INV-7):**

> **If a hint-eligible sub-topping enters production, it must have a valid hint taxonomy.**

"Hint-eligible sub-topping" means:
- any id in any production `RECIPE_HINT_ROLES[*].hintSubToppingOrder`; and, defensively,
- any runtime `category === "topping"` ingredient (a topping can become a sub-topping in the
  next recipe).

| Gate | Enforced by | Effect |
|---|---|---|
| **G1** | Unit test: every runtime topping has a family id among the 7 | Failure names the ids. An unclassified topping cannot merge. |
| **G2** | Unit test: every id in every `hintSubToppingOrder` has a family, and `subToppingClass` returns a family for it | A missing row → `NOT_A_TARGET` at runtime (fail closed, no charge). The gate makes it a CI failure first. |
| **G16** | A fixture test over the 62-catalog / 172 ids: roles built from the matrix rows; ids without a row must fail closed (never guessed) | Proves that expansion cannot silently ship an unclassified topping |
| **G18** | Unit test: no `HINT_CLASS_DISPLAY` emoji equals any catalog ingredient's emoji | H5-INV-2 |
| **G22 (G-REC-1)** | Unit test: every `requiredIngredients` id of every production recipe exists in `INGREDIENTS` (INV-T3). This closes PR #293 F-3; the gap exists today. | A recipe cannot carry an id that G1 never sees |
| **G23 (G-UNKNOWN / no silent fallback)** | Unit test: an unknown, hostile or row-less id (`__proto__`, `""`, a synthetic topping without a row) given to the Hint 5.0 answer is `NOT_A_TARGET`, with 0 Pitz and no fact. It is **never** existence, group or category (INV-T6). The G4 sweep also asserts that no production state ever reaches `NOT_A_TARGET`. | Missing-classification → existence is impossible in Hint 5.0 |
| **G24 (INV-T2)** | Unit test: `TOPPING_FAMILY_ROWS` ids are unique, each is in `INGREDIENTS`, and each has category `topping` | "Exactly one" family |
| **P-HCG (process)** | PR checklist: a new ingredient's family row cites its OD-TAX-7 decision. NEEDS_REVIEW rows (garlic, capers and black-olive at runtime) keep their current DH4-1 value until the HCG decides. | Keeps PR #255's review queue authoritative |

## 12. TQ-1D: Technique leak and the re-audit tripwire

- **The leak.** `no-sauce` displays as 「ソースなし」. An empty SAUCE rung is RESERVED (§5.3).
  H5-3 / H5-4 do not enable Hint 5.0 for such a target (H5-INV-4).
- **The tripwire (kept and extended).** `deductionProduction.gate.test.ts` fails on purpose when a
  production recipe needs a Technique or is not single-sauce. H5-1 adds the same tripwire to the
  Hint 5.0 production gate (**G7**). Two conditions trip it:
  - a production recipe with `requiredTechniquesOf(recipe).length > 0`;
  - a sauce count ≠ 1.

  When it trips, the test fails with 「TQ-1D (or the recipe PR) must re-audit Hint 5.0 privacy and
  decide OD-H5-P4 before shipping this recipe」. It is never weakened to pass. Since round 6 the
  decision it names is **OD-H5-P4-SAUCE** (TQ-1D).
- **The classification carries no Technique identity.** Families are identity only (OD-TAX-6).
- **Nothing in TQ-1D, #289 or #275 / #260 is changed.**

## 13. Test / gate matrix (final)

| # | Gate | Layer | Phase |
|---|---|---|---|
| **AC-1 / G4** | **The last unclassified sub-topping is still classified.** For every target with ≥ 1 sub, with all other rungs owned (including legacy `ing:` names of the other subs), at its own ladder step and all-owned: ANSWERED, one `cls:` fact, a family label | pure + reducer sweep | H5-1 (pure), H5-2 (reducer) |
| G1 | Every runtime topping has a family | data | H5-1 |
| G2 | Unknown taxonomy fails closed (`NOT_A_TARGET`, 0 Pitz, no fact) | pure | H5-1 |
| G3 | Every sub-topping of every target produces a classification | pure sweep | H5-1 |
| G5 | Class lines never contain any ingredient `nameJa`, id or emoji (all catalog ingredients scanned) | pure | H5-1 |
| G6 | No recipe identity (name / id / description / image) in the view model, DOM, aria, `data-*` or img | view model (H5-1), App + e2e (H5-3) | H5-1 / H5-3 |
| G7 | Technique tripwire (§12) plus no Technique string in any rung | production gate | H5-1 |
| G8 | Purchases persist across reload. No recharge after reload. | App (real save) | H5-3 |
| G9 | A stale or double request (`expectedRungIndex`) and insufficient Pitz are not charged. Refusals are uniform across targets. | pure (H5-1), reducer (H5-2) | H5-1 / H5-2 |
| G10 | No-fact outcomes (ALREADY_KNOWN, RESERVED_EMPTY_RUNG, the ladder complete) are not charged | pure / reducer | H5-1 / H5-2 |
| G11 | The Hint 3.0 材料 ESC and the DH4 5 / 5 paths are unchanged for non-Hint-5.0 targets | reducer | H5-2 |
| G12 | Legacy saves: every row of the §9.1 table, including `attr:group` / `category` staying archive-only and `attr:family` mapping only under its condition | pure + persistence | H5-1 / H5-2 |
| G13 | Unknown and future ids (including `cls:` in an old build) survive load and write | persistence | H5-2 |
| G14 | Full Reset clears both ledgers | App | H5-3 |
| G15 | FREE LEAK: before rung 4 is owned, every target's presentation is identical given the same owned rungs and balance. The price depends on the rung kind only. | pure sweep | H5-1 |
| G16 | Future 172 fixture gate (§11) | fixture | H5-1 |
| G17 | Authored fields: `hintKeyToppingId` is a topping of the recipe or null (null only when the recipe has no topping); `hintSubToppingOrder` is exactly the recipe's toppings minus the key, with no duplicates; every `RecipeId` has an entry (compile-time) | data | H5-1 |
| G18 | Display emoji never equals any ingredient emoji; labels come from the fixed table | data | H5-1 |
| G19 | Empty fixed rung → `RESERVED_EMPTY_RUNG` (no charge, no fact, no line). The production enable list excludes such targets while P4 is reserved. | pure (H5-1), production gate (H5-4) | H5-1 / H5-4 |
| G20 | P3: a recipe with 0 sub-toppings has exactly 4 rungs, and the next is the generic completion | pure | H5-1 |
| G21 | Dex-0 Margherita: every rung is free and nothing is persisted (OD-HE-5) | pure / reducer | H5-1 / H5-2 |
| G22 | G-REC-1: every recipe ingredient id exists in `INGREDIENTS` (INV-T3) | data | H5-1 |
| G23 | No silent fallback: a missing classification → `NOT_A_TARGET` (0 Pitz, no fact), never existence / group / category. Unreachable in production. | pure + sweep | H5-1 |
| G24 | `TOPPING_FAMILY_ROWS`: unique, in the catalog, topping only (INV-T2) | data | H5-1 |
| G-PRICE | The P-C table (10 / 10 / 10 / 5 / 5). The price depends on the rung kind only. No cap. Empty / known / complete / onboarding rungs are 0 and never charged. | pure (H5-1), reducer (H5-2) | H5-1 / H5-2 |

## 14. H5-1 implementation scope (concrete; not started)

**Goal:** the pure, **unwired** Hint 5.0 layer and its data gates. It has **no** reducer, sheet,
save writer or flag.
- The P-C table may be declared as data (`HINT5_RUNG_PRICE`) and pinned by G-PRICE.
- `requestHint5Rung` still takes the price as an input, the DH4-2A pattern, so the wiring stays
  in H5-2.
- H5-1 also amends the `ingredientTaxonomy.ts` header comment, a comment-only change. It will
  state that DH4's "no row → category" coarsening does not apply to Hint 5.0 (PR #293 F-2).
- Gates G22 / G23 / G24 are included.

**New files:**

| File | Contents |
|---|---|
| `src/data/recipeHintRoles.ts` | `RecipeHintRoles`, `RECIPE_HINT_ROLES` (25 entries, §6.1, after OD-H5-C1a) |
| `src/data/hintClassDisplay.ts` | `HINT_CLASS_DISPLAY`: the §7 table (OD-H5-C4 final), pinned by G18 |
| `src/logic/discovery/hint5Ladder.ts` | `recipeHintRoles(recipeId)`; `hint5Rungs(recipeId, context)`; `subToppingClass(recipeId, ingredientId)` (fail closed); `hint5Ownership(recipeId, storedFactIds, legacyPurchases)` (the §9.1 read-time mapping); `requestHint5Rung({ recipeId, context, storedFactIds, legacyPurchases, expectedRungIndex, rungPrice, pitzBalance })`, which returns `ANSWERED \| ALREADY_KNOWN \| RESERVED_EMPTY_RUNG \| LADDER_COMPLETE \| REJECTED(reason)` in the fixed evaluation order target → rung → price → STALE → balance → answer; `hint5Presentation(...)`, the privacy-safe view model (§8) |

**New tests:**
- `hint5Ladder.test.ts`
- `hint5Ladder.migration.test.ts`
- `hint5Production.gate.test.ts` (AC-1/G4, G3, G5, G7, G15, G17–G20)
- `hint5Taxonomy.gate.test.ts` (G1, G2, G16, G18)

**Reads (never changes):**
- `ingredientTaxonomy.ts`
- `ingredients.ts`
- `recipes.ts`
- `deductionHint.ts` (`INGREDIENT_TOTAL_FACT_ID`, `legacyOwnsIngredientTotal`)
- `hintFactMigration.ts`
- `techniques` detection (the G7 tripwire)

**Out of scope for H5-1:**
- the reducer, `discoveryHint.ts` and the HintSheet;
- persistence code, which already supports `cls:`;
- prices;
- the DH4 / Hint 3.0 modules and their tests (untouched);
- any taxonomy row;
- TQ-1D, #275 and #260.

**H5-1 entry conditions:**
- ~~OD-H5-C1a~~ (round 3) and ~~OD-H5-C1b~~ (round 4) are approved.
- The Owner's go was given in round 4, so **H5-1 is started**.
- **H5-1 is implemented and unwired.** See
  `docs/reports/TETO_DISCOVERY-HINT-5_H5-1_Pure-Layer_Result.md`. Two implementation notes:
  - the display field is `symbol`, not `emoji`, so the IngredientGlyph render-site guard stays
    as it is;
  - the DH4 import-boundary tests list the Hint 5.0 readers explicitly.
- **H5-3 is implemented** (the ladder sheet, M3, E2E and HV). See
  `docs/reports/TETO_DISCOVERY-HINT-5_H5-3_Ladder-UI_Result.md`.
  - The flag stays OFF in every build.
  - A DEV-only localStorage opt-in (`teto.dev.hint5Ladder`) exists for E2E and HV, and is compiled
    out of production.
- **H5-2 is implemented behind `HINT5_LADDER_ENABLED`**, which is **off in every build**. See
  `docs/reports/TETO_DISCOVERY-HINT-5_H5-2_Reducer-Flag_Result.md`.
  - The P-C economy re-run matches §10 exactly.
  - A legacy `ing:*` FREE LEAK in the §9.1 settle rule was recorded as OD-H5-M3. It was **approved as D in round 5** (§9.0). The
    recommendation is free-on-request settlement for name rungs. It must be decided before H5-3.
- The Owner's explicit instruction to start H5-1.

**Already decided for H5-1:** E1 / E2 (P-C, no cap), C4 (the §7 display table) and T-COV (§11).

**Needed before the later phases:**

| Decision | Needed by |
|---|---|
| ~~OD-H5-P4 / P4b and OD-H5-M2~~ | Decided in round 6 (§2, §5.3). Only OD-H5-P4-SAUCE stays open (TQ-1D). |

**Later phases (unchanged from the audit):**

| Phase | Scope |
|---|---|
| H5-2 | Request wiring in `discoveryHint.ts` and the reducer, behind a flag; economy simulation |
| H5-3 | HintSheet ladder UI behind the flag, with Human Verification (390×844) |
| H5-4 | Production enablement: the Fresh Gate on real data and the Owner's iPhone Human Verification |

## 15. Open items after H5-0 (round 2)

| ID | Question | Needed by |
|---|---|---|
| OD-H5-P4-SAUCE | The "no sauce" answer: needs a TQ authority decision (P2 / P6, PR #293 K3) | TQ-1D |
| Production activation | Turning the production flag ON (Preview + the Owner's iPhone HV) | after H5-4 |

**Closed in round 6:** P4-CHEESE, P4b, M2 (all 25), RETIRE.

**Closed in round 2:**
- E1 / E2: P-C, no cap.
- E3b: no courtesy classification.
- M1: no free-key carry-over.
- C4a / C4b: 7 families, display only, emoji invariant.
- T-COV.

**Recorded, but not H5 blockers.** These are PR #293's owner items for the HCG track (OD-TAX-7):
- OD-A: HCG scope = category + family + canonicalization;
- OD-B: the `other` copy;
- OD-C: condiment placement.

## 16. Human Verification plan (H5-3 / H5-4)

The Fresh Audit §18 scenarios A–F stand. They are updated as follows:
- **A (meat-lovers):** the 3rd — the **last** — sub-topping shows 🥩 肉系. This is the AC-1 demo.
- **B (pepperoni):** 4 rungs, then the completion line (P3).
- **C (round 6):** a no-cheese target (marinara) shows the normal 「チーズ」 rung at 10 Pitz, and
  「チーズ：なし」 only after the purchase. quattro-formaggi does the same for 「キートッピング」.
- **D:** a legacy save, following the §9.1 rows.
- **E:** no charge on insufficient Pitz or a double tap.
- **F:** layout at 390×844 and 360×800.

The video is delivered directly and never committed. Screenshots go under
`docs/reports/screenshots/hint-5-ladder/`.
