/**
 * B21/B22 staged ingredient glyphs (#417 sublane, Owner P-2). UNWIRED: nothing imports this file in production. `IngredientGlyph.tsx`,
 * `ingredients.ts` and `App.css` are untouched; a wiring PR (Catalog Integrator or the #417 wiring PR) registers `pieceVisual`.
 * Every glyph: 64x64 box, 1em, aria-hidden, no ids / gradients / clip paths (any number can share a page), outline 3 (2.6 for small pieces).
 */
import { STAGED_GLYPH_PALETTE, type StagedGlyphId } from "./stagedGlyphPalette";

function Svg({ id, children }: { id: StagedGlyphId; children: React.ReactNode }) {
  return (
    <svg
      className={`ingredient-glyph ingredient-glyph--${id}`}
      data-ingredient-visual={id}
      viewBox="0 0 64 64"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
const SW = 3;

function Cheddar() {
  const c = STAGED_GLYPH_PALETTE["cheddar-cubes"];
  return (
    <Svg id="cheddar-cubes">
      <g transform="rotate(-12 24 28)">
        <rect x="8" y="12" width="26" height="26" rx="4" fill={c.fill} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M11 17 H31" stroke={c.light} strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="30" r="2.6" fill={c.detail} />
        <circle cx="27" cy="25" r="1.8" fill={c.detail} />
      </g>
      <g transform="rotate(14 44 44)">
        <rect x="31" y="31" width="22" height="22" rx="4" fill={c.fill} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
        <path d="M34 36 H50" stroke={c.light} strokeWidth="3" strokeLinecap="round" />
        <circle cx="45" cy="46" r="2.2" fill={c.detail} />
      </g>
    </Svg>
  );
}

function Lettuce() {
  const c = STAGED_GLYPH_PALETTE["lettuce-leaf"];
  return (
    <Svg id="lettuce-leaf">
      <path
        d="M10 40 C4 30 10 18 20 18 C22 9 36 7 41 15 C52 12 60 22 55 32 C60 42 50 54 40 50 C34 58 18 56 16 47 C12 46 11 43 10 40Z"
        fill={c.fill}
        stroke={c.outline}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <path d="M12 40 C20 34 28 30 36 22 C42 18 48 20 53 25" fill="none" stroke={c.light} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M22 44 C28 40 34 40 42 44 M30 34 C34 30 38 29 42 30 M24 26 C27 28 28 30 28 33" fill="none" stroke={c.detail} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

function TortillaChips() {
  const c = STAGED_GLYPH_PALETTE["tortilla-chip-triangles"];
  return (
    <Svg id="tortilla-chip-triangles">
      <path d="M8 44 L24 10 L40 40 C32 49 18 50 8 44Z" fill={c.fill} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M13 41 L24 18" stroke={c.light} strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="34" r="1.8" fill={c.detail} />
      <circle cx="29" cy="41" r="1.6" fill={c.detail} />
      <path d="M34 56 L48 26 L60 52 C52 59 42 59 34 56Z" fill={c.fill} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M40 52 L48 33" stroke={c.light} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="47" r="1.6" fill={c.detail} />
    </Svg>
  );
}

/** A shred = an outline stroke under a thinner fill stroke, so it reads on every bake state without gradients. */
function Shred({ d, c, w = 8 }: { d: string; c: { fill: string; outline: string }; w?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={c.outline} strokeWidth={w + 4} strokeLinecap="round" />
      <path d={d} fill="none" stroke={c.fill} strokeWidth={w} strokeLinecap="round" />
    </>
  );
}

function Cabbage({ id }: { id: "cabbage-shreds" | "red-cabbage-shreds" }) {
  const c = STAGED_GLYPH_PALETTE[id];
  const ribbons = ["M10 20 C20 10 30 28 42 16 C48 12 54 16 56 20", "M8 36 C18 26 30 44 42 32 C48 27 54 31 56 35", "M12 52 C22 42 32 58 44 48 C50 44 54 47 56 50"];
  return (
    <Svg id={id}>
      {ribbons.map((d) => (
        <Shred key={d} d={d} c={c} />
      ))}
      {ribbons.map((d) => (
        <path key={`l${d}`} d={d} fill="none" stroke={c.light} strokeWidth="2.2" strokeLinecap="round" transform="translate(0 -1.5)" />
      ))}
    </Svg>
  );
}

function Bonito() {
  const c = STAGED_GLYPH_PALETTE["bonito-flake-curls"];
  const curl = (d: string, k: string) => (
    <g key={k}>
      <path d={d} fill={c.fill} stroke={c.outline} strokeWidth="2.6" strokeLinejoin="round" />
    </g>
  );
  return (
    <Svg id="bonito-flake-curls">
      {curl("M8 30 C10 16 26 10 34 18 C28 18 22 22 22 30 C20 36 12 38 8 30Z", "a")}
      {curl("M30 52 C28 40 38 30 50 34 C44 36 42 42 44 48 C42 56 34 58 30 52Z", "b")}
      {curl("M38 24 C40 12 54 10 58 20 C52 20 48 24 50 30 C46 34 38 32 38 24Z", "c")}
      <path d="M13 26 C16 20 22 17 28 19 M36 49 C38 42 44 39 48 40 M43 21 C46 16 51 15 54 18" fill="none" stroke={c.light} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 31 C18 28 20 27 22 27 M39 53 C41 51 43 50 45 50" fill="none" stroke={c.detail} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function Fennel() {
  const c = STAGED_GLYPH_PALETTE["fennel-slices"];
  return (
    <Svg id="fennel-slices">
      <path d="M8 46 C6 28 18 12 32 12 C46 12 58 28 56 46 C46 54 18 54 8 46Z" fill={c.fill} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M14 44 C13 31 21 20 32 19 C43 20 51 31 50 44 C42 49 22 49 14 44Z" fill={c.light} />
      <path d="M32 21 C30 30 31 40 32 48 M23 26 C23 34 24 41 26 46 M41 26 C41 34 40 41 38 46" fill="none" stroke={c.detail} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 12 C30 8 28 6 25 5 M32 12 C34 8 37 6 40 6 M32 12 C32 8 32 5 32 3" fill="none" stroke={c.detail} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function Orange() {
  const c = STAGED_GLYPH_PALETTE["orange-slices"];
  const seg = (a: number) => (
    <path key={a} d="M32 32 L32 14 A18 18 0 0 1 44.7 19.3Z" fill={c.fill} transform={`rotate(${a} 32 32)`} />
  );
  return (
    <Svg id="orange-slices">
      <circle cx="32" cy="32" r="25" fill={c.detail} stroke={c.outline} strokeWidth={SW} />
      <circle cx="32" cy="32" r="20.5" fill={c.light} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(seg)}
      <circle cx="32" cy="32" r="2.6" fill={c.light} />
    </Svg>
  );
}

function Carrot() {
  const c = STAGED_GLYPH_PALETTE["carrot-rounds"];
  const round = (cx: number, cy: number, r: number) => (
    <g key={`${cx}${cy}`}>
      <circle cx={cx} cy={cy} r={r} fill={c.fill} stroke={c.outline} strokeWidth={SW} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill={c.light} />
      <circle cx={cx} cy={cy} r={r * 0.22} fill={c.detail} />
    </g>
  );
  return <Svg id="carrot-rounds">{[round(22, 24, 15), round(43, 43, 14)]}</Svg>;
}

function Sunflower() {
  const c = STAGED_GLYPH_PALETTE["sunflower-kernels"];
  const seed = (x: number, y: number, rot: number) => (
    <g key={`${x}${y}`} transform={`rotate(${rot} ${x} ${y})`}>
      <path d={`M${x} ${y - 12} C${x + 9} ${y - 5} ${x + 7} ${y + 8} ${x} ${y + 12} C${x - 7} ${y + 8} ${x - 9} ${y - 5} ${x} ${y - 12}Z`} fill={c.fill} stroke={c.outline} strokeWidth="2.6" strokeLinejoin="round" />
      <path d={`M${x - 2} ${y - 7} C${x + 2} ${y - 3} ${x + 2} ${y + 3} ${x - 1} ${y + 7}`} fill="none" stroke={c.light} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
  return <Svg id="sunflower-kernels">{[seed(20, 24, -28), seed(44, 22, 24), seed(32, 46, 70)]}</Svg>;
}

function Radicchio() {
  const c = STAGED_GLYPH_PALETTE["radicchio-leaf"];
  return (
    <Svg id="radicchio-leaf">
      <path d="M32 6 C46 10 58 26 52 42 C48 54 38 60 32 58 C26 60 16 54 12 42 C6 26 18 10 32 6Z" fill={c.fill} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M32 12 C31 26 33 42 32 56" fill="none" stroke={c.light} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 24 C26 22 21 24 17 28 M32 34 C26 32 20 34 16 39 M32 24 C38 22 43 24 47 28 M32 34 C38 32 44 34 48 39" fill="none" stroke={c.light} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function Truffle() {
  const c = STAGED_GLYPH_PALETTE["truffle-shavings"];
  const shave = (d: string, k: string, veins: string) => (
    <g key={k}>
      <path d={d} fill={c.fill} stroke={c.outline} strokeWidth="2.8" strokeLinejoin="round" />
      <path d={veins} fill="none" stroke={c.light} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
  return (
    <Svg id="truffle-shavings">
      {shave("M8 28 C6 16 18 8 30 12 C38 14 40 24 34 30 C28 36 12 38 8 28Z", "a", "M14 22 C20 18 26 20 30 24 M12 28 C18 28 24 28 30 28")}
      {shave("M30 54 C26 44 36 36 48 38 C58 40 60 50 52 56 C46 60 34 60 30 54Z", "b", "M36 46 C42 42 48 44 52 48 M34 52 C40 52 46 52 52 52")}
      {shave("M44 24 C42 14 52 8 58 14 C62 20 58 28 50 28 C46 28 44 26 44 24Z", "c", "M48 18 C52 16 55 18 56 22")}
    </Svg>
  );
}

function Brie() {
  const c = STAGED_GLYPH_PALETTE["brie-wedge"];
  return (
    <Svg id="brie-wedge">
      <path d="M6 42 C10 20 30 8 54 14 L58 40 C40 46 20 50 6 42Z" fill={c.light} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
      <path d="M10 38 C14 22 32 14 52 18 L54 36 C38 40 22 43 10 38Z" fill={c.fill} />
      <path d="M6 42 C20 50 40 46 58 40 L58 48 C40 55 18 58 6 50Z" fill={c.light} stroke={c.outline} strokeWidth={SW} strokeLinejoin="round" />
      <circle cx="24" cy="31" r="2.2" fill={c.detail} />
      <circle cx="40" cy="27" r="1.8" fill={c.detail} />
      <circle cx="33" cy="36" r="1.6" fill={c.detail} />
    </Svg>
  );
}

const STAGED_GLYPH_COMPONENTS: Record<StagedGlyphId, () => React.ReactElement> = {
  "cheddar-cubes": Cheddar,
  "lettuce-leaf": Lettuce,
  "tortilla-chip-triangles": TortillaChips,
  "cabbage-shreds": () => <Cabbage id="cabbage-shreds" />,
  "bonito-flake-curls": Bonito,
  "fennel-slices": Fennel,
  "orange-slices": Orange,
  "carrot-rounds": Carrot,
  "red-cabbage-shreds": () => <Cabbage id="red-cabbage-shreds" />,
  "sunflower-kernels": Sunflower,
  "radicchio-leaf": Radicchio,
  "truffle-shavings": Truffle,
  "brie-wedge": Brie,
};

export function StagedGlyph({ id }: { id: StagedGlyphId }) {
  const C = STAGED_GLYPH_COMPONENTS[id];
  return <C />;
}
