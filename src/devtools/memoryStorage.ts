import type { StorageLike } from "../state/persistence";

/** An in-memory `StorageLike`: the scratch space the editor runs the real save writer in, so the editor
 *  never hand-builds a save (the authority's own sanitizing writer produces the canonical JSON). */
export function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
