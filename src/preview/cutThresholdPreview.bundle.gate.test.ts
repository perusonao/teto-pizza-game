// @vitest-environment node
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLcApp } from "../../e2e/support/lcHandBuild";

/**
 * #427 / #426: the CUT threshold override must not ship. Real in-memory `vite build`s of this tree:
 * production (no VITE_PREVIEW_MODE) must contain neither query name; the Preview build must (positive
 * control, so the scan can see what it looks for).
 */
const out = path.join(os.tmpdir(), "cut-threshold-bundle-gate-unused");
const MARKERS = ["cutAreaPct", "cutMinWidth"];

describe("CUT threshold override bundle gate (real vite builds)", () => {
  it("production bundle: 0 occurrences of the override query names", async () => {
    const production = await buildLcApp({ outDir: out, base: "/x/", preview: false, variant: null }, false);
    expect(production.length).toBeGreaterThan(100_000);
    for (const m of MARKERS) expect(production.includes(m), `production bundle contains ${m}`).toBe(false);
  }, 240_000);

  it("positive control: the Preview bundle contains them", async () => {
    const preview = await buildLcApp({ outDir: out, base: "/x/", preview: true, variant: null }, false);
    for (const m of MARKERS) expect(preview.includes(m), `Preview bundle is missing ${m}`).toBe(true);
  }, 240_000);
});
