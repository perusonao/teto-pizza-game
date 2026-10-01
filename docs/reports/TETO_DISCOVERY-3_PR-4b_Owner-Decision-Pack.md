# Discovery 3.0 PR-4b — Owner Decision Pack

Docs-only / read-only. No `src` / test / e2e change, no PR-4b implementation, no `brazilian-calabresa` in production, #295 untouched,
no contact with the PR-4a post-merge hardening branch. Nothing here is a recommendation: it is comparison material for the Owner.

- Base: `origin/main` `52d14f9` (PR-4a #327 merged). This branch = `origin/main` + this file only.
- Read: #327 Result Report, PR-1 Result, `recipes.ts`, `hintTarget.ts`, `recipeDiscoveryState.ts`, `DexOverlay.tsx`, `mission/lunchRush.ts`,
  `data/orders.ts`, `cookingProfiles.ts`, `referencePizza.ts`, `completionGate.ts`, `pitzReward.ts`, `discoveryLadder.ts`, `recipeChapters.ts`,
  the 172-recipe evidence / candidate matrix, PROGRESSION2 unlock graph, I5b Fresh Audit, and #295 (read-only via GitHub: title / file list / cookingProfiles patch).
- **Not on `main`:** the Pre-PR4 Gate and the S1/S2 gates (`OD-D3-17/19/20/21/22/23/24` full text) live on audit branches. This pack only relies on how
  `main` code and the #327 report cite them. Verify against the originals before treating any OD number below as final.
- Not run: no tests / build (no `node_modules`; not needed for a docs pack). All code facts are by reading.

## 0. Common facts used by every item

| fact | source |
|---|---|
| Candidate = `brazilian-calabresa` (`brazilian-calabresa-pizzadb-p10`). PIZZA DB row: ソーセージ / 玉ねぎ / **オリーブ** / オレガノ, sauce family トマトソース, dough 「薄めの生地」, origin ブラジル/サンパウロ | `TETO_PIZZADB_172_MASTER-EVIDENCE.json` |
| Evidence is a **comparison-table sample**, "relayed, not independently re-fetched by this Claude session", corroborationCount 0 | same |
| The row has **no quantity, bake, placement or cheese-intent evidence** | same; `referencePizza.ts` header: "the PIZZA DB … has no quantity evidence for any ingredient" |
| Candidate matrix: ingredients `black-olive, onion, oregano, sausage` (+ tomato-sauce), `オリーブ → black-olive` is dispositioned **`likely_alias`** (the other three `exact_alias`); `productDecisionStatus READY_WITH_REVIEW`, review item NAMING_CLUSTER (NC-4 vs `calabresa-argentina`) | `…GAME-DESIGN-CANDIDATE_MATRIX.json` |
| No exact-ingredient-set collision with the 25 (collisionRefs `[]`) | same |
| Ladder: sausage = step 7, black-olive/oregano = step 11, onion = step 12. Key step of the candidate = **12 = the same step as `pizza-portuguesa`** (W1 step 12 key recipe) | `W1_25_DISCOVERY_LADDER`, `recipeKeyStep` |
| `ladderCredit: false` (OD-D3-17 O3) exists; the candidate is expected to use it so it never advances the W1 ladder | `recipes.ts`, #327 §3 |
| The #327 synthetic fixture B (`tomato-sauce 1, sausage 2, onion 2, black-olive 2, oregano 1`, bake 58–78) and the 26-recipe dry-run placeholder are **test scaffolding**, not authority (#327 §5-C says reference / quantity / bake are OD-D3-24, unresolved) | `branchingFixture.ts`, #327 §5 |
| Remaining #327 dry-run failures: A (25→26 mechanical pins) is mechanical; **C (authoring/data) = `scoringV2.noSauceParity` rows, `dinnerResultDetection` bake-window count, `cookingProfiles` CUT + step table, reference placement/quantity/bake** | #327 §5 |

Pool = 2 exists only at the step-12 branch point (`pizza-portuguesa` + candidate both DISCOVERABLE once onion is owned and in stock). Everywhere else the pool stays 1.

---

## 1. pool > 1 auto-target policy

**Facts**
- `selectHintTarget` orders candidates by `recipeKeyStep` asc → distinct-ingredient-count asc → `RECIPES` declaration index (`hintTarget.ts`). A Dex card pins its own recipe; a revealed target is sticky.
- #327 pins that the target is **a pool member and deterministic for a given state**, and that array order is not authority. It does **not** pin *which* member is chosen — that was left to this decision. The comparator is a pre-3.0 W1 heuristic for a one-element pool.
- Applied to the branch: both have key step 12; distinct ingredient count: candidate **5** (tomato-sauce, sausage, onion, black-olive, oregano) vs portuguesa **6** (tomato-sauce, mozzarella, ham, egg, onion, black-olive). **The current comparator would auto-target the non-credit candidate first**, purely as a tie-break side effect (by reading; not executed). That is not a designed outcome and must not be treated as spec.
- Hint spend (H3/H4/H5 ladder) is priced against the W1 path; a hint spent on the non-credit recipe does not advance the ladder.

**Open:** which pool member does a hint default to when the player pinned nothing? Also whether a key-free candidate (no authored Hint 5 key, OD-D3-21) can be an auto-target at all.

| option | rule | player-visible effect | Discovery experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Credited (ladder) recipe first, then non-credit; existing comparator within each group | the "main path" pizza is hinted by default; the side pizza only via its Dex card | main path stays guided; the side recipe reads as an optional find; no hint "wasted" off-ladder | `compareHintCandidates` gains a credit key; tests pin it | no change (pool 1) |
| B | Keep the current comparator (key step → ingredient count → index) | **candidate hinted first at step 12** (by reading) | the player's first hint at that branch points at a pizza that does not unlock anything; the ladder pizza needs a Dex pin | none | no change |
| C | No auto-target when pool > 1: the sheet asks the player to pick a 🎨 card (hint requires a pin) | a "pick which one" state replaces the auto hint | strongest "you choose" feel; but also tells the player a choice exists (see item 2); extra tap for hint 1 | new empty/choose state in sheet + reducer; `HintTarget` union grows | none, but new UI states need HV |
| D | Non-credit first (explicit) / stable by recipe id | like B but intentional | favours exploring side pizzas | comparator rewrite | none |

**Preview/HV:** step-12 save (Dex 11 discovered, onion bought) → open HintSheet from Free Cooking (no pin) and from each Dex card; confirm which pizza the sheet talks about, that sticky behaviour survives after purchase, and that the other path is still reachable. Hint economy sims (byte-identical for 25 today) need a decision on which choice policy is the "expected" one.

---

## 2. Dex 🎨 representation / candidate-count leakage

**Facts**
- Undiscovered slots show 🎨 「今の材料で作れるかも」 when `recipeDiscoveryState = DISCOVERABLE` (`DexOverlay.tsx`). Each such card has its own 「💡 ヒントを見る」 button. Name/ingredients are not shown.
- In W1 exactly one DISCOVERABLE exists at any time, so "one 🎨 card = the next pizza" is already learnable; 2 cards would be the first time the count is >1.
- At pool = 2 the Dex shows **two 🎨 cards** (chapter 2 section; the chapter counter `n/10` and the total `あとN種類` are unchanged by pool size). So the player can read "2 makeable now".
- Leak routes besides the 🎨 tag: HintSheet per-card pin (each card yields its own hint), HOME / Pizza Select derived badges (not re-audited here — a PR-4b audit step), `RECIPES.length` (26) in `🍕 発見 n / 26`, chapter totals (6/9/10 → 6/**10**/10 per #327 §5-A: the candidate sits in chapter 2).
- Count itself is not an oracle of *which* recipe, but it tells "an extra non-ladder pizza exists with the current materials". It also lets players infer that finding one does not remove the other (pool shrink is pinned by #327).
- Note: a **non-credit** recipe never moves the ladder, so after discovering it the player sees the 🎨 count fall without any new Shop unlock — a visible asymmetry.

| option | representation | player-visible | Discovery experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Show every DISCOVERABLE card as 🎨 (current behaviour) | 2 × 🎨 at the branch | honest and simple; player knows two things are makeable; invites trying both | none | none |
| B | At most one 🎨 per "group"; the other card shows 「まだ見ぬピザ」 (non-tagged) | 1 × 🎨 | keeps the "one next pizza" feel; but the second recipe is hidden from the Dex hint path (only Free Cooking can find it); makes the Dex lie about state | `renderSlot` tag rule needs a pool-aware choice (which card?) — reuses item 1 | none |
| C | Single neutral tag for the whole pool (e.g. one banner 「今の材料で作れるかも ×N」 / or 🎨 on both but no per-card hint) | count shown explicitly, or both cards tagged identically with hints only via sheet | removes per-card identity; count is **explicit** (opposite of leak avoidance) | new UI | none |
| D | Tag both, but no per-card hint button when pool > 1 (hint only via Free Cooking sheet, item 1) | 2 × 🎨, fewer buttons | smaller leak surface for pinning; still shows count | small | none |

**Preview/HV:** branch-point save → Dex screenshots at 390×844, count of tagged cards per option; confirm chapter header counts, HOME bubble and Pizza Select never name the candidate. Check `data-dex-state` attributes in the DOM (card DOM must not carry the recipe id — existing 229-D rule). A leakage tripwire test (card count ≠ info about identity) is a PR-4b deliverable once A–D is chosen.

---

## 3. Lunch Rush participation

**Current code facts (not policy)**
- Lunch Rush pool = `availableRecipeIds ∩ DISCOVERED`, then `getNextOrder` picks `ORDERS.filter(recipeId ∈ pool)` randomly (`mission/lunchRush.ts`, `data/orders.ts`). A discovered recipe **with no ORDERS entry is silently never ordered**; **but `recipes.test.ts` pins "every recipe has exactly one order"**, so adding a recipe without an order fails the suite today.
- The same `ORDERS` also feed guided/free orders (`getNextFreeOrder`) and **`startPreparingRecipe` returns `null` when `findOrderForRecipe` is missing** → Pizza Select cannot start a guided round for that recipe.
- Completion policy in Lunch Rush = `"order"`: every ingredient needs its full `minCount` (item 5 directly changes Lunch Rush difficulty). Per-run ranking scores must stay comparable (OD-4 LR-A).
- Lunch Rush never discovers; only DISCOVERED recipes appear, so the candidate would join the rotation only after being found. Pool size grows 25 → 26 (≈4 % more variety); ranking formula unchanged.
- Dinner Mission targets are fixed lists (`dm-a`, `dm-b`); the candidate is in neither.

**Open (product policy):** should a non-credit branch recipe appear in Lunch Rush and as a guided order at all?

| option | rule | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Full participation: add an `Order` (id, 台詞 `lineJa`) like the 25 | appears in LR rotation and Pizza Select guided start | consistent product; one more order line to write; LR difficulty depends on item 5 (minCount) and item 6 (bake) | order + line copy; test count 26 | none |
| B | Discoverable but **excluded from Lunch Rush** (flag, e.g. `lunchRush: false`), still guided-startable | not in LR | keeps LR ranking baseline identical; a flag the 25 omit | new optional field + filter in `missionOrderRecipeIds`; relax "exactly one order" pin or give an order anyway | none |
| C | Excluded from LR **and** guided Pizza Select (Free Cooking only) | never ordered | pure side-discovery pizza | flag + `startPreparingRecipe` handling; Pizza Select/Result "again" paths audit | none |

**Preview/HV:** Lunch Rush run seeded with the candidate discovered (and with it undiscovered — must not appear, fail-closed); Pizza Select card/state; order line copy; ranking submit unaffected. Ranking comparability evidence (same-seed run with/without) if A.

---

## 4. cheeseなし authority

**Facts**
- Evidence lists 4 ingredients and no mozzarella; the master evidence note says "omits mozzarella" — this is **absence in a comparison-table sample**, not a source statement that the pizza is cheese-free. Sibling `calabresa-argentina` (mozzarella + salami + olive + oregano) shows regional variants differ on cheese.
- Precedents already in the game: `marinara` (explicitly 「チーズを使わない」), `puttanesca-pizza`, `pesto-tonno` (cheese-free, I5b), `pizza-bianca`. `deriveCoreSteps` removes the CHEESE tab automatically when no cheese-category ingredient is required; the sauce-profile / `noSauceParity` snapshot rows are per-recipe.
- Matching is **exact ingredient set + sauce base**: a player adding mozzarella (the habit built by ~20 cheese recipes) gets an ORIGINAL (distance 1 near-miss), indistinguishable from other wrong pizzas (PR-1 neutralization). The candidate vs `salsiccia` etc. is a different set (no collision per matrix).
- Whether "evidence says no cheese" was ever Owner-confirmed as an authority is not on `main`.

| option | meaning | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Cheese-free as in the PIZZA DB row (set = tomato-sauce, sausage, onion, black-olive, oregano) | 3-step flow DOUGH→SAUCE→TOPPING (+CUT); adding cheese does not discover it | an "unexpected, no-cheese" discovery for players on a cheese streak — a rule they must learn from near-miss | CHEESE step absent automatically; noSauceParity rows | none |
| B | Add mozzarella (conventional pizza) — diverges from evidence | cheese step present; set no longer equals the evidence row | most "expected" for players; but invents a composition (and creates a sibling to calabresa-argentina conceptually) | recipe set differs from the matrix; re-run collision check; reference gains a cheese group | none (but re-check set collisions with salsiccia-like sets) |
| C | Defer: ship nothing until the original source is re-fetched (row was "relayed, not independently re-fetched") | none | blocks PR-4b | docs/evidence task | none |

**Preview/HV:** free-cook with the exact set (discovers), with +mozzarella (does **not**; same ORIGINAL lead/near-miss row as any other), step tabs strip (3 steps + bake + CUT), result copy for a no-cheese pizza.

---

## 5. quantity (minCount)

**Facts**
- There is **no real-world quantity evidence**. `minCount` is game balance (referencePizza header). Same value drives: ideal quantity in scoring V2; Lunch Rush `"order"` completion minimum; stock need per pizza (`finiteRequirementNeed`) and Shop pack sizing; reference piece total (≤ 8 pieces use the exact RT-01 table, 9–10 the multi-ring layout; 5 sauce+ingredient groups here).
- Discovery (policy `"recipe"`) needs only ≥ 1 of each; `minCount` affects quality, not discovery.
- Sibling values in the 25 (reading `recipes.ts`): sausage 3 (salsiccia) / 2 (meat-lovers); onion 2 (3 recipes) / 4 (fugazza); black-olive 2 everywhere; oregano 1 (3 recipes) / 2 (marinara). The #327 fixture (1/2/2/2/1) is the **temporary placeholder** and is not authority.

| option | rule | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Mirror sibling convention per ingredient (e.g. sausage = salsiccia-like, onion 2, olive 2, oregano 1) | familiar counts; total ≈ 8 non-sauce pieces | low learning cost; LR order difficulty similar to peers | data only + reference group sizes | none |
| B | Author from reference-layout capacity (choose counts that fit an RT-01 exact layout, e.g. ≤ 8 pieces) | clean visual layout | decouples numbers from siblings; needs a rationale record | data + reference | none |
| C | Minimal (1 each) | trivially quick pizza | very fast LR serve; reduces Shop stock pressure; weaker "ideal quantity" signal | data | none |

Label every number as **gameplay calibration**, never evidence-backed (kept separate from §0 facts). Evidence-backed: the ingredient *set* only.

**Preview/HV:** Free Cooking placement at that count (tray not overflowing, reference popover legible at 390×844), Lunch Rush "order" completion with exact count, Shop pack/stock (first-purchase restock for sausage/onion/olive/oregano), partial-quantity result copy.

---

## 6. bake window

**Facts**
- Evidence: none for the bake (only the dough style 「薄めの生地」). Existing 25 windows are 20 wide from `45–65` to `65–85` (6× `58–78`, 5× `50–70`, 4× `60–80`, …). 35bc937 Q1 set Hawaiian to 60–80 as an Owner decision; I5b notes "authored #221 value is not authority".
- The window feeds: Completion Gate `UNDERBAKED/OVERBAKED`, Scoring bake component, Dinner bake planning, and `dinnerResultDetection` bake-window count test (#327 §5-C).
- **Discovery interaction (PR-1 / OD-D3-23):** a correct combination that fails only the recipe-specific bake window gets a neutral ORIGINAL with **no explanation** and no bake advice. So a window the player cannot hit by ordinary baking turns a correct discovery into an unexplained failure. The window therefore matters for discovery fairness, not only scoring.
- Free Cooking uses `FREE_COOK_BAKE_TARGET`; the player has no per-recipe window to aim at in discovery.
- Fixture value 58–78 = copy of portuguesa; placeholder only.

| option | rule | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Same as nearest sibling family (e.g. 58–78) | normal bake timing | no special learning; ordinary bake passes | data only | none |
| B | Thin-crust-shifted (earlier/shorter, e.g. 50–70 like thin/cheese-free siblings) | a pizza that bakes "quicker" | flavour for thin dough; risk of over-bake for players used to 58–78, silently failing discovery (see above) | data + decide thin mapping (item 10) | none |
| C | Wider/forgiving window specific to discovery | easier to pass | protects discovery; breaks "width 20 everywhere" invariants/tests | schema + tests change | possible test pins |

**Preview/HV:** three bakes (under / in / over) on the exact set in Free Cooking → check completion verdict and result copy; Lunch Rush bake guide display; Dinner planner if the candidate ever becomes a target. State which gameplay-calibration number was chosen and by whom.

---

## 7. placement / reference

**Facts**
- `getReferencePizza(recipeId)` returns the per-recipe piece geometry (hand-reviewed per recipe: "design proposal → review → implement approved numbers verbatim"); layouts for > 1 ingredient group in the 25 follow the RT-01 rule (e.g. portuguesa 10 pieces multi-ring, egg tolerance 14/30, others 8/22). Sauce reference is `computeMechanicalSauceReference` (needs a `recipeSauceProfiles` entry).
- No placement evidence exists for the candidate (no layout, no zones; matrix: standard layering sauce→cheese→topping scatter, FULL representability).
- Previous temporary placeholders (dry-run recipe, fixture) are not authority. Missing reference → `null` (consumer fallback not re-audited here).
- Scoring parity: `scoringV2.noSauceParity` snapshot needs rows for the new recipe (#327 §5-C).

| option | rule | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Derive mechanically with the RT-01 layout rule (deterministic, ingredients interleaved), standard 8/22 tolerances | reference popover looks like peers | consistent; no new hand-tuned numbers | reference entry + tests, still needs the usual review record | none |
| B | Hand-authored composition (e.g. sausage/olive scatter by taste) | custom look | better looking, new review round | per-position data + review | none |
| C | No reference (null) | no reference popover/scoring hint | breaks scoring/reference-coverage tests and quality feedback | test exemptions | exemption list changes |

**Preview/HV:** reference popover at 390×844 with the final piece counts (item 5), placement at tolerance edges, scoring V2 shadow vs gate parity, Result near-miss row for the candidate-style pizza.

---

## 8. baseRewardPitz

**Facts**
- All 25 = **100** (Issue #38 V1: "no difficulty-based differentiation without Human Feel evidence"). Reward = round(base × quality multiplier 0/0.5/0.8/1.0/1.2) with floor 20, plus +50 first-discovery bonus (additive). Lunch Rush per-run reward is separate.
- The candidate does not advance the ladder but would pay the same Pitz and first-discovery bonus. Pitz is the Shop currency, so an off-ladder pizza is extra income. Economy tuning sims assume 25 (`economySimulation`, `discoveryHintEconomy.sim`, `hint5Economy.sim` pin population = 25; #327 §5-A).

| option | rule | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | 100 like every other | same payout | uniform, zero special rules; a "free" 150 Pitz (100+50) discovery without ladder progress | data only | none |
| B | Lower base for non-credit (value is Owner's) | smaller payout | economy-neutral; introduces first non-uniform reward | data + test pin change (uniformity test) | uniformity pin |
| C | 100 base but no first-discovery bonus for non-credit | payout without "bonus" | nuanced; first rule keyed off `ladderCredit` | reducer/pitz change | none |

**Preview/HV:** Result reward line at each star band, Shop affordability at the branch point, economy sim with 26 recipes (new baseline) — keep "evidence-backed" (none) vs "calibration" labelled.

---

## 9. CUT eligibility

**Facts**
- `CUT_ELIGIBLE_RECIPE_IDS` (`cookingProfiles.ts`) is an explicit opt-in allowlist (24 of 25; `new-haven-apizza` excluded for lack of round-dough evidence). Rule: "standard round, single-piece, single-bake"; never inferred from id. A recipe not listed ends at BAKE.
- Matrix classification for the candidate: dough class `standard`, variant `thin`, shape round, `cutServe: existing-round-cut-optional`. Under the I5b rule ("PIZZA DB evidence of a standard round dough"), the evidence exists; whether `thin` counts as "standard" is item 10.
- **#295 (open, unchanged, base `86b48fd`, not on main):** adds `MAX_VISIBLE_COOKING_TABS = 6` and `visibleCookingTabCount()` at the **end of the same file** and a `cookingProfiles.tabGate.test.ts` that iterates every production recipe. The candidate's profile = DOUGH, SAUCE, TOPPING (+ CUT) → 3 + bake + 1 = **5 tabs** (≤ 6): no gate violation either way. Textual conflict risk is low (allowlist edit vs end-of-file addition) but both touch the file; #295 is well behind `main` and must be updated by its owner regardless. `mergeable_state` was `unknown` (not verified).
- #327 states CUT eligibility + step table are "OD-D3-22, after #295" — i.e. the previous gate assumed an ordering relative to #295.

| option | rule | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Eligible (add id to allowlist) | CUT step appears, 5 tabs | same as other round pizzas | 1-line allowlist + cookingProfiles/ result tests | none |
| B | Not eligible in PR-4b (ends at BAKE) | no CUT | simplest; avoids #295 ordering; a thin pizza that is not cut feels inconsistent with 24 siblings | none (omit); test count differs | none |
| C | Decide after #295 resolves | n/a | PR-4b blocked on that decision | none | none |

**Preview/HV:** CUT step on the candidate at 390×844 (and 360×800 since #295 measured it), result screen with/without CUT, tab strip count. If #295 merges first, re-run its tab gate on the 26-recipe set.

---

## 10. thin-crust / standard interpretation

**Facts**
- Evidence 「薄めの生地」 → matrix `standard / thin / round / open-round`. 72 of 172 rows are standard/thin; among the shipped set, `breakfast-pizza` is thin, `margherita` neapolitan, `fugazza` thick-fluffy — and **the game has no thin-dough mechanic** (no thin/thick term in `doughShape.ts` / recipe data; every recipe shares the same dough gesture).
- So "thin" has no current gameplay representation; the question is whether it is flavour-only (standard) or should drive item 6 (bake) / item 9 (CUT) / reference geometry.

| option | meaning | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | thin = standard (no mechanic; precedent: breakfast-pizza) | identical dough step | no new rules; descriptive text may say 薄め | none | none |
| B | thin changes only calibration numbers (bake/quantity), no new mechanic | slightly different bake | needs recorded rationale; calibration not evidence | data | none |
| C | thin is a new capability (dough variant system) | new dough behaviour | scope far beyond PR-4b; touches 72 future rows | large | breakfast-pizza reclass? |

**Preview/HV:** description copy, dough step unchanged, comparison with breakfast-pizza.

---

## 11. black-olive uncertainty

**Facts**
- Source token is 「オリーブ」 (generic "olive"), dispositioned `likely_alias → black-olive` (not `exact_alias`) in the classifier. The game has only `black-olive` (and `olive-oil`); there is no green-olive ingredient.
- Sibling `calabresa-argentina` also lists plain 「オリーブ」; `portuguesa`/`capricciosa`/`puttanesca`/`pesto-tonno` use black-olive from their own evidence.
- Therefore **"black-olive" is an assumption**, not a fact. The recipe's identity set `{…black-olive…}` is exactly what discovery matches, so the mapping decides what the player must place. #327's fixture also used black-olive: scaffolding only.
- Source re-fetch has not been done in this pack (row marked "relayed, not independently re-fetched").

| option | meaning | player-visible | experience | implementation | existing 25 |
|---|---|---|---|---|---|
| A | Accept `likely_alias` → black-olive (record "assumption") | olive piece = the same black olive as 4 siblings | zero new ingredients; slightly more olive-sharing in discovery (4 → 5 recipes) | none; document assumption | none |
| B | Re-fetch the PIZZA DB row/page first; decide on the confirmed wording | depends | evidence-clean; delays PR-4b | docs/evidence step | none |
| C | Add a green-olive ingredient (new content) | new shelf item | scope creep (taxonomy, Shop, Hint 5 ladders, ids) | large | taxonomy tests |
| D | Drop olive from the recipe (4 + sauce) — diverges from evidence | none | smaller set, fewer collisions | data | none |

**Preview/HV:** none visual unless C/D; note in the Result report that the mapping is an assumption and where it came from.

---

## 12. Cross-item dependencies

- Item 1 ↔ 2: any per-card hint button/choice rule (2-C/2-D) changes how auto-target (1) can be reached.
- Item 3 ↔ 5/6: Lunch Rush "order" completion uses full `minCount`; the bake window silently fails unexplained attempts (PR-1).
- Item 4 ↔ 11 ↔ 5: the **set** is the discovery identity (cheese, olive); evidence-backed only to the extent of §0.
- Item 9 ↔ 10 ↔ #295: CUT eligibility rule depends on the thin interpretation; #295 only conflicts at the file level.
- Item 8: Pitz payout independent, but changes economy sim baselines (26).

## 13. Evidence-backed vs gameplay-calibration (explicit separation)

| item | evidence-backed | gameplay calibration / assumption |
|---|---|---|
| ingredient set | sausage, onion, oregano (exact_alias); tomato-sauce (family) | **black-olive (likely_alias)**; **no mozzarella (absence only)** |
| dough | 「薄めの生地」 | thin→standard interpretation |
| quantity / bake / placement | none | all of it |
| baseRewardPitz | none | all of it |
| CUT | none (allowlist is a gameplay-shape rule) | decision |
| Lunch Rush / auto-target / Dex | n/a (product policy) | decision |

---

## 14. Minimal questions — Owner answers → PR-4b can start

Answer these; every other item can ride a documented default noted in the PR-4b Result.

1. **Auto-target (item 1):** A (credited first) / B (current comparator as-is) / C (no auto when pool>1) / D?  Also: may a key-free candidate be an auto-target?
2. **Dex 🎨 (item 2):** A (both 🎨) / B (one 🎨) / C (explicit count) / D (both, no per-card hint button)?
3. **Lunch Rush (item 3):** A (full + Order) / B (guided yes, LR no) / C (neither)?
4. **Cheese (item 4):** A (cheese-free per evidence) / B (add mozzarella) / C (re-verify source first)?
5. **Olive (item 11):** A (black-olive as assumption) / B (re-fetch first) / C (new ingredient) / D (drop)?
6. **Calibration authority (items 5–8):** who sets quantity / bake / reference / baseRewardPitz, and from which option — or "use the sibling-mirroring defaults (5-A, 6-A, 7-A, 8-A) recorded as calibration"?
7. **CUT (item 9):** A (eligible) / B (not) / C (after #295)? And **thin (item 10):** A (thin = standard)?
8. **Process:** confirm that the PR-4b scope may add an Order entry / `recipes.test` count pins and the mechanical 25→26 pin updates listed in #327 §5-A.

STOP: no PR-4b work and no PR is started by this pack.
