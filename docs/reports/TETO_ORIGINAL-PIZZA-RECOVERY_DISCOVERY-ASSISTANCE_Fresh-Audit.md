# Original Pizza Recovery / Discovery Assistance — Fresh Audit (design only)

- **Audited `origin/main` SHA:** `21dc0a670e586f478661a6cf54671313b2a7cb5b` (`Merge pull request #308 … lc-r5-a-pantry-ux`, fresh `git fetch origin main` at session start; branch HEAD == origin/main at audit time)
- **Branch:** `claude/pizza-recovery-discovery-audit-mvq4dn`
- **Scope:** Fresh Audit / design only. **No `src/`, CSS, UI, save schema, gameplay, Hint 5.0, matcher, Cooking Steps, LC-R5b or PR #309 change.** This report + one tooling script + one JSON only.
- **Companion files**
  - `tools/original_pizza_recovery_hint5_ceiling.py` (tooling-only, read-only simulation)
  - `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_DISCOVERY-ASSISTANCE_Analysis.json` (its output)
- **Verification Policy (`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`):** not triggered — this task changes no UI/UX/gameplay, so there is no video / screenshot deliverable. Every future implementation phase below that touches RESULT / Builder / HintSheet **will** trigger it.
- **Final verdict:** **B. OWNER DECISION REQUIRED** (§15).

---

## 0. Executive summary

1. **Half of "Phase 1: Original Result Feedback" already ships.** Discovery Hint 2.0 (Issue #229, PR #231) added a near-miss line on the Free Cooking RESULT: `ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE` and a `FAR_KEY_UNUSED` nudge (`src/logic/discovery/nearMiss.ts`, `src/state/resultNearMiss.ts`). What is missing is not "a feedback engine" but (a) a "far" answer (d ≥ 3 says nothing today), (b) guards that keep the existing lines honest at 172 scale (exact-identity collisions, sauce-less recipes), and (c) any memory of the attempt.
2. **An ORIGINAL attempt leaves no trace.** The composition lives only in `GameState.pizza` / `lastDiscovery` until the next round resets it. Nothing is saved. Finite stock **is** consumed by an ORIGINAL attempt (`consumePizzaInventory`), so a repeated combination costs real materials.
3. **A fingerprint that equals the matcher is easy and safe.** The matcher's identity is exactly `sauceBase` + `ingredientSet` + 11 dimensions that are constants today. Order, duplicates, quantity, placement, timing and Cooking Steps are **not** identity. A fingerprint built from `RuntimeSignature` cannot diverge from the matcher.
4. **Hint 5.0 is not failing at the recipe level; it is failing at the ingredient level and at the authority level.** After every rung, the simulation shows candidate *recipes* stay small (production 25: 24/24 authored-key rows are unique). But the *ingredient answer space* (sub-topping combinations consistent with the disclosed families) has median 3–8, p90 12–32, max 112 **using only today's 1–8-sized family pools**, and it grows combinatorially with pool size (pool 20, k = 3 → 1 140). Worse, **18/58 (31 %) of the 172-authority rows that are even expressible in the 62 catalog, and 22/51 (43 %) of the master-catalog recipes, are not Hint 5.0 targets** because a topping has no family row (fail-closed by design, H5-INV-7).
5. **The 172 authority cannot be measured end-to-end today.** 52/172 rows have no resolved identity set, and 62/172 use 77 distinct ingredient ids outside the 62 catalog. Only 58 rows are evaluable. → the "62 / 172" scaling claim is **partially blocked by authority** (§8).
6. **"Always reach the recipe" has two hard blockers outside this lane:** exact identity-set collisions (5 groups / 10 recipes in the 172 authority; matcher → `AMBIGUOUS` → shown as ORIGINAL forever) and the Completion Gate (a fully revealed recipe still has to be *cooked* well enough). No rescue level can fix either.
7. **Privacy is preservable** if every rescue level is stored as an explicit disclosed fact in the existing `discoveryHintFacts` ledger (kinds unknown to a build are already kept, never dropped) and the Trial Notebook stores only the player's own compositions. The one real design conflict is **free component feedback duplicating paid Hint 5.0 rungs** (SAUCE 10 / CHEESE 10 Pitz) — an Owner Decision.

---

## 1. Duplicate Gate

Fresh state read via GitHub at audit time (34 open Issues, 24 open PRs).

| Topic | Query result | Verdict |
|---|---|---|
| Same purpose (original pizza recovery / trial notebook / attempt fingerprint / rescue hint / proximity feedback) — Issues | 0 matches | **No duplicate Issue** |
| Same purpose — PRs | only **closed** PRs: #231 (Discovery Hint 2.0: progressive hints, near-miss guidance, Dex integration — **the shipped predecessor of Phase 1**), #197 (Free Cooking / owned ingredient selection), #193 (runtime signature → discovery), #199 (0-recipe onboarding) | **No open duplicate**; #231 is prior art, read in §4 |
| Hint 5.0 | Issue #292 (Sub-topping Classification Ladder, shipped and ON in production), PR #293 (taxonomy coverage audit, open, docs) | Independent; this audit reads it as authority |
| Discovery 2.0 / Hint 3.0 / 4.0 | Issues #238, #253; PR #255 (172 recipe ingredient taxonomy, open) | Read-only reference |
| FREE Cooking / RESULT / Original Pizza | shipped code (P3-2, RESULT 2.0, DM-3R); no open Issue | — |
| recipe matcher | shipped (P3-1); no open Issue | — |
| persistence / save | Issues #282 (multi-tab last-writer-wins, open), #279 (Dinner broken-record recovery), #129 (Player Profile) | Constraints noted in §2.4 / §6 |
| economy / stars | Issues #38 (Economy), #216 (Progression 2.0 paid unlock) | Constraints noted in §9 |
| Cooking Steps | Issue #294, PR #295 (CS-1a, open) | Future-dimension interaction, §2.1 / §3 |
| Large Catalog | R5-a merged as #308; **LC-R5b: no open Issue/PR found on main**; PR #307 (LC-R4 docs), #272 (LC-1) | Independent lane; UI overlap only for the Builder phase (§10.3) |
| Taxonomy / HCG | **PR #309** (62 Ingredient Taxonomy / HCG + Owner authority OD-T1..T8, open), PR #296 (172 Recipe Taxonomy) | Independent lane. **Not read as production authority** (§8) |

Conclusion: **no same-purpose Issue or PR exists; proceeding is not a duplicate.** This audit did not create an Issue (out of scope; the Owner can promote the recommended slice, §10.3).

`docs/PROJECT_HANDOFF.md` was not edited (scope guard: docs/reports, docs/reports/data, tooling only). There is no execution Issue for this lane yet.

---

## 2. Current behaviour audit

### 2.1 When does a pizza become "Original Pizza"? (Code A)

Pipeline (`gameReducer.ts` `CONFIRM_BAKE` → `REGISTER_TO_DEX`, `src/logic/discovery/freeCook.ts`):

1. **Recipe-free completion** (`evaluateFreeCookCompletion`): dough + at least one item (sauce or piece) + generic bake window. Fail → **FAILED** (raw / burnt / empty) — *never* "original". So a bake mistake is not an ORIGINAL attempt.
2. **Signature match** (`signatureOfPizza` → `evaluateDiscovery` against `RECIPE_DISCOVERY_CATALOG`, 25 recipe-backed targets today):
   - `NO_MATCH` → **ORIGINAL**
   - `AMBIGUOUS` (≥ 2 targets share the exact signature, or a blocked one shares it with an eligible one) → shown as **ORIGINAL**
   - `NEW_DISCOVERY` / `ALREADY_DISCOVERED` → then step 3
3. **Matched recipe's own Completion Gate** (`"recipe"` policy = ≥ 1 piece of each required ingredient + sauce amount + bake window). Fail → **`INCOMPLETE_MATCH`**, also shown as an original-pizza card with a different lead line.

Matcher contract (`matcher.ts`, `signature.ts`):

| Question | Answer (from code) |
|---|---|
| sauce / cheese / toppings comparison | one sorted, de-duplicated **`ingredientSet`** (sauces + pieces) **and** an explicit sorted **`sauceBase`** must both equal the target's. Roles are enforced (tomato sauce as a piece ≠ base). |
| Ingredient order | **No effect** (sorted). |
| Duplicate ingredient | **Collapsed** (presence-only). Piece count is *not identity*; "how many" is the Completion Gate `minCount` / Scoring 2.0 quantity factor. |
| Placement / positions / zones | **Not identity.** `zones` is `UNAVAILABLE` (assumed default). A target needing non-default zones can never match. |
| Timing, bake value, CUT lines, dough radii, sauce amounts | **Not identity** (explicitly listed as quality inputs in `signature.ts`). |
| Cooking Steps / `late` / `prep` / `enclosure` / `cook` / `laminate` / `spreadLayers` | `FIXED_BY_FLOW` constants today (no gameplay). `RUNTIME_SUPPORTED_CAPABILITIES = []`: a target requiring any capability is unmatchable. |
| Multiple sauces | Not possible: `sauceIds: [action.ingredientId]` — a new sauce **replaces** the old one. |
| Techniques (`no-sauce`, …) | **Not part of the signature.** They are a separate ledger (`discoveredTechniqueIds`) and only ever revealed from an ORIGINAL with outcome kind exactly `ORIGINAL` (not AMBIGUOUS / INCOMPLETE). |
| Free Cooking only? | ORIGINAL is produced only by a **free-cook round** (`state.freeCook`). A guided (recipe-select) round is scored as its selected recipe. **Dinner Mission** rounds never register (OD-DM-11) and use their own detection (`dinnerResultDetection.ts`). Lunch Rush unaffected. |
| Side effects of an ORIGINAL | `score = null`, no Dex write, no Pitz, **`inventory` consumed**, `preDiscoveryFreeCookAttempts += 1` only while the Dex is completely empty (session counter). |

### 2.2 What RESULT shows today for ORIGINAL (Code B)

`ResultPanel.tsx` original card:

| Element | Present? |
|---|---|
| "🎨 オリジナルピザ完成！" + lead line ("図鑑にはない、あなただけのピザ！"; for INCOMPLETE_MATCH: "図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。") | yes |
| Used ingredients (glyph + name, sauce first, **distinct only — no counts**) | yes |
| Bake badge | yes |
| Near-miss line (`ResultNearMissLine`, aria-live) | yes, when applicable (§4) |
| 「💡 ヒントを見る」 CTA (`onRetryWithHint`) | yes (free-cook) |
| Score / stars / Pitz / Dex registration | **none** |
| Retry CTAs | 「もう一度じゆうに作る」, 「レシピを選んで作る」; HOME via the app header button |
| Notion of "you tried this before" | **none** |
| Recipe name / hidden info | none (near-miss never names a recipe or ingredient) |

Relationship to Discovery: RESULT + DISCOVERED are one merged screen (RESULT 2.0 Slice 1); an ORIGINAL moves `RESULT → DISCOVERED` with `lastDiscovery = resolution.outcome` and **nothing else is kept**.

Known copy/logic gaps found (all *existing* behaviour; recorded, not fixed):

- **G-1 AMBIGUOUS is presented as "あなただけのピザ！"** although the composition *is* a recipe identity (and the near-miss returns `null` at d = 0, so there is no line at all). Harmless today (production collisions = 0, §8.4) but a lie at 172 scale.
- **G-2 `SAUCE_ONLY` copy "ソースを変える"** is wrong for a pizza with no sauce whose nearest target has a sauce (and for a future no-sauce recipe). Sauce-less is currently reserved (`RESERVED_EMPTY_RUNG`, TQ-1D).
- **G-3 The "あと1つ足す" promise is matcher-true, gate-conditional:** it can still end as `INCOMPLETE_MATCH` or (with a collision) `AMBIGUOUS`.

### 2.3 Hint 5.0 ceiling (Code C)

Hint 5.0 is **ON in production** (`HINT5_LADDER_PRODUCTION_DEFAULT = true`, OD-H5-M2 = all 25 recipes). Strictly linear ladder (`hint5Ladder.ts`):

| Rung | Prices (Pitz) | What the player knows after buying it | Class |
|---|---|---|---|
| 1 SAUCE | 10 | **Every sauce name** of the recipe | **Answer disclosed** |
| 2 CHEESE | 10 | **Every cheese name** (or「なし」, paid, round 6) | **Answer disclosed** |
| 3 KEY_TOPPING | 10 | **The key topping's name** (or「なし」) | **Answer disclosed** |
| 4 STRUCTURE | 5 | **Distinct ingredient total** (sauce + cheese + toppings) | Count only |
| 5.. SUB_CLASS ①..ⓝ | 5 each | **One family per sub-topping** (7 families: 肉・魚介・野菜きのこ・果物・ハーブ・スパイス・その他), **never the name** | **Classification only** |

Full-open knowledge = all sauces, all cheeses, the key topping (by name), the total, and the **family multiset** of the remaining toppings. Ladder cost per recipe: 25–50 Pitz (24 non-onboarding recipes sum 910, mean 37.9; +10 for the six 「なし」 targets). There is **no k ≥ 2 rule** in Hint 5.0 (OD-H5-P1/P2): the family may narrow to one candidate.

What the ceiling leaves unknown: **exactly which ingredient fills each sub-topping slot within its family.** That is the only remaining search.

### 2.4 Persistence (Code D)

`PersistentSaveV2` (schemaVersion 2, additive ledgers without version bumps):

| Persisted | Field |
|---|---|
| Discovered recipes / BEST / times made | `dex[]` (`recipeId, discovered, bestScore, bestStars, timesMade`) |
| Hint usage | `discoveryHintPurchases` (legacy Economy 1.0 levels), `discoveryHintFacts` (`ing:`, `cls:`, `h5:*`, `attr:*`, `meta:*`; unknown kinds kept) |
| Stars | derived from `dex[].bestStars` (`totalStars`); no stored total |
| Inventory / economy | `pitzBalance`, `ownedIngredientIds`, `inventory`, `starterGrantClaimedRecipeIds`, `unlockedForShopIngredientIds` |
| Other | `missionBest`, `discoveredTechniqueIds`, `dinnerMissionRecords` |
| **Attempt / history / composition of an ORIGINAL** | **Not saved. Not even in session beyond the current round.** |

Session-only precedents already accepted: `preDiscoveryFreeCookAttempts`, Hint 2.0 free reveals, sticky hint target. Forward-compat: `writeSave` keeps well-formed unknown ledger entries; `KNOWN_SAVE_KEYS` + unknown-key merge (Save I0). Full Game Reset (`resetSave`) clears everything.

**Answer already readable in the save (by design):** `cls:<ingredientId>` and `ing:<id>` live in `discoveryHintFacts[recipeId]` — but only after the player bought that rung. Nothing about an unbought recipe is in the save.

---

## 3. Candidate: Attempt Fingerprint — feasibility

**Feasible; recommended shape (not a decision):**

```
fingerprint v1 = "fp1|" + join(signature.sauceBase.value, ",") + "|" + join(signature.ingredientSet.value, ",")
```

computed **only from `RuntimeSignature`** (`signatureOfPizza`), so it inherits the matcher's normalisation and can never drift from it. It should be a pure function in `src/logic/discovery/` next to `signature.ts` (future phase).

| Question | Finding | Consistent with matcher? |
|---|---|---|
| Ignore topping order? | Yes — the matcher sorts; order is not identity | ✅ |
| Duplicates | Collapse (presence-only). Quantity must **not** enter the fingerprint | ✅ — but see the note below |
| No sauce | `sauceBase = []` → own fingerprint; distinct from any sauce | ✅ |
| No cheese | cheese is just an ingredient id; absence = smaller set | ✅ |
| Multi-spread | impossible today (a sauce replaces the previous one) | ✅ |
| Late-add / prep / enclosure / cook / laminate / spreadLayers | constants today (`FIXED_BY_FLOW`) | ✅ today; ⚠ future |
| Placement / timing / Cooking Steps | not identity | ✅ |
| Future Techniques | not in the signature today; separate ledger | ⚠ future |

**Design rules that avoid a matcher-mismatch:**
1. Derive from `RuntimeSignature`, never from raw `PizzaState`.
2. **Version-tag** it and include only **non-default OBSERVED dimensions** as a sparse suffix. Today the suffix is empty, so `fp1` ≡ the future `fp2` for default dimensions and old notebook entries stay valid when `late`/`prep`/… become identity (Cooking Steps CS-1, PR #295).
3. Quantity difference between two attempts with the same fingerprint is real (it decides `INCOMPLETE_MATCH`); a "tried before" message must say **"same ingredient combination"**, never "same result" and never "won't work".
4. A fingerprint's outcome is deterministic only for a given (catalog, Dex) — a later build or a later discovery may make an old ORIGINAL fingerprint discoverable. Duplicate detection must therefore **inform, never block**.

Precondition already met: production has **0 exact identity collisions** (§8.4), so the fingerprint → outcome map is single-valued today.

---

## 4. Candidate: Original Result Feedback — feasibility

Everything derivable from the matcher's axes is *reliably* derivable, because `nearMiss.ts` already computes `d = |missing non-sauce| + |extra non-sauce| + (sauceBase differs ? 1 : 0)` on exactly the two OBSERVED axes the matcher compares.

| Feedback | Reliably derivable? | Notes / risks |
|---|---|---|
| Distance class 遠い / 近い / かなり近い / あと少し | **Yes** (d ≥ 3 / d = 2 / d = 1). Today: d = 1 → ADD/REMOVE/SAUCE lines, d = 2 → CLOSE, d ≥ 3 → silent (except `FAR_KEY_UNUSED`) | A "遠い" line is a pure addition; it says "no discoverable recipe within 2" which is a (weak) negative fact |
| "材料が足りない可能性 / 余分な材料" | Yes at d = 1 (already shipped). At d = 2 the direction can be mixed (1 add + 1 remove) | Shown only when **all nearest candidates agree** (see below) |
| "sauceは合っていそう / cheeseは合っていそう" | Derivable **relative to the nearest target(s)** | ⚠ Only true when the nearest candidates agree on that component. With ties at equal d, the current tie-break (hint order) could flip the statement → must add an **agreement guard** (same idea as the k ≥ 2 guard). ⚠ **Economy conflict**: it hands out, for free, what SAUCE / CHEESE rungs sell for 10 Pitz |
| "topping数を見直そう" | Derivable for **distinct kinds** (the identity axis) | ⚠ Must never mean *piece count* — piece count is the Completion Gate, not identity. (Same lesson as H-U4 INCOMPLETE_MATCH copy) |

**Misleading-feedback hazards found (must be closed before extending the feedback):**
- **F-1 Collisions.** If the nearest target is one of an exact-collision group, "add one" leads to `AMBIGUOUS` = ORIGINAL again. Feedback candidates must exclude colliding/blocked targets (or the collision must be resolved by dimension authority first).
- **F-2 Sauce-less copy** (G-2).
- **F-3 Discoverable-only scope is correct and must be kept.** `discoverableHintCandidates` limits candidates to recipes whose materials are owned and in stock, so "add one" never points at an unavailable material. (Verified in `hintTarget.ts`.)

**Does choosing the "nearest recipe" internally break Discovery privacy?** Not by itself: the internal choice is deterministic (`compareHintCandidates`: key step → distinct count → declaration index) and the output is only a class. The residual risk is **oracle probing**: each attempt reveals "a discoverable recipe exists at distance d in direction X". Cost of a probe is a full cook + consumed stock, which is the intended friction. Extending the output with component statements *raises the information per probe* and must be weighed against the paid rungs (OD-ORP-2).

Recipe name is never in `NearMissKind`/`ResultNearMissLine` (verified). Hidden ordering: the tie-break order is not observable except through ties, which the agreement guard would neutralise.

---

## 5. Candidate: Progressive Rescue Hints — feasibility

Ladder as proposed by the request, mapped to what exists:

| Level | Proposal | Feasibility today | Authority / blocker |
|---|---|---|---|
| L0 | Existing Hint 5.0 | Exists | — |
| L1 | Finer feature / sub-family | **Blocked by authority.** Needs a taxonomy layer below the 7 families. Main has none; PR #309 holds an Owner-confirmed *pending-runtime* taxonomy that is **not production authority** | **C-blocked** for this level. (Design alternative that needs no taxonomy: an **exclusion** hint — "X is *not* in this recipe" — from the same family pool. Proposed here only as an option, not requested) |
| L2 | Letter hint (「マ」で始まる) | Technically trivial. **Sizing (measured):** in the classified pool every topping has a first kana unique within its family (19/19). **Family (already known at L0) + initial kana therefore names the ingredient in 100 % of classified cases** — L2 is *effectively* L3 for sub-toppings | Needs an **Owner-approved exception** to H5-INV-1 (ingredient name/id never shown) if the subject is the *ingredient*, or to H5-INV-3 (recipe name never shown) if the subject is the *recipe* name. Kana normalisation (small kana, 濁点, long vowel, non-katakana names) needs a rule |
| L3 | Reveal 1 ingredient | **Reuse the existing fact ledger:** `discoveryHintFacts[recipeId]` already understands `ing:<id>`; `hint5Ownership` treats a known name as `ALREADY_KNOWN` and the name stays displayed as the "legacy exception". A new marker kind (e.g. `resc:<n>`) would be kept by the forward-compat merge and ignored by older builds — **no schema bump** (precedent: `discoveryHintFacts`, `discoveredTechniqueIds`, `dinnerMissionRecords`) | Next subject = next unrevealed sub-topping in the authored `hintSubToppingOrder` |
| L4 | Reveal further ingredients | Same mechanism, repeated → all sub-toppings named ⇒ with L0's sauce/cheese/key the **recipe's full ingredient set is known** | Guarantee is *ingredient-level*. It does **not** guarantee discovery: exact collisions (→ `AMBIGUOUS`) and the Completion Gate / bake skill still apply |

"必ず recipe に到達可能" therefore holds **conditionally**: (i) target is collision-free, (ii) all required materials are owned and in stock (already guaranteed by the DISCOVERABLE-only target rule), (iii) the player can still cook it (Gate is skill-dependent, unchanged).

Progression-stall rule from the request ("進行不能になる設計は禁止") is satisfiable: every rescue level only *adds* known facts; none removes an ability, and Pitz/discovery rewards keep the existing 20-Pitz quality floor (`PITZ_QUALITY_FLOOR`). The dangerous lever is a **star cap** (see §9).

Existing precedent for an attempt-gated free escalation: `preDiscoveryFreeCookAttempts` (Phase 3-3) — session-only, only while the Dex is empty, capped at hint index 4. It is the closest template for an "unlock after N ORIGINAL attempts" trigger and proves session-only escalation is already accepted.

---

## 6. Candidate: Trial Notebook — feasibility

Feasible as a *log of the player's own compositions*. Nothing about hidden recipes needs to be stored.

Recordable fields and risk:

| Field | Store? | Why |
|---|---|---|
| fingerprint (v-tagged) | yes | the dedup key; contains only the player's own ingredient ids |
| used ingredients | derivable from the fingerprint | no separate storage needed |
| order / timestamp | optional sequence number | wall-clock time is not needed; a monotonic counter suffices |
| outcome kind (`ORIGINAL` / `INCOMPLETE_MATCH` / AMBIGUOUS-as-ORIGINAL) | yes, **as shown** | INCOMPLETE is already disclosed by the RESULT copy today ("図鑑のピザまであと少し") |
| proximity class | **as shown at that time**, not recomputed | recomputing at view time turns the notebook into a free oracle for old compositions after new materials/discoveries; storing "as shown" keeps it a faithful log |
| FAILED bake attempts | **exclude** | a raw/burnt bake says nothing about the composition |
| rescue level used | optional per-recipe counter (already the `discoveryHintFacts` marker) | no need to copy into the notebook |

Storage options:

| Option | Pros | Cons |
|---|---|---|
| **A. Session-only** | zero save risk, precedent exists, no reset/cross-tab issue | loop breaks across sessions; a returning player repeats combos (and burns stock) |
| **B. Persistent** | true cross-session memory | new top-level key; must join `KNOWN_SAVE_KEYS`, `resetSave`, forward-compat merge, and be **set-union merged** (Issue #282 last-writer-wins) |
| **C. Recent N only** | bounded size | oldest attempt forgotten → duplicates possible again |
| **D. Unique fingerprints only** | exact dedup semantics; a repeat does not grow it | needs a cap or eviction rule (a full pool of ~45 toppings could grow large in principle; ~150 B/entry → 200 entries ≈ 30 KB) |

Recommended *for the Owner to choose from*: **A first (Phase 3), then D as an additive persistence phase**, D-with-cap, set-union merged, never storing derived hidden-recipe data other than the as-shown class.

"以前試した組み合わせです" **is** derivable both at RESULT (post-hoc, trivially) and in the Builder pre-bake (the signature is a function of the in-progress `PizzaState`). Pre-bake is more useful (saves the stock) but is UI in the busiest screen and must respect LC-R5b's pantry layout work → last phase. Silence for an *untried* combination is required, so absence of the message never becomes an oracle.

---

## 7. Privacy / Discovery Leak audit

Current Discovery 2.0 / Hint 5.0 contract (H5-INV-1..7, FREE LEAK): a sub-topping's name/id/glyph, a recipe's name/id/image/description, an undiscovered Technique, and any target-dependent presentation *before purchase* are never shown — in text, DOM, aria, `data-*`, `title`, img alt/src, visible test ids, or the view model. `HintSheet.hint5.test.tsx` serialises the dialog DOM and asserts this.

| Leak surface | Notebook | Result feedback | Rescue hints | Requirement |
|---|---|---|---|---|
| Recipe name | none | none (today) | **L2 recipe-initial would leak** | forbid, or Owner exception (OD-ORP-8) |
| Hidden recipe list | none | oracle only per attempt | none | keep probing costly (stock) |
| Exact ingredient set | none (player's own set only) | none | only what was deliberately revealed | store *only disclosed facts* |
| Hidden image | none | none | none | do not reuse recipe imagery in rescue UI |
| Hidden ordering | none | tie-break invisible unless ties → agreement guard | authored `hintSubToppingOrder` becomes visible as reveal order | reveal order is already an authored, non-answer order |
| Accessibility text / DOM / test ids | same discipline as `HintSheet` | `aria-live` line carries the same copy as the visible text (already the case) | rescue rows must carry only the disclosed fact | extend the existing DOM-serialisation gate to the new surfaces |
| Save readability | fingerprints are the player's own; **no** nearest-recipe id | — | facts of disclosed levels only (pattern `ing:` / `cls:` already accepted) | never persist a target-derived value the player was not shown |

**Known and accepted today:** `cls:<id>` / `ing:<id>` appear in the save only after purchase. **New risk to avoid:** caching "the nearest recipe" or "the next reveal" in the save/notebook before it is disclosed (would make an answer trivially readable).

---

## 8. Scaling analysis (tooling-only, no guessed classification)

`tools/original_pizza_recovery_hint5_ceiling.py` → JSON. Populations and authority as they exist **on main**; PR #309's pending-runtime taxonomy is **not** read. A topping without a row in `ingredientTaxonomy.ts` is UNCLASSIFIED (and its recipe is "not a Hint 5.0 target", exactly as production behaves).

### 8.1 Authority coverage

| Item | Value |
|---|---|
| 62 catalog | 10 sauce / 10 cheese / 42 topping (+3 runtime-only ids: capers, clam, fresh-tomato) |
| Toppings with a family row on main | **22 / 45** (23 unclassified: artichoke, arugula, bell-pepper, breadcrumb, chicken, cilantro, fig, french-fries, nduja, nori, parsley, porcini, powdered-sugar, prosciutto-crudo, shrimp, speck, spicy-salami, steak, strawberry, truffle, walnut, wurstel, zucchini) |
| Family pools (classified only) | vegetable 8 · meat 4 · herb 4 · seafood 3 · spice 1 · fruit 1 · other 1 |
| 172 authority rows | **52 with no resolved identity set · 62 with ingredients outside the 62 catalog (77 distinct ids, e.g. lemon ×7, cream-cheese ×5, shiso ×4, salmon ×3…) · only 58 fully expressible** |

→ The union universe is ~179 ingredient ids (PR #293 audit), not 62. "172 recipes on 62 ingredients" is **not measurable** with current authority.

### 8.2 Hint 5.0 full-open: how many recipes stay indistinguishable?

Buckets = number of recipes in the population that share the target's whole Hint 5.0 view. *Upper bound* = key topping not modelled; *authored key* = actual `RECIPE_HINT_ROLES` (only exists for the 25 production recipes).

| Population | Recipes | Hint 5.0-eligible | View, key unmodelled (upper) 1 / 2-3 / 4-10 / 10+ | Best key | Worst key | Authored key |
|---|---|---|---|---|---|---|
| Production (`recipes.ts`) | 25 | 25 | 23 / 2 / 0 / 0 | 25 / 0 / 0 / 0 | 25 / 0 / 0 / 0 | 24 rows: 24 / 0 / 0 / 0 |
| Master catalog 53 (62-catalog foundation) | 51 | **29** | 22 / 3 / 4 / 0 | 22 / 7 / 0 / 0 | 22 / 7 / 0 / 0 | 15 rows: 13 / 2 / 0 / 0 |
| 172 authority, expressible in 62 | 58 | **40** | 23 / 13 / 4 / 0 | 32 / 8 / 0 / 0 | 28 / 8 / 4 / 0 | 11 rows: 11 / 0 / 0 / 0 |

**Reading:** at recipe level Hint 5.0 is already close to unique and there is no `10+` bucket in any measurable population. The failure mode is **coverage** (29/51 and 40/58 eligible → 43 % and 31 % of measurable recipes get *no* Hint 5.0 view at all under current authority) and the sparse-population caveat: these are 25–58 recipes, not 172.

### 8.3 Ingredient answer space after full-open (lower bound)

Sub-topping combinations still consistent with the disclosed families at full ownership (classified pools only ⇒ lower bound):

| Population | best key: median / p90 / max | worst key: median / p90 / max | share > 10 | share > 100 |
|---|---|---|---|---|
| Production | 3 / 12 / 112 | 4 / 28 / 112 | 16 % | 4–8 % |
| Master 53 (eligible 29) | 1 / 4 / 112 | 1 / 8 / 112 | 6.9 % | 3.4 % |
| 172 in 62 (eligible 40) | 3.5 / 12 / 112 | 8 / 32 / 112 | 15–25 % | 2.5–5 % |

Sensitivity (pure combinatorics, no classification claim): k sub-toppings of one family, pool P → `C(P,k)`: P = 8, k = 2 → 28; P = 12, k = 3 → 220; P = 20, k = 3 → 1 140; P = 40, k = 3 → 9 880. Family pools today are 1–8; classifying the 23 unclassified toppings (and the ~117 ids outside the 62 catalog) will grow them, so **today's numbers are a floor and the trend is steeply upward.** This is the real "Hint 5.0 alone will not be enough" mechanism, and it appears **before** the 172 scale, at the mere act of adding taxonomy rows.

### 8.4 Exact identity collisions (matcher → `AMBIGUOUS`, never discoverable)

| Population | Colliding groups |
|---|---|
| Production 25 | **0** |
| Master 53 | 3 groups (pepperoni≡detroit-style; salsiccia≡chicago-deep-dish; stuffed-crust≡ny-style≡greek-style) |
| 172 authority in 62 | **5 groups / 10 rows** (e.g. `mozzarella\|tomato-sauce`: trenton-tomato-pie ≡ ny-style; `mozzarella\|onion\|oregano`: fugazza ≡ fugazzetta); the matrix itself also lists 11 extended collisions |

These recipes are separated only by dimensions the runtime does not observe (`DOUGH_VARIANT`, layer order, …). **No rescue level can make them discoverable.**

### 8.5 Near-miss density

Median number of recipes at d = 1 from a recipe: production 0 (80 % have none), master 0 (p90 4, max 9), 172-in-62 0 (p90 3, max 5). The shipped d = 1 line stays sparse at these sizes; it will fire more as the discoverable frontier grows.

### 8.6 Rescue Level 2 sizing

Classified toppings whose first kana is unique in their family: **19 / 19** (vegetable 7/7, herb 4/4, meat 4/4, seafood 2/2, fruit 1/1, other 1/1). So *family + initial* discloses the ingredient outright wherever a family is known.

---

## 9. Economy / Stars

Current figures: Hint 5.0 ladder 25–50 Pitz per recipe (+10 for the 「なし」 targets); recipe `baseRewardPitz` 100 × quality multiplier (1.2 / 1.0 / 0.8 / 0.5 / 0), **floored at 20**, plus a **+50 first-discovery bonus**. ORIGINAL pays nothing and consumes stock. Stars gate materials through `unlockCondition.minTotalStars` and recipes through `requiresRecipeId`.

| Rescue cost model | Pros | Cons / risk |
|---|---|---|
| **No penalty** (free after N ORIGINAL attempts) | most forgiving, no stall | removes the value of paid Hint 5.0 rungs once N is reachable by grinding — needs unique-fingerprint counting |
| **Pitz price per level** (like Hint 5.0) | consistent with existing economy | can be unaffordable early; conflicts with "no stall" if it is the *only* path |
| **First-discovery bonus reduction** (+50 → less, per level) | keeps the recipe score/★ intact; cost is soft | small (max 50 Pitz) lever |
| **Reward-multiplier reduction** | proportional | reduces a Pitz income the shop economy is tuned around |
| **Star cap** (e.g. max ★3 after rescue) | preserves "earned mastery" | ⚠ Stars gate `minTotalStars` material unlocks and the Discovery Ladder → a cap can **slow or stall progression**; the request forbids stall-by-rescue. **Not recommended** unless a floor guarantees every recipe still yields enough stars |

**No numbers are proposed here.** Any design must keep: ★ ≥ 1 for a passed Gate (already true), the 20-Pitz floor, and no rescue level may lower a value already earned.

---

## 10. Dependencies, conflicts, and phases

### 10.1 Dependencies

- **Fingerprint** ← matcher `RuntimeSignature` only (no dependency on Hint 5.0, taxonomy, or save).
- **Feedback hardening** ← collision list from authority; independent of fingerprint.
- **Notebook** ← fingerprint; persistence additionally ← save contract (#282 merge semantics, Full Game Reset).
- **Rescue L3/L4** ← existing `ing:` fact ledger + `hintSubToppingOrder`; needs Owner cost/trigger decisions; **not** taxonomy.
- **Rescue L1** ← taxonomy authority below family (**C-blocked**).
- **Rescue L2** ← Owner exception to H5-INV-1/3 + kana rule.
- **Builder integration** ← notebook + LC-R5b Builder/pantry layout.
- **All "reach the recipe" guarantees** ← collision-free authority (dimension work: Cooking Steps / DOUGH_VARIANT lane).

### 10.2 Conflicts with other lanes

| Lane | Conflict? |
|---|---|
| **LC-R5b** (Large Catalog) | Independent for phases 1–5. **Serialise the Builder-integration phase after LC-R5b**: both touch the Builder/pantry surface. No file overlap for pure modules |
| **PR #309 Taxonomy/HCG** | Independent. Rescue L1 and Hint 5.0 eligibility of the 23 unclassified toppings *wait on it*. This audit neither read nor relies on its pending-runtime data. When it lands as authority, re-run the tool (it reads `ingredientTaxonomy.ts` only) |
| PR #296 / #255 (172 taxonomy) | same as above |
| PR #295 / Issue #294 (Cooking Steps) | Future `late`/`prep`/… identity dimensions change the fingerprint → hence the versioned, sparse-dimension design (§3) |

### 10.3 Proposed phases (user's list, with a safer order)

The requested order was *Feedback → Fingerprint → Notebook → Rescue → Builder*. The audit suggests a small reorder because feedback already exists and the fingerprint is the shared, zero-risk foundation:

| # | Phase | Nature | Depends on | Owner decision needed first? |
|---|---|---|---|---|
| **P1** | **Attempt Fingerprint** — pure, versioned, unwired module + tests + a tooling gate for authority collisions | pure logic, no UI, no save | matcher only | No |
| **P2** | **Original Result Feedback hardening** — collision-safe candidate filter, sauce-less copy, AMBIGUOUS copy (G-1..G-3), optional 「遠い」 line, optional agreement-guarded component statements | RESULT UI (Verification Policy applies) | P1 not required; collision list | Yes (OD-ORP-1, 2, 11) |
| **P3** | **Trial Notebook, session-only (A)** + RESULT "同じ組み合わせを試しました" line | RESULT UI | P1 | Yes (OD-ORP-3/4) |
| **P4** | **Progressive Rescue L3 → L4** (safety net) via the `ing:` ledger, gated by unique-fingerprint attempts and/or player choice | HintSheet + reducer | P1 (unique counting), Owner cost model | Yes (OD-ORP-6, 7) |
| **P5** | **Notebook persistence (D)** — set-union merged, capped, reset-safe | save (additive, no version bump per precedent) | P3 | Yes (OD-ORP-3) |
| **P6** | **Rescue L2 (letter) / L1 (sub-family)** | HintSheet | Owner exception; taxonomy authority | Yes; **L1 blocked** |
| **P7** | **Builder integration** ("tried before" pre-bake) | Builder UI | P3/P5, **after LC-R5b** | Yes (OD-ORP-5) |

Why P4 (names) before P6 (letters/sub-family): it is the only level that needs no new authority, it provides the "must always be able to reach the recipe" safety net, and L2 ≈ L3 in strength anyway (§8.6).

**Recommended next slice: P1 (Attempt Fingerprint pure module)** — smallest, unblocks P3/P4/P5/P7, zero UI, zero save, zero Owner-decision dependency — **plus**, in parallel and docs-only, the Owner Decision brief for OD-ORP-1..11.

---

## 11. Owner Decisions required (no values decided here)

| ID | Decision | Options |
|---|---|---|
| **OD-ORP-1** | Feedback granularity at RESULT | (a) keep Hint 2.0 as is; (b) add a 「遠い」 line for d ≥ 3; (c) also add component statements |
| **OD-ORP-2** | Component statements ("sauceは合っていそう" / "cheeseは…") vs the paid SAUCE/CHEESE rungs | free-with-agreement-guard / not offered / offered only after rescue unlock |
| **OD-ORP-3** | Notebook persistence | A session-only / B persistent / C recent N / D unique fingerprints (with cap N) |
| **OD-ORP-4** | What the notebook records | ORIGINAL only vs also INCOMPLETE_MATCH and AMBIGUOUS-as-ORIGINAL; FAILED excluded (recommended); proximity stored *as shown* vs not stored |
| **OD-ORP-5** | Where "tried before" shows | RESULT only / Builder pre-bake / both |
| **OD-ORP-6** | Rescue unlock trigger | after N unique ORIGINAL fingerprints / player-opened at any time / only after L0 is fully bought; per recipe or global |
| **OD-ORP-7** | Rescue cost model | free / Pitz per level / first-discovery bonus reduction / reward reduction / star cap (⚠ stall risk). Numbers undecided |
| **OD-ORP-8** | Letter-hint subject and exception | ingredient initial (exception to H5-INV-1) / recipe initial (exception to H5-INV-3) / not offered; kana normalisation rule |
| **OD-ORP-9** | Level order | names (L3/L4) before letters (L2) recommended, because family + initial already ≈ name |
| **OD-ORP-10** | Collided recipes | exclude them from feedback and rescue until dimension authority separates them / mark as "cannot be reached yet" |
| **OD-ORP-11** | AMBIGUOUS RESULT copy | keep "あなただけのピザ" / a neutral copy that does not claim novelty |
| **OD-ORP-12** | Should duplicate detection ever *block* (recommended: never; inform only) | inform / warn-then-allow |

---

## 12. Scope-guard confirmation

Changed in this task: **this report, `tools/original_pizza_recovery_hint5_ceiling.py`, and `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_DISCOVERY-ASSISTANCE_Analysis.json` only.** No `src/`, CSS, UI, save schema, gameplay, Hint 5.0, matcher, Cooking Steps, LC-R5b, PR #309 change; no merge; no PR.

## 13. Limits of this audit

- The simulation measures only what main's authority can express (≤ 58 of the 172 rows). It cannot say what happens at the full 172; the JSON says so explicitly.
- Answer-space numbers are **lower bounds** (unclassified toppings excluded from family pools).
- Key-topping authority exists only for the 25 production recipes; for others best/worst-key envelopes are reported instead of a guess.
- Kana-uniqueness uses the first character of `nameJa` without normalisation.
- No runtime/e2e behaviour was exercised; conclusions come from reading the code and the shipped tests' contracts.

## 14. Files read (main)

`src/logic/discovery/{matcher,signature,freeCook,nearMiss,hintTarget,hint5Ladder,hint5Flag}.ts` · `src/state/{gameReducer,discoveryRegistration,resultNearMiss,persistence,dex}.ts` · `src/components/ResultPanel.tsx` · `src/screens/GameScreen.tsx` · `src/data/{discoveryCatalog,ingredientTaxonomy,recipeHintRoles,recipes,ingredients}.ts` · `src/logic/{pitzReward,hint5Economy.sim.test}.ts` · `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` (H5-INV-1..7) · `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` · `data/recipes/{ingredient,pizza}_master_catalog.json` · `docs/reports/data/TETO_HINT-5_TAXONOMY-COVERAGE_Fresh-Audit.json`.

## 15. Final verdict

**B. OWNER DECISION REQUIRED**

- **READY FOR DESIGN now:** P1 Attempt Fingerprint (pure, no decisions needed) and the P2 hardening items G-1..G-3 / F-1..F-3.
- **Owner decisions block:** notebook persistence, feedback granularity, rescue trigger/cost, letter-hint exception (OD-ORP-1..12).
- **Blocked by authority/dependency (not the whole lane):** Rescue L1 (no taxonomy below family; PR #309 is not production authority), any "reach every recipe" guarantee for the 10 rows in 5 collision groups, and the true 172-scale measurement (114/172 rows not evaluable).
