import { describe, expect, it } from "vitest";
import { leakedOccurrences } from "./leakCheck";

describe("leakedOccurrences (Batch 25 M-1): only the tail of a bought name is tolerated", () => {
  const bought = ["サワークリーム", "フェタ"];

  it("tolerates a name spelled across the end of a bought name and the next label (サワークリーム + チーズ)", () => {
    expect(leakedOccurrences("ソースサワークリームチーズフェタ", "クリームチーズ", bought)).toEqual([]);
  });

  it("still reports a standalone occurrence of the unbought name", () => {
    expect(leakedOccurrences("チーズ クリームチーズ", "クリームチーズ", bought)).toEqual([4]);
  });

  it("still reports an occurrence split across elements that does not start inside a bought name", () => {
    expect(leakedOccurrences("クリーム\nチーズ", "クリーム\nチーズ", bought)).toEqual([0]);
    expect(leakedOccurrences("ハムクリームチーズ", "クリームチーズ", bought)).toEqual([2]);
  });

  it("reports every leaking occurrence even when another occurrence is tolerated", () => {
    expect(leakedOccurrences("サワークリームチーズ / クリームチーズ", "クリームチーズ", bought)).toEqual([13]);
  });

  it("with nothing bought, any occurrence is a leak", () => {
    expect(leakedOccurrences("サワークリームチーズ", "クリームチーズ", [])).toEqual([3]);
  });
});
