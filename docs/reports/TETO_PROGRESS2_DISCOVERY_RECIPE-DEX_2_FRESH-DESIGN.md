# Progression 2.0: Discovery / Recipe Dex 2.0 Fresh Design（STOP GATE）

- 種別: Fresh Design（docs のみ）。`src/**`、`e2e/**`、CSS、runtime、balance 値は変更していない。PR も merge もしていない。
- 監査した `main`: `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（Merge PR #228、I5a）。`git fetch origin main` の直後に確認した。
- 並行作業: I5b-3 Production Integration は別セッションで進行中。その branch には触れておらず、差分も読んでいない。本設計は `main` だけを runtime の事実として扱う。
- 参照した Fresh Audit（3件とも `main` には入っていない。各 branch 上の commit を `git show` で読んだ）:

  | Audit | commit | branch |
  |---|---|---|
  | I5b-4 UI/UX Fresh Audit | `0c3e01f4233db6cdccf33ab611f8be31b47fca59` | `claude/teto-pizza-fresh-audit-fgqqtc` |
  | 25-Recipe Economy Balance Fresh Audit | `2c8518c982b1f76c24f30dc41fe3d2902c2a17a7` | `claude/25-recipe-economy-audit-yh82g9` |
  | Post-W1 Cooking Steps Phase 1 Fresh Audit | `0d7b4898f79ae40ab8d5b73e0a03c7a1871da402` | `claude/teto-cooking-steps-audit-vyx88k` |

- 付属データ: `docs/reports/data/TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_state-matrix.json`（recipe state の定義、画面×state の matrix、情報開示 Level の現状と提案、25 recipe ladder の「既知 recipe からの距離」分析）。**設計提案であり runtime authority ではない。**
- Human Verification Policy: docs-only の変更は適用対象外（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` §2）。screenshot も動画も作っていない。

---

## 0. 要約

1. **いまの runtime には「発見」の経路が2本ある。** Free Cooking（答えを見ないで組み合わせを試す）と、Pizza Select の NEW カード（名前と完成見本を見て guided で作る）。後者は答えを見せる。25 recipe の ladder では、24 回の発見のうち**最大 18 回**が Pizza Select から答え付きで作れる（旧 8 件は EP1 chain と★次第、W1 の 10 件は材料がそろった時点で必ず）。
2. **答えの漏れは5か所ある。** Pizza Select の NEW カード、guided round の見本、LOCKED カードの名前、Shop の「これを買うと: 🍕 ○○」、購入後の「新しいピザが作れます！「○○」」。Shop の2つは I5b-4 では扱っていない。
3. **推奨する役割分担:**
   - Pizza Select = **発見済み recipe の再調理画面**（A′）。未発見は1枚の匿名「発見チャンス」カードにまとめる。
   - Recipe Dex = **未発見の枠も並ぶ図鑑**。未発見は `？？？` で、名前も見本も出さない。
   - recipe 名は**発見の瞬間に初めて出す**（それが報酬になる）。
4. **recipe state は派生だけで決める**（save の schema は増やさない）: `DISCOVERED` / `DISCOVERABLE` / `KNOWN_BUT_MISSING_MATERIAL` / `UNKNOWN`。一時的な `NEWLY_DISCOVERED` を加える。EP1 chain は入力にしない。
5. **Discovery Result と通常 Result を分ける。** 新規発見のときは発見を中心に並べ、品質は1行に縮める。W1 では同じ component の中で並び順を変えるだけにする。演出付きの独立 overlay は Post-W1 に回す。
6. **25 ladder の 24 key recipe のうち 15 件は、既知の recipe に新材料を足しただけでは作れない**（古い材料との組み直しや、ソースの変更が要る）。W1 の後半では hint と「おしい」feedback が必須になる。
7. **W1 blocker はない。** ただし、W1 の答え漏れ対策（本設計の W1-a〜c）は I5b-3 で W1 recipe が入るのと**同じ時期**に必要になる。入れないと LK-7 が必ず起きる。

---

## 1. Current UX audit（`main` 12a09de のコードから）

### 1.1 画面の役割と遷移

```
HOME ─┬─ 🍕 ピザを作る ──→ Pizza Select ─┬─ NEW/COMPLETED カード → 詳細 → このピザを作る！ → guided round（見本あり）
      │                                  └─ preDiscoveryLocked（Dex 0 の margherita）→ フリークッキングで探す
      ├─ 🎨 フリークッキング ──→ Free Cooking（所持している材料を全部出す、見本なし）
      ├─ ⏱ ランチラッシュ（Dex 0 では disabled）
      ├─ 📖 ピザ図鑑 ──→ DexOverlay
      ├─ 🏪 ショップ ──→ ShopOverlay
      └─ 🧺 材料 / 🏆 ランキング / ⚙️ 設定

guided / Free Cooking → BAKE → (CUT) → RESULT（1画面に統合、REGISTER_TO_DEX を自動で dispatch）
RESULT の CTA: [もう一度じゆうに作る | もう一度つくる] / [レシピを選んで作る | 別のピザを作る] / NEW 材料があれば [🛒 ショップへ]
```

| 画面 | 実装 | 役割（今） |
|---|---|---|
| HOME | `src/screens/HomeScreen.tsx` | hub。Dex 0 では Free Cooking が primary（I5b-4 §1 の「円い CTA」問題あり）。Shop / Dex のカードに NEW badge は無い |
| Pizza Select | `src/screens/PizzaSelectScreen.tsx`、`src/state/pizzaSelect.ts` | 全 15 件を COMPLETED / NEW / LOCKED で並べる。NEW と COMPLETED は guided で作れる |
| Free Cooking | `src/data/freeCook.ts`、`src/logic/discovery/freeCook.ts` | 所持している材料で自由に作る。CONFIRM_BAKE で matcher が recipe を決める |
| Discovery（判定） | `src/logic/discovery/matcher.ts`、`src/state/discoveryRegistration.ts` | 材料の集合が**完全に一致**したときだけ発見（上位集合 / 部分集合は ORIGINAL）。量は identity に含めない（Issue #215 OD-5） |
| Result | `src/components/ResultPanel.tsx` | FAILED / ORIGINAL / 採点あり の3系統。発見は `NEW PIZZA! ✨ ○○を発見しました！` の1行 banner |
| Recipe Dex | `src/components/DexOverlay.tsx` | 全 recipe を `RECIPES` の順で並べる。未発見は `🔒 ？？？ まだ見ぬピザ` |
| Shop | `src/components/ShopOverlay.tsx`、`src/logic/materialShop.ts` | ladder で入荷した NEW 行と OWNED 行。LOCKED は並べず、「あとN つ発見で新しい材料が入荷」を1行出す |

### 1.2 観点ごとの現状

| 観点 | 現状（コード） |
|---|---|
| 未発見 recipe をどこで見られるか | **Pizza Select**（全件。NEW = 名前と見本、LOCKED = 名前、フガッサだけ `？？？`）、**Recipe Dex**（`？？？`）、**Shop**（買うと作れるようになる recipe の名前）、HOME（件数だけ） |
| recipe 名がいつ公開されるか | Pizza Select では**最初から**（Dex 0 でも、`mysteryLock` のフガッサ以外の 14 件は LOCKED カードに名前が出る）。Shop では「その材料を買えば作れる」時点。Dex では発見後 |
| 完成見本がいつ公開されるか | Pizza Select の NEW カード（`PizzaThumbnail`、`PizzaSelectScreen.tsx:113` / `:183`）と、そこから入る guided round の見本。Dex 0 の margherita（`preDiscoveryLocked`）にも見本が出る |
| 必要材料がいつ公開されるか | guided round の見本と `RECIPE_HINTS`（`hints.ts`）。Dex では発見後（`dex-card__ingredients`）。Dex 0 の Free Cooking では3回目の失敗以降に答えを全部言う（`FREE_COOK_DISCOVERY_HINT_LEVELS[3]`、`hints.ts:38`） |
| unlock 条件がどこに表示されるか | Pizza Select の LOCKED カードだけ。EP1 の `requiresRecipeId` / `minTotalStars` から作る（`unlockHintFor`、`pizzaSelect.ts:29`）。ladder と矛盾する（I5b-4 C1）。材料が足りない LOCKED には理由が出ない（フンギ） |
| NEW 状態がどこにあるか | (a) Pizza Select の `NEW` badge = 「解放済み・未挑戦」の recipe（発見の新しさではない）、(b) Dex の `NEW` badge = 今回の round で発見した recipe（`state.justDiscovered`、次の round で消える。保存しない）、(c) Shop の `NEW 入荷` = entitled だが未購入の材料、(d) RESULT の `🆕 新しい材料が入荷`。**4つの NEW が別の意味を持っている** |
| discovery の後に何が起きるか | REGISTER_TO_DEX（`gameReducer.ts:1062-`）: Dex に書く → `resolveShopEntitlement` で ladder を進める → Pitz（基本 + 初回発見 +50 + 手際）→ RESULT に NEW PIZZA banner と NEW MATERIAL notice（Shop CTA） |
| Recipe Dex への登録 | 自動。RESULT には「図鑑に登録した」ことを示す表示が無い。Dex を開くのは HOME からだけ（Issue #47 Finding K で Making 中の header から外した） |
| material unlock | ladder の step = 発見数。RESULT の NEW MATERIAL notice で名前を出す。load 時の migration で増えた分には通知が出ない（Economy Audit §9） |
| Shop への誘導 | RESULT の notice の `🛒 ショップへ` だけ。HOME の Shop カードには badge が無い。RESULT から HOME に戻ると、入荷を知らせるものは Shop の中にしか残らない |

### 1.3 recipe が「作れる」ことを決めている authority（再確認）

I5b-4 §2.1 の表は `main` 12a09de でもそのまま正しい。発見に関係する部分だけ再掲する。

| authority | どこで効くか |
|---|---|
| EP1 chain（`Recipe.unlockCondition`、旧 14 件） | `recipeUnlocked` → `isRecipeAvailable` → Pizza Select のカード状態、`recipesUnlockedByIngredient`（Shop の「これを買うと」） |
| A2（発見済み ⇒ unlocked、I4b-3） | `recipeUnlocked` の先頭 |
| Discovery Ladder（OD-REC04-1） | Shop entitlement（`resolveShopEntitlement`） |
| 所持と在庫 | `isRecipeAvailable` の材料の軸。Free Cooking の tray（在庫 0 は disabled） |
| matcher | Free Cooking と guided の両方の RESULT。EP1 を見ない |

---

## 2. Current information leaks（答え漏れ）

| id | 場所 | 何が漏れるか | Level | 起きる条件 |
|---|---|---|---|---|
| **LK-1** | Pizza Select の NEW カード | 名前 + 完成見本 | L4 | 未発見で、EP1 が解放済みで、材料を全部持っている。shipped-15 では例: mushroom を買う → フンギ、garlic → マリナーラ、cherry-tomato + pesto → ジェノベーゼ |
| **LK-2** | NEW カードから入る guided round | 見本 popover、`RECIPE_HINTS`（「まんなかに卵をのせたら…」など材料名） | **L5** | LK-1 と同じ。見本を写せば発見になる |
| **LK-3** | Pizza Select の LOCKED カード | 名前 + ladder と矛盾する解放条件（「フンギを1枚完成させると解禁」） | L2 + 誤誘導 | Dex 0 から。フガッサ以外の 14 件 |
| **LK-4** | Dex 0 の margherita カード（`preDiscoveryLocked`） | 名前 + 完成見本 | L4 | fresh save。Issue #182 の「答えを常時提示しない」と矛盾する |
| **LK-5** | Shop の NEW 行「これを買うと: 🍕 ○○」と、購入後の「🍕 新しいピザが作れます！「○○」」（`ShopOverlay.tsx:84` / `:181` / `:285`） | 未発見 recipe の名前 + 「その recipe はこの材料を使う」 | L2 + L3 | LK-1 と同じ条件（`recipesUnlockedByIngredient` は EP1 を見るので、EP1 が閉じている recipe は出ない）。**I5b-4 では未指摘** |
| **LK-6** | Dex 0 の Free Cooking hint（Level 3） | margherita の答え全部 | L5 | 失敗が3回以上。Issue #182 の「初回マルゲリータのみソフトヒント」の範囲で**意図されたもの** |
| **LK-7** | W1 の 10 件（I5b-3 で入る。`unlockCondition` が無い） | LK-1 / LK-2 / LK-5 がすべて起きる | L5 | 材料が入荷して購入した時点で**必ず**（I5b-4 C3） |

**影響の大きさ（25 ladder）:** 24 回の発見のうち、key recipe が EP1 で LOCKED のまま（= Free Cooking でしか作れない）なのは6件（bismarck、breakfast-pizza、pepperoni、salsiccia、meat-lovers、fugazza。Economy Audit §12.3）。残りの 18 件は LK-1 / LK-2 / LK-5 の対象になりうる。旧 8 件は EP1 chain と `minTotalStars` 次第で、W1 の 10 件は必ず対象になる。

**漏れていないもの:** Recipe Dex（未発見は `？？？`）、HOME（件数だけ）、Lunch Rush（発見済みだけを出題する。`lunchRush.ts:98`）、Free Cooking の Dex ≥ 1 の hint（操作説明だけ）、ORIGINAL の Result（自分が使った材料だけ）。

---

## 3. Core player loop

### 3.1 Progression 2.0 の中心 loop（明文化）

```
      ┌───────────────────────────────────────────────────────────────┐
      ▼                                                               │
 ① 入荷（発見数が ladder の step に届く）                                │
      ▼                                                               │
 ② Shop で NEW 材料を仕入れる（初回パック、Pitz）                          │
      ▼                                                               │
 ③ Free Cooking で、持っている材料を組み合わせる                           │
      ▼                                                               │
 ④ 焼く → 判定（材料の集合が完全一致するか）                                │
      ├─ ちがう → おしい / オリジナル feedback → ③ に戻る（hint で1段ずつ）  │
      ▼                                                               │
 ⑤ NEW PIZZA!（recipe 名はここで初めて出る）                              │
      ▼                                                               │
 ⑥ Recipe Dex に登録（？？？の枠が埋まる）                                │
      ▼                                                               │
 ⑦ Pitz / ★（初回発見 +50）                                            │
      ▼                                                               │
 ⑧ 次の材料が入荷 → 「ショップを見る」 ──────────────────────────────────┘

 副 loop: Pizza Select で発見済みを作り直す（★ / BEST を上げる、Pitz を稼ぐ）、Lunch Rush
```

### 3.2 runtime との一致 / 不一致

| loop の段階 | runtime（main 12a09de） | 判定 |
|---|---|---|
| ① 入荷 | REGISTER_TO_DEX で ladder を解決する。RESULT に NEW MATERIAL notice | ✅ |
| ② Shop | NEW 行、初回価格、pack 量 | ✅（ただし LK-5） |
| ② への誘導 | RESULT の `🛒 ショップへ` だけ。HOME の Shop カードに badge が無い | ⚠️ |
| ③ Free Cooking | 所持している材料を全部 tray に出す。在庫 0 は disabled | ✅ |
| ③ の手がかり | Dex ≥ 1 では hint が操作説明だけ（I5b-4 F-6a）。入荷したばかりの材料の印も無い | ❌ |
| ④ 判定 | 完全一致、量は identity にしない | ✅ |
| ④ 失敗時 | ORIGINAL は一律「図鑑にはない、あなただけのピザ！」。INCOMPLETE_MATCH だけ「あと少し…」 | ⚠️ |
| ⑤ NEW PIZZA | ★と点数の**下**に1行の banner | ⚠️（報酬の瞬間として弱い） |
| ⑥ Dex 登録 | 自動。「登録した」表示が無く、Dex の何番目が埋まったかも見えない | ⚠️ |
| ⑦ Pitz | 「今回の獲得 +N Pitz」。初回発見 bonus は折りたたんだ内訳の中 | ⚠️ |
| ⑧ 次の入荷 | notice + Shop CTA | ✅ |
| **並行経路** | Pizza Select の NEW カード → guided → 見本を写して発見（LK-1 / LK-2） | ❌（loop を迂回する） |
| **並行経路の誤誘導** | LOCKED カードの EP1 文言 | ❌ |

**まとめ:** loop の骨格（①②④⑥⑧）は I4b / I5a までで実装済み。足りないのは、(1) loop を迂回する答え付きの経路を閉じること、(2) ③④の「試したくなる」手がかり、(3) ⑤⑥を報酬の瞬間として立てること、の3つ。

---

## 4. Information disclosure model

### 4.1 Level の定義

| Level | 見せるもの | 例 |
|---|---|---|
| L0 | 何も見せない | 存在すら分からない |
| L1 | 存在だけ | 「発見 3/25」、`？？？` の枠、「今の材料で作れるピザがあるよ」 |
| L2 | recipe 名 | 「フンギ」 |
| L3 | 材料の一部（ソース、材料の数、1〜2種の名前） | 「ソースはオリーブオイル」「材料は全部で3つ」「🥚を使うよ」 |
| L4 | 完成見本（絵）。実質的に材料が全部分かる | `PizzaThumbnail`、見本 popover |
| L5 | 完全な recipe（材料、量、配置） | guided round の見本と hint、Dex の詳細 |

> 注: このゲームの材料の絵は区別しやすいので、L4（見本）は実質 L5 と同じ。L2（名前）も、材料の universe を知っている player には強い手がかりになる（「ハワイアン」→ パイナップル + ハム）。そのため、名前の公開は L3 に近い重さで扱う。

### 4.2 現在の公開 Level（画面 × 対象）

| 画面 | 未発見・材料未入荷 | 未発見・入荷済み（未購入） | 未発見・材料そろい | 発見済み |
|---|---|---|---|---|
| HOME | L1（件数） | L1 | L1 | L1 |
| Pizza Select | **L2**（LK-3）/ フガッサ L1 | **L2** | **L4 → L5**（LK-1 / LK-2）。EP1 で閉じていれば L2 | L5 |
| Recipe Dex | L1 | L1 | L1 | L5 |
| Free Cooking | L0 | L0 | L0（Dex 0 だけ L5 まで上がる、LK-6） | —（作ると名前が出る） |
| Shop | L0 | **L2 + L3**（LK-5。材料を持てば作れるものだけ） | — | — |
| Result | L0 | L0 | ORIGINAL: L0 / INCOMPLETE_MATCH: L1 | L5 |

### 4.3 Progression 2.0 として望ましい公開 Level（提案）

| 画面 | UNKNOWN | KNOWN_BUT_MISSING_MATERIAL | DISCOVERABLE | 発見の瞬間 | DISCOVERED |
|---|---|---|---|---|---|
| HOME | L1 | L1 + Shop badge | L1（吹き出し） | — | L1 |
| Pizza Select | **L0** | **L1**（匿名の prompt カード） | **L1**（匿名の prompt カード） | — | L5 |
| Recipe Dex | L1（`？？？`） | L1 + 🏪 タグ | L1 + 🎨 タグ | NEW badge | L5 |
| Free Cooking | L0 | L1（hint で Shop へ） | **L1 → 最大 L3**（hint を押すごとに1段。OD-DISC-8） | — | 名前（作ったとき） |
| Shop | L0 | **L1**（「新しいピザのヒントになるかも」） | L0 | — | — |
| Result | L0 | L0 | おしい feedback（OD-DISC-7） | **L2 → L5**（名前の公開が報酬） | L5 |

原則:

- **P-1: 名前（L2）は発見の瞬間まで出さない**（OD-DISC-3）。発見の報酬を「名前が分かること」にする。
- **P-2: 見本（L4）と完全な recipe（L5）は発見済みだけ**（OD-DISC-4）。例外は Dex 0 の onboarding hint Level 3 だけ（Issue #182）。
- **P-3: 手がかりは Free Cooking の中で、player が求めた分だけ段階的に出す**（hint）。ほかの画面は L1 で「作れるものがある」「Shop に材料がある」とだけ言う。
- **P-4: 手がかりの対象は DISCOVERABLE だけ。** UNKNOWN の recipe は、どの画面でも話題にしない（まだ作れないものを気にさせない）。

---

## 5. Pizza Select role

### 5.1 3案の比較

| 観点 | **A. 発見済みだけ（再調理画面）** | B. 発見済み + 発見可能な未発見も見せる | C. Recipe Dex とほぼ同じ一覧 |
|---|---|---|---|
| 目的 | 「知っているピザを、見本を見て上手に作る」 | 「次に何を探すか」も選べる | 図鑑を兼ねる |
| 答え漏れ | なし | 見せ方次第。名前や見本を出せば LK-1 と同じ | 同上 |
| Dex との重複 | 小さい（Dex = 未発見の枠を含むコレクション） | 中 | **大きい**（2画面が同じものになる） |
| Free Cooking との関係 | 発見は Free Cooking だけ、と明快 | 「発見するのに、どちらへ行くか」で迷う | 同上 |
| Dex 0 のとき | 空になる → 空の状態を作る必要がある | margherita が1枚 | 全部 `？？？` |
| guided の未発見 recipe | 無くなる（recipe-first discovery を廃止） | 残すかどうかを決める必要がある（I5b-4 OD-PS-2） | 同上 |
| I5b-4 の指摘への効き目 | NEW カードの名前 / 見本 / EP1 文言 / 理由の無い LOCKED / W1 の答え付き NEW を、**表示対象から外すことで全部消せる** | 4状態を作り分ける必要がある | 同上 |
| 実装コスト | card の state を減らす。e2e の helper は、guided の対象を save に seed する必要がある（`e2e/gestures.ts:157` はすでに seed している） | 中 | 中 |

### 5.2 推奨: **A′（発見済み + 匿名の「発見チャンス」カード1枚）**

```
┌ 作るピザを選ぼう！                  [🏠] ┐
│ ┌───────────────────────────────────┐ │
│ │ 🎨 まだ見つけていないピザが           │ │ ← DISCOVERABLE ≥ 1 のとき
│ │    今の材料で作れるかも！             │ │   （名前も見本も出さない）
│ │          [フリークッキングで探す]     │ │
│ └───────────────────────────────────┘ │
│  第1章 はじめのピザ   発見 3/6          │ ← 未発見は件数だけ（L1）
│ [マルゲリータ★★★★][ビスマルク★★★]     │
│ [ブレックファスト★★ NEW]               │ ← NEW = 今回の round で発見（一時的）
│  第2章 …   発見 0/9                    │
└───────────────────────────────────────┘
```

- **カードに出すのは DISCOVERED だけ。** 名前、完成見本、★、BEST、guided CTA（今と同じ）。
- **prompt カード（最大1枚、一番上）:**
  - DISCOVERABLE ≥ 1 → 「🎨 まだ見つけていないピザが今の材料で作れるかも！」→ Free Cooking。
  - DISCOVERABLE = 0 かつ KNOWN_BUT_MISSING_MATERIAL ≥ 1 → 「🏪 ショップに新しい材料が入荷しているよ」→ Shop。
  - どちらも 0 → prompt カード自体を出さない。25 ladder では、発見するとすぐ次の step が入荷する（KBMM = 1）ので、両方 0 になるのは図鑑コンプリートのときだけ（§7.2）。在庫切れは `OUT_OF_STOCK` として KBMM に数える。
- **章の見出し**に「発見 n/m」を出す。未発見は件数だけにする（L1）。
- **Dex 0:** 発見済みが0件なので、カードは無く、prompt カードだけになる。「まずはフリークッキングで1枚目を見つけよう！」→ Free Cooking。#198 の「HOME → Pizza Select は常に到達可能」はそのまま守る（行き止まりにしない）。

### 5.3 I5b-4 finding の解消

| I5b-4 finding | A′ での扱い |
|---|---|
| NEW カードが recipe 名を表示（C4） | 未発見はカードにならない。`NEW` badge の意味を「今回発見した」に変える |
| 完成 thumbnail を表示（C4） | 同上。見本は DISCOVERED だけ |
| EP1 の `requiresRecipeId` 文言が残る（C1 / F-2a） | LOCKED カード自体が無くなるので、文言も無くなる。EP1 のデータは残す（§15） |
| 材料不足の LOCKED で理由が出ない（フンギ） | 材料待ちは prompt カード（Shop）か、Dex の 🏪 タグで表す |
| W1 の新 10 件が、材料がそろうと答え付き NEW になる（C3） | カードの state が EP1 を入力にしないので、W1 と旧 15 件が同じ規則になる（UNKNOWN → KBMM → DISCOVERABLE → DISCOVERED） |

> **I5b-4 の推奨との違い:** I5b-4 §2.4 は、Pizza Select に READY（= DISCOVERABLE）を名前付きのシルエットで出し、LOCKED のうち ladder の次の2 step までは名前を出す案（OD-PS-2 / OD-PS-3）だった。本設計は、名前を発見の報酬にする（P-1）ため、それより一段閉じる。どちらも「見本は出さない」「EP1 文言は使わない」「Free Cooking だけで発見する」は同じ。差は**名前を出すかどうか**だけなので、OD-DISC-3 で選べる。

---

## 6. Recipe Dex role

### 6.1 2案の比較

| 観点 | 発見済みだけのコレクション | **未発見の枠も含む図鑑（推奨）** |
|---|---|---|
| 「図鑑が埋まっていく」感覚 | 弱い（増えていくリスト） | **強い**（空いた枠が埋まる） |
| 全体の大きさ | 件数表示でしか分からない | 一目で分かる（25 枠） |
| Pizza Select との重複 | 大きい（どちらも発見済みのリスト） | 小さい（Pizza Select = 作る、Dex = 集める） |
| 今の実装 | — | すでにこちら（`？？？ まだ見ぬピザ`） |

### 6.2 未発見の枠の見せ方

| 見せ方 | Level | 評価 |
|---|---|---|
| `？？？` のみ | L1 | 今と同じ。安全 |
| **`？？？` + 状態タグ**（🎨 今の材料で作れるかも / 🏪 ショップの材料で作れるかも） | L1 | **推奨**。どの枠が「次」かは分かるが、答えは分からない。Free Cooking / Shop への導線になる |
| シルエット（生地の円 + ？） | L1 | 可。トッピングの形を出すシルエットは L4 に近くなるので**不可** |
| カテゴリだけ（「トマト系」「白いピザ」） | L3 に近い | ソースの種類が分かるので、hint Level 3 と同じ重さになる。W1 では出さない（Post-W1 の hint 報酬候補） |
| 名前だけ | L2 | P-1 に反する。OD-DISC-3 で (b)/(c) を選んだ場合だけ |

### 6.3 Dex の構成（25 件）

```
┌ レシピ図鑑                        [閉じる] ┐
│ 🍕 発見 6/25  あと19種類！   ⭐ 合計★ 22   │
│ ── 第1章 はじめのピザ  6/6 ✓ ──            │
│ [No.01 マルゲリータ ★★★★][No.02 …]       │
│ ── 第2章 まちのピザ屋  0/9 ──              │
│ [No.07 ？？？ 🎨今の材料で作れるかも]        │ ← DISCOVERABLE
│ [No.08 ？？？][No.09 ？？？] …             │
│ ── 第3章 せかいのピザ  0/10 ──             │
│ [No.16 ？？？] …                           │
└──────────────────────────────────────────┘
```

- 枠の番号（No.）は章の中の固定の位置。発見の順番ではない。
- 未発見の枠をタップしても詳細は開かない（開いても何も無い）。🎨 / 🏪 タグの枠だけ、「フリークッキングで探す」/「ショップを見る」の小さな CTA を出す。
- 発見済みの枠: 名前、説明、材料（L5）、★、BEST、作った回数（今と同じ）。
- `NEWLY_DISCOVERED`: `NEW` badge。RESULT から Dex を開いたときは、その枠までスクロールする（§9）。

### 6.4 Pizza Select との役割の境界

| | Pizza Select | Recipe Dex |
|---|---|---|
| 問い | 「今、何を作る？」 | 「何を集めた？ あと何がある？」 |
| 未発見 | 見せない（prompt カード1枚だけ） | 枠として全部見せる（`？？？`） |
| 発見済み | 作る CTA が主役 | 記録（材料、BEST、回数）が主役 |
| 並び順 | 同じ章（§12）。章の中は同じ順 | 同じ |
| 入口 | HOME「ピザを作る」、RESULT「別のピザを作る」 | HOME「ピザ図鑑」、Discovery Result「図鑑を見る」 |

名前の揺れ（HOME header「レシピ N/15」、HOME card「ピザ図鑑」、overlay の見出し「レシピ図鑑」）は1つに揃える。推奨は「ピザ図鑑」（子ども向けで、Pizza Select の「レシピ」と区別しやすい）。W1 の最小 scope に入れてもよい文言変更。

---

## 7. Recipe state model（domain として）

### 7.1 定義（すべて派生。save の schema は増やさない）

入力は `dex`、`ownedIngredientIds`、`unlockedForShopIngredientIds`、`inventory` の4つだけ。**EP1 の `unlockCondition` / `mysteryLock` / `totalStars` は入力にしない。**

| state | 定義 | 備考 |
|---|---|---|
| `DISCOVERED` | Dex の entry が `discovered` | |
| `NEWLY_DISCOVERED` | `DISCOVERED` で、かつ今回の round で発見した recipe | 一時的（`state.justDiscovered` / `lastDiscovery`、次の round で消える）。W1 では保存しない（OD-DISC-6 の補足） |
| `DISCOVERABLE` | 未発見で、必要な材料を全部 OWNED し、有限の材料は在庫 ≥ 1 | 発見の判定は「各材料 1 個以上」（Issue #215 OD-5）なので、在庫 1 で足りる |
| `KNOWN_BUT_MISSING_MATERIAL` | 未発見で、必要な材料が全部 Shop で entitled（OWNED か NEW 行）だが、1つ以上が未購入（`NOT_BOUGHT`）か在庫 0（`OUT_OF_STOCK`） | 名前の「KNOWN」は player が recipe を知っているという意味ではない。コード上は `SHOP_GATED` の方が誤解がない |
| `UNKNOWN` | 未発見で、必要な材料のうち1つ以上がまだ entitled でない | |

優先順: `DISCOVERED` > `DISCOVERABLE` > `KNOWN_BUT_MISSING_MATERIAL` > `UNKNOWN`。

I5b-4 §2.4 の4状態との対応: DISCOVERED = DISCOVERED、READY = DISCOVERABLE、LOCKED（材料待ち）= KBMM と UNKNOWN の一部、UNKNOWN = UNKNOWN。

### 7.2 25 ladder で各 state が同時にいくつあるか（新規 save）

分岐数 1.0（Economy Audit §12.1）なので:

- `DISCOVERABLE` は常に 0 か 1。
- `KNOWN_BUT_MISSING_MATERIAL` は、入荷直後から購入までの間だけ 1（その step の key recipe）。
- 残りは全部 `UNKNOWN`。

migration した save（Dex 15）だけ、`DISCOVERABLE` が 2、全部買うと 6 になる。どの画面も「N 件」を数として扱い、1件である前提を置かない（§15、Post-W1 の分岐でもそのまま使える）。

### 7.3 画面 × state の matrix

| state | Pizza Select | Recipe Dex | Free Cooking | HOME |
|---|---|---|---|---|
| `DISCOVERED` | カード（名前、見本、★、BEST）→ guided | 詳細カード（L5） | 作ると ALREADY_DISCOVERED（名前を出す） | 件数 |
| `NEWLY_DISCOVERED` | 同上 + `NEW` badge | 同上 + `NEW` + スクロール | — | 図鑑カードに `NEW`（次の round まで） |
| `DISCOVERABLE` | prompt カード（匿名）→ Free Cooking | `？？？` + 🎨 タグ | hint の対象（Level 1〜3） | 吹き出し「今の材料で新しいピザが作れるかも！」 |
| `KNOWN_BUT_MISSING_MATERIAL` | prompt カード（Shop 版） | `？？？` + 🏪 タグ | DISCOVERABLE = 0 のとき、hint Level 1 が Shop へ誘導 | Shop カードに `NEW n`、吹き出し「ショップに新しい材料が入ったよ！」 |
| `UNKNOWN` | 出さない（章の件数だけ） | `？？？` | 触れない | 件数 |

JSON 版: `docs/reports/data/TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_state-matrix.json` の `screenStateMatrix`。

### 7.4 置き場所（実装するときの提案）

- `src/state/recipeDiscoveryState.ts`（新規、純関数）に `recipeDiscoveryState(recipe, dex, owned, entitled, inventory)` を置く。
- Pizza Select、Dex、HOME、hint（I6）が同じ関数を使う。I5b-4 §2.4 が言う「派生だけで決める」をそのまま守る。
- `recipeCardState` / `recipeUnlocked` は、この関数に置き換えるか、Lunch Rush（A2 だけに依存）用に残す。実装 slice で決める。

---

## 8. First discovery flow（fresh save → Dex 1 → Shop）

### 8.1 前提

- fresh save: Dex 0、Pitz 0、starter は tomato-sauce / mozzarella / basil（在庫は無制限）。
- 3 材料の空でない組み合わせは7通りで、一致するのは全部を使った場合（margherita）だけ。**初回は自然に当たりやすい。**
- 既存の onboarding（Issue #198）: HOME の Free Cooking が primary、Lunch Rush は disabled、hint は失敗回数で Level 1〜3 に上がる（Level 3 = 答え）。
- 発見の報酬（Economy Audit §2.1）: ★4 なら 150（基本 100 + 初回 50）+ 手際。egg（60 Pitz）はすぐ買える。

### 8.2 flow（推奨）

| # | 画面 | 見えるもの | 操作 | 備考 |
|---|---|---|---|---|
| 1 | HOME（Dex 0） | 2+1 の骨格（I5b-4 §1）: `[🍕 ピザを作る][🔒 ランチラッシュ]` / `[🎨 フリークッキング]`（primary）。吹き出し「まずはフリークッキングで最初の1枚を見つけよう！」。`🔒 まず1枚ピザを発見しよう` | フリークッキング | 「ピザを作る」は enabled の secondary（OD-UX-1）。押すと Pizza Select の空の状態（prompt カードだけ）→ Free Cooking |
| 2 | Free Cooking | tray は3材料。order-card「🎨 フリークッキング / 好きな具をのせて『焼く！』」 | 生地 → ソース → チーズ → 具 → 焼く | 1回目の hint は今と同じ（Level 0）。**見本は出さない** |
| 3a | 判定: 一致 | → 4 | | |
| 3b | 判定: 不一致 | ORIGINAL / FAILED | もう一度 | 失敗回数で hint が Level 1 → 2 → 3 に上がる（既存）。Level 3 は答え（LK-6、onboarding の例外として維持） |
| 4 | **Discovery Result（初回版）** | ① `NEW PIZZA!` stamp ② 名前「マルゲリータ」（ここで初めて出る）③ 自分のピザ（hero、既存）④「📖 ピザ図鑑に登録！ No.01」⑤ `+150 Pitz`（初回発見 +50 を明記）⑥ `🆕 新しい材料が入荷：たまご` | primary `[🛒 ショップを見る]`、secondary `[📖 図鑑を見る]` / `[もう一度じゆうに作る]` | ★と点数は1行に縮める（§16）。初回だけ Teto の1行「図鑑が1ページうまったね！新しい材料も届いたよ」 |
| 5 | Shop | たまごの行が一番上、`NEW 入荷`、初回 60 Pitz、「10ピザ分（10個）」。**recipe 名は出さない** | 仕入れる | 初回だけ、たまごの行を強調（coach mark 1枚）。購入後のメッセージ「📦 たまごを仕入れました！ 🎨 フリークッキングで使ってみよう」 |
| 6 | HOME（Dex 1） | 骨格は同じ 2+1。「ピザを作る」が primary に戻る（Dex ≥ 1 の今のクラス）。ランチラッシュが解放。図鑑カードに `NEW`。吹き出し「今の材料で新しいピザが作れるかも！」 | | ランチラッシュの解放は初回だけ toast「⏱ ランチラッシュが遊べるようになった！」 |
| 7 | Free Cooking（2回目） | tray の卵に `NEW` の小さな印 | | 次の発見（ビスマルク）へ |

### 8.3 HOME の変化（I5b-4 OD-UX-1 との整合）

| | Dex 0 | Dex 1（直後） | Dex ≥ 1（通常） |
|---|---|---|---|
| CTA の骨格 | 2+1 | 2+1 | 2+1 |
| primary | フリークッキング | ピザを作る | ピザを作る |
| ランチラッシュ | disabled + 理由 | enabled（初回 toast） | enabled |
| 図鑑カード | 発見 0/25 | 発見 1/25 + `NEW` | 発見 N/25 |
| Shop カード | 所持 Pitz | 所持 Pitz + `NEW 1`（未購入の入荷がある間） | 同左 |
| 吹き出し | 最初の1枚を見つけよう | ショップに新しい材料が入ったよ！（未購入のとき）| DISCOVERABLE ≥ 1 なら「今の材料で新しいピザが作れるかも！」 |

Dex 0 → 1 で変わるのは class（primary / secondary）と badge だけで、CTA の位置は動かない（I5b-4 §1 の Fresh Design と同じ）。

### 8.4 初回だけの特別な tutorial は要るか

| 案 | 評価 |
|---|---|
| 専用 tutorial 画面（説明を読ませる） | **不要**。3 材料なので自然に当たる。答えを読ませると発見の喜びが消える |
| 既存の失敗回数による hint（Level 1〜3） | **維持**。onboarding だけは答え（Level 3）まで許す（Issue #182） |
| 初回だけの追加演出 | **推奨（小さく）**: Discovery Result の Teto の1行、Shop のたまご行の coach mark 1枚、HOME のランチラッシュ解放 toast。どれも1回だけで、閉じたら二度と出ない（一時的な UI 状態か、既存の `dex` の件数 = 1 から派生させる。save は増やさない） |

---

## 9. Normal discovery flow（Dex N → N+1）

```
[RESULT / HOME]  🆕 入荷 → [🛒 ショップを見る]
      ▼
[Shop]  NEW 行（初回価格、pack 量）→ 仕入れる →「🎨 フリークッキングで使ってみよう」
      ▼
[HOME]  吹き出し「今の材料で新しいピザが作れるかも！」→ 🎨 フリークッキング
      ▼
[Free Cooking]  tray の新しい材料に NEW 印。hint ボタン = 1段ずつ（§12）
      ▼
[BAKE → RESULT]
   ├ 不一致 → Wrong-attempt Result（§11）→ もう一度
   └ 一致（未発見）→ Discovery Result
        1. NEW PIZZA! stamp
        2. 名前（最大2行）
        3. 自分のピザ（hero）
        4. 📖 図鑑に登録！ No.k（章 n/m）
        5. ★ と点数（1行）＋ 今回の獲得 +N Pitz（初回発見 +50 込み）
        6. 🆕 新しい材料が入荷：○○（あれば）
        CTA: primary = [🛒 ショップを見る]（入荷があるとき）/ [もう一度じゆうに作る]（無いとき）
             secondary = [📖 図鑑を見る]、[別のピザを作る]
```

- `📖 図鑑を見る` は DexOverlay を開き、NEW の枠までスクロールする。閉じると RESULT に戻る。
- 入荷が無い発見（25 件目の quattro-formaggi）では、primary を「もう一度じゆうに作る」にし、6 の代わりに「🏆 図鑑コンプリート！」（章が埋まったときは「第2章 コンプリート！」）を出す。
- 「一度に情報を出しすぎない」ための順番: **発見（名前）→ 登録 → 報酬 → 次の行動**。★の詳細、Pitz の内訳、CUT、Timing は今と同じく折りたたむ。

---

## 10. Material unlock moment

### 10.1 どこで伝えるか（比較）

| 案 | 内容 | 利点 | 欠点 | 評価 |
|---|---|---|---|---|
| a. Result overlay（今） | RESULT の中の notice + `🛒 ショップへ` | 実装済み。発見の直後なので因果が分かる | 発見の banner と同じ画面に詰まる | **W1 で維持**（並び順だけ変える） |
| b. Discovery overlay | 発見演出の最後の beat として「新しい材料が入荷しました！」 | 報酬の山を作れる | tap が1回増える | Post-W1（演出 overlay と一緒に） |
| c. HOME | 吹き出しと Shop カードの badge | RESULT を読み飛ばしても残る。load 時の migration の入荷も拾える | 単独では弱い | **W1 で追加**（派生 badge、save 変更なし） |
| d. Shop badge | Shop の中の `NEW 入荷` | 実装済み | Shop に来ないと見えない | 維持 |

**推奨: a + c（W1）、b は Post-W1。** RESULT で知らせ、HOME にも残す。どちらも「entitled で未購入の材料」から派生させるので、既存の save でも新しい save でも同じに動く（Economy Audit §9 の「load 時の入荷に通知が無い」も HOME の badge で拾える）。

### 10.2 複数材料の同時 unlock

25 ladder で2材料の step は2つだけ（step 11: black-olive + oregano、step 24: fontina + gorgonzola）。migration の load 時は3件以上になりうる（Dex 15 → eggplant / corn / pineapple）。

| 件数 | RESULT の notice | HOME |
|---|---|---|
| 1 | `🆕 新しい材料が入荷：たまご` | Shop カード `NEW 1` |
| 2 | `🆕 新しい材料が入荷：ブラックオリーブ・オレガノ`（名前ごとに改行できる。既存の I4b fix `fc1b885`） | `NEW 2` |
| 3 以上 | `🆕 新しい材料が入荷：○○・○○ ほか1種` | `NEW n` |

- 360×800 の RESULT 1-Screen で notice は最大2行（I4b の計測）。3件目以降は「ほか N種」に畳んで、2行を超えないようにする。
- 2材料 step は価格が 160 / 200 で、1回の発見報酬を超える（Economy Audit F-02）。notice の CTA の横に不足額は出さない（Shop の行ごとの「あと N Pitz たりません」で足りる）。1つだけ先に買えることも Shop で分かる。

---

## 11. Wrong attempt（Free Cooking で正解でないとき）

### 11.1 現在の挙動

| 結果 | 判定 | RESULT の表示 | Dex / Pitz / 在庫 |
|---|---|---|---|
| 料理として成立しない（生、焦げ、空） | FAILED | 「失敗」+ 理由、+0 Pitz | 在庫は消費する |
| どの recipe とも一致しない | ORIGINAL | 「🎨 オリジナルピザ完成！ 図鑑にはない、あなただけのピザ！」+ 使った材料 | 変化なし（在庫は消費） |
| 複数の target と一致 | AMBIGUOUS | ORIGINAL と同じ | 同上 |
| 集合は一致したが、その recipe の Completion Gate を満たさない（ソースの量、焼き加減） | INCOMPLETE_MATCH | 「図鑑のピザまであと少し…！ソースや焼き加減を変えてみよう。」 | 同上 |
| 発見済みの recipe と一致 | ALREADY_DISCOVERED | 「📖 ○○ができた！（発見済み）」+ ★ / Pitz | BEST / 回数を更新 |
| 量だけ違う（集合は一致） | **発見になる**（量は identity ではない） | Discovery + `quantityNoteJa`（量の注記） | 量は Scoring 2.0 の quantity factor で点数に反映 |

### 11.2 25 ladder で「自然な間違い」はどこに出るか

付属 JSON の `ladder25` で、各 key recipe を「その時点で発見済みの一番近い recipe」と比べた。

| パターン | 件数 | 例 | 自然な間違い |
|---|---:|---|---|
| 既知 + 新材料だけ | 3 | breakfast（ビスマルク + ベーコン）、melanzane（マルゲリータ + なす）、parmigiana | ほぼ無い |
| 既知 + 新材料 − 1つ | 6 | **bismarck（マルゲリータ − バジル + たまご）**、funghi、pepperoni、salsiccia、hawaiian、pizza-bianca | **1つ多い**（バジルを残す）。最初の発見の直後、2件目で必ず出会う |
| 組み直し（古い材料を足す / ソースを変える / チーズを抜く） | 15 | meat-lovers（ベーコン + ソーセージ + ペパロニ + ハム）、fugazza（トマトソースとチーズを抜いてオリーブオイル）、marinara（チーズなし）、genovese（pesto に変える） | 1〜3個の過不足。**「チーズなし」「ソースを変える」は初めて出る概念** |

→ W1 の後半（T2 の後半から T3）では、何も手がかりが無いと当てずっぽうになる。「おしい」の区別と hint（§12）が必要。

### 11.3 どこまで区別するか（提案）

判定は、**DISCOVERABLE の recipe だけ**を相手にした純関数で行う（UNKNOWN の recipe を相手にすると、まだ作れない recipe の存在を漏らす。P-4）。

| 区別 | 条件 | 表示（例） | 開示 | 推奨 |
|---|---|---|---|---|
| 完全失敗 | FAILED | 今と同じ（理由 + 焼き直しの提案） | — | 維持 |
| 既知 recipe になった | ALREADY_DISCOVERED | 「📖 ○○ができた！（発見済み）」+「まだ見つけていないピザもあるよ」（DISCOVERABLE ≥ 1 のとき） | — | W1（1行足すだけ） |
| 未発見に近い: **1つ多い** | 集合が DISCOVERABLE の recipe + 1材料 | 「🤏 おしい！ 材料が1つ多いかも」 | L1 + 方向 | **推奨**（OD-DISC-7） |
| 未発見に近い: **1つ足りない** | 集合が DISCOVERABLE の recipe − 1材料 | 「🤏 おしい！ あと1つ何かが足りないかも」 | L1 + 方向 | **推奨** |
| 未発見に近い: 1つ違う（入れ替え） | 1つ多くて1つ足りない | 「🤏 おしい！ 1つだけちがうかも」 | L1 | 推奨 |
| ソース / 焼き加減だけ | INCOMPLETE_MATCH | 今と同じ「あと少し…ソースや焼き加減を変えてみよう」 | L1 | 維持 |
| 量だけ違う | （発見になる） | Discovery + 量の注記 | — | 維持 |
| 材料不足 | DISCOVERABLE = 0 で KBMM ≥ 1 | 「🏪 ショップに新しい材料があるよ」 | L1 | W1（HOME / Pizza Select の prompt と同じ文言） |
| 遠い（2つ以上違う） | 上のどれでもない ORIGINAL | 今と同じ「あなただけのピザ！」+「新しく入荷した材料を使ってみた？」（新材料を使っていないとき） | L1 | 推奨 |

- **どの材料が多い / 足りないかは言わない。** 言うのは hint（Level 3）の役割にする。
- 「1つ多い」と「1つ足りない」を分けて言うかどうか（方向を教えるかどうか）が OD-DISC-7 の中心。
- 在庫: 失敗しても在庫は消費する。Economy Audit §13 で、失敗 5 回 / step でも ★2 以上は作り直しの強制 0。feedback を増やしても経済は変わらない。
- 同じ ORIGINAL を何度も作ったとき（同じ集合の連続）: 2回目から「さっきと同じ組み合わせだよ」を添える（Post-W1。round をまたぐ一時状態が要る）。

### 11.4 「答えを教えないが、もう一度試したくなる」ための形

- Result の CTA の primary を「もう一度じゆうに作る」にする（今と同じ）。「おしい」のときは、その下に `[💡 ヒントを見る]` を出し、次の round の hint を1段上げた状態で始める（hint の段階は round ごと。§12）。
- 見出しは「失敗」にしない。ORIGINAL は「🎨 オリジナルピザ完成！」のまま（Phase 3-2 の方針）。
- 自分が使った材料の一覧（今と同じ）は残す。比べる材料になる。

---

## 12. Hint integration（I5b-4 §6 との統合）

### 12.1 Free Cooking の hint（発見の支援）

I5b-4 の contextual hint を、本設計の state model に接続する。対象は **DISCOVERABLE の recipe**（0件なら KBMM、それも無ければ操作説明）。

| Level | 出すもの | 例 | 開示 |
|---|---|---|---|
| 0（常に出す行） | 工程の操作 | 「好きな具をのせて『焼く！』」 | — |
| 1 | 探索の方向 | 「まだ見つけていないピザが、今の材料で **1つ** 作れるよ！」/ 0件なら「ショップに新しい材料が入荷しているよ」 | L1 |
| 2 | 最近入荷した材料 | 「新しく入荷した **たまご** を使ってみよう！」 | L1〜L3 の間（分岐 1.0 では、新材料 = 答えの一部。これは受け入れる） |
| 3 | 材料の一部: **ソースと、材料の数** | 「ソースは **オリーブオイル**。材料は全部で **3つ** だよ」/「チーズは使わないよ」 | L3 |
| 4（任意、OD-DISC-8） | 材料をもう1つ（最後の1つは言わない） | 「**オレガノ** も使うよ」 | L3（強） |
| — | 答え全部 | **出さない**。Dex 0 の onboarding だけ例外（既存の Level 3） | L5 |

規則:

- ボタンを1回押すと1段上がる。段階は **round ごと**（保存しない）。§11.4 の「💡 ヒントを見る」から来たときは Level 1 から始める。
- Level 3 は「ソース」と「材料の数」を先に出す。§11.2 の組み直し（ソース変更、チーズなし）がつまずきの中心だから。
- DISCOVERABLE が複数（migration した save、Post-W1 の分岐）のときは、Level 1 で件数を言い、Level 2 以降は「最近入荷した材料を使うもの」を1件選んで対象にする（どれを選んだかは言わない）。
- 本文は order-card の中で1行に収める（I5b-4 §4 の高さの制約）。
- score の penalty は入れない（今回の指示どおり）。

### 12.2 Dex 0 の onboarding hint（既存）との関係

- 失敗回数で自動で上がる仕組み（`preDiscoveryFreeCookAttempts`）は Dex 0 だけに残す。
- Dex ≥ 1 では自動では上げず、ボタンで上げる（player が求めた分だけ）。

### 12.3 guided（発見済みの作り直し）の hint

I5b-4 §6 の GUIDED 表（Level 0〜2、BAKE の目安）のまま。発見済みだけが guided の対象になるので（§5）、guided の hint がどれだけ具体的でも答え漏れにはならない。

### 12.4 他の画面の hint との一貫性

| 画面 | 出す手がかり | 最大 Level |
|---|---|---|
| HOME の吹き出し | 「今の材料で新しいピザが作れるかも！」/「ショップに新しい材料が入ったよ！」 | L1 |
| Pizza Select の prompt カード | 同上 | L1 |
| Dex の枠のタグ | 🎨 / 🏪 | L1 |
| Shop | 「🎨 新しいピザのヒントになるかも」（その材料を買うと DISCOVERABLE が増えるとき） | L1 |
| Free Cooking | Level 1〜3（4） | L3 |
| Result（wrong attempt） | おしい（方向） | L1 + 方向 |

**Level 2 以上の手がかりは Free Cooking の中だけ。** player が自分で求めたときだけ出る。

---

## 13. Material unlock flow（まとめ）

```
REGISTER_TO_DEX（発見）
  └ resolveShopEntitlement → newlyUnlockedMaterialIds
       ├ RESULT: 🆕 新しい材料が入荷：○○（最大2名 + ほか N種）
       │         primary CTA = [🛒 ショップを見る]
       ├ HOME:   Shop カードに NEW n（entitled かつ未所持の数。派生）
       │         吹き出し「ショップに新しい材料が入ったよ！」
       └ Shop:   NEW 行が一番上（今と同じ）

load 時の migration（App.tsx の resolveShopEntitlement）
  └ RESULT は出ない → HOME の Shop badge だけで知らせる（派生なので自動で出る）
```

---

## 14. Shop NEW flow

### 14.1 LOCKED / NEW / OWNED と discovery loop

| 材料の状態 | Shop の表示（今） | 提案 |
|---|---|---|
| LOCKED（ladder 未到達） | 並べない。「🔜 あとN つ発見で新しい材料が入荷」を1行 | 維持。材料名は出さない |
| NEW（entitled、未購入） | `NEW 入荷`、初回価格、pack 量、「これを買うと: 🍕 ○○」 | badge、初回価格、pack 量は維持。**「これを買うと: 🍕 ○○」を削除**し、「🎨 新しいピザのヒントになるかも」に置き換える（LK-5） |
| OWNED | 在庫、補充価格、`+` pack | 維持 |
| OWNED で在庫 0 | 在庫 0 の表示 | その材料が DISCOVERABLE の recipe に要る場合でも、recipe 名は出さない。HOME の吹き出しで「材料が足りないかも。ショップで補充しよう」 |

### 14.2 NEW 材料について何を出すか

| 項目 | 出す？ | 理由 |
|---|---|---|
| badge（`NEW 入荷`） | ✅ | 次にやることの印 |
| 初回価格 | ✅ | 購入の判断に要る |
| pack 量（「10ピザ分（30個）」） | ✅ | 「何回試せるか」の目安にもなる（失敗 9 回分の余裕。Economy Audit §13） |
| 使えそうな pizza の hint | **L1 だけ**（「🎨 新しいピザのヒントになるかも」） | 名前（L2）や組み合わせ（L3）は出さない |
| 購入後の feedback | 「📦 ○○を仕入れました！ 🎨 フリークッキングで使ってみよう」（今の1行目と2行目） | 3行目の「🍕 新しいピザが作れます！「○○」」を削除（LK-5） |

- 「ヒントになるかも」を出す条件は「その材料を買うと DISCOVERABLE の件数が増える」。分岐 1.0 では NEW 行はいつもこれに当たるので、実質的には常に出る。Post-W1 の分岐（どの材料を先に買うか選べる）で意味を持つ。
- Shop の中の並び: NEW を一番上（今と同じ）。
- Economy Audit F-09（価格変更の告知）は本設計の範囲外（OD-ECO-2）。

---

## 15. EP1 compatibility assessment

### 15.1 旧 15 件の EP1 chain が今どこで使われているか

| 使われ方 | 場所 | 分類 |
|---|---|---|
| データ | `Recipe.unlockCondition`（旧 14 件）、`Recipe.mysteryLock`（フガッサ）（`src/data/recipes.ts`） | **データ** |
| save | **無い。** EP1 の解放状態は保存していない（`dex` から毎回派生）。保存されている `starterGrantClaimedRecipeIds` は EP4（退役済み）のもので、EP1 ではない | — |
| runtime gate | `recipeUnlocked` → `isRecipeAvailable`（Pizza Select のカード状態、`availableRecipeIds`）、`recipesUnlockedByIngredient`（Shop の「これを買うと」） | **runtime gate** |
| Lunch Rush | `availableRecipeIds` を使うが、発見済みだけに絞る（`lunchRush.ts:98`）。A2 で発見済みは常に unlocked なので、**EP1 は実質的に効いていない** | gate（実効なし） |
| Free Cooking / matcher | 使わない | — |
| Pizza Select の表示 | `unlockHintFor`（「○○を1枚完成させると解禁」「あと★N」）、`mysteryLock` の `？？？` | **表示** |
| legacy の計算 | `starterStock.ts:125`（EP4、退役済み）、`economySimulation.ts:238`（シミュレーション） | legacy |
| tests | `progression.test.ts`、`pizzaSelect.test.ts`、`PizzaSelectScreen.test.tsx`、`recipes.test.ts`、`gameReducer.test.ts`、`gameReducer.materialShop.test.ts`、`gameReducer.completionGate.test.ts`、`phase4a1a.regression.test.ts`、`starterStock.test.ts`、`economySimulation.test.ts`、`App.test.tsx`、`App.playerReference.test.tsx`、`e2e/gestures.ts`（コメントとして） | **legacy tests** |

> **混同しやすい点:** `Ingredient.unlockCondition`（材料側、`minTotalStars`）は EP1 chain とは**別物**。今は「starter か有限の材料か」の印として使われている（`materialEntitlement.ts` の `isFiniteMaterial`、`obtainableIngredientIds`）。EP1 の整理で触ってはいけない。

### 15.2 「削除」と「表示 / 門番から外す」の区別

| 操作 | 何が変わるか | save への影響 | 推奨 |
|---|---|---|---|
| (1) Pizza Select の表示から外す（`unlockHintFor` を使わない） | EP1 の文言が消える | なし | **W1 で行う**（I5b-4 F-2a と同じ） |
| (2) Pizza Select の門番から外す（カード状態を §7 の state model で決める） | 未発見の recipe は、EP1 に関係なく §7 の規則になる | なし | **W1 で行う**（§5 の A′ と一緒） |
| (3) Shop の門番から外す（`recipesUnlockedByIngredient` を使わない） | 「これを買うと」の名前が消える | なし | **W1 で行う**（LK-5） |
| (4) `recipeUnlocked` 自体から EP1 を外す | Lunch Rush は実効なし。関数を使う場所が残るなら | なし | (1)〜(3) の後。任意 |
| (5) データを削除（`unlockCondition` / `mysteryLock` のフィールド） | 型と tests が変わる | なし（保存していない） | **W1 ではしない**。Post-W1 の cleanup で、legacy tests と一緒に |

- (1)〜(3) で、player から EP1 は完全に見えなくなる。データは残るので、元に戻すのも簡単。
- 保存に EP1 の状態が無いので、どの操作でも save compatibility の問題は起きない。
- A2（発見済み ⇒ unlocked）は、(4) の後も Lunch Rush の出題候補の規則として意味を保つ（「発見済みなら作れる」）。

### 15.3 Owner Decision

OD-DISC-5（§20）。I5b-4 の OD-PS-1（推奨 b: データは残して表示と gate から外す）と同じ方向。本設計はその範囲を Shop（LK-5）まで広げる。

---

## 16. 25-recipe structure

### 16.1 前提（W1 target）

25 recipe、入手可能な材料 29、material step 24（Economy Audit §1.1）。2材料の step は 11 と 24。

### 16.2 章の再評価

| 案 | 分け方 | 章の意味 | 章が「完成」する時期 |
|---|---|---|---|
| I5b-4 の案: authored 7 / 8 / 10 | 旧 Issue #88 の7件 / Batch 1A の8件 / W1 の10件 | **開発の batch の歴史**。player には意味が無い | 第1章に quattro-formaggi（step 24、最後）と fugazza（step 13）が入るので、**第1章は最後まで完成しない** |
| 位置で機械的に（今の fallback） | 7 / 8 / 8 / 2 | 無い | — |
| **推奨: ladder の price tier で 6 / 9 / 10** | 第1章 = margherita + step 1〜5（T1 60 Pitz）/ 第2章 = step 6〜14（T2 80）/ 第3章 = step 15〜24（T3 100） | **進行の段階**。価格の段階と一致する | **順番に完成する**（第1章は発見 6 件目で完成）→ 章の完成を小さな節目にできる（Post-W1 の collection reward の hook） |
| 味の系統（トマト / 白 / ジェノベーゼ / 肉 / 海） | 5〜6 系統 | コレクションとしての意味 | ばらばらに埋まる → 一本道感を弱める |

- 推奨の各章の中身（付属 JSON の `proposedChapter`）:
  - 第1章（6）: margherita、bismarck、breakfast-pizza、funghi、melanzane-pizza、parmigiana-pizza
  - 第2章（9）: pepperoni、salsiccia、meat-lovers、bambino、hawaiian、capricciosa、pizza-portuguesa、fugazza、marinara
  - 第3章（10）: napoletana、tonno-e-cipolla、pesto-tonno、genovese、new-haven-apizza、pesto-caprese、pesto-patate、pizza-bianca、puttanesca-pizza、quattro-formaggi
- **章の中の並び順は ladder の順にしない**（`RECIPES` の宣言順などの固定順）。ladder の順に並べると「No.k の次は No.k+1」になり、Dex が左から順に埋まる。一本道が見た目でも強調される（§17）。
- 章の決め方を一般化すると、「その recipe の材料のうち、一番遅く入荷する材料の step の tier」。key recipe では key step の tier と同じになる。Post-W1 で key でない recipe（side recipe）が入っても、同じ規則で章が決まる。
- 章の名前は仮（「はじめのピザ」「まちのピザ屋」「せかいのピザ」）。OD-DISC-9。
- これは I5b-4 OD-PS-4（推奨 7 / 8 / 10）を再評価した結果。**章は単なるページ分割ではなく、進行の段階として意味を持たせる**、というのが本設計の立場。

### 16.3 Pizza Select と Dex の情報構造（25 件）

| | Pizza Select（A′） | Recipe Dex |
|---|---|---|
| 件数 | 発見済みだけ（0〜25）+ prompt カード | 常に 25 枠 |
| 章 | 同じ3章。発見済みが0の章は見出しと「0/m」だけ | 同じ3章 |
| 1章の長さ | 最大 10 枚 = 2列で5行 | 10 枠 |
| 長い名前 | 2行 + `line-clamp`（I5b-4 §2.5） | 同左 |
| 章へのジャンプ | 発見が増えたら（Post-W1） | 章の見出しの chip（Post-W1） |

A′ では、Pizza Select の長さが発見に応じて伸びる。序盤は短く、「25 件のスクロール」問題（I5b-4 §2.5）は終盤だけになる。

---

## 17. Branching assessment

### 17.1 事実

- 新規 save の分岐数は、全 Dex で平均 / 最小 / 最大 = 1.0（Economy Audit §12.1）。W1 では変えない。
- どの時点でも DISCOVERABLE は 0 か 1。次に作るものは、構造上いつも1つに決まっている。

### 17.2 Discovery UX が一本道感を**強めない**ための設計

| やらないこと | 理由 |
|---|---|
| 「次は ○○ を作ろう」と recipe を名指しする | 一本道を宣言することになる（P-1 でも禁止） |
| Dex を ladder の順に並べる | 左から順に埋まって、進行が1本の線に見える（§16.2） |
| 「次の入荷まであと1」のような、1本の進行バーを主役にする | 同上 |
| hint で「1つ作れるよ」を強調する | 件数は事実として言うが、演出しない |

| やること | 効果 |
|---|---|
| 「発見」を、player の試行（組み合わせ）の結果として見せる | 当てた感覚は、分岐数ではなく試行の自由度から来る |
| ORIGINAL を失敗扱いしない（今の方針を維持） | 「何を作ってもいい」感覚を保つ |
| Dex を固定の枠で、ばらばらに埋まるように並べる | コレクション感 |
| 章の完成を節目にする（Post-W1） | 1本の長い線を、3つの短い区間に分ける |
| 発見済みの作り直し（★ / BEST）と Lunch Rush を副 loop として出す | 「次の発見」だけが目的にならない |

### 17.3 Post-W1 Progression 2.1 で再利用できるように

本設計は、どこでも「1件」を前提にしていない。

| Post-W1 の要素 | 本設計のどこがそのまま使えるか |
|---|---|
| 複数の recipe 候補（DISCOVERABLE ≥ 2） | state model は件数で扱う。hint の Level 1 は件数を言う。prompt カードは「N 個作れるかも」 |
| 材料の unlock の分岐（どの材料を先に買うか） | Shop の「🎨 新しいピザのヒントになるかも」が、買うと DISCOVERABLE が増える材料だけに付く |
| optional discovery / side recipe | 章は「最後に入荷する材料の tier」で決まる（§16.2）。Dex の枠と state は key かどうかに依存しない |
| 実績 / collection reward | 章の完成、図鑑コンプリートの節目（§9） |

---

## 18. Result screen relationship

### 18.1 比較

| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| a. 今のまま（1つの ResultPanel に全部） | ★ / 点数 → 発見の banner → 入荷 → Pitz → CUT / Timing | 実装済み。1画面 | 発見が★の下に埋もれる。新規発見の round が、情報が一番多い round になる |
| **b. 同じ component の中で、新規発見のときだけ並び順を変える（Discovery Result variant）** | 新規発見: 発見 → 登録 → 報酬（★は1行）→ 入荷 → CTA。既知 / guided: 今と同じ（品質中心） | 新しい画面を作らない。RESULT 1-Screen 2.0 の高さの予算の中で収まる | 演出は控えめになる |
| c. 発見 overlay（演出）→ 通常 Result の2段 | 1段目: NEW PIZZA! の演出、名前、図鑑登録。2段目: 品質 Result | 報酬の瞬間を最大にできる | tap が1回増える。reduced-motion と長い名前の対応が要る |

### 18.2 推奨: **W1 = b、Post-W1 = c**

**既知の recipe（ALREADY_DISCOVERED、guided の作り直し）: 品質中心（今と同じ）**

```
[Teto の一言]
★★★★☆  82点   🔥 焼き加減: ちょうどいい
（NEW BEST! があれば）
今回の獲得 +106 Pitz ▸内訳
▸カット ▸タイミング
[もう一度つくる] [別のピザを作る]
```

**新規発見（NEW_DISCOVERY）: 発見中心（W1 の variant）**

```
NEW PIZZA! ✨
┌──────────────────┐
│ マルゲリータ        │ ← 大きく。最大2行、それ以上は省略
└──────────────────┘
📖 ピザ図鑑に登録！ No.01（第1章 1/6）
★★★★☆ 82点 ・ +156 Pitz（初回発見 +50）    ← 1行
🆕 新しい材料が入荷：たまご                  ← あれば
[🛒 ショップを見る]                          ← primary（入荷があるとき）
[📖 図鑑を見る] [もう一度じゆうに作る]        ← secondary
▸内訳 ▸カット ▸タイミング（折りたたみ）
```

- 焼き加減の badge と Teto の一言は、発見 variant では出さない（高さを空ける）。
- ORIGINAL / FAILED は今と同じ構造で、§11 の文言だけ変える。

---

## 19. Animation / feedback

実装はしない。優先度と reduced-motion の扱いだけ決める。

| 優先 | feedback | 内容 | reduced-motion | 時期 |
|---|---|---|---|---|
| P1 | NEW PIZZA! stamp | 0.3 秒で scale 1.4 → 1.0、少し回転 | fade だけ（または即表示） | W1 |
| P1 | 名前の reveal | `？？？` → 名前に切り替わる（0.4 秒の fade / slide） | 即表示 | W1 |
| P1 | HOME の badge（Shop `NEW n`、図鑑 `NEW`） | 静的な badge | 同じ | W1 |
| P2 | 図鑑登録 | 「📖 No.01」のカードが、Dex の枠に吸い込まれる動き | 即表示 | Post-W1 |
| P2 | Dex の NEW 枠 | 開いたとき、その枠までスクロールして、光る | スクロールだけ（光らない） | W1（スクロール）/ Post-W1（光） |
| P2 | material unlock | 材料の絵が箱から出る | 即表示 | Post-W1 |
| P2 | tray の NEW 材料の印 | 小さな点 / `NEW` | 同じ | I6 |
| P3 | 章の完成 | 「第1章 コンプリート！」の帯 | 即表示 | Post-W1 |
| P3 | 音 / haptics | 発見のジングル、短い振動 | 設定で切れる | 別 Phase |

- 共通: `@media (prefers-reduced-motion: reduce)` で transform の animation を止め、opacity だけにするか即表示にする。
- 演出のせいで CTA が押せない時間を作らない（演出中でも CTA は表示し、押せる）。

---

## 20. Mobile UX

### 20.1 前提

- 画面サイズ 390×844 / 360×800。実際の表示領域は、最悪で 390×664 / 360×640（I5b-4 §0）。
- RESULT 1-Screen 2.0 の予算の中で収めること。CTA bar は I5b-4 §4 の layout 契約（in-flow、safe-area 込み）に従う。

### 20.2 Discovery Result の高さの予算（360×640 の表示領域）

| 要素 | 高さの目安 | 対策 |
|---|---|---|
| header | 56 | 既存 |
| hero pizza（自分のピザ） | 可変（残りの高さ） | I5b-4 の「余りの高さを使う唯一の要素」にする |
| `NEW PIZZA! ✨` | 32 | 1行固定 |
| 名前 | 最大 2 行（22px × 1.2 × 2 ≈ 53） | `line-clamp: 2`、中黒の位置で改行（`<wbr>`）。最長の候補「ニューヘイブン・アピッツァ」も2行に収まる |
| 図鑑登録の行 | 20 | 1行、省略記号 |
| ★・点数・Pitz の行 | 24 | 1行 |
| 入荷 notice | 最大 2 行 + CTA | 名前は2件まで、3件目から「ほか N種」 |
| CTA bar | 2 段（primary + secondary 2つを1行） | in-flow |

合計の固定部分は約 260〜300px。hero が残りを使う。360×640 でも hero に約 280px 残る。

### 20.3 他の画面

- Pizza Select の prompt カード: 1枚、高さ 72px 以内（文言1行 + ボタン）。
- Dex の未発見の枠: 発見済みの枠と同じ高さ。タグは1行、省略記号。
- HOME の badge: 既存のカードの角に重ねる（高さを増やさない）。
- 長い材料名の notice: 既存の「名前ごとに改行できる」実装（`fc1b885`）を維持する。

---

## 21. Recommended W1 scope（最小）と Post-W1

### 21.1 W1 の最小 scope（実装 slice の提案。今回は実装しない）

| slice | 内容 | 主なファイル | 依存 |
|---|---|---|---|
| **W1-a 答え漏れを閉じる（Pizza Select）** | §7 の state model（純関数）。Pizza Select を A′ にする（発見済みのカード + 匿名 prompt カード）。未発見の名前 / 見本 / EP1 文言を出さない。Dex 0 の空の状態 | `src/state/recipeDiscoveryState.ts`（新規）、`pizzaSelect.ts`、`PizzaSelectScreen.tsx` | **I5b-3 と同時期**（入らないと LK-7）。I5b-4c と同じ場所なので、I5b-4c と1つにまとめるのがよい |
| **W1-b 答え漏れを閉じる（Shop）** | 「これを買うと: 🍕 ○○」と購入後の recipe 名を削除し、「🎨 新しいピザのヒントになるかも」にする | `ShopOverlay.tsx` | なし |
| **W1-c EP1 を表示と gate から外す** | W1-a / W1-b の結果として。データと legacy tests は残す（§15.2 の (1)〜(3)） | 同上 | OD-DISC-5 |
| **W1-d Discovery Result variant** | 新規発見のときの並び順（§18.2）。名前 2 行 clamp。入荷 notice の「ほか N種」。primary CTA を Shop に | `ResultPanel.tsx`、`GameScreen.tsx` | OD-DISC-6 |
| **W1-e HOME の状態表示** | 2+1 の骨格（I5b-4a）。Shop カードの `NEW n`、図鑑カードの `NEW`、吹き出しの文言（すべて派生） | `HomeScreen.tsx` | I5b-4a |
| **W1-f Dex の枠** | 未発見の枠に 🎨 / 🏪 タグ。章の見出し（§16.2）。RESULT から開いたとき NEW の枠へスクロール | `DexOverlay.tsx`、`pizzaSelect.ts`（章） | OD-DISC-2、OD-DISC-9 |
| W1-g 初回の小さな演出 | Discovery Result の Teto の1行、Shop のたまご行の coach mark、ランチラッシュ解放の toast | 上と同じ | 任意 |

W1 の検証（I5b-5 に足すもの）:

- unit: state model（25 recipe × Dex 0 / 1 / 5 / 15 / 24 / 25、migration save）。EP1 の条件が state に影響しないこと。
- e2e: Pizza Select と Shop に、未発見の recipe 名と見本が 0 件であること（全 Dex 段階）。Dex 0 → 最初の発見 → Shop → HOME。
- e2e の helper: guided round で未発見の recipe を使っているものは、発見済みを seed する（`e2e/gestures.ts` はすでに seed している）。
- Human Verification（UI 変更なので policy の対象）: 390×844 の動画はユーザーに直接渡す。screenshot は `docs/reports/screenshots/<task>/` に置く。

### 21.2 I6（W1 の直後）

- Free Cooking の contextual hint（§12、I5b-4 I6-a）。
- wrong attempt の区別（§11.3、おしい / 1つ多い / 1つ足りない）。
- tray の NEW 材料の印。

### 21.3 Post-W1

| 項目 | 内容 |
|---|---|
| branching | Progression 2.1: 複数の候補、材料の分岐、side recipe（§17.3） |
| richer animation | 発見 overlay（§18 の c）、図鑑登録の動き、material unlock の演出、章の完成 |
| advanced hints | Level 4、カテゴリの開示、hint を報酬にする仕組み |
| filters | Pizza Select / Dex の章ジャンプ、未挑戦 / ★で並べ替え |
| collection rewards | 章の完成 bonus、図鑑コンプリート |
| NEW の保存 | 「Dex で見た」フラグ（`seenRecipeIds`）。今は round をまたいで NEW が残らない |
| 同じ失敗の連続の検知 | 「さっきと同じ組み合わせだよ」 |
| EP1 データの削除 | `unlockCondition` / `mysteryLock` と legacy tests の整理（§15.2 の (5)） |
| 音 / haptics | 別 Phase |
| 名前の統一 | 「ピザ図鑑」/「レシピ図鑑」（W1 に入れてもよい） |

---

## 22. Owner Decisions

| id | 問い | 選択肢 | trade-off | **推奨** |
|---|---|---|---|---|
| **OD-DISC-1** | Pizza Select は発見済み recipe だけにするか | (a) 発見済みだけ + 匿名 prompt カード（A′）/ (b) 発見済み + DISCOVERABLE を匿名のシルエットで / (c) 全件（Dex と同じ） | (a) は漏れが構造上 0 で Dex と役割が分かれるが、recipe-first discovery（見本を見て発見）は無くなる。(b) は「次」が見えるが Dex と重なる。(c) は重複が最大 | **(a)** |
| **OD-DISC-2** | Recipe Dex で未発見の枠を見せるか | (a) `？？？` の枠 + 🎨 / 🏪 タグ / (b) `？？？` の枠だけ（今）/ (c) 見せない（発見済みだけ） | (a) は導線になるが「どれが次か」が分かる（分岐 1.0 では実質1枠）。(c) は図鑑が埋まる感覚が消える | **(a)** |
| **OD-DISC-3** | 未発見の recipe 名をいつ公開するか | (a) 発見の瞬間 / (b) DISCOVERABLE になったら（Dex の枠と Pizza Select に）/ (c) KBMM の時点（入荷したら）/ (d) ladder の次の2 step まで（I5b-4 OD-PS-3） | (a) は名前が報酬になる。名前は材料の強い手がかり（ハワイアン → パイナップル）なので、早く出すほど試行の余地が減る。(b)〜(d) は「目標」が見えて動機になるが、答えに近づく | **(a)** |
| **OD-DISC-4** | 未発見の完成 thumbnail を見せるか | (a) 見せない（発見済みだけ）/ (b) 何回か失敗したら見せる / (c) 見せる（今） | 見本は実質 L5（材料の絵は区別しやすい） | **(a)**。onboarding の例外は hint Level 3（文字）で扱う |
| **OD-DISC-5** | 旧 EP1 chain を runtime gate から外すか | (a) 表示と gate（Pizza Select、Shop）から外し、データと tests は残す / (b) データごと削除 / (c) 今のまま | (a) は save への影響なし、戻すのも簡単。(b) は tests の書き換えが大きく、W1 には重い。(c) は LK-3 / LK-5 と ladder との矛盾が残る | **(a)**（I5b-4 OD-PS-1 (b) と同じ方向で、Shop まで広げる） |
| **OD-DISC-6** | NEW discovery の後に直接 Shop CTA を出すか | (a) 入荷があるときは primary を「🛒 ショップを見る」/ (b) secondary に置き、primary は「もう一度じゆうに作る」/ (c) 出さない（HOME の badge だけ） | (a) は loop を最短でつなぐ。(b) は余韻と作り直しを優先する。(c) は1画面が軽いが、入荷を見落とす | **(a)**。入荷が無い発見では (b) の並び |
| **OD-DISC-7** | 失敗時に「近い」を教えるか | (a) 「おしい（1つ違う）」だけ（方向なし）/ (b) 「1つ多い」「1つ足りない」の方向まで / (c) 教えない（INCOMPLETE_MATCH だけ、今）/ (d) どの材料かまで | (b) はつまずきの中心（バジルを残す、§11.2）に直接効くが、試行回数は減る。(d) は答えそのもの | **(b)**。対象は DISCOVERABLE だけ。材料名は出さない |
| **OD-DISC-8** | hint の最大開示 Level | (a) Level 3（ソース + 材料の数 / 使わないカテゴリ）/ (b) Level 4（最後の1つを除いて材料を1つずつ）/ (c) Level 2（最近入荷した材料）まで | (c) は組み直し（15 / 24）で詰まる。(b) は答えにかなり近い | **(a)**。Level 4 は I6 で ★ の分布を見てから（Economy Audit OD-ECO-1 と一緒に） |
| OD-DISC-9 | 25 件の章の分け方 | (a) ladder の price tier 6 / 9 / 10 / (b) authored 7 / 8 / 10（I5b-4 OD-PS-4）/ (c) 味の系統 | (a) は章が順に完成し、節目になる。(b) は第1章が最後まで完成しない。(c) はコレクション感が強いが、W1 では系統の authority が無い | **(a)**（Post-W1 で (c) を再検討） |
| OD-DISC-10 | 「NEW」の意味を1つに揃えるか | (a) recipe の NEW = 今回発見した、材料の NEW = 入荷して未購入、に揃える / (b) 今のまま（Pizza Select の NEW = 未挑戦） | (a) にすると Pizza Select の NEW の意味が変わる | **(a)** |

I5b-4 の Owner Decision との関係:

| I5b-4 | 本設計 |
|---|---|
| OD-UX-1（Dex 0 の「ピザを作る」を enabled） | 同じ（enabled の secondary）。押した先は Pizza Select の空の状態 |
| OD-PS-1（EP1 chain） | OD-DISC-5（範囲を Shop まで広げる） |
| OD-PS-2（READY を guided で作れるか） | OD-DISC-1 (a) を選べば「READY はカードにならない」ので、自動的に「Free Cooking だけ」になる |
| OD-PS-3（LOCKED で名前を見せる範囲） | OD-DISC-3 に置き換える（推奨は名前を出さない） |
| OD-PS-4（25 件の並べ方） | OD-DISC-9（推奨を 7 / 8 / 10 から 6 / 9 / 10 に変える） |
| OD-HINT-1（Free Cooking hint の最大開示） | OD-DISC-8（Level 3 で同じ。Level 3 の中身を「ソース + 材料の数」にする） |

---

## 23. Blockers

| 種類 | 内容 |
|---|---|
| W1 blocker | **なし。** |
| 時期の依存 | W1-a（Pizza Select）と W1-b（Shop）は、I5b-3 で W1 の 10 件が入るのと同じ時期に必要。W1 の recipe には `unlockCondition` が無いので、入れた時点で LK-7 が必ず起きる。I5b-3 の merge の後、I5b-4c と一緒に入れるのがよい |
| 未決定 | OD-DISC-1〜10。特に OD-DISC-1 / 3 / 5 は W1-a の形を決める |
| 参照先の状態 | 3件の Fresh Audit は `main` に入っていない（各 branch 上の commit のみ）。本設計はそれを `git show` で読んだ |
| 検証の制約 | 本設計は docs のみで、実機の計測はしていない。§20 の高さは I5b-4 の実測と既存の CSS の値から見積もった |

---

## 24. このレポートの範囲

- 変更したもの: 本ファイルと `docs/reports/data/TETO_PROGRESS2_DISCOVERY_RECIPE-DEX_2_state-matrix.json` の2つだけ。
- 変更していないもの: `src/**`、`e2e/**`、CSS、runtime、balance 値、I5b-3 の branch。
- PR は作っていない。merge もしていない。

STOP GATE: Fresh Design はここで終わり。
