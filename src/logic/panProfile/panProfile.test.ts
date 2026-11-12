import { describe, expect, it } from "vitest";
import { DOUGH_SHAPE_TARGET_REGISTRY } from "../doughShapeTarget";
import { checkPanShapeCompatibility } from "./compatibility";
import { legacyPanFromProfile, panProfileIdFromLegacy } from "./legacyAdapter";
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
    expect(checkPanShapeCompatibility("griddle", "boat")).toEqual({ compatible: true });
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
    expect(legacyPanFromProfile("legacy-round")).toBe("round");
    expect(legacyPanFromProfile("tray")).toBe("tray");
    expect(legacyPanFromProfile("deep-pan")).toBeNull();
  });
});
