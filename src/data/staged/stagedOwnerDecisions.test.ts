import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../ingredients";
import { pinsaEnabled } from "../pinsaGate";
import { RECIPES } from "../recipes";
import { IN_FLIGHT_RECIPE_IDS, type ShippedView } from "./stagedCatalog";
import { applyOwnerDecisions, D7_FIRST_CANDIDATES, promotableAfterDecisions, type DecisionStatus } from "./stagedOwnerDecisions";
import { STAGED_MECHANICS } from "./stagedMechanics";
import { rejudgeStaged, rejudgedDuplicateGate } from "./stagedRejudge";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

const SHIPPED: ShippedView = { recipes: RECIPES, ingredientIds: INGREDIENTS.map((i) => i.id) };
const STATUSES: DecisionStatus[] = ["RESOLVED", "WORK", "SOURCE_RESEARCH", "CANDIDATE_PENDING", "EXCEPTION_REVIEW", "WAITS_MECHANIC", "WAITS_IN_FLIGHT", "AXIS_WITH_M1", "STAGED_PAIR", "OWNER_DECISION"];

describe("Staged Catalog — Owner decisions D-1..D-7 (Issue #780, 2026-11-08)", () => {
  const judged = rejudgeStaged(SHIPPED);
  const r19 = JSON.parse(readFileSync(join(__dirname, "__golden__", "whatIf.research19.json"), "utf8")) as { culprits: string[] };
  const decisions = applyOwnerDecisions({
    recipes: STAGED_RECIPES,
    judged,
    researchCulprits: r19.culprits,
    takenRecipeIds: [...RECIPES.map((r) => r.id as string), ...STAGED_RECIPES.map((r) => r.id), ...Object.keys(IN_FLIGHT_RECIPE_IDS)],
  });

  it("changes no staged data and excludes nothing (D-1: no bulk exclusion)", () => {
    expect(STAGED_RECIPES).toHaveLength(82); // (Expansion Batch 21 shipped taco-pizza and okonomiyaki-style-pizza from the 84)
    expect(decisions).toHaveLength(82);
  });

  it("D-2 never turns an open sauce into NO_SAUCE; D-3 never confirms chili-oil; D-6 stops every causing recipe of the Research golden", () => {
    const all = decisions.flatMap((d) => d.deps);
    expect(all.filter((x) => x.kind === "OWNER_RULE" && x.id === "R-1" && x.status === "RESOLVED")).toEqual([]);
    expect(JSON.stringify(decisions)).not.toMatch(/chili-oil/);
    // The culprit set is measured (whatIf.research19.json) and grows when the shipped catalog changes (26 after Batch 19, PR #783).
    expect(decisions.filter((d) => d.researchBlocked).map((d) => d.id).sort()).toEqual([...r19.culprits].sort());
  });

  it("D-7 candidates were the first promotion (Expansion Batch 21 shipped them): they are no longer staged, and the remaining promotable ones are measured below", () => {
    const { ready } = promotableAfterDecisions(decisions);
    for (const id of D7_FIRST_CANDIDATES) {
      expect(ready).not.toContain(id);
      expect(decisions.some((d) => d.id === id)).toBe(false);
    }
  });

  it.skipIf(!pinsaEnabled())("measured: remaining dependencies, additional decisions, next promotable, and the D-1 per-recipe dossier (golden)", async () => {
    const all = decisions.flatMap((d) => d.deps.map((x) => ({ recipe: d.id, ...x })));
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, all.filter((x) => x.status === s).length]));
    const byDecision = Object.fromEntries(["rule", "D-1", "D-2", "D-3", "D-4", "D-5"].map((k) => [k, all.filter((x) => x.by === k).length]));
    const open = all.filter((x) => x.status !== "RESOLVED");
    const { ready, readyWithWork } = promotableAfterDecisions(decisions);
    const blockedReadyOtherwise = decisions.filter((d) => d.researchBlocked && d.deps.every((x) => x.status === "RESOLVED")).map((d) => d.id);
    // D-1 dossier: for each exception recipe, the shipped overlaps by kind and the process difference that could separate it.
    const newDup = rejudgedDuplicateGate(SHIPPED, judged);
    const trackOf = (k: string) => STAGED_MECHANICS.find((m) => m.key === k)?.track ?? "?";
    const dossier = decisions
      .filter((d) => d.deps.some((x) => x.status === "EXCEPTION_REVIEW"))
      .map((d) => {
        const r = STAGED_RECIPES.find((x) => x.id === d.id)!;
        const hits = newDup[d.id].filter((h) => !h.againstStaged);
        const byKind: Record<string, string[]> = {};
        for (const h of hits) (byKind[h.kind] ??= []).push(`${h.against}(${h.jaccard})`);
        const postBake = r.requiredIngredients.filter((q) => q.applicationPhase === "POST_BAKE").map((q) => q.ingredientId);
        const processDiff = [...r.mechanics.map((m) => `${m}(${trackOf(m)})`), ...(postBake.length ? [`POST_BAKE:${postBake.join("/")}`] : [])];
        return {
          id: d.id,
          shippedOverlaps: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.sort()])),
          processDifference: processDiff,
          judgementBasis: processDiff.length > 0 ? "PROCESS_DIFFERENCE_AVAILABLE" : "NO_PROCESS_DIFFERENCE",
          researchBlocked: d.researchBlocked,
        };
      });
    const report = {
      dependencies: all.length,
      byStatus,
      byDecision,
      remainingOpen: open.length,
      needsAdditionalOwnerDecision: {
        total: all.filter((x) => x.status === "OWNER_DECISION" || x.status === "EXCEPTION_REVIEW").length,
        perRecipeExceptions: all.filter((x) => x.status === "EXCEPTION_REVIEW").length,
        exceptionRecipes: dossier.length,
        other: all.filter((x) => x.status === "OWNER_DECISION").length,
      },
      needsResearchOrConfirmation: all.filter((x) => x.status === "SOURCE_RESEARCH" || x.status === "CANDIDATE_PENDING").length,
      nextPromotable: { ready, readyWithWork, researchBlockedButOtherwiseReady: blockedReadyOtherwise },
      d5PostBake: decisions.filter((d) => d.postBakeProposal.length > 0).map((d) => ({ id: d.id, postBake: d.postBakeProposal })),
      d4ProposedIds: decisions.filter((d) => d.proposedId).map((d) => `${d.id} -> ${d.proposedId}`),
      d1Dossier: {
        recipes: dossier.length,
        withProcessDifference: dossier.filter((x) => x.judgementBasis === "PROCESS_DIFFERENCE_AVAILABLE").length,
        withoutProcessDifference: dossier.filter((x) => x.judgementBasis === "NO_PROCESS_DIFFERENCE").length,
        alsoResearchBlocked: dossier.filter((x) => x.researchBlocked).length,
        rows: dossier,
      },
    };
    await expect(JSON.stringify(report, null, 1) + "\n").toMatchFileSnapshot("./__golden__/decisions.json");
  });
});
