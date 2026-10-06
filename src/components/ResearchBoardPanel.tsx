import { getIngredient } from "../data/ingredients";
import type { ResearchBoard, ResearchBoardMark } from "../logic/discovery/researchBoard";
import { IngredientGlyph } from "./IngredientGlyph";
import { BOARD_COPY } from "./researchBoardCopy";

/**
 * Research Board (Phase 2 / S4): renders the S1 read model of the current Research Target, and nothing else.
 *
 * It adds no inference: no candidate or trial count, no recipe name / id / No. / hash, no Technique, no ingredient
 * guessed from what the player has not bought. Every fact shown is one the player was already told and that was
 * stored (unlock ingredient, bought names, the disclosed-NEGATIVE ledger, bought classes / total). The caption says so,
 * so the Board is not mistaken for the session-only attempt log under it. Pure view: dispatches and stores nothing.
 */

function rowsOf(board: ResearchBoard, mark: ResearchBoardMark): string[] {
  return board.groups.flatMap((g) => g.rows.filter((r) => r.mark === mark).map((r) => r.ingredientId));
}

function Chips({ ids }: { ids: readonly string[] }) {
  return (
    <span className="hint-sheet__chips">
      {ids.map((id) => {
        const ingredient = getIngredient(id);
        return (
          <span key={id} className="hint-sheet__chip">
            {ingredient && (
              <span className="hint-sheet__glyph" aria-hidden="true">
                <IngredientGlyph ingredient={ingredient} />
              </span>
            )}
            {ingredient?.nameJa ?? id}
          </span>
        );
      })}
    </span>
  );
}

export function ResearchBoardPanel({ board }: { board: ResearchBoard }) {
  const known = rowsOf(board, "KNOWN");
  const excluded = rowsOf(board, "EXCLUDED");
  const hasUnsure = board.classes.length > 0 || board.totalIngredientCount !== null;
  if (known.length === 0 && excluded.length === 0 && !hasUnsure) return null;
  return (
    <div className="research-board" data-research-board="">
      <p className="research-board__title">{BOARD_COPY.title}</p>
      <p className="research-board__note">{BOARD_COPY.note}</p>
      {known.length > 0 && (
        <div className="hint-sheet__row" data-research-board-known="">
          <span className="hint-sheet__row-label">{BOARD_COPY.known}</span>
          <Chips ids={known} />
        </div>
      )}
      {excluded.length > 0 && (
        <div className="hint-sheet__row" data-research-board-excluded="">
          <span className="hint-sheet__row-label">{BOARD_COPY.excluded}</span>
          <Chips ids={excluded} />
        </div>
      )}
      {hasUnsure && (
        <div className="hint-sheet__row" data-research-board-unsure="">
          <span className="hint-sheet__row-label">{BOARD_COPY.unsure}</span>
          <span className="hint-sheet__chips">
            {board.classes.map((c, i) => (
              <span key={`${c.familyId}-${i}`} className="hint-sheet__chip">
                {c.symbol} {c.labelJa}
              </span>
            ))}
            {board.totalIngredientCount !== null && (
              <span className="hint-sheet__chip">{BOARD_COPY.total(board.totalIngredientCount)}</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
