# TETO CI / WebKit Efficiency — S1 + S2 Result

- Issue #335, PR #336. Base `main` = `ce2c07b9001ea6d7d65d54342252678940b1a328` (unchanged during the work).
- Audit: `docs/reports/TETO_CI_WEBKIT_EFFICIENCY_FRESH_AUDIT.md` (on branch `claude/ci-webkit-efficiency-audit-u56d7i`; not re-done).
- Scope: CI/workflow, CI scripts, their tests and this report only. No production code. S3–S7 not started.

## Changed files
- `.github/workflows/e2e-webkit.yml` — WebKit install step uses the retry helper; evidence step passes `--install-status`.
- `scripts/ci/install-with-retry.sh` (new) — install timeout + limited retry, writes `install_status`.
- `scripts/ci/webkit-shard-evidence.mjs` — evidence schema v3 (v2 still accepted), `install_status` / `install_attempts` / `test_status`, classification.
- `scripts/ci/webkit-gate.sh` — FAIL-INFRA / FAIL-TEST labelled verdict, `gate_class=`.
- `scripts/ci/test-webkit-ci.sh` — new sections 7 (retry) and 8 (classification chain).
- `docs/reports/TETO_CI_WEBKIT_EFFICIENCY_S1-S2_Result.md` (this file).

## S1 implementation
`bash scripts/ci/install-with-retry.sh --status-file F --timeout 360 --attempts 2 -- npx playwright install --with-deps webkit`
- Per-attempt timeout 360 s (`timeout --kill-after=15`; healthy installs take 30–210 s per audit).
- At most 2 attempts (one retry), 5 s apart. Retry triggers on non-zero exit **or** timeout of the install command only.
- Step `timeout-minutes: 13` is a backstop; job `timeout-minutes: 15` unchanged.
- Playwright `list` / `test` steps are not wrapped; test retries stay 0. Tests are never retried; an assertion failure is never retried.
- Not done (scope): `install-deps` vs `install` split; `layout-chromium` install unchanged.
- Worst case: a double stall now costs ~12.5 min (2 × 6 min + delay) and still ends red; a single stall costs ≤ ~6 min + retry instead of 12–15 min + a manual re-run.

## S2 classification
Shard evidence fields: `install_status` (`ok|failed|timeout|incomplete|unknown`), `install_attempts`, `test_status` (`passed|failed|not_run`). `webkit-shard-evidence.mjs verify` prints `Classification: …`; WebKit Gate prints it and `gate_class=`.

| Situation | Classification |
|---|---|
| install failed / timed out / step killed (`incomplete`) | FAIL-INFRA |
| setup failed before the install helper ran (`unknown` + `not_run`, e.g. `npm ci`) | FAIL-INFRA (Codex P2 fix) |
| shard evidence missing / cancelled matrix without evidence | FAIL-INFRA |
| install ok + Playwright test failed / flaky | FAIL-TEST |
| install ok, but coverage/evidence inconsistent (never ran, listed mismatch, no results) | FAIL-EVIDENCE |
| both kinds in one run | e.g. `FAIL-INFRA+FAIL-TEST` (neither hidden) |
| install ok (any attempt count) + all tests pass + coverage verified | PASS |

Compatibility: only `webkit-gate.sh` / `layout-gate.sh` consume the evidence (same run, same schema). v2 evidence and evidence without install info (layout-chromium) are treated as `unknown` = no infra signal, verified as before. The `tested_base=… level=…` PASS notice token used by classify reuse is unchanged.

## Fail-closed confirmation
- Every FAIL-* verdict exits non-zero; `gate_class` never changes the exit status.
- A matrix result of `failure` / `cancelled` can never be PASS, even when evidence looks perfect (test: perfect evidence + cancelled → FAIL; evidence all green + `failure` → FAIL).
- Matrix `success` with FAIL-INFRA or FAIL-TEST evidence → FAIL.
- Mutation check: making the gate exit 0 on a labelled failure turned 10 gate/chain cases red.

## Focused tests (local)
- `bash scripts/ci/test-webkit-ci.sh` → 99/99 (new: install ok / ok after retry / fails once then ok / always fails / stall→timeout / stall then ok / `--attempts 1`; workflow wraps only the install; no Playwright retries; chain install→evidence→gate for PASS, install failure, install timeout, test failure, retry-ok, pre-install setup failure, no-evidence cancelled).
- `node scripts/ci/webkit-shard-evidence.mjs --self-test` → 45/45.
- Workflow YAML parses.
- Not run (per brief): production Vitest, Chromium E2E, local WebKit, Human Verification.

## CI / WebKit measurements (GitHub Actions, PR #336)
- Run 36940473034, head 05ac8ee. All four WebKit installs succeeded first try: 39–47 s each (retry helper `attempts=1`). No stall occurred, so **the timeout/retry path was not exercised on GitHub**; it is verified only by the shell tests.
- 390×844 shard 1/2 failed one test (`e2e/discovery-hint-sheet.spec.ts:280`, `.hint-sheet__panel` not visible, 91 passed / 1 failed). Install was ok, so WebKit Gate printed **`[FAIL-TEST] … (Playwright test failure)`** and exited 1 — the live S2 contract on a test failure. The test is outside this PR's diff; one re-run of the failed jobs passed (no second failure) and the gate went green. Treated as a pre-existing flake of that spec, not fixed here.
- After the re-run: all 9 checks green on 05ac8ee (`build`, `classify`, `layout-chromium`, 4 × webkit, both gates).
- Test steps ≈ 5.3–5.8 min per shard; re-run shard 1/2 total 8m39s.

## Codex
- One `@codex review` on 05ac8ee: one P2 — pre-install setup failures (e.g. `npm ci`) were labelled FAIL-EVIDENCE, not FAIL-INFRA. Valid; fixed in the follow-up commit (setup-failed rule + 2 self-test cases + 2 shell cases). No other findings.

## Wait time actually saved
Not measurable: no install stall occurred in the sampled run, so no saved minutes are claimed. Expected effect from the audit (stall 14.5 min → ≤ ~6–7 min, no manual re-run) remains unverified in production until a real stall happens; check the `install_status` / `install_attempts` columns in the WebKit Gate "Shard evidence" table when it does.

## Merge
Recorded on PR #336 (merge result and new `main` SHA are not known when this file is committed).

## Deferred
S3 classifier v2 (shadow), S4 DEV-only / pure-logic skip, S5 reduced WebKit tiers, S6 post-merge dedupe, S7 Playwright container, plus the `install-deps` / `install` split and applying the retry to the `layout-chromium` Chromium install.
