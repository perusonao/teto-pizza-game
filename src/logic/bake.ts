import type { BakeTarget } from "../data/recipes";

export type BakeState = "raw" | "perfect" | "burnt";

export function classifyBake(value: number, target: BakeTarget): BakeState {
  if (value < target.start) return "raw";
  if (value > target.end) return "burnt";
  return "perfect";
}

export const BAKE_STATE_LABEL: Record<BakeState, string> = {
  raw: "生焼け",
  perfect: "いい焼き加減",
  burnt: "焦げ",
};
