# Square-Pan Dough F (#538) — Research behaviour: audit and acceptance-criteria proposal

Docs-only. Issue #538 (child of Epic #532). Base: `origin/main` `80e6d10`. **Proposal for Owner review — nothing here is decided, nothing is implemented, no Issue body is edited.**
Inputs read: `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` (§2 D1–D7 / O-1…O-7, §4A–4B), `TETO_ANTI-ORACLE-CONTRACT_2.1.md`, `TETO_RESEARCH-2.0_OWNER-DECISIONS.md`, `logic/discovery/researchEntry.ts`, `state/recipeDiscoveryState.ts`, `logic/techniques/{registration,runtime,detection}.ts`, `data/techniques.ts`, and the grandma trial in the held PR #540 (used only as a measurement, not as a design). **Provenance of the trial figures**: branch `claude/issue-521-grandma-pizza-s3-3no1x2`, head `124f696` (PR #540, Draft HOLD, not on main). Counts quoted from it are approximate and re-checkable only on that commit; if #540 is rebased or dropped they must be re-measured.

## 0. Terms (kept apart on purpose — item 5)
| Layer | Question it answers | Inputs it may read | Where |
|---|---|---|---|
| **L1 Identity** | what is this cooked pizza? | the pizza's signature (ingredients, sauce base, **pan** once `pan` is OBSERVED) | `signature.ts` + `matcher.ts` (exact match on all axes) |
| **L2 Candidacy / display** | which anonymous Research entries / pool members are listed, with what label? | **ownership** (`ownedIngredientIds`) and the Dex; stock only for "researchable now" | `researchEntry.ts` (`isResearchRegistrable`, `deriveResearchEntries`, `researchCohortLetters`), `recipeDiscoveryState`, `hintTarget.discoverableHintCandidates` |
| **L3 Technique** | is the ○/□ switch offered, is 天板焼き known? | technique ledger, derived affordance step | `techniques/*`, `discoveredTechniqueIds` |
Rule proposed for #538: **L2 never reads L1's outcome or the pizza's pan, and never reads L3**; **L1 never reads L2 or L3** (`techniques.architecture.test.ts` already pins "the matcher imports nothing technique-related"); L3 may read L1's signature and the catalog (it already does). Hiding or showing a candidate is a L2 matter and never changes whether the recipe can be identified.

## 1. Can a pan-required recipe be kept out of Research before 天板焼き opens? (audit)

### 1.1 The facts
- A Research Entry is **registrable by OWNERSHIP only**: undiscovered, and every finite material is in `ownedIngredientIds`. The Dex and stock are not inputs (Research 2.0 OD §3; `researchEntry.ts` header).
- The 天板焼き **affordance step is derived** (`techniqueAffordanceStep`): the first ladder step at which a recipe that requires the technique is makeable from unlocked materials — for grandma, `max(step(olive-oil)=13, step(garlic)=14)` = **14**. It is open when the *credited* discovered count ≥ that step (`isTechniqueAffordanceOpen`, OD-TQ1D-2: a `ladderCredit:false` recipe is not counted).
- Garlic becomes Shop-entitled by **the same credited count**: `resolveShopEntitlement(…, countsTowardLadder = recipeCountsTowardLadder)` and `creditedDiscoveredCount` (`runtime.ts`) both use `recipeCountsTowardLadder`, so a non-credit discovery (aussie, calabresa, grandma itself) raises neither. A player can only **own** it after entitlement + purchase. *Not yet verified, to be pinned by R2:* ownership paths outside the Shop — a Starter Grant (`starterGrantOnly` materials only; none of grandma's) and the DEV State Editor (dev builds only).
- ⇒ **A pan-required recipe cannot become registrable before its affordance is open**: ownership ⊂ entitlement, and entitlement and affordance are the same ladder predicate. At the instant grandma becomes a Research Entry (step 14, garlic owned) the affordance has been open since the count reached 14.

### 1.2 So what does "before 天板焼き is unlocked" mean? Two readings
| Reading | Is grandma a Research candidate then? | Verdict |
|---|---|---|
| (a) before the **affordance** (the ○/□ switch exists) | **Never** — it cannot be registrable earlier (above). A filter "hide until affordance open" would hide nothing. | needs no code; a **guard test** is enough |
| (b) before the technique is **discovered** (the player has not yet cooked on a pan; the Dex shows 「？？？」＋the riddle) | **Yes, by design**: the entry 「？？？ピザ B（にんにく）」 exists next to the riddle. The riddle (O-6) is the only guidance toward □. | see §1.3 |

### 1.3 Ways to hide it in reading (b) — compared
| Option | Mechanism | Result | Problem |
|---|---|---|---|
| **R-A (recommended): ownership only, no new condition** | unchanged L2 | grandma is an entry from step 14; discoverable with □ (§2) | the entry cannot be completed on round dough (accepted, O-2); dead-end risks in §4 |
| R-B hide until affordance open (derived filter) | L2 reads the affordance | identical to R-A under U1 (§1.1) | adds a code path and a contract edge (L2→L3) for no behavioural change; keep as a **guard test**, not code |
| R-C hide until the technique is discovered | L2 reads the ledger | grandma absent until the player cooks anything on □ | (1) the Research list now **encodes technique state**: a leak by analogy with INV-B4 (which scopes the Board / ledger, so this is an extension, not a direct hit) and with the OD-TQ-5 rule that unlock state is not revealed; (2) circular for guidance (the only pointer to □ is the riddle, which is shown regardless); (3) the cohort letters would **change mid-game** when it appears (breaks "letters never move", Research 2.0 §3) — this and (4) are the direct grounds; (4) changes the Research 2.0 §3 registrability rule → Owner decision |
| R-D never list pan-required recipes (Free Cooking only) | L2 excludes by recipe property | no Research path for grandma | contradicts **D2 「Free Cooking・Research からの発見経路は維持」**; a recipe-specific population exclusion; changes the Research contract → Owner decision |
| R-E give pan recipes their own cohort | L2 keys cohorts by (unlock, technique class) | marinara keeps its bare label | two entries with the **identical label** 「？？？ピザ（にんにく）」 (ambiguous identity, defeats OD-R2), and letter presence would itself encode the technique class |
**Conclusion:** the only method that does not change a Research contract is R-A. Every filter (R-B → no-op; R-C / R-D → contract change) is either vacuous or needs an Owner decision (item 6).

## 2. After 天板焼き: can grandma be discovered by ordinary Research? (item 2)
Research is a Free Cook round with a target; **the target only chooses the ○× rows**. Discovery is the matcher's (L1) and is target-independent — a cross-recipe exact match already discovers whichever recipe matches (Anti-Oracle §3 "MATCHED"). So once `pan` is an observed axis, a Research round with target = grandma, □ chosen, tomato + olive-oil + mozzarella ×3 + garlic ×2, Completion Gate PASS → `UNIQUE_MATCH` → NEW DISCOVERY, with the technique stage in RESULT (O-2 usage/recipe path). The same ingredients on ○ → `NO_MATCH` (ORIGINAL). Research needs **no change** for this; it needs **tests** (R3–R5 below).

## 3. Can the marinara A/B change be minimised? (item 3)
Measured (the held #540, Chromium): at step 14 with both undiscovered, marinara reads 「？？？ピザ **A**（にんにく）」 (before: bare 「？？？ピザ（にんにく）」) and grandma 「？？？ピザ **B**（にんにく）」; marinara's letter stays A even after grandma is found (letters are slot-stable). Players who already found marinara see only a new entry 「B」.
- **It is already an accepted contract**: Research 2.0 OD §4 "Catalog-local stability — a catalog revision that adds a recipe to an existing cohort may change that cohort's letters. これは許容する." No save mapping may be added to prevent it (OD-R2-2).
- **It cannot be avoided without breaking something else** while grandma is a candidate sharing marinara's unlock fact (garlic): R-C moves the shift to a later, surprising moment; R-D removes the Research path (D2); R-E duplicates labels. The shift is the **bare → A change for marinara only**, visible only to a player who has not found marinara yet and has garlic.
- **Pre-update rows**: the Trial Notebook is session-only (reload clears it) and the × ledger is keyed by recipe id with no label (Research 2.0 §4 "影響範囲は表示のみ"), so no stored row can carry the old bare label; the format change bare → 「A」 is §3's existing sibling-cohort format applied, not a new one.
- **Re-audit trigger already passed**: Research 2.0 §4 asks for a Fresh Gate re-audit of identifier compatibility **before the 53 / 172 population**; the catalog is already 57 (58 with grandma). Worth an explicit Owner note when E lands.
- Recommendation: **accept (R-A)**, pin it with a test (marinara A / grandma B at step 14, label carries only the unlock ingredient and the letter, INV-B7), and record it as an Owner-acknowledged consequence. If the Owner wants zero shift, the only mechanism is to give grandma a different unlock fact (a later material), which is a recipe-design change for E.

## 4. Comparison of effects (item 4)
| Area | R-A (recommended) | R-C hide until technique known | R-D never list |
|---|---|---|---|
| **Existing saves** | no migration: entries derive from ownership + Dex. Players past step 14 get **one new Research entry**; the save gains only `discoveredTechniqueIds` ids (additive) | same, but the entry appears later and unpredictably | no new entry |
| **Research pool / routing** | 1 entry → 2: HOME / Pizza Select leave the direct "research this" route for the choice list until grandma is found. In the #540 trial ~35 fixtures (unit + e2e) had to add grandma as "found". Non-credit (`ladderCredit:false`, pending Owner §8-2) keeps it in every later pool, as calabresa / aussie do | the same effect arrives later, mid-session | none |
| **Hint 5.0** | ladder built from `requiredIngredients` only: one SAUCE rung naming both sauces, no pan / technique word anywhere (OD-TQ-6). Gates to update deliberately in F: `hint5Production.gate` G7 — **both** its clauses: "exactly the NO_SAUCE recipes require a technique" **and** "every recipe without exactly one SAUCE rung of one subject is a NO_SAUCE recipe" (grandma has two sauces: one SAUCE rung naming both, so the second clause also goes red; relaxing it is a Hint 5.0 privacy re-audit decision, not a mechanical edit) — and `deductionProduction.gate` INV-TQ-4 / "exactly one sauce" (the #540 trial already showed the latter). **Dead-end:** a player can buy every rung, know all four ingredients, and still not discover it on ○ (no hint may name □) | same, once visible | n/a |
| **Anti-Oracle** | Research list = f(ownership, Dex) only → no technique leak. ○× rows identical for ○ and □ (membership only, INV-D3 / D5). RESULT neutral shape line stays F's O-2 (pan-cooked unidentified pizzas only, same for ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH) | **leaks**: list content depends on the technique ledger (INV-B4) | recipe-specific exclusion; the panel stays target-independent |
| **Contracts changed** | none for registrability. Doc revisions only (below) | Research 2.0 §3 registrability | Research 2.0 §3 + D2 |

## 5. Acceptance criteria to add to #538 (proposal)
R1 **Registrability is technique-independent**: `deriveResearchEntries` / `researchCohortLetters` / `discoverableHintCandidates` return identical results for two states that differ only in `discoveredTechniqueIds` (sweep over the ladder states, as `deductionProduction.gate` does).
R2 **Guard (reading a)**: for every ladder state and owned-set order, a pan-required recipe registrable ⇒ its affordance is open (derived; no hard-coded step).
R3 **Discovery after □**: Research round, target = the pan recipe, □, exact set, Completion Gate PASS ⇒ NEW DISCOVERY; the RESULT technique stage names 天板焼き once; the Dex shows the discovered recipe and the technique.
R4 **Round parity**: the same ingredients on ○ ⇒ ORIGINAL. Surfaces compared: the ○× Research panel, the Trial Notebook line, the Research Board and the Hint sheet — **byte-identical** between a ○ cook and a □ cook of the same set that are both unidentified, with no pan / 天板 / 技法 wording and no pan recorded in the Notebook (INV-D6 extended to pan; INV-B4 for the Board). **Excluded from R4:** the RESULT technique stage (R3) and the O-2 neutral shape line (only for pan-cooked unidentified pizzas, identical across ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH) — these are the **only** permitted differences.
R5 **O-2 permitted consequence**: another recipe's ingredients on □ ⇒ ORIGINAL; Research target and ○× unaffected.
R6 **Label authority unchanged**: `researchEntryLabel` carries only the unlock ingredient and the cohort letter (INV-B7); marinara A / grandma B at step 14 pinned (or the Owner's alternative).
R7 **Hint 5.0**: no pan / technique term in any rung, line or near-miss; G7 and INV-TQ-4 updated deliberately with the DH4 sweeps re-run with grandma.
R8 **Save**: old save → new build and new save → old build round-trips; no new top-level key; Research derives from ownership + Dex.
R9 **Single-entry routing**: the HOME / Pizza Select / Hint-sheet routing tests are updated explicitly for 1 → 2 entries (list the updated tests in the PR).
R10 **No candidate-filter code**: a test pins that no Research / pool function imports `techniques/*` (L2 ↛ L3), alongside the existing "matcher ↛ techniques" test.

## 6. Items that would change an existing contract — returned to the Owner (not implemented)
1. **Any registrability filter** (R-B as code, R-C, R-D): changes Research 2.0 §3 「登録可能 = 所有のみ」 (and R-D also D2). Not proposed.
2. **Anti-Oracle 2.1 §3 / §15 wording**: 「1 枚の pizza に載る sauce は 1 種類 … ソース行は常に 1 件。複数 sauce を同時に試す前提は置かない」 is **already out of date** since the multi-sauce engine (B1 / B2) and becomes false for grandma (two sauces, two sauce rows). The mechanism (`researchResultRows` judges every used sauce, no cap) already handles it; the **text** needs an Owner-approved revision (and the §13.1 "53 / 172 re-audit under one sauce per attempt").
3. **Letter shift (marinara bare → A)**: contract-accepted (Research 2.0 §4); please acknowledge for this catalog revision.
4. **Dead-end economics**: whether Hint purchases for a pan-required entry are allowed while no hint may name □ (Pitz can be spent on all rungs without making the recipe findable on ○).
5. Already listed in #538 / the addendum: riddle vs OD-TQ-5/6, the neutral RESULT line's wording, internal technique id and pan value name, and the affordance-step re-derivation (expected 14; this audit re-derived 14 from the current ladder).
