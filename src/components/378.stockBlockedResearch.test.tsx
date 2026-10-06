import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DexOverlay, RESEARCH_STOCK_NOTICE_JA } from "./DexOverlay";
import { ShopOverlay } from "./ShopOverlay";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES, getRecipe, type RecipeId } from "../data/recipes";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { researchEntryViews } from "../state/discoveryHint";
import { isResearchStockBlocked } from "../state/researchStockBlock";
import { discoveredDex } from "../state/testSupport/guidedRound";

/**
 * #378 Option 1 (OD-378-2/3/4/5): a registered Research Entry that cannot start because a required material is at
 * stock 0 says so (fixed, recipe-agnostic copy) and offers the Shop; the Shop marks EVERY owned material at stock 0.
 * Production data: step 25 with the non-credit brazilian-calabresa and aussie (TQ-1D) closed -> `pesto-pollo` is the single entry (needs chicken).
 */

afterEach(cleanup);

const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const finiteOf = (ids: readonly string[]) => ids.filter((id) => !!getIngredient(id)?.unlockCondition);

function save(step: number, extraDiscovered: readonly string[], stock: (id: string) => number, pitz = 1000): GameState {
  const owned = ladderOwned(step);
  const base = createInitialGameState(discoveredDex([...keysBefore(step), ...extraDiscovered]), owned, pitz, {}, [], owned.filter((id) => !!getIngredient(id)?.unlockCondition));
  return { ...base, inventory: Object.fromEntries(finiteOf(owned).map((id) => [id, stock(id)])) };
}
/** One entry (pesto-pollo); every material stocked except the ones in `zero`. */
const single = (zero: readonly string[] = []) => save(25, ["brazilian-calabresa", "aussie"], (id) => (zero.includes(id) ? 0 : 10));
/** Step 12: three entries (pizza-portuguesa + brazilian-calabresa + aussie). */
const multi = (stock: (id: string) => number) => save(12, [], stock);

function DexProps(s: GameState) {
  return {
    dex: s.dex,
    newlyDiscoveredId: null,
    newBestRecipeId: null,
    ownedIngredientIds: s.ownedIngredientIds,
    unlockedForShopIngredientIds: s.unlockedForShopIngredientIds,
    inventory: s.inventory,
    discoveryHintFacts: s.discoveryHintFacts,
  };
}

const researchSection = () => document.querySelector<HTMLElement>(".dex-overlay__research")!;
const NAMES = (ids: readonly string[]) => ids.map((id) => getIngredient(id)!.nameJa);

describe("A. stock-blocked Research card: notice + Shop CTA", () => {
  it("1: inventory sufficient -> the research CTA as before, no notice, no Shop CTA", () => {
    const s = single();
    render(<DexOverlay {...DexProps(s)} onClose={vi.fn()} onResearch={vi.fn()} onOpenShop={vi.fn()} />);
    expect(within(researchSection()).getByRole("button", { name: /を研究する/ })).toBeInTheDocument();
    expect(researchSection().textContent).not.toContain(RESEARCH_STOCK_NOTICE_JA);
    expect(within(researchSection()).queryByText(/ショップで補充する/)).toBeNull();
  });

  it("2: a required material at stock 0 -> the fixed notice and the Shop CTA (no research CTA)", () => {
    const s = single(["chicken"]);
    render(<DexOverlay {...DexProps(s)} onClose={vi.fn()} onResearch={vi.fn()} onOpenShop={vi.fn()} />);
    expect(researchSection()).toHaveTextContent(RESEARCH_STOCK_NOTICE_JA);
    expect(within(researchSection()).getByRole("button", { name: /ショップで補充する/ })).toBeInTheDocument();
    expect(within(researchSection()).queryByRole("button", { name: /を研究する/ })).toBeNull();
  });

  it("2b: without an onOpenShop the notice stays but no dead button is rendered", () => {
    render(<DexOverlay {...DexProps(single(["chicken"]))} onClose={vi.fn()} />);
    expect(researchSection()).toHaveTextContent(RESEARCH_STOCK_NOTICE_JA);
    expect(within(researchSection()).queryByRole("button")).toBeNull();
  });
});

describe("B. the stock-blocked contract is explicit (not 'cannot research')", () => {
  const recipe = getRecipe("pesto-pollo" as RecipeId)!;
  const base = single();
  const inputs = (s: GameState) => ({ dex: s.dex, ownedIngredientIds: s.ownedIngredientIds, inventory: s.inventory });

  it("true only for registered + a finite material at stock < 1", () => {
    expect(isResearchStockBlocked(recipe, inputs(single(["chicken"])))).toBe(true);
    expect(isResearchStockBlocked(recipe, inputs(single(["pesto"])))).toBe(true);
    expect(isResearchStockBlocked(recipe, inputs(base))).toBe(false);
  });

  it("false when the entry is not registered (a finite material is not owned) even though stock is 0", () => {
    const s = single(["chicken"]);
    expect(isResearchStockBlocked(recipe, { ...inputs(s), ownedIngredientIds: s.ownedIngredientIds.filter((id) => id !== "chicken") })).toBe(false);
  });

  it("false for a discovered recipe, and for a missing / non-numeric stock only when ALL are fine", () => {
    const s = single(["chicken"]);
    expect(isResearchStockBlocked(recipe, { ...inputs(s), dex: discoveredDex([...keysBefore(25), "brazilian-calabresa", "pesto-pollo"]) })).toBe(false);
    expect(isResearchStockBlocked(recipe, { ...inputs(s), inventory: { ...s.inventory, chicken: Number.NaN } })).toBe(true);
  });

  it("a non-stock reason for 'cannot research' never shows the Shop CTA (stock all sufficient)", () => {
    // Every material stocked: whatever else keeps the entry from starting, the card must not claim a stock problem.
    const s = single();
    render(<DexOverlay {...DexProps(s)} onClose={vi.fn()} onOpenShop={vi.fn()} />); // no onResearch wired at all
    expect(researchSection().textContent).not.toContain(RESEARCH_STOCK_NOTICE_JA);
    expect(within(researchSection()).queryByRole("button")).toBeNull();
  });
});

describe("C. Dex -> Shop -> refill -> Dex loop", () => {
  function Harness({ initial }: { initial: GameState }) {
    const [state, dispatch] = useReducer(gameReducer, initial);
    const [shop, setShop] = useState(false);
    const [dex, setDex] = useState(true);
    return (
      <>
        {dex && <DexOverlay {...DexProps(state)} onClose={() => setDex(false)} onResearch={vi.fn()} onOpenShop={() => setShop(true)} />}
        {shop && (
          <ShopOverlay
            dex={state.dex}
            ownedIngredientIds={state.ownedIngredientIds}
            unlockedForShopIngredientIds={state.unlockedForShopIngredientIds}
            pitzBalance={state.pitzBalance}
            inventory={state.inventory}
            onPurchase={(ingredientId) => dispatch({ type: "PURCHASE_INGREDIENT", ingredientId })}
            onRestock={(ingredientId) => dispatch({ type: "RESTOCK_INGREDIENT", ingredientId })}
            onClose={() => setShop(false)}
          />
        )}
      </>
    );
  }

  it("3-5: the CTA opens the Shop; closing returns to the Dex; a refill brings the research CTA back", async () => {
    const user = userEvent.setup();
    render(<Harness initial={single(["chicken"])} />);
    await user.click(within(researchSection()).getByRole("button", { name: /ショップで補充する/ }));
    const shop = document.querySelector<HTMLElement>(".shop-overlay__panel")!; // 3: ShopOverlay opened
    expect(shop).toBeInTheDocument();
    const chickenRow = shop.querySelector<HTMLElement>('[data-ingredient-id="chicken"]')!;
    expect(chickenRow).toHaveTextContent("在庫なし");
    await user.click(within(chickenRow).getByRole("button", { name: "補充する" }));
    expect(shop.querySelector('[data-ingredient-id="chicken"]')).not.toHaveTextContent("在庫なし");
    await user.click(within(shop).getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".shop-overlay__panel")).toBeNull(); // 4: Shop closed, Dex still there
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument();
    // 5: re-derived from the latest inventory
    expect(within(researchSection()).getByRole("button", { name: /を研究する/ })).toBeInTheDocument();
    expect(researchSection().textContent).not.toContain(RESEARCH_STOCK_NOTICE_JA);
  });
});

describe("D. Shop zero-stock mark (every owned material, never recipe-dependent)", () => {
  const renderShop = (s: GameState) =>
    render(
      <ShopOverlay dex={s.dex} ownedIngredientIds={s.ownedIngredientIds} unlockedForShopIngredientIds={s.unlockedForShopIngredientIds}
        pitzBalance={0} inventory={s.inventory} onPurchase={vi.fn()} onRestock={vi.fn()} onClose={vi.fn()} />,
    );
  const rowIds = () => Array.from(document.querySelectorAll<HTMLElement>(".shop-item")).map((r) => r.dataset.ingredientId);

  it("6: owned + stock 0 -> 在庫なし", () => {
    renderShop(single(["chicken", "capers"]));
    for (const id of ["chicken", "capers"]) {
      const row = document.querySelector<HTMLElement>(`[data-ingredient-id="${id}"]`)!;
      expect(row).toHaveTextContent("在庫なし");
      expect(row.dataset.stockState).toBe("EMPTY");
    }
  });

  it("7: stock > 0 -> no zero-stock mark", () => {
    renderShop(single(["chicken"]));
    const row = document.querySelector<HTMLElement>('[data-ingredient-id="pesto"]')!;
    expect(row).not.toHaveTextContent("在庫なし");
    expect(row.dataset.stockState).toBeUndefined();
    expect(document.querySelectorAll('[data-stock-state="EMPTY"]')).toHaveLength(1);
  });

  it("the mark and the row order do not depend on any Research Entry (same rows/order whatever the target needs)", () => {
    // Same zero set, two different dexes (different entries registered): identical mark set and identical order.
    renderShop(single(["chicken", "capers"]));
    const marked = Array.from(document.querySelectorAll<HTMLElement>('[data-stock-state="EMPTY"]')).map((r) => r.dataset.ingredientId);
    expect(marked.sort()).toEqual(["capers", "chicken"]);
    const order1 = rowIds();
    cleanup();
    const other = { ...single(["chicken", "capers"]), dex: discoveredDex(keysBefore(25)) };
    renderShop(other);
    expect(rowIds()).toEqual(order1);
  });

  it("a NEW (unbought) row is never marked out of stock", () => {
    const s = single();
    renderShop({ ...s, ownedIngredientIds: s.ownedIngredientIds.filter((id) => id !== "chicken") });
    expect(document.querySelector('[data-ingredient-id="chicken"]')).toHaveAttribute("data-shop-state", "NEW");
    expect(document.querySelector('[data-ingredient-id="chicken"]')).not.toHaveTextContent("在庫なし");
  });
});

describe("E. privacy / spoiler", () => {
  it("8: the stock-blocked card leaks no recipe name, required ingredient name, required count or missing count", () => {
    const s = single(["chicken"]);
    render(<DexOverlay {...DexProps(s)} onClose={vi.fn()} onResearch={vi.fn()} onOpenShop={vi.fn()} />);
    const text = researchSection().textContent ?? "";
    const recipe = getRecipe("pesto-pollo" as RecipeId)!;
    expect(text).not.toContain(recipe.nameJa);
    // Only the unlock fact (chicken, the last-acquired material) is named; no other required material is.
    const others = NAMES(recipe.requiredIngredients.map((r) => r.ingredientId).filter((id) => id !== "chicken"));
    for (const name of others) expect(text).not.toContain(name);
    expect(text).not.toMatch(/No\.|\d|あと|残り|不足|種類|個|\/|%/);
    expect(text).toContain("チキンを使う");
  });

  it("9: with several entries, every stock-blocked card reads the same (the missing material cannot be told apart)", () => {
    // Only the cards' own text; zero a different material per run -> identical card text.
    const textFor = (zero: string) => {
      cleanup();
      render(<DexOverlay {...DexProps(multi((id) => (id === zero ? 0 : 10)))} onClose={vi.fn()} onResearch={vi.fn()} onOpenShop={vi.fn()} />);
      return Array.from(researchSection().querySelectorAll(".dex-research-card")).map((c) => c.textContent);
    };
    const views = researchEntryViews({ dex: multi(() => 10).dex, ownedIngredientIds: multi(() => 10).ownedIngredientIds });
    expect(views.length).toBeGreaterThanOrEqual(2);
    // Zero an ingredient (onion) that both step-12 entries use: both blocked, with identical notice text.
    const both = textFor("onion");
    expect(both.every((t) => t!.includes(RESEARCH_STOCK_NOTICE_JA))).toBe(true);
    const noticeOnly = both.map((t) => t!.slice(t!.indexOf(RESEARCH_STOCK_NOTICE_JA)));
    expect(new Set(noticeOnly).size).toBe(1);
    // An ingredient only one of them uses blocks only that card; the blocked card's notice is unchanged.
    const one = textFor("sausage");
    const blocked = one.filter((t) => t!.includes(RESEARCH_STOCK_NOTICE_JA));
    expect(blocked.length).toBeGreaterThan(0);
    for (const t of blocked) expect(t!.slice(t!.indexOf(RESEARCH_STOCK_NOTICE_JA))).toBe(noticeOnly[0]);
    for (const t of one) for (const id of ["sausage", "onion"]) expect(t).not.toContain(`${getIngredient(id)!.nameJa}が`);
  });
});

describe("F. 「次のピザを作る」 is unchanged (close only)", () => {
  it("10: the Dex footer calls onClose and nothing else, blocked or not", async () => {
    const user = userEvent.setup();
    for (const zero of [[], ["chicken"]]) {
      cleanup();
      const onClose = vi.fn();
      const onOpenShop = vi.fn();
      const onResearch = vi.fn();
      const onGoFreeCook = vi.fn();
      render(<DexOverlay {...DexProps(single(zero))} onClose={onClose} onOpenShop={onOpenShop} onResearch={onResearch} onGoFreeCook={onGoFreeCook} />);
      await user.click(screen.getByRole("button", { name: "次のピザを作る" }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onOpenShop).not.toHaveBeenCalled();
      expect(onResearch).not.toHaveBeenCalled();
      expect(onGoFreeCook).not.toHaveBeenCalled();
    }
  });
});

describe("G. save/schema untouched", () => {
  it("12: the feature files read no persistence and add no save field", async () => {
    const fs = await import("node:fs");
    for (const f of ["src/state/researchStockBlock.ts"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).not.toMatch(/localStorage|persistence|schemaVersion/);
    }
    expect(RECIPES.length).toBe(33);
  });
});
