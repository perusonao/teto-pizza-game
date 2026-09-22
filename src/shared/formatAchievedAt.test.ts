import { describe, expect, it } from "vitest";
import { ACHIEVED_AT_FALLBACK, formatAchievedAt } from "./formatAchievedAt";

describe("formatAchievedAt", () => {
  it("valid timestamp -> compact M/D HH:mm in JST", () => {
    // 2026-09-21T23:41:00Z == 2026-09-22 08:41 JST (UTC+9).
    const ms = Date.UTC(2026, 8, 21, 23, 41, 0);
    expect(formatAchievedAt(ms)).toBe("9/22 08:41");
  });

  it("missing achievedAt (null, e.g. an unresolved serverTimestamp sentinel) -> fallback", () => {
    expect(formatAchievedAt(null)).toBe(ACHIEVED_AT_FALLBACK);
  });

  it("missing achievedAt (undefined, e.g. absent from a legacy shape) -> fallback", () => {
    expect(formatAchievedAt(undefined)).toBe(ACHIEVED_AT_FALLBACK);
  });

  it("invalid achievedAt (NaN) -> fallback, never crashes", () => {
    expect(formatAchievedAt(Number.NaN)).toBe(ACHIEVED_AT_FALLBACK);
  });

  it("invalid achievedAt (Infinity) -> fallback, never crashes", () => {
    expect(formatAchievedAt(Number.POSITIVE_INFINITY)).toBe(ACHIEVED_AT_FALLBACK);
  });

  it("invalid achievedAt (non-number, defensively typed as any) -> fallback, never crashes", () => {
    expect(formatAchievedAt("not-a-number" as unknown as number)).toBe(ACHIEVED_AT_FALLBACK);
  });

  it("boundary: JST midnight renders '0:00', never a '24:00' hour-cycle bug", () => {
    // 2026-01-01T15:00:00Z == 2026-01-02 00:00 JST.
    const ms = Date.UTC(2026, 0, 1, 15, 0, 0);
    expect(formatAchievedAt(ms)).toBe("1/2 00:00");
  });

  it("timezone-sensitive: a UTC evening timestamp lands on the *next* calendar day in JST", () => {
    // 2026-03-10T20:15:00Z == 2026-03-11 05:15 JST -- a naive browser-local (non-JST) render in
    // a UTC-negative timezone would show 3/10, not 3/11; this pins the explicit JST decision.
    const ms = Date.UTC(2026, 2, 10, 20, 15, 0);
    expect(formatAchievedAt(ms)).toBe("3/11 05:15");
  });

  it("epoch 0 (1970-01-01 09:00 JST) formats without crashing", () => {
    expect(formatAchievedAt(0)).toBe("1/1 09:00");
  });
});
