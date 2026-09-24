/**
 * Appends the preview-only W1 candidate rows to the shared `INGREDIENTS` array *before* any
 * module that snapshots it at load time (e.g. persistence's KNOWN_INGREDIENT_IDS) evaluates.
 * Must be the first import of every visual-gate entry. Production code is not modified.
 */
import { INGREDIENTS } from "../../src/data/ingredients";
import { clamVariantFromLocation, w1CandidateRows } from "./candidates";

for (const row of w1CandidateRows(clamVariantFromLocation(window.location.search))) {
  if (INGREDIENTS.some((existing) => existing.id === row.id)) {
    throw new Error(`W1 visual gate: candidate id "${row.id}" already exists in production data`);
  }
  INGREDIENTS.push(row);
}
