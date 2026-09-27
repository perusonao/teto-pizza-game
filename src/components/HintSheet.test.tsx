import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { buildHintSteps, type HintLevel } from "../logic/discovery/hintSteps";
import { selectableHintSavedState } from "../logic/discovery/hintFactMigration";
import { buildSelectableHintModel, selectableHintPresentation } from "../logic/discovery/selectableHint";
import type { HintSheetView } from "../state/discoveryHint";
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

  it("the CTA latches after one activation: a double-click reports once, focus stays, it re-arms after the latch", () => {
    vi.useFakeTimers();
    try {
      const { onBuySelectable } = renderSelectable(selectableView("capricciosa"));
      const cta = document.querySelector<HTMLButtonElement>(".hint-sheet__next")!;
      fireEvent.click(cta);
      fireEvent.click(cta);
      fireEvent.click(cta);
      expect(onBuySelectable).toHaveBeenCalledTimes(1);
      expect(cta).toHaveAttribute("aria-disabled", "true");
      expect(cta).toHaveFocus();
      act(() => vi.advanceTimersByTime(SELECTABLE_BUY_LATCH_MS));
      expect(cta).not.toHaveAttribute("aria-disabled");
      fireEvent.click(cta);
      expect(onBuySelectable).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("insufficient Pitz: a disabled CTA in the calm tone, focus on 閉じる", () => {
    const { onBuySelectable } = renderSelectable(selectableView("capricciosa", { pitz: 4 }));
    const cta = document.querySelector<HTMLButtonElement>(".hint-sheet__next")!;
    expect(cta).toBeDisabled();
    expect(cta).toHaveClass("hint-sheet__next--short");
    fireEvent.click(cta);
    expect(onBuySelectable).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
    expect(document.body).toHaveTextContent("Pitzがたまったら、またためしてね。このまま作ってもOK！");
    expect(cta).toHaveTextContent("ヒントを1つもらう 5 Pitz");
  });

  it("GUIDANCE_ONLY shows the generic line only -- no count, no category, no 'that is all'", () => {
    renderSelectable(selectableView("pizza-bianca", { outcome: "GUIDANCE_ONLY" }));
    const line = document.querySelector(".hint-sheet__guidance")!;
    expect(line.textContent).toBe(SELECTABLE_GUIDANCE_TEXT);
    // OD-H3-17: nothing states an ingredient count, a category absence or "that's all". The one
    // exception is the post-request CTA label (OD-H3-4-3, INTERACTION INFERENCE), which names hints,
    // never ingredients or categories.
    const cta = document.querySelector(".hint-sheet__next")!;
    expect(cta.textContent).toBe("今あるヒントはここまで");
    const rest = (document.body.textContent ?? "").split(cta.textContent!).join("");
    expect(rest).not.toMatch(/ここまで|全部|もうない|ありません|種類|ない$|使わない(?!ジャンルもあるよ)/);
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

/** H3-4 (Issue #238, OD-H3-4-1..10): the final SELECTABLE copy and presentation. */
describe("HintSheet -- Selectable H3-4 presentation", () => {
  const cta = () => document.querySelector<HTMLButtonElement>(".hint-sheet__next")!;
  const walletText = () => document.querySelector(".hint-sheet__wallet")!.textContent;

  it("OD-H3-4-9/2: a normal purchase reads 「ヒントを1つもらう {n} Pitz」 without 🔒, with the pay-only-when-given line", () => {
    renderSelectable(selectableView("capricciosa"));
    expect(cta().textContent).toBe("ヒントを1つもらう 5 Pitz");
    expect(cta()).toBeEnabled();
    expect(document.querySelector(".hint-sheet__lock")).toBeNull();
    expect(document.body.textContent).not.toContain("\u{1F512}");
    expect(document.body.textContent).not.toContain("解除");
    expect(walletText()).toBe("所持 100 Pitz ・ Pitzはヒントが出たときだけ使うよ");
    expect(document.querySelector(".hint-sheet__prefs-legend")!.textContent).toBe("知りたいジャンル（ないときは別のジャンルから1つ）");
  });

  it("OD-H3-4-1: price 0 reads 「ヒントをたずねる」 + 「支払いずみ」, enabled, and never 「0 Pitz」 / 無料 / sold out", () => {
    const { onBuySelectable } = renderSelectable(selectableView("capricciosa", { legacyLevel: 4 }));
    expect(cta().textContent).toBe("ヒントをたずねる 支払いずみ");
    expect(cta()).toBeEnabled();
    expect(cta()).toHaveFocus();
    expect(cta().textContent).not.toContain("Pitz");
    expect(document.body.textContent).not.toMatch(/無料|品切れ|売り切れ|もうない/);
    expect(walletText()).toBe("所持 100 Pitz ・ このピザのヒント代は上限まで支払いずみ");
    fireEvent.click(cta());
    expect(onBuySelectable).toHaveBeenCalledWith("sauce", 4);
  });

  it("OD-H3-4-1/3: at price 0 the pre-request view is identical whether a real fact is left (legacy) or not (fresh, all bought)", () => {
    const shape = () => ({
      cta: cta().textContent,
      enabled: !cta().disabled,
      wallet: walletText(),
      legend: document.querySelector(".hint-sheet__prefs-legend")!.textContent,
      guidance: document.querySelector(".hint-sheet__guidance"),
    });
    // Legacy H1 capricciosa after 3 paid facts: price 0 and one real fact still for sale (cap parity).
    renderSelectable(selectableView("capricciosa", { legacyLevel: 1, facts: ["ing:tomato-sauce", "ing:mozzarella", "ing:mushroom"] }));
    const withFactLeft = shape();
    cleanup();
    // Fresh capricciosa with all 4 facts bought: price 0 and nothing left.
    renderSelectable(selectableView("capricciosa", { facts: ["ing:tomato-sauce", "ing:mozzarella", "ing:mushroom", "ing:ham"] }));
    const nothingLeft = shape();
    expect(withFactLeft.cta).toBe("ヒントをたずねる 支払いずみ");
    expect(withFactLeft.enabled).toBe(true);
    expect(nothingLeft).toEqual(withFactLeft);
  });

  it("OD-H3-4-3: only after GUIDANCE_ONLY is the CTA disabled and relabelled; a further activation reports nothing", () => {
    const { onBuySelectable } = renderSelectable(selectableView("capricciosa", { legacyLevel: 4, outcome: "GUIDANCE_ONLY" }));
    expect(cta()).toBeDisabled();
    expect(cta().textContent).toBe("今あるヒントはここまで");
    expect(walletText()).toBe("所持 100 Pitz ・ 今回はPitzを使っていないよ");
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveFocus();
    fireEvent.click(cta());
    fireEvent.keyDown(cta(), { key: "Enter" });
    expect(onBuySelectable).not.toHaveBeenCalled();
    // Also at a non-zero price (fresh margherita-like exhaustion): the guidance answers, the CTA stops.
    cleanup();
    renderSelectable(selectableView("pizza-bianca", { outcome: "GUIDANCE_ONLY" }));
    expect(cta()).toBeDisabled();
    expect(cta().textContent).toBe("今あるヒントはここまで");
  });

  it("OD-H3-4-3: the same exhausted target before its request keeps an enabled CTA at its price (no pre-request exhaustion signal)", () => {
    renderSelectable(selectableView("pizza-bianca"));
    expect(cta().textContent).toBe("ヒントを1つもらう 5 Pitz");
    expect(cta()).toBeEnabled();
    expect(document.querySelector(".hint-sheet__guidance")).toBeNull();
  });

  it("OD-H3-4-4: grandfathered lines are an archive box at the end of the body -- not a row, chip, step pill or price", () => {
    renderSelectable(selectableView("capricciosa", { legacyLevel: 4, outcome: "GUIDANCE_ONLY" }));
    const body = document.querySelector(".hint-sheet__selectable")!;
    const legacy = body.querySelector(".hint-sheet__legacy")!;
    expect(body.lastElementChild).toBe(legacy);
    expect(legacy.querySelector(".hint-sheet__legacy-title")!.textContent).toBe("以前のヒント");
    expect(legacy).toHaveTextContent("前のヒント方式で買ったメモ（そのまま残してあるよ）");
    expect([...legacy.querySelectorAll(".hint-sheet__legacy-line")].map((e) => e.textContent)).toEqual(["材料は全部で6種類。チーズを使うみたい"]);
    expect(legacy.querySelector(".hint-sheet__step, .hint-sheet__chip, input, button")).toBeNull();
    expect(legacy.textContent).not.toMatch(/Pitz|ソース$|トッピング/);
    // The guidance line comes before the archive, right after the rows.
    expect(body.querySelector(".hint-sheet__guidance")!.compareDocumentPosition(legacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("OD-H3-4-4: grandfathered lines never change the price or the rows (verbatim, not a fact)", () => {
    // legacy H2 pesto-tonno keeps a count line at level 2; its price is the rung, not the line count.
    renderSelectable(selectableView("pesto-tonno", { legacyLevel: 2 }));
    expect(document.querySelectorAll(".hint-sheet__legacy-line")).toHaveLength(1);
    expect(cta().textContent).toBe("ヒントを1つもらう 20 Pitz");
    expect(document.querySelectorAll(".hint-sheet__row")).toHaveLength(3);
    expect(document.querySelector(".hint-sheet__rows")!.textContent).not.toContain("材料は全部で");
  });

  it("OD-H3-4-5: a newly revealed chip is highlighted after a request, never on opening; the fallback states no absence", () => {
    const onBuySelectable = vi.fn();
    const props = { onUnlock: vi.fn(), onBuySelectable, onClose: vi.fn() };
    const { rerender } = render(<HintSheet view={selectableView("capricciosa", { facts: ["ing:tomato-sauce"] })} {...props} />);
    expect(document.querySelectorAll(".hint-sheet__chip--new")).toHaveLength(0);
    // "sauce" preferred again, but the reducer served cheese (fallback): only the new cheese chip is marked.
    rerender(<HintSheet view={selectableView("capricciosa", { facts: ["ing:tomato-sauce", "ing:mozzarella"] })} {...props} />);
    const fresh = [...document.querySelectorAll(".hint-sheet__chip--new")];
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toHaveTextContent("モッツァレラ");
    expect(fresh[0].closest(".hint-sheet__row")).toHaveAttribute("data-hint-category", "cheese");
    expect(screen.getByRole("radio", { name: "ソース" })).toBeChecked();
    expect(document.body.textContent).not.toMatch(/ソースは(もう)?ない|ソースのヒントはない|使わないみたい/);
    // A request that reveals nothing (GUIDANCE_ONLY) adds no new mark.
    rerender(
      <HintSheet view={selectableView("capricciosa", { facts: ["ing:tomato-sauce", "ing:mozzarella"], outcome: "GUIDANCE_ONLY" })} {...props} />,
    );
    expect(document.querySelectorAll(".hint-sheet__chip--new")).toHaveLength(1);
  });

  it("OD-H3-4-6: 「？」 and its legend are the same for a recipe without cheese as for one with cheese", () => {
    const view = () => ({
      cheese: document.querySelector('[data-hint-category="cheese"] .hint-sheet__chips')!.innerHTML,
      legend: document.querySelector(".hint-sheet__unknown-legend")!.textContent,
      cta: cta().textContent,
      radios: screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value),
    });
    renderSelectable(selectableView("marinara")); // no cheese
    const noCheese = view();
    cleanup();
    renderSelectable(selectableView("capricciosa")); // has cheese
    expect(view()).toEqual(noCheese);
    expect(noCheese.legend).toBe("？＝まだわからない（使わないジャンルもあるよ）");
    expect(noCheese.cheese).toContain("？");
    cleanup();
    renderSelectable(selectableView("quattro-formaggi")); // no topping
    expect(document.querySelector('[data-hint-category="topping"] .hint-sheet__chips')!.textContent).toBe("？");
  });

  it("every recipe, every pre-request paid state: the same static copy (legend, 「？」 legend, CTA verb) and no identity", () => {
    const ingredientNames = [...new Set(INGREDIENTS.map((i) => i.nameJa))].sort((a, b) => b.length - a.length);
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      for (const legacyLevel of [0, 1, 2, 3, 4]) {
        renderSelectable(selectableView(r.id, { legacyLevel }));
        const label = document.querySelector(".hint-sheet__next-label")!.textContent;
        expect(["ヒントを1つもらう", "ヒントをたずねる"], `${r.id} H${legacyLevel}`).toContain(label);
        expect(document.querySelector(".hint-sheet__unknown-legend")!.textContent).toBe("？＝まだわからない（使わないジャンルもあるよ）");
        expect(document.querySelector(".hint-sheet__guidance"), `${r.id} H${legacyLevel}`).toBeNull();
        expect(cta().disabled, `${r.id} H${legacyLevel}`).toBe(false);
        const text = ingredientNames.reduce((t, n) => t.split(n).join("□"), document.body.textContent ?? "");
        expect(text, r.id).not.toContain(r.nameJa);
        cleanup();
      }
    }
  });
});

