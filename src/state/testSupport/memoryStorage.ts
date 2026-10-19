import type { StorageLike } from "../persistence";

/** Save Compatibility Phase A: an in-memory `StorageLike`. `view()` makes a second handle on the SAME backing store
 *  (two browser tabs on one origin). `keys()` lets a test see whether anything besides the save key was written. */
export interface MemoryStorage extends StorageLike {
  keys(): string[];
  view(): MemoryStorage;
}

export function memoryStorage(initial: Record<string, string> = {}, shared?: Map<string, string>): MemoryStorage {
  const store = shared ?? new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    keys: () => [...store.keys()],
    view: () => memoryStorage({}, store),
  };
}
