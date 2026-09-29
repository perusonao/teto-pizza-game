import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopOverlay } from "./ShopOverlay";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENT_SHELF_ORDER, ingredientShelf, ingredientShelfLabel, shelvesPresent } from "../data/ingredientShelf";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";

/** Ingredient Category Tabs 1.0 Phase 3: the Shop's shelf chips (display filter only). */

afterEach(cleanup);

const DEX: DexState = [];

function props(unlocked: readonly string[], owned: readonly string[] = STARTER_INGREDIENT_IDS, inventory: InventoryState = {}) {
  return {
    dex: DEX,
    ownedIngredientIds: owned,
    unlockedForShopIngredientIds: unlocked,
    pitzBalance: 9999,
    inventory,
    onPurchase: vi.fn(),
    onRestock: vi.fn(),
    onClose: vi.fn(),
  };
}

const chipNames = () =>
  within(screen.getByRole("group", { name: "材料の分類" }))
    .getAllByRole("button")
    .map((b) => b.textContent);

/** Ids the Shop lists as rows (NEW / OWNED). */
const listedIds = () => Array.from(document.querySelectorAll<HTMLElement>(".shop-item")).map((e) => e.dataset.ingredientId!);

describe("chips come from the listed rows only", () => {
  it("shows only shelves that hold a listed material; 「すべて」 is first; authority order", () => {
    render(<ShopOverlay {...props(["egg", "gorgonzola", "ham", "mushroom", "olive-oil"])} />);
    expect(chipNames()).toEqual(["すべて", "ソース", "チーズ", "肉", "野菜・きのこ", "その他"]);
  });

  it("a shelf that only holds LOCKED materials has no chip, no DOM node and no text", () => {
    // Only meat is entitled. Every other shelf holds only LOCKED materials.
    render(<ShopOverlay {...props(["ham"])} />);
    expect(chipNames()).toEqual(["すべて", "肉"]);
    for (const shelf of INGREDIENT_SHELF_ORDER.filter((s) => s !== "meat")) {
      const label = ingredientShelfLabel(shelf)!;
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain(label);
    }
    expect(document.querySelectorAll("[hidden], [aria-hidden='true']")).toHaveLength(
      document.querySelectorAll(".shop-item [aria-hidden='true'], .shop-item [hidden]").length,
    );
    expect(document.body.textContent).not.toMatch(/トッピング/);
  });

  it("the old 「トッピング」 chip does not exist, and there is no tablist / tab", () => {
    render(<ShopOverlay {...props(["ham", "mushroom", "olive-oil"])} />);
    expect(screen.queryByRole("button", { name: "トッピング" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows no counts anywhere in the chip row", () => {
    render(<ShopOverlay {...props(["ham", "mushroom", "olive-oil"])} />);
    expect(screen.getByRole("group", { name: "材料の分類" }).textContent).not.toMatch(/\d/);
  });

  it("at every ladder step the chips equal shelvesPresent(listed rows), never a shelf before its first row", () => {
    const steps = DISCOVERY_LADDER.steps;
    let before: string[] = [];
    for (const n of [1, 2, 3, 5, 10, 11, 13, 15, 23, 24]) {
      const unlocked = materialIdsOfSteps(steps.filter((s) => s.step <= n));
      render(<ShopOverlay {...props(unlocked)} />);
      const listed = listedIds().map((id) => getIngredient(id)!);
      const expected = ["すべて", ...shelvesPresent(listed).map((s) => ingredientShelfLabel(s)!)];
      expect(chipNames(), `Dex ${n}`).toEqual(expected);
      const shown = chipNames().slice(1) as string[];
      for (const label of before) expect(shown, `Dex ${n} kept ${label}`).toContain(label);
      before = shown;
      cleanup();
    }
  });

  it("nothing outside the entitled set is ever listed under any chip (LOCKED never appears)", async () => {
    const unlocked = ["egg", "ham", "mushroom"];
    render(<ShopOverlay {...props(unlocked)} />);
    for (const name of chipNames() as string[]) {
      await userEvent.click(screen.getByRole("button", { name }));
      for (const id of listedIds()) expect(unlocked).toContain(id);
    }
  });
});

describe("filtering", () => {
  it("selecting a shelf lists exactly that shelf's rows; すべて lists all; order kept", async () => {
    const unlocked = ["egg", "gorgonzola", "ham", "bacon", "mushroom", "olive-oil"];
    render(<ShopOverlay {...props(unlocked)} />);
    const all = listedIds();
    expect(new Set(all)).toEqual(new Set(unlocked));
    await userEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(listedIds()).toEqual(all.filter((id) => ingredientShelf(id) === "meat"));
    expect(listedIds().sort()).toEqual(["bacon", "ham"]);
    await userEvent.click(screen.getByRole("button", { name: "ソース" }));
    expect(listedIds()).toEqual(["olive-oil"]);
    await userEvent.click(screen.getByRole("button", { name: "すべて" }));
    expect(listedIds()).toEqual(all);
  });

  it("aria-pressed follows the active chip", async () => {
    render(<ShopOverlay {...props(["ham", "mushroom"])} />);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "野菜・きのこ" }));
    expect(screen.getByRole("button", { name: "野菜・きのこ" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
  });

  it("changing the filter dispatches nothing and changes no balance / stock", async () => {
    const p = props(["ham", "mushroom", "olive-oil"], [...STARTER_INGREDIENT_IDS, "ham"], { ham: 7 });
    render(<ShopOverlay {...p} />);
    for (const name of ["肉", "ソース", "野菜・きのこ", "すべて"]) await userEvent.click(screen.getByRole("button", { name }));
    expect(p.onPurchase).not.toHaveBeenCalled();
    expect(p.onRestock).not.toHaveBeenCalled();
    expect(screen.getByText(/9999 Pitz/)).toBeInTheDocument();
  });

  it("purchase semantics under a shelf are unchanged, and the bought row stays visible", async () => {
    const p = props(["ham", "bacon"]);
    const { rerender } = render(<ShopOverlay {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "肉" }));
    const hamRow = document.querySelector<HTMLElement>('.shop-item[data-ingredient-id="ham"]')!;
    await userEvent.click(within(hamRow).getByRole("button", { name: "仕入れる" }));
    expect(p.onPurchase).toHaveBeenCalledWith("ham");
    rerender(<ShopOverlay {...p} ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "ham"]} inventory={{ ham: 30 }} />);
    expect(listedIds()).toContain("ham");
    expect(screen.getByRole("button", { name: "肉" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("selected shelf disappearing", () => {
  it("falls back to 「すべて」 (no empty list, no throw) when the active shelf is no longer listed", async () => {
    const { rerender } = render(<ShopOverlay {...props(["ham", "mushroom"])} />);
    await userEvent.click(screen.getByRole("button", { name: "肉" }));
    expect(listedIds()).toEqual(["ham"]);
    rerender(<ShopOverlay {...props(["mushroom"])} />);
    expect(chipNames()).toEqual(["すべて", "野菜・きのこ"]);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(listedIds()).toEqual(["mushroom"]);
  });

  it("with no rows at all there is no chip row and the existing empty state stays", () => {
    render(<ShopOverlay {...props([])} />);
    expect(screen.queryByRole("group", { name: "材料の分類" })).not.toBeInTheDocument();
    expect(screen.getByText(/新しいピザを発見すると/)).toBeInTheDocument();
  });
});

describe("unknown / unclassified are never guessed", () => {
  it("an unknown entitled id is ignored and creates no chip", () => {
    render(<ShopOverlay {...props(["ghost-ingredient", "ham"])} />);
    expect(chipNames()).toEqual(["すべて", "肉"]);
  });

  it("every production ingredient the Shop can list maps to a chip label", () => {
    const all = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
    render(<ShopOverlay {...props(all)} />);
    const labels = chipNames().slice(1);
    for (const id of listedIds()) expect(labels).toContain(ingredientShelfLabel(ingredientShelf(id)!));
  });
});
