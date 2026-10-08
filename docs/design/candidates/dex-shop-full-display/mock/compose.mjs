// Composes shots/ into dex-comparison.png / shop-comparison.png (labels only; no new design content).
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire("/node-tools/node_modules/");
const { chromium } = require("playwright");
const mock = fileURLToPath(new URL("./", import.meta.url));
const out = fileURLToPath(new URL("../", import.meta.url));
const COLS = [["案A 情報密度優先 · 390×844", "a", "390x844", 390], ["案B 操作性・視認性優先 · 390×844", "b", "390x844", 390], ["案A · 360×800", "a", "360x800", 360], ["案B · 360×800", "b", "360x800", 360]];
const sheets = {
  "dex-comparison": { title: "Dex 比較モック（#422 / DESIGN ONLY・未承認UI案）", rows: [["初期状態 3/53 発見（先頭表示）", "dex-{v}-initial", ""], ["初期状態（章をまたぐ下方スクロール）", "dex-{v}-initial", "--locked"], ["中盤 22/53 発見（🎨 単独 DISCOVERABLE 枠を含む）", "dex-{v}-mid", "--locked"]] },
  "shop-comparison": { title: "Shop 比較モック（#422 / DESIGN ONLY・未承認UI案）", rows: [["初期: NEW1 / OWNED2 / LOCKED51（先頭表示）", "shop-{v}-initial", ""], ["初期: LOCKEDセクションまでスクロール（発見数ヒントのみ）", "shop-{v}-initial", "--locked"], ["中盤＋カテゴリ『具材』選択中（上部タブは画面外。LOCKED 42 件は『すべて』と同数で不変）", "shop-{v}-mid-topping", "--locked"], ["終盤: 発見数ヒント＋⭐ヒント 同時表示（LOCKED 4）", "shop-{v}-late", "--locked"], ["完全解禁: LOCKEDセクション非表示", "shop-{v}-full", ""]] },
};
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [file, s] of Object.entries(sheets)) {
  const head = COLS.map((c) => `<div class="ch" style="width:${c[3]}px">${c[0]}</div>`).join("");
  const rows = s.rows.map(([label, tpl, suf]) => `<h2>${label}</h2><div class="r">${COLS.map(([, v, vp, w]) => `<img style="width:${w}px" src="file://${mock}shots/${tpl.replace("{v}", v)}@${vp}${suf}.png">`).join("")}</div>`).join("");
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:24px;background:#2b2118;color:#fff3dc;font-family:-apple-system,"Noto Sans JP",sans-serif;width:max-content}h1{font-size:26px;margin:0 0 4px}p{margin:0 0 16px;color:#d8c7a5;font-size:14px}h2{font-size:17px;margin:26px 0 8px;color:#f2b705}.r,.h{display:flex;gap:20px}.ch{font-weight:800;font-size:14px;color:#fff;background:#5a3b1d;border-radius:8px;padding:8px 10px;text-align:center}img{display:block;border-radius:6px;outline:1px solid #6b4b2a}</style><h1>${s.title}</h1><p>LOCKED には実名・食材ID・画像・分類・価格を一切載せない匿名枠。実装は #418 Owner HV PASS まで禁止。</p><div class="h">${head}</div>${rows}`;
  writeFileSync(mock + `.compose-${file}.html`, html);
  const p = await b.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1.5 });
  await p.goto("file://" + mock + `.compose-${file}.html`);
  await p.waitForLoadState("load");
  await p.screenshot({ path: out + file + ".png", fullPage: true });
  await p.close();
}
await b.close();
