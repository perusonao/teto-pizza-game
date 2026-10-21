# Save Protection PR-3 (Issue #560, Fresh Audit N1): the write gate knows what THIS page loaded

Base: `main` @ `e3a7537`. Branch `claude/issue-560-save-data-audit-o1y57x`. Owner decision (Fresh Audit N1): load-baseline guard; on a mismatch the save is refused and the existing saveHealth / HOME notice reports it; #282's stale-tab write is part of the regression tests. **No save key, `schemaVersion`, field or migration change.** R8, R4/R5, v3 migration and #282's Pitz-ledger question are out of scope. FINISH common base (#611 / PR #615, `src/data/**`), #584, #587, #612, #613 and the shared Preview are untouched.

## The hole (reproduced on `main` in a real browser, 390x844 and 360x800)
| Case | Setup | Result on `main` |
|---|---|---|
| N1 | the first read of the save at page load throws once, later reads work | Pitz **5000 -> 0**, Dex **1 -> 0**: the mount-time save replaced the real save with the default state, no `blocked`, no notice |
| #282 | tab B saves Pitz 9000; stale tab A buys something | stored Pitz **9000 -> 4940** (A's own balance) |

Cause: `writeSave`'s gate (PR-1) looked only at the stored text ("is it readable?"), never at what this page had loaded.

## The rule (`src/state/saveSession.ts`, new)
A write is allowed only while the stored text is exactly what this page last saw: the text it loaded at startup, or the text it wrote itself.
| Session state | Set by | Writes |
|---|---|---|
| `loaded { expectedRaw }` | `loadSaveForSession()` after a successful startup read (`null` = no save) | allowed while stored text === `expectedRaw`; every successful write moves `expectedRaw` to the text written, so the page's own consecutive writes pass. Anything else -> `stale-save`, nothing written |
| `load-failed` | the startup read **threw** | **never** allowed for the rest of the page's life -- not even after a later read succeeds (that later success is exactly the N1 hole). Sticky, so React StrictMode's double initializer cannot launder it |
| none | a storage nobody started a session on (tests, DEV editor) | unchanged: only PR-1's root classification applies |

Order inside the gate: read the stored text (a throw is still `storage-error`) -> session check -> PR-1 classification. A refusal has no side effect (nothing quarantined, no other key written).

## Code
`persistence.ts` (`loadSaveForSession`, session check in `guardStoredRoot`, `noteSaveWritten` at both `setItem` sites, `noteSaveReset`; `SaveWriteBlock` += `load-failed`, `stale-save`; `loadSave` unchanged in behaviour), `saveSession.ts` (new, pure bookkeeping), `App.tsx` (**one line**: the initial state uses `loadSaveForSession`), `saveHealth.ts` + `saveNoticeCopy.ts` (two notices), `SaveNoticeBanner.tsx` (「再読み込み」 on these two notices), `src/test/setup.ts` (resets the page-lifetime session between tests: jsdom's `localStorage` is one object per file).

## While a write is refused
- The game keeps running from memory; nothing is saved (same as the existing "future version" / "storage unavailable" states). The stored save is never touched.
- HOME shows a blocking notice (`role="alert"`, not dismissible): `load-failed` at once at startup (no write needed to be told); `stale-save` after the refused write. A read that keeps failing is still `storage-unavailable`.
- **Recovery: reload** (the notice has a 「再読み込み」 button). The reload starts a fresh session on whatever is stored now. For `stale-save` this loads the newer save and **drops this page's unsaved progress** (the notice says so); for `load-failed` nothing is lost.
- A Full Game Reset the player chooses lifts `load-failed` (the app reloads right after).

## Limits (stated, not fixed)
1. **Read-compare-write is not atomic.** localStorage has no compare-and-swap; the check and `setItem` are two calls. A tab that writes in the instant between them is not caught by that write; this page's NEXT write sees the difference and is refused, so the damage is bounded to one write (pinned by a "KNOWN LIMIT" test). Narrowing, not closing, #282.
2. **#282's model is unchanged**: Pitz is still an absolute value, last writer wins between tabs that never see each other's saves; a ledger / delta design remains the open question there.
3. Detection happens at write time. A stale tab shows no notice until its first refused write (or a refresh of the notice).
4. A refused session's in-memory Dinner payout / Pitz is lost on reload (as for the existing blocked states).
5. A Full Game Reset in a stale tab removes the other tab's newer save (an explicit player action; unchanged).
6. Exact-text comparison: another tab writing byte-identical text is indistinguishable (harmless).
7. A write refused for `load-failed` / `stale-save` does not send the Dinner "records refused" revert (same as other blocked reasons).

## Tests
New `persistence.session.test.ts` (26): N1 reproduction, every write API refused repeatedly with zero writes, a later successful load does not lift it, no-save case, persistent failure stays `storage-error`, reload recovers, Reset lifts; healthy session (consecutive writes of every API, fresh install, every golden era, failing `setItem` does not move the expectation, session-less storage unchanged); #282 (Dex + Pitz, stock / ownership / `persistDex` / `persistMissionBest`, no side effect, permanent until reload, first-save race, removed key, the documented race limit); R1 / R3 unchanged under a session (every unusable root); notices. Negative control: with the session check removed, 11 of them fail. Plus `App.saveProtectionUi.test.tsx` (+3: N1 through the real App, reload button, healthy launch), `saveNoticeCopy.test.ts` (+2), the two `#282` todos in `persistence.compat.risks.test.ts` replaced by a pointer, and `e2e/save-protection-pr3.spec.ts` (N1 and #282 in a real browser, 390x844 and 360x800).

Verification: `tsc -b` clean; `oxlint` existing warnings only; full Vitest 499 files passed / 1 skipped, 9197 tests (+ new) passed; Chromium E2E (iphone-390x844 / 360x800): PR-3 spec (4) + the existing save specs (PR-2, forward-compat 3-4b, Dinner records, hint facts) 20/20. WebKit runs in CI.

## Human Verification
Video (not committed): `artifacts/save-protection-pr3/save-protection-pr3_hv_390x844.mp4`, 390x844, H.264, ~29 s -- transient failure -> notice -> real reload -> clean HOME with the 5000 Pitz save; then a second tab saves, the stale tab buys in the Shop, the save stays the other tab's, HOME shows the stale notice, reload loads the newer save. Recorded against the local dev server (the shared Preview is not updated). Screenshots: `docs/reports/screenshots/save-protection-pr3/` (`before-*` = `main`, `after-*` = this PR, 390x844 and 360x800).
