import type { SquareGapGuide } from "../../logic/pan/squareDoughGaps";
import { SQUARE_DOUGH_GRID } from "../../logic/pan/squareDough";
import "./squareGapGuide.css";

const CELL = 100 / SQUARE_DOUGH_GRID;

/**
 * Square Dough UX (#536, AB-min): "the sheet is still bare here" for the square DOUGH step -- the bare cells tinted and one dashed arrow from the
 * dough into each of the largest gaps. Drawn in the layer's 0..100 overlay (no layout box, nothing below the pan changes). The SAUCE step's
 * `SquareTargetGuide` is a different thing (the sauce Reference region) and is deliberately not reused.
 */
export function SquareGapGuideMarks({ guide }: { guide: SquareGapGuide }) {
  return (
    <g className="square-gap-guide" data-testid="square-gap-guide" data-gaps={guide.gaps.length} data-bare={guide.bareCells.length}>
      <g className="square-gap-guide__tint" data-testid="square-gap-tint">
        {guide.bareCells.map((index) => (
          <rect key={index} x={(index % SQUARE_DOUGH_GRID) * CELL} y={Math.floor(index / SQUARE_DOUGH_GRID) * CELL} width={CELL} height={CELL} />
        ))}
      </g>
      <g data-testid="square-gap-arrows">
        {guide.gaps.map((gap, i) => {
          const angle = Math.atan2(gap.aim.y - gap.from.y, gap.aim.x - gap.from.x);
          const tipX = gap.aim.x - Math.cos(angle) * 2;
          const tipY = gap.aim.y - Math.sin(angle) * 2;
          return (
            <g key={i} data-gap={i}>
              <circle className="square-gap-guide__start" cx={gap.from.x} cy={gap.from.y} r={2.2} />
              <line className="square-gap-guide__line" x1={gap.from.x} y1={gap.from.y} x2={tipX} y2={tipY} />
              <polygon
                className="square-gap-guide__head"
                points={`${tipX + Math.cos(angle) * 3},${tipY + Math.sin(angle) * 3} ${tipX + Math.cos(angle + 2.5) * 2.6},${tipY + Math.sin(angle + 2.5) * 2.6} ${tipX + Math.cos(angle - 2.5) * 2.6},${tipY + Math.sin(angle - 2.5) * 2.6}`}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
}
