/**
 * Topping Visuals 2.0 (Issues #824 / #825): the drawing of the parmigiano as it lies on the pizza -- thin shaved flakes, not grains. This is a PLACED-only drawing:
 * the tray chip, the drag preview, the inventory, the Dex / recipe-card thumbnail and the Reference all keep the existing selection representation
 * (`surface="selection"` in IngredientPieceVisual).
 *
 * Rev. 3 (Owner iPhone Safari HV on ddc2413: the shavings read as narrow rice grains / seeds / small leaves and gathered in a few local lumps). Now each shaving is one of
 * three real-cheese shapes -- a broad irregular flake, a long thin ribbon with a slight curl, a small crumb -- in low-saturation ivory with a soft contact shadow,
 * a faint warm outline, a barely lighter centre and one fine grain line, so a flake reads as a thin sheet (rev. 5: the strong outline and bright core of rev. 4 made it a pebble). Where they lie is `sprinkleLayout`'s job (an even, irregular spread).
 *
 * Self-contained, Style Lock V2 shaped: 64x64 viewBox, 1em, aria-hidden, no `id` / gradient / `defs` / url references (any number can share a page), no state props --
 * the bake look comes from the wrapper's existing `.pizza-cheese` melt transform + filter (PizzaStage's `cheeseStyle`), unchanged. PROVISIONAL art: shape and colour are
 * Owner-HV items (iPhone Safari), not final.
 */
import type { RefObject } from "react";
import { LOOK_DEFAULT, type ParmigianoShaving, type SprinkleLook } from "./parmigianoShavingsData";
import { flakePath, grainPath, ribbonHighlightPath, ribbonPath, r } from "./parmigianoShavingPaths";

const OUTLINE = "#d6c9a2";
const FILL_TOP = ["#f7efd5", "#f2e7c4", "#f9f3e0"] as const;
const FILL_CORE = "#fffaec";
const GRAIN = "#d9cca5";
const SHADOW = "#5a4a22";
const HIGHLIGHT = "#fffdf4";

function shavingPath(s: ParmigianoShaving): string {
  return s.kind === "ribbon" ? ribbonPath(s.len, s.wid, s.bend, s.wobble, s.profile) : flakePath(s.len, s.wid, s.verts);
}

interface ParmigianoShavingsProps {
  /** The shavings to draw (the sprinkle layout of one piece). */
  readonly shavings: readonly ParmigianoShaving[];
  /** Translates the whole field inside the viewBox (the sprinkle pulls it inward near the rim so it stays on the pizza). */
  readonly shift?: { readonly x: number; readonly y: number };
  readonly svgRef?: RefObject<SVGSVGElement | null>;
  /** How the shavings are painted (V9 trial F2). Default = the drawing of rev. 6 / V8-1. */
  readonly look?: SprinkleLook;
}

export function ParmigianoShavings({ shavings, shift, svgRef, look = LOOK_DEFAULT }: ParmigianoShavingsProps) {
  return (
    <svg
      ref={svgRef}
      className="ingredient-glyph ingredient-glyph--parmigiano-shavings"
      data-ingredient-visual="parmigiano-shavings"
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <g transform={shift && (shift.x !== 0 || shift.y !== 0) ? `translate(${r(shift.x)} ${r(shift.y)})` : undefined}>
        {shavings.map((s, index) => {
          const d = shavingPath(s);
          const stroke = 0.14 + 0.16 * s.edge;
          return (
            <g key={index} data-shaving={s.kind} transform={`translate(${s.cx} ${s.cy}) rotate(${s.angle})`}>
              <path d={d} transform="translate(0.5 0.9)" fill={SHADOW} opacity={r((0.05 + 0.07 * s.edge) * look.shadowScale)} />
              <path d={d} fill={FILL_TOP[s.fill]} fillOpacity={look.fillOpacity} stroke={OUTLINE} strokeOpacity={r((0.22 + 0.3 * s.edge) * look.outlineScale)} strokeWidth={stroke} strokeLinejoin="round" />
              {s.kind === "flake" && look.core && <path d={d} transform={`translate(${r(-0.04 * s.len)} ${r(-0.03 * s.wid)}) scale(${s.core})`} fill={FILL_CORE} opacity=".16" />}
              {s.kind === "flake" && look.grain && <path d={grainPath(s.len, s.wid, s.core)} fill="none" stroke={GRAIN} strokeOpacity=".4" strokeWidth=".2" strokeLinecap="round" />}
              {s.kind === "ribbon" && (
                <path d={ribbonHighlightPath(s.len, s.wid, s.bend, s.wobble, s.profile)} fill="none" stroke={HIGHLIGHT} strokeOpacity=".7" strokeWidth=".55" strokeLinecap="round" />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
