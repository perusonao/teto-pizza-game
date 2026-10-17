# Square-Pan Dough — Design Lock Addendum (Q0, proposal)

Status: **PROPOSAL for Owner approval. Docs-only.** Revision 3 (2026-10-17): Owner decisions O-1…O-7 are **confirmed**; **Option 4 is adopted** (§4A evaluation, §4B confirmed spec). Options 1–3 are not adopted (Option 1 stays only as a recorded fallback). No `src/**`, recipe, save, test or CSS change. Not merged, not deployed, no shared Preview touched.
Issue: #533 (Q0) under Epic #532. Parent: #521. Base: `origin/main` `608e65b`.
Amends (does not rewrite): `docs/reports/TETO_MULTI-SAUCE-RECIPES_Design-Lock.md`. The original decision text of that file is unchanged; this addendum is the change record.
Related: `TETO_SQUARE-DOUGH_Fresh-Audit-and-Plan.md`.

## 1. Issue map

| Issue | Role | Depends on |
|---|---|---|
| #532 | Epic | — |
| #533 | Q0 — this addendum | — (blocks A–E) |
| #534 | A — shape foundation | Q0 |
| #535 | B — tap / long-press spread | A (after #474's implementation PR if it lands first) |
| #536 | C — corner drag + completion | B |
| #537 | D — sauce / toppings / cheese / bake / RESULT (D1 logic, D2 render) | A, C; D2 after #518 or without touching its blocks |
| #538 | **F — 天板焼き Technique / pan identity / Dex・RESULT / unlock (U1, P1)** (child of #532) | A, C |
| #521 | **E = S3** (grandma-pizza recipe). No new Issue. | **D and F complete** (and A–C) + Design Lock §8 answers |

GitHub's sub-issue API could not attach #521 (it needs the issue's internal id, which the tooling did not expose), so #521 is linked from the Epic body and a #521 comment. A–D/Q0 are real sub-issues of #532.

## 2. Owner decisions recorded (2026-10-17, verbatim intent)

| # | Decision |
|---|---|
| D1 | `panShape` is a reusable design; initial application is `grandma-pizza` only. |
| D2 | Do not reveal the existence of undiscovered recipes. Keep the discovery path from Free Cooking / Research. If these conflict, compare design options and report (§4). |
| D3 | No public release of a round `grandma-pizza` ahead of the square one. |
| D4 | Thickness evenness is used as a **completion gate**; existing scoring is unchanged. |
| D5 | Initial proposal: four corners reached at ≥ 85% plus operation assist. Final values are decided from Owner on-device HV. |
| D6 | RESULT shows the square pizza **and** the pan. |
| D7 | The unanswered items of Design Lock §8 stay unconfirmed. Nothing is approved by inference. |

**Owner decisions O-1…O-7 (2026-10-17, confirmed; Option 4 adopted):**

| # | Decision |
|---|---|
| O-1 | The pan is a **Technique**. The Shop-purchase form is not adopted. |
| O-2 | Accept that a different `pan` means other recipes are no longer discovered. Design a RESULT route that lets the player understand a shape difference. An undiscovered recipe's identity must not leak. |
| O-3 | Identity uses the **`pan` axis only**. The `shape` axis stays `UNAVAILABLE`. |
| O-4 | **U1**: the unlock condition is derived from the required ingredients. Step 14 is re-verified at implementation time. |
| O-5 | **P1**: a ○ / □ switch in the DOUGH step. |
| O-6 | Technique name **「天板焼き」**. Undiscovered Dex hint: 「丸くなくても、ピザは焼ける。四つの角まで生地を広げてみよう。」 Description after discovery: 「四角い天板に生地を広げて焼く調理法。指で押し広げ、四隅まで伸ばして形を整えよう。」 |
| O-7 | 「次へ」 fixes the shape. Before that, re-editing and switching are allowed. |

Operation spec (Owner) and D1–D7 above remain in force. Design Lock §8 stays unanswered.

## 3. What this addendum changes in the Design Lock (change record)

| Design Lock location | Original text (unchanged in that file) | Effect of this addendum |
|---|---|---|
| §2 "Grandma pizza — source re-check" | "Dough form (round, not sheet pan) is a documented simplification…" | **Superseded for `grandma-pizza` only**: it gets a square pan (D1/D6). The round simplification stays valid for every other recipe. |
| §7 S3 row, "Needs S1 and S2 merged first" | S3 depends on S1, S2 | **Extended**: S3 additionally depends on A–D (#534–#537) and D3 forbids shipping a round grandma first. S3 stays on hold (consistent with the Design Lock status block). |
| §0-7 CUT excluded | CUT excluded from the initial scope | **Unchanged.** Square pan disables CUT; #429 / #467 untouched. |
| §0-1…6, 8, 9 (ingredients, presence scoring, Lunch Rush excluded, no new FINISH, #519, #502) | | **Unchanged.** |
| §8 Owner decisions still needed (8 items) | | **Unchanged and still open** (D7), see §7. |
| §6 recipe data (tomato 1 / olive-oil 1 / mozzarella 3 / garlic 2, `ladderCredit:false`, `lunchRush:false`, key-free) | planned values, "adjustment values" | **Unchanged and still planned only.** Counts may need re-tuning once the square pan exists. |

One non-decisional pointer line is added at the top of the Design Lock file so a reader finds this addendum. No decision text is edited.

### Source-evidence status (not confirmed)
The Design Lock §2 and the Post-W1 Cooking Steps design record that grandma's **real-world sheet-pan form is unevidenced in the repository**, `doughStyle` is unrecorded, and the live PIZZA DB page could not be checked from this environment. Therefore **the square pan is an Owner gameplay-design decision (D1/D6), not a fact taken from PIZZA DB.** No document, UI text or description may claim that PIZZA DB records a rectangular pan until the Owner confirms the live page.

## 4. Earlier options 1–3 (Owner: not adopted; kept as record)

### The conflict
- A recipe round (Recipe Select / Dex cook) can show the square pan: the recipe is already known.
- A **Free Cooking / Research** round starts with `FREE_COOK_RECIPE` (a sentinel) and the matcher (`evaluateDiscovery` over the ingredient signature) identifies the recipe only **after** `CONFIRM_BAKE`. Showing a square pan before that would tell the player that a special recipe exists / that their combination is one.
- Anti-Oracle 2.1 forbids using the matcher as an oracle (INV-4) and forbids pre-purchase / pre-discovery signals that depend on the target. Research targets only get ○× at RESULT.
- D2 asks for both: no reveal, and discovery from Free Cooking / Research must still work.

### Options

| | **Option 1 — Round-first, reveal after identification** | **Option 2 — Pan as a neutral tool for everyone** | **Option 3 — Auto-switch to square when the combination matches** |
|---|---|---|---|
| Idea | Free Cooking / Research always play the round dough for undiscovered recipes. The matcher stays ingredient-only. Once the recipe is identified (NEW_DISCOVERY) it enters the Dex; from then on its recipe rounds use the square pan. | Free Cooking / Research offer a generic 丸 / 天板 choice to every player from the start. Pan is chosen by the player, not by the recipe. | When the pizza so far matches a recipe signature, the dough turns square. |
| Anti-Oracle | **Safe.** No pan signal exists before identification; nothing depends on the target. | **Safe for the choice itself**, but the existence of a pan option hints that pan-recipes exist (mild, generic). | **Violates INV-4**: the matcher becomes an oracle mid-cook. **Rejected.** |
| Discovery path (D2) | **Unchanged**: ingredients only, no new matcher input. Research ○× unchanged. | Preserved if the matcher ignores pan. If grandma *required* a square pan to match, discovery would depend on the player picking it → harms discoverability. So pan must not be a matcher input. | n/a |
| Fit with D1 "initial application: grandma only" | Good. | **Conflicts**: offering the pan to everyone means every recipe must work on square (Reference, scoring, art), well beyond grandma-only. | n/a |
| Fit with D6 (RESULT shows square + pan) | Recipe rounds: yes. The **first discovery RESULT** shows the pizza as played (round). The Dex card, after identification, reveals "bakes on a sheet pan" as the discovery payoff. | Yes, whenever the player chose the pan. | n/a |
| Scoring (D4: unchanged) | **Open risk**: a free-cook match is scored as the matched recipe (`REGISTER_TO_DEX`). Geometry-dependent parts compared with a *square* Reference would be unfair for a round-played pizza. Mitigation proposal: resolve the Reference by **played pan shape** (one extra input), formulas untouched. Needs a parity test and Owner OK. | Same issue for any recipe played on a non-native pan. | n/a |
| Scope / cost | Smallest: no free-cook UI change. | Largest: a new generic selector + square for all recipes. | n/a |

### Recommendation
**Option 1**, with these properties to be confirmed by Owner:
1. `panShape` is read **only** in recipe-mode rounds of recipes that are already discovered (Dex-known). Free Cooking / Research never show a pan.
2. The matcher, signature, Research ○× and Hint 5.0 are unchanged; the combined system cannot reveal grandma before discovery.
3. First-discovery scoring uses the Reference matching the **played** shape; formulas and weights are unchanged (D4). Parity tests: all 57 existing recipes byte-identical; grandma discovered via round free-cook is scored without a square-vs-round penalty.
4. Every surface that can draw a recipe before discovery must stay shape-neutral: Dex silhouette (`DexOverlay.silhouette`), Recipe Select thumbnails, `ReferenceThumbnail`, Hint sheet, Research board, changelog / news text, order screens. Audit in A; D enforces.
5. If the Owner prefers the first-discovery RESULT also to show the pan (stricter D6), that needs identification-time re-render and is a separate slice — flagged, not assumed.

If Option 1's "first discovery is round" is unacceptable, Option 2 is the fallback, but it requires lifting D1's "grandma only" limit; that choice is the Owner's.

### Verification for whichever option is approved
- E2E: grandma ingredients cooked from Free Cooking and from a Research target discover `grandma-pizza` exactly as today (round), at 390×844 and 360×800 (Chromium + WebKit).
- Source/DOM sweep: with grandma undiscovered, no `panShape`, "square", "天板" token, rectangle thumbnail or pan CSS class is reachable in Dex, Recipe Select, Hint, Research, Free Cooking, changelog (privacy-gate style test).
- After discovery: recipe round shows the square pan; RESULT shows square pizza and pan (D6).

## 4A. Option 4 — square pan as a general cooking method: feasibility audit

Audited on `origin/main` `608e65b` (read-only). Files: `logic/discovery/{signature,matcher,freeCook}.ts`, `logic/techniques/*`, `data/techniques.ts`, `state/persistence.ts`, `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`, `…_FINAL-IMPLEMENTATION-GATE.md`, `TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`, the 172-row matrix.

### 4A.1 Verdict
**Feasible, and it fits the existing Cooking Techniques model almost one-to-one**, because the repository already has the slot Option 4 needs. Three conditions must be met first (Owner decisions O-1…O-3 in §4A.7). No code was changed.

### 4A.2 Compatibility with existing systems

| System | Finding | Compatible? |
|---|---|---|
| **Discovery signature / matcher** | `IdentityDimensions` already has a `pan` axis (`null` by default, `FIXED_BY_FLOW`: "no pan exists (no PAN_BAKE)") and a `shape` axis (`UNAVAILABLE`). Matching is exact on all 11 axes; a target needing a non-default value on an `UNAVAILABLE` axis can **never** match (matcher rule 3). | **Yes, via the `pan` axis** (change `FIXED_BY_FLOW` → `OBSERVED`). **Do not carry the square identity on `shape`** unless that axis is deliberately made observable (see 4A.3). |
| **Free Cooking** (`resolveFreeCookPizza`) | Identity comes from the signature, not the recipe; a match is then scored as that recipe by the unchanged `REGISTER_TO_DEX` path. Pan as an observed signature axis needs no change to this flow. | Yes. |
| **Research** | A Research round is a Free Cook round with a target; ○× is per ingredient and says nothing about pan. A pan is not an ingredient, so Research RESULT discloses nothing about it. | Yes. Dead-end risk handled by 4A.5. |
| **Recipe Select / guided rounds** (`FREE_GUIDED`) | Technique runtime: guided rounds take the *recipe path only*. The recipe fixes its own pan; no control is shown. | Yes. |
| **Lunch Rush / Dinner** | `techniqueRoundEligibility` = `NONE`; grandma is `lunchRush:false`. The pan control must be hidden there. Dinner result detection runs the matcher on the composition → verify no pan leak (test in the technique PR). | Yes, with test. |
| **Technique system** (OD-TQ-1/4/5/6/7, P6, INV-TQ-1/4/6, INV-TQ-NB) | Techniques are discovered by doing, never bought, no ★/Pitz, name hidden until discovered, the **operation is possible before discovery** (e.g. SAUCE "なしでもOK"), a fixed riddle appears in the Dex only after the **affordance** opens. The affordance step is **derived** (first ladder step at which a recipe requiring the technique is makeable) and a technique no recipe uses never opens (INV-TQ-4). The matcher never imports techniques (INV-TQ-NB). | **Yes — pan is a natural second technique.** Needs: `TechniqueId` extension, `requiredTechniquesOf` to read the pan axis, detection from the signature, Dex 調理法 row, RESULT technique stage. The matcher still reads only the signature, so INV-TQ-NB holds. |
| **Open authority** | `OD-CS-16` ("pan as a tool item / recipe-fixed"; Shop / #216) and `OD-CS-18` ("are pan/shape/enclose techniques?") are **undecided** in the Post-W1 design. Option 4 effectively answers OD-CS-18 = "pan is a technique" and sets aside the Shop-tool form of OD-CS-16. | **Needs Owner decision O-1.** |
| **Save** | `discoveredTechniqueIds` is already persisted (v2, no schema bump); unknown ids from a newer build are preserved by `writeSave`; the in-progress `PizzaState` is not saved. A new technique id is additive. | **Yes, no schema bump.** Round-trip test required (old save → new build, new save → old build). |
| **Scoring 2.0** | Formulas unchanged (D4). A Reference region per **cooked** shape is a new *input*, not a new formula. Because identity requires the pan, a matched pizza always has the recipe's own shape, so there is no "played round vs. square Reference" mismatch. | Yes. |
| **Hint 5.0 / Anti-Oracle** | Hint rungs name ingredients, never techniques (OD-TQ-6). Near/Far hints are neutralised to one generic line. Nothing in a hint may mention the pan. | Yes; DH4 privacy gates must be re-run deliberately. |
| **Dough model / CUT / sauce** | Same as Fresh Audit (square grid model, shape interface, CUT disabled for square). | Same work as Option 1. |

### 4A.3 Conditions under which grandma-pizza's identity holds on first discovery

All must be true for `UNIQUE_MATCH` → `NEW_DISCOVERY` (then the recipe's own Completion Gate under the "recipe" policy):

1. Ingredient set is exactly `{garlic, mozzarella, olive-oil, tomato-sauce}`; the sauce base is exactly `{olive-oil, tomato-sauce}` (both painted; garlic and mozzarella as pieces). Presence-only, as today.
2. `pan` axis equals the grandma target's declared value (the square pan). **The value's name/ID is an implementation detail for A/E, not decided here.**
3. Every other axis is its default (dough standard, layerOrder standard, late/prep empty, enclosure null, cook bake, laminate false, spreadLayers null — as Design Lock §5.2/§6 already assumes).
4. `shape` stays at the default for matching. It is `UNAVAILABLE`, so a target declaring `shape: "square"` would be **unmatchable** by rule 3. Two ways out, decision O-3: (a) keep identity on `pan` only and leave `shape` default for grandma (smallest change; deviates from the 172 matrix vocabulary where square-pan rows also say `shape: square`), or (b) make `shape` observable from `panShape` (a deliberate matcher/signature change, all existing goldens must stay identical).
5. The DOUGH step is complete under C's predicate (it gates "次へ"); the sauce/Completion Gate/bake window conditions are the recipe's.
6. **Not** identity: thickness evenness, corner-reach values, dough radii, CUT, piece positions, sauce amounts (quality inputs only — D4).
7. Collision check on the 172 matrix: grandma is the only row with this ingredient set (computed), so no `AMBIGUOUS` with a blocked row. The matrix itself still lists grandma with `pan: null, shape: round`; the catalog target in E will carry the new pan value (the matrix and Design Lock text are not rewritten here).

### 4A.4 Does a round dough misdiscover grandma?
No — **if the pan is part of grandma's identity** (recommended). A round-dough pizza with the same ingredients has `pan = null` ≠ grandma's value → `NO_MATCH` → an ordinary ORIGINAL pizza. That is also what enforces D3 (no round grandma). If the pan were *not* identity, the round pizza *would* discover grandma, which D3 forbids. Visible consequence to accept (O-2): **any** recipe's ingredients cooked on the square pan stop matching that recipe (e.g. margherita ingredients on the pan = ORIGINAL), because matching is exact on all axes. That is the existing identity design, but it is new to players who toggle the pan.

### 4A.5 Unlock condition — three options

| | **U1 — Technique affordance (derived)** | **U2 — Always available** | **U3 — Shop tool item** |
|---|---|---|---|
| Rule | The pan control appears in Free Cooking / Research when the **affordance** opens: the first ladder step at which a recipe requiring the pan is makeable (grandma: all four items unlocked = garlic, ladder step 14), counted by credited discoveries (OD-TQ1D-2). Derived, never an authored step. | Pan control visible from the first round. | Buy a "天板" item (OD-CS-16 form). |
| Matches existing authority | **Yes**: OD-TQ-1/4/5/6/7, INV-TQ-4, P6 (operation available, name hidden). Same pattern as no-sauce (opens at step 12). | Partly: P6 (operation before discovery) but not INV-TQ-4 (a control with no usable recipe for 13 steps). | **No**: a technique is never bought; conflicts with OD-TQ-1/7 and touches the #216 economy. |
| Anti-Oracle | The control appears at the moment grandma becomes makeable. Same accepted leak class as the no-sauce riddle (OD-TQ-5). Nothing names grandma. | The control exists for everyone → no timing signal; but it advertises "square things exist" to day-1 players. | Shop listing / price is a persistent, recipe-correlated signal. Worst. |
| Starter UX | No clutter before it matters. | Early clutter, pan useless until step 14. | Adds a purchase step; contradicts "no unnecessary waiting". |
| Dead-end risk | Dex 調理法 riddle opens with the affordance and hints without naming. | Same riddle can apply. | Players may buy it and still not know why. |
| Cost | Technique registry entry + `requiredTechniquesOf` reads pan axis + affordance wiring + Dex/RESULT rows. | Smallest (a toggle). | Economy, Shop, save entitlement. |
| **Recommendation** | **Recommended** | Acceptable fallback | Not recommended |

### 4A.6 UI route (where the player meets the pan) — three options

| | **P1 — Shape toggle in the Free Cooking DOUGH step** | **P2 — Choice before the round starts** | **P3 — Physical tray object beside the stage** |
|---|---|---|---|
| Idea | A small neutral control at the DOUGH step: ○ / □ ("生地のかたち", icon-first, no recipe or technique name). Default ○. Switching is allowed until "次へ"; both dough models are kept in state so nothing is lost. | Pick ○/□ on the start screen of a Free Cooking / Research round. | An unlabeled tray icon at the stage edge; tapping it puts the dough on the tray. |
| Matches "edit until next step" (Owner) | **Yes, directly** | Weaker: the choice is made before any dough | Yes |
| Discoverability | High: sits where the action is, at the moment of shaping | Medium: the player decides before understanding | Medium: icon may be mistaken for decoration |
| Anti-Oracle | Generic icon, shown only after the affordance (U1). No name. | Same | Same; icon shape (a tray) is more specific |
| Cost | Low–medium; one control + state | Medium; changes round-start flow | Medium–high; art + gesture + a11y |
| 360×800 | Control fits the existing step bar; ≥ 44 px target | Start screen already dense | Competes with the stage |
| **Recommendation** | **Recommended** | Possible later | Not now |

### 4A.7 Option 1 vs. Option 4

| Criterion | Option 1 (round-first, reveal after identification) | Option 4 (pan as a general method) |
|---|---|---|
| First-discovery experience | Round dough; square only from the second time | **Square from the first discovery** (Owner's goal) |
| Implementation cost | A–D + a played-shape Reference resolver + Dex reveal copy; matcher/techniques untouched | A–D + **one extra slice F** (technique registry entry, pan axis OBSERVED + catalog target, `requiredTechniquesOf`, affordance, DOUGH control, Dex 調理法 row, RESULT technique stage, DH4 privacy gates) |
| Anti-Oracle | Strongest (no pre-discovery signal at all) | Same class as no-sauce: operation visible, name hidden, riddle after affordance. Accepted pattern; one extra leak: the control appears at ladder step 14 |
| Discovery experience | Grandma found by ingredients alone; then a "second reveal" | Found by ingredients **and** a cooking method — a real discovery; Research can still lead there via the riddle |
| Mis-discovery risk | A round pizza discovers grandma (the recipe's identity is shape-free) → D3 only enforced by data | None: round + same ingredients = ORIGINAL |
| Scoring | Needs Reference by *played* shape for round-discovered grandma | Reference follows the cooked (= recipe) shape; no mismatch case |
| Save compat | No change | Additive technique id; round-trip test; no schema bump |
| Behavior change for existing players | None | Pan toggle appears at the affordance step; recipes cooked on the pan don't match unless pan-recipes |
| Risk | Low | Medium: touches the identity axes and technique contract (both gated by existing tests, which must be changed deliberately) |

### 4A.8 Recommendation
Adopt **Option 4**, built as: technique `square-pan`-class (name/riddle copy Owner-approved, placeholders only until then) + **U1** derived affordance + **P1** DOUGH-step shape toggle + pan as a **signature identity axis** (`pan` OBSERVED) with grandma's catalog target declaring it.
Conditions: O-1, O-2, O-3 below. If any is refused, fall back to Option 1 (no matcher/technique change) — it remains fully implementable with the same A–D.

### 4A.9 Issue and PR impact (proposal; no new Issue created yet)
- **A–D (#534–#537)** are unchanged in scope; D's "pre-discovery surfaces shape-neutral" item now refers to §4A (no square thumbnail for an undiscovered recipe).
- **New slice F** (conditional on adoption, between D and E): technique entry + pan axis + affordance + DOUGH control + Dex/RESULT technique rows + privacy gates; HV required; depends on A and C.
- **E (#521)** additionally depends on F; it declares grandma's `pan` identity in the catalog. DH4 allowlist and count-pinned tests still belong to E.
- Epic #532 is updated to show F as *proposed, not created*.
- #474 / #518 / #429 interactions unchanged. Additional conflict: the technique registry / Dex 調理法 / RESULT technique stage touch files that no open PR is changing (to be re-checked at F start).

### 4A.10 Required Owner decisions for Option 4 (all decided on 2026-10-17 — see §2 and §4B; kept as the question record)
- **O-1** Pan is a technique (resolves `OD-CS-18`), not a Shop tool item (sets aside the tool form of `OD-CS-16`).
- **O-2** Accept that recipes cooked on the pan do not match non-pan recipes (exact identity).
- **O-3** Identity carrier: `pan` axis only (leave `shape` default) vs. also make `shape` observable.
- **O-4** Unlock rule: U1 (recommended) / U2 / U3.
- **O-5** UI route: P1 (recommended) / P2 / P3.
- **O-6** Technique name and Dex riddle copy (Owner-written; none proposed as final).
- **O-7** Editing rule: finished dough is editable until "次へ" — accept that "次へ" locks the shape for the round.
- (Existing Design Lock §8 items remain open — D7.)


## 4B. Confirmed spec after O-1…O-7 (Option 4)

### 4B.1 What is fixed
- Technique 「天板焼き」 (internal ID chosen in F), registered in `data/techniques.ts`; name and description shown only after discovery. Copy: see O-6.
- Identity = `pan` axis only (`FIXED_BY_FLOW` → `OBSERVED` from `panShape`); `shape` axis untouched. This deviates from the 172-matrix vocabulary (square-pan rows also say `shape: square`) **on purpose**; the matrix and Design Lock text are not rewritten.
- Unlock U1: the affordance step is derived by `techniqueAffordanceStep` from the required recipe's ingredients; never hard-coded. Expected value for grandma is step 14 (garlic) per Design Lock §1; **F re-derives it**, and its tests assert the derivation, not the number. `ladderCredit:false` recipes are not counted (OD-TQ1D-2). With no requiring recipe in the catalog, the affordance never opens (INV-TQ-4) → F is inert in Production until E.
- UI route P1: ○ / □ switch in the DOUGH step of Free Cooking / Research, hidden before the affordance, hidden in guided rounds (recipe-fixed), Lunch Rush and Dinner. Both dough states (radial and square-grid) are kept so switching loses nothing. 「次へ」 fixes the shape.
- Pan-cooked RESULT shows the actually cooked shape (pizza + pan); scoring uses the Reference region of the cooked shape (formulas unchanged, D4). Because identity requires the pan, a matched pizza always has the recipe's own shape.

### 4B.2 O-2 — RESULT route and its Anti-Oracle acceptance conditions
Goal: a player whose pizza was ORIGINAL *because of the pan* should be able to understand "the shape matters", without RESULT acting as a recipe oracle.

Learning paths (in order):
1. **First completed pan pizza** (affordance open): the existing RESULT technique stage reveals 「天板焼き」 with its description (usage path, INV-TQ-6). This names the method but no recipe.
2. **Dex 調理法 row**: before discovery, 「？？？」 plus the O-6 hint (only after the affordance); after discovery, the O-6 description.
3. **Later pan-cooked ORIGINAL pizzas**: RESULT may show one neutral shape line. Its copy is **not decided** (Owner approval needed; candidates only in F's PR).
4. **Round grandma ingredients** (the harder case): no RESULT line (a line would reveal that the ingredients are special). The route is the Dex hint, the visible ○ / □ switch, and the technique stage.

Acceptance conditions (copied into F #538):
- **AC-1** RESULT always shows the cooked shape for every outcome.
- **AC-2** The shape line's presence and wording are a function of (chosen pan, outcome class `ORIGINAL`) **only**. It never depends on whether the ingredient set matches, nearly matches or collides with any recipe, nor on any Research target (INV-4).
- **AC-3** Differential privacy test: with the same pan and outcome class, RESULT DOM for an ingredient set that *would* match a recipe under another shape is byte-identical to one that matches nothing.
- **AC-4** No recipe name, ingredient name, count, "あと少し", distance, similarity, or number of recipes that use the pan.
- **AC-5** Not shown for a round pizza (no pan-related text in round RESULT).
- **AC-6** Shown only when the affordance is open and the player used the pan.
- **AC-7** Research ○× stays ingredient-only and unaffected by the pan.
- **AC-8** Before the technique is discovered, no text names 「天板焼き」; after, the name appears only through the technique stage and the Dex.
- **AC-9** Dex silhouettes, Recipe Select thumbnails, Hint sheet, Research board and changelog stay shape-neutral for undiscovered recipes (sweep test).

### 4B.3 Conflict to confirm — riddle wording vs. OD-TQ-5/6
The existing rule says a technique's undiscovered riddle must not name the technique or **the concrete action** (`data/techniques.ts`, OD-TQ-5/6). The Owner-approved hint 「…四つの角まで生地を広げてみよう。」 contains a concrete action. It is adopted as written; F records it as an **explicit, Owner-approved exception limited to this technique** and updates the related assertion with the exception. F's first step asks the Owner for a one-line acknowledgement. This does not block Q0.

### 4B.4 Dependencies after the decisions
`Q0 (#533) → A (#534) → B (#535) → C (#536)`; `D (#537)` needs A and C; **`F (#538)` needs A and C**; **`E (#521)` after D and F**. F does not add any recipe; E is the only slice that makes the pan reachable in Production.

## 5. Acceptance criteria and verification (per Issue)

Common to every UI Issue: viewports 390×844 and 360×800; Playwright projects `iphone-390x844`, `iphone-360x800`, `webkit-390x844`, `webkit-360x800`; unit/typecheck/lint/build green; Codex review of the latest head; round pizza golden unchanged for all 57 recipes; no save-schema change; `TETO_HUMAN-VERIFICATION-POLICY.md` for UI changes (390×844 video to the Owner, not committed; before/after screenshots under `docs/reports/screenshots/<task>/`).

| Issue | Acceptance (summary — full lists are in the Issue bodies) | HV |
|---|---|---|
| #533 Q0 | addendum records D1–D7; §8 items unresolved; unverified source facts not asserted; options compared; diff is docs-only | none |
| #534 A | `panShape` field (no recipe set), shape interface with round = existing behavior, square cell-grid model + pure tests, circle-clip audit table, 57-recipe golden, no save change | none (no visible change) |
| #535 B | tap/long-press spreads thickness immediately; no confirm timer; no iOS selection/callout/zoom/scroll on WebKit; saturating coverage; cancel-safe; round branch untouched | required |
| #536 C | drag moves the edge toward corners; corner-reach + evenness visuals; completion = 4 corners ≥ 85% ∧ evenness ≥ threshold (constants isolated); generous zones, no pixel precision; no scoring change; no edge-swipe conflict | required |
| #537 D | sauce/toppings/cheese boundaries via shape; square sauce Reference; bake/RESULT/thumbnails square with pan; CUT disabled; pixel checks after CSS filters; 57-recipe golden; pre-discovery surfaces shape-neutral (§4) | required (D2) |
| #538 F | Technique 天板焼き registered; `pan` axis OBSERVED, `shape` UNAVAILABLE; U1 derived affordance (no hard-coded step); P1 ○/□ switch with re-edit until 「次へ」; Dex copy per O-6; RESULT shows cooked shape; AC-1…AC-9 (§4B.2); save round-trip; inert in Production until E | required (Owner device) |
| #521 E | recipe added only after A–D; `ladderCredit:false`, `lunchRush:false`, DH4 gate re-run, normal-flow E2E; Design Lock §8 answered by Owner | required |

Thresholds (85%, evenness) are **initial proposals**; final numbers come from Owner on-device HV on iPhone (D5).

## 6. Conflicts and dependencies

| Item | Overlap | Handling |
|---|---|---|
| #474 (round dough Human Feel 2.0) | `PizzaStage.tsx` DOUGH branch, `doughShape.ts`, `doughSizeStatus` | Square code in separate modules; no edits to round constants/predicates; B rebases after #474's implementation PR or only adds a branch. |
| #518 (FINISH D2-2) | `PizzaStage.tsx`, bake-filter CSS on `.pizza-dough` | D2 starts after #518 lands or does not touch those blocks; `finishD2Inert` guard stays green. |
| #429 / #467 (CUT) | circular CUT geometry | Grandma has no CUT; square disables CUT; #429 scope not widened. |
| #521 S3 / #527 | same append-only recipe files and count-pinned tests | Serial landing; #527 is not started here; S3 waits for A–D. |
| #33 | round dough contract | Unchanged. |
| #529 / #531 | WebKit 360×800 intermittent failures | Not masked; reported as unrelated when seen. |

## 7. Open items (unresolved — not decided by this addendum)

Design Lock §8 (still open, D7):
1. Live PIZZA DB check for grandma (ingredients; oil before/after bake; **pan form**) — blocks E.
2. `ladderCredit: false` (recommended) vs credited.
3. Hint 5.0 SAUCE rung naming both sauces.
4. Shipping a 2-sauce recipe before a multi-spread Technique (TQ-3).
5. S1's oil-over factor as a visible change in Free Cooking / Research (values reviewed on S1 screenshots).
6. id / name `grandma-pizza` / グランマピザ.
7. Sfincione stays on hold.
8. Two-different-base-sauce recipes remain "later candidates", none selected.

New, from this addendum:
9. ~~Anti-Oracle option~~ — **decided**: Option 4, O-1…O-7 (§2). Remaining sub-items: items 15–18 below.
10. (Option 1 only) First-discovery RESULT shows round-as-played or must show the pan? — moot under Option 4: RESULT shows the cooked shape.
11. Scoring: Reference resolved by the cooked shape, formulas unchanged — acceptable under D4? (Under Option 4 identity forces cooked shape = recipe shape.)
12. Final values for 85% corner reach and the evenness threshold — from Owner on-device HV (D5), not decided here.
13. Behavior when a completed square dough is edited again (undo/reshape allowed?).
14. Whether Detroit / Sicilian / other sheet-pan recipes are future users of `panShape` (no commitment; D1 only requires reuse-ready design).

15. Riddle wording exception to OD-TQ-5/6 (§4B.3): one-line Owner acknowledgement (asked in F).
16. Final copy of the neutral shape line in RESULT for pan-cooked ORIGINAL pizzas (§4B.2 item 3): Owner approval.
17. Internal technique ID and the pan value name (F / E).
18. Re-derive the affordance step (expected 14) at F implementation; if it differs, report before relying on it.

## 8. Out of scope here
No implementation, no recipe data, no `#521` S3, no `#527`, no Preview deployment, no merge.
