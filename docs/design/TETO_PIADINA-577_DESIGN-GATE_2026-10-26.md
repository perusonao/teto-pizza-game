# ピアディーナ・ロマニョーラ — 設計 Gate（#577 Dough Kind の 3 値目、docs-only）

Status: **設計と調査のみ。実装コードは変更していない。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。
基準 `main` = `f661767d634ac53d71a1a1b0f1aa8954b76eaddf`（2026-10-26）。追跡: #577（Dough Kind）。ピアディーナ専用の Issue は無い（重複を作らず #577 に紐づける）。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。原典（pizzadb.jp）はこの環境から到達できず、全て未確認。**
方法: 検証は `f661767` の `git archive` を隔離ディレクトリに展開し、ローカルで `vitest` を実行した（CI の再実行ではない）。隔離コピーはリポジトリ外で、結果以外は残していない。

## 0. Gate の判定

| # | 項目 | 判定 | 要旨 |
|---|---|---|---|
| G1 | 材料・重複・コホート | **PASS** | 材料は全て既存。完全一致する既存レシピなし。コホート文字は動かない（§2） |
| G2 | ラダー・経済 | **PASS** | 新材料なし。`ladderCredit:false` で slack 1 は不変（§2） |
| G3 | DH4 | **PASS（限定）** | 標準生地の代役で 2 ファイル 30/30 通過。生地種別そのものは未モデル化で、実装時に再測定が必要（§2.3） |
| G4 | Pinsa との共存 | **PASS（条件付き）** | `dough` の値は別、技法 id も別になる前提。検出・チップの一般化が要る（§4） |
| G5 | Anti-Oracle | **HOLD** | チップ UI が単一の「ほかの生地」前提で、3 値目で漏えい面が変わる。Owner の設計判断が要る（§5） |
| G6 | 保存互換 | **HOLD** | 技法台帳は前方互換だが、`pendingRound` の `dough` は旧ビルドで「処理不能」になる（§6） |
| G7 | 工程（焼成前のみ / FINISH） | **HOLD** | 原典に投入時機の記載がなく、Owner 判断（§7） |
| G8 | 原典 | **HOLD** | 比較表 p7 のみ。個別ページ未確認（§8） |

**総合: HOLD。** FAIL はない（実装不能にする要因は見つからなかった）。G5〜G8 の Owner 判断・原典確認が済むまで実装に進まない。

## 1. 現状（実コードで確認）

- `DoughKind = "standard" | "material-multigrain-long-ferment"`（`src/logic/dough/doughKind.ts:12`）。`isDoughKind` は 2 リテラルの直接比較（20 行目）。
- Pinsa は本番で ON（`PINSA_PRODUCTION = true`）。生地の選択は 2 つのチップ「ふつうの生地」/「ほかの生地」（発見後は技法名「ピンサ生地」）。Free Cooking / Research の DOUGH 工程のみ、導出された affordance が開いたときだけ表示される。
- 識別軸 `dough` は OBSERVED（`signature.ts:176`）。技法 `dough-pinsa-romana` は 1 技法 1 生地（設計書 Q3 は Pinsa について実質確定、Piadina / Manakish は未決）。
- Pinsa の楕円描画は `OVAL_DOUGH_KINDS`（`doughOutline.ts:17`）の一覧で決まり、Piadina は丸いままでよい。

## 2. 候補の事実

### 2.1 matrix 行 `piadina-romagnola-pizzadb-p7`（READY）

| 項目 | 値 |
|---|---|
| 材料（原文 → canonical） | 生ハム → prosciutto-crudo / ルッコラ → arugula / クリームチーズ → cream-cheese（全て exact_alias、既存食材） |
| ソース欄 | ノンソース（NO_SAUCE） |
| 生地 | 「薄い無発酵の平焼き生地」、分類 `flatbread-unleavened`、形は丸 |
| 必要な機構 | `DOUGH_VARIANT` のみ。工程・後乗せ・下ごしらえの記載はない（`postBakeFinish`・`prep` は空） |
| 出典 | 比較表 page 7 のみ（個別ページなし）。`verifiedAt: relayed, not independently re-fetched` |

### 2.2 重複・コホート（隔離コピーで実測）

- 材料集合 {arugula, cream-cheese, prosciutto-crudo} に**完全一致する既存レシピはない**。
- 近い既存は jamon-serrano-pizza / rucola-e-grana / pinsa-romana（いずれも tomato-sauce を使う）。Piadina は NO_SAUCE のためソースで区別される。Pinsa との区別は #577 の原典確認項目 5（「Piadina との区別」）で、**未確認のまま**。
- Research のコホート: cream-cheese で解禁される単独レシピになり、**既存のコホート文字は動かない**（差分 0）。
- 発見条件: arugula（step 33）、prosciutto-crudo（step 31）、cream-cheese（step 37）を所持した時点で作れる。`ladderCredit:false` の場合は新しい step を持たず、発見しても credited 数は進まない。
- ラダー: 星ゲートの到達性は不変（slack 1）。

### 2.3 DH4（代役の測定）

標準生地・`ladderCredit:false`・NO_SAUCE として隔離コピーに足し、`deductionProduction.gate.test.ts` と `deductionGuard.gate.test.ts` を実行 → **30/30 通過**（件数 pin も動かなかった）。arugula は vegetable、prosciutto は meat、cream-cheese はチーズカテゴリで、「その他」家族（egg / almond / pine-nuts）の材料を含まない。
**限界**: 生地種別と技法をモデル化していない。実装時は 3 値目を入れた状態で再測定する（月見のように、材料以外の条件で失敗する可能性は排除できない）。

## 3. `DoughKind` の 3 値目に必要な 14 ファイルの影響

`material-multigrain-long-ferment` / `isDoughKind` / `DOUGH_KINDS` / `resolveDoughKind` を参照する非テストファイルは 14 件。

| 区分 | ファイル | 影響 |
|---|---|---|
| **A. 語彙（必須変更）** | `logic/dough/doughKind.ts` | 型の union、`DOUGH_KINDS`、`isDoughKind`（直接比較を `DOUGH_KINDS` 参照へ一般化） |
| **B. 汎用リーダー（変更不要の見込み。テストで固定）** | `logic/discovery/signature.ts` | `resolveDoughKind` で `dough` 軸を観測。値が増えても同じ |
| | `data/discoveryCatalog.ts` | `resolveDoughKind(recipe)` で target の `dough` を導出。同上 |
| | `logic/catalog/testSupport/identityKeys.ts` | 識別キーに生地を含む。同上 |
| | `state/doughSelection.ts` | `pizzaWithDough` / Guided 開始時の生地設定。同上。`doughSwitchOffered` は `resolveDoughKind(recipe) === "standard"` を条件にしており、Guided 側の挙動は変わらない |
| | `data/recipes.ts` | `Recipe.doughKind?` の型のみ |
| | `data/lateCatalog.ts` | `doughKind?: DoughKind` の型と、validator の `isDoughKind`（A が一般化されれば追随） |
| | `logic/dough/doughOutline.ts` | `OVAL_DOUGH_KINDS` に入れなければ丸のまま。「Piadina は丸」をテストで固定 |
| **C. リテラルまたは個別ロジックの修正が必須** | `logic/techniques/detection.ts` | `PINSA_DOUGH` リテラルと `usesPinsaDough` / `requiresPinsaDough`、`detectTechniquesUsed` / `requiredTechniquesOf` の技法 id 分岐。新技法の分岐の追加（または生地→技法の対応表への一般化） |
| | `components/DoughKindSwitch.tsx` | チップが 2 個固定（plain / other）で、2 つ目のリテラルが Pinsa。§5 の設計判断が前提 |
| | `screens/GameScreen.tsx` | チップへの props（`selected`、ラベル）と `doughSwitchOffered` の呼び出し |
| | `state/pendingRound.ts` | 保存時の `dough` を `isDoughKind` で検証し、未知値を `unresolvable` にする（§6） |
| **D. テスト支援（型リテラル）** | `logic/testSupport/lateFinishSim.ts`、`logic/testSupport/researchAttemptSim.ts` | 生地を `"material-multigrain-long-ferment"` の 1 値として扱うシミュレータ。3 値に一般化する |

14 件のほかに必要な変更（Pinsa の前例どおり）:

| 区分 | 対象 |
|---|---|
| 技法 | `data/techniques.ts`（`TechniqueId` に新 id、定義 = 名前・なぞかけ・説明）、`logic/techniques/doughSwitch.ts`（`DOUGH_TECHNIQUE_ID` が単一定数。複数技法に対応する形へ）、`registration.ts`（affordance は id ごとに導出され、概ね汎用） |
| Preview | `preview/doughKindPreview.ts`（`?doughSwitch=open` の挙動） |
| レシピのデータ | レシピ本体（`recipes.ts` または `lateCatalog.ts`）、`recipeSauceProfiles`（null）、`recipeHintRoles`（key-free）、`referencePizza`、`orders`、`discoveryCatalog` の target id、テストの allow-list（`techniqueAllowlists.ts`、`recipeBatchManifest.ts`、`lateIds.ts` ほか） |
| テスト | `doughKind.test.ts:24` の「`RECIPES` に `doughKind` を持つ項目はない（例外は pinsa-romana）」の pin。Piadina を足すなら例外の更新が要る |

## 4. Pinsa との共存

- **識別.** `dough` の値が別（`flatbread-unleavened` と `material-multigrain-long-ferment`）。ソースの有無でも別（Piadina は NO_SAUCE、Pinsa は tomato-sauce）。完全一致の衝突はない。
- **技法.** 1 技法 1 生地の方針なら Piadina 専用の技法 id が新設される。`detection.ts` の判定は技法 id ごとの独立した関数なので、Pinsa の判定を壊さずに足せる。
- **late 軸.** Piadina を「全て焼成前」とすれば `late` は空で、Pinsa（ルッコラ後乗せ）と軸が重ならない。後乗せにするなら Pinsa と同型（§7）。
- **既存データの保全.** jamon-serrano への副作用（D2: 標準生地 + ルッコラ後乗せは ORIGINAL）は Piadina で増えない。ただし 3 値目のテーブル（#636 の組合せ表）の再実行が要る。
- **ヒント経済シミュレータ.** `discoveryHintEconomySim` / `hint5EconomySim` / `researchAttemptSim` は Pinsa の生地を個別に扱っている。3 値に一般化する必要がある。

## 5. Anti-Oracle（G5: HOLD）

現行の設計は「生地チップは発見状況に関わらず中立」で、次の性質を持つ（`DoughKindSwitch.tsx` のコメント）:

- 発見前は「ふつうの生地」/「ほかの生地」。技法を発見した後は、2 つ目のチップが技法名（「ピンサ生地」）になる。選択しただけでは名前を出さない。
- 生の生地値と技法 id は画面に出さない（`data-dough-choice` は `plain` / `other`）。
- チップの表示条件は、技法 1 つ（`dough-pinsa-romana`）の affordance だけで導出される（`doughSwitch.ts`）。

3 値目で変わる点と、決めるべきこと:

| 論点 | 内容 | 案（助言） |
|---|---|---|
| チップの数 | 3 個にすると、他にも生地があることが分かる。ただし生地の種類の数は全プレイヤー共通の事実で、特定レシピの食材やヒントではない | A: 実装済みの種類の数だけ常時表示 / B: 「ほかの生地」1 個 → 開いた先で選ぶ / C: 発見済みの技法の数だけ名前付きにし、残りは中立の 1 個 |
| 開く条件 | 現行は Pinsa の affordance（ルッコラの step 33 付近）。Piadina のチップを別の時点で開くと、新しい生地があることが分かる | チップを開く条件は「いずれかの生地技法の affordance が開いた」に統一し、どの生地かは出さない |
| ラベル | 発見後に名前が出るのは 1 チップのみ | 発見済みの技法ごとに自分の名前、未発見は中立（複数の未発見チップが同一ラベルになる点を許容するか） |
| DOM | `data-dough-choice` の値が `plain` / `other` の 2 値 | 3 値目の識別子が生地の順序や種類を漏らさない中立的な表現（例: 位置のみ） |
| Research の発見 | Piadina は NO_SAUCE のため、no-sauce 技法の affordance と同時に開く可能性がある | 技法の組合せごとの漏えいを DH4 の掃引（`GATE_STATES`）に加えて再実行 |

いずれも**設計の選択であり、Owner 判断が必要**（§9）。

## 6. 保存互換（G6: HOLD）

| 対象 | 結果 |
|---|---|
| 技法の台帳（`discoveredTechniqueIds`） | **前方互換**。この版が知らない整形式の id は `writeSave` が保持し、上限（64）の中で温存する（`persistence.ts` の 195〜203 行・749 行付近）。新技法 id を旧ビルドが消すことはない |
| 図鑑（Dex） | レシピ id のみ。生地は保存しない。新レシピの id は旧ビルドの保存で未知のレシピとして扱われる（#668 の R4/R5 の範囲。生地のサブフィールドは足さない前提） |
| `PizzaState.dough` の保存（`pendingRound`） | **旧ビルドで「処理不能」になる**。`pendingRound.ts:233` が `dough` を `isDoughKind` で検証し、未知値は `unresolvable`。新ビルドで Piadina の生地を選んだ中断ラウンドが保存され、その後旧ビルドへ戻すと、旧ビルドは pendingRound を保持して journal の枠を埋める（FINISH 本番 ON 下ではフリー/リサーチの焼成と CUT/FINISH 付きのガイド付き調理が止まる）。#666 の退避機能が緩和策だが、**この Gate は #666 に依存させない**。条件は「中断ラウンド + 旧ビルドへのロールバック」で、頻度は低い |
| ラダー・entitlement | 新材料なしのため `LATE_ENTITLEMENT_FLOORS` は不要 |

保存互換の対応案（Owner 判断）: (a) リスクを受容、(b) 3 値目の公開を #666 の merge 後にする、(c) `pendingRound` の `dough` 検証を、未知値は `standard` として扱いつつラウンドは保持する形へ変える（ただし `pendingRound.ts` は保存の安全性に関わる HOT ファイルで、別 Issue 相当の変更）。

## 7. 工程: 焼成前トッピングのみ / FINISH の比較（G7: HOLD）

原典に投入時機の記載はない（§8）。実在のピアディーナは、焼いた生地に生ハム・ルッコラをのせる料理だが、これはこの環境では**確認できていない一般知識**であり、証拠として扱わない。

| 項目 | 案 P: 全て焼成前（通常カタログ） | 案 F: ルッコラ（と生ハム）を焼成後（late catalog） |
|---|---|---|
| カタログ | `recipes.ts`（HOT）。`doughKind` を持つ通常レシピは前例がない（`doughKind.test.ts:24` の pin を更新） | `lateCatalog.ts`。Pinsa（P3-b）と同型。`ladderCredit:false` は D1 の例外で足りる（後乗せ専用の材料を要求しないことの検証を満たす） |
| 必要な機構 | 生地チップのみ | 生地チップ + FINISH（トッピングのみ。既存） |
| late 軸・技法 `late-addition` | 触れない | Piadina の `late` が非空になり、`late-addition` の affordance は Pinsa（step 33）で既に開いているため新しい漏えいは増えない見込み。ただし D3 の漏えい防止テストを Piadina でも通す |
| 工程タブ | DOUGH → CHEESE → TOPPING → BAKE（ソースなし） | 上記に FINISH が加わる（6 タブ以内） |
| Lunch Rush | `lunchRush:false` を明示すれば除外 | 必須（`lunchRush:false`） |
| リング | cream-cheese 2 / prosciutto-crudo 3 / arugula 2 = 7 ピース ≤ 8（個数は暫定） | 同じ。後乗せ 2〜5 ピース。Q-5 の正式上限は未決のため、後乗せ数を Pinsa（2）を超えない範囲にする |
| 描画の確認面 | 焼成フィルタ越し | 焼成前・後乗せの 2 面（Style Lock §10.4） |
| 実績 | 前例なし | Pinsa、ikura、yuzu、dengaku |
| 原典との整合 | 原典が焼成後なら乖離 | 原典が焼成前のみなら乖離 |

どちらを選んでも新しい材料・ラダー step は不要。**どちらかは原典確認（または Owner の暫定仕様の承認）の結果で決まる。**

## 8. 原典未確認事項（Owner が確認または暫定承認する）

| # | 項目 | 影響 |
|---|---|---|
| P-1 | 個別ページの URL（比較表 p7 のみ） | 証跡の出典 |
| P-2 | 生ハム・ルッコラ・クリームチーズの投入時機 | 案 P / 案 F の選択 |
| P-3 | クリームチーズの役割（生地に塗るか、具材か）。ゲームでは具材（チーズカテゴリ）として扱う | 工程（CHEESE か TOPPING か）、ソースとの区別 |
| P-4 | 焼き方（オーブンか鉄板か）、焼成時間 | 焼成窓（暫定 58–78 は Free Cooking と同値の GAMEPLAY CALIBRATION） |
| P-5 | 個数 | 暫定値 |
| P-6 | Pinsa との区別（#577 の PK-0 項目 5） | 識別の根拠 |
| P-7 | 形・大きさ（丸でよいか） | 描画（丸なら追加の特例なし） |
| P-8 | 「無発酵」の扱い（見た目・採点に反映するか） | 最初は**識別のみ**（Pinsa と同様）が安全 |

pizzadb.jp は本環境から到達不可。U1・U2 と同様、**Owner が承認する暫定仕様**として扱う場合は、暫定であることをレシピ定義のコメントに明記する。

## 9. Owner 決定項目

| ID | 決定 | 助言 |
|---|---|---|
| D-P1 | 生地チップの設計（§5 の A / B / C） | 実装前に Owner が選ぶ |
| D-P2 | 技法は 1 生地 1 技法でよいか（設計書 Q3 の Piadina 分） | 1 技法 1 生地の延長が最小 |
| D-P3 | 案 P か案 F か（§7） | 原典 P-2 の結果次第 |
| D-P4 | 保存互換の扱い（§6 の a / b / c） | 3 値目の公開を #666 の merge 後にする案 (b) は、依存が増えるがリスクが最小 |
| D-P5 | 識別のみで見た目・採点は変えない | 賛成。Pinsa の運用を踏襲 |
| D-P6 | 公開ゲート（`PIADINA_PRODUCTION` の 1 リテラル）を設けるか | Pinsa は専用ゲートで段階公開した。同じ方式が安全 |
| D-P7 | 説明文（技法名・なぞかけ・説明）の文言 | 技法の riddle は時機・食材を含めない（Anti-Oracle） |

## 10. 実装に進む場合の PR 分割案（承認後。いずれも未着手）

| PR | 内容 | 本番への影響 | 触るファイル |
|---|---|---|---|
| PD-1 | `DoughKind` の 3 値目 + 技法定義 + 検出・シミュレータの一般化（データなし） | なし（どのレシピも使わない） | §3 の A・C・D、`techniques.ts` |
| PD-2 | チップ UI（D-P1 の決定に従う）+ 漏えい防止テスト | なし（affordance が閉じている） | `DoughKindSwitch.tsx`、`GameScreen.tsx`、`doughSwitch.ts` |
| PD-3 | Piadina のデータ・専用ゲート OFF・ON/OFF 検証 | なし（ゲート OFF） | レシピ、profile、hint role、Reference、order、target id、テストの allow-list |
| PD-4 | 公開（1 リテラル） | あり（Owner の実機 HV と最終承認） | `piadinaGate.ts` のみ |

HOT ファイル（`recipes.ts`、`GameScreen.tsx`、`App.css`、`gameReducer.ts`、`persistence.ts`、HANDOFF）との衝突に注意し、着手時に #577 へ claim を投稿する。#577 の既存 claim は 10/23〜10/30 のもので、いずれも Pinsa の範囲。

## 11. 重複確認（2026-10-26）

- open の PR/Issue で Piadina / ピアディーナを扱うものは無い（検索で #577・#532 系のみ）。
- #577 に Piadina の claim は無い。
- 関連の既存文書: `TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md`（§1.3・§12 Q3・「Piadina / Manakish は Pinsa の P3 の着地後」）、`TETO_DOUGH-KIND_P3_DECISION-MATERIALS.md`（項目 5）、`TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`。

## 12. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、golden、データ、workflow、本番スイッチ、`PROJECT_HANDOFF.md`、#650 の 4 ファイル、Batch-9 決定記録、共有 Preview、Production、Firebase、保存データ、#666 とその HV。Issue/PR へのコメント投稿・クローズ、CI の再実行、Codex の再依頼、Monitor の作成はしていない。
