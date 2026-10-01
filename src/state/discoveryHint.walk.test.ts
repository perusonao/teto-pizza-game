import { vi } from "vitest";
import { defineFinalGateWalk } from "./testSupport/finalGateWalk";

// Hint 5.0 is ON in production (H5-6). This suite pins the pre-Hint-5.0 purchase behaviour, which is the
// rollback path, so it runs with the ladder flag OFF.
vi.mock("../logic/discovery/hint5Flag", () => ({ HINT5_LADDER_ENABLED: false }));

/**
 * Discovery Hint 2.0 (Issue #229) Final Gate: the whole 25-recipe ladder played through the real
 * reducer, from a brand-new save to a complete Dex, using only what a player sees:
 *
 *  1. Free Cooking + 「ヒント」: the sheet's empty state (SHOP_NEW / REFILL) sends the player to the
 *     Shop, which the walk does through the real PURCHASE_INGREDIENT / RESTOCK_INGREDIENT actions.
 *  2. With a target: reveal every step (the sheet stops by itself), read the named ingredients.
 *  3. Bake exactly the named ingredients: at Dex 0 that is the Margherita discovery (the one
 *     onboarding exception); otherwise the RESULT shows a one-step near-miss (never the answer).
 *  4. Try the owned ingredients of the hinted kind one at a time until the real matcher reports
 *     NEW_DISCOVERY -- which must be the hint's own target -- and move on.
 *
 * Discovery Hint Economy 1.0 (Issue #232, HE-2): step 2 buys each level through the real
 * PURCHASE_DISCOVERY_HINT (Dex 0 free, then Candidate B 5/10/20/40), and the walk checks the Pitz
 * charged and the purchase ledger at every stage.
 *
 * Discovery Hint 3.0 (Issue #238, H3-3): from Dex 1 step 2 buys Selectable Hint facts through the
 * real PURCHASE_SELECTABLE_HINT (rotating the category preference) until the sheet answers with
 * the generic guidance; the walk checks the Pitz charged (never above the recipe's Hint 2.0 cost),
 * the fact ledger, and that the legacy `discoveryHintPurchases` never moves. Dex 0 keeps the free
 * Hint 2.0 onboarding.
 *
 * No recipe id is ever read from the sheet: the walk only uses `hintSheetView`'s steps (ingredient
 * ids + text) and the RESULT's near-miss class. The target id is read from `hintSession` for the
 * assertions only.
 */

defineFinalGateWalk("Final Gate: the 25-recipe ladder from a new save to a complete Dex, hints only");
