# 状態同期 — 本番スイッチ・#561・#621・月見の保留・古い記述との関係（docs-only）

Status: **記録のみ。** `src/**`・`e2e/**`・CSS・テスト・データ・workflow・本番スイッチは変更していない。merge・共有 Preview・Production・Firebase の操作は行っていない。
基準 `main` = **`f661767d634ac53d71a1a1b0f1aa8954b76eaddf`**（#669、2026-10-26 11:13 JST）。**その後 main は `72044530d9c1f1b7f953d763f2e2d470c641a1ef`（#666）に進んだ。更新は §8。**同 SHA の Deploy to GitHub Pages（run #456）は success。記録日 2026-10-26。
本書は**新規ファイル 1 件のみ**。`docs/PROJECT_HANDOFF.md`、#650 の 4 ファイル、`TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md` ほか既存の文書は変更しない（§5 は、それらの古い記述との**関係を本書側に書く**）。

**書き方の規則.** 「確定」は Owner が伝達した判断、またはコード・GitHub の事実だけ。Owner の判断を代行しない。実機の結果は Owner の言葉でのみ記録し、セッションは PASS を代行しない。
**方法の限界.** 数値は `f661767` の `git archive` を隔離ディレクトリに展開してローカルで `vitest` を実行した結果（CI の再実行ではない）。リポジトリのクローンは shallow のため、`git log` では経緯を追えない箇所があり、GitHub のコミット検索で補った。

## 1. 本番スイッチの現況（コードが正）

| スイッチ | 値 | 場所 | 経緯 |
|---|---|---|---|
| `LATE_CATALOG_PRODUCTION` | **true** | `src/data/lateCatalog.ts:33` | E5（#654、2026-10-24 merge） |
| `FREE_COOK_FINISH_PRODUCTION` | **true** | `src/data/freeCookFinishGate.ts:13` | E5（#654） |
| `PINSA_PRODUCTION` | **true** | `src/data/pinsaGate.ts:14` | #659（2026-10-25 merge、Owner の公開承認） |
| `HAND_ENFORCEMENT_PRODUCTION` | **false** | `src/logic/catalog/handPolicy.ts:26` | LC-R6-e（#376、10/4）で true → All-Owned Cooking Tray（食材庫廃止、10/6）で false。10/7 に追従漏れのテスト 2 件を修正（`b0e3aa8`）。`handPolicy.production.test.ts` が false を固定 |

- 本番のレシピは **68**（通常 64 + late 4: ikura-salmon-pizza、yuzu-shrimp-pizza、eggplant-dengaku-pizza、pinsa-romana）、食材 **73**（ソース 7 / チーズ 11 / トッピング 55）、ラダー **59 step**（凍結 24 + 追記 32 + late 3）。ladderCredit なしのレシピは 6 件（brazilian-calabresa、aussie、chilean-napolitana、spanish-chorizo-pizza、grandma-pizza、pinsa-romana）。
- HAND の容量定数 12（OD-5）は残るが休眠。**ランタイム変更は行わない**（Owner 方針）。
- FINISH 経由のロールバックは、該当リテラルを `false` に戻す方式（OFF 経路は `lateCatalog.*.test.ts` が継続検証）。Pinsa は `TETO_PINSA_OFF=1` のプロジェクトが閉じた状態を検証する。

## 2. #561: 現行 main で PASS（Issue は Owner の指示までクローズしない）

**構成.** RECIPES 68、ladder 59 step、credited 62、slack = 62 − 59 − 2（星ゲート直接の 2 件）= **1**（`ACCEPTED_MIN_SLACK` = 1）。星ゲートは step 50（goat-cheese、累計 ★120）と step 51（spinach、★130）。

| 条件（全レシピ best 固定ほか） | 到達 | 到達不能 | 閉じた step |
|---|---|---|---|
| ★1（累計 66★） | 60/62 | california-style-pizza、spinach-artichoke-pizza（星ゲート直接。#420 の意図） | なし |
| ★2（136★） | 62/62 | なし | なし |
| ★3（204★） | 62/62 | なし | なし |
| 累計 119★ 以下 | 60/62 | 上記 2 件 | なし |
| 累計 120〜129★ | 61/62 | spinach-artichoke-pizza のみ | なし |
| 累計 130★ 以上 | 62/62 | なし | なし |

- 元の症状（4 レシピ到達不能・step 52/53 閉塞）は、#569（frango-catupiry を credited に）以降、再現しない。波及（collateral）は 0 件。
- 実行: `ladderReachability.starGate` と entitlement 系の 4 ファイル・61 件が通った。
- 追加の確認: credited の新レシピ + 専用 step を足した合成ケース（★1 で 61/63、★2 で 63/63、slack 1）、ladderCredit:false のレシピを足した合成ケース（★1・★2 の結果は不変）。

**残る P2 リスク（#561 は閉じる前提でも残る）.**

1. **slack が 1 しかない。** 新しい星ゲート、または専用 step を持たない credited レシピは検出テストで失敗する（意図どおり）。ゲート値の変更は Owner 判断。
2. **★1 中心の収入不足**（#561 本文の関連課題 P2）は今回**再測定していない**。本文の数値（60 レシピ時点）は古い。
3. ★1 一律では 2 レシピが閉じたまま。これは #420 の仕様であり不具合ではないが、プレイヤーには星の別通貨による待ちとして見える。
4. Pinsa ゲートを閉じる（ロールバック）と credited 数と ★ の境界が動く。検出テストの基準コメントは両状態を前提にしている。

## 3. #621: 「本番 ON の事実」と「未完了の HV 条件」を分けて扱う

#621 は open のまま、最後のコメントは 2026-10-23。E5 の結果は #621 には未記録（E5 の Owner 決定記録は #650 の中にあり、#650 は未 merge）。

**A. 本番 ON の事実（コード・GitHub で確認できるもの）**

| 事実 | 根拠 |
|---|---|
| 後乗せカタログ・FINISH が本番で ON | §1。#654 は Owner が merge（2026-10-24 12:54Z）、CI green、Codex 指摘なし |
| late catalog に 4 レシピが出荷済み | ikura（#627 → E5）、yuzu-shrimp（#662）、eggplant-dengaku（#669）、pinsa-romana（#659） |
| #584 は未 merge のまま 10/23 にクローズ | 後継は #627（merge 済み）+ E5 |
| Issue 本文の範囲（「本番 OFF」「ikura のみ」「BBQ 除外」）は現況と合わない | 上記のとおり。本文は起票時点（10/22）の記録 |

**B. 未完了の HV 条件（PASS を代行しない）**

| 項目 | 状態 |
|---|---|
| AC-8（salmon-roe の 3 状態再測定 + 動画） | V1 の再測定は 7/7 通過と記録されている（#650 内）。**Owner の動画判定は #621 に未記録**。「証跡が確認できるまで PASS にしない」の約束が残る |
| O-12（焼き色「ちょうど」での視認性） | iPhone 実機での判定が**未了** |
| R8（中断復帰）の実機 | **未達**。Owner の iPhone で中断通知が出ず、原因は未確定（#654 本文）。Owner は以降の R8 実機確認を優先しない方針 |
| O-11（Free/Research の中断通知に「未完成」行がない） | 暫定許容。文言の追補は未決 |
| Q-5（後乗せリング上限の正式値） | 未決。R-A は Reference・採点側の基準（O-13）。「Pinsa P3 の前」だった実測の記録は見つかっていない |
| 実機 HV（LAN 方式） | Owner の PC 待ち |
| #666（保持された pendingRound の退避・破棄） | **merge 済み**（main `72044530`、2026-10-26 07:40:50Z、Owner が squash merge）。**Owner 例外承認（この HEAD `8fa7898` に限る）: 実機 HV と動画提出は waived（実機 PASS ではない）、Codex は running のまま独立レビューを代替採用（Codex PASS ではない）。** 詳細は §8 |

## 4. 月見ピザ（tsukimi-pizza）の DH4 保留

- **Owner 決定.** OD-B9-8 / OD-B9-12: OD-DH4-2-9（「その他」は到達不能）を維持して**実装保留を継続**する。gate の緩和と、egg の family 変更は禁止。恒久見送りではない。
- **再現（f661767）.** 隔離コピーに月見（bacon 3 / egg 1 / mozzarella 2 / green-onion 2、NO_SAUCE、ladderCredit:false）を足して `deductionProduction.gate.test.ts` を実行。月見なしは 14/14、月見ありは **13/14**。失敗は「`その他` は到達不能」で、`attr:group:other` が返る。該当する状態は**1 つだけ**（月見が対象で、全 73 材料を所持）。ladderCredit の有無は無関係（false で再現）。機序の特定は未実施。`other` 家族は egg / almond / pine-nuts のまま。
- **副作用（実装を再開する場合の事前情報）.** 月見が加わると、青ねぎで解禁される sichuan-eggplant-pizza に Research のコホート文字 A が付く（月見は B）。現行は文字なし。契約上は許容されているが、#544 の再監査項目。
- **重複.** id・材料集合とも既存レシピと一致しない。最も近いのは aussie（onion と green-onion の差）。過去の設計は `docs/reports/TETO_RECIPE-EXPANSION_YUZU-TSUKIMI_Pre-Implementation-Audit.md` と Batch-9 決定記録。
- **原典.** 比較表 p14 のみ。個別ページなし。卵・ねぎの投入時機は未確認（焼成後と判明した場合は late catalog 側の候補。OD-B9-16）。
- **解除の選択肢**（Owner 判断。現行方針の範囲外）: OD-DH4-2-9 の改訂 / `other` の再分類 / 構成変更。
- 補足: matrix 行 `bianca-pizzadb-row` は出荷済み `pizza-bianca-ricotta` と材料が完全一致する重複で、候補ではない。

## 5. 古い記述との関係

優先順位（本書は**現況の事実**だけを置き換える。Owner 決定の内容は変えない）: P3 L1 / Q7 確定 → E5 決定記録（#650 内）→ #633 の対応表 → 各文書の本文。

| 対象 | 状態 | 古い記述 | 本書との関係 |
|---|---|---|---|
| **#650**（open、docs-only、CI green、Codex 指摘 0） | 新規 4 ファイル（E5 決定記録、V1 測定 Result、実機 HV Runbook、LAN 安全監査）。既存パスと衝突しない。base は `dde0660` で main より古い | 各ファイル冒頭の「本番スイッチは OFF のまま」「E5 は HOLD」「E5 実装 PR なし」「late step は 56」。実際は E5 が 2026-10-24 に merge 済みで、スイッチは true | #650 の本文は**当時の記録**として扱い、現況は本書（§1・§3）を正とする。#650 の変更・merge の判断は PR 作者と Owner |
| **#651**（open、docs-only） | `PROJECT_HANDOFF.md`（チェックリスト項目 3 に 1 行）、Batch-9 決定記録、SESSION-OPERATIONS、CLAUDE.md を変更 | 現況に関する古い記述は追加していない | 本書は同じファイルを触らないため競合しない |
| **#72**（open、9/18） | `PROJECT_HANDOFF.md` の PR #68 状態の訂正のみ。base が古く、他の docs PR と HANDOFF で衝突する | 9/18 時点の状態 | 陳腐化している。クローズ可否は Owner |
| `docs/PROJECT_HANDOFF.md` | main | 冒頭 `Updated: 2026-09-18`。2026-10-03 addendum（約 1141 行目）の「HAND 12 is live in Production (`HAND_ENFORCEMENT_PRODUCTION = true`)」 | HAND は **false が正**（§1）。2026-10-06 addendum（約 90 行目）が正しい。**本書では HANDOFF を変更しない** |
| `TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（#633、main） | main | 対応表と本文末尾の「本番スイッチ OFF のまま」「E5 は HOLD」 | §1 を正とする |
| `TETO_NEW-SAUCES-B_U0-GATE_2026-10-25.md` | main | 「late step は 57」「3 レシピ全て未実装」 | U1・U2 が出荷済み。late は roe 57 / yuzu 58 / miso+sesame 59（`LATE_LADDER_STEPS`・`LATE_ENTITLEMENT_FLOORS`） |
| `TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md` | main | 月見・柚子えびの保留 | 柚子えびは U1 で出荷済み（late catalog 方式）。月見の保留は有効（§4）。**この文書は変更しない**（#651 も触れている） |
| `vitest.config.ts` 冒頭コメント | main（コード側のファイル） | 「`HAND_ENFORCEMENT_PRODUCTION` is `true` since LC-R6-e」 | 実値は false。コメントのみの古さ。本書では変更せず、別途の扱いを Owner が決める |
| `freeCookFinishGate.ts` / `lateCatalog.ts` のコメント | main（コード側） | 「Production is fixed OFF」「Stays `false` until…」 | 実値は true。同上 |
| `TETO_ALL-OWNED-COOKING-TRAY_Result.md` §1 の表 | main | 「`HAND_ENFORCEMENT_PRODUCTION = true` since LC-R6-e」（変更前の状態の説明） | 履歴として正しい。同ファイルの §2 が変更後の false |

## 6. 未決・Owner 判断が必要なこと

1. #650 の扱い（現状のまま merge / 冒頭に現況注記を追加 / 置き換え）。
2. #72 のクローズ可否。
3. #561 のクローズ時期（Owner 指示まで保留）。
4. #621 に E5 の結果と §3 の区別を記録するか（GitHub への書き込みは別承認）。
5. 古いコード内コメント（`vitest.config.ts`、`freeCookFinishGate.ts`、`lateCatalog.ts`）を直すか。
6. 月見の解除方針（§4）。現状は保留継続。
7. AC-8、O-12、R8 実機、Q-5 の正式値の扱い。

## 7. 触れていないもの

`PROJECT_HANDOFF.md`、#650 の 4 ファイル、Batch-9 決定記録、`src/**`、`e2e/**`、CSS、テスト、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、#666 とその HV、Issue/PR へのコメント投稿・クローズ。CI の再実行、Codex の再依頼、Monitor の作成はしていない。

## 8. 更新: #666 の merge と main の WebKit E2E（`72044530`、2026-10-26）

- **merge.** #666 は Owner が squash merge（`72044530`、07:40:50Z）。直前（07:40:36Z）に Owner アカウントで例外承認のコメントが記録されている。例外は **HEAD `8fa7898b` に限る**。実機 HV は waived で「実機 PASS」とは記録しない。Codex は running のまま未完了で「Codex PASS」とは記録しない。受容された残存リスク: 実 iOS Safari 固有の UX、`localStorage` の挙動、実際の複数タブ競合、アクセシビリティ。
- **Production Deploy.** `72044530` の Deploy to GitHub Pages（run #457）は **success**。
- **main の WebKit E2E（run #1212）は failure.** `webkit-390x844` の shard 2/3 と 3/3 が各 1 件失敗し、WebKit Gate が failure。360×800 の 3 シャード、layout-chromium、Layout Contract Gate は success。
  - shard 2: `lunch-rush-r8-restore.spec.ts:147`（G-6）— `page.evaluate`（localStorage の読み取り）がテストの 30 秒を超過。
  - shard 3: `sauce-edge-475.spec.ts:124` — `canvas.pizza-sauce-heatmap` の待機中に「Target page, context or browser has been closed」（テストの時間切れ）。
  - 直前の main（`f661767`、run #1211）は全シャード success。`72044530` の tree は、隔離コピーで検証した「#666 + `f661767`」の merge tree と同一。同 tree の Chromium（390×844 / 360×800）では、新規 E2E 12/12、関連回帰 32/32、上記 2 本を含む再実行も通過（`sauce-edge-475:124` は 21.5 秒で、30 秒の上限に近い）。WebKit はこの環境で実行できず未確認。
  - 評価: 失敗は 2 件とも時間切れで、#666 が触れない領域（ソースのヒートマップ、Lunch Rush の保存読み取り）。WebKit の間欠失敗（#394 ほか）と同じ型だが、**フレークと断定はしていない**。再実行・revert は Owner 判断。
