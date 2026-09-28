# TETO Cooking Techniques 1.0 — TQ-1C Fresh Pre-Implementation Gate

> **Status:** docs のみ。この Gate では src・test・CSS・E2E・save・recipe を変更していない。PR 作成・merge・deploy もしていない。
> **Verdict: A. TQ-1C READY FOR IMPLEMENTATION**（§15）
>
> - blocker は 0 件。
> - TQ-1C の着手に必要な新しい Owner Decision はない。
> - authority の読み方を 2 か所で確定した（§14.1）。Owner は TQ-1C の PR review で覆せる。どちらも TQ-1C の時点では production で不活性。
> - TQ-1D より前に決めればよい項目を §14.2 に分けた。

## 0. 結論

1. **TQ-1 の基盤 3 本はすべて main に入っている。**
   - LAD-1 #268（`4f7443a`）
   - TQ-1A #273（`73c8ad0`）
   - TQ-1B #271（`bcac961`）

   TQ-1C は未実装。production で技法台帳を書く writer は 0 件。
2. **挿入点は `REGISTER_TO_DEX` だけ**（§4）。`phase === "RESULT"` guard の内側で、Dex・Pitz と同じ 1 回の遷移に台帳の更新を載せる。これで exactly-once と 1 回の保存書き込みが既存の仕組みのまま成り立つ。
3. **INV-TQ-4 は main で成立している。** production の catalog 25 target のうち技法を要求するものは 0 件で、`techniqueAffordanceStep("no-sauce") === null`。したがって TQ-1C を merge しても、通常プレイの挙動・save・画面は変わらない。これは golden test で固定する（§10）。
4. **保存は既存の 1 本の persistence effect に台帳を 1 引数追加するだけ。** ただし次の 2 点が漏れると壊れる（§7、R-1 / R-2）。
   - effect の依存配列に台帳を入れること。
   - `ProgressionCarry` に台帳を追加すること。
5. **#275 とは挿入点が重ならない**（§11）。#275 が触るのは CONFIRM_BAKE の post-BAKE 省略と Dinner guard だけで、REGISTER_TO_DEX・`resultNearMiss.ts`・`persistence.ts`・`App.tsx` は触らない。main `bcac961` との trial merge も clean（read-only で確認）。

---

## 1. Fresh GitHub state

| 項目 | 状態（2026-09-28 fresh） |
|---|---|
| **audited `origin/main`** | **`bcac961`**（Merge PR #271 TQ-1B） |
| post-merge CI（`bcac961`） | E2E WebKit run 36410106289 success。Deploy to GitHub Pages run 36410106307 success（push to main の既存 workflow）。`ci.yml` は pull_request だけで動くので、main の push では走らない |
| local baseline（`bcac961`） | `npx tsc -b` OK。`npx vitest run` 210 files / **4449 passed** / 1 skipped。`npx oxlint` は exit 0（TQ-1B の test `scoringV2.noSauceProfile.test.ts` に erasing-op の warning がある。既存） |
| #268 LAD-1 | MERGED（`4f7443a`）。Issue #261 CLOSED |
| #273 TQ-1A | MERGED（`73c8ad0`）。Issue #262 CLOSED |
| #271 TQ-1B | MERGED（`bcac961`）。Issue #263 CLOSED |
| **#275**（#256 CUT skip + Dinner UI） | **OPEN**。head `21fbedf`、base `4f7443a`（main より 3 merge 以上古い）。Owner HV 待ち。main `bcac961` との trial merge は clean（§11） |
| #284 DH4-2C | MERGED（`037eea2`）。`App.tsx` の 4 行、`GameScreen.tsx`、`HintSheet`、CSS を変更。REGISTER_TO_DEX・`resultNearMiss.ts`・`persistence.ts` は触っていない |
| その他の open PR | #272（LC-1、unwired）、#255 / #221 / #220 / #219 / #218 / #217 / #214 / #211 / #209 / #208 / #205（docs または別領域）、#105 / #72 / #46 / #34 / #3。**TQ-1C の対象ファイルに触るものは #275 だけ**（`gameReducer.ts`） |
| **#260**（mechanic_matrix drift） | OPEN。`python3 tools/progression2_mechanic_matrix.py --check` は `bcac961` でも exit 1 で、再現する。**TQ-1C の依存ではないので触らない** |
| TQ 関連の open Issue | なし（#261 / #262 / #263 はすべて CLOSED） |

---

## 2. Authority

### 2.1 所在

| 文書 | 場所 | 状態 |
|---|---|---|
| Fresh Design | `docs/design/TETO_COOKING-TECHNIQUES_1.0_DESIGN.md` | **設計ブランチ `claude/cooking-techniques-design-n0qfwj`（`d57c419`）にしかない** |
| Owner Decision Gate | `..._1.0_OWNER-DECISION-GATE.md`（`03f81e2`） | 同上 |
| **Owner Authority 記録 + Final Implementation Gate** | `..._1.0_FINAL-IMPLEMENTATION-GATE.md` §1（Owner が 2026-09-27 に承認） | 同上 |
| TQ-1A / TQ-1B の Result Report | `docs/reports/TETO_TQ-1A_TECHNIQUE-FOUNDATION_Result.md`、`..._TQ-1B_NO-SAUCE-SCORING_Result.md` | main |

**stale-authority のリスク:** authority の本文は main に無い。本 Gate は設計ブランチを `d57c419` に固定して引用する。TQ-1C の PR も同じ SHA を引用すること。authority を main に取り込むかどうかは docs PR として別に扱う（§14.2 OD-TQ-DOC）。

### 2.2 main の実装との照合（Owner 方針と、それを実装しているコード）

| 方針 | authority | main のコード |
|---|---|---|
| Recipe = WHAT / Technique = HOW | DESIGN §2 | `src/data/techniques.ts` の header |
| 技法は購入しない。★ / Pitz も付かない | OD-TQ-1 / 6 / 7 | `registration.ts` は Pitz・★ に触れない。architecture test で固定 |
| 成功したプレイから発見する | OD-TQ-1、DESIGN §6-2 | `registerTechniqueDiscovery` の `completionPassed` 必須 |
| matcher は技法に依存しない（INV-TQ-NB） | ODG §6 | `techniques.architecture.test.ts`。`discovery/**`・`discoveryCatalog`・`recipes`・`completionGate`・`discoveryRegistration` は technique module を import しない |
| 技法が未発見でも Recipe discovery を妨げない | INV-TQ-NB | 同 test の synthetic no-sauce target が ledger `[]` で `NEW_DISCOVERY` になる |
| 同時発見の表示順は Technique → Recipe。save は 1 回の atomic 登録 | FINAL §1「同時発見」、ODG §8 | 未配線（本 Gate §5 で設計） |
| Original pizza でも発見できる（affordance の到達後だけ） | DESIGN §6-1、INV-TQ-6 | `registerTechniqueDiscovery` の used 経路 × `isAffordanceOpen` |
| recipe 経由の認識は常に行う（INV-TQ-1 が優先） | ODG §6 INV-TQ-6 | `fromRecipe` は affordance gate を通らない |
| near-miss で未発見技法の答えを漏らさない（k ≥ 2） | **OD-TQ-P1**（FINAL §1）、ODG §7.3 | `nearMissPrivacy.ts`（pure）。**未配線** |
| Hint で未発見技法の答えを売らない | OD-TQ-6 | Hint module は技法を知らない（architecture test） |
| **Dinner / Lunch Rush では発見しない** | **OD-TQ-10改**（FINAL §1:「Free Cooking のみ。Dinner では行わない」）、ODG §8 | Dinner は REGISTER_TO_DEX を拒否する（`isDinnerRound`）。Lunch Rush は MISSION_NEXT_ORDER で新発見をしない（Discovery 2.0 backstop） |
| 台帳は append-only / union、未知 id を保持、Full Reset で消える | TQ-1A | `persistence.ts`（`sanitizeDiscoveredTechniqueIds`、`extractForwardCompatExtras`、`writeSave` の append、`persistProgress` の union、`resetSave`） |
| Dinner record の fail-closed 拒否でも atomicity を保つ | DM-4-3 | `writeSave(..., { requireDinnerRecords })` は、拒否すると何も書かない |

**Owner 方針（今回のプロンプト）と authority の照合結果: 矛盾なし。** Dinner / Lunch Rush で発見しないことも authority と現行設計の両方で一致する。したがって STOP 条件には該当しない。

**authority の中の食い違い 2 件**（§14.1 で読み方を確定）:

- **I-1**: ODG §8 は「guided: 検出しない（guided の Aussie は発見済みなので既知）」と書く。一方、main の guided round は matcher 経由で**別レシピの新発見**をする（`gameReducer.discovery.test.ts` の Bismarck→Breakfast）。ODG §8 はこの経路を想定していない。
- **I-2**: OD-TQ-P1 の Owner 文言は一般形で書かれている（候補 ≥2 の時だけ軸別の guidance）。ODG §7.3 のルール本文は技法 target に限定している。FINAL §6 は、一律に適用すると既存の SAUCE_ONLY も fallback になりうることを指摘し、適用範囲を TQ-1C / 1D に委ねた。

### 2.3 TQ-1C の範囲（明文化）

**入れるもの:**

- REGISTER_TO_DEX での技法の認識と台帳への追記
- transient な `lastTechniqueDiscovery`
- ロード時の backfill（INV-TQ-1）
- affordance の派生（ladder から）
- near-miss privacy の wiring（OD-TQ-P1、技法 target に限定）
- persistence effect への台帳の受け渡し
- unit / reducer / App テスト

**入れないもの（禁止事項）:**

- UI・CSS・E2E・HV
- DISCOVERED の技法段の表示（TQ-1D）
- Dex の「調理法」欄（TQ-1D）
- Aussie などの recipe・reference・catalog の追加（TQ-1D）
- `ReferencePizza.sauce` を nullable に広げること（TQ-1D）
- Hint の fact 行（TQ-1D 以降）
- TQ-2 / TQ-3
- #260 / #275 の変更

TQ-1C の完了時点で、production のプレイヤーに見える差分は 0（INV-TQ-4）。

---

## 3. 読み直したコード（`bcac961`）

| 領域 | ファイル | TQ-1C に関係する事実 |
|---|---|---|
| 技法の定義 / 検出 | `src/data/techniques.ts`、`src/logic/techniques/{detection,registration,nearMissPrivacy}.ts` | `detectTechniquesUsed` は `sauceBase` が OBSERVED かつ空で、ingredientSet が 1 つ以上ある時に no-sauce を返す。`registerTechniqueDiscovery` は PASS 必須・recipe 経由・affordance・冪等の各規則を持つ。`techniqueAffordanceStep` は要求する target が 0 なら null。`sauceAxisAnswerCount` / `axisGuidanceAllowed(k ≥ 2)` |
| reducer | `src/state/gameReducer.ts` | CONFIRM_BAKE（L1125）: FREE は `resolveFreeCookPizza` で FAILED / ORIGINAL / MATCHED に分かれる。REGISTER_TO_DEX（L1237）: RESULT guard → Dinner を拒否 → FREE ORIGINAL 分岐（L1258）→ FAILED を拒否 → `evaluateDiscovery`（Mission 以外）→ `registerScoreToDex` / `registerDiscoveryToDex` → Pitz → `lastDiscovery`。**guided round も matcher による別レシピの新発見をする**（`guidedIdOnly`）。`ProgressionCarry` / `carryOf`（L526 / L1638） |
| near-miss | `src/state/resultNearMiss.ts`、`src/logic/discovery/nearMiss.ts` | `classifyNearMiss` は kind と distance だけを返し、**最近傍 target を返さない** → TQ-1C で内部に拡張が必要（§8）。catalog は注入できる（synthetic test に使える） |
| persistence | `src/state/persistence.ts` | `discoveredTechniqueIds` の sanitize / extras / append / union / cap 64 / reset は TQ-1A で実装済み。main の書き込みは、すでに毎回 `discoveredTechniqueIds: []` を含む（TQ-1A の pin） |
| App | `src/App.tsx` | 初期化（L167〜）: `loadSave` → `resolveShopEntitlement` → `createInitialGameState(…, save.dinnerMissionRecordsState)`。**台帳は渡していない**。persistence effect（L350）は `requireDinnerRecords: true` の 1 本だけで、**台帳を渡しておらず、依存配列にも入っていない** |
| scoring | `src/logic/scoringV2/*` | NO_SAUCE は `reference.sauce === null` の時だけ使われ、production では到達しない。TQ-1C は scoring に触れない |
| matcher / Free Cooking | `logic/discovery/{signature,matcher,freeCook}.ts` | `sauceBase` は OBSERVED。Free Cooking の SAUCE step は中身で gate されない。guided の SAUCE step も中身で gate されない（`CONFIRM_MAKING_STEP`） |
| mode guard | `isDinnerRound`、`dinnerGuardedReducer`、`MISSION_NEXT_ORDER` | Dinner は REGISTER_TO_DEX を拒否する。Lunch Rush は発見済みの recipe だけを再登録する |
| Hint / DH4 | `logic/discovery/{selectableHint,deductionGuard,deductionHint,hintPurchase}.ts`、`state/discoveryHint.ts` | DH4 は k ≥ 2 の worst-case guard。技法 module を import しない（architecture test） |
| ladder | `src/data/discoveryLadder.ts`、`src/logic/discoveryLadder.ts` | append-only。W1 は 24 step で `POST_W1_APPENDED_STEPS = []`。step の形は `{ step, kind: "MATERIAL", ingredientIds, keyRecipeId }` |
| forward compat | `persistence.ts` の `KNOWN_SAVE_KEYS` / `extractForwardCompatExtras` / `topLevel` | 未知の top-level key と未知の技法 id は保持される |

**INV-TQ-4 の実測（一時的な test で計測し、削除済み）:** catalog は 25 target、技法を要求する target は `[]`、`sauceBase` を持たない target は 0、`techniqueAffordanceStep("no-sauce") = null`。

---

## 4. A. Runtime wiring：挿入点

**authority イベント = `REGISTER_TO_DEX`**（PLAYING 中の確定イベント）。

- CONFIRM_BAKE では行わない。理由は次のとおり。
  - CONFIRM_BAKE は「焼いた」確定であって、「登録した」確定ではない。
  - FREE の ORIGINAL / FAILED の分類は CONFIRM_BAKE で終わっているが、Dex・Pitz の書き込みは REGISTER_TO_DEX で起こる。
  - 同じ遷移に載せないと、1 回の保存書き込みにならない（ODG §8）。
- REGISTER_TO_DEX の `phase === "RESULT"` guard が exactly-once を保証する。2 回目の dispatch は DISCOVERED に対して行われ、拒否される。

### 4.1 変更点（ファイル・位置）

| # | 場所 | 変更 |
|---|---|---|
| W-1 | `gameReducer.ts` の `GameState` | `discoveredTechniqueIds: readonly string[]`（永続。load した既知 id）、`lastTechniqueDiscovery: readonly TechniqueId[] \| null`（transient。`lastDiscovery` と同じ扱い）を追加 |
| W-2 | `ProgressionCarry` と `carryOf` | `discoveredTechniqueIds` を**必須** carry field として追加（DM-4-3 の `dinnerMissionRecordsState` と同じ扱い） |
| W-3 | `buildOrderState` | `lastTechniqueDiscovery: null` に reset（`lastDiscovery` の隣） |
| W-4 | `createInitialGameState` | 末尾に引数 `discoveredTechniqueIds: readonly string[] = []` を追加（既存の positional 呼び出しは不変） |
| W-5 | **REGISTER_TO_DEX の FREE ORIGINAL 分岐**（L1258–1263） | `resolution.kind === "ORIGINAL"` の後で `registerTechniqueDiscovery({ ledger, signature: signatureOfPizza(pizza), completionPassed: true, matchedTarget: null, isAffordanceOpen })` を呼ぶ。`completionPassed: true` の根拠は直前の `completion.status === "PASS"` 確認。Dex と Pitz は従来どおり触らず、`discoveredTechniqueIds` と `lastTechniqueDiscovery` だけを追加で返す |
| W-6 | **REGISTER_TO_DEX の score あり分岐**（`discoveryRegistration` の直後、L1318 付近） | `evaluatedDiscovery !== null`（= Mission 以外）の時だけ呼ぶ。`matchedTarget` は、登録後の outcome が `NEW_DISCOVERY` または `ALREADY_DISCOVERED` の時、その `targetId` の catalog target。`INCOMPLETE_MATCH` / `ORIGINAL` / `AMBIGUOUS` なら null。used 経路は `state.freeCook` の時だけ有効で、guided では `isAffordanceOpen = () => false`（§6、§14.1 I-1）。返り値の `ledger` と `newlyDiscovered` を、同じ return に入れる |
| W-7 | 新規の pure helper（例: `src/logic/techniques/affordance.ts`） | `materialStepOf(ladder, starters)`。starter なら 0、ladder の MATERIAL step の `ingredientIds` に含まれればその step、どちらでもなければ null。`isAffordanceOpen(id)` = `isTechniqueAffordanceOpen(techniqueAffordanceStep(id, RECIPE_DISCOVERY_CATALOG, materialStepOf(...)), discoveredRecipeIds(state.dex).length)`。state.dex は**登録前**の Dex を使う（ORIGINAL 経路では Dex は動かない） |
| W-8 | `App.tsx` の初期化 | `backfillTechniqueLedger(save.discoveredTechniqueIds, <Dex で発見済みの recipe の catalog target>)` の結果を `createInitialGameState` に渡す。production では no-op（要求する target が 0） |
| W-9 | `App.tsx` の persistence effect | snapshot に `discoveredTechniqueIds: state.discoveredTechniqueIds` を追加し、**依存配列にも追加**する（§7） |
| W-10 | `resultNearMiss.ts` / `nearMiss.ts` | OD-TQ-P1 の wiring（§8） |

**触らないもの:**

- CONFIRM_BAKE、MISSION_NEXT_ORDER、Dinner の各 reducer
- `discoveryRegistration.ts`、matcher、signature、freeCook、scoring
- Hint 系の全 module、persistence の規則本体

---

## 5. B. State transition と同時発見

### 5.1 1 回の REGISTER_TO_DEX（RESULT → DISCOVERED）で起きること

1. 技法の認識。入力は登録前の台帳、signature、matched target、affordance。
2. 台帳の更新（union。`newlyDiscovered` を registry 順に追記）。
3. Dex への登録（従来のまま）。
4. Pitz の加算（従来のまま。**技法の分は加算しない**、OD-TQ-7）。
5. `lastTechniqueDiscovery = newlyDiscovered`（空なら `[]`）と `lastDiscovery` を同じ state に設定する。

state は 1 回の return で確定する。App の persistence effect は、この 1 つの state 変化に対して 1 回だけ書く。台帳・Dex・Pitz を 1 回の read-patch-write でまとめて保存する。

### 5.2 表示順（overlay / queue）

- DISCOVERED の overlay は `lastTechniqueDiscovery`（1 件以上）→ `lastDiscovery`（recipe）の順に読む（FINAL §1）。
- queue は state 上の 2 つの field だけで、別の queue 構造は作らない。
- TQ-1C は field を用意するだけで、表示はしない（TQ-1D）。
- TQ-1D が守るべき契約を、TQ-1C の test に書いておく: 同じ遷移で両方が設定されること、技法は registry 順であること。

### 5.3 reload / replay 耐性

| 事象 | 挙動 |
|---|---|
| REGISTER_TO_DEX の二重 dispatch | 2 回目は `phase !== "RESULT"` で拒否され、台帳も演出も変わらない |
| DISCOVERED の表示中に reload | 台帳は保存済みで、`lastTechniqueDiscovery` は transient なので再表示されない（`lastDiscovery` と同じ） |
| CONFIRM_BAKE の後、REGISTER の前に reload | 何も書かれていない（FREE は即 REGISTER。recipe と同じ挙動） |
| RETRY / PLAY_AGAIN / START_FREE_COOK | `carryOf` で台帳を引き継ぎ、`lastTechniqueDiscovery` は reset。台帳にある技法は再発見されない（INV-TQ-2） |
| 同じ技法の 2 回目 | `newlyDiscovered = []`。演出なし |
| 1 枚で技法 2 つ | registry 順にまとめて 1 回（TQ-1 の技法は 1 つだけなので将来の契約） |
| ALREADY_DISCOVERED の technique recipe | 台帳には INV-TQ-1 により（backfill 込みで）すでにある → 何もしない |
| INCOMPLETE_MATCH（FREE、recipe-free PASS） | ORIGINAL 分岐を通るので、used 経路（affordance の到達後）で技法が認識されうる（DESIGN §7:「技法はやり方」） |

---

## 6. E. Mode matrix

| モード | REGISTER 経路 | used 経路（ORIGINAL、affordance） | recipe 経由（INV-TQ-1） | 台帳への書き込み | 根拠 |
|---|---|---|---|---|---|
| **FREE（Free Cooking）** | REGISTER_TO_DEX | **発火**（affordance の到達後だけ） | **発火** | あり | OD-TQ-10改、INV-TQ-6 |
| **Guided**（Pizza Select、発見済みの recipe を作る） | REGISTER_TO_DEX | **発火しない** | **matcher が*別の*未発見レシピを新発見した時だけ発火** | その時だけ | INV-TQ-6「recipe 経由の認識は常に行う（INV-TQ-1 が優先）」。§14.1 I-1 |
| **Lunch Rush** | MISSION_NEXT_ORDER（DISCOVERED を通らない） | 発火しない | 発火しない（新発見が起きない） | なし | OD-TQ-10改、Discovery 2.0 backstop |
| **Dinner** | REGISTER_TO_DEX を拒否（OD-DM-11） | 発火しない | 発火しない | なし | OD-TQ-10改 |
| Onboarding（Dex 0、Margherita） | FREE と同じ | affordance が閉じているので発火しない | 技法を要求するレシピ次第（production では 0） | なし | DESIGN §6-1、R-2 |

**TQ-1C の production では、全モードとも台帳は `[]` のまま**（要求するレシピが 0、affordance が null）。

---

## 7. C. Save atomicity

### 7.1 経路

REGISTER_TO_DEX の state 変化 → App の effect → `persistProgress({ …, discoveredTechniqueIds, dinnerMissionRecordUpdates, requireDinnerRecords: true })` → `writeSave`。

| 組み合わせ | 挙動 | 根拠 / 確認 |
|---|---|---|
| 通常の書き込み | 台帳 = union（既存 ∪ snapshot）、未知 id は後ろに append、cap 64 | TQ-1A test、#273 gate の cross test |
| **Dinner record の拒否**（別タブが record を壊した） | `writeSave` は**何も書かない**（Dex・Pitz・台帳のすべて）→ `DINNER_RECORDS_REFUSED` → `dinnerMissionRecordsState` が変わる → **effect が再実行され、台帳を含む snapshot を書く** | DM-4-3。ただし台帳が effect の依存にあることと、state に台帳が残っていることが前提（R-2） |
| broken Dinner record ＋ 台帳 | record は verbatim で残り、台帳は正常に書かれる（拒否されるのは blocked mission への update だけ） | #273 gate の cross test（3/3 pass） |
| 未知の技法 id（新しい build が書いたもの） | state には入らない（sanitize で既知 id だけ）。`writeSave` が storage の extras から append して保持 | TQ-1A |
| storage が空 / 壊れている | extras が null → `next` をそのまま書く（既知 id） | `writeSave` |
| Full Reset | `resetSave` = key ごと削除 → 台帳も消える。affordance は派生なのでリセット不要 | TQ-1A test |
| 技法だけが変わった（ORIGINAL 経路） | `techniquesUnchanged === false` → 書き込みが起きる。**ただし effect の依存に台帳が無いと、書き込みが起動しない**（R-2） | `persistProgress` |
| 旧 build との往復 | P3-4B 以降の build は未知の top-level key を保持する | TQ-1A |

### 7.2 必須の不変条件（TQ-1C の test で固定する）

- **S-1:** ORIGINAL 経路だけの技法の発見（Dex / Pitz は不変）が保存されること。effect の依存に台帳が入っていることを直接検査する。
- **S-2:** Dinner の拒否 → 再実行の後、台帳が storage に入ること。
- **S-3:** 台帳は `ProgressionCarry` を通して、どの新ラウンドでも保たれること（PLAY_AGAIN / RETRY / START_FREE_COOK / Lunch Rush / Dinner の開始と終了）。
- **S-4:** production 相当のラウンド後の save JSON が、TQ-1C 前の main と **byte-identical** であること。main もすでに `discoveredTechniqueIds: []` を書いている。

---

## 8. D. Privacy

### 8.1 横断監査

| 出力 | TQ-1C 後 | 判定 |
|---|---|---|
| **near-miss（SAUCE_ONLY）** | 最近傍 target が未発見技法を要求していて、k < 2 なら `SOMETHING_DIFFERENT`（`NEAR_MISS_PRIVACY_FALLBACK_JA`「おしい！あと少し、なにかが違うみたい…？」）に落とす。k は `sauceAxisAnswerCount(owned, usedSauces, sauceIds)` | OD-TQ-P1。production では到達しない（技法 target が 0） |
| near-miss（ADD_ONE / REMOVE_ONE / CLOSE / FAR） | 軸は「材料の数」か「近い」だけで、sauce 軸を示さない → 変更なし | 漏れない |
| **同距離の tie** | 最近傍の選び方は `compareHintCandidates` の順序に依存する。**同じ最小距離に「未発見技法を要求し、SAUCE_ONLY になる候補」が 1 つでもあれば**、k 規則の対象にする（保守側）。tie の順序で答えが漏れるのを防ぐ | §7.3 の意図の範囲内（§14.1 I-2） |
| near-miss の既存 25 recipe | **変更しない**（技法 target に限定、§14.1 I-2） | 既存の文言は不変 |
| Hint（H2 step、H3 selectable、DH4 構成 / 特徴、Hint 購入） | TQ-1C は触らない。Hint module は技法 module を import しない（architecture test）。台帳 `[]` と `["no-sauce"]` で hint の出力が同一であることを TQ-1C test で固定する | OD-TQ-6（技法の fact 行は TQ-1D 以降） |
| DH4 の k 規則 | DH4 は `deductionGuard` の worst-case k ≥ 2 で、所持品の universe（単調安全）。TQ-1C の k も同じ考え方（所持ソースは単調増加なので、一度出た軸別の文言は後で漏れにならない） | 整合 |
| candidate filtering | matcher と near-miss の候補集合は技法を見ない（INV-TQ-NB） | 漏れない |
| UI copy | TQ-1C は UI を追加しない。`TECHNIQUES[].nameJa / riddleJa` はどこからも表示されない | 漏れない |
| state / debug | `lastTechniqueDiscovery` と台帳は**発見済み** id だけを持つ。`ScoringV2DebugPanel` は `VITE_PREVIEW_MODE` の時だけで、scoring 対象は一致したレシピだけ | 漏れない |
| console / log | TQ-1C は log を追加しない | — |

### 8.2 near-miss の wiring（W-10）

- `classifyNearMiss` に内部 option を追加する。最小距離の候補（`recipeId` / `targetId` / class）を返すもので、UI には渡さない。
- `ResultNearMissInput` に `discoveredTechniqueIds` を追加する。`GameScreen` は `state` をそのまま渡しているので、呼び出し側の変更はない。
- `NearMissKind` の表示 kind に `SOMETHING_DIFFERENT` を追加する。`ResultPanel` は `textJa` をそのまま描画する。
- 技法が発見済みなら、従来どおり SAUCE_ONLY を出す（ODG §7.3）。

---

## 9. G. #275（fresh 再監査）

| 観点 | 結果 |
|---|---|
| 状態 | OPEN、head `21fbedf`、base `4f7443a`。Owner HV 待ち。更新は 2026-09-28T04:39Z が最後 |
| `gameReducer.ts` の差分 | ① import（`bakeCompletionFailure`、`BakeCompletionFailure`）、② CONFIRM_BAKE の `postBake` 行（焼成失敗なら post-BAKE を省略）、③ `dinnerResolve` の引数 `cut: { completed, waivedFor }`、④ `dinnerGuardedReducer` の CONFIRM_BAKE / CUT。**REGISTER_TO_DEX・`ProgressionCarry`・`buildOrderState`・`createInitialGameState` には触れない** |
| その他のファイル | `App.css`、`DinnerGameUi.tsx`、`completionGate.ts`、`dinnerResultDetection.ts`、`dinnerView.ts` など。`App.tsx` / `persistence.ts` / `resultNearMiss.ts` / `nearMiss.ts` には触れない |
| trial merge（#275 × main `bcac961`） | **clean**（`git merge-tree`、read-only） |
| 意味上の相互作用 | #275 は焼成失敗の時に CUT を飛ばして RESULT に行く → Completion FAILED → REGISTER_TO_DEX は FAILED を拒否 → 技法は認識されない。技法の規則（PASS 必須）と一致する。FREE には CUT が無いので影響なし |
| textual 衝突の予測 | TQ-1C は `gameReducer.ts` の import 区画（technique helper の import）と、REGISTER_TO_DEX・`ProgressionCarry` を変更する。#275 の import 追加（L28–33）と**隣接するだけで、同じ行ではない**。衝突するなら import 区画の trivial conflict だけ |
| **merge 順** | どちらが先でもよい。**後から merge する側が main を取り込み、full vitest を再実行する。** 推奨は、#275 が HV 待ちで止まっているなら TQ-1C を先にすること（TQ-1C は不活性で revert しやすい） |

---

## 10. F. INV-TQ-4 の固定（merge しても挙動が変わらないことの証明）

| Test | 内容 |
|---|---|
| F-1 データ | production の `RECIPE_DISCOVERY_CATALOG` 全 target について `requiredTechniquesOf = []`。`techniqueAffordanceStep("no-sauce", catalog, materialStepOf(DISCOVERY_LADDER)) === null`。**レシピが増えて技法を要求するようになったら fail する**（TQ-1D はこの pin を意図的に更新する） |
| F-2 reducer golden | TQ-1B と同じ手順。**実装前の main `bcac961` で、別 commit として snapshot を取る。** 対象は FREE × {25 recipe の ideal、no-sauce の ORIGINAL（1〜3 品）、sauce の skip、FAILED、INCOMPLETE_MATCH} × Dex の発見数 {0, 12, 24, 25}、guided 5 件、Lunch Rush 1 run、Dinner 1 run。REGISTER_TO_DEX 後の state を記録し、新しい 2 field を除いた部分が完全に一致すること、`discoveredTechniqueIds === []`、`lastTechniqueDiscovery ∈ {[], null}` を確認する |
| F-3 near-miss golden | F-2 と同じ行列で、`resultNearMiss` の出力が main と完全に一致すること（`SOMETHING_DIFFERENT` が 0 件） |
| F-4 save golden | F-2 の各ラウンドの後の save JSON が main と byte-identical であること（S-4） |
| F-5 静的 | `logic/discovery/**`、`scoringV2/**`、`completionGate`、`pitzReward`、`dex` が technique module を import しないこと（既存の architecture test を維持・拡張する） |

---

## 11. #260 の状態

- OPEN。main `bcac961` でも `--check` は exit 1 で、再現する。
- 原因は Issue に書かれているとおり（W1 の src 由来 field の drift）。
- TQ-1C は tools / matrix JSON に触れないので、依存も影響もない。**ついでに修正はしない。**

---

## 12. Regression risks

| # | リスク | 重大度 | 対策（TQ-1C の test） |
|---|---|---|---|
| R-1 | `ProgressionCarry` への追加漏れ → 新ラウンドで台帳が消え、再発見・再演出が起きる（storage は union なので消えない） | 高 | S-3 |
| R-2 | effect の依存配列への追加漏れ → ORIGINAL 経路だけの発見が保存されない | 高 | S-1（依存配列を source で検査することも含む） |
| R-3 | Dinner の拒否 → 再実行の経路で台帳が落ちる | 中 | S-2 |
| R-4 | guided の recipe 経由の認識を、used 経路と取り違える（guided で ORIGINAL 扱いの no-sauce を認識してしまう） | 中 | guided で affordance 常に閉、の reducer test |
| R-5 | near-miss の tie の順序による漏れ | 中 | synthetic catalog で tie のケース |
| R-6 | 既存の near-miss 文言が変わる（k 規則を一律に適用してしまう） | 中 | F-3 golden |
| R-7 | `createInitialGameState` の positional 引数の順序間違い（App の初期化） | 低 | App の hydrate test（台帳 → state → 次の write） |
| R-8 | ロード時の backfill の後、storage は次の書き込みまで古い（無害。メモリ上は INV-TQ-1 が成立する） | 低 | backfill test（synthetic） |
| R-9 | #275 との import 区画の trivial conflict | 低 | 後から merge する側が main を取り込む |
| R-10 | authority が設計ブランチにしかない（stale 化） | 低 | PR で `d57c419` を引用。docs の取り込みは OD-TQ-DOC |
| R-11 | synthetic の全ループ test で、synthetic recipe が production の Reference registry（frozen）に無く、scoring が unavailable になる | 低 | `vi.mock` で catalog / recipes / referencePizza を差し替える。production のコードに seam は追加しない |

---

## 13. Required tests と implementation slices

### 13.1 Required tests

| 区分 | 内容 |
|---|---|
| pure | `materialStepOf`（starter = 0、ladder の MATERIAL step、未到達 = null）。round-technique resolver（FREE ORIGINAL + affordance の開閉、FREE MATCHED NEW / ALREADY、guided の cross NEW、INCOMPLETE、FAILED、Mission は呼ばない） |
| reducer（production catalog） | F-2（golden）。二重 dispatch。RETRY / PLAY_AGAIN / START_FREE_COOK での carry（S-3）。Dinner / Lunch Rush で `lastTechniqueDiscovery` が立たないこと |
| reducer（synthetic、`vi.mock`） | no-sauce の synthetic recipe / target / reference で全ループ。affordance の前は ORIGINAL で認識しない。後なら認識する。NEW_DISCOVERY と同時なら技法 → recipe の 2 field が同じ遷移で立つ。guided の cross 発見で recipe 経由の認識。guided の ORIGINAL 相当では認識しない。Lunch Rush / Dinner では認識しない。二重 dispatch。retry。INV-TQ-1（Dex の発見済み ⇒ 台帳）。Pitz / ★ は技法で変わらない |
| near-miss | F-3（golden）。synthetic: 未発見 + k = 1 → `SOMETHING_DIFFERENT`、未発見 + k ≥ 2 → SAUCE_ONLY、発見済み → SAUCE_ONLY、tie のケース（R-5）、ALREADY_DISCOVERED の d = 1 の経路 |
| save / App | S-1（ORIGINAL だけの発見が書かれる、依存配列）、S-2（Dinner 拒否 → 再実行）、S-4（byte-identical）、hydrate（未知 id が storage に残り、state は既知 id だけ）、backfill（synthetic）、Full Reset |
| privacy | 台帳 `[]` / `["no-sauce"]` で hint の各 view の出力が同一。architecture test の拡張（F-5） |
| mutation（手動で入れて戻す） | ① carry 漏れ、② 依存漏れ、③ guided で used 経路を開く、④ k 規則の不等号、⑤ tie を最近傍だけで判定、⑥ Mission で resolver を呼ぶ → それぞれ 1 件以上の test が fail すること |
| 全体 | `tsc -b`、`oxlint`、`vitest run`、`vite build`。CI 9/9（WebKit を含む。UI 変化なし） |

**HV:** 見た目・UX の変化はない（INV-TQ-4）。`TETO_HUMAN-VERIFICATION-POLICY` の適用対象外であることを Result Report に明記する（TQ-1B と同じ扱い）。

### 13.2 Implementation slices（1 PR、commit を分けて単独でも revert できる形）

| Commit | 内容 | 挙動 |
|---|---|---|
| C0 | **golden を main `bcac961` で取得**（F-2 / F-3 / F-4 の fixture と生成 support）。src は変更しない | なし |
| C1 | state の配管: W-1〜W-4、W-8、W-9（台帳を読み込み・carry・保存するだけ） | なし（台帳は `[]`） |
| C2 | REGISTER_TO_DEX の wiring: W-5〜W-7 | production ではなし（affordance は null、要求レシピは 0） |
| C3 | near-miss privacy の wiring: W-10 | production ではなし |
| C4 | synthetic の全ループ test、mutation 記録、Result Report（`docs/reports/TETO_TQ-1C_…_Result.md`） | — |

- **Revert:** PR 単位で revert できる。台帳は書かれても forward-compat で保持され、中身は `[]` のまま。
- **依存:** LAD-1 / TQ-1A / TQ-1B（すべて merge 済み）。
- **後続:** TQ-1D+E（Aussie、UI、HV、ループの有効化）。

---

## 14. Owner Decisions

### 14.1 TQ-1C で確定した authority の読み方（新しい決定ではない。Owner は PR review で覆せる）

| ID | 論点 | TQ-1C で採る読み方 | 根拠 | production への影響 |
|---|---|---|---|---|
| **I-1** | guided round が matcher 経由で、技法を要求する*別の*レシピを新発見した時 | **recipe 経由の認識を行う**（used 経路は FREE だけ） | INV-TQ-6「recipe 経由の認識は常に行う（INV-TQ-1 が優先）」、INV-TQ-1（承認済み、TQ-1A test）。ODG §8 の「guided は検出しない」は used 経路（検出）の話と読む。この経路を想定していなかったことは本 Gate §2.2 で確認した。認識しない場合、ロード時の backfill で**演出なしに**台帳へ入り、INV-TQ-1 は reload まで崩れる | なし（要求レシピが 0）。TQ-1D の UI は、guided の DISCOVERED でも技法段を出す必要がある |
| **I-2** | OD-TQ-P1 の適用範囲 | **技法 target に限定する**（ODG §7.3 の本文。同じ最小距離の tie は保守側で判定）。既存 25 recipe の SAUCE_ONLY は変えない | ODG §7.3（Owner が「採用」した推奨の本文）、FINAL §1 の絶対条件（「Aussie の NO_SAUCE を…から特定できないこと」）。一律に適用すると既存の UX が変わり、TQ-1C の不活性（INV-TQ-4）と HV 対象外の前提が崩れる | なし |

### 14.2 TQ-1D より前に決めればよいもの（TQ-1C を止めない）

| ID | 決めること | 推奨 |
|---|---|---|
| OD-TQ-P1-SCOPE | k 規則を既存 recipe の SAUCE_ONLY にも一律に適用するか（例: 所持ソースが tomato だけでソースなしの時、「ソースを変えると」は実質「トマトを塗る」を示す。DH2 以来の既存挙動） | **しない**（I-2 のまま）。変える場合は、UX の変更として別 slice ＋ HV で扱う |
| OD-TQ-1D-COPY | `SOMETHING_DIFFERENT` の表示（既存の行は 🤏 / 👀 の絵文字で始まる。承認済みの文言には絵文字がない） | TQ-1D で決める（TQ-1C は承認済みの文言をそのまま使う。production には出ない） |
| OD-TQ-DOC | Cooking Techniques の authority 文書（設計ブランチ `d57c419`）を main に取り込むか | 取り込む（docs PR。src に触れない） |

### 14.3 必要な新しい Owner Decision

**なし。**

---

## 15. Final verdict

**A. TQ-1C READY FOR IMPLEMENTATION**

- blocker: **0**
- 必要な新しい Owner Decision: **0**（authority の読み方 I-1 / I-2 を記録。TQ-1D より前の項目は §14.2）
- 前提: LAD-1 / TQ-1A / TQ-1B は merge 済み、main `bcac961` は CI green、#275 とは重ならない（trial merge clean）
- 実装の条件: §13.2 の順で進める（C0 の golden を最初に取る）。R-1 / R-2 / S-1〜S-4 の test を必須とする。UI・recipe は追加しない

**STOP.** TQ-1C の production code は変更していない。TQ-1D / Aussie / TQ-2 / TQ-3 は未着手。#260 / #275 は未変更。Preview の上書き・deploy・auto-merge もしていない。
