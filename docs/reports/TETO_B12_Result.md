# B12 Result — ジャマイカンジャークチキンピザ（Issue #706、暫定仕様・原典未確認）

Status: 実装・自動テスト・Visual HV（動画は Owner へ直接提出）まで完了。**共有 Preview 更新・main への merge は Owner 承認待ち。**
基準 `origin/main` = `c972756`（#705）。branch `claude/teto-pizza-recipe-expansion-tugxm5`。

## 1. 選定の経緯（2 品 → 1 品）

当初候補（柚子えび #662、ナスとタヒニ #673）は実装済みのため対象外。月見は DH4 gate 抵触で保留中（OD-B9-8/12）のため対象外。

172 マトリクスと現行 80 レシピを突合し、未実装 106 行から「新食材 0・新調理法 0」を抽出した結果、残るのは次の 2 品のみ（他は新食材か新工程が必要）。

| 候補 | 構成 | 解禁 step | 判定 |
|---|---|---|---|
| カポナータピザ | black-olive / capers / eggplant / mozzarella | capers = **23** | **保留（Owner 判断）** |
| ジャマイカンジャークチキンピザ | chicken / green-pepper / mozzarella / pineapple | green-pepper = **32** | **採用** |

**カポナータを外した理由.** step 23 は初期 25 ステップの中にあり、非クレジットのカポナータが加わると step 25（チキン購入後）の発見候補が 2 つになる。「ペスト・ポッロが唯一の候補で自動ターゲット」という初期案内が崩れ、これを固定したテストが約 50 件（Dex 23/24、Case A/B、hvSeeds、Hint walk、Research 各種）失敗した。仕様変更に当たるため無理に実装せず、Owner の選択（「ジャークのみで進める」）に従い保留した。再開する場合は初期オンボーディングの変更を Owner が承認する必要がある。

## 2. ジャマイカンジャークチキンピザ

- id `jamaican-jerk-chicken-pizza`、evidence `jamaican-jerk-chicken-pizza-pizzadb-p3`（比較表 p3、ブラジルではなくジャマイカ系、薄めの生地）。
- 食材（個数は GAMEPLAY CALIBRATION、計 8 ピース）: mozzarella 2 / chicken 3 / green-pepper 1 / pineapple 2。ソース無し（NO_SAUCE）。bake 58–78、baseRewardPitz 100。
- 属性: `ladderCredit:false`、`lunchRush:false`、CUT なし、key-free Hint、ladder step 追加なし、新食材なし。
- 採用理由: 新食材 0・既存の NO_SAUCE 機構のみで実装でき、step 32 は初期 25 ステップの外。既存レシピとの識別: 完全一致・部分集合・上位集合は 0、最近傍の Jaccard は 0.4 未満（テストで固定）。
- 未確認事項（暫定）: ①ソース欄が「その他」（`BASE_SAUCE_UNSPECIFIED`）→ NO_SAUCE は仮定 ②「ジャーク」の調味は構成に無く、モデル化していない ③原典 pizzadb.jp は未確認（到達不可）。

## 3. 影響（Owner が認識しておくべき点）

| 項目 | 内容 |
|---|---|
| Research コホート | green-pepper のコホートが {jerk, veggie-supreme-pizza} になり、**`veggie-supreme-pizza` が文字なし→B**、jerk が A（`COHORT_LETTER_SHIFT`）。Batch 8a の frango と同型。Recipe Batch Validator に `acceptedLetterShifts: { "veggie-supreme-pizza": "-->B" }` を明示 |
| 発見 pool | step 32 は veggie-supreme と jerk が同時に発見可能（multi-recipe step に 32 が加わる）。jerk は非クレジットで ladder を進めない |
| 図鑑 | レシピ 80→81（Pinsa ON は 81、OFF は 80 の表記は ledger 参照）。第 4 章 44→45（Pinsa ON は 45）。**第 4 章を全達成済みの保存は未達成に戻る**（データは消えない、表示は導出） |
| ladder / 経済 / ショップ | 変更なし（新食材なし、step 不変、LATE_ENTITLEMENT_FLOORS 不変） |
| 保存互換 | schema v2 のまま。旧版が jerk を知らなくても未知 ID として保持される（`persistence.batch12.test.ts`） |
| golden | `hint5.ladders55.json` は**末尾追記のみ**（削除 0 行）、`hint5.alphaFamilyOnly.json` は 1 行追加 |
| 副産物の修正 | `discoveryHint.walk.test.ts` の固定 guard 80 を `TOTAL` 連動に（81 件目で歩行が 1 件足りなくなる根本原因。B11 の researchAttemptSim と同種） |

## 4. 変更ファイル（要点）

- データ: `recipes.ts` / `recipeSauceProfiles.ts`（`null`）/ `referencePizza.ts` / `discoveryCatalog.ts` / `recipeHintRoles.ts` / `orders.ts`
- テスト: 新規 `expansionBatch12.test.ts`（6）/ `persistence.batch12.test.ts`（3）/ `e2e/b12.spec.ts`。追従: 件数 pin・ledger・manifest（`B12_BATCH`）・validator・Dex/Inspector・Hint 5.0 golden・DH 系
- docs: 本書、スクリーンショット `docs/reports/screenshots/b12/`

## 5. 検証

| 項目 | 結果 |
|---|---|
| Vitest（全件、Pinsa ON） | 558 files / 10656 tests passed |
| Vitest（Pinsa OFF、`npm run test:pinsa-off`） | PR 本文に記載（実行結果を参照） |
| typecheck / build | green（`tsc -b`、`vite build`） |
| lint（oxlint） | error なし（既存 warning のみ、本変更は warning を増やしていない） |
| Playwright Chromium E2E | 390×844 / 360×800 とも 1/1 passed（ショップ NEW → 購入 → Research（匿名ラベル `？？？ピザ A（ピーマン）`、漏洩なし）→ ソース無し → チーズ → 具材 → NEW DISCOVERY → 図鑑、横スクロールなし、console error なし） |
| WebKit E2E / 実機 | **未実施**（Owner 判断） |
| Visual HV | 動画（390×844、mp4）は Owner へ直接提出済み。リポジトリには含めない。スクリーンショットは `docs/reports/screenshots/b12/`（新規レシピのため before はなし） |
| Codex レビュー | PR 作成後に実施（結果は PR を参照） |

HV 目視で気づいた点: ピーマン（green-pepper）のトレイ絵文字が赤い唐辛子（🌶️）に見える。既存食材の描画で本 PR では変更していない（識別性の改善は別課題）。

## 6. 残る Owner 判断事項

1. **NO_SAUCE 仮定**: 原典のソース欄「その他」を「ソース無し」としてよいか（NEXT-BATCH-2 Fresh Audit Q1 と同じ判断）。
2. **コホート文字の変化**: `veggie-supreme-pizza` が無印→B になることの許容（frango 前例と同型）。
3. **第 4 章の完了状態**: 全達成済みの保存が未達成に戻ることの許容。
4. **原典確認**: pizzadb.jp での食材・工程・ソースの確認（セッションからは到達不可）。
5. **カポナータの扱い**: 初期オンボーディング変更（step 23 の pool 変更）を承認して再開するか、別候補にするか。
6. **共有 Preview 更新・main への merge**: Owner 承認待ち（本セッションでは実施しない）。
7. 数値・説明文・注文文言は暫定。実機 Human Feel で確認。
