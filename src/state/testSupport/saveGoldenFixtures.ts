/**
 * Save Compatibility Phase A (Issue #559): synthetic "golden" saves, one per era of the v1 -> v2 schema's history.
 *
 * Each fixture is the JSON text exactly as that era's build would have left it in localStorage, written out by hand and
 * FROZEN: never regenerate one from current code, or it stops proving that an old save still opens. They use only ids
 * that must stay in the catalog for old saves to mean anything (margherita, fugazza, onion, ...). No real player data
 * was read to make them; every value is invented.
 *
 * A new era is added at the end (a new file entry, never an edit of an existing one).
 */

/** Pre-Phase 3C-3: Dex only meaningful; `ownedIngredientIds` empty, `missionBest` empty. */
export const V1_EARLY = JSON.stringify({
  schemaVersion: 1,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 0,
  ownedIngredientIds: [],
  missionBest: {},
});

/** Phase 3C-5 era: Pitz, a purchased finite ingredient (`onion`) and a Lunch Rush BEST, but no `inventory` yet. */
export const V1_WITH_PURCHASE = JSON.stringify({
  schemaVersion: 1,
  dex: [
    { recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 },
    { recipeId: "fugazza", discovered: true, bestScore: 64, bestStars: 3, timesMade: 1 },
  ],
  pitzBalance: 250,
  ownedIngredientIds: ["onion"],
  missionBest: { "lunch-rush": 742 },
});

/** Save v2 / Inventory E0: `inventory` added. */
export const V2_E0 = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: { "lunch-rush": 500 },
  inventory: { onion: 7 },
});

/** + EP4 Starter Grant ledger. */
export const V2_EP4 = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  starterGrantClaimedRecipeIds: ["fugazza"],
});

/** + I4b-2 Shop entitlement ledger. */
export const V2_I4B = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  starterGrantClaimedRecipeIds: ["fugazza"],
  unlockedForShopIngredientIds: ["onion"],
});

/** + Hint Economy / Selectable Hint ledgers. */
export const V2_HINTS = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  starterGrantClaimedRecipeIds: ["fugazza"],
  unlockedForShopIngredientIds: ["onion"],
  discoveryHintPurchases: { fugazza: 2 },
  discoveryHintFacts: { fugazza: ["ing:mozzarella"] },
});

/** + Cooking Techniques TQ-1A technique ledger and Research 2.0 negative ledger (the newest shape in this list). */
export const V2_TECHNIQUES_RESEARCH = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 82, bestStars: 4, timesMade: 3 }],
  pitzBalance: 120,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 7 },
  starterGrantClaimedRecipeIds: ["fugazza"],
  unlockedForShopIngredientIds: ["onion"],
  discoveryHintPurchases: { fugazza: 2 },
  discoveryHintFacts: { fugazza: ["ing:mozzarella"] },
  discoveredTechniqueIds: ["no-sauce"],
  researchExclusions: { margherita: ["onion"] },
});

export interface GoldenEra {
  readonly name: string;
  readonly raw: string;
  readonly expect: {
    readonly dexIds: readonly string[];
    readonly pitzBalance: number;
    readonly inventory: Readonly<Record<string, number>>;
    readonly missionBest: Readonly<Record<string, number>>;
  };
}

export const GOLDEN_ERAS: readonly GoldenEra[] = [
  { name: "v1 early", raw: V1_EARLY, expect: { dexIds: ["margherita"], pitzBalance: 0, inventory: {}, missionBest: {} } },
  {
    name: "v1 with purchase",
    raw: V1_WITH_PURCHASE,
    // migrateV1toV2 backfills 4 (DEFAULT_MIGRATION_RESTOCK_QTY) for an already-purchased finite ingredient.
    expect: { dexIds: ["margherita", "fugazza"], pitzBalance: 250, inventory: { onion: 4 }, missionBest: { "lunch-rush": 742 } },
  },
  { name: "v2 E0", raw: V2_E0, expect: { dexIds: ["margherita"], pitzBalance: 120, inventory: { onion: 7 }, missionBest: { "lunch-rush": 500 } } },
  { name: "v2 EP4", raw: V2_EP4, expect: { dexIds: ["margherita"], pitzBalance: 120, inventory: { onion: 7 }, missionBest: {} } },
  { name: "v2 I4b", raw: V2_I4B, expect: { dexIds: ["margherita"], pitzBalance: 120, inventory: { onion: 7 }, missionBest: {} } },
  { name: "v2 hints", raw: V2_HINTS, expect: { dexIds: ["margherita"], pitzBalance: 120, inventory: { onion: 7 }, missionBest: {} } },
  {
    name: "v2 techniques + research",
    raw: V2_TECHNIQUES_RESEARCH,
    expect: { dexIds: ["margherita"], pitzBalance: 120, inventory: { onion: 7 }, missionBest: {} },
  },
];

/** A save a future build (schemaVersion 3) might leave behind. Invented; this build does not recognize it. */
export const FUTURE_V3 = JSON.stringify({
  schemaVersion: 3,
  dex: [{ recipeId: "margherita", discovered: true, bestScore: 90, bestStars: 5, timesMade: 9 }],
  pitzBalance: 4000,
  ownedIngredientIds: ["onion"],
  missionBest: { "lunch-rush": 900 },
  inventory: { onion: 30 },
  cloudProfile: { id: "synthetic-player" },
});

/** Stored text that is not a usable save root. `loadSave` must fall back to a fresh default for every one. */
export const UNUSABLE_ROOTS: readonly { readonly name: string; readonly raw: string }[] = [
  { name: "truncated JSON", raw: '{"schemaVersion":2,"dex":[{"recipeId":"margh' },
  { name: "not JSON", raw: "undefined" },
  { name: "empty string", raw: "" },
  { name: "JSON null", raw: "null" },
  { name: "JSON array", raw: "[]" },
  { name: "JSON number", raw: "42" },
  { name: "JSON string", raw: '"save"' },
  { name: "object without schemaVersion", raw: '{"dex":[]}' },
  { name: "schemaVersion as a string", raw: '{"schemaVersion":"2","dex":[]}' },
  { name: "v2 with dex not an array", raw: '{"schemaVersion":2,"dex":{}}' },
];
