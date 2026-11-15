# Batch 26 調査・設計計画（docs-only）

日付: 2026-11-16  
対象: `perusonao/teto-pizza-game` / Issue #780  
基準: `main` `dba7d7331cad49a9dff068a9a23d79ba1cb37ee4`  
性質: 調査・設計のみ。実装、merge、Production ON、共有 Preview 更新はしない。

## 0. 結論

Batch 26 の第一候補は、既に Owner 承認済みの T26-R1 を fresh main と Batch 25 の予約範囲に照らして維持する。

| 種別 | 候補 | 数 | 判定 |
|---|---|---:|---|
| レシピ | `nashville-hot-chicken-pizza`、`nduja-pizza` | 2 | 候補確定。Batch 25 の6品と重複なし |
| 新食材 | `nduja` | 1 | 候補確定。170番目として Owner 予約済み。staged へ追加しない |
| 新しい調理法／工程 | なし | 0 | Batch 26 の2品は既存工程だけで表現する。27候補の並行ラインは停止・縮小しない |

実装開始条件は、Batch 25 の最終構成と着地 HEAD が確定し、PR #853/#856/#857/#858 の必要な修正が main に反映または明示的に不要化され、T26-R1 の preflight をその main 上で再実行して STOP 0・Research 正準差分 0・承認表外差分 0 を確認すること。今回、その実装は開始しない。

## 1. 読み取った正本と fresh state

- `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`、`tools/train-kit/README.md`。
- 全量台帳: レシピ 177 行、食材 170 行、調理法／工程 27 行。
- main 実装済み: レシピ 110/177、食材 130/170、調理法／工程 7/27。PR #853 の再生成結果と一致する。
- T26 の既存承認記録: `TETO_T24-T26_OwnerDecisions-Followup_2026-11-10.md` §7、`T26-R1.spec.md`、`T26-R1.preflight.md`。
- fresh main は Train Kit の cross-platform 修正 PR #854 を含む。Batch 25 の実装ファイルは変更していない。

## 2. Batch 25 の予約範囲と除外

Batch 25 の最新計画は6レシピ／7新食材。旧 R2b の `chicken-tikka-pizza` / `chicken-tikka` は HOLD のため含めない。`cucumber` は Batch 24 で出荷済みなので新食材に数えない。

予約レシピ:

1. `swedish-kebab-pizza`
2. `pizza-salad`
3. `banh-mi-pizza`
4. `buffalo-cauliflower-pizza`
5. `mexican-elote-pizza`
6. `pizza-asparagi-limone`

予約新食材:

1. `asparagus`
2. `cauliflower`
3. `daikon`
4. `kebab-sauce`
5. `lime`
6. `liver-pate`
7. `yogurt-sauce`

Batch 26 の候補2レシピ／1食材との ID 重複は0。材料の再利用は `chicken`、`honey`、`mozzarella`、`pickles` のみで、Batch 25 の新食材を参照しない。したがって Batch 25 の仕様が着地するまで待つ理由は内容依存ではなく、ladder step、Research 表、生成器、台帳の着地順を固定するためである。

## 3. Batch 26 候補仕様

### 3.1 `nashville-hot-chicken-pizza`

- 材料: `chicken` 2、`honey` 1、`mozzarella` 3、`pickles` 2。
- 新食材なし。`ladderCredit: false`、`ladderStep: null` とする Owner 承認済みの通常レシピ。
- `honey` は焼成前。これは Owner の GAMEPLAY ASSUMPTION であり、焼成後 DRIZZLE に変更しない。
- 新機構なし。既存の sauce/cheese/topping/bake 系だけを使う。
- `pickles` の Shop pack は 10→20、価格不変。既存承認の追従であり、今回変更はしない。

### 3.2 `nduja-pizza`

- 材料: `honey` 1、`mozzarella` 3、`nduja` 2。
- `sausage` 代用は使わず、専用新食材 `nduja` を使う。
- `nduja` は topping / meat。Owner が170番目として予約済みで、staged には足さず、T26実装PRが直接登録する。
- `nduja` が通常 ladder の key material。Shop pack は20の既存計画を維持する。
- 新機構なし。`honey` を DRIZZLE や POST_BAKE に変更しない。

## 4. Research / Ladder / Hint / 調理工程への影響

### Research

- 旧 T26-R1 preflight: 正準 ladder 順で出荷済みレシピの文字変化 0（必須停止条件）。
- 非正準の承認済み本表は9 ID: `bbq-chicken-pizza`、`buffalo-chicken`、`cuban-pizza`、`curry-pizza-japan`、`frango-catupiry`、`jamaican-jerk-chicken-pizza`、`pesto-noci-pizza`、`pesto-pollo`、`reina-pepiada-pizza`。
- T24着地品への承認済み追補は別に2 ID: `peruvian-aji-amarillo` と `thai-chicken-pizza`。いずれも chicken 段で後ろへ最大1、原因は `nashville-hot-chicken-pizza`。fresh mainでは本表9 IDと追補2 ID（重複なし、計11 unique想定）の両方を照合する。
- 主因は `chicken`、`pickles`、`honey`。最大ずれは chicken/pickles が1、`pesto-noci-pizza` の honey が2。
- Batch 25候補はこれら3材料を新規利用しないため、T26起因の集合が増える根拠は見つからない。ただしこれは推論であり、実装前にBatch 25着地HEADで機械再測定する。ID、段、方向、最大ずれが承認表外ならSTOP。

### Ladder

- `nashville-hot-chicken-pizza`: 新食材なしのため key recipe にならない。`ladderCredit: false`。
- `nduja-pizza`: `nduja` の通常 key recipe。正確な step 番号はBatch 25のL-2再判断とlate-order生成器修正の着地後に確定する。
- Batch 25の現測値（ordinary 81、late 97〜100）はOwner L-2再判断待ちなので、T26計画に固定値として転記しない。

### Hint 5.0

- `nashville-hot-chicken-pizza`: `SAUCE → CHEESE → STRUCTURE → SUB_CLASS → SUB_CLASS`。
- `nduja-pizza`: `SAUCE → CHEESE → STRUCTURE → SUB_CLASS`。
- `nduja` は `meat` family なので `other` family到達不能問題は予測されない。
- Batch 25着地後にHint goldenを再生成し、既存梯子の変更が挿入由来だけかを確認する。

### 調理工程

- 両候補とも `mechanics: []`。新しい調理法／工程の実装をBatch 26 content PRへ混ぜない。
- `honey` を焼成前に置く既存Owner判断を維持し、M-DRIZZLEの未完了ラインを迂回して暗黙実装しない。
- 27候補ラインは 7/27（25.9%）のまま。これは全量方針の縮小ではない。M-STEP-ORDER（PR #841）、M-DRIZZLE（#579 / PR #746/#776）、M-STEAM（#726 / PR #738ほか）等の独立ラインを継続し、content列車の件数に混ぜない。

## 5. 進捗率

| 時点 | レシピ | 食材 | 調理法／工程 | 3ライン合計 |
|---|---:|---:|---:|---:|
| fresh main | 110/177 = 62.1% | 130/170 = 76.5% | 7/27 = 25.9% | 247/374 = 66.0% |
| Batch 25計画着地後 | 116/177 = 65.5% | 137/170 = 80.6% | 7/27 = 25.9% | 260/374 = 69.5% |
| Batch 26候補着地後 | 118/177 = 66.7% | 138/170 = 81.2% | 7/27 = 25.9% | 263/374 = 70.3% |

工程ラインは0件追加でも分母27を常に併記し、レシピ／食材だけの完了率を全体完了と呼ばない。

## 6. 既存PR・claim・競合

| PR | HEAD | 状態 | Batch 26との関係 |
|---|---|---|---|
| #853 | `962e86bb2d845a5218dbe97a2ce51d67dea9e363` | Draft/HOLD、CI緑 | 台帳同期とT25 fresh preflight。着地方針の確定待ち |
| #856 | `0f3f9a23bedeef44aaa90dde5589381578fa5e81` | Draft/HOLD | `yogurt-sauce` runtime gate。Batch 25の依存 |
| #857 | `dabfa4c3057daa08c1288f8fbcdf1a15ddd917d4` | Draft/HOLD、CI赤 | Batch 25実装。L-2再判断、I-7統合、full gate待ち |
| #858 | `871616c4a5b529f1f473a6f6127db16320a72dac` | Draft/HOLD、競合 | late-order生成器修正。step確定前の依存候補 |
| #841 | `aa342009f284ada2a2bec275ade6746a01e44db6` | open | 工程ラインM-STEP-ORDER。Batch 26 contentへ取り込まない |

Issue #780 に `codex-batch26-plan-20261116` のclaimを投稿し、本PRの対象をこの文書1ファイルだけに限定した。Batch 25のHOT/実装ファイル、`PROJECT_HANDOFF.md`、台帳生成物はclaimしていない。実装時はTrain Kit `plan`が生成するclaim-filesを使い、上記PRがmerge/releaseされた後に新しい実装claimを別途取得する。

## 7. 依存関係と実装前Gate

1. Claude Code担当のBatch 25最終Gate完了。最終対象が6レシピ／7新食材であることをHEAD上で再確認。
2. #857のCI赤（build、WebKit 390/360 shard 1、WebKit Gate）を原因修正し、期待値緩和・skip・timeout延長なしで通す。
3. L-2再判断、I-7統合、late-order生成器の扱いを確定。#853/#856/#858をmergeするか、#857へ取り込むか、不要化するかをOwnerが決める。
4. Batch 25をOwner承認でmergeし、claim releaseを確認する。Batch 26は未merge PRをbaseにしない。
5. 最新mainからT26-R1 preflightを再実行。STOP 0、正準0、非正準の本表9 ID＋T24追補2 IDについて、ID・段・方向・最大ずれが承認範囲と完全一致し、Hint/duplicate/pack判断も承認範囲内であること。
6. Train Kitの `scaffold → plan → claims` までを新規実装セッションで行い、実装claimを取得する。
7. その後に初めて実装を開始する。今回のDraft PRでは行わない。

## 8. 必要なプロンプト往復回数

- 調査・設計PRの提出まで: **0回**（既存Owner判断で確定できる）。
- Batch 26実装開始前: **最小1回**。Batch 25最終HEAD／merge／claim releaseとL-2の確定結果をまとめて受領する。
- fresh preflightが承認表と一致する場合: 追加0回で実装可能。
- 表外Research差分、step配置の新しい不一致、材料・数量・工程変更が出る場合: Owner判断を1束にまとめて**追加1回**。したがって見積りは **1回、最大2回**。

## 9. Result Report（このPR）

- 完了: 最新main・指示・3台帳・Batch 25予約範囲・T26既存承認・Research/Ladder/Hint/工程影響・既存PR/claimを調査。候補2レシピ／1新食材を選定。
- 未完了: Batch 25最終HEAD上のT26 fresh preflight、実装spec、実装、E2E/HV。意図的に未開始。
- ブロッカー: Batch 25最終Gate、L-2再判断、#857 CI赤、#858の競合／着地方針。
- 次の作業: Batch 25 merge/release後、最新mainでT26-R1 preflightを再実行し、実装専用claimを取得する。
- Preview/HV: docs-onlyのため対象外。Production ON、共有Preview更新、mergeは実施しない。

## 10. 2026-11-16 GitHub再確認・計画同期（docs-only）

本節は作成時点の§0〜§9の歴史的な測定記録を置換しない。後続のOwner判断・実装報告とGitHubのPR状態を区別する。

- OwnerはT25 L-2の96〜101固定案を撤回し、REC-04実測順を採用する方針をPR #853の判断表に記録済み（HEAD `962e86bb2d845a5218dbe97a2ce51d67dea9e363`）。したがって§4/§7/§9の「L-2再判断待ち」は現在の未決事項ではない。T25全6レシピ統合後の再測定・最終Gateは引き続き必要。
- PR #857はリモートHEAD `dabfa4c3057daa08c1288f8fbcdf1a15ddd917d4`、Draft/HOLD。作業報告では#856のランタイム統合・pizza-salad/yogurt-sauce追加と6レシピ/7食材完成がある一方、最新の再構築作業は別コンテナで進行中。GitHub上の#857 HEADには後続の未push修正を含めない。
- PR #856 `0f3f9a23bedeef44aaa90dde5589381578fa5e81` はDraft/HOLD、PR #858 `871616c4a5b529f1f473a6f6127db16320a72dac` はDraft/HOLDでGitHub上のmergeable=false。#858のコードを#857へ取り込む場合、重複適用・衝突を検証する。
- 工程並行PR #841（STEP_ORDER）、#851（PAN adapter）、#834（MID_BAKE Lab）はいずれもopen。#841はready for review、#851/#834はDraft。Batch 26 docs-only計画はこれらのコードやclaimを変更しない。
- Batch 26開始Gateは不変：Batch 25の最終着地とclaim release後、最新mainでT26-R1 fresh preflight、canonical Research 0、承認表9 ID＋T24追補2 ID、STOP 0を再検証する。今回の追記は実装承認・merge承認ではない。
