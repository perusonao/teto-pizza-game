/**
 * Cooking Steam Phase 1 (蒸す, Issue #726), S1: the Preview / DEV-only opt-in (pure resolvers + a guarded reader; nothing imports this yet).
 *
 *   ?cookSteam=on                         turns the steam experience on for the page load (Preview / DEV only; any other value, a repeat or none: off)
 *   ?cookSteam=off                        forgets the per-tab memory
 *   ?cookSteamVariant=lid|shake|both      which operation(s) the pot offers (Owner 2026-11-02: compare both). Invalid / repeated / absent: both
 *   ?cookSteamMs=3000|4500|6000           (operation A) the lid-on time that opens every shell, for the side-by-side comparison. Otherwise the default
 *
 * PRODUCTION never reads any of it: every reader sits behind a static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production `vite build` drops
 * the query names (a real-build gate test comes with the wiring slice). Independent of the other cooking treatments' opt-ins. Nothing here is saved.
 */
import type { SteamVariant } from "../logic/steam/steamPot";

export const STEAM_PARAM = "cookSteam";
export const STEAM_ON_VALUE = "on";
export const STEAM_OFF_VALUE = "off";
export const STEAM_OPT_IN_STORAGE_KEY = "teto:cookSteam";

export function resolveSteamOptIn(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(STEAM_PARAM);
  return all.length === 1 && all[0] === STEAM_ON_VALUE;
}

interface TabStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Pure: the query decides (on = remember, off = forget); with neither, the remembered value counts. Storage failures fall back to the query alone. */
export function resolveSteamOptInSticky(search: unknown, storage: TabStorage | null): boolean {
  const queryOn = resolveSteamOptIn(search);
  const all = typeof search === "string" ? new URLSearchParams(search).getAll(STEAM_PARAM) : [];
  const queryOff = all.length === 1 && all[0] === STEAM_OFF_VALUE;
  try {
    if (queryOn) {
      storage?.setItem(STEAM_OPT_IN_STORAGE_KEY, "1");
      return true;
    }
    if (queryOff) {
      storage?.removeItem(STEAM_OPT_IN_STORAGE_KEY);
      return false;
    }
    return storage?.getItem(STEAM_OPT_IN_STORAGE_KEY) === "1";
  } catch {
    return queryOn;
  }
}

export const STEAM_VARIANT_PARAM = "cookSteamVariant";
export type SteamVariantChoice = SteamVariant | "both";

export function resolveSteamVariant(search: unknown): SteamVariantChoice {
  if (typeof search !== "string") return "both";
  const all = new URLSearchParams(search).getAll(STEAM_VARIANT_PARAM);
  return all.length === 1 && (all[0] === "lid" || all[0] === "shake") ? all[0] : "both";
}

export const STEAM_MS_PARAM = "cookSteamMs";
/** The lid-on times under comparison. */
export const STEAM_MS_CHOICES: readonly number[] = [3000, 4500, 6000];

export function resolveSteamFullMs(search: unknown): number | null {
  if (typeof search !== "string") return null;
  const all = new URLSearchParams(search).getAll(STEAM_MS_PARAM);
  if (all.length !== 1) return null;
  const n = Number(all[0]);
  return STEAM_MS_CHOICES.includes(n) && String(n) === all[0] ? n : null;
}

function tabStorage(): TabStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const currentSearch = (): string => (typeof window === "undefined" ? "" : window.location.search);

let cachedOptIn: boolean | undefined;
let cachedVariant: SteamVariantChoice | undefined;
let cachedMs: number | null | undefined;

/** Test seam: forget the cached page-load values. */
export function resetSteamPreviewForTest(): void {
  cachedOptIn = undefined;
  cachedVariant = undefined;
  cachedMs = undefined;
}

/** Cooking Steam HV entry (`?cookSteamHv=1`, ./cookSteamHv.ts): turns the steam on for this page load without the query or the tab memory. Preview / DEV only
 *  (the caller sits behind the same static gate). */
export function forceSteamOptInForHv(): void {
  cachedOptIn = true;
}

// Each reader below tests `import.meta.env.DEV || VITE_PREVIEW_MODE` INLINE: the bundler replaces both statically, so in a production build the branch (and with it
// the query names) is dead code and drops out. A shared helper function would hide the condition from it.
export function steamPreviewOptedIn(): boolean {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedOptIn === undefined) cachedOptIn = resolveSteamOptInSticky(currentSearch(), tabStorage());
    return cachedOptIn;
  }
  return false;
}

/** The operation(s) asked for by the Preview / DEV query; "both" otherwise (and always in production, where nothing is offered anyway). */
export function steamVariantChoice(): SteamVariantChoice {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedVariant === undefined) cachedVariant = resolveSteamVariant(currentSearch());
    return cachedVariant;
  }
  return "both";
}

/** The comparison lid-on time, or `null` for the default. Read once per page load; never in production. */
export function steamFullMsOverride(): number | null {
  if (import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) {
    if (cachedMs === undefined) cachedMs = resolveSteamFullMs(currentSearch());
    return cachedMs;
  }
  return null;
}
