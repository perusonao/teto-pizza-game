import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import mainSource from "../../main.tsx?raw";
import { MID_BAKE_EXPERIENCE_PRODUCTION } from "../../logic/midBake/midBakeGate";
import { MID_BAKE_LAB_MARK, parseMidBakeLabSearch } from "../../preview/midBakeLab";

describe("MID_BAKE Lab isolation (C-2)", () => {
  it("leaves Production OFF", () => {
    expect(MID_BAKE_EXPERIENCE_PRODUCTION).toBe(false);
  });

  it("imports no App, screens, state, persistence, PREP or FRY, and no HOT file", () => {
    const root = join(process.cwd(), "src", "components", "midBakeLab");
    for (const file of readdirSync(root).filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name))) {
      const source = readFileSync(join(root, file), "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
      for (const path of imports) {
        expect(path, `${file} -> ${path}`).not.toMatch(/(^|\/)(App|GameScreen|PizzaStage|gameReducer|persistence|prep|fry|screens|state)(\/|\.|$)/i);
      }
      expect(source, file).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
  });

  it("main.tsx reaches the Lab only behind the DEV / Preview env check, through a dynamic import", () => {
    expect(mainSource).toMatch(/\(import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_PREVIEW_MODE\) &&\s*new URLSearchParams\(window\.location\.search\)\.get\('dev'\) === 'midbake'/);
    expect(mainSource).toMatch(/import\('\.\/components\/midBakeLab\/MidBakeLab'\)/);
    expect(mainSource).not.toMatch(/^import .*midBakeLab/im);
    expect(mainSource).toMatch(/!midBakeLabRequested/);
  });

  it("no production source outside the Lab, its entry and main.tsx refers to the Lab", () => {
    const sources = import.meta.glob(["../../**/*.ts", "../../**/*.tsx", "!../../**/*.test.ts", "!../../**/*.test.tsx", "!../midBakeLab/**", "!../../preview/midBakeLab.ts", "!../../main.tsx"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/dev=midbake|mid-bake-lab-v1|components\/midBakeLab|preview\/midBakeLab/);
    }
  });

  it("the entry parses scenario and a clamped hold override", () => {
    expect(MID_BAKE_LAB_MARK).toBe("mid-bake-lab-v1");
    expect(parseMidBakeLabSearch("?dev=midbake")).toEqual({ scenarioId: "natto", holdTimeoutMs: undefined });
    expect(parseMidBakeLabSearch("?dev=midbake&hold=1500").holdTimeoutMs).toBe(1500);
    expect(parseMidBakeLabSearch("?hold=1").holdTimeoutMs).toBe(500);
    expect(parseMidBakeLabSearch("?hold=9999999").holdTimeoutMs).toBe(60000);
    expect(parseMidBakeLabSearch("?hold=abc").holdTimeoutMs).toBeUndefined();
    expect(parseMidBakeLabSearch("?hold=").holdTimeoutMs).toBeUndefined();
  });
});
