import { describe, expect, it } from "vitest";
import { RECIPE_DISCOVERY_CATALOG } from "../../data/discoveryCatalog";
import { createEmptyPizza, type PizzaState } from "../../state/pizzaState";
import { evaluateDiscovery, type DiscoveryOutcome, type RecipeDiscoveryTarget } from "./matcher";
import { DEFAULT_IDENTITY_DIMENSIONS, signatureOfPizza } from "./signature";

/**
 * Issue #577 (A): the dough x late x pan combination table for jamon-serrano-pizza's ingredient set, run through the REAL matcher
 * (`evaluateDiscovery`). TEST ONLY -- no data, no matcher change, no Pinsa recipe in the catalog.
 *
 * What each row is (the three classes are kept apart on purpose, Owner 2026-10-23):
 *  - PRODUCTION: the real catalog. Pinsa does not exist; these rows pin today's behaviour.
 *  - ADOPTED (Q7 = I2): a SYNTHETIC Pinsa target (`dough` AND `late`) added to that catalog. This stands in for the not-yet-landed C slice
 *    (on HOLD) so the table can be written now; it is a design fixture, not catalog data.
 *  - OBSERVED_UNAPPROVED: what the current matcher does for "jamon's ingredients, standard dough, some pieces after the bake" once the
 *    late axis is part of the catalog (FINISH ON): ORIGINAL. Recorded as a CHARACTERIZATION of the implementation. It is NOT an approved
 *    specification: the Owner has not accepted this side effect (#577 / PR #633 section 12.2). If the Owner decides otherwise, these rows
 *    change; nothing here should be read as having fixed that decision.
 */

const PINSA = "material-multigrain-long-ferment";
const JAMON_ID = "jamon-serrano-pizza";
const JAMON = RECIPE_DISCOVERY_CATALOG.find((t) => t.recipeId === JAMON_ID)!;

/** Synthetic Pinsa (I2): jamon's items, the Pinsa dough kind AND arugula + prosciutto-crudo after the bake. */
const PINSA_I2: RecipeDiscoveryTarget = {
  targetId: "syn:pinsa-romana-i2",
  recipeId: "syn:pinsa-romana" as RecipeDiscoveryTarget["recipeId"],
  items: [...JAMON.items],
  sauceBase: [...(JAMON.sauceBase ?? [])],
  capabilities: ["DOUGH_VARIANT", "LATE_ADDITION"],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, dough: PINSA, late: [["POST_BAKE", ["arugula", "prosciutto-crudo"]]] },
  eligibility: { status: "ELIGIBLE" },
};

const PRODUCTION_CATALOG = RECIPE_DISCOVERY_CATALOG;
const LATE_ON_CATALOG: readonly RecipeDiscoveryTarget[] = [...RECIPE_DISCOVERY_CATALOG, PINSA_I2];

type DoughChoice = "standard" | "pinsa";
type LateChoice = "none" | "both" | "prosciutto-only" | "arugula-only";
type PanChoice = "none" | "tray";

const LATE_IDS: Record<LateChoice, readonly string[]> = {
  none: [],
  both: ["prosciutto-crudo", "arugula"],
  "prosciutto-only": ["prosciutto-crudo"],
  "arugula-only": ["arugula"],
};

function pizzaOf(dough: DoughChoice, late: LateChoice, pan: PanChoice): PizzaState {
  const post = LATE_IDS[late];
  const pre = ["mozzarella", "prosciutto-crudo", "arugula"].filter((id) => !post.includes(id));
  const piece = (ingredientId: string, i: number, stage?: "post") => ({ id: `${stage ?? "pre"}${i}`, ingredientId, x: 30 + i * 6, y: 50, ...(stage ? { stage } : {}) });
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [...pre.map((id, i) => piece(id, i)), ...post.map((id, i) => piece(id, i + 3, "post" as const))],
    bakeResult: 70,
    ...(dough === "pinsa" ? { dough: PINSA } : {}),
    ...(pan === "tray" ? { pan: "tray" as const } : {}),
  } as PizzaState;
}

const run = (pizza: PizzaState, catalog: readonly RecipeDiscoveryTarget[], discovered: readonly string[] = []): DiscoveryOutcome =>
  evaluateDiscovery(signatureOfPizza(pizza), catalog, discovered);

const label = (o: DiscoveryOutcome): string => (o.kind === "NEW_DISCOVERY" || o.kind === "ALREADY_DISCOVERED" ? `${o.kind}:${o.recipeId}` : o.kind);

const DOUGHS: readonly DoughChoice[] = ["standard", "pinsa"];
const LATES: readonly LateChoice[] = ["none", "both", "prosciutto-only", "arugula-only"];
const PANS: readonly PanChoice[] = ["none", "tray"];

type RowClass = "PRODUCTION_ONLY" | "ADOPTED_I2" | "OBSERVED_UNAPPROVED";
interface Row {
  dough: DoughChoice;
  late: LateChoice;
  pan: PanChoice;
  /** The real catalog (FINISH / late catalog OFF: no Pinsa, no late target). */
  production: string;
  /** The real catalog plus the synthetic I2 Pinsa (late catalog ON). */
  lateOn: string;
  /** How to read the lateOn column. */
  lateOnClass: RowClass;
}

/** Every row of dough x late x pan (2 x 4 x 2 = 16). `production` / `lateOn` are the CURRENT implementation's results. */
const TABLE: readonly Row[] = [
  // standard dough, no tray
  { dough: "standard", late: "none", pan: "none", production: "NEW_DISCOVERY:jamon-serrano-pizza", lateOn: "NEW_DISCOVERY:jamon-serrano-pizza", lateOnClass: "ADOPTED_I2" },
  { dough: "standard", late: "both", pan: "none", production: "ORIGINAL", lateOn: "ORIGINAL", lateOnClass: "OBSERVED_UNAPPROVED" },
  { dough: "standard", late: "prosciutto-only", pan: "none", production: "ORIGINAL", lateOn: "ORIGINAL", lateOnClass: "OBSERVED_UNAPPROVED" },
  { dough: "standard", late: "arugula-only", pan: "none", production: "ORIGINAL", lateOn: "ORIGINAL", lateOnClass: "OBSERVED_UNAPPROVED" },
  // Pinsa dough, no tray
  { dough: "pinsa", late: "none", pan: "none", production: "ORIGINAL", lateOn: "ORIGINAL", lateOnClass: "ADOPTED_I2" },
  { dough: "pinsa", late: "both", pan: "none", production: "ORIGINAL", lateOn: "NEW_DISCOVERY:syn:pinsa-romana", lateOnClass: "ADOPTED_I2" },
  { dough: "pinsa", late: "prosciutto-only", pan: "none", production: "ORIGINAL", lateOn: "ORIGINAL", lateOnClass: "ADOPTED_I2" },
  { dough: "pinsa", late: "arugula-only", pan: "none", production: "ORIGINAL", lateOn: "ORIGINAL", lateOnClass: "ADOPTED_I2" },
  // tray: no target requires `pan: tray`, so every tray row matches nothing (existing behaviour, PK-3)
  ...DOUGHS.flatMap((dough) =>
    LATES.map((late): Row => ({
      dough,
      late,
      pan: "tray",
      production: "ORIGINAL",
      lateOn: "ORIGINAL",
      lateOnClass: dough === "standard" && late !== "none" ? "OBSERVED_UNAPPROVED" : "ADOPTED_I2",
    })),
  ),
];

describe("dough x late x pan table for jamon-serrano's ingredients (#577 A, test only)", () => {
  it("the table covers every combination exactly once", () => {
    const keys = TABLE.map((r) => `${r.dough}/${r.late}/${r.pan}`);
    expect(new Set(keys).size).toBe(TABLE.length);
    expect(TABLE.length).toBe(DOUGHS.length * LATES.length * PANS.length);
    for (const dough of DOUGHS) for (const late of LATES) for (const pan of PANS) expect(keys).toContain(`${dough}/${late}/${pan}`);
  });

  it("the fixtures are built as intended (late pieces carry stage 'post'; axes read back as dough / late / pan)", () => {
    const sig = signatureOfPizza(pizzaOf("pinsa", "both", "tray"));
    expect(sig.dimensions.dough.value).toBe(PINSA);
    expect(sig.dimensions.late.value).toEqual([["POST_BAKE", ["arugula", "prosciutto-crudo"]]]);
    expect(sig.dimensions.pan.value).toBe("tray");
    expect(signatureOfPizza(pizzaOf("standard", "none", "none")).dimensions.late.value).toEqual([]);
    // the ingredient set is the same in every row (presence-only, stage-blind): only the three axes differ
    const sets = new Set(TABLE.map((r) => JSON.stringify(signatureOfPizza(pizzaOf(r.dough, r.late, r.pan)).ingredientSet)));
    expect(sets.size).toBe(1);
  });

  describe("PRODUCTION (real catalog, no Pinsa, no late target) -- pinned today's behaviour", () => {
    for (const row of TABLE) {
      it(`${row.dough} dough / late ${row.late} / pan ${row.pan} -> ${row.production}`, () => {
        expect(label(run(pizzaOf(row.dough, row.late, row.pan), PRODUCTION_CATALOG))).toBe(row.production);
      });
    }
  });

  describe("late catalog ON (real catalog + SYNTHETIC I2 Pinsa) -- current implementation, by class", () => {
    for (const row of TABLE) {
      it(`[${row.lateOnClass}] ${row.dough} dough / late ${row.late} / pan ${row.pan} -> ${row.lateOn}${row.lateOnClass === "OBSERVED_UNAPPROVED" ? " (characterization, NOT an approved spec)" : ""}`, () => {
        expect(label(run(pizzaOf(row.dough, row.late, row.pan), LATE_ON_CATALOG))).toBe(row.lateOn);
      });
    }

    it("the only OBSERVED_UNAPPROVED rows are 'standard dough with at least one piece after the bake' (the #633 section 12.2 side effect); nothing else is in that class", () => {
      const unapproved = TABLE.filter((r) => r.lateOnClass === "OBSERVED_UNAPPROVED");
      expect(unapproved.every((r) => r.dough === "standard" && r.late !== "none")).toBe(true);
      expect(unapproved.length).toBe(TABLE.filter((r) => r.dough === "standard" && r.late !== "none").length);
      expect(unapproved.length).toBe(6);
      // none of them is Pinsa-related: they have the same result in PRODUCTION, i.e. adding the I2 Pinsa target changes none of them
      for (const r of unapproved) expect(r.lateOn).toBe(r.production);
    });
  });

  describe("what adding the (synthetic) Pinsa target changes", () => {
    it("exactly one row changes between PRODUCTION and late ON: Pinsa dough + both late pieces (no tray)", () => {
      const changed = TABLE.filter((r) => r.production !== r.lateOn).map((r) => `${r.dough}/${r.late}/${r.pan}`);
      expect(changed).toEqual(["pinsa/both/none"]);
    });

    it("every row's result is computed, not copied: the table equals a fresh run of both catalogs", () => {
      for (const r of TABLE) {
        expect(label(run(pizzaOf(r.dough, r.late, r.pan), PRODUCTION_CATALOG)), `${r.dough}/${r.late}/${r.pan}`).toBe(r.production);
        expect(label(run(pizzaOf(r.dough, r.late, r.pan), LATE_ON_CATALOG)), `${r.dough}/${r.late}/${r.pan}`).toBe(r.lateOn);
      }
    });
  });

  describe("jamon-serrano-pizza itself is untouched by the Pinsa target (the judgement logic is not changed by this test)", () => {
    it("the jamon target in the catalog is the production object, with standard dough, no late and no tray", () => {
      expect(LATE_ON_CATALOG.find((t) => t.recipeId === JAMON_ID)).toBe(JAMON);
      expect(JAMON.identityDimensions.dough).toBe("standard");
      expect(JAMON.identityDimensions.late).toEqual([]);
      expect(JAMON.identityDimensions.pan).toBeNull();
      expect(JAMON.capabilities).not.toContain("DOUGH_VARIANT");
      expect(JAMON.capabilities).not.toContain("LATE_ADDITION");
    });

    it("a player who already discovered jamon keeps getting ALREADY_DISCOVERED for the standard cook, with or without the Pinsa target", () => {
      const pizza = pizzaOf("standard", "none", "none");
      expect(label(run(pizza, PRODUCTION_CATALOG, [JAMON_ID]))).toBe("ALREADY_DISCOVERED:jamon-serrano-pizza");
      expect(label(run(pizza, LATE_ON_CATALOG, [JAMON_ID]))).toBe("ALREADY_DISCOVERED:jamon-serrano-pizza");
    });

    it("no row other than the plain standard cook ever yields jamon, in either catalog (jamon is never discovered by mistake)", () => {
      for (const r of TABLE) {
        const isPlain = r.dough === "standard" && r.late === "none" && r.pan === "none";
        for (const catalog of [PRODUCTION_CATALOG, LATE_ON_CATALOG]) {
          const outcome = run(pizzaOf(r.dough, r.late, r.pan), catalog);
          const jamon = (outcome.kind === "NEW_DISCOVERY" || outcome.kind === "ALREADY_DISCOVERED") && outcome.recipeId === JAMON_ID;
          expect(jamon, `${r.dough}/${r.late}/${r.pan}`).toBe(isPlain);
        }
      }
    });
  });

  describe("capability gating", () => {
    it("with DOUGH_VARIANT / LATE_ADDITION unsupported the Pinsa target cannot match, and jamon's standard cook is unchanged", () => {
      const options = { supportedCapabilities: [] as string[] };
      const pinsa = signatureOfPizza(pizzaOf("pinsa", "both", "none"));
      expect(label(evaluateDiscovery(pinsa, LATE_ON_CATALOG, [], options))).toBe("ORIGINAL");
      const std = signatureOfPizza(pizzaOf("standard", "none", "none"));
      expect(label(evaluateDiscovery(std, LATE_ON_CATALOG, [], options))).toBe("NEW_DISCOVERY:jamon-serrano-pizza");
    });
  });
});
