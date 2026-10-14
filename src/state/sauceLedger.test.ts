import { describe, expect, it } from "vitest";
import { SAUCE_MAX_QUANTITY, SAUCE_TOTAL_MAX_QUANTITY, tickDepositAmount } from "../logic/sauceQuantity";
import { sanitizeSauceDeposits } from "../logic/scoringV2/boundary";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "./pizzaState";
import {
  currentSauceId,
  exceedsSauceCaps,
  isMultiSauce,
  liveSauceDeposits,
  planSauceCommit,
  sauceHeadroom,
  sauceKindsOf,
  sauceOwnDeposits,
  sauceUsedByKind,
  sauceUsedTotal,
} from "./sauceLedger";

const dep = (amount: number, ingredientId?: string, x = 50, y = 50): SauceDeposit =>
  ingredientId === undefined ? { x, y, amount } : { x, y, amount, ingredientId };
const pizza = (sauceIds: string[], sauceDeposits: SauceDeposit[]): PizzaState => ({ ...createEmptyPizza(), sauceIds, sauceDeposits });

describe("sauce ledger: derived values", () => {
  it("a single-sauce pizza (no ingredientId) is attributed to its only sauce, and every deposit is 'its own'", () => {
    const p = pizza(["tomato-sauce"], [dep(0.2), dep(0.3)]);
    expect(sauceKindsOf(p)).toEqual(["tomato-sauce"]);
    expect(sauceUsedByKind(p)).toEqual({ "tomato-sauce": 0.5 });
    expect(sauceUsedTotal(p)).toBe(0.5);
    expect(isMultiSauce(p)).toBe(false);
    expect(sauceOwnDeposits(p, "tomato-sauce")).toHaveLength(2);
    expect(currentSauceId(p)).toBe("tomato-sauce");
  });

  it("a wrong single sauce is still pooled for any reference sauce (single-source scoring is unchanged)", () => {
    const p = pizza(["pesto"], [dep(0.4)]);
    expect(sauceOwnDeposits(p, "tomato-sauce")).toHaveLength(1);
  });

  it("several kinds: per-kind usage, own deposits and the current sauce follow the stamps", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.5, "tomato-sauce"), dep(0.1, "pesto"), dep(0.2, "tomato-sauce")]);
    expect(sauceKindsOf(p)).toEqual(["tomato-sauce", "pesto"]);
    expect(sauceUsedByKind(p)).toEqual({ "tomato-sauce": 0.7, pesto: 0.1 });
    expect(sauceUsedTotal(p)).toBeCloseTo(0.8, 12);
    expect(isMultiSauce(p)).toBe(true);
    expect(sauceOwnDeposits(p, "tomato-sauce").map((d) => d.amount)).toEqual([0.5, 0.2]);
    expect(sauceOwnDeposits(p, "pesto").map((d) => d.amount)).toEqual([0.1]);
    expect(sauceOwnDeposits(p, "olive-oil")).toEqual([]);
    expect(currentSauceId(p)).toBe("tomato-sauce");
  });

  it("no deposits: current sauce is the last committed kind (one-shot apply), none when empty", () => {
    expect(currentSauceId(pizza(["pesto"], []))).toBe("pesto");
    expect(currentSauceId(createEmptyPizza())).toBeNull();
  });

  it("tolerates malformed input (fail closed, never throws)", () => {
    const bad = { sauceIds: "x", sauceDeposits: [null, 5, { x: 1 }, { x: 1, y: 2, amount: NaN }] };
    expect(sauceKindsOf(bad)).toEqual([]);
    expect(sauceUsedTotal(bad)).toBe(0);
    expect(sauceOwnDeposits(null, "pesto")).toEqual([]);
    expect(currentSauceId(undefined)).toBeNull();
  });
});

describe("sauce ledger: single vs several is decided by the KINDS on the pizza (Codex P2)", () => {
  it("a one-shot sauce has no deposits: sauceIds [A, B] with deposits only from B is still a multi-sauce pizza", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.5, "pesto"), dep(0.3, "pesto")]);
    expect(sauceKindsOf(p)).toEqual(["tomato-sauce", "pesto"]);
    expect(isMultiSauce(p)).toBe(true);
    expect(sauceOwnDeposits(p, "tomato-sauce")).toEqual([]); // not pesto's deposits
    expect(sauceOwnDeposits(p, "pesto")).toHaveLength(2);
  });

  it("unstamped history with two recorded kinds is attributed to the first kind (the only sauce used before the second)", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.4)]);
    expect(isMultiSauce(p)).toBe(true);
    expect(sauceOwnDeposits(p, "tomato-sauce")).toHaveLength(1);
    expect(sauceOwnDeposits(p, "pesto")).toEqual([]);
  });

  it("one recorded kind stays single however many deposits it has (the pooled view, unchanged)", () => {
    expect(isMultiSauce(pizza(["pesto"], [dep(0.2), dep(0.2)]))).toBe(false);
    expect(isMultiSauce(pizza(["tomato-sauce"], []))).toBe(false); // one-shot only
    expect(isMultiSauce(createEmptyPizza())).toBe(false);
    expect(sauceOwnDeposits(pizza(["pesto"], [dep(0.2)]), "tomato-sauce")).toHaveLength(1); // wrong single sauce: pooled
  });

  it("a kind that laid nothing is not on the pizza (sauceIds only ever gets a kind from a committed stroke or a one-shot)", () => {
    expect(sauceKindsOf(pizza(["tomato-sauce"], [dep(0.2)]))).toEqual(["tomato-sauce"]);
  });
});

describe("sauce ledger: headroom (the dispenser cap, shared with the gauge)", () => {
  it("one kind: numerically identical to the old single-bottle cap, for any history and pending amount", () => {
    for (const used of [0, 0.02, 0.5, 0.98, 0.9999999, 1, 1.4]) {
      for (const pending of [0, 0.02, 0.2, 0.9]) {
        const p = pizza(used > 0 ? ["tomato-sauce"] : [], used > 0 ? [dep(used)] : []);
        const old = Math.max(0, SAUCE_MAX_QUANTITY - (used + pending));
        expect(sauceHeadroom(p, "tomato-sauce", pending)).toBe(old);
        expect(Math.min(0.02, sauceHeadroom(p, "tomato-sauce", pending))).toBe(tickDepositAmount(used + pending));
      }
    }
  });

  it("each kind has its own 100%: a second kind starts full", () => {
    const p = pizza(["tomato-sauce"], [dep(0.9)]);
    expect(sauceHeadroom(p, "tomato-sauce")).toBeCloseTo(0.1, 12);
    expect(sauceHeadroom(p, "pesto")).toBe(1);
  });

  it("the provisional pizza-wide cap bounds the sum of the kinds", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(1, "tomato-sauce"), dep(0.8, "pesto")]);
    expect(SAUCE_TOTAL_MAX_QUANTITY).toBe(2); // PROVISIONAL (Owner Decision): a comparison value, not final
    expect(sauceHeadroom(p, "pesto")).toBeCloseTo(0.2, 12); // own 0.2 left, total 0.2 left
    expect(sauceHeadroom(p, "olive-oil")).toBeCloseTo(0.2, 12); // a fresh kind is limited by the total, not by its own 100%
    expect(sauceHeadroom(p, "pesto", 0.2)).toBe(0);
  });

  it("at the total cap nothing more can be dispensed, for any kind", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(1, "tomato-sauce"), dep(1, "pesto")]);
    for (const kind of ["tomato-sauce", "pesto", "olive-oil"]) expect(sauceHeadroom(p, kind)).toBe(0);
  });
});

describe("sauce ledger: caps check (reducer boundary)", () => {
  it("passes within both caps and fails per kind or in total (with float slack)", () => {
    expect(exceedsSauceCaps({ sauceDeposits: [dep(0.5, "a"), dep(0.5, "b")] })).toBe(false);
    expect(exceedsSauceCaps({ sauceDeposits: [dep(1.0000001, "a")] })).toBe(false); // within epsilon
    expect(exceedsSauceCaps({ sauceDeposits: [dep(1.1, "a")] })).toBe(true);
    expect(exceedsSauceCaps({ sauceDeposits: [dep(1, "a"), dep(1, "b"), dep(0.1, "c")] })).toBe(true);
  });
});

describe("planSauceCommit", () => {
  it("first sauce: history = batch, no stamp, a new active sauce", () => {
    const plan = planSauceCommit(createEmptyPizza(), "tomato-sauce", [dep(0.02)]);
    expect(plan).toMatchObject({ sauceIds: ["tomato-sauce"], isNewKind: true, changedActive: true, multi: false });
    expect(plan.sauceDeposits).toEqual([{ x: 50, y: 50, amount: 0.02 }]);
    expect("ingredientId" in plan.sauceDeposits[0]).toBe(false);
  });

  it("same kind again: appended, nothing stamped, active unchanged", () => {
    const p = pizza(["tomato-sauce"], [dep(0.1)]);
    const plan = planSauceCommit(p, "tomato-sauce", [dep(0.2)]);
    expect(plan).toMatchObject({ sauceIds: ["tomato-sauce"], isNewKind: false, changedActive: false, multi: false });
    expect(plan.sauceDeposits.map((d) => d.amount)).toEqual([0.1, 0.2]);
    expect(plan.sauceDeposits.every((d) => !("ingredientId" in d))).toBe(true);
  });

  it("a second kind: the earlier deposits are stamped with the only sauce used so far, the batch with the new kind", () => {
    const p = pizza(["tomato-sauce"], [dep(0.1), dep(0.2)]);
    const plan = planSauceCommit(p, "pesto", [dep(0.02, undefined, 10, 10)]);
    expect(plan).toMatchObject({ sauceIds: ["tomato-sauce", "pesto"], isNewKind: true, changedActive: true, multi: true });
    expect(plan.sauceDeposits.map((d) => d.ingredientId)).toEqual(["tomato-sauce", "tomato-sauce", "pesto"]);
    expect(p.sauceDeposits.every((d) => !("ingredientId" in d))).toBe(true); // the input is never mutated
  });

  it("switching back keeps the kind order and flags the active change without a new kind", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.1, "tomato-sauce"), dep(0.1, "pesto")]);
    const plan = planSauceCommit(p, "tomato-sauce", [dep(0.02)]);
    expect(plan).toMatchObject({ sauceIds: ["tomato-sauce", "pesto"], isNewKind: false, changedActive: true, multi: true });
    expect(plan.sauceDeposits.at(-1)).toMatchObject({ ingredientId: "tomato-sauce" });
  });
});

describe("liveSauceDeposits (the live 「ソースのでき」)", () => {
  it("one kind in play: the whole pooled log, in-progress last (exactly as before)", () => {
    const p = pizza(["tomato-sauce"], [dep(0.1), dep(0.2)]);
    const pending = [dep(0.02)];
    expect(liveSauceDeposits(p, pending, "tomato-sauce", "tomato-sauce")).toEqual([...p.sauceDeposits, ...pending]);
    expect(liveSauceDeposits(createEmptyPizza(), pending, "pesto", "tomato-sauce")).toEqual(pending); // wrong first sauce: pooled
  });

  it("several kinds: only the reference sauce's own deposits (+ its in-progress stroke)", () => {
    const p = pizza(["tomato-sauce", "pesto"], [dep(0.3, "tomato-sauce"), dep(0.4, "pesto")]);
    expect(liveSauceDeposits(p, [], null, "tomato-sauce").map((d) => d.amount)).toEqual([0.3]);
    expect(liveSauceDeposits(p, [dep(0.02)], "pesto", "tomato-sauce").map((d) => d.amount)).toEqual([0.3]);
    expect(liveSauceDeposits(p, [dep(0.02)], "tomato-sauce", "tomato-sauce").map((d) => d.amount)).toEqual([0.3, 0.02]);
  });

  it("a second kind in progress already counts as several kinds", () => {
    const p = pizza(["tomato-sauce"], [dep(0.3)]);
    expect(liveSauceDeposits(p, [dep(0.02)], "pesto", "tomato-sauce").map((d) => d.amount)).toEqual([0.3]);
  });

  it("committed deposits are filtered under the combined (committed + in-progress) kinds (Codex P2 #2)", () => {
    // committed: only pesto (one kind, no stamps). In progress: olive-oil. Reference: tomato.
    const onlyPesto = pizza(["pesto"], [dep(0.5), dep(0.4)]);
    expect(liveSauceDeposits(onlyPesto, [dep(0.02)], "olive-oil", "tomato-sauce")).toEqual([]); // not pesto's deposits
    // beginning a tomato stroke on top of committed pesto: only the pending tomato counts, not the old pesto
    expect(liveSauceDeposits(onlyPesto, [dep(0.02), dep(0.02)], "tomato-sauce", "tomato-sauce").map((d) => d.amount)).toEqual([0.02, 0.02]);
    // the reference is the committed kind itself and a second kind is in progress: its own deposits only
    expect(liveSauceDeposits(onlyPesto, [dep(0.02)], "olive-oil", "pesto").map((d) => d.amount)).toEqual([0.5, 0.4]);
  });

  it("one kind committed and in progress stays the pooled log, whichever sauce it is (unchanged)", () => {
    const onlyPesto = pizza(["pesto"], [dep(0.5)]);
    expect(liveSauceDeposits(onlyPesto, [dep(0.02)], "pesto", "tomato-sauce").map((d) => d.amount)).toEqual([0.5, 0.02]);
  });
});

describe("boundary: ingredientId survives sanitizing only when it is a string", () => {
  it("keeps a string id, drops anything else, never invents the key", () => {
    const out = sanitizeSauceDeposits([
      { x: 1, y: 2, amount: 3, ingredientId: "pesto" },
      { x: 1, y: 2, amount: 3, ingredientId: 7 },
      { x: 1, y: 2, amount: 3 },
    ]);
    expect(out).toEqual([{ x: 1, y: 2, amount: 3, ingredientId: "pesto" }, { x: 1, y: 2, amount: 3 }, { x: 1, y: 2, amount: 3 }]);
    expect("ingredientId" in out[2]).toBe(false);
  });
});
