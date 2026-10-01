import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { getIngredient, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";
import { W1_25_DISCOVERY_LADDER } from "./data/discoveryLadder";


// Hint 5.0 is ON in production (H5-6). This suite pins the pre-Hint-5.0 purchase behaviour, which is the
// rollback path, so it runs with the ladder flag OFF.
vi.mock("./logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));
/**
 * Discovery Hint 2.0 (Issue #229, 229-D) through the real App: a Dex 🎨 card's 「💡 ヒントを見る」
 * closes the Dex, starts Free Cooking and opens the hint sheet -- on a legacy save where several
 * undiscovered recipes are DISCOVERABLE at once (the LK-8 worst case). No undiscovered name ever
 * shows (text or aria), no guided round starts, Pizza Select stays discovered-only. Discovery Hint
 * Economy 1.0 (Issue #232, HE-2): the H1 bought on each card is the only change to the save.
 */

const OLD15 = RECIPES.slice(0, 15);
const UNDISCOVERED_NAMES = RECIPES.slice(15).map((r) => r.nameJa);
const MATERIALS = [
  ...new Set(OLD15.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)).filter((id) => !!getIngredient(id)?.unlockCondition)),
];

function seedLegacyDex15(): void {
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: OLD15.map((r) => ({ recipeId: r.id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...MATERIALS],
      missionBest: {},
      inventory: Object.fromEntries(MATERIALS.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
    }),
  );
}

function expectNoUndiscoveredName(where: string) {
  const text = document.body.textContent ?? "";
  const labels = [...document.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value)).join("|");
  for (const name of UNDISCOVERED_NAMES) {
    expect(text, `${where}: ${name}`).not.toContain(name);
    expect(labels, `${where} attributes: ${name}`).not.toContain(name);
  }
  for (const r of RECIPES.slice(15)) expect(labels, `${where} attribute id ${r.id}`).not.toMatch(new RegExp(`(^|[|\\s:])${r.id}($|[|\\s:])`));
}

/** The 25 ladder after `count` discoveries, materials owned and stocked: exactly one DISCOVERABLE recipe (pool 1). */
function seedLadder(count: number): void {
  const order = ["margherita", ...W1_25_DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)].slice(0, count);
  const mats = W1_25_DISCOVERY_LADDER.steps.filter((s) => s.step <= count).flatMap((s) => s.ingredientIds);
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: order.map((id) => ({ recipeId: id, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...mats],
      missionBest: {},
      inventory: Object.fromEntries(mats.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
    }),
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Dex 「💡 ヒントを見る」 through the App (229-D)", () => {
  it("the one DISCOVERABLE card (pool 1): Dex closes, Free Cooking PREPARE starts with the hint sheet, nothing leaks, only the purchase is saved", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLadder(3);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    expect(screen.getAllByRole("button", { name: /ヒントを見る/ })).toHaveLength(1);
    expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(0);
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);

    expectNoUndiscoveredName("Dex before the card");
    await user.click(screen.getByRole("button", { name: /ヒントを見る/ }));
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(document.querySelector(".order-card--free-cook")).toBeInTheDocument();
    const sheet = screen.getByRole("dialog", { name: /ヒント/ });
    // DH4-2C U3-C: 「ヒントをもらう」 opens the family panel; the 材料 card asks.
    await user.click(within(sheet).getByRole("button", { name: "ヒントをもらう" }));
    await waitFor(() => expect(sheet.querySelector(".hint-sheet__next")).not.toHaveAttribute("aria-disabled"), { timeout: 2000 });
    await user.click(sheet.querySelector<HTMLButtonElement>(".hint-sheet__next")!);
    // H3-3: the Selectable sheet -- the free key plus the one fact just bought.
    expect(sheet.querySelectorAll(".hint-sheet__chip:not(.hint-sheet__chip--unknown)")).toHaveLength(2);
    expectNoUndiscoveredName("Free Cooking + sheet");
    await user.click(within(sheet).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".prepare-bake-bar")).toBeInTheDocument();

    const after = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);
    const { pitzBalance, discoveryHintFacts, ...rest } = after;
    // One first fact (5 Pitz) on its own recipe; the legacy ledger never moves.
    expect(pitzBalance).toBe(500 - 5);
    expect(Object.values(discoveryHintFacts).map((facts) => (facts as string[]).length)).toEqual([1]);
    const { pitzBalance: _p, discoveryHintFacts: _f, ...restBefore } = JSON.parse(before!);
    void _p;
    void _f;
    expect(rest).toEqual(restBefore);
  });

  it("PR-4b-A (D-1 / D-2): a migrated save with several DISCOVERABLE recipes shows one aggregated notice, no per-card hint, and the hint sheet auto-targets nothing", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    expect(screen.queryAllByRole("button", { name: /ヒントを見る/ })).toHaveLength(0);
    expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(1);
    expectNoUndiscoveredName("Dex with an aggregated unknown");
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);

    // The notice's CTA is plain Free Cooking (no pin); the sheet then says only that something is left.
    await user.click(within(document.querySelector<HTMLElement>("[data-dex-aggregated]")!).getByRole("button", { name: "フリークッキングで探す" }));
    expect(document.querySelector(".order-card--free-cook")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    const sheet = screen.getByRole("dialog", { name: /ヒント/ });
    expect(sheet).toHaveTextContent("まだ見つけていないピザがありそう");
    expect(within(sheet).queryByRole("button", { name: "ヒントをもらう" })).not.toBeInTheDocument();
    expectNoUndiscoveredName("Free Cooking + POOL sheet");
    await user.click(within(sheet).getByRole("button", { name: "閉じる" }));
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("LK-8: after a Dex hint round, HOME -> Pizza Select still lists no undiscovered recipe", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLadder(3);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    await user.click(screen.getAllByRole("button", { name: /ヒントを見る/ })[0]);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "閉じる" }));
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expectNoUndiscoveredName("HOME after a Dex hint round");
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expectNoUndiscoveredName("Pizza Select after a Dex hint round");
  });
});
