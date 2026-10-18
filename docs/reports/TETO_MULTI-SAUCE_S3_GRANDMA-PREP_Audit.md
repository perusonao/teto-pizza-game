# グランマピザ（#521 E = S3）レシピ統合準備 — 監査と受け入れ条件

Docs-only。Issue #521。実装は再開しない（`src/**`・レシピ/食材データ・テスト・CSS・save は無変更）。
監査基準: `origin/main` = `3c3c2da`（#547 = F1 まで取り込み済み）、#540 = `124f696`（Draft HOLD、`608e65b` 基準）、#548（F2、OPEN・未マージ）。
触れていないもの: #540（Draft HOLD のまま）、#527、共有 Preview、他セッションのブランチ（#540 / #548 は read-only の fetch のみ）。

## 0. 結論

1. **E は今は着手できない。** 前提の #535（B）・#536（C）・#537（D）・#538（F）が main に未完了（B1 #545 / B2 #546 / F2 #548 は OPEN、C・D は PR なし）。Design Lock §8 は 1〜8 すべて未回答。
2. **pizzadb.jp の原典確認は、この環境からは再び不可能**（本セッションでも `pizzadb.jp` / `www.pizzadb.jp` ともにプロキシが CONNECT を 403 で拒否）。ゆえに「オイルの焼成前後」「天板（四角）形状」は**原典未確認のまま**。リポジトリ内の原典記録で言えるのは §1 の範囲だけ。
3. #540 は **データ・テスト基盤の一部が再利用可能**だが、丸い生地前提の部分（レシピ行・target・Reference・E2E・スクリーンショット・動画）は作り直し（§3）。
4. 受け入れ条件（§4）に、Owner 指定の「四角い形状 **かつ** `pan:"tray"` が必須」「丸い調理ではグランマピザが発見されない」を最上位条件として置いた。

## 1. 原典（pizzadb.jp）確認 — リポジトリ内記録の範囲

| 項目 | リポジトリ内の記録（出典） | 状態 |
|---|---|---|
| 行 ID | `grandma-pizza-pizzadb`、`sauceFamily` トマトソース（Phase 0B 原典サンプル p3、172 matrix） | 記録あり |
| 食材 | tomato-sauce / mozzarella / garlic / olive-oil。4 つとも Phase 0B の canonical 一覧に明記（family 由来ではない） | 記録あり |
| 個数 | 記録なし。#540 の 1 / 1 / 3 / 2 とベイク窓 56–76 は**ゲームの調整値**（出典なし） | 原典外 |
| オイルの焼成前/後 | 記録なし（`postBakeFinish: []`、`LATE_ADDITION` 証跡なし、証跡は `MULTI_SPREAD_LAYER` のみ） | **未確認** |
| 生地 `doughStyle` | `null`（未記録） | **未確認** |
| 実際の天板（四角）形状 | 記録なし。Post-W1 設計文書は "real-world sheet-pan form unevidenced"。Addendum も「四角天板は PIZZA DB の事実ではなく Owner のゲーム設計判断（D1/D6）」と明記 | **未確認** |
| ライブ参照 | 到達不可（403）。未再取得 | **Owner 側確認が必要** |

**表記ルール（Addendum 準拠）**: Owner が実サイトを確認するまで、ドキュメント・UI 文言・レシピ説明のいずれにも「PIZZA DB が四角い天板を記録している」「オイルは焼成前/後」と書かない。レシピ説明は時点を断定しない現行案（「トマトソースとオリーブオイルに、モッツァレラとにんにくをのせた、シンプルな一枚。」）を維持。

## 2. Design Lock §8 の未決事項（すべて未回答。推測で承認しない）

| # | 項目 | 推奨/仮置き（承認ではない） | E をブロックするか |
|---|---|---|---|
| 8-1 | pizzadb.jp ライブ確認（食材不変・オイル位置・**天板形状**） | — | **ブロック**（矛盾があれば保留に戻す） |
| 8-2 | `ladderCredit:false` か credited か | false（calabresa 前例）。未発見の間は step 14 以降の全 pool に残る | ブロック（Research 件数・テスト更新に影響） |
| 8-3 | Hint 5.0 の SAUCE rung が**両ソース**を示すこと | 1 rung が 2 ソースを示す設計 | ブロック（G7 clause 2 の allowlist 化がプライバシー再監査判断） |
| 8-4 | 複数ソース Technique（TQ-3）より先に 2 ソースのレシピを出す | TQ-3 登録なし | ブロック |
| 8-5 | S1 のオイル重ね視覚変更（実装値は `SAUCE_OIL_OVERLAP_ALPHA_FACTOR = 0.3`、#524 マージ済み） | 設計時の目安 0.45 とは異なる実装値 | 実質マージ済みの変更に対する事後承認 |
| 8-6 | id/名称 `grandma-pizza` / グランマピザ | — | ブロック（id 変更は cohort letter のハッシュ順に影響、F 監査 §9 R6） |
| 8-7 | スフィンチョーネ | 保留 | しない |
| 8-8 | 異種 2 ソース候補 | 後続候補のみ | しない |

**#540 側の記録の誤り**: #540 の初回報告・コミット・Result Report に「§8-3 / §8-4 は受理扱い」とあるが**承認はされていない**。Result Report の該当文言は #540 ブランチ上にあり未修正（HOLD のため触れていない）。E 実装時に訂正する。

### 2.1 Addendum §7・F 監査 §10 で未決の追加項目

| # | 項目 | 備考 |
|---|---|---|
| 9 | RESULT の中立な形状文言（天板で未識別の場合の 1 行）の最終コピー | AC-2: ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一であること。F の PR で候補提示 |
| 10 | 内部 technique ID・pan 値名の Owner 承認 | コード上は main に pan 値 `"tray"`（#547、マージ済）、technique id `"tray"`（#548、OPEN）が既に存在。**Owner の明示承認の記録は未確認** |
| 11 | affordance step の再導出（想定 14） | F 監査で 14 と再導出済み（olive-oil=13、garlic=14）。F の実装時と E 実装時に再検証し、違えば報告 |
| 12 | 85% 角到達・均一度閾値の最終値 | Owner 実機 HV で決定（D5） |
| 13 | 完成後の四角生地の再編集可否 | O-7 は「次へ」で確定、それ以前は再編集可。「完成判定後」の扱いは未確定 |
| 14 | Detroit / Sicilian 等を `panShape` の将来利用者とするか | 約束なし |
| 15 | OD-TQ-5/6 なぞかけ例外 | 2026-10-18 に「全プレイヤー共通の一般的説明に限り承認」（F 監査 §0.1-C）。**ただし F 側の 1 行確認は F の最初のコミット前に必要** |
| 16 | 旧 save で Research 候補が技法解放前に出る状態の許容 | 2026-10-18 決定 B で許容済み（承認事項として記録のみ） |

### 2.2 Owner 判断が必要な新規論点（今回の監査で判明）

- **P-1 「発見できない B」の期間**: 丸い調理では grandma を発見できない（O-2 で許容）。一方 Research の cohort は所有のみで決まるため、step 14 以降 `ladderCredit:false` の grandma は天板焼きが使えるようになる前（クレジット済み発見数が affordance step 未満の旧 save 等）にも「？？？ピザ B（にんにく）」として出続ける。F 監査 §2.2 の決定 B で「許容」済みだが、**E で実際に grandma を出す時点で通常プレイでも発生しないこと（registrable ⇒ affordance open、R1/R2）を確認し、発生する場合は Owner に再報告**する。
- **P-2 marinara の A/B 表示**: step 14 で marinara が「？？？ピザ A（にんにく）」、grandma が B（FNV-1a 順: marinara 2348015198 < grandma-pizza 2630931452）。決定 2 で受容済みだが、**id を変更すると A/B が反転する**ため §2 の 8-6 と連動。
- **P-3 Research が単一エントリ直行から候補選択に変わる**: F 監査決定 3 で受容済み。E の PR で約 35 件のテスト（#540 の実測）を**明示的に**更新する（R9）。
- **P-4 カウント/ゴールデン**: 件数固定（57 → 58 レシピ）、Hint 5.0 ゴールデン 2 本の再生成は Owner 承認不要だが、E の PR で差分を項目別に説明すること。

## 3. #540 Draft HOLD の再利用監査（98 ファイル、+1018 / −149）

`124f696` を `608e65b` と比較して分類。#540 のブランチ・PR・共有 Preview には一切変更を加えていない。

### 3.1 そのまま再利用可（論理は丸/四角に依存しない）

| 対象 | 内容 |
|---|---|
| `src/logic/testSupport/requiredSauces.ts` | `requiredSauceIds()` / `MULTI_SAUCE_RECIPE_IDS`（allowlist の名前付き定数。F 監査 §7 条件 (c) に適合） |
| 2 ソース対応フィクスチャ・シム | `testSupport/{discoveryHintEconomySim,hint5EconomySim,researchAttemptSim}.ts`（`.slice(0,1)` 除去、research sim の 2 本目ソース） |
| 2 ソース許可リスト化テスト | `sauceKinds.research.test.ts`、`researchResultRows.test.ts`（+ `researchResultRows.ts` のコメントのみ）、`hints.multiSauce.test.ts`、`multiSauce.guards.test.ts` |
| `data/hints.ts` の grandma ヒント | `empty` / `emptyHint` / `missing["olive-oil"]` / `ready`（ソース工程のみで形状と無関係） |
| `recipeSauceProfiles.ts` | `"grandma-pizza"` 主ソース = tomato-sauce, `PAINT` |
| `orders.ts` / `recipeHintRoles.ts` | key-free マーカー等 |
| Inspector / HV seeds | `dev/DiscoveryProgressionInspector*`、`preview/hvSeeds*` の companion 追加 |

### 3.2 再利用するが再設計が必要

| 対象 | 再設計点 |
|---|---|
| `recipes.ts` grandma 行 | `panShape: "square"` を追加（`Recipe.panShape` は #541 で main に既存）。個数 1/1/3/2・bake 56–76 は四角生地で再調整（Addendum §3「Counts may need re-tuning」）。説明文は時点断定なしのまま |
| `discoveryCatalog.ts` target | `identityDimensions.pan = "tray"` を**必須**に（現在は pan 既定 null = 丸前提）。レシピと target は**同一コミット**で入れる（§4 E-AC8） |
| `referencePizza.ts` `GRANDMA_PIZZA_REFERENCE` | 円の 8 スロット配置（モッツァレラ 3 / ガーリック 2）流用は不可。四角用 Reference（D #537 の領域表現に従う）。ソースは `computeMechanicalSauceReference` の円前提 |
| `cookingProfiles` | 四角では CUT 無効・天板工程（CUT 対象外は #540 で維持済み） |
| DH4 / Hint 5.0 gate 許可リスト | `deductionProduction.gate.test.ts`・`hint5Production.gate.test.ts`。F 監査 §7 は **F が先に pan 軸・technique 要件を許可リスト化**し、E は grandma を追加する分担。#540 の差分は F 後に当て直し、**gate 全体と DH4 sweep を pan 軸状態（○/□）付きで再実行**して件数を Result に記録 |
| 件数・ゴールデン・manifest | `catalogLedger.test.ts`、`hint5.ladders55.json`、`hint5.alphaFamilyOnly.json`、`recipeBatchManifest.ts` / `recipeBatchValidator.ts` は E 最終形で再生成 |
| 約 35 件の Research 件数追従テスト | grandma を「発見済み」扱いにする箇所（`homeDiscoveryRoute`、Pizza Select ルーティング、Dex/Research 系）。**tray 前提で意味が変わるものは機械置換せず個別確認** |

### 3.3 破棄・作り直し

| 対象 | 理由 |
|---|---|
| `e2e/expansion-grandma.spec.ts` | 丸い DOUGH の通しで NEW DISCOVERY を実証しており、**受け入れ条件 E-AC2 の正反対**。四角 + tray の通しと、丸では発見されない否定ケースとして書き直す |
| `docs/reports/screenshots/multi-sauce-s3-grandma-pizza/*`（丸いピザ） | 丸版。D/F 完成後に再撮影 |
| Human Verification 動画 | 丸版。Square Dough 版で再提出（動画は repo にコミットしない） |
| Result Report「検証」節・「§8-3/§8-4 受理扱い」文言 | 誤記載（§2）。E で書き直し |
| Batch manifest の `followedBy` ピン | E の最終形に合わせて再評価 |

### 3.4 実装不要（Square Dough 側の責務）

pan 軸の OBSERVED 化（#547 で main 済み）、天板 Technique（#548 OPEN）、四角生地モデル（#541 済み）、四角描画（D）。

## 4. 受け入れ条件（#521 E）

### 4.1 最上位条件（Owner 指定）

- **E-AC1 四角い形状と `pan:"tray"` の両方が必須**。
  - recipe: `panShape: "square"`。discovery target: `identityDimensions.pan = "tray"`。どちらか一方だけのデータ・コミットは不可。
  - 発見は「pizza.pan === "tray"」かつ材料集合が一致かつ Completion Gate PASS のときのみ（既存 `signatureOfPizza` は明示 `"tray"` のみを tray と読み、`squareDough` から pan を推測しない — #547 `panAxis.test.ts` で固定済み）。
- **E-AC2 丸い調理ではグランマピザは発見されない。**
  - 丸い生地（pan = null / 未設定）で grandma の正確な材料（tomato-sauce 1 / olive-oil 1 / mozzarella 3 / garlic 2、Completion Gate PASS）を使っても `UNIQUE_MATCH` にならず、結果は `ORIGINAL`。Dex 登録・BEST・Pitz・★クレジット・「新発見」表示がいずれも発生しない。
  - 検証面: Free Cooking、Research（target = grandma を含む）、Research の 2 回目以降。Lunch Rush / Dinner / ガイド付きラウンドにも grandma は出ない（`lunchRush:false`、レシピ固定ラウンドの対象外）。
  - **#540 の `e2e/expansion-grandma.spec.ts`（丸で NEW DISCOVERY）は、この条件で否定形に書き換える。**
- **E-AC3 正例**: 四角生地 + `pan:"tray"` + grandma の正確な材料 + Completion Gate PASS ⇒ `UNIQUE_MATCH` ⇒ NEW DISCOVERY。RESULT に天板焼き（技法）が一度だけ現れ、Dex に grandma と技法が載る（F 監査 R3）。
- **E-AC4 O-2 の許容結果**: 四角 + tray で他レシピの材料 ⇒ `ORIGINAL`（target と ○× は影響を受けない、R5）。
- **E-AC5 丸 ↔ 四角のプライバシー対称**: 未識別の ○ 調理と □ 調理の ○× パネル・Trial Notebook・Research Board・Hint シートは、RESULT の技法ステージと O-2 の中立形状文言を除いてバイト一致。pan/天板/技法の語を含まない（R4）。
- **E-AC6 既存 57 レシピの丸挙動は不変**（Scoring・ゴールデン・save 往復）。
- **E-AC7 CUT 無効**（四角）。通常フローとの整合を E2E で確認。
- **E-AC8 先行公開禁止（D3）**: main のどのコミットにも「`pan:"tray"` identity を持たない grandma」が存在しない。レシピ行・target・pan identity は同一コミット/PR で入れる。

### 4.2 前提条件（E 着手ゲート）

1. #535（B）・#536（C）・#537（D、D2 は #518 非干渉）・#538（F、#548 を含む）が main にマージ済み。
2. §2 の Design Lock §8 に対する Owner 回答（少なくとも 8-1〜8-4・8-6）。
3. F の gate 許可リスト化が先にマージされていること（F 監査 §7）。E は grandma の追加のみ。
4. affordance step の再導出（想定 14、ハードコードしない）。
5. R1〜R12（F 監査 §9）を E の PR でも通すこと。特に R1/R2（registrable ⇒ affordance open）、R6（cohort letter は導出値、id を固定ピン）、R9（1 → 2 エントリのルーティング更新を列挙）、R12（2 ソース時の ソース行 2 件、ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH で DOM 同一）。

### 4.3 検証と証跡

- unit / typecheck / lint / build 緑。Playwright は `iphone-390x844` / `iphone-360x800` / `webkit-390x844` / `webkit-360x800`。WebKit 360×800 の既知不安定（#529 / #531）は隠さず、無関係なら無関係と報告。
- UI/ゲームプレイ変更のため **HUMAN-VERIFICATION-POLICY 適用**: 390×844 動画（Owner へ直接、repo に非コミット）+ before/after スクリーンショット（`docs/reports/screenshots/<task-name>/`）。動画シナリオは (a) 丸で grandma 材料 → 発見されない、(b) 四角 + 天板で発見される、(c) 通常フロー回帰。
- Codex レビュー（最新 head）。#540 は未実施（代替の `/code-review` のみ）。
- Preview は専用のものを使用。共有 Preview は更新しない。

## 5. このセッションで確認できたこと / できなかったこと

確認した: Issue #521 本文・コメント 3 件、#540 本文と 98 ファイルの差分範囲、Design Lock 全文（§2/§6/§7/§8）、Addendum（§2/§3/§4B/§5/§7）、F 監査（§0〜§10）、main の `signature.ts` / `panShape.ts` / `panAxis.test.ts`、#548 の technique 差分。

確認できなかった: pizzadb.jp の現行ページ（403）、Epic #532 sub-issue の本文全文（タイトルと状態のみ）、#545/#546/#548 のマージ見込み。

## 6. 次の一手（Owner の指示待ち）

実装は再開しない。Owner が §2 に回答し、#535〜#538 が揃った後、E を「§3.1 の再利用 → §3.2 の再設計 → §4 の受け入れ条件」の順で別 PR として着手する。
