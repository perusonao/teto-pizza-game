# Teto Pizza Game — Issue #47 Making UX Cleanup — Fresh Audit

**Type:** READ-ONLY audit. No production code was changed to produce this report.

**Audited main SHA:** `6e554918c42fc4d8ed267b715992e5ed5cf68e4f` (Merge PR #45: Sauce parity
and olive-oil visibility). Confirmed via `git fetch origin && git rev-parse origin/main`
immediately before this audit; the audit branch (`claude/teto-issue-47-ux-audit-gjc7oz`) was
created directly from this commit (`git log -1` on the branch matches it exactly, working tree
clean). This SHA is also the exact SHA already recorded as "current" in Issue #22 / Issue #33's
D0 audit at the time this session started.

Scope, per Issue #47: an 11-item real-device (iPhone, 390×844) Review Playthrough finding list
(A–K below), audited against current `main` — not against any prior report's claims. Where a
prior report and current code disagree, current code wins.

Verification method: direct source reading (`git grep`/`Read`) for every claim below, **plus
live verification** — `npm ci && npm run dev` on this exact SHA, driven with Playwright/Chromium
(`/opt/pw-browsers/chromium`) at 390×844 (and 360×800 for B), covering HOME, Pizza Select,
Margherita PREPARE, a non-Margherita (Marinara) PREPARE, a full round through BAKE→RESULT→
DISCOVERED→もう一度作る, and a reset-mid-gesture case. Every finding below marked "confirmed
live" was reproduced this way, not inferred from code alone.

---

## 1. Findings truth table

| # | Finding | Status | Classification |
|---|---|---|---|
| A | HOME message clipping | **Confirmed live + root-caused** | P1 |
| B | Lunch Rush button wrapping | **Confirmed live + root-caused** | P1 |
| C | Redundant FREE button in Making entry | **Confirmed live + root-caused** | P1 |
| D | RESULT「もう一度つくる」generates a new recipe, not a retry | **Confirmed by code (deterministic) + root-caused** | P1 |
| E | Next CTA position/size | **Partially implemented already; refinement, not a defect** | P2 |
| F | Reference missing for non-Margherita | **Confirmed: data does not exist (not a display bug)** | P1 (architecture decision needed) |
| G | Reference disappears after reset ("やり直す") | **NOT reproduced — confirmed correct in current code and live test** | Informational (root cause of misconception explained) |
| H | No persistent mini Reference during Making | **Confirmed: feature does not exist** | P1 (design proposal, no code yet) |
| I | Sauce repaint vs. one-way flow | **Confirmed already correct; needs a design decision, not a fix** | P2 |
| J | Cheese/Topping drag has no gameplay meaning beyond a single drop point; physical drag-and-drop is Margherita-only | **Confirmed live + root-caused** | P2 (overlaps Issue #37 M2) |
| K | Shop/Pizza Dex reachable from Making | **Confirmed live + root-caused** | P1 |

---

## 2. A — HOME message clipping (390×844)

**Root cause: a z-index tie, not an overflow/height bug.**

`src/screens/HomeScreen.tsx:71-79` renders, in this DOM order, inside `.home-hero`:

```
<div className="home-hero__oven-glow" />
<div className="home-hero__bubble">今日はどんなピザを作ろう？</div>
<div className="home-hero__cast">
  <img className="home-hero__sidekick home-hero__sidekick--mito" .../>
  <img className="home-hero__teto" .../>
  <img className="home-hero__sidekick home-hero__sidekick--blue" .../>
</div>
```

`src/App.css:1757` (`.home-hero__teto`) and `src/App.css:1785` (`.home-hero__bubble`) both set
**`z-index: 1`**. With equal `z-index`, CSS stacking falls back to DOM order — `.home-hero__cast`
(containing `.home-hero__teto`) comes *after* `.home-hero__bubble` in the markup, so Teto's
portrait photo paints **on top of** the speech bubble wherever they overlap.

The bubble's own box (`.home-hero__bubble`, `App.css:1770-1786`) is correctly sized for its full
2-line content at 390×844 (`padding: 9px 14px; line-height: 1.3; max-width: 80%`, no
`overflow`/`max-height`/line-clamp anywhere — confirmed no `line-clamp`/`text-overflow`/
`max-height` rule targets this class). Live measurement (`getClientRects()` on a `Range` over
the bubble's own text node): line 1 ("今日はどんなピザを作ろ") sits at `y≈116`, line 2 ("う？")
at `y≈132-147` — both *inside* the bubble's own border box (`y=107` to `y=157.5`). The text is
never actually clipped by its own container. It is **occluded**: Teto's 176×176px circular photo
(`.home-hero__teto`, `App.css:1749-1758`) sits directly under/behind where line 2 renders, and
because of the z-index tie above, the photo paints over it. Forcing the bubble's `z-index` to
`999` in a live DOM patch (verification only, not applied to source) makes the full 2-line text
render correctly with nothing else changed — confirming this exact mechanism and ruling out a
text-wrapping, height, or font-metrics cause.

Screenshots (this session, 390×844, unmodified code):
- Full bubble, real bug: line 2 ("う？") is entirely invisible, over-painted by Teto's portrait.
- Same DOM/CSS with only `z-index: 999` added to `.home-hero__bubble`: both lines render fully.

**Fix shape (not applied — audit only):** raise `.home-hero__bubble`'s `z-index` above
`.home-hero__cast`'s (e.g. `z-index: 2`), or move the bubble after `.home-hero__cast` in DOM
order with `z-index` unchanged. Either is a 1-line CSS/JSX change, no state/logic involved.
Confirm the bubble's tail (`::after`, `App.css:1788-1798`) still visually points at Teto's head
after the change.

**Exact files/lines:** `src/screens/HomeScreen.tsx:71-79`; `src/App.css:1749-1758`
(`.home-hero__teto`), `src/App.css:1770-1798` (`.home-hero__bubble` + `::after`).

---

## 3. B — Lunch Rush button wrapping

**Root cause: an unbalanced flex-grow ratio plus fixed horizontal padding, not a text-length problem per se.**

`src/screens/HomeScreen.tsx:81-92` (`.home-cta-row`):

```
<button className="cta-button cta-button--primary cta-button--home">🍕 ピザを作る</button>
<button className="cta-button cta-button--secondary cta-button--home-secondary">⏱️ ランチラッシュ</button>
```

`src/App.css:871-878` (`.cta-button`, shared base): `padding: 12px 20px` (40px fixed horizontal
padding eaten from *every* button regardless of width). `src/App.css:1806-1822`:
`.cta-button--home { flex: 1.3; }` / `.cta-button--home-secondary { flex: 1; font-size: 13px; }`
— the two buttons split the row's available width **1.3 : 1** (primary gets ~56.5%, secondary
~43.5%), even though "⏱️ ランチラッシュ" (7 characters + icon) is not meaningfully shorter than
"🍕 ピザを作る" (6 characters + icon).

**Confirmed live at both 390×844 and 360×800:**

| Viewport | Secondary button `clientWidth`/`scrollWidth`/height | Wraps? |
|---|---|---|
| 390×844 | 156px / 156px, height 50px | No (fits on one line) |
| 360×800 | 143px / 143px, height 60px (+10px vs. 390) | **Yes** — renders as "ランチラッシ" / "ュ" (one orphaned kana on its own line) |

Screenshot at 360×800 confirms the exact "unnatural" wrap the issue describes: a single
character (ュ) stranded on its own second line. 390×844 (the task's own stated baseline) does
**not** wrap in this session's Chromium/font stack, but the margin is thin (156px measured vs.
~150px needed before wrap) — any slightly wider system font, Dynamic Type bump, or a shorter
390-width device (the issue also asks to check 360×800) reproduces it, which is exactly what the
issue's real-device report describes.

**Fix shape (not applied):** either even the flex ratio (`flex: 1` on both, or a smaller gap
between them), reduce `.cta-button`'s base horizontal padding for the `--home-secondary`
variant, or shorten the label (e.g. drop "ラッシュ" is not an option — meaning is lost; better to
fix sizing than truncate Japanese copy). This is a CSS-only change, no component logic.

**Exact files/lines:** `src/App.css:871-878` (`.cta-button` base), `src/App.css:1806-1822`
(`.cta-button--home`/`--home-secondary`), `src/App.css:1800-1804` (`.home-cta-row`).

---

## 4. C — Redundant FREE-mode button inside the Making entry

**Root cause: a leftover ORDER-phase gate that predates Issue #39's explicit Pizza Select flow.**

Confirmed live: `HOME → 🍕ピザを作る → Pizza Select → (pick any recipe, e.g. マルゲリータ) →`
lands on a screen whose one button reads **"🍕 フリープレイ"** — literally "FREE PLAY" — which
must be tapped again before Making (PREPARE) actually begins.

`src/screens/GameScreen.tsx:273-279`:

```tsx
{state.phase === "ORDER" && (
  <div className="action-row">
    <button ... onClick={onBeginPrepare}>
      {mission.mode === "FREE" ? <>🍕 フリープレイ</> : "ピザを作る！"}
    </button>
  </div>
)}
```

`App.tsx:368-371`'s `handleSelectRecipe` (Pizza Select's card tap) dispatches `SELECT_RECIPE`
(`gameReducer.ts:447-462`), which — via `buildOrderState` (`gameReducer.ts:159-181`) — always
lands the round at **`phase: "ORDER"`**, never directly at `"PREPARE"`. `state.phase === "ORDER"`
is exactly the branch above, so every recipe selection from Pizza Select necessarily passes
through this screen before Making opens, and in FREE mode it is labeled with the same "フリー
プレイ" wording HOME's old pre-#39 direct-random-recipe flow used to justify (choosing a *mode*
before a recipe existed). Now that Pizza Select already made the recipe choice explicit, this
screen is a pure, unlabeled-as-such extra tap with a confusing repeated "FREE" label — the user's
"redundant FREE button" report matches this exactly.

Component/state/action trace, per the task's own request:
- **Component:** `GameScreen.tsx:273-279` (JSX), gated on `state.phase === "ORDER"`.
- **State:** `GameState.phase` (`gameReducer.ts:24,40-41`), set to `"ORDER"` by
  `buildOrderState` (`gameReducer.ts:159-181`), which every "start a round" action
  (`SELECT_RECIPE`, `PLAY_AGAIN`, `MISSION_NEXT_ORDER`, `MISSION_RESET_ORDER`,
  `createInitialGameState`) goes through.
- **Action:** `onBeginPrepare` (`GameScreen.tsx:118`) → `App.tsx:476`
  `dispatch({ type: "BEGIN_PREPARE" })` → `gameReducer.ts:234-235`
  `case "BEGIN_PREPARE": return { ...state, phase: "PREPARE", ... }`.

**Not a defect in Lunch Rush:** the same branch shows `"ピザを作る！"` (not "フリープレイ") when
`mission.mode !== "FREE"`, so Lunch Rush's own ORDER screen reads fine already — only FREE mode
after an explicit Pizza Select pick has the stale wording/redundant-feeling extra tap.

**Fix shape (not applied):** Issue #47's own target flow (`HOME → ピザを作る → Pizza Select →
Making`) implies ORDER's ORDER→PREPARE gate for FREE mode is no longer product-meaningful once
the recipe was already explicitly picked — either skip straight to `phase: "PREPARE"` from
`SELECT_RECIPE` (bypassing ORDER for FREE only, leaving Mission's ORDER screen — which still
serves a real "here's your next order" purpose — untouched), or keep the screen but change its
FREE-mode label to something that isn't a second "which mode" choice (e.g. the recipe name +
"作り始める"). The former is more in line with "Making中は制作に集中" and removes an extra tap;
the latter is smaller. Either is confined to `GameScreen.tsx`/`gameReducer.ts`'s `SELECT_RECIPE`
case — no Scoring/Save/Economy involvement.

---

## 5. D — RESULT retry generates a different recipe, not the same one

**Root cause: `PLAY_AGAIN` explicitly excludes the just-played recipe by design.**

`src/state/gameReducer.ts:436-445`:

```ts
case "PLAY_AGAIN":
  return nextOrderState(
    { dex: state.dex, ownedIngredientIds: state.ownedIngredientIds,
      pitzBalance: state.pitzBalance, lastClaimedMissionRunId: state.lastClaimedMissionRunId },
    { excludeRecipeId: state.recipe.id },
  );
```

`nextOrderState` (`gameReducer.ts:185-192`) calls `getNextOrder({ ...opts, excludeRecipeId: ... })`
(`src/data/orders.ts:96-108`), which calls `avoidRepeat(pool, excludeRecipeId)`
(`orders.ts:80-83`):

```ts
function avoidRepeat(pool: Order[], excludeRecipeId: string | undefined): Order[] {
  if (!excludeRecipeId) return pool;
  const withoutRepeat = pool.filter((o) => o.recipeId !== excludeRecipeId);
  ...
}
```

This is **deterministic, intentional, existing behavior** (a "don't repeat the recipe you just
made" variety rule), not a random edge case — confirmed by reading the code, no live test needed
to prove non-determinism since the filter unconditionally removes the current recipe from the
pool (falling back to allowing a repeat only if that would empty the pool entirely, e.g. only one
recipe is currently available at all).

Button/action trace: `GameScreen.tsx:389-391` (DISCOVERED phase, `もう一度作る` button) →
`onPlayAgain` (`App.tsx:487`) → `dispatch({ type: "PLAY_AGAIN" })` → the reducer case above.
Note the actual current label is **「もう一度作る」**, not 「もう一度つくる」 as Issue #47's text
quotes it — same button, the issue's phrasing is paraphrased, confirmed by reading
`GameScreen.tsx:389-391` directly.

There is currently **no second button** anywhere for "別のピザを作る" (make a different pizza) —
returning to Pizza Select today requires HOME → 🏠ホーム (with an `isRoundInProgress()`-gated
confirm dialog that, at DISCOVERED, is a no-op guard since DISCOVERED isn't "in progress" per
`App.tsx:333-338`) → 🍕ピザを作る → Pizza Select again. So today's single button conflates both
of Issue #47's target actions into one, and picks the wrong one for "retry" by design.

**Target contract gap, precisely stated:**
- Today: 1 button, "もう一度作る" → **always a different recipe** (`excludeRecipeId`).
- Target: 2 buttons — "もう一度つくる" → **same recipe** retry; "別のピザを作る" → Pizza Select.

**Fix shape (not applied):** add a new reducer action (e.g. `RETRY_SAME_RECIPE`) that rebuilds
order state the same way `SELECT_RECIPE` does — `findOrderForRecipe(state.recipe.id)` +
`buildOrderState(...)`, i.e. literally SELECT_RECIPE's own body reused with `state.recipe.id`
instead of an explicit id — and change `GameScreen.tsx`'s DISCOVERED block to render both
buttons (retry → new action; "別のピザを作る" → a new `onBackToPizzaSelect` callback that sets
`screen` back to `"PIZZA_SELECT"`, mirroring `handleBackFromPizzaSelect` in `App.tsx:377-379`).
No Scoring/Save/Economy/Dex changes — Dex registration already happened before DISCOVERED
(`REGISTER_TO_DEX`, `gameReducer.ts:415-434`), so retrying the same recipe again is exactly the
existing "play the same recipe twice" path (`SELECT_RECIPE` already supports replaying an
already-discovered recipe without issue).

---

## 6. E — Next CTA position/size (390×844)

**This is already substantially implemented; the remaining gap is refinement, not a missing feature.**

`src/screens/GameScreen.tsx:328-348`'s `.action-row.prepare-bake-bar` is `position: fixed` to the
*viewport* (`App.css:846-869`, "Human Feel Fix 3" — a prior round already moved this off
`margin-top: auto` specifically because that broke once PREPARE grew taller than 844px), with
`padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px))` — safe-area-bottom is already
honored.

**Live measurement, 390×844, Margherita PREPARE:**

| Element | Rect (`x, y, width, height`) | Notes |
|---|---|---|
| `.prepare-bake-bar` | `0, 776, 390, 68` | Full width, bottom-anchored |
| `.cta-button--bake` ("次へ →") | `110.9, 786, 181.2, 48` | Horizontal center ≈ 201 (screen center ≈ 195) |
| `.secondary-button` ("やり直す") | `16, 788, 84.9, 44` | Left edge, 16px margin |
| `.secondary-button` ("ヒント") | `302.1, 788, 71.9, 44` | Right edge, 16px margin |
| `.pizza-dough` | `45, 126, 300, 300` (bottom edge `y=426`) | 350px clear of the CTA bar |
| `.ingredient-panel` | `0, 477, 390, 300` | Sits entirely between dough and CTA bar |

**PizzaStage is not obstructed** (350px gap even at this viewport; `.ingredient-panel` already
reserves `padding-bottom: calc(84px + safe-area)`, `App.css:609-616`, specifically so the fixed
bar can never sit on top of the tray's last rows either).

Remaining gap vs. Issue #47's ask: the button is 48px tall (`.cta-button` base,
`App.css:871-878`) — meeting, not exceeding, common ~44-48px touch-target minimums — versus
HOME's own primary CTA, which is explicitly sized larger (`min-height: 54px`,
`.cta-button--home`, `App.css:1806-1811`). It also shares its row with two other pill-shaped
secondary buttons of similar height (44px) immediately to either side, which reduces its visual
dominance as *the* primary action even though it already uses a distinct orange gradient
(`.cta-button--bake`, `App.css:887-893`) versus their cream/outline style. Both are legitimate,
low-risk polish items (bump `.cta-button--bake`'s `min-height` to match HOME's 54px; nothing
about position or safe-area needs to change) — **not** a case for building a new bottom-fixed
pattern, since one already exists and already satisfies the "don't cover PizzaStage" constraint.

**Exact files/lines:** `src/App.css:846-869` (`.prepare-bake-bar`), `:871-878` (`.cta-button`),
`:887-893` (`.cta-button--bake`), `:899-908` (`.secondary-button`); `GameScreen.tsx:328-348`.

---

## 7. F — Reference missing for non-Margherita recipes

**This is confirmed to be missing data, not a display/rendering bug.**

`src/data/referencePizza.ts:160-164`:

```ts
export function getReferencePizza(recipeId: string): ReferencePizza | null {
  return recipeId === MARGHERITA_REFERENCE.recipeId ? MARGHERITA_REFERENCE : null;
}
```

There is exactly **one** hand-authored `ReferencePizza` value in the entire codebase
(`MARGHERITA_REFERENCE`, `referencePizza.ts:120-158`). `grep`-confirmed: no other
`ReferencePizza`-shaped constant exists anywhere in `src/`. For every one of the other 6 recipes
(marinara, quattro-formaggi, genovese, **bismarck**, funghi, fugazza), `getReferencePizza`
returns `null` by construction — there is no missing-file, missing-import, or conditional
rendering bug to fix; the target data was simply never authored past the original Phase 4A-1A
Margherita-only prototype scope (the file's own header comment says as much: "Prototype target
is Margherita's tomato sauce only").

**Confirmed live:** `App.tsx:404-405` derives `referencePizza`/`referenceModeEnabled` from this
same function; `GameScreen.tsx:246-252` renders `<ReferencePreview>` only when both are truthy.
Playing Marinara through Pizza Select → PREPARE, `document.querySelectorAll('.reference-preview__button')`
returns **0** elements — the 見本 button does not render at all, vs. **1** for Margherita in the
same session. No console error, no broken image, no empty modal — the trigger itself is absent,
exactly matching "reference data自体が存在しない", not "表示バグ".

### 7.1 Scoring 2.0 Shadow uses the *exact same* gate — the two "Reference" concepts are already one SSOT

`src/logic/scoringV2/index.ts:59-75` calls the same `getReferencePizza(recipe.id)` and, when it
is `null`, returns `available: false` with the message *"この料理はまだ Reference Pizza（お手本
データ）がありません。Phase 4A-2時点ではマルゲリータのみ対応しています。"* — Scoring 2.0 Shadow
is unavailable for the same 6 recipes, for the same reason, from the same data.

**This directly answers Issue #47's own question** ("Scoring2 Referenceとプレイヤー向けvisual
referenceを同一責務にすべきか"): **they already are the same responsibility** — one function,
one file, one data shape (`ReferencePizza` — `sauce` target + `pieceGroups`), consumed by both
`ReferencePreview.tsx` (player-facing) and `scoringV2/index.ts`/`piecesComponent.ts`/
`sauceComponent.ts` (Scoring 2.0 Shadow, still non-authoritative per the project's guard).
Expanding `referencePizza.ts` to cover more recipes unblocks *both* the visual Reference and
Scoring 2.0 Shadow simultaneously, with no architecture change needed to unify them — they were
built unified from the start. This does **not** touch Scoring 2.0 authority: `computeScoringV2Shadow`
remains Shadow-only, called from exactly one site (`gameReducer.ts` `CONFIRM_BAKE`), never fed
into `score`/Dex/Mission/Pitz (`scoringV2/types.ts`'s own documented boundary, unchanged by this
audit).

### 7.2 Can Reference be generated deterministically from the Recipe SSOT, or does it need hand-authored fixtures?

`src/data/recipes.ts`'s `Recipe.requiredIngredients` is `{ ingredientId, minCount }[]` only — no
spatial/layout information. Comparing what each half of `ReferencePizza` actually needs:

- **Sauce target (`ReferenceSauce.quantity`/`.coverage`):** `MARGHERITA_REFERENCE.sauce` is
  itself *already* generated, not hand-picked — `referencePizza.ts:93-114`'s
  `buildIdealMargheritaSauceFixture()` builds a generic "evenly spread concentric rings, rim
  left bare" deposit pattern and *derives* the quantity/coverage numbers from it
  (`computeSauceMetrics`, shared with real scoring). Nothing about this algorithm is
  Margherita-specific — it only needs a center point (fixed, every recipe's dough is centered
  the same way) and a sauce color (already resolvable from the recipe's own required sauce
  ingredient via the existing `findPrimarySauceId`-style lookup, `App.tsx:70-75`). **This half is
  a strong candidate for (B) deterministic generation for all 7 recipes** — "spread evenly,
  leave the rim" is a universal physical target, not a claim about a specific dish's appearance,
  so generating it does not fabricate a dish fact.
- **Piece placement (`ReferencePieceGroup.positions`):** Margherita's 3 mozzarella + 2 basil
  positions are hand-placed art-directed coordinates (`referencePizza.ts:127-157`) intended to
  look like a real Margherita. A recipe like Bismarck (egg cracked centrally) or Quattro
  Formaggi (four cheese quadrants) has a real, recognizable, recipe-specific arrangement that a
  generic "N points evenly distributed" algorithm would not reproduce faithfully — generating
  those *as if* they were researched real-world layouts would risk exactly the "don't fabricate"
  guard Issue #22/#47 both state. A **generic, explicitly-labeled "evenly distributed" placement
  guide** (not claimed as the real dish's look), generated purely from
  `requiredIngredients[].minCount` for each cheese/topping ingredient, is possible without
  fabrication — but a real-looking, recipe-faithful Reference for the other 6 recipes needs
  hand-authored fixtures, the same way Margherita's was made.

**Recommendation for Issue #47 §4's decision:** **C. Hybrid.** Generate the sauce-target half of
`ReferencePizza` for every recipe from the existing `buildIdealMargheritaSauceFixture`-style
algorithm (already recipe-agnostic in its math, only needs the recipe's sauce ingredient's
color/id), and hand-author the `pieceGroups` half per recipe the same deliberate way Margherita's
was, one recipe at a time — this unblocks Scoring 2.0 Shadow's sauce component immediately for
every recipe while keeping piece-placement fidelity a human decision, and never fabricates a
specific-dish claim the game doesn't actually have evidence for. This is real recipe-content work
(6 more hand-authored piece layouts), not a quick fix — see §12 slicing below for how to size it.

**Exact files:** `src/data/referencePizza.ts` (whole file); `src/logic/scoringV2/index.ts:29-30,59-75`;
`src/data/recipes.ts` (SSOT shape, unchanged).

---

## 8. G — Reference does not actually disappear after reset ("やり直す")

**Not reproduced. Confirmed correct in current code, and confirmed correct live.**

`RESET_PIZZA` (`gameReducer.ts:368-386`) only ever replaces `state.pizza` (via
`createEmptyPizza()`) plus `makingStep`/`makingStepToken`/`hint`/`placement`. It never touches
`state.recipe` or `state.order`. `App.tsx:404` computes `referencePizza = getReferencePizza(
state.recipe.id)` — since `state.recipe` is untouched by `RESET_PIZZA`, `referencePizza` and
`referenceModeEnabled` are provably identical before and after a reset, for any recipe. The
Reference popover's own open/closed state (`isReferencePopoverOpen`, `App.tsx:114`) is only ever
forced closed by the `lastOrderId !== state.order.id` effect (`App.tsx:136-147`, i.e. a genuinely
*new round* starting) — `handleResetPizza` (`GameScreen.tsx:146-149`) calls neither that effect
nor anything that closes the popover.

**Confirmed live** (Margherita PREPARE): opened the Reference popover, recorded its full text
content, closed it, painted some sauce, tapped 「やり直す」, then reopened Reference — the 見本
button was still present (count: 1, unchanged) and its panel's full text content was
**byte-identical** to before the reset.

**Likely source of the real-device impression**, stated for completeness rather than left
unexplained: (1) the popover is a modal the player must explicitly reopen — it was never a
persistent on-screen element, so closing it (which a player might do right before hitting やり
直す) can read as "it's gone" even though nothing was lost; and/or (2) if the real-device session
being reviewed was on a non-Margherita recipe, Finding F (§7) already means Reference was never
present to begin with, so "it disappeared after reset" and "it was never there" would look
identical to the player. **Finding H's persistent mini Reference (always visible, no
open/close cycle) directly removes this entire class of "did it just disappear?" ambiguity**,
independent of whichever of the two explanations above actually occurred on the reviewed device.

**Exact files/lines confirming this:** `gameReducer.ts:368-386` (`RESET_PIZZA`, no `recipe`/
`order` field in its return); `App.tsx:404-405` (`referencePizza`/`referenceModeEnabled`
derivation, keyed only on `state.recipe.id`/`isMissionActive`); `App.tsx:136-147` (the only
`setReferencePopoverOpen(false)` call site, keyed on `order.id` change, not `RESET_PIZZA`).

---

## 9. H — No persistent mini Reference during Making (design proposal)

**Confirmed as a genuine gap, not a bug:** today, checking the target while making requires
opening the full-screen `ReferencePreview` modal (§8), which also aborts any in-progress sauce
gesture by design (`ReferencePreview.tsx`'s own header comment; `App.tsx:109-114`) — there is no
always-visible small preview anywhere in `PREPARE`.

### Recommended design

Reuse, don't rebuild:

- **Placement:** inside the existing `.order-card` (`GameScreen.tsx:240-254`), which already sits
  directly above `<PizzaStage>` in the PREPARE layout and already conditionally renders
  `<ReferencePreview>`. Replace (or augment) the current text-only `見本` button
  (`ReferencePreview.tsx:34-41`) with a small persistent thumbnail using the reference
  component's *own existing* markup:
  - `.reference-mini-pizza` (`ReferencePreview.tsx:66-100`, already scaled/laid out for a
    compact circular preview) rendered permanently at a smaller size — a new CSS-only size
    variant (e.g. `--reference-piece-scale` tuned to ~0.2 instead of the popover's current 0.5,
    per the sizing convention already documented in
    `docs/reports/TETO_ISSUE-32_REFERENCE-VISUAL_Implementation-Result.md`), roughly 44-56px
    across — large enough to tap, small enough not to compete with the dough.
  - **`IngredientPieceVisual`** (`src/components/IngredientPieceVisual.tsx`) is already the
    shared cheese/emoji renderer used by both the popover and the player's own pizza — the mini
    thumbnail needs no new rendering logic, only a smaller CSS scale applied to the same markup.
  - **Reference SSOT reuse:** no new data — same `getReferencePizza(state.recipe.id)` result
    already flowing into `GameScreen.tsx:246-252` today.
- **Interaction:** tapping the thumbnail opens the *same* existing full popover
  (`isReferencePopoverOpen`/`onReferencePopoverChange`, already wired end-to-end including the
  dispense-abort behavior) — no new state needed, just a second trigger element bound to the
  same `onOpenChange(true)` handler `ReferencePreview.tsx:34-41` already exposes (or expose that
  handler one level up so both the mini-thumbnail and the existing text button share it).
- **390×844 fit / obstruction check:** `.order-card` sits above `PizzaStage`'s measured
  `y=126..426` box (§6) and above the `.prepare-bake-bar` CTA at `y=776..844` — a small
  thumbnail added to `.order-card`'s existing row does not need to move, shrink, or overlap
  either; it only needs a few more pixels of height in a card that already has slack (its
  current content is one line of hint text plus a compact button).
- **Scope boundary:** this is presentation-only (new CSS + a persistent trigger element wired to
  existing state) — no new Reference data, no Scoring 2.0 change, no Save/Economy involvement.
  It is **blocked by §7's Reference-per-recipe gap for 6 of 7 recipes** — a mini Reference for a
  recipe with no `ReferencePizza` at all still has nothing to preview, so H's UI work only pays
  off in full once F's data gap is closed (Margherita can ship the mini Reference immediately;
  the other 6 need §7's hybrid data work first, or must explicitly hide the thumbnail the same
  way the full popover already hides itself today).

---

## 10. I — Sauce repaint vs. one-way flow

**Confirmed already correct; this needs a product decision, not a code fix.**

Two separate questions, confirmed independently:

1. **Can the player add more sauce within the still-open SAUCE step?** Yes, already, and by
   design. `COMMIT_SAUCE_DISPENSE` (`gameReducer.ts:279-305`) only resets the deposit log
   (`sauceDeposits: []`) when `isFreshApplication` is true (switching to a *different*
   ingredient than what's already committed, `gameReducer.ts:290`) — repeating the *same*
   sauce ingredient within the same SAUCE step **appends** to the existing deposit log
   (`gameReducer.ts:299-302`: `[...(isFreshApplication ? [] : state.pizza.sauceDeposits), ...action.deposits]`).
   This already matches "repaint to add more coverage/quantity" exactly, for every sauce, since
   PR #45's parity fix made every spread ingredient use this same path (confirmed via
   `git diff` against the prior Issue #32 audit's SHA — `PizzaStage.tsx`'s
   `wantsDispenseSession = isPaintMode` no longer gates on matching the recipe's own profile).
2. **Can the player return to SAUCE after confirming past it?** No — confirmed both by reducer
   logic and by an exhaustive search. `CONFIRM_MAKING_STEP` (`gameReducer.ts:393-398`) calls
   `nextMakingStep` (`gameReducer.ts:35-38`), which clamps forward at the end of
   `MAKING_STEP_ORDER = ["SAUCE", "CHEESE", "TOPPING"]` and has no inverse. `grep -rn` across
   `src/` for any "previous step"/"go back"/"戻る" action or dispatch found **zero matches** —
   there is no code path, UI button, or reducer case anywhere that moves `makingStep` backward.
   The one-way flow guard the project's non-negotiables list is intact and reducer-enforced (not
   merely a UI convention a stray dispatch could bypass), consistent with the existing
   `onewayFlow.test.ts` suite already covering this.

**Recommendation (per the task's own instruction not to assume "重ね塗り禁止" by default):**
keep the current accumulate-while-in-step behavior as-is. It already gives repainting a natural,
non-exploitable consequence: painting well past the Reference's target coverage/quantity simply
moves the player's `SauceMetrics` further from `ReferenceSauce.quantity`/`.coverage`
(`referenceScoring.ts`'s similarity-based comparison, not a hard cap), so "too much" is already
naturally discouraged by the existing scoring shape without needing an arbitrary paint-count
limit or an explicit "no repainting" rule. No code change is required for I; this section exists
to document that the one-way/repaint boundary the issue asked to fresh-audit is already exactly
where it should be.

---

## 11. J — Cheese/Topping drag gesture contract

**Confirmed live and by code: three distinct gesture behaviors coexist, and the true "pick up
and carry" drag is gated to Margherita only — not available for 6 of 7 recipes' own
cheese/topping ingredients.**

This section reconfirms (current SHA `6e554918c`, diffed against the prior
`docs/reports/TETO_ISSUE-32_INTERACTION-CONSISTENCY_Fresh-Audit.md`'s audited SHA `6dced18c` —
`git diff` shows PR #45 touched only sauce dispense logic in `PizzaStage.tsx`, not the
topping-placement code below, so §3.2 of that report is still accurate; line numbers below are
this session's current ones) three gesture families:

1. **Tap-to-select then tap-on-dough:** commits one piece at the *tap start* point
   (`PizzaStage.tsx:569`: `onTap(g.startDough.x, g.startDough.y)`).
2. **Tap-to-select then drag-on-dough:** commits one piece at the *release* point only
   (`PizzaStage.tsx:575-586`, explicit comment: "Topping drag is out of scope for this phase:
   commit a single point at release ... no multi-drop from a drag"). No trail, no
   incremental placement — functionally a "reposition before release, single drop" gesture,
   not a real drag-and-drop.
3. **Tray physical drag-and-drop** (`IngredientTray.tsx`'s `DragSession`/`hasPieceDragIntent`
   system, `src/logic/pieceDrag.ts`): pick up a chip from the tray, carry it, drop it on the
   dough — the interaction Issue #37 actually describes ("トレイからingredientをつまむ→pizza
   上へdrag&drop"). **This is the only one of the three that behaves like a real physical
   carry-and-place gesture.**

**New finding this audit (not in the prior Issue #32 report):** gesture family 3 is gated
**doubly narrow**, both confirmed at `GameScreen.tsx:300-316`:

```tsx
physicalDragEnabled={referenceModeEnabled && !isReferencePopoverOpen && !isGlobalOverlayOpen}
draggableIngredientIds={["mozzarella", "basil"]}
```

- `physicalDragEnabled` is gated on `referenceModeEnabled` — which (§7) is `true` **only for
  Margherita**. For every other recipe, `physicalDragEnabled` is always `false`, so the tray's
  own real drag-and-drop system is entirely disabled — those recipes' cheese/topping
  interaction is *only* gesture families 1/2 above (tap-select then single-point placement).
- Even when enabled, `draggableIngredientIds` is a hardcoded 2-item allowlist
  (`mozzarella`/`basil`) — the exact two ingredients Margherita's own `ReferencePieceGroup`s
  happen to use (§7). No other cheese (gorgonzola, parmigiano, fontina, egg, cherry-tomato,
  mushroom, onion, ...) is ever draggable from the tray in any recipe, including Margherita's
  own recipe siblings that share those ingredients.

So today's real contract is not "3 gesture families with a minor nuance" (as the prior audit
characterized it) but **"gesture family 3 (real drag) exists for exactly 2 ingredients in
exactly 1 recipe; every other cheese/topping placement in the entire game, in every recipe, uses
only tap-start/drag-release single-point commit."**

**Does drag currently carry any skill/placement meaning beyond a single point?** No — confirmed
by reading `PLACE_TOPPING` (`gameReducer.ts:307-366`): it takes one `(x, y)` pair per dispatch,
regardless of which of the three gesture families produced it. A drag's only functional
difference from a tap is *which* single point gets committed (start vs. release) — there is no
path/trail/velocity data captured or scored anywhere for cheese/topping placement (unlike sauce,
where `sauceDeposits` genuinely accumulates a path).

**Recommendation, and overlap with Issue #37 M2:** Issue #37 §3 (CHEESE/TOPPING) explicitly
targets exactly this gesture (tray → drag → drop, position preserved, no auto-redistribution)
as its own scope, and Issue #37 M2's own checklist item is "cheese/topping の exact placement が
bake visual へ反映されることを監査" — i.e. M2 already owns extending and validating this same
system. **Do not duplicate here.** This audit's contribution is narrowing M2's starting point:
M2 should treat "drag-and-drop is currently Margherita/mozzarella/basil-only; extending
`draggableIngredientIds` to every cheese/topping ingredient (or deriving it generically from
`ingredient.category`) is M2's own first sub-step," rather than M2 needing its own fresh
discovery of this gap. Since a tap and a drag-release currently commit to the *same* single-point
model, a defensible simplification candidate — flagged per the issue's own instruction to
evaluate this — is: **if M2 does not plan to give drag itself additional placement/skill meaning
(e.g. a path-based distribution, matching sauce's own model), collapsing to tap-only placement
for the 6-recipe majority (where drag already behaves identically to tap except for which
point commits) would remove a gesture families the player can't currently tell apart by
result, without losing anything drag currently uniquely provides.** This is explicitly a
recommendation for M2 to weigh, not a change made here.

**Exact files/lines:** `PizzaStage.tsx:569,575-586` (tap/drag-release commit points);
`GameScreen.tsx:300-316` (`physicalDragEnabled`/`draggableIngredientIds`); `IngredientTray.tsx`
(`hasPieceDragIntent`, `DragSession`, `physicalDragEnabled` prop); `gameReducer.ts:307-366`
(`PLACE_TOPPING`, single-point, gesture-agnostic).

---

## 12. K — Shop / Pizza Dex reachable from Making

**Confirmed live and by code: both are one tap away throughout the entire Making flow.**

`GameScreen.tsx:180-195` renders `<header className="app-header">` **unconditionally** for the
whole `GameScreen` component — it is not gated on `state.phase`, so it renders identically during
ORDER, PREPARE, BAKE, RESULT, and DISCOVERED alike:

```tsx
<header className="app-header">
  <button onClick={onGoHome}>🏠 ホーム</button>
  <div className="app-header__actions">
    <span>Pitz残高 ...</span>
    <button onClick={onOpenShop}>🛒 Shop</button>
    <button onClick={onOpenDex}>📖 レシピ図鑑</button>
  </div>
</header>
```

**Confirmed live:** during Margherita's PREPARE (Making) phase, `.app-header__shop-button` and
`.app-header__dex-button` are both present (count 1 each) and clickable — tapping either opens
the respective overlay (`ShopOverlay`/`DexOverlay`, `App.tsx:501-518`) directly over PizzaStage/
the tray, mid-Making. `isGlobalOverlayOpen` (`App.tsx:468`,
`GameScreen.tsx:64,110`) already exists specifically to abort any in-progress gesture the moment
one of these opens — so opening them mid-gesture is a handled, non-corrupting case today, but the
navigation itself is still reachable, which is exactly what Issue #47 asks to remove.

**Trace:** `onOpenShop`/`onOpenDex` (`GameScreen.tsx:117-118` props) ← `App.tsx:474-475`
(`() => setDexOpen(true)`/`() => setShopOpen(true)`) — the *same* two handlers HOME's own menu
cards use (`HomeScreen.tsx:95-106`, `onOpenDex`/`onOpenShop` props). There is no
Making-vs-HOME distinction anywhere in the handler layer; `GameScreen`'s header simply also
wires them.

**Fix shape (not applied):** remove the `🛒 Shop`/`📖 レシピ図鑑` buttons from
`GameScreen.tsx`'s header (leaving `🏠 ホーム` — already the correct "leave Making, land on the
hub" affordance, with its existing `isRoundInProgress()`-gated confirm dialog,
`App.tsx:333-352`, unchanged) so Shop/Dex are reachable only from `HomeScreen.tsx`'s own menu,
matching "HOME is the hub" (Issue #22's own navigation contract). This is a JSX-only removal in
`GameScreen.tsx` — the `onOpenShop`/`onOpenDex` props can be dropped from `GameScreenProps`
entirely once nothing inside `GameScreen` calls them, and `App.tsx`'s own `isDexOpen`/`isShopOpen`
state/overlays are otherwise unaffected (HOME still needs and uses the same handlers).

**Exact files/lines:** `GameScreen.tsx:180-195` (header, unconditional), `:117-118`
(props); `App.tsx:474-475` (handlers), `:501-518` (overlay render sites).

---

## 13. Reference architecture truth (summary)

- **One SSOT for both consumers:** `getReferencePizza(recipeId)` (`referencePizza.ts:162-164`)
  is the single source both the player-facing `ReferencePreview` popover and Scoring 2.0 Shadow's
  `sauce`/`pieces` components read — already unified, not two systems needing merging (§7.1).
- **Coverage is 1 of 7 recipes** (Margherita only); every other recipe's gap is a missing
  `ReferencePieceGroup[]`/`ReferenceSauce` value, not a rendering, import, or gating bug (§7).
- **Reset never touches it** — `RESET_PIZZA` only replaces `pizza`, never `recipe`/`order`, so
  Reference (and Scoring 2.0 Shadow's own gating) is stable across a mid-round reset by
  construction (§8).
- **Sauce-target generation is already algorithmic**, not hand-picked, for the one recipe that
  has it — `buildIdealMargheritaSauceFixture` (§7.2) — making sauce-target expansion to all 7
  recipes the cheaper half of closing the gap; piece-placement fidelity is the part that
  legitimately needs hand authorship per recipe.
- **No mini/persistent Reference exists yet anywhere** — today's only Reference UI is the
  full-screen modal (§9), and it is fully blocked by the per-recipe data gap for 6 of 7 recipes.

## 14. Retry lifecycle truth (summary)

`SELECT_RECIPE` (initial pick) and `PLAY_AGAIN` (post-DISCOVERED retry) are structurally
identical (`buildOrderState`) except for **exactly one thing**: which order they pick —
`SELECT_RECIPE` takes an explicit `recipeId` and looks up `findOrderForRecipe(recipeId)`
(`orders.ts:57-63`); `PLAY_AGAIN` calls `nextOrderState` with `excludeRecipeId: state.recipe.id`,
which *removes* the just-played recipe from the random pool (`orders.ts:80-83`). There is no
randomness bug, no state leak, no Dex/order desync — the "always different recipe" behavior is
a single, explicit, named parameter doing exactly what it says. Implementing Issue #47's target
contract (same-recipe retry vs. explicit different-recipe choice) is additive: reuse
`SELECT_RECIPE`'s own body keyed to `state.recipe.id` for "retry," and route "別のピザを作る" to
the existing `PIZZA_SELECT` screen transition — no new order-generation logic needed either way.

## 15. Gesture truth (summary)

| Gesture | Where it exists | Result |
|---|---|---|
| Sauce tap | Every recipe, SAUCE step | One small "starter tick" dab (~2% dispense), same for all 3 sauces since PR #45 |
| Sauce drag/hold | Every recipe, SAUCE step | Time-based incremental ticks, heatmap-rendered, same for all 3 sauces |
| Cheese/Topping tap | Every recipe, CHEESE/TOPPING step | One piece, committed at tap point |
| Cheese/Topping drag-on-dough | Every recipe, CHEESE/TOPPING step | One piece, committed at *release* point only — functionally indistinguishable in outcome from tap except which point wins |
| Cheese/Topping tray-drag (pick up, carry, drop) | **Margherita only, mozzarella/basil only** | Same one-point commit as above, plus a carry animation — no additional placement fidelity is scored differently from the other two |

No gesture family currently gives cheese/topping placement a "skill" dimension beyond which
single point gets committed — collapsing to tap-first is a defensible simplification (§11),
pending Issue #37 M2's own decision on whether to give drag new meaning instead.

---

## 16. Priority classification

**P1 — fix before Issue #33 Dough Shaping** (small, self-contained, matches Issue #47's own P1
acceptance criteria almost 1:1):

- A (HOME bubble z-index)
- B (Lunch Rush button flex ratio)
- C (redundant FREE button / ORDER-phase gate for FREE mode)
- D (retry excludes current recipe — needs a new same-recipe action + a second button)
- K (Shop/Dex reachable from Making — remove 2 header buttons)
- F (Reference data gap) — P1 as an **architecture/content decision**, not a quick code fix; see
  §17 slicing. Margherita's own mini Reference (H) can ship without waiting on F's expansion.
- H (mini Reference) — P1 per Issue #47's acceptance criteria, buildable immediately for
  Margherita; full value depends on F's expansion for the other 6 recipes.

**P2 — polish / explicitly deferred to Issue #37 M2 or left as-is:**

- E (Next CTA size bump, 48px → 54px for visual parity with HOME's CTA — already correctly
  positioned/safe-area-aware)
- G — no code change; already correct (documented so it is not re-investigated later)
- I — no code change; already correct (documented so a false "禁止" rule is not added later)
- J — defer the drag-scope decision to Issue #37 M2, which already owns this exact system

---

## 17. Implementation slices (2 or 3, per Issue #47's own instruction not to force 11 items into 1 PR)

Grouped by dependency and risk, each sized for a single ~2-3 hour Claude Code session, per
Issue #22's own workflow convention.

### Slice A — Navigation / Retry / HOME polish (lowest risk, no new data, no new components)

- A: `.home-hero__bubble` z-index fix (`App.css`).
- B: `.home-cta-row` flex-ratio/padding fix (`App.css`).
- C: FREE-mode ORDER→PREPARE gate change or relabel (`GameScreen.tsx`, possibly
  `gameReducer.ts`'s `SELECT_RECIPE` if the flow itself changes rather than just the label).
- D: new `RETRY_SAME_RECIPE` reducer action + DISCOVERED-phase two-button UI + a
  "back to Pizza Select" callback (`gameReducer.ts`, `GameScreen.tsx`, `App.tsx`).
- K: remove Shop/Dex buttons from `GameScreen.tsx`'s header.
- E: `.cta-button--bake` `min-height` bump (bundle here since it's a 1-line CSS change touching
  the same header/action-row area).

No Reference/Scoring/gesture code touched. Regression surface: `App.test.tsx`,
`App.humanFeelFix3.test.tsx`, `gameReducer.test.ts`, `GameScreen.*.test.tsx` (existing suites
already exercise ORDER/DISCOVERED/PLAY_AGAIN transitions and would need updates for D and C's
new shapes).

### Slice B — Reference UX (Margherita-first, unblocks incrementally)

- H: persistent mini Reference thumbnail in `.order-card`, wired to the existing
  `isReferencePopoverOpen` state (`GameScreen.tsx`, `ReferencePreview.tsx`, `App.css`).
- F (phase 1 of the hybrid, §7.2): generalize `buildIdealMargheritaSauceFixture`-style sauce
  target generation to every recipe's own required sauce ingredient (`referencePizza.ts`), so
  Scoring 2.0 Shadow's sauce component and a sauce-only mini Reference become available for all
  7 recipes immediately.
- F (phase 2, larger, likely its own follow-up slice rather than part of this one): hand-author
  `ReferencePieceGroup[]` layouts for the remaining 6 recipes, one at a time, each reviewed for
  "does this look like the real dish" the way Margherita's was — this is recipe-content work,
  not a mechanical change, and should not be compressed into the same 2-3 hour slice as phase 1.

This slice is the one most likely to need splitting further once phase 2's per-recipe content
work is scoped in detail — flagged here rather than pre-committed to a fixed count.

### Slice C — Making controls (defer most of it to Issue #37 M2)

- I: no code change — document the "no regression" finding so a future session doesn't
  re-introduce a "no repaint" rule by mistake.
- J: hand this audit's §11 findings (drag scope, `draggableIngredientIds` narrowness, the
  tap-vs-drag-release equivalence) to Issue #37 M2 rather than implementing here — M2 already
  owns "cheese/topping の exact placement" end to end, and any change here would need to be
  redone or reconciled against M2's own design work regardless.

**Recommended order:** Slice A first (independent, no data dependencies, closes the most
Issue #47 P1 boxes fastest), then Slice B phase 1 (sauce-target generalization) as its own short
follow-up, then Slice B phase 2 (per-recipe piece layouts) as recipe-content work sized on its
own, with Slice C's J item routed into Issue #37 M2 rather than scheduled as separate Issue #47
work.

---

## 18. Tests plan (not added this session — audit-only, per task instruction)

Minimum regression coverage the eventual implementation slices should add, one item per line per
the task's own list:

1. **390 HOME content** — a DOM/layout assertion that `.home-hero__bubble`'s full text content is
   not visually occluded (e.g. assert `.home-hero__bubble`'s effective `z-index` is greater than
   `.home-hero__teto`'s, or a rendered-order assertion) — a pure numeric `getComputedStyle`
   z-index comparison test, no visual-regression harness needed.
2. **CTA labels** — a test asserting `.cta-button--home-secondary`'s rendered width/label does
   not require wrapping at both 390 and 360 logical width (jsdom can't lay out text metrics
   reliably; this is better covered by a Playwright/real-browser smoke check at both widths than
   a unit test, per this repo's existing lack of a pixel-diff harness).
3. **Same-recipe retry** — `gameReducer.test.ts`: dispatch the new retry action from a
   DISCOVERED state and assert `state.recipe.id` is unchanged.
4. **Recipe preserved** — same test, additionally asserting `state.order.recipeId` matches and a
   fresh empty `pizza`/`makingStep: "SAUCE"` (mirrors `buildOrderState`'s existing contract).
5. **Reset preserves reference** — a `GameScreen`/`App`-level test: dispatch `RESET_PIZZA` and
   assert `getReferencePizza(state.recipe.id)` (or the rendered `.reference-preview__button`
   count) is unchanged before/after — codifying §8's "not a bug" finding so it can't regress
   silently later.
6. **Reference per recipe** — once §7's data expands, a `referencePizza.test.ts` case per newly
   covered recipe (matching the existing Margherita reachability test's shape: fixture → target
   → high shadow-similarity).
7. **Mini reference** — a `ReferencePreview`/`GameScreen` test asserting the persistent thumbnail
   renders during PREPARE without requiring `isOpen`, and that tapping it sets
   `isReferencePopoverOpen` true via the same existing callback.
8. **Navigation absence** — a `GameScreen` test asserting no `.app-header__shop-button`/
   `.app-header__dex-button` render, for every `state.phase`, once K's fix lands.
9. **Next CTA** — a snapshot/computed-style assertion pinning `.cta-button--bake`'s `min-height`
   and the `.prepare-bake-bar`'s `position: fixed`/safe-area padding, so a future refactor can't
   silently regress back to the pre-Human-Feel-Fix-3 `margin-top: auto` behavior.
10. **Sauce one-way** — already covered by the existing `onewayFlow.test.ts` (56 cases); no new
    test needed unless C's flow change (Slice A) touches `makingStep` semantics, in which case
    extend that suite rather than writing a new one.
11. **Cheese/topping gesture contract** — a `PizzaStage` test pinning "tap commits at start
    point, drag commits at release point, both single-drop" as an intentional contract (flagged
    as a gap in the prior Issue #32 audit too, still open) — write this *before* Issue #37 M2
    changes `draggableIngredientIds`, so M2 has a regression guard for today's baseline instead
    of discovering the contract by trial and error.

---

## 19. Review Playthrough scenario (for the eventual implementation PR, not this audit)

390×844, real device, once Slice A + Slice B phase 1 land (Slice B phase 2/Slice C are separate
gates):

1. HOME: confirm the hero bubble's full 2-line text is visible, not occluded by Teto's photo.
2. HOME: confirm 「⏱️ ランチラッシュ」 does not wrap at 390 width (and, if a 360-width device is
   available, that it no longer wraps there either).
3. HOME → 🍕ピザを作る → Pizza Select → pick a non-Margherita recipe (e.g. ビスマルク) → confirm
   Making opens directly (no intermediate "フリープレイ" tap) or, if C's fix instead relabels
   rather than removes the screen, confirm the label no longer reads as a second mode choice.
4. During Making: confirm the mini Reference thumbnail is visible without tapping anything, and
   tapping it opens the existing full popover with matching content.
5. Confirm no Shop/Dex button is reachable anywhere during Making (ORDER/PREPARE/BAKE/RESULT/
   DISCOVERED) — only 🏠ホーム.
6. Complete a round through BAKE → RESULT → register to Dex → DISCOVERED. Confirm two buttons:
   もう一度つくる (same recipe, verify the recipe name shown matches) and 別のピザを作る (lands
   back on Pizza Select).
7. From もう一度つくる, confirm the mini Reference for that same recipe is still present and
   unchanged.
8. In PREPARE, tap 「やり直す」 mid-sauce-paint; confirm the pizza clears but the mini/full
   Reference is unaffected (regression check against §8's finding).
9. Confirm the 「次へ」 CTA remains comfortably thumb-reachable at its (now slightly taller) size
   and never visually overlaps PizzaStage or the ingredient tray.

---

## 20. Risks

- **F/H are the only items with real scope risk.** Slice A and Slice C carry essentially no risk
  (small, mechanical, well-isolated changes with existing test suites nearby). Slice B phase 2
  (hand-authoring 6 more `ReferencePieceGroup` layouts) is genuine recipe-content work whose size
  depends on how much art-direction scrutiny each layout gets — it should not be time-boxed to
  the same 2-3 hour slice as phase 1's mechanical sauce-generation change.
- **D's new UI (two DISCOVERED buttons) changes an existing, tested flow** —
  `App.test.tsx`/`App.humanFeelFix3.test.tsx` likely assert today's single-button DISCOVERED
  shape and will need updates alongside the implementation, not after.
- **C's fix shape needs an explicit product decision before implementation**, not just a code
  change: skipping ORDER entirely for FREE-mode `SELECT_RECIPE` is a slightly bigger behavioral
  change (removes a whole phase transition for FREE) than relabeling the existing screen. Both
  satisfy Issue #47's literal acceptance criterion ("no duplicated FREE-mode button"); the
  smaller relabel option is lower-risk if there's any hidden dependency on ORDER phase existing
  for FREE mode that this audit didn't surface (none found in `grep -rn "phase === \"ORDER\""`
  handling elsewhere, but flagging the smaller option as the safer default regardless).
- **J is intentionally not resolved here** — implementing a drag-scope change before Issue #37
  M2's own design pass risks exactly the "二重実装" (double implementation) Issue #47 itself
  warns against; this audit hands M2 a narrower, more precise starting point instead.
- **Scope guard compliance:** nothing in this audit's findings or recommended fixes touches
  Save schema, Economy, Pitz, Scoring 2.0 authority/coefficients, Dough (Issue #33), or Bake
  scoring — confirmed by file-level review of every recommended change above (all are in
  `HomeScreen.tsx`/`GameScreen.tsx`/`App.tsx`/`App.css`/`gameReducer.ts`'s navigation-only cases/
  `referencePizza.ts`/`ReferencePreview.tsx`).

---

## Final Verdict

**B. READY — 3 IMPLEMENTATION SLICES**

Slice A (Navigation/Retry/HOME, lowest risk, closes A/B/C/D/E/K), Slice B (Reference UX, split
into a fast phase 1 sauce-target generalization and a separately-scoped phase 2 per-recipe piece
layout content pass, closes F/H), and Slice C (Making controls — mostly a "confirmed correct,
hand off to Issue #37 M2" outcome for I/J rather than new implementation). All three fit
Issue #22's 2-3 hour Claude Code sizing convention individually; forcing Reference's two very
different halves (mechanical generation vs. hand-authored content) into one slice, or forcing
J's design decision to be made here instead of inside Issue #37 M2 (which already owns this
system), is what would push this to a 4th slice or a scope-blocker verdict — neither is
necessary given how cleanly this audit was able to separate them.

- **Audited SHA:** `6e554918c42fc4d8ed267b715992e5ed5cf68e4f`
- **Verdict:** B. READY — 3 IMPLEMENTATION SLICES
- **11 findings truth:** see §1 table; 7 are confirmed live+root-caused code defects (A, B, C, D,
  F, K, plus H as a confirmed gap), 2 are confirmed-correct-already (G, I) documented so they
  aren't "fixed" again into a regression or a new arbitrary rule, 1 is already-implemented with a
  refinement opportunity (E), 1 is a design/architecture question this audit answers with data
  (F/H's Reference strategy) plus one item (J) explicitly routed to Issue #37 M2 to avoid
  duplicate work.
- **Reference cause:** `getReferencePizza` has exactly one hand-authored fixture
  (Margherita); Scoring 2.0 Shadow and the player-facing popover already share this one SSOT.
  Sauce-target half is mechanically generatable for all 7 recipes today; piece-placement half
  needs hand authorship per recipe, same as Margherita's was made.
- **Retry cause:** `PLAY_AGAIN` explicitly calls `excludeRecipeId: state.recipe.id` — by design,
  not a bug — and needs a new sibling action (reusing `SELECT_RECIPE`'s own shape) plus a second
  UI button to satisfy Issue #47's same-recipe-retry vs. different-recipe target contract.
- **Gesture conclusion:** cheese/topping placement is single-point-commit everywhere today
  regardless of gesture; real tray drag-and-drop exists only for Margherita's mozzarella/basil.
  No gesture currently encodes placement skill beyond which one point commits — routed to
  Issue #37 M2 rather than decided here.
- **Implementation slices:** Slice A (Navigation/Retry/HOME: A, B, C, D, E, K), Slice B
  (Reference UX: H, F phase 1 + separately-scoped F phase 2), Slice C (Making controls: I
  documented as no-op, J handed to Issue #37 M2).
- **First slice:** Slice A — Navigation/Retry/HOME polish.
- **Report:** `docs/reports/TETO_ISSUE-47_MAKING-UX_Fresh-Audit.md` (this file).
- **PR:** opened against `main` from `claude/teto-issue-47-ux-audit-gjc7oz`, docs-only, no
  production code changed.
