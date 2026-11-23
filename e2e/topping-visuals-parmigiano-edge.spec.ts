import { test, expect, type Page } from "@playwright/test";
import { completeDoughStep, paintSauceRing, tapDoughPercent } from "./gestures";
import { startTargetlessFreeCook } from "./support/startFreeCook";
import { SPRINKLE_ACTIVE_VARIANT, SPRINKLE_VARIANTS } from "../src/components/placedVisuals/sprinkleLayout";

/**
 * V10-1 (soft-edge trial; Owner TETO-PARM-02) edge contract, valid for EVERY variant: whatever the active variant paints on the svg root (nothing, or a blur), (1) the root's computed `filter`
 * is exactly what the variant says, and (2) what sticks out of the 64x64 svg box (the rim crumbs and flakes do) is still painted outside it (tested with a probe dot added to the svg) -- a CSS filter must not clip the
 * overflow (the root is `overflow: visible`), which is exactly what a different engine (WebKit) could get wrong. The visual judgement is the Owner's iPhone HV.
 */
async function placeSprinkles(page: Page) {
  const owned = ["mozzarella", "tomato-sauce", "parmigiano"];
  await page.addInitScript(
    (raw) => localStorage.setItem("teto-pizza-save-v1", JSON.stringify(raw)),
    { schemaVersion: 2, dex: [], pitzBalance: 500, ownedIngredientIds: owned, missionBest: {}, inventory: Object.fromEntries(owned.map((id) => [id, 99])), starterGrantClaimedRecipeIds: [] },
  );
  await page.goto("/");
  await page.waitForSelector(".app-frame");
  await startTargetlessFreeCook(page);
  await page.waitForSelector(".pizza-stage");
  await completeDoughStep(page);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /トマトソース/ }).click();
  await paintSauceRing(page, 25, 16);
  await page.getByRole("button", { name: /次へ/ }).click();
  await page.getByRole("button", { name: /パルミジャーノ/ }).first().click();
  for (const [x, y] of [[50, 50], [34, 62], [66, 38]]) await tapDoughPercent(page, x, y);
  await expect(page.locator(".pizza-topping--parmigiano")).toHaveCount(3);
}

test.describe("Topping Visuals 2.0 / V10-1: the svg root's filter and the overflow", () => {
  test("the root filter is the active variant's edge blur, and a dot outside the svg box is still painted", async ({ page }) => {
    test.setTimeout(90_000);
    await placeSprinkles(page);
    const svg = page.locator(".pizza-topping--parmigiano svg[data-ingredient-visual='parmigiano-shavings']").first();
    await expect(svg).toBeVisible();
    const blur = SPRINKLE_VARIANTS[SPRINKLE_ACTIVE_VARIANT].look.edgeBlur;
    const filter = await svg.evaluate((el) => getComputedStyle(el).filter);
    expect(filter).toBe(blur > 0 ? `blur(${blur}px)` : "none");
    expect(await svg.evaluate((el) => getComputedStyle(el).overflow)).toBe("visible");
    // the pieces land with a short scale animation: wait until the svg box stops moving before measuring it
    await expect
      .poll(async () => {
        const first = await svg.evaluate((el) => JSON.stringify(el.getBoundingClientRect()));
        await page.waitForTimeout(250);
        return first === (await svg.evaluate((el) => JSON.stringify(el.getBoundingClientRect())));
      }, { timeout: 8_000 })
      .toBe(true);

    // A probe dot is added INSIDE the first sprinkle's svg, 2 viewBox units outside the 64x64 box (what the rim shavings do), so the result does not depend on where this id's shavings happen to fall.
    // It is painted through the same root, so it gets the same filter. Shown vs hidden: the pixels that change outside the box prove the filter did not clip the overflow.
    // (The placed wrapper is rotated by -18deg, so the region is taken from the dot's own screen rectangle, not from the svg's axis-aligned bounds.)
    const probe = await page.evaluate(() => {
      const root = document.querySelector("svg[data-ingredient-visual='parmigiano-shavings']")!;
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", "68");
      dot.setAttribute("cy", "32");
      dot.setAttribute("r", "2.5");
      dot.setAttribute("fill", "#000");
      dot.setAttribute("data-probe", "outside");
      root.appendChild(dot);
      const r = dot.getBoundingClientRect();
      return { x: r.left - 3, y: r.top - 3, w: r.width + 6, h: r.height + 6, dot: r.width };
    });
    expect(probe.dot, "the probe dot is too small to test").toBeGreaterThan(3);
    const region = { x: Math.max(0, probe.x), y: Math.max(0, probe.y), width: probe.w, height: probe.h };
    const shown = await page.screenshot({ clip: region });
    await page.evaluate(() => { (document.querySelector("circle[data-probe='outside']") as SVGElement).style.display = "none"; });
    const hidden = await page.screenshot({ clip: region });
    // pixels that differ between "probe dot shown" and "probe dot hidden", in the region OUTSIDE the svg box
    const diff = await page.evaluate(async ([a, b]) => {
      const load = (data: string) => new Promise<ImageData>((resolve) => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const ctx = c.getContext("2d")!; ctx.drawImage(im, 0, 0); resolve(ctx.getImageData(0, 0, im.width, im.height)); }; im.src = `data:image/png;base64,${data}`; });
      const [x, y] = await Promise.all([load(a), load(b)]);
      let n = 0;
      for (let i = 0; i < x.data.length; i += 4) if (Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2])) > 6) n += 1;
      return n;
    }, [shown.toString("base64"), hidden.toString("base64")] as const);
    expect(diff, `the probe dot 2 units outside the svg box is painted (${Math.round(probe.w)}x${Math.round(probe.h)} css px region, root filter: ${filter})`).toBeGreaterThan(2);
  });
});
