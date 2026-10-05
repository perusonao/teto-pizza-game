import { StateEditor } from "./StateEditor";

/**
 * DEV State Editor (Issue #403): the entry component src/main.tsx loads (behind the DEV / Preview env gate, by a
 * dynamic import). It only supplies the browser's localStorage to <StateEditor />; opening it writes nothing.
 */
function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function StateEditorShell() {
  return <StateEditor storage={getStorage()} />;
}
