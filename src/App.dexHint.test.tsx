import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { getIngredient, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES } from "./data/recipes";


// Hint 5.0 is ON in production (H5-6). This suite pins the pre-Hint-5.0 purchase behaviour, which is the
// rollback path, so it runs with the ladder flag OFF.
vi.mock("./logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));
/**
 * Discovery Hint 2.0 (Issue #229, 229-D) through the real App, on a legacy save where several
 * undiscovered recipes are DISCOVERABLE at once (the LK-8 worst case). Since Discovery 3.0 PR-4b-A
 * (D-1 / D-2 / D-3) such a Dex shows ONE aggregated unknown and no per-card hint entrance, and the
 * Free Cooking sheet chooses no recipe. No undiscovered name ever shows (text or aria), no guided
 * round starts, Pizza Select stays discovered-only, and the save is untouched.
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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Dex with several DISCOVERABLE recipes through the App (229-D, PR-4b-A D-1 / D-2 / D-3)", () => {
  it("legacy save: no per-card hint entrance and no aggregate card (Research Entries); Free Cooking's sheet picks no recipe and sells nothing", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    expect(screen.queryAllByRole("button", { name: /ヒントを見る/ })).toHaveLength(0);
    expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(0); // #346 S4: all are Research Entries
    expect(document.querySelectorAll(".dex-research-card").length).toBeGreaterThanOrEqual(2);
    expectNoUndiscoveredName("Dex (research entries)");
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);

    // The old aggregate card's CTA is gone; HOME's own フリークッキング is the open (target-less) route.
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(document.querySelector(".dex-overlay")).toBeNull();
    await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
    expect(document.querySelector(".order-card--free-cook")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    const sheet = screen.getByRole("dialog", { name: /ヒント/ });
    // #353: 2+ registered Research Entries and no target: the sheet only asks the player to choose one.
    expect(sheet).toHaveTextContent("研究するピザを選ぼう");
    // No target: no purchase entrance at all, and nothing about which recipe or how many.
    expect(within(sheet).queryByRole("button", { name: "ヒントをもらう" })).toBeNull();
    expect(sheet.querySelector(".hint-sheet__next")).toBeNull();
    expect(sheet.textContent).not.toMatch(/\d/);
    expectNoUndiscoveredName("Free Cooking + CHOOSE_RESEARCH sheet");
    await user.click(within(sheet).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("#353: 「研究するピザを選ぶ」 leads to the Dex's Research cards; choosing one starts its research and shows its Hint sheet", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    const sheet = screen.getByRole("dialog", { name: /ヒント/ });
    expect(sheet.getAttribute("data-hint-kind")).toBe("CHOOSE_RESEARCH");
    await user.click(within(sheet).getByRole("button", { name: /研究するピザを選ぶ/ }));
    expect(screen.queryByRole("dialog", { name: /ヒント/ })).toBeNull();
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /ピザ.*を研究する/ })[0]);
    expect(document.querySelector(".dex-overlay")).toBeNull();
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    expect(screen.getByRole("dialog", { name: /ヒント/ }).getAttribute("data-hint-kind")).toBe("SELECTABLE");
  });

  it("LK-8: after the HOME Free Cooking route, HOME -> Pizza Select still lists no undiscovered recipe", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    seedLegacyDex15();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    expectNoUndiscoveredName("HOME after the Free Cooking route");
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    expectNoUndiscoveredName("Pizza Select after the Free Cooking route");
  });
});
