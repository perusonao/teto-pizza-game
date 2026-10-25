import { useState } from "react";
import type { HeldDiscardDialogCopy, RoundNoticeCopy } from "../state/roundNoticeCopy";

/**
 * R8 (#617) notices. Presentational; the copy lives in `state/roundNoticeCopy.ts`. They reuse the save notice look (`save-notice`).
 * - Settled: a round was completed from the save for the player. Stays until the player confirms (the confirmation is what deletes it).
 * - Held: a journal this build cannot act on. Kept, never dismissable.
 * - Failure: the round could not be saved, so the game did not move on.
 */
interface NoticeProps {
  copy: RoundNoticeCopy;
}

function Lines({ copy }: NoticeProps) {
  return (
    <>
      <h2 className="save-notice__title">{copy.title}</h2>
      {copy.lines.map((line) => (
        <p className="save-notice__body" key={line}>
          {line}
        </p>
      ))}
    </>
  );
}

export function SettledRoundNotice({ copy, onAcknowledge }: NoticeProps & { onAcknowledge: () => void }) {
  return (
    <section className="save-notice save-notice--info" role="status" data-round-notice="settled">
      <Lines copy={copy} />
      <div className="save-notice__actions">
        <button type="button" className="save-notice__button" onClick={onAcknowledge}>
          確認した
        </button>
      </div>
    </section>
  );
}

export function HeldRoundNotice({ copy, onDiscard }: NoticeProps & { onDiscard?: () => void }) {
  return (
    <section className="save-notice save-notice--blocking" role="alert" data-round-notice="held">
      <Lines copy={copy} />
      {onDiscard && (
        <div className="save-notice__actions">
          <button type="button" className="save-notice__button save-notice__button--quiet" data-held-discard-open onClick={onDiscard}>
            この記録を退避して破棄…
          </button>
        </div>
      )}
    </section>
  );
}

/** P1-1 (#664): confirmation for discarding a kept journal. Every check must be ticked; the default focus is キャンセル; a tap outside does nothing. */
export function HeldJournalDiscardDialog({
  copy,
  busy,
  failure,
  onCancel,
  onConfirm,
}: {
  copy: HeldDiscardDialogCopy;
  busy: boolean;
  failure: RoundNoticeCopy | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const allTicked = copy.checks.every((c) => ticked[c.id] === true);
  return (
    <div className="settings-reset-confirm" data-held-discard-dialog>
      <div className="settings-reset-confirm__panel" role="alertdialog" aria-labelledby="held-discard-title" aria-describedby="held-discard-body">
        <h2 id="held-discard-title" className="settings-reset-confirm__title">
          {copy.title}
        </h2>
        <div id="held-discard-body">
          {copy.strongWarning && (
            <div role="alert" data-held-discard-warning>
              {copy.strongWarning.map((line) => (
                <p key={line} className="settings-reset-confirm__error">
                  {line}
                </p>
              ))}
            </div>
          )}
          {copy.lines.map((line) => (
            <p key={line} className="settings-reset-confirm__body">
              {line}
            </p>
          ))}
        </div>
        {copy.checks.map((check) => (
          <label key={check.id} className="settings-reset-confirm__check">
            <input
              type="checkbox"
              data-held-discard-check={check.id}
              checked={ticked[check.id] === true}
              disabled={busy}
              onChange={(event) => setTicked((current) => ({ ...current, [check.id]: event.target.checked }))}
            />
            <span>{check.label}</span>
          </label>
        ))}
        {failure && (
          <div role="alert" data-held-discard-failure>
            {failure.lines.map((line) => (
              <p key={line} className="settings-reset-confirm__error">
                {line}
              </p>
            ))}
          </div>
        )}
        <div className="settings-reset-confirm__actions">
          <button type="button" className="settings-reset-confirm__cancel" data-held-discard-cancel autoFocus onClick={onCancel} disabled={busy}>
            キャンセル
          </button>
          <button
            type="button"
            className="settings-reset-confirm__confirm"
            data-held-discard-confirm
            onClick={onConfirm}
            disabled={!allTicked || busy}
          >
            {busy ? "処理中…" : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoundSaveFailureNotice({ copy, onDismiss }: NoticeProps & { onDismiss?: () => void }) {
  return (
    <section className="save-notice save-notice--blocking" role="alert" data-round-notice="save-failure">
      <Lines copy={copy} />
      {onDismiss && (
        <div className="save-notice__actions">
          <button type="button" className="save-notice__button save-notice__button--quiet" onClick={onDismiss}>
            閉じる
          </button>
        </div>
      )}
    </section>
  );
}
