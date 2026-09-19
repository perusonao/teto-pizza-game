/**
 * Phase 4A-1A (Post-Codex-Fix): Reference Pizza data.
 *
 * Prototype target is Margherita's tomato sauce only (Mozzarella/Basil reference matching
 * are explicitly deferred to Phase 4A-1B -- see the Phase 4A-1A result report's Scope
 * Guard section).
 *
 * IMPORTANT -- these are NOT real-world quantities. The PIZZA DB backing this game has no
 * quantity evidence for any ingredient (no grams/ml, no volume), so `quantity`/`coverage`
 * below are internal, normalized [0, 1] game-balance targets in the same unit as
 * `SauceMetrics` (../logic/sauceField.ts) and `SAUCE_MAX_QUANTITY` (../logic/sauceQuantity.ts)
 * -- chosen purely so the Reference UI and shadow scoring have something to compare the
 * player's sauce against. Never add a grams/ml field here, and never register one of these
 * numbers as a "canonical fact" about the dish.
 *
 * Codex Broad Review MUST FIX 6 (Reachable Reference): picking `quantity`/`coverage` as two
 * independent round numbers risked describing a combination the field model can't actually
 * produce together (`computeSauceMetrics`'s quantity and coverage are related, not free
 * variables). Instead, `IDEAL_MARGHERITA_SAUCE_FIXTURE` below is a concrete, literally
 * paintable deposit sequence -- concentric rings covering the dough evenly while leaving a
 * bare rim margin, exactly the "spread it edge to edge, not to the crust" description the
 * Reference popover shows -- and the target is *derived* from that fixture's own computed
 * metrics, not the other way around. Reachability is therefore true by construction: see
 * referencePizza.test.ts's "Reference fixture -> target within tolerance -> high shadow
 * similarity" test, which would fail immediately if this ever drifted out of sync (e.g. a
 * future sauceField.ts tuning change).
 *
 * B2 (see docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md): the types below
 * (`ReferencePizza.recipeId`, `ReferencePieceGroup.ingredientId`) are widened past
 * Margherita-only so other recipes' Reference data can use this same shape, and the ideal
 * sauce fixture is exposed as a generic, ingredient-agnostic builder
 * (`buildIdealSauceFixture`/`computeMechanicalSauceReference`) reusable for any recipe's sauce
 * target. Coverage itself (`getReferencePizza`) is now all 7 recipes (PART A + PART C1 +
 * PART C2) -- see that function's own doc comment for the review trail behind each entry.
 */
import { computeSauceMetrics, type SauceDepositLike, type SauceMetrics } from "../logic/sauceField";
import { SAUCE_RATE_PER_TICK } from "../logic/sauceQuantity";
import type { RecipeId } from "./recipes";
import { getRecipeSauceProfile } from "./recipeSauceProfiles";

export type InteractionFamily =
  | "SPREAD"
  | "HOLD_SCATTER"
  | "TAP_PLACE"
  | "SPRINKLE"
  | "DRIZZLE"
  | "SPECIAL"
  | "NON_INTERACTIVE";

export interface ReferencePieceGroup {
  /** Any topping ingredient id (not just Margherita's mozzarella/basil) -- B2 (Scoring 2.0
   *  Reference coverage, see docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md)
   *  widened this from a Margherita-only union so future recipes' reviewed piece groups can
   *  use this same type without another type-level change. Widening this field alone adds no
   *  new Reference data -- see that report for exactly what a real 6-recipe entry still needs
   *  (reviewed positions/tolerance radii), which this type change does not provide. */
  ingredientId: string;
  positions: readonly { x: number; y: number }[];
  interaction: {
    family: "TAP_PLACE";
    primaryInput: "DRAG_FROM_TRAY";
    fallbackInput: "TAP_ON_PIZZA";
    landingStyle: "HEAVY_SQUASH" | "LIGHT_LEAF";
  };
  matching: {
    fullCreditRadius: number;
    zeroCreditRadius: number;
  };
}

export interface ReferenceSauce {
  ingredientId: string;
  /** Target normalized quantity, 0.0-1.0. Derived from `IDEAL_MARGHERITA_SAUCE_FIXTURE`'s
   *  own computed metrics below -- not an independently chosen number. */
  quantity: number;
  /** Target coverage (fraction of the dough painted), 0.0-1.0. Same derivation as above. */
  coverage: number;
}

export interface ReferencePizza {
  /** Widened from a Margherita-only literal to `RecipeId` (B2, see the Reference-coverage
   *  report cited above) -- a type-level prerequisite for adding other recipes' References,
   *  not itself new Reference data. */
  recipeId: RecipeId;
  sauce: ReferenceSauce;
  /** Phase 4A-1B game-authored prototype layout; never a PIZZA DB quantity claim. */
  pieceGroups: readonly ReferencePieceGroup[];
}

/** Concentric rings (radius, point count) the fixture paints along, staying inside the
 *  dough (radius 48) with a bare rim margin -- matching the Reference popover's own caption
 *  ("生地全体にまんべんなく、ふちを少し残して塗る"). Point counts are chosen so consecutive
 *  deposits (on a ring, and between adjacent rings) sit close enough for their brush
 *  falloff to overlap, the same way a real slow, deliberate hold-and-drag coat would --
 *  a single thin spiral pass, by contrast, leaves gaps between its own loops no real
 *  "painted the whole thing" gesture would. */
const FIXTURE_RINGS: ReadonlyArray<{ radius: number; count: number }> = [
  { radius: 6, count: 4 },
  { radius: 16, count: 9 },
  { radius: 26, count: 14 },
  { radius: 36, count: 19 },
];

/**
 * A concrete, literally-paintable deposit sequence representing "painted well": evenly spread
 * across most of the dough's interior in overlapping concentric passes, leaving the rim bare,
 * at a moderate per-point amount (one dispense tick's worth each -- see
 * ../logic/sauceQuantity.ts) exactly as a real hold-and-drag gesture would produce.
 *
 * B2 (Scoring 2.0 Reference coverage): this geometry was always ingredient-agnostic -- it
 * never referenced tomato sauce specifically, only dough-space coordinates and a generic
 * per-tick amount -- so it is renamed/exposed here as the general-purpose builder. "Painted
 * evenly, rim left bare" is the same physical quality standard regardless of which sauce
 * ingredient a recipe uses (see ../logic/scoringV2/sauceComponent.ts, which never reads
 * `ingredientId` when comparing metrics), so reusing this one fixture's geometry for every
 * sauce-based recipe is a mechanical derivation, not a fabricated per-recipe number -- see
 * `computeMechanicalSauceReference` below and
 * docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md.
 */
export function buildIdealSauceFixture(): SauceDepositLike[] {
  const deposits: SauceDepositLike[] = [];
  for (const { radius, count } of FIXTURE_RINGS) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      deposits.push({
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        amount: SAUCE_RATE_PER_TICK,
      });
    }
  }
  return deposits;
}

/** Preserved name/signature for existing callers (referencePizza.test.ts's reachability
 *  suite) -- Margherita's fixture was never actually Margherita-specific geometry, so this is
 *  now a thin, byte-identical alias of the general builder above rather than a duplicate. */
export function buildIdealMargheritaSauceFixture(): SauceDepositLike[] {
  return buildIdealSauceFixture();
}

export const IDEAL_MARGHERITA_SAUCE_FIXTURE: SauceDepositLike[] = buildIdealMargheritaSauceFixture();

/** Metrics of the ideal fixture -- the reference target below is this, rounded to 2 decimals
 *  for a clean, human-readable number in the Reference popover's bars. */
export const IDEAL_MARGHERITA_SAUCE_METRICS: SauceMetrics = computeSauceMetrics(
  IDEAL_MARGHERITA_SAUCE_FIXTURE,
);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * B2: mechanically derives a `ReferenceSauce` target for any recipe from its own
 * `RecipeSauceProfile` (../data/recipeSauceProfiles.ts) and the shared ideal-fixture geometry
 * above -- the exact same derivation Margherita's own `sauce` field already uses (see
 * `MARGHERITA_REFERENCE` below, which is defined in terms of this same fixture's metrics).
 * This produces a real, reachable, non-fabricated sauce target for every one of the 7 recipes
 * today -- it does NOT by itself make `getReferencePizza` return non-null for a recipe, since
 * a `ReferencePizza` also needs its `pieceGroups`, which this function does not and cannot
 * provide (see the file-level Scope Guard and the B2 report for exactly why). Exported so a
 * future authoring pass can read off ready-to-use sauce numbers without recomputing them by
 * hand, and so this file's own tests can prove the derivation is consistent across recipes.
 */
export function computeMechanicalSauceReference(recipeId: RecipeId): ReferenceSauce {
  const profile = getRecipeSauceProfile(recipeId);
  return {
    ingredientId: profile.ingredientId,
    quantity: round2(IDEAL_MARGHERITA_SAUCE_METRICS.quantity),
    coverage: round2(IDEAL_MARGHERITA_SAUCE_METRICS.coverage),
  };
}

export const MARGHERITA_REFERENCE: ReferencePizza = {
  recipeId: "margherita",
  // Byte-identical to the previous hand-written literal ({ tomato-sauce, 0.92, 0.72 }) --
  // now expressed via the shared mechanical derivation so it can never silently drift from
  // what `computeMechanicalSauceReference` produces for every other recipe.
  sauce: computeMechanicalSauceReference("margherita"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 35, y: 35 },
        { x: 65, y: 36 },
        { x: 50, y: 66 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "basil",
      positions: [
        { x: 31, y: 62 },
        { x: 69, y: 62 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "LIGHT_LEAF",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

/**
 * B2 PART A (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md section 10): reviewed
 * and ChatGPT-approved piece geometry for marinara (garlic x3, oregano x2). Positions/tolerance
 * are exactly the candidate proposed in that report's section 9.2 -- unchanged by
 * implementation, per the review process this project uses (design proposal -> human/ChatGPT
 * review -> implement the approved numbers verbatim, never re-derive or "improve" them at
 * implementation time).
 */
export const MARINARA_REFERENCE: ReferencePizza = {
  recipeId: "marinara",
  sauce: computeMechanicalSauceReference("marinara"),
  pieceGroups: [
    {
      ingredientId: "garlic",
      positions: [
        { x: 33, y: 41 },
        { x: 69, y: 43 },
        { x: 50, y: 68 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "oregano",
      positions: [
        { x: 38, y: 63 },
        { x: 64, y: 60 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "LIGHT_LEAF",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

/**
 * B2 PART A: reviewed and ChatGPT-approved piece geometry for funghi (mozzarella x2,
 * mushroom x3). Positions/tolerance are exactly the candidate proposed in the B2 report's
 * section 9.3.
 */
export const FUNGHI_REFERENCE: ReferencePizza = {
  recipeId: "funghi",
  sauce: computeMechanicalSauceReference("funghi"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 36, y: 38 },
        { x: 66, y: 40 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "mushroom",
      positions: [
        { x: 50, y: 30 },
        { x: 30, y: 62 },
        { x: 70, y: 64 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

/**
 * B2 PART C1 (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md section 12): reviewed
 * and ChatGPT-approved piece geometry for genovese (mozzarella x2, cherry-tomato x3). Positions
 * are the interleaved-ring layout proposed in the report's section 11.1 -- deliberately not a
 * Margherita/Funghi two-cluster reskin (see that section's rationale) -- implemented verbatim.
 */
export const GENOVESE_REFERENCE: ReferencePizza = {
  recipeId: "genovese",
  sauce: computeMechanicalSauceReference("genovese"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 33, y: 42 },
        { x: 59, y: 65 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "cherry-tomato",
      positions: [
        { x: 48, y: 32 },
        { x: 40, y: 70 },
        { x: 70, y: 47 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

/**
 * B2 PART C1: reviewed and ChatGPT-approved piece geometry for fugazza (onion x4, oregano x1).
 * Positions are exactly the candidate proposed in the report's section 11.2; the 8/22 tolerance
 * was explicitly reconsidered there (onion has no dedicated rendered-size treatment in
 * ingredients.ts/IngredientPieceVisual) and approved for this recipe specifically -- not a
 * universal rule for every future ingredient (see that section and section 13.4's own caveat).
 */
export const FUGAZZA_REFERENCE: ReferencePizza = {
  recipeId: "fugazza",
  sauce: computeMechanicalSauceReference("fugazza"),
  pieceGroups: [
    {
      ingredientId: "onion",
      positions: [
        { x: 30, y: 36 },
        { x: 69, y: 35 },
        { x: 33, y: 67 },
        { x: 67, y: 63 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "oregano",
      positions: [{ x: 51, y: 46 }],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "LIGHT_LEAF",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

/**
 * B2 PART C2 (docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md section 13.1):
 * reviewed and ChatGPT-approved piece geometry for bismarck (mozzarella x3, egg x1).
 * Mozzarella reuses the standard 8/22 tolerance (identical physical piece as every other
 * recipe's mozzarella); egg uses a deliberately wider 14/30 -- not derived from any rendered
 * size difference (egg has none -- it renders through the same generic emoji path as every
 * other topping), but from a semantic argument specific to a single, centered hero piece with
 * no quantity/placement pattern to read. See section 13.1 for the full rationale; this does
 * not establish 14/30 (or 8/22) as a rule for any future single-piece group.
 */
export const BISMARCK_REFERENCE: ReferencePizza = {
  recipeId: "bismarck",
  sauce: computeMechanicalSauceReference("bismarck"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 31, y: 32 },
        { x: 70, y: 34 },
        { x: 48, y: 72 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "egg",
      positions: [{ x: 50, y: 50 }],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 14, zeroCreditRadius: 30 },
    },
  ],
};

/**
 * B2 PART C2: reviewed and ChatGPT-approved piece geometry for quattro-formaggi (mozzarella x2,
 * gorgonzola x2, parmigiano x2, fontina x2). Two concentric rings -- mozzarella/gorgonzola
 * inner, parmigiano/fontina outer, each pair diametrically opposite within its own ring --
 * deliberately not a rigid quadrant split (see section 13.2). All four groups use the standard
 * 8/22 tolerance: each cheese's own `.pizza-cheese--<id>` shape is a similarly small physical
 * size to mozzarella's baseline, none egg-sized, so none has bismarck's kind of justification
 * to diverge.
 */
export const QUATTRO_FORMAGGI_REFERENCE: ReferencePizza = {
  recipeId: "quattro-formaggi",
  sauce: computeMechanicalSauceReference("quattro-formaggi"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 53, y: 33 },
        { x: 47, y: 67 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "gorgonzola",
      positions: [
        { x: 33, y: 47 },
        { x: 67, y: 53 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "parmigiano",
      positions: [
        { x: 72, y: 35 },
        { x: 28, y: 65 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "fontina",
      positions: [
        { x: 35, y: 28 },
        { x: 65, y: 72 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

/**
 * Recipe Expansion Batch 1A (see docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md):
 * Scoring 2.0 Reference fixtures for the 4 new recipes -- without one of these,
 * `computeScoringV2` (../logic/scoringV2/index.ts) returns `available: false` for that recipe
 * and BAKE/RESULT can never produce a real score, so this is required production data, not an
 * optional polish pass. No external review process (ChatGPT/human) was run for Batch 1A the
 * way B2's PART A/C1/C2 entries above were -- positions below are authored directly against
 * the same visual-balance criteria those entries already established (evenly spread within the
 * dough's radius-48 interior, no two pieces of one group colliding, standard 8/22 full/zero
 * credit tolerance for every group since none of these ingredients has an established physical
 * size difference from mozzarella/mushroom/onion -- the same generic emoji-chip rendering as
 * every other topping, see ../components/IngredientPieceVisual.tsx). `HEAVY_SQUASH` landing
 * style for every meat/fish group (matching mushroom/onion/garlic/cherry-tomato/egg's own
 * chunky-piece treatment); `oregano`'s existing `LIGHT_LEAF` treatment (from `FUGAZZA_REFERENCE`
 * above) is reused unchanged for napoletana's own oregano group.
 */
export const SALSICCIA_REFERENCE: ReferencePizza = {
  recipeId: "salsiccia",
  sauce: computeMechanicalSauceReference("salsiccia"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 35, y: 35 },
        { x: 65, y: 65 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "sausage",
      positions: [
        { x: 50, y: 28 },
        { x: 30, y: 60 },
        { x: 70, y: 62 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

export const PEPPERONI_REFERENCE: ReferencePizza = {
  recipeId: "pepperoni",
  sauce: computeMechanicalSauceReference("pepperoni"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 50, y: 35 },
        { x: 50, y: 65 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "pepperoni",
      positions: [
        { x: 30, y: 32 },
        { x: 70, y: 32 },
        { x: 30, y: 68 },
        { x: 70, y: 68 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

export const NAPOLETANA_REFERENCE: ReferencePizza = {
  recipeId: "napoletana",
  sauce: computeMechanicalSauceReference("napoletana"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 36, y: 38 },
        { x: 66, y: 40 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "anchovy",
      positions: [
        { x: 50, y: 30 },
        { x: 32, y: 62 },
        { x: 68, y: 64 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "oregano",
      positions: [{ x: 50, y: 50 }],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "LIGHT_LEAF",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

export const TONNO_E_CIPOLLA_REFERENCE: ReferencePizza = {
  recipeId: "tonno-e-cipolla",
  sauce: computeMechanicalSauceReference("tonno-e-cipolla"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 33, y: 40 },
        { x: 63, y: 38 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "onion",
      positions: [
        { x: 38, y: 66 },
        { x: 62, y: 66 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "tuna",
      positions: [
        { x: 50, y: 26 },
        { x: 30, y: 52 },
        { x: 70, y: 52 },
      ],
      interaction: {
        family: "TAP_PLACE",
        primaryInput: "DRAG_FROM_TRAY",
        fallbackInput: "TAP_ON_PIZZA",
        landingStyle: "HEAVY_SQUASH",
      },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
  ],
};

const REFERENCE_PIZZAS: ReadonlyMap<RecipeId, ReferencePizza> = new Map([
  [MARGHERITA_REFERENCE.recipeId, MARGHERITA_REFERENCE],
  [MARINARA_REFERENCE.recipeId, MARINARA_REFERENCE],
  [FUNGHI_REFERENCE.recipeId, FUNGHI_REFERENCE],
  [GENOVESE_REFERENCE.recipeId, GENOVESE_REFERENCE],
  [FUGAZZA_REFERENCE.recipeId, FUGAZZA_REFERENCE],
  [BISMARCK_REFERENCE.recipeId, BISMARCK_REFERENCE],
  [QUATTRO_FORMAGGI_REFERENCE.recipeId, QUATTRO_FORMAGGI_REFERENCE],
  [SALSICCIA_REFERENCE.recipeId, SALSICCIA_REFERENCE],
  [PEPPERONI_REFERENCE.recipeId, PEPPERONI_REFERENCE],
  [NAPOLETANA_REFERENCE.recipeId, NAPOLETANA_REFERENCE],
  [TONNO_E_CIPOLLA_REFERENCE.recipeId, TONNO_E_CIPOLLA_REFERENCE],
]);

/**
 * Returns the Reference Pizza for `recipeId`, or null for an unrecognized id.
 *
 * B2 PART C2 (see docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md section 14):
 * coverage is now all 7 recipes -- every entry's `pieceGroups` is the exact geometry that
 * report proposed (sections 9/11/13) and ChatGPT's review approved for that recipe
 * specifically, never a fabricated stand-in. Bismarck's `egg` group is the one deliberate
 * departure from the otherwise-universal 8/22 tolerance (14/30, section 13.1) -- that is a
 * one-off, recipe-specific judgment call, not a new default for any future single-piece group.
 */
export function getReferencePizza(recipeId: string): ReferencePizza | null {
  return REFERENCE_PIZZAS.get(recipeId as RecipeId) ?? null;
}
