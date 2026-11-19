/**
 * Topping Visuals 2.0 PR-1 (Issue #824, Pilot 1): the parmigiano as it lies on the pizza -- a few thin, flat, irregular shavings of pale ivory / cream cheese
 * scattered with gaps between them, not a block and not a knot. This is a PLACED-only drawing: the tray chip, the drag preview, the inventory, the Dex /
 * recipe-card thumbnail and the Reference all keep the existing selection representation (`surface="selection"` in IngredientPieceVisual).
 *
 * Revision 2 (Owner iPhone Safari HV on HEAD d218864: the first art -- seven overlapping curls in a vivid yellow -- read as a yellow knot / lump and not as thinly
 * shaved cheese, before and after baking). Now: six separate shavings that never overlap, long and thin (thickness at most a third of the length), of different sizes
 * and directions, in low-saturation ivory-to-cream fills with a thin warm-grey outline, a darker underside strip for thickness and a pale highlight along the top edge.
 *
 * Self-contained, Style Lock V2 shaped: 64x64 viewBox, 1em, aria-hidden, no `id` / gradient / `defs` / url references (any number can share a page), no state props --
 * the bake look comes from the wrapper's existing `.pizza-cheese` melt transform + filter (PizzaStage's `cheeseStyle`), unchanged. The geometry is computed once at module
 * load (deterministic, no randomness). PROVISIONAL art: shape and colour are Owner-HV items (iPhone Safari), not final.
 */
import { PARMIGIANO_SHAVINGS } from "./parmigianoShavingsData";

const OUTLINE = "#c9b88a";
const FILL_TOP = ["#f8f0d8", "#f3e8c6", "#f6ecd0"] as const;
const FILL_UNDER = "#dccb9b";
const HIGHLIGHT = "#fffbee";
const CHIP = "#e6d6a8";

/** Tiny chips (not round dots): [cx, cy, size, angle]. */
const CHIPS: readonly (readonly [number, number, number, number])[] = [
  [56, 30, 2.6, 25],
  [8, 33, 2.2, -15],
  [52, 52, 2.4, 50],
];

const r = (n: number): string => (Math.round(n * 100) / 100).toString();

/** A thin leaf-like flake along the x axis: pointed ends, a slightly lopsided top edge and a straighter cut underside. */
function flakePath(len: number, half: number, skew: number): string {
  const l = len / 2;
  const tipL = skew * half * 0.5;
  const tipR = -skew * half * 0.4;
  const top = `C ${r(-l * 0.5)} ${r(-half * (1.05 + 0.25 * skew))} ${r(l * 0.2)} ${r(-half * (1.1 - 0.3 * skew))} ${r(l)} ${r(tipR)}`;
  const bottom = `C ${r(l * 0.45)} ${r(half * 0.75)} ${r(-l * 0.3)} ${r(half * (0.95 + 0.2 * skew))} ${r(-l)} ${r(tipL)}`;
  return `M ${r(-l)} ${r(tipL)} ${top} ${bottom} Z`;
}

/** The pale highlight along the top edge. */
function highlightPath(len: number, half: number): string {
  const l = len / 2;
  return `M ${r(-l * 0.55)} ${r(-half * 0.45)} C ${r(-l * 0.25)} ${r(-half * 0.8)} ${r(l * 0.1)} ${r(-half * 0.8)} ${r(l * 0.4)} ${r(-half * 0.4)}`;
}

function chipPath(size: number): string {
  const s = size / 2;
  return `M ${r(-s)} ${r(-s * 0.3)} L ${r(s * 0.2)} ${r(-s * 0.8)} L ${r(s)} ${r(s * 0.2)} L ${r(-s * 0.4)} ${r(s * 0.7)} Z`;
}

export function ParmigianoShavings() {
  return (
    <svg
      className="ingredient-glyph ingredient-glyph--parmigiano-shavings"
      data-ingredient-visual="parmigiano-shavings"
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="32" cy="57" rx="22" ry="2.6" fill="#000" opacity=".1" />
      {PARMIGIANO_SHAVINGS.map((s, index) => {
        const d = flakePath(s.len, s.half, s.skew);
        return (
          <g key={index} data-shaving="" transform={`translate(${s.cx} ${s.cy}) rotate(${s.angle})`}>
            <path d={d} transform={`translate(0 ${r(s.half * 0.42)})`} fill={FILL_UNDER} />
            <path d={d} fill={FILL_TOP[s.fill]} stroke={OUTLINE} strokeWidth="1.1" strokeLinejoin="round" />
            <path d={highlightPath(s.len, s.half)} fill="none" stroke={HIGHLIGHT} strokeWidth="1.1" strokeLinecap="round" />
          </g>
        );
      })}
      {CHIPS.map(([cx, cy, size, angle], index) => (
        <path key={index} data-chip="" d={chipPath(size)} transform={`translate(${cx} ${cy}) rotate(${angle})`} fill={CHIP} stroke={OUTLINE} strokeWidth="0.6" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
