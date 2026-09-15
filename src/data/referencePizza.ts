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
 */
import { computeSauceMetrics, type SauceDepositLike, type SauceMetrics } from "../logic/sauceField";
import { SAUCE_RATE_PER_TICK } from "../logic/sauceQuantity";

export interface ReferenceSauce {
  ingredientId: string;
  /** Target normalized quantity, 0.0-1.0. Derived from `IDEAL_MARGHERITA_SAUCE_FIXTURE`'s
   *  own computed metrics below -- not an independently chosen number. */
  quantity: number;
  /** Target coverage (fraction of the dough painted), 0.0-1.0. Same derivation as above. */
  coverage: number;
}

export interface ReferencePizza {
  recipeId: "margherita";
  sauce: ReferenceSauce;
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
 * A concrete, literally-paintable tomato-sauce deposit sequence representing "painted well":
 * evenly spread across most of the dough's interior in overlapping concentric passes,
 * leaving the rim bare, at a moderate per-point amount (one dispense tick's worth each --
 * see ../logic/sauceQuantity.ts) exactly as a real hold-and-drag gesture would produce.
 * Exported (not just a private constant) so both the target derivation below and
 * referencePizza.test.ts's reachability test compute metrics from the exact same fixture.
 */
export function buildIdealMargheritaSauceFixture(): SauceDepositLike[] {
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

export const IDEAL_MARGHERITA_SAUCE_FIXTURE: SauceDepositLike[] = buildIdealMargheritaSauceFixture();

/** Metrics of the ideal fixture -- the reference target below is this, rounded to 2 decimals
 *  for a clean, human-readable number in the Reference popover's bars. */
export const IDEAL_MARGHERITA_SAUCE_METRICS: SauceMetrics = computeSauceMetrics(
  IDEAL_MARGHERITA_SAUCE_FIXTURE,
);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const MARGHERITA_REFERENCE: ReferencePizza = {
  recipeId: "margherita",
  sauce: {
    ingredientId: "tomato-sauce",
    quantity: round2(IDEAL_MARGHERITA_SAUCE_METRICS.quantity),
    coverage: round2(IDEAL_MARGHERITA_SAUCE_METRICS.coverage),
  },
};

/** Returns the Reference Pizza for `recipeId`, or null for every recipe but Margherita
 *  (Scope Guard: no other recipe gets a Reference Pizza in this phase). */
export function getReferencePizza(recipeId: string): ReferencePizza | null {
  return recipeId === MARGHERITA_REFERENCE.recipeId ? MARGHERITA_REFERENCE : null;
}
