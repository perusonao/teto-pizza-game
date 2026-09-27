# Discovery Hint 4.0 — DH4-1 Deduction Hint Pure Layer: Result (Issue #253)

> Status: **Implemented. The PR is OPEN for Owner review. No merge, no auto-merge.**
>
> - Pure and unwired: no UI, reducer, Pitz, save, HintSheet, near-miss or Dinner change.
> - PR #251 (H3-4) is untouched by this slice, and no DH4 code is on its branch.

## 1. Audited main / Issue / PR / HEAD

| Item | Value |
|---|---|
| `origin/main` (fresh check at start) | `726b0ac` (Merge PR #249). The same as the whole H3-4 cycle. |
| Other PRs (read-only check) | #251 (H3-4) OPEN at `1ef9b61`, clean, not merged · #252 (DM-3R-2) OPEN, not touched |
| Parent Issue | **#253** Discovery Hint 4.0: Deduction Hints. New; the Duplicate Gate found no existing DH4 / structure / attribute issue. It records OD-DH4-1…10 and the DH4-1 scope. |
| Branch | `claude/dh4-1-deduction-pure-layer`, cut from `origin/main` `726b0ac` (not from PR #251's branch) |
| PR | **#254** (`main` ← `claude/dh4-1-deduction-pure-layer`), OPEN, no auto-merge |
| Final HEAD | The commit carrying the Codex P2 fix (§10.1), on top of `0e66ba0`. The PR's Checks tab shows the exact SHA. |

## 2. Owner Decisions (Owner Authority, recorded in #253)

| ID | Decision | Where DH4-1 implements it |
|---|---|---|
| OD-DH4-1 | New phase: Discovery Hint 4.0 — Deduction Hints | Issue #253; the module names |
| OD-DH4-2 | Structure = the whole-recipe total count only. No remaining count, no category-zero. | `structureTotalFact` → `{ id: "meta:ingredient-total", total }`. There is no other count field. |
| OD-DH4-3 | The reserve's attribute, never its name, always through k ≥ 2 with coarse and existence fallback | `reserveAttributeAnswer` (§5, §6) |
| OD-DH4-4 | The ~7 merged families, a data model extensible to 105 / 172 / Technique, no (near-)singletons, toppings first | `src/data/ingredientTaxonomy.ts` (§4) |
| OD-DH4-5 | No yes/no questions. The system picks a positive attribute deterministically. | The target is always the Rule W reserve, and the level is a pure function of (recipe, owned) |
| OD-DH4-6 | The future UI is U3. Not in DH4-1. | No UI code |
| OD-DH4-7 | Near-miss unchanged. Near-miss + a purchased attribute keeps the privacy rule. | Test §9. The module never touches near-miss. |
| OD-DH4-8 | A legacy count line = the total-count hint already owned, never resold. grandfatheredSteps unchanged. | `legacyOwnsIngredientTotal`, `ingredientTotalOwned` (read-only, no schema change) |
| OD-DH4-9 | No prices. ESC unchanged. Measure information value only. | Bits in the audit (§8) |
| OD-DH4-10 | Coarser answers are PAID INFERENCE. No FREE LEAK of granularity, existence, candidate count or singleton-ness. | The answer carries no count. The level depends on (recipe, owned) only. The audit helper is test-only. |

## 3. Changed files

| File | Change |
|---|---|
| `src/data/ingredientTaxonomy.ts` | **New.** Families (7) and groups (4), a topping → family table for the 22 runtime toppings, and lookups (Map-based, hostile-safe) |
| `src/logic/discovery/deductionHint.ts` | **New.** The pure layer: `structureTotalFact`, `reserveAttributeAnswer`, `reserveAttributeAudit` (audit only), `deductionHintTextJa` (provisional copy), `legacyOwnsIngredientTotal`, `ingredientTotalOwned` |
| `src/logic/discovery/testSupport/deductionAudit.ts` | **New.** The 25-recipe audit builder. It takes the ladder as a parameter, which respects the existing ladder wiring boundary. |
| `src/logic/discovery/deductionHint.test.ts` | **New.** 27 tests (§10) |
| `src/logic/discovery/deductionHint.audit.test.ts` | **New.** Pins the machine-readable audit (`toMatchFileSnapshot`) + 2 invariants |
| `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` | **New.** The machine-readable 25-recipe audit |
| this report | |

**Not changed:**

- `selectableHint.ts`, `hintFactMigration.ts`, `persistence.ts`, `hintSteps.ts`, `hintPurchase.ts`;
- `nearMiss.ts` / `resultNearMiss.ts`;
- the reducer, `App.tsx`, `HintSheet.tsx`, CSS;
- `ingredients.ts`, `recipes.ts`, `discoveryLadder.ts`;
- every Dinner file.

## 4. Taxonomy authority (OD-DH4-4)

| Family (`AttributeFamilyId`) | Label | Group (fallback) | Runtime toppings |
|---|---|---|---|
| `meat` | 肉 | `protein` 肉・魚介 | sausage, pepperoni, bacon, ham |
| `seafood` | 魚介 | `protein` | anchovy, tuna, clam |
| `vegetable` | 野菜・きのこ | `produce` 野菜・果物 | mushroom, cherry-tomato, onion, black-olive, corn, eggplant, fresh-tomato, potato |
| `fruit` | 果物 | `produce` | pineapple |
| `herb` | ハーブ・香味 | `aroma` 香り・薬味 | basil, oregano, rosemary, garlic |
| `spice` | スパイス・薬味 | `aroma` | capers |
| `other` | その他 | `other` | egg |

**Design:**

- Data only. A new ingredient (the 105 / 172 population) adds one row, and an ingredient without a row has no family. Nothing is guessed: such an ingredient is answered at category level.
- Sauces and cheeses have no family in DH4-1; their category is their attribute.
- **egg** is in `other`, not its own class, and **mushroom** is in `vegetable`, so no family label is an ingredient name. A test asserts that no family label equals any catalog ingredient name.

**Runtime sizes:** `fruit`, `spice` and `other` have 1 member each at the 25-recipe runtime. That is safe because **the k ≥ 2 guard, not the table, decides**: those families can only be answered once an owned decoy outside the recipe exists.

**172 read-only validation** (the keyword heuristic over the 181 normalized names from the Fresh Design §7.2, mapped to these families):

| Family | Size |
|---|---:|
| meat | 20 |
| seafood | 17 |
| vegetable (incl. きのこ 3 + 32 unmatched) | ~35 |
| fruit | 11 |
| herb | 11 |
| spice | 18 |
| other (たまご 1 + ナッツ・種 6 + 甘味 6) | 13 |

No family is below 11 at maturity. Authoring the real 172 rows (the 32 unmatched names) is catalog work for a later slice.

## 5. Candidate-universe decision (the k ≥ 2 authority)

**Compared universes:**

| Universe | Definition | Verdict |
|---|---|---|
| **A. OWNED** (authority) | The player's owned catalog ingredients | **Chosen**, with the recipe-exclusion rule below |
| B. Obtainable / unlocked | Shop-unlocked, bought or not | Rejected. The H0 line says the target is makeable **from owned ingredients**, so an unbought decoy is ruled out by the player. On the shipped ladder B = A once each unlock is bought; otherwise it only inflates k. |
| C. Full runtime catalog | All 29 ingredients | Rejected. Measured: a level chosen under C is **name-equivalent to the player in 5 / 24** recipes (bismarck, funghi: category; melanzane-pizza, parmigiana-pizza: family; meat-lovers: group). |
| D. Progression-reachable | Every ladder ingredient | Rejected for the same reason as C (for the 25-recipe runtime D = C) |

**Definition (in `deductionHint.ts`):**

`candidates(level) = { reserve } ∪ { i ∈ OWNED : matches(level, i) ∧ i ∉ recipe }`, and an answer is allowed only when `|candidates| ≥ 2`.

- **∉ recipe** excludes *every* other ingredient of the recipe, known or not. That is the worst case of what the player can learn about this recipe (every other ingredient is a sellable material fact or the free key).

**Monotonic safety invariant:** an answer that passed k ≥ 2 when it was given keeps k ≥ 2 forever. The reasons:

- **Knowledge growth cannot remove a decoy.** Decoys are outside the recipe; buying this recipe's facts never touches them.
- **Ownership only grows.** A purchase appends to `ownedIngredientIds`. Only Full Reset clears it, and Full Reset also clears every hint ledger.
- **Tested:**
  - every answer is re-checked at every later ladder state and stays ≥ 2;
  - the answer level only gets finer over time;
  - owning the recipe's own ingredients never adds a decoy.
- **Considered shrink paths:**
  - Stock at 0 does not remove ownership, and the universe uses ownership, not stock.
  - Unknown or hostile owned ids are ignored and never inflate k.
  - A decoy the player can rule out by *baking experiments* is gameplay, not a hint leak.

No Owner decision was needed. The data (C: 5 / 24 name-equivalent, A: 0) settles it in favor of A.

## 6. k ≥ 2 definition and the fallback hierarchy

- **k** = |candidates(level)| as in §5, the reserve included. `MIN_ATTRIBUTE_CANDIDATES = 2`.
- **Hierarchy** (the first level with k ≥ 2 wins):
  1. `family`;
  2. `group`;
  3. `category`;
  4. `existence` (always allowed; it restates Rule W's guaranteed "one more ingredient").
- Sauce and cheese reserves start at `category`.
- The answer is `{ level, family | group | category, factId }`, where `factId` is `attr:family:meat` / `attr:group:protein` / `attr:category:topping` / `attr:existence`. These ids stay within the persisted `<kind>:<value>[:<qualifier>]` grammar, so they survive `loadSave`. Each id stores the answered value, so it stays stable after later growth.
- **No FREE LEAK:**
  - the answer has no count or size field (tested);
  - the level is a function of (recipe, owned) only, never of purchases;
  - `reserveAttributeAudit` exposes candidates for tests only and is documented as never presentation.
- **Provisional copy** (DH4-2 finalizes it):
  - 「このピザは全部で5種類の材料を使うよ」
  - 「まだわかっていない材料に、肉の仲間があるよ」
  - 「まだわかっていないトッピングがあるよ」
  - 「まだわかっていない材料があるよ」

  Positive only. The tests forbid 使わない / じゃない / ありません / だけ / 0種類 / あと / 残り / ここまで / もうない.

## 7. 25-recipe audit (the shipped ladder; `TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`)

Each recipe is audited at its ladder state: Dex = its index, owned = the starter set + the unlocked steps.

**Answer levels:** family 13, category 8 (topping 4 / cheese 3 / sauce 1), existence 3, onboarding 1 (margherita, Dex 0: not a target).

| Level | Recipes |
|---|---|
| family | bambino, hawaiian, pesto-patate (肉); capricciosa, pizza-portuguesa, tonno-e-cipolla, pesto-tonno (野菜・きのこ); fugazza, marinara, napoletana, new-haven-apizza, pesto-caprese, puttanesca-pizza (ハーブ・香味) |
| category | breakfast-pizza, melanzane-pizza, parmigiana-pizza, meat-lovers (topping); pepperoni, salsiccia, genovese (cheese); pizza-bianca (sauce) |
| existence | bismarck, funghi, quattro-formaggi (no owned decoy of the reserve's category outside the recipe) |

- **No answer is name-equivalent** at its ladder state, or at any later state.
- The `group` level is never needed on the shipped ladder. It is exercised by a synthetic owned set (hawaiian with tuna but no other meat → 肉・魚介).
- Compared with the Fresh Design's pool (which excluded only the *known* ingredients), the recipe-exclusion rule is stricter. Fresh Design §10.3 had T7 17 / category 4 / existence 3; DH4-1 has family 13 / category 8 / existence 3. This is the price of the monotonic invariant (§5).

## 8. Information value (OD-DH4-9; no prices)

Bits at the endgame (only the reserve unknown), the runtime average over 24 targets:

| Hint | Bits |
|---|---:|
| Material name | **3.38** |
| Reserve attribute | **1.62** (0 when the answer is existence or a category with no gain) |
| Total count | Closes the list only; no identity bits |

The audit test asserts attribute < material for every recipe. These numbers are the input for DH4-ECON / H3-ECON-1.

## 9. Legacy and near-miss interaction

**Legacy (OD-DH4-8):**

- `legacyOwnsIngredientTotal` is true exactly when the recipe's visible Hint 2.0 lines at the stored level include the `COUNT_CHEESE` line. That is tested for 25 recipes × H0–H4.
- `ingredientTotalOwned` also accepts a stored `meta:ingredient-total` id in `discoveryHintFacts`. That ledger already keeps unknown ids verbatim (H3-2), so **no schema change** is needed.
- A stored `meta:` id is ignored by the Hint 3.0 material pricing (tested: the price stays 5, and a purchase succeeds at 5).
- grandfatheredSteps stay display-only and verbatim (tested).
- Hostile ledgers (null, arrays, strings, `__proto__`) neither crash nor count.

**Near-miss (OD-DH4-7):**

- For every target, a pizza of the recipe minus its reserve gets a real `classifyNearMiss` result (free).
- Combined with the purchased attribute, the addable candidates (owned, not on the pizza, consistent with the answer) are **≥ 2** for every non-existence answer.
- The module source is checked to contain no near-miss copy or classifier reference. `nearMiss.ts` / `resultNearMiss.ts` are unchanged.

## 10. Tests

**`deductionHint.test.ts` (27) + `deductionHint.audit.test.ts` (2).** Owner list → test:

| Owner item | Test |
|---|---|
| Structure total count deterministic | "every target: the distinct ingredient count, deterministic, never 0, positive copy only" |
| Attribute deterministic | "deterministic: repeated calls and any owned order or duplication …" |
| No negative fact | The structure and attribute copy tests (NEGATIVE regex); "only the whole-recipe total exists" |
| Rule W name never emitted | "every target at its ladder state … never the reserve's name or id"; "Rule W: the answer is always about the reserve" |
| k ≥ 2 | The ladder-state test + the audit invariant |
| Fallback family → coarse → category | "fallback hierarchy …"; "group fallback …" |
| Fallback → existence | Owned-set edge cases; "not a target / zero attribute …" (quattro-formaggi) |
| Singleton taxonomy safety | "singleton taxonomy safety" (hawaiian with ham the only meat); the taxonomy data tests |
| Owned-set edge cases | "owned-set edge cases: empty, non-array, hostile and unknown ids never inflate k" |
| Progression change safety | "progression safety … every later ladder state (monotonic invariant)"; "knowledge safety …" |
| Legacy total count not resold | "every recipe x legacy level …"; "a stored meta:ingredient-total id counts as owned …" |
| Near-miss combination safety | "free near-miss (the reserve missing) + the purchased attribute never leaves a single candidate" |
| Zero purchasable attribute | "not a target / zero attribute: onboarding, unknown and hostile recipe ids …" |
| Duplicate signature safety | "duplicate signature safety: repeated ingredient rows count once" |
| Unknown / future ingredient safety | "unknown / future ingredient: a recipe with a non-catalog ingredient fails closed …"; hostile ids in the taxonomy |
| 25-recipe audit maintained | `deductionHint.audit.test.ts` (file snapshot of the JSON) |
| Unwired | "no production module imports the Deduction Hint layer or the taxonomy yet" |
| Save compatibility (Codex P2, §10.1) | "every fact id this layer can produce is kept by loadSave" |

**Runs:**

| Check | Result |
|---|---|
| Focused (DH4 + `discoveryLadder.test.ts` boundary) | green |
| Full Vitest | **187 files, 4012 passed, 1 skipped, 0 failed** |
| `tsc -b` | 0 errors |
| `oxlint` | 0 warnings |
| `npm run build` | OK (only the existing chunk-size warning) |
| E2E | Not run locally (pure layer, no UI). CI follows the classifier. On the first head `0e66ba0` everything is **green**:
- `classify`, `build`, `layout-chromium`, `Layout Contract Gate`;
- `webkit-390x844` and `webkit-360x800` 1/2 + 2/2;
- `WebKit Gate`.

The runs are 36309627040 (E2E) and 36309627044 (build). The Codex-fix head re-runs the same suite. |

### 10.1 Codex review (PR #254)

**P2: "Use fact IDs accepted by the persistence sanitizer". Valid, and fixed in this PR.**

- The first head `0e66ba0` used ids such as `attr:reserve:family:meat` (three segments after the kind).
- `persistence.ts` `HINT_FACT_ID_PATTERN` keeps at most `<kind>:<value>[:<qualifier>]`. Such ids would therefore be dropped on save once DH4-2 wires purchases.
- **The fix:**
  - the ids are now `attr:family:<f>` / `attr:group:<g>` / `attr:category:<c>` / `attr:existence`. `attr:` answers are always about the reserve; this is documented in the module;
  - a new test round-trips every id the layer can produce through the real `loadSave`;
  - persistence is unchanged.

During development, the existing ladder wiring-boundary test caught a support file importing `discoveryLadder`. It was fixed by passing the ladder in, not by widening the boundary.

## 11. Mutation / adversarial results

Each mutant was applied to `deductionHint.ts`, the two DH4 test files were run, and the file was restored byte-identical from a backup.

| # | Mutant | Result |
|---|---|---|
| M1 | k ≥ 2 guard removed (`MIN_ATTRIBUTE_CANDIDATES = 1`) | **KILLED** (7 failed) |
| M2 | Deterministic selection broken (the answer depends on owned order) | **KILLED** (1 failed) |
| M3 | Fallback removed (family, else existence) | **KILLED** (3 failed) |
| M4 | Rule W ignored (describe a sellable fact instead of the reserve) | **KILLED** (7 failed) |
| M5 | Legacy ownership ignored | **KILLED** (2 failed) |
| M6 | Recipe exclusion removed (recipe ingredients count as decoys) | **KILLED** (5 failed) |
| M7 | Structure becomes a per-category (topping) count | **KILLED** (3 failed) |

## 12. Residual risks

- **The 172 taxonomy is heuristic.** Only the 29 runtime ingredients are authored. The mature class sizes come from a keyword mapping with 32 unmatched names, so the real rows need authoring before content grows.
- **Early-ladder coarseness.** With the monotonic rule, 11 / 24 answers are category or existence. That is correct for privacy, but the attribute's gameplay value early on is low (bismarck, funghi, quattro-formaggi get existence). The economy phase should price with the level mix in mind; the price must not depend on the level (FREE LEAK).
- **The existence answer restates Rule W.** It carries almost no information. DH4-2 / DH4-ECON should make sure it never feels like a paid nothing, e.g. by pricing, or by showing it only as part of the attribute family.
- **Provisional copy.** The final wording, and whether 「まだわかっていない」 reads naturally next to material chips, is DH4-2's.
- **Legacy + Hint 3.0 mixed tabs.** `ingredientTotalOwned` reads both ledgers. If a future DH4-2 writes `meta:ingredient-total`, it goes through the existing union-merge ledger. No new field is needed.

## 13. Next slice proposal

**DH4-2 — runtime wiring + the U3 UI prototype (after Owner review of DH4-1):**

1. Reducer actions for the structure and attribute purchases.
   - One charge per request; stale and double protection as in H3-3.
   - The attribute answer is stored as its `factId` in `discoveryHintFacts`.
   - The structure is stored as `meta:ingredient-total`.
2. The view model for the 「わかっていること」 board (chips + total + attribute line) and the U3 ask menu. The same uniform-presentation rule: the menu is the same for every target.
3. Human Verification per the HV Policy.
4. **Prices stay pending DH4-ECON.** DH4-2 either waits for DH4-ECON or ships behind a zero-price test-only flag, per an Owner decision.

## 14. Verdict

**A. DH4-1 READY FOR OWNER REVIEW.**

The pure, unwired layer implements OD-DH4-1…10:

- the whole-recipe total only;
- the reserve attribute behind k ≥ 2 over OWNED-outside-recipe candidates, with a monotonic safety invariant;
- a 7-family / 4-group data taxonomy;
- read-only legacy ownership;
- no near-miss change.

**Evidence:**

- The 25-recipe audit shows no name-equivalent answer at any ladder state.
- 29 DH4 tests pass and 7 / 7 mutants are killed.
- Full Vitest, typecheck, lint and build are green.
- Full CI, WebKit included, is green on `0e66ba0`.
- The Codex P2 (fact-id persistence grammar) is fixed in-PR with a real `loadSave` round-trip test.

The candidate-universe decision needed no Owner stop (§5). **Not merged.**
