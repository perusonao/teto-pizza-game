# Cooking Prep Phase 2 Fresh Design — 「焼く」「茹でる」と共通調理法基盤（docs-only）

Status: **設計案のみ（Owner 判断待ち）。実装は開始していない。** 製品コード・テスト・CSS・設定・Preview・PR・Issue・claim・Monitor は作成・変更していない。
作成: 2026-10-29 / 基準 `main` = `ffff081c0136df43113a81c170343d24d968ed1f`（#695 merge 後、`git fetch` で再確認済み）
ブランチ: `claude/teto-cooking-phase2-design-qxyj3m`（PR #697 のブランチとは無関係。#697 は checkout・変更・push していない）
性質: 「推奨」は助言であり Owner Decision ではない。数値（時間・距離・色）は設計値で、実機 iPhone HV で確定する。
HV: docs-only のため HV 動画・スクリーンショットは対象外（HV Policy §2「docs-only は原則不要」）。

---

## 0. 要点（先に結論）

| 項目 | 推奨 |
|---|---|
| 焼く（ソーセージ・ポルチーニ） | **案 A2「片面が色づいたら、タップで裏返す → 両面焼けたら取り出す」**。裏返しはボタンのタップ（ドラッグ・スワイプにしない）。牛肉の「見て 1 回取り出す」と違い、**判断が 2 回（裏返す・取り出す）あり、裏面が見える**ことで体験を分ける |
| 茹でる（エビ） | **案 B2「ざるを上へスワイプして引き上げる。同じ働きの『引き上げる』ボタンも常設（タップ代替）」**。スワイプは鍋の物理動作に合う唯一の食材に限定。誤操作防止のため、ざるの取っ手の領域だけが反応し、画面端・スクロール領域と分離 |
| 共通基盤 | **案 C3「薄いレジストリ + 調理法ごとの独立 Scene と純粋な judge」**。共通化するのは「提示条件・reducer の 1 アクション・transient な `preparedLook`・キャンセル/ガード・フラグ」だけ。操作と見た目は調理法ごとに持つ |
| 実装順 | M1 → Stage 1-A（焼く）→ Stage 1-B（茹でる）→ Stage 2（あめ色炒め）。**ただし M1 以降はすべて #697 の Final Gate 完了まで実装開始を保留**（`gameReducer.ts` / `prepIngredients.ts` / `prepOffer.ts` / `CookingPrepLayer.tsx` が #697 と同じファイル） |
| 保存・採点 | **保存スキーマ v2 不変。採点・在庫・Dex・Journal・Pitz・★・Research に影響しない**（#697 と同じ transient の `preparedLook` に載せる） |

---

## 1. 調査したもの

### 1.1 Git / main

| 項目 | 結果 |
|---|---|
| `origin/main` HEAD | `ffff081c0136df43113a81c170343d24d968ed1f`（`feat(cooking-prep): Phase 1 PR-B …(#695)`）。依頼文の時点から動いていない |
| 最近の main | #695 → #694（PR-A）→ #693（B11 S1: boscaiola / porcini-pizza / pescatore、porcini / mussel）→ #691（beef-slices）→ #692（Cooking Prep 仕様取り込み） |

### 1.2 PR / Issue（GitHub の最新状態、読み取りのみ）

| 参照 | 状態 | 本設計との関係 |
|---|---|---|
| **PR #697**（Phase 1B 牛肉タイミングゲーム） | **open・非 draft・mergeable_state=clean**。head = `8ba2b5b901a79255fd396c755c69b1df2ac59f85`（依頼文の既知 SHA と**一致**）、base = `ffff081`、50 ファイル（+2303 / −341）。実機 HV は Owner 待ち、WebKit は CI 待ち | 共通基盤の**前提**。最大の競合源（§8） |
| **Issue #696**（#697 の管理 Issue） | open。claim コメントあり（session `session_016YrGi1TrS6Cbdit95Aom63`、期限 2026-11-05、`src/logic/prep/**` ほか） | 本設計は claim 範囲の**ファイルを実装では触らない**（docs のみ）。実装時は claim 再確認が必須 |
| PR #695 / #694（Phase 1 PR-B / PR-A） | merged | 既存の prep 構造の基点 |
| PR #693（B11 S1: porcini / mussel） | merged | porcini の専用 SVG（`porcini-slice`）の出所。ソーセージ・ポルチーニの「焼く」対象になる |
| PR #691（beef-slices）/ #690（Ingredient Visual V1） | merged | 専用 SVG 方式の前例 |
| PR #478（`GameScreen.tsx`、draft）/ #468（`PizzaStage.tsx` / bakeVisual） | open・main の古い base | HOT file の既存競合（#697 も同じ指摘） |
| PR #620 / #295 / #296 / #293 / #255 | open（docs 系） | 調理工程・172 レシピの旧監査。実装とは重ならない。**本文は精読していない**（下記 1.4） |
| Issue 検索（調理・焼く・茹でる・玉ねぎ・野菜描画） | 重複する Issue は **#696 のみ**。「焼く／茹でる／あめ色」を扱う open Issue は無い | 新規 Issue 案は §11.2 |

### 1.3 読んだ資料

`CLAUDE.md` / `docs/PROJECT_HANDOFF.md`（冒頭〜2026-09-22 の addendum。全体 1143 行のうち 287 行まで）/ `TETO_SESSION-OPERATIONS_1.0.md`（全文）/ `TETO_HUMAN-VERIFICATION-POLICY.md`（冒頭〜§4）/ `TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md`（全文）/ #697 の head にある `panDoneness.ts`・`CookingPrepLayer.tsx`・`TETO_COOKING-PREP_PHASE1B_Result.md`・変更ファイル一覧 / main の `prepIngredients.ts`・`prepExperienceGate.ts`・`prepOffer.ts`・`beefDoneness.ts`・`gameReducer.ts` の `PREP_INGREDIENT` / `IngredientGlyph.tsx` の `SausageSlices`・`ShrimpCurl`・`PorciniSlice` / `bakeVisual.ts` の `toppingVisualFrame` / `recipes.ts` の対象食材の使用箇所。

### 1.4 読んでいないもの（正直な範囲）

- 172 レシピ調査資料（`TETO_RECIPE_172_MECHANIC-MATRIX.md`、`TETO_PIZZADB_172_MASTER-REPORT.md`、`TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION_ROWS.md` ほか）は**存在確認と Handoff の要約（11 capability、LATE_ADDITION 等）のみ**。「焼く／茹でる」に当たる行の個別精読は未実施。実装前の Fresh Gate で要確認。
- #697 の `Fresh-Audit.md` / `Gameplay-Visual_Research.md`（544 行）は未読。Result と実コードから事実を取った。
- `PROJECT_HANDOFF.md` の 288 行目以降（〜1143 行）は未読。2026-10 の addendum は冒頭にあるものを読んだ。
- 実機 iPhone・WebKit での挙動は未確認（本セッションは read-only）。

---

## 2. 既存システムの構造（事実）

### 2.1 Cooking Prep の流れ（main + #697）

```
TOPPING で対象食材の chip を選ぶ
  → prepOfferedIngredient(...)  … 食材 id と enabled/phase/step/roundKind/所持のみ。レシピ・標的は見ない（AC-12）
  → 「🍳 炒める」ピル（生地の下、ステージ下端から 18px、高さ 44px）
  → CookingPrepLayer のパン画面（.pizza-stage の内側、dock は inert）
       pan: panReducer（時刻は引数のみ）/ gradeAt / panStageAt …  ← #697
  → 結果を保持 → dispatch PREP_INGREDIENT { ingredientId, progress? }
       state.preparedIngredientIds: string[]（transient）
       state.preparedLook: Record<ingredientId, number 0..1>（transient、#697 で追加）
  → PizzaStage が preparedPieceVisual(id, progress) で配置済みピースの色を決める
```

### 2.2 事実の一覧（コードで確認）

| 領域 | 事実 | 場所 |
|---|---|---|
| 対象判定 | `canPrepIngredient(id) = PREP_TARGET_INGREDIENT_IDS に id がある ∧ pieceVisual がある`。いまは `["beef"]` のみ。`ingredients.ts` は読むだけ | `src/data/prepIngredients.ts` |
| フラグ | `PREP_EXPERIENCE_PRODUCTION = false` と Preview/DEV の `?cookPrep=on`。**調理法ごとの独立フラグは無い**（フラグは 1 本） | `src/data/prepExperienceGate.ts` |
| reducer | `PREP_INGREDIENT` は拒否時に**同一 state 参照**を返す。許可: GUIDED / FREE_COOK、PREPARE/TOPPING、対象、所持、未調理。Lunch Rush / Dinner は拒否。`RESET_PIZZA` でプロパティごと除去 | `gameReducer.ts` |
| 提示 | `prepOfferedIngredient` は純関数。`PREP_DONE_MS=700` / `PREP_GUARD_MS=300` は共有定数 | `logic/prep/prepOffer.ts` |
| タイミング | `panDoneness.ts` は牛肉専用の定数（early<2100 / best<4200 / overdone / 6000 / ARM 300）。純関数で、時刻は引数 | #697 |
| 見た目 | 色は **CSS のみ**で SVG の `fill/stroke` を上書き（`.ingredient-piece--prepared .ingredient-glyph--beef-slices path:nth-of-type(n)`）。SVG 本体は無変更 | `CookingPrep.css`（#697） |
| 見た目の入力 | `preparedLook` は**食材 id → 0..1 の 1 スカラー** | #697 |
| 焼成後の変化 | `toppingVisualFrame(heat)` は「ちょうど」でほぼ変化しない（sepia 0.08）。差の主役は食材の色。`PREP_HEAT_OFFSET = 0`（Owner 決定 P-7） | `bakeVisual.ts`, `beefDoneness.ts` |
| 保存 | `schemaVersion: 2`。`pendingRound` は `GameState` を直列化せず pizza を明示コピー。`preparedLook` は architecture test で保存系に出ないことを固定（#697） | `persistence.ts`, `pendingRound.ts` |
| 工程名の衝突 | 工程タブに「焼く」（BAKE）が既にある（仕様 P-3 でも「焼く」を避けた経緯） | 仕様書 §15.2 |

### 2.3 対象食材の現状

| 食材 | `pieceVisual` | 使うレシピ（`recipes.ts` より） | Lunch Rush |
|---|---|---|---|
| `sausage` | `sausage-slices`（斑点のある赤茶の輪切り 2 枚。`fill` 属性の固定色） | salsiccia / meat-lovers / brazilian-calabresa / full-english / polish-kielbasa / salsiccia-e-friarielli / spanish-chorizo / boscaiola ほか | salsiccia・meat-lovers は**対象**。他は `lunchRush:false` |
| `porcini` | `porcini-slice`（茎と傘のあるきのこ。#693） | boscaiola, porcini-pizza | どちらも `lunchRush:false` |
| `shrimp` | `shrimp-curl`（**むきエビ**のC字。淡いピンク＋オレンジの縁。Owner 承認済み） | pesto-gamberi, pescatore | どちらも `lunchRush:false` |
| `onion` | **なし**（絵文字 🧅 のみ。専用 SVG 未作成） | 20 件前後（fugazza / polish-kielbasa / rendang ほか。Lunch Rush 対象を含む） | 一部対象 |
| `beef`（参考） | `beef-slices` | rendang-pizza, wasabi-beef-pizza | `lunchRush:false` |

→ 事実の含意: **ソーセージ・ポルチーニ・エビはすでに専用 SVG があり、休眠ガード（`pieceVisual` あり）を満たす。玉ねぎは満たさない**（§9 Stage 2 の依存）。

---

## 3. 設計方針

1. **調理法ごとに「操作の動詞」を分ける。** 牛肉＝「見て、1 回取り出す」。焼く＝「途中で 1 回ひっくり返し、最後に取り出す」。茹でる＝「引き上げる」。あめ色炒め＝「待つ・ときどき混ぜる」。同じ“タイミングを計って押す”の使い回しにしない。
2. **入力方式を一律にしない。** タップが自然なものはタップ（裏返し）。物理動作に合うものだけスワイプ（ざるの引き上げ）。**スワイプには必ず同等のタップ手段を常設**する（代替であり、劣化版ではない）。
3. **すべて任意・失敗しない・何も残さず中止できる**（Phase 1 から継承）。進行を止める状態は作らない。
4. **判定は押下/操作の時刻だけで決める**（描画の遅れを入れない）。時刻は引数、純関数。
5. **ゲージ・数値・カウントダウンは出さない**（#697 の Q3 と揃える）。食材の見た目・湯気・音のない演出だけで読ませる。
6. **共通化は“入口と出口”まで。** 中身（操作・見た目）は調理法の持ち物。

---

## 4. 比較案

評価軸（◎=良 / ○=可 / △=注意 / ×=弱い）:
**①** 初見で操作を理解できるか　**②** 食材の特徴が表現できるか　**③** 調理している実感　**④** 連続プレイで面倒にならないか　**⑤** iPhone Safari で安定するか　**⑥** 既存システムへの変更が少ないか　**⑦** 将来の食材へ再利用できるか

### 4.1 A. 焼く（ソーセージ・ポルチーニ）

| 案 | 内容 |
|---|---|
| **A1** | 牛肉と同じ「自動で焼ける→取り出す」に、色だけ差し替える |
| **A2（推奨）** | 2 〜 3 枚をフライパンに並べる。**片面が自動で色づく → 色づいたらタップで「ひっくり返す」→ 裏面が焼ける → 取り出す** |
| **A3** | 食材を**スワイプ（フリック）でひっくり返す**。両面焼けたら取り出す |
| **A4** | 1 枚ずつタップして**個別に**裏返す（各ピースに独立した焼き時間） |

| 案 | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | メリット | デメリット |
|---|---|---|---|---|---|---|---|---|---|
| A1 | ◎ | △ | △ | ◎ | ◎ | ◎ | ○ | 最小コスト、#697 の資産をそのまま使う | **牛肉の「炒める」と体験が同じ**（依頼の最重要条件に反する）。「焼く」の個性が無い |
| **A2** | ○ | ◎ | ◎ | ○ | ◎ | ○ | ◎ | **判断が 2 回（裏返す・取り出す）**＋**裏面が見える**ので牛肉と体験が分かれる。焼き色の違いが食材ごとに出せる（ソーセージ＝格子状の焼き目、ポルチーニ＝切り口の黄金色）。入力はタップだけで誤操作に強い | 工程が 1 つ増える（所要 4〜7 秒）。判定が 2 点になり実装は A1 より重い |
| A3 | △ | ○ | ○ | △ | △ | △ | △ | 手応えはある | ステージ内のスワイプは**iOS のスクロール・端スワイプ（戻る）と競合**し、誤作動の温床。食材全般に使い回せる動作でもない。タップとドラッグを無理に統一する方向 |
| A4 | △ | ○ | ○ | × | △ | △ | × | 「料理している」感は強い | 2〜3 回×N 枚の操作で**連続プレイが重い**。360×800 でタップ領域が小さくなる（誤タップ）。状態がピース単位になり、P-4 で決めた「食材単位」の境界を越える |

**推奨: A2。** 牛肉と違う“ひっくり返す”判断が入り、タップだけで済む。

**A2 の操作詳細（設計値）**
- 開始: ピル（文言は §10 の Owner 判断）→ フライパン画面。**食材は食材単位で 1 つの状態**（画面には 2〜3 枚を並べるが、状態は 1 本）。
- 面 1: 自動で色づく。「ひっくり返す」ボタン（常設、44px 以上）。押した時刻 `tFlip` を記録。
- 面 2: ひっくり返した瞬間から面 2 が自動で色づく。「取り出す！」を押した時刻 `tTake`。
- 開始直後 300ms と、ひっくり返した直後 300ms の入力は無視（二重タップ・ダブルタップ拡大の防止）。
- 取り出す前にひっくり返さなかった場合: 取り出しは**可能**（片面だけ焼けた状態＝「片面だけ」の結果）。進行不能にしない。
- 時間切れ（設計値 8 秒）で自動終了＝焼きすぎ扱い。競合時は時間切れ優先（#697 と同じ規則）。

**判定（純関数、時刻は引数）**
- 各面の焼き時間 `d1 = tFlip`（面 1）、`d2 = tTake − tFlip`（面 2）。
- 面ごとに early / best / over を判定（窓は食材ごとの定数。例: ソーセージ 面あたり best 1.6〜3.0s、ポルチーニ 1.2〜2.4s。**初期値**）。
- 総合 = 両面 best なら「ちょうどいい」、片面が過不足なら「片面だけ…」、両面不足/過多は early/over。表示文言は §10。
- 配置後のピースは 20px 級で両面は描けないため、**見た目は 1 スカラー（0..1）に畳む**: `look = clamp((side1 + side2) / 2)`（両面の平均）。これで #697 の `preparedLook: Record<id, number>` と**同じ形**に載る。

**食材ごとの状態と見た目（A2）**

| 状態 | ソーセージ | ポルチーニ |
|---|---|---|
| 調理前 | 現行の赤茶（`#8f3f2e` ほか。HV 済みの見た目）。パンの中では生っぽい色 | 現行の薄茶の傘と淡い茎 |
| 面 1 調理中 | 上面に**格子状の焼き目**が出る（暗い斜線）。軽い湯気 | 切り口が**黄金色**に。縁が少し反る（`transform`） |
| ひっくり返し | 裏返しアニメ（`rotateX`）→ **裏面は白っぽい生**が見える（ここが“裏面が見える”報酬） | 同様。裏は淡いクリーム色 |
| ちょうど | 両面に均一な焼き目、脂のつや | 両面が黄金色、縁が少し濃い |
| 焼き不足 | 焼き目が薄く、色の差が小さい | 切り口が白っぽい |
| 焼きすぎ | 焼き目が黒ずみ、縮む（`scale` 0.92）、煙 | 縁が焦げ茶、縮む |
| 配置後（20px） | `look` を 3 段階（生・ちょうど・焦げ）の色に補間して `fill` を上書き（#697 と同じ CSS 上書き方式） | 同上 |

非色の手掛かり（色覚への配慮）: 焼き目の**形**（格子）、つや、湯気→煙、縮み。色だけに頼らない（#697 の protan 配慮と同じ方針）。

### 4.2 B. 茹でる（エビ）

| 案 | 内容 |
|---|---|
| **B1** | 「引き上げる」ボタンを**タップ**するだけ（スワイプなし） |
| **B2（推奨）** | **ざるを上へスワイプして引き上げる**。同じ働きの「引き上げる」ボタンを**常設**（どちらでも同じ結果） |
| **B3** | 画面を**長押しで鍋にエビを沈め**、離すと引き上がる（押している間が茹で時間） |
| **B4** | おたま/網を**ドラッグしてエビを 1 匹ずつすくう** |

| 案 | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | メリット | デメリット |
|---|---|---|---|---|---|---|---|---|---|
| B1 | ◎ | ○ | △ | ◎ | ◎ | ◎ | ◎ | 最も安全・簡単 | 「引き上げる」実感が弱い。焼く/炒めると操作が同じに見える |
| **B2** | ○ | ◎ | ◎ | ○ | ○ | ○ | ○ | 物理動作に合う（持ち上げる）。スワイプが苦手でもボタンで同じ結果 | スワイプは WebKit の誤作動対策が要る（§6）。実機 HV 必須 |
| B3 | △ | △ | ○ | △ | × | ○ | △ | 「茹でている間ずっと関わる」実感 | **長押しは iOS のコンテキストメニュー・拡大鏡・3D Touch と競合**。指が食材を隠す。Phase 1 の「タップのみ・長押し不要」(AC-11) に反する |
| B4 | × | ○ | ○ | × | × | × | × | 手触りは最も料理らしい | 360×800 で的が小さく誤操作多発。連続プレイが重い |

**推奨: B2。** スワイプは**エビの引き上げに限定**し、他の調理法へ広げない。

**B2 の操作詳細（設計値）**
- 開始: ピル → 鍋画面。エビ 2〜3 匹が**ざる**に入って湯に沈んでいる。ざるの上に**取っ手**が見える。
- 引き上げ（スワイプ）: **取っ手の領域（44×64px 以上）で pointerdown → 上方向へ 48px 以上動かす**。しきい値を超えた `pointermove` の `timeStamp` を引き上げ時刻とする。しきい値に届かず離した場合は**何も起きない**（キャンセル、状態不変）。
- 引き上げ（タップ代替）: 「引き上げる」ボタン（取っ手の下、常設、44px 以上）の `pointerdown` の `timeStamp`。
- スワイプとタップの時刻の差（指が動く分）は最大 150ms 程度。窓の幅（best が 2 秒以上）に対して許容範囲。**HV で確認**。
- 開始 300ms の入力無視、時間切れ（設計値 9 秒、湯の中に入れっぱなし＝茹ですぎ）、競合時は時間切れ優先。

**茹ですぎ・茹で不足の表現（非色の手掛かりを必須にする）**

| 状態 | 見た目 |
|---|---|
| 投入直後（茹で不足） | **灰色がかった半透明**、まっすぐ寄りのゆるい C 字。泡は小さい |
| 茹で上がり前 | ピンクが乗り始め、C 字が少しきつくなる。泡が増える |
| ちょうど | **鮮やかなオレンジピンク**、C 字がきつく丸まる（尾が内側）。ツヤ。湯気が立つ |
| 茹ですぎ | **色が褪せて白っぽく**、**縮んで小さく**（`scale` 0.9）、丸まりすぎる。湯が濁る |
| 配置後（20px） | `look` を 3 段階に補間。茹で不足＝灰ピンク、ちょうど＝鮮やかなオレンジピンク、茹ですぎ＝褪せた白ピンク |

形の変化は**SVG の 2 状態のクロスフェード**（ゆるい C ↔ きつい C）で表現する案が確実。`ShrimpCurl` のパスは固定のため、**CSS だけで曲がりを変えるのは難しい**。二つ目の SVG を足すか（`ingredients.ts` と `IngredientGlyph.tsx` を触る → カタログ系 PR との競合）、`transform`（`scale`/`rotate`）の近似にとどめるかは §11.1 の Owner 判断。

**iPhone Safari での誤操作防止（B2）**
1. スワイプに反応する領域を**取っ手だけ**にする。鍋画面のそれ以外は反応しない（ページスクロールを奪わない）。
2. 取っ手に `touch-action: none` と `setPointerCapture`。ほかの領域は `touch-action: manipulation`（ダブルタップ拡大を抑える）。
3. 取っ手を**画面の左右端から 24px 以上内側**に置く（iOS の端スワイプ「戻る」との競合回避）。上方向のスワイプなので、画面上端からのスワイプ（通知/コントロールセンター）は取っ手をステージ下寄りに置いて避ける。
4. 引き上げの確定後 300ms は入力を無視し、後続のタップが生地や chip に漏れない（AC-16 と同方針）。
5. ×（中止）はいつでも有効。中止は何も残さない。
6. ボタン（タップ代替）は常設。**スワイプができない人でも困らない**。
7. `pointercancel` / blur / visibilitychange は破棄（#695/#697 と同じ流儀）。

### 4.3 C. 共通基盤（M1）

| 案 | 内容 |
|---|---|
| **C1** | 調理法ごとに `CookingPrepLayer.tsx` へ if 分岐を足す（現状の延長） |
| **C2** | **完全データ駆動**の汎用エンジン（時間窓・段階・操作を設定値で表現し、1 つのコンポーネントが全調理法を描く） |
| **C3（推奨）** | **薄いレジストリ**＋調理法ごとの独立 Scene・純粋 judge。共通化は入口（提示条件）・出口（reducer の 1 アクション・`preparedLook`）・ガード類のみ |

| 案 | 個性の保持 | 追加の容易さ | 既存への変更 | 競合 | 評価 |
|---|---|---|---|---|---|
| C1 | ○（直書き） | × 分岐が増え続ける | ○ | × `CookingPrepLayer.tsx` が肥大化し #697 と常に衝突 | 却下 |
| C2 | **×**（スワイプ/裏返し/待つ を設定値で表すと“個性”が設定の外へ漏れて破綻する） | ○ | × | △ | 却下（依頼の「共通化しすぎない」に反する） |
| **C3** | ◎ | ◎（Scene と judge と登録 1 行） | ○ | ○（新規ファイル中心） | **推奨** |

---

## 5. 共通基盤の設計（C3）

### 5.1 レジストリ

```ts
// src/data/cookMethods.ts （新規。ingredients.ts は触らない）
export type CookMethodId = "stirfry" | "sear" | "boil" | "caramelize";

export interface CookMethod {
  id: CookMethodId;
  /** ピルの文言（画面内のみ。ミトの台詞・ヒント機構には載せない） */
  pillLabel: string;
  /** 調理法ごとの独立フラグ（本番は既定 false） */
  enabled: () => boolean;
  /** この調理法が適用される食材。canPrepIngredient 相当の休眠ガード（pieceVisual 必須）は共通で掛ける */
  targets: readonly string[];
}
export const COOK_METHODS: readonly CookMethod[] = [ /* stirfry, sear, boil, (caramelize は Stage 2) */ ];

// 食材 → 調理法（v1 は 1 食材 1 調理法）
export function cookMethodFor(ingredientId: string): CookMethod | null;
export function canPrepIngredient(id: string): boolean; // 既存の API を維持（内部で cookMethodFor を使う）
```

- **食材と調理法の対応**: `beef→stirfry`、`sausage,porcini→sear`、`shrimp→boil`、（Stage 2）`onion→caramelize`。**1 食材に複数の調理法が付く設計は v1 では作らない**（選択 UI が要る。§11.1）。
- 既存の `canPrepIngredient(id)` と `prepOfferedIngredient(input)` の**シグネチャは維持**する。#697 のテストを壊さない。
- Scene と judge の登録は**コンポーネントの遅延 import**（`React.lazy` は使わず、静的な `Record<CookMethodId, SceneComponent>`。バンドル増はごく小さい）。

### 5.2 調理前・調理中・調理後の状態

| 段階 | 置き場 | 内容 |
|---|---|---|
| 調理前 | なし（導出） | 「提示条件を満たす」だけ。`prepOfferedIngredient` が `cookMethodFor(id)` と `method.enabled()` を見て ID を返す |
| 調理中 | **Scene の局所 state**（`useReducer`、GameState に出さない） | 調理法ごとの純粋 reducer（`panReducer` / `searReducer` / `boilReducer`）。`makingStepToken` / `resetToken` で破棄（#695/#697 と同じ） |
| 調理後 | `GameState.preparedIngredientIds`・`GameState.preparedLook`（**#697 で導入される transient**） | `preparedLook[ingredientId]` は **0..1 の 1 スカラー**。調理法は食材 id から導出できるため**調理法 id は保存しない** |

→ **新しい GameState フィールドは作らない。** `PREP_INGREDIENT { ingredientId, progress? }` をそのまま使う（`gameReducer.ts` の変更は reducer のガード判定を `cookMethodFor` 経由にする数行のみ）。

### 5.3 操作イベント

調理法ごとに純粋 reducer が受けるイベントを持つ（時刻は必ず引数 `now`）。

| 調理法 | イベント |
|---|---|
| stirfry（#697） | `START` / `TAKE` / `TICK` / `CANCEL` |
| sear | `START` / `FLIP` / `TAKE` / `TICK` / `CANCEL` |
| boil | `START` / `LIFT`（スワイプ確定 or ボタン）/ `TICK` / `CANCEL` |

**共通なのは `START` / `TICK` / `CANCEL` の意味と“拒否時は同一参照を返す”規約だけ。** 共通基底クラスや共通 union は作らない（型の共有で個性が縛られるため）。共有ヘルパーは `sanitizeElapsed`、`ARM` ガード、時間切れ優先の 3 つの純関数に限る。

### 5.4 成功・失敗の判定

- 各調理法に `judge(...)` を 1 つ。入力は時刻（ms）のみ。出力は `{ grade: "early"|"best"|"overdone"; look: number /*0..1*/; label: string }`。
- **失敗の概念は“見た目と文言の差”だけ**。採点・★・Pitz・Dex に結びつけない（Phase 1 から不変）。やり直し（もう一度）／これで使う／× の三択は #697 と同形。
- 窓の数値は各 judge ファイルの定数 1 か所に集約（HV で調整）。

### 5.5 描画と判定の分離

```
src/logic/prep/<method>/judge.ts     純粋。時刻→grade/look/stage。React・DOM・時計に依存しない
src/logic/prep/<method>/look.ts      純粋。look(0..1)→色/CSS 変数（#697 の beefDoneness.ts と同形）
src/components/prep/<Method>Scene.tsx  描画のみ。judge の出力を表示し、イベントを reducer へ流す
src/components/CookingPrep.css（既存）  共通の枠（パン画面の幕・ピル・結果欄）
src/components/prep/<method>.css      調理法固有のスタイル（共通 CSS を肥大化させない）
```

- 判定は“押した時刻”だけで決まり、描画の遅れは入らない（#697 の原則を踏襲）。
- 色の上書きは #697 と同じ **CSS による SVG 上書き**（`nth-of-type`）。ただし `nth-of-type` は SVG の構造に依存して**壊れやすい**ため、食材ごとに「path 数・順序」を固定する小さな契約テストを置く（SVG が将来差し替わったら CI が止まる）。

### 5.6 アクセシビリティ

| 項目 | 設計 |
|---|---|
| 操作要素 | ピル・裏返す・取り出す・引き上げる・× はすべて `button`。44px 以上。Enter/Space で作動 |
| スワイプ | 常に同等のボタンが並ぶ（B2）。スワイプ専用の機能は作らない |
| 読み上げ | 開始・段階・結果を `aria-live="polite"`。**時間依存のゲームでは段階の読み上げが合図になる**ため、“画面を見ずに最適タイミングが分かる”のは意図した支援。ゲージの数値は読み上げない |
| 動きを減らす | 湯気・泡・アニメを止める。段階は静止画（つや・色・縮み・煙の有無）で読める（#697 と同方針） |
| 色覚 | 色以外の手掛かり（形＝焼き目/丸まり、縮み、つや、湯気→煙）を必須にする |
| 任意性 | すべて任意。押さなくても配置・採点・結果は同じ。時間制御が難しい人は“スキップ”や“これで使う”で進める |

### 5.7 調理法ごとの独立フラグ

| フラグ | 既定 | Preview opt-in |
|---|---|---|
| `PREP_STIRFRY_PRODUCTION`（既存 `PREP_EXPERIENCE_PRODUCTION` の改名/互換） | false | 既存 `?cookPrep=on` を**この調理法の別名として維持**（#697 の HV 手順を壊さない） |
| `PREP_SEAR_PRODUCTION` | false | `?cookPrep=sear` |
| `PREP_BOIL_PRODUCTION` | false | `?cookPrep=boil` |
| `PREP_CARAMELIZE_PRODUCTION` | false | `?cookPrep=caramelize`（Stage 2） |

- `?cookPrep=all`、カンマ区切り（`sear,boil`）も許可。**本番ビルドからクエリ名が消えること**を、既存の gate テスト（`prepPreview.gate.test.ts` 相当）の拡張で固定。
- 1 つの調理法を ON にしても他は動かない。本番 ON は**調理法ごとに別の Owner 承認**（Phase 1 §16.3 と同じ）。
- 二重の安全装置は維持: フラグ ON でも `pieceVisual` が無い食材では出ない。

### 5.8 既存セーブデータとの互換性

| 項目 | 結果 |
|---|---|
| 保存スキーマ | **v2 のまま。変更なし。migration なし** |
| `pendingRound` | 変更なし。復元したラウンドでは調理状態は戻らず食材は「生」の見た目に戻る（Phase 1 の O-5 / AC-19 と同じ） |
| `localStorage` キー | 追加なし。Preview のセーブにも触れない |
| 古いビルドで新しいセーブを読む | 新しい保存項目が無いので影響なし（ロールバック安全） |
| `GameState` の追加 | なし（`preparedLook` は #697 の既存 transient を再利用） |

### 5.9 採点・在庫・Dex・Journal への影響（明示）

| 対象 | 影響 |
|---|---|
| 採点（Scoring 2.0、Completion Gate、`finalizeRound`） | **なし**（`pizza` / `recipe` / `bakeValue` のみ読む。architecture test で `preparedLook` を走査） |
| 在庫 | **なし**（調理は何も消費しない。失敗してもやり直しで消費されない） |
| Dex / Pitz / ★ / BEST | **なし** |
| Journal | **なし**（調理結果は記録しない） |
| Research / Hint / 識別 | **なし**（提示可否は食材 id のみ。レシピ・標的を見ない。Research で標的が漏れない検証＝AC-12 と同じ試験を新調理法にも適用） |
| 調理時間（`cookingTiming`、CT1 の測定） | **未確認**。`RESET_PIZZA` では“時計は進み続ける”とあり、調理画面で過ごした時間が測定値に入る可能性がある。Phase 1 の資料に記載が無い。実装前の Fresh Gate で確認（採点には効かない見込みだが未検証） |

---

## 6. 実装計画

### 6.1 依存関係

```
#697 Final Gate（実機 HV・WebKit・Owner 承認・merge）
        │   ※ #697 の preparedLook / PREP_INGREDIENT(progress) / CookingPrepLayer を前提にするため
        ▼
M1 共通レジストリ ─→ Stage 1-A 焼く ─→ Stage 1-B 茹でる
        │                                   
        └─→ Stage 2 あめ色炒め ←── 野菜描画の品質改善（玉ねぎの専用 SVG）
```

- M1 は **#697 の merge 後**に、最新 main を基点に別 worktree/ブランチで開始する。#697 のブランチには何もしない。
- Stage 1-A と 1-B は独立（互いに依存しない）。優先は焼く→茹でる（理由: ソーセージの方が登場レシピが多い、エビはスワイプの HV が要る）。順序は §11.1 の判断事項。

### 6.2 段階ごとの計画

| 段階 | 対象ファイル（想定） | 想定変更範囲 | テスト | HV | 主なリスク | 完了条件 |
|---|---|---|---|---|---|---|
| **M1 レジストリ** | 新規: `src/data/cookMethods.ts`、`src/logic/prep/cookMethodRegistry.test.ts`。変更: `prepIngredients.ts`（`cookMethodFor` 経由）、`prepExperienceGate.ts`（調理法別フラグ）、`prepPreview.ts`、`prepOffer.ts`（method を受ける）、`gameReducer.ts`（ガード数行）、`CookingPrepLayer.tsx`（Scene を登録表から選ぶ）、`beefDoneness.ts`（`preparedPieceVisual` を方式別に） | **振る舞いを変えない refactor**。牛肉の挙動・DOM は #697 と同一 | #697 の既存テスト**無修正で通過**。レジストリの整合（全 target が `pieceVisual` を持つ、重複なし）、フラグ独立、gate テスト（本番にクエリ名が無い）、architecture test の走査対象に新ファイルを追加 | **不要**（見た目・操作が変わらない refactor。HV Policy §2）。ただし牛肉の回帰を E2E で確認 | #697 と同じ HOT file を触る（`gameReducer.ts`、`GameScreen.tsx` は触らない見込み）。`CookingPrepLayer.tsx` は 1B で全面改修されており、M1 は**その後でないと書けない** | 既存の全テスト緑、牛肉の E2E 無修正、フラグ OFF で DOM 同一 |
| **Stage 1-A 焼く** | 新規: `src/logic/prep/sear/{judge,look,searReducer}.ts`、`src/components/prep/SearScene.tsx`、`sear.css`、各 test。変更: `cookMethods.ts` に登録、`CookingPrep.css`（`sausage-slices` / `porcini-slice` の上書き）。**`IngredientGlyph.tsx` は触らない**（CSS 上書き） | 新規ファイル中心。HOT は M1 で済んでいる | judge の境界（半開区間、ARM、時間切れ優先、片面だけ）、look 補間、reducer の同一参照規約、Research/Dinner/Lunch Rush で拒否、AC-3 相当（炒め有無で pizza/score/completion/inventory/dex/pitz/journal が同一）、E2E（390×844・360×800） | **必要**（ゲームプレイ変更）。動画 390×844＋前後スクリーンショット（`docs/reports/screenshots/cooking-prep-sear/`）。iPhone 実機は Owner 判定 | ① 牛肉との差が体験で伝わるか（HV-1）。② 20px で焼き色が見分けられるか（ソーセージは元の赤茶に近い）。③ SVG 構造に依存する CSS 上書き。④ 360×800 のピルと生地の間隔 4.2px（#697 から継続） | `?cookPrep=sear` の Preview で HV PASS、本番フラグ OFF、保存/採点不変 |
| **Stage 1-B 茹でる** | 新規: `src/logic/prep/boil/{judge,look,boilReducer}.ts`、`BoilScene.tsx`、`boil.css`、test。変更: `cookMethods.ts`。形の変化に SVG 追加を選ぶ場合のみ `IngredientGlyph.tsx`・`ingredients.ts`（§11.1） | 新規中心。**スワイプ判定**（しきい値・pointer capture）が新規要素 | judge、スワイプのしきい値/キャンセル/タップ代替の同値性、`touch-action`、WebKit シャード、Research 漏洩、reduced motion | **必要**。**iPhone 実機のスワイプ HV が必須**（Safari の端スワイプ・スクロール競合）。動画＋スクリーンショット | ① WebKit でのスワイプ誤作動。② 形の変化を SVG 2 状態にするとカタログ系 PR と競合。③ 茹でる音/湯気はアニメのみ（音なし） | 実機 HV でスワイプ/タップ代替の両方 PASS、誤操作ゼロ、本番 OFF |
| **Stage 2 あめ色炒め** | 前提: 玉ねぎの専用 SVG（`pieceVisual`）。新規: `caramelize/*`、Scene | **玉ねぎは現在 🧅 絵文字のみ**。専用 SVG が無い限り休眠ガードで出ない | 休眠ガードのテスト、judge、look | 必要 | ① 野菜描画の品質改善（別トラック）に依存。② 玉ねぎは約 20 レシピで使われ Lunch Rush 対象も含む。③ “待つ・混ぜる”は他と違う長めの操作で、連続プレイの負担が最大 | 野菜描画が merge 済み、HV PASS |

### 6.3 Stage 2 と野菜描画品質の依存関係

- `canPrepIngredient` は `pieceVisual` を必須としている（休眠ガード）。`onion` は `pieceVisual` が無い（絵文字のみ）ため、**専用 SVG が入るまで あめ色炒めは出せない**。これは意図した安全装置。
- 玉ねぎの“透明 → 薄茶 → あめ色”は、輪切り/くし切りの**断面と繊維**が見えて初めて伝わる。絵文字では不可能。野菜描画（Ingredient Visual 系。V1 #690 が先例）の方針が決まるまで、Stage 2 の設計確定（look の段階数など）は保留が妥当。
- 本調査では野菜描画品質の“Issue/計画”は **見つけていない**（検索で該当なし）。Stage 2 の前提 Issue は新規で必要かもしれない（§11.2）。

---

## 7. 代替案を採らない理由（要約）

- 全食材へのドラッグ/スワイプ統一: iOS のスクロール・端スワイプ競合と、ピース単位の状態が要る（P-4 の境界越え）。依頼の「タップとドラッグを無理に統一しない」に沿い不採用。
- 長押しで茹でる（B3）: iOS の長押し既定動作と競合し、AC-11（長押し不要）に反する。
- 完全データ駆動（C2）: 個性が設定値の外へ漏れ、結局 if 文が戻る。

---

## 8. PR #697 との競合分析

**結論: 現時点で本作業（docs のみ）との競合はない。ただし実装は #697 と同一ファイルに触るため、M1 以降は #697 の Final Gate 完了まで開始を保留する。**

| 観点 | 内容 |
|---|---|
| 本セッションの変更 | `docs/reports/TETO_COOKING-PREP_PHASE2_Fresh-Design.md` の**新規 1 ファイルのみ**。#697 の変更ファイル 50 件のうち docs で触るのは `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_…md` だけで、本セッションは**触らない**。重複なし |
| ファイル重複（M1 以降） | `gameReducer.ts`（HOT）、`prepOffer.ts`、`beefDoneness.ts`、`CookingPrepLayer.tsx`、`CookingPrep.css`、`prepFixtures.ts`、architecture test は #697 と**同一**。`prepIngredients.ts`・`prepExperienceGate.ts` は #697 が触っていないが、M1 で変更すると #697 の 1B 前提（`PREP_EXPERIENCE_PRODUCTION`、`?cookPrep=on`）と整合を取る必要がある |
| Session Operations の claim | #696 の claim が `src/logic/prep/**`、`CookingPrepLayer.tsx`、`CookingPrep.css`、`gameReducer.ts` ほかを 2026-11-05 まで確保。Phase 2 の実装 claim はこれらと重なる（HOT 重複扱い）。実装前に後発側として「#697 が先に merge、本作業が rebase」と明記する必要がある。**本セッションは claim を投稿していない** |
| 設計上の依存 | `preparedLook`（食材 id → 0..1）と `PREP_INGREDIENT.progress` は **#697 の導入物**。本設計はこれを再利用するため、#697 の merge 前に実装すると二重定義になる |
| #697 の未確定事項が Phase 2 に波及 | 実機 HV の結果次第で、時間窓・ピルの位置（360×800 で生地との間隔 4.2px）・結果文言が変わる。Phase 2 の judge/UI は同じ原則（ARM、時間切れ優先、ピル位置）を継承するため、**#697 の HV 結果を反映してから**窓の初期値を決めるのが安全 |
| 他の open PR | #478（`GameScreen.tsx`）と #468（`PizzaStage.tsx`）は #697 でも既存の競合。Phase 2 は `GameScreen.tsx` を触らない見込み（`PizzaStage.tsx` の prop は #697 で追加済み） |

**保留の定義**: #697 の Final Gate（実機 HV の Owner 判定、CI の WebKit 緑、Owner の merge 承認）が完了するまで、M1 の claim 投稿・ブランチ作成・実装を行わない。docs による設計の議論は継続してよい。

---

## 9. 玉ねぎ（Stage 2）の補足

- 玉ねぎは使用レシピが約 20 件と最多で、Lunch Rush 対象レシピも含む。Lunch Rush では調理を出さない（既存方針）ため、**玉ねぎを持つが調理できないラウンドが頻繁に生じる**。体験の不一致として HV で確認。
- 「あめ色」は炒め（stirfry）の延長に見えるが、**長い時間・ときどき混ぜる**という別の動詞。牛肉の“取り出し”を流用すると差が出ない。設計は Stage 1 の HV 結果を見てから。

---

## 10. 画面内の文言（案・未決定）

| 場所 | 案 |
|---|---|
| ピル（焼く） | 「🔥 焼く」は工程タブ「焼く」（BAKE）と衝突する。**「🔥 焼き色をつける」**を推奨。代替「🥩 ソテー」 |
| ピル（茹でる） | 「♨️ 茹でる」 |
| 裏返す | 「ひっくり返す」 |
| 引き上げ | 「引き上げる」 |
| 結果（焼く） | ちょうど「こんがり！」／不足「まだ白っぽい」／焼きすぎ「焦げちゃった…」／片面だけ「裏面もね」 |
| 結果（茹でる） | ちょうど「ぷりっと！」／不足「まだ透けてる」／茹ですぎ「ゆですぎ…」 |

食材・調理法ごとで共通の中立文言とし、レシピ・標的には触れない（Research の漏洩防止）。ミトの台詞は追加しない（Phase 1 P-3 と同じ）。

---

## 11. 未決定事項と Owner 判断事項

### 11.1 Owner に判断してほしいこと

| ID | 判断 | 推奨（助言） | 代替 |
|---|---|---|---|
| **D-1** | 焼くの操作方式 | **A2**（途中で 1 回ひっくり返す→取り出す） | A1（牛肉と同じ。体験が重複）／A3・A4（非推奨） |
| **D-2** | 茹でるの操作方式 | **B2**（スワイプ＋ボタン常設） | B1（ボタンのみ。最も安全） |
| **D-3** | 共通基盤 | **C3**（薄いレジストリ） | C1（現状延長。非推奨） |
| **D-4** | 実装の開始時期 | **#697 の Final Gate 完了後**に M1 から | #697 と並行（非推奨。同一ファイル） |
| **D-5** | Stage 1 の順序 | 焼く→茹でる | 茹でる→焼く（スワイプ HV を先に） |
| **D-6** | 「焼く」のピル文言 | 「🔥 焼き色をつける」（BAKE タブとの衝突回避） | 「🥩 ソテー」／他 |
| **D-7** | エビの“形の変化”の実現 | `transform` の近似（SVG 追加なし。カタログ系 PR と衝突しない） | `shrimp-curl` の 2 状態 SVG を追加（見た目は良いが `ingredients.ts`・`IngredientGlyph.tsx` を触る） |
| **D-8** | 1 食材に複数の調理法を付ける将来（例: 玉ねぎ＝炒め/あめ色） | v1 は **1 食材 1 調理法**。必要になったら選択 UI を別設計 | 最初から選択 UI |
| **D-9** | `?cookPrep=on` の扱い | **牛肉（stirfry）の別名として維持**。新調理法は個別名＋`all` | `on` を全調理法 ON に変更（#697 の HV 手順が変わる） |
| **D-10** | Lunch Rush での扱い | **除外を維持**（ランキング公平性。ソーセージ・玉ねぎは Lunch Rush 対象レシピがあり体験の不一致が出る） | 一部調理法のみ許可（別設計が必要） |
| **D-11** | 時間窓の初期値の決定時期 | #697 の実機 HV 結果を反映してから | 仮値で先に実装 |
| **D-12** | Stage 2 の前提（玉ねぎの専用 SVG/野菜描画） | 別トラックとして先に Issue 化・方針決定 | 玉ねぎは Stage 3 以降に後ろ倒し |

### 11.2 Issue 案（Owner 承認前のため**作成していない**）

**案 1: `Cooking Prep Phase 2: 共通調理法レジストリ（M1）と 焼く／茹でる`（管理 Issue）**
- 目的: #697 の後に、調理法レジストリと 焼く（ソーセージ・ポルチーニ）・茹でる（エビ）を追加する。本番フラグは調理法ごとに既定 OFF。
- 前提: #697 merge（Final Gate 完了）。関連: #696（参照のみ）、#294（上位トラック、参照のみ）。**#611 は別件なので使わない。**
- 範囲: 設計書 `docs/reports/TETO_COOKING-PREP_PHASE2_Fresh-Design.md`。M1 → 1-A → 1-B。
- 守ること: 保存/採点/在庫/Dex/Journal 不変、Lunch Rush/Dinner 除外、PR/merge/共有 Preview/本番フラグは Owner 承認。
- 重複確認: 既存 Issue は #696 のみ（調査済み、重複なし）。

**案 2: `Ingredient Visual: 玉ねぎの専用 SVG（あめ色炒めの前提）`**
- 玉ねぎは現在 🧅 絵文字のみ。Stage 2 の前提。野菜描画品質の方針と合わせて決定。

### 11.3 未解決リスク

| # | リスク | 備考 |
|---|---|---|
| R-1 | 実機 iPhone Safari でのスワイプ（B2）と pointer 挙動が未検証 | 実機 HV が唯一の根拠。ボタン代替があるため進行不能にはならない |
| R-2 | `nth-of-type` による CSS 上書きが SVG 構造に依存して壊れやすい | 食材ごとの契約テストで固定 |
| R-3 | 360×800 でピルと生地の間隔 4.2px（#697 から継続）。新調理法が増えるほど誤タップの機会が増える | Owner 判断 O-8 の延長 |
| R-4 | 20px の配置後ピースで 3 段階（不足/ちょうど/焦げ）が見分けられない可能性（ソーセージは元が赤茶で変化量が小さい） | #697 も同じ未確認事項。HV で判定 |
| R-5 | `cookingTiming`（CT1）に調理画面の時間が入る可能性（§5.9） | 実装前に確認 |
| R-6 | 時間窓の数値は仮値。#697 の HV で牛肉の窓が変われば同じ調整が要る | D-11 |
| R-7 | 172 レシピ資料と Handoff 後半を精読していない（§1.4） | 実装前の Fresh Gate で再確認 |
| R-8 | 調理法が増えると「毎回やるのが面倒」の閾値を超える恐れ（ソーセージ＋ポルチーニ＋エビの組合せ。boscaiola では 2 食材） | 食材単位で 1 ラウンド 1 回、所要 ≤ 8 秒、すべて任意 |

---

## 12. 整合性の確認（docs-only のため実装テストは不要）

| 確認 | 結果 |
|---|---|
| 参照先の存在 | 本書が参照するファイル（`prepIngredients.ts`、`prepExperienceGate.ts`、`prepOffer.ts`、`beefDoneness.ts`、`gameReducer.ts`、`IngredientGlyph.tsx`、`bakeVisual.ts`、`recipes.ts`、Phase 1 仕様書、Session Operations、HV Policy）は main に存在することを `grep`/`Read` で確認。#697 側のファイルは head `8ba2b5b` を `git fetch` して `git show` で確認 |
| #697 の SHA | GitHub API の head = `8ba2b5b901a79255fd396c755c69b1df2ac59f85` で依頼文の SHA と一致 |
| main の SHA | `git fetch origin main` 後 `ffff081c0136df43113a81c170343d24d968ed1f` |
| 設計上の矛盾 | 「#697 の `preparedLook`（0..1 スカラー）に A2 の 2 面を畳む」点は矛盾しない（平均で 1 スカラー化）。「任意で失敗しない」と「焼きすぎ=失敗扱い」は、失敗＝見た目と文言の差のみと定義して整合。「スワイプはエビに限定」と「ドラッグを全食材に一律適用しない」は整合 |
| 本書が仮定している #697 の未 merge 部分 | `preparedLook`、`PREP_INGREDIENT.progress`、`CookingPrepLayer` の全面改修。#697 が merge 前に変更されれば本書の §5 を更新する |
| 規約 | 命名は既存の `TETO_COOKING-PREP_*` / `*_Fresh-Design*` に倣った。日本語の文書体裁は Phase 1 仕様書に合わせた |

---

## 13. Result Report（要約）

| 項目 | 内容 |
|---|---|
| 変更したもの | 本書 1 ファイル（docs のみ） |
| 変更していないもの | `src/`、`e2e/`、CSS、設定、PR #697 のブランチ、共有 Preview/Production、本番フラグ、Issue、PR、claim、Monitor |
| 実行していないこと | 実装、実機、HV、全テスト、WebKit |
| 次の一手 | Owner が §11.1 の D-1〜D-12 に回答。#697 の Final Gate 完了後、最新 main から M1 の claim と実装承認（O-2 と同形）を求める |
