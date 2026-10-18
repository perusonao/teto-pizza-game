import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { createEmptyPizza } from "../state/pizzaState";
import { PAN_SHAPE_NOTICE_JA, panShapeNoticeJa } from "../state/panShapeNotice";
import { RESEARCH_ORIGINAL_LEAD_COPY, ResultPanel } from "./ResultPanel";

/** Square Dough F3: the neutral dough-shape line is one string for ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH (AC-2/AC-3). */
const ORDINARY: DiscoveryOutcome = { kind: "ORIGINAL", blockedTargetIds: [] };
const AMBIGUOUS: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["a", "b"] };
const INCOMPLETE: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: "margherita", targetId: "shipped:margherita" };
const TRAY = panShapeNoticeJa({ ...createEmptyPizza(), pan: "tray" });

function html(discovery: DiscoveryOutcome, notice: string | null, over: { researchLabelJa?: string | null; freeCook?: boolean } = {}): string {
  cleanup();
  const { container } = render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={null}
      bakeState="perfect"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="x"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook={over.freeCook ?? true}
      researchLabelJa={over.researchLabelJa}
      discovery={discovery}
      usedIngredientIds={["tomato-sauce", "mozzarella"]}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      panShapeNoticeJa={notice}
    />,
  );
  return container.innerHTML;
}

afterEach(() => cleanup());

describe("panShapeNoticeJa", () => {
  it("is the approved sentence, exactly", () => {
    expect(PAN_SHAPE_NOTICE_JA).toBe("材料だけでなく、生地の形や調理法も見直してみよう。");
  });
  it("is a function of the explicit tray pan only", () => {
    expect(TRAY).toBe(PAN_SHAPE_NOTICE_JA);
    for (const pan of [undefined, null, "deep-pan", "shallow-pan"] as const) {
      expect(panShapeNoticeJa({ ...createEmptyPizza(), ...(pan === undefined ? {} : { pan }) } as never)).toBeNull();
    }
    expect(panShapeNoticeJa(null)).toBeNull();
  });
  it("names no recipe, ingredient, count, technique or distance", () => {
    expect(PAN_SHAPE_NOTICE_JA).not.toMatch(/天板|グランマ|あと少し|\d|[０-９]|レシピ名|ソース|チーズ/);
  });
});

describe("ResultPanel: the shape line is identical across the three unidentified kinds", () => {
  it("ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH render byte-identically with the line", () => {
    const a = html(ORDINARY, TRAY);
    expect(a).toContain(PAN_SHAPE_NOTICE_JA);
    expect(html(AMBIGUOUS, TRAY)).toBe(a);
    expect(html(INCOMPLETE, TRAY)).toBe(a);
  });
  it("Research ORIGINAL card also carries it identically, and the Research lead (G2) is unchanged", () => {
    const research = { researchLabelJa: "？？？ピザ B" };
    const a = html(ORDINARY, TRAY, research);
    expect(a).toContain(PAN_SHAPE_NOTICE_JA);
    expect(a).toContain(RESEARCH_ORIGINAL_LEAD_COPY);
    expect(html(AMBIGUOUS, TRAY, research)).toBe(a);
    expect(html(INCOMPLETE, TRAY, research)).toBe(a);
  });
  it("a round pizza (no notice) renders exactly as before: no shape text at all", () => {
    for (const d of [ORDINARY, AMBIGUOUS, INCOMPLETE]) {
      expect(html(d, null)).not.toContain("生地の形");
      expect(html(d, null)).toBe(html(ORDINARY, null));
    }
  });
  it("only the line differs between a tray and a round card", () => {
    expect(html(ORDINARY, TRAY).replace(/<p class="original-pizza__advice original-pizza__pan-notice">[^<]*<\/p>/, "")).toBe(html(ORDINARY, null));
  });
  it("is not shown outside Free Cooking", () => {
    expect(html(ORDINARY, TRAY, { freeCook: false })).not.toContain(PAN_SHAPE_NOTICE_JA);
  });
});

describe("Anti-Oracle: the sentence is defined in one source file", () => {
  const sources = import.meta.glob<string>(["/src/**/*.ts", "/src/**/*.tsx", "!/src/**/*.test.ts", "!/src/**/*.test.tsx"], {
    query: "?raw",
    import: "default",
    eager: true,
  });
  it("only src/state/panShapeNotice.ts carries it", () => {
    const holders = Object.entries(sources).filter(([, t]) => t.includes(PAN_SHAPE_NOTICE_JA)).map(([p]) => p);
    expect(holders).toEqual(["/src/state/panShapeNotice.ts"]);
  });
});
