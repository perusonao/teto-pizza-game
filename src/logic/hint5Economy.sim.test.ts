import { describe, expect, it, vi } from "vitest";

/**
 * Discovery Hint 5.0 (Issue #292), H5-2: the P-C economy re-run (OD-H5-E1). It runs the real reducer
 * with the ladder flag mocked ON (it is off in every build).
 *
 * `HINT5_ECONOMY_SIM_OUT=<path>` also writes every run as JSON. The H5-2 Result report's tables come
 * from that file.
 */
vi.mock("./discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));

const { RECIPES } = await import("../data/recipes");
const { buildHint5Ladder, hint5EmptyFixedRungs, HINT5_RUNG_PRICE } = await import("./discovery/hint5Ladder");
const { selectableHintPriceCap, buildSelectableHintModel } = await import("./discovery/selectableHint");
const { hint5LadderDesignTotal, HINT5_PROFILES, simulateHint5Economy } = await import("./testSupport/hint5EconomySim");

const QUALITIES = [80, 65, 30]; // ★4 (100), ★3 (80), ★1 (floor 20)
const NON_ONBOARDING = RECIPES.filter((r) => r.id !== "margherita");
const P4_BLOCKED = new Set<string>(RECIPES.filter((r) => hint5EmptyFixedRungs(r.id)!.length > 0).map((r) => r.id));

/** Final Design §10.1 (P-C column): the per-recipe totals predicted at H5-0, empty rungs excluded. */
const DESIGN_P_C: Record<string, number> = {
  margherita: 35, marinara: 30, "quattro-formaggi": 25, genovese: 35, bismarck: 35, funghi: 35, fugazza: 30, salsiccia: 35,
  pepperoni: 35, napoletana: 40, "tonno-e-cipolla": 40, "pizza-bianca": 25, "breakfast-pizza": 40, capricciosa: 50,
  "meat-lovers": 50, "melanzane-pizza": 40, "parmigiana-pizza": 40, bambino: 40, hawaiian: 40, "pizza-portuguesa": 50,
  "pesto-tonno": 35, "new-haven-apizza": 40, "pesto-caprese": 40, "pesto-patate": 40, "puttanesca-pizza": 40,
};

describe("P-C static economy (the pure authority vs the H5-0 prediction)", () => {
  it("every recipe's full-ladder total matches the Final Design §10.1 prediction", () => {
    for (const r of RECIPES) expect(hint5LadderDesignTotal(r.id), r.id).toBe(DESIGN_P_C[r.id]);
    const totals = NON_ONBOARDING.map((r) => hint5LadderDesignTotal(r.id));
    expect(totals.reduce((a, b) => a + b, 0)).toBe(910);
    expect(Math.min(...totals)).toBe(25);
    expect(Math.max(...totals)).toBe(50);
    expect(Math.round((910 / 24) * 10) / 10).toBe(37.9);
  });

  it("every full ladder fits inside its existing 35 / 75 cap (OD-H5-E2: no cap is needed)", () => {
    for (const r of RECIPES) {
      const cap = selectableHintPriceCap(r);
      expect([35, 75], r.id).toContain(cap);
      expect(hint5LadderDesignTotal(r.id), r.id).toBeLessThanOrEqual(cap);
    }
    expect(buildSelectableHintModel("pepperoni", { discoveredCount: 1 })!.priceCap).toBe(35);
  });

  it("while P4 / P4b are open, the 6 blocked targets can only reach their charged prefix (never an empty rung)", () => {
    const reachable = (id: string) => {
      const rungs = buildHint5Ladder(id)!.rungs;
      let sum = 0;
      for (const rung of rungs) {
        if (rung.kind !== "STRUCTURE" && rung.kind !== "SUB_CLASS" && rung.subjectIds.length === 0) break;
        sum += HINT5_RUNG_PRICE[rung.kind];
      }
      return sum;
    };
    expect(Object.fromEntries([...P4_BLOCKED].sort().map((id) => [id, reachable(id)]))).toEqual({
      fugazza: 10,
      marinara: 10,
      "pesto-tonno": 10,
      "pizza-bianca": 10,
      "puttanesca-pizza": 10,
      "quattro-formaggi": 20,
    });
  });
});

describe("P-C progression walk (real reducer, flag ON)", () => {
  it("every profile x quality reaches Dex 25 with no hard deadlock; charges are P-C prices only", async () => {
    const runs = [];
    for (const qualityTotal of QUALITIES) {
      for (const profile of HINT5_PROFILES) {
        const r = simulateHint5Economy({ profile, qualityTotal });
        runs.push(r);
        expect(r.completed, `${profile} q${qualityTotal}`).toBe(true);
        expect(r.stages.map((x) => x.discovery)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        expect(r.minPitz).toBeGreaterThanOrEqual(0);
        // Dex 0 (the Margherita onboarding) never uses the ladder.
        expect(r.stages[0]).toMatchObject({ recipe: "margherita", hintSpend: 0 });
        for (const st of r.stages) {
          for (const c of st.rungCharges) expect([5, 10], `${profile} ${st.recipe}`).toContain(c);
          expect(st.hintSpend).toBeLessThanOrEqual(DESIGN_P_C[st.recipe]);
          // Only the P4 / P4b targets ever stop at an empty rung.
          if (st.reservedStop) expect(P4_BLOCKED.has(st.recipe), st.recipe).toBe(true);
        }
        if (profile === "NONE") expect(r.totalHintSpend).toBe(0);
        if (profile === "FULL" && r.insufficientHintAttempts === 0) {
          // A full ladder is bought for every unblocked target; blocked ones stop at their empty rung.
          for (const st of r.stages.slice(1)) {
            if (!P4_BLOCKED.has(st.recipe)) expect(st.hintSpend, st.recipe).toBe(DESIGN_P_C[st.recipe]);
            else expect(st.reservedStop, st.recipe).toBe(true);
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
