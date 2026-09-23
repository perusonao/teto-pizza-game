# TETO Progression 2.0 — Phase 2: Recipe Discovery / Ingredient Unlock / Economy (SSOT candidate)

Issue #190. **Docs/data/tooling only.** No `src/**` change. The production Progression SSOT
(`docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`) is not overwritten. No PIZZA DB evidence is added or
guess-filled. Every threshold, price and stock size below is a **compared candidate**. The
recommended one is labelled, and none of them is final until review.

| Artifact | Path |
|---|---|
| This report (SSOT candidate) | `docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md` |
| Machine-readable unlock / progression matrix | `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` |
| Generated tables: unlock schedule, node impact, simulations, 172-row classification | `docs/design/TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md` |
| Generated decision ledger (A/B/C/D) | `docs/design/TETO_PROGRESSION2_PHASE2_DECISION-LEDGER.md` |
| Generator, simulator and validator | `tools/progression2_phase2_progression.py` (`--check` validates only) |

Every number here is printed by the tool from the JSON. If this text and the JSON disagree, the
JSON wins.

---

## 0. Answers to the completion questions

| # | Question | Answer (data) |
|---|---|---|
| 1 | Can a player always move from 0 recipes to the next discovery? | **Yes, under the recommended profile.** With 0 recipes and the starters tomato-sauce, mozzarella and basil, exactly one target is discoverable: Margherita. After that, every unlock step opens at least 1 new target; the validator fails on any dead step. **Under EVIDENCE_STRICT there is no deadlock, but there is no first-bake discovery either.** The starter trio completes zero evidence-ready rows, because the PIZZA DB Margherita adds olive oil and needs MULTI_SPREAD_LAYER. The player must first bake 1–8 "original pizzas" for Pitz and buy eggplant; the first discovery is then Melanzane, at bake 2–4. So A-01 decides whether the first Fun is a Margherita discovery. It is not a deadlock condition (§4). |
| 2 | How are ⭐ and Pitz earned without a circular dependency? | ⭐ is non-spendable and comes **only from discoveries**: +2 per new discovery, plus +1 each for BEST ★3/★4/★5. Pitz is spendable and comes **from any PASS bake**. Margherita uses only unlimited starter items, so it can always be baked, and with the ★1 floor every PASS bake pays more than 0. Gates only ask for ⭐ that already-discoverable targets can supply, and a Teto hint surfaces a target the player has not found yet. No state exists where ⭐ needs Pitz and Pitz needs ⭐ (§8, §10). |
| 3 | How many recipes does each ingredient / mechanic unlock add? | Per node: `nodeImpact` in the JSON, and §5 of the generated graph. Per capability: §6 below, where DOUGH_VARIANT adds +8 and MULTI_SPREAD_LAYER +9 among ready targets. Per step: §2 of the graph. |
| 4 | Is every evidence-ready recipe eventually reachable? | **Yes. 87/87 evidence-ready rows** are reachable, plus 14 kept shipped recipes: 101/101 targets. This holds for both decision profiles and all three mechanic policies, and is validator-enforced. |
| 5 | What content/evidence blockers remain? | **85 rows**, none resolved here. 53 are BLOCKED_EVIDENCE (unspecified sauce base, unresolved ingredient, evidence gap), 22 BLOCKED_PRODUCT_DECISION, 8 BLOCKED_MECHANIC_INTERPRETATION and 2 BLOCKED_DISCOVERY_RULE (fugazza/fugazzetta). Only 1 row, Margherita, is class A. The rest are class B: they stay out of the pool and do not block the design (§11, ledger). |
| 6 | What should Phase 3 implement first? | P3-1 is the save/state model plus the free-cook discovery matcher, headless. P3-2 is the zero-recipe onboarding with Teto hints. P3-3 is ⭐ / Pitz / gates / shop against the first 23 targets (the early tier). §13 has all the slices. |
| 7 | What are the concrete first 10 / 20 / 50 discoveries? | §9 (and JSON `walkthrough`). With STANDARD skill, a completionist reaches 10, 20 and 50 discoveries in 10, 20 and 50 bakes. A 60%-explorer with hints needs 11, 21 and 51 bakes; a ★2 beginner needs 11, 21 and 51. |
| 8 | What curve is recommended, and what was compared? | **G4_HYBRID_060 + PR_TIERED + S10_R10 + FLOOR_DISCOVERY_BONUS + HINTS_ON**, with mechanic policy M2. This was compared against 7 gate curves, 3 price schedules, 3 stock policies, 3 reward tables, 3 mechanic policies, 2 decision profiles, 4 skills, 3 explorer types and hints on/off (§8). |

---

## 1. Fresh audit (done before any design)

### 1.1 Repository state

| Check | Result |
|---|---|
| `origin/main` HEAD | `2f9f28e9fdea3372569973d84fc8cb7ba31369e4`. This is the Phase-1 merge, identical to the SHA in the issue, and the branch is cut from it. |
| PR #189 (Phase 1) | **MERGED** 2026-09-23T03:32:24Z by perusonao. |
| Issue #188 (Phase 1) | **CLOSED** (completed). |
| Issue #190 | OPEN (this task). Parent #182 is OPEN. |
| Duplicates | The open PRs are #105, #72, #46, #34 and #3. None touches progression, discovery or economy. The open-issue search for progression, discovery, unlock and economy returns only #190 and its parent #182. **No duplicate.** |
| Phase-1 matrix | 172 rows, 172 unique ids. Status: READY 67, READY_WITH_REVIEW 19, ALREADY_SHIPPED_CORROBORATED 1, BLOCKED 85. Current flow: FULL 101, PARTIAL 55, NOT_REPRESENTABLE 16. There are 11 capabilities and 5 Phase-0 collision groups, with fugazza/fugazzetta the one that is blocked. |
| Validators, baseline | All 8 existing validators pass on the untouched main (§14). |

### 1.2 Production progression audit (read-only)

| Area | What the code does today | Source |
|---|---|---|
| Recipe selection / cooking flow | **Recipe-first.** Pizza Select → `SELECT_RECIPE` → PREPARE for that recipe → BAKE → RESULT → `REGISTER_TO_DEX` for **the selected recipe id**. The pizza is never matched against a recipe. | `src/state/gameReducer.ts:1036`, `:934` |
| Start state | `margherita` has no `unlockCondition` and is always available. 14 recipes chain-unlock through `requiresRecipeId` plus `minTotalStars`, up to 36. | `src/data/recipes.ts:55`, `:388` |
| ⭐ (Mastery) | `totalStars = Σ Dex BEST ★` over discovered recipes, derived and not stored. | `src/logic/mastery.ts:19` |
| Ingredient states | LOCKED / AVAILABLE_TO_BUY / OWNED are derived from `unlockCondition.minTotalStars` and `ownedIngredientIds`. | `src/state/progression.ts` |
| Starter stock | Only tomato-sauce, mozzarella and basil are unlimited. Every other ingredient is `starterGrantOnly`: it can't be bought (`NOT_FOR_SALE`) and is granted `minCount × STARTER_STOCK_PLAYS_CHAPTER_1 (10)` when **its recipe unlocks**. | `src/state/starterStock.ts:18`, `:110`; `src/logic/economy.ts:124` |
| Inventory | Finite only for `unlockCondition` ingredients. A scatter ingredient uses 1 unit per placed piece; a sauce uses 1 unit per pizza. | `src/state/inventory.ts:26` |
| Pitz (FREE) | Per PASS pizza: `baseRewardPitz (100) × quality multiplier`, and **★1 → ×0**. There is also an additive efficiency bonus. | `src/logic/pitzReward.ts:20`, `gameReducer.ts:983` |
| Pitz (Lunch Rush) | Per run: `40 + ⌊avgQuality/10⌋×5 + min(served,10)×5`. That is about 100 Pitz for about 5 pizzas, or **about 20 Pitz per pizza, against 80–100 in FREE**. | `src/logic/economy.ts:57` |
| Lunch Rush orders | Drawn from `availableRecipeIds`. **If that list is empty, `availableOrders` falls back to ALL orders.** | `src/data/orders.ts:138-141`, `src/mission/lunchRush.ts:87` |
| Ingredient tray | Shows **only the current recipe's required ingredients**, in a fixed 3×2 grid with page switching. | `src/components/IngredientTray.tsx:129` |
| Completion gate | Judges "is this a finished dish" against `recipe.requiredIngredients` and the recipe bake window. | `src/logic/completionGate.ts:171` |
| Cooking profile | Derived **from the recipe**. FOLD, SEAL and FINISH are reserved steps with no gameplay. | `src/data/cookingProfiles.ts:156` |
| Dex | `registerScoreToDex(dex, recipeId, score)`: first registration = discovery, and BEST only goes up. | `src/state/dex.ts:66` |
| Progression SSOT | `PIZZA_GAME_PROGRESSION_SSOT.md` §5 still says "the 6 starter recipes are always available". Since EP4, the code says only Margherita is. **The SSOT has already drifted from the code.** It is not edited here. | `PIZZA_GAME_PROGRESSION_SSOT.md` §5 |

### 1.3 Contradictions and deadlocks against a zero-recipe start

| ID | Contradiction | Consequence if Progression 2.0 were bolted on unchanged |
|---|---|---|
| X-1 | Recipe-first flow: a round cannot start without choosing a recipe. | With 0 recipes there is nothing to select, so **the start is dead**. A free-cook mode plus a signature matcher is required (A-04). |
| X-2 | The tray shows only the selected recipe's ingredients. | Free combination is impossible, contradicting "choose freely from every owned ingredient". |
| X-3 | Completion gate, scoring and cooking profile are all computed from a recipe. | A free-cooked pizza cannot be judged or scored before it matches. A recipe-free completion rule is needed: dough, at least 1 item, and a generic bake window. Scoring happens only after a match. |
| X-4 | ⭐ = ΣBEST★ with fixed thresholds. | Margherita alone gives at most ★5, so any threshold above 5 is unreachable. **Simulation G0 (fixed ⭐+10 ladder) STAR_DEADLOCKs right after Margherita for every skill and explorer.** |
| X-5 | Lunch Rush draws from `availableRecipeIds` and falls back to ALL orders when that is empty. | With 0 recipes it would serve recipes whose ingredients are not owned, and the stock gate blocks placement: a broken Lunch Rush. Lunch Rush must open at ≥ 1 discovery and use only discovered, in-stock targets (C-06). |
| X-6 | ★1 pays ×0 Pitz. | A player who never exceeds ★1 earns 0 Pitz forever: **PITZ_DEADLOCK_ZERO_REWARD** (simulation `reward/LEGACY/WORST`). |
| X-7 | Starter grants are keyed to *recipe unlock*. | In 2.0 recipes are discovered rather than unlocked, so there is no trigger. Grants must key to *ingredient purchase*. |
| X-8 | `starterGrantOnly` makes ingredients unbuyable. | This conflicts with the LOCKED → AVAILABLE_TO_BUY → OWNED purchase lifecycle. |
| X-9 | PIZZA DB Margherita = {tomato-sauce, mozzarella, basil, **olive-oil**} + MULTI_SPREAD_LAYER. | Under strict evidence the starter trio discovers **nothing** (A-01, §4). |
| X-10 | Lunch Rush pays about 4–5× less Pitz per pizza than FREE. | Lunch Rush is not the Pitz engine. That is fine, but the economy must not *depend* on Lunch Rush (it doesn't here). |

---

## 2. Core model (Progression 2.0)

```
free cook (any OWNED items) ──PASS bake──► signature match?
   ├─ yes, undiscovered target → 「発見した！」 Dex +1, ⭐ +2(+quality), Pitz (+discovery bonus)
   ├─ yes, already discovered  → Pitz (BEST may improve → ⭐ quality bonus)
   └─ no                       → 「オリジナルピザ」 Pitz only (+ Teto near-miss hint)
⭐ total ≥ step gate ──► step nodes: capability granted free (Teto teaches it);
                                     items become AVAILABLE_TO_BUY
Pitz ──► buy item → OWNED (permanent) + starter stock (consumable portions)
Pitz ──► restock portions
```

### 2.1 Two currencies, separated

| | ⭐ Star (進行・達成) | Pitz (通貨) |
|---|---|---|
| Spendable? | Never. Monotonic. | Yes: purchase and restock. |
| Earned by | New discovery +2. Recipe BEST reaching ★3, ★4 and ★5: +1 each (max 5 per recipe). One-time achievements may add more (content polish). | Every PASS bake: `100 × mult(quality)`, where the recommended FLOOR table gives ★1 ×0.2. A new discovery adds +50. Lunch Rush adds its per-run reward on top. |
| Used for | Step gates, LOCKED → AVAILABLE_TO_BUY, and capability unlocks. | AVAILABLE_TO_BUY → OWNED, and restock. |
| Guarantee | Every gate ≤ ⭐ obtainable from already-discoverable targets at the guaranteed minimum (2 per discovery). | Margherita never consumes stock, so Pitz income is always available. |

**Why not keep `totalStars = ΣBEST★`?** In simulation, G1 (legacy sum with *derived* thresholds)
behaves the same as Hybrid for STANDARD players, because ★3 = 3 ⭐ either way. Legacy sum has two
problems: a ★1 discovery is worth a third of a ★3 one, which makes breadth depend on skill, and the
old *fixed* ladder deadlocks (G0). Hybrid makes **discovery itself** the main source of progress
(the first Fun), keeps quality meaningful, and has a guaranteed minimum that the gate formula can
rely on. Decision A-03.

### 2.2 Ingredient lifecycle: ownership separated from quantity

```
LOCKED ──(⭐ ≥ step gate)──► AVAILABLE_TO_BUY ──(Pitz price)──► OWNED (permanent, never lost)
                                                         │
                                          stock portions (consumable)
                                          + starter grant on purchase
                                          + restock (Pitz)
```

- **OWNED** is permanent and decides whether the item appears in the free-cook tray. **Stock**
  decides whether it can be *placed right now*. An item can be owned with 0 stock; the tray then
  shows it with a restock prompt.
- The starter trio (tomato-sauce, mozzarella, basil) is **unlimited**. That is the income guarantee.
- Dough variants, pans and capabilities are **permanent, non-consumable** unlocks with no stock.
  Only ingredients are consumable. This keeps the inventory model to one axis.
- Modelled unit: 1 portion = one pizza's use of that ingredient. The per-piece scatter count is
  implementation detail (C-01).
- Stock size, compared in §8.4: **S10_R10**. That is 10 portions on purchase, and a restock of +10
  for 50% of the purchase price. It needs 6 restocks for all 101 targets, against 23 for S5_R5 and
  35 for S3_R5, at an equal or faster pace. This coincides with the current `starterStockPlays = 10`,
  but it was chosen because the numbers favour it, not for continuity.

### 2.3 Discovery identity: never ingredients alone

A target's runtime signature is its ingredient set (including the base sauce) plus every dimension
its **required** capabilities make observable:

- dough: standard or the evidenced variant;
- pan;
- layer order;
- zones;
- late additions (mode and ingredients);
- prep (mode and ingredients);
- enclosure;
- shape;
- cook method;
- laminate;
- spread-layer order.

Candidate-only (inference) evidence never enters identity.

Rules:

1. **Exact match.** A superset of a target's ingredients is an *original pizza*, not a discovery.
   Teto may then say it was a near miss.
2. **Observation rule.** A dimension is observed only once its capability is unlocked. Before
   that, its default value is assumed. So a player can never miss Margherita because of a dough or
   step-order choice they cannot make yet.
3. **Uniqueness.** All 101 recommended targets have distinct signatures. The validator fails on any
   collision.

Ingredient-only matching would be wrong. With ingredient sets alone, the recommended pool has **5
colliding groups**. Each is separated by the extra dimensions:

| Same ingredient set | Separated by |
|---|---|
| margherita (shipped) / cauliflower-crust / al-taglio-romana | dough variant; al-taglio also needs pan and shape |
| salsiccia (shipped) / chicago-stuffed | enclosure plus thick dough |
| pepperoni (shipped) / fathead-keto / new-england-bar | dough variant; new-england-bar also needs a pan |
| jamon-serrano / pinsa-romana | dough variant (multigrain long-ferment) |
| ny-style / trenton-tomato-pie | dough variant / step order (cheese before sauce) |

Phase-0 collision groups: groups 1–4 are distinguished, and all their ready members are targets.
**P0-COLL-5 fugazza / fugazzetta stays a discovery-rule blocker.** Neither row is ever a target, and
the validator enforces this. Under SHIPPED_KEEP the *shipped* Fugazza,
{olive-oil, onion, oregano}, is a different signature from both PIZZA DB rows, so it is a valid
target. That does **not** resolve the P0-COLL-5 rows, which stay blocked.

---

## 3. Starting state and first discovery (最初の「発見した！」)

Start: **0 discovered**, owned = {tomato-sauce, mozzarella, basil} (all unlimited), standard dough,
0 Pitz, 0 ⭐. Lunch Rush is locked until the first discovery.

There are 7 non-empty subsets of the 3 starters, and exactly 1 of them matches: **Margherita**. The
other 6 give an "original pizza": it is baked and scored against a generic window, pays Pitz and
teaches the loop.

Teto guidance escalates, so the player is never told the answer up front and is never stuck:

| Trigger | Teto (example copy; final copy is D-02) |
|---|---|
| Round 1, the moment the pizza is shown | 「今日の材料はこの3つ！好きにのせて焼いてみよう」 No recipe card, no target shown. |
| After 1 non-matching PASS | Category hint: 「赤いソースと白いチーズ…緑のものも気になるね？」 |
| After 2 non-matching PASS | Direct nudge: 「3つぜんぶ、のせてみたら何かが起きるかも！」 |
| Match | Full-screen 「発見した！🍕マルゲリータ」, Dex card flip, ⭐+2 (+quality), Pitz, then Lunch Rush unlocks. |

This guarantees Margherita within 3 bakes, and a player who experiments finds it on the first. The
same hint system continues all game (§8.2). After 2 bakes without a new discovery, Teto hints at one
target that is makeable now but not yet found. It never hints at a target that needs something not
yet owned.

---

## 4. Decision profiles (what is assumed, and what that changes)

| Profile | Assumes | Targets | Discoverable at start | Reachable | Result |
|---|---|---|---|---|---|
| `EVIDENCE_STRICT` | nothing | 87 (all evidence-ready rows) | **0** | 87/87 | **COMPLETE for every skill, but with no first-bake discovery.** The first bakes are original pizzas (SKILLED and STANDARD 1, BEGINNER 2, WORST 8), which pay Pitz. The step-1 gate is 0⭐, so the player buys eggplant and discovers **Melanzane** at bake 2 (STANDARD/SKILLED), 3 (BEGINNER) or 4 (WORST). Negative control: if original pizzas paid 0 Pitz, the result would be START_DEADLOCK. |
| `SHIPPED_KEEP` (recommended) | A-01 and A-02, option 1: keep the shipped compositions as separate `shipped:<id>` targets | 101 (87 + 14) | 1 (Margherita) | 101/101 | No deadlock (§10). |

`SHIPPED_KEEP` does **not** change a single 172 row. The 9 PIZZA DB rows that conflict with a
shipped recipe stay BLOCKED. The 14 shipped recipes (all except `tonno-e-cipolla`, which the
PIZZA DB row corroborates) enter from `src/data/recipes.ts` as they are.

A-01 therefore decides the **shape of the first Fun**, not whether the game can start. An earlier
revision of this report said EVIDENCE_STRICT START_DEADLOCKs. That was wrong: its simulator did not
model original-pizza income (PR #191 review). If the owner prefers the PIZZA DB composition for
Margherita, there are two ways to keep a starter-only first discovery. Either change the starter
set, or accept a first discovery that needs a purchase (Melanzane). These no-capability rows have
≤ 3 ingredients and could be a starter-only first discovery under EVIDENCE_STRICT
(`alternativeFirstDiscoveriesEvidenceStrict`):

- brazilian-catupiry-corn {catupiry, corn, mozzarella}
- chilean-napolitana {fresh-tomato, mozzarella, oregano}
- flammkuchen {bacon, fromage-blanc-sauce, onion}
- palmito {black-olive, mozzarella, palm-heart}
- porchetta {mozzarella, pork, rosemary}
- salsiccia-e-friarielli {friarielli, mozzarella, sausage}

**Recommendation: keep the shipped Margherita (A-01, option 1).**

---

## 5. 172-row progression graph

### 5.1 Population

| Phase-2 class | Rows | Meaning |
|---|---|---|
| EVIDENCE_READY_TARGET | 87 | Phase-1 READY, READY_WITH_REVIEW or ALREADY_SHIPPED_CORROBORATED. Every one is a reachable target. |
| BLOCKED_EVIDENCE | 53 | Unspecified sauce base, unresolved ingredient token, or evidence gap. |
| BLOCKED_PRODUCT_DECISION | 22 | Composition conflict (shipped or candidate), or scope question. |
| BLOCKED_MECHANIC_INTERPRETATION | 8 | The mechanic identity is backed only by inference, or its timing is unresolved. |
| BLOCKED_DISCOVERY_RULE | 2 | fugazza / fugazzetta |
| **Total** | **172** | Validator: every row is classified exactly once, in matrix order. |

### 5.2 Recommended unlock schedule (summary)

The generator is a deterministic greedy over single nodes, pairs and triples. Each candidate is the
exact missing set of some remaining target. The score is new targets ÷ onboarding weight; ties go
to the higher reuse by remaining targets (hub ingredients first), then to the smaller set, then by
id. A bundle fallback completes the target with the fewest missing nodes. The capability cadence is
the policy M2 in §6.

Results:

- 68 steps unlock 125 nodes: 102 ingredients, 10 dough variants, 3 pans and 10 capabilities.
- Every step opens at least 1 new target.
- There are **0 dead nodes**: every sold item is used by at least 1 ready target.

| Tier (share of the 101 reached) | Steps | Targets | What it feels like |
|---|---|---|---|
| early (≤25%) | 0–8 | 23 | Familiar toppings (egg, bacon, onion, ham, pepperoni, sausage, mushroom, oregano, olive oil…) open 3–4 pizzas per step. The first technique (DOUGH_VARIANT) comes at 14 discoveries. |
| mid (≤60%) | 9–29 | 37 | Seafood, pesto family, Brazilian and Italian classics. MULTI_SPREAD_LAYER, PAN_BAKE, ZONED_PLACEMENT, LATE_ADDITION and FRY_COOK arrive one at a time. |
| late (≤90%) | 30–57 | 30 | ENCLOSE, DOUGH_SHAPE_TARGET and PREP_STEP. Mostly one new ingredient per pizza. |
| endgame | 58–68 | 11 | "Kits": 2–3 one-off ingredients for one regional pizza (poutine, peking duck, currywurst, Cuban…). |

The hub ingredients, by the number of ready targets using each:

| Ingredient | Targets |
|---|---|
| mozzarella | 72 |
| tomato-sauce | 45 |
| onion | 17 |
| olive-oil | 16 |
| oregano | 13 |
| black-olive | 11 |
| fresh-tomato | 11 |
| pesto | 11 |
| garlic | 10 |
| bacon | 9 |

59 ingredients are **one-shot**: exactly one ready target uses each. Content implication: sell
endgame one-shots as a **recipe-less "kit"** that bundles the missing set. The kit is not the pizza,
so the player still has to make it. Also price one-shots low, and never make them a gate
requirement.

Per-node table, with prerequisite, tier, the new targets at that step, cumulative
before → after, and the later targets that reuse it, as alternate paths: graph §5 and JSON
`nodeImpact`. Per-step table: graph §2.

### 5.3 Deadlocks in the graph

These properties are validator-enforced for both profiles and all three policies:

- no step without a new target;
- no node unlocked twice;
- no dough or pan item before DOUGH_VARIANT or PAN_BAKE;
- no dead node;
- the `newlyDiscoverable` lists partition the targets exactly.

---

## 6. The reusable mechanics: staging and order

Compared policies (JSON `mechanicPolicyComparison`, with STANDARD simulation):

| Policy | First mechanic at discovery | Max mechanics within 10 discoveries | Min gap | STANDARD bakes to all |
|---|---|---|---|---|
| M1 coverage greedy (Phase-1 logic) | 11 | 3 | 0 (two at once) | 123 |
| **M2 tutorial-weighted cadence (recommended)** | **14** | **2** | **6** | 122 |
| M3 mechanics last | 71 | **6** (tutorial overload) | 1 | 112 |

M2 teaches no mechanic for the first 12 discoveries. After that, every 6 discoveries, it teaches
the lightest capability that opens at least one ready target. Onboarding weight is
(teaching load + execution difficulty) ÷ 2, and the tool records the reasoning for each. The
recommended order, with the discoverable count before each and the ready targets it adds:

| # | Capability | Introduced at | Weight | Ready targets needing it | Incremental coverage | All-172 rows needing it (blocked) |
|---|---|---|---|---|---|---|
| 1 | DOUGH_VARIANT | 14 | 1.0 | 13 | +8 | 33 (20) |
| 2 | STEP_ORDER | 22 | 1.5 | 1 | +1 | 2 (1) |
| 3 | MULTI_SPREAD_LAYER | 29 | 2.0 | 9 | +9 | 17 (8) |
| 4 | PAN_BAKE | 35 | 2.0 | 3 | +2 | 8 (5) |
| 5 | ZONED_PLACEMENT | 41 | 3.0 | 1 | +1 | 1 (0) |
| 6 | LATE_ADDITION | 48 | 2.0 | 3 | +3 | 12 (9) |
| 7 | FRY_COOK | 54 | 3.5 | 1 | +1 | 1 (0) |
| 8 | ENCLOSE | 60 | 4.0 | 3 | +3 | 5 (2) |
| 9 | DOUGH_SHAPE_TARGET | 66 | 4.0 | 1 | +1 | 5 (4) |
| 10 | PREP_STEP | 88 | 3.0 | 1 | +1 | 3 (2) |
| — | LAMINATE | never | 5.0 | 0 | — | 1 (1: feteer, blocked) |

Readings:

- In the evidence-ready pool, **mechanics unlock few pizzas each**: 1–9. Most mechanic-heavy rows
  are still blocked by decisions. For example, 20 of DOUGH_VARIANT's 33 rows are blocked. So
  mechanics should be **paced as teaching moments**, not treated as the main unlock currency.
- DOUGH_VARIANT comes first on both counts. It is the lightest (a card choice, no new gesture) and
  has the most potential once blocked rows resolve.
- LATE_ADDITION is ready-poor today (3), but 9 blocked rows need it. Its slot should move earlier
  if those rows (natto, eel, teriyaki…) are unblocked.
- **LAMINATE is not needed** by any evidence-ready target. Don't build it before feteer's scope
  question is answered.
- M3 finishes slightly faster, but it teaches 6 mechanics within 10 discoveries at the very end:
  rejected on onboarding load.

---

## 7. Mobile free-cook ingredient selection (design only, no UI implemented)

The final tray shows **every OWNED item**, never a recipe subset. The counts below come from JSON
`uiSizing`. Each is what the walkthrough player (recommended configuration, STANDARD skill)
**actually owns** when it bakes that discovery; the snapshots are in
`walkthrough.ownedAtDiscovery`. Gates open at 0.6 × discoverable, so purchases run well ahead of
discoveries. An earlier revision derived these counts from schedule coverage and understated them
(PR #191 review).

| Moment | Owned ingredients | Dough variants | Pans | Categorised by existing data |
|---|---|---|---|---|
| start | 3 | 0 | 0 | 3/3 |
| 10 discoveries | 20 | 1 | 0 | 18/20 |
| 20 | 30 | 3 | 1 | 25/30 |
| 50 | 59 | 7 | 2 | 39/59 |
| all | 105 | 10 | 3 | 56/105 (49 need a category; C-05) |

In the same run, more than 16 ingredients are owned from discovery 8, and more than 40 from
discovery 28.

The design for 390×844 and 360×800 keeps the current one-screen cooking layout, with the tray as the
bottom sheet:

1. **Category tabs, always visible**, in one row of 5–6 short labels: ソース / チーズ / 肉・魚 /
   野菜 / ハーブ・仕上げ / ★よく使う. The current 3×2 grid alone is enough only for the first few
   discoveries: the player already owns 20 ingredients at discovery 10. Tabs are therefore
   needed from P3-4 onward, not later.
2. **Paged grid within a tab.** 4×2 = 8 chips fit at 360 px, with 72 px chips and 16 px gutters.
   Paging uses the existing ◀ ▶ page switch, never scrolling, which avoids the drag/scroll conflict
   that `MAX_INGREDIENT_PALETTE_SLOTS` was created for.
3. **Recent / favourites strip** of 6 chips above the tabs. It appears once more than 16
   ingredients are owned, which is around discovery 8 in the recommended run.
4. **Search** is a magnifier button that opens an overlay reusing the Shop/Inventory overlay
   pattern (Japanese kana prefix match). Introduce it once more than about 40 ingredients are
   owned, which is around discovery 28 in the recommended run. Below that, tabs plus 1–2 pages per
   tab are enough.
5. Each chip shows stock: ∞ for starters, a number for others, and greyed with a restock "+" at 0.
   A chip is never hidden because it lacks stock.
6. Dough and pan are **not** in the tray. They are a card picker on the DOUGH step and a pan picker
   before BAKE, which appear only once their capability is owned.

---

## 8. Economy simulation (deterministic)

### 8.1 Method

- Each simulation runs one deterministic player. A turn is one PASS bake. Buying, restocking and
  receiving a capability are free actions between bakes.
- Each bake is either a discovery (the first *known*, owned, in-stock target in schedule order) or
  an income bake of an unlimited recipe (Margherita).
- **Skill** fixes the quality: WORST ★1, BEGINNER ★2, STANDARD ★3, SKILLED ★4.
- **Explorer** sets the share of targets the player finds without help: COMPLETIONIST 100%,
  EXPLORER_60 60%, EXPLORER_40 40%. A stable SHA-256 per target id decides which ones, so runs are
  deterministic.
- With **HINTS_ON**, after 2 idle bakes Teto reveals one makeable-but-unknown target.
- Gate for step *k* = `stars_per_guaranteed_discovery × ⌈f × cumulativeDiscoverable(k−1)⌉`, made
  monotone. f is the curve's fraction.
- Outcomes:
  - COMPLETE;
  - START_DEADLOCK: nothing is discovered and there is no income. Original pizzas (PASS free cooks
    of the unlimited starters that match no target) pay Pitz whenever the reward table has
    `originalPizzaPays`, so this happens only in the negative control;
  - STAR_DEADLOCK (a gate is unmet and nothing can be discovered);
  - PITZ_DEADLOCK_ZERO_REWARD;
  - PLATEAU_UNFOUND (everything is bought, but the rest is never found without hints).

### 8.2 Gate curves

All curve runs use STANDARD skill with PR_TIERED, S10_R10 and FLOOR_DISCOVERY_BONUS. Each cell
gives bakes to 10 / 20 / 50 / all, or the outcome.

| Curve | Completionist | Explorer 60%, hints off | Explorer 60%, hints on | Explorer 40%, hints off | Explorer 40%, hints on |
|---|---|---|---|---|---|
| G0 legacy fixed ⭐+10 ladder | **STAR_DEADLOCK @1** | STAR_DEADLOCK @1 | STAR_DEADLOCK @1 | STAR_DEADLOCK @1 | STAR_DEADLOCK @1 |
| G1 ΣBEST★, derived f=0.6 | 10/20/50/122 | PLATEAU 67/101 | 11/21/51/183 | PLATEAU 46/101 | 12/22/75/226 |
| G2 discovery count f=0.6 | 10/20/50/122 | STAR_DEADLOCK @2 | 13/25/55/179 | STAR_DEADLOCK @1 | 18/30/72/219 |
| G3 Hybrid f=0.5 | 10/20/50/122 | PLATEAU 67/101 | 11/21/51/183 | STAR_DEADLOCK @1 | 12/22/75/226 |
| **G4 Hybrid f=0.6** | 10/20/50/122 | PLATEAU 67/101 | **11/21/51/183** | STAR_DEADLOCK @1 | **12/22/75/226** |
| G5 Hybrid f=0.75 | 10/20/50/122 | PLATEAU 67/101 | 11/21/51/183 | STAR_DEADLOCK @1 | 16/26/75/226 |
| G6 Hybrid f=1.0 | 10/20/50/122 | STAR_DEADLOCK @2 | 15/29/59/179 | STAR_DEADLOCK @1 | 20/34/80/215 |

Conclusions:

1. **Any fixed ladder deadlocks a zero-recipe start.** That includes the old ⭐10/20/30/40/50 idea.
2. **Without Teto hints, every curve fails** for some realistic explorer. **With hints, every
   derived curve completes.** The hint fallback is a structural part of the no-deadlock guarantee,
   not a polish item.
3. With hints, f ≤ 0.6 costs the 40%-explorer nothing (12 bakes to 10 discoveries). f = 0.75 costs
   16, and f = 1.0 costs 20. G3 and G4 behave identically in every run. **G4 (f=0.6)** is
   recommended because it asks for a little more breadth before each unlock at no measured cost.

### 8.3 Prices

These runs use G4, S10_R10 and FLOOR_DISCOVERY_BONUS. Each cell gives bakes to 10 / 20 / 50 / all.

| Price schedule | Total purchase Pitz | BEGINNER | STANDARD |
|---|---|---|---|
| **PR_TIERED 60/100/140/180** | 14,460 | **11/21/51/194** | **10/20/50/122** |
| PR_FLAT_120 | 13,800 | 15/25/57/185 | 12/22/52/116 |
| PR_IMPACT 50+25×gain | 10,500 | 16/28/60/143 | 12/22/52/103 |

PR_TIERED is recommended because the **first 10 discoveries are fastest**, which is where first
Fun lives. PR_IMPACT is cheapest overall, but it charges the most exactly when the early high-gain
items appear.

### 8.4 Stock

These runs use G4 and PR_TIERED. Each cell gives bakes to 10 / 20 / 50 / all, then the number of
restocks.

| Stock policy | BEGINNER | STANDARD |
|---|---|---|
| **S10_R10** | 11/21/51/194, 6 restocks | 10/20/50/122, 6 restocks |
| S5_R5 | 11/21/51/199, 23 restocks | 10/20/50/125, 23 restocks |
| S3_R5 | 11/21/54/206, 35 restocks | 10/20/53/129, 35 restocks |

The simulated player re-bakes only Margherita, so real players who re-bake favourites will consume
more stock. S10_R10 leaves the most headroom for that.

### 8.5 Reward

These runs use G4, PR_TIERED and S10_R10. Each cell gives bakes to 10 / 50 / all, or the outcome.

| Reward table | WORST ★1 | BEGINNER ★2 | STANDARD ★3 |
|---|---|---|---|
| LEGACY (★1 = ×0) | **PITZ_DEADLOCK_ZERO_REWARD** after Margherita | 13/74/294 | 11/51/184 |
| FLOOR (★1 = ×0.2) | 28/182/733, longest grind 26 bakes | 13/74/294 | 11/51/184 |
| **FLOOR + discovery bonus +50** | **13/59/483**, longest grind 24 | **11/51/194** | **10/50/122** |

### 8.6 Recommended configuration: robustness across all 12 player models

| Skill \ Explorer | Completionist | 60% + hints | 40% + hints |
|---|---|---|---|
| SKILLED | 10/20/50/101, 0 grind | 11/21/51/181 | 12/22/72/219 |
| STANDARD | 10/20/50/122 | 11/21/51/183 | 12/22/75/226 |
| BEGINNER | 11/21/51/194 | 14/26/60/194 | 18/30/83/226 |
| WORST | 13/23/59/483 | 17/37/84/483 | 19/38/106/483 |

All 12 runs are **COMPLETE, with 0 deadlocks** (validator-enforced). The bottleneck is endgame
kit purchases. For WORST, the longest grind is 24 income bakes before a 180-Pitz endgame item,
after 97 discoveries. For everyone else it is ≤ 9. In the early game (first 20 discoveries) there
are never more than 3 consecutive income bakes between two discoveries, across all 12 models.

---

## 9. First 10 / 20 / 50 discoveries

Recommended configuration, STANDARD skill, completionist. The bake number equals the discovery
number up to 50: no income bakes were needed.

| # | Discovery | Newly owned before it (gate ⭐) |
|---|---|---|
| 1 | Margherita | starters (tutorial) |
| 2 | Bismarck | bacon, egg (⭐2) |
| 3 | Aussie | onion, ham |
| 4 | Breakfast pizza | pepperoni, sausage (⭐6) |
| 5 | Meat lovers | black-olive, mushroom (⭐10) |
| 6 | Pepperoni | oregano, feta |
| 7 | Salsiccia | fresh-tomato, olive-oil; **DOUGH_VARIANT** plus cauliflower dough (⭐18, at 14 discoverable) |
| 8 | Brazilian calabresa | pesto, tuna |
| 9 | Portuguesa | bell-pepper, eggplant |
| 10 | Capricciosa | zucchini |
| 11–20 | Funghi, Chilean napolitana, Feta eliniki, Fugazza, Cauliflower crust (first dough variant), Pesto caprese, Pesto tonno, Tonno e cipolla, Melanzane, Pesto vegetariana | **STEP_ORDER** (⭐28), clam, garlic, parmigiano, arugula, multigrain dough, prosciutto, **MULTI_SPREAD_LAYER** (⭐36), burrata, anchovy, **PAN_BAKE** (⭐42) with thick dough and deep pan |
| 21–30 | Ratatouille, Spanish chorizo, **Trenton tomato pie** (step order), New Haven apizza, Parmigiana, Marinara, Jamón serrano, **Pinsa romana** (dough), Prosciutto funghi, **Burrata** (drizzle) | **ZONED_PLACEMENT** (after #20), **LATE_ADDITION** (after #25), taught one at a time |
| 31–40 | Grandma (multi-spread), Pesto burrata, Crudaiola, Sfincione, Napoletana, **Montreal** (pan), Pescatore, Pesto gamberi, Vongole, Porchetta | **FRY_COOK** (after #30), **ENCLOSE** (after #34), **DOUGH_SHAPE_TARGET** (after #38) |
| 41–50 | **Quattro stagioni** (zones), Frango catupiry, Pesto pollo, Bambino, Catupiry corn, Sichuan eggplant, Tsukimi, **BBQ chicken** (late addition), Hawaiian, Pizza overload | — |

The full event log, with every purchase, gate, capability and discovery with ⭐ and Pitz, is JSON
`walkthrough`.

---

## 10. No-deadlock argument (JSON `noDeadlockProof`, all `holds: true`)

1. **The zero-recipe start** has a discoverable target: Margherita, from the unlimited starters.
2. **An unlimited income recipe exists** after discovery 1, so a PASS bake never needs stock or
   Pitz.
3. **Pitz is not circular.** With FLOOR, every PASS bake pays ≥ 20 Pitz, so any finite price is
   reachable.
4. **⭐ is not circular.** Each gate asks for ≤ ⌈0.6 × previously-discoverable⌉ discoveries, which
   targets already discoverable can meet. When the player cannot find them, the Teto hint reveals
   one (§8.2). This is verified over 12 player models.
5. **Lunch Rush** opens at discovery 1 and draws only from discovered, in-stock targets, so its
   pool is never empty.
6. **Every evidence-ready target is reachable**: 101/101, and 87/87 under EVIDENCE_STRICT's own
   schedule.

---

## 11. Unresolved data: classification (nothing guessed)

The full list is in `TETO_PROGRESSION2_PHASE2_DECISION-LEDGER.md`.

| Class | Meaning | Items |
|---|---|---|
| **A**: blocks the progression design | Must be decided before Phase 3 locks content. | A-01 Margherita composition. A-02 the kept shipped recipes. A-03 ⭐ definition. A-04 free-cook discovery replacing recipe selection. A-05 the ★1 Pitz floor. Row-level, only `margherita-pizzadb-row` is class A. |
| **B**: blocks the discovery identity of those rows | The row stays out of the pool until decided; the design does not wait for it. | All 84 other blocked rows: BASE_SAUCE_UNSPECIFIED 33, UNRESOLVED_INGREDIENT 21, COMPOSITION_CONFLICT_CANDIDATE 18, MECHANIC_INTERPRETATION 11, COMPOSITION_CONFLICT_SHIPPED 9, EVIDENCE_GAP 2, SCOPE_QUESTION 2, DISCOVERY_COLLISION 2. Counts overlap, because a row can have several types. |
| **C**: can wait until implementation | Tunable with the simulator. | C-01 stock size. C-02 prices. C-03 dough/pan granularity. C-04 save migration. C-05 UI categories for 49 uncategorised ingredients. C-06 Lunch Rush entry. CANDIDATE_CAPABILITY review items on 14 ready rows. |
| **D**: content polish | Never changes reachability. | D-01 naming-cluster display names. D-02 Teto hint copy. SAME_INGREDIENT_SET, NAME_SPECIFICITY, SOURCE_INCONSISTENCY and PREPARED_COMPOSITE review items. |

Highest-leverage class-B decisions, carried from Phase 1:

- base-sauce choice for the generic families: 33 rows, 28 of them blocked by that alone;
- chili and ground meat together: 9 rows.

Each resolved row joins the pool through the same generator, and the validator re-proves
reachability and signature uniqueness.

---

## 12. Rejected or superseded ideas (explicitly re-evaluated)

- **⭐10 mushroom / ⭐20 sausage / ⭐30 egg / ⭐40 pepperoni / ⭐50 oregano**: not kept. Every fixed
  ladder deadlocks (G0). The data-driven order puts egg, bacon and onion first, then ham, pepperoni
  and sausage, then black olive, mushroom and oregano, with gates at ⭐2 / 6 / 10.
- **Recipe-linked starter grants** (EP4): replaced by a grant on *purchase*, because recipes are no
  longer unlocked (X-7).
- **`starterGrantOnly` (unbuyable) ingredients**: replaced by the normal purchase lifecycle (X-8).
- **Recipe-subset tray** (#159 P0): replaced by the all-owned tray in §7 (X-2). The layout budget
  that motivated #159 is respected by the paging rules.

---

## 13. Phase 3 implementation slices (proposed order)

Each slice is independently shippable and reviewable. The UI slices need the Human Verification
video and screenshots per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`.

| Slice | Scope | Depends on | Gate |
|---|---|---|---|
| **P3-0** Owner decisions | Confirm A-01…A-05 (the ledger), docs only. | — | Review of this PR. |
| **P3-1** Discovery core (headless) | A `DiscoveryTarget` data type generated from this JSON (read-only import of 101 targets). A runtime `signatureOf(pizza, ownedCapabilities)` with the observation rule, and `matchDiscovery`. A recipe-free completion rule. Save schema v3: discovered set, ⭐ ledger, owned items and stock. Grandfather migration (C-04). Unit tests reuse this tool's collision cases. | P3-0 | All 101 signatures unique in TS as well (a parity test against the JSON). |
| **P3-2** Zero-recipe onboarding | A free-cook round with no recipe card; the starter trio; Margherita discovery ceremony; Teto hint tiers 1–3; "original pizza" result. Lunch Rush locked until discovery 1, with the pool fix for X-5. | P3-1 | Human Verification at 390×844 and 360×800. |
| **P3-3** ⭐ / Pitz / gates / shop for the early tier | Hybrid ⭐, derived gates (f=0.6), FLOOR reward and discovery bonus, PR_TIERED prices, S10_R10 grant and restock, AVAILABLE_TO_BUY in the shop, and the idle-hint fallback. Content: steps 1–8 (23 targets, existing ingredient art first). | P3-2 | A simulation parity test: the TS economy reproduces `walkthrough.first20`. |
| **P3-4** All-owned tray | Category tabs, the 4×2 paged grid, the recent strip, and stock badges (§7). Search deferred until more than 40 ingredients are owned (about discovery 28). | P3-2 | Human Verification. |
| **P3-5** DOUGH_VARIANT + mid-tier content | Dough card picker (the first technique tutorial), then steps 9–29. | P3-3, P3-4 | — |
| **P3-6+** One capability per slice, in M2 order | STEP_ORDER → MULTI_SPREAD_LAYER → PAN_BAKE → ZONED_PLACEMENT → LATE_ADDITION → FRY_COOK → ENCLOSE → DOUGH_SHAPE_TARGET → PREP_STEP, each with its ready targets. | previous | Re-run this tool if any class-B row was resolved in between. |

The first thing to build is **P3-1**. Every later slice depends on free-cook discovery, and it is
the one piece of the current architecture (recipe-first) that cannot be extended in place.

---

## 14. Verification

```
$ python3 tools/progression2_phase2_progression.py --check
Rows analysed: 172  classification: {'BLOCKED_DISCOVERY_RULE': 2, 'BLOCKED_EVIDENCE': 53, 'BLOCKED_MECHANIC_INTERPRETATION': 8, 'BLOCKED_PRODUCT_DECISION': 22, 'EVIDENCE_READY_TARGET': 87}
Profile EVIDENCE_STRICT: targets=87 (87+0) start=0 reachable=87 steps=67 collisions=0
Profile SHIPPED_KEEP: targets=101 (87+14) start=1 reachable=101 steps=68 collisions=0
...
noDeadlockProof: zeroRecipeStart=True, unlimitedIncomeRecipe=True, pitzNeverCircular=True, starsNeverCircular=True, lunchRush=True, allEvidenceReadyReachable=True
All Phase-2 validations passed.
```

The validator enforces all of the following. Any failure exits non-zero.

- The matrix has 172 unique rows. The classification covers every row exactly once, in matrix
  order.
- Targets equal the evidence-ready rows exactly, plus `shipped:*` targets. No duplicates, no
  missing rows, no blocked, incomplete or unresolved row as a target, and never fugazza or
  fugazzetta.
- Each row target's items and identity dimensions equal a fresh derivation from the Phase-1 row:
  ingredient set = the Phase-1 identity set, and capabilities = Phase-1 `requiredCapabilities`.
  Late-addition ingredients are part of the target's set.
- No runtime-signature collision in either profile.
- For every profile × policy: no dead step, no node twice, prerequisites respected, all targets
  reachable, no dead node, and newlyDiscoverable partitions the targets.
- The findings the report relies on still hold:
  - EVIDENCE_STRICT has no starter-only discovery;
  - with original-pizza income it COMPLETEs for all skills, but only after at least 1 original-pizza
    bake, with the first discovery at bake 2 or later;
  - the negative control, where original pizzas pay 0, START_DEADLOCKs;
  - the recommended profile never needs original-pizza income;
  - G0 deadlocks;
  - LEGACY reward deadlocks WORST.
- The recommended configuration completes for all 12 skill × explorer models, and every
  `noDeadlockProof` claim holds.
- Two in-process builds are byte-identical, and `--check` fails if any committed output differs
  from a fresh regeneration.
- **The JSON alone reconstructs every simulated policy** (PR #191 review). Gate curves, price
  schedules (`kind` plus parameters), stock policies, reward tables (including `discoveryBonus`),
  skills, explorers and hint policies are serialized in full. The validator does three things:
  - compares the serialized tables with the simulator input;
  - pins `FLOOR_DISCOVERY_BONUS.discoveryBonus = 50`, and `FLOOR` / `LEGACY` = 0;
  - rebuilds the parameter bundle from the JSON and re-runs every recorded simulation and the
    50-discovery walkthrough, requiring identical results.
- **One source of truth for the economy recommendation** (PR #191 review). The recommendations for
  A-03 (gate), A-05 (reward), C-01 (stock) and C-02 (price) are derived from `RECOMMENDED_ECONOMY`,
  which the simulations run on. There is no literal in the ledger. The validator requires all of
  these to name the same policies:
  - the ledger (JSON and generated MD);
  - `recommended.economy`;
  - the walkthrough config;
  - all 12 robustness simulations;
  - the generated graph header;
  - the recommended combination stated in this report.
- **Tray sizing comes from the actual ownership state** (PR #191 review). `uiSizing` is derived
  from `walkthrough.ownedAtDiscovery`: the walkthrough player's owned items at the start, at
  discoveries 10, 20 and 50, and at completion. The validator re-runs the walkthrough from the
  JSON-only economy parameters and requires both the snapshots and `uiSizing` to match.

Mutation checks were run by hand while writing the tool. Each of these mutations was caught:

- a blocked row injected as a target;
- a removed classification row;
- an emptied step;
- a forced collision;
- a forced recommended deadlock;
- a dropped dough item;
- a changed identity dimension.

Existing validators, re-run on this branch, are unchanged and green (the outputs are listed in the
PR):

- `validate_recipe_catalog.py`
- `progression2_phase0_analysis.py`
- `progression2_phase0b_analysis.py`
- `progression2_ingredient_canonicalizer.py` (36/36)
- `progression2_recipe_row_ingest.py --check` (172/172)
- `progression2_evidence_invariants.py` (4/4)
- `progression2_full172_deadlock_analysis.py` (0 deadlocks, output byte-identical)
- `progression2_mechanic_matrix.py --check`

No Human Verification video is needed: this PR changes no UI, UX or gameplay.

## 15. What this does not decide

- Any A–D decision. The recommendations are proposals.
- Final prices, gate fraction, stock size and reward numbers. They are candidates, and the
  simulator makes re-tuning cheap.
- The composition, sauce or ingredient of any blocked row. Nothing was guess-filled.
- Production ids, art or copy.
- Any change to `PIZZA_GAME_PROGRESSION_SSOT.md`. That document is updated only after this
  candidate is reviewed, in the Phase-3 slice that ships it.
