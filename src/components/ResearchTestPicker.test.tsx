import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { ResearchTestPicker } from "./ResearchTestPicker";
import { ResultPanel } from "./ResultPanel";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";

/**
 * Issue #356 Slice 2: the picker and the RESULT line. The picker's candidates are a function of ownership, stock and
 * what the player already knows -- never of the hidden recipe; the RESULT line has three strings and no oracle.
 */
afterEach(() => cleanup());

const OWNED = ["tomato-sauce", "mozzarella", "basil", "egg", "mushroom", "chicken", "pesto"];
const nameOf = (id: string) => INGREDIENTS.find((i) => i.id === id)!.nameJa;
const base = {
  ownedIngredientIds: OWNED,
  inventory: { egg: 5, mushroom: 0, chicken: 3, pesto: 2 } as Record<string, number>,
  candidateIds: OWNED.filter((id) => id !== "chicken"), // chicken is already known for this target
  selectableIds: new Set(OWNED.filter((id) => id !== "chicken" && id !== "mushroom")),
  selectedId: null as string | null,
  onSelect: vi.fn(),
  onClear: vi.fn(),
  onClose: vi.fn(),
};
const open = (props: Partial<typeof base> = {}) => {
  cleanup();
  return render(<ResearchTestPicker {...base} {...props} />);
};

describe("ResearchTestPicker", () => {
  it("lists owned, not-yet-known ingredients only; a known one and an unowned one never appear", () => {
    open();
    expect(screen.queryByText(nameOf("chicken"))).toBeNull();
    expect(screen.queryByText(nameOf("anchovy"))).toBeNull();
    for (const id of ["tomato-sauce", "mozzarella", "egg", "pesto"]) expect(screen.getByText(nameOf(id))).toBeInTheDocument();
  });

  it("a stock-0 ingredient is shown but cannot be chosen; a choosable one calls onSelect once", () => {
    const onSelect = vi.fn();
    open({ onSelect });
    fireEvent.click(screen.getByText(nameOf("mushroom")).closest("button")!);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(nameOf("egg")).closest("button")!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("egg");
  });

  it("marks the current selection and offers to clear it; no selection offers no clear", () => {
    expect(open().container.querySelector(".research-test-picker__clear")).toBeNull();
    const onClear = vi.fn();
    const { container } = open({ selectedId: "egg", onClear });
    expect(screen.getByText(nameOf("egg")).closest("button")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(container.querySelector(".research-test-picker__clear")!);
    expect(onClear).toHaveBeenCalled();
  });

  it("its DOM carries no recipe identity, count, correctness or highlight (it has no recipe input at all)", () => {
    const { container } = open();
    const html = container.innerHTML;
    const ingredientNames = INGREDIENTS.map((i) => i.nameJa).join("|");
    for (const r of RECIPES) {
      if (!ingredientNames.includes(r.nameJa)) expect(html, r.id).not.toContain(r.nameJa);
    }
    expect(container.textContent).not.toMatch(/正解|不正解|おすすめ|有力|候補|残り|あと[0-9０-９]|[0-9０-９]+\s*[/／]\s*[0-9０-９]+|近い|遠い|おしい/);
    expect(container.querySelectorAll(".pantry-tile__toggle[aria-pressed='true']")).toHaveLength(0);
  });

  it("is a pure function of ownership / stock / known set: the same inputs give byte-identical DOM", () => {
    const strip = (html: string) => html.replace(/_r_[0-9a-z]+_/g, "ID");
    expect(strip(open().container.innerHTML)).toBe(strip(open().container.innerHTML));
  });

  it("aria-modal focus: Tab wraps from the last control to the first and Shift+Tab back (nothing behind is reachable)", () => {
    open();
    const dialog = screen.getByRole("dialog");
    const buttons = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex]:not([tabindex='-1'])")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("with nothing to check it says so without a reason", () => {
    open({ candidateIds: [], selectableIds: new Set() });
    expect(screen.getByText("いま調べられる食材はありません")).toBeInTheDocument();
  });
});

describe("ResultPanel ingredient line", () => {
  const ORDINARY: DiscoveryOutcome = { kind: "ORIGINAL", blockedTargetIds: [] };
  const AMBIGUOUS: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["a", "b"] };
  const INCOMPLETE: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: "quattro-formaggi", targetId: "shipped:quattro-formaggi" };
  const panel = (discovery: DiscoveryOutcome, props: Partial<Parameters<typeof ResultPanel>[0]> = {}) => {
    cleanup();
    return render(
      <ResultPanel
        completion={{ status: "PASS" }}
        score={null}
        bakeState="perfect"
        sauceScore={null}
        headingJa="x"
        recipeNameJa="S"
        justDiscovered={false}
        justGotNewBest={false}
        pitzCredit={null}
        freeCook
        discovery={discovery}
        usedIngredientIds={["tomato-sauce", "egg"]}
        researchLabelJa="？？？ピザ"
        onRetrySameRecipe={vi.fn()}
        onBackToPizzaSelect={vi.fn()}
        {...props}
      />,
    ).container;
  };

  it("the three strings", () => {
    panel(ORDINARY, { ingredientTest: { ingredientId: "egg", verdict: "POSITIVE" } });
    expect(screen.getByText("✓ たまごを使う")).toBeInTheDocument();
    panel(ORDINARY, { ingredientTest: { ingredientId: "egg", verdict: "NOT_IDENTIFIED" } });
    expect(screen.getByText("たまごは特定できませんでした")).toBeInTheDocument();
    panel(ORDINARY, { ingredientTest: { ingredientId: "egg", verdict: "NOT_USED" } });
    expect(screen.getByText("たまごは今回の試作に入っていなかったので、調べていません")).toBeInTheDocument();
  });

  it("INV-3: negative / AMBIGUOUS / INCOMPLETE_MATCH render byte-identically with the same NOT_IDENTIFIED", () => {
    const t = { ingredientTest: { ingredientId: "egg", verdict: "NOT_IDENTIFIED" as const } };
    const o = panel(ORDINARY, t).innerHTML;
    expect(panel(AMBIGUOUS, t).innerHTML).toBe(o);
    expect(panel(INCOMPLETE, t).innerHTML).toBe(o);
  });

  it("no declaration / targetless: byte-identical to today's ORIGINAL card", () => {
    const plain = panel(ORDINARY).innerHTML;
    expect(panel(ORDINARY, { ingredientTest: null }).innerHTML).toBe(plain);
    expect(panel(ORDINARY, { researchLabelJa: null, ingredientTest: { ingredientId: "egg", verdict: "POSITIVE" } }).innerHTML).toBe(
      panel(ORDINARY, { researchLabelJa: null }).innerHTML,
    );
  });

  it("the line adds no oracle wording or hidden identity", () => {
    for (const verdict of ["POSITIVE", "NOT_IDENTIFIED", "NOT_USED"] as const) {
      const c = panel(ORDINARY, { ingredientTest: { ingredientId: "egg", verdict } });
      const text = c.textContent ?? "";
      expect(text).not.toMatch(/不正解|一致しません|足りない|間違|残り|あと[0-9０-９]|おしい|[0-9０-９]+\s*[/／]\s*[0-9０-９]+|[%％]|近い|遠い|含まれていません|使わない食材/);
      for (const r of RECIPES) expect(c.innerHTML).not.toContain(`data-recipe="${r.id}"`);
    }
  });
});
