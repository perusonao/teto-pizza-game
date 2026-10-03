# "★3-FULL replay ≤ 1" — Fresh Authority Audit (Contract 2.1 Gate C follow-up)

Audited `main`: `db6ed5a64cd4016870d5806653a009774aa4811d`. Docs + test-only harness extension. **No runtime, economy (refill price, pack size, Pitz), Gate criterion or Production flag change.** Production flag `RESEARCH_IDENTIFY_ENABLED` stays OFF. The Gate C verdict (READY = NO) is **not changed** by this audit.

## Verdict

**Classification B** — `≤ 1` is a number observed in the direct-bake (no exploration) Hint 5.0 economy walk and accepted by the Owner for that economy. No repo authority defines it as a threshold, a hard invariant or a Contract 2.1 / Research-attempt criterion. It is weaker than "a criterion": nothing in code, tests, CI or any decision doc asserts it. Whether Gate C may stay NO on this item alone is an **Owner Decision** (§7). Nothing here flips the Gate.

## 1. Origin audit

Searched `docs/ src/ tools/` (`★3-FULL`, `replay ≤/<= 1`, `FULL replay`, `replay requirement`, `economy gate`, `grind`, `OD-H5-ECON`) and git history.

| Source | Date | What it says |
|---|---|---|
| `docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md` (Economy 1.0) | 2026-09 | Defines **grind bakes = Margherita replays** as "the soft-friction metric". Hard deadlock impossible (§9.1). ★3 P0 needs 22 replays, ★3 P5 under curve A 44; ★1 P0 ~189 (OD-HE-10: tracked separately, out of scope). **No cap on replays.** |
| `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` §10 | 2026-09-28 | Pitz economy criterion (6): hint total as a share of one ★3 discovery (130); "max 195 > 130 = **deadlock risk**". The criterion is a *hint price vs reward* ratio, not a replay count. |
| `docs/reports/TETO_DISCOVERY-HINT-5_H5-4_Round6-Enablement_Result.md` §9 | 2026-09-29 | Findings: "★3 FULL now needs **1** Margherita replay, at the last stage (quattro-formaggi)" — an **observation**. |
| `docs/reports/TETO_DISCOVERY-HINT-5_Production-Activation-Gate.md` §5, §10 | 2026-09-29 | Table ★3 NONE/FIXED4/FULL = 0 / 0 / **1**. "The ★3 final-stage replay (**left as an Owner question; not adjusted**)": "**not a bug or a blocker**… no deadlock… one bake at the final stage only." Owner Question: accept as the intended economy? |
| same Gate §12.4; `…H5-5_Preview-Enablement_Result.md` | 2026-09-29 | "A ★3 player who buys every hint needs one Margherita replay at the last stage (**OD-H5-ECON-1 = ACCEPT**). The economy was not changed." |

Answers to the audit questions:
- **First introduced**: the Hint 5.0 H5-4 / Production Activation Gate reports (2026-09-29). The `replay` metric itself comes from Economy 1.0 (grind bakes).
- **What it was to prevent**: nothing. It reports how many extra bakes a ★3 player who buys every Hint 5.0 rung needs. The thing it was *about* (deadlock / unreachable progress) is covered separately as "no hard deadlock".
- **Player model**: `hint5EconomySim.ts` — "bakes the target directly (the player deduced it). There are **no experimental bakes**." Direct-bake: yes.
- **Research / discovery attempts**: not modelled. Contract 2.1 did not exist (Production Research ○× arrived with #363 on 2026-10-03).
- **Authority level**: an **Owner-accepted observation** (OD-H5-ECON-1 = ACCEPT). Not a MUST, not a threshold, not a provisional audit threshold. `hint5Economy.sim.test.ts` asserts completion, min Pitz ≥ 0, RESERVED = 0, price sets and full-ladder totals — **no replay assertion**; no CI check reads `grindBakes`.
- **Hard Production-activation invariant**: no. The Hint 5.0 activation Gate items AG-1…AG-15 contain no replay item; the 1 replay appears in §5 as information. (My Gate C report called it "a pre-existing Phase 2 check… the Hint 5.0 Activation Gate allows one". The check came from the Gate C task text; the Gate documents only report and accept the observation. See Erratum.)
- **Population note**: the "1" was measured on the 25-recipe walk. On current `main` (27 recipes) the same direct-bake walk gives ★3 FULL = **0** replays (ending Pitz 205).

## 2. Semantic audit — what the 3–8 replays are

A replay (Margherita bake) occurs **only when a Shop purchase (new material or refill) is unaffordable at that moment**. It is never a discovery attempt; an attempt earns no Pitz (an ORIGINAL attempt only burns stock). A replay recovers **+80 Pitz at ★3** (measured: 80 each, 8/8).

Walk: ★3, tray order, seed 0, Hint profile FULL; two exploration stock assumptions (FULL = unknown toppings at the pack unit, ONE = 1 piece).

| | FULL stock | ONE stock |
|---|---|---|
| research attempts (26 recipes) | 94 | 97 |
| **Margherita replays** | **8** | **3** |
| Pitz spend: Shop unlocks / refills / hints | 2,300 / 890 / 760 | 2,300 / 510 / 800 |
| refill events (of which "target not researchable" stock-outs) | 23 (14) | 13 (8) |
| refill Pitz on ingredients in the target recipe / not in it (test oracle) | 420 / 470 | 450 / 60 |
| discovery income (27 × 130, no replays) | 3,510 | 3,510 |
| spend − income before replays | **+440** | **+100** |
| minimum replays to cover that at 80 each | 6 | 2 |
| replays actually needed (cash-flow timing) | 8 | 3 |

Where they fall (FULL stock): d19 pesto-tonno 2, d21 new-haven 1, d22 pesto-caprese 2, d25 puttanesca 1, d26 quattro-formaggi 1, d27 pesto-pollo 1 — each in a stage where Shop unlock (100/200) + refills + hints exceed `balance + 130`. ONE stock: d25 1, d26 2 (unlock 200 + refill 70 + hint 10).

Counterfactual refunds (harness ablation only, ★3):

| Refund | FULL stock NONE / FIXED4 / FULL | ONE stock NONE / FIXED4 / FULL |
|---|---|---|
| none (base) | 7 / 6 / 8 | 0 / 1 / 3 |
| refills refunded | 0 / 0 / 0 | 0 / 0 / 0 |
| hints refunded | 7 / 0 / 0 | 0 / 0 / 0 |
| unlocks refunded | 0 / 0 / 0 | 0 / 0 / 0 |
| refills + hints refunded | 0 / 0 / 0 | 0 / 0 / 0 |
| all refunded | 0 / 0 / 0 | 0 / 0 / 0 |

Decomposition of the spend classes (the six requested categories):
- **Discovery attempts themselves**: 0 Pitz cost, 0 Pitz income. They matter only through stock burn.
- **Stock-out refills**: 14 (FULL) / 8 (ONE) events where the target was not researchable until a unit was refilled — these block research progress. The other refills (9 / 5) are planned top-ups for ingredients about to be placed.
- **Pitz-shortage replays**: all 8 / 3 by definition.
- **Hint purchases**: 760 / 800 Pitz. Hints alone do not cause replays (refunding refills removes all); with FIXED4/FULL, refunding hints alone also removes all — the cause is the **joint** budget (unlock + refill + hints > income), not one class.
- **Final successful build**: part of the attempts; pays the 130 reward; no separate cost.
- **Quality friction**: FULL profile, FULL stock: ★4 = 1, ★3 = 8, ★1 = 117 replays (a replay yields 80 Pitz at ★3 and 20 at ★1; the ★4 yield was not separately measured).

**What "8 replays" means.** Not "8 forced chores to escape a stuck state" — progress is never stuck (a replay is always available and Pitz never goes negative). It is the cash-flow result of the whole cycle: the same fixed 2,300 Pitz of Shop unlocks as before, plus ≈ 510–890 Pitz of refills that exploration now causes, plus hints, against 3,510 of discovery income — a net shortfall of 100–440 Pitz that is paid by 3–8 extra bakes. Every one of the replays exists only because exploration refills exist (refund refills → 0 in all six ★3 profiles).

## 3. Player-facing interpretation (extra bakes, no time model)

- **3 replays (ONE stock, FULL profile)**: 3 extra bakes (≈ 3 % on 98 attempts), all at Dex 25–26, +240 Pitz total: they pay mostly the 200 Pitz unlock of fontina + gorgonzola at the last step, together with a few refills (70–90).
- **8 replays (FULL stock, FULL profile)**: 8 extra bakes (≈ 8.4 % on 94 attempts; 103 bakes total), +640 Pitz, spread over the last 9 steps (Dex 19–27): refills (23 events, 890 Pitz) are the part that the direct-bake model did not have; unlocks (100–200) are the same as before.
- **One replay recovers**: +80 Pitz (★3) ≈ **2.05–2.1 refills** (average refill 38.7–39.2 Pitz; tiers 30/40/50/60).
- **One replay ≈ 8.5 research attempts of continuation** (FULL stock: 4.1 attempts per refill) / **≈ 15.4 attempts** (ONE stock: 7.5 attempts per refill), measured as attempts per refill event over the whole walk.
- **After one refill**: a pack is 10 pizza units (10 × k pieces); each exploration test places 1 unknown topping once per stage until resolved. FULL stock consumes k pieces → ~10 tests per pack; ONE consumes 1 piece → ~10 k tests. Measured walk-wide: 4.1 (FULL) / 7.5 (ONE) attempts per refill, because known-positive ingredients are placed at the full unit on every later attempt and the scan restarts with the whole pool for every new target.

## 4. Old vs new — apples to apples?

**No.**

| | Old (Activation Gate walk) | Contract 2.1 (Gate C walk) |
|---|---|---|
| Player | knows the answer, bakes the target (no experimental bakes) | scans the pool with ○× rows (94–137 research attempts) |
| Stock | each recipe baked once → first pack (10 units) never exhausted → refill spend 0 | ~13–41 refill events, 510–1,600 Pitz |
| Replay meaning | extra bakes to afford the **last Shop unlock** after buying every rung | extra bakes to cover unlocks + exploration refills + hints |
| Population | 25 recipes (today's 27-recipe direct-bake walk: 0) | 27 recipes |
| Authority | Owner-accepted observation | none for a threshold |

The repo's own **exploration-aware** precedent (Economy 1.0 audit) measured ★3 P0 = 22 and ★3 P5 = 44 replays and filed them as "soft friction", not as a failure; ★1 ≈ 189 was accepted as a pre-existing observation (OD-HE-10). So even within repo history a replay count above 1 was never treated as a gate. **No repo authority applies `≤ 1` to Contract 2.1.**

## 5. Classification

**B.** `≤ 1` is specific to the direct-bake Hint 5.0 walk and is an accepted observation (OD-H5-ECON-1), without Contract 2.1 application authority. Gate C is not changed by this audit; the Owner decides.

## 6. Report items

1. **Authority source**: Hint 5.0 H5-4 Result §9, Production Activation Gate §5 / §10 / §12.4, H5-5 Result (OD-H5-ECON-1 = ACCEPT); metric from Economy 1.0 Fresh Audit.
2. **Original purpose**: report the extra bakes a ★3 all-hints player needs; the safety question was "no deadlock", answered separately.
3. **Original player model**: direct bake of the known target, no exploration, `hint5EconomySim.ts`.
4. **Hard invariant?** No: an observation accepted by the Owner; no code / test / CI assertion.
5. **Contract 2.1 anticipated?** No (predates #363).
6. **Old replay meaning**: 1 bake at Dex 25 to afford the 200 Pitz fontina + gorgonzola unlock (0 on today's 27-recipe walk).
7. **New 3–8 replay meaning**: joint cash-flow shortfall of 100–440 Pitz (unlocks 2,300 + refills 510–890 + hints 760–800 vs 3,510 income) paid by extra bakes; all caused by exploration refills.
8. **Breakdown**: §2.
9. **Apples-to-apples**: **NO**.
10. **Deadlock**: unrelated. 0 deadlock; a replay is available at every point; replays are the recovery path, not a symptom of being stuck.
11. **Pitz recovery**: confirmed possible — every shortfall was closed by replays (+80 / bake at ★3); min Pitz never < 0.
12. **Inventory**: the driver. The scan restarts per target and consumes finite stock with no Pitz return; refills 13–41 events / 510–1,600 Pitz. Stock-out blocks research until refilled (14 / 8 events), then clears.
13. **Classification**: **B**.
14. **Recommended next Owner Decision**: choose one — (a) *re-base*: declare that the ★3-FULL replay criterion applies to Contract 2.1 with an explicit number the Owner sets (the audit cannot invent it); (b) *waive for this item*: accept replays caused by exploration refills as the intended Research economy (like OD-H5-ECON-1 for the last-stage replay), keeping the no-deadlock / Pitz-recovery / RESERVED = 0 checks as the hard ones; (c) *change the economy* (explicitly out of scope here). Useful inputs for the Owner: ★3 FULL replays 3–8 (up to 12 in the seed sweep); ★1 replays 64–117 vs 24–39 before; ONE-vs-FULL stock bracket depends on pieces per exploratory test, which is not observable here.
15. **Production flag**: OFF (`RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = false`, unchanged); Production activation not done.

## 7. Erratum for the Gate C report

`TETO_CONTRACT-2.1_ACTIVATION-GATE-C_Result.md` described "★3-FULL replay ≤ 1" as "a pre-existing Phase 2 check (Hint 5.0 Activation Gate)" and its Pitz-flow note used "rewards" that include Margherita-replay income (4,070 = 27 × 130 + 7 × 80 for ★3 NONE). Corrections: the Gate documents contain the *observation* and its acceptance, not a threshold; "discovery income" is 3,510. The criterion was in the Gate C task text, and the Gate C verdict is left as issued pending the Owner Decision above.

Reproduce: `RESEARCH_REPLAY_AUDIT_OUT=<path> npx vitest run src/logic/researchAttempt.replayAudit.test.ts` (≈ 5 s; harness refund options are analysis-only).
