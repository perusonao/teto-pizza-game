import type { StorageLike } from "../persistence";

/**
 * Save Compatibility Phase B PR-1 (Issue #560): wraps a `StorageLike` and injects the failures a real browser produces --
 * a quota error on `setItem`, a write that is silently dropped, a read that returns something other than what was
 * written, a read / remove that throws. Every hook is keyed by the storage key, so a test can break the quarantine keys
 * and leave the save key alone (or the other way round).
 */
export interface StorageFaults {
  setThrows?: (key: string) => boolean;
  /** `setItem` returns normally but stores nothing. */
  setDrops?: (key: string) => boolean;
  getThrows?: (key: string) => boolean;
  /** Transforms what `getItem` returns for a key (a read-back that does not match what was written). */
  getTransform?: (key: string, value: string | null) => string | null;
  removeThrows?: (key: string) => boolean;
  /** `removeItem` returns normally but removes nothing. */
  removeDrops?: (key: string) => boolean;
}

export interface FaultyStorage extends StorageLike {
  /** Number of `setItem` calls that reached the inner storage, per key. */
  setCount(key: string): number;
  faults: StorageFaults;
}

export function faultyStorage(inner: StorageLike, faults: StorageFaults = {}): FaultyStorage {
  const counts = new Map<string, number>();
  const wrapper: FaultyStorage = {
    faults,
    getItem(key) {
      if (wrapper.faults.getThrows?.(key)) throw new Error(`getItem(${key}) failed`);
      const value = inner.getItem(key);
      return wrapper.faults.getTransform ? wrapper.faults.getTransform(key, value) : value;
    },
    setItem(key, value) {
      if (wrapper.faults.setThrows?.(key)) throw new DOMException("quota", "QuotaExceededError");
      if (wrapper.faults.setDrops?.(key)) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      inner.setItem(key, value);
    },
    removeItem(key) {
      if (wrapper.faults.removeThrows?.(key)) throw new Error(`removeItem(${key}) failed`);
      if (wrapper.faults.removeDrops?.(key)) return;
      inner.removeItem(key);
    },
    setCount: (key) => counts.get(key) ?? 0,
  };
  return wrapper;
}
