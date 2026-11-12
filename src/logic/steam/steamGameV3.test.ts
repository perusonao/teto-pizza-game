import { describe, expect, it } from "vitest";
import {
  STEAM_V3_BATCHES, STEAM_V3_GOALS, STEAM_V3_IDLE, STEAM_V3_LAYOUTS, STEAM_V3_PROGRESS_PER_SECOND, STEAM_V3_SIZE_SCALE, STEAM_V3_TELL,
  STEAM_V3_WINDOWS, steamV3Advice, steamV3Reducer, steamV3Snapshot, steamV3Spots, steamV3WindowFromQuery,
  type SteamV3Action, type SteamV3Batch, type SteamV3Heat, type SteamV3State, type SteamV3Window,
} from "./steamGameV3";

const T = 10_000;
const BATCHES: SteamV3Batch[] = ["clam", "mussel"];
const WINDOWS: SteamV3Window[] = ["standard", "loose", "tight"];
const run = (actions: SteamV3Action[]): SteamV3State => actions.reduce(steamV3Reducer, STEAM_V3_IDLE as SteamV3State);
const start = (batch: SteamV3Batch, heat: SteamV3Heat = "low", layout = 0, window: SteamV3Window = "standard"): SteamV3Action =>
  ({ type: "START", now: T, batch, heat, layout, window });
/** ms after START at which the spot's shell is fully open, at a constant heat. */
const openMs = (batch: SteamV3Batch, layout: number, spot: number, heat: SteamV3Heat) =>
  Math.ceil((steamV3Spots(batch, layout)[spot].opensAt / STEAM_V3_PROGRESS_PER_SECOND[heat]) * 1000) + 1;
const result = (s: SteamV3State) => {
  if (s.status !== "released") throw new Error(`not released: ${s.status}`);
  return s.result;
};

/** Pick every shell the instant it opens at a constant heat, then open the lid at once: the fastest possible 5/5 on that heat. */
function perfectAt(batch: SteamV3Batch, heat: SteamV3Heat, layout = 0, window: SteamV3Window = "standard") {
  const picks = [0, 1, 2, 3, 4].map((spot) => ({ spot, at: openMs(batch, layout, spot, heat) })).sort((a, b) => a.at - b.at);
  const last = picks[picks.length - 1].at;
  return result(run([
    start(batch, heat, layout, window),
    ...picks.map(({ spot, at }): SteamV3Action => ({ type: "PICK", index: spot, now: T + at })),
    { type: "OPEN", now: T + last },
  ]));
}

describe("V3 batches: size tells the opening order", () => {
  it.each(BATCHES)("%s: opening order is small, then medium, then large, and sizes differ by about 20%%", (batch) => {
    const shells = STEAM_V3_BATCHES[batch].shells;
    const order = { small: 0, medium: 1, large: 2 };
    for (let i = 1; i < shells.length; i++) {
      expect(shells[i].opensAt).toBeGreaterThan(shells[i - 1].opensAt);
      expect(order[shells[i].size]).toBeGreaterThanOrEqual(order[shells[i - 1].size]);
    }
    expect(STEAM_V3_SIZE_SCALE.medium / STEAM_V3_SIZE_SCALE.small).toBeGreaterThanOrEqual(1.2);
    expect(STEAM_V3_SIZE_SCALE.large / STEAM_V3_SIZE_SCALE.medium).toBeGreaterThanOrEqual(1.18);
  });

  it("the two batches have the designed rhythms (clam pair-pair-one, mussel one-pair-pair)", () => {
    expect(STEAM_V3_BATCHES.clam.shells.map((s) => s.size)).toEqual(["small", "small", "medium", "medium", "large"]);
    expect(STEAM_V3_BATCHES.mussel.shells.map((s) => s.size)).toEqual(["small", "medium", "medium", "large", "large"]);
  });
});

describe("V3 layouts: four fixed, never the spot order", () => {
  it("each layout is a permutation of 1..5 and none is 1,2,3,4,5", () => {
    expect(STEAM_V3_LAYOUTS).toHaveLength(4);
    for (const l of STEAM_V3_LAYOUTS) {
      expect([...l].sort()).toEqual([1, 2, 3, 4, 5]);
      expect(l).not.toEqual([1, 2, 3, 4, 5]);
    }
  });
  it("the first shell to open is at a different spot in every layout", () => {
    expect(new Set(STEAM_V3_LAYOUTS.map((l) => l.indexOf(1))).size).toBe(4);
  });
  it("the layout index wraps, so a round counter can grow without bound; same input, same pot", () => {
    for (const batch of BATCHES) {
      expect(steamV3Spots(batch, 4)).toEqual(steamV3Spots(batch, 0));
      expect(steamV3Spots(batch, -1)).toEqual(steamV3Spots(batch, 3));
    }
    const a = run([start("clam", "high", 2), { type: "PICK", index: 1, now: T + 1300 }]);
    const b = run([start("clam", "high", 2), { type: "PICK", index: 1, now: T + 1300 }]);
    expect(a).toEqual(b);
  });
});

describe("V3 low heat is safe but never the top grade (design §2.1 invariant)", () => {
  it.each(BATCHES.flatMap((b) => WINDOWS.flatMap((w) => [0, 1, 2, 3].map((l) => [b, w, l] as const))))(
    "%s / %s window / layout %i: the fastest possible low-only 5/5 is still ★★", (batch, window, layout) => {
      const r = perfectAt(batch, "low", layout, window);
      expect(r.rescuedCount).toBe(5);
      expect(r.grade).toBe("two");
      expect(r.elapsedMs).toBeGreaterThan(STEAM_V3_GOALS[batch].three);
    });

  it.each(BATCHES)("%s: the low-heat rescue window is at least 2.5 s for every shell, in every preset", (batch) => {
    for (const w of WINDOWS) for (const s of STEAM_V3_BATCHES[batch].shells) expect(s.tolerance / STEAM_V3_WINDOWS[w].low).toBeGreaterThanOrEqual(2.5);
  });
});

describe("V3 strong heat: fast but narrow (provisional window presets)", () => {
  it.each(BATCHES)("%s: the fastest strong-heat 5/5 is 名人", (batch) => {
    expect(perfectAt(batch, "high").grade).toBe("master");
  });
  it("standard strong-heat windows are the designed 0.67-0.96 s; loose is wider and tight narrower", () => {
    const windows = (w: SteamV3Window) => BATCHES.flatMap((b) => STEAM_V3_BATCHES[b].shells.map((s) => s.tolerance / STEAM_V3_WINDOWS[w].high));
    expect(Math.min(...windows("standard"))).toBeCloseTo(0.667, 2);
    expect(Math.max(...windows("standard"))).toBeCloseTo(0.963, 2);
    expect(Math.min(...windows("loose"))).toBeGreaterThan(Math.min(...windows("standard")));
    expect(Math.max(...windows("tight"))).toBeLessThan(Math.max(...windows("standard")));
  });
  it("only the strong-heat shrink differs between presets", () => {
    for (const w of WINDOWS) expect(STEAM_V3_WINDOWS[w].low).toBe(STEAM_V3_WINDOWS.standard.low);
  });
  it("waiting on strong heat shrinks every shell (0/5) and the advice names strong heat", () => {
    const r = result(run([start("clam", "high"), { type: "OPEN", now: T + 6000 }]));
    expect(r.shells).toEqual(Array(5).fill("over"));
    expect(r).toMatchObject({ rescuedCount: 0, grade: "none", overOnHigh: 5, overOnLow: 0, usedHigh: true });
    expect(steamV3Advice(r)).toContain("弱火");
  });
});

describe("V3 switching heat is the route to ★★★ for a moderately quick player", () => {
  it("clam, layout 0: strong while nothing is open, low for the small pair, strong again -> ★★★ (design §2.4 trace)", () => {
    const spots = steamV3Spots("clam", 0);
    const at = (rank: number) => spots.findIndex((s) => s === STEAM_V3_BATCHES.clam.shells[rank - 1]);
    const r = result(run([
      start("clam", "high"),
      { type: "SET_HEAT", heat: "low", now: T + 1720 },
      { type: "PICK", index: at(1), now: T + 2030 },
      { type: "PICK", index: at(2), now: T + 2330 },
      { type: "PICK", index: at(3), now: T + 3600 },
      { type: "PICK", index: at(4), now: T + 4100 },
      { type: "SET_HEAT", heat: "high", now: T + 4410 },
      { type: "SET_HEAT", heat: "low", now: T + 5320 },
      { type: "PICK", index: at(5), now: T + 5620 },
      { type: "OPEN", now: T + 6830 },
    ]));
    expect(r).toMatchObject({ rescuedCount: 5, grade: "three" });
  });
});

describe("V3 tell, statuses and the result", () => {
  it("a shell tells (wobbles) for STEAM_V3_TELL of progress before it opens, and a tell cannot be picked", () => {
    const spot = STEAM_V3_LAYOUTS[0].indexOf(1);
    const opensMs = (STEAM_V3_BATCHES.clam.shells[0].opensAt / STEAM_V3_PROGRESS_PER_SECOND.low) * 1000;
    const tellMs = ((STEAM_V3_BATCHES.clam.shells[0].opensAt - STEAM_V3_TELL) / STEAM_V3_PROGRESS_PER_SECOND.low) * 1000;
    const s = run([start("clam")]);
    expect(steamV3Snapshot(s, T + tellMs - 20).shells[spot]).toBe("closed");
    expect(steamV3Snapshot(s, T + tellMs + 20).shells[spot]).toBe("tell");
    expect(opensMs - tellMs).toBeGreaterThan(600); // ~0.67 s warning on low heat
    const tapped = steamV3Reducer(s, { type: "PICK", index: spot, now: T + tellMs + 20 });
    expect(steamV3Snapshot(tapped, T + tellMs + 20).shells[spot]).toBe("tell");
    expect(steamV3Snapshot(tapped, T + opensMs + 20).shells[spot]).toBe("ready");
  });

  it("opening the lid: open shells become missed, wobbling ones stay closed; the elapsed time is START to OPEN", () => {
    const s = run([start("clam", "low"), { type: "OPEN", now: T + 2500 }]);
    const r = result(s);
    expect(r.elapsedMs).toBe(2500);
    expect(r.shells.filter((x) => x === "missed")).toHaveLength(1);
    expect(r.shells.filter((x) => x === "closed")).toHaveLength(4);
    expect(r.grade).toBe("none");
  });

  it("a shrunk shell records the heat it shrank on; mixed heats are counted apart", () => {
    // Low heat: small pair opens ~2.5 s / 3.0 s and shrinks after ~2.7 s; leave them, then switch to strong for the rest.
    const r = result(run([start("clam", "low"), { type: "SET_HEAT", heat: "high", now: T + 6000 }, { type: "OPEN", now: T + 12_000 }]));
    expect(r.overOnLow + r.overOnHigh).toBe(5);
    expect(r.overOnLow).toBeGreaterThanOrEqual(1);
    expect(r.overOnHigh).toBeGreaterThanOrEqual(1);
  });

  it("advice is specific to the outcome", () => {
    expect(steamV3Advice(perfectAt("clam", "high"))).toContain("名人");
    expect(steamV3Advice(perfectAt("clam", "low"))).toContain("強火も使ってみよう");
    const missed = result(run([start("clam", "low"), { type: "OPEN", now: T + 2600 }]));
    expect(steamV3Advice(missed)).toContain("開いた貝を取ってから");
    const closed = result(run([start("clam", "low"), { type: "OPEN", now: T + 500 }]));
    expect(steamV3Advice(closed)).toContain("小さい貝から開く");
  });

  it("starting heat can be chosen; invalid actions leave the state alone; nothing is persisted", () => {
    expect(run([start("clam", "high")])).toMatchObject({ status: "cooking", heat: "high", usedHigh: true });
    expect(run([start("clam", "low")])).toMatchObject({ heat: "low", usedHigh: false });
    const bad: SteamV3Action[] = [
      { type: "START", now: Number.NaN, batch: "clam", heat: "low", layout: 0, window: "standard" },
      { type: "START", now: T, batch: "oyster" as SteamV3Batch, heat: "low", layout: 0, window: "standard" },
      { type: "START", now: T, batch: "clam", heat: "medium" as SteamV3Heat, layout: 0, window: "standard" },
      { type: "START", now: T, batch: "clam", heat: "low", layout: 0.5, window: "standard" },
      { type: "START", now: T, batch: "clam", heat: "low", layout: 0, window: "huge" as SteamV3Window },
    ];
    for (const a of bad) expect(steamV3Reducer(STEAM_V3_IDLE, a)).toBe(STEAM_V3_IDLE);
    const cooking = run([start("clam")]);
    expect(steamV3Reducer(cooking, { type: "PICK", index: 7, now: T + 100 })).toBe(cooking);
    expect(steamV3Reducer(cooking, { type: "OPEN", now: T - 1 })).toBe(cooking);
    expect(steamV3Reducer(cooking, { type: "INTERRUPT" })).toBe(STEAM_V3_IDLE);
  });
});

describe("V3 provisional window from the URL", () => {
  it.each([
    ["", "standard"], ["?steamV3Window=loose", "loose"], ["?steamV3Window=tight", "tight"],
    ["?steamV3Window=LOOSE", "standard"], ["?steamV3Window=loose&steamV3Window=tight", "standard"], ["?steamV3Window=huge", "standard"],
  ])("%s -> %s", (q, w) => {
    expect(steamV3WindowFromQuery(q)).toBe(w);
  });
});
