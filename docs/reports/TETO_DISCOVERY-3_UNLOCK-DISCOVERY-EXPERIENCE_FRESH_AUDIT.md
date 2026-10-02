# Discovery 3.0 — Unlock / Discovery Experience Fresh Audit

READ-ONLY / DOCS-ONLY. No production code, ladder, recipe, test, PR #343, No.28, R6 or IP-2 is touched.
No recipe is chosen, nothing is ranked or scored.

## 0. Basis (fresh fetch)

| Subject | Ref | State |
|---|---|---|
| `origin/main` | `82d8235f533272481405d8b7c01222b74298de46` (PR #341) | 26 recipes, ladder = 24 steps (`POST_W1_APPENDED_STEPS = []`) |
| PR #343 HEAD | `6d370c0d1d8b08e3d5be439b912d90c88f6ce964` (OPEN, not merged, awaiting Final Gate) | 27 recipes, ladder = 25 steps (`+ step 25: chicken → pesto-pollo`) |

Steps 1–24 are byte-identical on both (LAD-1 frozen). The only ladder delta in #343 is the appended step 25.

**Method.** Nothing re-implemented: a throw-away read-only Vitest harness (not committed) called the production
predicates — `recipeDiscoveryState` (DISCOVERABLE), `selectHintTarget` (target / `OPEN_POOL`), `resolveShopEntitlement`
via `DISCOVERY_LADDER`, `countsTowardLadder` — on `main` and on a PR #343 worktree. It is the same convention as the
Discovery Progression Inspector (`src/dev/discoveryProgressionModel.ts`). The 172 matrix is not re-audited; recipe
ingredient sets are read from `RECIPES`.

**Terms.**
- *Pool* = recipes that are DISCOVERABLE right now (every ingredient owned + stocked, not yet in the Dex).
- *Calabresa* = `brazilian-calabresa` (No.26): `ladderCredit: false`, `lunchRush: false`. It needs `onion` (step 12) and
  otherwise only starters / earlier materials, so it is makeable from step 12 on, but discovering it does **not**
  advance the ladder.
- *State U* = calabresa **not yet found**; *State D* = calabresa **already found**.
- Player-facing wording for the pool member that stays: **「以前から発見可能だが、まだ発見していないレシピ」**
  (a recipe the player could already have made at an earlier step but has not yet found). It is not a "carry-over"
  of anything the game hands the player; it is a recipe the player has left unfound. Below it is written *"earlier-makeable, still-unfound"*.

## 1. How the ladder is structured (facts that drive everything below)

1. Step *s* is reached when the credited Dex count is ≥ *s*. Credited recipes that are makeable once step *s−1* is
   bought: margherita + key recipes 1…*s−1* = *s* recipes. So reaching step *s* means **all** earlier credited
   makeable recipes are already found; on arrival the only credited undiscovered makeable recipe is step *s*'s key recipe.
2. Therefore the pool at step *s* is always `{ key(s) }` plus, only from step 12, `{ calabresa }` if still unfound.
   The order in which the player found earlier recipes cannot change this.
3. Every credited recipe's first-makeable step equals its own key step (checked for all 26 credited recipes of #343);
   calabresa is the single recipe whose first-makeable step (12) is shared with another recipe (pizza-portuguesa) and
   that is not a key recipe.
4. Because a step is only reached by finding the earlier recipes, a non-credit recipe is the **only** way for an
   earlier-makeable, still-unfound recipe to exist in the current ladder.
5. Pool states before buying: when the new material is in the Shop but not bought, the key recipe is
   `KNOWN_BUT_MISSING_MATERIAL`, not DISCOVERABLE. Only then does the pool exclude it (see §5).

## 2. Step 1–11 — straight line (A)

Pool "at arrival" = DISCOVERABLE right after buying the step's material(s), with all earlier key recipes found.
Start (no purchase): `{ margherita }`.

| Step | New material | Newly DISCOVERABLE | Pool size | Pool |
|---|---|---|---|---|
| 1 | egg | bismarck | 1 | bismarck |
| 2 | bacon | breakfast-pizza | 1 | breakfast-pizza |
| 3 | mushroom | funghi | 1 | funghi |
| 4 | eggplant | melanzane-pizza | 1 | melanzane-pizza |
| 5 | parmigiano | parmigiana-pizza | 1 | parmigiana-pizza |
| 6 | pepperoni | pepperoni | 1 | pepperoni |
| 7 | sausage | salsiccia | 1 | salsiccia |
| 8 | ham | meat-lovers | 1 | meat-lovers |
| 9 | corn | bambino | 1 | bambino |
| 10 | pineapple | hawaiian | 1 | hawaiian |
| 11 | black-olive + oregano | capricciosa | 1 | capricciosa |

- `selectHintTarget` returns `TARGET:<that recipe>` automatically at all 11 steps (pool = 1).
- The whole stretch (and the starting state) is a **single line**: each purchase makes exactly one recipe makeable, and
  that recipe is the only thing to find. The player's inference is "what does the new material complete?", with no
  alternative candidate.
- Steps 7, 8 and 11 reuse earlier materials in new combinations (sausage, ham, black-olive/oregano), but the *pool* is
  still one recipe.

## 3. Step 12 — first multi-candidate (OPEN_POOL) structure

Step 12 unlocks `onion` (key: pizza-portuguesa).

| Recipe | Required ingredients (count) | Why makeable at 12 |
|---|---|---|
| pizza-portuguesa | tomato-sauce 1, mozzarella 2, ham 3, egg 1, onion 2, black-olive 2 | onion is its last missing material |
| brazilian-calabresa | tomato-sauce 1, sausage 3, onion 2, black-olive 2, oregano 1 | onion is its last missing material |

- Both recipes become DISCOVERABLE on the **same purchase**. Neither was makeable before, so neither is
  "earlier-makeable, still-unfound": the pool is 2 and **both are new**. The model classes it `OPEN_POOL`
  (not `OPEN_POOL_POSSIBLE`).
- State U (arrival): pool = `{ pizza-portuguesa, brazilian-calabresa }`, `selectHintTarget` → `OPEN_POOL`
  (D-1: with 2+ candidates and no pin/sticky/purchase, no recipe is chosen).
- This is the first (and, with the ladder as is, only) step where the player is *forced* into a real choice: the new
  material fits two recipes. Both share onion + black-olive and use different meat (ham/egg vs sausage/oregano).
- Branch in the middle of step 12: if the player finds calabresa first, the ladder count does **not** move
  (non-credit), the pool becomes `{ pizza-portuguesa }` → `TARGET`; if portuguesa is found first the count advances to 13
  and calabresa remains in the pool.
- Step 12 is the only moment where the player cannot yet have found calabresa *before* the purchase.

## 4. Step 13–24 — one key recipe + (if unfound) calabresa

Pool at arrival (after buying), per state:

| Step | New material | Key recipe | Pool in State U (calabresa unfound) | Pool in State D (calabresa found) |
|---|---|---|---|---|
| 13 | olive-oil | fugazza | fugazza + calabresa → OPEN_POOL | fugazza → TARGET |
| 14 | garlic | marinara | marinara + calabresa → OPEN_POOL | marinara → TARGET |
| 15 | anchovy | napoletana | napoletana + calabresa → OPEN_POOL | napoletana → TARGET |
| 16 | tuna | tonno-e-cipolla | tonno-e-cipolla + calabresa → OPEN_POOL | tonno-e-cipolla → TARGET |
| 17 | pesto | pesto-tonno | pesto-tonno + calabresa → OPEN_POOL | pesto-tonno → TARGET |
| 18 | cherry-tomato | genovese | genovese + calabresa → OPEN_POOL | genovese → TARGET |
| 19 | clam | new-haven-apizza | new-haven-apizza + calabresa → OPEN_POOL | new-haven-apizza → TARGET |
| 20 | fresh-tomato | pesto-caprese | pesto-caprese + calabresa → OPEN_POOL | pesto-caprese → TARGET |
| 21 | potato | pesto-patate | pesto-patate + calabresa → OPEN_POOL | pesto-patate → TARGET |
| 22 | rosemary | pizza-bianca | pizza-bianca + calabresa → OPEN_POOL | pizza-bianca → TARGET |
| 23 | capers | puttanesca-pizza | puttanesca-pizza + calabresa → OPEN_POOL | puttanesca-pizza → TARGET |
| 24 | fontina + gorgonzola | quattro-formaggi | quattro-formaggi + calabresa → OPEN_POOL | quattro-formaggi → TARGET |

(The two columns show the pool the hint sees at arrival. The Inspector labels State U at these steps
`OPEN_POOL_POSSIBLE`, because one member — calabresa — was already DISCOVERABLE before the unlock.)

### What `OPEN_POOL_POSSIBLE` actually is

- In State U, pool size is 2 at every step 13–24, and `selectHintTarget` with no maintained target is `OPEN_POOL`.
  Calabresa is, from the player's view, **a recipe that has been makeable since step 12 and is still not found**
  (「以前から発見可能だが、まだ発見していないレシピ」). The key recipe is the **new** one.
- The only way `OPEN_POOL` does not appear is a *maintained* target: a recipe the player pinned from the Dex when the
  pool was 1, purchased a hint for, or revealed (sticky, session-only, honoured only while still DISCOVERABLE).
  A pin does not choose among 2+ (OD-4b-A-2).
- **Sequence matters (checked on both trees).** In State U, between *reaching* step *s* and *buying* its material, the
  key recipe is `KNOWN_BUT_MISSING_MATERIAL`, so the pool is `{ calabresa }` and the hint auto-targets calabresa
  (`TARGET:brazilian-calabresa`, steps 13, 24, 25 all verified). After the purchase the pool is 2 and, with no
  sticky, `OPEN_POOL`. So the player either (a) pins/buys a hint for calabresa in the pre-purchase window and then sees
  one recipe (conditional single), or (b) buys first and meets `OPEN_POOL`. "OPEN_POOL_POSSIBLE" = both are reachable
  depending on what the player did.
- The two calabresa-found paths (State D) reduce every step 13–24 to a single line, exactly like 1–11.
- Calabresa found early (any time after step 12, before the player moves on) removes the branch permanently — and the
  inverse: a player who never finds calabresa meets a 2-candidate pool at **every** step 13–25.

## 5. PR #343 — Step 25 (chicken → pesto-pollo)

`pesto-pollo` = pesto 1, mozzarella 2, fresh-tomato 2, chicken 3. Only `chicken` is new (family `meat`, finite).
Ladder credit: yes (default), Lunch Rush: no, key-free Hint (no KEY_TOPPING).

| Condition | Chicken not bought yet | Chicken bought |
|---|---|---|
| State U (calabresa unfound) | pool = `{ calabresa }` (pesto-pollo is `KNOWN_BUT_MISSING_MATERIAL`) → `TARGET:brazilian-calabresa` | pool = `{ calabresa, pesto-pollo }` → `OPEN_POOL` (no maintained target); with calabresa sticky → TARGET calabresa |
| State D (calabresa found) | pool = `{}` (pesto-pollo `KNOWN_BUT_MISSING_MATERIAL`) → `SHOP_NEW` | pool = `{ pesto-pollo }` → `TARGET:pesto-pollo` |

- Pool size at purchase: **2 in State U, 1 in State D** — the same B pattern as steps 13–24; step 25 does not add a new kind of branch.
- calabresa (tomato-sauce, sausage, onion, black-olive, oregano) and pesto-pollo (pesto, mozzarella, fresh-tomato,
  chicken) share **no required ingredient**, so in State U the two candidates are disjoint; the newly bought chicken is the
  only clue that points at one of them.
- Step 25 introduces no new ladder step beyond itself; calabresa remains `ladderCredit:false`, so finding it still does not move the count.
- After step 25 the ladder ends (25 steps, 27 recipes). Once pesto-pollo and calabresa are both found, every recipe of
  the population is found (`COMPLETE`).

## 6. A / B / C classification (current ladder, PR #343 HEAD)

| Class | Meaning | Steps |
|---|---|---|
| **A. one candidate only** | pool always exactly 1 | **start, 1–11** |
| **B. conditional 2** | 1 if calabresa already found, 2 if not | **13–24 (main), 13–25 (with #343)** — and step 12 mid-step after calabresa is found first |
| **C. always multiple** | pool ≥ 2 irrespective of player history | **12** (both candidates are new: portuguesa + calabresa; exactly 2) |

- On `main`: A = 1–11, C = 12, B = 13–24. With #343: B extends to 25 (A and C unchanged).
- No step has a pool ≥ 3. Maximum pool size anywhere = 2.
- `OPEN_POOL` can therefore occur in 14 of 25 steps (12–25), but in 13–25 only for the player who has not found calabresa.
  The only step with a structurally guaranteed multi-candidate choice is step 12.

## 7. Where more existing-material recipes could add inference (facts only)

All statements are facts about the current data; no recipe is proposed.

1. **The stretch 1–11 and 13–25 (State D) is a single line today.** A recipe's first-makeable step is the highest ladder
   step among its non-starter ingredients. A new recipe built only from existing materials with latest material at
   step *k* becomes DISCOVERABLE at step *k*, joining `key(k)` (pool +1 at that step), and stays in the pool at every later
   step until found.
2. **A recipe's effect depends on `ladderCredit`.** Non-credit (like calabresa): the count is unchanged, the ladder
   timing of §1 still holds, and the recipe simply stays in the pool until found. Credited: it adds one to the count, so
   the "reaching step *s* means every earlier makeable recipe is found" property of §1.1 no longer holds (a player can
   reach a later step while an earlier credited recipe is still unfound). Which of the two applies is a decision this
   audit does not make.
3. **Latest-material coverage by step** (what the owned set at each step can already complete): materials appear in
   this order — egg, bacon, mushroom, eggplant, parmigiano, pepperoni, sausage, ham, corn, pineapple, black-olive+oregano,
   onion, olive-oil, garlic, anchovy, tuna, pesto, cherry-tomato, clam, fresh-tomato, potato, rosemary, capers,
   fontina+gorgonzola, chicken. Sauce bases become possible at: tomato-sauce (starter, step 1+), olive-oil (13+), pesto (17+).
   Hence an existing-material recipe's earliest possible step is bounded by its base: pesto-based ≥ 17, olive-oil-based ≥ 13, tomato-sauce-based ≥ 1.
4. **Stretches where a second, independent candidate would change the experience most plainly** (descriptive, not ranked):
   - steps 1–11 (A): pool 1 → 2 would be the first branch before step 12;
   - steps 13–25 State D (B→A for players who found calabresa): a pool of 1 → 2;
   - step 12: already 2; a third would make a 3-way (C+).
5. **Counts the player sees.** The Dex "?" candidate count is not exposed by `OPEN_POOL` (the view carries only `kind`),
   so adding a candidate changes the player's inference, not a number on screen.
6. **Things a future addition must still respect (existing authority, not re-audited):** Lunch Rush eligibility,
   `recipeKeyStep` ordering for hint candidates, Dex chapter/number placement, LAD-1 (steps 1–24 frozen, new steps
   append), the ingredient 8-slot ring, and the anti-oracle rules of OPEN_POOL copy.

## 8. Short summary

- **Straight line (A):** start, steps 1–11.
- **Always branches (C):** step 12 only (portuguesa + calabresa).
- **Conditional (B):** steps 13–24; with #343 also step 25 (2 if calabresa unfound, 1 if found).
- **After Step 25 (#343):** 25 steps, 27 recipes; same B pattern; pool max 2; calabresa and chicken disjoint, so chicken is the only clue; PR #343 not modified, not merged.
- **Where branching could grow:** the single-candidate stretches 1–11 and (for State D players) 13–25.
