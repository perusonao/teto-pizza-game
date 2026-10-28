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
  "pickle-slices": "0 0 64 64",
  "wurstel-links": "0 0 64 64",
  "paprika-powder-pile": "0 0 64 64",
  "shiso-leaf": "0 0 64 64",
  "arugula-leaves": "0 0 64 64",
  "whitebait-school": "0 0 64 64",
  "green-onion-slices": "0 0 64 64",
  "salmon-roe-grains": "0 0 64 64",
  "shrimp-curl": "0 0 64 64",
  "sesame-seeds": "0 0 64 64",
  "pomegranate-aril": "0 0 64 64",
  "cilantro-leaf": "0 0 64 64",
  "beef-slices": "0 0 64 64",
  "wasabi-dab": "0 0 64 64",
  "cod-roe-mass": "0 0 64 64",
  "nori-strips": "0 0 64 64",
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
      {visual === "pickle-slices" && <PickleSlices />}
      {visual === "wurstel-links" && <WurstelLinks />}
      {visual === "paprika-powder-pile" && <PaprikaPowderPile />}
      {visual === "shiso-leaf" && <ShisoLeaf />}
      {visual === "arugula-leaves" && <ArugulaLeaves />}
      {visual === "whitebait-school" && <WhitebaitSchool />}
      {visual === "green-onion-slices" && <GreenOnionSlices />}
      {visual === "salmon-roe-grains" && <SalmonRoeGrains />}
      {visual === "shrimp-curl" && <ShrimpCurl />}
      {visual === "sesame-seeds" && <SesameSeeds />}
      {visual === "pomegranate-aril" && <PomegranateAril />}
      {visual === "cilantro-leaf" && <CilantroLeaf />}
      {visual === "beef-slices" && <BeefSlices />}
      {visual === "wasabi-dab" && <WasabiDab />}
      {visual === "cod-roe-mass" && <CodRoeMass />}
      {visual === "nori-strips" && <NoriStrips />}
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

/* ---------- pickles (Ingredient Visual V1, provisional adoption; final adoption = the 390x844 / 360x800 HV): a wavy-cut round slice with a pale seed ring, and one whole gherkin ---------- */

const PICKLE_SLICE = "M57.1 23.0L56.6 24.2L55.6 25.2L54.9 26.2L55.0 27.4L55.4 28.8L55.2 30.0L54.2 30.8L52.8 31.2L51.7 31.7L51.2 32.8L50.8 34.2L50.1 35.2L48.8 35.4L47.4 35.0L46.2 34.9L45.2 35.6L44.2 36.6L43.0 37.1L41.8 36.6L40.8 35.6L39.8 34.9L38.6 35.0L37.2 35.4L36.0 35.2L35.2 34.2L34.8 32.8L34.3 31.7L33.2 31.2L31.8 30.8L30.8 30.0L30.6 28.8L31.0 27.4L31.1 26.2L30.4 25.2L29.4 24.2L28.9 23.0L29.4 21.8L30.4 20.8L31.1 19.8L31.0 18.6L30.6 17.2L30.8 15.9L31.8 15.2L33.2 14.8L34.3 14.3L34.8 13.2L35.2 11.8L35.9 10.8L37.2 10.6L38.6 11.0L39.8 11.1L40.8 10.4L41.8 9.4L43.0 8.9L44.2 9.4L45.2 10.4L46.2 11.1L47.4 11.0L48.8 10.6L50.1 10.8L50.8 11.8L51.2 13.2L51.7 14.3L52.8 14.8L54.2 15.2L55.2 15.9L55.4 17.2L55.0 18.6L54.9 19.8L55.6 20.8L56.6 21.8Z";
const PICKLE_SEEDS = [
  { x: 49.2, y: 23.0, a: 0 },
  { x: 46.1, y: 28.4, a: 60 },
  { x: 39.9, y: 28.4, a: 120 },
  { x: 36.8, y: 23.0, a: 180 },
  { x: 39.9, y: 17.6, a: 240 },
  { x: 46.1, y: 17.6, a: 300 },
];

function PickleSlices() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="23" ry="3.3" fill="#000" opacity=".15" />
      <path d={PICKLE_SLICE} fill="#5f7d24" stroke="#33430f" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="43" cy="23" r="9.6" fill="#cfdc86" />
      <circle cx="43" cy="23" r="3.4" fill="#e9efb4" />
      {PICKLE_SEEDS.map((seed) => (
        <ellipse key={seed.a} cx={seed.x} cy={seed.y} rx="1.9" ry="1.1" transform={`rotate(${seed.a} ${seed.x} ${seed.y})`} fill="#f4f2c0" />
      ))}
      <g transform="rotate(-24 22 40)">
        <rect x="4" y="30" width="38" height="19" rx="9.5" fill="#6f9230" stroke="#33430f" strokeWidth="2.4" />
        <g fill="#4c6a1c">
          <circle cx="12" cy="36" r="1.5" />
          <circle cx="19" cy="42" r="1.5" />
          <circle cx="26" cy="36" r="1.5" />
          <circle cx="33" cy="42" r="1.5" />
          <circle cx="36" cy="35" r="1.3" />
          <circle cx="9" cy="43" r="1.2" />
        </g>
        <path d="M10 33.5c8-2 18-2 26 0" stroke="#b9d065" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

/* ---------- wurstel (Ingredient Visual V1, provisional adoption): two pale-orange scored sausages (a wurstel, not the round hot-dog slices) ---------- */

function WurstelLinks() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="23" ry="3.3" fill="#000" opacity=".15" />
      <g transform="rotate(-12 30 21)">
        <rect x="9" y="13" width="42" height="15" rx="7.5" fill="#e79a68" stroke="#7f3519" strokeWidth="2.4" />
        <path d="M13 16.5h34" stroke="#fbd6b8" strokeWidth="2.4" strokeLinecap="round" />
        <g stroke="#b3582f" strokeWidth="1.8" strokeLinecap="round">
          <path d="M17 19l4 7M24 19l4 7M31 19l4 7M38 19l4 7" />
        </g>
        <path d="M12.5 17v8M47.5 17v8" stroke="#a24a26" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g transform="rotate(9 34 42)">
        <rect x="12" y="34" width="42" height="15" rx="7.5" fill="#e79a68" stroke="#7f3519" strokeWidth="2.4" />
        <path d="M16 37.5h34" stroke="#fbd6b8" strokeWidth="2.4" strokeLinecap="round" />
        <g stroke="#b3582f" strokeWidth="1.8" strokeLinecap="round">
          <path d="M20 40l4 7M27 40l4 7M34 40l4 7M41 40l4 7" />
        </g>
        <path d="M15.5 38v8M50.5 38v8" stroke="#a24a26" strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  );
}

/* ---------- paprika-powder (Ingredient Visual V1, provisional adoption): a small mound of red powder with a few stray grains ---------- */

function PaprikaPowderPile() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="23" ry="3.3" fill="#000" opacity=".15" />
      <path d="M7 50C8 42 15 33 25 29c7-3 14 0 19 6 6 5 12 10 13 15-8 5-42 5-50 0z" fill="#c4361a" stroke="#6a1a0a" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M13 47c3-6 9-11 16-12 6-1 11 2 15 7" fill="#df5a30" />
      <g fill="#8a2210">
        <circle cx="20" cy="45" r="1.5" />
        <circle cx="33" cy="41" r="1.4" />
        <circle cx="42" cy="46" r="1.6" />
        <circle cx="28" cy="48" r="1.3" />
        <circle cx="48" cy="49" r="1.2" />
      </g>
      <g fill="#f7946a">
        <circle cx="24" cy="39" r="1.3" />
        <circle cx="37" cy="37" r="1.2" />
        <circle cx="17" cy="48" r="1.1" />
        <circle cx="45" cy="42" r="1.1" />
      </g>
      <g fill="#c4361a" stroke="#6a1a0a" strokeWidth="1">
        <circle cx="12" cy="24" r="1.7" />
        <circle cx="51" cy="22" r="1.5" />
        <circle cx="31" cy="16" r="1.6" />
        <circle cx="20" cy="15" r="1.2" />
        <circle cx="46" cy="14" r="1.2" />
        <circle cx="57" cy="32" r="1.4" />
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

/* ---------- shrimp: a peeled shrimp (Style Lock v2 §1d: the adopted shelled curl, redrawn with pale-pink flesh and an orange outline; no eyes / feelers / legs) ---------- */
const SHRIMP_CURL_BODY = "M42 14C58 18 60 44 38 48 26 50 14 44 14 34";

function ShrimpCurl() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="23" ry="3.3" fill="#000" opacity=".15" />
      <path d="M15 36 L4 33 C4 38 6 43 10 46 L16 41 Z" fill="#f9b98f" stroke="#e8793f" strokeWidth="2" strokeLinejoin="round" />
      <path d={SHRIMP_CURL_BODY} stroke="#e8793f" strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d={SHRIMP_CURL_BODY} stroke="#fdd9d0" strokeWidth="10.6" strokeLinecap="round" fill="none" />
      <path d={SHRIMP_CURL_BODY} stroke="#f2a99b" strokeWidth="10.6" fill="none" strokeDasharray="1.6 5.6" />
      <path d="M43 11C56 14 58 31 52 38" stroke="#fffaf6" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".85" />
    </g>
  );
}

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

/* ---------- white sesame (New Sauces Phase B U2): a few pale grains (pointed ovals) with a tan outline, scattered (large enough to read on the baked crust at the extra-small piece scale). Drawn as grains, not a leaf or a ring, so it reads differently from the shiso / green-onion / roe art. ---------- */
const SESAME_SEEDS: readonly { x: number; y: number; rot: number }[] = [
  { x: 19, y: 21, rot: -30 },
  { x: 43, y: 19, rot: 25 },
  { x: 31, y: 36, rot: 50 },
  { x: 17, y: 49, rot: 10 },
  { x: 46, y: 47, rot: -45 },
];

function SesameSeeds() {
  return (
    <g>
      <ellipse cx="32" cy="58" rx="22" ry="3" fill="#000" opacity=".15" />
      {SESAME_SEEDS.map((seed) => (
        <g key={`${seed.x}-${seed.y}`} transform={`translate(${seed.x} ${seed.y}) rotate(${seed.rot})`}>
          <path d="M-9.5 0 Q0 -7.6 9.5 0 Q0 7.6 -9.5 0 Z" fill="#f4efe0" stroke="#8a6a38" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M-4.6 -0.6 Q0 -3.4 4.6 -0.6" fill="none" stroke="#fffdf4" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
        </g>
      ))}
    </g>
  );
}

/* ---------- pomegranate (New Sauces U3, candidate A'): six teardrop arils in a ruby red with a deep-wine outline, one shade facet and a glossy highlight each (reference art: docs/design/references/ingredient-icons-2.0/pomegranate.svg). Drawn as glossy drops, not round beads, so it reads differently from the salmon-roe grains and the tomato slice. ---------- */
const POMEGRANATE_ARILS: readonly { x: number; y: number; rot: number }[] = [
  { x: 32, y: 17, rot: -6 },
  { x: 18, y: 28, rot: -28 },
  { x: 46, y: 28, rot: 24 },
  { x: 11, y: 44, rot: -14 },
  { x: 28, y: 42, rot: 10 },
  { x: 44, y: 45, rot: 30 },
];

function PomegranateAril() {
  return (
    <g>
      <ellipse cx="32" cy="58" rx="24" ry="3.1" fill="#000" opacity=".15" />
      {POMEGRANATE_ARILS.map((aril) => (
        <g key={`${aril.x}-${aril.y}`} transform={`translate(${aril.x} ${aril.y}) rotate(${aril.rot}) scale(0.95)`}>
          <path d="M0 -12.5 C2.5 -8 8 -3.5 7.6 2.5 C7.2 8.5 3.6 10.5 0 10.5 C-3.6 10.5 -7.2 8.5 -7.6 2.5 C-8 -3.5 -2.5 -8 0 -12.5 Z" fill="#c4163f" stroke="#650d27" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M0 -8 C2 -4 4.5 -1.5 4.6 2.5 L0 6 Z" fill="#a50f33" />
          <path d="M-3.2 -1 C-3.4 -4 -1.6 -6.2 0 -8 C-0.6 -4.5 -0.8 -2 -1.6 1.2 C-2.4 1.6 -3 0.8 -3.2 -1 Z" fill="#ef5b79" />
          <circle cx="-2.8" cy="-0.5" r="1.5" fill="#fff" opacity=".9" />
        </g>
      ))}
    </g>
  );
}

/* ---------- green onion (New Sauces Phase B-1, OD-B9-3): three small ring slices, a green wall around a pale hollow centre (Style Lock v2 common spec; reference art: docs/design/references/ingredient-icons-2.0/green-onion.svg) ---------- */
const GREEN_ONION_RINGS: readonly { x: number; y: number; r: number }[] = [
  { x: 24, y: 22, r: 12 },
  { x: 41, y: 31, r: 12 },
  { x: 25, y: 45, r: 12 },
];

function GreenOnionSlices() {
  return (
    <g>
      <ellipse cx="32" cy="58" rx="22" ry="3" fill="#000" opacity=".15" />
      {GREEN_ONION_RINGS.map((ring) => (
        <g key={`${ring.x}-${ring.y}`} transform={`translate(${ring.x} ${ring.y})`}>
          <circle r={ring.r} fill="#7fae4a" stroke="#3a6b2b" strokeWidth="2.4" />
          <circle r={ring.r - 4.4} fill="#e3efbd" stroke="#5f9440" strokeWidth="1.6" />
          <circle r={ring.r - 8.6} fill="#f4f8dc" />
        </g>
      ))}
    </g>
  );
}

/* ---------- arugula: a sprig of three long, lobed leaves with a midrib and side veins ---------- */

/** One leaf pointing up from (0,0): `lobes` rounded lobes per side (the two sides are offset, like a real rocket leaf), a pointed tip. */
function arugulaLeafGeometry(length: number, halfWidth: number, lobes: number) {
  const steps = 56;
  const half = (side: 1 | -1) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const envelope = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
      const phase = side === 1 ? 0.35 : 1.35;
      const lobe = 0.4 + 0.6 * Math.pow(Math.abs(Math.sin(lobes * Math.PI * t + phase)), 0.5);
      pts.push([side * halfWidth * envelope * lobe, -length * t]);
    }
    return pts;
  };
  const right = half(1);
  const left = half(-1);
  const toPath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const outline = `${toPath(right)} ${left
    .slice()
    .reverse()
    .map(([x, y]) => `L${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ")} Z`;
  const lightHalf = `${toPath(right)} L0 ${(-length).toFixed(2)} L0 0 Z`;
  // side veins: from the midrib to each lobe's widest point, alternating sides
  const veins: string[] = [];
  for (let k = 0; k < lobes; k += 1) {
    const tc = (k + 0.5) / lobes;
    const side = k % 2 === 0 ? 1 : -1;
    const pts = side === 1 ? right : left;
    const [x, y] = pts[Math.round(tc * steps)];
    veins.push(`M0 ${(y * 0.72).toFixed(2)} L${(x * 0.78).toFixed(2)} ${(y * 0.98).toFixed(2)}`);
  }
  return { outline, lightHalf, veins: veins.join(" "), tip: -length };
}

const ARUGULA_LEAVES: readonly { rotate: number; length: number; halfWidth: number; lobes: number; fill: string; light: string }[] = [
  { rotate: -38, length: 38, halfWidth: 6.4, lobes: 4, fill: "#4f9a3f", light: "#74bd5a" },
  { rotate: 34, length: 35, halfWidth: 6.2, lobes: 4, fill: "#5aa646", light: "#82c866" },
  { rotate: -3, length: 47, halfWidth: 7.2, lobes: 5, fill: "#448c37", light: "#69b250" },
];

const ARUGULA_GEOMETRY = ARUGULA_LEAVES.map((l) => arugulaLeafGeometry(l.length, l.halfWidth, l.lobes));

function ArugulaLeaves() {
  return (
    <g>
      <ellipse cx="32" cy="60" rx="14" ry="2.4" fill="#000" opacity=".15" />
      {ARUGULA_LEAVES.map((leaf, i) => (
        <g key={leaf.rotate} transform={`translate(32 58) rotate(${leaf.rotate})`}>
          <path d="M0 1 L0 -3" stroke="#245f2c" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d={ARUGULA_GEOMETRY[i].outline} fill={leaf.fill} stroke="#2a6a28" strokeWidth="1.3" strokeLinejoin="round" />
          <path d={ARUGULA_GEOMETRY[i].lightHalf} fill={leaf.light} />
          <path d={`M0 0 L0 ${(ARUGULA_GEOMETRY[i].tip * 0.9).toFixed(2)}`} stroke="#23561f" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity=".8" />
          <path d={ARUGULA_GEOMETRY[i].veins} stroke="#23561f" strokeWidth=".8" strokeLinecap="round" fill="none" opacity=".6" />
        </g>
      ))}
    </g>
  );
}

/* ---------- cilantro (BBQ Chicken, Owner Final Design Gate 2026-10-27, candidate A): a sprig of three rounded, scalloped fan leaves on thin stems, in a fresh yellow-green with a deep-green outline (the Style Lock v2 line weight), so it reads on the
   dark BBQ sauce and is a different shape from the single serrated shiso leaf, the arugula lobes and the clover-like parsley / mint emoji. Reference art: docs/design/references/ingredient-icons-2.0/cilantro.svg. No ids / gradients: any number can share a page. ---------- */
const CILANTRO_LEAF = "M0 0 L-9 -9 Q-13 -14 -9 -18 Q-8 -23 -3 -21 Q0 -26 3 -21 Q8 -23 9 -18 Q13 -14 9 -9 Z";
const CILANTRO_LEAVES: readonly string[] = [
  "translate(23 41) rotate(-42) scale(.95)",
  "translate(41 41) rotate(42) scale(.95)",
  "translate(32 44) scale(1.15)",
];

function CilantroLeaf() {
  return (
    <g>
      <ellipse cx="32" cy="60" rx="17" ry="2.6" fill="#000" opacity=".15" />
      <g stroke="#245f2c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M32 58 L32 44" />
        <path d="M32 50 L23 41" />
        <path d="M32 50 L41 41" />
      </g>
      <g stroke="#245f2c" strokeWidth="2.2" strokeLinejoin="round" fill="#9ad45f">
        {CILANTRO_LEAVES.map((transform) => (
          <path key={transform} d={CILANTRO_LEAF} transform={transform} />
        ))}
      </g>
      <g stroke="#2f7a2f" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".8">
        <path d="M32 44 L32 22 M32 36 L27 29 M32 36 L37 29" />
        <path d="M23 41 L11 28 M20 36 L15 36 M18 33 L18 28" />
        <path d="M41 41 L53 28 M44 36 L49 36 M46 33 L46 28" />
      </g>
      <g fill="#b6e07a" opacity=".6">
        <ellipse cx="29" cy="25" rx="2.2" ry="1.4" transform="rotate(-30 29 25)" />
        <ellipse cx="14" cy="32" rx="1.8" ry="1.2" transform="rotate(-45 14 32)" />
        <ellipse cx="50" cy="32" rx="1.8" ry="1.2" transform="rotate(45 50 32)" />
      </g>
    </g>
  );
}

/* ---------- PR-2 late4 (Issue #578 / #611): beef, wasabi, cod roe and nori. PROVISIONAL art in the Style Lock v2 vocabulary (2.4 outline, two tones, a ground shadow, no ids / gradients / defs, deterministic); the final adoption is the Owner HV on 390x844 / 360x800.
   beef-slices: two thin red-brown ribbons with a pale fat streak (a different silhouette from the round dark salami / sausage slices and the pink ham). wasabi-dab: a pale-green mound with a swirl. cod-roe-mass: a coral clump of fine grains. nori-strips: dark green strips. ---------- */
function BeefSlices() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="24" ry="3.3" fill="#000" opacity=".15" />
      <path d="M6 28c2-9 13-14 25-10 9 3 16 2 24 6 3 8-4 14-14 12-9-2-16 3-26 2-6-1-10-5-9-10z" fill="#b8473a" stroke="#4a1a14" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 27c7-5 16-4 24 0 6 3 11 3 15 3" fill="none" stroke="#f1d3c4" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 44c3-6 15-4 25 0 8 3 15 2 21 4-1 7-11 9-21 7-9-2-17 1-24-1-3-2-3-6-1-10z" fill="#8f3a30" stroke="#4a1a14" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M19 47c8-3 17 1 27 3" fill="none" stroke="#e6c3b4" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

function WasabiDab() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="19" ry="3.3" fill="#000" opacity=".15" />
      <path d="M12 52C10 32 22 18 32 18s22 14 20 34c-8 5-32 5-40 0z" fill="#a8d070" stroke="#3f6a22" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M25 33c1-5 10-6 13-1 2 4-2 8-7 7" fill="none" stroke="#dff0b8" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="40" cy="46" r="1.6" fill="#7fae4a" />
      <circle cx="22" cy="46" r="1.4" fill="#7fae4a" />
    </g>
  );
}

const COD_ROE_GRAINS: readonly (readonly [number, number])[] = [
  [20, 46], [27, 49], [34, 49], [41, 46], [24, 39], [31, 41], [38, 39], [44, 41], [28, 32], [35, 31], [31, 24],
];

function CodRoeMass() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="22" ry="3.3" fill="#000" opacity=".15" />
      <path d="M10 44c-2-10 6-14 12-13 2-8 14-11 20-5 7 0 13 6 11 14 1 8-10 12-20 11-11 1-22-1-23-7z" fill="#e8836b" stroke="#8f3b2a" strokeWidth="2.4" strokeLinejoin="round" />
      <g fill="#f6b09b">
        {COD_ROE_GRAINS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" />
        ))}
      </g>
      <g fill="#b9533e">
        <circle cx="46" cy="49" r="1.5" />
        <circle cx="16" cy="44" r="1.5" />
        <circle cx="35" cy="37" r="1.3" />
      </g>
    </g>
  );
}

function NoriStrips() {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="22" ry="3.3" fill="#000" opacity=".15" />
      <g stroke="#0c1a12" strokeWidth="2.4" strokeLinejoin="round" fill="#1f3a2a">
        <path d="M8 40l31-12 4 7-31 13z" />
        <path d="M19 27l31-8 3 7-31 9z" />
        <path d="M22 51l31-8 3 6-31 8z" />
      </g>
      <g stroke="#4f8a62" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M16 40l20-8" />
        <path d="M27 28l20-5" />
        <path d="M30 51l20-5" />
      </g>
    </g>
  );
}
