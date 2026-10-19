import type { ReactNode } from "react";
import "./squarePanStage.css";

/**
 * Square-Pan Dough D2-a1: the base of a square-pan thumbnail (Recipe Select / Dex / RESULT / Reference) -- the pan frame with the sauce-coloured
 * base inside it. The square counterpart of `PizzaThumbnail`'s outer `.pizza-thumbnail` + `__base`; pieces are passed as `children` and are
 * positioned in percent of the frame, like the round thumbnail's. Inert until D2-b chooses it for a square recipe.
 */
export function SquareThumbnailBase({ color = "#f0d9a0", children }: { color?: string; children?: ReactNode }) {
  return (
    <div className="square-thumbnail" aria-hidden="true">
      <div className="square-thumbnail__base" style={{ backgroundColor: color }} />
      {children}
    </div>
  );
}
