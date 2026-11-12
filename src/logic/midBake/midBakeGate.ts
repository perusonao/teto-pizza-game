/**
 * MID_BAKE (Issue #795) is deliberately unwired. Production activation requires a
 * separate Owner decision; importing the pure engine must never enable gameplay.
 */
export const MID_BAKE_EXPERIENCE_PRODUCTION = false;

export function midBakeExperienceEnabled(): boolean {
  return MID_BAKE_EXPERIENCE_PRODUCTION;
}
