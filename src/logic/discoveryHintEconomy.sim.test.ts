import { describe, expect, it } from "vitest";
import {
  FREE_CURVE,
  HINT_PRICE_CURVES,
  PROFILES,
  simulateHintEconomy,
  type ProfileId,
  type SimResult,
} from "./testSupport/discoveryHintEconomySim";

/**
 * Discovery Hint Economy 1.0 Fresh Audit (docs/reports/TETO_DISCOVERY-HINT-ECONOMY-1_FRESH-AUDIT.md):
 * the fresh-save -> Dex 25 hint-price simulation, test-only. It pins the audit's deadlock claims on
 * the real reducer; production has no hint purchases (the harness debits them itself).
 *
 * `HINT_ECONOMY_SIM_OUT=<path>` also runs the full quality matrix and writes every run as JSON (the
 * report's tables are generated from that file).
 */

const AVERAGE_QUALITY = 65; // ★3, earnedPitz 80
const QUALITIES = [80, 65, 30]; // ★4 (100), ★3 (80), ★1 (floor 20)

describe("Discovery Hint Economy 1.0: 25-recipe hint-price simulation (analysis harness)", () => {
  it("every price curve x player profile reaches Dex 25 without a hard deadlock (★3)", () => {
    for (const curve of [FREE_CURVE, ...HINT_PRICE_CURVES]) {
      for (const profile of PROFILES) {
        const r = simulateHintEconomy({ curve, profile, qualityTotal: AVERAGE_QUALITY });
        expect(r.completed, `${curve.id} ${profile}`).toBe(true);
        expect(r.hardDeadlock).toBe(false);
        expect(r.stages.map((x) => x.discovery)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        expect(new Set(r.stages.map((x) => x.recipe)).size).toBe(25);
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
