# 新調理工程の候補比較 — STEAM・FRY の次に何を足すか（docs-only、Issue #773）

作成: 2026-11-06 / 基準 `main` = `ed159e9`（#753）/ ブランチ `claude/teto-pizza-issue-773-nlyntr` / 枠: 並列計画の S6
性質: **調査と比較のみ。** 変更は本ファイル 1 つ。`src/**`・`e2e/**`・データ・テスト・既存の docs は触っていない。Issue / PR の作成、既存 PR への push、merge、共有 Preview 更新、Production ON は行っていない。
HV: docs-only のため対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
「推奨」は助言であり Owner Decision ではない。**Owner 承認前に実装しない。** 数値は【実測】【推論】【未確認】で区別する。

親資料（重複させない）: `TETO_COOKING-METHODS-AFTER-STEAM_Design-Audit.md`（STEAM の次＝揚げる、#749）、`TETO_COOKING-METHODS-NEXT_Research.md`、`TETO_COOKING-PROCESS-EXPANSION_Fresh-Audit.md`、`TETO_MULTI-SAUCE-RECIPES_Design-Lock.md`、`docs/design/TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`、`docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md`、`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`。#579 の設計資料 3 本は main に無く、ブランチ `claude/drizzle-579-design-gate-20261104`（`221f69d`）から読んだ（変更なし）。

---

## 0. 結論（先に）

1. **推奨: DRIZZLE（焼成後の液体の回しかけ、#579）を「次の新工程」にする。ただし「すぐ全部作れる」案ではない。** 新工程として実ピザに合い、STEAM・FRY・炙り・炒めと入力語彙と時機が違う候補は、これだけ【推論】。独立の試作 `#746`（Gesture Lab、CI 11/11 success、実機 HV 未実施）が既にあり、立ち上がりが最も短い。
2. **正直な制約（Owner が最初に理解すべき点）:**
   - **解放できる未出荷レシピは 0**（DRIZZLE が必須で、代替では足りない行は確認できた範囲で 0【実測】、#579 の第 1 回監査と同じ）。増えるのは「既存レシピの遊び」であり、レシピ数ではない。
   - **ゲームへの統合は全スライスが Owner Gate 付き**（保存・在庫・採点・識別の設計が未決）。「最も実装しやすい」のは**独立の純粋層 D1（新規ファイルのみ）まで**で、それ以降は直列で待ちが多い。
3. **レシピ数を増やす目的なら、新工程ではなく「データ系の線」が効く**（別 Issue を乱立せず既存に紐づける。§6）:
   - 0 新食材で解放できる行: **生地の種類 5 行**（`piadina-romagnola` READY、`ny-style`・`argentine-napolitana`・`cauliflower-crust`・`fathead` が REVIEW）【実測】→ #577 の線。
   - 複数ソースは**機構が出荷済み**（`grandma-pizza` が 2 ソース）。残りは `burrata` などの食材待ちの Batch 系 → 工程ではない。
4. **除外した候補（§2）:** MULTI_SAUCE（機構は出荷済み、残りはデータ）、PREP「炒め」（Phase 1B が main にあり、残りは Production ON と食材の判断）、DOUGH_VARIANT（既存の DOUGH 工程のデータ差で、操作が変わらない）。比較に残すが採点で下位: ZONED、PAN_BAKE。
5. **判断が割れる点:** 採点では DOUGH_VARIANT（61 点）と DRIZZLE（59 点）がほぼ同点（§5）。差は「新しい工程か」「操作が変わるか」の定義で決まるため、**Owner の目的（新しい遊びか、レシピ数か）が最終判断**（OD-N1）。

---

## 1. Fresh Audit（STEP 0）

### 1.1 確認範囲
| 区分 | 読んだもの | できなかったこと |
|---|---|---|
| 規則 | `CLAUDE.md`、`SESSION-OPERATIONS_1.0`（全文）、`PROJECT_HANDOFF.md`（先頭 200 行、現況は信用せず main のコードを正とした）、`scripts/ops/hot-files.json` | HANDOFF 全 1147 行、HV Policy 全文 |
| 既存資料 | 上の親資料のうち、AFTER-STEAM 全文、FRY F1 Result 冒頭、PROCESS-EXPANSION 前半、Design-Gate_Draft 全文、Decision Brief、#746 の Result 冒頭と `drizzleLab.ts` の公開定義 | STEAM の Plan／S3 Design、PIADINA ゲートの §5〜7 の詳細、MULTI-SAUCE S3 監査の全文 |
| コード（読み取り） | `recipes.ts`／`ingredients.ts` の機械走査、`doughKind.ts`、`pinsaGate.ts`、`src/logic/fry/**` の一覧 | アプリ実行・テスト実行・実機操作（**未実施**。`node_modules` なし） |
| 172 マトリクス | `rows` 172 件の `requiredCapabilities`・`productDecisionStatus`・`ingredients`・`dough`・`blockers` | pizzadb.jp 原典（**原典未確認**） |
| GitHub | open PR 一覧、#773・#749・#726・#579・#696・#532 の本文／コメント、#746 の変更ファイル | #521・#577・#620・#611・#604・#621・#538 のコメント全文（本文の要約のみ） |

### 1.2 現状（main `ed159e9` ＋ open PR）
| 工程 | 状態 | 出典 |
|---|---|---|
| 蒸す（STEAM） | S1・S2 は main。S3 UI は **#738（open、HV 待ち）**。HOT 3 ファイル＋`src/main.tsx` を追加で編集。claim 〜11/13 | #726 コメント |
| 揚げる（FRY） | **F1 のみ main**（`src/logic/fry/**`、未配線）。F2 以降 HOLD。`eggplant` に専用の絵が無く休眠。claim 〜11/18 | #749、`FRY_PHASE1_F1_Result` |
| 炒める（PREP） | Phase 1B が main、`PREP_EXPERIENCE_PRODUCTION=false`。beef のみ | #696 |
| 炙り（Sear） | 本番 ON、sausage のみ | `searExperienceGate` |
| 後乗せ（FINISH） | 本番 ON、late レシピ出荷済み。**topping のみ**（液体は不可）。Free／Research は恒久タブ | `finishEngine.ts`、#579 |
| 複数ソース | `grandma-pizza` が `recipes.ts` にあり、2 ソース（tomato-sauce＋olive-oil）の最初のレシピ【実測】 | `recipes.ts` |
| 天板（四角い生地） | `panShape` と `grandma-pizza` の `panShape: "square"` が main【実測】。Epic #532 は open | `recipes.ts`、#532 |
| 生地の種類 | `DoughKind` は 2 値（`standard`／`material-multigrain-long-ferment`＝Pinsa）、`PINSA_PRODUCTION = true`【実測】。Piadina は設計ゲート HOLD | `doughKind.ts`、`pinsaGate.ts` |
| DRIZZLE | 独立の Lab **#746（open）**。ゲーム統合は HOLD。設計資料は別ブランチ | #579 |

**Issue 本文との差（要確認）:** #773 の表は `#532 Epic（HOLD）`・`PR #540（Grandma、HOLD）` とするが、`grandma-pizza` と `panShape: "square"` は main に既にある【実測】。#540 の HOLD は古い可能性がある（PR／Issue の状態の突合は未実施）。この比較では「機構は出荷済み」として扱う。

### 1.3 claim と重なり（`SESSION-OPERATIONS` §1）
| 対象 | 既存 claim／PR | 本作業との関係 |
|---|---|---|
| #773 | `session_013m8Cb5...` が 2026-11-06 に claim（`docs/reports/TETO_NEW-PROCESS_*`、branch `claude/teto-pizza-parallel-plan-sh894e`、〜11/20） | **同じ新規ファイル群**。本セッションは別 branch で同じ枠を担当するため、重なりを #773 の claim コメントに明記（§8） |
| #726 / #738 | HOT: `App.tsx`・`GameScreen.tsx`・`PizzaStage.tsx`・`src/main.tsx` | 本作業は docs のみ。**実装の順序**に影響（§7） |
| #749 / FRY | `src/logic/fry/**` ほか。`gameReducer.ts`・`GameScreen.tsx` 等は F2 以降の予定で未 claim（コメントで「編集しない」と明記） | 同上 |
| #579 / #746 | #746 は `src/main.tsx` と `src/preview/*` のみ。#579 第 1 回監査の claim は 11/03 に失効 | 推奨案の前提 |
| #696 / #532 / #577 / #521 | #696 の claim は release 済み（11/05 期限）。#532 は claim なし | 重なりなし |

---

## 2. 候補の分類と除外（STEP 4 を先に）

| 候補 | 既存の追跡 | 判定 | 理由 |
|---|---|---|---|
| **A. POST_BAKE／DRIZZLE** | #579、PR #746、#604、#611、#621 | **比較に残す（推奨）** | FINISH は液体非対応【実測】。独立工程として未実装 |
| **B. MULTI_SAUCE** | #521、PR #540、#620 | **除外**（工程ではなくデータ） | 2 ソース機構は出荷済み。残る行は食材待ち。→ Batch 系（#748 系）へ |
| **C. ZONED** | #620、quattro-stagioni | 比較に残す | 工程として未実装。ただし識別軸の変更が大きい |
| **D. DOUGH_VARIANT** | #577、`PIADINA-577_DESIGN-GATE` | **除外**（既存工程のデータ差）。ただし採点は参考に併記 | 操作が変わらない（マトリクスの「同じジェスチャのデータ選択」）。目的が「新工程」なら対象外、「レシピ数」なら最有力 |
| **E. PAN_BAKE** | #532 Epic、#538 | 比較に残す（下位） | 四角い天板は出荷済み。残りは別の天板形状で、生地の種類とセット |
| **F. PREP「炒め」** | #696、`COOKING-PREP_PHASE1_SPEC` | **除外**（既存工程と重複） | Phase 1B が main にある。残りは Production ON・食材（`yakiniku-sauce`）・#691 の判断 |
| （参考）FRY_COOK／揚げ生地 | #749 Phase 2（F6） | **除外**（#749 の線） | `pizza-fritta` の 1 行のみ。FRY の Owner Gate で扱う |

---

## 3. 実ピザとの整合（STEP 2）

| 候補 | 実ピザでの位置づけ | 評価 |
|---|---|---|
| A. DRIZZLE | 焼き上がりへのオリーブオイル、ホットハニー、バルサミコ、トリュフオイル、チリオイルの回しかけは定番の仕上げ【推論・一般知識】。マヨは日本のピザでは焼成前が普通で、現行どおり焼成前の 1 ストロークで足りる | ◎ |
| C. ZONED | 半々・四季（quattro stagioni）は実在。実際は「領域ごとに別の具」 | ○ |
| D. DOUGH_VARIANT | 生地の違い（薄・厚・平パン）は実在し、工程の差は発酵・延ばし方 | ◎（ただし操作に出ない） |
| E. PAN_BAKE | 天板焼きは実在（シチリア風、デトロイト風ほか）。形状・敷き込み・縁チーズが違う | ○ |

原典の「投入時機」は**未確認**（pizzadb.jp に到達できない）。DRIZZLE の時機が焼成後と記録された行は、第 1 回監査で 5 行（液体・ペースト）【実測】で、その代替（焼成前 PAINT、粒状 topping）で足りると判定されている。

---

## 4. 解放レシピ数（マトリクス実測・別名補正後）

172 行のうち、`recipes.ts` の id と一致するものを出荷済みとして除き、**未出荷 97 行**（別名補正の前）。さらに `margherita`・`marinara`・`bbq-chicken`（出荷名 `bbq-chicken-pizza`）は別名で出荷済みのため補正し、**約 94 行**【実測＋概算。別名の取りこぼしは残る可能性がある】。内訳: `READY` 16／`READY_WITH_REVIEW` 13／`BLOCKED_PRODUCT_DECISION` 68。

| 候補 | その能力を要求する未出荷行（単独＋併用） | うち新食材 0 で、BLOCKED でない行 | 備考 |
|---|---|---|---|
| A. DRIZZLE（POST_BAKE 液体） | 0（必須の行なし）。近いのは `hot-honey-pepperoni`（REVIEW、`honey` 新規＋複数ソース）、`buffalo`（BLOCKED） | **0** | 解放ではなく「遊び」 |
| B. MULTI_SPREAD_LAYER（参考） | 15（併用含む） | `sfincione`（REVIEW）**1**。`burrata` を足せば `crudaiola`・`burrata-pizza`・`pesto-burrata` で +3 | 工程ではなく Batch 系 |
| C. ZONED | 1 | `quattro-stagioni`（READY）**1** | 識別軸 `zones` が UNAVAILABLE |
| D. DOUGH_VARIANT | 31（併用含む）、単独 18 | `piadina`（READY）、`ny-style`・`argentine-napolitana`・`cauliflower-crust`・`fathead`（REVIEW）**5** | 全て原典未確認 |
| E. PAN_BAKE | 8（全て DOUGH_VARIANT などと併用） | **0**（`montreal`・`new-england-bar`・`al-taglio` は NOT_REPRESENTABLE） | |
| F. PREP | 3 | `yakiniku-pizza`（READY）だが新食材 2 | 除外 |
| （参考）FRY_COOK | 1 | `pizza-fritta`（READY、新食材 0、NOT_REPRESENTABLE） | #749 の線 |

---

## 5. 採点（STEP 5、助言）

0〜5 点を付け、重みを掛けて 100 点満点に換算。重みは本書の仮置き（OD-N1 で変えてよい）。楽しさ・難易度は**設計上の見込みで実測ではない**。

| 基準（重み） | A. DRIZZLE | D. DOUGH_VARIANT（参考） | E. PAN_BAKE | C. ZONED |
|---|---|---|---|---|
| 実ピザ整合（15） | 5 | 5 | 4 | 4 |
| 操作・楽しさ（既存 4 法との差、iPhone 適性）（25） | 4 | 1 | 2 | 3 |
| 解放レシピ／体験の広がり（10） | 2 | 4 | 2 | 1 |
| 実装容易性（既存基盤、Owner Gate の数）（25） | 2 | 4 | 2 | 1 |
| 干渉の少なさ（HOT／claim）（15） | 2 | 3 | 2 | 2 |
| 安全（保存・採点・識別・Anti-Oracle）（10） | 2 | 2 | 3 | 1 |
| **合計（100）** | **59** | **61** | **48** | **42** |

読み方:
- **A と D はほぼ同点。** D は「操作が変わらない」ため新工程の目的から外れる（§2）。A は「容易性」が低いが、**D1 を単独で見ると容易性 4・干渉 4**（新規ファイルのみ）に上がり、70 点台になる【推論】。
- ZONED は識別の `zones` 軸（UNAVAILABLE → OBSERVED）の変更が重い。E は生地の種類との同時設計が前提。今は着手しない。

---

## 6. 推奨工程 — DRIZZLE（仕上げの回しかけ）の設計

### 6.1 プレイヤー体験（案、PROVISIONAL）
- **場所**: FINISH（焼成後）の中。新タブなし（タブ上限 6 は 11 レシピが使い切り、PREPARE の縦余白は 0px【既存監査】）。Free Cooking／Research が先、Lunch Rush・Dinner は除外。
- **操作**: 焼き上がったピザの上を**指でなぞって細い線を引く**（#746 の既存契約: pointer capture、2 本目の指は無視、座標は生地の縁にクランプ、1 ストローク最大 160 点／全体 24 本）。**タップ代替**は短い斜めの線（点ではない）。キーボード代替は D5 で別途。
- **手掛かり**: 線のつや・太さ・広がり（色ではなく「線そのもの」）。ゆっくり引くほど太く溜まる、速いと細い、という注ぎの速さの表現は HV で試す案（#746 は固定幅【実測】、速度→太さは**未検証**）。
- **失敗状態なし**（STEAM・FRY・炙りと同じ方針）。量が多い・少ないの扱いは OD-DZ-3（消費単位）と採点の決定に従う。
- **既存 4 法との差**: STEAM＝殻が開く出来事、FRY＝泡の大きさ、炙り＝長押し＋色、炒め＝タップ時刻。DRIZZLE は**時機が焼成後で、描線が成果物そのもの**。ただしソース塗り（長押し＋ドラッグ）とジェスチャは近いので、HV で「ソースと同じに感じない」ことを確認する（§6.6 HV-3）。

### 6.2 食材・レシピ
- 新食材・新レシピは**要らない**（D1〜D4）。最初の液体は OD-DZ-1 で決める。候補の比較:

| 液体 | 既存か | 利点 | 懸念 |
|---|---|---|---|
| `olive-oil` | 既存の `sauce`（`PAINT_TEMPORARY`、焼成前に使用） | 新食材 0。定番 | 焼成前の用途と**識別が重なる**（`sauceBase` か late か）。Owner 判断 |
| `honey` | **未存在**（マトリクス 3 行が要求） | ホットハニーなど後がけの代表 | 新材料＋ラダー step が要る（`recipes.ts`・`ingredients.ts` は HOT、Batch 系） |
| `mayo` | 既存の `topping`（B13、焼成前 1 ストローク） | 既に絞る操作がある | 焼成後の `trail` は FINISH で無効【実測、#579】 |

- **推奨（助言）**: D1〜D4 は食材を抽象 id で作り、最初の実液体は `olive-oil`（新食材 0）。ただし識別の重なりは OD-DZ-1／OD-DZ-6 の答えが先。

### 6.3 データモデルと干渉（#579 の Decision Brief に沿う）
| 案 | 判定 |
|---|---|
| A: `sauceIds` に混ぜる | 却下（焼成前ソースと誤認、在庫の早払い、識別混乱） |
| B: `stage:"post"` の topping | 避ける（ピースと連続液体の意味が違う） |
| **C: 独立の `postBakeLiquids`** | **設計候補**（未承認）。`PizzaState` と `pendingRound` の journal に追加。保存互換・在庫の原子性・識別／採点の 3 ゲートが要る |

### 6.4 触るファイル（予定）と競合
| スライス | 主に触る | HOT／claim との競合 |
|---|---|---|
| D1 純粋層 | `src/logic/drizzle/**`、`src/data/drizzleExperienceGate.ts`（新規） | **なし**（新規のみ）。#746 の幾何（`src/preview/drizzleLab.ts`）は import せず、必要なら移設を #746 の決着後に別 PR |
| D2 journal | `src/state/pendingRound.ts`、`persistence.ts`（HOT） | #738・FRY F2 と同時に触らない |
| D3 在庫の原子性 | `inventory.ts`、`pendingRoundSettle.ts`、`finalizeRound.ts` | 同上 |
| D4 採点／識別 | `scoringV2`、`signature.ts`、Reference | Research／Hint／DH4 の再 audit が連動 |
| D5 UI | `GameScreen.tsx`・`PizzaStage.tsx`・`App.tsx`（HOT）、`FinishLiquid*.tsx`（新規） | **STEAM #738・FRY F3 と同じ HOT**。直列にする |
| D6 | 展開 | Owner Gate |

### 6.5 保存・採点・識別
D1 は何も読まず何にも書かない（未配線、`DRIZZLE_EXPERIENCE_PRODUCTION = false`）。D2 以降は #579 の 3 ゲート（保存互換、在庫の原子性、採点／識別）を**全て通すまで**本番に出さない。Scoring 2.0 の重み（52/16/12/20）は変えない。

### 6.6 HV 項目（Owner、実機 Safari、WebKit CI は代替にならない）
1. #746 の描線が 390×844／360×800 で画面外へ出ず、ホームバーと干渉しない。
2. 指で線が隠れない。連続で引いても疲れない。タップ代替で同じ結果になる。
3. **ソース塗りと同じに感じない**（Owner の主観）。
4. 描いたあとの reset／やり直しで元に戻る。
5. 速度→太さの表現を入れる場合、入れた方が分かりやすいか。

---

## 7. 実装順（Owner 判断を除いた技術順）

```
#738 STEAM S3（Owner HV・merge）─┐
                                 ├→ #749 FRY F2（reducer）→ F3（UI）
#746 Gesture Lab（Owner 実機 HV）┘
        ↓（HV の結果）
DRIZZLE D0: Owner 判断 OD-DZ-1..7（§9）
        ↓
D1 純粋層（新規のみ。#738／FRY と並行可）
        ↓
D2 journal → D3 在庫の原子性 → D4 採点／識別   ← FRY F2 の後（gameReducer・persistence の同時編集を避ける）
        ↓
D5 UI ← FRY F3 の後（GameScreen・PizzaStage・App の HOT）
        ↓
D6 Owner Gate（展開）
並行（HOT 無関係）: #577 の次の生地の種類（Piadina）、Batch 19（`burrata`）
```
- **今すぐ、ほかの claim と重ならずに始められるのは D1 だけ**。それも D0 の Owner GO（OD-N1、OD-DZ-1、OD-DZ-2）が前提。
- 同時に進める実装 PR は上限 2 件（#696 の 11/04 コメント）。現在 #738・#746 が HV 待ちで、**新規実装の開始は Owner の枠判断が先**。

---

## 8. 実装担当向け Issue 案（**起票しない**。#579 への追記案）

新規 Issue は作らない。#579 に次を追記するか、Owner が D0 後に同じ Issue を再利用する（#696 と同じ流儀）。

### 8.1 タイトル
`D1: 純粋層（postBakeLiquids の型・幾何・サニタイズ、未配線・本番 OFF、Refs #579 #746）`

### 8.2 目的
FINISH の液体の回しかけ（DRIZZLE）の**純粋ロジック**を新規ファイルだけで作る。ゲーム・UI・reducer・保存・在庫・採点・識別には接続しない。

### 8.3 前提（開始条件）
- Owner が OD-N1（推奨工程）と OD-DZ-1（最初の液体）・OD-DZ-2（データモデル C）に答えている。
- 最新 main、`CLAUDE.md`、`PROJECT_HANDOFF.md`、`SESSION-OPERATIONS` を読み、Duplicate Gate と claim を再確認。#738・#749・#746 の HOT 編集と重ならない。
- claim: `files` = `src/logic/drizzle/**`、`src/data/drizzleExperienceGate.ts`、`docs/reports/TETO_COOKING-DRIZZLE_D1_*`。期限は 14 日以内。

### 8.4 範囲（新規ファイルのみ）
| ファイル | 内容 |
|---|---|
| `src/data/drizzleExperienceGate.ts` | `DRIZZLE_EXPERIENCE_PRODUCTION = false`、`drizzleExperienceEnabled()` |
| `src/logic/drizzle/postBakeLiquid.ts` | `PostBakeLiquid = { id; ingredientId; trail; stage: "post" }`（Decision Brief の草案、未承認）。上限（点数・ストローク数）は定数で PROVISIONAL |
| `src/logic/drizzle/trail.ts` | クランプ、距離による間引き、長さ、タップ代替の線（#746 の契約と同値） |
| `src/logic/drizzle/sanitize.ts` | 保存・journal 向けの有限値・上限・unknown の拒否（書き込み側は D2） |
| `src/logic/drizzle/*.test.ts`、`drizzle.architecture.test.ts` | 単体、独立性・未配線・非読取りの固定 |
| `docs/reports/TETO_COOKING-DRIZZLE_D1_Result.md` | Result |

### 8.5 受入条件
1. 既存ファイルの変更ゼロ。どこからも import されない（`rg` で固定）。
2. `DRIZZLE_EXPERIENCE_PRODUCTION = false`。本番バンドルに `drizzle` 由来の文字列が入らない（#746 のゲートと同じ流儀）。
3. 純粋・決定的（乱数・実時間・DOM を使わない）。非有限・負・範囲外の入力は安全側に丸める。
4. タップ代替の線は点にならない（#746 と同値）。1 ストロークの点数・全体の本数の上限を超えない。
5. `logic/scoringV2/**`・`pitzReward.ts`・`state/**`・STEAM／FRY／炒め／炙りのファイルから import されず、それらを import しない（architecture test）。
6. Vitest（新規）・`tsc -b`・oxlint・build が通る。件数を実測で報告。
7. HV 動画は対象外（UI／操作が変わらない純粋ロジックのみ、HV Policy §2）。Result Report に理由を書く。
8. merge・共有 Preview 更新・Production ON はしない。

### 8.6 D2 以降の受入条件（別 Gate）
#579 Decision Brief の 3 ゲート（保存互換: 旧 v2 save が欠落＝空で読める、journal の byte 上限、unknown／future schema を上書きしない／在庫: 適用と債務を 1 回の永続遷移で記録、再試行・HOME 離脱・リロードで二重請求・無償取得なし／採点・識別: 焼成前ソースと混ざらない、PAINT／NO_SAUCE と共存）を**スライスごと**に満たす。

---

## 9. Owner 判断表（1 回にまとめて提示、各 助言つき）

| ID | 論点 | 助言 |
|---|---|---|
| **OD-N1** | 次の新工程の目的: 「新しい遊び」か「レシピ数」か | 新しい遊び → **DRIZZLE**。レシピ数 → 新工程ではなく #577（生地の種類 5 行）と Batch 19（`burrata`） |
| OD-N2 | 並列の枠: #738・#746 の HV が済む前に D1 を始めてよいか | D1 は新規ファイルのみで HOT と重ならない。ただし枠上限 2 件の判断は Owner |
| OD-N3 | #579 の保留推奨（第 1 回監査）と 11/04 の Lab 承認の整合 | Lab は承認済み。ゲーム統合は「保留」のまま D0 の判断まで進めない |
| OD-DZ-1 | 最初の液体と使い道（新食材を作らない前提） | `olive-oil`（新食材 0）。ただし識別の重なりは OD-DZ-6 と同時に決める |
| OD-DZ-2 | データモデル | 独立 `postBakeLiquids`（C）。A は却下、B は避ける |
| OD-DZ-3 | 消費単位（1 ストローク／1 回の適用／1 食材） | 1 回の適用（最後の 1 本まで 1 単位）。在庫の原子性に直結 |
| OD-DZ-4 | タップ代替の形（短い線か点か） | 短い線（#746 実装済み） |
| OD-DZ-5 | 採点・Reference・#495 の仮判定 | 重みは変えない。最初は採点に読ませない（体験のみ）案を比較 |
| OD-DZ-6 | late の識別軸に液体を入れるか | 最初は入れない（体験のみ）を推奨。入れる場合は Hint／DH4／Research の再 audit が要る |
| OD-DZ-7 | 公開範囲 | Free／Research のみ。Dinner／Lunch Rush は OFF |
| OD-N4 | 原典（pizzadb.jp）で後がけの時機を確認するか | ChatGPT 側の調査へ引き渡す（`SESSION-OPERATIONS` §8-2）。未確認のまま確定しない |

「#738 merge の前に D2 以降へ進まない」「Production ON・共有 Preview 更新・merge は Owner の別承認」は判断表ではなく固定条件。

---

## 10. 未確認事項
- 楽しさ・疲労・速度→太さの効果は設計上の見込みで、実測していない（#746 の実機 HV 未実施）。
- 出荷済み／未出荷の対応は id 一致＋3 件の別名補正で、別名の取りこぼしがありうる。マトリクスは 2026-09 作成で、pizzadb.jp 原典は未確認。
- `grandma-pizza` が Production で公開されているか（公開ゲートの有無）は確認していない。`recipes.ts` に定義があることのみ【実測】。
- #521・#577・#538・#620・#604・#611・#621 のコメント全文、PIADINA ゲート §5〜7 の詳細は読んでいない。
- リストにない工程（発酵・寝かせ、チーズを削る、混ぜる／和える）は本書では評価していない。混ぜる（P-MIX）は `PROCESS-EXPANSION_Fresh-Audit` §3 に既存の整理がある。

## 11. 禁止事項の遵守
`src/**`・`e2e/**`・データ・テスト・既存 docs の変更なし／新規ファイルは本書のみ／既存 PR（#738・#746・#749・#756・#757・#762・#763）への push なし／merge・共有 Preview 更新・Production ON なし／新規 Issue・PR の作成なし（claim コメントのみ、§1.3）。
