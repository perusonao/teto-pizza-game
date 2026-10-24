/**
 * Square Dough E-0 (#521, OD-544-1): the ONE definition of the pan "tray" technique allowlist. TEST SUPPORT ONLY -- nothing in
 * production imports this file. `deductionProduction.gate.test.ts` and `hint5Production.gate.test.ts` both read it, so a tray
 * recipe is allow-listed in one place and re-runs both gates together. Holds exactly `grandma-pizza` since Square Dough E-2 (#521);
 * adding an id is a deliberate act (OD-544-2: the exception is limited to `grandma-pizza`) that must come with the DH4 / Hint 5.0
 * privacy re-run and the Anti-Oracle section 15 recomputation. (The dough technique's own allowlist, #577, is deliberately not moved here.)
 */
export const PAN_TRAY_RECIPE_IDS: readonly string[] = ["grandma-pizza"];
