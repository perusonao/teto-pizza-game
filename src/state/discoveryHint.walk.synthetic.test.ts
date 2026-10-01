import { vi } from "vitest";

// Discovery 3.0 PR-4a: the Final Gate walk over production + the synthetic non-credit branching recipe.
// Hint 5.0 flag OFF, as in the production walk (this pins the pre-Hint-5.0 purchase path).
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));
vi.mock("../data/recipes", async (orig) => (await import("../logic/testSupport/syntheticModuleMocks")).mockRecipes(await orig()));
vi.mock("../data/discoveryCatalog", async (orig) => (await import("../logic/testSupport/syntheticModuleMocks")).mockCatalog(await orig()));

const { defineFinalGateWalk } = await import("./testSupport/finalGateWalk");

defineFinalGateWalk("Final Gate (synthetic branching): 25 production recipes + 1 non-credit branch, from a new save to a complete Dex");
