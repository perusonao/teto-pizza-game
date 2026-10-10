import { useEffect, useRef, useState } from "react";
import {
  bakePositionAt,
  BAKE_DURATION_S,
  BAKE_ZONE_FADE_END_S,
  clampBakeFrameDt,
  computeBakeZoneOpacity,
} from "../logic/bakeProgress";
import tetoImg from "../assets/characters/teto.webp";

interface BakeOverlayProps {
  targetStart: number;
  targetEnd: number;
  onConfirm: (value: number) => void;
  onTick?: (value: number) => void;
}

/** Issue #419: the caption never reflects raw / perfect / burnt -- the player judges by the look of
 *  the pizza. (Replaces the state-revealing M3A captions and the post-fade neutral swap.) */
const CAPTION = "見た目で焼き加減を確かめて！";

/**
 * Issue #419 (Bake Human Feel): the needle moves one way only, 0 -> 100 over `BAKE_DURATION_S`,
 * and stops at the right end -- it never returns. Position is a pure function of elapsed *active*
 * BAKE time (../logic/bakeProgress.ts), so `PizzaStage`'s continuous bake visual, which reads the
 * same value through `onTick`, cannot run backwards either.
 *
 * The Guide is only the target zone (with its raw / burnt flanks): shown for the first 3s, faded
 * out over 3-5s, then hidden for good. The track and the needle stay visible for the whole step,
 * in one neutral colour; the caption is neutral and the CTA has no glow, so nothing keeps
 * announcing the correct position after the zone is gone. The fade depends only on elapsed time,
 * never on the recipe or the needle (it is separate from CUT's guide fade, ../logic/bakeGuideFade.ts).
 *
 * Time only advances while the page is visible and focused, and one frame adds at most
 * `BAKE_MAX_FRAME_DT_S`, so returning from the background never jumps the needle. There is no
 * input lock. CONFIRM_BAKE still receives the raw 0..100 position; scoring is untouched.
 */

export function BakeOverlay({ targetStart, targetEnd, onConfirm, onTick }: BakeOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const positionRef = useRef(0);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    // Hidden and blurred are two independent pause reasons (a restored-but-unfocused window is
    // visible yet must stay paused), same as App.tsx's Cooking Time signals.
    let hidden = document.hidden;
    let blurred = false;
    let paused = hidden;

    function sync() {
      const nextPaused = hidden || blurred;
      // Coming back from any pause: the next frame measures from "now", so time away is never counted.
      if (paused && !nextPaused) last = performance.now();
      paused = nextPaused;
    }
    function handleVisibility() {
      hidden = document.hidden;
      sync();
    }
    function handleBlur() {
      blurred = true;
      sync();
    }
    function handleFocus() {
      blurred = false;
      sync();
    }

    function tick(now: number) {
      const dt = now - last;
      last = now;
      if (!paused) {
        elapsedRef.current = Math.min(BAKE_DURATION_S, elapsedRef.current + clampBakeFrameDt(dt / 1000));
        positionRef.current = bakePositionAt(elapsedRef.current);
        setElapsed(elapsedRef.current);
        onTickRef.current?.(positionRef.current);
      }
      raf = requestAnimationFrame(tick);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const position = bakePositionAt(elapsed);
  const zoneOpacity = computeBakeZoneOpacity(elapsed);

  // W1 I5b-4b: 「取り出す！」 sits in the same in-flow bottom CTA bar as PREPARE's 「焼く！」 and
  // CUT's 「切り終わる」 (`.prepare-bake-bar`), not inside this in-flow overlay under the pizza --
  // so it is always at the bottom of the visible area and never pushed off-screen by the
  // content above it (audit F-3, a timed decision).
  return (
    <>
      <div className="bake-overlay">
        <div className="bake-oven">
          <span className="bake-oven__flame">{"\u{1F525}"}</span>
          <div className="bake-oven__caption-row">
            <img className="bake-oven__caption-avatar" src={tetoImg} alt="テト" />
            <p className="bake-oven__caption">{CAPTION}</p>
          </div>
        </div>
        <div className="bake-gauge" aria-hidden="true">
          {elapsed < BAKE_ZONE_FADE_END_S && (
            <div className="bake-gauge__zones" style={{ opacity: zoneOpacity }}>
              <div className="bake-gauge__zone bake-gauge__zone--raw" style={{ width: `${targetStart}%` }} />
              <div
                className="bake-gauge__target"
                style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
              />
              <div
                className="bake-gauge__zone bake-gauge__zone--burnt"
                style={{ width: `${100 - targetEnd}%` }}
              />
            </div>
          )}
          <div className="bake-gauge__needle" style={{ left: `${position}%` }} />
        </div>
      </div>
      <div className="action-row prepare-bake-bar bake-bar">
        <button
          type="button"
          className="cta-button cta-button--bake"
          onClick={() => onConfirm(positionRef.current)}
        >
          取り出す！
        </button>
      </div>
    </>
  );
}
