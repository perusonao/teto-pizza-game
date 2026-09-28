# Hint 5.0 — Sub-topping Classification Ladder: Fresh Audit

**Status: audit and design only. NOT an authority.** No production code was changed, and nothing
here is an Owner Decision. Every item marked **OD-H5-x** is an open question for the Owner.

- **Audited `main`:** `86b48fd51423a8f76db5398ab88ecfd944e2ae10`, the PR #291 merge (DH4-PROD).
  It was fetched fresh for this audit; older SHAs in the handoff doc were not used.
- **Machine-readable coverage snapshot:**
  `docs/reports/data/TETO_HINT-5_TAXONOMY-COVERAGE_Fresh-Audit.json`
- **Issue:** #292.
- **This is a new, independent track.** It is not a follow-up fix to PR #291 / Issue #290, which
  are merged and complete.

---

## 0. Owner Goal (restated)

The goal is **not** to have a hint give away the name of the last topping.

The goal is that **every sub-topping, down to the very last one, can get at least a
classification hint** (for example 「🥩 肉系のトッピングだよ」). The player then works out the
ingredient from that classification, so the deduction stays part of the game.

---

## 1. Current `main` SHA

`86b48fd` — Merge PR #291 (DH4-PROD: 構成 / 特徴 enabled in production at a fixed 5 / 5 Pitz).

## 2. Related Issue / PR state (fetched 2026-09-28)

| Item | State | Relevance |
|---|---|---|
| #290 / PR #291 DH4-PROD | CLOSED / **MERGED** (13:15Z) | Current production baseline. Not changed by this audit. |
| #253 Discovery Hint 4.0 | OPEN (parent) | Owns 構成 / 特徴 and the k ≥ 2 authority |
| #238 Discovery Hint 3.0 | OPEN | Owns 材料 facts, Rule W, the free key and ESC pricing |
| **PR #255** (172 taxonomy audit, OD-TAX-1..9) | **OPEN**, docs only | The closest existing taxonomy authority. OD-TAX-4 / -5 conflict with the Owner's candidate direction (§6). |
| PR #289 TQ-1C | MERGED | Techniques runtime is wired but inert (INV-TQ-4) |
| TQ-1D | **No issue exists yet** | Must re-run the DH4 gate (OD-DH4-PROD-1 contract) |
| PR #275 (#256), #260 | OPEN | Not touched |
| Duplicate search | Searched for hint classification / sub-topping / ladder / 分類 / 最後の材料 | Only #253, #238, #283 and #229 came up. **None covers this goal**, so a new issue is justified. |

---

## 3. Current behavior

A Free Cooking target recipe has three hint families today:

| Family | What it tells the player | Price | Authority |
|---|---|---|---|
| **材料** (`ing:<id>`) | The name of one ingredient: the next unrevealed one in the preferred category (sauce / cheese / topping) | ESC 5 / 10 / 20 / 40, capped at 35 / 75 per recipe | OD-H3-4 / -5 / -14 |
| **構成** (`meta:ingredient-total`, `meta:topping-total`) | The ingredient total. The topping total only when TC-G allows it. | Fixed 5 | OD-DH4-2-1, OD-DH4-PROD-1 |
| **特徴** (`attr:family\|group\|category:*`) | The class of **one** ingredient only, the **Rule W reserve** | Fixed 5, sold once | OD-DH4-3 / -5, OD-DH4-2-2 |

**Free key.** `hintKeyIngredientId` is the latest-unlocked ingredient on the Discovery Ladder
(`recipeKeyStep`). It is shown for free.

**Rule W reserve.** `reservedIngredientId` is chosen as follows:
- take the last non-key ingredient, in `requiredIngredients` order,
- of the highest-ranked category present (topping > cheese > sauce).

It is **never** sold by name.

So, as long as the 材料 cap allows it, every sub-topping **except the reserve** can already be
bought **by name**. The one ingredient that can never be named is the reserve, which is exactly
the "last remaining sub-topping" in the Owner's report. The only channel that says anything about
it is 特徴.

## 4. Root cause

### 4.1 Code path

1. `requestDeductionHint("attribute")` (`src/logic/discovery/deductionRequest.ts`) calls
   `guardedReserveAttributeAnswer` (`deductionGuard.ts`).
2. `guardedAnswerForParts` = `partitionAllowsDh41 ? DH4-1 answer : strictAnswerForParts`.
   - `hypotheticalReserves` (H) contains only owned ingredients that satisfy all of these:
     - they are in the T1a `makeablePrefix`;
     - they are Rule W–consistent;
     - they are key-consistent.
   - Every answer class over H needs **≥ 2 members on each category side**.
   - If a level fails, the answer coarsens: family → group → category → **existence**.
3. `EXISTENCE_ONLY` charges 0 and stores nothing. The sheet then shows
   `attributeNothingYet`: 「今はまだ、大きな手がかりが見つからなかったよ…」.

### 4.2 Measured: the 300 production ladder states

Method: each of the 24 targets, at its own ladder step and at every later step (the same sweep
`deductionProduction.gate.test.ts` uses). The measurement ran as a throwaway script and was not
committed.

| Answer level | Topping reserve | Cheese reserve | Sauce reserve | Total |
|---|---:|---:|---:|---:|
| **family** (e.g. 肉) | **0** | – | – | **0** |
| group (e.g. 野菜・果物) | 13 | – | – | 13 |
| category (「まだわかっていないトッピングがあるよ」) | 117 | 44 | 3 | 164 |
| **existence** (no hint, no charge) | 76 | 47 | – | **123 (41 %)** |

- Across the whole production ladder, the 特徴 hint **never** produces a family-level answer.
- 41 % of states produce **nothing**.
- The remaining 59 % mostly produce the category line ("there is a topping you don't know yet").
  The player already knew that from Rule W, so it adds no real information.

Per recipe, at every step the answer is **existence** for these 11 recipes:
- bismarck, funghi, bambino, hawaiian, marinara, napoletana, tonno-e-cipolla;
- new-haven-apizza, pesto-caprese, pesto-patate, quattro-formaggi.

### 4.3 Why, in authority terms

| Cause | Authority |
|---|---|
| The reserve can never be named | Rule W / n−1 cap (OD-H3-5, Hint 2.0 A-4) |
| Only **one** class answer exists, and only about the reserve. Other sub-toppings have no classification channel; they get the name or nothing. | OD-DH4-3 / -5 |
| k ≥ 2 **per category side**, over the **makeable-prefix** hypothetical set H. With a 22-topping runtime table, H rarely holds 2 same-family decoys, so the answer coarsens. | OD-DH4-2-2, OD-DH4-3 (`MIN_ATTRIBUTE_CANDIDATES = 2`), T1a, OD-TAX-4 |
| A reserve outside H fails closed to existence | OD-DH4-2-2 hardening (P2-1) |
| An existence answer is a no-charge "no fact" | OD-DH4-2-4 |

**Conclusion.** Nothing is broken. The guard does what it was specified to do. With a small
owned inventory, **the k ≥ 2 privacy rule structurally rules out a classification about the last
ingredient**. The Owner Goal can only be met by an authority change, not a bug fix.

---

## 5. Ingredient taxonomy coverage

The taxonomy authority is `src/data/ingredientTaxonomy.ts` (DH4-1):
- 7 families: 肉 / 魚介 / 野菜・きのこ / 果物 / ハーブ・香味 / スパイス・薬味 / その他;
- 4 groups;
- topping only (sauce and cheese are classed by category).

| Population | Ingredients | Toppings | Classified (has a family) | Unclassified | Ambiguous (NEEDS_REVIEW) |
|---|---:|---:|---:|---:|---:|
| **Runtime** (`src/data/ingredients.ts`) | **29** (sauce 3, cheese 4, topping 22) | **22** | **22** | **0** | **3**: garlic, capers, black-olive (PR #255 §16) |
| Seen as a sub-topping in a runtime recipe | – | 12 | 12 | 0 | 2 (garlic, black-olive) |
| Master catalog (`ingredient_master_catalog.json`) | 62 (topping 42, sauce 10, cheese 10) | 42 | 19 (runtime rows) | **23** | – |
| 172 matrix (canonical ids) | 169 plus 13 unresolved tokens; 179 in the union | 123 in the union | 125 PROPOSED (PR #255, not authority) | 13 UNKNOWN tokens | 44 NEEDS_REVIEW |

Notes on the table:
- 3 runtime ids are **not** in the 62-row catalog: capers, clam and fresh-tomato.
- **No new family id** is needed at 172 (PR #255 §5). Every family has ≥ 8 members at 172.

**Answer: at runtime, yes.** Every runtime topping has a family, so "a classification hint for
every sub-topping" is **data-complete today**. It is **not** complete for the catalog or the 172
expansion: 23 catalog toppings and all non-runtime 172 ids have no production row, and OD-TAX-7
(the Human Classification Gate) is still pending.

### 5.1 Proposed taxonomy (recommendation)

**Keep DH4-1's 7 family ids** (OD-TAX-2). Do not create a new display taxonomy.

| Question | Recommendation |
|---|---|
| mushroom | Keep it in 野菜・きのこ. A きのこ class is a singleton ≈ an ingredient name at runtime and 105 (PR #255 §8). |
| herb vs vegetable | Keep ハーブ・香味 separate. It has 4 runtime members. The garlic boundary is OD-TAX-7. |
| egg | Internal `other`. **The display copy must not be 「その他」** (OD-TAX-8). At runtime `other` = {egg}, so a family label here *is* the name. See the privacy decision in §11. |
| olive | vegetable, as now (NEEDS_REVIEW) |
| pineapple / fruit | fruit is a runtime singleton, so the fruit label names pineapple. Same privacy decision (§11). |
| cured meat / sausage | All `meat`. Subfamily (`meat.cured`) is internal only (OD-TAX-3). |
| seafood | `seafood` (anchovy / tuna / clam) |
| **cheese (including several cheeses)** | Named by the cheese rung, not by the family ladder. See §8, quattro-formaggi. |
| no sauce / no cheese | These are **not** taxonomy questions. They are ladder-shape and Technique questions (§8, §12). |
| late topping / post-bake | **Not a family** (OD-TAX-6). That is Technique / Cooking Steps. |
| unusual future ingredients | Add one row per ingredient, in the same PR that adds it to `ingredients.ts`. An id with no row **fails the gate** (§14); it is never guessed. |

**Emoji / copy (proposal).** 🥩 肉 · 🐟 魚介 · 🥬 野菜・きのこ · 🍍 果物 · 🌿 ハーブ・香味 ·
🧂 スパイス・薬味 · ✨ ちょっと変わった材料 (OD-TAX-8 candidate). Final copy is an Owner / UI
decision.

### 5.2 Machine-readable coverage table (design)

`docs/reports/data/TETO_HINT-5_TAXONOMY-COVERAGE_Fresh-Audit.json` is the snapshot. Each row
carries:
- `id`, `category`, `hintEligibleAsSubTopping`, `observedAsSubToppingIn[]`;
- `family`, `group`;
- `status`: `CLASSIFIED`, `CLASSIFIED_NEEDS_REVIEW` or `NOT_APPLICABLE_CATEGORY_ONLY`.

The production gate should derive this table from `src` (not from this JSON) and assert:
- `UNCLASSIFIED == 0` for `category === "topping"`;
- every family has `MIN_FAMILY_SIZE` members, **if** the Owner keeps a size rule (OD-H5-P2).

---

## 6. Authority conflicts

Adopting the Owner's candidate direction ("a classification may narrow the candidates to one, as
long as the name itself is never shown") touches these authorities.

| # | Authority | What it says now | Conflict |
|---|---|---|---|
| C1 | **OD-DH4-3** (`MIN_ATTRIBUTE_CANDIDATES = 2`), **OD-DH4-2-2** partition guard, **OD-TAX-4** ("Keep k ≥ 2") | A class answer must leave ≥ 2 worst-case candidates | **Direct.** A classification that is always shown means k may be 1. OD-TAX-4 is an Owner-approved decision (PR #255), so the Owner must supersede it explicitly. |
| C2 | **OD-TAX-5** (never sell the whole taxonomy signature; one fact per hint) | The full family multiset makes 60 % of runtime recipes unique (PR #255 §13) | **Direct.** A classification for *every* sub-topping, plus names for sauce / cheese / key and the total, **is** the full signature. |
| C3 | **OD-DH4-3 / -5** (特徴 is about the Rule W reserve only, single-shot) | One attribute answer per recipe | A classification per sub-topping is a new family of facts |
| C4 | **OD-H3-5 Rule W / Hint 2.0 A-4 (n−1 cap)** | At most `distinct − 1` names, and the reserve is never named | Candidate Hints 1–3 name sauce + cheese + key. **8 / 25 recipes have 0 sub-toppings, so every ingredient would be named**: margherita, quattro-formaggi, genovese, bismarck, funghi, salsiccia, pepperoni, pizza-bianca. |
| C5 | **OD-H3-6 / -13** (the key is free) | The free key may be a sauce or a cheese | The candidate Hint 3 is a paid "キートッピング", a concept that does not exist (§9) |
| C6 | **OD-H3-7 / -15** (no negative fact) | No "not used", no count-0 statements | A fixed "Hint 2 = cheese" rung on a cheeseless recipe needs 「チーズは使わない」 (a negative fact) or a visibly skipped rung (a free leak). The same applies to sauce. |
| C7 | **OD-H3-16 / OD-DH4-10** (FREE LEAK) | Before purchase, every target must look the same | A dynamic ladder that **shows** Hint 5..N before purchase leaks the sub-topping count for free |
| C8 | **OD-H3-14** (category preference) and the 3-card UI (DH4-2C) | 材料 / 構成 / 特徴 | Replaced if a single ladder is adopted (§10) |
| C9 | **OD-H3-4** ESC and cap; **OD-DH4-PROD-1** fixed 5 / 5; **OD-HE-7** ("No H5") | Existing prices | Every price must be re-decided (§11). The Hint 2.0 level name "H5" is legacy, and the new copy must avoid it. |
| C10 | **T1a** (purchase timing) | Only the makeable prefix feeds H | Irrelevant if the classification has no k rule. Keep it if a k rule survives. |
| C11 | **OD-TQ1C-2** (near-miss SAUCE_ONLY k ≥ 2), TQ-1D gate | – | A "sauce rung" on a NO_SAUCE recipe leaks the Technique (§12) |

### 6.1 Privacy invariants: what changes and what does not

| Invariant | Status under the Owner candidate |
|---|---|
| **INV-A: never display an ingredient name or id before it is purchased as a name** (DOM, aria, `data-*`, img alt, title) | **KEEP** (hard) |
| **INV-B: never display a recipe's name, id, description or image** | **KEEP** (hard) |
| **INV-C: never display a Technique's name or id before it is discovered** | **KEEP** (hard) |
| **INV-D: FREE LEAK.** The pre-purchase presentation is identical for every target. | **KEEP** (hard). It constrains the ladder UI (§10). |
| INV-E: k ≥ 2 on class answers | **CHANGE** (Owner decision OD-H5-P1). Paid deduction may reach k = 1. |
| INV-F: no full signature sold | **CHANGE** (OD-H5-P1) |
| INV-G: n−1 name cap | **RE-DECIDE** (OD-H5-P3) |

### 6.2 The boundary, written down (proposal)

> **Deduction ≠ disclosure.** A hint may give facts from which the player can *deduce* an
> ingredient or even the whole composition (PAID INFERENCE). A hint must never *display* an
> undisclosed ingredient's name, a recipe's identity (name / id / description / image) or an
> undiscovered Technique's identity, in any surface: text, DOM attributes, aria, `data-*`, image
> alt / src, test ids or logs shown to the player. A classification label is always one of the
> fixed family labels and is never derived from, or equal to, a single ingredient's name.

**Measured consequence.** Suppose, at each recipe's own ladder step, the player buys the whole
candidate ladder: sauce, cheese and key names, the total, and every sub-topping family. Then
**12 / 25 runtime recipes are pinned to exactly one composition**, and the rest have 2–96
compositions. Under the Owner's direction this is acceptable, because recipe identity is still
never *displayed*. The Owner should accept it knowingly (OD-H5-P1).

---

## 7. Recommended Hint 5.0 architecture

**A data-driven "hint role" ladder.** It is built from **two new authorities**, with no
per-recipe `if`.

1. **`recipeHintRoles(recipe)`**, pure, derived from recipe data plus one authored field.
   It returns ordered rungs:
   ```
   SAUCE_NAME(s)   – 0..n  (one per sauce; none on a no-sauce recipe, see §12)
   CHEESE_NAME(s)  – 0..n  (one per cheese; quattro-formaggi has 4)
   KEY_TOPPING     – 0..1  (authored, §9)
   STRUCTURE       – 1     (the existing 構成 answer)
   SUB_CLASS[i]    – one per sub-topping = toppings − key topping, in authored order
   ```
2. **The ingredient taxonomy authority**, the existing DH4-1 table, extended by one row per new
   ingredient. It has a hard coverage gate (§14).
3. **The answer function** `subToppingClass(recipe, i)`:
   - returns `{ family }` from the table, or **fails closed** (`NOT_A_TARGET`, no charge) if the
     row is missing;
   - never returns a name;
   - applies no k rule (if the Owner approves OD-H5-P1).

**Why not reuse the 特徴 guard?** It is designed to *not* answer (§4). Keep it untouched, as the
DH4 authority for any recipe still on the Hint 4.0 path during migration.

**Fact ids.** Keep the existing grammar `<kind>:<value>[:<qualifier>]`. No schema bump.

| Rung | Stored id | Note |
|---|---|---|
| sauce / cheese / key name | `ing:<ingredientId>` | The existing kind. A migrated 材料 purchase of the same ingredient is already this id. |
| structure | `meta:ingredient-total` (+ `meta:topping-total`) | Existing ids |
| sub-topping classification | **`cls:<ingredientId>`** (recommended) | Keyed by ingredient, not by ordinal, so a reorder of the authored list never mis-assigns a purchase. The id lives only in the save, as `ing:` already does, and is **never rendered**. The DOM shows only the family label. |

**Rejected alternative:** `cls:<ordinal>:<family>`. It is fragile to recipe edits, and it encodes
the answer in the id.

---

## 8. Ladder shape: edge cases that must be decided

| Case | Runtime example | Issue | Options |
|---|---|---|---|
| 0 sub-toppings | pepperoni (sauce, cheese, key) | Hints 1–3 name all 3 (C4) | (a) accept: the ladder names everything; (b) keep Rule W: the last name rung becomes a classification; (c) drop the key-topping name rung and classify it instead |
| No cheese | marinara, pizza-bianca, pesto-tonno, puttanesca | A cheese rung has nothing to say (C6) | (a) omit the rung, visible only **after** STRUCTURE is bought; (b) a neutral rung that is never charged; (c) move the cheese rung after STRUCTURE |
| Several cheeses | quattro-formaggi (4) | A single "cheese name" rung is ambiguous | One rung per cheese, in authored order |
| Sauce is the key | fugazza (olive-oil), pesto-tonno (pesto) | The current free key is not a topping | See §9 |
| Cheese is the key | quattro-formaggi, parmigiana | Same | See §9 |
| No sauce (future NO_SAUCE) | Aussie (TQ-1D) | A sauce rung leaks the Technique (§12) | See §12 |
| Repeated family among sub-toppings | meat-lovers (3 × 肉), capricciosa (2 × 野菜), pesto-tonno (2 × 野菜) | Each rung repeats the same label | Allowed; the rungs say ① / ② / ③ |
| Final remaining sub-topping | All | **Must still classify** (the Owner Goal) | The core regression test (§14) |

**Recommendation.** Place the dynamic parts (the cheese count, the sub-topping count) **after**
STRUCTURE. Before STRUCTURE is bought, every target shows the same fixed rungs 1–4 (INV-D). After
STRUCTURE, the total is known (it was paid for), so revealing the number of remaining rungs is
paid inference.

## 9. Key topping

**It does not exist today.** The free key (`hintKeyIngredientId`) is "the latest-unlocked
ingredient on the Discovery Ladder" and is **not** a topping in 4 / 25 recipes:
- fugazza → olive-oil;
- pesto-tonno → pesto;
- quattro-formaggi → gorgonzola;
- parmigiana → parmigiano.

Margherita has no key at all (starter-only).

| Candidate authority | Pro | Con |
|---|---|---|
| **A. Authored field on `Recipe`** (e.g. `hintKeyToppingId`), validated by a gate: it must be a topping of the recipe, or `null` | Explicit, reviewable, and stable across ladder retunes. Scales to 172 through the authoring tool. | Needs authoring for 25 (172) recipes |
| B. `requiredIngredients` order (the first topping) | Zero authoring | An accidental implementation detail becomes authority. **Rejected** (Owner instruction). |
| C. Mechanic identity (the 172 matrix `mechanicEvidence`) | Semantically "what makes this pizza" | Not defined for runtime recipes, and it mixes Technique into identity (OD-TAX-6) |
| D. The existing ladder key, if it is a topping | Reuses today's free key | Undefined for 5 recipes. It moves when the ladder is retuned. |

**Recommendation: A.** Seed it from D where D is a topping. The 4 non-topping keys (and
margherita) get an explicit Owner/author choice, or `null` (no key-topping rung). The ordering of
sub-toppings is **also** authored (`hintSubToppingOrder`), for the same reason, and pinned by a
gate that requires it to be a permutation of the recipe's non-key toppings.

**The free-key price** (today free, OD-H3-6) is part of OD-H5-C2 (§11).

---

## 10. UI: keep the 3-card choice, or a single ladder?

| | **Keep 材料 / 構成 / 特徴** (3 cards) | **Single ladder** (Hint 1 → 2 → 3 → …) |
|---|---|---|
| "What am I buying?" (the Owner's priority) | Weak. 「材料」 returns an unchosen ingredient, and 特徴 can return nothing. | **Strong.** Every rung has a fixed label: 「ヒント5: サブトッピング①の分類」. |
| FREE LEAK | Already audited | Safe only if the rungs after STRUCTURE are revealed after it is bought (§8) |
| Existing purchased facts | Unchanged | Map onto rungs (§11). Nothing is lost. |
| Pricing | The existing ESC and fixed prices | Must be re-decided (§11) |
| Player agency | The category preference | None (a fixed order). Agency moves to the deduction itself. |
| Implementation cost | Add a 4th card, 「分類」 | A new presentation model plus the HintSheet panel. The existing sheet shell and the known-fact board can be reused. |
| Risk | Two overlapping "class" channels (特徴 and 分類) | Retires 特徴 (it is superseded) |

**Recommendation:** the single ladder, with **only the next rung purchasable** and every owned
rung shown on the board. The UI style itself is **OD-H5-U1** (not decided here).

---

## 11. Owner Decisions required

### Privacy

- **OD-H5-P1:** supersede OD-TAX-4 / OD-DH4-3 / OD-DH4-2-2 **for sub-topping classification**.
  The classification is always answered at family level with no k rule, and the full signature
  may be sold (OD-TAX-5). The hard invariants INV-A..D are kept. The §6.2 boundary text is
  adopted.
- **OD-H5-P2:** does a **family-size floor** remain? For example, "a family label that has
  exactly 1 member in the runtime catalog is shown at group level".
  - Today that affects fruit = {pineapple}, spice = {capers} and other = {egg}.
  - Without a floor, 「果物」 is effectively the name "pineapple", but it is still not
    *displayed* as the name.
- **OD-H5-P3:** the n−1 name cap and Rule W for recipes with 0 sub-toppings (§8, C4).
- **OD-H5-P4:** negative facts for the no-cheese / no-sauce rungs (C6).

### Content and authority

- **OD-H5-C1:** adopt the authored key topping (§9 A) and the authored sub-topping order.
- **OD-H5-C2:** is the key-topping rung **free** (today's free key) or paid?
- **OD-H5-C3:** after a sub-topping's classification, is its **name** still purchasable (today
  it is, as a 材料 fact), except for the last one? Or is it classification only (the Owner's
  candidate ladder)?
- **OD-H5-C4:** the classification labels and emoji (§5.1), and the replacement copy for 「その他」.

### Pricing

The current prices are:
- 材料: ESC 5 / 10 / 20 / 40, capped at 35 / 75;
- 構成: 5;
- 特徴: 5.

**None of the options below is decided.**

| Option | Name rungs (sauce / cheese / key) | STRUCTURE | Each SUB_CLASS | Note |
|---|---|---|---|---|
| **P-A** (family parity) | Material ESC 5 / 10 / 20 / 40 | 5 | fixed 5 | Closest to today. Every existing price is kept. |
| P-B (one ladder ESC) | the rung index on 5 / 10 / 20 / 40 / 40 … | (rung) | (rung) | Simple to explain. Deep rungs get expensive, so a cap would be needed. |
| P-C (flat) | 10 each | 5 | 5 each | Easiest to read |
| P-D (P-A plus a per-recipe cap) | as P-A, with the total ≤ the OD-H3-4 cap | | | Keeps the 35 / 75 parity |

**Decisions needed:**
- **OD-H5-E1:** the price table;
- **OD-H5-E2:** whether a cap applies;
- **OD-H5-E3:** whether an existing 特徴 buyer who got only a coarse answer (group or category)
  gets that sub-topping's classification **free** or pays again. The recommendation is free,
  since they paid 5 for a weak answer.

**Fixed guarantees, not options:**
- 0 Pitz never appears in production;
- no charge for owned information, stale or double requests, insufficient Pitz, or a no-fact
  result.

### UI

- **OD-H5-U1:** the 3-card choice or the single ladder (§10).

---

## 12. Migration strategy (existing saves)

**No save schema bump.** The save stays at `schemaVersion` 2:
- `discoveryHintFacts` already accepts any well-formed `<kind>:<v>[:<q>]` (`HINT_FACT_ID_PATTERN`,
  up to 64 per recipe);
- it keeps unknown ids verbatim (H3-2 forward compatibility);
- so `cls:` survives today's build and a rollback.

Existing fact ids are **reused, never rewritten**.

| Stored today | Hint 5.0 reading |
|---|---|
| `ing:<sauce / cheese / key>` | That name rung is owned |
| `ing:<sub-topping>` (a 材料 purchase) | That sub-topping is **known by name**, which is a superset of its classification. The rung shows as known and is not sold (ALREADY_KNOWN, 0 Pitz). |
| `meta:ingredient-total` / `meta:topping-total`, or the legacy 「材料は全部で○種類」 (OD-DH4-8) | STRUCTURE is owned |
| `attr:family:<f>` about the reserve | If the reserve is a sub-topping with family f, its classification is owned |
| `attr:group:*` / `attr:category:*` / (existence was never stored) | Shown in the 「以前のヒント」 archive. Whether the classification is free is **OD-H5-E3**. |
| legacy `discoveryHintPurchases` levels | The existing `legacyHintMapping` grants (unchanged) |
| Unknown / future ids | Kept verbatim (unchanged) |

- **Rollback safety:** Hint 5.0 must never delete or rewrite a stored id. It only appends.
- **Full Reset:** clears both ledgers, unchanged.

## 13. Recipe-discovery boundary check (design requirements)

The Hint 5.0 view model carries only:
- rung labels;
- family ids and labels;
- already-purchased ingredient names;
- counts that were purchased (STRUCTURE);
- prices.

It must **not** carry any of the following, **in any field**, including fields that are not
rendered:
- recipe id, name, description or image;
- `reservedIngredientId`;
- an unpurchased ingredient id;
- a technique id.

Tests follow the existing DOM / aria / `data-*` / img leak sweep in `App.hintSheet.test.tsx`
(§14).

## 14. TQ-1D impact (Fresh Check)

- **Technique** `no-sauce` has `nameJa` 「ソースなし」.
  - A sauce rung that says 「ソースは使わないみたい」, or a sauce rung that is visibly skipped,
    **states the Technique name before it is discovered** (INV-C).
  - Structure is also affected: a no-sauce recipe's total omits the sauce.
- Today no production recipe needs a technique (INV-TQ-4). `deductionProduction.gate.test.ts`
  fails on purpose when the first one appears (the OD-DH4-PROD-1 contract).
- **Hint 5.0 must extend that contract.** A recipe with an undiscovered required Technique
  **must not** get a sauce rung that reveals the absence of sauce. Options (**OD-H5-T1**,
  deferred to TQ-1D):
  - (a) the sauce rung shows the Technique's existing public riddle (「？？？」 plus `riddleJa`),
    which is already a public, non-naming clue;
  - (b) the sauce rung is replaced by a neutral, non-charging rung that is identical for all
    targets;
  - (c) no-sauce recipes are not Hint 5.0 targets until the technique is discovered.
- **The classification itself carries no Technique identity:** OD-TAX-6 keeps timing / role out
  of the families.
- **Nothing in TQ-1D, #289 or its contract is changed by this audit.**

## 15. 172-recipe compatibility

- **No recipe-specific branches.** Rungs come from `recipeHintRoles`, which is a pure function
  of:
  - the ingredient categories;
  - the authored `hintKeyToppingId`;
  - the authored `hintSubToppingOrder`;
  - the taxonomy table.
- **Authoring.** The 172 authoring tool (`tools/…`) emits both authored fields. The gates
  (§16) reject any recipe that lacks them, or whose sub-toppings lack a family.
- **Taxonomy.** One row per new ingredient, taken from PR #255's PROPOSED rows after the
  OD-TAX-7 Human Classification Gate. No new family id is needed.
- **Pre-existing blockers stay pre-existing:**
  - unresolved tokens (13);
  - multi-spread / no-sauce / post-bake recipes (Technique).

## 16. Test / gate plan

| # | Gate | Kind |
|---|---|---|
| G1 | Every runtime `topping` has a family row (`UNCLASSIFIED == 0`). It is derived from `src`. | unit, production gate |
| G2 | Unknown taxonomy fails closed: a sub-topping without a row → `NOT_A_TARGET`, 0 Pitz, no fact | unit |
| G3 | **Every** sub-topping of **every** production recipe produces a classification | production sweep |
| G4 | **The last remaining sub-topping** (all other rungs owned, including every other name) **still produces a classification**. Run it for every recipe with ≥ 1 sub-topping, at its own ladder step and with all ingredients owned. **Mandatory regression.** | production sweep |
| G5 | A classification line never contains any ingredient `nameJa` or id (all 29 names are scanned). Labels come from the fixed family table only. | unit |
| G6 | No recipe identity (name / id / description / image) in the view model, DOM, aria, `data-*` or img | App plus e2e sweep |
| G7 | No Technique name / id / riddle leak before discovery (including the sauce rung of a future no-sauce recipe) | production gate (extends the TQ-1D contract) |
| G8 | Purchased facts persist across reload. There is **no recharge** after a reload. | App (real save) |
| G9 | A stale or double request is not charged. Insufficient Pitz is not charged, and the refusal is uniform for every target. | reducer |
| G10 | No-fact (ALREADY_KNOWN, a sub-topping known by name) is not charged | reducer |
| G11 | 材料 ESC compatibility: legacy rungs are never rolled back | reducer |
| G12 | Legacy save compatibility: an Economy 1.0 ledger, Hint 3.0 `ing:`, DH4 `meta:` / `attr:` → the §12 table | persistence / migration |
| G13 | Unknown and future ids survive load / write | persistence |
| G14 | Full Reset clears every ledger | App |
| G15 | FREE LEAK: before STRUCTURE, every target renders identical rungs and prices | pure presentation sweep |
| G16 | Future 172 gate: a fixture catalog of 172-shaped recipes (from the matrix, with PROPOSED rows) passes G1–G5 and requires the authored fields. An unresolved token fails closed. | unit (fixture only) |
| G17 | Authored-field gates: `hintKeyToppingId` is a topping of the recipe or `null`; `hintSubToppingOrder` is a permutation of the non-key toppings | data gate |

## 17. Implementation phases (proposal)

| Phase | Scope | HV |
|---|---|---|
| **H5-0** | Owner Decision Gate: OD-H5-P1..P4, C1..C4, E1..E3, U1, T1 | – |
| **H5-1** | Pure layer (unwired): taxonomy coverage gate G1 / G2; `recipeHintRoles`; the authored fields on the 25 recipes (G17); the classification answer; tests G3–G5 / G16 | none |
| **H5-2** | Request authority and migration (unwired or flagged): the pricing input; the §12 mapping; tests G8–G14 | none |
| **H5-3** | Sheet UI per OD-H5-U1, behind a flag: the view model; the leak sweeps G6 / G15; layout-contract e2e | **Yes** |
| **H5-4** | Production enablement: flag on; the DH4-PROD-style Fresh Gate on real data, including G4 and the G7 TQ-1D contract | **Yes** (iPhone, Preview) |

## 18. Human Verification plan (for H5-3 / H5-4, not this audit)

This audit changes no UI. It has no video and no Preview, since audit-only tasks are exempt
under the policy.

**Viewport and delivery:** 390×844. The MP4 is delivered to the Owner directly and never
committed. Before / after screenshots go under `docs/reports/screenshots/hint-5-ladder/`.

**Scenarios:**
- **A.** meat-lovers: buy up to the 3rd sub-topping. Each shows 🥩 肉, including the last one.
  - This is the direct counter-example to today's existence-only answer.
- **B.** pepperoni (0 sub-toppings): the ladder behavior follows OD-H5-P3.
- **C.** marinara (no cheese): the rung behavior follows OD-H5-P4. There is no free leak before
  STRUCTURE.
- **D.** An existing save carrying 材料, 構成 and 特徴 purchases:
  - migrated rungs show as owned;
  - there is no recharge;
  - a reload keeps everything.
- **E.** Insufficient Pitz and a double tap: no charge.
- **F.** The HintSheet does not scroll horizontally, and the 44 px targets hold at 390×844 and
  360×800.
