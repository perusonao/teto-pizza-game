import { squareTargetGuideRect } from "./squarePanStage";
import "./squarePanStage.css";

/**
 * Square-Pan Dough D2-a1: the SAUCE step's "paint up to here" guide for the square pan -- a dashed rounded square at the square Reference
 * region (`SQUARE_PAN_GEOMETRY.targetArea`), the counterpart of the round `<circle r=SAUCE_TARGET_RADIUS>` ring. Inert until D2-a2 mounts it.
 */
export function SquareTargetGuide({ className }: { className?: string }) {
  const rect = squareTargetGuideRect();
  return (
    <svg className={["square-target-guide", className].filter(Boolean).join(" ")} viewBox="0 0 100 100" aria-hidden="true">
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={1.5} />
    </svg>
  );
}
