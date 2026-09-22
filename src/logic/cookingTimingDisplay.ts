import type { MakingStep } from "../state/gameReducer";

/**
 * Gameplay UX PR-C (Timing Transparency, see
 * docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit B/C): a pure derivation of the
 * RESULT Timing Detail's per-step rows from data that already exists --
 * `CookingTimingState.perStepElapsedMs` (../logic/cookingTiming.ts) and a round's own
 * `CookingProfile.steps` (../data/cookingProfiles.ts). Deliberately takes `steps` as a plain
 * `MakingStep[]` rather than the `CookingProfile` type itself, so this stays decoupled from
 * ../data/cookingProfiles.ts and importable from a component without crossing a data/logic
 * layering line.
 *
 * Recipe-agnostic by construction: a step absent from `steps` (e.g. CHEESE for marinara/fugazza/
 * pizza-bianca, TOPPING for quattro-formaggi -- PR-A's own dynamic-step derivation) is never
 * shown here either, since it is filtered from the *order* source, not from `perStepElapsedMs`
 * itself. No per-recipe-id branching -- exactly the same discipline `getCookingProfile` already
 * uses for step derivation. BAKE is never a `MakingStep` (its own separate needle-tap minigame,
 * ../logic/cookingTiming.ts's own file header), so it can never appear in `steps` and therefore
 * never appears in this output -- no explicit BAKE exclusion needed here.
 *
 * A step present in `steps` but with no `perStepElapsedMs` entry yet (round abandoned mid-step,
 * or timing never started -- e.g. a Mission round, which has no `cookingTiming` at all) is
 * omitted, not shown as a fabricated `0:00` row, mirroring `perStepElapsedMs`'s own "absent, not
 * zero" convention (../logic/cookingTiming.ts).
 */
export interface StepTimingRow {
  step: MakingStep;
  elapsedMs: number;
}

export function stepTimingRows(
  steps: readonly MakingStep[],
  perStepElapsedMs: Readonly<Partial<Record<MakingStep, number>>> | null | undefined,
): StepTimingRow[] {
  if (!perStepElapsedMs) return [];
  const rows: StepTimingRow[] = [];
  for (const step of steps) {
    const elapsedMs = perStepElapsedMs[step];
    if (elapsedMs !== undefined) rows.push({ step, elapsedMs });
  }
  return rows;
}
