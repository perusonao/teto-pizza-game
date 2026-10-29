# 調理工程・調理法 拡張 Fresh Audit（Phase 1B 以降、docs-only）

作成: 2026-10-29 / 基準 `main` = `3e346569607f68719a33cc222b766f82e9d468cd`（#694）/ ブランチ `claude/teto-cooking-methods-audit-d59u1i`
改訂: 2026-10-29（第 2 回: Owner 判断 O-1・O-2・O-3・O-5 と追加方針 4 点を §0 へ反映、commit `de6144d`／第 3 回: O-4・O-9 を決定済みとして反映）。再確認: `main` は `3e34656` のまま、#695 は open（HEAD `5beb87b`）、Phase 1B 設計書は branch `claude/teto-cooking-prep-1b-p96ftb`（`d5f7754`）のまま未 merge。初版 commit `4b27d9f`。
性質: **調査・設計のみ。** `src/**`・CSS・テスト・データ・Preview・フラグ・セーブは変更していない。PR 作成・merge・Issue 作成/更新・claim 投稿・Monitor 作成は行っていない。
HV 動画は docs-only のため対象外（`CLAUDE.md` / `TETO_HUMAN-VERIFICATION-POLICY.md` §2「docs-only は原則不要」）。
本書の「推奨」は助言であり Owner Decision ではない。**評価（面白さ・テンポ・手応え）はすべて設計上の仮説で、実機計測・実プレイはしていない。** 数値（秒・px）は設計値で、iPhone 実機 HV で確定する。

---

## 0. Owner 決定の反映（2026-10-29、Result Report への回答）

### 0.1 決定

| ID | 決定 | 本書での扱い |
|---|---|---|
| **O-1** | **Stage 1 は「ソーセージ／ポルチーニを焼く」と「えびを茹でる」を採用** | §7.1・§8.1・§8.2 を確定。以降、前者を **Stage 1-A**、後者を **Stage 1-B** と呼ぶ（Cooking Prep の「Phase 1B」＝タイミング式の焼き加減とは別物。混同しないこと） |
| **O-2** | 野菜の専用 SVG を Style Lock v2 へ追補する**方向を承認**。**実装は別タスク** | 玉ねぎ・きのこ・ナスの調理法（§8.3・Stage 2）の前提が「方向承認済み・SVG 未設計・未実装」に変わった。**本書の範囲では SVG 設計・追補を行わない**。玉ねぎの調理法は SVG が main に入るまで着手しない |
| **O-3** | **Prep 回数は 1 ラウンド最大 2 回を暫定上限**。実機 HV で負担が大きければ再検討 | 食材単位・各 1 回・合計 2 回まで。rendang（beef＋onion）・wasabi-beef（beef＋onion）は上限ちょうど。3 種目以降のピルは出さない（§9.1 の実装条件）。**暫定**であり HV の判定項目に含める |
| **O-5** | **Stage 1 では `preparedLook` のスカラー制約を維持**。個体別状態は将来の検討事項 | ナス（面ごと）・貝（個体ごと）は Stage 2 以降へ据え置き。Stage 1 の 2 方式は**結果を 0..1 のスカラー 1 個に畳む**設計（§6.2、§9.1） |
| **O-4** | **Phase 1B の Q5 を踏襲。結果画面に「もう一度焼く／これで使う」を設け、裏返しの成功・失敗も説明する。失敗時も続行可能で、採点には影響させない** | §0.4 に結果画面の設計として展開。えび（茹で）は同じ構成を準用（文言は暫定。下記 §0.4） |
| **O-9** | **調理法ごとに独立した feature flag を採用。牛肉・焼く・茹でるを個別に制御でき、設定は一元管理する** | §0.5 にフラグ設計として展開。旧推奨（単一フラグ＋対象リスト）は**採用しない**。§6.2・§9.1 を整合済み |

### 0.2 追加方針（Stage 1 の設計制約として採用）

| # | 方針 | 設計への落とし込み |
|---|---|---|
| 1 | **各調理はスキップ可能** | 常に任意。ピルを押さない／幕の × で閉じる／「これで使う」でそのまま配置できる。未実施で何も失わず、進行不能の状態を作らない（Phase 1 仕様 AC-13 と 1B Q5 を踏襲） |
| 2 | **採点・在庫・Dex・保存に影響させない** | 結果は transient（`preparedIngredientIds`／`preparedLook`）のみ。Stage 3 の議論（§7.3）は今回の範囲外 |
| 3 | **えびのスワイプは iPhone Safari の画面端ジェスチャーと競合させない** | 設計値（実機 HV で確定）: 引き上げの**開始位置は幕の中央領域**（左右端から 24px 以上、下端から 48px 以上離す）、移動は幕の内側で完結し終点も端に寄せない。左右端の横スワイプ（戻る）・下端の上スワイプ（ホームバー）の領域では**スワイプとして扱わない**。**代替としてボタン操作（「引き上げる」タップ）を必ず併設**し、スワイプに依存しない。`touch-action: none` は幕の内側のみ |
| 4 | **調理時間は短く、操作説明は簡潔に** | 1 回あたり**通常 8 秒以内**（Phase 1 の P-10 目安を踏襲）。ソーセージ焼きは総時間の上限を 1B の 6 秒より長くしない設計値とし、2 段（裏返し→取り出し）でも合計で収める。説明は幕の中の**1 行**（例:「焼き色を見て裏返そう」「いい色で引き上げよう」）。長文・チュートリアルを作らない。数値・ゲージ・残り時間は出さない（1B Q3） |

### 0.3 今回の決定が未決のまま残す事項

§10 の表で状態を明示した。**未決は O-6・O-7・O-8・O-10・O-11 の 5 件**（O-1・O-2・O-3・O-4・O-5・O-9 の 6 件が決定）。残る 5 件は Stage 1 をブロックしない。


### 0.4 結果画面の設計（O-4。Phase 1B の Q5 を踏襲）

| 項目 | 設計 |
|---|---|
| ボタン | 失敗・成功を問わず結果画面に **「もう一度焼く」「これで使う」** の 2 つ（えびは「もう一度茹でる」「これで使う」と準用。文言は暫定で HV で確定）。**ベストのときは 1B の方針どおり自動確定**し、ボタンは出さない。× で閉じる操作は常にあり、スキップ可能（方針 1） |
| 裏返しの説明（焼く） | 結果に**裏返しの成否を 1 行で説明**する。判定は「早い／ちょうど／遅い」の 3 段（設計値）。例（暫定）:「裏返しはバッチリ！」「裏返しが早かったかも」「裏返しが遅くて焦げたよ」。取り出しの判定（焼き足りない／ちょうど／焼きすぎ）は 1B の文言を準用し、**2 行を超えない**（方針 4: 簡潔） |
| 失敗の扱い | 早い・遅い・焼きすぎは「失敗」ではなく**見た目の違い**として扱い、ペナルティ表現（赤字・警告・音）を使わない。**続行は常に可能**（そのまま使う／やり直す／閉じる）。進行不能状態を作らない |
| 採点・保存への影響 | **なし**。結果は transient の `preparedLook`（スカラー 1 個）にのみ反映される。2 段の判定結果は表示用の文言決定にだけ使い、**状態に残すのは最終的な見た目の値 1 個**（O-5） |
| 「もう一度」 | 新しい開始として扱い、前回の結果を引き継がない。回数制限は設けない（1 ラウンド内で `preparedIngredientIds` の件数上限 O-3 は「実施済み食材の数」で数え、やり直しは数えない） |
| 実装上の注意 | 判定文言は食材・調理法のみで決まりレシピ・標的に依存しない（AC-12。Research の非漏洩）。数値・ゲージ・残り時間は表示しない（1B Q3） |

### 0.5 フラグ設計（O-9。調理法ごとの独立フラグ・一元管理）

| 項目 | 設計（提案。実装は #695・Phase 1B の merge 後の M1） |
|---|---|
| 構成 | 調理法ごとに独立: **牛肉（炒める）／焼く（ソーセージ・ポルチーニ）／茹でる（えび）**。本番既定はすべて `false` |
| 一元管理 | 1 つのモジュール（現行 `src/data/prepExperienceGate.ts` を拡張）に、調理法 id → 本番スイッチの表と Preview/DEV opt-in の読み取りをまとめる。**各フラグを別ファイルに散らさない**。呼び出し側は `prepMethodEnabled(methodId)` の 1 関数だけを見る |
| 現行との関係 | main の `PREP_EXPERIENCE_PRODUCTION`（単一）と reducer の `prepExperienceEnabled()`（引数なし、`gameReducer.ts:1161` 付近）は、**牛肉のフラグ**として後方互換に保つ（#695 の挙動・テストを変えない）。reducer のガードは「対象食材が属する調理法のフラグ」を見る形に最小変更（HOT file。1B の最小変更条件の範囲内か、M1 で確認） |
| Preview/DEV opt-in | 現行 `?cookPrep=on` を維持し、調理法を個別に選ぶ形式（例: `?cookPrep=beef,sear`）を M1 で設計。`on` は「全調理法」。本番ビルドは opt-in をコンパイルアウト（`prepPreview.gate.test.ts` の方式） |
| 本番 ON | 各フラグは**個別の Owner 明示承認**。ある調理法を ON にしても他は OFF のまま。ロールバックは該当フラグを `false` に戻すだけ |
| O-3 との関係 | 上限（1 ラウンド最大 2 回）は**有効な調理法の合計**で数える。フラグ OFF の調理法はピルを出さず、件数にも入れない |
| 要確認（M1 設計時に Owner へ） | 全調理法を一括で止めるマスタースイッチを置くか（今回の決定には含まれない。置かない場合は 3 つの個別フラグで運用） |
| テスト | 各フラグ OFF で DOM・状態・保存が現行と同一（Phase 1 AC-1）を**調理法ごとに**固定。フラグ組合せ（全 OFF／1 つ ON／全 ON）の行列テスト。フラグ定義の一元性（他ファイルに本番スイッチの直書きが無い）を architecture test で固定 |

---

## 1. Executive Summary

1. **この拡張で最も効く制約は「食材の絵」である。** 調理法の報酬は「盤面に残る見た目の変化」だけ（採点・識別・保存・在庫には入れない前提。Phase 1 仕様 §2）。見た目を変えられるのは専用 SVG（`pieceVisual`）を持つ食材だけで、絵文字は色を変えられない。現状 **92 食材（ソース 13・チーズ 13・具材 66）のうち専用 SVG は 25**。しかも Style Lock v2 に**野菜（玉ねぎ・きのこ・ナス・じゃがいも・ズッキーニ・パプリカ）の設計が存在しない**。→ 野菜系の調理法は「SVG 設計（Owner 承認）」が先行条件になる。
2. **原典（172 レシピ matrix）が要求する調理法はごく少ない。** `prep` 証跡があるのは 3 行のみ（焼肉・ロモサルタード＝炒め、キムチ＝水切り/炒め）。「揚げる」は `pizza-fritta`（生地を揚げる）1 行で **`NOT_REPRESENTABLE`（FRY_COOK が構造的に未対応）**。茹でる・漬け込む・混ぜる・すりおろす・切るを要求する原典記述は 0。**したがって拡張は「必要だから」ではなく「ゲームとして楽しいから」入れる体験であり、識別・採点に入れない現方針（Owner D-5）と整合する。**
3. **存在しない食材は実装済みとして扱わない。** パスタ・麺・揚げ物（フライ/天ぷら）・ハチミツ・マヨ・バター・キムチ・漬け込み済み食材は `ingredients.ts` / `lateCatalog.ts` に**無い**。「揚げる」は対象食材ゼロ、「茹でる」はパスタ不在で実在食材（えび・じゃがいも・ほうれん草等）に限られる。
4. **16 候補を調査し、最初の 3 件を推奨**（§8）。いずれも Phase 1B で確定する基盤（`CookingPrepLayer` 幕・`preparedIngredientIds` / `preparedLook`・純粋なタイミング判定）を再利用し、**reducer の新アクション無し**で入る。
   - ① **ソーセージ／ポルチーニ ×「焼く（裏返し）」** — 2 段のタイミング（片面→裏返す→取り出す）。専用 SVG あり。到達 10 レシピ。
   - ② **えび ×「茹でる（引き上げ）」** — 上へスワイプして湯から引き上げる。専用 SVG（`shrimp-curl`）あり。灰青→桃橙の色変化が 20px でも読める。
   - ③ **玉ねぎ ×「炒める（飴色）」** — 長押しで加熱し、離して止める。到達 17 レシピと最大だが **SVG 未設計のため条件付き**（Owner 判断 O-2）。
5. **ロードマップ:** Stage 1 = ①②（既存 SVG・Phase 1B の基盤を再利用、保存・採点無影響）／Stage 2 = ③ほか新操作（回転・個別取り出し・円なぞり）とレシピ固有体験／Stage 3 = 調理結果の評価反映（**セーブ・採点・Anti-Oracle 互換性に重大リスク。§7.3 に明記**）。
6. **依存:** Stage 1 は **PR #695 の merge → Phase 1B の merge** が前提（Owner D1: #695 を Squash merge 後に最新 main から独立 PR）。それまで runtime 実装・独立 PR は成立しない。
7. **Owner 判断（2026-10-29）:** O-1（Stage 1 = ソーセージ／ポルチーニ焼き＋えび茹で）・O-2（野菜 SVG 追補の方向承認、実装は別タスク）・O-3（Prep は 1 ラウンド最大 2 回、暫定）・O-5（スカラー制約維持）を反映。さらに O-4（結果画面は「もう一度焼く／これで使う」、裏返しの成否を説明、失敗でも続行・採点無影響）・O-9（調理法ごとの独立フラグ・一元管理）を決定済みとして反映。**未決は 5 件**（O-6・O-7・O-8・O-10・O-11。いずれも Stage 1 をブロックしない。§10）。実装開始条件は §9.1。

---

## 2. Audited main SHA と重複確認

| 項目 | 結果（2026-10-29 に GitHub / git で取得） |
|---|---|
| **Audited main SHA** | `3e346569607f68719a33cc222b766f82e9d468cd`（`feat(cooking-prep): Phase 1 PR-A — canPrepIngredient・フラグ・Preview opt-in・PREP_INGREDIENT reducer`、#694） |
| main の Prep 基盤 | **PR-A のみ**（`src/data/prepIngredients.ts`・`prepExperienceGate.ts`・reducer の `PREP_INGREDIENT`・`GameState.preparedIngredientIds?`）。`CookingPrepLayer` / `beefDoneness` / `prepOffer` / `CookingPrep.css` は **main に存在しない**（#695 で追加） |
| PR #695（Phase 1 PR-B） | **open・未 merge**。branch `feature/cooking-prep-prb-phase1`、HEAD `5beb87b`、変更 43 ファイル。本番フラグ OFF。実機 HV は Owner 判定待ち。#611 に claim あり（`expires 2026-11-05`、`src/components/PizzaStage.tsx`・`src/screens/GameScreen.tsx`・`src/App.tsx`・`src/logic/prep/**` 等） |
| Phase 1B | 設計書 `docs/reports/TETO_COOKING-PREP_PHASE1B_Fresh-Audit.md` は **main に無い**。branch `claude/teto-cooking-prep-1b-p96ftb`（HEAD `d5f7754`）にのみ存在し、本書はそれを読み取り専用で参照した。Owner 決定 D1・Q1〜Q5 反映済み。**1B の claim は未投稿・実装未着手** |
| 重複する open PR | 調理法そのものを扱う open PR は #695 のみ。HOT file 共有: `PizzaStage.tsx`（#468 draft）、`GameScreen.tsx`（#478 draft）、`App.css`（#581 ほか）。#620（POST_BAKE/MULTI_SAUCE/ZONED の旧 audit、docs）は同テーマの旧稿 |
| 重複する Issue | #611（TQ-2/FIN-E4b、Prep の親）、#476（食材別 PLACE/SCATTER/SLICE/DRIZZLE。Owner D3: SCATTER 新方式は保留）、#579（DRIZZLE 候補、FINISH の液体対応）。**本書と同じ「調理法の候補比較」を行った Issue/PR は無い** |
| 既存の関連設計 | `TETO_COOKING-PROCESS-EXPANSION_Fresh-Audit.md` / `…_Phase1-PreImplementation-Verification.md` / `TETO_COOKING-PREP_Technical-Investigation_Result.md` / `TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` / `TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md` |
| カタログ規模（`catalogLedger.test.ts:26-30`） | 80 レシピ（Pinsa ON）／92 食材／70 ladder step |

**本書が扱う範囲:** Phase 1B より後の調理法拡張。#695（3 タップ炒め）と 1B（タイミング式の焼き加減）の実装・設計は**重複させない**（§4 の表では牛肉を比較基準としてのみ置く）。

---

## 3. 既存実装の確認結果

### 3.1 工程ごとの状態（main `3e34656`）

| 工程 | 状態 | 備考（根拠は §12） |
|---|---|---|
| 生地成形（DOUGH） | **実装済み・本番** | 放射状ストレッチ（伸縮両方向）。四角パンは Square Dough 系 Epic #532 で段階実装（一部 Preview 限定） |
| ソースを塗る（SAUCE） | **実装済み・本番** | 長押し＋ドラッグ（`SauceDispenseController`）。1 ピザ 1 層前提。複数ソースは #521/#540 が HOLD |
| チーズを載せる（CHEESE） | **実装済み・本番** | タップ配置＋モッツァレラの `CheesePoolCanvas`（溶け表現） |
| トッピング配置（TOPPING） | **実装済み・本番** | タップ 1 個ずつ。一部食材はトレイからの物理ドラッグ。最小間隔 9%（`MIN_TOPPING_DISTANCE`）は Owner 決定で不変 |
| 焼成（BAKE） | **実装済み・本番** | 針 1 タップ。`BAKE_DURATION_S = 3`。5 段階判定。介入操作なし |
| カット（CUT） | **実装済み・本番（許可リスト方式）** | 円形生地前提。`CUT_ELIGIBLE_RECIPE_IDS` |
| 焼成後の仕上げ（FINISH／後乗せ） | **実装済み・本番ON**（`LATE_CATALOG_PRODUCTION`・`FREE_COOK_FINISH_PRODUCTION`） | topping カテゴリのみ配置可。Lunch Rush・Dinner は fail-closed 除外。液体（DRIZZLE）は #579 で保留 |
| **Cooking Prep（炒める）** | **PR-A のみ main（内部ロジック・本番 OFF）。UI は #695（open）、タイミング化は 1B（設計承認済み・未実装）** | `PREP_EXPERIENCE_PRODUCTION = false`。Preview/DEV opt-in のみ ON |
| FOLD / SEAL / EDGE_FILL | **予約のみ（ゲームプレイ無し）** | `MakingStep` の値としてのみ存在 |
| 水切り・混ぜる・すりおろす・切る・茹でる・漬け込む・揚げる | **未実装（設計は本書が初出）** | 旧 audit は混ぜる／仕上げがけ／散らす／並べるを扱ったが「茹でる・揚げる・漬け込む・すりおろす・水切り・切る」は未検討 |

### 3.2 レシピごとの工程差

工程列は `deriveCoreSteps`（`cookingProfiles.ts`）が `requiredIngredients` のカテゴリから導出する（既定 `DOUGH→SAUCE→CHEESE→TOPPING`、後乗せ要件があれば `FINISH`、CUT は許可リスト）。**工程の「中でやる動作」はレシピに関係なくほぼ同一**（塗る・タップで置く・針を押す・線を引く）。体験差は「どの工程が出るか／何を置くか」だけ。→ 調理法拡張の余地は、工程の**中**の操作の種類にある（旧 audit §2.2 と一致）。

### 3.3 解禁・進行・スキップ条件

- 工程の解禁は食材の所持（ladder step・星ゲート `starGates`）から間接的に決まる。工程そのものに解禁条件は無い。
- **Prep の出現条件**（`PREP_INGREDIENT` reducer・`gameReducer.ts:1161`）: フラグ ON ∧ `PREPARE` ∧ `TOPPING` ∧ GUIDED／FREE_COOK ∧ `canPrepIngredient(id)` ∧ 所持 ∧ 未実施。違反は**同一参照の state を返して拒否**。Lunch Rush・Dinner は拒否。
- Prep は任意（押さなくても配置・採点・結果は同一）。やり直しは `RESET_PIZZA` で除去（`gameReducer.ts:1216`）。

### 3.4 セーブ・採点・在庫・Dex との依存

| 領域 | 現状と Prep との関係 |
|---|---|
| セーブ | `GameState` は直列化されない。保存中ラウンド `pendingRound` は piece の `id/ingredientId/x/y/stage` のみ許可リストで保存・検証し、**未知キーは `corrupt` で拒否**（`pendingRound.ts:116,206-208`）。Prep 状態は保存されず、復元後は「生」の見た目に戻る（Phase 1 AC-19） |
| 採点 | Scoring 2.0（`scoringV2/index.ts:59-62`）: ソース 52／ピース 16／レシピ 12／焼成 20（STANDARD）。`pizza` / `recipe` / `bakeValue` だけを読む。Prep は読まれない（AC-3/6）。`lunch-rush-v1` 互換と FINISH ボーナス無し（OD-CS-11）は不変 |
| 在庫 | 消費は `CONFIRM_BAKE`／`finalizeRound` で 1 回。Prep は何も消費しない |
| Dex・識別・Hint | `signature.ts:95` の `prep` 軸は `FIXED_BY_FLOW`（`PREP_STEP` 無し）。**識別に入れていない**。入れると Hint 5.0・DH4・Research・Dex・near-miss・技法台帳に波及（旧 audit §2.4） |

---

## 4. 食材 × 調理法 × 操作方式の比較表

### 4.1 調査範囲

- **食材:** 33（beef, onion, mushroom, porcini, sausage, wurstel, hot-dog, bacon, shrimp, clam, mussel, eggplant, potato, sweet-potato, spinach, friarielli, salt-cod, fresh-tomato, parmigiano, grana-padano, wasabi, white-sesame, green-onion, basil, parsley, cilantro, chicken, miso-sauce, tahini, yuzu-kosho, curry-ketchup, olive-oil, mozzarella）。
- **調理法:** 12（依頼の 10 種＋追加提案 2 種: 蒸し開け・炒る）。
- **候補:** 16 行（うち「揚げる」は対象食材ゼロのため提案対象外。牛肉の炒めは #695/1B の比較基準で候補に数えない）。

### 4.2 食材データの前提（コードで確認）

| 区分 | 食材 | 専用 SVG | 使用レシピ数（RECIPES＋late、簡易抽出） |
|---|---|---|---|
| あり（main） | sausage / porcini / wurstel / hot-dog / shrimp / clam / mussel / fresh-tomato / green-onion / white-sesame / wasabi / beef / cilantro ほか計 25 | `DedicatedIngredientVisual` 25 種（`ingredients.ts:23`） | sausage 8 / porcini 2 / wurstel 1 / hot-dog 1 / shrimp 3 / clam 3 / mussel 1 / fresh-tomato 8 / beef 2 |
| Style Lock v2 に**設計あり・未実装** | bacon / chicken / pork / ham / pepperoni / salmon / tuna ほか（肉・魚・チーズ） | なし（実装待ち） | bacon 8 / chicken 4 |
| Style Lock v2 に**設計なし** | **onion / mushroom / eggplant / potato / sweet-potato / zucchini / bell-pepper / spinach ほか野菜全般** | なし | onion 17 / mushroom 4 / eggplant 9 / potato 1 |

> Lunch Rush 対象レシピは Prep から除外される（既存方針）ため、onion 4・mushroom 2・sausage 2・bacon 3・eggplant 2・fresh-tomato 1・parmigiano 3 レシピ（簡易抽出・要再計測）は従来どおり。

### 4.3 比較表（10 項目）

優先度: **P1** = Stage 1 で着手可、**P2** = Stage 2、**P3** = 保留／ブロック／意味が薄い。難度は Phase 1B 基盤が既にある前提。

| # | 食材 | 調理法 | 操作案 A / B | 推奨 | ゲーム性（判断・手応え・上達） | 視覚演出（前→後） | 既存依存 | 実装難度 | リスク | 優先度 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | sausage（8）, wurstel（1）, hot-dog（1）; 後続 bacon | **焼く（裏返し）** | A: 2 段タイミング（片面の焼き色を見て「裏返す」→もう片面→「取り出す」）／B: 転がしスワイプ（左右に転がして均一に焼く。棒状の wurstel 向き） | **A**（B は wurstel 限定で Stage 2） | 判断=裏返す時機＋取り出す時機の 2 回／手応え=ジュッ演出＋色の進み／上達=「焼き色の進み方」を覚える | 薄い桃→焼き目の茶→焦げ。裏返しで色が入れ替わる | 1B のタイミング核＋`CookingPrepLayer`＋色上書き CSS（sausage-slices） | **Medium** | 2 段判定の結果を 1B の単一スカラー `preparedLook` に畳む設計（§6.2）。SVG の色上書き（#695 方式） | **P1** |
| 2 | porcini（2）; mushroom（4・SVG 無し） | **ソテー（触らず焼く→1 回だけ裏返す）** | A: 放置して焼き面を見極め 1 回だけ裏返す（「触らない勇気」）／B: フライパンを揺する連続タップのリズム | **A**（#1 と同エンジン） | 判断=いつ手を出すか。連打が逆効果で「連打ゲーム」を避けられる／上達=待つ判断 | 白→金色→茶。水分が飛ぶ表現は色のみ | #1 と共通。porcini-slice SVG あり。mushroom は SVG 設計が先 | Medium（porcini）／High（mushroom, SVG 待ち） | porcini は後半食材で到達が狭い（2 レシピ） | **P1**（porcini）／P2（mushroom） |
| 3 | shrimp（3） | **茹でる（引き上げ）** | A: 上へスワイプで湯から引き上げる（取り出し＝確定）／B: 「取り出す！」タップ（1B と同型） | **A** | 判断=色の変化（灰青→桃橙）と身のカール具合を見て引き上げる／手応え=スワイプの物理感／上達=茹ですぎ（硬く縮む）を避ける | 灰青で半透明→桃橙で丸まる→白っぽく縮む。`shrimp-curl` の色上書き | 1B の判定核を流用。**コミット入力だけ別**（スワイプ）。pot の絵は幕内 | **Low〜Medium** | 画面下端のスワイプ（ホームバー）と競合しない開始位置にする（§7.9） | **P1** |
| 4 | onion（**17**）, green-onion | **炒める（飴色）** | A: 長押しで加熱、離して止める（飴色で離す）／B: 火加減スライダ（弱↔強）＋取り出し | **A**（B は Stage 3 の難度上げ） | 判断=離す時機。強火の選択肢が無い代わりに「待つ」操作／手応え=押している間だけ変化／上達=飴色の濃さ | 白→半透明→飴色→焦げ茶 | 1B の判定核（長押しの経過時間を `elapsedMs` として流用）。**玉ねぎの SVG が無い** | Medium＋**SVG 前提（High）** | **到達最大＝出現頻度最大**。rendang・wasabi-beef は beef と二重に出る（§10 O-3）。野菜の SVG は Style Lock に設計無し | **P1\*（SVG 承認が前提）→ 実質 Stage 2** |
| 5 | eggplant（9）; 後続 zucchini・bell-pepper | **焼く（直火で皮を焦がす）** | A: タップで 90° ずつ回して 4 面を均一に焦がす／B: 長押しで一面ずつ焦がす | **A** | 判断=どの面が足りないかを見て回す（**空間的な判断が生まれる**）／上達=ムラ無く焼く | 紫の光沢→黒い焦げ目＋湯気。ババガヌーシュの核 | 1B の判定核＋面ごとの状態（スカラーに収まらない） | **High** | 面ごとの状態は `preparedLook` の単一スカラー制約（Q4）を超える → Owner 判断 O-5。SVG なし | **P2** |
| 6 | clam（3）, mussel（1） | **蒸し開け（開いた殻だけ取り出す）** | A: 開いた貝を 1 個ずつタップして取り出す（個体差で開く時刻がずれる）／B: 一括「取り出す！」 | **A** | 判断=複数対象のどれが開いたかを見る（**多対象の見極め**）／上達=開き始めの兆しを読む | 閉じた殻→開いた殻（離散）。連続色ではなく状態の切替で伝わる | 1B の判定核を対象ごとに複数並列。**SVG に「開」の状態が必要** | Medium〜High | 個体ごとの結果をどう 1 つの `preparedLook` にまとめるか（O-5）。未取り出しの扱い（進行不能を作らない） | **P2** |
| 7 | wasabi（1・late） | **すりおろす** | A: 円を描いてこする（「の」の字）／B: 長押し＋ゆっくりスワイプ | **A** | 判断が薄い（一定の動作）。手応えは高いが 1 レシピのみ | 緑の塊→ふんわりした山 | **FINISH 段階**（現ガードは TOPPING のみ → reducer 拡張）。wasabi-dab SVG あり | Medium | ガード拡張（O-7）。到達が 1 レシピのみ | **P3** |
| 8 | parmigiano（4）, grana-padano（1） | **すりおろす** | A: 往復スワイプ（ガシガシ）／B: 長押しでハンドル回転 | A | 出力が「散らす」に近い（#476 D3: SCATTER 新方式は保留に抵触） | 粉雪状の山 | チーズ SVG は未実装。SCATTER 保留中 | Medium | **Owner 決定 D3 に抵触**（再開は #478 の A が実機 HV を通った後） | **P3（ブロック）** |
| 9 | basil / parsley / cilantro / green-onion | **切る（刻む／ちぎる）** | A: 縦スワイプで刻む（刻み幅が見た目に出る）／B: 「ちぎる／刻む」の 2 択 | B（選択のみ） | 見た目の差が採点・結果に無関係。**意味が薄い** | 葉の大きさ違い | `toppingSizeClass`（xs/xl）と衝突しうる | Low | ピース大きさの見た目はサイズ区分（`toppingSizeClass.ts`）の領分 | **P3** |
| 10 | fresh-tomato（8） | **水切り** | A: 長押しで押さえて水分を出す／B: ペーパーで押さえるタップ | A | **ゲーム側に「水っぽさ」の仕組みが無く**、押す理由が無い | スライスから水滴 | tomato-slice SVG あり | Low | 意味の薄い操作の典型。Stage 3 で焼成窓と連動させるなら再検討 | **P3（見送り）** |
| 11 | potato（1）, sweet-potato（1） | **茹でる（串で確認）** | A: 串を刺して硬さを確認（回数制限の探り）／B: 引き上げスワイプ（#3 と同型） | A | 判断=確認回数 vs 取り出し時機。**探りに回数制限が要り設計が重い** | 生の黄→ほくほく | 絵文字のみ（SVG 無し） | High | 到達 2 レシピ、SVG 無し | **P3** |
| 12 | chicken（4） | **漬け込む（もみ込み）** | A: ジグザグスワイプでたれを揉み込む／B: たれの選択 | A | ソースが在庫・採点の中核のため、**ソース素材の二重利用（在庫消費の二重化）リスク** | 淡い桃→たれ色 | bbq-sauce は塗るソースと同一素材。SVG 無し | High | 在庫・ソース量との整合（§7.7） | **P3** |
| 13 | miso-sauce / tahini / yuzu-kosho / curry-ketchup | **混ぜる（ソースを溶く）** | A: 円を描いて溶く／B: 配合比スライダ | A | **ソースは採点の 52%**。見た目だけの混ぜは「ソース作り」の期待を外す | ソースの色・つやの変化 | SAUCE 工程の前段。ソース色は `color` 駆動で採点と SSOT 共有 | High | Stage 3 ゲート＋Owner 判断。複数ソース（#521/#540）は HOLD | **P3** |
| 14 | white-sesame（1・late） | **炒る** | A: 鍋を揺するタップのリズム／B: タイミング | B | 1 レシピのみ。連打に偏りやすい | 白→薄茶、跳ねる粒 | sesame-seeds SVG あり | Low | 到達が狭い | **P3** |
| 15 | olive-oil, herbs（後乗せ） | **仕上げ（オイルがけ・ハーブ）** | A: 既存 FINISH のタップ配置／B: DRIZZLE（線状） | A（既存） | FINISH は本番 ON 済み。B は #579 で**保留**（線状ピースは Reference モデルと衝突） | — | #579 / #476 D3 | — | **新規候補ではない（既存工程）** | **対象外** |
| 16 | （対象食材なし） | **揚げる** | — | — | **食材が存在しない。**`pizza-fritta` は構造的 `NOT_REPRESENTABLE`（FRY_COOK 未対応） | — | 新食材（揚げ物）＋SVG＋レシピ＋ladder step＋Hint/DH4 再 audit が必要 | — | 食材追加の依存関係のみ記録（§7.8） | **提案対象外** |

### 4.4 食材追加を伴う提案（実装済みとして扱わない）

| 調理法 | 追加が必要な要素 | 依存関係 |
|---|---|---|
| 揚げる | 揚げ物食材（例: フライ類）の食材マスタ＋専用 SVG＋それを使うレシピ＋ladder step | `catalogLedger.test.ts` の台帳更新、Hint 5.0 ladder golden（append-only）、DH4 sweep（timeout 余裕）、Style Lock 追補、Owner の食材採否。`pizza-fritta`（生地を揚げる）は別系統（FRY_COOK） |
| 茹でる（パスタ） | 麺食材＋SVG＋レシピ | 同上。パスタを使うレシピは 172 matrix に原典記述なし |
| 漬け込む・混ぜる（調味料） | ハチミツ・マヨ・バター・ドレッシング等の液体食材 | FINISH の液体対応（#579）と複数ソース（#521/#540）が先行 |

---

## 5. ゲーム性の評価

### 5.1 評価基準（8 観点）と採点

◎ 強い／○ 成立／△ 弱い／× 成立しない。**設計仮説であり実プレイ評価ではない。** 操作量の多さは評価に入れていない。

| 観点 | 1 ソーセージ焼き | 2 ポルチーニ | 3 えび茹で | 4 玉ねぎ飴色 | 5 ナス焼き | 6 貝蒸し開け | 7 わさび | 10 トマト水切り |
|---|---|---|---|---|---|---|---|---|
| ① 判断がある | ○（2 回） | ◎（待つ判断） | ○ | ○ | ◎（面を選ぶ） | ◎（多対象） | △ | × |
| ② 手応え | ○ | ○ | ◎（物理感） | ○ | ○ | ○ | ◎ | △ |
| ③ 上達の余地 | ○ | ○ | ○ | ○ | ◎ | ◎ | △ | × |
| ④ 食材の特徴 | ○ | ◎ | ◎（カール・色） | ◎（飴色） | ◎ | ◎ | ○ | △ |
| ⑤ 見た目で結果が分かる | ○ | ○ | ◎ | ○ | ○ | ◎（状態切替） | ○ | △ |
| ⑥ 繰り返しの負担 | ○（8 レシピ） | ◎（2 レシピ） | ◎（3） | △（17 で頻出） | ○ | ○ | ◎ | △ |
| ⑦ iPhone 1 画面 | ○ | ○ | ○ | ○ | ○ | △（複数対象） | ○ | ○ |
| ⑧ テンポ | ○ | ○ | ○ | △ | △ | △ | ○ | △ |

読み取り:
- **「連打だけ」を避ける設計の核は、待つ・見極める・選ぶ操作。** ポルチーニ（触らず待つ）・えび（見て引き上げる）・貝（開いたものを選ぶ）・ナス（面を選んで回す）が該当。**炒め＝連打にならないこと**が 1B で既に確認された方針。
- **玉ねぎは食材の特徴が最も出る（飴色）が、出現頻度が最大で、テンポ面の負担が最も大きい。** 任意かつ 1 ラウンド 1 回までのルールを守っても、beef を含むレシピで 2 回出る問題がある（§10 O-3）。
- **水切り・刻む・混ぜる（ソース）は判断が成立しない**か、採点・Reference と衝突する。意味の薄い操作は候補数を増やすためだけに推さない。

### 5.2 操作方式の相性（iPhone Safari・片手）

| 操作 | 向く対象 | 注意（iOS Safari） |
|---|---|---|
| タイミングタップ（1B 型） | 短い調理（炒め・焼き・取り出し） | 既に 1B で設計済み。ARM 300ms・結果表示中の入力ロックを踏襲 |
| 長押し＆離す | 「じっくり加熱」（玉ねぎ） | 長押しのコールアウト・テキスト選択を抑止（`touch-action`、`user-select`）。ステージ上の長押しは既存のソース塗りで実績あり |
| 上へスワイプ（引き上げ） | 茹でる | **画面下端からの上スワイプは Safari／ホームバーと競合**。開始は幕の中央付近に限定 |
| タップで回転 | ナス・ソーセージ | 単純で誤爆が少ない。左右端の横スワイプは Safari の戻るジェスチャと競合 |
| 個別タップ（複数対象） | 貝 | タップ領域 44px 以上＋対象間隔の確保が必要（20px 級の絵なので当たり判定を拡張） |
| 円を描く | わさび・混ぜる | 検出が曖昧になりやすく、片手の親指では小さな円が難しい。代替タップを必須に |

---

## 6. 技術的な依存関係

### 6.1 結論（短く）

**最初の数件は reducer に新アクション・新フィールドを足さずに実装できる。** 変更は (a) 調理法の登録表（データ）、(b) 純粋なタイミング判定の設定違い、(c) 幕（`CookingPrepLayer`）の表示バリエーション、(d) 食材 SVG の色上書き（#695 の方式: SVG・`IngredientGlyph.tsx` は無変更のまま、`CookingPrep.css` が `BeefSlices` の `path` を CSS で上書き）、の 4 つ。HOT file の `gameReducer.ts` に触るのは、1B が既に承認した `PREP_INGREDIENT` の任意 `progress` のみ。

### 6.2 監査項目ごとの結果

| 項目 | 結果 |
|---|---|
| **reducer（HOT）への影響** | `gameReducer.ts` は 2,551 行の HOT file。Prep の入口は `PREP_INGREDIENT`（:1161）、状態は `GameState.preparedIngredientIds?`（:340）、除去は `RESET_PIZZA`（:1216）。**新しい調理法ごとに新アクションを足さず、同一アクションに `progress` を載せる**（1B の Q4 承認範囲）。調理法の違いは `canPrepIngredient` を通る登録表で表現し、reducer は無変更にできる |
| **工程の追加方法** | **タブにしない**（`MAX_VISIBLE_COOKING_TABS = 6`、`cookingProfiles.ts:240`。PREPARE の縦余白は 390×844 で実測 0px）。TOPPING 内の「操作の種類」として、#695 の幕（`.pizza-stage` 内 `inset:0`）に重ねる。**ステージ高・dock・bar の寸法は不変**（#695 で実測済み） |
| **transient state で完結できる範囲** | 見た目のみ・採点無し・識別無しの調理は `preparedIngredientIds` ＋ `preparedLook`（食材 id→スカラー 0..1）で完結。保存・journal・`pendingRound` に出ない（Phase 1 AC-5/7/19 と同じ行列で固定）。**スカラー 1 個に畳める調理法**（1 焼き・2 ソテー・3 茹で・4 飴色）は完結。**面ごと・個体ごとの状態が要る調理法**（5 ナス・6 貝）は Q4 の「最小限」条件を超える → Owner 判断 O-5 |
| **保存スキーマ変更の必要性** | Stage 1・2: **不要**（保存対象外）。Stage 3: 結果を採点・識別に使うなら **必要になる可能性が高い**（§7.3） |
| **レシピデータの互換性** | レシピ定義・要件・Reference・bake 窓は**変更しない**。調理法は食材単位で出る（レシピ・標的に依存しない＝Anti-Oracle 維持）。Stage 3 でレシピ固有の条件を足す場合のみ `Recipe` / `ReferencePizza` に触れる |
| **inventory・Dex・採点への影響** | Stage 1・2: **無し**（在庫消費は `CONFIRM_BAKE` で 1 回、Prep は消費しない）。Stage 3: 重み変更は `SCORING_V2_WEIGHT_PROFILES`（STANDARD / NO_SAUCE）のプロファイル追加＋ruleset 版の扱いが要る（`scoringV2/index.ts:62-82`） |
| **既存 Feature Gate の再利用** | **O-9 決定: 調理法ごとの独立フラグ（牛肉・焼く・茹でる）を一元管理**（§0.5）。既存の `prepExperienceGate.ts`／Preview opt-in（`prepPreview.ts`）の仕組みを拡張して再利用し、単一フラグ案は採用しない。現行 `PREP_EXPERIENCE_PRODUCTION` は牛肉のフラグとして後方互換に保つ |
| **Preview/DEV 限定での検証可否** | 可。#695 の HV 入口（`CookPrepHvStarter`）と同じ方式で、調理法ごとの HV 入口を Preview/DEV のみに置ける。本番ビルドは opt-in をコンパイルアウト（`prepPreview.gate.test.ts`） |
| **iPhone Safari の描画性能** | 幕は DOM＋CSS（canvas 不要）。更新は 5 個前後の CSS 変数のみで安価。**避けること:** 毎フレームの CSS `filter` アニメーション（`bakeVisual` の焼成フィルターと干渉し、重い）。進行表示は rAF、判定は押下イベントの `timeStamp`（1B 方針）。**実機の描画コストは未計測**（実装 PR で測る） |
| **WebKit E2E の追加範囲** | 調理法ごとに 1 spec（`e2e/cooking-prep-*.spec.ts`）×（390×844・360×800）×（Chromium・WebKit）。時間は `page.clock` の仮想時間（1B 方針）で進め `sleep` に頼らない。WebKit は CI の 6 シャード（2 viewport×3）で確認（ローカル WebKit は不可の可能性が高い）。flaky 化の履歴が多い領域（#394, #680）なので時間依存を避ける |
| **既存の調理画面とのレイアウト競合** | 幕内で完結すれば競合なし。競合するのは (a) ピルの位置（生地下の空き帯 80px / 66px。#695 で 360×800 のピル↔生地 4.2px が既知リスク）、(b) 複数対象（貝）の当たり判定、(c) ステージ領域外へ出る操作（引き上げスワイプの終点）。**dock は幕表示中 `inert`**（iOS 15.5+） |

### 6.3 推奨する内部構造（提案のみ、コード変更なし）

1. **調理法レジストリ**（新規・非 HOT）: `ingredientId → { method, bands, look }`。現行 `PREP_TARGET_INGREDIENT_IDS`（`prepIngredients.ts`）の配列を置き換える。`canPrepIngredient(id): boolean` のシグネチャは維持し、PR-A のテスト・reducer 呼び出しを壊さない。
2. **純粋なタイミング核の一般化**: 1B の `panDoneness.ts`（`PAN_TOTAL_MS` / `BEST_START_MS` / `BEST_END_MS` / `PAN_ARM_MS`、`gradeAt(elapsedMs)`）を、調理法ごとの設定（総時間・ベスト帯・段数）を受け取る形にする。**定数は 1 か所に集約**（HV で調整）。
3. **見た目の写像**（調理法ごと）: `progress → 色`（`beefDoneness.ts` と同型の純関数）。#695 は SVG とその描画コンポーネントを変えず、`CookingPrep.css` が対象 SVG の `path` の fill／stroke を上書きする。未炒めは上書きが無く現行の見た目（`doneness = 0`）のまま。**上書きは SVG 内部の要素順に依存するため、対象 SVG の構造変更時にテストで検出できるようにする**（M2 で固定）。
4. **幕のバリエーション**: `CookingPrepLayer` に調理法別の中身（鍋・湯・まな板）を差し替える。ピル・×・入力ロック・blur 破棄・`key` による再マウント破棄は共通。

---

## 7. 段階的な拡張計画

### 7.1 Stage 1 — 小規模拡張（既存食材・既存基盤）

目的: 1〜2 種類の新しい調理体験。**保存・採点に影響しない。**

| 項目 | 内容 |
|---|---|
| 内容 | ① sausage／porcini の「焼く（裏返し）」② shrimp の「茹でる（引き上げ）」 |
| 前提 | **#695 merge → Phase 1B merge**。1B の `preparedLook`・タイミング核・幕が main にあること |
| 再利用 | `CookingPrepLayer`、`PREP_INGREDIENT`（+`progress`）、`prepExperienceGate`、`beefDoneness` 型の写像、ピル配置、入力ロック、Preview HV 入口 |
| 新規 | 調理法レジストリ、タイミング核の設定化、sausage-slices／porcini-slice／shrimp-curl の色上書き（CSS）、幕の中身 2 種、E2E 2 spec |
| 影響しないもの | 保存・採点・識別・在庫・Dex・Hint・Lunch Rush・Dinner |
| 到達 | sausage 8＋porcini 2＋shrimp 3 レシピ（Lunch Rush 対象は従来どおり除外） |
| 検証 | Preview/DEV 限定。iPhone 実機 HV で「やりたくなるか／8 秒以内か／結果が見た目で分かるか」 |

### 7.2 Stage 2 — 調理法の多様化

| 項目 | 内容 |
|---|---|
| 新操作方式 | 長押し（玉ねぎ）、タップ回転（ナス）、個別取り出し（貝）、円なぞり（わさび。FINISH 拡張が前提） |
| 食材ごとの表現 | 飴色の段階、焼き目の面、殻の開閉。**Style Lock v2 への野菜追補（Owner 承認）が前提** |
| 複数工程の組み合わせ | 「炒め合わせ」（beef＋onion を同じ幕で 1 回の体験にする案）。**1 ラウンドの Prep 回数の上限ルール（O-3）が先** |
| レシピ固有体験 | レシピごとに推奨の調理法を「見せる」（表示のみ）。Free／Research では**食材単位のみ**（標的が漏れないため）。Guided のみ補助表示が可能 |
| 前提 | Stage 1 の HV で「面白い」判定。面ごと・個体ごとの状態を許す `preparedLook` 拡張の Owner 判断（O-5） |

### 7.3 Stage 3 — ゲーム性の深化（**セーブ・採点互換性リスクあり**）

| 項目 | 内容 |
|---|---|
| 調理結果の評価反映 | 取り出し時機（early／best／overdone）を採点またはボーナスに反映 |
| レシピごとの適切な調理条件 | 例: 「このレシピの牛は強めに焼く」 |
| 難易度・解禁連携 | 調理法を ladder の星ゲート（`starGates`）や Mastery と連動して解禁／難度を段階化 |

**互換性リスク（必ず確認）:**

| # | リスク | 内容 |
|---|---|---|
| R-1 | **保存中ラウンドの精算** | 採点が調理結果に依存すると、`pendingRound` から復元して精算するとき調理結果が必要になる。現在 journal は piece の許可リスト（`pendingRound.ts:116,206`）で、**未知キーは `corrupt` 拒否**。結果を保存するなら journal・sanitizer・R8 行列テストの改修が付き、**新版が書いた保存を旧版が `corrupt` として拒否**しうる（Save Protection #560 の future-version 扱いと整合を取る必要） |
| R-2 | **採点の authority** | 重みは 52/16/12/20（STANDARD）で固定、`lunch-rush-v1` 互換、FINISH にボーナス無し（OD-CS-11）。調理結果を入れるなら**新しい重みプロファイル＋ruleset 版の扱い**（`SCORING_V2_WEIGHT_PROFILES` は frozen、変更は ruleset 版の更新が要る旨のコメントあり） |
| R-3 | **過去の BEST／★／Pitz との比較** | 同じ操作でも版により得点が変わると、Dex の BEST・★・Pitz の比較可能性が崩れる。既存セーブの BEST は再計算されないため、**新旧の得点が混在**する |
| R-4 | **Anti-Oracle（Free／Research）** | 「レシピごとの適切な条件」は、Free／Research では**標的の手がかり**になる。条件は**食材単位（レシピ非依存）**でなければならず、レシピ固有の条件は Guided のみ。Research の非漏洩テストが無修正で通ること |
| R-5 | **識別（`prep` 軸）** | 調理結果を識別に入れるなら `prep` 軸の OBSERVED 化＝指紋 canary・技法台帳（P9）・Hint 5.0・DH4 sweep・Research・Dex・near-miss に波及。DH4 sweep は 120 秒 timeout の約 98% と記録（旧 audit） |
| R-6 | **Lunch Rush（ランキング）** | `lunch-rush-v1` の公平性。調理を採点に入れるなら Lunch Rush は除外のままにする（二重基準になる） |
| R-7 | **在庫・Dex の一回性** | 採点・消費・発見解決は `finalizeRound` で 1 回。調理結果を使う場合は同じ経路に畳み、二重判定を作らない |

Stage 3 は上記 R-1〜R-7 のうち**1 つでも未解決なら着手しない**。まず「見た目のみ」の Stage 1・2 の HV で価値が確認されてから、別の Owner Gate で議論する。

---

## 8. 推奨する最初の 3 候補

前提（共通）: **PR #695 の merge と Phase 1B の merge が完了していること**。以下の「再利用度」は 1B 完了後の main を前提にした設計値。

### 8.1 ① ソーセージ／ポルチーニ ×「焼く（裏返し）」 — **推奨 1**

| 項目 | 内容 |
|---|---|
| なぜ面白くなるか | 判断が **2 回**（いつ裏返すか／いつ取り出すか）あり、1B の「取り出す！」1 回より一段深い。片面の焼き色という**見て分かる手がかり**から時機を学べる。ポルチーニは「触らずに待つ」ため連打にならない |
| なぜ適しているか | 肉・きのこを「焼き目をつける」のは最も自然な調理。sausage-slices・porcini-slice は専用 SVG が main にあり、焼き色の変化が見える。到達が **sausage 8＋porcini 2 の計 10 レシピ**で、玉ねぎほど頻出しない |
| 既存の再利用度 | **高**。幕・`PREP_INGREDIENT`（+`progress`）・フラグ・ピル・入力ロック・タイミング核をそのまま使う。新規は「2 段判定→単一スカラー」の写像と色上書き CSS |
| 必要なファイル | 新規: `src/data/prepMethods.ts`（レジストリ）、`src/logic/prep/searDoneness.ts`(+test)。変更: `src/data/prepIngredients.ts`（配列→レジストリ参照）、`src/components/CookingPrep.css`（sausage-slices／porcini-slice の色上書きを追加。**`IngredientGlyph.tsx` は #695 方式なら無変更**）、`src/components/CookingPrepLayer.tsx`、`e2e/cooking-prep-sear.spec.ts`。**reducer 変更なし** |
| PR 分割 | §9 の M1〜M3 |
| Owner が実機で確認すること | (1) 裏返す時機が焼き色から分かるか (2) 2 回の判断が「楽しい」か「面倒」か (3) 8 秒以内か (4) 焼き色の差が 20px 級で見分けられるか（ペパロニ・ベーコン・ビーフと混同しないか）(5) 失敗（焦がす）が「進行不能」に見えないか |

### 8.2 ② えび ×「茹でる（引き上げ）」 — **推奨 2**

| 項目 | 内容 |
|---|---|
| なぜ面白くなるか | **入力が他と違う**（上へスワイプ＝湯から引き上げる）。1B・①がタップ系なので、操作の語彙が増える。灰青→桃橙→縮んで白っぽい、という色とカールの変化は結果が最も直感的 |
| なぜ適しているか | えびの茹で加減は「色が変わった瞬間」が明確。`shrimp-curl` が main にある。到達 3 レシピ（pesto-gamberi・pescatore・yuzu-shrimp）で出現頻度が低く、テンポ負担が小さい |
| 既存の再利用度 | **高〜中**。判定核・幕・フラグを再利用。新規はスワイプ検出（コミット入力）と湯の絵 |
| 必要なファイル | 新規: `src/logic/prep/boilDoneness.ts`(+test)、スワイプ検出（pure）。変更: レジストリ、`CookingPrep.css`（shrimp-curl の色上書き）、`CookingPrepLayer.tsx`、`e2e/cooking-prep-boil.spec.ts`。**reducer 変更なし** |
| PR 分割 | §9 の M1・M2・M4 |
| Owner が実機で確認すること | (1) 上スワイプが片手の親指で自然か (2) 画面下端／ホームバー付近で Safari の挙動と競合しないか (3) 色とカールの変化で引き上げ時機が分かるか (4) 代替（タップ）が必要か |

### 8.3 ③ 玉ねぎ ×「炒める（飴色）」 — **推奨 3（条件付き）**

| 項目 | 内容 |
|---|---|
| なぜ面白くなるか | 長押しで加熱し離して止める。**「待つ」「見極める」**の操作で、beef の取り出しタップ・①②と操作感が異なる。飴色という**ゆっくり進む色変化**は玉ねぎの特徴そのもの |
| なぜ適しているか | 玉ねぎ（17 レシピ）はゲーム内で最も使われる具材のひとつで、炒めた玉ねぎは多くの料理の核。波及効果が最大 |
| 既存の再利用度 | 中。タイミング核は流用（長押しの経過時間を入力）。**ただし玉ねぎは専用 SVG が無く、Style Lock v2 にも設計が無い** |
| 必要なファイル | 新規: 玉ねぎ SVG（Style Lock 追補＋`DedicatedIngredientVisual` への追加）、`src/logic/prep/caramelDoneness.ts`。変更: レジストリ、`CookingPrep.css`（SVG 追加後の色上書き）、幕、E2E |
| PR 分割 | **SVG 設計は別トラック**（Owner 承認→ Ingredient Icon 2.0 の流儀）。M5 は SVG merge 後 |
| 条件 | O-2（方向は**承認済み**、SVG 設計・実装は別タスクで**未着手**＝玉ねぎの調理法は SVG が main に入るまで着手しない）、O-3（**決定済み・暫定**: 1 ラウンド最大 2 回。beef＋onion はちょうど上限） |
| Owner が実機で確認すること | (1) 長押しが「じっくり」の手応えになるか (2) 出現頻度が高くて面倒に感じないか (3) 飴色が絵で判別できるか (4) rendang などで 2 回出ても許容か |

### 8.4 推奨しなかった理由（要点）

- **ナス焼き・貝蒸し開け:** 面白さは高いが、面ごと／個体ごとの状態が 1B の「最小限の `preparedLook`」を超える（O-5）。Stage 2。
- **すりおろし（チーズ）:** #476 D3（SCATTER 新方式は保留）に抵触。
- **水切り・刻む・ソース混ぜ・漬け込み:** 判断が成立しない、または採点／在庫と衝突（§4.3）。

---

## 9. PR 分割案（Stage 1）

前提順序: **#695（Squash merge）→ Phase 1B（独立 PR）→ M1〜**。それぞれ最新 main から切る。各 PR は Duplicate Gate と #611 への claim を先に行う（`TETO_SESSION-OPERATIONS_1.0.md` §1。本書では claim を投稿していない）。

| PR | 内容 | 主な変更 | HOT／競合 | HV |
|---|---|---|---|---|
| **M1** | 調理法レジストリ・タイミング核の一般化・**調理法ごとの独立フラグの一元化**（内部ロジックのみ、挙動不変） | `src/data/prepMethods.ts`、`prepIngredients.ts`、`panDoneness.ts` の設定化、テスト | 無し（非 HOT）。beef の挙動は不変（golden／parity 不変） | 不要（内部 refactor） |
| **M2** | 色上書き（sausage-slices・porcini-slice・shrimp-curl）。未炒めは現行と同一 | `CookingPrep.css`、`searDoneness`／`boilDoneness` の写像、SVG 構造の固定テスト | `CookingPrep.css`（#695 が新規追加）→ #695 merge 後 | 見た目が変わらないことを確認（before／after スクショ） |
| **M3** | 焼く（裏返し）UI（Preview/DEV 限定、本番 OFF） | 幕の中身、`searDoneness`、E2E | `CookingPrepLayer`（1B 後の main） | **必須**（390×844 動画＋スクショ。iPhone 実機は Owner） |
| **M4** | 茹でる（引き上げ）UI（Preview/DEV 限定、本番 OFF） | 幕の中身、スワイプ検出、E2E | 同上 | **必須** |
| M5（条件付き） | 玉ねぎの飴色（SVG 承認後） | SVG は別 PR | Style Lock 追補が前提 | **必須** |

各 PR のチェック: 全 Vitest／typecheck／lint／build、WebKit gate（src 変更あり）、フラグ OFF で DOM／状態が現行と同一（Phase 1 AC-1）、保存データの前後同一（localStorage スナップショット比較）。**本番フラグ ON は別の Owner 明示承認**（HV PASS・CI・merge では ON にならない）。

### 9.1 Stage 1-A／1-B の依存関係と実装開始条件（2026-10-29 追記）

**対応づけ:** Stage 1-A（ソーセージ／ポルチーニ焼き）＝ M1 ＋ M2（sausage-slices・porcini-slice）＋ M3。Stage 1-B（えび茹で）＝ M2（shrimp-curl）＋ M4。M1 は 1-A・1-B 共通の土台で、先に入れる。

| 順 | 依存 | 状態（2026-10-29 時点） |
|---|---|---|
| 1 | **PR #695（Cooking Prep Phase 1 PR-B）の Squash merge**（Owner の明示承認後） | **open・未 merge**（HEAD `5beb87b`、mergeable clean）。実機 HV は Owner 判定待ち |
| 2 | **Phase 1B（タイミング式の焼き加減）の独立 PR の merge**（Owner D1: #695 merge 後に最新 main から作成） | **設計承認済み・実装未着手**。設計書は main に無い（branch `claude/teto-cooking-prep-1b-p96ftb`）。claim 未投稿 |
| 3 | M1（レジストリ・タイミング核の設定化） | 1・2 の後。1B の `panDoneness.ts` と `PREP_INGREDIENT` の任意 `progress`／`preparedLook` が前提 |
| 4 | Stage 1-A: M2（sausage／porcini）→ M3 | 3 の後。1-A と 1-B は M1 以降は独立に進められる（`CookingPrepLayer`・`CookingPrep.css` を共有するため merge 順は直列推奨） |
| 5 | Stage 1-B: M2（shrimp）→ M4 | 3 の後 |

**実装開始条件（すべて満たしたときのみ着手。Stage 1 の実装は #695 と Phase 1B の merge 完了後）:**

1. #695 が main に merge 済みで、本番フラグ `PREP_EXPERIENCE_PRODUCTION` が `false` のまま。
2. Phase 1B が main に merge 済み（`panDoneness.ts`・`preparedLook`・結果表示が main にある）。
3. **O-4（結果画面）と O-9（調理法ごとの独立フラグ・一元管理）は決定済み**（§0.4・§0.5）。M1 の設計に反映する。残る未決（O-6・O-7・O-8・O-10・O-11）は Stage 1 の開始条件に含まれない。M1 設計時に確認する細目: マスタースイッチの要否（§0.5）。
4. 最新 main から新規ブランチを作成し、重複 PR／Issue／claim を再確認（`TETO_SESSION-OPERATIONS_1.0.md` §1）。#611 に claim を投稿（#695・1B の claim 範囲と重ならないこと）。
5. 食材ごとのレシピ数・Lunch Rush 対象数（本書は簡易抽出）を実装 PR の冒頭で再計測。
6. 1B の HV 結果で定数（ベスト帯・ARM 時間）が変わっていれば、本書の設計値（§0.2 方針 3・4）を追随させる。

**実装時の守るべき制約（Owner 決定の転記）:**

- O-3: Prep は 1 ラウンド最大 2 回（食材単位・各 1 回）。3 種目以降はピルを出さない。reducer の拒否条件（`preparedIngredientIds` の件数）とピル表示条件（`prepOffer`）の両方に入れ、片方だけにしない。
- O-5: `preparedLook` は食材 id→スカラー 0..1。2 段判定（裏返し）は**結果を 1 個の値に畳む**。
- 方針 1・2: スキップ可能。採点・在庫・Dex・保存・識別・Hint に一切影響させない（Phase 1 AC-1〜AC-7、AC-19 の行列を各 PR で再実行）。
- 方針 3: えびの引き上げは画面端を避け、ボタン代替を併設。**iPhone 実機 HV で Safari の戻る／ホームバーとの競合が無いこと**を判定項目にする。
- 方針 4: 通常 8 秒以内、説明は 1 行。HV でテンポ負担（O-3 の再検討材料を含む）を Owner が判定。
- O-4: 結果画面は「もう一度焼く／これで使う」（えびは準用）。裏返しの成否を 1 行で説明し、失敗・焼きすぎでも続行可能・採点無影響。ベストは自動確定（1B の方針）。
- O-9: 調理法ごとに独立したフラグ（牛肉・焼く・茹でる）を 1 モジュールで一元管理。各フラグ OFF で現行と同一。本番 ON は調理法ごとの個別承認。M1 にフラグ基盤（一元化・個別 opt-in・行列テスト）を含める。
- 本番フラグ ON・共有 Preview 更新は Owner の別承認。各 PR は Preview/DEV 限定で検証。

---

## 10. Owner 判断が必要な事項（状態つき。決定済み 6／未決 5）

凡例: **決定済み**（2026-10-29）／**未決**（今回の回答に含まれない。推奨は助言で、決定ではない）。

| ID | 判断 | 状態 | 内容（決定 or 推奨） | 影響 |
|---|---|---|---|---|
| **O-1** | Stage 1 の対象 | **決定済み** | ソーセージ／ポルチーニの焼く（裏返し）＝Stage 1-A、えびの茹でる（引き上げ）＝Stage 1-B を採用 | 着手範囲 |
| **O-2** | 野菜の専用 SVG の Style Lock v2 追補 | **決定済み（方向承認。実装は別タスク）** | 玉ねぎから先に追補する案は推奨のまま未確定（優先順は別タスクで決める） | 玉ねぎ・きのこ・ナスの調理法が依存 |
| **O-3** | Prep 回数／種類の上限 | **決定済み（暫定）** | 1 ラウンド最大 2 回。実機 HV で負担が大きければ再検討 | テンポ、玉ねぎ導入 |
| **O-4** | 結果画面（Q5 踏襲） | **決定済み** | 「もう一度焼く／これで使う」を設ける。裏返しの成功・失敗も説明。失敗時も続行可能、採点に影響させない（§0.4） | UI 文言、失敗の見え方 |
| **O-5** | `preparedLook` のスカラー制約 | **決定済み（Stage 1 は維持）** | 個体別・面別状態は将来検討。緩める場合は別 Gate | ナス・貝の可否 |
| **O-6** | 調理結果を採点／識別に入れる可能性（Stage 3） | **未決** | 推奨: Stage 1・2 の HV 後に別 Gate。方針 2 により Stage 1 では扱わない | §7.3 の R-1〜R-7 |
| **O-7** | Prep の対象工程を TOPPING 以外へ広げるか | **未決** | 推奨: Stage 1 では広げない（Stage 1-A／1-B は TOPPING のみで成立） | reducer ガード（HOT）変更 |
| **O-8** | #476 D3（SCATTER 新方式を保留）の扱い | **未決** | 推奨: 保留維持。Stage 1 には無関係 | チーズすりおろし |
| **O-9** | フラグ構成 | **決定済み** | 調理法ごとに独立（牛肉・焼く・茹でる）、設定は一元管理（§0.5）。マスタースイッチの要否は M1 設計時に確認 | 公開・ロールバックの粒度 |
| **O-10** | 音・触覚なし前提の演出方針 | **未決** | 推奨: 視覚のみを維持。音の導入は別 Gate | 手応え全般 |
| **O-11** | 新食材を伴う提案（揚げる・パスタ等）の採否 | **未決** | 推奨: 当面見送り。Stage 1・2 に無関係 | 食材追加の依存関係（§4.4） |

**Stage 1 の着手に必要な未決:** なし。未決の O-6・O-7・O-8・O-10・O-11 は Stage 1 をブロックしない。Stage 1 の実装は、決定事項とは別に **#695 と Phase 1B の merge 完了後**（§9.1）。

---

## 11. 残存リスク

| # | リスク | 備考 |
|---|---|---|
| 1 | **評価がすべて設計仮説**（実プレイ・実機計測なし） | 面白さ・テンポ・iPhone の操作感は HV で初めて分かる。本書のスコアは優先度付けの根拠であって合否ではない |
| 2 | **#695 と 1B が未 merge** | #695 自体が Codex／実機 HV で修正を受ける可能性。1B の定数（ベスト帯 2.1〜4.2 秒・ARM 300ms）は HV で調整予定。Stage 1 の設計はこれらに追随する |
| 3 | **SVG 依存** | 食材の 25/92 のみ専用 SVG。色上書きは #695 が新規追加する `CookingPrep.css` を共有する（`IngredientGlyph.tsx` は触らない方式）。Style Lock v2 の野菜追補は Owner 設計が前提で、リードタイムが長い |
| 4 | **テンポの積み上がり** | 任意でも、玉ねぎ（17 レシピ）や複数 Prep のレシピで合計時間が伸びる。「面倒で触らなくなる」＝機能の空洞化 |
| 5 | **採点に効かない調理の空洞化** | 見た目のみだと「やっても意味がない」に感じる恐れ。1B／#695 の HV 結果が先に出る |
| 6 | **HOT file 競合** | `PizzaStage.tsx`（#468 draft）、`GameScreen.tsx`（#478 draft）、`App.css`（#581 ほか）。新規 CSS ファイルに分離して回避する方針（#695 と同じ） |
| 7 | **iOS Safari 固有** | 画面端のスワイプ（戻る・ホームバー）、長押しコールアウト、`inert`（iOS 15.5+）。WebKit はローカルで走らせられず CI のシャード頼み |
| 8 | **E2E の不安定さ** | 既存の WebKit flaky（#394, #680）。時間依存の spec は仮想時間（`page.clock`）で書く必要がある |
| 9 | **Stage 3 の互換性** | §7.3 の R-1〜R-7。旧版が新版の保存を `corrupt` 拒否する経路、BEST の新旧混在、Anti-Oracle 漏洩 |
| 10 | **簡易抽出の数値** | 食材別のレシピ数・Lunch Rush 対象数は正規表現による簡易抽出。実装 PR の冒頭で再計測すること。カタログは頻繁に増える（本監査中も #693 等で変動） |

---

## 12. 調査根拠（ファイルパス・コード位置）

### 12.1 コード（main `3e34656`）

| 事項 | 位置 |
|---|---|
| `GameState.preparedIngredientIds?` | `src/state/gameReducer.ts:340` |
| `PREP_INGREDIENT` reducer（ガード列） | `src/state/gameReducer.ts:1161-1173` |
| `RESET_PIZZA` での Prep 除去 | `src/state/gameReducer.ts:1216` |
| Dinner の入口絞り込み | `src/state/gameReducer.ts:2331`（`DINNER_COOKING_ACTIONS`）、`:2501` |
| `MakingStep`／`GamePhase` | `src/state/gameReducer.ts:146-163` |
| 対象食材と `canPrepIngredient` | `src/data/prepIngredients.ts`（`PREP_TARGET_INGREDIENT_IDS = ["beef"]`、`pieceVisual` ガード） |
| Prep のフラグ | `src/data/prepExperienceGate.ts`（`PREP_EXPERIENCE_PRODUCTION = false`） |
| タブ上限 | `src/data/cookingProfiles.ts:240`（`MAX_VISIBLE_COOKING_TABS = 6`） |
| 専用 SVG の型（25 種） | `src/data/ingredients.ts:23`（`DedicatedIngredientVisual`） |
| `beef-slices` の描画 | `src/components/IngredientGlyph.tsx:48,86` |
| 配置ピース型・最小間隔 | `src/state/pizzaState.ts:6`（`PlacedTopping`）、`:118`（`MIN_TOPPING_DISTANCE`） |
| 保存中ラウンド（許可リスト・`corrupt`） | `src/state/pendingRound.ts:116,203-208` |
| 識別軸の観測状態 | `src/logic/discovery/signature.ts:95`（`RUNTIME_DIMENSION_OBSERVATION`） |
| FINISH の対象ラウンド | `src/state/finishEngine.ts:35`（`finishAllowedForRound`） |
| 採点の重みとプロファイル | `src/logic/scoringV2/index.ts:59-62,81-82` |
| 焼成時間 | `src/logic/bakeProgress.ts:17`（`BAKE_DURATION_S = 3`） |
| ステージのポインタ処理 | `src/components/PizzaStage.tsx:645`（`startDispenseSession`）、`:1022`（`toppingPieceStyle`）、`:1571` |
| サイズ区分 | `src/data/toppingSizeClass.ts` |
| カタログ規模 | `src/data/catalogLedger.test.ts:26-30`（80 recipes／92 ingredients／70 ladder steps） |
| Prep のテスト資産 | `src/logic/prep/*.test.ts`（PR-A）、`src/preview/prepPreview.gate.test.ts` |

### 12.2 #695 の変更ファイル（HEAD `5beb87b`、読み取りのみ）

`src/components/CookingPrepLayer.tsx`／`CookingPrep.css`／`PizzaStage.tsx`（**`IngredientGlyph.tsx`・`BeefSlices` は無変更**。PR 本文で確認）、`src/screens/GameScreen.tsx`、`src/App.tsx`、`src/logic/prep/{prepOffer,beefDoneness}.ts`、`src/preview/CookPrepHvStarter.tsx`、`e2e/cooking-prep.spec.ts`、`docs/reports/TETO_COOKING-PREP_PR-B_Result.md` ほか計 43 ファイル。`beefDoneness.ts` の生→炒め済み 2 点間補間（`BEEF_RAW_COLORS`／`BEEF_COOKED_COLORS`、`PREP_HEAT_OFFSET = 0`）が、本書の「doneness → 色の写像」の先行例。**訂正:** 初版は #695 が `IngredientGlyph.tsx` を変更し CSS 変数化すると記述したが誤り。#695 は CSS の `path` 上書き方式（Phase 1 仕様 §4.4 の CSS 変数案とは異なる。仕様との差分は §12.4 #8）。

### 12.3 ドキュメント

| 文書 | 用途 |
|---|---|
| `docs/PROJECT_HANDOFF.md`（先頭 addendum 群） | ロードマップ SSOT。現状は STATE-SYNC とコードを優先 |
| `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` | HV の適用範囲（docs-only は不要）と実装 PR の要件 |
| `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` | claim・HV・Preview 運用 |
| `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` | Prep Phase 1 の SSOT（P-1〜P-10、AC-1〜AC-19、§5.2 対象判定、§8 技術仕様） |
| `docs/reports/TETO_COOKING-PREP_Technical-Investigation_Result.md` | T0〜T7（状態の置き場・描画・入力・保存の不変性） |
| `docs/reports/TETO_COOKING-PROCESS-EXPANSION_Fresh-Audit.md` | 旧 audit（工程分類・テンポ規則提案・識別軸の影響範囲） |
| `docs/reports/TETO_COOKING-PROCESS-EXPANSION_Phase1-PreImplementation-Verification.md` | SPRINKLE 撤回、#476 D3／#579 の整合 |
| `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`、`src/data/techniques.ts` | 技法（Technique）台帳。`late-addition` まで |
| `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` | 食材 SVG の設計 authority（26 種。野菜の設計なし） |
| `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` | 172 行の原典証跡。`prep` は 3 行（`stir-fry`×2、`drain/stir-fry`×1）、`pizza-fritta` は `NOT_REPRESENTABLE`（FRY_COOK） |
| branch `claude/teto-cooking-prep-1b-p96ftb`（`d5f7754`）の `docs/reports/TETO_COOKING-PREP_PHASE1B_Fresh-Audit.md` | Phase 1B 設計（Owner D1・Q1〜Q5）。**main 未取り込み** |
| GitHub | Issue #611・#476・#579、PR #695（HEAD `5beb87b`）、open PR 一覧（#478・#468・#581・#540 ほか） |

### 12.4 既存設計との差分（勝手に仕様変更せず報告）

| # | 差分 | 扱い |
|---|---|---|
| 1 | 旧 audit のテンポ規則（提案）「1 レシピ最大 1 種」と、rendang／wasabi-beef が既に beef＋onion の 2 種に該当する点 | 決定ではなく提案だったため矛盾ではないが、玉ねぎ導入時に衝突する → O-3 |
| 2 | Phase 1 仕様 §5.2／§8 は「炒め対象リスト」を小さな別モジュールとし配列で定義。本書はレジストリ化を提案 | `canPrepIngredient(id): boolean` を維持する互換変更として提案のみ（PR-A の API は壊さない）。M1 で Owner 確認 |
| 3 | Phase 1 仕様 §3.3／`PREP_INGREDIENT` は TOPPING 限定。FINISH のわさび、SAUCE 前の混ぜはその外 | 本書は Stage 1 では広げない（O-7） |
| 4 | Phase 1 仕様 P-6／AC-13「タイミング演出なし・失敗状態なし」は 1B（Q1）で改訂承認済み。1B は main 未取り込み | 本書は 1B 承認後の方針を前提とし、後続の調理法も 1B の Q5（進行不能なし）を踏襲 |
| 5 | 1B の Q4 は「`preparedLook` を最小限」と条件付き承認。ナス・貝は面／個体ごとの状態を要する | 緩和は Owner 判断（O-5）。本書は緩めずに設計 |
| 6 | 旧 audit が P-SPRK／P-ARNG／P-MIX／P-DRIZ を扱ったのに対し、本書は「茹でる・揚げる・漬け込む・すりおろす・水切り・切る」を初めて評価。混ぜる（ソース）は採点（52%）と衝突として Stage 3 扱い | 矛盾する結論は無い。旧 audit の「混ぜる=Phase 3 以降」と整合 |
| 7 | Phase 1 仕様 §7 の「ladder step 58（rendang）で beef 導入」等の前提は現行 70 step と数値が異なる | 本書は現行コードの数（80／92／70）を使用。仕様側の更新は本書の範囲外 |
| 8 | Phase 1 仕様 §4.4 は SVG の色を **CSS 変数 3 つ**（`--beef-lean` 等）で渡す契約と記述。#695 の実装は **SVG・`IngredientGlyph.tsx` 無変更で、`CookingPrep.css` が `BeefSlices` の `path` を上書き**する方式 | 仕様と実装の差分として報告のみ（本書は #695 の実装方式を先行例として採用。初版の記述誤りは §12.2 で訂正）。仕様側の更新は #695／1B の範囲 |
| 9 | Owner O-3（Prep は 1 ラウンド最大 2 回）は Phase 1 仕様（beef のみ・上限の規定なし）と旧 audit のテンポ規則提案（1 レシピ最大 1 種）の間の新しい上限 | 旧提案は決定ではなかったため矛盾ではない。O-3 を現行の上限として扱う |
| 10 | Phase 1 仕様 §8.4 は単一フラグ `PREP_EXPERIENCE_PRODUCTION`＋Preview opt-in。Owner O-9 は調理法ごとの独立フラグ（一元管理） | 牛肉を既存フラグに対応させ後方互換を保つ形で拡張（M1）。reducer の `prepExperienceEnabled()`（引数なし）は調理法別の判定へ最小変更が必要 → M1 で HOT file 変更の範囲を確認 |
| 11 | 1B の Q5 は炒めの結果表示（「もう一度炒める」「これで使う」）。Owner O-4 で焼く（裏返し）・茹でるへ準用し、裏返しの成否説明を追加 | 1B 設計書は変更せず、本書 §0.4 に準用を記載。文言は暫定で HV 確定 |
