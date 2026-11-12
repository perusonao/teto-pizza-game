# MID_BAKE — Owner 設計判断表（段階 A）

Issue: #795（M4 = mid_bake、U2 の一部）／ Refs #780 #696 #749 #784 #604 #611
作成: 2026-11-12 ／ 基準 `main` `4314ca2`（PR #826 merge 済み）
性質: **docs-only の判断表。実装・PR の merge・Production ON・共有 Preview 更新はしない。Owner 承認待ち。**
claim: Issue #795 コメント 6823482737（本ファイルのみ）

本書は §8（Session Operations）に従い、Owner への質問を 1 か所にまとめ、各項目に推奨を付ける。
**事実**（リポジトリで確認したもの）と**推奨・案**（私の提案）と**未確認**を分けて書く。
未確認のものは推測で決めず、Owner 判断または別調査に回す。

---

## 0. Owner 判断が必要な項目（まとめ）

| ID | 判断 | 推奨 | 本文 |
|---|---|---|---|
| Q1 | BAKE 約 3 秒と時間窓 `[0.65, 0.90)` の整合（一時停止／減速／専用フェーズ／実時間のまま） | **窓の入口で針を止める「止めて足す」（案 P）**。上限タイムアウトで自動再開 | §2 D1 |
| Q2 | 窓の意味（窓に入ったら進行が止まる／窓は時間のまま） | 窓内の ADD は止まっている間だけ受け付ける（エンジンは変更不要） | §2 D1 |
| Q3 | 追加操作の主操作（タップ／ドラッグ／代替操作） | **タップで 1 個ずつ追加**。ドラッグは任意・代替操作は常に同じ `ADD` | §2 D3 |
| Q4 | 追加個数の扱い（必須個数で打ち止め／超過許可） | 必須個数で打ち止め（現エンジンの契約どおり） | §2 D2 |
| Q5 | 事前準備（BAKE 前にどこへ用意するか） | PREPARE で「焼成中に加える」分を別枠で選ぶ（ピザ上には置かない） | §2 D2 |
| Q6 | 食材ごとの置き方 | 自動配置（決定的）を基本。山椒だけ「ふりかけ」タップ | §2 D4 |
| Q7 | eel／okra／sansho-pepper が本当に mid_bake か（原典未確認） | **原典確認が済むまで POST_BAKE 近似のまま**。仕組みは natto／french-fries で先に検証 | §3 |
| Q8 | lomo-saltado の依存（PREP か FRY か両方か） | 初期リリースから外し、PREP／FRY の統合後に最後に適用 | §3・D5 |
| Q9 | 在庫の消費タイミング | 追加時に「予約」、CONFIRM_BAKE で確定、BAKE 離脱で戻す | §2 D6 |
| Q10 | 対象モード（Guided／Free／Lunch Rush／Dinner） | 初期は Guided と Free Cooking のみ（FINISH と同じ扱い） | §2 D6 |
| Q11 | 採点（追加の巧拙を採点するか／取り逃しの結果） | 初期は追加タイミングを採点しない。取り逃しは「必須食材が揃わない」として既存の判定に任せる | §2 D7 |
| Q12 | Research／Hint の扱い | Hint は「焼成中に加える」ことだけ示す。Research は late 軸と同じ扱い（要調査） | §2 D8 |
| Q13 | 実装順序（Lab 先行か、いきなり Reducer か） | **独立 Lab（Preview/DEV 限定）を先に作り、HV の後で Reducer 接続** | §5 |
| Q14 | iPhone HV の合格基準 | §4 の案（3 ラウンド＋成功率の基準）を Owner が確定 | §4 |

---

## 1. 確認済みの事実

出典はすべて `main` `4314ca2`。

### 1.1 BAKE の時間特性

- `BAKE_DURATION_S = 3`（`src/logic/bakeProgress.ts`）。針は 0→100 を**一方向・線形**に動き、100 で止まる。
  コメントに「10s・7s・5s はどれも長く感じた。3s が現在の候補」とあり、**暫定値で Owner の iPhone HV が決める**。
- 1 フレームが進められる時間は最大 `BAKE_MAX_FRAME_DT_S = 0.1` 秒（バックグラウンド復帰で一気に焦げるのを防ぐ）。
  したがって **BAKE の時計は壁時計と一致しない**。
- 目標ゾーンの表示は 0.6 秒から薄れ始め 1.2 秒で消える（`BAKE_ZONE_FADE_START_S`／`END_S`）。コメントによると、どのレシピの取り出し窓の開始（45 以上）よりも前に消える。
- レシピごとの取り出し目標 `bakeTarget` は幅 20pt。例: 60–80、45–65、65–85、50–70、55–75、58–78（`src/data/recipes.ts`）。
- 採点は `classifyBake` / Scoring 2.0 が 0..100 の取り出し位置を受け取る。時計は FREE／Lunch Rush／Dinner 共通。

### 1.2 時間窓との関係（計算）

窓 `[0.65, 0.90)` は BAKE ゲージの 65〜90 に当たる。

| 項目 | 値 |
|---|---|
| 窓の開始 | 3 s × 0.65 = **1.95 s** |
| 窓の終了（含まない） | 3 s × 0.90 = **2.70 s** |
| 窓の実時間 | **0.75 s**（60fps で約 45 フレーム） |
| 取り出し目標との重なり | 上の例 6 件のうち 5 件の取り出し目標が窓（65〜90）と重なる（60–80、65–85、50–70、55–75、58–78）→ **取り出しタップと追加が同じ親指・同じ時間帯で競合しうる** |

この 0.75 秒に「食材を選ぶ→置く」を 1〜2 回入れるのは、指の精度・補助技術のどちらの面でも厳しい。**これが本件の核心。**

### 1.3 実装済みエンジン（PR #826）

- `src/logic/midBake/`: 純粋ロジック。`idle → baking(before-window → window-open → rebaking) → finished`。
- 窓は終端を含まない。必須個数で打ち止め。未知・早い・遅い・超過・状態違いの ADD は no-op。
  stale／非有限時刻の ADD も完全な no-op（`now === lastAt` は有効）。
- 直接操作と代替操作は同じ `ADD`。入力元は監査用のみで結果を変えない。
- `requiredState` で「`french-fries` は fried で到着」を FRY を import せず表現。
- 完了は `complete` または `missing-additions`。採点・レシピ同一性には触れない。
- `MID_BAKE_EXPERIENCE_PRODUCTION = false`、未配線。
- 時計は注入式。**統合時に渡す `now` は壁時計ではなく BAKE の時計（`BakeOverlay` が積算する経過秒）にする必要がある**（§1.1 のフレーム上限のため）。

### 1.4 対象レシピ（staged データ）

| レシピ | 必須食材（minCount） | staged の mechanics | late の扱い（matrix） | 未決事項（`rejudge.json`） |
|---|---|---|---|---|
| `eel-pizza` | eel 2・green-onion 2・mozzarella 3・sansho-pepper 2 | `MID_BAKE` | `unresolved:mid_bake\|post_bake`（eel のみ） | R-1 ソース未指定。**R-6 提案「eel → POST_BAKE（出荷済み）」が既にある** |
| `natto-pizza` | green-onion 2・mozzarella 3・natto 2・nori 2・okra 2 | `MID_BAKE` | `mid_bake`（natto のみ） | R-1 ソース未指定、`WAITS_MECHANIC:MID_BAKE` |
| `pizza-de-lomo-saltado` | beef 2・french-fries 2・fresh-tomato 2・mozzarella 3・onion 2 | `MID_BAKE`＋`PREP` | `mid_bake`（french-fries のみ） | R-1、R-4（Jaccard 例外）、`WAITS_MECHANIC:MID_BAKE`・`PREP`、重複ゲート |

食材 4 件（eel・natto・okra・sansho-pepper）はすべて `placement: "scatter"`・`category: "topping"`（`stagedIngredients.ts`）。french-fries は `COMPOSITE`・scatter。

**確認できたずれ（Owner 判断の材料）**
1. **okra と sansho-pepper は、どのレシピの late 指定にも載っていない。** #795 本文は mid_bake としているが、リポジトリ内に根拠は見つからなかった。
2. **eel は「mid_bake か post_bake か未決」。** 既存規則 R-6 は「未決なら出荷済みの post_bake、新機構は作らない」。
3. **lomo-saltado の staged 上のタグは `MID_BAKE`＋`PREP`。** #795 本文・エンジン README は「french-fries は FRY が fried にして渡す」。監査文書（Fresh Audit）は「牛と野菜を先に炒める（＋ポテトは mid_bake）」で、PREP は牛・野菜側。**FRY が必要かはタグから読み取れない。**
4. 先例: `mentaiko-cream`（たらこ）は mid_bake を **POST_BAKE で近似**して出荷済み（`lateCatalog.ts` のコメント、Owner 決定 2026-10-28、暫定仕様）。

### 1.5 PREP／FRY の状態

- PREP: 1B 実装・merge 済み（PR #697）。`PREP_EXPERIENCE_PRODUCTION = false`。
- FRY: F1 純粋ロジック＋Lab（claim #749）。F2（reducer）は **HOLD**。`FRY_EXPERIENCE_PRODUCTION = false`。
- どちらも「Production 固定 OFF ＋ Preview/DEV のクエリ opt-in」の 1 ゲート構造。MID_BAKE の Gate はまだ opt-in を持たない（固定 false のみ）。

### 1.6 Reducer・保存・在庫（読み取りのみ）

- `GamePhase`: `ORDER → PREPARE → BAKE → POST_BAKE → RESULT → DISCOVERED`。POST_BAKE は CUT／FINISH だけを持ち、post-BAKE ステップが無いレシピは `CONFIRM_BAKE` が直接 RESULT へ進む。
- 在庫: `inventory`（`canPlaceIngredient`／`canPlacePostBakeIngredient`）。Lunch Rush は `unservedConsumption` で「焼成が取った在庫」を提供まで保持。
- 保存: `pendingRound` は **`CONFIRM_BAKE` で post-BAKE ステップが残る場合にだけ**作られる。Lunch Rush・Dinner は持たない。
- FINISH 先例: Lunch Rush／Dinner は FINISH に到達しない。
- 全 scatter 食材のトレイドラッグ統一は #478（Draft、HOLD 扱い）で進行中。

### 1.7 未確認（推測で決めない）

- BAKE 中にアプリを離脱・再読み込みした場合の保存挙動（`bakeState` は transient という記述のみ確認。BAKE 中の保存の実挙動は Fresh Audit が必要）。
- eel・natto・okra・山椒のアイコン・見た目の在庫（B28 の ICON 状況）。
- Research（`researchAttempt`）が late 軸と staged レシピをどう扱うかの細部、Hint（`finishHint.ts`）の mid_bake 対応余地。
- VoiceOver／外付けキーボードでの BAKE 画面の現状到達性。
- okra・sansho-pepper の原典上のタイミング。§8.2 に従い、原典確認は担当セッションが先に行い、取得不能なら ChatGPT 側の調査に回す。

---

## 2. 論点別の判断表

### D1. BAKE 約 3 秒と時間窓の整合（Q1・Q2）

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| **P（推奨）止めて足す** | 針が 0.65 に達したら**針を止め**、追加が済む／「とじる」／上限時間で再開。総 BAKE 時間（能動時間）は 3 秒のまま | 指・補助技術に十分な時間。#784 の代替操作が成立。針は一方向のまま（#419 の不変条件を保つ）。エンジンは変更不要（時計が止まれば `now` は不変で、`now === lastAt` の ADD は有効） | 「針が止まる」体験は新規。HV で違和感を確認する必要。上限タイムアウトの長さが新しい調整値になる |
| R 減速 | 窓内だけ針を `f` 倍速にする（`f=0.5` なら窓 1.5 秒・総 3.75 秒、`f=0.25` なら窓 3.0 秒・総 5.25 秒） | 針が動き続けるので BAKE の手触りに近い | 総時間が延びる。**既存の HV 所見（5〜10 秒は長い）に反するリスク**。`f=0.5` でも 1.5 秒で足りるかは未検証 |
| S 専用フェーズ | BAKE を中断し、POST_BAKE の FINISH に似た専用画面で追加→再開 | 操作面を完全に分離でき UI が素直 | 画面・Reducer の変更が最大。焼成中という感覚が弱まる。HOT 競合が最大 |
| T 実時間のまま | 窓 0.75 秒のまま、タップだけで足す | 実装が最小。BAKE を一切変えない | 親指が取り出しタップと競合。代替操作・VoiceOver で成立しにくい。失敗率が高いと予想（HV で測らないと不明） |
| U 窓を広げる | 例 `[0.40, 0.90)` | 実装が小さい | 取り出し目標（45〜85）との重なりが増え競合が悪化。窓の意味が崩れる |

**推奨: P。** 理由: 窓 0.75 秒の問題を解決しつつ、総 BAKE 時間と針の一方向性を変えない。R は総時間が延びるため第二候補。

**サブ判断（Q2）**: 止めた後に再開した時点でも窓 `[0.65, 0.90)` は残る（エンジンは 0.90 まで ADD を受ける）。**推奨は「UI は止まっている間だけ追加を提示する」**。エンジンの窓判定は安全網として残す。
**Owner 判断が必要**: 案の選択、上限タイムアウト（案: 6 秒）、止めている間の取り出しボタンの扱い（案: 誤タップ防止のため無効化）。

### D2. 事前準備と追加個数（Q4・Q5）

- 事実: 追加は必須個数で打ち止め（超過は no-op）。例: natto 2・okra 2・eel 2・sansho 2・french-fries 2。
- **推奨（準備）**: PREPARE の TOPPING で「焼成中に加える」食材を**別枠**で選ぶ。ピザ上には置かない。BAKE 開始時にその枠が「焼成脇のトレイ」に出る。
  代替: BAKE 画面でトレイ全体から選ぶ（準備不要だが誤選択・探索時間が増え、窓内の負荷が高い）。
- **推奨（個数）**: 1 タップ＝1 個、必須個数で打ち止め。代替: 1 タップで必須個数を一度に追加（簡単だが「足りない」状況が作れず、取り逃しの意味が薄い）。
- **Owner 判断**: 準備の枠の置き場、個数の単位、必須個数を超える追加を許すか（許す場合はエンジン契約の変更が必要で、評価の扱いが新規論点になる）。

### D3. タップ・代替操作・ドラッグ（Q3）

- 事実: 直接操作と代替操作は同じ `ADD`（エンジン済み）。#784 の Owner 決定: 代替操作 UI は**既定で折りたたみ**、自然なジェスチャーを保つ、キーボードでは到達可能に。**代替操作 UI の実装は未承認。**
- **推奨**: 主操作は**トレイのチップをタップして 1 個ずつ追加**（落下位置は D4 の自動配置）。ドラッグは任意（#478 のトレイドラッグ統一が入った後に同じ `ADD` へ接続）。代替操作はタップと同じ `ADD`、見た目の区別なし。
- 代替案: ドラッグのみ（既存の scatter と一貫するが、止めている間でも片手操作が難しく、T9 の趣旨に反する）／タップのみ（最小だが置く場所の自由度ゼロ）。
- 注意: 入力元が結果を変えないという契約（採点・星・Dex BEST に影響しない）は T9 の公平性 HOLD と整合する。
- **Owner 判断**: ドラッグを初期スコープに含めるか、代替操作 UI を MID_BAKE でどの段階に出すか。

### D4. 食材ごとの配置方法（Q6）

すべて `scatter`。案は仮説であり、見た目の在庫は未確認（§1.7）。

| 食材 | 推奨の置き方 | 代替 | 備考 |
|---|---|---|---|
| eel | 細長い 2 切れを決定的な位置へ自動配置 | ドラッグで位置指定 | POST_BAKE 近似のうちは FINISH の既存配置を使う（Q7） |
| natto | 2 つの塊を自動配置 | ドラッグ | 粘性の表現はビジュアルタスク |
| okra | 輪切り 2 枚を自動配置 | ドラッグ | 原典確認待ち（Q7） |
| sansho-pepper | **ふりかけ**（タップで粉が降る） | 点配置 | `SPICE`。置くより振る動作の方が自然。原典確認待ち |
| french-fries（lomo） | 揚げ済みの束を自動配置。`requiredState: fried` を要求 | ドラッグ | FRY（F2 HOLD）の出力が前提 |

**推奨**: 自動配置は食材 ID と追加順から決まる決定的な位置（乱数なし）にして、HV とテストを再現可能にする。
**Owner 判断**: 自動配置で採点・見た目が許容か、個別の配置自由度を後段で足すか。

### D5. PREP・FRY との依存関係（Q8）

- 現状: PREP は実装済み（Production OFF）、FRY は F1／Lab までで F2 HOLD。
- lomo-saltado は PREP（牛・玉ねぎ）＋ french-fries の `fried` が必要（マトリクス上のタグは `MID_BAKE`＋`PREP` で、FRY 依存の明記なし。§1.4-3）。
- **推奨**: 3 つの工程は**共通の Gate 構造**（Production 固定 false ＋ Preview/DEV opt-in）を使い、MID_BAKE は PREP／FRY を import しない。lomo-saltado は最後に適用し、F2 の方針が決まるまで待つ。natto は PREP／FRY に依存しないため最初の検証対象に向く。
- 代替: lomo を最初に作る（3 工程の結合を早く検証できるが、F2 HOLD に直列でブロックされる）。
- **Owner 判断**: lomo-saltado の工程タグ（PREP のみか FRY も必要か）の確定、適用順。

### D6. 在庫・保存・対象モード（Q9・Q10）

- **推奨（在庫）**: ADD で「予約」し、`CONFIRM_BAKE` で確定、BAKE を離脱したら戻す。Lunch Rush の `unservedConsumption` と同じ考え方で、追加が焼成前の保存状態を壊さない。
  代替: ADD で即消費（実装は単純だが離脱時に消えたままになる恐れ）／CONFIRM_BAKE で一括（BAKE 中に在庫不足を知るのが遅い）。
- **推奨（保存）**: 保存スキーマ変更なし。追加された食材は CONFIRM_BAKE の時点でピザの一部になるため、`pendingRound` は既存の仕組みで足りる見込み。**BAKE 中の離脱・再読み込みの挙動は未確認で、段階 B の前に Fresh Audit が必要。**
- **推奨（モード）**: Guided と Free Cooking のみ。FINISH に Lunch Rush／Dinner が到達しないのと同じ扱いで、時間制限モードに止める操作を入れない。
- **Owner 判断**: モード範囲、予約方式、離脱時の挙動。

### D7. 採点（Q11）

- **推奨**: 初期は**追加のタイミングを採点しない**。追加した食材はピザの食材として既存の判定（Scoring 2.0）に乗る。取り出しの `classifyBake` は不変。
  取り逃し（`missing-additions`）は「必須食材が足りないピザ」になり、既存の同一性・採点がそのまま扱う。
- 代替: 追加タイミングを新しい成分として採点（Scoring 2.0 の変更が必要で影響が大きく、T9 の公平性 HOLD にも抵触しうる）。
- 注意: 「止めて足す」では追加の巧拙を測る時間要素が弱いので、採点しない方針と整合する。
- **Owner 判断**: 取り逃し時に Guided の注文で失敗扱いにするか、Free Cooking で別のピザとして扱うか。

### D8. Research・Hint（Q12）

- **推奨**: Hint は「焼成中に加える食材がある」ことだけ示し、個数・タイミングは示さない（`finishHint.ts` の考え方に倣う）。Research は mid_bake の食材も late 軸と同じ分類で扱う案。
- **未確認**: Research の同定ロジックが mid_bake 食材を late として扱えるか、staged レシピが Research 対象になる条件。**段階 B の前に影響調査（docs-only）が必要。**
- **Owner 判断**: 答えを漏らさない範囲（Hint に出す情報量）。

---

## 3. レシピ適用案（eel・natto・okra・sansho-pepper・lomo-saltado）

| レシピ | 工程 | 推奨の適用 | 前提・保留 |
|---|---|---|---|
| natto-pizza | natto（mid_bake 確認済み）。okra は late 指定なし | **最初の検証対象。** natto 2 個を窓で追加。okra の位置づけは原典確認後 | R-1 ソース未指定は Owner 判断。catalog の昇格は別タスク |
| eel-pizza | eel は mid_bake／post_bake 未決。sansho も late 指定なし | **原典確認まで POST_BAKE 近似（R-6 提案どおり）**。確認で mid_bake と確定したら適用 | R-1 ソース未指定。eel と sansho の両方の原典を確認 |
| okra / sansho-pepper | 単独では適用先なし（natto／eel の食材） | 上記 2 レシピに従う | 原典未確認（§1.7） |
| pizza-de-lomo-saltado | french-fries（mid_bake）＋PREP（牛・玉ねぎ） | **最後に適用。** PREP／FRY の統合方針が決まってから | R-1・R-4（Jaccard 例外）・重複ゲートが先に Owner 判断。F2 HOLD |

**推奨の方針**: 機構は natto で検証し、原典未確認の食材は先例（たらこ）のとおり POST_BAKE 近似のまま出荷して、確認でき次第 mid_bake へ付け替える。
レシピデータ（`recipes.ts` は HOT）やカタログへの昇格は、MID_BAKE 側の検証と別の作業として扱う（staged catalog の activation は #780 側）。

---

## 4. iPhone Safari HV の検証方法（Q14）

HV ポリシーに従い、390×844 の動画（リポジトリには commit しない）＋ before/after スクリーンショットを使う。Chromium の結果は実機 PASS として扱わない。

- **入口（案）**: 既存の `?cookPrepHv=1`／`?cookSearHv=1` と同じ構造の `?cookMidBakeHv=1`。DEV／Preview 限定の静的ゲート、使い捨てのメモリ内セーブ（実セーブに触れない）。**入口の作成・Preview 更新は別途 Owner 承認。** 入口が成立しない場合は「入口不成立」と報告する（#784 の運用どおり）。
- **3 ラウンド（案）**
  - ラウンド A: 通常操作（タップ）で natto を 2 個追加。窓前・窓中・窓後、止まった針、再開、取り出しを動画で記録。
  - ラウンド B: 代替操作（#784 の方針）、VoiceOver・外付けキーボードは別セッション。
  - ラウンド C: 回帰。MID_BAKE を使わないレシピの BAKE が従来どおり（針の速度・取り出し・採点）であること。
- **記録項目**: 窓の実時間（動画から）、追加の成功回数、取り出しとの誤操作、針が止まった印象、RESULT。
- **合格基準（案、Owner が確定）**: 自然な操作 10 回のうち 8 回以上が代替操作なしで必須個数に到達／誤って取り出す事故 0 回／通常 BAKE の回帰なし。
- 合否の言葉は Owner のもの（`PASS`／`FAIL`／`waived`）。セッションは代わりに書かない。

---

## 5. 段階 B〜F の移行条件と並行範囲、HOT 競合

### 5.1 段階と移行条件

| 段階 | 内容 | 開始条件 | 完了条件 |
|---|---|---|---|
| A（本書） | 設計判断表 | — | Owner が Q1〜Q14 を判断 |
| B | レシピ計画データ（純粋・新規ファイル）＋ Fresh Audit（BAKE 中の保存挙動、Research／Hint 影響） | A の Q1・Q2・Q4・Q5・Q7・Q8 が確定。新しい claim | 単体テスト、アーキテクチャテスト、Codex 独立レビュー、CI |
| C | 操作の設計＋**独立 Lab**（Preview/DEV 限定。HOT 無編集）。止める挙動・タップ追加・代替操作の `ADD` 接続 | A の Q1・Q3・Q6 が確定。Lab の入口（`main.tsx` への数行追加）の claim | Lab の自動テスト、Preview 入口の設計。共有 Preview 更新は別承認 |
| D | UI・Reducer 接続（`gameReducer.ts`・`GameScreen.tsx`・`PizzaStage.tsx`・`App.css` など HOT） | C の HV（ラウンド A）が Owner PASS。HOT を触る他 PR との順序が確定。**HOT ファイル用の専用 claim** | 全体テスト、WebKit、Codex、CI |
| E | iPhone HV ラウンド B／C、Result Report | D の HEAD 確定（HV は 1 つの HEAD に属する） | Owner の PASS（日付・HEAD） |
| F | Production Gate | E の PASS と Owner の別承認 | `MID_BAKE_EXPERIENCE_PRODUCTION` の変更は別 PR |

### 5.2 並行してよい範囲（HOT に触れない）

- B のうち: レシピ計画データ、純粋ロジックの拡張、docs-only の影響調査（Research／Hint／保存）。いずれも `src/logic/midBake/**`（claim 解放済み）か新規 `docs/**`。
- C の Lab: 新規ディレクトリ（FRY Lab と同形）。`src/main.tsx` は #738・#746・FRY Lab も追加する場所で、数行の追加が競合しうる（後から merge する側が取り込む）。
- 原典確認（okra・sansho・eel）は独立して進められる。

### 5.3 直列にする範囲（HOT）

- D の `gameReducer.ts`・`GameScreen.tsx`・`PizzaStage.tsx`・`App.css`。#795 本文にも「`GameScreen.tsx` 系は直列規則」とある。
- 着手前に、これらを触る open PR（現状 #738・#746・#478・#581 など）と claim を再確認し、claim に「どの PR が先に merge されるか」を明記する。
- #784 の統合 claim（T9）は `midBake` と重ならないが、「#764／#766 は新しい操作の統合より先」という Owner 決定があるため、D は #764／#766 の状況も条件に含める。

---

## 6. 本書で行っていないこと

- 実装、テスト追加、HOT ファイル・ゲーム本体・catalog・golden の編集。
- `PROJECT_HANDOFF.md` の更新（HOT のため、Owner の承認後に別途）。
- PR の merge、Production ON、共有 Preview の更新。
- 原典の確認（okra・sansho・eel）。

## 7. 次の行動

Owner が §0 の Q1〜Q14 に回答（推奨どおりなら「推奨で GO」）。回答後、段階 B／C の claim を新規に取得してから着手する。
