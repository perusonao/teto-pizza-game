# 全量追加 — 各ラインの状況と T24 実装前 preflight（Result Report、docs のみ）

- 日付: 2026-11-12 / 基準: main `cf0c865`（レシピ 104 / 食材 122 / ladder 89 step【実測: preflight の出力】）
- Issue: #780 / 範囲: 新規 docs 3 ファイルのみ（本書、`T25-R2c.spec.md`、`T25-R2c.preflight.md`）。`src/**`・`e2e/**`・HOT・golden・staged は未編集
- 禁止事項は守っている: Draft 解除・merge・Production ON・共有 Preview 更新はしていない

## 0. 結論

| # | ライン | 結果 |
|---|---|---|
| 1 | #833 の P2 2 件と claim | **2 件とも未解消**（unresolved スレッド 2、いずれも HEAD `ae86e78` に対する指摘）。claim は別セッション。私は編集しない（§1） |
| 2 | T24 の実装前 preflight | **完了。STOP 0**。承認済みの Research 差分（43 ID、正準順の変化 0）と完全一致（§2） |
| 3 | T25/T26 の食材 SVG・配置描画 | **未着手**（§5。理由と次の一手を記載） |
| 4 | Research 未解消 2 品・T27 keema+cumin の調査 | **未着手**（§5） |
| 5 | B23 着地 3 品・nutella-spread 統合・nduja 枠の台帳反映 | **差分の特定まで**。台帳の再生成は**しない**（§3: 170 枠に未充足 1 があり Owner 判断が先） |
| 6 | FRY・PAN_PROFILE・STEP_ORDER の非 HOT 作業 | **未着手**（§5） |

上の「未着手」は、今回のセッションで確認と判断が必要だった 1〜2 と 5 に集中し、3・4・6 は独立の claim と実作業時間が要るため。やったことにはしていない。

## 1. #833（R-1）の状況【実測: GitHub、2026-11-12】

- PR #833 は Draft、HEAD `ae86e780`。branch `claude/train-kit-r1-derived-expectations-780`
- 未解決レビュースレッド 2 件（Codex、いずれも P2）:
  1. `tools/train-kit/mutation.mjs:84` — 変異なしの対照がタイムアウトのみで落ちても `detected:false` が「成功」扱いになり、再試行後も残るタイムアウトが「未検出」に数えられて `lost: []`・終了コード 0 になり得る。対照は終了コード 0 を必須にし、残ったタイムアウトは比較全体を「判定不能」として失敗させるべき、という指摘
  2. `src/logic/materialShop.test.ts:35-36` — 出荷済み食材（例: `apple`）のパック倍率 k を後続列車の `minCount` から自動導出すると、`tools/train-kit/README.md` §3.5 の「既存食材のパック変更は Owner 承認の記録として手で書き、導出しない」と矛盾し、承認なしの変更が通ってしまう。着地時の倍率を保持し、後続列車による変更には独立した承認済みの更新を要求すべき、という指摘
- claim: #780 のコメント 6823639362（`session_016YrGi37Ao1hchMZc25Zvtn`、期限 2026-11-26、`Depends-on #823`）。範囲は `tools/train-kit/**`・`src/trainKit/**`・`src/data/expansionBatch*.test.ts`・`materialShop.test.ts`・`catalogLedger.test.ts` ほか
- **私が直さない理由**: 他セッションが claim を保有する PR であり、他人の PR への push は行わない運用のため。2 件とも指摘の方向は妥当に読める（特に 1 は「検出力の証明」という PR の主張そのものに効く）。保有者への引き継ぎ事項として、指摘の要旨だけを残す
- **波及**: #833 が merge されるまで、列車の実装 PR で `materialShop.test.ts` と `catalogLedger.test.ts` を触る場合は §4 の HOT 直列に加え、#833 の導出ロジックに対する k の扱いが変わりうる。T24 の SHOP_PACK（下記）はこの点で影響を受ける

## 2. T24 実装前 preflight【実測】

手順は `tools/train-kit/README.md` §1 の 0〜1。`node tools/content-train/preflight.mjs <spec> --out <dir>`、基準 main `cf0c865`。

| 列車 | レシピ | 新食材 | verdict | Research（正準 / 非正準 shipped ID） | 承認済みの値 | 判定 |
|---|---:|---:|---|---|---|---|
| T24-R1 | 6 | 8 | NEEDS_OWNER 6 / STOP 0 | 0 / **43** | 43 | 一致 |
| T25-R2b（HOLD 前の版） | 7 | 8 | NEEDS_OWNER 7 / STOP 0 | 0 / **59** | 59 | 一致 |
| **T25-R2c（chicken-tikka 除外・本書で新規）** | **6** | **7** | NEEDS_OWNER 6 / STOP 0 | 0 / **40** | 59 の部分 | 下記 |
| T26-R1 | 2 | 1 | NEEDS_OWNER 2 / STOP 0 | 0 / **9** | 9 | 一致 |

- NEEDS_OWNER の中身は、T24 は 2026-11-10 の承認（Followup §7）で全て回答済みの種類（`RESEARCH_NON_CANONICAL`、重複 Jaccard／one-diff の個別承認、`peking-duck-pizza` の LADDER_KEY_MATERIAL）。**新しい種類の finding は無い**
- **T25-R2c**: `chicken-tikka-pizza` と専用食材 `chicken-tikka`（他レシピは未使用）を R2b から除いただけで、他の材料・数量・配置は変えていない。Research の非正準 ID は 59 → 40（`chicken-tikka-pizza` が単独で寄与していた分が減り、残りは承認済みの部分集合。preflight の記述どおり、非正準の上界は**レシピについて加法的**で、列車を分割しても新しい承認は要らない）。正準順の変化は 0 のまま
  - 40 件が 59 件の部分集合であることは、R2b と R2c のパケット §4 の ID 表の突き合わせで**実装 PR で最終確認**する（本書では件数と加法性までを確認）。表の外が出たら停止
- 内容は Followup §7 の「承認は #819 の具体的な仕様と Research 差分に限定」の範囲内。**HOLD で縮める方向の変更**なので、承認の外の変更は含まない
- 追加で見つかった事項（T24 の実装担当へ）:
  1. **SHOP_PACK**: `mussel` のパック 10→20（`frutti-di-mare` が 3 個を使うことによる）。T26 では `pickles` 10→20（`nashville-hot-chicken-pizza`）。これは**出荷済み食材のパック変更**で、#833 の P2-2 の領域と同じ。Owner 承認の記録（Followup）は存在するか、実装 PR で手書きの期待値として示すこと
  2. **cucumber の二重登録**: R2b／R2c の standalone spec の `newIngredients` に `cucumber` があるが、T24 も `cucumber` を持つ。T24→T25 は直列なので、**T25 の `scaffold` では cucumber を新食材から外す**（T24 で出荷済みになるため）。除くと T25 の新食材は 7（asparagus、cauliflower、daikon、kebab-sauce、lime、liver-pate、yogurt-sauce）
  3. `frutti-di-mare-pizzadb`（staged 名）は出荷時 `frutti-di-mare` に改名する（Followup §7）。spec は staged 名のまま測っているので、`scaffold` 後に id を置換して `apply --dry-run` を通すこと

### 合計（T24 → T25-R2c → T26 のあと）

| | 現在 | T24 | T25-R2c | T26 | 後 | 目標 | 残 |
|---|---:|---:|---:|---:|---:|---:|---:|
| レシピ | 104 | +6 | +6 | +2 | 118 | 177 | 59 |
| 食材 | 122 | +8 | +7 | +1 | 138 | 170 | 32 |

（T25 に chicken-tikka を含める場合は +1 レシピ・+1 食材。HOLD が解けたら R2b に戻す。再測定は不要【R2b で測定済み】だが、base 仕様が変わるなら再測定）

## 3. 台帳の差分（#5）と、Owner 判断が先に要る点

`node tools/train-kit/cli.mjs progress` の結果: 生成器のチェック 5 件が FAIL。台帳（#810、基準 `4c275c2b`、レシピ 101／食材 116）が B23-a/b より前のため。

| 項目 | 台帳の現状 | 実測（main `cf0c865`） |
|---|---|---|
| レシピ | 101 | 104（B23-a `apple-cinnamon-dessert`、B23-b `nutella-dessert-pizza`・`smore-dessert-pizza`） |
| 食材 | 116 | 122（`apple` と late 5 食材） |
| `nutella-spread` | 候補 | `chocolate` に統合して出荷（Owner 維持判断 2026-11-11）。独立の食材ではない |
| matrix 行 `nutella-dessert-pizza-pizzadb-p6` | 台帳は未出荷として扱う | 出荷済み。台帳の対応表（matrix-map）への追加が必要 |

**170 枠に未充足が 1 ある（重要）**:

- 食材の出荷済み 122 ＋ staged 47 ＝ **169**。目標 170 に 1 足りない
- `tools/train-kit/targets.json` と非競合計画（2026-11-10）は「`nutella-spread` が統合されて空いた枠を `squid` に割り当てた（47 + squid = 48）」としている。しかし `squid` は**すでに staged の 47 件に含まれている**【実測: `src/data/staged/testSupport/stagedIngredients.ts:49`、T24 の新食材にも入っている】。つまり「squid で枠を補充した」は二重計上で、実際の 170 には**もう 1 食材**要る
- 同様に `nduja`（T26）、`cumin`（T27 keema 用）も staged に既にある。「nduja 枠」は既存の staged 行（T26）で、新しい枠ではない
- 私は食材を選ばない（食材の追加は Owner 判断）。**Owner への質問は 1 つ**: 170 枠のもう 1 食材を何にするか（候補は staged 外の食材で、依存レシピがあるもの。選定のための候補列挙は、必要なら別 claim で用意する）

台帳（11 ファイル）の再生成は、この 170 枠の決定の後に 1 回で行う。今やると、生成器の固定値（170 − 122 = 48 の staged 候補）が 47 のまま FAIL する状態を台帳に焼き込む。生成器の固定値の更新は Owner の更新対象と明記されている。

## 4. claim と HOT の直列【実測: #780 のコメント】

| claim | 範囲 | 状態 |
|---|---|---|
| R-1（#833）`session_016YrGi37Ao1hchMZc25Zvtn` | `tools/train-kit/**`、`src/trainKit/**`、`expansionBatch*.test.ts` 11 本、`lateCatalog.*.test.ts`、`materialEntitlement.*.test.ts`、`materialShop.test.ts`、`catalogLedger.test.ts`、`composedCatalog*` | 有効（〜11-26）。**T24 の HOT（`catalogLedger.test.ts` ほか）と重なる** |
| T-FX `session_016YrGi1r2RuC2BKGt8LF145` | `src/data/staged/**`、`TETO_FULL-EXPANSION-177_*` | 有効（〜11-21）。出荷品を staged から外す最小追従は従来どおり通知で足りる |
| B23-b（#815） | HOT 一式 | **release 済み・merge 済み**（コメント 6794857448） |
| 旧 `b22-implementation` ／ `b23-implementation` ／ `b23-prep`（`session_016YrGi1RVoi7RJtRnB3cKLU`） | HOT 一式 | release block が無い旧 claim が残っている。実作業は #815 に集約済み。release は保有者または Owner の判断 |

**T24 の HOT 実装に進む前に必要なこと**: ① 新しい HOT claim を取る。② #833 との順序を決める（`catalogLedger.test.ts`・`expansionBatch*.test.ts` が両方の範囲）。#833 が先なら、T24 は #833 の merge 後の main で `sweep` する。T24→T25→T26 は直列（HOT の競合を避けるため）。私は今回 HOT claim を取っていない。

## 5. 未着手のラインと次の一手

| ライン | 状態 | 次の一手 |
|---|---|---|
| T25/T26 の食材 SVG・配置描画 | 未着手。現状 `src/components/stagedGlyphs/` と `dessertGlyphs/` には T24〜T26 の食材（aji-amarillo、chutney、cucumber、peanut-sauce、peking-duck、spicy-salami、squid、sweet-bean-sauce、asparagus、cauliflower、daikon、kebab-sauce、lime、liver-pate、yogurt-sauce、nduja）の専用 SVG が無い【実測: コンポーネントを grep】。`squid` は候補デザインのみ（#818）で未配線 | #417 の claim と `stagedGlyphs/**` の重なりを確認してから、**別 claim**で未配線のまま追加（ガイドの絵の品質確認は iPhone HV が必要）。T25 の `pizza-salad`／`banh-mi-pizza` の絵は T24 の cucumber／carrot 依存 |
| Research 未解消 2 品 | 未着手。どの 2 品かは、#780 と T24-T26 の資料から特定できていない | **質問**: 2 品の ID の指定（推測で埋めない） |
| T27 keema + cumin | 未着手。keema-pizza は staged（mozzarella＋onion）が出荷済みの組み合わせの部分集合で、curry-ketchup＋beef を足すと rendang との距離が問題になる、までが既存調査（ApprovalPacket N-3） | 独立の調査 claim（docs のみ）で、原典と `cumin` の置き場所（jerusalem-mixed-grill-pizza も cumin 依存）を調べる |
| FRY | 未着手。進捗台帳では FRY 待ちのレシピ 1 | 既存の FRY F1 Gate（#749／#751）を尊重。非 HOT の範囲を、claim 確認のうえで決める |
| PAN_PROFILE | 未着手。待ちレシピ 6 | #532 系（天板）の既存 claim を確認 |
| STEP_ORDER | 未着手。待ちレシピ 2 | 同上 |

## 6. Owner への質問（まとめて 2 つ）

1. 170 枠のもう 1 食材（§3）。
2. 「Research 未解消の 2 品」の ID。

## 7. 私が実行したこと

- `git fetch`、`npm ci`（`node_modules` が無かったため）、`tools/train-kit/cli.mjs progress`、`tools/content-train/preflight.mjs`（T24-R1・T25-R2b・T25-R2c・T26-R1）
- GitHub: PR 一覧、#833 のレビュースレッド、#780 のコメントの読み取りのみ。書き込みは本書の commit／push と、#780 への報告コメントだけ
- 再現: `docs/reports/data/TETO_T24-T26_PREP/` の各 `*.spec.md` の JSON ブロックを保存して preflight に渡す
