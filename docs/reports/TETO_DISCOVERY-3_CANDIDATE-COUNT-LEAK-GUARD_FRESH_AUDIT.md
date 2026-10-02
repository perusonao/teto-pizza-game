# Discovery 3.0 — Candidate Count Leak Guard: Fresh Audit

- Type: AUDIT / DESIGN ONLY. No production code, tests, PR or Issue were changed or created.
- Base: `main` @ `544db65b73e85ae927820b41653cc670afdb1403` (fresh-fetched; `HEAD` == `origin/main` at audit time).
- Method: static read of the source (grep + file reads). No Vitest / E2E / build / screenshots were run, as instructed.
  Everything below is a code-reading result, not a rendered-DOM measurement (see "Limits").

## 0. Verdict

**B. 現在は漏れていないが latent surface がある。**

- The candidate count **is** held by one production value, `PizzaSelectView.prompt.count` (and the sibling `SHOP.count`).
- It is **produced but never consumed**: the only consumer (`PromptCard`) reads `prompt.kind` and nothing else. No test, analytics, log or dev tool reads it.
- Every other player-facing path (Dex, Hint sheet, HOME bubble, Trial Notebook, Pantry, Near/Far) derives only a **boolean / `> 1` threshold / `kind`** from the pool, never the number.
- So it is not A (no player-facing leak) and not C (the count authority *does* exist on the Pizza Select view-model path).

## 1. `PizzaSelectView.prompt`

| Aspect | Finding | Where |
|---|---|---|
| Type | `PizzaSelectPrompt = {kind:"FIRST_DISCOVERY"} \| {kind:"DISCOVERABLE"; count:number} \| {kind:"SHOP"; count:number} \| null` | `src/state/pizzaSelect.ts:183-188` |
| Producer | `buildPizzaSelectView` runs `countRecipeDiscoveryStates` and stores `counts.DISCOVERABLE` (and `counts.KNOWN_BUT_MISSING_MATERIAL`) into `count` | `src/state/pizzaSelect.ts:198-208` |
| Consumers | Only `PizzaSelectScreen` → `<PromptCard prompt={view.prompt}>`. `PromptCard` reads `prompt.kind` only (message + CTA choice). `prompt.count` / `.count` has **zero** readers in `src`, `e2e`, `scripts`, `tools` | `src/screens/PizzaSelectScreen.tsx:87-118, 203` |
| Render | Not rendered. Copy is fixed per `kind`; no `data-*`, `aria-*`, `key`, list length or style depends on it | same |
| Tests | `PizzaSelectScreen.test.tsx` / `pizzaSelect.test.ts` / `App.fullGameReset.test.tsx` / e2e assert the prompt's text and the button only. None asserts `count`, and none asserts its *absence* | grep |
| Analytics / dev-only | None. The only `console`/telemetry-like hits are unrelated files (`lunchRushScoring.ts`, `starterStock.ts`). The Inspector does not use `buildPizzaSelectView` | grep |

Why this is latent: the number sits one prop away from the JSX. A future "あと{count}種類" or `aria-label`/`data-count` is a one-line edit with no type or test guard stopping it. It also contradicts the module's own header comment ("Nothing about an undiscovered recipe … reaches this view model", `pizzaSelect.ts:155-160`) in spirit.

## 2. Where the DISCOVERABLE pool size exists (directly / indirectly)

| Surface | Holds the number? | What it holds instead | Player-visible variation by pool size |
|---|---|---|---|
| Pizza Select `prompt` | **Yes (`count`, unused)** | — | None; kind-only |
| `countRecipeDiscoveryStates` | Yes (pure util, returns all 4 counts) | — | Callers: `pizzaSelect.ts`, `App.tsx:1134` (immediately `> 0`-ed by `homeBubble`) |
| HOME bubble | Transient prop `discoverableCount` | `homeBubble.ts:10` tests `> 0` only | None (boolean) |
| Dex (`DexOverlay`) | Local `.filter(...).length > 1` | Boolean `aggregateUnknown` | **Binary 1 vs 2+** by design (D-2): pool 1 → per-slot 🎨 card with `No.NN` and a 「💡ヒントを見る」 CTA; pool ≥ 2 → one aggregated card, no number/slot/hint CTA. Pool 2,3,4,5 identical. `あと${total-discovered}種類` is the *global undiscovered total*, independent of the pool |
| Free Cooking Hint sheet | `discoverableHintCandidates(...).length` inside `selectHintTarget` / `resolveHintSession` | Result is `TARGET` (1) or `{kind:"OPEN_POOL"}` (2+); `HintEmpty` has `kind` only | **Binary 1 vs 2+**. OPEN_POOL copy/DOM is fixed (`EMPTY_COPY.OPEN_POOL`, `OPEN_POOL_ACTIONS`); header comment states "says nothing about how many" |
| OPEN_POOL pantry nav (IP-1) | No | Decided by `largeCatalogEligible`, step, `pantryWorthwhile` (an *owned-count* fact) — explicitly "never the hint view or the hidden pool" (`GameScreen.tsx:350-351`) | None |
| Trial Notebook | No | View has "no recipe, candidate, count, distance or 'was it right' field" (`TrialNotebookSheet.tsx:14-15`); fixed `NOTEBOOK_COPY`; `trialNotebook.ts` never reads recipes/pool | None |
| Pantry / search | No | Owned-ingredient counts only | None |
| Result Near/Far | No (production) | `resultNearMiss` returns a single neutral generic line for ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH. `legacyResultNearMiss` (reads the pool) has no production caller | None |
| Accessibility / `aria` / `data-*` / test ids | No | Hint sheet attrs: `data-hint-kind`, `data-open-pool-actions` (static), `data-hint-category` (fixed set). Dex: `data-dex-state`, `data-dex-aggregated` (static). Notebook: `data-trial-entry={entry.number}` (player's own attempt number) | None |
| Dev Inspector | **Yes, by purpose** (pool size per ladder step) | — | See §4 |

## 3. Player-facing DOM: can the pool size be inferred?

Checked specifically for "DOM node count, CTA count, hidden text, aria-label, prompt change with candidate count":

- **Pizza Select**: `prompt` DOM = 1 message + 1 CTA for any `count ≥ 1` (`DISCOVERABLE`), identical for 1…n. No dependency on `count`.
- **Dex**: nodes depend only on `length > 1`. For ≥ 2 the aggregated card is a single node with a fixed string (a test asserts it contains no digit, `production26` D-2), and the pool members' own slots render as plain `UNKNOWN` (so neither count nor which slots).
- **Hint sheet OPEN_POOL**: fixed 3 `<p>` + at most one pantry button, determined by screen state, not pool.
- **HOME**: one fixed bubble line.
- No direct phrasing ("候補が2件", "あと3種類", "2つの可能性") exists in any copy; the only `あと…種類` is the Dex global remaining total.
- No `aria-live`/`sr-only` text varies with pool size.

**Residual, by-design signals** (not count leaks): (a) the **1 vs 2+** threshold is observable in Dex and Hint sheet (pool 1 is a deliberate "sole target"); (b) at pool 1 the per-slot card reveals *which* slot (`No.NN`) — the accepted single-target behaviour, pre-dating this audit. Neither distinguishes 2 from 3, 4 or 5.

## 4. Dev-only Discovery Progression Inspector (kept separate from player-facing)

- Intentionally shows pool size / OPEN_POOL classification (`discoveryProgressionModel.ts`, `DiscoveryProgressionInspector.tsx`).
- Reachability: `main.tsx` mounts it only if `(import.meta.env.DEV || VITE_PREVIEW_MODE) && ?inspector=discovery`; both are statically replaced, so a production build drops the branch and the dynamic `./dev` chunk. Guards: `src/dev/inspectorAccess.test.tsx` (`<App />` never renders it; no production source outside `src/dev` + `main.tsx` references it) and `previewIsolation.gate.test.ts` (bundle-level).
- Read-only: reads no real save. It is the model's *own* counts, not `prompt.count`; it does not import `pizzaSelect`.
- Not a player-facing leak. Note: **Preview builds** do expose it by URL — acceptable by existing design, but anyone reviewing "player-facing" on a Preview deploy should not count it.

## 5. OPEN_POOL: pool = 2 / 3 / 4 / 5

By construction (§2/§3) every player-facing consumer collapses pool ≥ 2 to one value, so the output contract is the same for 2, 3, 4, 5:

| Pool | `selectHintTarget` | Hint sheet | Dex | Pizza Select | HOME |
|---|---|---|---|---|---|
| 2 | `OPEN_POOL` | OPEN_POOL copy | aggregated card | DISCOVERABLE prompt | same bubble |
| 3 / 4 / 5 | `OPEN_POOL` | same | same | same | same |

Test evidence on `main`: pool 2 is covered directly (`branchingPool.test.ts`, `discoveryHint.pool.test.ts`, `discoveryHint.pool.production26.test.tsx` D-2 digit check); a legacy 15-recipe save with "several" DISCOVERABLE is covered through the App (`App.dexHint.test.tsx`). I found **no test that explicitly renders pool = 3, 4, 5 and asserts DOM equality with pool = 2**, and none that asserts `prompt` has no `count`. The invariance for ≥ 3 therefore rests on the code shape, not on an executable guard.

## 6. Consistency with the Discovery "no-leak" contract

| Contract item | Status |
|---|---|
| candidate identity | OK (pool ≥ 2 hides identity; pool 1 = accepted sole-target) |
| candidate count | **No player-facing leak; latent holder = `prompt.count`** |
| exact distance / similarity | OK (`resultNearMiss` neutral; legacy path unreachable) |
| Near / Far | OK (single generic line) |
| correct ingredient count | OK (Notebook has no "was it right" field; Hint 5 / selectable views carry no remaining/availability count) |

## 7. Minimal hardening proposal (NOT implemented)

1. **Remove the unused field**: `PizzaSelectPrompt` → `{kind:"DISCOVERABLE"}` and `{kind:"SHOP"}` (drop `count` on both); `buildPizzaSelectView` uses `counts.X > 0`. Pure type/producer change; `PromptCard` and all existing assertions are unaffected (nothing reads `count`).
2. **One guard test** (pure, no render): for pool sizes 1…5 (using the existing `branchingFixture`/synthetic population), assert `Object.keys(view.prompt)` equals `["kind"]` and `view.prompt` is deep-equal for 2…5. Optionally add a DOM-equality test that renders Dex + Pizza Select + OPEN_POOL sheet at pool 2 vs 5 and asserts identical `innerHTML`/attribute sets.
3. *(Optional, only if the Owner wants it)* Replace the two ad-hoc `.length > 1` / `candidates.length` checks with a shared "pool is open" boolean helper, so no consumer can ever receive a number. Not required for safety today.

Out of scope and untouched: No.28, recipes, ladder, R6/IP-2.

## Limits

- Static analysis only; no rendered DOM was captured for pool 3-5.
- `aria`/`data-*` sweeps were by grep over the Hint sheet, Notebook, Dex and Pizza Select components, not an exhaustive tree walk of every screen.
