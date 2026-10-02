import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { TrialNotebookSheet } from "../../components/TrialNotebookSheet";
import { createTrialNotebook, notebookView, recordAttempt, type TrialNotebook } from "./trialNotebook";
import { diffCombination, diffsForView } from "./trialNotebookDiff";

/** Discovery 3.0 Notebook N2: the "前回からの変更" diff and its anti-leak pins. */
afterEach(cleanup);

const fp = (sauce: string[], set: string[]) => `fp1:${JSON.stringify([sauce, set])}`;
const T = "tomato-sauce";
const combo = (sauce: string[], toppings: string[]) => ({ sauceBase: sauce, ingredientSet: [...sauce, ...toppings].sort() });
function notebookOf(attempts: { sauce: string[]; set: string[] }[]): TrialNotebook {
  return attempts.reduce((nb, a) => recordAttempt(nb, { fingerprint: fp(a.sauce, a.set), feedback: null }).state, createTrialNotebook());
}
const mk = (sauce: string[], toppings: string[]) => ({ sauce, set: [...sauce, ...toppings].sort() });
const render1 = (nb: TrialNotebook) => render(<TrialNotebookSheet entries={notebookView(nb)} onBack={() => {}} />).container;
const diffTexts = (c: HTMLElement) => [...c.querySelectorAll("[data-trial-diff] li")].map((li) => li.textContent);

describe("diffCombination", () => {
  it("shows added toppings with ＋ and removed with −", () => {
    const d = diffCombination(combo([T], ["corn", "eggplant"]), combo([T], ["oregano", "mozzarella"]))!;
    expect([...d.added].sort()).toEqual(["mozzarella", "oregano"]);
    expect([...d.removed].sort()).toEqual(["corn", "eggplant"]);
    expect(d.sauce).toBeNull();
  });
  it("reports a sauce change as before -> after", () => {
    const d = diffCombination(combo([T], ["corn"]), combo(["olive-oil"], ["corn"]))!;
    expect(d.sauce).toEqual({ before: [T], after: ["olive-oil"] });
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
  });
  it("returns null for an identical combination (never a wrong diff)", () => {
    expect(diffCombination(combo([T], ["corn"]), combo([T], ["corn"]))).toBeNull();
  });
});

describe("TrialNotebookSheet diff", () => {
  it("renders ＋ / − / sauce lines, newest first, nothing for the oldest row", () => {
    const c = render1(notebookOf([mk([T], ["corn", "eggplant"]), mk(["olive-oil"], ["oregano", "parmigiano"])]));
    expect([...c.querySelectorAll("[data-trial-entry]")].map((r) => r.getAttribute("data-trial-entry"))).toEqual(["2", "1"]);
    expect(c.querySelectorAll("[data-trial-diff]")).toHaveLength(1);
    expect(c.querySelector('[data-trial-entry="1"] [data-trial-diff]')).toBeNull();
    const lines = diffTexts(c);
    expect(lines.filter((l) => l?.startsWith("＋"))).toHaveLength(2);
    expect(lines.filter((l) => l?.startsWith("−"))).toEqual(expect.arrayContaining(["− コーン", "− ナス"]));
    expect(lines.some((l) => l?.startsWith("ソース：") && l.includes("→"))).toBe(true);
    expect(c.textContent).toContain("前回からの変更");
  });
  it("shows no sauce line and no 'unchanged' filler when only toppings changed", () => {
    const c = render1(notebookOf([mk([T], ["corn"]), mk([T], ["corn", "oregano"])]));
    expect(diffTexts(c)).toEqual(["＋ オレガノ"]);
    expect(c.textContent).not.toMatch(/変更なし|変わらず/);
  });
  it("ingredient only added / only removed", () => {
    expect(diffTexts(render1(notebookOf([mk([T], ["corn"]), mk([T], ["corn", "oregano"])])))).toEqual(["＋ オレガノ"]);
    cleanup();
    expect(diffTexts(render1(notebookOf([mk([T], ["corn", "oregano"]), mk([T], ["corn"])])))).toEqual(["− オレガノ"]);
  });
  it("a retry (A, B, A) is diffed against the distinct previous try B, keeps #n/order, and never diffs against itself", () => {
    const A = mk([T], ["corn"]);
    const B = mk([T], ["oregano"]);
    const nb = notebookOf([A, B, A]);
    const view = notebookView(nb);
    expect(view.map((v) => v.number)).toEqual([1, 2]);
    expect(view[0].retryCount).toBe(1);
    const diffs = diffsForView(view);
    expect(diffs[0]).toEqual({ added: ["corn"], removed: ["oregano"], sauce: null });
    expect(diffs[1]).toBeNull();
    // retrying the top row again is the same combination: nothing changes, no new diff appears
    const again = recordAttempt(nb, { fingerprint: fp(A.sauce, A.set), feedback: null }).state;
    expect(diffsForView(notebookView(again))).toEqual(diffs);
    expect(again.nextNumber).toBe(nb.nextNumber);
  });
  it("a single attempt has no diff", () => {
    expect(render1(notebookOf([mk([T], ["corn"])])).querySelector("[data-trial-diff]")).toBeNull();
  });
});

describe("anti-leak", () => {
  it("diff depends on the player's own combinations only: different shown lines / recorded feedback give the same diff", () => {
    const attempts = [mk([T], ["corn"]), mk(["olive-oil"], ["oregano"])];
    const withLines = (kind: string) =>
      attempts.reduce(
        (nb, a) => recordAttempt(nb, { fingerprint: fp(a.sauce, a.set), feedback: { kind, textJa: "x" } }).state,
        createTrialNotebook(),
      );
    expect(JSON.stringify(diffsForView(notebookView(withLines("FAR"))))).toBe(JSON.stringify(diffsForView(notebookView(withLines("CLOSE")))));
    expect(JSON.stringify(diffsForView(notebookView(withLines("FAR"))))).toBe(JSON.stringify(diffsForView(notebookView(notebookOf(attempts)))));
  });
  it("the diff module and sheet import no recipe / pool / hint / matcher / scoring module", () => {
    for (const f of ["src/logic/discovery/trialNotebookDiff.ts", "src/components/TrialNotebookSheet.tsx", "src/components/trialNotebookCopy.ts"]) {
      const imports = (readFileSync(f, "utf8").match(/^import .*$/gm) ?? []).join("\n");
      expect(imports).not.toMatch(/recipes|pool|candidate|hint|matcher|score|nearMiss|distance|similarity/i);
    }
  });
  it("no Near/Far or closeness wording appears in the diff copy or output", () => {
    const c = render1(notebookOf([mk([T], ["corn"]), mk(["olive-oil"], ["oregano", "mozzarella"])]));
    expect(c.textContent).not.toMatch(/近づ|遠ざ|あと[1-9１-９]つ|おしい|正解|一致|距離|類似|候補|similarity|distance|FAR|NEAR/);
  });
});
