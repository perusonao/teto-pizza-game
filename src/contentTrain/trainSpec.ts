/**
 * Content Train spec + preflight rules (Issue #780; TEST / TOOL SUPPORT ONLY -- never imported by production code).
 *
 * A **train spec** is one self-contained JSON file: the recipes of a release train and the ingredients they add, exactly as the
 * Owner is asked to approve them. `trainPreflight.run.test.ts` measures a spec against the REAL shipped catalog and the real
 * authorities (Research cohort letters, Hint 5.0 ladder, shop pack size) BEFORE any HOT catalog file is edited, and writes one
 * Owner packet. Everything in this file is pure (no catalog import), so it is unit-tested on synthetic data and pins no catalog value.
 *
 * The spec is deliberately NOT read from `src/data/staged/**` here (`stagedIsolation.test.ts`: nothing outside that directory may
 * import it). `tools/content-train/make-spec.mjs` extracts the rows from the staged files as text.
 */

export type TrainPlacement = "ordinary" | "late";

export interface TrainRequirement {
  readonly ingredientId: string;
  readonly minCount: number;
  readonly applicationPhase?: "PRE_BAKE" | "POST_BAKE";
}

export interface TrainRecipe {
  readonly id: string;
  readonly nameJa: string;
  readonly placement: TrainPlacement;
  readonly requiredIngredients: readonly TrainRequirement[];
  /** Mechanic keys the recipe waits for (staged `mechanics`); a non-empty list blocks a catalog-only train. */
  readonly mechanics?: readonly string[];
  /** Open Owner items carried over from the staged ledger (informational; shown in the packet). */
  readonly ownerReasons?: readonly string[];
}

export interface TrainIngredient {
  readonly id: string;
  readonly nameJa: string;
  readonly category: "sauce" | "cheese" | "topping";
  /** Hint 5.0 family of a topping; `null` for sauce / cheese. */
  readonly family: string | null;
}

export interface TrainSpec {
  readonly train: string;
  readonly recipes: readonly TrainRecipe[];
  readonly newIngredients: readonly TrainIngredient[];
}

/** STOP = a known gate would fail or a stop condition is hit; OWNER = needs one Owner decision; INFO = recorded only. */
export type Severity = "STOP" | "OWNER" | "INFO";

export interface Finding {
  readonly gate: string;
  readonly severity: Severity;
  /** The train recipe the finding belongs to, or `null` for a train-level finding. */
  readonly recipeId: string | null;
  readonly message: string;
}

export const TRAIN_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Hint 5.0 families a NEW topping may use. `other` exists in the taxonomy (egg, almond, pine-nuts) but its answer must stay unreachable (DH4-PROD gate, OD-DH4-2-9). */
export const REACHABLE_FAMILIES: readonly string[] = ["meat", "seafood", "vegetable", "herb", "fruit", "spice"];

export const distinctIds = (r: { readonly requiredIngredients: readonly { readonly ingredientId: string }[] }): string[] =>
  [...new Set(r.requiredIngredients.map((q) => q.ingredientId))].sort();

/** Structural problems of a spec against the shipped catalog; empty = usable. */
export function validateTrainSpec(spec: TrainSpec, shipped: { readonly recipeIds: readonly string[]; readonly ingredientIds: readonly string[] }): string[] {
  const problems: string[] = [];
  if (typeof spec.train !== "string" || spec.train.length === 0) problems.push("train name is missing");
  if (!Array.isArray(spec.recipes) || spec.recipes.length === 0) problems.push("spec has no recipe");
  const shippedRecipes = new Set(shipped.recipeIds);
  const shippedIngredients = new Set(shipped.ingredientIds);
  const fresh = new Map((spec.newIngredients ?? []).map((i) => [i.id, i]));
  const seenIngredients = new Set<string>();
  for (const i of spec.newIngredients ?? []) {
    if (!TRAIN_ID_PATTERN.test(i.id)) problems.push(`ingredient id format: ${i.id}`);
    if (seenIngredients.has(i.id)) problems.push(`duplicate new ingredient: ${i.id}`);
    seenIngredients.add(i.id);
    if (shippedIngredients.has(i.id)) problems.push(`new ingredient is already shipped: ${i.id}`);
    if (!["sauce", "cheese", "topping"].includes(i.category)) problems.push(`category of ${i.id}`);
    if ((i.category === "topping") !== (i.family !== null)) problems.push(`family of ${i.id}: a topping needs a family, a sauce / cheese has none`);
  }
  const seenRecipes = new Set<string>();
  const used = new Set<string>();
  for (const r of spec.recipes ?? []) {
    if (!TRAIN_ID_PATTERN.test(r.id)) problems.push(`recipe id format: ${r.id}`);
    if (seenRecipes.has(r.id)) problems.push(`duplicate train recipe: ${r.id}`);
    seenRecipes.add(r.id);
    if (shippedRecipes.has(r.id)) problems.push(`train recipe is already shipped: ${r.id}`);
    if (r.placement !== "ordinary" && r.placement !== "late") problems.push(`placement of ${r.id}`);
    if (r.requiredIngredients.length === 0) problems.push(`recipe without ingredients: ${r.id}`);
    const ids = r.requiredIngredients.map((q) => q.ingredientId);
    if (new Set(ids).size !== ids.length) problems.push(`repeated ingredient in ${r.id}`);
    for (const q of r.requiredIngredients) {
      if (!Number.isInteger(q.minCount) || q.minCount < 1) problems.push(`minCount ${r.id}/${q.ingredientId}`);
      if (!shippedIngredients.has(q.ingredientId) && !fresh.has(q.ingredientId)) problems.push(`unknown ingredient ${q.ingredientId} in ${r.id}`);
      used.add(q.ingredientId);
    }
  }
  for (const id of fresh.keys()) if (!used.has(id)) problems.push(`new ingredient ${id} is used by no train recipe (an ingredient ships with its first recipe, OD-REC04-1)`);
  return problems;
}

export type DuplicateKind = "IDENTICAL" | "SUBSET" | "SUPERSET" | "ONE_DIFF" | "JACCARD_GT_0_4";

export interface DuplicateHit {
  readonly against: string;
  readonly againstTrain: boolean;
  readonly kind: DuplicateKind;
  readonly jaccard: number;
}

/** The Duplicate Gate comparison of two distinct-ingredient-id sets (same rule as the staged gate). */
export function compareSets(a: readonly string[], b: readonly string[]): { kind: DuplicateKind | null; jaccard: number } {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  const jaccard = Math.round((inter / union) * 1000) / 1000;
  const aInB = inter === A.size;
  const bInA = inter === B.size;
  if (aInB && bInA) return { kind: "IDENTICAL", jaccard };
  if (aInB) return { kind: "SUBSET", jaccard };
  if (bInA) return { kind: "SUPERSET", jaccard };
  if (A.size === B.size && A.size - inter === 1) return { kind: "ONE_DIFF", jaccard };
  if (jaccard > 0.4) return { kind: "JACCARD_GT_0_4", jaccard };
  return { kind: null, jaccard };
}

interface IdSet {
  readonly id: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string }[];
}

export function duplicateHits(recipe: IdSet, shipped: readonly IdSet[], train: readonly IdSet[]): DuplicateHit[] {
  const mine = distinctIds(recipe);
  const hits: DuplicateHit[] = [];
  for (const [list, againstTrain] of [[shipped, false], [train, true]] as const) {
    for (const other of list) {
      if (other.id === recipe.id) continue;
      const c = compareSets(mine, distinctIds(other));
      if (c.kind) hits.push({ against: other.id, againstTrain, kind: c.kind, jaccard: c.jaccard });
    }
  }
  return hits.sort((x, y) => (x.against < y.against ? -1 : 1));
}

/**
 * Research cohort letters -- the deterministic impact of adding recipes (no sampling).
 *
 * `researchCohortLetters` groups recipes by their unlock fact (the finite material the player acquired last) and letters a
 * group of two or more by an order that depends only on the recipe id. So a new recipe N can change the letter of a shipped
 * recipe R only in a group both belong to, i.e. only when R and N share a finite material m and m was acquired last. Hence:
 *
 * - the shipped recipes that can change at all are EXACTLY those sharing a finite material with a new recipe;
 * - if N sorts after R, R can only gain a first letter (`-->A`) when it was alone; a lettered R never moves;
 * - if N sorts before R, R moves one letter later (and a lone R gains `B`); k such new recipes on one material move it at most k.
 *
 * The set is additive over the new recipes: splitting or re-ordering a train never adds an ID or widens a shift. That makes
 * "per ID, with its maximum shift" an approval unit that survives a batch split (the B23-a / B23-b re-approval, #814).
 */
export interface ResearchImpactRow {
  readonly recipeId: string;
  /** `NEW_LABEL_ONLY`: at most `-->A`. `SHIFT`: may move up to `maxShift` letters later (a lone recipe gains up to that letter). */
  readonly kind: "NEW_LABEL_ONLY" | "SHIFT";
  readonly maxShift: number;
  readonly causes: readonly { readonly newRecipeId: string; readonly materials: readonly string[]; readonly newSortsFirst: boolean }[];
}

export function researchImpact(
  newRecipes: readonly IdSet[],
  shipped: readonly IdSet[],
  isFinite: (ingredientId: string) => boolean,
  newSortsFirst: (newRecipeId: string, shippedRecipeId: string) => boolean,
): ResearchImpactRow[] {
  const finite = (r: IdSet) => distinctIds(r).filter(isFinite);
  const rows: ResearchImpactRow[] = [];
  for (const r of shipped) {
    const mine = finite(r);
    const causes: { newRecipeId: string; materials: string[]; newSortsFirst: boolean }[] = [];
    for (const n of newRecipes) {
      const materials = finite(n).filter((m) => mine.includes(m));
      if (materials.length > 0) causes.push({ newRecipeId: n.id, materials, newSortsFirst: newSortsFirst(n.id, r.id) });
    }
    if (causes.length === 0) continue;
    let maxShift = 0;
    for (const m of mine) maxShift = Math.max(maxShift, causes.filter((c) => c.newSortsFirst && c.materials.includes(m)).length);
    rows.push({ recipeId: r.id, kind: maxShift > 0 ? "SHIFT" : "NEW_LABEL_ONLY", maxShift, causes });
  }
  return rows.sort((a, b) => (a.recipeId < b.recipeId ? -1 : 1));
}

const letterIndex = (letter: string): number => [...letter].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

/** Whether a measured change (`before->after`, `-` = no letter) is inside what `row` allows. Used to cross-check the rule against the sampled audit. */
export function changeWithinImpact(change: string, row: ResearchImpactRow | undefined): boolean {
  if (!row) return false;
  const [before, after] = change.split("->");
  if (after === "-" || after === undefined) return false;
  if (before === "-") return letterIndex(after) <= row.maxShift;
  const shift = letterIndex(after) - letterIndex(before);
  return shift >= 1 && shift <= row.maxShift;
}

/** Findings that need no measurement: families, sauce / cheese shape, phases, mechanics, key material. */
export function structuralFindings(
  recipe: TrainRecipe,
  categoryOf: (ingredientId: string) => "sauce" | "cheese" | "topping" | null,
  familyOf: (ingredientId: string) => string | null,
  isNewIngredient: (ingredientId: string) => boolean,
): Finding[] {
  const out: Finding[] = [];
  const add = (gate: string, severity: Severity, message: string) => out.push({ gate, severity, recipeId: recipe.id, message });
  const reqs = recipe.requiredIngredients;
  const sauces = reqs.filter((q) => categoryOf(q.ingredientId) === "sauce");
  const cheeses = reqs.filter((q) => categoryOf(q.ingredientId) === "cheese");
  if ((recipe.mechanics ?? []).length > 0) add("MECHANIC", "STOP", `waits for mechanic ${recipe.mechanics!.join(" + ")}: not shippable by a catalog-only train`);
  for (const q of reqs) {
    if (categoryOf(q.ingredientId) !== "topping") continue;
    const family = familyOf(q.ingredientId);
    if (family === null) add("HINT5_T-COV", "STOP", `topping ${q.ingredientId} has no Hint 5.0 family`);
    else if (!REACHABLE_FAMILIES.includes(family) && isNewIngredient(q.ingredientId)) add("DH4_OTHER_UNREACHABLE", "STOP", `new topping ${q.ingredientId} is in family "${family}": deductionProduction.gate (OD-DH4-2-9) keeps that answer unreachable and failed on exactly this in B23 -- pick a reachable family (precedent: walnut / sunflower-seeds / chocolate = spice)`);
    else if (!REACHABLE_FAMILIES.includes(family)) add("DH4_OTHER_RISK", "INFO", `shipped topping ${q.ingredientId} is in family "${family}": whether a new recipe makes that answer reachable depends on the hint states -- run deductionProduction.gate first in the implementation PR`);
  }
  if (sauces.length === 0) {
    add("NO_SAUCE_DECISION", "OWNER", "no sauce: shipping it as NO_SAUCE is an explicit Owner GAMEPLAY decision (D-2: never assumed from the source)");
    if (cheeses.length === 0) add("TQ1D_G7_CHEESE_FIRST", "STOP", "no sauce AND no cheese: hint5Production.gate G7 requires the first rung of a NO_SAUCE recipe to be CHEESE -- add a cheese (precedent: cream-cheese on the dessert recipes) or supply a sauce");
  }
  for (const q of reqs) if (q.applicationPhase === "POST_BAKE" && categoryOf(q.ingredientId) === "sauce") add("M7_POSTBAKE_SAUCE", "STOP", `${q.ingredientId} is a sauce applied after the bake: FINISH accepts toppings only until M7 (DRIZZLE, #579) is wired`);
  const hasPostBake = reqs.some((q) => q.applicationPhase === "POST_BAKE");
  if (hasPostBake !== (recipe.placement === "late")) add("LATE_PLACEMENT", "OWNER", hasPostBake ? "has POST_BAKE pieces but is placed in the ordinary catalog" : "is placed in the late catalog but has no POST_BAKE piece");
  const fresh = reqs.filter((q) => isNewIngredient(q.ingredientId)).map((q) => q.ingredientId);
  if (fresh.length === 0) add("LADDER_KEY_MATERIAL", "OWNER", "adds no new material: it cannot be the key recipe of a ladder step (OD-REC04-1); it needs the ladderCredit / D-6 decision");
  else if (fresh.length > 1) add("LADDER_KEY_MATERIAL", "INFO", `one step unlocks ${fresh.length} materials: ${fresh.join(", ")}`);
  return out;
}

/** Shop pack size is `10 x k` with k = the largest minCount any recipe needs; a train that raises k of a SHIPPED material changes its pack (price unchanged). */
export function packChanges(
  shippedIngredientIds: readonly string[],
  shipped: readonly { readonly requiredIngredients: readonly TrainRequirement[] }[],
  train: readonly TrainRecipe[],
): { ingredientId: string; before: number; after: number; raisedBy: string[] }[] {
  const k = (id: string, list: readonly { readonly requiredIngredients: readonly TrainRequirement[] }[]) =>
    list.reduce((max, r) => r.requiredIngredients.reduce((m, q) => (q.ingredientId === id && q.minCount > m ? q.minCount : m), max), 0);
  const out: { ingredientId: string; before: number; after: number; raisedBy: string[] }[] = [];
  for (const id of shippedIngredientIds) {
    const before = k(id, shipped);
    const after = Math.max(before, k(id, train));
    if (before > 0 && after > before) out.push({ ingredientId: id, before, after, raisedBy: train.filter((r) => r.requiredIngredients.some((q) => q.ingredientId === id && q.minCount > before)).map((r) => r.id) });
  }
  return out;
}

export type Verdict = "READY" | "NEEDS_OWNER" | "BLOCKED";

export function verdictOf(findings: readonly Finding[]): Verdict {
  if (findings.some((f) => f.severity === "STOP")) return "BLOCKED";
  return findings.some((f) => f.severity === "OWNER") ? "NEEDS_OWNER" : "READY";
}

export interface PreflightPacket {
  readonly train: string;
  readonly measuredOn: { readonly recipes: number; readonly ingredients: number; readonly ladderSteps: number };
  readonly recipes: readonly {
    readonly id: string;
    readonly nameJa: string;
    readonly placement: TrainPlacement;
    readonly verdict: Verdict;
    readonly newMaterials: readonly string[];
    readonly hintRungs: string | null;
    readonly duplicates: readonly DuplicateHit[];
    readonly findings: readonly Finding[];
  }[];
  readonly trainFindings: readonly Finding[];
  readonly research: {
    /** Shipped recipes whose letter changes in the canonical ladder order (the per-train stop condition, D-6). */
    readonly canonical: readonly { readonly recipeId: string; readonly changes: readonly string[]; readonly causedBy: readonly string[] }[];
    readonly nonCanonical: readonly ResearchImpactRow[];
    /** Measured changes of the sampled audit that the deterministic rule does not allow; must be empty. */
    readonly ruleViolations: readonly string[];
  };
  readonly packChanges: ReturnType<typeof packChanges>;
  readonly notCovered: readonly string[];
}

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");

/** The Owner packet (one page): every decision the train needs, each recorded once. */
export function renderPacketMarkdown(p: PreflightPacket): string {
  const lines: string[] = [];
  const count = (v: Verdict) => p.recipes.filter((r) => r.verdict === v).length;
  lines.push(`# Train preflight packet — ${p.train}`, "");
  lines.push(`Measured on the shipped catalog: ${p.measuredOn.recipes} recipes / ${p.measuredOn.ingredients} ingredients / ${p.measuredOn.ladderSteps} ladder steps. Generated by \`tools/content-train/preflight.mjs\`; do not edit by hand.`, "");
  lines.push(`Verdicts: READY ${count("READY")} / NEEDS_OWNER ${count("NEEDS_OWNER")} / BLOCKED ${count("BLOCKED")} (of ${p.recipes.length}).`, "");
  lines.push("## 1. Recipes", "", "| recipe | placement | verdict | new materials | Hint 5.0 rungs | duplicate gate | findings |", "|---|---|---|---|---|---|---|");
  for (const r of p.recipes) {
    const dup = r.duplicates.map((d) => `${d.kind} ${d.against}${d.againstTrain ? " (train)" : ""} ${d.jaccard}`).join("; ") || "0";
    const fnd = r.findings.map((f) => `[${f.severity}] ${f.gate}`).join("; ") || "-";
    lines.push(`| \`${r.id}\` | ${r.placement} | **${r.verdict}** | ${r.newMaterials.join(", ") || "-"} | ${r.hintRungs ?? "not a target"} | ${cell(dup)} | ${cell(fnd)} |`);
  }
  const all = [...p.trainFindings, ...p.recipes.flatMap((r) => r.findings)];
  for (const [severity, title] of [["STOP", "## 2. STOP — a known gate would fail (fix the spec before implementing)"], ["OWNER", "## 3. Owner decisions (answer once, per row)"]] as const) {
    lines.push("", title, "");
    const rows = all.filter((f) => f.severity === severity);
    if (rows.length === 0) lines.push("None.");
    else for (const f of rows) lines.push(`- \`${f.recipeId ?? p.train}\` — **${f.gate}**: ${f.message}`);
  }
  const notes = all.filter((f) => f.severity === "INFO");
  if (notes.length > 0) {
    lines.push("", "### Notes (no decision needed)", "");
    for (const f of notes) lines.push(`- \`${f.recipeId ?? p.train}\` — ${f.gate}: ${f.message}`);
  }
  lines.push("", "## 4. Research letters", "");
  lines.push(`Canonical ladder order (stop condition): **${p.research.canonical.length}** shipped recipe(s) change.`);
  for (const c of p.research.canonical) lines.push(`- \`${c.recipeId}\`: ${c.changes.join(" ")} — caused by ${c.causedBy.join(", ")}`);
  lines.push("", `Non-canonical acquisition orders — deterministic bound, additive over the recipes (a split of this train needs no new approval): **${p.research.nonCanonical.length}** shipped recipe(s).`, "");
  if (p.research.nonCanonical.length > 0) {
    lines.push("| shipped recipe | kind | max shift | caused by (shared material) |", "|---|---|---|---|");
    for (const r of p.research.nonCanonical) lines.push(`| \`${r.recipeId}\` | ${r.kind} | ${r.maxShift} | ${cell(r.causes.map((c) => `${c.newRecipeId} (${c.materials.join(", ")})`).join("; "))} |`);
  }
  lines.push("", `Rule cross-check against the sampled audit: ${p.research.ruleViolations.length === 0 ? "0 violations" : `**${p.research.ruleViolations.length} VIOLATIONS** — ${p.research.ruleViolations.join("; ")}`}.`);
  lines.push("", "## 5. Shop pack changes (price unchanged)", "");
  if (p.packChanges.length === 0) lines.push("None.");
  else for (const c of p.packChanges) lines.push(`- \`${c.ingredientId}\`: pack ${c.before * 10} → ${c.after * 10} (raised by ${c.raisedBy.join(", ")})`);
  lines.push("", "## 6. Not covered by the preflight (measured in the implementation PR)", "");
  for (const n of p.notCovered) lines.push(`- ${n}`);
  return `${lines.join("\n")}\n`;
}
