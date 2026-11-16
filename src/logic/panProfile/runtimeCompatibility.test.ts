import { describe, expect, it } from "vitest";
import { effectivePanShape } from "../pan/effectivePan";
import { resolveEffectivePanRuntime } from "./runtimeCompatibility";

describe("resolveEffectivePanRuntime", () => {
  it.each([
    [{}, {}, "legacy-round", "round", "round"],
    [{ panShape: "round" }, { pan: null }, "legacy-round", "round", "round"],
    [{}, { pan: "tray" }, "tray", "square", "square"],
    [{ panShape: "square" }, {}, "tray", "square", "square"],
  ] as const)("preserves legacy round/tray parity", (recipe, pan, profileId, targetId, shape) => {
    const result = resolveEffectivePanRuntime(recipe, pan);
    expect(result).toEqual({
      ok: true,
      runtime: expect.objectContaining({
        profile: expect.objectContaining({ id: profileId }),
        doughShapeTarget: expect.objectContaining({ id: targetId }),
        legacy: expect.objectContaining({ panShape: shape }),
        source: "legacy",
      }),
    });
  });

  it("matches effectivePanShape for existing round and tray inputs without replacing it", () => {
    const round = resolveEffectivePanRuntime({}, {});
    const tray = resolveEffectivePanRuntime({}, { pan: "tray" });
    expect(round.ok && round.runtime.legacy.panShape).toBe(effectivePanShape(null, null));
    expect(tray.ok && tray.runtime.legacy.panShape).toBe(effectivePanShape(null, { pan: "tray" }));
  });

  it.each(["pan", "shallow-pan", "deep-pan", "steel-pan"])("fails closed for unsupported profile %s", (panProfileId) => {
    expect(resolveEffectivePanRuntime({ panProfileId }, {})).toEqual({
      ok: false,
      reason: "UNSUPPORTED_PROFILE",
      detail: expect.stringContaining("no lossless legacy runtime representation"),
    });
  });

  it("does not silently collapse steel/square to tray/square", () => {
    expect(resolveEffectivePanRuntime({ panProfileId: "steel-pan", doughShapeTargetId: "square" }, { pan: "tray" })).toEqual(
      expect.objectContaining({ ok: false, reason: "UNSUPPORTED_PROFILE" }),
    );
  });

  it.each([
    [{ panProfileId: "future-pan" }, {}, "UNKNOWN_PROFILE"],
    [{ panProfileId: "tray", doughShapeTargetId: "triangle" }, {}, "UNKNOWN_SHAPE_TARGET"],
    [{ panProfileId: "tray", doughShapeTargetId: "round" }, {}, "INCOMPATIBLE_PAN_SHAPE"],
    [{}, { pan: "deep-pan" }, "INVALID_LEGACY_PAN"],
    [{ panShape: "oval" }, {}, "INVALID_LEGACY_PAN"],
  ] as const)("fails closed for unknown or incompatible input", (recipe, pan, reason) => {
    expect(resolveEffectivePanRuntime(recipe, pan)).toEqual(expect.objectContaining({ ok: false, reason }));
  });

  it.each(["constructor", "toString", "__proto__"])("rejects prototype-chain profile ID %s", (panProfileId) => {
    expect(resolveEffectivePanRuntime({ panProfileId }, {})).toEqual(expect.objectContaining({ ok: false, reason: "UNKNOWN_PROFILE" }));
  });

  it("uses an authored compatible shape for a supported profile", () => {
    expect(resolveEffectivePanRuntime({ panProfileId: "legacy-round", doughShapeTargetId: "oval" }, {})).toEqual({
      ok: true,
      runtime: expect.objectContaining({
        profile: expect.objectContaining({ id: "legacy-round" }),
        doughShapeTarget: expect.objectContaining({ id: "oval" }),
        source: "recipe-profile",
      }),
    });
  });

  it.each(["recipe", 1, []])("fails closed without throwing for malformed recipe %j", (recipe) => {
    expect(() => resolveEffectivePanRuntime(recipe as never, {})).not.toThrow();
    expect(resolveEffectivePanRuntime(recipe as never, {})).toEqual(expect.objectContaining({ ok: false, reason: "INVALID_RECIPE" }));
  });
});
