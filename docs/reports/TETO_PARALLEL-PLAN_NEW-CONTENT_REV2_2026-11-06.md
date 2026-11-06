# 並列開発計画 Rev 2 — 実装優先への再編（docs-only・Owner 承認待ち）

**種類:** docs-only（`src/`・`e2e/`・CSS・SVG・テスト無変更）。claim の解除・変更、既存 PR への push、merge、Production ON、共有 Preview 更新、Batch 19 の実装は**していません**。
**基準:** `origin/main` `3a41bb6`（#769）。2026-11-06。Rev 1 = `TETO_PARALLEL-PLAN_NEW-CONTENT_2026-11-06.md`。
**限界:** 件数・Jaccard・Research ラベル・Hint は未実測（マトリクスの静的抽出）。open Issue 全件の claim は未確認（確認した範囲を各節に明記）。

## 0. Rev 1 からの訂正

| # | Rev 1 の記述 | 訂正 |
|---|---|---|
| 1 | Prep Rev4／R2 決定の main 取り込みが必要（X3） | **#769 で main に取り込み済み**（Prep は Rev 5）。R2 §2.4 に D 番号対応表もあり X1・X4 も解消 |
| 2 | S3 ハーブ 4 種は「すぐ着手可」 | **一部のみ可**。4 食材は `ingredients.ts` に既存行があり、`pieceVisual` の付与は `ingredients.ts` の編集＝**#748 の未解放 claim と重なる**（§5） |
| 3 | S5 は claim 保有セッションが継続 | 保有セッション（`session_013m8Cb49gBq9AcNooPFsNsB`）は **IDLE・完了**、「F2 以降は #738 merge と eggplant 絵まで HOLD」と自己申告。継続は §7 |
| 4 | A2「新食材 0」の約 9 レシピ | 9 件のうち、`唐辛子`→`chili-oil`、`ひき肉`→`ground-beef` が**カタログに存在しない**ものがある。**「既存食材だけ」ではなく解決先の決定が要る**（§4） |

## 1. 作成した Issue（重複確認済み。claim は投稿していない）

| 枠 | Issue | 重複確認 |
|---|---|---|
| S2 候補プール再構築（docs-only） | **https://github.com/perusonao/teto-pizza-game/issues/772** | open Issue を検索。近い #527・#577・#216 は個別バッチ／別機構 |
| S6 新工程候補比較（docs-only） | **https://github.com/perusonao/teto-pizza-game/issues/773** | 近い #216・#294・#611・#577 は個別機構／古い一般設計。#749 の監査は「STEAM の次」に限定 |
| Batch 19 実装（未着手・GO 待ち） | **https://github.com/perusonao/teto-pizza-game/issues/774** | "Batch 19" の open Issue なし（#748 は Batch 18） |

#748 の claim（`session_013m8Cb66Bu5f1XXHC2xCiLL`、期限 2026-11-19、解放投稿なし）は**触っていません**。解放依頼のコメント（6687040558）は別セッションが投稿済みで、応答はまだありません（保有セッションは IDLE）。

## 2. 新食材 8 種 — 依存・SVG・工程

「必要な工程」は新しい調理工程（BAKE 前の通常配置で足りない場合）。SVG は `IngredientGlyph.tsx`（描画 lane）の専用絵の要否。型（`DedicatedIngredientVisual`）に既存の絵は 35 種前後あり、**絵文字のままの食材は多い**（`pieceVisual` なし）。

| # | 食材 | 解放するレシピ（matrix） | 必要 SVG | 必要な工程 | 状態・注意 |
|---|---|---|---|---|---|
| 1 | **burrata** | pesto-burrata（READY）、crudaiola（READY）、burrata-pizza（READY、crudaiola と Jaccard 0.429 で近傍 5 件目→再判断） | **案 C 確定**（上が裂けクリームが溢れる玉）。候補 SVG は branch `claude/burrata-preflight-docs-8auzii`（`d39a680`）。※ #769 は文書のみで SVG は main に無い | なし（全て焼成前、MULTI_SPREAD は既存機構） | **#774 で追跡**。2 レシピ承認済み |
| 2 | **honey** | hot-honey-pepperoni（READY_WITH_REVIEW）、pesto-noci（READY、walnut 併用）、nduja・nashville（ソース未特定で BLOCKED） | 専用 SVG が要る（粘性液体の見せ方が未設計。`DRIZZLE` と共通化の可能性） | hot-honey-pepperoni は matrix が **post_bake（`repo_inference`）**＝後乗せ／DRIZZLE 候補。pesto-noci は pesto＋honey の 2 層（焼成前） | **工程の解釈が未確定**（matrix のコメントのとおり推論止まり）。S2/S6 で確定 |
| 3 | **walnut** | pesto-noci（honey・gorgonzola〔既存〕と併用）、speck-e-brie（brie 併用） | 割れた殻つき粒またはかけら。専用 SVG 推奨（小粒・色が既存の nut/seed 系と近い） | なし | honey とセットが効率的 |
| 4 | **brie** | speck-e-brie（walnut・prosciutto-crudo・mozzarella、ソース「チーズ」＝ソース層なし、COMPOSITION_CONFLICT_CANDIDATE＝既存との比較で DIVERGENT） | 白系チーズ（mozzarella／ricotta／feta／burrata）と識別できる輪郭が必須（#733 方式の識別テスト） | なし | **白系チーズが過密**。識別 HV が最大のリスク |
| 5 | **yakiniku-sauce** | yakiniku-pizza（READY：beef・mozzarella・onion・white-sesame〔既存〕） | ソースは PAINT（絵不要）。トレイ表示のみ | **PREP_STEP（牛肉を炒める）**＝Cooking Prep Phase 1（#696 系・実装は **Owner 未承認**、本番 OFF 想定） | 工程が先。Prep の実装承認なしでは遊べない |
| 6 | **spicy-salami**（案：既存 pepperoni で代用可か要判断） | diavola（`唐辛子` 未解決＋構成競合 INDETERMINATE） | salami 系の専用絵（pepperoni との識別） | なし | pepperoni と近く**重複リスク**。Owner が「別食材にする必然性」を判断 |
| 7 | **squid** | frutti-di-mare（clam・mussel・shrimp・squid、構成競合 DIVERGENT） | イカ輪切りの専用 SVG（seafood 系の識別） | 蒸す（clam／mussel）と揃えるなら STEAM 連動（任意） | 競合の解消が先 |
| 8 | **cheddar** | breakfast-pizza（`ホワイトソース` 未解決＋出荷済み breakfast-pizza と競合） | チェダーの色・形（mozzarella 等と識別） | なし | **出荷済みレシピと競合（COMPOSITION_CONFLICT_SHIPPED）**。重複なら不可 |

**確実度（正直な評価）:** 食材 1（burrata）は承認済み。2〜4（honey／walnut／brie）は READY レシピが付くが工程・識別の確認が要る。5 は工程待ち。6〜8 は**レシピ側が BLOCKED／競合**で、Owner が解決先を決めるまで食材を足す意味が薄い。**8 種を満たすために 6〜8 を先に入れることは勧めません**（食材だけ増えてレシピが付かない）。代替の第 2 候補（要検討）: `chili-oil`（baiana・de-cancha・keema・diavola の `唐辛子` 解決）、`ground-beef`（chilena・keema・taco）、`caciocavallo`（scacciata、ENCLOSE が要る）、`kimchi`（PREP_STEP）、`truffle`（LATE_ADDITION）。

**食材とレシピは別 PR・別タスク**（食材 PR が先、レシピ PR は後）。

## 3. 既存食材（または既存食材への写像）で追加できる候補

S2（#772）が再照合・Jaccard 実測を行うまで「候補」。A1: tsukimi・bianca・sfincione・trenton（マトリクスの READY／READY_WITH_REVIEW、新食材 0）、caponata（#706、HOLD）。

## 4. ソース未特定ほか 9 レシピ — 根拠・候補ソース・Research 影響

表の「Research 影響」は**静的な見立て**です。実測は S2／各 Batch で `researchLabelAudit` を再実行して確定（B15 19・B16 4・B17 18・B18 39 の前例どおり、非正準順では既存ラベルが変わり得て、1 件ずつの Owner 承認が必要）。

| # | レシピ（matrix id） | 構成（canonical） | ブロッカー（根拠） | 候補ソース／解決案 | Research ラベルへの影響の見立て |
|---|---|---|---|---|---|
| 1 | bulgogi-pizza | beef・mozzarella・onion・white-sesame | `BASE_SAUCE_UNSPECIFIED`（甘辛だれ） | 新ソース `bulgogi-sauce`（PAINT）または yakiniku-sauce と共用。#578 の New Sauces 系の作法 | 新ソースが cohort key になれば**新ラベル 1 件**。bulgogi は beef・onion で近い既存と Jaccard 要測定 |
| 2 | teriyaki-chicken-pizza | chicken・mayo・nori・onion | `BASE_SAUCE_UNSPECIFIED`（甘辛だれ）＋構成競合 INDETERMINATE、post_bake（mayo・nori＝`catalog_design_tag`） | 新ソース `teriyaki-sauce`（PAINT）。mayo・nori の後乗せは late カタログ OFF のため**焼成前配置に変えるか Owner 判断** | mayo は B13 で既存。nori は late 側＝**Pinsa／late 開閉の両方で測定** |
| 3 | keema-pizza | mozzarella・onion（＋ひき肉・青唐辛子が未解決） | `BASE_SAUCE_UNSPECIFIED`（カレー）、`ひき肉`→ground-beef、`青唐辛子`→chili-oil（どちらも**未登録**） | `curry-ketchup`（B18 で既存。Owner 承認済みの代用）＋ ground-beef を新食材にするか beef で代用 | curry-ketchup 系は baingan と近い→ **Jaccard 0.43 の B18 例外と同系統の判断**が要る |
| 4 | philly-cheesesteak-pizza | beef・green-pepper・onion | `チーズソース`→mozzarella（曖昧） | 「チーズソース」を mozzarella 層で置くか、cheese-sauce を新ソースにするか。**beef・green-pepper は #760 で絵が刷新済み**（識別 OK） | 既存の beef／pepper 系と近い。ソースなし＝NO_SAUCE の例外（B13 方式）が要る |
| 5 | pizza-chilena | black-olive・egg・mozzarella・onion（＋ひき肉） | `ひき肉`→ground-beef（未登録） | ground-beef 新食材、または beef で代用（原典から離れる＝要承認） | 新食材なら**新ラベル**。代用なら既存レシピとの Jaccard |
| 6 | pizza-baiana | egg・mozzarella・onion・sausage | `唐辛子`→chili-oil（未登録、曖昧） | chili-oil を新食材（spice）にする／唐辛子を省く（要承認） | sausage・egg の既存と近い。**Jaccard 要測定** |
| 7 | pizza-de-cancha | garlic・olive-oil・oregano（＋唐辛子） | `唐辛子`→chili-oil、DOUGH_VARIANT＋MULTI_SPREAD | chili-oil＋生地バリエーション（Pinsa 方式の再利用か別生地か） | 材料 4 点と少なく、**既存の素材集合と部分集合になる恐れ**（部分集合は不可）。S2 で最優先に測定 |
| 8 | hokkaido-cheese-pizza | bacon・corn・potato（＋チーズ） | `チーズ`→mozzarella（曖昧）、ソース不明（ソースなし） | mozzarella で確定し NO_SAUCE 例外とするか、新チーズ（北海道産の具体名が原典で不明）を足すか | **既存の potato／corn 系（potato-mayo 等）との近さ**を要測定 |
| 9 | pizza-zucchine-menta | lemon・mint・mozzarella・olive-oil・ricotta・zucchini | `MECHANIC_INTERPRETATION`＝LATE_ADDITION（`repo_inference` のみ）。ソースは olive-oil（ノンソース） | 全食材を焼成前に置く解釈か、late（OFF）に載せるか。**原典の記述が弱い** | mint・lemon は既存。late に入れるなら Pinsa 開閉の両方で測定。**誤った工程解釈で出荷しない** |

**共通の論点（Owner が 1 つ決めれば複数に効く）:** (a) 「甘辛だれ」系ソースを 1 つ作って bulgogi／teriyaki／yakiniku で共有するか、それぞれか。(b) `chili-oil`・`ground-beef` を新食材として入れるか、既存で代用するか。(c) ソース不明レシピを NO_SAUCE の例外（B13 の前例）で受けるか。

## 5. S3（ハーブ 4 種）Fresh Audit — 競合と着手可能範囲

| 対象 | 状態（確認方法） |
|---|---|
| `ingredients.ts` の 4 行 | `rosemary`・`oregano`・`spinach`・`artichoke` は**既存**（`pieceVisual` なし）。付与は `ingredients.ts` を編集 → **#748 の claim（`session_013m8Cb66Bu5f1XXHC2xCiLL`、〜11-19、解放なし）と重なる**。**今は不可** |
| `IngredientGlyph.tsx` | 他 claim なし（#758 は release 済み、#733・#760 は merge 済み、#749 FRY は `fry*` のみ、#738 は `PizzaStage.tsx` ほか＝`IngredientGlyph.tsx`・`App.css`・`ingredients.ts` を触らないと PR 本文に明記）。**編集可能（ただし単独 PR の範囲）** |
| `App.css` | #738 は触れない（PR 本文）。#468（open、モッツァレラ溶け）の変更ファイルは先頭 10 件が docs のため `App.css` を触るか**未確認** |
| #753／#751 | docs のみ（Style Lock V2 §12、eggplant、Fry state）。S3 の docs 更新は #753 の merge 後（#770 R1/R2） |
| 時期 | R2 決定: #759・#760・#765 は merge 済み。**残るのは claim の整理と Owner の GO**（R2 §2.2） |

**着手可能な範囲（今日）:** (1) 4 つの SVG コンポーネントとその単体テスト（未配線・`ingredients.ts` 非接触）を新規ブランチで作る、(2) 実寸の before/after モックと識別テスト仕様（docs・画像）。**不可:** `pieceVisual` の配線（`ingredients.ts`）、`App.css` の個別規則、merge。#748 claim の解放後に配線の 1 コミットを足す。

## 6. S4 — #738 STEAM Final Gate の実装担当（役割分担）

**#738 の現状（PR 取得、2026-11-06）:** open・非 Draft・`mergeable_state: clean`、head `2ac98201`、base `49e2add`（現 main は `3a41bb6` で進んでいる）。変更 110 ファイル。HOT（`PizzaStage.tsx` ほか）は追加のみ。**Owner の iPhone Safari HV と merge 承認は未**。別セッション（`session_013m8Cb3UeRV2Cw1f2vLVaHm`、IDLE・BLOCKED）が、「#753 は #738 と main の両方にクリーンに入る」「#738 の main 取り込み push・Codex 依頼・共有 Preview 配備と復元・#726 claim 更新は Owner 承認待ち」と報告している。H11（24px の貝が実寸で区別しにくい）は別セッションの検証で NEEDS FIX。

| 役割 | 担当 | できること／できないこと |
|---|---|---|
| **claim 保有者**（コード著者） | `session_013m8Cb5GjssgoY27cSCQ3jk`（#726 の claim、〜11-10、IDLE） | #738 のブランチ `claude/cooking-steam-s3-ui` への**唯一の push 権**。H11 修正、main 取り込み。**claim の更新は保有者のみ**（期限 11-10 が迫っている） |
| **S4（本計画）** | 新規セッション | **Final Gate 実行役**: (a) #738 を最新 main と**別の使い捨てブランチ上で**マージして、vitest／tsc／build／Chromium E2E／WebKit を実測（#738 には push しない）、(b) H11 の修正案を差分として docs に提示、(c) iPhone HV 手順（#747）の更新案、(d) Owner 判断資料（merge 順＝#753→#738、共有 Preview の配備と復元手順）。**#738 へは Owner の明示承認＋保有者の合意なしに push しない**。claim は変更しない |
| **`3UeRV`（Cooking Methods Fresh Audit）** | 既存セッション | 上の承認待ち 4 項目の依頼元。S4 と重複しないよう、S4 は (a)〜(d) のみ |

**Final Gate 前提:** Owner の iPhone HV（A/B・H11）、Codex、WebKit all shards、claim 更新。**Production ON・共有 Preview 更新は別承認。**
**#755 系（V1〜V3、#756/#757/#762/#763）:** 別枠。#738 の Final Gate には含めない（`src/main.tsx` の統合順は #755 の OD-V3-7 に従う）。

## 7. S5 — FRY F2 の継続可否

| 項目 | 結果 |
|---|---|
| claim 保有 | `session_013m8Cb49gBq9AcNooPFsNsB`（#749、〜2026-11-18）。**IDLE・完了**、F0/F1 は #750 で merge 済み |
| 自己申告 | 「F2 以降は #738 merge と eggplant の絵まで HOLD」 |
| eggplant の絵 | #753（docs）で A 案確定、**G2/G3（実装）は未着手**。`pieceVisual` は `ingredients.ts`（#748 claim）と `IngredientGlyph.tsx` を編集する |
| 継続可否 | **今は継続不可（HOLD の条件が未成立）**。条件: (1) #738 merge、(2) eggplant の絵（S3 → #748 の解放後）、(3) Owner の F2 GO。条件成立後は**保有セッションの再開**が最短（claim の枠を再利用）。保有セッションが応答しない場合の扱いは Owner 判断 |
| 今できる範囲 | claim の `files` 内（`src/logic/fry/**`・`src/data/fry*`・`src/preview/fry*`・docs）の設計・テストのみ。Fry は本番 OFF 固定 |

## 8. Batch 19 — D1・D3・D4・D7・D9・Q1 と既存決定記録の照合

照合先: #748 の全コメント（Owner 決定 4 件＋ Parallel Investigation 1 件＋ R2 決定 1 件＋ claim 確認 1 件）、`TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md`（main）、Prep Rev 5（main、#769 を Owner が merge）。

| 項目 | 内容 | 既存記録 | 判定 |
|---|---|---|---|
| Prep D1 | 名称「ブッラータ」 | Prep §0 に「Owner 判断の確定」。#748 コメントには**なし**。R2 は id を burrata とのみ記載 | **Prep（main）に Owner 決定として記録**。#748 には未記録 → 未決ではない。GitHub への転記は任意 |
| Prep D3 | 暫定 id・日本語名（pesto-burrata-pizza／pizza-alla-crudaiola） | 同上。R2 と矛盾なし | 同上 |
| Prep D4 | 個数・窓・価格・色は暫定実装可 | 同上。B16〜B18 の前例、#748 OD-B18 の「原典未確認」と整合 | 同上 |
| Prep D7 | pesto-burrata に mozzarella を入れない | Prep のみ（R2 D8 はソース 2 層のみ言及）。Audit の Jaccard 0.333 はこの前提 | 記録あり（Prep）。**変更すると Jaccard・AC-8b が崩れる** |
| Prep D9 | #759 merge 後の Issue 起票承認 | Prep のみ。**本日の指示で Issue 作成が許可され #774 を起票（実行済み）** | **解消（#774）** |
| Q1 | pesto-burrata 近傍の C1〜C5 条件付き承認＋AC-8b | Prep Rev 3〜5。R2 D6（crudaiola 例外）と整合。#748 R2 コメント（6673566588）は crudaiola の例外のみ明記 | **整合**。pesto-burrata 側の例外は Prep のみに記録。0.333 で本来例外不要のため実害なし |
| 番号体系 | Prep と R2 の D 番号が別 | R2 §2.4 に対応表あり | **解消** |

**結論:** D1・D3・D4・D7・D9・Q1 は**新たな決定は不要**（記録は main の Prep にあり、#748 には無いだけ）。Owner が望めば #774 に「Prep Rev 5 の D1〜D9・Q1〜Q4 を Owner 決定として確認」の一文を 1 回記録するだけでよい。

### Owner 判断表（未決事項のみ）

| # | 判断 | 推奨 | 期限・影響 |
|---|---|---|---|
| 1 | **Batch 19 の実装 GO（Q3）** | 条件（#2・#3）が揃ってから出す | 全体のクリティカルパス |
| 2 | **#748 claim（〜11-19）の扱い**: 保有セッションに解放を投稿させる／Owner が失効を宣言 | 保有セッション（IDLE）に解放を依頼。応答がなければ Owner が失効宣言 | S1・S3 配線・S5 の全てがこれに依存 |
| 3 | **ハーブ PR と B19 の merge 順** | ハーブ先（Prep §7.1 の推奨。`IngredientGlyph.tsx` 共有） | 後の側が rebase |
| 4 | burrata-pizza（matrix 行 117）を将来足すか（crudaiola 例外 C2 の再判断） | B19 では足さない。別 Issue | B19 スコープ外 |
| 5 | 非正準順 Research ラベル差分の個別承認の運用（実装後 P3） | 差分の件数が出てから | 未承認 1 件で HOLD |
| 6 | HV 用 seed の要否と方式（B18 は approach A） | B19 の Phase 5 で別途提案 | 別オリジン優先、共有 Preview 上書きなし |
| 7 | WebKit の間欠失敗の受容方針（#394・#680） | 赤は PASS 扱いにせず原因を分ける（B18 の前例） | CI |

## 9. 各セッションの実装開始条件と最短 merge 順（更新）

### 9.1 開始条件

| # | 担当 | 着手可否 | 条件・ブロッカー |
|---|---|---|---|
| S1 | カタログ lane（B19 → B20 …） | **不可** | 判断表 #1・#2。#774 の条件 |
| S2 | 候補プール（#772） | **可（docs のみ）** | Owner の claim 承認（新規ファイルのみ） |
| S3 | ハーブ 4 種 | **一部可**（未配線 SVG・テスト・モック） | 配線は #748 解放後。判断表 #3 |
| S4 | #738 Final Gate 実行 | **可（使い捨てブランチでの検証のみ）** | #738 への push は Owner 承認＋保有者合意。claim 更新は保有者 |
| S5 | FRY F2 | **不可**（HOLD 条件未成立） | #738 merge、eggplant の絵、F2 GO |
| S6 | 新工程比較（#773） | **可（docs のみ）** | Owner の claim 承認 |

### 9.2 最短の手順（実装開始まで）

1. **今日（承認不要または承認済み範囲）:** S2（#772）・S6（#773）を開始（claim は新規 docs ファイルのみで Owner 承認後）。S3 は未配線 SVG とモック。S4 は #738 の検証。
2. **Owner:** #748 の claim 解放（保有セッションへの依頼 or 失効宣言）。ハーブ→B19 の順を承認。
3. **S3:** `pieceVisual` 配線を 1 PR にして merge（Owner 承認）。
4. **Owner の GO** → S1 が #774 の Phase 0〜5 を実施 → B19 merge。
5. B19 merge 後、S1 が Batch 20（S2 の Prep 済みの既存食材のみ）。並行して #738 の Owner HV → merge。
6. #738 merge と eggplant の絵が揃ったら S5（F2）。

**最短で食材 1 を merge できる経路:** (2)→(3)→(4)。**調理方法 1 を最短で数えられる経路:** #738 の Owner HV＋merge＋（Owner が数えると決めるなら）本番 ON の別承認。Preview/DEV 限定のままでは**加算しません**。

### 9.3 進捗の現在値

**追加食材数 0/8｜追加レシピ数 0/20｜追加調理方法数 0/2｜実装中: #738（Owner HV 待ち）、#755 系 Draft、#753/#751（docs）、#772/#773 起票済み（未着手）｜HOLD: Batch 19（#774、GO 待ち）、S5 FRY F2｜merge 済み（起点以降）: なし**
