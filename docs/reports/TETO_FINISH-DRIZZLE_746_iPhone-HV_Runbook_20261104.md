# DRIZZLE Gesture Lab #746 — iPhone Safari HV runbook

Date: 2026-11-04. Target PR #746 exact HEAD `b774a322d8de3ca0d59607a35c660701f58067eb`. Preparation only; **not actual device verification**.

## Access and safety
- The independent gesture lab exists only in a build containing PR #746 and in DEV/Preview mode with the exact opt-in `?drizzleLab=on`.
- Shared Preview may not contain this HEAD. **Do not update shared Preview or merge to enable testing without Owner approval.**
- The lab is a mock pizza canvas; it does not persist or consume stock. Confirm visible notice `試作・保存されません`.
- Record device, iOS version, Safari, build SHA, viewport, date, and screenshot/video filenames before interpreting any result.

## Owner real-device checklist
| ID | Test | Expected observation |
|---|---|---|
| D1 | Open `?drizzleLab=on` on approved build | Lab appears once; ordinary game entry unchanged without opt-in |
| D2 | Draw a slow curved line with one finger | Continuous sauce stroke follows finger without gaps or jumps |
| D3 | Draw a fast zigzag and cross existing line | No excessive lag or unexpected stray points |
| D4 | Single tap without movement | Short visible line appears, not an invisible dot |
| D5 | Draw to canvas boundary and beyond | Geometry remains within pizza/canvas bounds |
| D6 | Two-finger touch while drawing | No duplicate lines, stuck pointer, or browser zoom |
| D7 | Swipe near Safari edge, long press | No page scroll, selection/callout, navigation or ghost click |
| D8 | Interrupt gesture (app switch, notification, browser blur) | In-progress stroke cancels safely; no phantom commit |
| D9 | Reset after multiple strokes | All strokes clear; new stroke works normally |
| D10 | Rotate device / expand-collapse Safari toolbar | UI remains usable and no essential controls are clipped |
| D11 | Test narrow viewport (360x800 class) | Entire workflow is usable without vertical scrolling |
| D12 | Navigate away/back; inspect normal save/progression | No change to recipe, stock, score, Dex, or save data |

## Comparison criteria
Score each: **clarity** (user knows to draw), **finger-to-line responsiveness**, **visual quality**, **tap fallback discoverability**, **one-handed usability**, **fatigue**, **unintended browser gestures**, **accessibility**, **no side effects**. Mark PASS / NEEDS FIX / FAIL with a specific observation, not an ungrounded verdict.

Suggested gate: any D6/D7/D8/D12 failure blocks gameplay integration; D2/D3/D4/D5 issues need fixes before an Owner adoption decision. Passing the lab does **not** approve the persistent FINISH liquid model, inventory, scoring, or Production ON.

## Evidence and next actions
Attach short actual-iPhone video showing D2–D9, screenshots at 390x844 and 360x800 if available, exact build SHA and findings to PR #746. If no Owner-approved build is accessible, record **BLOCKED: no approved HV build**, rather than claiming testing. Keep #738 Steam S3 and #394 WebKit untouched.
