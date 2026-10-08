import type { ScoreBreakdown } from "../logic/scoring";
import { BAKE_STATE_LABEL, type BakeState } from "../logic/bake";
import type { PitzCredit } from "../logic/pitzReward";
import { EFFICIENCY_TIER_LABEL_JA, formatCookingTime, type CookingEfficiencyCredit } from "../logic/efficiency";
import type { StepTimingRow } from "../logic/cookingTimingDisplay";
import { MATERIAL_UNLOCK_NOTICE_LEAD_JA, type MaterialUnlockNotice } from "../state/materialEntitlement";
import type { PizzaCompletionResult } from "../logic/completionGate";
import { buildCompletionFailureMessage } from "../data/completionMessages";
import type { CutEvaluation } from "../logic/cut/types";
import { STEP_LABEL } from "../data/makingStepLabels";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { getIngredient } from "../data/ingredients";
import { IngredientGlyph } from "./IngredientGlyph";
import { duplicateTrialNoticeJa, ORIGINAL_LEAD_COPY, originalResultKind } from "../state/originalResultCopy";
import type { ResultNearMissLine } from "../state/resultNearMiss";
import type { PostDiscoveryPrimary } from "../logic/discovery/postDiscoveryPrimary";
import type { ResearchResultCategory, ResearchResultRow } from "../logic/discovery/researchResultRows";
import { RESEARCH_UX_COPY } from "./researchUxCopy";
import { ResearchLabel } from "./ResearchLabel";
import type { TechniqueId } from "../data/techniques";
import { TechniqueReveal } from "./TechniqueReveal";
import { useRevealOpenedResultDetail } from "./revealOpenedResultDetail";

interface ResultPanelProps {
  /** Completion Gate Phase 1: when this is `{ status: "FAILED" }`, every prop below except
   *  `bakeState`/`onRetrySameRecipe`/`onBackToPizzaSelect` is ignored -- a FAILED round never
   *  has a real score/stars/Pitz/Dex outcome to show (see ../logic/completionGate.ts and the
   *  Result Report's RESULT UI section). `null` only for a Mission round (which never renders
   *  this component -- GameScreen's own `!isMissionActive` gate), same as `pitzCredit`. */
  completion: PizzaCompletionResult | null;
  /** `null` only for an unmatched free-cook pizza (Progression 2.0 Phase 3-2): an ORIGINAL pizza
   *  is never scored, so it renders the original-pizza card instead of stars/score. */
  score: ScoreBreakdown | null;
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
  /** Gameplay UX PR-C (Timing Transparency, see
   *  docs/reports/TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md Audit C): already-derived
   *  (`../logic/cookingTimingDisplay.ts`'s `stepTimingRows`) per-step elapsed-time rows for the
   *  RESULT Timing Detail table -- this component stays a presentation-only reader, same
   *  discipline as `sauceScore`/`cutEvaluation` above. Empty array (the default) or omitted
   *  renders no Timing Detail `<details>` at all -- never a fabricated empty table. Only ever
   *  non-empty alongside a non-null `efficiencyCredit` (both come from the same FREE-round
   *  `cookingTiming`/`cookingProfile` state; Mission rounds have neither and never render this
   *  component). */
  stepTimingRows?: readonly StepTimingRow[];
  /** Progression 2.0 I4b-4 (`state.lastMaterialUnlockNotice`, REC-04 OD-REC04-2): non-null only
   *  the instant this round's REGISTER_TO_DEX unlocked new Discovery Ladder materials for the
   *  Shop. Transient (reset every fresh round), never re-shown on reload/replay. Replaces EP4's
   *  retired Starter Grant notice: nothing is given for free -- the material is now buyable. */
  materialUnlockNotice?: MaterialUnlockNotice | null;
  /** Opens the Shop overlay from the NEW MATERIAL notice (App.tsx's own `setShopOpen`, the same
   *  global overlay HOME opens). The notice renders no CTA when this is absent. */
  onOpenShop?: () => void;
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
  /** Progression 2.0 Phase 3-2 (Issue #194): set for a free-cook round. Changes the CTA copy
   *  (retry = cook freely again) and, together with `discovery`, what the card says the pizza
   *  turned out to be: NEW (first match of a registered recipe), KNOWN (already discovered) or
   *  ORIGINAL (no registered recipe; `score` is null). */
  freeCook?: boolean;
  /** `state.lastDiscovery` -- read only when `freeCook` is set. */
  discovery?: DiscoveryOutcome | null;
  /** Distinct ingredient ids on the finished pizza (sauce first), shown on the ORIGINAL card. */
  usedIngredientIds?: readonly string[];
  /** Issue #215: ../data/quantityMessages.ts's `buildQuantityNote` line ("…がお手本より少なめ
   *  （2個／お手本3個）"), shown under the score when Scoring 2.0's quantity factor applied.
   *  Omitted/null renders nothing. */
  quantityNoteJa?: string | null;
  /** Issue #47 Finding D: retries this exact recipe (RETRY_SAME_RECIPE). */
  onRetrySameRecipe: () => void;
  /** Issue #47 Finding D: returns to Pizza Select so the player can choose a different recipe. */
  onBackToPizzaSelect: () => void;
  /** Progression 2.0 W1-d: where the just-discovered recipe landed in the Dex (canonical
   *  chapter, fixed No. inside it, chapter progress after this discovery). Shown only on a
   *  NEW_DISCOVERY result. */
  dexRegistration?: { slot: number; chapterTitleJa: string; discovered: number; total: number } | null;
  /** Progression 2.0 W1-d: opens the Dex (on the registration row, never in the bottom bar). */
  onOpenDex?: () => void;
  /** Discovery Hint 2.0 (#229 229-C): the one generic "おしい" line (../state/resultNearMiss.ts),
   *  already decided for this result -- never a recipe or an ingredient. */
  nearMiss?: ResultNearMissLine | null;
  /** P3-3b (OD-P3-19): the stable attempt number of an earlier identical ORIGINAL attempt (the P3-3a record result),
   *  or `null`. Shown only on the ORIGINAL card, after the P2 line; never the retry count. */
  trialNoticeNumber?: number | null;
  /** Discovery 3.0 PR-1: recipe-independent execution advice (../state/executionAdvice.ts), ORIGINAL card only. */
  executionAdviceJa?: string | null;
  /** 229-C: 「💡 ヒントを見る」 -- cook freely again with the hint sheet open (App.tsx). Offered on
   *  an ORIGINAL result, and on a known pizza only next to a near-miss line. */
  onShowHint?: () => void;
  /** #346 S4: the valid Research Target's anonymous label (「？？？ピザ B（たまねぎ）」), or `null`/omitted without one. Only
   *  with it does an ORIGINAL result use the Research copy, 「📓 試作ノート」 and the retry wording; the label is
   *  never a recipe name or id. */
  researchLabelJa?: string | null;
  /** Contract 2.1 S5: the disclosed RESULT membership rows of this attempt (`state.lastResearchRows`, flag-gated by the
   *  caller). Rendered as is, in the order given, and only on the Research ORIGINAL card; this component never judges
   *  membership or regenerates a known check-mark. `knownIngredientIds` (known before this attempt) only marks an
   *  already-used ingredient with a small ✓ in the used-ingredients list: ○ = learned now, ✓ = known before. Omitted / null / nothing to disclose renders nothing. */
  researchRows?: { rows: readonly ResearchResultRow[]; toppingOverCap: boolean; knownIngredientIds?: readonly string[] } | null;
  /** #346 S4: opens the 「📓 試作ノート」 sheet (GameScreen owns it) from the Research ORIGINAL result. */
  onOpenAttemptLog?: () => void;
  /** Ref for that button, so GameScreen can hand focus back when the sheet closes. */
  attemptLogEntryRef?: React.Ref<HTMLButtonElement>;
  /** #346 S4 / OD-RX-4: the state-aware primary CTA of a NEW_DISCOVERY result. Omitted = the plain Dex link. */
  postDiscovery?: PostDiscoveryPrimary | null;
  /** 「🔎 次のピザを研究する」: the entry id when exactly one is left (start it), else `null` (back to the Dex's
   *  anonymous Research cards). */
  onResearchNext?: (recipeId: string | null) => void;
  /** Cooking Techniques TQ-1D (SSOT P5): the techniques discovered in this round (handed over by the screen),
   *  shown before the recipe on a finished pizza. Omitted / null / empty renders nothing. */
  techniqueReveal?: readonly TechniqueId[] | null;
}

const MAX_STARS = 5;

/** #346 S4: the Research ORIGINAL lead. One string for every original kind; says only that no new recipe was found. */
export const RESEARCH_ORIGINAL_LEAD_COPY = "まだ新しいレシピは見つかっていません";

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
  stepTimingRows = [],
  materialUnlockNotice = null,
  onOpenShop,
  cutEvaluation,
  freeCook = false,
  discovery = null,
  usedIngredientIds = [],
  quantityNoteJa = null,
  onRetrySameRecipe,
  onBackToPizzaSelect,
  dexRegistration = null,
  onOpenDex,
  nearMiss: nearMissLine = null,
  trialNoticeNumber = null,
  executionAdviceJa = null,
  onShowHint,
  researchLabelJa = null,
  researchRows = null,
  onOpenAttemptLog,
  attemptLogEntryRef,
  postDiscovery = null,
  onResearchNext,
  techniqueReveal = null,
}: ResultPanelProps) {
  useRevealOpenedResultDetail();
  // #346 S4: with a valid Research Target no near/far line is ever shown (Research ORIGINAL contract).
  const nearMiss = researchLabelJa !== null ? null : nearMissLine;
  // 229-C: a secondary row under the result itself -- the line (if any) and the hint CTA.
  const hintRow = (line: ResultNearMissLine | null, withCta: boolean) =>
    line || (withCta && onShowHint) ? (
      <div className="result-near-miss">
        {line && (
          <p className="result-near-miss__text" aria-live="polite">
            {line.textJa}
          </p>
        )}
        {withCta && onShowHint && (
          <button type="button" className="result-near-miss__cta" onClick={onShowHint}>
            {"\u{1F4A1}"} ヒントを見る
          </button>
        )}
      </div>
    ) : null;

  const actions = (
    <div className="action-row action-row--column result-panel__actions">
      <button type="button" className="cta-button cta-button--primary" onClick={onRetrySameRecipe}>
        {freeCook ? "もう一度試す" : "もう一度つくる"}
      </button>
      <button type="button" className="cta-button cta-button--secondary" onClick={onBackToPizzaSelect}>
        {freeCook ? "レシピを選んで作る" : "別のピザを作る"}
      </button>
    </div>
  );

  // Completion Gate Phase 1: a FAILED round gets its own small, distinct card -- reusing the
  // same outer structure/CTAs as the PASS branch below (per the Result Report's RESULT UI
  // section: "reuse the RESULT structure, don't build new UI"), but never the stars/score/
  // Dex/Pitz-credit markup, so a FAILED pizza can never be misread as a normal ★1 result.
  if (completion?.status === "FAILED") {
    const failureMessage = buildCompletionFailureMessage(completion);
    // OD-R3-1: a bake-FAILED Research trial that used an ingredient discloses the same ○× panel as the ORIGINAL card
    // (rows are only ever set by the reducer for such a trial); nothing else about the failed card changes.
    const failedResearch = freeCook && researchLabelJa !== null && researchRows !== null;
    const failedTrialNoticeText = failedResearch ? duplicateTrialNoticeJa(trialNoticeNumber) : null;
    return (
      <div className="result-panel result-panel--failed">
        <p className="result-panel__heading result-panel__heading--failed">失敗</p>
        {failedResearch && (
          <p className="result-panel__research-context" data-research-context="">
            {"\u{1F50E}"} 研究中 <ResearchLabel labelJa={researchLabelJa} />
          </p>
        )}
        <div className="result-panel__headline">
          <p className="result-panel__failed-reason" role="alert">
            {failureMessage}
          </p>
          {failedResearch && researchRows && (
            <ResearchRowsPanel rows={researchRows.rows} toppingOverCap={researchRows.toppingOverCap} />
          )}
          {failedTrialNoticeText && <p className="original-pizza__trial-notice">{failedTrialNoticeText}</p>}
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

        {failedResearch && onOpenAttemptLog ? (
          <div className="action-row action-row--column result-panel__actions">
            <button type="button" className="cta-button cta-button--primary" onClick={onRetrySameRecipe}>
              もう一度試す
            </button>
            <div className="result-panel__research-actions">
              <button
                ref={attemptLogEntryRef}
                type="button"
                className="result-near-miss__cta"
                aria-haspopup="dialog"
                onClick={onOpenAttemptLog}
              >
                {"\u{1F4D3}"} 試作ノート
              </button>
            </div>
            <button type="button" className="cta-button cta-button--secondary" onClick={onBackToPizzaSelect}>
              レシピを選んで作る
            </button>
          </div>
        ) : (
          actions
        )}
      </div>
    );
  }

  // Progression 2.0 Phase 3-2: an unmatched free-cook pizza. A finished, normal result -- never
  // styled or worded as a failure -- with no stars/score (nothing to score it against) and no
  // Dex/Pitz change.
  if (!score) {
    // 229-C (H-U4): the set already matches a recipe, so the fix is the sauce *amount* or the bake
    // -- never the sauce type, which would break the match.
    // P2-A: the kind picks the lead from one table; it is never rendered as a class or attribute.
    const leadJa = ORIGINAL_LEAD_COPY[originalResultKind(discovery)];
    // P3-3b: a static paragraph (no live region: the P2 line above already announces the result).
    const trialNoticeText = duplicateTrialNoticeJa(trialNoticeNumber);
    // #346 S4 / S0: every Recipe Discovery ORIGINAL (with or without a Research Target) is the same contract. The
    // wording is one fixed string for every original kind (ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH): no right/wrong,
    // no near/far line, no count. Only the 研究中 context line and the research CTA row depend on the target.
    const research = freeCook && researchLabelJa !== null;
    const recipeDiscovery = freeCook;
    return (
      <div className={`result-panel result-panel--original${research ? " result-panel--research" : ""}`}>
        <p className="result-panel__heading result-panel__heading--original">
          {recipeDiscovery ? "\u{1F9EA} オリジナルピザ" : "\u{1F3A8} オリジナルピザ完成！"}
        </p>
        {research && (
          <p className="result-panel__research-context" data-research-context="">
            {"\u{1F50E}"} 研究中 <ResearchLabel labelJa={researchLabelJa} />
          </p>
        )}
        <TechniqueReveal techniqueIds={techniqueReveal} />
        <div className="result-panel__headline">
          <p className="original-pizza__lead">
            {recipeDiscovery ? RESEARCH_ORIGINAL_LEAD_COPY : leadJa}
          </p>
          {research && researchRows && <ResearchRowsPanel rows={researchRows.rows} toppingOverCap={researchRows.toppingOverCap} />}
          {usedIngredientIds.length > 0 && (
            <ul className="original-pizza__ingredients" aria-label="使った材料">
              {usedIngredientIds.map((id) => {
                const ingredient = getIngredient(id);
                const known = research && !!ingredient && !!researchRows?.knownIngredientIds?.includes(id);
                return (
                  <li
                    key={id}
                    className={`original-pizza__ingredient${known ? " original-pizza__ingredient--known" : ""}`}
                    aria-label={known ? `${ingredient!.nameJa}、すでにわかっている材料` : undefined}
                  >
                    {ingredient ? (
                      <>
                        <IngredientGlyph ingredient={ingredient} /> {ingredient.nameJa}
                        {known && (
                          <span className="original-pizza__known-mark" aria-hidden="true" data-known-mark="">
                            {" "}
                            ✓
                          </span>
                        )}
                      </>
                    ) : (
                      id
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {bakeState && (
            <p className={`result-panel__bake-badge result-panel__bake-badge--${bakeState}`}>
              {BAKE_STATE_ICON[bakeState]} 焼き加減: {BAKE_STATE_LABEL[bakeState]}
            </p>
          )}
          {/* Discovery 3.0 PR-1: a static, recipe-independent line about the player's own sauce. It never depends on
              `discovery` (the lead above and this card are byte-identical for every original outcome). */}
          {freeCook && executionAdviceJa && <p className="original-pizza__advice">{executionAdviceJa}</p>}
        </div>
        {freeCook && hintRow(null, true)}
        {freeCook && trialNoticeText && <p className="original-pizza__trial-notice">{trialNoticeText}</p>}
        <p className="original-pizza__note">
          {research ? RESEARCH_UX_COPY.resultNote : "図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。"}
        </p>
        {research ? (
          <div className="action-row action-row--column result-panel__actions">
            <button type="button" className="cta-button cta-button--primary" onClick={onRetrySameRecipe}>
              もう一度試す
            </button>
            <div className="result-panel__research-actions">
              {onOpenAttemptLog && (
                <button
                  ref={attemptLogEntryRef}
                  type="button"
                  className="result-near-miss__cta"
                  aria-haspopup="dialog"
                  onClick={onOpenAttemptLog}
                >
                  {"\u{1F4D3}"} 試作ノート
                </button>
              )}
            </div>
            <button type="button" className="cta-button cta-button--secondary" onClick={onBackToPizzaSelect}>
              レシピを選んで作る
            </button>
          </div>
        ) : (
          actions
        )}
      </div>
    );
  }

  const freeCookMatch =
    freeCook && (discovery?.kind === "NEW_DISCOVERY" || discovery?.kind === "ALREADY_DISCOVERED")
      ? discovery.kind
      : null;

  const filledStars = "★".repeat(score.stars);
  const emptyStars = "☆".repeat(MAX_STARS - score.stars);

  // Progression 2.0 W1-d (Discovery 2.0 design §18.2 variant b, Integration Gate §7): a round
  // that just discovered a recipe (the Free Cooking matcher's NEW_DISCOVERY -- the only source of
  // new discoveries since W1-a2) reads discovery-first: 1. NEW PIZZA + the name (revealed here for
  // the first time, OD-DISC-3) 2. the Dex registration row with 「📖 図鑑を見る」 3. ★ / score /
  // Pitz on one line 4. the material arrival 5. the existing bottom CTA bar (unchanged; the Dex
  // link is never added to it). Teto's heading and the bake badge are left out of this variant
  // only. Known / guided / ORIGINAL / FAILED results keep their quality-first layout.
  const isDiscoveryResult = freeCookMatch === "NEW_DISCOVERY";
  const totalPitz = pitzCredit
    ? pitzCredit.earnedPitz + pitzCredit.discoveryBonusPitz + (efficiencyCredit?.bonusPitz ?? 0)
    : null;

  return (
    <div className={`result-panel${isDiscoveryResult ? " result-panel--discovery" : ""}`}>
      <TechniqueReveal techniqueIds={techniqueReveal} />
      {isDiscoveryResult ? (
        <>
          <p className="discovered-banner discovered-banner--new-pizza" aria-live="polite">
            <span className="discovered-banner__stamp">NEW PIZZA! {"✨"}</span>{" "}
            <span className="discovered-banner__name">{recipeNameJa}</span>を発見しました！
          </p>
          <div className="dex-registration-row">
            <p className="dex-registration-row__text">
              {"\u{1F4D6}"} ピザ図鑑に登録！
              {dexRegistration && (
                <span className="dex-registration-row__slot">
                  {" "}
                  No.{String(dexRegistration.slot).padStart(2, "0")}（{dexRegistration.chapterTitleJa}{" "}
                  {dexRegistration.discovered}/{dexRegistration.total}）
                </span>
              )}
            </p>
            {postDiscovery?.kind === "RESEARCH_NEXT" && onResearchNext ? (
              <button
                type="button"
                className="dex-registration-row__cta dex-registration-row__cta--primary"
                onClick={() => onResearchNext(postDiscovery.directResearchId)}
              >
                {postDiscovery.labelJa}
              </button>
            ) : postDiscovery?.kind === "SHOP_NEW_MATERIAL" && onOpenShop ? (
              <button type="button" className="dex-registration-row__cta dex-registration-row__cta--primary" onClick={onOpenShop}>
                {postDiscovery.labelJa}
              </button>
            ) : (
              onOpenDex && (
                <button type="button" className="dex-registration-row__cta" onClick={onOpenDex}>
                  {"\u{1F4D6}"} 図鑑を見る
                </button>
              )
            )}
          </div>
        </>
      ) : (
        <p className="result-panel__heading">{headingJa}</p>
      )}

      <div className={`result-panel__headline${isDiscoveryResult ? " result-panel__headline--inline" : ""}`}>
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
        {isDiscoveryResult && totalPitz !== null && (
          <p className="result-panel__pitz-inline">
            +{totalPitz} Pitz
            {pitzCredit && pitzCredit.discoveryBonusPitz > 0 && (
              <span className="result-panel__pitz-bonus">（初回発見 +{pitzCredit.discoveryBonusPitz}）</span>
            )}
          </p>
        )}
        {bakeState && !isDiscoveryResult && (
          <p className={`result-panel__bake-badge result-panel__bake-badge--${bakeState}`}>
            {BAKE_STATE_ICON[bakeState]} 焼き加減: {BAKE_STATE_LABEL[bakeState]}
          </p>
        )}
        {quantityNoteJa && <p className="result-panel__quantity-note">{quantityNoteJa}</p>}
      </div>
      {freeCookMatch === "ALREADY_DISCOVERED" && (
        <p className="free-cook-known" aria-live="polite">
          {"\u{1F4D6}"} {recipeNameJa}ができた！（発見済み）
        </p>
      )}
      {freeCookMatch === "ALREADY_DISCOVERED" && nearMiss && hintRow(nearMiss, true)}

      {freeCookMatch !== "NEW_DISCOVERY" && (justDiscovered || justGotNewBest) && (
        <p
          className={`discovered-banner${justGotNewBest ? " discovered-banner--best" : ""}`}
          aria-live="polite"
        >
          {justDiscovered
            ? `✨ ${recipeNameJa}を発見しました！`
            : `\u{1F31F} NEW BEST!`}
        </p>
      )}

      {materialUnlockNotice && (
        <div className="material-unlock-notice" aria-live="polite">
          {/* Each name is its own non-breaking run, so lines break only between names. The "・"
              separator ends the *previous* run: a line may break after "・" but never before it
              (UAX #14), so a leading separator would glue every name into one unbreakable run. */}
          <p className="material-unlock-notice__message">
            {MATERIAL_UNLOCK_NOTICE_LEAD_JA}
            {materialUnlockNotice.namesJa.map((name, i) => (
              <span key={materialUnlockNotice.ingredientIds[i]} className="material-unlock-notice__name">
                {name}
                {i < materialUnlockNotice.namesJa.length - 1 ? "・" : ""}
              </span>
            ))}
          </p>
          {/* #358 OD-358-4: when the discovery's primary CTA already opens the Shop (「新しい食材を見る」), the notice is
              a message only -- one Shop CTA, not two with the same destination. */}
          {onOpenShop && !(isDiscoveryResult && postDiscovery?.kind === "SHOP_NEW_MATERIAL") && (
            <button type="button" className="material-unlock-notice__cta" onClick={onOpenShop}>
              {"\u{1F6D2}"} ショップへ
            </button>
          )}
        </div>
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
          {/* W1-d: on a discovery result the total already sits on the ★ line above; only the
              breakdown stays here. */}
          {!isDiscoveryResult && (
            <p className="pitz-credit-summary__headline">
              今回の獲得 <strong>+{totalPitz} Pitz</strong>
            </p>
          )}
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
              {/* Gameplay UX PR-C (Timing Transparency): 調理時間/手際 used to be duplicated here
                  and in the new `.cooking-timing-summary` block below -- moved out entirely (this
                  breakdown now only covers Pitz math) to avoid showing the same two facts twice
                  on one screen. 手際ボーナス (a Pitz amount, not a timing fact) stays here. */}
              {pitzCredit.discoveryBonusPitz > 0 && (
                <div className="pitz-credit-summary__row">
                  <dt>初回発見ボーナス</dt>
                  <dd>+{pitzCredit.discoveryBonusPitz} Pitz</dd>
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

      {/* Gameplay UX PR-C (Timing Transparency, Fresh Audit §5/§6): a short, low-emphasis
          headline (no countdown/alarm styling, per the task's own anti-speed-pressure
          instruction), mirroring the exact single-`<summary>`-line CUT/Pitz `<details>`
          convention above (the headline itself *is* the summary, not a separate line above a
          nested `<details>` -- RESULT 1-Screen 2.0's fixed vertical budget has no room for a
          second header line here). `efficiencyCredit`/`stepTimingRows` are both `null`/empty for
          a Mission round, which never renders this component at all -- FREE-only by
          construction, not a new gate. No new target/threshold number invented here -- only
          already-measured elapsed time (`cookingTiming.ts`'s own `completedMs`/
          `perStepElapsedMs`) and the pre-existing 手際 tier label. `stepTimingRows` is empty only
          in a defensive/test scenario (a real FREE round with a finalized `efficiencyCredit` --
          i.e. PREPARE fully completed -- always has at least one finalized step); that case
          renders a plain, non-interactive line instead of an emptily-expandable `<details>`. */}
      {efficiencyCredit &&
        (stepTimingRows.length > 0 ? (
          <details className="cooking-timing-summary">
            <summary className="cooking-timing-summary__summary">
              {"⏱️"} 調理時間 <strong>{formatCookingTime(efficiencyCredit.cookingTimeMs)}</strong>
              <span className="cooking-timing-summary__tier">
                （手際: {EFFICIENCY_TIER_LABEL_JA[efficiencyCredit.tier]}）
              </span>
            </summary>
            <dl className="cooking-timing-summary__details">
              {stepTimingRows.map((row) => (
                <div key={row.step} className="cooking-timing-summary__row">
                  <dt>{STEP_LABEL[row.step]}</dt>
                  <dd>{formatCookingTime(row.elapsedMs)}</dd>
                </div>
              ))}
            </dl>
            {/* Audit §8: CUT time is measured per-step but deliberately excluded from the
                whole-round `調理時間` total (cookingTiming.ts's own `completedMs` finalizes at
                START_BAKE, never re-touched for CUT) -- this note prevents the CUT row here from
                being misread as already summed into the headline above. Only rendered when a
                CUT row is actually present (a round with no CUT step never has one at all). */}
            {stepTimingRows.some((row) => row.step === "CUT") && (
              <p className="cooking-timing-summary__note">
                ※「調理時間」にカットの時間は含みません
              </p>
            )}
          </details>
        ) : (
          <p className="cooking-timing-summary cooking-timing-summary--flat">
            {"⏱️"} 調理時間 <strong>{formatCookingTime(efficiencyCredit.cookingTimeMs)}</strong>
            <span className="cooking-timing-summary__tier">
              （手際: {EFFICIENCY_TIER_LABEL_JA[efficiencyCredit.tier]}）
            </span>
          </p>
        ))}

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

      {/* #358 OD-358-2/3: a NEW PIZZA result is "discovered -> next": no 「もう一度試す」 / 「レシピを選んで作る」 here
          (the primary CTA above leads on; Pizza Select / HOME / Dex stay reachable from their own entries). */}
      {!isDiscoveryResult && actions}
    </div>
  );
}

/** Contract 2.1 §3: the one fixed explanation when 4+ unknown toppings were used (no individual topping row then). */
export const RESEARCH_TOPPING_CAP_COPY = "トッピングは一度に3種類まで調べられるよ";

const RESEARCH_ROW_CATEGORIES: readonly { category: ResearchResultCategory; labelJa: string }[] = [
  { category: "sauce", labelJa: "ソース" },
  { category: "cheese", labelJa: "チーズ" },
  { category: "topping", labelJa: "トッピング" },
];

/**
 * Contract 2.1 S5: 「今回の試作結果」. Category groups (ソース / チーズ / トッピング), one compact chip per disclosed
 * judgment: the ingredient name + ○ (a member of the researched pizza) or × (not a member). A category without a row is
 * not rendered at all, and nothing says "なし" / counts / totals / a verdict on the whole pizza. The same markup for every
 * original outcome. The symbol, not the colour, carries the meaning; the accessible name states it in words.
 */
function ResearchRowsPanel({ rows, toppingOverCap }: { rows: readonly ResearchResultRow[]; toppingOverCap: boolean }) {
  const groups = RESEARCH_ROW_CATEGORIES.map((g) => ({ ...g, rows: rows.filter((r) => r.category === g.category) }));
  const hasRows = groups.some((g) => g.rows.length > 0);
  if (!hasRows && !toppingOverCap) return null;
  return (
    <section className="research-rows" data-testid="research-rows" aria-label="今回の試作結果">
      <p className="research-rows__heading">{"\u{1F9EA}"} 今回の試作結果</p>
      {groups.map((g) => {
        const showCap = g.category === "topping" && toppingOverCap;
        if (g.rows.length === 0 && !showCap) return null;
        return (
          <div key={g.category} className="research-rows__group" data-research-category={g.category}>
            <span className="research-rows__category">{g.labelJa}</span>
            {showCap ? (
              <p className="research-rows__note">{RESEARCH_TOPPING_CAP_COPY}</p>
            ) : (
              <ul className="research-rows__chips">
                {g.rows.map((row) => {
                  const name = getIngredient(row.ingredientId)?.nameJa;
                  if (!name) return null;
                  const positive = row.verdict === "POSITIVE";
                  return (
                    <li
                      key={row.ingredientId}
                      className={`research-rows__chip research-rows__chip--${positive ? "positive" : "negative"}`}
                      aria-label={`${name}、研究中ピザの材料${positive ? "" : "ではない"}`}
                    >
                      <span aria-hidden="true">{name}</span>
                      <span className="research-rows__mark" aria-hidden="true">
                        {positive ? "○" : "×"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
