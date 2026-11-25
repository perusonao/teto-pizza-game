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

/** B案 Phase 1b (Issue #901), design §3.3: the shop state's read (fail-soft), merge (max / union / first seed) and write rules. */
const KNOWN = new Set(["margherita", "fugazza", "funghi"]);
const isKnown = (id: string) => KNOWN.has(id);
const seed = (value: number) => ({ source: "legacy-dex" as const, value });

describe("sanitizeShopProgress", () => {
  it("absent or a non-object reads as undefined (the caller uses the default)", () => {
    for (const raw of [undefined, null, 3, "x", [], [1]]) expect(sanitizeShopProgress(raw, isKnown)).toBeUndefined();
  });

  it("an empty object reads as the default state", () => {
    expect(sanitizeShopProgress({}, isKnown)).toEqual(EMPTY_SHOP_PROGRESS);
  });

  it("a valid object reads back as written", () => {
    const raw = { reputation: 120, grantedMenuRecipeIds: ["margherita", "fugazza"], reputationSeed: seed(100) };
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

  it("a seed this build cannot read (other source, bad value) reads as null", () => {
    for (const reputationSeed of [{ source: "future", value: 1 }, { source: "legacy-dex", value: -1 }, { source: "legacy-dex" }, 5, "x"]) {
      expect(sanitizeShopProgress({ reputationSeed }, isKnown)?.reputationSeed).toBeNull();
    }
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

  it("the base's seed wins; the other's is used only when the base has none (R9)", () => {
    const a: ShopProgressState = { ...EMPTY_SHOP_PROGRESS, reputationSeed: seed(100) };
    const b: ShopProgressState = { ...EMPTY_SHOP_PROGRESS, reputationSeed: seed(250) };
    expect(mergeShopProgress(a, b).reputationSeed).toEqual(seed(100));
    expect(mergeShopProgress(EMPTY_SHOP_PROGRESS, b).reputationSeed).toEqual(seed(250));
  });

  it("isDefault / same", () => {
    expect(isDefaultShopProgress(EMPTY_SHOP_PROGRESS)).toBe(true);
    expect(isDefaultShopProgress({ ...EMPTY_SHOP_PROGRESS, reputationSeed: seed(0) })).toBe(false);
    expect(sameShopProgress(undefined, undefined)).toBe(true);
    expect(sameShopProgress(undefined, EMPTY_SHOP_PROGRESS)).toBe(false);
    expect(sameShopProgress({ ...EMPTY_SHOP_PROGRESS, reputationSeed: seed(1) }, { ...EMPTY_SHOP_PROGRESS, reputationSeed: seed(1) })).toBe(true);
    expect(sameShopProgress({ ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["a", "b"] }, { ...EMPTY_SHOP_PROGRESS, grantedMenuRecipeIds: ["b", "a"] })).toBe(false);
  });
});

describe("shopProgressForWrite: what storage keeps under `shopProgress`", () => {
  const ours: ShopProgressState = { reputation: 200, grantedMenuRecipeIds: ["margherita"], reputationSeed: seed(100) };

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

  it("a stored object is merged into: unknown sub-keys, unknown well-formed ids and the stored seed stay; reputation is the max", () => {
    const stored = {
      reputation: 500,
      grantedMenuRecipeIds: ["future-pizza", "margherita", "Not An Id!"],
      reputationSeed: { source: "future-source", value: 7 },
      futureField: { keep: true },
    };
    expect(shopProgressForWrite(ours, stored)).toEqual({
      reputation: 500,
      grantedMenuRecipeIds: ["future-pizza", "margherita"],
      reputationSeed: { source: "future-source", value: 7 },
      futureField: { keep: true },
    });
  });

  it("a stored object without a seed takes ours; a lower stored reputation is raised", () => {
    expect(shopProgressForWrite(ours, { reputation: 50, reputationSeed: null })).toEqual({
      reputation: 200,
      grantedMenuRecipeIds: ["margherita"],
      reputationSeed: seed(100),
    });
  });
});
