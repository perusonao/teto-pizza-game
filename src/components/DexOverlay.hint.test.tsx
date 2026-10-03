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

function ladder(count: number, newest: "bought" | "not-bought" = "bought", extraFound: readonly string[] = []): RecipeDiscoveryInputs {
  const dex = discover([...LADDER_ORDER.slice(0, count), ...extraFound]);
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
  // Pool-size aware (Discovery 3.0 PR-4a / PR-4b-A / PR-4b-B): a W1 step's key recipe is always
  // DISCOVERABLE, but the non-credit brazilian-calabresa is DISCOVERABLE beside it from Dex 12 (the
  // onion step) until it is found. The expectation is derived from the recipe states: one candidate
  // keeps its own card + hint; two or more have no per-card hint entrance. #346 S4: every candidate here is a
  // registered Research Entry (guided by its own research card), so no aggregate card is shown for them either.
  it.each(Array.from({ length: 25 }, (_, c) => c))("Dex %i on the 25-ladder: exactly the DISCOVERABLE cards, no duplicate Free Cooking CTA", (count) => {
    const inputs = ladder(count);
    const onShowHint = vi.fn();
    renderDex(inputs, { onShowHint });
    const expected = RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").map((r) => r.id);
    expect(expected).toContain(LADDER_ORDER[count]);
    expect(expected.length).toBe(count >= 12 ? 2 : 1);
    if (expected.length > 1) {
      expect(hintButtons()).toHaveLength(0);
      expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(0); // #346 S4: all are Research Entries
      expect(document.querySelectorAll('[data-dex-state="DISCOVERABLE"]')).toHaveLength(0);
      expect(document.querySelectorAll(".dex-research-card").length).toBeGreaterThanOrEqual(2);
      expectNoUndiscoveredIdentity(inputs, `Dex ${count} (pool 2)`);
      return;
    }
    const buttons = hintButtons();
    expect(buttons).toHaveLength(expected.length);
    for (const b of buttons) {
      const card = cardOf(b);
      expect(card).toHaveAttribute("data-dex-state", "DISCOVERABLE");
      expect(card).toHaveTextContent("今の材料で作れるかも");
    }
    expect(screen.queryByRole("button", { name: "レシピ発見へ" })).not.toBeInTheDocument();
    for (const b of buttons) fireEvent.click(b);
    expect(onShowHint.mock.calls.map(([id]) => id).sort()).toEqual([...expected].sort());
    expectNoUndiscoveredIdentity(inputs, `Dex ${count}`);
  });

  it.each(Array.from({ length: 13 }, (_, c) => c + 12))("Dex %i with the non-credit calabresa already found: pool 1 again, the key recipe's own card + hint", (count) => {
    const inputs = ladder(count, "bought", ["brazilian-calabresa"]);
    const onShowHint = vi.fn();
    renderDex(inputs, { onShowHint });
    expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(0);
    const buttons = hintButtons();
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onShowHint.mock.calls.map(([id]) => id)).toEqual([LADDER_ORDER[count]]);
    expectNoUndiscoveredIdentity(inputs, `Dex ${count} (calabresa found)`);
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

  it("every recipe found: no hint CTA", () => {
    const inputs = ladder(25);
    renderDex({ ...inputs, dex: discover(RECIPES.map((r) => r.id)) });
    expect(hintButtons()).toHaveLength(0);
  });

  it("several DISCOVERABLE (legacy save): no per-card hint entrance, no aggregate card for Research Entries, no count (D-2 / D-3, S4)", () => {
    const inputs = legacy();
    const onShowHint = vi.fn();
    const { onGoFreeCook } = renderDex(inputs, { onShowHint });
    expect(RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").length).toBeGreaterThanOrEqual(2);
    expect(hintButtons()).toHaveLength(0);
    expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(0);
    expect(document.querySelectorAll('[data-dex-state="DISCOVERABLE"]')).toHaveLength(0);
    // The candidates' own slots read as plain unknown slots: nothing numbered, tagged or clickable.
    expect(document.querySelectorAll(".dex-research-card").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("button", { name: "レシピ発見へ" })).toBeNull();
    expect(onGoFreeCook).not.toHaveBeenCalled();
    expect(onShowHint).not.toHaveBeenCalled();
    expectNoUndiscoveredIdentity(inputs, "legacy");
  });

  it("without onShowHint (Lunch Rush) the card keeps its 「フリークッキングで探す」 CTA", () => {
    const { onGoFreeCook } = renderDex(ladder(3), {});
    expect(hintButtons()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "レシピ発見へ" }));
    expect(onGoFreeCook).toHaveBeenCalledTimes(1);
  });

  it("the chapters still render all 27 slots", () => {
    renderDex(ladder(11));
    expect(document.querySelectorAll(".dex-overlay__chapter")).toHaveLength(3);
    expect(document.querySelectorAll(".dex-card")).toHaveLength(27);
  });
});

describe("Dex pool 0 / 1 / 2+ (PR-4b-A D-2 / D-3)", () => {
  const aggregated = () => document.querySelectorAll("[data-dex-aggregated]");

  it("pool 0 and pool 1 never show the aggregated unknown (pool 1 keeps its own 🎨 card + hint)", () => {
    renderDex(ladder(25, "bought", ["brazilian-calabresa"]));
    expect(aggregated()).toHaveLength(0);
    cleanup();
    // Dex 12+ is pool 1 only once the non-credit calabresa has been found (otherwise it is pool 2).
    for (const count of [0, 5, 11, 12, 24]) {
      const inputs = ladder(count, "bought", count >= 12 ? ["brazilian-calabresa"] : []);
      expect(RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE")).toHaveLength(1);
      renderDex(inputs);
      expect(aggregated(), `Dex ${count}`).toHaveLength(0);
      expect(hintButtons(), `Dex ${count}`).toHaveLength(1);
      cleanup();
    }
  });

  it("pool 2+ (any save, state-derived): no aggregate card for Research Entries, the 27 slots are unchanged, nothing numbered or counted", () => {
    const inputs = legacy();
    const candidates = RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE");
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    renderDex(inputs);
    expect(aggregated()).toHaveLength(0); // #346 S4: every candidate is a registered Research Entry
    expect(document.querySelectorAll(".dex-overlay__chapter .dex-card")).toHaveLength(27);
    expect(hintButtons()).toHaveLength(0);
    // The candidates' own slots are plain unknown slots: no 🎨 tag, no button, no CTA.
    expect(document.querySelectorAll(".dex-overlay__chapter [data-dex-state=\"DISCOVERABLE\"]")).toHaveLength(0);
    expect(document.querySelectorAll(".dex-overlay__chapter .dex-card--tagged .dex-card__tag-cta--hint")).toHaveLength(0);
    // Anti-leak: no candidate count anywhere in the research section, nor in any attribute.
    const section = document.querySelector(".dex-overlay__research") as HTMLElement;
    expect([...section.querySelectorAll("*"), section].flatMap((el) => [...el.attributes].map((a) => a.name))).toEqual(
      expect.not.arrayContaining(["data-count", "data-dex-count"]),
    );
    expect(document.body.innerHTML).not.toMatch(new RegExp(`(?:data|aria)-[a-z-]*(?:count|pool|candidate)`, "i"));
    expectNoUndiscoveredIdentity(inputs, "pool 2+");
  });

  it("no aggregate card whether 2 or 3+ recipes can be found, and no count leaks through the DOM (Research Entries only)", () => {
    const two = legacy();
    renderDex(two);
    expect(aggregated()).toHaveLength(0);
    cleanup();
    // Fewer recipes found with the same materials owned: a different number are DISCOVERABLE.
    const richer = { ...two, dex: discover(RECIPES.slice(0, 10).map((r) => r.id)) };
    const nTwo = RECIPES.filter((r) => recipeDiscoveryState(r, two) === "DISCOVERABLE").length;
    const nRicher = RECIPES.filter((r) => recipeDiscoveryState(r, richer) === "DISCOVERABLE").length;
    expect(nRicher).not.toBe(nTwo);
    renderDex(richer);
    expect(aggregated()).toHaveLength(0);
  });
});
