// Anti-Oracle audit of the mock HTML: LOCKED markup must contain no catalog identity.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const d = fileURLToPath(new URL("./", import.meta.url));
const src = (p) => readFileSync(new URL(`../../../../../src/data/${p}`, import.meta.url), "utf8");
const ing = src("ingredients.ts"), rec = src("recipes.ts");
const terms = new Set([...ing.matchAll(/^\s{4}(?:id|nameJa|emoji): "([^"]+)"/gm), ...rec.matchAll(/^\s{4}(?:id|nameJa): "([^"]+)"/gm)].map((m) => m[1]).filter((t) => t.length >= 2));
const banned = [...terms, "100 Pitz", "50 Pitz", "ピザ分", "仕入れる", "補充", "NEW", "在庫"];
let bad = 0, checked = 0; const report = [];
for (const f of readdirSync(d + "pages")) {
  const h = readFileSync(d + "pages/" + f, "utf8");
  const regions = [];
  const m = h.match(/<section class="locked"[\s\S]*?<\/section>/); if (m) regions.push(m[0].replace(/<div class="hints">[\s\S]*?<\/div>/, "")); // hint rows are aggregate copy, audited separately
  for (const x of h.matchAll(/<div class="lock lock--dex"[\s\S]*?<\/div>/g)) regions.push(x[0]);
  for (const r of regions) { checked++; for (const t of banned) if (r.includes(t)) { bad++; report.push(`${f}: "${t}"`); } }
  const attrs = new Set(regions.flatMap((r) => [...r.matchAll(/\s([a-z-]+)=/g)].map((a) => a[1])));
  report.push(`${f}: regions=${regions.length} attrs=[${[...attrs].sort().join(",")}]`);
}
const line = `terms=${terms.size} regionsChecked=${checked} violations=${bad}`;
writeFileSync(d + "audit.txt", line + "\n" + report.join("\n") + "\n");
console.log(line);
