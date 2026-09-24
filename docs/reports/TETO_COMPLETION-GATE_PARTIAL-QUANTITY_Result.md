# Completion Gate partial-quantity — Result Report（Issue #215）

- Base: main `dff233c042d2df6ee1c3a92f2d2419830aa05460`
- 仕様: Issue #215 の Owner Decision（2026-09-24）。OD-1 = G1、OD-2 = Q 0.5、OD-3 = 0.15、OD-4 = LR-A、OD-4b = 0.15、OD-5 = D-A。
- 設計の根拠: PR #218（Fresh Audit、HEAD `5105771d37577ad353e869ea35295a4ea18bbce9`）。この PR は #218 に依存しない。main から独立して実装した。
- 3-4C の実装は main にない。今回触れた seam（`completionGate.ts`、`scoringV2/**`、Free Cooking の discovery、reducer の CONFIRM_BAKE）は 3-4C と分離できることを main で確認した。`recipes.ts` の `minCount` は変えていない。

## 1. 変更の内容

| 対象 | 変更 |
|---|---|
| `src/logic/completionGate.ts` | `CompletionPolicy`（`"recipe"` / `"order"`）と `completionMinimum()` を追加。`"recipe"` は必須の具材が 1 個以上あれば PASS（G1）。`"order"` は今までどおり `minCount` が必要（LR-A）。0 個はどちらでも `MISSING_REQUIRED_INGREDIENT`。既定は `"recipe"` |
| `src/state/gameReducer.ts` | CONFIRM_BAKE は `isMissionRound` なら `"order"`、それ以外は `"recipe"` を渡す |
| `src/logic/discovery/freeCook.ts`、`src/state/discoveryRegistration.ts` | `"recipe"` を明示する（OD-5 = D-A。種類がそろえば、少ない量でも発見） |
| `src/logic/scoringV2/quantityComponent.ts`（新規）、`index.ts`、`types.ts` | 量の係数 Q を total に掛ける。`components.quantity` を追加。ruleset を `phase-4a-2-shadow-3` → `phase-4a-2-shadow-4-quantity` に bump |
| `src/data/completionMessages.ts` | `INSUFFICIENT_REQUIRED_AMOUNT` の文言を「注文の○○の数が足りません」に変更（Lunch Rush でしか出なくなったため） |
| `src/data/quantityMessages.ts`（新規）、`ResultPanel.tsx`、`MissionServePanel.tsx`、`GameScreen.tsx`、`App.css` | Result の 1 行「○○がお手本より少なめ（2個／お手本3個）」または「多め」。Lunch Rush の serve panel にも出す（過剰の減点の理由） |
| `ResultPanel.tsx` | Free Cooking の near miss の文言を「材料の数や焼き加減」→「ソースや焼き加減」に変更（数では落ちなくなったため） |
| `ScoringV2DebugPanel.tsx` | Preview 専用の debug panel に Q の chip を追加。production では表示されない |

**変えていないもの:** `recipes.ts` の `minCount`（理想量のまま。DS-A）、`hints.ts`、`playerReference.ts`、`starterStock.ts`、`efficiency.ts`、`economySimulation.ts`、`pitzReward.ts`、`shared/lunchRushScoring.ts`（`lunch-rush-v1` のまま）、Cloud Functions、save schema、在庫の消費（M4: 置いた数だけ消費）、#213 の `requiredStockUnits` の seam（LR-A なので値は変わらない）。

## 2. 式（production を正とする）

```
target = Reference Pizza のその group の positions.length（= scatter 具材の minCount）
placed = pizza 上のその具材の個数

shortageRatio = max over groups of (target − placed) / target      （placed < target の group）
excessRatio   = max over groups of min(1, (placed − target) / target)（placed > target の group）
factor        = max(0, 1 − 0.5 × shortageRatio − 0.15 × excessRatio)

weightedUnit  = safeUnit((sauce×52 + pieces×16 + recipe×12 + bake×20) / 100 / 100)
totalScore    = safeUnit(weightedUnit × factor) × 100
```

- **丸めの順（production Scoring 2.0 を確認済み）:** `totalScore` は丸めない。★（`starsFromTotal`、90/75/60/40）、Pitz の帯（`qualityMultiplierForScore`）、Lunch Rush の quality はすべて丸めていない値を読む。`Math.round` は、表示（`ResultPanel`、`MissionServePanel`）と `missionScore`（run の最後の合計）、Pitz の金額でだけ行う。Q はこの丸めの前に掛けるので、丸めの順は変わらない。
- #218 の audit harness は `legacy.total × qFactor`（丸めていない値）で計算していた。production とは浮動小数の掛ける順番が違うだけで、値は一致する（§3。funghi の 6 点がすべて小数第 1 位まで一致）。
- 理想量の pizza は `factor === 1` なので、total は前の式と bit 単位で同じ（既存の test で確認済み）。
- ★ の上限（`capStarsForBake`）はそのまま。Q は total 自体を下げるので、★ と Pitz の帯がずれない。

## 3. 理想 3 の結果（funghi / mushroom、他はお手本どおり、bake は範囲の中央）

production のコード（`src/state/gameReducer.partialQuantity.test.ts` で固定）:

| mushroom | Completion | factor | total | ★ | Pitz（base 100） |
|---|---|---|---|---|---|
| 0 | **FAILED** `MISSING_REQUIRED_INGREDIENT` | — | — | — | 0 |
| 1 | PASS | 0.6667 | 65.56 | ★3 | 80 |
| 2 | PASS | 0.8333 | 82.45 | ★4 | 100 |
| 3 | PASS | 1 | 99.54 | ★5 | 120 |
| 4 | PASS | 0.95 | 92.66 | ★5 | 120 |
| 5 | PASS | 0.90 | 85.99 | ★4 | 100 |
| 6 | PASS | 0.85 | 79.51 | ★4 | 100 |

Audit の `idealThreeReplayRows`（99.5 / 82.5 / 65.6 / FAILED / 92.7 / 86.0）と一致する。margherita の mozzarella（理想 3）でも同じ値になる。

実機の UI（Human Verification。margherita、mozzarella をお手本の位置にタップ）: 3 個 100 点 ★5 / 2 個 82 点 ★4 / 1 個 66 点 ★3 / 0 個 FAILED「モッツァレラが入っていません」/ 4 個 93 点 ★5（「多め（4個／お手本3個）」）。

## 4. Free Cooking（OD-5 = D-A）

- margherita の種類（トマトソース、モッツァレラ、バジル）をそろえれば、mozzarella 1/3 と basil 1/2 でも **NEW DISCOVERY**。BEST は Q を掛けた値で記録される（実機: 66 点 ★3、「NEW PIZZA! マルゲリータを発見しました！」）。
- recipe mode で別の recipe を発見する経路（`discoveryRegistration.ts`）も同じ（bismarck に bacon 1 個 → breakfast-pizza を発見。理想は 3 個）。
- `INCOMPLETE_MATCH` は、matched recipe の sauce の量や焼き加減で落ちたときだけ残る（test: sauce をほとんど塗らない margherita → near miss）。
- 変更前: 同じ pizza は「オリジナルピザ完成！ 図鑑のピザまであと少し…！材料の数や焼き加減を変えてみよう。」だった（before screenshot 06）。

## 5. Lunch Rush（OD-4 = LR-A、OD-4b = 0.15）

| 注文 mozzarella 3 | 変更前 | 変更後 |
|---|---|---|
| 2 個（不足） | 注文失敗「モッツァレラが足りませんでした」 | 注文失敗「**注文の**モッツァレラの数が足りません」（0 点。run は進む） |
| 3 個（ちょうど） | +1 SERVED、100 点 | +1 SERVED、100 点（変わらない） |
| 4 個（過剰） | +1 SERVED、98 点 | +1 SERVED、**93 点**（× 0.95）、「モッツァレラがお手本より多め（4個／お手本3個）」 |

- ranking の `LUNCH_RUSH_RULESET_VERSION` は `lunch-rush-v1` のまま。Cloud Function は変えていない（quality は client が送る値で、範囲は 0〜100 のまま）。
- 0 個は今までどおり `MISSING_REQUIRED_INGREDIENT`。

## 6. テスト

| 種類 | 結果 |
|---|---|
| focused（`quantityComponent.test.ts`、`gameReducer.partialQuantity.test.ts`、`quantityMessages.test.ts`、`MissionServePanel.test.tsx`、`ResultPanel.test.tsx` の追加分、`completionGate.test.ts`） | PASS |
| 全 Vitest | 129 files / 2498 tests PASS |
| typecheck + build（`npm run build` = `tsc -b && vite build`） | PASS（chunk size の警告は前からある） |
| lint（`oxlint`） | 0 warnings / 0 errors |
| Chromium E2E（全 spec、`iphone-390x844` + `iphone-360x800`） | 120 / 120 PASS（新しい spec `e2e/completion-gate-partial-quantity.spec.ts` の 6 件を含む） |
| WebKit E2E（CI、Final Gate） | PASS: `webkit-390x844` shard 1/2・2/2、`webkit-360x800` shard 1/2・2/2、`WebKit Gate` がすべて success（HEAD `9abe481`、Actions run 36020835471）。この sandbox には WebKit の browser がない（`/opt/pw-browsers` は Chromium のみ）ので、CI を正とする |

期待値を変えた既存の test（意図した挙動の変更）:

- `completionGate.test.ts` #3: 2/3 は `"recipe"` で PASS。#3b として `"order"` の FAILED を追加
- `gameReducer.completionGateEfficiency.test.ts` #2: FREE の 2/3 は PASS し、Efficiency の credit がつく
- `gameReducer.freeCook.test.ts`: 「basil が足りない → near miss」を「量が少なくても NEW」と「sauce が薄い → near miss」の 2 件に分けた
- `gameReducer.discovery.test.ts`: bacon 1 個の breakfast-pizza は発見として記録される
- `gameReducer.scoringV2Authority.test.ts`: 空の pizza の total が 20 → 10（すべての group が 0 個なので factor 0.5。この pizza はもともと Completion Gate で FAILED）
- `completionMessages.test.ts`: `INSUFFICIENT_REQUIRED_AMOUNT` の文言

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `issue215-hv-after-390x844.mp4` | 390×844 | 1:42.9 | 1.98 MB | H.264 High, yuv420p, 25 fps | PASS |
| `issue215-hv-after-360x800.mp4` | 360×800 | 1:42.8 | 1.89 MB | H.264 High, yuv420p, 25 fps | PASS |

Download: セッション内でユーザーに直接提出する（repository には commit しない）

Video Verification: PASS（ffprobe で codec/解像度/長さを確認。最後まで decode できることを確認。frame を目で確認）

この動画で確認すること（順番どおり）:

1. margherita の recipe mode で、mozzarella 3 → 2 → 1 → 0 → 4 の 5 回
   - 3: ★5
   - 2: ★4 と「少なめ（2個／お手本3個）」
   - 1: ★3 と「少なめ（1個／お手本3個）」
   - 0: FAILED「モッツァレラが入っていません」
   - 4: ★5、93 点と「多め（4個／お手本3個）」
2. Free Cooking で mozzarella 1 個の margherita → NEW PIZZA の発見、★3
3. Lunch Rush で 3 つの注文
   - 2 個: 注文失敗「注文のモッツァレラの数が足りません」
   - 3 個: +1 SERVED、100 点
   - 4 個: +1 SERVED、93 点と「多め」

## Screenshots

`docs/reports/screenshots/completion-gate-partial-quantity/`。before（main `dff233c`）と after、各 viewport（390×844 / 360×800）で 9 シナリオ（36 枚）:

`01-recipe-3of3`, `02-recipe-2of3`, `03-recipe-1of3`, `04-recipe-0of3-failed`, `05-recipe-4of3-excess`, `06-free-cooking-1of3`, `07-lunch-rush-2of3-under-order`, `08-lunch-rush-3of3-exact`, `09-lunch-rush-4of3-excess`

## 7. 残っていること / 注意

- **Dex BEST:** 今までの BEST は再計算しない（grandfather）。過剰でつけた昔の BEST は、新しいルールより高いことがある（audit §5.4）。
- **Pieces の中の「数」（30%）:** Q と少し二重になる（−0.6〜−1.4 点）。audit の推奨どおり、今回はそのまま残した。
- **Human Feel:** Teto の見出しの 1 行（「完璧に焼けた！」など）は焼き加減から作られるので、★3 の少ない pizza でも褒める文になる。前からある挙動で、この PR の範囲外。

## 8. Known Limitation — Lunch Rush ranking の score が混在する（OD-LR-RANKING）

- **Owner Decision（2026-09-24、#215 に記録）:** OD-LR-RANKING = **KEEP_V1_WITH_KNOWN_MIXED_SCORING_LIMITATION**
- **指摘（valid）:** PR #222 の Codex P1（https://github.com/perusonao/teto-pizza-game/pull/222#discussion_r4095777968）。誤検知ではない。
- **内容:**
  - OD-4b により、Lunch Rush で過剰の pizza の quality は前の式より下がる（例: 98 → 93、× 0.95）。
  - それでも ranking の ruleset は `lunch-rush-v1` のまま。
  - `leaderboards/{periodId}/entries/{uid}` の periodId には ruleset が入っていないので、前の式の score と新しい式の score が同じ weekly/monthly/all-time の leaderboard に並ぶ。
  - 過剰の pizza を含んでいた前の entry には、小さな有利が残る。
- **影響の範囲:** 注文どおりの量だけの run（factor = 1）は、前の式と bit 単位で同じ score になり、完全に互換。差が出るのは過剰の pizza を含む run だけ。不足は LR-A で提供失敗（0 点）になるので、前と同じ。
- **維持するもの:** OD-4（LR-A）、OD-4b（0.15）、`lunch-rush-v1`、Cloud Function、leaderboard の schema。いずれもこの PR では変更しない。
- **将来:** ruleset ごとの leaderboard と migration は #224（Lunch Rush Ranking / Ruleset 2.0）で扱う。

