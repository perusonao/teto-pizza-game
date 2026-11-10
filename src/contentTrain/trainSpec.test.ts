import { describe, expect, it } from "vitest";
import {
  changeWithinImpact, compareSets, duplicateHits, packChanges, renderPacketMarkdown, researchImpact, structuralFindings, validateTrainSpec, verdictOf,
  type PreflightPacket, type TrainRecipe, type TrainSpec,
} from "./trainSpec";

/**
 * Content Train preflight rules on SYNTHETIC data only (Issue #780). Nothing here reads the shipped or the staged catalog, so a
 * landing train never has to touch this file. The run against the real catalog is `trainPreflight.run.test.ts` (tool, opt-in).
 */
const CATEGORY: Record<string, "sauce" | "cheese" | "topping"> = { tomato: "sauce", honey: "sauce", mozz: "cheese", ham: "topping", nut: "topping", choc: "topping", fig: "topping" };
const FAMILY: Record<string, string> = { ham: "meat", nut: "spice", choc: "other", fig: "fruit" };
const categoryOf = (id: string) => CATEGORY[id] ?? null;
const familyOf = (id: string) => FAMILY[id] ?? null;
const recipe = (id: string, ids: readonly string[], extra: Partial<TrainRecipe> = {}): TrainRecipe => ({ id, nameJa: id, placement: "ordinary", requiredIngredients: ids.map((ingredientId) => ({ ingredientId, minCount: 2 })), ...extra });
const gates = (r: TrainRecipe, fresh: readonly string[] = ["fig"]) => structuralFindings(r, categoryOf, familyOf, (id) => fresh.includes(id)).map((f) => `${f.severity}:${f.gate}`);

describe("validateTrainSpec", () => {
  const shipped = { recipeIds: ["margherita"], ingredientIds: ["tomato", "mozz", "ham"] };
  const spec = (over: Partial<TrainSpec>): TrainSpec => ({ train: "T", recipes: [recipe("fig-ham", ["tomato", "mozz", "ham", "fig"])], newIngredients: [{ id: "fig", nameJa: "fig", category: "topping", family: "fruit" }], ...over });
  it("accepts a consistent spec", () => {
    expect(validateTrainSpec(spec({}), shipped)).toEqual([]);
  });
  it("rejects shipped ids, unknown ingredients, a topping without a family and an ingredient no recipe uses", () => {
    expect(validateTrainSpec(spec({ recipes: [recipe("margherita", ["tomato", "fig"])] }), shipped)).toContain("train recipe is already shipped: margherita");
    expect(validateTrainSpec(spec({ recipes: [recipe("x", ["tomato", "fig", "kiwi"])] }), shipped)).toContain("unknown ingredient kiwi in x");
    expect(validateTrainSpec(spec({ newIngredients: [{ id: "fig", nameJa: "fig", category: "topping", family: null }] }), shipped).join()).toMatch(/family of fig/);
    expect(validateTrainSpec(spec({ newIngredients: [{ id: "ham", nameJa: "ham", category: "topping", family: "meat" }] }), shipped)).toContain("new ingredient is already shipped: ham");
    expect(validateTrainSpec(spec({ recipes: [recipe("x", ["tomato", "ham"])] }), shipped).join()).toMatch(/fig is used by no train recipe/);
  });
});

describe("Duplicate Gate comparison (the staged gate's rule)", () => {
  it("classifies identical / subset / superset / one-diff / Jaccard", () => {
    expect(compareSets(["a", "b"], ["b", "a"]).kind).toBe("IDENTICAL");
    expect(compareSets(["a"], ["a", "b"]).kind).toBe("SUBSET");
    expect(compareSets(["a", "b", "c"], ["a", "b"]).kind).toBe("SUPERSET");
    expect(compareSets(["a", "b", "c"], ["a", "b", "d"]).kind).toBe("ONE_DIFF");
    expect(compareSets(["a", "b", "c", "d"], ["a", "b", "c", "e", "f"])).toEqual({ kind: "JACCARD_GT_0_4", jaccard: 0.5 });
    expect(compareSets(["a", "b", "c"], ["a", "d", "e"])).toEqual({ kind: null, jaccard: 0.2 });
  });
  it("reports hits against the shipped catalog and inside the train, never against itself", () => {
    const n = recipe("n", ["a", "b", "c"]);
    expect(duplicateHits(n, [recipe("s", ["a", "b"])], [n, recipe("m", ["a", "b", "d"])])).toEqual([
      { against: "m", againstTrain: true, kind: "ONE_DIFF", jaccard: 0.5 },
      { against: "s", againstTrain: false, kind: "SUPERSET", jaccard: 0.667 },
    ]);
  });
});

describe("Research impact: the deterministic bound", () => {
  const finite = (id: string) => id !== "tomato";
  const shipped = [recipe("r-ham", ["tomato", "ham"]), recipe("r-nut", ["tomato", "nut", "mozz"]), recipe("r-plain", ["tomato"])];
  it("only shipped recipes that share a FINITE material are affected; a starter in common is not a cause", () => {
    const rows = researchImpact([recipe("n", ["tomato", "ham", "fig"])], shipped, finite, () => false);
    expect(rows).toEqual([{ recipeId: "r-ham", kind: "NEW_LABEL_ONLY", maxShift: 0, byMaterial: [{ material: "ham", shift: 0 }], causes: [{ newRecipeId: "n", materials: ["ham"], newSortsFirst: false }] }]);
  });
  it("a new recipe that sorts first shifts by one; k of them on ONE material shift by k, on different materials by one", () => {
    const first = () => true;
    expect(researchImpact([recipe("n1", ["ham"])], shipped, finite, first)[0]).toMatchObject({ recipeId: "r-ham", kind: "SHIFT", maxShift: 1 });
    expect(researchImpact([recipe("n1", ["ham"]), recipe("n2", ["ham", "fig"])], shipped, finite, first)[0].maxShift).toBe(2);
    expect(researchImpact([recipe("n1", ["nut"]), recipe("n2", ["mozz"])], shipped, finite, first)[0]).toMatchObject({ recipeId: "r-nut", maxShift: 1, byMaterial: [{ material: "mozz", shift: 1 }, { material: "nut", shift: 1 }] });
  });
  it("is additive: the rows of a train are the union of the rows of its recipes taken alone (a split needs no new approval)", () => {
    const train = [recipe("n1", ["ham", "fig"]), recipe("n2", ["nut"])];
    const sorts = (n: string) => n === "n1";
    const together = researchImpact(train, shipped, finite, sorts).map((r) => r.recipeId);
    const alone = train.flatMap((n) => researchImpact([n], shipped, finite, sorts).map((r) => r.recipeId));
    expect(together).toEqual([...new Set(alone)].sort());
  });
  it("changeWithinImpact: a first letter up to the shift, a move of 1..shift letters later; anything else is outside", () => {
    const row = (maxShift: number) => ({ recipeId: "r", kind: maxShift ? "SHIFT" : "NEW_LABEL_ONLY", maxShift, causes: [] }) as never;
    expect(changeWithinImpact("-->A", row(0))).toBe(true);
    expect(changeWithinImpact("-->B", row(0))).toBe(false);
    expect(changeWithinImpact("A->B", row(0))).toBe(false);
    expect(changeWithinImpact("-->B", row(1))).toBe(true);
    expect(changeWithinImpact("C->D", row(1))).toBe(true);
    expect(changeWithinImpact("C->E", row(1))).toBe(false);
    expect(changeWithinImpact("C->E", row(2))).toBe(true);
    expect(changeWithinImpact("B->A", row(2))).toBe(false);
    expect(changeWithinImpact("A->-", row(2))).toBe(false);
    expect(changeWithinImpact("Z->AA", row(1))).toBe(true);
    expect(changeWithinImpact("-->A", undefined)).toBe(false);
  });
});

describe("structural findings: the gate collisions of earlier batches, predicted from the spec", () => {
  it("a clean recipe has no finding", () => {
    expect(gates(recipe("ok", ["tomato", "mozz", "ham", "fig"]))).toEqual([]);
  });
  it("B23-b: a topping in the unreachable family `other`, and a NO_SAUCE recipe without a cheese", () => {
    expect(gates(recipe("dessert", ["choc", "fig"]), ["choc", "fig"])).toEqual(["STOP:DH4_OTHER_UNREACHABLE", "OWNER:NO_SAUCE_DECISION", "STOP:TQ1D_G7_CHEESE_FIRST", "INFO:LADDER_KEY_MATERIAL"]);
    // A SHIPPED topping of that family (egg, almond, pine-nuts today) is only a risk to re-run the gate for, not a predicted failure.
    expect(gates(recipe("eggy", ["tomato", "mozz", "choc", "fig"]))).toEqual(["INFO:DH4_OTHER_RISK"]);
    expect(gates(recipe("dessert", ["mozz", "nut", "fig"]))).toEqual(["OWNER:NO_SAUCE_DECISION"]);
  });
  it("a waiting mechanic, a post-bake sauce (M7), a late / ordinary mismatch, no key material, a topping without a family", () => {
    expect(gates(recipe("m", ["tomato", "mozz", "fig"], { mechanics: ["PREP"] }))).toEqual(["STOP:MECHANIC"]);
    const hotHoney: TrainRecipe = { ...recipe("h", ["tomato", "mozz", "fig"]), placement: "late", requiredIngredients: [{ ingredientId: "tomato", minCount: 1 }, { ingredientId: "fig", minCount: 2 }, { ingredientId: "honey", minCount: 1, applicationPhase: "POST_BAKE" }] };
    expect(gates(hotHoney)).toEqual(["STOP:M7_POSTBAKE_SAUCE"]);
    expect(gates(recipe("l", ["tomato", "mozz", "fig"], { placement: "late" }))).toEqual(["OWNER:LATE_PLACEMENT"]);
    expect(gates(recipe("k", ["tomato", "mozz", "ham"]))).toEqual(["OWNER:LADDER_KEY_MATERIAL"]);
    expect(gates(recipe("two", ["tomato", "mozz", "ham", "fig"]), ["ham", "fig"])).toEqual(["INFO:LADDER_KEY_MATERIAL"]);
    CATEGORY.nofam = "topping";
    expect(gates(recipe("f", ["tomato", "mozz", "fig", "nofam"]))).toEqual(["STOP:HINT5_T-COV"]);
    delete CATEGORY.nofam;
  });
});

describe("pack changes, verdicts and the packet", () => {
  it("a train that raises the largest minCount of a shipped material changes its pack; a new material never does", () => {
    const shippedRecipes = [{ requiredIngredients: [{ ingredientId: "mozz", minCount: 2 }, { ingredientId: "ham", minCount: 2 }] }];
    const train = [{ ...recipe("n", []), requiredIngredients: [{ ingredientId: "mozz", minCount: 3 }, { ingredientId: "ham", minCount: 2 }, { ingredientId: "fig", minCount: 5 }] }];
    expect(packChanges(["mozz", "ham", "unused"], shippedRecipes, train)).toEqual([{ ingredientId: "mozz", before: 2, after: 3, raisedBy: ["n"] }]);
  });
  it("verdict: STOP wins over OWNER, INFO alone is READY", () => {
    const f = (severity: "STOP" | "OWNER" | "INFO") => ({ gate: "G", severity, recipeId: "r", message: "" });
    expect(verdictOf([])).toBe("READY");
    expect(verdictOf([f("INFO")])).toBe("READY");
    expect(verdictOf([f("INFO"), f("OWNER")])).toBe("NEEDS_OWNER");
    expect(verdictOf([f("OWNER"), f("STOP")])).toBe("BLOCKED");
  });
  it("the packet lists each STOP and each Owner decision once and keeps table cells intact", () => {
    const packet: PreflightPacket = {
      train: "T", measuredOn: { recipes: 1, ingredients: 2, ladderSteps: 3 },
      recipes: [{ id: "n", nameJa: "n", placement: "ordinary", verdict: "BLOCKED", newMaterials: ["fig"], hintRungs: "SAUCE,CHEESE", duplicates: [], findings: [{ gate: "X|Y", severity: "STOP", recipeId: "n", message: "stop here" }, { gate: "OWN", severity: "OWNER", recipeId: "n", message: "decide" }] }],
      trainFindings: [], research: { canonical: [], nonCanonical: [{ recipeId: "r", kind: "SHIFT", maxShift: 1, byMaterial: [{ material: "ham", shift: 1 }], causes: [{ newRecipeId: "n", materials: ["ham"], newSortsFirst: true }] }], ruleViolations: [] },
      packChanges: [{ ingredientId: "mozz", before: 2, after: 3, raisedBy: ["n"] }], notCovered: ["icons"],
    };
    const md = renderPacketMarkdown(packet);
    expect(md).toContain("READY 0 / NEEDS_OWNER 0 / BLOCKED 1");
    expect(md).toContain("[STOP] X/Y");
    expect(md.match(/stop here/g)).toHaveLength(1);
    expect(md.match(/decide/g)).toHaveLength(1);
    expect(md).toContain("| `r` | ham: later by at most 1 | (none)→A..B; X→X+1 | n |");
    expect(md).toContain("Nothing outside this table is approved");
    expect(md).toContain("`mozz`: pack 20 → 30");
    expect(md).toContain("0 violations");
  });
});
