# Teto Pizza Game — Roadmap / SSOT Fresh Sync (2026-09-18)

READ-ONLY GitHub verification + docs/issue synchronization. No production code, no tests
changed.

## Audited main SHA

`398d48443f3bd299259bb63e3c9bd717091506ea` — fetched fresh from `origin/main` at the start of
this session and re-confirmed via `git rev-parse origin/main` before writing this report. Matches
the task's expected SHA exactly (fresh GitHub state was preferred over the expected value per the
task's own instruction, and in this case they agree).

## Why this sync was needed

Issue #22 and `docs/PROJECT_HANDOFF.md` had drifted apart. `PROJECT_HANDOFF.md` had already been
corrected once this same day (PR #67, itself part of `main` HEAD) and is accurate as of this
audit. **Issue #22's body was not part of that fix** — it was last edited 2026-09-17 and still
describes Scoring 2.0 Authority as `D. BLOCKED BY ANOTHER SYSTEM` (no Bake component, 1/7
Reference coverage), Issue #33 D1 as "the active priority", and Save v2 E0 as the "next
recommended implementation task". All of that is now stale: B1/B2/A1/A2/A3, D1/D2/D3A, Sauce Free
Boundary, Save v2 E0, and Pitz E-P1/E-P2 have all since merged. This is the exact class of drift
that caused a near-duplicate E0 re-implementation attempt.

## Phase 1 — Fresh GitHub verification

All PR states below were confirmed with `pull_request_read` (`method: get`), not the PR list
endpoint — the list endpoint's `merged` field was observed to read `false` for every closed PR
in this repository regardless of actual merge status (a tool-level quirk, cross-checked against
`git log origin/main` squash-merge commits, which do carry `(#NN)` references and match). Treat
`pull_request_read`'s per-PR `merged`/`merged_at`/`merge_commit_sha` (via `merged_at` timestamp;
GitHub squash-merges here do not report a distinct `merge_commit_sha` different from the squash
commit itself) as authoritative, not the list view.

| PR | Title | State | Merged? | Merge commit (squash, on `main`) |
|---|---|---|---|---|
| #56 | Save v2 / Inventory E0: safe v1→v2 persistence migration | closed | **MERGED** | `556376c` |
| #57 | Scoring 2.0 B2: Reference coverage complete (7/7) | closed | **MERGED** | `a063068` |
| #58 | Scoring 2.0 B1: real Bake similarity component (Shadow-only) | closed | **MERGED** | `f464026` |
| #59 | Scoring 2.0 A1 Authority Cutover: Pre-Implementation Fresh Audit (docs-only) | closed | **MERGED** | `7d2420a` |
| #60 | Scoring 2.0 A1 Authority Cutover: make Scoring 2.0 authoritative | closed | **MERGED** | `12666fa` |
| #61 | Scoring 2.0 A3 Legacy Cleanup: Fresh Pre-Implementation Audit (docs-only) | closed | **MERGED** | `4b35ff9` |
| #62 | Scoring 2.0 A3a: safe rename/cleanup | closed | **MERGED** | `12f4a4d` |
| #63 | Scoring 2.0 A3b: retire legacy `scorePizza`/`scorePlacement` | closed | **MERGED** | `0576430` |
| #64 | Issue #38 E-P1/E-P2: Score-based Pitz Reward Core + RESULT/Persistence | closed | **MERGED** | `2a2b9b1` |
| #65 | Issue #33 D3A: Reversible dough shaping + free boundary | closed | **MERGED** | `ceaa78a` |
| #66 | Sauce Free Boundary | closed | **MERGED** | `cf6d414` |
| #67 | docs: correct PROJECT_HANDOFF.md stale PR #65/#66 status | closed | **MERGED** | `398d484` (= current `main` HEAD) |
| #68 | M3A Bake Judgment: fading bake guide + continuous bake visuals | **OPEN** | not merged | — (base `398d484`, no merge conflict, tests reported 1188/1188 by the PR author; Preview/Review Playthrough explicitly marked "in progress" in the PR body itself) |

Also checked (`is:pr is:open`, full repo): three other open PRs exist beyond #68 — **#46**
("Issue #33: Dough Shaping D0 Fresh Audit", superseded by merged docs-only PR #51's
revalidation), **#34** ("Issue #32 Phase 1: unify Reference ingredient visuals", superseded by
merged PR #35/#36-era work), and **#3** (an old Pages-report docs PR). All three predate the
current roadmap state by a wide margin and appear to be stale/abandoned branches rather than
active work; no PR management was performed (out of this task's scope — docs/issue text only).

Issues:

| Issue | State | Notable |
|---|---|---|
| #22 | open | Body stale as of 2026-09-17; **rewritten in this sync** (see Phase 6). |
| #33 | open | Body's 2026-09-18 "D3 expansion" section described D3A as upcoming; D3A is merged (PR #65). Comments (3) are individually accurate/dated but the issue body wasn't updated to match. **Body updated.** |
| #37 | open | Body's 2026-09-18 "Human Feel expansion" section recommended a sequence (D3A → Sauce free-boundary → M3 bake-guidance) that is now two-thirds complete and the third item has an open (unmerged) PR. Comments (2) are accurate/dated. **Body updated.** |
| #38 | open | Body already accurately distinguishes merged E-P1/E-P2 (PR #64) from not-yet-done E-P3 (Human Feel/balance) as the remaining item. **No change needed.** |

Searched explicitly for a "Cooking Time" audit PR or issue (per the task's caution that one might
be in progress in another session): **none found** — no open/closed PR or issue title/body
matches "Cooking Time" anywhere in the repository. It exists only as a named future design
candidate inside Issue #37's own body text. The roadmap now uses the task's suggested safe
phrasing rather than asserting an audit is in progress.

## Phase 2 — Current-state reconstruction (from merged code, not chat memory)

**Making** (`DOUGH → SAUCE → CHEESE → TOPPING → BAKE`, 7 recipes in `src/data/recipes.ts`):
- Dough: drag-from-center radial stretch, 8-point shape model, now **bidirectional**
  (stretch and shrink, PR #65) with a technical-only max radius past the ideal guide ring.
- Sauce: painting now follows the actual (possibly D3A-distorted) dough silhouette past the old
  fixed circle (PR #66); Scoring untouched by this render-only change.
- Cheese/Topping: real tray drag-and-drop only for Margherita/mozzarella/basil today; every
  other recipe/ingredient combination is single-point tap/drag-release only — this gap is
  tracked as Issue #37 M2 and is **still open**, not started.
- Bake: interactive judgment. **PR #68 (M3A) is open, unmerged** — fading bake guide + continuous
  (non-snapping) bake visuals. Do not treat this as done.

**Scoring**: Scoring 2.0 is authoritative for `state.score` (`total`/`stars`) for all 7 recipes,
FREE and Lunch Rush (A1, PR #60). Bake component real for all recipes (B1, PR #58). Reference
geometry reviewed for all 7 recipes (B2, PR #57). Legacy `scorePizza`/`scorePlacement` fully
deleted, zero remaining references (A3a+A3b, PR #62/#63).

**Progression**: Dex, BEST, stars, Lunch Rush all present and confirmed formula-agnostic against
Scoring 2.0 (re-verified independently across three separate audits: original Authority audit,
A1 Pre-Implementation audit, A3 Pre-Implementation audit).

**Economy**: FREE score-based Pitz reward (`recipeBaseReward × qualityMultiplier`, PR #64) is
merged; Lunch Rush's separate per-run reward is unchanged/isolated. E-P3 (Human Feel/balance
tuning) is the one open item on this track.

**Inventory**: E0 (save schema v2, `inventory` field reserved, no gameplay read yet) is merged
(PR #56). Confirmed by grep: `InventoryState` does not exist anywhere in `src/` yet — only a
code comment in `persistence.ts` noting E1 will read the field E0 added. **E1 has not started.**
This is stated as a fact confirmed against current source, not carried forward as an assumption.

## Phase 3 — Active roadmap corrected

- Issue #22's stale "#33 D1 current" / "E0 next" statements are removed from its body (replaced
  with a fresh summary — see Phase 6).
- Making priority next slice: **M3 Bake Judgment** — correctly reflecting that this is **not
  untouched**: PR #68 exists, open, unmerged, in another session's branch. The roadmap now says
  "M3A Bake Judgment has an open PR (#68), not yet merged" rather than either "not started" (stale)
  or "done" (not proven by GitHub state).
- Cooking Time: no audit PR/issue exists. Roadmap text uses: *"Cooking Time / Efficiency is the
  next design track under evaluation."*
- Inventory: E0 complete; **E1 (InventoryState) is the next candidate on the Save v2/Inventory
  track specifically** — this does not override or reorder the Making-track priority above it.

## Phase 4 — Roadmap simplification

Issue #22 was restructured (see the issue itself, and Phase 6 below) into the order the task
requested: current main → current playable capabilities → active priority → next 5 slices →
parallel tracks → completed milestones → guards. Prior detailed history (B1/B2/A1/A2/A3 audit
trails, D0/D1/D2 design rationale, etc.) was compressed into the "Completed milestones" section
with links to the still-existing `docs/reports/` files rather than deleted, so no design
rationale was lost — only de-prioritized out of the "what do I do next" path.

## Phase 5 — PROJECT_HANDOFF.md

`docs/PROJECT_HANDOFF.md` was already synchronized through `main` HEAD (398d484) by PR #67 earlier
the same day — grep for `"D1 current"`, `"E0 next"`, and stale `"OPEN"`/`"DO NOT MERGE"` PR-status
language over PR #56–#67 returned **zero matches**. This sync adds only what changed *after* that
point: PR #68 (M3A) opening, and the Cooking Time safe phrasing. See the diff for the exact
addition (a short paragraph plus one new-session-checklist item; no existing sentence was
rewritten, since nothing existing was found to be wrong).

## Phase 6 — Issue synchronization

- **Issue #22**: body rewritten in place (not a comment) to the current-truth structure described
  in Phase 4, dated 2026-09-18, citing this report and the audited SHA.
- **Issue #33**: body's 2026-09-18 "D3 expansion" section updated — D3A (reversible + dough-side
  free boundary) marked MERGED (PR #65); next open item is **D3B** (dough scoring integration),
  explicitly still not started.
- **Issue #37**: body's 2026-09-18 "Human Feel expansion" section updated — D3A and Sauce
  free-boundary marked MERGED; M3 (bake-guidance fade) marked **PR #68 open, not merged**;
  Cooking-time secondary evaluation marked as the remaining not-yet-started item in that
  recommended sequence.
- **Issue #38**: left unchanged — already correctly distinguishes merged E-P1/E-P2 from
  not-yet-done E-P3, and does not claim E-P3 blocks anything.
- No large comment volumes were added — one comment per updated issue, linking to this report,
  plus the body edits themselves (which are what a new session actually reads first).

## Unresolved ambiguity

1. **PR #68 (M3A)'s own completion state is genuinely ambiguous from GitHub alone**: its body's
   own test-plan checkbox for "Preview deploy + Review Playthrough video" is unchecked and says
   "in progress, to follow" — this could mean the authoring session is still active right now, or
   that it stalled mid-task. This report does not guess; it reports PR #68 as **open, unmerged,
   Preview/Review Playthrough not yet confirmed**, and nothing more.
2. **Cooking Time / Efficiency** has no PR or issue evidence of active work as of this SHA. If a
   "Cooking Time Fresh Audit" session is in fact running concurrently (as the task text warns is
   possible), it had not yet opened a PR or posted anything discoverable via GitHub search at the
   time of this audit.
3. Three old open PRs (#3, #34, #46) appear stale/superseded but were left untouched — closing
   them was outside this task's docs-only scope and risks discarding another session's WIP if the
   guess is wrong.

## Validation performed

- `git status` — clean before and after edits (docs-only diff).
- `git diff --stat` — confirms only `docs/PROJECT_HANDOFF.md`, this report, and no `src/`/test
  file is touched.
- Grepped `docs/PROJECT_HANDOFF.md` for `"D1 current"`, `"E0 next"`, and stale `OPEN`/`DO NOT
  MERGE` PR-status phrasing referring to PRs #56–#67 — zero matches before or after this sync
  (the file was already clean; only additive content for PR #68 / Cooking Time was appended).
- No gameplay E2E was run — this is a docs-only change per the task's own validation guidance.

## Final verdict

**A. SSOT SYNCHRONIZED — READY FOR REVIEW.**

`docs/PROJECT_HANDOFF.md` was already accurate through `main` HEAD before this session (thanks to
PR #67); this session's real contribution is (a) closing the gap PR #67 didn't cover — Issue #22's
own stale body, which is the file most likely to mislead a brand-new session — and (b) recording
PR #68's genuinely-open, not-yet-merged state so it cannot be mistaken for either "not started" or
"done" by a future reader.
