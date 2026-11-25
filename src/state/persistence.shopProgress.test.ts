import { describe, expect, it } from "vitest";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "../logic/progression/shopProgress";
import {
  commitProgress,
  createDefaultSave,
  loadSave,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSave,
  SAVE_STORAGE_KEY,
  type ProgressionSnapshot,
} from "./persistence";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * B案再構成 Phase 1b (Issue #901), design §3.3: the `shopProgress` top-level key -- save v2 (no schema bump), read
 * fail-soft, never written while the state is the default, merged on write (reputation max, granted recipes union, the
 * first seed kept), and everything a newer build might store under it kept across this build's writes (rollback).
 */
const stored = (s: ReturnType<typeof memoryStorage>) => JSON.parse(s.getItem(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>;
const progress = (extra: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot => {
  const d = createDefaultSave();
  return {
    dex: d.dex,
    pitzBalance: d.pitzBalance,
    ownedIngredientIds: d.ownedIngredientIds,
    inventory: d.inventory,
    starterGrantClaimedRecipeIds: d.starterGrantClaimedRecipeIds,
    ...extra,
  };
};
const seed = (value: number) => ({ source: "legacy-dex" as const, value });
const SHOP: ShopProgressState = { reputation: 120, grantedMenuRecipeIds: ["margherita"], reputationSeed: seed(100) };
const base = (extra: Record<string, unknown>) => ({ schemaVersion: 2, dex: [], ...extra });

describe("shopProgress: read", () => {
  it("schemaVersion stays 2 and the default save carries no shopProgress at all", () => {
    expect(createDefaultSave().schemaVersion).toBe(2);
    expect(createDefaultSave()).not.toHaveProperty("shopProgress");
  });

  it("a save without the key loads with no shopProgress (the same object as before Phase 1b)", () => {
    const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ pitzBalance: 3 })) }));
    expect(save).not.toHaveProperty("shopProgress");
  });

  it("a stored object reads back (known recipe ids only)", () => {
    const raw = JSON.stringify(base({ shopProgress: { ...SHOP, grantedMenuRecipeIds: ["margherita", "future-pizza"] } }));
    expect(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: raw })).shopProgress).toEqual(SHOP);
  });

  it("invalid values are repaired fail-soft and never cost the rest of the save", () => {
    const raw = JSON.stringify(base({ pitzBalance: 40, shopProgress: { reputation: -3, grantedMenuRecipeIds: "x", reputationSeed: 9 } }));
    const save = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: raw }));
    expect(save.shopProgress).toEqual(EMPTY_SHOP_PROGRESS);
    expect(save.pitzBalance).toBe(40);
  });

  it("a non-object value (a shape a newer build may use) reads as absent", () => {
    for (const shopProgress of [7, "x", [1, 2], null]) {
      expect(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ shopProgress })) }))).not.toHaveProperty("shopProgress");
    }
  });

  it("a v1 save has none", () => {
    const raw = JSON.stringify({ schemaVersion: 1, dex: [], pitzBalance: 0, ownedIngredientIds: [], missionBest: {} });
    expect(loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: raw }))).not.toHaveProperty("shopProgress");
  });
});

describe("shopProgress: a default state never creates the key (Production stays byte-identical)", () => {
  it("default state, a Dex write and a Mission BEST write: no key", () => {
    const s = memoryStorage();
    persistProgress(progress({ pitzBalance: 5, shopProgress: EMPTY_SHOP_PROGRESS }), s);
    persistDex([{ recipeId: "margherita", discovered: true, bestScore: 1, bestStars: 1, timesMade: 1 }], s);
    persistMissionBest("lunch-rush", 5, s);
    expect(stored(s)).not.toHaveProperty("shopProgress");
    expect(stored(s).schemaVersion).toBe(2);
  });

  it("an existing save is not rewritten by a default state (no migration write)", () => {
    const raw = JSON.stringify(base({ pitzBalance: 3 }));
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    persistProgress(progress({ pitzBalance: 3, shopProgress: EMPTY_SHOP_PROGRESS }), s);
    expect(s.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it("a write with the default state stores exactly the text a write without the field stores", () => {
    const a = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ pitzBalance: 3 })) });
    const b = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ pitzBalance: 3 })) });
    persistProgress(progress({ pitzBalance: 9, shopProgress: EMPTY_SHOP_PROGRESS }), a);
    persistProgress(progress({ pitzBalance: 9 }), b);
    expect(a.getItem(SAVE_STORAGE_KEY)).toBe(b.getItem(SAVE_STORAGE_KEY));
  });
});

describe("shopProgress: write and merge", () => {
  it("a non-default state is written and reads back", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: SHOP }), s);
    expect(stored(s).shopProgress).toEqual(SHOP);
    expect(loadSave(s).shopProgress).toEqual(SHOP);
  });

  it("reputation is merged with max: a stale lower snapshot never lowers it (Q1)", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: { ...SHOP, reputation: 500 } }), s);
    persistProgress(progress({ pitzBalance: 1, shopProgress: { ...SHOP, reputation: 10 } }), s);
    expect(loadSave(s).shopProgress?.reputation).toBe(500);
  });

  it("granted recipes are merged as a union", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: { ...SHOP, grantedMenuRecipeIds: ["margherita"] } }), s);
    persistProgress(progress({ shopProgress: { ...SHOP, grantedMenuRecipeIds: ["fugazza"] } }), s);
    expect(loadSave(s).shopProgress?.grantedMenuRecipeIds).toEqual(["margherita", "fugazza"]);
  });

  it("the stored seed is kept: a later different seed never replaces it (R9)", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: { ...SHOP, reputationSeed: seed(100) } }), s);
    persistProgress(progress({ shopProgress: { ...SHOP, reputation: 999, reputationSeed: seed(250) } }), s);
    expect(loadSave(s).shopProgress?.reputationSeed).toEqual(seed(100));
  });

  it("a stored state survives writes that do not carry it (persistDex, Mission BEST, a snapshot without the field)", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: SHOP }), s);
    persistDex([{ recipeId: "margherita", discovered: true, bestScore: 1, bestStars: 1, timesMade: 1 }], s);
    persistMissionBest("lunch-rush", 5, s);
    persistProgress(progress({ pitzBalance: 77 }), s);
    expect(stored(s).shopProgress).toEqual(SHOP);
  });

  it("a default snapshot on a save that holds a state leaves it as stored", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: SHOP }), s);
    persistProgress(progress({ pitzBalance: 2, shopProgress: EMPTY_SHOP_PROGRESS }), s);
    expect(stored(s).shopProgress).toEqual(SHOP);
  });

  it("the synchronous commit path merges the same way", () => {
    const s = memoryStorage();
    expect(commitProgress(progress({ shopProgress: SHOP }), s)).toEqual({ status: "ok" });
    expect(stored(s).shopProgress).toEqual(SHOP);
    expect(commitProgress(progress({ shopProgress: SHOP }), s)).toEqual({ status: "ok" });
  });

  it("resetSave removes it", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: SHOP }), s);
    resetSave(s);
    expect(loadSave(s)).not.toHaveProperty("shopProgress");
  });
});

describe("shopProgress: rollback / forward compatibility (a newer build's data is never erased)", () => {
  const newer = {
    reputation: 800,
    grantedMenuRecipeIds: ["future-pizza", "margherita"],
    reputationSeed: { source: "future-source", value: 3 },
    futureField: { stars: [1, 2] },
  };

  it("a build that only carries the save keeps a newer shopProgress verbatim", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ pitzBalance: 1, shopProgress: newer })) });
    persistProgress(progress({ pitzBalance: 2 }), s);
    persistDex([{ recipeId: "margherita", discovered: true, bestScore: 1, bestStars: 1, timesMade: 1 }], s);
    expect(stored(s).shopProgress).toEqual(newer);
  });

  it("a write of this build's state merges into it: unknown sub-keys, unknown ids and the unreadable seed stay", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ shopProgress: newer })) });
    persistProgress(progress({ shopProgress: { reputation: 900, grantedMenuRecipeIds: ["margherita", "fugazza"], reputationSeed: seed(100) } }), s);
    expect(stored(s).shopProgress).toEqual({
      reputation: 900,
      grantedMenuRecipeIds: ["future-pizza", "margherita", "fugazza"],
      reputationSeed: { source: "future-source", value: 3 },
      futureField: { stars: [1, 2] },
    });
  });

  it("a non-object value is kept while this build has no state of its own", () => {
    const s = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(base({ shopProgress: ["opaque"] })) });
    persistProgress(progress({ pitzBalance: 4, shopProgress: EMPTY_SHOP_PROGRESS }), s);
    expect(stored(s).shopProgress).toEqual(["opaque"]);
  });

  it("shop -> legacy -> shop round trip: the reputation and the seed come back as they were", () => {
    const s = memoryStorage();
    persistProgress(progress({ shopProgress: SHOP }), s); // a shop-model session
    const legacy = loadSave(s);
    persistProgress({ ...legacy, pitzBalance: legacy.pitzBalance + 10, shopProgress: legacy.shopProgress ?? EMPTY_SHOP_PROGRESS }, s); // a legacy session
    expect(loadSave(s).shopProgress).toEqual(SHOP);
  });
});
