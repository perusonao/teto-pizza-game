#!/usr/bin/env node
/**
 * Content Train: build a self-contained train spec from the staged catalog (Issue #780; read-only tool).
 *
 *   node tools/content-train/make-spec.mjs --train T24 --ids banh-mi-pizza,mexican-elote-pizza --out <file.json>
 *   node tools/content-train/make-spec.mjs --train survey --no-mechanic [--exclude a,b] --out <file.json>
 *
 * The staged rows are generated one JSON object per line (`src/data/staged/testSupport/staged{Recipes,Ingredients}.ts`); they are
 * read as TEXT so that nothing outside `src/data/staged/` imports the staged catalog (`stagedIsolation.test.ts`).
 * `--family id=spice,...` / `--placement id=late,...` override the provisional staged values (an Owner decision, recorded in the spec).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const list = (name) => (opt(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const pairs = (name) => Object.fromEntries(list(name).map((p) => p.split("=")));

function rows(file) {
  return readFileSync(join(ROOT, "src", "data", "staged", "testSupport", file), "utf8")
    .split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l.replace(/,$/, "")));
}

const train = opt("--train");
const out = opt("--out");
if (!train || !out || (!args.includes("--no-mechanic") && list("--ids").length === 0)) {
  console.error("usage: make-spec.mjs --train <name> (--ids a,b | --no-mechanic) [--exclude a,b] [--family id=fam,...] [--placement id=late,...] --out <file.json>");
  process.exit(2);
}
const stagedRecipes = rows("stagedRecipes.ts");
const stagedIngredients = new Map(rows("stagedIngredients.ts").map((i) => [i.id, i]));
const exclude = new Set(list("--exclude"));
const wanted = args.includes("--no-mechanic") ? stagedRecipes.filter((r) => r.mechanics.length === 0).map((r) => r.id) : list("--ids");
const family = pairs("--family");
const placement = pairs("--placement");

const recipes = [];
const used = new Set();
for (const id of wanted.filter((x) => !exclude.has(x))) {
  const r = stagedRecipes.find((x) => x.id === id);
  if (!r) {
    console.error(`not a staged recipe: ${id}`);
    process.exit(2);
  }
  for (const q of r.requiredIngredients) if (stagedIngredients.has(q.ingredientId)) used.add(q.ingredientId);
  recipes.push({
    id: r.id, nameJa: r.nameJa,
    placement: placement[r.id] ?? (r.requiredIngredients.some((q) => q.applicationPhase === "POST_BAKE") ? "late" : "ordinary"),
    requiredIngredients: r.requiredIngredients, mechanics: r.mechanics, ownerReasons: r.ownerReasons,
  });
}
const newIngredients = [...used].sort().map((id) => {
  const i = stagedIngredients.get(id);
  return { id, nameJa: i.nameJa, category: i.category, family: i.category === "topping" ? (family[id] ?? i.family) : null };
});
writeFileSync(out, `${JSON.stringify({ train, recipes, newIngredients }, null, 1)}\n`);
console.log(`${out}: ${recipes.length} recipe(s), ${newIngredients.length} new ingredient(s)`);
