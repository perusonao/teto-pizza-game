# Issue #39 — PS0 Fresh Audit: HOME/FREE Navigation + Pizza Select

- **Audited exact `origin/main` SHA:** `6f609f1a9952d6797f94fdaa7b446e3b2ed63a6f`
- **Expected SHA (task):** `6f609f1a9952d6797f94fdaa7b446e3b2ed63a6f`
- **Result:** match — no drift. This report audits exactly the expected commit.
- **Mode:** READ-ONLY. No production code was changed. No PR was opened.

---

## A. Current screen/navigation truth

### A.1 Screen enum and ownership

`src/App.tsx`:

```ts
type Screen = "HOME" | "GAME";
const [screen, setScreen] = useState<Screen>("HOME");
```

This is the *only* top-level screen enum. `App.tsx` owns it and every navigation decision (Issue #24 boundary comment, `App.tsx:76-80`). `HomeScreen` and `GameScreen` are pure presentational views over one shared `GameState`/`MissionState`.

Inside `GAME`, a second, independent state machine exists on `GameState.phase` (`src/state/gameReducer.ts:25`):

```ts
type GamePhase = "ORDER" | "PREPARE" | "BAKE" | "RESULT" | "DISCOVERED";
```

And a third, fully separate reducer drives the Lunch Rush mission wrapper (`src/mission/lunchRush.ts:95`):

```ts
type MissionMode = "FREE" | "INTRO" | "PLAYING" | "RESULT";
```

So "which mode" is not one flag — it is `screen` (HOME/GAME) × `mission.mode` (FREE/INTRO/PLAYING/RESULT) × `state.phase` (ORDER/PREPARE/BAKE/RESULT/DISCOVERED), all independent `useReducer`/`useState` in `App.tsx`.

### A.2 Actual current diagram (not what the issue assumed)

**Important correction to the issue's premise:** there is **no separate full-screen "mode select" screen** anywhere in `screen: Screen`. HOME already branches directly:

```
HOME
├─ 「ピザを作る」 (home-cta-row primary CTA)
│    onClick = handleStartFreePlay
│    → setScreen("GAME"); mission.mode stays "FREE" (already default)
│    → GameScreen renders state.phase (whatever it currently is, usually "ORDER")
│
├─ 「ランチラッシュ」 (home-menu card)
│    onClick = handleStartLunchRush
│    → setScreen("GAME"); missionDispatch({type:"SHOW_INTRO"})
│    → GameScreen renders mission.mode === "INTRO" → <MissionIntroOverlay> on top
│
├─ 「ピザ図鑑」 (home-menu card) → setDexOpen(true) → <DexOverlay> over HOME
└─ 「ショップ」 (home-menu card) → setShopOpen(true) → <ShopOverlay> over HOME
```

The redundant "FREE / Lunch Rush" re-choice the issue describes is **not** a HOME-level screen. It lives *inside* `GameScreen`'s `ORDER` phase action row (`src/screens/GameScreen.tsx:279-290`):

```tsx
{state.phase === "ORDER" && (
  <div className="action-row">
    <button onClick={onBeginPrepare}>
      {mission.mode === "FREE" ? "🍕 フリープレイ" : "ピザを作る！"}
    </button>
    {mission.mode === "FREE" && (
      <button onClick={onShowMissionIntro}>⏱ Lunch Rush</button>
    )}
  </div>
)}
```

So today, after HOME → 「ピザを作る」, the player lands on GAME's ORDER phase and sees **both** "🍕 フリープレイ" (proceed with whatever recipe `state.recipe` currently is) **and** a secondary "⏱ Lunch Rush" button that also reaches Mission Intro. This is the "同じ意思決定を二段階で要求する" redundant picker `docs/PROJECT_HANDOFF.md`'s Navigation contract and Issue #39's body explicitly call out. There are therefore **two independent paths into Lunch Rush today**: HOME's dedicated card, and this in-round secondary button.

### A.3 Full trace of the requested paths

**HOME → mode select → FREE → ORDER/PREPARE → Making Game:**

1. `HomeScreen` `onStartFreePlay` prop → `App.handleStartFreePlay` (`App.tsx:352-364`).
2. If `state.phase` is `RESULT`/`DISCOVERED` (leftover from a previous session), dispatches `PLAY_AGAIN` first so a stale finished round never resurfaces.
3. `setScreen("GAME")`.
4. GAME renders `state.phase === "ORDER"` → dialogue + the action-row above.
5. Player taps "🍕 フリープレイ" → `onBeginPrepare` → `dispatch({type:"BEGIN_PREPARE"})` → reducer sets `phase: "PREPARE"`, builds `state.hint`.
6. PREPARE renders `IngredientTray`/`PizzaStage`/making-step bar → `CONFIRM_MAKING_STEP` (SAUCE→CHEESE→TOPPING) → `START_BAKE` → `BAKE` phase.

**HOME → mode select → Lunch Rush:**

1. `HomeScreen` `onStartLunchRush` prop → `App.handleStartLunchRush` (`App.tsx:366-369`).
2. `setScreen("GAME")`; `missionDispatch({type:"SHOW_INTRO"})` (only transitions `FREE → INTRO`, no-op otherwise).
3. GAME renders `mission.mode === "INTRO"` → `<MissionIntroOverlay onStart={startMission} onClose={onMissionCloseIntro} />` full-screen over GAME.
4. `startMission()` (`App.tsx:248-253`): closes Dex if open, snapshots `missionBestAtStartOfRun`, `missionDispatch({type:"START", now, config})` (mode→PLAYING, fresh clock/metrics/runId), `dispatch({type:"MISSION_RESET_ORDER"})` (picks a fresh Mission order via `pickMissionOrder`, `isMissionRound:true`).
5. `MissionHud` shows the countdown; each completed round calls `handleMissionServeNext` → `missionDispatch({type:"SERVE",...})` then `dispatch({type:"MISSION_NEXT_ORDER"})` if not expired.
6. Expiry (TICK or SERVE detecting `endsAt` passed) → `mission.mode = "RESULT"` → `<MissionResultOverlay>` with retry (`onMissionStart`) or exit (`onMissionExitToFree` → `exitMissionToFree`: `missionDispatch({type:"EXIT_TO_FREE"})` + `dispatch({type:"PLAY_AGAIN"})`).

**FREE initialization on first load:** `App.tsx:89-92` — `createInitialGameState(save.dex, save.ownedIngredientIds, save.pitzBalance)` picks `preferFirst: true` → Margherita order, `phase: "ORDER"`, `isMissionRound: false`.

**Lunch Rush initialization:** `MISSION_RESET_ORDER`/`MISSION_NEXT_ORDER` → `nextMissionOrderState` → `pickMissionOrder(availableRecipeIds(...), state.recipe.id)` → `getNextOrder({availableRecipeIds, excludeRecipeId})` (no `dex`/`preferFirst` — uniformly random, only avoiding immediate repeat).

**Back / reset:** `handleGoHome` (`App.tsx:338-350`) — confirms via `window.confirm` only if `isRoundInProgress()` (Mission PLAYING, or FREE mid-PREPARE/BAKE). If leaving a non-FREE mission mode, calls `exitMissionToFree()` first (no confirm needed for INTRO/RESULT overlays). If FREE mid-PREPARE/BAKE, dispatches `PLAY_AGAIN`. Always ends with `setScreen("HOME")`.

**RESULT/DISCOVERED → HOME:** `handleGoHome` treats RESULT/DISCOVERED as "nothing in progress" (no confirm) — same button, same function. `handleStartFreePlay` is the one place that discards a leftover RESULT/DISCOVERED round via `PLAY_AGAIN` before re-entering GAME.

### A.4 What breaks if the "intermediate mode select" is removed

Since no HOME-level mode-select screen exists to delete, "removing it" in PS1 terms means: **stop presenting the secondary "⏱ Lunch Rush" button inside GAME's ORDER action-row**, and instead route HOME's 「ピザを作る」 through a new Pizza Select screen before reaching ORDER/PREPARE. Concrete risks to check when doing that:

1. **`App.test.tsx` "HOME/GAME separation (Issue #24)" suite** (12 tests, `src/App.test.tsx:38-181`) — several directly assert `onStartFreePlay` → `screen "GAME"` with `state.phase === "ORDER"` visible immediately. These will need rewriting once 「ピザを作る」 routes to a Pizza Select screen first, not GAME.
2. **The in-round secondary Lunch Rush button removal** changes `GameScreen`'s ORDER action-row from two buttons to one. Nothing else in `GameScreen` reads that button's existence, but any test asserting its presence (`⏱ Lunch Rush` text inside GAME) needs updating. A grep found no dedicated unit test file for `GameScreen.tsx`'s ORDER action-row specifically (only keyboard/drag-overlay tests), so this is a small, contained risk.
3. **`handleStartFreePlay`'s reset-on-stale-RESULT logic** (`App.tsx:352-364`) must be preserved or re-homed: whichever screen becomes the final entry into PREPARE/ORDER still needs "don't resurface a finished round" behavior when the player picks a recipe from Pizza Select.
4. **`isRoundInProgress`/`handleGoHome`'s confirm-before-discard gate** (`App.tsx:331-350`) is currently keyed off `mission.mode`/`state.phase`, not `screen`. If Pizza Select becomes a third top-level `Screen` value, `handleGoHome`'s confirm condition doesn't apply to Pizza Select (nothing to lose there — same as ORDER/RESULT today), but the *back-from-Pizza-Select-to-HOME* path needs its own handler; it must not accidentally reuse `handleGoHome`'s Mission-exit branch (`exitMissionToFree()`) since Pizza Select is reached only when `mission.mode === "FREE"` already.
5. **`lastOrderId`/`lastMakingStep`/`lastPhase` effect-derived `useState` sync blocks in `App.tsx:134-168`** all key off `state.order.id`/`state.makingStep`/`state.phase` changes, not `screen`. Adding a new `Screen` value or an explicit `SELECT_RECIPE`-style action does not, by itself, touch any of these — but if Pizza Select's recipe pick is implemented by dispatching a *fresh* order (see section B), these blocks will fire exactly as they do today for `PLAY_AGAIN`, which is the safe/existing pattern to reuse rather than inventing a parallel one.
6. **Mission Intro/Lunch Rush path is unaffected** by removing the ORDER action-row's secondary button, since HOME's own "ランチラッシュ" card calls `handleStartLunchRush` directly and never passes through ORDER's action-row at all.
7. **`PreviewBadge`** renders unconditionally at the `app-frame` root (`App.tsx:420`) regardless of `screen` — adding a third screen value needs no change there.

---

## B. FREE recipe determination — traced

Today, FREE's recipe is **never player-selected**. It is decided entirely by `src/data/orders.ts`'s `getNextOrder`, called from three places in `gameReducer.ts`:

| Caller | When | Options passed |
|---|---|---|
| `createInitialGameState` | app mount (session start) | `{ preferFirst: true }` → always Margherita |
| `nextOrderState` via `PLAY_AGAIN` | "もう一度作る" from DISCOVERED, or exiting Mission to Free | `{ excludeRecipeId: state.recipe.id, dex, availableRecipeIds }` |
| `nextMissionOrderState` via `MISSION_RESET_ORDER`/`MISSION_NEXT_ORDER` | Mission start/retry/next round | `{ availableRecipeIds, excludeRecipeId }` (no `dex`/`preferFirst`) |

`getNextOrder`'s own logic (`orders.ts:90-105`): if `preferFirst`, return the Margherita order. Otherwise, filter `ORDERS` to `availableRecipeIds` (falls back to all if empty), prefer **undiscovered** recipes if any exist in that pool, avoid repeating `excludeRecipeId` (unless that would empty the pool), then **pick uniformly at random** from what remains.

So: FREE's recipe is **random, undiscovered-prioritized, repeat-avoiding**, decided at the `Order`/reducer layer — there is no UI ownership of it at all today, and no explicit `recipeId` ever flows in from a component.

### Minimal boundary for Pizza Select to pass an explicit `recipeId`

The reducer already has the exact machine needed: `buildOrderState(order, carry, isMissionRound)` takes any `Order` and builds a correct fresh `ORDER`-phase `GameState` around it (empty pizza, `makingStep: "SAUCE"`, cleared score/hint/placement, progression carried through). The **only** thing that is FREE-random-only today is `nextOrderState`'s *order selection* step, not the state-building step.

The smallest, least invasive change is:

- Add one new lookup in `src/data/orders.ts`: `findOrderForRecipe(recipeId: RecipeId): Order | undefined` (or reuse `ORDERS.find(o => o.recipeId === recipeId)`, since `ORDERS` already has exactly one order per recipe — a 1:1 mapping today).
- Add one new `GameAction` (e.g. `{ type: "SELECT_RECIPE"; recipeId: RecipeId }`) whose reducer case is `buildOrderState(order, carry, /*isMissionRound*/ false)` using that looked-up order — structurally identical to `PLAY_AGAIN`'s existing case, just keyed by an explicit id instead of "not the current recipe."
- Pizza Select's card `onClick` calls this new dispatch (via a new `onSelectRecipe(recipeId)` prop threaded through `App.tsx`), then `setScreen("GAME")` (or a value naming the flow, see section H).

This requires **zero changes** to `PizzaState`, `Recipe`, `Order`, Dex, scoring, or persistence — the recipe/order/pizza pipeline already accepts any recipe id; only the *selection trigger* is new.

### Separation from Lunch Rush recipe selection

Already structurally separate: `nextMissionOrderState`/`pickMissionOrder` is Mission-only code in `src/mission/lunchRush.ts`, untouched by anything above. Adding `SELECT_RECIPE` to `gameReducer.ts` does not touch `pickMissionOrder`, `MISSION_NEXT_ORDER`, or `MISSION_RESET_ORDER` at all. This satisfies the "分離してください" requirement without any extra abstraction — the existing module boundary (`orders.ts`/`gameReducer.ts` vs `mission/lunchRush.ts`) already does the job.

---

## C. Recipe catalog — full current-main truth

All data below is read directly from `src/data/recipes.ts`, `src/data/orders.ts`, `src/data/recipeSauceProfiles.ts`, `src/data/referencePizza.ts`, and `src/state/progression.ts`. **Bismarck is implemented**, not a placeholder — see explicit confirmation below.

| recipeId | nameJa | requiredIngredients | unlock condition | has Order entry | has sauce profile | has Reference fixture | FREE-makeable | Lunch-Rush-makeable |
|---|---|---|---|---|---|---|---|---|
| `margherita` | マルゲリータ | tomato-sauce, mozzarella×3, basil×2 | none (Starter Set only) | ✅ `order-margherita` | ✅ tomato-sauce / PAINT | ✅ `MARGHERITA_REFERENCE` (only recipe with one) | ✅ | ✅ |
| `marinara` | マリナーラ | tomato-sauce, garlic×3, oregano×2 | none | ✅ `order-marinara` | ✅ tomato-sauce / PAINT | ❌ | ✅ | ✅ |
| `quattro-formaggi` | クアトロ フォルマッジ | olive-oil, mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2 | none | ✅ `order-quattro-formaggi` | ✅ olive-oil / PAINT_TEMPORARY | ❌ | ✅ | ✅ |
| `genovese` | ジェノベーゼ | pesto, mozzarella×2, cherry-tomato×3 | none | ✅ `order-genovese` | ✅ pesto / PAINT | ❌ | ✅ | ✅ |
| **`bismarck`** | **ビスマルク** | tomato-sauce, mozzarella×3, egg×1 | **none — egg is Starter Set, always OWNED** | ✅ `order-bismarck` | ✅ tomato-sauce / PAINT | ❌ | ✅ | ✅ |
| `funghi` | フンギ | tomato-sauce, mozzarella×2, mushroom×3 | none | ✅ `order-funghi` | ✅ tomato-sauce / PAINT | ❌ | ✅ | ✅ |
| `fugazza` | フガッサ | olive-oil, onion×4, oregano×1 | **`onion` requires `totalStars >= 12`**, then 120 Pitz purchase | ✅ `order-fugazza` | ✅ olive-oil / PAINT_TEMPORARY | ❌ | conditionally* | conditionally* |

\* `fugazza` is excluded from `availableRecipeIds(ownedIngredientIds)` (and therefore from both FREE's and Lunch Rush's order pool) until `onion` is purchased — see `src/state/progression.ts:41-52` and `orders.ts:84-88`'s availability filter.

**Total recipe count: 7**, all defined via a single `as const` array — `RecipeId` is derived from it, so it cannot drift.

### Bismarck — explicit current truth (per the task's caution not to assume)

Bismarck is **fully data-modeled and playable today**, in both FREE and Lunch Rush, exactly like Marinara/Quattro Formaggi/Genovese/Funghi:

- `RECIPES` entry exists (`recipes.ts:73-84`) with real `requiredIngredients` and `bakeTarget`.
- `ORDERS` entry exists (`orders.ts:35-40`) with dialogue line.
- `RECIPE_SAUCE_PROFILES.bismarck` exists (`recipeSauceProfiles.ts:41-45`) — tomato-sauce, PAINT.
- All required ingredients (`tomato-sauce`, `mozzarella`, `egg`) are Starter Set (`STARTER_INGREDIENT_IDS`, `ingredients.ts:207-209`) — **always OWNED**, so `isRecipeAvailable` is always `true` for Bismarck; there is no unlock gate on it at all.
- It has **no Dex entry until the player actually completes a Bismarck round once** — same as every other recipe (Dex entries are created lazily by `registerScoreToDex`, `dex.ts:66-94`).
- It has **no `ReferencePizza`** — `getReferencePizza` (`referencePizza.ts:162-164`) returns `null` for every `recipeId` except `"margherita"`. This only disables the Reference-popover/shadow-sauce-metrics prototype UI for Bismarck (an Issue #32/Phase 4A-1A scope guard, unrelated to Issue #39); it does not block making or scoring Bismarck at all.

So the issue's target example — "ビスマルク NEW (解放済み・未挑戦)" — is **achievable truthfully on current main**: Bismarck is unlocked (Starter Set only) but, on a fresh save, undiscovered (no Dex entry yet) → exactly "NEW" semantics. Nothing needs to be invented.

**What genuinely does not exist and must not be fabricated for PS2/PS3:** a *locked* (`？？？`) recipe card cannot honestly point at any of the 7 current recipes except `fugazza` before its `onion` unlock — that is the **only** recipe with a real lock condition today. A 4-card mockup ("2 unlocked + 2 locked") cannot be reproduced with completely truthful data unless the design either (a) only shows `fugazza` as the one locked card plus however many of the other 6 are shown, or (b) explicitly design-decides to show all discovered/undiscovered-but-available recipes as unlocked (since 6 of 7 recipes have no lock condition at all). This is a product question, not an audit gap — flagged in Blockers below.

---

## D. Progression / Dex / BEST / Stars — data sources

All four Pizza Select states are derivable **today**, purely from data already threaded into `App.tsx`/`GameState`, with no new fields:

1. **Completed (name + highest stars/BEST):** `DexEntry` per recipe — `state.dex.find(e => e.recipeId === recipe.id && e.discovered)`. `entry.bestStars` (`QualityStars`, 1–5) and `entry.bestScore` (0–100) are exactly "highest stars/BEST" (`src/state/dex.ts:13-19`; monotonic by construction via `registerScoreToDex`/`isBetterQuality`, `dex.ts:55-94`).
2. **Unlocked-but-unplayed = NEW:** `isRecipeAvailable(recipe, state.ownedIngredientIds)` (`progression.ts:41-44`) is `true` **and** no discovered Dex entry exists for it.
3. **Locked = `？？？`:** `isRecipeAvailable(recipe, state.ownedIngredientIds)` is `false` (today: only possible for `fugazza`, gated on owning `onion`).
4. **Highest stars:** `entry.bestStars` directly (no separate "totalStars" needed per-card — `totalStars(dex)` in `mastery.ts` is a *sum across all recipes*, used for ingredient unlock gating, not per-recipe display).
5. **BEST score:** `entry.bestScore` directly.

All of `RECIPES` (catalog), `state.dex` (discovery/BEST/stars), and `state.ownedIngredientIds` (availability) are already props/state living in `App.tsx` and already passed into `HomeScreen` (`dex`) — Pizza Select needs exactly the same three inputs, nothing new.

### Avoiding double state management between Pizza Select and Pizza Dex

Recommended: a single pure selector module (e.g. `src/state/pizzaSelect.ts`, mirroring the existing `progression.ts` pattern) exporting one function:

```ts
type RecipeCardState =
  | { kind: "COMPLETED"; recipe: Recipe; bestStars: QualityStars; bestScore: number }
  | { kind: "NEW"; recipe: Recipe }
  | { kind: "LOCKED"; recipe: Recipe };

function recipeCardState(recipe: Recipe, dex: DexState, ownedIngredientIds: readonly string[]): RecipeCardState
```

This is pure/derived (same shape as `isRecipeAvailable`/`ingredientState` already are), takes the same three inputs Dex/Shop/Pizza Select all already share, and stores nothing. Both `DexOverlay` (today re-deriving its own locked/discovered/NEW-badge logic inline, `DexOverlay.tsx:50-64`) and the new Pizza Select screen can call the same selector — Pizza Select answering "what can I make right now," Dex answering "what have I discovered/mastered" (its own additional `timesMade`/completion-% concerns stay Dex-only). No new persisted field, no new derived cache, no risk of the two screens disagreeing about what's locked.

---

## E. Save compatibility

Current schema: `src/state/persistence.ts` — `PersistentSaveV1` (`SAVE_STORAGE_KEY = "teto-pizza-save-v1"`, `CURRENT_SCHEMA_VERSION = 1`):

```ts
interface PersistentSaveV1 {
  schemaVersion: 1;
  dex: DexEntry[];
  pitzBalance: number;
  ownedIngredientIds: string[];
  missionBest: Record<string, number>;
}
```

Pizza Select reads `RECIPES` (static import), `state.dex`, `state.ownedIngredientIds` — all three already exist in this exact shape and are already loaded/sanitized by `loadSave`/`sanitizeSave`. Selecting a recipe and starting FREE with it writes nothing new to storage: it only changes in-memory `GameState.recipe`/`.order`/`.phase` via the reducer (section B), exactly like `PLAY_AGAIN` already does today, and `persistProgress`'s effect (`App.tsx:175-181`) only ever fires off `dex`/`pitzBalance`/`ownedIngredientIds` changes, none of which a recipe selection touches.

**Verdict: save migration is not required.** No `schemaVersion` bump, no new field, no new sanitize path. This holds for PS1–PS3 as scoped (navigation + Pizza Select UI + visual polish only).

---

## F. Official character assets

Confirmed present at exactly:

| Character | Path | Format | Size |
|---|---|---|---|
| Teto | `src/assets/characters/teto.webp` | WebP | 7,232 B |
| Mito | `src/assets/characters/mito.webp` | WebP | 1,666 B |
| Blue | `src/assets/characters/blue.webp` | WebP | 1,784 B |

Visually confirmed by direct inspection: Teto is a black Pomeranian in a white apron with a maroon bow tie; Mito is a white Pomeranian with a red bow; Blue is a husky with a blue bandana — matching the characters shown in the task's attached PIZZA DB mockups. **These are square, plain-background character portraits, not scene compositions** — the mockups' wooden-pizzeria backdrop, signage, and layout are not part of these image assets and must be built as DOM/CSS per the "no baked-image" rule already in `docs/PROJECT_HANDOFF.md`.

Current usage:

- `teto.webp` — imported in `src/screens/HomeScreen.tsx:1,68` (HOME hero image) and `src/components/DialogueBox.tsx:2,7` (Teto's dialogue portrait, used across GAME's ORDER/BAKE/RESULT dialogue).
- `mito.webp` — imported only in `src/components/DialogueBox.tsx:3,8` (Mito's order-line portrait).
- `blue.webp` — imported in `src/components/DialogueBox.tsx:4,9` (Blue's RESULT-line portrait) and `src/components/BakeOverlay.tsx` (per grep match — Blue also appears during BAKE).

**No generated/substitute dog art exists anywhere in `src/`** — grep for `mito.webp|blue.webp|teto.webp` returns exactly these three consumer files. HOME currently uses only Teto; Mito and Blue are never shown on HOME today (they only appear inside GAME's dialogue). Issue #39 PS3's HOME mockups show all three dogs on HOME — that reuses these exact same three existing files (`teto.webp`/`mito.webp`/`blue.webp`), just newly imported into `HomeScreen.tsx`.

---

## G. HOME visual implementation — current vs. target

`src/screens/HomeScreen.tsx` (113 lines) + `src/App.css` (`.home-*` rules, roughly lines 1613–1780) is already a real-DOM implementation, not an image-with-baked-text:

| Element | Current implementation | Component |
|---|---|---|
| Title bar | `<h1 className="app-header__title">` real text | `HomeScreen` header |
| Pitz balance | `<span aria-label>` real text, from `pitzBalance` prop | header |
| Dex progress pill | `<span aria-label>` real text, `${discoveredCount}/${totalRecipes}` computed from `RECIPES`/`dex` props | header |
| Settings button | real `<button disabled>`, decorative (no settings screen exists) | header |
| Hero | Teto image (`teto.webp`) + one static speech-bubble `<div>` | `.home-hero` |
| Primary CTA | real `<button>` "🍕 ピザを作る" | `.home-cta-row` |
| 2×2 menu | 4 real `<button>` cards: ランチラッシュ / ピザ図鑑 (real progress sub-label) / ショップ (real Pitz sub-label) / 実績 (disabled, "近日公開", honestly not fake-populated) | `.home-menu` |
| Footer | static text line | `.home-footer` |

So **all of Pitz/Dex-progress/NEW-equivalent numeric UI already follows the "real DOM, not baked image" rule** — this part of the target is already met by current main, not a gap PS3 needs to invent from scratch.

**What PS3 (visual reproduction) actually needs to change, component by component:**

- `HomeScreen.tsx`: add Mito/Blue imports + render (currently Teto-only hero); replace the flat `.home-hero__bubble`/plain background with the warm wood/brick/oven-glow visual treatment; the 2×2 `.home-menu` grid structure can very likely be kept (it is already the right shape — one primary CTA row + a card grid) and only needs re-skinning, not re-architecting.
- `App.css`: new wood/parchment/warm-lighting styling for `.home-screen`/`.home-hero`/`.home-menu__card`, replacing today's plain card look. No component-count change implied by this alone.
- Nothing here requires touching `App.tsx`'s navigation logic — G is purely `HomeScreen.tsx` + CSS, decoupled from A/B's routing changes.

---

## H. Proposed Pizza Select architecture (390×844)

Minimal, reusing existing patterns rather than inventing new ones (`HomeScreen`/`DexOverlay`/`ShopOverlay` are the closest precedents already in the codebase):

```
PizzaSelectScreen        (new, src/screens/PizzaSelectScreen.tsx — sibling of HomeScreen/GameScreen)
  ├─ header (reuse .app-header pattern: title "作るピザを選ぼう！" + back button to HOME)
  └─ RecipeSelectGrid
        └─ RecipeSelectCard × RECIPES.length   (one component, 3 visual states via props)
```

- **`PizzaSelectScreen`**: owns nothing but layout; receives `recipes: Recipe[]`, `dex: DexState`, `ownedIngredientIds: readonly string[]`, `onSelectRecipe: (id: RecipeId) => void`, `onBack: () => void` as props from `App.tsx` — exactly the same "thin view over App-owned state" contract `HomeScreen`/`GameScreen` already use.
- **`RecipeSelectCard`**: one component covering all three states (`COMPLETED`/`NEW`/`LOCKED`) via the section D selector's `RecipeCardState` union — a single `switch`/discriminated render inside one component is enough; a 7-recipe, 3-state grid does not need three separate card components. Rendered content: recipe `nameJa`, star string (reuse `DexOverlay`'s existing `starLabel` helper, or extract it to a shared util so it isn't duplicated), `BEST {score}` badge, `NEW` badge, or lock icon + `？？？`, matching the target mockups' 4-across-shrunk-to-fit layout.
- **No separate `RecipeProgressBadge` component is needed** — the star string + BEST number + NEW/lock badge are three small conditional spans inside `RecipeSelectCard`, not complex enough to warrant their own component (avoids over-fragmenting per the project's "don't add abstraction beyond what the task requires" convention already visible in `DexOverlay.tsx`'s own inline badge rendering).
- **New `Screen` value**: `type Screen = "HOME" | "PIZZA_SELECT" | "GAME"` in `App.tsx`. `handleStartFreePlay` becomes `setScreen("PIZZA_SELECT")` instead of `"GAME"`. A new `handleSelectRecipe(recipeId)` dispatches the new `SELECT_RECIPE` action (section B) then `setScreen("GAME")`.
- **Card interactivity**: `COMPLETED`/`NEW` cards are real `<button>`s calling `onSelectRecipe`. `LOCKED` cards render as `<button disabled aria-disabled="true">` (or a plain non-interactive `<div>` with the same visual weight) — **never wired to `onSelectRecipe`**, so "未解放カードはMaking Gameを開始できない" is enforced at both the UI layer (no working click handler) and, if `SELECT_RECIPE` is added, should also re-check `isRecipeAvailable` inside the reducer case itself (mirroring `PURCHASE_INGREDIENT`'s existing "reject invalid, return state unchanged" pattern, `gameReducer.ts:460-475`) so a stray/forced dispatch on a locked recipe can never start a round — the same reducer-boundary-is-the-real-guard discipline already used for `APPLY_SAUCE`/`PLACE_TOPPING`.

All three card states are **derived**, computed at render time from `dex`/`ownedIngredientIds`/`RECIPES` — no new state is stored anywhere, satisfying D's "no duplicate state" requirement structurally.

---

## I. Accessibility / mobile risks

Current baseline (from `HomeScreen.tsx`/`App.css`) that Pizza Select should match:

- Real `<button type="button">` elements throughout HOME (not `<div onClick>`), with `disabled`/`aria-disabled="true"` correctly paired on the one decorative button today (実績). Pizza Select's LOCKED cards should follow this exact pattern.
- `aria-label` used for information-bearing but visually icon/emoji-heavy elements (Pitz balance, Dex progress pill) — Pizza Select's star/BEST/NEW/lock badges should get equivalent `aria-label`s (e.g. `"マルゲリータ、最高評価5つ星、BEST 96"` / `"ビスマルク、未挑戦"` / `"？？？、未解放"`) since star glyphs and lock emoji alone are not reliably announced.
- `.app-frame` is `max-width: 390px`, `overflow-x: hidden` (`App.css:19-28`) — any new grid must respect this; a naive 4-across card row (per the mockup's desktop-style layout) **will overflow or become unreadably cramped at 390px** and must be restructured (1 or 2 columns, per Issue #39's own explicit instruction: "4カード横並びをそのまま縮小せず...responsive再構成する").
- `env(safe-area-inset-*)` is already used for header top-padding and any fixed bottom bar (`App.css:4,42,615,861,1775`) — a Pizza Select back button/header should reuse the same `.app-header` padding convention rather than a new one.
- Touch target size: existing `.home-menu__card`/`.cta-button` sizes are the established baseline; new recipe cards should match, not shrink below them to fit 4-across (this is exactly why 1–2 columns, not 4, is required at 390px).
- Long Japanese labels: `クアトロ フォルマッジ` (7 characters + space) is the longest `nameJa` in `RECIPES` — card width/line-wrapping must be tested against it, not just マルゲリータ.
- Focus/keyboard: no existing keyboard-specific test coverage for `HomeScreen`'s buttons was found (only `GameScreen`'s keyboard overlay/spread-repeat tests exist for the making flow) — Pizza Select cards being plain `<button>`s already gets native focus/Enter/Space activation for free; nothing extra to build, just don't regress it with a non-button clickable `<div>`.
- Back navigation: HOME has no "back" (it's the root). GAME has `handleGoHome`. Pizza Select needs its **own** simple back handler (`setScreen("HOME")`, no confirm — nothing to lose there, same as leaving ORDER/RESULT today) — must not be wired to `handleGoHome`'s Mission-exit branch, which is irrelevant here since Pizza Select is only reachable while `mission.mode === "FREE"`.

---

## J. Regression test plan (focused, mapped to existing suites)

| # | Test | Where it lives today / where it should live |
|---|---|---|
| 1 | HOME「ピザを作る」→ Pizza Select (not GAME) | Rewrite of `App.test.tsx:46` ("navigates HOME -> FREE play on the primary CTA") |
| 2 | HOME「ランチラッシュ」→ Lunch Rush directly | Already covered, `App.test.tsx:57` — must still pass unchanged |
| 3 | GAME's ORDER action-row no longer offers a second Lunch Rush entry | New test in `App.test.tsx` or a `GameScreen`-focused test; assert absence of the "⏱ Lunch Rush" secondary button when reached via Pizza Select |
| 4 | Selecting an unlocked/NEW or completed card → FREE Making Game starts with that exact recipe | New `PizzaSelectScreen`/`App.test.tsx` test — assert `state.recipe.id` equals the clicked card's id post-selection |
| 5 | Locked card cannot start a round (disabled + reducer rejects a forced `SELECT_RECIPE` on an unavailable recipe) | New unit test on the `SELECT_RECIPE` reducer case (mirrors existing `PURCHASE_INGREDIENT`-rejection tests in `gameReducer.test.ts`) + a component test asserting the disabled button never calls `onSelectRecipe` |
| 6 | Selected `recipeId` reaches `GameScreen`/`PizzaStage` correctly (order/recipe/pizza all rebuilt fresh) | Extend `gameReducer.test.ts` the same way `PLAY_AGAIN`/`MISSION_RESET_ORDER` are already tested |
| 7 | NEW badge shows exactly when unlocked+undiscovered; COMPLETED shows stars/BEST when discovered | New test seeding `dex`/`ownedIngredientIds` fixtures against the section D selector |
| 8 | Completed card displays correct BEST/stars from Dex | Same as #7, assert exact numeric values |
| 9 | Back from Pizza Select returns to HOME | New `App.test.tsx` test, mirrors `App.test.tsx:92` ("navigates GAME -> HOME via the header button when nothing is in progress") |
| 10 | Existing Lunch Rush flow (`App.test.tsx:57`, `lunchRush.test.ts`, `missionScoring.test.ts`) | Must pass unchanged — no Mission code path touched by B/H |
| 11 | `persistence.test.ts` save-v1 round-trip | Must pass unchanged — no schema change (section E) |
| 12 | Existing scoring/making-flow suites (`gameReducer.test.ts`, `scoring.test.ts`, `onewayFlow.test.ts`, `GameScreen.*.test.tsx`) | Must pass unchanged — `SELECT_RECIPE` only reuses `buildOrderState`, touches no scoring/placement/bake code |

Additionally, `App.test.tsx:126` ("starts a fresh ORDER instead of reopening a finished round from HOME's CTA") and `App.test.tsx:150,170` (Pitz/Dex read from persisted state; HOME shown first after reload) will need their assertions re-pointed from "GAME" to "Pizza Select" as the immediate post-CTA screen, but their underlying guarantees (no stale RESULT resurfacing, correct persisted-value display) must still hold.

---

## K. Implementation slice sizing (PS1–PS4)

| Slice | Scope | Files touched | Risk | Claude Code estimate | Test scope |
|---|---|---|---|---|---|
| **PS1 — Navigation restructure** | Add `"PIZZA_SELECT"` to `Screen`; `handleStartFreePlay` → `setScreen("PIZZA_SELECT")`; render a placeholder/minimal Pizza Select screen with existing-recipe buttons wired to a new `SELECT_RECIPE` action; remove the secondary "⏱ Lunch Rush" button from GAME's ORDER action-row | `App.tsx`, `src/state/gameReducer.ts` (new action case), `src/data/orders.ts` (lookup helper), `src/screens/GameScreen.tsx` (remove one button), new minimal `src/screens/PizzaSelectScreen.tsx` | **Low** — reuses `buildOrderState`, no new data model, no CSS work required yet | 2–3h | J.1, J.2, J.3, J.9, J.10, J.11, J.12 |
| **PS2 — Functional Pizza Select** | Implement the section D selector (`pizzaSelect.ts` or inline), `RecipeSelectCard` with COMPLETED/NEW/LOCKED rendering, disabled-locked enforcement, wiring real `dex`/`ownedIngredientIds`/`RECIPES` data | `src/state/pizzaSelect.ts` (new pure selector), `src/screens/PizzaSelectScreen.tsx` (full card grid), possibly extract `starLabel` from `DexOverlay.tsx` into a shared util | **Low-Medium** — logic is a straightforward derivation of already-audited data (section D); main risk is getting the LOCKED double-guard (UI + reducer) right | 2–3h | J.4, J.5, J.6, J.7, J.8 |
| **PS3 — Visual reproduction** | Rustic wood/brick/parchment CSS for HOME + Pizza Select; add Mito/Blue to `HomeScreen`; responsive 1–2 column card layout at 390×844 (never 4-across) | `App.css` (`.home-*`, new `.pizza-select-*` rules), `HomeScreen.tsx` (add Mito/Blue imports+render) | **Medium** — pure CSS/visual, but "don't shrink a 4-column mockup unreadably" requires real layout iteration, not just a style pass; no logic risk | 2–3h (possibly 3–4h if iterating on card layout at 390px) | Visual/manual — no new automated coverage beyond J.9 (structure); I's a11y checks (aria-labels, touch targets, overflow-x) should be spot-checked here |
| **PS4 — Preview + iPhone Human Feel** | Deploy preview build, verify on real 390×844 viewport: card readability, tap targets, back navigation, select→Making handoff, no horizontal scroll, long-label (`クアトロ フォルマッジ`) wrapping | No code changes expected unless Human Feel surfaces a real defect | **Low** (verification only) — but any defect found here reopens PS2/PS3 scope | 1–2h verification + reactive fix time if needed | Manual device verification per `docs/PROJECT_HANDOFF.md`'s workflow; re-run J's automated suite after any reactive fix |

Each slice's 2–3h estimate matches `docs/PROJECT_HANDOFF.md`'s stated target ("Claude Code implementation slices should generally stay around 2–3 hours"). PS3 carries the most schedule risk of the four because "adapt a 4-column reference mockup to 390×844 without shrinking it unreadable" is inherently iterative, not a fixed scope.

---

## Blockers / open product questions (not audit gaps — decisions for the product owner)

1. **Locked-card honesty at launch.** Only `fugazza` (via `onion`, `totalStars >= 12`) has a real lock condition today. A faithful PS2 "2 completed/NEW + 2 locked" 4-card mockup cannot be reproduced with more than one truthfully-locked recipe without either (a) accepting a smaller "locked" count (0–1 cards) than the mockup shows, or (b) the product owner explicitly deciding some currently-unconditionally-available recipes (e.g. `funghi`, `fugazza`'s sibling recipes) should *newly* gain a lock condition — which would be new progression design, out of Issue #39's stated scope ("新recipe Referenceの捏造" / "Scoring 2.0 Authority変更" are out of scope, and a new unlock rule is adjacent to that same boundary). Recommend: PS2 renders exactly what `isRecipeAvailable` says today (6 unlocked, 1 locked), and the product owner separately decides whether more locked content is wanted before or after PS3.
2. **Where "Pizza Select" sits relative to the in-round secondary Lunch Rush button.** Removing that button (PS1) is explicitly required by `docs/PROJECT_HANDOFF.md`'s Navigation contract, but no test currently protects its absence — confirm the product owner agrees this button should be fully removed (not just de-prioritized) before PS1 lands, since it is currently the *only* way to reach Lunch Rush after already choosing a specific recipe in-round (a player who wants Lunch Rush after being on Pizza Select must now go back to HOME first — a one-tap-longer path this issue's own rationale explicitly accepts: "Lunch Rushは...FREEの下位モードとして扱わない").

Neither blocks PS0/PS1 architecturally — both are called out so PS2's exact card count/labels and PS1's button removal are implemented against an explicit decision rather than an audit guess.

---

## Verdict

**A. READY — SMALL NAVIGATION + PIZZA SELECT IMPLEMENTATION**

Every mechanism PS1–PS3 need (order/recipe/state rebuilding, Dex/BEST/stars derivation, availability/lock derivation, official character assets, real-DOM HOME patterns, save schema) already exists on current `main` and requires no data-model refactor, no save migration, and no progression/scoring changes — only a new screen value, one new reducer action that reuses the existing `buildOrderState` machinery, a new derived selector, and new presentational components/CSS.