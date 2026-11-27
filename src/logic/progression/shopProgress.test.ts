import { describe, expect, it } from "vitest";
import {
  EMPTY_SHOP_PROGRESS,
  isDefaultShopProgress,
  mergeShopProgress,
  sameShopProgress,
  sanitizeShopProgress,
  shopProgressForWrite,
  type ShopProgressState,
} from "./shopProgress";

/** B案 Phase 1b (Issue #901), design §3.3: the shop state's read (fail-soft), merge (max / union) and write rules. */
const KNOWN = new Set(["margherita", "fugazza", "funghi"]);
const isKnown = (id: string) => KNOWN.has(id);

describe("sanitizeShopProgress", () => {
  it("absent or a non-object reads as undefined (the caller uses the default)", () => {
    for (const raw of [undefined, null, 3, "x", [], [1]]) expect(sanitizeShopProgress(raw, isKnown)).toBeUndefined();
  });

  it("an empty object reads as the default state", () => {
    expect(sanitizeShopProgress({}, isKnown)).toEqual(EMPTY_SHOP_PROGRESS);
  });

  it("a valid object reads back as written", () => {
    const raw = { reputation: 120, grantedMenuRecipeIds: ["margherita", "fugazza"] };
    expect(sanitizeShopProgress(raw, isKnown)).toEqual(raw);
  });

  it("invalid values are repaired fail-soft: negative / NaN / string reputation -> 0", () => {
    for (const reputation of [-5, Number.NaN, Number.POSITIVE_INFINITY, "50", null]) {
      expect(sanitizeShopProgress({ reputation }, isKnown)?.reputation).toBe(0);
    }
  });

  it("granted ids: known only, once each, in stored order; non-strings and unknown ids are not read", () => {
    const raw = { grantedMenuRecipeIds: ["fugazza", 3, "future-pizza", "margherita", "fugazza", null] };
    expect(sanitizeShopProgress(raw, isKnown)?.grantedMenuRecipeIds).toEqual(["fugazza", "margherita"]);
  });

  it("sub-keys this build does not know are not read into memory", () => {
    expect(sanitizeShopProgress({ reputation: 1, futureField: 3 }, isKnown)).toEqual({ reputation: 1, grantedMenuRecipeIds: [] });
  });
});

describe("mergeShopProgress / isDefault / same", () => {
  it("reputation is the max (it never goes down, Q1)", () => {
    const a: ShopProgressState = { ...EMPTY_SHOP_PROGRESS, reputation: 300 };
    const b: ShopProgressState = { ...EMPTY_SHOP_PROGRESS, reputation: 120 };
    expect(mergeShopProgress(a, b).reputation).toBe(300);
    expect(mergeShopProgress(b, a).reputation).toBe(300);
  });

  it("granted recipes are a union (base order first)", () => {
    const a: ShopProgressState = { ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["fugazza"] };
    const b: ShopProgressState = { ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["margherita", "fugazza"] };
    expect(mergeShopProgress(a, b).grantedMenuRecipeIds).toEqual(["fugazza", "margherita"]);
  });

  it("isDefault / same", () => {
    expect(isDefaultShopProgress(EMPTY_SHOP_PROGRESS)).toBe(true);
    expect(isDefaultShopProgress({ ...EMPTY_SHOP_PROGRESS, reputation: 1 })).toBe(false);
    expect(isDefaultShopProgress({ ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["margherita"] })).toBe(false);
    expect(sameShopProgress(undefined, undefined)).toBe(true);
    expect(sameShopProgress(undefined, EMPTY_SHOP_PROGRESS)).toBe(false);
    expect(sameShopProgress({ reputation: 1, grantedMenuRecipeIds: ["a"] }, { reputation: 1, grantedMenuRecipeIds: ["a"] })).toBe(true);
    expect(sameShopProgress({ ...EMPTY_SHOP_PROGRESS, reputation: 1 }, { ...EMPTY_SHOP_PROGRESS, reputation: 2 })).toBe(false);
    expect(sameShopProgress({ ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["a", "b"] }, { ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["b", "a"] })).toBe(false);
  });
});

describe("shopProgressForWrite: what storage keeps under `shopProgress`", () => {
  const ours: ShopProgressState = { reputation: 200, grantedMenuRecipeIds: ["margherita"] };

  it("a default (or absent) state writes nothing new: storage keeps what it holds, verbatim", () => {
    expect(shopProgressForWrite(EMPTY_SHOP_PROGRESS, undefined)).toBeUndefined();
    expect(shopProgressForWrite(undefined, undefined)).toBeUndefined();
    const opaque = ["a newer build's shape"];
    expect(shopProgressForWrite(EMPTY_SHOP_PROGRESS, opaque)).toBe(opaque);
    const stored = { reputation: 9, extra: { x: 1 } };
    expect(shopProgressForWrite(EMPTY_SHOP_PROGRESS, stored)).toBe(stored);
  });

  it("nothing stored: our state is written", () => {
    expect(shopProgressForWrite(ours, undefined)).toEqual(ours);
  });

  it("a non-object stored value is replaced once we have a state of our own", () => {
    expect(shopProgressForWrite(ours, 42)).toEqual(ours);
  });

  it("a stored object is merged into: unknown sub-keys and unknown well-formed ids stay; reputation is the max", () => {
    const stored = {
      reputation: 500,
      grantedMenuRecipeIds: ["future-pizza", "margherita", "Not An Id!"],
      futureField: { keep: true },
    };
    expect(shopProgressForWrite(ours, stored)).toEqual({
      reputation: 500,
      grantedMenuRecipeIds: ["future-pizza", "margherita"],
      futureField: { keep: true },
    });
  });

  it("a lower stored reputation is raised", () => {
    expect(shopProgressForWrite(ours, { reputation: 50 })).toEqual({ reputation: 200, grantedMenuRecipeIds: ["margherita"] });
  });
});

describe("Phase 3b: the awaiting / paid ledgers (unions, written only while non-empty)", () => {
  const known = (id: string) => id !== "unknown-recipe";
  it("a pre-3b state keeps its exact shape (no new keys) and stays the default when empty", () => {
    expect(isDefaultShopProgress(EMPTY_SHOP_PROGRESS)).toBe(true);
    expect(shopProgressForWrite({ reputation: 5, grantedMenuRecipeIds: [] }, undefined)).toEqual({ reputation: 5, grantedMenuRecipeIds: [] });
    expect(sanitizeShopProgress({ reputation: 5, grantedMenuRecipeIds: [] }, known)).toEqual({ reputation: 5, grantedMenuRecipeIds: [] });
  });

  it("a state holding only an awaiting recipe is not the default, and both ledgers round-trip", () => {
    const state = { reputation: 0, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: ["meat-lovers"] };
    expect(isDefaultShopProgress(state)).toBe(false);
    const written = shopProgressForWrite({ ...state, menuEntryPaidRecipeIds: ["meat-lovers"] }, undefined);
    expect(sanitizeShopProgress(JSON.parse(JSON.stringify(written)), known)).toEqual({ ...state, menuEntryPaidRecipeIds: ["meat-lovers"] });
  });

  it("merging is a union of each ledger (a paid recipe stays paid)", () => {
    const a = { reputation: 38, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: ["meat-lovers"] };
    const b = { reputation: 43, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: ["meat-lovers"], menuEntryPaidRecipeIds: ["meat-lovers"] };
    expect(mergeShopProgress(a, b)).toEqual(b);
    expect(mergeShopProgress(b, a)).toEqual(b);
    expect(sameShopProgress(a, b)).toBe(false);
  });

  it("writing over a stored object keeps its ids (a newer build's included) and unions ours in", () => {
    const stored = { reputation: 50, grantedMenuRecipeIds: [], menuEntryPaidRecipeIds: ["future-pizza"], other: 1 };
    const written = shopProgressForWrite({ reputation: 43, grantedMenuRecipeIds: [], awaitingMenuRecipeIds: ["meat-lovers"], menuEntryPaidRecipeIds: ["meat-lovers"] }, stored);
    expect(written).toEqual({ reputation: 50, grantedMenuRecipeIds: [], menuEntryPaidRecipeIds: ["future-pizza", "meat-lovers"], awaitingMenuRecipeIds: ["meat-lovers"], other: 1 });
  });
});
