#!/usr/bin/env node
/** Pixel-compares the E-* (no post pieces) screenshots (the observation-only E-square-post-* shots are skipped: they have no baseline) of two tools/finishD22bHv.mjs runs: node tools/finishD22bHvCompare.mjs <dir> <tagA> <tagB> */
import { createRequire } from "node:module";
import fs from "node:fs";
const [dir, a, b] = process.argv.slice(2);
const sharp = createRequire(import.meta.url)("sharp");
const names = fs.readdirSync(dir).filter((f) => f.startsWith(`${a}-`) && /-E-/.test(f) && !/-E-square-post-/.test(f) && f.endsWith(".png"));
let bad = 0;
for (const f of names.sort()) {
  const g = f.replace(`${a}-`, `${b}-`);
  if (!fs.existsSync(`${dir}/${g}`)) { console.log("MISSING", g); bad++; continue; }
  const A = await sharp(`${dir}/${f}`).removeAlpha().raw().toBuffer();
  const B = await sharp(`${dir}/${g}`).removeAlpha().raw().toBuffer();
  let n = 0, m = 0;
  for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); if (d) { n++; if (d > m) m = d; } }
  const same = A.length === B.length && n === 0;
  if (!same) bad++;
  console.log(same ? "SAME " : "DIFF ", f.replace(`${a}-`, ""), same ? "" : `changedValues=${n} maxDelta=${m}`);
}
console.log(bad === 0 ? "ALL IDENTICAL" : `${bad} differing`);
