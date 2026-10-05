import { useMemo, useState } from "react";
import type { StorageLike } from "../state/persistence";
import { applyEditableState, type ApplyFailureReason, type ApplyResult, type SaveInspection } from "./apply";
import type { EditorCatalog } from "./editorCatalog";
import { diffEditable } from "./editorModel";
import { DEV_EDITOR_REVIEW_TITLE } from "./marks";
import { hasErrors, validateEditableState, type EditableState } from "./stateModel";

/**
 * DEV State Editor (Issue #403) S4: the review and the explicit apply. The diff, the warnings and the three
 * preservation switches are shown first; nothing is written until the person ticks the confirmation and presses
 * 「適用する」 (the only call to `applyEditableState` in the UI). `applyEditableState` itself backs the stored save
 * up first, applies, verifies with the game's own loader and rolls back on a mismatch.
 */
export interface ReviewPanelProps {
  storage: StorageLike | null;
  catalog: EditorCatalog;
  base: EditableState;
  draft: EditableState;
  inspection: SaveInspection;
  originalBackupExists: boolean;
  now?: () => Date;
  /** Called after a successful apply, so the container reloads what is stored. */
  onApplied: () => void;
}

const FAILURE_TEXT: Record<ApplyFailureReason, string> = {
  "storage-unavailable": "storage を読み書きできないため、何も適用していません。",
  "invalid-state": "状態に誤りがあるため、何も適用していません。",
  "unreadable-save": "現在の save を読めません。内容を確認して「読めない save を上書きする」を選んでください（backup は取られます）。",
  "backup-failed": "backup を作れなかったため、何も適用していません（save は変更されていません）。",
  "write-failed": "書き込みに失敗しました。",
  "verify-failed": "適用後の検証が一致しませんでした。",
};

function describeApplyResult(result: ApplyResult): { ok: boolean; text: string } {
  if (result.ok) {
    const kept = result.preserved;
    const keptParts = [
      kept.topLevelKeys.length > 0 ? `未知キー ${kept.topLevelKeys.length}` : "",
      kept.unknownIds > 0 ? `未知 id ${kept.unknownIds}` : "",
      kept.missionBest ? "missionBest" : "",
      kept.dinnerRecords ? "dinner records" : "",
    ].filter(Boolean);
    return { ok: true, text: `適用しました（本物の loader で検証済み）。引き継ぎ: ${keptParts.length > 0 ? keptParts.join("・") : "なし"}。${result.backedUpOriginal ? "元の save を backup（original）しました。" : ""}` };
  }
  const rollback = result.rolledBack === undefined ? "" : result.rolledBack ? " 元の save に戻しました（rollback 済み）。" : " ⚠ 元の save に戻せたか確認してください。";
  return { ok: false, text: `${FAILURE_TEXT[result.reason]}${rollback}` };
}

export function ReviewPanel({ storage, catalog, base, draft, inspection, originalBackupExists, now, onApplied }: ReviewPanelProps) {
  const [preserveMissionBest, setPreserveMissionBest] = useState(true);
  const [preserveDinnerRecords, setPreserveDinnerRecords] = useState(true);
  const [preserveUnknown, setPreserveUnknown] = useState(true);
  const [acknowledgeUnreadable, setAcknowledgeUnreadable] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const diff = useMemo(() => diffEditable(base, draft, catalog), [base, draft, catalog]);
  const issues = useMemo(() => validateEditableState(draft, catalog), [draft, catalog]);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const unreadable = inspection.kind === "corrupt" || inspection.kind === "unknown-schema";
  const orderChanged = diff.some((r) => r.id === "order" || r.id === "last-acquired");
  const canApply = diff.length > 0 && !hasErrors(issues) && confirmed && (!unreadable || acknowledgeUnreadable) && storage !== null;

  function apply() {
    if (!canApply) return;
    const outcome = applyEditableState(draft, storage, { preserveMissionBest, preserveDinnerRecords, preserveUnknown, acknowledgeUnreadable, catalog, now });
    setResult(describeApplyResult(outcome));
    setConfirmed(false);
    if (outcome.ok) onApplied();
  }

  return (
    <div>
      <h2 className="dse__h2">{DEV_EDITOR_REVIEW_TITLE}</h2>
      {diff.length === 0 ? (
        <p className="dse-note">変更はありません（下書きは現在の save と同じです）。</p>
      ) : (
        <ul className="dse-list" aria-label="変更内容">
          {diff.map((row) => (
            <li key={row.id} className="dse-diff" data-diff-id={row.id}>
              <b>{row.label}</b>
              <span className="dse-diff__detail">{row.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {(errors.length > 0 || warnings.length > 0 || orderChanged || unreadable) && (
        <div className="dse-warn" role="group" aria-label="警告">
          {errors.map((i) => (
            <p key={`${i.code}-${i.message}`} className="dse-warn__item dse-warn__item--error">
              ⛔ {i.message}
            </p>
          ))}
          {warnings.map((i) => (
            <p key={`${i.code}-${i.message}`} className="dse-warn__item">
              ⚠ {i.message}
            </p>
          ))}
          {orderChanged && <p className="dse-warn__item">⚠ 取得順を変えると、Research Entry の unlock fact（最後に取得した材料）が変わります。</p>}
          {unreadable && (
            <p className="dse-warn__item dse-warn__item--error">⛔ 現在の save は {inspection.kind === "corrupt" ? "JSON として読めません" : "このビルドで読めない schema です"}。適用するとゲームが読める save で置き換わります（原文は backup されます）。</p>
          )}
        </div>
      )}

      <fieldset className="dse-fieldset">
        <legend>引き継ぐもの（既定は すべて ON）</legend>
        <label className="dse-check">
          <input type="checkbox" checked={preserveMissionBest} onChange={(e) => setPreserveMissionBest(e.target.checked)} /> missionBest（Lunch Rush の BEST）
        </label>
        <label className="dse-check">
          <input type="checkbox" checked={preserveDinnerRecords} onChange={(e) => setPreserveDinnerRecords(e.target.checked)} /> dinnerMissionRecords
        </label>
        <label className="dse-check">
          <input type="checkbox" checked={preserveUnknown} onChange={(e) => setPreserveUnknown(e.target.checked)} /> 未知のキー / 未知の id（新しいビルドのデータ）
        </label>
      </fieldset>

      <p className="dse-note">backup: 適用の直前に現在の save を raw のまま退避します（previous）。{originalBackupExists ? "original は既にあります（上書きしません）。" : "original はまだ無いので、今回の適用前の save を original として残します。"}</p>

      {unreadable && (
        <label className="dse-check">
          <input type="checkbox" checked={acknowledgeUnreadable} onChange={(e) => setAcknowledgeUnreadable(e.target.checked)} /> 読めない save を上書きする（backup から戻せます）
        </label>
      )}
      <label className="dse-check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={diff.length === 0} /> 上の変更内容と backup を確認しました
      </label>
      <button type="button" className="dse-btn dse-btn--primary" disabled={!canApply} onClick={apply}>
        適用する
      </button>

      {result && (
        <p className={result.ok ? "dse-result dse-result--ok" : "dse-result dse-result--error"} role="status">
          {result.text}
        </p>
      )}
      {result?.ok && (
        <p className="dse-note">
          <a className="dse__link" href={import.meta.env.BASE_URL}>
            ゲームを開く
          </a>
        </p>
      )}
    </div>
  );
}
