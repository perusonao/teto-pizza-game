import { describe, expect, it } from "vitest";
import {
  STEAM_V3_BATCHES,
  STEAM_V3_EXPOSURE_PER_SECOND,
  STEAM_V3_IDLE,
  STEAM_V3_LAYOUTS,
  STEAM_V3_PROGRESS_PER_SECOND,
  STEAM_V3_WOBBLE_LEAD,
  steamV3LayoutForRound,
  steamV3Reducer,
  steamV3Snapshot,
  steamV3Stars,
  type SteamV3Batch,
  type SteamV3Heat,
  type SteamV3Result,
  type SteamV3State,
} from "./steamGameV3";

/**
 * A fixed-reaction player driving the real reducer (no randomness): it sees a shell turn ready, taps it `react` ms later, and needs `gap` ms
 * between two taps (moving the finger). A heat change is a tap too. Policies:
 * - low / high: never changes heat;
 * - plan: high while nothing is ready or wobbling in a group, low as soon as 2+ shells are ready or wobbling together (the V3 route).
 */
type Policy = "low" | "high" | "plan";
function play(batch: SteamV3Batch, policy: Policy, react: number, gap = 300, layout = 0): SteamV3Result {
  const t0 = 1_000;
  let t = t0;
  let s: SteamV3State = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: t, batch, layout, heat: policy === "low" ? "low" : "high" });
  const planned = new Map<number, number>();
  let nextFree = t;
  let heatPlan: { at: number; heat: SteamV3Heat } | null = null;
  const seen = new Set<number>();
  for (; t < t0 + 30_000; t += 5) {
    const snap = steamV3Snapshot(s, t);
    snap.shells.forEach((st, i) => {
      if (st === "ready" && !seen.has(i)) {
        seen.add(i);
        const at = Math.max(t + react, nextFree);
        planned.set(i, at);
        nextFree = at + gap;
      }
    });
    if (policy === "plan" && s.status === "cooking") {
      const want: SteamV3Heat = snap.readyCount + snap.wobbleCount >= 2 ? "low" : "high";
      if (want !== s.heat && !heatPlan) {
        const at = Math.max(t + react * 0.8, nextFree);
        heatPlan = { at, heat: want };
        nextFree = at + gap;
      }
      if (heatPlan && t >= heatPlan.at) {
        s = steamV3Reducer(s, { type: "SET_HEAT", now: t, heat: heatPlan.heat });
        heatPlan = null;
      }
    }
    for (const [i, at] of planned) {
      if (t >= at) {
        s = steamV3Reducer(s, { type: "PICK", now: t, index: i });
        planned.delete(i);
      }
    }
    const after = steamV3Snapshot(s, t);
    if (seen.size === 5 && planned.size === 0 && after.shells.every((x) => x === "rescued" || x === "over")) {
      const end = Math.max(t, nextFree) + react;
      const r = steamV3Reducer(s, { type: "OPEN", now: end });
      if (r.status !== "released") throw new Error("not released");
      return r.result;
    }
  }
  throw new Error("did not finish");
}

describe("V3 batches: one readable rule", () => {
  it.each(["clam", "mussel"] as const)("%s: shells open in size order; same size opens together (≤0.01 apart), different sizes ≥0.2 apart", (b) => {
    const shells = STEAM_V3_BATCHES[b].shells;
    for (let i = 1; i < shells.length; i++) {
      expect(shells[i].opensAt).toBeGreaterThan(shells[i - 1].opensAt);
      expect(shells[i].size).toBeGreaterThanOrEqual(shells[i - 1].size);
      const gap = shells[i].opensAt - shells[i - 1].opensAt;
      if (shells[i].sizeClass === shells[i - 1].sizeClass) {
        expect(shells[i].size).toBe(shells[i - 1].size);
        expect(gap).toBeLessThanOrEqual(0.0100001);
      } else {
        expect(shells[i].size / shells[i - 1].size).toBeGreaterThanOrEqual(1.12);
        expect(gap).toBeGreaterThanOrEqual(0.2);
      }
    }
  });
  it("clam has a trio of medium shells; mussel has two pairs (small, large)", () => {
    const groups = (b: SteamV3Batch) => STEAM_V3_BATCHES[b].shells.map((s) => s.sizeClass).join(",");
    expect(groups("clam")).toBe("small,medium,medium,medium,large");
    expect(groups("mussel")).toBe("small,small,medium,large,large");
  });
  it("initial tuning is the Owner-approved starting point (V2 progress speeds unchanged)", () => {
    expect(STEAM_V3_PROGRESS_PER_SECOND).toEqual({ low: 0.12, high: 0.22 });
    expect(STEAM_V3_EXPOSURE_PER_SECOND).toEqual({ low: 0.32, high: 1.2 });
    expect(STEAM_V3_BATCHES.clam.starTimeMs).toBe(6000);
    expect(STEAM_V3_BATCHES.mussel.starTimeMs).toBe(6800);
  });
  it("rescue windows: high ≥ 0.70 s (the tightest, small shells), low ≥ 2.6 s", () => {
    for (const b of ["clam", "mussel"] as const) {
      for (const s of STEAM_V3_BATCHES[b].shells) {
        expect(s.tolerance / STEAM_V3_EXPOSURE_PER_SECOND.high).toBeGreaterThanOrEqual(0.7);
        expect(s.tolerance / STEAM_V3_EXPOSURE_PER_SECOND.low).toBeGreaterThanOrEqual(2.6);
      }
    }
  });
});

describe("V3 layouts: three fixed, rotated, never the reading order", () => {
  it("each layout is a permutation of 0..4, differs from 0,1,2,3,4 and puts the first shell on a different spot", () => {
    expect(STEAM_V3_LAYOUTS).toHaveLength(3);
    const firstSpots = new Set<number>();
    for (const l of STEAM_V3_LAYOUTS) {
      expect([...l].sort()).toEqual([0, 1, 2, 3, 4]);
      expect(l).not.toEqual([0, 1, 2, 3, 4]);
      firstSpots.add(l.indexOf(0));
    }
    expect(firstSpots.size).toBe(3);
  });
  it("round → layout rotates 0,1,2,0 and rejects odd input", () => {
    expect([0, 1, 2, 3, 4].map(steamV3LayoutForRound)).toEqual([0, 1, 2, 0, 1]);
    expect(steamV3LayoutForRound(-1)).toBe(0);
    expect(steamV3LayoutForRound(1.5)).toBe(0);
  });
  it("START keeps the layout; an invalid layout falls back to 0", () => {
    const s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 2 });
    expect(steamV3Snapshot(s, 0).layout).toBe(2);
    const bad = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 9 });
    expect(steamV3Snapshot(bad, 0).layout).toBe(0);
  });
});

describe("V3 pre-open wobble", () => {
  it("a closed shell wobbles from opensAt − lead, about 0.27 s ahead on high", () => {
    const s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 0, heat: "high" });
    const first = STEAM_V3_BATCHES.clam.shells[0].opensAt;
    const wobbleAt = ((first - STEAM_V3_WOBBLE_LEAD) / 0.22) * 1000;
    const openAt = (first / 0.22) * 1000;
    expect(steamV3Snapshot(s, wobbleAt - 5).wobbling[0]).toBe(false);
    expect(steamV3Snapshot(s, wobbleAt + 5).wobbling[0]).toBe(true);
    expect(steamV3Snapshot(s, wobbleAt + 5).shells[0]).toBe("closed");
    expect(openAt - wobbleAt).toBeGreaterThan(260);
    expect(steamV3Snapshot(s, openAt + 5).shells[0]).toBe("ready");
    expect(steamV3Snapshot(s, openAt + 5).wobbling[0]).toBe(false);
  });
  it("the clam trio wobbles together (3 at once) before it opens", () => {
    const s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 0, heat: "high" });
    const t = ((0.52 - STEAM_V3_WOBBLE_LEAD + 0.005) / 0.22) * 1000;
    expect(steamV3Snapshot(s, t).wobbling.slice(1, 4)).toEqual([true, true, true]);
  });
});

describe("V3 stars", () => {
  it("★★★ = 5/5 within the star time; ★★ = 5/5 slower; ★ = 3–4; none = 0–2; fewer shells never match 5/5", () => {
    expect(steamV3Stars(5, 6000, 6000)).toBe(3);
    expect(steamV3Stars(5, 6001, 6000)).toBe(2);
    expect(steamV3Stars(4, 1000, 6000)).toBe(1);
    expect(steamV3Stars(3, 1000, 6000)).toBe(1);
    expect(steamV3Stars(2, 1000, 6000)).toBe(0);
    expect(steamV3Stars(0, 1000, 6000)).toBe(0);
  });
  it.each(["clam", "mussel"] as const)("%s: low heat alone can never reach ★★★, even with zero reaction time", (b) => {
    const last = Math.max(...STEAM_V3_BATCHES[b].shells.map((s) => s.opensAt));
    expect((last / STEAM_V3_PROGRESS_PER_SECOND.low) * 1000).toBeGreaterThan(STEAM_V3_BATCHES[b].starTimeMs);
  });
});

describe("V3 fixed-reaction scenarios (design §3.3, repeatable)", () => {
  // [batch, policy, reaction ms] → [rescued, stars]
  const cases: Array<[SteamV3Batch, Policy, number, number, number]> = [
    ["clam", "low", 400, 5, 2],
    ["clam", "low", 900, 5, 2],
    ["clam", "high", 400, 4, 1],
    ["clam", "plan", 400, 5, 3],
    ["clam", "plan", 600, 5, 3],
    ["mussel", "low", 400, 5, 2],
    ["mussel", "low", 900, 5, 2],
    ["mussel", "high", 900, 2, 0],
    ["mussel", "plan", 400, 5, 3],
    ["mussel", "plan", 600, 5, 3],
  ];
  it.each(cases)("%s / %s / react %ims → %i shells, %i stars", (batch, policy, react, rescued, stars) => {
    const r = play(batch, policy, react);
    expect(r.rescuedCount).toBe(rescued);
    expect(r.stars).toBe(stars);
  });
  it("the layout does not change the outcome (positions are cosmetic for the model)", () => {
    for (const layout of [0, 1, 2]) expect(play("clam", "plan", 600, 300, layout).stars).toBe(3);
  });
  it("a planned switcher finishes well ahead of a low-only player, who still saves all five", () => {
    const low = play("clam", "low", 600);
    const plan = play("clam", "plan", 600);
    expect(low.rescuedCount).toBe(5);
    expect(low.elapsedMs - plan.elapsedMs).toBeGreaterThan(1500);
  });
  it("same input → same result (deterministic)", () => {
    expect(play("mussel", "plan", 500)).toEqual(play("mussel", "plan", 500));
  });
});

describe("V3 result breakdown", () => {
  it("separates rescued / overcooked / missed / never-opened, and advises on the most common failure", () => {
    let s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 0, heat: "high" });
    // small opens at ~1.18 s on high: take it
    s = steamV3Reducer(s, { type: "PICK", now: 1300, index: 0 });
    // the trio opens at ~2.27–2.36 s; wait until they shrivel (window 0.875 s), lift at 3.4 s before the large (3.64 s) opens
    const r = steamV3Reducer(s, { type: "OPEN", now: 3400 });
    if (r.status !== "released") throw new Error();
    expect(r.result.shells).toEqual(["rescued", "over", "over", "over", "closed"]);
    expect([r.result.rescuedCount, r.result.overCount, r.result.missedCount, r.result.closedCount]).toEqual([1, 3, 0, 1]);
    expect(r.result.stars).toBe(0);
    expect(r.result.advice).toBe("over");
  });
  it("an open shell left in the pot is missed; lifting too early advises waiting; 5/5 slow advises speed, fast is master", () => {
    const s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 0, heat: "low" });
    const r = steamV3Reducer(s, { type: "OPEN", now: 2300 });
    if (r.status !== "released") throw new Error();
    expect(r.result.shells).toEqual(["missed", "closed", "closed", "closed", "closed"]);
    expect(r.result.advice).toBe("closed"); // four never opened: the most common failure is lifting the lid too early
    const late = steamV3Reducer(s, { type: "OPEN", now: 6800 });
    if (late.status !== "released") throw new Error();
    expect(late.result.shells).toEqual(["over", "missed", "missed", "missed", "missed"]);
    expect(late.result.advice).toBe("missed");
    expect(play("clam", "low", 400).advice).toBe("faster");
    expect(play("clam", "plan", 400).advice).toBe("master");
  });
});

describe("V3 reducer guards", () => {
  it("rejects bad batch, time going backwards, out-of-range picks; INTERRUPT drops a running pot", () => {
    expect(steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "x" as SteamV3Batch, layout: 0 })).toBe(STEAM_V3_IDLE);
    const s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 100, batch: "mussel", layout: 1 });
    expect(steamV3Reducer(s, { type: "SET_HEAT", now: 50, heat: "high" })).toBe(s);
    expect(steamV3Reducer(s, { type: "PICK", now: 200, index: 7 })).toBe(s);
    expect(steamV3Reducer(s, { type: "INTERRUPT" })).toBe(STEAM_V3_IDLE);
  });
  it("picking a closed or overcooked shell changes nothing but time", () => {
    const s = steamV3Reducer(STEAM_V3_IDLE, { type: "START", now: 0, batch: "clam", layout: 0, heat: "high" });
    const closed = steamV3Reducer(s, { type: "PICK", now: 200, index: 4 });
    expect(steamV3Snapshot(closed, 200).shells[4]).toBe("closed");
    const over = steamV3Reducer(s, { type: "PICK", now: 2300, index: 0 });
    expect(steamV3Snapshot(over, 2300).shells[0]).toBe("over");
    expect(steamV3Snapshot(over, 2300).rescuedCount).toBe(0);
  });
});
