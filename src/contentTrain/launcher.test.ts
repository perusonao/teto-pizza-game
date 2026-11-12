import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- a plain ES module of the tool (no declaration file); only its runtime behaviour is tested here
import { parseArgs, runnerInvocation, USAGE, vitestEntry } from "../../tools/content-train/launch.mjs";

/**
 * The preflight CLI's launcher (Issue #780; review of #816, P1): it must start the runner as `<node> <vitest entry>`, never as `npx`
 * (`spawnSync("npx")` cannot resolve `npx.cmd` on Windows, so every spec silently ended in exit 2 there). Nothing here starts the runner test.
 */
const ROOT = join(__dirname, "..", "..");

describe("preflight launcher: no npx, no shell, no PATH lookup", () => {
  it("spawns this node with the vitest package's own entry file", () => {
    const inv = runnerInvocation({ root: ROOT, spec: "a.json", outDir: "out", env: { KEEP: "1" }, nodePath: "/x/node" });
    expect(inv.command).toBe("/x/node");
    expect(inv.args[0]).toBe(vitestEntry(ROOT));
    expect(inv.args[0]).toMatch(/node_modules[\\/]vitest[\\/]vitest\.mjs$/);
    expect(inv.args.slice(1)).toEqual(["run", "--project", "default", "src/contentTrain/trainPreflight.run.test.ts"]);
    expect(JSON.stringify(inv)).not.toMatch(/npx/);
    expect(inv.options.shell).toBeUndefined();
    expect(inv.options.cwd).toBe(ROOT);
    expect(inv.options.env).toMatchObject({ KEEP: "1" });
    expect(inv.options.env.TETO_TRAIN_SPEC).toMatch(/a\.json$/);
    expect(inv.options.env.TETO_TRAIN_OUT).toMatch(/out$/);
  });
  it("the resolved entry really runs under the current node (the exact mechanism the CLI uses)", () => {
    const inv = runnerInvocation({ root: ROOT, spec: "a.json", outDir: "out" });
    const run = spawnSync(inv.command, [inv.args[0], "--version"], { cwd: ROOT, encoding: "utf8" });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/\d+\.\d+\.\d+/);
  });
  it("a missing vitest install fails with a message that names the fix", () => {
    expect(() => vitestEntry(join(ROOT, "no-such-dir"))).toThrow(/npm ci/);
  });
});

describe("preflight CLI arguments and the real wrapper process", () => {
  it("parseArgs needs both the spec and --out, in any order", () => {
    expect(parseArgs(["s.json", "--out", "d"])).toEqual({ spec: "s.json", outDir: "d" });
    expect(parseArgs(["--out", "d", "s.json"])).toEqual({ spec: "s.json", outDir: "d" });
    expect(parseArgs(["s.json"])).toBeNull();
    expect(parseArgs(["--out", "d"])).toBeNull();
    expect(parseArgs(["--out"])).toBeNull();
    expect(parseArgs([])).toBeNull();
  });
  it("running the wrapper itself without arguments prints the usage and exits 2 (started via process.execPath, no shell)", () => {
    const run = spawnSync(process.execPath, [join(ROOT, "tools", "content-train", "preflight.mjs")], { cwd: ROOT, encoding: "utf8" });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(2);
    expect(run.stderr).toContain(USAGE);
  });
});
