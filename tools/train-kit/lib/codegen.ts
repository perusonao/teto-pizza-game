/**
 * Train Kit code generator (Issue #780; TOOL SUPPORT ONLY). Pure text -> text: given an implementation spec and the CURRENT text of
 * the catalog files, it returns the edited text of every file a catalog-only train touches. It never reads or writes the disk
 * (`trainKit.run.test.ts` does) and never imports the catalog, so it is unit-tested on synthetic files.
 *
 * Every edit is an insertion at a named anchor. An anchor that is not found exactly once throws `AnchorError` (fail closed): a
 * refactor of a catalog file can never make the generator write to the wrong place. `codegen.anchors.test.ts` checks every anchor
 * against the real files on each test run, so the breakage is reported by the PR that moves an anchor, not by the next train.
 */
import { constantName, isLateIngredient, tagIdentifier, type KitIngredient, type KitRecipe, type KitTrain } from "./implSpec";

export class AnchorError extends Error {}

export const CATALOG_FILES = {
  recipes: "src/data/recipes.ts",
  ingredients: "src/data/ingredients.ts",
  late: "src/data/lateCatalog.ts",
  orders: "src/data/orders.ts",
  ladder: "src/data/discoveryLadder.ts",
  discovery: "src/data/discoveryCatalog.ts",
  taxonomy: "src/data/ingredientTaxonomy.ts",
  sizeClass: "src/data/toppingSizeClass.ts",
  hintRoles: "src/data/recipeHintRoles.ts",
  sauceProfiles: "src/data/recipeSauceProfiles.ts",
  reference: "src/data/referencePizza.ts",
  glyph: "src/components/IngredientGlyph.tsx",
  hvSeeds: "src/preview/hvSeeds.ts",
  previewGate: "src/preview/previewIsolation.gate.test.ts",
} as const;
export type CatalogFileKey = keyof typeof CATALOG_FILES;

export interface Derived {
  /** Entitlement floor of every NEW late ingredient = the ladder step number it gets at the moment it ships. */
  readonly floors: Readonly<Record<string, number>>;
  /** Reference piece groups per train recipe, from the real `assignReferenceSlots` (RT-01), in `requiredIngredients` order without the sauces. */
  readonly references: Readonly<Record<string, readonly ReferenceGroup[]>>;
}

export interface PieceStyle {
  readonly interaction: { readonly family: string; readonly primaryInput: string; readonly fallbackInput: string; readonly landingStyle: string };
  readonly matching: { readonly fullCreditRadius: number; readonly zeroCreditRadius: number };
}
export interface ReferenceGroup {
  readonly ingredientId: string;
  readonly positions: readonly { readonly x: number; readonly y: number }[];
  /** How the piece lands and how far a placement may be off. A shipped ingredient keeps the one style every shipped Reference gives it; omitted = `DEFAULT_PIECE_STYLE`. */
  readonly style?: PieceStyle;
}
/** The style of 94 of the 103 ingredients that have a Reference today (leaf herbs land as `LIGHT_LEAF`, the egg has a wider radius). */
export const DEFAULT_PIECE_STYLE: PieceStyle = { interaction: { family: "TAP_PLACE", primaryInput: "DRAG_FROM_TRAY", fallbackInput: "TAP_ON_PIZZA", landingStyle: "HEAVY_SQUASH" }, matching: { fullCreditRadius: 8, zeroCreditRadius: 22 } };

/* ---------- text primitives ---------- */

function once(text: string, needle: string, what: string): number {
  const at = text.indexOf(needle);
  if (at < 0) throw new AnchorError(`anchor not found: ${what} (${JSON.stringify(needle)})`);
  if (text.indexOf(needle, at + needle.length) >= 0) throw new AnchorError(`anchor is ambiguous: ${what} (${JSON.stringify(needle)})`);
  return at;
}

/** Inserts `block` (whole lines) before the line that closes the declaration starting with `decl` (`close` at column 0, e.g. `];`). Blank lines before the closer stay after the insertion. */
export function insertBeforeClose(text: string, decl: string, close: string, block: string): string {
  const start = once(text, decl, `declaration ${decl}`);
  const closeAt = text.indexOf(`\n${close}`, start);
  if (closeAt < 0) throw new AnchorError(`closing ${JSON.stringify(close)} of ${decl} not found`);
  // The closer must belong to THIS declaration: if another top-level declaration starts first, ours has no closer and we must not borrow the next one's.
  if (/\n(?:export\s+)?(?:const|let|var|function|type|interface|class)\s/.test(text.slice(start + decl.length, closeAt))) throw new AnchorError(`closing ${JSON.stringify(close)} of ${decl} not found before the next declaration`);
  let at = closeAt;
  while (text[at - 1] === "\n") at -= 1;
  return `${text.slice(0, at)}\n${block.replace(/\n+$/, "")}${text.slice(at)}`;
}

/** Inserts `block` (whole lines) before the unique line that starts with `lineStart`. */
export function insertBeforeLine(text: string, lineStart: string, block: string): string {
  const at = once(text, `\n${lineStart}`, `line ${lineStart}`);
  return `${text.slice(0, at)}\n${block.replace(/\n+$/, "")}${text.slice(at)}`;
}

/** Inserts `block` (whole lines) after the unique line that starts with `lineStart`. */
export function insertAfterLine(text: string, lineStart: string, block: string): string {
  const at = once(text, `\n${lineStart}`, `line ${lineStart}`);
  const end = text.indexOf("\n", at + 1);
  return `${text.slice(0, end)}\n${block.replace(/\n+$/, "")}${text.slice(end)}`;
}

/** Appends `items` inside a one-line literal: the unique line starting with `lineStart` and ending with `lineEnd` (e.g. `] as const;`). */
export function appendInline(text: string, lineStart: string, lineEnd: string, items: string): string {
  const at = once(text, `\n${lineStart}`, `line ${lineStart}`) + 1;
  const eol = text.indexOf("\n", at);
  const line = text.slice(at, eol < 0 ? undefined : eol);
  if (!line.endsWith(lineEnd)) throw new AnchorError(`line ${lineStart} does not end with ${JSON.stringify(lineEnd)}`);
  const body = line.slice(0, line.length - lineEnd.length).replace(/\s+$/, "");
  const closer = lineEnd.trimStart();
  const pad = lineEnd.startsWith(" ") ? " " : "";
  return `${text.slice(0, at)}${body}, ${items}${pad}${closer}${eol < 0 ? "" : text.slice(eol)}`;
}

/* ---------- value renderers ---------- */

export const q = (s: string): string => JSON.stringify(s);
/** Non-ASCII code points as `\u{...}` escapes, the way the catalog writes emoji. */
export const emojiLiteral = (emoji: string): string => `"${[...emoji].map((ch) => (ch.codePointAt(0)! > 0x7f ? `\\u{${ch.codePointAt(0)!.toString(16).toUpperCase()}}` : ch)).join("")}"`;
/** An object key: bare when it is an identifier, quoted otherwise. */
export const key = (id: string): string => (/^[a-zA-Z_$][\w$]*$/.test(id) ? id : q(id));

const note = (kit: KitTrain, what: string) => `${kit.label} (#${kit.issue}; train spec \`${kit.train}\`, generated by tools/train-kit -- PROVISIONAL SPEC, GAMEPLAY ASSUMPTION unless its Result Report says otherwise): ${what}`;

function requirementLines(r: KitRecipe, indent: string): string {
  return r.requiredIngredients.map((x) => `${indent}{ ingredientId: ${q(x.ingredientId)}, minCount: ${x.minCount}${x.applicationPhase === "POST_BAKE" ? `, applicationPhase: "POST_BAKE"` : ""} },`).join("\n");
}

export function renderRecipe(r: KitRecipe): string {
  return [
    "  {",
    `    id: ${q(r.id)},`,
    `    nameJa: ${q(r.nameJa)},`,
    `    description: ${q(r.description)},`,
    "    requiredIngredients: [",
    requirementLines(r, "      "),
    "    ],",
    `    bakeTarget: { start: ${r.bakeTarget.start}, end: ${r.bakeTarget.end} },`,
    `    baseRewardPitz: ${r.baseRewardPitz},`,
    ...(r.ladderCredit ? [] : ["    ladderCredit: false,"]),
    ...(r.lunchRush ? [] : ["    lunchRush: false,"]),
    "  },",
  ].join("\n");
}

export function renderOrder(r: KitRecipe): string {
  return ["  {", `    id: ${q(`order-${r.id}`)},`, `    recipeId: ${q(r.id)},`, `    requestedBy: ${q(r.order.requestedBy)},`, `    lineJa: ${q(r.order.lineJa)},`, "  },"].join("\n");
}

const ingredientFields = (i: KitIngredient): string =>
  `id: ${q(i.id)}, category: ${q(i.category)}, nameJa: ${q(i.nameJa)}, color: ${q(i.color)}, emoji: ${emojiLiteral(i.emoji)}, ${i.pieceVisual ? `pieceVisual: ${q(i.pieceVisual)}, ` : ""}placement: ${q(i.category === "sauce" ? "spread" : "scatter")}, unlockCondition: { minTotalStars: 0 }`;
export const renderIngredient = (i: KitIngredient): string => `  { ${ingredientFields(i)} },`;
/** The multi-line form of the ordinary catalog (`BASE_INGREDIENTS`): one field per line, which the static ledger generators parse. */
export const renderIngredientBlock = (i: KitIngredient): string =>
  ["  {", `    id: ${q(i.id)},`, `    category: ${q(i.category)},`, `    nameJa: ${q(i.nameJa)},`, `    color: ${q(i.color)},`, `    emoji: ${emojiLiteral(i.emoji)},`, `    placement: ${q(i.category === "sauce" ? "spread" : "scatter")},`, "    unlockCondition: { minTotalStars: 0 },", ...(i.pieceVisual ? [`    pieceVisual: ${q(i.pieceVisual)},`] : []), "  },"].join("\n");

const styleLiteral = (st: PieceStyle): string =>
  `interaction: { family: ${q(st.interaction.family)}, primaryInput: ${q(st.interaction.primaryInput)}, fallbackInput: ${q(st.interaction.fallbackInput)}, landingStyle: ${q(st.interaction.landingStyle)} }, matching: { fullCreditRadius: ${st.matching.fullCreditRadius}, zeroCreditRadius: ${st.matching.zeroCreditRadius} }`;

export function renderReference(r: KitRecipe, groups: readonly ReferenceGroup[]): string {
  return [
    `export const ${constantName(r.id)}_REFERENCE: ReferencePizza = {`,
    `  recipeId: ${q(r.id)},`,
    `  sauce: computeMechanicalSauceReference(${q(r.id)}),`,
    "  pieceGroups: [",
    ...groups.map((g) => `    { ingredientId: ${q(g.ingredientId)}, positions: [${g.positions.map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(", ")}], ${styleLiteral(g.style ?? DEFAULT_PIECE_STYLE)} },`),
    "  ],",
    "};",
  ].join("\n");
}

/* ---------- the edits ---------- */

type Files = Readonly<Record<string, string>>;

function need(files: Files, k: CatalogFileKey): string {
  const text = files[CATALOG_FILES[k]];
  if (typeof text !== "string") throw new AnchorError(`file not supplied: ${CATALOG_FILES[k]}`);
  return text;
}

/** The catalog edits of a train. Returns only the files that changed. */
export function applyCatalogEdits(kit: KitTrain, derived: Derived, files: Files, options: { readonly skipGlyphDispatch?: boolean } = {}): Record<string, string> {
  const out: Record<string, string> = {};
  const edit = (k: CatalogFileKey, f: (text: string) => string) => {
    out[CATALOG_FILES[k]] = f(out[CATALOG_FILES[k]] ?? need(files, k));
  };
  const ordinary = kit.recipes.filter((r) => r.placement === "ordinary");
  const late = kit.recipes.filter((r) => r.placement === "late");
  const lateIngredients = kit.newIngredients.filter((i) => isLateIngredient(kit, i.id));
  const baseIngredients = kit.newIngredients.filter((i) => !isLateIngredient(kit, i.id));
  const visuals = kit.newIngredients.filter((i) => i.pieceVisual);

  // --- ordinary catalog ---
  if (ordinary.length > 0) {
    edit("recipes", (t) => insertBeforeClose(t, "const BASE_RECIPES = [", "] as const;", [`  // ${note(kit, ordinary.map((r) => r.id).join(", "))}`, ...ordinary.map(renderRecipe)].join("\n")));
    edit("orders", (t) => insertBeforeClose(t, "const BASE_ORDERS: Order[] = [", "];", ordinary.map(renderOrder).join("\n")));
    edit("discovery", (t) => insertBeforeClose(t, "export const RECIPE_DISCOVERY_TARGET_IDS", "};", ordinary.map((r) => `  ${q(r.id)}: ${q(r.evidenceId)},`).join("\n")));
    const steps = ordinary.filter((r) => r.ladderStep);
    if (steps.length > 0) {
      edit("ladder", (t) => insertBeforeClose(t, "export const POST_W1_APPENDED_STEPS", "];", [`  // ${note(kit, "appended ordinary step(s); earlier steps stay frozen, numbers are DERIVED (never authored), no star gate.")}`, ...steps.map((r) => `  { ingredientIds: [${r.ladderStep!.ingredientIds.map(q).join(", ")}], keyRecipeId: ${q(r.id)} },`)].join("\n")));
    }
  }
  if (baseIngredients.length > 0) {
    edit("ingredients", (t) => insertBeforeClose(t, "const BASE_INGREDIENTS: Ingredient[] = [", "];", [`  // ${note(kit, baseIngredients.map((i) => i.id).join(", "))}`, ...baseIngredients.map(renderIngredientBlock)].join("\n")));
    const families = baseIngredients.filter((i) => i.category === "topping");
    if (families.length > 0) edit("taxonomy", (t) => insertBeforeClose(t, "const BASE_TOPPING_FAMILY_ROWS", "];", families.map((i) => `  [${q(i.id)}, ${q(i.family!)}], // ${kit.label} (#${kit.issue})`).join("\n")));
    const sized = baseIngredients.filter((i) => i.sizeClass);
    if (sized.length > 0) edit("sizeClass", (t) => insertBeforeClose(t, "const BASE_TOPPING_SIZE_CLASS_BY_ID", "};", sized.map((i) => `  ${key(i.id)}: ${q(i.sizeClass!)}, // ${kit.label} (#${kit.issue})`).join("\n")));
  }

  // --- late catalog ---
  if (late.length > 0) {
    edit("late", (t) => insertBeforeLine(t, "  // Pinsa Romana (#577 P3-b-1, Owner L1", [`  // ${note(kit, late.map((r) => r.id).join(", "))}`, ...late.map(renderRecipe)].join("\n")));
    edit("late", (t) => {
      const pinsaOrder = once(t, `    id: "order-pinsa-romana",`, "the pinsa order (kept last)");
      const open = t.lastIndexOf("\n  {\n", pinsaOrder);
      if (open < 0) throw new AnchorError("opening of the pinsa order not found");
      return `${t.slice(0, open)}\n${late.map(renderOrder).join("\n")}${t.slice(open)}`;
    });
    edit("late", (t) => insertBeforeLine(t, `  ...(pinsaEnabled() ? { "pinsa-romana":`, late.map((r) => `  ${q(r.id)}: ${q(r.evidenceId)},`).join("\n")));
    edit("late", (t) => insertBeforeClose(t, "export const LATE_LADDER_STEPS", "];", [`  // ${note(kit, "appended late step(s); numbers are DERIVED, never authored; no star gate.")}`, ...late.map((r) => `  { ingredientIds: [${r.ladderStep!.ingredientIds.map(q).join(", ")}], keyRecipeId: ${q(r.id)} },`)].join("\n")));
  }
  if (lateIngredients.length > 0) {
    edit("late", (t) => insertBeforeClose(t, "export const LATE_INGREDIENTS", "];", [`  // ${note(kit, lateIngredients.map((i) => i.id).join(", "))}`, ...lateIngredients.map(renderIngredient)].join("\n")));
    const families = lateIngredients.filter((i) => i.category === "topping");
    if (families.length > 0) edit("late", (t) => appendInline(t, "export const LATE_TAXONOMY_ROWS = [", "] as const;", families.map((i) => `[${q(i.id)}, ${q(i.family!)}]`).join(", ")));
    const sized = lateIngredients.filter((i) => i.sizeClass);
    if (sized.length > 0) edit("late", (t) => appendInline(t, "export const LATE_TOPPING_SIZE_CLASS = {", " } as const;", sized.map((i) => `${q(i.id)}: ${q(i.sizeClass!)}`).join(", ")));
    edit("late", (t) => appendInline(t, "export const LATE_ENTITLEMENT_FLOORS", " };", lateIngredients.map((i) => {
      const floor = derived.floors[i.id];
      if (!Number.isInteger(floor)) throw new AnchorError(`no derived entitlement floor for late ingredient ${i.id}`);
      return `${q(i.id)}: ${floor}`;
    }).join(", ")));
  }

  // --- per-recipe tables shared by both catalogs ---
  edit("hintRoles", (t) => insertBeforeClose(t, "export const RECIPE_HINT_ROLES", "};", kit.recipes.map((r) => `  ${q(r.id)}: { keyFree: true },`).join("\n")));
  edit("sauceProfiles", (t) => insertAfterLine(t, "export const RECIPE_SAUCE_PROFILES = {", [`  // ${note(kit, "`null` = NO_SAUCE, an explicit Owner GAMEPLAY decision; otherwise the PRIMARY sauce only.")}`, ...kit.recipes.map((r) => (r.sauceProfile ? `  ${q(r.id)}: { recipeId: ${q(r.id)}, ingredientId: ${q(r.sauceProfile.ingredientId)}, interaction: ${q(r.sauceProfile.interaction)} },` : `  ${q(r.id)}: null,`))].join("\n")));
  // A NEW sauce that is some recipe's primary sauce joins the profile's ingredient union (one line; B22 buffalo-sauce precedent).
  const newProfileSauces = [...new Set(kit.recipes.map((r) => r.sauceProfile?.ingredientId).filter((id): id is string => !!id && kit.newIngredients.some((i) => i.id === id)))];
  if (newProfileSauces.length > 0) {
    edit("sauceProfiles", (t) => {
      const at = once(t, `\n  ingredientId: "tomato-sauce" |`, "RecipeSauceProfile.ingredientId union") + 1;
      const eol = t.indexOf("\n", at);
      if (t[eol - 1] !== ";") throw new AnchorError("RecipeSauceProfile.ingredientId union is not a one-line type");
      return `${t.slice(0, eol - 1)}${newProfileSauces.map((id) => ` | ${q(id)}`).join("")};${t.slice(eol)}`;
    });
  }
  edit("reference", (t) => {
    const blocks = kit.recipes.map((r) => {
      const groups = derived.references[r.id];
      if (!groups) throw new AnchorError(`no derived Reference for ${r.id}`);
      return `/** ${note(kit, `Reference Truth for \`${r.id}\`; slots from assignReferenceSlots (RT-01) in requiredIngredients order. GAMEPLAY / REFERENCE CALIBRATION, not source authority.`)} */\n${renderReference(r, groups)}\n`;
    });
    const withConstants = insertBeforeLine(t, "const REFERENCE_PIZZAS: ReadonlyMap<RecipeId, ReferencePizza> = new Map([", blocks.join("\n"));
    return insertBeforeLine(withConstants, "  [PINSA_ROMANA_REFERENCE.recipeId, PINSA_ROMANA_REFERENCE],", kit.recipes.map((r) => `  [${constantName(r.id)}_REFERENCE.recipeId, ${constantName(r.id)}_REFERENCE],`).join("\n"));
  });

  // --- dedicated art registration ---
  if (visuals.length > 0) {
    edit("ingredients", (t) => insertAfterLine(t, "export type DedicatedIngredientVisual =", visuals.map((i) => `  | ${q(i.pieceVisual!)}`).join("\n")));
    edit("glyph", (t) => insertAfterLine(t, "const VISUAL_VIEWBOX: Record<DedicatedIngredientVisual, string> = {", visuals.map((i) => `  ${q(i.pieceVisual!)}: "0 0 64 64",`).join("\n")));
    const hostAnchor: Record<string, string> = { StagedGlyph: `    visual === "lettuce-leaf" ||`, DessertGlyph: `    visual === "apple-dessert" ||` };
    for (const host of ["StagedGlyph", "DessertGlyph"] as const) {
      const mine = visuals.filter((i) => i.glyphHost === host);
      // `skipGlyphDispatch`: the visual is registered (type + viewBox) but the host's dispatch line is left to the caller -- only for the FIRST use of a new host component.
      if (mine.length === 0 || options.skipGlyphDispatch) continue;
      edit("glyph", (t) => {
        // Before B23-b the dessert host served `apple-dessert` alone on one line; widen it to the id-derived chain B23-b introduced.
        const legacy = `  if (visual === "apple-dessert") return <DessertGlyph id="apple" />;`;
        const chain = `  if (\n    visual === "apple-dessert" ||\n    false\n  ) return <DessertGlyph id={visual.slice(0, -"-dessert".length) as DessertGlyphId} />;`;
        const text = host === "DessertGlyph" && t.includes(legacy) ? insertAfterLine(t.replace(legacy, chain), `import { DessertGlyph } from "./dessertGlyphs/DessertGlyphs";`, `import type { DessertGlyphId } from "./dessertGlyphs/dessertPalette";`) : t;
        return insertBeforeLine(text, hostAnchor[host], `    ${mine.map((i) => `visual === ${q(i.pieceVisual!)} ||`).join(" ")} // ${kit.label} (#${kit.issue})`);
      });
    }
  }
  return out;
}

/* ---------- HV seed wiring (src/preview/hvSeeds.ts) ---------- */

/** Chains `?hv=<tag>-...` after every earlier id (the B18..B23-b pattern): import, return type, parse line, guard, apply. */
export function wireHvSeeds(text: string, kit: KitTrain): string {
  const P = tagIdentifier(kit.tag);
  const v = `${kit.tag}Id`;
  if (text.includes(`./${kit.tag}HvSeeds"`)) throw new AnchorError(`hvSeeds.ts already wires ${kit.tag}`);
  let t = insertBeforeLine(text, "export type HvScenarioId =", `import { apply${P}HvSeed, parse${P}HvParam, type ${P}HvScenarioId } from "./${kit.tag}HvSeeds";\n`);
  const signature = /^\): (HvScenarioId(?: \| \w+)*) \| null \{$/m;
  if ((t.match(new RegExp(signature.source, "gm")) ?? []).length !== 1) throw new AnchorError("applyPreviewHvSeed return type not found exactly once");
  t = t.replace(signature, (_m, types: string) => `): ${types} | ${P}HvScenarioId | null {`);
  const parses = [...t.matchAll(/^ {2}const (\w+) = (.+) \? null : parse\w+HvParam\(search\);.*$/gm)];
  const last = parses.at(-1);
  if (!last) throw new AnchorError("no chained parse line in hvSeeds.ts");
  const lastEnd = last.index! + last[0].length;
  t = `${t.slice(0, lastEnd)}\n  const ${v} = ${last[2]} || ${last[1]} ? null : parse${P}HvParam(search); // ${kit.label} (#${kit.issue}): after every earlier id, which are looked up first and unchanged${t.slice(lastEnd)}`;
  const guard = `!${last[1]}) || !storage`;
  t = `${t.slice(0, once(t, guard, "the nothing-to-apply guard"))}!${last[1]} && !${v}) || !storage${t.slice(once(t, guard, "the nothing-to-apply guard") + guard.length)}`;
  const final = new RegExp(`^  return ${last[1]} && (apply\\w+HvSeed)\\(${last[1]}, storage\\) \\? ${last[1]} : null;$`, "m");
  if (!final.test(t)) throw new AnchorError("final return of applyPreviewHvSeed not found");
  return t.replace(final, (_m, fn: string) => `  if (${last[1]}) return ${fn}(${last[1]}, storage) ? ${last[1]} : null;\n  return ${v} && apply${P}HvSeed(${v}, storage) ? ${v} : null;`);
}

/** Adds the train's HV seed ids and labels to the Preview isolation gate's forbidden-in-production list. */
export function wirePreviewGate(text: string, kit: KitTrain): string {
  const P = tagIdentifier(kit.tag);
  const imports = [...text.matchAll(/^import \{ \w+_HV_SCENARIOS \} from "\.\/\w+HvSeeds";$/gm)];
  const spreads = [...text.matchAll(/^ {2}\.\.\.\w+_HV_SCENARIOS\.map\(\(s\) => s\.labelJa\),$/gm)];
  const lastImport = imports.at(-1);
  const lastSpread = spreads.at(-1);
  if (!lastImport || !lastSpread) throw new AnchorError("previewIsolation.gate.test.ts: the HV scenario import / spread pattern was not found");
  const spreadEnd = lastSpread.index! + lastSpread[0].length;
  const withSpread = `${text.slice(0, spreadEnd)}\n  // ${kit.label} (#${kit.issue}): the HV seed ids and labels (./${kit.tag}HvSeeds.ts).\n  ...${P}_HV_SCENARIOS.map((s) => s.id),\n  ...${P}_HV_SCENARIOS.map((s) => s.labelJa),${text.slice(spreadEnd)}`;
  const importEnd = lastImport.index! + lastImport[0].length;
  return `${withSpread.slice(0, importEnd)}\nimport { ${P}_HV_SCENARIOS } from "./${kit.tag}HvSeeds";${withSpread.slice(importEnd)}`;
}

/* ---------- templates ---------- */

/** Replaces every `/*__NAME__*\/` and `__NAME__` placeholder; an unknown or unused placeholder is an error (a template and its caller never drift apart silently). */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  let out = template;
  for (const [name, value] of Object.entries(values)) {
    const before = out;
    out = out.split(`/*__${name}__*/`).join(value).split(`__${name}__`).join(value);
    if (out === before) throw new AnchorError(`template has no placeholder ${name}`);
  }
  const left = out.match(/__[A-Z][A-Z0-9_]*__/);
  if (left) throw new AnchorError(`template placeholder not filled: ${left[0]}`);
  return out;
}

/** One HV scenario per KEY recipe of the train (a recipe with its own ladder step: the save stops right before buying that step's materials). */
export function hvSeedValues(kit: KitTrain): Record<string, string> {
  const P = tagIdentifier(kit.tag);
  const keyed = kit.recipes.filter((r) => r.ladderStep);
  const scenario = (r: KitRecipe, n: number) => ({ id: `${kit.tag}-${r.hvAlias ?? r.id}`, label: `${P}-${n + 1}: ${r.nameJa}${r.ladderStep ? ` (${r.ladderStep.ingredientIds.map((id) => kit.newIngredients.find((i) => i.id === id)?.nameJa ?? id).join("・")}の購入から)` : ""}` });
  return {
    P,
    TAG: kit.tag,
    LABEL: kit.label,
    ISSUE: String(kit.issue),
    SCENARIO_IDS: keyed.map((r, n) => q(scenario(r, n).id)).join(" | "),
    RECIPE_IDS: keyed.map((r) => q(r.id)).join(", "),
    SCENARIOS: keyed.map((r, n) => `  { id: ${q(scenario(r, n).id)}, recipeId: ${q(r.id)}, labelJa: ${q(scenario(r, n).label)}, pitz: ${P}_PITZ },`).join("\n"),
  };
}

export interface E2eFacts {
  readonly nameJa: (ingredientId: string) => string;
  readonly category: (ingredientId: string) => "sauce" | "cheese" | "topping";
  /** Emoji of a sauce without dedicated art (the chip shows it); `null` when it has art. */
  readonly pieceVisual: (ingredientId: string) => string | null;
}

/** The `PLANS` rows of the generated E2E: one end-to-end play per recipe, derived from the spec (no hand-written step). */
export function e2eValues(kit: KitTrain, facts: E2eFacts): Record<string, string> {
  const chip = (id: string) => `/${facts.nameJa(id).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}/`;
  const keyed = kit.recipes.filter((r) => r.ladderStep);
  const plans = keyed.map((r, n) => {
    const step = r.ladderStep!.ingredientIds;
    const sauces = r.requiredIngredients.filter((x) => facts.category(x.ingredientId) === "sauce");
    const pieces = r.requiredIngredients.filter((x) => facts.category(x.ingredientId) !== "sauce");
    // The cooking tabs only move forward (チーズ, then 具材), so the cheeses are placed first whatever the recipe's own order is.
    const preBake = pieces.filter((x) => x.applicationPhase !== "POST_BAKE");
    const pre = [...preBake.filter((x) => facts.category(x.ingredientId) === "cheese"), ...preBake.filter((x) => facts.category(x.ingredientId) !== "cheese")];
    const post = pieces.filter((x) => x.applicationPhase === "POST_BAKE");
    // A later key recipe of the same train stays undiscovered: its step's materials are not owned yet.
    const notYet = keyed.slice(n + 1).map((x) => x.id);
    return [
      "  {",
      `    id: ${q(r.id)}, name: ${q(r.nameJa)}, tag: ${q(`${kit.tag}-${r.hvAlias ?? r.id}`)},`,
      `    materials: [${step.map((id) => `[${q(id)}, ${q(facts.nameJa(id))}]`).join(", ")}], cohortKey: ${q(facts.nameJa(step.at(-1)!))},`,
      `    sauces: [${sauces.map((x) => `{ chip: ${chip(x.ingredientId)} }`).join(", ")}],`,
      `    notYet: [${notYet.map(q).join(", ")}], bake: { start: ${r.bakeTarget.start + 2}, end: ${r.bakeTarget.end - 2} },`,
      `    pre: [${pre.map((x) => `{ id: ${q(x.ingredientId)}, chip: ${chip(x.ingredientId)}, tab: ${q(facts.category(x.ingredientId) === "cheese" ? "チーズ" : "具材")} }`).join(", ")}],`,
      `    post: [${post.map((x) => `{ id: ${q(x.ingredientId)}, chip: ${chip(x.ingredientId)} }`).join(", ")}],`,
      "  },",
    ].join("\n");
  });
  const usedPieces = [...new Set(keyed.flatMap((r) => r.requiredIngredients.map((x) => x.ingredientId)).filter((id) => facts.category(id) !== "sauce"))];
  return {
    LABEL: kit.label,
    ISSUE: String(kit.issue),
    TRAIN: kit.train,
    DEDICATED: usedPieces.filter((id) => facts.pieceVisual(id)).map((id) => `${q(id)}: ${q(facts.pieceVisual(id)!)}`).join(", "),
    PLANS: plans.join("\n"),
  };
}
