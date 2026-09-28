import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps, type HintLevel } from "../logic/discovery/hintSteps";
import { selectableHintSavedState } from "../logic/discovery/hintFactMigration";
import { buildSelectableHintModel, selectableHintPresentation } from "../logic/discovery/selectableHint";
import type { DeductionSheetView, HintOutcome, HintSheetView } from "../state/discoveryHint";
import { HintSheet, SELECTABLE_BUY_LATCH_MS, SELECTABLE_GUIDANCE_TEXT } from "./HintSheet";

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

/** The Selectable view exactly as `hintSheetView` builds it, from both ledgers (+ an optional
 *  DH4-2B deduction part, as the E3 flag builds it). */
function selectableView(
  id: string,
  opts: { facts?: string[]; legacyLevel?: number; pitz?: number; outcome?: HintOutcome | null; deduction?: Partial<DeductionSheetView> | null } = {},
): Extract<HintSheetView, { kind: "SELECTABLE" }> {
  const saved = selectableHintSavedState(id, {
    discoveryHintPurchases: opts.legacyLevel ? { [id]: opts.legacyLevel } : {},
    discoveryHintFacts: opts.facts ? { [id]: opts.facts } : {},
  })!;
  const model = buildSelectableHintModel(id, { discoveredCount: 3 })!;
  const presentation = selectableHintPresentation(model, saved.purchasedFactIds, opts.pitz ?? 100, saved.legacy);
  return {
    kind: "SELECTABLE",
    existenceText: buildHintSteps(recipe(id), { discoveredCount: 3 })[0].textJa,
    presentation,
    grandfatheredSteps: saved.grandfatheredSteps,
    outcome: opts.outcome ?? null,
    deduction:
      opts.deduction === undefined || opts.deduction === null
        ? null
        : {
            structureLines: [],
            attributeLines: [],
            legacyStructure: false,
            structureOwned: false,
            attributeOwned: false,
            nextPrice: presentation.nextPrice === 0 ? 5 : presentation.nextPrice,
            paidCount: presentation.paidCount,
            affordable: (opts.pitz ?? 100) >= 5,
            ...opts.deduction,
          },
  };
}

function renderSelectable(view: HintSheetView) {
  const onUnlock = vi.fn();
  const onBuySelectable = vi.fn();
  const onClose = vi.fn();
  const utils = render(<HintSheet view={view} onUnlock={onUnlock} onBuySelectable={onBuySelectable} onClose={onClose} />);
  return { ...utils, onUnlock, onBuySelectable, onClose };
}

const cta = () => document.querySelector<HTMLButtonElement>(".hint-sheet__next")!;
const walletText = () => document.querySelector(".hint-sheet__wallet")!.textContent;
const family = (name: "材料" | "構成" | "特徴") => screen.getByRole("radio", { name });

/** DH4-2C (Issue #253, OD-DH4-2-6..9): the U3-C sheet -- 「わかっていること」 board + 「ヒントをもらう」. */
describe("HintSheet -- U3-C board (材料 only: the production view, flag off)", () => {
  it("caption H0, the board with only acquired facts (no 「？」 rows), one family, おまかせ by default, 「たずねる 5 Pitz」", () => {
    renderSelectable(selectableView("capricciosa"));
    const dialog = screen.getByRole("dialog", { name: /ヒント/ });
    expect(dialog).toHaveAttribute("data-hint-kind", "SELECTABLE");
    expect(dialog.querySelector(".hint-sheet__caption")).toHaveTextContent("今の材料で、まだ見つけていないピザが作れそう！");
    expect(dialog).toHaveTextContent("わかっていること");
    expect(dialog).toHaveTextContent("ヒントをもらう");
    // Only the free key's category row is shown; empty categories are omitted (OD-DH4-2-8).
    expect([...dialog.querySelectorAll(".hint-sheet__row-label")].map((e) => e.textContent)).toEqual(["トッピング"]);
    expect(dialog).toHaveTextContent("オレガノ");
    expect(dialog.textContent).not.toContain("？");
    expect(dialog.querySelector(".hint-sheet__families")).toBeNull();
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["any", "sauce", "cheese", "topping"]);
    expect(screen.getByRole("radio", { name: "おまかせ" })).toBeChecked();
    expect(cta().textContent).toBe("たずねる 5 Pitz");
    expect(cta()).toBeEnabled();
    expect(cta()).toHaveFocus();
    expect(walletText()).toBe("所持 100 Pitz ・ Pitzはヒントが出たときだけ使うよ");
    expect(dialog.querySelector(".hint-sheet__legacy")).toBeNull();
    expect(dialog).not.toHaveTextContent(SELECTABLE_GUIDANCE_TEXT);
    expect(dialog).toHaveTextContent("材料の名前を1つ教えるよ");
  });

  it("the CTA reports (category, paid count, 'material'); おまかせ is the existing fallback order (sauce first)", () => {
    const { onBuySelectable, onUnlock } = renderSelectable(selectableView("capricciosa", { facts: ["ing:mushroom"] }));
    fireEvent.click(cta());
    expect(onBuySelectable).toHaveBeenLastCalledWith("sauce", 1, "material");
    cleanup();
    const second = renderSelectable(selectableView("capricciosa", { facts: ["ing:mushroom"] }));
    fireEvent.click(screen.getByRole("radio", { name: "チーズ" }));
    fireEvent.click(cta());
    expect(second.onBuySelectable).toHaveBeenLastCalledWith("cheese", 1, "material");
    expect(onUnlock).not.toHaveBeenCalled();
    expect(cta()).toHaveTextContent("10 Pitz");
  });

  it("the CTA latches after one activation: a double-click reports once, focus stays, it re-arms after the latch", () => {
    vi.useFakeTimers();
    try {
      const { onBuySelectable } = renderSelectable(selectableView("capricciosa"));
      fireEvent.click(cta());
      fireEvent.click(cta());
      fireEvent.click(cta());
      expect(onBuySelectable).toHaveBeenCalledTimes(1);
      expect(cta()).toHaveAttribute("aria-disabled", "true");
      expect(cta()).toHaveFocus();
      act(() => vi.advanceTimersByTime(SELECTABLE_BUY_LATCH_MS));
      expect(cta()).not.toHaveAttribute("aria-disabled");
      fireEvent.click(cta());
      expect(onBuySelectable).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("insufficient Pitz: a disabled CTA in the calm tone, focus on 閉じる", () => {
    const { onBuySelectable } = renderSelectable(selectableView("capricciosa", { pitz: 4 }));
    expect(cta()).toBeDisabled();
    expect(cta()).toHaveClass("hint-sheet__next--short");
    fireEvent.click(cta());
    expect(onBuySelectable).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
    expect(document.body).toHaveTextContent("Pitzがたまったら、またためしてね。このまま作ってもOK！");
    expect(cta().textContent).toBe("たずねる 5 Pitz");
  });

  it("GUIDANCE_ONLY: the generic line and 「材料ヒントはここまで（Pitzは使っていないよ）」 -- no count, no category absence", () => {
    const { onBuySelectable } = renderSelectable(selectableView("pizza-bianca", { outcome: "GUIDANCE_ONLY" }));
    expect(document.querySelector(".hint-sheet__guidance")!.textContent).toBe(SELECTABLE_GUIDANCE_TEXT);
    expect(document.querySelector(".hint-sheet__outcome")!.textContent).toBe("材料ヒントはここまで（Pitzは使っていないよ）");
    expect(cta()).toBeDisabled();
    expect(cta().textContent).toBe("たずねる");
    expect(walletText()).toBe("所持 100 Pitz ・ 今回はPitzを使っていないよ");
    fireEvent.click(cta());
    expect(onBuySelectable).not.toHaveBeenCalled();
    const text = (document.body.textContent ?? "").split("材料ヒントはここまで").join("");
    expect(text).not.toMatch(/ここまで|全部|もうない|ありません|種類|使わないみたい/);
  });

  it("OD-H3-4-1: at price 0 (cap paid) 「たずねる 支払いずみ」 stays enabled, and the view is the same with or without a real fact left", () => {
    const shape = () => ({ cta: cta().textContent, enabled: !cta().disabled, wallet: walletText() });
    renderSelectable(selectableView("capricciosa", { legacyLevel: 1, facts: ["ing:tomato-sauce", "ing:mozzarella", "ing:mushroom"] }));
    const withFactLeft = shape();
    cleanup();
    renderSelectable(selectableView("capricciosa", { facts: ["ing:tomato-sauce", "ing:mozzarella", "ing:mushroom", "ing:ham"] }));
    expect(withFactLeft).toEqual({ cta: "たずねる 支払いずみ", enabled: true, wallet: "所持 100 Pitz ・ このピザのヒント代は上限まで支払いずみ" });
    expect(shape()).toEqual(withFactLeft);
    expect(document.body.textContent).not.toMatch(/無料|品切れ|売り切れ|(?<![0-9])0 Pitz/);
  });

  it("OD-H3-4-4: legacy lines are an archive at the end of the board, never a row, chip or price", () => {
    renderSelectable(selectableView("capricciosa", { legacyLevel: 4, outcome: "GUIDANCE_ONLY" }));
    const board = document.querySelector(".hint-sheet__board")!;
    const legacy = board.querySelector(".hint-sheet__legacy")!;
    expect(board.lastElementChild).toBe(legacy);
    expect(legacy.querySelector(".hint-sheet__legacy-title")!.textContent).toBe("以前のヒント");
    expect([...legacy.querySelectorAll(".hint-sheet__legacy-line")].map((e) => e.textContent)).toEqual(["材料は全部で6種類。チーズを使うみたい"]);
    expect(legacy.querySelector(".hint-sheet__chip, input, button")).toBeNull();
    expect(board.querySelector(".hint-sheet__guidance")!.compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a newly revealed chip is highlighted after a request, never on opening; the fallback states no absence", () => {
    const onBuySelectable = vi.fn();
    const props = { onUnlock: vi.fn(), onBuySelectable, onClose: vi.fn() };
    const { rerender } = render(<HintSheet view={selectableView("capricciosa", { facts: ["ing:tomato-sauce"] })} {...props} />);
    expect(document.querySelectorAll(".hint-sheet__chip--new")).toHaveLength(0);
    rerender(<HintSheet view={selectableView("capricciosa", { facts: ["ing:tomato-sauce", "ing:mozzarella"] })} {...props} />);
    const fresh = [...document.querySelectorAll(".hint-sheet__chip--new")];
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toHaveTextContent("モッツァレラ");
    expect(fresh[0].closest(".hint-sheet__row")).toHaveAttribute("data-hint-category", "cheese");
    expect(document.body.textContent).not.toMatch(/ソースは(もう)?ない|使わないみたい/);
  });

  it("every recipe, every legacy level: no recipe identity, the same controls; the board shows only what is known", () => {
    const ingredientNames = [...new Set(INGREDIENTS.map((i) => i.nameJa))].sort((a, b) => b.length - a.length);
    let reference: unknown = null;
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      for (const legacyLevel of [0, 1, 2, 3, 4]) {
        renderSelectable(selectableView(r.id, { legacyLevel }));
        const text = ingredientNames.reduce((t, n) => t.split(n).join("□"), document.body.textContent ?? "");
        expect(text, r.id).not.toContain(r.nameJa);
        expect(document.body.textContent).not.toContain("？");
        const attributes = [...document.body.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value));
        expect(attributes.some((v) => v.split(/[\s:]/).includes(r.id)), r.id).toBe(false);
        const controls = {
          radios: screen.getAllByRole("radio").map((x) => (x as HTMLInputElement).value),
          label: document.querySelector(".hint-sheet__next-label")!.textContent,
          enabled: !cta().disabled,
          card: document.querySelector(".hint-sheet__card-title")!.textContent,
        };
        reference ??= controls;
        expect(controls, `${r.id} H${legacyLevel}`).toEqual(reference);
        cleanup();
      }
    }
  });
});

describe("HintSheet -- U3-C family cards 構成 / 特徴 (DH4-2B view, E3 flag)", () => {
  it("three family choices; each card describes the question only (no availability, level or count)", () => {
    renderSelectable(selectableView("capricciosa", { deduction: {} }));
    expect(screen.getByRole("radiogroup", { name: "ヒントをもらう" })).toBeInTheDocument();
    expect(family("材料")).toBeChecked();
    fireEvent.click(family("構成"));
    expect(document.querySelector(".hint-sheet__card")).toHaveAttribute("data-hint-family", "structure");
    expect(document.querySelector(".hint-sheet__card-title")!.textContent).toBe("構成ヒント材料の数を教えるよ");
    expect(document.querySelector(".hint-sheet__prefs")).toBeNull();
    expect(cta().textContent).toBe("たずねる 5 Pitz");
    fireEvent.click(family("特徴"));
    expect(document.querySelector(".hint-sheet__card-title")!.textContent).toBe("特徴ヒントまだわからない材料の「なかま」を教えるよ");
    expect(cta().textContent).toBe("たずねる 5 Pitz");
  });

  it("a family request reports ('sauce', the deduction paid count, family); it never changes anything itself", () => {
    const { onBuySelectable } = renderSelectable(selectableView("capricciosa", { deduction: { paidCount: 2, nextPrice: 20 } }));
    fireEvent.click(family("構成"));
    expect(cta().textContent).toBe("たずねる 20 Pitz");
    fireEvent.click(cta());
    expect(onBuySelectable).toHaveBeenLastCalledWith("sauce", 2, "structure");
  });

  it("the board shows stored 構成 / 特徴 lines in their own sections; an owned family reads 「✓ もらいずみ」 and is disabled", () => {
    renderSelectable(
      selectableView("capricciosa", {
        deduction: {
          structureLines: ["このピザは全部で6種類の材料を使うよ", "トッピングは4種類使うよ"],
          attributeLines: ["まだわかっていないトッピングがあるよ"],
          structureOwned: true,
          attributeOwned: true,
        },
      }),
    );
    expect(document.querySelector('[data-hint-section="structure"]')!.textContent).toBe("構成このピザは全部で6種類の材料を使うよトッピングは4種類使うよ");
    expect(document.querySelector('[data-hint-section="attribute"]')!.textContent).toBe("特徴まだわかっていないトッピングがあるよ");
    for (const f of ["構成", "特徴"] as const) {
      fireEvent.click(family(f));
      expect(cta().textContent).toBe("✓ もらいずみ");
      expect(cta()).toBeDisabled();
    }
  });

  it("no-charge outcomes: 構成 nothing new / 特徴 no clue yet, the card disabled for this sheet, 「今回はPitzを使っていないよ」", () => {
    renderSelectable(selectableView("capricciosa", { deduction: {}, outcome: "STRUCTURE_GUIDANCE_ONLY" }));
    fireEvent.click(family("構成"));
    expect(document.querySelector(".hint-sheet__outcome")!.textContent).toBe("今は新しくわかることがなかったよ（Pitzは使っていないよ）");
    expect(cta()).toBeDisabled();
    expect(walletText()).toBe("所持 100 Pitz ・ 今回はPitzを使っていないよ");
    cleanup();
    renderSelectable(selectableView("capricciosa", { deduction: {}, outcome: "ATTRIBUTE_EXISTENCE_ONLY" }));
    fireEvent.click(family("特徴"));
    expect(document.querySelector(".hint-sheet__outcome")!.textContent).toBe("今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）");
    expect(cta()).toBeDisabled();
    // The 材料 card is unaffected by a 特徴 outcome.
    fireEvent.click(family("材料"));
    expect(cta()).toBeEnabled();
  });

  it("after 材料 guidance, a uniform line points to the other families only while they are unowned", () => {
    renderSelectable(selectableView("pizza-bianca", { outcome: "GUIDANCE_ONLY", deduction: {} }));
    expect(document.body).toHaveTextContent("構成・特徴のヒントもあるよ");
    cleanup();
    renderSelectable(selectableView("pizza-bianca", { outcome: "GUIDANCE_ONLY", deduction: { structureOwned: true, attributeOwned: true } }));
    expect(document.body).not.toHaveTextContent("構成・特徴のヒントもあるよ");
  });

  it("before any request, every target shows the same cards and prices (no pre-request availability or granularity)", () => {
    let reference: string | null = null;
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      renderSelectable(selectableView(r.id, { deduction: { nextPrice: 5, paidCount: 0 } }));
      const cards = (["構成", "特徴"] as const).map((f) => {
        fireEvent.click(family(f));
        return `${document.querySelector(".hint-sheet__card")!.textContent}|${cta().disabled}`;
      });
      reference ??= cards.join("/");
      expect(cards.join("/"), r.id).toBe(reference);
      cleanup();
    }
  });
});
