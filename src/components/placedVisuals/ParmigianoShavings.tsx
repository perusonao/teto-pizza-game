/**
 * Topping Visuals 2.0 PR-1 (Issue #824, Pilot 1): the parmigiano as it lies on the pizza -- a small pile of thin, curled shavings and a few
 * granules, not a block. This is a PLACED-only drawing: the tray chip, the drag preview, the inventory, the Dex / recipe-card thumbnail and
 * the Reference all keep the existing selection representation (`surface="selection"` in IngredientPieceVisual).
 *
 * Self-contained, Style Lock V2 shaped: 64x64 viewBox, 1em, aria-hidden, no `id` / gradient / `defs` / url references (any number can share a page),
 * no state props -- the bake look comes from the wrapper's existing `.pizza-cheese` melt transform + filter (PizzaStage's `cheeseStyle`), unchanged.
 * Colours: a warm pale yellow, deliberately more saturated than ricotta-salata's white shavings and nothing like the truffle's black ones.
 * PROVISIONAL art: shape and colour are Owner-HV items (iPhone Safari), not final.
 */
const EDGE = "#b8963a";
const FILL_A = "#f3dc8a";
const FILL_B = "#ead07a";
const HIGHLIGHT = "#fff6d8";

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
      <ellipse cx="32" cy="57" rx="23" ry="3.2" fill="#000" opacity=".14" />
      <g stroke={EDGE} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M8 38 C9 29 19 24 28 27 C23 30 17 34 15 42 C11 42 8 41 8 38 Z" fill={FILL_B} />
        <path d="M56 34 C55 25 45 20 36 23 C41 26 46 30 48 38 C52 38 56 37 56 34 Z" fill={FILL_B} />
        <path d="M20 30 C22 21 34 17 43 22 C37 24 31 28 29 35 C24 36 19 34 20 30 Z" fill={FILL_A} />
        <path d="M30 14 C32 9 40 8 45 12 C41 13 38 16 37 20 C33 21 29 18 30 14 Z" fill={FILL_A} />
        <path d="M14 48 C14 41 24 37 33 40 C28 43 23 46 22 52 C17 53 14 51 14 48 Z" fill={FILL_A} />
        <path d="M30 50 C32 42 43 38 52 42 C46 44 41 48 40 54 C35 55 30 54 30 50 Z" fill={FILL_B} />
        <path d="M24 42 C28 38 36 38 41 41 C37 42 32 44 29 47 C26 47 23 45 24 42 Z" fill={FILL_A} />
      </g>
      <g fill="none" stroke={HIGHLIGHT} strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 33 C15 30 20 28 25 28" />
        <path d="M52 29 C49 26 44 24 40 25" />
        <path d="M24 25 C28 22 34 21 39 23" />
        <path d="M33 12 C36 10 40 10 43 12" />
        <path d="M17 44 C20 42 25 41 30 42" />
        <path d="M34 46 C38 44 43 43 47 44" />
      </g>
      <g fill="#e2c46c">
        <circle cx="10" cy="49" r="1.4" />
        <circle cx="54" cy="47" r="1.5" />
        <circle cx="44" cy="31" r="1.2" />
        <circle cx="21" cy="19" r="1.3" />
        <circle cx="50" cy="55" r="1.3" />
        <circle cx="26" cy="55" r="1.2" />
      </g>
    </svg>
  );
}
