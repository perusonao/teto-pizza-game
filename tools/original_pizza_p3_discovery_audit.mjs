#!/usr/bin/env node
/**
 * Original Pizza Recovery P3 (Discovery Assistance) -- Fresh Audit measurement tooling.
 *
 * Read-only. Loads the production TypeScript modules through Vite's SSR loader (no build, no
 * `src/` change) and writes one JSON with:
 *
 *   1. descriptions: every production recipe description, which of its own ingredient names /
 *      aliases occur verbatim, and which non-name clue words occur (family words, flavour words,
 *      technique words, place / identity words). Used for the masked-description feasibility
 *      verdict (§8 of the report).
 *   2. hint5Ceiling: per Hint 5.0 target, the full-open knowledge (sauce / cheese / key / total /
 *      sub families) and the remaining sub-topping answer space under two player-legitimate
 *      universes: (a) every classified catalog topping of that family, (b) the same restricted to
 *      toppings whose Discovery Ladder step is <= the recipe's key step (what a player who can see a
 *      🎨 slot for it can own). Key topping and fixed ingredients are removed from the pools.
 *   3. searchCost: expected / worst cooks to finish a recipe after full Hint 5.0, under
 *      S0 brute force (Notebook dedup only), S1 legitimate exclusion + P2 single-candidate probing
 *      (the P3 design ceiling), for today's pools and for synthetic 62 / 172-scale pool sizes.
 *   4. p2Probe: for k remaining sub-toppings, which P2 class a one-ingredient probe produces when
 *      the probed ingredient is / is not in the recipe (computed with the real classifyNearMiss on
 *      synthetic catalogs), i.e. where the P2 distance classes stop discriminating.
 *
 * Nothing here decides a design value; it only measures.
 *
 * Usage: node tools/original_pizza_p3_discovery_audit.mjs [--out PATH]
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath =
  outArg > -1
    ? resolve(process.argv[outArg + 1])
    : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DISCOVERY-ASSISTANCE_Audit.json");

const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const load = (p) => server.ssrLoadModule(resolve(root, p));
  const { RECIPES } = await load("src/data/recipes.ts");
  const { INGREDIENTS, getIngredient } = await load("src/data/ingredients.ts");
  const { ingredientAttributeFamily, TAXONOMY_INGREDIENT_IDS } = await load("src/data/ingredientTaxonomy.ts");
  const { buildHint5Ladder, subToppingClass } = await load("src/logic/discovery/hint5Ladder.ts");
  const { recipeKeyStep, recipeChapter } = await load("src/state/recipeChapters.ts");
  const { materialLadderStep } = await load("src/logic/materialShop.ts");
  const { DISCOVERY_LADDER } = await load("src/data/discoveryLadder.ts");
  const { classifyNearMiss } = await load("src/logic/discovery/nearMiss.ts");
  const { signatureOfPizza } = await load("src/logic/discovery/signature.ts");
  const { RECIPE_DISCOVERY_CATALOG } = await load("src/data/discoveryCatalog.ts");
  let aliases = {};
  try {
    const mod = await load("src/data/ingredientSearchAliases.ts");
    aliases = mod.INGREDIENT_SEARCH_ALIASES ?? mod.default ?? {};
  } catch {
    aliases = {};
  }

  // ---------------------------------------------------------------- 1. descriptions
  // Clue lexicon. Hand-authored for this audit; every hit is reported verbatim so a reader can
  // check it. The classes follow the request: ingredient-specific adjective / category clue /
  // technique clue / recipe identity clue.
  const CLUES = {
    family: ["肉", "ミート", "魚介", "海の幸", "海", "きのこ", "キノコ", "野菜", "ハーブ", "スパイス", "果物", "フルーツ", "チーズ"],
    flavour: ["香り", "香ば", "爽やか", "さわやか", "甘", "辛", "ピリ", "塩気", "旨", "うま", "コク", "濃厚", "まろやか", "ジューシー", "クリーミー", "酸味", "ほろ苦"],
    technique: ["ソースなし", "ソースを使わない", "白い", "ビアンカ", "トマトソースを使わ", "オイル", "焼き", "生地", "耳", "薄", "厚"],
    identity: ["ナポリ", "ローマ", "イタリア", "アメリカ", "ハワイ", "ブラジル", "ポルトガル", "アルゼンチン", "ニューヘイブン", "ニューヨーク", "シカゴ", "ドイツ", "朝食", "朝ごはん", "定番", "王道", "伝統", "名物", "娼婦", "漁師", "船乗り", "鉄血", "宰相", "子ども", "子供", "4種", "四種"],
  };
  const aliasList = (id) => {
    const a = aliases[id];
    return Array.isArray(a) ? a : [];
  };
  const descriptions = RECIPES.map((recipe) => {
    const ids = [...new Set(recipe.requiredIngredients.map((r) => r.ingredientId))];
    const nameHits = [];
    for (const id of ids) {
      const ing = getIngredient(id);
      const names = [ing?.nameJa, ...aliasList(id)].filter(Boolean);
      const hit = names.filter((n) => recipe.description.includes(n));
      nameHits.push({ id, nameJa: ing?.nameJa ?? null, category: ing?.category ?? null, family: ingredientAttributeFamily(id), inDescription: hit });
    }
    // names of OTHER catalog ingredients that occur (a masked description must not mislead either)
    const otherNames = INGREDIENTS.filter((i) => !ids.includes(i.id) && i.nameJa && recipe.description.includes(i.nameJa)).map((i) => i.nameJa);
    const clues = Object.fromEntries(Object.entries(CLUES).map(([k, words]) => [k, words.filter((w) => recipe.description.includes(w))]));
    const recipeNameInDescription = recipe.description.includes(recipe.nameJa);
    const named = nameHits.filter((h) => h.inDescription.length > 0).length;
    return {
      recipeId: recipe.id,
      nameJa: recipe.nameJa,
      description: recipe.description,
      chars: [...recipe.description].length,
      distinctIngredients: ids.length,
      ingredientsNamed: named,
      ingredients: nameHits,
      otherCatalogNamesInDescription: otherNames,
      recipeNameInDescription,
      clues,
    };
  });
  const descSummary = {
    recipes: descriptions.length,
    namingAtLeastOneIngredient: descriptions.filter((d) => d.ingredientsNamed > 0).length,
    namingAllIngredients: descriptions.filter((d) => d.ingredientsNamed === d.distinctIngredients).length,
    withFamilyClue: descriptions.filter((d) => d.clues.family.length > 0).length,
    withFlavourClue: descriptions.filter((d) => d.clues.flavour.length > 0).length,
    withTechniqueClue: descriptions.filter((d) => d.clues.technique.length > 0).length,
    withIdentityClue: descriptions.filter((d) => d.clues.identity.length > 0).length,
    withRecipeNameInside: descriptions.filter((d) => d.recipeNameInDescription).length,
    withAnyNonNameClue: descriptions.filter((d) => Object.values(d.clues).some((v) => v.length > 0)).length,
  };

  // ---------------------------------------------------------------- 2. Hint 5.0 ceiling
  const toppings = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
  const classified = toppings.filter((id) => subToppingClass(id) !== null);
  const stepOf = (id) => (getIngredient(id)?.unlockCondition ? materialLadderStep(id, DISCOVERY_LADDER) : 0);
  const choose = (n, k) => {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
    return Math.round(r);
  };
  const pools = (family, exclude, maxStep) =>
    classified.filter((id) => subToppingClass(id) === family && !exclude.has(id) && (maxStep === null || (stepOf(id) ?? Infinity) <= maxStep));

  const ceiling = [];
  for (const recipe of RECIPES) {
    const ladder = buildHint5Ladder(recipe.id);
    if (!ladder) {
      ceiling.push({ recipeId: recipe.id, target: false });
      continue;
    }
    const fixed = new Set(ladder.rungs.filter((r) => r.kind !== "SUB_CLASS").flatMap((r) => r.subjectIds));
    const subs = ladder.rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => r.subjectIds[0]);
    const byFamily = {};
    for (const id of subs) {
      const f = subToppingClass(id);
      (byFamily[f] ??= []).push(id);
    }
    const keyStep = recipeKeyStep(recipe);
    const universe = (maxStep) =>
      Object.entries(byFamily).map(([family, members]) => {
        const pool = pools(family, fixed, maxStep);
        return { family, k: members.length, pool: pool.length, combinations: choose(pool.length, members.length) };
      });
    const all = universe(null);
    const owned = universe(keyStep);
    const product = (u) => u.reduce((acc, f) => acc * f.combinations, 1);
    ceiling.push({
      recipeId: recipe.id,
      target: true,
      chapter: recipeChapter(recipe),
      keyStep,
      sauce: ladder.rungs[0].subjectIds,
      cheese: ladder.rungs[1].subjectIds,
      key: ladder.rungs[2].subjectIds,
      total: ladder.total,
      subCount: subs.length,
      subFamilies: subs.map((id) => subToppingClass(id)),
      familyPoolsAllClassified: all,
      familyPoolsLadderReachable: owned,
      answerSpaceAllClassified: product(all),
      answerSpaceLadderReachable: product(owned),
      exactBySetLogicAlone: owned.every((f) => f.pool === f.k),
    });
  }

  // ---------------------------------------------------------------- 3. search cost
  // Cooks needed after full Hint 5.0 to reach the recipe's composition.
  //  S0: brute force with Notebook dedup -> expected (N+1)/2, worst N (N = answer space).
  //  S1: per-ingredient membership probing with P2 (only valid under single-candidate
  //      attribution, §10/§11 of the report): each family of pool P holding k members needs, in the
  //      worst case, P-1 probes (the last one is deduced by count) and in expectation the mean
  //      position at which the k-th member (or the last non-member) is resolved; +1 final cook.
  //      Modelled exactly by enumerating every arrangement for small P, Monte Carlo otherwise.
  function expectedProbes(P, k) {
    if (k === 0 || k === P) return { expected: 0, worst: 0 };
    // Probing in a uniformly random order; the family is resolved at the first t where every
    // member or every non-member has been probed (the rest follow by count). For t < P:
    // P(resolved by t) = C(t,k)/C(P,k) + C(t,P-k)/C(P,k) (the two events cannot both hold before P).
    const total = choose(P, k);
    let e = 0;
    let prev = 0;
    for (let t = 1; t <= P; t += 1) {
      const by = t >= P ? 1 : Math.min(1, (choose(t, k) + choose(t, P - k)) / total);
      e += t * (by - prev);
      prev = by;
    }
    return { expected: Math.round(e * 100) / 100, worst: P - 1 };
  }
  const costFor = (familyPools) => {
    const N = familyPools.reduce((a, f) => a * f.combinations, 1);
    const s1 = familyPools.reduce(
      (acc, f) => {
        const p = expectedProbes(f.pool, f.k);
        return { expected: acc.expected + p.expected, worst: acc.worst + p.worst };
      },
      { expected: 0, worst: 0 },
    );
    return {
      answerSpace: N,
      S0_bruteForce: { expected: (N + 1) / 2, worst: N },
      // A probe can itself be the exact composition, so S1 is never worse than S0 (min).
      S1_exclusionProbing: {
        expected: Math.min((N + 1) / 2, Math.round((s1.expected + 1) * 100) / 100),
        worst: Math.min(N, s1.worst + 1),
      },
    };
  };
  const productionCost = ceiling
    .filter((c) => c.target)
    .map((c) => ({ recipeId: c.recipeId, subCount: c.subCount, allClassified: costFor(c.familyPoolsAllClassified), ladderReachable: costFor(c.familyPoolsLadderReachable) }));
  const synthetic = [];
  for (const P of [4, 8, 12, 20, 40]) {
    for (const k of [1, 2, 3, 4]) {
      if (k >= P) continue;
      synthetic.push({ pool: P, k, ...costFor([{ family: "x", k, pool: P, combinations: choose(P, k) }]) });
    }
  }
  // Two families, e.g. "vegetable ×2 + meat ×1" at 62 / 172-ish pool sizes
  const mixed = [
    { label: "veg(8)x2 + meat(4)x1 (today-ish)", pools: [[8, 2], [4, 1]] },
    { label: "veg(15)x2 + meat(10)x1 (62-scale)", pools: [[15, 2], [10, 1]] },
    { label: "veg(30)x2 + meat(20)x1 + herb(12)x1 (172-scale)", pools: [[30, 2], [20, 1], [12, 1]] },
  ].map(({ label, pools: ps }) => ({ label, ...costFor(ps.map(([P, k]) => ({ family: "x", k, pool: P, combinations: choose(P, k) }))) }));

  // ---------------------------------------------------------------- 4. P2 probe discrimination
  // A synthetic recipe: sauce S, cheese C, key K, and k sub-toppings from a pool. The player places
  // S + C + K + { one probed topping }. Which P2 class results when the probe is / is not a member?
  // Real classifyNearMiss, one discoverable recipe (single-candidate attribution).
  const probeRows = [];
  const pizzaOf = (sauce, pieces) => ({
    sauceIds: sauce ? [sauce] : [],
    toppings: pieces.map((ingredientId, i) => ({ id: `p${i}`, ingredientId, x: 0, y: 0 })),
  });
  const fakeRecipe = (id, items) => ({ id, requiredIngredients: items.map((ingredientId) => ({ ingredientId, minCount: 1 })) });
  for (let k = 1; k <= 5; k += 1) {
    const subs = Array.from({ length: k }, (_, i) => `sub-${i}`);
    const items = ["sauce-s", "cheese-c", "key-k", ...subs].sort();
    const catalog = [{ recipeId: "r", items, sauceBase: ["sauce-s"] }];
    const recipe = fakeRecipe("r", items);
    const classOf = (pieces) => {
      let sig;
      try {
        sig = signatureOfPizza({ ...emptyPizza(), ...pizzaOf("sauce-s", pieces) });
      } catch {
        sig = null;
      }
      if (!sig) return "n/a";
      const nm = classifyNearMiss(sig, [recipe], { catalog, recipes: [recipe] });
      return nm === null ? "EXACT(discovery)" : nm.kind;
    };
    probeRows.push({
      k,
      probeMember: classOf(["cheese-c", "key-k", "sub-0"]),
      probeNonMember: classOf(["cheese-c", "key-k", "decoy"]),
      leaveOneOut_allOthersRight: classOf(["cheese-c", "key-k", ...subs.slice(1)]),
      swapOne_oneWrong: classOf(["cheese-c", "key-k", ...subs.slice(1), "decoy"]),
    });
  }
  function emptyPizza() {
    return { sauceIds: [], toppings: [] };
  }

  // ---------------------------------------------------------------- catalog facts
  const catalogFacts = {
    ingredients: INGREDIENTS.length,
    toppings: toppings.length,
    classifiedToppings: classified.length,
    unclassifiedToppings: toppings.filter((id) => subToppingClass(id) === null),
    taxonomyRows: TAXONOMY_INGREDIENT_IDS.length,
    familyPoolSizes: Object.fromEntries(
      ["meat", "seafood", "vegetable", "herb", "spice", "fruit", "other"].map((f) => [f, classified.filter((id) => subToppingClass(id) === f).length]),
    ),
    recipes: RECIPES.length,
    discoveryTargets: RECIPE_DISCOVERY_CATALOG.length,
    targetsPerRecipeMax: Math.max(...RECIPES.map((r) => RECIPE_DISCOVERY_CATALOG.filter((t) => t.recipeId === r.id).length)),
    identityCollisionGroups: (() => {
      const m = new Map();
      for (const t of RECIPE_DISCOVERY_CATALOG) {
        const key = JSON.stringify([[...t.items].sort(), [...(t.sauceBase ?? [])].sort()]);
        m.set(key, [...(m.get(key) ?? []), t.recipeId]);
      }
      return [...m.values()].filter((v) => v.length > 1);
    })(),
    hint5Targets: ceiling.filter((c) => c.target).length,
  };

  const out = {
    tool: "tools/original_pizza_p3_discovery_audit.mjs",
    note: "Read-only measurement for the P3 Discovery Assistance Fresh Audit. No design value is decided here.",
    catalogFacts,
    descriptions: { summary: descSummary, rows: descriptions },
    hint5Ceiling: ceiling,
    searchCost: { production: productionCost, syntheticSingleFamily: synthetic, syntheticMixed: mixed },
    p2Probe: probeRows,
  };
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ outPath, catalogFacts, descSummary, p2Probe: probeRows }, null, 2));
} finally {
  await server.close();
}
