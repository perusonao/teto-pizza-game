import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "../../state/pizzaState";
import { attemptFingerprintOfPizza } from "./attemptFingerprint";
import {
  DEFAULT_TRIAL_NOTEBOOK_LIMITS,
  TRIAL_NOTEBOOK_DISPLAY_LIMIT,
  TRIAL_NOTEBOOK_IDENTITY_LIMIT,
  createTrialNotebook,
  lookupAttempt,
  notebookSize,
  notebookView,
  recordAttempt,
  trialNotebookViolations,
  type RecordOutcome,
  type ShownFeedback,
  type TrialNotebook,
} from "./trialNotebook";

function piece(ingredientId: string, i: number): PlacedTopping {
  return { id: `p-${ingredientId}-${i}`, ingredientId, x: 20 + i * 3, y: 30 + i * 2 };
}
function pizzaOf(sauceIds: string[], pieces: string[]): PizzaState {
  return { ...createEmptyPizza(), sauceIds, toppings: pieces.map(piece), bakeResult: 70 };
}
const fp = (sauces: string[], pieces: string[]) => attemptFingerprintOfPizza(pizzaOf(sauces, pieces));
/** A canonical v1 fingerprint for a synthetic single-ingredient combination `i` (no pizza needed). */
const synth = (i: number): string => `fp1:${JSON.stringify([[], [`ing-${String(i).padStart(5, "0")}`]])}`;

const ADD_ONE: ShownFeedback = { kind: "ADD_ONE", textJa: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！" };
const FAR: ShownFeedback = { kind: "FAR", textJa: "\u{1F9EA} 別の組み合わせも試してみよう！" };

/** Shorthand: record and return both parts. */
function rec(nb: TrialNotebook, fingerprint: unknown, feedback: unknown = null) {
  return recordAttempt(nb, { fingerprint, feedback });
}
function mustBe<K extends RecordOutcome["kind"]>(outcome: RecordOutcome, kind: K): Extract<RecordOutcome, { kind: K }> {
  expect(outcome.kind).toBe(kind);
  return outcome as Extract<RecordOutcome, { kind: K }>;
}
const numbers = (nb: TrialNotebook) => notebookView(nb).map((e) => e.number);

describe("Trial Notebook — Phase 1 authority and construction", () => {
  it("the Phase 1 limits are 50 display rows / 2 000 identities (OD-P3-12)", () => {
    expect(TRIAL_NOTEBOOK_DISPLAY_LIMIT).toBe(50);
    expect(TRIAL_NOTEBOOK_IDENTITY_LIMIT).toBe(2000);
    expect(DEFAULT_TRIAL_NOTEBOOK_LIMITS).toEqual({ display: 50, identity: 2000 });
    expect(createTrialNotebook().limits).toEqual({ display: 50, identity: 2000 });
  });

  it("an empty notebook has no rows, no identities and starts numbering at 1", () => {
    const nb = createTrialNotebook();
    expect(notebookView(nb)).toEqual([]);
    expect(notebookSize(nb)).toEqual({ display: 0, identities: 0, nextNumber: 1 });
    expect(trialNotebookViolations(nb)).toEqual([]);
  });

  it.each([
    { display: 0, identity: 5 },
    { display: 3, identity: 0 },
    { display: 6, identity: 5 },
    { display: 1.5, identity: 5 },
    { display: -1, identity: 5 },
    { display: Number.NaN, identity: 5 },
  ])("invalid limits %j throw", (limits) => {
    expect(() => createTrialNotebook(limits)).toThrow(RangeError);
  });
});

describe("Trial Notebook — recording", () => {
  it("first attempt: NEW #1 with the player's own combination and the feedback as shown", () => {
    const f = fp(["tomato-sauce"], ["mozzarella", "basil"]);
    const { state, outcome } = rec(createTrialNotebook(), f, ADD_ONE);
    expect(outcome).toEqual({ kind: "NEW", number: 1 });
    expect(notebookView(state)).toEqual([
      {
        number: 1,
        retryCount: 0,
        combination: { sauceBase: ["tomato-sauce"], ingredientSet: ["basil", "mozzarella", "tomato-sauce"] },
        feedback: ADD_ONE,
      },
    ]);
    expect(notebookSize(state)).toEqual({ display: 1, identities: 1, nextNumber: 2 });
    expect(trialNotebookViolations(state)).toEqual([]);
  });

  it("exact duplicate: no new row, retryCount goes up, #n stays", () => {
    let nb = rec(createTrialNotebook(), fp(["tomato-sauce"], ["mozzarella"]), ADD_ONE).state;
    const again = rec(nb, fp(["tomato-sauce"], ["mozzarella"]), ADD_ONE);
    expect(again.outcome).toEqual({ kind: "DUPLICATE", number: 1, retryCount: 1, revived: false });
    nb = again.state;
    expect(notebookSize(nb)).toEqual({ display: 1, identities: 1, nextNumber: 2 });
    expect(notebookView(nb)[0]).toMatchObject({ number: 1, retryCount: 1 });
    expect(mustBe(rec(nb, fp(["tomato-sauce"], ["mozzarella"])).outcome, "DUPLICATE").retryCount).toBe(2);
  });

  it("ingredient order is not identity (fingerprint contract)", () => {
    const a = rec(createTrialNotebook(), fp(["tomato-sauce"], ["mozzarella", "basil", "ham"]));
    const b = rec(a.state, fp(["tomato-sauce"], ["ham", "mozzarella", "basil"]));
    expect(mustBe(b.outcome, "DUPLICATE").number).toBe(1);
  });

  it("duplicate pieces / quantity are not identity (fingerprint contract)", () => {
    const a = rec(createTrialNotebook(), fp(["tomato-sauce"], ["mozzarella", "ham"]));
    const b = rec(a.state, fp(["tomato-sauce"], ["mozzarella", "mozzarella", "mozzarella", "ham", "ham"]));
    expect(mustBe(b.outcome, "DUPLICATE").number).toBe(1);
    expect(notebookSize(b.state).identities).toBe(1);
  });

  it("a different sauce is a different attempt", () => {
    const a = rec(createTrialNotebook(), fp(["tomato-sauce"], ["mozzarella"]));
    const b = rec(a.state, fp(["pesto"], ["mozzarella"]));
    expect(mustBe(b.outcome, "NEW").number).toBe(2);
  });

  it("a different ingredient set is a different attempt", () => {
    const a = rec(createTrialNotebook(), fp(["tomato-sauce"], ["mozzarella"]));
    const b = rec(a.state, fp(["tomato-sauce"], ["mozzarella", "ham"]));
    expect(mustBe(b.outcome, "NEW").number).toBe(2);
  });

  it("no sauce is its own attempt, and a sauce used as a piece is not the same as a sauce base", () => {
    let nb = createTrialNotebook();
    nb = rec(nb, fp([], ["mozzarella"])).state;
    nb = rec(nb, fp(["tomato-sauce"], ["mozzarella"])).state;
    const asPiece = rec(nb, fp([], ["mozzarella", "tomato-sauce"]));
    expect(mustBe(asPiece.outcome, "NEW").number).toBe(3);
  });

  it("numbers are stable and sequential; the view is newest activity first", () => {
    let nb = createTrialNotebook();
    for (const i of [1, 2, 3]) nb = rec(nb, synth(i)).state;
    expect(numbers(nb)).toEqual([3, 2, 1]);
    nb = rec(nb, synth(1)).state; // a retry is the newest activity, #1 keeps its number
    expect(numbers(nb)).toEqual([1, 3, 2]);
    expect(notebookView(nb).find((e) => e.number === 1)!.retryCount).toBe(1);
    expect(mustBe(rec(nb, synth(4)).outcome, "NEW").number).toBe(4);
  });

  it("a retry replaces the row's feedback with the latest line shown, exactly as shown", () => {
    let nb = rec(createTrialNotebook(), synth(1), ADD_ONE).state;
    nb = rec(nb, synth(1), FAR).state;
    expect(notebookView(nb)[0].feedback).toEqual(FAR);
    nb = rec(nb, synth(1), null).state;
    expect(notebookView(nb)[0].feedback).toBeNull();
  });

  it("does not mutate its input and shares nothing mutable with the caller", () => {
    const before = rec(createTrialNotebook(), synth(1), ADD_ONE).state;
    const snapshot = JSON.stringify(before);
    const fb = { kind: "ADD_ONE", textJa: "x" };
    const next = rec(before, synth(2), fb);
    expect(JSON.stringify(before)).toBe(snapshot);
    fb.textJa = "changed after the call";
    expect(notebookView(next.state)[0].feedback!.textJa).toBe("x");
    const view = notebookView(next.state);
    (view[0].combination.ingredientSet as string[]).push("mutated");
    expect(notebookView(next.state)[0].combination.ingredientSet).toEqual(["ing-00002"]);
  });
});

describe("Trial Notebook — fail closed", () => {
  const nbWith = () => rec(createTrialNotebook(), synth(1), ADD_ONE).state;

  it.each([
    ["not a string", 42],
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["no version prefix", '[["a"],["a"]]'],
    ["bad json", "fp1:[[["],
    ["unsorted ids", 'fp1:[[],["b","a"]]'],
    ["duplicated ids", 'fp1:[[],["a","a"]]'],
    ["sauce not in the set", 'fp1:[["s"],["a"]]'],
    ["trailing junk", `${synth(1)} `],
    ["wrong payload length", 'fp1:[[]]'],
    ["version 0", "fp0:[[],[]]"],
  ])("a malformed fingerprint (%s) is rejected and nothing changes", (_name, bad) => {
    const nb = nbWith();
    const r = rec(nb, bad);
    expect(r.outcome).toEqual({ kind: "REJECTED", reason: "MALFORMED" });
    expect(r.state).toBe(nb);
    expect(lookupAttempt(nb, bad)).toEqual({ kind: "REJECTED", reason: "MALFORMED" });
  });

  it("another fingerprint version is UNSUPPORTED, not coerced, not stored", () => {
    const nb = nbWith();
    const r = rec(nb, 'fp2:[[],["a"]]');
    expect(r.outcome).toEqual({ kind: "REJECTED", reason: "UNSUPPORTED_VERSION" });
    expect(r.state).toBe(nb);
    expect(lookupAttempt(nb, "fp9:whatever")).toEqual({ kind: "REJECTED", reason: "UNSUPPORTED_VERSION" });
  });

  it("an input that is not an object is rejected", () => {
    const nb = nbWith();
    expect(recordAttempt(nb, null as never).outcome).toEqual({ kind: "REJECTED", reason: "MALFORMED" });
    expect(recordAttempt(nb, undefined as never).outcome).toEqual({ kind: "REJECTED", reason: "MALFORMED" });
  });

  it.each([
    ["undefined (must be null)", undefined],
    ["a string", "おしい"],
    ["an array", []],
    ["missing textJa", { kind: "ADD_ONE" }],
    ["missing kind", { textJa: "x" }],
    ["extra key (a hidden field would ride along)", { kind: "ADD_ONE", textJa: "x", distance: 1 }],
    ["extra key: recipe", { kind: "ADD_ONE", textJa: "x", recipeId: "margherita" }],
    ["kind not a string", { kind: 1, textJa: "x" }],
    ["kind lower case", { kind: "add_one", textJa: "x" }],
    ["kind too long", { kind: "A".repeat(33), textJa: "x" }],
    ["empty text", { kind: "ADD_ONE", textJa: "" }],
    ["text too long", { kind: "ADD_ONE", textJa: "あ".repeat(201) }],
    ["text not a string", { kind: "ADD_ONE", textJa: 5 }],
  ])("an invalid feedback (%s) is rejected and nothing changes", (_name, bad) => {
    const nb = nbWith();
    const r = recordAttempt(nb, { fingerprint: synth(2), feedback: bad }); // not `rec`: its default would turn undefined into null
    expect(r.outcome).toEqual({ kind: "REJECTED", reason: "INVALID_FEEDBACK" });
    expect(r.state).toBe(nb);
  });

  it("a valid fingerprint with a bad feedback is not stored, so it is still untried afterwards", () => {
    const nb = nbWith();
    rec(nb, synth(2), { nope: true });
    expect(lookupAttempt(nb, synth(2))).toEqual({ kind: "UNTRIED" });
  });
});

describe("Trial Notebook — P2 feedback is stored exactly as shown", () => {
  it("keeps kind and text byte for byte, for every P2 kind, and null when no line was shown", () => {
    const lines: ShownFeedback[] = [
      { kind: "ADD_ONE", textJa: "\u{1F90F} おしい！ 材料をあと1つ足すと、何か見つかりそう！" },
      { kind: "REMOVE_ONE", textJa: "\u{1F90F} おしい！ 材料を1つ減らすと、何か見つかりそう！" },
      { kind: "SAUCE_ONLY", textJa: "\u{1F90F} おしい！ ソースを変えると、何か見つかりそう！" },
      { kind: "CLOSE", textJa: "\u{1F440} かなり近づいてるよ。少しだけ変えてみよう！" },
      { kind: "FAR", textJa: "\u{1F6D2} 新しく入荷した材料は使ってみた？" },
      { kind: "FAR", textJa: "\u{1F9EA} 別の組み合わせも試してみよう！" },
    ];
    let nb = createTrialNotebook();
    lines.forEach((line, i) => (nb = rec(nb, synth(i + 1), line).state));
    nb = rec(nb, synth(99), null).state;
    const view = notebookView(nb);
    expect(view[0].feedback).toBeNull();
    lines.forEach((line, i) => expect(view.find((e) => e.number === i + 1)!.feedback).toEqual(line));
  });

  it("the stored value is a copy of exactly { kind, textJa }", () => {
    const nb = rec(createTrialNotebook(), synth(1), ADD_ONE).state;
    expect(Object.keys(notebookView(nb)[0].feedback!).sort()).toEqual(["kind", "textJa"]);
  });
});

describe("Trial Notebook — no hidden information", () => {
  it("a row, the internal state and every outcome carry only the allowed keys", () => {
    let nb = createTrialNotebook();
    const first = rec(nb, fp(["tomato-sauce"], ["mozzarella"]), ADD_ONE);
    nb = first.state;
    const dup = rec(nb, fp(["tomato-sauce"], ["mozzarella"]), ADD_ONE);
    expect(Object.keys(notebookView(nb)[0]).sort()).toEqual(["combination", "feedback", "number", "retryCount"]);
    expect(Object.keys(notebookView(nb)[0].combination).sort()).toEqual(["ingredientSet", "sauceBase"]);
    expect(Object.keys(first.outcome).sort()).toEqual(["kind", "number"]);
    expect(Object.keys(dup.outcome).sort()).toEqual(["kind", "number", "retryCount", "revived"]);
    expect(Object.keys(nb).sort()).toEqual(["display", "identities", "limits", "nextNumber", "schema"]);
    expect(Object.keys(nb.identities[0]).sort()).toEqual(["fp", "number", "retryCount"]);
    expect(Object.keys(nb.display[0]).sort()).toEqual(["combination", "feedback", "fp", "number"]);
  });

  it("a serialised notebook names no recipe, target, distance, collision, hint, technique or answer", () => {
    // The composition of a real shipped recipe (margherita) is stored as the player's own ingredients only.
    let nb = rec(createTrialNotebook(), fp(["tomato-sauce"], ["mozzarella", "basil"]), ADD_ONE).state;
    nb = rec(nb, fp(["tomato-sauce"], ["mozzarella", "basil", "ham"]), FAR).state;
    const json = JSON.stringify(nb).toLowerCase();
    for (const word of ["margherita", "shipped:", "recipe", "target", "distance", "collision", "ambiguous", "hint", "cls:", "technique", "candidate", "answer", "score"]) {
      expect(json, word).not.toContain(word);
    }
  });

  it("the outcome of a notebook with the same attempts is independent of what the shipped recipes are", () => {
    // No recipe input exists at all: the same inputs give byte-identical state, whatever the catalogue.
    const make = () => {
      let nb = createTrialNotebook();
      nb = rec(nb, fp(["tomato-sauce"], ["mozzarella", "basil"]), ADD_ONE).state;
      return JSON.stringify(rec(nb, fp(["pesto"], ["mozzarella"]), null).state);
    };
    expect(make()).toBe(make());
  });
});

describe("Trial Notebook — lookup does not record", () => {
  it("UNTRIED is silent and TRIED reports #n without changing anything", () => {
    const nb = rec(createTrialNotebook(), synth(1), ADD_ONE).state;
    const snapshot = JSON.stringify(nb);
    expect(lookupAttempt(nb, synth(2))).toEqual({ kind: "UNTRIED" });
    expect(lookupAttempt(nb, synth(1))).toEqual({ kind: "TRIED", number: 1, retryCount: 0, hasDetail: true });
    expect(JSON.stringify(nb)).toBe(snapshot);
  });
});

describe("Trial Notebook — the 50 display boundary (real limits)", () => {
  function fill(count: number) {
    let nb = createTrialNotebook();
    for (let i = 1; i <= count; i += 1) nb = rec(nb, synth(i), null).state;
    return nb;
  }

  it("50 unique attempts are all shown", () => {
    const nb = fill(50);
    expect(notebookSize(nb)).toEqual({ display: 50, identities: 50, nextNumber: 51 });
    expect(numbers(nb)[0]).toBe(50);
    expect(numbers(nb)[49]).toBe(1);
  });

  it("the 51st pushes the oldest row out of the display but keeps its identity", () => {
    const nb = fill(51);
    expect(notebookSize(nb)).toEqual({ display: 50, identities: 51, nextNumber: 52 });
    expect(numbers(nb)).not.toContain(1);
    expect(numbers(nb)[0]).toBe(51);
    expect(lookupAttempt(nb, synth(1))).toEqual({ kind: "TRIED", number: 1, retryCount: 0, hasDetail: false });
    expect(trialNotebookViolations(nb)).toEqual([]);
  });

  it("REVIVE (OD-P3-13): a retry of a display-evicted attempt brings its row back at the top with the same #n", () => {
    const nb = fill(51);
    const r = rec(nb, synth(1), FAR);
    expect(r.outcome).toEqual({ kind: "DUPLICATE", number: 1, retryCount: 1, revived: true });
    const view = notebookView(r.state);
    expect(view).toHaveLength(50);
    // built only from the retained fingerprint, the line shown now, the retry count and the number
    expect(view[0]).toEqual({ number: 1, retryCount: 1, combination: { sauceBase: [], ingredientSet: ["ing-00001"] }, feedback: FAR });
    expect(numbers(r.state)).not.toContain(2); // the row with the oldest activity made room
    expect(lookupAttempt(r.state, synth(2))).toEqual({ kind: "TRIED", number: 2, retryCount: 0, hasDetail: false });
    expect(lookupAttempt(r.state, synth(1))).toEqual({ kind: "TRIED", number: 1, retryCount: 1, hasDetail: true });
    expect(trialNotebookViolations(r.state)).toEqual([]);
  });

  it("the revived row holds no trace of the earlier feedback and no feedback history", () => {
    let nb = rec(createTrialNotebook(), synth(1), ADD_ONE).state;
    for (let i = 2; i <= 51; i += 1) nb = rec(nb, synth(i)).state; // #1 leaves the display
    expect(numbers(nb)).not.toContain(1);
    nb = rec(nb, synth(1), null).state;
    expect(notebookView(nb)[0].feedback).toBeNull();
    expect(JSON.stringify(nb)).not.toContain("おしい");
  });

  it("a retry never returns a stale or new number for a remembered identity, inside or outside the display", () => {
    const nb = fill(60);
    for (const k of [1, 7, 10, 11, 60]) expect(mustBe(rec(nb, synth(k)).outcome, "DUPLICATE").number).toBe(k);
  });

  it("an in-display retry keeps its row, moves it to the top and is not reported as revived", () => {
    const r = rec(fill(10), synth(4), ADD_ONE);
    expect(mustBe(r.outcome, "DUPLICATE")).toMatchObject({ number: 4, revived: false });
    expect(numbers(r.state)[0]).toBe(4);
    expect(numbers(r.state)).toHaveLength(10);
  });

  it("the display history is always the 50 most recently active attempts, newest first", () => {
    let nb = fill(120);
    for (const k of [5, 90, 3, 119, 5]) nb = rec(nb, synth(k)).state;
    expect(numbers(nb).slice(0, 5)).toEqual([5, 119, 3, 90, 120]);
    expect(numbers(nb)).toHaveLength(50);
    expect(trialNotebookViolations(nb)).toEqual([]);
  });
});

describe("Trial Notebook — the 2 000 identity boundary (real limits)", () => {
  function fill(count: number) {
    let nb = createTrialNotebook();
    for (let i = 1; i <= count; i += 1) nb = rec(nb, synth(i)).state;
    return nb;
  }

  it("2 000 unique fingerprints are all remembered", () => {
    const nb = fill(2000);
    expect(notebookSize(nb)).toEqual({ display: 50, identities: 2000, nextNumber: 2001 });
    expect(lookupAttempt(nb, synth(1))).toMatchObject({ kind: "TRIED", number: 1 });
    expect(lookupAttempt(nb, synth(2000))).toMatchObject({ kind: "TRIED", number: 2000 });
    expect(trialNotebookViolations(nb)).toEqual([]);
  });

  it("the 2 001st evicts the oldest identity, keeps the rest, and the display stays consistent", () => {
    const nb = fill(2001);
    expect(notebookSize(nb)).toEqual({ display: 50, identities: 2000, nextNumber: 2002 });
    expect(lookupAttempt(nb, synth(1))).toEqual({ kind: "UNTRIED" });
    expect(lookupAttempt(nb, synth(2))).toMatchObject({ kind: "TRIED", number: 2 });
    expect(numbers(nb)[0]).toBe(2001);
    expect(trialNotebookViolations(nb)).toEqual([]);
  });

  it("an evicted combination tried again is a first attempt with a fresh number, never a duplicate or a stale #n", () => {
    const nb = fill(2001);
    const r = rec(nb, synth(1), ADD_ONE);
    expect(r.outcome).toEqual({ kind: "NEW", number: 2002 });
    expect(notebookView(r.state)[0]).toEqual({ number: 2002, retryCount: 0, combination: { sauceBase: [], ingredientSet: ["ing-00001"] }, feedback: ADD_ONE });
    expect(lookupAttempt(r.state, synth(1))).toMatchObject({ kind: "TRIED", number: 2002, retryCount: 0 });
    expect(trialNotebookViolations(r.state)).toEqual([]);
  });

  it("eviction goes by activity: a retried old identity survives, the next-oldest is evicted", () => {
    let nb = fill(2000);
    nb = rec(nb, synth(1)).state; // #1 becomes the most recent activity
    nb = rec(nb, synth(2001)).state; // a new identity forces one eviction
    expect(lookupAttempt(nb, synth(1))).toMatchObject({ kind: "TRIED", number: 1, retryCount: 1 });
    expect(lookupAttempt(nb, synth(2))).toEqual({ kind: "UNTRIED" });
    expect(trialNotebookViolations(nb)).toEqual([]);
  });

  it("numbers only ever grow across evictions and are never reused", () => {
    let nb = createTrialNotebook({ display: 2, identity: 3 });
    const seen: number[] = [];
    for (let round = 0; round < 4; round += 1) {
      for (let i = 1; i <= 6; i += 1) {
        const r = rec(nb, synth(i));
        nb = r.state;
        if (r.outcome.kind === "NEW") seen.push(r.outcome.number);
      }
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it("eviction also drops the evicted identity's display row when the limits allow the two to overlap", () => {
    let nb = createTrialNotebook({ display: 3, identity: 3 });
    for (let i = 1; i <= 4; i += 1) nb = rec(nb, synth(i)).state;
    expect(numbers(nb)).toEqual([4, 3, 2]);
    expect(notebookSize(nb).identities).toBe(3);
    expect(trialNotebookViolations(nb)).toEqual([]);
  });
});

// ---- property / fuzz -------------------------------------------------------------------------------------

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

/** An independent simulation written as plain lists, never sharing code with the model. */
class Oracle {
  remembered: { key: number; number: number; retries: number }[] = []; // least recent first
  shown: { key: number; feedback: ShownFeedback | null }[] = []; // most recent first
  next = 1;
  readonly displayLimit: number;
  readonly identityLimit: number;
  constructor(displayLimit: number, identityLimit: number) {
    this.displayLimit = displayLimit;
    this.identityLimit = identityLimit;
  }
  step(key: number, feedback: ShownFeedback | null) {
    const at = this.remembered.findIndex((r) => r.key === key);
    if (at < 0) {
      const entry = { key, number: this.next, retries: 0 };
      this.next += 1;
      this.remembered.push(entry);
      while (this.remembered.length > this.identityLimit) {
        const gone = this.remembered.shift()!;
        this.shown = this.shown.filter((s) => s.key !== gone.key);
      }
      this.shown = [{ key, feedback }, ...this.shown].slice(0, this.displayLimit);
      return { kind: "NEW" as const, number: entry.number };
    }
    const [entry] = this.remembered.splice(at, 1);
    entry.retries += 1;
    this.remembered.push(entry);
    const revived = !this.shown.some((s) => s.key === key);
    this.shown = [{ key, feedback }, ...this.shown.filter((s) => s.key !== key)].slice(0, this.displayLimit);
    return { kind: "DUPLICATE" as const, number: entry.number, retryCount: entry.retries, revived };
  }
}

describe("Trial Notebook — property / fuzz against an independent oracle", () => {
  const feedbacks: (ShownFeedback | null)[] = [null, ADD_ONE, FAR, { kind: "CLOSE", textJa: "かなり近づいてるよ" }];

  {
    it("matches the oracle and keeps every invariant over random operation sequences", () => {
      for (let seed = 1; seed <= 60; seed += 1) {
        const rnd = mulberry32(seed * 7919);
        const displayLimit = 1 + Math.floor(rnd() * 4);
        const identityLimit = displayLimit + Math.floor(rnd() * 6);
        const alphabet = 3 + Math.floor(rnd() * 14);
        let nb = createTrialNotebook({ display: displayLimit, identity: identityLimit });
        const oracle = new Oracle(displayLimit, identityLimit);
        for (let step = 0; step < 300; step += 1) {
          const key = 1 + Math.floor(rnd() * alphabet);
          const feedback = feedbacks[Math.floor(rnd() * feedbacks.length)];
          const before = JSON.stringify(nb);
          const r = rec(nb, synth(key), feedback);
          expect(JSON.stringify(nb), "input untouched").toBe(before);
          const expected = oracle.step(key, feedback);
          expect(r.outcome, `seed ${seed} step ${step}`).toEqual(expected);
          nb = r.state;
          expect(trialNotebookViolations(nb), `seed ${seed} step ${step}`).toEqual([]);
          expect(nb.identities.map((i) => i.number)).toEqual(oracle.remembered.map((o) => o.number));
          expect(nb.identities.map((i) => i.retryCount)).toEqual(oracle.remembered.map((o) => o.retries));
          const view = notebookView(nb);
          expect(view.map((e) => e.number)).toEqual(oracle.shown.map((s) => oracle.remembered.find((o) => o.key === s.key)!.number));
          expect(view.map((e) => e.feedback)).toEqual(oracle.shown.map((s) => s.feedback));
          // duplicate detection agrees with what the oracle remembers, for every key in the alphabet
          for (let k = 1; k <= alphabet; k += 1) {
            const inOracle = oracle.remembered.find((o) => o.key === k);
            const looked = lookupAttempt(nb, synth(k));
            if (!inOracle) expect(looked).toEqual({ kind: "UNTRIED" });
            else expect(looked).toMatchObject({ kind: "TRIED", number: inOracle.number, retryCount: inOracle.retries });
          }
        }
      }
    });
  }

  it("garbage inputs never throw, never change the state, and never store anything", () => {
    const rnd = mulberry32(424242);
    const junk: unknown[] = [null, undefined, 0, 1, -1, NaN, "", "fp", "fp1:", "fp1:[", "fp1:{}", "fp2:[[],[]]", "fp01:[[],[]]", {}, [], [1], { a: 1 }, () => 1, Symbol("x"), 10n];
    let nb = rec(createTrialNotebook(), synth(1), ADD_ONE).state;
    const snapshot = JSON.stringify(nb);
    for (let i = 0; i < 400; i += 1) {
      const fingerprint = junk[Math.floor(rnd() * junk.length)];
      const feedback = rnd() < 0.5 ? junk[Math.floor(rnd() * junk.length)] : null;
      const r = recordAttempt(nb, { fingerprint, feedback });
      expect(r.outcome.kind).toBe("REJECTED");
      expect(r.state).toBe(nb);
      expect(lookupAttempt(nb, fingerprint).kind).toBe("REJECTED");
    }
    expect(JSON.stringify(nb)).toBe(snapshot);
    nb = rec(nb, synth(2), null).state;
    expect(numbers(nb)).toEqual([2, 1]);
  });

  it("real pizzas: the fingerprint contract decides identity (shuffles and quantity noise are duplicates, any kind change is new)", () => {
    const rnd = mulberry32(99);
    const pool = ["mozzarella", "basil", "ham", "mushroom", "onion", "olive", "egg", "bacon"];
    const pick = () => pool.filter(() => rnd() < 0.4);
    let nb = createTrialNotebook();
    const firstNumber = new Map<string, number>();
    for (let i = 0; i < 400; i += 1) {
      const sauces = rnd() < 0.8 ? ["tomato-sauce"] : [];
      const pieces = pick();
      const noisy = [...pieces, ...pieces.filter(() => rnd() < 0.5)].sort(() => rnd() - 0.5);
      const canonical = JSON.stringify([sauces, [...pieces].sort()]);
      const f = fp(sauces, noisy);
      const r = rec(nb, f, null);
      nb = r.state;
      if (firstNumber.has(canonical)) expect(mustBe(r.outcome, "DUPLICATE").number).toBe(firstNumber.get(canonical));
      else firstNumber.set(canonical, mustBe(r.outcome, "NEW").number);
    }
    expect(notebookSize(nb).identities).toBe(firstNumber.size);
    expect(trialNotebookViolations(nb)).toEqual([]);
  });
});
