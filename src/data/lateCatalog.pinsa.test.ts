import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { PINSA_ROMANA_BATCH } from "../logic/catalog/testSupport/recipeBatchManifest";

/**
 * Pinsa Romana P3-b (#577): the REAL Pinsa content with its own gate (`PINSA_PRODUCTION`, ./pinsaGate.ts) mocked ON, against the real OFF modules. The late catalog
 * itself stays ON, as in Production since E5. What is pinned: the data and its validators (b-1), the L1 judgement table on the real catalog (b-2), the Research
 * cohort letter and the named-exception manifest (Q7, b-3), and the technique / privacy surface (D3, b-4). The OFF state is in ./pinsaGate.test.ts.
 */
const PINSA = "pinsa-romana";
const JAMON = "jamon-serrano-pizza";
const IKURA = "ikura-salmon-pizza";
const DOUGH = "material-multigrain-long-ferment";

async function load(pinsa: boolean) {
  vi.resetModules();
  vi.doMock("./pinsaGate", () => ({ PINSA_PRODUCTION: pinsa, pinsaEnabled: () => pinsa }));
  // Sequential on purpose: concurrent imports would run the mock factory twice.
  await import("./pinsaGate");
  const late = await import("./lateCatalog");
  const recipes = await import("./recipes");
  const ingredients = await import("./ingredients");
  const ladder = await import("./discoveryLadder");
  const catalog = await import("./discoveryCatalog");
  const orders = await import("./orders");
  const matcher = await import("../logic/discovery/matcher");
  const signature = await import("../logic/discovery/signature");
  const reference = await import("./referencePizza");
  const research = await import("../logic/discovery/researchEntry");
  const hint = await import("../logic/discovery/hint5Ladder");
  const techniques = await import("../logic/techniques/detection");
  const dexView = await import("../logic/techniques/dexView");
  const doughSwitch = await import("../logic/techniques/doughSwitch");
  const chapters = await import("../state/recipeChapters");
  const dinner = await import("../mission/dinner/dinnerMission");
  const validator = await import("../logic/catalog/testSupport/recipeBatchValidator");
  const profiles = await import("./recipeSauceProfiles");
  const cooking = await import("./cookingProfiles");
  return { late, recipes, ingredients, ladder, catalog, orders, matcher, signature, reference, research, hint, techniques, dexView, doughSwitch, chapters, dinner, validator, profiles, cooking };
}

afterEach(() => {
  vi.doUnmock("./pinsaGate");
  vi.resetModules();
});

function pizzaOf(opts: { dough?: boolean; pre: readonly string[]; post: readonly string[]; tray?: boolean }): PizzaState {
  const piece = (ingredientId: string, i: number, stage?: "post") => ({ id: `${stage ?? "pre"}${i}`, ingredientId, x: 30 + i * 4, y: 50, ...(stage ? { stage } : {}) });
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [...opts.pre.map((id, i) => piece(id, i)), ...opts.post.map((id, i) => piece(id, i + 20, "post" as const))],
    bakeResult: 70,
    ...(opts.dough ? { dough: DOUGH } : {}),
    ...(opts.tray ? { pan: "tray" as const } : {}),
  } as PizzaState;
}
const MOZ2 = ["mozzarella", "mozzarella"];
const PRO3 = ["prosciutto-crudo", "prosciutto-crudo", "prosciutto-crudo"];
const ARU2 = ["arugula", "arugula"];

describe("b-1: the data (gate ON)", () => {
  it("adds exactly pinsa-romana after ikura; every other recipe, ingredient, order and ladder step is unchanged (D2: jamon's data is untouched)", async () => {
    const off = await load(false);
    const on = await load(true);
    expect(on.recipes.RECIPES.map((r) => r.id)).toEqual([...off.recipes.RECIPES.map((r) => r.id), PINSA]);
    expect(JSON.stringify(on.recipes.RECIPES.slice(0, off.recipes.RECIPES.length))).toBe(JSON.stringify(off.recipes.RECIPES));
    expect(JSON.stringify(on.ingredients.INGREDIENTS)).toBe(JSON.stringify(off.ingredients.INGREDIENTS)); // no new material
    expect(JSON.stringify(on.ladder.DISCOVERY_LADDER)).toBe(JSON.stringify(off.ladder.DISCOVERY_LADDER)); // D6: Pinsa has no late step, the ladder does not grow
    expect(on.orders.ORDERS.map((o) => o.recipeId)).toEqual([...off.orders.ORDERS.map((o) => o.recipeId), PINSA]);
    const jamonOf = (c: typeof off.catalog) => JSON.stringify(c.RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === JAMON));
    expect(jamonOf(on.catalog)).toBe(jamonOf(off.catalog));
    expect(on.late.LATE_LADDER_STEPS).toEqual(off.late.LATE_LADDER_STEPS);
  });

  it("is the Owner-decided recipe: name, description, 4 ingredients (only arugula POST_BAKE), provisional counts, bake 58-78, dough kind, no ladder credit, no Lunch Rush, no CUT", async () => {
    const on = await load(true);
    const r = on.recipes.getRecipe(PINSA as never) as unknown as Record<string, unknown> & { requiredIngredients: readonly { ingredientId: string; minCount: number; applicationPhase?: string }[] };
    expect(r.nameJa).toBe("ピンサ・ロマーナ");
    expect(r.description).toBe("独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。");
    expect(r.requiredIngredients).toEqual([
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "mozzarella", minCount: 2 },
      { ingredientId: "prosciutto-crudo", minCount: 3 },
      { ingredientId: "arugula", minCount: 2, applicationPhase: "POST_BAKE" },
    ]);
    expect(r.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(r.doughKind).toBe(DOUGH);
    expect(r.ladderCredit).toBe(false);
    expect(r.lunchRush).toBe(false);
    expect(on.recipes.countsTowardLadder(PINSA)).toBe(false);
    expect(on.recipes.participatesInLunchRush(PINSA)).toBe(false);
    expect(on.cooking.isCutEligible(PINSA as never)).toBe(false);
    expect(on.cooking.getCookingProfile(PINSA as never).steps).toContain("FINISH");
    // the description names no moment and no technique (it is shown before the recipe is discovered)
    expect(`${r.nameJa}${r.description}`).not.toMatch(/後乗せ|焼き上|焼成|あと|のせる|仕上/);
  });

  it("the late-catalog validator passes on the real data, and fires on each break (mutations)", async () => {
    const on = await load(true);
    const { late } = on;
    const base = {
      recipeIds: on.recipes.RECIPES.filter((r) => !late.LATE_RECIPES.some((l) => l.id === r.id)).map((r) => r.id as string), // the ordinary catalog (the late recipes are the ones under test)
      ingredientIds: on.ingredients.INGREDIENTS.filter((i) => !late.LATE_INGREDIENTS.some((l) => l.id === i.id)).map((i) => i.id),
      discoveryTargetIds: Object.values(on.catalog.RECIPE_DISCOVERY_TARGET_IDS),
    };
    const input = { recipes: late.LATE_RECIPES, ingredients: late.LATE_INGREDIENTS, ladderSteps: late.LATE_LADDER_STEPS, discoveryTargetIds: late.LATE_DISCOVERY_TARGET_IDS };
    expect(late.validateLateCatalog(base, input)).toEqual([]);
    const pinsa = late.LATE_RECIPES.find((r) => r.id === PINSA)!;
    const swap = (recipe: unknown) => ({ ...input, recipes: input.recipes.map((r) => (r.id === PINSA ? (recipe as typeof r) : r)) });
    const { ladderCredit: _l, ...withoutCredit } = pinsa;
    expect(late.validateLateCatalog(base, swap(withoutCredit))).toContain(`late recipe is the key of no late ladder step (unreachable): ${PINSA}`);
    expect(late.validateLateCatalog(base, swap({ ...pinsa, requiredIngredients: pinsa.requiredIngredients.map((q) => ({ ingredientId: q.ingredientId, minCount: q.minCount })) }))).toContain(`late recipe has no POST_BAKE requirement: ${PINSA}`);
    expect(late.validateLateCatalog(base, swap({ ...pinsa, ladderCredit: true }))).toContain(`late recipe ladderCredit must be false when present: ${PINSA}`);
    expect(late.validateLateCatalog(base, swap({ ...pinsa, doughKind: "pinsa" }))).toContain(`late recipe has an unknown doughKind: ${PINSA}`);
    expect(late.validateLateCatalog(base, swap({ ...pinsa, lunchRush: true }))).toContain(`late recipe must be lunchRush:false (Lunch Rush and Dinner exclude FINISH): ${PINSA}`);
    expect(late.validateLateCatalog(base, { ...input, discoveryTargetIds: { [IKURA]: "ikura-salmon-pizza-pizzadb-p1" } })).toContain(`late recipe has no discovery target id: ${PINSA}`);
    expect(late.validateLateCatalog(base, { ...input, ladderSteps: [...input.ladderSteps, { ingredientIds: ["arugula"], keyRecipeId: PINSA }] })).toContain(`a ladderCredit:false late recipe cannot be the key of a late ladder step: ${PINSA}`);
  });

  it("the discovery target declares the Pinsa dough AND the post-bake arugula, requires both capabilities, and has the Owner-fixed target id", async () => {
    const on = await load(true);
    const t = on.catalog.RECIPE_DISCOVERY_CATALOG.find((x) => x.recipeId === PINSA)!;
    expect(t.targetId).toBe("pinsa-romana-pizzadb-p9");
    expect(t.items).toEqual(["arugula", "mozzarella", "prosciutto-crudo", "tomato-sauce"]);
    expect(t.identityDimensions).toMatchObject({ dough: DOUGH, late: [["POST_BAKE", ["arugula"]]] });
    expect([...t.capabilities].sort()).toEqual(["DOUGH_VARIANT", "LATE_ADDITION"]);
    expect(on.signature.RUNTIME_SUPPORTED_CAPABILITIES).toEqual(expect.arrayContaining(["DOUGH_VARIANT", "LATE_ADDITION"]));
  });

  it("table rows: tomato-sauce PAINT (same as jamon), key-free Hint, and a Reference of 7 non-sauce pieces (mozzarella 2 / prosciutto 3 / arugula 2) on the 8-slot ring", async () => {
    const on = await load(true);
    expect(on.profiles.getRecipeSauceProfile(PINSA as never)).toEqual({ recipeId: PINSA, ingredientId: "tomato-sauce", interaction: "PAINT" });
    const ref = on.reference.getReferencePizza(PINSA)!;
    expect(ref.recipeId).toBe(PINSA);
    expect(ref.pieceGroups.map((g) => [g.ingredientId, g.positions.length])).toEqual([["mozzarella", 2], ["prosciutto-crudo", 3], ["arugula", 2]]);
    expect(on.reference.listReferencePizzas().map((r) => r.recipeId)).toContain(PINSA);
    const jamonRef = on.reference.getReferencePizza(JAMON)!;
    expect(ref.pieceGroups.map((g) => g.positions)).toEqual(jamonRef.pieceGroups.map((g) => g.positions)); // R4: the arugula position is tuned in the real-device HV
    const ladder = on.hint.buildHint5Ladder(PINSA)!;
    expect(ladder).not.toBeNull();
    expect(ladder.rungs.map((r) => r.kind)).toEqual(on.hint.buildHint5Ladder(JAMON)!.rungs.map((r) => r.kind)); // key-free, the same shape as jamon
    expect(on.hint.isKeyFreeHintRoles((await import("./recipeHintRoles")).RECIPE_HINT_ROLES[PINSA])).toBe(true);
  });

  it("Dinner never targets it, and the batch validator's catalog tables are valid with it", async () => {
    const on = await load(true);
    expect(on.dinner.DINNER_MISSIONS.flatMap((m) => m.targetRecipeIds as readonly string[])).not.toContain(PINSA);
    expect(on.validator.validateCatalogTables(on.validator.productionCatalogView())).toEqual([]);
  });

  it("ON with the late catalog itself OFF (rollback of E5) still publishes no Pinsa: its gate cannot bypass the late switch", async () => {
    vi.resetModules();
    vi.doMock("./pinsaGate", () => ({ PINSA_PRODUCTION: true, pinsaEnabled: () => true }));
    vi.doMock("./lateCatalog", async (importOriginal) => ({ ...(await importOriginal<typeof import("./lateCatalog")>()), LATE_CATALOG_PRODUCTION: false, lateCatalogEnabled: () => false }));
    await import("./lateCatalog");
    const recipes = await import("./recipes");
    expect(recipes.RECIPES.some((r) => (r.id as string) === PINSA)).toBe(false);
    expect(recipes.RECIPES.some((r) => r.requiredIngredients.some((q) => "applicationPhase" in q))).toBe(false);
    vi.doUnmock("./lateCatalog");
  });
});

describe("b-2: the L1 judgement table on the real ON catalog (D2)", () => {
  async function judge(pizza: PizzaState, discovered: readonly string[] = []) {
    const on = await load(true);
    const o = on.matcher.evaluateDiscovery(on.signature.signatureOfPizza(pizza), on.catalog.RECIPE_DISCOVERY_CATALOG, discovered, { supportedCapabilities: ["DOUGH_VARIANT", "LATE_ADDITION"] });
    return o.kind === "NEW_DISCOVERY" || o.kind === "ALREADY_DISCOVERED" ? `${o.kind}:${o.recipeId}` : o.kind;
  }

  it("standard dough, nothing after the bake = jamon (the Pinsa row does not capture it)", async () => {
    expect(await judge(pizzaOf({ pre: [...MOZ2, ...PRO3, ...ARU2], post: [] }))).toBe(`NEW_DISCOVERY:${JAMON}`);
    expect(await judge(pizzaOf({ pre: [...MOZ2, ...PRO3, ...ARU2], post: [] }), [JAMON])).toBe(`ALREADY_DISCOVERED:${JAMON}`);
  });
  it("standard dough + arugula after the bake = ORIGINAL (Owner D2); jamon's target is unchanged", async () => {
    expect(await judge(pizzaOf({ pre: [...MOZ2, ...PRO3], post: ARU2 }))).toBe("ORIGINAL");
    expect(await judge(pizzaOf({ pre: MOZ2, post: [...PRO3, ...ARU2] }))).toBe("ORIGINAL"); // prosciutto after the bake as well
  });
  it("Pinsa dough + arugula after the bake (prosciutto before) = pinsa-romana", async () => {
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3], post: ARU2 }))).toBe(`NEW_DISCOVERY:${PINSA}`);
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3], post: ARU2 }), [PINSA])).toBe(`ALREADY_DISCOVERED:${PINSA}`);
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3], post: ["arugula"] }))).toBe(`NEW_DISCOVERY:${PINSA}`); // the late axis is presence-only; the count only moves the score
  });
  it("Pinsa dough + everything before the bake = ORIGINAL; + prosciutto after the bake = ORIGINAL; + tray = ORIGINAL; nothing after = ORIGINAL", async () => {
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3, ...ARU2], post: [] }))).toBe("ORIGINAL");
    expect(await judge(pizzaOf({ dough: true, pre: MOZ2, post: [...PRO3, ...ARU2] }))).toBe("ORIGINAL");
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3], post: ARU2, tray: true }))).toBe("ORIGINAL");
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3], post: [] }))).toBe("ORIGINAL");
  });
  it("a missing ingredient or a different one is never Pinsa, even with the dough and the late arugula", async () => {
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2], post: ARU2 }))).toBe("ORIGINAL");
    expect(await judge(pizzaOf({ dough: true, pre: [...MOZ2, ...PRO3, "basil"], post: ARU2 }))).toBe("ORIGINAL");
  });
  it("every recipe, Pinsa included, is identified by its own Reference pizza (with its dough and its post-bake stage) and only by it", async () => {
    const on = await load(true);
    for (const recipe of on.recipes.RECIPES) {
      const reference = on.reference.getReferencePizza(recipe.id)!;
      const late = new Set<string>(recipe.requiredIngredients.filter((q) => "applicationPhase" in q).map((q) => q.ingredientId));
      const pizza = {
        ...createEmptyPizza(),
        sauceIds: reference.sauce ? recipe.requiredIngredients.map((q) => q.ingredientId).filter((id) => on.ingredients.getIngredient(id)?.category === "sauce") : [],
        ...("panShape" in recipe && recipe.panShape === "square" ? { pan: "tray" as const } : {}),
        ...("doughKind" in recipe ? { dough: (recipe as { doughKind: string }).doughKind } : {}),
        toppings: reference.pieceGroups.flatMap((g, gi) => g.positions.map((p, i) => ({ id: `${gi}-${i}`, ingredientId: g.ingredientId, ...p, ...(late.has(g.ingredientId) ? { stage: "post" as const } : {}) }))),
      } as PizzaState;
      const o = on.matcher.evaluateDiscovery(on.signature.signatureOfPizza(pizza), on.catalog.RECIPE_DISCOVERY_CATALOG, [], { supportedCapabilities: ["DOUGH_VARIANT", "LATE_ADDITION"] });
      expect(o, recipe.id).toMatchObject({ kind: "NEW_DISCOVERY", recipeId: recipe.id });
    }
  });
});

describe("b-3: Research cohort (Q7) and the named exception", () => {
  const OWNED_ARUGULA = (ingredients: Awaited<ReturnType<typeof load>>["ingredients"], ladder: Awaited<ReturnType<typeof load>>["ladder"]) => [
    ...ingredients.STARTER_INGREDIENT_IDS,
    ...ladder.DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds),
  ];

  it("arugula's cohort becomes {pinsa A, jamon B}; no other recipe's letter moves; OFF has no letter at all there", async () => {
    const off = await load(false);
    const on = await load(true);
    const ownedOff = OWNED_ARUGULA(off.ingredients, off.ladder);
    const ownedOn = OWNED_ARUGULA(on.ingredients, on.ladder);
    const lettersOff = off.research.researchCohortLetters(ownedOff, off.recipes.RECIPES);
    const lettersOn = on.research.researchCohortLetters(ownedOn, on.recipes.RECIPES);
    expect(lettersOn.get(PINSA)).toBe("A");
    expect(lettersOn.get(JAMON)).toBe("B");
    expect(lettersOff.has(JAMON)).toBe(false);
    const rest = (m: ReadonlyMap<string, string>) => [...m].filter(([id]) => id !== PINSA && id !== JAMON).sort();
    expect(rest(lettersOn)).toEqual(rest(lettersOff));
  });

  it("an undiscovered jamon is labelled 'B' (…ルッコラ) and Pinsa 'A'; the label carries no name, no id, no moment, no count", async () => {
    const on = await load(true);
    const owned = OWNED_ARUGULA(on.ingredients, on.ladder);
    const entries = on.research.deriveResearchEntries({ dex: [], ownedIngredientIds: owned }, {}, on.recipes.RECIPES).entries;
    const labelOf = (id: string) => on.research.researchEntryLabel(entries.find((e) => e.recipeId === id)!);
    expect(labelOf(JAMON)).toBe("？？？ピザ B（ルッコラ）");
    expect(labelOf(PINSA)).toBe("？？？ピザ A（ルッコラ）");
    expect(`${labelOf(JAMON)}${labelOf(PINSA)}`).not.toMatch(/ピンサ|ロマーナ|生地|後乗せ|焼/);
  });

  it("a discovered jamon is not an entry; Pinsa then still shows as 'A' (the discovered sibling keeps its slot, OD-R2-3)", async () => {
    const on = await load(true);
    const owned = OWNED_ARUGULA(on.ingredients, on.ladder);
    const dex = [{ recipeId: JAMON, discovered: true, bestScore: 0, bestStars: 1 as const, timesMade: 1 }];
    const entries = on.research.deriveResearchEntries({ dex, ownedIngredientIds: owned }, {}, on.recipes.RECIPES).entries;
    expect(entries.map((e) => e.recipeId as string)).not.toContain(JAMON);
    expect(entries.find((e) => (e.recipeId as string) === PINSA)?.cohortLetter).toBe("A");
  });

  it("the Pinsa batch manifest validates with exactly one accepted shift (jamon -->B); the validator body is not special-cased", async () => {
    const on = await load(true);
    expect(PINSA_ROMANA_BATCH.acceptedLetterShifts).toEqual({ [JAMON]: "-->B" });
    expect(on.validator.validateBatchManifest(PINSA_ROMANA_BATCH, on.validator.productionCatalogView())).toEqual([]);
    const view = on.validator.productionCatalogView();
    expect(on.validator.validateBatchManifest({ ...PINSA_ROMANA_BATCH, acceptedLetterShifts: {} }, view)).toContain(`COHORT_LETTER_SHIFT: ${JAMON} - -> B`);
    expect(on.validator.validateBatchManifest({ ...PINSA_ROMANA_BATCH, acceptedLetterShifts: { [JAMON]: "-->B", margherita: "-->A" } }, view)).toContain("ACCEPTED_LETTER_SHIFT_NOT_OBSERVED: margherita");
    expect(on.validator.validateBatchManifest({ ...PINSA_ROMANA_BATCH, acceptedLetterShifts: { [JAMON]: "-->A" } }, view).length).toBeGreaterThan(0);
    // a Pinsa that advanced the ladder would be caught (ladderCredit is declared false and checked against the data)
    expect(on.validator.validateBatchManifest({ ...PINSA_ROMANA_BATCH, recipes: [{ ...PINSA_ROMANA_BATCH.recipes[0], ladderCredit: true }] }, view)).toEqual(expect.arrayContaining([expect.stringContaining("LADDER")]));
  });

  it("the id is fixed: the letters come from a hash of 'pinsa-romana' (renaming it would swap A and B)", async () => {
    const on = await load(true);
    const h = (await import("../logic/discovery/researchEntry")) as unknown as { opaqueHash?: (id: string) => number };
    if (h.opaqueHash) expect(h.opaqueHash(PINSA)).toBeLessThan(h.opaqueHash(JAMON));
    expect(on.late.LATE_RECIPES.map((r) => r.id)).toContain(PINSA);
  });
});

describe("b-4: techniques and privacy (D3), gate ON", () => {
  it("the recipe requires exactly 'dough-pinsa-romana' and 'late-addition'; no other recipe's requirement changes", async () => {
    const off = await load(false);
    const on = await load(true);
    const req = (m: typeof on) => m.catalog.RECIPE_DISCOVERY_CATALOG.map((t) => [t.recipeId, [...m.techniques.requiredTechniquesOf(t)].sort()] as const);
    const pinsa = req(on).find(([id]) => id === PINSA)!;
    expect(pinsa[1]).toEqual(["dough-pinsa-romana", "late-addition"]);
    expect(req(on).filter(([id]) => id !== PINSA)).toEqual(req(off));
  });

  it("the dough technique's riddle opens from the credited count of arugula's step, depends on the Dex alone, and is a fixed string with no name / id / moment (T1, T2)", async () => {
    const on = await load(true);
    const arugulaStep = on.ladder.DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("arugula"))!.step;
    const dexOf = (n: number) => on.recipes.RECIPES.filter((r) => on.recipes.countsTowardLadder(r.id)).slice(0, n).map((r) => ({ recipeId: r.id, discovered: true, bestScore: 0, bestStars: 1 as const, timesMade: 1 }));
    expect(on.doughSwitch.isDoughAffordanceOpen(dexOf(arugulaStep - 1))).toBe(false);
    expect(on.doughSwitch.isDoughAffordanceOpen(dexOf(arugulaStep))).toBe(true);
    const views = on.dexView.techniqueDexViews([], dexOf(arugulaStep));
    const riddle = views.find((v) => v.id === "dough-pinsa-romana");
    expect(riddle).toEqual({ id: "dough-pinsa-romana", state: "RIDDLE", riddleJa: "同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。" });
    // player-facing text only (the raw technique id is data, never rendered: PK-22 is pinned by techniques.dough.test.ts)
    expect(views.map((v) => (v.state === "RIDDLE" ? v.riddleJa : v.nameJa)).join("")).not.toMatch(/ピンサ|ロマーナ|ルッコラ|生ハム|焼き上|焼成|あと/);
    // the same Dex gives the same views: nothing else (ownership, Research, purchased hints) is an input of this function
    expect(on.dexView.techniqueDexViews([], dexOf(arugulaStep))).toEqual(views);
    expect(on.dexView.techniqueDexViews.length).toBeLessThanOrEqual(3);
  });

  it("Hint 5.0 is a function of the recipe alone: Pinsa's ladder names neither the dough nor the moment, and equals jamon's in kinds and subjects (T3)", async () => {
    const on = await load(true);
    const p = on.hint.buildHint5Ladder(PINSA)!;
    const j = on.hint.buildHint5Ladder(JAMON)!;
    expect(p.rungs.map((r) => [r.kind, r.subjectIds])).toEqual(j.rungs.map((r) => [r.kind, r.subjectIds]));
    expect(JSON.stringify(p.rungs)).not.toMatch(/dough|pinsa|late|POST|後乗せ|生地/i);
  });

  it("chapters: Pinsa is in the chapter of its key step (arugula) and K2 keeps late-catalog recipes out of the cleared mark", async () => {
    const off = await load(false);
    const on = await load(true);
    const chapterOf = (m: typeof on, id: string) => m.chapters.buildRecipeChapters().find((c) => c.recipes.some((r) => (r.id as string) === id));
    expect(chapterOf(on, PINSA)?.chapter).toBe(chapterOf(on, JAMON)?.chapter);
    expect(chapterOf(off, PINSA)).toBeUndefined();
  });
});
