# Teto Pizza Game — Claude Task Queue A0/A1 Result

Date: 2026-09-20
Issue: #104
Base main SHA: `2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7`

## Scope

A0 read-only audit plus A1 minimal opt-in Issue worker. No gameplay changes. Existing CI/deploy workflows are untouched.

## A0 findings

- Official `anthropics/claude-code-action@v1` supports label-triggered/direct-prompt automation.
- The action exposes `session_id`, suitable for a later `--resume` design.
- Top-level conclusion is not sufficient to reliably classify usage-limit exhaustion versus an ordinary failure.
- Therefore unattended five-hour-limit recovery remains gated until the selected authentication path exposes a trustworthy machine-readable signal.

## A1 implementation

New workflow: `.github/workflows/claude-issue-worker.yml`.

Safety properties:
- opt-in only: Issue must already carry `claude-ready`;
- label events other than `claude-ready` are ignored;
- event-triggered enqueue requires OWNER/MEMBER/COLLABORATOR relationship;
- manual dispatch still requires an already-ready open Issue;
- repository-wide concurrency group allows one worker run at a time;
- no auto-merge;
- existing CI and deploy workflows unchanged;
- worker stores Claude `session_id` metadata when available;
- ordinary/indistinguishable failure stops at `human-check` instead of an automatic retry loop.

## Required owner-side setup before enabling a real Issue

1. Ensure repository Actions can run `anthropics/claude-code-action@v1`.
2. Add repository Actions secret `CLAUDE_CODE_OAUTH_TOKEN` for the GitHub worker authentication path.
3. Create the queue-state labels before the first run:
   - `claude-ready`
   - `claude-working`
   - `claude-done`
   - `human-check`
   - later A2.5: `claude-paused-limit`, `claude-blocked`
4. Review/merge the automation PR.
5. Use a disposable dry-run Issue for the first `claude-ready` test. Do not enqueue existing gameplay Issues yet.

## Five-hour-limit status

Not enabled in A1. This is intentional. Current official action output cannot safely classify every usage-limit stop. A later A2.5 should use `session_id` + `--resume` when trustworthy, with branch/checkpoint fallback, but only after reliable limit detection for the chosen auth path is verified.

## Rollback

Remove `.github/workflows/claude-issue-worker.yml` (or revert its PR). Existing `ci.yml` and `deploy.yml` are independent and remain unchanged.
