import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../ingredients";
import { pinsaEnabled } from "../pinsaGate";
import { RECIPES } from "../recipes";
import { isBlocking, stagedDependencies, stagedDuplicateGate, type ShippedView } from "./stagedCatalog";
import { rejudgeStaged, rejudgedDuplicateGate, type Verdict } from "./stagedRejudge";
import { STAGED_MECHANICS } from "./stagedMechanics";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";

const SHIPPED: ShippedView = { recipes: RECIPES, ingredientIds: INGREDIENTS.map((i) => i.id) };
const VERDICTS: Verdict[] = ["AUTO_RESOLVED", "RULE_DECIDED_WORK", "DUPLICATE_COUNT", "WAITS_MECHANIC", "WAITS_IN_FLIGHT", "AXIS_CONDITIONAL", "STAGED_PAIR", "EXCEPTION_NEEDED", "OWNER_DECISION"];

describe("Staged Catalog — re-judgement under the provisional blanket rules (Issue #780, 2026-11-08)", () => {
  const judged = rejudgeStaged(SHIPPED);
  const all = judged.flatMap((j) => j.judged.map((d) => ({ recipe: j.id, ...d })));

  it("judges every blocking dependency of the E0 ledger exactly once, and changes no staged data", () => {
    const dup = stagedDuplicateGate(SHIPPED);
    const blocking = STAGED_RECIPES.reduce((n, r) => n + stagedDependencies(r, dup[r.id], undefined, SHIPPED.ingredientIds).filter(isBlocking).length, 0);
    expect(all).toHaveLength(blocking);
    expect(STAGED_RECIPES).toHaveLength(76); // (Expansion Batch 22, #780: six more shipped; Expansion Batch 21, #780: taco-pizza and okonomiyaki-style-pizza shipped; was 84)
  });

  it.skipIf(!pinsaEnabled())("measured verdicts, duplicate types, exceptions and the parallel mechanic plan (golden)", async () => {
    const count = (pred: (d: (typeof all)[number]) => boolean) => all.filter(pred).length;
    const byVerdict = Object.fromEntries(VERDICTS.map((v) => [v, count((d) => d.verdict === v)]));
    const byKind = Object.fromEntries(
      [...new Set(all.map((d) => d.kind))].sort().map((k) => [k, Object.fromEntries(VERDICTS.map((v) => [v, count((d) => d.kind === k && d.verdict === v)]).filter(([, n]) => (n as number) > 0))]),
    );
    const ownerRules = Object.fromEntries(
      ["R-1", "R-2", "R-3", "R-4", "R-5", "R-6", "R-7", "R-8"].map((r) => [r, Object.fromEntries(VERDICTS.map((v) => [v, count((d) => d.kind === "OWNER_RULE" && d.id === r && d.verdict === v)]).filter(([, n]) => (n as number) > 0))]),
    );
    // Duplicate gate, by type, after the proposals.
    const newDup = rejudgedDuplicateGate(SHIPPED, judged);
    const dupDeps = all.filter((d) => d.kind === "DUPLICATE_GATE");
    const dupByType = Object.fromEntries(
      [...new Set(dupDeps.map((d) => d.id))].sort().map((k) => [k, Object.fromEntries(VERDICTS.map((v) => [v, dupDeps.filter((d) => d.id === k && d.verdict === v).length]).filter(([, n]) => (n as number) > 0))]),
    );
    const exceptions = judged
      .filter((j) => j.judged.some((d) => d.verdict === "EXCEPTION_NEEDED"))
      .map((j) => ({
        id: j.id,
        shippedHits: newDup[j.id].filter((h) => !h.againstStaged).map((h) => `${h.kind}:${h.against}(${h.jaccard})`),
      }));
    const recipesFullyRuleResolvable = judged.filter((j) => j.judged.every((d) => d.verdict === "AUTO_RESOLVED" || d.verdict === "DUPLICATE_COUNT")).map((j) => j.id);
    const recipesNoOwnerDecisionLeft = judged
      .filter((j) => j.judged.every((d) => !["OWNER_DECISION", "EXCEPTION_NEEDED"].includes(d.verdict)))
      .map((j) => ({ id: j.id, waits: [...new Set(j.judged.filter((d) => !["AUTO_RESOLVED", "DUPLICATE_COUNT"].includes(d.verdict)).map((d) => (d.kind === "MECHANIC" ? `MECHANIC:${d.id}` : d.verdict)))].sort() }));
    // Mechanic tracks: recipes that wait ONLY on mechanics (no Owner decision / exception left), per track combination.
    const trackOf = (key: string) => STAGED_MECHANICS.find((m) => m.key === key)!.track;
    const mechanicWaits = Object.fromEntries(
      ["M1", "M2", "M3", "M4", "M5", "M6"].map((t) => [
        t,
        {
          recipesNeedingTrack: judged.filter((j) => j.judged.some((d) => d.verdict === "WAITS_MECHANIC" && trackOf(d.id) === t)).length,
          recipesUnblockedByThisTrackAlone: judged
            .filter((j) => {
              const mech = j.judged.filter((d) => d.verdict === "WAITS_MECHANIC");
              const otherOpen = j.judged.filter((d) => !["AUTO_RESOLVED", "DUPLICATE_COUNT", "WAITS_MECHANIC", "AXIS_CONDITIONAL", "STAGED_PAIR"].includes(d.verdict));
              return mech.length > 0 && mech.every((d) => trackOf(d.id) === t) && otherOpen.length === 0;
            })
            .map((j) => j.id),
        },
      ]),
    );
    const report = {
      blockingDependencies: all.length,
      byVerdict,
      autoResolved: byVerdict.AUTO_RESOLVED,
      byKind,
      ownerRules,
      duplicateGate: {
        dependencies: dupDeps.length,
        byType: dupByType,
        exceptionsNeeded: exceptions,
        // Each staged-vs-staged pair is seen from both sides; this is the number of distinct unordered pairs per kind.
        stagedUniquePairs: Object.fromEntries(
          ["IDENTICAL", "SUBSET_SUPERSET", "ONE_DIFF", "JACCARD_GT_0_4"].map((k) => [
            k,
            new Set(
              judged.flatMap((j) =>
                newDup[j.id]
                  .filter((h) => h.againstStaged && (k === "SUBSET_SUPERSET" ? h.kind === "SUBSET" || h.kind === "SUPERSET" : h.kind === k))
                  .map((h) => [j.id, h.against].sort().join("|")),
              ),
            ).size,
          ]),
        ),
        stagedPairsByRecipe: Object.fromEntries(judged.map((j) => [j.id, newDup[j.id].filter((h) => h.againstStaged).length]).filter(([, n]) => (n as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10)),
      },
      recipesFullyRuleResolvable,
      recipesNoOwnerDecisionLeft,
      mechanicWaits,
      perRecipe: judged.map((j) => ({ id: j.id, proposals: j.proposals, open: j.judged.filter((d) => d.verdict !== "AUTO_RESOLVED" && d.verdict !== "DUPLICATE_COUNT").map((d) => `${d.verdict}:${d.kind}:${d.id}`) })),
    };
    await expect(JSON.stringify(report, null, 1) + "\n").toMatchFileSnapshot("./__golden__/rejudge.json");
  });
});
