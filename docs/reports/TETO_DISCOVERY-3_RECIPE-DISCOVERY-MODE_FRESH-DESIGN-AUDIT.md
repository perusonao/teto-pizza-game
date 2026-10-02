# Discovery 3.0 — FREE COOKING → RECIPE DISCOVERY Fresh Design Audit（DESIGN AUDIT / DOCS ONLY）

- audited main: `262b09fcb78d98c7b12ea4e5b51c2da1bca9d37e`（`origin/main` を fresh fetch。latest known main と一致、進んでいない）
- 種別: 設計監査のみ。実装・Issue・PR なし。FREE COOKING は削除しない。No.28 は選ばない。Step 14 / Grandma は決めない・再監査しない。R6 / IP-2 へ進まない。
- 再利用した既存成果物（再実行なし。事実の引用のみ）: Branch Placement Decision Audit（`db956ee`）の A/B/C 型・Step 1〜25 placement・OD-BRANCH-1..5。First C-Step shortlist（`7df9419`）は「Step 12 のみ READY」の確認にだけ使用。Grandma は未参照。
- authority の読み方: 以下の事実は production code（`src/…:行`）で確認したもの。docs は補助。コードと食い違う箇所は §0 に明記。
- 一時 probe は read-only の grep / sed のみ。commit していない。test / build / E2E / screenshot / HV は未実施（docs-only のため不要）。

---

## 0. 先に伝えるべき訂正（Owner 案の前提と production の差）

Owner 案の問題意識は概ね正しいが、**前提 2 点が production と違う**。ここを誤ると監査全体の方向が変わる。

| # | Owner 案の前提 | production の事実 | 根拠 |
|---|---|---|---|
| P1 | `HOME → FREE → Pizza Select → PREPARE` | **FREE は Pizza Select を通らない。** HOME「フリークッキング」は `START_FREE_COOK` を dispatch し、recipe 未選択のまま直接 GAME/PREPARE に入る。Pizza Select は HOME「ピザを作る」の先にある**別の入口**（既知 recipe を作り直す guided round） | `App.tsx:1011-1014`（`handleStartFreeCook`）、`App.tsx:963-965`、`HomeScreen.tsx` の `onStartFreeCook` 注記 "no recipe selection" |
| P2 | 「OPEN_POOL なのに既知 recipe card を選ばせる構造が Discovery loop と矛盾」 | Pizza Select は **DISCOVERED の recipe だけ**を card にする（W1 以降）。未発見は名前・preview・材料・鍵・card いずれも出さず、章見出しの「発見 x/m」だけ。したがって「発見ループの中で既知 card を選ばせる」構造は**現在存在しない**。矛盾に近いのは別の 2 点（下記 F-1/F-2） | `pizzaSelect.ts` `buildPizzaSelectView`、`PizzaSelectScreen.tsx` ヘッダ注記 |

そのうえで、**実在する不整合**は次の 3 点（Owner 案の問題意識を支える事実）:

- **F-1**: FREE の RESULT の副 CTA は「**レシピを選んで作る**」で、押すと Pizza Select（＝発見済み recipe の guided 調理）へ行く。発見ループの出口なのに、行き先は「既に知っているピザを作り直す画面」。名称が行き先を表していない（`ResultPanel.tsx:210-214`、`App.tsx` の `onBackToPizzaSelect`）。
- **F-2**: mode の名詞が「フリークッキング」なのに、周辺 CTA は既に「**〜で探す**」「**まだ見つけていないピザが…**」と発見語彙で書かれている（`HomeScreen.tsx:174`、`PizzaSelectScreen.tsx:100-114`、`DexOverlay.tsx:75,95`、`homeBubble.ts`）。**名前だけが目的とずれている。**
- **F-3**: FREE の「自由」は**成果物として何も残らない**。ORIGINAL（未一致）pizza は score なし・Dex 書き込みなし・Pitz 0（`gameReducer.ts:1189-1210`、`freeCook.ts` ヘッダ）。残るのは在庫消費（成功・失敗・ORIGINAL を問わず `consumePizzaInventory`）とセッション内の試作ノートだけ。

さらに**用語の三重衝突**がある。「FREE」は 3 つの別概念に使われている。rename の影響範囲を見誤らないための注意:

1. `mission.mode === "FREE"`: 「Lunch Rush 実行中でない」アプリ状態全体（`lunchRush.ts:189,310`、`App.tsx:861,1253`）。Dex・Pizza Select・guided round もこれに含まれる。
2. `GameState.freeCook` / `roundKind === "FREE_COOK"`: 発見 round（本監査の対象）。
3. UI 文言: 「フリークッキング」「フリープレイ」（ORDER の CTA、`GameScreen.tsx:786`）「じぶんのピザ」「フリープレイへ」（`MissionResultOverlay.tsx:128`）。

---

## 1. STEP 1 — 現 FREE（`FREE_COOK` round）の責務マップ

分類: **A** Discovery 専用 / **B** sandbox 性（発見に使われるが、本質は自由組成） / **C** 共通（他 mode も使う） / **D** legacy・不要候補。

| 責務 | 現状（production） | 分類 |
|---|---|---|
| HOME 入口 | `HomeScreen`: Dex 0 では「フリークッキングで探す」が primary（2+1 skeleton の下段、Lunch Rush は disabled）。Dex ≥1 では secondary「フリークッキング」 | A |
| Pizza Select | **FREE の責務ではない**（P1）。guided 調理（発見済みのみ）。未発見への導線 prompt card が FREE へ戻る | C（FREE と相互参照） |
| round 作成 | `START_FREE_COOK` → `startFreeCook` → `buildOrderState(FREE_COOK_ORDER, …, freeCook=true)`。`roundKind: "FREE_COOK"`。recipe は sentinel `FREE_COOK_RECIPE`（`requiredIngredients: []`、id は `RECIPES` 外） | B（recipe-free の骨格） |
| recipe target | **なし**（sentinel）。ヒント側が pool から target を決める（`selectHintTarget`） | A |
| 調理 interaction | PizzaStage / tray / BAKE は guided と共通。差分: 全所持材料を提示、reference 非表示、generic bake window（`FREE_COOK_BAKE_TARGET`＝既存 recipe の中央値） | C |
| matcher | `resolveFreeCookPizza`: ① recipe-free completion ② `evaluateDiscovery`（signature 完全一致）③ 一致 recipe 自身の completion gate（"recipe" policy）。結果 FAILED / MATCHED / ORIGINAL | A |
| discovery 登録 | `REGISTER_TO_DEX`（`registersToDexAtResult`: GUIDED と FREE_COOK）。MATCHED のみ recipe として scoring・Dex・Pitz | A（登録経路は C） |
| result | NEW PIZZA 発見 variant / ALREADY_DISCOVERED / ORIGINAL（near-miss note・「図鑑のピザと同じ組み合わせで作ると発見」note） / FAILED | A（FAILED 表示のみ C） |
| reward | 発見時のみ Pitz（recipe base × 品質 + 初回発見 bonus + 手際）。ORIGINAL/FAILED は 0 | C（式は共通）。**FREE 固有の報酬はない** |
| inventory 消費 | `CONFIRM_BAKE` が成功・失敗・ORIGINAL を問わず消費（`gameReducer.ts:1189-1210`）。発見は「各材料 1 個以上」で足りる（Issue #215 OD-5） | C |
| Hint | FREE のみ sheet を開く（`SHOW_HINT` は `state.freeCook` 分岐）。guided は operational line。Hint 5.0 ladder は **production default ON**（`hint5Flag.ts` `HINT5_LADDER_PRODUCTION_DEFAULT = true`。`discoveryHint.ts` ヘッダの「off in every build」は stale）。Dex 0 + Margherita のみ free Hint 2.0 reveal | A |
| Trial Notebook | session-only（reload で消える。`NOTEBOOK_COPY.sessionOnly`、persistence に項目なし）。入口は **Hint sheet 内のみ** | A |
| Pantry（食材庫）/ hand | `isLargeCatalogEligible` = `roundKind === "FREE_COOK" && dinner === null`。**FREE 専用**（LC OD-1） | A |
| Shop | mode 非依存。購入 feedback に「フリークッキングで使ってみよう」 | C（文言のみ A） |
| Dex | mode 非依存。`？？？` card の CTA が FREE へ（`mission.mode === "FREE"` のとき）。hint pin も FREE round を開く | C |
| progression | ladder は Dex の ladderCredit 発見数のみ参照（`discoveryLadder.ts`）。mode 非依存。Lunch Rush は「1 件発見」で解放 | C |
| persistence | `freeCook` / `roundKind` / `preDiscoveryFreeCookAttempts` / notebook / hint session は**いずれも save されない**。保存されるのは dex・inventory・ownership・Shop entitlement・hint purchase/facts・Pitz | — |
| analytics 相当 | `src` に analytics / logEvent 相当なし（確認範囲内） | — |
| テスト前提 | `freeCook` / `FREE_COOK` / `roundKind` / 「フリークッキング」を参照する unit/component test 74 ファイル、E2E 21 spec が「フリークッキング」文言に依存 | — |
| legacy・不要候補 | (a) `FREE_COOK_RECIPE.description`「好きな材料で自由に…」・`FREE_COOK_ORDER.lineJa`「好きな材料で自由に作ってみよう！」・`FREE_COOK_FALLBACK_HINT`（`hints.ts:25`）— sandbox 時代の copy。(b) `pizzaSelect.ts` の `recipeCardState` / `buildRecipeSections`（ヘッダ自身が "legacy, not used by the W1 UI"）。(c) ORDER phase の「フリープレイ」ボタン文言 | D |

**読み取れること**: FREE round の **出口は常に発見**。sandbox 性（B）は「recipe 非依存の骨格（sentinel recipe・generic bake window・全材料 tray）」だけで、独立した成果・報酬・保存先を持たない。つまり**純粋 sandbox が現在提供している独自価値は「骨格の再利用性」だけ**（§10）。

---

## 2. STEP 2 — 現在の player loop（コード authority）

```
HOME
 ├─ 「フリークッキング」(START_FREE_COOK) ─────────────────────────────┐
 │                                                                       ▼
 │                                              GAME / PREPARE（recipe 未選択, sentinel）
 │                                                DOUGH → SAUCE → CHEESE → TOPPING
 │                                                 ・ヒント sheet（Hint 5.0 ladder / Dex0 は free reveal）
 │                                                     └ 試作ノート（sheet 内のみ）
 │                                                     └ OPEN_POOL 時のみ「食材庫で材料を探す」
 │                                                 ・食材庫（FREE のみ）
 │                                                       ▼
 │                                                     BAKE（generic window）
 │                                                       ▼  CONFIRM_BAKE: matcher を1回だけ実行
 │                                                RESULT（FREE は RESULT+DISCOVERED 統合画面）
 │                                       ┌───────────────┼────────────────────────────┐
 │                                    FAILED      ORIGINAL/INCOMPLETE/AMBIGUOUS     MATCHED
 │                               (失敗, +0 Pitz)  (near-miss note, 💡ヒントを見る,   NEW_DISCOVERY: NEW PIZZA!
 │                                                 試作ノート番号 notice)            + 図鑑登録行(📖図鑑を見る)
 │                                                                                  + 🛒ショップへ（新材料時のみ）
 │                                                                              ALREADY_DISCOVERED: 「発見済み」
 │                                       └──── 共通 CTA: 「もう一度じゆうに作る」(primary → START_FREE_COOK)
 │                                                       「レシピを選んで作る」(secondary → Pizza Select) ← F-1
 │
 └─ 「ピザを作る」 → Pizza Select（発見済み card + 匿名 prompt card 1 枚）
        ├─ card →「このピザを作る！」→ SELECT_RECIPE（canStartGuidedRound）→ PREPARE（reference 表示）→ BAKE → RESULT（guided）
        └─ prompt card → 「フリークッキングで探す」/「ショップを見る」
```

状態別の差（`recipeDiscoveryState` / `selectHintTarget` が authority）:

| 状態 | HOME | Pizza Select | FREE round / Hint | 備考 |
|---|---|---|---|---|
| **Dex 0** | bubble「まずはフリークッキングで最初の1枚を見つけよう！」、FREE が primary、Lunch Rush 無効 | prompt `FIRST_DISCOVERY`、card 0 枚 | Margherita が唯一の DISCOVERABLE → 自動 target、**無料**の Hint 2.0 reveal（OD-HE-5）、未一致のたび hint 行が 4 段階に escalate（`preDiscoveryFreeCookAttempts`） | ここだけ「導く」設計 |
| **single target**（DISCOVERABLE = 1） | bubble「今の材料で新しいピザが作れるかも！」 | prompt `DISCOVERABLE` | 自動 target、Hint 5.0 ladder は有料 rung | 現在の Step 1〜11 の標準形 |
| **OPEN_POOL**（DISCOVERABLE ≥ 2、sticky 無し） | 同上 | 同上（**件数は載せない**。#345） | target なし。sheet は OPEN_POOL 固定文言 + 試作ノート + 食材庫導線 | 既存の最初の OPEN_POOL = Step 12（Branch Placement F7） |
| **SHOP_NEW** | bubble「ショップに新しい材料が入ったよ！」 | prompt `SHOP` | sheet は SHOP_NEW 文言（recipe 名なし） | FREE へ入る理由が無く、買い物へ促す |
| **REFILL** | — | prompt `SHOP`（KNOWN_BUT_MISSING_MATERIAL） | sheet は REFILL 文言 | 在庫切れ |
| **COMPLETE** | 既定 bubble | prompt なし | sheet「図鑑コンプリート！好きなピザを作ろう！」 | **発見する物が無い状態**で FREE が残る（§10 の論点） |
| **discovered recipe のみ作る** | 「ピザを作る」→ Pizza Select | 発見済み card | guided round。Pitz・BEST・Dex 更新は guided も同じ（`registersToDexAtResult`） | Lunch Rush / Dinner の準備場所も兼ねる |

---

## 3. STEP 3 — 提案 RECIPE DISCOVERY loop（authority 互換案・実装ではない）

原則: 既存 authority を一切緩めない。**候補 recipe 名・候補の exact count・個別の target identity を player に出さない**（#345 の Candidate Count 契約と OPEN_POOL の固定文言契約を維持）。

```
HOME ──「レシピ発見」（旧 フリークッキング の置き場）
  ↓
[入口の約束]  「今の材料で、まだ知らないピザが作れそう」（既存 DISCOVERABLE の匿名 prompt と同一契約。件数なし）
  ↓
試作（= 既存 PREPARE。DOUGH→SAUCE→CHEESE→TOPPING。ヒント／食材庫／試作ノートはここの構成要素）
  ↓
焼く（既存 BAKE）
  ↓
┌ 未発見（ORIGINAL / INCOMPLETE / FAILED）
│    ・「今回の試作」: 作った組み合わせが試作ノートに残る（#n、前回との差）
│    ・次の一手を 3 つに限定: 💡ヒント / 📓ノートを見る / 🧺食材庫 → 組み合わせを変えて「もう一度試作」
│    ・材料が尽きたら 🛒ショップ（REFILL/SHOP_NEW 文言）
└ NEW RECIPE DISCOVERED
     ・「✨ NEW PIZZA」+ 名前（初公開）+ 図鑑登録 No.xx（既存）
     ・Pitz・BEST・材料 notice（既存）
     ・「次の発見」行動（§7）
```

**この案が既存 loop と変わる点（＝最小）**

1. mode の名詞と入口 copy を「発見」に揃える（F-2 の解消）。
2. RESULT 副 CTA の行き先と名称を一致させる（F-1 の解消）。
3. 「試作→ノート→ヒント→食材庫」を**導線として順序付けて**見せる。現状は Hint sheet の中に埋まっていて、未発見 RESULT から直接ノートへ行けない（ノートの入口が Hint sheet のみ）。

**authority 上の注意（守るもの）**: ① 候補名・件数・「あとN種」の非表示（#345）。② Pizza Select / Dex への未発見情報非漏洩（W1）。③ OPEN_POOL の固定文言契約（IP-1: 材料・family・recipe 名を出さない）。④ ladder の発見数（ladderCredit）ルールは変えない。

---

## 4. STEP 4 — Pizza Select は Discovery 専用 mode でも必要か

**先に事実（§0 P1/P2）**: Pizza Select は発見ループの一部ではなく、「**既知 recipe を再調理する guided 入口**」。次の 3 つを担っており、**FREE を discovery 専用にしても消えない需要**がある。

1. 既知 recipe の再調理（BEST 更新・Pitz 獲得。guided も `registersToDexAtResult` 対象）— Shop 購入の主な Pitz 供給の一つ。
2. Lunch Rush / Dinner の素振り（reference を見ながら作れる）。
3. F-15: 発見済みだが在庫切れの recipe を Shop へ繋ぐ（disabled CTA + 「ショップで補充」）。

| 案 | 内容 | 事実に基づく含意（採点なし） |
|---|---|---|
| **A. 現状維持** | Pizza Select は「作るピザを選ぼう！」のまま | 変更面最小。F-1（RESULT 副 CTA の名称ずれ）と、HOME の「ピザを作る」/「フリークッキング」の二本立てが「どちらが主目的か」を曖昧に残す |
| **B. 廃止して直接試作へ** | Discovery では Pizza Select を経由しない | **発見ループでは元々経由していない**ので、廃止しても発見側は変わらない。廃止すると失うのは guided 再調理（上記 1〜3）。つまり B は「Pizza Select の廃止」ではなく「**guided 再調理の廃止**」を意味し、Pitz 供給・Lunch Rush/Dinner 準備・F-15 の受け皿が消える。Owner が決めるべきは Pizza Select の要否より**guided 再調理を残すか** |
| **C. Discovery Hub 化** | 「発見できそう／材料を買おう」の hub に再定義 | Pizza Select には既に匿名 prompt card（FIRST_DISCOVERY / DISCOVERABLE / SHOP）があり、**hub 化の素地はある**。ただし hub に「発見」と「既知 card の再調理」を同居させると、card grid（既知）と prompt（未知）の二役が残り、「Discovery 専用」にはならない。hub を足すなら HOME の CTA と役割が重複する |

**判断**: A/B/C のどれでも、**OPEN_POOL との矛盾は元から無い**（P2）。実質的な設計問いは「HOME の入口を『発見』と『既知を作る』の 2 つに明確に割るか」であり、これは OD-DISC-MODE-2 へ（§13）。

---

## 5. STEP 5 — Hint / Notebook / Pantry / Shop の役割（Discovery loop の構成要素として）

Owner が挙げた 4 役割と production の一致を確認:

| 要素 | Owner の想定する役割 | production の実態 | 一致 | 不足 |
|---|---|---|---|---|
| **Trial Notebook** | 自分の過去試作を見る | 「player が試した構成と、見た feedback」のみ。recipe id / target / 候補 / 推測を**持てない構造**（P3-4）。差分表示あり（前回からの変更） | ✅ 一致 | **session-only（reload で消える）**。入口が **Hint sheet 内のみ**で、未発見 RESULT から直接開けない。「発見の記録帳」として見せるなら、永続性と入口の 2 点が機能不足（save 追加は §12 で migration 論点） |
| **Hint** | 未知 recipe の段階的な構造情報 | Hint 5.0 ladder（材料→構成→特徴の linear rung、有料）。Dex 0 は無料 reveal。OPEN_POOL / SHOP_NEW / REFILL / COMPLETE は固定文言（recipe 名なし） | ✅ | OPEN_POOL では「target 不在」のため構造情報が得られず、実質「ノート＋食材庫を使え」になる（IP-1 の設計通り）。Hint の価値が single target のときだけ高いという非対称は、C 型（OPEN_POOL）が増えるほど目立つ |
| **Pantry** | 持っている材料と不足を理解する | 食材庫は**所持材料の検索・棚**。「不足」を示す機能ではない（recipe 非公開のため示せない）。FREE 専用 gate | ⚠ 部分一致 | 「不足を理解する」は authority 上**できない**（不足 = 候補の identity を漏らす）。Owner 文言からは「不足」を外すのが安全。Pantry の役割は「持っている材料を探す／増やす動機を得る」まで |
| **Shop** | 新しい材料で探索空間を広げる | 購入 → ladder entitlement。feedback に「フリークッキングで使ってみよう」。「あと○つ発見で新しい材料が入荷」（**発見数**進捗であって候補数ではない） | ✅ | 購入直後に「発見」へ直行する CTA がない（文言のみ。ボタンなし）。§8 参照 |

不足まとめ: ① Notebook の入口と永続性 ② Pantry の「不足理解」は authority 不可 ③ Shop→発見の直行 CTA なし。**いずれも新 mode 名の有無に依存しない既存の欠落**で、rename だけでは解消しない。

---

## 6. STEP 6 — Onboarding への影響

現 Dex 0 の流れ（コード確認済み）: HOME bubble「まずは…最初の1枚を見つけよう！」→ FREE が primary「フリークッキングで探す」→ round 内の hint 行（未一致のたび 4 段階 escalate）→ Margherita 無料 reveal → 初発見（NEW PIZZA、Pitz floor + bonus）→ Lunch Rush 解放・Shop 材料 step 1 → ladder 開始。

- **減らせる説明**: 「なぜ"自由"に作るのか」「フリークッキングとは何か」を補う必要が減る。現状は F-2 の通り、mode 名が「自由」で bubble/CTA が「見つけよう」＝一文の中で 2 概念を橋渡ししている。「レシピ発見」なら入口の約束と一致する。
- **減らせない説明**: 以下は mode 名では伝わらず、**rename だけでは tutorial 不要にならない**:
  1. 「材料を重ねて焼くと、同じ組み合わせの recipe が発見される」（現状は ORIGINAL RESULT の note 1 行 `ResultPanel` と hint 行が担う）
  2. 「未発見でも失敗ではない」（ORIGINAL は正常な結果）
  3. 「ヒントは何を教えて何を教えないか」
- **新たに生じるリスク**: Dex 0 で「レシピ発見」と表示すると「どこかにレシピ一覧があって探す」と読まれ、**レシピ名一覧を期待する**可能性（候補非表示契約と衝突する期待）。「試作して見つける」の語感を保つ copy が必要。

OWNER DECISION REQUIRED: Dex 0 の入口 copy（「レシピ発見」単独か「試作して発見」等か）と、初回のみ短い説明を足すか否か。既存 authority からは言えない UX 判断（→ OD-DISC-MODE-1 に包含）。

---

## 7. STEP 7 — 発見後の導線

**現在 production に存在する CTA**（`ResultPanel.tsx`）:

| 場所 | CTA | 条件 |
|---|---|---|
| 発見行 | 「📖 図鑑を見る」 | NEW_DISCOVERY のみ |
| material notice | 「🛒 ショップへ」 | 新材料が entitle された発見のみ |
| bottom bar primary | 「もう一度じゆうに作る」 | 常時 |
| bottom bar secondary | 「レシピを選んで作る」→ Pizza Select | 常時（**F-1**） |
| header | 「🏠 ホーム」 | 常時（確認ダイアログ付き） |

**欠けているもの**: 「発見直後の次の発見」を指す導線。primary の「もう一度じゆうに作る」は文言が sandbox 寄りで、**発見直後に最も自然な次行動（新材料があるなら Shop、なければ次の試作）を状態に応じて出し分けていない**。「ショップへ」は条件付きの副次リンク。

**専用 mode に必要な最小変更（提案・未決定）**:
- primary 文言を「次のピザを探す」系に（動作は現状と同じ `START_FREE_COOK`）。
- NEW_DISCOVERY で新材料があるときは「ショップへ」を昇格させるかを Owner 判断（OD-DISC-MODE-4）。
- secondary は「作ったピザ（図鑑／Pizza Select）へ」へ名称修正（F-1）。
- Lunch Rush は初発見で解放されるため、初回発見の RESULT にのみ「ランチラッシュ」案内を足す案があるが、**primary にはしない**（発見ループから離れる）。
- いずれも新 state・新 domain 不要（既存 callback の再配線と copy）。

---

## 8. STEP 8 — progression との関係

事実: ladder は **Dex の ladderCredit 発見数 `>= step`** でのみ進む（`discoveryLadder.ts`）。mode は無関係。Shop 購入は `ownedIngredientIds`/inventory を増やし、`recipeDiscoveryState` を介して DISCOVERABLE を生む。25 step、27 recipe、`ladderCredit:false` の recipe は発見しても ladder が進まない（calabresa、pesto-pollo。`discoveryProgressionModel.ts` ヘッダ）。

「**新材料を買う → 新しい発見可能性が生まれる → Discovery mode へ行く**」loop の成立確認:

| 段 | 成立 | 現在の担当 |
|---|---|---|
| 発見 → 材料 entitlement | ✅ | RESULT の material notice |
| entitlement → Shop 購入 | ✅ | HOME「NEW n」badge、Shop |
| 購入 → DISCOVERABLE 化 | ✅（derive のみ・保存なし） | `recipeDiscoveryState` |
| DISCOVERABLE → 発見モードへ | ⚠ **間接的** | Shop feedback は文言のみ「フリークッキングで使ってみよう」（ボタンなし）。HOME bubble「今の材料で新しいピザが作れるかも！」と Pizza Select prompt が補う |

→ loop は**成立しているが、「購入直後に発見へ入る」ボタンが無い**。専用 mode 化で一番効くのは名称より、この 1 本の導線（Shop feedback から直接 START_FREE_COOK）。ただし追加は UI navigation のみで state 不要。

**ガード**: player-facing progression に「候補数・pool 規模・あとN種」を出さない。現在の「あと○つ発見で新しい材料が入荷」は **ladder の発見数**（recipe の個数ではなく進捗 gate）であり契約内だが、新 mode で「発見」語が増えると候補数と誤読されやすい。文言設計時に「発見数 = 自分の図鑑の進捗」と明確に分ける必要（要注意点）。

---

## 9. STEP 9 — C-Step 設計はまだ必要か

C-Step 設計の中身（Branch Placement の事実引用）: 型 A=単線 / B=移行 / C=複数候補（OPEN_POOL）という **ladder 上の pool 構造の分類**。Step 12 が現存する唯一の C。Step 14 / Grandma は本監査の対象外。

結論: **「C-Step 設計はそのまま有効」に最も近い。ただし 1 点だけ上位概念への吸収が起きる。**

- **有効なまま**: A/B/C は「どの Step で pool が何件になるか」という**データ構造の話**で、player-facing の mode 名と独立。Step 12 の READY 判定、OD-BRANCH-1..5 の論点（どこから branching を始めるか、ladderCredit、no-sauce、M 件、blocker 解決）は mode 名変更で変わらない。
- **再定義が必要になりうる点（一部）**: OPEN_POOL の体験品質。専用 mode の中で「C 型 Step に入った瞬間のガイド」（IP-1 の導線: ノート・食材庫）が**mode の主役機能になる**ため、C-Step を増やすほど Discovery mode の UX 負荷が上がる。つまり「C を何件・どこに置くか」は mode の体験設計とより強く結びつく。
- **吸収されるもの**: 「Dex 0 の A（onboarding 保護区間）」は mode の「初回体験」として mode 設計側へ吸収される可能性（OD-BRANCH-1 の (d) 選択肢）。ただし本監査では決めない。
- Step 14 / Grandma / No.28 は**判断しない**。

---

## 10. STEP 10 — sandbox の行方

**FREE が現在提供する「純粋な自由調理価値」の有無**（§1・F-3 より）: 独立した成果・報酬・保存先はない。ORIGINAL は無採点・無報酬・無登録。残る価値は (i) 骨格（sentinel recipe・generic bake window・全材料 tray・食材庫）の再利用、(ii) 「何を載せても失敗ではない」という心理的安全、(iii) COMPLETE 後に発見対象が尽きたとき（`COMPLETE` 文言「好きなピザを作ろう！」）の遊び場の可能性、(iv) 将来の sandbox 価値（自由創作・共有）の置き場所。(i)(ii) は discovery mode でもそのまま成立し、(iii)(iv) は**現状コード・docs に実装も authority もない将来仮説**。

比較（ランキング・点数なし。事実のみ）:

| 項目 | A. FREE を RECIPE DISCOVERY へ完全置換 | B. 主導線は RECIPE DISCOVERY、sandbox は別入口で残す | C. 内部 mode は FREE のまま、player-facing 目的だけ Discovery |
|---|---|---|---|
| player clarity | 目的が 1 つに定まる。COMPLETE 後の行き先が曖昧に | 入口が増え、「発見」と「自由」を player が区別する必要 | 内部差を意識させず目的は明確。内部名と UI 名の乖離が残る |
| code reuse | 既存 round を再利用（名称・copy 中心） | 2 本の入口が同一 round 骨格を共有可（`freeCook` の 1 フラグで分岐するなら追加コード小、別 kind にするなら大） | 最大（コード変更ほぼ copy のみ） |
| onboarding | Dex 0 の説明を mode 名に寄せやすい | sandbox 入口を Dex ≥1 まで隠す等の追加規則が必要 | 現状 onboarding の延長 |
| discovery loop | 一本化。matcher 出口のみ | sandbox 側の ORIGINAL 結果が発見ループと混ざらない保証が要る | 変更なし |
| regression surface | `roundKind` を触らなければ小。触ると 74 test / 21 E2E に波及 | 新入口の E2E・Hint/Notebook/Pantry の gate（`isLargeCatalogEligible`）の再設計 | 最小（copy 変更 + 文言 E2E 追従） |
| future sandbox value | 将来必要になれば別途新設（一度消えた入口の復活コスト） | 保持できる。ただし「今は価値が無い入口」を持つコスト | 将来 sandbox 追加時に内部名 FREE が既に残っている |
| save compatibility | 影響なし（`freeCook`/`roundKind` は非永続） | 影響なし | 影響なし |
| E2E scope | 「フリークッキング」文言依存 21 spec を追従 | 21 spec + 新入口 spec | 21 spec の文言追従のみ（※文言も変えるなら同じ） |

注: save への影響は**どの案でも原則なし**（`persistence.ts` に `freeCook`/`roundKind` なし）。

---

## 11. STEP 11 — 画面・文言インベントリ（最終決定はしない）

「FREE 概念」が露出している player-facing 文言（production、テスト・dev 除く）:

| # | 場所 | 文言 | 性質 |
|---|---|---|---|
| 1 | `HomeScreen.tsx:174` | 「🎨 フリークッキングで探す」（Dex 0 lead） | mode 名＋発見語 |
| 2 | `HomeScreen.tsx:182` | 「🎨 フリークッキング」（Dex ≥1） | mode 名のみ |
| 3 | `HomeScreen.tsx` | 「🍕 ピザを作る」（Pizza Select 入口） | 別入口の名前 |
| 4 | `HomeScreen.tsx` | 「🔒 まず1枚ピザを発見しよう」 | 発見語（既存） |
| 5 | `homeBubble.ts` | 「まずはフリークッキングで最初の1枚を見つけよう！」ほか 3 本 | mode 名＋発見語 |
| 6 | `PizzaSelectScreen.tsx:100-114` | prompt「まずはフリークッキングで1枚目のピザを見つけよう！」「まだ見つけていないピザが、今の材料で作れるかも！」CTA「フリークッキングで探す」 | mode 名＋発見語 |
| 7 | `PizzaSelectScreen.tsx` | header「作るピザを選ぼう！」、「このピザを作る！」 | guided（FREE と別） |
| 8 | `GameScreen.tsx:621,678` | order card「🎨 フリークッキング」（PREPARE / BAKE） | **round 中の mode 表示** |
| 9 | `GameScreen.tsx:786` | ORDER CTA「🍕 フリープレイ」（`mission.mode==="FREE"`） | 別概念（P0 の 1）の用語衝突 |
| 10 | `data/freeCook.ts` | `nameJa:"じぶんのピザ"`、`description`/`lineJa`「好きな材料で自由に…」 | sandbox 時代 copy（D） |
| 11 | `data/hints.ts:25` | `FREE_COOK_FALLBACK_HINT`「好きな材料で自由に作ってみよう！」 | D |
| 12 | `ResultPanel.tsx:210-213` | 「もう一度じゆうに作る」「レシピを選んで作る」 | **CTA（F-1）** |
| 13 | `ResultPanel.tsx` | ORIGINAL note「図鑑のピザと同じ組み合わせで作ると『発見』＆Pitzがもらえるよ。」 | 発見語（既存・有用） |
| 14 | `ResultPanel.tsx` | 「NEW PIZZA!」「〜を発見しました！」「📖 図鑑を見る」「🛒 ショップへ」 | 発見語（既存） |
| 15 | `HintSheet.tsx:89` | OPEN_POOL「まだ発見できるピザがあるよ！／…フリークッキングを試してみよう。」 | mode 名 |
| 16 | `DexOverlay.tsx:75,95` | 「フリークッキングで探す」「？？？」「まだ発見できるピザがあるよ」 | mode 名＋発見語 |
| 17 | `ShopOverlay.tsx:176` | 「🍳 フリークッキングで使ってみよう」 | mode 名（CTA ではなく文言） |
| 18 | `trialNotebookCopy.ts:6` | `emptyHint:「フリークッキングで作ってみよう！」` | mode 名 |
| 19 | `MissionResultOverlay.tsx:128` | 「フリープレイへ」 | 別概念（Lunch Rush→非 mission）の用語衝突 |

観察: **mode 名「フリークッキング」の出現は #1 #2 #5 #6 #8 #15 #16 #17 #18 の 9 系統**。発見語は既に #4 #5 #6 #13 #14 #16 に多い。#10 #11 は rename の対象外になりやすいが sandbox copy が残る。

---

## 12. STEP 12 — 最小 vertical slice（RECIPE DISCOVERY 化するとしたら）

最小は「**C 案（内部 `FREE_COOK` のまま、player-facing を Discovery に）＋ 導線 2 本**」で、新 state・save 変更なしで成立する。

| 区分 | 内容 |
|---|---|
| rename / copy | §11 の mode 名 9 系統、#10・#11 の sandbox copy、F-1（#12 の副 CTA）、ORDER の「フリープレイ」用語衝突（#9）の扱い |
| navigation | (a) RESULT 副 CTA の行き先と名称を一致（Pizza Select は「作ったピザ」側へ）。(b) Shop 購入 feedback → 直接 `START_FREE_COOK` の CTA（任意）。(c) 発見直後の primary 切替（任意・OD-4） |
| state | **不要**（`roundKind`/`freeCook` は現状維持。`isLargeCatalogEligible` 等の gate は無変更） |
| domain | **不要**（matcher / ladder / hint 契約は無変更） |
| persistence | **migration 不要**（`freeCook`/`roundKind`/hint session/notebook はいずれも save されない）。ただし Trial Notebook を「永続化して発見記録帳にする」なら**別案件として schema 追加が必要**（本 slice 外） |
| tests | `FreeCook.ui.test.tsx` など文言を assert する unit/component の追従。74 ファイルが `freeCook` 系を参照するが、**内部名を変えなければ大半は無変更**（変更は文言 assert のみ） |
| E2E | 「フリークッキング」文言依存 21 spec の文言追従（挙動は不変）。新規は navigation (a)(b) 分のみ |
| mobile HV | 390×844 の HOME / Dex 0 / RESULT（NEW・ORIGINAL）/ Shop feedback。CLAUDE.md の HV policy の対象（UI/UX 変更）。画面幅で文言が折り返さないか（HOME は過去に 360/390 で折り返し問題あり、`HomeScreen.tsx` I5b-4 注記） |

save migration: **不要**（上記）。ただし A 案（`roundKind` 値の rename 等を行う場合）も save に出ないため不要。

---

## 13. STEP 13 — Owner Decisions（4 件）

コードから自然に統合できるものは統合した（例: Hub 化は OD-2 に、COMPLETE 後の扱いは OD-3 に包含）。

**OD-DISC-MODE-1 — FREE COOKING を RECIPE DISCOVERY へ置き換えるか**
- 事実: 出口は常に発見（F-3）。CTA は既に発見語（F-2）。内部名（`freeCook`/`FREE_COOK`）は player に見えず save にも出ない。
- 選択肢: (a) player-facing 名を Discovery に変更（内部名は維持＝§10 C 案）／(b) 名前は維持し copy のみ補強／(c) 置換して sandbox 的要素も整理（§10 A 案）。
- 併せて決める: Dex 0 の入口 copy（§6）。

**OD-DISC-MODE-2 — Pizza Select の扱い（維持 / 廃止 / Hub 化）**
- 事実: 発見ループは Pizza Select を通らない（P1）。Pizza Select は既知 recipe の guided 再調理で、Pitz・Lunch Rush/Dinner 準備・F-15 を担う（§4）。OPEN_POOL との矛盾は無い（P2）。
- 選択肢: A 維持（名称整理）／B 廃止＝guided 再調理を無くす／C Hub 化。
- 実質の問い: **guided 再調理を残すか／HOME で「発見」と「既知を作る」をどう割るか**。

**OD-DISC-MODE-3 — 純粋 sandbox を残すか**
- 事実: sandbox 独自の成果・報酬・保存先は無い。COMPLETE 後の遊び場は将来仮説（実装・authority なし）。
- 選択肢: §10 A / B / C。今決めず「COMPLETE 到達まで保留」も可（現 ladder は 25 step・27 recipe で COMPLETE まで距離あり）。

**OD-DISC-MODE-4 — 発見後の primary CTA**
- 事実: 現在は「もう一度じゆうに作る」固定で状態非依存（§7）。
- 選択肢: (a) 次の試作（現状動作・文言のみ）／(b) 新材料があれば「ショップへ」を昇格／(c) 図鑑を見る を昇格。Lunch Rush は primary にしない案を推奨材料として提示（発見ループから離れるため）。

ここで**決めなかったこと**: No.28、Step 14、Grandma、R6 / IP-2、Trial Notebook の永続化（機能不足としては §5 に明記したが、別案件）、COMPLETE 後の遊び場、文言の最終案。

---

## 14. この監査がしなかったこと / 限界

- 実装・test・build・E2E・screenshot・HV・preview deploy は実施していない（指示通り）。
- 「E2E 21 spec」「74 test ファイル」は `grep` による参照ファイル数であり、変更要否の精査はしていない。
- analytics 相当は `src` の grep の範囲で未検出（外部計測の有無は未確認）。
- HOME の 360px 表示など、実画面での折り返しは未確認。
- Branch Placement / First C-Step / Grandma は再実行していない。引用は Branch Placement の A/B/C 定義・F7・OD-BRANCH のみ。
- `discoveryHint.ts` ヘッダの「Hint 5.0 は off in every build」は stale（コードは production default ON）。本監査は docs を直さない。
