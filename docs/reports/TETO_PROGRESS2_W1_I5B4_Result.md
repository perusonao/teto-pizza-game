# Progression 2.0 W1 Integration I5b-4 — Mobile UI at 25 Recipes / 29 Ingredients (Result)

Status: **I5b-4 implemented and verified — STOP before PR** (no PR, no main merge, no I5b-5).
Base: `5204a26` (I5b-3, pushed) on `claude/teto-pizza-w1-i4a-j46ph0`; main `12a09de`.
Authority: `docs/reports/TETO_PROGRESS2_W1_I5B_FRESH-AUDIT.md`, I5b-3 result (25-recipe production
data), `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`.

Scope: UI / CSS / component only. No change to the 25-recipe authority, 29 obtainable, ladder,
unlock steps, prices, stock economy, migration, save format, scoring, Lunch Rush, CUT, recipe
compositions or reference layouts.

## 1. Changes

| Area | File | Change |
|---|---|---|
| HOME (fresh save) | `src/screens/HomeScreen.tsx` | CTAs always render in the same 2+1 order: 「ピザを作る」+「ランチラッシュ」, then a full-width フリークッキング. Before the first discovery フリークッキング (「🎨 フリークッキングで探す」) is primary, 「ピザを作る」 secondary, ランチラッシュ LOCKED (Phase 3-3 intent kept). |
| HOME | `src/App.css` | `.cta-button--free-cook-lead`: primary height/size, one line. |
| Pizza Select | `src/screens/PizzaSelectScreen.tsx` | Grid-card name / lock label carries `--name-chars` (display length). |
| Pizza Select | `src/App.css` | Grid is `minmax(0, 1fr)`; card is an inline-size container; name font = `clamp(11px, (100cqi - 8px) / chars, 14px)` so names up to 12 full-width chars stay on one line. Wrapping remains the fallback (no overflow possible); `@supports` guarded. |
| Tests | `src/screens/HomeScreen.ctaLayout.test.tsx` (new) | Fresh vs discovered CTA order, classes, LOCKED Lunch Rush. |
| Tests | `src/screens/PizzaSelectScreen.test.tsx` | Every grid label carries its char count; longest recipe name ≤ 12. |
| Tests | `src/components/ResultPanel.test.tsx` | 3-material notice layout (fontina/gorgonzola/parmigiano) kept as a component test — the 25-recipe ladder no longer has a 3-material step. |

## 2. Before → after (Chromium, production build)

| Screen | 390×844 before | 390×844 after | 360×800 before | 360×800 after |
|---|---|---|---|---|
| Fresh HOME CTAs | 3 in one row, 87px tall, 「フリー/クッキン/グで探す」 multi-line | 175×54 + 175×54, then 358×54 one line | 3 in one row, 108px tall, 7-line text | 160×54 + 160×54, then 328×54 one line |
| Pizza Select names (25 cards) | all 1 line | all 1 line | 4 names 2 lines, mid-word (「ブレックファストピ/ザ」, 「ピッツァ・ポルトゲ/ーザ」); lock labels too (「ニューヘイブンアピ/ッツァ」) | all names + lock labels 1 line (11–14px) |
| Shop (26 rows) | 1-line names, no overflow | unchanged | 1-line names, no overflow | unchanged |
| Tray (22 toppings, 4 pages × 6) | 1-line chips, no overflow | unchanged | 1-line chips, no overflow | unchanged |
| Horizontal overflow (`scrollWidth - clientWidth`) | 0 everywhere | 0 everywhere | 0 everywhere | 0 everywhere |

Metrics: `docs/reports/screenshots/progression2-w1-i5b4/{before,after}/metrics.json`. The after run
counts text lines from rendered line boxes (Range client rects) and also includes lock labels; the
before run estimated lines from element height (buttons with padding read as >1).

Flow unchanged: fresh 「ピザを作る」 → Pizza Select (Dex-0 guard) → Margherita → 「フリークッキングで探す」
→ Free Cooking. Pizza Select chapters stay 7/8/8/2 (data); the Dex-0 guard cannot be bypassed.

Shop / tray reviewed at max content (26 rows; everything owned, stock-0 rows/chips dimmed, NEW
入荷 badges, "あと N Pitz たりません", refill price): no fix needed.

## 3. Evidence

Screenshots: `docs/reports/screenshots/progression2-w1-i5b4/`
- before/after: `01-fresh-home`, `04-pizza-select-mid-scroll2`, `04-pizza-select-mid-scroll3` (both viewports)
- after only (verification): `03-dex1-home`, `05-pizza-select-detail-portuguesa`, `06-shop-max-scroll{0,2}`, `07-tray-topping-p{1,4}`

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---|---|---|
| `i5b4-w1-ui-390x844.mp4` (MP4/H.264, delivered in session, not committed; `artifacts/review/` is gitignored) | 390×844 | 42.6 s | 1.4 MB | PASS |

Video Verification: PASS (plays, 390×844, contact sheet checked: every segment below present).

What to check in the video:
- Fresh HOME: 「ピザを作る」 / LOCKED 「ランチラッシュ」 on row 1, full-width one-line 「🎨 フリークッキングで探す」 on row 2.
- 「ピザを作る」 → Pizza Select at 0/25 (all locked except Margherita) → Margherita → Free Cooking.
- Mid-progress Pizza Select scrolled through chapters 1–4: long names on one line, NEW / locked / discovered cards; Portuguesa detail.
- Shop with 26 rows scrolled end to end.
- Free Cooking tray with every topping owned: pages 1/4 → 4/4.

## 4. Verification

| Check | Result |
|---|---|
| Focused (HomeScreen ×2, PizzaSelectScreen, ResultPanel, App.fullGameReset) | 88/88 PASS |
| Full Vitest | 147 files / 3228 tests PASS |
| Typecheck `npx tsc -b` | PASS |
| Lint `npm run lint` | PASS (0) |
| Build `npm run build` | PASS |

## 5. Remaining / I5b-5

- Chapter 4 holds 2 cards (7/8/8/2 split is data, unchanged); there is no chapter jump nav — at 25
  cards Pizza Select is ~3 screens of scroll at 390 and 360, which reads acceptably.
- I5b-5: update the stale Chromium E2E expectations (`/15` → `/25`, the old step-14 three-cheese
  notice); not runtime bugs, production untouched.
