/**
 * Progression 2.0 Phase 3-1 (Issue #192): the runtime identity ("signature") of a completed
 * pizza, for the deterministic discovery matcher in ./matcher.ts.
 *
 * The identity dimensions mirror the Phase-2 design exactly
 * (docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md §2.3, JSON `discoveryRule.signatureDimensions`,
 * `tools/progression2_phase2_progression.py`'s `row_target`/`signature`): an ingredient set that
 * includes the base sauce, plus eleven identity dimensions. Each dimension carries an explicit
 * observation status, so a missing axis is never silently treated as observed:
 *
 * - `OBSERVED`: read from canonical `PizzaState`.
 * - `FIXED_BY_FLOW`: the current making flow can only ever produce one value (e.g. there is one
 *   dough, one sauce layer, no pan, no FOLD/SEAL/FINISH gameplay), so the value is known, not
 *   guessed.
 * - `UNAVAILABLE`: the runtime records something related but has no rule that turns it into this
 *   dimension's value (dough silhouette -> shape class, piece positions -> zones). The value is the
 *   Phase-2 default purely under the Phase-2 observation rule, and ./matcher.ts never lets a
 *   target with a non-default value on such an axis match.
 *
 * Not identity (recorded by the runtime, deliberately excluded): CUT lines, the dough-stretch
 * radii themselves, piece positions/counts, sauce deposit amounts and the bake value. Those are
 * quality/completion inputs (Scoring 2.0, Completion Gate), not "which pizza is this". Phase 2
 * has no cut/serve identity dimension.
 */
import type { PizzaState } from "../../state/pizzaState";
import { sanitizeStringArray, sanitizeToppings } from "../scoringV2/boundary";

export type AxisStatus = "OBSERVED" | "FIXED_BY_FLOW" | "UNAVAILABLE";

export interface SignatureAxis<T> {
  status: AxisStatus;
  value: T;
}

/** [mode, sorted ingredient ids], as in the Phase-2 JSON. */
export type ModedIngredients = readonly [string, readonly string[]];

/** The eleven Phase-2 identity dimensions, same keys and value shapes as the JSON's
 *  `targets[*].identityDimensions`. */
export interface IdentityDimensions {
  dough: string;
  pan: string | null;
  layerOrder: string;
  zones: readonly string[];
  late: readonly ModedIngredients[];
  prep: readonly ModedIngredients[];
  enclosure: string | null;
  shape: string;
  cook: string;
  laminate: boolean;
  spreadLayers: readonly string[] | null;
}

export type IdentityDimensionKey = keyof IdentityDimensions;

export const IDENTITY_DIMENSION_KEYS: readonly IdentityDimensionKey[] = [
  "dough",
  "pan",
  "layerOrder",
  "zones",
  "late",
  "prep",
  "enclosure",
  "shape",
  "cook",
  "laminate",
  "spreadLayers",
];

/** Phase-2 default value of every dimension (the "not required by any capability" value). */
export const DEFAULT_IDENTITY_DIMENSIONS: IdentityDimensions = {
  dough: "standard",
  pan: null,
  layerOrder: "standard",
  zones: [],
  late: [],
  prep: [],
  enclosure: null,
  shape: "round",
  cook: "bake",
  laminate: false,
  spreadLayers: null,
};

/** Capabilities (Phase-1/2 names) whose gameplay the current runtime implements. None of the 11
 *  exists yet, so every target that requires one is unmatchable by construction. */
export const RUNTIME_SUPPORTED_CAPABILITIES: readonly string[] = [];

/**
 * How the current runtime observes each dimension. The value for FIXED_BY_FLOW / UNAVAILABLE is
 * the Phase-2 default; the reason is documentation for reviewers and the result report.
 */
export const RUNTIME_DIMENSION_OBSERVATION: {
  readonly [K in IdentityDimensionKey]: { status: Exclude<AxisStatus, "OBSERVED">; reason: string };
} = {
  dough: { status: "FIXED_BY_FLOW", reason: "one dough style only (no DOUGH_VARIANT)" },
  pan: { status: "FIXED_BY_FLOW", reason: "no pan exists (no PAN_BAKE)" },
  layerOrder: { status: "FIXED_BY_FLOW", reason: "reducer enforces DOUGH -> SAUCE -> CHEESE -> TOPPING" },
  zones: { status: "UNAVAILABLE", reason: "piece positions exist but no zone classification rule" },
  late: { status: "FIXED_BY_FLOW", reason: "FINISH is a reserved step with no gameplay" },
  prep: { status: "FIXED_BY_FLOW", reason: "no prep step exists (no PREP_STEP)" },
  enclosure: { status: "FIXED_BY_FLOW", reason: "FOLD/SEAL are reserved steps with no gameplay" },
  shape: { status: "UNAVAILABLE", reason: "doughShape radii exist but no shape classification rule" },
  cook: { status: "FIXED_BY_FLOW", reason: "BAKE is the only cooking method" },
  laminate: { status: "FIXED_BY_FLOW", reason: "no laminate step exists" },
  spreadLayers: { status: "FIXED_BY_FLOW", reason: "one sauce per pizza (a new sauce replaces the old)" },
};

export interface RuntimeSignature {
  /** Sorted, de-duplicated ids of every sauce and placed piece -- the Phase-2 "ingredientSet
   *  (incl. base sauce)". Order of placement never matters. */
  ingredientSet: SignatureAxis<readonly string[]>;
  /** Sorted sauce/base ids (a subset of `ingredientSet`), kept separately so the base is an
   *  explicit part of the signature rather than just another item. */
  sauceBase: SignatureAxis<readonly string[]>;
  /** Pieces per ingredient id (1 per sauce). **Not identity**: identity is presence-only, as in
   *  Phase 2; how many pieces a recipe needs is the Completion Gate's `minCount` question. */
  ingredientCounts: Readonly<Record<string, number>>;
  dimensions: { readonly [K in IdentityDimensionKey]: SignatureAxis<IdentityDimensions[K]> };
}

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

/**
 * Builds the runtime signature of a pizza from canonical `PizzaState` only. Pure and total:
 * malformed collections are normalized (same boundary helpers Scoring 2.0 uses), never thrown on.
 */
export function signatureOfPizza(pizza: PizzaState): RuntimeSignature {
  const sauceIds = sanitizeStringArray(pizza.sauceIds);
  const pieceIds = sanitizeToppings(pizza.toppings).map((t) => t.ingredientId);

  const counts: Record<string, number> = {};
  for (const id of sortedUnique(sauceIds)) counts[id] = 1;
  for (const id of pieceIds) counts[id] = (counts[id] ?? 0) + 1;

  const dimensions = {} as { [K in IdentityDimensionKey]: SignatureAxis<IdentityDimensions[K]> };
  for (const key of IDENTITY_DIMENSION_KEYS) {
    (dimensions as Record<IdentityDimensionKey, SignatureAxis<unknown>>)[key] = {
      status: RUNTIME_DIMENSION_OBSERVATION[key].status,
      value: DEFAULT_IDENTITY_DIMENSIONS[key],
    };
  }

  return {
    ingredientSet: { status: "OBSERVED", value: sortedUnique([...sauceIds, ...pieceIds]) },
    sauceBase: { status: "OBSERVED", value: sortedUnique(sauceIds) },
    ingredientCounts: counts,
    dimensions,
  };
}
