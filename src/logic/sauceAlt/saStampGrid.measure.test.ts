import { describe, expect, it } from "vitest";
import { getReferencePizza } from "../../data/referencePizza";
import { createIdealDoughShape } from "../doughShape";
import { SauceDispenseController, type SauceDeposit } from "../sauceDispenseController";
import { computeSauceMetrics } from "../sauceField";
import { SAUCE_MAX_QUANTITY } from "../sauceQuantity";
import { scoreSauceComponentV2 } from "../scoringV2/sauceComponent";
import { buildIdealSauceFixture } from "../../data/referencePizza";
import { createInitialGameState, gameReducer } from "../../state/gameReducer";
import { isValidSauceDepositBatch } from "../../state/pizzaState";
import { buildPendingRound, pendingRoundByteLength, PENDING_ROUND_MAX_BYTES } from "../../state/pendingRound";

/**
 * T9 (#784) S-A, M1: a SYNTHETIC grid measurement of what a "stamp" way of putting sauce on would do to Scoring 2.0's sauce component and to the Reference,
 * next to synthetic natural gestures. MEASUREMENT ONLY: it reads the production functions (computeSauceMetrics, scoreSauceComponentV2, the dispense
 * controller, the reducer's COMMIT_SAUCE_DISPENSE, the pending-round journal) and changes none of them; nothing here is a rule, a default or a design choice.
 * The Owner has NOT decided the stamp count, placement, duplicate policy or how much advantage a stamp may give (S6).
 *
 * Honest limits: the "natural" rows are gestures I assumed (spirals, rings, a seeded scribble) run through the real controller on a fake clock -- they are not
 * human data (that is M2, an Owner iPhone observation). A stamp is modelled as `k` deposits (centre + a ring of radius R). Nothing here says how a stamp
 * would be drawn or tapped. The summary lines (prefixed M1|) are read from the test output into docs/reports; they are not written to disk by this file.
 */
const reference = getReferencePizza("margherita")!.sauce!;

interface Pt { x: number; y: number }
const score = (deposits: readonly SauceDeposit[]): number => scoreSauceComponentV2(computeSauceMetrics(deposits), reference).score;
const total = (deposits: readonly SauceDeposit[]): number => deposits.reduce((a, d) => a + d.amount, 0);

/** A tiny deterministic generator (no Math.random: the run must be repeatable). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Run a finger path through the REAL controller on a fake clock (50 ms ticks, 0.02 each, capped at 1.0). */
function simulate(path: (tMs: number) => Pt, durationMs: number): SauceDeposit[] {
  const out: SauceDeposit[] = [];
  let sum = 0;
  const c = new SauceDispenseController({ onDeposit: (d) => { out.push({ ...d }); sum += d.amount; }, getTotalDispensed: () => sum });
  const t0 = 1000;
  c.start(t0, path(0));
  for (let t = 16; t <= durationMs; t += 16) {
    c.move(path(t), t0 + t);
    c.step(t0 + t);
  }
  c.stop();
  return out;
}

function naturalGestures(): { name: string; deposits: SauceDeposit[] }[] {
  const list: { name: string; deposits: SauceDeposit[] }[] = [];
  for (const turns of [1.5, 2.5, 3.5]) for (const dur of [1200, 1800, 2400, 3000]) for (const rmax of [30, 36, 42]) {
    list.push({ name: `spiral t${turns} d${dur} r${rmax}`, deposits: simulate((t) => { const k = Math.min(1, t / dur); const a = k * Math.PI * 2 * turns; return { x: 50 + Math.cos(a) * rmax * k, y: 50 + Math.sin(a) * rmax * k }; }, dur) });
  }
  for (const rr of [20, 30, 40, 45]) list.push({ name: `ring r${rr}`, deposits: simulate((t) => { const a = (t / 2400) * Math.PI * 2 * 2; return { x: 50 + Math.cos(a) * rr, y: 50 + Math.sin(a) * rr }; }, 2400) });
  for (let seed = 1; seed <= 20; seed += 1) {
    const rnd = lcg(seed);
    let p: Pt = { x: 50, y: 50 };
    const pts: Pt[] = [];
    for (let i = 0; i <= 160; i += 1) { p = { x: Math.min(88, Math.max(12, p.x + (rnd() - 0.5) * 16)), y: Math.min(88, Math.max(12, p.y + (rnd() - 0.5) * 16)) }; pts.push(p); }
    list.push({ name: `scribble s${seed}`, deposits: simulate((t) => pts[Math.min(pts.length - 1, Math.floor(t / 15))], 2400) });
  }
  for (const dur of [600, 1200, 2400]) list.push({ name: `hold centre ${dur}`, deposits: simulate(() => ({ x: 50, y: 50 }), dur) });
  return list;
}

type Layout = { id: string; points: (n: number) => Pt[] };
const ring = (rho: number): Layout => ({ id: `ring${rho}`, points: (n) => [{ x: 50, y: 50 }, ...Array.from({ length: n - 1 }, (_, i) => ({ x: 50 + Math.cos((i / (n - 1)) * Math.PI * 2) * rho, y: 50 + Math.sin((i / (n - 1)) * Math.PI * 2) * rho }))] });
const scatter = (seed: number): Layout => ({ id: `scatter${seed}`, points: (n) => { const r = lcg(seed); return Array.from({ length: n }, () => { const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * 30; return { x: 50 + Math.cos(a) * d, y: 50 + Math.sin(a) * d }; }); } });
const LAYOUTS: Layout[] = [ring(16), ring(22), ring(28), ring(34), scatter(1), scatter(2), scatter(3)];

function stampDeposits(layout: Layout, n: number, R: number, k: number, amountPolicy: "total0.92" | "tick0.02", dup: number): SauceDeposit[] {
  const centres = layout.points(n);
  const order = [...centres, ...Array.from({ length: dup }, () => centres[0])];
  const per = amountPolicy === "total0.92" ? 0.92 / (n * k) : 0.02;
  const out: SauceDeposit[] = [];
  let sum = 0;
  for (const c of order) {
    for (let i = 0; i < k; i += 1) {
      if (sum >= SAUCE_MAX_QUANTITY - 1e-9) return out; // the bottle is empty (same cap as the controller)
      const amount = Math.min(per, SAUCE_MAX_QUANTITY - sum);
      const a = (i / Math.max(1, k - 1)) * Math.PI * 2;
      out.push(i === 0 ? { x: c.x, y: c.y, amount } : { x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R, amount });
      sum += amount;
    }
  }
  return out;
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))]; };
const f1 = (n: number) => Math.round(n * 10) / 10;

describe("S-A M1 -- the measurement reads production code and changes none of it", () => {
  it("the Reference target and the ideal fixture are the production values (guard: if these move, this measurement is stale)", () => {
    expect(reference.quantity).toBe(0.92);
    expect(reference.coverage).toBe(0.72);
    const m = computeSauceMetrics(buildIdealSauceFixture());
    expect(m.quantity).toBeCloseTo(0.92, 6);
    expect(m.coverage).toBeCloseTo(0.718, 3);
    expect(score(buildIdealSauceFixture())).toBeGreaterThan(99);
  });
});

describe("S-A M1 -- synthetic natural gestures through the real dispense controller", () => {
  const natural = naturalGestures();
  const scores = natural.map((g) => score(g.deposits));
  it("every natural run is valid, within the 1.0 bottle cap, deterministic and scores within 0..100", () => {
    for (const g of natural) {
      expect(isValidSauceDepositBatch(g.deposits), g.name).toBe(true);
      expect(total(g.deposits), g.name).toBeLessThanOrEqual(SAUCE_MAX_QUANTITY + 1e-9);
    }
    for (const s of scores) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100); }
    expect(naturalGestures().map((g) => score(g.deposits))).toEqual(scores);
  });
  it("prints the distribution of the assumed (non-human) natural gestures", () => {
    const families = ["spiral", "ring", "scribble", "hold"];
    for (const fam of families) {
      const xs = natural.filter((g) => g.name.startsWith(fam)).map((g) => score(g.deposits));
      console.log(`M1|natural|${fam}|n=${xs.length}|min=${f1(Math.min(...xs))}|p25=${f1(pct(xs, 0.25))}|median=${f1(pct(xs, 0.5))}|p75=${f1(pct(xs, 0.75))}|max=${f1(Math.max(...xs))}`);
    }
    console.log(`M1|natural|ALL|n=${scores.length}|min=${f1(Math.min(...scores))}|p25=${f1(pct(scores, 0.25))}|median=${f1(pct(scores, 0.5))}|p75=${f1(pct(scores, 0.75))}|max=${f1(Math.max(...scores))}`);
    expect(scores.length).toBeGreaterThan(50);
  });
});

describe("S-A M1 -- the stamp parameter grid", () => {
  const natural = naturalGestures().map((g) => score(g.deposits));
  const nMedian = pct(natural, 0.5);
  const nP75 = pct(natural, 0.75);
  const nMax = Math.max(...natural);
  interface Row { layout: string; n: number; R: number; k: number; amt: string; dup: number; deposits: number; qty: number; score: number }
  const rows: Row[] = [];
  for (const layout of LAYOUTS) for (const n of [3, 5, 7, 9]) for (const R of [6, 8, 10, 12]) for (const k of [5, 7, 9]) for (const amt of ["total0.92", "tick0.02"] as const) for (const dup of [0, 1, 2]) {
    const d = stampDeposits(layout, n, R, k, amt, dup);
    rows.push({ layout: layout.id, n, R, k, amt, dup, deposits: d.length, qty: total(d), score: score(d) });
  }

  it("covers the whole grid", () => {
    expect(rows.length).toBe(LAYOUTS.length * 4 * 4 * 3 * 2 * 3);
  });
  it("every stamp set is a valid commit batch, within the bottle cap, deterministic, and scores within 0..100", () => {
    for (const layout of LAYOUTS) for (const n of [3, 9]) {
      const d = stampDeposits(layout, n, 8, 7, "total0.92", 1);
      expect(isValidSauceDepositBatch(d)).toBe(true);
      expect(total(d)).toBeLessThanOrEqual(SAUCE_MAX_QUANTITY + 1e-9);
      expect(stampDeposits(layout, n, 8, 7, "total0.92", 1)).toEqual(d);
    }
    for (const r of rows) { expect(r.score).toBeGreaterThanOrEqual(0); expect(r.score).toBeLessThanOrEqual(100); expect(r.qty).toBeLessThanOrEqual(SAUCE_MAX_QUANTITY + 1e-9); }
  });
  it("prints the grid summary (by stamp count, layout, stamp size, deposits per stamp, amount policy, duplicates)", () => {
    const line = (tag: string, key: string, xs: Row[]) => {
      const s = xs.map((r) => r.score);
      const geMed = xs.filter((r) => r.score >= nMedian).length / xs.length;
      const gtMax = xs.filter((r) => r.score > nMax).length / xs.length;
      console.log(`M1|grid|${tag}=${key}|n=${xs.length}|min=${f1(Math.min(...s))}|median=${f1(pct(s, 0.5))}|max=${f1(Math.max(...s))}|share>=natMedian=${f1(geMed * 100)}%|share>natMax=${f1(gtMax * 100)}%`);
    };
    console.log(`M1|baseline|natural median=${f1(nMedian)} p75=${f1(nP75)} max=${f1(nMax)} (synthetic, not human)`);
    for (const n of [3, 5, 7, 9]) line("N", String(n), rows.filter((r) => r.n === n));
    for (const l of LAYOUTS) line("layout", l.id, rows.filter((r) => r.layout === l.id));
    for (const R of [6, 8, 10, 12]) line("R", String(R), rows.filter((r) => r.R === R));
    for (const k of [5, 7, 9]) line("k", String(k), rows.filter((r) => r.k === k));
    for (const a of ["total0.92", "tick0.02"]) line("amount", a, rows.filter((r) => r.amt === a));
    for (const dup of [0, 1, 2]) line("dup", String(dup), rows.filter((r) => r.dup === dup));
    // the cell the design discussion kept returning to
    for (const n of [5, 7, 9]) for (const R of [8, 12]) line(`ring28 k7 total0.92 dup0 N${n}`, `R${R}`, rows.filter((r) => r.layout === "ring28" && r.n === n && r.R === R && r.k === 7 && r.amt === "total0.92" && r.dup === 0));
    expect(rows.length).toBeGreaterThan(1000);
  });
  it("duplicate stamps on one point stay inside the bottle cap (their effect on the score is printed for the report, not asserted as a rule)", () => {
    for (const n of [5, 7, 9]) for (const R of [8, 12]) {
      const base = rows.find((r) => r.layout === "ring28" && r.n === n && r.R === R && r.k === 7 && r.amt === "total0.92" && r.dup === 0)!;
      for (const dup of [1, 2]) {
        const r = rows.find((x) => x.layout === "ring28" && x.n === n && x.R === R && x.k === 7 && x.amt === "total0.92" && x.dup === dup)!;
        console.log(`M1|dup|N${n} R${R} dup${dup}|baseScore=${f1(base.score)}|score=${f1(r.score)}|qty=${f1(r.qty * 100) / 100}`);
        expect(r.qty).toBeLessThanOrEqual(SAUCE_MAX_QUANTITY + 1e-9);
      }
    }
  });
});

describe("S-A M1 -- reducer and journal impact (the stamp deposits are an ordinary COMMIT_SAUCE_DISPENSE batch)", () => {
  function atSauceStep() {
    let s = createInitialGameState();
    s = gameReducer(s, { type: "START_FREE_COOK", now: 1 });
    s = gameReducer(s, { type: "COMMIT_DOUGH_STRETCH", shape: createIdealDoughShape() });
    s = gameReducer(s, { type: "CONFIRM_MAKING_STEP", now: 2 });
    return s;
  }
  it("the reducer accepts a stamp batch exactly like a gesture batch, with no change to how it is stored or scored", () => {
    const start = atSauceStep();
    expect(start.makingStep).toBe("SAUCE");
    const stamps = stampDeposits(LAYOUTS[2], 7, 8, 7, "total0.92", 0);
    const gesture = simulate((t) => { const k = Math.min(1, t / 2400); const a = k * Math.PI * 2 * 3; return { x: 50 + Math.cos(a) * 36 * k, y: 50 + Math.sin(a) * 36 * k }; }, 2400);
    for (const [name, batch] of [["stamp", stamps], ["gesture", gesture]] as const) {
      const next = gameReducer(start, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: batch });
      expect(next, name).not.toBe(start);
      expect(next.pizza.sauceIds, name).toEqual(["tomato-sauce"]);
      expect(next.pizza.sauceDeposits.map((d) => ({ x: d.x, y: d.y, amount: d.amount })), name).toEqual(batch.map((d) => ({ x: d.x, y: d.y, amount: d.amount })));
      expect(score(next.pizza.sauceDeposits), name).toBe(score(batch));
    }
  });
  it("prints the journal size of a stamp batch against a gesture batch and the pending-round limit", () => {
    const start = atSauceStep();
    const sizes: Record<string, number> = {};
    for (const [name, batch] of [["stamp N9 k9 (capped at the bottle)", stampDeposits(LAYOUTS[2], 9, 8, 9, "tick0.02", 0)], ["stamp N7 k7", stampDeposits(LAYOUTS[2], 7, 8, 7, "total0.92", 0)], ["gesture spiral", simulate((t) => ({ x: 50 + Math.cos(t / 200) * 30 * (t / 2400), y: 50 + Math.sin(t / 200) * 30 * (t / 2400) }), 2400)]] as const) {
      const next = gameReducer(start, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: batch });
      const round = buildPendingRound(next, "r1", 50, 1);
      sizes[name] = pendingRoundByteLength(round);
      console.log(`M1|journal|${name}|deposits=${batch.length}|pendingRoundBytes=${sizes[name]}|limit=${PENDING_ROUND_MAX_BYTES}`);
      expect(sizes[name]).toBeLessThan(PENDING_ROUND_MAX_BYTES);
    }
  });
});
