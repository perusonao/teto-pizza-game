# TETO 全量追加の開発効率改善 — 列車スペック＋事前検査方式（#780）

2026-11-10 / 基準 `origin/main` = `577dcfd7`（#814 B23-a merge 後）。ブランチ `claude/teto-pizza-fable-optimization-6cj5wq`。

変更は**新規ファイルのみ**: 本書、`docs/reports/data/TETO_TRAIN-EFFICIENCY/**`、`tools/content-train/**`、`src/contentTrain/**`。HOT ファイル・既存テスト・golden・`src/data/staged/**`・他セッションの claim 範囲は編集していない。**本書は計画と読み取り専用ツールであり、実装・merge・Production ON・共有 Preview 更新の承認ではない。**

凡例: 【実測】この環境でコード・GitHub から確認、【推論】実測からの解釈、【仮定】測れないため明示した入力、【提案】Owner の判断が要る。

---

## 0. 結論

1. **往復が増える原因は「Owner 判断が実装の後に見つかる」こと【実測】。** B22 は実装後に Research 35 ID の個別承認と逸脱 10 件、B23 は実装後に既存 Gate 2 件と衝突して a／b に分割し、母集団が変わったため Research を再承認した（3 レシピに Owner の判断項目が 10 件以上）。
2. **対策: 列車スペック → 事前検査 → 一括承認 → 実装。** HOT を編集する前に、スペック（JSON 1 枚）を実カタログと実 authority で検査し、Owner 判断を 1 枚のパケットにまとめるツールを実装した（`tools/content-train/`、読み取り専用、3〜40 秒）。
3. **過去バッチで検証済み【実測】:**
   - B23-a を実装前の main（`07bb706`）で再現 → Owner が個別承認した **8 ID と完全一致**、NO_SAUCE 判断と cream-cheese パック 20→30 も事前に検出。再承認になった 2 件（`A→B`）も上界の内側。
   - B23-b（staged のまま）→ 実装後に見つかった **2 つの衝突（`other` family、チーズ無し NO_SAUCE）を両方とも事前に STOP**。修正案（spice＋cream-cheese）→ #815 の承認内容（5 ID、pesto-salmone の 2 文字ずれ、他 4 件は `→A` のみ）と**完全一致**。
4. **Research 承認を分割に強い単位にできる【実測＋提案】。** 非正準順の文字変化は標本（乱数 40 順）ではなく**決定的な上界**（影響 ID＝有限食材を共有する出荷済みレシピ、ずれ幅＝先に並ぶ新レシピ数）で出せる。上界はレシピごとに加法的なので、**列車を分割・並べ替えしても再承認が要らない**（§3.3）。
5. **機構待ちでない残り 30 品を一括検査した【実測】:** READY 0／Owner 判断のみ 16／STOP 14（うち 10 は既知の D-6、3 はチーズ無し NO_SAUCE、1 は M7）。これを 4 本の列車に割った（§4.2）。
6. **全量完了までの Owner 往復見積もり【仮定つき】: 現行 約 200 → 改善 約 75（幅 55〜110）。** 内訳と測定計画は §6・§7。

---

## 1. 確認した状態【実測】

| 対象 | 状態 |
|---|---|
| `CLAUDE.md`／`PROJECT_HANDOFF.md`（startup checklist・roadmap 節）／`TETO_SESSION-OPERATIONS_1.0.md` 全文 | 読了 |
| main `577dcfd7` | レシピ 102／食材 117／ladder 87 step（通常 74＋late 13）／調理法 実装済み 7 |
| Issue #780（本文＋コメント 31） | claim 23 ブロックを全件抽出（下表） |
| PR #815（B23-b、Draft・HOLD、HEAD `76db4d58`） | nutella・smore＋5 食材。merge 後は 104／122／89 step。Owner 判断待ち 2（nutella-spread の扱い、HV） |
| 台帳 `TETO_CONTENT-MASTER_*`（基準 `4c275c2b`）、`TETO_EFFORT-LEDGER_*`、B22／B23 の Result | 読了。台帳の数値は B23-a 分だけ古い |

**有効な claim と本作業の関係**

| 保有 session（末尾） | 範囲 | 期限 | 本作業 |
|---|---|---|---|
| …RVoi7RJtRnB3cKLU（#815） | HOT カタログ群（`ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts` ほか）、`src/logic/catalog/testSupport/**`、`src/logic/discovery/__golden__/**`、`src/data/staged/**`、`src/preview/hvSeeds.ts` ほか | 11-24 | **編集なし**（import して読むだけ） |
| …1r2RuC2BKGt8LF145（T-FX） | `src/data/staged/**`、`TETO_FULL-EXPANSION-177_*` | 11-21 | 編集なし（テキストとして読むだけ） |
| …RVoi7RJtRnB3cKLU（#804／#805／#806／#813） | M7 設計、`TETO_CONTENT-MASTER_LEDGER_*`、D-ING-1 R1、WebKit flake、B23 決定表 | — | 編集なし |
| …37oV1zQLYSQserkSG／…45ZaQjZXtR2AzPzUp | POOL-REJUDGE、T5、FOLD-SEAL ラボ | 11-20 | 編集なし |

本作業の名前空間（`src/contentTrain/**`・`tools/content-train/**`・`TETO_TRAIN-EFFICIENCY*`）はどの claim とも重ならない。

---

## 2. 現行方式のどこで往復が生まれるか【実測、各 Result Report より】

| # | 事象 | 発生 | 往復への影響 |
|---|---|---|---|
| W-1 | Research 非正準差分を**実装後**に測り、ID ごとに承認 | B22（35 ID）、B23-a（8 ID）、B23-b（5 ID） | 毎バッチ 1 往復 |
| W-2 | 測定が乱数標本＋母集団依存。分割すると結果が変わる | B23-a（提示表に無い 2 件、出ない 1 件） | 再承認 1 往復 |
| W-3 | 既存 Gate との衝突が**実装後**に判明 | B23（`other` 到達不能、G7 CHEESE 先頭、G9） | 分割＋解決案の承認で 2〜3 往復、実装のやり直し |
| W-4 | 仕様からの逸脱（step 順・パック 20→30・層の順） | B22（10 件）、B23-a（パック・凍結範囲） | 1〜2 往復 |
| W-5 | 実測値を固定したテストの追従（旧 DH4-2A 257↔291、件数、synthetic fixture） | B22・B23-a・B23-b | Owner 確認 1 往復＋修正コミット |
| W-6 | claim の release 漏れ・担当の取り合い | #792 の未 release、B19／B20-A の重複実装、B23-b の Codex 引き継ぎ | 待ち時間と重複トークン |
| W-7 | 小さいバッチ（1〜6 品）ごとに HV・merge | 全バッチ | バッチ数に比例 |

実績の目安: 1 バッチ約 5 タッチ・open→merge 中央値 約 16h・output 約 438k／約 51 USD（`TETO_EFFORT-LEDGER_B12-B20A_Forecast_2026-11-08.md`）。B22 と B23 は、どちらも実装開始後に仕様が変わった（W-3／W-4）。B21 は未集計。

---

## 3. 改善方式 — 列車スペック＋事前検査

### 3.1 流れ（列車 1 本）

```
[非 HOT・並行可] staged → make-spec → 列車スペック JSON → preflight → Owner パケット
        │                                                    │ STOP があればスペックを直して再実行（Owner 不要）
        ▼ 往復 1: Owner がパケットに一括回答（承認／不承認／修正）
[HOT・直列]     承認済みスペックどおりに実装 → 全 Vitest・E2E → Draft PR → CI・独立レビュー
        ▼ 往復 2: iPhone HV の結果＋merge 可否
```

- **スペックが唯一の仕様**。実装中に仕様が動いたら停止して往復 1 に戻る（黙って逸脱しない）。
- 列車の大きさは 6〜8 品【仮定】。上界が加法的なので、HV や CI の都合で**後から分割しても往復 1 はやり直さない**。
- 事前検査は実装 PR のテスト・CI・Codex・HV を**置き換えない**。Gate は 1 つも緩めていない。

### 3.2 事前検査が出すもの【実装済み】

| Gate／判断 | 由来 | 判定 | 方法 |
|---|---|---|---|
| 重複ゲート（同一・部分・上位集合・1 材料差・Jaccard>0.4） | R-2／R-4、D-1 | OWNER | staged と同じ規則。出荷済みと列車内の両方 |
| Research 正準順の変化 | D-6（昇格停止条件） | **STOP** | 実 `researchCohortLetters` を全 prefix で実行。原因レシピを特定 |
| Research 非正準順 | B18 Codex P2、B22／B23 の個別承認 | OWNER | 決定的上界（§3.3）＋標本監査との突合（不一致なら実行失敗） |
| 新食材の family が `other` | `deductionProduction.gate`（OD-DH4-2-9）、B23 の衝突 1 | **STOP** | スペックから判定。出荷済みの `other`（egg ほか）は「要再実行」の注記 |
| ソース無し | D-2（NO_SAUCE は Owner の明示判断） | OWNER | スペックから判定 |
| ソースもチーズも無い | `hint5Production.gate` G7、B23 の衝突 2 | **STOP** | スペック＋実 `buildHint5Ladder` の先頭 rung |
| Hint 5.0 の対象か／出荷済み梯子の不変 | T-COV、`hint5.ladders55.json` | **STOP** | 実 `buildHint5Ladder`＋committed golden |
| 焼成後のソース | M7（#579） | **STOP** | スペックから判定 |
| 機構待ち | staged `mechanics` | **STOP** | スペックから判定 |
| late／通常の配置（late 食材を使う品は late） | Q-1 系 | OWNER | ladder から判定し、late として測定 |
| 新食材なし（key レシピになれない） | OD-REC04-1 | OWNER | スペックから判定 |
| ショップのパック 10k の変化 | B22／B23-a の条件付き承認 | OWNER | `materialK` と同じ規則 |

未対応（パケット §6 に明記、実装 PR で測定）: `alphaFamilyOnly` レポート差分、旧 DH4-2A などの実測値追従、ladder の step 番号と凍結範囲、Reference 配置・絵文字一意（G18）・名前の収まり・アイコン・E2E・HV。

### 3.3 Research の決定的上界【実測で検証】

`researchCohortLetters` は「最後に入手した有限食材」が同じレシピを 1 群にし、2 品以上の群に id 由来の固定順で A, B, … を振る。したがって新レシピ N が出荷済み R の文字を変えられるのは、**R と N が有限食材 m を共有し、m を最後に入手した順**だけである。

- 変わりうる出荷済みレシピ ＝ 新レシピと有限食材を共有するもの（それ以外は**どの順でも**変わらない）
- N が R の後ろに並ぶ → R は単独だったときに `→A` が付くだけ（`NEW_LABEL_ONLY`）
- N が R の前に並ぶ → R は 1 文字後ろへ。同じ食材でそういう新レシピが k 品なら最大 k（`SHIFT k`）
- 行は新レシピごとの和集合（**加法的**）。分割・並べ替えで ID もずれ幅も増えない

検証: B23-a 8／8 ID、B23-b 修正案 5／5 ID と種別、30 品の一括検査で標本監査との不一致 0（突合は毎回実行され、不一致なら終了コード 2）。

**【提案 R-RES-1】** Research 非正準の承認単位を「ID＋before→after の列挙」から「**ID＋最大ずれ幅**（パケット §4 の表）」に変える。ID 個別承認という既存決定はそのまま満たし、列挙だけを上界に置き換える。正準順 0 は引き続き必須（STOP）。不採用でもツールは使える（その場合は従来どおり実装後の列挙も提示する）。

### 3.4 Gate 自動化の次の段（未実装・HOT または他 claim に触れるため #815 merge 後に別 PR）

| ID | 内容 | 効果 | 触るもの |
|---|---|---|---|
| G-A | `expansionBatchNN.test.ts`（毎回 270〜360 行の手書き）を、承認済みスペック JSON を読む共通の `trainContract.test.ts` に置き換える | 定型実装の削減、仕様とテストの乖離 0（W-4） | `src/data/expansionBatch*.test.ts`（claim 範囲） |
| G-B | Research の承認をパケット JSON から固定（手書きの `PRESENTED_AND_APPROVED` をやめる） | W-1／W-2 | 同上 |
| G-C | 実測値の固定（旧 DH4-2A の件数、`CATALOG_COUNTS`、`ordinaryRecipes` 件数）を 1 つの measured-values スナップショットに集約し、差分を PR に自動表示 | W-5 | 既存テスト多数。**Gate の表明は変えない**前提で Owner 承認が要る |
| G-D | `deductionProduction.gate` の状態掃引を事前検査から呼べる形にする（`other` の動的判定） | W-3 の残り | `src/logic/discovery/**` のテスト補助 |
| G-E | HV シードと E2E をスペックから生成（`?hv=<train>-<recipe>`、`e2e/train.spec.ts`） | 定型実装の削減 | `src/preview/hvSeeds.ts`（claim 範囲）、`e2e/**` |
| G-F | `scripts/ops/hot-files.json` に `ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts` ほか実際の HOT 群を追加 | W-6（Owner Gate が HOT 重複を自動で警告） | `scripts/ops/**`（Owner 承認） |

---

## 4. 非競合の並行タスクと作業分担

### 4.1 レーン（HOT を持つのは常に 1 session）

| レーン | 内容 | 触るパス | HOT | 推奨モデル |
|---|---|---|---|---|
| **L1 Catalog Integrator** | 承認済みスペックの実装（列車を直列）。#815 → T24 → T25 → … | HOT カタログ群・golden・`expansionBatch*`・`e2e/` | **唯一の保有者** | 定型実装は Sonnet 級、Gate 衝突が出たら Fable |
| **L2 Spec／Preflight** | 列車スペックとパケットを 1〜2 本先行して作る。STOP の解消案 | `docs/reports/data/TETO_TRAIN-EFFICIENCY/**`（新規のみ） | なし | **Fable**（設計・衝突の解決） |
| **L3 原典・判断資料** | D-2 原典調査（NO_SAUCE 候補）、D-1 例外資料、D-6 の ID 別表 | `docs/reports/**`（新規のみ） | なし | Fable（判断資料）＋Haiku 級（集計） |
| **L4 Icons** | 残り食材の専用 SVG（未配線・新規ファイル、P-2 の包括承認の範囲） | `src/components/<name>Glyphs/**`（新規） | なし（配線は L1） | Sonnet 級 |
| **L5 Mechanics** | M1（#775）→ M7 → M5 → M3 → M2 → M4 → M6。純粋ロジックは並行、画面接続は直列 | `src/logic/<mechanic>/**`、Gate 定数。`GameScreen.tsx`・`App.css`・`gameReducer.ts` は 1 本ずつ | UI HOT は直列 | 設計は **Fable**、実装は Sonnet 級 |
| **L6 計測・台帳** | 往復・時間・トークン・Gate 成功率の記録、台帳の再生成 | `docs/reports/data/**`（生成物） | なし | Haiku 級 |

### 4.2 機構待ちでない 30 品の列車割り【実測、`data/TETO_TRAIN-EFFICIENCY/survey-no-mechanic.preflight.md`】

| 列車（案） | レシピ | 新食材 | 事前検査 | Owner に聞くこと（1 回） |
|---|---|---|---|---|
| **T24** 新食材つき・ソースあり | peruvian-aji-amarillo、thai-chicken-pizza、pizza-asparagi-limone、frutti-di-mare-pizzadb、diavola-pizza、south-african-boerewors、peking-duck-pizza（7） | aji-amarillo、peanut-sauce、asparagus、squid、spicy-salami、chutney、cucumber、peking-duck、sweet-bean-sauce（9） | STOP 0 | 重複例外（Jaccard／1 材料差）、Research 上界、peking-duck の複合食材（I-3） |
| **T25** late 配置・NO_SAUCE（チーズあり） | swedish-kebab-pizza、pizza-salad、banh-mi-pizza、buffalo-cauliflower-pizza、mexican-elote-pizza、chicken-tikka-pizza（6） | kebab-sauce、yogurt-sauce、daikon、liver-pate、cauliflower、lime、chicken-tikka（7） | STOP 0 | NO_SAUCE 4 品（D-2、原典調査は L3）、late 配置 3 品、重複例外 |
| **T26** 新食材なし | nashville-hot-chicken-pizza、keema-pizza、nduja-pizza（3） | — | STOP 0（正準 0） | ladderCredit の扱い、keema の部分集合 20 件（D-DUP-1） |
| **T27** スペック修正が要る | jerusalem-mixed-grill-pizza、philly-cheesesteak-pizza、mentaiko-mochi-pizza（3）＋ D-6 の 10 品 | cumin、mentaiko、mochi（3） | **STOP 13** | チーズ追加かソース指定（B23-b と同じ形）、mochi の family、D-6 の 12 ID 個別承認（パケットに原因つきで列挙済み） |
| M7 待ち | hot-honey-pepperoni（1） | — | STOP（焼成後ソース） | M7（#579）の完成 |

T24〜T26 の 16 品・16 食材は、往復 1 の回答だけで実装に入れる。T24 と T25 は cucumber を共有するので T24 を先にする。nutella・smore は #815 で進行中のため対象外。残り 43 品は機構待ち（L5）。

### 4.3 HOT claim と PR の競合を防ぐ規則（Session Operations §1 の範囲内）

1. **HOT claim は列車シリーズで 1 本**。L1 以外は HOT を import して読むだけ。次の列車は前の列車の merge 後の main から分岐（積み上げない、§2 `WAIT_DEPENDENCY`）。
2. **引き継ぎは保有 session の `released:true` のみ**（Owner が保有 session に直接指示）。第三者の「引き継ぎ希望」コメントでは動かない（B23-b の先例）。
3. merge した session は**同じターンで release を投稿**する（#792 の release 漏れの再発防止）。release は元 session の正式な `released:true` のみ（Owner 判断 2026-11-10: merge による自動 release は**不承認**）。代わりに「PR は merge 済みなのに claim が未 release」を Owner Gate のレポートに警告として出す release 忘れ防止チェックを足す（承認済み、#815 merge 後の別 PR）。
4. staged の追従は L1 が「出荷品を生成器で外す」最小編集だけ行い、T-FX に通知（B19〜B23 の先例）。
5. 台帳（`TETO_CONTENT-MASTER_LEDGER_*`）は後から merge する側が生成器を再実行（#804／#810 の先例）。
6. L2 の成果物は列車ごとに別ファイル。L4 の SVG は新規ファイルのみで、配線は L1 の次の列車に同梱。
7. 着手前に Owner Gate（dry-run）と open PR の変更ファイルを確認。G-F を採用すると HOT 重複が自動で `HOT` 表示になる。

---

## 5. 今回実装したもの（非競合・読み取り専用）

| ファイル | 内容 |
|---|---|
| `tools/content-train/make-spec.mjs`／`preflight.mjs`／`README.md` | スペック生成と事前検査の CLI |
| `src/contentTrain/trainSpec.ts`＋`trainSpec.test.ts` | 純粋ロジックと合成データの単体テスト 14 件（カタログの値を固定しないので、列車が着地しても追従不要） |
| `src/contentTrain/trainPreflight.run.test.ts` | 実カタログでの測定。`TETO_TRAIN_SPEC` が無い通常実行では skip |
| `docs/reports/data/TETO_TRAIN-EFFICIENCY/*` | 30 品の一括検査、B23-a／B23-b／B23-b 修正案の再現（スペックとパケット） |

検証【実測】: `src/contentTrain` 14 件成功・1 件 skip、`tsc -b` エラー 0、oxlint 指摘 0、`stagedIsolation.test.ts` 成功（staged を import していない）。UI・ゲームプレイの変更は無いので HV Policy の対象外。

---

## 6. 全量完了までの Owner 往復見積もり【仮定つき。予測ではなくシナリオ】

残り（#815 merge 後）: レシピ 73（機構待ちでない 29＋M7 待ち 1＋機構待ち 43）、食材 48、調理法 未完 12 トラック相当＋採否未決 6。

| 区分 | 単位 | 現行（1 単位あたり） | 改善（1 単位あたり） | 現行 計 | 改善 計 |
|---|---|---|---|---|---|
| 機構待ちでない 29 品 | 現行 8 バッチ（約 4 品／本）→ 改善 4 列車 | 5.5 | 2（パケット＋HV・merge） | 44 | 8 |
| 　STOP 解消・D-6／D-DUP の一括判断 | — | 上に含む | 一括 1＋差し戻し 2 | — | 3 |
| 機構待ち 44 品（M7 待ち 1 を含む） | 現行 11 バッチ → 改善 6 列車 | 5.5 | 2＋差し戻し 25% | 60 | 15 |
| 調理法 8 トラック（M1〜M7＋STEAM） | トラック | 約 10（台帳の標準 85 ÷ 8） | 4（設計パケット／ラボ HV／配線 HV・merge／本番 ON）＋HV やり直し 30% | 85 | 42 |
| 採否未決 6・共通（継続指示・台帳） | — | 10 | 一括 1＋共通 5 | 10 | 6 |
| **合計** | | | | **約 200** | **約 75** |

- 現行の合計は `TETO_EFFORT-LEDGER` の「従来運用・標準」（約 190）とほぼ同じ水準。同台帳の S-1／S-2 採用時は 133。
- 改善の幅: 楽観 55（差し戻し 0、列車 8 品）〜悲観 110（列車ごとに差し戻し 1、調理法の HV を各 2 回）。
- **調理法が改善後の 56% を占める**。食材・レシピ側は 104 → 26 と大きく減るが、調理法は iPhone HV と設計判断が本質的に要るので減り方が小さい。
- 入力はすべて【仮定】（列車サイズ、差し戻し率、HV やり直し率）。§7 の測定で最初の 3 列車の実測に置き換える。

---

## 7. 現行方式と改善方式の比較計画

**比較対象**: 現行＝B19〜B23-b の 6 PR（#783・#792・#799・#807・#814・#815、記録済み）。改善＝T24〜T26 の 3 列車。無作為化はできないので前後比較とし、**レシピ 1 品あたり**に正規化する。

| 指標 | 定義 | 取り方 | 現行の基準値 |
|---|---|---|---|
| プロンプト往復数 | 決定表の提示から merge までの Owner 発言数（PR／Issue コメント＋セッションへの指示） | GitHub API の Owner コメント数＋セッションログの非通知ターン数 | 約 5／バッチ、B23（3 品）は約 10【実測・下限】 |
| 所要時間 | ① 決定表提示→実装開始、② PR open→merge、③ Owner 待ちの合計 | PR・コメントの時刻 | ② 中央値 約 16h。①③は未測定 |
| トークン消費 | 列車に帰属するセッションの output／cache 読込／費用。モデル別に分ける | セッションの最新 result の累計 | output 約 438k・約 51 USD／バッチ（4 バッチの中央値） |
| Gate 成功率 | (a) 実装開始後に仕様が変わらなかった列車の割合、(b) 最初の CI が全 green の割合、(c) Research の再承認 0 の割合、(d) HV 初回 PASS の割合、(e) 事前検査の STOP／OWNER と実装後の実際の一致率 | Result Report、Actions、パケット | (a) B22・B23 で 0／2【実測】（B21・B23-b は未集計）。(b)(d) は未集計 |

**手順**: ① T24 のパケットを Owner に提示した時刻を起点に記録開始。② 各列車の merge 時に L6 が 4 指標を `docs/reports/data/TETO_TRAIN-EFFICIENCY/ledger.csv` に 1 行追記。③ 3 列車の後に現行と比較し、§6 の仮定を実測に置き換える。

**判定**: 品あたり往復数が現行の 50% 以下、かつ Gate 成功率 (a) が 2／3 以上なら機構待ちの列車と調理法トラックに展開。満たさなければ、(e) の不一致から事前検査に足す Gate を決める。Gate を緩めて数値を良くすることは比較の対象外（禁止）。

**交絡の注意**: 列車サイズ・レシピの難しさ・WebKit の間欠失敗（#394）が違う。CI の再実行は別に数え、往復数からは除く。

---

## 8. Owner 判断が要る点（一括。各に推奨）

| ID | 内容 | 推奨 |
|---|---|---|
| E-1 | 列車スペック＋事前検査方式を T24 から使う | 承認 |
| R-RES-1 | Research 非正準の承認単位を「ID＋最大ずれ幅」にする（§3.3） | 承認（正準 0 は必須のまま） |
| E-2 | T24〜T26 の列車割り（§4.2）で L2 がパケットを先行作成する | 承認（実装は各パケットの承認後） |
| E-3 | Gate 自動化の次の段 G-A〜G-F（§3.4）を #815 merge 後に別 PR で進める | G-A・G-B・G-E・G-F を承認、G-C は内容を見てから |
| E-4 | 「PR merge＝claim release」を Session Operations §1 に追記 | 承認（→ **Owner 判断: 不承認**。release 忘れ防止チェックのみ承認） |
| E-5 | 本ブランチの PR 化（ツールと本書） | 指示があれば Draft で作成 |

### Owner 判断の記録（2026-11-10）

E-1 承認（T24 から試験導入）／R-RES-1 条件付き承認（正準順の変化 0 を維持、非正準は ID・段・方向・最大ずれ幅を明示、未知の変更は包括承認しない）／E-2 承認（T24〜T26 のパケットを先行作成 → `TETO_TRAIN-EFFICIENCY_T24-T26_OwnerPackets_2026-11-10.md`）／E-3 条件付き承認（バッチテスト・HV シード・E2E 生成・`hot-files.json` 拡充を #815 merge 後に別 PR。既存 Gate の緩和・置換は禁止。実測スナップショット集約は設計を先行）／E-4 自動 release は不承認、release 忘れ防止チェックのみ承認／E-5 承認（Draft PR #816）。

## 9. Result Report（四項目）

- **完了**: 状態確認（main・#780・#815・claim 23 件）、往復の原因分析、事前検査ツールの実装と過去 3 バッチでの検証、30 品の一括検査と列車割り、レーンと claim 規則、比較計画、往復見積もり。
- **未完了**: HOT の実装（#815 の claim が有効なため対象外）、G-A〜G-F、T24 以降のパケット提示、PR 作成。
- **ブロッカー**: E-1〜E-5 の Owner 判断。HOT は #815 の merge と release まで。
- **次の行動**: Owner の回答後、L2 が T24 のスペックとパケットを提示（1 往復目）。

## 10. 再現手順

```
node tools/content-train/make-spec.mjs --train survey-no-mechanic --no-mechanic --exclude nutella-dessert-pizza,smore-dessert-pizza --out /tmp/survey.spec.json
node tools/content-train/preflight.mjs /tmp/survey.spec.json --out /tmp/survey
node tools/content-train/preflight.mjs docs/reports/data/TETO_TRAIN-EFFICIENCY/b23b-replay.spec.json --out /tmp/b23b        # STOP 2 種
node tools/content-train/preflight.mjs docs/reports/data/TETO_TRAIN-EFFICIENCY/b23b-fixed-replay.spec.json --out /tmp/b23bf  # #815 の 5 ID
```

`b23a-replay` は apple が未出荷だった `07bb706` でのみ再現できる（現在の main では「出荷済み」としてスペック検証が止める）。
