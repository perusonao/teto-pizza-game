import { test, type TestInfo } from "@playwright/test";

/**
 * Progression 2.0 W1 I5b-5 (OD-V-6, Preflight §10.2): a test that forces its own viewport with
 * `page.setViewportSize` runs identically on both projects of an engine (`*-390x844` and
 * `*-360x800`), so it ran twice per engine for nothing. It now runs once per engine, on the
 * project whose width matches the viewport it forces; the sibling project reports it as an
 * intentional skip (the WebKit shard evidence accepts `expectedStatus: skipped`). An unknown
 * project name throws instead of silently skipping.
 */
export function runOnlyOnWidth(testInfo: TestInfo, width: 390 | 360) {
  const m = /-(390|360)x\d+$/.exec(testInfo.project.name);
  if (!m) throw new Error(`OD-V-6 guard: unexpected project ${testInfo.project.name}`);
  test.skip(Number(m[1]) !== width, `OD-V-6: forces its own viewport; runs once per engine on the *-${width}x* project`);
}
