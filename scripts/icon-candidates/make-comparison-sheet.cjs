// Builds the Owner comparison sheets from the candidate PNGs written by generate-icon-candidates.cjs.
// Usage: NODE_PATH=<dir with sharp> node scripts/icon-candidates/make-comparison-sheet.cjs <candidatesDir> <outDir>
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const IN = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || IN);
fs.mkdirSync(OUT, { recursive: true });
const names = JSON.parse(fs.readFileSync(path.join(IN, "names.json"), "utf8"));
const contrast = JSON.parse(fs.readFileSync(path.join(IN, "contrast.json"), "utf8"));
const ids = ["A", "B", "C", "D"];
// A's maskable = the current production one (read only)
fs.copyFileSync(path.join(ROOT, "public/icons/icon-512-maskable.png"), path.join(IN, "cand-A-maskable-512.png"));
const b64 = (f) => "data:image/png;base64," + fs.readFileSync(path.join(IN, f)).toString("base64");
const FONT = `font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif"`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let uid = 0;
const rounded = (file, x, y, s) => { const id = `c${uid++}`; return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${(s * 0.2237).toFixed(1)}"/></clipPath><image href="${b64(file)}" x="${x}" y="${y}" width="${s}" height="${s}" clip-path="url(#${id})"/>`; };
const circle = (file, x, y, s) => { const id = `c${uid++}`; return `<clipPath id="${id}"><circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s / 2}"/></clipPath><image href="${b64(file)}" x="${x}" y="${y}" width="${s}" height="${s}" clip-path="url(#${id})"/>`; };
const plain = (file, x, y, s) => `<image href="${b64(file)}" x="${x}" y="${y}" width="${s}" height="${s}"/>`;
const cap = (t, x, y, sz = 13, col = "#6b4226", anchor = "start") => `<text x="${x}" y="${y}" font-size="${sz}" fill="${col}" text-anchor="${anchor}" ${FONT}>${esc(t)}</text>`;

async function sheet1() {
  const W = 1480, rowH = 610, H = 130 + rowH * 4;
  let g = `<rect width="${W}" height="${H}" fill="#f7ecd4"/>` + cap("アプリアイコン 比較シート（実寸 100% 表示）", 30, 46, 28, "#4a2e0a").replace("<text", "<text font-weight=\"700\"");
  g += cap("iOS 角丸マスクは 180/120/60 のみ、32/16 は favicon（角丸なし）、右下は Android maskable（円マスク）。キャラの画素は teto.webp の切り抜きのみ、ピザはベクター描画。", 30, 80, 14);
  ids.forEach((id, r) => {
    const y0 = 110 + r * rowH;
    g += `<line x1="30" x2="${W - 30}" y1="${y0 - 8}" y2="${y0 - 8}" stroke="#c99b56"/>`;
    g += cap(names[id], 30, y0 + 28, 22, "#2a170d").replace("<text", "<text font-weight=\"700\"");
    g += cap(`毛並み ↔ 頭まわりの背景 コントラスト比 ${contrast[id].contrast}:1（現行 2.14:1）`, 30, y0 + 54, 15);
    g += plain(`cand-${id}-512.png`, 30, y0 + 66, 512);
    g += cap("512px", 30, y0 + 66 + 512 + 18, 13);
    const x1 = 590, y1 = y0 + 66;
    g += rounded(`cand-${id}-192.png`, x1, y1, 192) + cap("192px (manifest)", x1, y1 + 210);
    g += rounded(`cand-${id}-180.png`, x1 + 230, y1, 180) + cap("180px (apple-touch)", x1 + 230, y1 + 210);
    g += rounded(`cand-${id}-120.png`, x1 + 440, y1, 120) + cap("120px", x1 + 440, y1 + 210);
    g += rounded(`cand-${id}-60.png`, x1 + 590, y1, 60) + cap("60px", x1 + 590, y1 + 90);
    g += plain(`cand-${id}-32.png`, x1 + 680, y1, 32) + cap("32", x1 + 680, y1 + 52);
    g += plain(`cand-${id}-16.png`, x1 + 735, y1, 16) + cap("16", x1 + 735, y1 + 36);
    g += circle(`cand-${id}-maskable-512.png`, x1, y1 + 250, 192) + cap("maskable（円マスク）", x1, y1 + 250 + 210);
    // zoomed 60px / 32px (nearest-neighbour x4) to judge what survives
    g += `<image href="${b64(`cand-${id}-60.png`)}" x="${x1 + 270}" y="${y1 + 250}" width="240" height="240" style="image-rendering:pixelated"/>` + cap("60px を 4倍拡大（ピクセル確認）", x1 + 270, y1 + 250 + 258);
  });
  fs.writeFileSync(path.join(OUT, "icon-compare-sizes.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`)).png().toFile(path.join(OUT, "icon-compare-sizes.png"));
}

async function sheet2() {
  // four iPhone-like home screens (390x844 @1x), 60pt icons, the candidate sits among neutral filler apps
  const pw = 390, ph = 560, gap = 30, W = pw * 4 + gap * 5, H = ph + 120;
  const filler = ["#3a7bd5", "#43a047", "#e0e0e0", "#fbc02d", "#8e5bd6", "#ef5350", "#26a69a", "#455a64", "#ff7043", "#5c6bc0", "#9ccc65", "#78909c"];
  const fnames = ["メール", "写真", "メモ", "天気", "音楽", "地図", "時計", "設定", "本", "カメラ", "計算機", "ヘルス"];
  let g = `<rect width="${W}" height="${H}" fill="#2b2b30"/>` + cap("ホーム画面イメージ（60pt、周囲は無関係な一般アプリの仮タイル）", 30, 44, 24, "#fff").replace("<text", "<text font-weight=\"700\"");
  ids.forEach((id, i) => {
    const x0 = gap + i * (pw + gap), y0 = 80;
    g += `<defs><linearGradient id="wp${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c6a8a"/><stop offset="1" stop-color="#8e5b7a"/></linearGradient></defs>`;
    g += `<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" rx="36" fill="url(#wp${i})"/>`;
    const cols = 4, cell = pw / cols, ic = 60;
    const slot = 5; // the candidate's position in the grid
    let f = 0;
    for (let n = 0; n < 16; n++) {
      const cx = x0 + (n % cols) * cell + (cell - ic) / 2, cy = y0 + 110 + Math.floor(n / cols) * 110;
      if (n === slot) {
        g += rounded(`cand-${id}-${id === "A" ? 120 : 120}.png`, cx, cy, ic);
        g += cap("テトのピザ屋", cx + ic / 2, cy + ic + 16, 11, "#fff", "middle");
      } else {
        g += `<rect x="${cx}" y="${cy}" width="${ic}" height="${ic}" rx="${ic * 0.2237}" fill="${filler[f % filler.length]}" opacity=".85"/>` + cap(fnames[f % fnames.length], cx + ic / 2, cy + ic + 16, 11, "#fff", "middle");
        f++;
      }
    }
    g += cap(names[id], x0, y0 + ph + 30, 18, "#fff", "start");
  });
  fs.writeFileSync(path.join(OUT, "icon-compare-homescreen.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`)).png().toFile(path.join(OUT, "icon-compare-homescreen.png"));
}
(async () => { await sheet1(); await sheet2(); console.log("sheets written to", OUT); })().catch((e) => { console.error(e); process.exitCode = 1; });
