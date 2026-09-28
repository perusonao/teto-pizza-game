# Discovery Hint 4.0 — DH4-2C: U3-C Hint Sheet UI (Result)

> **Status:** Implementation, DH4-2C slice (OD-DH4-2-11 / audit §20). Part of #253. It builds on DH4-2B (#277, PR #278).
>
> **Scope:** the U3-C Hint Sheet (OD-DH4-2-6…10) and its near-full-screen layout. It covers `HintSheet.tsx`, `.hint-sheet*` CSS, the App / GameScreen plumbing, and the hint e2e contracts.
>
> **Not changed:**
> - the runtime, the economy and persistence;
> - the Deduction Hint authority;
> - the taxonomy;
> - Dinner Mission, CUT, Wave 2 and the catalog.
>
> **What is visible where:**
> - **Production:** the 構成 / 特徴 cards stay hidden, because `DEDUCTION_HINTS_ENABLED` is false and `deduction` is `null`. Production players see the new 材料 layout only.
> - **DEV / Preview:** all three cards are shown.

## 1. What the sheet is now

The sheet is 「少しずつ情報を得て自分で推理するUI」, not 「答えを買うUI」:
- The board shows only what this player already learned.
- A question card asks for one more fact.
- Nothing on screen says what is left, how precise the next answer will be, or how many candidates remain.

| Part | Content | Decision |
|---|---|---|
| Header (fixed) | 💡 ヒント · 閉じる (≥ 44 px) | — |
| Caption | The H0 existence line (`existenceText`) | — |
| **「わかっていること」 board (scrolls)** | **材料:** chips grouped by category; an empty category is omitted.<br>**構成:** the player's own `structureLines`.<br>**特徴:** the player's own `attributeLines`.<br>**以前のヒント:** the Economy 1.0 archive, verbatim.<br>After a GUIDANCE_ONLY outcome, the guidance line. | OD-DH4-2-6, OD-DH4-2-8 (no 「？」 rows), OD-DH4-2-10 |
| Scroll cue | 「▾ 下にもヒントがあるよ」 + fade, only while content is below | OD-DH4-2-7 |
| **Footer (fixed)** | The 「ヒントをもらう」 family radio group: 材料 / 構成 / 特徴. 構成 and 特徴 appear only when `deduction` is non-null. The group is followed by one question card. | OD-DH4-2-6 |
| 材料 card | 「材料の名前を1つ教えるよ」.<br>Preference chips: おまかせ (= the existing fallback, sauce first) / ソース / チーズ / トッピング.<br>Note: 「えらんだジャンルに無いときは、ほかのジャンルから教えるよ」. | OD-DH4-2-9 |
| 構成 card | 「材料の数を教えるよ」 | OD-DH4-2-9 |
| 特徴 card | 「まだわからない材料の「なかま」を教えるよ」 | OD-DH4-2-9 |
| CTA | 「たずねる ｜ n Pitz」.<br>At the cap: 「たずねる ｜ 支払いずみ」, still enabled (OD-H3-4-1 parity).<br>A deduction family already bought: 「✓ もらいずみ」, disabled. | OD-DH4-2-9 |
| Wallet line | 「Pitzはヒントが出たときだけ使うよ」 / 「今回はPitzを使っていないよ」 / the cap note / 所持 n Pitz / 「Pitzがたまったら、またためしてね。このまま作ってもOK！」 | OD-H3-4-2, P3-5 of #278 |

**No-charge outcomes.** Each is shown only on its own family's card (P3-2 of #278), with no charge:

| Family | Outcome | Line shown |
|---|---|---|
| 材料 | GUIDANCE_ONLY | 「材料ヒントはここまで（Pitzは使っていないよ）」 + 「構成・特徴のヒントもあるよ」 while a deduction family is unbought |
| 構成 | GUIDANCE_ONLY / ALREADY_OWNED | 「今は新しくわかることがなかったよ（Pitzは使っていないよ）」 |
| 特徴 | EXISTENCE_ONLY / ALREADY_OWNED | 「今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）」 |

**Anti-spoiler.** Every string above comes from the view, which is the player's own ledger, price, balance and last outcome, or is the same for every target. The DOM, `aria-*` and `data-*` carry:
- no recipe name / id / image;
- no availability;
- no level;
- no candidate count.

The `HintSheet.test.tsx` anti-spoiler sweep covers the new sheet.

## 2. Layout (OD-DH4-2-7 / OD-DH4-2-8, Layout C)

The OD-H3-4-7 `45dvh` cap is superseded:
- `.hint-sheet--u3` is near full height: `calc(100dvh - 16px - env(safe-area-inset-top))`.
- The header and footer are fixed, the board scrolls, and the footer is compact.
- `env(safe-area-inset-bottom)` padding is kept.
- The sheet is `position: fixed`, so the cooking stage underneath neither moves nor shrinks.

**e2e contract (`e2e/discovery-hint-sheet.spec.ts`, every profile):**
- the sheet top ≥ the safe-area top;
- every control ≥ 44 px (family radios, preference chips, CTA, 閉じる);
- no horizontal overflow;
- the board's visible height ≥ min(150 px, its content), which is CAP-2;
- the cue matches the real scroll state;
- the background is unmoved.

**Profiles:**
- Chromium runs all 7 profiles: N390, N360, S390, S360, P390i, E390i and E360i.
- WebKit runs N390, S390, N360 and S360 in CI.

## 3. Screenshots

**Before** (the H3-4 sheet): `docs/reports/screenshots/dh4-2-pre-audit/before-*.png`.

**After** (this PR): `docs/reports/screenshots/dh4-2c-u3-sheet/after-*.png`.

**Profile codes in the file names** (`e2e/support/layoutProfiles.ts`):

| Code | Viewport | Safe-area inset |
|---|---|---|
| N390 | 390×844 | none |
| N360 | 360×800 | none |
| S390 | 390×664 | none |
| S360 | 360×640 | none |
| P390i | 390×844 | top 47 / bottom 34 |
| E360i | 360×640 | top 47 / bottom 34 |

| State | Before | After |
|---|---|---|
| F — fresh (the free key only) | `before-F-fresh_E360i` | `after-F-fresh_{E360i,N390,N360}` |
| K — all 材料 facts + legacy archive | `before-K-all-facts_{E360i,N360,N390,P390i,S360,S390}` | `after-K-all-facts_{E360i,N360,N390,P390i,S360,S390}` |
| L — legacy guidance | `before-L-legacy-guidance_P390i` | `after-L-legacy-guidance_P390i` |
| M — 構成 card (Preview flag) | — (new) | `after-M-structure-card_N390` |
| M — 構成 + 特徴 answered (Preview flag) | — (new) | `after-M-deduction-answered_{N390,N360,S390,S360}` |

## 4. Verification

| Check | Result |
|---|---|
| Full Vitest | see PR |
| `tsc -b` | clean |
| `oxlint` | 0 warnings |
| `npm run build` | OK |
| Hint e2e (Chromium, all hint specs) + layout contract | pass |
| CI (build, layout-chromium, Layout Contract Gate, WebKit 390×844 / 360×800) | see PR |

## 5. Human Verification Videos

Filled in after the Preview deploy (see the PR).
