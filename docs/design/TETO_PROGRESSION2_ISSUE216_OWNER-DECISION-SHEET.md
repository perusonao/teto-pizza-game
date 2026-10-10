# Issue #216 — Owner Decision Sheet

Only choices that must be made before changing #205 are listed.

| ID | Decision | Options | Tested recommendation (not final) | Status |
|---|---|---|---|---|
| OD216-1 | unlock-fee curve | F0_NO_FEE_CONTROL, F1_LIGHT, F2_BALANCED, F3_HEAVY | F2_BALANCED | OWNER_REQUIRED |
| OD216-2 | non-star eligibility assignment policy | STAR_AUTHORITY, MIXED_MONOTONIC, PER_ROW_AUTHORED | PER_ROW_AUTHORED using MIXED_MONOTONIC as tested baseline | OWNER_REQUIRED |
| OD216-3 | capability unlock policy | A_PAID, B_AUTO, C_TUTORIAL | B_AUTO for foundational; prerequisite-safe gateway C_TUTORIAL for interaction-heavy; reject blanket A_PAID | OWNER_REQUIRED |
| OD216-4 | author k=max minCount for 83 authority-only ingredients before they are saleable | AUTHOR_WITH_RECIPE_DATA, KEEP_NOT_FOR_SALE | KEEP_NOT_FOR_SALE until authored | CONTENT_AUTHORING_REQUIRED |

## Explicitly not a decision here

- M4 pieces/counts, no migration: already decided in PR #214.
- Completion Gate/scoring: Issue #215.
- 172-row evidence classification: inherited from PR #189.
- Merge/rebase/update of #205/#206/#209/#211/#213/#214: outside scope.
- Old TG-1: must not start until OD216-1..3 are selected and required k rows are authored or fail-closed.
