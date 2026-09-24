/**
 * W1 Visual QA board (preview-only). Every piece here is drawn by the production
 * `IngredientPieceVisual` and every tray by the production `IngredientTray`; bake tint comes from
 * the production `toppingVisualFrame` / `doughVisualColors` / `cheeseVisualFrame`, formatted
 * exactly like PizzaStage's own inline `filter`. Only the backgrounds are composed here.
 */
import type { CSSProperties, ReactNode } from "react";
import { getIngredient, type Ingredient, type IngredientCategory } from "../../src/data/ingredients";
import { getRecipe } from "../../src/data/recipes";
import { IngredientPieceVisual } from "../../src/components/IngredientPieceVisual";
import { IngredientTray } from "../../src/components/IngredientTray";
import { cheeseVisualFrame, doughVisualColors, toppingVisualFrame } from "../../src/logic/bakeVisual";
import { createEmptyPizza } from "../../src/state/pizzaState";
import { W1VisualOverride } from "./visualOverride";
import type { DedicatedVisualKey } from "./candidates";

/** heat 0 = unbaked (PREPARE, no filter); heat 1 = the bake window's own center (the "good"
 *  RESULT look); heat 1.6 = the edge of browningDeep (worst still-servable roast). */
const BAKE_STATES = [
  { key: "raw", label: "raw", heat: null },
  { key: "baked", label: "baked (heat 1.0)", heat: 1 },
  { key: "deep", label: "deep (heat 1.6)", heat: 1.6 },
] as const;

type BakeKey = (typeof BAKE_STATES)[number]["key"];

const BASES = {
  sauce: { label: "tomato sauce", color: "#c73b2e" },
  cheese: { label: "mozzarella", color: null },
  oil: { label: "olive oil + parmigiano", color: "#e9d9a0" },
  pesto: { label: "pesto", color: "#6b8e3d" },
  dough: { label: "dough only", color: null },
} as const;

type BaseKey = keyof typeof BASES;

function need(id: string): Ingredient {
  const ingredient = getIngredient(id);
  if (!ingredient) throw new Error(`W1 board: unknown ingredient ${id}`);
  return ingredient;
}

function toppingStyle(ingredient: Ingredient, heat: number | null): CSSProperties | undefined {
  if (heat === null) return undefined;
  const frame = toppingVisualFrame(heat, ingredient.bakeRoastResistant === true);
  return {
    filter: `brightness(${frame.brightness.toFixed(3)}) saturate(${frame.saturate.toFixed(3)}) sepia(${frame.sepia.toFixed(3)}) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3))`,
  };
}

function cheeseStyle(heat: number | null): CSSProperties | undefined {
  if (heat === null) return undefined;
  const frame = cheeseVisualFrame(heat);
  return {
    "--bake-melt-scale": frame.scale,
    filter: `brightness(${frame.brightness.toFixed(3)}) saturate(${frame.saturate.toFixed(3)}) sepia(${frame.sepia.toFixed(3)})`,
  } as CSSProperties;
}

/** One small square of "pizza": dough colour for the bake state, optional sauce fill, optional
 *  cheese pieces underneath, then the pieces under test on top. */
function Patch({
  base,
  bake,
  pieces,
  pieceScale = 1,
  testId,
}: {
  base: BaseKey;
  bake: BakeKey;
  pieces: readonly Ingredient[];
  pieceScale?: number;
  testId?: string;
}) {
  const heat = BAKE_STATES.find((state) => state.key === bake)!.heat;
  const dough = doughVisualColors(heat ?? 0);
  const baseColor = BASES[base].color;
  const underCheese =
    base === "cheese" ? need("mozzarella") : base === "oil" ? need("parmigiano") : null;
  const cols = pieces.length > 2 ? 2 : pieces.length;
  return (
    <div
      className="w1-patch"
      data-testid={testId}
      style={
        {
          "--piece-scale": pieceScale,
          background: `radial-gradient(circle at 40% 35%, ${dough.colorA}, ${dough.colorB})`,
        } as CSSProperties
      }
    >
      {baseColor && <div className="w1-patch__sauce" style={{ background: baseColor, opacity: base === "oil" ? 0.55 : 0.92 }} />}
      {underCheese && (
        <div className="w1-patch__cheese">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} style={{ left: `${18 + (index % 2) * 44}%`, top: `${20 + Math.floor(index / 2) * 44}%` }}>
              <IngredientPieceVisual ingredient={underCheese} style={cheeseStyle(heat)} />
            </span>
          ))}
        </div>
      )}
      <div className="w1-patch__pieces" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
        {pieces.map((ingredient, index) => (
          <span key={`${ingredient.id}-${index}`} className="w1-patch__piece" title={ingredient.id}>
            <IngredientPieceVisual
              ingredient={ingredient}
              style={ingredient.category === "cheese" ? cheeseStyle(heat) : toppingStyle(ingredient, heat)}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

type VisualOverride = Partial<Record<string, DedicatedVisualKey | null>>;

function PatchRow({
  label,
  base,
  pieces,
  pieceScale,
  testId,
  visual,
}: {
  label: string;
  base: BaseKey;
  pieces: readonly Ingredient[];
  pieceScale?: number;
  testId: string;
  /** Per-row W1Glyph override (A/B, before/after); omitted = the page-level default. */
  visual?: VisualOverride;
}) {
  return (
    <W1VisualOverride.Provider value={visual ?? {}}>
    <div className="w1-row" data-testid={testId}>
      <div className="w1-row__label">
        {label}
        <small>
          on {BASES[base].label}
          {pieceScale && pieceScale !== 1 ? ` · ${Math.round(28 * pieceScale)}px` : " · 28px"}
        </small>
      </div>
      <div className="w1-row__patches">
        {BAKE_STATES.map((state) => (
          <figure key={state.key}>
            <Patch base={base} bake={state.key} pieces={pieces} pieceScale={pieceScale} />
            <figcaption>{state.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
    </W1VisualOverride.Provider>
  );
}

/** Production IngredientTray, free-cook mode, owning exactly `ids`. */
function Tray({ category, ids, testId }: { category: IngredientCategory; ids: readonly string[]; testId: string }) {
  const inventory = Object.fromEntries(ids.map((id) => [id, 9]));
  return (
    <div className="w1-tray" data-testid={testId}>
      <IngredientTray
        activeCategory={category}
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={ids}
        recipe={getRecipe("margherita")!}
        freeCook
        inventory={inventory}
        pizza={createEmptyPizza()}
      />
    </div>
  );
}

const CVD_FILTERS = [
  { key: "normal", label: "normal", filter: "none" },
  { key: "gray", label: "grayscale", filter: "grayscale(1)" },
  { key: "deutan", label: "deuteranopia (sim)", filter: "url(#w1-deutan)" },
  { key: "protan", label: "protanopia (sim)", filter: "url(#w1-protan)" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="w1-section" id={id} data-testid={`section-${id}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const CLAM_A: VisualOverride = { clam: null };
const CLAM_B: VisualOverride = { clam: "asari-valve" };
const LEGACY: VisualOverride = { "fresh-tomato": null, capers: null };

export function Board() {
  const fresh = need("fresh-tomato");
  const cherry = need("cherry-tomato");
  const capers = need("capers");
  const olive = need("black-olive");
  const pepperoni = need("pepperoni");
  const eggplant = need("eggplant");
  const basil = need("basil");
  const garlic = need("garlic");
  const corn = need("corn");
  const pineapple = need("pineapple");
  const potato = need("potato");
  const egg = need("egg");
  const ham = need("ham");
  const clam = need("clam");
  const mushroom = need("mushroom");

  return (
    <div className="w1-board">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        {/* Machado et al. (2009) severity-1.0 matrices -- a screen-level approximation only. */}
        <filter id="w1-deutan" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0" />
        </filter>
        <filter id="w1-protan" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0" />
        </filter>
      </svg>
      <header className="w1-board__header">
        <h1>W1 Ingredient Visual QA board</h1>
        <p>PREVIEW ONLY · production IngredientPieceVisual / IngredientTray / bake curves · device check still required</p>
      </header>

      <Section id="all" title="7 candidates · tray + pizza (dedicated fresh-tomato / capers, clam A 🦪)">
        <Tray category="topping" ids={["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"]} testId="tray-all-candidates" />
        <PatchRow label="capers | clam A | corn | eggplant" base="cheese" pieces={[capers, clam, corn, eggplant]} testId="row-all-cheese-a" />
        <PatchRow label="fresh-tomato | pineapple | potato" base="cheese" pieces={[fresh, pineapple, potato]} testId="row-all-cheese-b" />
        <PatchRow label="capers | clam A | corn | eggplant · thumbnail size" base="sauce" pieces={[capers, clam, corn, eggplant]} pieceScale={0.58} testId="row-all-small-a" />
        <PatchRow label="fresh-tomato | pineapple | potato · thumbnail size" base="sauce" pieces={[fresh, pineapple, potato]} pieceScale={0.58} testId="row-all-small-b" />
      </Section>

      <Section id="tomato" title="fresh-tomato (slice) vs cherry-tomato 🍅 vs tomato-sauce">
        <Tray category="topping" ids={["basil", "cherry-tomato", "fresh-tomato"]} testId="tray-tomato-topping" />
        <Tray category="sauce" ids={["tomato-sauce", "pesto"]} testId="tray-tomato-sauce" />
        <PatchRow label="fresh-tomato ×3" base="pesto" pieces={[fresh, fresh, fresh]} testId="row-fresh-pesto" />
        <PatchRow label="cherry-tomato ×3" base="pesto" pieces={[cherry, cherry, cherry]} testId="row-cherry-pesto" />
        <PatchRow label="fresh | cherry | cherry | fresh" base="sauce" pieces={[fresh, cherry, cherry, fresh]} testId="row-tomato-mixed-sauce" />
        <PatchRow label="fresh | cherry | cherry | fresh" base="cheese" pieces={[fresh, cherry, cherry, fresh]} testId="row-tomato-mixed-cheese" />
        <PatchRow label="fresh | cherry · thumbnail size" base="sauce" pieces={[fresh, cherry, cherry, fresh]} pieceScale={0.58} testId="row-tomato-small" />
        <div style={{ filter: "grayscale(1)" }} data-testid="tomato-gray">
          <PatchRow label="fresh | cherry — grayscale" base="sauce" pieces={[fresh, cherry, cherry, fresh]} testId="row-tomato-gray" />
        </div>
        <PatchRow label="BEFORE (slice 1): shared 🍅" base="sauce" pieces={[fresh, cherry, cherry, fresh]} visual={LEGACY} testId="row-tomato-before" />
      </Section>

      <Section id="capers" title="capers (bud cluster) vs black-olive ⚫ vs pepperoni 🔴 (colour-vision sims)">
        <Tray category="topping" ids={["capers", "pepperoni", "black-olive", "garlic"]} testId="tray-circles" />
        {CVD_FILTERS.map((cvd) => (
          <div key={cvd.key} style={{ filter: cvd.filter }} data-testid={`cvd-${cvd.key}`}>
            <PatchRow label={`capers | olive | pepperoni — ${cvd.label}`} base="sauce" pieces={[capers, olive, pepperoni, capers]} testId={`row-circles-${cvd.key}`} />
          </div>
        ))}
        <PatchRow label="capers | olive | pepperoni" base="cheese" pieces={[capers, olive, pepperoni, capers]} testId="row-circles-cheese" />
        <PatchRow label="capers | olive | pepperoni · thumbnail size" base="sauce" pieces={[capers, olive, pepperoni, capers]} pieceScale={0.58} testId="row-circles-small" />
        <div style={{ filter: "grayscale(1)" }} data-testid="capers-before-gray">
          <PatchRow label="BEFORE (slice 1): 🟢 — grayscale" base="sauce" pieces={[capers, olive, pepperoni, capers]} visual={LEGACY} testId="row-circles-before-gray" />
        </div>
      </Section>

      <Section id="clam" title="clam: A 🦪 OYSTER vs B dedicated asari (same conditions)">
        <PatchRow label="A 🦪 ×3" base="oil" pieces={[clam, clam, clam]} visual={CLAM_A} testId="row-clam-a" />
        <PatchRow label="B asari ×3" base="oil" pieces={[clam, clam, clam]} visual={CLAM_B} testId="row-clam-b" />
        <PatchRow label="A 🦪 + garlic (New Haven)" base="oil" pieces={[clam, garlic, garlic, clam]} visual={CLAM_A} testId="row-clam-a-garlic" />
        <PatchRow label="B asari + garlic (New Haven)" base="oil" pieces={[clam, garlic, garlic, clam]} visual={CLAM_B} testId="row-clam-b-garlic" />
        <PatchRow label="A 🦪 | 🧄 | 🍄 · thumbnail size" base="oil" pieces={[clam, garlic, mushroom, clam]} pieceScale={0.58} visual={CLAM_A} testId="row-clam-a-small" />
        <PatchRow label="B asari | 🧄 | 🍄 · thumbnail size" base="oil" pieces={[clam, garlic, mushroom, clam]} pieceScale={0.58} visual={CLAM_B} testId="row-clam-b-small" />
        <PatchRow label="B asari on tomato sauce" base="sauce" pieces={[clam, garlic, garlic, clam]} visual={CLAM_B} testId="row-clam-b-sauce" />
        <div style={{ filter: "grayscale(1)" }} data-testid="clam-gray">
          <PatchRow label="A 🦪 + garlic — grayscale" base="oil" pieces={[clam, garlic, garlic, clam]} visual={CLAM_A} testId="row-clam-a-gray" />
          <PatchRow label="B asari + garlic — grayscale" base="oil" pieces={[clam, garlic, garlic, clam]} visual={CLAM_B} testId="row-clam-b-gray" />
        </div>
      </Section>

      <Section id="eggplant" title="eggplant 🍆 on sauce / cheese">
        <PatchRow label="eggplant ×3" base="sauce" pieces={[eggplant, eggplant, eggplant]} testId="row-eggplant-sauce" />
        <PatchRow label="eggplant ×3" base="cheese" pieces={[eggplant, eggplant, eggplant]} testId="row-eggplant-cheese" />
        <PatchRow label="eggplant + basil (Melanzane)" base="cheese" pieces={[eggplant, basil, eggplant, basil]} testId="row-eggplant-basil" />
        <PatchRow label="eggplant · thumbnail size" base="sauce" pieces={[eggplant, eggplant, eggplant]} pieceScale={0.58} testId="row-eggplant-small" />
      </Section>


      <Section id="yellow" title="corn 🌽 / pineapple 🍍 / potato 🥔 on cheese">
        <PatchRow label="corn | egg | corn | ham (Bambino)" base="cheese" pieces={[corn, egg, corn, ham]} testId="row-corn" />
        <PatchRow label="pineapple | ham ×2 (Hawaiian)" base="cheese" pieces={[pineapple, ham, pineapple, ham]} testId="row-pineapple" />
        <PatchRow label="potato ×3" base="pesto" pieces={[potato, potato, potato]} testId="row-potato-pesto" />
        <PatchRow label="potato ×3" base="cheese" pieces={[potato, potato, potato]} testId="row-potato-cheese" />
        <PatchRow label="corn | pineapple | potato · thumbnail size" base="cheese" pieces={[corn, pineapple, potato]} pieceScale={0.58} testId="row-yellow-small" />
      </Section>
    </div>
  );
}
