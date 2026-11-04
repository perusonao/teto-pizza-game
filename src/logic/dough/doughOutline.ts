/**
 * Pinsa Romana (#577): the outline a dough kind is DRAWN with. The source's pinsa is an oval; the game keeps every rule of the round pizza (the sauce field, placement
 * validity, scoring, the Reference) in the one circular dough-percent space and draws that space in a dough box that is wider than it is tall. A circle of radius
 * `DOUGH_RADIUS` percent of a `W x W/OVAL_DOUGH_ASPECT` box IS an ellipse on screen, and the pointer math (`clientPointToDoughPercent`) already normalises each axis by the
 * box's own width / height, so a finger on the oval's rim is on the logical rim and nothing outside the oval is placeable. Round and square pizzas are untouched.
 *
 * Authority: Owner decision (2026-10-26): the Pinsa dough is oval, as a release condition; no CUT for Pinsa (unchanged).
 */
import { isDoughKind, resolveDoughKind, type DoughKind } from "./doughKind";

/** Width : height of the oval dough's box. CSS (`App.css`, `.pizza-dough--oval`) repeats it as `aspect-ratio: 3 / 2` -- pinned equal by doughOutline.test.ts. */
export const OVAL_DOUGH_ASPECT = 3 / 2;

export type DoughOutline = "round" | "oval";

/** The dough kinds drawn as an oval. */
const OVAL_DOUGH_KINDS: readonly DoughKind[] = ["material-multigrain-long-ferment"];

/**
 * The outline of a pizza's dough: the dough the player chose (`PizzaState.dough`), else the dough the recipe fixes (`Recipe.doughKind`); absent or unknown = standard = round.
 * Independent of the pan: the caller keeps a square tray square.
 */
export function doughOutlineOf(
  pizza: { readonly dough?: unknown } | null | undefined,
  recipe?: { readonly doughKind?: unknown } | null,
): DoughOutline {
  const chosen = pizza?.dough;
  const kind = isDoughKind(chosen) ? chosen : resolveDoughKind(recipe);
  return OVAL_DOUGH_KINDS.includes(kind) ? "oval" : "round";
}
