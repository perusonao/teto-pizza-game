import { describe, expect, it } from "vitest";
import { DisplayNameValidationError, normalizeAndValidateDisplayName } from "./displayNameValidation";

function expectRejects(input: unknown, code: string) {
  expect(() => normalizeAndValidateDisplayName(input)).toThrow(DisplayNameValidationError);
  try {
    normalizeAndValidateDisplayName(input);
    expect.fail("expected normalizeAndValidateDisplayName to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(DisplayNameValidationError);
    expect((error as DisplayNameValidationError).code).toBe(code);
  }
}

describe("normalizeAndValidateDisplayName", () => {
  it("accepts a plain ASCII name unchanged", () => {
    expect(normalizeAndValidateDisplayName("Alice")).toBe("Alice");
  });

  it("accepts Japanese (hiragana/katakana/kanji)", () => {
    expect(normalizeAndValidateDisplayName("ピザ職人")).toBe("ピザ職人");
  });

  it("accepts fullwidth alphanumeric", () => {
    expect(normalizeAndValidateDisplayName("Ａｌｉｃｅ")).toBe("Ａｌｉｃｅ");
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeAndValidateDisplayName("  Alice  ")).toBe("Alice");
  });

  it("collapses internal whitespace runs to a single halfwidth space", () => {
    expect(normalizeAndValidateDisplayName("Alice   Bob")).toBe("Alice Bob");
  });

  it("trims and collapses full-width/ideographic whitespace too", () => {
    expect(normalizeAndValidateDisplayName("　Alice　　Bob　")).toBe("Alice Bob");
  });

  it("accepts exactly 1 codepoint", () => {
    expect(normalizeAndValidateDisplayName("A")).toBe("A");
  });

  it("accepts exactly 20 codepoints", () => {
    const name = "A".repeat(20);
    expect(normalizeAndValidateDisplayName(name)).toBe(name);
  });

  it("counts codepoints, not UTF-16 code units, for the 20-character max (astral codepoint)", () => {
    // U+10000 (LINEAR B SYLLABLE B008 A, not emoji/pictographic) is one codepoint but two
    // UTF-16 units -- a naive `.length` check would see 40 and wrongly reject this.
    const name = "\u{10000}".repeat(20);
    expect(Array.from(name).length).toBe(20);
    expect(name.length).toBe(40);
    expect(normalizeAndValidateDisplayName(name)).toBe(name);
  });

  it("rejects a non-string input", () => {
    expectRejects(123, "not-a-string");
  });

  it("rejects raw input over the 200 UTF-16 unit ceiling", () => {
    expectRejects("A".repeat(201), "too-long-raw");
  });

  it("accepts raw input at exactly the 200 UTF-16 unit ceiling if it normalizes short enough", () => {
    // 200 raw units of leading whitespace + a short name still passes the raw ceiling; the
    // codepoint-length check (post-trim) is what actually gates it, not the raw ceiling.
    const raw = " ".repeat(199) + "A";
    expect(raw.length).toBe(200);
    expect(normalizeAndValidateDisplayName(raw)).toBe("A");
  });

  it("rejects an empty string", () => {
    expectRejects("", "empty");
  });

  it("rejects a whitespace-only string", () => {
    expectRejects("   ", "empty");
  });

  it("rejects 21 codepoints", () => {
    expectRejects("A".repeat(21), "too-long");
  });

  it("rejects a newline", () => {
    expectRejects("Alice\nBob", "control-characters");
  });

  it("rejects a carriage return", () => {
    expectRejects("Alice\rBob", "control-characters");
  });

  it("rejects a NUL control character", () => {
    expectRejects("Alice\u0000", "control-characters");
  });

  it("rejects a C1 control character (U+0080-009F range)", () => {
    expectRejects("Alice\u0085Bob", "control-characters");
  });

  it("rejects zero-width space (U+200B)", () => {
    expectRejects("Ali​ce", "invisible-characters");
  });

  it("rejects zero-width joiner (U+200D)", () => {
    expectRejects("Ali‍ce", "invisible-characters");
  });

  it("rejects zero-width non-joiner (U+200C)", () => {
    expectRejects("Ali‌ce", "invisible-characters");
  });

  it("rejects a byte-order-mark / U+FEFF", () => {
    expectRejects("﻿Alice", "invisible-characters");
  });

  it("rejects a general Cf (format) character", () => {
    // U+061C ARABIC LETTER MARK -- Cf, not one of the explicitly-named zero-width characters,
    // proving the \p{Cf} rule generalizes beyond the named list.
    expectRejects("Ali؜ce", "invisible-characters");
  });

  it("rejects an emoji", () => {
    expectRejects("Alice\u{1F600}", "emoji");
  });

  it("rejects reserved word 'あなた'", () => {
    expectRejects("あなた", "reserved");
  });

  it("rejects reserved word 'Anata' case-insensitively", () => {
    expectRejects("ANATA", "reserved");
    expectRejects("anata", "reserved");
    expectRejects("AnAtA", "reserved");
  });

  it("rejects reserved word 'You' case-insensitively", () => {
    expectRejects("YOU", "reserved");
    expectRejects("you", "reserved");
    expectRejects("You", "reserved");
  });

  it("rejects a reserved word even with surrounding whitespace (normalized before the check)", () => {
    expectRejects("  you  ", "reserved");
  });

  it("does not reserve a name that merely contains a reserved word as a substring", () => {
    expect(normalizeAndValidateDisplayName("Anatasia")).toBe("Anatasia");
    expect(normalizeAndValidateDisplayName("Youssef")).toBe("Youssef");
  });

  it("allows duplicate names across different players (no uniqueness check here)", () => {
    expect(normalizeAndValidateDisplayName("Alice")).toBe("Alice");
    expect(normalizeAndValidateDisplayName("Alice")).toBe("Alice");
  });
});
