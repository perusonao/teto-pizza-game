# Teto Pizza Game — Gameplay UX Phase 1: 材料選択スクロール解消 Result Report

**Type:** 実装（コード変更あり）。

**Base:** `origin/main` HEAD = `209d60d61b81e7d5181e3eb63d758d46156cfc45`
(`docs: Fresh Audit -- 実機Gameplay UX改善要求4件 ... (#153)`) -- Fresh fetch確認済み、Duplicate
Gate #1でこのSHAをそのままbaseとして採用（audit report記載のPR #153 Merge SHAと一致）。

**Audit report this implements:** `docs/reports/TETO_GAMEPLAY-UX_4ITEMS_Fresh-Audit.md` §1/§6
Phase 1。

**Trigger:** 実機iPhoneで「材料を選択するためにスクロールが必要で、見づらいし操作しづらい」という報告。
PR #152はpage/body scrollを`.game-screen`内部scrollへ変えただけで、材料選択のための縦スクロール自体は
残っていた。

---

## 0. Duplicate Gate #1（実装開始前）

- `git fetch origin` → `origin/main` HEAD = `209d60d61b81e7d5181e3eb63d758d46156cfc45`（ユーザー
  指定のPR #153 Merge SHAと一致、追加コミットなし）。
- Open PR一覧（5件: #105, #72, #46, #34, #3）を確認 -- いずれも本タスクのscope（材料選択UX/
  PizzaStage/IngredientTray）と無関係（自動化ワーカー基盤、docs訂正、Dough D0 audit、Reference visual
  Phase1、Pages infra）。
- Issue検索・remote branch一覧で `claude/teto-ingredient-tray-overflow-e2qsyy` /
  `claude/gameplay-ux-next-audit-4zdo37` を発見。両ブランチともPR #81〜84時代のmainから分岐した
  約70コミット遅れの古いブランチで、対応するOpen PRが存在しない -- 放棄/stale状態と判断し、
  重複進行中作業ではないと結論。
- 上記より重複実装なしと判断し、実装を開始。

---

## 1. Root Cause（Fresh Auditの再確認）

Fresh Audit §1.1で特定済みの二重構造:

1. `.pizza-stage--roomy .pizza-dough`（Visual Polish 2.0A由来）がPREPARE全工程で約375px
   （`min(92vw, 380px)`実測）を静的占有 -- `GameScreen.tsx`の`roomyStage`が`PREPARE || BAKE ||
   (POST_BAKE && CUT)`だったため、DOUGH/SAUCE/CHEESE/TOPPINGすべてがこの拡大サイズを使っていた。
2. `.ingredient-tray`が`grid-template-rows: repeat(2, 1fr)`で、所持材料が1〜2件でも常に2行分の
   高さ（chip min-height 76px x2 + gap）を予約していた。
3. 「このピザにおすすめ」+「その他」の2セクション構成自体が、両方存在する工程（複数カテゴリ材料を
   所持した場合のSAUCE/TOPPING）で見出し+ブロックの二重オーバーヘッドを生む。

実機再現には`quattro-formaggi`（クアトロ フォルマッジ）のような複数材料所持状態が必要 --
マルゲリータ単体（各工程1材料）では顕在化しない、という Fresh Audit の指摘を踏襲。

---

## 2. 実装内容

### A. PizzaStageの縮小（Fresh Audit推奨案そのまま）

`src/screens/GameScreen.tsx`の`roomyStage`からPREPAREを除外:

```diff
- const roomyStage =
-   state.phase === "PREPARE" ||
-   state.phase === "BAKE" ||
-   (state.phase === "POST_BAKE" && state.makingStep === "CUT");
+ const roomyStage =
+   state.phase === "BAKE" || (state.phase === "POST_BAKE" && state.makingStep === "CUT");
```

PREPAREは`roomy`が外れたことで既存の非roomyデフォルト（`.pizza-dough`, `min(78vw, 300px)`）に
戻る。BAKE/CUTは`roomy`のまま変更なし -- CUTのタップ精度/Human Feelは無変更（後述§5で実機確認）。

さらに実機の安全マージンとして、PREPARE専用の`compact`バリアントを追加（ORDER画面の
デフォルトサイズには一切触れない、新規のscoped modifier class）:

- `PizzaStage.tsx`に`compact?: boolean`propを追加、GameScreen.tsxから
  `compact={state.phase === "PREPARE"}`として配線。
- `.pizza-stage--compact .pizza-dough { width/height: min(76vw, 290px) }`（ORDER等が使う
  共有デフォルト`min(78vw, 300px)`はそのまま、PREPAREだけ追加で一段階小さいサイズ）。

理由: 360x800でヘッドレスChromium実測がPizzaStage縮小+グリッド修正だけではSAUCE工程で
ちょうど0pxの余白（`gsScrollHeight === gsClientHeight`ぎりぎり）となり、実機Safariのフォント
メトリクスが数px違うだけで再びオーバーフローしうる状態だったため、追加の安全マージンとして導入。

### B. 材料トレイの「その他」グリッドを内容量に応じてサイズ

`src/App.css`の`.ingredient-tray`:

```diff
  .ingredient-tray {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
-   grid-template-rows: repeat(2, 1fr);
+   grid-auto-rows: minmax(0, auto);
    gap: 8px;
  }
```

所持1〜3件なら1行、4〜6件（`MAX_INGREDIENT_PALETTE_SLOTS`上限、既存のページング機構は完全に無変更）
なら2行と、実際の件数に応じて高さが決まるようになった。**`IngredientTray.tsx`のドラッグ/タップ/
ページング（◀▶）ロジックは1行も変更していない** -- 純粋にCSSのみの変更。

### C. 小さな余白トリム（複数箇所、いずれも低リスク）

「おすすめ」+「その他」が両方存在する工程（SAUCE等）のオーバーヘッドを削るため、以下を実施
（既存の視認性/タップ性を損なわない範囲での微調整、実測しながら段階的に決定）:

| 対象 | Before | After |
|---|---|---|
| `.ingredient-chip` min-height | 76px | 68px（タップ領域は依然44pt目安を大きく上回る） |
| `.ingredient-section` margin-bottom | 8px | 4px |
| `.ingredient-section__title` margin-bottom | 4px | 2px |
| `.ingredient-row--recommended` padding-bottom | 2px | 0px |
| `.ingredient-panel` padding-top | 4px | 2px |
| `--bake-bar-reserve`（固定CTAバー予約領域） | 84px | 78px（実測バー高さ74pxに対し4pxの余白を維持） |
| `.order-card` margin-top / padding | 6px / 8px 12px | 4px / 6px 12px |
| `.pizza-stage` padding | 8px 16px | 6px 16px |
| `.making-step-tabs` padding-top | 6px | 4px |
| `.app-header` padding（top/bottom基準） | 10px | 8px |

これらはPREPARE全体（DOUGH含む）とORDER以外の全画面のヘッダー/タブに影響するため、既存の
Playwright回帰スイート（HOME/Recipe Select/Weekly Ranking/Lunch Rush/CUT round）を全て
再実行して非破壊を確認済み（§6）。

### D. CUTとの分離

- CUTは`roomyStage`に残したまま（`state.phase === "POST_BAKE" && state.makingStep === "CUT"`）
  -- サイズ変更なし。
- `compact`はPREPARE専用（`state.phase === "PREPARE"`のみ）で、CUT/BAKEには一切適用されない。
- 既存e2e「FREE RESULT: margherita CUT round」（DOUGH→SAUCE→CHEESE→TOPPING→BAKE→CUT→RESULTの
  フルラウンド、cutThreeLines実ドラッグ含む）が引き続き成功することを確認（§6）。

---

## 3. Before / After 実測

**Fixture:** Fresh Audit §1.2と同じ考え方の「複数材料所持」再現データを、実際のゲーム内chain-unlock
ルール（`isRecipeAvailable`, `src/state/progression.ts`）に沿って構築 -- margherita → funghi →
marinara → bismarck → genovese → quattro-formaggi の順に発見済みとし（totalStars 15、
quattro-formaggiのunlockCondition`minTotalStars: 8`を満たす）、各レシピのStarter Grant相当の
所持材料（olive-oil/gorgonzola/parmigiano/fontina/garlic/oregano/pesto/cherry-tomato/egg/
mushroom）を`ownedIngredientIds`/`inventory`に直接投入（localStorage Save v2形式）。結果:

- SAUCE: おすすめ1（olive-oil）+ その他2（tomato-sauce, pesto）-- Fresh Audit実測と同一構成。
- CHEESE: おすすめ4（mozzarella, gorgonzola, parmigiano, fontina）、その他0。
- TOPPING: おすすめ0、その他6（basil, garlic, oregano, cherry-tomato, egg, mushroom）--
  `MAX_INGREDIENT_PALETTE_SLOTS`ちょうどの境界値。

### Before（`209d60d`時点のコード、本タスクの変更前）

`.game-screen scrollHeight` vs `clientHeight`（超過分 = 材料選択に必要な縦スクロール量）:

| Viewport | SAUCE | CHEESE | TOPPING | margherita(参考, SAUCE) |
|---|---|---|---|---|
| 390x844 | **1012 / 844（168px超過）** | 844 / 844（収まる） | 863 / 844（19px超過） | 844/844（収まる） |
| 360x800 | **984 / 800（184px超過）** | 800 / 800（収まる） | 818 / 800（18px超過） | 801 / 800（1px超過、ぎりぎり） |

SAUCE 390x844=1012、360x800=984はFresh Audit §1.2の実測値（1012 / 984）と完全一致 -- 同一の
regressionを再現できていることを確認済み。marginaritaでさえ360x800で1px超過していた点は
Audit未記載の追加知見（TOPPING/CHEESEの余白がほぼゼロだった証左）。

### After（本タスクの変更後）

| Viewport | 工程 | needsScroll | 水平overflow | CTAバー上の余白(px) |
|---|---|---|---|---|
| 390x844 | DOUGH/SAUCE/CHEESE/TOPPING（margherita） | false | 0 | 136 / 170 / 166 |
| 390x844 | SAUCE/CHEESE/TOPPING（quattro-formaggi重量級） | false | 0 | 41 / 170 / 101 |
| 360x800 | DOUGH/SAUCE/CHEESE/TOPPING（margherita） | false | 0 | 108 / 142 / 138 |
| 360x800 | SAUCE/CHEESE/TOPPING（quattro-formaggi重量級） | false | 0 | **13** / 142 / 73 |

全ケースで`gsScrollHeight <= gsClientHeight`（内部スクロール不要）、水平overflowゼロを達成。
最も厳しいケース（360x800, quattro-formaggi, SAUCE）でも実コンテンツ終端(`.ingredient-panel__
content-end`)とCTAバー上端の間に約13pxの実余白があり、ヘッドレスChromiumとSafariの
フォントメトリクス差を吸収できる状態にした（§2-Aの`compact`バリアント導入の理由）。

### PizzaStage サイズ Before/After

| フェーズ | Before | After |
|---|---|---|
| DOUGH/SAUCE/CHEESE/TOPPING（PREPARE） | roomy: `min(92vw, 380px)`（実測約375px） | `compact`: `min(76vw, 290px)` |
| BAKE | roomy: `min(92vw, 380px)` | 変更なし |
| POST_BAKE/CUT | roomy: `min(92vw, 380px)` | 変更なし |
| ORDER（参考、対象外） | `min(78vw, 300px)` | 変更なし |

### Screenshots

`docs/reports/screenshots/gameplay-ux-phase1/`:

- Before（`before/`サブフォルダ、変更前コードで撮影）: `before-390x844-{DOUGH,SAUCE,CHEESE,
  TOPPING}.png`, `before-360x800-{DOUGH,SAUCE,CHEESE,TOPPING}.png` -- SAUCE screenshotで
  「その他」セクションが固定CTAバーの下に隠れ、scroll cueのシェブロン(▼)のみが覗いている
  実際の不具合を確認できる。
- After（変更後コード）: `390x844-{DOUGH,SAUCE,CHEESE,TOPPING}.png`,
  `360x800-{DOUGH,SAUCE,CHEESE,TOPPING}.png` -- 工程タブ・ピザ・材料トレイ全体・固定CTAバーが
  スクロールなしで1画面に収まっている。
- CUT無変更確認: `390x844-CUT-unaffected.png`（margherita CUTフェーズ、roomy sizeのまま、
  切断線ガイド/中心/配置済みトッピングが変更前と同じ見た目で表示）。

---

## 4. Human Feel Gate（実機相当のPlaywright + 実Chromium操作確認）

390x844で以下を実施し、いずれも問題なし:

- **ピザが小さすぎない**: DOUGH/SAUCE/CHEESE/TOPPINGとも`min(76vw, 290px)`で、境界線(dashed
  guide)・トッピング配置・チーズスロットが視認できるサイズを維持（screenshot参照）。
- **材料名が読める**: chip名（オリーブオイル/ゴルゴンゾーラ/パルミジャーノ等）はmin-height 68pxの
  chip内で省略・重なりなく表示。
- **材料カードが押しにくくない**: 既存の`ingredient-chip`のクリック/ポインターイベントは無変更
  （min-height 68pxは依然44pt目安を大きく超える）。
- **横trayの有無**: 本実装では「その他」を横スクロール化せず、既存の縦グリッド+ページング
  （◀▶、7件目以降のみ出現）のまま採用 -- 後述§9の判断理由参照。よってswipe/drag競合は
  新規に発生しない。
- **材料を選択した直後にピザを操作**: 既存のIngredientTray/PizzaStageのpointer
  down/move/up配線は無変更のため、選択→配置のフローはそのまま。
- **次へ/やり直す/ヒント**: `.prepare-bake-bar`は`position: fixed`のまま、全工程で表示・
  タップ可能なことをPlaywrightのboundingBox assertionで確認（§6の新規e2e）。
- **誤操作が増えない**: chip間のgap/paddingは維持、選択状態のborder強調（`--selected`）も無変更。

以上より、数値（scrollHeight<=clientHeight, 水平overflow=0）に加えてHuman Feelの観点でも
Phase 1のゴールを満たしていると判断。

---

## 5. CUTへの影響

- `roomyStage`計算からPREPAREのみを除外し、CUT（`POST_BAKE && makingStep === "CUT"`）と
  BAKEはそのまま`roomy: true`を維持 -- CSS上もCUTが使う`.pizza-stage--roomy`ルール自体は
  無変更（`min(92vw, 380px)`）。
- 新設の`compact`propはPREPAREでのみ`true`になり、CUT/BAKEでは常に`false`
  （`PizzaStage`側で`roomy`と`compact`が同時にtrueになることはない設計）。
- 既存e2e「FREE RESULT: margherita CUT round」（cutThreeLines実ドラッグで3本の切断線を実際に
  引く操作を含む）が本タスクの変更後も成功することを確認（§6）-- CUTの操作感（サイズ・タップ
  判定）に回帰がないことの直接的な証拠。
- 追加でCUTフェーズのスクリーンショットを撮影し、切断線ガイド・中心・配置済み具材の見た目が
  変更前と同一であることを目視確認（`390x844-CUT-unaffected.png`）。

---

## 6. Automated Tests

### 新規e2e（`e2e/viewport-1screen.spec.ts`に追加、`e2e/gestures.ts`にfixtureヘルパー追加）

`describe("PREPARE: ingredient selection never needs vertical scroll (Gameplay UX Phase 1)")`:

1. **margherita baseline** -- DOUGH/SAUCE/CHEESE/TOPPINGの各工程で
   `gsScrollHeight <= gsClientHeight`、水平overflow=0、`.prepare-bake-bar`が画面内に収まることを
   assert。
2. **quattro-formaggi heavy inventory**（新規`startQuattroFormaggiHeavyInventory`ヘルパー、
   実際のchain-unlockルールに沿った複数材料所持fixtureをlocalStorageへ直接投入）-- SAUCE/
   CHEESE/TOPPINGの各工程で同様のassertionに加え、chipクリック→`--selected`クラス付与という
   実際の操作可能性（Human Feel Gateの数値側の裏付け）も検証。

両テストとも**390x844と360x800の両Playwrightプロジェクトで実行**（`playwright.config.ts`の
既存2プロジェクト構成をそのまま利用、新規プロジェクト追加なし）。

**Regression確認**: 変更前コード（`git stash`で`src/App.css`/`src/screens/GameScreen.tsx`/
`src/components/PizzaStage.tsx`のみを一時的に退避）に対して同じ新規テストを実行したところ、
3ケースが実際に失敗することを確認 -- 特にSAUCE工程の失敗値（390x844: 1012、360x800: 984）は
Fresh Audit §1.2の実測値と完全一致し、これらのテストが実際の報告された不具合を捕捉している
ことを裏付けた。その後`git stash pop`で修正を復元し、全テストがPASSに戻ることを再確認済み。

### テスト実行結果

- `npm test`（vitest, jsdom）: **2076/2076 pass**（既存2076件、変更なし -- 本タスクは
  `IngredientTray.tsx`のロジックを一切変更していないため、既存ユニットテストへの影響なし）。
- `npm run test:e2e`（Playwright, 実Chromium, 390x844 + 360x800）: **20/20 pass**
  （既存16件 + 新規4件）。console error / page error = 0（別途Playwrightスクリプトで
  quattro-formaggi fixtureのSAUCE→CHEESE→TOPPING操作を通しても確認済み）。
- `npx tsc -b --force`: エラーなし。
- `npm run lint`（oxlint）: エラーなし。
- `npm run build`: 成功（既存のchunk-size警告のみ、本タスク由来ではない既知の警告）。

---

## 7. Regression（他機能への影響なし）

以下は無変更、または既存e2e/vitestの再実行で非破壊を確認:

- **PR #151 CUT details disclosure**: `ResultPanel.tsx`等CUT関連コンポーネント無変更。
- **PR #152 viewport固定**: `.app-frame`/`.game-screen`の`overflow-y: auto`/固定height機構は
  無変更 -- 既存e2e「Static screens fit the viewport」「Lunch Rush RESULT -> Weekly Ranking」
  「FREE RESULT」全件PASS。
- **Recipe Select**: `PizzaSelectScreen.tsx`無変更、既存e2e PASS。
- **FREE / Lunch Rush / Cooking Steps / Step Timing**: reducer/mission/cookingProfiles全て
  無変更。
- **Completion Gate / Scoring 2.0**: `src/logic/scoring*`/`gameReducer.ts`無変更、vitest
  2076件（scoring/completion関連含む）全PASS。
- **CUT**: §5参照、既存e2e margherita CUT round PASS。
- **Inventory / Shop / Dex / Player Profile / Weekly Ranking / displayName / 「あなた」**:
  該当コンポーネント（`InventoryScreen`/`ShopOverlay`/`DexOverlay`/`SettingsOverlay`/
  `WeeklyRankingOverlay`等）は無変更、既存e2e（HOME overlays、Weekly Ranking系）全PASS。
- **Firebase**: `functions/`配下、`firestore.rules`、CI/CD workflow（`.github/workflows/`）は
  一切変更していない（`git diff --stat`で確認 -- 変更ファイルは`e2e/gestures.ts`,
  `e2e/viewport-1screen.spec.ts`, `src/App.css`, `src/components/PizzaStage.tsx`,
  `src/screens/GameScreen.tsx`のみ）。

---

## 8. あえて実装しなかったこと（判断理由）

Fresh Audit §1.3の候補E（「材料トレイの横スクロール化」/「おすすめ+その他をcompactな1行表示に」）
は、実測の結果**不要だった**:

- PizzaStage縮小（候補A、Fresh Audit推奨のまま）+ `.ingredient-tray`の行数を実件数に応じて
  サイズする変更（§2-B）+ 小さな余白トリム（§2-C）の組み合わせだけで、全ケースが
  `gsScrollHeight <= gsClientHeight`を達成した。
- 横スクロール（またはswipe）を新規導入すると、taskの懸念通り「drag操作・tap操作・horizontal
  swipeの競合」という新しいリスク面を追加することになる。既存の`IngredientTray.tsx`は
  一切変更していないため、この競合リスクは**ゼロ**のまま今回のゴールを達成できた。
- 既存のページング機構（◀▶、7件目以降のみ出現、`IngredientTray.scalability.test.tsx`が
  30/62件規模でも回帰しないことを保証）はそのまま活用 -- 「少ない場合はそのまま表示、多い場合は
  ページ送り」という既存の設計方針を変更する必要がなかった。

---

## 9. Firebase / Functions / Firestore / IAM / CI

変更なし。`functions/`、`firestore.rules`、`.github/workflows/*.yml`は本タスクで一切変更して
いない（差分ファイル一覧は§7参照）。

---

## Human Verification Videos

`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`（PR #155でSSOT化）に従い、PR #154マージ後
（audited SHA `37e6199361c98f65975794d9247903701612d79a` = `origin/main` HEAD、PR #155マージ
コミット）にHuman Verification動画3本を撮影・検証した。生成物は本タスク実装コードを一切変更せず
（production code差分ゼロ）、既存の`e2e/gestures.ts`と同じfixture（`startQuattroFormaggiHeavyInventory`
相当、およびmargherita）を実Chromium（Playwright）で操作して撮影。動画はrepositoryへcommitせず
（`artifacts/review/`はgitignore済み）、セッション内でユーザーへ直接提出した。

| Video | Viewport | Duration | Size | Codec/Resolution | Verification |
|---|---|---:|---:|---|---|
| Ingredient Selection (Main) | 390×844 | 48.0s | 762 KB | H.264 / 390×844 | PASS |
| CUT Regression | 390×844 | 27.0s | 656 KB | H.264 / 390×844 | PASS |
| SAUCE Edge Case | 360×800 | 21.2s | 412 KB | H.264 / 360×800 | PASS |

Download: セッション内直接提出（ユーザーへ3ファイルを直接送付）。

### Automated Measurement（動画撮影と同じ操作シーケンスで実測）

| 対象 | window.innerHeight/Width | document.documentElement.scrollHeight/Width | `.game-screen` clientHeight/scrollHeight |
|---|---|---|---|
| 390×844 SAUCE | 844 / 390 | 844 / 390 | 844 / 844 |
| 390×844 CHEESE | 844 / 390 | 844 / 390 | 844 / 844 |
| 390×844 TOPPING | 844 / 390 | 844 / 390 | 844 / 844 |
| 360×800 SAUCE | 800 / 360 | 800 / 360 | 800 / 800 |

全ケースで`document`スクロールなし、水平overflowなし、`gameScreen.scrollHeight <=
gameScreen.clientHeight`（PREPARE要件）を満たす。CUT（margherita、`.pizza-stage--roomy`）は
`.pizza-dough`実測 358×358.8px（390幅の92vw上限相当）で、PREPARE専用`compact`（min(76vw,290px)）
とは別サイズのまま -- CUTのroomy sizingがPR #154の影響を受けていないことを数値でも確認。

### What to check（この動画で確認できること）

1. SAUCE工程で縦スクロールせずに「このピザにおすすめ」（オリーブオイル）+「その他」（トマト
   ソース/ジェノベーゼソース）を選択でき、選択直後にピザへ実際に塗布操作できる。
2. 工程タブ・ピザ・材料トレイ・固定CTAバー（やり直す/次へ/ヒント）が同時に1画面へ収まっている
   （SAUCE/CHEESE/TOPPINGいずれも）。
3. CHEESE工程で4種（モッツァレラ/ゴルゴンゾーラ/パルミジャーノ/フォンティーナ）を実際に選択・
   配置できる。
4. TOPPING工程で6種（バジル/にんにく/オレガノ/チェリートマト/たまご/マッシュルーム）を実際に
   選択・配置でき、既存の縦グリッド+ページング方式（新規横スクロール方式ではない）のまま維持
   されている。
5. ヒントボタンが実際に動作し、キャプションが変化する。
6. CUT Regressionでは`.pizza-stage--roomy`の従来サイズ（PREPAREの`compact`より大きい）、切断
   ガイド（6等分の破線）、中心線、ドラッグによる実際の切断操作、「切り終わる」までの一連の流れ
   が変更前と同じ見た目・操作感で成立している。
7. SAUCE Edge Case（360×800）では、Result Report本編で実測した最も厳しいケース（CTA上約13px
   余白）でも縦スクロールなしに材料選択+ソース操作2セットが完了する。

Video Verification: PASS

---

## まとめ

- Before: quattro-formaggi相当の複数材料所持状態で、SAUCE工程が390x844で168px、360x800で
  184px、材料選択に縦スクロールを要していた（Fresh Audit実測値と完全一致）。
- After: 同一fixtureで全工程・両viewportとも内部スクロール不要（`gsScrollHeight <=
  gsClientHeight`）、水平overflowゼロ、固定CTAバー常時可視を達成。
- 変更範囲: `src/App.css`（PizzaStage/ingredient-tray/各種余白）、
  `src/screens/GameScreen.tsx`（`roomyStage`からPREPARE除外、`compact`prop配線）、
  `src/components/PizzaStage.tsx`（`compact`prop追加）、`e2e/*`（新規regression test）。
  **`IngredientTray.tsx`のドラッグ/タップ/ページングロジックは1行も変更していない。**
  Firebase/Functions/CI関連の変更なし。
- CUT: サイズ・操作感とも無変更（既存e2e CUT roundで確認）。
