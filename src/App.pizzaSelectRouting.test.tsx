import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { DISCOVERY_LADDER } from "./data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { getRecipe, type RecipeId } from "./data/recipes";
import { deriveResearchEntries } from "./logic/discovery/researchEntry";
import { createInitialGameState } from "./state/gameReducer";
import { discoveredDex } from "./state/testSupport/guidedRound";
import { startTargetlessFreeCookViaTestHook } from "./test/discoveryEntry";

/**
 * Issue #377 (OD-377-1) through the real App: Pizza Select's 「レシピ発見へ」 uses HOME's Research Entry routing
 * (0 targetless / 1 that entry is the Research Target / 2+ the Dex's Research cards). Production data only (ladder
 * step 12 = 3 entries, step 25 + calabresa and aussie closed = 1, a fresh save = 0). Mirrors App.homeDiscovery.test.tsx so the two
 * doors are compared on identical saves.
 */

const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

function seed(step: number, extraDiscovered: readonly string[] = [], drain: readonly string[] = []): void {
  const materials = materialsUpTo(step);
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: [...keysBefore(step), ...extraDiscovered].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...materials],
      missionBest: {},
      inventory: Object.fromEntries(materials.map((m) => [m, drain.includes(m) ? 0 : 30])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materials,
    }),
  );
}
const seedSingle = () => seed(25, ["brazilian-calabresa", "aussie"]);
const seedMulti = () => seed(12);

/** #378: the registered entries of the step-12 save, and a finite material only the second one needs (draining it stock-blocks that entry alone). */
function multiDrainTarget(): string {
  const owned = [...STARTER_INGREDIENT_IDS, ...materialsUpTo(12)];
  const s = createInitialGameState(discoveredDex([...keysBefore(12), "aussie"]), owned, 1000); // portuguesa + calabresa registered
  const [a, b] = deriveResearchEntries(s).entries.map((e) => e.recipeId);
  const finiteOf = (id: string) =>
    new Set(getRecipe(id as RecipeId)!.requiredIngredients.map((r) => r.ingredientId).filter((i) => !!getIngredient(i)?.unlockCondition));
  const onlyB = [...finiteOf(b)].find((i) => !finiteOf(a).has(i));
  expect(onlyB, "fixture: an entry-B-only material").toBeTruthy();
  return onlyB!;
}

type User = ReturnType<typeof userEvent.setup>;
const homeDiscovery = (user: User) => user.click(screen.getByRole("button", { name: /レシピ発見/ }));
const pizzaSelectDiscovery = async (user: User) => {
  await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
  await user.click(screen.getByRole("button", { name: /レシピ発見へ/ }));
};
/** Owner decision (#401 HV): the Research context is no longer a card above the pizza; it is the first lines of the ヒント sheet.
 *  Opens the sheet, takes its research line, closes it again (null: no ヒント button here, or no Research Target). */
const researchContext = async (user: ReturnType<typeof userEvent.setup>) => {
  const hint = screen.queryByRole("button", { name: "ヒント" });
  if (!hint) return null;
  await user.click(hint);
  const line = document.querySelector("[data-hint-research]")?.cloneNode(true) ?? null;
  await user.click(screen.getByRole("button", { name: /閉じる/ }));
  return line as Element | null;
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Pizza Select レシピ発見へ (#377)", () => {
  it("Entry 0: the targetless Free Cook (no research context, no Dex)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await pizzaSelectDiscovery(user);
    expect(document.querySelector(".pizza-stage")).toBeInTheDocument();
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toBeNull();
    expect(document.querySelector(".order-card--free-cook")).toBeNull(); // Owner decision (#401 HV): no note card above the pizza
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    expect(screen.getByRole("dialog", { name: /ヒント/ })).toHaveTextContent("レシピ発見の試作"); // it is in the Hint sheet
  });

  it("Entry 1: that entry is the Research Target (研究中 ？？？ピザ), no Dex detour", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await pizzaSelectDiscovery(user);
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ(?! )/);
  });

  it("Entry 2+: the Dex's Research cards open, nothing is started or picked; the player's pick starts it", async () => {
    seedMulti();
    const user = userEvent.setup();
    render(<App />);
    await pizzaSelectDiscovery(user);
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument();
    expect(document.querySelector(".pizza-stage")).toBeNull();
    expect(await researchContext(user)).toBeNull();
    expect(document.querySelectorAll(".dex-overlay__research .dex-research-card").length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getAllByRole("button", { name: /を研究する/ })[1]);
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ B（たまねぎ）/);
  });

  it("HOME parity: Pizza Select and HOME reach the same research state on the same save (Entry 1; Entry 2+ opens the same Dex)", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await homeDiscovery(user);
    const homeContext = (await researchContext(user))?.textContent;
    cleanup();
    seedSingle();
    render(<App />);
    await pizzaSelectDiscovery(user);
    expect((await researchContext(user))?.textContent).toBe(homeContext);
    cleanup();

    seedMulti();
    render(<App />);
    await homeDiscovery(user);
    const homeCards = document.querySelector(".dex-overlay__research")?.textContent;
    expect(homeCards).toBeTruthy();
    cleanup();
    seedMulti();
    render(<App />);
    await pizzaSelectDiscovery(user);
    expect(document.querySelector(".dex-overlay__research")?.textContent).toBe(homeCards);
  });

  it("#378: a stock-blocked entry is not a routing candidate (2 registered, 1 cookable -> that one is the Target)", async () => {
    seed(12, ["aussie"], [multiDrainTarget()]);
    const user = userEvent.setup();
    render(<App />);
    await pizzaSelectDiscovery(user);
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ B（たまねぎ）/);
  });

  it("the Dex 「このピザを研究する」 is unchanged (single entry)", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    await user.click(screen.getByRole("button", { name: "？？？ピザ（チキン）を研究する" }));
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ(?! )/);
  });

  it("test fixture: the test-only hook starts a targetless round on a save with a cookable entry, and Production UX does not", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await startTargetlessFreeCookViaTestHook(user);
    expect(document.querySelector(".pizza-stage")).toBeInTheDocument();
    expect(await researchContext(user)).toBeNull();
  });
});
