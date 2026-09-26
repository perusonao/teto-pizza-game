# Progression 2.0 W1 — Discovery 2.0 W1 production implementation (Result)

Status: **W1-a1 → a2 → b → a3/c → f → e implemented and verified (Chromium LK-8 PASS). Slice 8 (I5b-4b + W1-d) STOPPED:
I5b-4b does not exist.** No PR, no merge, I5b-5 not started.

- Branch: `claude/teto-pizza-w1-i4a-j46ph0` (the I5b integration line; base `fbfd738` = I5b-4).
- main `12a09de` (unchanged; I5b-3 / I5b-4 are still not in main — not merged, per the Git strategy).
- Authority: Owner Decisions OD-DISC-1 (A′), OD-DISC-3 (name at the discovery moment), OD-DISC-5
  (EP1 out of W1 display/gate, legacy data kept), OD-DISC-9 (chapters 6 / 9 / 10); Discovery / Recipe
  Dex 2.0 Design `a8ef4d9`; Leak Fresh Audit `06b6b2c`; Post-I5b-4 Integration Gate `b0cfc8d`.

## 1. Commits

| Slice | Commit | Summary |
|---|---|---|
| I5b-5a | `0b44e6a` | e2e: `/15`→`/25`; step-14 three-cheese notice → steps 11 / 24 (2 materials); guided e2e fixtures seed their recipe as discovered |
| W1-a1 | `e7195f9` | `recipeDiscoveryState` (4 states), `isRecipeCookable` / `canStartGuidedRound`, `recipeChapters` (6 / 9 / 10) |
| W1-a2 A | `101492f` | Test fixture migration only (`testSupport/guidedRound.ts`); full suite green on the **old** production code |
| W1-a2 B | `3ef72f2` | LK-8 backstop: SELECT_RECIPE / BEGIN_PREPARE / RETRY_SAME_RECIPE guards, strict FREE pool (fail closed), matcher-only discovery, App navigation guard |
| W1-b | `98ce92a` | Shop: no recipe names (row hint + purchase feedback) |
| W1-a3 + W1-c | `4e24fa9` | Pizza Select A′ (discovered only + one anonymous prompt), EP1 off, chapters 6 / 9 / 10 |
| W1-f | `2775b88` | Dex by chapter, No. per slot, ？？？ + 🎨 / 🏪 state tags |
| W1-e | `96d87ad` | HOME: Shop `NEW n`, Dex `NEW`, bubble priority (2+1 skeleton unchanged) |
| evidence | (docs) | before / after screenshots, this report |

## 2. Owner Decisions — implementation

| OD | Result |
|---|---|
| OD-DISC-1 (A′) | Pizza Select cards = DISCOVERED recipes only (name, preview, ★ / BEST, guided CTA). One anonymous prompt: Dex 0 / DISCOVERABLE → Free Cooking, only Shop-gated → Shop, none when complete. |
| OD-DISC-3 | No undiscovered name in Pizza Select, Shop, Dex, HOME, FREE orders, aria-label, hidden grid or `--name-chars` (tests walk the whole ladder, arrived / bought). The name first appears on the discovery Result. |
| OD-DISC-5 | No EP1 display (no `○○を1枚完成させると解禁`, `あと★`, LOCKED / ？？？ Pizza Select cards). No EP1 gate: SELECT_RECIPE / pool use `canStartGuidedRound`; the only remaining reader (Lunch Rush pool = discovered ∩ available) is inert because a discovered recipe is always unlocked (A2) — pinned by a test. EP1 data, `recipeCardState`, `unlockHintFor` and their tests are kept. |
| OD-DISC-9 | `recipeChapter` = price tier of the recipe's key ladder step → 6 / 9 / 10. Pizza Select and Dex use only `src/state/recipeChapters.ts`; `RECIPE_SECTION_BOUNDARIES` / `buildRecipeSections` are no longer used by UI (kept, legacy). |

## 3. Domain contracts

- **4-state derivation** (`src/state/recipeDiscoveryState.ts`): DISCOVERED > DISCOVERABLE (every
  finite material owned with stock ≥ 1) > KNOWN_BUT_MISSING_MATERIAL (all entitled, one unbought or
  stock 0) > UNKNOWN. Inputs: Dex, ownership, Shop ledger, inventory. Nothing persisted; EP1 not read;
  any number per state (legacy Dex-15 save: DISCOVERABLE = 2, tested).
- **`canStartGuidedRound(recipeId, {dex, owned, inventory})`** = discovered AND cookable. Cookable =
  every required ingredient owned; finite ones with stock ≥ `minCount` (scatter) / ≥ 1 (sauce).
  Starters stay unlimited.
- **SELECT_RECIPE**: rejected unless `canStartGuidedRound` (any Dex size).
- **BEGIN_PREPARE**: a non-Free-Cooking ORDER stays at ORDER unless startable (FREE: full rule; Lunch
  Rush: discovered — its pool / stock rules unchanged).
- **RETRY_SAME_RECIPE** (guided): same rule. App routes a rejected retry to Pizza Select (no dead button).
- **FREE order pool** (`getNextFreeOrder`): DISCOVERED ∩ cookable, no undiscovered priority.
  **Empty pool fails closed** → a Free Cooking round at ORDER (never all ORDERS). Dex 0 no longer
  holds a guided margherita ORDER (LK-8c).
- **App**: enters GAME only when the selection will be accepted (same pure rule, NF-2).
- **Matcher-only discovery**: REGISTER_TO_DEX never registers an undiscovered guided id by itself
  (only the matcher may); MISSION_NEXT_ORDER never discovers. Free Cooking discovery unchanged.
- **F-15 stock**: stock 0 never makes a recipe DISCOVERABLE, never starts a guided round; a discovered
  out-of-stock recipe stays in Pizza Select with its CTA disabled and a Shop link.
- **Save compatibility**: no schema / key change; legacy Dex-15 save hydrates to a discovered order with
  Dex / ownership / stock / ledger untouched (tested).

## 4. Tests

| Check | Result |
|---|---|
| Full Vitest | **153 files / 3256 tests PASS** |
| typecheck `npx tsc -b` | PASS |
| lint `npm run lint` | PASS (0 warnings) |
| build `npm run build` | PASS |
| STEP A on old production code | 149 / 3240 PASS (fixtures valid under both contracts) |
| New LK-8 reducer suite on old code | 10 / 14 FAIL (they catch the leak); App LK-8b/8d suite 3 / 3 FAIL on old code |
| Leak oracles | Shop, Pizza Select, Dex: every ladder Dex × (arrived, bought), text + aria/title/alt/style; NF-8 overlaps allowlisted by exact phrase (ペパロニ, ジェノベーゼソース, 「ナポリ生まれ」) |
| Chromium e2e, full suite (iphone-390x844 + iphone-360x800), final code | **144 / 144 PASS** (2 more stale specs fixed in `be88532`: Pizza Select long-grid seed, RT-01 15→25) |

## 5. Chromium LK-8 (390×844, dev server, legacy Dex-15 save — W1 recipes DISCOVERABLE)

Undiscovered W1 names found in the page (`document.body.innerText`) per path; JSON in
`docs/reports/screenshots/progression2-w1-discovery/lk8-{before,after}/lk8.json`.

| Path | before (`fbfd738`) | after (this branch) |
|---|---|---|
| LK-8a Lunch Rush RESULT → フリープレイへ → ORDER → フリープレイ (2 runs) | ✕ ペストトンノピザ / ピッツァ・ポルトゲーザ order, guided round started | ✓ 0 — ミートラヴァーズ / マリナーラ (discovered) |
| LK-8b FREE PREPARE → HOME → Lunch Rush intro 閉じる → フリープレイ (2 runs) | ✕ ピッツァ・ポルトゲーザ / ペストトンノピザ | ✓ 0 — トンノ・エ・チポッラ (discovered) |
| LK-8b′ HOME during a Lunch Rush round → intro 閉じる (2 runs) | ✕ ペストトンノピザ ×2 | ✓ 0 |
| Pizza Select on the same save | ✕ 25 cards, all 10 undiscovered names | ✓ 15 cards (discovered), 0 names |

Screenshots: `lk8-before/lk8a-2-free-order.png` (an undiscovered recipe's order after フリープレイへ)
vs `lk8-after/lk8a-2-free-order.png` and `lk8-after/lk8b-1-intro-closed-order.png` (discovered orders).

UI before / after (390×844, 360×800; fresh, mid-ladder, legacy-15): `before/`, `after/` —
horizontal overflow 0 everywhere; Pizza Select cards 25 / 25 / 25 → 0 / 8 / 15.

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---|---|---|
| `w1-discovery-390x844.mp4` (MP4/H.264, delivered in session, not committed) | 390×844 | 41.0 s | 1.6 MB | PASS |

Video Verification: PASS (contact sheet checked). What to check: fresh Pizza Select = prompt only →
Free Cooking; legacy save HOME (Shop `NEW 3`, bubble) → Pizza Select (discovered only, 6/9/10 counts)
→ Dex (？？？ + 🏪 / 🎨 tags) → Shop (generic hint); LK-8a and LK-8b land on discovered orders.

## 6. Remaining / handoff

- **Slice 8 STOPPED**: I5b-4b (Cooking layout authority) does not exist on any branch; W1-d (Discovery
  Result hierarchy, 「📖 図鑑を見る」 on the Dex-registration row) depends on it and OD-DISC-6. Not started.
- Remaining leak findings: F-13 (LOW — INCOMPLETE_MATCH copy says the combination is a Dex pizza, no
  name); LK-6 (Dex-0 onboarding hint Level 3) kept as the intentional exception.
- I5b-5 handoff: LK-8 e2e spec, Pizza Select / Dex / HOME copy expectations (I5b-5b), WebKit, LC
  geometry (needs I5b-4b).
