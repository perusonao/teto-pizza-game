import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Contract 2.1 Production Activation Gate C: the attempt-aware walk (test-only; see ./testSupport/researchAttemptSim.ts).
 * It runs the real reducer with the Hint 5.0 ladder flag mocked ON (it is ON in Production) and the Research flag ON
 * (every Vitest build). It asserts the Contract invariants on EVERY attempt of every walk and the economy invariants
 * the Hint 5.0 harness asserts (no deadlock, min Pitz >= 0, no RESERVED stop). The ★3-FULL replay count is only measured
 * (an Owner-accepted observation of the direct-bake walk, not a threshold; see the Fresh Authority Audit report).
 *
 * `RESEARCH_ATTEMPT_SIM_OUT=<path>` also writes every run as JSON (the Gate C report's tables come from that file).
 * `RESEARCH_ATTEMPT_SIM_SEEDS=<n>` sets the tray-order sensitivity sweep size (default 12; the report used 100).
 *
 * SPLIT (T9 #784, test speed only): the original single file ran 117 tests serially in one worker (about 1,300 s of the 1,600 s full run). It is now four files so
 * Vitest can run them in parallel workers. Every test body, title, seed, expectation and trial count is unchanged; only the loops over `explorePieces` are
 * restricted per file and each file writes its own JSON slice (see `afterAll`). Parts: researchAttempt.sim.test.ts (strategy, flag, main walks FULL, lower bound FULL),
 * researchAttempt.sim.mainOne.test.ts (main walks ONE, lower bound ONE, persistence, economy comparison), researchAttempt.sim.sweepFull.test.ts and
 * researchAttempt.sim.sweepOne.test.ts (the tray-order sensitivity sweep). This is part `sweepFull`.
 */
vi.mock("./discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true }));

const { simulateResearchAttempts } = await import("./testSupport/researchAttemptSim");

const SEEDS = Number((import.meta.env as Record<string, string | undefined>).RESEARCH_ATTEMPT_SIM_SEEDS ?? "12");

describe("attempt-aware walk (real reducer)", () => {
  // A walk is the unit of cost: it plays the WHOLE catalog in ladder order, so one walk grows with RECIPES.length, and the number of walks does not. The walks used to be batched (18 per `it`, then 12 seeds per
  // `it`), so every recipe batch pushed an `it` over its 600 s budget (Expansion Batch 10 PR-1; the same class of fix as #682) and someone had to re-split by hand. Now EVERY walk is its own `it`, generated from the
  // same loops (explorePieces x quality x profile, and profile x explorePieces x seed): the longest `it` is one walk, whatever the catalog size, and no timeout is raised. Every assertion and every walk (options, seeds)
  // is unchanged, and `ALL_RUNS` is filled in the same order. `ALL_RUNS` collects every run for the optional JSON output.
  const ALL_RUNS: { runs: unknown[]; baseline: unknown[]; sweep: unknown[] } = { runs: [], baseline: [], sweep: [] };

  // ★3-FULL: the Hint 5.0 Activation Gate reported (and the Owner accepted) one final-stage Margherita replay in the
  // direct-bake walk. This walk's own number is a MEASUREMENT (Gate C report), not an assertion.

  for (const explorePieces of ["FULL"] as const) for (const profile of ["NONE", "FIXED4", "FULL"] as const) {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      it(`tray-order sensitivity sweep (${profile}, ${explorePieces}, seed ${seed}): completed, no violations, min Pitz >= 0`, () => {
        const r = simulateResearchAttempts({ profile, qualityTotal: 65, orderSeed: seed, explorePieces });
        expect(r.completed, `${profile} seed ${seed}`).toBe(true);
        expect(r.violations, `${profile} seed ${seed}`).toEqual([]);
        expect(r.minPitz, `${profile} seed ${seed}`).toBeGreaterThanOrEqual(0);
        ALL_RUNS.sweep.push({ ...r, finalState: undefined });
      }, 600_000);
    }
  }

  afterAll(async () => {
    const out = (import.meta.env as Record<string, string | undefined>).RESEARCH_ATTEMPT_SIM_OUT;
    if (out) {
      // Split (T9 #784): each part file writes its own slice to `<out>` with `.sweepFull` inserted before the extension.
      const target = out.replace(/(\.[^./\\]+)?$/, ".sweepFull$1");
      const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as { writeFileSync(path: string, data: string): void };
      fs.writeFileSync(target, JSON.stringify(ALL_RUNS, null, 1));
    }
  });
});
