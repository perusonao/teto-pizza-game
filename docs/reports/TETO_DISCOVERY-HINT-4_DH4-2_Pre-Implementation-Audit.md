# Discovery Hint 4.0 — DH4-2 Runtime + U3 UI: Pre-Implementation Fresh Audit (Final Owner Decision Gate)

> **Status:** Fresh Audit / Design, docs only (Issue #253).
>
> - Nothing is implemented. There is no `src/`, CSS, reducer, persistence, pricing or save-schema change. No DH4-2 branch was created and nothing was merged.
> - PR #255, PR #252, Dinner, PR #243 and Issue #238 are not touched.
> - Nothing here is authority until the Owner decides §19.
>
> **Machine-readable outputs** (regenerated deterministically by `python3 tools/dh4_2_topping_count_audit.py`):
>
> | File | Content |
> |---|---|
> | `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json` | The whole audit. Final-gate data is in `finalGate`. |
> | `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_RUNTIME-SNAPSHOT.json` | Input: the runtime data of `5a33d85` |
> | `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_HINT-SHEET-VSPACE.json` | Hint Sheet vertical-space measurements |
> | `docs/reports/screenshots/dh4-2-pre-audit/before-*.png` | Baseline screenshots, the before images for DH4-2 |
>
> **Verdict: A. DH4-2 DESIGN READY FOR OWNER DECISIONS** (§22)

## 1. Audited main SHA

| Item | Value |
|---|---|
| `origin/main` (fresh, re-checked at the final gate) | **`5a33d85`**: Merge PR #254 (DH4-1) |
| DH4-1 on main | The tree is identical to PR #254's head `057e387`. It is still unwired: no production module imports `deductionHint.ts` or `ingredientTaxonomy.ts`. |
| Runtime data | 25 recipes, 29 ingredients, the 24-step W1 ladder, and per recipe the key and the Rule W reserve. The snapshot comes from a throw-away Vitest probe, deleted afterwards. |
| DH4-1 replica check | The audit tool re-implements `reserveAttributeAnswer`. A throw-away probe compared it with the merged module: **48 / 48 identical** (24 targets × ladder-owned / all-owned). |
| Hint Sheet measurement | Local Chromium (Playwright), the 7 layout-contract profiles including the CDP safe-area override (47 / 34). The probe spec was deleted afterwards. |

## 2. Current GitHub state (fresh)

| Item | State | Role in this audit |
|---|---|---|
| main | `5a33d85` | Authority |
| PR #254 (DH4-1) | **MERGED / POST-MERGE PASS**: WebKit run 36312634317 and Pages run 36312634344 green. Unwired. | The pure authority DH4-2 must use |
| Issue #253 | OPEN. The DH4-1 row reads MERGED; the DH4-2 row reads "Not started". | Parent issue. Carries OD-DH4-1…10. |
| Issue #238 | OPEN (kept open). H3-1…H3-4 are all merged. | Hint 3.0 authority: material facts, ESC, Rule W, GUIDANCE_ONLY |
| PR #255 (172 taxonomy) | OPEN, not merged, head `e221e36`, base `5a33d85`. docs / data / tools only (3 files). OD-TAX-1…9 are recorded. | **Read only** (§18) |
| PR #252 (DM-3R-2) | OPEN, base `726b0ac`. Not touched. | Dinner boundary only (§17) |
| Production (Firebase) | Last successful deploy 2026-09-21 (`7e5692f`). That predates H3-3 and H3-4. | Explains the observed copy (§3.1) |

## 3. iPhone Owner Findings

| # | Owner finding | Measured root cause on `5a33d85` | Resolved by |
|---|---|---|---|
| HV-1 | The player wants to know how many toppings are needed | Only the whole-recipe total exists (OD-DH4-2) | §4, OD-DH4-2-3 |
| HV-2 | At the end, the player wants a kind or attribute, not the name | Solved in DH4-1, but unwired. §5.3 finds an inversion risk. | §8, OD-DH4-2-4 |
| HV-3 | 「category choice + 0 Pitz」 reads as "a new fact is guaranteed" | The preference radio plus a price CTA promise a slot | §10, §14, §15 |
| HV-4 | GUIDANCE_ONLY does not match the expectation | Nothing before the tap says a request can end empty | §15 |
| **HV-5** | **The hint body area is too small.** The topping row fades out, while the guidance line, the legend, 3 selectors, the CTA and the Pitz line take the height. | **At 390×844 + safe area, known information is 138 px (36 % of the sheet), against 132 px of footer + 46 px of bottom padding. The 2-chip topping row shows 40 of 52 px. At 360×640 + safe area, no fact row is visible (46 px, less than the 55 px H0 line).** | §11, §12, OD-DH4-2-8 |

### 3.1 Which build was on the phone

- The copy in the images, 「ヒントを1つ解除」 / 「0 Pitz」 / 「どれのヒントがほしい？」, is the **H3-3** copy (`d4d558d`).
- H3-4 (`22658f7`) replaced it with 「ヒントを1つもらう」 and, at price 0, 「ヒントをたずねる／支払いずみ」, plus the pay-only-when-given line.
- Production was last deployed before H3-3 and H3-4. The images therefore most likely come from production or a cached PWA.
- **HV-3 and HV-4 are partly addressed on main already.** HV-5 reproduces exactly on main: see `before-K-all-facts_P390i.png`.

## 4. Topping-count audit (STEP 2)

### 4.1 Runtime distribution

**T = topping total; N = ingredient total.**

| T | Recipes |
|---:|---|
| **0** | quattro-formaggi |
| 1 | margherita, bismarck, funghi, pepperoni, salsiccia, genovese, pizza-bianca |
| 2 | 12 recipes |
| 3 | pesto-tonno |
| 4 | meat-lovers, capricciosa, pizza-portuguesa, puttanesca |

**Other distributions:**

- N: 2 → 1 · 3 → 8 · 4 → 10 · 5 → 3 · 6 → 3.
- Sauce = 1 in **all 25**.
- Cheese = 0 in 5.
- (N, T) gives 9 classes; the full list is in JSON `distributions.recipesByNT`.

### 4.2 Options A–E, mechanically compared

JSON `finalGate.toppingCountOptions`. The method:

- Every reachable purchase state is enumerated (each per-category prefix of sellable facts), each with and without the DH4-1 attribute.
- The player model is a smart player with the one-sauce prior.
- **N is assumed known whenever it is part of the option, because near-miss ADD_ONE on the known facts gives it for free.**

| Option (copy) | Information | Recipe classes (24 targets) | Rule W reserve **named** (ladder / all owned) | Unbought material fact newly named | Zero stated | Verdict |
|---|---|---|---|---|---|---|
| **A** 材料は全部で○種類 | N | 5 classes, largest 10, 1 unique | 0 / 0 | 0 | never (N ≥ 2) | Safe |
| **B** トッピングは全部で○種類 | T (with N via ADD_ONE) | 5 classes, largest 12, 2 unique | **3 (bismarck, funghi, quattro) / 1 (quattro)** | 4 (mozzarella ×3, quattro) | **quattro 「0種類」** | **Reject** |
| **C** 具材は全部で○種類 | **Ambiguous.** As cheese + topping it equals N − 1 for all 25 (zero new information). As toppings it is B. | = A | 0 / 0 | 0 | never | Reject (ambiguous; no gain) |
| **D** 材料総数 + トッピング数 (raw) | N + T | 9 classes, largest 9, 5 unique | **3 / 1** | 4 | **quattro** | **Reject** |
| **D′** 材料総数 + トッピング数 through the **TC-G** guard | N (+ T when the guard passes) | — | **0 / 0** | 3 (mozzarella, a starter; economy only) / 0 | never | **Safe** |
| **E** 材料総数だけ | N | = A | 0 / 0 | 0 | never | Safe (= A) |

**Other measured values:**

- **Recipe identity leak.** None, for any option. The free key alone already separates all 24 targets, and on the deterministic ladder the makeable-undiscovered count is 1 at every step. The risk is at the **ingredient** level.
- **Intersections.**
  - Material facts × T: closure (「全部で4・トッピング2・チップ2」 means no more toppings) is PAID INFERENCE.
  - DH4 attribute × T: this is where the reserve is named (B, D).
  - Near-miss × T: ADD_ONE supplies N for free, so T alone behaves like N + T.
  - Rule W × T: T reveals whether the reserve is a topping.
- **Information value** (JSON `informationValue`):
  - At the endgame, **T given N + attribute = 0 bits**, except in the 3 recipes where T names the reserve (1.0 / 2.0 / 4.52 bits).
  - In the mid-game, T given N ≈ **1.50 bits** (1.18 without quattro), against 1.14 bits for the attribute.
  - **So the topping count is a mid-game deduction aid.** At the endgame it only adds information where it breaks Rule W.

**Is 「トッピング0種類」 too strong?**

- **Yes.** For quattro-formaggi, T = 0 is worth **8.62 bits** in the mid-game: it rules out all 21 owned toppings at once. That is the strongest single fact in the audit and a negative fact by construction (OD-DH4-2 forbids category-zero statements).
- TC-G never states 0: when T = 0 the guard fails, and only the total is told.

**TC-G guard (inversion-safe):**

- Let W = the reserve + owned ingredients outside the recipe.
- T is told only if T ≥ 1 **and** every category side present in W (topping / cheese / sauce under the one-sauce prior) has at least 2 members.
- The guard decision depends on W alone, so the fallback reveals nothing about which unknown is the reserve.
- It passes in **11 / 24** recipes on the ladder and **23 / 24** with everything owned (the Owner's late-game case).

### 4.3 Category boundary: sauce, cheese, topping, finishing, post-bake

| Boundary | Runtime (25) | 172 evidence |
|---|---|---|
| Sauce / cheese / topping | The authoritative `Ingredient.category`. Exactly 1 sauce per recipe. | Categories are authored for 29 runtime + 62 catalog ids only. 135 default-topping guesses are needed (evidence gap). 30 rows have no spread sauce; 26 have 2 or more spread layers. |
| Finishing / post-bake | Does not exist in the runtime | 14 rows with late additions. **Late items include sauces** (buffalo-sauce, Detroit tomato sauce, hot honey) as well as toppings (cilantro, truffle, lettuce…). |
| Conclusion | T = the count of `category === "topping"` | "Post-bake" is **orthogonal** to category (the same as PR #255 OD-TAX-6). A topping count must never exclude finishing items: black-truffle would drop to 0, and the count would leak the LATE_ADDITION technique. |

### 4.4 Terminology recommendation

- **Use 「トッピング」.** It is the tray's own category label (ソース / チーズ / トッピング). Use it with the verb **「使う」** (「トッピングは○種類使うよ」), because 「のせる」 is wrong for enclosed pizzas (calzone) and for late additions.
- **Reject 「具材」.** It is ambiguous and often includes cheese.
- **Reject 「のせる材料」.** It equals N − (sauce count): zero information at runtime, and a no-sauce negative at 172.
- **Reject 「仕上げを除く具材」.** It turns a technique into a structure fact.
- **Re-audit trigger:** if Cooking Steps ever gives FINISH its own tray category, 「トッピング」 must be re-audited. Until then the count follows the tray category. That is recorded, not guessed.

**Final topping-count recommendation: D′ (TC-G) if the Owner wants the number, otherwise E.** A, B and C as standalone count facts are not offered.

## 5. Privacy analysis

### 5.1 Classification

| Mechanism | Class | Status |
|---|---|---|
| A family control shown identically for every target, with a uniform price | — | Required |
| Answer granularity, availability or singleton-ness visible **before** the request | **FREE LEAK** | Forbidden (OD-DH4-10) |
| A price that differs by answer granularity, shown before the request | **FREE LEAK** | Forbidden |
| Offering a topping count only when T ≥ 1 | FREE LEAK | Forbidden |
| 「0種類」, 「なし」, 「残り○個」, 「あと○種類」 | Sold negative, or FREE LEAK | Forbidden |
| Closure from bought facts (N, T, chips) | PAID INFERENCE | Allowed (OD-H3-16) |
| The outcome of a free request (GUIDANCE_ONLY, a no-charge existence answer) | INTERACTION INFERENCE | Allowed (OD-H3-17), **only if it cannot name an ingredient** (§5.3) |
| Two answers about the same reserve | Joint answer (PR #255 FR-3) | Allowed only when nested (family ⊂ group ⊂ category), which holds for one attribute family |

### 5.2 Topping count

This is §4.2. Raw counts name the reserve in 3/24 (ladder) and 1/24 (all owned). TC-G names nothing.

### 5.3 A new finding on the merged DH4-1: the answer *level* is invertible

**How the inversion works:**

- DH4-1 picks the level from the **reserve's own class**.
- A player who knows the rule and holds N (bought, or a free ADD_ONE) can test each remaining owned ingredient x: "if x were the reserve, would the answer have been this level?"

**Where it names the reserve** (JSON `finalGate.attributeGuardOptions.a_dh41_as_merged`):

| Recipe | Inventory | Observed answer | Named reserve |
|---|---|---|---|
| funghi | ladder | existence | mozzarella |
| quattro-formaggi | ladder and all owned | existence | fontina |
| breakfast-pizza | all owned | category:topping | egg |
| meat-lovers | all owned | group:protein | sausage |

**Root cause:**

- The guard protects the reserve's own class. It does **not** stop singleton classes *elsewhere in W* from answering at a different level.
- At runtime, three families are singletons: fruit = pineapple, spice = capers, other = egg. PR #255 §5 records these as "protected by the guard"; §18 notes the gap.

**Options, all measured with the topping clause included:**

| Option | DH4-1 answer function | Levels, ladder | Levels, all owned | Named after inversion | Data change |
|---|---|---|---|---|---|
| **(a)** DH4-1 as merged | unchanged | family 13 · category 8 · existence 3 | family 15 · category 7 · group 1 · existence 1 | **5 cases** | none |
| **(b)** reserve-isolation wrapper (keep DH4-1 when ≥ 2 hypotheses share its answer) | unchanged, wrapped | family 13 · category 8 · existence 3 | family 15 · category 8 · existence 1 | **1** (funghi @ ladder) | none |
| **(c)** partition check (keep DH4-1 only if **every** DH4-1 answer class over the hypotheses has ≥ 2; else a strict answer for all) | unchanged, wrapped | category 11 · existence 13 | category 22 · group 1 · existence 1 | **0** | none |
| **(d)** (c) + runtime merge **pineapple, capers → `other`** (ids kept) | unchanged, wrapped | family 3 · group 1 · category 7 · existence 13 | **family 16** · category 6 · group 1 · existence 1 | **0** | 2 rows. **Needs PR #255's Human Classification Gate** (capers is in the runtime review queue). |

**Why (c) gives up family answers at 25 recipes:** the runtime singleton families mean the partition check almost always falls back. At 105 / 172 every family has ≥ 3 / ≥ 8 members (PR #255), so (c) returns family answers by data alone as the catalog grows.

**Recommendation: (c) now, becoming (d) through data after the Human Classification Gate.**

- (c) makes every answer inversion-safe **today**.
- It needs no taxonomy decision and keeps DH4-1's answer function and all 7 ids (OD-TAX-2).
- (b) is a fallback if the Owner prefers family answers now and accepts one early residual (funghi, whose reserve is the starter mozzarella). Under (b), the no-charge existence UX (§8) is **not** allowed, because it would make that residual free.

**Per-recipe answers** under (a) / (c) / (d): JSON `finalGate.attributeAnswersPerRecipe`.

### 5.4 Near-miss

- ADD_ONE equals N closure for free. Every check above assumes it.
- The near-miss copy stays fixed and attribute-free (OD-DH4-7).
- Near-miss never reads `meta:` or `attr:` (a DH4-2 pin test).

## 6. 172 scalability

**Sources:** the design matrix (172 rows) and the ingredient catalog. **Indicative only:**

- 120 / 172 rows have a complete ingredient list;
- 97 rows contain at least one guessed category;
- 33 rows have an unresolved base sauce.

| Measure | Value |
|---|---|
| T distribution (all / complete rows) | 0: 5 · 1: 29 · 2: 51 · 3: 61 · 4: 20 · 5: 5 · 6: 1 / 0: 3 · 1: 21 · 2: 42 · 3: 37 · 4: 12 · 5: 4 · 6: 1 |
| T = 0 | 5 cheese-only pizzas (quattro-formaggi, trenton, NY-style, quad-cities, colorado). Their categories are runtime-proven. |
| (N, T) classes | 19. The largest holds 33 and 6 are unique. PR #255: total + topping count makes 4 % of complete rows unique. |
| No sauce / multi-spread / late additions / non-round | 30 / 26 / 14 / 11 |

| Case | 「トッピングを○種類使う」 | Note |
|---|---|---|
| Post-bake / finishing | Natural | The count follows the tray category, not the timing |
| Late sauces | Natural | They are sauces, not counted |
| No sauce, piadina | Natural | 「のせる材料」 would leak no-sauce |
| Pizza bianca | Natural (T = 1) | — |
| Pan / square / boat (pide) | Natural | — |
| Enclosed (calzone, stuffed) | Natural with 「使う」 | 「のせる」 fails |
| Multi-spread drizzles (honey, balsamic) | **Depends on catalog authoring** | Evidence gap |
| Cheese-only | Only through TC-G (never 「0種類」) | — |

**Evidence gaps, recorded and not filled:**

1. Categories of about 117 ids.
2. The category of spread-layer items.
3. Mid vs post-bake timing for eel.
4. The family rows for the 105 / 172 ids. These are PR #255's PROPOSED and NEEDS_REVIEW rows.
5. Family-derived base sauces.

## 7. Hint family model (STEP 3)

| Family (UI) | Meaning (authority) | Fact ids | Answers per recipe | Can end in GUIDANCE_ONLY? |
|---|---|---|---|---|
| **材料** | Hint 3.0: one positive ingredient of the target. The key is free; the Rule W reserve is never sold (H3-1, unchanged). | `ing:<id>` | `distinct − 2` (0 for pizza-bianca) | Yes (existing OD-H3-17) |
| **構成** | DH4-1 `structureTotalFact`: the total (`meta:ingredient-total`) + (if OD-DH4-2-3 D′) the TC-G topping clause (`meta:topping-total`, stored only when told) | `meta:*` | **1** (single-shot) | No |
| **特徴** | DH4-1 `reserveAttributeAnswer`, behind the §5.3 guard: one attribute of the **Rule W reserve** | `attr:<level>:<value>` | **1 informative answer** (single-shot once informative, §8) | No (the existence case has its own UX, §8) |

**No double purchase:**

- **Disjoint facts.** The three families write disjoint fact kinds. 特徴 describes only the reserve, which 材料 never sells, and 構成 never names an ingredient.
- **Single-shot.** 構成 and 特徴 cannot be bought twice for a recipe, because the ledger check is by fact kind.
- **Legacy grants count as owned:**
  - a legacy 「材料は全部で○種類」 line means 構成 (total) is owned (DH4-1 `ingredientTotalOwned`, OD-DH4-8);
  - legacy `grantedFactIds` mean those 材料 facts are owned (H3-2);
  - legacy negative lines (「チーズは使わないみたい」) grant nothing and are archive only.
- **TC-G for a legacy owner of N.** 構成 remains requestable once, for the topping clause. If the guard fails, that request ends in GUIDANCE_ONLY; the guard is W-only, so this is safe.

## 8. Attribute fallback and existence-only UX (STEP 4)

**What existence-only is:**

- 「まだわかっていない材料があるよ」 is **always true**: Rule W guarantees an unknown ingredient.
- So it carries ≈ 0 information.
- Under guard option (c) it is common early: 13 / 24 answers on the ladder, 1 / 24 with everything owned.

| Option | Pre-request | Charge | FREE LEAK? | Fit with 「Pitzはヒントが出たときだけ使うよ」 | Verdict |
|---|---|---|---|---|---|
| A. Paid at the same price | Uniform | Yes | No | **Poor.** It charges for a constant-true line; 13 / 24 early buys would feel like a rip-off. | Reject |
| B. 「無料」 when existence-only | **Shows free vs paid before the tap** | No | **Yes**: it reveals the granularity before purchase | — | **Forbidden** |
| C. Charged, with 「今回は大きな手がかりは見つからなかった」 | Uniform | Yes | No | Contradicts the line | Weak |
| **D. No charge after the request** | **Uniform** (same card, same price) | **0**, decided by the authority | **No.** The outcome reveals only what the answer text reveals anyway; with guard (c) or (d) it is inversion-safe. | **Consistent**: the same semantics as GUIDANCE_ONLY | **Recommended** |

**Rules of D:**

- The request is priced and affordability-checked exactly like an informative one (the H3-1 pattern): the balance check happens on the request, before resolving.
- If the answer is existence: nothing is charged and nothing is recorded (`attr:existence` is not stored).
- The card shows 「今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）。材料がふえると、わかることがあるかも」 and is disabled for this sheet session.
- A later request, after the inventory grows, may return a finer answer. It is charged then, and then 特徴 becomes single-shot.
- **Why that is safe:** successive answers are nested (existence ⊃ category ⊃ group ⊃ family), so their joint is the finest one, which itself passed the guard.

**Price differences by granularity (family vs category) are rejected.** Shown before the request they are a FREE LEAK. After the request they add complexity with no benefit. One price for any informative answer; 0 only for the non-informative one.

**Dependency:** D requires guard (c) or (d). Under (a) or (b), D would turn the residual inversion cases into free names. Then C is the only acceptable choice.

## 9. Economy boundary (STEP 5)

| | E1: no runtime purchase until DH4-ECON | E2: reuse ESC 5 / 10 / 20 / 40 as one shared hint progression now | **E3: wire runtime and UI behind a flag (DEV / Preview), production cannot buy 構成 / 特徴** |
|---|---|---|---|
| Complexity | Lowest now, but UI and runtime wait | Medium: a family-aware paid count and cap semantics | Medium: the same code as E2, plus a flag |
| Migration | none | Irreversible once production saves record rungs from new families | none in production. Preview uses its own save key (`teto-pizza-preview-save-v1`, `VITE_PREVIEW_MODE`). |
| Privacy | — | The price must stay uniform across families and levels | Same, testable before production |
| UX | HV-5 (layout) waits too, unless split out | Real prices without an economy review | Real prices are not decided; the Preview prototype uses the ESC rung, labelled provisional |
| Future economy change | Free | **Constrained**: production saves already carry spend | Free |
| Save compatibility | n/a | New ids are fine (schema 2), but paid-count semantics are frozen | New ids are fine; production writes none |

**Recommendation: E3.**

- The prototype price inside the flag is the shared ESC rung (the E2 logic), so DH4-ECON can evaluate a real curve.
- **Never set 0 Pitz as a production price.** Price 0 remains only the existing cap-paid state (「支払いずみ」) and the no-charge outcomes (GUIDANCE_ONLY, existence).
- **The vertical layout (HV-5) and the U3 sheet for the 材料 family can ship to production without DH4-ECON**, because they change no price (§20).

## 10. U3 comparison (STEP 6)

The heights below are measured-model values from §12.

| | U3-A: 「ヒントをもらう」 → 材料 / 構成 / 特徴 (inline segments) | U3-B: one CTA, the system picks the family | **U3-C: 「わかっていること」 first → 「ヒントをもらう」 → family cards** |
|---|---|---|---|
| First-time clarity | Medium (構成 is abstract) | Low: the player does not know what they will get | **High**: each card says what it tells |
| Taps from an open sheet | 3 (+1 for a preference) | 1 | **2 (+1 for a preference)** |
| Privacy | Uniform | **Leak risk**: switching families on exhaustion reveals it on a charged request, and the player pays for an unchosen family | **Uniform.** 「✓ もらいずみ」 comes from the player's own ledger only. |
| 0 Pitz | One shared price CTA | Poor | **Each card:** 「たずねる ｜ 支払いずみ」 |
| GUIDANCE_ONLY | Medium | Poor (silent family switch) | **Only 材料 can end empty, and its card says so before the tap** |
| Legacy | OK | Confusing | 構成 card shows 「✓ もらいずみ（以前のヒント）」 |
| 172 scalability | Good | Good | Good |
| Technique Hint (D) | +1 segment (crowded at 360) | +1 in the fixed order | **+1 card** |
| 390×844 / 360×800 / 390×664 / 360×640 (layout C) | Chooser in the footer: known area 566–362 px (+ safe area) | Best density | Panel ≥ 362 px everywhere: 3 full cards fit |
| Fit with OD-DH4-6 | Literal | Violates it (no choice) | Literal + explanations |

**Recommendation: U3-C (called U3-R earlier: the U3-A entry with U3-C cards).**

## 11. Vertical-layout comparison (STEP 7)

**Measured today** (state K = every sellable fact owned; JSON `…HINT-SHEET-VSPACE.json`):

| Region (px) | 390×844 | 360×800 | 390×664 | 360×640 | 390×844 + SA | 390×664 + SA | 360×640 + SA |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sheet (45dvh cap) | 379 | 360 | 299 | 288 | 380 | 299 | 288 |
| Padding 12 + header 36 + gap 8 | 56 | 56 | 56 | 56 | 56 | 56 | 56 |
| Guidance (H0, in the body) | 36 | 55 | 36 | 55 | 36 | 36 | 55 |
| **Known information visible (body)** | **171** | **152** | **91** | **80** | **138** | **57** | **46** |
| Fact rows fully visible (of 3) | 3 | 2 | 1 | **0** | 2 (topping 40 / 52) | **0** | **0** |
| Gap + selector (legend 17 + 3 × 44) | 71 | 71 | 71 | 71 | 71 | 71 | 71 |
| CTA | 44 | 44 | 44 | 44 | 44 | 44 | 44 |
| Pitz explanation | 17 | 17 | 17 | 17 | 17 | 17 | 17 |
| Bottom padding (12 + safe area) | 12 | 12 | 12 | 12 | **46** | **46** | **46** |
| Known ÷ sheet | 45 % | 42 % | 30 % | 28 % | **36 %** | 19 % | 16 % |

**Budget model check:** body = sheet − 12 − 36 − 16 − footer − (12 + safe area). It reproduces all 7 measured values exactly.

**Known-information viewport per layout (px):**

| Profile | Today | **A** (70dvh, footer 132) | **B** (45dvh, header / footer fixed, compact footer 65) | **C** (near-full `100dvh − safe-top − 56`, compact footer 65) | C′ (balance in the header, footer 44) |
|---|---:|---:|---:|---:|---:|
| 390×844 | 172 | 383 | 239 | **647** | 668 |
| 360×800 | 152 | 352 | 219 | **603** | 624 |
| 390×664 | 91 | 257 | 158 | **467** | 488 |
| 360×640 | 80 | 240 | 147 | **443** | 464 |
| 390×844 + SA | 138 | 349 | 205 | **566** | 587 |
| 390×664 + SA | 57 | 223 | 124 | **386** | 407 |
| 360×640 + SA | 46 | 206 | 113 | **362** | 383 |

| Requirement | A | B | **C** |
|---|---|---|---|
| Known information is the main content (known ≥ controls, everywhere) | ✓, but the 132 px footer stays | Marginal (113 vs 111) | **✓** |
| 390×844 (+SA) shows the typical DH4-2 board (≈ 330 px) with no scroll; never 2–3 lines | 349: no margin | ✗ 205 | **✓ 566** (the longest, ≈ 470, fits too) |
| 360×640 (+SA): practical scroll, ≥ 150 px | ✓ 206 | ✗ 113 | **✓ 362** (the typical board fits without scrolling) |
| CTA always reachable | ✓ | ✓ | ✓ (fixed compact footer) |
| Safe area | Kept | Kept | Kept top and bottom (`env(safe-area-inset-*)`) |
| Scroll is discoverable | Fade only (insufficient) | Fade only | Rarely needed, plus the labelled cue |
| Keyboard not needed / no horizontal overflow | ✓ | ✓ | ✓ (buttons only; the existing e2e overflow check) |
| Keeps the 3 persistent category radios | Yes (the Owner asks not to assume this) | No | No: the preference moves into the 材料 card |
| Re-opens OD-H3-4-7 (45dvh) | Yes | No | Yes |

**Is the fade enough? No.** The 18 px fade ends exactly at the selector legend, so the cut reads as a clip, and the ▾ is a 14 px glyph with no label (`before-K-all-facts_P390i.png`).

**Recommended scroll affordance:**

1. Layout C makes scrolling rare.
2. When the body does scroll, a labelled pill 「▾ 下にもヒントがあるよ」 (≥ 24 px, `aria-hidden`) is removed at the end of the list. The fade stays.
3. Section labels (材料 / 構成 / 特徴 / 以前のヒント) peek above the fold.
4. The newest fact is scrolled into view (existing).

**Recommendation: Layout C** (C′ if the Owner accepts the balance in the header).

**Principle (OD-DH4-2-7): ヒント本文を操作UIより優先する.**

- The known-information viewport must never be smaller than the persistent controls plus the bottom safe area.
- The persistent footer holds one CTA row and one Pitz line at most.
- Choices live in a transient step.

## 12. Viewport budgets for the recommendation (Layout C + U3-C)

All values in px.

| Region | 390×844 | 360×800 | 390×664 | 360×640 | notes |
|---|---:|---:|---:|---:|---|
| Sheet max-height | 788 | 744 | 608 | 584 | `100dvh − env(safe-area-inset-top) − 56`: the app header stays visible (with SA: 741 / – / 561 / 537) |
| Top padding + header (title, 閉じる; C′: + 所持 Pitz) | 48 | 48 | 48 | 48 | 36 px header |
| Gaps | 16 | 16 | 16 | 16 | — |
| **Known information (scrolls)** | **647** (SA 566) | **603** | **467** (SA 386) | **443** (SA 362) | The typical board is ≈ 330, the longest ≈ 470 |
| Footer: 「ヒントをもらう」 44 + 4 + Pitz line 17 | 65 | 65 | 65 | 65 | C′: 44 |
| Bottom padding 12 + safe area | 12 (SA 46) | 12 | 12 (SA 46) | 12 (SA 46) | — |
| Family panel (replaces body + footer; sheet − 48 − 8 − (12 + SA)) | 720 (SA 639) | 676 | 540 (SA 459) | 516 (SA 435) | 3 cards × ~76 + 材料 preference row 44 + back 32 ≈ 320: fits everywhere without scrolling |

**Sheet sizing rule:** the sheet may use `height: auto` up to max-height, so a short board keeps a short sheet. A fresh target (H0 + one chip) stays around 200 px tall.

## 13. Known Information design (STEP 8)

| Form | Height | Clarity | Privacy | Verdict |
|---|---|---|---|---|
| Timeline (purchase order) | Grows with purchases | Low: the same category is scattered | Reveals the purchase order only (own data) | No |
| Chips only | Densest | Poor for sentences (構成 / 特徴) | OK | Only for 材料 |
| Cards per fact | Tallest | Good | OK | No: too tall at 360×640 |
| Flat list | Medium | Medium | OK | — |
| **Sections** (材料 chips / 構成 line / 特徴 line / 以前のヒント archive) | Medium | **Best** | OK | **Recommended** |

```
わかっていること
 材料   ソース: 🍅トマトソース   チーズ: 🧀モッツァレラ
        トッピング: 🌿オレガノ 🍄マッシュルーム 🍖ハム
 構成   材料は全部で6種類（トッピングは4種類）        ← TC-G clause only when told
 特徴   まだわかっていない材料に、野菜・きのこの仲間があるよ
 ┄ 以前のヒント（前のヒント方式のメモ）┄             ← dashed, muted archive
   材料は全部で6種類。チーズを使うみたい
```

**Rules:**

- **Only acquired facts are shown.** 材料 shows chips grouped with a small category label. **Empty categories are omitted, not filled with 「？」.** This replaces H3-4's 「？」 row and legend (OD-H3-4-5/6); it is an Owner decision (OD-DH4-2-7). It is safe because it reflects only the player's own knowledge.
- **An unasked 構成 or 特徴 section is omitted.** The 「ヒントをもらう」 panel lists all families uniformly instead, so the board never says what is missing.
- **Never shown:** 「残り○個」, 「まだ○件」, per-category availability, 「なし」, 「0種類」, candidate counts, the answer level as a label, 「?」 slots per unknown.
- **Legacy lines** stay verbatim in the dashed archive at the end, including negatives such as 「チーズは使わないみたい」. They are never merged into sections, never priced, never counted (OD-H3-4-4).
- **Hint 4.0 sells no new negative fact.**
- **The H0 line** becomes a one-line caption under the title (it saves 18–37 px).

## 14. CTA / price copy (STEP 9)

| Candidate | Promises a new fact? | At price 0 | With GUIDANCE_ONLY | Verdict |
|---|---|---|---|---|
| ヒントを1つ解除 (H3-3, seen on the phone) | Yes | 「0 Pitz」 reads as a free fact | Contradicts it | Retired |
| もう1つヒント | Yes | Misleading | Contradicts it | Reject |
| 手がかりをもらう | Yes | — | — | A new term; no gain |
| **ヒントをもらう** | Mild. It is the Owner's U3 entry and opens the panel, with no price. | Neutral | Nothing is charged at the entry | **Entry CTA** |
| **たずねる** (ヒントを聞く) | **No**: asking may get "nothing new" | Natural (H3-4 already uses it) | Matches | **Card buttons** |

**Price display:**

- **Use 「たずねる ｜ 5 Pitz」**: label + price badge (the H3-4 component).
- At the cap, use 「たずねる ｜ 支払いずみ」.
- **Not** 「5 Pitzでヒントをもらう」: it is money-first, it reads badly as 「0 Pitzで」, and it breaks the badge pattern.

**Card copy (uniform for every target):**

| Card | Title | Description | Note on the card |
|---|---|---|---|
| 材料 | 材料ヒント | 材料の名前を1つ教えるよ | 「えらんだジャンルに無いときは、ほかのジャンルから教えるよ」 + 「もう教えられる材料がないときは、Pitzは使わないよ」 |
| 構成 | 構成ヒント | 材料の数を教えるよ | — |
| 特徴 | 特徴ヒント | まだわからない材料の「なかま」を教えるよ | — |

- **材料 preference chips:** 「おまかせ / ソース / チーズ / トッピング」, with おまかせ as the default. おまかせ maps to the existing fallback order, so there is no authority change.
- **The `other` family label:** PR #255 OD-TAX-8 candidate 「ちょっと変わった材料があるよ」. Recommended (OD-DH4-2-9).

## 15. GUIDANCE_ONLY behavior

| Family | Pre-request | Outcome | After |
|---|---|---|---|
| 材料 | The card note says it may have nothing more | GUIDANCE_ONLY (existing OD-H3-17): no charge, nothing stored | The card reads 「材料ヒントはここまで（Pitzは使っていないよ）」 and is disabled for this sheet session. A uniform line follows: 「構成・特徴のヒントもあるよ」, only if those are unowned in the player's own ledger. |
| 構成 | — | Always answers | 「✓ もらいずみ」. Exception: TC-G for a legacy N owner (§7). |
| 特徴 | — | An informative answer, **or the existence outcome with no charge** (§8) | 「✓ もらいずみ」 after an informative answer; otherwise 「今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）」 and a retry in a later session |

**Summary:**

- Every non-answer is free and is announced on the card before the tap.
- **No family promises a category.** The 材料 preference is labelled as a wish.

## 16. Legacy behavior

| Legacy data | DH4-2 handling |
|---|---|
| `discoveryHintPurchases` (Economy 1.0 levels) | Read-only. `LegacyHintProgress` keeps the price rung (H3-1 / H3-2). |
| `grandfatheredSteps` | Shown verbatim in the dashed archive at the end of the board (OD-H3-4-4). Never facts. |
| Legacy 「材料は全部で○種類」 line | 構成 counts as owned (OD-DH4-8, `ingredientTotalOwned`). The 構成 section shows the total with a 「以前のヒント」 tag (a derived display; nothing is written) (OD-DH4-2-10). |
| Legacy granted positive facts | 材料 counts them as owned (unchanged) |
| Legacy negative lines | Archive only. No new negative is sold. |
| Legacy price-0 real facts (cap parity) | Unchanged: 「たずねる ｜ 支払いずみ」 stays enabled |

## 17. Runtime integration map (STEP 10)

**Principle:** the pure layer (`deductionHint.ts`, extended in DH4-2A) is the **only** authority for structure and attribute answers, guards and charges. The UI renders fact ids through a fixed copy map and never computes levels, guards or availability.

| Component | `5a33d85` | DH4-2 |
|---|---|---|
| Pure authority | `structureTotalFact`, `reserveAttributeAnswer`, `ingredientTotalOwned` (unwired); `purchaseSelectableHint` (H3-1) | **DH4-2A:**<br>- the §5.3 guard as an additive wrapper *inside* `deductionHint.ts`;<br>- the TC-G clause (if approved);<br>- `purchaseDeductionHint(input)`, which follows the H3-1 contract: re-derive → STALE / INSUFFICIENT_PITZ decided on the request → answer / existence-no-charge / GUIDANCE_ONLY → price;<br>- single-shot semantics;<br>- the fact → copy map. |
| Action | `PURCHASE_SELECTABLE_HINT { preference, expectedPaidCount }` | Same action plus `family: "material" \| "structure" \| "attribute"` (default `material`). **It stays in `DINNER_BLOCKED_ACTIONS` with no Dinner edit.** |
| Reducer | One case, which applies the patch from `purchaseSelectableHintFact` | The same case dispatches on `family` to one state helper. One patch = debit + ledger together, or nothing. |
| Purchase request | The sheet sends `(preference, paidCount)` | The sheet sends `(family, preference?, paidCount)`. The 450 ms latch and the stale guard are kept. |
| Pricing | ESC 5 / 10 / 20 / 40, cap 35 / 75, `LegacyHintProgress` | E3: a family-aware paid count (a shared rung) **behind the flag only**. Production prices only 材料, as today. |
| Pitz charge | Only in the purchase patch | The same; 0 for GUIDANCE_ONLY and for the existence outcome |
| New fact ledger | `discoveryHintFacts[recipeId]` keeps any `<kind>:<value>[:<q>]` | Adds `meta:ingredient-total`, `meta:topping-total` (told only) and `attr:<level>:<value>` (informative only) |
| Legacy ledger | `discoveryHintPurchases`, read-only | Unchanged; `ingredientTotalOwned` is read |
| Persistence / save migration | schemaVersion 2; `HINT_FACT_ID_PATTERN` accepts every new id; unknown ids are kept (H3-2) | **No schema change, no migration.** Tests pin the round-trip and the old-build keep. |
| Reset | Full Reset clears both ledgers; `hintOutcome` is transient | Unchanged. The per-family outcome is transient too. |
| View model (`hintSheetView`) | SELECTABLE: presentation, H0, grandfathered steps, outcome | Adds `deduction: { structure: factId \| null, attribute: factId \| null, legacyStructure: boolean }`, per-family outcomes and `familiesEnabled` (from the flag). **No availability, level, count or candidate field.** |
| HintSheet / App | The H3-4 SELECTABLE body; `onBuySelectable` | Board + family panel (§12). App passes `onRequestHint(family, preference, paidCount)`. **CSS only for `.hint-sheet*`.** |
| Dex | 「💡 ヒントを見る」 → `SHOW_HINT { pinnedRecipeId }` | Unchanged. The pinned target works for every family. |
| Free Cooking | The only mode that opens the sheet (PREPARE) | Unchanged |
| Near-miss | Fixed copy, reads no ledger | Unchanged; a pin test covers `meta:` / `attr:` |
| Onboarding | Dex-0 Margherita → the TARGET flow | Unchanged (no U3) |
| Dinner | `PURCHASE_SELECTABLE_HINT` blocked; `SHOW_HINT` blocked only by PR #252 | Nothing added (the extended action is covered). Test: a Dinner run plus any family request leaves the state byte-identical. |
| Flag | `VITE_PREVIEW_MODE` (a separate save key) / DEV | 構成 / 特徴 cards and purchases are enabled only under the flag (E3) |

## 18. PR #255 compatibility (STEP 11)

| #255 decision | DH4-2 design | Compatible? |
|---|---|---|
| OD-TAX-1: 3 layers | DH4-2 reads only L2 / L1 through DH4-1 | ✓ |
| OD-TAX-2: keep the 7 family ids; do not rebuild the DH4-1 algorithm | All 7 ids kept. The §5.3 guard is an **additive wrapper**: DH4-1's answer function is unchanged. | ✓ with a **caveat**: the wrapper is a new guard, so the Owner approves it explicitly (OD-DH4-2-4) |
| OD-TAX-3: at most L2 displayed; L3 internal | The board shows the family label at most | ✓ |
| OD-TAX-4: k ≥ 2; intersection for multi-axis | One attribute axis only. Successive answers are nested, so the joint is the finest answer. The topping clause is W-guarded. | ✓ |
| OD-TAX-5: one fact per hint; no full signature | Each request returns one fact; the 構成 total + topping clause is one structure fact about counts, not a taxonomy signature | ✓ (PR #255 audit F: total + topping count makes 4 % of complete rows unique, not identifying) |
| OD-TAX-6: role / timing / technique separate | The topping count follows the tray category; finishing / post-bake is never in 構成 or 特徴 | ✓ |
| OD-TAX-7: NEEDS_REVIEW / UNKNOWN not authority | DH4-2 needs no new row. Option (d) needs 2 row changes (pineapple, capers) and is therefore **gated on the Human Classification Gate** | ✓ |
| OD-TAX-8: no 「その他系」 in player copy | 「ちょっと変わった材料があるよ」 is recommended for `other` | ✓ |
| OD-TAX-9: subfamily / sauce / cheese / multi-axis out of scope | Out of DH4-2 scope | ✓ |
| Open items (garlic / capers / black-olive, family table placement, clusters) | Not needed by DH4-2 | ✓ Do not block |

**Result: PR #255 = compatible.**

**One finding to report to the Owner** (PR #255 is not changed):

- PR #255 §5 states that the runtime singleton families are protected by the DH4-1 guard.
- §5.3 shows that the guard protects only the reserve's own class. Singleton families elsewhere in W make the answer *level* invertible (5 cases).
- This does not contradict OD-TAX-1…9. It adds weight to resolving the runtime fruit / spice / other singletons at the Human Classification Gate: option (d).

## 19. Owner Decision table (STEP 12)

| ID | Decision | Options | Evidence | Recommendation | Privacy impact | Implementation impact |
|---|---|---|---|---|---|---|
| **OD-DH4-2-1** | Hint families | 材料 / 構成 / 特徴 as defined in §7 · fewer families | §7; disjoint fact kinds; single-shot | **Adopt §7.** 構成 and 特徴 are single-shot; legacy counts as owned. | No double sale; no negative | Family field on the existing action |
| **OD-DH4-2-2** | Structure / count facts | total only · total + guarded topping clause · per-category counts | §4.2 | **Total + (optional) TC-G clause.** No per-category or remaining counts (OD-DH4-2 stands). | 0 named cases | `structureTotalFact` + clause |
| **OD-DH4-2-3** | Topping count | A · B · C · D · **D′ (TC-G)** · E | §4.2: B and D name the reserve 3/24 and state 「0種類」; D′ 0 / 0; mid-game 1.18–1.50 bits | **D′** if the Owner wants the number (copy 「トッピングは○種類使うよ」, never 0), else E | D′ is W-guarded, no zero | Pure guard + 1 id |
| **OD-DH4-2-4** | Attribute guard and existence-only | Guard (a) / (b) / **(c)** / (d); existence UX A / B / C / **D** | §5.3, §8 | **Guard (c) now → (d) after the Human Classification Gate; existence = D** (no charge, not stored, retry later) | (c) and (d): 0 inversion names; D is safe only with (c) or (d) | An additive wrapper in `deductionHint.ts`; no answer-function change |
| **OD-DH4-2-5** | Pricing / economy boundary | E1 · E2 · **E3** | §9 | **E3**: flag-only purchase of 構成 / 特徴 with a provisional shared ESC rung; production prices in DH4-ECON; never a production 0 price | Uniform price per request | A flag; the family-aware paid count stays behind it |
| **OD-DH4-2-6** | U3 UI | U3-A · U3-B · **U3-C** | §10 | **U3-C** (board → 「ヒントをもらう」 → family cards) | U3-B has a charged exhaustion leak | HintSheet body + panel |
| **OD-DH4-2-7** | Known Information | Sections · timeline · chips · cards · list; keep or drop the 「？」 rows | §13 | **Sections, acquired facts only.** Drop the 「？」 rows and legend (re-opens OD-H3-4-5/6). Adopt the principle 「ヒント本文 > 操作UI」. | Only the player's own knowledge is shown | View model + HintSheet |
| **OD-DH4-2-8** | Vertical layout: **Hint Sheet visible-content capacity** | Layout A · B · **C** (C′) | §11, §12 (measured) | **Layout C**: near-full height, fixed header, scrolling known info, compact footer, safe area on both edges, labelled scroll cue. Capacity bars CAP-1 (390×844 + SA shows the ≈ 330 px board with no scroll), CAP-2 (360×640 + SA ≥ 150 px with the CTA visible), CAP-3 (known ≥ controls everywhere). Re-opens OD-H3-4-7 (45dvh). | None (presentation of owned data) | CSS `.hint-sheet*` + e2e geometry contract |
| **OD-DH4-2-9** | CTA / copy | §14 | §14 | Entry 「ヒントをもらう」 (no price); cards 「たずねる ｜ n Pitz」 / 「たずねる ｜ 支払いずみ」; おまかせ preference; 「ちょっと変わった材料があるよ」 for `other` | No promise of a category or a fact | Copy table |
| **OD-DH4-2-10** | Legacy presentation | §16 | §16 | Keep the archive; derive 構成 ownership; the 「以前のヒント」 tag on the total | No legacy negative promoted | Read-only helpers |
| **OD-DH4-2-11** | PR #255 compatibility | compatible · needs change | §18 | **Compatible**. Record the singleton-inversion caveat for the Human Classification Gate. PR #255 unchanged. | — | none |
| **OD-DH4-2-12** | Implementation slicing | §20 | §20 | **DH4-2A → 2B → 2C → 2D**; production enablement of 構成 / 特徴 after DH4-ECON | Each slice keeps production prices unchanged | Independent rollback per slice |
| **OD-DH4-2-13** | Re-verify HV-3 / HV-4 on a current build | yes / no | §3.1 | **Yes**, on the Pages build or a Preview built from `5a33d85` or later | — | none |

## 20. Recommended implementation slices (STEP 13)

| Slice | Scope | Changed files (expected) | Depends on | Test gate | Rollback boundary |
|---|---|---|---|---|---|
| **DH4-2A: pure authority** (unwired) | The §5.3 guard (c) as a wrapper; the TC-G clause (if approved); `purchaseDeductionHint`; the existence no-charge outcome; single-shot; the fact → copy map | `src/logic/discovery/deductionHint.ts` (+ tests), a new `deductionPurchase.ts` (+ tests), audit test-support | OD-DH4-2-1…4 | Vitest:<br>- the level-inversion regression (this tool's model: 0 names, both inventories);<br>- no 0 stated;<br>- no pre-request FREE LEAK;<br>- monotonic;<br>- ADD_ONE assumed;<br>- legacy;<br>- mutation tests;<br>- tsc, oxlint. | Unwired; revert the files |
| **DH4-2B: runtime wiring behind the flag** | Add `family` to `PURCHASE_SELECTABLE_HINT`; the state helper; one-patch charge; new ledger ids; view-model fields; `familiesEnabled` from `VITE_PREVIEW_MODE` / DEV | `src/state/discoveryHint.ts`, `src/state/gameReducer.ts` (hint cases only), `src/App.tsx` (callback), tests | 2A, OD-DH4-2-5 | Reducer + App tests:<br>- Dinner byte-identity;<br>- near-miss pin;<br>- save round-trip and old-build keep;<br>- Full Reset;<br>- production-flag-off parity with `5a33d85`.<br>Full Vitest. | Flag off = today's behavior; revert touches only the hint cases |
| **DH4-2C: vertical layout + U3 sheet** (production-visible for 材料) | Layout C; board sections; compact footer; family panel (材料 card always; 構成 / 特徴 cards only when `familiesEnabled`); labelled scroll cue; copy | `src/components/HintSheet.tsx` (+ tests), `src/App.css` (`.hint-sheet*` only), e2e hint specs | 2B, OD-DH4-2-6…10 | e2e on 7 profiles:<br>- CAP-1…3;<br>- CTA reachable;<br>- no horizontal overflow;<br>- safe area;<br>- cue matches scroll;<br>- background unmoved.<br>WebKit CI. **Human Verification** (390×844 video delivered directly; before/after screenshots paired with `docs/reports/screenshots/dh4-2-pre-audit/`). | Revert the component + CSS; the runtime is unaffected |
| **DH4-2D: privacy / migration regression pack** | End-to-end privacy sweep (every target × state, the sheet DOM carries no level, count or candidate); legacy-save matrix (H0–H4 × 25); Preview save-key isolation; Dex pin per family | e2e + App tests only | 2C | Full Vitest + full Chromium E2E + WebKit | Tests only |
| DH4-ECON (separate) | Prices and caps for 構成 / 特徴; production enablement (flag flip) | Economy authority + tests | 2D, Owner | Economy simulation | Flag |

**Why persistence is not its own slice:** there is no schema change or migration. The ledger ids ride on H3-2's existing forward-compatible store, and their tests belong to 2B and 2D.

**Why the layout (2C) can ship before DH4-ECON:** it changes no price, and it fixes HV-5 for the existing 材料 family.

## 21. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| The level inversion (§5.3) is kept (guard option (a)) | High for a guard-aware player: names the reserve in 5 cases | Guard (c) / (d) |
| Guard (c) makes 特徴 weak at 25 recipes (existence 13 / 24 early) | Medium (value) | Existence = no charge (§8); (d) after the Human Classification Gate; the catalog growth restores family answers |
| TC-G withholds the topping clause early (passes 11 / 24 on the ladder) | Low | Explained as the single-shot 構成 answer; 23 / 24 late |
| Mozzarella inferred through T instead of bought (3 early recipes) | Low (economy) | DH4-ECON |
| Layout C re-opens OD-H3-4-7 and hides the pizza while reading | Medium (UX) | The sheet is a modal read-then-close step; the app header stays visible; `height: auto` keeps short boards short |
| The flag leaks into production | Medium | E3 test: the production build has `familiesEnabled = false`; the Preview save key is separate |
| Merge conflict with PR #252 in `gameReducer.ts` | Low | DH4-2B touches only the hint cases, never `DINNER_*` sets |
| 172 category gaps change T semantics (drizzles) | Low (future) | Re-audit trigger in §4.4; PR #255's Human Classification Gate |
| The Owner's phone runs an old build | Medium (decision quality) | OD-DH4-2-13 re-verification |

## 22. Non-goals and Final verdict

**Non-goals (this audit):**

- No src, CSS, reducer, persistence, pricing, save-schema or Dinner change.
- No DH4-2 branch; no merge; PR #255, PR #252, PR #243 and Issue #238 are untouched.
- No production price (0 Pitz included).
- No change to the H3 authority.
- No classification decided by guess (the 172 gaps stay gaps).
- No subfamily, sauce or cheese families, multi-axis or technique hints (PR #255 OD-TAX-9).
- No near-miss change.

**Final verdict: A. DH4-2 DESIGN READY FOR OWNER DECISIONS.**

**Answered with machine evidence on the 25 runtime recipes:**

- The topping-count question: D′ (TC-G) or E. A raw count sells 「0種類」 and names the Rule W reserve.
- A new DH4-1 finding (level inversion), with a W-only guard that removes it without changing DH4-1's answer function.
- The existence-only UX, compatible with 「Pitzはヒントが出たときだけ使うよ」.
- The economy boundary (E3).

**Measured on the Hint Sheet (HV-5):**

- Today's layout is ruled out: 138 px of hints under 178 px of controls on an iPhone, and 0 visible rows at 360×640 + SA.
- Layout C gives 566 / 362 px and meets every capacity bar.

**Other:**

- PR #255 is compatible.
- 13 Owner decisions are listed.
- Implementation is split into 4 slices with independent rollback.

**Still open by design** (none blocks DH4-2): the 172 evidence gaps, and the Human Classification Gate for option (d).
