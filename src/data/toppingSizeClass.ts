/**
 * Topping Size Classes 1.0 (Issue #479), slice S1: PURE DATA. Each scatter ingredient gets exactly one of five relative
 * size classes (extra small .. extra large), derived from its id. Nothing reads this yet: no component, stylesheet, CUT
 * geometry, scoring, save or recipe code imports it, so every ingredient is still drawn at its current size. The
 * rendering slices (S2+) are separate Owner-gated work.
 *
 * - The class is a property of the ingredient id, never stored (`PlacedTopping`, saves and canonical state carry no size).
 * - Sauces are `spread`, not scattered pieces, so they have no class.
 * - Cheese keeps its current per-id base sizes; how a class multiplies them is an S2 decision (Owner Decision 4).
 * - The multipliers below are COMPARISON CANDIDATES only (Owner Decision 5): neither set is the spec, and there is
 *   deliberately no single "the" scale constant. The Owner picks after a representative-pizza comparison.
 * - Source of the table: the Phase 0 audit in Issue #479 (boundary ids basil / egg / bacon / black-olive approved by the
 *   Owner; pineapple moved from large to medium).
 */
import { LATE_TOPPING_SIZE_CLASS, lateCatalogEnabled } from "./lateCatalog";

export type ToppingSizeClass = "xs" | "s" | "m" | "l" | "xl";

/** Smallest to largest. */
export const TOPPING_SIZE_CLASSES: readonly ToppingSizeClass[] = ["xs", "s", "m", "l", "xl"];

/** The class an id with no table entry gets: the reference band (multiplier 1 in every candidate set). */
export const DEFAULT_TOPPING_SIZE_CLASS: ToppingSizeClass = "m";

/** Every scatter ingredient id -> its class. A new scatter ingredient must be added here (the coverage test fails until it is). */
const BASE_TOPPING_SIZE_CLASS_BY_ID: Readonly<Record<string, ToppingSizeClass>> = {
  // extra small: grains, chopped herbs, grated cheese
  corn: "xs",
  capers: "xs",
  "pine-nuts": "xs",
  oregano: "xs",
  rosemary: "xs",
  parsley: "xs",
  "grana-padano": "xs",
  mint: "xs",
  shiso: "xs",
  "green-onion": "xs",
  "paprika-powder": "xs",
  // small
  "black-olive": "s",
  "cherry-tomato": "s",
  garlic: "s",
  onion: "s",
  almond: "s",
  jalapeno: "s",
  "baked-beans": "s",
  clam: "s",
  anchovy: "s",
  parmigiano: "s",
  "cashew-cheese": "s",
  // medium: the reference band
  mushroom: "m",
  pepperoni: "m",
  salami: "m",
  "fresh-tomato": "m",
  sausage: "m",
  ham: "m",
  chicken: "m",
  pork: "m",
  shrimp: "m",
  tuna: "m",
  "bell-pepper": "m",
  "green-pepper": "m",
  zucchini: "m",
  eggplant: "m",
  potato: "m",
  lemon: "m",
  artichoke: "m",
  sauerkraut: "m",
  pineapple: "m",
  gorgonzola: "m",
  lamb: "m",
  beef: "m",
  wurstel: "m",
  pickles: "s",
  whitebait: "s",
  "sweet-potato": "m",
  // large
  mozzarella: "l",
  fontina: "l",
  feta: "l",
  ricotta: "l",
  "cream-cheese": "l",
  catupiry: "l",
  "goat-cheese": "l",
  paneer: "l",
  "swiss-cheese": "l",
  egg: "l",
  bacon: "l",
  "hot-dog": "l",
  avocado: "l",
  "palm-heart": "l",
  "salt-cod": "l",
  salmon: "l",
  sardine: "l",
  // extra large: big leaves and spreading thin slices
  arugula: "xl",
  spinach: "xl",
  friarielli: "xl",
  basil: "xl",
  "prosciutto-crudo": "xl",
};

/** The base table, plus the late-catalog ingredients' classes (./lateCatalog.ts) when that catalog is enabled; otherwise the base table itself. */
export const TOPPING_SIZE_CLASS_BY_ID: Readonly<Record<string, ToppingSizeClass>> = lateCatalogEnabled()
  ? { ...BASE_TOPPING_SIZE_CLASS_BY_ID, ...LATE_TOPPING_SIZE_CLASS }
  : BASE_TOPPING_SIZE_CLASS_BY_ID;

export type ToppingSizeScaleSet = Readonly<Record<ToppingSizeClass, number>>;

/**
 * Multiplier candidates for the S2+ comparison (Owner Decision 5). PROVISIONAL, not a spec.
 * A = the Owner's illustrative values; B = a milder spread (the minimum spacing between pieces is about 25 px and the
 * emoji box is already about 31 px, so the large end of A overlaps heavily).
 */
export const TOPPING_SIZE_SCALE_CANDIDATES = {
  A: { xs: 0.6, s: 0.8, m: 1, l: 1.25, xl: 1.5 },
  B: { xs: 0.7, s: 0.85, m: 1, l: 1.15, xl: 1.3 },
} as const satisfies Record<string, ToppingSizeScaleSet>;

export type ToppingSizeScaleCandidateKey = keyof typeof TOPPING_SIZE_SCALE_CANDIDATES;

/**
 * S2c (Issue #479): the multipliers the on-pizza `--piece-rank-scale` wiring uses in PRODUCTION: the Owner-approved candidate set B
 * (0.7 / 0.85 / 1 / 1.15 / 1.3). The S2a wiring shipped all 1; the S2b-1 comparison (docs/reports/TETO_TOPPING-SIZE-CLASSES_S2B2_Final-Compare.md)
 * led to B. Per-ingredient apparent-size corrections are NOT here: they are an unconfirmed Preview / DEV comparison candidate (C) in
 * ../preview/toppingScalePreview.ts until the Owner confirms them on an iPhone.
 */
export const TOPPING_RANK_SCALE: ToppingSizeScaleSet = TOPPING_SIZE_SCALE_CANDIDATES.B;

/**
 * Ingredients whose on-pizza size ignores the class multiplier (rank scale always 1), in every set. mozzarella: Owner decision (S2c) -- its Canvas
 * box (`CHEESE_RENDER_MODE.sizePx`) and the bake melt are unchanged. Its CLASS stays `l` (the table above is data about the ingredient, not about this exemption).
 */
export const TOPPING_RANK_SCALE_EXEMPT_IDS: readonly string[] = ["mozzarella"];

/**
 * The `--piece-rank-scale` value for a piece of this ingredient on the pizza. `set` defaults to `TOPPING_RANK_SCALE` (production, B); only the
 * Preview / DEV comparison switch (../preview/toppingScalePreview.ts) passes another set. `fit` is an optional per-id multiplier on top of the class
 * value (the Preview-only candidate C); production never passes it. Exempt ids are always 1.
 */
export function toppingRankScale(ingredientId: string, set: ToppingSizeScaleSet = TOPPING_RANK_SCALE, fit?: Readonly<Record<string, number>>): number {
  if (TOPPING_RANK_SCALE_EXEMPT_IDS.includes(ingredientId)) return 1;
  const base = set[toppingSizeClass(ingredientId)];
  const correction = fit !== undefined && Object.hasOwn(fit, ingredientId) ? fit[ingredientId] : 1;
  return Math.round(base * correction * 1000) / 1000;
}

/**
 * The class of an ingredient id. An id with no entry (a sauce, a typo, a future ingredient not yet classified) is
 * `DEFAULT_TOPPING_SIZE_CLASS`, so a lookup never throws and an unknown id never changes size. Own keys only: inherited
 * names such as "constructor" or "__proto__" are not ingredients.
 */
export function toppingSizeClass(ingredientId: string): ToppingSizeClass {
  return Object.hasOwn(TOPPING_SIZE_CLASS_BY_ID, ingredientId)
    ? TOPPING_SIZE_CLASS_BY_ID[ingredientId]
    : DEFAULT_TOPPING_SIZE_CLASS;
}

/** The multiplier a candidate set assigns to an ingredient id (via its class). */
export function toppingSizeScale(ingredientId: string, candidate: ToppingSizeScaleCandidateKey): number {
  return TOPPING_SIZE_SCALE_CANDIDATES[candidate][toppingSizeClass(ingredientId)];
}
