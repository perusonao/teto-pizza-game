# Discovery Hint 3.0 — H3-4 Fresh Audit / Human Verification Plan (Issue #238)

> Status: **Pre-implementation audit. Docs only.**
>
> - No production code, test or e2e file was changed.
> - No PR was opened and nothing was merged.
> - H3-4 implementation is **not started**.
> - Dinner / DM-3R-* and PR #243 were not touched.
>
> **Verdict: B. OWNER DECISIONS REQUIRED** (§15). No blocker was found. The H3-3 runtime is
> authority-correct and did not leak anything in this audit. It is not yet ready for Human
> Verification as the H3-4 final UI, because several copy and layout decisions (0 Pitz,
> 「以前のヒント」, category wording, short viewport, Dex-0 onboarding) are Owner calls that shape
> what Human Verification would verify.

## 1. Audited main and GitHub state (fresh check)

The state was fetched fresh at the start of the session. Where it differs from the handoff, GitHub and
`main` win.

| Item | State found |
|---|---|
| `origin/main` | **`726b0ac`**: Merge PR #249, DM-3R-1. `main` has moved past `8692013`. |
| H3-3 PR #247 | MERGED; merge commit `8692013` |
| DM-3R-0 PR #246 | MERGED |
| DM-3R-1 PR #249 | MERGED at 2026-09-27T07:13Z; merge commit `726b0ac`. Its post-merge gate belongs to another session. |
| Issue #238 | OPEN. The status table says H3-4 is **NOT STARTED**. |
| PR #243 (old Dinner DM-3 UI) | OPEN. **Not touched.** |

**Audit target: `main` = `726b0ac`.**

- `8692013..726b0ac` holds DM-3R-1 only (Dinner result detection, pure logic).
- None of the Hint files differs from `8692013`: `HintSheet.tsx`, `discoveryHint.ts`,
  `selectableHint.ts`, `hintFactMigration.ts`, `gameReducer.ts` hint paths, and the
  `.hint-sheet*` CSS.
- So everything audited here is exactly the H3-3 UI.
- No Dinner file was read for changes or modified.

## 2. Method

**Read:**

- the H3-3 Result Report (§21 H3-4 TODO, §22 residual risks);
- the H3-2 Result Report §25;
- Fresh Design OD-H3-1…17;
- `HintSheet.tsx`, `discoveryHint.ts`, `selectableHint.ts`, `hintFactMigration.ts`, `hintSteps.ts`,
  `data/hints.ts`, `resultNearMiss.ts`, and the `.hint-sheet*` CSS.

**Pure-authority probes:**

- Two throw-away Vitest files called the real `selectableHint.ts` / `hintFactMigration.ts` for all
  25 recipes × legacy H0–H4.
- They walked each ladder to exhaustion, and computed prices, GUIDANCE_ONLY points and
  grandfathered lines.
- The files were placed temporarily under `src/__audit/` and **deleted right after the run**.
  `git status` was checked clean.

**UI capture:**

- One throw-away Playwright spec (`e2e/zz-h34audit.spec.ts`) on local Chromium seeded saves.
- It captured and measured 11 sheet states at 390×844, 360×800, 390×664 and 360×640.
- It was **deleted right after the run**.

**Not done:**

- WebKit / real iPhone (see §11).
- Video: audit-only tasks are exempt (HV Policy §2).

## 3. Current H3-3 UI inventory

### 3.1 Entry points

All three open the same sheet through `SHOW_HINT`:

| Entry | Copy | Where |
|---|---|---|
| Free Cooking PREPARE bar | 「ヒント」 | `.prepare-bake-bar` |
| Dex 🎨 (DISCOVERABLE) card | 「💡 ヒントを見る」 | `DexOverlay.tsx:69` |
| Free Cooking RESULT | 「💡 ヒントを見る」 | `ResultPanel.tsx:193` |

### 3.2 Sheet modes (`HintSheetView.kind`)

| Kind | When | Body |
|---|---|---|
| `SELECTABLE` | Every DISCOVERABLE target **except** Dex-0 Margherita | H0 line, 3 fixed rows (ソース/チーズ/トッピング) with chips or 「？」, optional 「以前のヒント」, optional guidance line. Footer: preference radios, CTA, wallet, optional short note. |
| `TARGET` | Dex-0 Margherita onboarding only | The Hint 2.0 step list (H0 → key/sauce → count+cheese → ingredients), 「次のヒントを見る」, 「✨ はじめてのピザはヒント無料！」, 「自分で見つけたいときは、閉じてね。」, then 「ヒントはここまで！…」 |
| `SHOP_NEW` / `REFILL` / `COMPLETE` | No DISCOVERABLE target | Fixed messages (unchanged since Hint 2.0) |

### 3.3 SELECTABLE elements

| Element | Source | Notes |
|---|---|---|
| H0 line 「今の材料で、まだ見つけていないピザが作れそう！」 | `HINT_EXISTENCE_TEXT` | The same for all 25 recipes (probe: 1 variant) |
| Rows ソース / チーズ / トッピング | `presentation.rows` | Always 3 rows. Revealed chips are shown in catalog order. With nothing revealed, the row shows 「？」. |
| Free key chip | `model.freeFacts` | Looks the same as a bought chip (no "free" marking) |
| 「以前のヒント」 block | `view.grandfatheredSteps` | Only for a legacy save with a count/cheese or coarse-sauce line |
| Guidance 「このピザは、今わかっているヒントを手がかりに考えてみよう！」 | `hintOutcome === "GUIDANCE_ONLY"` | Only after a request |
| Legend 「どれのヒントがほしい？」 + radios | local state, default ソース | Resets to ソース on every sheet open |
| CTA 「🔒 ヒントを1つ解除 {n} Pitz」 / disabled 「🔒 ヒント {n} Pitz」 | `presentation.nextPrice`, `affordable` | 450 ms latch |
| Wallet 「所持 {n} Pitz」 + short note 「たまったら解除できるよ。このまま作ってもOK！」 | `presentation.pitzBalance` | |

### 3.4 Measured geometry (Chromium, `.hint-sheet` = `max-height: 45dvh`)

The body is `.hint-sheet__steps` (`overflow-y: auto`). "client/scroll" is its visible height
over its content height.

| State | 390×844 | 360×800 | 390×664 | 360×640 |
|---|---|---|---|---|
| A fresh H0 (capricciosa, 120 Pitz) | 122/122 | 141/141 | **91/122** | **80/141** |
| D all 4 facts bought (「0 Pitz」) | 150/150 | 152/169 | 91/150 | 80/169 |
| E after the request (guidance) | 172/208 | 152/227 | 91/208 | 80/227 |
| F legacy H3 + insufficient | 151/184 | 131/204 | 70/184 | **59/204** |
| G legacy H4 (「0 Pitz」 + 以前のヒント) | 172/212 | 152/232 | 91/212 | 80/232 |
| H legacy H4 + guidance | 172/270 | 152/290 | 91/270 | **80/290** |
| J Dex-0 onboarding H1 | 36/36 | 55/55 | 36/36 | 55/55 |

Values that hold in every measured state:

- Footer height: 132 px, or 153 px with the short note.
- CTA height: 48 px.
- Preference labels: **88×36 / 88×36 / 114×36 px**.
- No horizontal scroll anywhere.
- The sheet stays ≤ 45dvh.

## 4. Pure-authority facts established by the probe

The probe ran over 25 recipes × legacy H0–H4, preference トッピング, walking each ladder to exhaustion.

1. **Fresh saves (no legacy):** 「0 Pitz」 appears **only when nothing is left to sell**.
   - It appears only for capricciosa, meat-lovers and pizza-portuguesa: 4 sellable facts, cap 75,
     after 5+10+20+40.
   - The next request is always GUIDANCE_ONLY.
   - No fresh ladder ever sells a fact for 0.
2. **Legacy (Economy 1.0) saves:** 「0 Pitz」 **does sell real facts**. There are 15 zero-price fact
   transitions across 6 recipes:
   - quattro-formaggi, capricciosa, meat-lovers, parmigiana-pizza, pizza-portuguesa and
     puttanesca-pizza;
   - with legacy H1, H2 or H3.

   Example: capricciosa, legacy H3 (35 Pitz already paid under Economy 1.0):
   - 40 → 0 → 0 → guidance. Total 40, so the lifetime total is 75 = cap.

   This is **authority-correct**. ESC_PARITY caps the lifetime total at the recipe's old full cost,
   and OD-H3-9 promises no loss to legacy buyers. It is not a bug and must not change in H3-4. It
   does, however, correct H3-3 Report §22, which says "the next press is GUIDANCE_ONLY" after
   「0 Pitz」. That holds for fresh saves only.
3. **GUIDANCE_ONLY behind a non-zero price is the common case.** Every recipe's ladder is exhausted
   before its cap on 22 of 25 fresh paths. For example, margherita after 2 facts shows
   「ヒントを1つ解除 20 Pitz」. The request then shows the guidance line and charges 0. pizza-bianca
   shows 5 Pitz and answers with guidance.
4. **A 「0 Pitz」 appearance is a function of the paid count and the cap class only.**
   - Before a request it never differs between a target with facts left and one without.
     - On a fresh save, 0 always means nothing is left. That is paid inference (OD-H3-15 (a)
       accepts that exhaustion is observable).
     - On a legacy save, 0 means either "a free fact" or "nothing left".
   - **No FREE LEAK found.**
5. **Grandfathered lines found:**
   - L2/L3 「材料は全部で{2..6}種類。チーズを使うみたい / チーズは使わないみたい」;
   - L2 「ソースはトマトじゃないみたい」.

   They include **negative and count lines**. They are the player's own old purchases (H3-2 §25),
   but they are exactly the kind of statement Hint 3.0 never sells.
6. **Recipes without a category:**
   - 5 have no cheese: marinara, fugazza, pizza-bianca, pesto-tonno, puttanesca-pizza.
   - 1 has no topping: quattro-formaggi.

   Their rows still show 「？」 (correct for privacy, OD-H3-16).
7. **Future-proofing:** "a fresh ladder never shows 0 while a fact is left" holds only because the
   largest sellable count (4) equals the number of rungs within cap 75 (4). A future recipe with 5
   or more sellable facts (the 101/172 expansion, OD-H3-12) would sell fresh facts at 0.
   → Economy follow-up (§13).

## 5. Findings

Severity:

- **High:** changes what a player believes about Pitz.
- **Med:** understanding or usability.
- **Low:** polish.
- **Info:** no action, record only.

None is a correctness, privacy or double-charge defect.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| F-1 | **High** | 「🔒 ヒントを1つ解除 0 Pitz」 is ambiguous. On a fresh save it always leads to guidance, so the CTA promises a hint that does not come. On a legacy save it really gives a free fact. The same wording covers two different outcomes, and "解除 0 Pitz" reads as "free hint available". | §4-1, §4-2. Screenshots D, G. |
| F-2 | Med | **The price is shown but not charged** on GUIDANCE_ONLY (§4-3). Nothing tells the player that Pitz is spent only when a hint is actually given. After guidance, the CTA stays enabled with its price and is inert: a repeat request is identity (H3-3 §3). With a short balance, the note 「たまったら解除できるよ」 promises something the request may not deliver. | Screenshots E, H. `HintSheet.tsx` footer |
| F-3 | Med | **Short viewports hide the rows.** At 360×640 the fresh body shows 80 of 141 px: only the ソース row, cut mid-chip, is visible. チーズ/トッピング are below the fold. The footer (legend + radios + CTA + wallet) takes 132 of 288 px. There is no scroll affordance (no fade or shadow). A player can buy without seeing what is already known. | Screenshots A_360x640, A_390x664, §3.4 |
| F-4 | Med | **「以前のヒント」 is weakly separated.** Its title is a 12 px grey label. Its lines reuse `.hint-sheet__step`, the same pill as the current H0 line, so an old count/negative line looks like a current hint. At 390×844 with legacy H4, only the title is visible and its line is below the fold (G). It sits between the chip rows and the guidance, so it reads as part of the purchasable area. | Screenshots F, G, G_scrolled, H |
| F-5 | Med | **Category fallback is silent.** Choosing ソース after the sauce is known gives a チーズ chip, while the radio still says ソース. Nothing marks the new chip. The legend 「どれのヒントがほしい？」 reads as a promise that the chosen category will be served. | Screenshot C (sauce preferred, cheese revealed) |
| F-6 | Med | **「？」 suggests existence.** A 「？」 in the チーズ row of marinara (no cheese) reads as "there is a cheese, you don't know it yet". Privacy requires the uniform 「？」 (OD-H3-16), so the fix is copy that says a row may stay empty, not per-recipe data. | §4-6 |
| F-7 | Low | Preference controls are 36 px tall, below the 44 pt iOS guideline. Width 88–114 px is fine. The native radio dot is small, but the label is the tap target. | §3.4 |
| F-8 | Low | 🔒 + 「解除」 wording keeps the Economy 1.0 "unlock the next level" metaphor. Under Hint 3.0 the player asks for **one fact in a chosen category**; there is no next level. | Screenshots A–I |
| F-9 | Low | The free key chip looks the same as bought chips. That is fine for privacy, but a player cannot tell what they paid for. It is optional polish, not required. | Screenshot A |
| F-10 | Info | Dex-0 onboarding has **two free channels**: Mito's escalation lines in `data/hints.ts` (「気になる色の材料が3つあるよ…」 → … → full recipe) and the TARGET sheet (Hint 2.0 list with the count line, 「ヒントはここまで！」). The sheet looks different from the SELECTABLE one the player meets from Dex 1. | Screenshots J, K; §9 |
| F-11 | Info | Privacy check in the audited states: no recipe name or id in the sheet text; the pre-request views have the same shape for every target; the guidance appears only after a request; `resultNearMiss` is unchanged. **No leak.** | §3, H3-3 §13 tests unchanged on `main` |
| F-12 | Info | Future risk §4-7: a zero-price fresh fact becomes possible if a recipe ever sells 5 or more facts under cap 75. | §4-7 |

## 6. Copy inventory and review

### 6.1 Every Hint 3.0-related string the player can see today

| ID | Where | Current copy |
|---|---|---|
| C1 | Sheet title | 「💡 ヒント」 |
| C2 | Close | 「閉じる」 |
| C3 | H0 line | 「今の材料で、まだ見つけていないピザが作れそう！」 |
| C4 | Row labels | 「ソース」「チーズ」「トッピング」 |
| C5 | Unknown chip | 「？」 |
| C6 | Legacy title | 「以前のヒント」 |
| C7 | Legacy lines | 「材料は全部で{N}種類。チーズを使うみたい / チーズは使わないみたい」, 「ソースはトマトじゃないみたい」 |
| C8 | Guidance | 「このピザは、今わかっているヒントを手がかりに考えてみよう！」 |
| C9 | Legend | 「どれのヒントがほしい？」 |
| C10 | Preferences | 「ソース」「チーズ」「トッピング」 |
| C11 | CTA (affordable) | 「🔒 ヒントを1つ解除 {n} Pitz」 (n = 5/10/20/40/**0**) |
| C12 | CTA (short) | 「🔒 ヒント {n} Pitz」 (disabled) |
| C13 | Wallet | 「所持 {n} Pitz」 |
| C14 | Short note | 「たまったら解除できるよ。このまま作ってもOK！」 |
| C15 | Entry CTAs | 「ヒント」 (PREPARE), 「💡 ヒントを見る」 (Dex, RESULT) |
| C16 | Onboarding (TARGET) | 「次のヒントを見る」, 「✨ はじめてのピザはヒント無料！」, 「自分で見つけたいときは、閉じてね。」, 「ヒントはここまで！あとは作って試してみよう。」, plus the Hint 2.0 lines (「ソースは トマトソース みたい」, 「モッツァレラ も使うみたい」 …) |
| C17 | Empty states | SHOP_NEW / REFILL / COMPLETE (`EMPTY_COPY`, unchanged) |
| C18 | Near-miss (RESULT) | 「🤏 おしい！ 材料をあと1つ足すと／1つ減らすと／ソースを変えると、何か見つかりそう！」, 「👀 かなり近づいてるよ。少しだけ変えてみよう！」, 「🛒 新しく入荷した材料は使ってみた？」 |
| C19 | Shop | 「🎨 新しいピザのヒントになるかも」 |

### 6.2 Review against the requested criteria

| Criterion | Status | Notes |
|---|---|---|
| First-time player understands | Partly | Rows + chips are clear. C9/C11 do not say that a request gives **one ingredient** from the chosen category, or from another if that one has nothing to show. |
| Not selling the recipe answer | OK | Nothing names the recipe. C11 sells "a hint", not "the answer". C3 is generic. |
| Reads as a category **preference** | **No** | C9 「どれのヒントがほしい？」 reads as a guaranteed choice (F-5). |
| No negative fact leaked | OK in new copy | C8 is neutral (OD-H3-17). C7 legacy lines contain negatives, but only the player's own purchase. They must look clearly old (F-4). |
| Legacy vs new is distinguishable | **Weak** | C6 is small and C7 uses the current-hint pill (F-4). |
| Pitz use is clear before a request | **Weak** | C11 shows the price but not "charged only when a hint is given". 「0 Pitz」 is ambiguous (F-1). C14 over-promises (F-2). |

### 6.3 Proposed copy (not implemented; Owner picks)

Everything below is **static or depends only on data the view already carries** (price, paid count,
balance, outcome). None of it depends on per-target availability, so OD-H3-16 holds.

| ID | Proposal | Why |
|---|---|---|
| C9 → | 「知りたいジャンルをえらんでね」 + a small sub-line 「そのジャンルで出せるヒントがないときは、ほかのジャンルから1つ出るよ」 | Says it is a preference and that a fallback exists. Static, the same for every target. |
| C11 → | 「ヒントを1つもらう {n} Pitz」 (drop 🔒 and 「解除」, F-8). Or keep 🔒 and change only the verb. | "One fact", not "next level". |
| C12 → | 「ヒント {n} Pitz」 (unchanged) | Already neutral |
| New static line under the CTA | 「Pitzはヒントが出たときだけ使うよ」 | Closes F-2 for every price. True for all outcomes. |
| C14 → | 「Pitzがたまったら、またためしてね。このまま作ってもOK！」 | Does not promise an unlock (F-2) |
| C5 → | Keep 「？」, and add one static line under the rows: 「？＝まだわからない（使わないジャンルもあるよ）」. Alternative: replace 「？」 with 「まだ」. | Closes F-6 without per-recipe data |
| C6 → | 「前に買ったヒント（むかしの形式）」 or 「以前に買ったヒント」 | Makes clear the player already owns it and it is not for sale (see §8) |
| C8 | Keep. Optional: 「このピザは、いまのヒントを手がかりに作ってみよう！」 | Already OD-H3-17-safe |
| 0 Pitz | See §7 | |

## 7. 「0 Pitz」 recommendation

**Constraint (from §4):**

- When the price is 0, the UI **must not** tell a legacy free fact apart from exhaustion.
  Telling them apart would be a FREE LEAK of remaining availability.
- So one neutral state must cover both, and it must not claim "a hint will come" or "nothing is
  left".
- It also must not look like a GUIDANCE_ONLY outcome before the request (OD-H3-17: guidance only
  after the request).

| Option | Display at `nextPrice === 0` (non-onboarding) | Privacy | Clarity | Complexity |
|---|---|---|---|---|
| **Z-A (recommended)** | CTA 「ヒントをたずねる」 with a pill 「Pitzなし」 or 「支払いずみ」 instead of 「0 Pitz」. Static sub-line: 「このピザのヒント代は上限まで払ったよ。もうPitzは使わないよ」. | Safe. It depends only on paid count + cap, which are paid-derived. It is true for both meanings. | Good. It does not read as "free unlock". | UI only: `HintSheet.tsx` branch on `presentation.nextPrice === 0 && !presentation.onboarding` |
| Z-B | Keep the CTA and replace 「0 Pitz」 with 「無料」 | Safe | **Bad**: "無料" promises a hint, and a fresh save always gets guidance (F-1) | Trivial |
| Z-C | Hide the CTA at 0 and show the guidance line right away | **Not allowed for legacy saves**: it would hide a real free fact (§4-2), and it pre-announces exhaustion without a request | — | — |
| Z-D | Keep as is | Safe | F-1 remains | None |

Also, whatever option is chosen:

- **After `outcome === "GUIDANCE_ONLY"`**, disable the CTA and relabel it (e.g. 「ヒントはここまで」
  or keep the label and set `disabled`).
- This is post-request INTERACTION INFERENCE, which is allowed. It removes the inert button (F-2).
- The reducer already returns identity for a repeat, so this is presentation only.

**GUIDANCE_ONLY vs 0 Pitz:** they are different axes.

- 0 Pitz is a **price state** (cap reached), known before the request.
- GUIDANCE_ONLY is a **request outcome**, and happens at any price (§4-3).
- The UI should keep them separate. Z-A does: the pill describes the price, and the guidance line
  describes the outcome.

## 8. grandfatheredSteps (「以前のヒント」) recommendation

**Requirements** (H3-2 §25, Issue #238):

- verbatim;
- this player's own;
- never sold, priced, counted or turned into a category;
- must not look like a purchasable fact.

| Option | Presentation | Pros / cons |
|---|---|---|
| **G-A (recommended)** | A distinct, visually "archived" block. It sits **below the guidance line**, the last item in the body, and has its own framed box: a dashed border and a muted background, not the `.hint-sheet__step` pill. The title reads 「以前に買ったヒント」 with a one-line explainer 「前のヒント方式で買ったメモだよ」. No chip or glyph styling and no radio affinity. | Clearly legacy and never confused with rows or chips. The same content as today. UI + CSS only. |
| G-B | The same box, collapsed by default (「以前に買ったヒント ▸」) | Saves short-viewport space (F-3). One extra tap. The player might miss something they paid for. Needs an a11y disclosure pattern. |
| G-C | Keep the current look | F-4 remains |
| G-D | Hide the lines | **Violates OD-H3-9 / H3-2 no-loss.** Rejected. |

Also:

- Do not add a price, count, category or 「NEW」 marking to these lines.
- Do not merge them with the H0 line.
- Placing them after the guidance line keeps "what you can buy / what you learned" above "what you
  had before".

## 9. Category preference controls (ソース / チーズ / トッピング)

| Question | Finding | Recommendation |
|---|---|---|
| Is the selection clear? | Yes. The selected chip has a filled background, a bold label and an orange border. It defaults to ソース and resets on reopen. | Keep. Optionally remember the last choice within the session (UI state only). |
| Does a category read as "this recipe has one"? | Somewhat (C9 + 「？」, F-5, F-6) | §6.3 static copy |
| Can the fallback leak? | **No.** The fallback resolves in H3-1. The UI shows the same 3 controls, never disabled or counted. The only signal is which row the new chip lands in, and that is paid inference (OD-H3-6). | Keep. **Highlight the newly revealed chip** (a short pulse or 「NEW」 until the next request or close). It is computed in the component from the previous vs current chips, so it is presentation only. The player then sees where the fallback went, without any text saying the preferred row had nothing (F-5). |
| Easy to press? | 36 px tall (F-7) | Raise to ≥ 44 px, or make the three a full-width segmented control (3 × ~110 px × 44 px). Must fit within the 45dvh contract (F-3). |
| Price relation understood? | The legend and the CTA are separate lines, so it is not obvious that the price is per request whatever category is chosen | Put the price on the CTA only (already done) and add C9's static sub-line |
| Natural scroll in the sheet? | Body scrolls, `overscroll-behavior: contain`, and guidance is scrolled into view. **But** no affordance, and at 360×640 / 390×664 the rows are below the fold (F-3). | Compact footer: prefs + CTA in less height (e.g. a segmented control and the CTA side by side), and wallet + note on one line. Add a top/bottom fade when the body is scrollable. Keep `max-height: 45dvh`; it is part of the Layout Contract (`discovery-hint-sheet.spec.ts`). |

## 10. Dex-0 Margherita onboarding

Today:

- `buildHintSteps(..., {discoveredCount: 0})` drives the TARGET sheet: free, session-only, the
  auto-escalation index `autoHintIndex`, the full recipe (no Rule W, OD-H3-8).
- Mito's in-round line escalates separately (`FREE_COOK_DISCOVERY_HINT_LEVELS`).
- `PURCHASE_DISCOVERY_HINT` is onboarding-only (H3-3 §3).

| | A. Keep as is | B. Merge into the Selectable sheet (free, unpersisted) | C. A separate onboarding presentation |
|---|---|---|---|
| Implementation complexity | None | **High**. The onboarding is modelled already in H3-1 (`onboarding: true`, `persist: false`), but the reducer refuses the Selectable action at Dex 0 Margherita. `isOnboardingHintSession` would need re-plumbing, and the latch/test matrix (matrix 23/24, M8) would need rework. It touches reducer authority, which is out of scope for a UI polish slice. | **Medium-low**. Restyle TARGET only (rows/chips look, "free" badge), and keep the action, reducer and `hintSteps` unchanged. |
| Privacy | Safe. It is Margherita, and the only target at Dex 0. | Safe if the uniform rows are kept. A preference UI with everything free adds nothing to learn. | Safe (same data as A) |
| Tutorial clarity | **Weak link to later play.** The step list + 「次のヒントを見る」 looks nothing like the Dex-1 sheet (rows, preference, Pitz), so the player meets a new UI at the first paid hint. It includes the count line, which Hint 3.0 never sells. | **Best continuity.** It teaches the rows/preference UI with no cost. Risk: the preference choice is meaningless when every fact is free. | **Good.** The rows/chips visual language teaches the Dex-1 layout. The free step-by-step reveal stays simple for a first-time player. |
| Migration compatibility | No change. Nothing is persisted. | No save impact (onboarding `persist: false`). But `preDiscoveryFreeCookAttempts` auto-escalation must map onto facts, which is new logic. | No save impact. Escalation keeps working (same `revealedIndex`). |

**Recommendation: A for H3-4, and record C as a follow-up candidate.**

- H3-4 should stay a UI/copy slice.
- B is a reducer/authority change.
- C is optional polish whose value is best judged **after** Human Verification of the paid sheet.

**Owner decision OD-H3-4-8.**

## 11. Human Verification plan (iPhone real device)

### 11.1 Preconditions

- **Build:** the H3-4 Preview (or `main` for a baseline pass), Safari on iPhone.
  - A 390×844-class device (iPhone 12–15 / 13 mini is 375×812).
  - For the short case, a small device (SE 375×667), or Safari with the tab bar and keyboard
    shrinking the viewport.
- **Seeding saves:** real-device HV needs a seeded `localStorage["teto-pizza-save-v1"]`. Two ways:
  - macOS Safari → Develop → [iPhone] → Web Inspector console:
    `localStorage.setItem("teto-pizza-save-v1", <JSON>); location.reload()`;
  - or play the ladder normally (slow).

  Seed shape (the same as `e2e/discovery-hint-sheet.spec.ts` `ladderSave`):
  - `schemaVersion: 2`;
  - `dex`: the first N ladder recipes;
  - `pitzBalance`;
  - `ownedIngredientIds` + `inventory` for their materials;
  - `unlockedForShopIngredientIds`;
  - optional `discoveryHintPurchases {recipe: level}` / `discoveryHintFacts {recipe: ["ing:…"]}`.

  At Dex 11 the target is capricciosa. §16 lists the saves captured here.
- **Every scenario:** start Free Cooking → dough → 次へ to TOPPING → 「ヒント」. The header Pitz pill
  is the balance.

### 11.2 Matrix

"Privacy" means these checks:

- no recipe name (e.g. 「カプリチョーザ」) anywhere in the sheet;
- no un-bought ingredient named;
- no 「じゃない／使わない」 outside 「以前のヒント」;
- no count;
- nothing different between targets before a request.

| # | Scenario | Setup | Operation | Expected display | Privacy check |
|---|---|---|---|---|---|
| HV-1 | New save, Dex-0 Margherita | Full Reset / fresh | Free Cooking → 「ヒント」 → 「次のヒントを見る」 ×4 → close | The TARGET sheet (or the H3-4 choice from §10). No Pitz anywhere. 「✨ はじめてのピザはヒント無料！」. Ends with 「ヒントはここまで！」. The Pitz pill is unchanged. | Before discovery, only Margherita's ingredients. No other recipe. |
| HV-2 | Unbought recipe, fresh sheet | Dex 11, 120 Pitz | Open | H0 line. 3 rows. Only the free key chip (オレガノ), 「？」 elsewhere. 3 preferences, ソース selected. CTA 5 Pitz. 所持 120. | Rows/preferences/price look the same for any Dex-1+ target. No name. |
| HV-3 | Buy 1 fact | HV-2 | Select トッピング → CTA | A topping chip appears (highlighted if H3-4 adds it). Price 10. 所持 115. The header pill is 115. The sheet stays open. | Only the bought chip is new |
| HV-4 | Consecutive purchases + double tap | HV-3 | Double-tap the CTA quickly, then tap 2 more times at normal speed | The double tap buys **one** fact (latch). Prices go 20 → 40. The balance falls by exactly the shown price each time. | — |
| HV-5 | Fallback | Dex 11 fresh | Keep ソース → buy → buy again with ソース | The 2nd purchase lands in チーズ. The ソース preference stays selected. H3-4: the new chip is marked. | No text says 「ソースはもうない」 |
| HV-6 | Pitz short | Legacy H3 capricciosa, 25 Pitz | Open | CTA disabled 「ヒント 40 Pitz」, grey. The calm note. Focus on 閉じる. 閉じる and cooking still work. | The same for any target at that paid count |
| HV-7 | Legacy H1/H2/H3/H4 saves | `discoveryHintPurchases {capricciosa: 1..4}` | Open each | The price continues at 10 / 20 / 40 / 0. H1/H2: the chips of what the old lines named. H3/H4: 「以前のヒント」 with 「材料は全部で6種類。チーズを使うみたい」, visually distinct (after H3-4). H4: the 0-price state (§7). | Legacy lines appear only for a save that bought them |
| HV-8 | Legacy + new facts mixed | `{capricciosa: 2}` + facts `["ing:ham"]` | Open → buy until nothing is left | Next price 40, then 0 → 0 (a real free fact, §4-2) → guidance. The balance falls only on paid facts. The legacy block is untouched after each purchase and after a reload. | The legacy block never gets a price or radio |
| HV-9 | All paid facts owned (fresh) | Dex 11, buy 4 | Look at the CTA → press | Before: the 0-price state, worded per §7 (today 「0 Pitz」). After: the guidance line. The balance is unchanged. The CTA is inert or disabled (H3-4). | The pre-press view is the same as a legacy capricciosa H1 after 3 buys (which *does* get a free fact) |
| HV-10 | Zero purchasable / GUIDANCE_ONLY at a price | Dex 22 (target pizza-bianca), or margherita after 2 facts | Open → press | Before: a normal price (5 or 20) and the normal view. After: the guidance line. **0 charged.** The header pill is unchanged. | Before the press it looks like any other target (no FREE LEAK) |
| HV-11 | Near-miss coexistence | Dex ≥ 1, bake a near-miss pizza | RESULT → the near-miss line → 「💡 ヒントを見る」 → buy 1 → close → bake | The near-miss line is one of C18, the same before and after buying. The sheet opens on a new Free Cooking. The timer does not count sheet time. | Near-miss never names an ingredient |
| HV-12 | Sheet open/close | Any | Open via PREPARE / Dex 🎨 / RESULT. Close via 閉じる, backdrop tap, swipe-down attempt. | It opens over the stage. The background does not move. Closing returns to the same step. The timer resumes. Focus returns to 「ヒント」 (a11y). | — |
| HV-13 | Scroll inside the sheet | Legacy H4 + guidance (the longest) | Scroll the body | Smooth, no page scroll behind (`overscroll-behavior`). Guidance and the legacy block are reachable. The CTA stays fixed. | — |
| HV-14 | 390×844-class device | HV-2, HV-7 (H4), HV-9 | Visual pass | Rows visible without scroll in fresh states. Legacy + guidance may scroll. | — |
| HV-15 | Short viewport (SE / reduced Safari viewport) | HV-2, HV-7 (H4) | Visual pass | **Today:** the rows are partly hidden (F-3). **After H3-4:** all 3 rows visible in the fresh state, or a clear scroll cue. | — |
| HV-16 | Reload / persistence | After HV-4 | Reload → reopen | The same chips. The same next price. No charge. No guidance until asked. | — |
| HV-17 | Dinner isolation (smoke) | Any Dinner run | Look for a 「ヒント」 entry | No hint sheet in Dinner | — |

A video per HV Policy §4 (390×844, delivered directly, not committed) should cover HV-1…HV-13 in one
run-through when H3-4 is implemented, plus a short-viewport clip for HV-15.

## 12. Screenshots / measurement needed for H3-4 (implementation phase)

Before/after at 390×844 (the authority) and 360×640 (the short worst case), at minimum:

- A fresh;
- C fallback with the new-chip marking;
- D / G at price 0;
- E / H guidance with the disabled CTA;
- F short Pitz;
- G legacy block;
- J / K onboarding (if §10 C is chosen).

Measurement: the §3.4 table again. Target: body client height ≥ rows height in the fresh state at
360×640.

## 13. Economy

**Current authority (unchanged):**

- ESC price ladder 5 / 10 / 20 / 40;
- per-recipe caps 35 / 75 (the old full H1..H4 cost class);
- the key free;
- Rule W reserve;
- recipe discovery is never sold.

The measured full-unlock total **515 is not authority** (Fresh Design §23; OD-H3-15 (a)).

**Should H3-4 run an economy simulation? — No, not as a gate.**

- H3-4 as scoped here changes copy/layout only: no price, no ladder, no cap, no reducer.
- The H3-1 parity cap and the H3-3 tests (walk: 24 paid stages ≤ cap; matrix 1–40) already pin the
  numbers the UI shows.

**Proposed separate follow-up: `H3-ECON-1`, after Human Verification** (as OD-H3-11 / OD-H3-15
already plan):

1. **A Hint 3.0 economy walk across profiles** (★4 / ★3 / ★1), replacing the Economy 1.0 knowledge
   model that `discoveryHintEconomySim.ts` still uses (H3-3 §22). Output: Pitz spent on hints per
   profile and bakes-to-Dex-25 against the Shop burden.
2. **Legacy cap analysis:** how often legacy buyers get the 0-price facts from §4-2, and whether that
   is acceptable (it is by design today).
3. **An invariant test** (test-only, no authority change): "on a fresh ladder, `nextPrice === 0`
   implies no sellable fact remains". This guards the 101/172 expansion (§4-7, F-12). If a future
   recipe breaks it, that is an economy decision, not a UI patch.
4. **Re-evaluate the ladder** with the HV feedback. No number changes before that.

## 14. Regression / scope guard

H3-4 (and this audit) must **not** change:

- `selectableHint.ts` (pure authority: facts, Rule W, pricing, fallback, presentation);
- `hintFactMigration.ts` / `persistence.ts` (persistence and migration authority, union merge,
  schemaVersion 2);
- the double-purchase protection (reducer `expectedPaidCount` + the 450 ms CTA latch);
- the recipe matcher / discovery identity;
- scoring, inventory and the Shop;
- Dinner / DM-3R-* (including `DINNER_BLOCKED_ACTIONS` semantics);
- PR #243.

Every recommendation above can be built in `HintSheet.tsx` + `App.css` (+ tests/e2e), using fields
`HintSheetView` already carries: `presentation.nextPrice`, `paidCount`, `affordable`, `onboarding`,
`outcome`, `grandfatheredSteps`, and the chip lists. None needs new view fields that carry
availability.

## 15. Owner decisions required

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **OD-H3-4-1** | Wording of the price-0 state | Z-A / Z-B / Z-C / Z-D (§7) | **Z-A** (「ヒントをたずねる」 + 「支払いずみ」/「Pitzなし」 + static cap line). Z-C is not allowed. |
| **OD-H3-4-2** | A static line that Pitz is spent only when a hint is given | Add / don't | **Add** (F-2) |
| **OD-H3-4-3** | The CTA after GUIDANCE_ONLY | Disable + relabel / keep | **Disable + relabel** (presentation only) |
| **OD-H3-4-4** | Presentation of 「以前のヒント」 | G-A / G-B / G-C (G-D rejected) | **G-A** (an archived box, placed last, 「以前に買ったヒント」) |
| **OD-H3-4-5** | Category wording + fallback feedback | New legend + static fallback sub-line + a new-chip highlight / partial / none | **All three** |
| **OD-H3-4-6** | 「？」 placeholder | Keep + static legend / 「まだ」 / keep as is | **Keep 「？」 + the static legend line** |
| **OD-H3-4-7** | Short-viewport layout | Compact footer within 45dvh / raise the sheet height on short viewports (changes the Layout Contract) / accept | **Compact footer + scroll cue, 45dvh kept** |
| **OD-H3-4-8** | Dex-0 Margherita onboarding | A / B / C (§10) | **A now, C as a follow-up candidate** |
| **OD-H3-4-9** | CTA verb and 🔒 | 「ヒントを1つもらう」 without 🔒 / keep 「解除」 | **「ヒントを1つもらう」**, no 🔒 (F-8) |
| **OD-H3-4-10** | Economy follow-up | `H3-ECON-1` after HV (§13) / none | **Open `H3-ECON-1` after HV. No number change in H3-4.** |

## 16. Implementation candidate scope (H3-4, after the decisions)

- **`src/components/HintSheet.tsx`:**
  - SELECTABLE copy (legend, CTA verb, price-0 state, static Pitz line, short note, 「？」 legend);
  - post-guidance CTA state;
  - a new-chip highlight (local previous-chips diff);
  - the legacy block moved and restyled.
- **`src/App.css` (`.hint-sheet__*` only):**
  - compact footer;
  - preference height ≥ 44 px (segmented control);
  - legacy archived box;
  - new-chip pulse;
  - body scroll fade.
- **Tests:**
  - `HintSheet.test.tsx`: the copy per state, the price-0 branch for both fresh and legacy, the
    post-guidance disabled CTA, the new-chip marking, and a privacy sweep extended to the new copy;
  - `App.hintSheet.test.tsx` as needed;
  - the `e2e/discovery-hint-sheet.spec.ts` geometry contract, with an added "fresh rows fully
    visible at S360" assertion if OD-H3-4-7 is adopted.
- **HV:** screenshots under `docs/reports/screenshots/discovery-hint-3-h3-4-*/`, the video delivered
  directly, the Result Report per HV Policy §10.
- **Optional, if OD-H3-4-8 = C:** a restyle of the TARGET branch only.

## 17. Explicit non-goals

- Any change to prices, the ladder, the caps, Rule W, the free key, fallback order, `nextPrice`
  semantics, GUIDANCE_ONLY semantics, or the reducer action surface.
- Persistence/migration: `discoveryHintFacts`, `discoveryHintPurchases`, `grandfatheredSteps` data,
  schemaVersion.
- The double-purchase latch / `expectedPaidCount`.
- A batch-purchase UI; a near-miss redesign; exact near-miss.
- Moving the Dex-0 onboarding into the Selectable reducer path (§10 B).
- Dinner / DM-3R-2; PR #243; Lunch Rush; Shop / reward prices; #234.
- Merging anything to `main` as part of this audit.

## 18. Screenshots captured in this audit

`docs/reports/screenshots/discovery-hint-3-h3-4-fresh-audit/`:

- the current H3-3 UI on `main` `726b0ac`;
- local Chromium;
- `_scrolled` = the same state with the sheet body scrolled to the bottom.

| File prefix | State | Seed |
|---|---|---|
| `A-fresh-h0` | Fresh sheet (key chip only), 5 Pitz | Dex 11, 120 Pitz |
| `B-one-fact-sauce` | After buying with ソース | ↑ |
| `C-sauce-again-fallback` | ソース still selected, a cheese chip revealed (silent fallback, F-5) | ↑ |
| `D-all-bought-0pitz` | 4 facts bought, CTA 「ヒントを1つ解除 0 Pitz」 (F-1) | ↑ |
| `E-guidance-after-request` | Guidance line, CTA still 「0 Pitz」 and enabled (F-2) | ↑ |
| `F-legacy-h3-insufficient` | 「以前のヒント」 + disabled 「ヒント 40 Pitz」 | `{capricciosa: 3}`, 25 Pitz |
| `G-legacy-h4-0pitz` | Legacy H4: 「0 Pitz」, legacy line below the fold (F-4) | `{capricciosa: 4}` |
| `H-legacy-h4-guidance` | The longest content | ↑ + one request |
| `I-legacy-h2-plus-new` | Legacy H2 + a new fact: price 40 | `{capricciosa: 2}` + `["ing:ham"]` |
| `J-dex0-onboarding-h1` | Dex-0 TARGET sheet | Dex 0, 0 Pitz |
| `K-dex0-onboarding-end` | Onboarding fully revealed | ↑ |

Viewports:

- all states at 390×844;
- A and D at 360×800;
- A, G and H at 390×664 and 360×640.

## 19. Residual risks

- **WebKit / real iPhone not run** in this audit. Chromium geometry matches the CI WebKit contract
  for this sheet in H3-3, but font metrics can move the fold on iOS. HV-14/15 cover it.
- **Short-viewport severity depends on the real Safari chrome.** 390×664 / 360×640 are the Layout
  Contract proxies.
- **§4-2 zero-price legacy facts** are by design, and only reach saves that bought Economy 1.0
  levels before H3-3. Their share of real players is unknown (→ `H3-ECON-1`).
- **This audit's recommendations are UI-only by construction.** If the Owner prefers Z-C-like
  behavior (pre-announcing exhaustion), that would be an authority/privacy change and needs its own
  Fresh Design.

## 20. Verdict

**B. OWNER DECISIONS REQUIRED.**

- No blocker:
  - the runtime is authority-correct;
  - no privacy leak was found;
  - double-charge protection is intact;
  - the 「0 Pitz」 legacy free facts are by design.
- H3-4 implementation should start once OD-H3-4-1 … OD-H3-4-10 are answered, most importantly:
  - -1 (price-0 wording);
  - -4 (the legacy block);
  - -5 (category wording and fallback feedback);
  - -7 (short viewport);
  - -8 (onboarding).
- Human Verification (§11) should then run on the H3-4 build.
