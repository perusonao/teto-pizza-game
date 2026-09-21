import { getIngredient } from "../data/ingredients";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { createIdealDoughShape } from "../logic/doughShape";
import { SauceHeatmapCanvas } from "./SauceHeatmapCanvas";
import { renderPizzaVisualPieces, type PizzaVisualPieceGroup } from "./PizzaVisualPieces";

interface ReferenceThumbnailProps {
  sauceIngredientId: string | null;
  pieceGroups: readonly PizzaVisualPieceGroup[];
}

const IDEAL_DOUGH_SHAPE = createIdealDoughShape();
const IDEAL_SAUCE_FIXTURE = buildIdealSauceFixture();

/**
 * Issue #159 P0 (Cooking UI 1-Screen Polish, bullet 5): GameScreen's own small always-visible
 * "見本" thumbnail used to be `<PizzaThumbnail recipe={...} />`, which independently recomputes
 * a *different*, abbreviated piece list straight from `recipe.requiredIngredients` (one dot per
 * required ingredient *type*, ignoring `minCount` -- see PizzaThumbnail.tsx, still correct and
 * unchanged for its own Pizza Select card use) -- while the popover the same thumbnail opens
 * (`ReferencePreview`/`PlayerReferencePreview`) renders the recipe's *real* per-unit piece
 * layout (`referencePizza.pieceGroups`/`getPlayerReferencePizza(recipe).pieceGroups`, one dot
 * per physical piece, `minCount`-expanded). A real-device Fresh Audit (2026-09-21) confirmed
 * this as a real "見本表示が入口によって変わる" bug: the small icon and its own popover could
 * show a different piece count for the same recipe.
 *
 * This component takes the exact same `pieceGroups`/sauce data GameScreen already resolves for
 * the popover (`referencePizza ?? getPlayerReferencePizza(state.recipe)`) and renders it at icon
 * size, so the mini thumbnail and the popover it opens are always built from one shared value --
 * not just "structurally similar" data, but literally the same object read twice.
 *
 * Issue #167 PR-B (Reference Truth): the sauce swatch used to be a flat, uncoverage-aware
 * background rect (`.reference-thumbnail__base`) -- it now renders the same deterministic
 * `buildIdealSauceFixture()` painted-coverage heatmap the full Reference popover (below) and
 * PizzaStage's own live gesture heatmap share (`SauceHeatmapCanvas`), so the "何を目指して塗れば
 * いいのか" the sauce coverage should communicate is consistent from the very first glance a
 * player gets, not only once they open the modal. Pieces render via the same
 * `renderPizzaVisualPieces` helper the modal popovers use, not a locally hand-rolled emoji/cheese
 * ternary (the emoji branch used to bypass `IngredientPieceVisual` entirely here).
 */
export function ReferenceThumbnail({ sauceIngredientId, pieceGroups }: ReferenceThumbnailProps) {
  const sauceIngredient = sauceIngredientId ? getIngredient(sauceIngredientId) : null;

  return (
    <div className="reference-thumbnail" aria-hidden="true">
      {sauceIngredient && (
        <SauceHeatmapCanvas
          deposits={IDEAL_SAUCE_FIXTURE}
          doughShape={IDEAL_DOUGH_SHAPE}
          color={sauceIngredient.color}
          className={`reference-thumbnail__base ${sauceIngredient.id === "olive-oil" ? "pizza-sauce-heatmap--oil" : ""}`}
        />
      )}
      {renderPizzaVisualPieces({
        pieceGroups,
        wrapperClassName: () => "reference-thumbnail__piece",
      })}
    </div>
  );
}
