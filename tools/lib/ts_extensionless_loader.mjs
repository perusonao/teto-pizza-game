// Node module-resolve hook for read-only audit tooling: lets `node --experimental-strip-types`
// import `src/**/*.ts` modules that use extensionless relative imports (Vite style), without a
// bundler or node_modules. Tooling only -- never imported by src/**.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
  if (relative && !/\.(?:[cm]?[jt]sx?|json)$/.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
  }
  return nextResolve(specifier, context);
}
