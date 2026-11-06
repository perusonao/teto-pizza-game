# #577 生地の種類 — G5〜G8 と 5 レシピの解放条件（docs-only、レシピ拡張の線、Refs #577 #773）

作成: 2026-11-06 / 基準 `main` = `ed159e9` / ブランチ `claude/teto-pizza-issue-773-nlyntr`
性質: 整理のみ。`src/**`・既存 docs・既存 PR は変更していない。**実装・claim 投稿・Issue／PR 作成はしていない。**
位置づけ: Owner 方針（2026-11-06）により、DOUGH_VARIANT #577 は**レシピ拡張として別に進める。新調理方法の追加数には含めない。**
「推奨」は助言であり Owner Decision ではない。数値は【実測】【推論】【未確認】で区別。原典（pizzadb.jp）は本環境から到達できず、**全て未確認**。

親資料: `docs/design/TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`（G1〜G8、D-P1〜D-P7、PD-1〜PD-4）、`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`、#577 のコメント（Pinsa の Owner 判断）、ブランチ `claude/teto-pizza-parallel-plan-sh894e` の `TETO_CONTENT-POOL_S2_Result.md`（Jaccard 静的ゲート）。

---

## 0. 結論（先に）

1. **「5 レシピ」は 5 種類の生地**を要求する【実測】。1 つの 3 値目で 5 本は出ない。D-P2（1 生地 1 技法）を維持すると、**生地 5 種＋技法 5 つ＋生地チップの一般化**になる。
2. **解放の難しさは大きく 2 段。**
   - **第 1 段（Piadina・Argentine）:** 食材集合の完全一致が出荷済みレシピに無い。必要なのは G5〜G8 の判断と NO_SAUCE の扱い。
   - **第 2 段（Cauliflower・Fathead・NY）:** 食材集合が出荷済み／未出荷の別レシピと同じで、**生地だけで区別される**（`margherita`／`pepperoni` が出荷済みの相手）。Pinsa のハモンセラーノと同じ副作用を、生地ごとに Owner が許容するかの判断が要る。
3. **5 レシピは全て新食材 0**【実測】。ただし 4 行は原典の個別ページ未確認、NY は生地の原文記述が無い（`doughStyleRaw: null`、`thin-large-pliable` は推論）。
4. **進め方（助言）:** PD-1（`DoughKind` を N 値に一般化、データなし・本番影響なし）を**1 回だけ**行い、レシピは 1 本ずつ PD-3（データ＋専用ゲート OFF）と PD-4（公開）に分ける。最初は Piadina（唯一の READY、衝突なし）。
5. **claim・PR の重なりなし**【実測】: #577 の claim は全て 10/23〜10/30 に失効、open PR に #577 の線は無い。PD-1 の着手前に新しい claim が要る。

---

## 1. 5 レシピの事実（マトリクス行、【実測】）

| # | 行（`evidenceId`） | 状態 | 食材（全て既存） | ソース | 生地（variant） | 生地の原文 | レビュー項目 |
|---|---|---|---|---|---|---|---|
| 1 | `piadina-romagnola-pizzadb-p7` | **READY** | arugula, cream-cheese, prosciutto-crudo | ノンソース | `flatbread-unleavened` | 薄い無発酵の平焼き生地 | なし |
| 2 | `argentine-napolitana-pizzadb-p1` | READY_WITH_REVIEW | fresh-tomato, garlic, mozzarella, oregano, parmigiano | 「チーズ」＝ソース無し | `thick-fluffy` | 厚みのあるふんわりした生地 | NAMING_CLUSTER（Napoletana 3 つ） |
| 3 | `ny-style-pizzadb` | READY_WITH_REVIEW | mozzarella, tomato-sauce | トマトソース（明記） | `thin-large-pliable` | **記載なし**（`doughStyleRaw: null`） | 食材集合が `greek-style`・`stuffed-crust`（未出荷行）と同じ、SERVE_FORM は推論 |
| 4 | `cauliflower-crust-pizza-pizzadb-p2` | READY_WITH_REVIEW | basil, mozzarella, tomato-sauce | トマトソース（family 由来） | `material-cauliflower` | カリフラワーを主原料にした低糖質生地 | **食材集合が出荷済み `margherita` と同じ** |
| 5 | `fathead-pizza-keto-pizzadb-p9` | READY_WITH_REVIEW | mozzarella, pepperoni, tomato-sauce | トマトソース（family 由来） | `material-keto-mozzarella-almond` | モッツァレラ・アーモンドフラワーの低糖質生地 | **食材集合が出荷済み `pepperoni` と同じ**（未出荷の `detroit-style` とも） |

- 5 行とも要求機構は `DOUGH_VARIANT` のみ。後乗せ・下ごしらえの記載なし（`postBakeFinish`・`prep` は空）。
- 出荷済み 81 レシピとの食材集合の完全一致を機械で確認: #4 ⇔ `margherita`、#5 ⇔ `pepperoni`。**#1・#2・#3 は完全一致なし**【実測。`requiredIngredients` の集合比較】。
- 近さの指標（Jaccard）は別セッションの静的ゲート（新レシピは ≤ 0.4 を要求）では Piadina が 0.40（通過）、他は未確認／除外とされている【C1 の記録を読んだのみ。本セッションでは再計算していない＝未確認】。
- 同じ variant を使う他の行（将来の再利用）: `thick-fluffy` は #2 のほか `palmitos-salsa-golf`（BLOCKED）・`fugazzetta`（BLOCKED）。`roman` 系は 3 行（全て BLOCKED）。

---

## 2. G5〜G8 を 5 レシピへ一般化する

設計 Gate の G1〜G4 は Piadina 1 本について PASS／条件付き PASS。**HOLD は G5〜G8**。5 本に広げたときの意味は次のとおり。

| Gate | Piadina 1 本の HOLD の内容 | 5 本にしたときに変わる点 |
|---|---|---|
| **G5 Anti-Oracle（チップ UI）** | 生地チップが「ふつうの生地」／「ほかの生地」の 2 個固定。3 値目で漏えい面が変わる | 種類が 2〜6 になる。**案 A（種類の数だけ常時表示）は「他にも生地がある」数を漏らす**。案 B（「ほかの生地」1 個→開いた先で選ぶ）は何種類でも同じ表示で、**5 本には B が最も安全**【推論】。案 C（発見済みだけ名前）は未発見チップが複数並ぶ。D-P1 は **N 個を前提に決め直す** |
| **G6 保存互換** | `pendingRound` の `dough` が旧ビルドで「処理不能」になる（中断ラウンド＋旧ビルドへの戻し） | 値が 1 つ増えるごとに同じ。**1 回の PD-1 で N 値分を入れる**ほうが、段階公開を何度も繰り返すより戻しのリスクが少ない（公開は専用ゲートで 1 種ずつ）【推論】。(a) 受容／(b) #666 後（満たされた）／(c) 未知値を `standard` 扱い、のどれか（D-P4） |
| **G7 工程（焼成前／後乗せ）** | Piadina は生ハム・ルッコラの投入時機が原典に無い（案 P 全て焼成前／案 F 後乗せ） | **Piadina だけの問題**。他 4 行は `postBakeFinish` が空で、データ上は全て焼成前。時機の記載が無いことを確認していない点は同じ（未確認） |
| **G8 原典** | 比較表 p7 のみ。個別ページ未確認 | **5 行とも比較表の行のみ**。#3 は生地の原文が無い。#4・#5 は「材料（生地そのもの）」が生地の中身で、食材として在庫を使うかが原典から分からない |

### 2.1 追加で決めること（5 本にしたことで新しく出る）
| ID | 論点 | 助言 |
|---|---|---|
| **D-F1** | 技法の数: 1 生地 1 技法（D-P2）のままだと技法が 5 つ増える。「生地の仕立て」のような 1 技法にまとめるか | 最小の延長は 1 生地 1 技法。ただし Dex の技法欄が一気に増えるため、Owner が数を許容するか |
| **D-F2** | **NO_SAUCE の扱い**（#1・#2 はソース無し）。出荷済みの NO_SAUCE は Owner 例外で個別承認され（例: `potato-mayo-pizza`、`aussie` の機構）、no-sauce の技法の affordance と同時に開く可能性がある（設計 Gate §5 の最終行） | レシピごとに Owner が NO_SAUCE を承認。DH4 掃引に「技法の組合せ」を足して再実行 |
| **D-F3** | 生地の中身が食材名と重なる（#4 カリフラワー、#5 モッツァレラ・アーモンド）。**生地そのものは在庫を消費しない**扱いでよいか（Pinsa の前例）。カタログに `cauliflower` は無い | 生地は在庫を使わない（前例どおり）。新しい食材 id は作らない |
| **D-F4** | 生地だけで区別される（#3・#4・#5）。標準生地で同じ食材を作った場合の扱い（Pinsa のハモンセラーノは「ORIGINAL になりうる副作用」を Owner が条件つきで検討中） | #636 の組合せ表（`doughLateMatrix.test.ts`）に新種を足して全行テスト。許容は Owner 判断。まず Piadina と Argentine を先行 |
| **D-F5** | 公開ゲート: `PIADINA_PRODUCTION` 方式（レシピごとの 1 リテラル）か、生地種ごとに 1 リテラルか | 生地種ごと（PD-4 が 1 リテラル、HV も 1 種ずつ） |
| **D-F6** | 解放（発見）の条件: 生地チップの affordance は Pinsa では step 33 付近の食材で開く。新しい生地のチップは**同じ affordance に統一**するか（別の時点で開くと「新しい生地がある」ことが漏れる） | 統一（設計 Gate §5 の助言どおり） |

---

## 3. レシピ別の解放条件

「Gate 条件」は 2 章の G5〜G8 と D-F1〜D-F6 に加えて各レシピ固有のもの。共通で必要: `ladderCredit: false`・`lunchRush: false`・CUT なし（暫定）・key-free Hint・Research の単独コホート・DH4 掃引の再実行・#636 組合せ表の更新・暫定仕様であることのコメント（OD-B9-17 パターン）。

| # | レシピ | 固有の解放条件 | 状態 |
|---|---|---|---|
| 1 | **piadina-romagnola** | G5〜G8 全て／D-P1〜D-P7／投入時機（案 P か F、P-2）／クリームチーズの役割（P-3、ゲームでは具材）／NO_SAUCE（D-F2）／無発酵を見た目・採点に反映しない（P-8、最初は識別のみ）／Pinsa との区別（原典項目 5）。発見の食材: arugula（step 33）・prosciutto-crudo（31）・cream-cheese（37）【10/26 時点の記録。ラダーは append-only のため不変の見込み、要再確認】 | **最有力**（READY・衝突なし・新食材 0） |
| 2 | **argentine-napolitana** | G5・G6・G8／NO_SAUCE（D-F2）／Napoletana の命名クラスタ（3 つ）の Research ラベルが他と混ざらないこと／`thick-fluffy` を他の将来行（fugazzetta・palmitos）と共有する設計 | Piadina の次（ブロッカーなし、レビュー項目 1） |
| 3 | **ny-style** | G5・G6・G8／**生地の原文なし**（`thin-large-pliable` は推論）→ 原典か Owner の暫定承認が先／食材 2 つ（mozzarella・tomato-sauce）だけの最小レシピで、`margherita`（Jaccard 2/3）との区別が生地のみ（D-F4）／未出荷の `greek-style`・`stuffed-crust` と食材集合が同じ | 条件が最も多い。原典待ち |
| 4 | **cauliflower-crust** | G5・G6・G8／D-F3（生地の素材）／**`margherita` と食材集合が完全一致**（D-F4）。標準生地の margherita と別識別になる（Hint・Research・Dex への影響を DH4 で確認） | 副作用の許容後 |
| 5 | **fathead（ケト）** | 同上／**`pepperoni` と食材集合が完全一致**（D-F4）／D-F3（モッツァレラ・アーモンドの生地） | 副作用の許容後 |

### 3.1 解放順の案（助言）
`piadina` → `argentine-napolitana` → （D-F4 の許容後）`cauliflower` ・ `fathead` → `ny-style`（原典または暫定承認後）。1 種ずつ PD-3（データ・ゲート OFF）→ PD-4（公開）。

---

## 4. 実装順（Owner 判断の後）

| PR | 内容 | 本番影響 | 触るファイル（設計 Gate §3・§10） | 競合 |
|---|---|---|---|---|
| PD-1 | `DoughKind` を N 値に一般化＋技法定義＋検出・シミュレータの一般化（**データなし**） | なし | `doughKind.ts`、`techniques.ts`、`logic/techniques/*`、シミュレータ 2 本 | 新規・局所。HOT なし |
| PD-2 | チップ UI（D-P1 の決定、N 個前提）＋漏えい防止テスト | なし（affordance 閉） | `DoughKindSwitch.tsx`、`GameScreen.tsx`（HOT）、`doughSwitch.ts` | **#738 の merge 後**（`GameScreen.tsx`） |
| PD-3 ×5 | 1 種ずつのレシピデータ＋専用ゲート OFF＋ON/OFF 検証 | なし | `recipes.ts`（HOT）または `lateCatalog.ts`、profile、hint role、Reference、order、target id、allow-list | `recipes.ts` は Batch 19（#748）と同じ HOT。claim 確認 |
| PD-4 ×5 | 公開（1 リテラル） | あり | `*Gate.ts` のみ | Owner の実機 HV と承認 |

- **#579（DRIZZLE）とは独立。** 触るファイルが別で、同時に進めてよい（ただし進行中 PR の上限 2 件の判断は Owner）。
- 並行の注意: PD-2 は `GameScreen.tsx`・`App.tsx` を含むため、STEAM #738、FRY F3、DRIZZLE D5 と**直列**にする。

---

## 5. 残る Owner 判断（#577）

| ID | 論点 | 助言 |
|---|---|---|
| D-P1（N 個版） | 生地チップの設計 | 案 B（「ほかの生地」1 個→選択画面） |
| D-P2／D-F1 | 技法の数 | 1 生地 1 技法（数の許容は Owner） |
| D-P3 | Piadina の工程（案 P／F） | 原典が取れるまで案 F（late catalog）を暫定、暫定仕様と明記 |
| D-P4 | 保存互換 | (b)（前提の #666 は merge 済み）または (a) |
| D-P6／D-F5 | 公開ゲートの粒度 | 生地種ごと |
| D-F2 | NO_SAUCE の承認（#1・#2） | レシピごと |
| D-F3 | 生地の素材は在庫を使わない | 前例どおり |
| D-F4 | 生地だけで区別される副作用の許容（#3〜#5） | #636 の表で全行テストした後に判断 |
| D-F6 | 解放の affordance の統一 | 統一 |
| 原典（G8） | 5 行の個別ページ、Piadina の工程、NY の生地記述 | 担当セッションが取得を試み、不可なら URL とエラーを渡して ChatGPT 側へ（SESSION-OPERATIONS §8-2）。**未確認のまま確定しない** |

## 6. 未確認事項
- 5 行の原典は全て未確認（比較表の行のみ）。NY の生地は推論。
- Jaccard は他セッションの記録を読んだのみ。本セッションでは再計算していない。
- 出荷済み 81 レシピとの完全一致は `requiredIngredients` の集合比較で、late catalog（`lateCatalog.ts`）のレシピは含めていない。
- 設計 Gate の 14 ファイル影響表は 10/26 時点で、main の進行後の再確認はしていない。
- 楽しさ・難易度は実測なし。アプリ実行・テスト実行は未実施。
