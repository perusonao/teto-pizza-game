/**
 * Progression 2.0 Phase 3-1 (Issue #192): pure, deterministic matcher between a runtime
 * signature (./signature.ts) and discovery targets.
 *
 * Rules (Phase-2 design §2.3, JSON `discoveryRule`):
 *
 * 1. **Exact match, never ingredients-only.** The ingredient set (base sauce included) must be
 *    equal -- a superset or subset is an original pizza -- AND every identity dimension must
 *    agree. There is no fallback that compares ingredients alone.
 * 2. **Unsupported mechanic -> no match.** A target that requires a capability the runtime does
 *    not implement is never a candidate, whatever its dimensions say.
 * 3. **Observation rule.** On an `UNAVAILABLE` axis the Phase-2 default is assumed, so only a
 *    target whose value there IS the default can match (and the assumption is reported in
 *    `assumedDimensions`). A target that needs a non-default value on an axis the runtime cannot
 *    observe is never matched.
 * 4. **Blocked rows never auto-discover.** Non-ELIGIBLE targets are still compared. If one shares
 *    the exact signature with an eligible target, the identity is not settled, so the result is
 *    AMBIGUOUS, not a discovery.
 * 5. **0 / 1 / many.** NO_MATCH (an original pizza, a normal outcome), UNIQUE_MATCH, or AMBIGUOUS.
 *    Candidate ids are always sorted, so the result never depends on catalog order.
 */
import type { RecipeId } from "../../data/recipes";
import {
  DEFAULT_IDENTITY_DIMENSIONS,
  IDENTITY_DIMENSION_KEYS,
  RUNTIME_SUPPORTED_CAPABILITIES,
  type IdentityDimensionKey,
  type IdentityDimensions,
  type RuntimeSignature,
} from "./signature";

export type TargetEligibility =
  | { status: "ELIGIBLE" }
  /** Evidence-blocked, product-decision-blocked, mechanic-interpretation-blocked or
   *  discovery-rule-blocked (Phase-2 classification). Never auto-discovered. */
  | { status: "BLOCKED"; reason: string };

export interface DiscoveryTarget {
  targetId: string;
  /** Sorted identity items, base sauce included (Phase-2 `items`). */
  items: readonly string[];
  /** Required capabilities (Phase-2 `capabilities`). */
  capabilities: readonly string[];
  identityDimensions: IdentityDimensions;
  eligibility: TargetEligibility;
}

/** A target that maps to a production recipe, so a match can be written to the Dex. */
export interface RecipeDiscoveryTarget extends DiscoveryTarget {
  recipeId: RecipeId;
}

export type DiscoveryMatch<T extends DiscoveryTarget = DiscoveryTarget> =
  | { kind: "NO_MATCH"; blockedTargetIds: readonly string[] }
  | { kind: "UNIQUE_MATCH"; target: T; assumedDimensions: readonly IdentityDimensionKey[] }
  | { kind: "AMBIGUOUS"; targetIds: readonly string[] };

export interface MatchOptions {
  supportedCapabilities?: readonly string[];
}

function sameStringList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Dimension values are JSON-shaped (strings, null, booleans, nested arrays). Comparing their
 *  canonical JSON is exact for these shapes; both sides are built in sorted form. */
function sameDimensionValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Returns the dimensions matched only by assumption, or null when the target cannot match. */
function compareDimensions(
  signature: RuntimeSignature,
  target: DiscoveryTarget,
): IdentityDimensionKey[] | null {
  const assumed: IdentityDimensionKey[] = [];
  for (const key of IDENTITY_DIMENSION_KEYS) {
    const axis = signature.dimensions[key];
    const targetValue = target.identityDimensions[key];
    if (axis.status === "UNAVAILABLE") {
      if (!sameDimensionValue(targetValue, DEFAULT_IDENTITY_DIMENSIONS[key])) return null;
      assumed.push(key);
    } else if (!sameDimensionValue(targetValue, axis.value)) {
      return null;
    }
  }
  return assumed;
}

function candidateAssumptions(
  signature: RuntimeSignature,
  target: DiscoveryTarget,
  supported: ReadonlySet<string>,
): IdentityDimensionKey[] | null {
  if (!target.capabilities.every((c) => supported.has(c))) return null;
  if (!sameStringList([...target.items].sort(), signature.ingredientSet.value)) return null;
  return compareDimensions(signature, target);
}

export function matchDiscovery<T extends DiscoveryTarget>(
  signature: RuntimeSignature,
  catalog: readonly T[],
  options: MatchOptions = {},
): DiscoveryMatch<T> {
  const supported = new Set(options.supportedCapabilities ?? RUNTIME_SUPPORTED_CAPABILITIES);
  const eligible: { target: T; assumed: IdentityDimensionKey[] }[] = [];
  const blocked: string[] = [];
  for (const target of catalog) {
    const assumed = candidateAssumptions(signature, target, supported);
    if (!assumed) continue;
    if (target.eligibility.status === "ELIGIBLE") eligible.push({ target, assumed });
    else blocked.push(target.targetId);
  }
  blocked.sort();

  if (eligible.length === 0) return { kind: "NO_MATCH", blockedTargetIds: blocked };
  if (eligible.length === 1 && blocked.length === 0) {
    return { kind: "UNIQUE_MATCH", target: eligible[0].target, assumedDimensions: eligible[0].assumed };
  }
  return {
    kind: "AMBIGUOUS",
    targetIds: [...eligible.map((e) => e.target.targetId), ...blocked].sort(),
  };
}

/** What a completed pizza means for the Dex, before anything is written. */
export type DiscoveryOutcome =
  /** No target matches: a valid "original pizza", not an error. */
  | { kind: "ORIGINAL"; blockedTargetIds: readonly string[] }
  | { kind: "AMBIGUOUS"; targetIds: readonly string[] }
  | { kind: "NEW_DISCOVERY"; recipeId: RecipeId; targetId: string }
  | { kind: "ALREADY_DISCOVERED"; recipeId: RecipeId; targetId: string }
  /** The signature is exactly another recipe's, but the pizza fails that recipe's own
   *  Completion Gate, so nothing is written. Only the Dex writer
   *  (../../state/discoveryRegistration.ts) produces this; `evaluateDiscovery` never does. */
  | { kind: "INCOMPLETE_MATCH"; recipeId: RecipeId; targetId: string };

/**
 * Classifies a signature against a recipe-backed catalog and the set of already-discovered
 * recipe ids. Pure: writing the Dex is the caller's job (gameReducer's REGISTER_TO_DEX), so
 * evaluating twice can never discover twice.
 */
export function evaluateDiscovery(
  signature: RuntimeSignature,
  catalog: readonly RecipeDiscoveryTarget[],
  discoveredRecipeIds: readonly string[],
  options: MatchOptions = {},
): DiscoveryOutcome {
  const match = matchDiscovery(signature, catalog, options);
  if (match.kind === "NO_MATCH") return { kind: "ORIGINAL", blockedTargetIds: match.blockedTargetIds };
  if (match.kind === "AMBIGUOUS") return { kind: "AMBIGUOUS", targetIds: match.targetIds };
  const { recipeId, targetId } = match.target;
  return discoveredRecipeIds.includes(recipeId)
    ? { kind: "ALREADY_DISCOVERED", recipeId, targetId }
    : { kind: "NEW_DISCOVERY", recipeId, targetId };
}
