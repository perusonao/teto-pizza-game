# Lunch Rush — Material-Shortage Skip: Fresh Audit / Design

- **Audited SHA:** `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（`origin/main` HEAD = PR #228 W1 I5a のマージ。ローカル HEAD と一致を確認）
- **Branch:** `claude/lunch-rush-shortage-skip-audit-p8whp9`（docs のみ）
- **種別:** Fresh Audit と設計のみ。production code / tests / save schema / scoring / inventory / recipe data の変更なし。PR・merge・deploy なし。
- **関連 OPEN PR:** #213（Phase 3-4F Lunch Rush stock-aware mission pool Fresh Audit、docs のみ、未マージ）。本監査はその結論を現 HEAD で再確認し、shortage skip 案と比較する。

---

## 1. 現在の Lunch Rush order selection 仕様（現 HEAD で確認）

経路:

```
HOME「ランチラッシュ」 App.handleStartLunchRush (App.tsx:758)  guard: hasAnyDiscovery
 └ SHOW_INTRO → MissionIntroOverlay → App.startMission (App.tsx:468)
     ├ missionDispatch START（clock 開始。以降 ORDER 画面中も時間は減る）
     └ dispatch MISSION_RESET_ORDER → nextMissionOrderState (gameReducer.ts:485)
         ids  = availableRecipeIds(dex, ownedIngredientIds)   (progression.ts)
              = recipeUnlocked(発見済みは常に true) AND 必要材料がすべて OWNED
         pool = ids ∩ discovered                             (lunchRush.ts pickMissionOrder)
         pool 空 → null → `return state`（fail-closed）
         getNextOrder: avoidRepeat(直前 recipe 除外、pool=1 なら除外しない) → pickRandom
```

| 観点 | 現仕様 |
|---|---|
| 1. 候補決定 | discovered ∩ available の一様ランダム、直前と同じ recipe を回避 |
| 2. discovered recipe | 必須（Issue #200）。未発見は絶対に出ない |
| 3. owned ingredient | 必須（`ingredientsOwned`）。OWNED は在庫 0 になっても外れない |
| 4. inventory stock | **一切見ていない** |
| 5. 決定時の stock 不足除外 | **されない** |
| 6. 提供後の再評価 | pool は毎注文で再計算されるが、入力が dex/owned だけなので在庫減少は反映されない |
| 7. starter 材料 | tomato-sauce / mozzarella / basil の 3 種のみ `unlockCondition` なし＝構造的に無限（`hasStock`/`consumePizzaInventory` とも除外）。これだけで作れるのは **margherita のみ** |

## 2. stock 不足注文は現在起こり得るか — **起こり得る（main で到達可能）**

- 有限材料は `purchaseFirstPack` で OWNED + 在庫付与。その後 `CONFIRM_BAKE` の `consumePizzaInventory` で減り、0 にクランプされても OWNED のまま。
- よって「発見済み・OWNED・在庫 0（または minCount 未満）」の recipe が普通に注文される。
- その注文は:
  1. Stock Gate（`canPlaceIngredient`）で不足材料のチップが disabled（×0 表示）。minCount まで置けない。
  2. それでも PREPARE→BAKE は進める（DOUGH 以外の step に完了 gate なし）。
  3. Completion Gate は Lunch Rush では `"order"` policy（minCount 必須）なので **必ず FAILED**。
  4. MissionServePanel の「注文失敗 🚫」→「次の注文へ」。metrics 不変、`serves[]` に FAILED 記録。
  5. **置いた分の有限在庫は消費される**（部分消費。0 クランプ）。
  6. `MISSION_NEXT_ORDER` は `registerScoreToDex` を completion 無条件で呼ぶので **FAILED でも timesMade が +1**（既存挙動、今回スコープ外の所見）。
- 抜ける手段は「作れないと分かっていて最後まで作って FAILED」か「HOME で run 放棄」のみ。Mission 中は Shop に入れない。
- #213 のシミュレーション（2 recipe 中 1 つ不足 → avoidRepeat により作れる方の次は必ず不足側、注文の 50%）は、該当コード（`avoidRepeat`/`pickMissionOrder`）が #213 監査時から変わっていないため現 HEAD でも成立。

## 3. stock 消費後の次注文の挙動

- 在庫が減るのは `CONFIRM_BAKE` の 1 点のみ（`phase !== "BAKE"` guard で exactly-once）。
- 次注文（`MISSION_NEXT_ORDER` → `nextMissionOrderState`）は消費後 state で pool を作るが、在庫を見ないので、今焼いた 1 枚で在庫 0 になった recipe もそのまま候補に残る。
- 注文決定後、その 1 枚の調理中に**他の経路で**在庫が減ることはない（Shop 不可、消費は bake 時のみ、tray は当該 recipe の必須材料のみ）。したがって「注文時点で足りていたのに調理中に不足する」ケースは存在しない（item 8）。不足は常に「注文決定時点ですでに不足」。
- 余分に置いた（minCount 超過）分も消費されるので、次注文時の不足はあり得る → 次注文で判定すれば十分。

## 4. 候補 0 件の挙動（item 9）

- 現データでは発見済み margherita が無限在庫で常に作れるため、**「作れる候補 0 件」は現 main で到達しない**（pool 自体は owned 基準なので空にもならない）。
- ただし潜在バグ 2 件を現 HEAD で再確認:
  - **E2（開始時 pool 空）:** `MISSION_RESET_ORDER` が state をそのまま返し、FREE round（`isMissionRound=false`）の上で PLAYING が走る。App 側 guard は `hasAnyDiscovery` のみ。
  - **E3（途中で pool 空）:** `MISSION_NEXT_ORDER` が phase=RESULT のまま返り、`handleMissionServeNext` が無条件に出す `BEGIN_PREPARE`（phase guard なし, gameReducer.ts:593）で**焼成済み pizza が PREPARE に戻る**。
- 3-4C（unit 移行）や W1 以降の recipe/material 追加で margherita 保証が崩れると到達可能になる。shortage skip 実装時は同時に塞ぐべき。

## 5. 現行注文画面の役割（items 10–12）

| 要素 | 現状 |
|---|---|
| 注文会話（ORDER phase） | `dialogue-area` に Mito の注文ライン + Teto のレシピ別ライン、PizzaStage のプレーン生地。**run の最初の 1 注文でしか表示されない**（UX-1 / Issue #85 で 2 枚目以降は `MISSION_NEXT_ORDER`+`BEGIN_PREPARE` 同一 tick で PREPARE 直行） |
| 「ピザを作る！」 | `onBeginPrepare` → `BEGIN_PREPARE`。1 注文目の開始タップのみ。判断要素なし（常に押せる）。ORDER 中も clock は進む |
| 「次の注文へ」 | MissionServePanel（PASS / FAILED 両方）の CTA。`SERVE`（deadline 再検査）→ `MISSION_NEXT_ORDER`（Dex 登録 + 次注文）→ `BEGIN_PREPARE` |

つまり現状の注文会話画面は「run 冒頭の 1 回だけの余分なタップ」で、判断画面としては機能していない。

---

## 6. 提案: MATERIAL-SHORTAGE SKIP

```
次注文決定
 ├ shortage(recipe, inventory) が空 → 現行どおり PREPARE 直行（UX-1 維持、ORDER 画面は出さない）
 └ shortage あり → ORDER 画面で停止
      注文会話（Mito/Teto）
      「材料が足りません」
      不足材料リスト（例: ペスト 0/1、チェリートマト 1/3）
      [この注文をスキップ]   ← 唯一の CTA（「ピザを作る！」は出さない）
      → MISSION_SKIP_ORDER → 次注文（再判定）
```

shortage の定義（pure, 1 か所）:
- 対象 = `recipe.requiredIngredients` のうち有限材料（`unlockCondition` あり）
- 必要量 = scatter: `minCount`（Completion Gate `"order"` policy と同一）、spread/sauce: 1
- 保有 = `remainingStock(ingredient, inventory)`。starter（`"UNLIMITED"`）は常に充足
- `have < need` の材料を `{ingredientId, need, have}` で返す
- 3-4C の unit 移行（片数→use）に備え、#213 が提案した `requiredStockUnits` 相当の seam の裏に置く

## 7. stock-aware filtering との比較（A）

| 観点 | 現行（owned のみ） | B: stock-aware filter（#213 推奨） | S: shortage skip のみ | **H: hybrid（推奨）** |
|---|---|---|---|---|
| 作れない注文 | 出る・抜けられず必ず FAILED | 出ない | 出る・無料で断れる | 出る・無料で断れる |
| 連続不足 | 2 recipe 時 50% | なし | avoidRepeat により交互に不足が来得る | **スキップ直後の注文は必ず作れる** |
| 在庫の「意味」が Lunch Rush で見えるか | 失敗としてだけ | 見えない（黙って出なくなる。「なぜ Genovese が来ない？」） | 見える | 見える |
| 追加 UI | — | なし（0 件時の文言のみ） | 不足画面 | 不足画面 |
| 時間コスト | 1 枚分まるごと | 0 | 読む+1 タップ | 読む+1 タップ（1 回で止まる） |
| deadlock | 潜在 E2/E3 | 0 件 policy 必須 | 全候補不足で skip ループ | 0 件 policy 必須（作れる pool 基準） |
| 複雑さ | — | 最小 | 中 | 中（S + predicate 1 つ） |

H の中身: 通常注文は現行どおり discovered ∩ owned から引く（不足注文も来得る）。**スキップ直後の 1 注文だけ** は stock-aware な makeable pool（discovered ∩ owned ∩ 不足なし）から引く。これで不足注文は「1 回見て 1 タップで断る」に上限が付き、S のループ問題と B の「在庫が見えない」問題を両方避けられる。

## 8. 推奨する最小仕様

**第一推奨: H（hybrid, 材料不足時のみ無料スキップ）**

1. 注文選択は現行 pool（discovered ∩ owned、avoidRepeat）。
2. 決定した注文に `orderShortage` を適用。空なら現行フロー（1 注文目は「ピザを作る！」、2 枚目以降は PREPARE 直行）で**変更なし**。
3. 不足ありなら ORDER で停止し、不足材料と「この注文をスキップ」だけを出す。「ピザを作る！」は出さない。`BEGIN_PREPARE` は reducer で「Mission round かつ不足あり」なら no-op（UI を信用しない backstop）。
4. `MISSION_SKIP_ORDER`（新 action）: guard = `phase === "ORDER" && isMissionRound && shortage 非空`。Dex 登録なし、inventory/score/Pitz/metrics/serves いずれも不変。次注文は **makeable pool** から（avoidRepeat 付き、makeable が 1 件なら繰り返し可）。
5. makeable pool が 0 件:
   - run 開始時 → 開始をブロック（HOME/Intro で「作れるピザがありません。ショップで材料を補充してね」）。E2 を塞ぐ。
   - run 途中（serve 後 / skip 後）→ run を早期終了して Mission RESULT（理由文言付き）。`BEGIN_PREPARE` を出さない。E3 を塞ぐ。
6. タイマーは止めない。追加の時間/score/Pitz penalty・回数制限なし（読む+タップの実時間が自然なコスト）。
7. skip は `serves[]` に追加しない → ランキング提出・サーバ検証（`MAX_SERVES_PER_RUN` など）に影響なし。表示用の skip 数は後回し。

代替（最小変更優先の場合）: **B 単独**（#213 案）。コード量は最小で deadlock 対処も同じだが、在庫切れが Lunch Rush 内で不可視になる。B → 後で H に拡張は容易（makeable predicate は共通）。

### B. ランチラッシュらしさ

「注文はランダムに来るが、作れなければ断れる」は、店の在庫切れを断るという現実の比喩に合い、FREE で買った材料が Lunch Rush でも意味を持つ（在庫管理の動機づけ）。一方でタイムアタックなので、断る動作は 1 タップで済み、連続しないことが重要 → H の「skip 直後は必ず作れる」がこれを満たす。

### E. UX 評価

- 材料ありの通常注文: 現行の PREPARE 直行（UX-1 決定）を維持。「短時間表示→自動開始」は数百 ms〜1 s を毎注文失ううえ、注文名は PREPARE の order-card に既に出るので価値が薄い。**追加タップ・追加表示とも入れない。**
- 1 注文目の「ピザを作る！」: Intro の開始タップ直後に clock が走ったまま再度タップを要求している点は冗長だが、shortage skip とは独立の論点。本件では変更せず、別 UX 課題として記録のみ。
- 材料不足時: ORDER 画面が初めて「判断画面」として意味を持つ。キャラ会話は残し（テンポ上 1〜2 行）、その下に不足カード（材料アイコン・名前・`have/need`）と単一 CTA。補充は run 後の Shop である旨を 1 行添える。

## 9. exploit / deadlock 分析

### F. Economy / exploit

| 懸念 | 評価 |
|---|---|
| score 稼ぎ | skip は metrics 不変。missionScore = servedCount×100 + quality なので加点なし |
| Pitz 稼ぎ | `calculateMissionReward(metrics)` は metrics のみ参照 → 不変 |
| easy recipe reroll | skip は不足時のみ可能で、不足は inventory から決定的に決まる。作れる注文は断れない → reroll 不可 |
| favorable order farming | 意図的に難しい recipe の在庫を 0 にしておけば、その注文は skip され makeable pool に寄る。ただし結果の分布は B（filter）と同じで、元々作れない注文を失敗させるより得をするわけではない。時間コストもある。新規 exploit ではない |
| inventory 消費回避 | skip 対象は元々作れない注文。現行は FAILED 前提で部分在庫を浪費していたのが無くなるだけ（改善） |
| Dex/timesMade | skip は `registerScoreToDex` を呼ばない |

### C. deadlock

| ケース | H での挙動 |
|---|---|
| 全候補が材料不足・残り時間あり | makeable pool 0 → 開始時ブロック / 途中なら早期 RESULT |
| スキップ後も材料不足注文 | 起きない（skip 後は makeable pool から） |
| 同じ注文が連続 | 通常抽選は avoidRepeat。makeable 1 件なら同じ作れる注文の繰り返しは許容（現行と同じ） |
| candidate 1 件（その 1 件が不足） | makeable 0 → 上と同じ扱い |
| inventory 0 | starter のみの margherita が発見済みなら makeable ≥ 1。未発見なら HOME で Lunch Rush 自体が locked |
| starter ingredient のみ | 常に充足扱い。shortage 判定は有限材料だけ |
| 最終秒 | skip も deadline 以降は no-op。TICK が RESULT へ。skip 自体は clock を触らない |
| 二重タップ | 2 回目は新注文（makeable＝不足なし）に対する skip になり guard で no-op。action に `recipeId` を載せ一致時のみ有効にするとさらに堅い |
| serve 直後に次注文が不足 | ORDER 停止 → skip → makeable 注文 → PREPARE。`handleMissionServeNext` は不足時 `BEGIN_PREPARE` を出さない（reducer backstop もあり） |

## 10. UI flow

```
[PLAYING]
 serve「次の注文へ」/ run 開始
   ↓ 次注文決定
   ├─ 不足なし ─ 1 注文目: ORDER「ピザを作る！」→ PREPARE
   │            2 枚目以降: そのまま PREPARE（現行）
   └─ 不足あり ─ ORDER（停止, clock 進行）
                  Mito/Teto 注文ライン
                  ⚠ 材料が足りません
                  ・ペスト 0/1  ・チェリートマト 1/3
                  （補充はランチラッシュ後にショップで）
                  [この注文をスキップ]
                    ↓ MISSION_SKIP_ORDER
                  makeable 注文 → PREPARE（1 注文目扱いならここで「ピザを作る！」）
                  makeable 0 件 → Mission RESULT（早期終了文言）
[開始前] makeable 0 件 → Intro/HOME で開始不可 + 補充案内
```

## 11. 必要 tests（実装時）

Unit（pure / reducer）:
1. `orderShortage`: 在庫充分 → 空 / 不足 → `{id, need, have}` / scatter は minCount、spread は 1 / starter は常に充足 / 未知 id は安全側
2. enough stock → 通常注文、`BEGIN_PREPARE` 通過
3. insufficient stock → `BEGIN_PREPARE` が no-op、skip 可能
4. `MISSION_SKIP_ORDER` → 次注文（ORDER、`isMissionRound` 維持）
5. skip で inventory 不変（参照同一）
6. skip で score/Pitz/dex(timesMade)/metrics/serves 不変
7. 不足なし注文への skip は no-op（reroll 防止）、FREE round / ORDER 以外の phase で no-op
8. 二重 skip: 2 回目 no-op（recipeId 不一致 or 新注文が makeable）
9. skip 後の注文は makeable pool から（乱数を固定して複数 seed で検証）
10. 次注文の stock 再評価: 1 枚焼いて在庫 0 → 次にその recipe が出たら shortage 判定
11. repeated shortage: 2 recipe（1 つ不足）で「不足が 2 連続しない」
12. all candidates shortage → 開始ブロック / 途中早期終了、`BEGIN_PREPARE` 未発行、焼成済み pizza が PREPARE に戻らない（E3 回帰）
13. E2 回帰: pool 空で START しても FREE round 上で PLAYING にならない
14. missionRunReducer: skip は clock を触らない。deadline 後の skip は no-op、TICK で RESULT
15. `submitLunchRushScore` の payload に skip が含まれない

App / component:
16. ORDER 不足表示: 「材料が足りません」・不足材料一覧・「この注文をスキップ」、「ピザを作る！」非表示
17. 不足なし 2 枚目以降は ORDER を描画せず PREPARE（UX-1 回帰）
18. MissionServePanel PASS/FAILED「次の注文へ」回帰

E2E（390×844 / 360×800, Chromium + WebKit Gate）:
19. 在庫 0 の発見済み recipe を持つ save で run → 不足注文 → skip → 作れる注文 → serve → Mission RESULT（score/Pitz が serve 分のみ）
20. 最終秒で不足画面のまま時間切れ → RESULT 正常
21. Lunch Rush RESULT / ランキング導線 / 次注文の既存 spec 回帰

UI 変更なので `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従い Human Verification 動画（390×844）と before/after スクリーンショットが DoD。

## 12. W1 に入れるか — **Post-W1 に分離を推奨**

- W1 Final Gate は content（material/recipe/Discovery Ladder）統合の gate。本件は Mission フロー・reducer・App・新 UI・HV 動画を伴う gameplay 変更で、W1 の差分と検証範囲を広げる。
- 在庫の単位（3-4C）と #213 の Option B 判断が未決。shortage 判定の seam はそれに依存する。
- 現在の soft-lock は main で到達可能だが、発生条件（有限材料を買って発見し、使い切ってから Lunch Rush）は限定的で、失うのは FAILED 1 枚分の時間と部分在庫。W1 の Human Replay で踏んだ場合も「既知・Post-W1」と記録できる。
- ただし W1 で margherita 保証を崩すデータ変更（starter 構成変更など）が入るなら、その時点で E2/E3 の最小 guard（Phase 1）だけは前倒しを検討。

## 13. 実装 Phase 案（Post-W1）

| Phase | 内容 | UI | 規模 |
|---|---|---|---|
| P0 | 決定: H / B の選択（#213 と本書の統合判断）、3-4C の unit seam 確認 | — | docs |
| P1 | `orderShortage` / `makeableMissionRecipeIds` の pure 関数 + E2/E3 の 0 件 guard（開始ブロック・早期終了・`BEGIN_PREPARE` 条件化）+ unit tests 1, 10, 12, 13 | 文言のみ | 小 |
| P2 | `MISSION_SKIP_ORDER` + `BEGIN_PREPARE` 不足 backstop + skip 後 makeable 抽選 + unit tests 2–9, 11, 14, 15 | なし | 小〜中 |
| P3 | ORDER 不足カード UI + App 配線（不足時 `BEGIN_PREPARE` を出さない）+ component/E2E 16–21 + HV 動画・スクショ | あり | 中 |
| P4（任意） | Mission RESULT に skip 数表示、1 注文目「ピザを作る！」の要否を別途 UX 監査 | あり | 小 |

B 単独を選ぶ場合は P1 + 「通常抽選も makeable pool に」で完了し、P2/P3 は不要。

---

## 変更していないもの

production code、tests、save schema、scoring、inventory、recipe data、`docs/PROJECT_HANDOFF.md`、W1 関連ブランチ。本書 1 ファイルの追加のみ。
