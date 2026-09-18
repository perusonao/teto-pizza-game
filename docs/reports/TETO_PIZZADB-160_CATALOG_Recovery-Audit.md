# TETO PIZZADB-160 CATALOG — Recovery Audit (READ-ONLY)

**Audited main SHA:** `d0f17d57e06a9cddaf1cbb143d1dbaba8bb8bdf3` (origin/main, fetched fresh via `git fetch --all --prune`)
**Audit scope:** read-only. No production code changed. No catalog data restored or copied to `main`.

## Final Verdict

**D — NOT FOUND — RESEARCH/REGENERATION REQUIRED**

No trace of the claimed artifacts (`pizzadb_pizza_catalog.json`, `pizzadb_ingredient_catalog.json`, `pizzadb_game_candidate_ranking.json`, `PIZZADB_FULL-CATALOG_Game-Candidate_Audit.md`) exists anywhere in this repository — not in the working tree, not in any of the 246 commits reachable from any local or remote ref, not dangling, not in GitHub code search. Only a brief prose summary of two of the three headline numbers ever existed, and it was later deleted from `docs/PROJECT_HANDOFF.md`. The "190 managed entries" figure does not appear anywhere in git history at all.

## What was searched

1. Current working tree (`git status`) — clean, zero untracked files.
2. All tracked files reachable from every local/remote branch tip (`git ls-tree -r` across all 79 branches) — no filename matching `pizzadb`, `PIZZADB_FULL-CATALOG`, `catalog`, or `ranking` other than unrelated `ingredients.ts`/`IngredientTray` component files.
3. Full commit history, all branches, files ever added (`git log --all --diff-filter=A --name-only`) — no `pizzadb_*` filenames ever added in any commit.
4. Content pickaxe search (`git log --all -S"..."`) across all branches for: `PIZZADB`, `181 unique`, `game candidate ranking`, `canonical unique`, `190 managed`, `160 pizzas` — only `181 unique` produced hits (3 commits, detailed below); all others returned zero results.
5. Commit message search across all branches for the keyword set — no commit describes producing this catalog; matches were unrelated (Scoring 2.0 / Fugazza recipe work).
6. `git reflog show --all` and `git fsck --no-reflog --unreachable --dangling` — no dangling commits or unreachable blobs of any kind exist in this (freshly cloned) container; nothing to recover from local git internals.
7. `docs/reports/` and `docs/design/` on `main` — 16 and 7 files respectively, none named or shaped like a PIZZADB catalog/ranking artifact.
8. `data/` directory — does not exist on `main`.
9. GitHub-side search (`search_code`, `search_issues`, `search_pull_requests`) for `PIZZADB`, the three numbers, and "catalog audit" — zero matching code results; one loosely related issue (#30, Scoring 2.0 shadow prototype) with no catalog content; zero matching PRs.
10. Un/mistracked artifacts a Claude session might have left behind — none; the container is a fresh clone and the assigned branch (`claude/pizzadb-160-catalog-audit-dswgxm`) is bit-for-bit identical to `origin/main` (0 commits ahead/behind, empty diff).

## What does exist: three commits with partial numbers

Pickaxe search on `"181 unique"` found the number pair "160 canonical pizzas / 181 unique ingredients" was typed into `docs/PROJECT_HANDOFF.md` prose (not a data file) across three commits, all authored by `perusonao` (not a Claude Code commit):

| Commit | Date | Subject | What it did |
|---|---|---|---|
| `b0a28d77b12e50db2fe6e6c89ebc37da60efd3e6` | 2026-09-15 | docs: add project handoff and roadmap SSOT | **Introduces** bullets: "160 canonical pizzas", "181 unique ingredients", ingredient categories list, interaction-family candidates |
| `9a8267c866dcbc1da23c83d563e97d718dc4c8ac` | 2026-09-16 | docs: refresh project handoff after Phase 4A-1B.2 | Adds a "Data/design constraints" section: *"PIZZA DB audit found roughly 160 canonical pizzas and 181 unique ingredients... Quantity evidence in the audited source data was 0/181."* |
| `32bcab496a60d5f28818fbf8044b7dfa1d5ce7df` | 2026-09-16 | docs: sync post-audit development roadmap | **Deletes** the sentence above, replacing it with a generic statement that no longer cites the 160/181 numbers |

Current `main` (`docs/PROJECT_HANDOFF.md`) therefore **no longer contains** the 160/181 figures at all. It retains only two forward-looking backlog bullets that confirm the catalog was never brought into the repo:

- Line 480: *"Recover/normalize larger PIZZA DB-derived catalog only from verified source data."* (listed under P6 — Replayability / Content, i.e. future work)
- Line 506: *"PIZZA DB source recovery/catalog normalization as separate research/data work."* (listed under Parallel / non-blocking work)

No commit, issue, or PR anywhere mentions "190" in this context; it cannot be verified or sourced from anything in this repository.

## Important context: "PIZZA DB" is an external site, not an internal dataset

Repo-wide grep for `PIZZA DB` (main tree) shows the project's own SSOT explicitly defines "PIZZA DB" as the external site **pizzadb.jp**, used only for UX/world-view inspiration — explicitly **not** as a data source to copy:

- `docs/design/PIZZA_GAME_SSOT.md:21` — *"[PIZZA DB](https://pizzadb.jp/) が持つ「ピザという食文化を分類し、楽しく検索する」世界観・UXを参考に"*
- `docs/design/PIZZA_GAME_SSOT.md:24` — *"PIZZA DB のテキスト・画像・データそのものは一切使用しない。"* ("PIZZA DB's text, images, and data itself are never used at all.")
- Multiple other files (`referencePizza.ts`, `sauceQuantity.ts`, `ingredients.ts`, `recipes.ts`, several `docs/reports/*.md`) reiterate that no PIZZA DB quantity/geometry/text data was ever copied into game code — only used as a real-world-plausibility check.

This means the "160 pizzas / 181 unique ingredients / 190 managed entries" audit was very likely produced by a *prior, separate session* (research against the external pizzadb.jp site, e.g. via web fetch) whose full working output — the actual catalog JSON files and the ranking/audit markdown — was **never committed to this repository**. Only a two-line summary survived into `docs/PROJECT_HANDOFF.md`, and even that was later trimmed away. This is consistent with an ephemeral session workspace that expired before its artifacts were persisted to git.

## Verification checklist requested by the task

| Item | Result |
|---|---|
| Exact path | None exists |
| Branch | N/A — not present on any of the 79 branches (local + remote) |
| Commit SHA | N/A — no commit ever added these files (only prose summary, see above) |
| Tracked/untracked | N/A (nothing found); working tree is clean, 0 untracked files |
| Catalog count (160) | Unverifiable in-repo; only appeared as an unsupported prose claim, later deleted from `main` |
| Ingredient count (181) | Same as above — prose-only, later deleted |
| Ranking count | Not found anywhere; zero hits for "game candidate ranking" or "ranking" file names |
| 190 managed entries | Zero hits anywhere in git history on any branch; cannot be sourced or corroborated at all |
| 160 complete? | Cannot be assessed — no underlying data survives to check completeness against |

## Recommended next task (single, smallest next step)

Do **not** attempt to reconstruct the 160/181/190 numbers from memory. The single next task is a **fresh regeneration audit**: re-run the PIZZA DB (pizzadb.jp) categorization research from scratch as a new, explicit, source-cited deliverable — capturing the raw source evidence (URLs/snapshots consulted) alongside the derived catalog/ranking files — and commit those artifacts under `docs/reports/` and/or a new `data/` directory *in the same PR that produces them*, so this class of loss cannot recur. This should be scoped and run as its own ticket (e.g. under the existing P6 backlog item "Recover/normalize larger PIZZA DB-derived catalog only from verified source data"), not folded into unrelated feature work.
