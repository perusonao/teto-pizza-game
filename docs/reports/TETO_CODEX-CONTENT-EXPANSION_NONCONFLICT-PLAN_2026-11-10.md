# Content Expansion non-conflict plan — B23-b handoff / Research / three lines

Date: 2026-11-10  
Audited remote `main`: `577dcfd7a2557901db5f4683c35b8c6bdef5f6a4` (PR #814, B23-a)  
Scope: docs-only, read-only analysis of claimed work. No source, test, golden, existing design document, Preview, deployment, or claim was changed.

## 1. Coordination state and stop condition

Issue #780 comment `6761438162` is the latest B23-b claim observed by this audit. It was posted by the original holder,
`session_016YrGi1RVoi7RJtRnB3cKLU`, renews the B23 HOT-file reservation through
`2026-11-24T00:00:00Z`, names branch `claude/b23b-implementation-780`, and explicitly says that the claim has not been
released. At the time of this audit the named remote branch and a PR for it were not yet visible, but that does not cancel
the live claim.

Therefore Codex must not acquire an overlapping claim or edit the reserved files. Re-evaluate implementation authority only
after either:

1. a newer Issue #780 claim block with the same session and issue says `"released": true`; or
2. the claim expires under Session Operations 1.0 and no valid renewal supersedes it.

Owner has not approved forced transfer. Silence, a missing branch, or an old branch is not a release.

## 2. B23-b migration plan (execute only after authority is available)

Do not merge either old branch. Treat both as read-only evidence:

- `claude/b23b-late-desserts-780` at `7ab01a7a`: pre-split implementation of all three B23 recipes and six ingredients,
  based on `4c275c2b`; it diverges from `main` and includes B23-a content already shipped by PR #814.
- `claude/b23b-proposal-780` at `0005e905`: one proposal commit on the old branch. It changes the four dessert materials
  from `other` to `spice` and adds two cream-cheese pieces to each late recipe, but deliberately leaves Reference,
  Research pins, E2E, and derived data unfinished.

Safe extraction sequence:

1. Create the eventual implementation branch from then-current `main` (minimum base `577dcfd7`), never from either old
   branch.
2. Produce a path-by-path inventory of the old commits. Copy only the two recipes and five still-unshipped ingredients;
   exclude apple/apple-cinnamon and every B23-a count or derived pin already present on `main`.
3. Apply the approved Plan A contract: chocolate, graham-cracker, marshmallow, and powdered-sugar are `spice`; banana is
   `fruit`; add cream-cheese x2 before bake to both recipes; preserve `NO_SAUCE`; preserve late order nutella then smore.
4. Rebuild Reference positions, Hint roles, Sauce profiles, orders, size/taxonomy, glyph wiring, manifest, ladder floors,
   staged exclusions, goldens, Preview-only HV seeds, and E2E from the current generators and current catalog. Do not copy
   generated output or count pins from the old branch.
5. Diff safety gates before running them: no `.skip`, `.only`, `.todo`, threshold, timeout, allowlist, privacy rule, or
   existing Gate assertion may be weakened. A synthetic fixture may be updated only to represent the expanded `spice`
   population while preserving the same invariant.
6. Measure Research, Hint, DH4, duplicate detection, inventory, save/load, economy, entitlement, catalog counts, focused
   E2E, full Vitest, typecheck/build, and CI. Record measured deltas rather than accepting the proposal commit's values.
7. Open one Draft implementation PR. Independent review must be performed in another context; the implementation context
   does not declare Final Gate GREEN. Merge, Production ON, shared Preview, and HV deployment remain separate Owner gates.

## 3. Research approval boundary and remeasurement

### Approved baseline on current main

PR #813 approved eight existing recipe IDs for the original three-recipe B23 what-if, with canonical-order changes fixed
at zero. PR #814 then shipped apple/apple-cinnamon and recorded the current-main, apple-only measured form. The accepted
current-main baseline is:

| Existing recipe | Accepted apple-only non-canonical change set |
|---|---|
| `ikura-salmon-pizza` | `(none)->B`, `B->C` |
| `jalapeno-popper-pizza` | `(none)->A` |
| `moussaka-style-pizza` | `(none)->B` |
| `pesto-noci-pizza` | `(none)->B`, `A->B` |
| `pesto-salmone` | `(none)->B`, `B->C`, `C->D`, `D->E` |
| `pizza-radicchio-noci` | `(none)->B`, `A->B`, `B->C` |
| `speck-e-brie` | `(none)->B`, `B->C`, `C->D` |
| `spinach-artichoke-pizza` | `(none)->B`, `A->B`, `B->C`, `C->D` |

The original #813 measurement found that nutella and smore, as late recipes, added no Research-letter changes. The newer
B23-b claim says five B23-b non-canonical differences were individually approved by the Owner. That statement must be
backed by the exact five-ID before/after table in the eventual PR/Result Report; it must not be reconstructed from memory.
The Owner's instruction for this plan preserves that five-recipe approval.

### Reproducible remeasurement procedure

1. Pin the exact latest-main SHA and generate the baseline report with the repository's existing Research what-if helper,
   seeded random order set, and canonical ladder order.
2. Add only the proposed B23-b delta in memory (two late recipes, five ingredients, approved ladder order); do not include
   staged rows or the old branch's already-shipped B23-a row.
3. Run every existing prefix/canonical invariant. Stop on any canonical-order change.
4. Compare non-canonical output as an exact mapping: recipe ID -> complete set of `(before, after)` transitions. Assert the
   changed-ID set and each transition set separately; counts alone are insufficient.
5. Compare the result with both the current-main eight-ID baseline above and the exact Owner-approved five-ID B23-b table.
   Stop on an unapproved ID, a missing approved transition, or an extra transition.
6. Run the same measurement twice from a clean process and verify byte-identical normalized JSON/golden output. Store only
   the approved insertion/update; never rewrite unrelated ordering.
7. Confirm Research labels are not persisted and verify old saves load without label-derived state changes.

## 4. Three-line status at `main` 577dcfd7

| Line | Implemented | Target | Remaining | Progress | Next implementation candidate | Current constraint / Owner decision |
|---|---:|---:|---:|---:|---|---|
| Ingredients | 117 | 170 | 53 | 68.8% | B23-b: banana, chocolate, graham-cracker, marshmallow, powdered-sugar (+5) | Original session owns the live HOT claim. No Codex edit until release/expiry. |
| Recipes | 102 | 177 | 75 | 57.6% | B23-b: `nutella-dessert-pizza`, then `smore-dessert-pizza` (+2) | Same claim; exact approved five-ID Research table must be published and remeasured. |
| Cooking methods / steps | 7 | 27 | 20 | 25.9% | M7 DRIZZLE D2 inventory connection, STEAM S3/S4 decision, or FRY F2 after prerequisites | Choose sequencing and approve the relevant HOT phase; do not duplicate open PR/claim work. |

Projected after B23-b only: ingredients 122/170 (71.8%, 48 remaining), recipes 104/177 (58.8%, 73 remaining),
methods 7/27 (25.9%, 20 remaining).

## 5. Non-conflicting tracks

### M7 / DRIZZLE

PR #804 is an open Draft docs-only PR owned by the original session. Its claimed files include both M7 design documents
and generated method-ledger files, so this plan does not edit them. It establishes hot-honey-pepperoni/honey as the first
M7 target and identifies the missing post-bake-liquid inventory transaction. PR #776 already merged the isolated DRIZZLE
D1 pure logic with production OFF.

The Owner has now fixed the five D2 contracts that #804 must integrate as the canonical SSOT before HOT implementation:

1. only explicitly allowlisted liquid IDs are accepted, and `honey` remains in the M7 allowlist;
2. inventory consumption is one unit per distinct liquid ID in a round, not per stroke or point;
3. insufficient stock rejects the whole liquid application atomically, leaving inventory, pizza, and journal unchanged;
4. FINISH exit consumes each accepted liquid ID exactly once, with no duplicate consumption after repeated transition,
   undo/restore, or reload;
5. schema v2 and forward-compatible save/journal round trips are preserved; rollback must not crash or silently corrupt
   the pending round.

Next implementation candidate: D2 atomic inventory connection and save compatibility, using #804's M7-V1..V7 design
after these contracts are folded into its existing design documents. Production stays OFF. No parallel D2 document or
implementation PR should be opened while #804 owns the SSOT files.

PR #804 CI audit: run `42762403290`, job `129650960736`, failed only because
`src/logic/discovery/deductionGuard.gate.test.ts` timed out at its existing 120,000 ms limit. The summary was 649 files and
12,071 tests passed, one timed-out test, with no assertion failure. Do not relax the timeout or Gate. Record the failure,
bring #804 onto current main as its owner sees fit, and rerun only the failed job; if the same timeout repeats, treat it as
a real CI blocker and investigate outside M7 docs.

### D-ING-1

PR #805 is an open Draft docs-only PR owned by the original session. Its three D-ING-1 design files are already claimed,
so this plan does not edit them. R1 remains design/test-plan only.

The Owner has fixed the R1 design contract: maximum four riders per step; every rider must be an ingredient of its host
recipe; late riders are forbidden in R1; save compatibility remains mandatory. SAVE-6/MIG-5 and LAD-6 are therefore
verification work, not permission to weaken those constraints.

Next candidate: registry-only R1 with an empty-registry byte/behavior compatibility gate. HOT implementation waits until
B23 is complete and then requires its own fresh claim. R2/R3 and the first non-empty registry remain separate approval
points.

### Other cooking work

- STEAM PR #738 is open and production OFF. S4 is the priority. Preparation is limited to fixing the exact-head HV matrix:
  390x844 and 360x800, lid-tap A and shake B, clam and mussel, steamed look through BAKE/RESULT, sear coexistence,
  accessibility fallback, and production-bundle isolation. Preview publication and the Owner's iPhone HV remain separate
  approvals; do not start a second Steam implementation.
- FRY Issue #749 may continue in parallel only in paths not claimed by Steam/Fry F1/Fry Lab. F2 reducer integration remains
  HOT and needs a fresh non-overlapping claim before editing. The already-approved eggplant SVG direction should be compared
  as raw / fried / baked+fried at tray, pizza-piece, BAKE, and RESULT sizes, at both mobile viewports. Automated checks pin
  visual identity, non-zero bounds, production-off isolation, and no cross-method import; final visual adoption belongs to
  Owner HV.
- FOLD+SEAL lab paths have an active claim through 2026-11-20. Treat its result as read-only until released.
- Staged catalog and full-expansion ledgers are reserved by T-FX through 2026-11-21. Production batches may request only
  the established minimal generated exclusion update from that owner; do not hand-edit staged outputs.

## 6. Next Owner decisions, batched

No new decision is needed for B23-b content: Plan A, the existing five-recipe Research approval, `NO_SAUCE`, and late order
remain in force. Operationally, the shortest path is to let the current claim holder finish or formally release.

The previously open contract questions are now resolved: M7 uses the five contracts above; D-ING-1 R1 uses maximum four,
host-only, no-late riders with save compatibility; STEAM S4 is prioritized while FRY preparation continues; the eggplant
SVG direction is approved for comparison, with final adoption after Owner HV.

The next Owner decisions are operational rather than content decisions:

1. approve the exact #804 canonical-SSOT update/head after its owner integrates the five contracts and repairs CI;
2. authorize the dedicated Preview/HV execution for #738 S4 and choose A/B after reviewing the evidence;
3. after B23 completes, authorize the fresh D-ING-1 R1 HOT claim and implementation scope;
4. after the eggplant comparison evidence exists, accept or reject the final SVG in Owner HV.

Until those decisions and corresponding claims are clear, the safe work is review, measurement planning, and independent
read-only validation—not implementation in claimed paths.
