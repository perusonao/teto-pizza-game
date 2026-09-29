import { describe, expect, it } from "vitest";
import {
  INITIAL_SEARCH_INPUT,
  isConfirmEnter,
  onSearchBlur,
  onSearchClear,
  onSearchCompositionEnd,
  onSearchCompositionStart,
  onSearchInput,
  type SearchInputState,
} from "./pantrySearchIme";

const run = (steps: ((s: SearchInputState) => SearchInputState)[]) => steps.reduce((s, f) => f(s), INITIAL_SEARCH_INPUT);

describe("pantry search IME contract (PreAudit §18.5)", () => {
  it("a composition never moves `applied`; compositionend applies the confirmed string", () => {
    let s = onSearchCompositionStart(INITIAL_SEARCH_INPUT);
    s = onSearchInput(s, "た", true);
    s = onSearchInput(s, "たまねき", true); // an intermediate string that matches nothing
    expect(s).toEqual({ value: "たまねき", applied: "", composing: true });
    s = onSearchInput(s, "玉ねぎ", true); // a kanji candidate
    expect(s.applied).toBe("");
    s = onSearchCompositionEnd(s, "玉ねぎ");
    expect(s).toEqual({ value: "玉ねぎ", applied: "玉ねぎ", composing: false });
  });

  it("keeps the previous applied text through a whole composition", () => {
    let s = run([(x) => onSearchInput(x, "ベ", false)]);
    expect(s.applied).toBe("ベ");
    s = onSearchCompositionStart(s);
    s = onSearchInput(s, "べーこ", true);
    expect(s.applied).toBe("ベ");
  });

  it("is idempotent with the input event that follows compositionend (Safari order), and with the reverse order", () => {
    const composing = onSearchInput(onSearchCompositionStart(INITIAL_SEARCH_INPUT), "たまねぎ", true);
    const end = onSearchCompositionEnd(composing, "タマネギ");
    expect(onSearchInput(end, "タマネギ", false)).toEqual(end); // end, then input
    // input first (still flagged), then end
    const inputFirst = onSearchCompositionEnd(onSearchInput(composing, "タマネギ", true), "タマネギ");
    expect(inputFirst).toEqual(end);
  });

  it("applies immediately when there is no composition (paste, delete, latin, dictation)", () => {
    expect(onSearchInput(INITIAL_SEARCH_INPUT, "basil", false)).toEqual({ value: "basil", applied: "basil", composing: false });
    const s = run([(x) => onSearchInput(x, "ばじる", false), (x) => onSearchInput(x, "ばじ", false)]);
    expect(s.applied).toBe("ばじ");
  });

  it("a blur (or close) settles an interrupted composition so the flag cannot stick", () => {
    const s = onSearchInput(onSearchCompositionStart(INITIAL_SEARCH_INPUT), "たま", true);
    expect(onSearchBlur(s)).toEqual({ value: "たま", applied: "たま", composing: false });
    expect(onSearchBlur(INITIAL_SEARCH_INPUT)).toBe(INITIAL_SEARCH_INPUT); // nothing to settle
  });

  it("✕ clears immediately, mid-composition too", () => {
    const s = onSearchInput(onSearchCompositionStart(INITIAL_SEARCH_INPUT), "たま", true);
    expect(onSearchClear()).toEqual(INITIAL_SEARCH_INPUT);
    expect(onSearchClear()).toEqual({ value: "", applied: "", composing: false });
    expect(s.composing).toBe(true);
  });

  it("confirming Enter is recognised in every browser order; a plain Enter is not", () => {
    const base = { eventIsComposing: false, keyCode: 13, composing: false, msSinceCompositionEnd: null };
    expect(isConfirmEnter(base)).toBe(false);
    expect(isConfirmEnter({ ...base, eventIsComposing: true })).toBe(true); // Chromium
    expect(isConfirmEnter({ ...base, keyCode: 229 })).toBe(true); // Safari after compositionend
    expect(isConfirmEnter({ ...base, composing: true })).toBe(true);
    expect(isConfirmEnter({ ...base, msSinceCompositionEnd: 3 })).toBe(true);
    expect(isConfirmEnter({ ...base, msSinceCompositionEnd: 400 })).toBe(false);
    expect(isConfirmEnter({ ...base, msSinceCompositionEnd: -5 })).toBe(false);
  });
});
