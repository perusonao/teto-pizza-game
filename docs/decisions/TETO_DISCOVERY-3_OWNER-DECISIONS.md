# Discovery 3.0 — Owner Decisions（S0）

- **状態:** Owner 採用済み（Discovery 3.0 Fresh Audit のレビュー後）。この文書は決定の記録であり、実装ではない。
- **根拠:** `docs/reports/TETO_DISCOVERY-3_FRESH-AUDIT.md`（audited main `5c8190f`）、`docs/reports/data/TETO_DISCOVERY-3_FRESH-AUDIT_DATA.json`。
- **書式:** 各決定は「決定 → 含意 → S1 への持ち越し」。ID は audit の OD-D3-n と同じ。**採用していない番号（4 / 9 / 11〜14）は未決**（末尾の表）。
- **production への影響:** ここに書かれたことは、どれも現時点で production の挙動を変えない。Hint 5.0（production ON）と near-miss は S1 の評価が終わるまで現状のまま。

## OD-D3-1 Hint structure — 固定 6 段階を authority にしない

**決定.** ヒントは固定の段階（SAUCE → CHEESE → KEY → STRUCTURE → SUB）を authority にしない。レシピの構造に応じて、適用できるヒントを構成する。候補は次のとおり。

- sauce / base
- cheese
- ingredient count（材料数）
- ingredient family / category の構成
- cooking / technique の情報（**実装済みの authority がある場合のみ**）

存在しない要素（無ソース、チーズなし等）を、無理にヒントの段として出さない。ただし最終 UI は固定しない。線形 ladder か、メニュー式かは、**情報量 simulation と UI audit の後**に決める。

**含意.**
- 「なし」を有料の回答として出す Hint 5.0 の P4-CHEESE / P4b（cheese なし、key なし）は、この決定と向きが違う。Hint 5.0 の扱いは S1 の migration 評価で決める（production は変えない）。
- technique の情報は、production レシピで technique を要求するものが 0 件の間は出さない（TQ-1C は inert、TQ-1D が前提）。

**S1 へ.** 「適用可能なヒント」をレシピ構造から導く規則の候補を、25 レシピ全件で列挙する（どのヒントが適用可能か、存在しない要素は何か）。UI は決めない。

## OD-D3-2 Key topping — Discovery Hint authority から廃止する方向

**決定.** 「key-topping / キートッピング」を Discovery Hint の authority から廃止する方向で進める。レシピ固有の「主役食材」を人手で指定する方式を、新しい Discovery 設計の前提にしない。

**含意.** 現在の production は `RECIPE_HINT_ROLES.hintKeyToppingId`（25 件）と、購入済みの `h5:key` / `ing:` facts を持つ。これは**この決定で直ちには消えない**。廃止は migration を伴う。

**S1 へ.** 既存 production Hint 5.0 への migration impact を明示する（S1 項目 G）。少なくとも次を列挙する: `RECIPE_HINT_ROLES` と `hint5Ladder` の依存、save に保存済みの facts（`ing:` / `h5:*` / `cls:`）の扱い、購入済みヒントの価値（Pitz）の扱い、`hint5Taxonomy.gate.test.ts` などの gate、Dex / HintSheet の表示。

## OD-D3-3 Giveaway — hard invariant にしない、計測で判定する

**決定.** ヒントの目的は答えの直接開示ではなく、プレイヤーが次の試作を考えられる情報を与えること。「全ヒント後に必ず candidate ≥ 2」は、現時点では **hard invariant にしない**。代わりに、各レシピ・各ヒント段階の candidate reduction を計測し、次の 3 つを判定できるようにする。

- direct answer になる
- 推理余地が適切
- 広すぎて役に立たない

direct answer になるレシピは、S1 で**個別に列挙**する。

**現時点の参考（audit の測定値。判定基準ではない）.** プレイヤー視点の組合せ数 R（各レシピの自分の key step の owned 集合、全ヒント後）:

| ヒント構成 | R = 1（direct answer） |
|---|---|
| 現行 Hint 5.0 の全 rung（key 名指しを含む） | 12 件: bismarck, breakfast-pizza, funghi, genovese, margherita, meat-lovers, melanzane-pizza, parmigiana-pizza, pepperoni, pizza-bianca, quattro-formaggi, salsiccia |
| sauce + cheese + 種類数 + family 構成（key なし） | 6 件: bismarck, breakfast-pizza, funghi, margherita, meat-lovers, quattro-formaggi |

「広すぎる」側の閾値（R の上限）はまだ決めていない。S1 が分布を出し、Owner が閾値を決める（未決 OD-D3-15）。

## OD-D3-5 W1 ladder — 互換性の境界として維持

**決定.** 既存 25 レシピ / 24 step の W1 ladder は**互換性の境界**として維持する。Branching Discovery を作るために W1 ladder を再設計しない。branching は **post-W1 のレシピ追加**で導入する。ただし、**追加の発見によって「発見数ベースの ladder」が早く進む問題は、実装前に必ず解決する**。

**含意.**
- ladder は「発見数 ≥ step」で進む（`discoveredRecipeCount` = Dex の発見済み件数）。W1 の 25 件は、24 step ですべて解放される。post-W1 レシピの発見が件数に入ると、W1 の step が早く進み、W1 の経済（Pitz・在庫・Shop の解放順）が変わる。
- audit の測定: reuse-only 3 件を足すと、全部発見するプレイヤーは 25 round → 17 round で終わる（`greedy_pace_*`）。brazilian-calabresa 1 件だけでも、step 12 以降 1 step 早く進む。

**S1 へ.** 解決策の候補を比較し、Owner に選ばせる材料を揃える（S1 項目 D）。候補: (a) ladder の件数に post-W1 レシピを数えない、(b) W1 の 25 件のみを数える別の指標を置く、(c) 早く進むことを許容して経済を再調整、(d) その他。**S2 はこの解決の後でなければ実装しない。**

## OD-D3-6 Pool size — 最初の branching 実証は「同時に探索可能な未知 = 2」

**決定.** 最初の branching 実証は、同時に探索可能な unknown recipe = 2 から始める。2〜4 は将来の tuning 候補であり、現時点の spec ではない。

**含意.** brazilian-calabresa（onion の解放で pizza-portuguesa と同時に開く）は pool = 2 を作る。pool の上限（3 以上）は今は決めない。

## OD-D3-7 Attempt Feedback — Mastermind 型を採用しない

**決定.** 正解材料の一致数、正確な distance、その他 Mastermind 型の定量フィードバックは**採用しない**。Attempt Feedback は、「次に何を試すか考えられるが、総当たり solver にはなりにくい」情報に限る。既存の near/far は production の互換として残し、**S1 で漏洩量を再評価する**。新設計の中心概念にはしない。

**含意.**
- 不採用: `B`（一致数）と `A2`（正確な距離）。audit の測定では、探索空間によらず約 10 回で当たる。
- near/far（`A`）は、採否を S1 の評価後に決める。現状のまま production で稼働する。

**S1 へ.** near/far の漏洩量の再評価（audit の `feedback_sim` を、最新の設計の前提で再実行し、閾値を置く）。「総当たり solver になりにくい」の定量的な定義（例: 探索空間 N に対する平均試行回数の下限）は S1 で Owner に提案する（未決 OD-D3-16）。

## OD-D3-8 「あと少し」 — browser で再現してから authority にする

**決定.** 「図鑑のピザまであと少し」は、無料の正誤 oracle になる可能性がある。authority として維持する前に、**browser reproduction test** を行う。意図的にソースの量などだけを落としたとき、ingredient identity の正誤判定として使えるかを確認する。再現した場合は、文言の変更だけでなく、**trigger 条件そのものを Discovery 3.0 で再設計する**。

**現状（コード読み）.** `resolveFreeCookPizza` は、材料集合が一致して Completion Gate（量・ソース量・焼き）に落ちたとき `INCOMPLETE_MATCH` を返し、`originalResultCopy.ts` が専用の文言を出す。ソース量の閾値（`SAUCE_MIN_RATIO`）は `completionGate.ts` にある。ブラウザでの再現は**まだしていない**。

**S1 へ.** browser reproduction test（実ポインタ操作、390×844 と 360×800）。合格条件は S1 項目 I。

## OD-D3-10 Unknown Recipe Target — FREE Cooking では事前選択させない

**決定.**
- FREE Cooking では unknown target を事前に選択させない。自由に pizza を作り、matcher が自動 Discovery する現在の基本方式を維持する（audit の案 B）。
- Hint / Notebook / Dex では、「？？？」の discovery target を選択可能にしてよい。
- recipe name や candidate recipe list を、調理前に表示して multiple-choice 化しない。

**含意.** Dex の「？？？」が hint target を pin する現行の仕組みは、この決定と整合する。Notebook の整合表示（取得済みヒントとの照合）は、選択された target のヒントに対して計算する。

## Trial Notebook の方向

**決定.** Trial Notebook は「失敗履歴一覧」ではなく **Discovery experiment notebook** として設計する。

- 優先する情報: 自分が試した構成、前回試作との差分、取得済みヒントとの整合、retry count、attempt order。
- Notebook は**新しい hidden recipe fact を独自に生成しない**。
- near/far の文言をそのまま永久保存することを、新しい authority にしない。

**含意.** 現在の Notebook は、P2 の表示文言（`kind` + `textJa`）をそのまま保存する（session-only）。永続化（P3-2）をする前に、この保存方針を変える必要がある。差分表示と整合表示は、プレイヤー自身の試作と所有済みヒントだけの関数なので、新しい漏洩を生まない（audit §5.2）。

## First branching validation — brazilian-calabresa

**決定.** brazilian-calabresa を、最初の reuse-only branching validation candidate として扱う。**まだ production に追加しない。**

**S1 で最低限確認する.**
1. authoritative recipe data との一致
2. 既存食材の再利用だけで成立すること
3. onion 解放時の pool = 2 の再現
4. discovery-count ladder の加速
5. Hint candidate reduction
6. Notebook の挙動
7. matcher の collision
8. economy / inventory への影響

S2（実際の追加）の blocker は `docs/reports/TETO_DISCOVERY-3_S0_SSOT-UPDATE-PROPOSAL.md` §5。

## Roadmap SSOT の決定

- `docs/ROADMAP.md` を「現在の優先順位・active lane・next slice」の canonical SSOT として新設する。
- 役割分担: `docs/ROADMAP.md` = 現在地 / priority / next / paused lane、`PROJECT_HANDOFF.md` = architecture / operational handoff / historical context、Issue #22 = GitHub 上の短い roadmap index、個別 Issue = 各 slice の requirements / acceptance、reports = audit / evidence / historical decision record。
- 同じ priority roadmap を複数ファイルへ全文コピーしない。
- Canonical priority は `docs/ROADMAP.md` に記載。CUT-S2 は frozen。standalone CUT score を product goal にしない（将来は pizza total score の quality component）。PR #321 と Large Catalog の既存 open PR は独立 gate lane。

## 未決の Owner Decision

| ID | 内容 | 状態 |
|---|---|---|
| OD-D3-4 | 「なし」の情報に対する価格の扱い | 未決（OD-D3-1 の UI が決まった後） |
| OD-D3-9 | Notebook の一覧 UI の場所、永続化、何を出すか | 方向のみ決定（上記）。場所と永続化は未決 |
| OD-D3-11 | pack DV-1 の採否、新食材（honey / bell-pepper / zucchini）、naming cluster | brazilian-calabresa の位置づけのみ決定。ほかは未決 |
| OD-D3-12 | TQ-1D（no-sauce）の時期 | 未決 |
| OD-D3-13 | Large Catalog の hand capacity（9 / 12） | 未決（R6 の Human Feel 待ち） |
| OD-D3-14 | ヒント価格の再設計 | 未決（OD-D3-1 の後） |
| **OD-D3-15（新）** | direct answer / 適切 / 広すぎる の判定閾値（R の値） | 未決。S1 が分布を出す |
| **OD-D3-16（新）** | 「総当たり solver になりにくい」の定量的な定義 | 未決。S1 が提案を出す |
| **OD-D3-17（新）** | ladder 加速の解決方式（OD-D3-5 の (a)〜(d)） | 未決。**S2 の前提** |
| **OD-D3-18（新）** | brazilian-calabresa の id / 表示名（naming cluster NC-4 の review、`calabrese` との混同） | 未決。**S2 の前提** |

## S1 outcome addendum (2026-10-01) — 新しく生じた未決

S1（`docs/reports/TETO_DISCOVERY-3_S1_Measurement-Migration-Gate_Result.md`）の結果、次が Owner 判断として加わった。**いずれも確定していない。**

| ID | 内容 | 選択肢 |
|---|---|---|
| OD-D3-19 | Hint 5.0 の migration（key-topping の廃止の進め方） | A compatibility / B authority / C key を optional にして橋渡し（結果 §8） |
| OD-D3-20 | 「あと少し」の trigger（oracle は再現した） | T1〜T5（結果 §10.4） |
| OD-D3-17 | ladder 加速の解決方式（S2 の前提） | O1〜O5（結果 §5）。推奨は O3 |
| OD-D3-18 | brazilian-calabresa の id / 表示名、「オリーブ」の扱い | 結果 §16 |
| OD-D3-2 の範囲 | 「キートッピング」= Hint 5.0 の `hintKeyToppingId` だけか、Hint 3.0 由来の `hintKeyIngredientId`（最後に解放された食材。near-miss の「新しい材料は使ってみた？」が使う）も含むか | 要確認（結果 §8.1） |
