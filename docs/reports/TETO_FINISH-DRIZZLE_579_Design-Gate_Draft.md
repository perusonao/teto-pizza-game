# #579 FINISH liquid / DRIZZLE — Design Gate (draft, docs-only)

Status: DESIGN DRAFT / NO IMPLEMENTATION GO. Baseline main: `0016222145c4c88253380d53d5df40607f58e655` (PR #743). Authority: Issue #579; related #495, #604, #608, #294, #518, #521. This report is based on issue specifications; current runtime call paths and save serialization have NOT yet been independently verified.

## 1. Scope and constraints
- Goal: allow a post-bake sauce/paste application within FINISH, initially in Free Cooking / Research.
- Out of scope: Dinner, Lunch Rush, production enablement, new recipe release, rebalancing Scoring 2.0 (52/16/12/20), globally unified dragging, existing PR #738.
- Keep the existing solid POST_BAKE topping flow unchanged; preserve six-tab maximum and avoid a new permanent tab.
- Production OFF, shared Preview unchanged, no save schema or reducer change at this gate.

## 2. Candidate UX (not approved)
- FINISH tray presents eligible liquid/paste items only when explicitly enabled in Preview/DEV.
- Primary gesture: short continuous drizzle stroke over the dough; render a visible trail. Alternative: tap a point to apply a deterministic short drizzle mark, with equal resource cost and scoring semantics. Do not require precise dragging.
- Preserve cancel, reset, insufficient inventory, duplicate placement, stage transition, accessibility, 390x844 and 360x800 one-screen behavior.
- Do not reuse the pre-bake PAINT field without checking its bake-state coupling; POST_BAKE liquid must not acquire bake coloration.
- Candidate first material is undecided: compare honey, tahini, mayo, and dressing against existing catalog identities and real recipe requirements. No invented ingredient IDs or recipe entitlements.

## 3. Required technical investigation before implementation
1. Trace `PLACE_TOPPING` FINISH category guard, `canPlacePostBakeIngredient`, `sauceIds`, inventory debit and duplicate protections.
2. Trace `PlacedTopping` / sauce deposit representations, transient stroke geometry, persistence serialization, unknown-schema compatibility, reload and reset. Prefer existing v2 data shape only if semantically correct; otherwise propose an explicit migration gate, not a silent type overload.
3. Trace `computeScoringV2`, recipe Reference validation and provisional vs FINAL evaluation (#495). Define which existing component accounts for post-bake liquid, and ensure each physical application counts exactly once. No weight changes.
4. Trace signature/late-axis observation, Research anti-oracle, Hint, Dex and technique behavior. Confirm post-bake liquid is not mistakenly counted as pre-bake sauce.
5. Trace render layering, CUT/FINISH transitions, #518 filter isolation and how liquid trails behave on irregular dough and pizza slices.
6. Confirm Free Cooking / Research eligibility, failure skip, no inventory loss on cancel, and Dinner/Lunch Rush isolation.
7. Verify actual latest main and duplicate/claim gates again before editing any runtime file.

## 4. Proposed implementation slices (conditional)
- D0: independent code-path audit and Owner decisions, docs-only.
- D1: pure data model and geometry prototype behind Preview/DEV opt-in, unit tests; no production or save writes.
- D2: FINISH UI + tap fallback, render and accessibility, with Chromium/WebKit two-viewport E2E and Human Verification per policy.
- D3: scoring/persistence/Research integration only after explicit model decision, with regression and compatibility tests.
- D4: production activation is a separate Owner Gate; keep OFF until approved.

## 5. Owner decisions required
- OD-DZ-1: first target sauce and a concrete recipe/Free-only use case.
- OD-DZ-2: post-bake liquid representation: existing placement shape vs dedicated type/migration.
- OD-DZ-3: Scoring 2.0 component and Reference rules; #495 provisional scoring behavior.
- OD-DZ-4: primary stroke plus tap fallback; whether tap draws a short mark or a dot.
- OD-DZ-5: Preview/DEV HV entry and permission to update shared Preview (default: do not update).
- OD-DZ-6: whether post-bake liquid should participate in the existing late technique/signature axis.
- OD-DZ-7: first release scope (Free/Research only recommended), Dinner/Lunch Rush excluded.

## 6. Gate
DESIGN DRAFT ONLY. No source/test/CI/Preview/Production modifications. Next action: inspect the seven technical paths above on fresh main, report exact files/functions and compatibility implications, then request Owner's decisions. No PR or merge authorization implied.
