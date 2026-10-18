# Square Dough F4 — ○/□ 生地形状選択 Fresh Audit

Status: **docs-only Fresh Audit。`src/**`・e2e・CSS・Issue 本文・Preview は未変更。実装・マージは Owner の別途承認待ち。**
Issue: #538（F）／ Epic #532。Audited `origin/main` = `d611839`（F2 #548 マージ後。この branch の HEAD も同一）。
読んだもの: #538 / #532 / #536 / #537 の本文とコメント、#546（B2）・#553（F3）の PR 本文と変更ファイル一覧（**読み取りのみ**）、Design Lock addendum §4A/§4B、`TETO_SQUARE-DOUGH_F_RESEARCH-AUDIT.md`、`src/` の該当コード。
触れていないもの: #546、#553、共有 Preview、Preview リポジトリ（新規作成なし）。

## 0. 結論

1. **F4 の本体（□ 選択で `PizzaState.pan = "tray"` を設定する経路）は、現 main では純ロジックとして先行実装できる。ただし「見える UI」と「四角ラウンド判定の差し替え」は B2（#546）のマージ後でなければ着手できない。** B2 は GameScreen / App / PizzaStage / App.css に `squareDoughRound` などを足す PR で、F4 が差し替える継ぎ目そのもの。
2. **「次へ」ゲート（四隅 85%・均一さ）は C（#536）の責務**で、F4 は C を待つ。C が無い状態で □ を選べると、B2 の「次へ 無効」により DOUGH から進めなくなる。**F4 の UI を Production で見せない根拠は「affordance が開かない（要求レシピ 0 件）」だけ**に依存する（§4）。
3. 独立に進められる範囲（§7 の F4-a）は、B2・C・D2 のどのファイルにも触れずに切れる。**ただし Owner の「実装は別途承認」があるまで着手しない。**
4. **要 Owner 確認 3 点**: (a) G2 と F3 の 2 つの文言が別物で、G2 には実装も置き場も無い（§6）。(b) □ 選択後に「リセット」したとき pan を保持するか（§3-5）。(c) Preview/HV で affordance をどう開けるか（§4）。

## 1. F1/F2 の識別子（確認 1）

| 場所 | 値 | 根拠 |
|---|---|---|
| `TechniqueId` | `"no-sauce" \| "tray"` | `src/data/techniques.ts` |
| `PizzaState.pan` | `PanId = "tray"`、`pan?: PanId \| null`（absent / null = 通常の丸） | `src/state/pizzaState.ts:63-71` |
| signature の pan 軸 | `OBSERVED`、値は `pizza.pan === "tray" ? "tray" : null`。`shape` 軸は UNAVAILABLE のまま | `src/logic/discovery/signature.ts:100,155` |
| Technique 検出 | `usesTray`: pan 軸 OBSERVED かつ `"tray"` かつ材料あり。`requiresTray`: target の `identityDimensions.pan === "tray"` | `src/logic/techniques/detection.ts` |
| `PanShape`（生地形状） | `"round" \| "square"`。`activePanShape(recipe)` = Preview/DEV の `?pan=square` か `recipe.panShape` | `src/logic/pan/panShape.ts`, `src/preview/panShapePreview.ts` |

**用語が 3 系統ある**: Technique id `tray`、`PizzaState.pan` の `"tray"`、生地形状 `PanShape = "square"`。現状この 3 つを結ぶコードは無い。

- **`PizzaState.pan` を書く本番コードは存在しない**（`grep` で `signature.ts` が読むだけ。reducer・UI・fixture 以外に代入なし）。
- **`activePanShape` は `PizzaState` を見ない**（recipe と Preview override のみ）。`COMMIT_SQUARE_DOUGH` のガード（`gameReducer.ts:1174`）、ドロップ判定（`:1022`）、ラウンド生成時の CUT 除去（`:678`）の 3 か所が使っている。→ □ を選んでも、今のままでは四角ラウンドとして扱われない。
- 4 AC の 1 つ「`?pan=square` だけでは Technique 発見にならない」は **現状で満たされている**（`pan` は明示値のみ。F2 のテストあり）。F4 でも維持する。

## 2. 依存関係（確認 2）

| Issue / PR | 状態（確認時点） | F4 との関係 |
|---|---|---|
| A #534 / B1 #545 / F1 #547 / F2 #548 / D1-a #549 / D1-b #552 | main に**マージ済み** | F4 の土台（pan 軸・Technique 登録・四角ロジック・`COMMIT_SQUARE_DOUGH`）。 |
| **B2 #546** | **open**、head `c1384a9`、base `main@4f8dd7d`（現 main より古い）、`mergeable_state: unstable`。Owner 方針: **実機 HV PASS・マージ前に C・D2 を実装しない** | `SquareDoughLayer`、`squareDoughRound`、「次へ 無効」、`PizzaStage` の `squareDough` prop、`GameScreen`/`App` の配線を持つ。**F4 の UI と判定差し替えはこの上に載る。** |
| **C #536** | 未着手（B2 HV PASS 後） | 四隅 85% ＋均一さの完成判定と「次へ」ゲート。F4 の □ 選択は C 完了まで Production で露出させない。四角ラウンド判定は **1 関数経由**に保つこと（Owner 指示）。 |
| **D1** | main にマージ済み（D1-a/b） | 四角のソース指標・ドロップ境界・CUT 無効は main にある。F4 は新規に触れない。 |
| **D2 #537** | 未着手（C 後） | 四角の描画・RESULT・サムネイル。F4 とは独立（#518 の filter ブロックに触れない条件つき）。 |
| **F3 #553** | open | RESULT 中立文言。`pan === "tray"` の関数のみで、F4 と**ファイルが重ならない**。F4 は F3 を待たない（ただし E2E の通しは両方が要る）。 |
| E #521 / #540 | HOLD | 要求レシピが入るまで affordance は開かない（INV-TQ-4）。F4 の実機 HV には開く手段が要る（§4）。 |

## 3. DOUGH 工程の ○/□ 切替 UI（確認 3、5）

### 3.1 仕様（#538 範囲 6・7、addendum §4B.1）
- 置き場所: **ステップバー／GameScreen 側**。`PizzaStage.tsx` の DOUGH 分岐と丸い定数・predicate には触れない（#474）。
- アイコン主体で、技法名・レシピ名を出さない。目標 ≥ 44px、360×800 でステップバーに収まる（横スクロールなし）。
- 表示条件: DOUGH ステップ ∧ Free Cooking / Research（`techniqueRoundEligibility = FREE_COOK`）∧ affordance 開。Recipe Select（guided = `FREE_GUIDED`）、Lunch Rush、Dinner（`NONE`）は DOM に出さない。
- 現状コードには ○/□ に当たるものが一切無い（`MakingStepTabs` は DOUGH/SAUCE/CHEESE/TOPPING/BAKE/CUT のみ）。

### 3.2 「次へ」で確定、それまで再編集可（確認 5）
- 確定は既存の**前進のみ**のステップ遷移（`CONFIRM_MAKING_STEP`、コメント上 forward-only）で得られる。F4 のアクションは `PREPARE ∧ makingStep === "DOUGH"` でのみ有効、という 1 本のガードで O-7 を満たせる（SAUCE 以降は reducer が拒否）。
- **切替しても両方の生地状態を保持**: `pizza.doughShape`（丸）と `pizza.squareDough`（四角）は別フィールドなので、切替は `pan` を変えるだけで済む。**どちらも消さない**ことをテストで固定する。
- 完成後も「次へ」まで再編集可、再編集で未完成に戻れば「次へ」は再び無効（Owner 決定 2026-10-18）。これは C の責務で、F4 は「四角ラウンド判定が切替状態を見る」だけを受け持つ。
- **未決（小）**: `RESET`（`gameReducer.ts:1139`、`createEmptyPizza()`）は `pan` も消す。DOUGH 内のやり直しで ○/□ の選択を残すか戻すかは仕様に無い。**推奨: 戻す（`createEmptyPizza` 不変。丸い 57 件のバイト同一を守る）。** Owner 確認事項。

### 3.3 Technique 未解放時の表示と操作制限（確認 4）
| 状態 | 切替 | Dex | RESULT | 備考 |
|---|---|---|---|---|
| 要求レシピ 0 件（現 Production 全員） | DOM に無い | 「天板」の語も行も無し（F2 の `dexView` 済） | 語・四角サムネ・pan クラス無し | INV-TQ-4。**sweep テスト必須** |
| 要求レシピあり・affordance 閉 | DOM に無い | 同上 | 同上 | 開く条件は credited discovered count ≥ 導出 step（暫定 14、**実装時に ladder から再導出**し、数値をテストに書かない） |
| affordance 開・Technique 未発見 | 表示 | 「？？？」＋なぞかけのみ | 技法名は出ない | 名称「天板焼き」は発見後のみ |
| 発見後 | 表示 | 名称＋説明 | RESULT の技法段 → Dex | |

**操作制限は表示だけでなく reducer でも守る**（DOM が無くても action は送れるため）: F4 の action は `phase/step/eligibility/affordance` を全て検査し、満たさなければ state を返す（`COMMIT_SQUARE_DOUGH` と同じ流儀）。

## 4. □ で `PizzaState.pan = "tray"` を設定する正式な経路（確認 6）

### 4.1 設計（推奨）
1. **設定は 1 か所**: reducer の新 action（仮称 `SELECT_PAN { pan: "tray" | null }`）のみが `pizza.pan` を書く。`squareDough` から推定しない。
2. **四角ラウンド判定を 1 関数に集約**: 仮称 `effectivePanShape(recipe, pizza)` = Preview/DEV override ＞ `pizza.pan === "tray"` → `"square"` ＞ `resolvePanShape(recipe)`。以下 3 か所と B2 の `squareDoughRound` を**同じ関数**に向ける。
   - `COMMIT_SQUARE_DOUGH` のガード（`gameReducer.ts:1174`）
   - トッピング drop の `getPanGeometry`（`:1022`）
   - B2/C の `squareDoughRound`（GameScreen）
3. **ラウンド生成時の CUT 除去（`:678`）は変えない**: Free Cooking の recipe は CUT 許可リストに無い（`CUT_ELIGIBLE_RECIPE_IDS`、`FREE_COOK_RECIPE_ID` は不在）ため、□ を選んでも CUT の有無は変わらない。**テストで固定**（F4 が将来 CUT を持つ recipe に広がらないこと）。
4. 発見条件は既存 F2 のまま: 解放済み ∧ Free Cooking/Research ∧ Completion Gate PASS ∧ `pan = "tray"`（`resolveRoundTechniques`）。`?pan=square` だけでは発見にならない。
5. 保存: `pan` は `PizzaState` 上のみ。`PersistentSave` は `discoveredTechniqueIds` を足すだけで、スキーマ変更なし（§8）。

### 4.2 リスクと未決
- **継ぎ目の衝突**: 上記 3 の差し替えは B2 の `GameScreen.squareDoughRound = activePanShape(recipe) === "square"` と同じ行を触る。→ **B2 マージ後に F4-b を切る**（§7）。B2 の base は古く（`4f8dd7d`）、マージ前に main への付け替えが必要。
- **F4-b が先に入ると、□ を選んだ瞬間に「次へ」が無効のまま詰む**（C 未実装）。Production は affordance 閉で保護されるが、**Preview/HV では誰かが affordance を開く必要がある**。選択肢: (i) 既存 DEV State Editor の ownership/dex 編集（Research audit §2.2 で DEV のみ）、(ii) Preview 限定の override を F4 に足す（`?pan=square` と同型・production bundle gate の対象）。**Owner 判断**。新しい Preview リポジトリは作らない。
- **Anti-Oracle**: 切替の有無は「affordance 開 ∧ モード ∧ ステップ」だけの関数にし、**Research の target・ingredient の一致・購入ヒント数に依存させない**。target を振る sweep で DOM 完全一致を固定する。

## 5. 参照: 触るファイルの予定（実装時に #538 へ記録する）

F4-a（純ロジック、先行可）: 新規 `src/logic/pan/effectivePan.ts`（＋テスト）、新規 `src/logic/techniques/panSwitch.ts`（表示可否の純関数＋テスト）。**既存ファイルの変更なし**で切れる。
F4-b（B2 マージ後）: `src/state/gameReducer.ts`（action 追加・3 か所のガード差し替え）、`src/screens/GameScreen.tsx`（切替 UI・判定差し替え）、`src/App.tsx`（props 配線）、`src/App.css` 末尾の追記、`e2e/`（新規 spec）。
**触らない**: `PizzaStage.tsx` の DOUGH 分岐、`.pizza-dough--raw/--perfect/--burnt` の filter、`finishD2Inert.test.ts`、`doughShape.ts`、`doughSizeStatus`、`ResultPanel.tsx`（F3）、B2/C のファイル。

## 6. Research G2 共通文言と Anti-Oracle（確認 7）

**2 つの別の文言があり、混同されている。**

| | G2（Research 監査 §6.2、Owner 2026-10-18 round 2） | F3 中立文言（#553、Owner 決定 2026-10-18） |
|---|---|---|
| 文言 | 「材料だけでなく、生地の形や調理法も**工夫して**みよう。」 | 「材料だけでなく、生地の形や調理法も**見直して**みよう。」 |
| 面 | Research context（target が有効なときだけ存在する面） | RESULT の ORIGINAL カード（ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH 共通） |
| 出す条件 | **全 Research target で同一**。マッチ・Technique 状態・発見可否・購入数・試行数で変えない | `pizza.pan === "tray"` の関数のみ（丸には出さない） |
| main の実装 | **無し**（`src` に「工夫してみよう」は存在しない） | #553 に実装（open）。`panShapeNotice.ts` に定数 1 か所 |

指摘:
- **G2 には実装も担当 PR も無い。** #553 の Result は「Research G2 lead（`RESEARCH_ORIGINAL_LEAD_COPY`）は不変」と書くが、その定数は「まだ新しいレシピは見つかっていません」で、**G2 の文言ではない**。G2 は未実装のまま。
- 2 文は「工夫」と「見直し」で差があるが、**両方 Owner 確定済み**と読める。統一するかは Owner 判断（推奨: 統一しない。面も出現条件も別で、G2 は技法状態に依存しない一般文、F3 は pan 実績に依存する）。
- **推奨: G2 は F4 と別の小 PR（F5 仮称）にする。** 受け入れは Research audit R11: 定数 1 か所、recipe から導出しない、**timing-channel parity sweep**（target × rung 数 × 購入数 × 試行数 × affordance × 技法要否で、有無・文言・位置が完全同一）。置き場所は「Research target が有効」だけに依存する面（PREPARE の Research context、または Hint sheet）。**確定していないため Owner 確認が要る。**
- Anti-Oracle の F4 側の義務: 切替 UI は **target 非依存**（§4.2）。切替・四角サムネ・pan 用 CSS クラス・「天板」の語が、affordance 前の Dex・RESULT・設定・Changelog・Hint 5.0 に到達しない sweep（`PAN_TRAY_RECIPE_IDS` は現在 `deductionProduction.gate` と `hint5Production.gate` に別定義 — E で共通定数化、F4 では触らない）。
- Research の ○× は材料のみ。pan は ○× に影響しない（AC-7）。F4 で Research の判定コードは変更しない（R10: Research/pool が `techniques/*` を import しないテストを維持）。

## 7. 実装可能な独立範囲 / 依存範囲 / テスト / PR 分割（推奨）

| PR | 範囲 | 依存 | HV | 備考 |
|---|---|---|---|---|
| **F4-a** | `effectivePanShape` と切替可視性の**純関数**＋単体テスト。reducer・UI は変更しない | なし（B2/C/D2/F3 と無衝突） | 不要（見た目・挙動変化なし） | 実装前に触るファイルを #538 に記録 |
| **F4-b** | reducer の `SELECT_PAN`、3 か所のガード差し替え、GameScreen の切替 UI、App 配線、CSS 追記、E2E | **B2 マージ後**。C の「次へ」ゲートは F4-b の通し E2E に必要（C 前は切替 UI の存在・保持・確定後不可までを検証） | **必須**（390×844 動画は Owner へ直接、360×800 も、スクリーンショットは `docs/reports/screenshots/square-dough-f4/`） | Production は affordance 閉で不活性 |
| **F5（仮）** | G2 文言（Research）＋timing parity | Owner の置き場所確認 | 置き場所次第 | F4 と独立 |
| F3 #553 | 既存 | F4 と無関係 | — | 触らない |
| E #521 | grandma 追加、affordance 反転、`PAN_TRAY_RECIPE_IDS` 共通化 | D2・F4・F5・Design Lock §8 | 必須 | 範囲外 |

F4-a に含められる単体テスト:
- 優先順位: override ＞ `pan==="tray"` ＞ recipe。丸い 57 件（`pan` absent・`panShape` absent）は `"round"` のまま。
- 可視性の真理値表（`FREE_COOK`/`FREE_GUIDED`/`NONE` × affordance 開閉 × DOUGH/他ステップ）。target を引数に取らない（型で固定）。

F4-b に必要なテスト:
- reducer: `SELECT_PAN` が DOUGH 以外・guided・mission・dinner・affordance 閉で state 不変。DOUGH 内で ○→□→○ を往復しても `doughShape` と `squareDough` が保持される。確定（`CONFIRM_MAKING_STEP`）後は変更不可。`pan` を設定するのはこの action のみ（`grep` ベースのガード）。
- 判定の一元化: `COMMIT_SQUARE_DOUGH` とドロップ判定とレンダリングが同じ関数経由（四角ラウンド判定の分散を検出するテスト）。
- 発見: 解放済み ∧ Free Cooking/Research ∧ Completion Gate PASS ∧ `pan="tray"` で発見。`?pan=square` のみは発見にならない。
- Anti-Oracle sweep: 要求レシピ 0 件 / affordance 閉 / 開 × Research target の違い × モードで、切替・Dex・RESULT・設定・Changelog の DOM 差分（語・四角サムネ・pan クラス）。Hint 5.0 の行・梯子・near-miss に pan/天板/技法の語なし（`deductionProduction.gate`・`hint5Production.gate` の再実行結果と状態数を Result に記載、緩和しない）。
- affordance の導出: `materialStep` を差し替えて開く位置が動く（既存 F2 テストの拡張。数値 14 をハードコードしない）。
- E2E（`iphone-390x844` / `iphone-360x800` / `webkit-390x844` / `webkit-360x800`）: affordance 前は切替なし／後は表示、切替で生地状態が失われない、「次へ」後は切替不可、タップ目標 ≥ 44px、360×800 で横スクロールなし。WebKit 360×800 の既知の間欠失敗（#529/#531）や #548 で未解明だった `discovery3-oracle-neutralization` の失敗は**マスクせず別件と明記**。

## 8. 保存互換と既存の丸いピザ 57 件への影響（確認 8）

- **保存**: 調理中の `PizzaState`（`pan`・`squareDough` を含む）は保存対象外。保存されるのは `discoveredTechniqueIds` への `"tray"` 追加のみ（F2 で済）。スキーマ変更なし。旧 save → 新ビルド、新 save → 旧ビルド（未知 ID の保持）は F2/既存の `persistence` テストで担保。**F4 で追加するテスト: 保存 JSON に `pan` / `squareDough` が現れない**（#532 の統合計画コメントの指摘どおり C でも要る。重複は共通化してよい）。
- **丸い 57 件**: `createEmptyPizza()` を変更しない（`pan` は optional・absent のまま）、`Recipe.panShape` は 1 件も設定されない（`panShape.test.ts` が固定）、`activePanShape` の既定は `"round"`。F4-a は新規ファイルのみで、既存挙動は変わらない。F4-b はガードの置換なので、**`pan` が absent なら旧関数と同値**であることを差分テストで固定すれば足りる（57 recipe × 旧/新の一致）。
- **シグナチャ**: 丸い cook の `pan` 値は `null` のまま（F1 のテストで固定）。Discovery / matcher / 採点 / Dex は不変（D4）。

## 9. Owner 判断が要る点（一覧）

1. **F5（G2）の置き場所**と、G2「工夫」と F3「見直し」を別文言のままにするか。
2. **RESET 時に ○/□ の選択を保持するか**（推奨: 戻す）。
3. **Preview/HV での affordance の開け方**（DEV State Editor か、Preview 限定 override か）。
4. 内部名の最終確認: Technique id `tray`、`PizzaState.pan = "tray"`、生地形状 `PanShape = "square"` の 3 系統を F4 でも維持してよいか（Owner 決定 2026-10-18 により `tray` が正）。
5. F4-a の着手承認と、F4-b を B2 マージ後に切る順序の承認。

## 10. このレーンの制約遵守

docs 1 ファイルの追加のみ。`src`・e2e・CSS・Issue 本文・Preview は未変更。#546 と #553 は読み取りのみ、新しい Preview リポジトリは作成していない。B2 の実機 HV PASS・マージ前に C・D2 は実装していない。
