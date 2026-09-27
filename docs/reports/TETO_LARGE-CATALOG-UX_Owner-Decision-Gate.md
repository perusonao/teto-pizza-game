# Large Catalog UX — Owner Decision Gate（LC-OD-1…18）

- 種別: **Owner Decision Gate（docs / data / tools only）**。`src/**`・`e2e/**`・CSS は変更していない。PR 作成・merge・deploy なし。
- 前段: `docs/reports/TETO_LARGE-CATALOG-UX_Fresh-Design.md`（LC-0 Fresh Design）。本書はその **Owner 判断用の確定版**で、Fresh Design と食い違う箇所は本書が優先する（§12 に差分一覧）。
- Fresh GitHub state（2026-09-27 確認）:
  - `origin/main` = `51e0923`（PR #252 Dinner DM-3R-2 merge）。Fresh Design 監査時の `5a33d85` から **Dinner DM-3R-2 の 10 commit** が入った。
  - 本ブランチ `claude/large-catalog-ux-design-sq8saf` は `5a33d85` 起点。main との差分は Dinner 関連のみで、Fresh Design の対象画面（Free Cooking / Dex / Pizza Select / Shop / Inventory / hint sheet）の**実測値は最新 main で再計測して 0 差分**（§1.2）。
  - Open PR: #259（DM-4-1）, #255（172 Taxonomy, OD-TAX 承認済み・未 merge）, #243, #221, #220（Content Readiness waves）ほか。本書はどれも変更していない。
  - W2-A の正式定義は GitHub 上にまだ存在しない（issue / PR / docs を検索して 0 件）。本書では Owner 提示の **34 recipes / 約 37 ingredients** を前提にし、新材料の構成は PR #220 の W2 プール（未 ship の新材料 15: topping 12 / cheese 3）から上下限を取った。

---

## 0. 判定

**A. LARGE CATALOG UX READY FOR OWNER FINAL DECISIONS**

- LC-OD-1…18 すべてに、選択肢・得失・save / privacy / mobile / Wave 2 への影響・推奨を付けた（§3）。
- 推奨を確定する前に Owner が選ぶ必要がある項目は **5 つ**: LC-OD-4（working set の数値）、LC-OD-8b（Dex の件数を在庫基準にするか所持基準にするか）、LC-OD-12（Pizza Select の列数）、LC-OD-16b（Dinner の working set 初期値）、LC-OD-6（1つ戻す、別 Issue 化の承認）。
- 設計の修正が必要だった点は本書で直した（§12）。いずれも方式の変更ではない。
  - HC-4（near-miss をきっかけに NEW 材料を繰り上げる）は、**matcher 由来の信号**で working set を動かすことになるため撤回した。
  - Pizza Select 3 列は、**名前の途中改行が再発**することを実測で確認したため、推奨から外した。
  - 最新 main の Dinner が Free Cooking と同じ全所持トレイを使うことを、影響範囲に追加した。
- W2-A Gate: **C. LC-1 / 1b only required before W2-A**（§9）。

---

## 1. 最新 main との差分確認

### 1.1 main で変わったこと（`5a33d85..51e0923`）と Large Catalog への影響

| 変更 | 影響 |
|---|---|
| Dinner round が **recipe-free トレイ**（`recipeFreeTray = state.freeCook \|\| state.dinner !== null`、OD-R5）を使う | F-01（トレイのページ数爆発）は **Dinner にも同じ形で起きる**。Dinner は制限時間があるため、ページめくりのコストは Free Cooking より重い。LC-2 / 3 の対象に Dinner を含める（LC-OD-1c） |
| Dinner には hint ボタンが無い | Dinner の working set にヒント由来の材料は入らない（§5） |
| Dinner の target は unlock 規則（ALL_TARGETS_DISCOVERED）により**常に発見済み**。target 行に名前と見本が出る | target の材料で working set を初期化しても privacy 上は安全。ただし OD-R5（組み立ては自分で）とのゲーム性判断になる → LC-OD-16b |
| Layout Contract に mode 別の stage floor が入った（Dinner S360 235 / S390 259 / E360i 154 / E390i 178、Free S360 245 / S390 269 など、表示ピザ径） | LC-2 の mobile gate は「**全 mode の floor を 0px も下げない**」ことになる。Fresh Design の「pager 行を棚バーに置換、行は増やさない」はこの条件を満たす |
| `DINNER_COMPOSITION_ACTIONS` は PREPARE 以外で拒否される | 「1つ戻す」を入れる場合は、この集合に加える必要がある（§8） |

### 1.2 最新 main での再計測

`tools/large-catalog-ux/measure.spec.ts` を `origin/main`（51e0923）の worktree で再実行した。`TETO_LARGE-CATALOG-UX_UI-MEASUREMENTS.json` と比べて**全項目 0 差分**。Fresh Design の数値はそのまま有効。

---

## 2. 新しい実測とモデル（本 Gate で追加）

| 追加物 | 内容 |
|---|---|
| `tools/large-catalog-ux/gate.measure.spec.ts` | Pizza Select を 2 列（現行）と 3 列（試作 2 種）で、4 viewport（390×844 / 360×800 / 390×664 / 360×640）で計測する。3 列は**テストページ内でだけ注入した CSS**で、src の CSS は変えていない |
| `docs/reports/data/TETO_LARGE-CATALOG-UX_GATE-MEASUREMENTS.json` | 上の計測結果（25 レシピすべて発見済み） |
| `docs/reports/screenshots/large-catalog-ux/gate/*.png` | 12 枚（4 viewport × 3 variant） |
| `tools/large_catalog_ux_scale_model.py` の `gate` 節 | working set 6 / 9 / 12 / 15、fixture tray matrix（29〜179）、Dex 集約（0 / 25 / 34 / 101 / 172 発見）、Pizza Select 列数の投影。`--check` 対応 |

---

## 3. LC-OD-1…18 一覧

凡例 — **save**: セーブへの影響 / **privacy**: 未発見の漏洩リスク / **mobile**: 調理 stage・1 画面の情報量 / **W2**: Wave 2 との関係。推奨は **太字**。

### LC-OD-1 大規模化の基本方式（Free Cooking / Dinner の調理トレイ）

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 手元（working set）＋食材庫 bottom sheet** | stage を 1px も縮めない。ドラッグと 3×2 グリッドの Human Feel 資産を維持。任意の所持材料に 3 タップ以内で届く | 新しい概念が 2 つ増える（手元・食材庫）。手元の中身の決め方を監査する必要がある（§5） |
| B. トレイ内に family タブ行を追加 | 概念が少ない | stage が約 32px 縮み、Layout Contract の stage floor（DM-3R-2 で mode 別に固定）を割る。vegetable 24 種で 4 ページ、179 では 40 種で 7 ページになり、それでも破綻する |
| C. トレイの縦スクロール | 実装が軽い | Fix 2 で解消した「スクロールとドラッグの競合」が再発する |

- save: なし（A は表示のみ）
- privacy: A の手元の決め方は §5 の禁止入力で縛る
- mobile: A = ±0px、B = −32px、C = ±0px だが操作競合あり
- W2: W2-A（topping 27〜30 = 5 ページ）までは現行でも成立する。**topping > 30（6 ページ以上）になる wave の前に A が必要**
- 1b（適用範囲）: **Free Cooking と Dinner（recipe-free トレイ）に適用。Guided / Lunch Rush（レシピ材料のみ、6 個以下）は現行のまま**
- 1c（発動条件）: **そのカテゴリの所持数が手元容量を超えたときだけ手元化**。それ以下は現行表示と同一なので、25/29 の体験は変わらない
- 推奨: **A**（Owner 方針候補と一致）

### LC-OD-2 食材庫の棚ラベル

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. topping は DH4-1 の 7 family（L2）、sauce / cheese は family なし** | 特徴ヒント（「肉の仲間があるよ」）と同じ語彙なので、ヒントから食材庫へつながる。OD-TAX-2 / 3 の範囲内 | vegetable が大きい（105 で 24 種、179 で 40 種）→ 食材庫内の縦スクロールと検索で吸収する |
| B. L3 subfamily まで表示 | 棚が細かい | OD-TAX-3（L3 は内部のみ）に反する。ヒントの粒度と食い違う |
| C. 独自カテゴリ | 自由に設計できる | ヒントの語彙とずれる |

- save: なし
- privacy: DH4 の k≥2 guard は「プレイヤーが所持材料を family ごとに数えられる」ことを前提に decoy を数えている。したがって family 表示は**脅威モデルの前提そのもの**で、新たな漏洩はない（§6）
- mobile: 食材庫シート内の横チップ列 1 行（32px）。調理画面には影響しない
- W2: W2 の新材料は family 行を足すだけでよい（DH4-1 taxonomy と同じ data-only 運用）
- 推奨: **A**。`other` の表示文言は OD-TAX-8 に従い DH4-2 と共通で決める

### LC-OD-3 食材庫でのタップの挙動

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. ✓トグル（複数選択）＋「手元に並べる」で閉じる** | 組み合わせを考えるという探索の本質に合う。最後に ✓ した材料が選択状態になる | 1 個だけ欲しいときは 1 タップ多い |
| B. タップで即選択し、閉じる | 単品は最速 | 3 個試すには開閉を 3 往復する必要がある |

- save: なし / privacy: なし / mobile: シート下部に 48px の CTA
- W2: 関係なし
- 推奨: **A**（長押しで即選択するショートカットは LC-3 の Human Feel で判断）

### LC-OD-4 working set の容量 — **12 を authority として固定しない**

実測とモデル（`gate.workingSet`）。172 行の必要 topping 数の分布は 0:5 / 1:30 / 2:50 / 3:62 / 4:19 / 5:5 / 6:1 で、3 種類以下が 147/172。

| 容量 | 2 行グリッドのページ数 | 最悪タップ / 平均 | stage | 必要 topping が全部入る | ＋試したい候補 3 個も入る | 1 試行あたりの食材庫往復 |
|---:|---:|---|---|---|---|---:|
| 6 | 1 | 1 / 1.0 | ±0 | 172/172 | 147/172 | 0.19 |
| 9 | 2 | 2 / 1.33 | ±0 | 172/172 | **172/172** | 0 |
| 12 | 2 | 2 / 1.5 | ±0 | 172/172 | 172/172 | 0 |
| 15 | 3 | 3 / 1.8 | ±0 | 172/172 | 172/172 | 0 |
| 9（3 行グリッド、比較用） | 1 | 1 | **−64px（360×640: 253→189）/ −70px（390×844）** | — | — | — |

- 読み方:
  - **9 が「必要材料＋試したい候補 3 個」を全レシピで満たす最小値**。
  - 12 は同じ 2 ページのまま、手元に置いた材料が押し出されにくい余裕を加える。
  - 15 は 3 ページ目が生じ、ページめくりが戻ってくる。
  - 3 行グリッドは stage floor を割るので不可。
- 手元の中身には「のせた材料」「ピン留め」「ヒント」「お気に入り」「最近」が混ざる。12 は、容量で押し出されて探索が止まるのを防ぐための余裕。
- save: なし（容量は定数） / privacy: なし / mobile: 2 行グリッドなら 6〜12 はすべて ±0
- W2: W2 期間は所持数が容量以下のカテゴリが多く、手元化自体が発動しにくい
- 推奨: **暫定上限 12（2 ページ）。LC-2 の Human Feel で 9 と 12 を比較してから authority にする**。15 以上は不採用

### LC-OD-5 お気に入り / 最近の保存

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. session 内だけ保持（ラウンド間は ProgressionCarry と同じく引き継ぐ）。save への永続化は LC-9 で再判断** | save schema に影響なし。先に Human Feel を確かめられる | リロードで消える。「未使用」の判定ができない（履歴がない） |
| B. 最初から save の任意フィールドにする | 継続性がある | forward-compat merge・migration test・Full Reset 範囲などの監査が先に必要 |
| C. 永続化しない | 最も単純 | 100 種規模でお気に入りの価値が半減する |

- save: A = なし（LC-9 で `uiPrefs` 任意フィールドを別監査）
- privacy: 自分の行動履歴だけなので、なし
- mobile: なし
- W2: なし
- 補足: session-only の間、「new / unused」は「**この session で入手した材料**」に読み替える（§5）
- 推奨: **A**（Owner 方針候補と一致）

### LC-OD-6 「1つ戻す」

- 監査結果（§8）: Large Catalog の実装には**必須ではない**。有用で、authority 上の障害も見当たらない。
- 推奨: **別 Issue 候補（LC-X「Undo last placement」）として分離**（Owner 方針候補と一致）。Large Catalog の LC-2 / 3 はこれに依存しない。

### LC-OD-7 ヒントと手元・食材庫の接続

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. シートが表示済みの `ing:` fact だけを手元に 💡 付きで置く。特徴ヒントは、その回答の粒度のまま食材庫の filter として開く** | ヒント購入の価値が「探す手間」に食われない。表示済みの情報しか使わない | ヒントの表示状態（シートを開いたか）を session で持つ必要がある |
| B. 印だけ付け、自動では置かない | さらに保守的 | 12 ページ規模では、印を探すこと自体が面倒 |
| C. 自動化しない | 変更なし | H-01（S1）が残る |

- save: なし（表示済み fact は既存の `discoveryHintFacts` の ledger と session のみ）
- privacy: §6 の許可 / 禁止表に従う。near-miss をきっかけにした繰り上げ（Fresh Design の HC-4）は**撤回**
- mobile: なし
- W2: 特徴ヒントとの連携（HC-3）は DH4-2 の merge 後
- 推奨: **A**

### LC-OD-8 Recipe Dex の未発見表示

| 選択肢 | メリット | デメリット |
|---|---|---|
| A. 現行（全枠カード） | 変更なし | 172 で 25〜35 画面。未発見の枠番号（固定の「持ち手」）ごとに状態が変わり続ける |
| **B. 章ごとに畳み、発見数 / 総数と行動できる件数だけを表示** | 172 でも閉じた状態で 1 画面。**枠という持ち手を消すので、現行より漏洩が減る** | 図鑑の「空き枠を埋める」感覚が薄れる |
| C. スタンプ帳（24px の番号スタンプで全枠） | コレクション感が残る | 番号という持ち手が残るため、B より漏洩が多い（現行と同じ） |

- 8b（件数の基準）— §7 の監査結果:
  - **推奨: 所持基準（OWNED / entitled）。在庫では変化させない**。
  - 在庫基準（現行の `recipeDiscoveryState`）のままだと、在庫を 0 にするだけで「この章にこの材料を使う未発見レシピが何件あるか」を調べられてしまう。
- save: なし（表示用の派生のみ。`recipeDiscoveryState` 本体は変えない）
- privacy: §7
- mobile: 101 発見で章を 1 つ開いた状態が 5.0〜6.9 画面、全章を開いても 7.9〜10.8 画面（現行は 33〜45 画面）。0 発見なら閉じた状態で 1 画面未満
- W2: 34 レシピまでは現行でも 5.3〜7.2 画面で成立する
- 推奨: **B + 8b 所持基準**（Owner 方針候補と一致）。C は LC-5 の Human Feel で比較する余地を残す

### LC-OD-9 大きすぎる章

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 章の算出（鍵ステップの価格帯）は変えず、表示だけ 12 件前後の「棚」小見出しに分ける** | Progression SSOT を変えない | 小見出しの基準（Ladder step の範囲）を表示用に決める必要がある |
| B. 価格帯を細かくして章を増やす | 章の意味が保たれる | Progression SSOT と Shop 価格帯に波及する |
| C. 地域・スタイル別の章 | 楽しい | 未発見の存在を地域単位で示すことになり、別途 privacy 監査が必要 |

- save: なし / privacy: A は未発見の件数を細かく割らない（棚は発見済みタイルにだけ適用し、未発見は章単位のまま）
- mobile: 101 / 172 で 1 章が 40〜63 件になる想定（ただし 172 の Ladder は未作成で、4 tier 比例による仮定）
- W2: 34 レシピまでは不要
- 推奨: **A**

### LC-OD-10 Dex の発見済みカード

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. タイル＋詳細シート（列数は LC-OD-12 と同じ結論に揃える）** | 172 全発見・全章を開いた状態でも 12.8〜17.5 画面（現行は 38.7〜53.1）。既定の 1 章だけ開いた状態なら 2.0〜2.7 画面 | 詳細を見るのに 1 タップ要る |
| B. 現行のフルカード | 情報がすぐ見える | 規模に耐えない |

- save / privacy: なし。mobile: 3 列にするなら LC-OD-12 の名前改行問題と同じ制約を受ける
- W2: 不要
- 推奨: **A（2 列タイル、名前は 1 行で縮小。3 列は LC-OD-12 の条件付き）**

### LC-OD-11 Dex からのヒント導線

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 「これから」に 1 つ、章の行に 1 つ（その章の DISCOVERABLE を既存の決定順で pin）** | 匿名 CTA が数十個並ばない | 「この枠」を選ぶ操作がなくなる。ただし匿名枠同士に差はないので、失うものは実質ない |
| B. 現行（カードごと） | 変更なし | D-03 |

- save: なし（229-D の `fromDex` pin を章単位に置き換えるだけ）
- privacy: pin 対象は既存の `selectHintTarget` の決定順で、UI は target の id を持たない（現行と同じ）
- W2: 不要
- 推奨: **A**

### LC-OD-12 Pizza Select の列数 — **まだ決定しない。実測を提示**

25 レシピすべて発見済みで実測（`gate.pizzaSelectColumns`）:

| viewport | variant | カード幅×高さ | サムネ | 名前フォント | 2 行名（/25） | 1 画面に完全表示 | scroll（25） | 172 投影 |
|---|---|---|---|---|---:|---:|---:|---:|
| 390×844 | **2 列（現行）** | 174×168 | 76 | 12.2〜14px | 0 | 8 | 2435 | 19.6 画面 |
| 390×844 | 3 列 / サムネ 64 | 114×143〜152 | 64 | 11〜14px | **6** | 12 | 1532 | 12.0 画面 |
| 390×844 | 3 列 / サムネ 76 | 114×155〜164 | 76 | 11〜14px | 6 | 12 | 1640 | 12.9 画面 |
| 360×800 | 2 列 | 159×168 | 76 | 11〜14px | 0 | 6 | 2435 | 20.8 画面 |
| 360×800 | 3 列 / 64 | 104×143〜152 | 64 | 11〜14px | **9** | 12 | 1532 | 12.7 画面 |
| 390×664 | 2 列 | 174×168 | 76 | 12.2〜14px | 0 | 6 | 2435 | 25.4 画面 |
| 390×664 | 3 列 / 64 | 114×143〜152 | 64 | 11〜14px | 6 | 9 | 1532 | 15.5 画面 |
| 360×640 | 2 列 | 159×168 | 76 | 11〜14px | 0 | 6 | 2435 | 26.5 画面 |
| 360×640 | 3 列 / 64 | 104×143〜152 | 64 | 11〜14px | **9** | 9 | 1532 | 16.1 画面 |

- tap target: すべての variant で ≥104×143px。44px の基準は十分に満たす。
- **可読性の決定的な所見**: 3 列では名前が**語の途中で改行される**（「パルミジャーナピ／ザ」「ブレックファスト／ピザ」、スクショ `gate/360x640_pizza-select_3col-thumb64.png`）。これは W1 I5b-4 が 2 列で直した問題の再発。
- 3 列の得: scroll −33〜37%、1 画面の完全表示 +50%（6 → 9、8 → 12）。
- 3 列の損: 名前の途中改行、サムネ 76 → 64（具材の識別性が低下）。

| 選択肢 | 条件 |
|---|---|
| **A. 2 列を維持し、検索・フィルタ・最近・章の折りたたみで量を減らす** | 追加条件なし。172 でも章を閉じた既定表示なら 1〜2 画面 |
| B. 3 列に変更 | 名前の改行位置データ（例: `nameBreakJa`、「・」や語の境界）か短縮名が必要。data と Owner の文言判断が要る |
| C. 表示密度の切替（2 列 ⇄ 3 列 list mode） | UI が 1 つ増える |

- save: C は表示設定の保存を LC-9 に含める。privacy: なし（発見済みのみ）
- W2: 34 レシピ・2 列で 3176px（360×640 で 5.4 画面）で許容範囲
- 推奨: **A**。B は名前改行の解決策が出るまで保留。**Owner の最終判断を求める**

### LC-OD-13 Shop の「在庫が少ない」とまとめ補充

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. NEW / 在庫が少ない（≤3）/ すべて のセクション。まとめ補充は見送り** | economy の authority に触れない | 補充は 1 行ずつ |
| B. まとめ補充あり | 速い | 価格・数量が単品の和と等しいことの監査が必要。反映は `RESTOCK_INGREDIENT` を n 回か新しい action か → reducer の判断になる |

- save: なし / privacy: なし（LOCKED は非掲載のまま）
- mobile: 既定表示が 1 画面（102 行 → NEW + 在庫少の数行）
- W2: W2 では行数 30 前後で、現行でも 3〜5 画面
- 推奨: **A**。閾値 3 は LC-7 の Human Feel で確定

### LC-OD-14 Inventory（閲覧モード）でお気に入りを切り替えてよいか

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 可。`onToggleFavorite` だけを受け取り、所持・在庫を変える callback は型で持たない** | お気に入りを整理する場所として自然 | 「Inventory は完全に read-only」という表現を「**所持・在庫について** read-only」に改める必要がある |
| B. 不可 | 現行の保証をそのまま守れる | お気に入りを変えられるのが調理中の食材庫だけになる |

- save: LC-9 以前は session のみ / privacy: なし / mobile: なし / W2: なし
- 推奨: **A**

### LC-OD-15 検索用の読み `readingJa`

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 漢字を含む名前にだけ、読みを data として追加** | 「なす」で「茄子」が引ける | data 作成が 105 行ぶん（漢字名だけなら少数） |
| B. 追加しない | 作業なし | カタカナ・ひらがな名しか検索できない |

- save: なし（data のみ、save に入らない） / privacy: 検索対象は所持材料のみ / W2: 新材料の追加時に読みも入れる
- 推奨: **A**

### LC-OD-16 「互換」フィルタの範囲

| 選択肢 | 可否 |
|---|---|
| 未発見レシピに使える材料での絞り込み、候補数の表示 | **不可**（ヒント販売の迂回路になる） |
| **発見済みレシピの材料一式を手元へ（リミックス）** | 可。Dex に既に表示している情報 |
| **表示済みのヒント fact** | 可（§6） |

- 16b（Dinner の手元の初期値）:

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 初期値は入れない（通常の優先順だけ。target 行の見本から自分で組む）** | OD-R5（組み立ては自分で）の意図を守る | 制限時間の中で食材庫を開く手間が残る |
| B. 発見済み target の材料を手元に並べる | 時間制限との相性が良い | Dinner の難しさが変わる → DM-5 の balance と一緒に判断すべき |

  privacy はどちらも安全（target は必ず発見済み）。**推奨 A。B は Dinner トラック（DM-5）の判断に委ねる**
- 推奨: **未発見への互換フィルタは作らない。リミックスは LC-5（Dex 詳細）以降**

### LC-OD-17 在庫 0 の所持材料

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. 手元の自動候補から外す。食材庫では末尾に灰色で置き、`×0` を表示（手動で手元に置くことは可、置いても無効）** | ページの無駄がない | 在庫切れに気づきにくくなる → 食材庫に「在庫切れ n」の表示を出す |
| B. 現行の位置のまま | 変更なし | 12 ページのあちこちに灰色チップが混ざる |

- save: なし / privacy: なし（自分の在庫） / W2: なし
- 推奨: **A**（Stock Gate は reducer のまま。表示の順番だけ変える）

### LC-OD-18 規模テストの fixture

| 選択肢 | メリット | デメリット |
|---|---|---|
| **A. テスト専用の合成カタログ（pure 層は引数注入）＋ e2e harness ページ（既存の `e2e/harness/rt01-reference.html` と同じ方式）** | production data と runtime flag に一切触れない | 画面 component がカタログを props で受け取れるようにする必要がある（`PizzaSelectScreen` の `recipes` prop という前例がある） |
| B. dev-only の URL flag（`?catalog=synthetic172`） | 実アプリで見られる | 本番 bundle に分岐が入る |
| C. 実コンテンツが入るまで検証しない | 作業なし | W2 以降に手戻りが出る |

- save: なし（fixture は save を作らない。harness は localStorage を使わない）
- privacy: 合成 id（`fx-topping-042` など）を使うので、実レシピ名が harness に出ない
- W2: W2-A の前に入れるのが Gate 条件（§9）
- 推奨: **A**

---

## 4. working set 最大 12 の根拠（検証結果）

§3 LC-OD-4 の表のとおり。結論:

1. **stage の制約**: 手元は現行の 3×2 グリッドのまま。容量はページ数（2 ページ）で持つ。3 行グリッドは −64〜70px で Layout Contract の floor（Free S360 245）を割るため不可。
2. **探索の制約**: 必要 topping 数は最大 6、85% が 3 以下。「必要＋試したい候補 3」を全 172 レシピで満たす最小容量は 9。
3. **ページの制約**: 2 行グリッドでは 9 も 12 も 2 ページで、タップ数の差は平均 1.33 と 1.5（+0.17）。15 は 3 ページになる。
4. したがって **12 は「2 ページに収まる最大値」、9 は「探索に足りる最小値」**。どちらにするかは Human Feel（のせた材料＋ピン＋ヒントで押し出しが起きるか）で決める。**authority にはまだしない。**

---

## 5. working set の自動優先順位（privacy 監査）

### 5.1 入力として許可するもの・禁止するもの

| 入力 | 可否 | 理由 |
|---|---|---|
| 今ピザにのっている材料（`pizza.toppings` / `sauceIds`） | ✅ | プレイヤー自身の操作結果 |
| user pinned（食材庫で ✓ した材料） | ✅ | 明示的な意図 |
| 表示済みのヒント fact（`ing:`） | ✅ 条件付き | **この session でシートが表示した chip と同じ集合**だけ（§6）。シートを開いていない target の free key は入れない |
| お気に入り | ✅ | 自分の設定 |
| 最近使った | ✅ | 自分の履歴 |
| new / unused | ✅ | 自分の入手・使用の履歴（session-only の間は「この session で入手」） |
| catalog 順の補充（在庫 >0） | ✅ | target に依存しない固定順 |
| 発見 matcher の結果、`discoverableHintCandidates`、`selectHintTarget`（シートを介さない場合） | ❌ | 答えそのもの |
| `recipeDiscoveryState` のレシピ単位の結果 | ❌ | 未発見レシピの材料構成に依存する |
| Rule W reserve、`privacyWorstCaseCandidates` | ❌ | DH4 の秘密側の集合 |
| near-miss の分類、`keyUnused` flag | ❌ | matcher と DISCOVERABLE 候補から計算される（**Fresh Design の HC-4 は撤回**） |
| Dinner の `dinner.pending`（内部の identity） | ❌ | DM-3R-2 で INTERNAL と定義されている |
| Dinner の target recipe（発見済み） | △ | privacy は安全。ゲーム性の判断として LC-OD-16b |

### 5.2 推奨する優先順

```
1. placed      今のせている（このカテゴリ）
2. pinned      食材庫で ✓ した（✓ した順）
3. hint-seen   シートが表示した ing: fact（現在の hint target、表示済みのみ）
4. favorite
5. recent      新しい順
6. new/unused  session 中は「この session で入手」、LC-9 以降は「未使用」
7. fill        catalog 順、在庫 >0 のみ
重複は上位を採用し、容量（LC-OD-4）で打ち切る。
```

Owner 候補の順（placed → hint → pinned → …）と違い、**pinned を hint より上**にした。明示的な操作を、システムが決める要素より優先するため。

### 5.3 不変条件（LC-1 のテストにする）

- **INV-WS-1（入力の独立性）**: `selectWorkingSet` の入力型にレシピ・target・matcher 関連のフィールドが**存在しない**（型で保証）。
- **INV-WS-2（target を変えても不変）**: hint target だけを変えて `hintSeenIds` を固定したとき、出力は変わらない（property test）。
- **INV-WS-3（reserve 非出現）**: 全 25 レシピ（fixture では 172）について、表示済み fact だけから作った working set に reserve が現れない。
- **INV-WS-4（fill の固定性）**: fill の順序は catalog 順と在庫だけで決まる。

---

## 6. Hint → 食材庫連携（privacy 監査、DH4 との整合）

| # | 連携 | 可否 | 根拠 |
|---|---|---|---|
| H-A | 名前まで判明した材料（シートに表示された `ing:` chip）を手元・食材庫に 💡 で示す | ✅ | 表示済みの情報の再掲。reserve は Hint 3.0 で販売されないため `HintSheetView` に存在せず、構造上出られない |
| H-B | シートの chip をタップ → 手元に置く | ✅ | 同上 |
| H-C | 開示された family の回答 → 食材庫をその family で filter して開く | ✅ | filter の中身は**所持材料 × family**。DH4 の k≥2 はこの列挙ができる前提で decoy を数えている |
| H-D | group の回答 → group に属する family を合わせた filter で開く | ✅ | **回答の粒度より細かくしない**。reserve 自身の family を選んで開くのは漏洩になる |
| H-E | category の回答 → そのカテゴリの全所持 | ✅ | 同上 |
| H-F | existence の回答 → filter なしで開く、またはリンクなし | ✅ | 情報がない回答なので、リンクで情報を足さない |
| H-G | hidden reserve を直接選ぶ・強調する | ❌ | OD-H3-5（Rule W）違反 |
| H-H | 「この family の候補 n 件」を `privacyWorstCaseCandidates`（レシピの材料を除いた集合）で数えて表示 | ❌ | 除外された数から、レシピの材料が何件その family にあるかが漏れる。**食材庫の件数は常に「所持 × filter」**だけで数える |
| H-I | fallback の粒度（family ではなく group で答えた事実）を別の UI で補強・説明する | ❌ | DH4 は粒度が変わること自体を最小化している（OD-DH4-10, no FREE LEAK）。「family では答えられなかった」ことを UI が言わない |
| H-J | 未購入のヒントの内容（`buildSelectableHintModel` の未販売 fact）を手元に反映 | ❌ | 未購入の情報が漏れる。**入力は `HintSheetView` の表示済み chip だけ**（model は読まない） |
| H-K | 特徴ヒントの family に属する所持材料のうち「レシピに含まれない」ものを暗くする | ❌ | 負の fact になる（OD-H3-7） |

実装上の単一の源: `hintBoostFromSheetView(view, seenInSession)` は `HintSheetView` だけを入力にとる（LC-1）。DH4-2 が `attr:` の回答を view に載せたとき、`{ level, value }` をそのまま filter spec に写す。

---

## 7. Dex の件数表示 — privacy 監査（DH4 と同等の観点）

問い: 章ごとの「🎨 今の材料で作れそう n」「🏪 ショップの材料で作れそう n」は、未発見レシピの材料構成を漏らすか。

### 7.1 現行 UI との比較

- 現行の Dex は、**未発見の枠ごとに状態の tag**（🎨 / 🏪 / まだ見ぬピザ）を、章内の固定番号（No.）とともに表示している。
- 章の件数は、この枠ごとの tag を数えただけの値。つまり**件数表示の情報量は現行以下**。
- さらに、固定番号という**持ち手**が消える。そのため「No.07 はたまごを使う」のような、枠ごとの知識が蓄積しなくなる。

### 7.2 問題になりうる差分推論

| # | 推論 | 現行（枠 tag） | 章件数（在庫基準） | 章件数（**所持基準**） |
|---|---|---|---|---|
| Q1 | 材料 X の在庫を 0 にして件数（tag）の変化を見る → X を使う未発見レシピを特定 | **枠ごとに判明**（membership oracle） | 章ごとの件数として判明 | **起きない**（在庫では変化しない） |
| Q2 | 材料 X を購入して件数の増加を見る → 「X が最後の不足材料だったレシピが n 件ある」 | 枠ごとに判明 | 章ごとに n 件 | 章ごとに n 件（所持は単調に増えるだけで、1 回限りの開示） |
| Q3 | 発見するたびに件数が減る → どの章のどれかが発見された | 自明 | 自明 | 自明（既知の情報） |
| Q4 | UNKNOWN の件数 = 総数 − 発見 − 行動可能 | 枠ごとに判明 | 章ごとの件数 | 同左（現行以下） |

### 7.3 DH4 の原則との対応

- **k≥2 の精神**: DH4 は「特定できる対象（target）の秘密材料が 1 つに絞られない」ことを守る。章の件数には特定できる持ち手がないため、個々のレシピの構成に結びつかない。
- **単調性**: DH4 は所持が単調に増えることを安全性の根拠にしている。在庫基準は上下するため、Q1 の繰り返し観測（oracle）が可能になる。**所持基準にすると、DH4 と同じ単調性が得られる**。
- **no FREE LEAK**: 件数はヒントを買わずに得られる情報。所持基準なら、既存の Shop NEW 表示（「新しいピザのヒントになるかも」）と同程度の、1 回限りの開示にとどまる。

### 7.4 結論と推奨

- **LC-OD-8b = 所持基準**:
  - 🎨 = 必要材料をすべて所持（在庫は問わない）。
  - 🏪 = すべて entitled で、一部が未所持。
- 在庫不足は Pizza Select（発見済み）とヒントシートの REFILL 表示が担う。表示専用の派生として LC-1 に `dexActionState` を作り、`recipeDiscoveryState` 本体は変えない。
- 章の件数は**数値で表示してよい**。さらに保守的にする選択肢として「章は印だけ、数値は全体の合計だけ」を残す（Owner 判断の予備案）。
- **既存 production への所見 PV-1**:
  - 現行 Dex は在庫基準の枠 tag なので、Q1 の枠単位 oracle が**今すでに存在する**。
  - 悪用には在庫を焼いて減らす必要があり、コストは高い。深刻度は低〜中。
  - Large Catalog の LC-5 で所持基準の集約に置き換えれば解消する。単独の hotfix は不要と判断（別 Issue 候補として記録）。

---

## 8. 「1つ戻す」監査（LC-OD-6、別 Issue 候補）

最新 main の reducer（`51e0923`）を確認した。

| 対象 | 影響 | 条件 |
|---|---|---|
| Discovery matcher | 焼成確定時の最終ピザの集合だけを見るので影響なし。最後の 1 個を戻してその材料が消えれば、集合から外れる（期待どおり） | — |
| ingredient consumption | `consumePizzaInventory` は `CONFIRM_BAKE` の中だけで、最終ピザから減算する（phase ガードで exactly-once）。PREPARE 中の取り消しは在庫に触れない | 取り消しは PREPARE 限定 |
| inventory / Stock Gate | `canPlaceIngredient` は「在庫 − のせた数」で判定するので、取り消すと自然に枠が 1 つ戻る | — |
| scoring | Scoring 2.0 は最終ピザを採点するだけ | — |
| Completion Gate / partial quantity | 最終ピザで判定 | — |
| one-way flow | CHEESE を確定した後の TOPPING 中に cheese を戻すと、工程の逆行になる | **戻せるのは今のステップのカテゴリの最後の 1 個だけ** |
| sauce | deposits / 塗りは「1 個」単位ではない | **sauce は対象外** |
| Lunch Rush | Guided の注文で時間制限あり。取り消しは有利にはたらくだけ | 含めるかは Owner 判断（推奨: FREE / Free Cooking / Dinner から） |
| Dinner | `DINNER_COMPOSITION_ACTIONS` の集合に加える必要がある（PREPARE 以外では拒否） | 集合に追加 |
| Guided | 同じ reducer 経路 | — |
| undo 後の再配置 | 通常の `PLACE_TOPPING`。`findOpenSpot` が空いた位置を再利用する | placement token を増やす |
| drag の古い session | tray 側の `resetToken` / `makingStepToken` と同様に、取り消し時にも token を増やす必要がある | token を追加 |
| exactly-once consumption | 変化なし（消費は焼成確定の 1 回だけ） | — |
| Cooking Timing / Efficiency | 手順の時間計測に影響なし（操作回数を採点に使っていないことを実装時に再確認する） | 実装時に確認 |

結論: 安全に実装できるが、**Large Catalog の前提ではない**。LC-X として別 Issue を推奨する。

---

## 9. Wave 2 Gate（W2-A）

### 9.1 実測にもとづく W2-A（34 recipes / 約 37 ingredients）の姿

| 画面 | 現行（25 / 29） | W2-A | 基準 |
|---|---|---|---|
| Free Cooking / Dinner topping | 22 → 4 ページ、平均 2.36 タップ | **27〜30 → 5 ページ、平均 2.78〜3.0、最悪 5** | 5 ページ以下は現行の e2e（TOPPING p2）と Layout Contract の範囲内。stage は不変 |
| cheese | 4 → 1 ページ | 4〜7 → 1〜2 ページ | 同上 |
| Recipe Dex | 25 枠、360×640 で 5.4〜8.1 画面 | 34 枠、360×640 で約 7.2〜10.9 画面（390×844 で 5.3〜7.9） | 長いが操作は壊れない |
| Pizza Select | 最大 2435px | 最大 3176px（360×640 で 5.4 画面） | 許容 |
| Shop | 26 行 | 約 34 行 | 許容 |

### 9.2 判定

**C. LC-1 / 1b only required before W2-A**

- UX として W2-A は現行 UI のまま**一時的に許容できる**（トレイは +1 ページ、stage 不変、Dex は長いが壊れない）。
- ただし W2-A は材料が 30 前後に達する最初の wave。**次の閾値を計測で判定できるように**、LC-1（pure 層）と LC-1b（29 / 40 / 62 / 105 / 179 の fixture と harness）を W2-A より前に入れる。
- **LC-2 / 3 を必須にする閾値**（W2-B 以降の gate）:
  - いずれかのカテゴリの所持数が **> 30**（6 ページ以上、最悪 6 タップ以上）になる wave の前。
  - W2 全体（未 ship の新材料 15 → 44 種、topping 34 = 6 ページ）は、これに該当する。
  - Dinner の時間制限を調整する DM-5 は、W2-A の 5 ページの状態で計測すること。
- **LC-5（Dex）を必須にする閾値**: レシピ総数が **> 40** の wave の前（現行の Dex は 40 レシピで、360×640 において 0 発見 8.4 画面〜全発見 12.7 画面になる）。

---

## 10. Shop / Inventory / 食材庫の共通モデル（UI だけ共有）

```
┌─ Authority（変更なし）──────────────────────────────────────────┐
│ ownedIngredientIds / inventory / remainingStock / canPlaceIngredient│
│ materialShopState / materialOffer / nextMaterialHint               │
│ reducer: PLACE_TOPPING / PURCHASE_INGREDIENT / RESTOCK_INGREDIENT  │
└──────────────┬────────────────────────────────────────────────────┘
               │ 読むだけ
┌─ Row adapter（画面ごと、pure）─────────────────────────────────┐
│ pantryRows(owned, inventory)          → CatalogRow<{stock}>       │
│ shopRows(owned, unlocked, inventory)  → CatalogRow<{state, offer}>│
│ inventoryRows(owned, inventory)       → CatalogRow<{stock}>       │
└──────────────┬────────────────────────────────────────────────────┘
               │ 共通（pure、generic）
┌─ catalogQuery ─────────────────────────────────────────────────┐
│ filter(category / family / group / text / favorite / recent / inStock)│
│ sort(recent / frequent / stock / reading / acquired)              │
│ group(family) / counts（常に行集合の上でだけ数える）               │
└──────────────┬────────────────────────────────────────────────────┘
               │
┌─ IngredientLibrary（UI）────────────────────────────────────────┐
│ mode="pick"  : onTogglePick / onConfirm       （食材庫）          │
│ mode="view"  : onToggleFavorite のみ           （Inventory）       │
│ mode="shop"  : 行 slot に既存の購入 / 補充ボタン（Shop）           │
└──────────────────────────────────────────────────────────────────┘
```

- `catalogQuery` は行（row）の payload を**不透明な `T`** として扱い、価格・在庫を計算しない。表示用の値は adapter が既存関数から持ち込む。
- 購入・補充・配置の action は、今と同じく各画面から reducer に dispatch する。共通層は action を持たない。
- mode ごとの props は discriminated union にする。`view` mode の型に `onPurchase` / `onRestock` / `onPick` が**存在しない**ことで、Inventory の read-only 保証（所持・在庫について）を型で維持する。

---

## 11. LC-1 pure 層 / LC-1b fixture の具体化

### 11.1 LC-1（production UI には接続しない）

| module（候補: `src/logic/catalog/`） | 公開関数 | 入力で禁止するもの |
|---|---|---|
| `catalogText.ts` | `normalizeForSearch(s)`（ひらがな ⇄ カタカナ、全角半角、長音・中黒を無視）、`matchesQuery(row, q)` | — |
| `catalogQuery.ts` | `queryCatalog<T>(rows, query)`、`groupByFamily(rows)`、`countBy(rows, key)` | レシピ |
| `workingSet.ts` | `selectWorkingSet(input): { items, overflow }`（§5.2 の順） | レシピ / target / matcher / reserve（型で排除） |
| `hintBoost.ts` | `hintBoostFromSheetView(view, seen): { ingredientIds, filter }` | `buildSelectableHintModel`（未販売 fact） |
| `usageRanking.ts` | `rankRecent(log)`、`rankFrequent(log)`、`isFavorite(prefs, id)`（session の store 型） | — |
| `dexShelf.ts` | `dexActionState(recipe, ownership)`（所持基準、§7）、`aggregateChapters(chapters, …)` → `{ discovered, total, actionable: { explore, shop } }` | 在庫（8b = 所持基準の場合） |
| `selectList.ts` | `querySelectList(cards, { text, filter, sort })`（発見済みのカードだけを入力にとる） | 未発見のレシピ |

テスト:
- unit: 各関数の正常系・境界。
- privacy invariants: INV-WS-1〜4 に加えて、次の 4 つ。
  - LOCKED / 未購入材料が `pantryRows` / `queryCatalog` の結果に出ない。
  - 未発見レシピ名が `selectList` に出ない。
  - `dexShelf` の件数が在庫操作で変化しない（8b）。
  - `hintBoost` の出力 ⊆ view に表示された chip。
- scale: LC-1b の fixture 上で、各関数が 179 材料 / 172 レシピで O(n log n) 以内に収まること（時間の上限つき）。

### 11.2 LC-1b（production data を書き換えない）

- `src/test/catalogFixtures.ts`（テスト専用、production から import しない）:
  - `buildSyntheticCatalog({ ingredients, recipes, split, familyShares, chapterSizes, seed })` が、決定的な合成 `Ingredient[]` / `Recipe[]` / family 表を返す。
  - id は `fx-<category>-<nnn>` の形。
  - レシピの topping 数は 172 行の分布（0:5 / 1:30 / 2:50 / 3:62 / 4:19 / 5:5 / 6:1）から決定的に割り当てる。
- population:
  - 材料: **29 / 37（W2-A worst・mixed）/ 40 / 62 / 105 / 179**（分割は `FIXTURE_INGREDIENT_SPLITS`）。
  - レシピ: **25 / 34 / 101 / 172**（章は `CHAPTER_SIZES`）。
  - どちらも `tools/large_catalog_ux_scale_model.py` と同じ値を使う。
- UI 規模の検証:
  - `e2e/harness/large-catalog.html`（既存の `e2e/harness/rt01-reference.html` と同じ方式）で、component に fixture を props として渡して描画する。
  - 前提: 対象 component がカタログを props（production 既定値つき）で受けられること。`PizzaSelectScreen` の `recipes` prop が前例。
  - `DexOverlay` / `ShopOverlay` / `InventoryOverlay` / `IngredientTray` は、各 slice で同じ形にそろえる。

---

## 12. Fresh Design からの修正点

| Fresh Design | 本 Gate での扱い | 理由 |
|---|---|---|
| HC-4: near-miss の FAR_KEY_UNUSED で NEW 未使用を繰り上げる | **撤回** | matcher と DISCOVERABLE 候補に由来する信号で working set を動かすため（§5.1） |
| 手元の優先順: placed > hint > picks > … | **placed > pinned > hint-seen > favorite > recent > new > fill** | 明示的な操作を優先 |
| 手元容量 12 を推奨値として記載 | **暫定値。authority にしない**（9 と 12 を Human Feel で比較） | §4 |
| Pizza Select 3 列を推奨 | **推奨 2 列。3 列は名前改行の解決が条件** | §3 LC-OD-12 の実測 |
| Dex タイル 3 列 | **LC-OD-12 と同じ結論に揃える（2 列が既定）** | 同じ名前改行問題 |
| 章の 🎨 / 🏪 件数（基準は未定義） | **所持基準**（LC-OD-8b） | §7 |
| 対象画面に Dinner を含めていない | **Dinner も対象**（LC-OD-1b、16b） | main の DM-3R-2 |
| LC-OD-18: dev URL flag も候補 | **テスト専用の fixture ＋ e2e harness を推奨** | production bundle に分岐を入れない |
| Slice 番号（LC-2 = トレイ、LC-5 = 1つ戻す、LC-6 = Dex…） | **§13 の順序に置き換え。1つ戻すは LC-X（別 Issue）** | Owner 提示の順序を再評価した結果 |

---

## 13. 実装順の再評価

Owner 提示の順序（LC-0 → 1 → 1b → 2 → 3 → 4 → 5 Dex → 6 Select → 7 Shop → 8 Inventory → 9）は**おおむね妥当**。ただし次の 3 点を推奨する。

1. **LC-2 は「手元 / すべて」の切替を含めて単独で出せるようにする**。食材庫（LC-3）が無い状態では、手元に無い材料に届く経路が必要になる。「すべて」モードは現行のページ送りそのものなので、LC-2 は単独で revert・出荷ができる。
2. **Inventory（LC-8）を Shop（LC-7）より先にする**。どちらも食材庫コンポーネントを再利用するが、Inventory は view mode で action を持たず、共通モデルの最初の検証先として低リスク。Shop は economy の action を持つので最後がよい。→ 推奨順: **LC-7 = Inventory、LC-8 = Shop**。
3. **LC-5（Dex）は LC-1 の後なら LC-2〜4 と並行できる**。発動の閾値が別（レシピ数 > 40）のため。

| Slice | dependency | files 候補 | tests | mobile gate | privacy gate | revertability |
|---|---|---|---|---|---|---|
| **LC-0** Owner Decisions / SSOT | — | docs / data / tools（本書） | `--check` | 実測 4 viewport | §5〜7 の監査 | docs のみ |
| **LC-1** pure layer | LC-0 の決定（1 / 2 / 4 / 5 / 8b / 16） | `src/logic/catalog/*.ts` + `*.test.ts` | unit、INV-WS-1〜4、privacy invariants | なし（UI 未接続） | 入力型でレシピ・target を排除、`hintBoost` ⊆ view | 新規ファイルのみ・未接続なので削除だけで戻せる |
| **LC-1b** scale fixtures | LC-1 | `src/test/catalogFixtures.ts`、`e2e/harness/large-catalog.*`（harness は LC-2 から使う） | fixture の決定性テスト、LC-1 の scale テスト | harness が 4 viewport で描画できる | fixture id は合成、実名なし | テスト専用、production 不変 |
| **LC-2** 調理トレイの working set | LC-1、LC-1b、LC-OD-1 / 4 / 17 | `IngredientTray.tsx`、`logic/prepareDock.ts`（行予約の単純化）、`GameScreen.tsx`、`App.css` | 既存トレイ系 test 全件、`stage-size-stability`、`layout-contract`（Free / Dinner / Guided / Lunch の floor 0px 回帰）、harness 40 / 62 / 105 | **全 mode の stage floor 不変**、棚バー 28px = 旧 pager 行、HV 390×844 + 360×640 | INV-WS-*、DOM に target 由来の属性を出さない（`antiSpoiler` sweep） | 「すべて」モードで現行と同一表示。発動条件（所持 > 容量）を外せば完全に元へ戻る |
| **LC-3** 食材庫 bottom sheet | LC-2、LC-OD-2 / 3 / 15 | 新 `IngredientLibrary.tsx`（pick mode）、`GameScreen.tsx`、`App.css`、`data/ingredients.ts`（`readingJa`） | 開いている間の入力停止（`isGlobalOverlayOpen`）、ドラッグ不可、検索正規化 | シート 70dvh、4 列、360×640 で 16 件表示、HV 3 viewport | LOCKED 非表示、件数は「所持 × filter」のみ | シートを開く入口を外すだけで戻せる |
| **LC-4** Hint 連携 | LC-2、LC-3、LC-OD-7（family 連携 H-C〜F は DH4-2 の merge 後） | `HintSheet.tsx`、`logic/catalog/hintBoost.ts` の配線、`GameScreen.tsx` | H-A〜K の各テスト、reserve 非出現、未購入 fact 非反映 | ヒントシートの高さ不変（≤45dvh） | §6 表の全行 | 💡 表示とリンクは独立に外せる |
| **LC-5** Recipe Dex | LC-1（LC-2〜4 と並行可）、LC-OD-8 / 8b / 9 / 10 / 11 | `DexOverlay.tsx`（カタログを props 化）、`state/recipeChapters.ts`（読むだけ）、`logic/catalog/dexShelf.ts`、`App.css` | `discovery-dex-hint` e2e の更新（章単位のヒント CTA）、`antiSpoiler`、件数が在庫操作で不変 | 閉じた状態で 1 画面、HV 390×844 + 360×640、harness 172 | §7（所持基準、枠番号なし） | 旧 `renderSlot` 経路を残せば props 1 つで戻せる |
| **LC-6** Pizza Select | LC-1、LC-OD-12 / 16 | `PizzaSelectScreen.tsx`、`state/pizzaSelect.ts`（読むだけ）、`logic/catalog/selectList.ts`、`App.css` | 既存 test、検索・filter・sort | LC-OD-12 の決定どおり、名前の途中改行 0、HV 4 viewport | 入力は発見済みのカードのみ | 追加 UI（検索・filter）を外せば現行に戻る |
| **LC-7** Inventory（view mode） | LC-3、LC-OD-14 | `InventoryOverlay.tsx` → `IngredientLibrary` の view mode | 型テスト（view mode に mutation callback が無い）、既存 test | HV 390×844 | なし（自分の所持） | 旧 overlay を残して切り替えられる |
| **LC-8** Shop | LC-3、LC-7、LC-OD-13 | `ShopOverlay.tsx`（セクション化・shop mode） | 価格・数量は `materialOffer` のみ（回帰）、LOCKED 非掲載、feedback 表示 | 既定表示 1 画面、HV 390×844 + 360×640 | LOCKED 非掲載、進捗 1 行（不変） | セクションを外せば現行のリスト |
| **LC-9** お気に入り / 最近の永続化 | LC-2〜8 の Human Feel、LC-OD-5 の再判断 | `state/persistence.ts`（任意フィールド）、migration test | 旧 save の読み込み、未知フィールドの保持、Full Reset の範囲 | なし | 自分の履歴のみ | フィールドを無視すれば session 動作に戻る |
| **LC-X** 1つ戻す（別 Issue） | 独立 | reducer（`UNDO_LAST_PLACEMENT`）、`DINNER_COMPOSITION_ACTIONS`、GameScreen | §8 の全項目 | 焼くバー内に収まる | なし | action を外せば戻せる |

---

## 14. Cooking Techniques との依存

- **分離の原則**: OD-TAX-6 により、技法（late topping / post-bake / 多層 spread / 形 / 特殊カット）は材料の family ではない。Technique Discovery と Dex の「調理法」欄は Large Catalog とは**別の PR** にする。
- **Large Catalog 側で用意しておくこと**（受け口だけ作り、中身は作らない）:
  1. Dex 詳細シートを「セクションの配列」（材料 / 調理法 / 記録）で組む。調理法セクションは data が無ければ描画しない。
  2. `dexShelf.aggregateChapters` の戻り値に、将来の `techniques?: { discovered, total }` を追加できる形にする（件数の privacy 規則は §7 と同じ所持基準の考え方を、技法の所持＝習得に読み替える）。
  3. 食材庫の棚（family）に技法を**混ぜない**。技法は調理ステップのタブ（`MakingStepTabs`）側の概念。
  4. DH4 §14 の「D. 技法ヒント」が来たときの hint 連携は、`hintBoost` の filter spec に `technique` 軸を足す拡張で受ける。ingredient 用の working set には入れない。
- **依存の向き**: Large Catalog（LC-5）は Techniques に依存しない。Techniques の Dex 表示は LC-5 の詳細シートと章集約を前提にできる。順序は **LC-5 → Techniques Dex 欄**。同じ PR にはしない。

---

## 15. 成果物と再現

| 種別 | パス |
|---|---|
| 本書 | `docs/reports/TETO_LARGE-CATALOG-UX_Owner-Decision-Gate.md` |
| Gate 計測 | `tools/large-catalog-ux/gate.measure.spec.ts` → `docs/reports/data/TETO_LARGE-CATALOG-UX_GATE-MEASUREMENTS.json`、`docs/reports/screenshots/large-catalog-ux/gate/*.png`（12 枚） |
| モデル | `tools/large_catalog_ux_scale_model.py`（`gate` 節を追加）→ `docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json` |

```bash
npx playwright test -c tools/large-catalog-ux/playwright.measure.config.ts   # measure + gate.measure
python3 tools/large_catalog_ux_scale_model.py && python3 tools/large_catalog_ux_scale_model.py --check
```

Gate の計測は、`origin/main` 51e0923 の worktree に tools だけを複製して実行した（本ブランチの src は 5a33d85 のまま、main の merge はしていない）。

## 16. Non-goals

- `src/**` / `e2e/**` / CSS / workflow の変更、PR 作成、merge、deploy、既存 PR の変更。
- 発見規則・ヒント規則（Rule W、k≥2、価格）・Ladder・章算出・価格・在庫規則の変更。
- PV-1（現行 Dex の在庫 oracle）の hotfix。LC-5 で解消する方針として記録するのみ。
- W2-A の内容定義（GitHub 上に未定義。本書は Owner 提示の規模だけを使用）。

---

## 17. Owner Authority（2026-09-27 承認）

Owner は本 Gate の結果を承認し、以下を **Owner Authority** とした。machine-readable 版は
`docs/reports/data/TETO_LARGE-CATALOG-UX_OWNER-DECISIONS.json`。

| ID | Owner の決定 | 状態 |
|---|---|---|
| **LC-OD-4** | 手元の容量は 9 / 12 のどちらにも**まだ固定しない**。LC-2 の実装時に 390×844 / 360×800 / 390×664 / 360×640 で実機相当の比較を行い、Human Feel を含めて最終決定する。それまで pure logic は容量を**引数**として受け取る | DECIDED（数値は LC-2 で決定） |
| **LC-OD-8b** | Dex の「作れそう」などの集計は、inventory の数量ではなく **permanent ownership** を基準にする。在庫を 0 にすることで未発見レシピ情報が変化する既存の漏洩（PV-1）を解消する方向を採用する。ただし既存 production の挙動は **LC-5 まで変えない** | DECIDED |
| **LC-OD-12** | Pizza Select は **2 列を維持**する。3 列化は採用しない。大量化は検索・絞り込み・最近・お気に入りなどで解決する | DECIDED |
| **LC-OD-16b** | Dinner の手元へ target recipe の材料を**自動投入しない**。Dinner でも player が自分で手元を構成する。target が発見済みであることを利用した、自動的な正解材料の提示は行わない。将来、Dinner の Human Timing で探索負荷が問題になった場合は、Dinner 専用 UX として再検討する | DECIDED |
| **LC-OD-6** | 「1つ戻す」は Large Catalog 本体から分離する。Duplicate Gate を行い、重複がなければ LC-X の独立 Issue として記録する。今回は実装しない | DECIDED（LC-X Issue として記録） |
| その他（LC-OD-1〜3, 5, 7〜11, 13〜15, 16, 17, 18） | Gate の推奨を**設計方針として承認**。数値・文言は各 slice の Gate で最終確認する | APPROVED AS DESIGN DIRECTION |

- LC-X（1つ戻す）: Duplicate Gate の結果は重複なし。独立 Issue を作成し、番号は `TETO_LARGE-CATALOG-UX_OWNER-DECISIONS.json` の `lcX.issue` と LC-1 の Result Report に記録する。
- 次の段階: `docs/reports/TETO_LARGE-CATALOG-UX_LC-1_Implementation-Gate.md`（LC-1 / LC-1b）。
