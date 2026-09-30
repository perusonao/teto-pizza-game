import { describe, expect, it } from "vitest";
import { ATTRIBUTE_FAMILIES } from "../../data/ingredientTaxonomy";
import type { RecipeDiscoveryState } from "../../state/recipeDiscoveryState";
import { DISCOVERY_MEMO_FAMILIES, discoveryMemoOf, type DiscoveryMemo, type DiscoveryMemoInput, type DiscoveryMemoRow } from "./discoveryMemo";

// ---- builders (the shapes of the Hint 5.0 presentation's board) ------------------------------------------
const nameEntry = (kind: "SAUCE" | "CHEESE" | "KEY_TOPPING", ids: string[], none = false) => ({ rungIndex: 1, kind, ingredientIds: ids, none });
const structureEntry = (lineJa = "材料は全部で4種類") => ({ rungIndex: 4, kind: "STRUCTURE", lineJa });
const view = (family: string) => ({ family, symbol: "\u{1F96C}", labelJa: "野菜・きのこ系", lineJa: "\u{1F96C} 野菜・きのこ系" });
const subEntry = (ordinal: number, family = "vegetable") => ({ rungIndex: 4 + ordinal, kind: "SUB_CLASS", ordinal, classView: view(family) });
const COMPLETE = "ここまでのヒントで、推理してみよう！";

type Board = unknown[];
function input(board: Board, extra: { legacy?: unknown; completeText?: unknown; onboarding?: unknown; cardState?: RecipeDiscoveryState; hint5Enabled?: boolean } = {}): DiscoveryMemoInput {
  return {
    cardState: extra.cardState ?? "DISCOVERABLE",
    hint5Enabled: extra.hint5Enabled ?? true,
    presentation: {
      board,
      legacyKnownIngredientIds: (extra.legacy ?? []) as string[],
      completeText: (extra.completeText ?? null) as string | null,
      onboarding: (extra.onboarding ?? false) as boolean,
    } as never,
  };
}
const memoOf = (board: Board, extra?: Parameters<typeof input>[1]) => discoveryMemoOf(input(board, extra));
const kinds = (m: DiscoveryMemo) => m.rows.map((r) => r.kind);
const row = (m: DiscoveryMemo, kind: DiscoveryMemoRow["kind"]) => m.rows.find((r) => r.kind === kind);

describe("Discovery memo — gates (only DISCOVERABLE, flag on, ladder target, not the onboarding)", () => {
  const board = [nameEntry("SAUCE", ["tomato-sauce"], false)];
  it.each<[RecipeDiscoveryState, boolean]>([
    ["DISCOVERABLE", true],
    ["DISCOVERED", false],
    ["KNOWN_BUT_MISSING_MATERIAL", false],
    ["UNKNOWN", false],
  ])("card state %s -> memo: %s", (cardState, has) => {
    expect(discoveryMemoOf(input(board, { cardState })) !== null).toBe(has);
  });

  it("the flag off gives no memo", () => {
    expect(discoveryMemoOf(input(board, { hint5Enabled: false }))).toBeNull();
    expect(discoveryMemoOf({ ...input(board), hint5Enabled: "true" as never })).toBeNull();
  });

  it("no presentation (not a ladder target) gives no memo", () => {
    expect(discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation: null })).toBeNull();
  });

  it("the Dex-0 onboarding gives no memo (anything but a strict false fails closed)", () => {
    expect(discoveryMemoOf(input(board, { onboarding: true }))).toBeNull();
    expect(discoveryMemoOf(input(board, { onboarding: "false" as never }))).toBeNull();
    const absent = input(board);
    delete (absent.presentation as unknown as Record<string, unknown>).onboarding;
    expect(discoveryMemoOf(absent)).toBeNull();
  });

  it.each([null, undefined, 0, "x", [], () => 1])("a non-object input (%s) gives no memo and never throws", (bad) => {
    expect(discoveryMemoOf(bad as never)).toBeNull();
  });

  it("a card that leaves DISCOVERABLE shows nothing and, when it returns, shows the same memo again", () => {
    const board2 = [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", [], true)];
    const first = discoveryMemoOf(input(board2));
    expect(first).not.toBeNull();
    expect(discoveryMemoOf(input(board2, { cardState: "KNOWN_BUT_MISSING_MATERIAL" }))).toBeNull();
    expect(discoveryMemoOf(input(board2, { cardState: "UNKNOWN" }))).toBeNull();
    expect(JSON.stringify(discoveryMemoOf(input(board2)))).toBe(JSON.stringify(first));
  });
});

describe("Discovery memo — nothing bought", () => {
  it("the four fixed rows are constants: UNKNOWN, no id, no count", () => {
    const m = memoOf([])!;
    expect(m.rows).toEqual([
      { kind: "sauce", status: "UNKNOWN" },
      { kind: "cheese", status: "UNKNOWN" },
      { kind: "keyTopping", status: "UNKNOWN" },
      { kind: "structure", status: "UNKNOWN" },
    ]);
    expect(m.completion).toBe("IN_PROGRESS");
    expect(m.hasKnownFact).toBe(false);
  });
});

describe("Discovery memo — each rung, in the order it is bought", () => {
  it("sauce: the ladder's ingredient ids, nothing else known", () => {
    const m = memoOf([nameEntry("SAUCE", ["tomato-sauce"])])!;
    expect(row(m, "sauce")).toEqual({ kind: "sauce", status: "KNOWN", ingredientIds: ["tomato-sauce"] });
    expect(m.rows.slice(1, 4).every((r) => "status" in r && r.status === "UNKNOWN")).toBe(true);
    expect(m.hasKnownFact).toBe(true);
  });

  it("cheese: names, and 「なし」 when the authority says the rung is empty", () => {
    expect(row(memoOf([nameEntry("CHEESE", ["mozzarella", "parmigiano"])])!, "cheese")).toEqual({ kind: "cheese", status: "KNOWN", ingredientIds: ["mozzarella", "parmigiano"] });
    expect(row(memoOf([nameEntry("CHEESE", [], true)])!, "cheese")).toEqual({ kind: "cheese", status: "NONE" });
  });

  it("key topping: a name, and 「なし」 for an empty bought rung", () => {
    expect(row(memoOf([nameEntry("KEY_TOPPING", ["basil"])])!, "keyTopping")).toEqual({ kind: "keyTopping", status: "KNOWN", ingredientIds: ["basil"] });
    expect(row(memoOf([nameEntry("KEY_TOPPING", [], true)])!, "keyTopping")).toEqual({ kind: "keyTopping", status: "NONE" });
  });

  it("structure: the authority's own line, passed through unparsed", () => {
    expect(row(memoOf([structureEntry("材料は全部で5種類")])!, "structure")).toEqual({ kind: "structure", status: "KNOWN", lineJa: "材料は全部で5種類" });
  });

  it("a full progression: rows appear only as their rung is bought and never reorder", () => {
    const steps: Board[] = [
      [nameEntry("SAUCE", ["tomato-sauce"])],
      [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", ["mozzarella"])],
      [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", ["mozzarella"]), nameEntry("KEY_TOPPING", ["mushroom"])],
      [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", ["mozzarella"]), nameEntry("KEY_TOPPING", ["mushroom"]), structureEntry()],
      [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", ["mozzarella"]), nameEntry("KEY_TOPPING", ["mushroom"]), structureEntry(), subEntry(1)],
    ];
    const known = steps.map((b) => memoOf(b)!.rows.slice(0, 4).filter((r) => "status" in r && r.status !== "UNKNOWN").length);
    expect(known).toEqual([1, 2, 3, 4, 4]);
    for (const b of steps) expect(kinds(memoOf(b)!).slice(0, 4)).toEqual(["sauce", "cheese", "keyTopping", "structure"]);
  });
});

describe("Discovery memo — sub-topping families", () => {
  const fixed = [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", ["mozzarella"]), nameEntry("KEY_TOPPING", ["ham"])];

  it("before STRUCTURE there is no family row, no placeholder and no slot, even if a SUB_CLASS entry is present", () => {
    const m = memoOf([...fixed, subEntry(1), subEntry(2, "meat")])!;
    expect(m.rows.some((r) => r.kind === "subToppingFamily")).toBe(false);
    expect(m.rows).toHaveLength(4); // the four fixed rows only
  });

  it("after STRUCTURE: one typed family row per bought rung, in ordinal order, with the family view only", () => {
    const m = memoOf([...fixed, structureEntry(), subEntry(1, "vegetable"), subEntry(2, "meat")])!;
    const subs = m.rows.filter((r) => r.kind === "subToppingFamily");
    expect(subs).toEqual([
      { kind: "subToppingFamily", ordinal: 1, family: "vegetable", symbol: "\u{1F96C}", labelJa: "野菜・きのこ系", lineJa: "\u{1F96C} 野菜・きのこ系" },
      { kind: "subToppingFamily", ordinal: 2, family: "meat", symbol: "\u{1F96C}", labelJa: "野菜・きのこ系", lineJa: "\u{1F96C} 野菜・きのこ系" },
    ]);
    expect(Object.keys(subs[0]).sort()).toEqual(["family", "kind", "labelJa", "lineJa", "ordinal", "symbol"]);
  });

  it("there is never a row for a rung that is not bought (that would disclose a count)", () => {
    const m = memoOf([...fixed, structureEntry(), subEntry(1)])!;
    expect(m.rows.filter((r) => r.kind === "subToppingFamily")).toHaveLength(1);
  });

  it.each([
    ["an unknown family", { ...subEntry(1), classView: view("dessert") }],
    ["a missing class view", { rungIndex: 5, kind: "SUB_CLASS", ordinal: 1 }],
    ["a zero ordinal", subEntry(0)],
    ["a fractional ordinal", subEntry(1.5)],
    ["a string ordinal", { ...subEntry(1), ordinal: "1" }],
    ["an empty symbol", { ...subEntry(1), classView: { ...view("meat"), symbol: "" } }],
    ["a non-string label", { ...subEntry(1), classView: { ...view("meat"), labelJa: 7 } }],
  ])("a malformed family entry (%s) is dropped, not guessed", (_name, entry) => {
    expect(memoOf([...fixed, structureEntry(), entry])!.rows.some((r) => r.kind === "subToppingFamily")).toBe(false);
  });

  it("a repeated ordinal keeps the first row only", () => {
    const m = memoOf([...fixed, structureEntry(), subEntry(1, "meat"), subEntry(1, "herb")])!;
    expect(m.rows.filter((r) => r.kind === "subToppingFamily")).toHaveLength(1);
    expect((row(m, "subToppingFamily") as unknown as { family: string }).family).toBe("meat");
  });

  it("the family list is exactly the Hint 5.0 / taxonomy families", () => {
    expect([...DISCOVERY_MEMO_FAMILIES].sort()).toEqual(ATTRIBUTE_FAMILIES.map((f) => f.id).sort());
  });
});

describe("Discovery memo — complete", () => {
  const all = [nameEntry("SAUCE", ["tomato-sauce"]), nameEntry("CHEESE", [], true), nameEntry("KEY_TOPPING", ["basil"]), structureEntry()];

  it("the fixed complete row appears exactly when the authority says so and every fixed row is settled", () => {
    const m = memoOf(all, { completeText: COMPLETE })!;
    expect(m.completion).toBe("COMPLETE");
    expect(m.rows[m.rows.length - 1]).toEqual({ kind: "complete", lineJa: COMPLETE });
    expect(memoOf(all)!.completion).toBe("IN_PROGRESS");
  });

  it("a complete line without the fixed facts is ignored (fail closed)", () => {
    const m = memoOf([nameEntry("SAUCE", ["tomato-sauce"])], { completeText: COMPLETE })!;
    expect(m.completion).toBe("IN_PROGRESS");
    expect(m.rows.some((r) => r.kind === "complete")).toBe(false);
  });

  it.each([5, "", "x".repeat(201), {}, []])("a malformed complete text (%j) gives no memo", (bad) => {
    expect(memoOf(all, { completeText: bad })).toBeNull();
  });
});

describe("Discovery memo — earlier hints (D-2) and the exclusion of free text (D-1)", () => {
  it("owned exact ingredient names appear as typed rows after the facts, in the given order", () => {
    const m = memoOf([nameEntry("SAUCE", ["tomato-sauce"])], { legacy: ["mushroom", "ham"] })!;
    expect(m.rows.filter((r) => r.kind === "legacyIngredient")).toEqual([
      { kind: "legacyIngredient", ingredientId: "mushroom" },
      { kind: "legacyIngredient", ingredientId: "ham" },
    ]);
    expect(m.hasKnownFact).toBe(true);
  });

  it("a legacy name that a fact row already shows is not repeated; duplicates collapse", () => {
    const m = memoOf([nameEntry("KEY_TOPPING", ["mushroom"])], { legacy: ["mushroom", "ham", "ham"] })!;
    expect(m.rows.filter((r) => r.kind === "legacyIngredient")).toEqual([{ kind: "legacyIngredient", ingredientId: "ham" }]);
  });

  it("a legacy name completes nothing: every fixed row stays UNKNOWN", () => {
    const m = memoOf([], { legacy: ["basil", "mozzarella", "tomato-sauce"] })!;
    expect(m.rows.slice(0, 4).every((r) => "status" in r && r.status === "UNKNOWN")).toBe(true);
    expect(m.completion).toBe("IN_PROGRESS");
  });

  it.each([["an uppercase id", ["Ham"]], ["a free-text line", ["チーズは使わないみたい"]], ["a non-string", [1]], ["an id with a space", ["sun dried"]]])("a legacy entry that is not an ingredient id (%s) invalidates the list, and a line is never turned into a fact", (_n, bad) => {
    const m = memoOf([nameEntry("SAUCE", ["tomato-sauce"])], { legacy: bad })!;
    expect(m.rows.some((r) => r.kind === "legacyIngredient")).toBe(false);
  });

  it("free-text fields of the Hint 5.0 / earlier presentations are never read or copied", () => {
    const base = input([nameEntry("SAUCE", ["tomato-sauce"])]);
    const noisy = {
      ...base,
      presentation: {
        ...(base.presentation as object),
        next: { rungIndex: 2, kind: "CHEESE", labelJa: "ヒント2: チーズ", price: 10, affordable: true },
        pitzBalance: 999,
        grandfatheredSteps: [{ textJa: "チーズは使わないみたい" }],
        deduction: { structureLines: ["材料は全部で9種類"], attributeLines: ["肉系のなかまがいるよ"] },
        recipeId: "margherita",
        nameJa: "マルゲリータ",
        description: "トマトソース・モッツァレラ・バジルだけで作る",
        candidates: ["a", "b"],
        candidateCount: 2,
      },
    } as never;
    expect(JSON.stringify(discoveryMemoOf(noisy))).toBe(JSON.stringify(discoveryMemoOf(base)));
    const json = JSON.stringify(discoveryMemoOf(noisy));
    for (const leaked of ["チーズは使わない", "材料は全部で9", "肉系のなかま", "ヒント2", "999", "margherita", "マルゲリータ", "トマトソース・モッツァレラ", "candidate", "Pitz"]) expect(json).not.toContain(leaked);
  });
});

describe("Discovery memo — size limits (an over-long list is malformed, never truncated)", () => {
  const fixed = [nameEntry("SAUCE", ["tomato-sauce"]), structureEntry()];

  it("more than 32 family entries draw no family row at all", () => {
    const subs = Array.from({ length: 33 }, (_, i) => subEntry(i + 1));
    expect(memoOf([...fixed, ...subs])!.rows.some((r) => r.kind === "subToppingFamily")).toBe(false);
    expect(memoOf([...fixed, ...subs.slice(0, 32)])!.rows.filter((r) => r.kind === "subToppingFamily")).toHaveLength(32);
  });

  it("more than 256 earlier-hint names draw no legacy row; 256 are kept", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `ing-${i}`);
    expect(memoOf([], { legacy: names(257) })!.rows.some((r) => r.kind === "legacyIngredient")).toBe(false);
    expect(memoOf([], { legacy: names(256) })!.rows.filter((r) => r.kind === "legacyIngredient")).toHaveLength(256);
  });

  it("a structure line or class text longer than 200 characters is not shown", () => {
    expect(row(memoOf([structureEntry("あ".repeat(201))])!, "structure")).toEqual({ kind: "structure", status: "UNKNOWN" });
    expect(row(memoOf([structureEntry("あ".repeat(200))])!, "structure")).toMatchObject({ status: "KNOWN" });
    const long = { ...subEntry(1), classView: { ...view("meat"), lineJa: "あ".repeat(201) } };
    expect(memoOf([...fixed, long])!.rows.some((r) => r.kind === "subToppingFamily")).toBe(false);
  });
});

describe("Discovery memo — fail closed on a malformed board", () => {
  it.each([
    ["sauce without ids", [{ rungIndex: 1, kind: "SAUCE", none: false }]],
    ["sauce with an empty list and no none flag", [nameEntry("SAUCE", [])]],
    ["sauce 'none' (an empty sauce rung is reserved and never said)", [nameEntry("SAUCE", [], true)]],
    ["sauce with none and an id", [nameEntry("SAUCE", ["tomato-sauce"], true)]],
    ["cheese 'none' with an id", [nameEntry("CHEESE", ["mozzarella"], true)]],
    ["an invalid id", [nameEntry("SAUCE", ["Tomato Sauce"])]],
    ["a proto id", [nameEntry("SAUCE", ["__proto__"])]],
    ["an id that is not a string", [nameEntry("SAUCE", [5 as never])]],
    ["ids that are not an array", [{ rungIndex: 1, kind: "SAUCE", ingredientIds: "tomato-sauce", none: false }]],
    ["a none flag that is not a boolean", [{ rungIndex: 1, kind: "SAUCE", ingredientIds: ["tomato-sauce"], none: "no" }]],
    ["too many ids", [nameEntry("SAUCE", Array.from({ length: 33 }, (_, i) => `ing-${i}`))]],
  ])("%s -> that row stays UNKNOWN", (_name, board) => {
    const m = memoOf(board as Board)!;
    expect(m.rows[0]).toEqual({ kind: "sauce", status: "UNKNOWN" });
    expect(m.hasKnownFact).toBe(false);
  });

  it("junk entries and unknown kinds are skipped; the first entry of a kind wins", () => {
    const m = memoOf([null, 5, "x", [], { kind: 7 }, { kind: "FUTURE_RUNG", ingredientIds: ["x"] }, nameEntry("SAUCE", ["pesto"]), nameEntry("SAUCE", ["tomato-sauce"])])!;
    expect(row(m, "sauce")).toEqual({ kind: "sauce", status: "KNOWN", ingredientIds: ["pesto"] });
    expect(JSON.stringify(m)).not.toContain("FUTURE_RUNG");
  });

  it.each([
    ["a board that is not an array", { board: {}, legacyKnownIngredientIds: [], completeText: null, onboarding: false }],
    ["legacy that is not an array", { board: [], legacyKnownIngredientIds: "x", completeText: null, onboarding: false }],
    ["a structure line that is not text", { board: [{ kind: "STRUCTURE", lineJa: 4 }], legacyKnownIngredientIds: [], completeText: null, onboarding: false }],
  ])("%s", (name, presentation) => {
    const m = discoveryMemoOf({ cardState: "DISCOVERABLE", hint5Enabled: true, presentation: presentation as never });
    if (name.startsWith("a structure")) expect(row(m!, "structure")).toEqual({ kind: "structure", status: "UNKNOWN" });
    else expect(m).toBeNull();
  });

  it("hostile property names on the board never throw and add nothing", () => {
    const hostile = JSON.parse('[{"kind":"__proto__","ingredientIds":["x"]},{"__proto__":{"kind":"SAUCE"}},{"kind":"constructor"},{"kind":"SAUCE","ingredientIds":["tomato-sauce"],"none":false,"__proto__":{"none":true}}]');
    const m = memoOf(hostile)!;
    expect(row(m, "sauce")).toEqual({ kind: "sauce", status: "KNOWN", ingredientIds: ["tomato-sauce"] });
    expect(({} as Record<string, unknown>).none).toBeUndefined();
  });

  it("the output never shares mutable state with the input", () => {
    const ids = ["tomato-sauce"];
    const m = memoOf([nameEntry("SAUCE", ids)])!;
    ids.push("changed");
    expect((row(m, "sauce") as unknown as { ingredientIds: string[] }).ingredientIds).toEqual(["tomato-sauce"]);
  });
});

// ---- property / fuzz --------------------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Discovery memo — property / fuzz", () => {
  const FIXED_ORDER = ["sauce", "cheese", "keyTopping", "structure"];
  const ALLOWED_ROW_KEYS: Record<string, string[]> = {
    sauce: ["kind", "status"],
    cheese: ["kind", "status"],
    keyTopping: ["kind", "status"],
    structure: ["kind", "status"],
    subToppingFamily: ["family", "kind", "labelJa", "lineJa", "ordinal", "symbol"],
    legacyIngredient: ["ingredientId", "kind"],
    complete: ["kind", "lineJa"],
  };

  function junk(rnd: () => number): unknown {
    const pool: unknown[] = [null, undefined, 0, -1, 1.5, NaN, "", "x", "Ham", "SAUCE", [], {}, [1], { kind: "SAUCE" }, true, false, () => 1];
    return pool[Math.floor(rnd() * pool.length)];
  }
  function randomEntry(rnd: () => number): unknown {
    const ids = ["tomato-sauce", "mozzarella", "basil", "ham", "mushroom", "pesto"];
    const pickIds = () => ids.filter(() => rnd() < 0.4);
    switch (Math.floor(rnd() * 7)) {
      case 0: return nameEntry("SAUCE", pickIds(), rnd() < 0.2);
      case 1: return nameEntry("CHEESE", pickIds(), rnd() < 0.3);
      case 2: return nameEntry("KEY_TOPPING", pickIds(), rnd() < 0.3);
      case 3: return structureEntry(rnd() < 0.8 ? "材料は全部で4種類" : (junk(rnd) as never));
      case 4: return subEntry(1 + Math.floor(rnd() * 4), ["meat", "herb", "vegetable", "dessert"][Math.floor(rnd() * 4)]);
      case 5: return { kind: junk(rnd), ingredientIds: junk(rnd), none: junk(rnd), ordinal: junk(rnd), classView: junk(rnd), lineJa: junk(rnd) };
      default: return junk(rnd);
    }
  }

  it("never throws, is deterministic, and every output obeys the structural invariants", () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const rnd = mulberry32(seed * 104729);
      const board = Array.from({ length: Math.floor(rnd() * 10) }, () => randomEntry(rnd));
      const legacy = rnd() < 0.8 ? ["basil", "ham", "ham", "mushroom"].filter(() => rnd() < 0.5) : [junk(rnd)];
      const completeText = rnd() < 0.3 ? COMPLETE : rnd() < 0.1 ? junk(rnd) : null;
      const cardState = (["DISCOVERABLE", "DISCOVERABLE", "DISCOVERABLE", "DISCOVERED", "UNKNOWN", "KNOWN_BUT_MISSING_MATERIAL"] as const)[Math.floor(rnd() * 6)];
      const i = input(board, { legacy, completeText, cardState, onboarding: rnd() < 0.1 });
      const a = discoveryMemoOf(i);
      expect(JSON.stringify(discoveryMemoOf(i)), `seed ${seed}`).toBe(JSON.stringify(a));
      if (!a) continue;
      expect(cardState).toBe("DISCOVERABLE");
      expect(kinds(a).slice(0, 4), `seed ${seed}`).toEqual(FIXED_ORDER);
      const order = ["sauce", "cheese", "keyTopping", "structure", "subToppingFamily", "legacyIngredient", "complete"];
      const ranks = a.rows.map((r) => order.indexOf(r.kind));
      expect(ranks, `seed ${seed}: rows out of order`).toEqual([...ranks].sort((x, y) => x - y));
      for (const r of a.rows) {
        const extra = "status" in r && r.status === "KNOWN" ? (r.kind === "structure" ? ["lineJa"] : ["ingredientIds"]) : [];
        expect(Object.keys(r).sort(), `seed ${seed}`).toEqual([...ALLOWED_ROW_KEYS[r.kind], ...extra].sort());
      }
      const structureKnown = a.rows[3].kind === "structure" && a.rows[3].status === "KNOWN";
      if (!structureKnown) expect(a.rows.some((r) => r.kind === "subToppingFamily"), `seed ${seed}: family without structure`).toBe(false);
      const ordinals = a.rows.filter((r) => r.kind === "subToppingFamily").map((r) => (r as { ordinal: number }).ordinal);
      expect(new Set(ordinals).size).toBe(ordinals.length);
      expect(a.rows[0]).not.toMatchObject({ status: "NONE" }); // never "no sauce"
      expect((a.completion === "COMPLETE"), `seed ${seed}`).toBe(a.rows.some((r) => r.kind === "complete"));
      if (a.completion === "COMPLETE") expect(a.rows.slice(0, 4).every((r) => "status" in r && r.status !== "UNKNOWN")).toBe(true);
      for (const r of a.rows) {
        if ("ingredientIds" in r) for (const id of r.ingredientIds) expect(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)).toBe(true);
        if (r.kind === "legacyIngredient") expect(/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.ingredientId)).toBe(true);
      }
      expect(a.hasKnownFact).toBe(a.rows.some((r, idx) => idx >= 4 || ("status" in r && r.status !== "UNKNOWN")));
    }
  });

  it("the same presentation facts give the same output, whatever else the object carries", () => {
    const rnd = mulberry32(2024);
    for (let n = 0; n < 200; n += 1) {
      const board = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => randomEntry(rnd));
      const base = input(board, { legacy: ["ham"], completeText: rnd() < 0.5 ? COMPLETE : null });
      const extras = { recipeId: `r${n}`, nameJa: `n${n}`, description: `d${n}`, next: { price: n }, pitzBalance: n, candidateCount: n, technique: `t${n}` };
      const noisy = { ...base, presentation: { ...(base.presentation as object), ...extras } } as never;
      expect(JSON.stringify(discoveryMemoOf(noisy))).toBe(JSON.stringify(discoveryMemoOf(base)));
    }
  });
});
