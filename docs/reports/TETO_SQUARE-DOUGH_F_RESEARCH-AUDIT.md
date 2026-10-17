# Square-Pan Dough F (#538) — Research behaviour: audit, Owner decisions and acceptance criteria

Docs-only. Issue #538 (child of Epic #532). Base: `origin/main` `80e6d10`. No `src/**` change, no Issue body edited. The only contract text edited is `TETO_ANTI-ORACLE-CONTRACT_2.1.md` (§3 / §13.1 / §15 sync notes, per Owner decision 6 below).
Inputs: `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` (D1–D7, O-1…O-7, §4A–4B), `TETO_ANTI-ORACLE-CONTRACT_2.1.md`, `TETO_RESEARCH-2.0_OWNER-DECISIONS.md`, `logic/discovery/researchEntry.ts`, `state/{recipeDiscoveryState,materialEntitlement,starterStock}.ts`, `logic/techniques/*`, `data/techniques.ts`, and the grandma trial in held PR #540 (branch `claude/issue-521-grandma-pizza-s3-3no1x2`, head `124f696`, Draft HOLD, not on main; counts quoted from it are approximate and re-checkable only on that commit).

## 0. Owner decisions incorporated (2026-10-17)
| # | Decision | Where reflected |
|---|---|---|
| 1 | **No new filter on Research candidates.** | §3 (R-B only as a guard test; R-C / R-D rejected), R10 |
| 2 | marinara's 「文字なし → A」 is accepted. | §4.1 |
| 3 | Research changing from a direct start to a candidate choice is accepted. | §4.2, R9 |
| 4 | The Research registrability rule and the Technique affordance must be kept consistent **by tests**. | §2, R1–R2 |
| 5 | Exceptions via Starter Grant / DEV State Editor ownership are to be verified. | §2.2 (verified) |
| 6 | Anti-Oracle 2.1's single-sauce premise is revised to match the existing multi-sauce implementation. | §8 (and the edited contract) |
| 7 | Hint 5.0 ingredient hints and Technique hints are separate. | §6 |
| 8 | A general route for a player who bought every ingredient hint to notice cooking methods is to be designed, without leaking any specific recipe's answer. | §6.2 (proposal) |
| 9 | The change conditions for G7, INV-TQ-4 and `deductionProduction.gate` are made explicit. | §7 |
| 10 | The Research 2.0 pre-53 re-audit that was not done is recorded as a separate follow-up. | §8.2 |
Not decided here (still Owner): the wording of any new line (§6.2, the RESULT neutral shape line), Design Lock §8, and everything listed in §9.

## 1. Layers kept apart
| Layer | Question | Inputs it may read | Where |
|---|---|---|---|
| **L1 Identity** | what is this cooked pizza? | the pizza's signature (ingredients, sauce base, `pan` once OBSERVED) | `signature.ts`, `matcher.ts` (exact match on all axes) |
| **L2 Candidacy / display** | which anonymous entries / pool members are listed, with what label? | ownership (`ownedIngredientIds`) and the Dex; stock only for "researchable now" | `researchEntry.ts`, `recipeDiscoveryState`, `hintTarget.discoverableHintCandidates` |
| **L3 Technique** | is ○/□ offered, is 天板焼き known? | the technique ledger, the derived affordance step | `techniques/*`, `discoveredTechniqueIds` |
Rule: **L2 never reads L1's outcome, the pizza's pan, or L3**; **L1 never reads L2 or L3** (already pinned for the matcher by `techniques.architecture.test.ts`). L3 may read the signature and the catalog (it does). Showing or hiding a candidate never changes whether a recipe can be identified, and identification never changes who is listed.

## 2. Registrability vs. the Technique affordance (decision 4, 5)
### 2.1 The relation in the normal game
- A Research Entry is **registrable by ownership only**: undiscovered, every finite material in `ownedIngredientIds` (Research 2.0 §3).
- The 天板焼き affordance step is **derived** (`techniqueAffordanceStep`): the first ladder step at which a requiring recipe is makeable; for grandma `max(step(olive-oil)=13, step(garlic)=14)` = **14**. It is open when the **credited** discovered count ≥ that step (`isTechniqueAffordanceOpen`; OD-TQ1D-2: `ladderCredit:false` recipes are not counted).
- Shop entitlement uses the same credited count (`resolveShopEntitlement` and `creditedDiscoveredCount` both default to `recipeCountsTowardLadder`). In the normal game a material is owned only after entitlement + purchase (`PURCHASE_INGREDIENT`), so **registrable ⇒ affordance open** holds for every state reachable by playing.

### 2.2 Exceptions — verified
| Path | Finding | Effect |
|---|---|---|
| **Starter Grant** (`applyStarterGrants`) | **retired**: no production call site (only `logic/economySimulation.ts`); `materialEntitlement.ts` states it "replaces EP4's `applyStarterGrants`". `starterGrantClaimedRecipeIds` is a carried-through legacy field. A probe of the pure function shows what it *would* grant: with 6 discovered recipes it grants `garlic` + `oregano`. | not an active path. **But a legacy save keeps what it granted**: `resolveShopEntitlement` is explicitly "every finite material already OWNED (bought, **or granted by the retired EP4** — an existing save keeps those as OWNED)". `garlic` and `olive-oil` are `starterGrantOnly`, so such a save can own both with a credited count below 14. |
| **Legacy-owned save** (the consequence of the row above) | grandma is then **registrable while the affordance is still closed** (credited count < 14). | the ○/□ switch is not shown yet, so the entry cannot be completed **until the 14th credited discovery** (the count only grows with play). **Same as the existing precedent**: `aussie`'s affordance is step 12 (onion) and onion is also `starterGrantOnly`. Not a dead end, a delay. |
| **DEV State Editor** (`devtools/*`, Preview / DEV only) | `editorModel` toggles ownership freely; its Step presets derive ownership from `materialsUpTo(step)` with the matching dex (consistent). | a manual toggle can break the invariant. **Dev-only; outside the production invariant**, but must be named in the test. |
| Any other grant | no other path writes `ownedIngredientIds` besides the Shop purchase (grep of the reducer: `PURCHASE_INGREDIENT` only). | — |

### 2.3 How consistency is guaranteed (no new filter)
- **R1 / R2 below** pin it in tests instead of code: registrable ⇒ affordance open over every state reachable by the reducer (a ladder walk, as `branchingFixture` / `deductionProduction.gate` do), **plus two named exception fixtures** (legacy-owned, DEV-edited) asserting the **defined, intended** behaviour: entry listed, ○/□ switch absent, no pan information anywhere, entry completable once the credited count reaches the affordance step.
- A code-level alignment (affordance also opening when a requiring recipe is already registrable by ownership) would change **OD-TQ1D-2** ("never opens earlier than the ladder step") and the `aussie` timing for legacy saves. It is **not proposed**; it is listed in §9 as an Owner option only.

## 3. Candidate display control (decision 1: no new filter)
| Option | Verdict |
|---|---|
| **R-A ownership-only registrability (unchanged)** | **adopted** |
| R-B hide until the affordance is open | **no code**: it hides nothing in the normal game (§2.1). Kept only as the guard tests R1 / R2. |
| R-C hide until the technique is discovered | rejected: the list would encode technique state (leak by analogy with INV-B4, which scopes the Board / ledger); the cohort letters would change mid-game ("letters never move", Research 2.0 §3); changes Research 2.0 §3 |
| R-D never list pan-required recipes | rejected: contradicts D2 「Free Cooking・Research からの発見経路は維持」; a recipe-specific population exclusion |
| R-E a separate cohort for pan recipes | rejected: two entries with the identical label 「？？？ピザ（にんにく）」; letter presence would encode the technique class |
After 天板焼き (□ chosen): Research is a Free Cook round with a target; **the target only picks the ○× rows**, identification is the matcher's, target-independent (Anti-Oracle §3 "MATCHED"). Target = grandma, □, exact set, Completion Gate PASS ⇒ `UNIQUE_MATCH` ⇒ NEW DISCOVERY (R3). Nothing in Research changes.

## 4. Accepted consequences
### 4.1 marinara 「文字なし → A」 (decision 2)
At step 14 with both undiscovered, marinara reads 「？？？ピザ **A**（にんにく）」 (before: bare) and grandma 「？？？ピザ **B**（にんにく）」; marinara keeps A after grandma is found (slot-stable). A player who has already found marinara only gets a new entry 「B」. Basis: Research 2.0 §4 "Catalog-local stability — a revision that adds a recipe to an existing cohort may change that cohort's letters. これは許容する"; the format change is §3's existing sibling-cohort format. **Pre-update rows**: the Trial Notebook is session-only and the × ledger is keyed by recipe id without a label, so no stored row carries the old bare label. Pinned by R6.
### 4.2 Research: direct start → candidate choice (decision 3)
A player with exactly one Research entry used to go straight to "research this" from HOME / Pizza Select; with grandma undiscovered there are two entries until it is found, so the **choice** list is shown (`homeDiscoveryRoute`, Pizza Select routing, Hint-sheet CHOOSE_RESEARCH). In the #540 trial about 35 fixtures (unit + e2e) had to add grandma as "found". Accepted; E's PR must update those tests explicitly (R9). Non-credit (`ladderCredit:false`, Design Lock §8-2 still open) keeps grandma in every later pool, as calabresa / aussie do.

## 5. Effects compared (the adopted option; the filters are rejected)
| Area | Effect |
|---|---|
| Existing saves | no migration (entries derive from ownership + Dex); one new Research entry for players past step 14; `discoveredTechniqueIds` gains an id (additive) |
| Research pool / routing | §4.2 |
| Hint 5.0 | ladder built from `requiredIngredients` only: **one SAUCE rung naming both sauces**, no pan / technique term anywhere (OD-TQ-6); see §6 and §7 |
| Anti-Oracle | the Research list is f(ownership, Dex) only (no technique leak); ○× rows are membership only and identical for ○ and □ cooks (INV-D3, D5, D6); the RESULT neutral shape line stays F's O-2 (pan-cooked unidentified pizzas only, identical across ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH) |

## 6. Ingredient hints and Technique hints are separate (decision 7, 8)
### 6.1 Separation
- **Hint 5.0 (purchasable)**: ingredient facts only (`ing:` / `h5:` / `cls:` / `meta:`); no rung, line, near-miss or price may mention a technique, the pan, or whether one exists (OD-TQ-6, INV-B4). Its price / availability never depends on technique state (INV-B5).
- **Technique clue (free, fixed)**: the Dex 調理法 riddle (O-6), shown once the affordance is open; the name 天板焼き only after discovery. **It is never a purchasable rung and never target-specific.**
- The two channels never share state: buying hints does not open or advance the technique clue, and discovering the technique does not change a hint.
### 6.2 A general route for the player who bought every ingredient hint (proposal, wording needs Owner approval)
Problem: all four ingredients are known (every rung bought, all ○) but the pizza is ORIGINAL on ○; no hint may name □. Constraint: **the route must be identical for every target and every outcome** — it may depend only on the player's own purchases and on global, public Technique state; never on `canonical(T)`, on whether T requires a technique, on the matcher outcome, or on the pizza's pan.
Options compared:
| Route | Mechanism | Leak risk | Verdict |
|---|---|---|---|
| G1 Dex riddle only (today) | the fixed clue in 調理法 | none | keep as the base; discoverability depends on the player opening 調理法 |
| **G2 generic pointer (recommended for review)** | one **constant** line, shown on the Hint sheet / RESULT advice for **any** target once the player has bought **every rung of that target** (a purchase-state predicate), **only while some technique affordance is open** (a global, already-public state: the Dex 調理法 section is visible then). Text points at the section and nothing else, e.g. "材料のほかに、調理法も見直してみよう（図鑑の「調理法」）" — **final wording: Owner**. Shown for ordinary recipes too, where it is merely generic advice. | none beyond what 調理法 already shows: the line appears for every fully-hinted target, so it does not say that *this* target needs a technique (INV-5 no class leak) | proposal |
| G3 a new Hint 5.0 rung | a rung "調理法" | names the technique class per target → violates OD-TQ-6 / INV-B4 | rejected |
| G4 RESULT line on ○ cooks with all-○ rows | depends on the matcher outcome / membership | violates INV-4 / INV-D6 | rejected |
Acceptance for G2 (R11): byte-identical across targets that do and do not require a technique; absent before any affordance opens; no pan / 天板 / 技法 word; no dependence on pizza, matcher outcome or `canonical(T)`.
Dead-end economics (Pitz spent on all rungs without making the recipe findable on ○) is mitigated by G2 and G1; whether G2 is enough is an Owner call (§9).

## 7. Gate change conditions (decision 9)
Each of these gates currently **fails by design** the moment a pan-requiring, two-sauce recipe exists. A change is allowed only under **all** of the conditions below, never as a blanket removal.
| Gate | Current assertion | What breaks | Conditions to change it |
|---|---|---|---|
| `hint5Production.gate` **G7** (clause 1) | exactly the NO_SAUCE recipes require a technique (and lack a sauce) | a pan-requiring recipe has sauces | the technique-requiring set becomes an **explicit allowlist derived from the catalog's declared technique requirements** (NO_SAUCE ∪ pan-requiring), asserted equal both ways; the pan-requiring recipe's ladder is asserted to have **no technique term** |
| G7 (clause 2) | every recipe without exactly one SAUCE rung of one subject is NO_SAUCE | grandma: one SAUCE rung naming **two** sauces | a separate allowlist for multi-sauce recipes (as `MULTI_SAUCE_RECIPE_IDS`), asserting exactly one SAUCE rung whose subjects equal the recipe's required sauces. This is a **Hint 5.0 privacy re-audit decision** (the rung reveals both sauces; Design Lock §8-3 still open) |
| `deductionProduction.gate` **INV-TQ-4** and "exactly one sauce except NO_SAUCE" | technique-requiring = NO_SAUCE; one sauce per recipe | same two reasons | same allowlists; **and** the whole gate and the DH4 privacy sweeps are re-run with the pan-requiring recipe in `GATE_STATES` and with **pan-axis states (○ and □)** added to the seeded states; no new fact id may appear, no technique / pan word in any request, stored id or line |
| `techniques.test` / OD-TQ-5/6 riddle assertion | a riddle never names the technique or a concrete operation | the O-6 riddle 「…四つの角まで生地を広げてみよう。」 contains an operation | an **explicit, technique-scoped exception** recorded after the Owner's one-line acknowledgement (#538); never a general relaxation |
Common conditions: (a) the change lands **in the PR that makes it necessary** — F for the pan axis / technique registry / synthetic pan fixtures, E for adding the grandma allowlist entry; (b) the gate is re-run in full, the result and the swept state counts are written in that PR's Result; (c) the allowlists are named constants, not inline edits; (d) no test is skipped, retried, or loosened to pass.

## 8. Anti-Oracle 2.1 revision and follow-up (decisions 6, 10)
### 8.1 Single-source premise revised
`TETO_ANTI-ORACLE-CONTRACT_2.1.md` said "1 枚の pizza に載る sauce は 1 種類 … ソース行は常に 1 件" (§3, §15) and based §13.1's re-audit on "sauce 1 種 / attempt". That has been false since Sauce B1 / B2 (per-kind ledger, `COMMIT_SAUCE_DISPENSE` appends to `sauceIds`, per-kind 100% / total 200% caps) and becomes load-bearing with grandma. This PR **edits the contract text**: §3 row ソース (rows = the sauces the player actually used, 0–many, still target-independent), §13.1 (the 53 / 172 re-audit assumes multi-sauce), §15 (the premise is labelled as the old audit condition and the numbers are marked **not recomputed**), plus a dated sync note at the top. **No invariant (INV-D1…D7, INV-4/5) changed**: `researchResultRows` already judges every used sauce with no cap. The multi-sauce cases are pinned by `multiSauce.guards.test.ts` (S2) and `researchResultRows.test.ts`.
### 8.2 Follow-up recorded (not done here)
**Research 2.0 §4 asks for a Fresh Gate re-audit of Research identifier compatibility before the 53 / 172 population is introduced. It was not done**: the catalog reached 53 recipes at Expansion Batch 5 and is 57 today (58 with grandma). Scope of the follow-up: (1) re-audit cohort-letter stability over the whole catalog, including the marinara A/B change and any cohort that gained members since Phase 1; (2) recompute the §15 expected-attempt table under the multi-sauce premise; (3) confirm INV-B7 on every cohort; (4) decide whether the check becomes part of the Recipe Batch Validator. **No Issue was created** (outward action); the record is this section and the PR body, and an Issue can be opened on request.

## 9. Acceptance criteria for #538 (final proposal)
R1 **Registrability is technique-independent**: `deriveResearchEntries` / `researchCohortLetters` / `discoverableHintCandidates` return identical results for states differing only in `discoveredTechniqueIds` (sweep over ladder states).
R2 **Registrable ⇒ affordance open** over every state reachable through the reducer (derived, no hard-coded step), **plus the two named exception fixtures** of §2.2 (legacy-owned save; DEV-edited state) asserting the intended behaviour, not just excluding them.
R3 **Discovery after □**: Research round, target = the pan recipe, □, exact set, Completion Gate PASS ⇒ NEW DISCOVERY; the RESULT technique stage names 天板焼き once; the Dex shows the recipe and the technique.
R4 **Round parity**: the same set on ○ ⇒ ORIGINAL. Surfaces compared: the ○× panel, the Trial Notebook line, the Research Board, the Hint sheet — byte-identical between an unidentified ○ cook and an unidentified □ cook of the same set, no pan / 天板 / 技法 word, no pan recorded in the Notebook. **Excluded**: the RESULT technique stage (R3) and the O-2 neutral shape line — the only permitted differences.
R5 **O-2 permitted consequence**: another recipe's ingredients on □ ⇒ ORIGINAL; target and ○× unaffected.
R6 **Label authority unchanged**: `researchEntryLabel` carries only the unlock ingredient and the cohort letter (INV-B7); marinara A / grandma B at step 14 pinned.
R7 **Hint 5.0 / Technique separation**: no pan / technique term in any rung, line or near-miss; buying rungs never changes the technique clue and vice-versa; G7 / INV-TQ-4 / `deductionProduction.gate` changed only under §7.
R8 **Save**: old save → new build and new save → old build; no new top-level key; Research derives from ownership + Dex.
R9 **Routing**: HOME / Pizza Select / Hint-sheet tests updated explicitly for 1 → 2 entries (the PR lists them).
R10 **No candidate-filter code**: a test pins that no Research / pool function imports `techniques/*` (L2 ↛ L3), next to the existing matcher ↛ techniques test.
R11 **G2 pointer (only if the Owner approves it)**: §6.2 acceptance.
R12 **Anti-Oracle multi-sauce**: a test with two sauces on the pizza asserts two sauce rows, target-independent, same DOM for ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH (extends the S2 guard to the panel).

## 10. Still for the Owner
1. Approve (or replace) the §6.2 G2 pointer and its wording; the RESULT neutral shape line's wording.
2. Option, **not proposed**: let the affordance also open when a requiring recipe is already registrable by ownership (would change OD-TQ1D-2 and `aussie` timing for legacy saves). Default: keep the delay (§2.2).
3. Design Lock §8 (live PIZZA DB check incl. pan form, `ladderCredit`, the SAUCE rung naming both sauces, shipping two sauces before TQ-3, id / name, ...) — unchanged and still open.
4. Riddle exception to OD-TQ-5/6, internal technique id / pan value name, affordance-step re-derivation at F (this audit re-derived 14).
5. Whether to open the §8.2 follow-up as an Issue.
