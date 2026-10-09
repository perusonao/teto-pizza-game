import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { DOUGH, dragLine, toCutStep } from "./common";

/**
 * Random search (investigation only): "two close cuts + one crossing cut", biased to the right end of the pizza, on
 * the iPhone's pixel density. Each case writes the RESULT pizza twice -- as drawn, and with the piece clip-paths
 * removed (the full, round pizza as the reference) -- for offline comparison (search-analyze.py).
 */
const OUT = process.env.PROBE_OUT ?? "probe-out";
const COUNT = Number(process.env.SEARCH_COUNT ?? 40);

/** small deterministic PRNG so a run is reproducible */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

interface Spec {
  readonly name: string;
  readonly stretch: number | null;
  readonly cuts: ReadonlyArray<readonly [number, number]>;
}

function makeCases(): Spec[] {
  const r = rng(427);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const out: Spec[] = [];
  for (let i = 0; i < COUNT; i += 1) {
    const rightBiased = i < Math.floor(COUNT * 0.7);
    const theta = rightBiased ? 75 + r() * 30 : r() * 180; // near-vertical for the right end
    const p = rightBiased ? -(28 + r() * 19) : (r() * 2 - 1) * 44; // right side: x = 50 - p
    const g = pick([0.3, 0.6, 1.0, 1.6, 2.5]);
    const phi = theta + pick([-1, 1]) * (25 + r() * 130);
    const q = (r() * 2 - 1) * 38;
    const stretch = pick([null, 49.4]);
    out.push({
      name: `c${String(i).padStart(2, "0")}_th${theta.toFixed(0)}_p${p.toFixed(1)}_g${g}_phi${(((phi % 180) + 180) % 180).toFixed(0)}_q${q.toFixed(0)}_${stretch ?? "std"}`,
      stretch,
      cuts: [[theta, p], [theta, p + g], [phi, q]],
    });
  }
  return out;
}

for (const c of makeCases()) {
  test(`search ${c.name}`, async ({ page }, info) => {
    test.setTimeout(150_000);
    const dir = path.join(OUT, info.project.name, c.name);
    fs.mkdirSync(dir, { recursive: true });
    await toCutStep(page, c.stretch);
    let committed = 0;
    for (const [ang, off] of c.cuts) {
      const before = await page.locator(".pizza-cut-mark").count();
      await dragLine(page, ang, off);
      await page.mouse.move(2, 2);
      // a drag shorter than the minimum, or outside the pizza, commits nothing; count what really landed
      committed = await page.locator(".pizza-cut-mark").count();
      void before;
    }
    fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify({ ...c, committed }));
    if (committed < 3) return; // not the shape we are searching for
    await page.getByRole("button", { name: /切り終わる/ }).click();
    await expect(page.locator(".result-panel")).toBeVisible();
    await expect.poll(() => page.locator(".pizza-piece").count()).toBeGreaterThan(0);
    const pieces = await page.locator(".pizza-piece").count();
    fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify({ ...c, committed, pieces }));
    await page.waitForTimeout(150);
    await page.locator(DOUGH).first().screenshot({ path: path.join(dir, "10-result-asis.png") });
    const h = await page.addStyleTag({ content: ".pizza-piece-clip{clip-path:none !important}" });
    await page.waitForTimeout(150);
    await page.locator(DOUGH).first().screenshot({ path: path.join(dir, "10-result-no-clip-path.png") });
    await h.evaluate((el) => el.remove());
  });
}
