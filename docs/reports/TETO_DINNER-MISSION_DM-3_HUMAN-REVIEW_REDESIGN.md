# Dinner Mission DM-3 — Human Review Redesign（Fresh Audit）

- **種別:** Fresh Audit / Redesign（docs のみ）。production code、PR #243、save schema は変更していない。
- **Authority:**
  - Owner の iPhone 実機 Human Verification（PR #243 の Preview `fd4c28b`）の所見 HV-1〜HV-3
  - `docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md`
  - DM-1 / DM-2 / DM-3 の Result Report
- **この文書で決めないこと:**
  - 品質の閾値、制限時間、報酬（DM-4 / DM-5）
  - PR #243 の merge
  - Hint 3.0 と #234 には触れない

## 1. 監査した SHA

| 対象 | SHA |
|---|---|
| main（fresh check） | `1faa83f569107605e0c6fac33c357fd12f5cb32f`（PR #241 の merge。Dinner のコードには触れていない） |
| PR #243 の HEAD | `fd4c28baef2ebd4d78617595683253467a20bb7c`（最後に code を変えた commit は `ba7c977`）。OPEN、CI green、未解決の review thread 0、main と conflict なし |
| Owner が確認した Preview | `fd4c28b`（PR #243）。`perusonao/teto-pizza-game-preview` の `58e578f` と `d9185be` |
| この文書の branch | `claude/dinner-mission-dm3-redesign-audit`。`origin/main` の `1faa83f` から作った docs のみの branch（PR #243 とは別） |

Dinner の現行コードは PR #243（`fd4c28b`）のものを読んだ。main にはまだ入っていない。

## 2. iPhone での HV 所見

| # | 所見 | この監査で分かったこと |
|---|---|---|
| HV-1 | ソースの工程で、ピザが生地の工程より小さく見える | **再現した**。Safari に近い可視高さ（390×664）では、Dinner の SAUCE でピザの直径が 290px → **199px（−31%）** になる。原因と全モードの実測は §10 |
| HV-2 | 対象のピザを完成させれば進むので、簡単すぎる | 現在の Dinner は Completion Gate が PASS するだけで達成になる（`"order"` policy。数量は必要だが、品質は見ない）。Scoring 2.0 の点数と ★ はもう計算されているが、Dinner では使っていない。§6 |
| HV-3 | 「作るピザを選んで、その recipe の guided 調理をする」より、「自由に作り、完成品から自動判定する」ほうが面白いかもしれない | Free Cooking の判定 pipeline（`resolveFreeCookPizza`）をほぼそのまま使える。ただし bake の判定窓と CUT の扱いに、Dinner 用の調整が必要。§4、§5 |

## 3. 現在の loop（PR #243）

```
HOME → Mission Select → Detail → START（DINNER_START、在庫の実行可能性 gate）
  → Target Board（ORDER の代わり。activeRecipeId = null）
  → target を選ぶ（DINNER_SELECT_TARGET → activeRecipeId = X、X の guided round）
  → X の工程（DOUGH → SAUCE → CHEESE → TOPPING → BAKE → CUT）。X の見本・ヒント・焼き窓
  → CONFIRM_BAKE: X の Completion Gate（"order" policy）、在庫を消費、RESOLVE_ATTEMPT(X, PASS | FAILED, post-bake stock)
  → PASS なら X を完成に数える / FAILED なら X は未完成のまま。残りの target の実行可能性を post-bake の在庫で再判定
  → Target Board に戻る … 全部 PASS なら CLEAR / 時間切れなら TIME_UP / 作れなくなったら INFEASIBLE
```

特徴:
- **ゲーム側が「今作るもの」（`activeRecipeId`）を決める。** プレイヤーは recipe を宣言してから作る。
- 判定は宣言した recipe に対してだけ行う。別のピザになっていても、宣言した recipe の Completion Gate で落ちるだけ（例: ブレックファストのつもりでベーコンを置き忘れると「ブレックファスト FAILED」になる）。
- 工程のヒント、見本、焼き窓は宣言した recipe のものなので、実質的には guided の mode。HV-2 の「簡単すぎる」はここから来ている。

## 4. 提案: 完成したピザから判定する loop

```
HOME → Mission Select → Detail → START（DM-1 / DM-2 の gate をそのまま使う）
  → Dinner 調理（自由に作る round。recipe は宣言しない。上部に target 見本の strip）
  → DOUGH → SAUCE → CHEESE → TOPPING（Free Cooking と同じ tray と工程）
  → [組成が決まった時点で identity を判定する（§5.4）]
  → BAKE（判定した target の焼き窓。判定できなければ汎用の窓）
  → CUT（判定した target が CUT 対象のときだけ）
  → 結果を分類（§7）: TARGET_PASS / TARGET_QUALITY_FAIL / DUPLICATE / NON_TARGET / ORIGINAL / NOT_A_PIZZA
  → TARGET_PASS のときだけ、その target に check を付ける
  → 在庫を消費し、残りの target の実行可能性を post-bake の在庫で再判定する
  → 作れなくなっていれば FAILED（INFEASIBLE）、作れるなら結果を表示して次の 1 枚へ
  → 全部の target に check が付けば CLEAR / 時間切れなら TIME_UP
```

- 新しい run の状態: `activeRecipeId` を**なくす**。代わりに 1 枚ごとの結果を `attempts[]` に記録する（`DinnerAttempt` を拡張して identity と結果を持たせる）。
- 「Target Board」の画面はなくなる。START の直後に調理画面へ入る。1 枚焼くごとに小さな結果 panel を出して、「次のピザへ」で次の自由 round に戻る。
- この loop ではプレイヤーが組み合わせを思い出す必要がある。target は全部 DISCOVERED なので、名前と見本は出してよい。実際に作ったことを、組成の記憶と手の正確さで試すことになる。

## 5. Identity matcher の再利用監査

### 5.1 すでにあるもの

| 部品 | 場所 | 内容 | Dinner での再利用 |
|---|---|---|---|
| `signatureOfPizza` | `src/logic/discovery/signature.ts` | ピザ → 材料の集合、ソースのベース、identity 次元 | **そのまま使える**（pure） |
| `matchDiscovery` | `src/logic/discovery/matcher.ts` | 完全一致だけを見る（材料だけでの fallback はない）。0 / 1 / 複数 → NO_MATCH / UNIQUE_MATCH / AMBIGUOUS | **そのまま使える**（pure） |
| `RECIPE_DISCOVERY_CATALOG` | `src/data/discoveryCatalog.ts` | 25 recipe 分の target | **使える**。Dinner では catalog 全体を使う（§5.3） |
| `evaluateDiscovery` | 同上 | 一致 + 発見済みかどうか → NEW_DISCOVERY / ALREADY_DISCOVERED | **使わない**。Discovery の意味（新発見）を持ち込むことになるため |
| `resolveFreeCookPizza` | `src/logic/discovery/freeCook.ts` | recipe を問わない完成判定（中央値の焼き窓）→ 一致 → 一致した recipe の Completion Gate | **参考にとどめる**。そのままでは焼き窓がずれる（§5.4） |
| `evaluatePizzaCompletion` | `src/logic/completionGate.ts` | recipe の Completion Gate（`"recipe"` / `"order"` policy） | **そのまま使える** |
| `computeScoringV2` と `toLegacyScoreBreakdown` | `src/logic/scoringV2/` | total（0〜100）と ★（`capStarsForBake` 込み） | **使える**（品質 gate の入力。§6） |

**持ち込まないもの:**
- Dex への書き込み（REGISTER_TO_DEX。DM-2 の Dinner guard がすでに拒否している）
- 新発見の演出
- Pitz
- Hint sheet と `preDiscoveryFreeCookAttempts`
- Free Cooking の結果画面
- Cooking Time

### 5.2 実データでの probe（DM-A / DM-B の 6 recipe、Dex は全部発見済み）

- **方法:** 一時的な Vitest の probe を 1 回だけ実行した（commit していない）。reference どおりのピザを作り、それを少しずつ崩して `resolveFreeCookPizza` と Scoring 2.0 に通した。
- **結果:**
  - 6 target はすべて catalog 上で `ELIGIBLE`。
  - catalog の 25 target の中に、signature が同一の組は**ない**。今の catalog では、AMBIGUOUS は ELIGIBLE 同士では起きない（ただし code path は残す）。

| 入力 | 判定 |
|---|---|
| 6 recipe それぞれの reference どおりのピザ | 自分の recipe に UNIQUE_MATCH。total 99.5、★5、`"order"` PASS |
| マルゲリータ + なす 1 個 | **メランザーネ**に一致。`"order"` は FAILED（なす 1 < 3） |
| ビスマルク + ベーコン 1 個 | **ブレックファスト**に一致。`"order"` は FAILED（ベーコン 1 < 3） |
| ブレックファスト − ベーコン | **ビスマルク**に一致。total 82.4、★4。`"order"` は FAILED（モッツァレラ 2 < 3）。`"recipe"` policy なら PASS |
| メランザーネ − なす | **マルゲリータ**に一致。★4。`"order"` は FAILED |
| パルミジャーナ − パルミジャーノ | **メランザーネ**に一致。total 93.1、★5、`"order"` **PASS** |
| 各 recipe に関係のない材料を 1 個足す（例: フンギ + たまご） | ORIGINAL（上位集合は一致しない） |
| 各 recipe から必須の材料を 1 つ抜く（上の組を除く） | ORIGINAL |

**意味:**
- DM-A には `ビスマルク ⊂ ブレックファスト`、DM-B には `マルゲリータ ⊂ メランザーネ ⊂ パルミジャーナ` という入れ子がある。自由に作ると「狙った target の材料を 1 つ忘れたら、別の target として判定された」ということが実際に起きる。
- これは「target ではないピザ」ではなく、「別の target としての判定」。どう数えるかは OD（§15 の OD-R3）。

### 5.3 catalog 全体で見るか、mission の target だけで見るか

- **推奨: catalog 全体で一致を取り、その結果を target 集合と照らし合わせる。**
  - target だけで見ると、ORIGINAL と NON_TARGET の区別がつかない。
  - たとえばマルゲリータ + 何か = 別の既知 recipe だったとき、「対象外のピザ（○○）」と名前を出せるほうが分かりやすい。
- **一致したのが未発見の recipe だった場合:**
  - その名前を出すと Discovery を漏らすことになる。
  - Dinner ではそれも **ORIGINAL として表示し、名前を出さない**。Dex にも登録しない。
  - `evaluateDiscovery` を使わない理由のひとつ。

### 5.4 焼き窓と CUT: 組成は焼く前に決まっている

**問題:** `resolveFreeCookPizza` は最初に recipe を問わない完成判定をする。そこでの焼き窓は中央値の `FREE_COOK_BAKE_TARGET`（58〜78、許容 48〜88）。各 target の窓とは合っていない。

| recipe | 焼き窓 | Completion Gate の許容範囲 |
|---|---|---|
| マルゲリータ | 60〜80 | 50〜90 |
| ビスマルク | 55〜75 | 45〜85 |
| ブレックファスト | 56〜76 | 46〜86 |
| フンギ / メランザーネ / パルミジャーナ | 58〜78 | 48〜88 |

- probe の実例: マルゲリータを 89.5 で焼くと、recipe を問わない判定で OVERBAKED（FAILED）になる。マルゲリータ自身の gate なら PASS。
- 逆に、ビスマルクを 86 で焼くと、汎用の判定は通るがビスマルクの gate で落ちる（INCOMPLETE_MATCH）。

**提案: identity は組成だけで先に決める。**
- 材料の集合とソースのベースは、TOPPING を確定した時点（`START_BAKE`）で決まっている。焼き加減は identity に含まれない。
- `START_BAKE` の時点で `matchDiscovery(signatureOfPizza(pizza))` を 1 回計算して、round に保存しておく（pure。仮の identity）。
  - BAKE の guide（焼き窓の表示）: 一致した target の `bakeTarget` を使う。一致がなければ中央値の窓。
  - CONFIRM_BAKE: 一致した target の Completion Gate（焼き窓も含む）と品質 gate で判定する。一致がなければ、recipe を問わない判定（中央値の窓）で NOT_A_PIZZA か ORIGINAL かを決める。
  - CUT: 一致した target が CUT 対象なら POST_BAKE で CUT を足す（6 target はすべて CUT 対象）。一致がなければ CUT なしで RESULT へ進む（今の Free Cooking と同じ）。
- BAKE 中に target 名を出すかどうかは OD-R6。
  - 出す（「フンギの焼き加減」）と、判定結果を焼く前に教えることになる。緊張は減るが、分かりやすくなる。
  - 出さない場合は、窓は target のものを使い、表示は無名にする。

## 6. 品質 gate の選択肢

**入力として使えるもの（すでに計算されている）:**
- Completion Gate（`"recipe"` / `"order"`）
- Scoring 2.0 の total と ★（★ は `capStarsForBake` 込み）
- 項目ごとの内訳（recipe、sauce、pieces、quantity、bake）
- `bakeState`（raw / perfect / burnt）

**probe の値:**
- 合成した fixture の値であって、人が遊んだときの値ではない。閾値は DM-5 で実測して決める。
- 6 recipe でほぼ同じ傾向だった。

| ピザの状態 | total | ★ | `"order"` |
|---|---|---|---|
| reference どおり | 99.5 | 5 | PASS |
| 配置を ±6、ソースを 0.7 倍 | 約 84 | 4 | PASS |
| 配置を ±12、ソースを 0.5 倍 | 60〜64 | 3 | PASS |
| 材料 1 個ずつだけ | 約 65 | 3 | **FAILED**（数量不足） |
| 焼きが許容範囲の端 | 約 96.6 | 4（★5 は完璧な焼きのときだけ） | PASS |

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **A** total が一定以上 | `score.total ≥ T` | 1 つの数字。Lunch Rush の品質と同じ入力 | T が甘いと HV-2 が解消しない。厳しいと、ソース 1 項目の失敗でも落ちる |
| **B** ★ 相当が一定以上 | `score.stars ≥ S`（例: 3 か 4） | プレイヤーが見ている ★ と同じ言葉で説明できる（「★3 以上で合格」） | ★ は 5 段階なので粗い。★5 は焼きの cap がある |
| **C** 致命的な失敗だけ落とす | Completion Gate の FAILED だけを不合格にする（今の DM-2 と同じ） | 分かりやすい | HV-2 のとおり簡単すぎる |
| **D** recipe ごとの要件 | recipe ごとに「この要素は必須」を決める | 料理らしい | 新しい authoring が要る。15〜25 recipe 分の設計と検証。DM-3 の範囲を超える |

**推奨: C + B の組み合わせ（`order` Completion Gate が PASS、かつ ★ ≥ S）。S の値は DM-5 で決める（OD-R2）。**
- 「★3 以上で合格」は、既存の ★ の言葉で説明できる。新しい progression の ★ を作らなくてよい（Dinner 自体の ★ は作らない）。
- `"order"` の数量要件を残すので、「材料 1 個ずつ」のピザは落ちる（すでに DM-2 の挙動）。
- total の閾値（案 A）は、DM-5 の実測で ★ の境界が粗すぎると分かったときの予備にする。

**品質で不合格になったとき（Owner の優先案どおり）:**
- target を達成にしない。
- 在庫の消費はそのまま（CONFIRM_BAKE の原子性は変えない）。
- timer は止めない。
- 残りの target の実行可能性を post-bake の在庫で再判定する。作れなければ FAILED（INFEASIBLE）、作れるならもう一度挑戦できる。
- 結果 panel には「フンギ ★2 — 合格は ★3 以上」のように、不足分を 1 行で出す。

## 7. 重複 / 対象外 / オリジナルの扱い

1 枚焼くごとの分類（上から順に判定する）:

| 分類 | 条件 | 達成数 | 在庫 / 時間 | 表示（例） |
|---|---|---|---|---|
| NOT_A_PIZZA | recipe を問わない判定で FAILED（生地だけ、生焼け、焦げ） | 増えない | 消費する / 進む | 「ピザになりませんでした（生焼け）」 |
| TARGET_PASS | まだ達成していない target に一致し、Completion Gate と品質 gate を通った | **+1** | 消費する / 進む | 「✔️ フンギ 合格！ 2 / 4」 |
| TARGET_QUALITY_FAIL | まだ達成していない target に一致したが、gate で落ちた | 増えない | 消費する / 進む | 「フンギ ★2 — 合格は ★3 以上。もう一度作れます」 |
| DUPLICATE | すでに達成した target に一致した（品質は問わない） | 増えない | 消費する / 進む | 「フンギはもう合格済みです」 |
| NON_TARGET | 発見済みだが target ではない recipe に一致した | 増えない | 消費する / 進む | 「マリナーラ（今回の対象外）」 |
| ORIGINAL | どれにも一致しない / AMBIGUOUS / 一致したのが未発見の recipe | 増えない | 消費する / 進む | 「オリジナルピザ（対象外）」。名前は出さない |

どの分類でも、そのあと post-bake の在庫で `isRemainingTargetSetFeasible` を再判定する。偽なら、その 1 枚の結果を出したあとで FAILED（INFEASIBLE）にする。

**DM-A での例**（開始時の在庫は最小: たまご 2、ベーコン 3、マッシュルーム 3。DM-A 全体で必要な有限材料: `{egg:2, bacon:3, mushroom:3}`）:
1. ビスマルク（たまご 1）を作って TARGET_PASS → たまご 1。残りは marg / breakfast / funghi で、たまご 1・ベーコン 3・マッシュルーム 3 が必要 → 作れる。
2. もう一度ビスマルクを作る → DUPLICATE。たまご 0 → breakfast のたまごが足りない → **INFEASIBLE**。
3. ブレックファストのつもりでベーコンを置き忘れる → ビスマルクに一致（§5.2）。すでに達成済みなら DUPLICATE、まだなら品質次第で TARGET_PASS か QUALITY_FAIL（OD-R3）。
4. マルゲリータは有限の材料を使わない（トマト、モッツァレラ、バジルはすべて starter）。何度作っても在庫には影響しない。失うのは時間だけ。

**DM-B での例**（必要な有限材料: `{mushroom:3, eggplant:6, parmigiano:2}`、なすの在庫がちょうど 6）:
1. メランザーネを TARGET_PASS → なす 3。パルミジャーナに 3 必要 → 作れる。
2. もう一度メランザーネ（DUPLICATE）→ なす 0 → **INFEASIBLE**。
3. パルミジャーナのつもりでパルミジャーノを置き忘れる → メランザーネに一致し、`"order"` も PASS（★5）→ メランザーネが未達成なら **TARGET_PASS**（OD-R3 が「数える」の場合）。なすは 3 減る。

## 8. 在庫の実行可能性

**DM-1 / DM-2 の authority は変えない。**
- **START:** `dinnerStartBlock`（target 全体の最小必要量が、今の在庫で作れるか）は現状のまま。
- **run 中:** 1 枚ごとに（分類を問わず）`consumePizzaInventory` で消費したあとの在庫で、**まだ達成していない target の集合**について `remainingTargetShortages` を評価する。
  - 足りなければ即 FAILED（INFEASIBLE）。
  - DM-2 の `RESOLVE_ATTEMPT`（stock は post-bake）と同じ原則。変わるのは、recipeId を宣言した target から判定された identity に置き換わることだけ。
- **置きすぎは防がない**（OD-DM-3 を維持）。
- **変更点:** `DinnerRunAction` の `SELECT_TARGET` と `CANCEL_TARGET` は不要になる。`RESOLVE_ATTEMPT` は `{ identity, verdict, stock, now }` になる。
- **timer:** 自由に作る round の間も止めない（今と同じ）。

## 9. target の見本 UI の選択肢

制約:
- 中央の pizza stage を狭くしない（§10 のとおり、すでに縦が足りない）。
- 対象の一覧を常に大きく出さない。

| 案 | 内容 | 必要な高さ | 長所 | 短所 |
|---|---|---|---|---|
| **R1** HUD に小さな icon 列 | HUD（33px）の中に `[🍕✓][🍕][🍕][🍕] 1/4` を足す。icon は reference の縮小 thumbnail（24px） | +0〜8px | stage を削らない。達成状況が一目で分かる | 名前が読めない。個々のピザを見分けにくい |
| **R2** 小さな見本カード列 | HUD の下に 4 枚のカード（48〜56px）。thumbnail と短い名前 | +56px | 見て分かる | stage をさらに 56px 削る（SAUCE では 199px → さらに小さくなる） |
| **R3** icon 列 + タップで拡大 | R1 に加えて、icon をタップすると既存の `ReferencePreview` の popover（見本）を開く | +0〜8px | stage を削らず、必要なときだけ詳しく見られる。既存の popover を再利用できる | タップ 1 回が要る |
| **R4** 今の recipe カードを置き換える | guided の recipe カード（約 70px）の場所に、target 4 種の小カードを出す | ±0 | 高さが変わらない | 工程ごとのヒント文がなくなる（自由に作る mode なので妥当かもしれない） |

**推奨: R3 + R4。**
- 自由に作る round には guided の recipe カードが要らない。その場所（約 70px）を、4 target の thumbnail 列と進捗に使う。
- thumbnail をタップすると、その target の見本の popover を開く。
- HUD は今のまま（DINNER、残り時間、N / M）。
- stage が使える高さは今の Dinner と同じか、少し増える。

## 10. pizza stage の大きさの監査（HV-1）

**方法:**
- Playwright Chromium で、PR #243 の DEV build を使った。
- 各工程で、実際の gesture で操作したあとに `.pizza-dough` の bbox を測った。
- 390×844（layout の基準）、360×800、それに Safari に近い可視高さ 390×750（toolbar を縮めた状態）と 390×664（通常の Safari。1 画面のアプリなので toolbar は縮まない）。
- 横スクロールは全部の測定で 0。

直径（px）:

| mode / viewport | DOUGH | SAUCE | CHEESE | TOPPING | BAKE | CUT |
|---|---|---|---|---|---|---|
| Guided 390×844 | 290 | 290 | 290 | 290 | 358 | 358 |
| Dinner 390×844 | 290 | 290 | 290 | 290 | 358 | 358 |
| Guided 390×750 | 290 | 290 | 290 | 290 | 358 | 358 |
| Dinner 390×750 | 290 | **285** | 290 | 290 | 358 | 358 |
| **Guided 390×664** | 290 | **240** | 287 | 283 | 322 | 358 |
| **Free 390×664** | 290 | 290 | **241** | **233** | 322 | — |
| **Lunch Rush 390×664** | 290 | **242** | 246 | 242 | 281 | 358 |
| **Dinner 390×664** | 290 | **199** | 246 | 242 | 281 | 358 |
| Guided 360×800 | 274 | 274 | 274 | 274 | 328 | 328 |

stage container の高さ（390×844）:

| mode | DOUGH | SAUCE | CHEESE | TOPPING |
|---|---|---|---|---|
| Guided | 593 | 428 | 475 | 471 |
| Dinner | 552 | **387** | 434 | 430 |

ピザの上端も工程ごとに動く。Dinner 390×844 では、DOUGH 353 → SAUCE 271 → CHEESE 294 → BAKE 258。

**原因:**
1. PREPARE の直径は `min(76vw, 290px, 100cqh)`（`.game-screen--cooking > .pizza-stage--compact`）。容器の高さ（`100cqh`）が上限になっている。
2. SAUCE だけ、ソースの読み取り表示（「ソースのでき 広さ / 均一さ / ふち」、約 43px）が tray の上に追加される。そのため stage の容器がいちばん低くなる。
3. Dinner と Lunch Rush では HUD（約 41px）が加わる。Dinner は guided の読み取り表示と HUD の両方を持つので、SAUCE がいちばん小さくなる。
4. Free Cooking では CHEESE と TOPPING の tray が大きい（22 種類の pager）ので、その 2 工程が小さくなる。**提案 loop（§4）は Free Cooking の tray を使うので、この縮みも受け継ぐ。**
5. BAKE と CUT は別の上限（`roomy`、`min(92vw, 380px, 100cqh)`）を使う。そのため PREPARE → BAKE で大きくなる（290 → 358）。
6. 390×844 の headless 測定では上限の 290 が効いていて、縮みは見えない。**実機の Safari（可視高さが約 664）でだけ現れる。** 既存の Layout Contract がこれを検出できなかった理由でもある。

証拠（commit 済み）:
- `docs/reports/screenshots/dinner-mission-dm3-redesign/stage-dinner-390x664-phases.png`
- `stage-guided-390x664-phases.png`
- `stage-free-390x664-phases.png`

**Layout Contract で固定すべきもの（提案。CSS はまだ変えない）:**
- **LC-S1:** PREPARE（DOUGH / SAUCE / CHEESE / TOPPING）の間、直径の差は ±4px 以内。対象は P390、P360、**P390 short（664）**。Guided / Free / Lunch / Dinner の全 mode で測る。
- **LC-S2:** PREPARE 中、ピザの中心の y 座標の移動は ±8px 以内（工程が変わっても跳ねない）。
- **LC-S3:** 可視高さ 664 でも、PREPARE の直径は 260px 以上（最低の操作面積）。
- **LC-S4:** PREPARE → BAKE の直径の変化を、意図したとおりに固定する（例: BAKE は PREPARE 以上、変化は 1 回だけ）。「大きくする」か「同じにする」かは OD-R8。

**修正の方向（実装は別の slice）:**
- SAUCE の読み取り表示を、tray と同じ高さの枠に入れる（tray の上に積まない）。
- PREPARE の直径を、全工程の最小値に揃える（工程ごとに tray の高さを予約する）。
- 共通の CSS なので、Dinner の redesign とは**別の PR** にし、Guided / Free / Lunch Rush の Layout Contract と一緒に直すのがよい。

## 11. mobile への影響

- **自由に作る Dinner の tray:**
  - 今の Free Cooking の tray（全材料の pager）を使うと、CHEESE と TOPPING で stage が縮む（664 で 241 / 233px）。さらに HUD の約 41px が加わる。
  - 対策の候補（OD-R5）:
    - (a) Dinner の tray を「target の材料の和集合」に限る
    - (b) 全材料のまま、§10 の layout 修正を先にやる
  - (a) は tray を短くするが、「どの材料を使うか」の迷いが減るので、ヒントにもなる。
- **見本 UI:** R3 + R4（§9）なら、高さは増えない。
- **結果 panel:** 1 枚ごとの結果は、今の `DinnerTargetResultPanel`（390×844 で収まっている）を変えて使う。
- **360×800:** 今と同じく一級で扱う。測定では 390 と同じ傾向で、さらに約 16px 小さい。
- **Safari の可視高さ:** 今の Layout Contract の profile（P390i など）は safe-area を扱っているが、toolbar による可視高さ 664 は扱っていない。LC-S1〜S3 で追加するべき。

## 12. PR #243 の再利用 map

| 部品 | 判定 | メモ |
|---|---|---|
| HOME の Dinner 入口 | **KEEP** | 2+1 の CTA、48px のカード、LC-4 |
| Mission Select（locked カードの privacy） | **KEEP** | `dinnerMissionCardView`、`expectNoUndiscoveredIdentity` |
| Mission Detail（target、readiness、不足、Shop 導線、START） | **KEEP** | 文言は少し変える（「好きな順番で」→「材料の組み合わせを思い出して作ろう」など） |
| timer（`useDinnerRuntime`、250ms、壁時計） | **KEEP** | |
| DEV / Preview での duration 注入（OD-DM3-1） | **KEEP** | |
| Dinner HUD（DINNER、残り時間、N / M） | **KEEP** | R1 / R3 の icon を足すなら MODIFY |
| CLEAR / TIME_UP / INFEASIBLE の overlay | **KEEP** | 「作ったピザ」の内訳（合格 / 重複 / 対象外の枚数）を足すなら MODIFY |
| retry（実行可能性の再確認、Shop への導線） | **KEEP** | |
| abandon dialog（続ける / やめる） | **KEEP** | |
| reload で run がなくなる、「再開」を出さない | **KEEP** | |
| Shop guard（run 中は入れない） | **KEEP** | |
| round-reset key（Codex の指摘の修正） | **MODIFY** | `activeRecipeId` の代わりに attempt の index を key に入れる |
| mobile layout（Dinner 用の CSS） | **KEEP / MODIFY** | board 部分は REMOVE、見本の strip を追加 |
| Target Board（`DinnerTargetBoard`、ORDER の代わり） | **REMOVE** | START の直後に調理画面へ入る |
| `activeRecipeId` の authority（`SELECT_TARGET` / `CANCEL_TARGET` / `RETURN_TO_TARGETS`） | **REPLACE** | attempt の index と、判定した identity を持つ round |
| target ごとの guided 調理（`dinnerRoundState` + `startPreparing`、recipe の見本 / ヒント / 焼き窓） | **REPLACE** | 自由に作る round（`freeCook` の round。Discovery / Dex / Hint / Pitz は無効） |
| 完成の境界（CONFIRM_BAKE で宣言した recipe の gate を使う） | **REPLACE** | 組成で決めた identity → target の gate + 品質 gate → 分類（§5.4、§7） |
| 1 枚ごとの結果（`DinnerTargetResultPanel`） | **MODIFY** | 6 分類の表示 |
| target の HUD / 見本 UI | **REPLACE** | R3 + R4（§9） |
| E2E の `cookDinnerTarget` helper | **MODIFY** | target を選ぶ操作をなくし、recipe の組成で作るだけにする |
| DM-1 の core（mission の定義、実行可能性、報酬の形） | **KEEP** | `DinnerRunAction` の形は MODIFY（§8） |

## 13. regression のリスク

| リスク | 影響する範囲 | 対策 |
|---|---|---|
| free-cook round を Dinner で使うと、Discovery / Dex / Hint / Pitz の経路に入ってしまう | Discovery と Dex の完全性 | Dinner の guard（`DINNER_BLOCKED_ACTIONS`、REGISTER_TO_DEX の backstop）を維持する。free round でも `isDinnerRound` を優先する。Hint sheet は Dinner では開けないようにする |
| 未発見の recipe の名前が結果に出る | privacy | 未発見の一致は ORIGINAL として表示する（§5.3）。E2E で sweep する |
| CONFIRM_BAKE の原子性（在庫、判定、run の遷移） | 在庫の二重消費 | 今の「同じ transition で消費して判定する」を維持する |
| round の key（retry、次の 1 枚）で一時的な UI 状態が残る | 見本の popover、gesture | attempt の index を key に入れる |
| 焼き窓（中央値と target の窓） | 判定の公平さ | 組成で identity を先に決める（§5.4） |
| CUT の有無が round の開始時点では決まらない | CUT の UI と post-bake の遷移 | CONFIRM_BAKE で identity に応じて postBake の工程を決める。reducer で決めた `cookingProfile` を変える必要がある |
| stage の layout 修正は共通の CSS | Guided / Free / Lunch Rush | 別の PR にして、LC-S1〜S4 を先に追加する |
| Lunch Rush | `isMissionRound`、Lunch の HUD | 触らない（Dinner は `roundKind`） |

## 14. E2E の変更

今の `e2e/dinner-mission.spec.ts`（11 test）のうち:

- **KEEP**
  - 1 / 2 / 3 / 32: 入口と privacy
  - 4: 不足
  - OD-DM3-1: duration がないと START できない
  - 12: TIME_UP
  - 16 / 17 / 18 / 22: abandon と Shop guard
  - 19: reload
- **MODIFY**
  - 5〜11: 順番を自由に作って CLEAR。board を選ぶ操作をなくし、recipe の組成で作るだけにする
  - 13: 置きすぎて INFEASIBLE
  - 14 / 15: 品質 FAILED
- **REMOVE**
  - 8 / 10 / 31: board に戻る、完成した target は選べない、「ターゲット一覧へ」の二度押し
  - 代わりに「次のピザへ」の二度押しを見る

追加する E2E:
- **E-R1:** 何も宣言せずにフンギを作る → フンギに check。
- **E-R2:** ブレックファストのつもりでベーコンを置き忘れる → ビスマルクとして判定される（OD-R3 の結果に従う）。
- **E-R3:** 合格済みの target をもう一度作る → DUPLICATE。達成数は増えない。在庫は減る。
- **E-R4:** 対象外の既知 recipe（例: マリナーラ）→ NON_TARGET と名前。
- **E-R5:** どれにも一致しないピザ → ORIGINAL。未発見の recipe に一致しても名前を出さない（privacy の sweep）。
- **E-R6:** 品質で不合格（★ が S 未満）→ QUALITY_FAIL と不足分。もう一度作れる。
- **E-R7:** DUPLICATE で在庫が足りなくなる → INFEASIBLE（DM-A のたまご、DM-B のなす）。
- **E-R8:** 焼き窓は判定した target のもの（ビスマルク 55〜75 で焼いて PASS）。
- **E-R9:** Dinner の free round では Hint sheet、Dex への登録、新発見の演出がどれも出ない。
- **E-R10:** 見本 strip のタップで popover が開き、閉じると調理に戻る。
- **LC-S1〜S4:** 可視高さ 664 の profile を追加する（stage の直径の安定性）。

## 15. Owner が決めること

| # | 決めること | 選択肢 | 推奨 |
|---|---|---|---|
| **OD-R1** | Dinner の core loop を、完成品から判定する方式に切り替えるか | (a) 切り替える（§4） / (b) 今の guided の選択方式を残し、品質 gate だけ足す | (a)。HV-3 を優先候補とする Owner の判断に沿う |
| **OD-R2** | 品質 gate の形 | A: total / B: ★ / C: 致命的な失敗だけ / D: recipe ごと | **C + B**（`order` Completion Gate の PASS かつ ★ ≥ S）。S は DM-5 で実測して決める |
| **OD-R3** | 別の target として判定された場合（入れ子の関係、§5.2） | (a) 数える（判定結果がすべて） / (b) 数えない | (a)。「完成品から判定する」に忠実。結果 panel で「ビスマルクとして合格」と明示する |
| **OD-R4** | 未発見の recipe に一致した場合 | (a) ORIGINAL として表示し、名前は出さない / (b) Dinner の中でも発見扱いにする | (a)。Dinner は Discovery ではない（OD-DM-11） |
| **OD-R5** | Dinner の tray | (a) 全材料（Free Cooking と同じ） / (b) target の材料の和集合 | (a) を基本に、§10 の layout 修正を先にやる。(b) は難しさを下げる手段として残す |
| **OD-R6** | BAKE 中に判定した target の名前を出すか | (a) 出す / (b) 窓だけ使い、名前は出さない | (b)。結果の驚きを保つ |
| **OD-R7** | 見本 UI | R1 / R2 / R3 / R4 | R3 + R4 |
| **OD-R8** | PREPARE → BAKE で直径を変えるか | (a) 同じにする / (b) BAKE を大きくする（今と同じ） | stage 修正の PR で、実機を使って決める |
| **OD-R9** | PR #243 の扱い | (a) OPEN のまま redesign の commit を積む / (b) KEEP の部分だけを先に merge し、redesign は新しい PR にする / (c) close して作り直す | (a) か (b)。(b) だと入口と Detail が本番に出るが、START は OD-DM3-1 で押せないので、プレイヤーへの影響はない |
| **OD-R10** | stage の大きさの修正（HV-1）の順番 | (a) Dinner の redesign より先に、共通の PR で直す / (b) 並行 / (c) あと | (a)。自由に作る Dinner は tray が大きいので、先に直すほうがよい |

## 16. 次の実装 slice（推奨）

1. **DM-3R-0 Stage Size Stabilization**（共通。Dinner とは別の PR）
   - LC-S1〜S4 を追加し、可視高さ 664 の profile を入れる。
   - PREPARE の直径を揃える（SAUCE の読み取り表示の配置を見直す）。
   - Guided / Free / Lunch Rush で regression がないことを確認する。
   - HV は実機（Safari）。
2. **DM-3R-1 Result-Detection Core**（pure。UI なし）
   - `resolveDinnerPizza(pizza, run, dex)` → 6 分類（§7）と、判定した target の identity と品質判定。
   - `DinnerRunAction` を変える（`SELECT_TARGET` / `CANCEL_TARGET` をなくし、`RESOLVE_ATTEMPT` を identity で受ける）。
   - 実行可能性は post-bake の在庫で判定する。
   - DM-A / DM-B の入れ子、重複、INFEASIBLE の unit test。
   - 品質 gate の S は定数にせず、注入できる形にする（DM-5 で決めるまで、テストでは値を注入する）。
3. **DM-3R-2 Runtime + UI**
   - Dinner の free round（Hint / Dex / Pitz / Discovery は無効）。
   - `START_BAKE` で identity を先に決め、焼き窓と CUT を合わせる。
   - 見本 strip（R3 + R4）、6 分類の結果 panel。
   - Target Board をなくす。
   - E2E の変更（§14）、Human Verification。
4. そのあとで DM-4（報酬）と DM-5（制限時間と品質の閾値の実測）。

この文書の範囲では、実装、PR #243 への push、merge、DM-4 の着手はしていない。
