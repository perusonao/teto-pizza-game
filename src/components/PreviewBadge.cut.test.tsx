import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** #427: the Preview badge shows an active CUT-threshold override (`· CUT 0.20%/1.5u`) and nothing for the defaults. */
async function badge(previewMode: boolean, search: string) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", previewMode ? "1" : "");
  vi.stubEnv("VITE_PREVIEW_PR", "427");
  vi.stubEnv("VITE_PREVIEW_SHA", "abc1234");
  window.history.pushState({}, "", `/${search}`);
  const { PreviewBadge } = await import("./PreviewBadge");
  return render(<PreviewBadge />).container.querySelector(".preview-badge");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  window.history.pushState({}, "", "/");
});

describe("PreviewBadge CUT threshold label (#427)", () => {
  it("an override: 'PREVIEW · PR# · sha · CUT 0.20%/1.5u' with the marker attribute", async () => {
    const el = await badge(true, "?cutAreaPct=0.2&cutMinWidth=1.5");
    expect(el?.textContent).toBe("PREVIEW · PR#427 · abc1234 · CUT 0.20%/1.5u");
    expect(el?.getAttribute("data-cut-threshold-preview")).toBe("cut-threshold-preview-v1");
  });

  it("the defaults (no query, invalid query, or the default values given explicitly): the ordinary badge", async () => {
    for (const search of ["", "?cutAreaPct=abc", "?cutAreaPct=0.10&cutMinWidth=1.0"]) {
      const el = await badge(true, search);
      expect(el?.textContent).toBe("PREVIEW · PR#427 · abc1234");
      expect(el?.hasAttribute("data-cut-threshold-preview")).toBe(false);
    }
  });

  it("production (no VITE_PREVIEW_MODE): no badge at all, whatever the query", async () => {
    expect(await badge(false, "?cutAreaPct=0.2&cutMinWidth=1.5")).toBeNull();
  });
});
