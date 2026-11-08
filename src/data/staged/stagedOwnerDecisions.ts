/**
 * Owner decisions D-1..D-7 on the Staged Catalog (Issue #780, Owner 2026-11-08, on PR #788). Applied on top of the re-judgement
 * (stagedRejudge.ts) WITHOUT changing the staged data: every outcome below is a recorded, reversible status. STAGED ONLY.
 *
 *  D-1 No bulk exclusion of the 38 exception recipes. Prepare a per-recipe judgement: overlap kinds + process difference.
 *  D-2 The 22 open sauces go to source research. A NO_SAUCE that is not confirmed by a source is forbidden.
 *  D-3 The 7 chili tokens (唐辛子 / 赤唐辛子 / 青唐辛子) are ONE shared candidate; `chili-oil` is NOT confirmed.
 *  D-4 The 14 composition-conflict recipes take their PIZZA DB version as the provisional baseline. An id change only after a
 *      referential-integrity check (proposed ids are checked here; nothing is renamed).
 *  D-5 Raw leafy greens and citrus are added after the bake in principle; a recipe's own specific technique wins.
 *  D-6 The canonical-order Research letter changes of the 19 shipped recipes are NOT approved: the 25 causing recipes are
 *      stopped from promotion.
 *  D-7 taco-pizza and okonomiyaki-style-pizza are the first promotion candidates.
 */
import type { RecipeRejudge, Verdict } from "./stagedRejudge";
import type { StagedRecipe } from "./stagedTypes";

/** D-5: raw leafy greens (葉物) and citrus among the shipped + staged ids. Herbs are not leafy greens here. */
export const D5_LEAFY = new Set(["lettuce", "arugula", "spinach", "chicory", "puntarelle", "radicchio", "cabbage", "red-cabbage"]);
export const D5_CITRUS = new Set(["lemon", "orange", "lime"]);
/** D-3: the shared chili candidate (unconfirmed id; NOT chili-oil). */
export const D3_CHILI_TOKENS = new Set(["唐辛子", "赤唐辛子", "青唐辛子"]);
export const D3_CHILI_CANDIDATE = "chili-pepper (candidate, unconfirmed)";
/** D-7 */
export const D7_FIRST_CANDIDATES = ["taco-pizza", "okonomiyaki-style-pizza"] as const;

export type DecisionStatus =
  | "RESOLVED" // closed by a rule or an Owner decision (provisional where noted)
  | "WORK" // decided; implementation work remains (create a sauce, rename after the integrity check)
  | "SOURCE_RESEARCH" // D-2: needs the original source before anything is decided
  | "CANDIDATE_PENDING" // D-3: grouped into a shared candidate, confirmation pending
  | "EXCEPTION_REVIEW" // D-1: per-recipe exception judgement (dossier prepared)
  | "WAITS_MECHANIC"
  | "WAITS_IN_FLIGHT"
  | "AXIS_WITH_M1" // separable by the dough axis once M1 ships and R-3 approves it
  | "STAGED_PAIR" // overlap with another staged candidate, settled when choosing between them
  | "OWNER_DECISION"; // still needs an Owner decision not covered by D-1..D-7

export interface DecidedDependency {
  readonly kind: string;
  readonly id: string;
  readonly before: Verdict;
  readonly status: DecisionStatus;
  readonly by?: string;
  readonly note?: string;
}

export interface RecipeDecision {
  readonly id: string;
  readonly deps: readonly DecidedDependency[];
  /** D-6: this recipe re-letters a shipped recipe in the canonical order on its own -> promotion stopped. */
  readonly researchBlocked: boolean;
  /** D-5: ingredients proposed as POST_BAKE (raw leafy / citrus) for a salad-interpretation recipe. */
  readonly postBakeProposal: readonly string[];
  /** D-4: proposed id without the provenance suffix (null when unchanged). */
  readonly proposedId: string | null;
}

const SUFFIX = /-pizzadb(-p\d+|-row)?$/;

export interface DecisionInputs {
  readonly recipes: readonly StagedRecipe[];
  readonly judged: readonly RecipeRejudge[];
  /** staged recipe ids that alone change a shipped canonical Research letter (whatIf.research19.json culprits). */
  readonly researchCulprits: readonly string[];
  /** every id the proposed renames must not collide with (shipped recipes, staged recipes, in-flight ids). */
  readonly takenRecipeIds: readonly string[];
}

export function applyOwnerDecisions(input: DecisionInputs): RecipeDecision[] {
  const byId = new Map(input.recipes.map((r) => [r.id, r]));
  const culprits = new Set(input.researchCulprits);
  const taken = new Set(input.takenRecipeIds);
  return input.judged.map((j) => {
    const r = byId.get(j.id)!;
    const ids = j.proposedSet;
    // D-5 "a specific technique wins": only a technique applied to the ingredients themselves (prep / fry / mid-bake) overrides it.
    // A dough or pan mechanic of the recipe is not a technique of the leafy greens or the citrus.
    const hasIngredientTechnique = r.mechanics.some((m) => m === "PREP" || m === "FRY" || m === "MID_BAKE");
    const leafyCitrus = ids.filter((i) => D5_LEAFY.has(i) || D5_CITRUS.has(i));
    const isSaladR6 = r.ownerReasons.includes("MECHANIC_INTERPRETATION") && r.lateModes.some((m) => m.mode === "post_bake");
    const postBakeProposal = isSaladR6 && !r.applied.some((a) => a.startsWith("R-6")) ? leafyCitrus : [];
    const stripped = SUFFIX.test(r.id) ? r.id.replace(SUFFIX, "") : null;
    const proposedId = stripped && !taken.has(stripped) ? stripped : null;
    const deps: DecidedDependency[] = [];
    for (const d of j.judged) {
      const base = { kind: d.kind, id: d.id, before: d.verdict };
      let status: DecisionStatus;
      let by: string | undefined;
      let note: string | undefined;
      switch (d.verdict) {
        case "AUTO_RESOLVED":
          status = "RESOLVED";
          by = "rule";
          break;
        case "RULE_DECIDED_WORK":
          status = "WORK";
          by = "rule";
          break;
        case "DUPLICATE_COUNT":
          continue; // the same question is counted once, under the recipe's R-1
        case "WAITS_MECHANIC":
          status = "WAITS_MECHANIC";
          break;
        case "WAITS_IN_FLIGHT":
          status = "WAITS_IN_FLIGHT";
          break;
        case "AXIS_CONDITIONAL":
          status = "AXIS_WITH_M1";
          break;
        case "STAGED_PAIR":
          status = "STAGED_PAIR";
          break;
        case "EXCEPTION_NEEDED":
          status = "EXCEPTION_REVIEW";
          by = "D-1";
          break;
        default: {
          // OWNER_DECISION before the decisions
          status = "OWNER_DECISION";
          if (d.kind === "OWNER_RULE" && d.id === "R-1") {
            status = "SOURCE_RESEARCH";
            by = "D-2";
            note = "NO_SAUCE may not be confirmed without the source";
          } else if (d.kind === "OWNER_RULE" && d.id === "R-5") {
            status = "RESOLVED";
            by = "D-4";
            note = "PIZZA DB version is the provisional baseline";
          } else if (d.kind === "ID_SUFFIXED") {
            status = proposedId ? "WORK" : "OWNER_DECISION";
            by = "D-4";
            note = proposedId ? `rename to ${proposedId} after the integrity check (no collision, no reference outside staged)` : "the unsuffixed id is taken";
          } else if (d.kind === "OWNER_RULE" && d.id === "R-6") {
            if (postBakeProposal.length > 0 && !hasIngredientTechnique) {
              status = "RESOLVED";
              by = "D-5";
              note = `POST_BAKE: ${postBakeProposal.join(", ")}`;
            } else if (postBakeProposal.length > 0) {
              status = "OWNER_DECISION";
              note = "D-5 applies but the recipe has its own technique (D-5: the specific technique wins)";
            }
          } else if (d.kind === "UNRESOLVED_TOKEN" && D3_CHILI_TOKENS.has(d.id)) {
            status = "CANDIDATE_PENDING";
            by = "D-3";
            note = D3_CHILI_CANDIDATE;
          } else if (d.kind === "OWNER_RULE" && d.id === "R-7") {
            const tokens = r.unresolvedRelatedIds.map(([t]) => t);
            const open = j.judged.filter((x) => x.kind === "UNRESOLVED_TOKEN" && x.verdict === "OWNER_DECISION").map((x) => x.id);
            if (open.length > 0 && open.every((t) => D3_CHILI_TOKENS.has(t)) && tokens.length > 0) {
              status = "CANDIDATE_PENDING";
              by = "D-3";
              note = D3_CHILI_CANDIDATE;
            }
          }
        }
      }
      deps.push({ ...base, status, ...(by ? { by } : {}), ...(note ? { note } : {}) });
    }
    return { id: j.id, deps, researchBlocked: culprits.has(j.id), postBakeProposal, proposedId };
  });
}

/** Ready for promotion after D-1..D-7: every dependency RESOLVED, not research-blocked (D-6). WORK items are listed separately. */
export function promotableAfterDecisions(decisions: readonly RecipeDecision[]): { ready: string[]; readyWithWork: string[] } {
  const ready: string[] = [];
  const readyWithWork: string[] = [];
  for (const d of decisions) {
    if (d.researchBlocked) continue;
    if (d.deps.every((x) => x.status === "RESOLVED")) ready.push(d.id);
    else if (d.deps.every((x) => x.status === "RESOLVED" || x.status === "WORK")) readyWithWork.push(d.id);
  }
  return { ready, readyWithWork };
}
