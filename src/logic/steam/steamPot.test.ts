import { describe, expect, it } from "vitest";
import {
  STEAM_AMOUNT_OPEN_MAX,
  STEAM_AMOUNT_OVER,
  STEAM_LOOK_COPY,
  STEAM_LOOK_LIVE,
  STEAM_OVER_MS,
  STEAM_SHELL_COUNT,
  STEAM_SHELL_THRESHOLDS,
  steamLookOf,
  steamLookOfAmount,
  steamOpenCount,
  steamResultOf,
  type SteamLook,
} from "./steamPot";

const LOOKS: SteamLook[] = ["closed", "partial", "open", "over"];

describe("shell thresholds", () => {
  it("five shells, strictly ascending, inside (0, 1)", () => {
    expect(STEAM_SHELL_COUNT).toBe(5);
    expect(STEAM_SHELL_THRESHOLDS).toHaveLength(5);
    STEAM_SHELL_THRESHOLDS.forEach((t, i) => {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
      if (i > 0) expect(t).toBeGreaterThan(STEAM_SHELL_THRESHOLDS[i - 1]);
    });
  });
});

describe("steamOpenCount (boundaries)", () => {
  it.each([
    [0, 0],
    [0.29, 0],
    [0.3, 1],
    [0.41, 1],
    [0.42, 2],
    [0.54, 3],
    [0.66, 4],
    [0.77, 4],
    [0.78, 5],
    [1, 5],
  ])("level %s -> %s open", (level, open) => expect(steamOpenCount(level)).toBe(open));
  it("unreadable and out-of-range levels are clamped, never thrown on", () => {
    for (const bad of [NaN, Infinity, -Infinity, -1, undefined as never, null as never, "0.9" as never]) expect(() => steamOpenCount(bad)).not.toThrow();
    expect(steamOpenCount(NaN)).toBe(0);
    expect(steamOpenCount(-5)).toBe(0);
    expect(steamOpenCount(5)).toBe(5);
    expect(steamOpenCount(Infinity)).toBe(0); // non-finite is "no steam", not "full steam"
  });
  it("is monotone in the level", () => {
    let prev = 0;
    for (let i = 0; i <= 1000; i += 1) {
      const n = steamOpenCount(i / 1000);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});

describe("steamLookOf", () => {
  it("closed / partial / open by the shell count", () => {
    expect(steamLookOf(0, 0)).toBe("closed");
    expect(steamLookOf(0.29, 0)).toBe("closed");
    expect(steamLookOf(0.3, 0)).toBe("partial");
    expect(steamLookOf(0.77, 0)).toBe("partial");
    expect(steamLookOf(0.78, 0)).toBe("open");
    expect(steamLookOf(1, 0)).toBe("open");
  });
  it("over only when every shell is open AND full steam was held for STEAM_OVER_MS", () => {
    expect(steamLookOf(1, STEAM_OVER_MS - 1)).toBe("open");
    expect(steamLookOf(1, STEAM_OVER_MS)).toBe("over");
    expect(steamLookOf(0.78, STEAM_OVER_MS * 5)).toBe("over");
    expect(steamLookOf(0.77, STEAM_OVER_MS * 5)).toBe("partial");
    expect(steamLookOf(0, STEAM_OVER_MS * 5)).toBe("closed");
  });
  it("a non-finite or negative hold time counts as no hold", () => {
    for (const bad of [NaN, -1, -Infinity, undefined as never]) expect(steamLookOf(1, bad)).toBe("open");
    expect(steamLookOf(1, Infinity)).toBe("open");
  });
});

describe("steamResultOf / the kept amount", () => {
  it("amount is the level, capped below 1, and exactly 1 only for over", () => {
    expect(steamResultOf(0.5, 0)).toEqual({ amount: 0.5, openCount: 2, look: "partial" });
    expect(steamResultOf(1, 0)).toEqual({ amount: STEAM_AMOUNT_OPEN_MAX, openCount: 5, look: "open" });
    expect(steamResultOf(1, STEAM_OVER_MS)).toEqual({ amount: STEAM_AMOUNT_OVER, openCount: 5, look: "over" });
    expect(steamResultOf(NaN, NaN)).toEqual({ amount: 0, openCount: 0, look: "closed" });
  });
  it("the kept amount always reads back as the same look (the one number is enough for the placed piece)", () => {
    for (let i = 0; i <= 200; i += 1) {
      for (const over of [0, STEAM_OVER_MS - 1, STEAM_OVER_MS, STEAM_OVER_MS * 3]) {
        const r = steamResultOf(i / 200, over);
        expect(steamLookOfAmount(r.amount), `${i / 200}/${over}`).toBe(r.look);
        expect(r.amount).toBeGreaterThanOrEqual(0);
        expect(r.amount).toBeLessThanOrEqual(1);
      }
    }
  });
  it("amount is non-decreasing in the level for a fixed hold", () => {
    let prev = -1;
    for (let i = 0; i <= 100; i += 1) {
      const a = steamResultOf(i / 100, 0).amount;
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
  it("is deterministic: the same input is the same result, with no hidden state", () => {
    const a = JSON.stringify([0.1, 0.35, 0.6, 0.9, 1].map((l) => steamResultOf(l, 1234)));
    const b = JSON.stringify([0.1, 0.35, 0.6, 0.9, 1].map((l) => steamResultOf(l, 1234)));
    expect(a).toBe(b);
  });
  it("steamLookOfAmount: unreadable amounts are closed", () => {
    for (const bad of [NaN, -1, Infinity, undefined as never]) expect(steamLookOfAmount(bad)).toBe("closed");
  });
});

describe("words", () => {
  it("every look has result words and a live word", () => {
    for (const look of LOOKS) {
      expect(STEAM_LOOK_COPY[look].length).toBeGreaterThan(0);
      expect(STEAM_LOOK_LIVE[look].length).toBeGreaterThan(0);
    }
  });
  it("describes, never grades (no pass / fail / best / near-miss vocabulary, no numbers)", () => {
    const all = [...Object.values(STEAM_LOOK_COPY), ...Object.values(STEAM_LOOK_LIVE)].join("|");
    expect(all).not.toMatch(/成功|失敗|ベスト|おしい|惜しい|完璧|ジャスト|合格|\d|%|秒/);
  });
});
