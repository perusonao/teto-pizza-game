import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopOverlay } from "./ShopOverlay";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { FAMILY_DISPLAY } from "../data/familyDisplay";
import { familiesPresent, ingredientShelf, majorsPresent } from "../data/ingredientShelf";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";

/** Ingredient Pantry / Category Tabs (OD-1 / OD-8): the Shop's two-tier shelf tabs (display filter only). */

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

const names = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("button")
    .map((b) => b.textContent);
const majorNames = () => names("材料の大分類");
const familyNames = () => names("具材の分類");
const familyRow = () => screen.queryByRole("group", { name: "具材の分類" });
const label = (family: keyof typeof FAMILY_DISPLAY) => FAMILY_DISPLAY[family].labelJa;
const tap = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const tapMajorAll = () => userEvent.click(within(screen.getByRole("group", { name: "材料の大分類" })).getByRole("button", { name: "すべて" }));

/** Ids the Shop lists as rows (NEW / OWNED). */
const listedIds = () => Array.from(document.querySelectorAll<HTMLElement>(".shop-item")).map((e) => e.dataset.ingredientId!);

describe("the major tabs come from the listed rows only", () => {
  it("shows only the majors that hold a listed material; 「すべて」 is first; the family row appears only under 具材", async () => {
    render(<ShopOverlay {...props(["egg", "gorgonzola", "ham", "mushroom", "olive-oil"])} />);
    expect(majorNames()).toEqual(["すべて", "ソース", "チーズ", "具材"]);
    expect(familyRow()).not.toBeInTheDocument();
    await tap("具材");
    expect(familyNames()).toEqual(["すべて", label("meat"), label("vegetable"), label("other")]);
    await tap("チーズ");
    expect(familyRow()).not.toBeInTheDocument();
  });

  it("a family that only holds LOCKED materials has no tab, no DOM node and no text", async () => {
    // Only meat is entitled. Every other family and role holds only LOCKED materials.
    render(<ShopOverlay {...props(["ham"])} />);
    expect(majorNames()).toEqual(["すべて", "具材"]);
    await tap("具材");
    expect(familyNames()).toEqual(["すべて", label("meat")]);
    for (const family of ["seafood", "vegetable", "fruit", "herb", "spice", "other"] as const) {
      expect(screen.queryByRole("button", { name: label(family) })).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain(label(family));
    }
    expect(document.body.textContent).not.toMatch(/ソース|チーズ|トッピング/);
  });

  it("the old 「トッピング」 chip does not exist, and there is no tablist / tab (role=group + aria-pressed, OD-7)", () => {
    render(<ShopOverlay {...props(["ham", "mushroom", "olive-oil"])} />);
    expect(screen.queryByRole("button", { name: "トッピング" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("shows no counts anywhere in either row", async () => {
    render(<ShopOverlay {...props(["ham", "mushroom", "olive-oil"])} />);
    await tap("具材");
    expect(screen.getByRole("group", { name: "材料の大分類" }).textContent).not.toMatch(/\d/);
    expect(screen.getByRole("group", { name: "具材の分類" }).textContent).not.toMatch(/\d/);
  });

  it("at every ladder step the tabs equal majorsPresent / familiesPresent of the listed rows", async () => {
    const steps = DISCOVERY_LADDER.steps;
    for (const n of [1, 2, 3, 5, 10, 11, 13, 15, 23, 24]) {
      const unlocked = materialIdsOfSteps(steps.filter((s) => s.step <= n));
      render(<ShopOverlay {...props(unlocked)} />);
      const listed = listedIds().map((id) => getIngredient(id)!);
      const majors = majorsPresent(listed).map((m) => (m === "topping" ? "具材" : m === "sauce" ? "ソース" : "チーズ"));
      expect(majorNames(), `Dex ${n}`).toEqual(["すべて", ...majors]);
      if (majors.includes("具材")) {
        await tap("具材");
        expect(familyNames(), `Dex ${n}`).toEqual(["すべて", ...familiesPresent(listed).map(label)]);
      }
      cleanup();
    }
  });

  it("nothing outside the entitled set is ever listed under any tab (LOCKED never appears)", async () => {
    const unlocked = ["egg", "ham", "mushroom"];
    render(<ShopOverlay {...props(unlocked)} />);
    await tap("具材");
    for (const name of familyNames() as string[]) {
      await userEvent.click(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name }));
      for (const id of listedIds()) expect(unlocked).toContain(id);
    }
  });
});

describe("filtering", () => {
  it("a family lists exactly its rows; 具材 lists every topping; すべて lists all; order kept", async () => {
    const unlocked = ["egg", "gorgonzola", "ham", "bacon", "mushroom", "olive-oil"];
    render(<ShopOverlay {...props(unlocked)} />);
    const all = listedIds();
    expect(new Set(all)).toEqual(new Set(unlocked));
    await tap("具材");
    expect(listedIds()).toEqual(all.filter((id) => ["egg", "ham", "bacon", "mushroom"].includes(id)));
    await tap(label("meat"));
    expect(listedIds()).toEqual(all.filter((id) => ingredientShelf(id) === "meat"));
    expect(listedIds().sort()).toEqual(["bacon", "ham"]);
    await tap("ソース");
    expect(listedIds()).toEqual(["olive-oil"]);
    await tapMajorAll();
    expect(listedIds()).toEqual(all);
  });

  it("aria-pressed follows the active tab in each tier", async () => {
    render(<ShopOverlay {...props(["ham", "mushroom"])} />);
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    await tap("具材");
    expect(screen.getByRole("button", { name: "具材" })).toHaveAttribute("aria-pressed", "true");
    await tap(label("vegetable"));
    expect(screen.getByRole("button", { name: label("vegetable") })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
  });

  it("OD-5 / OD-D: re-tapping 具材 keeps the family; another major resets it; coming back starts at 「すべて」", async () => {
    render(<ShopOverlay {...props(["ham", "mushroom", "olive-oil"])} />);
    await tap("具材");
    await tap(label("meat"));
    await tap("具材");
    expect(listedIds()).toEqual(["ham"]);
    await tap("ソース");
    await tap("具材");
    expect(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(listedIds().sort()).toEqual(["ham", "mushroom"]);
  });

  it("changing the filter dispatches nothing and changes no balance / stock", async () => {
    const p = props(["ham", "mushroom", "olive-oil"], [...STARTER_INGREDIENT_IDS, "ham"], { ham: 7 });
    render(<ShopOverlay {...p} />);
    for (const name of ["具材", label("meat"), "ソース", "具材", label("vegetable")]) await tap(name);
    await tapMajorAll();
    expect(p.onPurchase).not.toHaveBeenCalled();
    expect(p.onRestock).not.toHaveBeenCalled();
    expect(screen.getByText(/9999 Pitz/)).toBeInTheDocument();
  });

  it("purchase semantics under a family are unchanged, and the bought row stays visible", async () => {
    const p = props(["ham", "bacon"]);
    const { rerender } = render(<ShopOverlay {...p} />);
    await tap("具材");
    await tap(label("meat"));
    const hamRow = document.querySelector<HTMLElement>('.shop-item[data-ingredient-id="ham"]')!;
    await userEvent.click(within(hamRow).getByRole("button", { name: "仕入れる" }));
    expect(p.onPurchase).toHaveBeenCalledWith("ham");
    rerender(<ShopOverlay {...p} ownedIngredientIds={[...STARTER_INGREDIENT_IDS, "ham"]} inventory={{ ham: 30 }} />);
    expect(listedIds()).toContain("ham");
    expect(screen.getByRole("button", { name: label("meat") })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("family tag on the items (OD-3 / OD-F)", () => {
  it("a 具材 item shows its family tag on its own line under the name, whatever filter is active; sauce / cheese show none", async () => {
    render(<ShopOverlay {...props(["ham", "olive-oil", "gorgonzola"])} />);
    const row = (id: string) => document.querySelector<HTMLElement>(`.shop-item[data-ingredient-id="${id}"]`)!;
    const tag = row("ham").querySelector(".shop-item__family") as HTMLElement;
    expect(tag.textContent).toContain(label("meat"));
    // Its own line: a direct child of the item, not inside the name / info row.
    expect(tag.parentElement).toBe(row("ham"));
    expect(tag.previousElementSibling).toHaveClass("shop-item__row");
    expect(row("ham").querySelector(".shop-item__info .family-tag")).toBeNull();
    await tap("具材");
    await tap(label("meat"));
    expect(row("ham").querySelector(".shop-item__family")).not.toBeNull();
    for (const id of ["olive-oil", "gorgonzola"]) expect(row(id)?.querySelector(".family-tag") ?? null).toBeNull();
  });
});

describe("selected tab disappearing", () => {
  it("falls back to 「すべて」 (no empty list, no throw) when the active family is no longer listed", async () => {
    const { rerender } = render(<ShopOverlay {...props(["ham", "mushroom"])} />);
    await tap("具材");
    await tap(label("meat"));
    expect(listedIds()).toEqual(["ham"]);
    rerender(<ShopOverlay {...props(["mushroom"])} />);
    expect(familyNames()).toEqual(["すべて", label("vegetable")]);
    expect(within(screen.getByRole("group", { name: "具材の分類" })).getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(listedIds()).toEqual(["mushroom"]);
  });

  it("with no rows at all there is no tab row and the existing empty state stays", () => {
    render(<ShopOverlay {...props([])} />);
    expect(screen.queryByRole("group", { name: "材料の大分類" })).not.toBeInTheDocument();
    expect(screen.getByText(/新しいピザを発見すると/)).toBeInTheDocument();
  });
});

describe("unknown / unclassified are never guessed", () => {
  it("an unknown entitled id is ignored and creates no tab", () => {
    render(<ShopOverlay {...props(["ghost-ingredient", "ham"])} />);
    expect(majorNames()).toEqual(["すべて", "具材"]);
  });

  it("every production ingredient the Shop can list is reachable under a major tab", async () => {
    const all = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
    render(<ShopOverlay {...props(all)} />);
    const reachable = new Set<string>();
    for (const name of majorNames().slice(1) as string[]) {
      await userEvent.click(within(screen.getByRole("group", { name: "材料の大分類" })).getByRole("button", { name }));
      for (const id of listedIds()) reachable.add(id);
    }
    await tapMajorAll();
    for (const id of listedIds()) expect(reachable, id).toContain(id);
  });
});
