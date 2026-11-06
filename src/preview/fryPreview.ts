/**
 * Cooking Fry Phase 1 (揚げる, Issue #749), F1: the Preview / DEV-only opt-in (pure resolvers + a guarded reader; nothing imports this yet).
 *
 *   ?cookFry=on                      turns the fry experience on for the page load (Preview / DEV only; any other value, a repeat or none: off)
 *   ?cookFry=off                     forgets the per-tab memory
 *   ?cookFryVariant=tap|drag|both    which operation(s) the pan offers (Owner 2026-11-04: compare both). Invalid / repeated / absent: both
 *   ?cookFryTime=short|standard|long the stage-boundary scale for the side-by-side comparison. Otherwise the default (standard)
 *
 * PRODUCTION never reads any of it: every reader sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production `vite build` drops the
 * query names (a real-build gate test comes with the wiring slice). Independent of the other cooking treatments' opt-ins. Nothing here is saved.
 */
import { FRY_TIME_SCALES, type FryVariant } from "../logic/fry/fryPot";

export const FRY_PARAM = "cookFry";
export const FRY_ON_VALUE = "on";
export const FRY_OFF_VALUE = "off";
export const FRY_OPT_IN_STORAGE_KEY = "teto:cookFry";

const single = (search: unknown, name: string): string[] => (typeof search === "string" ? new URLSearchParams(search).getAll(name) : []);

export function resolveFryOptIn(search: unknown): boolean {
  const all = single(search, FRY_PARAM);
  return all.length === 1 && all[0] === FRY_ON_VALUE;
}

interface TabStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Pure: the query decides (on = remember, off = forget); with neither, the remembered value counts. Storage failures fall back to the query alone. */
export function resolveFryOptInSticky(search: unknown, storage: TabStorage | null): boolean {
  const queryOn = resolveFryOptIn(search);
  const all = single(search, FRY_PARAM);
  const queryOff = all.length === 1 && all[0] === FRY_OFF_VALUE;
  try {
    if (queryOn) {
      storage?.setItem(FRY_OPT_IN_STORAGE_KEY, "1");
      return true;
    }
    if (queryOff) {
      storage?.removeItem(FRY_OPT_IN_STORAGE_KEY);
      return false;
    }
    return storage?.getItem(FRY_OPT_IN_STORAGE_KEY) === "1";
  } catch {
    return queryOn;
  }
}

export const FRY_VARIANT_PARAM = "cookFryVariant";
export type FryVariantChoice = FryVariant | "both";

export function resolveFryVariant(search: unknown): FryVariantChoice {
  const all = single(search, FRY_VARIANT_PARAM);
  return all.length === 1 && (all[0] === "tap" || all[0] === "drag") ? all[0] : "both";
}

export const FRY_TIME_PARAM = "cookFryTime";

/** The stage-boundary scale asked for, or `null` for the default. */
export function resolveFryTimeScale(search: unknown): number | null {
  const all = single(search, FRY_TIME_PARAM);
  if (all.length !== 1) return null;
  return Object.prototype.hasOwnProperty.call(FRY_TIME_SCALES, all[0]) ? FRY_TIME_SCALES[all[0] as keyof typeof FRY_TIME_SCALES] : null;
}

function tabStorage(): TabStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const previewOrDev = (): boolean => Boolean(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE);
const currentSearch = (): string => (typeof window === "undefined" ? "" : window.location.search);

let cachedOptIn: boolean | undefined;
let cachedVariant: FryVariantChoice | undefined;
let cachedScale: number | null | undefined;

/** Test seam: forget the cached page-load values. */
export function resetFryPreviewForTest(): void {
  cachedOptIn = undefined;
  cachedVariant = undefined;
  cachedScale = undefined;
}

export function fryPreviewOptedIn(): boolean {
  if (!previewOrDev()) return false;
  if (cachedOptIn === undefined) cachedOptIn = resolveFryOptInSticky(currentSearch(), tabStorage());
  return cachedOptIn;
}

/** The operation(s) asked for by the Preview / DEV query; "both" otherwise (and always in production, where nothing is offered anyway). */
export function fryVariantChoice(): FryVariantChoice {
  if (!previewOrDev()) return "both";
  if (cachedVariant === undefined) cachedVariant = resolveFryVariant(currentSearch());
  return cachedVariant;
}

/** The comparison stage-boundary scale, or `null` for the default. Read once per page load; never in production. */
export function fryTimeScaleOverride(): number | null {
  if (!previewOrDev()) return null;
  if (cachedScale === undefined) cachedScale = resolveFryTimeScale(currentSearch());
  return cachedScale;
}
