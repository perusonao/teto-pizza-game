import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { INGREDIENT_TOTAL_FACT_ID } from "../logic/discovery/deductionHint";
import { hint5ClassFactId, HINT5_RUNG_MARKER } from "../logic/discovery/hint5Ladder";
import { researchBoardOf, type ResearchBoardInputs } from "../logic/discovery/researchBoard";
import { discoveredDex } from "../state/testSupport/guidedRound";
import { TrialNotebookSheet } from "./TrialNotebookSheet";
import { BOARD_COPY } from "./researchBoardCopy";

/** Research Board S4: the Notebook renders the S1 read model only, and nothing identifying. */
afterEach(cleanup);

const T = "pesto-pollo";
const owned = [...STARTER_INGREDIENT_IDS, ...DISCOVERY_LADDER.steps.filter((s) => s.step <= 25).flatMap((s) => s.ingredientIds)];
const keys = ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < 25).map((s) => s.keyRecipeId)];
const inputs = (extra: Partial<ResearchBoardInputs> = {}): ResearchBoardInputs => ({
  dex: discoveredDex([...keys, "brazilian-calabresa", "aussie"]),
  ownedIngredientIds: owned,
  ...extra,
});
const renderBoard = (extra: Partial<ResearchBoardInputs> = {}) => {
  const board = researchBoardOf(inputs(extra), T)!;
  return render(<TrialNotebookSheet entries={[]} onBack={() => {}} researchLabelJa={board.labelJa} researchBoard={board} />);
};

describe("Research Board in the Notebook", () => {
  it("renders nothing without a board (no target)", () => {
    const { container } = render(<TrialNotebookSheet entries={[]} onBack={() => {}} />);
    expect(container.querySelector("[data-research-board]")).toBeNull();
  });

  it("fresh entry: only ✓ with the unlock ingredient; no ✗ / △ sections; says it is saved information", () => {
    const { container } = renderBoard();
    const el = container.querySelector("[data-research-board]")!;
    expect(el.textContent).toContain(BOARD_COPY.note);
    expect(el.querySelector("[data-research-board-known]")!.textContent).toContain("チキン");
    expect(el.querySelector("[data-research-board-excluded]")).toBeNull();
    expect(el.querySelector("[data-research-board-unsure]")).toBeNull();
  });

  it("✓ bought names, ✗ ledger (stale dropped), △ class + total", () => {
    const { container } = renderBoard({
      discoveryHintFacts: { [T]: ["ing:pesto", HINT5_RUNG_MARKER.STRUCTURE, hint5ClassFactId("fresh-tomato"), INGREDIENT_TOTAL_FACT_ID] },
      researchExclusions: { [T]: ["egg", "mozzarella", "no-such-ingredient"] },
    });
    const text = (s: string) => container.querySelector(s)!.textContent!;
    expect(text("[data-research-board-known]")).toMatch(/ジェノベーゼ/);
    expect(text("[data-research-board-excluded]")).not.toMatch(/モッツァレラ|mozzarella|no-such/);
    expect(text("[data-research-board-excluded]")).toContain("たまご");
    expect(text("[data-research-board-unsure]")).toContain("野菜");
    expect(text("[data-research-board-unsure]")).toContain("全部で4種類");
  });

  it("privacy: the Board DOM carries no recipe name / id / No. / count / trial / technique wording", () => {
    const { container } = renderBoard({
      discoveryHintFacts: { [T]: ["ing:pesto", HINT5_RUNG_MARKER.STRUCTURE, hint5ClassFactId("fresh-tomato"), INGREDIENT_TOTAL_FACT_ID] },
      researchExclusions: { [T]: ["egg"] },
    });
    const html = container.querySelector("[data-research-board]")!.outerHTML;
    for (const r of RECIPES.filter((x) => x.id === T)) {
      expect(html).not.toContain(r.id);
      expect(html).not.toContain(r.nameJa);
    }
    expect(html).not.toMatch(/No\.|候補|のこり|残り|試作 #|回目|テクニック|Technique|hash|cohort/i);
  });
});
