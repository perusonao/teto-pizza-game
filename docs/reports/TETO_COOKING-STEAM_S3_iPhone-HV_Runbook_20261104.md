# Steam S3 #738 — iPhone Safari HV runbook (preparation only)

Date: 2026-11-04. Main at preparation: `0016222145c4c88253380d53d5df40607f58e655`. Target PR #738 HEAD `2bf56fa5d16941d1fafab7b8f722ae96fe303021`. This document is a separate docs-only branch; **not** a claim of actual iPhone testing.

## Safety / entry
- PR #738 is OPEN; `STEAM_EXPERIENCE_PRODUCTION=false`. Do not merge, update the shared Preview, or enable Production without Owner approval.
- S3 Result documents an ephemeral Preview/DEV entry `?cookSteamHv=1` (A/B both); optional `&cookSteamVariant=lid` or `shake`, and `&cookSteamMs=3000|4500|6000`. The entry starts with shellfish selected and memory-only save. **These query parameters require a build containing PR #738**. Current shared Preview may not include them: verify deployed source before attempting HV; do not assume availability.
- If no Owner-approved accessible build exists, STOP at preparation. Do not replace the shared Preview for convenience.

## iPhone Safari checklist (Owner performs)
| ID | Action | Pass criterion |
|---|---|---|
| H1 | Open lab on actual iPhone, 390x844 / 360x800 as available, toolbar expanded/collapsed | Controls remain visible and reachable; no unintended scrolling |
| H2 | Place clam/mussel and inspect steam pill next to dough | Pill does not overlap dough or another technique control; reachable one-handed |
| H3 | Select A, tap lid, wait for opening animation | Intent is clear, no premature steaming or ghost click |
| H4 | Repeat A with quick taps and cancel/back | No duplicate commit, no stuck overlay |
| H5 | Select B, move pot side to side | Motion responds naturally; progress/steam feedback understandable |
| H6 | Stop B motion then resume; try tap fallback | Stop/resume feedback clear; fallback works |
| H7 | B near Safari screen edge; swipe / long touch | No page scroll, selection menu, back navigation, lost input or stuck state |
| H8 | Switch A ↔ B during a run | Prior gesture cancels; no inherited progress or accidental commit |
| H9 | Trigger pointer interruption (app switch/notification), return | Safe reset; no phantom completion |
| H10 | Continue through bake and RESULT | Shellfish appearance and other techniques remain intact |
| H11 | Compare steamed vs unsteamed ~24px shellfish | Difference readable on the real phone |
| H12 | Confirm save isolation and Production OFF | No unintended save mutation or production change |

## Decision sheet
Record device/iOS/Safari, build SHA, viewport, date, video or screenshot references, and A/B results. For each variant score: clarity, fun, one-handed usability, fatigue, error rate, and visual feedback as PASS / NEEDS FIX / FAIL (with a concrete observation). Do not claim pass without real-device evidence.

**Proposed decision rule (Owner approval required):** A becomes default if both are technically safe but B adds fatigue/false gestures; B becomes default only if it adds clearly more fun without unacceptable accessibility/gesture risk; if neither meets H1/H3/H7/H11, keep S3 HOLD and fix before re-evaluation. A/B comparison is not permission to enable Production.

## Evidence and handoff
- Existing PR #738 includes simulated HV captures and an S3 Result, but explicitly says actual iPhone Safari HV is outstanding.
- Report real-device observations back to #726 / #738, including whether a separate Owner-approved Preview deployment is required. Keep DRIZZLE #746 and WebKit #394 branches untouched.
