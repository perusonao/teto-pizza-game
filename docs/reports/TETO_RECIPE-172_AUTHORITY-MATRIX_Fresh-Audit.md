# 172 Recipe Authority Matrix — Fresh Audit

**Docs/data/tools only. Not an authority.**
- **No production change:** no runtime recipe, no `src/**` change, no Wave 2 activation.
- **Not changed:** taxonomy, Hint 5.0, Cooking Techniques and Cooking Steps.
- **Consumer, not decider:** this audit reads the other lanes' authorities. Where no authority exists, it records **CANDIDATE** or **MISSING**. It never decides the value from culinary common sense.

| Deliverable | Path |
|---|---|
| Report (this file) | `docs/reports/TETO_RECIPE-172_AUTHORITY-MATRIX_Fresh-Audit.md` |
| Machine-readable matrix | `docs/reports/data/TETO_RECIPE-172_AUTHORITY-MATRIX.json`: 172 rows, plus a summary |
| CSV companion | `docs/reports/data/TETO_RECIPE-172_AUTHORITY-MATRIX.csv`: 42 columns, 1 row per recipe |
| Generator / checker | `tools/recipe172_authority_matrix.py`. `--check` reports byte drift. It reads **pinned git objects only**, so it is deterministic. It is not in CI. |

---

## 1. Audited main and consumed authorities

- **Audited `main`:** `86b48fd51423a8f76db5398ab88ecfd944e2ae10` (Merge PR #291), from a fresh fetch on 2026-09-28.
- **Runtime on that main:**
  - 25 recipes and 29 ingredients;
  - 22 DH4-1 taxonomy rows;
  - 1 registered technique (`no-sauce`).

| Authority | Source (pinned) | Status used here |
|---|---|---|
| 172 evidence (identity sets, sauce base, dough, pan, blockers, capabilities) | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` @ main | Evidence authority |
| Runtime recipes / ingredients / categories | `src/data/recipes.ts`, `src/data/ingredients.ts` @ main | Production authority |
| Hint taxonomy families | `src/data/ingredientTaxonomy.ts` @ main (DH4-1, 22 rows) | Production authority |
| Taxonomy coverage tiers, proposed categories and families | PR #293 @ `1bb4f9d` (Hint 5.0 Taxonomy Coverage audit) | **Reference, not authority.** Consumed as is. |
| Proposed families (OD-TAX-1..9 recorded) | PR #255 @ `e221e36` | PROPOSED only (OD-TAX-7) |
| Hint 5.0 key / sub roles | `src/data/recipeHintRoles.ts` @ `abce62a` (Issue #292: H5-1 approved, H5-2 done; **no PR, not on main**) | Authority for the runtime 25 only |
| Cooking Techniques | `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`, `src/data/techniques.ts` @ main; OD-TQ-2 classification | Authority: only `no-sauce` exists |
| Cooking Steps mechanic class and CS phases | PR #295 @ `7d48669` (Post-W1 Cooking Steps design) | **Reference, not authority** |
| Wave 2 decisions and the W2-A set | `TETO_WAVE2_OWNER-DECISION-LEDGER.md` and candidates @ `2bc40e4` (branch, not merged) | OD-W2-1..7 / A1..A8 APPROVED; OD-W2-8 / 9 OPEN |

**Parallel lanes that were not touched:**
- Hint 5.0 Taxonomy Coverage (PR #293)
- Cooking Techniques 1.0 / Post-W1 Cooking Steps (PR #295)
- Hint 5.0 (#292)
- Large Catalog UX (PR #272)
- my own PR #255

## 2. Method and class definitions

Each row carries **every** blocker it has (`productionBlockers[]`, tagged with a class and an owner lane). `classification.all` keeps every class, and `classification.primary` is the most blocking class under this precedence: **F > E > D > C > B > A**.

| Class | Meaning | Where it comes from (consumer rule) |
|---|---|---|
| **A** | Can ship on the current engine with current authority | A runtime recipe whose ingredient set is EXACT and that has no blocker |
| **B** | Needs only a data authority addition | new ingredient rows, a new single paint sauce, CUT profile, recipe authoring values, taxonomy rows after HCG, Hint 5.0 key / sub authoring |
| **C** | Needs a small engine extension | PR #295 SMALL_ENGINE mechanics (post-bake late, DOUGH_VARIANT, STEP_ORDER, ZONED) **plus NO_SAUCE** (see note) |
| **D** | Needs a major mechanic | PR #295 MAJOR mechanics (multi-spread, mid-bake, pan, shape, enclose, prep, laminate, fry) |
| **E** | Authority is insufficient | matrix hard blockers: BASE_SAUCE_UNSPECIFIED, COMPOSITION_CONFLICT_*, DISCOVERY_COLLISION, EVIDENCE_GAP, SCOPE_QUESTION, MECHANIC_INTERPRETATION; an unresolved late mode |
| **F** | Ingredient ID / taxonomy blocker | an unresolved ingredient token, or PR #293 tier NEEDS_HCG_DECISION |

**Note on NO_SAUCE:** PR #295 files no-sauce as DATA_ONLY *after* TQ-1D. TQ-1D is not shipped, and it changes `ReferencePizza.sauce` and the UI (TQ SSOT §6). So here it is a **C** dependency. Each affected row records this in `engineAxisNote`.

**Applied Owner decision:** OD-W2-7 (a) makes vongole an olive-oil base, so it is not a no-sauce row. The row records this in `approvedOverride`.

## 3. Headline counts

| # | Item | Count |
|---|---|---:|
| 3 | Recipes audited | **172** |
| 4 | Fully authority-complete (A) | **11**. All are runtime recipes whose ingredient sets are EXACT. **0 new rows are A.** |
| 5 | Data-only (primary B) | **17**. 9 of them are the approved W2-A set. |
| 6 | Small engine (primary C) | **24** |
| 7 | Major mechanic (primary D) | **16** |
| 8 | Authority insufficient (primary E) | **39** |
| 9 | Ingredient / taxonomy blocked (primary F) | **65** |
| 10 | Hint 5.0 production-ready (all 4 checks) | **14** = 11 runtime EXACT + 3 zero-topping rows (§5) |

**Non-exclusive counts (rows carrying the class at all):** F 65 · E 72 · D 37 · C 76 · B 161 · A 11.

**Runtime mapping:**
- 11 rows are EXACT.
- **9 rows are DIVERGENT:** the same dish as a runtime recipe, but with a different ingredient set.
- 152 rows have no runtime recipe.
- 5 runtime recipes have no 172 row: funghi, napoletana, pepperoni, pizza-bianca, salsiccia.

**Current engine expressibility (main):** EXPRESSIBLE_NOW 13 · EXPRESSIBLE_WITH_DATA_ONLY 30 · NOT_EXPRESSIBLE 129.
- The 2 non-shipped EXPRESSIBLE_NOW rows are **bismarck-pizza-pizzadb-p7**, which is DIVERGENT, and **brazilian-calabresa-pizzadb-p10** (W2-A).

## 4. Blocker summary

| Blocker code | Rows | Class | Owner lane |
|---|---:|---|---|
| RECIPE_AUTHORING_VALUES | 161 | B | recipe authoring |
| HINT5_KEY_SUB_AUTHORING | 157 | B | Hint 5.0 (#292) |
| NEW_INGREDIENT_DATA | 126 | B | ingredient authoring |
| TAXONOMY_ROWS_AFTER_HCG | 59 | B | Hint 5.0 Taxonomy HCG |
| TAXONOMY_NEEDS_HCG_DECISION | 45 | F | Hint 5.0 Taxonomy HCG |
| NO_SAUCE | 43 | C | TQ-1D / OD-W2-8 |
| DOUGH_VARIANT | 33 | C | Cooking Steps CS-7 |
| BASE_SAUCE_UNSPECIFIED | 33 | E | Owner |
| UNRESOLVED_INGREDIENT_TOKEN | 24 occurrences (21 rows) | F | canonicalization / HCG |
| COMPOSITION_CONFLICT_CANDIDATE / _SHIPPED | 18 / 9 | E | Owner |
| MULTI_SPREAD_LAYER | 17 | D | CS-6 / TQ-3 |
| NEW_PAINT_SAUCE_PROFILE | 17 | B | recipe authoring |
| MECHANIC_INTERPRETATION | 11 | E | Owner / Cooking Steps |
| LATE_ADDITION post-bake / mid-bake | 8 / 3 | C / D | CS-3 = TQ-2 / CS-9+ |
| PAN_BAKE | 8 | D | CS-9+ |
| CUT_PROFILE | 7 | B | recipe authoring (OD-W2-4) |
| ENCLOSE / DOUGH_SHAPE_TARGET | 5 / 5 | D | CS-9+ |
| PREP_STEP | 3 | D | CS-9+ |
| STEP_ORDER / ZONED_PLACEMENT | 2 / 1 | C | CS-8 |
| DISCOVERY_COLLISION / EVIDENCE_GAP / SCOPE_QUESTION | 2 / 2 / 2 | E | Owner |
| FRY_COOK / LAMINATE / late mode unresolved | 1 / 1 / 1 | D / D / E | CS-9+ / Owner |

**What drives F.** The most frequent F causes (occurrences in F rows) are:
- `beef` ×9 (the beef / steak / ground-beef cluster);
- `green-onion` ×6;
- 唐辛子 ×5, ひき肉 ×5;
- `nori` ×4;
- チーズ ×3.

A handful of HCG decisions therefore unblocks many rows. Of the 65 F rows, 33 are also E and 12 are also D.

**What drives E (primary).** COMPOSITION_CONFLICT_CANDIDATE 14 · BASE_SAUCE_UNSPECIFIED 13 · COMPOSITION_CONFLICT_SHIPPED 7 · MECHANIC_INTERPRETATION 3 · EVIDENCE_GAP 2 · DISCOVERY_COLLISION 2.

## 5. Hint 5.0

**The runtime 25 key / sub authority is read, not changed** (`recipeHintRoles.ts` @ `abce62a`).

**Key topping authority status:**

| Status | Rows | Meaning |
|---|---:|---|
| AUTHORITY_EXISTS | 11 | The runtime set is EXACT, so the approved roles apply |
| CANDIDATE_ONLY | 60 | A candidate exists, but it is **not** authority. Its basis is one of:<br>- the only topping (25 rows);<br>- named in the recipe name (28 rows; this is H5-0 §6.4 tie-break step 1, a guideline candidate only);<br>- the runtime key of a DIVERGENT dish (7 rows). |
| MISSING | 97 | No candidate. This includes 2 rows where the recipe name names more than one topping. |
| NOT_APPLICABLE_NO_TOPPING | 4 | 0 toppings. G17 sets key = null (the quattro-formaggi C1a precedent). |

**Sub-topping order authority:** AUTHORITY_EXISTS 11 · NOT_NEEDED_0_SUBS 26 · FORCED_1_SUB (candidate) 10 · NOT_APPLICABLE 4 · MISSING 121.

**C1-P risk:** in 5 rows the candidate key is an aroma (herb or spice) while a main topping exists: apple-cinnamon, jalapeno-popper, peruvian-aji-amarillo, ume-shiso, wasabi-beef. This is why name matching must stay a candidate.

**Hint 5.0 production eligibility (the 4 checks):**

| Check | Rows passing |
|---|---:|
| All ingredient ids resolve | 120 |
| Role / category resolves (runtime or catalog category) | 64 |
| Every hint-eligible topping has exactly one **production** family | 56 |
| Key / sub authority exists | 15 |
| **All 4** | **14** |

**About the 14 ready rows:**
- 11 are runtime EXACT rows.
- 3 are zero-topping rows: quattro-formaggi-pizzadb (DIVERGENT), trenton-tomato-pie and ny-style. Their Hint side passes trivially, but they have no recipe authority. Hint P3 / P4 (「なし」) is still open in #292.
- The 11 runtime roles are approved but are **not on main** yet (Hint 5.0 H5-3 / H5-4 pending).

## 6. Cooking Technique and Cooking Steps dependencies (consumer view)

| Mechanic | Rows | Technique status (TQ authority) | Candidate CS phase (PR #295) |
|---|---:|---|---|
| NO_SAUCE | 43 (44 in the matrix; vongole dropped by OD-W2-7) | **Registered** `no-sauce` (TQ-1). The production requirement comes with TQ-1D. OD-W2-8 is open. | none (DATA_ONLY after TQ-1D) |
| DOUGH_VARIANT | 33 | Not a technique (OD-TQ-2 C2) | CS-7 |
| MULTI_SPREAD_LAYER | 17 required + 10 candidate | CANDIDATE / REVIEW: OD-TQ-2 → TQ-3. No id. OD-W2-9 open. | CS-6 |
| LATE_ADDITION post-bake | 8 required + 11 candidate | CANDIDATE / REVIEW: OD-TQ-2 → TQ-2. No id. OD-TQ-12: candidates are not promoted. | CS-1 → CS-2 → CS-3 |
| PAN_BAKE / DOUGH_SHAPE_TARGET / ENCLOSE | 8 / 5 / 5 | CANDIDATE / REVIEW: the OD-TQ-2 later tier | CS-9+ |
| LATE_ADDITION mid-bake / PREP / FRY / LAMINATE | 3 / 3 / 1 / 1 | CANDIDATE / REVIEW | CS-9+ |
| STEP_ORDER / ZONED | 2 / 1 (+2 candidate) | CANDIDATE / REVIEW: not classified by OD-TQ-2 | CS-8 |
| NO_CUT / CUT unspecified | 7 | Not a technique (OD-TQ-2; OD-W2-4) | data (CUT profile) |

**Rows per dependency:**
- **TQ / CS dependency:** 98 rows have at least one engine-lane dependency (C / D / E mechanic).
- **Technique dependency by status:** TQ_REGISTERED 43 · CANDIDATE / REVIEW 80 (55 required + 25 candidate-only capabilities) · NOT A TECHNIQUE 40.
- **No new technique id or step semantics** were created. Every non-`no-sauce` technique stays "candidate / review required".

**Cross-check with PR #295 (`classPR295 → primary`):**
- CURRENT_ENGINE 15 → A 11 / B 1 / E 1 / F 2. The F cases, baiana and chilena, carry unresolved tokens that PR #295 does not count.
- DATA_ONLY 59 → B 15 / **C 16 (NO_SAUCE)** / E 9 / F 19.
- The Wave 2 classes differ in the same way. Wave 2 puts DOUGH_VARIANT in D, whereas this audit follows PR #295 and puts it in C.

## 7. Mechanic flags

Each flag is REQUIRED, CANDIDATE, UNKNOWN or NO.

| Flag | REQUIRED | CANDIDATE | UNKNOWN |
|---|---:|---:|---:|
| no-sauce | 43 | — | 36 (sauce unspecified or unresolved) |
| no-cheese | 16 | — | 52 (incomplete rows) |
| topping-less | 3 (quattro-formaggi-pizzadb, trenton, ny-style) | — | 52 |
| late addition (post-bake) | 8 | 11 | — |
| mid-bake addition | 3 | — | 1 |
| multi-spread | 17 | 10 | — |
| special dough | 33 | — | — |
| pan | 8 | — | — |
| boat shape | 1 (pide) | — | — |
| fold / enclose | 5 | — | — |
| fry | 1 (pizza-fritta) | — | — |
| other | STEP_ORDER 2 · ZONED 1 (+2 candidate) · PREP 3 · LAMINATE 1 · DOUGH_SHAPE_TARGET 5 · NO_CUT 7 · SERVE_FORM (candidate) 2 | | |

## 8. Phase / wave candidate grouping

`eligiblePhaseWave` is **candidate** grouping. Only the approved sets are firm.

| Group | Rows | Basis |
|---|---:|---|
| SHIPPED (runtime, EXACT) | 11 | runtime |
| SHIPPED_AS_DIFFERENT_COMPOSITION | 9 | DIVERGENT from runtime. Needs OD-AM-1 before any change. |
| **TQ-1D** (aussie) | 1 | OD-TQ-18 APPROVED |
| **W2-A** | 9 | OD-W2-3 / 6 and A1–A8 APPROVED. Branch `2bc40e4`, not merged. |
| Candidate: data-only after W2-A | 8 | primary B |
| Candidate: after TQ-1D + OD-W2-8 (W2-C) | 14 (+3 combined with CS-7) | NO_SAUCE |
| Candidate: after CS-6 / TQ-3 + OD-W2-9 (W2-D) | 9 | MULTI_SPREAD |
| Candidate: after CS-3 / TQ-2 | 1 (bbq-chicken) | post-bake |
| Candidate: after CS-7 | 4 (+4 with CS-9+) | DOUGH_VARIANT |
| Candidate: after CS-8 | 2 | STEP_ORDER / ZONED |
| Candidate: after CS-9+ | 2 | major |
| **BLOCKED:** HCG / canonicalization first | 63 | F (the 2 W2-A / TQ-1D exceptions aside) |
| **BLOCKED:** authority / Owner decision first | 32 | E |

**B-primary rows (the data-only candidates):**

| Recipe | Name | Group | New ingredient data | New paint sauce | Toppings without a production family (W2-A branch rows) | Key authority: candidate | Sub order |
|---|---|---|---|---|---|---|---|
| `calabresa-argentina-pizzadb` | アルゼンチン風カラブレーサ | candidate | salami | — | salami | MISSING | MISSING |
| `vongole-pizzadb` | ヴォンゴレピザ | W2-A | parsley | — | parsley (parsley) | MISSING | MISSING |
| `flammkuchen-pizzadb` | タルトフランベ | W2-A | fromage-blanc-sauce | fromage-blanc-sauce | — | MISSING | MISSING |
| `eggplant-tahini-pizza-pizzadb-p5` | ナスとタヒニのピザ | candidate | parsley, pomegranate, tahini | tahini | parsley, pomegranate (parsley) | CANDIDATE: eggplant | MISSING |
| `eggplant-dengaku-pizza-pizzadb-p6` | ナス田楽ピザ | candidate | miso-sauce, white-sesame | miso-sauce | white-sesame | CANDIDATE: eggplant | FORCED_1_SUB (candidate) |
| `baba-ganoush-pizza-pizzadb-p7` | ババガヌーシュピザ | candidate | parsley, pine-nuts | — | parsley, pine-nuts (parsley) | MISSING | MISSING |
| `jamon-serrano-pizza-pizzadb-p7` | ハモンセラーノピザ | W2-A | arugula, prosciutto-crudo | — | arugula, prosciutto-crudo (both) | MISSING | MISSING |
| `brazilian-calabresa-pizzadb-p10` | ブラジリアン・カラブレーザ | W2-A | — | — | — | MISSING | MISSING |
| `prosciutto-funghi-pizzadb-p11` | プロシュットフンギ | W2-A | prosciutto-crudo | — | prosciutto-crudo (yes) | MISSING | MISSING |
| `veggie-supreme-pizza-pizzadb-p11` | ベジースプリームピザ | candidate | green-pepper | — | green-pepper | MISSING | MISSING |
| `pesto-gamberi-pizzadb-p11` | ペストガンベリピザ | W2-A | shrimp | — | shrimp (yes) | MISSING | MISSING |
| `pesto-salmone-pizzadb-p11` | ペストサーモンピザ | candidate | cream-cheese, lemon, salmon | — | lemon, salmon | CANDIDATE: salmon | FORCED_1_SUB (candidate) |
| `pesto-trapanese-pizzadb-p11` | ペストトラパネーゼピザ | candidate | almond | — | almond | MISSING | MISSING |
| `pesto-vegetariana-pizzadb-p12` | ペストベジタリアーナピザ | W2-A | bell-pepper, zucchini | — | bell-pepper, zucchini (both) | MISSING | MISSING |
| `pesto-pollo-pizzadb-p12` | ペストポッロピザ | W2-A | chicken | — | chicken (yes) | MISSING | MISSING |
| `ratatouille-pizza-pizzadb-p13` | ラタトゥイユピザ | W2-A | bell-pepper, zucchini | — | bell-pepper, zucchini (both) | MISSING | MISSING |
| `rucola-e-grana-pizzadb-p13` | ルーコラエグラーナピザ | candidate | arugula, grana-padano, prosciutto-crudo | — | arugula, prosciutto-crudo (both) | MISSING | MISSING |

**Key point:** none of the 9 W2-A recipes has **Hint 5.0 key / sub authority**. The W2-A authoring predates Hint 5.0. If Hint 5.0 is enabled before W2-A lands, W2-A needs key / sub authoring (OD-AM-7) and must pass the T-COV fail-fast gate.

## 9. Owner Decision queue

These decisions are recorded, not made. Each one has an owner lane. Several are **not this lane's to decide**.

| ID | Decision | Rows | Owner lane |
|---|---|---:|---|
| **OD-AM-1** | Runtime composition divergence: keep the runtime recipe, or add the PIZZA DB row as a separate recipe (capricciosa, quattro-formaggi, margherita, bismarck, fugazza, breakfast, genovese, marinara, meat-lovers) | 9 | Owner / recipe authority |
| **OD-AM-2** | Base sauce unspecified: which sauce, or none | 33 | Owner |
| **OD-AM-3** | Composition conflict with a catalog candidate | 18 | Owner |
| **OD-AM-4** | Mechanic interpretation / scope question / evidence gap / discovery collision | 17 | Owner (+ Cooking Steps) |
| **OD-AM-5** | Matrix review items (naming cluster, candidate capability, same set as catalog, prepared composite, …) | 40 | Owner |
| **OD-AM-6** | HCG / canonicalization (beef cluster, green-onion, the chili tokens, ひき肉, nori, チーズ, …) | 65 | **Hint 5.0 Taxonomy lane (PR #293)** |
| **OD-AM-7** | Hint 5.0 key / sub authoring for 172 rows, and whether H5-0 §6.4's tie-break becomes the guideline | 157 | **Hint 5.0 (#292)** |
| **OD-AM-8** | P4 「なし」 rung applies (no-sauce or no-cheese rows) | 59 | **Hint 5.0 (#292) P4 / P4b** |
| **OD-AM-9** | Technique authority for post-bake (TQ-2) and multi-spread (TQ-3), and promotion of candidate-only capabilities | 44 | **Cooking Techniques / Cooking Steps (PR #295)** |

Related open decisions in other lanes, not duplicated here: OD-W2-8 (no-sauce scoring in W2-C), OD-W2-9 (second-layer gesture), OD-CS-1..19 (PR #295), and M3 / P4 / P4b / M2 (#292).

## 10. Dependencies map

```
                   ┌─ HCG / canonicalization (PR #293 lane) ── unblocks F (65) ─┐
172 evidence ──────┤                                                            ├─> recipe authoring (B) ─> wave
(matrix @ main)    ├─ Owner decisions OD-AM-1..5 ── unblocks E (39) ─────────────┤        │
                   │                                                            │        └─ Hint 5.0 key/sub (OD-AM-7, #292)
                   └─ engine lanes:                                            │            + T-COV fail-fast (production family)
                        TQ-1D ──────────────> no-sauce rows (W2-C, OD-W2-8) ───┤
                        CS-1 → CS-2 → CS-3 = TQ-2 ──> post-bake rows ───────────┤
                        CS-6 = TQ-3 (OD-W2-9) ──> multi-spread rows (W2-D) ─────┤
                        CS-7 ──> dough-variant rows ────────────────────────────┤
                        CS-8 ──> STEP_ORDER / ZONED ────────────────────────────┤
                        CS-9+ ──> pan / shape / enclose / prep / mid-bake / fry ┘
Also: Large Catalog UX (PR #272, OD-W2-LC) before Wave 3; LAD-1 append-only ladder (OD-W2-1) for every new recipe.
```

## 11. Recommended next data-only phase

**DA-1: an authority pack for the 17 B-primary rows (docs/data only).** It needs no engine, technique or step work. It closes the gaps each B row lists:

1. **Taxonomy rows after HCG.** 35 B / C / D rows need taxonomy rows that PR #293 rates DATA_ONLY_AFTER_HCG (PROPOSED families awaiting HCG approval). The W2-A families (7) are already approved under OD-W2-5 on the Wave 2 branch. **Owner: the Hint 5.0 Taxonomy HCG.** It is consumed here, not decided.
2. **Hint 5.0 key / sub authoring** for the B rows: the 9 W2-A rows first, then the 8 candidate rows. **Owner: #292 (OD-AM-7).** It needs the authoring guideline decision (§6.4 tie-break) first.
3. **Recipe authoring values** (nameJa, description, minCount, bakeTarget, reference, CUT) for the 8 non-W2-A B rows, through the same Authoring Gate style as W2-A (OD-W2-6).

**Before DA-1, the cheapest high-leverage step** is an **HCG focus on the beef cluster, green-onion, the chili tokens, ひき肉 and nori**. These are the top F causes (§4), and resolving them moves the most rows out of F. It belongs to the taxonomy lane.

**Not recommended now:** anything touching the C / D rows before TQ-1D, CS-1 and the TQ-2 / TQ-3 decisions exist.

## 12. Non-goals / not changed

- No runtime recipe, no `src/**`, e2e, CSS or test change; no production data change.
- No taxonomy family, category or alias change. Families are consumed from main (production) and PR #293 (reference).
- No Hint 5.0 change. The runtime 25 key / sub roles are unchanged, and no 172 key or sub order is made authority.
- No Cooking Technique id, no Cooking Steps semantics, no Wave 2 activation, no Large Catalog UX work.
- No merge. PR #255, #272, #275, #293 and #295 are untouched.

**Verdict:** a docs-only audit, complete. It STOPs here. No production implementation.
