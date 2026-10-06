import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { DISCOVERY_LADDER } from "./data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";

/**
 * Issue #373 through the real App: HOME 「レシピ発見」 follows the cookable Research Entries (0 targetless / 1 that
 * entry is the Research Target / 2+ the Dex's Research cards, the player picks) and reaches the same research state as
 * the Dex's 「このピザを研究する」. Production data only (ladder step 12 = 3 entries, step 25 + calabresa and TQ-1D aussie closed = 1).
 */

const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const materialsUpTo = (step: number) => DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds as readonly string[]);

function seed(step: number, extraDiscovered: readonly string[] = []): void {
  const materials = materialsUpTo(step);
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: [...keysBefore(step), ...extraDiscovered].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: 500,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...materials],
      missionBest: {},
      inventory: Object.fromEntries(materials.map((m) => [m, 30])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materials,
    }),
  );
}
const seedSingle = () => seed(25, ["brazilian-calabresa", "aussie"]);
const seedMulti = () => seed(12);

const homeDiscovery = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: /レシピ発見/ }));
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

describe("HOME レシピ発見 (#373)", () => {
  it("A. no cookable entry: the targetless Free Cook (no research context)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await homeDiscovery(user);
    expect(document.querySelector(".pizza-stage")).toBeInTheDocument();
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toBeNull();
    expect(document.querySelector(".order-card--free-cook")).toHaveTextContent("レシピ発見の試作");
  });

  it("B. one cookable entry: that entry is the Research Target (研究中 ？？？ピザ), no Dex detour", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await homeDiscovery(user);
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ(?! )/);
  });

  it("C. two or more cookable entries: the Dex's Research cards open, nothing is started or picked; the player's pick starts it", async () => {
    seedMulti();
    const user = userEvent.setup();
    render(<App />);
    await homeDiscovery(user);
    expect(document.querySelector(".dex-overlay")).toBeInTheDocument();
    expect(document.querySelector(".pizza-stage")).toBeNull();
    expect(await researchContext(user)).toBeNull();
    const cards = document.querySelectorAll(".dex-overlay__research .dex-research-card");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getAllByRole("button", { name: /を研究する/ })[1]);
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ B（たまねぎ）/);
  });

  it("D. the Dex's 研究する is unchanged (single entry): Research Target round", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    await user.click(screen.getByRole("button", { name: "？？？ピザ（チキン）を研究する" }));
    expect(document.querySelector(".dex-overlay")).toBeNull();
    expect(await researchContext(user)).toHaveTextContent(/研究中\s*？？？ピザ(?! )/);
  });

  it("E. parity: the same entry from HOME and from the Dex shows the same research context and Hint sheet", async () => {
    seedSingle();
    const user = userEvent.setup();
    render(<App />);
    await homeDiscovery(user);
    const homeContext = (await researchContext(user))?.textContent;
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    const homeHint = screen.getByRole("dialog", { name: /ヒント/ });
    const homeKind = homeHint.getAttribute("data-hint-kind");
    const homeText = homeHint.textContent;
    cleanup();

    seedSingle();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    await user.click(screen.getByRole("button", { name: "？？？ピザ（チキン）を研究する" }));
    const dexHint = (await (async () => {
      await user.click(screen.getByRole("button", { name: "ヒント" }));
      return screen.getByRole("dialog", { name: /ヒント/ });
    })());
    expect((await researchContext(user))?.textContent).toBe(homeContext);
    expect(dexHint.getAttribute("data-hint-kind")).toBe(homeKind);
    expect(dexHint.textContent).toBe(homeText);
  });
});
