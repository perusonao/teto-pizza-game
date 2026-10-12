import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getRecipe } from "../data/recipes";
import type { ResearchResultRow } from "../logic/discovery/researchResultRows";
import { ResultPanel } from "./ResultPanel";
import { RESEARCH_UX_COPY } from "./researchUxCopy";

/**
 * Issue #472: the bake-FAILED Research card says once, in one fixed sentence, that the disclosed ○× stay. It shows only
 * while the ○× panel really draws a chip (empty pizza / invalid target / cap-only: no promise), and the whole card
 * names neither the hidden recipe nor an ingredient the player did not use (Contract 2.1, INV-B3 / B6 / B7).
 */
const HIDDEN = getRecipe("pesto-pollo")!;
const KEPT = "使った材料の○×は残ったよ";
const FAILED = { status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] } as const;
const ROWS: ResearchResultRow[] = [
  { ingredientId: "pesto", category: "sauce", verdict: "POSITIVE" },
  { ingredientId: "egg", category: "topping", verdict: "NEGATIVE" },
];

function failedCard(props: Partial<Parameters<typeof ResultPanel>[0]> = {}) {
  cleanup();
  const { container } = render(
    <ResultPanel
      completion={FAILED}
      score={null}
      bakeState="raw"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={null}
      usedIngredientIds={["pesto", "egg"]}
      researchLabelJa="？？？ピザ"
      researchRows={{ rows: ROWS, toppingOverCap: false }}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      onShowHint={vi.fn()}
      onOpenAttemptLog={vi.fn()}
      {...props}
    />,
  );
  return container.innerHTML;
}

afterEach(() => cleanup());

describe("FAILED Research card: 「使った材料の○×は残ったよ」", () => {
  it("is the fixed copy and shows under the ○× panel when a chip is drawn", () => {
    expect(RESEARCH_UX_COPY.failedKept).toBe(KEPT);
    failedCard();
    expect(screen.getByTestId("research-rows")).toBeInTheDocument();
    const note = screen.getByTestId("research-failed-kept");
    expect(note).toHaveTextContent(KEPT);
    // After the panel, inside the same headline block.
    expect(screen.getByTestId("research-rows").compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is byte-identical for a different set of rows (no verdict, count or target dependence)", () => {
    const note = (rows: ResearchResultRow[]) => {
      failedCard({ researchRows: { rows, toppingOverCap: false } });
      return screen.getByTestId("research-failed-kept").outerHTML;
    };
    const a = note(ROWS);
    expect(note([{ ingredientId: "egg", category: "topping", verdict: "NEGATIVE" }])).toBe(a);
    expect(note([...ROWS, { ingredientId: "mozzarella", category: "cheese", verdict: "POSITIVE" }])).toBe(a);
  });

  it("is absent when no ○× is disclosed: empty pizza / invalid target (rows null)", () => {
    failedCard({ researchRows: null, usedIngredientIds: [] });
    expect(screen.queryByTestId("research-failed-kept")).toBeNull();
    expect(screen.queryByTestId("research-rows")).toBeNull();
    expect(screen.queryByText(/○×/)).toBeNull();
  });

  it("is absent when the panel draws nothing (no rows, no cap) or only the topping-cap note", () => {
    failedCard({ researchRows: { rows: [], toppingOverCap: false } });
    expect(screen.queryByTestId("research-failed-kept")).toBeNull();
    failedCard({ researchRows: { rows: [], toppingOverCap: true } });
    expect(screen.getByTestId("research-rows")).toBeInTheDocument();
    expect(screen.queryByTestId("research-failed-kept")).toBeNull();
  });

  it("is absent without a Research label (targetless FREE) and on a non-FAILED card", () => {
    failedCard({ researchLabelJa: null });
    expect(screen.queryByTestId("research-failed-kept")).toBeNull();
    failedCard({ completion: { status: "PASS" }, discovery: { kind: "ORIGINAL", blockedTargetIds: [] }, bakeState: "perfect" });
    expect(screen.queryByTestId("research-failed-kept")).toBeNull();
  });

  it("the FAILED card never names the hidden recipe or an ingredient the player did not use", () => {
    const dom = failedCard();
    const text = document.body.textContent ?? "";
    for (const needle of [HIDDEN.id, HIDDEN.nameJa, "チキン", "pesto-pollo"]) {
      expect(dom).not.toContain(needle);
      expect(text).not.toContain(needle);
    }
    expect(dom).not.toMatch(/data-(kind|outcome|candidate|target|recipe)/i);
    expect(dom).not.toMatch(/No\.|候補|残り[0-9０-９]|個中|テクニック|NEW PIZZA/);
    // The reason line is one of the three fixed sentences.
    expect(document.querySelector(".result-panel__failed-reason")?.textContent).toBe("生焼けで提供できません");
  });
});
