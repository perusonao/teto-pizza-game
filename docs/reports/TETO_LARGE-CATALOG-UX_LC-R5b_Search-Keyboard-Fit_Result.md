# Large Catalog UX — LC-R5-b Result (Pantry Search, approved aliases, IME contract, Mode C keyboard fit)

Branch `claude/lc-r5b-search-keyboard-mbinf3`, from `origin/main` `21dc0a6` (PR #308 = LC-R5-a merge). **No PR yet** (Owner instruction). Authority: LC-R5 Fresh Audit `b584b7a` (§21), Implementation Verification Plan `855e9fb` (§6), R5-b PreAudit `77482f5` (§15〜§18 latest), Japanese Search Alias Audit `195494a` (OD-A1〜A6), Real-Device Discovery (Owner: PASSED — Mode C adopted).
Scope kept to R5-b: search + Mode C + IME + approved aliases. **No** pins / hand / #197 / selected strip / R5-c+; `HAND_ENFORCEMENT_ENABLED` unchanged (`false`); no save schema change; no Dinner / guided / Lunch Rush change.

## What changed (production)
- `src/data/ingredientSearchAliases.ts` (new): the search-only alias authority, **exactly the three Owner-approved aliases** — onion 玉ねぎ, egg 卵, mozzarella モッツァレラチーズ (`provenance: "owner-approved"`). Nothing guessed; the staging candidates (gorgonzola / parmigiano / fontina `…チーズ`, ペペロニ, 馬鈴薯 …) are absent.
- `src/logic/catalog/catalogTypes.ts` (optional `searchAliasesJa`), `catalogSource.ts` (copies the table into the descriptor; the only importer of the table), `catalogText.ts` (`matchesSearch` also tests the aliases with the same normalized **substring** rule; no reverse / fuzzy match, OD-A3). `readingJa` / `compareReading` untouched.
- `src/components/pantrySearchIme.ts` (new, pure): the IME contract. `src/components/pantryViewportFit.ts` (new): pure `computePantryFit` + `usePantryViewportFit` (pantry-only `visualViewport` use).
- `src/components/IngredientPantry.tsx`: the search row (`role=search`; `type=search`, `inputMode/enterKeyHint=search`, `autocomplete/autocapitalize/autocorrect=off`, `spellcheck=false`, `maxLength=20`, `aria-label="材料を検索"`, ✕ `検索をクリア`), `appliedText` filtering (`queryCatalog({ shelves, text })` = owned AND shelf AND text), plain-Enter blur → list focus, unchanged Escape (closes from the field), list `scrollTop = 0` on a new applied text, neutral 0-result text 「該当する材料がありません」 (identical for unowned names, gibberish and empty results).
- `src/App.css`: baseline sheet height = the shell ceiling (`100dvh − safe-top − 20px`, `100vh` fallback; was `min(70dvh, …)`), search row styles (16px field, 44px field / ✕, native cancel button hidden), `.pantry-sheet--fit` (Mode C).
- Not changed: `GameScreen.tsx`, `IngredientTray.tsx`, `prepareDock.ts`, `handSession` / `workingSet` / `handPolicy`, state, save, `ingredients.ts`, `ingredientShelf.ts`, `ShelfChips`.

## Mode C adaptation (harness behaviour → production contract; harness code not copied)
- The hook publishes only `--pantry-vv-h`, `--pantry-vv-bottom` and the class `pantry-sheet--fit`; **CSS decides the height**: `min(ceiling, --pantry-vv-h − safe-top − 8px)`, bottom = the visual viewport's bottom edge. The fit never enlarges past the ceiling and keeps the safe-area top.
- Applies while the field is focused OR the visual viewport is ≥ 120px smaller than the layout viewport (keyboard-like; a toolbar-sized change is ignored); released when both are false and always on unmount. Listens to `visualViewport` `resize` + `scroll` through one rAF; no transition.
- **Fallback**: no `visualViewport`, non-finite / non-positive values, or an exception → nothing is applied and the plain CSS ceiling stays (unit + e2e).
- Confined to the pantry: a boundary test pins `visualViewport` to `pantryViewportFit.ts` only.
- Ordinary search / result / shelf changes never move the sheet (e2e: outer sheet, list, search, chips and header bounds identical across text / one row / alias / zero rows / shelf); only a visual viewport change does, and releasing it restores the baseline bounds exactly (e2e).

## IME implementation
Two strings: `value` (shown, incl. an unconfirmed composition) and `applied` (filters the list). While `composing` (`compositionstart` … `compositionend`, or an input event with `isComposing`) `applied` does not move, so the list keeps its previous result — **no empty flash** for 「たまねき」 or a kanji candidate. `compositionend` applies the confirmed string; a following `input` with the same value is idempotent (Safari order), and the reverse order gives the same state. Input without a composition (paste, delete, latin, dictation, ✕) applies immediately. A blur / close settles an interrupted composition (no stuck flag). Confirming Enter (`isComposing`, `keyCode 229`, composing flag, or < 50ms after `compositionend`) never blurs; a plain Enter blurs and focuses the list. Verified with a real Chromium composition (CDP `imeSetComposition`) at 4 viewports and with unit tests (ordering, blur, close, ✕).
Note: the first-candidate contract has no incremental narrowing while a kana composition is open; the second candidate (hold the last non-empty result) is **not implemented** and is a real-device HV judgement (PreAudit §18.5-7).

## Alias result
`玉ねぎ` / `たまねぎ` / `タマネギ` / `ﾀﾏﾈｷﾞ` → onion only; `卵` / `たまご` → egg; `モッツァレラチーズ` / `ﾓｯﾂｧﾚﾗ` → mozzarella; unapproved forms (ペペロニ, 馬鈴薯, 大蒜, 玉葱, `…チーズ` of gorgonzola / parmigiano / fontina, ブラックオリーブオイル) → 0 rows; an alias of an UNOWNED ingredient never surfaces. Alias Audit gates T-1〜T-8 implemented in `ingredientSearchAliases.test.ts`; T-9 (boundary) in `catalogBoundary.test.ts`. The search field is shown only for the topping category (22 owned > 6), so mozzarella's alias is exercised at the data / query level (the cheese step has 4 owned rows and no field, by contract).

## Four-viewport measurements (Chromium real layout; topping step, 22 toppings owned, chips + search)
Decisions from these numbers: **baseline sheet height = the shell ceiling `innerHeight − 20` (safe-top 0 here)**; **keyboard-fit = `min(ceiling, vvHeight − safe-top − 8)` anchored on the visual viewport bottom**; **minimum usable list height = one full tile row (71.2px) above the keyboard**, asserted in e2e.

| viewport | R5-a sheet (70dvh) | baseline sheet | baseline list (search + chips) | rows | keyboard vvH (K=338) | fitted sheet y → bottom / h | fitted list h | rows | full rows above keyboard |
|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 590.8 | **824** | 617 | 7.9 | 506 | 8 → 506 / 498 | 291 | 3.8 | 3 |
| 360×800 | 560 | **780** | 573 | 7.3 | 462 | 8 → 462 / 454 | 247 | 3.2 | 3 |
| 390×664 | 464.8 | **644** | 437 | 5.6 | 326 | 8 → 326 / 318 | 111 | 1.5 | 1 |
| 360×640 | 448 | **620** | 413 | 5.3 | 302 | 8 → 302 / 294 | **87** | 1.2 | 1 |
Search field 44 / ✕ 44×44 / chips 46 / font 16px at every viewport. Keyboard height 338 is the shrink measured on the real iPhone in Discovery (714 → 376); Chromium cannot show a keyboard, so the keyboard is a **simulated** visual viewport (`FAKE_VV` in the e2e). Stage and dock identical (asserted); page never scrolls; sheet top ≥ 8px; header / search / chips above the keyboard.
**Small-viewport judgement:** every viewport keeps ≥ 1 full result row above a 338px keyboard, so no UI-structure change was needed and no Owner decision is raised. The margin at 360×640 is thin (87px list vs a 71px row, i.e. it holds up to K ≈ 354); a taller keyboard or the R5-c selected strip (+52px) would leave < 1 row there — see risks.

## Verification
- Vitest full: see the final numbers in the report footer (updated at the end of the run). New: `pantrySearchIme.test.ts`, `pantryViewportFit.test.tsx` (pure + hook lifecycle: coalescing, release, blur-with-keyboard, unmount cleanup, no `visualViewport`, NaN, throwing getter), `IngredientPantry.search.test.tsx` (visibility rules, attributes, CSS 16px/44px, matching, alias, AND with shelf, chips independent of text, unowned = identical empty state, IME ordering / blur, ✕, Enter, Escape, no-fit fallback), `ingredientSearchAliases.test.ts` (T-1〜T-8), boundary tests (alias importer, `visualViewport` confined, no storage / selection / hand imports in the pantry). R4 tests updated only where the contract changed (the search row precedes the chips; the list cost includes the search row).
- Chromium e2e: new `e2e/large-catalog-pantry-search.spec.ts` (4 viewports, IME through CDP, simulated keyboard, restore, Enter / Escape / focus return / reopen, no-`visualViewport` fallback) and the R3 / R4 specs (height expectation moved from 70dvh to the ceiling, list-cost bound widened by the search row) — all pass, plus `inventory-modal-stable-bounds`.
- Mutation gate: `tools/large-catalog-ux/mutation-check.mjs` adds **M60〜M82** (all 23 killed on their own run); the full-gate result is in the footer.
- `tsc -b` clean, `vite build` OK, `oxlint` no findings in changed files (2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts`).
- WebKit: not runnable here; CI runs it once a PR exists. **No real-iPhone check of this build has been done** (see HV).

## Human Verification (Policy)
- Tool: `tools/large-catalog-ux/hv-pantry-search.mjs` (before = R5-a look via CSS override; after = this build; keyboard is simulated). Screenshots (committed): `docs/reports/screenshots/large-catalog-pantry-search/`. Video (not committed; delivered directly): `artifacts/review/lc-r5b/`.
- **Required real-iPhone check (Safari AND standalone)**: PreAudit §9 H-1〜H-21 on the Preview build, plus: keyboard release restores the exact sheet bounds and `visualViewport.offsetTop = 0`; plain / confirming Enter; Escape (hardware keyboard); ways to dismiss the keyboard; IME first candidate feels acceptable (no narrowing until confirmation) — else decide on the second candidate; 玉ねぎ / 卵 hit after real conversion; 360×640-class small device; list ≥ 1 row above the real keyboard.

## Risks
1. standalone / PWA not verified (Discovery was Safari only). 2. Thin margin at 360×640 (see above); the selected strip in R5-c will need its own budget. 3. The real keyboard-release timing / `layoutH` (`documentElement.clientHeight`) on iOS versions. 4. IME first candidate has no incremental narrowing (HV judgement). 5. Chromium-only automated evidence for layout; the keyboard is simulated. 6. The safe-area-bottom padding stays while fitted (as in the validated Discovery Mode C).

## Final numbers (footer)
- Vitest full: **252 files, 4937 passed**, 1 skipped. `tsc -b` clean; `vite build` OK; `oxlint`: only the 2 pre-existing warnings.
- Mutation gate (full, `mutation-check.mjs`): **86 mutants killed** (M1〜M82 incl. M60〜M82 new). M42 was re-targeted to the new row query (its old edit string no longer existed) and re-run: killed.
- Chromium e2e (390×844 and 360×800 projects, which cover all four viewports): `large-catalog-pantry-search` (repeated 6× on both projects: 24/24), `large-catalog-pantry-shell`, `large-catalog-pantry-shelves`, `inventory-modal-stable-bounds`, `free-cooking-phase3-2`, `dinner-mission`, `stage-size-stability`, `layout-invariants-lb`, `discovery-hint-sheet`, `lunch-rush-material-shortage` — pass. One search-spec run failed once for a test race (the fit class is already set, with a no-op geometry, when the field gets focus; the test now waits for the shrunk bounds) — a test fix, not a product change.
- Isolation: no `GameScreen` / tray / `prepareDock` / state / save change; the pantry entry gate and the R5-a tests are untouched and pass; the Dinner, guided and Lunch Rush specs above pass; `HAND_ENFORCEMENT_ENABLED` still `false`.
- HV artifacts: 40 screenshots in `docs/reports/screenshots/large-catalog-pantry-search/` (before / after at the four viewports, alias, zero rows, search + shelf, simulated keyboard, released, cooking continues); WebM videos (not committed): `artifacts/review/lc-r5b/lc-r5b-pantry-search-390x844.webm` (885,283 B), `…-360x800.webm` (803,729 B). The simulated-keyboard frames show the fitted sheet only; the keyboard itself is not drawn.

## Real-device Human Verification (Owner-reported; recordings are not committed)
Preview build: Preview repo `perusonao/teto-pizza-game-preview`, `deploy-from-source` run of `7bf14861b30227c0325ca1cc09d96f435f6448df` (badge `PREVIEW · 7bf1486`; Preview commits `dd12d76`, helper `f5c46a5`; Pages run `36641994026` success). The Preview save was seeded through the static helper `hv-r5b-setup.html` (Preview repo only; not game code). Owner verdict: **A. R5-b HV PASS — PR READY**.
- **Safari (recording): PASS. standalone / Home Screen (recording): PASS.** An additional geometry-recovery recording: PASS. No serious layout regression in either mode.
- Real iOS Japanese IME: PASS; no conspicuous empty-result flash during a composition; 「玉ねぎ」 search: PASS (onion, 1 row).
- Keyboard fit: PASS, at least one result row above the keyboard.
- Keyboard release with the pantry still open: back to the baseline sheet geometry: PASS. After closing the pantry the stage / dock geometry is restored: PASS.
- Extra numbers from a Mac Web Inspector were not required by the Owner and were not taken; the Discovery run (Mode C, same approach) measured the visual viewport 714 → 376 on the real device.
- The two risks that were open before HV (standalone; keyboard-release geometry) are closed by this verification. Remaining, unchanged: the thin 360×640 margin and the R5-c selected-strip budget.

## Merge-readiness gates (re-run after `origin/main` advanced to `af8d46d`)
`origin/main` moved by PR #309 (docs / data / tools only: the 62-ingredient taxonomy audit; no overlap with this branch). It was merged into the branch (no rebase, no conflict). Re-run on the merged head: `tsc -b` clean; `oxlint` 2 pre-existing warnings only; `vite build` OK; Vitest **252 files, 4937 passed**, 1 skipped; Chromium e2e (390×844 and 360×800 projects): pantry search / shell / shelves, `dinner-mission`, `lunch-rush-material-shortage`, `free-cooking-phase3-2` — 40 passed, 8 intentional skips. Mutation gate 86/86 (run before the merge; no production file changed by the merge). WebKit runs in CI on the PR.
