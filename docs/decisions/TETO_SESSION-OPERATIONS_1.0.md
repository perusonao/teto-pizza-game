# Session Operations 1.0 (Dev Efficiency Phase 1A)

Status: **SSOT** for multi-session coordination — claims, the Owner Gate report, and how Human
Verification and Preview fit in. Owner approval: 2026-10-19 (Phase 1A, dry-run only).
Path: `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` · Referenced from root `CLAUDE.md`.

This document **references** the existing SSOTs and does not copy them:
`docs/PROJECT_HANDOFF.md` (roadmap), `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` (HV).
Where they disagree with this file, they win.

## 0. What Phase 1A is — and is not

| Is | Is not |
|---|---|
| A **read-only** report (`Owner Gate`, dry-run) that aggregates CI, Codex, review threads, mergeability and `Depends-on` for each open PR, and warns about changed-file overlap | An auto-commenter, auto-rerunner, auto-merger or deployer |
| A convention for **session claims** (soft reservation, warnings only) | A lock: nothing is blocked by a claim |
| A written standard procedure for HV and Preview | A change to any existing workflow, required check, WebKit shard or quality gate |

Hard rules that stay in force: no merge, Production deploy or shared-Preview update without Owner
approval; a CI failure is never hidden by retry or timeout relaxation; the existing 11 checks and the
6 WebKit shards (2 viewports x 3) are unchanged; the Preview shares the Production origin, so save data is
shared by origin (see §5).

## 1. Session claims

A claim says "this session works on this Issue and these files until a date". It exists so two
sessions do not silently edit the same files (the `src/App.css` / `GameScreen.tsx` conflicts between
#558, #566 and #568 are the motivating case).

Write it as a comment on the Issue (or in the PR body / a PR comment). Only comments by the Owner
account are honoured — the repository is public, so anyone else's claim block is ignored and listed as invalid:

```
<!-- teto-claim:v1 {"session":"session_01ABC","issue":537,"pr":null,"branch":"claude/example",
  "files":["src/components/square/**","e2e/square-*.spec.ts"],"dependsOn":[558],
  "expires":"2026-10-22T00:00:00Z"} -->
```

- `files`: repo-relative paths or globs (`*`, `**`, `?`). Prefer narrow globs.
- `expires`: optional, default 72 h after the comment, **capped at 14 days** (the collector looks back 14 days).
- Renew by posting a newer block with the same `session` + `issue`; release with `"released": true`.
- `pr`: fill in once the PR exists, so a claim and its own PR are not reported as overlapping.
- **Hot files** (`scripts/ops/hot-files.json`: `App.css`, `GameScreen.tsx`, `gameReducer.ts`, `persistence.ts`,
  `recipes.ts`, `PROJECT_HANDOFF.md`, lockfile, `e2e/support/**`, ...) are flagged `HOT` when two PRs/claims share
  them. For a HOT overlap the later session states in its claim which PR merges first and rebases on it.
- Before starting: read the latest Owner Gate report (§2), and run the Duplicate Gate (search open PRs and
  Issues for the same files / topic) as today.

## 2. Owner Gate (dry-run)

Run: Actions → **Owner Gate (dry-run)** → Run workflow (default branch only). Output: the job summary and
a 14-day artifact (`owner-gate.md`, `owner-gate.json`). Nothing is written to GitHub.

Local, offline-testable: `node scripts/ops/owner-gate.mjs --repo perusonao/teto-pizza-game --pr all`
(needs a read-only `GITHUB_TOKEN`), or `--facts file.json`.

| State (first match wins) | Meaning | Next action |
|---|---|---|
| `CLOSED` | closed or merged | none |
| `HOLD` | title/body says HOLD / merge-prohibited | leave it |
| `CONFLICT` | GitHub reports the PR as conflicting | merge base into the branch; never rewrite the author's history |
| `WAIT_DEPENDENCY` | a `Depends-on: #N` PR is not merged (or an Issue is open) | wait; do not stack work on an unmerged base |
| `CI_FAILED` | a check of the **current head** failed, timed out or was cancelled | read the job, record test + run URL; fix |
| `CI_PENDING` | checks of the current head are missing or running | wait; avoid pushing, a push cancels the run |
| `CODEX_FINDINGS` | Codex reported unresolved findings on the current head | fix, resolve threads, request review of the new head |
| `CODEX_NEEDED` | no Codex review receipt covers the current head | request one (Owner/session; the Gate never does) |
| `CODEX_PENDING` | a review of the current head was requested or is running | wait |
| `THREADS_OPEN` | unresolved review threads | resolve or answer |
| `FACTS_INCOMPLETE` | mergeability or threads could not be read | re-run the Gate |
| `READY_FOR_OWNER_REVIEW` | every observed signal is clean for the current head | Owner reviews; **not** approval |

What the Gate guarantees never to say, because it cannot know:

- **HV / merge approval**: `humanVerification` and `mergeApproval` are always `NOT_ASSESSED`. Green CI + a clean
  Codex receipt do not mean Human Verification is done or that the PR may merge.
- **Required checks**: branch protection / rulesets are not inspected and not guessed. The report shows the checks
  it *observed* on the head (the repository's "11 checks" is documentation, not something the Gate enforces or assumes).
- **Latest head vs reviewed head**: only evidence for the current head SHA counts. A Codex receipt or a CI result
  for an older head is shown as a note and ignored for the state.
- **Reruns**: if a run failed on attempt 1 and passed on attempt N for the same head, the report keeps
  `RERUN_PASSED` with the failed job names. That first failure still needs its own record (existing flake Issue such as
  #394/#529/#531/#562/#570, or a new one). A green rerun is not a root cause and is not a reason to relax anything.
- **Trust**: a Codex receipt counts only when authored by `chatgpt-codex-connector[bot]`; claims only when authored by an
  Owner/Member/Collaborator. Text copied by anyone else is ignored.

Security properties (enforced by `scripts/ops/safety.test.mjs`): `workflow_dispatch` only; `permissions: {}` at the
top with read-only job permissions; refuses to run on any ref except the default branch; never checks out a PR head;
workflow inputs reach the shell only through `env`; the API client does GET and GraphQL `query` only. Promoting any
of this (comments, `workflow_run`/`issue_comment` triggers, `@codex review` posting, rerun suggestions as actions)
is a **separate Owner-approved step** — see §6.

## 3. Human Verification — standard procedure (reference, not a new policy)

Applicability, viewports, video/screenshot requirements and the Result Report format are in
`TETO_HUMAN-VERIFICATION-POLICY.md`. Operationally, per PR that needs HV:

1. PR is `READY_FOR_OWNER_REVIEW` for the current head (a push after HV restarts this: HV evidence belongs to one head).
2. The session records in the PR: the head SHA the HV applies to, the Preview URL/ref **only if the Owner approved a
   Preview deploy**, the video file facts (§7 of the Policy) and the screenshots path.
3. HV result words are the Owner's (`PASS` / `FAIL` / `waived`, with date and head SHA). Sessions do not write
   them on the Owner's behalf. The Gate does not parse them.
4. Open item (#443): whether automated evidence may replace parts of manual HV. Until the Owner revises the Policy,
   automated tests are **not** a substitute for the Policy's HV requirements.

## 4. Duplicate / overlap audit record (2026-10-19, recorded only — nothing changed or closed)

| Item | Overlap with Phase 1A | Status |
|---|---|---|
| PR #105 (Dev Automation A1, draft since 2026-09-19) | opt-in Claude Issue worker + queue labels; Phase 1A claims/Gate are a different, read-only mechanism, but both aim at "what is each session doing" | untouched; Owner to decide fate |
| PR #219 (Dev CI Phase 2B: skip WebKit for non-browser files) | CI-time reduction, not coordination; any future change to WebKit selection must be reconciled with it | untouched |
| PR #208 (Dev CI Phase 2 WebKit audit, docs) | audit behind Phase 2A (merged as #210); background only | untouched |
| Issue #443 (HV Policy revision) | §3 above must follow whatever #443 decides | open, untouched |
| Issues #394 / #529 / #531 / #562 / #570 | flake tracking; the Gate only references them | open, untouched |
| #566 / #568 / D2 / #571 | in-flight work; Phase 1A touches none of their files | not blocked |

## 5. Preview and save-data origin (rules, no deployment changes)

- The shared Preview (`perusonao/teto-pizza-game-preview`) is **not touched** by Phase 1A. Updating it
  (`Build & deploy a source PR/branch` → `Deploy Preview to GitHub Pages`) needs Owner approval each time.
- Production and Preview share the `perusonao.github.io` origin, so `localStorage` is shared by origin. Preview builds
  use their own key (`teto-pizza-preview-save-v1` vs `teto-pizza-save-v1`), but **all Preview builds share that one key**:
  a build of one PR can read what another PR's build wrote, including through the Save Protection quarantine of #560/#568.
  Before any per-PR Preview exists, treat a Preview save as disposable and never carry it between PRs.
- Restoring a previous Preview = an Owner-approved re-run of the deploy workflow with the previously live **commit SHA**
  (the preview repo README records `Source ref / Source commit / Source PR / Built`). Record the SHA before replacing it.
- Per-PR Preview (separate save namespace, or a separate origin) is a Phase 1B design item; it touches
  `src/state/persistence.ts` and is intentionally not started here.

## 6. Not in Phase 1A (needs separate Owner approval)

PR comment/label writes · `workflow_run` / `issue_comment` triggers · auto `@codex review` · rerun automation ·
per-PR Preview · `App.css` split · closing or rebasing PRs #105/#208/#219 · adding the Gate or `Ops scripts tests`
to branch protection.

## 7. Verification of this tooling

`bash scripts/ops/test-ops.sh`: node:test suites (state logic, claims, overlap, collector against a fake API,
static safety of the workflows and sources) plus a mutation check proving that ten deliberately broken variants of
the logic are caught. CI runs it as the extra `Ops scripts tests` check when `scripts/ops/**` or the ops
workflows change. The dry-run workflow can only be exercised after it is on the default branch.

## 8. Changelog

- 2026-10-19: Initial version (Phase 1A, dry-run).
