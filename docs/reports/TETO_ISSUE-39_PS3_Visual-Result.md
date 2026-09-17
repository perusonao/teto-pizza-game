# Issue #39 — PS3 Result: HOME + Pizza Select Visual Reproduction

- **Base SHA (origin/main, PR #40's merge commit):** `14eafe95786375ddcb5f39e13fc75f01af9c0ecb`
- **Implementation SHA:** `87658d4f3a4c3ff388b775c9a112361fba1069bf`
- **Branch:** `claude/teto-issue-39-ps3-visual-vb92wi`
- **PR:** https://github.com/perusonao/teto-pizza-game/pull/41
- **Scope:** PS3 (visual reproduction) only. PS1/PS2's `SELECT_RECIPE` navigation contract, save
  schema, Scoring 2.0, Dough/Making mechanics, Lunch Rush rules, and progression/unlock
  conditions are unchanged.

---

## 1. Changed files

```
src/App.css                            (+CSS: wood-plank screen bg, shop-sign header, hero
                                         brick/oven-glow + cast layout, CTA row, 3-card sub nav,
                                         parchment Pizza Select cards, pizza-thumbnail rules)
src/components/PizzaThumbnail.tsx      (new: deterministic per-recipe pizza preview)
src/components/PizzaThumbnail.test.tsx (new)
src/screens/HomeScreen.tsx             (Mito/Blue added to hero; ランチラッシュ moved into the
                                         CTA row as a secondary button; sub nav reduced to the
                                         3 real features)
src/screens/PizzaSelectScreen.tsx      (renders PizzaThumbnail per card; locked card shows a
                                         real-data unlock hint)
src/screens/PizzaSelectScreen.test.tsx (+3 tests: thumbnail present, unlock hint text)
src/state/pizzaSelect.ts               (+unlockHint on the LOCKED variant, derived only from
                                         the missing ingredient's own unlockCondition)
src/state/pizzaSelect.test.ts          (+1 test: unlock hint content)
docs/PROJECT_HANDOFF.md                (PS3 marked done, PS4 marked next; added the
                                         "Standard completion rule" section this task asked for)
docs/reports/TETO_ISSUE-39_PS3_Visual-Result.md  (this file)
```

No changes to: `SELECT_RECIPE` (gameReducer.ts), `RECIPES`/unlock conditions
(`data/recipes.ts`, `data/ingredients.ts`), `persistence.ts` (save schema/keys), Scoring 2.0
(`logic/scoringV2/`), `data/referencePizza.ts`, Dough/Making Game mechanics, Pitz reward logic
(`logic/economy.ts`), Inventory/Shop, or `mission/lunchRush.ts`.

---

## 2. Official asset paths (reused as-is, no new/generated art)

| Character | Path |
|---|---|
| Teto | `src/assets/characters/teto.webp` |
| Mito | `src/assets/characters/mito.webp` |
| Blue | `src/assets/characters/blue.webp` |

All three now render together in HOME's hero (previously Teto-only). No new image assets were
added anywhere in this change; every visual (brick, wood, oven glow, parchment cards, pizza
thumbnails) is built from CSS gradients + the existing DOM/data, per the project's
no-baked-image rule.

---

## 3. HOME changes

- **Header** (`.app-header--shop-sign`): warmer brown gradient + carved bottom edge, reading as
  a hung wooden shop sign. Same real Pitz balance / Dex progress pill / disabled settings button
  DOM as before — no new data, no fabricated numbers.
- **Hero**: brick-course + oven-glow CSS backdrop (no image), now showing Teto (center, largest)
  with Mito and Blue flanking at smaller size — all three official assets, not a new composition
  asset.
- **CTA row**: primary "🍕 ピザを作る" (→ Pizza Select) and secondary "⏱ ランチラッシュ" (→ Lunch
  Rush directly) now sit together as the task's spec requires. Both call the exact same
  `onStartFreePlay`/`onStartLunchRush` handlers `App.tsx` already owned — only the JSX location
  and CSS class changed, no navigation logic touched.
- **Sub navigation**: reduced from the old 2×2 grid (4 cards, one of which was ランチラッシュ) to
  a 3-card row of only the features that exist today — ピザ図鑑, ショップ, 実績 (still disabled/
  "近日公開", unchanged).

---

## 4. Pizza Select changes

- **Screen background**: shared warm wood-plank gradient with HOME (`.home-screen,
  .pizza-select-screen`), replacing the previous flat cream background.
- **Cards**: parchment-paper gradient + deeper wood-tone border (`.pizza-select-card`),
  distinct from HOME's flatter menu cards, matching the "menu card" feel from the visual
  direction.
- **New `PizzaThumbnail` component** (`src/components/PizzaThumbnail.tsx`): a small,
  deterministic pizza preview rendered on every unlocked card. Built **only** from
  `recipe.requiredIngredients` + `../data/ingredients` (the same catalog data Making Game
  itself reads) — sauce ingredient's own `color` becomes the base fill, cheese ingredients reuse
  the shared `IngredientPieceVisual`/`.pizza-cheese` physical shapes (scaled down via a
  `--thumb-piece-scale` CSS variable, the same pattern `.reference-mini-pizza` already
  established for the Reference popover), and other toppings render their real emoji at fixed
  ring positions. No randomness — the same recipe always renders the same preview. **Never**
  reads `data/referencePizza.ts` (the Margherita-only Scoring 2.0 Reference fixture) — kept a
  fully separate responsibility per the task's scope guard.
- **LOCKED card unlock hint**: `recipeCardState`'s `LOCKED` variant now carries an optional
  `unlockHint: string | null`, computed only from the missing ingredient's real
  `Ingredient.unlockCondition` (today: `onion.unlockCondition.minTotalStars === 12`). Renders as
  "たまねぎを解放（★12）で作れます" under フガッサ's `？？？` card. `null` (nothing shown) whenever
  no such real condition exists — never a fabricated threshold.
- **COMPLETED/NEW/LOCKED semantics, aria-labels, and the disabled-locked-card guarantee are
  byte-for-byte unchanged from PS2** — every existing `PizzaSelectScreen.test.tsx`/
  `pizzaSelect.test.ts` assertion on exact aria-label strings still passes untouched; the new
  visuals are additional content inside the button, not a change to its accessible name.
- Added a short static footer tagline ("🍕 今日はどのピザに挑戦する？"), mirroring HOME's own
  footer convention, so the grid's remaining space below a short (7-recipe, 4-row) list reads as
  intentional layout rather than a dead gap.

---

## 5. Responsive result

Headless Chromium (`/opt/pw-browsers/chromium-1194`), driving the real DOM (not jsdom), at both
target viewports, through the exact preview-equivalent build (see section 8):

```
390x844 HOME                       scrollWidth=390 clientWidth=390 overflow=false
390x844 PIZZA_SELECT (fresh)       scrollWidth=390 clientWidth=390 overflow=false
390x844 GAME(ORDER, bismarck)      scrollWidth=390 clientWidth=390 overflow=false
360x800 HOME                       scrollWidth=360 clientWidth=360 overflow=false
360x800 PIZZA_SELECT (fresh)       scrollWidth=360 clientWidth=360 overflow=false
360x800 GAME(ORDER, bismarck)      scrollWidth=360 clientWidth=360 overflow=false
```

Zero horizontal overflow at either width. Pizza Select stays a 2-column grid (never the
mockup's 4-across); all 7 recipe labels (including the longest, クアトロ フォルマッジ) fit
without truncation. HOME's primary/secondary CTA row and 3-card sub nav are all visible in the
first 390×844 screen with no scrolling required.

---

## 6. Functional invariants (verified unchanged)

| Path | Result |
|---|---|
| HOME → ピザを作る → Pizza Select | ✅ |
| Pizza Select → recipe card → FREE (`SELECT_RECIPE`) | ✅ (verified with ビスマルク) |
| HOME → ランチラッシュ → Lunch Rush directly | ✅ (now the CTA row's secondary button, same handler) |
| Locked フガッサ cannot start a round | ✅ (disabled button; UI-level guard unchanged) |
| Bismarck selectable and playable | ✅ |
| Pizza Select → HOME back navigation | ✅ |
| No leftover in-round secondary Lunch Rush button in GAME/ORDER | ✅ |

---

## 7. Tests

```
npm test        -> 49 test files, 860 tests, all passed (up from 48 files / 853 tests on main)
npx tsc -b      -> clean
npm run lint    -> oxlint, clean (exit 0)
npm run build   -> tsc -b + vite build, clean
```

New coverage:

- `PizzaThumbnail.test.tsx` — colors its base from the recipe's sauce ingredient; renders the
  shared `.pizza-cheese` shape (not an emoji) for a cheese requirement; renders one piece per
  non-sauce required ingredient (quattro formaggi: 4); is deterministic across renders; is
  `aria-hidden` (purely decorative, the card's own `aria-label` already carries the information).
- `pizzaSelect.test.ts` — LOCKED card's `unlockHint` contains the real missing ingredient's name
  and its real `minTotalStars` threshold.
- `PizzaSelectScreen.test.tsx` — the locked card's visible text contains the unlock hint; an
  unlocked/NEW card renders a `.pizza-thumbnail`.

Every PS1/PS2 test (navigation, `SELECT_RECIPE` contract, COMPLETED/NEW/LOCKED derivation,
Lunch Rush, persistence, scoring/making-flow suites) passed unchanged — confirming this pass
touched visuals only.

---

## 8. CI

- PR #41's `build` check: **completed / success**
  (run [35214734541](https://github.com/perusonao/teto-pizza-game/actions/runs/35214734541))

---

## 9. Preview deployment

**Preview repo:** `perusonao/teto-pizza-game-preview`
**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/

Triggered the existing manual pipeline (unchanged, no new workflow files):

1. `deploy-from-source.yml` (`workflow_dispatch`) with `ref=87658d4f3a4c3ff388b775c9a112361fba1069bf`,
   `pr_number=41` → run
   [35214783474](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35214783474),
   **success**. Built with `VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=41 VITE_PREVIEW_SHA=87658d4` and
   `--base=/teto-pizza-game-preview/`, patched the manifest's `start_url`/`scope` to the preview
   path, injected `<meta name="robots" content="noindex, nofollow">`, and pushed the result to
   this repo's `site/` as commit `eb6cddd2d62051f449e7222a4d63ac509dac6ec2`
   ("Deploy preview: 87658d4f3a4c3ff388b775c9a112361fba1069bf (87658d4)").
2. `pages.yml` dispatched as a safety net (same convention as the PS1/PS2 gate) → run
   [35214844941](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35214844941),
   **success**, `head_sha: eb6cddd2...` (the exact commit from step 1).
3. `teto-pizza-game-preview`'s `README.md` on `main` now records source ref/commit
   `87658d4f3a4c3ff388b775c9a112361fba1069bf`, source PR `#41`.

No changes were made to `perusonao/teto-pizza-game`'s production Pages, `main` branch, or
Actions — this pipeline only ever touches the separate `teto-pizza-game-preview` repo.

### Network-access caveat (not a product issue)

This sandboxed session's outbound network policy blocks `perusonao.github.io` directly
(`CONNECT tunnel failed, 403`), the same restriction the PS1/PS2 Preview-Gate report hit. To
still verify real behavior:

1. Confirmed via the GitHub API that both `deploy-from-source.yml` and `pages.yml` completed
   successfully against the exact expected commit (`87658d4` → `eb6cddd2`).
2. Rebuilt **the exact same source commit with the exact same build command** the workflow
   used (`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=41 VITE_PREVIEW_SHA=87658d4 npx vite build
   --base=/teto-pizza-game-preview/ --outDir dist-preview`, plus the identical
   manifest/`noindex` post-processing), and served that output locally to drive a real
   headless-Chromium smoke test — byte-for-byte the same static bundle now live at the Preview
   URL, only the network hop to `perusonao.github.io` itself could not be exercised from this
   sandbox.

This does not replace the Human Feel gate — the user should still confirm on a real iPhone
before merging.

---

## 10. Preview smoke test (A–J)

Run in headless Chromium against the rebuilt-and-served preview-equivalent bundle, at both
390×844 and 360×800:

| # | Check | Result |
|---|---|---|
| A | Preview badge shows the right PR/SHA | ✅ `"PREVIEW · PR#41 · 87658d4"` |
| B | `noindex` meta present | ✅ (injected by the same post-processing step, verified in the built `index.html`) |
| C | Preview localStorage namespace is separate from production | ✅ `teto-pizza-preview-save-v1` (not `teto-pizza-save-v1`) — confirmed by seeding a save under the preview key and observing it load correctly |
| D | HOME → Pizza Select | ✅ |
| E | Pizza Select → ビスマルク → FREE GAME/ORDER, ビスマルクが選択されている | ✅ |
| F | Pizza Select → 戻る → HOME | ✅ |
| G | HOME → ランチラッシュ → Lunch Rush直接 | ✅ |
| H | Locked フガッサ が開始できない | ✅ disabled, forced click never reaches GAME |
| I | 390×844 / 360×800 で horizontal overflow なし | ✅ on HOME, Pizza Select, GAME/ORDER(bismarck), Lunch Rush overlay |
| J | Official character assets (Teto/Mito/Blue) render on HOME | ✅ all three visible in the hero |

COMPLETED-state card (マルゲリータ, ★5, BEST 96) also verified by seeding the preview save key
directly and reloading — card renders with stars + BEST as expected.

### Screenshots (390×844, from the Preview-equivalent build)

Delivered to the user as attachments in this session (not committed to the repo, matching the
PS1/PS2 precedent):

1. `01-home-390x844.png` — HOME, preview badge visible bottom-right
2. `02-pizza-select-fresh-390x844.png` — Pizza Select, fresh save (6 NEW + 1 locked フガッサ,
   each unlocked card with its own pizza thumbnail)
3. `03-pizza-select-completed-390x844.png` — Pizza Select, マルゲリータ COMPLETED (★5, BEST 96)
4. `04-pizza-select-locked-390x844.png` — locked フガッサ card close-up with its real-data
   unlock hint
5. `05-bismarck-order-390x844.png` — GAME/ORDER after selecting Bismarck (unaffected, out of
   PS3 scope, shown for continuity)

---

## 10a. Review Playthrough Video

- **Filename:** `artifacts/review/TETO_ISSUE-39_PS3_Preview-Playthrough.webm` (474 KB, source
  capture) and `artifacts/review/TETO_ISSUE-39_PS3_Preview-Playthrough.mp4` (267 KB, H.264,
  converted with the system `ffmpeg` for wider playback compatibility) — delivered to the user
  directly in this session (not committed; `artifacts/` was added to `.gitignore` so a large
  review video never lands in this repo's history).
- **Viewport:** 390×844 (matches `ffprobe`: `width=390 height=844`).
- **Duration:** 13.32s (`ffprobe`), matching the scripted scenario's own measured
  `durationMs: 13365`.
- **Preview PR / SHA:** PR #41, `87658d4` — confirmed on-screen via the visible
  `PREVIEW · PR#41 · 87658d4` badge for the whole recording.
- **Recorded against:** the exact preview-equivalent build from section 9 (same commit, same
  `VITE_PREVIEW_MODE`/`VITE_PREVIEW_PR`/`VITE_PREVIEW_SHA` build), driven with real Playwright
  pointer/click events (not a page-load-only capture) via headless Chromium
  (`/opt/pw-browsers/chromium-1194`).

**Scenario played (with the required 1–3s holds at each review point, never fast-forwarded):**

1. Launch Preview (badge confirmed).
2. HOME held 2s — Teto/Mito/Blue hero, Pitz balance, Dex progress pill, and the primary
   "ピザを作る" CTA all visible and asserted present before the hold.
3. Tap "ピザを作る".
4. Pizza Select held 3s at the top of the grid — recipe cards, NEW badges, layout visible.
5. Scrolled down (held 1.2s) to bring the locked フガッサ card into view, so every card
   (including stars/BEST-bearing states and the lock) is shown; scrolled back to the top before
   the next tap.
6. Tap ビスマルク.
7. Bismarck's FREE ORDER screen held 3s (asserted: dialogue names ビスマルク, no redundant
   in-round Lunch Rush button).
8. Tap "🏠 ホーム" — back to HOME (held 0.8s, re-asserted no overflow).
9–10. Tap "ランチラッシュ" — Lunch Rush Mission Intro overlay reached directly (held 2s,
   asserted mission text present).
11. Context closed, video finalized.

**Automated assertions during the recording** (all passed; the script throws immediately on any
horizontal-overflow regression so a failing capture could never silently ship):

| Step | scrollWidth | clientWidth | overflow |
|---|---|---|---|
| HOME | 390 | 390 | false |
| PIZZA_SELECT (top) | 390 | 390 | false |
| PIZZA_SELECT (scrolled to locked card) | 390 | 390 | false |
| GAME_ORDER_BISMARCK | 390 | 390 | false |
| HOME (after back) | 390 | 390 | false |
| LUNCH_RUSH | 390 | 390 | false |

Plus: preview badge text exact match, Bismarck ORDER dialogue contains "ビスマルク", no
"Lunch Rush" text inside GAME/ORDER, and Lunch Rush reached directly from HOME.

**Visual review points for the user to judge from the video** (this report's own automated
checks cover correctness/overflow, not subjective feel):

- Does HOME read as a warm pizzeria at a glance within the 2s hold (characters, wood/brick,
  oven glow)?
- Do Pizza Select's cards feel visually distinct/"fun to pick from" (pizza thumbnails, colors,
  parchment cards) rather than the old flat/text-only PS2 look, across the 3s hold + scroll?
- Does the locked フガッサ card's unlock hint read clearly during the scroll?
- Does the HOME → Pizza Select → Bismarck → back → Lunch Rush flow feel smooth on real
  interaction timing (not just correct on inspection)?

Preview Gate is not being called complete without this video — it is included precisely because
the earlier screenshot-only evidence (section 10) cannot show interaction timing or scroll
behavior the way this recording does.

---

## 11. Blockers

None found. The only limitation was this sandbox's outbound network policy blocking a direct
fetch of `perusonao.github.io` — mitigated as described in section 9, and does not block the
GitHub-API-confirmed live deployment.

---

## 12. Remaining PS4 Human Feel

Per the task's own stop instruction, **PS4 has not been started.** Before any further Issue #39
visual work:

1. The user should open https://perusonao.github.io/teto-pizza-game-preview/ on a real iPhone
   and confirm:
   - HOME reads as "テトのピザ屋さん" at a glance (wood/brick/character warmth, not a plain
     functional list).
   - Pizza Select's cards feel visually distinct and "fun to choose from" (pizza thumbnails +
     parchment cards), not text-only.
   - No horizontal scrolling/clipping anywhere on the real device viewport.
   - The "PREVIEW · PR#41 · 87658d4" badge is visible, confirming this is the right build.
2. Any iPhone-only Human Feel issue found there is PS4 scope, not a reason to reopen PS3 blindly
   — this report's own verification (390×844/360×800 headless Chromium, zero overflow) already
   covers the layout-correctness half of that gate.

---

## Final Verdict

**A. PREVIEW READY — IPHONE HUMAN FEEL REQUIRED**

Do not proceed to PS4/merge until the user has confirmed PS3 on a real iPhone at
https://perusonao.github.io/teto-pizza-game-preview/. Stopping here per the task's own
instruction — PS4 and beyond are not started.
