# TETO Cooking Steps 2.0 — Authority Index (docs-only)

Status: PR-A of Phase 2 (Owner decision UD-C = C1, 2026-10-10). Docs only; no `src/**`, `e2e/**`, CSS or
runtime change. This index records which document is authoritative for what. It decides nothing new.
Audited `main`: `e0397ae`.

## 1. Order of authority (highest first)

1. **Owner decisions** — recorded in `TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md` §13 (OD-CS-1 = A, OD-CS-2 = B,
   OD-CS-9 (a), OD-CS-20) and in Issue #294's decision comment, plus (2026-10-10) **UD-C = C1**, PR order
   **PR-A (docs) → PR-B (CS-1a) → PR-C (CS-1b)**, and "FINISH is a separate stage; undecided Owner decisions are not filled in".
2. **Next-Phase Design** (`docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`) — phase map CS-0…CS-9 and OD-CS-1..20.
3. **FINISH Pilot design** (`docs/reports/TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md`) — Phase 1–4 split, acceptance
   criteria §8, Owner questions UD-A..I. Its P2a / P2b are the same work as CS-1a / CS-1b.
4. **History / reference only:** `…_PHASE1_FRESH-AUDIT.md` (audit of `12a09de`), `…_CS-1_PRE-START-GATE.md` (WAIT verdict, superseded),
   `…_172-MECHANIC-CLASSIFICATION_ROWS.md` + JSON (derived; regenerated at `e0397ae`; generator `docs/reports/data/TETO_POST-W1_COOKING-STEPS_classify.py`, which reads every input from the given commit via `git show` and rejects an unresolvable SHA; test: `python3 -I docs/reports/data/TETO_POST-W1_COOKING-STEPS_classify_test.py`).

## 2. Status of decisions

| ID | State |
|---|---|
| OD-CS-1 = A, OD-CS-2 = B, OD-CS-9 (a), OD-CS-20 | **Decided** (authority) |
| UD-A (Undo modes) | Implemented by #451 (Guided / Free / Research / Dinner; not Lunch Rush) |
| UD-C | **Decided: C1** |
| OD-CS-3..8, 10..19; UD-B, D, E, F, G, H, I | **Open.** Not decided here. FINISH (CS-2 / Phase 3) cannot start until the ones it names are answered (OD-CS-3, OD-CS-11; UD-H for failed bakes) |

## 3. Phase 2 PR plan and acceptance conditions

| PR | Scope | Acceptance |
|---|---|---|
| **A (this PR)** | Import authority docs from PR #295 / the Pilot branch; re-baseline counts to 55 recipes; regenerate classifier | Docs/data only. Counts derive from `main` at `e0397ae`; no `src`/CSS/runtime diff; #295 left open |
| **B — CS-1a** | `MAX_VISIBLE_COOKING_TABS` + gate test; `renderedPostBakeStep()` replacing the six `POST_BAKE && CUT` sites | Gate test derives from `RECIPES` (no 25 / 18 / 7 pins), max = 6 reached, FREE and all Dinner strips ≤ 6, 7-tab fixture fails; DOM identical to `main`; existing E2E unmodified and green; HV not required |
| **C — CS-1b** | pure `finalizeRound` extracted from `CONFIRM_BAKE`; golden over `RECIPES` × {FREE, Lunch Rush, Dinner} × {raw, good, burnt} | Before/after deep-equal; #275 verdict, exactly-once consumption and Dinner `cutWaivedFor` unchanged; OD-CS-2 = B is not implemented, only left possible |
| later | FINISH engine (Phase 3), TQ-2 | Out of scope; blocked on the open decisions above |

## 4. Fixed-value hazards (for PR-B / PR-C)

- `cookingProfiles.tabGate.test.ts` in PR #295 pins `25`, `18`, `7`: replace with values derived from `RECIPES`.
- Do not pin the catalog size elsewhere (handoff 2026-10-07: only `catalogDerived.ts` / `catalogLedger.test.ts`).
- Stale titles only (no assertion): `recipes.test.ts` ("31"), `HintSheet.test.tsx` ("25"), `completionGate.test.ts` ("28"),
  `recipeSauceProfiles.test.ts` ("32"), `discoveryProgressionModel.test.ts` ("32").
- `recipes.brazilianCalabresa.test.ts` `toHaveLength(25)` pins the first 25 recipes and is unaffected.

## 5. PR #295

Kept open by Owner instruction. Its design/docs content is superseded by PR-A and its code by PR-B; the Owner closes it after PR-B lands.
