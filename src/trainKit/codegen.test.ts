import { describe, expect, it } from "vitest";
import { AnchorError, appendInline, emojiLiteral, fillTemplate, insertAfterLine, insertBeforeClose, insertBeforeLine, key, renderIngredient, renderRecipe, wireHvSeeds, wirePreviewGate } from "../../tools/train-kit/lib/codegen";
import { toTrainSpec, validateKitTrain, withDefaults, type KitTrain } from "../../tools/train-kit/lib/implSpec";

/** Train Kit: the pure parts on SYNTHETIC data (no catalog value is pinned here; the real files are covered by codegen.anchors.test.ts). */
const SHIPPED = { recipeIds: ["margherita"], ingredients: [{ id: "tomato-sauce", category: "sauce", emoji: "T" }, { id: "mozzarella", category: "cheese", emoji: "M" }, { id: "basil", category: "topping", emoji: "B" }], familySymbols: ["F"] };
const kit = (): KitTrain => withDefaults({
  train: "T99", tag: "t99", label: "Train 99", issue: 780,
  newIngredients: [
    { id: "yuzu", nameJa: "ゆず", category: "topping", family: "fruit", color: "#f2d24a", emoji: "\u{1F34B}", sizeClass: "s", pieceVisual: "yuzu-slices", glyphHost: "StagedGlyph" },
    { id: "ponzu", nameJa: "ポン酢", category: "sauce", family: null, color: "#3c1a0a", emoji: "P" },
  ],
  recipes: [
    { id: "yuzu-pizza", nameJa: "ゆずピザ", description: "ゆずの一枚。", placement: "late", requiredIngredients: [{ ingredientId: "ponzu", minCount: 1 }, { ingredientId: "mozzarella", minCount: 2 }, { ingredientId: "yuzu", minCount: 2, applicationPhase: "POST_BAKE" }], evidenceId: "yuzu-pizza-x", order: { requestedBy: "mito", lineJa: "ゆず！" }, sauceProfile: { ingredientId: "ponzu", interaction: "PAINT" }, ladderStep: { ingredientIds: ["ponzu", "yuzu"] } },
  ],
});
const broken = (patch: (k: any) => void): string[] => {
  const k = JSON.parse(JSON.stringify(kit()));
  patch(k);
  return validateKitTrain(k, SHIPPED);
};

describe("implementation spec", () => {
  it("fills the conventional values and accepts a complete spec", () => {
    const k = kit();
    expect(k.recipes[0]).toMatchObject({ bakeTarget: { start: 58, end: 78 }, baseRewardPitz: 100, lunchRush: false, ladderCredit: true });
    expect(validateKitTrain(k, SHIPPED)).toEqual([]);
    expect(toTrainSpec(k).newIngredients.map((i) => [i.id, i.family])).toEqual([["yuzu", "fruit"], ["ponzu", null]]);
  });

  it("rejects what a known gate would reject, before any file is edited", () => {
    expect(broken((k) => (k.newIngredients[0].family = "other")).join()).toContain("not a reachable family");
    expect(broken((k) => (k.newIngredients[0].emoji = "B")).join()).toContain("already used by basil");
    expect(broken((k) => (k.newIngredients[0].emoji = "F")).join()).toContain("family symbol");
    expect(broken((k) => (k.recipes[0].sauceProfile = null)).join()).toContain("NO_SAUCE");
    expect(broken((k) => { k.recipes[0].sauceProfile = null; k.recipes[0].requiredIngredients = [{ ingredientId: "yuzu", minCount: 1, applicationPhase: "POST_BAKE" }]; k.recipes[0].ladderStep = { ingredientIds: ["yuzu"] }; }).join()).toContain("G7");
    expect(broken((k) => (k.recipes[0].placement = "ordinary")).join()).toContain("late catalog");
    expect(broken((k) => (k.recipes[0].requiredIngredients[1] = { ingredientId: "mozzarella", minCount: 2, applicationPhase: "POST_BAKE" })).join()).toContain("FINISH places toppings only");
    expect(broken((k) => (k.recipes[0].ladderStep = null)).join()).toContain("exactly one ladder step");
    expect(broken((k) => (k.recipes[0].id = "margherita")).join()).toContain("already shipped");
    expect(broken((k) => (k.recipes[0].order.lineJa = "")).join()).toContain("order line");
    expect(broken((k) => (k.tag = "T-99")).join()).toContain("tag");
    expect(broken((k) => delete k.newIngredients[0].glyphHost).join()).toContain("go together");
    expect(broken((k) => (k.label = "x */ injected")).join()).toContain("escape a generated comment");
    expect(broken((k) => (k.train = "a\nb")).join()).toContain("escape a generated comment");
    expect(broken((k) => (k.label = "a\u2028b")).join()).toContain("escape a generated comment");
    expect(broken((k) => (k.recipes[0].baseRewardPitz = "100")).join()).toContain("baseRewardPitz");
    expect(broken((k) => (k.recipes[0].bakeTarget = { start: "58", end: 78 })).join()).toContain("bakeTarget");
    expect(broken((k) => (k.recipes[0].sauceProfile.interaction = "DRIZZLE")).join()).toContain("PAINT or PAINT_TEMPORARY");
    expect(broken((k) => (k.recipes[0].lunchRush = "no")).join()).toContain("booleans");
  });
});

describe("renderers", () => {
  it("write the catalog's own shapes", () => {
    const k = kit();
    expect(emojiLiteral("\u{1F34B}")).toBe('"\\u{1F34B}"');
    expect(key("apple")).toBe("apple");
    expect(key("red-cabbage")).toBe('"red-cabbage"');
    expect(renderIngredient(k.newIngredients[0])).toBe('  { id: "yuzu", category: "topping", nameJa: "ゆず", color: "#f2d24a", emoji: "\\u{1F34B}", pieceVisual: "yuzu-slices", placement: "scatter", unlockCondition: { minTotalStars: 0 } },');
    expect(renderIngredient(k.newIngredients[1])).toContain('placement: "spread"');
    const text = renderRecipe(k.recipes[0]);
    expect(text).toContain('{ ingredientId: "yuzu", minCount: 2, applicationPhase: "POST_BAKE" },');
    expect(text).toContain("lunchRush: false,");
    expect(text).not.toContain("ladderCredit");
  });
});

describe("text primitives fail closed", () => {
  const file = "const A = [\n  1,\n\n];\nconst B = [\n  2,\n];\nexport const ROW = [[1, 2]] as const;\n// tail\n";
  it("insert at the named anchor only", () => {
    expect(insertBeforeClose(file, "const A = [", "];", "  9,")).toContain("  1,\n  9,\n\n];\nconst B");
    expect(insertBeforeLine(file, "const B = [", "// x")).toContain("];\n// x\nconst B = [");
    expect(insertAfterLine(file, "const B = [", "  0,")).toContain("const B = [\n  0,\n  2,");
    expect(appendInline(file, "export const ROW = [", "] as const;", "[3, 4]")).toContain("export const ROW = [[1, 2], [3, 4]] as const;\n// tail");
    expect(appendInline("x\nexport const O = { a: 1 };\n", "export const O = {", " };", "b: 2")).toContain("export const O = { a: 1, b: 2 };");
  });
  it("throw on a missing or ambiguous anchor instead of guessing", () => {
    expect(() => insertBeforeClose(file, "const C = [", "];", "x")).toThrow(AnchorError);
    // A's own closer is gone: the next declaration's `];` must not be borrowed.
    expect(() => insertBeforeClose("const A = [\n  1,\n] as const;\nconst B = [\n  2,\n];\n", "const A = [", "];", "  9,")).toThrow(AnchorError);
    expect(() => insertBeforeLine(`${file}const B = [\n`, "const B = [", "x")).toThrow(/ambiguous/);
    expect(() => appendInline(file, "export const ROW = [", "];", "x")).toThrow(AnchorError);
    expect(() => fillTemplate("a __X__ b", { Y: "1" })).toThrow(/no placeholder Y/);
    expect(() => fillTemplate("a __X__ __Z__", { X: "1" })).toThrow(/not filled: __Z__/);
    expect(fillTemplate("a __X__ /*__X__*/", { X: "1" })).toBe("a 1 1");
  });
});

describe("HV wiring", () => {
  const hv = ['import { applyB1HvSeed, parseB1HvParam, type B1HvScenarioId } from "./b1HvSeeds";', "", "export type HvScenarioId =", '  | "normal";', "export function applyPreviewHvSeed(", "  search: unknown,", "): HvScenarioId | B1HvScenarioId | null {", "  const id = parseHvParam(search);", "  const b1Id = id ? null : parseB1HvParam(search); // B1", "  if ((!id && !b1Id) || !storage || !shouldApplyHvSeed(navigationType)) return null;", "  if (id) return applyHvSeed(id, storage) ? id : null;", "  return b1Id && applyB1HvSeed(b1Id, storage) ? b1Id : null;", "}", ""].join("\n");
  it("chains the new train after every earlier id and keeps them unchanged", () => {
    const out = wireHvSeeds(hv, kit());
    expect(out).toContain('import { applyT99HvSeed, parseT99HvParam, type T99HvScenarioId } from "./t99HvSeeds";');
    expect(out).toContain("): HvScenarioId | B1HvScenarioId | T99HvScenarioId | null {");
    expect(out).toContain("  const t99Id = id || b1Id ? null : parseT99HvParam(search);");
    expect(out).toContain("if ((!id && !b1Id && !t99Id) || !storage");
    expect(out).toContain("  if (b1Id) return applyB1HvSeed(b1Id, storage) ? b1Id : null;\n  return t99Id && applyT99HvSeed(t99Id, storage) ? t99Id : null;");
    expect(() => wireHvSeeds(out, kit())).toThrow(/already wires/);
    const twice = wireHvSeeds(out, { ...kit(), tag: "t100" });
    expect(twice).toContain("  const t100Id = id || b1Id || t99Id ? null : parseT100HvParam(search);");
  });
  it("adds the ids and labels to the Preview isolation gate", () => {
    const gate = ['import { B1_HV_SCENARIOS } from "./b1HvSeeds";', "const FORBIDDEN = [", "  ...B1_HV_SCENARIOS.map((s) => s.id),", "  ...B1_HV_SCENARIOS.map((s) => s.labelJa),", "];", ""].join("\n");
    const out = wirePreviewGate(gate, kit());
    expect(out).toContain('import { B1_HV_SCENARIOS } from "./b1HvSeeds";\nimport { T99_HV_SCENARIOS } from "./t99HvSeeds";');
    expect(out).toContain("  ...T99_HV_SCENARIOS.map((s) => s.id),\n  ...T99_HV_SCENARIOS.map((s) => s.labelJa),\n];");
  });
});
