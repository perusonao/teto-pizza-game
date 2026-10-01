import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ResultPanel } from "./ResultPanel";
import type { ScoreBreakdown } from "../logic/scoring";

/**
 * P3-3b: the duplicate notice at the component boundary. The panel takes a plain number (the stable attempt number the
 * reducer recorded) and shows the notice on the ORIGINAL card of a free-cook round only, as a static paragraph after
 * the P2 row, leaving the P2 row's own semantics untouched.
 */
afterEach(cleanup);

const NOTICE = ".original-pizza__trial-notice";
const SCORE: ScoreBreakdown = { matchScore: 80, ingredientScore: 90, placementScore: 70, bakeScore: 60, total: 75, stars: 3 };
const base = () => ({
  completion: { status: "PASS" as const },
  bakeState: "perfect" as const,
  sauceScore: null,
  headingJa: "",
  recipeNameJa: "マルゲリータ",
  justDiscovered: false,
  justGotNewBest: false,
  pitzCredit: null,
  starterGrantNotice: null,
  freeCook: true,
  usedIngredientIds: ["tomato-sauce", "mozzarella"],
  onRetrySameRecipe: vi.fn(),
  onBackToPizzaSelect: vi.fn(),
});
const original = { kind: "ORIGINAL", blockedTargetIds: [] } as const;
const nearMiss = { kind: "ADD_ONE", textJa: "🤏 おしい！ 材料をあと1つ足すと、何か見つかりそう！" } as const;

describe("ResultPanel duplicate notice", () => {
  it("shows the notice with the stable number on a free-cook ORIGINAL card", () => {
    render(<ResultPanel {...base()} score={null} discovery={original} nearMiss={nearMiss} trialNoticeNumber={4} onShowHint={() => {}} />);
    expect(document.querySelector(NOTICE)).toHaveTextContent("📓 前にも同じ材料の組み合わせで作ったよ（試作#4）");
  });

  it("shows nothing without a number (null / undefined / invalid)", () => {
    for (const value of [null, undefined, 0, -2, 1.5, Number.NaN]) {
      const { unmount } = render(<ResultPanel {...base()} score={null} discovery={original} trialNoticeNumber={value as never} />);
      expect(document.querySelector(NOTICE), String(value)).toBeNull();
      unmount();
    }
  });

  it("shows nothing when the round is not free cook, even with a number", () => {
    render(<ResultPanel {...base()} freeCook={false} score={null} discovery={original} trialNoticeNumber={3} />);
    expect(document.querySelector(NOTICE)).toBeNull();
  });

  it("shows nothing on a scored card (known pizza / discovery) or a FAILED card, even with a number", () => {
    const known = { kind: "ALREADY_DISCOVERED", recipeId: "margherita", targetId: "shipped:margherita" } as const;
    const fresh = { kind: "NEW_DISCOVERY", recipeId: "margherita", targetId: "shipped:margherita" } as const;
    for (const discovery of [known, fresh]) {
      const { unmount } = render(<ResultPanel {...base()} score={SCORE} discovery={discovery} trialNoticeNumber={3} />);
      expect(document.querySelector(NOTICE), discovery.kind).toBeNull();
      unmount();
    }
    render(<ResultPanel {...base()} completion={{ status: "FAILED", reason: "RAW" } as never} score={null} discovery={null} trialNoticeNumber={3} />);
    expect(document.querySelector(NOTICE)).toBeNull();
  });

  it("the INCOMPLETE_MATCH lead is the neutral lead (PR-1) and renders no notice when no number is passed", () => {
    render(<ResultPanel {...base()} score={null} discovery={{ kind: "INCOMPLETE_MATCH", recipeId: "funghi", targetId: "t" }} />);
    expect(document.querySelector(".original-pizza__lead")).toHaveTextContent("図鑑にはまだ載っていないピザ！");
    expect(document.querySelector(NOTICE)).toBeNull();
  });

  it("does not change the P2 row's semantics: the row has no live region of its own; its text paragraph is the one live region", () => {
    render(<ResultPanel {...base()} score={null} discovery={original} nearMiss={nearMiss} trialNoticeNumber={2} onShowHint={() => {}} />);
    const row = document.querySelector(".result-near-miss")!;
    expect(row.hasAttribute("aria-live")).toBe(false);
    expect(row.hasAttribute("role")).toBe(false);
    expect(row.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(row.querySelector(".result-near-miss__text")).toHaveAttribute("aria-live", "polite");
    expect(row.textContent).not.toContain("試作");
    // the notice is a sibling after the row, outside every live region
    const notice = document.querySelector(NOTICE)!;
    expect(row.contains(notice)).toBe(false);
    expect(notice.closest("[aria-live]")).toBeNull();
    expect(row.nextElementSibling).toBe(notice);
    expect(document.querySelectorAll(".result-panel [aria-live]")).toHaveLength(1);
  });
});
