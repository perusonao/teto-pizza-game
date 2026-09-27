import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { MIN_ATTRIBUTE_CANDIDATES } from "./deductionHint";
import { guardedAnswerForParts, partitionAllowsDh41, toppingClauseAllowedForParts } from "./deductionGuard";
import { RECIPES } from "../../data/recipes";
import { dh42aHypotheses } from "./testSupport/deductionGuardDh42a";
import { attackStateOf, endgameAttack, type GuardUnderAttack } from "./testSupport/deductionAttacker";
import { inversionCandidates, observeDh41, observeGuarded, observeGuardedWithClause, partsOf, sweepStates } from "./testSupport/deductionInversion";

const HARDENED: GuardUnderAttack = { answer: guardedAnswerForParts, clauseAllowed: toppingClauseAllowedForParts };

/**
 * Discovery Hint 4.0 DH4-2A (Issue #253), T-16: the 300-state privacy sweep, kept as a
 * machine-readable report (docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json). Any change to
 * the guard, TC-G, the taxonomy or the ladder shows up as a diff. Regenerate deliberately with
 * `npx vitest run -u src/logic/discovery/deductionGuard.audit.test.ts`.
 *
 * DH4-2B Pre-Implementation Gate (Issue #253, P2-1 / P2-2): the guard was hardened (H without the
 * one-sauce prior, per-category partition classes, H-only TC-G). The DH4-1 rows are unchanged and
 * still equal the DH4-2 audit JSON `finalGate.inventorySweep` (audit commit 2f0ffaa); the guarded
 * rows now describe the hardened guard. The DH4-2A guard's own numbers (existence 144 · category
 * 155 · group 1; TC-G 156 states) are kept in the Gate report and in `dh4_2aReference` below.
 */
describe("T-16 DH4-2A 300-state privacy sweep", () => {
  const rows = sweepStates(W1_25_DISCOVERY_LADDER).map((s) => {
    const parts = partsOf(s);
    // The DH4-1 rows keep the DH4-2 audit's player model (2f0ffaa), so they stay comparable.
    const dh41 = inversionCandidates(parts, observeDh41, dh42aHypotheses);
    return {
      recipeId: s.recipeId,
      targetIndex: s.targetIndex,
      ladderStep: s.step,
      dh41Answer: observeDh41(parts),
      dh41NamedReserve: dh41.length < MIN_ATTRIBUTE_CANDIDATES ? dh41 : null,
      guardBranch: partitionAllowsDh41(parts) ? "dh41" : "strict",
      guardedAnswer: guardedAnswerForParts(parts)!.factId,
      guardedInversionCandidates: inversionCandidates(parts, observeGuarded).length,
      guardedWithClauseInversionCandidates: inversionCandidates(parts, observeGuardedWithClause).length,
      toppingClauseAllowed: toppingClauseAllowedForParts(parts),
      independentAttackerLeaks: endgameAttack(HARDENED, attackStateOf(RECIPES.find((r) => r.id === s.recipeId)!, parts.reserveId, s.owned))
        .filter((r) => r.leak)
        .map((r) => r.prior),
    };
  });
  const count = <T,>(values: T[]) => {
    const out: Record<string, number> = {};
    for (const v of values) out[String(v)] = (out[String(v)] ?? 0) + 1;
    return out;
  };
  const summary = {
    states: rows.length,
    dh41NameLeakStates: rows.filter((r) => r.dh41NamedReserve).length,
    dh41NameLeakRecipes: [...new Set(rows.filter((r) => r.dh41NamedReserve).map((r) => r.recipeId))].sort(),
    guardedNameLeakStates: rows.filter((r) => r.guardedInversionCandidates < MIN_ATTRIBUTE_CANDIDATES).length,
    guardedWithClauseNameLeakStates: rows.filter((r) => r.guardedWithClauseInversionCandidates < MIN_ATTRIBUTE_CANDIDATES).length,
    guardedLevels: count(rows.map((r) => r.guardedAnswer.split(":")[1])),
    guardBranches: count(rows.map((r) => r.guardBranch)),
    toppingClauseAllowedStates: rows.filter((r) => r.toppingClauseAllowed).length,
    independentAttackerLeakStates: rows.filter((r) => r.independentAttackerLeaks.length > 0).length,
  };
  const dh4_2aReference = { guardedLevels: { existence: 144, category: 155, group: 1 }, toppingClauseAllowedStates: 156, auditCommit: "2f0ffaa" };

  it("matches the committed machine-readable report", async () => {
    await expect(`${JSON.stringify({ schema: "teto.discovery-hint-4.dh4-2a-audit.v2", summary, dh4_2aReference, rows }, null, 1)}\n`).toMatchFileSnapshot(
      "../../../docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json",
    );
  });

  it("DH4-1 rows equal the DH4-2 audit finalGate.inventorySweep (audit commit 2f0ffaa); the hardened guard leaks 0", () => {
    expect(summary.states).toBe(300);
    expect(summary.dh41NameLeakStates).toBe(29);
    expect(summary.dh41NameLeakRecipes).toEqual(["bismarck", "breakfast-pizza", "funghi", "meat-lovers", "quattro-formaggi"]);
    expect(summary.guardedNameLeakStates).toBe(0);
    expect(summary.guardedWithClauseNameLeakStates).toBe(0);
    expect(summary.independentAttackerLeakStates).toBe(0);
    expect(summary.guardedLevels).toEqual({ existence: 123, category: 164, group: 13 });
    expect(summary.toppingClauseAllowedStates).toBe(177);
  });
});
