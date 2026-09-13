import { useEffect, useRef, useState } from "react";

interface BakeOverlayProps {
  targetStart: number;
  targetEnd: number;
  onConfirm: (value: number) => void;
}

const SPEED = 55; // percent per second

export function BakeOverlay({ targetStart, targetEnd, onConfirm }: BakeOverlayProps) {
  const [position, setPosition] = useState(0);
  const directionRef = useRef(1);
  const positionRef = useRef(0);

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
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const inTarget = position >= targetStart && position <= targetEnd;

  return (
    <div className="bake-overlay">
      <div className="bake-oven">
        <span className="bake-oven__flame">{"\u{1F525}"}</span>
        <p className="bake-oven__caption">焼いています…</p>
      </div>
      <div className="bake-gauge">
        <div
          className="bake-gauge__target"
          style={{ left: `${targetStart}%`, width: `${targetEnd - targetStart}%` }}
        />
        <div className="bake-gauge__needle" style={{ left: `${position}%` }} />
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
