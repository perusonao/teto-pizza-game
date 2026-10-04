import { describe, expect, it, vi } from "vitest";

/**
 * Contract 2.1 Production Activation Gate C: the attempt-aware walk (test-only; see ./testSupport/researchAttemptSim.ts).
 * It runs the real reducer with the Hint 5.0 ladder flag mocked ON (it is ON in Production) and the Research flag ON
 * (every Vitest build). It asserts the Contract invariants on EVERY attempt of every walk and the economy invariants
 * the Hint 5.0 harness asserts (no deadlock, min Pitz >= 0, no RESERVED stop). The ★3-FULL replay count is only measured
 * (an Owner-accepted observation of the direct-bake walk, not a threshold; see the Fresh Authority Audit report).
 *
 * `RESEARCH_ATTEMPT_SIM_OUT=<path>` also writes every run as JSON (the Gate C report's tables come from that file).
 * `RESEARCH_ATTEMPT_SIM_SEEDS=<n>` sets the tray-order sensitivity sweep size (default 12; the report used 100).
 */
vi.mock("./discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));

const { RECIPES } = await import("../data/recipes");
const { getIngredient } = await import("../data/ingredients");
const { RESEARCH_IDENTIFY_ENABLED } = await import("./discovery/researchIdentifyFlag");
const { chooseAttempt, simulateResearchAttempts, RESEARCH_HINT_PROFILES } = await import("./testSupport/researchAttemptSim");
const { simulateHint5Economy } = await import("./testSupport/hint5EconomySim");
const { loadSave, persistProgress, SAVE_STORAGE_KEY } = await import("../state/persistence");

const QUALITIES = [80, 65, 30]; // ★4, ★3, ★1
const SEEDS = Number((import.meta.env as Record<string, string | undefined>).RESEARCH_ATTEMPT_SIM_SEEDS ?? "12");
const cat = (id: string) => getIngredient(id)?.category;

describe("strategy (pure chooser)", () => {
  const owned = ["tomato-sauce", "mozzarella", "basil", "egg", "bacon", "mushroom", "ham", "onion", "pesto", "parmigiano"];
  const k = (over: Partial<Parameters<typeof chooseAttempt>[1]> = {}) => ({ positive: ["egg"], negative: new Set<string>(), cheeseSettled: false, total: null, ...over });
  const opts = { orderSeed: 0, salt: 0, toppingCap: 3 };

  it("judges at most 3 unknown toppings, one sauce, every unknown cheese; known ones are always kept", () => {
    const p = chooseAttempt(owned, k(), opts);
    expect(p.ids.filter((id) => cat(id) === "sauce")).toHaveLength(1);
    expect(p.ids.filter((id) => cat(id) === "topping" && id !== "egg")).toHaveLength(3);
    expect(p.ids.filter((id) => cat(id) === "cheese").sort()).toEqual(["mozzarella", "parmigiano"]);
    expect(p.ids).toContain("egg");
    expect(p.final).toBe(false);
  });
  it("never places a remembered ×, and does not count a known topping toward K", () => {
    const p = chooseAttempt(owned, k({ positive: ["egg", "bacon"], negative: new Set(["mozzarella", "tomato-sauce", "basil"]) }), opts);
    for (const id of ["mozzarella", "tomato-sauce", "basil"]) expect(p.ids).not.toContain(id);
    expect(p.ids.filter((id) => cat(id) === "topping" && !["egg", "bacon"].includes(id))).toHaveLength(3);
  });
  it("a settled cheese rung places no unknown cheese; everything resolved -> the exact known-positive set", () => {
    expect(chooseAttempt(owned, k({ cheeseSettled: true }), opts).ids.some((id) => cat(id) === "cheese")).toBe(false);
    const all = new Set(owned.filter((id) => id !== "egg" && id !== "pesto"));
    const done = chooseAttempt(owned, k({ positive: ["egg", "pesto"], negative: all, cheeseSettled: true }), opts);
    expect(done).toEqual({ ids: ["egg", "pesto"], unknownIds: [], unknownTested: 0, final: true });
  });
  it("STRUCTURE's total equal to the known-positive count ends the search", () => {
    expect(chooseAttempt(owned, k({ positive: ["egg", "pesto"], total: 2 }), opts).final).toBe(true);
  });
});

describe("attempt-aware walk (real reducer)", () => {
  it("runs with the Research flag ON", () => {
    expect(RESEARCH_IDENTIFY_ENABLED).toBe(true);
    expect(RECIPES.length).toBe(31);
  });

  it("every profile x quality reaches Dex 28 with the Contract invariants intact on every attempt", async () => {
    const runs = [];
    for (const explorePieces of ["FULL", "ONE"] as const) for (const qualityTotal of QUALITIES) {
      for (const profile of RESEARCH_HINT_PROFILES) {
        const r = simulateResearchAttempts({ profile, qualityTotal, explorePieces });
        runs.push({ ...r, finalState: undefined });
        const tag = `${profile} q${qualityTotal} ${explorePieces}`;
        expect(r.completed, tag).toBe(true);
        expect(r.stages.at(-1)!.discovery, tag).toBe(31);
        expect(r.violations, tag).toEqual([]);
        expect(r.minPitz, tag).toBeGreaterThanOrEqual(0);
        expect(r.reservedStops, tag).toBe(0);
        for (const st of r.stages) expect(st.attempts, `${tag} ${st.discovered}`).toBeGreaterThanOrEqual(1);
        // Dex 0 is the free Margherita onboarding: never a hint, never a research attempt.
        expect(r.stages[0]).toMatchObject({ onboarding: true, attempts: 1, hintSpend: 0 });
      }
    }
    // Analysis-only lower bound: a free STRUCTURE total (stop as soon as every member is found).
    for (const explorePieces of ["FULL", "ONE"] as const) {
      const r = simulateResearchAttempts({ profile: "NONE", qualityTotal: 65, explorePieces, freeTotal: true });
      expect(r.completed).toBe(true);
      expect(r.violations).toEqual([]);
      runs.push({ ...r, finalState: undefined });
    }
    // Save / schema: the final state of a full walk persists only existing fields.
    const final = simulateResearchAttempts({ profile: "FIXED4", qualityTotal: 65 }).finalState;
    const m = new Map<string, string>();
    const storage = { getItem: (key: string) => m.get(key) ?? null, setItem: (key: string, v: string) => void m.set(key, v), removeItem: (key: string) => void m.delete(key) };
    persistProgress(
      {
        dex: final.dex,
        pitzBalance: final.pitzBalance,
        ownedIngredientIds: final.ownedIngredientIds,
        inventory: final.inventory,
        starterGrantClaimedRecipeIds: final.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: final.unlockedForShopIngredientIds,
        discoveryHintPurchases: final.discoveryHintPurchases,
        discoveryHintFacts: final.discoveryHintFacts,
        discoveredTechniqueIds: final.discoveredTechniqueIds,
      },
      storage,
    );
    const raw = storage.getItem(SAVE_STORAGE_KEY) ?? "";
    expect(loadSave(storage).schemaVersion).toBe(2);
    for (const word of ["lastResearchRows", "RESEARCH_ROWS", "toppingOverCap", "researchTest", "lastIngredientTest", "researchTargetValidAtStart"]) expect(raw).not.toContain(word);

    // Economy comparison: the Hint 5.0 Activation Gate's own direct-bake walk (no exploration), same qualities.
    const baseline = QUALITIES.flatMap((q) => (["NONE", "FIXED4", "FULL"] as const).map((profile) => {
      const b = simulateHint5Economy({ profile, qualityTotal: q });
      return { profile, qualityTotal: q, minPitz: b.minPitz, grindBakes: b.grindBakes, totalHintSpend: b.totalHintSpend, totalRefillSpend: b.totalRefillSpend, totalUnlockSpend: b.totalUnlockSpend, endingPitz: b.endingPitz };
    }));

    // ★3-FULL: the Hint 5.0 Activation Gate reported (and the Owner accepted) one final-stage Margherita replay in the
    // direct-bake walk. This walk's own number is a MEASUREMENT (Gate C report), not an assertion.

    const sweep = [];
    for (const explorePieces of ["FULL", "ONE"] as const) for (const profile of ["NONE", "FIXED4", "FULL"] as const) {
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        const r = simulateResearchAttempts({ profile, qualityTotal: 65, orderSeed: seed, explorePieces });
        expect(r.completed, `${profile} seed ${seed}`).toBe(true);
        expect(r.violations, `${profile} seed ${seed}`).toEqual([]);
        expect(r.minPitz, `${profile} seed ${seed}`).toBeGreaterThanOrEqual(0);
        sweep.push({ ...r, finalState: undefined });
      }
    }

    const out = (import.meta.env as Record<string, string | undefined>).RESEARCH_ATTEMPT_SIM_OUT;
    if (out) {
      const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { writeFileSync(path: string, data: string): void };
      fs.writeFileSync(out, JSON.stringify({ runs, baseline, sweep }, null, 1));
    }
  }, 600_000);
});
