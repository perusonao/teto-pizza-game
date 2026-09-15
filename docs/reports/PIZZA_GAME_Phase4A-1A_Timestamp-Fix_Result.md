# Phase 4A-1A: Timestamp-Preservation Fix Result

Fixes the sole residual P2 from Codex's Post-Fix Independent Re-Review of PR #21
("coalesced pointer sample timestamp preservation"): previous P1 2/2 fixed, previous P2
7/8 fixed with this being the 1 remaining; new findings on the re-review were P0=0/P1=0/
P2=0/P3=0. Same branch (`claude/phase-4a-1a-sauce-quantity-f8kcus`), same PR #21 -- no new
PR, no merge to `main`.

## 0. Verification of starting state

`git fetch origin claude/phase-4a-1a-sauce-quantity-f8kcus` confirmed the branch's actual
HEAD was `2b7b09c0f9c1c6a5ec40e54e30a2e1a671bd47d5`, matching the task's "Expected HEAD"
exactly, before any change in this session.

## 1. Root cause

`SauceDispenseController` (from the prior Post-Codex-Fix round) already interpolates each
due tick's position correctly *given a timestamped path* -- that part of MUST FIX 4 was
sound. The bug was one level up, in `PizzaStage.tsx`'s `handlePointerMove`/`processMovePoint`:
every sample -- including every individual entry inside a `getCoalescedEvents()` batch --
was handed to `controller.move()` with a *freshly read* `performance.now()`, discarding that
sample's own `event.timeStamp` entirely:

```ts
// pre-fix (removed by this change)
dispenseControllerRef.current?.move(dough, performance.now());
```

On a normal frame this is nearly harmless (successive calls are a fraction of a millisecond
apart). On a slow/coalesced frame -- exactly the case `getCoalescedEvents()` exists for --
several samples spanning tens of milliseconds of real finger movement get processed in one
synchronous JS turn, where `performance.now()` barely advances (and can be coarsened to
whole milliseconds or worse by browser timing-resolution protections). The recorded path
ends up with several entries sharing the same, or nearly the same, timestamp.
`SauceDispenseController.interpolate()`'s "past every recorded sample" fallback branch then
resolves any due tick later than that collapsed instant to the *last* sample in the batch --
silently discarding every other sample's position. Quantity (a pure function of elapsed
time) was never affected; coverage/evenness/the heatmap (which depend on *where* each tick
landed) could be.

## 2. Timestamp preservation method

`PizzaStage.tsx`:
- `handlePointerMove` now extracts each delivered sample's own `timeStamp` (the main
  event's, or each coalesced entry's) alongside its `clientX`/`clientY`, and passes it
  through to `processMovePoint`.
- `processMovePoint` normalizes that raw timestamp (see section 3) and passes the result to
  `dispenseControllerRef.current.move(dough, normalizedTimestamp)` -- never a fresh
  `performance.now()` call per sample.
- Coalesced-event handling is otherwise unchanged: when `getCoalescedEvents()` returns
  entries, they fully *replace* the single main-event entry (never concatenated), which was
  already correct pre-fix and avoids double-registering the same instant twice (per spec,
  the dispatched event's own sample is the last entry in that list).

## 3. Clock-domain normalization method

New `src/logic/pointerTimestampNormalizer.ts`, `PointerTimestampNormalizer`:

- **One instance per dispense gesture**, constructed once at `pointerdown`
  (`new PointerTimestampNormalizer(event.nativeEvent.timeStamp, performance.now())`, both
  sampled at that same instant) and discarded when the session ends (`endDispenseSession`
  now clears `timestampNormalizerRef.current = null`) -- never rebuilt per sample.
- **Offset computed once.** `offset = performanceNowAtStart - gestureStartEventTimestamp`.
  Every later sample normalizes as `rawEventTimestamp + offset`, moving `event.timeStamp`
  values into the same domain `performance.now()`/`requestAnimationFrame` already use
  (`controller.start()`/`.step()`), rather than trusting the two share an origin on every
  engine without checking.
- **Safety guarantees, enforced on every call, not assumed:** `isSafeTimestamp` requires
  finite and non-negative; `normalize()` additionally requires the normalized result be
  strictly greater than the previous call's result (monotonic/ordering-preserving). Any
  failure -- the gesture-start timestamp itself was unsafe, a sample's raw timestamp is
  `NaN`/`Infinity`/negative, or a normalized value would go backwards -- falls back to
  `lastNormalized + TIMESTAMP_FALLBACK_EPSILON_MS` (0.001ms), a monotonic nudge forward from
  the last known-good value. This is a *per-sample* fallback, never a blanket
  per-gesture "give up and re-stamp with `performance.now()`" (which would just
  reintroduce the exact bug being fixed) -- one bad sample doesn't poison the rest of the
  gesture, and a later good sample immediately resumes trusting real timestamps.
- **`controller.start()` itself is untouched by the normalizer** -- it still receives a
  single `performance.now()` sample taken at pointerdown directly (shared with the
  normalizer's own construction so both agree on "now" at the same instant), matching the
  finding's note that only pointermove-sourced samples were ever the problem.

## 4. Coalesced event handling

- **Zero samples** (`getCoalescedEvents` absent/throws/empty): falls back to the single main
  `PointerEvent`, exactly as before -- `try`/`catch` around the call is unchanged.
- **One sample**: identical to the zero-coalesced case in practice (the single entry is
  processed once).
- **Multiple samples**: each is normalized and delivered to the controller in the exact
  order the platform reported them (`for (const point of events)`, unchanged iteration
  order), so `A.timeStamp < B.timeStamp < C.timeStamp` in the raw stream produces
  `normalize(A) < normalize(B) < normalize(C)` -- pinned directly in
  `pointerTimestampNormalizer.test.ts`.
- **No double-registration**: unchanged from pre-fix -- when coalesced entries exist, they
  *replace* the single-event array rather than being concatenated with it, so the main
  event's own sample (already the last coalesced entry per spec) is never processed twice.

## 5. Focused RED/GREEN

The buggy call site (`performance.now()` per sample) no longer exists in the tree -- this
fix replaced it outright, so "run the new tests against the literal old code" isn't
possible without reverting. Two forms of RED/GREEN were used instead:

1. **New-module RED/GREEN during development**: `pointerSamplingFidelity.test.ts`'s
   integration tests initially failed twice against off-by-one assumptions in the test
   itself (expected tick counts computed from a misread of `computeDueTicks`'s
   already-consumed-first-tick semantics, and a harness bug that routed
   `controller.start()`'s timestamp through the same normalizer as pointermove samples,
   an unrealistic double-use no real gesture produces) -- both corrected, then GREEN.
2. **Literal bug reproduction, not just assertion**: rather than only asserting the fixed
   code's properties in isolation, `pointerTimestampNormalizer.test.ts`'s and
   `pointerSamplingFidelity.test.ts`'s "regression demonstration" suites reproduce the
   *actual pre-fix pattern* locally (a function that, like the old code, ignores its input
   and returns a frozen/fresh "now") and show it side by side with the fix on the identical
   input:
   - `preFixReStampEverySample` collapses 4 well-separated raw timestamps to 1 distinct
     value; the fix preserves all 4, correctly spaced.
   - `collapsedSampleTimestamp` (feeding a realistic 300ms/31-sample drag through
     `SauceDispenseController` exactly as PizzaStage would) collapses 3 of 5 dispense ticks
     onto the same last-recorded position and measurably narrows `computeSauceMetrics`
     coverage versus the fixed reconstruction of the identical physical path -- this is the
     finding itself, reproduced and pinned, not inferred.

## 6. Full tests

- `pointerTimestampNormalizer.test.ts` (new, 17 tests): `isSafeTimestamp` boundary cases;
  ordering preservation across distinct/increasing raw timestamps; the offset-based
  normalization formula; zero/one/many coalesced-sample counts; the regression
  demonstration above; and every anomaly case from the brief -- `NaN` gesture-start
  timestamp, `NaN`/`Infinity`/negative/backwards per-sample timestamps, recovery after one
  anomalous sample, and a long mixed good/anomalous sequence staying strictly monotonic and
  finite throughout.
- `pointerSamplingFidelity.test.ts` (new, 5 tests): the end-to-end property the finding is
  actually about -- the same physical path delivered as high-frequency individual events
  versus one coalesced/frame-stalled batch produces closely matching quantity (±0.01),
  coverage (±0.1), and evenness (±0.1); plus the buggy-pattern-vs-fix coverage comparison
  from section 5.
- Existing suites: no lifecycle test needed changes -- MUST FIX 1/3/7/9's abort/commit/
  discard paths in `PizzaStage.tsx` are untouched by this fix (only the *position/timestamp*
  fed into an already-running dispense session changed, never when a session starts, ends,
  commits, or discards). `sauceDispenseController.test.ts`,
  `gameReducer.commitSauceDispense.test.ts`, `phase4a1a.regression.test.ts`, and every other
  pre-existing file pass unmodified.

**Total: 362/362 passing** (up from 340 before this fix: +22 from the two new files).

## 7. Lint / typecheck / build

- `npm run lint` (oxlint): clean, 0 warnings, 0 errors.
- `tsc -b && vite build`: clean.
- `git diff --check`: clean (no whitespace errors).
- Node 22.22.2 throughout.

## 8. Browser verification (390x844, Chromium)

Fresh save each run, `console`/`pageerror` listeners for the whole session.

**Normal-speed drag** (a straight 12-point horizontal stroke, ~25ms between steps, no
throttling): 量26% 被覆14% 均一性82% はみ出し0% -- heatmap shows a clean horizontal band
spanning the drag (screenshot: `normal-path.png`).

**Slow/frame-stalled path** (the *identical* physical drag script, run under
`Emulation.setCPUThrottlingRate` 15x and separately 20x via CDP, simulating a heavily
janked/low-end device): 量100%(capped) / 100%(capped), 被覆13% / 11%, 均一性78% / 77%.
Quantity legitimately differs from the normal run -- CPU throttling slows the browser's own
input processing, so the *real* wall-clock hold duration for the same script is genuinely
longer under throttle, correctly producing more dispensed quantity (bounded by the existing
`SAUCE_MAX_QUANTITY` cap, not a bug in this fix). The property this fix is actually
responsible for -- **coverage/distribution staying faithful to the real path even when many
more ticks fire in a stalled batch** -- holds: coverage stayed in the same 11-14% band
across all three runs, and the heatmap screenshot (`slow-path.png`) shows the *same*
clean horizontal band shape as the normal run, just more saturated (more total quantity
along the same shape) -- not the concentrated single-point blob the pre-fix bug would have
produced under this exact scenario (compare to the earlier Post-Codex-Fix report's
"concentrated" case screenshot, ~5% coverage, for what that collapse actually looks like).

**Across every run: console errors = 0, page errors = 0, horizontal overflow = 0px.**

## 9. Remaining P0/P1/P2

None. Codex's Post-Fix Independent Re-Review had already found P0=0/P1=0/P2=0/P3=0 as *new*
findings, with only this one residual P2 (timestamp preservation) outstanding from the
previous round -- now fixed and verified per sections 5-8.

## 10. Technical Merge Readiness

**Restored / maintained.** The one outstanding P2 from the independent re-review is fixed,
tested (unit + integration + live-browser), and regression-free (362/362, unchanged
lint/typecheck/build). Scope Guard held: no change to legacy scoring, Dex, stars,
totalStars, Mission scoring, Pitz, Shop, save schema, the Reference target, the overflow
model, or transactional commit semantics -- diff is confined to timestamp/path sampling
(`PizzaStage.tsx`'s pointermove wiring, the new `pointerTimestampNormalizer.ts`) and its
tests/report.

## 11. Human Feel Readiness

**Ready to proceed**, with the same known limitations already on record (heatmap is a
blocky 16x16 raster; the Reference target remains a placeholder pending real feedback) --
nothing new introduced by this fix. This was the last outstanding technical blocker
identified before Human Feel testing; no further Codex findings are open.

## 12. Files changed this session

New: `src/logic/pointerTimestampNormalizer.ts`,
`src/logic/pointerTimestampNormalizer.test.ts`,
`src/logic/pointerSamplingFidelity.test.ts`,
`docs/reports/PIZZA_GAME_Phase4A-1A_Timestamp-Fix_Result.md`.
Modified: `src/components/PizzaStage.tsx` (timestamp threading through
`handlePointerMove`/`processMovePoint`/`startDispenseSession`/`endDispenseSession` only --
no gesture-session, reducer, overflow, or commit-semantics changes).
