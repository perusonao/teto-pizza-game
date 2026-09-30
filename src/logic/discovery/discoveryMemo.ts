/**
 * Original Pizza Recovery P3-2 (Discovery Memo / 発見メモ pure display model): the typed display data a Dex
 * card of an undiscovered, discoverable recipe may one day show, built ONLY from what the player has
 * legitimately bought or already owns.
 *
 * **Pure and UNWIRED.** Nothing in production imports this module (discoveryMemo.gate.test.ts pins that).
 * It returns data, never UI: no React, no CSS, no copy of its own. No DexOverlay, App, RESULT, Trial
 * Notebook, Builder, save or navigation is touched.
 *
 * Authority: docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_DISCOVERY-MEMO_Fresh-Audit.md and its matrix
 * (docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY-MATRIX.json); Owner decisions
 * OD-P3-1..15, D-1 and D-2; Hint 5.0 H5-INV-1..7 (docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md).
 *
 * ## The structure that keeps it private
 *
 * The input is the four fields of the existing Hint 5.0 presentation (`board`, `legacyKnownIngredientIds`,
 * `completeText`, `onboarding`), the Dex card state and the Hint 5.0 flag. That is all. There is **no
 * parameter** for a recipe (object, id, name or description), a matcher result, a P2 feedback, a Trial
 * Notebook row, a candidate set or count, an elimination result, a technique, a catalogue fact, a Pitz
 * balance, a price or a next-rung offer, and the two imports are type-only. So the model cannot obtain what
 * it must never show; it does not "fetch and filter". The boundary gate fails if an import, a runtime
 * dependency or a forbidden token ever appears here.
 *
 * It does not interpret the presentation: it copies the facts the Hint 5.0 authority already decided may be
 * shown (it never parses a free-text line into a fact), and it fails closed on anything malformed.
 *
 * ## Eligibility
 *
 * A memo exists only when the card is `DISCOVERABLE`, the Hint 5.0 flag is on, a presentation exists (the
 * recipe is a ladder target) and it is not the Dex-0 onboarding. Otherwise the result is `null`. The memo is
 * recomputed from the facts every time: a card that leaves DISCOVERABLE shows nothing and, when it returns,
 * shows the same memo again (the ledger is never touched here).
 *
 * ## Rows (typed, in this order)
 *
 * 1. `sauce`, `cheese`, `keyTopping`, `structure`: always present. `UNKNOWN` (a constant: no id, no count) until
 *    the matching rung is bought; `KNOWN` with the ladder's own ingredient ids (or, for structure, the
 *    authority's own line); cheese and keyTopping may be `NONE` (an empty rung that was bought). A sauce is
 *    never `NONE`: an empty sauce rung is reserved and "no sauce" is never said (H5-INV-4).
 * 2. `subToppingFamily`: one per bought SUB_CLASS rung, only when `structure` is KNOWN, in ladder order: an
 *    ordinal and a family view. Never an id, a name, a glyph or an initial, and never a slot for a rung that
 *    is not bought (that would disclose a count).
 * 3. `legacyIngredient`: the exact ingredient names the player already owns from earlier hint versions
 *    (D-2), not already shown above. Free text from Hint 2.0 / 4.0 is never read (D-1).
 * 4. `complete`: the authority's fixed line, only when every fixed row is settled.
 */
import type { Hint5Presentation } from "./hint5Ladder";
import type { RecipeDiscoveryState } from "../../state/recipeDiscoveryState";

/** The four fields of the Hint 5.0 presentation the memo reads, and nothing else. */
export type MemoPresentationSource = Pick<Hint5Presentation, "board" | "legacyKnownIngredientIds" | "completeText" | "onboarding">;

export interface DiscoveryMemoInput {
  /** The Dex card's own discovery state. Only `DISCOVERABLE` has a memo. */
  cardState: RecipeDiscoveryState;
  /** The Hint 5.0 flag (`HINT5_LADDER_ENABLED`). */
  hint5Enabled: boolean;
  /** `hint5Presentation(...)` for this card's own recipe, or `null` when it is not a ladder target. */
  presentation: MemoPresentationSource | null;
}

/** The seven Hint 5.0 sub-topping families (kept equal to `ATTRIBUTE_FAMILIES` by a test). */
export const DISCOVERY_MEMO_FAMILIES: readonly string[] = Object.freeze(["meat", "seafood", "vegetable", "herb", "fruit", "spice", "other"]);

export type MemoNameRowKind = "sauce" | "cheese" | "keyTopping";

export type DiscoveryMemoRow =
  | { kind: MemoNameRowKind; status: "UNKNOWN" }
  | { kind: MemoNameRowKind; status: "KNOWN"; ingredientIds: readonly string[] }
  | { kind: "cheese" | "keyTopping"; status: "NONE" }
  | { kind: "structure"; status: "UNKNOWN" }
  | { kind: "structure"; status: "KNOWN"; lineJa: string }
  | { kind: "subToppingFamily"; ordinal: number; family: string; symbol: string; labelJa: string; lineJa: string }
  | { kind: "legacyIngredient"; ingredientId: string }
  | { kind: "complete"; lineJa: string };

export interface DiscoveryMemo {
  /** Typed rows in a fixed order: the four fixed rows, the families, the earlier-hint names, `complete`. */
  rows: readonly DiscoveryMemoRow[];
  /** `COMPLETE` exactly when a `complete` row is present. */
  completion: "IN_PROGRESS" | "COMPLETE";
  /** True when at least one fact is known (a screen may draw nothing for a card with none). */
  hasKnownFact: boolean;
}

// ---- limits (an over-long list is malformed, never truncated) -------------------------------------------
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_IDS_PER_ROW = 32;
const MAX_SUB_ROWS = 32;
const MAX_LEGACY = 256;
const MAX_TEXT = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TEXT;
}

function idList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max || !value.every(isId)) return null;
  return [...new Set(value)];
}

/** A fixed row whose fact is known (a name, a "none" answer or the structure line). */
function isSettled(row: DiscoveryMemoRow): boolean {
  return "status" in row && row.status !== "UNKNOWN";
}

/** One name rung from its board entry, or `UNKNOWN` when it is absent or malformed (fail closed). */
function nameRow(kind: MemoNameRowKind, entry: Record<string, unknown> | undefined): DiscoveryMemoRow {
  if (!entry) return { kind, status: "UNKNOWN" };
  const ids = idList(entry.ingredientIds, MAX_IDS_PER_ROW);
  if (ids === null) return { kind, status: "UNKNOWN" };
  if (entry.none === true) {
    // "none" is an answer only for cheese and key topping, and only when the rung really has no subject.
    return kind !== "sauce" && ids.length === 0 ? { kind, status: "NONE" } : { kind, status: "UNKNOWN" };
  }
  if (entry.none !== false || ids.length === 0) return { kind, status: "UNKNOWN" };
  return { kind, status: "KNOWN", ingredientIds: ids };
}

/**
 * The memo for one Dex card, or `null` when the card has none. Pure, total and deterministic: it never
 * throws, never reads anything but `input`, and never adds a fact the presentation did not carry.
 */
export function discoveryMemoOf(input: DiscoveryMemoInput): DiscoveryMemo | null {
  if (!isRecord(input)) return null;
  if (input.cardState !== "DISCOVERABLE") return null;
  if (input.hint5Enabled !== true) return null;
  const presentation: unknown = input.presentation;
  if (!isRecord(presentation)) return null;
  if (presentation.onboarding !== false) return null;
  const board = presentation.board;
  const legacy = presentation.legacyKnownIngredientIds;
  const completeText = presentation.completeText;
  if (!Array.isArray(board) || !Array.isArray(legacy)) return null;
  if (completeText !== null && !isText(completeText)) return null;

  // Index the board by rung kind (first entry wins); collect the SUB_CLASS entries.
  const byKind = new Map<string, Record<string, unknown>>();
  const subEntries: Record<string, unknown>[] = [];
  for (const entry of board) {
    if (!isRecord(entry) || typeof entry.kind !== "string") continue;
    if (entry.kind === "SUB_CLASS") subEntries.push(entry);
    else if (!byKind.has(entry.kind)) byKind.set(entry.kind, entry);
  }

  const structureEntry = byKind.get("STRUCTURE");
  const structureKnown = !!structureEntry && isText(structureEntry.lineJa);
  const fixed: DiscoveryMemoRow[] = [
    nameRow("sauce", byKind.get("SAUCE")),
    nameRow("cheese", byKind.get("CHEESE")),
    nameRow("keyTopping", byKind.get("KEY_TOPPING")),
    structureKnown ? { kind: "structure", status: "KNOWN", lineJa: structureEntry!.lineJa as string } : { kind: "structure", status: "UNKNOWN" },
  ];
  const rows: DiscoveryMemoRow[] = [...fixed];

  // Families: only once STRUCTURE is known, only bought rungs, ladder order, one per ordinal.
  if (structureKnown && subEntries.length <= MAX_SUB_ROWS) {
    const seen = new Set<number>();
    for (const entry of subEntries) {
      const view = entry.classView;
      if (!Number.isInteger(entry.ordinal) || (entry.ordinal as number) < 1 || seen.has(entry.ordinal as number)) continue;
      if (!isRecord(view) || typeof view.family !== "string" || !DISCOVERY_MEMO_FAMILIES.includes(view.family)) continue;
      if (!isText(view.symbol) || !isText(view.labelJa) || !isText(view.lineJa)) continue;
      seen.add(entry.ordinal as number);
      rows.push({ kind: "subToppingFamily", ordinal: entry.ordinal as number, family: view.family, symbol: view.symbol, labelJa: view.labelJa, lineJa: view.lineJa });
    }
  }

  // Earlier hints (D-2): exact owned names only, and never a name already shown as a fact above.
  const legacyIds = idList(legacy, MAX_LEGACY);
  if (legacyIds !== null) {
    const shown = new Set(fixed.flatMap((r) => ("ingredientIds" in r ? r.ingredientIds : [])));
    for (const id of legacyIds) if (!shown.has(id)) rows.push({ kind: "legacyIngredient", ingredientId: id });
  }

  // The fixed "complete" line, only when every fixed row is settled (defence in depth).
  const complete = completeText !== null && fixed.every(isSettled);
  if (complete) rows.push({ kind: "complete", lineJa: completeText as string });

  return {
    rows,
    completion: complete ? "COMPLETE" : "IN_PROGRESS",
    hasKnownFact: rows.some((r, i) => i >= fixed.length || isSettled(r)),
  };
}
