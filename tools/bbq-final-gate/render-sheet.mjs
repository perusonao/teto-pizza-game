// Issue #611 BBQ gate: render the cilantro candidate next to the existing herb glyphs (docs-only observation).
// Run: node tools/bbq-final-gate/render-sheet.mjs <outDir>
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const out = process.argv[2] ?? "docs/reports/screenshots/bbq-cilantro-svg";
mkdirSync(out, { recursive: true });
const svg = (p) => readFileSync(p, "utf8");
const ref = "docs/design/references/ingredient-icons-2.0/";
const cand = svg("docs/design/candidates/cilantro-bbq/cilantro-A.svg");
const items = [
  ["cilantro (候補 A)", cand],
  ["しそ shiso-leaf", svg(ref + "shiso.svg")],
  ["青ねぎ green-onion", svg(ref + "green-onion.svg")],
  ["パセリ ☘️", "☘️"],
  ["ミント 🍀", "🍀"],
  ["バジル 🌿", "🌿"],
  ["オレガノ 🍃", "🍃"],
  ["ローズマリー 🌱", "🌱"],
];
const sized = (inner, px) => (inner.startsWith("<svg") ? inner.replace(/width="64" height="64"/, `width="${px}" height="${px}"`) : `<span style="font-size:${px}px;line-height:1">${inner}</span>`);
const row = (bg, px, scale) => `<div class="row" style="background:${bg}">${items.map(([n, g]) => `<div class="c"><div class="g" style="height:${px + 8}px">${sized(g, Math.round(px * scale))}</div><div class="n">${n}</div></div>`).join("")}</div>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;font-family:system-ui,"Hiragino Sans",sans-serif;background:#fff8ea;width:1100px}
h3{margin:10px 0 4px;font-size:14px}.row{display:flex;gap:6px;padding:8px;border-radius:10px}.c{width:128px;text-align:center}.g{display:flex;align-items:center;justify-content:center}.n{font-size:11px;color:#333;margin-top:2px}
.dark .n{color:#fff}</style>
<h3>タイル上の大きさ 48px（1em = トレイの絵）</h3>${row("#fff8ea", 48, 1)}
<h3>RESULT・図鑑の大きさ 24px（emoji は 24px、xs ピースは ×0.7 ≒ 17〜21px）</h3>${row("#fff8ea", 24, 1)}
<h3>ピザ上の xs（×0.7 ≒ 20px）— 焼き色の生地 #e8b96e</h3>${row("#e8b96e", 20, 1)}
<h3>ピザ上の xs（×0.7 ≒ 20px）— トマトソース #d4452f</h3>${row("#d4452f", 20, 1)}
<h3>ピザ上の xs（×0.7 ≒ 20px）— BBQ ソース #7a2f1c（暫定色）</h3><div class="dark">${row("#7a2f1c", 20, 1)}</div>`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1124, height: 700 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: `${out}/cilantro-candidate-A-vs-existing.png`, fullPage: true });
await b.close();
