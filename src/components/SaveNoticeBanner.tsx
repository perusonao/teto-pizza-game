import { isBlockingNotice, type SaveNotice } from "../state/saveHealth";
import { describeSaveNotice } from "../state/saveNoticeCopy";

/**
 * HOME's save notice (Save Protection PR-2, Issue #560). Presentational: the copy for each distinct situation lives here
 * (`state/saveNoticeCopy.ts`), the decision of WHICH situation it is lives in `state/saveHealth.ts`.
 *
 * Blocking notices (the save is not being written) are `role="alert"` and cannot be dismissed; the informational
 * "a backup is kept" notice is `role="status"` and offers 「了解」, which only marks it seen -- it never deletes the backup.
 */

interface SaveNoticeBannerProps {
  notice: SaveNotice;
  onOpenSettings: () => void;
  /** Informational notices only. */
  onAcknowledge?: () => void;
}

export function SaveNoticeBanner({ notice, onOpenSettings, onAcknowledge }: SaveNoticeBannerProps) {
  const copy = describeSaveNotice(notice);
  const blocking = isBlockingNotice(notice);
  return (
    <section
      className={`save-notice save-notice--${blocking ? "blocking" : "info"}`}
      role={blocking ? "alert" : "status"}
      data-save-notice={notice.kind}
    >
      <h2 className="save-notice__title">{copy.title}</h2>
      <p className="save-notice__body">{copy.body}</p>
      <div className="save-notice__actions">
        <button type="button" className="save-notice__button" onClick={onOpenSettings}>
          設定を開く
        </button>
        {(notice.kind === "load-failed" || notice.kind === "stale-save") && (
          <button type="button" className="save-notice__button" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        )}
        {!blocking && onAcknowledge && (
          <button type="button" className="save-notice__button save-notice__button--quiet" onClick={onAcknowledge}>
            了解
          </button>
        )}
      </div>
    </section>
  );
}
