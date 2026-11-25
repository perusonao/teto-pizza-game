import { relative } from "node:path";
import { BaseSequencer, type TestSpecification, type Vitest } from "vitest/node";

/**
 * Approximate isolated wall-clock cost, in milliseconds.
 *
 * The three hint suites are the 2026-11-26 Windows measurements from #855. The
 * research simulation weights preserve the split's existing ~1,300 s total
 * estimate and use the measured 25-36 s cost of one full-catalog walk. Exact
 * values need not be perfect: LPT only needs the large files to be recognisable
 * instead of treating every file as equal, which is what Vitest's stock sharder
 * does. Unknown files get a small, non-zero weight and remain evenly spread.
 */
export const DURATION_WEIGHTS_MS: Readonly<Record<string, number>> = Object.freeze({
  "src/state/gameReducer.selectableHint.test.ts": 73_510,
  "src/state/gameReducer.deductionHint.test.ts": 32_670,
  "src/components/HintSheet.hint5.test.tsx": 12_470,
  "src/logic/researchAttempt.sim.test.ts": 560_000,
  "src/logic/researchAttempt.sim.mainOne.test.ts": 560_000,
  "src/logic/researchAttempt.sim.sweepFull.test.ts": 90_000,
  "src/logic/researchAttempt.sim.sweepOne.test.ts": 90_000,
  "src/logic/hint5Economy.sim.test.ts": 120_000,
  "src/logic/discoveryHintEconomy.sim.test.ts": 120_000,
});

export const DEFAULT_SPEC_WEIGHT_MS = 1_000;

/**
 * The measured hot files need an affinity as well as a weight. Pure LPT balances
 * totals by putting the two ~560 s research files on shards 1/2, but then packs
 * the remaining Hint/economy files together on shard 3 -- recreating #855's CPU
 * contention inside a nominally balanced total. Affinity seeds the three bins;
 * all remaining specs are still placed by LPT. It applies only to the CI's
 * three-shard topology; other shard counts use unpinned LPT.
 */
export const DURATION_SHARD_3_AFFINITY: Readonly<Record<string, 1 | 2 | 3>> = Object.freeze({
  "src/logic/researchAttempt.sim.test.ts": 1,
  "src/components/HintSheet.hint5.test.tsx": 1,
  "src/logic/researchAttempt.sim.mainOne.test.ts": 2,
  "src/logic/hint5Economy.sim.test.ts": 2,
  "src/logic/discoveryHintEconomy.sim.test.ts": 3,
  "src/state/gameReducer.selectableHint.test.ts": 3,
  "src/state/gameReducer.deductionHint.test.ts": 3,
});

export interface DurationShardItem<T> {
  id: string;
  path: string;
  value: T;
}

export interface DurationShard<T> {
  items: DurationShardItem<T>[];
  estimatedMs: number;
}

const normalise = (path: string): string => path.replaceAll("\\", "/").replace(/^\.\//, "");

export function durationWeight(path: string): number {
  return DURATION_WEIGHTS_MS[normalise(path)] ?? DEFAULT_SPEC_WEIGHT_MS;
}

/** Deterministic LPT partition: largest estimated job goes to the lightest shard. */
export function partitionDurationShards<T>(items: readonly DurationShardItem<T>[], count: number): DurationShard<T>[] {
  if (!Number.isInteger(count) || count < 1) throw new Error(`duration shard count must be a positive integer, got ${count}`);

  const shards = Array.from({ length: count }, (): DurationShard<T> => ({ items: [], estimatedMs: 0 }));
  const ordered = [...items].sort((a, b) => durationWeight(b.path) - durationWeight(a.path) || a.id.localeCompare(b.id));

  const unpinned: DurationShardItem<T>[] = [];
  for (const item of ordered) {
    const affinity = count === 3 ? DURATION_SHARD_3_AFFINITY[normalise(item.path)] : undefined;
    if (!affinity) {
      unpinned.push(item);
      continue;
    }
    const shard = shards[affinity - 1];
    shard.items.push(item);
    shard.estimatedMs += durationWeight(item.path);
  }

  for (const item of unpinned) {
    const target = shards.reduce((best, shard, index) => {
      if (shard.estimatedMs < shards[best].estimatedMs) return index;
      return best;
    }, 0);
    shards[target].items.push(item);
    shards[target].estimatedMs += durationWeight(item.path);
  }
  return shards;
}

export default class DurationShardSequencer extends BaseSequencer {
  constructor(ctx: Vitest) {
    super(ctx);
  }

  async shard(specs: TestSpecification[]): Promise<TestSpecification[]> {
    const { index, count } = this.ctx.config.shard!;
    const root = this.ctx.config.root;
    const items = specs.map((spec) => {
      const path = normalise(relative(root, spec.moduleId));
      return { id: `${spec.project.name}:${path}`, path, value: spec };
    });
    return partitionDurationShards(items, count)[index - 1].items.map((item) => item.value);
  }
}
