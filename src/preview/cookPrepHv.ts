import { loadSave, persistProgress, type StorageLike } from "../state/persistence";
import { buildHvSnapshot, findHvScenario } from "./hvSeeds";

/**
 * Cooking Prep HV entry (Preview / DEV only): `?cookPrepHv=1&cookPrep=on` opens the game at the FREE COOKING TOPPING step with the beef
 * already selected and not yet prepared, so the Owner's iPhone check needs no URL juggling, State Editor, dough or tray taps.
 *
 * - **Disposable.** The page's `localStorage` is replaced by an in-memory storage that an existing Hint 5.0 HV seed's snapshot (./hvSeeds.ts:
 *   every ladder material owned and stocked) plus the beef (it is not a ladder material) is written to by the real save writer. The device's real Preview save is never read or written; a reload starts over.
 *   If the replacement is refused the entry stays off and the game starts as usual (fail closed).
 * - **Same actions as play.** The start is the reducer's own START_FREE_COOK -> COMMIT_DOUGH_STRETCH -> CONFIRM_MAKING_STEP x3, and the
 *   beef is selected through the app's own selection state. No state is built here.
 * - **Isolation.** ../main.tsx and ../App.tsx reach this only behind `import.meta.env.DEV || VITE_PREVIEW_MODE`, which a production build
 *   replaces statically, so the module and COOK_PREP_HV_MARK drop out (./cookPrepHv.gate.test.ts scans a real build). The component is ./CookPrepHvStarter.tsx.
 */
export const COOK_PREP_HV_PARAM = "cookPrepHv";
export const COOK_PREP_HV_MARK = "cook-prep-hv-v1";
export const COOK_PREP_HV_BEEF_ID = "beef";

/** The Hint 5.0 HV seed that owns and stocks every ladder material and stands at the end of the ladder. */
const SEED_ID = "calabresa-key-free";
const BEEF_STOCK = 10; // the seed's own per-material stock

function createDisposableStorage(): StorageLike {
  const map = new Map<string, string>();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
}

export type CookPrepHvStage = "off" | "start" | "select" | "done";
let stage: CookPrepHvStage = "off";

export function cookPrepHvStage(): CookPrepHvStage {
  return stage;
}

export function setCookPrepHvStage(next: CookPrepHvStage): void {
  stage = next;
}

/** True when the query asks for the entry exactly once with the value 1. */
export function resolveCookPrepHv(search: unknown): boolean {
  if (typeof search !== "string") return false;
  const all = new URLSearchParams(search).getAll(COOK_PREP_HV_PARAM);
  return all.length === 1 && all[0] === "1";
}

/** Test seam: forget the page-load state. */
export function resetCookPrepHvForTest(): void {
  stage = "off";
}

interface HvWindow {
  location: { search: string };
  document: { documentElement: { dataset: Record<string, string | undefined> } };
  localStorage?: unknown;
}

/** Swaps in the disposable storage. Returns false (and changes nothing observable) when it is not asked for or cannot be done. */
export function activateCookPrepHv(win: HvWindow): boolean {
  if (!resolveCookPrepHv(win.location.search)) return false;
  const memory = createDisposableStorage();
  const scenario = findHvScenario(SEED_ID);
  if (!scenario) return false;
  const seeded = buildHvSnapshot(scenario);
  persistProgress(
    {
      ...seeded,
      ownedIngredientIds: [...seeded.ownedIngredientIds, COOK_PREP_HV_BEEF_ID],
      inventory: { ...seeded.inventory, [COOK_PREP_HV_BEEF_ID]: BEEF_STOCK },
      unlockedForShopIngredientIds: [...(seeded.unlockedForShopIngredientIds ?? []), COOK_PREP_HV_BEEF_ID],
    },
    memory,
  );
  if (!loadSave(memory).ownedIngredientIds.includes(COOK_PREP_HV_BEEF_ID)) return false;
  try {
    Object.defineProperty(win, "localStorage", { configurable: true, get: () => memory });
    if (win.localStorage !== memory) return false;
  } catch {
    return false;
  }
  win.document.documentElement.dataset.cookPrepHv = COOK_PREP_HV_MARK;
  stage = "start";
  return true;
}
