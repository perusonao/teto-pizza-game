// Captures mock pages at 390x844 and 360x800 and writes metrics.json. Design-mock tooling only.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire("/node-tools/node_modules/");
const { chromium } = require("playwright");
const dir = fileURLToPath(new URL("./", import.meta.url));
const VPS = [["390x844", 390, 844], ["360x800", 360, 800]];
mkdirSync(dir + "shots", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const metrics = {};
for (const f of readdirSync(dir + "pages").filter((x) => x.endsWith(".html")).sort()) {
  const name = f.replace(".html", "");
  for (const [label, w, h] of VPS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto("file://" + dir + "pages/" + f);
    const m = await p.evaluate(() => {
      const b = document.querySelector(".body");
      const slots = [...document.querySelectorAll(".lock--shop")];
      const dexLocks = [...document.querySelectorAll(".lock--dex")];
      const inter = [...document.querySelectorAll("button")].filter((e) => !e.classList.contains("close"));
      const small = inter.map((e) => e.getBoundingClientRect().height).filter((x) => x > 0);
      const tapMin = small.length ? Math.round(Math.min(...small)) : null;
      return {
        screens: +(b.scrollHeight / b.clientHeight).toFixed(2),
        scrollHeight: b.scrollHeight,
        viewBody: b.clientHeight,
        hOverflow: document.documentElement.scrollWidth > innerWidth || b.scrollWidth > b.clientWidth,
        shopLocked: slots.length,
        shopLockedUnique: new Set(slots.map((e) => e.outerHTML)).size,
        shopLockedHeight: slots[0] ? Math.round(slots[0].getBoundingClientRect().height) : null,
        dexLocked: dexLocks.length,
        dexLockedUniqueExNo: new Set(dexLocks.map((e) => e.outerHTML.replace(/No\.\d+/, "No.xx"))).size,
        dexLockedHeight: dexLocks[0] ? Math.round(dexLocks[0].getBoundingClientRect().height) : null,
        tapMin,
      };
    });
    metrics[`${name}@${label}`] = m;
    await p.screenshot({ path: `${dir}shots/${name}@${label}.png` });
    // second view: scrolled to the LOCKED section (shop) so density of the section itself is visible
    const has = await p.$("[data-shop-locked-section]");
    if (has) {
      await p.evaluate(() => { const b = document.querySelector(".body"); const s = document.querySelector("[data-shop-locked-section]"); b.scrollTop = s.offsetTop - b.offsetTop - 8; });
      await p.screenshot({ path: `${dir}shots/${name}@${label}--locked.png` });
    }
    if (name.startsWith("dex-")) {
      await p.evaluate(() => { const b = document.querySelector(".body"); const t = document.querySelector(".tag-card") ?? document.querySelector("[data-dex-state]"); const r = t.getBoundingClientRect(); b.scrollTop += r.top - b.getBoundingClientRect().top - 170; });
      await p.screenshot({ path: `${dir}shots/${name}@${label}--locked.png` });
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(dir + "metrics.json", JSON.stringify(metrics, null, 2));
console.log("done");
