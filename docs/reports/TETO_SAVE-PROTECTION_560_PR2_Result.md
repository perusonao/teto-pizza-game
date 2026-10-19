# Save Protection PR-2 (Issue #560, Phase B): tell the player, and make deleting a backup explicit

Base: `main` @ `c99bd8d` (PR-1 #567 merged; main CI / Deploy / WebKit E2E green on that commit). Branch `claude/save-protection-resume-m2y6h7`. No save key, `schemaVersion`, v1/v2 read/write or migration change. #558 / #566 / D2 / #561 and the shared Preview are untouched.

## What the player sees
| Situation (kept apart) | Where it comes from | HOME notice | Dismissible |
|---|---|---|---|
| **Future version** (`schemaVersion` > 2) | stored text classified `unknown-schema` | 「新しいバージョンの保存データがあります」— data untouched, not saved by this build, **what is played now can be lost on a reload** | no |
| **Corrupt** (unreadable text) | stored text classified `corrupt` | 「保存データを読み込めませんでした」— fresh start; copy kept (already / at next save) as a **backup, not a restore: the earlier progress was NOT restored** | no |
| **Backup failed** (could not copy / too large) | last write refused `quarantine-failed` / `quarantine-too-large` | 「壊れた保存データを退避できませんでした」— overwrite stopped, session not saved | no |
| **Storage unavailable** | last write refused `storage-error`, or the save key cannot be read | 「保存先にアクセスできません」— session not saved | no |
| **Backup kept** (info) | an unacknowledged quarantine entry exists | 「以前の保存データを退避してあります」 | 「了解」 (marks seen; never deletes) |

Blocking notices are `role="alert"`; the info notice is `role="status"`. 「設定を開く」 opens Settings.

**Wording decision (Owner, 2026-10-19), copy only.** `src/state/saveNoticeCopy.ts`: the future-version body now adds 「いま遊んでいる内容は、再読み込みすると失われる可能性があります」; the corrupt bodies (already backed up / not yet) and the corrupt "backup kept" info notice now say the copy is a backup, not a restore, and that the earlier progress was not restored (「これはバックアップで、復元ではありません。以前の進行は復元されていません」). No classification, storage, Reset or layout logic changed. Pinned by `src/state/saveNoticeCopy.test.ts` (meaning, not characters) and two new assertions in `App.saveProtectionUi.test.tsx`; `after-01-home-future-version-*` and `after-07-home-corrupt-*` screenshots were re-taken.

## Reset / backup deletion
- Full Game Reset dialog: the lead text follows the situation (future version / corrupt: "削除されず端末内に退避され、はじめからやり直します"); when a backup exists it adds 「退避データは、リセットしても削除されません」. A refused reset shows the reason (quarantine failed / too large / storage unreadable); the save is untouched.
- **Backup deletion is a separate, explicit action**: Settings shows 「退避データ」 only when a backup exists → 「退避データを削除…」 → its own dialog (cannot be undone) whose 「削除する」 stays disabled until 「元に戻せないことを理解しました」 is ticked. Cancel keeps everything. Reset never reaches it; `discardQuarantine` is wired only here.

## Code
`src/state/saveHealth.ts` (read-only classification into the notice), `src/state/saveNoticeCopy.ts` (copy), `src/components/SaveNoticeBanner.tsx`, `saveQuarantine.ts` (+`summarizeQuarantine`, `isRawQuarantined`, `acknowledgeQuarantine`), `persistence.ts` (`getDefaultStorage` exported only), `App.tsx` (health state refreshed after each save attempt, acknowledge / discard handlers; `handleResetGameData` returns the reason), `HomeScreen.tsx` (optional `saveNotice` prop), `SettingsOverlay.tsx`, `App.css`.

## Tests
`state/saveHealth.test.ts` (11), `App.saveProtectionUi.test.tsx` (9: notices, bytes untouched, reset-to-backup, refused reset, discard needs the dialog + acknowledgement), `e2e/save-protection-pr2.spec.ts` (390×844 and 360×800: layout fits, no horizontal overflow, full flow through a real reload).

## Human Verification
Video (not committed): `artifacts/save-protection-pr2_hv_390x844.mp4`, 390×844, H.264, ~29 s — future-version notice → Settings → Reset dialog (cancel) → real reset + reload → backup notice → backup section → delete dialog (disabled → cancel → acknowledge → delete). Screenshots: `docs/reports/screenshots/save-protection-pr2/` (`before-*` = main, `after-*` = this PR, 390×844 and 360×800).

## Remaining risks
1. A write that fails because storage is full / disabled (not a guard refusal) is still silent, as before; only guard refusals and an unreadable save key are reported.
2. With no `localStorage` at all (privacy mode that removes it) there is still no notice.
3. Recovery of a backup is still developer-only (separate Issue).
4. `latest` is still replaceable; only `first` is immutable (PR-1 risk 1).
5. Above 256 KB an unreadable save can be neither overwritten nor reset (PR-1 risk 2), now at least visible as "backup failed".
6. A blocking notice has no dismiss, so it stays on HOME while the condition holds (intentional).
7. #282 (multi-tab) and the quarantine-failed / too-large HOME banner are covered by unit tests, not by a browser recording.
