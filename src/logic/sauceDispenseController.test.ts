import { describe, expect, it } from "vitest";
import { SauceDispenseController, type SauceDeposit } from "./sauceDispenseController";
import { SAUCE_MAX_QUANTITY, SAUCE_RATE_PER_TICK, SAUCE_TICK_MS } from "./sauceQuantity";

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
  it("many move() calls with no elapsed time produce no extra deposits", () => {
    const { controller, deposits } = makeController();
    controller.start(0, { x: 50, y: 50 });
    const afterStart = deposits.length;
    for (let i = 0; i < 500; i += 1) {
      controller.move({ x: 50 + i * 0.001, y: 50 });
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
    controller.move({ x: 99, y: 99 });
    controller.step(SAUCE_TICK_MS);
    expect(deposits.every((d) => d.x !== 99)).toBe(true);
  });
});
