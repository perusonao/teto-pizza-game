/**
 * Appends the preview-only W1 candidate rows to the shared `INGREDIENTS` array *before* any
 * module that snapshots it at load time (e.g. persistence's KNOWN_INGREDIENT_IDS) evaluates.
 * Must be the first import of every visual-gate entry. Production code is not modified.
 *
 * `?seed=all` (the Human Verification hub's links) also writes a fresh save that owns every
 * candidate + comparator into the gate's own isolated key, then drops the param from the URL so
 * a reload keeps the player's progress.
 */
import { INGREDIENTS } from "../../src/data/ingredients";
import { W1_GATE_SAVE_KEY, w1CandidateRows, w1GateSeedSave } from "./candidates";

for (const row of w1CandidateRows()) {
  if (INGREDIENTS.some((existing) => existing.id === row.id)) {
    throw new Error(`W1 visual gate: candidate id "${row.id}" already exists in production data`);
  }
  INGREDIENTS.push(row);
}

const params = new URLSearchParams(window.location.search);
if (params.get("seed") === "all") {
  try {
    localStorage.setItem(W1_GATE_SAVE_KEY, JSON.stringify(w1GateSeedSave()));
  } catch {
    // Private mode / blocked storage: the game still runs on a fresh in-memory save.
  }
  params.delete("seed");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}
