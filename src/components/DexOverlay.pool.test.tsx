import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { countRecipeDiscoveryStates, type RecipeDiscoveryInputs } from "../state/recipeDiscoveryState";
import { DexOverlay } from "./DexOverlay";

/**
 * Discovery 3.0 PR-4b-A (Owner D-1 / D-2): with more than one DISCOVERABLE unknown recipe the Dex shows ONE
 * aggregated notice ("there is still something to find") and nothing that carries the candidate count, a name,
 * an identity or a per-candidate hint entry. State-derived: it also covers migrated saves. With 0 or 1 candidate
 * the Dex is exactly what it was.
 */

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

/** A migrated save: the first `found` recipes discovered, every material of the first 15 recipes owned and stocked. */
function migrated(found: number): RecipeDiscoveryInputs {
  const old15 = RECIPES.slice(0, 15);
  const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
  const dex = discover(RECIPES.slice(0, found).map((r) => r.id));
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(mats.map((m) => [m, 30])),
  };
}

function renderDex(inputs: RecipeDiscoveryInputs) {
  const onGoFreeCook = vi.fn();
  const onShowHint = vi.fn();
  const view = render(
    <DexOverlay
      dex={inputs.dex}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={() => {}}
      ownedIngredientIds={inputs.ownedIngredientIds}
      unlockedForShopIngredientIds={inputs.unlockedForShopIngredientIds}
      inventory={inputs.inventory}
      onGoFreeCook={onGoFreeCook}
      onShowHint={onShowHint}
    />,
  );
  return { onGoFreeCook, onShowHint, view };
}

const poolSize = (i: RecipeDiscoveryInputs) => countRecipeDiscoveryStates(RECIPES, i).DISCOVERABLE;
const aggregated = () => [...document.querySelectorAll<HTMLElement>("[data-dex-aggregated]")];

afterEach(() => cleanup());

describe("Dex aggregated unknown (pool > 1)", () => {
  const POOLS = [8, 10, 12].map(migrated);

  it("the fixtures really have different pool sizes, all above one", () => {
    const sizes = POOLS.map(poolSize);
    expect(sizes.every((n) => n > 1)).toBe(true);
    expect(new Set(sizes).size).toBeGreaterThan(1);
  });

  it("exactly one aggregated notice; no DISCOVERABLE card, no 🎨 tag on a card, no per-candidate hint button", () => {
    for (const inputs of POOLS) {
      renderDex(inputs);
      expect(aggregated()).toHaveLength(1);
      expect(document.querySelectorAll('[data-dex-state="DISCOVERABLE"]')).toHaveLength(0);
      expect(screen.queryAllByRole("button", { name: /ヒントを見る/ })).toHaveLength(0);
      // The only 🎨 on the screen is the aggregated notice's.
      const tagged = [...document.querySelectorAll(".dex-card--tagged")].filter((c) => (c.textContent ?? "").includes("\u{1F3A8}"));
      expect(tagged).toHaveLength(1);
      expect(tagged[0]).toBe(aggregated()[0]);
      cleanup();
    }
  });

  it("the aggregated notice and the card count do not depend on how many candidates there are", () => {
    const html: string[] = [];
    const cardCounts: number[] = [];
    for (const inputs of POOLS) {
      renderDex(inputs);
      html.push(aggregated()[0].outerHTML);
      cardCounts.push(document.querySelectorAll(".dex-card").length);
      cleanup();
    }
    expect(new Set(html).size).toBe(1);
    // Every recipe keeps its own slot (so no gap in the numbering) plus the one notice.
    for (const n of cardCounts) expect(n).toBe(RECIPES.length + 1);
  });

  it("a candidate's slot is drawn exactly like any other still-unknown slot (same text, same DOM state)", () => {
    for (const inputs of POOLS) {
      renderDex(inputs);
      const unknown = [...document.querySelectorAll<HTMLElement>('.dex-card--locked:not([data-dex-aggregated])[data-dex-state="UNKNOWN"]')];
      const shapes = new Set(unknown.map((c) => c.textContent?.replace(/No\.\d+/, "No.xx")));
      expect(shapes).toEqual(new Set(["🔒No.xx ？？？まだ見ぬピザ"]));
      cleanup();
    }
  });

  it("the notice's CTA starts Free Cooking without naming or pinning a recipe", () => {
    const { onGoFreeCook, onShowHint } = renderDex(POOLS[0]);
    fireEvent.click(aggregated()[0].querySelector("button")!);
    expect(onGoFreeCook).toHaveBeenCalledTimes(1);
    expect(onGoFreeCook).toHaveBeenCalledWith();
    expect(onShowHint).not.toHaveBeenCalled();
  });

  it("no recipe name or id of an undiscovered recipe is in the text or the attributes", () => {
    for (const inputs of POOLS) {
      renderDex(inputs);
      const found = new Set(RECIPES.slice(0, 8).map((r) => r.id));
      const locked = [...document.querySelectorAll(".dex-card--locked")].map((c) => c.textContent ?? "").join("|");
      const attributes = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value)).join("|");
      for (const r of RECIPES.filter((x) => !found.has(x.id))) {
        expect(locked).not.toContain(r.nameJa);
        expect(attributes.split(/[\s:|]/)).not.toContain(r.id);
      }
      cleanup();
    }
  });
});

describe("Dex with 0 candidates has no aggregated notice (the 1-candidate shape is pinned by DexOverlay.hint.test.tsx on the real 25 ladder)", () => {
  it("zero DISCOVERABLE: no aggregated notice", () => {
    renderDex({ dex: EMPTY_DEX, ownedIngredientIds: [], unlockedForShopIngredientIds: [], inventory: {} });
    expect(aggregated()).toHaveLength(0);
  });
});
