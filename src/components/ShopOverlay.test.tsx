import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopOverlay } from "./ShopOverlay";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import { MATERIAL_PACK_PIZZAS, materialOffer } from "../logic/materialShop";
import type { DexEntry, DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";

/**
 * Progression 2.0 W1 Integration I4b-4: the Discovery Ladder Shop UI (REC-04; LOCKED rows hidden,
 * NEW / OWNED rows, ladder progress hint). Every number asserted here is read back from
 * `materialOffer`, the same pure function the reducer charges by.
 */

afterEach(cleanup);

function discovered(count: number): DexState {
  return RECIPES.slice(0, count).map(
    (r): DexEntry => ({ recipeId: r.id, discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }),
  );
}

function renderShop({
  dex = discovered(1),
  owned = [...STARTER_INGREDIENT_IDS],
  unlocked = ["egg"],
  pitz = 100,
  inventory = {},
}: {
  dex?: DexState;
  owned?: string[];
  unlocked?: string[];
  pitz?: number;
  inventory?: InventoryState;
} = {}) {
  const onPurchase = vi.fn();
  const onRestock = vi.fn();
  const view = render(
    <ShopOverlay
      dex={dex}
      ownedIngredientIds={owned}
      unlockedForShopIngredientIds={unlocked}
      pitzBalance={pitz}
      inventory={inventory}
      onPurchase={onPurchase}
      onRestock={onRestock}
      onClose={vi.fn()}
    />,
  );
  return { ...view, onPurchase, onRestock };
}

function row(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.shop-item[data-ingredient-id="${id}"]`);
}

describe("rows: LOCKED hidden, NEW and OWNED shown", () => {
  it("only NEW and OWNED materials are listed -- never LOCKED ones, never starters", () => {
    renderShop({ owned: [...STARTER_INGREDIENT_IDS, "mushroom"], unlocked: ["egg"] });
    const listed = Array.from(document.querySelectorAll<HTMLElement>(".shop-item")).map((e) => e.dataset.ingredientId);
    expect(listed).toEqual(["egg", "mushroom"]); // NEW first, then OWNED
    expect(row("bacon")).toBeNull();
    for (const id of STARTER_INGREDIENT_IDS) expect(row(id)).toBeNull();
  });

  it("NEW: badge, stock 0, pack label, first-pack price and a 仕入れる button", () => {
    renderShop();
    const egg = row("egg")!;
    expect(egg.dataset.shopState).toBe("NEW");
    expect(within(egg).getByText("NEW 入荷")).toBeInTheDocument();
    expect(within(egg).getByText("在庫 0")).toBeInTheDocument();
    expect(within(egg).getByText(/10ピザ分（10個）/)).toBeInTheDocument();
    expect(within(egg).getByText(/初回 .*60 Pitz/)).toBeInTheDocument();
    expect(within(egg).getByRole("button", { name: "仕入れる" })).toBeEnabled();
    expect(within(egg).queryByRole("button", { name: "補充する" })).not.toBeInTheDocument();
  });

  it("OWNED: current stock, the refill pack, the refill price and a 補充する button", () => {
    renderShop({ owned: [...STARTER_INGREDIENT_IDS, "mushroom"], unlocked: [], inventory: { mushroom: 30 } });
    const mushroom = row("mushroom")!;
    expect(mushroom.dataset.shopState).toBe("OWNED");
    expect(within(mushroom).getByText("在庫 30")).toBeInTheDocument();
    expect(within(mushroom).getByText(/10ピザ分（30個）/)).toBeInTheDocument();
    expect(within(mushroom).getByText(/補充 .*30 Pitz/)).toBeInTheDocument();
    expect(within(mushroom).getByRole("button", { name: "補充する" })).toBeEnabled();
    expect(within(mushroom).queryByText("NEW 入荷")).not.toBeInTheDocument();
  });

  it("a sauce pack reads as 10 pizzas' worth (1 use per pizza), without a piece count", () => {
    renderShop({ unlocked: ["pesto"] });
    expect(within(row("pesto")!).getByText(/10ピザ分$/)).toBeInTheDocument();
    expect(within(row("pesto")!).queryByText(/個）/)).not.toBeInTheDocument();
  });

  it.each(materialIdsOfSteps(DISCOVERY_LADDER.steps))(
    "%s: every number shown equals materialOffer (NEW and OWNED)",
    (id) => {
      const ingredient = getIngredient(id)!;
      const offer = materialOffer(ingredient)!;
      const count = ingredient.placement === "scatter" ? `（${offer.packQuantity}個）` : "";
      const { unmount } = renderShop({ unlocked: [id], pitz: 999 });
      expect(within(row(id)!).getByText(`${MATERIAL_PACK_PIZZAS}ピザ分${count}`, { exact: false })).toBeInTheDocument();
      expect(within(row(id)!).getByText(new RegExp(`初回 .*${offer.packPrice} Pitz`))).toBeInTheDocument();
      unmount();
      renderShop({ owned: [id], unlocked: [id], pitz: 999, inventory: { [id]: 3 } });
      expect(within(row(id)!).getByText(new RegExp(`補充 .*${offer.refillPrice} Pitz`))).toBeInTheDocument();
      expect(within(row(id)!).getByText("在庫 3")).toBeInTheDocument();
    },
  );
});

describe("insufficient Pitz", () => {
  it("NEW: 仕入れる is disabled and the shortfall is shown; nothing is dispatched", async () => {
    const { onPurchase } = renderShop({ pitz: 45 });
    const egg = row("egg")!;
    const button = within(egg).getByRole("button", { name: "仕入れる" });
    expect(button).toBeDisabled();
    expect(within(egg).getByText("あと 15 Pitz たりません")).toBeInTheDocument();
    await userEvent.click(button);
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it("OWNED: 補充する is disabled below the refill price", () => {
    renderShop({ owned: ["egg"], unlocked: ["egg"], pitz: 29, inventory: { egg: 0 } });
    expect(within(row("egg")!).getByRole("button", { name: "補充する" })).toBeDisabled();
    expect(within(row("egg")!).getByText("あと 1 Pitz たりません")).toBeInTheDocument();
  });

  it("exact balance is enough (no shortfall line)", () => {
    renderShop({ pitz: 60 });
    expect(within(row("egg")!).getByRole("button", { name: "仕入れる" })).toBeEnabled();
    expect(document.querySelector(".shop-item__shortfall")).toBeNull();
  });
});

describe("dispatch", () => {
  it("仕入れる dispatches the first-pack purchase; 補充する the refill", async () => {
    const { onPurchase, onRestock } = renderShop({
      owned: [...STARTER_INGREDIENT_IDS, "mushroom"],
      unlocked: ["egg"],
      inventory: { mushroom: 1 },
    });
    await userEvent.click(within(row("egg")!).getByRole("button", { name: "仕入れる" }));
    expect(onPurchase).toHaveBeenCalledWith("egg");
    await userEvent.click(within(row("mushroom")!).getByRole("button", { name: "補充する" }));
    expect(onRestock).toHaveBeenCalledWith("mushroom");
  });
});

describe("progress hint", () => {
  it("names how many discoveries bring the next material, without naming the material", () => {
    renderShop({ dex: discovered(1), unlocked: ["egg"] });
    const hint = document.querySelector(".shop-overlay__progress")!;
    expect(hint.textContent).toMatch(/あと1つ発見で新しい材料が入荷/);
    // Step 2 is bacon: never spoiled.
    expect(hint.textContent).not.toContain(getIngredient("bacon")!.nameJa);
    expect(document.body.textContent).not.toContain(getIngredient("bacon")!.nameJa);
  });

  it("is shown on a fresh save too (Dex 0 -> step 1)", () => {
    renderShop({ dex: [], unlocked: [] });
    expect(screen.getByText(/あと1つ発見で新しい材料が入荷/)).toBeInTheDocument();
    expect(screen.getByText("新しいピザを発見すると、材料が入荷します")).toBeInTheDocument();
  });

  it("is gone once the final ladder step is reached", () => {
    const all = materialIdsOfSteps(DISCOVERY_LADDER.steps);
    renderShop({ dex: discovered(DISCOVERY_LADDER.steps.length), unlocked: all });
    expect(document.querySelector(".shop-overlay__progress")).toBeNull();
    cleanup();
    renderShop({ dex: discovered(15), unlocked: all });
    expect(document.querySelector(".shop-overlay__progress")).toBeNull();
  });

  it("with the step before the last reached, the hint still shows", () => {
    renderShop({ dex: discovered(DISCOVERY_LADDER.steps.length - 1) });
    expect(screen.getByText(/あと1つ発見で新しい材料が入荷/)).toBeInTheDocument();
  });
});

describe("copy", () => {
  it("no star-based material wording and no free-gift wording anywhere in the Shop", () => {
    const all = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
    renderShop({ dex: [], owned: all.slice(0, 5), unlocked: all.slice(5, 10), pitz: 0 });
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/★|腕前|プレゼント|無料|\u{1F512}/u);
  });
});

describe("no EP4 gift wording anywhere in production UI source", () => {
  const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../test/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("no production module carries the retired Starter Grant gift copy", () => {
    const hits = Object.entries(sources)
      .filter(([, text]) => /プレゼントしました|無料で獲得|\\u\{1F381\}|🎁/.test(text))
      .map(([path]) => path);
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(hits).toEqual([]);
  });
});
