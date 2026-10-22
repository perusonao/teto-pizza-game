import type { RoundNoticeCopy } from "../state/roundNoticeCopy";

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

export function HeldRoundNotice({ copy }: NoticeProps) {
  return (
    <section className="save-notice save-notice--blocking" role="alert" data-round-notice="held">
      <Lines copy={copy} />
    </section>
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
