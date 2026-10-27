import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RECIPES } from "../data/recipes";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { NO_TARGET_ORIGINAL_NOTE_JA } from "../state/originalResultCopy";
import { ResultPanel } from "./ResultPanel";
import { RESEARCH_UX_COPY } from "./researchUxCopy";

/**
 * Issue #676 C1 / C3 (Owner 2026-10-27). Acceptance (design Gate AC-P1..P6 / AC-B1):
 * - C1: a Free Cook FAILED card (Research or targetless) offers 「💡 ヒントを見る」, wired to the same `onShowHint` (= handleRetryWithHint) the
 *   ORIGINAL card uses; it is not offered to Guided, Lunch Rush or Dinner (no `onShowHint` / not Free Cook), and the FAILED kind never changes it.
 * - C3: the targetless ORIGINAL note is one fixed sentence, byte-identical for ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH, free of verdict
 *   words (Contract 2.1, INV-D7); Research keeps its own note; a non-Free-Cook card keeps its legacy note.
 */
const HIDDEN = RECIPES.find((r) => r.id === "quattro-formaggi")!;
const ORDINARY: DiscoveryOutcome = { kind: "ORIGINAL", blockedTargetIds: [] };
const AMBIGUOUS: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["shipped:quattro-formaggi", "shipped:twin"] };
const INCOMPLETE: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: HIDDEN.id, targetId: "shipped:quattro-formaggi" };
const FORBIDDEN = /あと|おしい|惜|近い|遠い|合って|できて|ほぼ|\d+(種|個|件|%)|ありません|なし|ない/;
const LEGACY = "図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。";

type Props = Parameters<typeof ResultPanel>[0];
const failed = (reason: string) => ({ status: "FAILED", reason, failures: [{ reason }] }) as Props["completion"];

function panel(over: Partial<Props> = {}) {
  cleanup();
  const onShowHint = vi.fn();
  const { container } = render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={null}
      bakeState="perfect"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={ORDINARY}
      usedIngredientIds={["tomato-sauce", "chicken"]}
      researchLabelJa={null}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      onShowHint={onShowHint}
      {...over}
    />,
  );
  return { html: container.innerHTML, text: container.textContent ?? "", onShowHint };
}
const hintButtons = () => screen.queryAllByRole("button", { name: /ヒントを見る/ });

afterEach(() => cleanup());

describe("C1: the FAILED card's hint button", () => {
  it.each(["UNDERBAKED", "OVERBAKED", "MISSING_REQUIRED_INGREDIENT"])("targetless Free Cook FAILED (%s): one 「💡 ヒントを見る」 calling onShowHint once", (reason) => {
    const { onShowHint } = panel({ completion: failed(reason), discovery: null });
    const buttons = hintButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("\u{1F4A1} ヒントを見る");
    fireEvent.click(buttons[0]);
    expect(onShowHint).toHaveBeenCalledTimes(1);
  });

  it("Research FAILED (a Research Target is active): the same button, and the research context line is unchanged", () => {
    const { onShowHint } = panel({
      completion: failed("UNDERBAKED"),
      discovery: null,
      researchLabelJa: "？？？ピザ",
      researchRows: { rows: [{ ingredientId: "tomato-sauce", category: "sauce", verdict: "NEGATIVE" }], toppingOverCap: false },
      onOpenAttemptLog: vi.fn(),
    });
    expect(screen.getByText(/研究中/)).toBeInTheDocument();
    fireEvent.click(hintButtons()[0]);
    expect(onShowHint).toHaveBeenCalledTimes(1);
  });

  it("the button row is placed after the failure reason and before the Pitz summary (same slot as the ORIGINAL card's)", () => {
    panel({ completion: failed("UNDERBAKED"), discovery: null });
    const reason = document.querySelector(".result-panel__failed-reason")!;
    const row = document.querySelector(".result-near-miss")!;
    const pitz = document.querySelector(".pitz-credit-summary")!;
    expect(reason.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(pitz) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.querySelector(".result-near-miss__text")).toBeNull(); // CTA only: never a near-miss line
  });

  it("not offered without Free Cook (Guided) or without a handler (Lunch Rush / Dinner pass none)", () => {
    panel({ completion: failed("UNDERBAKED"), discovery: null, freeCook: false });
    expect(hintButtons()).toHaveLength(0);
    panel({ completion: failed("UNDERBAKED"), discovery: null, onShowHint: undefined });
    expect(hintButtons()).toHaveLength(0);
  });

  it("the card is the same for every failure reason apart from the reason sentence (the kind adds nothing to the hint row)", () => {
    const strip = (html: string) => html.replace(/<p class="result-panel__failed-reason"[^>]*>.*?<\/p>/, "");
    const a = strip(panel({ completion: failed("UNDERBAKED"), discovery: null, bakeState: "raw" }).html);
    const b = strip(panel({ completion: failed("OVERBAKED"), discovery: null, bakeState: "raw" }).html);
    expect(a).toBe(b);
    expect(document.body.innerHTML).not.toMatch(/data-(kind|outcome|candidate|target|recipe)/i);
  });

  it("the card still says nothing about the hidden recipe, a distance or a count (AC-P2)", () => {
    const { text, html } = panel({ completion: failed("UNDERBAKED"), discovery: null, researchLabelJa: "？？？ピザ", researchRows: null });
    for (const needle of [HIDDEN.nameJa, HIDDEN.id, "quattro", "おしい", "近い", "遠い", "候補", "残り"]) {
      expect(text, needle).not.toContain(needle);
      expect(html, needle).not.toContain(needle);
    }
  });
});

describe("C3: the targetless ORIGINAL note", () => {
  it("is the Owner-fixed sentence and replaces the old Dex-match sentence", () => {
    expect(NO_TARGET_ORIGINAL_NOTE_JA).toBe("ヒントを見ながら、次に試す材料を考えてみよう。");
    panel();
    expect(document.querySelector(".original-pizza__note")).toHaveTextContent(NO_TARGET_ORIGINAL_NOTE_JA);
    expect(document.body.textContent).not.toContain(LEGACY);
  });

  it("ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH render byte-identically (AC-P3)", () => {
    const o = panel({ discovery: ORDINARY }).html;
    expect(panel({ discovery: AMBIGUOUS }).html).toBe(o);
    expect(panel({ discovery: INCOMPLETE }).html).toBe(o);
  });

  it("contains no verdict, distance, count or direct 'none' word (Contract 2.1, INV-D7)", () => {
    expect(NO_TARGET_ORIGINAL_NOTE_JA).not.toMatch(FORBIDDEN);
    expect(NO_TARGET_ORIGINAL_NOTE_JA).not.toMatch(/試作ノート|ノート/); // C2 (notebook pointer) stays out
  });

  it("Research keeps its own note; a non-Free-Cook ORIGINAL keeps its legacy note (AC-P6)", () => {
    panel({ researchLabelJa: "？？？ピザ" });
    expect(screen.getByText(RESEARCH_UX_COPY.resultNote)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(NO_TARGET_ORIGINAL_NOTE_JA);
    panel({ freeCook: false, onShowHint: undefined });
    expect(document.querySelector(".original-pizza__note")).toHaveTextContent(LEGACY);
    expect(document.body.textContent).not.toContain(NO_TARGET_ORIGINAL_NOTE_JA);
  });
});

describe("C2 / C4 / C5 stay out (AC-P5) and the other cards are untouched (AC-P6)", () => {
  it("a targetless ORIGINAL has exactly one hint button and no notebook / attempt-log shortcut", () => {
    panel({ onOpenAttemptLog: undefined });
    expect(hintButtons()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /試作ノート/ })).toBeNull();
  });

  it("a PASS (NEW_DISCOVERY) card has no hint button row from this change", () => {
    panel({
      discovery: { kind: "NEW_DISCOVERY", recipeId: HIDDEN.id, targetId: "shipped:quattro-formaggi" },
      score: { total: 80 } as unknown as Props["score"],
      justDiscovered: true,
    });
    expect(hintButtons()).toHaveLength(0);
  });
});
