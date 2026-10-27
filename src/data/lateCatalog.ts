/**
 * FIN-E4 foundation (Issue #611 / #294 / #604, Owner decision D-3 = 案 1): the ONE place where late-addition (後乗せ,
 * `applicationPhase: "POST_BAKE"`) content joins the catalog.
 *
 * A late recipe cannot be completed unless the FINISH step runs, and FINISH is OFF in Production. A late recipe that were
 * visible there would be undiscoverable and would stall the ladder, the hint economy and Research (measured: 8 progression
 * walks fail). So late content never enters `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` unless the BUILD-TIME constant
 * below is `true`. With it `false` (Production) every merge below returns its base array ITSELF -- same object, same bytes --
 * and the discovery catalog, Dex / save sanitizers, Shop, Research, hints and inventory (all derived from those three) see
 * exactly the catalog they saw before this file existed.
 *
 * KNOWN LIMIT (decide before E5): the late entries sit AFTER the ordinary ones, so their ladder step numbers (and positions in
 * `RECIPES` / `INGREDIENTS`) are "ordinary length + k" and shift whenever an ordinary batch appends. Production never sees them, but an ON
 * build is not stable across ordinary batches. Before the catalog is switched on, either forbid ordinary batches while it is on, or give
 * late steps a reserved stable range.
 *
 * Production-OFF here means behaviourally identical data; this file does not claim the bundle is byte-identical (the guard and merge calls
 * go through a function, so dead-code removal is not relied on).
 *
 * Content (FIN-E4b-ikura, Issue #621): `ikura-salmon-pizza` and `salmon-roe` below. `RecipeId` therefore includes the late id (types only), and the
 * tables keyed by it carry a row; at runtime every recipe / ingredient / step here exists only when enabled. Switching `LATE_CATALOG_PRODUCTION`
 * on is a separate Owner decision (E5), together with the FINISH production switch (./freeCookFinishGate.ts).
 *
 * Imports are type-only, except `isDoughKind` from ../logic/dough/doughKind (a leaf module with no imports of its own), and the ladder step shape is declared here, structurally identical to `AppendedLadderStep`) so this module can be read by
 * recipes.ts / ingredients.ts / discoveryLadder.ts without a cycle, and without adding an importer of the ladder pure layer
 * (the runtime-wiring boundary test in logic/discoveryLadder.test.ts).
 */
import { isDoughKind, type DoughKind } from "../logic/dough/doughKind";
import { pinsaEnabled } from "./pinsaGate";
import type { Ingredient } from "./ingredients";

/** Build-time switch (Owner D-3 案 1). `false` in Production; a literal so a bundler drops the late branch. */
export const LATE_CATALOG_PRODUCTION = true;

export function lateCatalogEnabled(): boolean {
  return LATE_CATALOG_PRODUCTION;
}

/**
 * The data a late recipe carries. Deliberately NOT `Recipe` (whose `id` is `RecipeId`, itself derived from `RECIPES`, which includes
 * `LATE_RECIPES`): checking `LATE_RECIPES` against `Recipe` would make the type circular. `RECIPES` is typed from the literals below, so a
 * field `Recipe` requires and this shape lacks fails wherever `RECIPES` is consumed as `Recipe`.
 */
interface LateRecipeEntry {
  readonly id: string;
  readonly nameJa: string;
  readonly description: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string; readonly minCount: number; readonly applicationPhase?: "POST_BAKE" }[];
  readonly bakeTarget: { readonly start: number; readonly end: number };
  readonly baseRewardPitz: number;
  readonly lunchRush: false;
  /** P3-a1/a2 (#577): the dough kind the recipe fixes (`Recipe.doughKind`). Absent = standard. Read by `discoveryIdentityOf` and the Guided start. */
  readonly doughKind?: DoughKind;
  /** P3-a2 (#577, Owner D1): `false` = discovering it does not advance the ladder, so it needs no late ladder step (see `validateLateCatalog`). */
  readonly ladderCredit?: false;
}

/** What the guards read from a late recipe (the full `Recipe` is checked by the type system where the data lives). */
export interface LateRecipeShape {
  readonly id: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string; readonly minCount: number; readonly applicationPhase?: "POST_BAKE" }[];
  readonly lunchRush?: boolean;
  /** Checked as `unknown` on purpose: only `false` (or absent) is valid, and the guard must catch anything else a data file could carry. */
  readonly ladderCredit?: unknown;
  readonly doughKind?: unknown;
}

/** A late ladder step; the same shape as `AppendedLadderStep` (../logic/discoveryLadder.ts), which `appendLadderSteps` accepts. */
export interface LateLadderStep {
  readonly ingredientIds: readonly string[];
  readonly starGates?: Readonly<Record<string, number>>;
  readonly keyRecipeId: string;
}

/**
 * Late recipes, in authored order. Each carries at least one `POST_BAKE` requirement and `lunchRush: false`.
 *
 * FIN-E4b-ikura (Issue #621): `ikura-salmon-pizza`. SOURCE AUTHORITY: only the roe and the shiso are post-bake, by their individual
 * PIZZA DB page citations (Owner confirmation on #614 is the source of record). The salmon and the cream cheese are placed BEFORE the bake
 * as a PROVISIONAL game-design default (Owner Q-1) -- NOT confirmed by the original source. The counts (cream-cheese 2 / salmon 3 /
 * salmon-roe 2 / shiso 1) and the bake window 58-78 (= the generic Free Cooking window) are GAMEPLAY CALIBRATION, not source.
 * NO_SAUCE, no CUT, `lunchRush: false`, ladder-credited, T4, no star gate (OD-B8-1).
 */
const ALL_LATE_RECIPES = [
  {
    id: "ikura-salmon-pizza",
    nameJa: "いくらとサーモンのピザ",
    description: "クリームチーズにサーモン、いくらと大葉をあわせた、ぷちぷち華やかな和風の一枚。", // names no moment: the description is shown before the recipe is discovered (Anti-Oracle)
    requiredIngredients: [
      { ingredientId: "cream-cheese", minCount: 2 },
      { ingredientId: "salmon", minCount: 3 },
      { ingredientId: "salmon-roe", minCount: 2, applicationPhase: "POST_BAKE" },
      { ingredientId: "shiso", minCount: 1, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
  // New Sauces Phase B U1 (Issue #578, Owner 2026-10-25): `yuzu-shrimp-pizza`. SOURCE (PIZZA DB `yuzu-shrimp-pizza`, individual page https://pizzadb.jp/pizzas/yuzu-shrimp/, Owner-relayed, NOT independently
  // re-fetched from this environment): thin dough; shrimp (shell and vein removed), yuzu-kosho (used in small amounts), mozzarella, shiso; sauce style "Other". The original recommends adding the shiso as a
  // finishing touch, so the shiso is POST_BAKE. NOT CONFIRMED against the original (Owner OD-U1): how the yuzu-kosho is applied and when; when the shrimp is placed and whether it is pre-cooked. PROVISIONAL
  // GAME-DESIGN SPEC (Owner-approved, not source): yuzu-kosho painted in the SAUCE step (the existing PAINT), shrimp and mozzarella placed BEFORE the bake with no pre-cooking step (the shell / vein removal is not modelled).
  // GAMEPLAY CALIBRATION (not source): yuzu-kosho 1 (PAINT) / mozzarella 2 / shrimp 3 / shiso 1 (POST_BAKE), bake 58-78 (= the generic Free Cooking window, so the median-derived FREE_COOK_BAKE_TARGET stays 58-78).
  // Late catalog (`yuzu-kosho` is a late-only material): ladder-credited (its own late step), no star gate, no CUT, `lunchRush: false`, permanently key-free. The description names no moment (Anti-Oracle: shown before discovery).
  {
    id: "yuzu-shrimp-pizza",
    nameJa: "柚子えびピザ",
    description: "えびとモッツァレラに、柚子胡椒と大葉をあわせた、さわやかな和風の一枚。",
    requiredIngredients: [
      { ingredientId: "yuzu-kosho", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "shrimp", minCount: 3 },
      { ingredientId: "shiso", minCount: 1, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
  // New Sauces Phase B U2 (Issue #578, Owner 2026-10-25): `eggplant-dengaku-pizza` (ナス田楽ピザ). SOURCE (PIZZA DB comparison table p6, Owner-relayed 2026-09-22, NOT independently re-fetched from this
  // environment: pizzadb.jp is unreachable here): thin dough; eggplant, miso-dare (a sweet-salty miso sauce; sauce family 甘辛だれ), mozzarella, white sesame. NOT CONFIRMED against the original (the
  // individual page was not read): how and when the miso-dare is used, whether the eggplant is pre-cooked, when the white sesame is added, the counts and the bake window.
  // GAMEPLAY ASSUMPTION (Owner-approved game design, not source): miso-sauce painted in the SAUCE step (the existing PAINT); mozzarella in the CHEESE step and eggplant in the TOPPING step, both BEFORE the bake with no
  // pre-cooking step (grilling / frying the eggplant is not modelled); the white sesame is sprinkled AFTER the bake in FINISH (POST_BAKE; the finishing garnish of a dengaku).
  // GAMEPLAY CALIBRATION (not source): miso-sauce 1 (PAINT) / mozzarella 2 / eggplant 3 / white-sesame 1 (POST_BAKE), bake 58-78 (= the generic Free Cooking window, so the median-derived FREE_COOK_BAKE_TARGET stays 58-78).
  // Late catalog (`miso-sauce` and `white-sesame` are late-only materials): ladder-credited (its own late step), no star gate, no CUT, `lunchRush: false`, permanently key-free. The description names no moment (Anti-Oracle:
  // it is shown before the recipe is discovered).
  {
    id: "eggplant-dengaku-pizza",
    nameJa: "ナス田楽ピザ",
    description: "ナスとモッツァレラに、甘辛い味噌だれと白ごまをあわせた、和風の一枚。",
    requiredIngredients: [
      { ingredientId: "miso-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "eggplant", minCount: 3 },
      { ingredientId: "white-sesame", minCount: 1, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
  // New Sauces Phase B U3 (Issue #578, Owner 2026-10-26): `eggplant-tahini-pizza` (ナスとタヒニのピザ). SOURCE (PIZZA DB comparison table p5, Owner-relayed 2026-09-22, NOT independently re-fetched from this environment:
  // pizzadb.jp is unreachable here): thin dough; eggplant, tahini (sauce family "Other"), pomegranate, parsley; no cheese is listed. EVERYTHING ELSE IS UNCONFIRMED against the original (T-1..T-7): whether the tahini is
  // painted or drizzled, whether the eggplant is pre-cooked, when the pomegranate and the parsley are added, the counts and the bake window. The individual page was not read.
  // GAMEPLAY ASSUMPTION (Owner-approved game design 2026-10-26, NOT source): tahini painted in the SAUCE step (the existing PAINT; a drizzle after the bake is not supported -- #579); eggplant and parsley placed BEFORE the bake
  // with no pre-cooking step (grilling / frying the eggplant is not modelled); the pomegranate is sprinkled AFTER the bake in FINISH (POST_BAKE; a fresh garnish). No cheese (the CHEESE step is skipped).
  // GAMEPLAY CALIBRATION (not source): tahini 1 (PAINT) / eggplant 3 / parsley 1 / pomegranate 2 (POST_BAKE), bake 58-78 (= the generic Free Cooking window, so the median-derived FREE_COOK_BAKE_TARGET stays 58-78); 6 pieces <= the 8-slot ring, 2 post-bake.
  // Late catalog (`tahini` and `pomegranate` are late-only materials): ladder-credited (its own late step, after the dengaku step), no star gate, no CUT, `lunchRush: false` (Lunch Rush and Dinner exclude FINISH), permanently key-free.
  // The description names no moment (Anti-Oracle: it is shown before the recipe is discovered). Listed before Pinsa so that Pinsa stays the tail while its gate is open.
  {
    id: "eggplant-tahini-pizza",
    nameJa: "ナスとタヒニのピザ",
    description: "ナスにタヒニとパセリ、ザクロをあわせた、中東風の一枚。",
    requiredIngredients: [
      { ingredientId: "tahini", minCount: 1 },
      { ingredientId: "eggplant", minCount: 3 },
      { ingredientId: "parsley", minCount: 1 },
      { ingredientId: "pomegranate", minCount: 2, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
  // Pinsa Romana (#577 P3-b-1, Owner L1 / D4 / R2). Gated by ./pinsaGate.ts (`PINSA_PRODUCTION`): absent at runtime while it is false.
  // SOURCE AUTHORITY (Owner-relayed, not independently verified; PK-0 items 2/4/5 stay open until the Production gate): tomato sauce, mozzarella baked, prosciutto before or after,
  // arugula best added last. The prosciutto is placed BEFORE the bake (L1: a game-design choice, consistent with the source) and only the arugula is POST_BAKE.
  // GAMEPLAY CALIBRATION (D4, provisional -- not source): tomato-sauce 1 / mozzarella 2 / prosciutto-crudo 3 / arugula 2, bake 58-78; 7 non-sauce pieces <= the 8-slot ring, 2 post-bake.
  // `doughKind` + `ladderCredit:false`: a new dough, no new material, so it advances no ladder step (D1/D6). No CUT (M0: round, as the source's oval is not expressed).
  // The description names no moment (Anti-Oracle: it is shown before the recipe is discovered).
  {
    id: "pinsa-romana",
    nameJa: "ピンサ・ロマーナ",
    description: "独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "prosciutto-crudo", minCount: 3 },
      { ingredientId: "arugula", minCount: 2, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
    doughKind: "material-multigrain-long-ferment",
    ladderCredit: false,
  },
] as const satisfies readonly LateRecipeEntry[];

/** Every late recipe id the source declares, whether or not it is active in this build (type-keyed tables carry a row for each). */
export const ALL_LATE_RECIPE_IDS: readonly string[] = ALL_LATE_RECIPES.map((r) => r.id);

/** Ids that exist in the late catalog only while the Pinsa gate is open (./pinsaGate.ts). */
const PINSA_GATED_IDS: ReadonlySet<string> = new Set(["pinsa-romana"]);

/** Keeps the entries that exist in this build. Typed as the input so `RecipeId` (derived from `RECIPES`) stays exhaustive whatever the gate says. */
function activeLate<T extends readonly { readonly id: string }[]>(all: T, idOf: (entry: T[number]) => string = (e) => e.id): T {
  return (pinsaEnabled() ? all : all.filter((e) => !PINSA_GATED_IDS.has(idOf(e)))) as unknown as T;
}

/**
 * Late recipes of this build, in authored order. Each carries at least one `POST_BAKE` requirement and `lunchRush: false`.
 * (FIN-E4b-ikura and Pinsa documented on the entries above; the Pinsa entry is dropped while its gate is closed.)
 */
export const LATE_RECIPES = activeLate(ALL_LATE_RECIPES);

/** The order of each late recipe (the shape of `Order` in ./orders.ts, declared here to stay import-cycle free). */
const ALL_LATE_ORDERS = [
  {
    id: "order-ikura-salmon-pizza",
    recipeId: "ikura-salmon-pizza",
    requestedBy: "mito",
    lineJa: "いくらとサーモンのピザ、ぷちぷちで豪華そう！食べてみたいな！",
  },
  {
    id: "order-yuzu-shrimp-pizza",
    recipeId: "yuzu-shrimp-pizza",
    requestedBy: "mito",
    lineJa: "柚子えびピザ、さわやかそう！食べてみたいな！",
  },
  {
    id: "order-eggplant-dengaku-pizza",
    recipeId: "eggplant-dengaku-pizza",
    requestedBy: "mito",
    lineJa: "ナス田楽ピザ、甘辛そう！食べてみたいな！",
  },
  {
    id: "order-eggplant-tahini-pizza",
    recipeId: "eggplant-tahini-pizza",
    requestedBy: "mito",
    lineJa: "ナスとタヒニのピザ、中東風でおいしそう！食べてみたいな！",
  },
  {
    id: "order-pinsa-romana",
    recipeId: "pinsa-romana",
    requestedBy: "mito",
    lineJa: "ピンサ・ロマーナ、ローマ生まれのピザなんだって！食べてみたいな！",
  },
] as const;
export const LATE_ORDERS = activeLate(ALL_LATE_ORDERS, (o) => o.recipeId);

/**
 * Late-only ingredients (each with an `unlockCondition`: reachable only through a late ladder step).
 * `salmon-roe`: finite ladder material, family `seafood` (OD-B8-2), drawn by the dedicated `salmon-roe-grains` visual; `emoji` is only the
 * required, never-displayed text fallback. Copied from the held PR #584 (which stays untouched).
 */
export const LATE_INGREDIENTS: readonly Ingredient[] = [
  {
    id: "salmon-roe",
    category: "topping",
    nameJa: "いくら",
    color: "#f2842b",
    emoji: "\u{1F7E0}",
    pieceVisual: "salmon-roe-grains",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
  /**
   * New Sauces Phase B U1 (Issue #578): `yuzu-kosho`, a late-only finite ladder material (T4 by its late step, no star gate). A spread sauce painted in the SAUCE step (the existing PAINT);
   * sauces carry no topping family. `color` `#a3ad52` (a muted yellow-olive; the first `#b5c56a` read as a wide yellow-green paste, Owner decision 2026-10-25 after a side-by-side comparison) stays PROVISIONAL until the Owner HV on a real device (a red yuzu-kosho would be near tomato-sauce and is not used).
   * `emoji` is only the tray / shop chip fallback. Its PIZZA DB use (painted before the bake) is a provisional game-design assumption, not confirmed by the original.
   */
  {
    id: "yuzu-kosho",
    category: "sauce",
    nameJa: "柚子胡椒",
    color: "#a3ad52",
    emoji: "\u{1F343}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
  },
  /**
   * New Sauces Phase B U2 (Issue #578): `miso-sauce`, a late-only finite ladder material (T4 by its late step, no star gate). A spread sauce painted in the SAUCE step (the existing PAINT); sauces carry no topping family.
   * `color` `#9a5b2e` (a mid miso brown) is PROVISIONAL until the Owner HV on a real device. `emoji` is only the tray / shop chip fallback (G18 keeps it unique). Its PIZZA DB use (painted before the bake) is a GAMEPLAY ASSUMPTION, not confirmed.
   */
  {
    id: "miso-sauce",
    category: "sauce",
    nameJa: "味噌だれ",
    color: "#9a5b2e",
    emoji: "\u{1F36F}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
  },
  /**
   * New Sauces Phase B U2 (Issue #578): `white-sesame`, a late-only finite ladder material (the same late step as `miso-sauce`; the step's last material = the Research cohort key). Family `spice` (L1 only, Owner 2026-10-25: the
   * "spice / condiment" family), size class `xs`, drawn by the dedicated `sesame-seeds` visual (a few small grains); `emoji` is only the required, never-displayed text fallback (G18 keeps it unique). `color` `#f4efe0` is PROVISIONAL.
   * Placed AFTER the bake (POST_BAKE) is a GAMEPLAY ASSUMPTION, not confirmed.
   */
  {
    id: "white-sesame",
    category: "topping",
    nameJa: "白ごま",
    color: "#f4efe0",
    emoji: "\u{1F35A}",
    pieceVisual: "sesame-seeds",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
  /**
   * New Sauces Phase B U3 (Issue #578): `tahini`, a late-only finite ladder material (T4 by its late step, no star gate; the step's first material). A spread sauce painted in the SAUCE step (the existing PAINT); sauces carry no topping family.
   * `color` `#7b6a58` (a muted grey-taupe) is the Owner-approved colour (2026-10-26, PR #673 HV): the first guess `#dcc7a1` was too close to the dough (and to olive-oil), and `#a58a63` rendered only dE ~17 from the bare dough once the sauce is drawn translucent; `#7b6a58` renders dE ~27-29 (the level of the miso-sauce / olive-oil) while staying distinct in hue from the miso-sauce. See TETO_NEW-SAUCES-U3_FINAL-DESIGN-GATE_2026-10-26.md §6 and the Result report.
   * `emoji` is only the tray / shop chip fallback (G18 keeps it unique). Its PIZZA DB use (painted before the bake) is a GAMEPLAY ASSUMPTION, not confirmed by the original.
   */
  {
    id: "tahini",
    category: "sauce",
    nameJa: "タヒニ",
    color: "#7b6a58",
    emoji: "\u{1F963}",
    placement: "spread",
    unlockCondition: { minTotalStars: 0 },
  },
  /**
   * New Sauces Phase B U3 (Issue #578): `pomegranate`, a late-only finite ladder material (the same late step as `tahini`; the step's last material = the Research cohort key). Family `fruit` (L1 only, Owner 2026-10-25), size class `xs`,
   * drawn by the dedicated `pomegranate-aril` visual (a small heap of ruby arils, candidate A'); `emoji` is only the required, never-displayed text fallback (G18 keeps it unique). `color` `#c4163f` is PROVISIONAL.
   * Placed AFTER the bake (POST_BAKE) is a GAMEPLAY ASSUMPTION, not confirmed.
   */
  {
    id: "pomegranate",
    category: "topping",
    nameJa: "ザクロ",
    color: "#c4163f",
    emoji: "\u{1F7E5}",
    pieceVisual: "pomegranate-aril",
    placement: "scatter",
    unlockCondition: { minTotalStars: 0 },
  },
];

/** Family rows of the late ingredients (OD-B8-2: `salmon-roe` is `seafood`, L1 only). Joined by ./ingredientTaxonomy.ts only when enabled, so an OFF build has no orphan row. */
export const LATE_TAXONOMY_ROWS = [["salmon-roe", "seafood"], ["white-sesame", "spice"], ["pomegranate", "fruit"]] as const;

/** Topping size class of the late ingredients (`salmon-roe` is extra small, like the other fine garnishes). Joined by ./toppingSizeClass.ts only when enabled. */
export const LATE_TOPPING_SIZE_CLASS = { "salmon-roe": "xs", "white-sesame": "xs", "pomegranate": "xs" } as const;

/** Discovery target id (PIZZA DB evidence id) of every late recipe. */
export const LATE_DISCOVERY_TARGET_IDS: Readonly<Record<string, string>> = {
  "ikura-salmon-pizza": "ikura-salmon-pizza-pizzadb-p1",
  "yuzu-shrimp-pizza": "yuzu-shrimp-pizza",
  "eggplant-dengaku-pizza": "eggplant-dengaku-pizza-pizzadb-p6",
  "eggplant-tahini-pizza": "eggplant-tahini-pizza-pizzadb-p5",
  ...(pinsaEnabled() ? { "pinsa-romana": "pinsa-romana-pizzadb-p9" } : {}),
};

/**
 * Late ladder steps, appended AFTER every ordinary appended step, so a late step's number is always "ordinary ladder length + k"
 * and the OFF ladder is a strict prefix of the ON ladder. The step carries NO number (it is derived), and no star gate (OD-B8-1).
 * `ikura-salmon-pizza` also needs step 54's `shiso`, which is an ordinary step and therefore always earlier.
 */
export const LATE_LADDER_STEPS: readonly LateLadderStep[] = [
  { ingredientIds: ["salmon-roe"], keyRecipeId: "ikura-salmon-pizza" },
  // New Sauces Phase B U1 (Issue #578): after the roe step, so its number is derived (ordinary length + 2) and moves with every ordinary batch; key recipe `yuzu-shrimp-pizza` (it also needs mozzarella, shrimp and shiso from earlier ordinary steps).
  { ingredientIds: ["yuzu-kosho"], keyRecipeId: "yuzu-shrimp-pizza" },
  // New Sauces Phase B U2 (Issue #578): after the yuzu step (ordinary length + 3), key recipe `eggplant-dengaku-pizza` (it also needs eggplant and mozzarella from earlier steps / the starters). Cohort key: white-sesame (the last material of the step). The number is DERIVED, never authored.
  { ingredientIds: ["miso-sauce", "white-sesame"], keyRecipeId: "eggplant-dengaku-pizza" },
  // New Sauces Phase B U3 (Issue #578): after the dengaku step (ordinary length + 4), key recipe `eggplant-tahini-pizza` (it also needs eggplant and parsley from earlier ordinary steps). Cohort key: pomegranate (the last material of the step). The number is DERIVED, never authored.
  { ingredientIds: ["tahini", "pomegranate"], keyRecipeId: "eggplant-tahini-pizza" },
];

/**
 * Compatibility floor (Issue #578 U0, Owner OD-U0-7 = M3 / 7b / 7c): a late material's Shop entitlement never needs a LARGER credited-discovery count than the one it had
 * when the late catalog first shipped. Its ladder step number is derived (ordinary length + 1) and moves +1 per ordinary batch; the floor is a FIXED constant, so a
 * save that reached the E5-era step but had not launched since (its ledger has no entry yet) still gets the material. A floor only ever grants earlier; the ledger never re-locks.
 * `salmon-roe`: 57 = the 56 ordinary steps + 1 when E5 shipped. `yuzu-kosho`: 58 = the 56 ordinary steps + 2 when it shipped (New Sauces Phase B U1). `miso-sauce` / `white-sesame`: 59 = the 56 ordinary steps + 3 when they shipped (New Sauces Phase B U2). `tahini` / `pomegranate`: 60 = the 56 ordinary steps + 4 when they shipped (New Sauces Phase B U3). RULE for every future late material: add its row here, with the number the ladder derives at the moment it ships.
 */
export const LATE_ENTITLEMENT_FLOORS: Readonly<Record<string, number>> = { "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, "tahini": 60, "pomegranate": 60 };

/** True for a recipe whose own gate is closed (Pinsa while `PINSA_PRODUCTION` is false): the id is in type-keyed tables but the recipe does not exist in this build. */
export function isGatedOffRecipeId(id: string): boolean {
  return PINSA_GATED_IDS.has(id) && !pinsaEnabled();
}

/** True for a late recipe id in a build where the late catalog is OFF: the id is in type-keyed tables (RecipeId includes it) but the recipe does not exist. */
export function isInactiveLateRecipeId(id: string): boolean {
  if (!ALL_LATE_RECIPES.some((r) => r.id === id)) return false;
  return !lateCatalogEnabled() || !LATE_RECIPES.some((r) => r.id === id);
}

/** `base` followed by `late` when enabled; otherwise `base` itself (not a copy). */
export function mergeLate<B extends readonly unknown[], L extends readonly unknown[]>(base: B, late: L, enabled: boolean): readonly [...B, ...L] {
  return (enabled && late.length > 0 ? [...base, ...late] : base) as unknown as readonly [...B, ...L];
}

export interface LateCatalogInput {
  recipes: readonly LateRecipeShape[];
  ingredients: readonly Pick<Ingredient, "id" | "unlockCondition">[];
  ladderSteps: readonly Pick<LateLadderStep, "ingredientIds" | "keyRecipeId">[];
  discoveryTargetIds: Readonly<Record<string, string>>;
}

/**
 * Structural rules a late catalog must satisfy. Pure; returns the violations (empty = valid). `merge*` callers throw on a
 * non-empty result when the catalog is enabled, so a bad late entry fails the build instead of reaching a player.
 */
export function validateLateCatalog(
  base: { recipeIds: readonly string[]; ingredientIds: readonly string[]; discoveryTargetIds?: readonly string[] },
  late: LateCatalogInput,
): string[] {
  const problems: string[] = [];
  const baseRecipes = new Set(base.recipeIds);
  const baseIngredients = new Set(base.ingredientIds);

  const lateIngredientIdSet = new Set(late.ingredients.map((i) => i.id));
  const lateRecipeIds = new Set<string>();
  for (const recipe of late.recipes) {
    if (baseRecipes.has(recipe.id) || lateRecipeIds.has(recipe.id)) problems.push(`recipe id is not unique: ${recipe.id}`);
    lateRecipeIds.add(recipe.id);
    if (!recipe.requiredIngredients.some((r) => r.applicationPhase === "POST_BAKE")) problems.push(`late recipe has no POST_BAKE requirement: ${recipe.id}`);
    for (const req of recipe.requiredIngredients) {
      if (!baseIngredients.has(req.ingredientId) && !lateIngredientIdSet.has(req.ingredientId)) problems.push(`late recipe ${recipe.id} requires an unknown ingredient: ${req.ingredientId}`);
    }
    if (recipe.lunchRush !== false) problems.push(`late recipe must be lunchRush:false (Lunch Rush and Dinner exclude FINISH): ${recipe.id}`);
    // P3-a2 (#577, Owner D1): only an explicit `ladderCredit: false` is accepted; anything else present (true, "false", 0, null) is a data error, not a way in.
    if (recipe.ladderCredit !== undefined && recipe.ladderCredit !== false) problems.push(`late recipe ladderCredit must be false when present: ${recipe.id}`);
    if (recipe.doughKind !== undefined && !isDoughKind(recipe.doughKind)) problems.push(`late recipe has an unknown doughKind: ${recipe.id}`);
  }
  // A late recipe that does not advance the ladder (Owner D1) is exempt from being the key of a late ladder step -- a step needs a NEW material, and such a
  // recipe adds none. The exemption is data-derived (`ladderCredit: false`), not an id list, and it is paid for by the checks below.
  const uncredited = new Set(late.recipes.filter((r) => r.ladderCredit === false).map((r) => r.id));
  for (const recipe of late.recipes) {
    if (!uncredited.has(recipe.id)) continue;
    // Reachability then comes from the ordinary ladder alone: it may use no material that only a late step can unlock.
    for (const req of recipe.requiredIngredients) {
      if (lateIngredientIdSet.has(req.ingredientId)) problems.push(`late recipe ${recipe.id} is ladderCredit:false but requires a late-only ingredient: ${req.ingredientId}`);
    }
  }

  const lateIngredientIds = new Set<string>();
  for (const ingredient of late.ingredients) {
    if (baseIngredients.has(ingredient.id) || lateIngredientIds.has(ingredient.id)) problems.push(`ingredient id is not unique: ${ingredient.id}`);
    lateIngredientIds.add(ingredient.id);
    // A late ingredient with no unlockCondition would become a Starter and be owned from the start.
    if (!ingredient.unlockCondition) problems.push(`late ingredient needs an unlockCondition (ladder-gated, never a Starter): ${ingredient.id}`);
  }

  const keyed = new Set<string>();
  const stepped = new Set<string>();
  for (const step of late.ladderSteps) {
    if (!lateRecipeIds.has(step.keyRecipeId)) problems.push(`late ladder step key recipe is not a late recipe: ${step.keyRecipeId}`);
    if (uncredited.has(step.keyRecipeId)) problems.push(`a ladderCredit:false late recipe cannot be the key of a late ladder step: ${step.keyRecipeId}`);
    if (keyed.has(step.keyRecipeId)) problems.push(`two late ladder steps share a key recipe: ${step.keyRecipeId}`);
    keyed.add(step.keyRecipeId);
    for (const id of step.ingredientIds) stepped.add(id);
    for (const id of step.ingredientIds) {
      if (!baseIngredients.has(id) && !lateIngredientIds.has(id)) problems.push(`late ladder step names an unknown ingredient: ${id}`);
    }
  }

  // Every late recipe must be reachable (it is the key of a step) and every late ingredient obtainable (named by a step).
  for (const id of lateRecipeIds) {
    if (!keyed.has(id) && !uncredited.has(id)) problems.push(`late recipe is the key of no late ladder step (unreachable): ${id}`);
  }
  for (const id of lateIngredientIds) {
    if (!stepped.has(id)) problems.push(`late ingredient is named by no late ladder step (unobtainable): ${id}`);
  }
  const takenTargetIds = new Set(base.discoveryTargetIds ?? []);
  for (const id of lateRecipeIds) {
    const targetId = late.discoveryTargetIds[id];
    if (!targetId) problems.push(`late recipe has no discovery target id: ${id}`);
    else if (takenTargetIds.has(targetId)) problems.push(`discovery target id is not unique: ${targetId}`);
    else takenTargetIds.add(targetId);
  }
  for (const id of Object.keys(late.discoveryTargetIds)) {
    if (!lateRecipeIds.has(id)) problems.push(`discovery target id for an unknown late recipe: ${id}`);
  }
  return problems;
}

/** Throws when an ENABLED late catalog breaks a rule; a no-op when disabled (the late arrays are not read at all). */
export function assertLateCatalogValid(
  enabled: boolean,
  base: { recipeIds: readonly string[]; ingredientIds: readonly string[]; discoveryTargetIds?: readonly string[] },
  late: LateCatalogInput,
): void {
  if (!enabled) return;
  const problems = validateLateCatalog(base, late);
  if (problems.length > 0) throw new Error(`Invalid late catalog:\n- ${problems.join("\n- ")}`);
}
