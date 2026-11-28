import type { ProgressionModelId } from "./progressionModelId";

export function parseProgressionParam(search: unknown): ProgressionModelId | null {
  if (typeof search !== "string") return null;
  const value = new URLSearchParams(search).get("progression");
  return value === "shop" || value === "legacy" ? value : null;
}
