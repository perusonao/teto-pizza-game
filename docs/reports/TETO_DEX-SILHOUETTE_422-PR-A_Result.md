# #422 PR-A — Dex generic pizza silhouette (Result)

Base: `main` `bd05b6580beec5d10f208f3e4141d02899a0f0f3`. Authority: Issue #422 (OD-DISPLAY-1 / 2) and the PR-A Owner Decisions
(pure-CSS pale pizza disc + 🔒; one shared silhouette; display-only shared frame; Dex / Shop state authority stays separate).

## Change
- `AnonymousLockFrame.tsx`: `GenericPizzaSilhouette` (no props, `aria-hidden`, pure CSS 40px disc) and `AnonymousLockFrame`
  (`lead` is a `No.xx` marker type, `hint` is one of the fixed lines in `anonymousLockHints.ts`; nothing recipe-derived can be passed).
- `DexOverlay.tsx`: undiscovered slots and the D-2 aggregated card render through the frame. Chapters, No., discovery counts, D-2
  aggregation, `data-dex-state` / `data-dex-aggregated`, tag lines, hint / free-cook / shop CTAs are unchanged. The 調理法 riddle cards
  keep their own markup (no silhouette). The Dex close button gets `dex-overlay__close--tap44`.
- `App.css`: `.dex-card--locked` loses `opacity: .6` (explicit background / text colours instead); `min-height: 56px`; silhouette rules;
  `.dex-card--locked .dex-card__tag-cta` and `.dex-overlay__close--tap44` are `min 44x44`. The shared `.dex-overlay__close` (Shop,
  Settings, Ranking, Changelog, Inventory) is untouched.
- Not touched: save schema, Research, Shop, economy, CUT, `src/state/**`.

## Tests
- `DexOverlay.silhouette.test.tsx` (new): silhouette on exactly the locked slots across Dex stages, byte-identical and attribute-minimal,
  same markup at any Dex stage, locked-slot attribute names whitelisted and free of undiscovered recipe / ingredient ids and names,
  riddle cards excluded, compile-time guards (`@ts-expect-error`), CSS contract (44px, no opacity, shared close rule unchanged).
- `e2e/dex-silhouette-422.spec.ts` (new, Chromium 390x844 + 360x800): no horizontal overflow, 40px silhouette inside the viewport,
  close button and locked-slot CTAs >= 44x44, last slot and footer CTA visible after scrolling; 0 / 11 / all discovered.
- Existing Dex vitest (4 files, 66 tests) and `discovery-dex-*` / `inventory-modal-stable-bounds` e2e pass unchanged.
- Full Vitest and WebKit are left to the PR CI.

## Screenshots
`docs/reports/screenshots/dex-silhouette-pr-a/{before,after}/` (390x844 and 360x800; 0 / 11 / all discovered; top and bottom).

## Owner iPhone Human Verification — PASS
Preview source `fbc67723d753a78103046ad091cdb0a9c452faa1` (built by the existing `teto-pizza-game-preview` pipeline, `deploy-from-source.yml`
run 37905691367, Pages run 37906046588). Owner result: **PASS**.

| Item | Result |
|---|---|
| Common silhouette on undiscovered cards | PASS |
| No. / 🔒 legibility | PASS |
| Distinguishable from discovered cards | PASS |
| Card order and scrolling | PASS |
| Bottom button visible | PASS |
| 「閉じる」 operation | PASS |
| 「ショップを見る」 operation | PASS |

The video was delivered to the Owner directly and is not committed (HV policy). The commit after `fbc6772` is docs-only (this section).
Out of scope, unchanged: Shop LOCKED rows (PR-B), save, Research, economy, CUT.
