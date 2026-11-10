# TETO Pizza Game 非競合コンテンツ拡張計画（2026-11-10）

## 1. 文書の目的と境界

本書は、B23-b の有効 claim と競合せずに進められる設計、再測定、テスト準備を最新 `main` 基準で整理する docs-only 計画である。

- 基準: `main` `577dcfd7`
- 本書の変更範囲: この文書のみ
- 禁止: HOT ファイル編集、競合 claim、新規実装、merge、Production ON、共有 Preview 更新
- 全量目標: 食材 170、レシピ 177、調理法・工程 27 候補を維持する
- #817 は Draft を維持し、Owner 承認なしで Draft 解除・merge しない

## 2. B23-b の正本と権限境界

### 2.1 現行正本

B23-b の現行正本は **PR #815、HEAD `76db4d58`** である。実装担当は既存 Claude Code セッションであり、Codex は B23-b の HOT ファイルを編集しない。

Issue #780 の claim、release、引き継ぎ記録を実装再開前に再確認し、正式 release または規則上の期限切れが確認されるまで別セッションは claim を上書きしない。

### 2.2 旧 branch の扱い

`claude/b23b-implementation-780` と `claude/b23b-late-desserts-780` は現行正本ではない。PR #815 が正式に放棄され、claim が release された場合に限り、履歴確認用の fallback として差分を参照する。旧 branch を直接 merge しない。

fallback が必要になった場合も、次の順で新しい作業権限を取得する。

1. Issue #780 で現 claim の正式 release を確認する。
2. Session Operations に従い新 claim を取得する。
3. 最新 `main` から新 branch を作る。
4. 旧差分をファイル単位で監査し、必要な変更だけを移植する。
5. Research、Hint、DH4、在庫、保存、重複判定、経済、E2E を再測定する。

## 3. B23-b 承認内容と Research 差分

Owner 承認済み案Aは維持する。

- 追加レシピ: `nutella-dessert-pizza`、`smore-dessert-pizza`
- 追加食材: `banana`、`chocolate`、`graham-cracker`、`marshmallow`、`powdered-sugar`
- `chocolate`、`graham-cracker`、`marshmallow`、`powdered-sugar` は spice
- 両レシピに `cream-cheese` を各2個追加
- `NO_SAUCE` を維持
- late 順は nutella → smore
- 既存 Gate は緩和しない

### 3.1 承認済み非正準 Research 差分

承認対象は「5レシピ追加」ではなく、**既存の次の5 recipe IDs に対する非正準 Research 差分**である。正準遷移の変更はない。

| 既存 recipe ID | 承認済み非正準遷移 |
|---|---|
| `pesto-salmone` | `(なし)→B`、`B→D`、`C→D`、`C→E`、`D→F`、`E→F`、`E→G` |
| `jalapeno-popper-pizza` | `(なし)→A` |
| `spinach-artichoke-pizza` | `(なし)→A` |
| `apple-cinnamon-dessert` | `(なし)→A` |
| `ikura-salmon-pizza` | `(なし)→A` |

### 3.2 最新 main 基準の再測定手順

PR #815 の最終検証または fallback 移植時は、次を同一 HEAD で記録する。

1. 変更前後の recipe/ingredient/method ID 集合と件数を取得する。
2. Research の正準遷移と非正準遷移を recipe ID ごとに比較する。
3. 承認済み5 ID 以外の非正準差分が0件であることを確認する。
4. Hint 到達性、DH4、在庫消費、保存・復元、重複判定、価格・報酬を再測定する。
5. unit、integration、WebKit E2E、Layout Contract Gate を既存設定のまま実行する。
6. skip、timeout、rerun を成功扱いに畳み込まず、attempt 単位で結果を残す。

## 4. 食材170枠の維持と補充候補

`nutella-spread` は `chocolate` へ統合済みのため、段階投入表は53件から47件となった。これは最終目標を169へ縮小する根拠ではない。

- 最新 `main`: 117 / 170
- PR #815 反映後見込み: 122 / 170
- 残数: 48（既存 staged 47 + 補充枠 1）

補充枠は既存の未実装食材から選ぶ。次は候補比較であり、採用決定ではない。

| 候補 | 種別 | 既存の紐づき | 利点 | 主な追加条件・リスク |
|---|---|---|---|---|
| `squid` | topping / SEAFOOD | `frutti-di-mare-pizzadb`、RB-06 / IB-03 | 早い batch、既存レシピ用途が明確、新 sauce 手順が不要 | SVG、Research、host レシピ依存の確認が必要 |
| `peanut-sauce` | sauce | `thai-chicken-pizza`、RB-07 / IB-03 | 用途が明確で sauce 系の幅を増やす | New Sauces 手順 #578 と sauce Gate が必要 |
| `strawberry` | topping / FRUIT | `fruit-dessert-pizza`、RB-10 / IB-04 | dessert 系を補強し、通常 topping として扱える | batch が遅く、SVG と host レシピ依存がある |
| `rock-salt` | topping / SPICE | `focaccia-genovese`、RB-10 / IB-04 | spice として既存モデルへ載せやすい | batch が遅く、用途が単一レシピ寄り |

暫定推奨は `squid`。既存未実装食材で最も早い投入帯にあり、新しい sauce 挙動を増やさないためである。ただし、host レシピ、SVG、Research Gate を確認した上で Owner が補充枠を決定する。`nutella-spread` の再分離や別名食材の水増しは行わない。

## 5. 3ラインの進捗

| ライン | 最新 main 出荷済み | 今回増分 | PR #815 後見込み | 残数 | 進捗率（PR #815後） | 次の候補 |
|---|---:|---:|---:|---:|---:|---|
| 食材 | 117 | 0（docs-only） | 122 / 170 | 48 | 71.8% | staged 47件 + Owner選定の補充1枠 |
| レシピ | 102 | 0（docs-only） | 104 / 177 | 73 | 58.8% | PR #815完了後の次 Research Batch |
| 調理法・工程 | 7 | 0（docs-only） | 7 / 27 | 20 | 25.9% | STEAM S4、M7 D2、FRY F2、D-ING-1設計 |

本PRは計画書のみのため出荷数を増やさない。3ラインの全量目標は変更しない。

## 6. M7 D2 と #804

### 6.1 D1 の現状を固定する

D1 runtime の allowlist は **`olive-oil` のみ**である。D2 のために D1 実装を先行変更しない。`honey` は D2 計画へ含めるが、D1 allowlist へ追加しない。

### 6.2 D2 の5契約を正規SSOTへ統合する

D2 は #804 の CI 修復と、次の5契約の正規SSOT統合を先行条件とする。

1. post-bake liquid は明示 allowlist の ID だけを対象とする（D2計画に `honey` を含む）。
2. 液体 ID ごとに1ラウンド1回、在庫を1個消費する。
3. いずれかの材料不足時は全体を原子的に拒否し、部分消費しない。
4. FINISH ごとに exactly-once とし、再送・重複操作で二重消費しない。
5. schema v2 の保存・journal と前方互換性を維持する。

### 6.3 #804 CI履歴

- attempt 1: `deductionGuard.gate.test.ts` が120秒で timeout。649 files / 12,071 tests は通過し、assertion failure はなかった。
- attempt 2: failed-job rerun が成功し、結果は **RERUN_PASSED**。

初回 timeout の履歴を消さず、attempt 2 の成功と併記する。timeout や Gate の緩和は修復手段にしない。

## 7. D-ING-1

D-ING-1 は設計のみ継続し、HOT 実装は B23 完了後に別 claim で行う。

- R1 は最大4
- rider は host 食材のみ
- late rider は禁止
- 保存互換性を維持
- 既存 Research、在庫、重複判定、経済 Gate を緩和しない

設計成果物は、schema、拒否条件、保存 migration、テストマトリクスまでとし、runtime ファイルへ触れない。

## 8. STEAM / FRY と実行優先順位

優先順位は全セクションで次に統一する。

1. **STEAM S4を優先**し、非競合の比較・検証を進める。
2. **FRY F2は正式 claim 取得後に並行**して進める。
3. **M7 D2は5契約の正規SSOT統合と #804 CI修復後**に実装へ進む。
4. **D-ING-1は設計継続**、HOT実装はB23完了後の別claimとする。

eggplant 専用 visual は既承認 SVG 方針で比較・検証を進めるが、最終採用は Owner HV 後とする。

## 9. 実装再開時の共通 Gate

各ラインで HOT 編集を始める前に、次をすべて満たす。

1. 最新 `main`、関連Issue/PR、Session Operations を再確認する。
2. 対象ファイルを列挙して claim 範囲との非競合を確認する。
3. 必要な正式 claim を取得し、comment ID、owner、expiry、対象ファイルを記録する。
4. Research承認表と変更予定IDを固定する。
5. 既存 Gate を緩和せず、保存互換性とWebKit E2Eを含む検証計画を先に置く。
6. CIの全attemptを確認し、独立レビューなしにFinal Gate GREENとしない。

## 10. 次に必要な Owner 判断

1. 食材170を維持する補充1枠を、`squid` を第一候補としてどれにするか。
2. PR #815 完了後、次の Research Batch / ingredient batch をどの組み合わせで claim するか。
3. STEAM S4 の比較結果と eggplant SVG を HV で最終採用するか。
4. #804 CI修復と5契約SSOTが揃った時点で M7 D2 の正式 claim を許可するか。
5. FRY F2 の正式 claim をいつ開き、STEAM S4 と並行開始するか。

これらの判断が済むまでは、本書を実装承認や claim の代替として扱わない。
