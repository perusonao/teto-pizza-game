interface MissionIntroOverlayProps {
  durationSeconds: number;
  onStart: () => void;
  onClose: () => void;
}

/** Production's duration is always a round number of minutes (180s), so "N分" is exact
 *  there; a dev-only shortened `?missionDuration=` override (see App.tsx) can be any number
 *  of seconds though, so this falls back to seconds instead of a misleading rounded "N分". */
function formatDuration(durationSeconds: number): string {
  return durationSeconds % 60 === 0 ? `${durationSeconds / 60}分` : `${durationSeconds}秒`;
}

/** Mission entry explanation, shown before a Lunch Rush run starts (Phase 3C-4 section 3:
 *  a short explanation screen, not a big new Home screen). Deliberately minimal -- one
 *  headline, one line of instructions, one Start button, one way back out. */
export function MissionIntroOverlay({ durationSeconds, onStart, onClose }: MissionIntroOverlayProps) {
  const duration = formatDuration(durationSeconds);
  return (
    <div className="mission-overlay">
      <div className="mission-overlay__panel">
        <button type="button" className="mission-overlay__close" onClick={onClose}>
          閉じる
        </button>
        <h2 className="mission-overlay__title">{"⏱"} LUNCH RUSH</h2>
        <p className="mission-overlay__body">
          制限時間{duration}以内に
          <br />
          できるだけ多くのピザを提供しよう！
        </p>
        <button type="button" className="cta-button cta-button--primary" onClick={onStart}>
          スタート
        </button>
      </div>
    </div>
  );
}
