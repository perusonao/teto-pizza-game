import { describe, expect, it } from "vitest";
import {
  deriveSauceLiveMessage,
  evaluateSauceForPlayer,
  SAUCE_LIVE_MESSAGE,
} from "./sauceEvaluation";
import { computeSauceMetrics, type SauceDepositLike } from "./sauceField";
import { IDEAL_MARGHERITA_SAUCE_FIXTURE, MARGHERITA_REFERENCE } from "../data/referencePizza";

const REFERENCE = MARGHERITA_REFERENCE.sauce;

function ring(
  radius: number,
  count: number,
  amount = 0.02,
  center = { x: 50, y: 50 },
): SauceDepositLike[] {
  const deposits: SauceDepositLike[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    deposits.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      amount,
    });
  }
  return deposits;
}

/**
 * Human Feel Fix 2 brief, section 6 (Human Feel Gate) -- the four hands-on scenarios the
 * Preview build must visibly and message-wise distinguish. Each fixture here is a concrete,
 * literally-paintable deposit sequence (same spirit as ../data/referencePizza.ts's own
 * fixture), not hand-picked metric values, so this test would catch a threshold *or* a
 * geometry regression either one.
 */
describe("Sauce Human Feel Gate (Fix 2 brief section 6)", () => {
  it("A: center only -> 「もう少し広げよう」, 広さ poor", () => {
    const metrics = computeSauceMetrics([...ring(3, 4, 0.02), ...ring(6, 6, 0.02)]);
    expect(deriveSauceLiveMessage(metrics, REFERENCE)).toBe(SAUCE_LIVE_MESSAGE.spreadMore);
    expect(evaluateSauceForPlayer(metrics, REFERENCE).coverageTier).toBe("poor");
  });

  it("B: partial overlap (a thick pile on top of an otherwise even spread) -> 「厚いところを広げよう」, 均一さ poor, 広さ/ふち not poor", () => {
    const evenSpread = [
      ...ring(6, 4, 0.02),
      ...ring(16, 9, 0.02),
      ...ring(26, 14, 0.02),
      ...ring(36, 19, 0.02),
    ];
    const thickPile = Array.from({ length: 40 }, () => ({ x: 42, y: 42, amount: 0.02 }));
    const metrics = computeSauceMetrics([...evenSpread, ...thickPile]);
    expect(deriveSauceLiveMessage(metrics, REFERENCE)).toBe(SAUCE_LIVE_MESSAGE.smoothThickArea);
    const evaluation = evaluateSauceForPlayer(metrics, REFERENCE);
    expect(evaluation.evennessTier).toBe("poor");
    expect(evaluation.coverageTier).not.toBe("poor");
    expect(evaluation.edgeTier).not.toBe("poor");
  });

  it("C: painted to the ear (rim band, still technically on the dough) -> 「耳は残そう」, ふち poor, even though coverage also reads low", () => {
    const metrics = computeSauceMetrics(ring(45, 24, 0.02));
    expect(deriveSauceLiveMessage(metrics, REFERENCE)).toBe(SAUCE_LIVE_MESSAGE.keepRimClear);
    const evaluation = evaluateSauceForPlayer(metrics, REFERENCE);
    expect(evaluation.edgeTier).toBe("poor");
    // Coverage is also poor here (a thin ring covers little of the dough) -- pins that edge
    // still wins the *message* despite that, per deriveSauceLiveMessage's priority order.
    expect(evaluation.coverageTier).toBe("poor");
  });

  it("D: the reference fixture itself, painted evenly within the target area -> 「いい感じ！」, all three great", () => {
    const metrics = computeSauceMetrics(IDEAL_MARGHERITA_SAUCE_FIXTURE);
    expect(deriveSauceLiveMessage(metrics, REFERENCE)).toBe(SAUCE_LIVE_MESSAGE.good);
    expect(evaluateSauceForPlayer(metrics, REFERENCE)).toEqual({
      coverageTier: "great",
      evennessTier: "great",
      edgeTier: "great",
    });
  });

  it("nothing painted yet is never mistaken for 良好 -- 広さ poor, no live message claims 良好", () => {
    const metrics = computeSauceMetrics([]);
    expect(evaluateSauceForPlayer(metrics, REFERENCE).coverageTier).toBe("poor");
    expect(deriveSauceLiveMessage(metrics, REFERENCE)).not.toBe(SAUCE_LIVE_MESSAGE.good);
  });
});
