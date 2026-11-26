import { relative } from "node:path";
import { BaseSequencer, type TestSpecification, type Vitest } from "vitest/node";

/**
 * Approximate isolated wall-clock cost, in milliseconds.
 *
 * These are the per-file durations from PR #905's first Linux CI run. Exact
 * values need not be perfect: LPT only needs the large files to be recognisable
 * instead of treating every file as equal, which is what Vitest's stock sharder
 * does. Unknown files get a small, non-zero weight and remain evenly spread.
 */
export const DURATION_WEIGHTS_MS: Readonly<Record<string, number>> = Object.freeze({
  "src/state/gameReducer.selectableHint.test.ts": 57_214,
  "src/state/gameReducer.deductionHint.test.ts": 22_317,
  "src/state/gameReducer.hint5.test.ts": 33_000,
  "src/components/HintSheet.hint5.test.tsx": 5_255,
  "src/components/HintSheet.test.tsx": 21_624,
  "src/logic/researchAttempt.sim.test.ts": 434_368,
  "src/logic/researchAttempt.sim.mainOne.test.ts": 414_760,
  "src/logic/researchAttempt.sim.sweepFull.test.ts": 696_940,
  "src/logic/researchAttempt.sim.sweepOne.test.ts": 663_689,
  "src/logic/researchAttempt.replayAudit.test.ts": 627_676,
  "src/logic/hint5Economy.sim.test.ts": 6_694,
  "src/logic/discoveryHintEconomy.sim.test.ts": 74_638,
});

export const DEFAULT_SPEC_WEIGHT_MS = 1_000;

/**
 * The measured hot files need an affinity as well as a weight. Pure LPT can
 * still put multiple long-running simulations on one shard because
 * they overlap under Vitest's worker pool. Affinity seeds the three bins using
 * their observed Linux wall-clock cost; the six files named in #855 remain
 * spread across all three shards. All remaining specs are placed by LPT. It
 * applies only to the CI's three-shard topology; other shard counts use
 * unpinned LPT.
 */
export const DURATION_SHARD_3_AFFINITY: Readonly<Record<string, 1 | 2 | 3>> = Object.freeze({
  "src/logic/researchAttempt.sim.test.ts": 1,
  "src/logic/researchAttempt.replayAudit.test.ts": 1,
  "src/components/HintSheet.hint5.test.tsx": 1,
  "src/logic/researchAttempt.sim.mainOne.test.ts": 2,
  "src/logic/researchAttempt.sim.sweepOne.test.ts": 2,
  "src/logic/hint5Economy.sim.test.ts": 2,
  "src/logic/researchAttempt.sim.sweepFull.test.ts": 3,
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
