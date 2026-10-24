/**
 * Square Dough E-0 (#521, OD-544-1): the ONE definition of the pan "tray" technique allowlist. TEST SUPPORT ONLY -- nothing in
 * production imports this file. `deductionProduction.gate.test.ts` and `hint5Production.gate.test.ts` both read it, so a tray
 * recipe is allow-listed in one place and re-runs both gates together. Holds exactly `grandma-pizza` since Square Dough E-2 (#521);
 * adding an id is a deliberate act (OD-544-2: the exception is limited to `grandma-pizza`) that must come with the DH4 / Hint 5.0
 * privacy re-run and the Anti-Oracle section 15 recomputation.
 */
export const PAN_TRAY_RECIPE_IDS: readonly string[] = ["grandma-pizza"];

import { pinsaEnabled } from "../../data/pinsaGate";

/**
 * Dough Kind (#577 P3-b-3): the dough technique's named allowlist, in the same single place. `pinsa-romana` requires the dough technique
 * (and `late-addition`) only in a build where its gate (`PINSA_PRODUCTION`, ../../data/pinsaGate.ts) is open; closed, the set is empty and the gates
 * below keep asserting that NO recipe requires a dough technique. Opening the gate re-runs both gates (DH4 and Hint 5.0) with this id allow-listed.
 */
export const DOUGH_PINSA_ROMANA_RECIPE_IDS: readonly string[] = pinsaEnabled() ? ["pinsa-romana"] : [];
