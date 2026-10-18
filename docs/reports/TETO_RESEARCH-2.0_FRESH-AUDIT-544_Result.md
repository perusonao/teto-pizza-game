# Research 2.0 Fresh Audit (Issue #544) — Result and Owner decisions

Docs-only. Issue #544. No `src/**`, `e2e/**`, CSS, recipe, save or Preview change; no other lane's PR touched.
Base: `origin/main` `3c3c2da` (F1 #547). Audit comments: #544 `6247280796` (findings), `6247310535` (Owner decisions OD-544-1〜8).
Inputs: `TETO_RESEARCH-2.0_OWNER-DECISIONS.md`, `TETO_ANTI-ORACLE-CONTRACT_2.1.md`, `TETO_SQUARE-DOUGH_F_RESEARCH-AUDIT.md`, `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md`, `TETO_MULTI-SAUCE-RECIPES_Design-Lock.md`, PR #548 (F2, read from its diff only), held PR #540 (not on main).

## 1. Method and its limits
- Cohort letters were computed by running the production `researchCohortLetters` over the production catalog (57 recipes) and `DISCOVERY_LADDER` (53 steps, 61 materials), plus a **synthetic** `grandma-pizza` (tomato-sauce / olive-oil / mozzarella / garlic) because the real recipe is not on main.
- Purchase-order sweep: 2000 random orders (some with long purchase delays), every prefix checked (about 1.05 million checks). The probe tests were temporary and are not committed.
- Not run: the full Vitest / Playwright suites, and any E2E. The E2E list in §4 comes from a static grep, not from execution.

## 2. Findings
| Area | Result |
|---|---|
| Existing saves | No migration: Research entries derive from ownership + Dex. `discoveredTechniqueIds` gains `tray` additively; an older build keeps unknown ids. |
| Cohort letters, production catalog | 5 of 57 recipes carry a letter (onion: aussie A / brazilian-calabresa B / pizza-portuguesa C; zucchini: ratatouille-pizza A / pesto-vegetariana B). 53 of 57 recipes have a unique unlock material. |
| With a synthetic grandma | garlic cohort becomes marinara A / grandma-pizza B (consistent with #543 R6 hash values). The 5 existing letters do not change. |
| Stability within one save | 0 letter changes or drops across the whole sweep (append-only ownership). |
| Dependence on purchase order | The unlock material is the one **the player acquired last**, so players who buy out of ladder order get different cohorts and letters. Within one save it is deterministic. Recorded as OD-544-4. |
| Technique state vs Research | The candidate list, labels, Hint 5.0, Notebook and Board do not depend on Technique state. `researchEntry` does not import `techniques/*`. |
| Validator | `COHORT_LETTER_SHIFT` / `COHORT_UNLOCK` already exist (`recipeBatchValidator.ts`). What is missing is the explicit allowlist (OD-544-6). |
| Anti-Oracle §15 | **Not recomputed.** Required before E's Final Gate (OD-544-8). |

## 3. Owner decisions (2026-10-18)
| ID | Decision |
|---|---|
| OD-544-1 | `PAN_TRAY_RECIPE_IDS` becomes one shared constant. |
| OD-544-2 | The Hint 5.0 multi-source exception and the INV-TQ-4 allowlist are limited to `grandma-pizza`. |
| OD-544-3 | Design Lock §8-3 is formally approved: the grandma SAUCE rung names both tomato sauce and olive oil. **Scoped to §8-3 and to `grandma-pizza`; it is not an approval of §8 as a whole.** |
| OD-544-4 | Research A/B/C is a display identifier that tells candidates apart, not a fixed ID shared by all players. |
| OD-544-5 | Letter changes when the candidate set changes are allowed. Non-deterministic variation for the same state is not. |
| OD-544-6 | Intentional Validator letter changes use an explicit allowlist. |
| OD-544-7 | The G2 shared line and a purchase-zero-to-all-purchased timing-parity test are acceptance criteria of F4. |
| OD-544-8 | Anti-Oracle §15 must be recomputed under the multi-source premise before E's Final Gate. |

Where each landed in this PR: OD-544-4 / 5 / 6 → `TETO_RESEARCH-2.0_OWNER-DECISIONS.md` §4.1; OD-544-8 → `TETO_ANTI-ORACLE-CONTRACT_2.1.md` §13.1 and §15 note; OD-544-3 → `TETO_MULTI-SAUCE-RECIPES_Design-Lock.md` (top note and §8 status table).

## 4. Hand-offs (not done in this PR)
| Item | Owner of the work | Notes |
|---|---|---|
| B1 shared `PAN_TRAY_RECIPE_IDS` | F2 (#538 / PR #548) before merge, or E's first commit | Today it is defined twice (`deductionProduction.gate.test.ts` module-level, `hint5Production.gate.test.ts` inside an `it`). This PR does not edit #548. |
| B2 `grandma-pizza`-only multi-source allowlist (G7 clause 2, INV-TQ-4) | E (#521) | Named constant, two-way equality, `GATE_STATES` gains pan ○ / □ states, swept state count in E's Result. |
| Validator allowlist | E (#521) | Implementation is E's. Candidates: `marinara` `-` → `A` (decided). `grandma-pizza` is a new recipe (a `COHORT_UNLOCK` matter, expected not to need an entry). **Batch 8 (#527) `brazilian-catupiry-corn-pizza` is provisional**: re-derive every affected existing recipe when the batch is fixed (a synthetic onion sibling moved pizza-portuguesa C → D in the audit). |
| G2 line + timing-parity test | F4 (#538) | **Not implemented.** The string 「材料だけでなく、生地の形や調理法も工夫してみよう。」 does not exist in `src` on main. |
| §15 recomputation | E (#521), before Final Gate | **Not done.** |
| B4: Technique copy is not derived from a recipe | F (with G2) | Pinned together with R11. |

### Existing E2E affected by E (static grep; verify by running after E)
- **Certain**: `e2e/discovery-research-dex.spec.ts:56` expects the bare `"？？？ピザ（にんにく）"`; with grandma it becomes `A` / `B` (derive the assignment from the hash order, R6).
- **Candidates** (assume exactly one entry at the garlic step when clicking `/^？？？ピザ（[^（）]+）を研究する$/`): `discovery-research-target.spec.ts:74,157`, `home-research-entry-parity.spec.ts:136`, `discovery-research-rows.spec.ts:49`, `research-failed-trial.spec.ts:48`, `expansion3-pesto-trapanese.spec.ts:80,83`.
- **Unlikely**: `research-stable-identity`, `discovery3-pool2-production`, `discovery-dex-aggregated`, `discovery-research-choice` (onion / zucchini cohorts).
- Unit / integration: HOME direct route, Pizza Select routing, Hint-sheet CHOOSE_RESEARCH (1 → 2 entries; #543 §4.2 estimated about 35 fixtures; E lists them per R9).

## 5. Open points and non-approvals
- Design Lock §8 other than 8-3: the table in the Design Lock records what #521 comment `6247267082` says; this PR does not approve them. **8-1 (live PIZZA DB check) is open and blocks E.**
- RESULT neutral line vs G2 line: #521 comment `6247267082` records the RESULT line as 「…見直してみよう。」 and the F audit §0.1-A fixes the Research G2 line as 「…工夫してみよう。」. Whether these are two surfaces with two wordings or one is **not decided here**; G2 is kept as in the F audit.
- Remaining blockers: B1, B2 (implementation), B5 / B4 (F4), §15 recomputation, Validator allowlist (E), §8-1 (Owner / E). None blocks #544 itself or the other lanes' merges (Owner decision 2026-10-18).
