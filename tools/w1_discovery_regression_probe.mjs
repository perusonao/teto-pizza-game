// Progression 2.0 W1 Content Evidence Resolution -- read-only discovery regression probe.
//
// Runs the PRODUCTION discovery matcher (src/logic/discovery/matcher.ts + signature.ts) against
// the production discovery catalog extended with the W1 candidate targets supplied on stdin.
// It imports src/** read-only and never writes anywhere; output is JSON on stdout.
//
// Invoked by tools/progression2_w1_evidence_resolution.py:
//   node --experimental-strip-types --no-warnings \
//        --import ./tools/lib/register_ts_loader.mjs tools/w1_discovery_regression_probe.mjs < in.json
//
// stdin: {"w1": [{"id": "...", "ingredients": ["..."], "sauce": "..."}], "extraIngredientCategories": {"id": "sauce|cheese|topping"}}
import { readFileSync } from "node:fs";

const root = new URL("../src/", import.meta.url);
const { RECIPE_DISCOVERY_CATALOG } = await import(new URL("data/discoveryCatalog.ts", root));
const { INGREDIENTS } = await import(new URL("data/ingredients.ts", root));
const { matchDiscovery } = await import(new URL("logic/discovery/matcher.ts", root));
const { signatureOfPizza } = await import(new URL("logic/discovery/signature.ts", root));
const { createEmptyPizza } = await import(new URL("state/pizzaState.ts", root));
const { DEFAULT_IDENTITY_DIMENSIONS } = await import(new URL("logic/discovery/signature.ts", root));

const input = JSON.parse(readFileSync(0, "utf8"));
const category = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i.category]));
Object.assign(category, input.extraIngredientCategories ?? {});

const w1Targets = input.w1.map((r) => ({
  targetId: `w1:${r.id}`,
  recipeId: r.id,
  items: [...new Set(r.ingredients)].sort(),
  sauceBase: [...new Set(r.ingredients.filter((id) => category[id] === "sauce"))].sort(),
  capabilities: [],
  identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
  eligibility: { status: "ELIGIBLE" },
}));
const catalog = [...RECIPE_DISCOVERY_CATALOG, ...w1Targets];

function pizzaOf(ids) {
  const pizza = createEmptyPizza();
  pizza.sauceIds = ids.filter((id) => category[id] === "sauce");
  pizza.toppings = ids
    .filter((id) => category[id] !== "sauce")
    .map((ingredientId, i) => ({ ingredientId, x: 10 + i, y: 10 + i }));
  return pizza;
}

function outcome(ids) {
  const m = matchDiscovery(signatureOfPizza(pizzaOf(ids)), catalog);
  if (m.kind === "UNIQUE_MATCH") return { kind: m.kind, targetId: m.target.targetId };
  if (m.kind === "AMBIGUOUS") return { kind: m.kind, targetIds: m.targetIds };
  return { kind: m.kind };
}

const key = (t) => JSON.stringify([t.items, t.sauceBase ?? null, t.identityDimensions]);
const seen = new Map();
const signatureCollisions = [];
for (const t of catalog) {
  const k = key(t);
  if (seen.has(k)) signatureCollisions.push([seen.get(k), t.targetId]);
  else seen.set(k, t.targetId);
}

const exact = w1Targets.map((t) => ({ targetId: t.targetId, items: t.items, outcome: outcome(t.items) }));

// One-edit neighbourhood: drop one non-sauce item, or add one non-sauce item used anywhere in
// the extended catalog. Only edits that land on a *recipe* (UNIQUE_MATCH/AMBIGUOUS) are reported.
const pool = [...new Set(catalog.flatMap((t) => t.items))].filter((id) => category[id] !== "sauce").sort();
const oneEditAdjacency = [];
for (const t of w1Targets) {
  for (const id of t.items) {
    if (category[id] === "sauce") continue;
    const ids = t.items.filter((x) => x !== id);
    const o = outcome(ids);
    if (o.kind !== "NO_MATCH") oneEditAdjacency.push({ from: t.targetId, edit: `-${id}`, ingredients: [...ids].sort(), outcome: o });
  }
  for (const id of pool) {
    if (t.items.includes(id)) continue;
    const ids = [...t.items, id].sort();
    const o = outcome(ids);
    if (o.kind !== "NO_MATCH") oneEditAdjacency.push({ from: t.targetId, edit: `+${id}`, ingredients: ids, outcome: o });
  }
}

// Production-recipe edits that land on a W1 target (reverse direction).
const reverseAdjacency = [];
for (const t of RECIPE_DISCOVERY_CATALOG) {
  for (const id of pool) {
    if (t.items.includes(id)) continue;
    const ids = [...t.items, id].sort();
    const o = outcome(ids);
    if (o.kind === "UNIQUE_MATCH" && o.targetId.startsWith("w1:")) reverseAdjacency.push({ from: t.targetId, edit: `+${id}`, ingredients: ids, outcome: o });
  }
}

const extraScenarios = (input.extraScenarios ?? []).map((s) => ({ ...s, outcome: outcome(s.ingredients) }));

process.stdout.write(
  JSON.stringify(
    {
      productionIngredients: INGREDIENTS.map((i) => ({ id: i.id, category: i.category, emoji: i.emoji, color: i.color, nameJa: i.nameJa })),
      productionTargets: RECIPE_DISCOVERY_CATALOG.map((t) => ({ targetId: t.targetId, items: t.items, sauceBase: t.sauceBase })),
      catalogSize: catalog.length,
      signatureCollisions,
      exact,
      oneEditAdjacency,
      reverseAdjacency,
      extraScenarios,
    },
    null,
    1,
  ),
);
