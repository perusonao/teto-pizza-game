import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps, type HintLevel } from "../logic/discovery/hintSteps";
import { selectableHintSavedState } from "../logic/discovery/hintFactMigration";
import { buildSelectableHintModel, selectableHintPresentation } from "../logic/discovery/selectableHint";
import type { HintSheetView } from "../state/discoveryHint";
import { HintSheet, SELECTABLE_GUIDANCE_TEXT } from "./HintSheet";

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const targetView = (id: string, discoveredCount: number, shown: number, pitzBalance = 100): HintSheetView => {
  const all = buildHintSteps(recipe(id), { discoveredCount });
  const n = Math.min(shown, all.length);
  const nextStep = all[n];
  return {
    kind: "TARGET",
    steps: all.slice(0, n),
    canRevealMore: n < all.length,
    next: nextStep ? offer(nextStep.level, discoveredCount === 0, pitzBalance) : null,
    pitzBalance,
  };
};

function offer(level: HintLevel, free: boolean, pitzBalance: number) {
  const price = free ? 0 : [0, 5, 10, 20, 40][level];
  return { level, price, free, affordable: free || pitzBalance >= price };
}

function renderSheet(view: HintSheetView) {
  const onUnlock = vi.fn();
  const onClose = vi.fn();
  const utils = render(<HintSheet view={view} onUnlock={onUnlock} onClose={onClose} />);
  return { ...utils, onUnlock, onClose };
}

afterEach(() => cleanup());

describe("HintSheet -- target view", () => {
  it("is a labelled dialog showing the revealed steps, newest last, with the next-hint CTA", () => {
    const { onUnlock } = renderSheet(targetView("breakfast-pizza", 2, 2));
    const dialog = screen.getByRole("dialog", { name: /ヒント/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const items = dialog.querySelectorAll(".hint-sheet__step");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveClass("hint-sheet__step--latest");
    expect(items[1]).toHaveTextContent("ベーコン を使うピザが作れそう！");
    fireEvent.click(screen.getByRole("button", { name: "次のヒントを解除 10 Pitz" }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith(2);
  });

  it("a step naming an ingredient shows its glyph (decorative); H0 / count lines have none", () => {
    renderSheet(targetView("breakfast-pizza", 2, 5));
    const items = [...document.querySelectorAll(".hint-sheet__step")];
    expect(items.map((li) => !!li.querySelector(".hint-sheet__glyph"))).toEqual([false, true, true, false, true]);
    for (const glyph of document.querySelectorAll(".hint-sheet__glyph")) expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("the last step replaces the CTA with a closing line and moves focus to 閉じる", () => {
    renderSheet(targetView("breakfast-pizza", 2, 99));
    expect(document.querySelector(".hint-sheet__next")).toBeNull();
    expect(screen.queryByText(/所持/)).not.toBeInTheDocument();
    expect(screen.getByText(/ヒントはここまで/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
  });

  it("opening focuses the next-hint CTA; H0 alone carries the 'close to find it yourself' note", () => {
    renderSheet(targetView("bismarck", 1, 1));
    expect(screen.getByRole("button", { name: "次のヒントを解除 5 Pitz" })).toHaveFocus();
    expect(screen.getByText(/自分で見つけたいときは/)).toBeInTheDocument();
  });

  it("closes from 閉じる, the backdrop and Escape -- not from a tap inside the sheet", () => {
    const { onClose, container } = renderSheet(targetView("bismarck", 1, 2));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(container.querySelector(".hint-sheet__backdrop")!);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("HintSheet -- empty states", () => {
  it.each([
    ["SHOP_NEW", /ショップに入荷した材料/],
    ["REFILL", /材料が足りない/],
    ["COMPLETE", /図鑑コンプリート/],
  ] as const)("%s shows its message, no next-hint CTA", (kind, text) => {
    renderSheet({ kind });
    expect(screen.getByRole("dialog")).toHaveAttribute("data-hint-kind", kind);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.querySelector(".hint-sheet__next")).toBeNull();
    expect(screen.queryByText(/Pitz/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
  });
});

describe("HintSheet -- Discovery Hint Economy 1.0 purchase CTA (HE-3)", () => {
  it("each level shows its own price and the balance; tapping reports the offered level", () => {
    const prices = [5, 10, 20, 40];
    for (let level = 1; level <= 4; level += 1) {
      const { onUnlock } = renderSheet(targetView("capricciosa", 11, level, 120));
      const cta = screen.getByRole("button", { name: `次のヒントを解除 ${prices[level - 1]} Pitz` });
      expect(cta).toBeEnabled();
      expect(cta).toHaveClass("hint-sheet__next--paid");
      expect(screen.getByText("所持 120 Pitz")).toBeInTheDocument();
      fireEvent.click(cta);
      expect(onUnlock).toHaveBeenCalledWith(level);
      cleanup();
    }
  });

  it("the CTA never says what the next level reveals, nor how many levels are left", () => {
    renderSheet(targetView("capricciosa", 11, 4, 120)); // H0..H3 shown, H4 (three lines) offered
    const cta = document.querySelector(".hint-sheet__next")!;
    expect(cta.textContent).toBe("\u{1F512}次のヒントを解除 40 Pitz");
    const footer = document.querySelector(".hint-sheet__footer")!.textContent ?? "";
    for (const leak of ["あと", "残り", "合計", "75", "オリーブ", "オレガノ"]) expect(footer).not.toContain(leak);
  });

  it("a short balance disables the CTA in a calm, neutral state and focuses 閉じる", () => {
    const { onUnlock } = renderSheet(targetView("breakfast-pizza", 2, 4, 25));
    const cta = screen.getByRole("button", { name: "次のヒント 40 Pitz" });
    expect(cta).toBeDisabled();
    expect(cta).toHaveClass("hint-sheet__next--short");
    expect(screen.getByText("所持 25 Pitz")).toBeInTheDocument();
    expect(screen.getByText(/このまま作ってもOK/)).toBeInTheDocument();
    expect(document.querySelector("[role=alert]")).toBeNull();
    fireEvent.click(cta);
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
  });

  it("buying the last affordable level moves focus from the (now disabled) CTA to 閉じる", () => {
    const { rerender } = render(<HintSheet view={targetView("breakfast-pizza", 2, 3, 30)} onUnlock={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "次のヒントを解除 20 Pitz" })).toHaveFocus();
    rerender(<HintSheet view={targetView("breakfast-pizza", 2, 4, 10)} onUnlock={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
  });

  it("Dex-0 Margherita onboarding: no price, no balance, no lock -- free", () => {
    const { onUnlock } = renderSheet(targetView("margherita", 0, 1, 0));
    const cta = screen.getByRole("button", { name: "次のヒントを見る" });
    expect(cta).toBeEnabled();
    expect(cta).not.toHaveClass("hint-sheet__next--paid");
    expect(screen.queryByText(/Pitz/)).not.toBeInTheDocument();
    expect(screen.getByText(/はじめてのピザはヒント無料/)).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onUnlock).toHaveBeenCalledWith(1);
  });
});

describe("HintSheet -- anti-spoiler DOM sweep (25 recipes, every revealed step)", () => {
  const ingredientNames = [...new Set(INGREDIENTS.map((i) => i.nameJa))].sort((a, b) => b.length - a.length);
  const recipeIds = RECIPES.map((r) => r.id);

  function expectNoRecipeIdentity(where: string) {
    // Ingredient names are allowed (A-3); 「ジェノベーゼソース」「ペパロニ」 contain recipe names.
    const text = ingredientNames.reduce((t, n) => t.split(n).join("□"), document.body.textContent ?? "");
    for (const r of RECIPES) {
      expect(text, `${where}: name ${r.nameJa}`).not.toContain(r.nameJa);
      expect(text, `${where}: description`).not.toContain(r.description);
    }
    const attributes = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => `${a.name}=${a.value}`));
    for (const id of recipeIds) {
      expect(attributes.filter((a) => a.split("=")[1].split(/[\s:]/).includes(id)), `${where}: id ${id}`).toEqual([]);
    }
    // "Pitz" (the currency, HE-3's price / balance lines) is the only ASCII word the sheet may show.
    expect((document.body.textContent ?? "").split("Pitz").join(""), `${where}: ASCII id`).not.toMatch(/[a-z]{3,}/);
  }

  it("no recipe name, description or id in text, aria-* or data-*", () => {
    for (const r of RECIPES) {
      for (const dex of r.id === "margherita" ? [0, 1] : [1, 12]) {
        const total = buildHintSteps(r, { discoveredCount: dex }).length;
        for (let shown = 1; shown <= total; shown += 1) {
          renderSheet(targetView(r.id, dex, shown));
          expectNoRecipeIdentity(`${r.id} dex ${dex} shown ${shown}`);
          cleanup();
        }
      }
    }
    for (const kind of ["SHOP_NEW", "REFILL", "COMPLETE"] as const) {
      renderSheet({ kind });
      expectNoRecipeIdentity(kind);
      cleanup();
    }
  });

  it("normal progression never shows every ingredient; Dex-0 Margherita may", () => {
    const shownIngredients = (id: string, dex: number) => {
      renderSheet(targetView(id, dex, 99));
      const names = [...document.querySelectorAll(".hint-sheet__step")].map((li) => li.textContent ?? "");
      cleanup();
      return names;
    };
    const margherita0 = shownIngredients("margherita", 0).join("|");
    for (const n of ["トマトソース", "モッツァレラ", "バジル"]) expect(margherita0).toContain(n);
    const breakfast = shownIngredients("breakfast-pizza", 2).join("|");
    expect(breakfast).not.toContain("たまご");
  });
});

/** The H3-3 Selectable view exactly as `hintSheetView` builds it, from both ledgers. */
function selectableView(
  id: string,
  opts: { facts?: string[]; legacyLevel?: number; pitz?: number; outcome?: "GUIDANCE_ONLY" | null } = {},
): Extract<HintSheetView, { kind: "SELECTABLE" }> {
  const saved = selectableHintSavedState(id, {
    discoveryHintPurchases: opts.legacyLevel ? { [id]: opts.legacyLevel } : {},
    discoveryHintFacts: opts.facts ? { [id]: opts.facts } : {},
  })!;
  const model = buildSelectableHintModel(id, { discoveredCount: 3 })!;
  return {
    kind: "SELECTABLE",
    existenceText: buildHintSteps(recipe(id), { discoveredCount: 3 })[0].textJa,
    presentation: selectableHintPresentation(model, saved.purchasedFactIds, opts.pitz ?? 100, saved.legacy),
    grandfatheredSteps: saved.grandfatheredSteps,
    outcome: opts.outcome ?? null,
  };
}

function renderSelectable(view: HintSheetView) {
  const onUnlock = vi.fn();
  const onBuySelectable = vi.fn();
  const onClose = vi.fn();
  const utils = render(<HintSheet view={view} onUnlock={onUnlock} onBuySelectable={onBuySelectable} onClose={onClose} />);
  return { ...utils, onUnlock, onBuySelectable, onClose };
}

describe("HintSheet -- Selectable view (Discovery Hint 3.0, H3-3)", () => {
  it("shows H0, three category rows, the free key, three preferences, the price and the balance", () => {
    renderSelectable(selectableView("capricciosa"));
    const dialog = screen.getByRole("dialog", { name: /ヒント/ });
    expect(dialog).toHaveAttribute("data-hint-kind", "SELECTABLE");
    expect(dialog).toHaveTextContent("今の材料で、まだ見つけていないピザが作れそう！");
    expect([...dialog.querySelectorAll(".hint-sheet__row-label")].map((e) => e.textContent)).toEqual(["ソース", "チーズ", "トッピング"]);
    expect(dialog).toHaveTextContent("オレガノ");
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["sauce", "cheese", "topping"]);
    expect(screen.getByRole("radio", { name: "ソース" })).toBeChecked();
    const cta = dialog.querySelector<HTMLButtonElement>(".hint-sheet__next")!;
    expect(cta).toHaveTextContent("5 Pitz");
    expect(cta).toBeEnabled();
    expect(cta).toHaveFocus();
    expect(dialog).toHaveTextContent("所持 100 Pitz");
    expect(dialog.querySelector(".hint-sheet__legacy")).toBeNull();
    expect(dialog).not.toHaveTextContent(SELECTABLE_GUIDANCE_TEXT);
  });

  it("the CTA reports the chosen preference and the paid count it showed; it never changes anything itself", () => {
    const { onBuySelectable, onUnlock } = renderSelectable(selectableView("capricciosa", { facts: ["ing:mushroom"] }));
    fireEvent.click(screen.getByRole("radio", { name: "チーズ" }));
    fireEvent.click(document.querySelector<HTMLButtonElement>(".hint-sheet__next")!);
    expect(onBuySelectable).toHaveBeenCalledWith("cheese", 1);
    expect(onUnlock).not.toHaveBeenCalled();
    expect(document.querySelector(".hint-sheet__next")).toHaveTextContent("10 Pitz");
  });

  it("insufficient Pitz: a disabled CTA in the calm tone, focus on 閉じる", () => {
    const { onBuySelectable } = renderSelectable(selectableView("capricciosa", { pitz: 4 }));
    const cta = document.querySelector<HTMLButtonElement>(".hint-sheet__next")!;
    expect(cta).toBeDisabled();
    expect(cta).toHaveClass("hint-sheet__next--short");
    fireEvent.click(cta);
    expect(onBuySelectable).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
    expect(document.body).toHaveTextContent("たまったら解除できるよ。このまま作ってもOK！");
  });

  it("GUIDANCE_ONLY shows the generic line only -- no count, no category, no 'that is all'", () => {
    renderSelectable(selectableView("pizza-bianca", { outcome: "GUIDANCE_ONLY" }));
    const line = document.querySelector(".hint-sheet__guidance")!;
    expect(line.textContent).toBe(SELECTABLE_GUIDANCE_TEXT);
    expect(document.body.textContent).not.toMatch(/ここまで|全部|もうない|ありません|種類/);
  });

  it("grandfathered legacy lines render in their own 「以前のヒント」 block, not as a purchasable row", () => {
    renderSelectable(selectableView("breakfast-pizza", { legacyLevel: 3 }));
    const legacy = document.querySelector(".hint-sheet__legacy")!;
    expect(legacy).toHaveTextContent("以前のヒント");
    expect(legacy).toHaveTextContent("材料は全部で4種類。チーズを使うみたい");
    expect(document.querySelector(".hint-sheet__rows")).not.toHaveTextContent("材料は全部で");
    expect(document.querySelector(".hint-sheet__next")).toHaveTextContent("40 Pitz");
  });

  it("every recipe: no recipe identity, and the same shape whatever is left to sell", () => {
    const ingredientNames = [...new Set(INGREDIENTS.map((i) => i.nameJa))].sort((a, b) => b.length - a.length);
    const shape = () => ({
      rows: [...document.querySelectorAll(".hint-sheet__row")].map((r) => r.getAttribute("data-hint-category")),
      radios: screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value),
      cta: document.querySelector(".hint-sheet__next")?.textContent,
    });
    let reference: ReturnType<typeof shape> | null = null;
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      renderSelectable(selectableView(r.id));
      const text = ingredientNames.reduce((t, n) => t.split(n).join("□"), document.body.textContent ?? "");
      expect(text, r.id).not.toContain(r.nameJa);
      const attributes = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value));
      expect(attributes.some((v) => v.split(/[\s:]/).includes(r.id)), r.id).toBe(false);
      expect((document.body.textContent ?? "").split("Pitz").join(""), r.id).not.toMatch(/[a-z]{3,}/);
      reference ??= shape();
      expect(shape(), r.id).toEqual(reference);
      cleanup();
    }
  });
});
