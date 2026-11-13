# 全量追加 — 各ラインの状況と T24 実装前 preflight（Result Report Rev 2、docs のみ）

- Rev 1: 2026-11-12 / **Rev 2: 2026-11-13**（独立監査と Owner 判断を反映）
- 基準: main `03f32e1`（#839 まで取り込み済み。なお T25-R2c／T24-T26 の preflight の実行は `cf0c865` で行い、`03f32e1` ではカタログ・ladder 不変のため結果は同じ。カタログ・ladder は `cf0c865` と同一: レシピ 104 / 食材 122 / ladder 89 step【実測: preflight の出力】）
- Issue: #780 / 範囲: docs のみ（本書、`T25-R2c.*`）。`src/**`・`e2e/**`・HOT・golden・staged・`tools/**` は未編集
- 禁止事項は守っている: Draft 解除・merge・Production ON・共有 Preview 更新・force-push・他セッションの claim 領域の編集はしていない

## 0. Rev 2 の訂正（Rev 1 の記述 → 正しい内容）

| # | Rev 1 の記述 | 訂正 |
|---|---|---|
| 1 | 「`nduja` も staged に既にある」 | **誤り。** `nduja` は staged に**無い**【実測: `stagedIngredients.ts` に `"id": "nduja"` は 0 件】。staged にあるのは `squid` と `cumin`（各 1 件）【実測】 |
| 2 | 「`squid` は二重計上。170 枠にもう 1 食材が要る。Owner への質問 1」 | 事実（squid は staged 済み）は正しいが、**質問は解決済み**。Owner 確定: **170 番目の食材は `nduja`**（Owner-approved reserved、未登録）。計算: 出荷済み 122 + staged 47 + nduja（予約）= 170。「`nutella-spread` の空き枠を squid で補う」という 2026-11-10 の非競合計画の記述が不正確だった（`squid` は元から staged の 47 件の 1 つ） |
| 3 | 「Research 未解消 2 品は ID を特定できない」 | **解決済み**: `jerusalem-mixed-grill-pizza`（key = `cumin`）と `mentaiko-mochi-pizza`（`mentaiko`・`mochi`）。台帳上はどちらも `NEEDS_D2_SOURCE_RESEARCH`【実測: `TETO_CONTENT-MASTER_LEDGER_recipes.md` 27・71 行】 |
| 4 | 「SHOP_PACK（mussel 10→20、pickles 10→20）の Owner 承認の記録は存在するか、実装 PR で示すこと」 | **Owner 承認済み**（パック 20・価格不変）。実装 PR は手書きの承認済み変更として記録する（§4） |
| 5 | 「#833 の P2 2 件は未解消」 | **両方解消済み**（§3）。Rev 1 の時点（HEAD `ae86e78`）では正しかったが、現在は誤り |
| 6 | 「PAN_PROFILE・STEP_ORDER・FRY は未着手」 | **他セッションが着手済み**（§6）: #840、#841、#839（merge 済み）。私は着手しておらず、claim は #780 ではなく #837／#838／#749 側にある |
| 7 | 「T25-R2c の 40 件が 59 件の部分集合であることは実装 PR で最終確認」 | **機械照合を実施済み**（`T25-R2c.reconciliation.md`）。ただし HOLD は維持（§5-B） |
| 8 | 「§3 台帳: 170 枠は未充足（食材 169）で Owner 判断が先」 | 判断は確定（nduja）。台帳側の固定値を更新する作業は §5-A に切り出した |

## 1. 確定事項（Owner、2026-11-13）

- 最終目標: **177 レシピ・170 食材・全 27 調理法／工程候補**（縮小しない）
- 170 番目の食材は `nduja`（Owner-approved reserved・未登録。**staged への追加はしない**。T26 の実装で登録される）
- `squid`・`cumin` は既存の staged。`nutella-spread` は `chocolate` に統合済み
- Research 未解消 2 品: `jerusalem-mixed-grill-pizza`、`mentaiko-mochi-pizza`
- **T25-R2c は 40 ID の個別照合が終わるまで実装 HOLD**。`chicken-tikka-pizza` は下地仕様の衝突が解消するまで HOLD（未承認の実装はしない）
- `mussel`／`pickles` のパック 20・価格不変は承認済み

## 2. 最新状態の確認【実測、2026-11-13】

- main: `03f32e1`（`cf0c865` 以降の変更は #836 e2e helper と #839 FRY F2 前の非 HOT のみ。`src/data` のカタログ・ladder は不変）。`CLAUDE.md`・`docs/PROJECT_HANDOFF.md` は main との差分なし（読み直し済み。HOT 直列、HV Policy、train-kit の手順は Rev 1 時点から変更なし）
- 本ブランチ `claude/teto-pizza-game-full-add-8nbzr7`: Rev 1 の commit（docs のみ）の上に origin/main を**通常 merge**で取り込んだ（rebase・force-push はしていない）
- 進捗台帳（`progress`）: 出荷済み レシピ 104／食材 122。台帳生成器の検査は 5 件 FAIL のまま（台帳が B22 時点のため。§5-A）

### claim 一覧（#780 と、各ラインの Issue）

| claim | 範囲 | 状態 |
|---|---|---|
| R-1 `session_016YrGi37Ao1hchMZc25Zvtn`（#780、6823639362） | `tools/train-kit/**`、`src/trainKit/**`、`expansionBatch*.test.ts` 11 本、`lateCatalog.*.test.ts`、`materialEntitlement.*.test.ts`、`materialShop.test.ts`、`catalogLedger.test.ts`、`composedCatalog*` | 有効（〜11-26）。PR #833 |
| T-FX `session_016YrGi1r2RuC2BKGt8LF145`（#780、6711787241） | `src/data/staged/**`、`TETO_FULL-EXPANSION-177_*` | 有効（〜11-21） |
| STEP_ORDER `codex_step_order_phase1_20261113`（#837） | `src/logic/stepOrder*`、`TETO_STEP-ORDER_PHASE1_Result.md` | 有効（〜11-16）。PR #841 |
| PAN_PROFILE `codex-pan-profile-phase1-20261113`（#838） | `src/logic/panProfile/**`、`doughShapeTarget/**`、`TETO_PAN-PROFILE_PHASE1_*` | 有効（〜11-26）。PR #840 |
| B23-b（#815） | HOT 一式 | release 済み・merge 済み（6794857448） |
| 旧 `b22-implementation`／`b23-implementation`／`b23-prep`（`session_016YrGi1RVoi7RJtRnB3cKLU`） | HOT 一式 | release block が無い旧 claim。実作業は #815 に集約済み。release は保有者または Owner の判断（私は触らない） |

**注意**: 新しい claim は #780 だけでなく各ラインの Issue（#837／#838／#749 ほか）にも出る。claim 検査は #780 のコメントだけでは足りない。#780 は 42 件のまま新規コメントなし【実測】。

## 3. #833（R-1）の P2 の解消状況【実測】

| 指摘 | 状態 |
|---|---|
| P2-1 `mutation.mjs:84`（timeout-only を判定不能に） | **解決済み**（スレッド resolved／outdated）。保有者の返信: `de0ac7e` で `classifyRun` に切り出し、結果を `pass`／`detected`／`timeout` に分け、対照は exit 0 必須、変異側の残存 timeout は比較全体を FAIL にした。`kit.test.mjs` にテスト追加 |
| P2-2 `materialShop.test.ts:35-36`（出荷済み食材の k を導出しない） | **解決済み**。返信: 着地済み食材の k を凍結した手書きの `LANDED_SHOP_CONTRACT` に置換し、後続列車による変更は手書きの `APPROVED_PACK_CHANGES` にしか書けない。`apple` の `minCount` を 2→3 にすると 4 件が失敗する、と記載。変異テストに M21（apple）・M22（marshmallow）を追加 |

- 現在の HEAD `e0a4f41`、Draft。CI: **11 件すべて success**（build、classify、layout-chromium、Layout Contract Gate、WebKit Gate、WebKit 390×844／360×800 各 3 shard）【実測: check runs】
- 上の「解決」は保有者の返信とスレッド状態の読み取りで、**私はコードを検証していない**（他セッションの PR のため編集もしていない）。独立レビューは別途（§8）

## 4. T24〜T26 の実装順と claim 依存（更新）

直列（HOT の競合回避、Owner 方針）: **T24 → T25（R2c）→ T26**。各列車は 1 つの HOT claim を取り、前の列車の merge と claim release の後に次が始める。

| 順 | 列車 | 内容 | 開始条件（すべて） |
|---|---|---|---|
| 0 | #833（R-1） | 導出式の期待値＋変異テスト | Owner の merge 判断。**T24 より先**に merge するかを Owner が決める（`catalogLedger.test.ts`・`expansionBatch*.test.ts`・`materialShop.test.ts` が R-1 の claim と T24 の編集対象で重なる） |
| 1 | T24-R1 | 6 品（peruvian-aji-amarillo、thai-chicken-pizza、frutti-di-mare〔出荷名、staged 名は `-pizzadb`〕、diavola-pizza、south-african-boerewors、peking-duck-pizza）・食材 8（aji-amarillo、chutney、cucumber、peanut-sauce、peking-duck、spicy-salami、squid、sweet-bean-sauce）。Research 非正準 43 ID は承認済み | ① #833 の扱いが決まる（merge 済み、または R-1 保有者と範囲の分担を記録）。② 新しい HOT claim を #780 に取る（`Depends-on #833` を明記）。③ main を再取得し、**preflight を再実行して 43／正準 0 を再確認**。④ mussel 10→20 は `APPROVED_PACK_CHANGES` に承認済みとして手書き（#833 の merge 後の形）。⑤ `src/data/staged/**` は T-FX 保有者へ「出荷品を外す最小追従」を通知 |
| 2 | T25-R2c | 6 品（swedish-kebab-pizza、pizza-salad、banh-mi-pizza、buffalo-cauliflower-pizza、mexican-elote-pizza、pizza-asparagi-limone）・食材 **7**（asparagus、cauliflower、daikon、kebab-sauce、lime、liver-pate、yogurt-sauce。cucumber は T24 で出荷済みになるため外す） | ① T24 の merge と claim release。② **§5-B の HOLD 解除**（追補の再測定＋ Owner／独立監査の確認）。③ 新しい HOT claim。④ `chicken-tikka-pizza` と食材 `chicken-tikka` は含めない（HOLD） |
| 3 | T26-R1 | 2 品（nashville-hot-chicken-pizza、nduja-pizza）・食材 1（**nduja**＝170 番目）。pickles 10→20 は承認済み | ① T25 の merge と claim release。② 新しい HOT claim。③ nduja はこの列車の実装で**カタログに**登録される（staged には追加しない） |

件数の見込み（chicken-tikka 除外、T24→T25-R2c→T26）: レシピ 104 → **118**、食材 122 → **138**（目標 177／170 に対し残 59／32）。このうち HOLD の `chicken-tikka-pizza` と、staged 残の食材は T27 以降。**170 の内訳**: 出荷済み 122 + staged 47 + nduja（T26）= 170【実測＋Owner 確定】。

### 並行して進められる非 HOT 作業（HOT 列とは別 claim・別ファイル）

| 作業 | 場所 | 主な依存 |
|---|---|---|
| 食材 SVG（T25／T26 の食材、未配線） | `src/components/stagedGlyphs/**` ほか新規ファイル | #417 の claim と重なりの確認。専用 SVG は現状 T24〜T26 の食材すべてに無い【実測】。`squid` は候補デザインのみ（#818）。見た目は iPhone HV が要る |
| §5 の A／B／C | docs のみ | 下記 |

## 5. 独立した非 HOT 作業の整理（A／B／C）

3 つとも docs のみ・互いに独立・別 claim で進められる。いずれも HOT に触れない。

### A. B23 台帳同期（nutella-spread 統合・nduja 枠の反映）— **未実施、計画のみ**

- 範囲（claim する新規／既存 docs）: `docs/reports/TETO_CONTENT-MASTER_LEDGER_{recipes,ingredients,methods}.md`、`docs/reports/data/TETO_CONTENT-MASTER_{recipes,ingredients,batches,methods}.csv`・`matrix-map.json`・`tables.md`・`verification.json`・`gen.py.txt`（#810 と同じ 11 ファイル）
- **範囲外（他 claim）**: `tools/train-kit/targets.json` の notes（`squid` が枠を埋めたという誤記は `nduja` に訂正が要る）は **R-1 の claim（`tools/train-kit/**`）の中**。R-1 保有者に依頼するか、#833 の merge 後に行う。私は編集しない
- 反映する内容【実測の差分】: ① 基準を main `03f32e1`（レシピ 104／食材 122）に。② B23 着地の 3 品: `apple-cinnamon-dessert`（B23-a）・`nutella-dessert-pizza`・`smore-dessert-pizza`（B23-b）。③ `nutella-spread` は `chocolate` へ統合（独立食材ではない）。④ matrix の行 `nutella-dessert-pizza-pizzadb-p6` の対応を `matrix-map.json` に追加。⑤ 170 枠: `nduja` を「Owner-approved reserved（未登録、T26 で登録）」と明記し、固定値の検査を「出荷済み 122 + staged 47 + 予約 1 = 170」に
- 注意: 生成器の固定値（`170 − 122 = 48`、`122 + 47 = 169` の検査）の更新は「Owner の更新対象」と明記されている。nduja の確定（2026-11-13）はその根拠になるが、**固定値の変更を台帳 PR で行ってよいか**は Owner が PR で確認する。nduja を staged に足してはならない（禁止事項）ので、検査式は「staged 47 + 予約 1」という形にする
- 現在の生成器 FAIL 5 件は上記で全て解消できる見込み【推論】。実施後に生成器の再実行で出力が commit とバイト単位で一致することを確認する

### B. T25-R2c の 40 ID の個別照合 — **機械照合は完了、HOLD は維持**

- `docs/reports/data/TETO_T24-T26_PREP/T25-R2c.reconciliation.md`: R2c の 40 ID すべてが承認済み R2b 表（59 ID）の行の**部分集合**。R2b に無い ID・stage・方向・ずれは 0。消えた 19 ID はすべて `chicken-tikka-pizza` のみが原因。stage が減った 6 行は承認範囲内の縮小。正準順の変化 0【実測】
- **HOLD 解除に残る条件**: ① 追補（T24 の品が T25 で受ける変化）の再測定。承認済みの「3 行」は R2b／R2a の形の値で、R2c では変わりうる。T24 を出荷した状態での測定が要る（standalone preflight では測れない）。② Owner（または独立監査）が機械照合を個別照合として認めること。私は HOLD を解除しない

### C. Research 未解消 2 品（`jerusalem-mixed-grill-pizza`・`mentaiko-mochi-pizza`）の調査 — **未実施、計画のみ**

- 現状: どちらも `NEEDS_D2_SOURCE_RESEARCH`（原典調査 1 件待ち）、catalog-only（mechanic 不要）の候補【実測: 台帳・progress】。`jerusalem-mixed-grill-pizza` は `cumin` が key 材料。ソースの系統が「その他」で、載っている塗り物の証拠が無いと「ソース未特定」であり、NO_SAUCE にしてはならない（Rejudge Result §初版の誤りの再発防止）
- 出力（予定）: 別名前空間の新規 docs 1〜2 本（原典の取得元・独立再確認の有無・下地の候補・cumin／mentaiko／mochi の扱い・Research 追補の見込み）。【実測】【推論】【未確認】を区別し、原典が取れなければ推測で埋めず UNVERIFIED と報告
- **T27 keema+cumin とは別の調査**: `keema-pizza` は T27 で `cumin` と一緒に再設計（Owner 方針）。`cumin` は `jerusalem-mixed-grill-pizza` の key 材料でもあるので、T27 の cumin の置き場所（ladder の key 材料）と jerusalem の出荷順を**調査の中で一緒に確認**するが、実装は T27 の承認後

## 6. 他ラインの状況（私は未着手・他セッションが実施）

| ライン | 状況【実測】 |
|---|---|
| FRY | #839 は merge 済み（F2 前の非 HOT 拡張: 食材登録・offer 規則・fried look・architecture test、未配線・Production OFF）。進捗台帳では FRY 待ちのレシピ 1 |
| PAN_PROFILE | #840 Draft（Phase 1: 純粋 registry・validator、legacy adapter、staged 6 品の割当案、未配線）。CI 結果と独立レビューは PR 側の記録を参照。**Siciliana のパン深さは Production 配線前に Owner 確定が必要**（Result 記載） |
| STEP_ORDER | #841 Draft（Phase 1: 純粋な優先順序の契約・fail-closed resolver、未配線）。独立レビューは最終 HEAD `aa342009` で findings なし（Issue #837 のコメント） |

PAN_PROFILE／STEP_ORDER の Result Report が書く `全 27 工程候補の目標を維持` は Owner 方針と一致する。いずれも HOT・Recipe schema・save は未変更と記載されている（私は diff を読んだが、ビルド・テストの再実行はしていない）。

## 7. 残る Owner 判断

1. T25-R2c の HOLD 解除（§5-B: 追補の再測定の後、機械照合を個別照合として認めるか）
2. #833 を T24 より先に merge するか（§4-0）
3. 台帳の固定値（170 − 122 = 48 など）の更新を台帳 PR で行ってよいか（§5-A）
4. `tools/train-kit/targets.json` の notes 訂正（`squid` → `nduja`）を R-1 の保有者に依頼するか、#833 の後にするか（§5-A）
5. 旧 `b22/b23` claim の release（保有者または Owner）
6. `chicken-tikka-pizza` の下地仕様（HOLD 解除の条件）、banh-mi の iPhone HV（暫定色 `#af7387`）などは従来どおり

## 8. 検証と独立レビュー

- 実行: `git fetch`・`git merge origin/main`（通常 merge）、`node tools/train-kit/cli.mjs progress`、`tools/content-train/preflight.mjs`（Rev 1）、R2b／R2c の §4 表の機械照合（`T25-R2c.reconciliation.md`）
- GitHub は読み取り（PR 一覧、#833 のスレッドと check runs、#840／#841 の diff、#780／#837／#838 のコメント）と、#780 への報告コメント 1 件のみ
- 独立レビュー: 本書の HEAD を固定して別コンテキストに依頼する。結果は PR／#780 の報告に記載（本書の確定後に追記する場合は、追記 commit を別に積む。履歴の書き換えはしない）
