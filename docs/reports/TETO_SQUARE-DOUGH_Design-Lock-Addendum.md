# Square-Pan Dough — Design Lock Addendum (Q0, proposal)

Status: **PROPOSAL for Owner approval. Docs-only.** No `src/**`, recipe, save, test or CSS change. Not merged, not deployed, no shared Preview touched.
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
| #521 | **E = S3** (grandma-pizza recipe). No new Issue. | A–D + Design Lock §8 answers |

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

Operation spec (Owner, first instruction): (1) tap / long-press spreads dough with a finger; (2) drag pulls the dough edge to the four corners; (3) corner reach and thickness evenness are shown visually; (4) pan, dough, sauce, toppings, bake and RESULT are consistent.

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

## 4. Anti-Oracle × discoverability — option comparison (decision needed)

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

## 5. Acceptance criteria and verification (per Issue)

Common to every UI Issue: viewports 390×844 and 360×800; Playwright projects `iphone-390x844`, `iphone-360x800`, `webkit-390x844`, `webkit-360x800`; unit/typecheck/lint/build green; Codex review of the latest head; round pizza golden unchanged for all 57 recipes; no save-schema change; `TETO_HUMAN-VERIFICATION-POLICY.md` for UI changes (390×844 video to the Owner, not committed; before/after screenshots under `docs/reports/screenshots/<task>/`).

| Issue | Acceptance (summary — full lists are in the Issue bodies) | HV |
|---|---|---|
| #533 Q0 | addendum records D1–D7; §8 items unresolved; unverified source facts not asserted; options compared; diff is docs-only | none |
| #534 A | `panShape` field (no recipe set), shape interface with round = existing behavior, square cell-grid model + pure tests, circle-clip audit table, 57-recipe golden, no save change | none (no visible change) |
| #535 B | tap/long-press spreads thickness immediately; no confirm timer; no iOS selection/callout/zoom/scroll on WebKit; saturating coverage; cancel-safe; round branch untouched | required |
| #536 C | drag moves the edge toward corners; corner-reach + evenness visuals; completion = 4 corners ≥ 85% ∧ evenness ≥ threshold (constants isolated); generous zones, no pixel precision; no scoring change; no edge-swipe conflict | required |
| #537 D | sauce/toppings/cheese boundaries via shape; square sauce Reference; bake/RESULT/thumbnails square with pan; CUT disabled; pixel checks after CSS filters; 57-recipe golden; pre-discovery surfaces shape-neutral (§4) | required (D2) |
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
9. **Anti-Oracle option** (§4): Option 1 / 2 (Option 3 is rejected). Blocks A's surface audit scope and D.
10. First-discovery RESULT shows round-as-played (Option 1) or must show the pan?
11. Scoring: Reference resolved by played pan shape — acceptable under D4?
12. Final values for 85% corner reach and the evenness threshold — from Owner on-device HV (D5), not decided here.
13. Behavior when a completed square dough is edited again (undo/reshape allowed?).
14. Whether Detroit / Sicilian / other sheet-pan recipes are future users of `panShape` (no commitment; D1 only requires reuse-ready design).

## 8. Out of scope here
No implementation, no recipe data, no `#521` S3, no `#527`, no Preview deployment, no merge.
