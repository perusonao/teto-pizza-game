import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Content Train preflight RUNNER (Issue #780; tool, not a gate). Skipped unless `TETO_TRAIN_SPEC` names a train spec JSON:
 *
 *   node tools/content-train/preflight.mjs <spec.json> --out <dir>
 *
 * It appends the spec's ingredients to the shipped catalog IN THIS TEST PROCESS ONLY (module mocks, the same technique as the
 * staged what-if tests) and measures the spec with the real authorities, before any HOT catalog file is edited. No shipped
 * file changes; nothing here is pinned to a catalog value, so a landing train never has to update this file.
 */
const SPEC_PATH = process.env.TETO_TRAIN_SPEC ?? "";
const OUT_DIR = process.env.TETO_TRAIN_OUT ?? "";

vi.mock("../data/ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredients")>();
  const path = process.env.TETO_TRAIN_SPEC;
  if (!path) return actual;
  const { readFileSync: read } = await import("node:fs");
  const spec = JSON.parse(read(path, "utf8")) as import("./trainSpec").TrainSpec;
  const shipped = new Set(actual.INGREDIENTS.map((i) => i.id));
  // Placeholder colour / emoji / price are inert in these measurements; `unlockCondition` makes the material finite (ladder-gated).
  const extra = spec.newIngredients.filter((i) => !shipped.has(i.id)).map((i) => ({
    id: i.id, category: i.category, nameJa: i.nameJa, color: "#999999", emoji: `train:${i.id}`, placement: i.category === "sauce" ? "spread" : "scatter",
    unlockCondition: { minTotalStars: 0 }, pricePitz: 100, restockQuantity: 5,
  }));
  const all = [...actual.INGREDIENTS, ...extra] as typeof actual.INGREDIENTS;
  return { ...actual, INGREDIENTS: all, getIngredient: (id: string) => all.find((i) => i.id === id) };
});
vi.mock("../data/ingredientTaxonomy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredientTaxonomy")>();
  const path = process.env.TETO_TRAIN_SPEC;
  if (!path) return actual;
  const { readFileSync: read } = await import("node:fs");
  const spec = JSON.parse(read(path, "utf8")) as import("./trainSpec").TrainSpec;
  const family = new Map(spec.newIngredients.map((i) => [i.id, i.family]));
  return { ...actual, ingredientAttributeFamily: (id: unknown) => actual.ingredientAttributeFamily(id) ?? (typeof id === "string" ? (family.get(id) ?? null) : null) };
});

import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { ingredientAttributeFamily } from "../data/ingredientTaxonomy";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPE_HINT_ROLES } from "../data/recipeHintRoles";
import { RECIPES } from "../data/recipes";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { researchLetterChangesAcrossOrders } from "../logic/catalog/testSupport/researchLabelAudit";
import { buildHint5Ladder } from "../logic/discovery/hint5Ladder";
import { researchCohortLetters } from "../logic/discovery/researchEntry";
import {
  changeWithinImpact, distinctIds, duplicateFinding, duplicateHits, packChanges, renderPacketMarkdown, researchImpact, structuralFindings, validateTrainSpec, verdictOf,
  type Finding, type PreflightPacket, type TrainRecipe, type TrainSpec,
} from "./trainSpec";

const NOT_COVERED = [
  "Hint 5.0 alphaFamilyOnly report deltas (a report, not a gate; measured after the families are in the real taxonomy)",
  "legacy DH4-2A re-measured counts and other measured-value follow-ups (deductionHint audits)",
  "ladder step numbers and the frozen-step range (REC-04 tie-breaks are applied when the steps are authored)",
  "Reference Truth piece layout, emoji uniqueness (G18), names fitting the UI, icons, E2E and iPhone HV",
];

describe.skipIf(!SPEC_PATH)("content train preflight (tool run)", () => {
  it("measures the spec against the shipped catalog and writes the Owner packet", async () => {
    const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as TrainSpec;
    // The REAL catalog's ingredient ids, read before this process appended the spec's ingredients. A spec that still lists an ingredient a
    // landed train already shipped is STALE and must be rejected by `validateTrainSpec` ("already shipped"); filtering the spec's own ids out of
    // this list (as an earlier version did) hid exactly that and treated the shipped ingredient as a new ladder key material (Codex P2 on #816).
    const { INGREDIENTS: REAL_INGREDIENTS } = await vi.importActual<typeof import("../data/ingredients")>("../data/ingredients");
    const shippedIngredientIds = REAL_INGREDIENTS.map((i) => i.id);
    expect(validateTrainSpec(spec, { recipeIds: RECIPES.map((r) => r.id), ingredientIds: shippedIngredientIds }), "spec problems").toEqual([]);

    const fresh = new Set(spec.newIngredients.map((i) => i.id));
    const categoryOf = (id: string) => getIngredient(id)?.category ?? null;
    const whatIf = spec.recipes.map((r) => ({ id: r.id, nameJa: r.nameJa, description: "", requiredIngredients: r.requiredIngredients, bakeTarget: { start: 58, end: 78 }, baseRewardPitz: 100 }));
    const all = [...RECIPES, ...whatIf] as never as typeof RECIPES;
    const roles = { ...RECIPE_HINT_ROLES, ...Object.fromEntries(spec.recipes.map((r) => [r.id, { keyFree: true }])) } as never;
    const isFinite = (id: string) => !!getIngredient(id)?.unlockCondition;

    // Hint 5.0: the shipped ladders of the committed golden must not move when the train is appended.
    const trainFindings: Finding[] = [];
    const golden = JSON.parse(readFileSync(join(__dirname, "..", "logic", "discovery", "__golden__", "hint5.ladders55.json"), "utf8")) as { id: string; rungs: unknown[][] }[];
    const moved = golden.filter((g) => {
      const ladder = buildHint5Ladder(g.id, all, roles);
      return JSON.stringify(ladder ? ladder.rungs.map((r) => [r.index, r.kind, r.ordinal, ...r.subjectIds]) : null) !== JSON.stringify(g.rungs);
    }).map((g) => g.id);
    if (moved.length > 0) trainFindings.push({ gate: "HINT5_GOLDEN_STABLE", severity: "STOP", recipeId: null, message: `shipped Hint 5.0 ladders change: ${moved.join(", ")}` });

    // Research, canonical order: starters, the ordinary ladder, the train's ordinary materials, the late ladder, the train's late materials.
    const ordinary = ordinaryLadderSteps(DISCOVERY_LADDER.steps);
    const late = DISCOVERY_LADDER.steps.filter((s) => !ordinary.includes(s));
    const mats = (steps: readonly { readonly ingredientIds: readonly string[] }[]) => steps.flatMap((s) => s.ingredientIds as readonly string[]);
    // A recipe that needs a material of the late ladder can only be completed after it: it is measured as a late recipe whatever the spec says.
    const lateMaterials = new Set(mats(late));
    const usesLateMaterial = (r: TrainRecipe) => r.requiredIngredients.some((q) => lateMaterials.has(q.ingredientId));
    const effectivePlacement = (r: TrainRecipe): TrainRecipe["placement"] => (r.placement === "late" || usesLateMaterial(r) ? "late" : "ordinary");
    const newMats = (placement: TrainRecipe["placement"], recipes: readonly TrainRecipe[]) => [...new Set(recipes.filter((r) => effectivePlacement(r) === placement).flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId).filter((id) => fresh.has(id))))];
    const canonicalChanges = (recipes: readonly TrainRecipe[]) => {
      const order = [...STARTER_INGREDIENT_IDS, ...mats(ordinary), ...newMats("ordinary", recipes), ...mats(late), ...newMats("late", recipes)];
      const withNew = [...RECIPES, ...whatIf.filter((w) => recipes.some((r) => r.id === w.id))] as never as typeof RECIPES;
      const out = new Map<string, Set<string>>();
      for (let n = STARTER_INGREDIENT_IDS.length; n <= order.length; n += 1) {
        const owned = order.slice(0, n);
        const before = researchCohortLetters(owned, RECIPES);
        const after = researchCohortLetters(owned, withNew);
        for (const r of RECIPES) if (before.get(r.id) !== after.get(r.id)) out.set(r.id, (out.get(r.id) ?? new Set()).add(`${before.get(r.id) ?? "-"}->${after.get(r.id) ?? "-"}`));
      }
      return out;
    };
    const canonicalAll = canonicalChanges(spec.recipes);
    const canonicalAlone = new Map(spec.recipes.map((r) => [r.id, canonicalChanges([r])]));
    const canonical = [...canonicalAll].map(([recipeId, changes]) => ({ recipeId, changes: [...changes].sort(), causedBy: spec.recipes.filter((r) => canonicalAlone.get(r.id)!.has(recipeId)).map((r) => r.id) })).sort((a, b) => (a.recipeId < b.recipeId ? -1 : 1));

    // Research, non-canonical orders: the deterministic bound; the id order is read from the real authority on the two-recipe catalog.
    const sortsFirst = (newId: string, shippedId: string) => {
      const pair = [RECIPES.find((r) => r.id === shippedId)!, whatIf.find((r) => r.id === newId)!] as never as typeof RECIPES;
      const shared = distinctIds(pair[0]).filter((m) => isFinite(m) && distinctIds(pair[1]).includes(m))[0];
      const others = [...new Set([...distinctIds(pair[0]), ...distinctIds(pair[1])])].filter((m) => isFinite(m) && m !== shared);
      return researchCohortLetters([...STARTER_INGREDIENT_IDS, ...others, shared], pair).get(shippedId) === "B";
    };
    const nonCanonical = researchImpact(whatIf, RECIPES, isFinite, sortsFirst);
    // Cross-check: every change the sampled audit (the one the batch tests pin) measures must be inside the bound.
    const byId = new Map(nonCanonical.map((r) => [r.recipeId, r]));
    const ruleViolations: string[] = [];
    for (const [id, list] of researchLetterChangesAcrossOrders(spec.recipes.map((r) => r.id), all as never, 8)) for (const c of list) if (!c.canonical && !changeWithinImpact(c.change, byId.get(id))) ruleViolations.push(`${id} ${c.change} (${c.example})`);

    const recipes = spec.recipes.map((r) => {
      const findings = structuralFindings(r, categoryOf, (id) => ingredientAttributeFamily(id), (id) => fresh.has(id));
      if (r.placement === "ordinary" && usesLateMaterial(r)) findings.push({ gate: "LATE_PLACEMENT", severity: "OWNER", recipeId: r.id, message: `needs late-ladder material(s) ${r.requiredIngredients.map((q) => q.ingredientId).filter((id) => lateMaterials.has(id)).join(", ")}: it can only be a late-catalog recipe (measured as late)` });
      const duplicates = duplicateHits(r, RECIPES, spec.recipes);
      for (const d of duplicates) findings.push(duplicateFinding(r.id, d));
      const ladder = buildHint5Ladder(r.id, all, roles);
      const rungs = ladder ? ladder.rungs.map((g) => g.kind) : null;
      if (!rungs) findings.push({ gate: "HINT5_T-COV", severity: "STOP", recipeId: r.id, message: "not a key-free Hint 5.0 target (a topping has no family, or the roles are invalid)" });
      const hasSauce = r.requiredIngredients.some((q) => categoryOf(q.ingredientId) === "sauce");
      if (rungs && !hasSauce && rungs[0] !== "CHEESE" && !findings.some((f) => f.gate === "TQ1D_G7_CHEESE_FIRST")) findings.push({ gate: "TQ1D_G7_CHEESE_FIRST", severity: "STOP", recipeId: r.id, message: `NO_SAUCE recipe whose first rung is ${rungs[0]} (G7 requires CHEESE)` });
      const own = canonicalAlone.get(r.id)!;
      if (own.size > 0) findings.push({ gate: "RESEARCH_CANONICAL", severity: "STOP", recipeId: r.id, message: `changes the letter of ${own.size} shipped recipe(s) in the canonical ladder order (D-6: per-ID Owner approval before promotion): ${[...own.keys()].sort().join(", ")}` });
      const affected = nonCanonical.filter((row) => row.causes.some((c) => c.newRecipeId === r.id)).length;
      if (affected > 0) findings.push({ gate: "RESEARCH_NON_CANONICAL", severity: "OWNER", recipeId: r.id, message: `${affected} shipped recipe(s) can be re-lettered in non-canonical orders (section 4; never saved, display only)` });
      return { id: r.id, nameJa: r.nameJa, placement: effectivePlacement(r), verdict: verdictOf(findings), newMaterials: r.requiredIngredients.map((q) => q.ingredientId).filter((id) => fresh.has(id)), hintRungs: rungs ? rungs.join(",") : null, duplicates, findings };
    });
    const packs = packChanges(shippedIngredientIds, RECIPES, spec.recipes);
    for (const c of packs) trainFindings.push({ gate: "SHOP_PACK", severity: "OWNER", recipeId: null, message: `${c.ingredientId}: pack ${c.before * 10} -> ${c.after * 10}, price unchanged (raised by ${c.raisedBy.join(", ")})` });
    if (ruleViolations.length > 0) trainFindings.push({ gate: "RESEARCH_RULE_CROSSCHECK", severity: "STOP", recipeId: null, message: `the sampled audit measured ${ruleViolations.length} change(s) outside the deterministic bound: the rule in trainSpec.ts is wrong for this catalog` });

    const packet: PreflightPacket = {
      train: spec.train,
      measuredOn: { recipes: RECIPES.length, ingredients: shippedIngredientIds.length, ladderSteps: DISCOVERY_LADDER.steps.length },
      recipes, trainFindings, research: { canonical, nonCanonical, ruleViolations }, packChanges: packs, notCovered: NOT_COVERED,
    };
    expect(OUT_DIR, "TETO_TRAIN_OUT").not.toBe("");
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, `${spec.train}.preflight.json`), `${JSON.stringify(packet, null, 1)}\n`);
    writeFileSync(join(OUT_DIR, `${spec.train}.preflight.md`), renderPacketMarkdown(packet));
    // The run fails only when the tool itself is unsound; STOP / OWNER findings are the output, read from the packet.
    expect(ruleViolations).toEqual([]);
  }, 600_000);
});
