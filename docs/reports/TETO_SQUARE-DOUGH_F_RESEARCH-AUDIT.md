# Square-Pan Dough F (#538) — Research behaviour: audit, Owner decisions and acceptance criteria

Docs-only. Issue #538 (child of Epic #532). Base: `origin/main` (merged up to `a6a8614`, which includes #541 = A). No `src/**` change, no Issue body edited. The only contract text edited is `TETO_ANTI-ORACLE-CONTRACT_2.1.md` (§3 / §13.1 / §15 sync notes, per Owner decision 6 below).
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
| 8 | A general route for a player who bought every ingredient hint to notice cooking methods is to be designed, without leaking any specific recipe's answer. | §6.2 (G2 adopted in round 2) |
| 9 | The change conditions for G7, INV-TQ-4 and `deductionProduction.gate` are made explicit. | §7 |
| 10 | The Research 2.0 pre-53 re-audit that was not done is recorded as a separate follow-up. | §8.2 (Issue #544) |
Not decided here (still Owner): the RESULT neutral shape line's wording, Design Lock §8, and the items in §10.

### 0.1 Owner decisions, round 2 (2026-10-18) — incorporated
| # | Decision | Where reflected |
|---|---|---|
| A | **G2 adopted** with the fixed line 「材料だけでなく、生地の形や調理法も工夫してみよう。」, identical for every Research target; **no** variation by ingredient match, Technique state or discoverability; the timing-channel parity test is an acceptance criterion of F. | §6.2, R11 |
| B | A legacy save showing a Research candidate before the Technique is unlocked is **allowed**; **the Technique's own unlock condition is not changed**. | §2.2, §10 (the ownership-opens-affordance option is withdrawn) |
| C | The OD-TQ-5/6 exception is **approved only for a general Technique description common to all players**; an implementation that leaks a grandma-specific answer is forbidden. | §7 (riddle row), §6.2 |
| D | The Research 2.0 pre-53 re-audit gets a **follow-up Issue** (duplicates checked first); it does **not** block #543. | §8.2 (#544) |
| E | Design Lock §8 unapproved items **stay unapproved**. | §10 |

## 0.5 Evidence provenance (what rests on main, what rests on the held #540)
| Statement | Rests on |
|---|---|
| affordance step = 14 (olive-oil step 13, garlic step 14); entitlement / affordance share the credited count; Starter Grant retired; DEV editor behaviour; gate assertions (§7); cohort-letter rules and hash order | **main** (`80e6d10`), re-checkable now |
| grandma's recipe data, `ladderCredit:false`, "one SAUCE rung naming both sauces", marinara A / grandma B as observed, "about 35 fixtures" | **held #540** (`124f696`) — not on main; if #540 changes, R2's "step 14", R6's pins and §4.2's count must be re-derived. The R items are written to **derive** these values (from the ladder, the hash order, the recipe's own `requiredIngredients`), not to hard-code them. |

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
| **Legacy-owned save** (the consequence of the row above) | grandma is then **registrable while the affordance is still closed** (credited count < 14). | the ○/□ switch is not shown yet, so the entry cannot be completed **until the 14th credited discovery** (the count only grows with play). **Same as the existing precedent**: `aussie`'s affordance is step 12 (onion) and onion is also `starterGrantOnly`. Not a dead end, a delay. **Owner decision B (2026-10-18): allowed; the Technique's unlock condition is not changed.** |
| **DEV State Editor** (`devtools/*`, Preview / DEV only) | `editorModel` toggles ownership freely; its Step presets derive ownership from `materialsUpTo(step)` with the matching dex (consistent). | a manual toggle can break the invariant. **Dev-only; outside the production invariant**, but must be named in the test. |
| Any other grant | no other path writes `ownedIngredientIds` besides the Shop purchase (grep of the reducer: `PURCHASE_INGREDIENT` only). | — |

### 2.3 How consistency is guaranteed (no new filter)
- **R1 / R2 below** pin it in tests instead of code: registrable ⇒ affordance open over every state reachable by the reducer (a ladder walk, as `branchingFixture` / `deductionProduction.gate` do), **plus two named exception fixtures** (legacy-owned, DEV-edited) asserting the **defined, intended** behaviour: entry listed, ○/□ switch absent, no pan information anywhere, entry completable once the credited count reaches the affordance step.
- A code-level alignment (affordance also opening when a requiring recipe is registrable by ownership) is **not adopted** (Owner decision B): the Technique's unlock condition stays as derived (OD-TQ1D-2) and the legacy-owned delay is accepted.

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
### 6.2 General route for the player who bought every ingredient hint — **G2 adopted** (Owner, 2026-10-18)
Problem: all four ingredients are known (every rung bought, all ○) but the pizza is ORIGINAL on ○; no hint may name □.
**Adopted: G2** — one fixed line, exactly: **「材料だけでなく、生地の形や調理法も工夫してみよう。」**
Binding rules (Owner):
1. **Identical for every Research target.** The line's presence, text and position never vary with: whether the pizza's ingredients match a recipe or the target, `canonical(T)`, the matcher outcome, the Technique ledger or affordance state, whether the target requires a technique, or whether the target can currently be discovered. (This is stricter than the earlier proposal, which conditioned the line on an open affordance — **that condition is dropped**, it is Technique state.)
2. **Only a general description, never an answer.** It names no recipe, ingredient, pan, count or distance and says nothing target-specific; it is a general nudge shared by every player (this is the scope of the OD-TQ-5/6 exception, §7). An implementation that leaks a grandma-specific answer through it, or through any conditional display, is forbidden.
3. **Placement is an F implementation detail with one constraint:** the surface must be one whose presence depends only on "a Research target is active" (e.g. the Research context shown in PREPARE / the Hint sheet of a Research target) — **not** on the RESULT outcome, the pizza, or purchases. If it appears on a surface whose presence depends on purchases or attempts, that dependence must itself be target-independent and is covered by the timing-parity test.
Rejected alternatives (kept as record): G1 Dex riddle alone (insufficient as the only route); a new Hint 5.0 rung (names the technique class per target, OD-TQ-6 / INV-B4); a RESULT line on all-○ ORIGINAL cooks (depends on matcher outcome / membership, INV-4 / INV-D6).
**Timing-channel parity (acceptance criterion of F, R11):** a sweep over targets that differ in rung count, technique requirement, affordance state, discoverability and ingredient match, and over purchase counts (0…n rungs) and attempt counts, asserts the line is **present or absent identically** (same DOM, same text, same position) in every cell of the sweep. The line must not first appear at a purchase / attempt state that differs between targets.
Dead-end economics (Pitz spent on all rungs without making the recipe findable on ○) is addressed by this line plus the Dex riddle; Hint prices and availability stay independent of technique state (INV-B5).

## 7. Gate change conditions (decision 9)
The first three rows currently **fail by design** the moment a pan-requiring, two-sauce recipe exists (E adds it; F prepares the pan axis and the technique registry). The riddle row is **different**: it is not caused by adding a recipe but by the Owner-approved riddle copy itself, so it belongs to **F** (the copy lands with the technique registration) and needs the Owner's one-line acknowledgement **before F's first commit that touches the riddle**, independently of E. A change is allowed only under **all** of the conditions below, never as a blanket removal.
| Gate | Current assertion | What breaks | Conditions to change it |
|---|---|---|---|
| `hint5Production.gate` **G7** (clause 1) | exactly the NO_SAUCE recipes require a technique (and lack a sauce) | a pan-requiring recipe has sauces | the technique-requiring set becomes an **explicit allowlist derived from the catalog's declared technique requirements** (NO_SAUCE ∪ pan-requiring), asserted equal both ways; the pan-requiring recipe's ladder is asserted to have **no technique term** |
| G7 (clause 2) | every recipe without exactly one SAUCE rung of one subject is NO_SAUCE | grandma: one SAUCE rung naming **two** sauces | a separate allowlist for multi-sauce recipes (as `MULTI_SAUCE_RECIPE_IDS`), asserting exactly one SAUCE rung whose subjects equal the recipe's required sauces. This is a **Hint 5.0 privacy re-audit decision** (the rung reveals both sauces; Design Lock §8-3 still open) |
| `deductionProduction.gate` **INV-TQ-4** and "exactly one sauce except NO_SAUCE" | technique-requiring = NO_SAUCE; one sauce per recipe | same two reasons | same allowlists; **and** the whole gate and the DH4 privacy sweeps are re-run with the pan-requiring recipe in `GATE_STATES` and with **pan-axis states (○ and □)** added to the seeded states; no new fact id may appear, no technique / pan word in any request, stored id or line |
| `techniques.test` / OD-TQ-5/6 riddle assertion | a riddle never names the technique or a concrete operation | the O-6 riddle 「…四つの角まで生地を広げてみよう。」 contains an operation | **Owner approved (2026-10-18) the exception, limited to a general Technique description common to all players** (the 天板焼き riddle copy and the G2 line). The test exception is **technique-scoped and constant**: it asserts the exempt strings are fixed constants, identical for every player and every recipe/state, and that no Hint / Research / RESULT surface derives text from a recipe. A recipe-specific or state-conditional message is **not** covered and fails the test. Lands in F (with the technique registration), independently of E |
Common conditions: (a) the change lands **in the PR that makes it necessary** — F for the pan axis / technique registry / synthetic pan fixtures, E for adding the grandma allowlist entry; (b) the gate is re-run in full, the result and the swept state counts are written in that PR's Result; (c) the allowlists are named constants, not inline edits; (d) no test is skipped, retried, or loosened to pass.

## 8. Anti-Oracle 2.1 revision and follow-up (decisions 6, 10)
### 8.1 Single-source premise revised
`TETO_ANTI-ORACLE-CONTRACT_2.1.md` said "1 枚の pizza に載る sauce は 1 種類 … ソース行は常に 1 件" (§3, §15) and based §13.1's re-audit on "sauce 1 種 / attempt". That has been false since Sauce B1 / B2 (per-kind ledger, `COMMIT_SAUCE_DISPENSE` appends to `sauceIds`, per-kind 100% / total 200% caps) and becomes load-bearing with grandma. This PR **edits the contract text**: §3 row ソース (rows = the sauces the player actually used, 0–many, still target-independent), §13.1 (the 53 / 172 re-audit assumes multi-sauce), §15 (the premise is labelled as the old audit condition and the numbers are marked **not recomputed**), plus a dated sync note at the top. **No invariant (INV-D1…D7, INV-4/5) changed**: `researchResultRows` already judges every used sauce with no cap. The multi-sauce row behaviour is pinned today by `multiSauce.guards.test.ts` (S2, merged: two sauces on a one-sauce target → tomato ○, oil ×). **`researchResultRows.test.ts` on main still carries one-sauce production assertions** ("every recipe uses exactly one sauce", "a one-sauce pizza (the reducer replaces sauceIds with one element)" — the latter describes the retained `APPLY_SAUCE` replace path): those names are updated by E (the #540 trial already did the first), and R12 adds the panel-level two-sauce test. The contract edit also leaves `APPLY_SAUCE` described as the remaining replace-with-one path.
### 8.2 Follow-up recorded
**Research 2.0 §4 asks for a Fresh Gate re-audit of Research identifier compatibility before the 53 / 172 population is introduced. It was not done**: the catalog reached 53 recipes at Expansion Batch 5 and is 57 today (58 with grandma). Scope: (1) re-audit cohort-letter stability over the whole catalog, including the marinara A/B change and any cohort that gained members since Phase 1; (2) recompute the §15 expected-attempt table under the multi-sauce premise; (3) confirm INV-B7 on every cohort; (4) decide whether the check becomes part of the Recipe Batch Validator. **Tracked as Issue #544** (created 2026-10-18 after a duplicate check — #400 is the closed Phase 0+1 implementation and #527 only mentions the re-audit; no open Issue covered it). Owner decision: **it does not block #543** (nor #538 / #521 / #527).

## 9. Acceptance criteria for #538 (updated 2026-10-18)
R1 **Registrability is technique-independent**: `deriveResearchEntries` / `researchCohortLetters` / `discoverableHintCandidates` return identical results for states differing only in `discoveredTechniqueIds` (sweep over ladder states).
R2 **Registrable ⇒ affordance open** over every state reachable through the reducer (derived, no hard-coded step), **plus the two named exception fixtures** of §2.2 (legacy-owned save; DEV-edited state) asserting the intended behaviour, not just excluding them.
R3 **Discovery after □**: Research round, target = the pan recipe, □, exact set, Completion Gate PASS ⇒ NEW DISCOVERY; the RESULT technique stage names 天板焼き once; the Dex shows the recipe and the technique.
R4 **Round parity**: the same set on ○ ⇒ ORIGINAL. Surfaces compared: the ○× panel, the Trial Notebook line, the Research Board, the Hint sheet — byte-identical between an unidentified ○ cook and an unidentified □ cook of the same set, no pan / 天板 / 技法 word, no pan recorded in the Notebook. **Excluded**: the RESULT technique stage (R3) and the O-2 neutral shape line — the only permitted differences.
R5 **O-2 permitted consequence**: another recipe's ingredients on □ ⇒ ORIGINAL; target and ○× unaffected.
R6 **Label authority unchanged**: `researchEntryLabel` carries only the unlock ingredient and the cohort letter (INV-B7). The A / B assignment is **derived, not literal**: `researchCohortLetters` orders a cohort by `opaqueHash(recipeId)` (FNV-1a) ascending; with the ids `marinara` = 2348015198 and `grandma-pizza` = 2630931452 that gives marinara A / grandma B. The test computes the expected letters from the same ordering and additionally pins the two ids, so a changed id (e.g. if #540's recipe id is renamed) fails loudly instead of silently flipping the letters.
R7 **Hint 5.0 / Technique separation**: no pan / technique term in any rung, line or near-miss; buying rungs never changes the technique clue and vice-versa; G7 / INV-TQ-4 / `deductionProduction.gate` changed only under §7.
R8 **Save**: old save → new build and new save → old build; no new top-level key; Research derives from ownership + Dex.
R9 **Routing**: HOME / Pizza Select / Hint-sheet tests updated explicitly for 1 → 2 entries (the PR lists them).
R10 **No candidate-filter code**: a test pins that no Research / pool function imports `techniques/*` (L2 ↛ L3), next to the existing matcher ↛ techniques test.
R11 **G2 line (adopted)**: the fixed string 「材料だけでなく、生地の形や調理法も工夫してみよう。」 appears identically for every Research target, with no variation by ingredient match, Technique state or discoverability; **timing-channel parity sweep** as in §6.2 (targets × rung counts × purchases × attempts × affordance state × technique requirement); a test that the string is a constant in one place and that no code path derives it from a recipe.
R12 **Anti-Oracle multi-sauce**: a test with two sauces on the pizza asserts two sauce rows, target-independent, same DOM for ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH (extends the S2 guard to the panel).

## 10. Still for the Owner
1. The wording of the RESULT neutral shape line (O-2). (The G2 line is fixed.)
2. Design Lock §8 — **unapproved items stay unapproved** (live PIZZA DB check incl. the pan form, `ladderCredit`, the SAUCE rung naming both sauces, shipping two sauces before TQ-3, id / name, sfincione, two-different-base-sauce recipes). Nothing in this document treats any of them as approved.
3. Internal technique id / pan value name; the affordance-step re-derivation at F (this audit re-derived 14).
~~Option: let the affordance also open when a requiring recipe is already registrable by ownership~~ — **withdrawn** by the Owner decision B (a legacy save may show the candidate before the Technique is unlocked; the unlock condition is unchanged).
