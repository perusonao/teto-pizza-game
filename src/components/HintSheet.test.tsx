import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps } from "../logic/discovery/hintSteps";
import type { HintSheetView } from "../state/discoveryHint";
import { HintSheet } from "./HintSheet";

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const targetView = (id: string, discoveredCount: number, shown: number): HintSheetView => {
  const all = buildHintSteps(recipe(id), { discoveredCount });
  const n = Math.min(shown, all.length);
  return { kind: "TARGET", steps: all.slice(0, n), canRevealMore: n < all.length };
};

function renderSheet(view: HintSheetView) {
  const onRevealNext = vi.fn();
  const onClose = vi.fn();
  const utils = render(<HintSheet view={view} onRevealNext={onRevealNext} onClose={onClose} />);
  return { ...utils, onRevealNext, onClose };
}

afterEach(() => cleanup());

describe("HintSheet -- target view", () => {
  it("is a labelled dialog showing the revealed steps, newest last, with the next-hint CTA", () => {
    const { onRevealNext } = renderSheet(targetView("breakfast-pizza", 2, 2));
    const dialog = screen.getByRole("dialog", { name: /ヒント/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const items = dialog.querySelectorAll(".hint-sheet__step");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveClass("hint-sheet__step--latest");
    expect(items[1]).toHaveTextContent("ベーコン を使うピザが作れそう！");
    fireEvent.click(screen.getByRole("button", { name: "次のヒントを見る" }));
    expect(onRevealNext).toHaveBeenCalledTimes(1);
  });

  it("a step naming an ingredient shows its glyph (decorative); H0 / count lines have none", () => {
    renderSheet(targetView("breakfast-pizza", 2, 5));
    const items = [...document.querySelectorAll(".hint-sheet__step")];
    expect(items.map((li) => !!li.querySelector(".hint-sheet__glyph"))).toEqual([false, true, true, false, true]);
    for (const glyph of document.querySelectorAll(".hint-sheet__glyph")) expect(glyph).toHaveAttribute("aria-hidden", "true");
  });

  it("the last step replaces the CTA with a closing line and moves focus to 閉じる", () => {
    renderSheet(targetView("breakfast-pizza", 2, 99));
    expect(screen.queryByRole("button", { name: "次のヒントを見る" })).not.toBeInTheDocument();
    expect(screen.getByText(/ヒントはここまで/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
  });

  it("opening focuses the next-hint CTA; H0 alone carries the 'close to find it yourself' note", () => {
    renderSheet(targetView("bismarck", 1, 1));
    expect(screen.getByRole("button", { name: "次のヒントを見る" })).toHaveFocus();
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
    expect(screen.queryByRole("button", { name: "次のヒントを見る" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
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
    expect(document.body.textContent ?? "", `${where}: ASCII id`).not.toMatch(/[a-z]{3,}/);
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
