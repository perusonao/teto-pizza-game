/**
 * Train Kit: the IMPLEMENTATION spec of a content train (Issue #780; TEST / TOOL SUPPORT ONLY -- never imported by production code).
 *
 * `src/contentTrain/trainSpec.ts` (#816) is the APPROVAL spec: what the Owner is asked to approve, measured by the preflight.
 * A `KitTrain` is that spec plus every authored value the catalog needs (colour, emoji, size class, description, order line,
 * evidence id, sauce profile, ladder step). It is the single declarative source of one train:
 *
 *   KitTrain (JSON) --codegen.ts--> the edits of every catalog file + HV seeds + E2E     (tools/train-kit/cli.mjs apply)
 *   KitTrain (JSON) --trainContract.test.ts--> the catalog still matches the landed spec  (replaces a hand-written batch test)
 *   shipped catalog --extract.ts--> KitTrain                                              (round trip = the equivalence proof)
 *
 * Everything here is pure (no catalog import) and unit-tested on synthetic data (src/trainKit/*.test.ts).
 *
 * WHY THIS LIVES IN tools/ AND NOT IN src/: several gates scan every non-test module under src/ (who may read `.emoji`,
 * who may import the Discovery Ladder, Preview isolation). A tool is not part of the app, so it stays outside that tree and
 * those gates stay exactly as they are. Only test files (`*.test.ts`) and the landed specs live in src/trainKit/.
 */
import { REACHABLE_FAMILIES, TRAIN_ID_PATTERN, type TrainPlacement, type TrainRequirement, type TrainSpec } from "../../../src/contentTrain/trainSpec";

export type KitSizeClass = "xs" | "s" | "m" | "l" | "xl";
/** A component that renders its own `<svg data-ingredient-visual>` and is dispatched by `IngredientGlyph.tsx` on the visual id. */
export type KitGlyphHost = "StagedGlyph" | "DessertGlyph";

export interface KitIngredient {
  readonly id: string;
  readonly nameJa: string;
  readonly category: "sauce" | "cheese" | "topping";
  /** Hint 5.0 family of a topping; `null` for sauce / cheese. */
  readonly family: string | null;
  readonly color: string;
  /** Unique in the catalog and different from every Hint 5.0 family symbol (G18 / H5-INV-2). */
  readonly emoji: string;
  /** Topping / cheese size class; omitted = the default `m` (no row is written). Never set for a sauce. */
  readonly sizeClass?: KitSizeClass;
  /** Dedicated art: the `DedicatedIngredientVisual` id and the component that draws it (the art itself is made beforehand, unwired). */
  readonly pieceVisual?: string;
  readonly glyphHost?: KitGlyphHost;
  /** How a piece of this NEW ingredient lands on the pizza in the Reference; omitted = `HEAVY_SQUASH` (leaf herbs use `LIGHT_LEAF`). */
  readonly landingStyle?: "HEAVY_SQUASH" | "LIGHT_LEAF";
}

export interface KitSauceProfile {
  readonly ingredientId: string;
  readonly interaction: "PAINT" | "PAINT_TEMPORARY";
}

export interface KitRecipe {
  readonly id: string;
  readonly nameJa: string;
  readonly description: string;
  readonly placement: TrainPlacement;
  readonly requiredIngredients: readonly TrainRequirement[];
  readonly bakeTarget: { readonly start: number; readonly end: number };
  readonly baseRewardPitz: number;
  readonly lunchRush: boolean;
  readonly ladderCredit: boolean;
  /** Discovery target id (the PIZZA DB evidence id of the 172 matrix). */
  readonly evidenceId: string;
  readonly order: { readonly requestedBy: string; readonly lineJa: string };
  /** `null` = NO_SAUCE (an explicit Owner GAMEPLAY decision); otherwise the PRIMARY sauce only. */
  readonly sauceProfile: KitSauceProfile | null;
  /** The new materials this recipe's own ladder step unlocks (it is the step's key recipe); `null` = no step of its own. */
  readonly ladderStep: { readonly ingredientIds: readonly string[] } | null;
  /** Short id used by the HV seed (`?hv=<tag>-<hvAlias>`) and the E2E screenshots; default = the recipe id. */
  readonly hvAlias?: string;
}

export interface KitTrain {
  readonly train: string;
  /** Lowercase tag for file names / HV ids, e.g. `b23b`, `t24`. */
  readonly tag: string;
  /** Human label used in generated comments, e.g. `Expansion Batch 23-b`. */
  readonly label: string;
  readonly issue: number;
  readonly recipes: readonly KitRecipe[];
  readonly newIngredients: readonly KitIngredient[];
  /** Entitlement floors of the NEW late materials, recorded by `apply` at the moment they shipped (derived ladder numbers, frozen afterwards). `trainContract.test.ts` asserts them exactly. */
  readonly floors?: Readonly<Record<string, number>>;
}

/** The late-catalog / T4 convention every batch since B8 has used; a spec may omit these and `withDefaults` fills them in. */
export const KIT_DEFAULTS = { bakeTarget: { start: 58, end: 78 }, baseRewardPitz: 100, lunchRush: false, ladderCredit: true, requestedBy: "mito" } as const;

export const TAG_PATTERN = /^[a-z][a-z0-9]*$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const SIZE_CLASSES: readonly string[] = ["xs", "s", "m", "l", "xl"];

type Loose<T> = { -readonly [K in keyof T]?: T[K] };

/** Fills the conventional values a spec may leave out. Authored text (description, order line, colour, emoji) is never invented. */
export function withDefaults(raw: Omit<KitTrain, "recipes"> & { recipes: readonly (Loose<KitRecipe> & { id: string })[] }): KitTrain {
  return {
    ...raw,
    recipes: raw.recipes.map((r) => ({
      ...r,
      bakeTarget: r.bakeTarget ?? KIT_DEFAULTS.bakeTarget,
      baseRewardPitz: r.baseRewardPitz ?? KIT_DEFAULTS.baseRewardPitz,
      lunchRush: r.lunchRush ?? KIT_DEFAULTS.lunchRush,
      ladderCredit: r.ladderCredit ?? KIT_DEFAULTS.ladderCredit,
      order: { requestedBy: r.order?.requestedBy ?? KIT_DEFAULTS.requestedBy, lineJa: r.order?.lineJa ?? "" },
      ladderStep: r.ladderStep ?? null,
    })) as KitRecipe[],
  };
}

/** The approval spec (#816) of an implementation spec: what the preflight measures. */
export function toTrainSpec(kit: KitTrain): TrainSpec {
  return {
    train: kit.train,
    recipes: kit.recipes.map((r) => ({ id: r.id, nameJa: r.nameJa, placement: r.placement, requiredIngredients: r.requiredIngredients })),
    newIngredients: kit.newIngredients.map((i) => ({ id: i.id, nameJa: i.nameJa, category: i.category, family: i.family })),
  };
}

/** A new ingredient ships in the late catalog iff the recipe whose ladder step unlocks it is a late recipe. */
export function isLateIngredient(kit: KitTrain, ingredientId: string): boolean {
  const owner = kit.recipes.find((r) => r.ladderStep?.ingredientIds.includes(ingredientId));
  return owner?.placement === "late";
}

export interface ShippedFacts {
  readonly recipeIds: readonly string[];
  readonly ingredients: readonly { readonly id: string; readonly category: string; readonly emoji: string }[];
  /** Symbols of the Hint 5.0 families (an ingredient emoji must differ from all of them). */
  readonly familySymbols?: readonly string[];
}

/** Every structural problem of an implementation spec; empty = `codegen.ts` may run. The Gate measurements stay with the preflight and the real test suite. */
export function validateKitTrain(kit: KitTrain, shipped: ShippedFacts): string[] {
  const problems: string[] = [];
  const say = (m: string) => problems.push(m);
  const todo = (v: unknown, path: string): void => {
    if (v === "TODO") say(`${path} is still TODO (an authored value: write it, never leave the scaffold's placeholder)`);
    else if (Array.isArray(v)) v.forEach((x, i) => todo(x, `${path}[${(x as { id?: string })?.id ?? i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) todo(x, `${path}.${k}`);
  };
  todo(kit.recipes, "recipes");
  todo(kit.newIngredients, "newIngredients");
  if (problems.length > 0) return problems;
  // `train` and `label` are written into `//` and `/** */` comments of the catalog files: nothing that could end a comment or a line.
  const unsafe = /(\*\/|[\r\n\u2028\u2029`]|\/\*)/;
  for (const [name, value] of [["train", kit.train], ["label", kit.label]] as const) if (typeof value === "string" && unsafe.test(value)) say(`${name} contains a character sequence that could escape a generated comment ("*/", "/*", a backtick or a line break)`);
  if (!kit.train) say("train name is missing");
  if (!TAG_PATTERN.test(kit.tag ?? "")) say(`tag "${kit.tag}" must match ${TAG_PATTERN} (it becomes a file name and an identifier)`);
  if (!kit.label) say("label is missing");
  if (!Number.isInteger(kit.issue)) say("issue number is missing");
  const shippedRecipes = new Set(shipped.recipeIds);
  const shippedIngredients = new Map(shipped.ingredients.map((i) => [i.id, i]));
  const fresh = new Map(kit.newIngredients.map((i) => [i.id, i]));
  if (fresh.size !== kit.newIngredients.length) say("duplicate new ingredient id");
  const emojiInUse = new Map<string, string>([...shipped.ingredients.map((i) => [i.emoji, i.id] as const), ...(shipped.familySymbols ?? []).map((s) => [s, "a Hint 5.0 family symbol"] as const)]);
  for (const i of kit.newIngredients) {
    if (!TRAIN_ID_PATTERN.test(i.id)) say(`ingredient id format: ${i.id}`);
    if (shippedIngredients.has(i.id)) say(`new ingredient is already shipped: ${i.id}`);
    if (!["sauce", "cheese", "topping"].includes(i.category)) say(`category of ${i.id}`);
    if ((i.category === "topping") !== (i.family !== null)) say(`family of ${i.id}: a topping needs a family, a sauce / cheese has none`);
    if (i.category === "topping" && i.family !== null && !REACHABLE_FAMILIES.includes(i.family)) say(`family of ${i.id}: "${i.family}" is not a reachable family (DH4-PROD gate, OD-DH4-2-9); use one of ${REACHABLE_FAMILIES.join(" / ")}`);
    if (!i.nameJa) say(`nameJa of ${i.id}`);
    if (!COLOR_PATTERN.test(i.color ?? "")) say(`color of ${i.id} must be lowercase #rrggbb`);
    if (!i.emoji) say(`emoji of ${i.id}`);
    else if (emojiInUse.has(i.emoji)) say(`emoji of ${i.id} is already used by ${emojiInUse.get(i.emoji)} (G18 / H5-INV-2: unique)`);
    else emojiInUse.set(i.emoji, i.id);
    if (i.sizeClass !== undefined && !SIZE_CLASSES.includes(i.sizeClass)) say(`sizeClass of ${i.id}`);
    if (i.landingStyle !== undefined && !["HEAVY_SQUASH", "LIGHT_LEAF"].includes(i.landingStyle)) say(`landingStyle of ${i.id}`);
    if (i.sizeClass !== undefined && i.category === "sauce") say(`sizeClass of ${i.id}: a sauce has no size class`);
    if ((i.pieceVisual === undefined) !== (i.glyphHost === undefined)) say(`${i.id}: pieceVisual and glyphHost go together`);
    if (i.pieceVisual !== undefined && !TRAIN_ID_PATTERN.test(i.pieceVisual)) say(`pieceVisual of ${i.id}`);
    if (i.glyphHost === "DessertGlyph" && i.pieceVisual !== `${i.id}-dessert`) say(`pieceVisual of ${i.id}: a DessertGlyph visual is "<id>-dessert"`);
    const owners = kit.recipes.filter((r) => r.ladderStep?.ingredientIds.includes(i.id));
    if (owners.length !== 1) say(`new ingredient ${i.id} must be unlocked by exactly one ladder step of this train (found ${owners.length}); an ingredient ships with its first recipe (OD-REC04-1)`);
  }
  const seen = new Set<string>();
  const aliases = new Set<string>();
  for (const r of kit.recipes) {
    if (!TRAIN_ID_PATTERN.test(r.id)) say(`recipe id format: ${r.id}`);
    if (seen.has(r.id)) say(`duplicate train recipe: ${r.id}`);
    seen.add(r.id);
    if (shippedRecipes.has(r.id)) say(`train recipe is already shipped: ${r.id}`);
    const alias = r.hvAlias ?? r.id;
    if (!TRAIN_ID_PATTERN.test(alias) || aliases.has(alias)) say(`hvAlias of ${r.id}`);
    aliases.add(alias);
    if (r.placement !== "ordinary" && r.placement !== "late") say(`placement of ${r.id}`);
    if (!r.nameJa || !r.description) say(`nameJa / description of ${r.id}`);
    if (!r.order?.lineJa) say(`order line of ${r.id}`);
    if (!r.evidenceId) say(`evidenceId of ${r.id}`);
    if (!Number.isInteger(r.bakeTarget?.start) || !Number.isInteger(r.bakeTarget?.end) || !(r.bakeTarget.start < r.bakeTarget.end)) say(`bakeTarget of ${r.id} must be two integers, start < end`);
    if (!Number.isInteger(r.baseRewardPitz) || r.baseRewardPitz < 0) say(`baseRewardPitz of ${r.id} must be a non-negative integer`);
    if (typeof r.lunchRush !== "boolean" || typeof r.ladderCredit !== "boolean") say(`lunchRush / ladderCredit of ${r.id} must be booleans`);
    if (r.sauceProfile !== null && !["PAINT", "PAINT_TEMPORARY"].includes(r.sauceProfile?.interaction)) say(`sauceProfile.interaction of ${r.id} must be PAINT or PAINT_TEMPORARY`);
    if (typeof r.order?.requestedBy !== "string" || r.order.requestedBy.length === 0) say(`order.requestedBy of ${r.id}`);
    const ids = r.requiredIngredients.map((q) => q.ingredientId);
    if (ids.length === 0) say(`recipe without ingredients: ${r.id}`);
    if (new Set(ids).size !== ids.length) say(`repeated ingredient in ${r.id}`);
    const categoryOf = (id: string) => fresh.get(id)?.category ?? shippedIngredients.get(id)?.category ?? null;
    for (const q of r.requiredIngredients) {
      if (!Number.isInteger(q.minCount) || q.minCount < 1) say(`minCount ${r.id}/${q.ingredientId}`);
      if (categoryOf(q.ingredientId) === null) say(`unknown ingredient ${q.ingredientId} in ${r.id}`);
      if (q.applicationPhase === "POST_BAKE" && categoryOf(q.ingredientId) === "sauce") say(`${r.id}: ${q.ingredientId} is a post-bake sauce (needs M7 / DRIZZLE, #579)`);
      else if (q.applicationPhase === "POST_BAKE" && categoryOf(q.ingredientId) !== null && categoryOf(q.ingredientId) !== "topping") say(`${r.id}: ${q.ingredientId} is a ${categoryOf(q.ingredientId)} with applicationPhase POST_BAKE; FINISH places toppings only (gameReducer)`);
    }
    const sauces = ids.filter((id) => categoryOf(id) === "sauce");
    if (r.sauceProfile === null && sauces.length > 0) say(`${r.id}: sauceProfile is null (NO_SAUCE) but the recipe requires ${sauces.join(", ")}`);
    if (r.sauceProfile !== null && !sauces.includes(r.sauceProfile.ingredientId)) say(`${r.id}: sauceProfile names ${r.sauceProfile.ingredientId}, which is not a required sauce of the recipe`);
    if (r.sauceProfile === null && !ids.some((id) => categoryOf(id) === "cheese")) say(`${r.id}: NO_SAUCE without a cheese fails hint5Production.gate G7 (the first rung must be CHEESE)`);
    const hasPost = r.requiredIngredients.some((q) => q.applicationPhase === "POST_BAKE");
    if (hasPost && r.placement !== "late") say(`${r.id}: a recipe with a POST_BAKE piece ships in the late catalog`);
    for (const id of r.ladderStep?.ingredientIds ?? []) {
      if (!fresh.has(id)) say(`ladder step of ${r.id}: ${id} is not a new ingredient of this train`);
      if (!ids.includes(id)) say(`ladder step of ${r.id}: the recipe does not use ${id}`);
    }
    if (r.ladderStep && r.ladderStep.ingredientIds.length === 0) say(`ladder step of ${r.id} is empty (use null)`);
    if (r.ladderStep && !r.ladderCredit) say(`${r.id}: the key recipe of a ladder step is ladder-credited`);
    if (!r.ladderStep && r.placement === "late") say(`${r.id}: a late recipe needs its own late ladder step (the late catalog is unlocked step by step)`);
  }
  return problems;
}

/** `foo-bar-baz` -> `FOO_BAR_BAZ` (the `<ID>_REFERENCE` constant naming of referencePizza.ts). */
export const constantName = (id: string): string => id.toUpperCase().replace(/-/g, "_");
/** `b23b` -> `B23b` is NOT what the code base uses; identifiers are the upper-cased tag (`B23B`), kept consistent with the existing seeds. */
export const tagIdentifier = (tag: string): string => tag.toUpperCase();
