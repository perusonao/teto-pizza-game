# TETO CONTENT MASTER PLAN — 全食材・全レシピ・全調理法の追加マスタープラン（#780、docs-only）

2026-11-08 / 基準 `origin/main` = **`348b1e4820f6119a219d9a9ee0503d734e75de43`**（#792 Batch 20-A merge 直後、`2026-11-08T17:02:00Z`）。作業ブランチ `claude/teto-pizza-content-master-plan-k8jmjv`。

変更は本書・台帳 3 本・`docs/reports/data/TETO_CONTENT-MASTER_*`（生成器 2 本・CSV・JSON）の**新規ファイルのみ**。`src/**`・`e2e/**`・CSS・既存 docs・HOT ファイル・他セッションの claim の成果物は編集していない。**本書は監査と計画であり、実装・merge・Production ON・共有 Preview 更新の承認ではない。**

凡例: **【実測】** この環境でファイル／GitHub から機械的に確認、**【推論】** 実測からの解釈、**【仮定】** 測定できないため明示した計画入力、**【未確認】** 確認できていない。

Owner 確定目標（①全食材 ②全レシピ ③全調理法・調理工程、3 ライン並行）に対し、8 食材・20 レシピ・2 調理法は中間マイルストーンとして扱う。

---

## 0. 結論

1. **母集団が確定した（最新 main で再現）【実測】:** レシピ **177 = 出荷済み 93 + 候補 84**、食材 **170 = 出荷済み 100 + 候補 70**、調理法・工程 **27 候補**（実装済み 7／部分実装 7／未実装 4／HOLD 1／採否未決定 6／重複 2）。#780 の「90 品・97 種・87 品・73 種」は #783（B19）と #792（B20-A）の出荷で **93・100・84・70** に進んでいる。
2. **漏れ・二重計上は機械的に検出できる状態にした【実測】:** 生成器が 40 項目の検査（172 行の全件照合、台帳の合計、全バッチの完全分割、調理法 capability の一意所属など）を行い、全件 PASS（`TETO_CONTENT-MASTER_verification.json`）。1 件でも落ちると台帳は出力されない。
3. **「今すぐ着手」できるコードはゼロ。ただし最初のバッチは確定している【実測】:** 判断が全部そろった候補は **8 レシピ**（RB-01 = taco・okonomiyaki、RB-02 = 残り 6）と、それに要る **16 食材**。ただし昇格には Owner の Q-1〜Q-5（`TETO_FULL-EXPANSION-177_Decisions-FirstTrain_Result.md` §4）が未回答で、承認済みの実装範囲は無い。よって本書も実装は始めない。
4. **今回の監査で見つかった、目標達成を左右する 3 つの構造問題【実測】**（いずれも既存 Owner 決定を変えず、判断を求めるだけ）:
   - **P-1 食材だけの先行追加が今の仕組みでは不可能。** ラダーの検証が「各 step は key レシピを新たに完成させる（無駄な解放は禁止）」を要求する（`src/logic/discoveryLadder.ts` の `KEY_RECIPE` 検査、OD-REC04-1）。「レシピ登場を待たず食材を追加」は **D-ING-1（Owner 判断）なしには成立しない**。
   - **P-2 「全レシピ追加」と重複ゲートが衝突。** 候補 84 のうち **26 品が出荷済みと同一／部分集合／上位集合**（現規則で原則不採用）、さらに 22 品が 1 材料差または Jaccard>0.4 の例外判断。**出荷済みと一切重ならない候補は 36 品だけ**。「全て」の定義を Owner が決めない限り、完了の分母が確定しない（**D-DUP-1**）。
   - **P-3 「PIZZA DB 版 既存バリエーション 9 行」は再現できない【未確認】。** 172 行を別名込みで照合すると、組成が出荷版と食い違う行は **16**（うち 10 はベースソースの差だけ、6 は非ソース材料の差）。9 の出所（定義・コミット）が repo と GitHub から見つからないため **9 は UNVERIFIED**。推測で埋めない（§1.4）。
5. **日程は Owner 判断の応答時間で決まり、それは測定できない【実測＋仮定】。** 測定できた量（PR 12 本の open→merge 中央値 13.7h、Codex 中央値 2.2 分、CI 1 サイクル 19.3 分、調理法トラックの実績 0.68 日・2.09 日と未完 3 件）から、**条件付きの下限〜標準〜遅延**を示す（§4）。標準で全 3 ライン **2026-12-01** 前後、遅延は **2027-02-27 以降（下限）**。これは予測ではなく入力仮定つきのシナリオ。

---

## 1. STEP 1 — Fresh Audit

### 1.1 確認した資料と状態【実測】

| 対象 | 状態 |
|---|---|
| `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（全 1151 行のうち冒頭 80 行と 2026-11 の addendum）、`TETO_SESSION-OPERATIONS_1.0.md`、`TETO_HUMAN-VERIFICATION-POLICY.md`（参照のみ） | 読了。**PROJECT_HANDOFF の先頭 `Updated: 2026-09-18` は古い**（addendum は 2026-11-08 まで追記済み）。全文再読は未実施 |
| Issue #780（本体＋コメント 9 件）、#772、#773 | 読了。#780 の claim は T2（#781）・T5/F2・T-FX が有効。**本作業の claim は未投稿**（§3.6） |
| 資料 | `TETO_FULL-EXPANSION-177_{Plan,E0-Staging,Rejudge,Decisions-FirstTrain}`、`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN`、`TETO_COOKING-METHODS-{NEXT,AFTER-STEAM}`、`TETO_COOKING-PROCESS-EXPANSION`、`TETO_COOKING-TECHNIQUES_1.0_SSOT` |
| 実コード・データ | `recipes.ts`・`lateCatalog.ts`・`ingredients.ts`（静的解析）、`src/data/staged/**`（レシピ 84・食材 70・golden 7 本）、172 マトリクス、4 つの `*ExperienceGate.ts` |
| open PR | 41 本（`list_pull_requests` state=open で全件取得）。内容追加に関わるもの: #785（FOLD+SEAL F1、Draft HOLD）、#782（eggplant icon）、#781（87 行再判定 docs）、#776（DRIZZLE D1）、#775（#577 PD-1a）、#746（DRIZZLE Lab）、#738（STEAM S3 UI）、#540（Grandma、HOLD）ほか |
| origin/main | `348b1e4`。直近の merge: #792（B20-A）、#789（staged D-1〜D-7）、#783（B19）、#788・#787（staged E0） |

### 1.2 最新状態への更新【実測】

| 項目 | #780 の監査値（`ed159e9`） | 今回（`348b1e4`） | 差分の理由 |
|---|---|---|---|
| 出荷済みレシピ | 90 | **93**（Pinsa 閉では 92） | #783: pesto-burrata-pizza・pizza-alla-crudaiola、#792: pesto-noci-pizza。`catalogLedger.test.ts` の期待値と一致 |
| 候補レシピ | 87 | **84** | 上記 3 品が出荷。87 = 3 + 84（evidenceId を機械照合） |
| 出荷済み食材 | 97 | **100** | burrata（#783）、honey・walnut（#792） |
| 候補食材 | 73 | **70** | 上記 3 種が出荷。73 = 3 + 70（機械照合） |
| 専用 SVG のある出荷済み食材 | 35 | **41**（食材 100 のうち。残り 59 は絵文字のみ） | `pieceVisual` を持つ食材の再計数 |
| 候補食材の専用 SVG | — | **0 / 70**（絵文字代替のみ） | #777 walnut は出荷済み食材側 |
| ラダー step | — | 78（Handoff addendum の記載値） | 【未確認】再計数はしていない |

### 1.3 172 行の全件照合【実測、`TETO_CONTENT-MASTER_matrix-map.json`】

| 区分 | 行数 | 備考 |
|---|---|---|
| 172 マトリクス行 | 172 | evidenceId 一意 |
| 出荷済みレシピに紐づく行 | **88** | 85 + 今回出荷した 3。紐づけは `phase0.correspondsToExistingCatalogId`／`canonicalCandidateId`＋別名 10 件の手当て（**【推論】** `bbq-chicken→bbq-chicken-pizza`、`bianca→pizza-bianca-ricotta` など。`bianca-pizzadb-row` の対応先は 2 候補のうち推定で選んだ） |
| 候補（staged 84 と evidenceId 完全一致） | **84** | |
| 1 つの出荷済みレシピに 2 行が紐づく | **0** | 別名による二重計上なし |
| 172 行に無い出荷済みレシピ | **5** | funghi・napoletana・pepperoni・pizza-bianca・salsiccia（計画書 §2 と一致） |
| 合計 | 93 = 88 + 5 | |

### 1.4 PIZZA DB 172 行と「既存バリエーション 9 行」【実測／9 は未確認】

88 の紐づけ行のうち、マトリクスの食材集合と出荷版が **完全一致 72**、**食い違い 16**:

- ベースソース（`curry-ketchup`・`olive-oil`・`fromage-blanc-sauce`）の差だけ: **10**（baingan-bharta・curry-pizza-japan・margherita・marinara・moussaka・pescatore・quattro-formaggi・rendang・reina-pepiada・tandoori-paneer）
- 非ソース材料の差あり: **6**（bismarck・breakfast-pizza・capricciosa・fugazza・meat-lovers・pesto-genovese）

#780 の「9 行」はどちらの定義にも一致しない。**9 は UNVERIFIED、台帳には実測の 16 行（`variantsComposition`）を載せ、出荷済みとして数え、177 には足さない**（計画書 §2 と同じ扱い）。どの定義の 9 かを Owner が示すまで別途の判断項目（O-17）。

### 1.5 食材の監査【実測】

候補 70 = ACTIVE 63（staged レシピが参照）＋ ALIASED_PROVISIONAL 5（ground-beef→beef、salsa→tomato-sauce、cotija→feta、blue-cheese-dressing→gorgonzola、chili-powder→paprika-powder）＋ MERGED_PROVISIONAL 2（nutella-spread、puntarelle）。ALIAS／MERGE の 7 件は I-1／I-2 の暫定ルールで**新 id が不要になりうる**（台帳では独立行のまま、バッチ IB-09 で「追加前に判断」）。種別: 野菜 15・ソース 13・チーズ 8・調理済み複合 8・果物 7・スパイス 5・魚介 4・デザート 4・液体 3・肉 2・ナッツ 1。

staged データの基準値に**更新遅れ**がある【実測】: `inFlightIngredients` に出荷済みの walnut が残る（apple-cinnamon-dessert 等）。台帳は walnut／honey／burrata を出荷済みとして扱う。staged 側の更新は T-FX の担当（#780 コメント 6720885805 が依頼済み）で、本作業は編集しない。

### 1.6 レシピの監査【実測】

候補 84 の主たる状態（D-1〜D-7 適用後、1 レシピ 1 値）:

| 状態 | 数 | 意味 |
|---|---|---|
| READY_TO_PROMOTE | 6 | taco・okonomiyaki・finocchi-salad・cavolo-carote・radicchio-noci・black-truffle。全依存が解決済み |
| READY_AFTER_RENAME | 2 | buffalo-chicken（→`buffalo-chicken`）・speck-e-brie（→`speck-e-brie`）。D-4 の ID 改名だけ残る |
| WAITS_MECHANIC | 43 | 新工程待ち（M1〜M6）。最大は生地（M1）31 行 |
| NEEDS_D1_EXCEPTION_JUDGEMENT | 11 | 例外判断（資料は準備済み） |
| NEEDS_D2_SOURCE_RESEARCH | 10 | 原典調査待ち。NO_SAUCE の推定は禁止（D-2） |
| STOP_D6_RESEARCH | 10 | 出荷済みの Research 文字を変えるため昇格停止（D-6）。ID 単位の承認が要る |
| NEEDS_CANDIDATE_SELECTION / NEEDS_OWNER_DECISION | 1 / 1 | nutella-dessert（候補選択）、peking-duck（調理済み複合の扱い） |

状態の集計は `decisions.json` の `byStatus` を **9 区分すべて再現**して検証済み（生成器が照合）。

### 1.7 調理法の洗い出し【実測＋推論】

候補 **27**。出所: 技法レジストリ 4（`techniques.ts`）／172 マトリクスの capability 11＋SERVE_FORM（**各 1 行にだけ所属**）／staged の工程キー 11／既存の出荷・Gate 後ろの操作（SEAR・PREP・FRY・STEAM・絞る・CUT・DRIZZLE）／Research 候補（煮込む・割る・刻む・混ぜる ほか）。

| 分類 | 数 | ID |
|---|---|---|
| 実装済み | 7 | T-NOSAUCE・T-TRAY・T-DOUGH-PINSA・T-LATE・M-SEAR（`SEAR_EXPERIENCE_PRODUCTION=true`）・M-SQUEEZE・M-CUT |
| 部分実装 | 7 | M-DOUGH-KINDS・M-ENCLOSE（PR #785 未 merge）・M-PREP（`=false`）・M-FRY（`=false`、ロジックのみ）・M-MULTI3（2 層まで）・M-DRIZZLE（PR #776/#746 未 merge）・M-STEAM（`=false`、S3 UI は #738 open） |
| 未実装 | 4 | M-PAN・M-SHAPE・M-MIDBAKE・M-STEP-ORDER（いずれも新規設計 Issue が必要） |
| HOLD | 1 | M-ZONED（識別軸 `zones` が UNAVAILABLE。Owner 方針は将来フェーズ） |
| 採否未決定 | 6 | M-LAMINATE（1 レシピ、延期候補）・M-SERVE-FOLD・M-BOIL・M-CRACK・M-CHOP・M-MIX |
| 重複 | 2 | M-SPRINKLE（#476 D3 で撤回済み）、M-ARRANGE（タップ配置／ZONED の別表現） |

「不明なものを実装済みと推定しない」を守り、Gate が OFF のもの・PR が open のものはすべて「部分実装」。STEAM はどの候補レシピも要求しない【実測】。

---

## 2. STEP 2 — 全件マスター台帳

| 台帳 | ファイル | 行数 | 列 |
|---|---|---|---|
| 全食材 | `docs/reports/TETO_CONTENT-MASTER_LEDGER_ingredients.md`（CSV: `data/…_ingredients.csv`） | **170** | ID・名称・現状・依存（使うレシピ）・関連 Issue/PR・担当バッチ・必要な Owner 判断・完了条件 ほか |
| 全レシピ | `docs/reports/TETO_CONTENT-MASTER_LEDGER_recipes.md`（CSV: `…_recipes.csv`） | **177** | 同上＋必要な調理法・未決の判断・172 行 ID |
| 全調理法 | `docs/reports/TETO_CONTENT-MASTER_LEDGER_methods.md`（CSV: `…_methods.csv`） | **27** | 同上＋根拠・マトリクス行数・待つレシピ数・採否 |

**漏れ・二重計上の機械検出**（`TETO_CONTENT-MASTER_gen.py.txt`、再実行: `python3 -I docs/reports/data/TETO_CONTENT-MASTER_gen.py.txt <repo> <out>`）— 代表的な検査:

| 検査 | 結果 |
|---|---|
| 出荷済みレシピ 93・食材 100 の静的解析が `catalogLedger.test.ts` の期待値と一致 | PASS |
| 候補が出荷済みと交わらない（レシピ・食材） | PASS |
| 172 = 紐づけ 88 + 候補 84、紐づけの二重計上 0、行の無い出荷済み = 既知の 5 | PASS |
| 177 = 93 + 84、170 = 100 + 70、計画書の 73 = 70 + 出荷済み 3 | PASS |
| 全候補レシピが**ちょうど 1 つ**のレシピバッチに属する（84／84） | PASS |
| 全候補食材が**ちょうど 1 つ**の食材バッチに属する（70／70） | PASS |
| ACTIVE の候補食材は 1 つ以上の候補レシピが使う（孤児 0）。ALIAS／MERGE 7 件は未参照が設計どおり | PASS |
| 172 マトリクスの capability 全種が調理法台帳の**ちょうど 1 行**に所属 | PASS |
| 候補レシピが要求する工程キーは全て調理法台帳にある | PASS |
| decisions.json の状態別件数を再現 | PASS（9 区分） |

---

## 3. STEP 3 — 並行実装計画

### 3.1 3 ライン（Owner 指定どおり並行）

| ライン | 内容 | 土台 | 競合を避ける固定規則 |
|---|---|---|---|
| **A 食材**（IB-01〜09） | 70 候補を、レシピ登場を待たず登録・配線できる形にする | staged（`src/data/staged/**`）、SVG は #417 線 | 現状は P-1 のため**最初の使用レシピの列車と同時に出荷**。D-ING-1 が承認されれば単独の食材列車に切り替える |
| **B レシピ**（RB-01〜17） | 84 品を、依存（食材・工程・Owner 判断）ごとのバッチで昇格 | staged、Release Train 方式（G-1 承認済み） | HOT カタログ群は **Catalog Integrator 1 名**（同時に 1 session） |
| **C 調理法**（MB-01〜08＋共通基盤） | 採用 19 のうち未完 12 を、既存 Issue/PR の線で実装 | 各 Gate（本番 OFF）、Preview opt-in | `GameScreen.tsx`・`App.css`・`gameReducer.ts` は**直列**（順序 #738 → M1 PD-2 → M5 → M3 → M2 → M4 → M6） |

別 worktree で並行できる作業: staged／docs の更新（ライン A・B の準備）、`src/logic/<mechanic>/**` の純粋ロジック（C）、SVG の新規ファイル（#417 線）。**並行できないもの:** HOT カタログ群の編集と、工程 UI の画面接続（上の直列順）。

### 3.2 HOT ファイルの単一担当【実測、計画書 §6 を踏襲】

`recipes.ts`・`lateCatalog.ts`・`ingredients.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`orders.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`toppingSizeClass.ts`・`ingredientTaxonomy.ts`・`ingredientSearchAliases.ts`・`hints.ts`・`__golden__/hint5.*`・`catalogLedger.test.ts`・`expansionBatch*.test.ts`・`persistence.ts`（**誰も触らない**）。列車 PR の間は直前の列車の merge 後に rebase。`src/main.tsx`・`src/preview/**`・`src/devtools/**` は #738／#746 の領域で触らない。

### 3.3 共通基盤（3 ラインが共有する前提）

| ID | 内容 | 状態 |
|---|---|---|
| F-1 | Staged Catalog と隔離テスト（本番から import しない） | **完了**（#787・#788・#789） |
| F-2 | 列車ごとの一括検証: 重複ゲート・Research 正準順・Hint 5.0／DH4・保存安全性 | 完了（staged 内。昇格時に本番側で再測定） |
| F-3 | Dex の raw エントリ保持（Gate 付き列車の本番 ON 前提） | **merge 済み**（PR #674、#668）【実測】 |
| F-4 | 技法レジストリ（`techniques.ts`）への登録＋なぞかけ・説明の Owner 承認 | 工程ごとに必要。INV-TQ-4／P9: **Hint 5.0／DH4 privacy の再 audit** |
| F-5 | 識別軸の OBSERVED 化（`dough`・`prep`・`enclosure` ほか） | 現状 `pan`・`dough`・`late` が OBSERVED。他は FIXED_BY_FLOW／UNAVAILABLE |
| F-6 | Preview／DEV 限定の HV 入口と、390×844 の自動プレイ e2e（列車単位） | H-1 承認済み（代表サンプル＋自動スクショ全件）。**共有 Preview は更新しない** |
| F-7 | 大カタログ UX（トレイ 75 食材超）: #675・#369 | **open**【未確認】。食材 100→170 の前提（計画書 §7 のリスク） |
| F-8 | 食材アイコン方針（SVG か絵文字か） | 出荷済みの 59% が絵文字のみ【実測】。D-ICON-1 |

### 3.4 バッチ一覧

**レシピ（RB-01〜17、84 品を完全分割、`TETO_CONTENT-MASTER_batches.csv`）**

| バッチ | 数 | 内容 | 前提 |
|---|---|---|---|
| RB-01 | 2 | **最初の列車**: taco-pizza・okonomiyaki-style-pizza（late カタログ） | Owner Q-1〜Q-5 |
| RB-02 | 6 | buffalo-chicken・speck-e-brie（ID 改名）・finocchi-salad・cavolo-carote・radicchio-noci・black-truffle | RB-01 merge、Q-5、truffle の形（スライス／オイル）の決定 |
| RB-03 | 2 | nutella-dessert・peking-duck | 候補選択／調理済み複合の判断 |
| RB-04〜05 | 5＋5 | 原典調査待ち 10 品（ベースソース） | D-2 の原典調査 |
| RB-06〜07 | 6＋5 | 例外判断待ち 11 品 | D-1 の品ごとの判断 |
| RB-08〜09 | 5＋5 | Research 文字変更で昇格停止 10 品 | D-6 の ID 単位承認 |
| RB-10〜12 | 7＋7＋6 | 生地（M1）待ち 20 品 | M1（#577）＋R-3 |
| RB-13 | 3 | kimchi・pizza-fritta・yakiniku（M5） | PREP／FRY の本番 ON |
| RB-14 | 5 | calzone ほか包む系（M1＋M3） | M1・M3 |
| RB-15 | 8 | 天板・形状系（M1＋M2） | M1・M2 |
| RB-16 | 3 | eel・natto・lomo-saltado（M4＋M5） | M4・M5 |
| RB-17 | 4 | deep-dish・feteer・quattro-stagioni・trenton（M2＋M6） | M2・M6（feteer は LAMINATE 採否） |

バッチサイズ上限 8 は**【仮定】**（出荷実績の最大は 5。均等割り: 10→5＋5）。メンバー全件は `TETO_CONTENT-MASTER_tables.md`。

**食材（IB-01〜09、70 種を完全分割）**

| バッチ | 数 | 内容 |
|---|---|---|
| IB-01 | 8 | RB-01／02 が使う食材（cabbage・lettuce・cheddar・bonito-flakes・okonomiyaki-sauce・tortilla-chips ほか） |
| IB-02 | 8 | 同上（orange・brie・sunflower-seeds・balsamic-vinegar・buffalo-sauce・truffle ほか） |
| IB-03〜05 | 9＋9＋7 | 判断待ちレシピ（機械なし）だけが使う食材 |
| IB-06〜08 | 8＋8＋6 | 工程待ちレシピだけが使う食材 |
| IB-09 | 7 | ALIAS／MERGE 候補（追加前に I-1／I-2 の判断。新 id が不要になりうる） |

IB-01／02 の合計 **16 食材**が、RB-01（6 食材）＋RB-02（10 食材）に対応。

**調理法（MB-01〜08）**

| バッチ | 対象 | 解放するレシピ | 既存 Issue/PR |
|---|---|---|---|
| MB-01 | M1 生地の種類（PD-1a→PD-1b/c→PD-2→PD-3） | RB-10〜12 ほか 31 行 | #577、PR #775（PD-1a、open）、Piadina Gate HOLD |
| MB-02 | M5 PREP／FRY の本番 ON と食材拡張 | RB-13、RB-16 の一部 | #696、#749、PR #750 |
| MB-03 | M3 ENCLOSE（FOLD+SEAL F1→F2 lab→F3 接続） | RB-14 | #773、PR #785（HOLD）、F2 lab claim |
| MB-04 | M2 天板 profile・形状ターゲット | RB-15、RB-17 の一部 | #532／#536／#538、**新規設計 Issue 要** |
| MB-05 | M4 mid_bake | RB-16 | #604／#611、**新規 Issue 要** |
| MB-06 | M6 工程順・ZONED・3 層目（LAMINATE は採否次第） | RB-17 | #773、PR #620、#521、**新規 Issue 要** |
| MB-07 | STEAM（S3 UI → HV → 本番 ON） | 候補レシピなし（既存 clam／mussel の体験） | #726、PR #738 |
| MB-08 | DRIZZLE（D1→配線→本番 ON） | 液体系（honey・balsamic ほか）の後がけ | #579、PR #746／#776 |

### 3.5 バッチ別 Issue／PR 対応表

| バッチ | 追跡先 | 状態・留意 |
|---|---|---|
| RB-01〜02 | #780（親）。昇格 PR は新規（未作成）。staged は #789 で merge 済み | claim 要（§3.6）。HOT 編集は Catalog Integrator のみ |
| RB-03〜09 | #780（Owner 判断待ち）。D-2 の原典調査は #772 S2 の調査と連携 | 他 session の #772 claim は奪わない |
| RB-10〜12、MB-01 | #577、PR #775、PD-1b/c（#781 docs） | PD-2 は `GameScreen.tsx` 直列 |
| RB-13、MB-02 | #696、#749 | 本番 ON は別途 Owner 承認 |
| RB-14、MB-03 | #773、PR #785（HOLD）、F2 lab claim（`claude/fold-seal-f2-lab-773`） | 新規に別実装しない |
| RB-15、MB-04 | #532 の子として新規設計 Issue | 起票は Owner 承認後 |
| RB-16、MB-05 | #604 の子として新規 Issue | 同上 |
| RB-17、MB-06 | #773、PR #620、#521、新規 Issue | LAMINATE は延期候補 |
| IB-01〜02 | RB-01／02 の昇格 PR に同梱。SVG は #417 線 | 絵文字代替は仮 |
| IB-03〜09 | 各使用レシピの列車。ALIAS／MERGE は I-1／I-2 判断後 | |
| MB-07 | #726、PR #738、#755 系 Draft（#756／#757／#762／#763） | HV A/B 待ち |
| MB-08 | #579、PR #746／#776 | |
| 基盤 F-7 | #675、#369 | 食材 170 の前提 |

### 3.6 既存 claim・PR・HOLD の尊重と、本作業の claim

- 触っていない: #781（T2）、#772 の `TETO_CONTENT-POOL_*`、T5／F2 の `src/labs/foldSeal/**`、T-FX の `src/data/staged/**` と `TETO_FULL-EXPANSION-177_*`、#738／#746 の `src/main.tsx`・`src/devtools/**`・`src/preview/**`、#540 HOLD、#785 HOLD。
- 本書の新規ファイル名前空間 `TETO_CONTENT-MASTER_*` は上のどれとも重ならない【実測】。**claim コメントは投稿していない**（コメントは通知を伴うため。Owner の指示があれば `docs/reports/TETO_CONTENT-MASTER*`・`docs/reports/data/TETO_CONTENT-MASTER*` を範囲に投稿する）。

---

## 4. STEP 4 — 日程

### 4.1 測定できた量【実測、`TETO_CONTENT-MASTER_schedule.json`】

| 量 | 値 | 根拠・サンプル |
|---|---|---|
| 内容追加 PR の実績 | 12 本／レシピ 21／食材 18／初回〜最終 merge 12.12 日 | #686〜#792（B10〜B20-A）。件数は PR タイトル・Result による |
| 処理能力（直列、HV 付き） | レシピ **1.73／日**（初回バッチを除くと 1.32／日）、PR 0.91 本／日、1 PR あたり平均 1.75 レシピ | 上記から算出 |
| PR open→merge | 最小 1.5h／p25 5.1h／**中央値 13.7h**／p75 19.2h／最大 31.6h | 12 本。**PR を開く前の開発時間は含まない（未測定）** |
| Codex レビュー（指摘なしの往復） | 中央値 **2.2 分**、最大 2.6 分 | 11 回（#783・#792・#789・#759）。指摘がある場合は修正＋再レビューで 8〜25 分【推論】 |
| CI 1 サイクル（緑） | **19.3 分**（build 15.1 分、WebKit 最長 18.3 分） | **PR #792 の 1 回のみ（n=1）** |
| CI の再実行 | #792 で 2 回、#759 で 3 回以上、#788 で 1 回の WebKit 間欠失敗を記録 | コメントから。全 PR の失敗率は**未集計** |
| iPhone HV の連鎖（B19／#783） | HV 経路の決定→専用 Preview 公開 **7.7h**、公開→HV 完了の記録 **5.1 分**、記録→Final Gate **11.8 分**、Final Gate→merge **10.8h**、決定→merge **18.7h** | **n=1**。HV 操作そのものの所要は公開後 5 分以内に記録された事実のみ |
| 調理法トラック（最初の実装 PR→本番 ON） | SEAR **0.68 日**、PINSA **2.09 日**。未達: PREP（≥10.75 日、本番 OFF）、STEAM（≥5.94 日）、FRY（≥4.09 日、UI なし） | 完了 2 件＋右打ち切り 3 件。**未達は下限値であり所要日数ではない** |

### 4.2 測定できなかった量（不足データ）

1. **Owner 判断の応答時間。** 一括判断（計画書 G／P／R／I／M／H の 16 件、D-1〜D-7）は提示した当日に回答があった（n=2）が、今回の **116 件の個別判断＋34 件の原典調査**に相当する前例がない。判断が「いつ・どれだけ溜まるか」は**未測定**。
2. PR を開く前の実装・調査時間（PR の open 時刻しか取れない）。
3. 3 ライン並行で回した実績（これまで内容追加は直列）。並行時の処理能力は**未測定**。
4. 列車 PR（5〜8 レシピ）の open→merge。実績は 1〜5 レシピの PR のみで、大きい PR での伸びは**未測定**。
5. 新設計が要る工程（M2・M4・M6）の設計〜Owner 採否までの時間。
6. iPhone HV の Owner 側の実作業時間（記録時刻しか無い）。

### 4.3 シナリオ（式と入力。予測ではない）

| 入力 | 最短 | 標準 | 遅延 | 区分 |
|---|---|---|---|---|
| A1 Owner の一括判断が全て届くまで L_dec | 1 日 | 7 日 | 21 日 | **【仮定】** |
| A2 新設計工程（M2／M4／M6）の設計リード | 0 日 | 3 日 | 14 日 | **【仮定】** |
| T_train（列車 1 本の open→merge） | 5.1h（p25） | 13.7h（中央値） | 31.6h（最大） | 【実測】 |
| T_track（工程 1 トラック） | 0.68 日（SEAR） | 1.39 日（SEAR・PINSA の平均） | **10.75 日（PREP の未達下限）** | 【実測】 |
| トラックの並び | 並列 | HOT 直列（6 本） | HOT 直列（6 本） | 計画書 §6 |

式: `ready8 = L_dec + 2·T_train`、`非工程 = L_dec + 9·T_train`（HOT 直列）、`工程 = L_dec + 設計リード + k·T_track`（k=1 または 6）、`全完了 = max(非工程, 工程) + 8·T_train`。起算日 2026-11-09。

| 到達点 | 最短 | 標準 | 遅延（**下限**） |
|---|---|---|---|
| 判断済み 8 品（RB-01／02）の出荷 | 2026-11-10 | 2026-11-17 | 2026-12-02 |
| 工程待ち以外の 41 品（RB-01〜09）完了 | 2026-11-11 | 2026-11-21 | 2026-12-11 |
| 工程トラック全部が揃う | 2026-11-10 | 2026-11-27 | 2027-02-16 |
| **レシピ 84 品＋食材 70 種（P-1 のまま）完了** | **2026-11-13** | **2026-12-01** | **2027-02-27 以降** |
| 食材のみ（D-ING-1 承認時、IB 9 本） | 2026-11-11 | 2026-11-21 | 2026-12-11 |
| **調理法の未完 12 トラック（採用分）が本番で揃う** | 2026-11-10 | 2026-11-27 | 2027-02-16 以降 |

読み方:
- **最短は理論下限**（判断が翌日に全部下り、全 PR が最速 4 分位で通る場合）で、実現可能性は保証しない。
- 遅延の工程側は PREP が 10 日以上本番 OFF のまま止まっている事実を T_track にしたもので、**「それ以上かかる」下限**。
- **すべての日付は L_dec に 1 日対 1 日で連動**する（非工程・工程の両経路が L_dec の後に始まるため）。判断の遅れが最大の変数。
- #780 本文の 35／70／140 日の仮見積もりに対し、測定値で再計算した標準は **約 23 日**、遅延は **約 110 日以上**。差は「判断の応答時間を 7 日と仮定した」ことによるもので、**実績に基づく更新ではなく、仮定の置き直し**である点に注意。
- P-2（重複ゲート）の扱い次第で分母が変わる。26 品を除外する場合は RB-07〜RB-17 の数が減り、日付は短くなる（再計算は生成器の再実行で可）。

---

## 5. Owner 判断待ち一覧

| ID | 論点 | 対象 | 推奨（助言であって決定ではない） |
|---|---|---|---|
| Q-1〜Q-5 | taco・okonomiyaki の late カタログ配置／Research 非正準順で変わる出荷済み 17 品の ID 別承認／暫定数量・色／昇格 PR の編集範囲／次候補 4 品への展開（truffle の形を先に決める） | RB-01／02 | Decisions-FirstTrain Result §4 の推奨どおり |
| **D-ING-1（新規）** | 食材をレシピと同時でなく**単独で出荷**できるよう、ラダーの key レシピ規則（OD-REC04-1「無駄な解放は禁止」）に例外を設けるか | ライン A 全体 | 承認するなら新 step 種別の設計 Issue を先に（HOT）。不承認なら食材は最初の使用レシピ列車に同梱 |
| **D-DUP-1（新規）** | 「全レシピ追加」の分母。26 品（同一／部分／上位集合）を ①対象外 ②生地・工程差で区別して許可 ③例外承認、のどれにするか。22 品（1 材料差／Jaccard>0.4）の扱い | RB-06〜17 | 既存規則 R-2／R-4 を維持し、区別できる品だけ個別例外（D-1 の資料を使用） |
| **D-ICON-1（新規）** | 新食材 70 種のアイコン方針。専用 SVG 必須か、絵文字代替を許容するか（出荷済みの 59% は絵文字のみ） | ライン A | 絵文字代替で出荷し SVG は #417 線で後から（G18 の重複なし制約を維持） |
| D-1 | 例外 39 品（76 件）の品ごとの判断 | RB-06〜07 ほか | 資料（`decisions.json` の `d1Dossier`）を使い一括表で回答 |
| D-2 | ソース未特定 22 件の原典調査（NO_SAUCE は原典確認なしで確定禁止） | RB-04〜05 ほか | 調査担当と範囲の指定 |
| D-3 | 唐辛子の共通候補 `chili-pepper` の確認（12 件） | 横断 | 確認 |
| 追加判断 40 | R-7 11・未解決トークン 12・R-8 8・R-3 HOLD 8・R-6（lahmacun）1 | RB-03 ほか | 計画書 §9 の推奨 |
| D-6 | Research 正準順の文字変更（出荷済み 21 品・原因 26 レシピ）の ID 別承認 | RB-08〜09 ほか | 変更なしで済む品から先に |
| I-1／I-2／I-3 | 別名 5・統合 2・調理済み複合 8 の最終扱い | IB-09、RB-03 | 暫定ルール維持 |
| M 採否 | LAMINATE・SERVE_FOLD・煮込む／茹でる・割る・刻む・混ぜる の採用／不採用 | 調理法 6 | 煮込む／割る／刻む／混ぜるは不採用候補、LAMINATE は延期 |
| 本番 ON | PREP・FRY・STEAM・DRIZZLE の Production ON、Piadina Gate HOLD の解除、R-3（cauliflower／fathead）の HOLD | MB-01・02・07・08 | 各 Gate の既存手順 |
| 新規 Issue 起票 | M2 天板／形状、M4 mid_bake、M6 工程順・LAMINATE | MB-04〜06 | 採否後に起票 |
| O-17 | 「PIZZA DB 既存バリエーション 9 行」の定義（実測は 16、内 10 はベースソース差のみ） | 台帳 | 定義の提示 |
| H-1 運用 | 列車ごとの代表サンプル HV に必要な Owner の時間（HV は Owner の iPhone 実機が必須。3 ライン並行でも Owner の HV は直列） | 全列車 | 列車 7 本程度に集約（計画書 §8） |

---

## 6. 直ちに実装可能な最初のバッチ

**RB-01（taco-pizza・okonomiyaki-style-pizza）＋ 食材 6 種（cheddar・lettuce・tortilla-chips・okonomiyaki-sauce・cabbage・bonito-flakes）。**

- 準備状況【実測】: staged 側の 8 項目確認は PR #789 で合格済み（出荷済み・2 品どうしとの重複 0、Research 正準順の変化 0、Hint 5.0 key-free、保存安全性）。B20-A の merge（#792）で HOT ファイルの先行待ちも解消。
- **開始の条件（すべて未充足）:** (1) Owner の Q-1〜Q-5 回答、(2) #780 へ claim 投稿（範囲: `lateCatalog.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`catalogLedger.test.ts`・golden、必要なら `recipes.ts`）、(3) 開始時点の最新 main で Duplicate Gate・Research 文字・Hint 5.0・アイコン・golden を再測定、(4) 他の HOT 編集 PR が無いこと。
- **停止条件:** 正準順で出荷済みの Research 文字が 1 つでも変わる／重複ゲート新規ヒット／Hint 5.0 golden の既存項目の変化。
- 完了条件: 最新 HEAD の CI 緑、Codex 指摘なし、代表 HV（390×844 動画は Owner へ直接、前後スクリーンショットは `docs/reports/screenshots/<task>/` に commit）、Owner の merge 承認。Production ON・共有 Preview 更新は含まない。
- **本作業ではコードを書かない**（既存承認範囲を超えるため）。

---

## 7. Result Report（3 ライン）

| 項目 | ① 食材 | ② レシピ | ③ 調理法・工程 |
|---|---|---|---|
| **全対象数** | **170**（出荷 100＋候補 70） | **177**（出荷 93＋候補 84） | **27 候補**（うち採用対象 19＝実装済み 7＋部分 7＋未実装 4＋HOLD 1。採否未決定 6、重複 2） |
| **完了数** | 100 | 93 | 7 |
| **残数** | 70（うち 7 は I-1／I-2 で新 id 不要になりうる） | 84 | 採用対象の未完 **12**（＋未決定 6） |
| **実装バッチ数** | 9（IB-01〜09） | 17（RB-01〜17） | 8（MB-01〜08）＋共通基盤 F-1〜F-8 |
| **開始可能数（依存が全て解決済み）** | 16（IB-01／02） | 8（RB-01／02） | 0（部分実装 7 件は各 Gate／本番 ON 判断待ち、既存 PR・claim は他 session の領域） |
| **Owner 承認済みで今すぐ着手可** | 0 | 0 | 0 |
| **主な阻害要因** | P-1 食材単独出荷の仕組み無し（D-ING-1）、Q-1〜Q-5、アイコン方針（D-ICON-1）、トレイ UX #675 | Q-1〜Q-5、重複ゲート 26 品＋22 品（D-DUP-1）、原典調査 22、例外判断 76、Research 昇格停止 26、工程待ち 43 | 新設計 Issue 未起票（M2／M4／M6）、PREP／FRY／STEAM の本番 ON 判断、Piadina HOLD、HOT UI 直列、採否未決定 6 |
| **完了予定日（最短／標準／遅延）** | 食材単独出荷が承認された場合 11-11／11-21／12-11。承認されない場合はレシピと同じ | **2026-11-13／2026-12-01／2027-02-27 以降** | トラックが揃う日: 11-10／11-27／**2027-02-16 以降** |
| **根拠の強さ** | 条件付きシナリオ（§4.3）。L_dec・設計リードは【仮定】 | 同左 | 同左。遅延は右打ち切り値（下限） |

---

## 8. 制約の遵守と、今回やっていないこと

- Owner の既存決定（D-1〜D-7、G／P／R／I／M／H、claim、HOLD）は変更・昇格していない。新規の論点（D-ING-1、D-DUP-1、D-ICON-1、O-17）は**判断を求めるだけ**で、推奨は助言。
- 無断 merge・Production ON・共有 Preview 更新・他 session のブランチへの push は無し。本ブランチへの push のみ。PR は作成していない。
- HV Policy: docs-only のため HV 動画・スクリーンショットは不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2「原則不要」）。
- 未実施: PROJECT_HANDOFF 全文の再読、レシピ原典（pizzadb.jp）の確認（全行 UNVERIFIED のまま）、Research 文字・Hint 5.0 の本番側での再測定（昇格時に実施）、アプリの実行・テスト実行（`node_modules` 無し。静的解析と staged の golden を使用）。

## 9. 再現手順

```
python3 -I docs/reports/data/TETO_CONTENT-MASTER_gen.py.txt <repo> <out-dir>      # 台帳 3 本・バッチ・検査（FAIL があれば exit 1）
python3 -I docs/reports/data/TETO_CONTENT-MASTER_schedule.py.txt <out-dir>/TETO_CONTENT-MASTER_verification.json <out-dir>/schedule.json
```

入力の GitHub 実測値（PR の時刻・Codex・CI・HV）はスケジュール生成器の先頭にそのまま埋め込んである。main が進んだら再実行し、`checksFailed` が空であることを確認する。
