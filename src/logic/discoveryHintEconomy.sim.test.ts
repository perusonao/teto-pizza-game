import { describe, expect, it } from "vitest";
import {
  FREE_CURVE,
  HINT_PRICE_CURVES,
  PROFILES,
  simulateHintEconomy,
  type ProfileId,
  type SimResult,
} from "./testSupport/discoveryHintEconomySim";
import { DISCOVERY_HINT_PRICES, discoveryHintPrice } from "./discovery/hintPurchase";
import { RECIPES } from "../data/recipes";

/**
 * Discovery Hint Economy 1.0 Fresh Audit (docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md):
 * the fresh-save -> Dex 25 hint-price simulation, test-only. It pins the audit's deadlock claims on
 * the real reducer; production has no hint purchases (the harness debits them itself).
 *
 * `HINT_ECONOMY_SIM_OUT=<path>` also runs the full quality matrix and writes every run as JSON (the
 * report's tables are generated from that file).
 */

// The walks end when every recipe is discovered, in any legal order, so their length is the
// population size. The production population is pinned once, explicitly, below.
const TOTAL = RECIPES.length;
const AVERAGE_QUALITY = 65; // ★3, earnedPitz 80
const QUALITIES = [80, 65, 30]; // ★4 (100), ★3 (80), ★1 (floor 20)

describe("Discovery Hint Economy 1.0: 25-recipe hint-price simulation (analysis harness)", () => {
  it("the production population is the 25-recipe W1 ladder + the non-credit calabresa + No.27 pesto-pollo + Expansion's pesto-gamberi (28)", () => {
    expect(TOTAL).toBe(31);
  });

  it("every price curve x player profile reaches Dex 26 without a hard deadlock (★3)", () => {
    for (const curve of [FREE_CURVE, ...HINT_PRICE_CURVES]) {
      for (const profile of PROFILES) {
        const r = simulateHintEconomy({ curve, profile, qualityTotal: AVERAGE_QUALITY });
        expect(r.completed, `${curve.id} ${profile}`).toBe(true);
        expect(r.hardDeadlock).toBe(false);
        expect(r.stages.map((x) => x.discovery)).toEqual(Array.from({ length: TOTAL }, (_, i) => i + 1));
        expect(new Set(r.stages.map((x) => x.recipe)).size).toBe(TOTAL);
        expect(r.minPitz).toBeGreaterThanOrEqual(0);
        // Dex 0 (Margherita onboarding) is free under the proposal: nothing is spent before it.
        expect(r.stages[0]).toMatchObject({ recipe: "margherita", hintSpend: 0, unlockSpend: 0, refillSpend: 0 });
        if (profile === "P0") expect(r.totalHintSpend).toBe(0);
      }
    }
  }, 60_000);

  it("never spends a hint price the balance cannot pay (the harness never goes negative)", () => {
    const r = simulateHintEconomy({ curve: HINT_PRICE_CURVES[0], profile: "P4", qualityTotal: 30 });
    expect(r.completed).toBe(true);
    for (const stage of r.stages) expect(stage.minPitz).toBeGreaterThanOrEqual(0);
  }, 30_000);

  // Read through import.meta.env (Vitest exposes the process env there) so the app tsconfig needs no
  // Node types; node:fs is loaded only when the matrix is actually written.
  const out = (import.meta.env as Record<string, string | undefined>).HINT_ECONOMY_SIM_OUT;
  it.runIf(!!out)("writes the full matrix for the report", async () => {
    const runs: SimResult[] = [];
    const profiles: ProfileId[] = [...PROFILES, "L3"];
    for (const qualityTotal of QUALITIES) {
      for (const curve of [FREE_CURVE, ...HINT_PRICE_CURVES]) {
        for (const profile of profiles) runs.push(simulateHintEconomy({ curve, profile, qualityTotal }));
      }
    }
    for (const r of runs) expect(r.completed, `${r.qualityTotal} ${r.curve} ${r.profile}`).toBe(true);
    const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { writeFileSync(path: string, data: string): void };
    fs.writeFileSync(out!, JSON.stringify(runs, null, 1));
  }, 180_000);
});

/**
 * Discovery Hint Economy 1.0 (Issue #232), HE-2: the harness above priced hints itself; production
 * then had the real transaction. Since Discovery Hint 3.0 H3-3 (Issue #238) the runtime sells
 * Selectable Hint facts instead, so the "authority" walk pays each level through the Economy 1.0
 * authority (`purchaseDiscoveryHint`, still the legacy read model) with the sheet opened through the
 * real reducer; the Hint 3.0 runtime walk is src/state/discoveryHint.walk.test.ts.
 * Candidate B (OD-HE-1) must be exactly the Economy 1.0 price table, and a walk that pays every level
 * through that authority must give the same result, stage by stage, as the audit's simulated debit (both refilling an out-of-stock target before a hint, since
 * the real sheet shows REFILL for it -- the only way the two runs may differ is the transaction).
 */
describe("Discovery Hint Economy 1.0: harness <-> authority parity (Candidate B)", () => {
  const B = HINT_PRICE_CURVES.find((c) => c.id === "B")!;

  it("Candidate B is the production price table", () => {
    expect(B.prices).toEqual([1, 2, 3, 4].map(discoveryHintPrice));
    expect([1, 2, 3, 4].map((level) => DISCOVERY_HINT_PRICES[level as 1 | 2 | 3 | 4])).toEqual([...B.prices]);
  });

  it("every profile: the authority transaction gives the same walk as the simulated one (★3)", () => {
    for (const profile of PROFILES) {
      const simulated = simulateHintEconomy({ curve: B, profile, qualityTotal: AVERAGE_QUALITY, refillBeforeHint: true });
      const production = simulateHintEconomy({ curve: B, profile, qualityTotal: AVERAGE_QUALITY, transaction: "authority" });
      expect(production.completed, profile).toBe(true);
      expect(production.hardDeadlock).toBe(false);
      expect(production, profile).toEqual(simulated);
    }
  }, 120_000);

  // HE-5 Final Gate: the production walk for every profile at ★4 / ★3 / ★1 -- Dex 25, no hard
  // deadlock, Pitz never negative, and still identical to the simulated walk (price, transaction,
  // balance and refill-before-hint all agree). `HINT_ECONOMY_FINAL_OUT=<path>` writes the summary.
  it("HE-5: P0-P5 x ★4/★3/★1 reach Dex 25 through the Economy 1.0 authority with 0 hard deadlocks, in parity with the harness", async () => {
    const rows: Record<string, unknown>[] = [];
    for (const qualityTotal of QUALITIES) {
      for (const profile of PROFILES) {
        const production = simulateHintEconomy({ curve: B, profile, qualityTotal, transaction: "authority" });
        const simulated = simulateHintEconomy({ curve: B, profile, qualityTotal, refillBeforeHint: true });
        const where = `Q${qualityTotal} ${profile}`;
        expect(production.completed, where).toBe(true);
        expect(production.hardDeadlock, where).toBe(false);
        expect(production.stages.map((x) => x.discovery), where).toEqual(Array.from({ length: TOTAL }, (_, i) => i + 1));
        expect(production.minPitz, where).toBeGreaterThanOrEqual(0);
        expect(production.stages[0], where).toMatchObject({ recipe: "margherita", hintSpend: 0 });
        // Every hinted recipe is paid as a prefix sum of 5/10/20/40 (0, 5, 15, 35 or 75). The spend
        // is grouped by the HINTED recipe, not by the recipe discovered at that stage: with a
        // branching pool the player may find a different pool member than the one hinted, and the
        // levels already bought carry over to the stage where the hinted recipe is found.
        const spendByHinted = new Map<string, number>();
        for (const stage of production.stages.slice(1)) {
          spendByHinted.set(stage.hintTarget, (spendByHinted.get(stage.hintTarget) ?? 0) + stage.hintSpend);
        }
        for (const [hinted, spend] of spendByHinted) expect([0, 5, 15, 35, 75], `${where} ${hinted}`).toContain(spend);
        if (profile === "P0") expect(production.totalHintSpend, where).toBe(0);
        expect(production, where).toEqual(simulated);
        rows.push({
          quality: qualityTotal,
          profile,
          hintSpend: production.totalHintSpend,
          shopSpend: production.totalUnlockSpend + production.totalRefillSpend,
          earned: production.totalEarned,
          endingPitz: production.endingPitz,
          minPitz: production.minPitz,
          insufficient: production.insufficientHintAttempts,
          experimental: production.experimentalBakes,
          replays: production.grindBakes,
          totalBakes: production.experimentalBakes + production.grindBakes,
          hardDeadlock: production.hardDeadlock,
        });
      }
    }
    const finalOut = (import.meta.env as Record<string, string | undefined>).HINT_ECONOMY_FINAL_OUT;
    if (finalOut) {
      const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { writeFileSync(path: string, data: string): void };
      fs.writeFileSync(finalOut, JSON.stringify(rows, null, 1));
    }
  }, 600_000);
});
