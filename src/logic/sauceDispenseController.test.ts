import { describe, expect, it } from "vitest";
import { SauceDispenseController, type SauceDeposit } from "./sauceDispenseController";
import { MAX_TICKS_PER_STEP, SAUCE_MAX_QUANTITY, SAUCE_RATE_PER_TICK, SAUCE_TICK_MS } from "./sauceQuantity";

function makeController() {
  const deposits: SauceDeposit[] = [];
  const controller = new SauceDispenseController({
    onDeposit: (d) => deposits.push(d),
    getTotalDispensed: () => deposits.reduce((sum, d) => sum + d.amount, 0),
  });
  return { controller, deposits };
}

describe("SauceDispenseController: hold time increases quantity", () => {
  it("deposits a starter dab immediately on start() (quick tap still applies sauce)", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    expect(deposits).toHaveLength(1);
    expect(deposits[0].amount).toBeCloseTo(SAUCE_RATE_PER_TICK);
  });

  it("a longer hold (more step() calls over more elapsed time) deposits strictly more than a short one", () => {
    const short = makeController();
    short.controller.start(0, { x: 50, y: 50 });
    short.controller.step(SAUCE_TICK_MS); // one more tick's worth

    const long = makeController();
    long.controller.start(0, { x: 50, y: 50 });
    for (let t = SAUCE_TICK_MS; t <= SAUCE_TICK_MS * 20; t += SAUCE_TICK_MS) {
      long.controller.step(t);
    }

    const shortTotal = short.deposits.reduce((s, d) => s + d.amount, 0);
    const longTotal = long.deposits.reduce((s, d) => s + d.amount, 0);
    expect(longTotal).toBeGreaterThan(shortTotal);
  });

  it("stays flat while pointer is down but not moving, for as long as time keeps passing", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 20, y: 20 });
    controller.step(SAUCE_TICK_MS * 4); // no move() calls at all
    expect(deposits.length).toBeGreaterThan(1);
    expect(deposits.every((d) => d.x === 20 && d.y === 20)).toBe(true);
  });
});

describe("SauceDispenseController: pointer-event count does not drive quantity", () => {
  it("many move() calls with no elapsed time between step()s produce no extra deposits", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    const afterStart = deposits.length;
    for (let i = 0; i < 500; i += 1) {
      controller.move({ x: 50 + i * 0.001, y: 50 }, i); // timestamps barely advance
    }
    expect(deposits.length).toBe(afterStart); // move() alone never deposits
  });

  it("the same wall-clock hold produces the same total quantity whether step() is called often (many small steps) or rarely (few large steps)", () => {
    const frequent = makeController();
    frequent.controller.start(0, { x: 50, y: 50 });
    for (let t = 5; t <= 200; t += 5) frequent.controller.step(t); // ~"120Hz"

    const sparse = makeController();
    sparse.controller.start(0, { x: 50, y: 50 });
    for (let t = 40; t <= 200; t += 40) sparse.controller.step(t); // ~"25Hz"

    const frequentTotal = frequent.deposits.reduce((s, d) => s + d.amount, 0);
    const sparseTotal = sparse.deposits.reduce((s, d) => s + d.amount, 0);
    expect(frequentTotal).toBeCloseTo(sparseTotal, 5);
  });
});

describe("SauceDispenseController: spatial sampling (Codex MUST FIX 4)", () => {
  it("a batch of several ticks due at once is placed along the recorded path via interpolation, not all dumped at the endpoint", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 0, y: 0 }); // nextDueAt = 50 (i.e. tick 1 already consumed by start)
    // Several moves recorded well before the next step() call processes the batch.
    controller.move({ x: 30, y: 0 }, 60);
    controller.move({ x: 60, y: 0 }, 120);
    controller.move({ x: 90, y: 0 }, 180);
    controller.step(200); // due ticks at 100, 150, 200 -- one call, one 3-tick batch

    const regularTicks = deposits.slice(1); // drop the start() starter dab
    expect(regularTicks.length).toBe(3);
    const xs = regularTicks.map((d) => d.x);
    // Strictly increasing -- each tick landed at its own interpolated point along the path.
    // The old (pre-fix) behavior would have dumped all of them at whatever position the
    // finger happened to be at when step() ran (90) -- distinct values disprove that.
    for (let i = 1; i < xs.length; i += 1) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
    expect(new Set(xs).size).toBe(xs.length); // no two ticks collapsed onto the same point
    expect(xs[0]).toBeGreaterThan(0); // the earliest due tick did not stay at the start point
  });

  it("holding still (no move() between ticks) deposits every tick at the same held position", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 10, y: 10 });
    controller.step(SAUCE_TICK_MS * 4);
    const regularTicks = deposits.slice(1);
    expect(regularTicks.length).toBe(3);
    expect(regularTicks.every((d) => d.x === 10 && d.y === 10)).toBe(true);
  });

  it("a tick due before any move() has been recorded falls back to the start position", () => {
    const { controller, deposits } = makeController();
    controller.start(100, { x: 5, y: 5 });
    controller.step(100 + SAUCE_TICK_MS * 2);
    expect(deposits[deposits.length - 1]).toMatchObject({ x: 5, y: 5 });
  });
});

describe("SauceDispenseController: cap/clamp", () => {
  it("never lets total dispensed exceed SAUCE_MAX_QUANTITY however long it's held", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    for (let t = SAUCE_TICK_MS; t <= SAUCE_TICK_MS * 500; t += SAUCE_TICK_MS) {
      controller.step(t);
    }
    const total = deposits.reduce((s, d) => s + d.amount, 0);
    expect(total).toBeLessThanOrEqual(SAUCE_MAX_QUANTITY + 1e-9);
    expect(total).toBeCloseTo(SAUCE_MAX_QUANTITY, 5);
  });

  it("stops appending deposits once the cap is reached instead of pushing zero-amount entries", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    for (let t = SAUCE_TICK_MS; t <= SAUCE_TICK_MS * 500; t += SAUCE_TICK_MS) {
      controller.step(t);
    }
    expect(deposits.every((d) => d.amount > 0)).toBe(true);
  });

  it("respects the cap even across many consecutive batches (repeated large jumps, each capped by MAX_TICKS_PER_STEP)", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    // Each call jumps far enough to be capped by MAX_TICKS_PER_STEP on its own -- repeated
    // enough times to reach SAUCE_MAX_QUANTITY, still never overshooting it.
    for (let t = SAUCE_TICK_MS * 1000; t <= SAUCE_TICK_MS * 20_000; t += SAUCE_TICK_MS * 1000) {
      controller.step(t);
    }
    const total = deposits.reduce((s, d) => s + d.amount, 0);
    expect(total).toBeLessThanOrEqual(SAUCE_MAX_QUANTITY + 1e-9);
    expect(total).toBeCloseTo(SAUCE_MAX_QUANTITY, 5);
  });
});

describe("SauceDispenseController: background/stall safety (Codex MUST FIX 3)", () => {
  it("a single step() after a huge elapsed gap deposits at most MAX_TICKS_PER_STEP ticks, not the whole gap", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    controller.step(SAUCE_TICK_MS * 10_000); // e.g. tab was backgrounded for ~8 minutes
    // starter tick + at most MAX_TICKS_PER_STEP regular ticks from the one step() call.
    expect(deposits.length).toBeLessThanOrEqual(1 + MAX_TICKS_PER_STEP);
  });

  it("does not deposit a backlog burst on the very next step() after a capped stall", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    controller.step(SAUCE_TICK_MS * 10_000);
    const countAfterStall = deposits.length;
    controller.step(SAUCE_TICK_MS * 10_000 + SAUCE_TICK_MS * 2); // one more tick's worth, not a backlog
    expect(deposits.length).toBe(countAfterStall + 1);
  });
});

describe("SauceDispenseController: stop()", () => {
  it("stops producing deposits after stop(), even if step() keeps being called", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    controller.step(SAUCE_TICK_MS);
    const countAtStop = deposits.length;
    controller.stop();
    controller.step(SAUCE_TICK_MS * 2);
    controller.step(SAUCE_TICK_MS * 3);
    expect(deposits.length).toBe(countAtStop);
    expect(controller.isActive).toBe(false);
  });

  it("is safe to call before start() and safe to call twice", () => {
    const { controller } = makeController();
    expect(() => controller.stop()).not.toThrow();
    controller.start(0, { x: 50, y: 50 });
    controller.stop();
    expect(() => controller.stop()).not.toThrow();
    expect(controller.isActive).toBe(false);
  });

  it("move() after stop() is a no-op that cannot resurrect the session", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    controller.stop();
    controller.move({ x: 99, y: 99 }, 1000);
    controller.step(SAUCE_TICK_MS);
    expect(deposits.every((d) => d.x !== 99)).toBe(true);
  });

  it("a fresh start() after stop() begins a clean session unaffected by the previous one's path", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 0, y: 0 });
    controller.move({ x: 100, y: 100 }, 10);
    controller.stop();

    controller.start(1000, { x: 5, y: 5 });
    controller.step(1000 + SAUCE_TICK_MS * 2);
    const afterRestart = deposits.slice(-2); // starter + one regular tick of the new session
    expect(afterRestart.every((d) => d.x === 5 && d.y === 5)).toBe(true);
  });
});
