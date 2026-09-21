# Teto Pizza Game — Visual Polish 2.0B Result

**Scope:** Finding P1-2 (Ranking label) and Finding P1-3 (Overlay anchoring) only, from
`docs/reports/TETO_VISUAL-POLISH_2.0_Phase0_Fresh-Audit.md`. Recipe Select's fresh-save first
impression (P1-4) and RESULT's below-fold CTA (P1-5) are explicitly **not** touched in this slice.
Pure UI/visual polish — no scoring, Completion Gate, dough/sauce/topping mechanics, bake/CUT
judgment, CookingProfile, Step Timing, recipes, progression, economy, inventory semantics, save
schema, Firebase logic, ranking query/order, Lunch Rush score/timer, Recipe Select architecture, or
RESULT scoring/CTA architecture were changed.

## 1. Audited main SHA

`00e547056914882ba1c19feafe3b4a2fa7fb6d36` (Visual Polish 2.0A, PR #146 squash merge — confirmed
as the actual `origin/main` HEAD via `git fetch origin` at session start, matching the SHA given in
the task brief).

## 2. Duplicate Gate #1 (start)

- `git fetch origin` + `git log origin/main --oneline -10`: HEAD is `00e5470` (#146), as expected.
- Open PRs (`state:open`): #105 (Dev Automation A1, unrelated), #72 (docs-only status sync,
  stale), #46 (Issue #33 Dough Shaping D0 audit, docs-only, stale base), #34 (Issue #32 Phase 1
  reference visuals, stale base), #3 (very old docs PR). **None touch ranking UI or overlay
  CSS/anchoring.**
- Searched closed/merged PRs for "2.0B / ranking / overlay / anchoring" in title to rule out
  in-flight duplicate scope: all 6 matches (#118, #127, #133, #116, #113, #97) are **closed**
  (already merged in earlier phases — Firebase Ranking 1.0/2A, HOME Weekly Ranking route, Player
  Profile display-name, and critically **#97 "Unify HOME Global Overlay (Dex/Shop/Inventory) panel
  sizing"**, which is directly relevant — see §4).
- **Conclusion:** no duplicate in-flight work. Proceeded on `claude/visual-polish-2-0b-v0r5em`,
  which was already created from and identical to `origin/main`'s `00e5470` tip.

## 3. P1-2 Fresh reproduction (Ranking label)

Re-verified against current `main`, not the stale Phase 0 audit text, because Firebase Ranking 1.0
Phase 2A (#118) and the HOME Weekly Ranking route (#127) both merged **after** that audit was
written — the audit's own premise ("promises data that doesn't exist yet") needed re-checking
against a codebase where the ranking backend now actually exists.

**Finding: still reproduces, for a different reason than originally audited.**

- `src/firebase/config.ts` reads Firebase Web config from `VITE_FIREBASE_*` env vars; this
  repository ships no `.env.local` (`.env.example` only), so any local/CI checkout without those
  vars set gets `getFirebaseConfig() → null → db == null`, and `getWeeklyLeaderboard()` (Phase 2A)
  correctly returns `{ status: "unavailable" }` in that case — verified live in this session's own
  dev server.
- HOME's ranking card (`HomeScreen.tsx`) unconditionally showed the sub-label 「今週のTOP10」
  regardless of that state. Opening it in this exact environment (browser-verified, screenshot
  below) shows `WeeklyRankingOverlay`'s honest 「ランキング機能は準備中です。」 — the same
  label/content mismatch the Phase 0 audit found, still live on current `main`.
- In a fully configured production deployment (Firebase Ranking is live per
  `docs/reports/TETO_FIREBASE-*` deploy records), this same overlay would instead show real data —
  so the mismatch isn't "the feature doesn't exist," it's "the HOME label promises one specific
  piece of content (a numbered TOP 10) regardless of which of loading/empty/error/unavailable/
  success state the destination is actually in." Fixing the underlying "unavailable" fallback
  itself is out of scope (Firebase/ranking logic untouched per the task brief) — the fix is
  wording only.

## 4. P1-3 Fresh reproduction (Overlay anchoring)

Re-verified against current `main`, not the stale audit text, because **PR #97 "Unify HOME Global
Overlay (Dex/Shop/Inventory) panel sizing"** merged after the Phase 0 audit and already fixed the
exact Shop/Inventory/Settings problem the audit described (top-anchored card, ~45% dead space
below). Browser-measured on current `main` before any change in this PR:

| Overlay | Shell | top / bottom / height @ 390×844 |
|---|---|---|
| Shop / Dex / Settings | `.dex-overlay__panel` | `168.8 / 844 / 675.2` (bottom-anchored 80dvh sheet, flush to viewport bottom) |
| Weekly Ranking (from HOME) | `.mission-overlay__panel` | `359.5 / 484.5 / 125` (small card, vertically centered, ~15% of viewport height) |

**Finding: the audit's original P1-3 (Shop/Inventory/Settings) is already resolved by #97 — not
re-broken by anything in this diff.** What remains, and what this PR fixes, is the P2 item the
audit itself flagged as the natural follow-up once P1-3 landed: *"Weekly Ranking's centered
small-card presentation (vs. Shop/Inventory/Settings' top-anchored cards) is itself an
inconsistency once P1-3 is fixed."* Since HOME's own ranking card (#127) now opens
`WeeklyRankingOverlay` as a direct peer of Dex/Shop/Inventory/Settings in HOME's own menu grid, its
different anchor/size family reads as the one unpolished HOME destination out of five — squarely
the "同系統overlayでアンカーが不統一" case called out in this task's own scope.

## 5. Changes made

### P1-2 — `src/screens/HomeScreen.tsx`
One-line copy change: the ranking card's sub-label changed from 「今週のTOP10」 to
「週間ランキング」 — matching `WeeklyRankingOverlay`'s own title text exactly, so the card
describes *what the destination is* rather than promising a specific live data shape that may not
be available in every environment/state. No logic, no conditional rendering, no new state.

### P1-3 — `src/components/WeeklyRankingOverlay.tsx` + `src/App.css`
`WeeklyRankingOverlay` now renders through the **same shared `.dex-overlay`/`.dex-overlay__panel`/
`.dex-overlay__header`/`.dex-overlay__body`/`.dex-overlay__close` shell** that Dex/Shop/Inventory/
Settings already use (established by #97), instead of the small centered `.mission-overlay__panel`
dialog card. This is a pure markup/class swap — no new CSS primitive introduced, no new magic
numbers; it reuses the exact existing shell.

One necessary override, not a new pattern: `WeeklyRankingOverlay` can still be opened **on top of
an already-mounted `MissionResultOverlay`** (Lunch Rush RESULT's own 「ランキングを見る」 button —
`GameScreen.tsx` keeps `MissionResultOverlay` mounted while `isRankingOpen` toggles a sibling
overlay in `App.tsx`). `.mission-overlay` sits at `z-index: 25`; the shared `.dex-overlay` shell
sits at `z-index: 20`. Swapping shells naively would have silently rendered the ranking overlay
**behind** an open Mission Result screen when opened from Lunch Rush — verified as a real risk by
browser-testing this exact path (see §8) before shipping. Fix: `.dex-overlay.ranking-overlay {
z-index: 25; }` in `App.css` — reuses the existing `25` value already shared by `.mission-overlay`/
`.reference-preview__backdrop`, not a new number, just applying the correct existing layer to the
repositioned shell.

Also removed: `.ranking-overlay__list`'s own `max-height: 440px; overflow-y: auto` (no longer
needed — the shared `.dex-overlay__body` now owns scrolling for this overlay, exactly as it
already does for Dex's own list). Added `.ranking-overlay__body { display: flex; flex-direction:
column; gap: 10px; }`, matching `.shop-overlay__body`'s own established convention for spacing a
body's stacked children in the shared shell.

## 6. Before / after

Saved to `docs/reports/screenshots/visual-polish-2.0b/` (representative set only, not the full
capture pass):

- `390x844/before_01_home.png` / `after_01_home.png` — HOME menu grid: ranking card sub-label
  「今週のTOP10」 → 「週間ランキング」.
- `390x844/before_02_ranking_overlay.png` / `after_02_ranking_overlay.png` — Weekly Ranking
  overlay opened from HOME: small centered floating card → full-width bottom sheet matching
  Shop/Dex/Settings.
- `360x800/before_02_ranking_overlay.png` / `after_02_ranking_overlay.png` — same comparison at
  the secondary viewport, confirming no viewport-specific breakage.
- `390x844/after_12_ranking_over_mission_result.png` — Weekly Ranking opened from Lunch Rush
  RESULT's 「ランキングを見る」 button, confirming the overlay still renders **in front of**
  `MissionResultOverlay` after the shell swap (the z-index fix in §5), not hidden behind it.

## 7. Changed files

```
src/App.css                               | 28 +++++++++++++++++-----------
src/App.globalOverlayShellSizing.test.tsx | 19 +++++++++++++++++++
src/components/WeeklyRankingOverlay.tsx   | 34 +++++++++++++++++-----------
src/screens/HomeScreen.tsx                |  2 +-
src/screens/HomeScreen.rankingLabel.test.tsx | new file
```

## 8. Ranking terminology decision

Surveyed 「ランキング / 週間ランキング / 週間TOP10 / LUNCH RUSH / 自分の順位」-class copy across
HOME, `MissionIntroOverlay`, `MissionResultOverlay`, and `WeeklyRankingOverlay`:

- HOME CTA: 「ランチラッシュ」 (katakana) / HOME menu card: 「ランキング」ラベル.
- `MissionIntroOverlay` title: 「⏱ LUNCH RUSH」 (English) — **pre-existing inconsistency with
  HOME's own 「ランチラッシュ」**, but this is Lunch Rush's own screen title, not ranking copy, and
  changing it isn't part of P1-2/P1-3's scope (it's neither the ranking label nor overlay
  anchoring) — left untouched, noted here for visibility only.
- `MissionResultOverlay` title: 「ランチラッシュ結果」; ranking entry point: 「🏆 ランキングを見る」.
- `WeeklyRankingOverlay` title: 「🏆 週間ランキング」; own-row badge: 「あなた」 (the existing
  Phase 1B "current player" convention — meaning unchanged).
- **Decision:** HOME's sub-label now reads 「週間ランキング」, exactly matching the overlay's own
  title, so 「ランキング」(HOME label) → 「週間ランキング」(HOME sub-label, overlay title) reads as
  one consistent name for one feature across both entry points. No other ranking-related string was
  changed. Existing Phase 2A state copy (loading／empty／error／unavailable, 「あなた」 own-row
  badge) is untouched in meaning — only its container markup moved (see §5).

## 9. Overlay anchoring decision

Weekly Ranking, opened from HOME, is now a same-family HOME sub-navigation overlay (matches
Dex/Shop/Inventory/Settings' shared bottom-sheet shell) rather than borrowing Lunch Rush's modal
dialog family. Lunch Rush's own `MissionIntroOverlay`/`MissionResultOverlay` **keep** the small
centered `.mission-overlay` dialog treatment unchanged — they are short confirmation/summary
screens tied to an in-progress run, a genuinely different role from a content-browsing destination,
so this PR does not force them into the Dex family too (per the task's own "役割の違うoverlayは違っ
てよい" instruction). Only the one same-family inconsistency (Weekly Ranking vs. its HOME menu
siblings) was reconciled, using the existing shared shell rather than any new CSS.

## 10. 390×844 results (authority viewport)

- HOME, Shop, Inventory, Dex, Settings, Weekly Ranking (from HOME and from Lunch Rush RESULT),
  Lunch Rush Intro/Order/Result: zero horizontal overflow (`scrollWidth === clientWidth` on every
  screen), zero console errors / page errors across the full pass.
- Weekly Ranking overlay: header (🏆 週間ランキング + 閉じる) now positioned identically to
  Shop/Dex/Settings' own headers; panel bottom flush with viewport bottom (no dead cream space
  underneath, matching its HOME siblings).
- Weekly Ranking opened from Lunch Rush RESULT: confirmed rendered in front of
  `MissionResultOverlay` (not hidden behind it), close button hit-tested as clickable
  (`elementFromPoint` at its center resolves to the close button), and closing it returns cleanly
  to the still-mounted Mission Result screen (`.mission-result__stats` re-verified present).
- No fixed-CTA overlap: `.prepare-bake-bar` (z-index 10) stays below every overlay's z-index (20 or
  25) as before — untouched by this change.
- Safe-area insets: `.dex-overlay__panel`/`__body` already account for
  `env(safe-area-inset-bottom, 0px)` (pre-existing, from #97) — Weekly Ranking now inherits this
  for free by using the same shell; it had no safe-area handling of its own before.

## 11. 360×800 results (secondary viewport)

Same checks repeated at 360×800: zero overflow, zero console errors, Weekly Ranking's new shell
scales down identically to Shop/Dex/Settings (same top/bottom/height ratios as 390×844 scaled to
the smaller viewport), no new breakage introduced at the narrower width.

## 12. Tests

- Added `src/screens/HomeScreen.rankingLabel.test.tsx` (new): asserts the ranking card shows
  「週間ランキング」 and never 「今週のTOP10」.
- Extended `src/App.globalOverlayShellSizing.test.tsx`: new case asserting Weekly Ranking's panel
  (opened via HOME) shares the exact same shell shape (`dex-overlay__header` + `dex-overlay__body`,
  nothing else) as Dex/Shop/Inventory, and that the outer backdrop carries both `dex-overlay` and
  `ranking-overlay` classes (the pairing `App.css`'s z-index override depends on).
- All 20 pre-existing `WeeklyRankingOverlay.test.tsx` + `App.globalOverlayShellSizing.test.tsx`
  cases pass unmodified against the new markup (they assert via `getByRole`/`getByText`, not
  removed class names).
- Full suite: `npm test -- --run` ×2 — **111 files / 2071 tests passed both times**, no flake, no
  skips.
- `npx tsc -b --noEmit` — clean, no errors.
- `npm run lint` (oxlint) — clean, no warnings.
- `npm run build` — succeeds (pre-existing >500kB chunk-size advisory only, unrelated to this
  change, not a new warning).

## 13. Intentionally deferred items

- P1-4 (Recipe Select fresh-save first impression) and P1-5 (RESULT CTA below fold) — explicitly
  out of scope for 2.0B per the task brief ("Recipe Select first impressionとRESULT CTAは今回は変
  更しない").
- `MissionIntroOverlay`'s 「LUNCH RUSH」 (English) vs. HOME's 「ランチラッシュ」 (katakana) naming
  gap, surfaced during the §8 terminology survey — not a ranking-label or overlay-anchoring item,
  left untouched.
- Fixing `getWeeklyLeaderboard`'s own "unavailable" fallback (e.g., detecting misconfiguration vs.
  genuinely-empty-this-week) is Firebase/ranking-logic territory, explicitly out of scope.

## 14. Remaining P1/P2 (from Phase 0 audit, for tracking only)

- P1-4, P1-5 — deferred as above, still open.
- P2 items (MakingStepTabs colorblind-safe redundancy; CUT/`.order-card` visual-consistency
  positive, no action needed) — unchanged, still open/no-op respectively.
- The Weekly-Ranking-vs-Shop/Inventory/Settings P2 inconsistency the Phase 0 audit flagged as a
  follow-up is now resolved by this PR (see §4/§9).

## 15. Final Verdict

**A. READY**

Both P1-2 and P1-3 are fresh-verified as still reproducing on current `main` (for updated reasons
in P1-2's case — the backend now exists, the label just doesn't reflect every state it can be in),
fixed with minimal, scope-respecting changes (one copy string; one shared-shell markup swap + one
z-index override reusing an existing value), verified via real Chromium sessions at both required
viewports with zero regressions (overflow, console errors, stacking, safe area, fixed-CTA overlap),
covered by new focused regression tests, and the full test/build/lint/typecheck pipeline is green
twice over.
