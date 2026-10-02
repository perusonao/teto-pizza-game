import { CHANGELOG, type ChangelogEntry } from "../data/changelog";

/**
 * 更新情報 overlay: HOME -> 更新情報 -> 履歴一覧. Same shell as Settings/Dex/Shop
 * (`dex-overlay` / `dex-overlay__panel`), so it stacks, scrolls and dismisses like them. Purely
 * presentational over static data -- no state, no persistence, no read/unread tracking.
 * `entries` defaults to the real `CHANGELOG` (newest first); tests inject fixtures.
 */
interface ChangelogOverlayProps {
  onClose: () => void;
  entries?: readonly ChangelogEntry[];
}

export function ChangelogOverlay({ onClose, entries = CHANGELOG }: ChangelogOverlayProps) {
  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel changelog-overlay__panel" role="dialog" aria-label="更新情報">
        <div className="dex-overlay__header">
          <h2>{"\u{1F4E3}"} 更新情報</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="dex-overlay__body">
          <ol className="changelog-list">
            {entries.map((entry, i) => (
              <li key={`${entry.version ?? ""}|${entry.date ?? ""}|${entry.title}|${i}`} className="changelog-entry">
                <h3 className="changelog-entry__title">{entry.title}</h3>
                {(entry.version || entry.date) && (
                  <p className="changelog-entry__meta">{[entry.version, entry.date].filter(Boolean).join(" ・ ")}</p>
                )}
                <ul className="changelog-entry__changes">
                  {entry.changes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
