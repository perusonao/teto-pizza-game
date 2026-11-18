/**
 * Topping Visuals 2.0 / Issue #825 (Owner: parmigiano SPRINKLE Pilot): the PLACED parmigiano as a sprinkle. One tap is still one piece (count, stock, scoring, Undo and the
 * save are untouched); this component only draws that one piece as ten to fourteen thin shavings scattered over a wide field, different for every piece
 * (`sprinkleLayout`, seeded by the piece's id) and pulled inward near the rim (`sprinkleShift`) so it never spills over the crust.
 *
 * The piece's id and position are read from the stage's own wrapper (`[data-topping-id]` with its `left` / `top` percent) after the first render: the placed drawing is
 * looked up by ingredient id and is not handed the piece, and the stage (a hot file) is deliberately left alone. Outside a stage -- a bare render, a test -- there is no
 * wrapper and the sprinkle falls back to one fixed layout. The id is stable, so the same sprinkle shows on the pizza, after the bake, on both CUT halves and in RESULT.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { ParmigianoShavings } from "./ParmigianoShavings";
import { sprinkleLayout, sprinkleShift } from "./sprinkleLayout";

interface PieceKey {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

const FALLBACK_SEED = "parmigiano";

function readPiece(svg: SVGSVGElement | null): PieceKey | null {
  const host = svg?.closest<HTMLElement>("[data-topping-id]");
  if (!host) return null;
  const x = Number.parseFloat(host.style.left);
  const y = Number.parseFloat(host.style.top);
  return { id: host.dataset.toppingId ?? "", x, y };
}

function samePiece(a: PieceKey | null, b: PieceKey | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && Object.is(a.x, b.x) && Object.is(a.y, b.y);
}

export function ParmigianoSprinkle() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [piece, setPiece] = useState<PieceKey | null>(null);
  // Once, after mount: the stage keys each piece by its id, so one instance never changes pieces (the id and position of a placed piece are fixed).
  useLayoutEffect(() => {
    const next = readPiece(svgRef.current);
    setPiece((previous) => (samePiece(previous, next) ? previous : next));
  }, []);
  const layout = sprinkleLayout(piece?.id ? piece.id : FALLBACK_SEED);
  const shift = piece && Number.isFinite(piece.x) && Number.isFinite(piece.y) ? sprinkleShift(piece.x, piece.y) : undefined;
  return <ParmigianoShavings svgRef={svgRef} shavings={layout.shavings} chips={layout.chips} shift={shift} groundShadow={false} />;
}
