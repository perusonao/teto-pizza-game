/**
 * App build only (`vite build --mode app`): loads the native save into memory before the first render and makes it the
 * default storage. Imported dynamically from main.tsx behind a build-time check, so the browser bundle never contains it.
 */
import { Preferences } from "@capacitor/preferences";
import {
  createUnreadableStorage,
  hydrateNativeStorage,
  type AsyncKeyValueBackend,
  type NativeStorage,
} from "./nativeStorage";
import { setDefaultStorageOverride } from "./persistence";

export const preferencesBackend: AsyncKeyValueBackend = {
  keys: async () => (await Preferences.keys()).keys,
  get: async (key) => (await Preferences.get({ key })).value,
  set: async (key, value) => {
    await Preferences.set({ key, value });
  },
  remove: async (key) => {
    await Preferences.remove({ key });
  },
};

const HYDRATE_ATTEMPTS = 3;

export async function initNativeStorage(backend: AsyncKeyValueBackend = preferencesBackend): Promise<void> {
  let failure: unknown = null;
  for (let attempt = 0; attempt < HYDRATE_ATTEMPTS; attempt++) {
    try {
      const storage = await hydrateNativeStorage(backend);
      setDefaultStorageOverride(storage);
      watchLifecycle(storage);
      return;
    } catch (error) {
      failure = error;
    }
  }
  // Never start from an empty save: an unreadable storage makes persistence.ts refuse every write this page session.
  setDefaultStorageOverride(createUnreadableStorage(failure));
}

/** Whenever the app is sent to the background, push anything still queued (and retry a failed queue). */
function watchLifecycle(storage: NativeStorage): void {
  if (typeof document === "undefined") return;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void storage.flush().catch(() => undefined);
  });
}
