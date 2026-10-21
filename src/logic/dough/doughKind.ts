/**
 * Dough Kind P1 (Issue #577): which kind of dough a pizza / recipe is made with -- the `dough` identity axis' value.
 *
 * Authority: docs/design/TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md §1 (Owner-approved P1). `dough` is independent of the
 * pan (`pan`, ○/□): neither is inferred from the other. Values are the 172-recipe design's vocabulary
 * (`material-multigrain-long-ferment` = Pinsa Romana) and the existing `"standard"`. Never persisted.
 *
 * Inert in Production: no `RECIPES` entry sets `doughKind` and nothing sets `PizzaState.dough` yet (pinned by test);
 * the chip UI is P2 and the first recipe is P3 (HOLD until the original source is checked).
 */

export type DoughKind = "standard" | "material-multigrain-long-ferment";

export const DOUGH_KINDS: readonly DoughKind[] = ["standard", "material-multigrain-long-ferment"];

/** Every shipped recipe, and what an absent `Recipe.doughKind` / `PizzaState.dough` resolves to. */
export const DEFAULT_DOUGH_KIND: DoughKind = "standard";

export function isDoughKind(value: unknown): value is DoughKind {
  return value === "standard" || value === "material-multigrain-long-ferment";
}

/** The single place a recipe's dough kind is resolved. Absent or unrecognised -> `"standard"`, never a throw or a guess. */
export function resolveDoughKind(source: object | null | undefined): DoughKind {
  const value = (source as { readonly doughKind?: unknown } | null | undefined)?.doughKind;
  return isDoughKind(value) ? value : DEFAULT_DOUGH_KIND;
}
