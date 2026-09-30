import { describe, expect, it } from "vitest";
import { duplicateTrialNoticeJa } from "./originalResultCopy";

/** P3-3b (OD-P3-19): the notice copy is one pure function of the stable attempt number. */
describe("duplicateTrialNoticeJa", () => {
  it("is the Owner's sentence with the stable #n", () => {
    expect(duplicateTrialNoticeJa(1)).toBe("📓 前にも同じ材料の組み合わせで作ったよ（試作#1）");
    expect(duplicateTrialNoticeJa(4)).toBe("📓 前にも同じ材料の組み合わせで作ったよ（試作#4）");
    expect(duplicateTrialNoticeJa(2000)).toBe("📓 前にも同じ材料の組み合わせで作ったよ（試作#2000）");
  });

  it("shows nothing for anything that is not a positive integer attempt number", () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, "1", null, undefined, {}, [], 10n]) {
      expect(duplicateTrialNoticeJa(bad), String(bad)).toBeNull();
    }
  });

  it("never claims the result is the same, never asks the player to stop, never names a count of retries", () => {
    const text = duplicateTrialNoticeJa(3)!;
    for (const forbidden of ["同じ結果", "意味", "無駄", "できない", "回", "×", "retry"]) expect(text).not.toContain(forbidden);
  });
});
