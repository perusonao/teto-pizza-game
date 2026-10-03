# TETO Post-Production27 / 53 Recipe Scale — Owner Decision Packet

**docs のみ。コード・runtime・save・schema・PR の変更なし。** 元: `TETO_POST-PROD27_53-RECIPE-SCALE_Fresh-Audit.md` §9.1（OD-S1〜S12）。
audited main: `b8617ac0218bf20eb53f68ed12dea09db20e3fa8`。数値の根拠は同 Audit と `data/TETO_POST-PROD27_53-RECIPE-SCALE_Fresh-Audit.json`。

---

## 0. 先に読む

### 0.1 既決（本 Packet で再決定しない）

| 既決 | 内容（出典） |
|---|---|
| **OD-378-1〜6** | #378: HARD=NO / SOFT=YES、**案 1 採用**（Research カードに補充案内 + Shop CTA、材料名・個数は出さない、Shop で在庫 0 を見つけやすく）、案 2・案 3 は**不採用**、save/schema 変更なし、「次のピザを作る」は #378 実装前に Fresh Audit（新遷移は勝手に決めない）。Gate: #376 / R6-e 完了まで runtime 実装は開始しない（Issue #378 コメント） |
| OD-T1〜T8 | 具材 22 の family 確定、sauce / cheese の role は **導入 PR ごと**に確認（T5）、mascarpone deferred（T4）、taxonomy row は導入 PR と同時（T7）、catalog は凍結（T8） |
| OD-W2-1 / LAD-1、OD-REC04-1/3、OD-DISC-9 | ladder step 1〜24 凍結・以降 append-only、価格 tier（T4 = step 30〜）、chapter = key step の tier。**第 4 章の出現は規則どおりで再決定不要** |
| OD-5 | hand 容量 12（変更しない） |
| LC OD-1 | Dinner の hand / pantry は**別 audit**（Dinner / Lunch Rush の paged tray 問題はこの既決の範囲） |
| OD-RB-10 / RB-12、INV-D4 / D7 | K = 3 固定（53 / 172 の balance は**別 audit**）、sauce / cheese は全件判定、カテゴリ行の条件付き省略は禁止。Contract 2.1 §13.1 に **Expansion Gate A** が trigger として記録済み |
| OD-TQ-2 / 12 / 15 / 18 | 技法の分類（no-sauce = TQ-1D、後乗せ = TQ-2、複数 spread = TQ-3）、推測のみの post-bake は必須扱いしない |
| OD-W2-4 | CUT は dough 根拠がある recipe のみ allowlist |
| OD-A1〜A6 | 検索 alias は **Owner 承認済みのみ**（生成しない） |
| OD-D3-17 O3 / D-4 / Migration A | `ladderCredit` / `lunchRush` / key-free は **recipe ごとのフラグ**（機構は既決。個別適用は recipe ごと） |

### 0.2 元 OD-S1〜S12 の整理

| 元 | 扱い |
|---|---|
| S1 | → **OD-P1** |
| S2 | → **OD-P2** |
| S3（前半: 13 role） | → **OD-P3** |
| S3（後半）+ S9（sauce 型）+ S10（sauce 行） | → **OD-P4** |
| S4 | → **OD-P5** |
| S8 | → **閉鎖**（OD-378-1〜6 で決定済み）。残る論点は「拡張との実装順序」のみ → **OD-P6** |
| （新規） | → **OD-P7**（Research Entry 匿名ラベル） |
| S5 + S7 | → **OD-P8**（S7 は OD-DISC-9 / REC04-3 でほぼ既決。残るのは T4 初使用の検証 gate のみ） |
| S6 | → **OD-P9** |
| S9（順序）+ S10（Gate A） | → **OD-P10**（K = 3 の balance は OD-RB-10 で別 audit 済み＝決定事項ではない） |
| S11 | **後回し**（OD-A の個別承認。推奨 slice に漢字・英字名の材料なし） |
| S12 | **後回し**（LC OD-1 の「Dinner は別 audit」。拡張で 8 ページになる事実は Audit に記録済み） |

### 0.3 一覧

| ID | 論点 | 今決める？ | 推奨 |
|---|---|---|---|
| OD-P1 | 「53」の population 定義 | **要** | C（件数 gate を廃止、capability wave 管理） |
| OD-P2 | catalog vs PIZZA DB の composition 衝突 18 件 | **原則のみ要**（18 件個別は後） | D（source 優先 + catalog のみは明示承認） |
| OD-P3 | 13 材料の role 権威 | 後回し可 | B（OD-T5 のまま、導入 PR で確認） |
| OD-P4 | 仕上げ sauce / second sauce / spread 具材 | **除外原則のみ要** | C（設計決定まで ship・ladder 母集団から除外） |
| OD-P5 | identity 衝突 | **要**（guard 規則） | A（観測可能な dimension が入るまで ship しない） |
| OD-P6 | #378 と拡張の実装順序 | **要**（順序のみ） | A（#378 案 1 を Slice 1 の前に） |
| OD-P7 | Research Entry 匿名ラベル 10 件超 | 後回し可 | 暫定 A、母集団拡大前に B |
| OD-P8 | ladder 拡張（credit・材料なし recipe・T4 初使用） | **一部要** | 材料を増やす recipe のみ ship + credit 付与、T4 は到達前に検証 |
| OD-P9 | first vertical slice | **要** | B（`pesto-gamberi`）。D2 次第で A |
| OD-P10 | Cooking Steps 導入順 | 後回し可（#295 の採否のみ早め） | A（OD-TQ-2 順 + 内容 slice は並走） |

---

## OD-P1 「53」の population 定義

| 項目 | 内容 |
|---|---|
| 何を決めるか | 「53」を何の単位で管理するか、候補の出典 |
| なぜ今 | 全 Decision の前提。定義で数値が変わる（Production 総数 53 なら **+26 recipe / ingredient 56〜65**、catalog 53 件なら Production と 16 件重複・Production だけの 11 件が対象外） |
| A | 53 = Production 総数の目標（+26） |
| B | 53 = catalog 53 件の消化率（16 件は ship 済） |
| C | **件数 gate を廃止**。capability 単位の wave で管理し、「53」は呼称のみ |
| D | C + 候補源を catalog live 29 ∪ 172 matrix の READY / FULL 行に拡張 |
| メリット | A: 目標が明快 / B: 既存資料と整合 / C: 実態（+26 は全 capability track の完了点）に合う、deadlock を件数で誘発しない / D: source 権威付きの候補が増える |
| デメリット | A: 現 engine 外の recipe を件数合わせで入れる圧力（HARD DEADLOCK 経路）/ B: 11 件の Production-only と stale 値を引きずる / C: 進捗の分かりやすさが下がる / D: 範囲が 172 に広がる |
| Production27 | 影響なし |
| 53-scale | A: 現 engine ready は 9 件（source 衝突なし 5）で届かない。C: 各 wave を ready 件数で閉じる |
| 172-scale | C / D がそのまま 172 への道筋。A / B は 172 で再定義が要る |
| save / schema | なし |
| Cooking Steps | A は工程の全 track 完了を暗黙に要求。C は track ごとに wave 化 |
| Discovery / Contract 2.1 | 母集団が変わると canonical number（97 / 27 recipe）の再算出対象が変わる（別 audit） |
| **推奨** | **C**（候補源は catalog live 29 を既定、172 READY 行の追加は slice ごとに明示承認） |
| 理由 | +26 を件数で追うと second sauce 5 / identity 衝突 6 を ladder に入れる誘因になり、Audit で HARD DEADLOCK 条件と確認済み |
| 時期 | **今決める**（安価で他の前提になる） |

## OD-P2 catalog vs PIZZA DB の composition 衝突 18 件

| 項目 | 内容 |
|---|---|
| 何を決めるか | 食い違う時の composition authority の**規則**、および PIZZA DB 行のない catalog-only recipe（16 件）を ship してよいか |
| なぜ今 | catalog は凍結 research artifact（OD-T8）で source ではない。Slice 1 の候補が「行なし」か「source あり」かで分岐する。No.27 は source 権威で作られた |
| A | PIZZA DB 優先（行がある recipe は source 構成に寄せる。未解決 token は block） |
| B | catalog 優先（game-original として source 主張を切り離す） |
| C | recipe ごとに Owner 判断（現状の `BLOCKED_PRODUCT_DECISION` のまま） |
| D | 原則 A + 行なしの catalog-only は「game-design candidate（source なし）」と明記して Owner が slice ごとに承認 |
| メリット | A: 出典が一貫 / B: 設計の自由度 / C: 誤採用なし / D: A の一貫性を保ちつつ catalog-only の道を残す |
| デメリット | A: 候補が減る（行なし 16 は不可）/ B: 「PIZZA DB 由来」と見えて乖離する、Hint / Research の根拠が弱い / C: 判断量が多い / D: 承認の運用コスト |
| Production27 | 影響なし（既存 27 は source or 既決） |
| 53-scale | 衝突 18 件 + 行なし 16 件の扱いが決まる。ready 9 のうち 4 件（boscaiola / alla-norma / ai-funghi-porcini / supreme）が衝突側 |
| 172-scale | 172 matrix の COMPOSITION_CONFLICT（candidate 18 行 + shipped 9 行）にも同じ規則を適用できる |
| save / schema | なし |
| Cooking Steps | なし（ただし late 根拠が catalog タグのみの 15 件は別論点 = OD-P10） |
| Discovery / Contract 2.1 | `canonical(T)` = `requiredIngredients`。構成が変われば discovery target・○× の membership・Notebook が変わる。**採用後に構成を変えると既存 Dex / facts と矛盾**するので慎重に |
| **推奨** | **D**（原則だけ今決め、18 件の個別は各 slice 時） |
| 理由 | 18 件を今まとめて決める必要はなく、規則があれば slice 単位で機械的に判定できる。No.27 の前例（source 優先）と整合 |
| 時期 | **原則のみ今**。18 件個別は後回し可 |

## OD-P3 13 材料の role 権威

| 項目 | 内容 |
|---|---|
| 何を決めるか | sauce 7 / cheese 6 の role（catalog 値のみ・未確認）を**先に確定するか**。（既決: OD-T5 = 導入 PR ごと確認、OD-T4 = mascarpone deferred） |
| なぜ今 | 新規ではなく**運用タイミング**の判断。推奨 slice は sauce / cheese の新材料を含まないため緊急性はない |
| A | 13 件を catalog 値で今確定（mascarpone = cheese） |
| B | **OD-T5 のまま**、導入 PR ごとに確認 |
| C | cheese 5（brie / caciocavallo / provolone / ricotta / ricotta-salata）だけ先に確定。sauce 7 は OD-P4 後、mascarpone は OD-T4 維持 |
| メリット | A: 一括で見通し / B: 既決どおり・誤確定なし / C: 判断が単純な cheese を先に消化 |
| デメリット | A: sauce 5 件は用途衝突（OD-P4）が未解決で誤確定の恐れ、T4/T5 を実質上書き / B: slice 直前に判断が集中 / C: 半端な状態が残る |
| Production27 | 影響なし |
| 53-scale | 未確認 13 件が taxonomy 未解決数の全部（family 未解決は 0） |
| 172-scale | OD-4（sauce / cheese 細分は 105 材料 audit で）と同じ流れ。sauce 18 / cheese 16 規模で再判断 |
| save / schema | なし（role は code data） |
| Cooking Steps | sauce role の仕上げ用途は OD-P4 / OD-P10 |
| Discovery / Contract 2.1 | sauce / cheese は全件 ○×（OD-RB-12）。role が変わると行の分類が変わる |
| **推奨** | **B** |
| 理由 | 既決に沿い、新規 Decision を作らない。必要な材料が出た slice で確認すれば足りる |
| 時期 | **後回し可** |

## OD-P4 仕上げ sauce / second sauce / spread 具材の role と扱い

| 項目 | 内容 |
|---|---|
| 何を決めるか | sauce role の材料が (a) 焼成後の仕上げ、(b) 2 つ目の sauce、(c) spread 配置の具材（`nduja`）として使われる場合の方針。対象: `mayo` `honey` `chili-oil` `buffalo-sauce` `teriyaki-sauce` `nduja`、second sauce 5 recipe（`shrimp-mayo` `potato-bacon` `teriyaki-chicken` `diavola` `buffalo-chicken`） |
| なぜ今 | 1 枚の pizza は sauce を 1 種しか持てない（`sauceIds` 1 要素）。second sauce recipe を ladder 母集団に入れると**物理的に作れず HARD DEADLOCK**。Contract 2.1 は「sauce 行は常に 1 件」を前提にしている |
| A | role = sauce 維持 + 「焼成後仕上げ」属性。second sauce は FINISH でのみ許可（Contract 2.1 の sauce 行の再設計が必須） |
| B | 仕上げ系を**具材 role**に再分類（既存 7 family のいずれかへ。例: `other`） |
| C | **設計が決まるまでこの class を ship・ladder 母集団から除外**（role 変更は TQ-3 / FINISH 設計時） |
| D | 複数 sauce を焼成前の paint 2 層として許可（TQ-3 の前倒し） |
| メリット | A: role 軸と timing 軸を分離できる（OD-T2 の考え方と整合）/ B: sauce 行を 1 件のまま保てる / C: 今は何も壊さない、決定を急がない / D: 本来の調理に近い |
| デメリット | A: Contract 2.1 / Hint 5.0 の sauce rung / RESERVED の再設計が前提 / B: 「ソース」と見える材料が具材欄に入り、既決 family（persisted id）の意味を広げる / C: second sauce 5 + 関連 recipe が当面使えない / D: `sauceIds` 複数化・heatmap 2 層・score 成分など MAJOR（#295 の分類。未 merge） |
| Production27 | 影響なし |
| 53-scale | 母集団から 5 recipe（+ honey-fig 等の no-sauce / 仕上げ系）が外れる。cumulative で後乗せ追加後 17 → second sauce 追加で 22 |
| 172-scale | matrix 上 `MULTI_SPREAD_LAYER` が 14 行（#295 の集計。未 merge）。同じ方針が効く |
| save / schema | 材料 role は code data。save 変更なし（Hint family の persisted id は触らない） |
| Cooking Steps | A / D は FINISH（TQ-2）・TQ-3 に直結。C はそれらを待つ |
| Discovery / Contract 2.1 | INV-D4 / D7: sauce 行の条件付き省略は禁止、「なし」直接表示も禁止。second sauce は panel 行数 / `used(pizza)` に影響 = **Expansion Gate A の一部** |
| **推奨** | **C**（今は除外原則だけを記録。A / B / D は FINISH・TQ-3 の設計で選ぶ） |
| 理由 | 今 role を選ぶと Contract 2.1 と Hint 5.0 の再設計を先取りする。推奨 slice には不要で、除外だけで Audit の HARD DEADLOCK 条件は消える |
| 時期 | **除外原則のみ今**。role の最終形は後回し可 |

## OD-P5 recipe identity collision

| 項目 | 内容 |
|---|---|
| 何を決めるか | 同じ ingredient set + sauce base を持つ recipe の扱い（`bufalina`=margherita、`chicago-deep-dish`=salsiccia、`detroit-style`=pepperoni、`ny-style` = `greek-style` = `stuffed-crust`） |
| なぜ今 | matcher は set + 既定 dimension の一致で発見し、**同一 signature の ELIGIBLE が 2 つあると両方 AMBIGUOUS で発見不能**。入れた瞬間に既存 Production（margherita / salsiccia / pepperoni）が壊れる。`bufalina` は starter を壊し step 1 から詰む |
| A | **観測できる identity dimension（pan / layerOrder / late / shape …）が matcher に入るまで ship しない**（規則化 + gate テスト） |
| B | 片方を勝者とし、他は同一 Dex の別 variant 扱い（新概念） |
| C | 別 dimension を最小限先に導入して区別（pan 等） |
| D | rejected / deferred のまま恒久除外 |
| メリット | A: 既存を確実に守る・追加実装なし / B: 件数は増やせる / C: 区別が正規の形で入る / D: 単純 |
| デメリット | A: 対象 recipe は当面使えない / B: Dex・Hint・Notebook の前提（1 recipe = 1 identity）を崩す / C: signature 観測 + matcher 対応 + 工程が同 slice に必要で大きい / D: 将来の pan / 形系を捨てる |
| Production27 | **A / D が既存 3 recipe を保護**。何もしない選択はリスク |
| 53-scale | 6 recipe（bufalina / chicago / detroit / ny / greek / stuffed-crust）が対象。うち bufalina は既に rejected |
| 172-scale | matrix の identity 衝突（ledger 5 + extended 11）にも同じ規則が効く |
| save / schema | なし |
| Cooking Steps | C は pan / shape / late 等の工程と一体（OD-P10）。A は工程を待つだけ |
| Discovery / Contract 2.1 | AMBIGUOUS は「全 ○ でも発見されない」永久ループを生む（INV-D3 / D5 で原因を区別できない） |
| **推奨** | **A** |
| 理由 | 回帰を確実に防げて追加実装が要らない。dimension 導入は Cooking Steps 側の決定に従属させられる |
| 時期 | **今決める**（規則 + 将来の gate テスト項目として） |

## OD-P6 #378（在庫 0 の Research Entry）と拡張の順序

| 項目 | 内容 |
|---|---|
| 既決 | **OD-378-1〜6**（上記）。方針・案 1 採用・save 変更なしは**再決定しない** |
| 何を決めるか | 残るのは**順序のみ**: 拡張 slice を #378 案 1 の実装（と OD-378-6 の Audit）より前に出してよいか |
| なぜ今 | 拡張は #378 を薄めず増幅する（全材料 refill 1,150 → Slice 1 で +50（T3）、全体で 1,520〜3,210 Pitz、単一 chokepoint は source 衝突なし母集団で 30 / 30 step）。OD-378 の Gate（#376 完了）は main で満たされている |
| A | #378 案 1 を **Slice 1 の前**に完了する |
| B | 並行（Slice 1 の設計・実装は進め、リリース順で調整） |
| C | Slice 1 を先に出し #378 は後 |
| メリット | A: step 増加ごとの stall 点が増える前に案内がある / B: 待ち時間なし / C: 拡張が早い |
| デメリット | A: Slice 1 が #378 とその Audit（OD-378-6）に依存 / B: 順序管理が要る / C: 在庫 0 状態が 1 箇所増える（No.10 puttanesca の再発が増える） |
| Production27 | #378 実装は Production の既存状態を直す。Slice 1 自体は無関係 |
| 53-scale | 各 step が単一 pool のままだと、拡張するほど stall 点が増える |
| 172-scale | 材料 105 規模では refill-all が桁違いになる（案 1 の UI が前提） |
| save / schema | なし（OD-378-5） |
| Cooking Steps | なし |
| Discovery / Contract 2.1 | OD-378-3 により在庫切れ中は ○× を出さない（Contract 2.1 の対象外のまま） |
| **推奨** | **A**（設計は並行可、リリースは #378 案 1 の後） |
| 理由 | 既決の案 1 を前提にすれば Slice 1 の追加リスクが最小。#378 は Owner 実機で再現した現行の問題 |
| 時期 | **順序のみ今**（#378 の中身は決定済み） |

## OD-P7 Research Entry 匿名ラベルの 10 件超

| 項目 | 内容 |
|---|---|
| 何を決めるか | ① 〜 ⑩ を超えた時の表示 |
| なぜ今 | 現行コードは 11 件目から数字にフォールバック（「？？？ピザ 11」）。**決定の記録は無い**。最小発見経路の最大同時 Entry は Production 1 / 現 engine ready 2 / source 衝突なし 1 / 全 union では 11〜13 |
| A | 数字フォールバックのまま許容 |
| B | 丸数字を ⑪〜⑳ に拡張 |
| C | 表示件数を上限化（超過分を隠す） |
| D | 別の匿名記号（色 / 文字） |
| メリット | A: 変更なし / B: 見た目が揃う、実装が小さい / C: 一覧が短い / D: 20 超も可能 |
| デメリット | A: 見た目の不統一・Notebook の label が 1 字長くなる / B: 21 件目が再び問題、端末のフォント依存 / C: **件数・存在の漏洩（Anti-Oracle）と「隠れた entry」問題** / D: 設計コスト大 |
| Production27 | 影響なし（最大 1） |
| 53-scale | 現 engine ready 範囲では不要。10 件超は ship 母集団が大きくなってから |
| 172-scale | 必須（10 件超は常態化） |
| save / schema | なし。ただし label は記録時の文字列を Notebook に保存（再計算しない）ので、**変更後も旧記録は旧表示のまま** |
| Cooking Steps | なし |
| Discovery / Contract 2.1 | Notebook ≤ 200 字（65 材料の最悪 173 字、数字ラベルで +1）。C は隠蔽ゆえ不可に近い |
| **推奨** | **今は A のまま、母集団が拡大する前に B を再確認** |
| 理由 | 現母集団・推奨 slice では発生しない。C は oracle リスク |
| 時期 | **後回し可** |

## OD-P8 Chapter / ladder 拡張

| 項目 | 内容 |
|---|---|
| 既決 | append-only ladder、tier 帯、chapter = key step の tier（OD-W2-1 / REC04-3 / DISC-9）。**第 4 章（step 30〜）の出現は規則どおり** |
| 何を決めるか | (a) 新 recipe の `ladderCredit` の既定、(b) **新材料を要さない recipe**（例 `boscaiola`）の扱い、(c) T4 / 第 4 章の初使用の検証 gate |
| なぜ今 | (b) は ladder 凍結 step の pool を変える。`boscaiola` 1 件で step 8〜25 の pool が 1 → 2 になり、既存 save に突然 Research Entry が現れ Hint が OPEN_POOL に切り替わる（Audit §5.3）。(a) は進行速度を変える |
| (b) A | 通常 recipe として許可（credit 付与） |
| (b) B | 許可するが `ladderCredit:false` / `lunchRush:false`（calabresa 方式） |
| (b) C | **各 slice は新材料を 1 つ以上導入する recipe のみ**。材料を要さない recipe は後の wave |
| (a) 既定 | credit 付与（No.27 前例）/ 付与しない |
| メリット | A: 件数が稼げる / B: ladder・pool を動かさない / C: 凍結 step の挙動が完全に不変、各 slice が ladder step と対応して検証しやすい |
| デメリット | A: 既存 save の surprise、凍結 step の意味が変わる / B: Dex 進行に寄与しない recipe が増える / C: 材料を要さない recipe の ship が遅れる |
| Production27 | A は既存 save に影響（新 Entry の出現）。B / C は不変 |
| 53-scale | 材料を要さない recipe は現 engine ready では `boscaiola` のみ（かつ source 衝突あり） |
| 172-scale | 材料を要さない recipe が多数（pool が早期に 2 以上）。方針が先にないと進行が崩れる |
| save / schema | なし（entitlement ledger は union。再 lock なし） |
| Cooking Steps | なし |
| Discovery / Contract 2.1 | pool ≥ 2 では Hint の自動 target が外れ、HOME の「レシピ発見」は Dex の匿名カード選択（#373）に分岐 |
| **推奨** | **(b) = C**、**(a) = 付与（No.27 前例）**、**(c) = step 30 到達前に T4 価格 / 第 4 章 UI を検証**（Slice 1 は step 26 なので対象外） |
| 理由 | 凍結 step を動かさずに済み、既決の append-only の趣旨に沿う |
| 時期 | **(b) は今**（slice の定義に関わる）。(c) は後回し可 |

## OD-P9 first vertical slice

| 項目 | 内容 |
|---|---|
| 何を決めるか | 最初の拡張 slice の recipe |
| なぜ今 | 実装着手の入口。OD-P2（composition authority）に依存 |
| A | `ai-carciofi` + `artichoke`（catalog class B、`game_design_candidate`。**PIZZA DB 行なし**、step 26） |
| B | `pesto-gamberi` + `shrimp`（172 matrix `pesto-gamberi-pizzadb-p11`: **FULL / READY、blocker なし**、構成 `pesto` `fresh-tomato` `garlic` `shrimp`、新材料は shrimp のみ = 魚介・OD-T1 確定、生地 standard・round で CUT 検討可、step 26。**53 catalog の外**） |
| C | `quattro-stagioni`（PIZZA DB と構成一致、zone 工程が必要） |
| D | `bbq-chicken`（FINISH + 新 sauce が必要） |
| メリット | A: 53 内・衝突なし・新規 1 / B: **No.27 と同格の source 権威**、capability 不要、role / alias 問題なし、チーズなしで hint rung が単純 / C: 新 Cooking Step を検証でき `artichoke` を後続と共有 / D: 唯一 PIZZA DB が READY の後乗せ |
| デメリット | A: source なし（OD-P2 の承認が要る）/ B: 53 の範囲外（OD-P1 を D 寄りに）/ C: zone の観測規則 + matcher 対応 + 採点が未設計 / D: TQ-2・FINISH・OD-P4 に依存、Dinner の identity 問題 |
| Production27 | A / B とも既存 27 は不変（step 26 追加のみ、既存 save が 26 credited なら次の resolve で entitled） |
| 53-scale | A は 53 内。B は 53 の外だが規則上 Production に追加される recipe として数える |
| 172-scale | B は 172 の source を使う前例になる。A は catalog-only の前例 |
| save / schema | 追加 id のみ（whitelist は RECIPES / INGREDIENTS 由来、未知 id は保持）。schemaVersion 2 のまま |
| Cooking Steps | A / B は新工程なし。C は zone、D は FINISH が最初の検証 |
| Discovery / Contract 2.1 | A / B とも標準 panel の範囲（既存 sauce、衝突なし、新規具材 1）。Slice 1 の検証項目: pool、Entry 番号、Hint、○×、Notebook |
| **推奨** | **B**（Audit では A を推したが、OD-P2 が未決の今は source 権威が確かな B を第一候補とする。OD-P1 = C/D と OD-P2 = D に整合）。OD-P2 で catalog-only を承認するなら A が代替 |
| 理由 | No.27 の方式（source 権威）の再現で、新規 Decision（composition 規則）を slice に持ち込まずに済む |
| 時期 | **今決める**（OD-P1 / P2 / P8-b と同時） |

## OD-P10 Cooking Steps 導入順

| 項目 | 内容 |
|---|---|
| 既決 | 技法分類と順序（no-sauce = TQ-1D → 後乗せ = TQ-2 → 複数 spread = TQ-3、OD-TQ-2）。**これは再決定しない** |
| 何を決めるか | (a) 内容 slice と工程 track の並走可否、(b) 技法に属さない engine 項目（zone / pan・形 / 折り・包み / ring / split）の順序、(c) PR #295（未 merge の設計）の採否、(d) Expansion Gate A（no-sauce / RESERVED の panel）の時期 |
| なぜ今 | 工程を要する recipe は新規 28 件。順序が無いと「53 は全 track 完了点」のまま着手点が決まらない。ただし推奨 slice は工程不要 |
| A | OD-TQ-2 の順に進め、**標準工程の内容 slice は並走** |
| B | zone（SMALL_ENGINE）を最初の新工程として前倒し |
| C | #295 の CS-1（post-bake seam、inert）を先に入れて後乗せの足場を作る |
| D | 工程系は 53 完了まで全停止 |
| メリット | A: 既決に沿い内容が止まらない / B: 技法に依存せず小さく検証できる / C: TQ-2 と CUT 採点の共通前提 / D: 単純 |
| デメリット | A: 工程系の recipe は後になる / B: zone の観測規則・matcher 対応・採点が必要（未設計）/ C: 見える変化がなく、#295 は未 merge で OD-R6（Dinner の identity）が残る / D: 内容が止まる |
| Production27 | 影響なし（工程は recipe 単位の opt-in。CUT 同様 allowlist 方式） |
| 53-scale | 工程系 28 件（後乗せ 15 が最大）が対象。engine ready は 9 件 |
| 172-scale | matrix では 現 engine 15 / data-only 59 / small 19 / major 30 / authority gap 49（#295 の分類。未 merge・参考値） |
| save / schema | `GameState` は永続化されない。工程追加で save への影響は id 追加程度の見込み（各 slice で再監査） |
| Cooking Steps | 本 Decision そのもの |
| Discovery / Contract 2.1 | late / pan / shape 等は identity dimension の観測と matcher 対応が同時に要る（matcher 規則 2）。no-sauce は Gate A が先 |
| **推奨** | **A**（OD-TQ-2 順 + 内容 slice 並走）。#295 の採否だけ Slice 1 の後で判断 |
| 理由 | 既決の順序を尊重し、推奨 slice は工程に依存しない |
| 時期 | **後回し可**（#295 の採否のみ早めに） |

---

## 付録: Owner が今決めると進める項目

必要最小: **OD-P1**（C）・**OD-P2 の原則**（D）・**OD-P4 の除外原則**（C）・**OD-P5**（A）・**OD-P6 の順序**（A）・**OD-P8(b)**（C）・**OD-P9**（B または A）。
後回し可: OD-P3 / P7 / P10、OD-P2 の 18 件個別、OD-P4 の role 最終形、元 S11（alias）・S12（Dinner tray）。

runtime 実装は開始していない。READY FOR 53 IMPLEMENTATION: NO は維持。
