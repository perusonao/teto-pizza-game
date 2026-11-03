# Expansion Batch 16 — Result Report（ume-shiso-pizza + umeboshi-paste）

Status: **実装・自動検証・Chromium E2E・HV 証跡（390×844 / 360×800）まで完了。Owner の承認と iPhone Safari 実機 HV の前は merge しない。共有 Preview・Production は更新していない。**
Issue #736 / branch `claude/expansion-batch-16-ume-shiso` / 基準 `main` `158e035`（#734、B15 #731 は merge 済み）。`PROJECT_HANDOFF.md` は変更していない（Owner 指示）。
調査・計画（別 branch `claude/expansion-batch-16-research`）: `TETO_EXPANSION-BATCH-16_Research_Result.md` / `…_Scratch-Verification_Result.md` / `…_Implementation-Plan.md`。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達できず、未確認。** 根拠は 172 matrix の行 `ume-shiso-pizza-pizzadb-p14`（比較表 p14、中継 2026-09-22、独立再取得なし）のみ: 梅肉 / 大葉 / モッツァレラ / しらす、ソース欄「その他」（`BASE_SAUCE_UNSPECIFIED`、matrix は `BLOCKED_PRODUCT_DECISION` のまま、変更していない）。次はすべて **GAMEPLAY ASSUMPTION / CALIBRATION（原典の事実ではない。Owner が 2026-11-03 に暫定として確定）**:

- 個数（梅肉ソース 1 / mozzarella 2 / しらす 4 / 大葉 2 ＝ 非ソース 8 ピース）、焼成窓 58–78（汎用窓）、説明文・注文セリフ、梅肉の色 `#b8405a`・emoji 🍑、Reference の座標。
- **全ての材料を焼成前に置く**（原典に投入タイミングの記載なし）。POST_BAKE は使わず、FINISH 段もない（**FINISH の制約は緩めていない**）。
- **B16 限定の例外 2 件**（一般則ではない）: ① ソース欄「その他」を梅肉ソース（`umeboshi-paste`、既存の PAINT）と読むこと。caponata・tsukimi・pesto-genovese・goulash 等の HOLD / 候補は出荷しておらず、その旨をテストで固定。② しらすピザとの Jaccard 0.60。**全体の 0.4 基準は変更していない。**
- 存在しない工程（スパイス・下ごしらえ・炙り・蒸し・後乗せ）は追加していない。

## 1. 内容

| 項目 | 内容 |
|---|---|
| レシピ | `ume-shiso-pizza` 梅しそピザ（evidence `ume-shiso-pizza-pizzadb-p14`）。umeboshi-paste 1（PAINT）→ mozzarella 2 → whitebait 4 → shiso 2（`requiredIngredients` の順は sauce → cheese → toppings）。`ladderCredit`: credited、`lunchRush:false`、key-free Hint（永続）、**CUT なし**、bake 58–78、`baseRewardPitz` 100 |
| 説明文 / 注文 | 「梅のさわやかなソースに、しらすと大葉をそえた、和風の一枚。」/ 「梅のさわやかなピザ、おいしそう！食べてみたいな！」（Owner 確定。投入の時機は書かない） |
| 新食材 | `umeboshi-paste` 梅肉。**sauce（spread）**・色 `#b8405a`（暫定）・emoji 🍑（暫定。G18: 他食材と重複なし）。sauce は topping family を持たないため `ingredientTaxonomy.ts` は変更なし（梅肉は肉ではない: `false_friend_not_meat`）。新 SVG なし |
| ladder | 通常 **step 67 = umeboshi-paste（key `ume-shiso-pizza`）**、T4、星ゲートなし。1–66 は凍結。late の導出番号は +1（68–74）、`LATE_ENTITLEMENT_FLOORS` は**不変** |
| Reference | 8 点リング（RT-01）を `requiredIngredients` の順に連続割当。大葉は leafy herb の `LIGHT_LEAF` |
| 触れていない | 採点・経済・保存形式（schema v2）・Production スイッチ・`lateCatalog.ts`・`ingredientTaxonomy.ts`・UI・炙り / 蒸す（#724–#727・#734）・`PROJECT_HANDOFF.md` |

## 2. 影響（Owner が見るべき点）

- **件数**: recipes 87（Pinsa gate 開）/ 86、credited 77、ingredients 96、toppings 68（不変）、**sauce 13 → 14**、ladder steps 74、第 4 章 50（Pinsa 開）/ 49。Lunch Rush のプール 25 は不変（opt-out は 53 件）。
- **step 67 は 2 レシピ同時**: ume-shiso と、late の `wasabi-beef-pizza`（`LATE_ENTITLEMENT_FLOORS` の soy-sauce / wasabi = 67）が同じ発見数で makeable になる（B14 の step 66 と同型）。保存互換テストで「発見数 67 で umeboshi-paste・soy-sauce・wasabi が同時に解禁、68 は cod-roe・fresh-cream-sauce・nori、66 以前は変更前と同一」を固定。
- **ショップの消費量（Owner 承認済み）**: 大葉 2 枚・しらす 4 匹を使うため、finite の k（その材料を使う recipe の最大個数）が **shiso 1 → 2（在庫 10 → 20）、whitebait 3 → 4（30 → 40）** に変わる（価格 tier は不変）。`materialShop.test` に反映。
- **Research**: 新 step 67 の唯一の新材料が梅肉 → 単独 cohort・**文字なし**: `？？？ピザ（梅肉）`。**全 ladder prefix と 40 通りのランダム購入順で、既存レシピの文字は 1 つも変わらない**（`acceptedLetterShifts` なし）。しらすピザ未発見のときも `？？？ピザ（しらす）` / `？？？ピザ（梅肉）` が別々に出る。
- **Hint 5.0**: `hint5.ladders55.json` は **+203 行・削除 0（挿入のみ）**、`hint5.alphaFamilyOnly.json` は +1 行。DH4 audit JSON は `category` 13 → 14 の **1 行のみ**（B-1 の豆板醤と同じ性質）。key-free 母集団 60 → 61（sauce + cheese 29 → 30）。
- **保存互換**: schema v2 のまま、新 id の追加のみ（`persistence.batch16.test.ts`）。しらすピザの Dex エントリは byte 同一。第 4 章を全達成済みの保存は未達成に戻る（導出表示、データは消えない）。

## 3. 既存テストの追従（既存 assertion を無条件に緩めていない）

事前の scratch 計測（Implementation Plan §3、`50ac26b` 上で ON / OFF とも 59 件・28 ファイル）のとおり、**件数・一覧・golden・manifest・承認例外・B15 自身の pin の追従のみ**。privacy / DH4 / Hint 5.0 / Research / matcher の**識別系 gate は 1 件も修正していない**（`deductionGuard.*` / `deductionProduction.gate` / `hint5Production.gate` / `hint5Taxonomy.gate` は無修正で pass）。

| 種別 | 対応 |
|---|---|
| 件数 ledger | `catalogLedger`・`lateCatalog.bbq`・`catalogShelf`・`largeCatalogFixtures`（recipes / credited / ingredients / sauce / ladder / 第 4 章） |
| ladder / late の導出 | `expansionBatch11.s1` / `12b` / `13` / `14` / `lateCatalog.late4` / `materialEntitlement.batch6` / `lateFloor` / `materialShop`（step 数 66→67、late の導出番号 +1、shiso・whitebait の k。解禁の後退なしを `lateFloor` で固定） |
| 一覧 pin | `recipes.test`・`lunchRush.exclusion`（opt-out 52→53）・`progression.test`・`researchLabels.batch8a`・`discoveryProgressionModel`（step 67 を multi-recipe に追加）・`DiscoveryProgressionInspector`・`cookingProfiles`・`referencePizza.test`（sauce 集合に梅肉） |
| Hint 5.0 / DH4 | `hint5Ladder.baseCompat`（key-free 母集団と partial 件数）・golden 2 件・DH4 audit（`category` の件数） |
| manifest / validator | `B16_BATCH` を追加（`afterRecipeId: "nigerian-suya-pizza"`、key `umeboshi-paste`、`acceptedLetterShifts` なし）。B10–B15 の `followedBy` に ume-shiso を追記。B16 の整合テストを新規追加 |
| 承認例外（**ume-shiso のみ**） | `discoveryCatalog.test`（`BATCH16_PHASE2_BLOCKED_OWNER_APPROVED`）・`matcher.test`（`ownerApproved.add("ume-shiso-pizza-pizzadb-p14")`）。他の BASE_SAUCE_UNSPECIFIED 行は引き続き「出荷されていない」を検査 |
| 自分の B15 pin | `expansionBatch15.test`: 「ordinary ladder の最後は step 66」→ step 66 を位置で固定、「ume-shiso は出荷されていない」の HOLD 一覧から ume-shiso だけを外した（他の 4 件は維持） |

### 新規テスト
`expansionBatch16.test.ts`（27: 構成・sauce は PAINT で NO_SAUCE ではない・credited・key-free・CUT なし・**全て焼成前 / FINISH 段なし**・同一 / 部分 / 上位集合なし・**0.4 以上の近傍は shirasu-pizza（0.60）のみ**と名前つきで固定・matrix 行の blocker 不変・梅肉の色が tomato / 豆板醤 / フロマージュブラン / カレーケチャップ / 生地と ΔE 20 超・emoji の一意・発見・ORIGINAL の各変種・しらすピザは奪われない）、`persistence.batch16.test.ts`（7）、`expansionBatch16.step67.test.ts`（13: 実プール全体の「おしい」・Hint・Research）、`e2e/b16.spec.ts`。

## 4. 差別化・「おしい」・Hint（step 67 の実プール全体で測定）

- 識別集合（sauce を含む）で、完全一致・部分集合・上位集合は **0**（late catalog を含む全 recipe）。最近傍は shirasu-pizza の Jaccard **0.60**（B16 限定の Owner 例外。0.4 以上はこの 1 件のみ）。
- **悪化 0**: ume-shiso の追加で「おしい」分類が変わる試作（キー発見のみ・しらすピザ未発見の 2 状態、近傍の全部分集合 × 5 ソースと pool 全体のランダム 1,500 件）は、**すべて strictly 近づく、または ume-shiso そのもの（発見）**。以前から一致していた試作が崩れることはない。結果にレシピ名・食材名を含まない。
- しらすピザ未発見のとき、しらすピザの近傍（`mozzarella+lemon+shiso+whitebait` ほか 4 パターン）は**前後で完全一致**（同点の d=1 は hint 順で shirasu が優先）。しらすピザ発見済みでは、それらが ume-shiso に**近づくだけ**。
- **Hint の自動ターゲット**: 「キー recipe だけ発見済み」では OPEN_POOL のまま（pool 増加のみ）。「しらすピザだけ未発見」のプレイヤーは、従来「しらすピザを自動ターゲット」だったのが OPEN_POOL になる（step 32 / 58 / 62 / 66 と同じ。Research 対象を自分で選べば従来どおり）。

## 5. 検証（実行 HEAD と結果）

| 検証 | 結果 | 備考 |
|---|---|---|
| 全 Vitest（Pinsa ON） | **11,303 passed・0 failed**（13 skipped / 2 todo、608 files） | 本セッション、コミット `ea83c262` のソース（以降の変更は本書とスクリーンショットのみ） |
| 全 Vitest（Pinsa OFF、`TETO_PINSA_OFF=1`） | **11,295 passed・0 failed**（12 skipped / 2 todo） | 本セッション |
| `tsc -b` / `oxlint` / `npm run build` | エラーなし / exit 0（新規警告 0）/ 成功 | |
| Chromium E2E `e2e/b16.spec.ts`（390×844 / 360×800） | **各 2/2（計 4/4）passed** | Shop NEW（梅肉）→ 購入 → Research（漏えいなし、`？？？ピザ（梅肉）`）→ **梅肉を塗る** → チーズ → しらす 4・大葉 2 → 焼成 → NEW DISCOVERY → 図鑑（schema v2、横スクロールなし、console error なし）。もう 1 本: しらすピザ未発見で Research に 2 エントリ（文字なし、漏えいなし）。本環境は Playwright 既定の chromium の版が合わないため、一時 config（未コミット）で `/opt/pw-browsers/chromium` を使用 |
| WebKit E2E / CI | PR の CI で確認（§7 に追記） | 不要な再実行はしない |
| iPhone 実機 Safari | **未実施**（Owner の HV） | |

## 6. Visual HV 証跡

- **動画（390×844、mp4）**: ①通し約 27 秒 ②Research 一覧約 7 秒 — Owner へ直接提出済み（リポジトリには入れない）。
- **ChatGPT 等がレビューできる静止画**: 動画の 12 コマのコンタクトシート `docs/reports/screenshots/b16/b16-contact-sheet-390x844.png`（コミット済み）と、個別スクリーンショット（各 390×844 / 360×800）: ショップ NEW（梅肉）、Research エントリ、ソーストレイ（梅肉チップ）、梅肉を塗った生地、具材トレイ、盛り付け、NEW RECIPE、図鑑、Research 2 エントリ。新規レシピのため before はなし。
- 実機（iPhone Safari）で Owner が確認する点: ① 梅肉ソースの色（`#b8405a` 付近。生地が全体的に赤みの強いピンクになる。トマト・豆板醤との識別、**焼成後の色は未測定**）② 🍑 の表示（ソーストレイ・ショップ）③ しらす 4・大葉 2 の盛り付けが 8 スロットに収まるか（大葉は生地上で小さく見える）④ ソース工程で「選ばずに次へ」にならないこと ⑤ Research に recipe 名が出ないこと ⑥ 横スクロールなし。

## 7. CI・Codex レビュー（PR #737）

| head | 結果 |
|---|---|
| `3e5712d`（初回） | **WebKit shard 2/3 が両 viewport（360×800・390×844）で同一の 1 件失敗**（集約の WebKit Gate も）。ほかの shard・`layout-chromium`・`Layout Contract Gate`・`classify` は success（233 / 227 passed）。失敗したのは `e2e/expansion-batch8b.spec.ts:104`（shirasu-pizza の Shop NEW）で、`shiso` の行に「10ピザ分（10個）」を期待し実際は「（20個）」。**原因は本 PR の見落とし（flake ではない）**: Owner 承認済みの消費量の変更で shiso の k が 1→2、whitebait が 3→4 になり、ショップ表示（在庫 20 / 40）が変わった。単体テスト（`materialShop.test`）は更新済みだったが、この E2E の期待値が未更新だった |
| `c63d4e9`（修正後） | 期待値のみを「10ピザ分（20個）」「10ピザ分（40個）」に更新（assertion の対象・testid は不変）。**全 11 チェック success**（build / classify / layout-chromium / WebKit 6 shard / WebKit Gate / Layout Contract Gate）。mergeable は clean。再実行（rerun）は 1 度もしていない（push で新規実行） |

- 本環境の限界: ローカル Chromium では `expansion-batch8b` が、何も変更していない main でも後段のコンソール 404（sandbox 依存）で落ちる。そのため E2E の修正は CI の WebKit で確認した。
- **Codex レビュー**: head `3e5712d`（PR 作成時の自動レビュー）で完了・**指摘 0 件**。Owner 判断により最新 head `2809ecfc66d078e67f62254fa56b42ee084862ff` へ `@codex review` を依頼し（2026-11-03 12:04Z）、**2026-11-03 12:06Z に完了: 「Didn't find any major issues」（Reviewed commit `2809ecfc66`、指摘 0 件・未解決スレッド 0 件）**。
- review thread は 0 件。

## 7.1 最終 HV 事前評価（画像・動画。対象 head `2809ecfc66`、Owner 判断: merge は HOLD・共有 Preview は更新しない）

**証跡とコードの一致**: アプリのソース（`src/`）は、HV 動画・スクリーンショットを撮ったコミット `ea83c262` から `2809ecf` まで**1 行も変わっていない**（その後の差分は `e2e/expansion-batch8b.spec.ts` の期待値と docs のみ）。したがって §6 の既存の動画・画像は最新コードと一致する。追加撮影（本節）も同じコードで行った。**共有 Preview・Production・実機は未使用**（Chromium の 390×844 / 360×800 のみ）。

**追加で撮った画像**（`docs/reports/screenshots/b16-hv/`、各 390×844 / 360×800。トマトソース（マルゲリータ）と梅肉（梅しそ）を同じ生地・同じ塗りの輪で比較）:
- `hv16-review-sheet-<viewport>.png`: 梅しその 8 画面（ショップ NEW・Research・ソーストレイ・塗った生地・盛り付け・焼成中・NEW DISCOVERY・図鑑）を 1 枚に。
- `compare-overview-<viewport>.png`（塗った直後 / 焼成中）、`compare-tomato-vs-ume-{painted,bake-mid,baked-result}-<viewport>.png`（左 = トマト、右 = 梅肉）、`ume-chip-zoom-*`（🍑 のトレイ chip）、`shop-ume-*`、`ume-tray-sauce-page1-*`、個別のステージ画像。

**1. 梅肉の色（焼成前後）とトマトソースとの識別性**（ステージ画像のソース帯の中央値色で測定。CIE76 ΔE）

| 状態 | トマト（RGB） | 梅肉（RGB） | ΔE（390×844 / 360×800） |
|---|---|---|---|
| 塗った直後（焼成前） | (214,117,86) | (205,119,112) | 15.5 / 16.1 |
| 焼成開始時 | (235,140,123) | (223,142,149) | 15.6 / 14.4 |
| 焼成中（針が窓の中央） | (217,92,64) | (205,99,95) | 18.9 / 20.9 |
| 焼成後（結果画面のサムネイル） | (218,109,65) | (212,137,89) | 17.7 / 17.7 |

- 食材の色そのもの（`#b8405a` vs `#c73b2e`）は ΔE 29 だが、**生地の上に半透明で重なるため、実際に見える差は 15〜21 に縮む。**
- **評価**: 並べて比べればはっきり違う（梅肉は赤紫がかったピンク、トマトは橙がかった赤）。ただし**焼成が進むと梅肉はサーモンピンク〜橙寄りに変わり、トマトに近づく**（焼成後 ΔE 17.7）。単独で見ると「薄いトマトソース」に読めるおそれがある。**識別は可能だが余裕は小さい** — 実機の明るさ・屋外では差がさらに小さく見える可能性。
- **ソースコードの変更案（Owner 判断。まだ変更していない）**: 梅肉の色を、より青み（赤紫）寄りで彩度のある方向に寄せる（例: `#a83270` 付近。名目色の ΔE を上げ、焼成後も橙に寄りにくくする）。変更するなら `ingredients.ts` の色 1 行（既存テストは名目色の ΔE > 20 を見るだけで影響なし）と、スクリーンショットの撮り直しだけ。実機 HV の結果を見てから決める想定。

**2. 🍑 emoji の分かりやすさ**
- ショップ・ソーストレイ・図鑑のタグ（「梅肉」）に表示される。**桃に見える**（梅の実ではない）。すべて「梅肉」の文字ラベルと並ぶので誤読はしにくいが、絵だけでは「梅」と分からない。
- 代替案（Owner 判断）: 🌸（梅の花を連想）、または専用アイコン。暫定のまま実機で見てから確定するのが現実的。

**3. スクロール・重なり・タップ・Research・発見演出**
| 項目 | 結果 |
|---|---|
| 横スクロール | **なし**（E2E で毎画面 assert。両 viewport） |
| 重なり・はみ出し | 目視で問題なし（ショップ行・ソーストレイ・盛り付け・結果画面・図鑑。360×800 も同様） |
| タップ領域 | ショップの「仕入れる」74×44 px、ソース chip の梅肉 118×64（390）/ 108×64（360）px — いずれも十分 |
| ソーストレイ | 梅肉は **2 ページ目（2/2）の末尾**（マスタードの隣）。新しいソースはページ送りが要る（既存の仕様。発見のしやすさの注意点） |
| 盛り付け | しらす 4・大葉 2・モッツァレラ 2 が 8 スロットに収まる。しらす・大葉は小さい（大葉は特に小さく、生地の上で見落としやすい） |
| ソース塗りの案内輪 | Research では塗りの目安の点線の輪が出ない（ガイドありのマルゲリータとは違う。モード差で、本 PR の変更ではない） |
| Research | `？？？ピザ（梅肉）`（文字なし、recipe 名の漏えいなし）。しらすピザ未発見時も 2 エントリが別々に出る |
| 発見演出 | 「NEW PIZZA! 梅しそピザを発見しました！」「図鑑 No.42（第 4 章 50/50）」★3・+133 Pitz。進行・遷移に問題なし |
| console error | なし（E2E 全件） |

**4. 未実施**: iPhone Safari 実機、共有 Preview。焼成後の色は上の Chromium のレンダリング上の値で、実機（Safari の色再現・屋外の明るさ）とは異なり得る。

## 8. Owner に必要な確認事項

1. **iPhone Safari 実機 HV** と merge 可否（HV の結果は Owner の言葉で記録する）。
2. 共有 Preview の更新（Owner 承認が前提。今回は更新していない）。
3. 梅肉の色・emoji は暫定（実機で確定）。焼成後の見え方が未測定。
4. 「しらすピザだけ未発見」のプレイヤーで、しらすピザの自動ターゲットが OPEN_POOL になること（§4）。
5. ショップの消費量変更（shiso 1→2、whitebait 3→4。Owner 承認済み）が、既存プレイヤーのショップ表示（在庫の上限）に出ること。
6. 原典確認: pizzadb.jp をセッションのネットワーク許可に追加して個別ページを確認するか（現状は未確認のまま）。
7. 先行の持ち越し: #706 / #707 / #708 が merge 済みなのに open のまま、`lateCatalog.ts` のコメント（「Production は false」）と値（`true`）の食い違い、`PROJECT_HANDOFF.md` の B13–B15 の記述（Owner 指示により今回も未変更）。

## 9. 実施しなかったこと

`PROJECT_HANDOFF.md`・`App.css`・`GameScreen.tsx`・`gameReducer.ts`・`ingredientTaxonomy.ts`・`lateCatalog.ts`・UI・保存仕様の変更、FINISH の制約・privacy gate・グローバルな Jaccard 基準の変更、他の HOLD recipe（caponata・tsukimi・pesto-genovese ほか）の追加、共有 Preview・Production の更新、merge、不要な CI 再実行、Monitor 作成、pizzadb.jp の取得（到達不可）、他の PR・Issue（#726・#727・#733 ほか）のファイル変更。
