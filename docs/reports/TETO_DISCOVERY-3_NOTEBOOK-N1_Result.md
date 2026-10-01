# Discovery 3.0 — Notebook N1 (read-only 試作ノート) Result

- Base `main`: `73aac41ac7a3ee47bfbdea5e9d9f57a4c7def1c0` (fresh fetch: identical to the audit authority, no drift).
- Authority: `docs/reports/TETO_DISCOVERY-3_HINT-NOTEBOOK_COMPLETION_AUDIT.md` (read from `origin/claude/discovery-3-hint-notebook-audit`; none of that branch's code used) + Owner Decisions OD-N1-1..6.
- `claude/p3-2-discovery-memo-model` was **not** merged / rebased / ported. Everything N1 needs (`notebookView()`, the P1 fingerprint, the record adapter, `lastTrialAttempt`) is already on `main`; nothing was ported.

## Duplicate Gate (current main)
No open PR/Issue implements a Notebook UI (audit §0; unchanged). `notebookView()` had no production consumer; ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH are all recorded (`trialRecord.ts`); the RESULT notice appears on a DUPLICATE only.

## What changed
| File | Change |
|---|---|
| `src/components/TrialNotebookSheet.tsx` (new) | read-only notebook sheet; empty state; rows from `notebookView()` |
| `src/components/trialNotebookCopy.ts` (new) | fixed copy |
| `src/components/HintSheet.tsx` | header entry 「📓 試作ノートを見る」 (every view kind, incl. OPEN_POOL / ladder-closed); UI-only open state; new optional `notebook` prop |
| `src/screens/GameScreen.tsx` | the one relay `notebook={notebookView(state.trialNotebook)}` |
| `src/App.css` | `.hint-sheet__header-actions`, `.hint-sheet__notebook-entry`, `.trial-notebook*` |
| gate tests (3) | allowlist the three N1 reader files; new gate: sheet is read-only, never renders a row `kind` |
| `HintSheet.hint5.test.tsx` | the fail-closed test counted buttons (now 閉じる + the read-only entry) |
| tests | `TrialNotebookSheet.test.tsx`, `e2e/discovery3-notebook-n1.spec.ts` |

No reducer, persistence, Hint ladder, price, recipe, or save change.

## UX
- Entry: Hint sheet header, 「試作ノートを見る」 (Owner's first-choice wording kept; fits at 360 px). HOME has no entry.
- Notebook opens as its own sheet **over** the Hint sheet (the Hint stays mounted underneath, so no Hint state is lost). Back = 「← ヒントにもどる」, backdrop tap, or Escape; none of them closes the Hint. Focus returns to the entry.
- Empty: 「まだ試作の記録はないよ。／フリークッキングで作ってみよう！」.
- Rows (model order, newest activity first): 試作 #n; ソース chips; のせたもの chips (the player's own ingredients); 「🔁 同じ組み合わせを n 回作ったよ」 when repeated (retryCount+1); the P2 line exactly as it was shown (text only). Caption 「さいごに作った順にならんでるよ」.
- Scroll: the list scrolls inside the sheet (`max-height: 100dvh − 56px`), header/back stays on screen.
- Footer: 「この記録は、ゲームを読み込みなおすと消えるよ」 (accepted N1 limitation, shown to the player).

## Anti-oracle / anti-leak
- The sheet only sees `TrialEntryView` (`number`, `retryCount`, own combination, `{kind,textJa}`); `kind` is never rendered (gate + unit + e2e attribute scan). No recipe id/name, candidate name/count, correct count, distance, similarity, 「正解」, target match, or new near/far authority.
- The shown line is the existing P2 line already shown on RESULT; INCOMPLETE rows are stored/shown as an ordinary original (PR-1), so they look identical.
- pool > 1: the entry exists next to the OPEN_POOL message; e2e (Dex 12 / calabresa) asserts no recipe name/id/count and runs the whole-document `expectNoUndiscoveredIdentity`. Pool 1 likewise.
- Ladder authority, prices and order untouched (existing25 / No.26 key-free).

## Session-only / save
- `trialNotebook` is still carried by `ProgressionCarry` (HOME ↔ FREE keeps it — e2e) and is absent from `persistence.ts`; reload empties it (e2e + existing reducer unit 13/13b). Save schema stays v2 (e2e asserts `schemaVersion === 2` and no `trialNotebook` / `fp1:` in storage; existing gate pins App/persistence).

## Verification
- tsc, oxlint (no new warnings), build, full vitest: see PR checks / final comment.
- New Chromium e2e (5 tests × 390×844 and 360×800 = 10): empty state; entries + repeat + Notebook→Hint→retry + HOME/FREE + reload + schema; long list scroll (440 px window, 5 entries); pool=2 + INCOMPLETE leak scan; pool=1 anti-spoiler sweep.
- Related existing Chromium e2e (hint sheet, hint5 ladder, hint5 preview, pool-2 production, oracle neutralization, duplicate notice, dex hint, hint facts save, layout invariants) × 2 viewports: 70 passed.

## Human Verification Videos
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `n1-notebook-390x844.mp4` | 390×844 (Playwright scales the recording to 368×800) | 34.1 s | 499 KB | PASS |
| `n1-notebook-360x800.mp4` | 360×800 | 34.4 s | 569 KB | PASS |

Codec H.264 (converted from Playwright WebM with ffmpeg). Delivered directly in the session; **not committed** (`artifacts/` is gitignored).

What the video shows: FREE Cooking → 💡 ヒント → 試作ノートを見る (empty state) → ヒントにもどる → close → cook 2 attempts → Hint → ノート (2 rows, scroll) → Hint → close → continue cooking.

Video Verification: PASS (file exists, >0 bytes, plays to the end, full viewport, operation visible; ffprobe codec/resolution/duration checked).

Screenshots (390×844 / 360×800): `docs/reports/screenshots/discovery3-notebook-n1/` (empty, entries, retry, long list, pool-2 incomplete). "Before" is the existing Hint sheet (no entry); N1 adds the header button only.

## Left for N2 / later
- Show `#n` on the first NEW attempt's RESULT (today the notice appears only on a repeat) — not coupled to N1, deliberately not done.
- Notebook × Hint "hypothesis board", RESULT CTA, HOME/Dex entry, persistence (N3).
