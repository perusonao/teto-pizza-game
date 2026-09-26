# Discovery Hint 2.0 — Fresh Audit / UX Design（docs-only）

- 監査対象: **W1 branch `claude/teto-pizza-w1-i4a-j46ph0` HEAD `fc8a4be174c41462569d13148da70e3ae3a50bf5`**
  （I5b-5 Verification Result まで。25 recipes / 29 obtainable ingredients / Discovery 2.0 W1-a〜f が入っている唯一の branch）
- 比較基準: `main` HEAD `12a09de`（PR #228 merge。15 recipes runtime、Discovery 2.0 未適用）
- 作業 branch: `claude/discovery-hint-2-audit-mntyyf`（`main` から。**W1 branch には何も入れていない**）
- 変更: 本 report と `docs/reports/data/TETO_DISCOVERY-HINT-2_*` のみ。production code / tests / save schema は変更なし
- きっかけ: Owner の実機 Preview で「今のヒントは役に立たず、新しいレシピを見つけるのが難しい」
- 前提として読んだもの: `TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_FRESH-DESIGN.md`（§11 wrong attempt / §12 hint = 「I6」）、
  `TETO_PROGRESS2_W1_DISCOVERY_LEAK_FRESH-AUDIT.md`、`TETO_PROGRESS2_W1_DISCOVERY_INTEGRATION-GATE_POST-I5B4.md`、
  W1 branch の `TETO_PROGRESS2_W1_DISCOVERY_W1_Result.md` / `..._I5B4B_W1D_Result.md` / `..._I5B5_Result.md`

---

## 0. 要約

1. **Root cause は「W1 で答え漏れ（LK-*）を閉じたが、その代わりになる手がかり（I6 hint）がまだ無い」こと。**
   旧 runtime では Pizza Select の LOCKED 名・EP1 hint・Shop の「これを買うと: 🍕○○」・NEW カードの見本が、
   意図せず **実質的なヒント** になっていた。W1-a〜f はこれらを正しく閉じたが、Discovery 2.0 Fresh Design が
   §12 で「I6」として予定していた Free Cooking の段階ヒントと §11 の「おしい」feedback は W1 に入っていない
   （I5b-4b Result: 「Not in I5b-4b: hints (I6)」）。結果として **Dex ≥ 1 の Free Cooking で出る情報は操作説明だけ**。
2. **W1 25-recipe ladder は完全に一本道**: どの Dex 数でも、材料を全部買っていれば DISCOVERABLE は **ちょうど 1 件**。
   その 1 件を、所持材料で作れる組み合わせ **7 → 2,047（Dex 8）→ 約 2.7 億（Dex 24）** の中から exact-set で当てる必要がある。
3. 「前の recipe + 新材料」「トマトソース + モッツァレラ + 新材料」という **自然な推測で当たるのは step 1〜7 だけ**。
   **step 8（meat-lovers）以降の 17 step は、自然な推測がどれも外れる**（うち 10 step は良いほうの推測でも 2 つ以上違う）。
   Owner が感じた「難しすぎる」は T2（第2章）から確実に起きる。
4. dead-end（ハードな袋小路）は ladder 上には無い（DISCOVERABLE か KBMM が常に 1 件以上）が、**情報の袋小路** が 5 つある（§1.4）。
5. 提案する Hint 2.0: **DISCOVERABLE だけを対象**にした決定的な target 選択 + **Free Cooking の既存「ヒント」ボタンから開く bottom sheet**
   で H1〜H4 を 1 段ずつ開示（名前・画像は出さない、最後の 1 材料は明示しない）+ Result の **near-miss（おしい）**
   + Dex の 🎨 枠から同じ sheet を開く入口。ペナルティなし、save schema 変更なし。
6. W1 との関係: **B（W1 merge 後の最優先 Post-W1 slice）** を推奨。ただし W1 merge は `main` push → Pages deploy なので、
   「W1 merge は late-game discoverability の regression を含む」ことを Owner が承知したうえで merge する前提（§11）。
7. 新規 Issue **#229** を作成（§12）。

---

## 1. Current hint audit（W1 `fc8a4be`）

### 1.1 Hint inventory（全導線）

| # | 画面 / 導線 | 実装 | 出る情報 | タイミング | Level* | actionable? | leak? |
|---|---|---|---|---|---|---|---|
| 1 | HOME 吹き出し | `src/state/homeBubble.ts` | Dex0「まずはフリークッキングで最初の1枚を見つけよう！」/ NEW 材料「ショップに新しい材料が入ったよ！」/ DISCOVERABLE>0「今の材料で新しいピザが作れるかも！」/ 既定 | HOME 表示時（派生） | L1 | △ 行き先だけ（Free Cooking / Shop） | なし |
| 2 | HOME Lunch Rush lock 行 | `HomeScreen.tsx:175` | 「🔒 まず1枚ピザを発見しよう」 | Dex 0 | L1 | △ | なし |
| 3 | Pizza Select prompt カード | `PizzaSelectScreen.tsx:100-114` | Dex0 / DISCOVERABLE / Shop の 3 文 + CTA | 表示時 | L1 | △ | なし（W1-a3 で LOCKED 名を廃止） |
| 4 | Free Cooking 工程ヒント（常設行） | `hints.ts` `FREE_COOK_STEP_HINTS` | 「好きなソースを選んでぬろう（なしでもOK）」等、**操作だけ** | 各工程 | L0 | ✕ 発見に役立たない | なし |
| 5 | Free Cooking「ヒント」ボタン（SHOW_HINT） | `GameScreen.tsx:677`、`gameReducer.ts:1347` | 工程の explicit 版（「…組み合わせ次第で新しいピザが見つかるかも！」） | 押したとき | L0 | ✕ **押しても何も新しく分からない**（Owner の指摘そのもの） | なし |
| 6 | Dex 0 onboarding escalation | `hints.ts` `FREE_COOK_DISCOVERY_HINT_LEVELS` | Lv1 色 / Lv2 性質 / **Lv3 答え全部**（LK-6、意図された例外） | 不一致 1/2/3 回目**の次の round** から自動 | L1→L5 | ○ | 意図的（onboarding 例外） |
| 7 | Guided round hint | `hints.ts` `RECIPE_HINTS`（6 件手書き + 汎用 fallback） | 次に置く材料名 | 発見済み recipe の guided round だけ（LK-8 backstop） | L5 | ○ | なし（発見済みのみ） |
| 8 | Recipe Dex `？？？` 枠 | `DexOverlay.tsx` `UndiscoveredSlot` | 🎨「今の材料で作れるかも」+ [フリークッキングで探す] / 🏪「ショップの材料で作れるかも」+ [ショップを見る] / UNKNOWN「まだ見ぬピザ」 | Dex 表示時（派生） | L1 | △ 行き先だけ。**🎨 の CTA の先（Free Cooking）に具体的な手がかりが無い** | なし |
| 9 | Shop NEW 行 | `ShopOverlay.tsx:84,264` | 「🎨 新しいピザのヒントになるかも」 | NEW 材料があるとき | L1（実質 key 材料） | ○ 買う理由になる | なし |
| 10 | Shop 進捗行 | `ShopOverlay.tsx:176-178` | 「🔜 あとN つ発見で新しい材料が入荷」 | 常時 | L1 | △ | なし |
| 11 | Shop 購入 feedback | `ShopOverlay.tsx:164-166` | 「📦 ○○を仕入れました！ 🍳 フリークッキングで使ってみよう」 | 購入直後 | L1（実質 key 材料） | ○ | なし（W1-b で recipe 名を削除済み） |
| 12 | Discovery Result（W1-d） | `ResultPanel.tsx:366` | 発見した名前 + 「🆕 新しい材料が入荷：○○」 | 新規発見時 | 名前は発見後 / 次の key 材料が実質分かる | ○ | なし |
| 13 | ORIGINAL Result | `ResultPanel.tsx:220-260` | 「図鑑にはない、あなただけのピザ！」+ 使った材料 +「図鑑のピザと同じ組み合わせで作ると『発見』…」 | 不一致時 | L0 | ✕ **どれくらい近いか一切分からない** | なし |
| 14 | INCOMPLETE_MATCH Result | 同上 `nearMiss` | 「図鑑のピザまであと少し…！**ソースや焼き加減を変えてみよう**。」 | 集合一致・Completion Gate 不合格 | L1 | △ **誤誘導**: 原因はソースの「量」か焼き加減なのに「ソースを変える」と読める（ソースの種類を変えると一致が壊れる） | なし |
| 15 | AMBIGUOUS Result | 同上（ORIGINAL と同表示） | — | 25 recipes では **到達不能**（重複集合 0、全 recipe が自集合で UNIQUE_MATCH。sim で確認） | — | — | — |
| 16 | FAILED（Free Cooking） | `freeCook.ts` `evaluateFreeCookCompletion` | 焼き/空の失敗理由 | 焼き窓外・空 | L0 | △ | なし。ただし **matcher を呼ばないので、組み合わせが正しくても焦げると何も分からない** |
| 17 | ALREADY_DISCOVERED Result | `ResultPanel` 既知 layout | 「○○ができた！（発見済み）」 | 既知 recipe 一致時 | — | ✕ 近くの未発見への手がかりなし | なし |
| 18 | Free Cooking tray | `IngredientTray.tsx`（free-cook は所持全材料、ページング） | 所持材料の一覧 | 常時 | — | △ **新しく入荷した材料の NEW 印が無い**（Shop で買った後は、どれが新材料か覚えておく必要がある） | なし |

\* Level は Discovery / Recipe Dex 2.0 Fresh Design §4.1 の L0〜L5（L1 = 存在だけ、L2 = 名前、L3 = 材料の一部、L4 = 見本、L5 = 完全 recipe）。

### 1.2 Discovery state ごとの評価

| state | どこで伝わるか | 「次に何を試せるか」 | 評価 |
|---|---|---|---|
| `DISCOVERABLE` | HOME / Pizza Select / Dex 🎨（すべて L1） | 「今の材料で作れる」ことだけ。**どの材料を・どのソースで・何種類か** は分からない | ❌ Owner 問題の中心 |
| `KNOWN_BUT_MISSING_MATERIAL` | HOME / Pizza Select / Dex 🏪 / Shop NEW 行 | Shop で買えばよい | ○（actionable）。ただし在庫 0 で KBMM に戻ったケースは HOME 吹き出しが NEW 材料しか見ない（Dex 🏪 だけが拾う） |
| `UNKNOWN` | Dex「まだ見ぬピザ」だけ | 何もしなくてよい（P-4） | ○（設計どおり） |
| first Margherita（Dex 0） | HOME / Pizza Select / escalation Lv1〜3 | 不一致を重ねると答えまで出る | △ 下記 §6 の 3 問題あり |

### 1.3 役に立たない / 曖昧すぎるヒント

- **H-U1**: Free Cooking の「ヒント」ボタン（#5）は Dex ≥ 1 では操作説明しか返さない。押すたびに同じ文。
- **H-U2**: Dex 🎨 の CTA「フリークッキングで探す」（#8）は Free Cooking を開くだけで、その枠についての手がかりに繋がらない（ループ）。
- **H-U3**: ORIGINAL（#13）は距離ゼロ情報。「惜しい」と「全然違う」が区別できない。
- **H-U4**: INCOMPLETE_MATCH（#14）の「ソースを変えてみよう」は誤誘導。
- **H-U5**: HOME/Pizza Select/Dex の L1 文言が 3 画面で同じことを繰り返すだけで、深い情報への入口が無い。

### 1.4 情報の dead-end（ハードな dead-end は無い）

| id | 状態 | 何が起きるか |
|---|---|---|
| **DE-1** | Dex ≥ 1、DISCOVERABLE = 1、自然な推測（§9.3）を試し終えた | **以後どの画面からも追加情報が出ない**。step 8 以降は常にここに落ちる |
| **DE-2** | Dex 0 で不一致を重ねた後に reload | `preDiscoveryFreeCookAttempts` は transient（`gameReducer.ts:183-193`、save されない）→ escalation が Lv0 に戻る。しかも Lv は「ヒント」ボタンでは上げられない（自動のみ） |
| **DE-3** | 正しい組み合わせだが焼き窓を外した（FAILED） | matcher が呼ばれないので「組み合わせは合っていた」ことが分からず、正解の組み合わせを捨ててしまう |
| **DE-4** | Dex 🎨 → Free Cooking | H-U2 のループ |
| **DE-5** | 当てずっぽうで finite 材料を消費し続ける | 1 pack = 10 pizzas。ORIGINAL は Pitz 0。在庫 0 → KBMM → 補充 Pitz（30〜60）が要る。発見済み recipe を作り直せば Pitz は稼げるので hard dead-end ではないが、**ヒント不足が economy の消耗に変換される** |

---

## 2. Discoverable-first hint target

### 2.1 対象の原則

- 主ヒントの対象は **`recipeDiscoveryState === "DISCOVERABLE"` の未発見 recipe だけ**（既存の派生関数。所持 + 在庫 ≥ 1 + starter は無限）。
- DISCOVERABLE が 0 件で KBMM ≥ 1 件なら、**Shop 誘導ヒント**（材料名は Shop に既に出ている NEW 行の材料だけ。recipe の情報は出さない）。
- UNKNOWN は **どこでも話題にしない**（P-4 を維持）。まだ入手できない材料が要る recipe を主ヒントにしない。
- DISCOVERED は除外（guided round と Dex で L5 が見られる）。

### 2.2 target 選択規則（決定的、ランダムなし）

```
candidates = RECIPES.filter(r => recipeDiscoveryState(r, inputs) === "DISCOVERABLE")
sort by:
  1. recipeKeyStep(r)            // ladder 上いちばん近い（= progression 上いちばん手前）
  2. distinct ingredient count   // 少ないほうが先（易しい）
  3. RECIPES declaration index   // 最後の tie-break（安定）
target = sticky ?? candidates[0]
```

- **sticky**: そのセッションで H1 以上を開示した target は、発見されるか DISCOVERABLE でなくなる（在庫 0 など）まで target のまま。
  途中で target が入れ替わって開示内容が矛盾するのを防ぐ。
- 「最近試していない」は使わない（round をまたぐ試行履歴が要り、W1 は保存していない。決定性も下がる）。
- W1 25 ladder では DISCOVERABLE は常に 1 件なので、実質「今の 1 件」。複数になるのは migration save（15-ladder の entitlement union）と Post-W1 の分岐 ladder。
- Dex の枠から開いた場合（§7）は、**その枠の recipe を target にする**（その枠が DISCOVERABLE の場合だけ）。

### 2.3 KBMM / 全発見のときの sheet

| 状況 | sheet の中身 |
|---|---|
| DISCOVERABLE = 0、KBMM ≥ 1（新材料未購入） | 「🏪 ショップに入荷した材料で、新しいピザが作れそう！」+ [ショップを見る] |
| DISCOVERABLE = 0、KBMM ≥ 1（所持済みだが在庫 0） | 「📦 材料が足りないみたい。ショップで補充しよう」+ [ショップを見る]（どの材料かは Shop 側の在庫表示で分かる） |
| 全 25 発見 | 「🏆 図鑑コンプリート！好きなピザを作ろう」 |

---

## 3. Progressive hints（generic hint-generation rule）

### 3.1 W1 runtime で使える axis / 使えない axis

`signatureOfPizza` の observation（`src/logic/discovery/signature.ts`）を正とする。

| axis | W1 で使えるか | 根拠 |
|---|---|---|
| key ingredient（その recipe の最後に解放される材料） | ✅ | `ingredientSet` OBSERVED、`recipeKeyStep` |
| sauce / base | ✅ | `sauceBase` OBSERVED。**25 件すべてソースあり**（tomato 17 / olive-oil 4 / pesto 4） |
| ingredient count（種類数、ソース込み） | ✅ | 集合の大きさ（identity は presence-only） |
| cheese presence / type | ✅ | `category === "cheese"`。チーズなし 5 件（marinara / fugazza / pizza-bianca / pesto-tonno / puttanesca） |
| meat / vegetable / seafood | ⚠ **データに無い**（category は sauce/cheese/topping の 3 つだけ）。表示専用の分類データを足せば使える → OD-HINT-4（任意、H2-6） |
| cooking mechanic | ❌ capabilities は全 recipe `[]`、`cook` は FIXED_BY_FLOW |
| shape / style | ❌ `shape` / `zones` は UNAVAILABLE |
| post-bake step（CUT 等） | ❌ identity ではない（signature の注記どおり） |
| 量（minCount） | ❌ identity ではない（Issue #215 OD-5）。ヒントに「たくさん」等を出すと誤誘導 |

### 3.2 hint ladder（H1〜H4、すべての recipe に同じ規則）

| Level | axis | 文の型（例） | 開示 |
|---|---|---|---|
| **H0**（sheet を開いた直後） | 存在 + 件数 | 「今の材料で、まだ見つけていないピザが作れそう！」 | L1（既存と同じ） |
| **H1** | key ingredient | 「**{key}** を使うピザが作れそう！」 | L3（1 材料） |
| **H2** | sauce / base | 「ソースは **{sauce}** みたい」 | L3（+1） |
| **H3** | ingredient count + cheese | 「材料は全部で **{n}種類**。チーズは **使わない** / **{cheese…}** を使うみたい」 | L3（+count +cheese） |
| **H4**（繰り返し押せる） | 残りの材料を 1 つずつ | 「**{ingredient}** も使うみたい」 | L3（強）。**最後の 1 つは明示しない** |
| （H5、任意） | 最後の 1 つの分類 | 「最後の1つは **お肉** の仲間かも」 | OD-HINT-4 の分類データがある場合だけ |

生成規則（generic）:

1. `T = distinct(requiredIngredients)`、`key = recipeKeyStep` を決めた材料（starter だけの recipe は onboarding 規則 §6）。
2. 開示順は **key → sauce → count/cheese → 残りの topping（`RECIPES` 内の宣言順）**。同じ材料は 2 回出さない（key がソースの場合 = fugazza の olive-oil、pesto-tonno の pesto は H2 を「count」に繰り上げる）。
3. **n−1 cap**: 明示的に名前を出す材料は最大 `|T| − 1`。次の段がそれを超える場合は、その段を粗い形にする
   （例: pizza-bianca（2 材料）は H1 rosemary の次の H2 を「ソースはトマトじゃないみたい」→ H3「材料は2種類だけ」とし、olive-oil の名前は出さない）。
   所持材料が少ないため **暗黙に推理できてしまうのは許容**（推理は player 自身の発見。材料も消費する）。
4. チーズ行は「使わない」を必ず明示する（§9.3 の組み直し型で最大のつまずき）。
5. すべての文は **材料名・ソース名・数字だけ**で組み立てる。recipe 名 / 見本画像 / 説明文 / 名前の文字数 / 章内 No. を参照しない（test で固定）。

### 3.3 25-recipe での開示効果（sim、Dex = ladder 順、全材料購入）

所持材料から作れる組み合わせのうち、各段の情報と矛盾しない数（小さいほど絞れている）。

| Dex | target | 全体 | H1 key | H2 +sauce | H3 +count | H3 +cheese | H4 (n−1) |
|---:|---|---:|---:|---:|---:|---:|---:|
| 0 | margherita | 7 | 4 | 2 | 1 | 1 | 1 |
| 1 | bismarck | 15 | 8 | 4 | 2 | **1** | 1 |
| 2 | breakfast-pizza | 31 | 16 | 8 | 3 | 2 | 2 |
| 4 | melanzane-pizza | 127 | 64 | 32 | 10 | 4 | 4 |
| 8 | meat-lovers | 2,047 | 1,024 | 512 | 126 | 35 | 5 |
| 11 | capricciosa | 32,767 | 16,384 | 8,192 | 715 | 165 | 9 |
| 13 | fugazza | 98,303 | 32,768 | 32,768 | 105 | 78 | 12 |
| 17 | pesto-tonno | 1,048,575 | 262,144 | 262,144 | 816 | 560 | 14 |
| 19 | new-haven-apizza | 4,194,303 | 2,097,152 | 524,288 | 171 | 17 | 17 |
| 23 | puttanesca-pizza | 67,108,863 | 33,554,432 | 8,388,608 | 1,771 | 1,330 | 19 |
| 24 | quattro-formaggi | 268,435,455 | 134,217,728 | 33,554,432 | 2,300 | **1** | 1 |

（全 25 行は `docs/reports/data/TETO_DISCOVERY-HINT-2_simulation.txt`）

- H4 まで開くと、残りは「最後の 1 材料を所持 topping から選ぶ」だけ（最大 19 通り）。§4 の near-miss「あと1つ足りない」と組み合わせると、
  **どの step でも有限回（≤ 所持 topping 数）で到達可能**。H5（分類）があれば 2〜6 通りまで落ちる。

---

## 4. Near-miss feedback（おしい）

### 4.1 distance の定義（W1 で比較可能な axis だけ）

比較するのは `signatureOfPizza` の **`ingredientSet` と `sauceBase`（どちらも OBSERVED）だけ**。量・位置・焼き・CUT・形は使わない。

```
P = pizza の ingredientSet、T = 候補 recipe の集合
missing = T \ P（ソース以外）、extra = P \ T（ソース以外）、sauceWrong = sauceBase(P) ≠ sauceBase(T)
d = |missing| + |extra| + (sauceWrong ? 1 : 0)
```

| class | 条件 | 表示（例） |
|---|---|---|
| `ADD_ONE` | d=1、missing 1 | 「🤏 おしい！ 未発見のピザにかなり近いよ。**材料を1種類足して**みよう」 |
| `REMOVE_ONE` | d=1、extra 1 | 「🤏 おしい！ …**材料を1種類減らして**みよう」 |
| `SAUCE_ONLY` | d=1、sauceWrong だけ | 「🤏 おしい！ …**ソースを変えて**みよう」 |
| `CLOSE` | d=2（入れ替え 1 / 2 つ足りない / 2 つ多い / ソース + 1） | 「👀 未発見のピザに近づいてるよ！」（方向は言わない） |
| far | d ≥ 3 | 既存の ORIGINAL 文 +（key 材料を使っていないとき）「新しく入荷した材料は使ってみた？」 |

### 4.2 matcher authority との関係（矛盾しない条件）

- near-miss は **matcher の結果を変えない後段の表示分類**。`resolveFreeCookPizza` / `evaluateDiscovery` / Dex 書き込みには触れない。
- 評価するのは結果が `ORIGINAL`（NO_MATCH）と `ALREADY_DISCOVERED` のときだけ。
  - `NEW_DISCOVERY` → いつも通り発見（exact match は常に発見が勝つ）。
  - `ALREADY_DISCOVERED` → 発見済み表示はそのまま、**追加 1 行**「ここから1つ変えると、まだ見つけていないピザになりそう！」（d=1 のとき）。
    例: bismarck（発見済み）+ bacon = breakfast-pizza。
  - `INCOMPLETE_MATCH` → 集合は一致しているので near-miss ではない。文言を「**ソースの量**や焼き加減を見直してみよう」に直す（H-U4）。
  - `AMBIGUOUS` → 現在到達不能。将来到達したら **near-miss を出さない**（どの target か確定していないため）。
  - `FAILED` → 既定は near-miss なし。OD-HINT-5 で「組み合わせはいい線！焼き加減を…」（exact かつ DISCOVERABLE のときだけ）を選べる（DE-3）。
- 比較対象は **DISCOVERABLE の未発見 recipe だけ**（UNKNOWN と比べると、まだ作れない recipe の存在を漏らす）。
- 複数の DISCOVERABLE が同じ最小 d のとき: §2.2 と同じ順序で 1 件に決め、**方向は d=1 のときだけ**出す（決定的）。
- **どの材料を足す / 減らすかは言わない**（それは H4 の役割）。recipe 名は出さない。

### 4.3 自然な推測に対する near-miss（sim）

各 step の key recipe に対し、A =「一番近い発見済み + 新材料」、B =「トマトソース + モッツァレラ + 新材料」を投げた結果:

| step | target | A | B |
|---:|---|---|---|
| 1 | bismarck | REMOVE_ONE | **EXACT** |
| 2 | breakfast-pizza | **EXACT** | ADD_ONE |
| 3 | funghi | REMOVE_ONE | **EXACT** |
| 4 | melanzane-pizza | **EXACT** | ADD_ONE |
| 5 | parmigiana-pizza | **EXACT** | CLOSE |
| 6 / 7 | pepperoni / salsiccia | REMOVE_ONE | **EXACT** |
| 8 | meat-lovers | CLOSE(d2) | far |
| 9 | bambino | CLOSE(swap) | ADD_ONE |
| 10 | hawaiian | REMOVE_ONE | ADD_ONE |
| 11 | capricciosa | ADD_ONE | CLOSE |
| 12 | pizza-portuguesa | CLOSE | far |
| 13 | fugazza | far | far |
| 14 | marinara | far | CLOSE(swap) |
| 15 / 16 | napoletana / tonno-e-cipolla | CLOSE(swap) | ADD_ONE |
| 17 | pesto-tonno | far | far |
| 18 | genovese | CLOSE | SAUCE_ONLY |
| 19 | new-haven-apizza | far | far |
| 20 | pesto-caprese | SAUCE_ONLY | CLOSE |
| 21 | pesto-patate | CLOSE(swap) | CLOSE |
| 22 | pizza-bianca | CLOSE | CLOSE |
| 23 | puttanesca-pizza | far | far |
| 24 | quattro-formaggi | far | CLOSE |

→ step 1〜7 は自然な推測で当たる。step 8〜24 の 17 step は EXACT 0 件。うち 13 step はどちらかの推測に near-miss（d ≤ 2）が効くが、
d=1（方向つき）まで届くのは 7 step（9, 10, 11, 15, 16, 18, 20）。**fugazza / pesto-tonno / new-haven / puttanesca の 4 step は両方の推測が d ≥ 3 → progressive hint（H2 ソース / H3 チーズなし）が必須**。

---

## 5. Anti-spoiler levels（強さの比較）

| 強さ | 出すもの | 例 | 長所 | 短所 |
|---|---|---|---|---|
| **A: 方向だけ**（現状の L1） | 作れる件数・行き先 | 「今の材料で作れるかも」 | 漏れ 0 | Owner が「役に立たない」と判断済み（DE-1） |
| **B: 構成の骨格** | key 材料 / ソース / 種類数 / チーズ有無 | H1〜H3 | 組み直し型（ソース変更・チーズなし）を解ける。名前・見た目は守れる | 小さい recipe（2〜3 材料）は暗黙に推理できる |
| **C: かなり具体的** | 最後の 1 つ以外の全材料（+ 分類） | H4（+H5） | どの step も有限回で到達 | 探す楽しさは「最後の 1 つ」だけに縮む |
| （参考）D: 答え | 全材料 | Dex 0 Lv3 のみ | — | onboarding 以外では出さない |

**推奨**: A を常設（既存の HOME / Dex / Pizza Select）、**B と C は「もう少しヒントを見る」で 1 段ずつ**、自分から押したときだけ出す。
**Pitz 消費などのペナルティは付けない**（詰まった人を助ける機能。economy punishment にしない）。
抑止は「押した回数だけ情報が増える」ことと、sheet の文言（「自分で見つけたい人は閉じてね」）だけで十分。スコア・★・Pitz に影響させない。

---

## 6. First discovery（Margherita onboarding）

現状: starter 3 材料（tomato-sauce / mozzarella / basil）だけで、所持組み合わせは 7 通り。Lv1〜3 は **不一致の回数で自動上昇**、Lv3 = 答え（LK-6、意図された例外）。

| 問題 | 内容 | 提案 |
|---|---|---|
| F-1 | 初回は「ヒント」ボタンを押しても操作説明だけ（Lv は失敗でしか上がらない） | Dex 0 でも sheet を開けるようにし、**H1〜H3 を手動で開示可**（onboarding は「全部使うよ」まで許可 = 既存 Lv3 相当）。自動 escalation は残す（手動と自動の高いほうを表示） |
| F-2 | reload で escalation がリセット（DE-2） | 自動 escalation の counter は transient のまま（save schema 変更なし）。F-1 の手動開示があるので実害が消える |
| F-3 | 7 通りしかないのに、初回 attempt 0 の常設行が「好きなソースを選んでぬろう（なしでもOK）」で、全部使うと言っていない | Dex 0 の常設行だけ「3つの材料を全部つかってみよう！」相当（= 既存 Lv1〜2 の中間）にしてよい。**答えを最初から完全表示はしない**（7 通りなので自力で十分届く） |

Margherita だけは n−1 cap の例外（onboarding、LK-6 の範囲）。Dex ≥ 1 では例外なし。

---

## 7. Dex integration

`UndiscoveredSlot`（`DexOverlay.tsx`）を「ヒントの入口」にする。

| state | 今 | 提案 |
|---|---|---|
| DISCOVERABLE | 🔒 No.xx ？？？ / 🎨 今の材料で作れるかも / [フリークッキングで探す] | 同じ + **[💡 ヒントを見る]**（その枠の recipe を target にした同じ bottom sheet を Dex 上で開く）。sheet の下に [フリークッキングで作る] |
| KNOWN_BUT_MISSING_MATERIAL | 🏪 ショップの材料で作れるかも / [ショップを見る] | そのまま（§2.3 の Shop 誘導 sheet を開いてもよいが、CTA は Shop） |
| UNKNOWN | まだ見ぬピザ | そのまま。ヒントなし（P-4） |

leak 再発防止:

- 枠には **既存どおり名前・見本・材料・名前の文字数を出さない**。sheet の中身は §3 の規則だけで作る（枠の位置 = 章と No. が key 材料と結びつくのは許容。名前ではない）。
- 開示済み Level はセッション内の transient state（`GameState` 側、save しない）を Free Cooking と共有する（Dex で H2 まで見たら Free Cooking でも H2 から）。
- Dex の DOM に未発見の `nameJa` / `description` / 画像 src が 0 件であることを既存の leak test（LK-* 系）に追加して固定。

---

## 8. Mobile UX（390×844 / 360×800 優先）

I5b-4b / I5b-5 の Layout Contract（stage だけが伸縮、pager は常に予約、CTA bar は in-flow、safe-area、tabs）を壊さないことが条件。

| 案 | 縦の圧迫 | 評価 |
|---|---|---|
| 常設 hint panel を増やす | ✕ 増える | **不可**（I5b-4b で「FREE TOPPING after hint −80px」を直したばかり） |
| order-card の 1 行を段階的に長くする | △ clip / 2 行化 | 不可（`.order-card__hint` の clip は Issue #159 で既知） |
| popover（ボタン横の吹き出し） | ○ | 情報量（材料 chip + 段階ボタン）が入らない |
| **bottom sheet（overlay、`position: fixed`）** | ◎ 0（layout に参加しない） | **推奨** |
| full modal | ◎ 0 | 重い。Free Cooking の文脈（tray / stage）が見えなくなる |

推奨 UI（Free Cooking）:

```
┌ CTA bar（既存） ─────────────────────┐
│ [やり直す] [次へ →] [💡 ヒント]      │  ← 既存の「ヒント」ボタンを流用（新しい行を足さない）
└──────────────────────────────────┘
        ↓ tap
┌ bottom sheet（max-height 45dvh、下端 safe-area 内） ┐
│ 🧑‍🍳 Mito: 今の材料で、まだ見つけていないピザが作れそう！ │
│  ✔ 🥚 たまご を使うみたい              (H1)       │
│  ✔ 🍅 ソースは トマトソース            (H2)       │
│  ？ …                                              │
│ [もう少しヒントを見る]   [閉じる]                  │
│ 自分で見つけたい人は閉じてね                        │
└──────────────────────────────────────┘
```

- sheet は stage / tray / pager / CTA bar の DOM 位置を動かさない（Layout Contract LC-0〜5 の不変条件をそのまま検査に使う）。
- 開いている間は背面を `inert`。閉じるとフォーカスを「ヒント」ボタンに戻す。
- 開示済みの材料は `IngredientGlyph` の chip（名前付き）で出す。**recipe の画像は出さない**。
- 任意: 開示済みがあるときだけ「ヒント」ボタンに小さな点（高さは増えない）。
- Result の near-miss は既存 `original-pizza__lead` の 1 行差し替え + actions 行に [💡 ヒントを見る]（Result は既にスクロール可能な one-screen 設計の範囲内）。
- Free Cooking tray の新材料 NEW 印（DE-4 補助）は chip 内のバッジで、行の高さを増やさない（任意、H2-2）。

---

## 9. 25-recipe simulation

方法: W1 `fc8a4be` の実 data / 実関数（`RECIPES`、`DISCOVERY_LADDER`、`recipeDiscoveryState`、`recipeKeyStep`、`matchDiscovery`）を
throwaway の vitest script から呼んだ（repo の test suite には入れていない。script は `docs/reports/data/TETO_DISCOVERY-HINT-2_sim-scripts.txt`）。

### 9.1 前提の確認

- catalog 29 行 / obtainable 29（W1 ladder 24 step + starter 3。I5a 時点の「obtainable 22」は I5b-3 で 29 になった）。
- 25 recipes に **重複集合 0**、**全 recipe が自集合で UNIQUE_MATCH**（AMBIGUOUS は到達不能）。
- 全 recipe が sauce を 1 つ持つ。チーズなし 5 件。

### 9.2 全 progression ladder（3 つの選択方針で機械検証）

方針 `hintTarget`（§2.2）/ `lastDeclared` / `mostIngredients` の 3 通りで Dex 0 → 25 を歩いた。**3 通りとも同じ列**になる（どの Dex でも DISCOVERABLE が 1 件なので方針が効かない）。

| 区間 | Dex | 所持材料 | 組み合わせ数 | DISCOVERABLE | KBMM（未購入時） | UNKNOWN |
|---|---:|---:|---:|---|---:|---:|
| fresh | 0 | 3 | 7 | 1（margherita） | 0 | 24 |
| Dex 1 | 1 | 4 | 15 | 1（bismarck） | 1 | 23 |
| early | 2〜7 | 5〜10 | 31〜1,023 | 1 | 1 | 22〜17 |
| mid | 8〜14 | 11〜18 | 2,047〜196,607 | 1 | 1 | 16〜10 |
| late W1 | 15〜24 | 19〜29 | 393,215〜268,435,455 | 1 | 1 | 9〜0 |

- **ハードな dead-end: 0**（どの Dex でも DISCOVERABLE か KBMM が 1 件）。
- **「発見可能なのに hint から合理的に到達できない」状態**:
  - 現行 runtime: step 8〜24 の **17 / 24 step**（DE-1。自然な推測が外れた後に追加情報が 0）。
  - 提案 Hint 2.0: **0 / 25**（H1〜H4 で残り 1 材料まで絞れ、ADD_ONE near-miss と合わせて ≤ 所持 topping 数の試行で必ず届く）。

### 9.3 どこで詰まるか（組み直し型）

- step 8 meat-lovers: 4 種の肉を全部（2 つ足りない）。
- step 13 fugazza / 22 pizza-bianca / 19 new-haven: **トマトソースとモッツァレラを両方外す**必要がある（olive-oil base、チーズなし or parmigiano）。
- step 17 pesto-tonno / 20 pesto-caprese / 21 pesto-patate / 18 genovese: **ソース変更**。
- step 23 puttanesca: チーズなし + 5 材料。step 24 quattro-formaggi: olive-oil + 4 チーズ。
→ H2（ソース）と H3（チーズの有無）を H4 より先に出す順序はこの分布から決めた。

---

## 10. Test plan（実装時）

| # | test | 種類 | 内容 |
|---|---|---|---|
| T-1 | undiscovered recipe name leak = 0 | unit + DOM | 全 25 recipe × 全 Dex 状態（ladder 0〜24）× H0〜H4 × near-miss 全 class で、生成文に未発見 recipe の `nameJa` / `description` / id が含まれない。Free Cooking sheet / Result / Dex sheet の DOM も同様 |
| T-2 | undiscovered image leak = 0 | DOM | sheet / Result / Dex に `ReferenceThumbnail` / `PlayerReferencePreview` / 見本 canvas が未発見 target で mount されない |
| T-3 | discoverable-first | unit | target は常に DISCOVERABLE。DISCOVERABLE 0 + KBMM ≥1 は Shop 誘導、UNKNOWN は一度も target にならない（25 ladder 全 step） |
| T-4 | deterministic | unit | 同じ入力で同じ target / 同じ文。`RECIPES` 以外の順序（Dex 配列順、inventory の key 順）に依存しない。sticky target |
| T-5 | progressive levels | unit | H1→H4 の順、同じ材料を 2 回出さない、**n−1 cap**（Dex ≥ 1 で明示材料 ≤ \|T\|−1）、key がソースの recipe（fugazza / pesto-tonno）の繰り上げ、pizza-bianca の粗い H2 |
| T-6 | near-miss +1 | unit | bismarck 集合 → breakfast-pizza が target のとき ADD_ONE |
| T-7 | near-miss −1 | unit | margherita + egg → bismarck が target のとき REMOVE_ONE |
| T-8 | wrong sauce | unit | tomato + mozzarella + cherry-tomato → genovese が target のとき SAUCE_ONLY |
| T-9 | exact match still discovery | reducer | near-miss 導入後も exact 集合は NEW_DISCOVERY、Dex / Pitz / material unlock が既存どおり（`gameReducer.discovery` 系の回帰） |
| T-10 | ambiguous | unit | 人工 catalog（重複集合）で AMBIGUOUS のとき near-miss を出さない |
| T-11 | known recipe excluded | unit | DISCOVERED は target / near-miss 対象にならない。ALREADY_DISCOVERED + d=1 のときの追加 1 行 |
| T-12 | stock / ownership | unit + reducer | 所持だが在庫 0 → KBMM（補充誘導）、stock 1 でも DISCOVERABLE、starter は無限。hint を見ても在庫・Pitz が変わらない（ペナルティ 0） |
| T-13 | first Margherita | reducer + UI | Dex 0 で sheet を開ける、手動開示と自動 escalation の max、onboarding だけ全材料開示可、Dex 1 以降は不可 |
| T-14 | Dex integration | UI | 🎨 枠の [ヒントを見る] がその枠の recipe を target にした sheet を開く。🏪 は Shop、UNKNOWN はボタンなし。Dex と Free Cooking で開示 Level を共有 |
| T-15 | save compatibility | unit + e2e | save schema / `schemaVersion` 不変、開示 Level は保存されない、旧 save（15-ladder migration、複数 DISCOVERABLE）で target 選択が決定的 |
| T-16 | 390×844 | e2e（Layout Contract） | sheet open/close の前後で stage / pager / CTA bar / tabs の bbox が不変、sheet が safe-area 内 |
| T-17 | 360×800 | e2e | 同上 + 最長の文（H3 の 4 チーズ、H4 の長い材料名）が 2 行以内 |
| T-18 | LK-8 regression | unit + e2e | `canStartGuidedRound` / `App.lk8Backstop` / `gameReducer.lk8Backstop` 系がそのまま通る。sheet / Result / Dex から guided round（見本つき）を未発見 recipe で開始できない |
| T-19 | INCOMPLETE_MATCH copy | UI | 「ソースの量や焼き加減」文言 |
| T-20 | 25-ladder reachability | unit | 全 step で「H4 + ADD_ONE 反復」で target に到達できる（§9.2 の sim を正式 test 化） |

---

## 11. W1 relation

**判断: B — W1 を merge した後の最優先 Post-W1 slice。** 既存 W1 branch には混ぜない。

| 観点 | A（W1 blocker） | B（Post-W1 最優先）★ |
|---|---|---|
| Discovery core の成立性 | 成立性を W1 内で保証できる | step 1〜7（第1章相当）は自然な推測で成立する。**第2章以降は hint 無しでは成立しない**ことを本 audit が示した → merge 直後に着手が必須 |
| scope risk | W1 は既に 278 files / +10k 行、I5b-5 Layout Contract + WebKit + HV で検証済み。hint（domain + sheet UI + near-miss + Dex 入口 + e2e + HV 動画）を足すと **I5b-5 の検証をやり直し**、LK-8 / layout の回帰面も広がる | hint は **加算的**（matcher / Dex / save に触れない）な独立 slice。W1 の検証結果を保ったまま、別 PR で HV を回せる |
| 依存 | — | hint は W1 の `recipeDiscoveryState` / `recipeKeyStep` / 25-ladder に依存するため、**W1 merge 後でないと実装できない**（main は 15 recipes） |
| ユーザー影響 | — | `main` push → Pages deploy（`.github/workflows/deploy.yml`）。W1 merge 時点で旧 runtime の「実質ヒント（leak）」が消えるので、**late-game の discoverability は main より一時的に下がる**。これは Owner が承知のうえで受け入れる regression として記録する |

条件（推奨）:

1. W1 merge の Result / handoff に「Discovery Hint 2.0 未実装。第2章以降は hint 不足（本 audit DE-1）」を明記。
2. merge 直後に本 Issue の H2-1（domain）→ H2-2（Free Cooking sheet）を最優先で着手。H2-2 までで DE-1 / DE-2 / DE-4 は解消する。
3. W1 merge 前に Owner がどうしても late-game を触る予定なら、その時点で A に切り替える判断を Owner に委ねる（OD-HINT-6）。

---

## 12. Issue

Duplicate Gate: open issues 22 件（#22〜#224）と `hint` / `Discovery` 検索で、Discovery Hint 改善を扱う Issue は **無い**。
近いもの: #182（PIZZA DB 全量の発見・アンロック再設計、親テーマ）、#215（Completion Gate、INCOMPLETE_MATCH の周辺）、
#88 / #39（Pizza Select、hint は EP1 文脈）。いずれも本件の重複ではない → 新規 Issue **#229**（https://github.com/perusonao/teto-pizza-game/issues/229）を作成（#182 を親テーマとして参照）。

---

## 13. Recommended implementation phases

| phase | 内容 | 触る場所 | 検証 |
|---|---|---|---|
| **H2-0** | OD gate（下表） | docs | Owner 決定 |
| **H2-1** | 純関数（unwired）: `selectHintTarget` / `buildHintSteps` / `classifyNearMiss` + leak / 決定性 / n−1 / 25-ladder reachability test | `src/logic/discovery/hint*.ts`（新規） | T-1, T-3〜T-8, T-10, T-11, T-20 |
| **H2-2** | Free Cooking bottom sheet（既存「ヒント」ボタン）、transient 開示 state、Dex 0 onboarding 統合、tray の NEW 印（任意） | `hints.ts`、`gameReducer.ts`（SHOW_HINT 拡張）、`GameScreen.tsx`、新 `HintSheet.tsx`、CSS | T-2, T-12, T-13, T-15〜T-17、HV 動画 |
| **H2-3** | Result near-miss、ALREADY_DISCOVERED の 1 行、INCOMPLETE_MATCH 文言、[💡 ヒントを見る] | `ResultPanel.tsx`、`App.tsx` | T-9, T-11, T-19、HV |
| **H2-4** | Dex 🎨 枠の [ヒントを見る] → sheet | `DexOverlay.tsx`、`App.tsx` | T-14, T-18、HV |
| **H2-5** | 検証まとめ（Layout Contract / WebKit / LK-8 / HV 390×844・360×800） | e2e | 全体 |
| H2-6（任意） | 材料の表示専用分類（肉 / 魚介 / 野菜 / ハーブ…）で H5 | `ingredients.ts`（表示 data のみ） | T-5 拡張 |

### Owner decisions

| id | 問い | 推奨 |
|---|---|---|
| OD-HINT-1 | H1 で key 材料名を出すか（Discovery 2.0 §12.1 は Lv2 だった） | **出す**（Result / Shop が既に実質的に出している。方向だけの L1 は Owner が不十分と判断済み） |
| OD-HINT-2 | near-miss で方向（足す / 減らす / ソース）を出すか（= OD-DISC-7） | **d=1 のときだけ出す**、どの材料かは出さない |
| OD-HINT-3 | 最大開示を n−1（最後の 1 つを伏せる）にするか（= OD-DISC-8 の Level 4） | **n−1 まで**。答え全部は onboarding だけ |
| OD-HINT-4 | 表示専用の材料分類 data を足して H5 を作るか | Post（H2-6）。H2-1〜H2-5 の成立には不要 |
| OD-HINT-5 | FAILED でも exact かつ DISCOVERABLE なら「組み合わせはいい線」と出すか | **出す**（DE-3 の解消。名前は出さない） |
| OD-HINT-6 | W1 との関係 | **B**（§11） |
| OD-HINT-7 | 開示 Level を保存するか | **保存しない**（transient、save schema 変更なし） |
| OD-HINT-8 | ヒントにペナルティを付けるか | **付けない** |
