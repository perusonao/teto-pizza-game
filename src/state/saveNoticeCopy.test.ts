import { describe, expect, it } from "vitest";
import { describeSaveNotice } from "./saveNoticeCopy";
import type { SaveNotice } from "./saveHealth";

/**
 * Save Protection PR-2 (#560), Owner wording decision: the notices say exactly what is and is not true.
 * - a newer build's save: this build does not save, and what is played now can be lost on a reload;
 * - a damaged save: what was kept is a BACKUP, not a restore, and the earlier progress was NOT restored.
 * These pin the meaning (not every character), so a later wording pass cannot silently drop it.
 */

const ALL: SaveNotice[] = [
  { kind: "future-version", schemaVersion: 3 },
  { kind: "corrupt", backedUp: true },
  { kind: "corrupt", backedUp: false },
  { kind: "backup-failed", reason: "quarantine-failed" },
  { kind: "backup-failed", reason: "quarantine-too-large" },
  { kind: "storage-unavailable" },
  { kind: "backup-kept", entryKind: "corrupt" },
  { kind: "backup-kept", entryKind: "unknown-schema" },
];

const text = (n: SaveNotice) => {
  const copy = describeSaveNotice(n);
  return `${copy.title}\n${copy.body}`;
};

describe("future version (a newer build's save)", () => {
  const body = describeSaveNotice({ kind: "future-version", schemaVersion: 3 }).body;

  it("says the data is kept, and that this version does not save", () => {
    expect(body).toMatch(/そのまま残/);
    expect(body).toMatch(/このバージョンでは保存されません/);
  });

  it("says what is played now can be lost on a reload", () => {
    expect(body).toMatch(/いま遊んでいる内容/);
    expect(body).toMatch(/再読み込み/);
    expect(body).toMatch(/失われる可能性/);
  });
});

describe("damaged save", () => {
  const variants = [
    ["already backed up", describeSaveNotice({ kind: "corrupt", backedUp: true }).body],
    ["not backed up yet", describeSaveNotice({ kind: "corrupt", backedUp: false }).body],
    ["backup kept (info)", describeSaveNotice({ kind: "backup-kept", entryKind: "corrupt" }).body],
  ] as const;

  for (const [name, body] of variants) {
    it(`${name}: the backup is not a restore, and the earlier progress was not restored`, () => {
      expect(body).toMatch(/バックアップ/);
      expect(body).toMatch(/復元ではありません|復元されて/);
      expect(body).toMatch(/以前の進行は復元されて/);
    });
  }

  it("says a fresh start is what the player is playing", () => {
    expect(describeSaveNotice({ kind: "corrupt", backedUp: true }).body).toMatch(/新しいデータで始めています/);
    expect(describeSaveNotice({ kind: "corrupt", backedUp: false }).body).toMatch(/新しいデータで始めています/);
  });

  it("still says the damaged text is kept, not deleted", () => {
    expect(describeSaveNotice({ kind: "corrupt", backedUp: true }).body).toMatch(/退避してあります/);
    expect(describeSaveNotice({ kind: "corrupt", backedUp: false }).body).toMatch(/消さずに/);
  });
});

describe("notices that mean nothing is being saved", () => {
  it("backup failed (either reason) and unreadable storage say the session is not saved", () => {
    for (const notice of [
      { kind: "backup-failed", reason: "quarantine-failed" },
      { kind: "backup-failed", reason: "quarantine-too-large" },
      { kind: "storage-unavailable" },
      { kind: "load-failed" },
      { kind: "stale-save" },
    ] as SaveNotice[]) {
      expect(describeSaveNotice(notice).body).toMatch(/保存されません/);
    }
  });
});

describe("PR-3 notices: say what happened to the save, and how to recover", () => {
  it("load-failed: the save was not touched, what is shown is not the save, and a reload recovers", () => {
    const body = describeSaveNotice({ kind: "load-failed" }).body;
    expect(body).toMatch(/手を加えていません/);
    expect(body).toMatch(/保存データではありません/);
    expect(body).toMatch(/再読み込み/);
  });

  it("stale-save: another tab updated it, it is not overwritten, a reload loads the newer one and drops this page's unsaved progress", () => {
    const body = describeSaveNotice({ kind: "stale-save" }).body;
    expect(body).toMatch(/別のタブ/);
    expect(body).toMatch(/上書きしない/);
    expect(body).toMatch(/再読み込み/);
    expect(body).toMatch(/未保存の進行は失われます/);
  });
});

describe("a newer build's save that a Reset moved into the backup", () => {
  it("says what it is, and does not make the damaged-save statement", () => {
    const body = describeSaveNotice({ kind: "backup-kept", entryKind: "unknown-schema" }).body;
    expect(body).toMatch(/新しいバージョン/);
    expect(body).not.toMatch(/復元/);
  });
});

describe("every notice", () => {
  it("has a title and a body", () => {
    for (const notice of ALL) {
      const copy = describeSaveNotice(notice);
      expect(copy.title.length, notice.kind).toBeGreaterThan(0);
      expect(copy.body.length, notice.kind).toBeGreaterThan(0);
    }
  });

  it("never claims anything was restored or recovered", () => {
    for (const notice of ALL) {
      expect(text(notice), notice.kind).not.toMatch(/復元しました|復元されました|復旧しました|元に戻しました|取り戻しました/);
    }
  });
});
