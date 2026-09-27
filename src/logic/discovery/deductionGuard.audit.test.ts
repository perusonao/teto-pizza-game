import { describe, expect, it } from "vitest";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { MIN_ATTRIBUTE_CANDIDATES } from "./deductionHint";
import { guardedAnswerForParts, partitionAllowsDh41, toppingClauseAllowedForParts } from "./deductionGuard";
import { inversionCandidates, observeDh41, observeGuarded, observeGuardedWithClause, partsOf, sweepStates } from "./testSupport/deductionInversion";

/**
 * Discovery Hint 4.0 DH4-2A (Issue #253), T-16: the 300-state privacy sweep, kept as a
 * machine-readable report (docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json). Any change to
 * the guard, TC-G, the taxonomy or the ladder shows up as a diff. Its summary equals the DH4-2 audit
 * JSON `finalGate.inventorySweep` (audit commit 2f0ffaa; tools/dh4_2_topping_count_audit.py).
 * Regenerate deliberately with `npx vitest run -u src/logic/discovery/deductionGuard.audit.test.ts`.
 */
describe("T-16 DH4-2A 300-state privacy sweep", () => {
  const rows = sweepStates(W1_25_DISCOVERY_LADDER).map((s) => {
    const parts = partsOf(s);
    const dh41 = inversionCandidates(parts, observeDh41);
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
  };

  it("matches the committed machine-readable report", async () => {
    await expect(`${JSON.stringify({ schema: "teto.discovery-hint-4.dh4-2a-audit.v1", summary, rows }, null, 1)}\n`).toMatchFileSnapshot(
      "../../../docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2A_AUDIT.json",
    );
  });

  it("equals the DH4-2 audit finalGate.inventorySweep (audit commit 2f0ffaa)", () => {
    expect(summary.states).toBe(300);
    expect(summary.dh41NameLeakStates).toBe(29);
    expect(summary.dh41NameLeakRecipes).toEqual(["bismarck", "breakfast-pizza", "funghi", "meat-lovers", "quattro-formaggi"]);
    expect(summary.guardedNameLeakStates).toBe(0);
    expect(summary.guardedWithClauseNameLeakStates).toBe(0);
    expect(summary.guardedLevels).toEqual({ existence: 144, category: 155, group: 1 });
  });
});
