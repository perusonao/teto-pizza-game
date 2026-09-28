# Discovery Hint 4.0 — DH4-2C: U3-C Hint Sheet UI (Result)

> **Status:** Implementation of the DH4-2C slice (OD-DH4-2-11 / audit §20). Issue #283, PR #284, part of #253. It builds on DH4-2B (#277, PR #278, merged `e21fbc2`).
>
> **Scope:** the U3-C Hint Sheet (OD-DH4-2-6…10) and its Layout C (audit §11 / §12). This covers `HintSheet.tsx`, the `.hint-sheet*` CSS, the App / GameScreen plumbing, the hint tests, and the e2e contracts.
>
> **Unchanged:** the runtime, economy and persistence; the Deduction Hint authority; the taxonomy; Dinner Mission, CUT, Wave 2 and the catalog.
>
> **Flag behaviour:**
> - **Production** (`DEDUCTION_HINTS_ENABLED` false, `deduction` null): only the 材料 card is shown, in the new layout.
> - **DEV / Preview:** all three cards are shown.
>
> **Merge gate:** not merged before the Owner's iPhone Human Verification on Preview.

## 1. What the sheet is now

The sheet is 「少しずつ情報を得て自分で推理するUI」, not 「答えを買うUI」.
- The **board** shows only what this player already learned.
- **「ヒントをもらう」** opens a transient **family panel**, where each card asks one question.
- Nothing on screen says what is left, how precise the next answer will be, or how many candidates remain.

### Board (default step)

| Part | Content | Decision |
|---|---|---|
| **Header** (fixed) | 💡 ヒント · 閉じる (≥ 44 px) | — |
| **Caption** | The H0 existence line (`existenceText`) | audit §13 |
| **「わかっていること」** (the one scroll area) | - **材料:** chips grouped by category. An empty category is omitted; there are **no 「？」 rows**.<br>- **構成** and **特徴:** the player's own `structureLines` / `attributeLines`.<br>- **以前のヒント:** the Economy 1.0 archive, verbatim, at the end.<br>- After 材料 guidance, the generic guidance line. | OD-DH4-2-6/8/10 |
| **Scroll cue** | A 「▾ 下にもヒントがあるよ」 pill (≥ 24 px) plus a fade, only while content is below | OD-DH4-2-7, audit §11 |
| **Footer** (fixed, **compact**) | - **「ヒントをもらう」**: one 44 px button, no price.<br>- **One Pitz line:** 「所持 n Pitz ・ Pitzはヒントが出たときだけ使うよ」. | OD-DH4-2-7: the persistent footer holds one CTA row and one Pitz line, and the choices live in a transient step |

### Family panel (transient; it replaces the board and the footer)

| Part | Content |
|---|---|
| Head | 「‹ もどる」 (44 px), then the title 「ヒントをもらう」 |
| **材料 card** (always) | 「材料ヒント — 材料の名前を1つ教えるよ」.<br>Preference chips: おまかせ (the existing sauce-first fallback) / ソース / チーズ / トッピング.<br>Notes: 「えらんだジャンルに無いときは、ほかのジャンルから教えるよ」 and 「もう教えられる材料がないときは、Pitzは使わないよ」 (audit §14). |
| **構成 card** (flag on) | 「構成ヒント — 材料の数を教えるよ」 |
| **特徴 card** (flag on) | 「特徴ヒント — まだわからない材料の「なかま」を教えるよ」 |
| Each card's button | - 「たずねる ｜ n Pitz」.<br>- 「たずねる ｜ 支払いずみ」 at the cap: enabled, with the card note 「このピザのヒント代は上限まで支払いずみ」 (OD-H3-4-1 parity).<br>- 「✓ もらいずみ」, disabled, when the player's own ledger owns it.<br>- When the balance is short, it is disabled, and a calm line appears under it: 「Pitzがたまったら、またためしてね。このまま作ってもOK！」. |
| Scroll cue | 「▾ 下にもつづくよ」, only while the cards scroll (see §2) |
| Pitz line | The same line as on the board |

### After a request

| Result | What the sheet does |
|---|---|
| **An answer** (a new 材料 chip or 構成 / 特徴 line) | - The sheet returns to the board.<br>- The new fact is highlighted and scrolled into view.<br>- Focus moves to 「ヒントをもらう」. |
| **A no-charge outcome** (audit §15) | - It stays on its own card as a line, and is announced through the sheet's live region (see below). The card is disabled **for the rest of this sheet session**. Another family's answer never re-arms it.<br>- Focus moves to もどる.<br>- **材料:** 「材料ヒントはここまで（Pitzは使っていないよ）」, followed by 「構成・特徴のヒントもあるよ」 while one of those is unowned in the player's own ledger.<br>- **構成:** 「今は新しくわかることがなかったよ（Pitzは使っていないよ）」.<br>- **特徴:** 「今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）。材料がふえると、わかることがあるかも」 (audit §8 D). |

**Focus.** Opening the sheet focuses 「ヒントをもらう」. Opening the panel focuses the first open 「たずねる」, or もどる if there is none. A preference change never moves focus.

**Live region.** One `role="status"` region is the first child of both steps, so it survives board ↔ panel.
- **What it announces:** 「わかったこと：…」 with the facts a request just added, which arrive on a freshly mounted board, or the no-charge outcome line.
- **What it repeats:** only text that the sheet itself now shows.
- **What it never announces:** an earlier answer. The fresh set is tied to the board it was computed for. This was Codex's P2 on `07d7591`, and a mutation-checked unit test pins it.

**Anti-spoiler.** Every string comes either from the view (the player's own ledger, the price, the balance, the outcome of the request just made) or is the same for every target. The DOM, `aria-*` and `data-*` carry no recipe name / id / image, no availability, no level and no candidate count. The unit sweeps (every recipe × every legacy level, and every target's panel) and the e2e `expectNoUndiscoveredIdentity` pin this.

**Legacy total** (`deduction.legacyStructure`). It stays in the 「以前のヒント」 archive only, as the DH4-2B `deductionKnownLines` doc comment describes. The 構成 card stays requestable, because a legacy total owner may still buy the topping-count clause (audit §7). **Reason:** a derived 構成 line tagged 「以前のヒント」 (audit §16) would repeat the archive line on a short screen. This is recorded for Owner HV.

## 2. Layout C (OD-DH4-2-7, audit §11 / §12) — measured

**Sheet:**
- It is sized by `height: auto`, up to `100dvh − 56px − env(safe-area-inset-top)`, so the app header stays visible. This supersedes the OD-H3-4-7 45dvh cap for the SELECTABLE sheet only; the Dex-0 onboarding and the empty sheets keep 45dvh.
- It is `position: fixed`, so the cooking stage underneath neither moves nor shrinks.

**Measured in Chromium** at 1× device-pixel ratio (DPR 1). All heights are in px; "a / b" means visible / content.

| State | N390 | N360 | S390 (390×664) | S360 (360×640) | P390i (390×844 + SA) | E390i (390×664 + SA) | E360i (360×640 + SA) |
|---|---|---|---|---|---|---|---|
| Footer (compact) | 74 | 74 | 74 | 74 | 74 | 74 | 74 |
| F fresh: board | 87 / 87 | 87 / 87 | 87 / 87 | 87 / 87 | 87 / 87 | 87 / 87 | 87 / 87 |
| K all 材料 facts: board | 171 / 171 | 171 / 171 | 171 / 171 | 171 / 171 | 171 / 171 | 171 / 171 | 171 / 171 |
| N longest, flag on (材料 + 構成 + 特徴): board | 326 / 326 | 326 / 326 | 326 / 326 | 326 / 326 | 326 / 326 | 326 / 326 | 326 / 326 |
| L legacy + all facts + guidance: board | 313 / 313 | 313 / 313 | 313 / 313 | 313 / 313 | 313 / 313 | 313 / 313 | 313 / 313 |
| Panel, flag on (3 cards): cards | 404 / 404 | 421 / 421 | 404 / 404 | 421 / 421 | 404 / 404 | **378 / 404** (cue) | **354 / 421** (cue) |
| Panel, production (材料 only): cards | 204 / 204 | 204 / 204 | 204 / 204 | 204 / 204 | 204 / 204 | 204 / 204 | 204 / 204 |

- **Board:** it does not scroll in any state in the table, at any profile.
  - **The heaviest flag-on state** is the legacy archive + every 材料 fact + guidance + 構成 + 特徴, about 444 px of content. It was measured by the independent re-review.
  - At 390×844 and 360×800 it fits.
  - It scrolls, with the cue, at S390 / S360 / E390i / E360i, showing 433 / 409 / 352 / 328 px.
  - CAP-2 and CAP-3 still hold there.
- **Capacity bars:**
  - CAP-2 (board ≥ min(150, content)) holds everywhere.
  - CAP-3 (board ≥ min(footer + bottom safe area, content)) holds everywhere.
  - The footer is compact (≤ 80 px).
- **Panel:** it fits without scrolling on 5 of 7 profiles. At 390×664 and 360×640 with the safe area, the cards scroll by 26 / 67 px, with the 「▾ 下にもつづくよ」 pill. The panel head and the Pitz line stay fixed.

**e2e contract.** `e2e/discovery-hint-sheet.spec.ts` checks every state on every profile. The profiles are all 7 on Chromium, and N390 / S390 / N360 / S360 on WebKit in CI. The checks:
- no horizontal overflow;
- **SELECTABLE sheets:** the sheet top ≥ safe-area top + 56;
- **other sheets:** height ≤ 45dvh;
- the sheet inside the viewport;
- 「ヒントをもらう」 / 閉じる / every panel control ≥ 44 px and inside the sheet's width;
- the compact footer ≤ 80 px;
- CAP-2 and CAP-3;
- both scroll cues match the real scroll state;
- the background is unmoved;
- focus returns to 「ヒント」 on close.

## 3. Screenshots

**Before** (the H3-4 sheet): `docs/reports/screenshots/dh4-2-pre-audit/before-*.png`.

**After:** `docs/reports/screenshots/dh4-2c-u3-sheet/`.
- `after-*` files are the DEV / Preview build (flag on).
- `prod-*` files are a production build (flag off), served with `vite preview`. That is what production players will see.

**Profiles** (`e2e/support/layoutProfiles.ts`; SA = safe area):
- N390 = 390×844;
- N360 = 360×800;
- S390 = 390×664;
- S360 = 360×640;
- P390i = 390×844 + SA;
- E360i = 360×640 + SA;
- the SA inset is top 47 / bottom 34.

| State | Before | After (flag on) | Production (flag off) |
|---|---|---|---|
| F: fresh (the free key only) | `before-F-fresh_E360i` | `after-F-fresh_{E360i,N390,N360}` | `prod-F-fresh_{E360i,N390,N360}` |
| G: the 「ヒントをもらう」 panel | — (new) | `after-G-panel_{N390,N360,E360i,S360}` | `prod-G-panel_{N390,N360,E360i,S360}` |
| K: all 材料 facts (cap paid) | `before-K-all-facts_{E360i,N360,N390,P390i,S360,S390}` | `after-K-all-facts_…` (same 6) | `prod-K-all-facts_…` (same 6) |
| L: legacy + guidance, board | `before-L-legacy-guidance_P390i` | `after-L-legacy-guidance_{P390i,N390}` | `prod-L-legacy-guidance_{P390i,N390}` |
| L: 材料 guidance on its card | — | `after-L-guidance-panel_{N390,P390i}` | `prod-L-guidance-panel_{N390,P390i}` |
| M: 構成 + 特徴 answered | — (new) | `after-M-deduction-answered_{N390,N360,S390,S360,E360i}` | — (flag off) |
| M: panel with 「✓ もらいずみ」 | — (new) | `after-M-panel-owned_{N390,E360i}` | — |
| N: the longest board (材料 + 構成 + 特徴) | — (new) | `after-N-longest_{N390,P390i,E360i,S360}` | — |

## 4. Verification

| Check | Result |
|---|---|
| Full Vitest | 203 files, **4328 passed**, 1 skipped |
| `tsc -b` / `oxlint` / `npm run build` | clean / 0 warnings / OK |
| Chromium e2e: `iphone-390x844` + `iphone-360x800` + `layout-chromium` | **205 passed**, 25 skipped (the WebKit-only specs) |
| CI: build, layout-chromium, Layout Contract Gate, WebKit 390×844 / 360×800 (4 shards) + WebKit Gate | see the PR |

**Unit coverage added for the review findings:**
- the compact footer (one button, no choice, no price);
- the panel cards;
- an answer returns to the board with focus on 「ヒントをもらう」;
- a preference change keeps focus;
- one live region across board and panel, announcing 「わかったこと：…」 or the no-charge outcome, and never an earlier answer; no-charge outcomes settled for the sheet session and never re-armed by another family's answer;
- the flag turning off with the panel open falls back to 材料;
- every target shows the same panel before a request.

## 5. Reviews

**Independent review on `4cf4172`: APPROVE WITH NITS**, with P0 / P1 = 0 and 2 P2 findings. All findings are addressed in the next head:

| Finding (first review) | Handling |
|---|---|
| **P2-1:** the flag-on footer was not the compact Layout C footer; CAP-3 failed at E360i / E390i | **Fixed.** The family choices moved to the transient panel (audit §10 / §12); the footer is one 「ヒントをもらう」 button plus one Pitz line (74 px). CAP-3 is now an e2e assertion, and it holds on every profile (§2). |
| **P2-2:** switching family moved focus off the radio group | **Fixed.** There is no family radio group any more. Focus moves only when the step changes (board ↔ panel) or when the focused request is disabled. There is a unit test that a preference change keeps focus. |
| P3-1: a no-charge outcome was not kept for the sheet session | **Fixed.** A per-sheet set of settled families. |
| P3-2: copy differed from §8 / §14 | **Fixed.** The second 材料 note and the 「材料がふえると、わかることがあるかも」 tail are restored. |
| P3-3: `legacyStructure` unused | Recorded in §1 (the archive only; 構成 stays requestable). |
| P3-4: the cue was plain text; the sheet top covered the app header | **Fixed.** A ≥ 24 px pill; `max-height` is `100dvh − 56 − safe-top`, asserted in e2e. |
| P3-5: outcome lines were not announced | **Fixed.** A live region (final design below). |
| P3-6: no production-build evidence; the 45dvh check was dropped for non-SELECTABLE sheets | **Fixed.** The `prod-*` screenshots and measurements (§2 / §3) were added, and the 45dvh assertion is back for TARGET / EMPTY. The through-`hintSheetView` privacy sweep stays with DH4-2D (OD-DH4-2-11). |
| P3-7: stale docs | **Fixed.** The HintSheet header and the App.css comments. |

**Independent re-review on `30cf00e`: APPROVE WITH NITS**, with P0 / P1 / P2 = 0. Every first-review finding is confirmed fixed, and no leak or regression was found. Its P3 nits are handled in the next head:

| Finding (re-review) | Handling |
|---|---|
| **P3-a:** in production, a fast double tap on 「たずねる」 could land on 「ヒントをもらう」 and reopen the panel (one charge) | **Fixed.** The request latch also covers 「ヒントをもらう」 (`aria-disabled` while latched). Unit, App and e2e tests assert it. |
| **P3-b:** a `role="status"` line mounted together with its text may not be announced | **Fixed**, then extended after Codex (below): the live region is always mounted; the outcome text arrives into it. There is a unit test that it is the same element before and after. |
| **P3-c:** two layout claims were inaccurate | **Fixed.** See §2 (the heaviest flag-on state scrolls on the short profiles, with the cue and the CAP bars intact) and the App.css panel comment. |
| **P3-d:** the double-tap App test had become conditional | **Fixed.** It now unconditionally asserts one charge, no reopened panel, and focus on 「ヒントをもらう」. |

**Exact-HEAD review of `83a0a87`:**
- **CI:** 9 / 9 green (build, layout-chromium, Layout Contract Gate, 4 WebKit shards + WebKit Gate).
- **Codex:** it reviewed `30cf00e` with "no major issues". It could not review `83a0a87`, because Codex hit its usage limit.
- **Independent reviewer:** its exact-HEAD pass stopped on an API rate limit.
- **This session's own review of the `30cf00e..83a0a87` source diff:** P0 / P1 / P2 = 0.
  - The live region only repeats the outcome the authority already returned.
  - The entry ignores taps only for the 450 ms request latch.
  - `.sr-only` takes no layout space.
- **Merge:** a Codex or independent pass on the final head should be re-requested before merge. Merge is gated on the Owner's iPhone HV anyway.

**Final Merge Gate (after Owner HV PASS on `83a0a87`):**

| Review | Finding | Handling |
|---|---|---|
| Codex on `b1efbfa` | **P2:** an answered request mounts the board with the new fact already inside, so it may not be announced | **Fixed in `07d7591`:** one live region across both steps |
| Independent review on `07d7591` | **APPROVE**, P0 / P1 / P2 = 0 (the live region persists, adds no layout and leaks nothing; the main integration was checked) | — |
| Codex on `07d7591` | **P2:** after another family's no-charge outcome, a new answer could briefly re-announce the previous answer's facts | **Fixed:** the fresh set is tied to its board, with a mutation-checked regression test |

These changes affect screen readers only; nothing visible changes from the verified Preview `83a0a87`.

## 6. Human Verification Videos

**Where they were recorded:** the Review Playthroughs ran against **the deployed Preview build**:
- the `perusonao/teto-pizza-game-preview` `site/` build of `83a0a87`, from preview commit `42068c9`;
- the Preview save key;
- 390×844;
- recorded with Playwright, then converted to MP4 / H.264 with ffmpeg.

The build files were served locally at the same `/teto-pizza-game-preview/` base, because this environment cannot reach `github.io`.

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `dh4-2c-hv-A-main-flow_390x844.mp4` | 390×844 | 47.6 s | 1.03 MB | H.264 High, yuv420p, 25 fps | PASS |
| `dh4-2c-hv-B-edge-cases_390x844.mp4` | 390×844 | 60.1 s | 1.27 MB | H.264 High, yuv420p, 25 fps | PASS |

**Download:** delivered directly in the session. The videos are not committed; `artifacts/` is git-ignored.

**Validation:**
- ffprobe reports 390×844, H.264 High and the durations above.
- A full decode to the end reported no errors.
- Contact sheets were checked by eye: the whole viewport is recorded and every step below is on screen.

**What to check in A** (Dex 11, the target is undiscovered, 300 Pitz):
1. Free Cooking → 「ヒント」: the board shows the H0 caption and one 材料 chip, with the compact 「ヒントをもらう」 footer.
2. The panel shows three cards, each 「たずねる ｜ 5 Pitz」.
3. **構成:** the board gains 「このピザは全部で6種類の材料を使うよ」 and 「トッピングは4種類使うよ」 (the topping clause), and Pitz goes 300 → 295.
4. The panel shows 構成 「✓ もらいずみ」 and 特徴 at 10.
5. **特徴:** the board gains 「まだわかっていないトッピングがあるよ」, 295 → 285.
6. **材料 (チーズ):** the モッツァレラ chip is highlighted, 285 → 280.
7. **A double tap on 「たずねる ｜ 10 Pitz」** is charged once: 280 → 270, and the sheet returns to the board.
8. **閉じる → reload:** the facts and 「✓ もらいずみ」 are back and the balance stays 270.
9. The sheet opens and closes.

**What to check in B:**
1. **B1 — pepperoni, with parmigiano owned before pepperoni:** 特徴 answers 「まだわかっていないチーズがあるよ」 and charges 5.
2. **B2 — the same ingredients, with parmigiano bought after pepperoni (T1a):** 特徴 shows only 「今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）。材料がふえると、わかることがあるかも」, and Pitz stays 300. This is the privacy downgrade.
3. **材料 guidance-only (the cap is paid):** 「たずねる ｜ 支払いずみ」 → 「材料ヒントはここまで（Pitzは使っていないよ）」 + 「構成・特徴のヒントもあるよ」; もどる shows the guidance line on the board.
4. **Insufficient Pitz (3):** every card is disabled and shows the calm line; the sheet closes, and cooking goes on.

Video Verification: PASS

**iPhone HV setup:** https://perusonao.github.io/teto-pizza-game-preview/dh4-2c-setup.html seeds these scenarios (A, B1, B2, C, D) into the Preview save key only, with a one-time backup and restore.
