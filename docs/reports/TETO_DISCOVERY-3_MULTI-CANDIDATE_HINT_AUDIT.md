# Discovery 3.0 — Multi-candidate Hint Audit / Design (pool > 1)

- Status: **AUDIT / DESIGN ONLY.** No `src/` / `e2e/` / CSS change, no PR, no merge.
- Audited `main`: `93ca1e404c4e942e48b69506ff600bd8fcdfbb51` (fresh `git fetch origin main`; `origin/main` == HEAD; no drift).
- Not re-audited / not reimplemented: PR #332 (Trial Notebook N1, COMPLETE). Read only to describe the current Hint ↔ Notebook connection.
- Facts below marked **(verified)** were reproduced on this SHA (code read, plus a throw-away `vite-node` probe kept in the scratchpad, not committed). Anything else is labelled *inference* or *to verify in the slice*.

---

## 0. Duplicate Gate (open PR / Issue)

Open PRs: 23 (#321, #319, #307, #296, #295, #293, #272, #255, #220, #219, #218, #217, #214, #211, #209, #208, #205, #204, #105, #72, #46, #34, #3). Open Issues: 30.

| Item | Relation to this task |
|---|---|
| #238 (Hint 3.0 Selectable), #253 (Hint 4.0), #292 (Hint 5.0 ladder) | Open umbrella Issues for the hint families. None scopes pool > 1. |
| #255, #293 | Docs-only audits (taxonomy). No code on pool behaviour. |
| #295 / #294 (Post-W1 Cooking Steps), #272 / #269 (Large Catalog UX) | Unrelated to Hint targeting. |

**No open PR or Issue implements, or is scoped to, a multi-candidate Hint.** Gate: clear. (Title scan of all 23 PRs and 30 Issues; I did not read every body.)

---

## 1. Why the Owner's screen showed only 「まだ発見できるピザがあるよ！」 (exact)

Trace on `93ca1e4` (all **verified**):

1. **Pool at Dex 12 + onion.** `recipeDiscoveryState()` (`src/state/recipeDiscoveryState.ts`) marks a recipe `DISCOVERABLE` when it is undiscovered and every required ingredient is usable now. Buying the onion (W1 step 12) makes **both** `pizza-portuguesa` (W1 key recipe) and `brazilian-calabresa` (No.26, `ladderCredit:false`, `lunchRush:false`, key-free) `DISCOVERABLE`. Probe output: `pool = [pizza-portuguesa, brazilian-calabresa]`.
2. **Target selection closes.** `selectHintTarget()` (`src/logic/discovery/hintTarget.ts:92-106`): pin and sticky are checked first; with neither, `candidates.length === 1` → `TARGET`, `candidates.length > 1` → `{ kind: "OPEN_POOL" }`. Probe: `selectHintTarget(...) = { kind: 'OPEN_POOL' }`.
3. **No session.** `resolveHintSession()` (`src/state/discoveryHint.ts:~195`) returns `null` for a non-`TARGET` result → `hintSession = null` on `SHOW_HINT` (`gameReducer.ts:1572`).
4. **View.** `hintSheetView()` falls into the "no session target" branch and returns `{ kind: "OPEN_POOL" }` (`discoveryHint.ts:~548-552`). `GameScreen.tsx:903-905` passes `hint5 = hint5SheetView(state)` (null: no session) and `hint5Active = hint5LadderActive(state)` (false: no session).
5. **Sheet.** `HintSheet.tsx` renders the final `else` branch: `EMPTY_COPY.OPEN_POOL` (title + body = the Owner's text). No ladder, no purchase CTA.
6. **Purchase is also dead.** Every purchase path (`purchaseSelectableHintFact`, `requestDeductionHintFact`, `requestHint5RungFact`, `unlockNextHint`) starts with `isSessionTarget()`, which re-runs `resolveHintSession()`; it is `null`, so every request returns `null`. The Hint 5.0 flag (production default `true`, `hint5Flag.ts`) does not matter: it only changes what a *target* shows.

**Why nothing rescues it (important, new finding).** The rescue paths are *sticky target* (paid hints bought earlier on a still-`DISCOVERABLE` recipe) and *Dex pin*. In production neither can exist at this moment:
- `pizza-portuguesa` needs the onion, so before the onion it is `KNOWN_BUT_MISSING_MATERIAL` (never a target; the sheet says `SHOP_NEW`). No hint for it can have been bought. When the onion is bought the pool becomes 2 *in the same step*, so there is no window with `pool = 1` in which to buy.
- A Dex pin is honoured at pool > 1 only if it is already the sticky target (OD-4b-A-2). The Dex shows one aggregated unknown card with no per-candidate entrance (D-2), so the player has no card to pin from anyway.

So every production player reaches the window "onion bought, neither of the two found" with **zero** possible hint — a guaranteed dead end, not an edge case. It lasts until the first of the two is discovered (the pool then falls to 1 and the normal ladder returns). This is the *designed* D-1 / D-2 behaviour (PR-4b-A), not a regression. The product gap is that D-1 closed the ladder and offered nothing in its place.

**It is not a bug and not a leak. It is an affordance hole.** The only thing the sheet says is "try combinations"; the 📓 試作ノートを見る entry exists in the header (N1) but nothing connects the two.

---

## 2. OPEN_POOL current behaviour vs pool = 1

| | pool = 1 | pool > 1 (no sticky) |
|---|---|---|
| `selectHintTarget` | `TARGET` (`source:"auto"`) | `OPEN_POOL` |
| Session | created by `resolveHintSession` | `null` |
| Sheet | ladder (`SELECTABLE` / Hint 5.0) | `EMPTY_COPY.OPEN_POOL`, one fixed paragraph |
| Purchase | allowed | all paths return `null` |
| Dex card | 🎨 card with 「💡 ヒントを見る」 | one aggregated 🎨 card, no No., no entrance (`aggregateUnknown`, `DexOverlay.tsx:123`) |
| Pin | works | counts only if already sticky |
| Sticky / purchased | kept while `DISCOVERABLE` | **kept** (a bought target survives a pool growing to 2+; `discoveryHint.pool.test.ts`) |
| Candidate order | used for order only | `discoverableHintCandidates()` is used for sticky resolution, near-miss, and test sims; **never as a target reason** |

The 25-recipe ladder never reaches pool > 1 (asserted in the PR-4b-A tests). Production reaches it **once**, at Dex 12 + onion, because of No.26. At 172 recipes it will be a normal state (see §9).

### Pre-existing facts the design must respect (found during the audit)

1. **Pool = 1 vs > 1 is already observable by shape.** The sheet shows a ladder in one case and the OPEN_POOL paragraph in the other; the Dex shows a normal card vs the aggregated card. So "candidate count is not leaked" holds for the *value*, but the binary *1 vs ≥2* is already visible. Pre-existing; I flag it because any new pool > 1 surface either keeps that visible distinction or must be shown in both states.
2. **The existing RESULT near-miss lines are already a pool-derived near/far authority.** `resultNearMiss.ts` → `classifyNearMiss()` compares the finished pizza to the *nearest* `DISCOVERABLE` candidate (`discoverableHintCandidates`), and emits 「材料をあと1つ足すと…」「かなり近づいてるよ」(ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / FAR). The Notebook stores and replays that exact line per attempt. This is **existing, already shipped, P2 authority**. It is the only place pool > 1 currently speaks about closeness. The new design must not add a second near/far channel or per-row distance on top of it, and must not be described as removing it.
3. **The candidate order puts No.26 first (verified).** Probe: `order = [brazilian-calabresa, pizza-portuguesa]`, `recipeKeyStep = [12, 12]`; the tie is broken by *distinct ingredient count asc* (5 < 6). Any "first in order" target would be the non-credit recipe. This matters for option C.
4. **The Hint 5.0 ladders of the two production candidates differ in shape (verified):**
   - `pizza-portuguesa`: SAUCE(tomato) · CHEESE(mozzarella) · KEY_TOPPING(ham) · STRUCTURE · SUB_CLASS egg · onion · black-olive (6 ingredients).
   - `brazilian-calabresa` (key-free, OD-D3-21): SAUCE(tomato) · STRUCTURE · SUB_CLASS oregano · onion · sausage · black-olive (5 ingredients) — **no CHEESE rung, no KEY_TOPPING rung**.
   So two candidates do not even offer the same rung list; a pool-wide ladder cannot be a simple per-recipe ladder.

---

## 3. Components that matter (current code)

| Item | Where | Note |
|---|---|---|
| `OPEN_POOL` derivation | `hintTarget.ts` `selectHintTarget`; view fallback in `discoveryHint.ts` `hintSheetView` | §1–2 |
| pool = 1 target | `selectHintTarget` `candidates.length === 1` | `source:"auto"` |
| Closing code for pool > 1 | `hintTarget.ts:104`; `isSessionTarget()` re-check on every purchase | D-1 |
| Purchased / sticky | `resolveHintSession()` `sessionSticky` (revealed, `fromDex`, `hasBoughtHints`) + "first purchased DISCOVERABLE in hint order" (HE-UI-4) | `hasBoughtHints` reads `discoveryHintPurchases` and `discoveryHintFacts` |
| `discoveryHintFacts` | `GameState` / save v2: `Record<recipeId, string[]>` keyed **by recipe id**; ids `ing:` `cls:` `h5:*` `meta:*` `attr:*` | Any pool-level fact has no home here (§8) |
| HintSheet | `HintSheet.tsx`: SELECTABLE / Hint 5.0 ladder / ladder-closed / TARGET / empty kinds | The OPEN_POOL view carries only the `notebook` prop and header entry |
| Notebook N1 | `TrialNotebookSheet` + `notebookView()`; header entry shown for **every** view kind, incl. OPEN_POOL | read-only; session-only; no link to Hint |
| Notebook content | `TrialEntryView = {number, retryCount, combination:{sauceBase, ingredientSet}, feedback:{kind,textJa}|null}` | The player's own tries + the shown P2 line |
| Notebook coverage | recorded only for ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH (`trialRecord.ts`) | **not** FAILED, **not** MATCHED discoveries, not ALREADY_DISCOVERED (§7) |
| Dex unknown aggregation | `DexOverlay.tsx` `aggregateUnknown` (D-2/D-3) | 2+ `DISCOVERABLE` → one card; slots render as plain unknown |
| Production pool = 2 | `discoveryHint.pool.production26.test.tsx` | pins D-1/D-2/D-3 and both discovery orders |

---

## 4. Constraints used to judge the options

From the task (all hold for every option): no candidate list / count / multiple choice / hidden identity / exact match count / distance / similarity % / 「あと1材料」 / 「この材料が正解」; no new near/far authority; no key-topping revival; no save-schema change; no recipe 27; existing 25 and No.26 key-free hints unchanged.

From the shipped Hint 5.0 design (`TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`) — these bind any new hint surface:
- **H5-INV-1** a sub-topping's name / glyph is never shown (classified, not named). Only SAUCE / CHEESE / KEY rungs name ingredients.
- **H5-INV-4** an undiscovered Technique is never revealed; "no sauce" **is** the Technique `no-sauce`, so no hint may say or imply the absence of sauce.
- **H5-INV-5 FREE LEAK** before a purchase the presentation depends only on what the player owns / bought and on constants — never on hidden recipe content.
- **H5-INV-6** only an answered request charges.

Owner's extra rule for this task: **no hidden recipe picked randomly (or by an unexplainable rule) just to have something to show**; the player must be able to say why a hint appeared and why it differs next time.

---

## 5. Options

### Option A — Pool-wide common features (the hint states what *all* candidates share)

Mechanism: compute facts true of every `DISCOVERABLE` candidate (intersection) and offer them as a hint, e.g. 「トマトソースを使うピザがありそう」.

**Production example (verified from the two ladders):** intersection = {sauce: tomato-sauce; classes: ≥1 meat, ≥2 vegetable}. The *discriminating* facts (CHEESE: mozzarella vs none; KEY: ham vs none; the egg / oregano) are exactly what the intersection drops.

- *Can the player plan the next try?* Weakly. At pool {P, C} the only nameable fact is the sauce, which the player already uses in nearly every try; the class facts are weak. The information that is dropped is the information a player needs.
- *Leak.* (1) Intersection size is non-increasing in pool size, so repeated looks across unlock events expose pool growth. (2) An empty or thin intersection is itself information ("the candidates are unlike each other"). (3) When candidates disagree on an axis (cheese yes / none) the rung cannot be answered; if its *availability* changes, that reveals a no-cheese candidate and breaks H5-INV-5, so a rung must be offered and priced identically and the answer decided only after the request (and an unanswerable request must not charge, H5-INV-6). (4) At pool = 1 it collapses to the full per-recipe ladder, so the same sheet changes character exactly when the pool changes. (5) Wording must not say 「全部に共通」 / 「どのピザも」, which states the count ≥ 2.
- *Candidate count inferable?* Indirectly, over time and by thinness (points 1–2).
- *Notebook fit.* None; independent of the player's tries.
- *Existing 25 / No.26.* Existing 25: untouched (never pool > 1). No.26 in the production pool: works only for the SAUCE axis; CHEESE and KEY axes are not common.
- *no-sauce / no-cheese.* If a candidate has no sauce the sauce axis has no intersection, and a rung that "answers nothing" for a no-sauce pool member reveals the Technique (violates H5-INV-4). The CHEESE axis hits the same wall (P4-CHEESE "none" is decided for a *single* target; for a pool it would reveal a no-cheese candidate).
- *172 scale.* Degrades: with many candidates the intersection is almost always empty, so the hint disappears when it is most needed.
- *Save schema.* A bought pool fact needs a key that is not a recipe id. `discoveryHintFacts` is `recipeId → ids`; a pool fact would need a new ledger key whose meaning changes as the pool changes (stale-fact problem). **Needs a schema change or must be session-only.**
- *Complexity.* High (new pure layer, pricing, stale handling, copy rules per axis).
- *Mobile UX.* Fine in layout; weak in value.

**Variant A′ — union instead of intersection** ("an ingredient that appears in some candidate"). Hides which candidate, never narrows to one, and does not thin out as the pool grows. But the union still states hidden-candidate content (e.g. a pesto sauce the player has not tried), the union of a lone candidate equals its ladder, set size reveals ≥ 2 candidates when ≥ 2 sauces appear, and an absence (no-cheese) cannot be expressed. Leak: medium and *content-bearing*. Same schema problem as A. Not recommended as a first slice.

### Option B — Notebook-grounded, recipe-independent "next experiment" prompts

Mechanism: the sheet shows prompts computed **only from the player's own state**: what they own and what their own Notebook shows they tried. The recipe set, the pool and the targets are not inputs.

Concrete first rule (**B1**): *「ノートにまだのっていない材料」* — the player's owned, usable ingredients that do not appear in any Notebook row's `ingredientSet`, grouped by category (ソース / チーズ / のせもの) in catalog order, with fixed copy. Rules for any B prompt:
- **Recipe-blind by construction.** Inputs: `ownedIngredientIds` / `inventory` stock and the Notebook only. The same inputs must give byte-identical output for any recipe population (a property test: swap `RECIPES`, same view). This is the property that makes "why did this appear / why is it different next time" fully explainable: *because of what you own and what your notes contain*.
- **No filtering by candidate.** It lists *all* owned-unlisted ingredients, including ones no candidate uses. Dropping the irrelevant ones would be an oracle by omission.
- **No order that depends on recipes** (catalog order, or purchase order if `ownedIngredientIds` preserves it — *to verify in the slice*).

Other B-compatible rules (later): variety coverage of the player's own tries ("ソースを変えた試作がまだない", "のせた数が3〜4個だけ"). These are statements about the player's tries, not the answer.

- *Can the player plan the next try?* Yes, in the discovery-loop sense:試作 → ノート → "what haven't I tried" → 再試作. It does not narrow the answer; it removes the dominant failure mode (never combining the newly bought material).
- *Answer given away?* No. B cannot, by construction, contain recipe information.
- *Candidate count?* No. It is independent of the pool. Showing it in **both** pool = 1 and pool > 1 also removes the "ladder vs paragraph" shape signal for the B part (Owner Decision OD-MC-2).
- *Notebook fit.* Best of all options: it *is* the Notebook's natural second use (the N1 result lists "hypothesis board" as the next step).
- *Existing 25 / No.26.* Identical for both; never touches the ladder, key, rungs, prices or facts.
- *no-sauce / no-cheese.* Never reveals them: it lists what the player owns. **Caveat (H5-INV-4):** a B rule such as 「ソースなしも試した？」 is forbidden while the `no-sauce` Technique is undiscovered, even though it would be recipe-independent. "チーズなし" is not a Technique, but it is a *structure hint*; treat as an Owner Decision (OD-MC-4). B1 avoids both.
- *172 scale.* Scales: cost depends on the player's inventory (≤ 62), not on recipe count. It needs grouping and a cap (it gets long as inventory grows).
- *Save schema.* **None.** Session-only, derived from existing state. (The Notebook stays session-only; see the limitation below.)
- *Complexity.* Low to medium: one pure selector + a sheet section + fixed copy. The pure selector should read the Notebook's *identity index* (up to 2,000 fingerprints, each parseable to a combination) rather than the 50-row display, otherwise the 51st attempt makes older ingredients look "untried". That selector is new pure logic, not a schema change.
- *Mobile UX.* Good: chips already exist in the Notebook sheet (390×844 / 360×800 verified for N1). Needs a capped, grouped list.

**Known limitations of B (must be in the copy and the Owner's expectations):**
1. **The Notebook is an incomplete record of the player's tries.** It stores ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH only (`trialRecord.ts`). A FAILED pizza, a MATCHED discovery or an ALREADY_DISCOVERED result is not in it. So the correct claim is 「ノートにはまだのっていない」, **never** 「まだ使っていない / まだ試していない」.
2. **Session-only.** After a reload the Notebook is empty, so every owned ingredient looks "not in the notes". The footer 「この記録は、ゲームを読み込みなおすと消えるよ」 already tells the player, but B must not read as an authoritative "you never used X".
3. **It gives no answer information.** If the Owner wants the pool > 1 player to learn something *about the pizza*, B alone does not (see S2 / OD-MC-1).

### Option C — Use the existing per-recipe ladder, with an internal target chosen by a safe rule

Mechanism: keep the ladder UI but choose a target without showing its identity.

Every rule that can pick one of ≥ 2 candidates falls into one of these, and each fails the Owner's explainability test or an anti-oracle rule:

| Rule | Problem |
|---|---|
| C1 deterministic candidate order (key step → ingredient count → declaration index) | Arbitrary by definition (this is exactly what D-1 rejected). On production it selects **No.26** (verified order `[calabresa, portuguesa]`): a non-credit, non-Lunch-Rush recipe, so the hint steers the player away from the W1 ladder's recipe. The player cannot explain why that recipe. |
| C2 sticky-on-first-purchase | The pick becomes permanent (`hasBoughtHints` makes it the HE-UI-4 sticky target and it survives the pool). "Why this one" is still unexplained, now irrevocably. |
| C3 pick the candidate nearest the player's last Notebook try | This is a new near/far authority (forbidden), and an oracle: the hint chases the player's guess. |
| C4 random / hash of session | Explicitly excluded by the Owner. Also non-reproducible across reloads. |
| C5 player picks | The player cannot name a candidate without a candidate list, count or numbered slots (the Dex was aggregated precisely so they cannot). |

Further problems with C regardless of rule: (a) **Steering.** A hidden internal target means the ladder only ever talks about one of the candidates; a player who follows it finds that recipe first and sees the other recipe's hint only afterwards, so the hint changes *which* recipe is found, not just how fast. (b) **Fairness.** Two players with the same state get different recipes only if the rule is non-deterministic, or the same recipe forever if it is deterministic. (c) **Candidate leak by the ladder shape.** The first rung list differs per target (§2.4), so the shape of the ladder discloses whether the internal target is a key-free recipe. (d) *Schema:* the purchase is recorded on the target's `recipeId`, so no schema change; but that same recording is what makes (a)/C2 permanent.

- *Existing 25 / No.26:* fine (no change); No.26 is the one chosen first by C1.
- *no-sauce / no-cheese:* inherits the single-target answers (P4-CHEESE "none"); safe only if the target is. A no-sauce target hits `RESERVED_EMPTY_RUNG` (H5-INV-4).
- *172:* worst scaling: with many candidates a single hidden target is a smaller and smaller fraction of what the player is actually searching.
- *Complexity:* lowest (reuses everything). *Mobile UX:* identical to today's ladder.
- **Not recommended.** It is the "pick something so there is something to show" approach the Owner ruled out; it only looks neutral because its choice is invisible.

### Option D — Other approaches

- **D1 — Pool-blind union/intersection ladder.** Covered as A and A′.
- **D2 — Hypothesis anchoring (player attaches a Notebook row and asks about it).** Any answer that depends on that combination and the pool is a similarity oracle (the forbidden near/far authority). Rejected.
- **D3 — Avoid pool > 1 in content.** Do not ship windows where two recipes become discoverable at the same step. Works for the 25-ladder; impossible at 172 (see §9); the production No.26 is itself such a window. Not a hint design; it only postpones the problem.
- **D4 — Notebook-grounded experiment prompts** is Option B.
- **D5 (recommended as a *later* extension, not in the first slice) — "Question the player chooses, answered about the whole set, not a recipe."** After B, a paid rung asks a coarse yes/no *about the player's own current try* that is recipe-neutral, e.g. whether *this exact combination's sauce is used by any undiscovered pizza*. That is a pool oracle (a yes/no per attempt) and leaks per use; it is listed so the Owner can reject it explicitly. Not recommended without a fresh leak analysis.

Net: for the "natural Discovery game" criterion, **B** is the one method where the game never claims anything about the hidden recipe, so it cannot be an oracle, and the player can always explain why it appeared.

---

## 6. Comparison (no scores / no ranking, per the brief)

| Axis | A (intersection) | A′ (union) | B (Notebook / recipe-blind) | C (hidden internal target) |
|---|---|---|---|---|
| Player can plan the next try | Weak; drops the discriminating facts | Some, but names hidden-candidate content | Yes (what is not in my notes) | Yes, but about an arbitrary recipe |
| Gives the answer away | Low value, rising leak with pool shape | Medium | No | Per-target ladder (as today), but about one chosen recipe |
| Count inferable | Over time / by thinness | By set size | No | By ladder shape (key-free vs normal) |
| Notebook fit | None | None | Native | None |
| Existing 25 + No.26 | 25 untouched; No.26 only on SAUCE axis | same | identical for both | works; No.26 is chosen first by C1 |
| no-sauce / no-cheese | Breaks H5-INV-4 / reveals a no-cheese candidate | partially | Safe for B1; "no sauce" prompts forbidden (INV-4) | inherits single-target answers |
| 172 scale | Intersection mostly empty | grows large | scales with inventory only | worst (one target in a huge pool) |
| Save schema change | Yes (pool-level facts) or session-only | Yes or session-only | **None** | None (but sticky is permanent) |
| Complexity | High | High | Low–medium | Lowest |
| Mobile UX | Fine | Fine | Good (existing chips; cap + group) | Existing ladder |

---

## 7. Information-leak summary (per method)

| Method | What it can leak | Mitigation / residual risk |
|---|---|---|
| A | pool growth over time; heterogeneity (thin / empty intersection); a no-cheese or no-sauce candidate via rung availability; count ≥ 2 via wording | Constant pre-purchase view + answer-after-request + non-charging when unanswerable. Residual leak is structural to intersection. |
| A′ | hidden-candidate ingredient names; ≥ 2 sauces ⇒ ≥ 2 candidates; union growth on unlock | Class-level only; still content-bearing. |
| B | **nothing about recipes** (inputs are player state). Residual: *wrongly implying the player never used something* (Notebook coverage / session-only) | Copy says "ノートにのっていない". Selector reads the identity index. Recipe-blind property test. |
| C | the chosen recipe's whole ladder; recipe preference; shape of ladder reveals key-free vs normal | None without an explainable rule (there is none). |
| Pre-existing (unchanged by B) | 1-vs-≥2 shape signal; the shipped near-miss lines per attempt | Not made worse. OD-MC-2 decides whether B is shown in both states. |

---

## 8. no-sauce / no-cheese, key-free, 172 recipes

- **Key-free (No.26):** B never mentions a key topping; no key-topping revival. A/C would need per-axis rules because the production candidates already have different rung lists (§2.4).
- **no-cheese recipes** (e.g. No.26): the single-target ladder answers "none" for the CHEESE rung (OD-H5-P4-CHEESE). A pool-level CHEESE statement would reveal whether some candidate has no cheese. B avoids it.
- **no-sauce recipes:** `no-sauce` is a Technique (H5-INV-4); any hint, including a B rule, must not say or imply it while undiscovered. B1 only lists owned ingredients, so it is safe. A B rule about trying "no sauce" is **not** allowed unless the Owner decides the Technique may be revealed (OD-MC-4).
- **172 recipes** (indicative; from `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`, canonical ingredient ids joined to `data/recipes/ingredient_master_catalog.json`, not a gameplay authority and not re-audited): 172 rows, 165 distinct ingredient sets (**7 groups / 14 recipes share an identical ingredient set**, so they are indistinguishable by composition); ingredient count per recipe: 1:4, 2:12, 3:49, 4:65, 5:31, 6:8, 7:3; about **120/172 have no catalog sauce** and about **50/172 no cheese** (counts depend on how the catalog tags sauces; treat as ±). Consequences: pool > 1 will be the normal case, not one window; an intersection (A) will mostly be empty; an arbitrary single target (C) is a vanishing fraction of the pool; the sauce-less majority makes the H5-INV-4 restriction load-bearing for any "structure" prompt. B scales with the player's inventory only.

---

## 9. Save schema

| Option | Save schema change? |
|---|---|
| B (first slice) | **No.** Session-only; reads `ownedIngredientIds` / `inventory` and the in-memory Notebook. Save stays v2. |
| A / A′ | Yes for persisted pool-level facts (no recipe-id key fits); otherwise session-only. |
| C | No (recorded under the target's recipe id), but the record freezes the arbitrary choice. |
| Notebook persistence (N3) | Out of scope; it would improve B's accuracy but is an Owner roadmap decision (OD-MC-5). |

---

## 10. Recommended minimum implementation slice

**Slice MC-1: "Notebook-grounded experiment prompt" in the Hint sheet (pool-independent, free, session-only).**

1. New pure selector (e.g. `src/logic/discovery/untriedMaterials.ts`): inputs `ownedIngredientIds`, inventory stock, and the Trial Notebook identity index parsed to combinations. Output: owned usable ingredients **not** in any recorded `ingredientSet`, grouped by category in catalog order. No recipe, pool, target, Hint fact or Pitz is an input.
2. HintSheet: a fixed section in the OPEN_POOL view (and, if OD-MC-2 = yes, in every view kind): title along the lines of 「ノートにまだのっていない材料」, a short fixed explainer (「ノートにあるのは、作ったピザの記録だけだよ」), capped and grouped chips (reuse the Notebook chips), and the existing 📓 entry. OPEN_POOL copy points to it instead of only 「試してみよう」.
3. Gates (tests): recipe-blind property (swap `RECIPES`, view unchanged); no recipe / candidate / count / distance text; section output identical for pool = 1, 2, 3 given the same inventory + Notebook; no hint fact or Pitz change; no persistence; existing 25 and No.26 ladders byte-unchanged; 390×844 + 360×800 layout; the usual Human Verification video + before/after screenshots (CLAUDE.md applies at implementation time, not to this audit).

Explicitly **not** in MC-1: any paid pool-level rung (A / A′), any target selection (C), any "no sauce / no cheese" nudge, any recipe-derived ordering or filtering.

**Later, only if the Owner wants answer-bearing information at pool > 1 (MC-2, needs its own audit):** a paid, recipe-neutral rung over the whole undiscovered set (D5 / A′ shape) with a fresh leak analysis and its own schema decision. I do not recommend building it before MC-1 is played.

---

## 11. Owner Decisions needed

| ID | Question | My recommendation |
|---|---|---|
| OD-MC-1 | Is a free, answer-free experiment prompt (B) the right pool > 1 answer for now, or must pool > 1 also give *answer-bearing* hints? | B first; defer answer-bearing hints (MC-2) until MC-1 is played. |
| OD-MC-2 | Show the B section in **every** hint-sheet state (pool 0 / 1 / > 1) to avoid a "ladder vs paragraph" shape difference for that section, or only in OPEN_POOL? | Every state that has a sheet; it removes the section's own 1-vs-many tell. The pre-existing ladder-vs-paragraph tell remains either way. |
| OD-MC-3 | What counts as "owned usable"? Include unlimited starters (tomato sauce, mozzarella…) and out-of-stock finite items? | Include starters; exclude out-of-stock (they cannot be used now). |
| OD-MC-4 | May B (or any later hint) ever prompt structure variety such as 「チーズなし」 or, if the `no-sauce` Technique is discovered, 「ソースなし」? | Not in MC-1. H5-INV-4 forbids the no-sauce case until discovered; treat cheese as a separate decision. |
| OD-MC-5 | Accept B's accuracy limits (Notebook records only ORIGINAL / AMBIGUOUS / INCOMPLETE and is session-only), or first expand recording / persist (N3)? | Accept; the copy is worded 「ノートにのっていない」. |
| OD-MC-6 | The existing RESULT near-miss line (nearest-candidate "あと1つ" / "かなり近づいてるよ") is shipped pool-derived near/far authority. Keep, narrow, or leave to a separate audit? | Out of this task's scope; keep, but do not extend. Flagging so it is a conscious choice. |
| OD-MC-7 | Accept the pre-existing 1-vs-≥2 shape signal (ladder vs paragraph; Dex aggregated vs normal card) as intended? | Yes (it is how D-1/D-2 shipped); decide explicitly. |

---

## 12. What this audit did not do

- No code, test, CSS, e2e, save or asset changed; no PR, no merge.
- The 172-recipe figures in §8 are derived from the design matrix and catalog JSON by a throw-away script, not from the game's runtime data, and are indicative only.
- The B selector's behaviour with `ownedIngredientIds` ordering, the exact copy and chip-cap size are slice-level details to settle during MC-1.
- No Preview / Human Verification video: nothing UI changed (CLAUDE.md's policy applies when MC-1 is implemented).
