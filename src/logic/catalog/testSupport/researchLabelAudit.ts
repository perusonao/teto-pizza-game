/**
 * TEST SUPPORT ONLY (Expansion Batch 18, Codex P2 on PR #759): compares the Research cohort letters of the catalog BEFORE and AFTER a batch for many ownership
 * (acquisition) orders, not only the canonical ladder order. A Research label is derived from the player's PERSISTED ownership order (`researchCohortLetters`:
 * the unlock material is the last-owned finite material), so a recipe that is added to the catalog can join -- and re-letter -- an existing cohort in any order
 * where the shared material is acquired last. The production rule itself is not changed here.
 *
 * Scenarios (deterministic): for every pre-existing recipe R, every new recipe N and every finite material m they share, (1) only R's and N's materials owned with m
 * last, (2) that plus each other ladder material, (3) every ladder material owned with m last; then the canonical ladder order at every prefix and `randomOrders`
 * seeded random orders at every prefix. The late catalog is included when the given recipes include it.
 * `excludedMaterials` (default none, so every existing call is unchanged) drops ladder materials from the orders: an audit of an EARLIER batch that leaves a later batch's recipes out
 * also leaves that batch's materials out, so its seeded random orders are the same ones it was approved against (Expansion Batch 21 vs the Batch 20-A audit).
 */
import { DISCOVERY_LADDER } from "../../../data/discoveryLadder";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../../../data/ingredients";
import { researchCohortLetters } from "../../discovery/researchEntry";

interface AuditRecipe {
  readonly id: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string }[];
}

export interface LetterChange {
  /** `before->after`, `-` = no letter (e.g. `-->B`: a single-member cohort gains the letter B). */
  readonly change: string;
  /** One ownership order that produces it (described). */
  readonly example: string;
  readonly canonical: boolean;
}

const finiteOf = (r: AuditRecipe) => [...new Set(r.requiredIngredients.map((q) => q.ingredientId))].filter((id) => !!getIngredient(id)?.unlockCondition);

/** recipe id -> the distinct letter changes observed for a PRE-EXISTING recipe (recipes in `newIds` are not reported). */
export function researchLetterChangesAcrossOrders(newIds: readonly string[], recipes: readonly AuditRecipe[], randomOrders = 40, seed = 20261105, excludedMaterials: readonly string[] = []): Map<string, LetterChange[]> {
  const before = recipes.filter((r) => !newIds.includes(r.id));
  const news = recipes.filter((r) => newIds.includes(r.id));
  const ladder = DISCOVERY_LADDER.steps.flatMap((s) => s.ingredientIds as readonly string[]).filter((m) => getIngredient(m) && !excludedMaterials.includes(m));
  const out = new Map<string, LetterChange[]>();
  const compare = (owned: readonly string[], example: string, canonical = false) => {
    const now = researchCohortLetters(owned, recipes as never);
    const old = researchCohortLetters(owned, before as never);
    for (const r of before) {
      const b = old.get(r.id);
      const a = now.get(r.id);
      if (a === b) continue;
      const change = `${b ?? "-"}->${a ?? "-"}`;
      const list = out.get(r.id) ?? [];
      // Deduplicate by (change, canonical): a transition seen first in a non-canonical order must still be recorded when the canonical ladder order produces it too (Codex P2, PR #759).
      if (!list.some((x) => x.change === change && x.canonical === canonical)) list.push({ change, example, canonical });
      out.set(r.id, list);
    }
  };
  for (const r of before) {
    for (const n of news) {
      for (const m of finiteOf(r).filter((x) => finiteOf(n).includes(x))) {
        const minimal = [...new Set([...finiteOf(r), ...finiteOf(n)])].filter((x) => x !== m);
        compare([...STARTER_INGREDIENT_IDS, ...minimal, m], `${r.id} + ${n.id} materials only, ${m} last`);
        for (const extra of ladder) if (extra !== m && !minimal.includes(extra)) compare([...STARTER_INGREDIENT_IDS, ...minimal, extra, m], `${r.id} + ${n.id} materials + ${extra}, ${m} last`);
        compare([...STARTER_INGREDIENT_IDS, ...ladder.filter((x) => x !== m), m], `every ladder material, ${m} last`);
      }
    }
  }
  for (let k = 0; k <= ladder.length; k += 1) compare([...STARTER_INGREDIENT_IDS, ...ladder.slice(0, k)], `canonical ladder order, prefix ${k}`, true);
  let s = seed >>> 0;
  const random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let o = 0; o < randomOrders; o += 1) {
    const perm = [...ladder];
    for (let i = perm.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let k = 0; k <= perm.length; k += 1) compare([...STARTER_INGREDIENT_IDS, ...perm.slice(0, k)], `random order ${o}, prefix ${k}`);
  }
  return out;
}
