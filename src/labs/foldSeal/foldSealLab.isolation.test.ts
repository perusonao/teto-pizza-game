// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FOLD+SEAL Lab (Issue #773 T6-F2) isolation: the lab imports only React, the F1 module and its own files; nothing outside src/labs/foldSeal imports it
 * (and the F1 module is imported only from here); the stand-alone HTML is not the app's index.html; no storage / network / clock-of-record is used.
 */
const here = __dirname;
const srcRoot = path.resolve(here, "../..");
const repoRoot = path.resolve(srcRoot, "..");
const own = readdirSync(here).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const specs = (code: string) => [...code.matchAll(/(?:import|export)[^"';]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]);

describe("lab sources", () => {
  it("import only react, react-dom, the F1 module, the lab's own files and its stylesheet", () => {
    for (const f of own) {
      for (const spec of specs(readFileSync(path.join(here, f), "utf8"))) {
        const ok = spec === "react" || spec === "react-dom/client" || spec === "../../logic/foldSeal" || spec.startsWith("./");
        expect(ok, `${f} imports ${spec}`).toBe(true);
      }
    }
  });
  it("never touch storage, the network, cookies or the game's state / scoring / persistence modules", () => {
    const banned = /\b(localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|document\.cookie|navigator\.sendBeacon|WebSocket|pendingRound|scorePizza|persistence|gameReducer)\b/;
    for (const f of own) expect(banned.test(strip(readFileSync(path.join(here, f), "utf8"))), f).toBe(false);
  });
});

describe("the lab is stand-alone", () => {
  const walk = (dir: string, hits: string[], pattern: RegExp, skip: string | string[]) => {
    const skips = Array.isArray(skip) ? skip : [skip];
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (skips.some((s) => p.startsWith(s))) continue;
      if (statSync(p).isDirectory()) walk(p, hits, pattern, skip);
      else if (/\.(ts|tsx)$/.test(name) && pattern.test(readFileSync(p, "utf8"))) hits.push(path.relative(srcRoot, p));
    }
  };
  it("nothing outside src/labs/foldSeal references the lab", () => {
    const hits: string[] = [];
    // the F1 architecture test names the lab's directory once (its allow-list), so the F1 directory is skipped here
    walk(srcRoot, hits, /labs\/foldSeal|FoldSealLab|foldseal-lab/, [here, path.join(srcRoot, "logic", "foldSeal")]);
    expect(hits).toEqual([]);
  });
  it("the F1 module is imported by the lab and nowhere else in the game", () => {
    const hits: string[] = [];
    walk(srcRoot, hits, /logic\/foldSeal|from ["']\.\/foldSeal|from ["']\.\.\/foldSeal/, path.join(srcRoot, "logic", "foldSeal"));
    expect(hits.filter((h) => !h.startsWith(path.join("labs", "foldSeal")))).toEqual([]);
  });
  it("the entry HTML is separate from index.html and points only at the lab entry", () => {
    const lab = readFileSync(path.join(repoRoot, "foldseal-lab.html"), "utf8");
    const index = readFileSync(path.join(repoRoot, "index.html"), "utf8");
    expect(lab).toContain('src="/src/labs/foldSeal/main.tsx"');
    expect(index).not.toMatch(/foldSeal|foldseal/);
    expect([...lab.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1])).toEqual(["/src/labs/foldSeal/main.tsx"]);
  });
  it("vite.config.ts and package.json do not mention the lab (no shared configuration was needed)", () => {
    for (const f of ["vite.config.ts", "package.json"]) expect(readFileSync(path.join(repoRoot, f), "utf8"), f).not.toMatch(/foldSeal|foldseal/i);
  });
});
