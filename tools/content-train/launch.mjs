/**
 * Content Train: how `preflight.mjs` starts the opt-in runner test (Issue #780; tool support, never imported by the app).
 *
 * The runner is started as `<this node> <vitest entry> run ...`, NOT as `npx vitest ...`: `spawnSync("npx")` cannot resolve `npx.cmd` on Windows
 * (and recent Node versions refuse to spawn a `.cmd` without a shell), so every spec silently ended in exit 2 there (review of #816, P1).
 * `process.execPath` + the package's own `vitest.mjs` needs no shell and no PATH lookup on any platform.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const USAGE = "usage: preflight.mjs <spec.json> --out <dir>";

/** `{ spec, outDir }` from the CLI arguments, or `null` when either is missing. */
export function parseArgs(argv) {
  const outIndex = argv.indexOf("--out");
  const outDir = outIndex >= 0 ? argv[outIndex + 1] : undefined;
  const spec = argv.find((a, i) => !a.startsWith("--") && i !== outIndex + 1);
  return spec && outDir ? { spec, outDir } : null;
}

/** The vitest entry file shipped by the package (its `bin`), or throws a message that names the fix. */
export function vitestEntry(root) {
  const entry = join(root, "node_modules", "vitest", "vitest.mjs");
  if (!existsSync(entry)) throw new Error(`vitest is not installed (${entry} not found): run \`npm ci\` in ${root} first`);
  return entry;
}

/** The exact process to spawn for one spec: `{ command, args, options }` (no shell, no PATH lookup). */
export function runnerInvocation({ root, spec, outDir, env = process.env, nodePath = process.execPath }) {
  return {
    command: nodePath,
    args: [vitestEntry(root), "run", "--project", "default", "src/contentTrain/trainPreflight.run.test.ts"],
    options: { cwd: root, stdio: "inherit", env: { ...env, TETO_TRAIN_SPEC: resolve(spec), TETO_TRAIN_OUT: resolve(outDir) } },
  };
}
