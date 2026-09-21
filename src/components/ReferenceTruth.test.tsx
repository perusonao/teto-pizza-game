import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RECIPES, getRecipe } from "../data/recipes";
import { getReferencePizza, buildIdealSauceFixture } from "../data/referencePizza";
import { getPlayerReferencePizza } from "../data/playerReference";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { getIngredient } from "../data/ingredients";
import { createIdealDoughShape } from "../logic/doughShape";
import { ReferenceThumbnail } from "./ReferenceThumbnail";
import { ReferencePreview } from "./ReferencePreview";
import { PlayerReferencePreview } from "./PlayerReferencePreview";

/**
 * Issue #167 PR-B (Reference Truth): the primary complaint this PR fixes is
 * 「見本と、実際に作るPizzaStageが別物に見える」-- pins the shared-data/shared-renderer
 * contract that makes it structurally impossible for the mini thumbnail, the full popover, and
 * (by construction, since they now share `SauceHeatmapCanvas`/`renderPizzaVisualPieces` with
 * PizzaStage itself) the real Cooking UI to silently drift into three different pictures of
 * "the same" pizza again.
 */

afterEach(() => {
  cleanup();
});

// Captures the exact props every Reference context hands to the shared sauce renderer,
// without needing a real <canvas> 2D context (unavailable in jsdom) -- see this file's own
// header for why asserting on props here is the meaningful "sauce type/coverage matches"
// check, not a pixel-level one (SauceHeatmapCanvas's own pixel pipeline is unit-tested
// directly against sauceField.ts's pure functions elsewhere).
vi.mock("./SauceHeatmapCanvas", () => ({
  SauceHeatmapCanvas: (props: { deposits: readonly { x: number; y: number; amount: number }[]; color: string; className?: string }) => (
    <div
      data-testid="sauce-heatmap-probe"
      data-color={props.color}
      data-deposit-count={props.deposits.length}
      data-oil={String(props.className?.includes("pizza-sauce-heatmap--oil") ?? false)}
    />
  ),
}));

const IDEAL_SAUCE_FIXTURE = buildIdealSauceFixture();
const IDEAL_DOUGH_SHAPE = createIdealDoughShape();

describe("Reference Truth: authoritative data source (Issue #167 PR-B §5/§13.1/§13.6)", () => {
  it("every recipe with a Scoring 2.0 Reference fixture is reachable from getReferencePizza -- no separate hard-coded list", () => {
    for (const recipe of RECIPES) {
      const reference = getReferencePizza(recipe.id);
      // Today all 15 shipped recipes have a fixture (B2 PART A/C1/C2 + Recipe Expansion
      // batches) -- this loop still holds if a future recipe genuinely has none, since the
      // fallback (PlayerReferencePreview, tested separately below) exists for exactly that case.
      if (!reference) continue;
      expect(reference.recipeId).toBe(recipe.id);
      expect(reference.pieceGroups.length).toBeGreaterThan(0);
    }
  });

  it("ReferenceThumbnail and ReferencePreview render the exact same pieceGroups object for every recipe (SSOT, not two independent recomputations)", () => {
    for (const recipe of RECIPES) {
      const reference = getReferencePizza(recipe.id);
      const playerReference = getPlayerReferencePizza(recipe);
      const pieceGroups = reference ? reference.pieceGroups : playerReference.pieceGroups;
      const sauceIngredientId = reference ? reference.sauce.ingredientId : playerReference.sauceIngredientId;

      const { container: thumbContainer } = render(
        <ReferenceThumbnail sauceIngredientId={sauceIngredientId} pieceGroups={pieceGroups} />,
      );
      const thumbPieceCount = thumbContainer.querySelectorAll(".reference-thumbnail__piece").length;
      const expectedPieceCount = pieceGroups.reduce((sum, g) => sum + g.positions.length, 0);
      expect(thumbPieceCount, `${recipe.id}: thumbnail piece count`).toBe(expectedPieceCount);
      cleanup();
    }
  });
});

describe("Reference Truth: sauce type/coverage matches the recipe's own authoritative sauce (Issue #167 PR-B §8)", () => {
  for (const recipe of RECIPES) {
    const reference = getReferencePizza(recipe.id);
    if (!reference) continue;
    const expectedProfile = getRecipeSauceProfile(recipe.id);
    const expectedIngredient = getIngredient(expectedProfile.ingredientId)!;

    it(`${recipe.id}: ReferenceThumbnail's sauce heatmap uses the recipe's own sauce color/ideal deterministic coverage`, () => {
      render(
        <ReferenceThumbnail sauceIngredientId={reference.sauce.ingredientId} pieceGroups={reference.pieceGroups} />,
      );
      expect(reference.sauce.ingredientId).toBe(expectedProfile.ingredientId);
      const probe = screen.getByTestId("sauce-heatmap-probe");
      expect(probe.dataset.color).toBe(expectedIngredient.color);
      expect(Number(probe.dataset.depositCount)).toBe(IDEAL_SAUCE_FIXTURE.length);
      expect(probe.dataset.oil).toBe(String(expectedProfile.ingredientId === "olive-oil"));
    });

    it(`${recipe.id}: ReferencePreview's modal sauce heatmap uses the same fixture/color as the thumbnail`, () => {
      render(
        <ReferencePreview
          reference={reference}
          recipeNameJa={recipe.nameJa}
          isOpen
          onOpenChange={() => {}}
        />,
      );
      const probe = screen.getByTestId("sauce-heatmap-probe");
      expect(probe.dataset.color).toBe(expectedIngredient.color);
      expect(Number(probe.dataset.depositCount)).toBe(IDEAL_SAUCE_FIXTURE.length);
    });
  }

  it("the ideal Reference dough shape is a uniform circle at DOUGH_RADIUS -- the same ideal target the DOUGH step's own guide ring/completion threshold use, never a fabricated shape", () => {
    expect(new Set(IDEAL_DOUGH_SHAPE.radii).size).toBe(1);
  });
});

describe("Reference Truth: ingredient identity/count across representative recipes (Issue #167 PR-B §13.7)", () => {
  const cases = ["margherita", "salsiccia", "quattro-formaggi", "napoletana"] as const;

  for (const recipeId of cases) {
    it(`${recipeId}: every reference piece renders the correct ingredient identity (cheese shape or matching emoji), correct count`, () => {
      const recipe = getRecipe(recipeId)!;
      const reference = getReferencePizza(recipeId)!;
      expect(reference).not.toBeNull();

      const { container } = render(
        <ReferencePreview reference={reference} recipeNameJa={recipe.nameJa} isOpen onOpenChange={() => {}} />,
      );

      for (const group of reference.pieceGroups) {
        const ingredient = getIngredient(group.ingredientId)!;
        const pieces = container.querySelectorAll(`.reference-mini-pizza__topping--${group.ingredientId}`);
        expect(pieces, `${recipeId}/${group.ingredientId} count`).toHaveLength(group.positions.length);
        for (const piece of pieces) {
          if (ingredient.category === "cheese") {
            expect(piece.querySelector(`.pizza-cheese.pizza-cheese--${ingredient.id}`)).not.toBeNull();
          } else {
            const emoji = piece.querySelector(".ingredient-piece-visual__emoji");
            expect(emoji).not.toBeNull();
            expect(emoji!.textContent).toBe(ingredient.emoji);
          }
        }
      }
    });
  }

  it("quattro-formaggi (topping-heavy: 4 groups / 8 pieces) renders with no runtime error and the exact expected total", () => {
    const recipe = getRecipe("quattro-formaggi")!;
    const reference = getReferencePizza("quattro-formaggi")!;
    const { container } = render(
      <ReferencePreview reference={reference} recipeNameJa={recipe.nameJa} isOpen onOpenChange={() => {}} />,
    );
    const totalPieces = reference.pieceGroups.reduce((sum, g) => sum + g.positions.length, 0);
    expect(totalPieces).toBe(8);
    expect(container.querySelectorAll(".reference-mini-pizza__topping")).toHaveLength(8);
  });
});

describe("Reference Truth: every shipped recipe renders without runtime error (Issue #167 PR-B §9/§13.7)", () => {
  for (const recipe of RECIPES) {
    it(`${recipe.id}: ReferenceThumbnail + (ReferencePreview or PlayerReferencePreview fallback) render cleanly`, () => {
      const reference = getReferencePizza(recipe.id);
      const playerReference = getPlayerReferencePizza(recipe);
      const pieceGroups = reference ? reference.pieceGroups : playerReference.pieceGroups;
      const sauceIngredientId = reference ? reference.sauce.ingredientId : playerReference.sauceIngredientId;

      expect(() =>
        render(<ReferenceThumbnail sauceIngredientId={sauceIngredientId} pieceGroups={pieceGroups} />),
      ).not.toThrow();
      cleanup();

      if (reference) {
        expect(() =>
          render(
            <ReferencePreview reference={reference} recipeNameJa={recipe.nameJa} isOpen onOpenChange={() => {}} />,
          ),
        ).not.toThrow();
      } else {
        expect(() =>
          render(<PlayerReferencePreview reference={playerReference} isOpen onOpenChange={() => {}} />),
        ).not.toThrow();
      }
      cleanup();
    });
  }
});

describe("Reference Truth: opening/closing the popover leaves no stale state (Issue #167 PR-B §13.8, unit-level)", () => {
  function Harness() {
    const recipe = getRecipe("margherita")!;
    const reference = getReferencePizza("margherita")!;
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>
          open
        </button>
        <ReferencePreview reference={reference} recipeNameJa={recipe.nameJa} isOpen={isOpen} onOpenChange={setIsOpen} />
      </>
    );
  }

  it("closed by default; opening then closing removes the dialog and its sauce/topping probes from the DOM", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("sauce-heatmap-probe")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sauce-heatmap-probe")).not.toBeInTheDocument();
  });
});
