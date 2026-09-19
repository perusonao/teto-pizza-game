import { describe, expect, it } from "vitest";
import {
  clampPagerIndex,
  pagerIndicatorKind,
  PAGER_DOT_INDICATOR_MAX,
  recipeCardState,
} from "./pizzaSelect";
import { getRecipe } from "../data/recipes";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import type { QualityStars } from "../logic/scoring";

const margherita = getRecipe("margherita")!;
const funghi = getRecipe("funghi")!;
const bismarck = getRecipe("bismarck")!;
const quattroFormaggi = getRecipe("quattro-formaggi")!;
const fugazza = getRecipe("fugazza")!;

/** Builds a Dex where `recipeIds` are discovered at `stars` each -- a shorthand for
 *  simulating "played through the Chapter 1 chain up to here." */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

const CHAIN_TO_BISMARCK = ["margherita", "funghi", "marinara"];
const CHAIN_TO_FUGAZZA = [
  "margherita",
  "funghi",
  "marinara",
  "bismarck",
  "genovese",
  "quattro-formaggi",
];

describe("recipeCardState (Issue #39 Pizza Select, extended by Economy & Progression 1.0 EP1)", () => {
  it("margherita is NEW on a fresh save (always unlocked, empty Dex)", () => {
    const card = recipeCardState(margherita, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(card).toEqual({ kind: "NEW", recipe: margherita });
  });

  it("is LOCKED (not mystery) when the recipe's own unlockCondition isn't yet satisfied (funghi, fresh save)", () => {
    const card = recipeCardState(funghi, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
    if (card.kind !== "LOCKED") return;
    expect(card.mystery).toBe(false);
  });

  it("is LOCKED when the recipe's required ingredients aren't all owned, even once its unlockCondition is satisfied (fugazza needs onion)", () => {
    const dex = dexDiscovering(CHAIN_TO_FUGAZZA, 5 as QualityStars);
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
  });

  it("is NEW when available but not yet discovered (bismarck, once its chain is discovered)", () => {
    const dex = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    const card = recipeCardState(bismarck, dex, STARTER_INGREDIENT_IDS);
    expect(card).toEqual({ kind: "NEW", recipe: bismarck });
  });

  it("is COMPLETED with bestStars/bestScore once discovered", () => {
    const chained = dexDiscovering(CHAIN_TO_BISMARCK, 1 as QualityStars);
    const dex: DexState = registerScoreToDex(chained, "bismarck", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 91.5,
      stars: 5 as QualityStars,
    }).dex;
    const card = recipeCardState(bismarck, dex, STARTER_INGREDIENT_IDS);
    expect(card).toEqual({ kind: "COMPLETED", recipe: bismarck, bestStars: 5, bestScore: 91.5 });
  });

  it("becomes NEW instead of LOCKED once both the unlockCondition and onion ownership hold (fugazza)", () => {
    const dex = dexDiscovering(CHAIN_TO_FUGAZZA, 5 as QualityStars);
    const card = recipeCardState(fugazza, dex, [...STARTER_INGREDIENT_IDS, "onion"]);
    expect(card).toEqual({ kind: "NEW", recipe: fugazza });
  });

  it("a chain-locked card (#2-#6) carries an unlock hint naming the still-missing prerequisite recipe, never a mystery hint", () => {
    const card = recipeCardState(funghi, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected funghi to be LOCKED");
    expect(card.mystery).toBe(false);
    expect(card.unlockHint).toBe("マルゲリータを1枚完成させると解禁");
  });

  it("a stars-gated card whose chain is already satisfied (quattro-formaggi) shows a star-progress hint instead", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      1 as QualityStars,
    );
    const card = recipeCardState(quattroFormaggi, dex, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected quattro-formaggi to be LOCKED");
    expect(card.mystery).toBe(false);
    expect(card.unlockHint).toBe("あと★3で解禁");
  });

  it("fugazza stays mystery-locked (？？？) and its hint is only a star-progress line, never the recipe/ingredient name", () => {
    const card = recipeCardState(fugazza, EMPTY_DEX, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected fugazza to be LOCKED");
    expect(card.mystery).toBe(true);
    expect(card.unlockHint).toBe("あと★12で解禁");
    expect(card.unlockHint).not.toContain("たまねぎ");
    expect(card.unlockHint).not.toContain("フガッサ");
  });

  it("fugazza's hint counts down as totalStars grows toward its 12-star gate", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      2 as QualityStars,
    );
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    if (card.kind !== "LOCKED") throw new Error("Expected fugazza to be LOCKED");
    expect(card.unlockHint).toBe("あと★2で解禁");
  });

  it("LOCKED takes precedence over any stale Dex entry for an unavailable recipe", () => {
    // Defensive: a recipe should never render COMPLETED/NEW once it's unavailable (whichever
    // axis blocks it), even if a Dex entry exists from before (not a real save-shape today, but
    // the selector must not assume Dex and availability can never disagree).
    const dex: DexState = registerScoreToDex(EMPTY_DEX, "fugazza", {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: 80,
      stars: 4 as QualityStars,
    }).dex;
    const card = recipeCardState(fugazza, dex, STARTER_INGREDIENT_IDS);
    expect(card.kind).toBe("LOCKED");
  });
});

describe("clampPagerIndex (Issue #88 UX-4 pager)", () => {
  it("passes through an in-range index unchanged", () => {
    expect(clampPagerIndex(3, 7)).toBe(3);
    expect(clampPagerIndex(0, 7)).toBe(0);
    expect(clampPagerIndex(6, 7)).toBe(6);
  });

  it("clamps below zero up to 0 (never wraps to the last index)", () => {
    expect(clampPagerIndex(-1, 7)).toBe(0);
    expect(clampPagerIndex(-100, 7)).toBe(0);
  });

  it("clamps past the end down to the last valid index (never wraps to 0)", () => {
    expect(clampPagerIndex(7, 7)).toBe(6);
    expect(clampPagerIndex(999, 7)).toBe(6);
  });

  it("degenerately clamps to 0 for an empty collection", () => {
    expect(clampPagerIndex(0, 0)).toBe(0);
    expect(clampPagerIndex(5, 0)).toBe(0);
  });

  it("scales unchanged to a much larger collection (53/100/160-recipe future)", () => {
    expect(clampPagerIndex(52, 53)).toBe(52);
    expect(clampPagerIndex(53, 53)).toBe(52);
    expect(clampPagerIndex(159, 160)).toBe(159);
    expect(clampPagerIndex(160, 160)).toBe(159);
  });
});

describe("pagerIndicatorKind (Issue #88 UX-4 pager, never a 53-dot row)", () => {
  it("uses dots at/under the max (today's 7 production recipes included)", () => {
    expect(pagerIndicatorKind(1)).toBe("dots");
    expect(pagerIndicatorKind(7)).toBe("dots");
    expect(pagerIndicatorKind(PAGER_DOT_INDICATOR_MAX)).toBe("dots");
  });

  it("switches to a numeric counter once past the max -- never a 53-entry dot row", () => {
    expect(pagerIndicatorKind(PAGER_DOT_INDICATOR_MAX + 1)).toBe("counter");
    expect(pagerIndicatorKind(53)).toBe("counter");
    expect(pagerIndicatorKind(100)).toBe("counter");
    expect(pagerIndicatorKind(160)).toBe("counter");
  });
});
