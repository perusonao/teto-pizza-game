import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ShopOverlay } from "./ShopOverlay";
import { ShopLockedSection } from "./ShopLockedSection";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { materialShopState } from "../logic/materialShop";
import { gameReducer, createInitialGameState } from "../state/gameReducer";
import type { DexState } from "../state/dex";

/**
 * #422 PR-B: the Shop's anonymous LOCKED section. The population is derived INDEPENDENTLY here
 * (not via the component's own helper): every non-starter ingredient that is neither owned nor
 * entitled -- whether or not it has a `materialOffer`.
 */

afterEach(cleanup);

function renderShop(owned: string[], unlocked: string[]) {
  const onPurchase = vi.fn();
  const onRestock = vi.fn();
  render(
    <ShopOverlay
      dex={[] as DexState}
      ownedIngredientIds={owned}
      unlockedForShopIngredientIds={unlocked}
      pitzBalance={9999}
      inventory={{}}
      onPurchase={onPurchase}
      onRestock={onRestock}
      onClose={vi.fn()}
    />,
  );
  return { onPurchase, onRestock };
}

function expectedLockedIds(owned: readonly string[], unlocked: readonly string[]): string[] {
  return INGREDIENTS.filter(
    (i) => !!i.unlockCondition && !STARTER_INGREDIENT_IDS.includes(i.id) && !owned.includes(i.id) && !unlocked.includes(i.id),
  ).map((i) => i.id);
}

const STARTERS = [...STARTER_INGREDIENT_IDS];
const slots = () => Array.from(document.querySelectorAll<HTMLElement>(".shop-locked__cell"));

describe("population", () => {
  it("one slot per LOCKED material: independent count, starters and UNLIMITED excluded", () => {
    const owned = [...STARTERS, "mushroom"];
    const unlocked = ["egg", "bacon"];
    renderShop(owned, unlocked);
    expect(slots()).toHaveLength(expectedLockedIds(owned, unlocked).length);
    expect(slots().length).toBeGreaterThan(0);
    // No starter is LOCKED
    for (const id of STARTERS) {
      expect(INGREDIENTS.find((i) => i.id === id) && materialShopState(INGREDIENTS.find((i) => i.id === id)!, owned, unlocked)).not.toBe("LOCKED");
    }
  });

  it("the count follows materialShopState only -- a material without a materialOffer is still a slot", () => {
    renderShop(STARTERS, []);
    const byState = INGREDIENTS.filter((i) => materialShopState(i, STARTERS, []) === "LOCKED");
    expect(slots()).toHaveLength(byState.length);
  });

  it("unlocking one material removes exactly one slot", () => {
    renderShop(STARTERS, []);
    const before = slots().length;
    cleanup();
    renderShop(STARTERS, ["egg"]);
    expect(slots()).toHaveLength(before - 1);
  });

  it("the section is absent when nothing is LOCKED", () => {
    const all = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
    renderShop([...STARTERS], all);
    expect(document.querySelector("[data-shop-locked-section]")).toBeNull();
    expect(slots()).toHaveLength(0);
  });

  it("ShopLockedSection renders nothing for 0 / negative / fractional counts", () => {
    for (const n of [0, -1, 1.5, Number.NaN]) {
      const { container } = render(<ShopLockedSection count={n} />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });
});

describe("anonymity", () => {
  it("LOCKED markup carries no name, id, emoji glyph, family, price or button -- and is identical for every slot", () => {
    const owned = [...STARTERS];
    const unlocked = ["egg"];
    renderShop(owned, unlocked);
    const section = document.querySelector<HTMLElement>("[data-shop-locked-section]")!;
    const html = section.innerHTML;
    const lockedIds = expectedLockedIds(owned, unlocked);
    for (const id of lockedIds) {
      const ing = INGREDIENTS.find((i) => i.id === id)!;
      expect(html, id).not.toContain(`"${id}"`);
      expect(html, id).not.toContain(ing.nameJa);
      if (ing.emoji) expect(html, id).not.toContain(ing.emoji);
    }
    expect(html).not.toMatch(/data-ingredient-id|Pitz|\u{1FA99}|在庫|仕入れる|補充する|ピザ分/u);
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
    const unique = new Set(slots().map((s) => s.innerHTML));
    expect(unique.size).toBe(1);
    // only enum-like data attribute on a slot
    for (const a of Array.from(section.querySelectorAll("*")).flatMap((e) => Array.from(e.attributes))) {
      if (a.name.startsWith("data-")) expect(["data-shop-locked-section", "data-shop-state"]).toContain(a.name);
    }
  });

  it("LOCKED slots are not in the NEW / OWNED list and not under any tab", () => {
    renderShop(STARTERS, ["egg"]);
    expect(document.querySelectorAll(".shop-item")).toHaveLength(1);
    expect(document.querySelector(".shop-overlay__list")!.querySelector("[data-shop-state='LOCKED']")).toBeNull();
    expect(screen.getByRole("group", { name: "材料の大分類" }).textContent).not.toContain("入荷前");
  });

  it("the section component has no access to the ingredient catalog", () => {
    const src = import.meta.glob<string>("./ShopLockedSection.tsx", { query: "?raw", import: "default", eager: true });
    const text = Object.values(src)[0];
    const imports = text.split("\n").filter((l) => l.startsWith("import"));
    expect(imports.join("\n")).not.toMatch(/\.\.\/(data|logic|state)|IngredientGlyph|FamilyTag/);
  });
});

describe("existing layout and purchase guards are untouched", () => {
  it("NEW / OWNED rows keep their single-column list and buttons", () => {
    const { onPurchase } = renderShop([...STARTERS, "mushroom"], ["egg"]);
    expect(document.querySelector(".shop-overlay__list")).not.toBeNull();
    expect(document.querySelectorAll(".shop-item")).toHaveLength(2);
    screen.getByRole("button", { name: "仕入れる" }).click();
    expect(onPurchase).toHaveBeenCalledWith("egg");
  });

  it("the reducer still refuses to buy a LOCKED material", () => {
    const state = createInitialGameState();
    const lockedId = expectedLockedIds(state.ownedIngredientIds, state.unlockedForShopIngredientIds)[0];
    const funded = { ...state, pitzBalance: 9999 };
    const next = gameReducer(funded, { type: "PURCHASE_INGREDIENT", ingredientId: lockedId });
    expect(next).toBe(funded);
  });
});
