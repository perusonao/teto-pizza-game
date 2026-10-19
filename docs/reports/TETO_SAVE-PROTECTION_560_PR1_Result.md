# Save Protection PR-1 (Issue #560, Phase B): a save this build cannot read is never destroyed

Base: `main` @ `437e176`. Branch `claude/save-data-protection-560`. **Storage layer only** — no UI, no new save field, no change to the save key (`teto-pizza-save-v1` / `teto-pizza-preview-save-v1`) or to `schemaVersion` (2). Owner decisions: #560 comments / Owner GO of 2026-10-19. PR-2 (notice banner, Reset dialog wording) and #282 (multi-tab) are separate and not started.

## What changed
| File | Change |
|---|---|
| `src/state/saveRootClassification.ts` (new) | `classifyStoredSave(raw)` → `empty` / `readable` (v1/v2 with an array `dex` = exactly what `loadSave` accepts) / `unknown-schema` (integer `schemaVersion` > 2) / `corrupt` |
| `src/state/saveQuarantine.ts` (new) | A verified copy of unreadable stored text under `<save key>.quarantine-v1.first` and `.latest`; `discardQuarantine` is the only deletion |
| `src/state/persistence.ts` | `writeSave` (the single write path) passes a guard first; `persistProgress` / `persistDex` / `persistMissionBest` report `blocked`; `resetSave` keeps an unreadable save before removing it (`resetSaveResult` gives the reason) |

## Save state transitions (at write time, on the text currently in storage)
```
empty | readable ........ write as before
unknown-schema ........... REFUSE. Stored bytes untouched. blocked = "unknown-schema". Nothing is quarantined (the save itself is the copy).
corrupt
  > 256 KB ............... REFUSE.   blocked = "quarantine-too-large"
  same text already held . write (no new copy)
  else ................... copy into `first` (if empty) or `latest`, READ BACK (stored text equal, well-formed entry, raw equal)
                           ok     -> write the new save
                           failed -> restore the slot, REFUSE. blocked = "quarantine-failed"
storage unreadable ....... REFUSE.   blocked = "storage-error"
```
- `first` is written once and never changed by anything but `discardQuarantine`; only `latest` is replaced. At most two quarantine keys exist, ever. The same text is never copied twice, so repeated launches do not multiply backups.
- Loading, and an unchanged auto-save (App's mount-time effect), never write or quarantine anything.
- Entry: `{ v, slot, createdAt, sourceKey, kind: "corrupt" | "unknown-schema", rawLength, raw, acknowledged:false }`; `raw` is the stored text, byte for byte.

## Full Game Reset (existing path, no UI change)
`resetSave` (what `App.handleResetGameData` calls) now: readable / empty → removes as before. `unknown-schema` or `corrupt` → copies it (kind recorded) and verifies BEFORE removing the key; if the copy fails or the text is above 256 KB the key is **not** removed and the reset reports failure (the existing "リセットに失敗しました" path). It never touches the quarantine. A newer build's save is therefore never lost by an existing Reset: it moves into the quarantine. Deleting quarantined data is `discardQuarantine` only, wired to nothing in PR-1.

## Tests
New: `saveRootClassification.test.ts` (11, incl. a differential against `loadSave` and the DEV editor's root gate), `saveQuarantine.test.ts` (23), `persistence.protection.test.ts` (51: R1 matrix over every write API and many sessions, R3 for all 10 unusable roots, idempotence, quota / dropped write / read-back mismatch / unreadable slot / unreadable save key / 256 KB edge / save write failing after a good copy, no regression on every golden era, Reset safety). Phase A's R1 and R3 characterizations (`persistence.compat.risks.test.ts`) now assert the desired behaviour; R2 / R4 / R5 / R6 / R8 characterizations are unchanged.

## Remaining risks (not fixed here)
1. **`latest` can be replaced.** Only `first` is immutable, so a third, different unreadable text replaces the second one (including a newer build's save copied by a Reset).
2. **Above 256 KB** an unreadable save can neither be written over nor reset: the game cannot save and Reset reports failure. A real save is ~15 KB, so this needs an already-absurd state.
3. **Blocked means "not saving", silently.** While `blocked` (newer build's save, failed quarantine, unreadable storage) the game still plays but nothing persists, and there is no player-facing notice until PR-2. A Dinner payout or Pitz shown in that session is gone on reload.
4. **A save whose key cannot be read** (`getItem` throws) now blocks writes (it used to attempt the write).
5. **Recovery is not player-facing.** The quarantined text is kept, but only a developer can restore it today; the recovery UI is a separate Issue.
6. **Quarantine costs storage**: up to two extra copies of an unreadable save (≈ 15 KB each in practice).
7. **Not covered:** stale-tab rollback and Pitz duplication (#282), R4 / R5 / R6 / R8 (see Phase A).
8. `persistDex` / `persistMissionBest` now return `{ blocked? }` instead of `void` (compatible with every existing caller).
