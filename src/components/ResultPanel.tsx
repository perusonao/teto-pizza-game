import type { ScoreBreakdown } from "../logic/scoring";
import { BAKE_STATE_LABEL, type BakeState } from "../logic/bake";
import type { PitzCredit } from "../logic/pitzReward";
import { EFFICIENCY_TIER_LABEL_JA, formatCookingTime, type CookingEfficiencyCredit } from "../logic/efficiency";
import type { StarterGrantNotice } from "../state/starterStock";
import type { PizzaCompletionResult } from "../logic/completionGate";
import { buildCompletionFailureMessage } from "../data/completionMessages";
import type { CutEvaluation } from "../logic/cut/types";

interface ResultPanelProps {
  /** Completion Gate Phase 1: when this is `{ status: "FAILED" }`, every prop below except
   *  `bakeState`/`onRetrySameRecipe`/`onBackToPizzaSelect` is ignored -- a FAILED round never
   *  has a real score/stars/Pitz/Dex outcome to show (see ../logic/completionGate.ts and the
   *  Result Report's RESULT UI section). `null` only for a Mission round (which never renders
   *  this component -- GameScreen's own `!isMissionActive` gate), same as `pitzCredit`. */
  completion: PizzaCompletionResult | null;
  score: ScoreBreakdown;
  bakeState: BakeState | null;
  /** A1 Authority Cutover: Scoring 2.0's Sauce component score (0-100), Scoring 2.0's single
   *  heaviest component (52/100) and the one dimension `ScoreBreakdown` itself has no field
   *  for (see ../logic/scoringV2/toLegacyScoreBreakdown.ts's file header). Read straight from
   *  `state.scoringV2Result.components.sauce` at the call site rather than folded into any of
   *  `score`'s four legacy fields, so it is never silently discarded from player-facing
   *  feedback. `null` only when Scoring 2.0 itself came back unavailable (should not happen
   *  for any of the 7 shipped recipes -- see the adapter's own fallback contract) -- the row is
   *  simply omitted in that case rather than showing a fabricated number. */
  sauceScore: number | null;
  /** RESULT 2.0 Slice 1: a single short verdict line (GameScreen's own `buildTetoResultLine`
   *  output, textJa only -- no portrait/bubble chrome here) shown directly under the
   *  completed-pizza hero, replacing the two-portrait DialogueBox stack that used to sit
   *  above the pizza. Kept as a plain prop (not computed in here) so this component stays a
   *  presentation-only reader of already-derived state, same discipline as `score`/`bakeState`. */
  headingJa: string;
  recipeNameJa: string;
  /** True when REGISTER_TO_DEX (now auto-applied at CONFIRM_BAKE time, see App.tsx's
   *  `handleConfirmBake`) just discovered this recipe for the first time. Mutually exclusive
   *  with `justGotNewBest` (../state/gameReducer.ts), so at most one banner ever renders. */
  justDiscovered: boolean;
  justGotNewBest: boolean;
  /** Issue #38 E-P1/E-P2's per-pizza Pitz credit snapshot (`state.lastPitzCredit`) -- `null`
   *  only for a Mission round, which never renders this component at all (see GameScreen's
   *  `!isMissionActive` gate), so in practice this is always non-null here. */
  pitzCredit: PitzCredit | null;
  /** Cooking Time CT2 (`state.lastEfficiencyCredit`): the "手際" (Efficiency) secondary
   *  evaluation snapshot -- `null`/omitted under the exact same conditions as `pitzCredit`
   *  (Mission round; never both null/non-null independently in practice for a FREE round that
   *  reached RESULT). Optional (unlike `pitzCredit`) purely so this component's existing test
   *  call sites that predate CT2 keep compiling unchanged -- omitting it behaves exactly like
   *  `null`, no efficiency rows rendered. Deliberately rendered as a smaller, secondary block
   *  below the quality-driven headline/`pitzCredit` summary -- quality stays the visual lead,
   *  per the task's own "品質が主役、手際は副評価" instruction. */
  efficiencyCredit?: CookingEfficiencyCredit | null;
  /** Economy Tuning 1 P1 (`state.lastStarterGrantNotice`): non-null only the instant this
   *  round's REGISTER_TO_DEX actually granted a recipe's Starter Grant -- never shown for
   *  margherita (never granted), an already-claimed recipe, or a reload/replay (transient,
   *  reset every fresh round, see ../state/gameReducer.ts's own doc comment for the field). */
  starterGrantNotice: StarterGrantNotice | null;
  /** Pizza Cutting 1.0 Phase 3 (docs/design/TETO_PIZZA-CUTTING_1.0.md §14 Option D): the CUT
   *  step's own standalone evaluation preview, read directly from `state.cutState.evaluation`
   *  (GameScreen.tsx). `null`/`undefined` for every one of the 14 recipes whose profile never
   *  includes CUT, and for any round that hasn't confirmed CUT yet -- this block simply omits
   *  itself in either case (never a fabricated/zero CUT row), matching `sauceScore`'s own
   *  "omit, don't fabricate" convention above. Optional purely so this component's existing
   *  test call sites that predate Phase 3 keep compiling unchanged, same discipline as
   *  `efficiencyCredit`. Never folded into `score.total` -- standalone display only, per the
   *  design doc's own explicit non-goal for CUT Phase 1-3. */
  cutEvaluation?: CutEvaluation | null;
  /** Issue #47 Finding D: retries this exact recipe (RETRY_SAME_RECIPE). */
  onRetrySameRecipe: () => void;
  /** Issue #47 Finding D: returns to Pizza Select so the player can choose a different recipe. */
  onBackToPizzaSelect: () => void;
}

const MAX_STARS = 5;

const BAKE_STATE_ICON: Record<BakeState, string> = {
  raw: "\u{1F4A7}",
  perfect: "✅",
  burnt: "\u{1F525}",
};

/**
 * Small feedback rows shown under the headline stars/score. "具材" blends recipe-required-
 * ingredient presence and purity (the two ingredient-related legacy fields) into one number
 * for display purposes only — ScoreBreakdown itself keeps them separate for scoring and
 * testing. "ソース" (Sauce) is intentionally not part of this table -- `ScoreBreakdown` has no
 * field for it (see `sauceScore` prop above), so it is rendered as its own row below instead.
 */
function ingredientFeedbackScore(score: ScoreBreakdown): number {
  return score.matchScore * 0.7 + score.ingredientScore * 0.3;
}

const FEEDBACK_ROWS: Array<{ key: string; label: string; value: (score: ScoreBreakdown) => number }> = [
  { key: "ingredients", label: "具材", value: ingredientFeedbackScore },
  { key: "placement", label: "配置", value: (score) => score.placementScore },
  { key: "bake", label: "焼き", value: (score) => score.bakeScore },
];

/**
 * RESULT 2.0 Slice 1: the merged RESULT+DISCOVERED screen for a FREE round (Lunch Rush is
 * unaffected -- see MissionServePanel/MissionResultOverlay). Used to be two components
 * (`ResultPanel`'s score/stars-only card, then a separate DISCOVERED-only JSX block in
 * GameScreen.tsx behind a "レシピ図鑑に登録する" tap) -- REGISTER_TO_DEX's Dex/BEST/Pitz side
 * effects now apply automatically the instant CONFIRM_BAKE lands (App.tsx's
 * `handleConfirmBake`, reducer guard/atomicity unchanged), so there is no longer a
 * player-visible intermediate "score only, not yet registered" screen to render separately.
 * Rendered below the always-present `PizzaStage` hero (GameScreen.tsx), so the player's own
 * completed pizza is already the first thing on screen before any of this.
 */
export function ResultPanel({
  completion,
  score,
  bakeState,
  sauceScore,
  headingJa,
  recipeNameJa,
  justDiscovered,
  justGotNewBest,
  pitzCredit,
  efficiencyCredit,
  starterGrantNotice,
  cutEvaluation,
  onRetrySameRecipe,
  onBackToPizzaSelect,
}: ResultPanelProps) {
  // Completion Gate Phase 1: a FAILED round gets its own small, distinct card -- reusing the
  // same outer structure/CTAs as the PASS branch below (per the Result Report's RESULT UI
  // section: "reuse the RESULT structure, don't build new UI"), but never the stars/score/
  // Dex/Pitz-credit markup, so a FAILED pizza can never be misread as a normal ★1 result.
  if (completion?.status === "FAILED") {
    const failureMessage = buildCompletionFailureMessage(completion);
    return (
      <div className="result-panel result-panel--failed">
        <p className="result-panel__heading result-panel__heading--failed">失敗</p>
        <div className="result-panel__headline">
          <p className="result-panel__failed-reason" role="alert">
            {failureMessage}
          </p>
          {bakeState && (
            <p className={`result-panel__bake-badge result-panel__bake-badge--${bakeState}`}>
              {BAKE_STATE_ICON[bakeState]} 焼き加減: {BAKE_STATE_LABEL[bakeState]}
            </p>
          )}
        </div>

        <div className="pitz-credit-summary pitz-credit-summary--failed">
          <p className="pitz-credit-summary__headline">
            今回の獲得 <strong>+0 Pitz</strong>
          </p>
          <p className="pitz-credit-summary__zero-note">
            今回は料理として成立しなかったため、提供できませんでした。
          </p>
        </div>

        <div className="action-row action-row--column result-panel__actions">
          <button
            type="button"
            className="cta-button cta-button--primary"
            onClick={onRetrySameRecipe}
          >
            もう一度つくる
          </button>
          <button
            type="button"
            className="cta-button cta-button--secondary"
            onClick={onBackToPizzaSelect}
          >
            別のピザを作る
          </button>
        </div>
      </div>
    );
  }

  const filledStars = "★".repeat(score.stars);
  const emptyStars = "☆".repeat(MAX_STARS - score.stars);

  return (
    <div className="result-panel">
      <p className="result-panel__heading">{headingJa}</p>

      <div className="result-panel__headline">
        <div
          className="result-panel__stars"
          role="img"
          aria-label={`星${score.stars}個 / 5個`}
        >
          {filledStars}
          <span className="result-panel__stars-empty" aria-hidden="true">
            {emptyStars}
          </span>
        </div>
        <div className="result-panel__score">{Math.round(score.total)}点</div>
        {bakeState && (
          <p className={`result-panel__bake-badge result-panel__bake-badge--${bakeState}`}>
            {BAKE_STATE_ICON[bakeState]} 焼き加減: {BAKE_STATE_LABEL[bakeState]}
          </p>
        )}
      </div>

      {(justDiscovered || justGotNewBest) && (
        <p
          className={`discovered-banner${justGotNewBest ? " discovered-banner--best" : ""}`}
          aria-live="polite"
        >
          {justDiscovered
            ? `✨ ${recipeNameJa}を発見しました！`
            : `\u{1F31F} NEW BEST!`}
        </p>
      )}

      {starterGrantNotice && (
        <p className="starter-grant-notice" aria-live="polite">
          {starterGrantNotice.messageJa}
        </p>
      )}

      {/* Gameplay UX PR-D (RESULT 1-Screen 2.0, Fresh Audit §6): the Pitz breakdown `<dl>` used
          to render unconditionally expanded -- real Chromium measurement found it RESULT's own
          largest single always-visible content block (~156px). Tier 1 keeps only the headline
          number (already the player's main payoff for this card); the itemized breakdown moves
          into a native `<details>`, mirroring the exact convention `.result-panel__details`/
          `.cut-evaluation-summary` already use elsewhere on this same screen. No reward
          calculation touched -- display only. */}
      {pitzCredit && (
        <div className="pitz-credit-summary">
          <p className="pitz-credit-summary__headline">
            今回の獲得{" "}
            <strong>+{pitzCredit.earnedPitz + (efficiencyCredit?.bonusPitz ?? 0)} Pitz</strong>
          </p>
          <details className="pitz-credit-summary__breakdown">
            <summary className="pitz-credit-summary__breakdown-summary">内訳を見る</summary>
            <dl className="pitz-credit-summary__details">
              <div className="pitz-credit-summary__row">
                <dt>基本報酬</dt>
                <dd>{pitzCredit.baseReward} Pitz</dd>
              </div>
              <div className="pitz-credit-summary__row">
                <dt>出来栄え倍率</dt>
                <dd>×{pitzCredit.multiplier.toFixed(2)}</dd>
              </div>
              {/* Cooking Time CT2: 調理時間/手際 are display-only rows, deliberately styled
                  identically (and just as small) as 基本報酬/出来栄え倍率 above -- quality's own
                  stars/score headline stays the only visually prominent number on this screen. */}
              {efficiencyCredit && (
                <div className="pitz-credit-summary__row">
                  <dt>調理時間</dt>
                  <dd>{formatCookingTime(efficiencyCredit.cookingTimeMs)}</dd>
                </div>
              )}
              {efficiencyCredit && (
                <div className="pitz-credit-summary__row">
                  <dt>手際</dt>
                  <dd>{EFFICIENCY_TIER_LABEL_JA[efficiencyCredit.tier]}</dd>
                </div>
              )}
              {efficiencyCredit && efficiencyCredit.bonusPitz > 0 && (
                <div className="pitz-credit-summary__row">
                  <dt>手際ボーナス</dt>
                  <dd>+{efficiencyCredit.bonusPitz} Pitz</dd>
                </div>
              )}
              <div className="pitz-credit-summary__row">
                <dt>所持Pitz</dt>
                <dd>
                  {pitzCredit.balanceBefore} {"→"} {pitzCredit.balanceAfter + (efficiencyCredit?.bonusPitz ?? 0)}
                </dd>
              </div>
            </dl>
          </details>
          {pitzCredit.earnedPitz === 0 && (
            <p className="pitz-credit-summary__zero-note">
              出来栄えが基準に届かず、今回はPitzを獲得できませんでした。
            </p>
          )}
        </div>
      )}

      {/* Visual Polish 2.0C P1-5 Option B (Fresh Audit §10): collapsed behind native <details>,
          mirroring `.result-panel__details` below -- previously rendered unconditionally
          expanded, the single largest content-driven contributor to RESULT's primary CTA
          sitting below the fold on every CUT round (Fresh Audit §5). The headline (score) stays
          on the always-visible <summary> so the player's main payoff number needs no tap;
          slices/disclaimer/per-metric breakdown move into the collapsed body. No score/CUT
          calculation touched -- display only. */}
      {cutEvaluation && (
        <details className="cut-evaluation-summary">
          <summary className="cut-evaluation-summary__summary">
            {"✂️"} カット <strong>{Math.round(cutEvaluation.cutScore)}点</strong>
          </summary>
          <div className="cut-evaluation-summary__content">
            <p className="cut-evaluation-summary__slices">
              {cutEvaluation.actualPieceCount}等分
              {cutEvaluation.actualPieceCount !== cutEvaluation.requestedSliceCount
                ? `（目標 ${cutEvaluation.requestedSliceCount}等分）`
                : ""}
            </p>
            {/* Pizza Cutting 1.0 Phase 4A (Phase 4 Fresh Audit §11): a one-line disclaimer so a
                high CUT score sitting next to a lower overall score (e.g. "カット100点" beside
                "総合59点") never reads as a bug -- CUT is still its own standalone evaluation
                (design doc §14 Option D), not yet folded into `score.total`. Copy-only, no
                score/star/weight change. */}
            <p className="cut-evaluation-summary__note">※総合スコアとは別の評価です</p>
            <dl className="cut-evaluation-summary__details">
              <div className="cut-evaluation-summary__row">
                <dt>均等さ</dt>
                <dd>{Math.round(cutEvaluation.uniformity * 100)}</dd>
              </div>
              <div className="cut-evaluation-summary__row">
                <dt>中心</dt>
                <dd>{Math.round(cutEvaluation.centerAccuracy * 100)}</dd>
              </div>
              <div className="cut-evaluation-summary__row">
                <dt>切り分け</dt>
                <dd>{Math.round(cutEvaluation.completeness * 100)}</dd>
              </div>
            </dl>
          </div>
        </details>
      )}

      <details className="result-panel__details">
        <summary className="result-panel__details-summary">くわしいスコアを見る</summary>
        <div className="result-panel__bars">
          {sauceScore !== null && (
            <div className="score-bar">
              <span className="score-bar__label">ソース</span>
              <div className="score-bar__track">
                <div className="score-bar__fill" style={{ width: `${Math.round(sauceScore)}%` }} />
              </div>
              <span className="score-bar__value">{Math.round(sauceScore)}</span>
            </div>
          )}
          {FEEDBACK_ROWS.map((row) => (
            <div key={row.key} className="score-bar">
              <span className="score-bar__label">{row.label}</span>
              <div className="score-bar__track">
                <div
                  className="score-bar__fill"
                  style={{ width: `${Math.round(row.value(score))}%` }}
                />
              </div>
              <span className="score-bar__value">{Math.round(row.value(score))}</span>
            </div>
          ))}
        </div>
      </details>

      <div className="action-row action-row--column result-panel__actions">
        <button
          type="button"
          className="cta-button cta-button--primary"
          onClick={onRetrySameRecipe}
        >
          もう一度つくる
        </button>
        <button
          type="button"
          className="cta-button cta-button--secondary"
          onClick={onBackToPizzaSelect}
        >
          別のピザを作る
        </button>
      </div>
    </div>
  );
}
