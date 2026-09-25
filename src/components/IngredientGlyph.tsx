import type { DedicatedIngredientVisual, Ingredient } from "../data/ingredients";

/**
 * Production Visual P1: the single entry point for drawing an ingredient's glyph -- every place
 * that used to print `ingredient.emoji` directly (piece, tray chip, drag preview, RESULT list,
 * Pizza Select thumbnail, Inventory, Shop, Dex) renders this instead, so a dedicated visual can
 * never appear in one context and not another.
 *
 * - No `pieceVisual` (every current ingredient): renders the emoji as a bare text node -- the exact
 *   same DOM as the old `{ingredient.emoji}`, so nothing changes visually or semantically.
 * - `pieceVisual` set: renders that dedicated inline SVG, sized 1em so the caller's own font-size
 *   (28px piece, 26px chip, thumbnail scale...) and bake `filter` apply exactly as they do to an
 *   emoji. Decorative (`aria-hidden`); every call site already shows the ingredient's `nameJa` or is
 *   itself decorative, as it was for the emoji.
 *
 * Only the ingredient's declared visual is read -- never its id -- so identity (discovery, save,
 * inventory) stays independent of how it is drawn. The drawings are the Human-approved W1 Visual
 * Gate candidates (docs/reports/TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION_SYNC.md), ported as-is:
 * no `id`/gradient attributes, so any number of them can share a page.
 */
export function IngredientGlyph({ ingredient }: { ingredient: Ingredient }) {
  if (!ingredient.pieceVisual) return <>{ingredient.emoji}</>;
  return <DedicatedIngredientSvg visual={ingredient.pieceVisual} />;
}

function DedicatedIngredientSvg({ visual }: { visual: DedicatedIngredientVisual }) {
  return (
    <svg
      className={`ingredient-glyph ingredient-glyph--${visual}`}
      data-ingredient-visual={visual}
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {visual === "tomato-slice" && <TomatoSlice />}
      {visual === "caper-cluster" && <CaperCluster />}
      {visual === "clam-valve" && <ClamValve />}
    </svg>
  );
}

/* ---------- fresh-tomato: irregular cross-section slice (Visual Gate candidate B) ---------- */

const C = 16;
const LOCULES = 6;

function polar(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)];
}

function fmt([x, y]: [number, number]): string {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

/** Closed path through `radius(deg)` sampled every 4 degrees. */
function radialPath(radius: (deg: number) => number): string {
  const points: string[] = [];
  for (let deg = 0; deg < 360; deg += 4) points.push(fmt(polar(radius(deg), deg - 90)));
  return `M${points.join(" L")} Z`;
}

/** Softly lobed, slightly lopsided outline: a real slice is never a perfect circle (a round,
 *  evenly spotted disc read as salami / pepperoni on iPhone -- the rejected candidate A). */
function outline(base: number): (deg: number) => number {
  const rad = Math.PI / 180;
  return (deg) =>
    base +
    0.32 * Math.cos((deg + 8) * LOCULES * rad) +
    0.45 * Math.cos((deg - 40) * rad) +
    0.22 * Math.cos((deg * 3 + 20) * rad);
}

const TOMATO_OUTER = radialPath(outline(15.1));
const TOMATO_FLESH = radialPath(outline(13.3));
const TOMATO_CORE = radialPath((deg) => 3.4 + 1.1 * Math.cos(((deg + 8 - 30) * LOCULES * Math.PI) / 180));
const TOMATO_CHAMBERS = Array.from({ length: LOCULES }, (_, i) => i * (360 / LOCULES) + 8);

/** One jelly chamber: a rounded wedge between two radial walls, from the core to the outer wall. */
function loculePath(centerDeg: number): string {
  const half = 20;
  const inner = 4.4;
  const outer = 11.2;
  const a = polar(inner, centerDeg - half * 0.55 - 90);
  const b = polar(outer, centerDeg - half - 90);
  const tip = polar(outer + 1.4, centerDeg - 90);
  const c = polar(outer, centerDeg + half - 90);
  const d = polar(inner, centerDeg + half * 0.55 - 90);
  const coreCtl = polar(inner - 0.8, centerDeg - 90);
  return `M${fmt(a)} L${fmt(b)} Q${fmt(tip)} ${fmt(c)} L${fmt(d)} Q${fmt(coreCtl)} ${fmt(a)} Z`;
}

/** Teardrop seed at `r`/`deg`, pointing at the core. */
function seedPath(r: number, deg: number): string {
  const [x, y] = polar(r, deg - 90);
  const [px, py] = polar(r - 2.1, deg - 90);
  const nx = (y - C) / r;
  const ny = -(x - C) / r;
  const w = 0.95;
  return `M${fmt([px, py])} Q${fmt([x + nx * w * 1.6, y + ny * w * 1.6])} ${fmt([x + (x - px) * 0.25, y + (y - py) * 0.25])} Q${fmt([x - nx * w * 1.6, y - ny * w * 1.6])} ${fmt([px, py])} Z`;
}

function TomatoSlice() {
  return (
    <g>
      <path d={TOMATO_OUTER} fill="#d8261b" stroke="#861810" strokeWidth="0.9" strokeLinejoin="round" />
      <path d={TOMATO_FLESH} fill="#f0543a" />
      {TOMATO_CHAMBERS.map((deg) => (
        <g key={deg}>
          <path d={loculePath(deg)} fill="#f6c24a" stroke="#f79a78" strokeWidth="0.8" strokeLinejoin="round" />
          <path d={seedPath(8.3, deg - 7)} fill="#fff4c4" stroke="#b07f1a" strokeWidth="0.35" />
          <path d={seedPath(8.3, deg + 7)} fill="#fff4c4" stroke="#b07f1a" strokeWidth="0.35" />
          <path d={seedPath(10.6, deg)} fill="#fff4c4" stroke="#b07f1a" strokeWidth="0.35" />
        </g>
      ))}
      <path d={TOMATO_CORE} fill="#ffc9b1" />
      <path d="M6.2 10.2 A11.8 11.8 0 0 1 11.2 5.6" stroke="#ffe3d6" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.85" />
    </g>
  );
}

/* ---------- capers: irregular cluster of 3 pointed buds ---------- */

const CAPER_BUDS = [
  { cx: 10.8, cy: 19.5, rx: 6.1, ry: 6.8, rot: -24 },
  { cx: 21.4, cy: 21.2, rx: 5.2, ry: 5.8, rot: 28 },
  { cx: 17.2, cy: 10.2, rx: 4.6, ry: 5.2, rot: 8 },
];

function CaperCluster() {
  return (
    <g>
      {CAPER_BUDS.map((bud, index) => (
        <g key={index} transform={`rotate(${bud.rot} ${bud.cx} ${bud.cy})`}>
          <path
            d={`M${bud.cx} ${bud.cy - bud.ry - 1.4}
                C ${bud.cx + bud.rx * 0.55} ${bud.cy - bud.ry}, ${bud.cx + bud.rx} ${bud.cy - bud.ry * 0.35}, ${bud.cx + bud.rx} ${bud.cy + bud.ry * 0.1}
                C ${bud.cx + bud.rx} ${bud.cy + bud.ry * 0.75}, ${bud.cx + bud.rx * 0.5} ${bud.cy + bud.ry}, ${bud.cx} ${bud.cy + bud.ry}
                C ${bud.cx - bud.rx * 0.5} ${bud.cy + bud.ry}, ${bud.cx - bud.rx} ${bud.cy + bud.ry * 0.75}, ${bud.cx - bud.rx} ${bud.cy + bud.ry * 0.1}
                C ${bud.cx - bud.rx} ${bud.cy - bud.ry * 0.35}, ${bud.cx - bud.rx * 0.55} ${bud.cy - bud.ry}, ${bud.cx} ${bud.cy - bud.ry - 1.4} Z`}
            fill="#7f9139"
            stroke="#34401a"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d={`M${bud.cx - bud.rx * 0.55} ${bud.cy + bud.ry * 0.05} Q ${bud.cx} ${bud.cy - bud.ry * 0.55} ${bud.cx + bud.rx * 0.55} ${bud.cy + bud.ry * 0.05}`}
            stroke="#4b5a21"
            strokeWidth="0.9"
            fill="none"
          />
          <ellipse cx={bud.cx - bud.rx * 0.35} cy={bud.cy - bud.ry * 0.35} rx={bud.rx * 0.28} ry={bud.ry * 0.2} fill="#c8d58a" />
        </g>
      ))}
    </g>
  );
}

/* ---------- clam: one closed asari valve seen from above (Visual Gate candidate B) ---------- */

function ClamValve() {
  return (
    <g>
      <path
        d="M16 4.6 C 10.5 5.2, 3.4 11.4, 2.8 19.6 C 2.5 25, 8.6 28.4, 16 28.4 C 23.4 28.4, 29.5 25, 29.2 19.6 C 28.6 11.4, 21.5 5.2, 16 4.6 Z"
        fill="#d8c6a2"
        stroke="#3f2f1e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M4.6 21.2 C 7.5 26.4, 24.5 26.4, 27.4 21.2 L 27.9 23.6 C 24.5 28, 7.5 28, 4.1 23.6 Z" fill="#7a5c3e" />
      <path d="M6.2 15.4 C 9.5 19.8, 22.5 19.8, 25.8 15.4" stroke="#8d6d4b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M9.6 10.6 C 12 13.3, 20 13.3, 22.4 10.6" stroke="#8d6d4b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M8.5 18.6 l1.6 -1.9 l1.6 1.9 l1.6 -1.9 M18.8 18.6 l1.6 -1.9 l1.6 1.9 l1.6 -1.9" stroke="#4d3924" strokeWidth="0.9" fill="none" strokeLinejoin="round" />
      <path d="M12.6 5.9 C 14 3.6, 18 3.6, 19.4 5.9 C 18 7.2, 14 7.2, 12.6 5.9 Z" fill="#6e5236" stroke="#3f2f1e" strokeWidth="0.8" />
    </g>
  );
}
