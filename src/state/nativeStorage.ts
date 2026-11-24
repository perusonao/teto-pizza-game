/**
 * App build (Capacitor, M1 of #571): a synchronous `StorageLike` in front of an ASYNCHRONOUS native key-value store.
 *
 * Why this shape: every reader and writer in `persistence.ts` (and the #567 / #568 protection contract built on it) is
 * synchronous. Rewriting them as async would change the browser path and the contract, so the native store is hidden behind
 * the same synchronous interface instead:
 *
 *   hydrate (async, once, BEFORE React renders) -> an in-memory copy of every stored key
 *   reads                                       -> served from that copy, synchronously
 *   writes                                      -> applied to the copy, then written to the native store by ONE serialized
 *                                                  queue (strict FIFO, one native call in flight at a time), each write read
 *                                                  back from the native store before the next one starts
 *
 * Guarantees (M1 Gate):
 *   - order: a later write is never started before an earlier one is confirmed, so an old write cannot overwrite a new one;
 *   - failure is reported: a write the native store rejects (or reads back differently) puts the adapter in a failed state.
 *     While failed, `setItem` / `removeItem` THROW (persistence.ts already treats a throwing `setItem` as a failed save) and
 *     the copy is not changed, so the game cannot go on believing a save that is not stored. Each such call retries the
 *     queued writes, so the adapter heals by itself once the native store works again;
 *   - durability: the native store is written one whole value per key (atomic per key on iOS and Android). A forced stop
 *     during a write leaves the previous confirmed value of that key; a write that was never confirmed is simply not there.
 *
 * Known limit (cannot be removed while the persistence layer stays synchronous): a `setItem` that returns normally means
 * "accepted and queued", not "confirmed in the native store". `flush()` is the confirmation; `getWriteError()` / `subscribe`
 * report a failure that happens after the call returned.
 *
 * No Capacitor import here: the backend is injected, so this file is plain logic and testable without a device.
 */
import type { StorageLike } from "./persistence";

/** The few async operations the adapter needs from a native key-value store (Capacitor Preferences in the app). */
export interface AsyncKeyValueBackend {
  keys(): Promise<string[]>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface NativeStorage extends StorageLike {
  /** Resolves when every accepted write is confirmed in the native store; rejects with the failure otherwise. */
  flush(): Promise<void>;
  /** The failure that stopped the write queue, or null while the native store holds everything that was accepted. */
  getWriteError(): unknown | null;
  /** Called whenever `getWriteError()` changes. Returns the unsubscribe function. */
  subscribe(listener: (error: unknown | null) => void): () => void;
}

export class NativeStorageWriteError extends Error {
  readonly causeError: unknown;
  constructor(message: string, causeError?: unknown) {
    super(message);
    this.name = "NativeStorageWriteError";
    this.causeError = causeError;
  }
}

type Op = { key: string; value: string | null };

/** Each queued write is tried this many times before the adapter reports a failure. */
const ATTEMPTS_PER_WRITE = 2;

export function createNativeStorage(backend: AsyncKeyValueBackend, initial: ReadonlyMap<string, string>): NativeStorage {
  const copy = new Map(initial);
  const ops: Op[] = [];
  const listeners = new Set<(error: unknown | null) => void>();
  let writeError: unknown | null = null;
  let pump: Promise<void> | null = null;

  const setWriteError = (next: unknown | null) => {
    if (next === writeError) return;
    writeError = next;
    for (const listener of [...listeners]) {
      try {
        listener(next);
      } catch {
        // a listener must never stop the queue
      }
    }
  };

  async function writeOnce(op: Op): Promise<void> {
    if (op.value === null) await backend.remove(op.key);
    else await backend.set(op.key, op.value);
    // Read-back: a store that accepts a write and then does not hold it is a failed write, not a successful one.
    const back = await backend.get(op.key);
    if (back !== op.value) throw new NativeStorageWriteError(`read-back mismatch for "${op.key}"`);
  }

  async function run(): Promise<void> {
    while (ops.length > 0) {
      const op = ops[0];
      let lastFailure: unknown = null;
      let confirmed = false;
      for (let attempt = 0; attempt < ATTEMPTS_PER_WRITE && !confirmed; attempt++) {
        try {
          await writeOnce(op);
          confirmed = true;
        } catch (error) {
          lastFailure = error;
        }
      }
      if (!confirmed) {
        // The failed op stays at the head of the queue: nothing after it may be written first (order), and the next
        // setItem / removeItem / flush retries it.
        setWriteError(lastFailure ?? new NativeStorageWriteError("write failed"));
        return;
      }
      ops.shift();
    }
    setWriteError(null);
  }

  function ensurePump(): Promise<void> {
    if (!pump) {
      pump = run().finally(() => {
        pump = null;
      });
    }
    return pump;
  }

  function enqueue(key: string, value: string | null): void {
    if (writeError !== null) {
      // Failed state: retry what is queued, and refuse this write (the copy stays as it was).
      void ensurePump();
      throw new NativeStorageWriteError("native storage is not accepting writes", writeError);
    }
    if (value === null) copy.delete(key);
    else copy.set(key, value);
    ops.push({ key, value });
    void ensurePump();
  }

  return {
    getItem: (key) => copy.get(key) ?? null,
    setItem: (key, value) => enqueue(key, String(value)),
    removeItem: (key) => enqueue(key, null),
    async flush() {
      // A failed queue is retried once per flush; a queue that keeps failing rejects.
      await ensurePump();
      while (pump) await pump;
      if (writeError !== null) throw new NativeStorageWriteError("native storage write failed", writeError);
    },
    getWriteError: () => writeError,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Reads every stored key into memory. Rejects when the native store cannot be read: the caller must NOT then start from an
 * empty save (see `createUnreadableStorage`).
 */
export async function hydrateNativeStorage(backend: AsyncKeyValueBackend): Promise<NativeStorage> {
  const keys = await backend.keys();
  const entries = await Promise.all(keys.map(async (key) => [key, await backend.get(key)] as const));
  const initial = new Map<string, string>();
  for (const [key, value] of entries) if (value !== null) initial.set(key, value);
  return createNativeStorage(backend, initial);
}

/**
 * What the game gets when hydration failed: every read and write throws. persistence.ts then starts the page session as
 * `load-failed` (saveSession.ts), which blocks every write for the life of the page -- the same path as a failed startup
 * read in the browser -- so the stored save is never replaced by a default one. A restart is the recovery.
 */
export function createUnreadableStorage(cause: unknown): StorageLike {
  const fail = (): never => {
    throw new NativeStorageWriteError("native storage could not be read", cause);
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}
