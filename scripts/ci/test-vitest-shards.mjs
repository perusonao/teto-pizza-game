#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { partitionDurationShards } from "../../tools/durationShardSequencer.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const vitestCli = resolve(root, "node_modules/vitest/vitest.mjs");
const listed = spawnSync(process.execPath, [vitestCli, "list", "--filesOnly", "--no-color"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (listed.error) {
  console.error(`FAIL could not start Vitest collection: ${listed.error.message}`);
  process.exit(1);
}
if (listed.status !== 0) process.exit(listed.status ?? 1);

const specs = listed.stdout
  .split(/\r?\n/)
  .map((line) => line.match(/^\[([^\]]+)]\s+(.+)$/))
  .filter(Boolean)
  .map((match) => {
    const project = match[1];
    const path = match[2].replaceAll("\\", "/");
    return { id: `${project}:${path}`, path, value: { project, path } };
  });

const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
};

if (specs.length === 0) fail("Vitest collected no specs");
const sourceIds = new Set(specs.map((spec) => spec.id));
if (sourceIds.size !== specs.length) fail(`Vitest list contains ${specs.length - sourceIds.size} duplicate spec identity/identities`);

const shards = partitionDurationShards(specs, 3);
const assigned = shards.flatMap((shard, shardIndex) => shard.items.map((item) => ({ ...item, shard: shardIndex + 1 })));
const counts = new Map();
for (const item of assigned) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);

const missing = specs.filter((spec) => !counts.has(spec.id));
const duplicates = [...counts].filter(([, count]) => count !== 1);
const unexpected = assigned.filter((item) => !sourceIds.has(item.id));
if (missing.length) fail(`${missing.length} spec(s) missing from the shard union: ${missing.slice(0, 5).map((x) => x.id).join(", ")}`);
if (duplicates.length) fail(`${duplicates.length} spec(s) assigned more than once: ${duplicates.slice(0, 5).map(([id, count]) => `${id}=${count}`).join(", ")}`);
if (unexpected.length) fail(`${unexpected.length} unexpected spec(s) appeared in the shard union`);
if (assigned.length !== specs.length) fail(`union cardinality ${assigned.length} differs from collected cardinality ${specs.length}`);

const requiredHeavy = [
  "src/state/gameReducer.selectableHint.test.ts",
  "src/state/gameReducer.deductionHint.test.ts",
  "src/components/HintSheet.hint5.test.tsx",
  "src/logic/researchAttempt.sim.test.ts",
  "src/logic/hint5Economy.sim.test.ts",
  "src/logic/discoveryHintEconomy.sim.test.ts",
];
const placement = new Map(requiredHeavy.map((path) => [path, assigned.find((item) => item.path === path)?.shard]));
for (const [path, shard] of placement) if (!shard) fail(`required heavy file was not collected: ${path}`);
if (new Set(placement.values()).size < 3) fail("the six required heavy files are not distributed across all three shards");
for (const [shard, count] of [...placement.values()].reduce((m, value) => m.set(value, (m.get(value) ?? 0) + 1), new Map())) {
  if (count > 3) fail(`shard ${shard} contains ${count} of the six required heavy files`);
}

for (const [index, shard] of shards.entries()) {
  const heavy = shard.items.filter((item) => requiredHeavy.includes(item.path)).map((item) => item.path);
  console.log(`shard ${index + 1}: ${shard.items.length} specs, estimated ${(shard.estimatedMs / 1000).toFixed(1)} s`);
  console.log(`  required heavy: ${heavy.join(", ") || "(none)"}`);
}
if (!process.exitCode) console.log(`PASS shard union is exactly the ${specs.length}-spec Vitest collection (no duplicates, no omissions)`);
