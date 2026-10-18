/**
 * Square Dough F2 (Issue #538, F_RESEARCH-AUDIT §7): the named allowlist of production recipes that require the
 * `tray-bake` Technique (a target whose `identityDimensions.pan` is "tray"). Empty until E (#521) adds grandma-pizza;
 * E's PR adds that one id here, re-runs `deductionProduction.gate` / `hint5Production.gate` with pan-axis states, and
 * records the swept counts in its Result. The gates assert this list equals the catalog-derived set **both ways**, so
 * a pan recipe cannot reach production without this edit (and the Hint 5.0 / DH4 privacy re-audit that goes with it).
 */
export const PAN_REQUIRING_RECIPE_IDS: readonly string[] = [];
