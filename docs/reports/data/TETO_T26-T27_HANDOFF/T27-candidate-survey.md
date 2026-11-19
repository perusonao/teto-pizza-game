# T27 candidate survey (scratch, read-only; preflight on main 6954a874 WITHOUT T26 — provisional, per-recipe runs)
Source: `node tools/content-train/make-spec.mjs --train T27-<id> --ids <id>` then `preflight.mjs`. 16 catalog-only recipes left after nashville-hot-chicken-pizza / nduja-pizza.

| recipe | status | blockers | Research canonical / non-canonical |
|---|---|---|---|
| keema-pizza | NEEDS_OWNER | NO_SAUCE_DECISION, LADDER_KEY_MATERIAL, RESEARCH_NON_CANONICAL | 0 / 22 |
| chicken-tikka-pizza | NEEDS_OWNER | NO_SAUCE_DECISION, RESEARCH_NON_CANONICAL | 0 / 28 |
| jerusalem-mixed-grill-pizza | BLOCKED | NO_SAUCE_DECISION, TQ1D_G7_CHEESE_FIRST | 0 / 34 |
| philly-cheesesteak-pizza | BLOCKED | NO_SAUCE_DECISION, TQ1D_G7_CHEESE_FIRST | 0 / 24 |
| hot-honey-pepperoni | BLOCKED | M7_POSTBAKE_SAUCE (post-bake honey) | 0 / 4 (future: re-letters shipped nashville canonically once T26 lands) |
| mentaiko-mochi-pizza | BLOCKED | DH4_OTHER_UNREACHABLE, NO_SAUCE_DECISION, TQ1D_G7_CHEESE_FIRST, LATE_PLACEMENT | 0 / 9 |
| sfincione | BLOCKED | RESEARCH_CANONICAL | 1 / 46 |
| caponata-pizza | BLOCKED | NO_SAUCE_DECISION, RESEARCH_CANONICAL | 1 / 25 |
| pizza-zucchine-menta | BLOCKED | RESEARCH_CANONICAL | 1 / 22 |
| bulgogi-pizza | BLOCKED | NO_SAUCE_DECISION, LATE_PLACEMENT, RESEARCH_CANONICAL | 1 / 24 |
| tsukimi-pizza | BLOCKED | DH4_OTHER_RISK, NO_SAUCE_DECISION, RESEARCH_CANONICAL | 1 / 13 |
| teriyaki-chicken-pizza | BLOCKED | NO_SAUCE_DECISION, TQ1D_G7_CHEESE_FIRST, RESEARCH_CANONICAL | 1 / 33 |
| hokkaido-cheese-pizza | BLOCKED | NO_SAUCE_DECISION, TQ1D_G7_CHEESE_FIRST, RESEARCH_CANONICAL | 1 / 13 |
| burrata-pizza | BLOCKED | RESEARCH_CANONICAL | 2 / 17 |
| pizza-baiana | BLOCKED | DH4_OTHER_RISK, RESEARCH_CANONICAL | 3 / 29 |
| pizza-chilena | BLOCKED | DH4_OTHER_RISK, RESEARCH_CANONICAL | 3 / 32 |
Reading: a STOP is a stop condition (canonical Research change, TQ1D G7, M7 post-bake sauce, DH4), not something to loosen. Only keema-pizza and chicken-tikka-pizza can proceed to an Owner packet (NO_SAUCE decision + per-ID Research approval). Not an approval, not a plan of record.
