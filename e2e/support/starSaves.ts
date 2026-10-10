import { createServer } from "vite";

/**
 * Issue #441: the star-state saves for the E2E, built by the SAME code the DEV State Editor's star presets use
 * (src/devtools/starStates.ts -> the game's own save writer), so an E2E start state and the Preview preset can never
 * drift apart.
 *
 * The code is loaded through Vite's SSR loader (not imported straight into Playwright's Node runtime), because the
 * game's persistence module reads `import.meta.env`, which only Vite provides. Nothing is written into the repo.
 * The result is the save TEXT only: the caller chooses the storage key (the production key on the dev-server specs,
 * the Preview key on a Preview build).
 */
export interface StarSaves {
  /** The accumulated-star targets the ladder's `starGates` define (production: 119 / 120 / 129 / 130). */
  targets: readonly number[];
  /** The save text of a target. */
  json: (stars: number) => string;
}

export async function loadStarSaves(): Promise<StarSaves> {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const stars = (await server.ssrLoadModule("/src/devtools/starStates.ts")) as typeof import("../../src/devtools/starStates");
    const catalogModule = (await server.ssrLoadModule("/src/devtools/editorCatalog.ts")) as typeof import("../../src/devtools/editorCatalog");
    const catalog = catalogModule.productionCatalog();
    const targets = stars.starTargetsOf(catalog.ladder).map((t) => t.stars);
    const saves = new Map(targets.map((t) => [t, JSON.stringify(stars.starSaveObject(catalog, t))] as const));
    return {
      targets,
      json: (target) => {
        const text = saves.get(target);
        if (text === undefined) throw new Error(`no star-gate target of ${target} stars (have ${targets.join(", ")})`);
        return text;
      },
    };
  } finally {
    await server.close();
  }
}
