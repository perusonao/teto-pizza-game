// App icon CANDIDATES (HOME / App Icon improvement, comparison only -- nothing here is wired into
// the app). Writes to an output directory given on the command line and NEVER touches public/icons.
//
// Character rule (Issue #24): the only character pixels used are the existing official
// src/assets/characters/teto.webp, cut out (flood-filled backdrop, same method as
// scripts/generate-icons.cjs), cropped and scaled. No AI regeneration, no repainting of the
// character. The pizza is flat vector art drawn here (the repo has no pizza raster asset).
//
// Usage: NODE_PATH=<dir with sharp> node scripts/icon-candidates/generate-icon-candidates.cjs <outDir>
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src/assets/characters/teto.webp");
const OUT = path.resolve(process.argv[2] || "icon-candidates-out");
fs.mkdirSync(OUT, { recursive: true });

const BG_TOP = [235, 217, 175];
const BG_BOTTOM = [208, 178, 124];
const bgAt = (y, h) => BG_TOP.map((v, i) => v + (BG_BOTTOM[i] - v) * (y / (h - 1)));

// Same flood-fill key as generate-icons.cjs, plus a ~1px erosion so the light backdrop fringe
// ("halo") on the dark fur does not survive on a coloured background.
async function cutout() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const bg = new Uint8Array(w * h), seen = new Uint8Array(w * h), q = new Int32Array(w * h);
  let hd = 0, tl = 0;
  const push = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x; if (seen[p]) return;
    const i = p * c, b = bgAt(y, h);
    if (Math.hypot(data[i] - b[0], data[i + 1] - b[1], data[i + 2] - b[2]) > 60) return;
    seen[p] = 1; bg[p] = 1; q[tl++] = p;
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (hd < tl) { const p = q[hd++], x = p % w, y = (p / w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  const out = Buffer.from(data);
  for (let p = 0; p < w * h; p++) out[p * c + 3] = bg[p] ? 0 : 255;
  // erode alpha: blur then high threshold on the alpha channel only
  const alpha = await sharp(out, { raw: { width: w, height: h, channels: c } }).extractChannel(3).blur(1.4).threshold(235).blur(0.6).toBuffer();
  const rgb = await sharp(out, { raw: { width: w, height: h, channels: c } }).removeAlpha().toBuffer();
  return sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

// bust = head + bow tie + top of the apron (320px source coords)
const BUST = { left: 62, top: 14, width: 196, height: 196 };

function pizzaSvg(cx, cy, r, { rim = "#8c5a24" } = {}) {
  const dots = [];
  const pep = [[-.38,-.30],[.22,-.46],[.42,.04],[-.08,.14],[-.44,.30],[.18,.42],[-.02,-.62],[.58,-.30]];
  const leaf = [[.05,-.20],[-.28,.02],[.30,-.12],[.02,.36],[-.52,-.02],[.50,.28]];
  const blob = [[-.3,-.1,.34],[.28,-.25,.30],[.1,.28,.36],[-.2,.34,.26],[.42,.12,.24],[-.05,-.5,.26]];
  for (const [x, y, s] of blob) dots.push(`<ellipse cx="${cx + x * r}" cy="${cy + y * r}" rx="${s * r}" ry="${s * r * .8}" fill="#f6dc8a" opacity=".95"/>`);
  for (const [x, y] of pep) dots.push(`<circle cx="${cx + x * r}" cy="${cy + y * r}" r="${r * .1}" fill="#b3302a" stroke="#7d1f1a" stroke-width="${r * .014}"/>`);
  for (const [x, y] of leaf) dots.push(`<ellipse cx="${cx + x * r}" cy="${cy + y * r}" rx="${r * .075}" ry="${r * .04}" fill="#4f9a3c" transform="rotate(${(x * 300) | 0} ${cx + x * r} ${cy + y * r})"/>`);
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dcab60" stroke="${rim}" stroke-width="${r * .035}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * .86}" fill="#d9492b"/>
    <circle cx="${cx}" cy="${cy}" r="${r * .86}" fill="none" stroke="#b83a20" stroke-width="${r * .02}"/>
    ${dots.join("")}
  </g>`;
}

function sliceSvg(cx, cy, r, ang) {
  // wedge with crust arc; tip at (cx,cy), opening towards `ang` degrees
  const a0 = (ang - 20) * Math.PI / 180, a1 = (ang + 20) * Math.PI / 180;
  const p = (a, k) => [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  const [x0, y0] = p(a0, 1), [x1, y1] = p(a1, 1), [i0x, i0y] = p(a0, .86), [i1x, i1y] = p(a1, .86);
  const [m1x, m1y] = p(ang * Math.PI / 180, .55), [m2x, m2y] = p(ang * Math.PI / 180, .3);
  return `<g stroke-linejoin="round">
    <path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z" fill="#dcab60" stroke="#8c5a24" stroke-width="${r * .04}"/>
    <path d="M${cx},${cy} L${i0x},${i0y} A${r * .86},${r * .86} 0 0 1 ${i1x},${i1y} Z" fill="#f2cf74"/>
    <circle cx="${m1x}" cy="${m1y}" r="${r * .1}" fill="#b3302a" stroke="#7d1f1a" stroke-width="${r * .014}"/>
    <circle cx="${m2x}" cy="${m2y}" r="${r * .075}" fill="#b3302a" stroke="#7d1f1a" stroke-width="${r * .014}"/>
  </g>`;
}

// Each candidate: (S, tetoHref, k) -> svg. k = foreground scale about the centre (1 = full bleed art,
// <1 = maskable safe-zone variant; background always stays full bleed).
const CAND = {
  B: {
    name: "B 「かまど+ピザ」",
    svg: (S, T, k) => {
      const g = (inner) => `<g transform="translate(${S / 2} ${S / 2}) scale(${k}) translate(${-S / 2} ${-S / 2})">${inner}</g>`;
      const tw = S * 0.86;
      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${S}" height="${S}">
        <defs><radialGradient id="bg" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="#ffc47a"/><stop offset=".5" stop-color="#e8743a"/><stop offset="1" stop-color="#7a3416"/></radialGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3df" stop-opacity=".95"/><stop offset=".72" stop-color="#fff3df" stop-opacity=".85"/><stop offset="1" stop-color="#fff3df" stop-opacity="0"/></radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#bg)"/>
        ${g(`<circle cx="${S / 2}" cy="${S * .40}" r="${S * .40}" fill="url(#halo)"/>
        <image xlink:href="${T}" x="${(S - tw) / 2}" y="${S * .035}" width="${tw}" height="${tw}"/>
        ${pizzaSvg(S / 2, S * 1.15, S * .40)}`)}
      </svg>`;
    },
  },
  C: {
    name: "C 「ピザの中のテト」",
    svg: (S, T, k) => {
      const g = (inner) => `<g transform="translate(${S / 2} ${S / 2}) scale(${k}) translate(${-S / 2} ${-S / 2})">${inner}</g>`;
      const tw = S * 0.80, R = S * 0.5;
      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${S}" height="${S}">
        <defs><radialGradient id="bg" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#6b4226"/><stop offset="1" stop-color="#2a170d"/></radialGradient>
        <radialGradient id="ch" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#fff0b8"/><stop offset="1" stop-color="#f2cf74"/></radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#bg)"/>
        ${g(`<circle cx="${S / 2}" cy="${S / 2}" r="${R}" fill="#dcab60" stroke="#8c5a24" stroke-width="${S * .016}"/>
        <circle cx="${S / 2}" cy="${S / 2}" r="${R * .86}" fill="#d9492b"/>
        <circle cx="${S / 2}" cy="${S / 2}" r="${R * .80}" fill="url(#ch)"/>
        ${[[-.62,-.35],[.60,-.40],[-.66,.30],[.64,.34],[0,.80],[-.30,-.76],[.32,-.74]].map(([x, y]) => `<circle cx="${S / 2 + x * R}" cy="${S / 2 + y * R}" r="${R * .085}" fill="#b3302a" stroke="#7d1f1a" stroke-width="${R * .012}"/>`).join("")}
        ${[[-.78,0],[.78,0.02],[-.4,.7],[.42,.68]].map(([x, y]) => `<ellipse cx="${S / 2 + x * R}" cy="${S / 2 + y * R}" rx="${R * .07}" ry="${R * .038}" fill="#4f9a3c" transform="rotate(${(x * 90) | 0} ${S / 2 + x * R} ${S / 2 + y * R})"/>`).join("")}
        <image xlink:href="${T}" x="${(S - tw) / 2}" y="${S * .10}" width="${tw}" height="${tw}"/>`)}
      </svg>`;
    },
  },
  D: {
    name: "D 「クリームバッジ+スライス」",
    svg: (S, T, k) => {
      const g = (inner) => `<g transform="translate(${S / 2} ${S / 2}) scale(${k}) translate(${-S / 2} ${-S / 2})">${inner}</g>`;
      const tw = S * 0.80;
      return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${S}" height="${S}">
        <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4d2c"/><stop offset="1" stop-color="#3a2210"/></linearGradient>
        <radialGradient id="badge" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#fff8ea"/><stop offset="1" stop-color="#f3dfb6"/></radialGradient></defs>
        <rect width="${S}" height="${S}" fill="url(#bg)"/>
        ${g(`<circle cx="${S / 2}" cy="${S * .47}" r="${S * .41}" fill="url(#badge)" stroke="#fff3df" stroke-width="${S * .02}"/>
        <image xlink:href="${T}" x="${(S - tw) / 2}" y="${S * .07}" width="${tw}" height="${tw}"/>
        ${sliceSvg(S * .60, S * .70, S * .36, 45)}`)}
      </svg>`;
    },
  },
};

async function main() {
  const cut = await cutout();
  // The crop ends mid-apron: fade only its bottom ~14% of alpha so there is no hard cut line (no pixel is repainted).
  const fadeSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".84" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#f)"/></svg>`);
  const bustRaw = await sharp(cut).extract(BUST).resize(1024, 1024, { kernel: "lanczos3" }).sharpen({ sigma: 0.8 }).ensureAlpha().png().toBuffer();
  const bust = await sharp(bustRaw).composite([{ input: await sharp(fadeSvg).png().toBuffer(), blend: "dest-in" }]).png().toBuffer();
  const T = "data:image/png;base64," + bust.toString("base64");
  const S = 1024;

  // A: the current production icon, for the comparison (read from public/icons, not modified).
  const A = await sharp(path.join(ROOT, "public/icons/icon-512.png")).resize(S, S, { kernel: "lanczos3" }).png().toBuffer();
  const masters = { A };
  for (const id of Object.keys(CAND)) {
    masters[id] = await sharp(Buffer.from(CAND[id].svg(S, T, 1))).png().toBuffer();
    const mk = await sharp(Buffer.from(CAND[id].svg(S, T, 0.78))).png().toBuffer();
    fs.writeFileSync(path.join(OUT, `cand-${id}-maskable-512.png`), await sharp(mk).resize(512, 512, { kernel: "lanczos3" }).flatten({ background: "#2a170d" }).png().toBuffer());
  }
  fs.writeFileSync(path.join(OUT, "cand-A-512.png"), await sharp(A).resize(512, 512).png().toBuffer());
  for (const id of Object.keys(CAND)) {
    for (const s of [512, 192, 180, 120, 60, 32, 16]) {
      fs.writeFileSync(path.join(OUT, `cand-${id}-${s}.png`), await sharp(masters[id]).resize(s, s, { kernel: "lanczos3" }).flatten({ background: "#2a170d" }).png().toBuffer());
    }
  }
  for (const s of [192, 180, 120, 60, 32, 16]) {
    fs.writeFileSync(path.join(OUT, `cand-A-${s}.png`), await sharp(A).resize(s, s, { kernel: "lanczos3" }).png().toBuffer());
  }

  // contrast of the dark fur vs the surface right around the head (WCAG ratio), from a bg-only render
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const res = {};
  const size = 512;
  const tetoOnly = (id) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}"><image xlink:href="${T}" x="0" y="0" width="${size}" height="${size}"/></svg>`;
  for (const id of ["A", ...Object.keys(CAND)]) {
    const full = await sharp(masters[id]).resize(size, size).removeAlpha().raw().toBuffer();
    // bg-only: A's own icon already has Teto, so for A use the corners/outer ring of the same image; for others re-render without T.
    let bgOnly = full;
    if (id === "A") {
      // the current icon's own backdrop (generate-icons.cjs backgroundSvg), to isolate Teto's pixels
      const sv = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><radialGradient id="glow" cx="50%" cy="46%" r="72%"><stop offset="0%" stop-color="#e4572e"/><stop offset="55%" stop-color="#6b4226"/><stop offset="100%" stop-color="#2a170d"/></radialGradient></defs><rect width="${S}" height="${S}" fill="url(#glow)"/></svg>`;
      bgOnly = await sharp(Buffer.from(sv)).resize(size, size).removeAlpha().raw().toBuffer();
    } else {
      const blank = "data:image/png;base64," + (await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()).toString("base64");
      bgOnly = await sharp(Buffer.from(CAND[id].svg(S, blank, 1))).resize(size, size).removeAlpha().raw().toBuffer();
    }
    // Teto alpha placement for this candidate: render svg with only Teto at the same geometry is candidate specific, so approximate the head ring
    // using the full render vs bg-only render difference (pixels that differ = Teto pixels).
    const diff = new Uint8Array(size * size);
    for (let p = 0; p < size * size; p++) { const i = p * 3; if (Math.abs(full[i] - bgOnly[i]) + Math.abs(full[i + 1] - bgOnly[i + 1]) + Math.abs(full[i + 2] - bgOnly[i + 2]) > 24) diff[p] = 1; }
    let fr = 0, fg = 0, fb = 0, fn = 0;
    for (let p = 0; p < size * size; p++) if (diff[p]) { const L = lum(full[p * 3], full[p * 3 + 1], full[p * 3 + 2]); if (L < 0.06) { fr += full[p * 3]; fg += full[p * 3 + 1]; fb += full[p * 3 + 2]; fn++; } }
    // ring: bg-only pixels within 10px of a Teto pixel (box dilation) but not Teto, above the pizza/rim row
    const ringR = 10; let rr = 0, rg = 0, rb = 0, rn = 0;
    for (let y = ringR; y < size * 0.62; y += 2) for (let x = ringR; x < size - ringR; x += 2) {
      const p = y * size + x; if (diff[p]) continue;
      let near = false;
      for (let dy = -ringR; dy <= ringR && !near; dy += 5) for (let dx = -ringR; dx <= ringR; dx += 5) if (diff[(y + dy) * size + x + dx]) { near = true; break; }
      if (near) { rr += bgOnly[p * 3]; rg += bgOnly[p * 3 + 1]; rb += bgOnly[p * 3 + 2]; rn++; }
    }
    res[id] = { furN: fn, ringN: rn, furLum: lum(fr / fn, fg / fn, fb / fn), ringLum: lum(rr / rn, rg / rn, rb / rn) };
    res[id].contrast = +ratio(res[id].furLum, res[id].ringLum).toFixed(2);
  }
  fs.writeFileSync(path.join(OUT, "contrast.json"), JSON.stringify(res, null, 2));
  fs.writeFileSync(path.join(OUT, "names.json"), JSON.stringify({ A: "A 現行（比較用）", ...Object.fromEntries(Object.entries(CAND).map(([k, v]) => [k, v.name])) }));
  console.log(JSON.stringify(res, null, 1));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
