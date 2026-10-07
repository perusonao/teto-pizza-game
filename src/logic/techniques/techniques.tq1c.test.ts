import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../../data/discoveryLadder";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { RECIPES, countsTowardLadder } from "../../data/recipes";
import type { DexEntry } from "../../state/dex";
import { NEAR_MISS_COPY } from "../../state/resultNearMiss";
import { discoverableHintCandidates } from "../discovery/hintTarget";
import { classifyNearMiss } from "../discovery/nearMiss";
import type { RuntimeSignature } from "../discovery/signature";
import { sauceAxisAnswerCount } from "./nearMissPrivacy";

/**
 * Cooking Techniques 1.0 TQ-1C (Issue #287): gate §8 T15 / T15a / T20.
 *
 * OD-TQ1C-2: the near-miss k-rule applies to SAUCE_ONLY uniformly, but only from TQ-1D (with Human
 * Verification) -- TQ-1C must not change a single production near-miss line. The audit number the
 * Owner decided on (SSOT §1.1: 12 of 47 SAUCE_ONLY cases would fall back) is pinned here with the
 * pure functions only, so TQ-1D starts from a checked baseline.
 */

const SAUCES = INGREDIENTS.filter((i) => i.category === "sauce").map((i) => i.id);

function signature(pieces: readonly string[], sauces: readonly string[]): RuntimeSignature {
  return {
    ingredientSet: { status: "OBSERVED", value: [...new Set([...pieces, ...sauces])].sort() },
    sauceBase: { status: "OBSERVED", value: [...sauces].sort() },
    ingredientCounts: {},
    dimensions: {} as RuntimeSignature["dimensions"],
  };
}

describe("T15: TQ-1C does not change the production near-miss copy", () => {
  it("the SAUCE_ONLY line and the rest of NEAR_MISS_COPY are unchanged", () => {
    expect(NEAR_MISS_COPY).toEqual({
      ADD_ONE: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！",
      REMOVE_ONE: "\u{1F90F} おしい！ 材料を1つ減らすと、何か見つかりそう！",
      SAUCE_ONLY: "\u{1F90F} おしい！ ソースを変えると、何か見つかりそう！",
      CLOSE: "\u{1F440} かなり近づいてるよ。少しだけ変えてみよう！",
      FAR_KEY_UNUSED: "\u{1F6D2} 新しく入荷した材料は使ってみた？",
    });
  });

  it("resultNearMiss does not apply the k-rule yet (it does not read the technique modules)", () => {
    const source = Object.values(
      import.meta.glob<string>("../../state/resultNearMiss.ts", { query: "?raw", import: "default", eager: true }),
    )[0];
    expect(source).not.toMatch(/techniques|nearMissPrivacy|axisGuidanceAllowed|sauceAxisAnswerCount/);
  });
});

describe("T15a: the OD-TQ1C-2 audit baseline (SSOT §1.1)", () => {
  it("on the canonical ladder, 44 SAUCE_ONLY cases, of which 12 have k < 2 -- all forgotten-sauce pizzas at steps 1-12", () => {
    const steps = DISCOVERY_LADDER.steps;
    let sauceOnly = 0;
    const lowK: { step: number; used: readonly string[] }[] = [];
    for (let s = 0; s <= steps.length; s += 1) {
      const unlocked = steps.slice(0, s).flatMap((st) => st.ingredientIds);
      const owned = [...STARTER_INGREDIENT_IDS, ...unlocked];
      const discovered = ["margherita", ...steps.slice(0, Math.max(0, s - 1)).map((st) => st.keyRecipeId)];
      const dex = discovered.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 0, bestStars: 1, timesMade: 1 }));
      const inputs = {
        dex,
        ownedIngredientIds: owned,
        unlockedForShopIngredientIds: unlocked,
        inventory: Object.fromEntries(unlocked.map((id) => [id, 99])),
      };
      // The audit baseline (SSOT §1.1) is defined on the credited ladder population (OD-D3-17 O3); a
      // non-credit branching recipe is a different population and is not part of this count.
      const candidates = discoverableHintCandidates(inputs, RECIPES.filter((r) => countsTowardLadder(r.id)));
      const ownedSauces = owned.filter((id) => SAUCES.includes(id));
      for (const candidate of candidates) {
        for (const target of RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId === candidate.id)) {
          const base = target.sauceBase ?? [];
          const pieces = target.items.filter((id) => !base.includes(id));
          for (const used of [[], ...ownedSauces.map((id) => [id])]) {
            if ([...used].sort().join() === [...base].sort().join()) continue;
            if (classifyNearMiss(signature(pieces, used), candidates)?.kind !== "SAUCE_ONLY") continue;
            sauceOnly += 1;
            const k = sauceAxisAnswerCount({ ownedIngredientIds: owned, usedSauceIds: used, sauceIngredientIds: SAUCES });
            if (k < 2) lowK.push({ step: s, used });
          }
        }
      }
    }
    expect(sauceOnly).toBeGreaterThanOrEqual(65); // append-only: each appended step can only add near-misses; last measured 65 at +3 at No.27's appended step 25, +3 at Expansion Slice 1's step 26, +9 at Wave 2's steps 27 / 28, +6 at Slice 3's step 29 (re-measured; low-k count unchanged)
    expect(lowK).toHaveLength(12);
    expect(lowK.every((c) => c.used.length === 0 && c.step >= 1 && c.step <= 12)).toBe(true);
  });
});

describe("T20: architecture -- which screens may read technique state (TQ-1D)", () => {
  const ui = import.meta.glob<string>(["../../components/**/*.tsx", "../../screens/**/*.tsx", "!../../**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  // TQ-1D: exactly these four files render a technique: the Dex section (pre-computed views), the RESULT's
  // technique stage (the component + its host), and the screen that hands `lastTechniqueDiscovery` over.
  const TECHNIQUE_UI = [
    "components/DexOverlay.tsx",
    "components/ResultPanel.tsx",
    "components/TechniqueReveal.tsx",
    "screens/GameScreen.tsx",
  ];

  it("only the Dex section, the RESULT technique stage and its host mention a technique module", () => {
    expect(Object.keys(ui).length).toBeGreaterThan(10);
    const mentioning = Object.entries(ui)
      .filter(([, source]) => /discoveredTechniqueIds|lastTechniqueDiscovery|discoveryReveal|techniques/.test(source))
      .map(([path]) => path.replace(/^(\.\.\/)+/, ""))
      .sort();
    expect(mentioning).toEqual(TECHNIQUE_UI);
  });

  it("no screen reads the raw ledger: it reaches the UI only as the just-discovered list or pre-computed Dex views", () => {
    for (const [path, source] of Object.entries(ui)) expect(/discoveredTechniqueIds/.test(source), path).toBe(false);
  });

  it("the runtime reads technique state only in the reducer, App (hydrate + persist), the reveal selector and persistence", () => {
    const runtime = import.meta.glob<string>(["../../**/*.ts", "../../**/*.tsx", "!../../**/*.test.ts", "!../../**/*.test.tsx", "!../../**/testSupport/**"], {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const readers = Object.entries(runtime)
      // Same-directory paths ("./…") are the technique modules themselves.
      .filter(([path]) => !path.startsWith("./") && !path.endsWith("/data/techniques.ts"))
      .filter(([, source]) => /discoveredTechniqueIds|lastTechniqueDiscovery/.test(source))
      .map(([path]) => path.replace(/^(\.\.\/)+/, ""))
      .sort();
    // DEV State Editor (Issue #403): the DEV / Preview-only editor edits the technique ledger as one of the save's
    // progression fields (devtools/stateModel.ts the field, presets.ts the presets, saveMerge.ts the unknown-id
    // preservation). It is not part of the runtime: ../main.tsx reaches it only behind the DEV / Preview env check
    // (dynamic import) and ../preview/previewIsolation.gate.test.ts proves a production bundle has none of it.
    expect(readers).toEqual([
      "App.tsx",
      "devtools/presets.ts",
      "devtools/saveMerge.ts",
      "devtools/stateModel.ts",
      "screens/GameScreen.tsx",
      "state/discoveryReveal.ts",
      "state/gameReducer.ts",
      "state/persistence.ts",
    ]);
  });
});
