/**
 * RT-01 test harness (e2e/Human Verification only -- served by the Vite dev server at
 * /teto-pizza-game/e2e/harness/rt01-reference.html, never part of `vite build`, which only
 * bundles index.html). Renders the real production reference components for:
 *
 * - the 15 shipped recipes, through the same paths production uses: `PizzaThumbnail` (Recipe
 *   Select), `ReferenceThumbnail` at the 48px mini 見本 and 64px sizes, and the 140px popover
 *   mini pizza -- all fed from `getPlayerReferencePizza(recipe)`; and
 * - synthetic, unregistered 8/9/10/12/15-piece recipes built only from already-shipped
 *   ingredients (no new ingredient or recipe is registered anywhere), to show the >8 layout.
 *
 * `?only=<case-id>` renders a single case; `?section=shipped|synthetic` renders one section.
 * `?compare=<case-id>` renders BEFORE (a reproduction of the pre-RT-01 `slot % 8` rule, for the
 * Human Verification video only) above AFTER (the live production function).
 * Entry point: ./rt01-reference.tsx.
 */
import { RECIPES, type Recipe, type RecipeId } from "../../src/data/recipes";
import { getIngredient } from "../../src/data/ingredients";
import { getPlayerReferencePizza, type PlayerPizzaReference } from "../../src/data/playerReference";
import { buildIdealSauceFixture } from "../../src/data/referencePizza";
import { createIdealDoughShape } from "../../src/logic/doughShape";
import { PizzaThumbnail } from "../../src/components/PizzaThumbnail";
import { ReferenceThumbnail } from "../../src/components/ReferenceThumbnail";
import { SauceHeatmapCanvas } from "../../src/components/SauceHeatmapCanvas";
import { buildPieceCountLabels, renderPizzaVisualPieces } from "../../src/components/PizzaVisualPieces";
import { PIECE_RING_POSITIONS } from "../../src/logic/pizzaReferenceLayout";

const IDEAL_DOUGH_SHAPE = createIdealDoughShape();
const IDEAL_SAUCE_FIXTURE = buildIdealSauceFixture();

function synthetic(id: string, nameJa: string, groups: [string, number][]): Recipe {
  const base = RECIPES[0];
  return {
    ...base,
    id: id as RecipeId,
    nameJa,
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      ...groups.map(([ingredientId, minCount]) => ({ ingredientId, minCount })),
    ],
  };
}

const meatLovers = RECIPES.find((r) => r.id === "meat-lovers")!;
const SYNTHETIC_CASES: { id: string; recipe: Recipe; note: string }[] = [
  { id: "p8", recipe: meatLovers, note: "8 pieces -- shipped Meat Lovers (must be unchanged)" },
  {
    id: "p9",
    recipe: synthetic("rt01-synthetic-9", "9ピース（試験用）", [["mozzarella", 2], ["mushroom", 3], ["parmigiano", 2], ["basil", 2]]),
    note: "9 pieces -- Parmigiana-shaped (eggplant stood in by mushroom)",
  },
  {
    id: "p10",
    recipe: synthetic("rt01-synthetic-10", "10ピース（試験用）", [["mozzarella", 2], ["ham", 3], ["egg", 1], ["onion", 2], ["black-olive", 2]]),
    note: "10 pieces -- Pizza Portuguesa composition (all shipped ingredients)",
  },
  {
    id: "p12",
    recipe: synthetic("rt01-synthetic-12", "12ピース（試験用）", [["mozzarella", 2], ["mushroom", 3], ["ham", 2], ["black-olive", 2], ["onion", 2], ["basil", 1]]),
    note: "12 pieces -- synthetic",
  },
  {
    id: "p15",
    recipe: synthetic("rt01-synthetic-15", "15ピース（試験用）", [["mozzarella", 2], ["pepperoni", 3], ["mushroom", 2], ["onion", 2], ["black-olive", 2], ["bacon", 2], ["basil", 2]]),
    note: "15 pieces -- 7 types (Supreme-sized, capacity estimate max)",
  },
];

function PopoverPizza({ reference }: { reference: PlayerPizzaReference }) {
  const sauce = reference.sauceIngredientId ? getIngredient(reference.sauceIngredientId) : null;
  return (
    <div className="player-reference-mini-pizza" data-testid="popover-pizza" aria-hidden="true">
      {sauce && (
        <SauceHeatmapCanvas
          deposits={IDEAL_SAUCE_FIXTURE}
          doughShape={IDEAL_DOUGH_SHAPE}
          color={sauce.color}
          className={`player-reference-mini-pizza__sauce ${sauce.id === "olive-oil" ? "pizza-sauce-heatmap--oil" : ""}`}
        />
      )}
      {renderPizzaVisualPieces({
        pieceGroups: reference.pieceGroups,
        wrapperClassName: () => "player-reference-mini-pizza__piece",
      })}
    </div>
  );
}

function CaseRow({ caseId, recipe, note }: { caseId: string; recipe: Recipe; note: string }) {
  const reference = getPlayerReferencePizza(recipe);
  const total = reference.pieceGroups.reduce((sum, g) => sum + g.positions.length, 0);
  return (
    <section className="rt01-case" data-case={caseId} data-total={total}>
      <h2 className="rt01-case__title">
        {recipe.nameJa} <span className="rt01-case__count">{total}ピース</span>
      </h2>
      <p className="rt01-case__note">{note}</p>
      <p className="rt01-case__caption">{buildPieceCountLabels(reference.pieceGroups).join("、")}</p>
      <div className="rt01-case__views">
        <div className="rt01-view" data-view="popover-140">
          <PopoverPizza reference={reference} />
          <span>見本 140px</span>
        </div>
        <div className="rt01-view" data-view="thumb-64">
          <ReferenceThumbnail sauceIngredientId={reference.sauceIngredientId} pieceGroups={reference.pieceGroups} />
          <span>64px</span>
        </div>
        <div className="rt01-view" data-view="mini-48">
          <span className="mini-reference__thumb">
            <ReferenceThumbnail sauceIngredientId={reference.sauceIngredientId} pieceGroups={reference.pieceGroups} />
          </span>
          <span>ミニ見本 48px</span>
        </div>
        <div className="rt01-view pizza-select-grid-card" data-view="select-card">
          <PizzaThumbnail recipe={recipe} />
          <span>レシピ選択</span>
        </div>
      </div>
    </section>
  );
}

/** Pre-RT-01 `getPlayerReferencePizza` placement rule, reproduced verbatim for the BEFORE side
 *  of the comparison (consecutive slots, `PIECE_RING_POSITIONS[slot % 8]`). */
function legacyReference(recipe: Recipe): PlayerPizzaReference {
  const live = getPlayerReferencePizza(recipe);
  let slot = 0;
  return {
    ...live,
    pieceGroups: live.pieceGroups.map((group) => ({
      ingredientId: group.ingredientId,
      positions: group.positions.map(() => {
        const p = PIECE_RING_POSITIONS[slot % PIECE_RING_POSITIONS.length];
        slot += 1;
        return { x: p.x, y: p.y };
      }),
    })),
  };
}

function visibleSpots(reference: PlayerPizzaReference): number {
  return new Set(reference.pieceGroups.flatMap((g) => g.positions.map((p) => `${p.x},${p.y}`))).size;
}

function CompareBlock({ label, reference, tone }: { label: string; reference: PlayerPizzaReference; tone: string }) {
  const total = reference.pieceGroups.reduce((sum, g) => sum + g.positions.length, 0);
  const spots = visibleSpots(reference);
  return (
    <div className={`rt01-compare rt01-compare--${tone}`} data-compare={tone} data-total={total} data-visible={spots}>
      <p className="rt01-compare__label">
        {label}：{total}個中 <b>{spots}か所</b>に表示{spots < total ? `（${total - spots}個が重なって見えない）` : "（重なりなし）"}
      </p>
      <div className="rt01-case__views">
        <div className="rt01-view" data-view="popover-140">
          <PopoverPizza reference={reference} />
          <span>見本 140px</span>
        </div>
        <div className="rt01-view" data-view="thumb-64">
          <ReferenceThumbnail sauceIngredientId={reference.sauceIngredientId} pieceGroups={reference.pieceGroups} />
          <span>64px</span>
        </div>
        <div className="rt01-view" data-view="mini-48">
          <span className="mini-reference__thumb">
            <ReferenceThumbnail sauceIngredientId={reference.sauceIngredientId} pieceGroups={reference.pieceGroups} />
          </span>
          <span>ミニ見本 48px</span>
        </div>
      </div>
    </div>
  );
}

function Compare({ caseId }: { caseId: string }) {
  const c = SYNTHETIC_CASES.find((x) => x.id === caseId);
  if (!c) return <p>unknown case {caseId}</p>;
  const after = getPlayerReferencePizza(c.recipe);
  return (
    <main className="rt01-harness" data-compare-case={caseId}>
      <h1>
        {c.recipe.nameJa}　<span className="rt01-case__count">BEFORE / AFTER</span>
      </h1>
      <p className="rt01-case__note">{c.note}</p>
      <p className="rt01-case__caption">{buildPieceCountLabels(after.pieceGroups).join("、")}</p>
      <CompareBlock label="BEFORE（旧: slot % 8）" reference={legacyReference(c.recipe)} tone="before" />
      <CompareBlock label="AFTER（RT-01b）" reference={after} tone="after" />
    </main>
  );
}

export function Harness() {
  const params = new URLSearchParams(window.location.search);
  const only = params.get("only");
  const compare = params.get("compare");
  if (compare) return <Compare caseId={compare} />;
  const section = params.get("section");
  const shipped = RECIPES.map((recipe) => ({ id: recipe.id, recipe, note: "shipped recipe (player reference path)" }));
  const cases = [...(section !== "synthetic" ? shipped : []), ...(section !== "shipped" ? SYNTHETIC_CASES : [])].filter(
    (c) => !only || c.id === only,
  );
  return (
    <main className="rt01-harness">
      <h1>RT-01 見本配置ハーネス</h1>
      {cases.map((c) => (
        <CaseRow key={c.id} caseId={c.id} recipe={c.recipe} note={c.note} />
      ))}
    </main>
  );
}

