import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import type { ResearchResultRow } from "../logic/discovery/researchResultRows";
import { TARGETLESS_ORIGINAL_NOTE } from "../state/originalResultCopy";
import { ResultPanel } from "./ResultPanel";
import { RESEARCH_UX_COPY } from "./researchUxCopy";

/**
 * Issue #676 (Owner GO 2026-10-27): C1 -- the bake-FAILED card gets the same 「💡 ヒントを見る」 row an ORIGINAL card has; C3 -- the
 * targetless ORIGINAL note is one fixed sentence that points at it. Acceptance AC-P1..P6 of
 * docs/design/TETO_DISCOVERY-FAILURE-GUIDANCE_DESIGN-GATE_2026-10-26.md (§7) at the component level (the reducer-level
 * equality of the sheet it opens is pinned in App.failedHint676.test.tsx).
 */
const FAILED = { status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] } as const;
const EMPTY = { status: "FAILED", reason: "MISSING_REQUIRED_INGREDIENT", failures: [{ reason: "MISSING_REQUIRED_INGREDIENT" }] } as const;
const ROWS: ResearchResultRow[] = [
  { ingredientId: "tomato-sauce", category: "sauce", verdict: "NEGATIVE" },
  { ingredientId: "egg", category: "topping", verdict: "NEGATIVE" },
];
const ORDINARY = { kind: "ORIGINAL", blockedTargetIds: [] } as unknown as DiscoveryOutcome;
const AMBIGUOUS = { kind: "AMBIGUOUS", candidateIds: ["a", "b"] } as unknown as DiscoveryOutcome;
const INCOMPLETE = { kind: "INCOMPLETE_MATCH", recipeId: "margherita", failures: [] } as unknown as DiscoveryOutcome;
const HINT = /ヒントを見る/;

function card(over: Record<string, unknown> = {}) {
  cleanup();
  const h = { onRetrySameRecipe: vi.fn(), onBackToPizzaSelect: vi.fn(), onShowHint: vi.fn(), onOpenAttemptLog: vi.fn() };
  const { container } = render(
    <ResultPanel
      completion={FAILED}
      score={null}
      bakeState="raw"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={null}
      usedIngredientIds={["tomato-sauce", "egg"]}
      {...h}
      {...over}
    />,
  );
  return { html: container.innerHTML, text: container.textContent ?? "", ...h };
}
const targetlessOriginal = (discovery: DiscoveryOutcome, over: Record<string, unknown> = {}) =>
  card({ completion: { status: "PASS" }, discovery, bakeState: "perfect", ...over });

afterEach(() => cleanup());

describe("C1: the FAILED card's hint row", () => {
  it("targetless FAILED: one 「💡 ヒントを見る」 button that runs the existing hint handler once", () => {
    const c = card();
    const buttons = screen.getAllByRole("button", { name: HINT });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("💡 ヒントを見る");
    fireEvent.click(buttons[0]);
    expect(c.onShowHint).toHaveBeenCalledTimes(1);
    expect(c.onRetrySameRecipe).not.toHaveBeenCalled();
  });

  it("Research FAILED (○× panel, attempt log): the row is there too, and the Notebook / retry / back buttons are unchanged", () => {
    card({ researchLabelJa: "？？？ピザ", researchRows: { rows: ROWS, toppingOverCap: false } });
    expect(screen.getAllByRole("button", { name: HINT })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "もう一度試す" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /試作ノート/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "レシピを選んで作る" })).toBeInTheDocument();
    expect(screen.getByTestId("research-failed-kept")).toHaveTextContent(RESEARCH_UX_COPY.failedKept);
  });

  it("sits right after the headline block and before the Pitz summary (the ORIGINAL card's order)", () => {
    card();
    const headline = document.querySelector(".result-panel__headline")!;
    const hint = screen.getByRole("button", { name: HINT });
    const pitz = document.querySelector(".pitz-credit-summary")!;
    expect(headline.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hint.compareDocumentPosition(pitz) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is shown for every FAILED kind (an empty pizza included): the row never depends on why it failed", () => {
    expect(card({ completion: EMPTY, usedIngredientIds: [] }).html).toContain("ヒントを見る");
    expect(card({ completion: { ...FAILED, reason: "OVERBAKED", failures: [{ reason: "OVERBAKED" }] }, bakeState: "burnt" }).html).toContain("ヒントを見る");
  });

  it("is absent outside Free Cooking (Guided / Lunch Rush / Dinner: freeCook false) and without a handler", () => {
    card({ freeCook: false });
    expect(screen.queryByRole("button", { name: HINT })).toBeNull();
    card({ onShowHint: undefined });
    expect(screen.queryByRole("button", { name: HINT })).toBeNull();
  });
});

describe("AC-P2 / P4 / P5: nothing else leaks onto the FAILED card", () => {
  it("the hint row has no text of its own (no near-miss / distance / candidate line), whatever the round knew", () => {
    card({ nearMiss: { kind: "ADD_ONE", textJa: "あと1つ！" }, discovery: INCOMPLETE });
    expect(document.querySelector(".result-near-miss__text")).toBeNull();
    expect(document.body.textContent).not.toContain("あと1つ");
  });

  it("the FAILED card is byte-identical whatever the matcher outcome / near-miss line was (INV-D3)", () => {
    const base = card({ discovery: null }).html;
    expect(card({ discovery: ORDINARY }).html).toBe(base);
    expect(card({ discovery: AMBIGUOUS }).html).toBe(base);
    expect(card({ discovery: INCOMPLETE, nearMiss: { kind: "CLOSE", textJa: "おしい" } }).html).toBe(base);
  });

  it("no recipe name, hidden id, count / percent, data-attribute or aria carries the round's recipe", () => {
    const { html, text } = card({ recipeNameJa: "ビスマルク", discovery: INCOMPLETE });
    for (const needle of ["ビスマルク", "bismarck", "pesto-pollo", "margherita"]) {
      expect(text, needle).not.toContain(needle);
      expect(html, needle).not.toContain(needle);
    }
    expect(html).not.toMatch(/data-(kind|outcome|candidate|target|recipe)/i);
    expect(text).not.toMatch(/\d+\s*(種|個|件|%|％)|あと|おしい|近い|遠い/);
  });

  it("INV-D7: the card says no 「…なし」 / 「…不要」 about sauce or anything else", () => {
    const { text } = card({ usedIngredientIds: ["egg"] });
    expect(text).not.toMatch(/ソース(なし|不要)|なし|不要/);
  });

  it("C4 / C5 / C2 stay out: no bake advice on FAILED, no bridge to the Dex, no Notebook button on a targetless card", () => {
    const failed = card();
    expect(failed.text).not.toMatch(/もう少し長く焼|焼きすぎ|焼き時間/);
    expect(screen.queryByRole("button", { name: /図鑑|研究/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /試作ノート/ })).toBeNull();
    targetlessOriginal(ORDINARY);
    expect(screen.queryByRole("button", { name: /試作ノート/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /図鑑を開く|研究/ })).toBeNull();
  });
});

describe("C3: the targetless ORIGINAL note", () => {
  it("is the Owner-fixed sentence, replacing the old Dex-match line, and sits under the hint row", () => {
    expect(TARGETLESS_ORIGINAL_NOTE).toBe("ヒントを見ながら、次に試す材料を考えてみよう。");
    targetlessOriginal(ORDINARY);
    const note = screen.getByText(TARGETLESS_ORIGINAL_NOTE);
    expect(note).toHaveClass("original-pizza__note");
    expect(screen.queryByText(/図鑑のピザと同じ組み合わせ/)).toBeNull();
    expect(screen.getByRole("button", { name: HINT }).compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH render byte-identically (AC-P3)", () => {
    const o = targetlessOriginal(ORDINARY).html;
    expect(targetlessOriginal(AMBIGUOUS).html).toBe(o);
    expect(targetlessOriginal(INCOMPLETE).html).toBe(o);
  });

  it("is fixed text: no digit, ingredient / family name or forbidden word (Contract 2.1, INV-D7)", () => {
    expect(TARGETLESS_ORIGINAL_NOTE).not.toMatch(/あと|おしい|近い|遠い|惜|合って|できて|ほぼ|\d+(種|個|件|%)|[0-9０-９]/);
    expect(TARGETLESS_ORIGINAL_NOTE).not.toMatch(/ソース|チーズ|トッピング|肉系|魚介系|野菜|ハーブ|スパイス|なし|不要/);
  });

  it("Research ORIGINAL keeps its own note (unchanged); ALREADY_DISCOVERED / NEW_DISCOVERY carry no such note (AC-P6)", () => {
    targetlessOriginal(ORDINARY, { researchLabelJa: "？？？ピザ", researchRows: { rows: ROWS, toppingOverCap: false } });
    expect(screen.getByText(RESEARCH_UX_COPY.resultNote)).toBeInTheDocument();
    expect(screen.queryByText(TARGETLESS_ORIGINAL_NOTE)).toBeNull();
    card({
      completion: { status: "PASS" },
      score: { matchScore: 90, ingredientScore: 90, placementScore: 80, bakeScore: 90, total: 72, stars: 4 },
      bakeState: "perfect",
      discovery: { kind: "ALREADY_DISCOVERED", recipeId: "margherita" } as unknown as DiscoveryOutcome,
    });
    expect(screen.queryByText(TARGETLESS_ORIGINAL_NOTE)).toBeNull();
  });
});
