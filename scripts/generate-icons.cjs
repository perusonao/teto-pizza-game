// App icon / PWA asset generator (Issue #24).
//
// Crops/composites the EXISTING official src/assets/characters/teto.webp artwork onto a
// warm pizzeria-toned gradient background. The character artwork itself is never
// regenerated or altered by an AI model -- it is only key'd out of its own flat backdrop (a
// clean 2-stop vertical gradient baked into the source file, sampled once below) and layered
// via `sharp` compositing, per Issue #24's
// "画像加工は既存Teto assetをcrop/compositeして作る。キャラクター自体をAI再生成しない。"
// requirement.
//
// Run with: node scripts/generate-icons.cjs
// Regenerates every file under public/icons/. `sharp` is a devDependency.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src/assets/characters/teto.webp");
const OUT_DIR = path.join(ROOT, "public/icons");

// Brand palette lifted from src/App.css (header brown / accent red).
const COLOR_DARK = "#2a170d"; // deep oven-char brown (edges)
const COLOR_MID = "#6b4226"; // header brown (mid ring)
const COLOR_GLOW = "#e4572e"; // accent red/orange (fire glow center)

// The source artwork's own flat backdrop is a clean vertical 2-stop gradient (sampled
// directly from src/assets/characters/teto.webp: top ~(235,217,175), bottom ~(208,178,124)).
// Used only to key the backdrop out -- never to alter the character pixels themselves.
const BG_TOP = [235, 217, 175];
const BG_BOTTOM = [208, 178, 124];

function bgEstimateAt(y, height) {
  const t = y / (height - 1);
  return [
    BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t,
    BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t,
    BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t,
  ];
}

function colorDist(r, g, b, bg) {
  return Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
}

/**
 * Keys the flat backdrop out of the source artwork via flood fill (4-connectivity) starting
 * from every border pixel, rather than a plain global color-distance threshold. The source's
 * backdrop is a clean 2-stop vertical gradient that touches all four edges and is
 * contiguous; Teto (fur/apron/bow tie) sits in the middle and never touches the frame. Flood
 * fill only follows background-like pixels, so warm fur tones that happen to be color-close
 * to the backdrop are never mistaken for it unless they're actually *connected* to the
 * border through other background pixels -- a plain per-pixel threshold got this wrong,
 * leaving translucent beige patches bleeding into the character.
 */
async function keyOutBackground() {
  const img = sharp(SRC).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  const FLOOD_THRESHOLD = 60;
  const isBackground = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0;
  let qTail = 0;
  const visited = new Uint8Array(width * height);

  function tryEnqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * channels;
    const dist = colorDist(data[idx], data[idx + 1], data[idx + 2], bgEstimateAt(y, height));
    if (dist > FLOOD_THRESHOLD) return;
    visited[p] = 1;
    isBackground[p] = 1;
    queue[qTail++] = p;
  }

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }
  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % width;
    const y = (p / width) | 0;
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * channels;
      out[idx + 3] = isBackground[p] ? 0 : 255;
    }
  }

  return sharp(out, { raw: { width, height, channels } })
    .blur(0.5) // feather the binary matte edge into a soft antialiased boundary
    .png()
    .toBuffer();
}

function backgroundSvg(size) {
  // A single, calm radial glow (warm oven-fire orange at center fading to a deep brown at
  // the corners) -- deliberately no extra shapes layered on top, so it reads cleanly behind
  // Teto at every size instead of competing with the character for attention.
  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="50%" cy="46%" r="72%">
          <stop offset="0%" stop-color="${COLOR_GLOW}" />
          <stop offset="55%" stop-color="${COLOR_MID}" />
          <stop offset="100%" stop-color="${COLOR_DARK}" />
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#glow)" />
    </svg>
  `);
}

async function buildMaster({ scale, outFile, size = 1024, cutout }) {
  const bg = await sharp(backgroundSvg(size)).png().toBuffer();

  const tetoSize = Math.round(size * scale);
  const teto = await sharp(cutout)
    .extract({ left: 8, top: 6, width: 304, height: 308 })
    .resize(tetoSize, tetoSize, { fit: "cover" })
    .png()
    .toBuffer();

  const offset = Math.round((size - tetoSize) / 2);

  await sharp(bg)
    .composite([{ input: teto, left: offset, top: offset + Math.round(size * 0.03) }])
    .flatten({ background: COLOR_DARK }) // guarantee fully opaque (required for maskable/apple-touch)
    .png()
    .toFile(outFile);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cutout = await keyOutBackground();

  const standardMaster = path.join(OUT_DIR, "_master-standard-1024.png");
  const maskableMaster = path.join(OUT_DIR, "_master-maskable-1024.png");
  // Teto fills most of the frame in the standard master (face reads down to ~32px).
  await buildMaster({ scale: 0.9, outFile: standardMaster, cutout });
  // The maskable master keeps extra safe-zone padding so Android's circle/rounded-square
  // mask never clips Teto's face (content stays inside the inner ~80% safe circle).
  await buildMaster({ scale: 0.62, outFile: maskableMaster, cutout });

  const standard = sharp(standardMaster);
  const sizes = [16, 32, 40, 58, 60, 76, 120, 180, 192, 512];
  for (const s of sizes) {
    await standard.clone().resize(s, s).png().toFile(path.join(OUT_DIR, `icon-${s}.png`));
  }
  await sharp(maskableMaster).resize(512, 512).png().toFile(path.join(OUT_DIR, "icon-512-maskable.png"));

  fs.rmSync(standardMaster);
  fs.rmSync(maskableMaster);

  console.log(`Generated icons in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
