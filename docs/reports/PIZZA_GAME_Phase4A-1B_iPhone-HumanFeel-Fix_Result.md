# PIZZA_GAME Phase 4A-1B: iPhone Human Feel Fix + Preview Infra Result

## Summary

Physical iPhone verification of PR #26 (`codex/phase-4a-1b-physical-interaction`,
Phase 4A-1B: Cheese & Topping Physical Interaction) came back **FAIL**:
Mozzarella/Basil placement completed successfully, but the drag/drop
itself felt unresponsive — "反応が悪いのか、操作しづらい" ("feels unresponsive,
hard to operate"). This report covers (A) the pointer-gesture investigation
and fix on top of PR #26's HEAD, and (B) standing up a permanent preview
deployment target so future PR/branch iPhone verification no longer needs
an ad-hoc build.

- **Source PR:** #26
- **Source PR HEAD (baseline for this work):** `e02425b3855625d225339fcae0eaead5699ceff3`
- **Branch:** `claude/phase-4a-1b-human-feel-preview-1byr1k` (reset onto the
  PR #26 HEAD above, since Human Feel fixes apply directly to the
  Mozzarella/Basil interaction PR #26 introduced)
- **Fix commit:** `d141839` (pointer-gesture fix)
- **Preview infra commit:** `59e8477` (badge + save-namespace, both preview-only)
- **PR #26 itself was not merged, rebased, or otherwise touched.**

## A. Investigation

Read through `src/components/IngredientTray.tsx` (pointer handlers),
`src/logic/pieceDrag.ts` (drag-intent threshold + drop resolution), and
`src/App.css` (`.ingredient-chip`, `.pizza-dough--interactive`) against
every item on the checklist:

| Checklist item | Finding |
| --- | --- |
| Drag threshold too large | `PIECE_DRAG_THRESHOLD_PX = 6` + a touch-only angle gate (`dy < 0 && |dy| >= |dx| * 0.75`, i.e. must move upward within ~37° of vertical). Not egregious, but larger than it needed to be. |
| pointerdown → preview delay | `schedulePreview` throttles to one `requestAnimationFrame` per frame — not the bottleneck. The real gap is *no visual feedback at all* between `pointerdown` and the drag-intent threshold being crossed. |
| touch-action / scroll competition | `.ingredient-chip--physical { touch-action: pan-x; }` — deliberate, so the tray can still scroll horizontally when a physical chip is touched. Left unchanged (see below). |
| pointer capture timing | `setPointerCapture` is called synchronously inside `handlePointerDown`, before any early return — correct, no delay. |
| IngredientTray horizontal scroll competition | Same as touch-action above; the angle gate is what actually arbitrates it, not touch-action. Left unchanged. |
| card content blocking pointer target | No — the emoji/text spans have no `pointer-events` override and the `<button>` itself receives every pointer event via bubbling. |
| **iOS Safari-specific drag/selection behavior** | **Root cause.** `.pizza-dough--interactive` already sets `user-select: none`, `-webkit-user-select: none`, and `-webkit-touch-callout: none` (added for the sauce-dispense gesture, per the comment at `src/App.css:157-162`) — but `.ingredient-chip`, the actual drag *source*, had none of the three, and no `-webkit-tap-highlight-color` either. A touch-and-hold on a chip is exactly the gesture iOS Safari's native text-selection/callout recognizer watches for; without these properties it can intermittently contest the same touch the custom pointer handlers are trying to track, and the default gray tap-highlight flash reinforces a "the app is lagging" impression even when it doesn't. |
| pointermove coalescing | Not a factor — one `requestAnimationFrame`-throttled preview update per frame is already coalescing-friendly. |
| drop target determination | `resolvePieceDrop` (circular clamp + edge grace) is unchanged and correct; not implicated. |
| finger position vs. preview position offset | `preview.y = point.y - 30` (preview rendered 30px above the finger) is intentional — keeps the ingredient visible instead of hidden under the finger. Left unchanged; changing it was judged higher-risk than the actual root cause for no clear benefit. |

## A. Fix (minimal, on top of PR #26 HEAD)

**`src/App.css`** — `.ingredient-chip`:
- Added `-webkit-touch-callout: none`, `user-select: none` /
  `-webkit-user-select: none`, and `-webkit-tap-highlight-color: transparent`
  (matching what `.pizza-dough--interactive` already does), so iOS Safari's
  native callout/selection UI and tap-highlight flash can no longer contest
  a drag gesture starting on a chip.
- Added `.ingredient-chip--grabbing` (subtle `scale(1.08)` + shadow + border
  tint, `0.08s` transition) — explicitly permitted by the task brief for
  Mozzarella/Basil.

**`src/components/IngredientTray.tsx`**:
- Added a `grabbedId` state, set on `pointerdown` for a draggable ingredient
  (before the drag-intent threshold is crossed) and cleared inside the
  existing `clearSession()` — so it rides every existing abort path
  unchanged: outside drop, RESET abort (`resetToken`), `pointercancel`,
  `lostpointercapture`, `blur`, `visibilitychange`, and the multi-touch
  guard (`sessionRef.current` check in `handlePointerDown`) all still work
  exactly as before, since none of them were touched.
- This gives the finger **instant** visual confirmation that the touch
  registered, independent of whether/when drag-intent is confirmed — this
  is what the "触れて少し動かした瞬間に掴める" (grab immediately on the
  slightest touch+move) target was actually asking for, more than the
  threshold number itself.

**`src/logic/pieceDrag.ts`**:
- `PIECE_DRAG_THRESHOLD_PX`: `6` → `4`. The angle gate (unchanged) is what
  actually protects the tray's horizontal scroll from a false-positive
  grab — loosening *that* instead would have traded responsiveness for
  more accidental grabs during a scroll attempt, which the task explicitly
  said to avoid ("誤操作防止も維持する"). Shrinking only the distance keeps
  that protection intact.

**Deliberately left unchanged:** `touch-action: pan-x` on
`.ingredient-chip--physical` (still needed — cheese/topping trays can hold
4-6 chips at 390px width), the drop-target resolver, and the preview's
30px vertical offset.

## B. Preview environment

New repository: **`perusonao/teto-pizza-game-preview`**, published via
GitHub Pages at **https://perusonao.github.io/teto-pizza-game-preview/**.

- Rebuilt the deployment as a real `vite build --base=/teto-pizza-game-preview/`
  of this branch's HEAD, replacing a previous hand-stitched relative-path
  bundle from PR #26's raw HEAD. Verified every emitted asset URL in
  `site/index.html` is rooted at `/teto-pizza-game-preview/...`.
- Added `.github/workflows/deploy-from-source.yml`: a `workflow_dispatch`
  pipeline (inputs: `ref`, optional `pr_number`) that checks out
  `perusonao/teto-pizza-game` at any ref, builds it with the preview base
  path + env vars below, and pushes the result into `site/` — which the
  pre-existing `.github/workflows/pages.yml` (push-to-`main` trigger,
  `actions/deploy-pages`) then publishes automatically. No new secrets
  needed: the source repo is public (unauthenticated checkout), and the
  push back into the preview repo uses that run's own default
  `GITHUB_TOKEN`. This is the "指定PR/branchをpreview repoへdeploy" structure
  the task asked for — re-run it from the preview repo's Actions tab with a
  different `ref`/`pr_number` to preview anything else.
- `perusonao/teto-pizza-game`'s own production Pages, `main` branch, and
  Actions are untouched — the preview repo has zero connection to them.

**PREVIEW badge** (`src/components/PreviewBadge.tsx`, source repo,
preview-only): a small, low-contrast, `pointer-events: none` corner tag
reading `PREVIEW · PR#<n> · <short sha>`, rendered only when the build sets
`VITE_PREVIEW_MODE`. The production `vite build` never sets this env var —
confirmed the production `dist/` bundle has **zero** occurrences of the
string `"PREVIEW"` after building without it.

**localStorage namespace separation** (`src/state/persistence.ts`): the
preview site and `perusonao.github.io/teto-pizza-game/` (production) share
the same `perusonao.github.io` origin — only the path differs — and
`localStorage` is scoped by origin, not path, so without this a preview
session would silently read/write a reviewer's real production save.
`SAVE_STORAGE_KEY` now resolves to `"teto-pizza-preview-save-v1"` when
`VITE_PREVIEW_MODE` is set, `"teto-pizza-save-v1"` (unchanged) otherwise.
**`PersistentSaveV1`'s schema itself was not touched** — same shape, only
the storage key differs, so no migration is needed either direction.

## Verification

Run from `perusonao/teto-pizza-game` at commit `59e8477`:

| Check | Result |
| --- | --- |
| `tsc -b` | Pass |
| `oxlint` | Pass |
| `vitest run` | Pass — 28 files / 403 tests |
| `vite build` (production, no `VITE_PREVIEW_*`) | Pass; `dist/` bundle has 0 occurrences of `"PREVIEW"` / the preview save key |
| `vite build --base=/teto-pizza-game-preview/` (preview, `VITE_PREVIEW_MODE=1`) | Pass; emitted `index.html` asset URLs all rooted at `/teto-pizza-game-preview/`; bundle contains the preview save key and badge text |
| `git diff --check` | Pass (no trailing-whitespace/conflict-marker issues) |

Browser-level (390×844) drag/drop path, Mozzarella×3 + Basil×2 → BAKE →
RESULT, was **not** re-verified on physical iOS Safari as part of this
change — that is exactly what the Preview URL below is for. This report
does not claim physical-device confirmation of the Human Feel fix.

## Production impact

None. `perusonao/teto-pizza-game`'s `main` branch, its GitHub Pages
deployment, and its Actions were not touched by any commit in this report.
All source changes live on `claude/phase-4a-1b-human-feel-preview-1byr1k`
only; PR #26 was not merged, rebased, or force-pushed.

## Preview details

- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Source PR:** #26
- **Source SHA (branch HEAD this preview builds):** `59e8477`
- **Preview deploy commit:** `7a7d736` (`perusonao/teto-pizza-game-preview`, `main`)
- **Deploy status:** `perusonao/teto-pizza-game-preview` run
  [34966531880](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34966531880)
  (`Deploy Preview to GitHub Pages`) completed with `actions/deploy-pages@v4`
  reporting `success`, confirmed via the GitHub Actions API. This
  environment's outbound network policy blocks direct HTTP access to
  `*.github.io`, so the live page itself could not be curled/fetched from
  here as a second, independent check — the Actions API result above is
  the confirmation this report relies on.

## FINAL VERDICT

**READY FOR IPHONE RETEST**

The root cause identified (missing iOS Safari touch-callout/selection
suppression on the drag source, compounding a larger-than-necessary
threshold and a lack of instant touch feedback) is fixed and verified by
the full check suite above, and is now live on the Preview URL for
physical-device confirmation. Final sign-off still requires an actual
iPhone Safari retest of the 390×844 flow (HOME → GAME → Margherita →
Sauce → Mozzarella×3 → Basil×2 → BAKE → RESULT) against that URL — this
report only establishes that the identified cause is addressed and the
build is sound, not that the physical retest has already passed.
