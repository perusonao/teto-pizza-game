import { describe, expect, it, vi } from "vitest";

/**
 * Fresh Authority Audit of the "★3-FULL replay <= 1" criterion: decomposes the Margherita replays of the attempt-aware
 * walk by counterfactual refund of one spending class (harness ablation only; no economy change). Writes JSON when
 * `RESEARCH_REPLAY_AUDIT_OUT=<path>` is set. Asserts only structural facts.
 */
vi.mock("./discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));

const { simulateResearchAttempts } = await import("./testSupport/researchAttemptSim");
const { packQuantity, MATERIAL_PRICE_TIERS, priceTierForStep, materialLadderStep, materialK } = await import("./materialShop");
const { INGREDIENTS } = await import("../data/ingredients");

const ABLATIONS = {
  base: {},
  refundRefill: { refill: true },
  refundHints: { hints: true },
  refundUnlock: { unlock: true },
  refundRefillHints: { refill: true, hints: true },
  refundAll: { refill: true, hints: true, unlock: true },
} as const;

describe("★3 replay decomposition (analysis only)", () => {
  it("runs the ablations and checks the structural facts", async () => {
    const out: Record<string, unknown> = {};
    for (const explorePieces of ["FULL", "ONE"] as const) {
      for (const profile of ["NONE", "FIXED4", "FULL"] as const) {
        for (const [name, refund] of Object.entries(ABLATIONS)) {
          const r = simulateResearchAttempts({ profile, qualityTotal: 65, explorePieces, refund });
          expect(r.completed).toBe(true);
          expect(r.violations).toEqual([]);
          out[`${explorePieces}|${profile}|${name}`] = {
            grind: r.grindBakes,
            attempts: r.totalAttempts,
            stages: r.stages.map((s) => ({
              d: s.discovery, rec: s.discovered[0], att: s.attempts, grind: s.grindBakes, grindEarned: s.grindEarned,
              hint: s.hintSpend, unlock: s.unlockSpend, refill: s.refillSpend, refillMember: s.refillMemberSpend,
              refillNonMember: s.refillNonMemberSpend, refillN: s.refillCount, stockout: s.stockoutRefills,
              before: s.pitzBefore, after: s.pitzAfter, reward: s.discoveryReward,
            })),
          };
        }
      }
    }
    const shop = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => {
      const step = materialLadderStep(i.id);
      const tier = step === null ? null : priceTierForStep(step);
      return { id: i.id, category: i.category, k: materialK(i.id), pack: packQuantity(i.id), step, packPrice: tier?.packPrice ?? null, refillPrice: tier?.refillPrice ?? null };
    });
    out.shop = shop;
    out.tiers = MATERIAL_PRICE_TIERS;
    const path = (import.meta.env as Record<string, string | undefined>).RESEARCH_REPLAY_AUDIT_OUT;
    if (path) {
      const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { writeFileSync(p: string, d: string): void };
      fs.writeFileSync(path, JSON.stringify(out, null, 1));
    }
    // Structural: refunding every spending class leaves no replay (income alone is never short).
    expect((out["FULL|FULL|refundAll"] as { grind: number }).grind).toBe(0);
  }, 600_000);
});
