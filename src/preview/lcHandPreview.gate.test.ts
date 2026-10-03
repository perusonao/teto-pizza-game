// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * LC-R6-b, gates P-2 / P-3 (source + workflow level): the Preview Hand variant is a committed constant that main keeps
 * `null`, read by exactly one policy module behind `VITE_PREVIEW_MODE`, with no URL / storage / global reader, and no
 * production workflow sets a Preview variable. The built-artifact counterparts are ./lcHandPreview.bundle.gate.test.ts
 * and e2e/lc-hand-preview-activation.spec.ts.
 */
const root = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function walk(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : [rel];
  });
}
const isTest = (f: string) => /\.test\.tsx?$/.test(f);
const productionSources = walk("src").filter((f) => /\.tsx?$/.test(f) && !isTest(f));

describe("LC-R6-b source gates (P-2)", () => {
  it("main commits the variant as null (the only value that may be merged)", () => {
    expect(read("src/preview/lcHandPreview.ts")).toMatch(/^export const LC_HAND_PREVIEW_CAPACITY: LcHandPreviewCapacity = null;$/m);
    expect(read("src/logic/catalog/handPolicy.ts")).toMatch(/^export const HAND_ENFORCEMENT_PRODUCTION = false;$/m);
  });

  it("only handPolicy.ts (value) and PreviewBadge.tsx (marker / label) import the variant module", () => {
    const importers = productionSources.filter((f) => f !== "src/preview/lcHandPreview.ts" && /from\s+["'][^"']*lcHandPreview["']/.test(strip(read(f))));
    expect(importers.sort()).toEqual(["src/components/PreviewBadge.tsx", "src/logic/catalog/handPolicy.ts"]);
  });

  it("the variant value is read only behind import.meta.env.VITE_PREVIEW_MODE", () => {
    const policy = strip(read("src/logic/catalog/handPolicy.ts"));
    expect(policy).toMatch(/import\.meta\.env\.VITE_PREVIEW_MODE\s*\?\s*isHandCapacityCandidate\(LC_HAND_PREVIEW_CAPACITY\)\s*\?\s*LC_HAND_PREVIEW_CAPACITY\s*:\s*null\s*:\s*null/);
    expect(policy.match(/LC_HAND_PREVIEW_CAPACITY/g)?.length).toBe(3); // import + candidate test + value: nothing else touches it
    expect(policy).toMatch(/HAND_ENFORCEMENT_ENABLED: boolean = HAND_ENFORCEMENT_PRODUCTION \|\| previewVariant !== null;/);
    // The effective variant is for tests only: no production file other than the policy reads it.
    const readers = productionSources.filter((f) => f !== "src/logic/catalog/handPolicy.ts" && /HAND_PREVIEW_VARIANT/.test(strip(read(f))));
    expect(readers).toEqual([]);
    // The badge reads the raw constant only after its own VITE_PREVIEW_MODE early return.
    const badge = strip(read("src/components/PreviewBadge.tsx"));
    expect(badge.indexOf("if (!import.meta.env.VITE_PREVIEW_MODE) return null;")).toBeGreaterThan(-1);
    expect(badge.indexOf("if (!import.meta.env.VITE_PREVIEW_MODE) return null;")).toBeLessThan(badge.indexOf("LC_HAND_PREVIEW_CAPACITY)"));
    expect(badge).not.toMatch(/handPolicy/);
  });

  it("no URL / storage / global / cookie reader in the Large Catalog policy, the variant module or the badge", () => {
    const files = [...productionSources.filter((f) => f.startsWith("src/logic/catalog/")), "src/preview/lcHandPreview.ts", "src/components/PreviewBadge.tsx"];
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      expect(strip(read(f)), f).not.toMatch(/\b(?:location|localStorage|sessionStorage|indexedDB|URLSearchParams|globalThis|document\.cookie|window)\b/);
    }
  });

  it("no source reads a Large Catalog env / query switch (VITE_LC_*, lcHand, LC_HAND outside the variant constant)", () => {
    for (const f of productionSources) {
      const text = strip(read(f));
      expect(text, f).not.toMatch(/VITE_LC_|lcHand=|["'`]lcHand["'`]|["'`]lc-hand["'`]/);
      if (!["src/preview/lcHandPreview.ts", "src/logic/catalog/handPolicy.ts", "src/components/PreviewBadge.tsx"].includes(f)) expect(text, f).not.toMatch(/\bLC_HAND_PREVIEW_CAPACITY\b/);
    }
  });

  it("the only import.meta.env keys the policy / variant / badge read are the Preview pipeline's own", () => {
    for (const f of ["src/logic/catalog/handPolicy.ts", "src/preview/lcHandPreview.ts", "src/components/PreviewBadge.tsx"]) {
      const keys = [...strip(read(f)).matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1]);
      for (const k of keys) expect(["VITE_PREVIEW_MODE", "VITE_PREVIEW_PR", "VITE_PREVIEW_SHA"], `${f}: ${k}`).toContain(k);
    }
  });
});

describe("LC-R6-b workflow / env gates (P-3)", () => {
  const workflows = fs.readdirSync(path.join(root, ".github/workflows")).filter((f) => /\.ya?ml$/.test(f));

  it("the scan sees the production workflows", () => {
    expect(workflows).toEqual(expect.arrayContaining(["deploy.yml", "ci.yml", "e2e-webkit.yml", "firebase-production-deploy.yml"]));
  });

  it("no workflow in this repo sets VITE_PREVIEW_* or an LC_HAND variable (the Preview pipeline lives in the Preview repo)", () => {
    for (const f of workflows) {
      expect(read(`.github/workflows/${f}`), f).not.toMatch(/VITE_PREVIEW|LC_HAND|VITE_LC_/);
    }
  });

  it("the production build entry points do not set a Preview variable", () => {
    expect(read("vite.config.ts")).not.toMatch(/VITE_PREVIEW|LC_HAND|\bdefine\s*:/);
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    for (const [name, cmd] of Object.entries(pkg.scripts)) expect(cmd, `npm run ${name}`).not.toMatch(/VITE_PREVIEW|LC_HAND/);
  });

  it("no committed .env file other than .env.example", () => {
    const tracked = execFileSync("git", ["ls-files", "--", ".env*", "**/.env*"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
    expect(tracked.filter((f) => !f.endsWith(".env.example"))).toEqual([]);
    expect(read(".env.example")).not.toMatch(/VITE_PREVIEW|LC_HAND/);
  });
});
