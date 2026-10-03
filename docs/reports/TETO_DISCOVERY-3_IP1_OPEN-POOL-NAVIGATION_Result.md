# Discovery 3.0 IP-1 — OPEN_POOL → Notebook / Pantry Navigation (Result)

Base main: `93ca1e404c4e942e48b69506ff600bd8fcdfbb51` (Trial Notebook N1 #332 merged).

Note: the Fresh Audit named in the task (`docs/reports/TETO_DISCOVERY-3_HINT-PANTRY-NOTEBOOK_INTEGRATION_AUDIT.md`) is **not in the repo at that SHA**
(nor in git history). The Implementation Gate below was therefore re-traced read-only from the code.

## Implementation Gate — verdict A (minimal change; direct open is safe)

Trace: `HintSheet` (props only; `hintSheetView` for OPEN_POOL is exactly `{ kind: "OPEN_POOL" }`) → `GameScreen`
(`pantryOpen` is local UI state; `pantryAvailable = largeCatalogEligible && PREPARE && makingStep !== "DOUGH" && pantryWorthwhile`)
→ `IngredientPantry` (`category={activeCategory}`, i.e. the player's current step; own search / shelf chips; focuses its 閉じる on mount).

- The pantry is a modal over the cooking screen, independent of the Hint sheet and the reducer (`CLOSE_HINT` only clears `hintSheetOpen`/`hintOutcome`).
  Closing the Hint and opening the pantry in one handler leaves the FREE state untouched; closing the pantry returns to the same FREE step.
- The only unreachable case is the **DOUGH step** (no tray, no pantry). There the sheet shows copy only (no button), so nothing is opened that cannot exist.
- No change to Pantry architecture; `IngredientPantry`, eligibility, catalog code untouched. Not a general ingredient browser.

## What changed
- `HintSheet`: OPEN_POOL body = existing title/body + fixed notebook line + (pantry line + 「🧺 食材庫で材料を探す」 button | DOUGH copy | nothing). New optional prop `pantry` (`HintPantryAccess`). Header 「📓 試作ノートを見る」 untouched (kept; body copy points to it rather than duplicating a second button).
- `GameScreen`: computes `hintPantryAccess` from screen facts only (eligibility, step, owned counts); on open: close Hint → open pantry; focus is not stolen back to 「ヒント」.
- `openPoolCopy.ts`: fixed copy. `App.css`: small action-block styles.
- Pantry opens on the player's current step category (not chosen by the hint); shelf chip 「すべて」 pressed, no search text, nothing preselected.

## Anti-oracle / pool independence
OPEN_POOL view carries only `kind`; action props come from owned-ingredient / step facts. Tests: a richer owned set (different candidate pool) renders byte-identical action HTML;
no digits, recipe names, family words or candidate ids in text/attributes.

## Flags / save
`HAND_ENFORCEMENT_ENABLED=false` (asserted), save schema v2, no notebook persistence, no capacity decision.

## Verification (local)
- Focused: `GameScreen.openPoolNav.test.tsx` 9/9. Full unit: 297 files, 5609 passed / 1 skipped (pool=1 ladder, existing25, No.26 suites unchanged and green).
- `tsc -b` clean, `npm run lint` clean for changed files (pre-existing warnings only), `npm run build` OK.
- Chromium E2E `e2e/discovery3-ip1-open-pool-nav.spec.ts` (Dex12 pool=2) 390×844 + 360×800: Hint → OPEN_POOL → Notebook → back → Pantry → shelf chips / search → 閉じる → FREE; viewport containment, no horizontal overflow, no console errors, anti-spoiler sweep. Regression: notebook-n1, pool2-production, hint-sheet, pantry shell/search/shelves/pin-dormant specs pass (31 passed, 17 width-guard skips).
- Screenshots: `docs/reports/screenshots/ip1-open-pool-navigation/{before,after}/`.

## Not done here
- Human Verification **video** (390×844) — not recorded in this cloud session; must be supplied separately per policy.
- CI, Layout Contract Gate, layout-chromium, WebKit/WebKit Gate, Codex review (exact final HEAD) — run after PR.

## Left for IP-2 / IP-3
Pantry from non-OPEN_POOL Hint kinds, SUB_CLASS → Pantry deep link, MC-1 material list (withdrawn), Notebook attempt diff, DOUGH-step pantry access, pin/hand production, capacity 9/12.
