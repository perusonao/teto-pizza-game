#!/usr/bin/env node
// Owner Gate CLI (dry-run). Usage:
//   node scripts/ops/owner-gate.mjs --repo owner/name [--pr N|all] [--out-md f] [--out-json f]
//   node scripts/ops/owner-gate.mjs --facts facts.json   (offline: facts already collected)
// Reads GITHUB_TOKEN from the environment (read-only permissions are enough). Writes nothing to GitHub.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApi, collectRepoFacts } from "./collect-facts.mjs";
import { evaluateGate } from "./lib/gate-state.mjs";
import { findOverlaps } from "./lib/overlap.mjs";
import { renderMarkdown } from "./lib/render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`unexpected argument: ${argv[i]}`);
    a[argv[i].slice(2)] = argv[++i];
  }
  return a;
}

export function buildReport({ prFacts, prFiles, claims, repo, now, repoGaps = [] }) {
  const hotFiles = JSON.parse(fs.readFileSync(path.join(here, "hot-files.json"), "utf8")).hotFiles;
  const results = prFacts.map((f) => evaluateGate(f));
  const overlaps = findOverlaps({ prs: prFiles, claims: claims.active, hotFiles });
  const md = renderMarkdown({ results, overlaps, claims, repo, generatedAt: new Date(now).toISOString(), repoGaps, dryRun: true });
  return { results, overlaps, claims, md };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();
  let input;
  let repo = args.repo ?? "(offline)";
  if (args.facts) {
    input = JSON.parse(fs.readFileSync(args.facts, "utf8"));
  } else {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("--repo must look like owner/name");
    let only = null;
    if (args.pr && args.pr !== "all") {
      if (!/^\d+$/.test(args.pr)) throw new Error("--pr must be a number or 'all'");
      only = Number(args.pr);
    }
    input = await collectRepoFacts(createApi({ token: process.env.GITHUB_TOKEN }), repo, { only, now });
  }
  const repoGaps = input.repoGaps ?? [];
  const report = buildReport({ ...input, repo, now, repoGaps });
  if (args["out-md"]) fs.writeFileSync(args["out-md"], report.md);
  if (args["out-json"]) fs.writeFileSync(args["out-json"], JSON.stringify({ results: report.results, overlaps: report.overlaps, claims: report.claims, repoGaps }, null, 2));
  process.stdout.write(report.md);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`owner-gate: ${e.message}`);
    process.exit(1);
  });
}
