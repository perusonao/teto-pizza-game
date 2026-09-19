# Teto Pizza Game — AI UI/UX Visual Review 1.0 (Fresh Audit)

Read-only mobile visual/UX audit of the full Teto Pizza Game experience. No production code
was changed. No PR was opened.

## 0. Fresh GitHub Gate

- `git fetch origin` run at audit start. `origin/main` = `2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7`
  ("Human Feel Tuning 1A: clarify insufficient sauce guidance", PR #103 squash merge) — matches
  the SHA supplied in the task, confirmed fresh against GitHub rather than trusted blind.
- Open PRs checked: #72 (docs), #46 (Issue #33 Dough Shaping D0 audit), #34 (Issue #32 Phase 1
  reference-visual unify), #3 (docs). None is a full mobile visual/UX audit.
- Open issues checked (13 total): #89, #88 (Pizza Select pager — already shipped on main as the
  single-card pager this audit reviews), #87 (Lunch Rush online ranking), #47 (Making UX
  Cleanup — real-device review, narrower scope), #39, #38, #37, #33, #32 (Phase 4A-2.1 Human
  Feel findings — narrower, iPhone-specific consistency pass), #30, #27, #24, #22 (SSOT
  roadmap). **No duplicate/overlapping full Visual Review is in flight** — this audit is not
  redundant with any open work.

## 1. Baseline (audited SHA, before any audit-only tooling)

| Check | Result |
|---|---|
| `npx vitest run` | **1604 tests passed** across **81 test files**, 0 failed |
| `npx tsc -b` | Clean, 0 errors |
| `npx oxlint` | Clean, 0 errors/warnings |
| `npm run build` | Succeeds — `dist/assets/index-*.js` 350.78 kB (gzip 108.82 kB), CSS 40.07 kB (gzip 8.36 kB) |

Baseline is fully green. No pre-existing breakage to account for in any finding below.

## 2. Method

A scratch Playwright script (not committed — see §14) drove a real Chromium browser against
the Vite dev server at the two priority viewports, **390×844** and **360×800**, through every
screen in §3, with `localStorage` seeded two ways:

- **Fresh state** (no save): HOME's true first-run look, Pizza Select's locked/NEW state,
  Margherita as the simple PREPARE case, and Result's first-time-discovery banner.
- **Seeded state** (all 11 recipes discovered/★5, all 6 non-starter ingredients owned +
  stocked, 5000 Pitz): Recipe Select/Dex/Shop/Inventory at their scale ceiling *for the current
  11-recipe/18-ingredient catalog*, Tonno e Cipolla as the complex PREPARE case, and Lunch Rush.

DOUGH shaping was driven by repeated real pointer gestures at 8 angles around the dough (the
actual `applyStretchPoint` gesture, not a shortcut) until the size-completion gate passed; SAUCE
was driven by a real ~2.6s pointer-hold-and-move gesture through the actual tick-based
`SauceDispenseController`; CHEESE/TOPPING were placed via real tray-select + tap-to-place
gestures. RESULT FAILED was produced by a real round that skipped the CHEESE step entirely
(missing required mozzarella), not a forced/mocked state. Every screenshot is therefore a real
render of real app state, not a fixture.

Per-screen instrumentation: `document.documentElement.scrollWidth` vs `innerWidth` (horizontal
overflow) and all `console.error`/`pageerror` events, captured for every one of the 18
screenshots below.

**Result: zero horizontal overflow and zero console errors at either viewport, across every
captured screen and state.** The mobile technical baseline (no clipping, no crashes) is solid.

## 3. Screens audited

HOME → Recipe Select (pager) → PREPARE (DOUGH/SAUCE/CHEESE/TOPPING) → BAKE → RESULT PASS →
HOME; a second FREE run → RESULT FAILED; Shop (fresh + seeded); Inventory; Dex; Lunch Rush
(order/timer) → Lunch Rush Result. Fresh-enumerating the codebase's screens/overlays
(`src/screens/*.tsx`, `src/components/*Overlay.tsx`) turned up no additional top-level screen
beyond what the task already lists — Settings and Achievements are HOME menu entries with no
backing screen at all yet (see Finding P2-4).

## 4. Screenshots

All in `docs/reports/screenshots/ui-ux-visual-review-1/` (18 total: the 16 requested + 2 bonus
states used to source specific findings below).

| File | Screen / state |
|---|---|
| `01-home-390.png` | HOME, fresh save |
| `02-recipe-select-390.png` | Recipe Select, card 1/11 (Margherita, NEW), fresh save |
| `02b-recipe-select-scalability-390.png` *(bonus)* | Recipe Select, card 11/11 (Tonno e Cipolla, COMPLETED ★5), seeded save |
| `03-prepare-simple-390.png` | PREPARE/TOPPING, Margherita (3 ingredients) |
| `04-prepare-complex-390.png` | PREPARE/TOPPING, Tonno e Cipolla (4 ingredients, 6 owned in category) |
| `05-bake-390.png` | BAKE, Margherita |
| `06-result-pass-390.png` | RESULT PASS, Margherita, first discovery |
| `07-result-failed-390.png` | RESULT FAILED, Margherita, missing mozzarella |
| `08-shop-390.png` | Shop, fresh save (106 Pitz, 1 purchasable ingredient) |
| `08b-shop-seeded-390.png` *(bonus)* | Shop, seeded save (5000 Pitz, all owned → restock-only) |
| `09-inventory-390.png` | Inventory, seeded save (9/18 owned) |
| `10-dex-390.png` | Dex, seeded save (11/11, コンプリート！) |
| `11-lunch-rush-390.png` | Lunch Rush, order in progress, timer running |
| `12-lunch-rush-result-390.png` | Lunch Rush Result overlay |
| `13-home-360.png` | HOME, fresh save, 360×800 |
| `14-prepare-complex-360.png` | PREPARE/TOPPING, Tonno e Cipolla, 360×800 |
| `15-result-pass-360.png` | RESULT PASS, Margherita, 360×800 |
| `16-result-failed-360.png` | RESULT FAILED, Margherita, 360×800 |

Every screen in the task's required list exists in the current build; nothing had to be
substituted.

## 5. Screen Review Matrix

| Screen | Visual Hierarchy | Mobile Ergonomics | Game Feel | Density | Consistency | Discoverability | Scalability | Issue | Priority |
|---|---|---|---|---|---|---|---|---|---|
| HOME | GOOD | GOOD | GOOD | MINOR (large empty lower half) | GOOD | GOOD | MINOR | Empty space below menu grid; 2 of 6 menu items permanently dead | P2 |
| Recipe Select | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | MINOR | Numeric pager has no jump/chapter control | P2 |
| PREPARE (simple) | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | — | — |
| PREPARE (complex) | GOOD | **NEEDS WORK** | GOOD | MINOR | GOOD | **NEEDS WORK** | **NEEDS WORK** | 2nd "Other" tray row hidden under fixed CTA bar, no scroll cue | **P1** |
| BAKE | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | — | — |
| RESULT PASS | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | Hierarchy already deliberately tuned (stars/score lead, Pitz detail secondary) | — |
| RESULT FAILED | GOOD | GOOD | MINOR | GOOD | GOOD | GOOD | GOOD | Reuses PASS structure well; "0 Pitz" framing slightly terse | P2 |
| Shop | MINOR | GOOD | MINOR | MINOR (early-game emptiness) | MINOR (no category filter, unlike Inventory) | MINOR | **NEEDS WORK** | Large blank area below 1-item list; no filter for 62+ ingredient future | P1 |
| Inventory | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD (has category filter already) | — | — |
| Dex | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | **NEEDS WORK** | Plain vertical scroll, no filter/search ahead of 53/160 recipes | P2 |
| Lunch Rush | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | — | — |
| Lunch Rush Result | MINOR | GOOD | MINOR | GOOD | **NEEDS WORK** | GOOD | GOOD | Hardcoded English title/labels break the game's Japanese tone | P1 |

## 6. Findings

### P0 — none found

No unusable control, no overflow, no clipped/unreadable text, no invisible CTA, and no
console error was found anywhere across 18 screenshots × 2 viewports. The one near-miss (the
ingredient tray row below) is reachable by scrolling, so it is graded P1, not P0 — but see its
own note on why that distinction may not hold for long.

### P1

**P1-1. Ingredient Tray: a "recommended row + full Other grid" recipe hides its own second
Other row under the fixed BAKE CTA bar, with no scroll affordance.**
- **Current behavior:** For Tonno e Cipolla (4 required ingredients, 6 owned ingredients in the
  TOPPING category → 2 recommended + 5 "Other" → 2 Other rows), the second Other row
  (ペパロニ/アンチョビ) renders with only its top ~8px peeking above `.prepare-bake-bar`
  (`04-prepare-complex-390.png`); at 360×800 it is fully hidden (`14-prepare-complex-360.png`).
  Verified with a live pointer probe: the row *is* reachable via `wheel`/scroll (the page
  genuinely scrolls, `scrollHeight` 936 vs `clientHeight` 844), but nothing on screen — no
  fade, chevron, or "more below" cue — tells the player that.
- **Root cause:** `.ingredient-panel`'s `padding-bottom: calc(84px + safe-area)` (App.css) is
  sized, per its own comment, to reserve room for "the last two Palette rows" of the Other
  grid — but doesn't account for the Recommended row's own height stacking on top of it when a
  recipe has category-matching required ingredients (Margherita's CHEESE/TOPPING steps only
  ever show 1 Other row, so this never surfaced there).
- **Why it matters:** today it's a scroll-discoverability nit; at the stated 18→62+ ingredient
  roadmap, a 5-6-item "Other" row will become the *common* case, not the edge case, for any
  mid-catalog recipe. A first-time player with no reason to suspect a fixed-looking screen
  scrolls will not find the ingredient their recipe needs.
- **Proposed direction:** either (a) make `.ingredient-panel`'s reserved padding dynamic to the
  Recommended row's actual rendered height, or (b) add a lightweight bottom-edge scroll
  affordance (gradient fade + small chevron) whenever the tray content overflows, or (c) cap
  the *combined* Recommended+Other rows shown before falling back to the existing page-nav
  control (today page-nav only triggers past 6 Other items, never counting Recommended's own
  row).
- **Affected screens:** PREPARE / CHEESE & TOPPING sub-steps, any recipe whose owned
  ingredients in that category exceed ~5.
- **Implementation size:** S (CSS-only fix) to M (scroll affordance).
- **Regression risk:** Low — purely additive/layout, no state-machine change.

**P1-2. Lunch Rush Result is the one screen in the whole game with hardcoded English copy.**
- **Current behavior:** `MissionResultOverlay.tsx` renders `"LUNCH RUSH RESULT"`, `"SCORE"`,
  and `"NEW BEST!"` verbatim in English (`12-lunch-rush-result-390.png`), while every
  surrounding label — including this exact feature's own HOME entry point,「ランチラッシュ」—
  and every other overlay in the game is Japanese.
- **Why it matters:** this is the payoff screen for the mission's single most exciting moment
  (a timed high-score run), and it reads like an untranslated debug placeholder dropped into an
  otherwise fully-localized, warm "テトのピザ屋さん" experience — a real Game Feel/Consistency
  break at a high-visibility moment.
- **Proposed direction:** localize to match the game's tone, e.g. 「ランチラッシュ けっか」／
  「スコア」／「ニューベスト！」(or reuse RESULT's own ✨/🌟 banner convention).
- **Affected screens:** Lunch Rush Result only.
- **Implementation size:** XS — copy-only change in one component.
- **Regression risk:** Low (no logic touched).

**P1-3. Shop reads as broken/empty for most of the early game, and the game's own "more is
coming" message never shows when it's actually needed.**
- **Current behavior:** Shop's `products` list only ever contains ingredients already
  `AVAILABLE_TO_BUY` or `OWNED` — a deliberate progressive-disclosure design (`LOCKED`
  ingredients are omitted entirely, never shown with a padlock row). At a very common
  early-game state (`08-shop-390.png`: 106 Pitz, 1 buyable ingredient) this leaves one small
  card followed by roughly 600px of blank cream background on a 844px screen. The game *does*
  have copy for this — `"新しい素材は、ピザの腕前が上がると入荷します"` — but it is gated to
  `products.length === 0` only (`ShopOverlay.tsx`), so it never renders in the far more common
  "1-2 items" state, leaving the emptiness unexplained.
- **Why it matters:** a shop that looks unfinished/broken right when a new player first opens
  it is a first-impression problem, and it directly contradicts dimension F (can a first-time
  player understand what's happening in ~3 seconds?) — right now the honest answer is "no, it
  looks like a bug."
- **Proposed direction:** show that same hint (or a shorter variant) whenever `products.length`
  is below some small threshold (e.g. 3), not only at literal zero; consider a small
  illustration/character cameo to intentionally fill the space rather than leave it blank.
- **Affected screens:** Shop, early-to-mid game.
- **Implementation size:** S.
- **Regression risk:** Low.

### P2

**P2-4. Dex has no search/filter, unlike Inventory — will not survive 53/160 recipes.**
Dex (`10-dex-390.png`) is a single unbroken vertical scroll of recipe cards. At 11 recipes this
is fine; Inventory already solved exactly this problem one screen over with a category filter
row (すべて/ソース/チーズ/トッピング, `09-inventory-390.png`). Recommend giving Dex the same
filter affordance (discovered/locked, or by chapter) well before the catalog reaches 53.
Affected: Dex. Size: M. Risk: Low (additive).

**P2-5. Shop has no category filter either, for the same 18→62+ ingredient reason.**
Same argument as P2-4, one screen over — Shop's list is presentationally identical to
Inventory's pre-filter layout, but never got Inventory's category tabs. Affected: Shop. Size:
S–M (can reuse Inventory's existing filter pattern). Risk: Low.

**P2-6. Recipe Select's numeric pager (already "Chapter-ready" per its own code comment) has
no chapter/jump control yet.** Paging one-card-at-a-time from 1 to 53 (or 160) via 前へ/次へ is
impractical; the counter already switches from dots to "N / total" at scale (a good existing
scalability feature), but there's no way to skip ahead. Lower urgency than P2-4/5 since the
component's own `recipes` prop is already designed to accept a filtered/chunked subset.
Affected: Pizza Select. Size: M. Risk: Low.

**P2-7. HOME's lower ~40% is empty cream background with only a one-line footer tagline**
(`01-home-390.png`/`13-home-360.png`). A missed opportunity on the game's own landing/hub
screen — e.g. a rotating tip, a "config latest unlock" banner, or simply a bigger hero
illustration would fill this intentionally rather than looking unfinished. Affected: HOME.
Size: M. Risk: Low.

**P2-8. "実績" (Achievements) and "設定" (Settings) are two of HOME's six primary buttons and
both are permanently disabled/"近日公開".** Understood and intentional per the code's own doc
comment (no backing feature exists yet), but worth flagging as a standing discoverability tax:
1/3 of the home menu grid currently does nothing when tapped. Recommend hiding rather than
graying out if there's no near-term ship plan, or building a minimal real version of one.
Affected: HOME. Size: XS (hide) or L (build). Risk: Low.

**P2-9. RESULT FAILED's "0 Pitz" line is a touch terse/punitive** — 「今回は料理として成立し
なかったため、提供できませんでした」 pairs a clear, specific reason (already a strength — see
Positive Findings) with no forward-looking "try this next" nudge beyond the generic reason
banner above it. Minor; the screen already avoids being purely punitive (both retry CTAs are
present, same visual structure as PASS). Affected: RESULT FAILED. Size: XS. Risk: Low.

### Positive findings (worth preserving through any redesign)

- **RESULT PASS's information hierarchy is already correctly and deliberately tuned** — stars
  + total score are the single visually dominant element; Pitz/Efficiency/Cooking-Time are
  rendered in a small, explicitly secondary `<dl>` table (per the component's own code
  comment: "品質が主役、手際は副評価"); the full component score breakdown is behind a
  collapsed `<details>` ("くわしいスコアを見る"). This is exactly what dimension A/D asks for
  and should be the template for any other screen carrying many numbers (e.g. Lunch Rush
  Result's flatter list of five equally-weighted rows could learn from this).
- **RESULT FAILED reuses RESULT PASS's own structure/CTAs** rather than inventing new UI, gives
  one clear, plain-language reason, and is never a dead end (both もう一度つくる and
  別のピザを作る are present) — it does not read as "just a punishment screen."
- **The pizza itself is the largest, most central element on every PREPARE/BAKE/RESULT
  screen** — this genuinely reads as a cooking game, not a form, satisfying dimension C.
- **Cross-overlay consistency is strong**: Dex/Shop/Inventory share an identical bottom-sheet
  panel style, identical "閉じる" placement, identical icon+title+subtitle header pattern, and
  matching card radius/spacing.
- **Zero horizontal overflow, zero clipped text, zero console errors** across every captured
  state at both target viewports — the mobile technical baseline is solid.
- **Tap targets read as comfortably sized** — CTA buttons, ingredient chips, and tray/step tabs
  all look ≥48px, matching the codebase's own documented 48–54px CTA convention; no
  obviously-too-small control was found.
- **Recipe Select's pager already anticipates scale** (dots below a small recipe count, a plain
  "N / total" counter above it) and its own `recipes` prop is explicitly designed to accept a
  filtered/chunked subset for a future chapter system — a good scalability foundation already
  in place (see P2-6 for what's still missing).

## 7. Scalability review (11→53→160 recipes, 18→62+ ingredients)

- **Recipe Select:** structurally ready (chunkable `recipes` prop, scale-aware pager indicator)
  but has no chapter/jump UI yet — P2-6.
- **Dex:** will become an unbounded single scroll with no way to find one recipe among 53/160
  — P2-4, the single most important scalability gap found.
- **Shop:** same unbounded-scroll risk as Dex once past ~62 ingredients, compounded by the
  progressive-disclosure design already producing a near-empty screen at low item counts today
  — P1-3 + P2-5.
- **Inventory:** already the model to copy — category filter tabs already ship today and
  comfortably cover the 18→62+ growth path with no further change needed.
- **PREPARE / Ingredient Tray:** the one place scale risk is *already* visible today, not just
  theoretical — P1-1's hidden second row will only get more common as more recipes carry 4+
  required ingredients per category.

## 8. Improvement concepts (Current → Problem → Proposed)

**HOME**
- *Current:* Hero (character art + speech bubble) → two primary CTAs → 2×2 menu grid → ~40%
  empty space → one-line footer.
- *Problem:* Large unused lower area; 2 of 6 menu entries are permanently dead ends (P2-8).
- *Proposed hierarchy:* Hero/CTAs unchanged (already correct) → menu grid → a new "what's
  next" band (latest unlock, a rotating tip, or a bigger character moment) filling the space
  intentionally.
- *Proposed layout:* Keep the 2×2 grid at its current size/position; replace the footer's dead
  space with either a slim "for you" card (next locked recipe + its unlock condition) or simply
  hide Achievements/Settings until real.
- *Keep:* Hero art, both primary CTAs, Pitz/recipe counters in the header.
- *Remove/Reduce:* the disabled 実績 card, if no near-term feature is planned.
- *Emphasize:* a concrete "next thing to do" signal (next locked recipe, next Dex milestone).

**PREPARE (Ingredient Tray, complex recipe)**
- *Current:* Recommended row → Other grid (up to 2 rows) → fixed CTA bar, with row 2
  sometimes hidden underneath the bar (P1-1).
- *Problem:* No player-visible signal that more ingredients exist below the fold.
- *Proposed hierarchy:* Recommended row (unchanged, already correct) → fully visible Other row
  1 → a visible partial peek of row 2 with a soft fade + a small "▼" cue, or a
  dynamically-sized reserved padding so row 2 always clears the CTA bar.
- *Proposed layout:* No structural change needed — this is a spacing/affordance fix, not a
  redesign.
- *Keep:* the Recommended/Other split, the existing page-nav pattern for >6 Other items.
- *Remove/Reduce:* nothing.
- *Emphasize:* scroll affordance only when content actually overflows.

**Shop**
- *Current:* Pitz balance bar → 0-3 item cards → large blank remainder (P1-3), no category
  filter (P2-5).
- *Problem:* Reads as unfinished/broken at common early-game item counts; won't scale past
  ~62 ingredients without a filter.
- *Proposed hierarchy:* Pitz balance → category tabs (mirroring Inventory) → item list → an
  always-visible "more unlocks as you play" footer note whenever the visible list is short.
- *Proposed layout:* Adopt Inventory's exact filter-tab component for visual consistency
  between the two overlays.
- *Keep:* the existing per-item buy/restock card design, the "unlocks: 🍕 X" purchase preview.
- *Remove/Reduce:* nothing removed — only add the missing footer hint + filter row.
- *Emphasize:* what's coming next (star-gated locked teaser count), even without naming locked
  ingredients directly.

## 9. AI mock candidates (max 3)

1. **`04-prepare-complex-390.png`** (PREPARE, Tonno e Cipolla, TOPPING step)
   - *Why this screen:* the audit's clearest, most concrete, reproducible P1 (hidden ingredient
     row) — a mock is the fastest way to communicate the fix to a designer/reviewer who hasn't
     read the CSS root-cause.
   - *What should change:* make the second "その他" row (ペパロニ／アンチョビ) fully visible
     above the fixed 焼く！ CTA bar; add a subtle bottom-edge gradient fade + small down-chevron
     only if any further row still needs a scroll cue.
   - *What must remain:* pizza stage size/position, tab bar, order-card/見本 row, the
     Recommended row's contents and styling, CTA bar's 3-button layout and colors.
   - *Mock-generation brief:* "Mobile app screenshot, 390×844, warm cream/brick pizzeria game
     UI (see reference image). Keep everything above the ingredient tray identical. Redraw only
     the ingredient tray at the bottom: one 'このピザにおすすめ' row (2 chips: onion, tuna,
     each already selected/highlighted in orange), then 'その他' with TWO full rows of 3 chips
     each (basil, mushroom, sausage / pepperoni, anchovy) fully visible and un-clipped, sitting
     entirely above the red 焼く！ CTA bar with a few pixels of clear cream padding between the
     last chip row and the bar. If the tray content is taller than the screen, add a thin
     vertical gradient fade at the very bottom edge of the tray area plus a small centered ▼
     chevron icon to signal more content below."

2. **`08-shop-390.png`** (Shop, fresh/early-game state)
   - *Why this screen:* demonstrates the "looks broken" empty-state problem concretely, at the
     exact Pitz/item-count state a real new player will see first.
   - *What should change:* add a category filter tab row (すべて/ソース/チーズ/トッピング,
     matching Inventory's exact style) directly under the Pitz balance bar; below the single
     item card, add a centered secondary-text line "新しい素材は、ピザの腕前が上がると入荷し
     ます" plus a small decorative character/illustration to fill the remaining space instead
     of leaving it blank.
   - *What must remain:* the Pitz balance pill, the マッシュルーム item card's exact layout
     (icon, stock, price, 補充する button), the "閉じる" header button, overlay panel
     radius/shadow.
   - *Mock-generation brief:* "Mobile app screenshot, 390×844, same warm cream pizzeria game
     UI/overlay style as the reference image. Keep the header ('🛒 SHOP', 閉じる button) and
     the Pitz balance pill unchanged. Add a row of 4 pill-shaped filter tabs directly below the
     Pitz pill, labeled すべて／ソース／チーズ／トッピング, first tab active/highlighted
     (matching the orange-highlighted tab style from the game's Inventory screen). Keep the
     existing マッシュルーム item card exactly as shown. Below it, in the remaining blank
     space, add centered light-brown secondary text reading '新しい素材は、ピザの腕前が上がる
     と入荷します' with a small friendly dog-character illustration (reuse the game's existing
     'テト' mascot style) peeking in from the bottom, so the screen reads as intentionally
     designed rather than empty."

3. **`01-home-390.png`** (HOME)
   - *Why this screen:* the game's own front door; the empty lower half is the single biggest
     unused-space opportunity found, and it's the screen every player sees most often.
   - *What should change:* replace the blank area between the 2×2 menu grid and the footer
     tagline with a slim horizontal "次にできること" (what's next) card — e.g. showing the next
     locked recipe's silhouette + its unlock condition, or the player's current Dex completion
     streak — without changing anything above it.
   - *What must remain:* the header (Pitz/recipe-count pills, gear icon), the hero
     character-art section with speech bubble, both primary CTA buttons (ピザを作る／
     ランチラッシュ), the 2×2 menu grid's exact contents/order, the footer tagline.
   - *Mock-generation brief:* "Mobile app screenshot, 390×844, same warm cream/wood pizzeria
     game UI as the reference image. Keep the brown header bar, hero section with the three dog
     characters and speech bubble, both orange/cream CTA buttons, and the 2×2 menu grid
     (ピザ図鑑／ショップ／材料／実績) completely unchanged. In the empty space between the menu
     grid and the bottom footer tagline, add one slim rounded card, full width, with a small
     lock icon, a grayed-out pizza silhouette on the left, and text on the right reading
     '次に解放: フンギ（★4必要）' in warm brown tones consistent with the rest of the UI.
     Keep the footer tagline ('🐾 いいピザは、いい一日をつくる！') exactly where it is."

## 10. Implementation slices

**Visual Polish 1A — Ingredient Tray overflow fix**
- Scope: fix `.ingredient-panel`/`.prepare-bake-bar` so the Other grid's last row always clears
  the fixed CTA bar (or gets a clear scroll cue) when a Recommended row is also present.
- Files likely affected: `src/App.css` (`.ingredient-panel`, `.prepare-bake-bar` rules),
  possibly `src/components/IngredientTray.tsx` if a scroll-affordance element is added.
- Estimated Claude Code time: 2h.
- Risk: Low.
- Dependencies: none.
- Acceptance criteria: with Tonno e Cipolla (or any recipe with 5+ owned "Other" items) at
  CHEESE/TOPPING, every ingredient chip is either fully visible above the CTA bar or a visible
  scroll cue is shown, at both 390×844 and 360×800; no regression to Margherita's existing
  single-row layout.

**Visual Polish 1B — Lunch Rush Result localization**
- Scope: replace `"LUNCH RUSH RESULT"` / `"SCORE"` / `"NEW BEST!"` with Japanese copy matching
  the rest of the game's tone.
- Files likely affected: `src/components/MissionResultOverlay.tsx`.
- Estimated Claude Code time: 0.5h.
- Risk: Low.
- Dependencies: none.
- Acceptance criteria: no English UI copy remains on the Lunch Rush Result screen.

**Visual Polish 1C — Shop empty-state + category filter**
- Scope: show the "more unlocks as you play" hint whenever the visible product list is short
  (not only at zero), and add Inventory-style category filter tabs to Shop.
- Files likely affected: `src/components/ShopOverlay.tsx`, `src/App.css` (`.shop-overlay*`).
- Estimated Claude Code time: 2.5h.
- Risk: Low.
- Dependencies: none (can reuse Inventory's existing filter pattern/CSS).
- Acceptance criteria: Shop with 1-2 purchasable items shows both the item(s) and the "more
  coming" hint without excess blank space; category tabs filter the list exactly like
  Inventory's do.

**Visual Polish 1D — Dex scalability filter**
- Scope: add a discovered/locked (or category) filter row to Dex ahead of the 53-recipe
  expansion.
- Files likely affected: `src/components/DexOverlay.tsx`, `src/App.css` (`.dex-overlay*`).
- Estimated Claude Code time: 3h.
- Risk: Low–Medium (must preserve the existing newly-discovered/new-BEST highlight behavior
  across a filtered view).
- Dependencies: none.
- Acceptance criteria: Dex can be filtered without losing the discovered/locked count header,
  the コンプリート banner, or the newly-discovered/new-BEST scroll-to/highlight behavior.

## 11. Recommended next single task

**Visual Polish 1A (Ingredient Tray overflow fix).** It is the only finding that can actually
prevent a player from finding a required ingredient rather than merely looking unpolished; it
is directly tied to the project's own stated 18→62-ingredient roadmap (this audit already
reproduces the failure mode today, not hypothetically); it is small, low-risk, and has a ready
acceptance test (the exact Tonno e Cipolla repro captured in `04-prepare-complex-390.png`).

## 12. Final Verdict

**B. READY WITH POLISH.**

No P0s were found — the game is playable, legible, and free of overflow/console errors at both
target viewports today. Several concrete, evidence-backed P1s exist (ingredient tray overflow,
Lunch Rush Result's English copy, Shop's empty-state framing) that should land before or
alongside the ingredient/recipe catalog expansion, plus a handful of low-risk P2 consistency
and scalability items (Dex/Shop filters, Recipe Select chapters, HOME's unused space). The
core experience already earns its "pizza game, not a form" goal: the pizza is the visual
centerpiece throughout, RESULT's information hierarchy is already deliberately and correctly
tuned, and the three overlays (Dex/Shop/Inventory) are visually consistent with each other.

---

*Audited SHA: `2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7` (origin/main). Read-only audit —
no production code changed, no PR opened. Screenshots and this report committed to
`claude/teto-pizza-visual-audit-o7nise`.*
