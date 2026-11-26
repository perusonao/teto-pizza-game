// App icon / PWA asset generator (Issue #24; source swapped to the "てっちゃん" icon by Owner decision 2026-11-26).
//
// Resizes the Owner-supplied master artwork `scripts/assets/tecchan-app-icon-source.png` (1600x1600,
// rounded-corner square on a flat cream background) into every file under public/icons/. The character
// artwork itself is never regenerated or altered -- it is only cropped and resized.
//
// - standard icons: the master is cropped inward to drop its white rounded-corner margin (so every
//   output is an opaque, full-bleed square -- required for apple-touch-icon) and resized.
// - maskable icon: the same crop is scaled down onto a flat cream canvas so Android's circle /
//   rounded-square mask never clips the face (content stays inside the ~80% safe zone).
//
// Run with: node scripts/generate-icons.cjs
// Regenerates every file under public/icons/. `sharp` is a devDependency.
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(__dirname, "assets/tecchan-app-icon-source.png");
const OUT_DIR = path.join(ROOT, "public/icons");

// Flat cream backdrop sampled from the master's edge (252, 235, 211).
const CREAM = { r: 252, g: 235, b: 211 };
// Crop inset in master pixels: 100px clears the master's white rounded corners (verified: all four
// corner pixels of the inset square are the cream backdrop).
const INSET = 100;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const meta = await sharp(SRC).metadata();
  if (meta.width !== meta.height) throw new Error(`master must be square, got ${meta.width}x${meta.height}`);
  const side = meta.width - INSET * 2;
  const full = await sharp(SRC)
    .extract({ left: INSET, top: INSET, width: side, height: side })
    .removeAlpha()
    .png()
    .toBuffer();

  const sizes = [16, 32, 40, 58, 60, 76, 120, 180, 192, 512];
  for (const s of sizes) {
    await sharp(full).resize(s, s).png().toFile(path.join(OUT_DIR, `icon-${s}.png`));
  }

  const MASKABLE = 512;
  const inner = Math.round(MASKABLE * 0.8);
  const innerBuf = await sharp(full).resize(inner, inner).png().toBuffer();
  const offset = Math.round((MASKABLE - inner) / 2);
  await sharp({ create: { width: MASKABLE, height: MASKABLE, channels: 3, background: CREAM } })
    .composite([{ input: innerBuf, left: offset, top: offset }])
    .png()
    .toFile(path.join(OUT_DIR, "icon-512-maskable.png"));

  console.log(`Generated icons in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
