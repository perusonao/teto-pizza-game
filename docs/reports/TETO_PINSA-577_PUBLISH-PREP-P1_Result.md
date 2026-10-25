# Pinsa Romana 本番公開準備 Phase 1（#577）— ON 時の失敗の分類と修正・原典との相違

Status: **`PINSA_PRODUCTION = false` を維持（公開していない）。** 基準 `main` = `faaafa4`（#656 merge 後）。本番・Firebase・共有 Preview・E5・Grandma Pizza の挙動は変えていない。変更はテストとテスト支援のみ（`src/**` の製品コードは無変更）。

## 1. 公開リハーサルの手順
`npm run test:pinsa-on`（= `TETO_PINSA_ON=1 vitest run`）は、`vitest.config.ts` の plugin が **実物の `pinsaGate.ts` のリテラルだけを `true` にして**全体を流す（`HAND_ENFORCEMENT` の activation と同じ fail-closed 方式。`?raw` で読むソース検査には出荷テキスト `false` が見える）。通常の `npm test` は従来どおり `false` で走る。公開 PR では、このコマンドが green であることを確認してからリテラルを変える。

## 2. ON 時の失敗（#656 の調査実行で 52 件、現 main で 57 件）の原因と修正
期待値の書き換えではなく、実際の仕様との対応で直した。
| 分類 | 件数の目安 | 原因 | 修正 |
|---|---|---|---|
| A. 一意性カナリアの鍵が弱い | 4 | 「材料集合+個数」だけを identity とみなしていたが、実際の identity は生地・後乗せも含む（jamon と Pinsa は材料が同一） | `identityKeys.ts`（`recipeIdentityKey` / `targetIdentityKey`）で matcher が実際に判定する次元を含めた。緩和ではなく鍵の是正 |
| B. 件数・順序の pin | 約 15 | レシピ 65→66、章 4 の総数 29→30、非 credit 5→6、複数同時解禁 step に 33（arugula で jamon と Pinsa が同時に DISCOVERABLE）、後乗せ 1→2 等 | ゲート連動（`pinsaEnabled()`）で実仕様の値を期待する |
| C. 「Pinsa は未公開」前提の pin | 約 15 | `doughKind` が空、dough target が無い、技法が誰にも要求されない、Dex に出ない 等 | ゲート連動。公開側（ON）は「技法は riddle のみで名前を出さない」「生地だけでは発見にならない」を別に検査 |
| D. 凍結 golden / 母集団 | 約 6 | Hint ladder の golden（55 ladder）、alpha report、key-free 母集団 40 | Pinsa の ladder は jamon と同形（`lateCatalog.pinsa.test.ts` が固定）なので凍結 golden の外に置く。母集団は 40→41 |
| E. 星ゲートの baseline | 1 | 一様 ★2 で 1 レシピ増 → 132★ ≥ spinach の 130★ ゲートとなり、直接ゲートが 0 件になる（カタログ増加だけの改善。ゲート値は不変） | 先例（New Sauces Phase A）と同じ ratchet 扱いで、ゲート連動の期待値に |
| F. 進行シミュレーション | 約 9 | ハーネスが「材料集合 = 答え」で焼くため、jamon と同じ集合の Pinsa（生地チップ＋後乗せが必要）を解けない | 下記 3 |
| G. 技法許可リスト | 2 | DH4 / Hint 5.0 gate の `DOUGH_PINSA_ROMANA_RECIPE_IDS` | #656 でゲート連動の共有 1 か所にしたものを、ON の late-addition 開始 step（arugula の step）に合わせた |

## 3. シミュレーションの修正（生地バリエーションと POST_BAKE）
- `lateFinishSim.answerVariantOf(ids, recipeId?)`: 答えを「どの食材を焼成後に置くか」と「どの生地を選ぶか」に変換する唯一の場所。レシピ ID を渡すとそのレシピの variant、渡さなければ従来どおり（材料集合が一致する最初のレシピ）。ヒント経済 2 本は目標レシピを渡す。
- Research 試行シミュレーション: 正確な材料集合で外れたあと、生地を固定するレシピの目標では、プレイヤーが「別の生地（チップが出ているときだけ）」→「別の生地＋1 材料を焼成後」→「標準生地＋1 材料を焼成後」の順に作り方を変える。各試行は実 reducer を通り、Research の契約不変条件を毎回検査する。「情報なし」の連続にも数えない（同じ集合の試行は構造上 rows を返さないため）。
- 結果: 全プロファイル×品質で Dex 全件（ON では 66）に到達し、契約違反 0、deadlock 0、RESERVED 停止 0。ON では Pinsa が発見される stage があることを明示的に検査する。

## 4. テスト結果（HEAD は PR の最終 commit）
- `npm test`（ゲート false）: 521 files passed / 9,623 tests passed、失敗 0。
- `npm run test:pinsa-on`（ゲート true）: 521 files passed / 9,623 tests passed、失敗 0（OFF 専用の漏えい検査 13 件は skip）。
- `tsc -b` クリーン。

## 5. 原典（pizzadb.jp）との相違
**この環境からは pizzadb.jp に到達できず（WebFetch `ENOTFOUND`、curl はプロキシが拒否）、原典は今回も独立に確認できていない。** 検索（pizzadb.jp に限定）にも Pinsa のページは出なかった。以下はリポジトリ内の記録（2026-09-22 の比較表の中継値、172 matrix、2026-10-23 の Owner 取得・中継 F1〜F6）との比較であり、**原典との照合ではない**。
| 項目 | 記録 | 現在の実装 | 相違 |
|---|---|---|---|
| 材料 | モッツァレラ / 生ハム / ルッコラ（比較表）。トマトソースは「ソース分類」由来（matrix は family_derived）、F1 で「トマトソース使用」と明記 | tomato-sauce 1 / mozzarella 2 / prosciutto-crudo 3 / arugula 2 | なし（個数は原典に無く暫定） |
| 生地 | 「小麦・米・大豆をブレンドした長時間発酵生地」（matrix: variant `material-multigrain-long-ferment`） | 同じ種別を `doughKind` として持つ。見た目は標準の生地と同じ | **見た目の差が無い**（意図どおり。PK-0 項目 2 は未確認） |
| 形 | F5「楕円形」。ただし matrix は `shape: round` / `open-round` | 丸（M0）、CUT なし | **記録間で食い違い**（Owner 中継は楕円、172 matrix は丸）。楕円は未表現 |
| 工程 | F2 モッツァレラは焼成、F3 生ハムは焼成前後どちらも可、F4 ルッコラは最後に加えると風味を保ちやすい、F6 下焼きは必須と確認できない | 生ハムは焼成前、ルッコラのみ焼成後（L1）。下焼きなし | 矛盾なし。生ハムとルッコラのタイミングは**ゲーム設計の選択**で原典の確定ではない |
| 個数・bake | 原典に記録なし | 暫定（D4）、bake 58–78 | 実測前に確定しない |
| 名称 | matrix は「ピンサロマーナ」 | 「ピンサ・ロマーナ」（Owner R2） | 表記（中黒）のみ |
| 説明文 | PK-0 項目 4 未確認 | 「独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。」 | 「ローマ生まれ」は matrix の origin（イタリア / ローマ）と整合。妥当性は未確認 |
| Piadina との区別 | PK-0 項目 5 未確認（記録上は区別あり） | — | 未確認 |

## 6. iPhone 実機 HV に進めるか
**進める（HV の準備としては整った）。ただし公開の可否は別 Gate。**
- 進める理由: ゲートを開いた状態の全体テストが通り、シミュレーション上 Pinsa に到達でき、漏えい検査（OFF）と技法・Hint の privacy gate（OFF/ON）が通る。
- 実機 HV で見るもの: 生地チップの出方（credited 33 で開く）と文言、FINISH でルッコラを後乗せする流れ、ルッコラの位置（R4）と判定、ON で jamon の Research ラベルが「B」に変わる点（Q7）、step 33 での riddle の同時出現（D3）、章 4 の表示（D7）。HV 用ビルドは専用の一時検証環境（G-4）で、共有 Preview は使わない。
- 公開前に残る別 Gate: 原典確認（項目 2・4・5 と、形の食い違いの解消）、HV、Owner の公開承認。
