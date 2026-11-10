# T24〜T26 事前設計と Owner 承認パケット（#780、docs のみ・読み取り専用の準備）

2026-11-10 / 基準 `main` `7a217c38`（#817 merge 後。カタログは `577dcfd7` と同一: レシピ 102／食材 117／ladder 87 step）。

- **更新（同日）**: Owner 判断（1 回目・2 回目）で 28 件はすべて確定した。確定した仕様は Followup の §8。その経過と、原典調査・28 件の分類・Research 追補の実測・nduja の影響は `TETO_T24-T26_OwnerDecisions-Followup_2026-11-10.md` に記録した。§4.1 の追補と §8 の 25-2・25-3 は、そちらの値と推奨が新しい。
- **本書は準備であり、実装・HOT 編集・merge・Production ON・共有 Preview 更新の承認ではない。** 変更は本書と `docs/reports/data/TETO_T24-T26_PREP/**`（新規）のみ。
- B23-b（#815、claim 6763341354）と content-train（#816、claim 6766203727）のファイル・branch には触れていない。#816 の道具は**スクラッチの作業ツリーで読み取り実行しただけ**で、#816 の成果物（`TETO_TRAIN-EFFICIENCY*`）は編集していない。
- 暫定仕様・原典（pizzadb.jp）未確認。id・名前・数量・family・色は GAMEPLAY ASSUMPTION。
- 凡例: 【実測】この環境で実行・確認、【推論】実測からの解釈、【提案】Owner 判断が要る。

---

## 0. 結論（先に読む 6 点）

1. **事前検査は再現した【実測】。** #816 の T24／T25／T26 パケットを最新 main で再実行 → 3 本とも**バイト一致**、STOP 0、Research 正準順の変化 0。#815（B23-b）を載せた状態（104／122／89 step）でも表は同一。**#815 の merge を待たずに承認できる。**
2. **既存パケットに無い論点が 6 件見つかった【実測】**（§3）。うち 3 件は放置すると実装 PR が止まる:
   - 新ソース 6 種は**自然な色では色差ゲート（dE ≥ 25）を通らない**（6／6）。
   - T25／T26 の Research 表に、**先行列車で出荷される 4 ID が載っていない**（R-RES-1 では表に無い ID は STOP）。
   - `keema-pizza` は、手持ちの食材でどう直しても出荷済みと同一／ほぼ同一（rendang-pizza と同一組成、または上位集合 0.8）。
3. **squid の採用は「170 の実数」を増やさない【実測】。** squid は元から台帳 170 行の 1 行（`CANDIDATE_ACTIVE`）で、T24 の `frutti-di-mare` の新食材として既に数えられている。nutella-spread の統合で空いた 1 枠は**まだ空いている**（§5）。
4. **修正構成 R1 を提案する【提案】**（§2）。asparagi-limone を late 列車へ移す／keema を T27 へ送る／`nduja` を新食材として足す（空き 1 枠を実数で埋める）。R1 も 3 本とも STOP 0・正準 0【実測】。
5. **進捗（R1 採用時）**: 食材 122 → **139／170**（残 31）、レシピ 104 → **119／177**（残 58）、調理法・工程 **7／27**（残 20、変化なし）。
6. **T24〜T26 の Owner 往復見積もり: 最小 4／標準 6／悲観 9**（従来方式なら約 15）。§7。

---

## 1. 確認した状態【実測】

| 対象 | 状態 |
|---|---|
| `main` | `7a217c38`。#817（docs のみ）merge 済み。レシピ 102／食材 117／ladder 87（通常 74＋late 13）／調理法 実装済み 7 |
| #815 B23-b | Draft・HOLD、HEAD `76db4d58`。merge 後 104／122／89。**介入なし** |
| #816 content-train | Draft、HEAD `cab9d2cd`。T24〜T26 のスペックとパケットを保有。**介入なし**（読み取り実行のみ） |
| #817 非競合計画 | merge 済み。補充 1 枠 = `squid`（Owner 判断 2026-11-10）、3 ラインの目標 170／177／27 を維持 |
| #780 の claim | HOT 一式は #815 の session（期限 11-24）。`src/data/staged/**` は T-FX。本書の名前空間 `TETO_T24-T26_*` はどれとも重ならない |
| Owner 判断（記録済み） | E-1（T24 から列車方式）、R-RES-1（条件付き: 正準 0 維持、非正準は ID・段・方向・最大ずれ幅を明示、未知の変更は包括承認しない）、E-2、D-1〜D-7（staged） |

本セッションは claim コメントを投稿していない（新規 docs のみ・他の claim と重ならないため）。必要なら Owner の指示で投稿する。

---

## 2. T24〜T26 の仕様

2 つの構成を並べる。**A** = #816 の既存パケットの構成（staged のまま）。**R1** = 本書の修正構成（§3 の論点を反映）。スペックと事前検査の全文は `docs/reports/data/TETO_T24-T26_PREP/T2x-R1.{spec.md,preflight.md}`。

### T24 — 新食材つき・ソースあり（通常カタログ）

| レシピ | 材料（暫定） | 新食材 | A | R1 |
|---|---|---|---|---|
| `peruvian-aji-amarillo` | aji-amarillo 1・black-olive 2・chicken 2・mozzarella 3 | aji-amarillo（ソース） | ○ | ○ |
| `thai-chicken-pizza` | peanut-sauce 1・chicken 2・cilantro 2・mozzarella 3 | peanut-sauce（ソース） | ○ | ○ |
| `frutti-di-mare-pizzadb` | tomato-sauce 1・clam 2・mussel 2・shrimp 2・**squid 2** | **squid**（seafood） | ○ | ○ |
| `diavola-pizza` | tomato-sauce 1・mozzarella 3・spicy-salami 2 | spicy-salami（meat） | ○ | ○ |
| `south-african-boerewors` | chutney 1・mozzarella 3・onion 2・sausage 2 | chutney（ソース） | ○ | ○ |
| `peking-duck-pizza` | sweet-bean-sauce 1・mozzarella 3・cucumber 2・green-onion 2・peking-duck 2 | cucumber・peking-duck・sweet-bean-sauce | ○ | ○ |
| `pizza-asparagi-limone` | olive-oil 1・mozzarella 3・parmigiano 3・asparagus 2・lemon 2 | asparagus | ○ | → T25（late） |

A: 7 品／新食材 9。**R1: 6 品／新食材 8。**

### T25 — late 配置・ソース判断あり

| レシピ | 材料（暫定） | 新食材 | A | R1 |
|---|---|---|---|---|
| `swedish-kebab-pizza` | kebab-sauce 1・mozzarella 3・lettuce 2 | kebab-sauce（ソース） | late | late、lettuce は焼成後 |
| `pizza-salad` | tomato-sauce 1・yogurt-sauce 1・mozzarella 3・corn 2・cucumber 2・lettuce 2 | yogurt-sauce（cucumber は T24） | late | late、lettuce は焼成後 |
| `banh-mi-pizza` | mozzarella 3・carrot 2・cilantro 2・daikon 2・ham 2・liver-pate 2 | daikon・liver-pate | late・NO_SAUCE | 同左 |
| `buffalo-cauliflower-pizza` | gorgonzola 3・mozzarella 3・cauliflower 2 | cauliflower | 通常・NO_SAUCE | 通常・**buffalo-sauce 1 を追加** |
| `mexican-elote-pizza` | feta 3・corn 2・lime 2・mayo 2・paprika-powder 2 | lime | 通常・NO_SAUCE | **late**（lime は焼成後）・NO_SAUCE |
| `chicken-tikka-pizza` | mozzarella 3・bell-pepper 2・chicken-tikka 2・cilantro 2・onion 2 | chicken-tikka | 通常・NO_SAUCE | 通常・**curry-ketchup 1 を追加** |
| `pizza-asparagi-limone` | （T24 の表と同じ） | asparagus | — | **late**（asparagus・lemon は焼成後） |

A: 6 品／新食材 7（＋cucumber 共有）。**R1: 7 品／新食材 8**（＋cucumber 共有）。late カタログは本番 OFF（`LATE_CATALOG_PRODUCTION`）なので、late の品と食材はカタログ件数には入るが本番には出ない。

### T26 — 新食材なし（A）／ nduja つき（R1）

| レシピ | 材料（暫定） | 新食材 | A | R1 |
|---|---|---|---|---|
| `nashville-hot-chicken-pizza` | honey 1・mozzarella 3・chicken 2・pickles 2 | — | ○ | ○ |
| `nduja-pizza` | A: honey 1・mozzarella 3・sausage 2 ／ R1: honey 1・mozzarella 3・**nduja 2** | A: なし ／ R1: **nduja**（meat、台帳外の新 id） | ○ | ○ |
| `keema-pizza` | mozzarella 3・onion 2（原典の「ひき肉」「青唐辛子」は未解決） | — | ○ | → T27（cumin と一緒に） |

A: 3 品／新食材 0。**R1: 2 品／新食材 1。**

---

## 3. 事前検査の結果と、既存パケットに無い論点

### 3.1 再現【実測】

| 実行 | 基準 | STOP | Research 正準 | Research 非正準（ID 数） | #816 のパケットとの差 |
|---|---|---|---|---|---|
| T24／T25／T26（A） | main `7a217c38` | 0／0／0 | 0／0／0 | 58／42／33 | **なし（バイト一致）** |
| 同上 | #815 を載せた状態（104／122／89） | 0／0／0 | 0／0／0 | 58／42／33 | 表は同一（見出しの件数だけ違う） |
| 3 本を 1 本に連結（A、16 品） | 同上 | 0 | 0 | 72（最大ずれ 3 が 6 ID） | 列車間の重複 2 件が新規（§3.2-6） |
| **T24-R1／T25-R1／T26-R1** | 同上（main でも同一） | **0／0／0** | **0／0／0** | **43／59／9** | 新しい構成 |
| R1 を連結（15 品） | 同上 | 0 | 0 | 72（最大ずれ 3 が 3 ID） | 列車間の重複 0 |

標本監査との突合は全実行で不一致 0。

### 3.2 既存パケットに無い論点

| # | 論点 | 根拠【実測】 | 放置した場合 | 対応案 |
|---|---|---|---|---|
| N-1 | **新ソース 6 種の色** | 出荷済みソース 19 色に対し、自然な色の最近傍は aji-amarillo→mustard 14.2、peanut-sauce→olive-oil 23.9、chutney→curry-ketchup 15.9、sweet-bean-sauce→okonomiyaki-sauce 9.7、kebab-sauce→fresh-cream-sauce 13.4、yogurt-sauce→fromage-blanc-sauce 2.8。**6／6 が dE < 25** | 実装 PR のテスト（dE ≥ 25、B22 で Owner が維持を確認）が失敗 | §4.2 の代替色（全て dE ≥ 27）。kebab-sauce と yogurt-sauce は見た目が不自然になる |
| N-2 | **列車間の Research** | T25／T26 の表は「いまの出荷済み」だけが対象。T24 の 4 品（thai-chicken-pizza・south-african-boerewors・peking-duck-pizza・peruvian-aji-amarillo）は後続列車と有限食材を共有する | T25／T26 の実装 PR で「表に無い ID」になり停止（R-RES-1） | §4.1 の追補 6 行を今回まとめて承認 |
| N-3 | **`keema-pizza`** | staged（mozzarella＋onion）は出荷済み 15 品＋列車内 2 品の部分集合。curry-ketchup＋beef を足すと **rendang-pizza と同一**、さらに jalapeno を足しても rendang-pizza の上位集合 0.8、ソース無し＋beef＋jalapeno でも 1 材料差 2 件 | 重複ゲートで判断が割れ続ける | T26 から外し、未出荷の `cumin`（T27 候補）と一緒に再設計 |
| N-4 | **D-5（生の葉物・柑橘は原則 焼成後）** | staged の T24／T25 は lemon・lime・lettuce に焼成後の指定が無い。`pizza-asparagi-limone` は名前が「生のアスパラガスとレモン」、elote の lime も柑橘 | 通常カタログで出荷した後に late へ直すと、保存済みの進行と ladder 位置が動く | R1: asparagi-limone と elote を late、lettuce を焼成後に。lemon を焼成前に置く出荷済みの先例（2 品）もあるため Owner 判断 |
| N-5 | **nashville に buffalo-sauce を足す案は不可** | 足すと `buffalo-chicken` の**正準順**の文字が変わる（D-6 の停止条件） | STOP | nashville は honey のみのまま。honey を焼成前の層として出すか（B20-A の先例）、焼成後（M7 待ち）にするかは Owner 判断 |
| N-6 | **A のまま 3 本を続けて出すと列車間で重複** | south-african-boerewors と chicken-tikka-pizza が keema-pizza の上位集合 | T26 の重複判断が増える | N-3 の対応で解消（R1 では 0） |

R1 で新しく出る判断（A には無い）: `buffalo-cauliflower-pizza` が buffalo-chicken と 1 材料差（0.6）、`chicken-tikka-pizza` の Jaccard 超過が 2 件→4 件（baingan-bharta 0.5、curry-pizza-japan・rendang-pizza・spanish-chorizo-pizza 各 0.429）。NO_SAUCE を 2 品減らす代わりの対価。

---

## 4. Research・Hint・在庫・保存への影響

### 4.1 Research

- **正準順の変化は A・R1 とも 0【実測】。** 文字は保存されない（表示のみ）。
- 非正準（R1）: T24-R1 **43 ID**（新設のみ 18、後ろへ最大 1 が 22、最大 2 が 3）／T25-R1 **59 ID**（31／27／1）／T26-R1 **9 ID**（3／5／1）。ID 別の表は各 `T2x-R1.preflight.md` §4。
- 3 本の累積（今日の main から見た最終形）: 72 ID、最大ずれ 3 が 3 ID。各 PR は「その時点の出荷済み」からの差分で測るので、列車ごとの表の上限は超えない【推論】。
- **追補（N-2）【提案】**: 次の 6 行を T25／T26 の表に足して承認する。方向は未測定（新食材を仮登録しないと実 authority が文字を返さないため）なので「新設、または後ろへ最大 k」として扱う。

| 先に出荷される ID | 後続列車の原因レシピ | 段（共有食材） | 最大ずれ |
|---|---|---|---|
| `thai-chicken-pizza` | T25: banh-mi-pizza、chicken-tikka-pizza | cilantro | 2 |
| `thai-chicken-pizza` | T26: nashville-hot-chicken-pizza | chicken | 1 |
| `peruvian-aji-amarillo` | T26: nashville-hot-chicken-pizza | chicken | 1 |
| `south-african-boerewors` | T25: chicken-tikka-pizza | onion | 1 |
| `peking-duck-pizza` | T25: pizza-salad | cucumber | 1 |
| （A のみ）`south-african-boerewors`・`chicken-tikka-pizza` | T26: keema-pizza、nduja-pizza | onion、sausage | 各 1 |

### 4.2 Hint 5.0・DH4・ソース

- 出荷済みの Hint 5.0 梯子（`hint5.ladders55.json`）は全実行で不変【実測】。
- 先頭 rung: ソースありの品は SAUCE、NO_SAUCE の品（banh-mi、elote）は CHEESE。**ソースもチーズも無い品は 0**（G7 の衝突なし）。
- 新食材の family に `other` は 0（vegetable 5、meat 4〔R1 は nduja で 5〕、seafood 1、fruit 1、ソース 6）。DH4-PROD の到達不能は予測されない。
- 1 step で複数食材を解放: peking-duck-pizza（3）、pizza-salad（2）、banh-mi-pizza（2）。
- **新ソースの色（N-1）【提案・暫定】**: 自然な色から最小の移動で dE ≥ 27 を満たす値。順に確定させた場合の実測。

| ソース | 自然な色 | 提案色 | 自然色からの移動 | 最小 dE（相手） |
|---|---|---|---|---|
| aji-amarillo | `#f2c200` | `#ffe60f` | 17.5 | 27.2（mustard） |
| peanut-sauce | `#c49a6c` | `#faa078` | 21.6 | 27.3（curry-ketchup） |
| chutney | `#b5651d` | `#876e00` | 27.1 | 27.8（miso-sauce） |
| sweet-bean-sauce | `#4a1f14` | `#50001e` | 20.4 | 27.9（bbq-sauce） |
| kebab-sauce | `#f4c6a8` | `#96af91` | 31.4 | 27.6（olive-oil） |
| yogurt-sauce | `#fafafa` | `#cdd7ff` | 24.2 | 27.0（fromage-blanc-sauce） |

  白・黄・茶の帯は出荷済み 19 色で埋まっている。kebab-sauce（緑がかる）と yogurt-sauce（青みがかる）は見た目の違和感が大きいので、iPhone HV で確認する前提の暫定値。ゲートは緩めない。

### 4.3 在庫・ショップ

- パック増量（価格は不変）: **mussel 10→20**（frutti-di-mare が 2 個使う）、**pickles 10→20**（nashville が 2 個使う）。B22／B23-a と同じ条件付き承認の形。ほかの出荷済み食材の k は不変【実測】。
- 新食材は ladder の解放で購入可能になり、**解放時の在庫は 0**（既存ルール）。step は 30 以降なので価格帯は T4（初回 120／補充 60 Pitz）【推論: step 番号は実装 PR で確定】。
- 1 回作るのに要る有限食材の種類: 最多は banh-mi-pizza と mexican-elote-pizza の 5 種。elote は無限在庫の材料が 1 つも無い。
- T26（A）は新食材が無いので ladder の key になれず、ショップの行も増えない（`ladderCredit: false`）。R1 の nduja-pizza は nduja の key になれる。

### 4.4 保存

- `schemaVersion` は 2 のまま、移行なし。追加は id の増加だけ【実測: 既定セーブ・追加 id 入りセーブの読み込み】。
- 旧ビルドが新 id 入りのセーブを読むと、**その id だけ落として他は保持、読み込みでは書き込まない**【実測】。出荷後に旧ビルドへ戻すと次の保存で新 id が消える（既知の制約、#668）。
- **id は出荷前に確定する。** `frutti-di-mare-pizzadb` → `frutti-di-mare` の改名は、出荷済み id と衝突しない【実測】。出荷後の改名は図鑑の移行が要る。
- Preview は全ビルドで保存キーを共有する（Session Operations §5）。HV 用のセーブは使い捨て。

### 4.5 事前検査の対象外（実装 PR で測る）

step 番号と凍結範囲、`alphaFamilyOnly` の差分、旧 DH4-2A などの実測値の追従、Reference 配置、絵文字の一意（G18）、名前の収まり、専用 SVG、E2E、iPhone HV。

---

## 5. squid の採用と、食材 170 の数え方

| 事実【実測】 | 値 |
|---|---|
| 台帳の 170 | 出荷済み＋staged の全行（`CANDIDATE_ACTIVE`＋別名 5＋統合 2 を含む） |
| squid | 元から `CANDIDATE_ACTIVE` の 1 行。host は `frutti-di-mare-pizzadb`（T24） |
| #815 後の内訳 | 出荷 122 ＋ ACTIVE 41（squid を含む）＋別名の暫定 5（ground-beef→beef、salsa→tomato-sauce、cotija→feta、blue-cheese-dressing→gorgonzola、chili-powder→paprika-powder）＋統合の暫定 1（puntarelle）＝ **169** |
| 空き | nutella-spread の統合で空いた **1 枠はそのまま** |

- squid は **T24 の 1 両目の必須食材**として反映した（A・R1 とも）。これで「squid を早い列車で出す」という判断は満たす。
- ただし squid は 169 の内側なので、**170 に届かせるには台帳の外から 1 種要る**。#817 の比較表の他の候補（peanut-sauce・strawberry・rock-salt）も全て ACTIVE 行で、同じ理由で実数は増えない。
- **【提案】170 番目は `nduja`**: `nduja-pizza` が現状 sausage で代用している（NAME_SPECIFICITY_GAP）ので、host が既にあり、salsiccia 系との 1 材料差も消え、T26 に ladder の key が 1 つできる。事前検査は STOP 0・重複 0。
- 別名 5＋統合 1 の暫定行は、nutella-spread と同じく「新 id 不要」になれば実数が最大 6 減る。これは T24〜T26 の範囲外（IB-07／I-1・I-2）なので、ここでは数え方だけ明示する。

---

## 6. 進捗と残数

カタログ件数の従来どおりの数え方（late の本番 OFF 分を含む）。

| ライン | main 現在 | #815 後 | T24 後 | T25 後 | T26 後（R1） | 残数 | 進捗率 | 参考: A の場合 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 食材（目標 170） | 117 | 122 | 130 | 138 | **139** | **31** | 81.8% | 138（残 32） |
| レシピ（目標 177） | 102 | 104 | 110 | 117 | **119** | **58** | 67.2% | 120（残 57） |
| 調理法・工程（27 候補） | 7 | 7 | 7 | 7 | **7** | **20** | 25.9% | 同じ |

- 食材の残 31（R1）＝ ACTIVE 25 ＋ 別名・統合の暫定 6。空き枠は nduja で埋まる。A の残 32 は ACTIVE 25＋暫定 6＋空き 1。
- レシピの残 58（R1）＝ 機構待ちでない 14（T27 の STOP 13＋keema）＋ M7 待ち 1 ＋ 機構待ち 43。
- 調理法は T24〜T26 では増えない（新しい機構を使わない品だけを選んでいるため）。残 20 のうち採用対象の未完は 12、採否未決 6、重複 2。

---

## 7. Owner 往復の見積もり（T24〜T26）

| 往復 | 内容 | 最小 | 標準 | 悲観 |
|---|---|---:|---:|---:|
| 1 | 本パケットへの一括回答（§8） | 1 | 1 | 1 |
| 2〜4 | 列車ごとの iPhone HV の結果＋merge 可否（3 本） | 3 | 3 | 3 |
| — | NO_SAUCE の原典調査結果の確認（banh-mi、elote） | 0 | 1 | 1 |
| — | 新ソースの色の HV やり直し（kebab／yogurt） | 0 | 1 | 2 |
| — | 実装中に仕様が動いて往復 1 に戻る | 0 | 0 | 1 |
| — | 前の列車の merge 後の再検査で差分が出る | 0 | 0 | 1 |
| **計** | | **4** | **6** | **9** |

- 最小 4 の条件: §8 で NO_SAUCE を GAMEPLAY 判断として今回決める／追補（§4.1）と色を今回承認する／「#815 の merge・release 後に T24 を開始」「PR 専用の HV ページの公開」を回答に含める。
- 従来方式の実績は 1 バッチ約 5 往復（B23 は 3 品で約 10）なので、3 本で約 15。品あたりでは 15 品で 0.27〜0.6（従来 約 1.25〜3.3）。
- 全量完了までの見積もりは #816 の計画（約 75、幅 55〜110）を変えない。T24〜T26 の実測で置き換える。

---

## 8. Owner 承認パケット（1 回で回答）

推奨どおりなら **「全て推奨どおり」** の一言で足りる。変えたい行だけ番号で指定する。

### 共通

| # | 判断 | 推奨 |
|---|---|---|
| C-1 | 構成は R1 にするか、A（#816 の既存パケット）のままか | **R1** |
| C-2 | 暫定仕様値（id・名前・数量・family）を B21〜B23 と同じ GAMEPLAY ASSUMPTION として扱う | 承認 |
| C-3 | 食材 170 の 170 番目を `nduja`（台帳外の新 id）で埋める。squid は T24 で出荷（169 の内側） | 承認。不承認なら実効 169 のまま T24〜T26 を進める |
| C-4 | 新ソース 6 色（§4.2）。dE ≥ 25 は維持 | 暫定承認。最終は iPhone HV |
| C-5 | Research の追補 6 行（§4.1）を T25／T26 の表に加える | 承認 |
| C-6 | D-5 の適用: lettuce・lime・asparagi-limone の asparagus と lemon は焼成後（該当品は late） | 承認 |
| C-7 | 進行: #815 の merge・release 後に T24 → T25 → T26 の順で実装開始、各 PR 専用の HV ページ公開を許可（共有 Preview・Production は対象外） | 承認 |

### T24-R1（6 品・新食材 8）

| # | 対象 | 判断 | 推奨 |
|---|---|---|---|
| 24-1 | `thai-chicken-pizza` | 重複例外: bbq-chicken-pizza 0.5、reina-pepiada-pizza 0.429 | 承認（ベースソースが別） |
| 24-2 | `frutti-di-mare-pizzadb` | 重複例外: pescatore 0.5。id を `frutti-di-mare` にする | 承認（衝突なし） |
| 24-3 | `diavola-pizza` | 1 材料差: bismarck・funghi・margherita・pepperoni・salsiccia | 承認（spicy-salami が新食材で区別できる） |
| 24-4 | `south-african-boerewors` | 1 材料差: polish-kielbasa・spanish-chorizo-pizza | 承認（chutney が新ソース） |
| 24-5 | `peking-duck-pizza` | 調理済みの複合食材 peking-duck を 1 食材にする（I-3）。1 step で 3 食材 | 承認 |
| 24-6 | mussel | パック 10→20、価格不変 | 承認 |
| 24-7 | Research 非正準 43 ID | `T24-R1.preflight.md` §4 | 表どおり承認 |

### T25-R1（7 品・新食材 8）

| # | 対象 | 判断 | 推奨 |
|---|---|---|---|
| 25-1 | late 配置 5 品 | swedish-kebab・pizza-salad・banh-mi・mexican-elote・asparagi-limone | 承認 |
| 25-2 | `banh-mi-pizza` | NO_SAUCE（mozzarella あり）。原典のソース系統は「その他」 | Owner の GAMEPLAY 判断として NO_SAUCE（apple-cinnamon と同じ形） |
| 25-3 | `mexican-elote-pizza` | NO_SAUCE（feta あり）。原典のソース系統は「ホワイトソース」 | NO_SAUCE。出荷済みの白いソースを下地にする案は未検査 |
| 25-4 | `buffalo-cauliflower-pizza` | buffalo-sauce を下地にする。buffalo-chicken と 1 材料差（0.6） | 承認 |
| 25-5 | `chicken-tikka-pizza` | curry-ketchup を下地にする（原典の系統は「カレー」）。Jaccard 超過 4 件、chicken-tikka は複合食材 | 承認 |
| 25-6 | `pizza-salad` | tomato-sauce＋yogurt-sauce の 2 層（B20-A・B22 の先例）。bambino と 0.429 | 承認 |
| 25-7 | `pizza-asparagi-limone` | quattro-formaggi と 0.429 | 承認 |
| 25-8 | Research 非正準 59 ID＋追補 | `T25-R1.preflight.md` §4 | 表どおり承認 |

### T26-R1（2 品・新食材 1）

| # | 対象 | 判断 | 推奨 |
|---|---|---|---|
| 26-1 | `nashville-hot-chicken-pizza` | 新食材なし → `ladderCredit: false` の追加レシピ | 承認 |
| 26-2 | 同上 | honey を焼成前の唯一のソース層として出す（焼成後にするなら M7 待ち） | 焼成前で出す（B20-A の先例） |
| 26-3 | `nduja-pizza` | sausage の代用をやめ、新食材 nduja 2 にする | 承認（C-3 と連動） |
| 26-4 | `keema-pizza` | T26 から外し、T27 で cumin と一緒に再設計 | 承認 |
| 26-5 | pickles | パック 10→20、価格不変 | 承認 |
| 26-6 | Research 非正準 9 ID＋追補 | `T26-R1.preflight.md` §4 | 表どおり承認 |

判断件数: 共通 7 ＋ T24 7 ＋ T25 8 ＋ T26 6 ＝ **28**（#816 の A は 26＋共通 1）。

---

## 9. Result Report

- **完了**: 状態確認（main・#780・#815〜#817・claim）／T24〜T26 の仕様整理（A と R1）／content-train 事前検査の再現（main と #815 後、A 3 本・連結・R1 3 本・R1 連結・代替案 4 本）／Research・Hint・在庫・保存の影響確認／squid の反映と 170 の数え方の確認／承認パケット 1 本／3 ラインの進捗と残数／往復見積もり。
- **未完了**: 実装（対象外）。NO_SAUCE 2 品の原典調査（本セッションでは未実施。§8 は GAMEPLAY 判断で進める案）。新ソースの色の実機確認。追補の方向の測定。
- **ブロッカー**: §8 の Owner 回答。HOT は #815 の merge と release まで。
- **次の行動**: Owner の回答 → 承認された構成でスペックを確定 → #815 の release 後に HOT 担当が T24 から実装。前の列車の merge ごとに同じスペックで再検査し、差分があれば表を更新する。

### 検証

- UI・ゲームプレイの変更なし（HV Policy の対象外）。`src/**`・`e2e/**`・HOT・golden・staged は未編集。
- 事前検査の実行はスクラッチの作業ツリー（#816 の HEAD `cab9d2cd` に main を merge、および #815 の HEAD `76db4d58` に道具を複写）で行い、どちらも push していない。

### 再現手順

```
# #816 の branch（または merge 後の main）で。スペックは T2x-R1.spec.md の JSON ブロックを T2x-R1.spec.json として保存してから渡す
node tools/content-train/preflight.mjs /tmp/T24-R1.spec.json --out /tmp/t24r1
node tools/content-train/preflight.mjs /tmp/T25-R1.spec.json --out /tmp/t25r1
node tools/content-train/preflight.mjs /tmp/T26-R1.spec.json --out /tmp/t26r1
```

`*.preflight.md` の見出しの件数（104／122／89）は、#815 を載せた状態で測ったことを示す。main（102／117／87）で実行しても §1〜§6 は同一。
