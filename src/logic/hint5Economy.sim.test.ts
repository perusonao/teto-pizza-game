import { describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 5.0 (Issue #292), H5-2 / H5-4: the P-C economy re-run (OD-H5-E1), with the round-6
 * 「なし」 rungs (OD-H5-P4-CHEESE / P4b) charged. It runs the real reducer with the ladder flag mocked
 * ON (it is off in every build).
 *
 * `HINT5_ECONOMY_SIM_OUT=<path>` also writes every run as JSON. The H5-2 / H5-4 Result reports'
 * tables come from that file.
 */
vi.mock("./discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));

const { RECIPES, countsTowardLadder } = await import("../data/recipes");
const { hint5EmptyFixedRungs } = await import("./discovery/hint5Ladder");
const { selectableHintPriceCap } = await import("./discovery/selectableHint");
const { hint5LadderDesignTotal, hint5LadderTotalBeforeRound6, HINT5_PROFILES, simulateHint5Economy } = await import("./testSupport/hint5EconomySim");

const QUALITIES = [80, 65, 30]; // ★4 (100), ★3 (80), ★1 (floor 20)
// The walk ends when every recipe is discovered, in any legal order (see the harness), so its
// length is the population size. The production population is pinned once, explicitly, below.
const TOTAL = RECIPES.length;
/** Round 6: the targets whose empty CHEESE / KEY rung is now a paid 「なし」 answer. Computed on the
 *  design population (the 25 recipes with an authored P-C row, below); a key-free recipe has no empty
 *  rung at all, so it can never be one. */
const NONE_TARGETS_OF = (pop: readonly { id: string }[]) => new Set<string>(pop.filter((r) => hint5EmptyFixedRungs(r.id)!.length > 0).map((r) => r.id));

/** Final Design §10.1 (P-C column): the per-recipe totals predicted at H5-0, empty rungs excluded. */
const DESIGN_P_C: Record<string, number> = {
  margherita: 35, marinara: 30, "quattro-formaggi": 25, genovese: 35, bismarck: 35, funghi: 35, fugazza: 30, salsiccia: 35,
  pepperoni: 35, napoletana: 40, "tonno-e-cipolla": 40, "pizza-bianca": 25, "breakfast-pizza": 40, capricciosa: 50,
  "meat-lovers": 50, "melanzane-pizza": 40, "parmigiana-pizza": 40, bambino: 40, hawaiian: 40, "pizza-portuguesa": 50,
  "pesto-tonno": 35, "new-haven-apizza": 40, "pesto-caprese": 40, "pesto-patate": 40, "puttanesca-pizza": 40,
};
/** The H5-0 design population: the recipes the prediction above authored a total for. A recipe
 *  added later (e.g. a key-free one) is priced by the same rung rules but is outside the pinned
 *  910 / 970 sums, which describe this population. */
const DESIGN_POP = RECIPES.filter((r) => Object.prototype.hasOwnProperty.call(DESIGN_P_C, r.id));
const NON_ONBOARDING = DESIGN_POP.filter((r) => r.id !== "margherita");
const NONE_TARGETS = NONE_TARGETS_OF(DESIGN_POP);
/** Round 6 (H5-4): +10 on each of the 6 「なし」 targets. */
const ROUND6_P_C: Record<string, number> = Object.fromEntries(Object.entries(DESIGN_P_C).map(([id, v]) => [id, v + (NONE_TARGETS.has(id) ? 10 : 0)]));

describe("P-C static economy (the pure authority vs the H5-0 prediction, and round 6)", () => {
  it("H5-2 baseline: the totals before round 6 still match the Final Design §10.1 prediction (910 / 37.9 / 25-50)", () => {
    for (const r of DESIGN_POP) expect(hint5LadderTotalBeforeRound6(r.id), r.id).toBe(DESIGN_P_C[r.id]);
    const totals = NON_ONBOARDING.map((r) => hint5LadderTotalBeforeRound6(r.id));
    expect(totals.reduce((a, b) => a + b, 0)).toBe(910);
    expect(Math.min(...totals)).toBe(25);
    expect(Math.max(...totals)).toBe(50);
  });

  it("round 6: every recipe's full-ladder total is the H5-2 total + 10 on the 6 「なし」 targets (970 / 40.4 / 35-50)", () => {
    expect([...NONE_TARGETS].sort()).toEqual(["fugazza", "marinara", "pesto-tonno", "pizza-bianca", "puttanesca-pizza", "quattro-formaggi"]);
    for (const r of DESIGN_POP) expect(hint5LadderDesignTotal(r.id), r.id).toBe(ROUND6_P_C[r.id]);
    const totals = NON_ONBOARDING.map((r) => hint5LadderDesignTotal(r.id));
    expect(totals.reduce((a, b) => a + b, 0)).toBe(970);
    expect(Math.min(...totals)).toBe(35);
    expect(Math.max(...totals)).toBe(50);
    expect(Math.round((970 / 24) * 10) / 10).toBe(40.4);
  });

  it("OD-H5-E2 (no cap): only marinara and fugazza exceed their old 35 / 75 cap, by 5", () => {
    const over: Record<string, number> = {};
    for (const r of DESIGN_POP) {
      const cap = selectableHintPriceCap(r);
      expect([35, 75], r.id).toContain(cap);
      if (hint5LadderDesignTotal(r.id) > cap) over[r.id] = hint5LadderDesignTotal(r.id) - cap;
    }
    expect(over).toEqual({ fugazza: 5, marinara: 5 });
  });
});

describe("P-C pricing outside the design population", () => {
  it("a recipe without an authored P-C row is priced by the same rung prices, rung by rung", async () => {
    const { buildHint5Ladder, HINT5_RUNG_PRICE } = await import("./discovery/hint5Ladder");
    for (const r of RECIPES.filter((x) => !DESIGN_POP.includes(x))) {
      const rungs = buildHint5Ladder(r.id)!.rungs;
      expect(hint5LadderDesignTotal(r.id), r.id).toBe(rungs.reduce((sum, x) => sum + HINT5_RUNG_PRICE[x.kind], 0));
      expect(rungs.some((x) => x.subjectIds.length === 0 && x.kind !== "STRUCTURE"), `${r.id}: no empty rung`).toBe(false);
    }
  });
});

/** A stage's full-ladder total: the authored P-C row, else the pure authority's own total. */
const fullLadderTotal = (id: string) => ROUND6_P_C[id] ?? hint5LadderDesignTotal(id);

describe("P-C progression walk (real reducer, flag ON)", () => {
  it("the production population is the 25-recipe W1 ladder + the non-credit calabresa + No.27 pesto-pollo + Expansion's pesto-gamberi (28)", () => {
    expect(TOTAL).toBe(28);
  });

  it("every profile x quality reaches Dex 26 with no hard deadlock; charges are P-C prices only; no RESERVED stop", async () => {
    const runs = [];
    for (const qualityTotal of QUALITIES) {
      for (const profile of HINT5_PROFILES) {
        const r = simulateHint5Economy({ profile, qualityTotal });
        runs.push(r);
        expect(r.completed, `${profile} q${qualityTotal}`).toBe(true);
        expect(r.stages.map((x) => x.discovery)).toEqual(Array.from({ length: TOTAL }, (_, i) => i + 1));
        expect(r.minPitz).toBeGreaterThanOrEqual(0);
        expect(r.reservedStops, `${profile} q${qualityTotal}`).toBe(0);
        // Dex 0 (the Margherita onboarding) never uses the ladder.
        expect(r.stages[0]).toMatchObject({ recipe: "margherita", hintSpend: 0 });
        for (const st of r.stages) {
          for (const c of st.rungCharges) expect([5, 10], `${profile} ${st.recipe}`).toContain(c);
          expect(st.hintSpend).toBeLessThanOrEqual(fullLadderTotal(st.recipe));
        }
        if (profile === "NONE") expect(r.totalHintSpend).toBe(0);
        if (profile === "FULL" && r.insufficientHintAttempts === 0) {
          // A full ladder is bought for every target, the 「なし」 ones included.
          // The one stage with no hint target (PR-4b-B pool 2, D-1: the calabresa is found blind) buys nothing.
          for (const st of r.stages.slice(1)) {
            expect(st.hintSpend, st.recipe).toBe(countsTowardLadder(st.recipe) ? fullLadderTotal(st.recipe) : 0);
          }
        }
      }
    }
    // The same no-Node-types pattern as discoveryHintEconomy.sim.test.ts.
    const out = (import.meta.env as Record<string, string | undefined>).HINT5_ECONOMY_SIM_OUT;
    if (out) {
      const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { writeFileSync(path: string, data: string): void };
      fs.writeFileSync(out, JSON.stringify(runs, null, 1));
    }
  }, 120_000);
});
