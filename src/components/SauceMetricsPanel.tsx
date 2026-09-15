import { useState } from "react";
import type { SauceMetrics } from "../logic/sauceField";
import type { SauceReferenceShadowScore } from "../logic/referenceScoring";
import type { PieceReferenceMetrics } from "../logic/referenceMatching";

interface SauceMetricsPanelProps {
  metrics: SauceMetrics;
  shadowScore: SauceReferenceShadowScore;
  pieceMetrics?: readonly PieceReferenceMetrics[];
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Phase 4A-1A Prototype Metrics panel: Quantity / Coverage / Evenness / Overflow for the
 * player's tomato sauce, plus an optional shadow-only similarity readout. Shown only during
 * Margherita FREE PREPARE (App.tsx's `referenceModeEnabled`).
 *
 * Explicitly dev/QA-facing (labeled 開発用), not part of the authoritative result screen --
 * none of these numbers are the player's actual score. See ../logic/referenceScoring.ts's
 * file header for why the shadow score can never become one without an explicit Phase
 * 4A-1B change.
 */
export function SauceMetricsPanel({ metrics, shadowScore, pieceMetrics = [] }: SauceMetricsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sauce-metrics-panel">
      <button
        type="button"
        className="sauce-metrics-panel__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {"\u{1F9EA}"} Prototype Metrics（開発用） {expanded ? "▴" : "▾"}
      </button>

      <div className="sauce-metrics-panel__row">
        <span className="sauce-metrics-panel__chip">
          量 <strong>{percent(metrics.quantity)}</strong>
        </span>
        <span className="sauce-metrics-panel__chip">
          被覆 <strong>{percent(metrics.coverage)}</strong>
        </span>
        <span className="sauce-metrics-panel__chip">
          均一性 <strong>{percent(metrics.evenness)}</strong>
        </span>
        <span
          className={`sauce-metrics-panel__chip ${
            metrics.overflowRatio > 0 ? "sauce-metrics-panel__chip--warn" : ""
          }`}
        >
          はみ出し <strong>{percent(metrics.overflowRatio)}</strong>
        </span>
      </div>

      {expanded && (
        <div className="sauce-metrics-panel__detail">
          <p className="sauce-metrics-panel__detail-note">
            以下は見本との近さを試験的に見るだけの参考値で、★やスコアには反映されません。
          </p>
          <div className="sauce-metrics-panel__row">
            <span className="sauce-metrics-panel__chip">
              量の近さ <strong>{percent(shadowScore.quantitySimilarity)}</strong>
            </span>
            <span className="sauce-metrics-panel__chip">
              広さの近さ <strong>{percent(shadowScore.coverageSimilarity)}</strong>
            </span>
            <span className="sauce-metrics-panel__chip">
              総合 <strong>{percent(shadowScore.overall)}</strong>
            </span>
          </div>
          {pieceMetrics.map((piece) => (
            <div className="sauce-metrics-panel__row" key={piece.ingredientId}>
              <span className="sauce-metrics-panel__chip">
                {piece.ingredientId === "mozzarella" ? "モッツァレラ" : "バジル"} 個数{" "}
                <strong>{piece.playerCount}/{piece.targetCount}</strong>
              </span>
              <span className="sauce-metrics-panel__chip">
                量の近さ <strong>{percent(piece.quantitySimilarity)}</strong>
              </span>
              <span className="sauce-metrics-panel__chip">
                配置の近さ{" "}
                <strong>{piece.placementSimilarity === null ? "未評価" : percent(piece.placementSimilarity)}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
