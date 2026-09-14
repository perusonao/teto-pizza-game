interface MissionHudProps {
  remainingSeconds: number;
  servedCount: number;
}

/** `m:ss` countdown display. Clamped defensively even though the caller (App.tsx) already
 *  clamps via `remainingSeconds` -- this component should never render a negative time no
 *  matter what it's handed. */
function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Small always-visible strip shown only while a Lunch Rush mission is PLAYING (App.tsx) --
 *  the only Mission-specific chrome layered onto the otherwise-unchanged ORDER/PREPARE/BAKE/
 *  RESULT screens (Phase 3C-4 scope: reuse every existing screen, don't rebuild them). */
export function MissionHud({ remainingSeconds, servedCount }: MissionHudProps) {
  const isUrgent = remainingSeconds <= 10;
  return (
    <div className={`mission-hud ${isUrgent ? "mission-hud--urgent" : ""}`}>
      <span className="mission-hud__timer">
        {"⏱"} {formatClock(remainingSeconds)}
      </span>
      <span className="mission-hud__served">{"\u{1F355}"} {servedCount}</span>
    </div>
  );
}
