# T24〜T26 Owner 判断の記録と追加調査（#780、docs のみ）

2026-11-10 / 基準 `main` `7a217c38`。承認パケット本体は `TETO_T24-T26_ApprovalPacket_2026-11-10.md`（以下「パケット」）。本書はその後の Owner 判断と、指示された 4 件の追加調査の結果。

- **実装・HOT 編集・merge・Production ON・共有 Preview 更新はしていない。** 変更は `docs/reports/TETO_T24-T26_*` と `docs/reports/data/TETO_T24-T26_PREP/**` のみ。
- #815（B23-b）・#816（content-train）のファイルと branch には触れていない。#816 の道具は一時的な作業ツリーで読み取り実行しただけ。
- 凡例: 【実測】この環境で実行・取得、【原典】pizzadb.jp の記載、【推論】、【提案】。

---

## 0. 結論

1. **原典を取得できた【実測】。** banh-mi・elote とも、**NO_SAUCE は原典で確認できない**。elote は原典のソース欄が「ホワイトソース」で、NO_SAUCE は原典と食い違う。
2. **推奨【提案】**: elote は出荷済みの `sour-cream` を下地にする（NO_SAUCE にしない）。banh-mi は `liver-pate` を塗り層として扱う（NO_SAUCE にしない）。どちらも事前検査は STOP 0・Research 正準 0【実測】。
3. **28 件の分類**: 承認済み 7／保留 2／追加確認 19（§3）。追加確認 19 は 4 つの束にまとめられる。
4. **Research 追補を実測した【実測】。** 列車を順に出荷した想定で、**出荷済み ID の正準順の変化は 3 段とも 0**。先行列車の品に対する追補は **5 行、すべて最大ずれ 1**（パケットの見込み「最大 2」より小さい）。
5. **nduja の追加で既存に動くものは無い【実測】。** 既存レシピの組成・パック・Hint 梯子・保存形式は不変。実装時に追従が要る既存テストが 1 件ある（§5）。
6. §6 の 6 問は Owner の 2 回目の判断ですべて確定した（§7）。**残る Owner 判断は 0。** 確定した実装対象はレシピ 15・新食材 17。

---

## 1. Owner 判断の記録（2026-11-10、会話での指示）

| # | 判断 | 内容 |
|---|---|---|
| C-1 | 承認 | 構成は R1 |
| C-3 | 承認 | 170 番目の食材は新規 id `nduja`。squid は既存 170 行に含まれる候補として扱う |
| C-4 | 暫定承認 | 新ソース 6 色の代替案。最終採用は iPhone HV 後 |
| 25-2・25-3 | **未承認** | banh-mi・elote の NO_SAUCE は原典調査後に再判断 |
| 26-2 | 承認 | nashville の honey は焼成前の層。M7 への依存は追加しない |
| C-7 | 承認 | #815 の merge と正式な claim release の後、T24 から順に実装。PR 専用 HV ページの準備は許可。共有 Preview と Production は変更しない |
| その他 | — | **未提示の項目を無条件に承認したものとは扱わない** |

Owner がこの内容を Issue／PR に直接記録した場合は、そちらが正本。

---

## 2. 原典調査 — banh-mi・elote の NO_SAUCE

### 2.1 取得【実測】

pizzadb.jp はセッションのネットワーク設定で遮断されていた（プロキシ 403）。Owner の承認で pizzadb.jp だけを許可した個人用環境 `teto-pizza` を作り、次を取得した（2026-11-10、すべて HTTP 200）。

| ページ | 対象 |
|---|---|
| `https://pizzadb.jp/compare/world-pizzas/page/6/`、`/pizzas/banh-mi-pizza/` | バインミーピザ |
| `https://pizzadb.jp/compare/world-pizzas/page/13/`、`/pizzas/elote-pizza/` | メキシカンエロテピザ |
| `https://pizzadb.jp/compare/world-pizzas/page/14/`、`/pizzas/nduja-pizza/` | ンドゥイヤピザ（§5 用） |

一覧ページの値（生地・ソース欄・具材）は、repo の `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` の行と一致した。個別ページの参考資料（外部サイト）は未取得。

### 2.2 banh-mi-pizza

| 項目 | 原典の記載【原典】 |
|---|---|
| ソース欄 | 「その他」 |
| 具材 | レバーパテ、にんじん、大根、コリアンダー、ハム、モッツァレラチーズ |
| ソースについて | 「バインミーの具材を使う範囲やソースは作り手によって異なり」「辛味のあるソースが添えられる場合は、少しずつ加えて」 |
| パテについて | 「生地全体に薄く広げるか、部分ごとに載せるかでも、一切れの味のバランスが変わります」「薄い生地では塗りすぎを避け」 |
| 焼成の前後 | 「パテやハム、チーズは生地と一緒に焼き、なますやコリアンダーは焼き上がってから加える方法があります」 |

- 特定のベースソース名は無い。「ソースなし」と書いた箇所も無い。**NO_SAUCE は原典で確認できない**（D-2: 原典で確認できない NO_SAUCE は禁止）。
- パテを生地に塗る扱いは原典に根拠がある。
- なます（にんじん・大根）とコリアンダーを焼成後に載せる扱いも原典に根拠がある（late 配置と整合）。

**推奨【提案】: 案 B — `liver-pate` を塗り層（spread、数量 1）として扱い、NO_SAUCE にしない。**

| 案 | 内容 | 事前検査【実測】 | 留意点 |
|---|---|---|---|
| A | NO_SAUCE（Owner の GAMEPLAY 判断、apple-cinnamon の先例） | STOP 0。先頭 rung は CHEESE | 原典の裏づけなし。D-2 の例外を 1 件増やす |
| **B（推奨）** | liver-pate を塗り層にする | STOP 0、正準 0、非正準 59 ID（変化なし）。先頭 rung は SAUCE | 塗り層が 7 色目になる。自然な色 `#a9796b` は tahini と dE 16.3 で不可、代替 `#af7387`（最小 dE 28.1、相手 fresh-cream-sauce）【暫定】 |
| C | T25 から外して後続へ | — | 食材 daikon・liver-pate の出荷が遅れる（T25 の新食材 8 → 6） |

スペック: A = `T25-R2a.spec.md`、B = `T25-R2b.spec.md`。

### 2.3 mexican-elote-pizza

| 項目 | 原典の記載【原典】 |
|---|---|
| ソース欄 | 「ホワイトソース」 |
| 具材 | コーン、マヨネーズ、コティーハチーズ、チリパウダー、ライム |
| ソースについて | 見出し「とうもろこしとクリーミーなソース」。「マヨネーズやクリーム状のソースを多く使うと…」「焼く前にソースを塗るか、焼き上がりに細くかけるかでも風味が異なります」 |
| ライム・チリ | 「ライムやチリは最後に加える方法もあり、熱で香りが弱まるのを抑えやすくなります」 |
| チーズ | 「コティーハチーズが手に入らなければ、パルメザンチーズで代用できます」 |

- 原典は白いクリーム状のソースがある前提で書かれている。**NO_SAUCE は原典と食い違う。**
- ライムを焼成後に加える扱いは原典に根拠がある（R1 の late 配置・D-5 と整合）。
- cotija → feta、chili-powder → paprika-powder は staged の別名の暫定ルール（I-1）のまま。原典の代用例は parmesan で、feta とは書いていない。

**推奨【提案】: NO_SAUCE にせず、出荷済みの `sour-cream` 1 を下地にする。**

| 案 | 内容 | 事前検査【実測】 | 留意点 |
|---|---|---|---|
| A | NO_SAUCE | STOP 0 | 原典と食い違う |
| **B（推奨）** | sour-cream 1 を下地（mayo はトッピングのまま） | STOP 0、正準 0、非正準 59 ID（変化なし）、重複 0。先頭 rung は SAUCE | sour-cream を選ぶのは GAMEPLAY ASSUMPTION（原典は「ホワイトソース」「クリーム状のソース」までで、製品名は無い）。新しい色は不要 |
| C | mayo をソース扱いに変える | 未検査 | 出荷済み食材のカテゴリ変更になり、既存レシピに波及するため非推奨 |

スペック: B は `T25-R2a.spec.md` と `T25-R2b.spec.md` の両方に入れてある。

---

## 3. 承認表 28 件の分類

### 承認済み（7）

| # | 内容 | 根拠 |
|---|---|---|
| C-1 | R1 構成 | Owner 判断 |
| C-3 | 170 番目 = `nduja` | Owner 判断 |
| C-4 | 新ソース 6 色（暫定、最終は HV 後） | Owner 判断 |
| C-7 | 進行と PR 専用 HV ページの準備 | Owner 判断 |
| 26-2 | nashville の honey は焼成前 | Owner 判断 |
| 26-3 | nduja-pizza は sausage の代用をやめ nduja 2 | C-3 と同一事項 |
| 26-4 | keema-pizza を T26 から外す | R1 の定義そのもの（C-1） |

26-4 の「T27 で cumin と一緒に再設計」という行き先は未承認（T27 のパケットで扱う）。

### 保留（2）— 原典調査済み、§2 の推奨で再判断

| # | 内容 | 推奨 |
|---|---|---|
| 25-2 | banh-mi-pizza のソース | 案 B（liver-pate を塗り層） |
| 25-3 | mexican-elote-pizza のソース | 案 B（sour-cream を下地） |

### 追加確認（19）— 4 つの束

| 束 | 項目 | 内容 | 推奨 |
|---|---|---|---|
| **G1 先例どおりの定型**（5） | C-2、24-5、24-6、26-1、26-5 | 暫定仕様値を GAMEPLAY ASSUMPTION として扱う／peking-duck を 1 食材（I-3 の暫定ルール）／mussel・pickles のパック 10→20（価格不変）／nashville は `ladderCredit: false` | 承認 |
| **G2 Research**（4） | 24-7、25-8、26-6、C-5 | 非正準の表 43／59／9 ID と、追補 5 行（§4 の実測値に置き換え） | 表どおり承認 |
| **G3 重複例外 D-1**（6） | 24-1、24-2、24-3、24-4、25-6 の重複分、25-7 | thai-chicken／frutti-di-mare（id を `frutti-di-mare` に）／diavola／south-african-boerewors／pizza-salad／pizza-asparagi-limone | 承認（各品に新食材か別のベースソースがある） |
| **G4 配置とソース下地**（4） | C-6、25-1、25-4、25-5 | 葉物・柑橘は焼成後で late 5 品／buffalo-cauliflower は buffalo-sauce を下地（buffalo-chicken と 1 材料差）／chicken-tikka は curry-ketchup を下地（Jaccard 超過 4 件）／pizza-salad は tomato-sauce＋yogurt-sauce の 2 層 | 承認 |

25-6 は重複（G3）と 2 層（G4）の両方を含む。件数は G3 に数えた。

---

## 4. Research 追補の実測

方法【実測】: T24-R1 → T25-R2a → T26-R1 の順に出荷した想定で、各段を「それまでの列車を含むカタログ」に対して測った。main（102／117／87）と #815 を載せた状態（104／122／89）の両方で実行し、結果は同一。全文は `data/TETO_T24-T26_PREP/research-sequence.md`。

- 正準順: 最終カタログの ladder 順（通常 ladder → 各列車の通常の新食材 → late ladder → 各列車の late の新食材）の全 prefix で、前後の文字を比較。
- 非正準: 決定的な上界（方向は実 authority `researchCohortLetters` から読む）と、乱数 40 順の標本監査との突合。

| 段 | 基準のレシピ数 | 追加 | 正準順の変化: 出荷済み ID | 正準順の変化: 先行列車の ID | 標本監査との不一致 | 非正準: 出荷済み ID |
|---|---:|---:|---:|---:|---:|---:|
| T24-R1 | 102 | 6 | **0** | — | 0 | 43 |
| T25-R2a | 108 | 7 | **0** | **0** | 0 | 59 |
| T26-R1 | 115 | 2 | **0** | **0** | 0 | 9 |

**追補（先行列車の品が、後続列車で受ける非正準の変化）— 5 行**

| 段 | 先に出荷される ID | 段（共有食材） | 方向・最大ずれ | 原因レシピ | 標本で観測した変化 |
|---|---|---|---|---|---|
| T25 | `peking-duck-pizza` | cucumber | 後ろへ最大 1 | pizza-salad | (なし)→B |
| T25 | `south-african-boerewors` | onion | 新設のみ | chicken-tikka-pizza | 観測なし |
| T25 | `thai-chicken-pizza` | cilantro | 後ろへ最大 1 | banh-mi-pizza（前に並ぶ）、chicken-tikka-pizza（後ろ） | (なし)→A、(なし)→B |
| T26 | `peruvian-aji-amarillo` | chicken | 後ろへ最大 1 | nashville-hot-chicken-pizza | (なし)→B |
| T26 | `thai-chicken-pizza` | chicken | 後ろへ最大 1 | nashville-hot-chicken-pizza | (なし)→B |

- パケット §4.1 の見込み（6 行、thai-chicken-pizza の cilantro は最大 2）を、この実測（5 行、すべて最大 1）に置き換える。A 構成だけの行（keema 起因）は R1 では発生しない。
- banh-mi を案 B（liver-pate を塗り層）にしても、有限食材の集合は同じなので表は変わらない【推論。T25-R2b の出荷済み 59 ID は R2a と同数であることは実測】。
- 限界: step 番号は実装 PR で決まる。同じ列車の中の新食材の並びが変わっても、正準順 0 の結論が変わるかは実装 PR のテストで再確認する（R-RES-1 のとおり、表の外は停止）。

---

## 5. nduja 追加の影響

| 観点 | 結果 |
|---|---|
| 原典【原典】 | 具材欄は「ソーセージ、モッツァレラチーズ、蜂蜜」。本文はこのソーセージを「柔らかく塗り広げられる豚肉のサラミ」ンドゥイヤとして説明し、「辛味の効いたサラミペーストで代用」する場合は「本物のンドゥイヤと混同させないように」と書く。**専用 id を立てる根拠になる** |
| 既存レシピ【実測】 | `nduja` を使うのは nduja-pizza だけ。出荷済みレシピの組成は不変。sausage のパック（k = 3）と honey のパック（k = 1）も不変。nduja のパックは 20（k = 2） |
| 重複ゲート【実測】 | nduja-pizza の重複 0。A 構成で出ていた salsiccia・salsiccia-e-friarielli との 1 材料差が消える |
| Research【実測】 | 正準 0。T26 の非正準は 33 ID → 9 ID（sausage の群に入らなくなるため。keema を外した分も含む）。nduja-pizza が関わるのは honey の段の `pesto-noci-pizza`（最大 2）だけ |
| Hint 5.0【実測】 | 出荷済みの梯子（golden）は不変。nduja-pizza の rung は SAUCE → CHEESE → STRUCTURE → SUB_CLASS。family は meat（`other` ではないので DH4-PROD の到達不能は予測されない） |
| ladder・ショップ【実測／推論】 | nduja-pizza は nduja の key レシピになれる（通常 step が 1 つ増える）。nduja は T26 の通常の新食材として最後に並ぶ想定で、正準順の変化は 0。価格帯は T4【推論】 |
| 保存【実測】 | `schemaVersion` 2 のまま、移行なし。nduja を知っているビルドは所持と在庫を保持し、読み込みで書き込まない。知らない旧ビルドは nduja だけ落として他を保持する（既知の制約 #668）。id `nduja` は出荷済みのレシピ・食材と衝突しない |

**実装時に追従が要るもの（本書では触れていない）**

1. `src/data/expansionBatch18.test.ts` に「nashville-hot-chicken-pizza・nduja-pizza は未出荷」を固定するテストがある。T26 の出荷で必ず失敗するので、Owner 判断 26-2・C-3 を根拠に更新する（Gate の緩和ではなく、判断が出たことへの追従）。
2. staged の nduja-pizza の行は sausage のまま（`src/data/staged/**` は T-FX の claim）。出荷時に生成器で外す従来どおりの追従で足りる。
3. 台帳（`TETO_CONTENT-MASTER_LEDGER_*`、#804 の claim）は 170 行のうち nutella-spread の統合行が残っている。nduja を 170 番目として載せる再生成は、台帳の担当が行う。
4. honey について原典は「焼成後に蜂蜜を少量たらすと…香りも残ります」「蜂蜜は必須の伝統的な具材ではなく」と書く。Owner 判断 26-2（焼成前）は GAMEPLAY ASSUMPTION として実装のコメントに明記する。再確認は求めない。
5. 専用 SVG・色・絵文字（G18 の一意）・Reference 配置は実装 PR で決める。

---

## 6. 残る Owner 判断（6 問）

| 問 | 内容 | 推奨 |
|---|---|---|
| Q1 | G1（定型 5 件）と G2（Research の表 3 本＋追補 5 行）を承認するか | 承認 |
| Q2 | G3（重複例外 6 件、`frutti-di-mare` への改名を含む）を承認するか | 承認 |
| Q3 | G4（late 5 品、buffalo-sauce／curry-ketchup の下地、pizza-salad の 2 層）を承認するか | 承認 |
| Q4 | banh-mi-pizza: 案 A（NO_SAUCE）／**案 B（liver-pate を塗り層、色 `#af7387` 暫定）**／案 C（T25 から外す） | 案 B |
| Q5 | mexican-elote-pizza: 案 A（NO_SAUCE）／**案 B（sour-cream を下地）** | 案 B |
| Q6 | keema-pizza の行き先を T27（cumin と再設計）とするか | 承認（T27 のパケットで仕様を出す） |

回答例: 「Q1〜Q3・Q6 承認、Q4 は B、Q5 は B」。

### 推奨どおりの場合の実装可能数と進捗

| 列車 | レシピ | 新食材 | STOP | 実装の可否 |
|---|---:|---:|---:|---|
| T24-R1 | 6 | 8（squid を含む） | 0 | Q1〜Q2 の承認で可 |
| T25（R2b） | 7 | 8（＋cucumber は T24） | 0 | Q1〜Q5 の承認で可 |
| T26-R1 | 2 | 1（nduja） | 0 | Q1 の承認で可 |
| 計 | **15** | **17** | 0 | |

食材 122 → 139／170（残 31）、レシピ 104 → 119／177（残 58）、調理法・工程 7／27（残 20）。目標 170／177／27 は変えていない。件数は #815 の merge を前提にした値。

### 往復の見込み

パケットの見積もり（最小 4／標準 6／悲観 9）のうち、「NO_SAUCE の原典確認」と「再検査で差分が出る」の 2 つは今回で解消した。**今回の 6 問への回答 1 回＋列車ごとの iPhone HV と merge 可否 3 回＝最小 4**、色の HV やり直しを見込んで**標準 5**。

---

## 7. Owner 判断（2 回目、2026-11-10、会話での指示）と確定した仕様

| 問 | 判断 |
|---|---|
| Q1・Q2・Q3・Q6 | 承認 |
| Q4 | banh-mi-pizza は `liver-pate` を塗り層として採用。NO_SAUCE にしない。色 `#af7387` は暫定採用、iPhone HV で最終判断 |
| Q5 | mexican-elote-pizza は `sour-cream` を下地に採用。NO_SAUCE にしない |
| 範囲 | **承認は #819 の具体的な仕様と Research 差分に限定。未知の変更は含めない** |
| 進行 | #815 の merge と正式な claim release までは T24 の HOT 実装を開始しない。無断 merge・Production ON・共有 Preview 更新は禁止 |

これで承認表 28 件は**すべて確定**（承認 28、うち色 7 色は暫定で HV 待ち）。§3 の「保留」「追加確認」は、この判断で承認済みに移った。

### 確定した実装対象

| 列車 | 正本のスペック | レシピ | 新食材 | 承認済みの Research（非正準） |
|---|---|---:|---:|---|
| T24 | `T24-R1.spec.md` | 6 | 8（aji-amarillo、chutney、cucumber、peanut-sauce、peking-duck、spicy-salami、squid、sweet-bean-sauce） | `T24-R1.preflight.md` §4 の 43 ID |
| T25 | `T25-R2b.spec.md` | 7 | 8（asparagus、cauliflower、chicken-tikka、daikon、kebab-sauce、lime、liver-pate〔塗り層〕、yogurt-sauce） | `T25-R2b.preflight.md` §4 の 59 ID ＋ §4 の追補 3 行 |
| T26 | `T26-R1.spec.md` | 2 | 1（nduja） | `T26-R1.preflight.md` §4 の 9 ID ＋ §4 の追補 2 行 |
| 計 | | **15** | **17** | 正準順の変化は 0 が必須（1 件でも出たら停止） |

- `T25-R1`・`T25-R2a` は検討の経過として残す。**T25 の正本は R2b**。
- 暫定色（HV で最終判断）: aji-amarillo `#ffe60f`、peanut-sauce `#faa078`、chutney `#876e00`、sweet-bean-sauce `#50001e`、kebab-sauce `#96af91`、yogurt-sauce `#cdd7ff`、liver-pate `#af7387`。色差基準 dE ≥ 25 は維持。
- 承認の外（実装中に出たら停止して Owner に戻す）: 表に無い ID・段・方向、表より大きいずれ、正準順の変化、スペックに無い材料・数量・配置の変更、既存 Gate の緩和、保存形式の変更。
- keema-pizza は T27 のパケットで cumin と一緒に仕様を出す（今回の実装対象外）。

## 8. PR #819 の CI

| 項目 | 内容【実測】 |
|---|---|
| 失敗した HEAD | `489f5cbb`、run 42865788056、job `build`、step「WebKit CI scripts tests」（`scripts/ci/test-webkit-ci.sh`）で **147／154**、exit 1 |
| 失敗した 7 件 | すべて `install-with-retry.sh` の apt ロック待ち・後始末の検査で、fixture の `fake-apt`（`sleep` の実体をコピーしたもの）が**生きていること**を前提にする検査 |
| タイムアウトか | **違う。** `deductionGuard.gate.test.ts` の 120 秒（#804・#815）とは別件。Vitest には到達していない |
| この PR が原因か | **違う。** この PR は `scripts/**`・`.github/**` を変更していない。同じ 147／154 が #818（run 42863158243、attempt 2）と #820（run 42866005929、attempt 2）でも出ている。同じ step は 12:47 UTC の #816（attempt 2）では成功していた |
| 原因の見立て【推論・runner 上では未確認】 | 17:16 UTC 以降の runner（`ubuntu-latest`）で、`sleep` を別名にコピーした `fake-apt` がすぐ終了している。ゾンビを使う検査だけ通っていることと整合する。`sleep` が呼び出し名で動作を切り替える多機能バイナリになった場合に起きる形 |
| この PR 側の問題 | データを `.json` で置いたため、CI の分類が `docs_only=false` になり、重い step が走った（分類器は `docs/**` の JSON を「テストが import しうる」として対象外にする）。docs のみの PR という前提に反していた |
| 対応 | データを Markdown（`*.spec.md`、`research-sequence.md`）に収め直し、重複していた `*.preflight.json` を削除。変更は `docs/**/*.md` だけになり、既存の分類規則どおり重い step は実行されない。**Gate・分類器・ワークフローは変更していない** |

`test-webkit-ci.sh` の失敗そのものは残っており、`docs_only=false` になる PR（#815・#816・#818・#820 と、今後の T24 実装 PR）は、直るまで `build` が赤になる。恒久対策は CI スクリプトの担当（#811／#820）の範囲で、この PR では扱わない。確認用の手順: runner 上で `ls -l "$(command -v sleep)"` と、`cp "$(command -v sleep)" /tmp/fake-apt && /tmp/fake-apt 1; echo $?`。

---

## 9. Result Report

- **完了**: banh-mi・elote・nduja の原典取得と NO_SAUCE の推奨／28 件の分類／Research 追補の実測（正準 0 を 3 段で確認）／nduja の影響調査／docs のみの Draft PR。
- **未完了**: 個別ページが引く外部の参考資料の確認。新ソースの色の実機確認。step 番号確定後の正準順の再確認（実装 PR）。
- **ブロッカー**: Owner 判断は残っていない。HOT は #815 の merge と正式 release まで開始しない。`test-webkit-ci.sh` の runner 起因の失敗（§8）が直るまで、実装 PR の `build` は赤になる。
- **次の行動**: #815 の merge・release と §8 の修復の後、HOT 担当が §7 の正本どおりに T24 から実装。

検証: `src/**`・`e2e/**`・HOT・golden・staged は未編集。UI・ゲームプレイの変更なし（HV Policy の対象外）。測定用のテストファイルは一時的な作業ツリーにだけ置き、削除済み。
