// @vitest-environment node
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLcApp } from "../../e2e/support/lcHandBuild";

/**
 * LC-R6-b, gates P-1 / V-in-production (bundle level). Real, in-memory `vite build`s of this tree:
 * production (no VITE_PREVIEW_MODE) and Preview (VITE_PREVIEW_MODE=1), each with the source as committed
 * (variant null) and with the one committed line rewritten to 9 / 12 (what an HV-only disposable commit changes).
 *
 * - The production bundle has no Preview activation marker / HAND badge label, whatever the committed variant.
 * - With the variant rewritten, the production bundle is BYTE-IDENTICAL to the plain production bundle: the variant
 *   cannot influence a production artifact at all (Hand OFF is structural, not merely "the value happens to be off").
 * - A Preview bundle does carry the marker and label (so this scan can see what it looks for), and a Preview
 *   variant bundle differs from the plain Preview bundle.
 * The behavioural counterpart (real browser, DOM golden) is e2e/lc-hand-preview-activation.spec.ts.
 */
const out = path.join(os.tmpdir(), "lc-hand-bundle-gate-unused");
const MARKERS = ["lc-hand-preview-v1", "data-lc-hand-preview", "HAND "];

const builds: Record<string, string> = {};
async function bundle(key: string, preview: boolean, variant: 9 | 12 | null) {
  builds[key] ??= await buildLcApp({ outDir: out, base: "/x/", preview, variant }, false);
  return builds[key];
}

describe("LC-R6-b bundle gates (real vite builds)", () => {
  it("P-1: the production bundle has no Preview activation marker or HAND label", async () => {
    const production = await bundle("prod-null", false, null);
    expect(production.length).toBeGreaterThan(100_000); // a real app bundle
    for (const m of MARKERS) expect(production.includes(m), `production bundle contains ${JSON.stringify(m)}`).toBe(false);
  }, 240_000);

  it("the scan can see them: a Preview bundle carries the marker and the HAND label", async () => {
    const preview = await bundle("preview-null", true, null);
    for (const m of MARKERS) expect(preview.includes(m), `Preview bundle is missing ${JSON.stringify(m)}`).toBe(true);
  }, 240_000);

  it.each([9, 12] as const)("variant %s committed, PRODUCTION build: byte-identical to the plain production bundle (Hand OFF, nothing read)", async (variant) => {
    const plain = await bundle("prod-null", false, null);
    const withVariant = await bundle(`prod-${variant}`, false, variant);
    for (const m of MARKERS) expect(withVariant.includes(m), `${variant}: production bundle contains ${JSON.stringify(m)}`).toBe(false);
    expect(withVariant === plain, `${variant}: production output changed with the committed variant`).toBe(true);
  }, 240_000);

  it.each([9, 12] as const)("variant %s committed, PREVIEW build: a different bundle from the plain Preview build (the variant is compiled in)", async (variant) => {
    const plain = await bundle("preview-null", true, null);
    const withVariant = await bundle(`preview-${variant}`, true, variant);
    expect(withVariant === plain).toBe(false);
    expect(withVariant.includes("lc-hand-preview-v1")).toBe(true);
  }, 240_000);

  it("the two Preview variants differ from each other (9 vs 12 is a real, single-line difference)", async () => {
    expect((await bundle("preview-9", true, 9)) === (await bundle("preview-12", true, 12))).toBe(false);
  }, 240_000);
});
