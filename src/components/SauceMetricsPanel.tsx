import { useState } from "react";
import type { ReferenceSauce } from "../data/referencePizza";
import type { SauceMetrics } from "../logic/sauceField";
import type { SauceReferenceShadowScore } from "../logic/referenceScoring";
import type { PieceReferenceMetrics } from "../logic/referenceMatching";
import {
  deriveSauceLiveMessage,
  evaluateSauceForPlayer,
  SAUCE_TIER_SYMBOL,
  type SauceTier,
} from "../logic/sauceEvaluation";

interface SauceMetricsPanelProps {
  metrics: SauceMetrics;
  shadowScore: SauceReferenceShadowScore;
  /** Human Feel Fix 2: the player-facing 広さ/均一さ/ふち tiers and the live message are both
   *  derived from `metrics` against this target (see ../logic/sauceEvaluation.ts). */
  reference: ReferenceSauce;
  /** Human Feel Fix 2 brief section 4: the live message shows only *while painting* --
   *  App.tsx derives this from whether a dispense session currently has any buffered
   *  deposits (`pendingSauceDeposits.length > 0`), the same signal that already drives the
   *  live-updating `metrics` themselves. */
  isDispensing?: boolean;
  pieceMetrics?: readonly PieceReferenceMetrics[];
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function TierValue({ tier }: { tier: SauceTier }) {
  return (
    <strong className={`sauce-metrics-panel__tier sauce-metrics-panel__tier--${tier}`}>
      {SAUCE_TIER_SYMBOL[tier]}
    </strong>
  );
}

/**
 * Human Feel Fix 2 (Sauce Painting Visual/Scoring Discoverability): the player-facing part of
 * this panel is now three tiers -- 広さ/均一さ/ふち (../logic/sauceEvaluation.ts) -- plus a
 * short live message while painting. The original Quantity/Coverage/Evenness/Overflow
 * percentages (plus the shadow-similarity readout) move into the same "開発用" expandable
 * detail the shadow score already lived behind, rather than being deleted -- still there for
 * debugging, just no longer what a player sees by default.
 *
 * Everything here remains explicitly shadow/QA-facing in the sense that follows
 * ../logic/referenceScoring.ts's file header: none of it is the player's actual ★ score.
 * Shown only during Margherita FREE PREPARE (App.tsx's `referenceModeEnabled`).
 */
export function SauceMetricsPanel({
  metrics,
  shadowScore,
  reference,
  isDispensing = false,
  pieceMetrics = [],
}: SauceMetricsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const evaluation = evaluateSauceForPlayer(metrics, reference);
  const liveMessage = isDispensing ? deriveSauceLiveMessage(metrics, reference) : null;

  return (
    <div className="sauce-metrics-panel">
      <div className="sauce-metrics-panel__player-row">
        <span className="sauce-metrics-panel__player-heading">ソースのでき</span>
        <span className="sauce-metrics-panel__player-chip">
          広さ <TierValue tier={evaluation.coverageTier} />
        </span>
        <span className="sauce-metrics-panel__player-chip">
          均一さ <TierValue tier={evaluation.evennessTier} />
        </span>
        <span className="sauce-metrics-panel__player-chip">
          ふち <TierValue tier={evaluation.edgeTier} />
        </span>
      </div>

      {/* Exactly one short line, replaced wholesale every render -- never stacked with a
          previous message (brief section 4: "常時文章を大量表示せず、短い1メッセージのみ"). */}
      {liveMessage && <p className="sauce-metrics-panel__live-message">{liveMessage}</p>}

      <button
        type="button"
        className="sauce-metrics-panel__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {"\u{1F9EA}"} Prototype Metrics（開発用） {expanded ? "▴" : "▾"}
      </button>

      {expanded && (
        <div className="sauce-metrics-panel__detail">
          <p className="sauce-metrics-panel__detail-note">
            以下は内部の生の数値と、見本との近さを試験的に見るだけの参考値です。★やスコアには反映されません。
          </p>
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
            <span
              className={`sauce-metrics-panel__chip ${
                metrics.edgeRatio > 0 ? "sauce-metrics-panel__chip--warn" : ""
              }`}
            >
              ふち量 <strong>{percent(metrics.edgeRatio)}</strong>
            </span>
          </div>
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
