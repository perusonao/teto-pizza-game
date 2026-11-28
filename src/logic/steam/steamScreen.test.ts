import { describe, expect, it } from "vitest";
import { STEAM_LID_FULL_MS, STEAM_LID_IDLE, steamLidReducer, type SteamLid } from "./steamLid";
import { STEAM_LOOK_COPY, STEAM_LOOK_LIVE, STEAM_OVER_MS, STEAM_SHELL_COUNT } from "./steamPot";
import { STEAM_DONE_MS, STEAM_GUARD_MS, STEAM_TICK_MS, steamAnnouncement, steamLidLive, steamShakeLive, steamShellOpen, steamTitle, type SteamLive } from "./steamScreen";
import { STEAM_PER_TAP, STEAM_SHAKE_IDLE, steamShakeReducer, type SteamShake } from "./steamShake";

const T = 10_000;
const lidAt = (ms: number): SteamLid => ({ status: "steaming", startedAt: T - ms });
const live = (patch: Partial<SteamLive>): SteamLive => ({ mode: "idle", level: 0, overMs: 0, look: "closed", openCount: 0, ...patch });

describe("timing constants", () => {
  it("are the plain values the layer relies on", () => {
    expect(STEAM_DONE_MS).toBe(900);
    expect(STEAM_GUARD_MS).toBe(300);
    expect(STEAM_TICK_MS).toBe(50);
  });
});

describe("steamLidLive (the pot as operation A shows it)", () => {
  it("idle is a closed, empty pot", () => {
    expect(steamLidLive(STEAM_LID_IDLE, T)).toEqual(live({}));
  });
  it("steaming: the shells follow the elapsed time on the default curve", () => {
    expect(steamLidLive(lidAt(0), T)).toMatchObject({ mode: "steaming", level: 0, openCount: 0, look: "closed" });
    expect(steamLidLive(lidAt(STEAM_LID_FULL_MS / 2), T)).toMatchObject({ level: 0.5, openCount: 2, look: "partial" });
    expect(steamLidLive(lidAt(STEAM_LID_FULL_MS), T)).toMatchObject({ level: 1, openCount: 5, look: "open", overMs: 0 });
  });
  it("full steam held for STEAM_OVER_MS reads over, before that open", () => {
    expect(steamLidLive(lidAt(STEAM_LID_FULL_MS + STEAM_OVER_MS - 1), T).look).toBe("open");
    expect(steamLidLive(lidAt(STEAM_LID_FULL_MS + STEAM_OVER_MS), T).look).toBe("over");
  });
  it("a comparison full time moves the curve", () => {
    expect(steamLidLive(lidAt(3000), T, 3000)).toMatchObject({ level: 1, openCount: 5 });
    expect(steamLidLive(lidAt(3000), T, 6000)).toMatchObject({ level: 0.5, openCount: 2 });
  });
  it("a clock before the start or unreadable shows an empty steaming pot (never negative, never NaN)", () => {
    for (const now of [T - 5000, NaN]) {
      const v = steamLidLive({ status: "steaming", startedAt: T }, now);
      expect(v.level).toBe(0);
      expect(v.openCount).toBe(0);
    }
  });
  it("done shows what was kept", () => {
    const released = steamLidReducer(steamLidReducer(STEAM_LID_IDLE, { type: "CLOSE", now: T }), { type: "OPEN", now: T + STEAM_LID_FULL_MS / 2 });
    expect(steamLidLive(released, T + 99_999)).toMatchObject({ mode: "done", look: "partial", openCount: 2, level: 0.5 });
  });
});

describe("steamShakeLive (the pot as operation B shows it)", () => {
  it("idle is empty", () => {
    expect(steamShakeLive(STEAM_SHAKE_IDLE, T)).toEqual(live({}));
  });
  it("steaming: taps build it up, then it fades after the grace", () => {
    let s: SteamShake = STEAM_SHAKE_IDLE;
    for (let i = 0; i < 6; i += 1) s = steamShakeReducer(s, { type: "TAP", now: T });
    expect(steamShakeLive(s, T)).toMatchObject({ mode: "steaming", openCount: 3, look: "partial" });
    expect(steamShakeLive(s, T + 3000).openCount).toBeLessThan(3);
    expect(steamShakeLive(s, T + 60_000)).toMatchObject({ level: 0, openCount: 0, look: "closed" });
  });
  it("full steam is held only while it has not started to fade", () => {
    let s: SteamShake = STEAM_SHAKE_IDLE;
    for (let i = 0; i < 10; i += 1) s = steamShakeReducer(s, { type: "TAP", now: T });
    expect(STEAM_PER_TAP * 10).toBe(1);
    expect(steamShakeLive(s, T + 100)).toMatchObject({ level: 1, overMs: 100, look: "open" });
    expect(steamShakeLive(s, T + 100).overMs).toBeLessThan(STEAM_OVER_MS);
    for (let t = 300; t <= 3000; t += 300) s = steamShakeReducer(s, { type: "TAP", now: T + t });
    expect(steamShakeLive(s, T + 3100).look).toBe("over");
    expect(steamShakeLive(s, T + 20_000).overMs).toBe(0); // faded: not full any more
  });
});

describe("shells", () => {
  it("shell i is open exactly when the open count is above i; out-of-range indexes are never open", () => {
    expect([0, 1, 2, 3, 4].map((i) => steamShellOpen(i, 2))).toEqual([true, true, false, false, false]);
    expect(Array.from({ length: STEAM_SHELL_COUNT }, (_, i) => steamShellOpen(i, STEAM_SHELL_COUNT)).every(Boolean)).toBe(true);
    expect(steamShellOpen(-1, 5)).toBe(false);
    expect(steamShellOpen(STEAM_SHELL_COUNT, 99)).toBe(false);
    expect(steamShellOpen(0, 0)).toBe(false);
  });
});

describe("words", () => {
  it("idle: the instruction of each operation; a too-early lift says to steam a bit longer", () => {
    expect(steamTitle("lid", live({}), false)).toMatch(/ふた/);
    expect(steamTitle("shake", live({}), false)).toMatch(/ゆす/);
    expect(steamTitle("lid", live({}), true)).toBe("もう少し蒸してね");
    expect(steamTitle("shake", live({}), true)).toBe("もう少し蒸してね");
  });
  it("steaming: the short live word of the look; done: the result words", () => {
    expect(steamTitle("lid", live({ mode: "steaming", look: "partial" }), false)).toBe(STEAM_LOOK_LIVE.partial);
    for (const look of ["closed", "partial", "open", "over"] as const) expect(steamTitle("shake", live({ mode: "done", look }), false)).toBe(STEAM_LOOK_COPY[look]);
  });
  it("no digits, grades or countdowns anywhere in what the screen says or announces", () => {
    const all: string[] = [];
    for (const variant of ["lid", "shake"] as const) {
      for (const mode of ["idle", "steaming", "done"] as const) {
        for (const look of ["closed", "partial", "open", "over"] as const) {
          all.push(steamTitle(variant, live({ mode, look }), false), steamTitle(variant, live({ mode, look }), true), steamAnnouncement(variant, live({ mode, look })));
        }
      }
    }
    expect(all.join("|")).not.toMatch(/\d|成功|失敗|ベスト|おしい|惜しい|完璧|ジャスト|%|秒/);
  });
});
