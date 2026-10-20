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

/** Style Lock v2 §4.2: the original 3 visuals keep their 32x32 art; Ingredient Icons 2.0 art is 64x64.
 *  Both render at 1em, so callers' font-size applies unchanged. */
const VISUAL_VIEWBOX: Record<DedicatedIngredientVisual, string> = {
  "tomato-slice": "0 0 32 32",
  "caper-cluster": "0 0 32 32",
  "clam-valve": "0 0 32 32",
  "ricotta-mound": "0 0 64 64",
  "feta-cubes": "0 0 64 64",
  "sausage-slices": "0 0 64 64",
  "hot-dog-slices": "0 0 64 64",
  "shiso-leaf": "0 0 64 64",
  "whitebait-school": "0 0 64 64",
  "salmon-roe-grains": "0 0 64 64",
};

function DedicatedIngredientSvg({ visual }: { visual: DedicatedIngredientVisual }) {
  return (
    <svg
      className={`ingredient-glyph ingredient-glyph--${visual}`}
      data-ingredient-visual={visual}
      viewBox={VISUAL_VIEWBOX[visual]}
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {visual === "tomato-slice" && <TomatoSlice />}
      {visual === "caper-cluster" && <CaperCluster />}
      {visual === "clam-valve" && <ClamValve />}
      {visual === "ricotta-mound" && <RicottaMound />}
      {visual === "feta-cubes" && <FetaCubes />}
      {visual === "sausage-slices" && <SausageSlices />}
      {visual === "hot-dog-slices" && <HotDogSlices />}
      {visual === "shiso-leaf" && <ShisoLeaf />}
      {visual === "whitebait-school" && <WhitebaitSchool />}
      {visual === "salmon-roe-grains" && <SalmonRoeGrains />}
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

/* ---------- Ingredient Icons 2.0 (Style Lock v2, Pilot A): 64x64 art from docs/design/references/ingredient-icons-2.0 ---------- */

function RicottaMound() {
  return (
    <g>
      <ellipse cx="32" cy="54" rx="20" ry="3" fill="#000" opacity=".13" />
      <path d="M12 48h40c0 4-4 6-8 6H20c-4 0-8-2-8-6z" fill="#e4dac0" stroke="#a09068" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 47c-2-11 3-17 10-17 1-8 7-13 15-13s14 5 15 13c7 0 12 6 10 17z" fill="#fff6dc" stroke="#7d6a42" strokeWidth="2.4" strokeLinejoin="round" />
      <g fill="#e8d7a8">
        <circle cx="17" cy="41" r="2" />
        <circle cx="27" cy="36" r="2.3" />
        <circle cx="38" cy="39" r="2.1" />
        <circle cx="47" cy="42" r="1.9" />
        <circle cx="33" cy="27" r="1.9" />
        <circle cx="22" cy="29" r="1.6" />
        <circle cx="43" cy="31" r="1.7" />
        <circle cx="32" cy="45" r="1.6" />
      </g>
      <path d="M19 28c3-5 8-7 12-7" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}

function FetaCubes() {
  return (
    <g>
      <ellipse cx="32" cy="56" rx="24" ry="3.5" fill="#000" opacity=".15" />
      <path d="M6 34l14-8 20 4v18l-14 6L6 48z" fill="#fff" stroke="#78808a" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M6 34l20 6 14-10M26 40v14" stroke="#78808a" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
      <path d="M32 18l12-6 16 8v16l-12 5V30z" fill="#f4f6f8" stroke="#78808a" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M32 18l16 8 12-6M48 26v19" stroke="#78808a" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
      <g fill="#cfd5dc">
        <circle cx="14" cy="42" r="1.8" />
        <circle cx="33" cy="46" r="1.8" />
        <circle cx="54" cy="31" r="1.7" />
        <circle cx="40" cy="25" r="1.6" />
      </g>
    </g>
  );
}

function SausageSlices() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="24" ry="3.3" fill="#000" opacity=".15" />
      <path d="M5 37c-1-7 3-14 11-16 6-2 13 0 16 6 3 6 2 14-4 18-5 4-14 4-19 0-2-2-3-5-4-8z" fill="#8f3f2e" stroke="#431a12" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M10 37c-1-5 2-9 7-10 5-1 9 1 11 5 2 5 0 10-4 12-4 2-10 2-13-1-1-2-1-4-1-6z" fill="#b95e47" />
      <path d="M13 31l5-1 2 4-3 2zM22 36l5-1 1 4-4 2zM12 41l4-1 1 3-4 1z" fill="#f5dcc6" />
      <g fill="#6e2a1e">
        <circle cx="21" cy="30" r="1.3" />
        <circle cx="16" cy="37" r="1.4" />
        <circle cx="26" cy="42" r="1.2" />
        <circle cx="12" cy="35" r="1" />
      </g>
      <g fill="#f5dcc6">
        <circle cx="19" cy="42" r="1.3" />
        <circle cx="25" cy="31" r="1.1" />
      </g>
      <path d="M36 22c-2-6 2-12 8-13 6-2 12 1 14 7 2 5 0 11-5 14-5 3-12 2-15-3-1-2-2-3-2-5z" fill="#8f3f2e" stroke="#431a12" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M41 22c-1-4 2-7 6-8 4-1 8 1 9 5 1 4-1 7-4 9-4 2-9 1-10-2-1-1-1-3-1-4z" fill="#b95e47" />
      <path d="M43 17l4-1 1 4-3 1zM49 23l4 0 0 3-4 0z" fill="#f5dcc6" />
      <g fill="#6e2a1e">
        <circle cx="51" cy="18" r="1.1" />
        <circle cx="45" cy="26" r="1.2" />
        <circle cx="42" cy="21" r="1" />
      </g>
    </g>
  );
}

const HOT_DOG_SLICES = [
  { cx: 16, cy: 43, hx: 11, hy: 41 },
  { cx: 35, cy: 34, hx: 30, hy: 32 },
  { cx: 50, cy: 19, hx: 45, hy: 17 },
];

function HotDogSlices() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="24" ry="3.3" fill="#000" opacity=".15" />
      {HOT_DOG_SLICES.map((slice) => (
        <g key={slice.cx}>
          <circle cx={slice.cx} cy={slice.cy} r="11" fill="#ef8a70" stroke="#8a2f1c" strokeWidth="2.4" />
          <circle cx={slice.cx} cy={slice.cy} r="7.6" fill="#f9bba5" />
        </g>
      ))}
      <g stroke="#fff0ea" strokeWidth="2.2" strokeLinecap="round" fill="none">
        {HOT_DOG_SLICES.map((slice) => (
          <path key={slice.cx} d={`M${slice.hx} ${slice.hy}c1-2 3-3 5-3`} />
        ))}
      </g>
    </g>
  );
}

/* ---------- shiso (Batch 8b, OD-B8-2 amended): a serrated green leaf with a midrib (Style Lock v2 common spec; reference art: docs/design/references/ingredient-icons-2.0/shiso.svg) ---------- */
const SHISO_LEAF = "M32 6.0 L37.9 8.0 L38.6 9.9 L44.0 11.9 L44.2 13.8 L49.0 15.8 L48.6 17.7 L52.7 19.7 L51.6 21.6 L54.9 23.6 L52.9 25.5 L55.4 27.5 L52.6 29.5 L54.2 31.4 L50.7 33.4 L51.6 35.3 L47.4 37.3 L47.6 39.2 L42.9 41.2 L42.7 43.1 L37.6 45.1 L37.2 47.0 L32 49.0 L26.8 47.0 L26.4 45.1 L21.3 43.1 L21.1 41.2 L16.4 39.2 L16.6 37.3 L12.4 35.3 L13.3 33.4 L9.8 31.4 L11.4 29.5 L8.6 27.5 L11.1 25.5 L9.1 23.6 L12.4 21.6 L11.3 19.7 L15.4 17.7 L15.0 15.8 L19.8 13.8 L20.0 11.9 L25.4 9.9 L26.1 8.0Z";
const SHISO_LEAF_LIGHT_HALF = "M32 6 L37.9 8.0 L38.6 9.9 L44.0 11.9 L44.2 13.8 L49.0 15.8 L48.6 17.7 L52.7 19.7 L51.6 21.6 L54.9 23.6 L52.9 25.5 L55.4 27.5 L52.6 29.5 L54.2 31.4 L50.7 33.4 L51.6 35.3 L47.4 37.3 L47.6 39.2 L42.9 41.2 L42.7 43.1 L37.6 45.1 L37.2 47.0 L32 49Z";
const SHISO_VEINS = "M32 47 L32 12 M32 23 L42 17 M32 23 L22 17 M32 31 L45 25 M32 31 L19 25 M32 39 L44 33 M32 39 L20 33 M32 47 L41 41 M32 47 L23 41";

function ShisoLeaf() {
  return (
    <g>
      <ellipse cx="32" cy="60" rx="16" ry="2.6" fill="#000" opacity=".15" />
      <path d="M32 49 L32 57" stroke="#245f2c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d={SHISO_LEAF} fill="#5aa84f" stroke="#245f2c" strokeWidth="2.4" strokeLinejoin="round" />
      <path d={SHISO_LEAF_LIGHT_HALF} fill="#7cc46a" />
      <path d={SHISO_VEINS} stroke="#245f2c" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".75" />
    </g>
  );
}

/* ---------- whitebait (Batch 8b, OD-B8-2 amended): three small white fish (reference art: docs/design/references/ingredient-icons-2.0/whitebait.svg) ---------- */
const WHITEBAIT_FISH: readonly { x: number; y: number; rotate: number }[] = [
  { x: 28, y: 16, rotate: -10 },
  { x: 38, y: 31, rotate: 8 },
  { x: 27, y: 46, rotate: -4 },
];

function WhitebaitSchool() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="24" ry="3.3" fill="#000" opacity=".15" />
      {WHITEBAIT_FISH.map((fish) => (
        <g key={fish.y} transform={`translate(${fish.x} ${fish.y}) rotate(${fish.rotate}) scale(1.3)`}>
          <path d="M-12 0C-8-7 3-7 8-1.4L15-7V7L8 1.4C3 7-8 7-12 0Z" fill="#fbf9f1" stroke="#4d4837" strokeWidth="2.1" strokeLinejoin="round" />
          <path d="M-9-3C-5-5.2 1-5 5-2.2" stroke="#8fa7b3" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="-7" cy="-1.6" r="1.8" fill="#2b2b2b" />
        </g>
      ))}
    </g>
  );
}

/* ---------- salmon-roe (Batch 8c): a small pile of translucent orange grains (reference art: docs/design/references/ingredient-icons-2.0/salmon-roe.svg) ---------- */
const SALMON_ROE_GRAINS: readonly { x: number; y: number }[] = [
  { x: 32, y: 23 },
  { x: 24, y: 34 },
  { x: 40, y: 34 },
  { x: 16, y: 46 },
  { x: 32, y: 47 },
  { x: 48, y: 46 },
];

function SalmonRoeGrains() {
  return (
    <g>
      <ellipse cx="32" cy="58" rx="24" ry="3.1" fill="#000" opacity=".15" />
      {SALMON_ROE_GRAINS.map((grain) => (
        <g key={`${grain.x}-${grain.y}`}>
          <circle cx={grain.x} cy={grain.y} r="9" fill="#f2842b" stroke="#a63f12" strokeWidth="2.4" />
          <circle cx={grain.x} cy={grain.y} r="5.6" fill="#f9aa5c" />
          <circle cx={grain.x - 3} cy={grain.y - 3} r="2" fill="#fff" opacity=".85" />
        </g>
      ))}
    </g>
  );
}
