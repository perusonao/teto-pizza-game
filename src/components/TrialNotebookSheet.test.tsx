import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECIPES } from "../data/recipes";
import { createTrialNotebook, notebookView, recordAttempt, type TrialNotebook } from "../logic/discovery/trialNotebook";
import type { HintSheetView } from "../state/discoveryHint";
import { HintSheet } from "./HintSheet";
import { TrialNotebookSheet } from "./TrialNotebookSheet";
import { NOTEBOOK_COPY } from "./trialNotebookCopy";

/**
 * Discovery 3.0 Notebook N1: the read-only notebook sheet and its Hint sheet entry. The data is the real pure model's
 * `notebookView()`; the sheet adds nothing the view does not carry.
 */
afterEach(cleanup);

const fp = (sauce: string[], set: string[]) => `fp1:${JSON.stringify([sauce, set])}`;
const LINE = "\u{1F9EA} 別の組み合わせも試してみよう！";
function notebookOf(attempts: { sauce: string[]; set: string[]; line?: string | null }[]): TrialNotebook {
  return attempts.reduce(
    (nb, a) => recordAttempt(nb, { fingerprint: fp(a.sauce, a.set), feedback: a.line ? { kind: "FAR", textJa: a.line } : null }).state,
    createTrialNotebook(),
  );
}

const openPool = { kind: "OPEN_POOL" } as unknown as HintSheetView;

describe("TrialNotebookSheet", () => {
  it("shows an empty state (not a blank screen) with a way back", () => {
    const onBack = vi.fn();
    render(<TrialNotebookSheet entries={[]} onBack={onBack} />);
    expect(screen.getByRole("dialog", { name: /試作ノート/ })).toBeInTheDocument();
    expect(screen.getByText(NOTEBOOK_COPY.empty)).toBeInTheDocument();
    expect(screen.getByText(NOTEBOOK_COPY.emptyHint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ヒントにもどる/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("lists the player's own tries in the model's order, with #n, repeat count and the line shown", () => {
    const nb = notebookOf([
      { sauce: ["tomato-sauce"], set: ["mozzarella", "tomato-sauce"], line: LINE },
      { sauce: ["tomato-sauce"], set: ["mushroom", "tomato-sauce"], line: null },
      { sauce: ["tomato-sauce"], set: ["mozzarella", "tomato-sauce"], line: LINE }, // retry of #1
    ]);
    const { container } = render(<TrialNotebookSheet entries={notebookView(nb)} onBack={() => {}} />);
    const rows = [...container.querySelectorAll("[data-trial-entry]")];
    // recent activity first: the retry of #1 moved to the top
    expect(rows.map((r) => r.getAttribute("data-trial-entry"))).toEqual(["1", "2"]);
    expect(rows[0]).toHaveTextContent("試作 #1");
    expect(rows[0]).toHaveTextContent("モッツァレラ");
    expect(rows[0]).toHaveTextContent("同じ組み合わせを 2 回作ったよ");
    expect(rows[0]).toHaveTextContent(LINE);
    expect(rows[1]).toHaveTextContent("試作 #2");
    expect(rows[1]).toHaveTextContent("マッシュルーム");
    expect(rows[1]).not.toHaveTextContent("回作ったよ");
    expect(rows[1].querySelector(".trial-notebook__feedback")).toBeNull();
    // the sauce is shown as the sauce, not repeated among the toppings
    expect(rows[0].querySelectorAll(".hint-sheet__row")[1]).not.toHaveTextContent("トマトソース");
  });

  it("says it is session-only", () => {
    render(<TrialNotebookSheet entries={[]} onBack={() => {}} />);
    expect(screen.getByText(NOTEBOOK_COPY.sessionOnly)).toBeInTheDocument();
  });

  it("anti-oracle: no recipe identity, count, kind or match wording reaches the DOM", () => {
    const nb = notebookOf([
      { sauce: ["tomato-sauce"], set: ["mozzarella", "mushroom", "tomato-sauce"], line: LINE },
      { sauce: [], set: ["mozzarella"], line: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！" },
    ]);
    const { container } = render(<TrialNotebookSheet entries={notebookView(nb)} onBack={() => {}} />);
    const attrs = [...container.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => `${a.name}=${a.value}`)).join("\n");
    const text = container.textContent ?? "";
    for (const r of RECIPES) {
      expect(text).not.toContain(r.nameJa);
      expect(attrs).not.toContain(r.id);
    }
    expect(attrs).not.toMatch(/FAR|ADD_ONE|REMOVE_ONE|CLOSE|SAUCE_ONLY|fp1/);
    expect(text).not.toMatch(/正解|一致|%|％|距離|候補/);
  });
});

describe("Hint sheet entry", () => {
  const base = (props: Partial<Parameters<typeof HintSheet>[0]> = {}) => (
    <HintSheet view={openPool} onUnlock={() => {}} onClose={props.onClose ?? (() => {})} {...props} />
  );

  it("offers 「試作ノートを見る」 even with nothing to buy (pool > 1) and opens the notebook over the Hint", () => {
    render(base());
    expect(screen.queryByRole("dialog", { name: /試作ノート/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /試作ノートを見る/ }));
    expect(screen.getByRole("dialog", { name: /試作ノート/ })).toBeInTheDocument();
    expect(screen.getByText(NOTEBOOK_COPY.empty)).toBeInTheDocument();
    // the Hint sheet is still there underneath
    expect(screen.getByRole("dialog", { name: /ヒント/ })).toBeInTheDocument();
  });

  it("goes back to the Hint by the back button, the backdrop and Escape -- never closing the Hint", () => {
    const onClose = vi.fn();
    const { container } = render(base({ onClose }));
    const open = () => fireEvent.click(screen.getByRole("button", { name: /試作ノートを見る/ }));

    open();
    fireEvent.click(screen.getByRole("button", { name: /ヒントにもどる/ }));
    expect(screen.queryByRole("dialog", { name: /試作ノート/ })).toBeNull();

    open();
    fireEvent.click(container.querySelector(".trial-notebook__backdrop")!);
    expect(screen.queryByRole("dialog", { name: /試作ノート/ })).toBeNull();

    open();
    fireEvent.keyDown(screen.getByRole("dialog", { name: /試作ノート/ }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /試作ノート/ })).toBeNull();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: /ヒント/ })).toBeInTheDocument();
  });

  it("shows the rows it was given", () => {
    const nb = notebookOf([{ sauce: ["tomato-sauce"], set: ["tomato-sauce"], line: LINE }]);
    render(base({ notebook: notebookView(nb) }));
    fireEvent.click(screen.getByRole("button", { name: /試作ノートを見る/ }));
    expect(screen.getByText("試作 #1")).toBeInTheDocument();
  });
});
