import { describe, expect, it } from "vitest";
import { DOUGH_SHAPE_TARGET_REGISTRY } from "../doughShapeTarget";
import { checkPanShapeCompatibility } from "./compatibility";
import { legacyPanFieldsFromProfile, panProfileIdFromLegacy } from "./legacyAdapter";
import { PAN_PROFILE_REGISTRY } from "./registry";
import { PAN_PROFILE_IDS, type PanProfile } from "./types";
import { validatePanProfileRegistry } from "./validator";

describe("PAN_PROFILE registry", () => {
  it("is complete, deterministic and valid", () => {
    expect(Object.keys(PAN_PROFILE_REGISTRY)).toEqual(PAN_PROFILE_IDS);
    expect(validatePanProfileRegistry(PAN_PROFILE_REGISTRY)).toEqual([]);
  });

  it("keeps PAN_PROFILE and DOUGH_SHAPE_TARGET as independent registries", () => {
    expect(PAN_PROFILE_REGISTRY).not.toBe(DOUGH_SHAPE_TARGET_REGISTRY);
    expect(Object.keys(PAN_PROFILE_REGISTRY)).not.toEqual(Object.keys(DOUGH_SHAPE_TARGET_REGISTRY));
    expect(PAN_PROFILE_REGISTRY.tray.defaultDoughShapeTargetId).toBe("square");
    expect(DOUGH_SHAPE_TARGET_REGISTRY.square).not.toHaveProperty("panProfileId");
  });

  it("returns an explicit compatibility result without silently substituting a target", () => {
    expect(checkPanShapeCompatibility("tray", "rectangle")).toEqual({ compatible: true });
    expect(checkPanShapeCompatibility("tray", "round")).toEqual({ compatible: false, reason: "SHAPE_NOT_SUPPORTED" });
    expect(checkPanShapeCompatibility("steel-pan", "rectangle")).toEqual({ compatible: true });
  });
});

describe("pure validator", () => {
  it("reports all structural defects and never mutates its input", () => {
    const broken = {
      wrongKey: {
        ...PAN_PROFILE_REGISTRY.tray,
        id: "tray",
        vessel: "none",
        depth: "deep",
        defaultDoughShapeTargetId: "round",
        compatibleDoughShapeTargetIds: ["square", "square", "unknown"],
      },
      duplicate: { ...PAN_PROFILE_REGISTRY.tray },
    } as unknown as Readonly<Record<string, PanProfile>>;
    const before = JSON.stringify(broken);
    const codes = validatePanProfileRegistry(broken).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      "MISSING_PROFILE", "DUPLICATE_PROFILE_ID", "ID_KEY_MISMATCH", "DUPLICATE_SHAPE_TARGET",
      "UNKNOWN_SHAPE_TARGET", "DEFAULT_NOT_COMPATIBLE", "INVALID_DEPTH",
    ]));
    expect(JSON.stringify(broken)).toBe(before);
  });

  it.each([null, [], { tray: null }, { tray: { id: "tray", compatibleDoughShapeTargetIds: null } }])(
    "returns issues instead of throwing for malformed input %#",
    (input) => {
      expect(() => validatePanProfileRegistry(input)).not.toThrow();
      expect(validatePanProfileRegistry(input).length).toBeGreaterThan(0);
    },
  );

  it("rejects an unknown default even when the same unknown id is listed as compatible", () => {
    const input = { ...PAN_PROFILE_REGISTRY, tray: { ...PAN_PROFILE_REGISTRY.tray, defaultDoughShapeTargetId: "future", compatibleDoughShapeTargetIds: ["future"] } };
    expect(validatePanProfileRegistry(input).map((issue) => issue.code)).toEqual(expect.arrayContaining(["UNKNOWN_SHAPE_TARGET", "UNKNOWN_DEFAULT_SHAPE_TARGET"]));
  });

  it("rejects a profile whose required id field is absent, keeping the type guard sound", () => {
    const { id: _id, ...trayWithoutId } = PAN_PROFILE_REGISTRY.tray;
    const input = { ...PAN_PROFILE_REGISTRY, tray: trayWithoutId };
    expect(validatePanProfileRegistry(input)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_FIELD", profileId: "tray" })]));
  });

  it.each([
    ["deep-pan", { depth: "shallow" }],
    ["shallow-pan", { depth: "deep" }],
    ["tray", { vessel: "round-pan" }],
  ] as const)("rejects semantic drift for %s", (id, mutation) => {
    const input = { ...PAN_PROFILE_REGISTRY, [id]: { ...PAN_PROFILE_REGISTRY[id], ...mutation } };
    expect(validatePanProfileRegistry(input)).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_PROFILE_SEMANTICS", profileId: id })]));
  });
});

describe("legacy-round / tray / square adapter", () => {
  it.each([
    [undefined, undefined, "legacy-round"],
    ["round", "round", "legacy-round"],
    ["tray", "round", "tray"],
    [undefined, "square", "tray"],
  ] as const)("maps pan=%s panShape=%s to %s", (pan, shape, expected) => {
    expect(panProfileIdFromLegacy(pan, shape)).toBe(expected);
  });

  it("only projects profiles that have an exact legacy representation", () => {
    expect(legacyPanFieldsFromProfile("legacy-round")).toEqual({ pan: null, panShape: "round" });
    expect(legacyPanFieldsFromProfile("tray")).toEqual({ pan: "tray", panShape: "square" });
    expect(legacyPanFieldsFromProfile("deep-pan")).toBeNull();
  });
});
