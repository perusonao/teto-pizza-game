# whatIf.research.json — 14 non-canonical rows with fewer observed letter changes (informational sampling diff)

Measurement: `stagedWhatIf.research.test.ts` → `researchLetterChangesAcrossOrders(newIds=STAGED_RECIPES ids, all=[...RECIPES, ...whatIfRecipes()], randomOrders=4)`; seed = default 20261105; `researchCohortLetters` on the canonical ladder order plus 4 seeded random acquisition orders.
Before = main `6954a874` golden (staged 84 recipes → newIds 84). After = main + T26 apply + staged rows of nashville-hot-chicken-pizza / nduja-pizza removed (newIds 82; both recipes now in the shipped `RECIPES`).
NOT claimed: that the cause is proven. The change of `newIds` and the shipped set changes which orders the seeded sampler draws; that is the working explanation only.

| recipe | observed before (n) | observed after (n) | only before | only after |
|---|---|---|---|---|
| baba-ganoush-pizza | 13 | 11 | I->L K->N |  |
| calabresa-argentina | 18 | 17 | E->F |  |
| jamaican-jerk-chicken-pizza | 4 | 3 | D->E |  |
| palmito-pizza | 10 | 9 | A->D |  |
| parmigiana-pizza | 7 | 6 | E->F |  |
| peruvian-aji-amarillo | 7 | 6 | E->F |  |
| pesto-noci-pizza | 3 | 1 | -->B -->C |  |
| pesto-patate | 7 | 6 | G->I |  |
| pesto-pollo | 9 | 8 | G->H |  |
| pizza-alla-crudaiola | 11 | 10 | C->F |  |
| pizza-asparagi-limone | 10 | 9 | D->G |  |
| pizza-finocchi-salad | 9 | 8 | I->L |  |
| potato-mayo-pizza | 8 | 7 | H->J |  |
| thai-chicken-pizza | 6 | 4 | C->D F->G |  |