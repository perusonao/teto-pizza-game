import { describe, expect, it } from "vitest";
import mainSource from "../main.tsx?raw";

/**
 * DEV State Editor (Issue #403) S3, source level: the editor is reachable only through src/main.tsx's static
 * DEV / Preview env gate and a dynamic import, nothing else refers to it, and it never touches Firebase / the
 * ranking / the player profile (Owner Contract 6 / 8). The bundle-level proof (a real production `vite build`
 * holds none of it) is src/preview/previewIsolation.gate.test.ts; the DOM / a11y proof is
 * e2e/dev-state-editor.spec.ts.
 */

const all = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// A glob key of a file in this very directory is `./name`, every other one is `../<dir>/name`.
const inDevtools = (file: string) => file.startsWith("./") || file.startsWith("../devtools/");
const baseName = (file: string) => file.slice(file.lastIndexOf("/") + 1);
const devtoolsSources = Object.entries(all).filter(([file]) => inDevtools(file));

describe("DEV State Editor access (source)", () => {
  it("the scan sees the app and the editor", () => {
    expect(Object.keys(all).length).toBeGreaterThan(100);
    expect(devtoolsSources.map(([f]) => baseName(f)).sort()).toEqual(["StateEditorShell.tsx", "apply.ts", "backup.ts", "editorCatalog.ts", "marks.ts", "memoryStorage.ts", "presets.ts", "saveMerge.ts", "stateModel.ts"]);
  });

  it("no production source outside src/devtools and src/main.tsx refers to the editor, its URL parameter or its keys", () => {
    for (const [file, text] of Object.entries(all)) {
      if (inDevtools(file) || file === "../main.tsx") continue;
      expect(text, file).not.toMatch(/devtools\/|dev=state|dev-state-editor|dev-backup-v1|DEV State Editor|StateEditorShell/);
    }
  });

  it("main.tsx reaches it only behind the DEV / Preview env check, through a dynamic import, and never seeds on it", () => {
    const guard = /const devStateRequested =\s*\(import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_PREVIEW_MODE\) &&\s*new URLSearchParams\(window\.location\.search\)\.get\('dev'\) === 'state'/;
    expect(mainSource).toMatch(guard);
    expect(mainSource).toMatch(/import\('\.\/devtools\/StateEditorShell'\)/);
    expect(mainSource).not.toMatch(/^import .* from ['"]\.\/devtools/m);
    expect(mainSource).toMatch(/if \(import\.meta\.env\.VITE_PREVIEW_MODE && !inspectorRequested && !devStateRequested\) \{/);
    // the request is decided BEFORE the seed
    expect(mainSource.indexOf("const devStateRequested")).toBeLessThan(mainSource.indexOf("applyPreviewHvSeed(window"));
  });

  it("the editor never imports Firebase, the ranking, the profile or the Preview helpers", () => {
    for (const [file, text] of devtoolsSources) {
      expect(text, file).not.toMatch(/from ['"](\.\.\/)+firebase|from ['"]firebase|from ['"](\.\.\/)+preview|submitLunchRushScore|getWeeklyLeaderboard|getMyProfile|setDisplayName|signInAnonymously/);
    }
  });

  it("the editor writes the save only through apply.ts / backup.ts (no other module calls the save key's setItem)", () => {
    for (const [file, text] of devtoolsSources) {
      if (["apply.ts", "backup.ts", "memoryStorage.ts"].includes(baseName(file))) continue;
      expect(text, file).not.toMatch(/\.setItem\(|\.removeItem\(|\.clear\(\)/);
    }
  });
});
