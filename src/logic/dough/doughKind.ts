/**
 * Dough Kind (Issue #577): which kind of dough a pizza / recipe is made with -- the `dough` identity axis' value.
 *
 * Authority: docs/design/TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md §1. `dough` is independent of the pan (`pan`, ○/□): neither is
 * inferred from the other. Values are the 172-recipe design's vocabulary (`material-multigrain-long-ferment` = Pinsa Romana) and the
 * existing `"standard"`.
 *
 * Where it is used today (read from the code, not a promise): `Recipe.doughKind?` / `LateRecipeEntry.doughKind?` (only the Pinsa late-catalog
 * recipe sets it, behind `PINSA_PRODUCTION`), `PizzaState.dough?` (set by the DOUGH chips / Guided start; the in-progress round's journal
 * in `pendingRound` stores and validates it with `isDoughKind`), the `dough` signature axis, and the Pinsa technique. A kind that is unknown
 * to this build is never trusted: `isDoughKind` is false and `resolveDoughKind` falls back to `"standard"`.
 *
 * Single source of truth (Dough Kind PD-1a): `DOUGH_KINDS` below lists the kinds, `DoughKind` is derived from it and `isDoughKind` reads it.
 * Adding a kind later is one new entry here (plus whatever that kind needs elsewhere); this file does not decide which kinds ship.
 */

/** Every dough kind this build knows, in a fixed order. The one place a kind is declared. */
export const DOUGH_KINDS = ["standard", "material-multigrain-long-ferment"] as const;

export type DoughKind = (typeof DOUGH_KINDS)[number];

/** Every shipped recipe, and what an absent `Recipe.doughKind` / `PizzaState.dough` resolves to. */
export const DEFAULT_DOUGH_KIND: DoughKind = "standard";

export function isDoughKind(value: unknown): value is DoughKind {
  return typeof value === "string" && (DOUGH_KINDS as readonly string[]).includes(value);
}

/** The single place a recipe's dough kind is resolved. Absent or unrecognised -> `"standard"`, never a throw or a guess. */
export function resolveDoughKind(source: object | null | undefined): DoughKind {
  const value = (source as { readonly doughKind?: unknown } | null | undefined)?.doughKind;
  return isDoughKind(value) ? value : DEFAULT_DOUGH_KIND;
}
