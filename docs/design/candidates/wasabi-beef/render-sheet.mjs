// docs-only candidate sheet: node render-sheet.mjs <outPng>  (reads sibling SVGs + the adopted reference SVGs; changes nothing else)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright"); // run with NODE_PATH pointing at a Playwright install
const here = path.dirname(fileURLToPath(import.meta.url));
const ref = path.join(here, "../../references/ingredient-icons-2.0");
const read = (p) => readFileSync(p, "utf8");
const items = [
  ["beef A", read(path.join(here, "beef-A.svg"))],
  ["wasabi A", read(path.join(here, "wasabi-A.svg"))],
  ["wasabi B", read(path.join(here, "wasabi-B.svg"))],
  ["pepperoni*", read(path.join(ref, "pepperoni.svg"))],
  ["ham*", read(path.join(ref, "ham.svg"))],
  ["bacon*", read(path.join(ref, "bacon.svg"))],
  ["pork*", read(path.join(ref, "pork.svg"))],
  ["shiso*", read(path.join(ref, "shiso.svg"))],
  ["green-onion*", read(path.join(ref, "green-onion.svg"))],
  ["pomegranate*", read(path.join(ref, "pomegranate.svg"))],
];
const bgs = [["焼成後の生地", "#e2b878"], ["こんがり", "#c98a4b"], ["醤油ソース案", "#3a2418"], ["トマト", "#d4452f"]];
const cell = (svg, px) => `<span style="display:inline-block;width:${px}px;height:${px}px">${svg.replace(/width="64" height="64"/, `width="${px}" height="${px}"`)}</span>`;
let html = `<body style="margin:0;font:12px sans-serif;background:#fff"><div style="padding:8px">* = adopted reference SVG (existing). Sizes: 48 / 24 / 20 px (xs on the pizza ≈ 20px).</div>`;
for (const [bn, bc] of bgs) {
  html += `<div style="background:${bc};padding:8px;margin:4px 0;color:${bc === "#e2b878" ? "#000" : "#fff"}"><div>${bn} ${bc}</div><div style="display:flex;gap:10px;flex-wrap:wrap">`;
  for (const [n, svg] of items) html += `<div style="text-align:center;width:84px">${cell(svg, 48)}<br>${cell(svg, 24)}${cell(svg, 20)}<br>${n}</div>`;
  html += `</div></div>`;
}
html += `</body>`;
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 940, height: 560 } });
await pg.setContent(html);
await pg.screenshot({ path: process.argv[2], fullPage: true });
await b.close();
