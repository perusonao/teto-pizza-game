import { SQUARE_DOUGH_GRID, type SquareDough } from "../../logic/pan/squareDough";
import { STRETCH_MARK, stretchThinHints, type StretchDetail } from "../../logic/pan/squareStretch";
import "./squareStretchMarks.css";

const CELL = 100 / SQUARE_DOUGH_GRID;

/**
 * Push-stretch prototype (Preview / DEV, `?squareModel=stretch`), STEP 2: which cells still need work. Red = too thick (press it),
 * blue = too thin (stretch dough in from a thick neighbour, with up to two dashed arrows), nothing = fine. Derived from the dough on
 * screen (never stored), drawn in the layer's 0..100 overlay, so it takes no layout space.
 */
export function SquareStretchMarks({ dough, detail }: { dough: SquareDough; detail: StretchDetail }) {
  const hints = stretchThinHints(dough, detail);
  const cells: { index: number; kind: "thin" | "thick" }[] = [];
  detail.classes.forEach((kind, index) => {
    if (kind === "thin" || kind === "thick") cells.push({ index, kind });
  });
  return (
    <g className="square-stretch-marks" data-testid="square-stretch-marks" data-model={STRETCH_MARK} data-thin={detail.thin} data-thick={detail.thick} data-ok={detail.ok}>
      <g data-testid="square-stretch-tint">
        {cells.map(({ index, kind }) => (
          <rect
            key={index}
            className={`square-stretch-marks__cell square-stretch-marks__cell--${kind}`}
            data-cell={index}
            data-kind={kind}
            x={(index % SQUARE_DOUGH_GRID) * CELL}
            y={Math.floor(index / SQUARE_DOUGH_GRID) * CELL}
            width={CELL}
            height={CELL}
          />
        ))}
      </g>
      <g data-testid="square-stretch-arrows">
        {hints.map((hint, i) => {
          const angle = Math.atan2(hint.to.y - hint.from.y, hint.to.x - hint.from.x);
          const tipX = hint.to.x - Math.cos(angle) * 2;
          const tipY = hint.to.y - Math.sin(angle) * 2;
          return (
            <g key={i} data-hint={i}>
              <circle className="square-stretch-marks__start" cx={hint.from.x} cy={hint.from.y} r={2.2} />
              <line className="square-stretch-marks__line" x1={hint.from.x} y1={hint.from.y} x2={tipX} y2={tipY} />
              <polygon
                className="square-stretch-marks__head"
                points={`${tipX + Math.cos(angle) * 3},${tipY + Math.sin(angle) * 3} ${tipX + Math.cos(angle + 2.5) * 2.6},${tipY + Math.sin(angle + 2.5) * 2.6} ${tipX + Math.cos(angle - 2.5) * 2.6},${tipY + Math.sin(angle - 2.5) * 2.6}`}
              />
            </g>
          );
        })}
      </g>
    </g>
  );
}
