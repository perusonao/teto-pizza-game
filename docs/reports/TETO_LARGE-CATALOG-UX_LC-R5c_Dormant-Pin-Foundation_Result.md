# Large Catalog UX — LC-R5-c Result (dormant pin foundation)

Branch `claude/lc-r5c-dormant-pin-foundation`, from `origin/main` `b35739ad51380d621d994e46f9876a007630e360` (PR #310 = LC-R5-b merge). **No PR** (Owner instruction).
Authority: LC-R5-c Fresh Audit (`docs/reports/TETO_LARGE-CATALOG-UX_LC-R5c_Fresh-Audit.md`, branch `claude/lc-r5c-fresh-audit` @ `0ef71f5`, brought onto this branch) + the Owner Decisions OD-R5c-1〜5 recorded below; LC-R5 Fresh Audit §21 (OD-R5-1〜12, §21.1 #197); Implementation Verification Plan `855e9fb` §4 / §7.
Scope: R5-c only. `HAND_ENFORCEMENT_ENABLED` stays `false`; no visible hand filtering; no R5-d (tray does not read pins; no page-level #197 wiring); no R6; no save / persistence change; no Dinner / guided / Lunch Rush change; R5-b search / IME / Mode C untouched; header / subtitle untouched.

## Owner Decisions (recorded; LC-R5-c)

| ID | Decision |
|---|---|
| **OD-R5c-1** | R5-c implements the pin **foundation**; the production pin UI is **not** shown. Hand behaviour and pin UI go public **together** when R6 enables `HAND_ENFORCEMENT_ENABLED` (a pin UI without a tray effect would be an incomplete UX). |
| **OD-R5c-2** | The future selected / pinned UI is **方式 D**: strip in normal state; strip hidden automatically while the keyboard is shown; tile pin badge, `aria-pressed` and re-tap unpin are kept. |
| **OD-R5c-3** | The keyboard-time auto hide is allowed: a responsive adaptation to the visual-viewport constraint, not a user-controlled collapsible. OD-2 "never hidden" = access to / confirmation of the pin state is never lost; badge / `aria-pressed` / unpin stay, so the contract holds. |
| **OD-R5c-4** | No subtitle → title merge in R5-c; the R5-b HV-verified header geometry stays. |
| **OD-R5c-5** | Whether a tile tap during the keyboard closes the keyboard or keeps the search focus is decided at the R6 production activation by real-device HV; not decided for the dormant foundation. |

## What changed (production code; all behind the dormant switch)

- `src/logic/catalog/pinEdit.ts` (new, pure): `togglePin` (Model D, one tap = one direct pin edit; OWNED ∧ active category only; **no-stock ⇒ no new pin**; an existing pin — also at zero stock — is always removable; a refused tap returns the same session object), `pinsInCategory` (read-time prune of invalid pins), `clearPins` (「おまかせに戻す」, active category only), `pinTileState`, `selectedStripRendered`. Imports only `catalogTypes` and the R2 `handSession` operations (R2 pure layer unchanged).
- `src/App.tsx`: `const [handSession, setHandSession] = useState<HandSession>(emptyHandSession)` — App-level, session-only; **not** reset on round change, making-step change, HOME, FREE restart or a Dinner run; empty after reload / app restart (Full Game Reset reloads); never in `GameState`, never saved. Passed to `GameScreen` as `handSession` + `onHandSessionChange={setHandSession}` (the only writer handed out).
- `src/screens/GameScreen.tsx`: relays the pins to the pantry and passes `handEditing={HAND_ENFORCEMENT_ENABLED}` (= `false`). No other change (the entry gate, the tray and `selectedIngredientId` are untouched).
- `src/components/IngredientPantry.tsx`: new optional props `handEditing` (default `false`), `pinSession`, `onPinSessionChange`. With `handEditing` **off** (production) the rendered DOM is byte-identical to R5-b (unit-tested). With it on (tests only): each tile is a `<button aria-pressed>` (click, not pointerdown), 📌 badge on pinned tiles, no-stock tiles `aria-disabled`, a 「選択中」 strip (`role="group"`, per-pin 「〇〇を外す」 44px buttons, 「おまかせに戻す」) between the chips and the list, rendered only while ≥ 1 pin; **no digits** (no pin count / capacity, OD-R5-7). Pins survive shelf / search changes (OD-2); a pin never touches `scrollTop` or search.
- `src/App.css`: selectors for the dormant UI only (`.pantry-tile--editable`, `.pantry-tile__toggle*`, `.pantry-tile__pin-badge`, `.pantry-sheet__pins*`, `.pantry-pin`) and the 方式 D rule `.pantry-sheet.pantry-sheet--fit .pantry-sheet__pins { display: none; }`. None of them matches the production DOM.

## #197
Enforcement is off ⇒ the Builder tray's visible set never depends on pins ⇒ no clear evaluation is wired (R5-d). Pinned by `App.handPins.test.tsx` through the real App: tray page 2, select ソーセージ, open the pantry, pin / unpin / search / おまかせに戻す / pin, close ⇒ tray chips, `aria-pressed`, classes and the page label are **identical**, the selection is kept and still places a piece (selection clear = 0, tray page change = 0). Mutant M93 (a pin edit clears the selection) is killed.

## Privacy
`pinEdit` imports no recipe / discovery / hint / state / save code (boundary test: its imports are exactly `./catalogTypes`, `./handSession`). The pantry names the `HandSession` type only (type import) and still imports nothing from recipes / discovery / hints. Pins accept OWNED ids of the active category only. No count / capacity text anywhere (M96 killed). Pins never reach storage (M97 killed; the save string is identical before / after pin edits; no `hand` / `pins` key in the save).

## Verification
See "Final numbers" below (filled after the full run).

- Vitest new: `src/logic/catalog/pinEdit.test.ts` (12), `src/components/IngredientPantry.pins.test.tsx` (9: production byte-identical DOM, no UI with pins present, Model D toggle, no-stock rule, category isolation + prune, OD-2 across search / shelf, strip unpin / おまかせに戻す, no digits / no scroll reset, 方式 D CSS), `src/App.handPins.test.tsx` (3: #197 no-clear + tray unchanged; lifecycle across a finished round, HOME, FREE restart, save untouched, empty after app restart; mid-round HOME + Dinner run round-trip, Dinner shows no pantry / pin UI). The App tests force `HAND_ENFORCEMENT_ENABLED` on with `vi.mock` (the UI does not exist otherwise).
- Boundary (`catalogBoundary.test.ts`): allow-lists lifted deliberately (pantry → `handSession` type + `pinEdit`; GameScreen → `handPolicy`, `handSession` type; App → `handSession`); new LC-R5-c gate: the only production `handEditing={…}` is `GameScreen: HAND_ENFORCEMENT_ENABLED`, the const is `false`, App has exactly the declaration + the setter hand-off, persistence / reducer / IngredientTray know nothing about pins.
- Mutation gate: `tools/large-catalog-ux/mutation-check.mjs` adds **M83〜M97**, focused run **15/15 killed**.
- e2e new: `e2e/large-catalog-pin-dormant.spec.ts` — 4 viewports: no pin UI in production, a tile tap changes nothing, tray unchanged after close, sheet / list heights = R5-b baseline (Chromium), with the simulated keyboard (K = 338) ≥ 1 full row and list ≥ R5-b baseline (360×640: 87px).

## Final numbers
- Vitest full (idle machine): **255 files, 4962 passed, 1 skipped, 0 failed** (R5-b: 252 files / 4937). An earlier full run done in parallel with the e2e run had one timeout in `src/logic/pizzaReferenceLayout.test.ts` (5139ms vs the 5s default; file untouched by this branch); it passes alone (16/16) and in the idle full run.
- `tsc -b` clean; `oxlint`: only the 2 pre-existing warnings (`scoringV2.noSauceProfile.test.ts`); `vite build` OK. The dormant pin code and CSS selectors are in the production bundle but are never rendered (`handEditing` is `false`; asserted by unit, boundary and e2e).
- Mutation gate (focused, M83〜M97): **15/15 killed**; the source was verified restored afterwards.
- Chromium e2e (`iphone-390x844` + `iphone-360x800` projects): `large-catalog-pin-dormant` (new, 4 viewports), `large-catalog-pantry-search`, `-shell`, `-shelves`, `dinner-mission`, `lunch-rush-material-shortage`, `free-cooking-phase3-2`, `inventory-modal-stable-bounds`, `stage-size-stability` — **56 passed, 16 intentional width-guard skips, 0 failed**.
- Geometry (production, Chromium, R5-b baseline from main `b35739a`): sheet 824 / 780 / 644 / 620, list 617 / 573 / 437 / 413 (390×844 / 360×800 / 390×664 / 360×640) — unchanged; keyboard (simulated K = 338) list ≥ 291 / 247 / 111 / **87** with ≥ 1 full row — unchanged.
- **WebKit: not run here** (not installed in this container); the new spec is WebKit-ready (DOM contract + ≥ 1 row; pixel values Chromium-only) and runs in CI once a PR exists.

## Review follow-up (PR #312)
- Codex P2 (a non-pinnable no-stock tile had only `×0` + reduced opacity as its visible cue): the dormant toggle now also shows a visible 「ざいこなし」 label on a disabled (not pinned, no stock) tile, as IVP §7 specified; a pinned no-stock tile (removable) shows none. Production DOM unchanged (the byte-identical test and the dormant e2e now also assert the label / class is absent). Re-run: pin / catalog / App tests 140 passed; Vitest full 255 files, 4962 passed, 1 skipped; `tsc -b` clean; Chromium e2e pin-dormant + pantry-search pass.

## Human Verification
Not applicable to this slice (Policy §2): no production-visible UI / interaction changes — the production DOM is byte-identical to R5-b and the 4-viewport geometry is unchanged (asserted). The pin UI is dormant; its HV (390×844 video + before/after screenshots, real-device keyboard behaviour OD-R5c-5) belongs to the R6 activation.

## Risks / carried items
1. WebKit evidence pending CI. 2. The dormant UI's real-layout geometry with pins (方式 D) is only measured by the audit's probe harness; the R6 slice must re-measure with the real strip (forced-on). 3. `togglePin` with `handEditing` on has no pin-count limit (enforcement off); the R6 capacity block (OD-R5-7 UI) is not implemented here. 4. Placed-ingredient protection and the 3-state cue are R6 / R5-d concerns (inactive hand).

**Verdict: A. R5-c DORMANT FOUNDATION COMPLETE / READY FOR REVIEW**
