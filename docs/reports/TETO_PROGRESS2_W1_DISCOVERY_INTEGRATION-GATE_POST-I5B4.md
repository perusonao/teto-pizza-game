# Progression 2.0 W1: Discovery Integration Gate — I5b-4 完了後の再監査

- 種別: Integration Gate の再監査（docs のみ）。`src/**`、`e2e/**`、CSS、runtime、tests、Playwright config、workflow は変更していない。PR は作っていない。merge もしていない。
- 作業 branch: `claude/discovery-w1-gate-post-i5b4-ni63g9`（`main` 12a09de から作成。I5b-3 / I5b-4 の branch には書き込んでいない）。
- 前回の Gate: `05415f6` `docs/reports/TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE.md`（対象 SHA: 5204a26）。**本書が後継の SSOT**。前回の結論のうち本書で変わったものは §0 と §12 にまとめた。
- 付属データ: `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE_POST-I5B4_matrix.json`（25 recipe × Dex 0〜25 × 入荷直後 / 購入後の state と漏れ、LK-8 の reducer 実測、章の比較、reducer backstop を試した時の test への影響、conflict / finding / OD / I5b-5 / slice 順）。**runtime authority ではない。**
- 行番号は、特に断りがなければ `fbfd738` の行。

## 基準（2026-09-25 に fresh fetch した直後の値）

| 対象 | SHA | 状態 |
|---|---|---|
| audited main | `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5` | `origin/main` の HEAD（Merge PR #228、I5a）。前回の Gate から変わっていない |
| I5b-3 | `5204a269a813bd4951720737ab9799949bca0f0f` | `claude/teto-pizza-w1-i4a-j46ph0` 上。I5b-4 の親 |
| **I5b-4（最終 HEAD）** | `fbfd738f4ca3e07a59d4bc489f7ab4a6af1b15bd` | `origin/claude/teto-pizza-w1-i4a-j46ph0` の HEAD。main より 7 commit 先。**open PR なし**（open PR 一覧で確認）。この監査で scratch worktree の `npx vitest run` を実行し、**147 files / 3228 tests PASS** |
| 前回の Integration Gate | `05415f60979a4ea32be5476783a768ff25d53364` | `claude/w1-discovery-integration-gate-jovdyc` |
| Discovery / Recipe Dex 2.0 Fresh Design | `a8ef4d9ea954f0c72a4e71936bf2ef66c28774de` | `claude/discovery-recipe-dex-fresh-design-2pp4xn` |
| I5b-5 Verification Fresh Design | `d4f96d0227830d387ea8813995bd8954eb1d1ce0` | `claude/i5b5-verification-design-mch6ne`（base は 12a09de。I5b-4 より前に書かれた） |
| 参考: I5b-4 UI/UX Fresh Audit | `0c3e01f4233db6cdccf33ab611f8be31b47fca59` | I5b-4a〜d と OD-PS-* を定義した audit |
| 参考: I5b Fresh Audit | `cc9dfaa8c4bf01e0804ef1bdd7ca09e0a8d080ec` | 実際の I5b-4 はこの audit の定義（「長い名前と章の確認・修正、3 材料通知の component test」）で実装された |

---

## 0. 結論

1. **判定: READY（条件付き）。** 非 UI の slice（I5b-5a、W1-a1、W1-a2、W1-b）は `fbfd738` を base にすぐ始められる。UI の slice（Pizza Select、Dex、HOME、Result）は **OD-DISC-1 / 3 / 5 / 9 が決まるまで NOT READY**。技術的な hard blocker は無い。
2. **I5b-4 が実際に入れたのは I5b-4a と I5b-4d の一部だけ。** HOME の 2+1 骨格と、Pizza Select の名前の文字サイズ自動調整（`--name-chars`）。I5b-4b（Cooking layout、P0）、I5b-4c（Pizza Select の4状態と EP1 文言）、I5b-4d の章 boundary、「切る」は**入っていない**。章は **7 / 8 / 8 / 2 のまま**。reducer / orders / Shop / Dex / Result は `5204a26` から変わっていない。
3. **その結果、前回の「高」の conflict のうち、HOME（C-2）は解消した。Pizza Select（C-1）は低〜中に下がった**（I5b-4c が実装されず、競合する branch が無いため）。章（C-3）は候補が 6 / 9 / 10 の1つだけになったが、Owner の決定が要る。
4. **答えの漏れは1件も直っていない。** 25 recipe の runtime で probe すると、**未発見のうちに名前が出る recipe は 25 / 25**（どの経路でも1回は出る）。経路別では Pizza Select の LOCKED の名前が 23、EP1 hint が 13、NEW カード（名前 + 見本 + guided CTA）が 18、Shop が 16、FREE の注文（LK-8）が 19（UI で届くのは 18）。Dex overlay と HOME は **0**（§5）。
5. **LK-8 は blocker のまま維持する。** 最新コードでも `PLAY_AGAIN` は未発見の recipe を優先して ORDER を作る。`BEGIN_PREPARE` はそれを見本付きの guided round で始める（Dex 12B で 120 / 120、legacy Dex 15 で 200 / 200）。さらに**新しい経路が2つ**見つかった: `availableOrders()` は pool が空だと**全 ORDERS に fallback する**（NF-1。discovered だけに絞るだけでは塞がらない）。`App.handleSelectRecipe` は reducer に拒否されても GAME に入る（NF-2）。
6. **reducer の backstop は必須。ただし費用の大半は `BEGIN_PREPARE` guard にある。** scratch で試すと、`SELECT_RECIPE` と pool だけなら 7 files / 48 tests が落ちる。`BEGIN_PREPARE` guard を足すと 20 files / 121 tests が落ち、さらに 9 files が止まる（Dex 0 の初期 ORDER = 未発見の margherita が、事実上の汎用 test fixture になっているため）。**W1-a2 は、共有の test helper を先に入れてから guard を足す2段にする**（§3）。
7. **章の canonical partition は「ladder の price tier」6 / 9 / 10 とする**（Owner が OD-DISC-9 で追認する）。7 / 8 / 10 はどのコードにも決定記録にも存在しない。6 / 9 / 10 は data から一意に決まり、25 件すべてで「key step = 必要な材料のうち最後に入荷する step」が成り立つ。計算は1つの関数に集め、Pizza Select / Dex / Result はそれだけを使う（§8）。
8. **Owner Decision はどれも決まっていない。** main、I5b-4 の branch、その他の全 branch の docs を検索しても、OD-DISC-* / OD-PS-* を決めた記録は無い。OD-UX-1 だけは、I5b-4 が推奨どおり実装し、Human Verification も PASS している（§9）。
9. **I5b-5 は2つに分ける。** Discovery に関係なく今すぐ直せるもの（`/15` → `/25`、step 14 の 3 チーズ通知、e2e fixture を「発見済み」で seed する）と、Discovery の後でないと固定できないもの。加えて、**I5b-5 の LC（P0 layout invariant）は I5b-4b が前提だが、`fbfd738` には I5b-4b が入っていない**（NF-9。Discovery とは別の依存）。

---

## 1. I5b-4 で何が変わったか（`5204a26..fbfd738`）

| ファイル | 変更 | Discovery 2.0 との関係 |
|---|---|---|
| `src/screens/HomeScreen.tsx:118-170` | CTA を常に同じ DOM 順の 2+1 にした（「ピザを作る」/「ランチラッシュ」+ 全幅のフリークッキング）。Dex 0 では class だけを入れ替える（フリークッキングを primary の「🎨 フリークッキングで探す」、ピザを作るを secondary、ランチラッシュを disabled） | W1-e の土台になる。前回の C-2 を解消 |
| `src/App.css:3422-3428` | `.cta-button--free-cook-lead` | 同上 |
| `src/screens/PizzaSelectScreen.tsx:116-121` | 名前 / lock label に `--name-chars`（表示する文字列の長さ）を付けた | W1-a3 はこれをそのまま使う。ただし NF-7 |
| `src/App.css:3589-3607` | grid を `minmax(0, 1fr)` にし、card を inline-size container にした。`clamp(11px, (100cqi - 8px) / chars, 14px)` | 同上 |
| tests | `HomeScreen.ctaLayout.test.tsx`（新規）、`PizzaSelectScreen.test.tsx`（どのラベルにも文字数が付く、最長の名前が 12 文字以内）、`ResultPanel.test.tsx`（3 材料の通知の layout） | 3 材料の layout は component test に移った → I5b-5 R-13 の半分は済んだ |

**変わっていないもの:** `src/state/**`、`src/data/**`、`gameReducer.ts`、`orders.ts`、`ShopOverlay.tsx`、`DexOverlay.tsx`、`ResultPanel.tsx`、`GameScreen.tsx`、`e2e/**`。章（`RECIPE_SECTION_BOUNDARIES` = 0 / 7 と `FALLBACK_CHUNK_SIZE` = 8）も同じで、I5b-4 Result §2 にも「chapters stay 7/8/8/2 (data)」とある。

---

## 2. Pizza Select（再評価）

### 2.1 W1-a3 との衝突

| 項目 | 前回（5204a26 + 予定された I5b-4c / 4d） | 今回（fbfd738） |
|---|---|---|
| 競合する slice | I5b-4c（READY の名前付きシルエット、次の2 step の名前、材料の軸の文言）、I5b-4d（7 / 8 / 10） | **どちらも実装されていない**。I5b-4 が触ったのは名前の文字サイズだけ |
| 衝突 | 高 | **低〜中**。W1-a3 が F-2a（EP1 文言）と F-2b（NEW で答えが見える）を吸収する。`recipeCardState` と `RecipeGridCard` の分岐を W1-a3 が書き換えるが、別の branch と取り合う箇所は無い |
| test | — | `PizzaSelectScreen.test.tsx` の I5b-4 の2件（文字数、12 文字以内）は、**発見済みの名前について**なら W1-a3 の後も成り立つ。seed を「発見済み」に変える |

### 2.2 未発見 recipe の契約（25 recipe で再検証）

probe: `fbfd738` の runtime module と component を、scratch の vitest で直接呼び出した。新規 save で margherita → ladder の key recipe の順に発見し、各 Dex で A（入荷直後）と B（購入後、在庫 30）を render した（★ はすべて 3）。DOM の `textContent`、`aria-label`、`alt` / `title` に未発見 recipe の `nameJa` が出るかを数えた。

| 経路（Pizza Select） | 名前 | 完成見本 | guided の CTA | 件数（25 recipe、全 Dex の和集合） |
|---|---|---|---|---|
| LOCKED カードの名前（`RecipeGridCard` :95、aria-label :61） | ✕ 出る | 出ない | 出ない | **23**（fugazza 以外。fugazza は mystery で「？？？」） |
| EP1 hint（`unlockHintFor` :29「○○を1枚完成させると解禁」） | ✕ 出る | — | — | **13**。**fugazza も含む**（salsiccia の hint が「フガッサを1枚完成させると解禁」と書く → mystery が無効になる。NF-5） |
| NEW カード（未発見、材料あり） | ✕ | ✕ `PizzaThumbnail` | ✕ 詳細に「このピザを作る」 | **18** |
| Dex 0 の margherita（`preDiscoveryLocked`） | ✕ | ✕ | 出ない（Free Cooking へ） | 1 |

- **Dex 0 の DOM には 25 / 25 の名前が出る**（margherita のカード + LOCKED 23 + hint の中の fugazza）。前回の「Dex 0 で LOCKED 23 枚に名前」は `fbfd738` でも同じ（§5 で Dex overlay と区別）。
- 在庫 0（Dex 12、black-olive の在庫 0）: 派生 state は KBMM なのに、Pizza Select は NEW で guided CTA を出す（`isRecipeAvailable` は在庫を見ない）。
- **どれも I5b-4 で変わっていない。** I5b-4 で変わったのは文字の大きさだけ。

**契約（OD-DISC-1 / 3 の結果によらず固定するもの）:** 未発見の recipe は、Pizza Select のどの DOM（text、aria-label、alt、title、CSS custom property）にも、名前、完成見本、材料の構成、guided の CTA を出さない。EP1 の文言は出さない。

### 2.3 I5b-4 の「25枚表示」「章」「文字サイズ自動調整」との両立（確定）

| I5b-4 の要素 | Discovery 2.0 での扱い | 理由 |
|---|---|---|
| **25枚表示** | 25 は「上限」になる。OD-DISC-1 (a)（A′）では**発見済みのカード（0〜25 枚）+ 匿名の prompt カード 1 枚**。(b) では加えて DISCOVERABLE の匿名シルエット（最大 1）。(c) では 25 枠のまま、未発見は「？？？」 | I5b-4 が 25 枚で確認した layout（2列、1行の名前、横 overflow 0）は、枚数が減っても壊れない。Dex 25 で 25 枚になるのは I5b-4 が検証した最大の状態と同じ |
| **章** | 残す。章の中身は §8 の canonical 関数で決める。発見済みが 0 の章は見出しと「0/m」だけにする | 章は Pizza Select / Dex / Result で共有する。位置による fallback（7 / 8 / 8 / 2）は使わない |
| **文字サイズ自動調整** | そのまま使う。**`--name-chars` は画面に出す文字列からだけ計算する**（発見済みの名前か、prompt カードや「？？？」の固定ラベル） | 未発見のカードで本当の名前の長さを渡すと、長さが漏れる（NF-7）。今のコードは `displayName` から計算しているので正しい。W1-a3 の test で固定する |

---

## 3. LK-8 と reducer defense（最新コードで再監査）

### 3.1 実測（`fbfd738`、reducer を直接呼び出した）

| 状況 | `PLAY_AGAIN` の結果（試行回数） | その ORDER で `BEGIN_PREPARE` |
|---|---|---|
| Dex 0（新規） | 初期 ORDER も `PLAY_AGAIN` も margherita（未発見）120 / 120 | 120 / 120 が **guided の margherita（見本付き）** を始める |
| 新規 ladder の B（key recipe の材料を購入済み）。Dex 3、4、5、9〜12、14〜24 | 120 / 120 が未発見（次の key recipe） | 120 / 120 が guided を始める |
| 同 Dex 6 / 7 / 8 / 13（pepperoni、salsiccia、meat-lovers、fugazza） | 0（EP1 の ★ 条件でまだ unavailable） | — |
| legacy Dex 15（EP4 所持） | 200 / 200 が pizza-portuguesa / pesto-tonno | 200 / 200 |
| Teto の台詞（`buildTetoOrderLine`） | 「よーし、今日はペストトンノピザに挑戦だ！…」「ピッツァ・ポルトゲーザか、腕が鳴るな！…」 | — |
| Lunch Rush の pool（`pickMissionOrder`） | 発見済みだけ（未発見 0 / 200） | — |

UI で届く経路（コードの読解で確認。Playwright での再現はしていない）:

| ID | 経路 | 状態 |
|---|---|---|
| LK-8a | Lunch Rush RESULT「フリープレイへ」→ `exitMissionToFree`（App.tsx:551）→ `PLAY_AGAIN` → GAME の ORDER（未発見）→「フリープレイ」→ `BEGIN_PREPARE` | open |
| LK-8b | PREPARE / BAKE 中に HOME（`handleGoHome` :685-688 が `PLAY_AGAIN`）→ Lunch Rush の intro を「閉じる」（`EXIT_TO_FREE` だけ）→ 残った ORDER が GAME に出る | open |
| LK-8c（新） | Dex 0 の初期 ORDER（`createInitialGameState` :565 の `preferFirst` → margherita）→ `BEGIN_PREPARE` | reducer だけ。今の UI からは届かない（Lunch Rush は Dex 0 で locked、Dex 0 の margherita カードは Free Cooking へ行く） |
| LK-8d（新、NF-2） | `App.handleSelectRecipe`（:724-727）は `SELECT_RECIPE` の結果を見ずに `setScreen("GAME")` → reducer が拒否すると、残っていた ORDER（未発見かもしれない）が出る | 今の UI では拒否される select は起きない。W1-a2 の後は起きうる |

**判定: LK-8 は blocker のまま。** 未発見の recipe が、名前付きの注文と見本付きで FREE round に入れる。

### 3.2 新しい穴

- **NF-1（P1）:** `orders.ts:199-203` `availableOrders()` は、絞り込んだ結果が空なら `ORDERS`（全 25 件）を返す。「FREE の pool = available ∩ discovered」にしても、それが空になる場面（Dex 0、発見済みの材料を全部使い切ってはいないが持っていない等）では、**未発見の注文に戻ってしまう**。scratch の実験でも、既存 test「empty Dex では margherita だけが出る」がこの fallback で落ちた（§3.4）。
- **NF-4（P2）:** `RETRY_SAME_RECIPE`（guided、:1249-）は、今の recipe が未発見でもそのまま guided を始める。入口を塞げば届かないが、同じ判定を使う。

### 3.3 契約（確定）: どこで保証するか

判定は **1つの関数**にする。

```
canStartGuidedRound(state, recipeId) =
  isDiscovered(state.dex, recipeId) && isRecipeAvailable(recipe, state.dex, state.ownedIngredientIds)
```

| 場所 | 規則 | 今 |
|---|---|---|
| `SELECT_RECIPE`（gameReducer.ts:1199） | `canStartGuidedRound` が false なら no-op（Dex の件数によらない） | Dex 0 のときだけ拒否 |
| `BEGIN_PREPARE`（:593） | FREE かつ `freeCook` でない round で、`canStartGuidedRound` が false なら no-op | guard なし |
| `RETRY_SAME_RECIPE`（:1249、`freeCook` でない側） | 同上 | guard なし |
| `nextOrderState`（:472）/ `getNextOrder`（orders.ts:206） | FREE の pool = available ∩ discovered。**空なら fallback しない**（`pickMissionOrder` と同じく null を返す mode を足す）。空のときは ORDER ではなく Free Cook の round を作る（`buildOrderState(..., freeCook = true)` は既にある） | 未発見を優先。空なら全 ORDERS |
| `App.handleSelectRecipe`（App.tsx:724） | reducer が受け付けたとき（phase が PREPARE になったとき）だけ GAME に入る | 常に GAME |
| 変えない | `pickMissionOrder`（既に発見済みだけ、空なら null）、`START_FREE_COOK` と free-cook の `RETRY_SAME_RECIPE`（正規の発見経路） | — |

これで Pizza Select の表示に関係なく、未発見の recipe は guided の経路から始められなくなる（UI を隠すだけに頼らない）。

### 3.4 test への影響（scratch で試した結果）

`fbfd738` の scratch worktree で `gameReducer.ts` を一時的に書き換え、test file ごとに `vitest run` した（書き換えは戻した。何も commit していない）。

| 版 | 内容 | 結果 |
|---|---|---|
| baseline | 変更なし | 147 files / 3228 tests PASS |
| B | `SELECT_RECIPE` を発見済みだけ + FREE の pool を発見済みだけ（orders.ts の fallback はそのまま） | **7 files / 48 tests が fail**、止まる file なし。`w1Activation.test.tsx`（W1 10 件を未発見のまま `SELECT_RECIPE`）、`gameReducer.test.ts`（Dex 0 で「margherita だけ」→ NF-1 の fallback で全件）、`App.test.tsx` / `App.playerReference` / `App.humanFeelFix3` / `App.cookingTimingBackground`（未発見の recipe を Pizza Select から始める）、`phase4a1a.regression` |
| A | B + `BEGIN_PREPARE` guard | **20 files / 121 tests が fail、さらに 9 files が止まる**（baseline では 2〜4 秒で通る file が 90 秒を超える）。`createInitialGameState()`（Dex 0、未発見の margherita の ORDER）→ `BEGIN_PREPARE` を、調理の test の汎用 fixture として使っているため |

→ **W1-a2 は2段に分ける。** a2-i: 判定関数、`SELECT_RECIPE`、strict な FREE pool（NF-1）、`App.handleSelectRecipe`、fixture の修正（B の 48 件）。a2-ii: 共有の test helper（対象の recipe を発見済みで seed して PREPARE にする）を先に入れ、既存の fixture をそれに移してから、`BEGIN_PREPARE` / `RETRY_SAME_RECIPE` の guard を足す。

---

## 4. Shop（25 recipe で列挙）

`ShopOverlay.tsx` は `5204a26` と同じ。

| 箇所 | 文言 | 未発見の名前が出る recipe（全 Dex の和集合） |
|---|---|---|
| NEW の行（:231 / :285） | 「これを買うと: 🍕 ○○」 | **16**: funghi、melanzane-pizza、parmigiana-pizza、bambino、hawaiian、pizza-portuguesa、marinara、napoletana、tonno-e-cipolla、pesto-tonno、genovese、new-haven-apizza、pesto-caprese、pesto-patate、pizza-bianca、puttanesca-pizza |
| 購入後の feedback（:132 / :181） | 「🍕 新しいピザが作れます！「○○」」 | 同じ 16（同じ `recipesUnlockedByIngredient` を使う） |
| legacy Dex 15（load 直後） | 同上 | 4: melanzane-pizza、parmigiana-pizza（eggplant）、bambino（corn）、hawaiian（pineapple） |
| 空の Shop（:200） | 「新しいピザを発見すると、材料が入荷します」 | 0（recipe 名なし） |

**名前の偶然の一致（漏れの経路ではない。W1-b では消えない）:**
- 材料「ペパロニ」= recipe「ペパロニ」。
- 材料「ジェノベーゼソース」（pesto）が recipe 名「ジェノベーゼ」を含む。

これは材料の名前そのものなので、Shop から recipe 名を消しても残る。W1-b の test は、ただの部分一致で探すと必ず誤検出する。**test の oracle でこの2組を明示的に除外する**か、Owner が材料の表示名を変える（data の id は変えない）。

**W1-b の契約:** Shop のどの文言（行、feedback、空の表示、aria）にも、未発見の recipe 名を出さない。`recipesUnlockedByIngredient` は Shop から外す（関数と tests は残す）。

---

## 5. Dex

| 確認 | 結果（fbfd738） |
|---|---|
| `DexOverlay.tsx`（:47-60） | 未発見は「🔒 ？？？ まだ見ぬピザ」だけ。**名前の漏れ 0**（全 Dex 0〜25 で実測） |
| 部分一致で出たもの | Dex 15 の「ナポリ」（発見済みの marinara の説明文「…ナポリ生まれの下町ピザ」= recipe「ナポリ」）、Dex 18 の「ジェノベーゼ」（発見済みのカードの材料一覧の「ジェノベーゼソース」）。どちらも漏れではない |
| 前回の「Dex 0 → 23 枚の LOCKED に名前」 | **`fbfd738` でも同じ。ただし場所は Pizza Select で、Dex overlay ではない。** Dex 0 の Pizza Select には LOCKED が 24 枚あり、うち 23 枚に名前が出る。fugazza の名前も EP1 hint から出る |

**契約:** Dex の未発見の枠には、名前、見本、材料、名前の長さを出さない（W1-f で章とタグを足しても同じ）。No. は章の中の固定番号。

---

## 6. HOME（2+1 を壊さずに足す）

`fbfd738` の 2+1（`HomeScreen.tsx:118-170`、`HomeScreen.ctaLayout.test.tsx`）を**変えない**ことを前提にする。HOME の layout は作り直さない。

| 追加するもの | 置き場所 | 規則 | CTA への影響 |
|---|---|---|---|
| Shop の `NEW n` badge | 既存の Shop カード（menu）の中に inline で | n = `materialShopState === "NEW"` の件数（入荷済みで未購入）。0 なら出さない | なし |
| 図鑑の `NEW` badge | 既存の図鑑カードの中 | `justDiscovered` が true のあいだ | なし |
| 吹き出し（`.home-hero__bubble` の既存の要素） | 文言だけを変える | 優先順: Dex 0 → 未購入の NEW 材料がある → DISCOVERABLE ≥ 1 → 既定。**recipe 名は出さない**（今も HOME の名前は 0） | なし |
| Discovery 用の新しい CTA / 行 | **足さない** | — | — |

- 守る invariant: CTA 3 つの DOM 順、class の切り替えだけで Dex 0 と Dex 1+ を分けること、`HomeScreen.ctaLayout.test.tsx` を変えずに通すこと、I5b-5 の L-H / L-O。
- props: `ownedIngredientIds`、`unlockedForShopIngredientIds`、`inventory`、`justDiscovered` を App.tsx から足す（件数の計算は §7 の state model を使う）。save への影響なし。
- 名前の揺れ（「レシピ」「ピザ図鑑」「レシピ図鑑」）は W1-e で「ピザ図鑑」に揃える（前回と同じ）。

---

## 7. Result（fbfd738 の DOM を基準に）

`ResultPanel.tsx` は I5b-4 で変わっていない（test だけ追加）。今の並び（score の分岐 :267-）:

```
heading → headline（★ / 点数 / 焼き加減 / 量のメモ）→ NEW PIZZA banner（1行）
→ 入荷 notice（+「🛒 ショップへ」）→ Pitz（<details> の内訳）→ CUT / Timing（<details>）
→ くわしいスコア（<details>）→ 固定の actions bar（もう一度じゆうに作る / レシピを選んで作る）
```

**NEW_DISCOVERY のときだけの並び（W1-d。既知 / guided / ORIGINAL / FAILED は今のまま）:**

| 順 | 要素 | 既存の要素との関係 |
|---|---|---|
| 1 | NEW PIZZA! の stamp + 名前（最大2行 clamp） | `discovered-banner--new-pizza` を先頭に移す。heading の Teto の一言と焼き加減の badge は出さない |
| 2 | 「📖 ピザ図鑑に登録！ No.k（第n章 x/m）」+ **[📖 図鑑を見る]**（同じ行の小さな button） | 新規。章は §8 の関数。図鑑は `newlyDiscoveredId` の枠へスクロールして開く |
| 3 | ★ ・ 点数 ・ +Pitz（初回発見 +50）を1行 | headline を1行に畳む。内訳は今の `<details>` |
| 4 | 入荷 notice（2名 + ほか N種）+「🛒 ショップへ」 | 今の要素のまま。primary にするかは OD-DISC-6 |
| 5 | CUT / Timing / くわしいスコア | 今の `<details>` のまま |
| 6 | 固定の actions bar | **変えない**（2 button のまま。I5b-4b と RESULT 1-Screen 2.0 の高さの予算を守る） |

- 「図鑑を見る」を固定の bar に入れない理由: bar の button を増やすと、360×640 で stage と重なる（I5b-4b の未解決の問題 F-3 と同じ場所）。
- props: `GameScreen.tsx:668` の `ResultPanel` に `onOpenDex` を足し、App.tsx の図鑑の state を渡す。
- 依存: OD-DISC-6（primary CTA）と I5b-4b（bar の in-flow 化）。**W1-d は I5b-4b の後。**

---

## 8. 章の conflict（canonical partition を1つにする）

| 候補 | どこにあるか | 25 件の分け方 |
|---|---|---|
| 今のコード | `pizzaSelect.ts:102-150`（0 / 7 の authored + 8 件ずつの fallback） | **7 / 8 / 8 / 2**（第4章は pesto-patate と puttanesca-pizza だけ） |
| I5b-4d（OD-PS-4 の推奨） | 0c3e01f の audit だけ。**実装されていない**。決定記録もない | 7 / 8 / 10（旧 Issue #88 / Batch 1A / W1） |
| W1-f（OD-DISC-9 の推奨） | a8ef4d9 の design | 6 / 9 / 10（price tier） |

probe で `DISCOVERY_LADDER` と `MATERIAL_PRICE_TIERS` から計算した結果:

- T1（60 Pitz、step 1〜5 + starter だけ）: margherita、bismarck、funghi、breakfast-pizza、melanzane-pizza、parmigiana-pizza（**6**）
- T2（80、step 6〜14）: marinara、fugazza、salsiccia、pepperoni、capricciosa、meat-lovers、bambino、hawaiian、pizza-portuguesa（**9**）
- T3（100、step 15〜24）: quattro-formaggi、genovese、napoletana、tonno-e-cipolla、pizza-bianca、pesto-tonno、new-haven-apizza、pesto-caprese、pesto-patate、puttanesca-pizza（**10**）
- 25 件すべてで「その recipe の key step」=「必要な材料のうち最後に入荷する step」。

**canonical（この Gate で確定）:**

1. **partition は price tier の 6 / 9 / 10。** 理由: 7 / 8 / 10 はコードにも決定にも存在しない。6 / 9 / 10 は ladder と価格の data だけから一意に決まり、魔法の数字が要らない。章が順番に完成する。
2. **計算は1つの純関数だけにする**（例: `src/state/recipeChapters.ts` の `recipeChapter(recipe)`、`chapterProgress(dex)`）。Pizza Select、Dex、Result の「第n章 x/m」はこれだけを使う。`RECIPE_SECTION_BOUNDARIES` / `FALLBACK_CHUNK_SIZE` / `buildRecipeSections` は UI から外す（関数は残してよい）。
3. 章の中の並びは `RECIPES` の宣言順（ladder の順にしない。一本道に見えないようにする）。
4. **Owner は OD-DISC-9 でこれを追認する。** もし (b) を選ぶ場合も、同じ関数の中身を authored table に変えるだけで、使う側は変えない。

---

## 9. Owner Decisions（状態）

検索の範囲: `origin/main`、`claude/teto-pizza-w1-i4a-j46ph0`（fbfd738）、fetch した全 branch の `docs/**`。OD-DISC-* を含むのは design（a8ef4d9）と前回の Gate だけ。OD-PS-* を決めた記録も無い。**古い blocker として消せるものは無い。**

| ID | 状態 | 選択肢 | UX への影響 | 実装への影響 | 決定が必要な事項 |
|---|---|---|---|---|---|
| **OD-DISC-1** Pizza Select の役割 | 未決定 | (a) 発見済み + 匿名の prompt 1 枚 / (b) (a) + DISCOVERABLE の匿名シルエット / (c) 25 枠（未発見は ？？？） | (a) 発見するまで Pizza Select は短く、recipe から先に選ぶ遊び方が無くなる。(b)「次がある」ことが見える。(c) Dex と同じものが2つになる | (a)/(b) は `recipeCardState` を作り直し、props に ledger / inventory / `onOpenShop` を足す。(c) は今の構造を残し、中身を隠すだけ。**どれでも reducer の backstop（§3）は同じ** | 未発見の recipe を Pizza Select に「枠」として出すか |
| **OD-DISC-3** 名前を出す時期 | 未決定 | (a) 発見の瞬間 / (b) DISCOVERABLE から / (c) 入荷（KBMM）から / (d) ladder の次の2 step（OD-PS-3） | (a) 名前が発見の報酬になる。(b)〜(d) は目標が見えるが、名前が材料の手がかりになる（ハワイアン → パイナップル） | (a) 以外を選ぶと、§2.2 / §4 / §5 の契約と test の oracle を「state ごとの許可リスト」にする必要がある。Shop の文言にも影響する | 名前をいつ出すか。**この Gate の契約（Shop と Pizza Select で名前 0）は (a) を前提にしている** |
| **OD-DISC-5** 旧 EP1 chain | 未決定 | (a) 表示と gate から外し、data と tests は残す / (b) data ごと削除 / (c) 今のまま | (c) のままだと、EP1 hint が 13 件の名前を出し、fugazza の mystery も破れる（NF-5）。ladder と矛盾する文言も残る | (a) save への影響 0（EP1 は save に無い）、`unlockHintFor` は使わなくなる。(b) test の書き換えが大きい | EP1 を表示と gate から外すか、data まで消すか。※ `isRecipeAvailable` の EP1 軸は Lunch Rush と guided（発見済みだけ）に残っても実害なし（A2 で発見済み ⇒ unlocked） |
| **OD-DISC-9** 章 | 未決定（§8 で canonical を 6 / 9 / 10 にした） | (a) price tier 6 / 9 / 10 / (b) authored 7 / 8 / 10 / (c) 味の系統 | (a) 章が順番に完成する。(b) 第1章が最後まで完成しない。(c) collection 感はあるが authority が無い | どれでも1つの関数。(a) は data から計算。(b) は table を持つ。(c) は新しい data が要る | §8 の canonical を追認するか |
| OD-UX-1 | **実装済み（既定値）** | Dex 0 の「ピザを作る」を enabled の secondary にする | — | fbfd738 で実装済み、Human Verification（390×844 / 360×800）PASS | 追加の決定は不要。記録として Owner が追認すればよい |
| OD-DISC-6 | 未決定（W1-d だけに関係） | Result の primary を Shop にするか | — | W1-d の並び | W1-d の前に決める |

---

## 10. I5b-5 との依存関係

### 10.1 今すぐ直せるもの（Discovery に関係ない。I5b-5a）

| file | 今 | 直し方 |
|---|---|---|
| `e2e/save-forward-compat-3-4b.spec.ts:43, :64` | `/1\/15/` | `/1\/25/` |
| `e2e/progression2-p3-3-onboarding.spec.ts:54, :172, :208, :218` | `/0\/15/`、`/1\/15/` | `/25/` |
| `e2e/progression2-discovery-ladder.spec.ts:188-236` | 「step 14 で 3 種のチーズ」（25 ladder の step 14 は garlic） | 2 材料の step（11: black-olive + oregano / 24: fontina + gorgonzola）に置き換える。3 名の layout は I5b-4 の `ResultPanel.test.tsx` が守る（R-13 の半分は済み） |
| `e2e/gestures.ts` の fixture（NF-6）: `startQuattroFormaggiHeavyInventory`、`startCapricciosaUnlocked`、`startSalsicciaUnlocked`、`startMarinaraUnlocked`、spec の中の「ハム」の flow | 未発見の recipe を Pizza Select の NEW カード →「このピザを作る」で始めている。9 つの spec file が使う | 始める recipe を**発見済み**で seed する。今のコードでも同じように通り（COMPLETED のカードにも「このピザを作る」がある）、W1-a2 の後も通る |

### 10.2 Discovery の後でないと固定できないもの（I5b-5b）

| 期待値 | 決めるもの |
|---|---|
| onboarding B（Dex 0 の margherita カード → prompt カード） | OD-DISC-1、W1-a3 |
| R-14（Pizza Select の章の boundary） | OD-DISC-9、§8 の関数 |
| Pizza Select / Shop / 注文に未発見の名前が 0 件、LK-8 の e2e | W1-a2、W1-a3、W1-b |
| `result-1screen-2.0` / onboarding D / discovery-ladder の notice の位置 | W1-d（OD-DISC-6） |
| HOME の吹き出しと badge の文言 | W1-e |

### 10.3 Discovery とは別の依存（NF-9）

I5b-5 Design（d4f96d0）の LC（L-A〜L-G の P0 invariant、B-2）は、I5b-4b（Cooking の layout 契約）が入っている前提で書かれている。`fbfd738` の I5b-4 には I5b-4b が入っていない。**このままでは I5b-5 の P-5 は green にならない。** Discovery の slice とは別に、I5b-4b を W1-d の前に入れる必要がある。

---

## 11. Test matrix（25 recipe runtime、machine-readable は JSON）

| 項目 | 結果（fbfd738） | JSON |
|---|---|---|
| 未発見の recipe 名が出る recipe（どれかの経路で1回でも） | **25 / 25** | `leakSummary` |
| 経路別 | Pizza Select LOCKED 23 / EP1 hint 13 / NEW（名前 + 見本 + guided）18 / Dex 0 margherita 1 / Shop 16 / FREE 注文 19（UI で届くのは 18） / `SELECT_RECIPE` が受け付ける 18 | `leakSummary.byChannel` |
| Dex overlay / HOME | 0 / 0（偶然の一致 2 件は除く） | `leakSummary.dexOverlay`、`home` |
| 偶然の一致（漏れではない） | Shop: pepperoni、genovese。Dex: napoletana、genovese | `leakSummary.lexicalOverlapNotALeakChannel` |
| FREE 注文 / LK-8 | Dex 0: 120 / 120 が margherita（reducer だけ）。key の B: 120 / 120 が未発見 → guided。legacy: 200 / 200 | `freshWalk[].lk8`、`stateDerivation.legacyDex15.lk8` |
| matcher の signature の重複 | **0**（25 target、すべて ELIGIBLE、items = `requiredIngredients` の集合） | `static` |
| DISCOVERABLE / KBMM | どの Dex でも最大 1 / 1。いつも次の key recipe | `stateDerivation` |
| legacy save（Dex 15、EP4） | `loadSave` + `resolveShopEntitlement` で eggplant / corn / pineapple が NEW。DISCOVERED 15 / DISCOVERABLE 2 / KBMM 4 / UNKNOWN 4。save の key は変わらない | `stateDerivation.legacyDex15` |
| 在庫 0 | 派生 state は KBMM。Pizza Select は NEW と guided CTA（不一致） | `stateDerivation.inventoryZero` |
| EP1 非依存 | `unlockCondition` / `mysteryLock` を消しても派生 state の差は 0。今の Pizza Select のカード state も、この probe の Dex 7 では差 0（W1 の state model は EP1 を読まない） | `stateDerivation.ep1Independence` |
| Lunch Rush の pool | 発見済みだけ | `stateDerivation.lunchRushPool` |
| reducer backstop の test への影響 | B: 7 files / 48 tests。A: 20 files / 121 tests + 9 files が止まる | `reducerBackstopExperiment` |
| unit baseline | 147 files / 3228 tests PASS | `_meta` |

W1 で足す test（前回の §7 に追加するもの）:
- reducer: `canStartGuidedRound` を4か所で使うこと。FREE pool が空のとき ORDERS に fallback しないこと（NF-1）。`App.handleSelectRecipe` が拒否されたら GAME に入らないこと（NF-2）。
- Pizza Select: `--name-chars` が未発見の名前の長さにならないこと（NF-7）。EP1 hint の名前が 0 件（NF-5）。
- 漏れの oracle: 部分一致ではなく、「未発見の `nameJa` − 偶然の一致の許可リスト」で数えること（NF-8）。

---

## 12. 前回の Gate からの変化

| 項目 | 前回（05415f6 / 5204a26） | 今回（fbfd738） |
|---|---|---|
| I5b-4 | 未実施 | 実施済み（HOME 2+1、名前の自動縮小）。4b / 4c / 4d 章 / 「切る」は未実施 |
| C-2 HOME | 高 | **解消** |
| C-1 Pizza Select | 高 | **低〜中**（I5b-4c が実装されなかった） |
| C-3 章 | 高（7/8/10 と 6/9/10） | **候補は 6 / 9 / 10 の1つ**。OD-DISC-9 の追認待ち |
| C-4 Result | 中 | 中（I5b-4b が未実施） |
| LK-8 | 新規 finding | **blocker のまま**。LK-8c / 8d、NF-1 を追加 |
| 漏れ | 18 / 16 / 23 | 同じ数。和集合では **25 / 25**（EP1 hint による fugazza を含む） |
| backstop | 3 か所 | **4 か所 + orders の fallback + App**。test への影響を実測 |
| e2e | `startFreshMargherita` は通る | さらに **4 つの fixture と 9 spec** が未発見の recipe を guided で始めていた（NF-6） |
| 判定 | READY（条件付き） | READY（条件付き）。非 UI の slice はすぐ、UI の slice は OD 待ち |

---

## 13. 推奨する実装 slice の順番

| 順 | slice | 内容 | 依存 | HV |
|---|---|---|---|---|
| 0 | 前提 | Owner が I5b-3 + I5b-4（fbfd738）を main に入れる。OD-DISC-1 / 3 / 5 / 9 を決める | — | — |
| 1 | **I5b-5a** | §10.1（`/25`、2 材料の通知、fixture を発見済みで seed） | fbfd738 | なし |
| 2 | **W1-a1** | `recipeDiscoveryState.ts`（4 状態）+ `recipeChapters.ts`（§8）。純関数と unit | fbfd738 | なし |
| 3 | **W1-a2**（i → ii） | `canStartGuidedRound`、`SELECT_RECIPE`、strict な FREE pool（NF-1）、App の guard（NF-2）→ 共有の test helper → `BEGIN_PREPARE` / `RETRY_SAME_RECIPE` の guard。**LK-8 はここで閉じる** | 2 | なし |
| 4 | **W1-b** | Shop から recipe 名を消す | 2 | 1行の変更。screenshot |
| 5 | **W1-a3 + W1-c** | Pizza Select（OD-DISC-1 / 3 / 5）、EP1 の文言を消す、章 | 2、3、OD | **必要** |
| 6 | **W1-f** | Dex の章 / 枠 / タグ | 2、5 | 必要 |
| 7 | **W1-e** | HOME の badge / 吹き出し（fbfd738 の 2+1 の上に積む） | 2 | 必要 |
| 8 | **I5b-4b → W1-d** | Cooking の layout 契約 → Discovery Result | OD-DISC-6 | 必要 |
| 9 | **I5b-5b** | §10.2 の e2e、LC、WebKit、Human Verification。W1-g は任意 | すべて | 必要 |

W1 の最小ライン（答えの漏れを構造的に 0 にする）は 2 + 3 + 4 + 5。

---

## 14. Blockers

| 種類 | 内容 |
|---|---|
| 技術的な hard blocker | **なし** |
| W1 を完了とするための blocker | **LK-8（a〜d）**。slice 3 で閉じるまで、Discovery の契約は成り立たない |
| 着手の条件 | I5b-3 / I5b-4 が main に無い（PR も無い）。OD-DISC-1 / 3 / 5 / 9（slice 5〜7）。OD-DISC-6（slice 8）。I5b-4b が未実装（slice 8、I5b-5 の LC） |
| 既知のリスク | backstop の test の書き換えが大きい（§3.4）。偶然の一致を test の許可リストで扱うかどうか（NF-8） |

## 15. 判定

**READY（条件付き）。** slice 1〜4 は `fbfd738` を base に、今すぐ始められる。slice 5〜8（UI）は、OD-DISC-1 / 3 / 5 / 9（slice 8 は OD-DISC-6 と I5b-4b も）が決まるまで NOT READY。

---

## 16. このレポートの範囲

- 追加したもの: 本ファイルと `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE_POST-I5B4_matrix.json`。
- 変更していないもの: `src/**`、`e2e/**`、CSS、runtime、tests、Playwright config、workflow、I5b-3 / I5b-4 の branch、前回の Gate の文書。
- probe、baseline の unit、reducer backstop の実験は、scratch の worktree（`fbfd738` を detached で checkout）で行った。一時的な変更はすべて戻し、何も commit していない。LK-8 は reducer とコードの読解で確認した（Playwright での再現はしていない）。
- PR は作っていない。merge もしていない。

STOP GATE: 再監査はここで終わり。
