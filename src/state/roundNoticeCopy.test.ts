import { describe, expect, it } from "vitest";
import { describeHeldRound, describeRoundSaveFailure, describeSettledRound } from "./roundNoticeCopy";

describe("round notices", () => {
  it("every kept-journal reason names a recovery step and says what is still playable", () => {
    for (const reason of ["unknown-version", "unresolvable", "corrupt", "oversize"] as const) {
      const text = describeHeldRound(reason).lines.join("\n");
      expect(text, reason).toContain("復旧:");
      expect(text, reason).toContain("今までどおり遊べます");
      expect(text, reason).toContain("残してあります");
    }
  });

  it("an unfinished FINISH is announced as an unfinished pizza", () => {
    const base = { outcome: "REGISTERED" as const, recipeId: "fugazza", stars: 2, earnedPitz: 0, discovered: false, newBest: false, newMaterialIds: [], newTechniqueIds: [] };
    expect(describeSettledRound(base).lines.join("\n")).not.toContain("未完成");
    expect(describeSettledRound({ ...base, unfinishedFinish: true }).lines.join("\n")).toContain("未完成のピザ");
  });

  it("an occupied slot behind a kept journal does not tell the player to confirm something that cannot be confirmed", () => {
    const held = describeRoundSaveFailure({ kind: "failed", failure: "occupied" }, "bake", true).lines.join("\n");
    expect(held).toContain("完了できない調理の記録");
    expect(held).not.toContain("確認してください");
  });
});
