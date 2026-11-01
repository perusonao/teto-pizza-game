import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENTS } from "../data/ingredients";
import { LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS, lateCatalogEnabled } from "../data/lateCatalog";
import { ordinaryLadderSteps } from "../logic/catalog/testSupport/lateIds";
import { appendLadderSteps } from "../logic/discoveryLadder";
import { ladderSave } from "../logic/catalog/testSupport/catalogDerived";
import { resolveShopEntitlement } from "./materialEntitlement";
import type { DexEntry } from "./dex";

const ROE = "salmon-roe";
const YUZU_KOSHO = "yuzu-kosho";
const MISO_SAUCE = "miso-sauce";
const WHITE_SESAME = "white-sesame";
const LATE_MATERIALS = [ROE, YUZU_KOSHO, MISO_SAUCE, WHITE_SESAME];
const dexOf = (ids: readonly string[]): DexEntry[] => ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 }));
/** A save as an E5-era player holds it before ever launching the E5 build: the ledger has no late material yet. */
const staleSave = (count: number) => {
  const raw = ladderSave(count);
  return {
    dex: dexOf(raw.dex.map((e) => e.recipeId)),
    owned: raw.ownedIngredientIds.filter((i) => !LATE_MATERIALS.includes(i)),
    ledger: raw.unlockedForShopIngredientIds.filter((i) => !LATE_MATERIALS.includes(i)),
  };
};
/** The ordinary ladder length when the late materials shipped (E5 / New Sauces U1-U3): the floors below were fixed against it. Expansion Batch 10 PR-1 later appended steps 57-61, which is the shape `withOrdinary` models. */
const SHIPPED_ORDINARY_STEPS = 56;
/** The ordinary ladder as it was when the late materials shipped (the first 56 ordinary steps), with `k` more ordinary steps before the late one (the shape a later ordinary batch gives it). */
const withOrdinary = (k: number) => {
  const ordinary = ordinaryLadderSteps(DISCOVERY_LADDER.steps).slice(0, SHIPPED_ORDINARY_STEPS);
  const extra = Array.from({ length: k }, (_, i) => ({ ingredientIds: [`future-material-${i}`], keyRecipeId: `future-recipe-${i}` }));
  return appendLadderSteps({ ...DISCOVERY_LADDER, steps: ordinary }, [...extra, ...LATE_LADDER_STEPS]);
};

describe("late material compatibility floor (E5 follow-up)", () => {
  it("the floor table names only late materials the catalog sells, and never later than the step number the ladder derives today", () => {
    expect(lateCatalogEnabled()).toBe(true);
    for (const [id, floor] of Object.entries(LATE_ENTITLEMENT_FLOORS)) {
      expect(INGREDIENTS.some((i) => i.id === id)).toBe(true);
      expect(LATE_LADDER_STEPS.some((s) => s.ingredientIds.includes(id))).toBe(true);
      const derived = DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;
      expect(floor).toBeLessThanOrEqual(derived);
    }
  });

  it.each([0, 1, 2, 3])("a never-launched save at the E5-era step gets the late material with %i ordinary steps added after E5", (k) => {
    const s = staleSave(57);
    const ladder = withOrdinary(k);
    expect(ladder.steps.find((x) => x.ingredientIds.includes(ROE))!.step).toBe(57 + k);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, ladder);
    expect(r.unlockedForShopIngredientIds).toContain(ROE);
    expect(r.newlyUnlockedMaterialIds).toContain(ROE); // announced once, like any ladder unlock
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger); // existing ledger order untouched
  });

  it("below the floor nothing is granted early", () => {
    const s = staleSave(56);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, withOrdinary(2));
    expect(r.unlockedForShopIngredientIds).not.toContain(ROE);
  });

  it("a second resolve announces nothing and returns the ledger by reference (idempotent, never re-locks)", () => {
    const s = staleSave(57);
    const first = resolveShopEntitlement(s.dex, s.owned, s.ledger, withOrdinary(1));
    const second = resolveShopEntitlement(s.dex, s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(second.newlyUnlockedMaterialIds).toEqual([]);
    expect(second.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
    // a smaller Dex later does not take it back
    const fewer = resolveShopEntitlement(dexOf([]), s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(fewer.unlockedForShopIngredientIds).toContain(ROE);
  });

  it("a save that already holds the material (ledger, or owned) is unchanged", () => {
    const raw = ladderSave(57);
    const dex = dexOf(raw.dex.map((e) => e.recipeId));
    const held = resolveShopEntitlement(dex, raw.ownedIngredientIds, raw.unlockedForShopIngredientIds, withOrdinary(1));
    expect(held.unlockedForShopIngredientIds.filter((i) => i === ROE)).toHaveLength(1);
    const s = staleSave(57);
    const owned = resolveShopEntitlement(s.dex, [...s.owned, ROE], s.ledger, withOrdinary(1));
    expect(owned.unlockedForShopIngredientIds.filter((i) => i === ROE)).toHaveLength(1);
  });

  it("a ladder that does not sell the material (late catalog OFF shape) is untouched", () => {
    const off = { ...DISCOVERY_LADDER, steps: DISCOVERY_LADDER.steps.filter((s) => !s.ingredientIds.includes(ROE)) };
    const s = staleSave(57);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, off);
    expect(r.unlockedForShopIngredientIds).not.toContain(ROE);
  });

  it("an id this build does not know stays in the ledger", () => {
    const s = staleSave(57);
    const r = resolveShopEntitlement(s.dex, s.owned, [...s.ledger, "material-from-a-newer-build"], withOrdinary(1));
    expect(r.unlockedForShopIngredientIds).toContain("material-from-a-newer-build");
    expect(r.unlockedForShopIngredientIds).toContain(ROE);
  });
});

describe("late material compatibility floor: yuzu-kosho (New Sauces Phase B U1)", () => {
  it.each([0, 1, 2, 3])("a never-launched save at the step it shipped at gets yuzu-kosho (and the roe) with %i ordinary steps added later", (k) => {
    const s = staleSave(58);
    const ladder = withOrdinary(k);
    expect(ladder.steps.find((x) => x.ingredientIds.includes(YUZU_KOSHO))!.step).toBe(58 + k);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, ladder);
    expect(r.unlockedForShopIngredientIds).toEqual(expect.arrayContaining([ROE, YUZU_KOSHO]));
    expect(r.newlyUnlockedMaterialIds).toEqual(expect.arrayContaining([ROE, YUZU_KOSHO]));
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger);
  });

  it("each material has its own floor: count 57 gets the roe only, count 56 neither", () => {
    const at57 = staleSave(57);
    const r57 = resolveShopEntitlement(at57.dex, at57.owned, at57.ledger, withOrdinary(2));
    expect(r57.unlockedForShopIngredientIds).toContain(ROE);
    expect(r57.unlockedForShopIngredientIds).not.toContain(YUZU_KOSHO);
    const at56 = staleSave(56);
    const r56 = resolveShopEntitlement(at56.dex, at56.owned, at56.ledger, withOrdinary(2));
    expect(r56.unlockedForShopIngredientIds).not.toEqual(expect.arrayContaining([ROE]));
    expect(r56.unlockedForShopIngredientIds).not.toContain(YUZU_KOSHO);
  });

  it("a save that already holds the sauce (ledger or owned) is unchanged, and a second resolve announces nothing", () => {
    const raw = ladderSave(58);
    const dex = dexOf(raw.dex.map((e) => e.recipeId));
    const held = resolveShopEntitlement(dex, raw.ownedIngredientIds, raw.unlockedForShopIngredientIds, withOrdinary(1));
    expect(held.unlockedForShopIngredientIds.filter((i) => i === YUZU_KOSHO)).toHaveLength(1);
    const s = staleSave(58);
    const first = resolveShopEntitlement(s.dex, [...s.owned, YUZU_KOSHO], s.ledger, withOrdinary(1));
    expect(first.unlockedForShopIngredientIds.filter((i) => i === YUZU_KOSHO)).toHaveLength(1);
    const second = resolveShopEntitlement(s.dex, s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(second.newlyUnlockedMaterialIds).toEqual([]);
    expect(second.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
  });
});


describe("late material compatibility floor: miso-sauce + white-sesame (New Sauces Phase B U2)", () => {
  it("the dengaku step derives ordinary + 3 today (the ordinary steps + roe, yuzu, dengaku; 56 + 3 = 59 when they shipped); the floors are the FIXED 59 for both materials and the earlier floors are unchanged", () => {
    const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;
    const ordinary = ordinaryLadderSteps(DISCOVERY_LADDER.steps).length;
    expect([stepOf(ROE), stepOf(YUZU_KOSHO), stepOf(MISO_SAUCE), stepOf(WHITE_SESAME)]).toEqual([ordinary + 1, ordinary + 2, ordinary + 3, ordinary + 3]);
    expect(LATE_ENTITLEMENT_FLOORS).toMatchObject({ [ROE]: 57, [YUZU_KOSHO]: 58, [MISO_SAUCE]: 59, [WHITE_SESAME]: 59 }); // (New Sauces Phase B U3: tahini / pomegranate are fixed at 60 on top of these)
  });

  it.each([0, 1, 2, 3])("a never-launched save at the step they shipped at gets all four late materials with %i ordinary steps added later", (k) => {
    const s = staleSave(59);
    const ladder = withOrdinary(k);
    expect(ladder.steps.find((x) => x.ingredientIds.includes(MISO_SAUCE))!.step).toBe(59 + k);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, ladder);
    expect(r.unlockedForShopIngredientIds).toEqual(expect.arrayContaining([ROE, YUZU_KOSHO, MISO_SAUCE, WHITE_SESAME]));
    expect(r.newlyUnlockedMaterialIds).toEqual(expect.arrayContaining([MISO_SAUCE, WHITE_SESAME]));
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger); // the ledger only grows
  });

  it("each floor is its own: count 58 gets the roe and yuzu-kosho but not the dengaku materials, 57 the roe only, 56 none", () => {
    const at58 = staleSave(58);
    const r58 = resolveShopEntitlement(at58.dex, at58.owned, at58.ledger, withOrdinary(2));
    expect(r58.unlockedForShopIngredientIds).toEqual(expect.arrayContaining([ROE, YUZU_KOSHO]));
    expect(r58.unlockedForShopIngredientIds).not.toContain(MISO_SAUCE);
    expect(r58.unlockedForShopIngredientIds).not.toContain(WHITE_SESAME);
    const at57 = staleSave(57);
    const r57 = resolveShopEntitlement(at57.dex, at57.owned, at57.ledger, withOrdinary(2));
    expect(r57.unlockedForShopIngredientIds).toContain(ROE);
    for (const id of [YUZU_KOSHO, MISO_SAUCE, WHITE_SESAME]) expect(r57.unlockedForShopIngredientIds).not.toContain(id);
    const at56 = staleSave(56);
    const r56 = resolveShopEntitlement(at56.dex, at56.owned, at56.ledger, withOrdinary(2));
    for (const id of LATE_MATERIALS) expect(r56.unlockedForShopIngredientIds).not.toContain(id);
  });

  it("a save that already holds a material (ledger or owned) is unchanged, a second resolve announces nothing and returns the ledger by reference (idempotent), and an unknown id stays", () => {
    const raw = ladderSave(59);
    const dex = dexOf(raw.dex.map((e) => e.recipeId));
    const held = resolveShopEntitlement(dex, raw.ownedIngredientIds, raw.unlockedForShopIngredientIds, withOrdinary(1));
    for (const id of [MISO_SAUCE, WHITE_SESAME]) expect(held.unlockedForShopIngredientIds.filter((i) => i === id)).toHaveLength(1);
    const s = staleSave(59);
    const first = resolveShopEntitlement(s.dex, [...s.owned, MISO_SAUCE], [...s.ledger, "from-a-newer-build"], withOrdinary(1));
    expect(first.unlockedForShopIngredientIds.filter((i) => i === MISO_SAUCE)).toHaveLength(1);
    expect(first.unlockedForShopIngredientIds).toContain("from-a-newer-build");
    const second = resolveShopEntitlement(s.dex, s.owned, first.unlockedForShopIngredientIds, withOrdinary(1));
    expect(second.newlyUnlockedMaterialIds).toEqual([]);
    expect(second.unlockedForShopIngredientIds).toBe(first.unlockedForShopIngredientIds);
  });
});

/**
 * Expansion Batch 10 PR-1 appended ordinary steps 57-61, so the production ladder derives the roe at step 62 (yuzu 63, dengaku 64, tahini 65). The floors are FIXED at their
 * shipped values, so a stale save that predates the late catalog keeps every late material while the new ordinary steps add to what it can discover.
 */
describe("late material compatibility floor against the production ladder (Expansion Batch 10 PR-1: +5 ordinary steps; B11 S1: +2 more)", () => {
  const ordinary = () => ordinaryLadderSteps(DISCOVERY_LADDER.steps).length;
  const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes(id))!.step;

  it("the late steps now derive from the longer ordinary ladder, and the floors stay at their shipped numbers", () => {
    expect(ordinary()).toBe(SHIPPED_ORDINARY_STEPS + 9); // B10 PR-1 appended 57-61, B11 S1 appended 62-63, Expansion Batch 12 appended 64, Expansion Batch 13 appended 65
    expect(stepOf(ROE)).toBe(66);
    expect(stepOf("tahini")).toBe(69);
    expect(LATE_ENTITLEMENT_FLOORS).toEqual({ "salmon-roe": 57, "yuzu-kosho": 58, "miso-sauce": 59, "white-sesame": 59, tahini: 60, pomegranate: 60, "bbq-sauce": 66, cilantro: 66, "soy-sauce": 67, wasabi: 67, "cod-roe": 68, "fresh-cream-sauce": 68, nori: 68 }); // PR-2 late4: 67 / 68; BBQ Chicken (#611) shipped after Batch 10: 61 ordinary + 5 late = 66
  });

  it.each([
    [57, [ROE]],
    [58, [ROE, YUZU_KOSHO]],
    [59, [ROE, YUZU_KOSHO, MISO_SAUCE, WHITE_SESAME]],
  ])("a never-launched save at count %i keeps its late materials on the production ladder, and never loses a ledger entry", (count, expected) => {
    const s = staleSave(count);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, DISCOVERY_LADDER);
    for (const id of expected) expect(r.unlockedForShopIngredientIds).toContain(id);
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger); // existing ledger order untouched
  });

  it("a save below every floor is granted no late material early", () => {
    const s = staleSave(56);
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, DISCOVERY_LADDER);
    for (const id of LATE_MATERIALS) expect(r.unlockedForShopIngredientIds).not.toContain(id);
  });
});

/**
 * B11 S1 (PROVISIONAL SPEC) appended ordinary steps 62-63, so the BBQ / wasabi / tarako late materials now derive at 68 / 69 / 70 while their FIXED floors stay 66 / 67 / 68: a save that reached those counts before B11 S1
 * (and has not launched since) still gets them, and a save one discovery below the floor does not. The floors are not changed by B11 S1.
 */
describe("late floors after Expansion Batch 13 (BBQ 66, wasabi 67, tarako 68 against the derived 70 / 71 / 72; Expansion Batch 12 derived 69 / 70 / 71; B11 S1 derived 68 / 69 / 70)", () => {
  const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((st) => st.ingredientIds.includes(id))!.step;

  it("derived numbers moved +4 (B11 S1 +2, Expansion Batch 12 +1, Expansion Batch 13 +1) and the floors did not", () => {
    expect([stepOf("bbq-sauce"), stepOf("wasabi"), stepOf("nori")]).toEqual([70, 71, 72]);
    expect([LATE_ENTITLEMENT_FLOORS["bbq-sauce"], LATE_ENTITLEMENT_FLOORS.wasabi, LATE_ENTITLEMENT_FLOORS.nori]).toEqual([66, 67, 68]);
  });

  it.each([
    [66, ["bbq-sauce", "cilantro"], ["wasabi", "soy-sauce", "nori"]],
    [67, ["bbq-sauce", "cilantro", "wasabi", "soy-sauce"], ["nori", "cod-roe", "fresh-cream-sauce"]],
    [68, ["bbq-sauce", "cilantro", "wasabi", "soy-sauce", "nori", "cod-roe", "fresh-cream-sauce"], []],
  ])("a never-launched save at count %i keeps the late materials its floor grants, and none above it", (count, granted, notGranted) => {
    const raw = ladderSave(count);
    const everyLate = LATE_LADDER_STEPS.flatMap((st) => st.ingredientIds); // a save from before ANY late material was in its ledger
    const s = { dex: dexOf(raw.dex.map((e) => e.recipeId)), owned: raw.ownedIngredientIds.filter((i) => !everyLate.includes(i)), ledger: raw.unlockedForShopIngredientIds.filter((i) => !everyLate.includes(i)) };
    const r = resolveShopEntitlement(s.dex, s.owned, s.ledger, DISCOVERY_LADDER);
    for (const id of granted) expect(r.unlockedForShopIngredientIds, id).toContain(id);
    for (const id of notGranted) expect(r.unlockedForShopIngredientIds, id).not.toContain(id);
    expect(r.unlockedForShopIngredientIds.slice(0, s.ledger.length)).toEqual(s.ledger);
  });
});
