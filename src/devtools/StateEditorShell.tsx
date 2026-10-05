import { useMemo } from "react";
import { inspectStoredSave, type SaveInspection } from "./apply";
import { BACKUP_SLOTS, readBackup } from "./backup";
import { DEV_STATE_EDITOR_MARK, DEV_STATE_EDITOR_TITLE } from "./marks";
import { PENDING_PRESETS, PRESETS } from "./presets";
import { SAVE_STORAGE_KEY } from "../state/persistence";
import "./stateEditorShell.css";

/**
 * DEV State Editor (Issue #403) S3: the editor SHELL. DEV / Preview only, reached only through `?dev=state`
 * (src/main.tsx); a production build contains none of this (src/preview/previewIsolation.gate.test.ts).
 *
 * It replaces <App /> (like the other read-only developer page), so no player state is loaded and nothing the
 * game would persist runs. The shell is READ-ONLY: opening the URL never writes, removes or seeds anything
 * (Owner Contract 7). It shows where the save is, what the stored save is, whether a backup exists, and the
 * presets that will be selectable. The editing UI (S4) is not here.
 */

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function describeSave(inspection: SaveInspection): string {
  switch (inspection.kind) {
    case "empty":
      return "セーブなし（新規）";
    case "readable":
      return `読み取り可 — Dex ${inspection.state.dex.length} / 所有 ${inspection.state.ownedIngredientIds.length} / Pitz ${inspection.state.pitzBalance}`;
    case "corrupt":
      return "壊れている（JSON として読めない）";
    case "unknown-schema":
      return "未知の schema（このビルドでは読めない）";
    case "storage-error":
      return "storage を読めない";
  }
}

export function StateEditorShell() {
  const view = useMemo(() => {
    const storage = getStorage();
    const inspection = inspectStoredSave(storage);
    const backups = BACKUP_SLOTS.map((slot) => {
      const read = storage ? readBackup(storage, slot) : ({ kind: "error" } as const);
      return { slot, text: read.kind === "ok" ? `あり（${read.entry.createdAt}）` : read.kind === "none" ? "なし" : "読めない" };
    });
    return { inspection, backups };
  }, []);
  const mode = import.meta.env.DEV ? "DEV" : "PREVIEW";

  return (
    <main className="dse" data-dev-state-editor={DEV_STATE_EDITOR_MARK} aria-labelledby="dse-title">
      <header className="dse__head">
        <h1 id="dse-title" className="dse__title">
          {DEV_STATE_EDITOR_TITLE}
        </h1>
        <span className="dse__badge">{mode}</span>
      </header>
      <p className="dse__note">開発・Human Verification 専用です。このページを開いただけでは save は変更されません。</p>

      <section className="dse__card" aria-labelledby="dse-save">
        <h2 id="dse-save" className="dse__h2">
          保存先
        </h2>
        <p className="dse__row">
          key: <code>{SAVE_STORAGE_KEY}</code>
        </p>
        <p className="dse__row">現在の save: {describeSave(view.inspection)}</p>
        <ul className="dse__list">
          {view.backups.map((b) => (
            <li key={b.slot}>
              backup {b.slot}: {b.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="dse__card" aria-labelledby="dse-presets">
        <h2 id="dse-presets" className="dse__h2">
          プリセット（編集 UI は未実装）
        </h2>
        <ul className="dse__list">
          {PRESETS.map((p) => (
            <li key={p.id}>
              <b>{p.labelJa}</b> — {p.descriptionJa}
            </li>
          ))}
          {PENDING_PRESETS.map((p) => (
            <li key={p.id}>
              <b>{p.labelJa}</b> — {p.blockedBy} merge まで配線しない
            </li>
          ))}
        </ul>
      </section>

      <p className="dse__row">
        <a className="dse__link" href={import.meta.env.BASE_URL}>
          ゲームへ戻る
        </a>
      </p>
    </main>
  );
}
