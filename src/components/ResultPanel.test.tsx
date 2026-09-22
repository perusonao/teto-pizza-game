import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResultPanel } from "./ResultPanel";
import type { ScoreBreakdown } from "../logic/scoring";
import type { PitzCredit } from "../logic/pitzReward";
import type { CookingEfficiencyCredit } from "../logic/efficiency";
import type { CutEvaluation } from "../logic/cut/types";

/**
 * A1 Authority Cutover: ResultPanel gained a 4th feedback row ("ソース") so Scoring 2.0's Sauce
 * component -- its single heaviest component, 52/100, with no legacy `ScoreBreakdown` field of
 * its own -- is never silently discarded from player-facing feedback (see
 * docs/reports/TETO_SCORING2-A1_AUTHORITY_PreImplementation-Audit.md section 2, Option 1).
 *
 * RESULT 2.0 Slice 1: this is now the merged RESULT+DISCOVERED screen (see this file's own
 * header comment) -- these tests cover the banner/Pitz-credit/CTA content that used to live in
 * a separate DISCOVERED-only block in GameScreen.tsx, alongside the pre-existing score/stars/
 * bars coverage above.
 */
function baseScore(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    matchScore: 80,
    ingredientScore: 90,
    placementScore: 70,
    bakeScore: 60,
    total: 75,
    stars: 3,
    ...overrides,
  };
}

function basePitzCredit(overrides: Partial<PitzCredit> = {}): PitzCredit {
  return {
    earnedPitz: 42,
    baseReward: 100,
    multiplier: 0.8,
    balanceBefore: 100,
    balanceAfter: 142,
    ...overrides,
  };
}

function baseProps() {
  return {
    completion: { status: "PASS" as const },
    score: baseScore(),
    bakeState: "perfect" as const,
    sauceScore: 42,
    headingJa: "いいできばえだね！",
    recipeNameJa: "マルゲリータ",
    justDiscovered: false,
    justGotNewBest: false,
    pitzCredit: null,
    starterGrantNotice: null,
    onRetrySameRecipe: vi.fn(),
    onBackToPizzaSelect: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
});

describe("ResultPanel", () => {
  it("renders the short heading directly (no bureaucratic registration button)", () => {
    render(<ResultPanel {...baseProps()} />);
    expect(screen.getByText("いいできばえだね！")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "レシピ図鑑に登録する" }),
    ).not.toBeInTheDocument();
  });

  it("renders a ソース (Sauce) feedback row when sauceScore is available", () => {
    render(<ResultPanel {...baseProps()} sauceScore={42} />);
    expect(screen.getByText("ソース")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("omits the ソース row rather than fabricating a number when sauceScore is null", () => {
    render(<ResultPanel {...baseProps()} sauceScore={null} />);
    expect(screen.queryByText("ソース")).not.toBeInTheDocument();
  });

  it("still renders the legacy 具材/配置/焼き rows alongside ソース, collapsed by default", () => {
    render(<ResultPanel {...baseProps()} sauceScore={42} />);
    expect(screen.getByText("具材")).toBeInTheDocument();
    expect(screen.getByText("配置")).toBeInTheDocument();
    expect(screen.getByText("焼き")).toBeInTheDocument();
    expect(document.querySelector(".result-panel__details")).not.toHaveAttribute("open");
  });

  it("renders the headline total/stars from score, unaffected by sauceScore", () => {
    const { container } = render(
      <ResultPanel {...baseProps()} score={baseScore({ total: 88, stars: 4 })} sauceScore={null} />,
    );
    expect(screen.getByText("88点")).toBeInTheDocument();
    expect(container.querySelector(".result-panel__stars")?.textContent).toBe("★★★★☆");
  });

  it("shows the discovery banner when justDiscovered, not the BEST banner", () => {
    render(<ResultPanel {...baseProps()} justDiscovered justGotNewBest={false} />);
    expect(screen.getByText(/を発見しました/)).toBeInTheDocument();
    expect(screen.queryByText(/NEW BEST!/)).not.toBeInTheDocument();
  });

  it("shows the NEW BEST banner when justGotNewBest and not a first discovery", () => {
    render(<ResultPanel {...baseProps()} justDiscovered={false} justGotNewBest />);
    expect(screen.getByText(/NEW BEST!/)).toBeInTheDocument();
    expect(screen.queryByText(/を発見しました/)).not.toBeInTheDocument();
  });

  it("shows neither banner on an ordinary repeat play", () => {
    render(<ResultPanel {...baseProps()} justDiscovered={false} justGotNewBest={false} />);
    expect(screen.queryByText(/NEW BEST!/)).not.toBeInTheDocument();
    expect(screen.queryByText(/を発見しました/)).not.toBeInTheDocument();
  });

  it("renders the Pitz credit summary when provided", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit({ earnedPitz: 42 })} />);
    expect(screen.getByText(/\+42 Pitz/)).toBeInTheDocument();
  });

  it("omits the Pitz credit summary for a Mission round (pitzCredit null)", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={null} />);
    expect(screen.queryByText(/今回の獲得/)).not.toBeInTheDocument();
  });

  it("shows a zero-Pitz explanatory note when earnedPitz is 0", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit({ earnedPitz: 0 })} />);
    expect(screen.getByText(/今回はPitzを獲得できませんでした/)).toBeInTheDocument();
  });

  // Economy Tuning 1 P1: the Starter Grant notice.
  it("renders the Starter Grant notice when provided", () => {
    render(
      <ResultPanel
        {...baseProps()}
        starterGrantNotice={{
          recipeIds: ["funghi"],
          messageJa: "\u{1F381}「フンギ」の材料を最初の10回分プレゼントしました！",
        }}
      />,
    );
    expect(screen.getByText(/フンギ/)).toBeInTheDocument();
    expect(screen.getByText(/10回分/)).toBeInTheDocument();
  });

  it("omits the Starter Grant notice when null (the common case -- no new recipe just unlocked)", () => {
    render(<ResultPanel {...baseProps()} starterGrantNotice={null} />);
    expect(screen.queryByText(/プレゼントしました/)).not.toBeInTheDocument();
  });

  // Cooking Time CT2.
  function baseEfficiencyCredit(overrides: Partial<CookingEfficiencyCredit> = {}): CookingEfficiencyCredit {
    return {
      tier: "GOOD",
      bonusRate: 0.06,
      bonusPitz: 6,
      cookingTimeMs: 42_000,
      ...overrides,
    };
  }

  it("renders 調理時間/手際 and adds the Efficiency bonus into the total/balance when provided", () => {
    render(
      <ResultPanel
        {...baseProps()}
        pitzCredit={basePitzCredit({ earnedPitz: 42, balanceAfter: 142 })}
        efficiencyCredit={baseEfficiencyCredit()}
      />,
    );
    expect(screen.getByText("調理時間")).toBeInTheDocument();
    expect(screen.getByText("0:42")).toBeInTheDocument();
    expect(screen.getByText("手際")).toBeInTheDocument();
    expect(screen.getByText("スムーズ")).toBeInTheDocument();
    expect(screen.getByText("手際ボーナス")).toBeInTheDocument();
    expect(screen.getByText("+6 Pitz")).toBeInTheDocument();
    // Headline total and the balance arrow both include the bonus on top of earnedPitz/balanceAfter.
    expect(screen.getByText(/\+48 Pitz/)).toBeInTheDocument();
    expect(screen.getByText(/148/)).toBeInTheDocument();
  });

  it("omits the Efficiency bonus row (but still shows 手際) when bonusPitz is 0", () => {
    render(
      <ResultPanel
        {...baseProps()}
        pitzCredit={basePitzCredit()}
        efficiencyCredit={baseEfficiencyCredit({ tier: "NORMAL", bonusRate: 0, bonusPitz: 0 })}
      />,
    );
    expect(screen.getByText("手際")).toBeInTheDocument();
    expect(screen.getByText("ふつう")).toBeInTheDocument();
    expect(screen.queryByText("手際ボーナス")).not.toBeInTheDocument();
  });

  it("omits every Cooking Time / Efficiency row when efficiencyCredit is null/omitted (Mission round, or no timing data)", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit()} />);
    expect(screen.queryByText("調理時間")).not.toBeInTheDocument();
    expect(screen.queryByText("手際")).not.toBeInTheDocument();
    expect(screen.queryByText("手際ボーナス")).not.toBeInTheDocument();
  });

  // Completion Gate Phase 1 x Cooking Time CT2: FAILED must never show a "手際" evaluation --
  // even a defensively-passed non-null efficiencyCredit (a stale prop, a future caller bug)
  // must not leak through, since the whole FAILED branch returns before ever reaching the
  // pitzCredit/efficiencyCredit markup (see ResultPanel.tsx's own early return).
  it("FAILED never renders 調理時間/手際/手際ボーナス, even if efficiencyCredit/pitzCredit are (incorrectly) non-null", () => {
    render(
      <ResultPanel
        {...baseProps()}
        completion={{ status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] }}
        pitzCredit={basePitzCredit()}
        efficiencyCredit={{ tier: "GOOD", bonusRate: 0.1, bonusPitz: 10, cookingTimeMs: 5_000 }}
      />,
    );
    expect(screen.getByText("失敗")).toBeInTheDocument();
    expect(screen.getByText(/\+0 Pitz/)).toBeInTheDocument();
    expect(screen.queryByText("調理時間")).not.toBeInTheDocument();
    expect(screen.queryByText("手際")).not.toBeInTheDocument();
    expect(screen.queryByText("手際ボーナス")).not.toBeInTheDocument();
    expect(screen.queryByText(/\+42 Pitz/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+10 Pitz/)).not.toBeInTheDocument();
  });

  // Pizza Cutting 1.0 Phase 3 (docs/design/TETO_PIZZA-CUTTING_1.0.md §14 Option D / RESULT UI
  // section): the CUT evaluation preview, standalone and never folded into score.total.
  function baseCutEvaluation(overrides: Partial<CutEvaluation> = {}): CutEvaluation {
    return {
      requestedSliceCount: 6,
      completedCutCount: 3,
      actualPieceCount: 6,
      pieceAreas: [1, 1, 1, 1, 1, 1],
      countCorrectness: 1,
      completeness: 1,
      centerAccuracy: 0.97,
      uniformity: 0.93,
      cutScore: 96,
      ...overrides,
    };
  }

  it("renders the CUT evaluation summary (score, slice count, and the three player-facing signals) when provided", () => {
    render(<ResultPanel {...baseProps()} cutEvaluation={baseCutEvaluation()} />);
    expect(screen.getByText(/カット/)).toBeInTheDocument();
    expect(screen.getByText("96点")).toBeInTheDocument();
    expect(screen.getByText(/6等分/)).toBeInTheDocument();
    expect(screen.getByText("均等さ")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText("中心")).toBeInTheDocument();
    expect(screen.getByText("97")).toBeInTheDocument();
    expect(screen.getByText("切り分け")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("never shows raw technical terms (uniformity/centerAccuracy/completeness) as player-facing text", () => {
    render(<ResultPanel {...baseProps()} cutEvaluation={baseCutEvaluation()} />);
    expect(screen.queryByText(/uniformity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/centerAccuracy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/completeness/i)).not.toBeInTheDocument();
  });

  it("shows the mismatch against the requested slice count when actualPieceCount differs", () => {
    render(
      <ResultPanel
        {...baseProps()}
        cutEvaluation={baseCutEvaluation({ actualPieceCount: 7, requestedSliceCount: 6 })}
      />,
    );
    expect(screen.getByText(/7等分/)).toBeInTheDocument();
    expect(screen.getByText(/目標 6等分/)).toBeInTheDocument();
  });

  // Visual Polish 2.0C P1-5 Option B (Fresh Audit §10): the CUT evaluation block collapses
  // behind a native <details>, default closed, mirroring the existing
  // `.result-panel__details`「くわしいスコアを見る」pattern -- was the single largest
  // unconditionally-expanded content contributor pushing the primary CTA below the fold.
  it("renders the CUT evaluation as a native <details>, default closed, when a CUT round is present", () => {
    render(<ResultPanel {...baseProps()} cutEvaluation={baseCutEvaluation()} />);
    const cutDetails = document.querySelector(".cut-evaluation-summary");
    expect(cutDetails).toBeInTheDocument();
    expect(cutDetails?.tagName).toBe("DETAILS");
    expect(cutDetails).not.toHaveAttribute("open");
  });

  it("shows the CUT total score on the always-visible summary line", () => {
    render(<ResultPanel {...baseProps()} cutEvaluation={baseCutEvaluation()} />);
    const summary = document.querySelector(".cut-evaluation-summary__summary");
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent(/カット/);
    expect(summary).toHaveTextContent("96点");
  });

  it("reveals all existing CUT detail rows once opened (real tap on the summary), none dropped", () => {
    render(<ResultPanel {...baseProps()} cutEvaluation={baseCutEvaluation()} />);
    const cutDetails = document.querySelector(".cut-evaluation-summary") as HTMLDetailsElement;
    const summary = document.querySelector(".cut-evaluation-summary__summary") as HTMLElement;
    fireEvent.click(summary);
    expect(cutDetails).toHaveAttribute("open");
    expect(screen.getByText(/6等分/)).toBeInTheDocument();
    expect(screen.getByText("※総合スコアとは別の評価です")).toBeInTheDocument();
    expect(screen.getByText("均等さ")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
    expect(screen.getByText("中心")).toBeInTheDocument();
    expect(screen.getByText("97")).toBeInTheDocument();
    expect(screen.getByText("切り分け")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("passes CUT score/metric values through unchanged -- the disclosure only changes display, not calculation", () => {
    render(
      <ResultPanel
        {...baseProps()}
        cutEvaluation={baseCutEvaluation({
          cutScore: 59,
          uniformity: 0.41,
          centerAccuracy: 0.62,
          completeness: 0.75,
        })}
      />,
    );
    const summary = document.querySelector(".cut-evaluation-summary__summary") as HTMLElement;
    fireEvent.click(summary);
    expect(summary).toHaveTextContent("59点");
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getByText("62")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("keeps the primary retry CTAs present and wired alongside the CUT disclosure (no RESULT retry-flow regression)", () => {
    const onRetrySameRecipe = vi.fn();
    const onBackToPizzaSelect = vi.fn();
    render(
      <ResultPanel
        {...baseProps()}
        cutEvaluation={baseCutEvaluation()}
        onRetrySameRecipe={onRetrySameRecipe}
        onBackToPizzaSelect={onBackToPizzaSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "もう一度つくる" }));
    expect(onRetrySameRecipe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "別のピザを作る" }));
    expect(onBackToPizzaSelect).toHaveBeenCalledTimes(1);
  });

  it("omits the CUT evaluation summary for a non-CUT recipe (cutEvaluation null)", () => {
    render(<ResultPanel {...baseProps()} cutEvaluation={null} />);
    expect(document.querySelector(".cut-evaluation-summary")).not.toBeInTheDocument();
    expect(screen.queryByText(/カット/)).not.toBeInTheDocument();
  });

  it("omits the CUT evaluation summary when the prop is not passed at all (existing call sites)", () => {
    render(<ResultPanel {...baseProps()} />);
    expect(document.querySelector(".cut-evaluation-summary")).not.toBeInTheDocument();
  });

  it("FAILED never renders the CUT evaluation summary, even if cutEvaluation is (incorrectly) non-null", () => {
    render(
      <ResultPanel
        {...baseProps()}
        completion={{ status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] }}
        cutEvaluation={baseCutEvaluation()}
      />,
    );
    expect(screen.getByText("失敗")).toBeInTheDocument();
    expect(document.querySelector(".cut-evaluation-summary")).not.toBeInTheDocument();
  });

  // Gameplay UX PR-D (RESULT 1-Screen 2.0, Fresh Audit §6): the Pitz breakdown used to render
  // unconditionally expanded; it now collapses behind a native <details>, default closed,
  // mirroring the exact `.result-panel__details`/`.cut-evaluation-summary` convention already
  // used elsewhere on this screen -- Tier 1 keeps only the headline number.
  it("renders the Pitz breakdown as a native <details>, default closed, with the headline number always visible", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit({ earnedPitz: 42 })} />);
    expect(screen.getByText(/\+42 Pitz/)).toBeInTheDocument();
    const breakdown = document.querySelector(".pitz-credit-summary__breakdown");
    expect(breakdown).toBeInTheDocument();
    expect(breakdown?.tagName).toBe("DETAILS");
    expect(breakdown).not.toHaveAttribute("open");
  });

  it("reveals the full Pitz breakdown (基本報酬/出来栄え倍率/所持Pitz), none dropped, once opened", () => {
    render(
      <ResultPanel
        {...baseProps()}
        pitzCredit={basePitzCredit({ earnedPitz: 42, baseReward: 100, multiplier: 0.8 })}
      />,
    );
    const breakdown = document.querySelector(".pitz-credit-summary__breakdown") as HTMLDetailsElement;
    const summary = document.querySelector(
      ".pitz-credit-summary__breakdown-summary",
    ) as HTMLElement;
    fireEvent.click(summary);
    expect(breakdown).toHaveAttribute("open");
    expect(screen.getByText("基本報酬")).toBeInTheDocument();
    expect(screen.getByText("100 Pitz")).toBeInTheDocument();
    expect(screen.getByText("出来栄え倍率")).toBeInTheDocument();
    expect(screen.getByText("×0.80")).toBeInTheDocument();
    expect(screen.getByText("所持Pitz")).toBeInTheDocument();
  });

  it("keeps the zero-Pitz explanatory note visible in Tier 1, outside the collapsed breakdown", () => {
    render(<ResultPanel {...baseProps()} pitzCredit={basePitzCredit({ earnedPitz: 0 })} />);
    expect(screen.getByText(/今回はPitzを獲得できませんでした/)).toBeInTheDocument();
  });

  it("wires the retry-same-recipe and back-to-select CTAs", () => {
    const onRetrySameRecipe = vi.fn();
    const onBackToPizzaSelect = vi.fn();
    render(
      <ResultPanel {...baseProps()} onRetrySameRecipe={onRetrySameRecipe} onBackToPizzaSelect={onBackToPizzaSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "もう一度つくる" }));
    expect(onRetrySameRecipe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "別のピザを作る" }));
    expect(onBackToPizzaSelect).toHaveBeenCalledTimes(1);
  });
});
