import { useEffect, useRef, useState } from "react";
import { classifyBake, type BakeState } from "../logic/bake";
import { computeGuideOpacity, GUIDE_FADE_END_S } from "../logic/bakeGuideFade";
import tetoImg from "../assets/characters/teto.webp";

interface BakeOverlayProps {
  targetStart: number;
  targetEnd: number;
  onConfirm: (value: number) => void;
  onTick?: (value: number) => void;
}

const SPEED = 55; // percent per second

const CAPTION: Record<BakeState, string> = {
  raw: "まだ生っぽいね…もう少し！",
  perfect: "香ばしいにおい！今がチャンス！",
  burnt: "ちょっと焦げてきたかも！？",
};

/** M3A Bake Judgment Phase 1: shown once the Guide (gauge + state-revealing caption below) has
 *  fully faded out -- deliberately not derived from `bakeState`, so it never leaks under/good/
 *  over the way `CAPTION` above does. */
const CAPTION_NEUTRAL = "見た目で焼き加減を確かめて！";

const NEEDLE_COLOR: Record<BakeState, string> = {
  raw: "#5b8bd6",
  perfect: "#b3260a",
  burnt: "#241209",
};

/**
 * M3A Bake Judgment Phase 1: the Guide (this gauge -- target zone, raw/burnt zones, the needle's
 * own state color, and the state-revealing caption text) is a hint layer, kept fully separate
 * from Scoring 2.0's bake evaluation (../logic/scoringV2/bakeComponent.ts, ../logic/bake.ts's
 * `classifyBake`) -- CONFIRM_BAKE always scores the raw needle position (`positionRef.current`
 * via `onConfirm`) exactly as before; nothing here ever changes what a given tap is worth (see
 * the Fresh Audit, docs/reports/TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md section 3).
 *
 * The Guide fades out over elapsed *BAKE-phase* time (accumulated from this component's own
 * rAF tick loop, not wall-clock `Date.now()`), deliberately not from the needle's proximity to
 * `targetStart`/`targetEnd` -- fade timing must never itself become a second "you're close"
 * tell (brief: "Scoringのgood/perfect境界そのものをfade timingとして直接公開しないこと"). Because
 * the accumulator only advances inside a real rAF callback, a backgrounded tab (which browsers
 * throttle/pause rAF for) effectively pauses the fade too, the same fairness property the
 * needle's own position already had -- see the Fresh Audit's Phase 4 timer fairness section.
 * The actual curve (`computeGuideOpacity`) lives in ../logic/bakeGuideFade.ts, split out only
 * so this component file can keep exporting nothing but the component itself.
 */

export function BakeOverlay({ targetStart, targetEnd, onConfirm, onTick }: BakeOverlayProps) {
  const [position, setPosition] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const directionRef = useRef(1);
  const positionRef = useRef(0);
  const elapsedRef = useRef(0);
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });

  useEffect(() => {
    let raf: number;
    let last = performance.now();

    function tick(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      let next = positionRef.current + directionRef.current * SPEED * dt;
      if (next >= 100) {
        next = 100;
        directionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        directionRef.current = 1;
      }
      positionRef.current = next;
      setPosition(next);
      onTickRef.current?.(next);

      if (elapsedRef.current < GUIDE_FADE_END_S) {
        elapsedRef.current += dt;
        setElapsed(elapsedRef.current);
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const target = { start: targetStart, end: targetEnd };
  const bakeState = classifyBake(position, target);
  const inTarget = bakeState === "perfect";
  const guideOpacity = computeGuideOpacity(elapsed);
  const guideHidden = guideOpacity <= 0;
  // Fresh Audit finding (section 3): the CTA's own glow is *also* part of the Guide -- without
  // gating it the same way, it would keep revealing "you're in the target zone right now" via
  // box-shadow (which can't fade like opacity can) even after the gauge/caption above are
  // fully hidden, silently defeating the whole fade. Tied to the same `guideOpacity > 0` window
  // the rest of the Guide uses, so it goes dark at exactly the same moment.
  const showGlow = inTarget && guideOpacity > 0;

  // W1 I5b-4b: 「取り出す！」 sits in the same in-flow bottom CTA bar as PREPARE's 「焼く！」 and
  // CUT's 「切り終わる」 (`.prepare-bake-bar`), not inside this in-flow overlay under the pizza --
  // so it is always at the bottom of the visible area and never pushed off-screen by the
  // content above it (audit F-3, a timed decision).
  return (
    <>
      <div className="bake-overlay">
        <div className="bake-oven">
          <span className="bake-oven__flame">{"\u{1F525}"}</span>
          <div className="bake-oven__caption-row" style={{ opacity: guideHidden ? 1 : guideOpacity }}>
            <img className="bake-oven__caption-avatar" src={tetoImg} alt="テト" />
            <p className="bake-oven__caption">{guideHidden ? CAPTION_NEUTRAL : CAPTION[bakeState]}</p>
          </div>
        </div>
        <div className="bake-gauge" aria-hidden="true" style={{ opacity: guideOpacity }}>
          <div className="bake-gauge__zone bake-gauge__zone--raw" style={{ width: `${targetStart}%` }} />
          <div
            className="bake-gauge__target"
            style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
          />
          <div
            className="bake-gauge__zone bake-gauge__zone--burnt"
            style={{ width: `${100 - targetEnd}%` }}
          />
          <div
            className="bake-gauge__needle"
            style={{ left: `${position}%`, backgroundColor: NEEDLE_COLOR[bakeState] }}
          />
        </div>
      </div>
      <div className="action-row prepare-bake-bar bake-bar">
        <button
          type="button"
          className={`cta-button cta-button--bake ${showGlow ? "cta-button--glow" : ""}`}
          onClick={() => onConfirm(positionRef.current)}
        >
          取り出す！
        </button>
      </div>
    </>
  );
}
