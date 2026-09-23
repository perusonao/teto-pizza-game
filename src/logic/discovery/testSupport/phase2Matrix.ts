/**
 * Test-only access to the Phase-2 machine-readable matrix
 * (docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json), the design SSOT the P3-1
 * signature/matcher is checked against. Never import this from production code: the JSON is
 * ~700 KB and is design data, not runtime data.
 */
import matrix from "../../../../docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json";
import type { DiscoveryTarget } from "../matcher";
import {
  IDENTITY_DIMENSION_KEYS,
  type IdentityDimensionKey,
  type IdentityDimensions,
  type RuntimeSignature,
  type SignatureAxis,
} from "../signature";

export type Phase2Profile = "SHIPPED_KEEP" | "EVIDENCE_STRICT";

export interface Phase2Target {
  targetId: string;
  source: string;
  nameJa: string;
  items: string[];
  capabilities: string[];
  identityDimensions: IdentityDimensions;
  productDecisionStatus: string;
}

export interface Phase2RowClassification {
  evidenceId: string;
  phase2Class: string;
  blockerTypes: string[];
}

export function phase2Targets(profile: Phase2Profile): Phase2Target[] {
  return (matrix.targets as unknown as Record<Phase2Profile, Phase2Target[]>)[profile];
}

export function phase2RowClassification(): Phase2RowClassification[] {
  return matrix.rowClassification as unknown as Phase2RowClassification[];
}

export function phase2CollisionFreeByProfile(profile: Phase2Profile): unknown[] {
  return (matrix.decisionProfiles as unknown as Record<Phase2Profile, { runtimeSignatureCollisions: unknown[] }>)[
    profile
  ].runtimeSignatureCollisions;
}

/** Phase-2 targets as matcher targets. Every Phase-2 target is evidence-ready by construction. */
export function phase2DiscoveryTargets(profile: Phase2Profile): DiscoveryTarget[] {
  return phase2Targets(profile).map((t) => ({
    targetId: t.targetId,
    items: [...t.items].sort(),
    capabilities: t.capabilities,
    identityDimensions: t.identityDimensions,
    eligibility: { status: "ELIGIBLE" },
  }));
}

/** The signature a future runtime that observes EVERY dimension would build for `target`'s ideal
 *  pizza. Used to prove the full signature separates what ingredients alone cannot. */
export function fullyObservedSignatureFor(target: {
  items: readonly string[];
  identityDimensions: IdentityDimensions;
}): RuntimeSignature {
  const dimensions = {} as Record<IdentityDimensionKey, SignatureAxis<unknown>>;
  for (const key of IDENTITY_DIMENSION_KEYS) {
    dimensions[key] = { status: "OBSERVED", value: target.identityDimensions[key] };
  }
  return {
    ingredientSet: { status: "OBSERVED", value: [...new Set(target.items)].sort() },
    sauceBase: { status: "OBSERVED", value: [] },
    ingredientCounts: {},
    dimensions: dimensions as RuntimeSignature["dimensions"],
  };
}
