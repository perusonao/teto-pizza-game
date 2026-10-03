import { describe, expect, it } from "vitest";
import { INGREDIENTS, getIngredient, type IngredientCategory } from "../../data/ingredients";
import { RESEARCH_ROWS_KIND, researchRowsFeedback } from "./researchResultFeedback";
import { researchResultRows, type ResearchResultRow } from "./researchResultRows";
import { createTrialNotebook, notebookView, recordAttempt } from "./trialNotebook";

/** Contract 2.1 S2: RESEARCH_ROWS feedback formatter + Trial Notebook compatibility. */
/** A canonical v1 fingerprint literal (the notebook only parses its shape). */
const FP = `fp1:${JSON.stringify([[], ["ing-00001"]])}`;
const LABEL = "？？？ピザ ①（チキン）";
const row = (ingredientId: string, category: ResearchResultRow["category"], verdict: ResearchResultRow["verdict"]): ResearchResultRow => ({ ingredientId, category, verdict });
const name = (id: string) => getIngredient(id)!.nameJa;
const fmt = (rows: ResearchResultRow[], labelJa = LABEL) => researchRowsFeedback({ labelJa, rows });

describe("format", () => {
  it("positive and negative rows, grouped, with the exact text", () => {
    const fb = fmt([
      row("pesto", "sauce", "POSITIVE"),
      row("mozzarella", "cheese", "POSITIVE"),
      row("ham", "topping", "NEGATIVE"),
      row("onion", "topping", "POSITIVE"),
    ]);
    expect(fb).toEqual({
      kind: "RESEARCH_ROWS",
      textJa: `${LABEL} ソース: ${name("pesto")}○ チーズ: ${name("mozzarella")}○ トッピング: ${name("ham")}× ${name("onion")}○`,
    });
    expect(RESEARCH_ROWS_KIND).toBe("RESEARCH_ROWS");
  });
  it("keeps the S1 order: sauce -> cheese -> topping, and placement order inside a group (no sorting)", () => {
    const fb = fmt([
      row("pesto", "sauce", "NEGATIVE"),
      row("fontina", "cheese", "NEGATIVE"),
      row("mozzarella", "cheese", "POSITIVE"),
      row("sausage", "topping", "POSITIVE"),
      row("bacon", "topping", "NEGATIVE"),
    ])!;
    expect(fb.textJa).toBe(
      `${LABEL} ソース: ${name("pesto")}× チーズ: ${name("fontina")}× ${name("mozzarella")}○ トッピング: ${name("sausage")}○ ${name("bacon")}×`,
    );
  });
  it("omits a category with no judgment", () => {
    const fb = fmt([row("mozzarella", "cheese", "NEGATIVE")])!;
    expect(fb.textJa).toBe(`${LABEL} チーズ: ${name("mozzarella")}×`);
    expect(fb.textJa).not.toMatch(/ソース|トッピング/);
  });
  it("is deterministic and keeps labelJa byte for byte", () => {
    const rows = [row("ham", "topping", "POSITIVE")];
    expect(fmt(rows)).toEqual(fmt(rows));
    const odd = "？？？ピザ ⑩（ジェノベーゼソース） ";
    expect(fmt(rows, odd)!.textJa.startsWith(odd + " ")).toBe(true);
  });
});

describe("null", () => {
  it("no rows -> null", () => expect(fmt([])).toBeNull());
  it("an over-cap-only attempt (rows 0) -> null, and nothing about the cap is written", () => {
    const pizza = { sauceIds: [] as string[], toppings: ["ham", "egg", "onion", "bacon"].map((id, i) => ({ id: `${i}`, ingredientId: id, x: i, y: i })) };
    const s1 = researchResultRows({ targetRecipeId: "meat-lovers", pizza, knownIngredientIds: [] });
    expect(s1.toppingOverCap).toBe(true);
    expect(researchRowsFeedback({ labelJa: LABEL, rows: s1.rows })).toBeNull();
  });
  it("an unknown ingredient id or an empty label is never written", () => {
    expect(fmt([row("no-such-ingredient", "topping", "POSITIVE")])).toBeNull();
    expect(fmt([row("ham", "topping", "POSITIVE")], "")).toBeNull();
  });
});

describe("S1 -> S2 one-way: known and over-cap ingredients never reach the text", () => {
  it("a known check-marked ingredient is absent because S1 never returns it", () => {
    const pizza = { sauceIds: ["tomato-sauce"], toppings: [{ id: "a", ingredientId: "ham", x: 1, y: 1 }, { id: "b", ingredientId: "egg", x: 2, y: 2 }] };
    const s1 = researchResultRows({ targetRecipeId: "meat-lovers", pizza, knownIngredientIds: ["ham", "tomato-sauce"] });
    const fb = researchRowsFeedback({ labelJa: LABEL, rows: s1.rows })!;
    expect(fb.textJa).toBe(`${LABEL} トッピング: ${name("egg")}×`);
    expect(fb.textJa).not.toContain(name("ham"));
  });
});

describe("privacy / Anti-Oracle", () => {
  const sample = fmt([row("pesto", "sauce", "NEGATIVE"), row("mozzarella", "cheese", "NEGATIVE"), row("ham", "topping", "POSITIVE")])!;
  it("has only kind and textJa, and no recipe id / name / hash", () => {
    expect(Object.keys(sample).sort()).toEqual(["kind", "textJa"]);
    const out = JSON.stringify(sample);
    // Real recipe ids and names must not appear (the label is caller-supplied and public).
    for (const r of ["margherita", "meat-lovers", "pesto-pollo", "マルゲリータ", "ミートラバーズ"]) expect(out).not.toContain(r);
  });
  it("carries no count / distance / similarity / absence / near-far wording", () => {
    const body = sample.textJa.slice(LABEL.length);
    for (const w of ["なし", "個", "種類", "全部", "あと", "残", "不足", "足りない", "近", "遠", "%", "％", "/"]) expect(body).not.toContain(w);
    expect(body).not.toMatch(/[0-9０-９]/);
  });
});

describe("200-char gate (no truncation)", () => {
  const longest = (c: IngredientCategory, n: number) =>
    [...INGREDIENTS].filter((i) => i.category === c).sort((a, b) => b.nameJa.length - a.nameJa.length).slice(0, n);
  const worstRows = (): ResearchResultRow[] => [
    ...longest("sauce", 3).map((i) => row(i.id, "sauce", "NEGATIVE")),
    ...longest("cheese", 4).map((i) => row(i.id, "cheese", "NEGATIVE")),
    ...longest("topping", 3).map((i) => row(i.id, "topping", "NEGATIVE")),
  ];
  const WORST_LABEL = "？？？ピザ ㉚（ジェノベーゼソース）";

  it("current Production worst case (sauce 3 + cheese 4 + topping 3, longest names and label) is <= 200 chars", () => {
    const fb = fmt(worstRows(), WORST_LABEL)!;
    expect(fb.textJa.length).toBeLessThanOrEqual(200);
    expect(recordAttempt(createTrialNotebook(), { fingerprint: FP, feedback: fb }).outcome.kind).not.toBe("REJECTED");
  });
  it("over 200 chars is returned whole (never truncated) and the notebook rejects it, storing nothing", () => {
    const rows = [...worstRows(), ...worstRows(), ...worstRows()];
    const fb = fmt(rows, WORST_LABEL)!;
    expect(fb.textJa.length).toBeGreaterThan(200);
    expect(fb.textJa.endsWith("×")).toBe(true);
    expect(fb.textJa.split(" ").length).toBeGreaterThan(rows.length / 2);
    const nb = createTrialNotebook();
    const res = recordAttempt(nb, { fingerprint: FP, feedback: fb });
    expect(res.outcome).toEqual({ kind: "REJECTED", reason: "INVALID_FEEDBACK" });
    expect(res.state).toBe(nb);
  });
});

describe("Trial Notebook compatibility and latest-attempt replacement (existing recordAttempt, unchanged)", () => {
  const fingerprint = FP;
  const first = (nb: ReturnType<typeof createTrialNotebook>) => notebookView(nb)[0];
  const A = fmt([row("ham", "topping", "POSITIVE")], "？？？ピザ ①（チキン）");
  const B = fmt([row("egg", "topping", "NEGATIVE")], "？？？ピザ ②（マッシュルーム）");

  it("RESEARCH_ROWS fits the existing schema (kind pattern, {kind,textJa} only)", () => {
    const res = recordAttempt(createTrialNotebook(), { fingerprint, feedback: A });
    expect(res.outcome.kind).toBe("NEW");
    expect(first(res.state).feedback).toEqual(A);
  });
  it("null -> RESEARCH_ROWS", () => {
    const n1 = recordAttempt(createTrialNotebook(), { fingerprint, feedback: null }).state;
    expect(first(n1).feedback).toBeNull();
    const n2 = recordAttempt(n1, { fingerprint, feedback: A }).state;
    expect(first(n2).feedback).toEqual(A);
  });
  it("RESEARCH_ROWS -> RESEARCH_ROWS (same combination, different Research Target label) keeps only the latest", () => {
    const n1 = recordAttempt(createTrialNotebook(), { fingerprint, feedback: A }).state;
    const n2 = recordAttempt(n1, { fingerprint, feedback: B }).state;
    expect(notebookView(n2)).toHaveLength(1);
    expect(first(n2).feedback).toEqual(B);
    expect(JSON.stringify(n2)).not.toContain("チキン");
  });
  it("RESEARCH_ROWS -> null: the old rows are not preserved", () => {
    const n1 = recordAttempt(createTrialNotebook(), { fingerprint, feedback: A }).state;
    const n2 = recordAttempt(n1, { fingerprint, feedback: null }).state;
    expect(first(n2).feedback).toBeNull();
    expect(JSON.stringify(n2)).not.toContain("RESEARCH_ROWS");
  });
});
