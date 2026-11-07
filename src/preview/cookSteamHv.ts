import { loadSave, persistProgress, type StorageLike } from "../state/persistence";
import { buildHvSnapshot, findHvScenario } from "./hvSeeds";
import { forceSteamOptInForHv } from "./steamPreview";

/**
 * Cooking Steam HV entry (Preview / DEV only, Issue #726 S3): `?cookSteamHv=1` opens the game at the FREE COOKING TOPPING step with the dough, the sauce and the
 * cheese already done, the clam and the mussel owned and well stocked, the clam already SELECTED, and the steam experience ON. The "♨ 蒸す" pill is on screen at
 * once, so the Owner's iPhone check needs no URL juggling, State Editor or tray taps. Both operations are offered (`&cookSteamVariant=lid|shake` narrows it,
 * `&cookSteamMs=3000|4500|6000` compares the lid-on time); select the mussel in the tray to see the other shell.
 *
 * - **Disposable.** Same mechanism as the other cooking HV entries (a copy of the idea, no shared code): the page's `localStorage` is replaced by an
 *   in-memory storage that an existing Hint 5.0 HV seed's snapshot (every ladder material owned, stocked 10 each -- the clam is one; the mussel is added to it) is written
 *   to by the real save writer. The device's real Preview save, its stock and its progress are never read or written; a reload starts over. If the replacement
 *   is refused the entry stays off (fail closed).
 * - **Same actions as play.** ./CookSteamHvStarter.tsx dispatches the reducer's own START_FREE_COOK -> COMMIT_DOUGH_STRETCH -> CONFIRM -> COMMIT_SAUCE_DISPENSE ->
 *   CONFIRM -> PLACE_TOPPING (cheese) -> CONFIRM, and selects the clam through the app's own selection state. Nothing is built by hand.
 * - **Independent.** It never runs together with another cooking HV entry: those leave a `data-cook-*-hv` mark on <html> and this entry stands aside when it sees one.
 * - **Isolation.** ../main.tsx and ../App.tsx reach this only behind `import.meta.env.DEV || VITE_PREVIEW_MODE`, which a production build replaces statically, so
 *   the module and COOK_STEAM_HV_MARK drop out (./cookSteamHv.gate.test.ts scans a real build).
 */
export const COOK_STEAM_HV_PARAM = "cookSteamHv";
export const COOK_STEAM_HV_MARK = "cook-steam-hv-v1";
export const COOK_STEAM_HV_CLAM_ID = "clam";
export const COOK_STEAM_HV_MUSSEL_ID = "mussel";

/** The Hint 5.0 HV seed that owns and stocks every ladder material (the clam and the mussel included, 10 each). */
const SEED_ID = "calabresa-key-free";
/** The seed's own per-material stock. */
const HV_STOCK = 10;

/** An in-memory storage: the device's own save is never read or written while this entry is on. */
export function createDisposableStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
}

export type CookSteamHvStage = "off" | "start" | "select" | "done";
let stage: CookSteamHvStage = "off";

export function cookSteamHvStage(): CookSteamHvStage {
  return stage;
}

export function setCookSteamHvStage(next: CookSteamHvStage): void {
  stage = next;
}

/** True when the query asks for the entry exactly once with the value 1. */
export function resolveCookSteamHv(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(COOK_STEAM_HV_PARAM);
  return all.length === 1 && all[0] === "1";
}

/** Test seam: forget the page-load state. */
export function resetCookSteamHvForTest(): void {
  stage = "off";
}

interface HvWindow {
  location: { search: string };
  document: { documentElement: { dataset: Record<string, string | undefined> } };
  localStorage?: unknown;
}

/** Another cooking HV entry has already taken this page (it leaves `data-cook-<name>-hv` on <html>). */
function anotherEntryActive(win: HvWindow): boolean {
  return Object.keys(win.document.documentElement.dataset).some((key) => /^cook(?!Steam)[A-Za-z]+Hv$/.test(key));
}

/** Swaps in the disposable storage and forces the steam on. Returns false (and changes nothing observable) when it is not asked for or cannot be done. */
export function activateCookSteamHv(win: HvWindow): boolean {
  if (!resolveCookSteamHv(win.location.search)) return false;
  if (anotherEntryActive(win)) return false;
  const scenario = findHvScenario(SEED_ID);
  if (!scenario) return false;
  const memory = createDisposableStorage();
  // The seed's ladder stops before the mussel, so the mussel is added to it (owned, 10 in stock like the rest) by the same save writer.
  const base = buildHvSnapshot(scenario);
  persistProgress({ ...base, ownedIngredientIds: [...new Set([...base.ownedIngredientIds, COOK_STEAM_HV_MUSSEL_ID])], inventory: { ...base.inventory, [COOK_STEAM_HV_MUSSEL_ID]: HV_STOCK } }, memory);
  const stored = loadSave(memory);
  for (const id of [COOK_STEAM_HV_CLAM_ID, COOK_STEAM_HV_MUSSEL_ID]) {
    if (!stored.ownedIngredientIds.includes(id) || (stored.inventory[id] ?? 0) < 3) return false;
  }
  try {
    Object.defineProperty(win, "localStorage", { configurable: true, get: () => memory });
    if (win.localStorage !== memory) return false;
  } catch {
    return false;
  }
  forceSteamOptInForHv();
  win.document.documentElement.dataset.cookSteamHv = COOK_STEAM_HV_MARK;
  stage = "start";
  return true;
}
