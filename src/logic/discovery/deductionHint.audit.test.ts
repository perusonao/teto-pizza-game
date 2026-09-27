import { describe, expect, it } from "vitest";
import { MIN_ATTRIBUTE_CANDIDATES } from "./deductionHint";
import { W1_25_DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { buildDeductionAudit } from "./testSupport/deductionAudit";

/**
 * Discovery Hint 4.0 DH4-1 (Issue #253): the 25-recipe information audit is kept as a
 * machine-readable report and pinned here, so any change to the taxonomy, the candidate universe,
 * Rule W or the fallback shows up as a diff of docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json.
 * Regenerate deliberately with `npx vitest run -u src/logic/discovery/deductionHint.audit.test.ts`.
 */
describe("DH4-1 25-recipe information audit", () => {
  const audit = buildDeductionAudit(W1_25_DISCOVERY_LADDER);

  it("matches the committed machine-readable report", async () => {
    await expect(`${JSON.stringify(audit, null, 1)}\n`).toMatchFileSnapshot("../../../docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json");
  });

  it("no target's answer is name-equivalent at its ladder state; the attribute is always worth less than the name", () => {
    for (const row of audit.slice(1)) {
      const level = row.answer!.split(":")[1];
      if (level !== "existence") expect(row.candidatesOwned[level], row.recipeId).toBeGreaterThanOrEqual(MIN_ATTRIBUTE_CANDIDATES);
      expect(row.bits!.attribute, row.recipeId).toBeLessThan(row.bits!.material);
    }
  });
});
