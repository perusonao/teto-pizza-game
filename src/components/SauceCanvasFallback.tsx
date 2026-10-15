import { Component, type ReactNode } from "react";
import type { SauceDepositLike } from "../logic/sauceField";

/**
 * Safety net for the sauce canvases (Codex P2 on PR #494). A sauce layer is a canvas; if the browser refuses a 2D context (canvas
 * memory budget) or a draw throws, the layer would otherwise be invisible while the gauge keeps draining, and an exception thrown from
 * an effect would unmount the whole app (white screen). A failed layer is shown with this instead: one soft dot per deposit, in the
 * sauce's colour -- rougher than the raster, but the sauce that was spent is visible. It carries the canvas' own class, so it sits in
 * the same box and takes the same blur / bake tint. At most 100 dots per pizza (the total cap is 2.0 at 0.02 per tick).
 */
export interface FallbackRun {
  deposits: readonly SauceDepositLike[];
  color: string;
}

export function SauceDotsFallback({ runs, className }: { runs: readonly FallbackRun[]; className?: string }) {
  return (
    <div className={className} data-sauce-fallback="true" aria-hidden="true">
      {runs.flatMap((run, r) =>
        run.deposits.map((d, i) => (
          <span
            key={`${r}-${i}`}
            style={{
              position: "absolute",
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: "16%",
              height: "16%",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              opacity: 0.5,
              background: `radial-gradient(circle closest-side, ${run.color} 35%, transparent 100%)`,
            }}
          />
        )),
      )}
    </div>
  );
}

/**
 * Catches a render- or effect-phase error from the sauce layers and shows `fallback` instead of letting it unmount the app. Renders its
 * children (no extra DOM) while nothing is wrong, so it never changes what a healthy pizza looks like.
 */
export class SauceLayersBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
