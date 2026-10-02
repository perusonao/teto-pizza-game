/**
 * Discovery Hint 5.0 (Issue #292), H5-5: Human Verification seeds for the Owner's iPhone. PREVIEW ONLY.
 *
 * `?hv=<scenario>` writes a ready-made save, so each Hint 5.0 state can be opened directly instead of
 * playing to Dex 14 or more. The seed goes through the ordinary `resetSave` / `persistProgress`, so:
 * - it lands in whatever key the build uses: a Preview build keeps `teto-pizza-preview-save-v1`, which
 *   is never the production key (src/state/persistence.ts). It never reads or writes a production save;
 * - it is a valid save (the same sanitizing writer as the game), never a hand-built JSON string.
 *
 * **When it applies.** Only on a fresh navigation to the URL (`navigate`), never on a reload. So the
 * Owner's own progress survives a reload, and after Full Game Reset (which reloads) the game starts
 * from a real initial state. Opening the scenario URL again starts that scenario again.
 *
 * **Isolation.** ../main.tsx calls `applyPreviewHvSeed` only behind `import.meta.env.VITE_PREVIEW_MODE`
 * (a Preview build), which a production build never sets; DEV builds do not seed either, so a developer's
 * local save is never overwritten. ./previewIsolation.gate.test.ts scans the production bundle for
 * `PREVIEW_HELPER_MARK`, every scenario id and the opt-in key.
 *
 * This module does not import the Hint 5.0 ladder. Each scenario lists stored fact ids, and
 * ./hvSeeds.test.ts checks them against the real ladder (offers, prices, board).
 */
import { W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { DexEntry } from "../state/dex";
import { loadSave, persistProgress, resetSave, type ProgressionSnapshot, type StorageLike } from "../state/persistence";
import { PREVIEW_HELPER_MARK } from "./hint5PreviewOptIn";

export type HvScenarioId =
  | "normal"
  | "cheese-none"
  | "key-none"
  | "already-known"
  | "multi-sub"
  | "last-sub"
  | "low-pitz"
  | "pool2-onion"
  | "calabresa-key-free";

export interface HvScenario {
  id: HvScenarioId;
  /** The Free Cooking hint target the seed reaches (it is the DISCOVERABLE recipe of the seeded save). */
  recipeId: string;
  /** What the Owner should see first (used by the report and the tests). */
  firstOfferJa: string;
  labelJa: string;
  pitz: number;
  /** The recipe's stored fact ids (`discoveryHintFacts[recipeId]`). */
  facts: readonly string[];
  /** PR-4b-B: the save is a Discovery pool of 2+ (pizza-portuguesa beside brazilian-calabresa), so the
   *  sheet names no recipe and sells nothing; `recipeId` only fixes the ladder step the save stands at. */
  noTarget?: true;
  /** PR-4b-B: every credited recipe is found and every material owned (the 26th is the only one left). */
  dexAfterLadder?: true;
}

/** capricciosa's rungs 1-4 (sauce, cheese, key, structure) as the ladder stores them. */
const CAPRICCIOSA_FIXED = ["ing:tomato-sauce", "h5:sauce", "ing:mozzarella", "h5:cheese", "ing:mushroom", "h5:key", "meta:ingredient-total", "h5:structure"];

export const HV_SCENARIOS: readonly HvScenario[] = [
  { id: "normal", recipeId: "meat-lovers", labelJa: "A: 普通のレシピ (meat-lovers)", pitz: 300, facts: [], firstOfferJa: "ヒント1: ソース 10 Pitz" },
  {
    id: "cheese-none",
    recipeId: "marinara",
    labelJa: "B: チーズなし (marinara)",
    pitz: 300,
    facts: ["ing:tomato-sauce", "h5:sauce"],
    firstOfferJa: "ヒント2: チーズ 10 Pitz (購入後に「チーズ: なし」)",
  },
  {
    id: "key-none",
    recipeId: "quattro-formaggi",
    labelJa: "C: キートッピングなし (quattro-formaggi)",
    pitz: 300,
    facts: ["ing:olive-oil", "h5:sauce", "ing:mozzarella", "ing:gorgonzola", "ing:parmigiano", "ing:fontina", "h5:cheese"],
    firstOfferJa: "ヒント3: キートッピング 10 Pitz (購入後に「キートッピング: なし」)",
  },
  {
    id: "already-known",
    recipeId: "meat-lovers",
    labelJa: "D: M3 もう知っていた (meat-lovers)",
    pitz: 300,
    facts: ["ing:tomato-sauce", "ing:mozzarella"],
    firstOfferJa: "ヒント1: ソース 10 Pitz (押すと 0 Pitz で「もう知っていた」)",
  },
  {
    id: "multi-sub",
    recipeId: "capricciosa",
    labelJa: "E: 複数の SUB_CLASS (capricciosa)",
    pitz: 300,
    facts: CAPRICCIOSA_FIXED,
    firstOfferJa: "ヒント5: サブトッピング①の分類 5 Pitz (①②③を続けて買える)",
  },
  {
    id: "last-sub",
    recipeId: "capricciosa",
    labelJa: "F: 最後の SUB_CLASS (capricciosa)",
    pitz: 300,
    facts: [...CAPRICCIOSA_FIXED, "cls:oregano", "cls:ham"],
    firstOfferJa: "ヒント7: サブトッピング③の分類 5 Pitz (買うと完了)",
  },
  {
    id: "low-pitz",
    recipeId: "meat-lovers",
    labelJa: "G: Pitz が足りない (meat-lovers)",
    pitz: 12,
    facts: [],
    firstOfferJa: "ヒント1: ソース 10 Pitz (買うと 2 Pitz で、次は押せない)",
  },
  {
    id: "pool2-onion",
    recipeId: "pizza-portuguesa",
    labelJa: "H: 発見できるピザが2つ (onion 解禁直後)",
    pitz: 300,
    facts: [],
    noTarget: true,
    firstOfferJa: "ヒントなし: 「まだ発見できるピザがあるよ」 (FREE Cooking で探す)",
  },
  {
    id: "calabresa-key-free",
    recipeId: "brazilian-calabresa",
    labelJa: "I: キーなしヒント (brazilian-calabresa, 残り1つ)",
    pitz: 300,
    facts: [],
    dexAfterLadder: true,
    firstOfferJa: "ヒント1: ソース 10 Pitz (キートッピングの段はない)",
  },
];

// No top-level call on the table (a `new Set(...map(...))` here is a side effect a bundler must keep, which
// would leave the whole seed table in a production bundle even though nothing calls it).
export function findHvScenario(id: unknown): HvScenario | null {
  return typeof id === "string" ? (HV_SCENARIOS.find((s) => s.id === id) ?? null) : null;
}

/** `?hv=<id>` (an unknown value is ignored). */
export function parseHvParam(search: unknown): HvScenarioId | null {
  if (typeof search !== "string") return null;
  return findHvScenario(new URLSearchParams(search).get("hv"))?.id ?? null;
}

/** The save a scenario stands for, as the ordinary progression snapshot: the Dex before the recipe's
 *  ladder step, its materials owned and stocked, the starters, and the recipe's stored facts. */
export function buildHvSnapshot(scenario: HvScenario): ProgressionSnapshot {
  const steps = W1_25_DISCOVERY_LADDER.steps;
  const index = scenario.dexAfterLadder ? steps.length : steps.findIndex((step) => step.keyRecipeId === scenario.recipeId);
  if (index < 0) throw new Error(`${PREVIEW_HELPER_MARK}: ${scenario.recipeId} is not on the ladder`);
  const materials = steps.slice(0, scenario.dexAfterLadder ? steps.length : index + 1).flatMap((step) => step.ingredientIds);
  // #353: from the onion step on, the non-credit brazilian-calabresa is a second registered Research Entry beside
  // the scenario's recipe, which would make the seed a "2 entries, no target" save (the sheet then asks to choose).
  // These seeds stand for ONE hint target, so it is already found. The pool-2 seed (`noTarget`) and the seeds at or
  // before that step are left as they were.
  const onionIndex = steps.findIndex((step) => step.keyRecipeId === "pizza-portuguesa");
  const companion = !scenario.noTarget && !scenario.dexAfterLadder && onionIndex >= 0 && index > onionIndex ? ["brazilian-calabresa"] : [];
  const dex: DexEntry[] = ["margherita", ...steps.slice(0, index).map((step) => step.keyRecipeId), ...companion].map((recipeId) => ({
    recipeId,
    discovered: true,
    bestScore: 70,
    bestStars: 3,
    timesMade: 1,
  }));
  return {
    dex,
    pitzBalance: scenario.pitz,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, ...materials],
    inventory: Object.fromEntries(materials.map((id) => [id, 10])),
    starterGrantClaimedRecipeIds: [],
    unlockedForShopIngredientIds: materials,
    discoveryHintFacts: scenario.facts.length > 0 ? { [scenario.recipeId]: scenario.facts } : {},
  };
}

/** Replaces the save in `storage` with the scenario's. Returns false when the stored result is not the seed. */
export function applyHvSeed(id: HvScenarioId, storage: StorageLike): boolean {
  const scenario = findHvScenario(id);
  if (!scenario) return false;
  if (!resetSave(storage)) return false;
  persistProgress(buildHvSnapshot(scenario), storage);
  const stored = loadSave(storage);
  return stored.pitzBalance === scenario.pitz && (scenario.facts.length === 0 || (stored.discoveryHintFacts[scenario.recipeId] ?? []).length === scenario.facts.length);
}

/** A seed applies to a fresh navigation only. A reload (Full Game Reset reloads too) and a history
 *  step keep the save; an unavailable Navigation Timing is treated as a fresh navigation. */
export function shouldApplyHvSeed(navigationType: string | undefined): boolean {
  return navigationType === undefined || navigationType === "navigate";
}

function currentNavigationType(): string | undefined {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return entry?.type;
  } catch {
    return undefined;
  }
}

/** The one call ../main.tsx makes (Preview build only): applies `?hv=` to a fresh navigation. */
export function applyPreviewHvSeed(
  search: unknown,
  storage: StorageLike | null,
  navigationType: string | undefined = currentNavigationType(),
): HvScenarioId | null {
  const id = parseHvParam(search);
  if (!id || !storage || !shouldApplyHvSeed(navigationType)) return null;
  return applyHvSeed(id, storage) ? id : null;
}
