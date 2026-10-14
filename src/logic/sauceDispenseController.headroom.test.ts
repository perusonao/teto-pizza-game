import { describe, expect, it } from "vitest";
import { SauceDispenseController, type SauceDeposit } from "./sauceDispenseController";
import { SAUCE_RATE_PER_TICK, SAUCE_TICK_MS } from "./sauceQuantity";

/** Sauce B1: the optional `getHeadroom` cap (per-kind + total) next to the unchanged classic single-bottle cap. */
function runHold(options: { total?: number; headroom?: (pendingSum: number) => number }, holdMs: number) {
  const deposits: SauceDeposit[] = [];
  const pending = () => deposits.reduce((s, d) => s + d.amount, 0);
  const controller = new SauceDispenseController({
    onDeposit: (d) => deposits.push(d),
    getTotalDispensed: () => (options.total ?? 0) + pending(),
    ...(options.headroom ? { getHeadroom: () => options.headroom!(pending()) } : {}),
  });
  controller.start(0, { x: 50, y: 50 });
  for (let t = SAUCE_TICK_MS; t <= holdMs; t += SAUCE_TICK_MS) controller.step(t);
  return deposits;
}
const sum = (ds: SauceDeposit[]) => ds.reduce((s, d) => s + d.amount, 0);

describe("SauceDispenseController: classic cap (no getHeadroom) is unchanged", () => {
  it("a long hold stops at the single-bottle 100%", () => {
    expect(sum(runHold({}, 10_000))).toBeCloseTo(1, 9);
  });
  it("starts from what was already dispensed", () => {
    expect(sum(runHold({ total: 0.9 }, 10_000))).toBeCloseTo(0.1, 9);
  });
});

describe("SauceDispenseController: getHeadroom", () => {
  it("is amount-for-amount identical to the classic cap when the headroom is the single-bottle remainder", () => {
    for (const total of [0, 0.3, 0.77, 0.99]) {
      const classic = runHold({ total }, 10_000).map((d) => d.amount);
      const viaHeadroom = runHold({ total, headroom: (p) => Math.max(0, 1 - (total + p)) }, 10_000).map((d) => d.amount);
      expect(viaHeadroom).toEqual(classic);
    }
  });

  it("stops exactly at the supplied headroom, including partway through one batch of due ticks", () => {
    const deposits = runHold({ headroom: (p) => Math.max(0, 0.05 - p) }, 10_000);
    expect(sum(deposits)).toBeCloseTo(0.05, 9);
    expect(deposits.map((d) => d.amount)).toEqual([SAUCE_RATE_PER_TICK, SAUCE_RATE_PER_TICK, 0.05 - 2 * SAUCE_RATE_PER_TICK]);
  });

  it("a headroom larger than one bottle is NOT capped at one bottle by the controller (the ledger owns the per-kind 100%)", () => {
    expect(sum(runHold({ headroom: () => 5 }, 3_000))).toBeCloseTo(60 * SAUCE_RATE_PER_TICK, 9);
  });

  it("zero headroom deposits nothing, not even the starter tick", () => {
    expect(runHold({ headroom: () => 0 }, 3_000)).toEqual([]);
  });
});
