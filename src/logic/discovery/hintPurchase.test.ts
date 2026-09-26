import { describe, expect, it } from "vitest";
import {
  DISCOVERY_HINT_PRICES,
  discoveryHintPrice,
  isHintOnboardingFree,
  purchaseDiscoveryHint,
  purchasedHintLevel,
  type DiscoveryHintPurchaseInput,
} from "./hintPurchase";

/** Discovery Hint Economy 1.0 (Issue #232), HE-2: the pure price table and purchase rule. */

const base: DiscoveryHintPurchaseInput = {
  recipeId: "bismarck",
  requestedLevel: 1,
  maxLevel: 4,
  isTarget: true,
  discoveredCount: 1,
  purchases: {},
  pitzBalance: 100,
};

describe("Candidate B prices (OD-HE-1)", () => {
  it("H0 0 / H1 5 / H2 10 / H3 20 / H4 40, 75 for a full set, no H5", () => {
    expect([0, 1, 2, 3, 4].map(discoveryHintPrice)).toEqual([0, 5, 10, 20, 40]);
    expect(Object.values(DISCOVERY_HINT_PRICES).reduce((a, b) => a + b, 0)).toBe(75);
    for (const bad of [5, -1, 1.5, Number.NaN]) expect(() => discoveryHintPrice(bad)).toThrow(RangeError);
  });

  it("onboarding is free only while the Dex is empty (OD-HE-5)", () => {
    expect(isHintOnboardingFree(0)).toBe(true);
    expect(isHintOnboardingFree(1)).toBe(false);
  });
});

describe("purchaseDiscoveryHint", () => {
  it("buys H1 -> H4 in order, debiting exactly each price and raising the ledger", () => {
    let purchases = {};
    let pitz = 100;
    for (const level of [1, 2, 3, 4]) {
      const r = purchaseDiscoveryHint({ ...base, requestedLevel: level, purchases, pitzBalance: pitz });
      if (!r.success) throw new Error(r.reason);
      expect(r.price).toBe(discoveryHintPrice(level));
      expect(r.nextPitzBalance).toBe(pitz - r.price);
      expect(r.nextPurchases).toEqual({ bismarck: level });
      purchases = r.nextPurchases;
      pitz = r.nextPitzBalance;
    }
    expect(pitz).toBe(25);
  });

  it("keeps other recipes' entries untouched", () => {
    const r = purchaseDiscoveryHint({ ...base, purchases: { funghi: 3 } });
    expect(r).toMatchObject({ success: true, nextPurchases: { funghi: 3, bismarck: 1 } });
  });

  it("cannot skip a level, re-buy one, or buy past the recipe's last level / H4", () => {
    expect(purchaseDiscoveryHint({ ...base, requestedLevel: 2 })).toEqual({ success: false, reason: "NOT_NEXT_LEVEL" });
    expect(purchaseDiscoveryHint({ ...base, requestedLevel: 1, purchases: { bismarck: 1 } })).toEqual({ success: false, reason: "NOT_NEXT_LEVEL" });
    expect(purchaseDiscoveryHint({ ...base, requestedLevel: 4, maxLevel: 3, purchases: { bismarck: 3 } })).toEqual({ success: false, reason: "NOT_NEXT_LEVEL" });
    expect(purchaseDiscoveryHint({ ...base, requestedLevel: 5, purchases: { bismarck: 4 } })).toEqual({ success: false, reason: "NOT_NEXT_LEVEL" });
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(purchaseDiscoveryHint({ ...base, requestedLevel: bad })).toEqual({ success: false, reason: "NOT_NEXT_LEVEL" });
    }
  });

  it("a future stored level above this build's max never lets a level be bought again", () => {
    expect(purchasedHintLevel({ bismarck: 7 }, "bismarck", 4)).toBe(4);
    expect(purchaseDiscoveryHint({ ...base, requestedLevel: 4, purchases: { bismarck: 7 } })).toEqual({ success: false, reason: "NOT_NEXT_LEVEL" });
  });

  it("insufficient Pitz: nothing changes, the balance never goes negative", () => {
    expect(purchaseDiscoveryHint({ ...base, pitzBalance: 4 })).toEqual({ success: false, reason: "INSUFFICIENT_PITZ" });
    expect(purchaseDiscoveryHint({ ...base, pitzBalance: 5 })).toMatchObject({ success: true, nextPitzBalance: 0 });
    expect(purchaseDiscoveryHint({ ...base, requestedLevel: 4, purchases: { bismarck: 3 }, pitzBalance: 39 })).toEqual({ success: false, reason: "INSUFFICIENT_PITZ" });
    expect(purchaseDiscoveryHint({ ...base, pitzBalance: Number.NaN })).toEqual({ success: false, reason: "INSUFFICIENT_PITZ" });
  });

  it("only the session's DISCOVERABLE target can be bought", () => {
    expect(purchaseDiscoveryHint({ ...base, isTarget: false })).toEqual({ success: false, reason: "NOT_A_TARGET" });
  });

  it("Dex 0 onboarding is never a purchase (free, session-only)", () => {
    expect(purchaseDiscoveryHint({ ...base, recipeId: "margherita", discoveredCount: 0 })).toEqual({ success: false, reason: "ONBOARDING_FREE" });
  });
});
