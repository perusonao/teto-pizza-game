import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_FILES, applyCatalogEdits, e2eValues, fillTemplate, hvSeedValues, wireHvSeeds, wirePreviewGate } from "../../tools/train-kit/lib/codegen";
import { withDefaults, type KitTrain } from "../../tools/train-kit/lib/implSpec";

/**
 * Anchor health: the generator still finds every insertion point in the REAL catalog files and templates.
 *
 * It applies a synthetic train IN MEMORY (nothing is written, no catalog module is imported, no catalog value is pinned).
 * If this fails after you restructured a catalog file, the generator can no longer write there: move the anchor in
 * `tools/train-kit/lib/codegen.ts` (`applyCatalogEdits` / `wireHvSeeds` / `wirePreviewGate`) to the new shape, then re-run
 * `node tools/train-kit/cli.mjs replay ...` (tools/train-kit/README.md) to prove the catalog it produces is unchanged.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
// Built at run time on purpose: DessertGlyphs.test.tsx scans every source file under src/ for a literal dessert pieceVisual declaration and allows exactly the shipped six.
const DESSERT_PROBE = ["zz-topping-b", "dessert"].join("-");
const KIT: KitTrain = withDefaults({
  train: "anchor-probe", tag: "zzprobe", label: "Anchor Probe", issue: 780,
  newIngredients: [
    { id: "zz-topping-a", nameJa: "プローブA", category: "topping", family: "fruit", color: "#010203", emoji: "zzA", sizeClass: "s", pieceVisual: "zz-topping-a-slices", glyphHost: "StagedGlyph" },
    { id: "zz-sauce", nameJa: "プローブソース", category: "sauce", family: null, color: "#010204", emoji: "zzS" },
    { id: "zz-topping-b", nameJa: "プローブB", category: "topping", family: "spice", color: "#010205", emoji: "zzB", sizeClass: "xs", pieceVisual: DESSERT_PROBE, glyphHost: "DessertGlyph" },
    { id: "zz-cheese", nameJa: "プローブチーズ", category: "cheese", family: null, color: "#010206", emoji: "zzC", sizeClass: "l" },
  ],
  recipes: [
    { id: "zz-ordinary", nameJa: "プローブ1", description: "d", placement: "ordinary", requiredIngredients: [{ ingredientId: "zz-sauce", minCount: 1 }, { ingredientId: "mozzarella", minCount: 2 }, { ingredientId: "zz-topping-a", minCount: 2 }], evidenceId: "zz-1", order: { requestedBy: "mito", lineJa: "l" }, sauceProfile: { ingredientId: "zz-sauce", interaction: "PAINT" }, ladderStep: { ingredientIds: ["zz-sauce", "zz-topping-a"] } },
    { id: "zz-late", nameJa: "プローブ2", description: "d", placement: "late", requiredIngredients: [{ ingredientId: "zz-cheese", minCount: 2 }, { ingredientId: "zz-topping-b", minCount: 2, applicationPhase: "POST_BAKE" }], evidenceId: "zz-2", order: { requestedBy: "mito", lineJa: "l" }, sauceProfile: null, ladderStep: { ingredientIds: ["zz-cheese", "zz-topping-b"] } },
    { id: "zz-rider", nameJa: "プローブ3", description: "d", placement: "ordinary", requiredIngredients: [{ ingredientId: "mozzarella", minCount: 2 }, { ingredientId: "zz-topping-a", minCount: 1 }], ladderCredit: false, evidenceId: "zz-3", order: { requestedBy: "mito", lineJa: "l" }, sauceProfile: null, ladderStep: null },
  ],
});
const slot = [{ ingredientId: "mozzarella", positions: [{ x: 50, y: 24 }] }];

describe("train kit anchors against the real files", () => {
  it("every catalog file accepts its insertions (in memory)", () => {
    const files = Object.fromEntries(Object.values(CATALOG_FILES).map((rel) => [rel, read(rel)]));
    const edited = applyCatalogEdits(KIT, { floors: { "zz-cheese": 999, "zz-topping-b": 999 }, references: { "zz-ordinary": slot, "zz-late": slot, "zz-rider": slot } }, files);
    const touched = Object.keys(edited).sort();
    expect(touched).toEqual(Object.values(CATALOG_FILES).filter((rel) => rel !== CATALOG_FILES.hvSeeds && rel !== CATALOG_FILES.previewGate).sort());
    for (const rel of touched) expect(edited[rel].length, rel).toBeGreaterThan(files[rel].length);
    for (const id of ["zz-ordinary", "zz-late", "zz-rider"]) for (const k of ["hintRoles", "sauceProfiles", "reference"] as const) expect(edited[CATALOG_FILES[k]], `${k}/${id}`).toContain(`"${id}"`);
    expect(edited[CATALOG_FILES.late]).toContain(`"zz-topping-b": 999`);
    expect(edited[CATALOG_FILES.glyph]).toContain(`visual === "zz-topping-a-slices" ||`);
    expect(edited[CATALOG_FILES.glyph]).toContain(`visual === "zz-topping-b-dessert" ||`);
  });

  it("the HV seed chain and the Preview isolation gate accept a new train", () => {
    expect(wireHvSeeds(read(CATALOG_FILES.hvSeeds), KIT)).toContain("parseZZPROBEHvParam(search)");
    expect(wirePreviewGate(read(CATALOG_FILES.previewGate), KIT)).toContain("...ZZPROBE_HV_SCENARIOS.map((s) => s.labelJa),");
  });

  it("the templates fill completely", () => {
    const template = (name: string) => read(join("tools", "train-kit", "templates", name));
    const hv = hvSeedValues(KIT);
    expect(fillTemplate(template("hvSeeds.ts.tmpl"), hv)).toContain(`export type ZZPROBEHvScenarioId = "zzprobe-zz-ordinary" | "zzprobe-zz-late";`);
    const { SCENARIO_IDS: _a, RECIPE_IDS: _b, SCENARIOS: _c, ISSUE: _d, ...forTest } = hv;
    expect(fillTemplate(template("hvSeeds.test.ts.tmpl"), forTest)).toContain("ZZPROBE_HV_SCENARIOS");
    const byId = new Map(KIT.newIngredients.map((i) => [i.id, i]));
    const e2e = fillTemplate(template("e2e.spec.ts.tmpl"), e2eValues(KIT, { nameJa: (id) => byId.get(id)?.nameJa ?? "モッツァレラ", category: (id) => byId.get(id)?.category ?? "cheese", pieceVisual: (id) => byId.get(id)?.pieceVisual ?? null }));
    expect(e2e).toContain(`id: "zz-ordinary", name: "プローブ1", tag: "zzprobe-zz-ordinary"`);
    expect(e2e).toContain(`notYet: ["zz-late"], bake: { start: 60, end: 76 }`);
    expect(e2e).toContain(`post: [{ id: "zz-topping-b", chip: /プローブB/ }]`);
  });
});
