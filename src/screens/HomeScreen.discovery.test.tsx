import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { HomeScreen } from "./HomeScreen";
import { homeBubbleJa } from "../state/homeBubble";
import { EMPTY_DEX } from "../state/dex";
import { RECIPES } from "../data/recipes";
import { newShopMaterialCount } from "../state/materialEntitlement";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";

afterEach(cleanup);

/** Progression 2.0 W1 Discovery 2.0 (W1-e): HOME only gains derived badges and bubble copy on top
 *  of the I5b-4 2+1 skeleton (HomeScreen.ctaLayout.test.tsx stays unchanged and green). */
function renderHome(p: { newShopMaterialCount?: number; dexHasNew?: boolean; discoverableCount?: number; locked?: boolean }) {
  render(
    <HomeScreen
      pitzBalance={0}
      dex={EMPTY_DEX}
      ownedIngredientCount={3}
      totalIngredientCount={29}
      onStartFreePlay={vi.fn()}
      onStartLunchRush={vi.fn()}
      onStartFreeCook={vi.fn()}
      lunchRushLocked={p.locked ?? false}
      onOpenDex={vi.fn()}
      onOpenShop={vi.fn()}
      onOpenInventory={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenRanking={vi.fn()}
      newShopMaterialCount={p.newShopMaterialCount}
      dexHasNew={p.dexHasNew}
      discoverableCount={p.discoverableCount}
    />,
  );
}

describe("W1-e HOME badges and bubble", () => {
  it("Shop card shows NEW n only while NEW materials wait; Dex card shows NEW only after a discovery", () => {
    renderHome({ newShopMaterialCount: 2, dexHasNew: true });
    expect(within(screen.getByRole("button", { name: /ショップ/ })).getByText("NEW 2")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /ピザ図鑑/ })).getByText("NEW")).toBeInTheDocument();
    cleanup();
    renderHome({});
    expect(document.querySelectorAll(".home-menu__badge")).toHaveLength(0);
  });

  it("bubble priority: Dex 0 -> NEW Shop material -> DISCOVERABLE -> default, never a recipe name", () => {
    const cases = [
      [{ lunchRushLocked: true, newShopMaterialCount: 1, discoverableCount: 1 }, "まずはフリークッキングで最初の1枚を見つけよう！"],
      [{ lunchRushLocked: false, newShopMaterialCount: 1, discoverableCount: 1 }, "ショップに新しい材料が入ったよ！"],
      [{ lunchRushLocked: false, newShopMaterialCount: 0, discoverableCount: 2 }, "今の材料で新しいピザが作れるかも！"],
      [{ lunchRushLocked: false, newShopMaterialCount: 0, discoverableCount: 0 }, "今日はどんなピザを作ろう？"],
    ] as const;
    for (const [input, text] of cases) {
      expect(homeBubbleJa(input)).toBe(text);
      for (const r of RECIPES) expect(text).not.toContain(r.nameJa);
    }
    renderHome({ discoverableCount: 1 });
    expect(document.querySelector(".home-hero__bubble")).toHaveTextContent("今の材料で新しいピザが作れるかも！");
  });

  it("the 2+1 CTA DOM order is unchanged by the badges", () => {
    renderHome({ newShopMaterialCount: 3, dexHasNew: true, locked: true });
    const ctas = Array.from(document.querySelectorAll(".home-cta-row .cta-button")).map((b) => b.textContent);
    expect(ctas).toEqual(["🍕 ピザを作る", "⏱️ ランチラッシュ", "🎨 フリークッキングで探す"]);
  });

  it("newShopMaterialCount counts unlocked-but-not-bought finite materials only", () => {
    expect(newShopMaterialCount([...STARTER_INGREDIENT_IDS], ["egg", "bacon"])).toBe(2);
    expect(newShopMaterialCount([...STARTER_INGREDIENT_IDS, "egg"], ["egg", "bacon"])).toBe(1);
    expect(newShopMaterialCount([...STARTER_INGREDIENT_IDS], [...STARTER_INGREDIENT_IDS])).toBe(0);
  });
});
