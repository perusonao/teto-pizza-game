import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** LC-R6-b: the Preview badge identifies the Hand variant (HAND 9 / HAND 12) and shows nothing for OFF / production. */
async function badge(previewMode: boolean, variant: unknown) {
  vi.resetModules();
  vi.stubEnv("VITE_PREVIEW_MODE", previewMode ? "1" : "");
  vi.stubEnv("VITE_PREVIEW_PR", "318");
  vi.stubEnv("VITE_PREVIEW_SHA", "abc1234");
  vi.doMock("../preview/lcHandPreview", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../preview/lcHandPreview")>()),
    LC_HAND_PREVIEW_CAPACITY: variant,
  }));
  const { PreviewBadge } = await import("./PreviewBadge");
  return render(<PreviewBadge />).container.querySelector(".preview-badge");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("../preview/lcHandPreview");
  vi.resetModules();
});

describe("PreviewBadge Hand variant label (LC-R6-b)", () => {
  it.each([9, 12] as const)("variant %s: 'PREVIEW · PR# · sha · HAND %s'", async (variant) => {
    const el = await badge(true, variant);
    expect(el?.textContent).toBe(`PREVIEW · PR#318 · abc1234 · HAND ${variant}`);
    expect(el?.getAttribute("data-lc-hand-preview")).toBe("lc-hand-preview-v1");
  });

  it("variant null (normal Preview): the ordinary badge with no HAND suffix", async () => {
    const el = await badge(true, null);
    expect(el?.textContent).toBe("PREVIEW · PR#318 · abc1234");
    expect(el?.hasAttribute("data-lc-hand-preview")).toBe(false);
  });

  it("an invalid variant shows no HAND label (Hand is OFF)", async () => {
    const el = await badge(true, 10);
    expect(el?.textContent).toBe("PREVIEW · PR#318 · abc1234");
  });

  it.each([null, 9, 12])("production (no VITE_PREVIEW_MODE), variant %s: no badge at all", async (variant) => {
    expect(await badge(false, variant)).toBeNull();
  });
});
