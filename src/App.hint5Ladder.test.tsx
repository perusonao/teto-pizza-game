import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTargetlessFreeCookViaPizzaSelect } from "./test/discoveryEntry";

/**
 * Discovery Hint 5.0 (Issue #292), H5-3: the ladder sheet through the real App, with the flag ON
 * (mocked here; OFF in every build). The save changes only by the Pitz debit and the fact ledger.
 * OD-H5-M3: a legacy save looks exactly like a fresh one before a request, and "already known" is
 * told only after one.
 */
vi.mock("./logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: true, HINT5_DEV_OPT_IN_KEY: "teto.dev.hint5Ladder" }));

const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const userEvent = (await import("@testing-library/user-event")).default;
const App = (await import("./App")).default;
const { SAVE_STORAGE_KEY } = await import("./state/persistence");
const { INGREDIENTS, STARTER_INGREDIENT_IDS } = await import("./data/ingredients");
const { RECIPES } = await import("./data/recipes");

/** Dex {margherita, bismarck}; egg + bacon owned -> the DISCOVERABLE target is breakfast-pizza
 *  (sauce tomato, cheese mozzarella, key bacon, sub-topping egg = ✨ ちょっと変わった材料). */
function save(pitzBalance: number, facts: Record<string, string[]> = {}) {
  return {
    schemaVersion: 2,
    dex: ["margherita", "bismarck"].map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
    pitzBalance,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "egg", "bacon"],
    missionBest: {},
    inventory: { egg: 10, bacon: 10 },
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: ["egg", "bacon"],
    discoveryHintFacts: facts,
  };
}

const stored = () => JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await startTargetlessFreeCookViaPizzaSelect(user);
  const bar = document.querySelector(".prepare-bake-bar") as HTMLElement;
  await user.click(within(bar).getByRole("button", { name: "ヒント" }));
  return screen.getByRole("dialog", { name: /ヒント/ });
}

const cta = (dialog: HTMLElement) => dialog.querySelector<HTMLButtonElement>(".hint-sheet__h5-next .hint-sheet__next");
const nextLabel = (dialog: HTMLElement) => dialog.querySelector(".hint-sheet__h5-next .hint-sheet__card-title")?.firstChild?.textContent ?? null;

async function ask(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await waitFor(() => expect(cta(dialog)).not.toHaveAttribute("aria-disabled"), { timeout: 2000 });
  await user.click(cta(dialog)!);
}

/** Everything a player (or assistive tech) could read from the dialog: text and every attribute. */
function surface(dialog: HTMLElement): string {
  const attrs = [...dialog.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => `${a.name}=${a.value}`));
  return `${dialog.textContent}\n${attrs.join("\n")}`;
}

describe("Hint 5.0 ladder sheet in the App (flag ON)", () => {
  it("offers exactly one next rung (label + normal price + たずねる) and never shows later rungs, the key or the sub-topping before purchase", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save(300)));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    expect(dialog).toHaveAttribute("data-hint-ladder", "hint5");
    expect(nextLabel(dialog)).toBe("ヒント1: ソース");
    expect(cta(dialog)).toHaveTextContent("たずねる 10 Pitz");
    expect(within(dialog).getAllByRole("button", { name: /たずねる/ })).toHaveLength(1);
    const text = dialog.textContent!;
    for (const later of ["ヒント2", "ヒント3", "ヒント4", "ヒント5", "サブトッピング①", "ベーコン", "たまご", "トマトソース"]) expect(text, later).not.toContain(later);
    // No old 材料 / 構成 / 特徴 entry (it would sell a sub-topping name).
    expect(within(dialog).queryByRole("button", { name: "ヒントをもらう" })).toBeNull();
  });

  it("buys the whole ladder at 10 / 10 / 10 / 5 / 5; the save changes only by the debit and the fact ledger; the classification never names the ingredient", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save(300)));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    const before = stored();
    const labels: (string | null)[] = [];
    const balances: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      labels.push(nextLabel(dialog));
      await ask(user, dialog);
      await waitFor(() => expect(stored().pitzBalance).toBe(300 - [10, 20, 30, 35, 40][i]));
      balances.push(stored().pitzBalance);
    }
    expect(labels).toEqual(["ヒント1: ソース", "ヒント2: チーズ", "ヒント3: キートッピング", "ヒント4: 構成（材料の数）", "ヒント5: サブトッピング①の分類"]);
    expect(balances).toEqual([290, 280, 270, 265, 260]);
    const after = stored();
    expect(after.discoveryHintFacts["breakfast-pizza"]).toEqual([
      "ing:tomato-sauce",
      "h5:sauce",
      "ing:mozzarella",
      "h5:cheese",
      "ing:bacon",
      "h5:key",
      "meta:ingredient-total",
      "h5:structure",
      "cls:egg",
    ]);
    // As in App.hintSheet.test.tsx: a write also fills two empty defaults on a save that predates
    // them (the legacy hint ledger and the technique ledger). The ladder never touches either.
    const { pitzBalance: _p1, discoveryHintFacts: _f1, discoveryHintPurchases, discoveredTechniqueIds, ...restAfter } = after;
    const { pitzBalance: _p0, discoveryHintFacts: _f0, ...restBefore } = before;
    expect(discoveryHintPurchases).toEqual({});
    expect(discoveredTechniqueIds).toEqual([]);
    expect(restAfter).toEqual(restBefore);
    // The board: names of the bought rungs, the total, and the classification label only.
    expect(dialog).toHaveTextContent("トマトソース");
    expect(dialog).toHaveTextContent("モッツァレラ");
    expect(dialog).toHaveTextContent("ベーコン");
    expect(dialog).toHaveTextContent("このピザは全部で4種類の材料を使うよ");
    expect(dialog).toHaveTextContent("サブトッピング①");
    expect(dialog).toHaveTextContent("ちょっと変わった材料");
    expect(dialog).toHaveTextContent("ここまでのヒントで、推理してみよう！");
    expect(cta(dialog)).toBeNull();
    const all = surface(dialog);
    expect(all).not.toContain("たまご");
    expect(all).not.toContain(INGREDIENTS.find((i) => i.id === "egg")!.emoji);
    expect(all).not.toMatch(/\begg\b/);
    const recipe = RECIPES.find((r) => r.id === "breakfast-pizza")!;
    for (const leak of [recipe.id, recipe.nameJa, recipe.description]) expect(all).not.toContain(leak);
  });

  it("a double-click buys exactly one rung", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save(300)));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    await user.dblClick(cta(dialog)!);
    await waitFor(() => expect(stored().pitzBalance).toBe(290));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(stored().pitzBalance).toBe(290);
    expect(nextLabel(dialog)).toBe("ヒント2: チーズ");
  });

  it("insufficient Pitz: the CTA is disabled at the normal price and nothing is saved", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save(5)));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    const before = window.localStorage.getItem(SAVE_STORAGE_KEY);
    expect(cta(dialog)).toBeDisabled();
    expect(cta(dialog)).toHaveTextContent("10 Pitz");
    expect(dialog).toHaveTextContent("Pitzがたまったら、またためしてね");
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("M3 legacy save: the same next rung and price as a fresh save; ALL known -> 0 Pitz + 「もう知っていた」 only after the request; PARTIAL / NONE -> normal price", async () => {
    // Hint 3.0 buyer who knows the sauce and the cheese names of breakfast-pizza.
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save(300, { "breakfast-pizza": ["ing:tomato-sauce", "ing:mozzarella"] })));
    const user = userEvent.setup();
    render(<App />);
    const dialog = await openSheet(user);
    // Before any request: exactly the fresh offer. The legacy names appear only in 「以前のヒント」.
    expect(nextLabel(dialog)).toBe("ヒント1: ソース");
    expect(cta(dialog)).toHaveTextContent("たずねる 10 Pitz");
    expect(dialog).not.toHaveTextContent("もう知っていた");
    const archive = dialog.querySelector(".hint-sheet__legacy")!;
    expect(archive).toHaveTextContent("以前のヒント");
    expect(archive).toHaveTextContent("トマトソース");
    expect(dialog.querySelector('[data-hint-section="hint5-names"]')).toBeNull();
    // ALL known: sauce -> 0 Pitz, told after the request.
    await ask(user, dialog);
    await waitFor(() => expect(dialog).toHaveTextContent("このヒントはもう知っていたよ！"));
    expect(stored().pitzBalance).toBe(300);
    expect(nextLabel(dialog)).toBe("ヒント2: チーズ");
    expect(cta(dialog)).toHaveTextContent("10 Pitz");
    // ALL known again: cheese -> 0 Pitz.
    await ask(user, dialog);
    await waitFor(() => expect(nextLabel(dialog)).toBe("ヒント3: キートッピング"));
    expect(stored().pitzBalance).toBe(300);
    // NONE known: the key costs 10 and the feedback line goes away.
    await ask(user, dialog);
    await waitFor(() => expect(stored().pitzBalance).toBe(290));
    expect(dialog).not.toHaveTextContent("もう知っていた");
    expect(stored().discoveryHintFacts["breakfast-pizza"]).toEqual(["ing:tomato-sauce", "ing:mozzarella", "h5:sauce", "h5:cheese", "ing:bacon", "h5:key"]);
  });

  it("a reload shows the bought rungs again and never resells them", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save(300)));
    const user = userEvent.setup();
    const first = render(<App />);
    let dialog = await openSheet(user);
    await ask(user, dialog);
    await waitFor(() => expect(stored().pitzBalance).toBe(290));
    first.unmount();
    render(<App />);
    dialog = await openSheet(user);
    expect(nextLabel(dialog)).toBe("ヒント2: チーズ");
    expect(dialog.querySelector('[data-hint-section="hint5-names"]')).toHaveTextContent("トマトソース");
    expect(stored().pitzBalance).toBe(290);
  });
});
