import { describe, expect, it } from "vitest";
import { buildStartup } from "./startup";
import { researchPointBalanceOf } from "../logic/progression/shopProgress";
import { SAVE_STORAGE_KEY, commitProgress, loadSave, persistProgress, type ProgressionSnapshot } from "./persistence";
import { progressionSnapshotOf } from "./roundCommit";
import { GOLDEN_ERAS } from "./testSupport/saveGoldenFixtures";
import { V2_SHOP_PROGRESS } from "./testSupport/shopProgressGoldenFixtures";
import { V2_SHOP_RESEARCH_POINTS, V2_SHOP_RESEARCH_POINTS_FROM_NEWER_BUILD } from "./testSupport/researchPointsGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * B案 Phase 3c (Issue #901): research points in the save (`shopProgress.researchPointsEarned`, save v2, no schema bump). Saves
 * without the key -- every existing era, and a Phase 1b-3b `shopProgress` -- read as 0 and are written back without it. In its own
 * file so the existing golden suites and their fixtures stay untouched.
 */
describe("saves without research points read as 0 and gain no key", () => {
  for (const era of [...GOLDEN_ERAS, { name: "shopProgress (Phase 1b-3b shape)", raw: V2_SHOP_PROGRESS }]) {
    it(`${era.name}: balance 0; the startup state saved back adds no key`, () => {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
      const { state } = buildStartup(storage);
      expect(researchPointBalanceOf(state.shop)).toBe(0);
      persistProgress(progressionSnapshotOf(state, undefined), storage);
      const written = JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null") as Record<string, Record<string, unknown> | undefined>;
      expect(written.shopProgress ?? {}).not.toHaveProperty("researchPointsEarned");
    });
  }
});

describe("saves with research points", () => {
  it("load and start with the stored balance", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: V2_SHOP_RESEARCH_POINTS });
    expect(loadSave(storage).shopProgress?.researchPointsEarned).toBe(23);
    expect(researchPointBalanceOf(buildStartup(storage).state.shop)).toBe(23);
  });

  it("loading never writes, and saving back what was loaded is a no-op", () => {
    for (const raw of [V2_SHOP_RESEARCH_POINTS, V2_SHOP_RESEARCH_POINTS_FROM_NEWER_BUILD]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      persistProgress(loadSave(storage) as ProgressionSnapshot, storage);
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    }
  });

  it("a newer build's sub-keys stay when this build writes", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: V2_SHOP_RESEARCH_POINTS_FROM_NEWER_BUILD });
    const { state } = buildStartup(storage);
    persistProgress(progressionSnapshotOf({ ...state, pitzBalance: state.pitzBalance + 1 }, undefined), storage);
    const written = JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null").shopProgress;
    expect(written.researchPointsSpent).toBe(12);
    expect(written.researchPointsEarned).toBe(40);
  });

  it("a raised balance survives a restart (commit -> reload)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: V2_SHOP_RESEARCH_POINTS });
    const { state } = buildStartup(storage);
    const raised = { ...state, shop: { ...state.shop, researchPointsEarned: 26 } };
    expect(commitProgress(progressionSnapshotOf(raised, undefined), storage).status).toBe("ok");
    expect(researchPointBalanceOf(buildStartup(storage).state.shop)).toBe(26);
  });

  it("an older (lower) snapshot never lowers the stored balance", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: V2_SHOP_RESEARCH_POINTS });
    const { state } = buildStartup(storage);
    const stale = { ...state, shop: { ...state.shop, researchPointsEarned: 3 } };
    persistProgress(progressionSnapshotOf(stale, undefined), storage);
    expect(researchPointBalanceOf(buildStartup(storage).state.shop)).toBe(23);
  });
});
