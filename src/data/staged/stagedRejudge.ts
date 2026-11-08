/**
 * Staged Catalog re-judgement (Issue #780, Owner 2026-11-08): re-judges every open dependency of the 84 staged recipes under the
 * Owner's PROVISIONAL blanket rules (R-1..R-8, I-1..I-3, plan §9), WITHOUT changing the staged data. A proposal is a suggestion
 * recorded for review; nothing here promotes, excludes or renames anything. STAGED ONLY: never imported by production code.
 *
 * Mechanical rules (only what the rule text decides on its own; everything else stays with the Owner):
 *  - R-1 (sauce): matrix family 「その他」 = no identity sauce named -> NO_SAUCE (rule: "otherwise existing sauce or NO_SAUCE").
 *    「甘辛だれ」 on teriyaki-chicken / bulgogi = the rule's own named examples of an identity sauce -> NEW SAUCE (rule-decided; the sauce
 *    ingredient still has to be created). Every other generic family (hot / curry / dessert / white / tare elsewhere) -> Owner.
 *  - R-6 (late addition): already applied where the matrix names the post-bake ingredients (taco). An undecided timing
 *    `unresolved:mid_bake|post_bake` -> the shipped post_bake (rule: "use the existing post_bake, no new mechanic"), which also drops
 *    that recipe's MID_BAKE dependency. Salad rows whose post-bake ingredients are not named stay with the Owner.
 *  - R-7 (unresolved token): the canonicalizer suggested exactly one id, that id is shipped, and substituting it hits NO duplicate
 *    gate (the I-1 condition, Codex P2 on PR #787) -> map it. A suggested id owned by in-flight work (walnut) -> waits for that work.
 *  - Duplicate gate: re-measured on the proposed sets. A hit against another STAGED recipe is a choice between candidates, not an
 *    exception. A hit against a SHIPPED recipe is "axis-separable" when the staged recipe also needs a mechanic or a post-bake step
 *    that becomes part of its identity (R-3 path: decided with that mechanic), otherwise it is a real exception (R-2 / R-4).
 *  - R-2 / R-3 / R-4 / R-5 / R-8, mechanics, in-flight ingredients and suffixed ids are never resolved here.
 */
import { stagedDependencies, stagedDuplicateGate, type Dependency, type DuplicateHit, type ShippedView } from "./stagedCatalog";
import { STAGED_INGREDIENTS } from "./testSupport/stagedIngredients";
import { STAGED_RECIPES } from "./testSupport/stagedRecipes";
import type { StagedRecipe } from "./stagedTypes";

export type Verdict =
  | "AUTO_RESOLVED" // the rule alone resolves it (a proposal, reversible)
  | "RULE_DECIDED_WORK" // the rule decides the outcome; work remains (e.g. create the identity sauce)
  | "DUPLICATE_COUNT" // the same open question already counted under another dependency of the same recipe
  | "WAITS_MECHANIC" // a mechanic track (M1-M6) must ship first
  | "WAITS_IN_FLIGHT" // PR #783 / B20-A must merge first
  | "AXIS_CONDITIONAL" // duplicate vs shipped, separable once the recipe's mechanic / post-bake axis ships (R-3 path)
  | "STAGED_PAIR" // duplicate vs another staged candidate: resolved by choosing between candidates
  | "EXCEPTION_NEEDED" // duplicate vs shipped with no separating axis: R-2 (exclude?) or R-4 (exception?) per ID
  | "OWNER_DECISION"; // anything else the rules leave to the Owner

export interface JudgedDependency extends Dependency {
  readonly verdict: Verdict;
  readonly note?: string;
}

export interface RecipeRejudge {
  readonly id: string;
  /** Proposed identity set after the mechanical resolutions (sorted ingredient ids). */
  readonly proposedSet: readonly string[];
  readonly proposals: readonly string[];
  readonly judged: readonly JudgedDependency[];
}

const SAUCE_NO_SAUCE_FAMILIES = new Set(["その他"]);
const RULE_NAMED_IDENTITY_SAUCE: Readonly<Record<string, string>> = { "teriyaki-chicken-pizza": "teriyaki-sauce", "bulgogi-pizza": "bulgogi-sauce" };
const IN_FLIGHT = new Set(["burrata", "honey", "walnut"]);
/** R-3 as adopted: "allowed only when the dough is a visibly distinct technique; cauliflower / fathead are HOLD". */
const R3_HOLD = new Set(["cauliflower-crust-pizza", "fathead-pizza-keto"]);

function hasAxis(r: StagedRecipe, mechanics: readonly string[]): boolean {
  return mechanics.length > 0 || r.requiredIngredients.some((q) => q.applicationPhase === "POST_BAKE");
}

export function rejudgeStaged(shipped: ShippedView, recipes: readonly StagedRecipe[] = STAGED_RECIPES): RecipeRejudge[] {
  const shippedIng = new Set(shipped.ingredientIds);
  const originalDup = stagedDuplicateGate(shipped, recipes);

  // Pass 1: mechanical proposals on the identity sets.
  const proposed = new Map<string, { set: string[]; proposals: string[]; sauce: "NO_SAUCE" | "NEW" | "OPEN" | "SPECIFIED"; tokens: Map<string, Verdict>; lateResolved: boolean }>();
  for (const r of recipes) {
    const set = [...new Set(r.requiredIngredients.map((q) => q.ingredientId))];
    const proposals: string[] = [];
    let sauce: "NO_SAUCE" | "NEW" | "OPEN" | "SPECIFIED" = r.sauce.status === "unspecified" ? "OPEN" : "SPECIFIED";
    if (sauce === "OPEN" && SAUCE_NO_SAUCE_FAMILIES.has(r.sauceFamilyRaw)) {
      sauce = "NO_SAUCE";
      proposals.push(`R-1: NO_SAUCE (family 「${r.sauceFamilyRaw}」)`);
    } else if (sauce === "OPEN" && r.id in RULE_NAMED_IDENTITY_SAUCE) {
      sauce = "NEW";
      proposals.push(`R-1: new identity sauce ${RULE_NAMED_IDENTITY_SAUCE[r.id]} (rule's named example; ingredient still to be created)`);
    }
    const lateResolved = r.lateModes.some((m) => m.mode === "unresolved:mid_bake|post_bake");
    if (lateResolved) proposals.push(`R-6: ${r.lateModes.find((m) => m.mode.startsWith("unresolved"))!.ingredients.join("/")} -> POST_BAKE (shipped)`);
    proposed.set(r.id, { set, proposals, sauce, tokens: new Map(), lateResolved });
  }
  // R-7 needs the duplicate check against the (pass-1) proposed sets of the others.
  const setsView = (): ShippedView["recipes"] => [...proposed.entries()].map(([id, p]) => ({ id, requiredIngredients: p.set.map((ingredientId) => ({ ingredientId })) }));
  for (const r of recipes) {
    const p = proposed.get(r.id)!;
    for (const [token, related] of r.unresolvedRelatedIds) {
      if (related.length === 1 && IN_FLIGHT.has(related[0])) {
        p.tokens.set(token, "WAITS_IN_FLIGHT");
        continue;
      }
      if (related.length !== 1 || !shippedIng.has(related[0])) {
        p.tokens.set(token, "OWNER_DECISION");
        continue;
      }
      const trial = [...new Set([...p.set, related[0]])];
      const trialRecipe = { ...r, requiredIngredients: trial.map((ingredientId) => ({ ingredientId, minCount: 1 })) } as StagedRecipe;
      const others = setsView().filter((o) => o.id !== r.id).map((o) => ({ ...r, id: o.id, requiredIngredients: o.requiredIngredients.map((q) => ({ ...q, minCount: 1 })) }) as StagedRecipe);
      const hits = stagedDuplicateGate(shipped, [trialRecipe, ...others])[r.id];
      if (hits.length === 0) {
        p.set = trial;
        p.tokens.set(token, "AUTO_RESOLVED");
        p.proposals.push(`R-7: 「${token}」 -> ${related[0]}`);
      } else {
        p.tokens.set(token, "OWNER_DECISION");
      }
    }
  }

  // Pass 2: re-measure the duplicate gate on the proposed sets, then judge every original dependency.
  const proposedRecipes = recipes.map((r) => ({ ...r, requiredIngredients: proposed.get(r.id)!.set.map((ingredientId) => ({ ingredientId, minCount: 1 })) }) as StagedRecipe);
  const newDup = stagedDuplicateGate(shipped, proposedRecipes);

  return recipes.map((r) => {
    const p = proposed.get(r.id)!;
    const mechanics = r.mechanics.filter((m) => !(m === "MID_BAKE" && p.lateResolved));
    const held = R3_HOLD.has(r.id);
    const axis = !held && hasAxis(r, mechanics);
    const deps = stagedDependencies(r, originalDup[r.id], STAGED_INGREDIENTS);
    const judged: JudgedDependency[] = [];
    const dupKeyOf = (h: DuplicateHit) => `${h.kind}${h.againstStaged ? "@staged" : "@shipped"}`;
    const remaining = new Set(newDup[r.id].map(dupKeyOf));
    for (const d of deps) {
      if (d.kind === "INGREDIENT_STAGED") continue;
      let verdict: Verdict = "OWNER_DECISION";
      let note: string | undefined;
      switch (d.kind) {
        case "OWNER_RULE":
          if (d.id === "R-1") verdict = p.sauce === "NO_SAUCE" ? "AUTO_RESOLVED" : p.sauce === "NEW" ? "RULE_DECIDED_WORK" : "OWNER_DECISION";
          else if (d.id === "R-6") verdict = r.applied.some((a) => a.startsWith("R-6")) || p.lateResolved ? "AUTO_RESOLVED" : "OWNER_DECISION";
          else if (d.id === "R-7") verdict = [...p.tokens.values()].every((v) => v === "AUTO_RESOLVED") ? "AUTO_RESOLVED" : [...p.tokens.values()].every((v) => v !== "OWNER_DECISION") ? "WAITS_IN_FLIGHT" : "OWNER_DECISION";
          else if (d.id === "R-2" || d.id === "R-4") {
            const shippedLeft = newDup[r.id].filter((h) => !h.againstStaged);
            verdict = shippedLeft.length === 0 ? "AUTO_RESOLVED" : held ? "OWNER_DECISION" : axis ? "AXIS_CONDITIONAL" : "EXCEPTION_NEEDED";
          } else if (d.id === "R-3") {
            verdict = held ? "OWNER_DECISION" : "AXIS_CONDITIONAL";
            if (held) note = "R-3 HOLD (named in the rule)";
          }
          else verdict = "OWNER_DECISION"; // R-5, R-8
          break;
        case "SAUCE_UNSPECIFIED":
          verdict = "DUPLICATE_COUNT";
          note = "same question as this recipe's R-1";
          break;
        case "UNRESOLVED_TOKEN":
          verdict = p.tokens.get(d.id) ?? "OWNER_DECISION";
          break;
        case "MECHANIC":
          verdict = d.id === "MID_BAKE" && p.lateResolved ? "AUTO_RESOLVED" : "WAITS_MECHANIC";
          break;
        case "INGREDIENT_IN_FLIGHT":
          verdict = "WAITS_IN_FLIGHT";
          break;
        case "ID_SUFFIXED":
          verdict = "OWNER_DECISION";
          note = "follows this recipe's R-5 (the unsuffixed id is the other candidate's)";
          break;
        case "DUPLICATE_GATE": {
          const staged = d.id.endsWith("@staged");
          if (!remaining.has(d.id)) verdict = "AUTO_RESOLVED";
          else if (staged) verdict = "STAGED_PAIR";
          else if (held) {
            verdict = "OWNER_DECISION";
            note = "R-3 HOLD (named in the rule)";
          } else verdict = axis ? "AXIS_CONDITIONAL" : "EXCEPTION_NEEDED";
          break;
        }
      }
      judged.push(note ? { ...d, verdict, note } : { ...d, verdict });
    }
    return { id: r.id, proposedSet: [...p.set].sort(), proposals: p.proposals, judged };
  });
}

/** Duplicate hits of every staged recipe re-measured on the proposed sets (for the per-type summary). */
export function rejudgedDuplicateGate(shipped: ShippedView, judged: readonly RecipeRejudge[], recipes: readonly StagedRecipe[] = STAGED_RECIPES) {
  const byId = new Map(judged.map((j) => [j.id, j]));
  return stagedDuplicateGate(
    shipped,
    recipes.map((r) => ({ ...r, requiredIngredients: byId.get(r.id)!.proposedSet.map((ingredientId) => ({ ingredientId, minCount: 1 })) }) as StagedRecipe),
  );
}
