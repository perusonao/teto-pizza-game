# #377 — Pizza Select 「レシピ発見へ」 routing (Result / Completion record)

Authority: Issue #377 Owner Decision OD-377-1..3, Contract 2.1 OD-RB-1 追補. Implementation: PR #383.

## Outcome
Pizza Select's 「🎨 レシピ発見へ」 uses HOME's Research Entry routing (`handleStartDiscovery` / `homeDiscoveryRoute`):

| cookable Research Entry | Pizza Select 「レシピ発見へ」 |
|---|---|
| 0 | targetless Free Cook (「🎨 レシピ発見の試作」, no Research Target) |
| 1 | that Entry is the Research Target |
| 2+ | the Dex opens; the player picks a Research card (nothing is auto-selected) |

## Production runtime diff
One line in `src/App.tsx`: Pizza Select `onGoFreeCook={handleStartFreeCook}` -> `{handleStartDiscovery}` (plus comments). No reducer, persistence, save/schema, Hint 5.0, #378, HAND 12, Dex footer or Dex CTA change.

## Test infrastructure (no Production UX kept for tests)
Targetless fixtures used Pizza Select as "the" targetless start on a save with a cookable entry. They now use `tools/testHooksPlugin.ts`, an in-memory Vite plugin that exposes a test-only start. It is active only for Vitest and for a dev server / e2e build started with `TETO_TEST_HOOKS=1`; `npm run build` never includes it (`dist` had 0 `__tetoTest`). `startTargetlessFreeCook` fails loudly if the hook is missing (Codex P2, fixed before merge). No Production button, query parameter, state or schema was added.

## Merge / post-merge
- PR #383 squash-merged: `a4944e45bebe6a55ff812e8fb535d5f3679c11a9` (head `f71c141`; CI, WebKit Gate and Layout Contract Gate green; 0 unresolved threads).
- Production deploy: Deploy to GitHub Pages run 37183443183 success (source `a4944e4`).
- Post-merge E2E WebKit run 37183443207 success (4 shards, Layout Contract Gate success).
- Pre-merge WebKit: two failures in specs outside the diff (`discovery3-no27-pesto-pollo`, `making-ui-1screen`) passed on one re-run of the same HEAD; main's earlier WebKit run also failed on a different gesture test.

## Automated verification (all PASS)
Entry 0 / Entry 1 / Entry 2+ routing through the real App (`src/App.pizzaSelectRouting.test.tsx`), HOME parity, Dex 「このピザを研究する」 unchanged, #353 Hint pin contract (`discovery-research-target`), #378 stock-blocked entry not counted as a candidate, targetless fixtures via the test hook. Vitest default 5930 passed; hand-on-9/12 and hand-off passed; Chromium 390×844 and 360×800 on the affected E2E passed; typecheck, lint (no new warnings), build clean. Before/after screenshots (390×844): `docs/reports/screenshots/pizza-select-routing-377/`.

## Owner Production HV (iPhone, 2026-10-04)
- **Entry 0: PASS.** Save data reset by the Owner; Pizza Select -> 「レシピ発見へ」 -> 「🎨 レシピ発見の試作」 cooking screen; no Research Target shown; the Dex's Research selection did not open (targetless Free Cooking).
- **Entry 1: Owner HV NOT PERFORMED.** Automated verification PASS only.
- **Entry 2+: Owner HV NOT PERFORMED.** Automated verification PASS only.

No save was artificially advanced or edited to reach Entry 1 / 2+. They remain optional Owner HV items to be checked when normal play reaches them.

## Acceptance (Issue #377 / OD-377-1..3)
- OD-377-1 (HOME-identical routing): met; Entry 0 also by Owner HV, Entry 1 / 2+ by automated verification.
- OD-377-2 (Dex CTA and #353 pin unchanged): met.
- OD-377-3 (a fully targetless trial at Entry >= 1 is not decided here): out of scope, still undecided.
- Test-only start without Production UX; Contract 2.1 OD-RB-1 updated; no reducer/persistence/save/schema change: met.

## Status
COMPLETE for the confirmed scope (Entry 0 Owner HV PASS; Entry 1 / 2+ automated PASS, Owner HV not performed). Out of scope and unchanged: #360, #378, Expansion Slice 1, HAND semantics, Dex footer 「次のピザを作る」.
