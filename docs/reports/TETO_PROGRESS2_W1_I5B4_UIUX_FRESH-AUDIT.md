# Progression 2.0 W1 I5b-4: UI/UX Fresh Audit（STOP GATE）

- 種別: Fresh Audit と Fresh Design のみ。`src/**`、`e2e/**`、CSS は変更していない。UI 実装、PR、merge もしていない。
- 監査対象: 最新 `main` `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（Merge PR #228、I5a）。fresh fetch して確認した。
- 並行作業: I5b-3 Production Integration は別セッションで進行中。その branch には触れていない。I5b-3 の差分は読んでいないので、本監査は `main` の状態だけを基準にする。
- 参照した authority:
  - `docs/reports/TETO_PROGRESS2_W1_I4B_Fresh-Audit.md`（A2 / EP1 chain との衝突）
  - `docs/reports/TETO_PROGRESS2_W1_I5A_Result.md`
  - `src/data/discoveryLadder.ts`（OD-REC04-1）
  - PR #220 / #221（W1 content authority。どちらも OPEN で未 merge。読むだけにした）
- 証拠: Chromium（Playwright、dev server）で実測した。screenshot は `docs/reports/screenshots/progression2-w1-i5b4-fresh-audit/` にある。計測用の script は scratch に置き、repo には入れていない。

## 0. 計測条件

`390×844` と `360×800` は端末の画面サイズで、ブラウザの**表示領域**ではない。iPhone Safari でツールバーを出していると、`innerHeight` は約 664〜750 になる。そのため、次の条件でも計測した。

| 条件 | 意味 |
|---|---|
| 390×844 / 360×800 | 既存の e2e と同じ条件 |
| 390×750 / 360×720 | ツールバーが縮んだときの表示領域 |
| 390×664 / 360×640 | ツールバーを出したときの表示領域（最悪値） |
| `-inset` | 実機の safe-area をまねた条件。header に +47px、下部 bar に +34px を CSS で注入した |

WebKit は、この sandbox では起動できない（`/opt/pw-browsers` に Chromium しかない）。

---

## 1. HOME: fresh save の CTA

### 現状（`src/screens/HomeScreen.tsx:113-167`、`src/App.css:3378-3432`）

| 状態 | DOM の順番 | 実測（390×844） |
|---|---|---|
| Dex 0（`lunchRushLocked`） | `🎨 フリークッキングで探す`（primary、`.cta-button--home`）/ `🍕 ピザを作る`（secondary）/ `⏱ ランチラッシュ`（disabled）/ hint | **3つとも y=307 の1行**。122 / 110 / 110 × **87px**。360×800 では 112 / 100 / 100 × **108px** |
| Dex ≥ 1 | `ピザを作る` / `ランチラッシュ` / `フリークッキング`（`.cta-button--free-cook`） | 181×54 と 169×54 が1行目、358×48 が2行目 |

### root cause

- fresh save の分岐では、フリークッキングのボタンに `.cta-button--free-cook`（`flex: 1 1 100%`）が付かず、`.cta-button--home`（`flex: 1`）が付く。
- そのため、3つのボタンが `flex: 1` で1行に並ぶ。
- 幅は約 110px しかないので、ラベルが2〜4行に折り返し、高さが 87〜108px になる。
- `border-radius: 999px` なので、背の高い pill が**円**に見える。「フリー / クッキン / グで探す」は、この狭い幅の中で折り返したもの。
- 発見の前後で、DOM の順番（フリークッキングが先頭か末尾か）と骨格（3列か 2+1 か）の両方が入れ替わる。そのため CTA の位置がジャンプする。

### 「ピザを作る」を 0 recipe で押したとき（現状）

HOME → Pizza Select に移る。表示は次のとおり。

- Margherita だけが `NEW + preDiscoveryLocked`（「🎨 フリークッキングで発見しよう」）。詳細の CTA は「フリークッキングで探す」で、Free Cooking に戻る。
- 残りの14件はすべて LOCKED で、EP1 chain の解放条件が出る（§2）。

行き止まりではない。ただし、同じ目的地（Free Cooking）へ2タップ遠回りになる。さらに、ladder と矛盾する解放条件を14件見せてしまう。

### Fresh Design（推奨）

```
Dex 0                                     Dex ≥ 1（今と同じ）
[ 🍕 ピザを作る ][ 🔒 ランチラッシュ ]      [ 🍕 ピザを作る ][ ⏱ ランチラッシュ ]
[ 🎨 フリークッキング  ← primary ]         [ 🎨 フリークッキング ]
  🔒 まず1枚ピザを発見しよう
```

- 骨格は、発見の前後で同じ 2+1 にする。DOM の順番も同じにする。変えるのはクラスだけ。
- Dex 0 では、フリークッキングだけを primary（橙のグラデーション）にする。ラベルは「🎨 フリークッキング」のまま変えない（「で探す」は吹き出しの文言が担う）。
- 「ピザを作る」は secondary のまま enabled にする。#198 の「HOME → Pizza Select は常に到達可能」という契約を守る。
- ランチラッシュは今と同じく disabled にする。ラベルの先頭に 🔒 を付けてもよい。理由の1行は残す。
- 実装はクラスの切り替えだけで済む（CSS の `flex` 規則は既存の `.cta-button--free-cook` を流用する）。

**Owner Decision（OD-UX-1）:** Dex 0 での「ピザを作る」を、(a) enabled のままにする（推奨。#198 の契約に沿う）か、(b) locked の見た目にして、押したら Free Cooking へ誘導する toast を出すか。

---

## 2. Pizza Select と progression の authority

### 2.1 いま同時に存在する authority（`main` 12a09de）

| # | authority | 実装 | 何を決めるか | 状態 |
|---|---|---|---|---|
| 1 | **EP1 recipe chain** | `Recipe.unlockCondition`（旧15件、Margherita 以外の14件）、`recipeUnlocked()` | 未発見 recipe の LOCKED / 解放、LOCKED カードの解放条件表示 | 有効。I4b では**意図して残した**（I4b Fresh Audit §5-1「EP1 chain の撤去は product 判断なので I4b では撤去しない」） |
| 2 | **A2（発見済み ⇒ unlocked）** | `recipeUnlocked()` の先頭（I4b-3） | 発見済み recipe の作り直しと Lunch Rush の出題候補 | 有効。chain より優先する |
| 3 | **Discovery Ladder**（OD-REC04-1） | `SHIPPED_15_DISCOVERY_LADDER`（14 step） | 材料の Shop 入荷（発見数 ≥ step）。⭐ は条件にしない | 有効 |
| 4 | **Material ownership / stock** | `ownedIngredientIds`、`inventory`、Stock Gate | `isRecipeAvailable` の2つ目の軸（必要な材料を全部持っているか） | 有効 |
| 5 | **Free Cooking discovery** | `resolveFreeCookPizza` と matcher | recipe の発見。**EP1 を見ない** | 有効 |
| 6 | **Recipe-first discovery** | Pizza Select の NEW カード → guided round → `REGISTER_TO_DEX` | 解放済みで未発見の recipe を、見本を見ながら作って発見する | 有効（Dex ≥ 1 のとき） |
| 7 | **W1 の10 recipe** | PR #220 / #221（OPEN）。`main` にはまだ無い | 25 recipe の population。ladder は 24 step の fixture（`REC04_W1_25_LADDER_FIXTURE`、テスト用） | 未統合（I5b-3 の対象） |

### 2.2 衝突（**あり**）

**C1. 表示している解放条件と、実際の進み方が違う（P1）**

実測（390×844、Dex = Margherita のみ）:

| カード | 表示 | 実際の最短経路 |
|---|---|---|
| ビスマルク | 「マリナーラを1枚完成させると解禁」 | ladder の step 1 で egg が入荷 → Free Cooking で発見できる（マリナーラは不要） |
| マリナーラ | 「フンギを1枚完成させると解禁」 | garlic は ladder の step 8。フンギを作っても、garlic が無いので作れない |
| ジェノベーゼ | 「ビスマルクを1枚完成させると解禁」 | pesto は step 13 |
| クアトロ フォルマッジ | 「ジェノベーゼを1枚完成させると解禁」 | 3種のチーズは step 14 |
| フンギ | **何も表示しない**（chain は満たしているが、mushroom を持っていない。`unlockHint` = null） | mushroom は step 3 |
| ？？？（フガッサ） | 「あと★9で解禁」 | ⭐ は材料解放の条件ではない（OD-REC04-1）。ladder は step 10 |

- Human Review で見つかった文言は、`unlockHintFor()`（`src/state/pizzaSelect.ts:29-48`）が EP1 の `requiresRecipeId` から組み立てたもの。
- 報告にあった「マリナーラ:『ランチを1枚…』」は、コードでは再現しない。実際の表示は「**フンギ**を1枚完成させると解禁」。

**C2. ladder の順番と EP1 chain の順番が別になっている**

- ladder の順番: bismarck → breakfast → funghi → pepperoni → salsiccia → meat-lovers → capricciosa → marinara → …
- EP1 chain の順番: margherita → funghi → marinara → bismarck → genovese → …

A2 のおかげで詰みはない。ただし、プレイヤーに見える「次にやること」が2つの系統に分かれている。

**C3. W1 の新しい recipe（`unlockCondition` なし）を入れたとき**

`recipeUnlocked()` は、`unlockCondition` が無い recipe を常に true にする（`progression.ts:60`）。そのため W1 の10件は次のように振る舞う。

- 材料が揃う前: LOCKED になる。`unlockHint` は null なので、名前と🔒だけが出て、理由は出ない。
- 材料が揃った後（ladder で入荷 → 購入）: **NEW カード（名前 + 完成見本のサムネイル + 「このピザを作る！」）** になる。つまり、Free Cooking で発見する前に、答え（材料構成）を見せてしまう。

旧15件は、EP1 chain が「見せない」側の門番になっている。W1 の10件にはそれが無いので、旧15件より W1 のほうが答えが漏れやすいという逆転が起きる。

**C4. NEW カードは答えを表示している**

NEW（解放済みで未発見）のカードには、`PizzaThumbnail` で完成品の見本がそのまま出る（`PizzaSelectScreen.tsx:113`、`:183`）。発見中心の UX（Progression 2.0）と、見本を見て作る guided の UX（EP1）が、同じカードに混ざっている。

### 2.3 共存の現状（正確な記述）

> 旧15件の EP1 chain は、**未発見の recipe を「Pizza Select から guided で作る」経路の門番**としてだけ生きている。発見そのもの（Free Cooking）、材料の入荷（ladder）、作り直し（A2）、Lunch Rush の出題候補（A2）は、EP1 を見ない。見え方の衝突は、EP1 の門番としての文言（「○○を1枚完成させると解禁」「あと★N」）を、ladder の世界でも LOCKED の理由としてそのまま表示していることから起きている。

EP1 を削除するかどうかは、ここでは判断しない（下の OD-PS-1）。

### 2.4 Fresh Design: カードの4状態

| 状態 | 定義（派生だけで決める。保存する状態は増やさない） | 名前 | 見た目 | 状態の行 | タップしたとき |
|---|---|---|---|---|---|
| **DISCOVERED** | Dex で発見済み | 表示 | 完成サムネイル、★、BEST | ★ / BEST | 詳細 →「このピザを作る！」 |
| **READY（解放済み・未発見）** | 必要な材料を全部持っていて、未発見 | 表示（OD-PS-2） | **シルエット**（生地の円 + 「？」。材料は描かない） | 「🎨 材料はそろってるよ！フリークッキングで見つけよう」 | 詳細 → primary は「フリークッキングで探す」。guided の「このピザを作る」は OD-PS-2 による |
| **LOCKED（材料待ち）** | 材料が足りない（ladder 未到達、または未購入） | 表示（OD-PS-3） | 🔒 | 材料の軸で出す: 入荷済みで未購入なら「🏪 ショップに新しい材料があるよ」、未入荷なら「あとN種発見で新しい材料が入荷」 | 詳細（CTA は disabled） |
| **UNKNOWN（？？？）** | ladder で、次の2 step より先にある | 「？？？」 | 🔒 | 「もっと発見すると現れるよ」 | 詳細（CTA は disabled） |

「？？？」の情報開示レベル（弱い順）:

| L | 見せるもの | 使う場面 |
|---|---|---|
| L0 | 「？？？」とカードの枠だけ | UNKNOWN |
| L1 | 名前 | LOCKED（材料待ち） |
| L2 | 名前と、入荷 / 購入に必要なこと（材料名は出さない） | LOCKED |
| L3 | 使う材料の**一部**（例: 「🥚を使うよ」） | READY のヒント（§6 の Level 3 と同じ） |
| L4 | 完成見本（全部の材料と配置） | **DISCOVERED だけ**（推奨） |

**文言の authority:** LOCKED の理由は「材料の軸（ladder と所持状況）」だけから作る。EP1 の `requiresRecipeId` と `minTotalStars` は、Pizza Select の文言に使わない。EP1 のデータは残したまま、表示から外すだけにする。これで OD-PS-1 を先送りしても、UX を ladder に揃えられる。

### 2.5 25 recipe になったとき

| 項目 | 現状 | 25件での予測 | 推奨 |
|---|---|---|---|
| 2列のカード | 1枚が 168px 以上、列の間は 10px | 13行。body は約 2,400px（15件で `scrollHeight` 1508 / `clientHeight` 788） | 2列のまま。カードの高さを 140px 前後に詰める余地がある |
| 章の分け方 | `RECIPE_SECTION_BOUNDARIES` = 0 / 7、それ以降は8件ずつ（`FALLBACK_CHUNK_SIZE`） | **7 / 8 / 8 / 2**。第4章が2件だけになる | 章は位置で機械的に決めない。「W1 = 第3章（10件）」と authored boundary を足して **7 / 8 / 10** にする。または ladder / 発見の順で並べる（OD-PS-4） |
| 長い名前 | 14px、`line-height 1.2`。折り返しは許しているが、省略記号にはしない | 「ニューヘイブン・アピッツァ」「ピッツァ・ポルトゥゲーザ」「トンノ・エ・チポッラ」は、155〜170px のカードでは2行になる | 最大2行 + `line-clamp`。中黒の位置で改行できるように `word-break: keep-all` と `<wbr>` を使う |
| スクロール | `.pizza-select-body` の中だけがスクロールし、header は固定 | 13行 | 上部に章へ飛ぶ chip（第1章 / 第2章 / W1）か、「発見 N/25」の sticky 見出し。NEW / READY を先頭にするフィルタは Future |

**Owner Decisions**

- **OD-PS-1:** 旧15件の EP1 chain（`unlockCondition`）を、(a) データごと撤去する、(b) データは残して表示と gate から外す（推奨）、(c) 今のまま残す。
- **OD-PS-2:** READY（解放済み・未発見）のカードから、guided で作れるようにするか。(a) Free Cooking だけ（推奨。答えを見せない）、(b) guided も可、(c) 何回か Free Cooking で失敗したら guided を解放する。
- **OD-PS-3:** LOCKED で名前を見せるか（L1）、UNKNOWN にするか（L0）。推奨は、ladder の「次の2 step」までを L1、それより先を L0。
- **OD-PS-4:** 25件の並べ方。authored の章（旧7 / 旧8 / W1 10）か、ladder 順か。

---

## 3. Cooking 画面の viewport（BAKE）

### 実測（Chromium、margherita の guided round）

| 条件 | 取り出す！の下端 | `.game-screen` の scroll | 判定 |
|---|---|---|---|
| 390×844 | 755 | 844 / 844 | 収まる |
| 360×800 | 728 | 800 / 800 | 収まる |
| 390×664 / 360×640 | 631 / 607 | 収まる | 収まる（dvh の縮小が効いている） |
| **Lunch Rush、すべての条件** | 820（844）、648（664）など | **sh が ch より 8px 大きい**（672 / 664 など） | **はみ出す**。`MissionHud`（33px + 8px）が reserve に入っていない |
| **390×664-inset** | 654 | 678 / 664 | **はみ出す**。CTA は下端から 10px しか離れていない |
| 390×664-inset（screenshot） | — | — | 3行になった Teto の吹き出しが、工程タブに重なっている |

### root cause

1. `.pizza-stage--roomy .pizza-dough` の縮小式 `calc(100dvh - 430px)` は、次の要素の高さを**固定値**で見込んでいる: header 56、tabs 44、dialogue 108、bake-overlay 209。
   - safe-area（`env(safe-area-inset-*)`）を含まない。
   - Lunch Rush の HUD（41px）を含まない。
   - 吹き出しが3行以上に折り返した場合（実機のフォント、長い recipe 名）を含まない。
2. 「取り出す！」は in-flow の `.bake-overlay` の中にある。上の要素が伸びると、画面外に押し出される。PREPARE の「焼く！」（`position: fixed`）とは位置も仕組みも違う。
3. BAKE では、ほかの工程で一番大きい pizza（roomy: `min(92vw, 380px)`）と、一番大きい dialogue（portrait つきの `DialogueBox`、108px）を使う。さらに、Teto が2回出る（吹き出しとオーブンの caption）。
4. 工程タブは、PREPARE では y=56 にあるが、BAKE では dialogue の下（y=164）に移る。工程が変わるたびにタブの位置がジャンプする。

BAKE は時間制限つきの判断なので、CTA のためにスクロールが必要になると、焼きすぎに直結する。

### 対策の比較

| 案 | 効果 | 副作用 | 評価 |
|---|---|---|---|
| a. pizza を一律に小さくする | 確実 | BAKE の見どころ（焼き色）が弱くなる | 単独では非推奨 |
| b. 工程ごとに stage の高さを変え、reserve を正しくする（HUD と inset を入れる） | 今の式の延長で済む | 固定値の見込みが残る | 採用（補助） |
| c. vertical spacing を詰める（overlay の padding-bottom 24 と gap 14、炎の 40px） | 約 30px | 小さい | 採用 |
| d. dialogue を詰める（BAKE の portrait DialogueBox を、PREPARE と同じ1行の `.order-card` 型にする） | **約 64px**、Teto の重複も解消 | 文言を短くする必要がある | **採用（主）** |
| e. CTA を fixed / sticky にする（「取り出す！」を `.prepare-bake-bar` と同じ位置の fixed bar に置く） | 画面の高さに関係なく必ず見える。「焼く！」と同じ位置なので指が覚えやすい | stage 側に reserve が必要 | **採用（主）** |
| f. safe area を式に入れる（`- env(safe-area-inset-top) - env(safe-area-inset-bottom)`） | PWA と Safari の差を吸収する | なし | 採用 |

推奨は e + d + f で、b と c で微調整する。工程タブは全工程で header の直下に固定し、BAKE でも移動させない。

要件（I5b-5 で確認）:

- 最小の表示領域は 360×640（ツールバーあり）。この条件で、pizza 全体、焼き加減（ゲージか caption）、「取り出す！」がスクロールなしで見えて、押せること。
- 390×844 と 390×664 も同じ条件で確認する。
- Lunch Rush でも同じ条件を満たすこと。

---

## 4. 材料 pager と下部 CTA の重なり

### 再現（Chromium）

| 条件 | pager（上〜下） | bar の上端 | 余白 |
|---|---|---|---|
| 390×844 | 615–643 | 774 | 131 |
| 390×664 | 550–578 | 594 | 16 |
| 390×664 で**ヒントを押した後**（order-card が 44 → 59px） | 565–593 | 594 | **1**（bar のグラデーションと重なる） |
| 360×640 でヒントを押した後 | 541–569 | 570 | **1** |
| **390×664-inset でヒントを押した後** | 612–640 | **560** | **−80（2段目の chip と pager が bar の下に隠れる）**（screenshot） |
| **360×640-inset** | 588–616 | **536** | **−80** |

### root cause

1. `.prepare-bake-bar` は `position: fixed` で、レイアウトの流れの外にある。重ならないことは、固定値 `calc(100dvh - 439px)` の見込みだけに頼っている。
2. その 439px の中の「ingredient-panel 175px（最悪のカテゴリ）」は、**pager が出ない前提**で測った値。`IngredientTray.tsx:150-154` のコメントにも「pager は防御用で、出荷中の recipe では出ない」と書いてある。
   - P3-2 の Free Cooking は、所持している全材料を6件ずつ表示する。このため、pager が普通に出るようになった（具材15種で3ページ、W1 の後は22種で4ページ）。
   - 実際の高さは tray 162 + pager 34 = **196px**。見込みより 21px 足りない。
3. 次の3つも見込みに入っていない。
   - safe-area（下部の bar は `env(safe-area-inset-bottom)` の分だけ伸びるが、dough の縮小式はそれを引かない）
   - ヒントを押したときに order-card が 1行から2行になる分（+15px）
4. `hasMoreBelow` のスクロール cue は、「panel の終わりが見えるか」だけを見ている。pager が bar に**部分的に**隠れている状態は検出できない。

### Fresh Design: 重ならないことを構造で保証する

```
.game-screen (flex column, height = 100dvh)
 ├ header / tabs / order-card          flex: none
 ├ .pizza-stage                        flex: 1 1 auto; min-height: 0   ← 余った高さだけを使う
 │   dough = min(76vw, 290px, その box の高さ)   （container query で決める）
 ├ ingredient list (3×2)               flex: none
 ├ pager                               flex: none（1ページだけのときも高さを確保する）
 ├ spacing 8px                         flex: none
 └ CTA bar                             flex: none、in-flow（fixed をやめる）
                                       padding-bottom: env(safe-area-inset-bottom)
```

- CTA bar を in-flow に戻し、pizza stage を「余りの高さ」を使う唯一の要素にする。そうすれば list → pager → 余白 → CTA の順番が、どの高さでも flex の仕組みで保証される。固定値の reserve は要らなくなる。
- dough の大きさは、container query（`cqh`）か、`ResizeObserver` で測った高さで決める。gesture の計算は、もともと `getBoundingClientRect()` を読んでいるので影響しない。
- pager の場所は、材料の数に関係なく常に確保する。1ページだけのときは `visibility: hidden` にする。こうすると、材料が増えてもレイアウトが動かない。
- 材料が増えたとき（W1 の後に具材22種、4ページ）: 1ページ6件のまま。pager に「◀ 2 / 4 ▶」とカテゴリ内の総数を出す。見つけにくさは §6 のヒント（「新しく入荷した材料」）で補う。NEW の材料を1ページ目の先頭に並べるのは、I6 で検討する。
- 360×800 と 390×844 の両方で、ツールバーありの 360×640 / 390×664 と inset を足した条件でも、重なりが0になることを e2e で確認する。

---

## 5. ソーセージの見た目

### 今の pieceVisual の仕組み

- `IngredientGlyph`: `pieceVisual` があれば専用の SVG（viewBox 32、`1em`）、無ければ emoji。piece、tray、thumbnail、Shop、Dex、RESULT のすべてがこの1か所を通る。
- 専用の SVG は3件ある: `tomato-slice`、`caper-cluster`、`clam-valve`（W1 の Human Visual Gate を通ったもの）。
- ソーセージは `emoji: 🌭`、`pieceVisual` なし。パンに挟んだ形なので、ホットドッグに見える（screenshot `390x844-14`）。
- 周りの材料: ペパロニは 🔴（赤い円）、ベーコンは 🥓、ハムは 🍖（骨付き肉。これも改善候補）。

### 比較

| 案 | tray | pizza の上 | 小さいサムネイル | ペパロニとの区別 | ベーコンとの区別 | 評価 |
|---|---|---|---|---|---|---|
| A. 短いソーセージを1本 | ◎（形がはっきりしている） | ○（向きを散らすと自然） | ◎（細長い形は 12px でも読める） | ◎（円ではない） | ○（ベーコンは波打った帯） | **推奨** |
| B. 輪切り1枚 | △ | △ | ✕ | **✕（赤茶の円板はペパロニ 🔴 やサラミと見分けにくい。tomato-slice の設計メモで、候補 A が同じ理由で不採用になっている）** | ○ | 非推奨 |
| C. 輪切りを数枚 | ○ | ✕（ピザの上で散らばって、ペパロニの群れに見える） | ✕（1em の中では点の集まりになる） | ✕ | ○ | 非推奨 |

### 推奨: A の変形「short link（短い1本、パンなし）」

- 形: 少し曲がった短い円柱。両端を丸めて、片方にくびれ（結び目）を付ける。長さと幅の比は約 2.2:1。
- 色: 焼けた茶色（`#8b4a3f` の既存 color に合わせる）。上に白っぽいハイライトを1本入れて皮のつやを出す。焼き目を2本入れる（任意）。
- 片方の端に小さな楕円の断面（薄いピンク）を入れてもよい。これは任意で、輪切りの円板には**しない**。
- 実装は `DedicatedIngredientVisual` に `sausage-link` を足すだけ。`id`、`nameJa`、save への影響はない。W1 の Visual Gate と同じく、Human Visual Gate（tray / pizza / thumbnail の3つの場面と、ペパロニ・ベーコン・ハムと並べた比較）を通してから入れる。
- 同じ仕組みで、ハム（🍖）も後で直せる（Future）。

---

## 6. ヒントの UX

### 今の実装（`src/data/hints.ts`、`gameReducer.ts` の `SHOW_HINT`）

- ヒントの本文は、**押さなくても** order-card の2行目に常に出ている（`state.hint`）。ヒントボタンは `isExplicitHint = true` で作り直すだけ。
- guided（recipe を選んで作る場合）:
  - `RECIPE_HINTS` に文言があるのは15件中**6件だけ**（margherita / marinara / quattro-formaggi / genovese / bismarck / funghi）。残りの9件は汎用の文言（「○○をのせてみよう！」「いい感じ！『焼く！』を押してみよう。」）。
  - 詳しい版（explicit）があるのは、「ソースがまだ」の状態と生地だけ。**不足材料がある状態と、準備完了の状態では、押しても文言が変わらない**。実測では、チーズの工程で押す前と押した後がまったく同じだった。
  - 見ているのは「最初に足りない1つの材料」だけ。量、配置、焼き加減、CUT は見ていない。BAKE と CUT の間はヒントボタンが無い。
- Free Cooking:
  - Dex 0 のとき: 失敗した回数（`preDiscoveryFreeCookAttempts`）に応じて、Level 1〜3 に上がる。これはボタンではなく、回数で上がる。Level 3 は Margherita の答えを全部言う（onboarding なので許容範囲）。
  - Dex ≥ 1 のとき: 工程の操作説明だけ（「持っている材料なら何でものせられるよ…」）。発見の方向、新しく入荷した材料、未発見の数は、どれも言わない。**発見の支援としてはほぼ機能していない。**
  - 詳しい版の文言は長く、order-card を2行にする。これが §4 の重なりを悪化させる。

### 3案の比較

| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| 削除 | ボタンを外し、常に出ている行だけにする | CTA bar が空く（§4 に効く） | 発見の支援が無くなる。Free Cooking の手がかりが0になる |
| 改善（段階式） | 押すたびに Level 1 → 2 → 3 に上がる。mode ごとに文言の系統を変える | 本来の目的に合う | 文言を作る量が増える |
| **contextual（推奨）** | 状況から一番役に立つ1行を選ぶ。ボタンは「もう少し教えて」で1段上げる。どの Level まで開示したかを round ごとに持つ（保存しない） | 押す意味が常にある。答えをすぐには言わない | 選ぶ規則を1か所にまとめる必要がある |

### Fresh Design

**FREE COOKING（目的 = 発見の支援）。** 対象は、今の所持材料で作れる未発見の recipe（READY）。1件も無ければ、「ショップで材料を買う」方向へ誘導する。

| Level | 出すもの | 例 |
|---|---|---|
| 0（常に出す行） | 工程の操作（今の文言を短くしたもの） | 「好きな具をのせて『焼く！』」 |
| 1 | 探索の方向だけ | 「まだ見つけていないピザが、今の材料で **2つ** 作れるよ！」 |
| 2 | 新しく入荷 / 購入した材料 | 「新しく入荷した **たまご** を使ってみよう！」（`lastMaterialUnlockNotice` と、最近の購入から作る） |
| 3 | 使う材料の**一部**（全部は言わない。ソースとチーズは言わない） | 「🥚 と 🧀 を使うピザがあるよ」 |
| — | 答え（全部の材料と配置） | **出さない**。Dex 0 の onboarding の Level 3 だけを例外にする |

READY が0件のときは、「ショップに新しい材料が入荷しているよ」、または「あとN種発見すると新しい材料が入荷」と出す。

**GUIDED / 発見済みの recipe（目的 = 作り方の支援）**

| Level | 出すもの |
|---|---|
| 0 | 次にやること（今の `buildHintLine` を、15件すべてに広げる） |
| 1 | 足りない要素を具体的に（「バジルがあと2枚」「ソースがふちまで届いていないよ」。量は Completion Gate の数値から作る） |
| 2 | 見本を開く（`mini-reference` の popover を開く。新しい UI は作らない） |
| BAKE | 焼き加減の目安（Guide が消えた後でも、recipe の焼き窓を言葉で言う。数値は出さない） |

原則:

- 1回押すと1段だけ上がる。上限の Level に達したら、ボタンを「見本を見る」に変える。
- ヒントの本文は order-card の中で1行に収める。長い説明は popover に分ける（§4 の高さを守る）。
- 文言を選ぶ規則は `hints.ts` の1関数にまとめる（今と同じ SSOT）。

---

## 7. 工程タブ

### 今の状態（`STEP_LABEL`、`MakingStepTabs`）

- 6タブ: 生地 / ソース / チーズ / 具材 / 焼く / カット（CUT は15件すべてが対象）。
- 1タブの幅: 390px で 62px、360px で 57px（「焼く」だけ 45px / 41px）。11px、`nowrap`、`ellipsis`。
- 完了した工程には「✓ 」が付く（「✓ チーズ」は約 50px）。

### 「カット」→「切る」

ほかのタブは和語で、動作を表すもの（焼く）と名詞（生地、具材）が混ざっている。「焼く」と「切る」が揃い、2文字なので幅も 11px 分ほど減る。**推奨: 「切る」に変える。** CUT の画面の中の文言（「ピザを6等分に切ろう！」「切り終わる」）とも揃う。RESULT の Timing Detail も同じ `STEP_LABEL` を使うので、1か所の変更で済む。

### 何タブまで耐えられるか（padding 左右 10 + gap 3 で計算）

| タブ数 | 360px の1タブ | 390px の1タブ | 判定 |
|---|---|---|---|
| 6 | 57 | 62 | OK（「✓ チーズ」が約 50px） |
| 7 | 46 | 51 | **360px で「✓ ソース」「✓ チーズ」が省略記号になる**。「折りたたみ」（5文字）は入らない |
| 8 | 40 | 44 | NG |

### 将来の工程（今回は実装しない）

| 候補 | タブの扱いの提案 |
|---|---|
| olive oil（仕上げのオイル） | 新しいタブにしない。SAUCE か、「仕上げ」工程の中の材料にする |
| no sauce | タブを消さず、ソースのタブの中で「なし」を選べるようにする（今の Free Cooking と同じ） |
| late topping（焼いた後にのせる） | 「仕上げ」タブを1つ足す（CUT の前）。CUT と合わせて最大7タブ |
| special shape（calzone など） | 「生地」タブの中の変形として扱う。FOLD / SEAL は、その recipe だけのタブにする |
| special cut / no cut | 「切る」タブを、その recipe では出さない（今の `postSteps` と同じ） |

推奨する規則:

- 1つの round で表示するタブは、最大6（例外として7）。
- 7つ目が要るときは、完了した工程をアイコン（✓ と絵文字）だけの幅に縮める。あるいは「前の工程をまとめて ✓」にする（I6 で設計する）。
- 横スクロールするタブは使わない。gesture がぶつかるため（Issue #86 と同じ理由）。

---

## 8. 360×800 と 390×844 のリスク

### 360×800（表示領域は最小で約 360×640）

- HOME の fresh save: CTA が 108px の高さの円になる（§1）。
- BAKE: Lunch Rush で 8px はみ出す。inset があると CTA は下端ぎりぎり（§3）。
- Free Cooking: ヒントを押した後に、pager と bar の余白が 1px になる。inset があると重なる（§4）。
- 工程タブ: 7タブ目を足すと省略記号になる（§7）。
- Pizza Select: 長い名前は2行になる。25件では第4章が2件になる。

### 390×844（表示領域は約 390×664〜750）

- 同じ構造のリスクがあり、実測ではどれも 360 と同じ位置で起きる（390×664 の BAKE-inset: CTA の下端 654 / 664、sh は 678）。
- 既存の e2e は、844 / 800 の**画面の高さ**でしか測っていない。ツールバーありの高さは、CI の対象外。

---

## 9. 優先度と振り分け

| ID | finding | 優先度 | 振り分け |
|---|---|---|---|
| F-3 | BAKE の CTA が表示領域の外に出ることがある（時間制限つき）。Lunch Rush で 8px のはみ出しを再現 | **P0**（実機）/ P1（Chromium） | **I5b-4 で直す** |
| F-4 | Free Cooking の pager が下部 CTA と重なる（ヒント + inset で再現）。材料が増えると悪化する | **P0**（W1 の材料が入荷すると確実に起きる） | **I5b-4 で直す** |
| F-1 | fresh save で HOME の CTA が円になり、位置がジャンプする | P1 | **I5b-4 で直す** |
| F-2a | Pizza Select の LOCKED の文言が ladder と矛盾する（EP1 の文言、フンギは理由なし） | P1 | **I5b-4 で直す**（文言を材料の軸だけに変える。OD-PS-1 は待たない） |
| F-2b | W1 の recipe が、材料が揃った時点で NEW として答えを見せる（C3 / C4） | P1 | I5b-3 と同じ時期に決める必要がある（OD-PS-2）。表示は **I5b-4** |
| F-6a | Free Cooking のヒントが発見の支援になっていない | P1 | 設計は I5b-4、実装は **I6** |
| F-6b | guided のヒントボタンを押しても変わらないことが多い。文言は6/15件だけ | P2 | I6 |
| F-7a | 「カット」→「切る」 | P2 | **I5b-4**（1行の変更） |
| F-3b | BAKE で工程タブの位置がジャンプする。Teto が2回出る。吹き出しがタブに重なる | P2 | I5b-4（F-3 と同時に直す） |
| F-2c | 25件の章が 7/8/8/2 になる。長い名前 | P2 | I5b-3 か I5b-4（authored boundary を1行足す） |
| F-5 | ソーセージがホットドッグに見える | P2 | Visual Gate を通してから I6。ハム 🍖 は Post-W1 |
| F-7b | 7タブ以上の規則 | Future | Post-W1 |
| F-2d | Pizza Select の章ジャンプ、フィルタ | Future | Post-W1 |
| V-1 | e2e の viewport を、表示領域（390×664 / 360×640）と inset で測るようにする | P1（検証） | **I5b-5** |

## 10. I5b-4 の推奨 scope

1. HOME を 2+1 の骨格に揃える（§1、クラスの切り替えだけ）。
2. Cooking のレイアウト契約（§3 と §4 を1つの slice にまとめる）:
   - CTA bar を in-flow にする。BAKE の「取り出す！」も同じ bar に置く。
   - stage を余りの高さに合わせる。
   - pager の場所を常に確保する。
   - safe-area と HUD を扱う。
   - BAKE の dialogue を1行にする。
3. Pizza Select の文言を材料の軸に揃える（F-2a）。W1 の READY / LOCKED / UNKNOWN の表示（F-2b。OD-PS-2 / OD-PS-3 の決定を待つ）。
4. 「カット」→「切る」。
5. 25件の章 boundary（I5b-3 側で入れていなければ）。

scope 外: ヒントの実装（I6）、ソーセージの SVG（Visual Gate → I6）、新しい cooking mechanics。

## 11. I5b-5 の検証 scope

- e2e の viewport を増やす: 390×844、360×800、**390×664、360×640**、それぞれ inset（CSS で注入）あり。
- 確認する assertion:
  - pager の下端 + 8px ≤ CTA bar の上端（Free Cooking。材料 15 / 22 種、ヒントを押す前と後）
  - BAKE の「取り出す！」が表示領域の中にある
  - `.game-screen` の `scrollHeight` ≤ `clientHeight`（FREE と Lunch Rush）
- HOME: Dex 0 と Dex 1 で、CTA の box が同じ位置にあり、`height` ≤ 54px であること。
- Pizza Select: EP1 の文言（「○○を1枚完成させると解禁」「あと★」）が0件であること。W1 の未発見 recipe で、完成見本が表示されないこと。
- WebKit（CI）: 同じ viewport を追加する。
- Human Verification（390×844 の動画はユーザーに直接渡す）: fresh save → 最初の発見 → HOME の比較、BAKE（FREE と Lunch Rush）、Free Cooking で4ページ（W1 の後）とヒント、Pizza Select の4状態。

## 12. Owner Decisions

| ID | 問い | 推奨 |
|---|---|---|
| OD-UX-1 | Dex 0 で「ピザを作る」を enabled のままにするか | enabled の secondary |
| OD-PS-1 | 旧15件の EP1 chain を撤去するか | データは残し、表示から外す（b） |
| OD-PS-2 | READY（解放済み・未発見）を guided で作れるようにするか | Free Cooking だけ（a） |
| OD-PS-3 | LOCKED で名前を見せる範囲 | ladder の次の2 step までは名前、それより先は「？？？」 |
| OD-PS-4 | 25件の並べ方 | authored の章（7 / 8 / 10） |
| OD-HINT-1 | Free Cooking のヒントで、どこまで開示するか | 材料の一部まで（Level 3）。答えは出さない |
| OD-VIS-1 | ソーセージを A（short link）にするか | A。Visual Gate を通してから入れる |
| OD-TAB-1 | 「カット」→「切る」 | 変える |

## 13. 実装 slice の提案

| slice | 内容 | 主なファイル | 検証 |
|---|---|---|---|
| I5b-4a | HOME の 2+1 骨格、「切る」 | `HomeScreen.tsx`、`App.css`、`makingStepLabels.ts` | unit、e2e（HOME の box） |
| I5b-4b | Cooking のレイアウト契約（in-flow の CTA bar、BAKE の CTA を bar に置く、stage を flex で決める、pager の場所を確保する、inset） | `GameScreen.tsx`、`BakeOverlay.tsx`、`IngredientTray.tsx`、`PizzaStage` の CSS、`App.css` | e2e（6つの viewport と inset）、WebKit、HV |
| I5b-4c | Pizza Select の文言と4状態（材料の軸、READY のシルエット、UNKNOWN） | `pizzaSelect.ts`、`PizzaSelectScreen.tsx` | unit（状態の派生）、e2e |
| I5b-4d | 25件の章 boundary と長い名前 | `pizzaSelect.ts`、CSS | unit |
| I6-a | contextual なヒント（Free Cooking の Level 1〜3、guided の Level 0〜2） | `hints.ts`、`gameReducer.ts` | unit、HV |
| I6-b | ソーセージの SVG（Visual Gate の後） | `IngredientGlyph.tsx`、`ingredients.ts` | Visual Gate、unit |

I5b-4b は I5b-3 の production integration（W1 の recipe と材料の入荷）と、ファイルがぶつかりにくい。I5b-4c は `pizzaSelect.ts` / `progression.ts` の近くを触るので、I5b-3 の merge 後に始めることを推奨する。

---

STOP GATE: 監査はここで終わり。`src/**`、`e2e/**`、CSS は変更していない。UI の実装、PR、merge はしていない。I5b-3 の branch には触れていない。
