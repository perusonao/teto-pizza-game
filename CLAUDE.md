# Claude Code — repository instructions

This file is read automatically by Claude Code at the start of every session in this repository.
It intentionally stays short — it only points at the real SSOTs so they never drift out of sync.

## Read first

- `docs/PROJECT_HANDOFF.md` — project handoff / roadmap SSOT. Read this and the current execution
  issue before doing any implementation work (see its own "New-session startup checklist").

## UI/UX/gameplay changes — mandatory

UI/UX/gameplay changes MUST follow
`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`.

Human Verification video (390×844, delivered directly to the user — never committed to the repo)
plus before/after screenshots (committed under `docs/reports/screenshots/<task-name>/`) is part of
the Definition of Done for those changes. See the policy doc for the full applicability list,
video/screenshot requirements, and the Result Report format.

Do not copy the policy's full text elsewhere; reference this file/the policy doc instead.

## Multi-session coordination

Claims, the read-only Owner Gate report and the HV / Preview operating rules are in
`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` (incl. §8 Efficient flow). Check for overlapping PRs/claims before starting work.

## Content trains (recipes / ingredients) — use the kit, do not hand-write

Adding recipes or ingredients (Issue #780) follows `tools/train-kit/README.md` §1, top to bottom: approval spec → preflight
(`tools/content-train/`) → `scaffold` → fill the authored values → `claims` → `apply` → `sweep` → full tests → generated E2E → Draft PR.
The implementation spec is the single description of a train; catalog files are generated from it, not edited by hand.
Never update an expectation to make a gate pass: a failure that is not a count / position / new-row follow-up is a finding to report.
