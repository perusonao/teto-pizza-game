import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PizzaSelectScreen } from "./PizzaSelectScreen";
import { RECIPES, type Recipe, type RecipeId } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import type { InventoryState } from "../state/inventory";
import type { QualityStars } from "../logic/scoring";

afterEach(() => {
  cleanup();
});

/**
 * Progression 2.0 W1 Discovery 2.0 -- Pizza Select A′ (OD-DISC-1 = A′, OD-DISC-3, OD-DISC-5,
 * OD-DISC-9; docs/reports/TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_FRESH-DESIGN.md §5.2):
 * DISCOVERED recipes only as cards, one anonymous prompt card, chapters 6 / 9 / 10, no EP1.
 */

function dexDiscovering(recipeIds: readonly string[], stars: QualityStars = 3): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

const finite = (ids: readonly string[]) => ids.filter((id) => !!getIngredient(id)?.unlockCondition);
const ALL_FINITE = finite([...new Set(RECIPES.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))]);
const FULL_STOCK: InventoryState = Object.fromEntries(ALL_FINITE.map((id) => [id, 99]));

function renderSelect(
  overrides: Partial<{
    dex: DexState;
    ownedIngredientIds: readonly string[];
    unlockedForShopIngredientIds: readonly string[];
    inventory: InventoryState;
    newlyDiscoveredId: string | null;
    recipes: readonly Recipe[];
  }> = {},
) {
  const onSelectRecipe = vi.fn();
  const onBack = vi.fn();
  const onGoFreeCook = vi.fn();
  const onOpenShop = vi.fn();
  render(
    <PizzaSelectScreen
      dex={overrides.dex ?? EMPTY_DEX}
      ownedIngredientIds={overrides.ownedIngredientIds ?? STARTER_INGREDIENT_IDS}
      unlockedForShopIngredientIds={overrides.unlockedForShopIngredientIds ?? []}
      inventory={overrides.inventory ?? {}}
      onSelectRecipe={onSelectRecipe}
      onBack={onBack}
      onGoFreeCook={onGoFreeCook}
      onOpenShop={onOpenShop}
      newlyDiscoveredId={overrides.newlyDiscoveredId ?? null}
      recipes={overrides.recipes}
    />,
  );
  return { onSelectRecipe, onBack, onGoFreeCook, onOpenShop };
}

function gridCard(name: string) {
  return screen.getByRole("button", { name: new RegExp(`^${name}、`) });
}
function gridCards() {
  return Array.from(document.querySelectorAll<HTMLElement>(".pizza-select-grid-card"));
}
function detailPanel() {
  return document.querySelector(".pizza-select-detail") as HTMLElement;
}
function sectionHeadings() {
  return Array.from(document.querySelectorAll(".pizza-select-section__title")).map((h) => h.textContent);
}

/** Everything a player (or assistive tech, or a CSS rule) could read, in one string. */
function everythingRendered(): string {
  const attrs = Array.from(document.querySelectorAll("*")).map((e) =>
    ["aria-label", "title", "alt", "style"].map((a) => e.getAttribute(a) ?? "").join("|"),
  );
  return `${document.body.textContent ?? ""}||${attrs.join("|")}`;
}

describe("Pizza Select A′: cards are DISCOVERED recipes only", () => {
  it("Dex 0: no recipe card, only the first-discovery prompt to Free Cooking; chapters 0/6, 0/9, 0/10", async () => {
    const { onGoFreeCook, onSelectRecipe } = renderSelect();
    expect(gridCards()).toHaveLength(0);
    expect(sectionHeadings()).toEqual(["第1章発見 0/6", "第2章発見 0/9", "第3章発見 0/10"]);
    const prompt = document.querySelector(".pizza-select-prompt") as HTMLElement;
    expect(prompt).toHaveTextContent("まずはフリークッキングで1枚目のピザを見つけよう！");
    await userEvent.click(within(prompt).getByRole("button", { name: /フリークッキングで探す/ }));
    expect(onGoFreeCook).toHaveBeenCalledTimes(1);
    expect(onSelectRecipe).not.toHaveBeenCalled();
    for (const r of RECIPES) expect(everythingRendered(), r.id).not.toContain(r.nameJa);
  });

  it("shows exactly the discovered recipes, each in its canonical chapter (6 / 9 / 10), in RECIPES order", () => {
    const ids = ["margherita", "marinara", "bismarck", "quattro-formaggi", "hawaiian"];
    renderSelect({ dex: dexDiscovering(ids), ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...ALL_FINITE], inventory: FULL_STOCK });
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".pizza-select-section"));
    const namesIn = (s: HTMLElement) =>
      Array.from(s.querySelectorAll(".pizza-select-card__name")).map((e) => e.textContent);
    expect(sectionHeadings()).toEqual(["第1章発見 2/6", "第2章発見 2/9", "第3章発見 1/10"]);
    expect(namesIn(sections[0])).toEqual(["マルゲリータ", "ビスマルク"]);
    expect(namesIn(sections[1])).toEqual(["マリナーラ", "ハワイアンピザ"]);
    expect(namesIn(sections[2])).toEqual(["クアトロ フォルマッジ"]);
  });

  it("a discovered, cookable card shows ★ / BEST and its detail CTA starts that exact recipe", async () => {
    const { onSelectRecipe } = renderSelect({
      dex: dexDiscovering(["margherita", "bismarck"], 4),
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"],
      inventory: { egg: 10 },
    });
    const card = gridCard("ビスマルク");
    expect(card).toHaveTextContent("BEST 80");
    await userEvent.click(card);
    expect(onSelectRecipe).not.toHaveBeenCalled(); // the grid tap only opens the detail
    await userEvent.click(within(detailPanel()).getByRole("button", { name: /このピザを作る/ }));
    expect(onSelectRecipe).toHaveBeenCalledWith("bismarck");
  });

  it("F-15: a discovered recipe out of stock stays visible, but its guided CTA is disabled and points to the Shop", async () => {
    const { onSelectRecipe, onOpenShop } = renderSelect({
      dex: dexDiscovering(["margherita", "bismarck"]),
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg"],
      inventory: { egg: 0 },
    });
    const card = gridCard("ビスマルク");
    expect(card).toHaveAccessibleName(/材料が足りません/);
    await userEvent.click(card);
    const cta = within(detailPanel()).getByRole("button", { name: /このピザを作る/ });
    expect(cta).toBeDisabled();
    await userEvent.click(cta);
    expect(onSelectRecipe).not.toHaveBeenCalled();
    await userEvent.click(within(detailPanel()).getByRole("button", { name: /ショップで補充する/ }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
  });

  it("NEW badge only on the recipe discovered this round", () => {
    renderSelect({ dex: dexDiscovering(["margherita", "bismarck"]), newlyDiscoveredId: "bismarck" });
    expect(within(gridCard("ビスマルク")).getByText("NEW")).toBeInTheDocument();
    expect(within(gridCard("マルゲリータ")).queryByText("NEW")).not.toBeInTheDocument();
  });

  it("back from a detail returns to the same (never unmounted) grid; HOME calls onBack; no Lunch Rush here", async () => {
    const { onBack } = renderSelect({ dex: dexDiscovering(["margherita"]) });
    const body = document.querySelector(".pizza-select-body") as HTMLElement;
    await userEvent.click(gridCard("マルゲリータ"));
    expect(body).toBeInTheDocument();
    expect(body.style.display).toBe("none");
    await userEvent.click(screen.getByRole("button", { name: "レシピ一覧に戻る" }));
    expect(body.style.display).toBe("");
    await userEvent.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/ランチラッシュ/)).not.toBeInTheDocument();
  });

  it("all 25 discovered: 25 cards, no prompt, 6 / 9 / 10 complete", () => {
    renderSelect({
      dex: dexDiscovering(RECIPES.map((r) => r.id)),
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...ALL_FINITE],
      inventory: FULL_STOCK,
    });
    expect(gridCards()).toHaveLength(25);
    expect(document.querySelector(".pizza-select-prompt")).toBeNull();
    expect(sectionHeadings()).toEqual(["第1章発見 6/6", "第2章発見 9/9", "第3章発見 10/10"]);
  });
});

describe("Pizza Select A′: the one anonymous prompt card", () => {
  it("DISCOVERABLE >= 1 (legacy save owns every old material): 'make something new' -> Free Cooking, no name", async () => {
    const old15 = RECIPES.slice(0, 15).map((r) => r.id);
    const mats = finite(RECIPES.slice(0, 15).flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
    const { onGoFreeCook } = renderSelect({
      dex: dexDiscovering(old15),
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...mats],
      inventory: Object.fromEntries(mats.map((m) => [m, 30])),
    });
    const prompt = document.querySelector(".pizza-select-prompt") as HTMLElement;
    expect(prompt).toHaveTextContent("まだ見つけていないピザが、今の材料で作れるかも！");
    await userEvent.click(within(prompt).getByRole("button"));
    expect(onGoFreeCook).toHaveBeenCalledTimes(1);
    for (const r of RECIPES.slice(15)) expect(everythingRendered(), r.id).not.toContain(r.nameJa);
  });

  it("only a Shop-gated recipe (egg arrived, not bought): 'new material in the Shop' -> Shop", async () => {
    const { onOpenShop, onGoFreeCook } = renderSelect({ dex: dexDiscovering(["margherita"]), unlockedForShopIngredientIds: ["egg"] });
    const prompt = document.querySelector(".pizza-select-prompt--shop") as HTMLElement;
    expect(prompt).toHaveTextContent("ショップに新しい材料が入荷しているよ！");
    await userEvent.click(within(prompt).getByRole("button", { name: /ショップを見る/ }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    expect(onGoFreeCook).not.toHaveBeenCalled();
  });
});

// Information-disclosure contract (W1): before discovery, no name, preview, ingredient answer,
// guided CTA, EP1 hint, aria-label or CSS name length -- walked along the real 25-recipe ladder
// both right after each step's material arrives (A) and after it is bought (B).
describe("Pizza Select A′: nothing about an undiscovered recipe reaches the DOM", () => {
  const keyOrder = ["margherita", ...DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];

  it.each([
    ["A (material arrived, not bought)", false],
    ["B (material bought, stock 30)", true],
  ] as const)("every ladder Dex, state %s", (_label, bought) => {
    for (let n = 0; n <= keyOrder.length; n++) {
      const dex = dexDiscovering(keyOrder.slice(0, n));
      const unlocked = materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step <= n));
      const owned = bought ? unlocked : materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step < n));
      renderSelect({
        dex,
        ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...owned],
        unlockedForShopIngredientIds: unlocked,
        inventory: Object.fromEntries(owned.map((m) => [m, 30])),
      });
      const discovered = new Set(keyOrder.slice(0, n));
      const everything = everythingRendered();
      for (const r of RECIPES.filter((x) => !discovered.has(x.id))) {
        expect(everything, `Dex ${n}: ${r.id}`).not.toContain(r.nameJa);
        expect(document.querySelector(`[data-recipe-id="${r.id}"]`)).toBeNull();
      }
      // One card per discovered recipe; --name-chars only ever from a displayed, discovered name.
      expect(gridCards()).toHaveLength(n);
      for (const label of Array.from(document.querySelectorAll<HTMLElement>(".pizza-select-card__name"))) {
        expect(label.style.getPropertyValue("--name-chars")).toBe(String([...(label.textContent ?? "")].length));
      }
      // OD-DISC-5: no EP1 display.
      expect(everything).not.toMatch(/を1枚完成させると解禁|あと★|未解放/);
      cleanup();
    }
  });
});

describe("PizzaSelectScreen scalability (mocked catalog)", () => {
  function mockRecipes(count: number): Recipe[] {
    return Array.from({ length: count }, (_, i) => ({
      ...RECIPES[0],
      id: `mock-recipe-${i}` as unknown as RecipeId,
      nameJa: `モック${i}`,
      unlockCondition: undefined,
    }));
  }

  it("renders every discovered card of a 38-recipe catalog exactly once, in 2-column grids", () => {
    const recipes = mockRecipes(38);
    renderSelect({ recipes, dex: dexDiscovering(recipes.map((r) => r.id)) });
    const names = Array.from(document.querySelectorAll(".pizza-select-card__name")).map((e) => e.textContent);
    expect(names).toEqual(recipes.map((r) => r.nameJa));
    expect(document.querySelectorAll(".pizza-select-grid").length).toBeGreaterThan(0);
  });
});
