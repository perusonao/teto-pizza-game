# Teto Pizza Game — 実機Gameplay UX改善要求 4件 Fresh Audit Report

**Type:** Audit / 設計のみ。実装コード変更なし（docs-only）。

**Trigger:** 実機iPhoneプレイからの新規Gameplay UX改善要求4件（調理画面材料選択スクロール、CUT対象レシピ、
Lunch Rushホーム導線、Lunch Rushスコア/ランキング情報拡張）。

**Authority viewport:** 390×844。**Secondary:** 360×800。両方でPlaywright + 実Chromiumによる実測を実施。

**直近の関連PR:** #151（CUT評価details折りたたみ, MERGED）、#152（viewport 1画面完結対応, MERGED）。

---

## 0. Fresh確認

- `git fetch origin main` → `origin/main` HEAD = **`03ce18396bcdf9628bd03cc3cb895846a91e0db2`**
  （`fix: viewport 1-screen-completion -- fixed-height app frame + content-sized overlay panels (#152)`）。
  ユーザー提示の#152 Merge SHAと一致。これをaudited SHAとする。
- 直近5コミット: `03ce183`(#152) → `5a3eca6`(#151) → `8fe1839`(Phase4b) → `35119d9`(2.0C Fresh Audit) →
  `6534c07`(IAM fix)。過去情報より本SHAの実状態を優先して以下を記述する。
- Open Issue一覧（15件）を確認。本タスクに関連しうるもの:
  - **#87** Lunch Rush Online Ranking 1.0（weekly/monthly/all-time, Firebase） — 要求4のスコア/ランキング拡張は
    このIssueの延長線上。Phase4bで`setDisplayName`/`submitLunchRushScore`は稼働済み（コミット`8fe1839`）。
    **Duplicateではないが、#87の子/追加Phaseとして扱うべき。**
  - **#47** Making UX Cleanup（実機レビュー導線・見本・再挑戦・操作性） — Cheese/Topping drag、next CTA位置、
    Reference表示等を対象にしているが、**「材料選択のための縦スクロール」自体は明示されていない**。
    要求1とは隣接するが独立の問題であり、Duplicateではない。新規Issueは#47と競合しないよう分離する。
  - **#88** UX-4: Pizza Select single-screen pager — 対象はレシピ選択画面であり、調理画面（Making）の材料トレイ
    ではない。Duplicateではない。
  - CUT対象レシピ拡張、Lunch Rushホームへ導線については一致するOpen Issueなし。**新規Issue提案が必要。**

---

## 1. 調理画面：材料選択の縦スクロール問題

### 1.1 Root Cause（実装調査 + 実ブラウザ実測で確定）

構造は `src/screens/GameScreen.tsx`（PREPAREレイアウト全体を統括）+ `src/App.css`（全スタイルは
コンポーネント個別CSSではなく`App.css`に集中）。

**確定したroot causeは二重構造：**

1. **PizzaStageの「roomy」モードが常時375px前後を静的に占有する。**
   `.pizza-stage--roomy .pizza-dough`（`App.css:232-235`、PR #146由来）は
   `width/height: min(92vw, 380px)` — 390px幅では92vw=358.8px、パディング込みで約375px。
   `roomyStage`はDOUGH/SAUCE/CHEESE/TOPPINGの**PREPARE全工程で常にtrue**
   （`GameScreen.tsx:198-201`）。header(~60px) + MakingStepTabs(~50px) + order-card(~50px) + stage(~375px)
   で**844pxのうち535px以上が固定消費**され、残りはトレイ+固定CTAバー(84px予約)に約310pxしか残らない。
2. **PR #152の「fix」はページ全体スクロールを`.game-screen`単一のinternal scrollに変えただけ**で、
   トレイ専用のスクロール領域は存在しない（`.ingredient-tray`自体はドラッグ操作との競合を避けるため
   意図的に非スクロール、`App.css:950-962`のコメント参照）。これはユーザー指定の
   「page scrollをinternal scrollに変えただけでは完了扱いにしない」という懸念が的中していることの確証。
3. **「おすすめ」+「その他」の2セクション構成**が、所持材料が増えるほどトレイの実高さを押し上げる
   （`App.css:833-861`の`.ingredient-section`）。マルゲリータ単体（各工程1材料のみ）ではこの「その他」
   セクションが出現せず画面に収まるが、複数材料を所持した状態（中盤〜終盤の実プレイ状態）では
   「おすすめ1件+その他2〜3件」が積み上がり、フォールド外に出る。

### 1.2 実ブラウザ実測結果（Playwright + 実Chromium, headless、`npm run dev`起動状態）

**ケースA: マルゲリータ（各工程の選択肢が1種類のみ）**

| Viewport | DOUGH | SAUCE | CHEESE | TOPPING |
|---|---|---|---|---|
| 390×844 | scroll不要 | scroll不要（トレイ全体可視） | scroll不要 | scroll不要 |
| 360×800 | scroll不要 | scroll不要 | scroll不要 | scroll不要 |

マルゲリータ単体では`gsScrollHeight === gsClientHeight`（内部スクロール不要）。これは
**「材料が少ない場合は問題が発生しない」という限定条件下のみの結果**であり、実機レポートの
「材料も見づらい」という体感（stage 375px下の狭い帯にトレイが押し込まれている状態）自体は解消されていない。

**ケースB: クアトロフォルマッジ（SAUCE=3種所持、CHEESE=4種）— 中盤以降の実プレイを再現**

localStorageにSave v2形式で `dex`(margherita/funghi/marinara/bismarck/genovese discovered済み,
totalStars 15) + `ownedIngredientIds`(olive-oil/gorgonzola/parmigiano/fontina追加) +
`inventory`(該当4種 x99) を投入し、実際にクアトロフォルマッジを選択して実測:

| Viewport | SAUCE（おすすめ1+その他2） | CHEESE（4種、単一行） |
|---|---|---|
| 390×844 | **gsScrollHeight=1012 > innerHeight=844 → 内部スクロール必須**（トレイ末端が920pxまで伸び、画面下端844pxを76px超過） | scroll不要（4種が1行に収まる） |
| 360×800 | **gsScrollHeight=984 > innerHeight=800 → 内部スクロール必須**（トレイ末端892px、92px超過） | scroll不要 |

→ **「工程タブ・ピザ・現在使える材料・やり直す・次へ・ヒント」を同時に確認できない状態が、
両viewportで実測により再現・確定した。** 4種類程度の横並び（CHEESE）は現行レイアウトでも収まるが、
「おすすめ+その他」の縦積みレイアウト（SAUCE、および同構成のTOPPING）は3種類の所持だけで即座に
フォールド外に出る。これは「材料数が多いレシピ限定の問題」ではなく、**「プレイヤーが複数の同カテゴリ材料を
所持した時点で任意のレシピで発生する」構造的な問題**である。

screenshot: `docs/reports/screenshots/`には保存していない（スクラッチパッドに実測画像あり、再現手順は
上記の通りe2e化可能）。

### 1.3 候補A〜G Fresh Audit

| 候補 | 内容 | 評価 |
|---|---|---|
| A. ピザステージ縮小 | roomy 380px→通常278px相当へ | 最も効果大（535px→約430pxまで固定消費を圧縮）。ただしPR #146の意図（視認性向上）を後退させる。CUTフェーズも同じ`roomy`を使うため、CUTのタップ精度への影響を要検証 |
| B. 上部説明カード圧縮 | order-card(~50px)を圧縮 | 効果は限定的（50px程度）。単独では不十分 |
| C. 材料トレイ横スクロール化 | 現行3×2 grid→横スクロールstrip | ドラッグ操作との競合（既存コメントで一度否定された経緯）を再度踏む。要再検証 |
| D. 材料カードを小型化 | chip min-height 76px→縮小 | 視認性トレードオフ。「見づらい」という実機報告と逆行するリスク |
| E. 材料数が多い場合だけ横スクロール | 「おすすめ+その他」が閾値超えたら横スクロールに切替 | **有力**。現状の「4種は1行で収まる」実測と整合し、少数時は現行の見やすい縦積みを維持できる |
| F. bottom action barを固定 | 既に`position:fixed`で実装済み（`App.css:1155-1171`） | **対応済み。追加作業不要** |
| G. 工程ごとに不要UI削減 | SAUCE工程限定の`SauceMetricsPanel`等をPREPARE時は必要最小限に | 効果はあるが単独では不十分（SauceMetricsPanelは元々PREVIEW_MODE限定で本番非表示の可能性が高く要再確認） |

### 1.4 推奨レイアウト案

単一候補では不十分。以下の**組み合わせ**を推奨する（実装はPhase 1として分離）:

1. **A（ピザステージ縮小）を軸に**、PREPARE中の`roomy`サイズを`min(78vw, 300px)`程度（既存の非roomy値）
   に戻し、375px→約300pxまで縮小 → 固定消費535px→約460pxまで圧縮。
2. **E（閾値付き横スクロール）を「おすすめ+その他」の合算件数に適用**: 合計が画面に収まる件数
   （実測ベースで目安4〜5件）を超えたら、縦積み2セクションではなく横スクロールの単一行トレイに切替。
   件数が少ない今のマルゲリータ的な状態は現行の見やすい表示を維持する。
3. **F（bottom bar固定）は現状維持。**
4. B/D/Gは本Phaseでは見送り、実装後の再計測で不足があれば追加検討する。

この組み合わせにより、390×844実測で「工程タブ+ピザ+トレイ全体+固定CTAバー」が
1画面に収まる見込み（後続Phaseで実装後に同じPlaywright計測スクリプトで再検証必須）。

---

## 2. CUT対象レシピの拡張

### 2.1 Root Cause（確定）

**「マルゲリータのみ」は除外リストではなく、意図的な最小限ロールアウトの未完了状態。**

- `src/data/cookingProfiles.ts:61-69` — `COOKING_PROFILES`マップにエントリは**1件のみ**
  （`"margherita"` → `steps`に`"CUT"`を含み`cutConfig.requestedSliceCount: 6`）。
- `DEFAULT_COOKING_PROFILE`（同ファイル49-51行）は`steps: ["DOUGH","SAUCE","CHEESE","TOPPING"]`のみで
  `"CUT"`を含まない。マップに存在しない他14レシピは全てこのデフォルトに解決される。
- ゲート箇所: `src/state/gameReducer.ts:928-930` —
  `postBakeSteps(profile).length > 0 ? POST_BAKE(先頭=postBake[0]) : RESULT`。
  マルゲリータのみ`postBake.length > 0`となり`POST_BAKE`/CUTへ進む。他14レシピは`RESULT`へ直行。
- **6カット確認:** `src/logic/cut/types.ts:32-48` — `DEFAULT_REQUESTED_SLICE_COUNT = 6`。
  `CutConfig`は`CookingProfile`にネストされたper-recipe設定（グローバル定数ではない）。
- **Completion Gate非干渉の確認:** `src/components/ResultPanel.tsx:65,291` —
  「CUTスコアは`score.total`に一切組み込まれない、独立表示のみ」とコード内コメントで明記。
  設計ドキュメント`docs/design/TETO_PIZZA-CUTTING_1.0.md §14 Option D`と整合。
- **Phase境界:** 設計ドキュメント§18により Phase1=geometry/型のみ、Phase2=タッチUI+reducer配線
  （まだレシピ未活性化）、Phase3=評価+Result UI（独立スコア）、Phase4=Human Feel調整+
  「どの実レシピを最初にCUT対応させるか」という製品判断。**Phase4Aはこの判断そのもの
  （マルゲリータのみを選択）とその後の3件の小規模磨き込み**（重複CUT防止・Lunch Rushフィードバック・
  Result文言）に限定され、**「レシピ追加・4/8枚活性化は明示的にスコープ外」**と`docs/reports/
  TETO_PIZZA-CUTTING_Phase4A_Result.md`に記載済み。今回のPhase4A後がまさにこの「レシピ追加」段階。

### 2.2 全15レシピ一覧（`src/data/recipes.ts`基準、全て通常の丸型焼成ピザ）

| # | id | 和名 | 形状 | 現状CUT | CUTを付与すべきか |
|---|---|---|---|---|---|
| 1 | margherita | マルゲリータ | 丸型焼成 | **Yes（既存）** | Yes |
| 2 | marinara | マリナーラ | 丸型焼成 | No | **Yes** |
| 3 | quattro-formaggi | クアトロフォルマッジ | 丸型焼成 | No | **Yes** |
| 4 | genovese | ジェノベーゼ | 丸型焼成 | No | **Yes** |
| 5 | bismarck | ビスマルク | 丸型焼成 | No | **Yes** |
| 6 | funghi | フンギ | 丸型焼成 | No | **Yes** |
| 7 | fugazza | フガッサ | 丸型焼成 | No | **Yes** |
| 8 | salsiccia | サルシッチャ | 丸型焼成 | No | **Yes** |
| 9 | pepperoni | ペパロニ | 丸型焼成 | No | **Yes** |
| 10 | napoletana | ナポリターナ | 丸型焼成 | No | **Yes** |
| 11 | tonno-e-cipolla | トンノ・エ・チポッラ | 丸型焼成 | No | **Yes** |
| 12 | pizza-bianca | ピッツァ・ビアンカ | 丸型焼成 | No | **Yes** |
| 13 | breakfast-pizza | ブレックファストピザ | 丸型焼成 | No | **Yes** |
| 14 | capricciosa | カプリッチョーザ | 丸型焼成 | No | **Yes** |
| 15 | meat-lovers | ミートラヴァーズ | 丸型焼成 | No | **Yes** |

出典データ`data/recipes/pizza_master_catalog.json`で全15レシピは`mechanics: ["spread","scatter"]`のみ
（`foldDough`/`stuffedDough`/`specialShapePan`/`halfAndHalfSplit`なし）— **CUT不要にすべき特殊形状レシピは
現在1件も実装済みレシピの中に存在しない。** 実装候補プールにのみ存在する`calzone`/`fugazzeta`/
`mezza-e-mezza`/`siciliana`（未出荷、`src/**`未配線）は折込み/特殊形状のためCUT対象外とすべきだが、
これらは今回の15レシピには含まれない。

**結論: 「全レシピ一律CUT」という設計判断ではなく、既存15レシピが偶然すべて丸型焼成であるため
「全15レシピにCUTを付与」という結果になる。** 将来折込み系レシピ（calzone等）が実装される際は、
CookingProfileの`steps`に`"CUT"`を含めない（=デフォルトのまま）ことで自然に除外される —
これは既にCookingProfile自体がper-recipe optingの仕組みであるため、追加のロジック変更は不要。

### 2.3 拡張案（CookingProfileに沿った最小差分）

- `src/data/cookingProfiles.ts`の`COOKING_PROFILES`マップに、残り14レシピを1エントリずつ追加。
  各エントリは`{ steps: [...DEFAULT_COOKING_PROFILE.steps, "CUT"], cutConfig: { requestedSliceCount: 6 } }`
  （6カットを全レシピ共通の初期値とし、レシピ個別の枚数差別化はHuman Feel知見が出るまで見送る＝
  既存の「difficulty-based差別化はEvidenceなしでは行わない」という方針(#38コメント)と整合）。
- **エンジン/reducer/UI側の変更は不要。** `postBakeSteps`/`CONFIRM_BAKE`はレシピ非依存に一般化済みで、
  設計ドキュメント§3.2/§18が「データモデルは既にこれを無料で後回しにできるようにしている」と
  明記している通り。
- リスク: 14レシピ×CUT UIの新規露出により、CUT操作のHuman Feel検証（タップ精度・6カット所要時間）が
  マルゲリータ以外の生地サイズ・見た目でも成立するかを実機で再確認する必要がある
  （PizzaStageの見た目はレシピごとに異なるトッピング配置を持つため）。

---

## 3. Lunch Rush終了時のホーム導線

### 3.1 現状（確定）

`src/components/MissionResultOverlay.tsx`（`src/App.tsx:836-884`の`GameScreen`から表示）。
現在のCTA、DOM順:

1. `🏆 ランキングを見る`（`.secondary-button.mission-result__ranking-link`, line 64-66, `onShowRanking`）
   — action-row外、統計ブロック直下に単独配置。
2. `もう一度`（`.cta-button--primary`, line 68-70, `onRetry`）
3. `フリープレイへ`（`.secondary-button`, line 71-73, `onExit`）

2と3は`.action-row.action-row--column`（縦積み）でラップ、1はその外側。

### 3.2 再利用可能な既存「ホームへ」ロジック

`src/App.tsx:676-688` `handleGoHome()` が既に存在。RESULT表示中は`isRoundInProgress()`が
falseのため確認ダイアログなしで安全に呼び出せる（コード内コメントで明記）。新規実装は
`onGoHome`相当のpropをMissionResultOverlayへ配線するだけで済み、ロジックの新規実装は不要。

### 3.3 レイアウト予算（実測ベース）

`.mission-overlay__panel`（`App.css:1926-1939`, max-width 340px, content-sized、固定height無し）
内の現行構成: タイトル → 5行statsボックス → balance行 → ranking button(44px) →
action-row(primary 48px + secondary 44px、gap 10px)。既存e2e (`e2e/viewport-1screen.spec.ts:173-195`)
が`docScrollHeight <= innerHeight`を両viewportでアサート済みだが、**空きスペースの数値化はされていない
（マージン=0前提でギリギリ）。**

### 3.4 設計案

4番目のCTAをスタック追加すると+55〜60px相当の高さが増え、既存e2eの「1画面収まり必須」を破る恐れがある。
よって:

- **`フリープレイへ`と`🏠 ホームへ`を2x2グリッド（1行に2ボタン、`flex:1`ずつ）としてペア化**し、
  縦方向の追加を実質ゼロに抑える。既存の`.home-cta-row`（HOME画面の`cta-button--home`/
  `cta-button--home-secondary`、`flex:1`, 54px, 横並び）と同じパターンを流用することで
  ビジュアル言語の一貫性も確保できる。
- CTA優先順位: `もう一度`（primary、最も高頻度操作）→ `ランキングを見る`（secondary、単独）→
  `フリープレイへ` / `🏠 ホームへ`（2列、同格のsecondary）。
- 実装後、既存e2e(`viewport-1screen.spec.ts`)の該当テストを1行4ボタン構成に対応する形で更新し、
  390×844/360×800両方で`docScrollHeight <= innerHeight`を再アサートする（新規テスト、既存改変ではなく追加）。

---

## 4. Lunch Rushスコア/ランキング情報拡張

### 4.1 分類（A/B/C）

**A. 今回のプレイ結果画面だけに表示できる情報（永続化不要、クライアント側に既にある）**

- `src/mission/lunchRush.ts:98-121`の`MissionState.serves`（`LunchRushServeRecord`の配列、
  PASS/FAILED全件ログ）から**総枚数(`serves.length`)・成功枚数(`servedCount`)・失敗枚数
  (`serves.length - servedCount`)は既に導出可能**（現状は名前付きフィールドとして公開されていないが、
  ロジックはゼロから作らず既存配列を集計するだけで良い）。
- `MissionResultOverlayProps`（現状`servedCount, averageQuality, bestQuality, score,
  isNewBest, pitzReward, pitzBalance`）に失敗枚数・総枚数を追加表示することは**Firebase変更なしで
  今回の結果画面のみに実装可能。**

**B. ランキングへ永続化しないと表示できない情報**

- 「あなたの過去の成功/失敗枚数」「達成日時ベースの履歴」など、今回以外のプレイの情報。
- **達成日時（`achievedAt`）は既にFirestoreスキーマに存在する**
  （`functions/src/index.ts:45-58`の`tx.set`、サーバー生成タイムスタンプ）。**追加のスキーマ変更なしで、
  クライアント側の表示（`getWeeklyLeaderboard.ts`は既に読み取り済みだが`WeeklyRankingOverlay.tsx`が
  レンダリングしていない）を追加するだけで良い。B寄りだが実質「表示追加のみ」。**
- 「作ったピザの総枚数」「成功/失敗枚数」をランキング上に表示するには、これらをエントリごとに
  永続化する必要がある（現状`leaderboards/{periodId}/entries/{uid}`は`score, achievedAt, sourceRunId,
  displayName`のみ）。

**C. Cloud Function / Firestoreスキーマ変更が必要な情報**

- 上記の総枚数/成功枚数/失敗枚数をランキードエントリに追加するには、`functions/src/
  submitLunchRushScore.ts`（`handleSubmitLunchRushScore`, line 237付近で`totalAttempts =
  serves.length`, `failCount = serves.length - servedCount`を算出）と
  `functions/src/index.ts:56`の`tx.set(ref, {...})`呼び出しに新フィールドを追加する必要がある。
  **`leaderboards/*/entries/*`への書き込みは`firestore.rules:33`で完全にクライアント書き込み禁止
  （`allow write: if false`）済みのため、rules変更は不要 — Cloud Function側のみの変更で足りる。**

### 4.2 後方互換性設計

- 既存パターン（`resolveEntryDisplayName`/`resolveDisplayNameSnapshot`, `getWeeklyLeaderboard.ts:117-119`
  / `submitLunchRushScore.ts:164-172`）と同じ「欠落時はデフォルトへフォールバック」方式を新フィールド
  （`totalAttempts`, `successCount`, `failCount`）にも適用する: 読み取り側は
  `entry.totalAttempts ?? null`のようにOptionalとして扱い、値が無い旧entryは該当欄を非表示
  （「-」等）にする。既存の`score`/`achievedAt`/`displayName`/`sourceRunId`/personal-best
  semantics（upsert-if-higherのみ更新）には一切触れない。
- `rulesetVersion`（`lunch-rush-v1`）は厳格一致ゲートであり、追加フィールドのための`schemaVersion`と
  しては使わない。新フィールドは既存の「optional/defensive-read」方式のまま追加する
  （既存コードにこの用途の明示的な`schemaVersion`パターンは無い）。

### 4.3 スマホ向けランキング表示案

`WeeklyRankingOverlay.tsx`の1行（現状: 順位/名前/スコア/あなたバッジ）を2行構成に拡張:

```
1位  Player Name              1234
     ✅8 ❌1  9/20 14:32          [あなた]
```

- 1行目: 現状維持（順位・名前・スコア）。
- 2行目（新規、フィールド欠落時は省略）: 成功✅/失敗❌カウント + 達成日時（`achievedAt`を
  `toLocaleString`で簡易フォーマット、既存の日付非表示問題を解消）。「あなた」バッジは現状の位置を維持。
- 旧entry（`totalAttempts`等が`undefined`）は2行目を丸ごと非表示にし、1行目のみのレイアウトへ
  自然にフォールバックする（追加のフラグ分岐不要、`??`チェーンで自然に空になる）。

---

## 5. 優先順位の再評価（依存関係を踏まえて）

Fresh Audit結果、当初案からの変更点:

- **P0: 調理画面材料選択UX** — 変更なし。実測で構造的な問題であることを確認済み、他の3件と依存関係なし。
- **P1: Lunch Rush「ホームへ」** — 変更なし。既存`handleGoHome`の再利用のみで、Firebase非依存・低リスク。
  最も着手しやすいため、依存関係上はP0と並行/先行しても良い。
- **P1: CUT対象レシピ拡張** — 変更なし。データ変更のみ・エンジン変更なし・Completion Gate非干渉が確定済み。
  ただし14レシピ×CUT UIのHuman Feel実機確認が必要なため、実装自体は小さいが**検証コストが読みにより
  大きい**点をP1のまま維持しつつ、着手順は「ホームへ」より後で良い。
- **P1/P2: Lunch Rushスコア/ランキング情報拡張** — **細分化を推奨。**
  - 「結果画面のみに成功/失敗/総枚数を追加表示」（分類A）はFirebase非依存でP1相当に格上げ可能
    （低リスク・低規模）。
  - 「ランキング上に達成日時を表示」（分類B、スキーマ変更不要）もP1相当に格上げ可能。
  - 「ランキングに成功/失敗/総枚数を永続化して表示」（分類C、Cloud Function変更必須）は
    ユーザー指示通り**別PR・P2として分離**。

依存関係:
- P0（材料選択UX）は他の3件と完全に独立 → 並行実装可。
- Lunch Rush「ホームへ」はP0と独立 → 並行実装可。
- CUT拡張はP0/ホームへと独立だが、CUT UIのHuman Feel実機確認のため専用Preview必須。
- ランキング情報拡張は「分類A/B（結果画面表示・日時表示）」→「分類C（永続化+Functions）」の順で
  段階実装すべき（Cで書き込むデータをA/Bの表示が先取りして検証できる）。

---

## 6. Phase分割（各2〜3時間のClaude Codeタスク単位）

### Phase 1: 材料選択UX — ピザステージ縮小 + 閾値付き横スクロール

- **目的:** SAUCE/CHEESE/TOPPING工程で「工程タブ・ピザ・材料・やり直す・次へ・ヒント」を
  390×844/360×800で1画面に収める。
- **変更対象:** `src/App.css`（`.pizza-stage--roomy`縮小、`.ingredient-section`/`.ingredient-tray`の
  閾値付き横スクロールCSS追加）、`src/screens/GameScreen.tsx`（閾値判定ロジック、必要なら
  `IngredientTray.tsx`にも件数判定を渡す）。
- **Firebase変更:** なし。
- **リスク:** CUTフェーズも`roomy`を共用するため、縮小がCUTのタップ精度に影響しないか実機確認が必要
  （中リスク）。横スクロール導入はドラッグ操作との過去の競合再発リスクあり（要回帰テスト）。
- **推定規模:** 2〜3時間（CSS変更+閾値ロジック+Playwright実測スクリプトでの検証込み）。
- **完了条件:** 本レポートの実測スクリプトと同条件（マルゲリータ+クアトロフォルマッジ相当の
  複数所持状態）で、390×844/360×800両方の全PREPARE工程で`gsScrollHeight <= gsClientHeight`
  （内部スクロール不要）をPlaywrightで確認。既存e2eすべてグリーン。
- **前提Phase:** なし。

### Phase 2: Lunch Rush「ホームへ」CTA追加

- **目的:** Lunch Rush結果画面に明確な`🏠 ホームへ`を追加し、既存3CTAとの優先順位・配置を整理。
- **変更対象:** `src/components/MissionResultOverlay.tsx`（新規prop`onGoHome`追加、
  `フリープレイへ`と2x2グリッド化）、`src/App.tsx`（`handleGoHome`をpropとして配線）、`src/App.css`
  （2列グリッド用クラス追加）。
- **Firebase変更:** なし。
- **リスク:** 低。既存ロジック（`handleGoHome`）の再利用のみ。
- **推定規模:** 2時間。
- **完了条件:** 390×844/360×800両方で結果モーダルが`docScrollHeight <= innerHeight`を維持したまま
  4CTA表示。既存e2e更新+新規アサーション追加。
- **前提Phase:** なし。

### Phase 3: CUT対象レシピ拡張（14レシピへのCookingProfile追加）

- **目的:** マルゲリータ以外の14レシピにもCUTフェーズを付与する。
- **変更対象:** `src/data/cookingProfiles.ts`のみ（`COOKING_PROFILES`マップに14エントリ追加）。
- **Firebase変更:** なし。
- **リスク:** 低（データ変更のみ、エンジン非変更）。ただしCUT UIの見た目・タップ精度が
  レシピごとのトッピング配置・生地色で成立するかのHuman Feel実機確認が必要（中リスク、検証コスト）。
- **推定規模:** 2〜3時間（データ追加は小さいが、14レシピ分のCUT実機/Playwright確認を含む）。
- **完了条件:** 15レシピ全てで`postBakeSteps`が`CUT`を含み、`POST_BAKE`フェーズに正しく遷移する
  ユニットテスト追加。既存Completion Gate/スコアテストに影響なし（`score.total`非変更）を確認。
- **前提Phase:** なし（Phase 1と技術的に独立、並行可）。

### Phase 4: Lunch Rush結果画面 — 成功/失敗/総枚数の今回表示 + ランキング達成日時表示

- **目的:** 分類A（結果画面のみ）・B（既存`achievedAt`の表示追加）を実装。
- **変更対象:** `src/mission/lunchRush.ts`/`src/logic/missionScoring.ts`（`serves`から
  総枚数/成功/失敗を導出するヘルパー追加）、`MissionResultOverlay.tsx`（表示追加）、
  `WeeklyRankingOverlay.tsx`（`achievedAt`表示追加、`getWeeklyLeaderboard.ts`は変更不要）。
- **Firebase変更:** なし（既存`achievedAt`フィールドの表示のみ、書き込み側は変更しない）。
- **リスク:** 低。
- **推定規模:** 2〜3時間。
- **完了条件:** Lunch Rush結果画面に成功/失敗/総枚数が表示される。ランキング各行に達成日時が表示される
  （旧データでも`achievedAt`は既に必須フィールドとして書かれているため後方互換問題なし）。既存vitestに
  新規テスト追加。
- **前提Phase:** なし。

### Phase 5: Lunch Rushランキングへの成功/失敗/総枚数の永続化（別PR、Firebase変更あり）

- **目的:** 分類C。ランキングエントリに`totalAttempts`/`successCount`/`failCount`を追加し、
  スマホ向け2行レイアウトで表示する。
- **変更対象:** `functions/src/submitLunchRushScore.ts`（算出+`RunDocInput`/
  `upsertLeaderboardEntryIfHigher`シグネチャ拡張）、`functions/src/index.ts`
  （`tx.set`に新フィールド追加）、`src/firebase/getWeeklyLeaderboard.ts`（新フィールドの
  defensive読み取り追加）、`WeeklyRankingOverlay.tsx`（2行レイアウト、Phase 4のUIを拡張）。
- **Firebase変更:** **あり**（Cloud Functions変更。Firestore rulesは変更不要、
  既存の`allow write: if false`のまま）。
- **リスク:** 中。サーバー権威スコア・personal-best semantics・displayNameスナップショットを
  壊さないよう、既存の「upsert only if higher score」ロジックに新フィールドを追加する際に
  既存フィールドの上書きタイミングを変えないこと（スコアが更新されない限りcountsも更新されない、
  という仕様確認が必要）。旧entry（新フィールド無し）の後方互換をPhase 4のdefensive read
  パターンで担保。
- **推定規模:** 3時間（Cloud Functions変更+デプロイ確認+後方互換テスト）。
- **完了条件:** 新規Lunch Rush submitで新フィールドがFirestoreに書き込まれる。旧entryは
  新フィールド欠落のまま正しく表示崩れなくレンダリングされる。既存のserver-authoritative
  score/personal-best/displayNameスナップショット/「あなた」/weekly-monthly-all-timeの
  全既存テストがグリーン。
- **前提Phase:** Phase 4（表示側の実装が先にあることで、Cloud Function側のデータ構造検証が容易になる）。
  **ユーザー指示の通り、Phase 1〜4とは別PRとする。**

---

## 7. Issue Duplicate Gate / 新規Issue提案

- **要求4（ランキング情報拡張）は既存 #87（Lunch Rush Online Ranking 1.0）の追加Phaseとして
  同Issueに紐づけるべき**（Duplicate Gate: 新規Issueを立てず、#87へPhase 4/5の提案をコメント追記する
  運用を推奨）。
- **要求1（材料選択UX）は #47（Making UX Cleanup）と隣接するが、「縦スクロールで材料が見づらい」は
  #47の既存Acceptance Criteriaに明示されていないため、新規Issue提案が必要。** 新規Issueは#47を
  参照し、重複実装を避ける（#47のCheese/Topping drag audit等とは独立のレイアウト問題として分離）。
- **要求2（CUT対象レシピ拡張）・要求3（Lunch Rushホームへ）は一致する既存Issueなし。新規Issue提案が必要。**

### 新規Issue提案（3件、本レポートの結果を本文に転記する想定）

1. **「調理画面: SAUCE/CHEESE/TOPPING工程での材料選択縦スクロール解消（Phase 1）」**
   — 本レポート§1を本文とし、#47を related issueとしてリンク。
2. **「CUT対象レシピの拡張: マルゲリータ以外14レシピへのCookingProfile付与（Phase 3）」**
   — 本レポート§2を本文とする。
3. **「Lunch Rush結果画面への🏠ホームへCTA追加（Phase 2）」**
   — 本レポート§3を本文とする。

要求4はIssue #87へのコメント追記（Phase 4/5の提案）として処理し、新規Issueは立てない。

（本Auditの結論に基づき、上記3件は実装Issueとしてこの後Fresh Auditの結果を踏まえて作成する。
今回のPRはdocs-onlyのため、Issue本文への転記は本レポートのマージ後に行う。）

---

## まとめ（最終報告用）

- audited main SHA: `03ce18396bcdf9628bd03cc3cb895846a91e0db2`
- Audit Report path: `docs/reports/TETO_GAMEPLAY-UX_4ITEMS_Fresh-Audit.md`
- 現在CUT対象のレシピ: マルゲリータのみ（他14レシピは全て通常丸型焼成でCUT対象にすべき）
- 材料選択UXのroot cause: PizzaStage roomyモードの静的375px占有 + PR#152のページ全体スクロール化が
  トレイ専用領域を作らなかったこと + 「おすすめ+その他」2セクション構成が複数材料所持時に
  フォールドを超える構造的問題（マルゲリータ単体では発生しないが、中盤以降の実プレイ状態で確実に発生することを実測確認）
- 推奨レイアウト案: ピザステージ縮小（roomy→通常サイズ） + 材料合計件数の閾値を超えた場合のみ横スクロール化
- Lunch Rush HOME導線案: 既存`handleGoHome`を再利用し、`フリープレイへ`と`🏠ホームへ`を2x2グリッドでペア化
- score/result/rankingで現在取得できる情報: 結果画面は`servedCount/averageQuality/bestQuality/score`等
  （成功/失敗/総枚数はserves配列から導出可能だが未表示）。ランキングは`score/displayName/achievedAt`
  （achievedAtは書込済みだが未表示）
- 新規保存が必要な情報: 総枚数・成功枚数・失敗枚数のランキングエントリへの永続化（達成日時は既存フィールドで対応可能）
- Firebase変更が必要なPhase: Phase 5のみ（Cloud Functions変更。Firestore rules変更は不要）
- 推奨実装Phase一覧: Phase 1(材料選択UX) / Phase 2(ホームへ) / Phase 3(CUT拡張) / Phase 4(結果画面情報表示) / Phase 5(ランキング永続化, 別PR)
- 最初に着手すべきPhase: **Phase 1（材料選択UX、P0）**。Phase 2/3は独立して並行着手可。
