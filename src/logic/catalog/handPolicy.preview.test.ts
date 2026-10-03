import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * LC-R6-b / LC-R6-e (default project = the shipped production literals: HAND_ENFORCEMENT_PRODUCTION = true, capacity 12):
 * the Preview-only variant (OD-R6a-1 = A2). `VITE_PREVIEW_MODE` is stubbed per case and the variant module is
 * replaced with each committed value, then the REAL `handPolicy.ts` is imported fresh. Since R6-e the production switch is ON,
 * so Preview == Production when no variant is in effect; a variant only overrides the capacity (a comparison tool).
 */
async function policy(previewMode: boolean, variant: unknown) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", previewMode ? "1" : "");
  vi.doMock("../../preview/lcHandPreview", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../preview/lcHandPreview")>()),
    LC_HAND_PREVIEW_CAPACITY: variant,
  }));
  return import("./handPolicy");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("../../preview/lcHandPreview");
  vi.resetModules();
});

describe("production (no VITE_PREVIEW_MODE): a committed variant is never read; Hand is ON with the production capacity", () => {
  it.each([null, 9, 12])("variant %s: Hand ON, production capacity 12, the hand holds exactly 12", async (variant) => {
    const p = await policy(false, variant);
    expect(p.HAND_ENFORCEMENT_ENABLED).toBe(true);
    expect(p.HAND_PREVIEW_VARIANT).toBeNull();
    expect(p.DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(p.DEFAULT_HAND_CAPACITY_PRODUCTION);
    expect(p.DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(12);
    expect(p.handCapacityFor(22, p.DEFAULT_HAND_CAPACITY_CANDIDATE)).toBe(12);
  });
});

describe("Preview (VITE_PREVIEW_MODE set)", () => {
  it("variant null (main / every normal Preview): identical to production -- Hand ON, capacity 12", async () => {
    const p = await policy(true, null);
    expect(p.HAND_ENFORCEMENT_ENABLED).toBe(true);
    expect(p.HAND_PREVIEW_VARIANT).toBeNull();
    expect(p.DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(12);
    expect(p.handCapacityFor(22, p.DEFAULT_HAND_CAPACITY_CANDIDATE)).toBe(12);
  });

  it.each([9, 12] as const)("variant %s (HV-only disposable commit): Hand ON with exactly that capacity", async (variant) => {
    const p = await policy(true, variant);
    expect(p.HAND_ENFORCEMENT_ENABLED).toBe(true);
    expect(p.HAND_PREVIEW_VARIANT).toBe(variant);
    expect(p.DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(variant);
    expect(p.handCapacityFor(22, p.DEFAULT_HAND_CAPACITY_CANDIDATE)).toBe(variant);
  });

  it.each([10, 0, "12", NaN, undefined, {}])("fail closed: %s is not a capacity candidate, so no variant is in effect (production behavior)", async (bad) => {
    const p = await policy(true, bad);
    expect(p.HAND_PREVIEW_VARIANT).toBeNull();
    expect(p.HAND_ENFORCEMENT_ENABLED).toBe(true);
    expect(p.DEFAULT_HAND_CAPACITY_CANDIDATE).toBe(12);
  });
});

describe("the shipped module values", () => {
  it("main commits variant null and the production switch ON", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    const { LC_HAND_PREVIEW_CAPACITY } = await import("../../preview/lcHandPreview");
    expect(LC_HAND_PREVIEW_CAPACITY).toBeNull();
    const p = await import("./handPolicy");
    expect(p.HAND_ENFORCEMENT_PRODUCTION).toBe(true);
    expect(p.HAND_ENFORCEMENT_ENABLED).toBe(true);
  });
});
