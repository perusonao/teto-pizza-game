import { loadSave, persistProgress } from "../state/persistence";
import { createDisposableStorage } from "./cookPrepHv";
import { buildHvSnapshot, findHvScenario } from "./hvSeeds";
import { forceSearOptInForHv } from "./searPreview";

/**
 * Cooking Sear HV entry (Preview / DEV only, Issue #724): `?cookSearHv=1` opens the game at the FREE COOKING TOPPING step with the dough, the sauce and the
 * cheese already done, the sausage owned and well stocked and already SELECTED, and the sear experience ON (3-second default; `&cookSearMs=2000|4000` still
 * compares). The "🔥 炙る" pill is on screen at once, so the Owner's iPhone check needs no URL juggling, State Editor or tray taps.
 *
 * - **Disposable.** Same mechanism as the 炒める entry (./cookPrepHv.ts): the page's `localStorage` is replaced by an in-memory storage that an existing Hint 5.0
 *   HV seed's snapshot (every ladder material owned, stocked 10 each -- the sausage is one) is written to by the real save writer. The device's real Preview
 *   save, its stock and its progress are never read or written; a reload starts over. If the replacement is refused the entry stays off (fail closed).
 * - **Same actions as play.** ./CookSearHvStarter.tsx dispatches the reducer's own START_FREE_COOK -> COMMIT_DOUGH_STRETCH -> CONFIRM -> COMMIT_SAUCE_DISPENSE ->
 *   CONFIRM -> PLACE_TOPPING (cheese) -> CONFIRM, and selects the sausage through the app's own selection state. Nothing is built by hand.
 * - **Independent.** It does not enable the 炒める prep, and `?cookPrepHv=1` (when both are given) wins and this entry stays off.
 * - **Isolation.** ../main.tsx and ../App.tsx reach this only behind `import.meta.env.DEV || VITE_PREVIEW_MODE`, which a production build replaces statically, so
 *   the module and COOK_SEAR_HV_MARK drop out (./cookSearHv.gate.test.ts scans a real build).
 */
export const COOK_SEAR_HV_PARAM = "cookSearHv";
export const COOK_SEAR_HV_MARK = "cook-sear-hv-v1";
export const COOK_SEAR_HV_SAUSAGE_ID = "sausage";

/** The Hint 5.0 HV seed that owns and stocks every ladder material (the sausage included, 10 each). */
const SEED_ID = "calabresa-key-free";

export type CookSearHvStage = "off" | "start" | "select" | "done";
let stage: CookSearHvStage = "off";

export function cookSearHvStage(): CookSearHvStage {
  return stage;
}

export function setCookSearHvStage(next: CookSearHvStage): void {
  stage = next;
}

/** True when the query asks for the entry exactly once with the value 1. */
export function resolveCookSearHv(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(COOK_SEAR_HV_PARAM);
  return all.length === 1 && all[0] === "1";
}

/** Test seam: forget the page-load state. */
export function resetCookSearHvForTest(): void {
  stage = "off";
}

interface HvWindow {
  location: { search: string };
  document: { documentElement: { dataset: Record<string, string | undefined> } };
  localStorage?: unknown;
}

/** Swaps in the disposable storage and forces the sear on. Returns false (and changes nothing observable) when it is not asked for or cannot be done. */
export function activateCookSearHv(win: HvWindow): boolean {
  if (!resolveCookSearHv(win.location.search)) return false;
  if (new URLSearchParams(win.location.search).has("cookPrepHv")) return false;
  const scenario = findHvScenario(SEED_ID);
  if (!scenario) return false;
  const memory = createDisposableStorage();
  persistProgress(buildHvSnapshot(scenario), memory);
  const stored = loadSave(memory);
  if (!stored.ownedIngredientIds.includes(COOK_SEAR_HV_SAUSAGE_ID) || (stored.inventory[COOK_SEAR_HV_SAUSAGE_ID] ?? 0) < 3) return false;
  try {
    Object.defineProperty(win, "localStorage", { configurable: true, get: () => memory });
    if (win.localStorage !== memory) return false;
  } catch {
    return false;
  }
  forceSearOptInForHv();
  win.document.documentElement.dataset.cookSearHv = COOK_SEAR_HV_MARK;
  stage = "start";
  return true;
}
