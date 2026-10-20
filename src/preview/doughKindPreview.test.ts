import { afterEach, describe, expect, it } from "vitest";
import {
  DOUGH_KIND_PREVIEW_MARK,
  DOUGH_SWITCH_PARAM,
  PREVIEW_DOUGH_SWITCH_VALUE,
  doughSwitchForcedOpen,
  resetDoughKindPreviewForTest,
  resolvePreviewDoughSwitchOpen,
} from "./doughKindPreview";

describe("?doughSwitch=open (Preview / DEV only)", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    resetDoughKindPreviewForTest();
  });

  it("the names are what the Owner types", () => {
    expect(DOUGH_SWITCH_PARAM).toBe("doughSwitch");
    expect(PREVIEW_DOUGH_SWITCH_VALUE).toBe("open");
    expect(DOUGH_KIND_PREVIEW_MARK).toBe("dough-kind-preview-v1");
  });

  it("only the exact, single value is honoured", () => {
    expect(resolvePreviewDoughSwitchOpen("?doughSwitch=open")).toBe(true);
    expect(resolvePreviewDoughSwitchOpen("?a=1&doughSwitch=open&b=2")).toBe(true);
    for (const s of ["", "?", "?doughSwitch=Open", "?doughSwitch=", "?doughSwitch", "?doughSwitch=open&doughSwitch=open", "?doughswitch=open", "?panSwitch=open", "?x=doughSwitch=open"]) {
      expect(resolvePreviewDoughSwitchOpen(s), s).toBe(false);
    }
    for (const bad of [undefined, null, 5, {}, ["?doughSwitch=open"]]) expect(resolvePreviewDoughSwitchOpen(bad)).toBe(false);
  });

  it("is read once per page load and kept until reset", () => {
    window.history.replaceState(null, "", "/?doughSwitch=open");
    resetDoughKindPreviewForTest();
    expect(doughSwitchForcedOpen()).toBe(true);
    window.history.replaceState(null, "", "/");
    expect(doughSwitchForcedOpen()).toBe(true);
    resetDoughKindPreviewForTest();
    expect(doughSwitchForcedOpen()).toBe(false);
  });
});
