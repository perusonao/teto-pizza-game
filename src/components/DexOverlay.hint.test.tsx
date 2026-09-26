import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import { resolveShopEntitlement } from "../state/materialEntitlement";
import { recipeDiscoveryState, type RecipeDiscoveryInputs } from "../state/recipeDiscoveryState";
import { DexOverlay } from "./DexOverlay";

/**
 * Discovery Hint 2.0 (Issue #229, 229-D): the Dex 🎨 (DISCOVERABLE) card's 「💡 ヒントを見る」.
 * Only DISCOVERABLE cards get it; it replaces 「フリークッキングで探す」 (no duplicate CTA); the
 * recipe reaches the caller only through the callback, never through the DOM.
 */

const LADDER_ORDER = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];

function discover(ids: readonly string[]): DexState {
  let dex = EMPTY_DEX;
  for (const id of ids) {
    dex = registerScoreToDex(dex, id, { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 60, stars: 3 }).dex;
  }
  return dex;
}

function ladder(count: number, newest: "bought" | "not-bought" = "bought"): RecipeDiscoveryInputs {
  const dex = discover(LADDER_ORDER.slice(0, count));
  const steps = W1_25_DISCOVERY_LADDER.steps.filter((s) => s.step <= count);
  const newestIds = new Set(steps.filter((s) => s.step === count).flatMap((s) => s.ingredientIds));
  const materials = steps.flatMap((s) => s.ingredientIds);
  const owned = [...STARTER_INGREDIENT_IDS, ...materials.filter((m) => newest === "bought" || !newestIds.has(m))];
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(materials.map((m) => [m, 10])),
  };
}

function legacy(): RecipeDiscoveryInputs {
  const old15 = RECIPES.slice(0, 15);
  const mats = [...new Set(old15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)))];
  const owned = [...new Set([...STARTER_INGREDIENT_IDS, ...mats])];
  const dex = discover(old15.map((r) => r.id));
  return {
    dex,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: resolveShopEntitlement(dex, owned, []).unlockedForShopIngredientIds,
    inventory: Object.fromEntries(mats.map((m) => [m, 30])),
  };
}

function renderDex(inputs: RecipeDiscoveryInputs, handlers: { onShowHint?: (id: string) => void } = { onShowHint: vi.fn() }) {
  const onGoFreeCook = vi.fn();
  const onOpenShop = vi.fn();
  render(
    <DexOverlay
      dex={inputs.dex}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={() => {}}
      ownedIngredientIds={inputs.ownedIngredientIds}
      unlockedForShopIngredientIds={inputs.unlockedForShopIngredientIds}
      inventory={inputs.inventory}
      onGoFreeCook={onGoFreeCook}
      onOpenShop={onOpenShop}
      onShowHint={handlers.onShowHint}
    />,
  );
  return { onGoFreeCook, onOpenShop };
}

const hintButtons = () => screen.queryAllByRole("button", { name: /ヒントを見る/ });
const cardOf = (button: HTMLElement) => button.closest(".dex-card") as HTMLElement;

function expectNoUndiscoveredIdentity(inputs: RecipeDiscoveryInputs, where: string) {
  // Text: the locked (undiscovered) cards, where a leak would come from -- discovered cards are
  // public and their descriptions / ingredient names may contain other recipes' names
  // (「ナポリ生まれ」, 「ジェノベーゼソース」). Attributes: the whole document.
  const text = [...document.querySelectorAll(".dex-card--locked")].map((c) => c.textContent ?? "").join("|");
  const attributes = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value));
  for (const r of RECIPES) {
    if (recipeDiscoveryState(r, inputs) === "DISCOVERED") continue;
    expect(text, `${where}: name ${r.nameJa}`).not.toContain(r.nameJa);
    expect(text, `${where}: description`).not.toContain(r.description);
    expect(attributes.filter((v) => v.split(/[\s:]/).includes(r.id)), `${where}: id ${r.id}`).toEqual([]);
  }
  expect(document.querySelectorAll(".dex-card--locked img, .dex-card--locked canvas, .dex-card--locked svg")).toHaveLength(0);
}

afterEach(() => cleanup());

describe("which cards get 「💡 ヒントを見る」", () => {
  it.each(Array.from({ length: 25 }, (_, c) => c))("Dex %i on the 25-ladder: exactly the DISCOVERABLE card, no duplicate Free Cooking CTA", (count) => {
    const inputs = ladder(count);
    const onShowHint = vi.fn();
    renderDex(inputs, { onShowHint });
    const buttons = hintButtons();
    expect(buttons).toHaveLength(1);
    const card = cardOf(buttons[0]);
    expect(card).toHaveAttribute("data-dex-state", "DISCOVERABLE");
    expect(card).toHaveTextContent("今の材料で作れるかも");
    expect(screen.queryByRole("button", { name: "フリークッキングで探す" })).not.toBeInTheDocument();
    fireEvent.click(buttons[0]);
    expect(onShowHint).toHaveBeenCalledWith(LADDER_ORDER[count]);
    expectNoUndiscoveredIdentity(inputs, `Dex ${count}`);
  });

  it("DISCOVERED, KNOWN_BUT_MISSING_MATERIAL and UNKNOWN cards never get it", () => {
    const inputs = ladder(6, "not-bought"); // today's recipe is KBMM: no DISCOVERABLE card at all
    renderDex(inputs);
    expect(hintButtons()).toHaveLength(0);
    expect(document.querySelectorAll('[data-dex-state="KNOWN_BUT_MISSING_MATERIAL"]').length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "ショップを見る" }).length).toBeGreaterThan(0);
    for (const card of document.querySelectorAll('[data-dex-state="UNKNOWN"]')) expect(card.querySelector("button")).toBeNull();
    expectNoUndiscoveredIdentity(inputs, "KBMM");
  });

  it("all 25 found: no hint CTA", () => {
    renderDex(ladder(25));
    expect(hintButtons()).toHaveLength(0);
  });

  it("several DISCOVERABLE cards (legacy save): each CTA hands over its own recipe, and only DISCOVERABLE ones", () => {
    const inputs = legacy();
    const onShowHint = vi.fn();
    renderDex(inputs, { onShowHint });
    const expected = RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").map((r) => r.id);
    expect(expected.length).toBeGreaterThanOrEqual(2);
    for (const b of hintButtons()) fireEvent.click(b);
    expect(onShowHint.mock.calls.map(([id]) => id).sort()).toEqual([...expected].sort());
    expectNoUndiscoveredIdentity(inputs, "legacy");
  });

  it("without onShowHint (Lunch Rush) the card keeps its 「フリークッキングで探す」 CTA", () => {
    const { onGoFreeCook } = renderDex(ladder(3), {});
    expect(hintButtons()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "フリークッキングで探す" }));
    expect(onGoFreeCook).toHaveBeenCalledTimes(1);
  });

  it("the chapters still render all 25 slots", () => {
    renderDex(ladder(11));
    expect(document.querySelectorAll(".dex-overlay__chapter")).toHaveLength(3);
    expect(document.querySelectorAll(".dex-card")).toHaveLength(25);
  });
});
