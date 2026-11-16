# Issue #865 — DexOverlay discovery test slices Result

Date: 2026-11-17 (JST)  
Base: `59e34e0eaef15c7044493cf811f449c23d27e9d4` (`origin/main`)  
Branch: `codex/issue-865-dex-test-slices`  
Status: Draft / HOLD — Owner approval required before merge. Production and the shared Preview were not touched.

## Scope and coordination

- Read fresh `CLAUDE.md`, `docs/PROJECT_HANDOFF.md`, `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`, Issue #865, open PRs and recent claims.
- No open PR or live claim overlapped `src/components/DexOverlay.discovery.test.tsx` or this report when the claim was posted.
- The Batch 26 planning/implementation work (#866 / PR #859) is read-only for this task. No Batch 26 implementation file was edited.
- Only this report and `src/components/DexOverlay.discovery.test.tsx` are in scope.

## Change

The two monolithic privacy walks (`bought: false` / `true`) still cover every ladder state from 0 through 102, but are generated as fixed slices of at most 20 states. The existing per-state render, leak scan and four assertion groups are unchanged. The explicit timeout remains `30_000`; no test is skipped, deleted or weakened.

Coverage accounting:

- Before: 2 scenarios × 103 states = 206 state checks in 2 tests.
- After: the same 2 × 103 = 206 state checks in 12 tests (six slices per scenario), plus the same three non-walk tests.
- Target-file count: 5 → 15 tests; pass/skip/todo after the change: 15 / 0 / 0.

## Timing

Command: `vitest run src/components/DexOverlay.discovery.test.tsx --reporter=verbose` using Vitest 5.0.0 on the same Windows host and checkout.

| Sample | Before total | Before longest walk | After total | After longest slice |
|---|---:|---:|---:|---:|
| 1 | 55.31 s | 23.25 s | 33.43 s | 4.38 s |
| 2 | 45.89 s | 21.45 s | 34.61 s | 4.62 s |
| 3 | 36.87 s | 14.83 s | 35.66 s | 4.47 s |
| Median | 45.89 s | 21.45 s | 34.61 s | 4.47 s |

The file's wall-clock median improved by 11.28 s (24.6%). More importantly for Issue #865, the maximum individual test observed here fell from 23.25 s to 4.62 s, leaving more than 25 s below the unchanged 30 s ceiling. The full-file time does not fall proportionally because all 206 DOM render/scan states and assertions remain present.

## Verification

- Targeted test, three post-change runs: 15/15 PASS each; skip 0; todo 0.
- TypeScript: `tsc -b --pretty false` PASS.
- Lint: exit 0; pre-existing warnings remain (no warning points to either changed file).
- Production build: PASS. Production flags and deployment state were not changed.
- Full Vitest local attempt: not certified green. It reached the repository-wide test surface but produced numerous unrelated failures and extreme slowdowns in existing heavy suites, then did not exit after the last reported files; the process was stopped. The focused Issue #865 file stayed green. Final full-suite PASS/FAIL/skip/todo must therefore be taken from the PR CI on the exact pushed HEAD, not inferred from this overloaded local run.
- WebKit: this is test-only Vitest restructuring with no production source, E2E or browser behavior change. No local WebKit workflow was forced; the PR's path-classified CI result on the exact HEAD is authoritative.

## Gate

Keep the PR Draft / HOLD until the exact HEAD has CI evidence, a non-Codex independent review, and zero unresolved review threads. Do not merge, enable Production, or update the shared Preview without Owner approval.
