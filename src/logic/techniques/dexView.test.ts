import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { TECHNIQUES } from "../../data/techniques";
import type { DexEntry, DexState } from "../../state/dex";
import { W1_ORDER } from "../testSupport/branchingFixture";
import { techniqueDexViews } from "./dexView";
import { noSauceRecipeIds } from "../../data/recipeSauceProfiles";

/**
 * Cooking Techniques 1.0 TQ-1D (SSOT P6, OD-TQ1D-2): what the Dex's 調理法 section may show. It reads the
 * ledger, the Dex and the ladder only -- never a recipe's own sauce and never a target identity.
 */

const dexOf = (ids: readonly string[]): DexState =>
  ids.map((recipeId): DexEntry => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
const NO_SAUCE = TECHNIQUES[0];

describe("techniqueDexViews", () => {
  it("shows nothing before the affordance opens: no name, no riddle, not even the section", () => {
    expect(techniqueDexViews([], [])).toEqual([]);
    expect(techniqueDexViews([], dexOf(W1_ORDER.slice(0, 11)))).toEqual([]);
  });

  it("shows only 「？？？」 + the fixed riddle once the affordance (12 credited discoveries, the onion step) is open -- never the name or id", () => {
    const views = techniqueDexViews([], dexOf(W1_ORDER.slice(0, 12)));
    expect(views).toEqual([{ id: "no-sauce", state: "RIDDLE", riddleJa: NO_SAUCE.riddleJa }]);
    const serialized = JSON.stringify(views);
    expect(serialized).not.toContain(NO_SAUCE.nameJa);
    expect(serialized).not.toContain("ソースなし");
  });

  it("OD-TQ1D-2: a ladderCredit:false recipe does not count toward the affordance (11 credited + calabresa stays closed)", () => {
    expect(techniqueDexViews([], dexOf([...W1_ORDER.slice(0, 11), "brazilian-calabresa"]))).toEqual([]);
    // ... while the ladder's own credited count does open it.
    expect(techniqueDexViews([], dexOf([...W1_ORDER.slice(0, 12), "brazilian-calabresa"]))).toHaveLength(1);
  });

  it("shows the name once it is in the ledger (whatever the Dex), and unknown ledger ids are ignored", () => {
    expect(techniqueDexViews(["no-sauce"], [])).toEqual([{ id: "no-sauce", state: "DISCOVERED", nameJa: "ソースなし" }]);
    expect(techniqueDexViews(["future-x", "no-sauce"], [])).toEqual([{ id: "no-sauce", state: "DISCOVERED", nameJa: "ソースなし" }]);
    expect(techniqueDexViews(["future-x"], [])).toEqual([]);
  });

  it("is a function of the ledger, the Dex and the ladder only: aussie's own presence in the Dex changes nothing by itself", () => {
    // Discovering aussie records the technique (ledger); the view is the same as for any ledger that holds it.
    const withAussie = dexOf([...W1_ORDER.slice(0, 3), "aussie"]);
    expect(techniqueDexViews([], withAussie)).toEqual([]);
    expect(techniqueDexViews(["no-sauce"], withAussie)).toEqual(techniqueDexViews(["no-sauce"], []));
  });

  it("injected context: a technique no catalog target requires never appears", () => {
    const noRequirement = { catalog: RECIPE_DISCOVERY_CATALOG.filter((t) => !(noSauceRecipeIds() as readonly string[]).includes(t.recipeId)), materialStep: () => 0 };
    expect(techniqueDexViews([], dexOf(W1_ORDER), noRequirement)).toEqual([]);
  });
});
