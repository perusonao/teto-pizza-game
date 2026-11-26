import { describe, expect, it } from "vitest";
import { buildStartup } from "./startup";
import { EMPTY_SHOP_PROGRESS } from "../logic/progression/shopProgress";
import { SAVE_STORAGE_KEY, loadSave, persistProgress, type ProgressionSnapshot } from "./persistence";
import { progressionSnapshotOf } from "./roundCommit";
import { GOLDEN_ERAS } from "./testSupport/saveGoldenFixtures";
import { V2_SHOP_PROGRESS, V2_SHOP_PROGRESS_FROM_NEWER_BUILD } from "./testSupport/shopProgressGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * B案 Phase 1b (Issue #901), design §3.3 test plan: golden saves WITHOUT `shopProgress` (every existing era, unchanged) and
 * WITH it. Kept in its own file so the existing golden suite (persistence.compat.golden.test.ts) and its fixtures stay
 * untouched.
 */
describe("golden saves without shopProgress (every existing era)", () => {
  for (const era of GOLDEN_ERAS) {
    describe(era.name, () => {
      it("loads with no shopProgress and starts with the default shop state", () => {
        const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        expect(loadSave(storage)).not.toHaveProperty("shopProgress");
        expect(buildStartup(storage).state.shop).toEqual(EMPTY_SHOP_PROGRESS);
      });

      it("the startup state saved back (the first save effect) never adds the key", () => {
        const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        const { state } = buildStartup(storage);
        persistProgress(progressionSnapshotOf(state, undefined), storage);
        expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null")).not.toHaveProperty("shopProgress");
      });

      it("the startup write is the same text with or without the shop field in the snapshot", () => {
        const a = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        const b = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
        const snapshot = progressionSnapshotOf(buildStartup(a).state, undefined);
        buildStartup(b);
        const { shopProgress: _shop, ...withoutShop } = snapshot;
        persistProgress(snapshot, a);
        persistProgress(withoutShop as ProgressionSnapshot, b);
        expect(a.getItem(SAVE_STORAGE_KEY)).toBe(b.getItem(SAVE_STORAGE_KEY));
      });
    });
  }
});

describe("golden saves with shopProgress", () => {
  it("this build's shape loads and starts with it", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: V2_SHOP_PROGRESS });
    const expected = { reputation: 250, grantedMenuRecipeIds: ["margherita"] };
    expect(loadSave(storage).shopProgress).toEqual(expected);
    expect(buildStartup(storage).state.shop).toEqual(expected);
  });

  it("loading never writes, and saving back what was loaded is a no-op", () => {
    for (const raw of [V2_SHOP_PROGRESS, V2_SHOP_PROGRESS_FROM_NEWER_BUILD]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      persistProgress(loadSave(storage) as ProgressionSnapshot, storage);
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    }
  });

  it("the startup state saved back keeps the stored shopProgress", () => {
    for (const raw of [V2_SHOP_PROGRESS, V2_SHOP_PROGRESS_FROM_NEWER_BUILD]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      const { state } = buildStartup(storage);
      persistProgress(progressionSnapshotOf({ ...state, pitzBalance: state.pitzBalance + 1 }, undefined), storage);
      expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null").shopProgress).toEqual(JSON.parse(raw).shopProgress);
    }
  });

  it("the rest of the save is read exactly as without the key", () => {
    const withKey = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: V2_SHOP_PROGRESS }));
    const { shopProgress: _drop, ...rawWithout } = JSON.parse(V2_SHOP_PROGRESS) as Record<string, unknown>;
    const withoutKey = loadSave(memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(rawWithout) }));
    const { shopProgress: _shop, ...rest } = withKey;
    expect(rest).toEqual(withoutKey);
  });
});
