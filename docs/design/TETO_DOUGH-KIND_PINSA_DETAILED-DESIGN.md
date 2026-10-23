# TETO 生地の種類（Pinsa Romana）導入 — 実装前の詳細設計 ＋ 新ソース 4 種の変更範囲（docs-only）

Status: **設計（Owner Decision 第 3 弾を反映した最終確定版・Final Gate 候補）。P1・P2 の設計方針は承認済み。実装コードは別 PR。P3 は HOLD。** `src/**`・`e2e/**`・CSS・レシピ／食材データ・テストは変更していない。
この文書の「推奨」は助言であり、Owner Decision ではない。**承認が記録されていない判断は未決のまま §12.2 に列挙し、承認済みとはみなさない。**

| 項目 | 値 |
|---|---|
| 監査対象 `main` | 初版は `c98d957`（#573）。Final Gate 準備で `46d1139`（#574）まで再確認。その後 open になった #576（Square Dough D2-b1）は `PizzaStage` / `App.css` を触るため、P2 の UI 実装時の衝突候補として §9 に記載（本 PR は触れない） |
| 親の調査 | `docs/design/TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md`（同一ブランチ） |
| 触れていないもの | Square Dough D2-b（#576 を含む）、Batch 8b（#527 とその続き）、共有 Preview、既存の進行中 PR（#478 / #540 ほか）、P1〜P3 の実装コード、#521 の本文 |
| HV | docs-only のため不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。実装 PR は §11 の各 slice で必須 |

## L1 と P3 の決定による更新（2026-10-23、P3-b-0）— **この節が §1〜§13 の古い記述より優先する**

最新の決定 SSOT は `docs/decisions/TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`（L1 / D1〜D8）。P3-b の計画は `TETO_PINSA-577_P3B_IMPLEMENTATION-PLAN_2026-10-23.md`。2026-10-20 時点の本書の記述のうち、次は**上書きされている**（本文には「superseded」注記を付け、取り消し線にはしない）。

| 旧記述（本書） | 現在の正 | 根拠 |
|---|---|---|
| §7: Pinsa の 4 食材はすべて焼成前 | **生ハムは焼成前、ルッコラのみ POST_BAKE（FINISH で後乗せ）**。標準生地＋後乗せは ORIGINAL | L1 / D2 |
| §7・§1.5: Pinsa は `RECIPES` に入り、`ladderCredit:false` は Recipe の通常フィールド | Pinsa は **`lateCatalog.ts` の `LATE_RECIPES`**（`ladderCredit:false` は D1 のデータ由来の例外。late ladder step の key を要求しない。`LATE_LADDER_STEPS` に足さない） | L1 / D1 / D6 |
| §1.5: 「jamon の集合 × Pinsa × tray なし = `pinsa-romana`」 | **Pinsa 生地 ∧ ルッコラ後乗せ（`late`）** が揃ったときだけ `pinsa-romana`。Pinsa 生地で全部を焼成前に載せると ORIGINAL | L1（I2 = `dough` ∧ `late`） |
| §5.6: `PizzaState.dough` は永続しない | **ラウンド途中のジャーナル（`pendingRound.ts`）は `pizza.dough` を保存・復元する**。図鑑・技法台帳・save スキーマには影響しない | main の実装事実（#639 のテストが固定） |
| §5.4 / §6.5: Guided の開始時設定は P3 の中で | **P3-a1（#639）** として分離 | D5 |
| §8 PK-0: 原典 5 項目の確認が P3 開始の条件 | **項目 2・4・5 は本番 OFF のデータ追加準備に限り未確認のまま許容**。**本番 ON 化（E5）の前に、必ず原典を確認する** | Owner 判断（2026-10-23） |
| §7: 表示名「ピンサ・ロマーナ」・説明は暫定 | **確定**（下の表） | Owner 判断（2026-10-23） |
| 判断材料（`TETO_DOUGH-KIND_P3_DECISION-MATERIALS.md` §2.0）の「ladder 54 step・61 レシピ」（本書は件数を持たない） | 通常 ladder は 55 step（#634）。ikura の late step は「通常 ladder 長 + 1」（現 56）。固定しない | D6 |

**§12.2 の Q の現状（2026-10-23）**: Q6 の `ladderCredit:false` は D1 で確定、`lunchRush:false` は後乗せカタログの validator が要求（`lunchRush:false` 必須）。**CUT（暫定なし）は原典の形の確認後に判断（未決のまま）**。Q8（個数・bake）は D4 の**検証用暫定値**で、実測前に正式確定しない。**Q5（RESULT の生地版の中立行）と Q7（コホート文字・validator の名前付き例外）は未決のまま**（P3-b-3 / E5 で扱う。Q5 は設計上の既定「足さない」を承認とはみなさない）。

**確定したレシピ文言（Owner、2026-10-23）**: 表示名「ピンサ・ロマーナ」／説明文「独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。」。
- 説明文は**時機（焼成後・後乗せ）を示さない**。ただし**ルッコラ（食材）と「独特の生地」を含む**ので、(a) 未発見のレシピに対して表示される面（Pizza Select・HOME・注文文・Research など）には出さない、(b) 表示される面を P3-b-1 で列挙し、ladder・技法の riddle（T1）とは別の面であることをテストで固定する。jamon の説明文も食材を示す前例に倣うが、`dough` を示唆する語（「独特の生地」）が未発見の面に出ないことを確認項目にする。

## Owner 方針（2026-10-20）と、この文書での扱い

| # | 方針 | 反映先 |
|---|---|---|
| 1 | 生地の種類が最優先。最初の対象は Pinsa Romana | §1〜§9 |
| 2 | 生地の種類は技法（how）として設計することを第一候補にする | §3 |
| 3 | 天板の形（○/□）と生地の種類は**別の識別軸** | §1、§2、§6 |
| 4 | 新ソースは焼成前の SAUCE 工程で使う | §10 |
| 5 | fromage-blanc-sauce / miso-sauce / tahini / yuzu-kosho はソース扱い。既存 taxonomy・レシピデータ契約との整合を確認する | §10 |
| 6 | POST_BAKE のソース後乗せは別 Issue。重複 Issue は作らない | §11.3（第 2 弾の Owner 許可により、重複再確認のうえ **#579 として起票済み**） |
| 7 | ZONED は将来フェーズに延期 | §11.4 |
| 8 | ドラッグ操作の全面統一は低優先度のまま | 本書の範囲外。どの slice も #478 に依存させない |

## Owner 方針 第 2 弾（2026-10-20、Final Gate 準備）と、この文書での扱い

| # | 方針 | 反映先 | 状態 |
|---|---|---|---|
| A | `pan` と `dough` は独立した識別軸 | §1.2、§2 | 反映済み（変更なし） |
| B | `dough` の値は 172 レシピ設計の語彙を優先し、既存の `standard` を維持 | §1.3 | **確定**（旧 Q1 = 案 A） |
| C | 技法 ID は `DOUGH_PINSA_ROMANA` を第一候補。既存命名規則と衝突するなら修正案を報告 | §3.2 | 衝突あり → 修正案 `dough-pinsa-romana` を報告 → **第 3 弾で承認（J）** |
| D | 表示名「ピンサ生地」 | §3.2、§5.7 | 確定（第 3 弾 K で表示を承認、対応を漏らさない条件つき） |
| E | 説明文は「空気を含んだ軽い食感が特徴の生地」を基本とする | §3.2 | 採用（基本）。なぞかけは第 3 弾 L で承認 |
| F | 未発見レシピの情報を UI・ヒントに漏らさない | §5.7（非開示の監査表）、PK-18 | 反映済み |
| G | Dinner に Pinsa を出題しない | §4.2、PK-19 | **構造的に満たされることを確認**＋ガードテストを受け入れ条件に追加 |
| H | Pinsa の有効化前に pizzadb.jp の原典を確認する | §7、§11.1、PK-0 | P3 の**開始条件**として明記 |
| I | 生地種類・新ソース 4 種・ソース後乗せの Issue を、重複再確認のうえ起票してよい | §11.3 | **起票済み**（#577 / #578 / #579） |

## Owner Decision 第 3 弾（2026-10-20、設計の最終確定）と、この文書での扱い

| # | 決定 | 反映先 |
|---|---|---|
| J | 技法 ID は **`dough-pinsa-romana`** を承認 | §3.2（確定）、PK-20 |
| K | 生地を選択したプレイヤーに「**ピンサ生地**」と表示することを承認。ただし**未発見レシピとの対応を漏らさない** | §3.2、§5.7（面の定義と「対応を漏らさない」規則 R1〜R5）、PK-21 |
| L | なぞかけ案: 「**同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。**」 | §3.2（既存アサーションとの照合結果を記載）、PK-22 |
| M | **P1・P2 の設計方針を承認**。コード実装は別 PR | §11.1 |
| N | **P3 は pizzadb.jp の原典確認まで HOLD** | §7、§11.1、PK-0 |
| O | §12.2 の Q3・Q5〜Q10 は推奨案と Owner 方針を照合し、未決事項は具体的に報告する。**未回答を承認済みとみなさない** | §12（照合表） |

---

## 0. 要約

1. **`jamon-serrano-pizza` が Pinsa と同じ食材集合を持つ**（tomato-sauce / mozzarella / prosciutto-crudo / arugula）。現在の識別は `dough` を見ないので、Pinsa の食材を作ると必ず `jamon-serrano-pizza` が発見される。**生地を識別軸にしない限り、Pinsa は原理的に発見できない。** これが本件の核心。
2. **`dough` 軸は 11 軸のうち `FIXED_BY_FLOW`**（全ピザが `"standard"`）。`pan` が F1 でやったのと同じ手順で **OBSERVED に昇格**させる。軸は 2 本の独立した値になる: `pan ∈ {null, "tray"}`、`dough ∈ {"standard", <生地の種類>}`。matcher は全軸を値で比較するので、組み合わせは自動的に別の識別になる。
3. **技法（how）として扱う**: レジストリに技法を 1 つ足す。検出（使った）・要求（レシピが要る）・affordance（導出）・Dex の調理法欄・RESULT の技法ステージは、**`tray` と同じ仕組みにそのまま乗る**。新しい発見経路は作らない。
4. **UI は DOUGH 工程に選択チップを 1 組足す。○/□ の `PanSwitch` とは別の radiogroup** で、表示条件は同じ形（PREPARE ∧ DOUGH ∧ Free Cooking/Research ∧ **その技法自身の** affordance 開）。2 つは互いの生地選択（`dough` / `pan`）を書き換えない。
5. **保存形式は変えない。** `PizzaState` は永続化されない。変わるのは「図鑑にレシピ id が 1 つ増える」と「技法台帳に id が 1 つ増える」だけで、どちらも前方互換（未知 id を保持）の既存経路に乗る。
6. **採点は変えない。** Scoring 2.0・Completion Gate・Pitz・★・ランキングは生地の種類を読まない（`techniques.architecture.test.ts` が INV-TQ-3 として固定済み）。
7. 新ソース 4 種は**データ追加が中心**。ただし「sauce が 3 種」を前提とするテスト・fixture が複数あり、型 union（`RecipeSauceProfile.ingredientId`）の拡張が要る。新ソースを使う 4 レシピのうち、**Flammkuchen だけが新規の非ソース食材 0**。

---

## 1. 識別軸の設計（本設計の中心）

### 1.1 現状（コードで確認した事実）

| 項目 | 現状 | 根拠 |
|---|---|---|
| 識別 11 軸 | `dough` `pan` `layerOrder` `zones` `late` `prep` `enclosure` `shape` `cook` `laminate` `spreadLayers` | `src/logic/discovery/signature.ts` |
| `pan` | **OBSERVED**。値は `PizzaState.pan` が `"tray"` のときだけ `"tray"`、それ以外は `null` | 同 `signatureOfPizza` |
| `dough` | **FIXED_BY_FLOW**。値は常に `"standard"` | `RUNTIME_DIMENSION_OBSERVATION.dough` |
| 型 | `status: K extends "pan" ? AxisStatus : Exclude<AxisStatus, "OBSERVED">`。**`pan` 以外は型として OBSERVED にできない** | 同 |
| matcher | 全軸を JSON 値で比較。`UNAVAILABLE` 軸は既定値のみ一致。capabilities が `RUNTIME_SUPPORTED_CAPABILITIES`（現在 `[]`）に無い target は一致しない | `src/logic/discovery/matcher.ts` |
| 実行時 catalog | `RECIPE_DISCOVERY_CATALOG` は全 target が `DEFAULT_IDENTITY_DIMENSIONS`。`items` は `requiredIngredients` の id、`sauceBase` は category が sauce のもの | `src/data/discoveryCatalog.ts` |
| Phase-2 の語彙 | Pinsa は `identityDimensions.dough = "material-multigrain-long-ferment"`、`capabilities = ["DOUGH_VARIANT"]`、`items` に疑似項目 `dough:material-multigrain-long-ferment` を含む | `docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json` |
| 衝突 | `jamon-serrano-pizza`（shipped）と Pinsa は食材集合が同一。Phase 0 で P0-COLL-4 として記録済み、「生地で区別される」判定 | matrix §6.1 |
| 試行 fingerprint | OBSERVED かつ既定値でない軸は `ext` に**自動で**載る（未配線） | `attemptFingerprint.ts` |

### 1.2 変更後の識別（案）

```
identity = ingredientSet ∧ sauceBase ∧ dough ∧ pan ∧ （その他の軸は既定値のまま）
```

| 軸 | 値の集合 | 出どころ（唯一） | 既定 |
|---|---|---|---|
| `pan` | `null` \| `"tray"` | `PizzaState.pan`（F1、変更なし） | `null` |
| `dough` | `"standard"` \| `"material-multigrain-long-ferment"`（Pinsa）\| …将来 | **新規** `PizzaState.dough?`（任意・非永続）。未設定・不正値は `"standard"` | `"standard"` |

規則:

1. **2 軸は互いを読まない。** `dough` の値は `pan` や `squareDough` から推定しない。`pan` の値は `dough` から推定しない（`pan` が `squareDough` から推定されないのと同じ規則）。
2. 値は**明示された選択だけ**が数える。Preview のクエリや、レシピの見た目の設定だけでは立たない（F2 の「Preview クエリだけでは発見にならない」と同じ）。
3. 不正値（未知の文字列・数値・オブジェクト）は `"standard"` に倒れる。既存のピザは 1 つも識別が変わらない。

### 1.3 値の語彙: Phase-2 の文字列をそのまま使う（**Owner 確定 2026-10-20**）

| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 識別値 = Phase-2 の語彙（`material-multigrain-long-ferment`）。`PizzaState.dough` もこの文字列を持つ | 変換層が無い。`discoveryCatalog.test.ts` の「Phase-2 target と dims が同一」検証がそのまま使える。matrix / validator と食い違わない |
| B | 短い内部 id（`pinsa`）を持ち、識別値へ写像する表を 1 か所に置く | 将来 Piadina / Manakish を足す時に読みやすいが、**同じ事実を 2 つの名前で持つ**。写像の漏れが識別の不一致になる |

`pan: "tray"` は Phase-2 語彙と一致していたので変換不要だった。生地では語彙が長いが、**内部 id は player に見えない**（保存もされない）。Owner が案 A を確定した（172 レシピ設計の語彙を優先、既存の `standard` を維持）。技法 id（永続）は §3 で別に決める。

### 1.4 catalog target と Phase-2 検証の整合

Pinsa の実行時 target を `RECIPE_DISCOVERY_CATALOG` に足すとき、既存テストとの接点が 3 つある。

| 既存テスト | 起きること | 設計上の扱い |
|---|---|---|
| `discoveryCatalog.test.ts`「target が Phase-2 SHIPPED_KEEP と同一（items, capabilities, dimensions）」 | Phase-2 の Pinsa `items` は `dough:…` 疑似項目を含み、実行時 `items` は食材 id のみ | 実行時 `items` は**食材 id だけ**にする（`pan` が `items` に入らないのと同じ）。テストは**名前付きの例外**として「Phase-2 items から `dough:` 接頭辞を除いたものと等しい」を検証し、`dough` は `identityDimensions` で比較する |
| 同ファイル「実行時 signature がすべて一意」 | `[items, sauceBase]` だけのキーなら Pinsa と jamon が衝突する | キーに `identityDimensions` を含める（本来 signature はそれを含む）。**この変更は named で、テストを緩めるのではなく、キーを実態に合わせる** |
| `dinnerResultDetection.test.ts` 32「全 recipe の signature が一意」（上の 2 行は `discoveryCatalog.test.ts`） | キーが `[items, sauceBase]` のみ。Pinsa で**意図的に失敗する** | `dough` / `pan` を含む正しいキーへ更新。更新理由は Result に記録 |
| 同ファイル 12「各 recipe の Reference pizza はその recipe として発見される」 | Reference pizza は `dough` を持たないので、Pinsa の Reference は jamon として発見される | テストの pizza 生成を「recipe の `doughKind` を `PizzaState.dough` に設定」するよう更新。Guided の開始時にも同じ設定を行う（§5.4） |

加えて `matcher` は capabilities を要求する: Pinsa の Phase-2 `capabilities = ["DOUGH_VARIANT"]` は `RUNTIME_SUPPORTED_CAPABILITIES = []` に無いため**一致しない**。軸を OBSERVED にするのと**同じ commit** で `DOUGH_VARIANT` を supported に加える（名前付き定数、architecture test で matcher が techniques を読まないことは維持）。

### 1.5 組み合わせ表（Free Cooking / Research、affordance 開、Completion Gate 通過）

> **superseded（L1、2026-10-23）**: 下表は 4 食材すべて焼成前だった時点の表。現在の判定表は L1 決定記録 §1（D2）と `discoveryCatalog.doughIdentity.test.ts`（#640）の 16 行。`pinsa-romana` に一致するのは「Pinsa 生地 ∧ ルッコラを FINISH で後乗せ」のときだけで、下表の「jamon の集合 × Pinsa × tray なし」は ORIGINAL（後乗せが無いため）になる。

| 食材集合 | dough | pan | 結果 | 技法の記録（usage 経路） |
|---|---|---|---|---|
| jamon の集合 | standard | null | `jamon-serrano-pizza`（NEW / ALREADY） | なし |
| jamon の集合 | **Pinsa** | null | **`pinsa-romana`**（NEW / ALREADY） | Pinsa 生地 |
| jamon の集合 | Pinsa | tray | ORIGINAL（該当 target なし） | Pinsa 生地 ＋ 天板焼き |
| jamon の集合 | standard | tray | ORIGINAL | 天板焼き |
| グランマの集合（将来） | standard | tray | `grandma-pizza`（E の後） | 天板焼き |
| グランマの集合（将来） | Pinsa | tray | ORIGINAL（グランマは `standard` を要求） | Pinsa 生地 ＋ 天板焼き |
| 任意の別集合 | Pinsa | null | ORIGINAL | Pinsa 生地（INV-TQ-6） |

組み合わせごとに target を足す必要はない。**`(Pinsa, tray)` を要求するレシピは無い**ので ORIGINAL になる。これは O-2（別レシピの食材を □ で焼くと ORIGINAL）と同じ性質の既存の許容事項。

---

## 2. 既存の天板切り替え（○/□）との関係

### 2.1 何が共有され、何が別か

| 観点 | 天板（○/□） | 生地の種類（新規） | 共有／別 |
|---|---|---|---|
| 識別軸 | `pan` | `dough` | **別** |
| 状態 | `PizzaState.pan?: "tray" \| null` | `PizzaState.dough?: <語彙>` | **別**（同じ形の任意・非永続フィールド） |
| 技法 | `tray`（天板焼き） | 新規 1 つ（§3） | **別**（同じレジストリ・同じ仕組み） |
| affordance | `tray` を要求する target の最小 step を導出 | **その技法を要求する target** の最小 step を導出 | **別**（技法ごとに導出。互いの開閉に影響しない） |
| 選択 UI | `PanSwitch`（radiogroup「生地の形」） | 新規チップ（radiogroup、§6） | **別**（同じ DOUGH ドック内に並ぶ） |
| 表示条件の形 | PREPARE ∧ DOUGH ∧ FREE_COOK ∧ affordance 開（`isPanSwitchVisible`） | 同じ形、affordance だけ自分の技法 | 形を共有、値は別 |
| 形状の物理 | 四角では `squareDough`（押し広げ・四隅）に変わる | **変えない**（最初の slice では丸も四角も既存の伸ばし操作のまま） | 生地の種類は物理に影響しない |
| 採点 | 変更なし | 変更なし | — |
| 保存 | 非永続 | 非永続 | — |

### 2.2 衝突しない規則

1. **書き込みの分離。** 両 action とも、**相手の生地選択**（`SELECT_PAN` は `pizza.dough`、`SELECT_DOUGH` は `pizza.pan`）と `doughShape` / `squareDough`（形状状態）を変えない。そのうえで、`SELECT_PAN` は現行どおり `pizza.pan` を更新し、`pan` から導かれる `cookingProfile`（`cookingProfileForPan`）と `cutState` を**再計算する**（`gameReducer.ts` の `SELECT_PAN`。変更しない）。新しい `SELECT_DOUGH` は `pizza.dough` だけを変え、`cookingProfile` と `cutState` も**変更しない**（`pan` が変わらないので派生値も変わらない）。
2. **○→□→○ と生地の種類は直交する。** ○/□ を切り替えても `dough` は保持され、生地の種類を切り替えても `pan` は保持される。F4-b の「○に戻すと `pan` キーを削除し、未切替と deep-equal」は、`dough` があっても `pan` についてだけ成り立つ（`dough` 未選択なら全体が deep-equal）。
3. **「次へ」で両方が確定する。** DOUGH を出ると `SELECT_PAN` が no-op になる（O-7）のと同じく、`SELECT_DOUGH` も no-op になる。
4. **「作り直す」（RESET_PIZZA）で両方が破棄される。**
5. **cookingProfile は `pan` だけから決まる。** `cookingProfileForPan` / `effectivePanShape` は `dough` を引数に取らない（この分離をテストで固定: 「`dough` だけが違う 2 つのピザで `effectivePanShape` と profile が同一」）。したがって `SELECT_PAN` だけが profile / `cutState` を再計算し、`SELECT_DOUGH` は再計算しない。
6. **見た目の連動は最初の slice に入れない。** 生地の種類で焼き色・厚み・耳を変えるのは D2-b（焼成表現）と衝突しうるため別 slice。識別・技法・選択 UI だけで価値が出る。

### 2.3 将来の拡張点（今は作らない）

生地の種類を増やす（Piadina / Manakish）ときは、`dough` の語彙と技法レジストリへ 1 行ずつ足し、catalog に target を足すだけで済む設計にする。1 技法に複数の生地を割り当てるか、生地ごとに技法を持つかは Owner 判断（§12 Q3）。

---

## 3. 技法（how）としての設計

### 3.1 既存の仕組みへの乗せ方

| 部品 | `tray` での実装 | 生地の種類での扱い |
|---|---|---|
| レジストリ | `src/data/techniques.ts` の `TECHNIQUES` | 1 件追加（`TechniqueId` union を拡張） |
| 使った検出 | `usesTray(signature)`: `dimensions.pan` が OBSERVED かつ `"tray"` かつ食材あり | `usesDough(signature)`: `dimensions.dough` が OBSERVED かつ当該の値かつ食材あり |
| 要求の検出 | `requiresTray(target)`: `identityDimensions.pan === "tray"` | `identityDimensions.dough === <当該の値>` |
| 型 | `TechniqueTargetView.identityDimensions?: Partial<Pick<IdentityDimensions, "pan">>` | `"pan" \| "dough"` に拡張 |
| affordance | `techniqueAffordanceStep(id, catalog, materialStep)`: その技法を要求する target のうち、材料がそろう最小 ladder step | **変更なし。** catalog に Pinsa target があれば自動で導出される。INV-TQ-4（要求する target が無い技法は開かない）も変更不要 |
| 台帳 | `discoveredTechniqueIds`（上限 64、未知 id は保存時に保持） | 変更なし |
| 登録 | `REGISTER_TO_DEX` の同一遷移（usage 経路 + recipe 経路） | 変更なし |
| Dex 調理法欄 | `techniqueDexViews`（RIDDLE → DISCOVERED） | 変更なし（レジストリの行が増えるだけ） |
| RESULT | 技法ステージ（レシピより先に表示、P5） | 表示内容は変更なし。**ただし `TechniqueReveal.tsx` が `data-technique-id={t.id}` で生の技法 id を DOM に出している**（技法 id `dough-pinsa-romana` は `romana` を含み、レシピ名「ピンサ・ロマーナ」との対応が DOM から読める）。P1 で中立な属性に置き換える（§5.7 R6） |
| 発見の禁止ラウンド | Lunch Rush / Dinner は 0 | 変更なし |

**型の注意:** `RoundTechniqueInput.signature` と `TechniqueRegistrationInput.signature` は `Pick<RuntimeSignature, "ingredientSet" | "sauceBase">` で、`dimensions` は `detection.ts` の `Partial` でのみ受けている。実装 PR では `dimensions` を型で明示する（現状も実行時には完全な signature が渡る）。

### 3.2 技法 id と名前

**技法 id（永続）— `dough-pinsa-romana`（Owner 承認 2026-10-20）**

| 項目 | 内容 |
|---|---|
| 経緯 | Owner の第一候補は `DOUGH_PINSA_ROMANA`。既存規則と衝突するため修正案を報告し、Owner が **`dough-pinsa-romana` を承認**した |
| 既存規則 | 技法 id は `/^[a-z0-9][a-z0-9_-]{0,63}$/`（小文字の kebab / snake）。`techniques.test.ts` が全レジストリ id に対して固定。保存側も `SAVE_ID_PATTERN`（同じ文法）で「整形済みの未知 id」を判定する（`saveIdGrammar.ts`）。既存の id は `no-sauce`、`tray` |
| 大文字 id を採らなかった理由 | 大文字を含む id は (1) レジストリのテストに落ちる、(2) 保存の文法に合わず、旧ビルドが保存時に失う（前方互換が効かない）。id は永続で後から直せない |
| 規則側を変える案 | 保存の文法は全カタログ id が共有しており、旧ビルドとの互換が壊れるため採らない |
| 命名の含意 | id が `dough-pinsa-romana` なので、Pinsa については **1 技法 1 生地**（§12 Q3 の照合を参照）。id と `DoughKind` の値（172 設計の語彙 `material-multigrain-long-ferment`）は別物で、対応表は技法レジストリの検出・要求の 1 か所に置く |

**名前・説明・なぞかけ（Owner 承認）**

| 項目 | 内容 | 備考 |
|---|---|---|
| `nameJa` | **ピンサ生地** | 表示してよい面は §5.7 の表で定義する。**未発見レシピとの対応を漏らさない**規則 R1〜R5 に従う |
| `descriptionJa` | **空気を含んだ軽い食感が特徴の生地**（基本。語尾の最終調整は Owner） | 食感だけを述べる一般説明。レシピ名・食材名・個数・操作を含まない → OD-TQ-5/6 の追加例外は不要（天板焼きの説明は操作を含むため例外が要った）。発見後の Dex にだけ表示 |
| `riddleJa`（未発見だが affordance 開のときの固定なぞかけ） | **「同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。」**（Owner 承認） | 既存アサーションとの照合は下の表。全プレイヤー共通の固定文字列で、レシピ・状態から派生させない |
| 食感の表現と証跡 | 説明は「空気を含んだ軽い食感」。証跡の `doughStyle` は「小麦・米・大豆をブレンドした長時間発酵生地」 | 矛盾はしないが同じ観点でもない。**pizzadb.jp 原典確認（PK-0、P3 の開始条件）で説明の妥当性も確認する** |
| 文字列の置き場所 | 名前・説明・なぞかけは `techniques.ts` の 1 か所だけ（天板焼きの「allowlist ファイル」テストと同形）。他の面は定数を参照する | PK-22 |

**なぞかけと既存アサーションの照合（このセッションで確認）**

| 既存の規則 | 対象 | 結果 |
|---|---|---|
| `techniques.test.ts`: なぞかけは技法名を含まない | 「ピンサ生地」 | 含まない ✓ |
| 同: `/ソース\|なし\|省/` に一致しない | なぞかけ全文 | 一致しない ✓（機械的に確認） |
| `techniques.tray.test.ts` 型: レシピ・食材・個数・target の語を含まない（`/グランマ\|にんにく\|オリーブ\|トマト\|モッツァレラ\|\d\|[０-９]/` に相当） | なぞかけ・説明 | 含まない ✓。「一枚」は漢数字で数字の個数指定ではなく、target の個数も示さない。dough 版では `ピンサ\|ロマーナ\|ハモン\|生ハム\|ルッコラ` も禁止語に加える |
| OD-TQ-5/6: 具体的な操作を名指ししない | 「生地の仕立て方で」 | 一般的な方向づけで、具体操作（伸ばす・寝かせる等）を名指ししない → **追加の例外承認は不要**と判断。Owner が懸念する場合は報告してほしい |
| G2 固定文言（Research の共通ヒント）との関係 | 「材料だけでなく、生地の形や調理法も工夫してみよう。」 | 別の面・別の定数。なぞかけは Dex の調理法欄、G2 は Research の文脈。コピー流用・派生はしない（F 監査の「面ごとに完全一致で固定」） |
| タイミングの観察 | affordance は Dex 進捗（アルゴラの解禁 step）だけの関数 | 技法の仕組みの先例どおり（INV-TQ-4）。なぞかけが現れる時点は全プレイヤーで同じ規則 |

### 3.3 技法として扱わない場合との比較

| 案 | 内容 | 評価 |
|---|---|---|
| **A（Owner 第一候補）技法** | 上記。発見は「作り方を見つける」体験になり、Dex の調理法欄に載る | 既存の 2 経路（使った／レシピ）と affordance・台帳・RESULT がそのまま使える。tray と同じ審査（Anti-Oracle・DH4）を通せる |
| B 素材（what） | 生地を食材として所持・購入し、トレイから選ぶ | 所持品・ladder・経済・在庫に波及する。Hint 5.0 の「食材の事実」に生地が混ざり、OD-TQ-6（ヒントは技法に触れない）の分離が崩れる |
| C 識別軸のみ（技法なし） | 発見の演出なし。選択 UI だけ | 「新しい作り方を見つけた」体験が無く、Dex 調理法欄の一貫性も崩れる |

---

## 4. 発見判定

### 4.1 判定の流れ（変更点は 3 か所）

```
signatureOfPizza(pizza)            ← dough を OBSERVED で読む（変更 1）
  └ matchDiscovery(signature, RECIPE_DISCOVERY_CATALOG)   ← 比較ロジック自体は変更なし
       └ evaluateDiscovery → NEW_DISCOVERY / ALREADY_DISCOVERED / ORIGINAL / AMBIGUOUS
resolveRoundTechniques(...)        ← usesDough / requiresDough を追加（変更 2）
catalog: Pinsa target              ← identityDimensions.dough を持つ（変更 3）
```

`matcher.ts` は**一行も変えない**（INV-TQ-NB）。matcher は techniques を import せず、技法台帳を読まない。この不変は `techniques.architecture.test.ts` が固定している。

### 4.2 ラウンド別の挙動

| ラウンド | 生地選択 | Pinsa の発見 | 備考 |
|---|---|---|---|
| Guided（図鑑から選んだレシピ） | チップは出さない。**レシピの `doughKind` から開始時に `PizzaState.dough` を設定**（§5.4） | 作れば `pinsa-romana` として一致 | 発見済みのレシピだけが選べるので、技法はレシピ経路で既に記録済み |
| Free Cooking / Research | 当該技法の affordance が開いていればチップを表示 | チップで Pinsa を選んで正しい食材を作れば NEW_DISCOVERY。技法は同じ遷移で先に表示 | |
| Lunch Rush | なし | **対象外**（`lunchRush: false`。aussie / jamon-serrano と同じ） | |
| Dinner | なし | **出題しない（Owner 方針 G）**。Dinner の識別は composition だけで `matchDiscovery` を使う（`dinnerResultDetection.ts`）ため、チップの無い Dinner では Pinsa の食材が必ず jamon になる | **確認済み:** Dinner の target は `DINNER_MISSIONS[*].targetRecipeIds` の**固定リスト**（`dm-a`: margherita / bismarck / breakfast-pizza / funghi、`dm-b`: margherita / funghi / melanzane-pizza / parmigiana-pizza、population `w1-25`）で、カタログ全体から抽選しない。よって Pinsa は**リストに載せない限り出題されない**。受け入れ条件 PK-19 でガードテストを追加する（§8） |

### 4.3 試行 fingerprint

`attemptFingerprint.ts` は OBSERVED かつ既定値でない軸を `ext` に自動で載せる。Pinsa を選んだ試行は fingerprint が変わり、同じ食材集合の標準生地の試行と**別の試行**として扱われる。fingerprint はいまは未配線で、配線される時点でこの挙動が正しいことを確認する（Trial Notebook への記録は §5.3）。

---

## 5. ヒント・Research・採点・保存

### 5.1 Hint 5.0（有料ヒント）

- ladder は `requiredIngredients` だけから作られる。**Pinsa の ladder は jamon-serrano と同一**になる。これは意図どおり（OD-TQ-6: ヒントは技法・pan・生地に触れない）。
- 影響: `hint5Production.gate` G7 と `deductionProduction.gate` の INV-TQ-4 は現在「技法を要求する recipe = NO_SAUCE」を前提にしている。tray の準備（F）で allowlist 形（`NO_SAUCE ∪ PAN_TRAY`）に直す方針が決まっている。生地の種類はこの allowlist に**別の名前付き定数**（例: `DOUGH_TECHNIQUE_RECIPE_IDS`）を足す。OD-544-1 の「共有定数 1 か所」方針に従い、F2 の定数と重複定義しない。
- DH4 privacy sweep の `GATE_STATES` に **`dough` の状態（standard / Pinsa）を加えて全再実行**し、掃引した状態数を Result に書く。新しい fact id・ヒント行・保存 id に、生地の種類・技法に固有の語（§5.7 の定義。G2 固定文言は除く）が出ないことを確認する。
- `recipeHintRoles`（G17）には Pinsa 用の行が要る。key-free の扱いは jamon-serrano と同じ方針を推奨するが、G17 の結果で確定する。

### 5.2 Research

- Research エントリは**所持と図鑑だけ**から導出される（`researchEntry.ts`）。技法の状態を読まない（L2 ↛ L3、F 監査 R1 / R10）。生地の種類を足しても**この規則は変えない**。
- **コホート文字:** Pinsa と jamon-serrano は同じ「最後に解禁される有限材料」を共有するため同じコホートに入る見込み。現在 bare のコホートに A/B が付く（OD-544-4/5 で許容済みの挙動、marinara と同じ形）。文字は `opaqueHash(recipeId)` の昇順で決まる（導出で検証。固定しない）。Recipe Batch Validator の「新レシピは既存コホートに入らない」には**明示的な例外**が必要（#527 の D1 と同じ形）。
- Research の選択が 1 → 2 件になる箇所のテスト（HOME の直行ルート、Pizza Select の routing、Hint シートの CHOOSE_RESEARCH）は実装 PR が**一覧を出して**更新する（F 監査 R9）。
- 結果行（○×）は食材の所属のみで、生地の種類で変わらない。ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一（INV-D3）。
- **G2 の固定文言**（「材料だけでなく、生地の形や調理法も工夫してみよう。」）は Research target 共通で変えない。「生地の形や調理法」は既に生地全般を含む表現で、**生地の種類のために文言を足さない**。
- **Trial Notebook は生地の種類を記録しない**（pan を記録しないのと同じ）。

### 5.3 RESULT の中立行

F3 で入った RESULT の中立行（pan で調理した未同定ピザ向け、ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一）の**生地版は作らない**ことを推奨する。理由: 生地の種類を選んだ未同定ピザにだけ出る行は、選んだことの有無を RESULT が開示する新しい経路になる。必要なら Owner が別途決める（§12 Q5）。

### 5.4 レシピ側のデータと Guided での設定

- `Recipe.doughKind?`（`panShape?` と同形の任意フィールド。**省略 = 標準**。`resolveDoughKind` を唯一の読み手にする）。Pinsa だけが設定する。
- **Guided の開始時に `PizzaState.dough` を設定する。** 設定しないと、図鑑から Pinsa を選んで作っても signature の `dough` が `"standard"` のままで jamon に一致する。
- 確認事項: `Recipe.panShape` から `PizzaState.pan` を立てる箇所は、main の grep では見当たらない（`pan` は `SELECT_PAN` と `pizzaWithPan` だけが書く）。四角いレシピ（グランマ）の Guided がどう `pan: "tray"` を持つかは E（#521）の設計事項のはずで、**本書は触れない**。ただし生地の種類は同じ抜けを作らない設計にする。

### 5.5 採点・Pitz・★・ランキング

| 項目 | 影響 |
|---|---|
| Scoring 2.0（Sauce / Pieces / Bake / Recipe 成分、52/16/12/20） | **変更なし。** 生地の種類を読まない（INV-TQ-3、`techniques.architecture.test.ts`） |
| Completion Gate | **変更なし**（レシピは `requiredIngredients`、Research は recipe-free ゲート） |
| Pinsa 固有の値 | `bakeTarget` と各食材の個数は GAMEPLAY CALIBRATION（Owner の Preview で確定）。jamon と同値にするか分けるかは Owner |
| Pitz / ★ / Dex BEST | 他のレシピと同じ（`baseRewardPitz` 100 が既定） |
| ランキング互換（`lunch-rush-v1`） | Lunch Rush 対象外のため影響なし |
| 将来 | 生地ごとの目標形状・厚みの採点は**今回やらない**（D2-b・Scoring 3.0 と別件） |

### 5.6 保存データ

> **訂正（2026-10-23）**: 下表の「`PizzaState.dough` は永続しない」は main と食い違う。**図鑑・技法台帳・save スキーマ（`schemaVersion`）には永続しない**が、**ラウンド途中のジャーナル `pendingRound`（`src/state/pendingRound.ts`）は `pizza.dough` を保存し、復元する**（`pizza.dough !== undefined` のときだけキーを持つ。標準生地ではキーなし = 旧形式と同一）。#639 が JSON 往復の復元をテストで固定する。影響範囲は「ラウンド途中のアプリ再開」のみ。旧ビルドは未知キーを無視する前提（P3-b-4 の往復テストで確認）。

| 項目 | 内容 |
|---|---|
| `PizzaState.dough` | **永続しない**（`pan` と同じ。save スキーマ変更なし） |
| 図鑑 | `pinsa-romana` の recipe id が増える。既存の前方互換（未知の recipe / Dex を保持、`persistence.forwardCompat.test.ts`）に乗る |
| 技法台帳 | `discoveredTechniqueIds` に id が増える。**新しいトップレベルキーなし**。旧ビルドは未知 id を保持（`extractForwardCompatExtras`） |
| schemaVersion | 変更なし。Save Protection（#560 / #568）の対象外 |
| 新→旧 | 旧ビルドは `pinsa-romana` と新技法 id を画面から隠し、保存時に失わない（既存の Phase 3-4B の保証） |
| 受け入れ | 旧 save → 新ビルド、新 save → 旧ビルドの往復テスト（F 監査 R8 と同形） |

---

### 5.7 未発見レシピ・技法の非開示（Owner 方針 F）— 面ごとの監査表

原則（Owner 決定 K を反映）: **表示名「ピンサ生地」を見せてよいのは、その技法を発見した player が見る面（RESULT の技法ステージ、Dex の調理法欄）だけ。レシピ名「ピンサ・ロマーナ」・レシピ id は、そのレシピを player が発見するまでどの面にも出さない。生の技法 id（`dough-pinsa-romana`）は、発見後も DOM・属性・aria を含めてどの面にも出さない（R6）。** さらに次の 5 規則で、**技法の表示と未発見レシピとの対応を切り離す**:

- **R1** 技法に関する面（なぞかけ・名前・説明）に、レシピ名・レシピ id・食材名・個数・ジャモン等の他レシピ名を含めない。
- **R2** Dex の調理法欄に「このレシピで使う」「使うレシピ数」などの**対応表示を作らない**。
- **R3** RESULT の技法ステージは、usage 経路で ORIGINAL なピザに対して出たときも、レシピ発見と同時に出たときも**同じ形式**（技法名と一般説明のみ）。未発見レシピの有無で形式を変えない。
- **R4** Dex のレシピ欄・Pizza Select・HOME は、技法の発見状態に依存しない（未発見レシピは匿名ロックのまま）。技法の発見が匿名ロックの表示を変えない。
- **R5** Hint 5.0・Research・Trial Notebook・○×パネルは、**生地の種類・技法に固有の語**（`ピンサ` / `ロマーナ` / `pinsa` / `dough-pinsa-romana` / 技法名・技法説明・なぞかけ、および target ごと・状態ごとに変わる誘導）を含まず、技法の状態を読まない。**明示的な例外: 承認済みの G2 固定文言「材料だけでなく、生地の形や調理法も工夫してみよう。」**（Research target 共通の定数。§5.2、PK-12）。この例外は G2 の文字列 1 つだけで、他の語に広げない。
- **R6** **生の技法 id を DOM・data 属性・aria に出さない。** 技法を発見した後でも、id `dough-pinsa-romana` は `romana` を含み、未発見レシピ「ピンサ・ロマーナ」との対応を示すため。現状の `TechniqueReveal.tsx` の `data-technique-id={t.id}` がこれに当たる。P1 で、id を含まない中立な属性（例: 値を持たない `data-technique-name`）に置き換える。`data-technique-id` を読むテスト・e2e は存在しない（`data-technique-reveal` / `data-technique-state` のみ使用。grep で確認）。React の `key` は DOM に出ないので対象外。

面ごとの扱いと、固定するテスト:

| 面 | 発見前の表示 | 発見後 | 固定するテスト |
|---|---|---|---|
| DOUGH のチップ（ラベル・aria-label・data 属性・アイコン） | 視覚描写のみ。語 `ピンサ` / `pinsa` / `ロマーナ` / `dough-pinsa-romana` を含まない | 同じ。**本書の既定ではチップに名前を出さない**（「生地を選択したプレイヤーに表示」が選択中のチップ上の表示を含むかは §12 Q13 で確認。Owner の回答があるまで名前なし） | DOM 文字列の走査 |
| Dex の調理法欄 | affordance が開いたときだけ「？？？」＋固定なぞかけ「同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。」。名前・説明は出さない | 「ピンサ生地」＋説明文（対応表示なし、R2） | `dexView.test` 系 |
| Dex のレシピ欄 | 未発見は既存の匿名ロック（`？？？`）。Pinsa 専用の例外なし | レシピ名 | 既存の匿名ロック gate |
| Research のラベル | `researchEntryLabel`: 解禁食材＋コホート文字のみ（INV-B7）。生地の種類・技法に固有の語を含まない | — | F 監査 R1 / R6 の同形テスト |
| Hint 5.0 の行・fact id・保存 id・near-miss | 食材の事実のみ。生地の種類・技法に固有の語なし（G2 は rung ではなく Research 共通の固定文言で、例外）。Pinsa の ladder は jamon と同一 | — | G7 / INV-TQ-4 / DH4 sweep（`dough` 状態込み） |
| G2 固定文言 | Research target 共通。生地の種類のために変えない | — | R11 の timing parity |
| RESULT | 技法を発見したときだけ技法ステージ（名前＋一般説明）。中立行は足さない（§5.3） | 技法名 → レシピ名の順（P5）。レシピが同時に発見された場合のみ、レシピ名が続く（R3） | ResultPanel の既存テスト＋usage 経路／recipe 経路で技法ステージが同形であることのテスト |
| Trial Notebook / ○× パネル | 生地を記録・表示しない | — | pan と同形の同一 DOM テスト |
| Pizza Select / HOME / ショップ | 未発見レシピは匿名のまま。生地の種類・技法に固有の語なし | — | 既存の routing / 匿名ロックのテスト |
| 保存データ・DOM 属性 | 技法台帳の id（`dough-pinsa-romana`）は player に見えない。**DOM・data 属性・aria にも出さない（R6）** | 同じ | 保存のスナップショットが UI に流れないことの確認＋後述の 3 状態の DOM 走査（PK-18） |

**残余リスクと Owner 決定（K）:** 技法は**使っただけで**（usage 経路。Free Cooking、affordance 開、Completion Gate 通過）発見でき、そのとき RESULT と Dex に「ピンサ生地」が出る。したがって **レシピ「ピンサ・ロマーナ」が未発見のまま「ピンサ」の語が先に見えうる**。天板焼きでも「四角いレシピがある」ことが同様に示唆される（先例）が、「ピンサ」は固有名で連想が強い。Owner は**表示を承認**し、条件として**未発見レシピとの対応を漏らさない**ことを求めた。この条件は R1〜R5 と PK-21 で担保する。承認された表示により、技法を発見した player は「ピンサという名の生地がある」ことを知る。これは設計上の承認済みの帰結であり、**レシピとの対応（どの食材集合か、レシピが存在するか）は表示しない**。

## 6. UI・操作設計

### 6.1 方針

- 食材ごとに操作を変えることは許容されているが、**この slice は新しいジェスチャーを作らない。** 選択チップ（既存の `PanSwitch` と同じ形の radiogroup）だけ。
- ドラッグ統一（#478）に依存しない。

### 6.2 DOUGH ドックの構成

現状の DOUGH ドック（`GameScreen.tsx`）は、四角のラウンドでは 工程帯（STEP 1/2）→ 状態行 → ゲージ → 「次へ」、丸では状態行、そして `PanSwitch` の順。ここに**生地の種類のチップを `PanSwitch` と同じ行に並べる**。

```
[ 生地の形 ○ □ ]   [ 生地の種類 ◯ ◯ ]        ← 同じ行（flex）。どちらかが閉なら片方だけ
```

| 状態 | 表示 |
|---|---|
| 両方の affordance が閉（本番の現状） | どちらも出ない（レイアウト変化なし） |
| 天板だけ開 | 現状と同じ（`PanSwitch` のみ） |
| 生地の種類だけ開 | チップのみ |
| 両方開 | 2 つの radiogroup を並べる。各選択肢は 44px 角（`PanSwitch` と同じ）で、360px 幅でも 2 組が収まる計算（2×44×2＋間隔）。**実測は実装 PR のレイアウト契約テストで固定** |

### 6.3 見た目と文言

- **アイコンのみ**（形・質感）。レシピ名・技法名・食材名を出さない（Anti-Oracle: 同じ affordance 状態の全プレイヤーに同じ表示）。
- `aria-label` は技法名・レシピ名を含まない語。候補は §12.2 Q4（推奨は中立の A「ふつうの生地」「ほかの生地」）。**文言は Owner 判断で、未決**。**「ピンサ」「pinsa」「ロマーナ」を含めない**（表示名「ピンサ生地」は技法の発見後の面だけ、§5.7）。**P2 の実装前に、この `aria-label` の文言を Owner が確定する必要がある**（§12 Q4 の残り）。
- 選択肢の初期値は「ふつうの生地」（未設定）。

### 6.4 表示条件（`panSwitchOffered` と同形）

PREPARE ∧ DOUGH ∧ **FREE_COOK**（Free Cooking と Research） ∧ **当該技法の affordance が開**。Guided / Lunch Rush / Dinner では出さない。レシピ自身が生地の種類を固定している場合（Guided の Pinsa）も出さない。

affordance は Dex 進捗だけの関数（Research target・所持・購入ヒントを読まない）。技法ごとに導出されるので、天板が開いていても Pinsa のチップは開かない（逆も同じ）。

### 6.5 reducer・状態

| 要素 | 内容 |
|---|---|
| action | `SELECT_DOUGH { dough }`（`SELECT_PAN` と同形）。DOUGH 以外・非 FREE_COOK・affordance 閉・DOUGH を出た後は no-op |
| pure 関数 | `panSelection.ts` に倣った `doughSelection.ts`: `doughSwitchOffered` / `pizzaWithDough`。未選択に戻すとキーを削除（未選択のピザと deep-equal） |
| 開始時 | Guided は `resolveDoughKind(recipe)` から設定。Free Cooking / Research は未設定 |
| 再開始 | `RESET_PIZZA` で破棄（Guided は開始時の設定を再適用） |
| Preview / DEV | `?doughKind=open`（強制オープン）のようなフラグは `?panSwitch=open` と同じく Preview / DEV 限定。**本番バンドルに含まれないことをゲートテストで固定**（`panShapePreview.gate.test.ts` と同形） |

### 6.6 アクセシビリティ

radiogroup / radio、`aria-checked`、キーボード操作、フォーカス可視、44px のタップ領域（`PanSwitch` と同基準）。選択状態の通知は `PanSwitch` と同じ方式に合わせる（実装 PR で `PanSwitch` のテストを流用）。

---

## 7. Pinsa のレシピデータ（暫定。確定は Owner）

> **superseded（L1、2026-10-23）**: 下表の「食材」行（4 食材すべて焼成前）、「`ladderCredit`」行の置き場（`RECIPES`）、「表示名」行、「個数・bake」行は上書きされた。現在の正は次のとおり。残りの行（id・生地・ソース・`lunchRush`・CUT・Reference・章）は有効。
>
> | 項目 | 現在の正 |
> |---|---|
> | 置き場 | `src/data/lateCatalog.ts` の `LATE_RECIPES`（`RECIPES` ではない）。`LATE_ORDERS`・`LATE_DISCOVERY_TARGET_IDS["pinsa-romana"] = "pinsa-romana-pizzadb-p9"`。`LATE_LADDER_STEPS` には足さない（D6） |
> | 食材 | tomato-sauce / mozzarella / prosciutto-crudo は焼成前、**arugula のみ `applicationPhase: "POST_BAKE"`**（L1）。後乗せ専用の素材は無い（通常素材のみ。D1 の検証が要求） |
> | 個数・bake（暫定、D4。実測前に正式確定しない） | tomato-sauce 1 / mozzarella 2 / prosciutto-crudo 3 / arugula 2（POST_BAKE）/ bake 58–78 |
> | `ladderCredit` | `false`（D1 の例外。`validateLateCatalog` が strict 検証） |
> | 表示名・説明文 | 「ピンサ・ロマーナ」／「独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。」（Owner、2026-10-23） |
> | 原典 | 項目 2・4・5 は未確認のまま本番 OFF のデータ追加に限り許容。**本番 ON 化の前に必ず確認** |

| 項目 | 案 | 根拠・備考 |
|---|---|---|
| id | `pinsa-romana` | matrix の `canonicalCandidateId` |
| 表示名 | ピンサ・ロマーナ（証跡は「ピンサロマーナ」） | 命名は Owner |
| 食材 | tomato-sauce 1 / mozzarella / prosciutto-crudo / arugula（jamon と同じ 4 種） | 証跡。**新規食材 0**（ladder に新しい step を足さない） |
| 個数・bake | 暫定（calibration） | Owner の Preview で確定 |
| 生地 | `doughKind`: Phase-2 の `material-multigrain-long-ferment` | §1.3 |
| ソース | `RECIPE_SAUCE_PROFILES["pinsa-romana"] = tomato-sauce / PAINT` | 既存の写像 |
| discovery target id | `pinsa-romana-pizzadb-p9` | 証跡 id（`discoveryCatalog.ts` の慣例） |
| `ladderCredit` | `false` | 新 step を足さないレシピの前例（aussie / brazilian-calabresa）。Recipe Batch Validator の「クレジット対象 = 追加 step」と整合 |
| `lunchRush` | `false` | §4.2 |
| CUT | なし | 「丸い既定は証拠ではない」（new-haven-apizza の前例）。Pinsa は楕円が本来で、丸い CUT の ideal-circle 前提に合うかは別途確認 |
| Reference | 8 スロットリング（非ソース 7 piece 以内） | jamon と同形 |
| 章／図鑑 | key step は jamon と同じ（arugula）。**章の件数が 1 増える** | 章を完了済みのセーブは未完了に戻る（Batch 7a / 8 と同じ注意。Owner 認識事項） |

出典の限界と**有効化の条件（Owner 方針 H）**: pizzadb.jp はこの環境から接続できず（プロキシ 403）、証跡は repo 内の記録（`verifiedAt: 2026-09-22 relayed, not independently re-fetched`）のみ。**P3（Pinsa の有効化）は、Owner が pizzadb.jp の原典を確認するまで開始しない。** 確認する項目: (1) 食材欄（モッツァレラ・生ハム・ルッコラ、ソース family＝トマトソース）、(2) `doughStyle`（小麦・米・大豆のブレンド、長時間発酵）、(3) 生地の形（丸か楕円か、CUT 対象にするか）、(4) 説明文「空気を含んだ軽い食感」が原典と矛盾しないか、(5) Piadina と食材が同じ（ソースの有無で区別）ことの確認。P1 / P2 は不活性なので、確認前に着手してよい。

---

## 8. 受け入れ条件（Pinsa 導入 slice）

開始条件
- **PK-0** ~~P3 の開始前に、Owner が pizzadb.jp の原典（§7 の 5 項目）を確認し、結果を Issue #577 に記録する。確認前は `pinsa-romana` を `RECIPES` に入れない~~ **（2026-10-23 更新）** 項目 2・4・5 は、**本番 OFF でのデータ追加準備（P3-b-1〜b-4）に限り未確認のまま許容**する。**本番 ON 化（E5）の前に、原典の 5 項目（＋工程・形・個別ページ）を Owner が確認し、結果（取得日・確認者・URL・引用）を #577 に記録する。** 未確認のまま ON にしない。`pinsa-romana` は `RECIPES` ではなく `LATE_RECIPES` に置く。

識別・技法
- **PK-1** 既存 target 全件の識別は変わらない: `dough` 未設定のピザについて、**全軸の値**と**既存 target との一致結果**（matcher の出力）が現状と等しい。**例外として `dimensions.dough.status` が `FIXED_BY_FLOW` から `OBSERVED` に変わることだけを明示的に許容**する（`signature.ts` の各軸は値に加えて `status` を持つため、軸全体の deep-equal は成り立たない）。この例外は `signature.test.ts` に名前付きで書き、他の軸の `status` は変えない。
- **PK-2** `dough` 軸が OBSERVED。未設定・不正値は `"standard"`。`pan` / `squareDough` から推定されない（`panAxis.test.ts` と同形のテスト）。
- **PK-3** jamon の食材集合（L1 で更新）: 標準生地・後乗せなし → jamon、標準生地＋ルッコラ後乗せ → ORIGINAL（D2）、Pinsa 生地＋ルッコラ後乗せ → pinsa-romana、Pinsa 生地で全部焼成前 → ORIGINAL、Pinsa＋tray → ORIGINAL。L1 の判定表（#640 の 16 行）を実カタログ（ON 相当）で全行テスト化（P3-b-2）。
- **PK-4** `matcher.ts` が techniques を import しない（`techniques.architecture.test.ts` が通る）。
- **PK-5** 技法: 使った経路（Free Cooking のみ・affordance 開・Completion Gate 通過）と recipe 経路が `tray` と同じ規則で動く。Lunch Rush / Dinner は 0。

UI・状態
- **PK-6** `SELECT_DOUGH` と `SELECT_PAN` が互いの生地選択（`dough` / `pan`）と `doughShape` / `squareDough` を変えない。○→□→○ で `dough` が保持される。`SELECT_PAN` は現行どおり `cookingProfile` / `cutState` を再計算し、`SELECT_DOUGH` はそれらを変更しない（deep-equal で固定）。
- **PK-7** `dough` だけが違う 2 つのピザで `effectivePanShape` と、そこから導かれる cookingProfile が同一。
- **PK-8** チップの表示条件: 閉（本番の現状）では DOM が現状と同一。Guided / Lunch Rush / Dinner では出ない。
- **PK-9** 360×800 / 390×844 でチップが 1 画面に収まり、`PanSwitch` と同時表示でも重ならない（レイアウト契約テスト）。

Anti-Oracle・Hint
- **PK-10** チップの表示は Dex 進捗だけの関数。Research target・所持・購入ヒント・食材一致で変わらない（F 監査 R1 / R10 に倣う掃引テスト）。
- **PK-11** Hint 5.0 の行・fact id・保存 id・near-miss に、生地の種類・技法に固有の語（§5.7 R5。G2 固定文言は例外）が無い。DH4 sweep を `dough` 状態込みで全再実行し、状態数を Result に記載。
- **PK-12** G2 の固定文言は変更せず、Research target 間で同一。
- **PK-13** gate の変更は named allowlist のみ。skip・retry・assertion 緩和・timeout 延長なし。

発見・Research
- **PK-14** Pinsa 追加で Research の選択が増えるテスト（HOME / Pizza Select / Hint シート）を一覧化して更新。
- **PK-15** コホート文字の変更を導出で検証し、validator の例外を名前付きで追加。

保存
- **PK-16** 旧 save → 新ビルド、新 save → 旧ビルドの往復で、図鑑・技法台帳が失われない。schemaVersion 不変。

採点
- **PK-17** Scoring 2.0 の golden・Pitz・ランキングが不変（`techniques.architecture.test.ts` の INV-TQ-3）。

非開示・出題
- **PK-18** 次の **3 状態** それぞれで、§5.7 の面の DOM（テキスト・`aria-*`・`data-*`・`class`・`id`）を走査し、指定の語が出ないことを固定する: **(a) 技法・レシピとも未発見:** `ピンサ` / `pinsa` / `ロマーナ` / `romana` / `dough-pinsa-romana` / 「ピンサ生地」が出ない。**(b) 技法は発見済み・レシピ `pinsa-romana` は未発見**（usage 経路で ORIGINAL なピザから発見した場合）: 「ピンサ生地」（名前・説明）は技法の面に**限って**出てよいが、`ロマーナ` / `romana` / `dough-pinsa-romana` / レシピ id は DOM のどこにも出ない（R6）。技法以外の面（Pizza Select・HOME・Dex のレシピ欄・Research）には「ピンサ」の語が出ない。**(c) 技法・レシピとも発見済み:** レシピ名は図鑑に出るが、`dough-pinsa-romana`（生の技法 id）は出ない。G2 固定文言は全状態で例外として出現し、同一である。
- **PK-19** Dinner: (a) `DINNER_MISSIONS` のどの `targetRecipeIds` も Pinsa（`doughKind` を持つレシピ）を含まない、(b) `validateDinnerMissions` に「技法を要求するレシピを target にしない」検査を名前付きで追加（`aussie` など既存の技法レシピも同じ規則で扱う）、(c) Pinsa の食材を Dinner で作っても Pinsa に同定されない（jamon 以外の target では「target 外」）ことを確認。
- **PK-20** 技法 id が **`dough-pinsa-romana`**（Owner 承認）で、`/^[a-z0-9][a-z0-9_-]{0,63}$/` に従い、旧ビルドとの往復で台帳から失われない（PK-16 と併せて確認）。
- **PK-21** 技法の表示と未発見レシピの対応を切り離す（R1〜R5）: (a) 技法の面（なぞかけ・名前・説明）にレシピ名・id・食材名・他レシピ名が無い、(b) Dex の調理法欄に対応表示（使うレシピ・件数）が無い、(c) RESULT の技法ステージが usage 経路と recipe 経路で同形、(d) 技法の発見状態を変えても Dex のレシピ欄・Pizza Select・HOME・Research のラベルが変わらない（掃引テスト）、(e) `TechniqueReveal` が生の技法 id を属性に出さない（R6。既存の `no-sauce` / `tray` も同じ扱い）。
- **PK-22** 技法の文字列: 名前 `ピンサ生地`、説明 `空気を含んだ軽い食感が特徴の生地`、なぞかけ `同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。` を完全一致で固定し、`techniques.ts` の 1 か所だけが持つ（他のファイルがこれらを文字列として含まない allowlist テスト）。なぞかけが `techniques.test.ts` の既存アサーションと、dough 版の禁止語（`ピンサ|ロマーナ|ハモン|生ハム|ルッコラ|トマト|モッツァレラ|\d|[０-９]`）に一致しない。

---

## 9. 影響を受ける既存テスト・成果物（実装 PR で一覧化する）

| 区分 | 対象 | 理由 |
|---|---|---|
| 識別 | `signature.test.ts`、`discoveryCatalog.test.ts`（items 例外・signature キー・Reference 生成） | §1.4 |
| 識別 | `dinnerResultDetection.test.ts` 32 | 食材だけのキーで一意性を見ているため |
| 技法 | `techniques.test.ts`、`techniques.tq1c.test.ts`、`techniques.tray.test.ts` の隣に dough 版、`TechniqueUi.test.tsx`（`data-technique-id` の置き換え） | レジストリ件数・なぞかけ定数・R6 |
| gate | `hint5Production.gate` G7、`deductionProduction.gate` INV-TQ-4、DH4 sweep（`GATE_STATES`） | §5.1 |
| カタログ | `catalogLedger.test.ts`（件数）、`recipeBatchManifest.ts`、`recipeBatch.validator.test.ts`（コホート例外）、章サイズ pin | レシピが 1 増える |
| golden | Hint 5.0 の ladders / alphaFamilyOnly、`sauceB1.singleSource.json` | 末尾追記 |
| 件数 pin | `recipes.test.ts`、`cookingProfiles.test.ts`、`lunchRush.exclusion.test.ts`、`progression.test.ts`、`recipeChapters.test.ts` | #527 が列挙したものと同じ系統 |
| Research | HOME / Pizza Select / Hint シートのルーティング、cohort 文字のテスト | §5.2 |
| 新規 | `doughAxis.test.ts`、`gameReducer.selectDough.test.ts`、`DoughKindSwitch.test.tsx`、`e2e/dough-kind-*.spec.ts`、Preview フラグのゲートテスト | |

衝突しやすいファイル（`scripts/ops/hot-files.json` の対象を含む）: `recipes.ts`、`gameReducer.ts`、`GameScreen.tsx`、`App.css`、`PROJECT_HANDOFF.md`。着手時は `TETO_SESSION-OPERATIONS_1.0.md` の claim を投稿し、Square Dough の進行中 PR と Batch 8 系の PR と重複しないことを確認する。**現時点の open PR #576（Square Dough D2-b1: 焼成オーバーレイ等）は `PizzaStage` / `App.css` 周辺を触るため、P2（チップ UI。`GameScreen.tsx` / `App.css` 末尾追記）とは「末尾追記の競合」になりうる。** Batch 8b と D2-b のファイルには触れない。

---

## 10. 新ソース 4 種（SAUCE 工程内）— 変更範囲と受け入れ条件

### 10.1 前提（Owner 方針）

- 焼成前の SAUCE 工程で塗る。既存の PAINT を使い、新しいジェスチャーは作らない。
- 4 つともソース扱い（`category: "sauce"`、`placement: "spread"`）。後乗せ（POST_BAKE）のソースは別 Issue（§11.3）。

### 10.2 レシピと食材（matrix の証跡）

| ソース（matrix の canonical） | レシピ（証跡 id） | 食材欄 | 既存に無い非ソース食材（今回再確認） |
|---|---|---|---|
| fromage-blanc-sauce | タルトフランベ（`flammkuchen-pizzadb`） | bacon / onion | **なし** |
| miso-sauce | ナス田楽ピザ（`eggplant-dengaku-pizza-pizzadb-p6`） | eggplant / mozzarella / white-sesame | **white-sesame** |
| yuzu-kosho | 柚子えびピザ（`yuzu-shrimp-pizza`） | mozzarella / shiso / shrimp | **shiso** |
| tahini | ナスとタヒニのピザ（`eggplant-tahini-pizza-pizzadb-p5`） | eggplant / parsley / pomegranate | **pomegranate** |

matrix の `newContentIngredientIds` は古い（eggplant・parsley・shrimp・bacon・onion は現在 `ingredients.ts` にある）。上の表は `src/data/ingredients.ts` と照合した現在値。4 件とも matrix 上は READY・blocker 0・FULL。tahini と Flammkuchen には**チーズが無い**（`deriveCoreSteps` が CHEESE 工程を作らない既存の挙動で処理される）。

### 10.3 「既存 taxonomy・レシピデータ契約」との整合

| 契約 | 現状 | 新ソースでの扱い |
|---|---|---|
| `Ingredient`（`ingredients.ts`） | 追加のみで足りる。sauce の既存例は `color` と `placement: "spread"`。finite にするなら `unlockCondition` / `pricePitz` / `restockQuantity` / `starterGrantOnly` | 4 件を sauce として追加。**色（`color`）が描画色を決める**（`colorOf`）。olive-oil だけが別扱い（`bakeOilHex`・重なり係数・CSS の `--oil`）。新ソースは**この特例に入らない**（`color` のみで描画）。色の決定は Owner |
| `RecipeSauceProfile.ingredientId` | リテラル union `"tomato-sauce" \| "pesto" \| "olive-oil"` | 4 件を union に追加。`satisfies Record<RecipeId, …>` が全レシピを再検査 |
| 食材 taxonomy（`ingredientTaxonomy.ts`） | **topping 専用**（family は topping のみ。sauce / cheese は category 水準で扱い、family を持たない） | sauce には family を**付けない**。`hint5Taxonomy.gate` の結果で確認（実装 PR の最初の確認事項） |
| 正規化規則（`TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md`） | 既存 id と別名の判定は表引き。新規は `genuinely_new` として登録 | 4 件の canonical id は matrix の候補。**本番 id の確定は Owner**。マスタ（`ingredient_master_catalog.json`）への追加は別の明示的な移行手順 |
| `deriveCoreSteps` | sauce 要件があれば SAUCE 工程 | 変更なし |
| `RECIPE_DISCOVERY_CATALOG.sauceBase` | category が sauce の食材 id | 変更なし（新ソースが自動で入る） |
| 複数ソース（B1/B2/S1/S2） | 種類別 ledger、run 描画、ヒント | 新ソースは単独ソースの使い方（1 レシピ 1 ソース）なので無影響。ただし**ユーザーは新ソースを他のソースと重ね塗りできる**（既存仕様どおり）。Anti-Oracle の「ソース行は使ったソースの数だけ」が新ソースにも成り立つこと |
| ladder | 追記専用・順序固定。末尾は Batch 8 系が触る | 新ソースは有限材料なので ladder に 4 step（または複数材料の step）が増える。**#527 / Batch 8b と直列**にする |
| 在庫・経済 | 有限材料は `pricePitz` / `restockQuantity` が必須 | 価格・数量は Owner（UF-F と同じ種類の判断） |
| アイコン | Ingredient Icons 2.0（Style Lock v2） | ソースは paint 色で表現されるので、アイコンはトレイ／ショップのチップ用。**スタイルは Style Lock v2 に従う**。専用 SVG が必要かは #417 / #503 の運用に合わせる |
| Hint 5.0 | sauce rung は「全ソース」 | 単独ソースのレシピは 1 sauce rung（既存の形） |

### 10.4 テスト・fixture の影響（「sauce が 3 種」を前提にしているもの）

| 対象 | 内容 |
|---|---|
| `sauceKindFixtures.ts` の `SAUCE_KINDS = ["tomato-sauce", "olive-oil", "pesto"]` | 固定の 3 種。新ソース用に拡張するか、別 fixture を足す |
| `sauceLayers.test.ts` ほか | 3 種を循環する履歴 |
| `techniques.test.ts` の `SAUCE_IDS` | `INGREDIENTS` から導出なので自動追従 |
| `toppingSizeClass.test.ts` | sauce id が size class に載らないことの確認 |
| `IngredientTray.recommendedOther.test.tsx` | 所持 3 種の例 |
| DH4 / Hint 5.0 gate | 「ソース 1 種」の許可リスト。単独ソースなので allowlist は不要の見込みだが、sweep の再実行は必須 |
| 件数 pin | `recipes.test.ts` ほか（§9） |

### 10.5 受け入れ条件（新ソース、1 種あたり）

- **NS-1** 食材が `category: "sauce"` / `placement: "spread"` で追加され、`Ingredient` のどの既存フィールド契約にも違反しない（型・`ingredients.test.ts`）。
- **NS-2** そのソースを必須とするレシピが、`RECIPE_SAUCE_PROFILES`（PAINT）・`discoveryCatalog`・`referencePizza`・`recipeHintRoles`・`orders` の全表に載り、`w1Activation.test.tsx` の「production tables」「exact-set discovery」が通る。
- **NS-3** SAUCE 工程で塗れ、完成判定が量・被覆で通る。重ね塗り（他ソースとの組み合わせ）で既存の描画が崩れない（`PizzaStage.sauceKinds` 系）。
- **NS-4** 発見: 食材集合が一意（既存レシピと衝突しない）で、NEW_DISCOVERY → ALREADY_DISCOVERED が正しい。matrix 上、4 件とも既存と衝突しない。
- **NS-5** Hint 5.0・DH4 の gate を全再実行し、新しい fact id が出ない。sweep の状態数を Result に記載。
- **NS-6** ladder は追記専用で、既存 step・golden が不変（`discoveryLadder.appendOnly.test.ts`）。
- **NS-7** 旧 save → 新ビルド、新 save → 旧ビルドの往復で失われない。
- **NS-8** 新ソースを除いた既存レシピの描画・採点が byte-identical（`PizzaStage.sauceRender.golden`）。
- **NS-9** 非ソースの新規食材（white-sesame / shiso / pomegranate）は、それぞれ Ingredient Icons 2.0 の手順（#417）に従う。追加しないレシピ（Flammkuchen）を最初の slice にできる。
- **NS-10** `lunchRush` / `ladderCredit` / CUT / key-free の宣言を batch manifest に明示（既存の validator が要求）。

### 10.6 推奨順（新ソース）

1. **Flammkuchen**（fromage-blanc-sauce）: 非ソースの新規食材 0。ソース 1 件の導入手順を検証できる。
2. 味噌（white-sesame が 1 件）→ 柚子胡椒（shiso が 1 件）→ tahini（pomegranate が 1 件）。
3. 各ソースは**独立した小さな PR**にし、Batch 8b と直列にする。

---

## 11. 実装 slice・依存・起票案

### 11.1 Pinsa の slice（F1 / F2 / F4 の分割に倣う）

| slice | 内容 | 本番での見え方 | HV | 状態（Owner 2026-10-20） |
|---|---|---|---|---|
| P1 | `dough` 軸を OBSERVED、`PizzaState.dough?`、`Recipe.doughKind?`、`DOUGH_VARIANT` を supported に、技法レジストリ、検出・要求、**`TechniqueReveal` の生 id 属性の置き換え（R6）**。**RECIPES に Pinsa は入れない**（synthetic fixture で検証） | なし（不活性） | 不要（内部） | **設計方針を承認。コードは別 PR** |
| P2 | `SELECT_DOUGH`、`doughSelection.ts`、チップ UI、Preview フラグ、レイアウト契約。affordance は本番で閉（Pinsa を要求する target が無いため） | なし（閉） | 動画あり（Preview 経由、Owner 実機） | **設計方針を承認。コードは別 PR。チップの `aria-label` 文言の確定が必要（Q4 残り）** |
| P3 | `pinsa-romana` を追加（recipes / profiles / target / reference / hint roles / orders / manifest）、gate の allowlist、DH4 全再実行、Research の更新、Guided の開始設定 | **有効化** | **必須** | ~~HOLD（pizzadb.jp の原典確認まで）~~ **（2026-10-23）P3-a1（#639）・P3-a2（#640）・P3-b-1〜b-4 の 4 段階に分割済み。本番 OFF のデータ追加準備は Owner 承認済み（P3-b 自体の着手は別途の指示）。有効化（E5）は原典確認・実機 HV の後** |

P3 の前提: **原典確認（Owner、HOLD の解除条件）**、Q5〜Q8 の回答（§12.2）、Anti-Oracle §15 の再計算（複数ソース前提）は E の事項だが、生地の技法も sweep に含める。技法の名前・なぞかけ・説明（UD-G 相当）は **Owner 承認済み**（§3.2）。P1 は不活性なので、レジストリの文字列（名前・なぞかけ・説明）が本番バンドルに入っても player には見えない（INV-TQ-4: 要求する target が無い技法は開かない。天板焼きの F2 と同じ）。

### 11.2 P3 の監査項目（実装 PR の最初）

- Dinner は固定リスト（§4.2）で確認済み。PK-19 のガードテストを入れる。
- Hint 5.0 の `recipeHintRoles` / key-free の扱い。
- `cookingProfiles` の CUT 対象外（Pinsa）が validator と整合すること。

### 11.3 起票（2026-10-20、Owner 許可のうえ、重複を再確認して実施）

再確認（`search_issues` / `list_issues` / `search_pull_requests`、起票直前）:

| 候補 | 検索 | 結果 | 判定 |
|---|---|---|---|
| 生地の種類（Pinsa） | 「dough kind Pinsa technique 生地の種類 識別軸」 | #532〜#538（天板）、#33（伸ばす操作） | 該当なし |
| 新ソース 4 種 | 「新ソース fromage-blanc miso tahini yuzu-kosho Flammkuchen SAUCE」 | 0 件 | 該当なし |
| ソース後乗せ | 「POST_BAKE ソース後乗せ FINISH 液体 DRIZZLE 仕上げソース」 | #521、#537、#489、#518、#519 | 該当なし（いずれもソースの後乗せ自体は扱わない） |
| 最近の新規 Issue（2026-10-19〜） | open の新しい順 30 件 | #571 / #570 / #562 / #561 / #560 ほか | 関係なし |
| open PR | 「pinsa / dough kind / 生地の種類 / tahini / miso / flammkuchen」 | #575（本 PR）、#540（HOLD の丸いグランマ） | 重複なし |

起票した Issue:

| # | Issue | 親・関連 |
|---|---|---|
| **#577** | Dough Kind: 生地の種類を技法（how）として識別軸にする（Pinsa Romana が最初） | #294 / #182 / #532 / #538 / #521 / #527 |
| **#578** | New Sauces: Flammkuchen / 味噌 / タヒニ / 柚子胡椒（焼成前の SAUCE 工程） | #521 / #527 |
| **#579** | POST_BAKE のソース後乗せ: FINISH の液体対応と仕上げソース（DRIZZLE 候補） | #294 / #518 / #476 / #521 / #489（**#518 → D2-2 が前提のため着手は後**） |

3 件とも「計画の追跡のみ」で、実装・マージ・デプロイ・共有 Preview 更新は Owner の指示後と明記した。

### 11.4 延期

- **ZONED**: 将来フェーズ（Owner 決定）。本書は触れない。
- **Piadina / Manakish**: Pinsa の P3 が着地して、`dough` 軸と技法の運用を確認してから。Piadina はノンソース（no-sauce 技法との組み合わせ）、Manakish は証跡に source inconsistency の review item がある。
- **生地ごとの見た目・採点**: D2-b の後。

---

## 12. Owner 判断の状況

### 12.1 確定済み（2026-10-20、記録された Owner の発言のみ）

| 項目 | 決定 | 出どころ |
|---|---|---|
| `pan` と `dough` は独立な識別軸 | 確定 | 方針 第 1 弾・第 2 弾 |
| `dough` の語彙 | 172 レシピ設計の語彙、`standard` 維持（旧 Q1） | 第 2 弾 B |
| 技法 ID | **`dough-pinsa-romana`**（旧 Q2'） | 第 3 弾 J |
| 表示名・説明 | 「ピンサ生地」「空気を含んだ軽い食感が特徴の生地」（基本） | 第 2 弾 D・E |
| 「ピンサ生地」を選択したプレイヤーに表示してよい。ただし未発見レシピとの対応を漏らさない（旧 Q12） | 承認（条件つき） | 第 3 弾 K |
| なぞかけ | 「同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。」 | 第 3 弾 L |
| P1・P2 の設計方針 | 承認。**コード実装は別 PR** | 第 3 弾 M |
| P3（Pinsa の有効化） | **HOLD**（pizzadb.jp の原典確認まで） | 第 2 弾 H・第 3 弾 N |
| 未発見レシピ情報を UI・ヒントに漏らさない／Dinner に Pinsa を出さない | 確定 | 第 2 弾 F・G |
| Issue 起票（#577 / #578 / #579） | 許可 → 起票済み | 第 2 弾 I |
| 新ソース 4 種（`yuzu-kosho` を含む）をソースとして扱う | 確定（旧 Q10 の「柚子胡椒でよいか」は、方針 5 が `yuzu-kosho` を名指ししているため解消） | 第 1 弾 5 |
| L1（生ハム＝焼成前、ルッコラのみ後乗せ）・D1〜D8 | 確定（P3-b-1 以降の仕様。個数・bake は検証用の暫定値） | #577 Owner コメント 2026-10-23、`TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md` |
| PK-0 項目 2・4・5 は本番 OFF のデータ追加準備に限り未確認で許容。本番 ON 化の前に必ず原典を確認 | 確定 | Owner 判断 2026-10-23（P3-b-0） |
| 表示名「ピンサ・ロマーナ」、説明文「独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。」 | 確定 | 同上 |
| P3-b-1（データ）と P3-b-2（ON ビルドの判定テスト）は別 PR | 確定 | 同上 |

### 12.2 照合結果: Q3・Q5〜Q10 と残りの未決事項（**未回答を承認済みとみなさない**）

推奨は本書の助言であり、Owner の回答が記録されていないものは「未決」と書く。「P1」「P2」「P3」は、その判断が**どの slice の開始を止めるか**。

| # | 判断 | Owner の記録 | 状態 | 止めるもの | 具体的に報告すること |
|---|---|---|---|---|---|
| Q3 | 1 技法 1 生地か、複数の生地を 1 技法にまとめるか | 技法 id `dough-pinsa-romana` の承認のみ | **Pinsa については実質確定**（id が生地名を含むため 1 技法 1 生地）。Piadina / Manakish の扱いは**未決**（明示の回答なし） | なし（2 つ目の生地を足す時まで不要） | 承認は「Pinsa の id」についてで、他の生地を同じ技法に束ねる／別技法にする判断ではない。2 つ目の生地を設計する時に #577 で再度確認する |
| Q4 | チップの `aria-label`、技法の名前・なぞかけ・説明 | なぞかけ・名前・説明は承認（第 2・3 弾） | **一部未決: チップの `aria-label`（と見た目の描写）** | **P2** | 候補（推奨は A）: **A** 「ふつうの生地」「ほかの生地」（中立。生地が増えても「ほかの生地 1/2」と拡張でき、説明文の「軽い食感」を発見前に漏らさない）／**B** 視覚描写（「ふつうの生地」「粒の見える生地」など）。B は説明文に近い語を発見前に出す可能性があり、Q13 とも関係する。**Owner が文言を指定する必要がある** |
| Q5 | RESULT に生地版の中立行を足すか | **記録なし** | **未決** | **P3**（RESULT に影響） | 本書の設計は「足さない」（§5.3）。これは設計上の既定で、Owner の承認ではない。足す場合は文言と、ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一にする条件（F3 と同形）を決める必要がある |
| Q6 | Pinsa の `ladderCredit: false`、`lunchRush: false`、CUT なし、章の件数が 1 増えること | **記録なし**（Dinner 除外のみ承認） | **未決** | **P3** | Dinner は固定リストで構造的に除外（確定）。`lunchRush: false` は Dinner とは別の宣言で、未回答。`ladderCredit: false` は Recipe Batch Validator の「クレジット対象 = 追加 step」と整合する。章の完了済みセーブが未完了に戻る影響は Owner の認識が要る |
| Q7 | コホート文字（jamon と Pinsa が A/B になる）と validator の明示的な例外 | **記録なし** | **未決** | **P3** | OD-544-4/5 の範囲で許容されうるが、jamon-serrano に文字が付く具体的な変化は Owner が見ていない。例外は名前付きの allowlist にする |
| Q8 | Pinsa の個数・bake、jamon と同値にするか | **記録なし** | **未決** | **P3** | 暫定値は calibration で、Preview での Owner 確認で確定（この環境では確認できない）。同値か分けるかの方針が要る |
| Q9 | 新ソースの本番 id、色、価格・数量、ladder の位置 | **記録なし**（4 件をソース扱いにする方針のみ） | **未決** | **#578 の実装**（Pinsa には無関係） | id は matrix の候補（`fromage-blanc-sauce` など）で本番 id ではない。色（描画色）、価格・補充数量、ladder の位置は #527 / Batch 8b と直列にするため、着手時に Owner が数値を指定する |
| Q10 | 柚子は柚子胡椒（証跡どおり）か | 方針 5 が `yuzu-kosho` を名指し | **解消**（上記 12.1） | なし | 本番 id・色は Q9 に含まれる |
| **Q13（新）** | 「生地を選択したプレイヤーに『ピンサ生地』と表示する」の**範囲**。選択中のチップ上や選択直後に名前を出すのか、技法を発見した後の面（RESULT の技法ステージ・Dex の調理法欄）だけか | 第 3 弾 K は「選択したプレイヤーへの表示を承認」と述べたが、**どの面かは記録されていない** | **未決（本書は保守的な既定を採用）** | **P2**（チップの表示内容） | 既定: 名前は**技法の発見後の面だけ**（§5.7）。チップ上に出す場合、発見前の player（Completion Gate 未通過・失敗など）に名前が見えるため、R1〜R5 の「対応を漏らさない」に加えて、技法が未発見の player への表示ルールを別途決める必要がある。Owner の回答を待つ |

その他の未決（既存）:

| 項目 | 状態 | 止めるもの |
|---|---|---|
| pizzadb.jp の原典確認（PK-0。食材・生地の記述・形・説明の妥当性・Piadina との区別の 5 項目） | **未完了 → P3 は HOLD** | P3 |
| Design Lock §8-1（グランマの原典確認） | 未完了（#521 の E をブロック） | #521 E |
| UD-D / UD-F / UD-G の残り、OD-CS-12..19 | 未決（FINISH 側。本件のスコープ外） | FINISH 有効化 |

### 12.3 slice ごとの開始条件（Owner の記録に基づく）

| slice | 設計 | 未決で止まるもの | 実装 PR の着手 |
|---|---|---|---|
| P1（識別軸・技法レジストリ・検出。不活性） | 承認 | **なし**（id・語彙・文字列とも確定） | 別 PR。**着手は Owner の指示を待つ**（本 PR のスコープ外） |
| P2（`SELECT_DOUGH`・チップ。本番では閉） | 承認 | **Q4 残り（チップの `aria-label`）、Q13（チップ上に名前を出すか）** | 別 PR。P1 の後。上の 2 点が確定してから |
| P3（Pinsa の有効化） | 設計済み（2026-10-23 更新: P3-a1 / P3-a2 / P3-b-1〜b-4 に分割） | 本番 OFF の準備: 未決なし（P3-b-1 は #639・#640 の merge 後）。**有効化（E5）: 原典確認、Q5・実測 Q8、実機 HV** | P3-b-1 以降は Owner の着手指示後 |

## 13. リスク

| リスク | 内容 | 対策 |
|---|---|---|
| 発見の動線 | Pinsa を作りたい player は、チップが開いても「どの食材で生地を変えるか」を試行錯誤する。標準生地で作ると jamon が発見されるため、**ALREADY_DISCOVERED が「この食材集合は jamon」という強い手がかり**になり、Pinsa の存在に気づきにくい | Dex の調理法欄のなぞかけ（承認済み: 「同じ具材でも、生地の仕立て方で違う一枚になることがあるよ。」）、G2 固定文言（変更不可）。追加の誘導は Anti-Oracle 違反になるため作らない |
| 2 つのチップの密度 | 360×800 で DOUGH ドックが混む | PK-9 のレイアウト契約テスト。四角のラウンドでは工程帯・ゲージ・「次へ」も同居する |
| 識別軸の昇格が広範囲に効く | `signature.ts` / 型 / 検証 | P1 を不活性で入れ、synthetic fixture と掃引で検証してから有効化 |
| Dinner の識別 | composition のみで、Pinsa が必ず jamon になる | §4.2 のとおり出題されない設計にしてテストで固定 |
| Batch 8 系・Square Dough との競合 | `recipes.ts` など hot file | claim と直列化。着手前に open PR を確認 |
| 原典 | pizzadb.jp 未確認 | Owner の確認を P3 の前提にする |

## 14. 参照

- `docs/design/TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md`
- `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`、`docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`
- `docs/reports/TETO_SQUARE-DOUGH_F_RESEARCH-AUDIT.md`、`…_F1_PAN-AXIS_Result.md`、`…_F2_TRAY-TECHNIQUE_Result.md`、`…_F4b_Dough-Selection-UI_Result.md`
- `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md`、`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`、`docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json`
- `docs/reports/TETO_MULTI-SAUCE-RECIPES_Design-Lock.md`、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`、`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
- コード: `src/logic/discovery/{signature,matcher,attemptFingerprint,researchEntry}.ts`、`src/logic/techniques/{detection,registration,runtime,panSwitch,dexView}.ts`、`src/data/{techniques,discoveryCatalog,recipeSauceProfiles,ingredients}.ts`、`src/state/{panSelection,pizzaState}.ts`、`src/components/PanSwitch.tsx`、`src/mission/dinner/dinnerResultDetection.ts`
- Issue: #182 / #294 / #476 / #518 / #521 / #527 / #532〜#538 / #544
