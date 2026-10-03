# Issue #373 — HOME 「レシピ発見」 follows the cookable Research Entries (Result)

Audited main: `4250767e1af5e1cba1d118fa91090afe8d19c643`. Authority: Owner Decision 2026-10-03 (OD-1〜7), recorded in
Issue #373 and in `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md` (OD-RB-1 更新).

## Change

- `src/state/discoveryHint.ts`: pure `homeDiscoveryRoute(state)` on top of `researchableEntryIds` (no new parallel logic).
- `src/App.tsx`: HOME's `onStartFreeCook` → `handleStartDiscovery`: TARGETLESS → `handleStartFreeCook`; RESEARCH → existing
  `handleStartResearch`; CHOOSE → the existing Dex overlay (only while `mission.mode === "FREE"`, else the old targetless start).
- No reducer / save / Hint 5.0 / matcher / Dex UI change. `researchTargetId` stays session-only.

## Behaviour

| cookable entries | HOME 「レシピ発見」 |
|---|---|
| 0 | targetless Free Cook (no research context, no membership panel) |
| 1 | that entry is the Research Target (研究中 ？？？ピザ, 今回の試作結果 ○/×, Notebook RESEARCH_ROWS) — identical to the Dex door |
| 2+ | the Dex's anonymous Research cards open; nothing is started or picked; research starts only after the player's pick |

## Residual (not changed; follow-up Issue candidates)

- Pizza Select's 「🎨 レシピ発見へ」 and the Dex's own targetless CTAs still start without a Target. With a cookable entry the
  Hint sheet can still show the lone-candidate text without a 「研究中」 card on those doors.
- HOME Entry-1 players now get the Dex door's Hint pricing (the unlock fact is known to the Research Target → that rung is free).

## Tests

Unit: `homeDiscoveryRoute.test.ts`; App: `App.homeDiscovery.test.tsx` (A 0 / B 1 / C 2+ / D Dex direct / E parity);
E2E (Chromium 390×844 + 360×800): `e2e/home-research-entry-parity.spec.ts` (0 / 2+ / 1-entry HOME-vs-Dex parity of research
context, RESULT rows and Notebook). Existing specs that pinned "HOME = targetless" now start the targetless round through
Pizza Select (`src/test/discoveryEntry.ts`, `e2e/support/startFreeCook.ts`).
Screenshots: `docs/reports/screenshots/home-research-entry-373/` ("before" = the old HOME behaviour, reached through Pizza Select).
