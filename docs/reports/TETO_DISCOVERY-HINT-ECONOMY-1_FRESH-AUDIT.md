# Discovery Hint Economy 1.0 — Fresh Audit + 25-recipe Pitz simulation

Status: **Fresh Audit / design only.** No production code, recipe/ingredient data, ladder,
matcher/signature, scoring, Lunch Rush or #229 behaviour was changed. The only code added is a
test-only analysis harness (`src/logic/testSupport/discoveryHintEconomySim.ts` +
`src/logic/discoveryHintEconomy.sim.test.ts`); no production module imports it.
Full simulation tables: `docs/reports/data/TETO_DISCOVERY-HINT-ECONOMY-1_SIM-TABLES.md`.

**TL;DR**

- Hard deadlock is **impossible** under every candidate and profile: Dex 0 costs 0 Pitz, and from
  Dex 1 on, a Margherita replay (starters only, never out of stock) always pays ≥ 20 Pitz.
  All 5 curves × 7 profiles × 3 quality levels reached Dex 25 on the real reducer.
- The real issue is **soft friction**: how many extra bakes paid hints add for a player who uses them.
  Measured as total bakes to Dex 25 for the realistic P5 player at ★3: FREE 136, **A 344**, B 216,
  C 228, D 182 (P0, no hints: 438).
- **A (10/20/40/80) is too expensive for this economy.** A full hint set (150) is larger than
  what a stage leaves after its Shop pack even at ★4 (+50..+90), so H4 is almost never
  affordable in the steady state (21–23 refused hint attempts). A takes back about 70% of what hints
  save a P5 player.
- **B (5/10/20/40) is recommended** of the three Owner candidates. D (0/10/20/40, H1 free) scores
  best on the data and is the strongest alternative, because H1 only names the material the player
  just bought in the Shop (24/24 stages). **The Owner makes the final choice (§17).**

## 1. Audited main SHA

- `origin/main` = **`42ce42842a2eb509d6995c101911fc3f29aa1b43`** (Merge PR #231: Discovery Hint 2.0).
- Branch: `claude/discovery-hint-economy-audit-sgkzmg` (started from that SHA).
- **Duplicate Gate:** no open or closed issue/PR covers hint pricing or a hint economy
  (searched "discovery hint Pitz price purchase economy", "ヒント 有料 hint paid Pitz", PR titles
  containing "hint"). The only related items are #229 (Discovery Hint 2.0, CLOSED) and PR #231
  (MERGED). No new issue was created; the PR for this report is enough to track the audit.
- Sources used: production runtime code and data only. Earlier design docs' numbers were **not**
  treated as authority (see §2 for where they are out of date).

## 2. Current production economy (runtime truth at `42ce428`)

| Item | Runtime value | Source |
|---|---|---|
| Recipes | **25** (`RECIPES`) | `src/data/recipes.ts` |
| Ingredients | **29** = 3 starters (tomato-sauce, mozzarella, basil) + 26 finite | `src/data/ingredients.ts` |
| Discovery ladder | **24 MATERIAL steps** (`W1_25_DISCOVERY_LADDER`), one key recipe each; Margherita is starter-only | `src/data/discoveryLadder.ts` |
| Initial Pitz | **0** (`createDefaultSave`, `createInitialGameState`) | `persistence.ts`, `gameReducer.ts` |
| Recipe reward | `baseRewardPitz` = **100 for all 25**, × quality multiplier | `pitzReward.ts` |
| ★ → Pitz | ≥90 ★5 ×1.2 = **120**; ≥75 ★4 ×1.0 = **100**; ≥60 ★3 ×0.8 = **80**; ≥40 ★2 ×0.5 = **50**; <40 ★1 → floor **20** | `pitzReward.ts`, `scoring.ts` |
| First-discovery bonus | **+50** (OD-02), FREE only | `PITZ_FIRST_DISCOVERY_BONUS` |
| Cooking Time bonus (CT2) | 0–10% of base (0–10 Pitz), only at quality ≥ 60, FREE only | `efficiency.ts` |
| Re-cooking a discovered recipe | pays the quality reward again (no bonus) — guided round or a Free Cooking ALREADY_DISCOVERED match | `REGISTER_TO_DEX` |
| Shop unlock fee | **0**: the ladder entitles a material when Dex count reaches its step; no stock until the first pack | `materialEntitlement.ts`, `materialShop.ts` |
| First pack / refill | T1 (steps 1–5) **60 / 30**, T2 (6–14) **80 / 40**, T3 (15–29) **100 / 50** (T4 120/60 unused) | `MATERIAL_PRICE_TIERS` |
| Pack size | `10 × k` (k = the largest `minCount` any recipe uses), i.e. 10 pizzas; the refill adds the same amount | `materialShop.ts` |
| Material cost per pizza | refill ÷ 10 per finite material used ≈ **3 / 4 / 5 Pitz** | derived |
| Starters | unlimited, never for sale, never consumed | `consumePizzaInventory` |
| Inventory consumption | at `CONFIRM_BAKE`, placed pieces (sauce: 1 per sauce), **also for ORIGINAL/FAILED rounds** | `inventory.ts` |
| Legacy `pricePitz`/`restockQuantity` fields | still in data, **unused** by the W1 Shop (`purchaseFirstPack`/`refillPack`) | `ingredients.ts` |
| Lunch Rush | unlocked at Dex ≥ 1; 40 + quality + serve bonus, **≤ 140 / run**; separate `CLAIM_MISSION_REWARD` | `economy.ts` |
| Save | key `teto-pizza-save-v1`, **`schemaVersion: 2`**; fields `dex, pitzBalance, ownedIngredientIds, missionBest, inventory, starterGrantClaimedRecipeIds, unlockedForShopIngredientIds` | `persistence.ts` |
| Save forward-compat | unknown top-level keys are kept verbatim on write; unknown well-formed ids in ledgers are kept | `extractForwardCompatExtras` / `writeSave` |
| Full Game Reset | `resetSave()` removes the whole key | `App.tsx` / `persistence.ts` |

Per-stage Pitz left over (discovery reward − that stage's first pack), before refills or hints:

| Quality | Reward (incl. +50) | T1 stage (pack 60) | T2 stage (pack 80) | T3 stage (pack 100) |
|---|---:|---:|---:|---:|
| ★4 (Q80) | 150 | +90 | +70 | +50 |
| ★3 (Q65) | 130 | +70 | +50 | +30 |
| ★1 (floor) | 70 | +10 | −10 | −30 |

These leftovers set the budget any hint price has to fit into. At ★1 the economy already runs a
deficit in T2/T3 stages **without any hints** (pre-existing; see §9.4).

## 3. Current Hint architecture (Discovery Hint 2.0, #229)

- **Target** (`hintTarget.ts`): only a DISCOVERABLE recipe (every non-starter ingredient entitled,
  owned **and stock ≥ 1**). Deterministic order: `recipeKeyStep` asc → distinct ingredient count asc →
  declaration order. A Dex `？？？` card can pin a target (229-D). A target stays sticky once
  `revealedIndex ≥ 1` or `fromDex`.
- **Empty states**: `SHOP_NEW` (a needed material is buyable but not bought), `REFILL` (owned but
  out of stock), `COMPLETE`. None of them names a recipe.
- **Steps** (`hintSteps.ts`, `buildHintSteps`): H0 existence → H1 KEY (latest-unlocked material) →
  H2 SAUCE (or 「ソースはトマトじゃないみたい」) → H3 count + cheese → H4 the remaining ingredients
  **one line each**. `level = min(index, 4)`, so H4 can be 1–3 lines. The n-1 cap means the last
  ingredient is never named, except for the Dex-0 Margherita onboarding. No H5.
- Level coverage on the 24 non-onboarding recipes: **8 end at H3** (bismarck, funghi, pepperoni,
  salsiccia, marinara, genovese, fugazza, pizza-bianca), 16 have an H4. H4 has 2–3 lines on
  parmigiana, quattro-formaggi, puttanesca (2) and capricciosa, meat-lovers, pizza-portuguesa (3).
  Fugazza / pesto-tonno: the key *is* the sauce, so H2 is already count + cheese.
- **Key finding — H1 carries almost no new information.** In the 0→25 walk, the H1 KEY ingredient
  is the material the player **just bought in the Shop** at **24/24** stages (e.g. egg→bismarck,
  gorgonzola→quattro-formaggi). The Shop NEW notice and the free near-miss line
  「🛒 新しく入荷した材料は使ってみた？」 already point at it.
- **Near-miss** (`resultNearMiss.ts`, 229-C): free and always on. d=1 gives a direction
  (ADD_ONE / REMOVE_ONE / SAUCE_ONLY), d=2 says CLOSE, d≥3 says nothing (or the "new material"
  nudge). It never names a recipe or an ingredient. OD-HINT-5 OFF (no FAILED signal).
- **Onboarding** (Dex 0): `preDiscoveryFreeCookAttempts` counts failed free-cook rounds;
  `autoHintIndex = min(attempts + 1, 4)` raises the shown step automatically, and the in-cooking
  hint line escalates too (`FREE_COOK_DISCOVERY_HINT_LEVELS`). Margherita is the only full-answer
  exception (A-4 cap).
- **Persistence:** `GameState.hintSession { targetId, revealedIndex, fromDex? }` is **session-only**
  (OD-HINT-7). It is carried across retries (`ProgressionCarry`) and never saved, so a reload goes
  back to H0. The sheet shows only during Free Cooking PREPARE (`isHintSheetVisible`), and cooking
  time is paused while it is open (OD-HINT-8).
- UI (`HintSheet.tsx`): one CTA 「次のヒントを見る」; 閉じる / backdrop / Escape always close; empty
  copy for SHOP_NEW/REFILL/COMPLETE. No recipe name, id or image reaches the DOM.

## 4. Proposed purchase model

1. **Unit = recipe × hint level.** Ledger `recipeId → highest purchased level (1..4)`. Buying Hn
   needs H(n−1); you cannot skip levels.
2. **Re-reading is free forever.** Levels ≤ the ledger value always show as normal text.
3. **H4 = one purchase for the whole H4 group** (all remaining lines, still n-1 capped).
   *Recommended* because pricing each H4 line separately would charge 3× H4 on
   capricciosa / meat-lovers / portuguesa for the same kind of information. (Owner decision OD-HE-4.)
   The simulation assumes this bundle.
4. **Persistent**, independent of `hintSession.revealedIndex` (§10).
5. **Dex-0 Margherita onboarding is completely free** (H1–H4, plus the existing auto-escalation).
   The player has 0 Pitz at that point, so any price would lock the tutorial. Nothing is written
   to the ledger for the onboarding.
6. **Hints never block discovery.** 閉じる / そのまま作る always work; Free Cooking,
   the matcher and the near-miss line do not depend on hints.
7. **No H5**, no "buy the answer". OD-HINT-5 stays OFF. The anti-spoiler invariants are unchanged (§12).
8. **Lunch Rush untouched.** The sheet only exists in Free Cooking PREPARE. The Pitz balance is shared,
   so Lunch Rush income can pay for hints, but no Lunch Rush code, reward or scoring changes.
9. **Price display only in the sheet; purchase = one reducer transaction** (debit + ledger in one
   step, exactly-once, same pattern as `PURCHASE_INGREDIENT`).

## 5. Candidates

| | H1 | H2 | H3 | H4 | Full set | Ratio | Note |
|---|---:|---:|---:|---:|---:|---|---|
| A | 10 | 20 | 40 | 80 | **150** | 1:2:4:8 | Owner's initial proposal |
| B | 5 | 10 | 20 | 40 | **75** | 1:2:4:8 | |
| C | 10 | 20 | 30 | 50 | **110** | flatter top | |
| **D** | **0** | 10 | 20 | 40 | **70** | H1 free, then 1:2:4 | proposed from the H1 finding (§3) |

Also scanned (not in the tables): 5/15/30/50, 5/10/25/40, 5/15/25/40, 5/10/20/30, 5/10/30/40.
None did better than B or D. Moving H3 from 20 to 25 made no measurable difference; raising H2 to 15 made
P2/P3 slightly worse.

## 6. 25-recipe simulation methodology

Harness: `simulateHintEconomy()` in `src/logic/testSupport/discoveryHintEconomySim.ts`, reusing
the **#229 Final Gate walk** (`src/state/discoveryHint.walk.test.ts`): the same reducer actions,
production `selectHintTarget`, `buildHintSteps`, `resultNearMiss`, and the real matcher deciding
NEW_DISCOVERY.

- **Real reducer:** `START_FREE_COOK → START_BAKE → CONFIRM_BAKE → REGISTER_TO_DEX`
  (matcher, Dex, ladder entitlement, `applyPitzCredit` incl. the +50 bonus, `consumePizzaInventory`),
  `PURCHASE_INGREDIENT` (first pack) and `RESTOCK_INGREDIENT` (refill).
- **Only simulated transaction:** the hint purchase is subtracted from `pitzBalance` by the
  harness, and only when the balance covers it.
- **Player knowledge:** the materials bought this stage (Shop NEW notice), owned ingredients
  newest-first, the purchased hint lines (parsed from the lines themselves), and the RESULT's
  near-miss class. The target id is never used to choose a pizza.
- **Search:** start from sauce (known / new sauce / tomato) + known ingredients + the new materials +
  mozzarella (unless "no cheese"). Then hill-climb over single changes: the near-miss direction limits
  which moves are tried (ADD_ONE → adds, REMOVE_ONE → removes, SAUCE_ONLY → sauce swaps), and
  CLOSE/none widens to adds / removes / swaps / replacements. Every move must respect the known
  hints (named ingredients, sauce, "not tomato", count, cheese yes/no).
- **Profiles:** P0 never buys; P1 / P2 / P4 buy up to H1 / H2 / H4 before the first bake; P3 bakes
  once blind, then buys up to H3; P5 buys H1, then one more level after every failed bake. (L3 =
  H3 up front, analysis only.) An unaffordable level is **skipped, not ground for**, and counted
  once per stage and level as an "insufficient-Pitz hint attempt".
- **Material use:** each topping is placed at `k` pieces and the sauce once (the Shop's
  "1 pack = 10 pizzas" unit). A material is refilled just before a bake that needs more than the
  current stock.
- **Shop first, always:** NEW materials are bought as soon as they unlock. If the Shop cannot be paid,
  the player replays **Margherita** (zero-cost income) until it can: these are **grind bakes**,
  the soft-friction metric.
- **Quality:** each scored bake is registered at a fixed total. Q80 = ★4 (100), **Q65 = ★3 (80,
  the primary "average player")**, Q30 = ★1 (20, stress case). No CT2 bonus (conservative).
- **Search cap:** 80 bakes per stage. If the local search runs out of moves (1–2 late stages
  in some runs), the harness bakes the answer and counts those bakes. This is a model limit, not
  a game deadlock.
- **Caveats:** a deterministic heuristic player, not measured human behaviour. Differences under
  about 10–15% between two curves are within model noise (for example, the P1 fugazza stage takes
  17 bakes versus P0's 4 because of the search order alone). Hint *value* comes from the relative
  ordering of curves, not from absolute numbers.

## 7. Profile results (Q65 = ★3; Q80 / Q30 in the appendix §2)

| Curve | Profile | Hint spend | Shop spend (pack+refill) | Pitz earned (discovery+other) | Min Pitz after Dex 1 | Ending Pitz | Insufficient hint attempts | Experimental bakes | Margherita replays | Total bakes | Deadlock |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| FREE | P0 | 0 | 5650 (2200+3450) | 5810 (3250+2560) | 0 | 160 | 0 | 416 | 22 | 438 | no |
| FREE | P5 | 0 | 3140 (2200+940) | 3330 (3250+80) | 20 | 190 | 0 | 135 | 1 | 136 | no |
| FREE | P4 | 0 | 2920 (2200+720) | 3250 (3250+0) | 70 | 330 | 0 | 101 | 0 | 101 | no |
| A | P0 | 0 | 5650 | 5810 | 0 | 160 | 0 | 416 | 22 | 438 | no |
| A | P1 | 240 | 5730 | 6130 | 0 | 160 | 0 | 391 | 36 | 427 | no |
| A | P2 | 700 | 5220 | 6050 | 0 | 130 | 1 | 309 | 35 | 344 | no |
| A | P3 | 1020 | 4860 | 6050 | 0 | 170 | 9 | 262 | 35 | 297 | no |
| A | P4 | 1100 | 5220 | 6450 | 0 | 130 | 21 | 308 | 40 | 348 | no |
| A | P5 | 1400 | 5230 | 6770 | 0 | 140 | 23 | 300 | 44 | 344 | no |
| B | P0 | 0 | 5650 | 5810 | 0 | 160 | 0 | 416 | 22 | 438 | no |
| B | P1 | 115 | 5900 | 6210 | 0 | 195 | 1 | 414 | 32 | 446 | no |
| B | P2 | 360 | 5500 | 6050 | 0 | 190 | 0 | 303 | 35 | 338 | no |
| B | P3 | 610 | 5060 | 5810 | 0 | 140 | 4 | 285 | 32 | 317 | no |
| B | P4 | 1120 | 3950 | 5250 | 0 | 180 | 9 | 174 | 25 | 199 | no |
| B | P5 | 1100 | 3860 | 5090 | 0 | 130 | 11 | 193 | 23 | 216 | no |
| C | P0 | 0 | 5650 | 5810 | 0 | 160 | 0 | 416 | 22 | 438 | no |
| C | P1 | 240 | 5730 | 6130 | 0 | 160 | 0 | 391 | 36 | 427 | no |
| C | P2 | 700 | 5220 | 6050 | 0 | 130 | 1 | 309 | 35 | 344 | no |
| C | P3 | 900 | 4860 | 5890 | 0 | 130 | 8 | 281 | 33 | 314 | no |
| C | P4 | 1020 | 4860 | 6050 | 0 | 170 | 19 | 270 | 35 | 305 | no |
| C | P5 | 1410 | 3980 | 5570 | 0 | 180 | 12 | 199 | 29 | 228 | no |
| D | P0 | 0 | 5650 | 5810 | 0 | 160 | 0 | 416 | 22 | 438 | no |
| D | P1 | 0 | 5730 | 5890 | 0 | 160 | 0 | 391 | 33 | 424 | no |
| D | P2 | 240 | 5500 | 5890 | 0 | 150 | 0 | 303 | 33 | 336 | no |
| D | P3 | 560 | 4980 | 5730 | 0 | 190 | 2 | 255 | 31 | 286 | no |
| D | P4 | 1040 | 3840 | 5010 | 0 | 130 | 7 | 181 | 22 | 203 | no |
| D | P5 | 1020 | 3440 | 4610 | 0 | 150 | 6 | 165 | 17 | 182 | no |

"Min Pitz after Dex 1" is 0 for most runs because the model spends the balance right down to what
the next purchase needs (grinding up to that price, then buying). The balance never goes negative
(asserted by the test). "Pitz earned (other)" = ALREADY_DISCOVERED experiments + Margherita replays.

**Total bakes to Dex 25 (experimental + replays)** — the headline effort metric:

| Profile | Quality | FREE | A | B | C | D |
|---|---|---:|---:|---:|---:|---:|
| P5 realistic | ★4 | 135 | 240 | 181 | 201 | **154** |
| P5 realistic | ★3 | 136 | 344 | 216 | 228 | **182** |
| P5 realistic | ★1 | 208 | 606 | 657 | 606 | **509** |
| P4 all hints | ★4 | 101 | 304 | 109 | 292 | 108 |
| P4 all hints | ★3 | 101 | 348 | 199 | 305 | 203 |
| P3 H3 when stuck | ★3 | 250 | 297 | 317 | 314 | 286 |
| P0 no hints | ★3 | 438 | 438 | 438 | 438 | 438 |

How much of the FREE hint benefit (P0 → P5 at ★3, 438 → 136 = 302 bakes) each curve takes back:
**A 69%**, C 30%, B 26%, D 15%. Under every curve, P5 still needs fewer bakes than P0, so hints stay
worth buying.

## 8. Per-stage results

Every requested per-stage field (discovery number, recipe, Pitz before, discovery reward, hint
spend, unlock spend, refill spend, Pitz after, hint level owned (and max), experimental bakes,
Margherita replays, stock consumed, blocked?, reason) is in appendix §4 for P5 × A/B/C/D and
A × P4/P0 at ★3. Recommended curve B, P5, ★3 (excerpt):

| # | Recipe | Before | Reward | Hint | Pack | Refill | After | Level | Bakes | Replays | Blocked | Reason |
|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|
| 1 | margherita | 0 | 130 | 0 | 0 | 0 | 130 | H2 (free) | 2 | 0 | no | onboarding free |
| 2 | bismarck | 130 | 130 | 5 | 60 | 0 | 195 | H1/H3 | 1 | 0 | no | ok |
| 5 | melanzane-pizza | 315 | 130 | 75 | 60 | 0 | 310 | H4/H4 | 5 | 0 | no | ok |
| 12 | capricciosa | 390 | 130 | 75 | 160 | 0 | 285 | H4/H4 | 4 | 0 | no | ok |
| 13 | pizza-portuguesa | 285 | 130 | 75 | 80 | 40 | 220 | H4/H4 | 6 | 0 | no | ok |
| 17 | tonno-e-cipolla | 165 | 130 | 35 | 100 | 0 | 160 | H3/H4 | 4 | 0 | no | H4 unaffordable (skipped) |
| 18 | pesto-tonno | 160 | 130 | 75 | 100 | 100 | 175 | H4/H4 | 13 | 2 | soft | Shop needed 2 replays |
| 21 | pesto-caprese | 145 | 130 | 75 | 100 | 340 | 160 | H4/H4 | 31 | 5 | soft | Shop needed 5 replays |
| 25 | quattro-formaggi | 205 | 130 | 75 | 200 | 330 | 130 | H4/H4 | 22 | 5 | soft | Shop needed 5 replays |

What each hint level is worth (FREE prices, ★3; experimental bakes when the player knows exactly Hn):

| Stage group | H0 | H1 | H2 | H3 | H4 |
|---|---:|---:|---:|---:|---:|
| Stages 1–11 (T1/early T2, tomato + mozzarella + X) | 36 | 36 | 36 | 36 | 24 |
| Stages 12–25 (olive-oil/pesto sauces, 4–6 ingredients) | 380 | 355 | 267 | 179 | 77 |
| **Total** | **416** | **391** | **303** | **215** | **101** |

- H1 saves ~6% (it names the material just bought). H2 matters only for non-tomato recipes.
  **H3 (count + cheese) saves the most** (pizza-bianca 24→2, new-haven 35→6). H4 cuts late
  4–6 ingredient recipes to a few bakes (quattro-formaggi 42→1, capricciosa 26→1).
- In stages 1–11, paid hints buy almost nothing: those recipes are found in 1–5 bakes without them.
  Hint value is concentrated in stages 12–25, which is also where Pitz is tightest (T3 packs,
  refills).

## 9. Deadlock analysis

### 9.1 Hard deadlock: none possible

- **Dex 0:** Margherita uses only starters (unlimited, free). Onboarding hints are free (proposal §4.5).
  No Pitz is needed at all.
- **Dex ≥ 1:** Margherita can always be replayed, from Pizza Select or Free Cooking. Its materials cost 0 and it pays ≥ 20
  Pitz (★1 floor), 80 at ★3. Lunch Rush (≥ 40 per run) is a second source. Every Shop price
  (≤ 100) is reachable in at most 5 replays even at ★1.
- Hints cannot make a material unaffordable permanently: a hint purchase is refused when the
  balance is short, so the balance never goes negative, and the Shop can always be reached through replays.
- Verified on the real reducer: **every** curve × profile × quality run (5 × 7 × 3 = 105) reached
  Dex 25; `hardDeadlock = false` everywhere. The CI test pins this for ★3.

### 9.2 Checked conflicts

| Risk | Result |
|---|---|
| Cannot buy the new material because of hint spending | Never permanent. Costs replays: A P5 ★3 needed 44 vs P0's 22 |
| Cannot refill | Same as above. Refills are 30–50, Margherita pays 80 (★3) |
| Next DISCOVERABLE unreachable | No. The target depends only on entitlement + stock, never on hints |
| Inventory short | Handled by refill-before-bake. A stock-0 target turns into REFILL (see §14 R-4) |
| Shop vs Hint competition | **A:** H4 (80) = a T2 pack, > every refill; the P5 player is refused 23 hint levels. **B/D:** every price ≤ 40 (= a T2 refill, below every pack), so a hint never costs more than a Shop pack and at most one refill |
| Free Cooking blocked by no Pitz | No. The sheet can always be closed, and cooking/matcher/near-miss are independent |

### 9.3 Soft disadvantage for normal hint users

Measured as extra Margherita replays compared with the same profile under FREE (★3, P5): A +43,
C +28, B +22, D +16. Relative to the no-hint player P0 (22 replays): under A the realistic hint user
needs **twice** P0's replays (44), under B/D about the same as P0 (23 / 17). In other words, under A,
using hints the way they are meant to be used costs **more Pitz friction than not using them**.
Under B/D it is roughly neutral in Pitz and still saves 200+ bakes of trial and error.

### 9.4 Pre-existing observation (not caused by hints)

At ★1 the discovery reward (70) is below T2/T3 pack prices, so even P0 under FREE needs about 189
Margherita replays to finish. That is a property of the current Shop/★ economy and outside this scope.
It is flagged for a separate Economy Tuning look. Hint prices change it relatively little (paid-hint profiles land at 490–660 bakes vs P0's 605).

## 10. Save design (minimal, no schema bump)

```ts
// PersistentSaveV2 (schemaVersion stays 2) — new optional field, EP4/I4b precedent
discoveryHintPurchases: Record<string /* recipeId */, number /* highest purchased level, 1..4 */>;
```

| Concern | Design |
|---|---|
| Schema/version | **No bump.** An absent or malformed value reads as `{}` (same pattern as `starterGrantClaimedRecipeIds`, `unlockedForShopIngredientIds`) |
| Old save migration | none needed: `{}` = nothing bought. Discovery Hint 2.0's free reveals were session-only, so there is nothing to carry over |
| Fresh save | `createDefaultSave()` adds `discoveryHintPurchases: {}` |
| Known recipe id | value must be an integer 1..4 (a value > 4 is clamped to 4 for reading, and the raw value stays in storage) |
| Unknown recipe id | kept verbatim when well-formed (`FORWARD_COMPAT_ID_PATTERN`, integer ≥ 1), never read by gameplay: add it to `ForwardCompatExtras`/`writeSave` like the other ledgers |
| Older build reading a newer save | an older build does not know the key, so it goes to `topLevel` extras and is written back verbatim (already works today) |
| Future H levels | store the **level**, not a step index; derive the lines at read time from `buildHintSteps`. If a later H level is added, stored values stay valid |
| Monotonic | like the entitlement ledger: a write keeps `max(stored, snapshot)` per id, so a stale snapshot can never lose a purchase |
| Reset | Full Game Reset (`resetSave`) removes the whole key, so the ledger resets with Pitz and Dex. If a future "achievement-only reset" (UX-5) keeps Pitz, it should clear this ledger too (OD-HE-6) |
| Discovered recipes | **keep** the entries (no cleanup). They are tiny, allow re-reading from a Dex card later if wanted, and keep rollback/forward-compat simple |
| Size | ≤ 25 × ~25 B ≈ 0.6 KB now; ~4 KB even at a 160-recipe catalog |
| Write path | `ProgressionSnapshot.discoveryHintPurchases?` in `persistProgress`, with the same no-op-skip comparison |
| Session state | `hintSession` keeps `targetId`/`fromDex` (session-only as today). The shown index becomes `max(autoHintIndex (Dex 0), index of the last line of the purchased level)`; `revealedIndex` is only used for the free Dex-0 path |

## 11. UI / UX proposal (not implemented)

Hint sheet footer states (the step list above stays as today):

| State | CTA | Sub-line |
|---|---|---|
| Dex 0 onboarding | 「次のヒントを見る（無料）」 | 「🎁 はじめてのピザはヒント無料！」 |
| Next level not bought, affordable | 「🔒 次のヒントを見る　10 Pitz」 | 「所持 125 Pitz」 |
| Next level not bought, not affordable | disabled, neutral grey: 「🔒 次のヒント　40 Pitz」 | 「所持 25 Pitz ・ Pitzがたまったら見られるよ。このまま作ってもOK！」 |
| Bought levels | shown as normal lines, no price, no lock | — |
| All levels bought | 「ヒントはここまで！あとは作って試してみよう。」 (unchanged) | — |
| D only: H1 | 「次のヒントを見る」 with no price | — |

- 閉じる and そのまま作る (closing the sheet) are always enabled. Pitz shortfall is **never red**, never a
  modal, never an error sound. It is information, not a failure.
- Purchase = one tap on the priced CTA (prices ≤ 40 under B/D). Showing Pitz before and after
  (「125 → 115 Pitz」) as the new line appears is recommended. A confirmation dialog is optional (OD-HE-7).
- Never show the total remaining cost or the number of remaining levels up front. The
  existing "is there more" signal (CTA present or not) is enough, and a count would leak
  the ingredient count before H3.
- The HOME/Shop Pitz display is unchanged. The hint sheet reads the balance from `GameState.pitzBalance`.

## 12. Anti-spoiler impact

- All #229 invariants hold: no recipe name, id or image in the DOM, `aria-*` or `data-*`. The price CTA
  must not carry a recipe id either (use `data-hint-level` only).
- The n-1 cap, the Margherita-only full answer, H0 first, no H5, OD-HINT-5 OFF: all unchanged.
- **New vector:** the ledger stores recipe ids of *undiscovered* recipes in localStorage. This is
  the same exposure level as `unlockedForShopIngredientIds` / in-memory `hintSession.targetId`,
  and only visible through devtools. Accepted. It could be hashed if the Owner wants (OD-HE-8).
- Showing the *next* price reveals only that another level exists, which the current CTA already
  shows. Not showing totals (§11) avoids leaking how many lines remain.
- Target stickiness: to keep purchased progress useful, a recipe with a purchased level should be
  preferred as the automatic target while it is DISCOVERABLE (today sticky only for the session). This
  reveals nothing new (OD-HE-5).

## 13. Regression surface (for the implementation phase)

- `src/state/discoveryHint.ts` (view derivation, reveal), `src/state/gameReducer.ts`
  (`SHOW_HINT`/`REVEAL_NEXT_HINT` → new `PURCHASE_DISCOVERY_HINT`, `ProgressionCarry`),
  `src/components/HintSheet.tsx`, `src/App.tsx` (persist effect, Dex-pinned hint),
  `src/state/persistence.ts` (`KNOWN_SAVE_KEYS`, sanitize, forward-compat extras, `persistProgress`).
- Tests that assume free reveal: `discoveryHint.test.ts`, `discoveryHint.walk.test.ts` (Final
  Gate walk: needs Pitz or the harness's purchase path), `HintSheet.test.tsx`,
  `GameScreen.hintSheet.test.tsx`, `App.hintSheet.test.tsx`, `App.dexHint.test.tsx`,
  `gameReducer.hintSheet.test.ts`, `App.cookingTimingBackground.test.tsx` (OD-HINT-8),
  `persistence.forwardCompat.test.ts`, `App.fullGameReset.test.tsx`, e2e specs that open the sheet.
- Must stay byte-identical: Lunch Rush (`mission/*`, `CLAIM_MISSION_REWARD`), scoring,
  `pitzReward.ts`, `materialShop.ts`, matcher/signature, ladder, `resultNearMiss`.

## 14. Risks

- **R-1 Model risk:** heuristic player with fixed quality. Mitigation: compare curves on relative
  ordering; confirm with Human Feel on the chosen curve before tuning further.
- **R-2 "Paid for what I just bought":** H1 names the new Shop material in 24/24 stages. Under A/C
  (10 Pitz) this may feel like a rip-off. Mitigation: B (5) or D (free).
- **R-3 Late-game squeeze:** stages 18–25 (T3 packs, 5-ingredient recipes) are where hints help most
  and Pitz is tightest. A's H4 (80) is effectively out of reach there.
- **R-4 Stock-0 target:** when the target's material hits stock 0, the sheet shows REFILL and the
  player's purchased lines are hidden until the refill. Proposal: add 「購入済みのヒントは補充するとまた見られるよ」
  to the REFILL copy (OD-HE-9). Keep the DISCOVERABLE-only target invariant.
- **R-5 Save:** a stale-snapshot overwrite losing a purchase is avoided by the monotonic max merge.
  A rollback build keeps the key verbatim (already works).
- **R-6 No refunds:** purchases are final. Make the price and one-tap purchase clear (§11).
- **R-7 ★1 players** are already Pitz-starved (§9.4). Hints add little on top, but the combined
  experience needs a Human Feel check.

## 15. Recommended price curve

**B — H1 5 / H2 10 / H3 20 / H4 40 (full set 75)**, with H4 as one bundled purchase and
Dex-0 onboarding free.

| Check | A | B | C | D |
|---|---|---|---|---|
| H1 is casual | 10 for information already given | ✅ 5 | 10 | ✅ free |
| H2 needs a little thought | ✅ | ✅ | ✅ | ✅ |
| H3 is a clear decision (≈ ⅓–½ of a stage's leftover) | 40 ≈ whole T3 leftover at ★3 | ✅ 20 | 30 | ✅ 20 |
| H4 is for "really stuck" | 80: often unaffordable (21–23 refusals) | ✅ 40 (9–11 refusals) | 50 (12–19) | ✅ 40 (6–7) |
| Hints never outrank materials (≤ 40 = T2 refill, < every pack) | ❌ H4 80 = T2 pack | ✅ | ❌ H4 50 = T3 refill | ✅ |
| Hints not so cheap they're trivial | ✅ | ✅ 75 ≈ one T2 pack per recipe | ✅ | ✅ 70 |
| Discovery reward covers a full set | ❌ 150 > 150−pack | ~ fits in T1/T2 at ★4 | ❌ | ~ |
| P5 bakes (★3) / benefit taken back | 344 / 69% | 216 / 26% | 228 / 30% | **182 / 15%** |

B is the best of the three Owner candidates on every data row. D (B with H1 free) is best overall
by a moderate margin. It is recommended as an alternative if the Owner accepts that H1 only confirms
the just-bought material. Leaving A's 1:2:4:8 ratio but halving the base (i.e. B) is enough; the
data does not justify a flatter top (C).

## 16. Implementation slices (proposed, not started)

| Slice | Content | Est. |
|---|---|---|
| HE-1 | Pure price table + `purchaseDiscoveryHint()` (level order, onboarding-free, affordability, max level, exactly-once), unwired, with unit tests | 1–1.5 h |
| HE-2 | Save: `discoveryHintPurchases` in v2 (no bump), sanitize, forward-compat, monotonic merge, `persistProgress`, reset tests | 1.5–2 h |
| HE-3 | Reducer/view: `PURCHASE_DISCOVERY_HINT`, shown index from the ledger, Dex-0 path unchanged, sticky preference, Final Gate walk updated to pay (reuse this harness) | 2 h |
| HE-4 | HintSheet UI (§11 states, neutral insufficient state, Pitz before→after), before/after screenshots | 2 h |
| HE-5 | e2e + 390×844 Human Verification video per `TETO_HUMAN-VERIFICATION-POLICY.md`, Result Report | 1.5 h |

HE-4/HE-5 are UI/gameplay changes and fall under the Human Verification policy. This audit is
exempt (no production change).

## 17. Owner decisions required

| ID | Decision | Recommendation |
|---|---|---|
| **OD-HE-1** | Price curve A / B / C / D | **B** (5/10/20/40). Alternative D (0/10/20/40) |
| OD-HE-2 | Dex-0 onboarding free for all levels | Yes |
| OD-HE-3 | Unit = recipe × level, re-read free, persistent | Yes (as specified) |
| OD-HE-4 | H4 = one bundle (all remaining lines) vs priced per line | Bundle |
| OD-HE-5 | A recipe with purchased levels is preferred as the auto target while DISCOVERABLE | Yes |
| OD-HE-6 | A future achievement-only reset clears the ledger | Yes |
| OD-HE-7 | Confirmation dialog before purchase | No (one tap; show before→after) |
| OD-HE-8 | Hash recipe ids in the ledger | No (same exposure as existing ledgers) |
| OD-HE-9 | REFILL copy mentions purchased hints reappear after refill | Yes |
| OD-HE-10 | ★1 economy deficit (§9.4) tracked as a separate Economy Tuning item | Yes, out of scope here |

## 18. Final verdict

**READY FOR OWNER DECISION.** The paid, persistent Discovery Hint model is feasible without a save
schema bump, without touching Lunch Rush / scoring / matcher / ladder, and without any possible
hard deadlock. The only material risk is soft friction, and it depends mostly on the price level:
**A (10/20/40/80) roughly doubles the Pitz friction of a player who uses hints normally and makes
H4 unreachable in the late game; B (5/10/20/40) keeps hints worth buying while giving them a real
cost.** Recommendation: B (or D). Final choice rests with the Owner. Implementation (HE-1..HE-5)
has **not** been started.
