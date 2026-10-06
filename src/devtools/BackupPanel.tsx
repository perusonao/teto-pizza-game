import { useState } from "react";
import type { StorageLike } from "../state/persistence";
import { discardBackup, restoreBackup, type BackupRead, type BackupSlot } from "./backup";
import { DEV_EDITOR_BACKUP_TITLE } from "./marks";

/**
 * DEV State Editor (Issue #403) S4: backup / restore. Shows the two backup slots (original, previous) and, on an
 * explicit two-step confirmation, restores the raw saved string byte for byte or discards the original slot.
 */
export interface BackupPanelProps {
  storage: StorageLike | null;
  backups: readonly { slot: BackupSlot; read: BackupRead }[];
  /** After a restore: the container reloads the stored save and resets the draft. */
  onRestored: (text: string) => void;
  /** After a discard: only the backup list needs re-reading. */
  onDiscarded: (text: string) => void;
}

const SLOT_LABEL: Record<BackupSlot, string> = { original: "original（最初の save）", previous: "previous（直前の適用前）" };
const RESTORE_FAILURE: Record<string, string> = {
  "no-backup": "backup がありません。",
  "backup-unreadable": "backup を読めません（壊れています）。",
  "storage-error": "storage に書けませんでした。backup は残しています。",
  "verify-failed": "復元後の検証が一致しませんでした。backup は残しています。",
};

export function BackupPanel({ storage, backups, onRestored, onDiscarded }: BackupPanelProps) {
  const [pending, setPending] = useState<{ slot: BackupSlot; kind: "restore" | "discard" } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function restore(slot: BackupSlot) {
    setPending(null);
    if (!storage) return;
    const outcome = restoreBackup(storage, slot);
    if (outcome.ok) {
      const text = `${SLOT_LABEL[slot]} から復元しました（元の文字列を完全に戻しました）。`;
      setMessage({ ok: true, text });
      onRestored(text);
    } else {
      setMessage({ ok: false, text: RESTORE_FAILURE[outcome.reason] ?? "復元できませんでした。" });
    }
  }

  function discard(slot: BackupSlot) {
    setPending(null);
    if (!storage) return;
    const ok = discardBackup(storage, slot);
    const text = ok ? `${SLOT_LABEL[slot]} を破棄しました。` : "backup を破棄できませんでした。";
    setMessage({ ok, text });
    if (ok) onDiscarded(text);
  }

  return (
    <div>
      <h2 className="dse__h2">{DEV_EDITOR_BACKUP_TITLE}</h2>
      <p className="dse-note">backup は save 本体とは別のキーに、元の文字列のまま保存されます。Full Game Reset では消えません。</p>
      <ul className="dse-list">
        {backups.map(({ slot, read }) => (
          <li key={slot} className="dse-card" data-backup-slot={slot}>
            <b>{SLOT_LABEL[slot]}</b>
            <p className="dse-note">
              {read.kind === "ok"
                ? `${read.entry.createdAt} ／ ${read.entry.hadSave ? `save あり（${read.entry.raw?.length ?? 0} 文字）` : "save なし（新規だった）"}`
                : read.kind === "none"
                  ? "なし"
                  : "読めない（壊れています）"}
            </p>
            {read.kind !== "none" && pending?.slot !== slot && (
              <div className="dse-ing__row">
                {read.kind === "ok" && (
                  <button type="button" className="dse-btn" onClick={() => setPending({ slot, kind: "restore" })}>
                    この backup に戻す…
                  </button>
                )}
                {slot === "original" && (
                  <button type="button" className="dse-btn" onClick={() => setPending({ slot, kind: "discard" })}>
                    original を破棄…
                  </button>
                )}
              </div>
            )}
            {pending?.slot === slot && (
              <div className="dse-confirm" role="group" aria-label="確認">
                <p className="dse-note">
                  {pending.kind === "restore"
                    ? "現在の save を、この backup の内容で置き換えます。よろしいですか？"
                    : "original backup を破棄します。元の save に戻す手段が無くなります。よろしいですか？"}
                </p>
                <div className="dse-ing__row">
                  <button type="button" className="dse-btn dse-btn--primary" onClick={() => (pending.kind === "restore" ? restore(slot) : discard(slot))}>
                    {pending.kind === "restore" ? "復元する" : "破棄する"}
                  </button>
                  <button type="button" className="dse-btn" onClick={() => setPending(null)}>
                    やめる
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p className={message.ok ? "dse-result dse-result--ok" : "dse-result dse-result--error"} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
