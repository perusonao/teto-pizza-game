# Issue #811 resultNearMiss Vitest performance result

Base: `origin/main` at `5444db2b` (2026-11-11). Scope is intentionally disjoint from PR #820's
three test files and PR #815's catalog / staged / preview files.

## Change

`classifyNearMiss` now builds the immutable indexes for the shipped recipe/catalog defaults once
per worker/module load:

- colliding identity keys;
- deterministic recipe hint order;
- discovery targets grouped by recipe ID.

Injected recipe/catalog arrays still use the original generic calculation path. No production
caller uses `legacyResultNearMiss`; its full test contract remains intact.

## Measured result

Command (same machine and worktree, Vitest 5.0.0):

```text
npm test -- src/state/resultNearMiss.p2.test.ts --reporter=verbose
```

| | Before | After |
|---|---:|---:|
| Test files | 1 passed | 1 passed |
| Vitest tests | 23 passed | 23 passed |
| Truthfulness inputs walked | 11,753 | 11,753 |
| Directional lines verified | 11,753 | 11,753 |
| Duration | 63.59 s | 46.32 s |

The focused file is **17.27 s faster (27.2%)**. The six exhaustive slices moved from
8.18-11.09 s each to approximately 6.78-7.25 s each. The input population, round-robin slicing,
60 s limit, assertions and `checkedTotal > 200` floor are unchanged; no skip, timeout increase,
Gate relaxation or sampling was introduced.
