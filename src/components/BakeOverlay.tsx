import { useEffect, useRef, useState } from "react";
import { classifyBake, type BakeState } from "../logic/bake";

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

const NEEDLE_COLOR: Record<BakeState, string> = {
  raw: "#5b8bd6",
  perfect: "#b3260a",
  burnt: "#241209",
};

export function BakeOverlay({ targetStart, targetEnd, onConfirm, onTick }: BakeOverlayProps) {
  const [position, setPosition] = useState(0);
  const directionRef = useRef(1);
  const positionRef = useRef(0);
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
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const target = { start: targetStart, end: targetEnd };
  const bakeState = classifyBake(position, target);
  const inTarget = bakeState === "perfect";

  return (
    <div className="bake-overlay">
      <div className="bake-oven">
        <span className="bake-oven__flame">{"\u{1F525}"}</span>
        <p className="bake-oven__caption">{CAPTION[bakeState]}</p>
      </div>
      <div className="bake-gauge">
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
      <button
        type="button"
        className={`cta-button cta-button--bake ${inTarget ? "cta-button--glow" : ""}`}
        onClick={() => onConfirm(positionRef.current)}
      >
        取り出す！
      </button>
    </div>
  );
}
