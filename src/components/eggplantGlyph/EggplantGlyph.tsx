/**
 * Issue #417 (Ingredient Icons 2.0): dedicated eggplant (ナス) glyph, candidate A = two round slices (purple skin ring + cream flesh),
 * Style Lock V2 §12. UNWIRED: nothing imports this file; `ingredients.ts`, `IngredientGlyph.tsx`, `App.css`, golden files and the
 * herb / prep glyphs are untouched. A later wiring PR (separate claim, Owner approval) decides `pieceVisual` (`eggplant-slices` proposed).
 *
 * One drawing, one silhouette, every state. The look is switched by:
 * - the `state` prop, which sets `data-eggplant-state` and the fallback colours; or
 * - CSS custom properties on any ancestor (or the svg): `--eg-skin --eg-line --eg-flesh --eg-rim --eg-core --eg-seed --eg-crust --eg-sheen`
 *   (same names as the design candidate's `eggplant-a-states.css`). Each part reads `var(--eg-*, <state colour>)`, so a wiring PR can drive
 *   it from bake heat / fry position without a new component. The Fry state values are PROVISIONAL (Fry F2+ is on HOLD, Issue #749).
 * `outline="strong"` is a comparison option (thicker, darker outline for melted-cheese backgrounds): see the Result Report; adoption is the Owner's.
 *
 * 1em, 64x64 viewBox, `aria-hidden`, no ids / gradients / url() so any number can share a page. Colours and shape are PROVISIONAL.
 */

import { EGGPLANT_PALETTE, type EggplantState } from "./eggplantPalette";

export type EggplantOutline = "normal" | "strong";

/** Two slices: [cx, cy, skin r, flesh r, core rx, core ry, seed scale], taken from references/ingredient-icons-2.0/eggplant.svg. */
const SLICES = [
  { cx: 23, cy: 22, rs: 17.5, rf: 13.1, rc: [6.3, 5.6], seeds: [[19.7, 19.8, 1.09], [25.2, 18.5, 1.09], [27.4, 23.1, 1.09], [21.9, 25.3, 1.09], [18.4, 24.6, 0.98], [24.1, 22, 0.98], [26.3, 26.4, 0.88]], shine: "M9.0 15.5A15.4 15.4 0 0 1 20.9 6.7", sheen: [18.1, 16.8, 4.5, 2.5] },
  { cx: 40, cy: 38.5, rs: 20, rf: 15.6, rc: [7.2, 6.4], seeds: [[36.3, 36, 1.25], [42.5, 34.5, 1.25], [45, 39.8, 1.25], [38.8, 42.3, 1.25], [34.8, 41.5, 1.13], [41.3, 38.5, 1.13], [43.8, 43.5, 1], ], shine: "M23.8 30.9A17.9 17.9 0 0 1 37.5 20.8", sheen: [34.4, 32.5, 5.2, 2.8] },
] as const;

export function EggplantGlyph({ state = "raw", outline = "normal" }: { state?: EggplantState; outline?: EggplantOutline }) {
  const p = EGGPLANT_PALETTE[state];
  const strong = outline === "strong";
  const line = strong ? p.lineStrong : p.line;
  const lineW = strong ? 3.4 : 2.4;
  return (
    <svg
      className="ingredient-glyph ingredient-glyph--eggplant-slices"
      data-ingredient-visual="eggplant-slices"
      data-eggplant-state={state}
      data-eggplant-outline={outline}
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="32" cy="58" rx="24" ry="3.1" fill="#000" opacity=".15" />
      {SLICES.map((s) => (
        <g key={s.cx}>
          <circle data-part="skin" cx={s.cx} cy={s.cy} r={s.rs} style={{ fill: `var(--eg-skin, ${p.skin})`, stroke: `var(--eg-line, ${line})` }} strokeWidth={lineW} />
          <path d={s.shine} fill="none" stroke="#d6c2e8" strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
          <circle data-part="flesh" cx={s.cx} cy={s.cy} r={s.rf} style={{ fill: `var(--eg-flesh, ${p.flesh})`, stroke: `var(--eg-rim, ${p.rim})` }} strokeWidth="1.3" />
          <circle data-part="crust" cx={s.cx} cy={s.cy} r={s.rf - 1} fill="none" style={{ stroke: `var(--eg-rim, ${p.rim})`, opacity: `var(--eg-crust, ${p.crust})` }} strokeWidth="2.4" />
          <ellipse data-part="core" cx={s.cx} cy={s.cy} rx={s.rc[0]} ry={s.rc[1]} style={{ fill: `var(--eg-core, ${p.core})` }} />
          {s.seeds.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} data-part="seed" cx={x} cy={y} r={r} style={{ fill: `var(--eg-seed, ${p.seed})` }} />
          ))}
          <ellipse
            data-part="sheen"
            cx={s.sheen[0]}
            cy={s.sheen[1]}
            rx={s.sheen[2]}
            ry={s.sheen[3]}
            transform={`rotate(-35 ${s.sheen[0]} ${s.sheen[1]})`}
            fill="#fff6d8"
            style={{ opacity: `var(--eg-sheen, ${p.sheen})` }}
          />
        </g>
      ))}
    </svg>
  );
}
