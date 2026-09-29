/**
 * Original Pizza Recovery P1 (Attempt Fingerprint): the canonical, versioned identity of a
 * player's *attempt* -- "have I already tried this combination of ingredients?".
 *
 * **Pure and UNWIRED.** Nothing in production imports this module (attemptFingerprint.gate.test.ts
 * pins that). It is a foundation for a later Trial Notebook / duplicate detection; it changes no
 * matcher, RESULT, Builder, save or session behaviour.
 *
 * Authority: docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_DISCOVERY-ASSISTANCE_Fresh-Audit.md §3, and
 * the matcher itself (./matcher.ts, ./signature.ts), which is the single source of truth.
 *
 * ## What is identity (exactly what the matcher compares)
 *
 * - `sauceBase`: the sorted, de-duplicated sauce ids (`RuntimeSignature.sauceBase`).
 * - `ingredientSet`: the sorted, de-duplicated ids of every sauce and placed piece
 *   (`RuntimeSignature.ingredientSet`).
 * - Any identity dimension whose status is `OBSERVED` **and** whose value is not the Phase-2
 *   default (`ext`, below). Today no dimension is `OBSERVED`, so `ext` is always empty.
 *
 * NOT identity (so never in the fingerprint): ingredient order, piece counts / duplicates,
 * placement and positions, timing, bake value, sauce amounts, CUT, Cooking Steps, dough radii.
 * `FIXED_BY_FLOW` axes are constants and `UNAVAILABLE` axes are assumed default by the matcher,
 * so neither can distinguish two attempts.
 *
 * ## Attempt identity, not recipe identity
 *
 * The fingerprint says "same ingredient combination", never "same result": two attempts with one
 * fingerprint can still differ in quantity (Completion Gate), bake or sauce amount. It also does
 * not resolve exact-identity collisions -- several recipes may legitimately share one fingerprint
 * (the matcher reports AMBIGUOUS for them); that is a catalog / authority matter, not decided here.
 *
 * ## Privacy
 *
 * Input is a `RuntimeSignature` only: no recipe, Dex, catalog, hint or near-miss data can reach
 * it, so the output holds nothing but the player's own ingredient ids. No recipe id / name, no
 * undiscovered-recipe information, no nearest-recipe information.
 *
 * ## Representation (version 1)
 *
 *   `fp1:` + JSON.stringify([sauceBase, ingredientSet])            (no extension)
 *   `fp1:` + JSON.stringify([sauceBase, ingredientSet, ext])       (only when `ext` is non-empty)
 *
 * JSON makes the encoding injective for arbitrary id strings (no delimiter can collide) and
 * deterministic (arrays are sorted, `ext` keys follow `IDENTITY_DIMENSION_KEYS` order).
 *
 * ## Extension policy
 *
 * - A dimension that later becomes `OBSERVED` is picked up automatically and *sparsely*: it only
 *   appears in `ext` when its value differs from the default. An attempt made with default
 *   dimensions therefore keeps the exact same `fp1:` string before and after the dimension ships,
 *   so a stored fingerprint stays valid and comparable.
 * - `ext` values are compared the way the matcher compares them (canonical JSON of the value).
 * - Adding a dimension is additive and keeps version 1. Changing how `sauceBase` / `ingredientSet`
 *   are derived, or the encoding itself, is a NEW version (`fp2:`) with an explicit migration; an
 *   unknown version is reported by `attemptFingerprintVersion`, never coerced or dropped.
 */
import {
  DEFAULT_IDENTITY_DIMENSIONS,
  IDENTITY_DIMENSION_KEYS,
  signatureOfPizza,
  type IdentityDimensionKey,
  type RuntimeSignature,
} from "./signature";
import type { PizzaState } from "../../state/pizzaState";

export const ATTEMPT_FINGERPRINT_VERSION = 1;

const PREFIX = `fp${ATTEMPT_FINGERPRINT_VERSION}:`;

/** A version-1 canonical attempt fingerprint. Opaque to callers; compare with `===`. */
export type AttemptFingerprint = string & { readonly __attemptFingerprint: "v1" };

/** Non-default observed identity dimensions, sparse and JSON-shaped. Empty today. */
export type AttemptFingerprintExtension = Partial<Record<IdentityDimensionKey, unknown>>;

export interface AttemptFingerprintParts {
  version: typeof ATTEMPT_FINGERPRINT_VERSION;
  /** Sorted, de-duplicated sauce ids. */
  sauceBase: readonly string[];
  /** Sorted, de-duplicated ids of every sauce and piece (includes `sauceBase`). */
  ingredientSet: readonly string[];
  ext: AttemptFingerprintExtension;
}

/** Same ordering and de-duplication the matcher / signature use (default code-unit sort). */
function canonicalIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}

function isCanonical(ids: readonly string[]): boolean {
  const canonical = canonicalIds(ids);
  return canonical.length === ids.length && canonical.every((id, i) => id === ids[i]);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function extensionOf(signature: RuntimeSignature): AttemptFingerprintExtension {
  const ext: AttemptFingerprintExtension = {};
  for (const key of IDENTITY_DIMENSION_KEYS) {
    const axis = signature.dimensions[key];
    if (axis.status === "OBSERVED" && !sameJson(axis.value, DEFAULT_IDENTITY_DIMENSIONS[key])) {
      ext[key] = axis.value;
    }
  }
  return ext;
}

function serialize(parts: Pick<AttemptFingerprintParts, "sauceBase" | "ingredientSet" | "ext">): AttemptFingerprint {
  const payload: unknown[] = [[...parts.sauceBase], [...parts.ingredientSet]];
  const ordered: Record<string, unknown> = {};
  for (const key of IDENTITY_DIMENSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parts.ext, key)) ordered[key] = parts.ext[key];
  }
  if (Object.keys(ordered).length > 0) payload.push(ordered);
  return `${PREFIX}${JSON.stringify(payload)}` as AttemptFingerprint;
}

/** The fingerprint of a runtime signature: the one place the contract is implemented. */
export function attemptFingerprintOfSignature(signature: RuntimeSignature): AttemptFingerprint {
  return serialize({
    sauceBase: canonicalIds(signature.sauceBase.value),
    ingredientSet: canonicalIds(signature.ingredientSet.value),
    ext: extensionOf(signature),
  });
}

/** Convenience: the fingerprint of a pizza, through the matcher's own `signatureOfPizza`. */
export function attemptFingerprintOfPizza(pizza: PizzaState): AttemptFingerprint {
  return attemptFingerprintOfSignature(signatureOfPizza(pizza));
}

/** True when both signatures are the same ingredient combination (never "the same result"). */
export function isSameAttempt(a: RuntimeSignature, b: RuntimeSignature): boolean {
  return attemptFingerprintOfSignature(a) === attemptFingerprintOfSignature(b);
}

const VERSION_PATTERN = /^fp([1-9][0-9]{0,5}):/;

/**
 * The version a stored string claims, or `null` when it is not fingerprint-shaped at all. A future
 * version is reported as its number so a store can keep it untouched instead of dropping it.
 */
export function attemptFingerprintVersion(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = VERSION_PATTERN.exec(raw);
  return match ? Number(match[1]) : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Strict parser for an untrusted stored string. Returns the parts only for a *canonical* version-1
 * fingerprint (re-serialising the parts must reproduce the input exactly); anything else --
 * another version, malformed JSON, unsorted or duplicated ids, a sauce that is not in the set, an
 * unknown or default-valued extension key -- is `null`.
 */
export function parseAttemptFingerprint(raw: unknown): AttemptFingerprintParts | null {
  if (typeof raw !== "string" || !raw.startsWith(PREFIX)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(raw.slice(PREFIX.length));
  } catch {
    return null;
  }
  if (!Array.isArray(payload) || (payload.length !== 2 && payload.length !== 3)) return null;
  const [sauceBase, ingredientSet, ext] = payload as [unknown, unknown, unknown];
  if (!isStringArray(sauceBase) || !isStringArray(ingredientSet)) return null;
  // canonical means already sorted and de-duplicated, exactly as `canonicalIds` produces them
  if (!isCanonical(sauceBase) || !isCanonical(ingredientSet)) return null;
  if (!sauceBase.every((id) => ingredientSet.includes(id))) return null;

  let parsedExt: AttemptFingerprintExtension = {};
  if (payload.length === 3) {
    if (typeof ext !== "object" || ext === null || Array.isArray(ext)) return null;
    for (const key of Object.keys(ext)) {
      if (!(IDENTITY_DIMENSION_KEYS as readonly string[]).includes(key)) return null;
      if (sameJson((ext as Record<string, unknown>)[key], DEFAULT_IDENTITY_DIMENSIONS[key as IdentityDimensionKey])) return null;
    }
    parsedExt = ext as AttemptFingerprintExtension;
  }
  const parts: AttemptFingerprintParts = {
    version: ATTEMPT_FINGERPRINT_VERSION,
    sauceBase,
    ingredientSet,
    ext: parsedExt,
  };
  return serialize(parts) === raw ? parts : null;
}

export function isAttemptFingerprint(raw: unknown): raw is AttemptFingerprint {
  return parseAttemptFingerprint(raw) !== null;
}
