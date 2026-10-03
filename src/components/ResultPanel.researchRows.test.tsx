import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RECIPES } from "../data/recipes";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import type { ResearchResultRow } from "../logic/discovery/researchResultRows";
import { ResultPanel, RESEARCH_TOPPING_CAP_COPY } from "./ResultPanel";

/** Contract 2.1 S5: the RESULT panel renders `researchRows` as given; it judges nothing. */
const ORDINARY: DiscoveryOutcome = { kind: "ORIGINAL", blockedTargetIds: [] };
const AMBIGUOUS: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["shipped:a", "shipped:b"] };
const INCOMPLETE: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: "quattro-formaggi", targetId: "shipped:quattro-formaggi" };
const row = (ingredientId: string, category: ResearchResultRow["category"], verdict: ResearchResultRow["verdict"]): ResearchResultRow => ({ ingredientId, category, verdict });
const name = (id: string) => getIngredient(id)!.nameJa;

type Rows = { rows: readonly ResearchResultRow[]; toppingOverCap: boolean } | null;
function show(researchRows: Rows, props: Partial<Parameters<typeof ResultPanel>[0]> = {}, discovery: DiscoveryOutcome = ORDINARY) {
  cleanup();
  const { container } = render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={null}
      bakeState="perfect"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={discovery}
      usedIngredientIds={["pesto", "egg"]}
      researchLabelJa="？？？ピザ ①"
      researchRows={researchRows}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      onShowHint={vi.fn()}
      onOpenAttemptLog={vi.fn()}
      {...props}
    />,
  );
  return container;
}
const panel = () => screen.queryByTestId("research-rows");
const chips = (el: HTMLElement) => within(el).queryAllByRole("listitem").map((li) => li.textContent);
afterEach(cleanup);

describe("chips", () => {
  it("positive and negative chips carry the symbol (and a word-form accessible name)", () => {
    show({ rows: [row("pesto", "sauce", "POSITIVE"), row("egg", "topping", "NEGATIVE")], toppingOverCap: false });
    expect(chips(panel()!)).toEqual([`${name("pesto")}○`, `${name("egg")}×`]);
    expect(screen.getByLabelText(`${name("pesto")}、研究中ピザの材料`)).toHaveClass("research-rows__chip--positive");
    expect(screen.getByLabelText(`${name("egg")}、研究中ピザの材料ではない`)).toHaveClass("research-rows__chip--negative");
  });
  it("category order is sauce -> cheese -> topping and the given placement order is kept", () => {
    show({
      rows: [row("mozzarella", "cheese", "POSITIVE"), row("pesto", "sauce", "NEGATIVE"), row("sausage", "topping", "POSITIVE"), row("bacon", "topping", "NEGATIVE"), row("ham", "topping", "POSITIVE")],
      toppingOverCap: false,
    });
    const groups = [...panel()!.querySelectorAll("[data-research-category]")].map((g) => g.getAttribute("data-research-category"));
    expect(groups).toEqual(["sauce", "cheese", "topping"]);
    expect(chips(panel()!)).toEqual([`${name("pesto")}×`, `${name("mozzarella")}○`, `${name("sausage")}○`, `${name("bacon")}×`, `${name("ham")}○`]);
  });
  it("a category with no judgment is not rendered, and nothing says 'none' (no sauce / cheese absence copy)", () => {
    show({ rows: [row("egg", "topping", "NEGATIVE")], toppingOverCap: false });
    expect(panel()!.querySelector('[data-research-category="sauce"]')).toBeNull();
    expect(panel()!.querySelector('[data-research-category="cheese"]')).toBeNull();
    expect(panel()!.textContent).not.toMatch(/ソース|チーズ|なし|使わない/);
  });
});

describe("visibility", () => {
  it("null, and rows 0 with no over-cap, render no panel", () => {
    show(null);
    expect(panel()).toBeNull();
    show({ rows: [], toppingOverCap: false });
    expect(panel()).toBeNull();
  });
  it("a non-research ORIGINAL (targetless) renders no panel even if rows were passed", () => {
    show({ rows: [row("pesto", "sauce", "POSITIVE")], toppingOverCap: false }, { researchLabelJa: null });
    expect(panel()).toBeNull();
  });
  it("ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH render byte-identically", () => {
    const rows: Rows = { rows: [row("pesto", "sauce", "POSITIVE"), row("egg", "topping", "NEGATIVE")], toppingOverCap: false };
    const o = show(rows, {}, ORDINARY).innerHTML;
    expect(show(rows, {}, AMBIGUOUS).innerHTML).toBe(o);
    expect(show(rows, {}, INCOMPLETE).innerHTML).toBe(o);
  });
});

describe("topping over-cap (K = 3)", () => {
  it("shows the exact explanation and no topping chip; the panel shows for the explanation alone", () => {
    show({ rows: [], toppingOverCap: true });
    expect(panel()).not.toBeNull();
    expect(RESEARCH_TOPPING_CAP_COPY).toBe("トッピングは一度に3種類まで調べられるよ");
    expect(screen.getByText("トッピングは一度に3種類まで調べられるよ")).toBeInTheDocument();
    expect(within(panel()!).queryAllByRole("listitem")).toHaveLength(0);
  });
  it("sauce / cheese rows stay visible next to the explanation", () => {
    show({ rows: [row("pesto", "sauce", "POSITIVE"), row("mozzarella", "cheese", "NEGATIVE")], toppingOverCap: true });
    expect(chips(panel()!)).toEqual([`${name("pesto")}○`, `${name("mozzarella")}×`]);
    expect(screen.getByText(RESEARCH_TOPPING_CAP_COPY)).toBeInTheDocument();
  });
});

describe("placement and neighbours", () => {
  it("sits after the lead and before the bake badge / advice; the used-ingredients list is kept", () => {
    const el = show({ rows: [row("pesto", "sauce", "POSITIVE")], toppingOverCap: false }, { executionAdviceJa: "ADVICE-LINE" });
    const order = ["original-pizza__lead", "research-rows", "result-panel__bake-badge", "original-pizza__advice"].map((c) => el.innerHTML.indexOf(c));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const used = within(el).getByRole("list", { name: "使った材料" });
    expect(used.textContent).toContain(name("pesto")); // same ingredient as a chip: both stay
    expect(panel()!.textContent).toContain(name("pesto"));
  });
  it("the fixed action bar still renders its CTAs", () => {
    show({ rows: [row("pesto", "sauce", "POSITIVE")], toppingOverCap: false });
    expect(screen.getByRole("button", { name: "もう一度試す" })).toBeInTheDocument();
  });
});

describe("privacy", () => {
  it("no hidden identity, count, ratio, verdict-on-the-whole or absence wording in text or aria", () => {
    const el = show({ rows: [row("pesto", "sauce", "NEGATIVE"), row("mozzarella", "cheese", "NEGATIVE"), row("egg", "topping", "POSITIVE")], toppingOverCap: false });
    const scope = panel()!;
    const dump = scope.textContent + [...scope.querySelectorAll("[aria-label]")].map((n) => n.getAttribute("aria-label")).join(" ") + (scope.getAttribute("aria-label") ?? "");
    for (const r of RECIPES) {
      expect(dump).not.toContain(r.id);
      // (a recipe name that is also part of an ingredient's own name, e.g. ジェノベーゼ, is not a leak)
      if (!INGREDIENTS.some((i) => i.nameJa.includes(r.nameJa))) expect(dump).not.toContain(r.nameJa);
    }
    expect(dump).not.toMatch(/[0-9０-９]|個中|全部|あと|残り|不足|足りない|正解|おしい|近い|遠い|なし|使わない|類似|距離/);
    expect(el.querySelector("[aria-live]")).toBeNull();
  });
});
