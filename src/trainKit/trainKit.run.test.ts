import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { getReferencePizza } from "../data/referencePizza";
import { CATALOG_FILES, applyCatalogEdits, e2eValues, fillTemplate, hvSeedValues, wireHvSeeds, wirePreviewGate } from "../../tools/train-kit/lib/codegen";
import { catalogDump, deriveForApply, extractRecipe, extractTrain, referenceGroups, shippedFacts } from "../../tools/train-kit/lib/extract";
import { validateKitTrain, withDefaults, type KitTrain } from "../../tools/train-kit/lib/implSpec";
import { scaffoldKit, todoPaths } from "../../tools/train-kit/lib/scaffold";

/**
 * Train Kit RUNNER (Issue #780; a tool, not a gate). Skipped unless `TETO_KIT_MODE` is set -- use `node tools/train-kit/cli.mjs`.
 * It runs inside Vitest only because that is where the real catalog modules (TypeScript, build-time flags) can be imported.
 *
 *   dump     -> TETO_KIT_OUT: the catalog snapshot (catalogDump)
 *   extract  -> TETO_KIT_OUT: the implementation spec of shipped recipes TETO_KIT_IDS (meta: TETO_KIT_TRAIN / _TAG / _LABEL / _ISSUE)
 *   apply    -> edits the working tree from the spec TETO_KIT_SPEC (TETO_KIT_DRY=1: write nothing, report only); report -> TETO_KIT_OUT
 *   scaffold -> TETO_KIT_OUT: the implementation-spec skeleton of the approval spec TETO_KIT_SPEC (authored values left as TODO)
 *   e2e      -> TETO_KIT_OUT: the generated E2E of the spec TETO_KIT_SPEC (from the template; nothing else is written)
 *   coverage -> TETO_KIT_OUT: how much of the shipped catalog the spec format and the generated Reference layout reproduce
 */
const MODE = process.env.TETO_KIT_MODE ?? "";
const OUT = process.env.TETO_KIT_OUT ?? "";
const ROOT = process.cwd();
const TEMPLATES = join(ROOT, "tools", "train-kit", "templates");

function write(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe.skipIf(MODE === "")("train kit runner", () => {
  it.runIf(MODE === "dump")("dump", () => {
    write(OUT, `${JSON.stringify(catalogDump(), null, 1)}\n`);
  });

  it.runIf(MODE === "extract")("extract", () => {
    const ids = (process.env.TETO_KIT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const { kit, unsupported } = extractTrain(ids, { train: process.env.TETO_KIT_TRAIN ?? "extracted", tag: process.env.TETO_KIT_TAG ?? "extracted", label: process.env.TETO_KIT_LABEL ?? "Extracted", issue: Number(process.env.TETO_KIT_ISSUE ?? 780) });
    write(OUT, `${JSON.stringify(kit, null, 1)}\n`);
    console.log(`extracted ${kit.recipes.length} recipe(s), ${kit.newIngredients.length} ingredient(s) -> ${OUT}`);
    for (const u of unsupported) console.log(`NOT EXPRESSIBLE: ${u}`);
  });

  it.runIf(MODE === "apply")("apply", () => {
    const dry = process.env.TETO_KIT_DRY === "1";
    const kit: KitTrain = withDefaults(JSON.parse(readFileSync(process.env.TETO_KIT_SPEC ?? "", "utf8")));
    const problems = validateKitTrain(kit, shippedFacts());
    if (problems.length > 0) throw new Error(`the spec is not applicable:\n- ${problems.join("\n- ")}`);
    const derived = deriveForApply(kit);
    const files = Object.fromEntries(Object.values(CATALOG_FILES).map((rel) => [rel, readRepo(rel)]));
    const edited = applyCatalogEdits(kit, derived, files, { skipGlyphDispatch: process.env.TETO_KIT_SKIP_GLYPH_DISPATCH === "1" });
    const generated: Record<string, string> = {};
    const hasHv = kit.recipes.some((r) => r.ladderStep);
    if (hasHv) {
      edited[CATALOG_FILES.hvSeeds] = wireHvSeeds(files[CATALOG_FILES.hvSeeds], kit);
      edited[CATALOG_FILES.previewGate] = wirePreviewGate(files[CATALOG_FILES.previewGate], kit);
      const hv = hvSeedValues(kit);
      generated[`src/preview/${kit.tag}HvSeeds.ts`] = fillTemplate(readFileSync(join(TEMPLATES, "hvSeeds.ts.tmpl"), "utf8"), hv);
      const { SCENARIO_IDS: _a, RECIPE_IDS: _b, SCENARIOS: _c, ISSUE: _d, ...forTest } = hv;
      generated[`src/preview/${kit.tag}HvSeeds.test.ts`] = fillTemplate(readFileSync(join(TEMPLATES, "hvSeeds.test.ts.tmpl"), "utf8"), forTest);
      const fresh = new Map(kit.newIngredients.map((i) => [i.id, i]));
      const shipped = new Map(INGREDIENTS.map((i) => [i.id, i]));
      const of = (id: string) => fresh.get(id) ?? shipped.get(id)!;
      generated[`e2e/${kit.tag}.spec.ts`] = fillTemplate(readFileSync(join(TEMPLATES, "e2e.spec.ts.tmpl"), "utf8"), e2eValues(kit, { nameJa: (id) => of(id).nameJa, category: (id) => of(id).category as "sauce" | "cheese" | "topping", pieceVisual: (id) => of(id).pieceVisual ?? null }));
    }
    generated[`src/trainKit/landed/${kit.tag}.json`] = `${JSON.stringify(kit, null, 1)}\n`;
    for (const rel of Object.keys(generated)) if (existsSync(join(ROOT, rel))) throw new Error(`refusing to overwrite ${rel}: the tag "${kit.tag}" is already used`);
    if (!dry) for (const [rel, text] of Object.entries({ ...edited, ...generated })) write(join(ROOT, rel), text);
    const report = { train: kit.train, tag: kit.tag, dryRun: dry, edited: Object.keys(edited).sort(), generated: Object.keys(generated).sort(), floors: derived.floors, hvIds: kit.recipes.filter((r) => r.ladderStep).map((r) => `${kit.tag}-${r.hvAlias ?? r.id}`) };
    if (OUT) write(OUT, `${JSON.stringify(report, null, 1)}\n`);
    console.log(`${dry ? "DRY RUN -- nothing written. Would edit" : "edited"} ${report.edited.length} file(s), ${dry ? "would generate" : "generated"} ${report.generated.length} file(s).`);
  });

  it.runIf(MODE === "scaffold")("scaffold", () => {
    const spec = JSON.parse(readFileSync(process.env.TETO_KIT_SPEC ?? "", "utf8"));
    // The evidence id of a staged recipe is read from the staged rows AS TEXT (nothing outside src/data/staged imports that catalog).
    const staged = readRepo("src/data/staged/testSupport/stagedRecipes.ts").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l.replace(/,$/, "")) as { id: string; evidenceId?: string });
    const category = new Map(INGREDIENTS.map((i) => [i.id, i.category as string]));
    const { kit, decisions } = scaffoldKit(spec, { tag: process.env.TETO_KIT_TAG ?? "", label: process.env.TETO_KIT_LABEL ?? "", issue: Number(process.env.TETO_KIT_ISSUE ?? 780) }, { categoryOf: (id) => category.get(id) ?? null, evidenceIdOf: (id) => staged.find((r) => r.id === id)?.evidenceId ?? null });
    write(OUT, `${JSON.stringify(kit, null, 1)}\n`);
    console.log(`edited 1 file: ${OUT} -- ${todoPaths(kit).length} authored value(s) left as TODO`);
    for (const d of decisions) console.log(`NOT EXPRESSIBLE: (decision) ${d}`);
  });

  it.runIf(MODE === "e2e")("e2e", () => {
    // Regenerates the E2E of a spec (landed or not) from the current template, e.g. after a template fix: no validation, one file written.
    const kit: KitTrain = withDefaults(JSON.parse(readFileSync(process.env.TETO_KIT_SPEC ?? "", "utf8")));
    const fresh = new Map(kit.newIngredients.map((i) => [i.id, i]));
    const shipped = new Map(INGREDIENTS.map((i) => [i.id, i]));
    const of = (id: string) => shipped.get(id) ?? fresh.get(id)!;
    write(OUT, fillTemplate(readFileSync(join(TEMPLATES, "e2e.spec.ts.tmpl"), "utf8"), e2eValues(kit, { nameJa: (id) => of(id).nameJa, category: (id) => of(id).category as "sauce" | "cheese" | "topping", pieceVisual: (id) => of(id).pieceVisual ?? null })));
    console.log(`edited 1 file: ${OUT}`);
  });

  it.runIf(MODE === "coverage")("coverage", () => {
    const category = new Map(INGREDIENTS.map((i) => [i.id, i.category as string]));
    const rows = RECIPES.map((r) => {
      const x = extractRecipe(r.id);
      const real = getReferencePizza(r.id);
      const mine = referenceGroups(x.recipe, (id) => category.get(id) ?? null);
      const sameReference = !!real && JSON.stringify(real.pieceGroups.map((g) => ({ ingredientId: g.ingredientId, positions: g.positions }))) === JSON.stringify(mine);
      return { id: r.id as string, expressible: x.unsupported.length === 0, unsupported: x.unsupported, sameReference };
    });
    const summary = { recipes: rows.length, expressible: rows.filter((r) => r.expressible).length, sameReference: rows.filter((r) => r.sameReference).length, both: rows.filter((r) => r.expressible && r.sameReference).length };
    write(OUT, `${JSON.stringify({ summary, rows }, null, 1)}\n`);
    console.log(JSON.stringify(summary));
    expect(rows.length).toBeGreaterThan(0);
  });
});
