# Discovery 3.0 — Research Recipe UX / State Flow Design（DESIGN / UX / DOMAIN SPEC・DOCS ONLY）

- audited main: `262b09fcb78d98c7b12ea4e5b51c2da1bca9d37e`（`origin/main` を fresh fetch。latest known main と一致、進んでいない）
- 種別: 設計のみ。実装・Issue・PR なし。No.28 は選ばない。Step 14 / Grandma は進めない。R6 / IP-2 へ進まない。型・schema は確定しない（「候補」と明記）。
- 前提（読み込み・再監査なし）: Recipe Discovery Mode audit（`c560475`）、Progressive Recipe Reconstruction audit（`76bf94b`＋JSON）。それらの事実はここで再掲せず、必要箇所のみ引用する。
- 今回の production 確認は read-only（`recipeDiscoveryState` / `hintTarget` / `hint5Ladder` / `discoveryHint` / `trialNotebook*` / `trialRecord` / `resultNearMiss` / `originalResultCopy` / `freeCook` / `DexOverlay` / `persistence` の該当箇所、`pesto-pollo`・Step 12 の recipe data）。test / build / E2E / screenshot / HV は未実施（docs-only は HV policy の「原則不要」）。
- Owner Direction D1〜D9 を設計前提として採用した。**production authority と衝突した箇所は §0 に集約**した（勝手に変更していない）。

---

## 0. Owner Direction と production の衝突・差分（先に読む）

| # | Owner Direction | production の事実 | 扱い |
|---|---|---|---|
| C1 | D7/§9「Hint は classification を基本。例: △ チーズ系」 | **Hint 5.0 の SAUCE / CHEESE / KEY_TOPPING rung は ingredient の「名前」を出す**（`ing:<id>`）。classification（family）を出すのは **SUB_CLASS rung = topping のみ**（`cls:<id>`、7 family）。sauce・cheese は family ではなく category で、**「チーズ系」という分類は taxonomy に存在しない**（`ingredientTaxonomy.ts` は topping 専用 7 family）。「トマト系」も無い（`fresh-tomato` は `vegetable`＝「野菜・きのこ系」） | 例示の「△ チーズ系」は**作れない**（taxonomy gap）。§9 で「既存 ladder をそのまま使う」案を基本に再構成。新 family は作らない（H5-INV-2 / T-COV と衝突）。OD-RX-2 |
| C2 | D4「attempt から system が EXACT を返さない」＋ §10 | production の ORIGINAL RESULT は既に**中立 1 行のみ**（`NEAR_MISS_FAR_GENERIC_COPY`。Near/Far Neutralization Phase 1）。ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH は DOM が byte 同一であることを privacy gate が pin している | D4 は **現 production と完全に整合**。むしろ attempt→knowledge を作らないことで、前監査の attribution 問題（複数 entry へどう帰属させるか）が**消える**（§5・§8） |
| C3 | §7 例文「今回は新しいレシピには**一致しませんでした**」 | INCOMPLETE_MATCH は「identity は一致・Completion Gate で不合格」。ORIGINAL と byte 同一 copy でなければならない（`originalResultCopy.ts` OD-P2-1 / OD-D3-23）ため、「一致しなかった」と書くと **INCOMPLETE_MATCH で事実に反する** | copy は「**まだ新しいレシピは見つかっていません**」系（3 種全てで真）にする。§7 |
| C4 | D9 / §15「1 recipe = 1 research entry」 | Dex は 2+ DISCOVERABLE で 1 枚に集約（PR-4b-A D-2/D-3）。Hint は pool>1 で target を選ばず OPEN_POOL（D-1、OD-4b-A-2 の pin 制約） | **意図した supersede**。変更点を §15 に列挙 |
| C5 | §3 / §14 「仮登録 = unlock で derive」 | `DISCOVERABLE` は stock≥1 を要求（stock 0 で `KNOWN_BUT_MISSING_MATERIAL` に戻る）。entry を DISCOVERABLE に連動させると調理後に消える | 登録は **ownership 基準（`ownedIngredientIds` は減らない）**。§3・§16 |
| C6 | §9「Hint は選択中 Target について未判明 knowledge を 1 つ増やす」 | Hint 5.0 は**線形 ladder**で、player は rung を選べない（次の 1 rung のみ購入可）。`selectHintTarget` は **DISCOVERABLE** の recipe しか target にしない | 「1 回で 1 つ増える」は成立するが、**何が増えるかは ladder 順**（player 選択ではない）。stock 0 の entry は Hint 不可（REFILL）。§9 |
| C7 | D5/D8 「Notebook を Research Target と結びつけてよいか検討」 | Notebook は **recipe id / target / 推測を持てない構造**が不変条件（`trialNotebook.ts` ヘッダ、`trialNotebook.gate.test.ts` が pin） | 行（row）に target を付けるのは**不変条件の変更**。ヘッダ表示に留めれば不変条件を守れる。§8 |

---

## 1. Fresh state

- `origin/main` = `262b09f`（#345）。直前の 2 監査は別 branch（main 未取り込み）。
- 本 report は専用 docs branch `claude/discovery-3-recipe-ux-state-rutg6q` のみ。

---

## 2. Core loop（1 本・最終案）

```
[A] 新 finite material を購入（Shop）
      ↓  ownership の事実だけで判定（stock 不問）
[B] 未知 recipe が「仮登録」される（0..n 件）
      → 購入 feedback：「🔎 新しいレシピの手がかりを発見！」＋ [研究室を見る]
      ↓
[C] Research Dex（Dex 内「🔎 研究中のピザ」）に「？？？ピザ」entry（1 recipe = 1 entry）
      → 最低 1 つの known fact：✓ 今回買った材料（常に真）
      ↓
[D] 「このピザを研究する」＝ Research Target 選択
      → entry が 1 件なら自動、2 件以上なら player が選ぶ（選ばずに始めることも可）
      ↓
[E] レシピ発見 round（既存 FREE_COOK round の再利用）
      PREPARE（上部に「研究中のピザ＋わかっていること」帯）→ 試作 → BAKE
      ↓
[F] RESULT
      ├─ ORIGINAL / INCOMPLETE_MATCH / AMBIGUOUS（byte 同一）
      │     「🧪 研究試作」＝失敗ではない。Trial Notebook に自分の組み合わせが残る
      │     次の一手：[もう一度試す]／[📓 試作ノート]／[💡 ヒント]
      ├─ FAILED（生焼け・焦げ・空）＝従来どおり「失敗」
      └─ NEW_DISCOVERY（matcher 完全一致 ＋ Completion Gate）
            ↓
[G] Hint（任意・有料）：Target に ladder の次の 1 rung → ✓/△ が Research Dex に残る（既存 `discoveryHintFacts`）
      ↓  [E]〜[G] を繰り返す
[H] NEW RECIPE DISCOVERED
      → 名前を初公開、Research entry を正式 recipe card へ昇格、Dex 登録（既存 REGISTER_TO_DEX）
      ↓
[I] state-aware CTA：研究中がまだある → 次を研究／新材料あり → 食材を見る／なし → 図鑑
```

**knowledge の入口は 2 つだけ**: ① unlock（購入した材料＝✓）② 有料 Hint（rung）。**attempt は knowledge を作らない**。これにより、player の「進んだ感」は (a) entry の存在と ✓/△ の蓄積 (b) Notebook の自分の試行履歴 (c) 最終発見、の 3 つで作る。

### 既存機能の再利用マップ（ここが本設計の中心）

| loop 段 | production の対応物 | 再利用度 | 新規に要るもの |
|---|---|---|---|
| A 購入 | Shop / `purchaseFirstPack`（`ownedIngredientIds` は **append-order invariant** で保存済み） | ◎ そのまま | 購入直後の entry 差分検出（前後で REGISTRABLE 集合を比較。保存不要） |
| B 仮登録 | `recipeDiscoveryState` の ownership 部分 | ○ 判定の一部のみ | `REGISTRABLE(R)`（stock 不問）。pure 関数 1 本 |
| C Research Dex | `DexOverlay`（`aggregateUnknown` / `shownState` 機構＝候補の slot を plain unknown に偽装する仕組み）、HintSheet の「わかっていること」board | ○ | entry card component、knowledge projection |
| D Target | `selectHintTarget` の `pinned` / `sticky`、`HintSession`、`ProgressionCarry`（retry 間で target を保つ） | ○ | target source `"research"`（pool>1 でも player 選択を尊重） |
| E round | `START_FREE_COOK` → `FREE_COOK_RECIPE` sentinel、`isLargeCatalogEligible`（食材庫）、generic bake window | ◎ 無改造 | PREPARE 上部の「研究中」帯（表示のみ）。**matcher は一切触らない** |
| F RESULT | `resolveFreeCookPizza` / `resultNearMiss`（中立 1 行）/ `originalResultCopy` / `recordTrialAttempt`（ORIGINAL・AMBIGUOUS・INCOMPLETE のみ記録） | ◎ | copy 差し替え、RESULT から Notebook を直接開く導線 |
| G Hint | Hint 5.0 ladder（価格 10/10/10/5/5・`ALREADY_KNOWN`・線形 rung・fact は `discoveryHintFacts`、`HINT5_LADDER_PRODUCTION_DEFAULT = true`） | ◎ | unlock fact を M3 の「request-time known」に渡す配線 |
| H 発見 | `evaluateDiscovery`（signature 完全一致）＋ `evaluatePizzaCompletion("recipe")`（各材料≥1 piece・sauce 量・bake window）→ `REGISTER_TO_DEX` | ◎ 無改造 | entry→card 昇格は state 派生で自動（entry は「未発見 ∧ REGISTRABLE」なので DISCOVERED になれば消える） |
| I CTA | `ResultPanel` の既存 CTA（📖図鑑／🛒ショップ／もう一度／レシピを選んで作る） | ○ | state-aware 選択（pure） |

**結論**: 新規 mechanic は不要。新規要素は「(1) REGISTRABLE 判定 (2) knowledge projection (3) target source `research` (4) 表示 component (5) CTA 選択関数」で、**いずれも保存を増やさない**。

---

## 3. Unlock → Research Entry

### 3.1 仮登録条件（確定候補）

`REGISTRABLE(R)` = R が未発見 ∧ R の **finite（`unlockCondition` を持つ）材料が 1 つ以上あり、その全てが `ownedIngredientIds` に入っている**。

- stock は見ない（C5）。starter のみで作れる recipe（Margherita）は finite 0 件で対象外 → FTU の Margherita onboarding と衝突しない。
- `ownedIngredientIds` は減らない → **登録集合は毎回導出でき、保存不要**。
- 不変条件（テスト化する）: `REGISTRABLE(R)` ⇒ `recipeDiscoveryState(R) ∈ {DISCOVERABLE, KNOWN_BUT_MISSING_MATERIAL}`（entitled かつ owned なので `UNKNOWN` にはならない）。逆に `DISCOVERABLE` ⊂ `REGISTRABLE`。
- entitle 済み・未購入の recipe（KNOWN_BUT_MISSING で未所持材料あり）は**登録しない**（Shop の存在から recipe 有無を逆算させない）。

### 3.2 unlock fact（✓）

`UNLOCK_FACT(R)` = R の finite 材料のうち **`ownedIngredientIds` 上で最も後ろに取得されたもの**（append-order invariant に依存。`deductionGuard.ts` の `makeablePrefix` と同じ前提）。
- 「R に含まれる」は常に真（偽陽性なし）。起点となった「今買った材料」と一致する（購入直後は最後尾）。
- 古い save・後から recipe が追加された場合も同じ式で導出でき、unlock「事象」は不要（演出のみ §3.4）。
- starter 材料は ✓ にしない（starter は全 recipe 共通で情報にならず、free leak の起点になる）。

### 3.3 表示ルール

- recipe 名・Dex の `No.xx`・総材料数・「？？？ slot を材料数だけ並べる」・candidate の exact count（pool 規模）は出さない。
- 出してよいのは **player が登録した entry の存在と数**（D9）。**未登録の recipe の有無・総数・残数は出さない**（新 privacy contract、§15）。

### 3.4 購入時の演出（保存不要）

Shop 購入ハンドラで「購入前後の REGISTRABLE 集合の差分」を取り、差分が 1 件以上なら購入 feedback に「🔎 新しいレシピの手がかりを発見！」＋ `[研究室を見る]`（Dex の Research section を開く）を足す。**差分は純粋に前後比較**なので「見た/見ていない」を保存しない。古い save をロードしたときは toast なしで entry だけが存在する（backlog 初回表示の spam を避ける）。

### 3.5 複数 entry の識別

- player-facing の見出しは全て「？？？ピザ」。**2 件以上のときだけ**丸数字 ①②③ を付ける（A/B 等の内部便宜名は出さない）。
- 番号の割り当て: ① 登録順（= `UNLOCK_FACT` の `ownedIngredientIds` index 昇順）② 同順位は **recipe 構造と無関係な opaque tie-break**（例: `recipeId` の安定 hash）。`compareHintCandidates`（keyStep → 材料数 → 宣言順）は**使わない** — 材料数昇順で並ぶと「①は材料が少ない」が STRUCTURE の比較情報として漏れる。
- 先頭の entry が発見されて消えると残りの番号が詰まる（番号は表示専用で保存しない）。意味を持たせない。
- 同一購入で同時登録された entry は ✓ が同じになる（例: Step 12 onion）。player はそれを許容情報として受け取る（D9）。区別は丸数字のみ。

---

## 4. Research Dex 画面

### 4.1 配置の比較（OD-RX-1）

| 案 | 内容 | 利点 | 難点 |
|---|---|---|---|
| **A. Dex 内「🔎 研究中のピザ」section（推奨）** | Dex overlay 上部に entry card を縦並べ。下は既存の slot grid | 既存 overlay・戻る導線・`shownState` 機構を再利用。Dex は元々「？？？」と Hint pin の置き場。画面追加なし | slot grid（No.01–27）との混在。section が増えると縦長（entry は通常 0〜2 件） |
| B. 独立 Research 画面 | HOME に「研究室」ボタン→専用 overlay | Dex の発見図鑑という役割が汚れない。entry が多くても拡張可 | 新 overlay・新 navigation・戻り先設計・E2E が増える。HOME の CTA 枠は既に 2+1 で窮屈（過去に 360px で折り返し問題） |

推奨は A。ただし HOME の「レシピ発見」入口は別に残す（§5）。

### 4.2 Entry card（390×844）

```
┌ 🔎 研究中のピザ ──────────────┐
│ ？？？ピザ ①                  │   ← 2 件以上のときだけ ①
│ わかっていること              │
│  ✓ チキンを使う               │   ← exact（unlock / 名前 rung）
│  △ 🥬 野菜・きのこ系を使う    │   ← class（SUB_CLASS rung）
│  ▫ 全部で4種類の材料          │   ← STRUCTURE 取得後のみ
│ [ このピザを研究する ]        │   ← 研究済み fact が 1 つでもあれば「研究をつづける」
│ 💡 ヒントあり（10 Pitz）      │   ← 次 rung の存在のみ。内容は出さない（既存 sheet と同契約）
└────────────────────────────┘
```

必須表示: unknown identity / ✓ exact / △ class / Hint の有無 / 研究 CTA。
禁止（guard test 化）: `3/5`・`60%`・「残り2個」・未判明 slot 数・？ 記号の個数並べ・recipe 名・No.xx・STRUCTURE 取得**前**の総材料数・candidate count。

- **STRUCTURE 後**だけ「全部で N 種類」1 行を出す（`meta:ingredient-total` が ledger にある場合）。**空 slot placeholder は描かない**（「？？？」を N−known 個並べると「残り」を player が目視で数える UI になり、かつ画面幅を食う。算術は player が自分でできるので禁止はしないが、UI として促さない）。
- ✓ と △ が同一 ingredient に付く場合は ✓ のみ表示（exact は class を包含。Hint 5.0 M3 と同じ）。
- stock 0 の entry: CTA は「🛒 材料を補充する」（Shop へ）、Hint は REFILL 扱い（`selectHintTarget` は DISCOVERABLE のみ target にするため。§0 C6）。entry 自体は消さない。
- 発見後: entry は消え、同じ slot の通常 card（recipe 名・`No.xx`）に置き換わる（派生で自動）。

### 4.3 Dex slot grid との整合

entry の recipe の slot は grid 側で **plain unknown slot に偽装**する（既存 `shownState` の `aggregateUnknown` 分岐と同じ仕組み）。entry と slot を結ぶ表示・anchor は作らない（`No.xx` が recipe identity なので）。

---

## 5. Research Target 選択

### 5.1 入口

- **HOME「レシピ発見」**（旧フリークッキング）: entry が 0 件 → 従来どおり即 round 開始。1 件 → picker なしで即開始（target は自動）。**2 件以上 → bottom sheet の picker**（下記）。
- **Research Dex の entry card の「このピザを研究する」**: その entry を target にして即開始（picker 不要）。

### 5.2 Picker（2 件以上のとき）

```
🔎 どのピザを研究する？
 ○ ？？？ピザ ①   ✓ たまねぎ
 ○ ？？？ピザ ②   ✓ たまねぎ
 [ 研究をはじめる ]
 （決めずに試す）            ← 小さく。round は始まるが Hint は target 未選択扱い
```
- 表示は §4.2 の entry card を compact にしたもの（✓/△ のみ）。名前・材料の答えは出さない。
- 「決めずに試す」を許すのは、**matcher が target と無関係**（全 recipe を照合）なため、target 未選択が oracle を生まないから。これで「picker が mode のゲート」になるのを避ける（D3: 純粋 sandbox は作らない、とは矛盾しない — 出口は常に発見で、報酬・保存先を持たない点は現状どおり）。

### 5.3 Target の意味（重要）

Target は次の 3 つにだけ効く:
1. **Hint の対象**（`selectHintTarget` に `researchTargetId` を渡す。source は `"research"`。pool>1 でも player の明示選択として尊重する。OD-4b-A-2「pin は選ばない」の例外ではなく、**選んだのは system ではなく player**という整理）。
2. round の帯に出す表示。
3. RESULT の CTA 文言。

Target は **matcher に影響しない**。Target と別の recipe が完全一致したら普通に NEW_DISCOVERY になる（target 制限をかけると「target ではない」が oracle になる）。

### 5.4 変更可否（決定）

- round 中（PREPARE〜BAKE 前）: 帯をタップで picker を再オープン可（tray 上の材料は保持。Hint session は target ごとに分かれるが fact は recipe 単位で永続しているので失わない）。
- RESULT 後: 「研究対象を変える」を 2 件以上のときだけ出す。
- session 内 target は `HintSession` と同様に **GameState のみ・保存しない**。reload すると 1 件なら自動、2 件以上なら再選択（knowledge は保存されているので失うのは選択だけ）。

### 5.5 禁止（guard）

reference pizza・hidden recipe 名・材料の答え・guided ORDER round にしない（`canStartGuidedRound` は DISCOVERED のみ＝LK-8 backstop は触らない）。Target を選んでも `SELECT_RECIPE` は通らない。

---

## 6. Recipe Discovery 調理画面（PREPARE）

調理 UI は既存 FREE を**無改造**で再利用。追加は上部の 1 本の帯だけ。

```
┌─────────────────────────────────┐
│ 🔎 レシピ発見          ？？？ピザ ① ▾│  ← 1 行（タップで picker。1 件なら ▾ なし）
│ ✓ チキン  △ 🥬 野菜・きのこ系      │  ← chip（折り返さず横スクロール or 2 個まで＋「…」）
├─────────────────────────────────┤
│  PizzaStage（既存）                 │
│  Making steps tabs / Tray（既存）   │
├─────────────────────────────────┤
│ 📓 試作ノート  💡 ヒント  🥬 食材庫  │  ← 既存 dock に 📓 を昇格（現状は Hint sheet 内のみ）
└─────────────────────────────────┘
```
- 帯は**常時 2 行まで**（約 48–56px）。現行の order card「🎨 フリークッキング」（`GameScreen` PREPARE / BAKE）を**置き換える**（足さない）ことで高さ増分をほぼゼロにする。390×844 / 360×800 の HV 対象。CSS は本設計では実装しない。
- chip が 3 個以上になったら「わかっていること（n）▸」の折りたたみ 1 chip にまとめ、タップで Hint sheet の board を開く（n は player 獲得 fact の個数であり、未判明の個数ではない）。
- target 未選択（0 件・決めずに試す）の帯は「🔎 レシピ発見」のみ。
- 📓 を dock に昇格する理由: 現状 Notebook の入口は **Hint sheet 内のみ**で、未発見 RESULT から直接開けない（前監査 §5）。dock の昇格は表示導線のみで state 追加なし。

---

## 7. ORIGINAL result（「研究試作」）

### 7.1 copy（C3 を反映した案）

```
🧪 オリジナルピザ                       ← lead（ORDINARY/AMBIGUOUS/INCOMPLETE で byte 同一）
まだ新しいレシピは見つかっていません。   ← 3 種全てで真になる文
試した組み合わせは試作ノートに残したよ（試作#n）。
[ もう一度試す ] [ 📓 試作ノート ] [ 💡 ヒント ]
```
- 現行 lead「図鑑にはまだ載っていないピザ！」と中立 1 行「🧪 別の組み合わせも試してみよう！」は、どちらも byte-identical gate を満たしている。**新 copy も 3 種で同一**であること。「一致しませんでした」は不可（C3）。
- 重複 notice（「前にも同じ材料の組み合わせで作ったよ（試作#n）」）は `lastTrialAttempt` から従来どおり。
- `[ 💡 ヒント ]` は **target あり ∧ ladder 未完了**のときのみ。target なし（決めずに試す）なら `[ 研究対象を選ぶ ]`。
- FAILED（生焼け・焦げ・空）は従来の失敗表示のまま。**ORIGINAL を「失敗でない」と言い切るのは ORIGINAL 系のみ**（前監査 §15 の心理的リスクへの対処は copy で「見つかっていません」＝途中経過を示す）。

### 7.2 絶対に出さない

`✓ mozzarella` / `✕ onion` 等の材料別判定、正解含有数、near/far、distance、similarity、missing 材料、candidate 数、INCOMPLETE_MATCH の存在。現 production の `resultNearMiss` は既に中立のみ（directional 行は production caller なし）で、**本設計は何も復活させない**。

### 7.3 knowledge-complete なのに ORIGINAL になる経路

全材料を知った player が余計な材料・量不足・bake window 外で ORIGINAL（INCOMPLETE_MATCH）になる場合がある（前監査 X5: 27 recipe は default dims）。ここで追加 feedback を出すと oracle になるため、**既存の recipe-independent な `executionAdvice`（Completion Gate 一般論）に任せ、新規の個別 feedback は作らない**。

---

## 8. Trial Notebook の役割

| | Trial Notebook | Research Dex entry |
|---|---|---|
| 内容 | **player が何を試したか**（sauce / toppings / 個数 / 順序 / 前回との差） | **確定した knowledge**（✓ exact・△ class・構成） |
| 寿命 | session のみ（`NOTEBOOK_COPY.sessionOnly`）。**今回は変更しない** | 永続（ownership 派生＋`discoveryHintFacts`） |
| 結びつけ | 無し（recipe / target を持てない） | recipe 単位 |

- 表示してよい: 「前回から mozzarella を追加」「onion を外した」（既存 `diffCombination`＝変更の事実のみ、良し悪しを言わない）。
- 表示しない: 正解/不正解 ingredient、distance、similarity、correct count、missing、identity。
- **Research Target 名を Notebook に出してよいか**: player 自身が選んだ事実なので privacy 上は問題ない。ただし **row ごとに target を付与するのは Notebook の構造不変条件の変更**（C7）で、同一 fingerprint を別 target で試した場合の扱い（row は fingerprint 一意）も新たに決める必要が出る。→ **推奨: Notebook 先頭に「いまの研究対象：？？？ピザ ①」を帯として表示するだけ（行には付けない）**。行付与は将来案として切り離す。
- 「Dex の ✓ と Notebook の使った材料を player が突き合わせる」ことは player 自身の行動と knowledge の突合で、未使用の正解は含まれず逆算にならない（前監査 §11）。
- Notebook の永続化は D8 の対象外とする（D8 は「研究成果」＝knowledge）。必要なら別 slice（§19）。

---

## 9. Hint flow

### 9.1 既存 ladder をそのまま使う（推奨・OD-RX-2）

Hint 5.0 は「Target の次の 1 rung」を売る線形 ladder で、**「未判明 knowledge を 1 つ増やす」を既に満たす**。rung は `SAUCE(10) → CHEESE(10) → KEY_TOPPING(10) → STRUCTURE(5) → SUB_CLASS①…(各5)`、key-free recipe は KEY を省略。

- SAUCE / CHEESE / KEY は **名前（exact）**、SUB_CLASS は **family（class）**、STRUCTURE は **総数**。
- → Research Dex 側の対応: exact → ✓、class → △、STRUCTURE → 「全部で N 種類」。**表示変換のみ**（保存は既存 `ing:` / `cls:` / `meta:ingredient-total` / `h5:*`）。
- 次 Hint で既知を重複販売しない: ladder が線形で `h5:*` / `cls:*` marker により完了済み rung は再販しない。unlock fact との重複は §9.2。
- price・`ALREADY_KNOWN`（M3）・rung 順序・fact persistence・「購入前 view が既知 fact に依存しない」不変条件は**全て無改造で維持**。

### 9.2 unlock fact の重複販売を避ける（唯一の配線）

derived な unlock fact（例 `chicken`）は `discoveryHintFacts` に保存されていない。そのまま ladder を進めると **SUB_CLASS rung が「🥩 肉系」を 5 Pitz で売る**（player は既に ✓ チキンを知っている）。対処: `requestHint5Rung` へ渡す stored facts に **derived `ing:<unlockFactId>` を request-time の入力として足す**（保存はしない）。M3 により「rung の開示内容が全部既知なら 0 Pitz で完了＝`ALREADY_KNOWN`」になる。pre-purchase view は M3 の不変条件どおり変わらない。→ Slice D の確認項目（§19）。

### 9.3 classification-centered に変える場合（OD-RX-2 の対案）

「全 rung を class にする」と、sauce/cheese/key の名前 rung の価値が変わり、**sauce・cheese の family が taxonomy に無い（C1）**。新 family を作るか、「チーズを使う」のような category 存在 fact を作ることになる。後者は旧 DH4 の `EXISTENCE_ONLY`（「existence だけで有料にしない」）と同種の領域で、H5 の invariants（H5-INV-1/2/4）を再検討する大工事。**現 ladder の維持を推奨**。taxonomy gap として以下を報告する:

| gap | 現状 | 影響 |
|---|---|---|
| sauce / cheese に family が無い | category のみ（3 sauce / 4 cheese）。名前 rung で開示 | 「△ チーズ系」は作れない |
| 「トマト系」 | `fresh-tomato` は `vegetable`＝「野菜・きのこ系」 | 新設すると cross-category の singleton 近い family になり H5-INV-2 と衝突 |
| 7 family は topping 専用 | `TOPPING_FAMILY_ROWS` 23 件 | topping のない recipe（margherita 系）の class はそもそも無い |

### 9.4 Hint の入口

- Research Dex の entry card（💡 ヒント）→ その entry を target にして Hint sheet を開く（`pinnedRecipeId` と同じ意味。pool>1 でも `research` source で有効）。
- round 内の dock 💡 → 現 target の sheet。target 未選択かつ 2+ entry → sheet は picker へ誘導する文言（現 `OPEN_POOL` 固定文言「まだ発見できるピザがあるよ！」を「🔎 研究するピザを選ぼう」に差し替え。**件数・材料・family・recipe 名を出さない契約は維持**）。

---

## 10. Exact fact acquisition 方針（OD-RX-3）

attempt からの自動 EXACT reveal は禁止（D4）。比較:

| 案 | 内容 | 研究の進行感 | oracle | 新 mechanic |
|---|---|---|---|---|
| **A. 現状（推奨）** | exact は ① unlock ② 有料 SAUCE/CHEESE/KEY rung（既存）のみ。sub-topping は class まで。最終 topping の exact は**発見時**まで増えない | ladder で ✓/△ が積み上がる＋Notebook | 既存契約のまま（rung 内容は購入前に見えない） | 無し |
| B. class 取得後に別操作で exact を検証 | 前監査 OD-PRR-1 C 案相当 | 二段で重い | 「検証できる」こと自体が boolean oracle。群検査で同定が数 attempt に縮む（前監査 §17） | 大（別 UI・別 state） |
| C. ladder 後半で exact 購入 | SUB_CLASS 後に exact 名を売る | 強い | H5-INV（class は名前を出さない）と衝突。**class rung の存在意義が消える** | 中〜大（ladder 改訂） |
| D. 別方式（例: N 回試作で無料 rung） | 試作回数に応じ報酬 | 強い | 試作回数は player の行動のみ＝oracle なし。ただし reroll 稼ぎ（同じ組み合わせの連打）を Notebook の重複検出で抑止する必要 | 新規（経済設計） |

**判断**: 現 ladder 自体が「exact を段階的に買える」C 案の骨格をすでに持つ（sauce/cheese/key の名前 rung）。player が「sub-topping の exact だけは発見まで増えない」ことは、むしろ**最後の推理を残す**設計として自然。新 mechanic は足さない（A）。D は将来の経済調整として切り離し（§19、Owner Decision には上げない）。OD-RX-3 は A の確認のみ。

---

## 11. STRUCTURE knowledge

- STRUCTURE は Hint の商品（5 Pitz、`meta:ingredient-total` ＋ `h5:structure`）。したがって**仮登録時は総数を一切表示しない**（§4.2 の禁止）。
- STRUCTURE 取得後のみ entry に「全部で N 種類」を 1 行追加。N は `recipe.requiredIngredients` の distinct 数（sauce を含む。ladder の `total` と同一）。
- 取得後も空 slot 並べ・残数・進捗率は出さない。
- 既存 Hint authority との整合: rung 順（key-free は SAUCE→CHEESE→STRUCTURE→SUB_CLASS…）を変えないので、STRUCTURE の購入タイミングも既存どおり。

---

## 12. Discovery success flow

```
CONFIRM_BAKE → resolveFreeCookPizza
  ① recipe-free completion（FAILED なら失敗）
  ② evaluateDiscovery（signature 完全一致）
  ③ 一致 recipe の own Completion Gate（"recipe" policy）
       PASS → MATCHED → NEW_DISCOVERY → REGISTER_TO_DEX → 名前公開・Dex 登録・Pitz
       FAIL → INCOMPLETE_MATCH → ORIGINAL と byte 同一表示
```
- **knowledge complete だけでは DISCOVERED にならない**: 発見の唯一の経路は `REGISTER_TO_DEX`（実調理＋matcher 完全一致＋gate）で、knowledge は matcher の入力ではない → **現 matcher で成立する**（変更不要）。
- ただし前監査 X5 の注意は残る: 現 production 27 recipe は default dims なので、全 ingredient が分かれば identity は全部分かる。残る障壁は「各材料≥1 piece・sauce 量・bake window・余計な材料を足さない」＝実行の障壁。これは設計上許容（§19 の将来 dimension で意味が増える）。
- 昇格: entry は「未発見 ∧ REGISTRABLE」の派生なので、DISCOVERED になった瞬間に研究 section から消え、grid の通常 card に変わる。**state の書き換えは不要**。
- target と別の recipe が発見された場合も同様（§5.3）。target は残る別 entry のまま、帯は更新されない（target が消えたら帯は「🔎 レシピ発見」に戻り、残り entry が 1 件なら自動 target、2 件以上なら picker 再提示）。
- 発見 RESULT は既存 NEW PIZZA 画面（名前初公開・📖図鑑を見る・material notice）をそのまま使う。

---

## 13. 発見後の primary CTA（OD-RX-4）

`postDiscoveryPrimary(state)` を pure 関数として切り出す（保存不要）。優先順位:

| 優先 | 条件（全て player が既に見られる情報から導出） | primary | secondary |
|---|---|---|---|
| 1 | 研究中 entry が残っている（発見後の REGISTRABLE ≥ 1） | 「🔎 次のレシピを研究する」（2 件以上なら picker へ、1 件なら即開始） | 📖図鑑を見る |
| 2 | 新材料が購入可能（material notice が出ている／Shop の NEW あり） | 「🛒 新しい食材を見る」 | 📖図鑑を見る |
| 3 | 上記なし | 「📖 図鑑を見る」 | 🏠 ホーム |
| — | 図鑑コンプリート（`COMPLETE`） | 既存の完了文言のまま | 🏠 ホーム |

- 表示してよいのは「次を研究する」の**有無**だけ。件数・「あと N 種」は出さない。「3 では『もう発見するものはない』と言わない」（新材料で entry は増える。COMPLETE 以外で断言しない）。
- 現行の「レシピを選んで作る」（→ Pizza Select）は F-1（名称と行き先の不一致）なので「**作ったピザをつくる／再調理**」へ名称修正し、primary から外す。
- 優先 1 と 2 のどちらを上にするかは UX 判断（OD-RX-4）。推奨は 1（entry は player が既に持つ手がかりで、材料購入は entry 解消後に自然に起きる）。
- Lunch Rush 解放案内は primary にしない（発見 loop から離れる）。

---

## 14. Persistence

最小保存を確定候補まで落とす。

| 項目 | 保存 | 根拠 |
|---|---|---|
| Research Entry の存在 | **不要** | `REGISTRABLE(R)`＝owned ⊇ finite ∧ 未発見。`ownedIngredientIds` は減らない（C5） |
| unlock exact fact | **不要（導出）** | `ownedIngredientIds` の append-order（pin 済み invariant）から導出 |
| entry の表示番号 ①② | **不要** | 登録順＋opaque tie-break から導出 |
| Hint 購入済み fact（✓/△/構成） | **既存の `discoveryHintFacts`** | `ing:` / `cls:` / `meta:ingredient-total` / `h5:*`。recipe id キー、`hintFactsFor(..., isUnknownRecipeId)` で未知 id も保持 |
| Research Target | **不要（session）** | 1 件なら自動、2+ は再選択。knowledge は永続なので損失は選択のみ |
| Trial Notebook | **今回は据え置き（session）** | D8 の「研究成果」に Notebook は含めない。必要なら別案件 |
| attempt 由来 EXACT | **存在しない** | D4 により作らない → 前監査 OD-PRR-4 の「新保存」は不要 |

**結論**: D8（reload で研究成果が消えない）は **新しい永続化なしで満たせる**。schemaVersion は上げない。save 追加ゼロ。リスクは 2 点のみ: ① `ownedIngredientIds` の append-only 契約が将来壊れると unlock fact と ①② 順が動く（既に別機能が依存＝`deductionGuard.makeablePrefix`／`persistence.ownedOrder.test.ts` が pin）。② ledger が recipe id キーなので save に「どの recipe の hint を買ったか」が残る（既存 Hint の前例どおり、player-facing には出ない）。

---

## 15. 既存 D-2 / #345 の contract 変更

### 15.1 contract の新旧

| | 旧（D-2 / #345 / D-1） | 新（本設計） |
|---|---|---|
| 隠すもの | **内部 pool（DISCOVERABLE）の候補数** | **まだ player が仮登録していない未知 recipe の数・有無・名前** |
| 公開してよいもの | 何もなし（2+ は集約 1 枚、数も slot も出さない） | **player が仮登録した entry の存在と数** |
| Dex | 2+ DISCOVERABLE で集約カード 1 枚 | 1 recipe = 1 entry の Research section |
| Hint target | pool>1 は OPEN_POOL（勝手に選ばない） | player が選べば有効（source `research`）。選ばなければ従来の OPEN_POOL 系固定文言 |

**重要**: 登録が ownership 基準なので `REGISTRABLE ⊇ DISCOVERABLE`。つまり旧 contract が隠していた「DISCOVERABLE 件数」は、仮登録を導入した時点で事実上公開される（entry の数 ≥ DISCOVERABLE 数）。これは Owner の意図した supersede（D9）だが、**新 contract の文言を「pool 件数は隠す」のまま残すと嘘になる**ので、明示的に書き換える。

### 15.2 残す部分 / 変える部分

| 対象 | 判定 | 内容 |
|---|---|---|
| `PizzaSelectView.prompt` が kind のみ（`pizzaSelect.promptCountGuard.test.ts`） | **残す** | Pizza Select は引き続き匿名 prompt。entry 件数は載せない（CTA は「レシピ発見へ」） |
| HOME bubble・Hint sheet 固定文言が件数を出さない | **残す** | |
| ladder「あと○つ発見で新材料」＝発見数 gate | **残す** | recipe 個数ではなく進捗 gate |
| 未発見 recipe の名前・材料・preview を Pizza Select / Dex に出さない（W1） | **残す** | |
| Dex の slot 番号が recipe identity | **残す** | entry に `No.xx` を付けない |
| `DexOverlay` `aggregateUnknown`（2+ で集約 card） | **変える** | 集約 card は廃止し Research section へ。`shownState` の偽装機構は slot grid 側で再利用 |
| `selectHintTarget` の pool>1 → OPEN_POOL・pin 制約（OD-4b-A-2） | **変える（拡張）** | `researchTargetId` が candidates に含まれれば TARGET(`research`)。それ以外は従来どおり |
| Dex 内 Hint 入口の抑止（2+ で hint 入口なし） | **変える** | entry card 単位で復活 |
| 旧 D-3（state 派生の移行 save 規則） | **形を変えて維持** | 旧 save でも REGISTRABLE は派生するので、backlog が複数 entry として現れる |

### 15.3 更新が要る authority / test

- docs: `TETO_DISCOVERY-3_PR-4b-A_Pool-Safety_Result.md`（D-1/D-2/D-3/OD-4b-A-2 を supersede と注記）、`PROJECT_HANDOFF.md`（contract 記述）、`TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`（target 選択規則の追記）。いずれも**実装 slice で更新**（本 PR では書き換えない）。
- unit/component: `DexOverlay.discovery.test.tsx`・`DexOverlay.hint.test.tsx`・`App.dexHint.test.tsx`・`discoveryHint.pool.production26.test.tsx`・`hintTarget.test.ts`・`discoveryHint.guards.test.ts`・`gameReducer.branchingPool.test.ts`。`pizzaSelect.promptCountGuard.test.ts` は**据え置き**。
- E2E: `discovery-dex-aggregated.spec.ts`（集約 card 前提→Research section 前提に書き換え）、`discovery3-pool2-production.spec.ts`。
- 新規 guard: Research UI の DOM に recipe 名・No.xx・総数（STRUCTURE 前）・`n/m`・`%`・残り・？ の個数が出ないこと（前監査の privacy gate 方式を流用）。

### 15.4 新 contract で受け入れる帰結

- 購入すると entry の有無が変わるため、「この材料を買うと recipe が完成するか」が購入の結果として分かる。購入は ladder で entitle された材料に限り Pitz がかかるので probe としては弱い（D9 の許容範囲）。
- 同一購入で 2 件登録された場合、「この材料は 2 つの recipe に入っている」ことが分かる（Step 12）。D9 で許容。

---

## 16. State machine

2 軸で表現し、production の 4 値は**置換しない**。

### 16.1 軸 1: `RecipeAvailabilityState`（既存・無改造）

`DISCOVERED > DISCOVERABLE > KNOWN_BUT_MISSING_MATERIAL > UNKNOWN`（入力: dex / owned / shop-entitled / inventory）。**「今作れるか」**。

### 16.2 軸 2: `RecipeResearchState`（新・派生のみ）

```
NONE ── (購入で REGISTRABLE が真に) ──▶ PROVISIONAL
PROVISIONAL ── (target 選択 or fact 購入) ──▶ RESEARCHING
PROVISIONAL / RESEARCHING ── (REGISTER_TO_DEX: matcher 完全一致＋gate) ──▶ DISCOVERED
NONE ── (starter のみ recipe 等が直接発見) ──▶ DISCOVERED
```
- `NONE`: 未発見 ∧ ¬REGISTRABLE（手がかりなし。UI には存在しない）。
- `PROVISIONAL`: REGISTRABLE ∧ 未発見 ∧ 追加 knowledge なし ∧ 現 target でない。
- `RESEARCHING`: REGISTRABLE ∧ 未発見 ∧（現 session target である ∨ 購入済み fact が unlock 以外にある）。差は **CTA 文言（「研究する」/「つづける」）のみ**で、機能差はない → 実装上は PROVISIONAL/RESEARCHING を 1 つにまとめても良い（表示の派生）。
- `DISCOVERED`: 軸 1 の `DISCOVERED` と同値（Dex が単一の真実）。
- **逆戻りしない**（ownership は減らず、Dex は discovered を落とさない）。stock 0 でも軸 2 は動かず、軸 1 だけが `KNOWN_BUT_MISSING_MATERIAL` に落ちる。

### 16.3 軸の直交関係（テスト化する不変条件）

| 軸 2 | 許される軸 1 |
|---|---|
| NONE | UNKNOWN / KNOWN_BUT_MISSING_MATERIAL / DISCOVERABLE（finite 0 件の recipe のみ DISCOVERABLE） |
| PROVISIONAL / RESEARCHING | **DISCOVERABLE / KNOWN_BUT_MISSING_MATERIAL のみ**（UNKNOWN は不可） |
| DISCOVERED | DISCOVERED |

- 実装は `researchState(recipe, inputs, session)` の pure 関数 1 本。reducer の state は増えない（session target のみ `GameState`）。
- 副作用の起点は 2 つだけ: 購入（`ownedIngredientIds` 増）、`REGISTER_TO_DEX`。どちらも既存。

---

## 17. Walkthrough 1: pesto-pollo / chicken（単一 entry）

**fixture（production data）**: `pesto-pollo` ＝ `pesto`(sauce, finite) ＋ `mozzarella`(cheese, starter) ＋ `fresh-tomato`(topping, finite) ＋ `chicken`(topping, finite)。key-free（KEY rung なし）。ladder Step 25 で `chicken` が解禁。前提: Dex に ladderCredit 発見 24 件以上、`pesto` と `fresh-tomato` は購入済み。**rung 構成・価格・family は production の事実**。**画面 copy は例示用**（最終 copy は未決）。

key-free の ladder（`hint5Ladder.ts` の key-free 分岐）:
`① SAUCE(10) pesto → ② CHEESE(10) mozzarella → ③ STRUCTURE(5) 総数4 → ④ SUB_CLASS① fresh-tomato(5) 🥬 野菜・きのこ系 → ⑤ SUB_CLASS② chicken(5) 🥩 肉系`
（topping の並びは catalog 順＝fresh-tomato → chicken）。

| # | player の行動 / 画面 | state |
|---|---|---|
| 1 | Shop でチキンを購入 | `ownedIngredientIds` に chicken 追加。REGISTRABLE(pesto-pollo) が偽→真 |
| 2 | feedback「🔎 新しいレシピの手がかりを発見！」[研究室を見る] | 差分検出のみ（保存なし） |
| 3 | Research Dex：「？？？ピザ／✓ チキンを使う／[このピザを研究する]」 | 名前・総数・slot 無し。entry 1 件 |
| 4 | [このピザを研究する] → picker なしで round 開始。帯「🔎 レシピ発見 ？？？ピザ ✓チキン」 | target 自動（1 件）。参照 pizza なし |
| 5 | 試作 1：例えばトマトソース＋モッツァレラ＋チキン＋たまねぎ → BAKE | |
| 6 | RESULT：🧪 オリジナルピザ／まだ新しいレシピは見つかっていません／試作#1 | ORIGINAL。✓/✕ なし、Notebook に記録 |
| 7 | [📓 試作ノート]：#1 のソース・のせたもの（前回なし）。帯「いまの研究対象：？？？ピザ」 | Notebook に target は付かない |
| 8 | [💡 ヒント] → 次 rung は SAUCE（10 Pitz）。購入 → board に「ソース：ペスト」 | `ing:pesto` ＋ `h5:sauce`。Research Dex に ✓ ペスト |
| 9 | 試作 2：ペスト＋モッツァレラ＋チキン＋たまねぎ → ORIGINAL。ノート「前回から ソース変更、…」 | 試作#2。まだ cheese/トッピング未知 |
| 10 | Hint：CHEESE（10）→ ✓ モッツァレラ。STRUCTURE（5）→「全部で4種類」 | `ing:mozzarella`/`h5:cheese`、`meta:ingredient-total`/`h5:structure`。entry に「全部で4種類」 |
| 11 | Hint：SUB_CLASS①（5）→ △ 🥬 野菜・きのこ系 | `cls:fresh-tomato`。**ここまでで player は 4 種のうち 3 つが ✓、残り 1 つが「野菜・きのこ系」と推理できる**（C(30,4) 的な探索空間が実質 1 topping 選びに縮む＝設計意図の「推理」） |
| 12 | （SUB_CLASS② chicken は derived `ing:chicken` により `ALREADY_KNOWN`＝0 Pitz で完了。購入しなくても進行に影響なし） | §9.2 の配線が前提 |
| 13 | 試作 3：ペスト＋モッツァレラ＋チキン＋たまねぎ（野菜）→ ORIGINAL。ノート：「前回から たまねぎ を追加…」ではなく別 topping への差し替え | 組み合わせ違い。分かるのは自分の履歴だけ |
| 14 | 試作 4：ペスト＋モッツァレラ（×2）＋フレッシュトマト（×2）＋チキン（×3）→ 完全一致＋Completion Gate PASS | NEW_DISCOVERY → `REGISTER_TO_DEX` |
| 15 | NEW PIZZA!「ペストポッロピザを発見しました！」図鑑 No.登録・Pitz・ladder は **`ladderCredit` 有り**（pesto-pollo は credit 対象。calabresa と違う） | entry は研究 section から自動で消える |
| 16 | 発見後 primary：研究中の entry が他にあれば「🔎 次のレシピを研究する」、なければ新材料があれば「🛒 新しい食材を見る」、なければ「📖 図鑑を見る」 | §13 |

注: 4 の ✓ チキンは unlock 由来。8〜11 の ✓/△ は Hint 由来。**attempt 由来の knowledge はない**（6・9・13）。9 でペストが ✓ になったのは Hint であって試作結果ではない。

---

## 18. Walkthrough 2: 複数 entry（Step 12 onion）

**fixture（production data）**: onion 購入で 2 recipe が REGISTRABLE になる（前監査の集計）。
- `pizza-portuguesa` ＝ tomato-sauce, mozzarella, **ham(key)**, egg, **onion**, black-olive
- `brazilian-calabresa` ＝ tomato-sauce, sausage, **onion**, black-olive, oregano（key-free）
共通: tomato-sauce / onion / black-olive。（以下、player-facing には hidden を一切出さない。上は設計者用。）

| # | player の行動 / 画面 | 備考 |
|---|---|---|
| 1 | Shop で玉ねぎを購入 → feedback「🔎 新しいレシピの手がかりを発見！」[研究室を見る] | 差分 +2 件。**件数は feedback に書かない**（「手がかり」と複数形ぼかし不要、「新しいレシピの手がかり」単数のまま）。Dex を開けば 2 枚あるので件数は結果として見える（D9） |
| 2 | Research Dex：「？？？ピザ ① ✓ たまねぎ」「？？？ピザ ② ✓ たまねぎ」 | 内容が同一でも番号で区別。① ② の割当は opaque tie-break（recipe の構造を反映しない） |
| 3 | HOME「レシピ発見」→ picker（2 件）→ ① を選択 | picker は ✓ のみ。名前・材料なし |
| 4 | round：帯「？？？ピザ ① ▾ ✓たまねぎ」。試作 1（玉ねぎ入り任意）→ ORIGINAL | RESULT は中立。attempt は ①②どちらの knowledge も変えない（**attribution 問題が存在しない**） |
| 5 | Hint（①）：ladder の次 rung＝①の recipe に固有の ladder。例: ① が portuguesa なら SAUCE（10）→ ✓ トマトソース | ladder は recipe ごと。② の fact は増えない。Hint は **選んだ ①にのみ**効く＝ambiguity が Target 選択で解ける |
| 6 | 帯を ▾ で ② に切り替え、Hint（②）：calabresa は key-free かつ cheese なしなので ladder は SAUCE → STRUCTURE → SUB_CLASS…（CHEESE rung は省略。`buildHint5Ladder` の key-free 分岐は applicable な rung のみ並べる） | **rung 構成が entry ごとに違う**（①は KEY/CHEESE rung あり、②は無い）。次の 1 rung しか見えないので購入前には漏れないが、購入後の履歴で差が見える。これは既存 ladder の性質で本設計は変えない |
| 7 | 試作で偶然 calabresa が完全一致（target は ① のまま）→ NEW_DISCOVERY（calabresa） | target 制限なし。②が消え、①は残る。target は ① のまま（①が消えていないため）。発見 RESULT の primary は「🔎 次のレシピを研究する」（① が残っている） |
| 8 | ① を発見すると entry は 0 件。primary は新材料があれば Shop、なければ図鑑 | |

**ambiguity の解消**: 同じ ✓ の 2 entry を区別するのは丸数字だけで、Hint の効く先は player が選ぶ。system は「どちらか」を決めない（OD-4b-A-2 の意図＝勝手に 1 件選ばない、を満たす）。hidden recipe 名は NEW_DISCOVERY まで出ない。

> 注: #6 の rung 構成は `hint5Ladder.ts` の key-free 分岐の静的読みで確認済み（実 reducer 動作は未確認）。

---

## 19. Minimal Vertical Slice

実コードを見た上で、前監査の 5 分割を一部組み替えた（Hint 配線は target 配線と不可分なため統合、rename は独立 slice として先頭に出す）。

| Slice | 内容 | production files（概算） | tests | E2E | save | mobile HV |
|---|---|---|---|---|---|---|
| **S0 rename（copy のみ）** | player-facing「フリークッキング」→「レシピ発見」。内部名 `FREE_COOK`/`freeCook` は不変。F-1 の副 CTA 名称修正。sandbox 時代 copy（`freeCook.ts`・`hints.ts:25`）整理 | `HomeScreen` `homeBubble` `PizzaSelectScreen` `GameScreen` `HintSheet` `DexOverlay` `ShopOverlay` `trialNotebookCopy` `ResultPanel` 〜10 | 文言 assert の追従〜10 ファイル | 21 spec の文言追従（挙動不変） | なし | 要（HOME/Dex 0/RESULT/Shop。360/390 の折返し） |
| **S1 pure domain**（unwired） | `REGISTRABLE`／`UNLOCK_FACT`／opaque ordinal／knowledge projection（exact・class・structure）／`researchState`／`postDiscoveryPrimary`／privacy guard（禁止語・数値パターン） | 新規 `logic/discovery/researchEntry.ts`（＋`hintTarget.ts` の `researchTargetId` option のみ） | 新規 3〜4 ファイル（不変条件 §16.3、production 27 recipe 全件で 4 状態の整合、Step 12 の 2 件、derive 単調性、禁止語 grep gate）。既存 `hintTarget.test.ts` 追加 | なし | なし | 不要（UI 無し） |
| **S2 Research Dex UI** | Dex 内 Research section・entry card・購入 feedback の差分検出・slot 偽装の再利用・集約 card 廃止 | `DexOverlay` `ShopOverlay`/購入 handler `App.tsx` 配線 新規 `ResearchEntryCard` | `DexOverlay.discovery/hint` `App.dexHint` 書き換え＋新規 | `discovery-dex-aggregated` 書き換え＋新規 1〜2（390/360 の overflow） | なし | 要（Dex・Shop feedback） |
| **S3 Target ＋ round 統合 ＋ Hint 配線** | 入口（HOME/picker/entry CTA）、`START_FREE_COOK` に target を渡す、`HintSession` の source `research`、PREPARE 帯、OPEN_POOL 文言差し替え、derived unlock fact の M3 配線（§9.2）、📓 dock 昇格 | `gameReducer`（START_FREE_COOK・ProgressionCarry）`discoveryHint` `hintTarget` `GameScreen` `HintSheet` `HomeScreen` `App.tsx` | reducer／hint 契約 test の更新（`branchingPool`・`guards`・`pool.production26`）＋新規（unlock 重複 0 Pitz、research source） | `discovery3-pool2-production` 書き換え＋新規（Step 12 の 2 entry→選択→Hint） | なし | 要（PREPARE 帯の高さ。390×844／360×800 で tray を押し下げない） |
| **S4 RESULT／Notebook／発見後** | 「研究試作」copy（byte 同一維持）、RESULT から Notebook を開く、Notebook 先頭の target 帯、`postDiscoveryPrimary` の配線、F-1 の行き先整理 | `ResultPanel` `originalResultCopy` `TrialNotebookSheet` `trialNotebookCopy` | `ResultPanel.*.test`・privacy byte-identical gate 更新、CTA 選択の表駆動 test | NEW/ORIGINAL RESULT の spec 追従＋新規 1 | なし | 要（RESULT NEW／ORIGINAL） |

- 依存: S0 は独立（先でも後でも可。先にやれば後続が新 copy で書ける）。S1 → S2 → S3 → S4。S1 は単独で merge 可能（unwired）。
- **No.28・Step 14・Grandma は不要**（pesto-pollo／Step 12 の既存 data で検証できる）。
- 切り離し（本 slice 群に含めない）: Notebook の永続化、Notebook 行への target 付与、試作回数に応じた無料 rung（§10 D）、stock 0 entry への Hint、COMPLETE 後の遊び場。

---

## 20. Owner Decisions（4 件）

コードから自然に決まるものは Owner Decision にしていない（例: attempt→knowledge 無し＝C2、保存ゼロ＝§14、target は session のみ・picker の「決めずに試す」＝§5、Notebook は帯のみ＝§8、ordinal の opaque tie-break＝§3.5）。

**OD-RX-1 — 仮登録 recipe の置き場所**
- 事実: Dex は既に「？？？」と Hint pin の置き場。HOME の CTA 枠は窮屈。独立画面は新 overlay＋navigation＋E2E が増える。
- 選択肢: A. Dex 内「🔎 研究中のピザ」section（**推奨**）／B. 独立 Research 画面。
- どちらでも入口は HOME「レシピ発見」と Dex の entry CTA の両方に残す。

**OD-RX-2 — Hint の方針（classification 中心にするか）**
- 事実（C1）: Hint 5.0 は SAUCE/CHEESE/KEY が**名前**、sub-topping のみ class。「チーズ系」「トマト系」は taxonomy に無く、新設は H5-INV と衝突。
- 選択肢: A. 現 ladder をそのまま使い、表示だけ ✓（名前）／△（class）に変換（**推奨**）／B. sauce・cheese の class（新 family）を新設して class 中心へ（taxonomy・H5-INV の再設計が必要）。
- 併せて確認: Owner の例示「△ チーズ系」は A では出ない。

**OD-RX-3 — unlock 以外の EXACT knowledge を発見前に取得可能にするか**
- 事実（§10）: すでに有料 SAUCE/CHEESE/KEY rung で exact を買える。attempt 経由は禁止。最後の sub-topping の exact は発見まで増えない。
- 選択肢: A. 現状（新 mechanic なし。**推奨**）／B. 検証操作／C. ladder 後半で exact 購入（class rung の意義が消える）／D. 試作回数で無料 rung（経済設計が別途必要）。
- 実質は A の確認。B/C は oracle・invariant と衝突。

**OD-RX-4 — 発見後 primary CTA を state-aware にするか**
- 事実（§13）: 現在は「もう一度じゆうに作る」固定。entry の有無・新材料の有無は既存 state から導出でき、新 state 不要。
- 選択肢: A. state-aware（entry が残る→次を研究／新材料→食材を見る／なし→図鑑。**推奨**）／B. 固定（次の研究へ）／C. 図鑑固定。
- 併せて決める: 優先 1（entry）と 2（新材料）の順（推奨は entry を上）。

---

## 21. この設計がしなかったこと / 限界

- 実装・test・build・E2E・screenshot・HV・preview deploy は未実施（docs-only）。copy・配置・pixel は全て例示で最終案ではない。
- walkthrough の rung 構成・価格・family は `hint5Ladder.ts` / `recipeHintRoles.ts` / `ingredientTaxonomy.ts` / `recipes.ts` の静的読みであり、実 reducer での動作確認はしていない。
- `derived unlock fact` を M3 の request-time 入力に足す配線（§9.2）が、`requestHint5Rung` の「pre-purchase view は既知 fact に依存しない」不変条件を壊さないことは、実装 slice（S3）の test で pin する前提であり、本 audit では静的読みの範囲。
- 172 recipe・35 candidate・Grandma は再監査していない。No.28・Step 14・Grandma・R6・IP-2 は触れていない。
