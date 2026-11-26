import { describe, expect, it } from "vitest";
import { isReputationTableComplete, REPUTATION_TABLE } from "./reputationTable";
import { chapterForReputation } from "./shopProgression";
import { nextRankAbove, rankAtFloor, rankForReputation, rankLabel, SHOP_RANKS } from "./shopRank";

/**
 * B案 Phase 2b (Issue #901): the owner's title ladder (Owner decision 2026-11-26). The rank is a display of the reputation; the
 * shop's stages (where materials open) stay the chapter floors of `REPUTATION_TABLE`.
 */

if (!isReputationTableComplete(REPUTATION_TABLE)) throw new Error("the reputation table is complete since Phase 2a");
const floors = REPUTATION_TABLE.chapterFloors as readonly [number, number, number, number, number];

describe("the ladder is the Owner-approved one", () => {
  it("six titles, their reputation and the shop's stage", () => {
    expect(SHOP_RANKS.map((r) => [r.level, r.title, r.floor, r.stage])).toEqual([
      [1, "見習い", 0, "屋台"],
      [2, "駆け出し", 15, "屋台"],
      [3, "一人前", 40, "小さな店"],
      [4, "職人", 110, "人気店"],
      [5, "達人", 210, "有名店"],
      [6, "匠", 340, "伝説の店"],
    ]);
  });

  it("every title but 駆け出し starts exactly on a chapter floor, in order -- the rank never moves where materials open", () => {
    const onFloors = SHOP_RANKS.filter((r) => r.title !== "駆け出し").map((r) => r.floor);
    expect(onFloors).toEqual([...floors]);
  });

  it("駆け出し is a title-only promotion inside chapter 1 (it opens nothing)", () => {
    const early = SHOP_RANKS[1];
    expect(chapterForReputation(early.floor, floors)).toBe(1);
    expect(chapterForReputation(early.floor - 1, floors)).toBe(chapterForReputation(early.floor, floors));
  });
});

describe("the rank of a reputation", () => {
  it.each([
    [0, "見習い"],
    [14, "見習い"],
    [15, "駆け出し"],
    [39, "駆け出し"],
    [40, "一人前"],
    [109, "一人前"],
    [110, "職人"],
    [210, "達人"],
    [339, "達人"],
    [340, "匠"],
    [9999, "匠"],
  ] as const)("%i -> %s", (reputation, title) => {
    expect(rankForReputation(reputation).title).toBe(title);
  });

  it("the next title, and none at the top", () => {
    expect(nextRankAbove(0)?.title).toBe("駆け出し");
    expect(nextRankAbove(15)?.title).toBe("一人前");
    expect(nextRankAbove(340)).toBeNull();
  });

  it("the title a chapter floor opens with", () => {
    expect(floors.slice(1).map((f) => rankAtFloor(f).title)).toEqual(["一人前", "職人", "達人", "匠"]);
  });

  it("the label reads 「一人前（小さな店）」", () => {
    expect(rankLabel(rankForReputation(40))).toBe("一人前（小さな店）");
  });
});
