# 新ソース Phase B — U0 実装前 Gate 結果と Owner 判断欄（docs-only）

Status: **調査結果の記録のみ。** `src/**`・テスト・golden・`e2e/**`・データ・workflow は変更していない。merge・共有 Preview 更新・本番操作は行っていない。**U1 / U2 / U3 の claim・実装は開始していない。**
基準 `origin/main` = `d3da198`（2026-10-25）。追跡 Issue: #578（Phase B-1 = #649 は merge 済み。B-2 以降の claim は未投稿）。
**「推奨」「案」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。原典未確認事項は確定扱いしない。**

関連: `docs/reports/TETO_NEW-SAUCES-B_SOURCE-TIMING-EVIDENCE_TEMPLATE.md`（原典確認の記入欄）、`docs/decisions/TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（O-3 / 案 A）、`docs/decisions/TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md`（OD-B9-1 / B9-2 / B9-15）。

## 1. 要約

| 項目 | 結果 |
|---|---|
| 3 レシピの実装状況 | **全て未実装**（`src/` に該当 id なし） |
| 原典（pizzadb.jp） | **到達不可**（プロキシ CONNECT 403）。投入タイミング・下ごしらえ・個数は**全て未確認** |
| 本番 Late Catalog ON と通常 ladder 追記 | ikura の late step 番号が通常追加 1 件につき +1。デッドロックなし。ただし「E5 後に一度も起動していない既存セーブ」で roe の解禁が一時的に遅れる（§3） |
| DH4 事前評価 | `white-sesame` を `other` にすると `その他`到達不能テストが失敗（OD-DH4-2-9 違反）。`herb` / `vegetable` / `spice` と `pomegranate`（`fruit`）は privacy 系テストを通過。ただし旧式の件数 pin（`deductionGuard.gate`）は動く（§2） |
| U1 / U2 / U3 の着手可否 | **いずれも不可**（原典未確認と Owner 判断が先） |

## 2. DH4 事前リスク評価（隔離コピーでの実測）

方法: `origin/main` を scratchpad にコピーし（リポジトリ外・使い捨て）、仮データ（食材・レシピ・ladder step・taxonomy 行・size class のみ）を足して既存テストを**そのまま**実行。gate の緩和、テストの変更、family の都合のよい変更は一切していない。仮データは GAMEPLAY CALIBRATION でもなく、実装案でもない（測定専用）。
対象テスト: `deductionProduction.gate.test.ts`（14 件。privacy・独立攻撃者・`その他`到達不能）、`deductionGuard.gate.test.ts`（16 件）。

| 仮追加 | `deductionProduction.gate`（privacy） | `deductionGuard.gate` |
|---|---|---|
| なし（main） | 14/14 通過 | 16/16 通過（件数 pin = 123） |
| yuzu-kosho + yuzu-shrimp（新 topping なし） | 14/14 通過 | 16/16 通過（pin 123 のまま） |
| miso-sauce + white-sesame + dengaku、**white-sesame = `other`** | **13/14 失敗**: `その他`到達不能（OD-DH4-2-9）。`expected 'attr:group:other' not to match /:other$/` | 15/16（pin が 156 に移動） |
| 同、white-sesame = `herb` | 14/14 通過 | 15/16（pin = 156） |
| 同、white-sesame = `vegetable` | 14/14 通過 | （未実施） |
| 同、white-sesame = `spice` | 14/14 通過 | 15/16（pin = 165） |
| tahini + pomegranate（`fruit`）+ tahini レシピ | 14/14 通過 | 15/16（pin = 156） |
| 3 レシピ全て、sesame = `herb` | 30/30 通過（両ファイル合算） | 通過（pin = 123） |
| 同、sesame = `vegetable` | 30/30 通過 | 通過（pin = 123） |
| 同、sesame = `spice` | 29/30（pin = 132 のみ失敗） | pin = 132 |

読み方:
1. **`other` は不可（再現）。** egg / almond / pine-nuts と同じ family に白ごまを入れると、tsukimi と同じ `attr:group:other` が答えられる。**これは Owner Decision A（gate 緩和禁止）と OD-B9-12（`other` 再分類禁止）の対象**であり、`other` を選ぶ案は提示しない。
2. `herb` / `vegetable` / `spice` と `pomegranate`（`fruit`）は privacy 系 gate を通過した。**ただし family はこの測定結果で決めない。** どの family が語義として正しいかは Owner 判断（L1 の batch-scoped OD）。測定は「どれを選んでも gate が壊れない範囲」の確認にすぎない。
3. `deductionGuard.gate` の件数 pin（`dh42aLeaks`、123）は**旧 DH4-2A の件数で、privacy の合否ではない**（テスト内コメント: 硬化した guard は全構成で leak 0、動くのはこの件数のみ。合成 family が TOPPINGS の配列 index で切られるため、topping 1 件の追加で形が変わる）。新材料の追加で動くのは既知の挙動で、**OD-B9-15 により実装 PR で原因分解（追加なし / topping のみ / sauce のみ / 両方）を必須**とする。今回の値（156 / 165 / 132）は仮データでの参考値で、実装 PR の値ではない。
4. 限界: 全体 Vitest・ladder 導出・tsc・E2E は未実行。`white-sesame` の herb / vegetable は、**語義上の妥当性とヒント絞り込み力への影響を未評価**（family 規模が変わるため k≥2 ガードと Hint 5.0 の golden に波及する）。

## 3. 本番 Late Catalog ON と通常 ladder の干渉

### 3.1 実装上の事実（読み取りと実測）

- late step は常に通常 step の後ろに付く（`mergeLate`、`appendLadderSteps`）。番号は「通常 step 数 + 1」で**導出**される（現在 57）。通常 step を k 件足すと 57 + k。
- `lateCatalog.ikura.test.ts` が +1 時の挙動を固定済み（材料・key・順序は不変、番号のみ +1）。
- 解禁は「Shop 権利 = 台帳 ∪ 所持中の有限材料 ∪ ladder 到達分」で、**台帳は縮まない**（`materialEntitlement.ts`）。台帳に入った ID は、この版が知らない ID でも保存時に消えない（`writeSave` の前方互換マージ）。
- 台帳は**起動時**に更新される（`startup.ts` が `resolveShopEntitlement` を呼ぶ）。

### 3.2 実測（通常 step を +1 / +2 / +3、スタンドイン材料・レシピ）

| 通常追加 | ikura の late step | ladder クレジット対象数 | ★2 で到達 | ★1 で閉じる | blocked step |
|---|---|---|---|---|---|
| 0（現状） | 57 | 60 | 59/60 | california、spinach | なし |
| +1 | 58 | 61 | 61/61 | 同左 | なし |
| +2 | 59 | 62 | 62/62 | 同左 | なし |
| +3 | 60 | 63 | 63/63 | 同左 | なし |

余裕（クレジット数 − step 数）は 3 のまま。★ゲートの値は不変。★2 の到達性は、カタログ成長だけで改善する（spinach の 130★ ゲートを超える）。

### 3.3 セーブ別の影響

| セーブ | 結果 |
|---|---|
| E5 後に一度起動済み（台帳に roe あり）・ikura 発見済み | 影響なし。台帳は縮まない。count が新 step に届いていれば通常材料が遡って NEW MATERIAL で解禁 |
| roe を購入済み（所持） | 影響なし（所持中の有限材料は権利に含まれる） |
| count < 57 の未発見セーブ | 影響なし |
| **count ≥ 57 で、roe が台帳にも所持にもない**（= E5 後に一度も起動していない） | **roe の解禁が一時的に遅れる。** 新しい版では roe は count 58（+1）/ 59（+2）/ 60（+3）で解禁。これが「既存セーブの材料解放後退」に当たり得る唯一の場合 |

遅れの性質（実測）: 該当セーブは、count 57 で新しい通常材料が解禁され（例: +2 なら 57 で 1 件目、58 で 2 件目）、新レシピ（クレジット対象）を発見するたびに count が増え、**最後の新レシピ発見で roe が解禁される**（デッドロックなし）。失うもの・戻る保存データはない。遅れる量は「その batch の新レシピ数」。

該当する集団: E5 本番有効化（`6b7aeea`）以降に一度も起動していない、count ≥ 57 のプレイヤー。台帳は起動時に更新されるため、E5 後に起動した人は含まれない。該当人数は計測手段がなく不明。

### 3.4 最小対策案（Owner 判断。いずれも本 PR では実装しない）

| 案 | 内容 | 互換性 | コスト・リスク |
|---|---|---|---|
| **M0 受容** | O-3 案 A のまま。遅れを許容する | 保存データの損失なし。一部で roe が数レシピ分遅れる | 追加コードなし。該当集団は小さい見込みだが数は不明。遅れは新 batch が進むほど長い |
| **M1 運用** | 最初の通常 batch を E5 公開からしばらく空けてから出す | 上と同じ。該当集団が減る | 計測手段がなく「しばらく」の根拠がない。コードなし |
| **M3 下限（推奨候補）** | `salmon-roe` に限り、E5 時点の番号（count 57）以上なら権利に含める下限を `resolveShopEntitlement` に足す。台帳は縮まないので、先に解禁しても害はない | 保存形式の変更なし。**roe の解禁が従来どおり count 57 のまま**（実測: 57 で roe と最初の新通常材料が同時に解禁） | 小さな src 変更（`materialEntitlement.ts` + テスト）。「step 番号 = 解禁 count」という前提に例外が 1 つ入る。`lateCatalog.ikura.test.ts` の +1 テストは番号の導出を見るもので影響しない見込みだが、実装 PR で再確認 |
| M2 番号帯の予約（O-3 の案 C） | late step に固定の解禁 count を持たせる | M3 と同等 | ladder の純粋層・hint / cohort の step 番号前提に触れる。**別 Issue 扱い**（E5 追跡文書の評価と同じ） |

推奨候補は M3（M0 でよいなら追加対応なし）。**M3 は最初の通常 batch の実装 PR に同梱するか、その直前の小 PR とする。** どちらも Owner の承認後で、今回は実装しない。
M3 は E5（FINISH）の本番スイッチや late catalog の ON/OFF には触れない。

## 4. 3 レシピの原典・証跡の整理（全て独立再取得なし）

pizzadb.jp は Claude Code の環境から到達できない（CONNECT tunnel failed, 403）。以下は repo 内の既存証跡のみ。

| 項目 | eggplant-dengaku | eggplant-tahini | yuzu-shrimp |
|---|---|---|---|
| 証跡 id | `eggplant-dengaku-pizza-pizzadb-p6` | `eggplant-tahini-pizza-pizzadb-p5` | `yuzu-shrimp-pizza` |
| 出典 | 比較表 p6 のみ | 比較表 p5 のみ | 個別ページ `/pizzas/yuzu-shrimp/` ＋ 比較表 p15 |
| 取得 | 2026-09-22 の中継、独立再取得なし | 同左 | 同左 |
| 材料（matrix） | ナス / 味噌だれ / モッツァレラ / 白ごま | ナス / タヒニ / ザクロ / パセリ | エビ / 柚子胡椒 / モッツァレラ / 大葉 |
| ソース欄 | 甘辛だれ | その他（タヒニ） | その他（柚子胡椒） |
| 個数・焼成窓・工程タイミング | 記録なし | 記録なし | 記録なし |
| 投入タイミング | **未確認** | **未確認** | **未確認** |
| 下ごしらえ | **未確認** | **未確認** | **未確認** |
| ソース分類 | 設計は sauce と仮定（原典記述ではない） | 証跡の `taxonomyNote` は「topping/drizzle として記載」と読める。設計 §10 の sauce/spread と**食い違う** | OD-B9-2: 仮分類、色 `#b5c56a` 仮採用。**保留中は実装しない**（OD-B9-1） |
| matrix 分類 | `DATA_ONLY` / READY | `DATA_ONLY` / READY | `DATA_ONLY` / READY |
| 関連する中継証跡 | なし | なし | ikura-salmon のページ（#587、未 merge）は「いくらと大葉は焼成後に載せ」。**柚子えびの大葉が同じ扱いかは未確認** |

注意: matrix の `DATA_ONLY` は「全材料が焼成前」を前提にした分類で、原典の裏付けはない（#612 の原典監査も同じ指摘。ikura で食い違いが見つかっている）。`evidenceGaps: []` は「ギャップ無し」の意味ではない。
原典確認の記入欄: `docs/reports/TETO_NEW-SAUCES-B_SOURCE-TIMING-EVIDENCE_TEMPLATE.md`。

### 通常 ladder に入れられる見込みか（原典確認後の分類。現時点では**確定しない**）

| 候補 | 通常 ladder に入る条件 | 再分類になる条件 |
|---|---|---|
| yuzu-shrimp | 柚子胡椒を生地に塗る、かつ大葉・エビが焼成前、エビの事前加熱なし | 大葉または柚子胡椒が焼成後 → 後乗せ（late catalog）。エビを事前加熱 → 下ごしらえ工程 |
| dengaku | 味噌だれを塗る、白ごまが焼成前、ナスの事前加熱なし | 白ごまが焼成後 → 後乗せ。ナスを焼く・揚げる → 下ごしらえ工程 |
| tahini | タヒニを塗る、ザクロ・パセリが焼成前、ナスの事前加熱なし | タヒニを焼成後にかける → ソース後乗せ（実装不可）。ザクロが焼成後 → 後乗せ。ナスの事前加熱 → 下ごしらえ工程 |

## 5. U1 / U2 / U3 の着手可否

| 単位 | 可否 | 理由 |
|---|---|---|
| U1 yuzu-shrimp | **不可** | OD-B9-1（原典確認まで保留）。技術面（DH4 通過・新 topping なし）の障害はない。通常 ladder の次の番号は **57** |
| U2 eggplant-dengaku | **不可** | 原典未確認、`white-sesame` の family が Owner 判断、`deductionGuard` の pin 原因分解が必要 |
| U3 eggplant-tahini | **不可** | タヒニの役割（塗る / かける）が未確定、ザクロ（`fruit` 案）の描画・視認性（タヒニ色が生地に近い）が未決 |

## 6. Owner 判断欄（空欄 = 未回答。未回答を承認とみなさない）

| # | 判断事項 | 選択肢・補足 | Owner の回答 |
|---|---|---|---|
| OD-U0-1 | 原典ページの確認 | 到達できる環境で、テンプレート §1 の確認項目（D-1〜D-7、T-1〜T-7、Y-1〜Y-6）を確認して共有。優先は柚子えび（Y-1〜Y-3） | （未回答） |
| OD-U0-2 | 柚子えびの保留（OD-B9-1）を解除するか | OD-U0-1 の結果後 | （未回答） |
| OD-U0-3 | `white-sesame` の family | `other` は gate 違反（再現済み）のため選べない。候補: `herb` / `vegetable` / `spice`。測定は privacy 系 gate 通過のみ。語義・ヒント絞り込み力は未評価 | （未回答） |
| OD-U0-4 | `pomegranate` の family | `fruit`（privacy 系 gate 通過）。ほかの候補は未検討 | （未回答） |
| OD-U0-5 | タヒニの役割 | 塗る（sauce / PAINT）か、かける（ソース後乗せ）か。原典 T-2 の結果次第 | （未回答） |
| OD-U0-6 | 味噌だれの id・表示名 | `miso-sauce` / 別名。原典 D-2 の結果次第 | （未回答） |
| OD-U0-7 | ikura の late step 番号移動に伴う既存セーブ対策 | M0 受容 / M1 運用 / M3 下限（推奨候補）/ M2 別 Issue（§3.4） | （未回答） |
| OD-U0-8 | 通常 ladder の次の番号（57 以降）の割当、星ゲート有無、credited | 前例は星ゲートなし・credited あり | （未回答） |
| OD-U0-9 | 暫定値の扱い（個数・焼成窓 58–78・CUT なし・色） | 原典に記録がなければ GAMEPLAY CALIBRATION と明記 | （未回答） |
| OD-U0-10 | U1 / U2 / U3 の実装開始 | **今回は未承認**。承認時に #578 へ claim を投稿 | （未回答） |

## 7. 未解決事項

- 原典の投入タイミング・下ごしらえ・ソース分類・個数・焼成窓（3 レシピ全て）。
- `white-sesame` / `pomegranate` の family とヒント絞り込み力への影響、Hint 5.0 golden への波及。
- `deductionGuard.gate` の件数 pin の原因分解（実装 PR で実施。OD-B9-15）。
- E5 後に一度も起動していない既存セーブの規模（計測手段なし）。
- 柚子胡椒・タヒニの色と視認性（生地・pesto との識別。実機 HV が必要）。
- Research 画面・Dex・保存往復の**実行検証**は未実施（コード読解と ladder 純粋層の測定のみ）。

## 8. この PR で変更していないもの

`src/**`、テスト、golden、`e2e/**`、データ JSON（`TETO_PIZZADB_172_MASTER-EVIDENCE.json` を含む。#587 と競合させない）、workflow、`docs/PROJECT_HANDOFF.md`（HOT）、Pinsa / FINISH E5 / Grandma Pizza、Production・Firebase・共有 Preview。
