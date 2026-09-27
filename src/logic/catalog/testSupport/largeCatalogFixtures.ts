/**
 * Large Catalog UX LC-1b: deterministic scale fixtures. TEST SUPPORT ONLY -- never imported by
 * production code (catalogBoundary.test.ts pins that), and production data is never rewritten.
 *
 * Authority: docs/reports/TETO_LARGE-CATALOG-UX_LC-1_Implementation-Gate.md §5. The populations
 * match tools/large_catalog_ux_scale_model.py (`FIXTURE_INGREDIENT_SPLITS`, `CHAPTER_SIZES`);
 * largeCatalogFixtures.test.ts checks them against the committed model JSON.
 *
 * - `runtime-29x25` is the real catalog (INGREDIENTS / RECIPES / recipeChapter).
 * - Every other fixture is synthetic: ids `fx-<category>-<nnn>`, katakana names, families in the
 *   PR #255 PROPOSED proportions (exact counts at 105 / 179), recipes drawn with the 172-matrix
 *   topping / cheese count distributions. A seeded PRNG makes each fixture identical on every run.
 */
import { INGREDIENTS } from "../../../data/ingredients";
import { ingredientAttributeFamily, type AttributeFamilyId } from "../../../data/ingredientTaxonomy";
import { RECIPES } from "../../../data/recipes";
import { recipeChapter } from "../../../state/recipeChapters";
import { runtimeCatalog } from "../catalogSource";
import type { CatalogCategory, CatalogIngredient } from "../catalogTypes";

export type CategorySplit = Record<CatalogCategory, number>;

export interface FixtureRecipe {
  id: string;
  chapter: number;
  requiredIngredientIds: readonly string[];
}

export interface LargeCatalogFixture {
  id: LargeCatalogFixtureId;
  catalog: readonly CatalogIngredient[];
  recipes: readonly FixtureRecipe[];
  split: CategorySplit;
  chapterSizes: readonly number[];
  /** Starter ingredients never count as missing (runtime: no unlockCondition). */
  starterIds: readonly string[];
}

export const LARGE_CATALOG_FIXTURE_IDS = [
  "runtime-29x25",
  "w2a-37x34",
  "w2a-mixed-37x34",
  "mid-40x34",
  "catalog-62x101",
  "progression-105x101",
  "full-105x172",
  "stress-179x172",
] as const;
export type LargeCatalogFixtureId = (typeof LARGE_CATALOG_FIXTURE_IDS)[number];

/** = tools/large_catalog_ux_scale_model.py FIXTURE_INGREDIENT_SPLITS. */
export const FIXTURE_INGREDIENT_SPLITS: Record<string, CategorySplit> = {
  "29": { sauce: 3, cheese: 4, topping: 22 },
  "37_w2a_worst": { sauce: 3, cheese: 4, topping: 30 },
  "37_w2a_mixed": { sauce: 3, cheese: 7, topping: 27 },
  "40": { sauce: 3, cheese: 7, topping: 30 },
  "62": { sauce: 10, cheese: 10, topping: 42 },
  "105": { sauce: 18, cheese: 16, topping: 71 },
  "179": { sauce: 31, cheese: 25, topping: 123 },
};

/** = tools/large_catalog_ux_scale_model.py CHAPTER_SIZES. */
export const CHAPTER_SIZES: Record<number, readonly number[]> = {
  25: [6, 9, 10],
  34: [6, 9, 19],
  101: [23, 37, 30, 11],
  172: [39, 63, 51, 19],
};

/** PR #255 PROPOSED topping family counts (105 / 179); other sizes are apportioned from the 105 shares. */
const FAMILY_COUNTS_105: Record<AttributeFamilyId, number> = {
  vegetable: 24, meat: 13, seafood: 11, herb: 8, other: 7, spice: 5, fruit: 3,
};
const FAMILY_COUNTS_179: Record<AttributeFamilyId, number> = {
  vegetable: 40, meat: 20, other: 17, seafood: 15, spice: 12, fruit: 11, herb: 8,
};
const FAMILY_ORDER: readonly AttributeFamilyId[] = ["meat", "seafood", "vegetable", "fruit", "herb", "spice", "other"];

/** 172-matrix distributions (count -> recipes). */
const TOPPING_COUNT_DISTRIBUTION: readonly [number, number][] = [
  [0, 5], [1, 30], [2, 50], [3, 62], [4, 19], [5, 5], [6, 1],
];
const CHEESE_COUNT_DISTRIBUTION: readonly [number, number][] = [[0, 31], [1, 122], [2, 17], [3, 1], [4, 1]];
/** 44 sauceless of 172 (matrix `sauceBaseStatus.none`); the rest use one sauce. */
const SAUCE_COUNT_DISTRIBUTION: readonly [number, number][] = [[0, 44], [1, 128]];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Largest-remainder apportionment of `total` over `weights` (ties by key order). */
export function apportion<K extends string | number>(weights: readonly [K, number][], total: number): [K, number][] {
  const sum = weights.reduce((s, [, w]) => s + w, 0);
  const raw = weights.map(([k, w]) => [k, (w / sum) * total] as const);
  const out = raw.map(([k, v]) => [k, Math.floor(v)] as [K, number]);
  let left = total - out.reduce((s, [, n]) => s + n, 0);
  const order = raw
    .map(([, v], i) => [i, v - Math.floor(v)] as const)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [i] of order) {
    if (left <= 0) break;
    out[i][1] += 1;
    left -= 1;
  }
  return out;
}

function familyCountsFor(toppings: number): Record<AttributeFamilyId, number> {
  if (toppings === 105 - 34) return FAMILY_COUNTS_105;
  if (toppings === 179 - 56) return FAMILY_COUNTS_179;
  const shares = FAMILY_ORDER.map((f) => [f, FAMILY_COUNTS_105[f]] as [AttributeFamilyId, number]);
  return Object.fromEntries(apportion(shares, toppings)) as Record<AttributeFamilyId, number>;
}

const CATEGORY_LABEL: Record<CatalogCategory, string> = { sauce: "ソース", cheese: "チーズ", topping: "グザイ" };

export function syntheticCatalog(split: CategorySplit, seed: number): CatalogIngredient[] {
  const rand = mulberry32(seed);
  const out: CatalogIngredient[] = [];
  for (const category of ["sauce", "cheese", "topping"] as const) {
    const n = split[category];
    let families: (AttributeFamilyId | null)[] = new Array(n).fill(null);
    if (category === "topping") {
      const counts = familyCountsFor(n);
      families = shuffle(FAMILY_ORDER.flatMap((f) => new Array(counts[f]).fill(f)), rand);
    }
    for (let i = 0; i < n; i++) {
      const no = String(i + 1).padStart(3, "0");
      out.push({
        id: `fx-${category}-${no}`,
        category,
        nameJa: `テスト${CATEGORY_LABEL[category]}${no}`,
        family: families[i],
        catalogIndex: out.length,
      });
    }
  }
  return out;
}

function countsFor(distribution: readonly [number, number][], total: number, rand: () => number): number[] {
  const counts = apportion(distribution, total).flatMap(([count, n]) => new Array(n).fill(count) as number[]);
  return shuffle(counts, rand);
}

function pick(pool: readonly CatalogIngredient[], n: number, rand: () => number): string[] {
  return shuffle([...pool], rand).slice(0, Math.min(n, pool.length)).map((i) => i.id);
}

export function syntheticRecipes(
  catalog: readonly CatalogIngredient[],
  chapterSizes: readonly number[],
  seed: number,
): FixtureRecipe[] {
  const rand = mulberry32(seed);
  const total = chapterSizes.reduce((s, n) => s + n, 0);
  const pools = {
    sauce: catalog.filter((i) => i.category === "sauce"),
    cheese: catalog.filter((i) => i.category === "cheese"),
    topping: catalog.filter((i) => i.category === "topping"),
  };
  const sauces = countsFor(SAUCE_COUNT_DISTRIBUTION, total, rand);
  const cheeses = countsFor(CHEESE_COUNT_DISTRIBUTION, total, rand);
  const toppings = countsFor(TOPPING_COUNT_DISTRIBUTION, total, rand);
  const out: FixtureRecipe[] = [];
  let index = 0;
  chapterSizes.forEach((size, c) => {
    for (let k = 0; k < size; k++, index++) {
      out.push({
        id: `fx-recipe-${String(index + 1).padStart(3, "0")}`,
        chapter: c + 1,
        requiredIngredientIds: [
          ...pick(pools.sauce, sauces[index], rand),
          ...pick(pools.cheese, cheeses[index], rand),
          ...pick(pools.topping, Math.max(1, toppings[index]), rand),
        ],
      });
    }
  });
  return out;
}

function runtimeFixture(): LargeCatalogFixture {
  const catalog = runtimeCatalog(ingredientAttributeFamily);
  const split: CategorySplit = { sauce: 0, cheese: 0, topping: 0 };
  for (const item of catalog) split[item.category] += 1;
  const recipes = RECIPES.map((recipe) => ({
    id: recipe.id,
    chapter: recipeChapter(recipe),
    requiredIngredientIds: recipe.requiredIngredients.map((r) => r.ingredientId),
  }));
  const sizes = new Map<number, number>();
  for (const r of recipes) sizes.set(r.chapter, (sizes.get(r.chapter) ?? 0) + 1);
  return {
    id: "runtime-29x25",
    catalog,
    recipes,
    split,
    chapterSizes: [...sizes.entries()].sort(([a], [b]) => a - b).map(([, n]) => n),
    starterIds: INGREDIENTS.filter((i) => !i.unlockCondition).map((i) => i.id),
  };
}

const SYNTHETIC: Record<Exclude<LargeCatalogFixtureId, "runtime-29x25">, { split: string; recipes: number; seed: number }> = {
  "w2a-37x34": { split: "37_w2a_worst", recipes: 34, seed: 3734 },
  "w2a-mixed-37x34": { split: "37_w2a_mixed", recipes: 34, seed: 3735 },
  "mid-40x34": { split: "40", recipes: 34, seed: 4034 },
  "catalog-62x101": { split: "62", recipes: 101, seed: 62101 },
  "progression-105x101": { split: "105", recipes: 101, seed: 105101 },
  "full-105x172": { split: "105", recipes: 172, seed: 105172 },
  "stress-179x172": { split: "179", recipes: 172, seed: 179172 },
};

const cache = new Map<LargeCatalogFixtureId, LargeCatalogFixture>();

export function largeCatalogFixture(id: LargeCatalogFixtureId): LargeCatalogFixture {
  const hit = cache.get(id);
  if (hit) return hit;
  let fixture: LargeCatalogFixture;
  if (id === "runtime-29x25") {
    fixture = runtimeFixture();
  } else {
    const spec = SYNTHETIC[id];
    const split = FIXTURE_INGREDIENT_SPLITS[spec.split];
    const catalog = syntheticCatalog(split, spec.seed);
    const chapterSizes = CHAPTER_SIZES[spec.recipes];
    // The first sauce / cheese / topping play the onboarding starters' role.
    const starterIds = (["sauce", "cheese", "topping"] as const).map((c) => `fx-${c}-001`);
    fixture = { id, catalog, recipes: syntheticRecipes(catalog, chapterSizes, spec.seed + 1), split, chapterSizes, starterIds };
  }
  cache.set(id, fixture);
  return fixture;
}

/** Deterministic stock for fixture tests: starters unlimited, others 0..9 by seed. */
export function fixtureStock(fixture: LargeCatalogFixture, seed = 7): (id: string) => number | "UNLIMITED" {
  const rand = mulberry32(seed);
  const stock = new Map(fixture.catalog.map((i) => [i.id, Math.floor(rand() * 10)] as const));
  const starters = new Set(fixture.starterIds);
  return (id) => (starters.has(id) ? "UNLIMITED" : (stock.get(id) ?? 0));
}
