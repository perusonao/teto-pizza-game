# TETO 生地の種類（Pinsa Romana）導入 — 実装前の詳細設計 ＋ 新ソース 4 種の変更範囲（docs-only）

Status: **設計のみ。実装は Owner 承認後。** `src/**`・`e2e/**`・CSS・レシピ／食材データ・テストは変更していない。
この文書の「推奨」は助言であり、Owner Decision ではない。未回答の判断は §12 に列挙し、推測で確定していない。

| 項目 | 値 |
|---|---|
| 監査対象 `main` | `c98d957`（#573 Square Dough D2-a2）。2026-10-20 に `git fetch origin main` で再確認 |
| 親の調査 | `docs/design/TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md`（同一ブランチ） |
| 触れていないもの | Square Dough D2-b、Batch 8b（#527 とその続き）、共有 Preview、既存の進行中 PR（#478 / #540 / #574 ほか）、#521 の本文 |
| HV | docs-only のため不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。実装 PR は §11 の各 slice で必須 |

## Owner 方針（2026-10-20）と、この文書での扱い

| # | 方針 | 反映先 |
|---|---|---|
| 1 | 生地の種類が最優先。最初の対象は Pinsa Romana | §1〜§9 |
| 2 | 生地の種類は技法（how）として設計することを第一候補にする | §3 |
| 3 | 天板の形（○/□）と生地の種類は**別の識別軸** | §1、§2、§6 |
| 4 | 新ソースは焼成前の SAUCE 工程で使う | §10 |
| 5 | fromage-blanc-sauce / miso-sauce / tahini / yuzu-kosho はソース扱い。既存 taxonomy・レシピデータ契約との整合を確認する | §10 |
| 6 | POST_BAKE のソース後乗せは別 Issue。重複 Issue は作らない | §11.3（起票案のみ。**起票はしていない**） |
| 7 | ZONED は将来フェーズに延期 | §11.4 |
| 8 | ドラッグ操作の全面統一は低優先度のまま | 本書の範囲外。どの slice も #478 に依存させない |

---

## 0. 要約

1. **`jamon-serrano-pizza` が Pinsa と同じ食材集合を持つ**（tomato-sauce / mozzarella / prosciutto-crudo / arugula）。現在の識別は `dough` を見ないので、Pinsa の食材を作ると必ず `jamon-serrano-pizza` が発見される。**生地を識別軸にしない限り、Pinsa は原理的に発見できない。** これが本件の核心。
2. **`dough` 軸は 11 軸のうち `FIXED_BY_FLOW`**（全ピザが `"standard"`）。`pan` が F1 でやったのと同じ手順で **OBSERVED に昇格**させる。軸は 2 本の独立した値になる: `pan ∈ {null, "tray"}`、`dough ∈ {"standard", <生地の種類>}`。matcher は全軸を値で比較するので、組み合わせは自動的に別の識別になる。
3. **技法（how）として扱う**: レジストリに技法を 1 つ足す。検出（使った）・要求（レシピが要る）・affordance（導出）・Dex の調理法欄・RESULT の技法ステージは、**`tray` と同じ仕組みにそのまま乗る**。新しい発見経路は作らない。
4. **UI は DOUGH 工程に選択チップを 1 組足す。○/□ の `PanSwitch` とは別の radiogroup** で、表示条件は同じ形（PREPARE ∧ DOUGH ∧ Free Cooking/Research ∧ **その技法自身の** affordance 開）。2 つは互いの状態を書き換えない。
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

### 1.3 値の語彙: Phase-2 の文字列をそのまま使う（推奨）

| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 識別値 = Phase-2 の語彙（`material-multigrain-long-ferment`）。`PizzaState.dough` もこの文字列を持つ | 変換層が無い。`discoveryCatalog.test.ts` の「Phase-2 target と dims が同一」検証がそのまま使える。matrix / validator と食い違わない |
| B | 短い内部 id（`pinsa`）を持ち、識別値へ写像する表を 1 か所に置く | 将来 Piadina / Manakish を足す時に読みやすいが、**同じ事実を 2 つの名前で持つ**。写像の漏れが識別の不一致になる |

`pan: "tray"` は Phase-2 語彙と一致していたので変換不要だった。生地では語彙が長いが、**内部 id は player に見えない**（保存もされない）ため、A を推奨する。技法 id（永続）は §3 で別に決める。

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

1. **書き込みの分離。** `SELECT_PAN` は `pizza.pan` だけを変える。新しい `SELECT_DOUGH` は `pizza.dough` だけを変える。相手のフィールド・`doughShape`・`squareDough`・`cookingProfile` を触らない。
2. **○→□→○ と生地の種類は直交する。** ○/□ を切り替えても `dough` は保持され、生地の種類を切り替えても `pan` は保持される。F4-b の「○に戻すと `pan` キーを削除し、未切替と deep-equal」は、`dough` があっても `pan` についてだけ成り立つ（`dough` 未選択なら全体が deep-equal）。
3. **「次へ」で両方が確定する。** DOUGH を出ると `SELECT_PAN` が no-op になる（O-7）のと同じく、`SELECT_DOUGH` も no-op になる。
4. **「作り直す」（RESET_PIZZA）で両方が破棄される。**
5. **cookingProfile は `pan` だけから決まる。** `cookingProfileForPan` / `effectivePanShape` は `dough` を引数に取らない（この分離をテストで固定: 「`dough` だけが違う 2 つのピザで `effectivePanShape` と profile が同一」）。
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
| RESULT | 技法ステージ（レシピより先に表示、P5） | 変更なし |
| 発見の禁止ラウンド | Lunch Rush / Dinner は 0 | 変更なし |

**型の注意:** `RoundTechniqueInput.signature` と `TechniqueRegistrationInput.signature` は `Pick<RuntimeSignature, "ingredientSet" | "sauceBase">` で、`dimensions` は `detection.ts` の `Partial` でのみ受けている。実装 PR では `dimensions` を型で明示する（現状も実行時には完全な signature が渡る）。

### 3.2 技法 id と名前

- **技法 id は永続**（`discoveredTechniqueIds` に保存され、以後変更できない）。player には見えない。
- 推奨: 暫定 id を `pinsa-dough`。**確定は Owner**（F で「内部 technique ID は F の続きで確定」とした扱いと同じ）。
- `nameJa` / `riddleJa` / `descriptionJa` は **UD-G（Owner 文言）**。本書は文言を書かない。
- **OD-TQ-5/6 の例外は天板焼きの一般説明に限って承認されたもの**（2026-10-18）。Pinsa のなぞかけが「操作」を含む場合は、**新しい例外承認が要る**。例外を使わない場合の制約: なぞかけは技法名・id・具体的な操作を名指ししない（`techniques.test` の既存アサーション）。
- 技法の説明文は**全プレイヤー共通の一般説明**で、レシピ名・食材名・個数を含まない。

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
| Dinner | なし | **出題されない設計にする**。Dinner の識別は composition だけで `matchDiscovery` を使う（`dinnerResultDetection.ts`）ため、チップの無い Dinner では Pinsa の食材が必ず jamon になる | Dinner の出題プールが何で絞られるかは実装 PR の監査項目（§11.2）。Pinsa が出題されないことを**テストで固定** |

### 4.3 試行 fingerprint

`attemptFingerprint.ts` は OBSERVED かつ既定値でない軸を `ext` に自動で載せる。Pinsa を選んだ試行は fingerprint が変わり、同じ食材集合の標準生地の試行と**別の試行**として扱われる。fingerprint はいまは未配線で、配線される時点でこの挙動が正しいことを確認する（Trial Notebook への記録は §5.3）。

---

## 5. ヒント・Research・採点・保存

### 5.1 Hint 5.0（有料ヒント）

- ladder は `requiredIngredients` だけから作られる。**Pinsa の ladder は jamon-serrano と同一**になる。これは意図どおり（OD-TQ-6: ヒントは技法・pan・生地に触れない）。
- 影響: `hint5Production.gate` G7 と `deductionProduction.gate` の INV-TQ-4 は現在「技法を要求する recipe = NO_SAUCE」を前提にしている。tray の準備（F）で allowlist 形（`NO_SAUCE ∪ PAN_TRAY`）に直す方針が決まっている。生地の種類はこの allowlist に**別の名前付き定数**（例: `DOUGH_TECHNIQUE_RECIPE_IDS`）を足す。OD-544-1 の「共有定数 1 か所」方針に従い、F2 の定数と重複定義しない。
- DH4 privacy sweep の `GATE_STATES` に **`dough` の状態（standard / Pinsa）を加えて全再実行**し、掃引した状態数を Result に書く。新しい fact id・ヒント行・保存 id に生地・技法の語が出ないことを確認する。
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

| 項目 | 内容 |
|---|---|
| `PizzaState.dough` | **永続しない**（`pan` と同じ。save スキーマ変更なし） |
| 図鑑 | `pinsa-romana` の recipe id が増える。既存の前方互換（未知の recipe / Dex を保持、`persistence.forwardCompat.test.ts`）に乗る |
| 技法台帳 | `discoveredTechniqueIds` に id が増える。**新しいトップレベルキーなし**。旧ビルドは未知 id を保持（`extractForwardCompatExtras`） |
| schemaVersion | 変更なし。Save Protection（#560 / #568）の対象外 |
| 新→旧 | 旧ビルドは `pinsa-romana` と新技法 id を画面から隠し、保存時に失わない（既存の Phase 3-4B の保証） |
| 受け入れ | 旧 save → 新ビルド、新 save → 旧ビルドの往復テスト（F 監査 R8 と同形） |

---

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
- `aria-label` は生地の見た目を表す語（例: 「ふつうの生地」「つぶつぶの生地」のような**視覚的描写**）。技法名・レシピ名は不可。**文言は Owner 判断**（§12 Q4）。
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

出典の限界: pizzadb.jp はこの環境から接続できず、証跡は repo 内の記録（`verifiedAt: 2026-09-22 relayed`）のみ。**生地の記述（小麦・米・大豆のブレンド、長時間発酵）の原典再確認は Owner 側**。

---

## 8. 受け入れ条件（Pinsa 導入 slice）

識別・技法
- **PK-1** 既存 target 全件の識別は変わらない（`dough` 未設定のピザは全軸が現状と deep-equal）。
- **PK-2** `dough` 軸が OBSERVED。未設定・不正値は `"standard"`。`pan` / `squareDough` から推定されない（`panAxis.test.ts` と同形のテスト）。
- **PK-3** jamon の食材集合: standard → jamon、Pinsa → pinsa-romana、Pinsa+tray → ORIGINAL。§1.5 の表を全行テスト化。
- **PK-4** `matcher.ts` が techniques を import しない（`techniques.architecture.test.ts` が通る）。
- **PK-5** 技法: 使った経路（Free Cooking のみ・affordance 開・Completion Gate 通過）と recipe 経路が `tray` と同じ規則で動く。Lunch Rush / Dinner は 0。

UI・状態
- **PK-6** `SELECT_DOUGH` と `SELECT_PAN` が互いのフィールドを変えない。○→□→○ で `dough` が保持される。
- **PK-7** `dough` だけが違う 2 つのピザで `effectivePanShape` と cookingProfile が同一。
- **PK-8** チップの表示条件: 閉（本番の現状）では DOM が現状と同一。Guided / Lunch Rush / Dinner では出ない。
- **PK-9** 360×800 / 390×844 でチップが 1 画面に収まり、`PanSwitch` と同時表示でも重ならない（レイアウト契約テスト）。

Anti-Oracle・Hint
- **PK-10** チップの表示は Dex 進捗だけの関数。Research target・所持・購入ヒント・食材一致で変わらない（F 監査 R1 / R10 に倣う掃引テスト）。
- **PK-11** Hint 5.0 の行・fact id・保存 id・near-miss に生地・技法の語が無い。DH4 sweep を `dough` 状態込みで全再実行し、状態数を Result に記載。
- **PK-12** G2 の固定文言は変更せず、Research target 間で同一。
- **PK-13** gate の変更は named allowlist のみ。skip・retry・assertion 緩和・timeout 延長なし。

発見・Research
- **PK-14** Pinsa 追加で Research の選択が増えるテスト（HOME / Pizza Select / Hint シート）を一覧化して更新。
- **PK-15** コホート文字の変更を導出で検証し、validator の例外を名前付きで追加。

保存
- **PK-16** 旧 save → 新ビルド、新 save → 旧ビルドの往復で、図鑑・技法台帳が失われない。schemaVersion 不変。

採点
- **PK-17** Scoring 2.0 の golden・Pitz・ランキングが不変（`techniques.architecture.test.ts` の INV-TQ-3）。

---

## 9. 影響を受ける既存テスト・成果物（実装 PR で一覧化する）

| 区分 | 対象 | 理由 |
|---|---|---|
| 識別 | `signature.test.ts`、`discoveryCatalog.test.ts`（items 例外・signature キー・Reference 生成） | §1.4 |
| 識別 | `dinnerResultDetection.test.ts` 32 | 食材だけのキーで一意性を見ているため |
| 技法 | `techniques.test.ts`、`techniques.tq1c.test.ts`、`techniques.tray.test.ts` の隣に dough 版 | レジストリ件数・なぞかけ定数 |
| gate | `hint5Production.gate` G7、`deductionProduction.gate` INV-TQ-4、DH4 sweep（`GATE_STATES`） | §5.1 |
| カタログ | `catalogLedger.test.ts`（件数）、`recipeBatchManifest.ts`、`recipeBatch.validator.test.ts`（コホート例外）、章サイズ pin | レシピが 1 増える |
| golden | Hint 5.0 の ladders / alphaFamilyOnly、`sauceB1.singleSource.json` | 末尾追記 |
| 件数 pin | `recipes.test.ts`、`cookingProfiles.test.ts`、`lunchRush.exclusion.test.ts`、`progression.test.ts`、`recipeChapters.test.ts` | #527 が列挙したものと同じ系統 |
| Research | HOME / Pizza Select / Hint シートのルーティング、cohort 文字のテスト | §5.2 |
| 新規 | `doughAxis.test.ts`、`gameReducer.selectDough.test.ts`、`DoughKindSwitch.test.tsx`、`e2e/dough-kind-*.spec.ts`、Preview フラグのゲートテスト | |

衝突しやすいファイル（`scripts/ops/hot-files.json` の対象を含む）: `recipes.ts`、`gameReducer.ts`、`GameScreen.tsx`、`App.css`、`PROJECT_HANDOFF.md`。着手時は `TETO_SESSION-OPERATIONS_1.0.md` の claim を投稿し、Square Dough の進行中 PR（#574 ほか）と Batch 8 系の PR と重複しないことを確認する。**Batch 8b と D2-b のファイルには触れない。**

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

| slice | 内容 | 本番での見え方 | HV |
|---|---|---|---|
| P1 | `dough` 軸を OBSERVED、`PizzaState.dough?`、`Recipe.doughKind?`、`DOUGH_VARIANT` を supported に、技法レジストリ、検出・要求。**RECIPES に Pinsa は入れない**（synthetic fixture で検証） | なし（不活性） | 不要（内部） |
| P2 | `SELECT_DOUGH`、`doughSelection.ts`、チップ UI、Preview フラグ、レイアウト契約。affordance は本番で閉（Pinsa を要求する target が無いため） | なし（閉） | 動画あり（Preview 経由、Owner 実機） |
| P3 | `pinsa-romana` を追加（recipes / profiles / target / reference / hint roles / orders / manifest）、gate の allowlist、DH4 全再実行、Research の更新、Guided の開始設定 | **有効化** | **必須** |

P3 の前提: 原典確認（Owner）、UD-G 相当の文言（技法の名前・なぞかけ・説明）、Anti-Oracle §15 の再計算（複数ソース前提）は E の事項だが、生地の技法も sweep に含める。

### 11.2 P3 の監査項目（実装 PR の最初）

- Dinner の出題プールが何で絞られるか（技法を要求するレシピが出題されないことのテストを固定）。
- Hint 5.0 の `recipeHintRoles` / key-free の扱い。
- `cookingProfiles` の CUT 対象外（Pinsa）が validator と整合すること。

### 11.3 起票案（**起票していない**。重複確認の結果のみ）

重複確認（`search_issues`、2026-10-20）:

| 候補 | 検索語 | 結果 | 判定 |
|---|---|---|---|
| 生地の種類（Pinsa） | 「dough variant Pinsa 生地の種類 technique」 | #532〜#538（Square Dough）、#33（生地を伸ばす操作） | **該当なし**。#532〜#538 は「天板の形」、#33 は「伸ばす操作」で、生地の種類（識別軸 `dough`）は扱わない |
| ソース後乗せ | 「post-bake sauce drizzle 後乗せ ソース DRIZZLE FINISH liquid」 | #521、#489 | **該当なし**。#521 の Owner 判断 9 が「FINISH が液体に対応するまで保留」と触れているだけ。#294（FINISH）は topping のみ。DRIZZLE は #476 の候補として言及 |
| 新ソース 4 種 | 「new sauce miso tahini yuzu flammkuchen 新ソース」 | 0 件 | **該当なし** |

起票案（Owner が承認したら起票。本文は短く、既存 Issue へのリンクで構成する）:

1. **「Dough Kind: 生地の種類を技法（how）として識別軸にする（Pinsa Romana）」** — 親: #294（Cooking Steps）・#182（172）。関連: #532（天板との独立を明記）。内容: 本書 §1〜§9、slice P1〜P3。
2. **「New Sauces: Flammkuchen / 味噌 / タヒニ / 柚子胡椒（焼成前の SAUCE 工程）」** — 関連: #521（複数ソース）、#527（Batch 8、直列）。内容: 本書 §10。
3. **「POST_BAKE のソース後乗せ（FINISH の液体対応・DRIZZLE）」** — 親: #294。関連: #518（FINISH D2-2 の前提）、#476（DRIZZLE 候補）、#521 判断 9。内容: FINISH が topping 専用であること（`PLACE_TOPPING` の FINISH 分岐が `category !== "topping"` を拒否）、タヒニ・柚子胡椒の仕上げ使い、はちみつ・マヨ等の候補、新ジェスチャーの要否。**#518 → D2-2 が前提のため、起票しても着手は後**。

### 11.4 延期

- **ZONED**: 将来フェーズ（Owner 決定）。本書は触れない。
- **Piadina / Manakish**: Pinsa の P3 が着地して、`dough` 軸と技法の運用を確認してから。Piadina はノンソース（no-sauce 技法との組み合わせ）、Manakish は証跡に source inconsistency の review item がある。
- **生地ごとの見た目・採点**: D2-b の後。

---

## 12. Owner 判断が必要な事項（未回答のまま）

| # | 判断 | 推奨 |
|---|---|---|
| Q1 | `dough` の識別値の語彙を Phase-2 の文字列（`material-multigrain-long-ferment`）にするか、短い内部 id にするか | Phase-2 の文字列（§1.3 案 A） |
| Q2 | 技法 id（永続）。暫定 `pinsa-dough` | Owner が確定（一度決めると変更できない） |
| Q3 | 1 技法につき 1 生地か、複数の生地を 1 技法にまとめるか（Piadina / Manakish を見据えて） | Pinsa は 1 技法 1 生地で始め、2 つ目の生地を足す時に再判断 |
| Q4 | チップの `aria-label`、技法の名前・なぞかけ・説明（UD-G）。**なぞかけが操作を含む場合は OD-TQ-5/6 の新しい例外承認が要る** | 操作を含まない一般的な表現にして、例外を使わない |
| Q5 | RESULT に生地版の中立行を足すか | 足さない（§5.3） |
| Q6 | Pinsa の `ladderCredit: false`、`lunchRush: false`、CUT なし、章の件数が 1 増えることの了承 | 推奨どおり |
| Q7 | コホート文字（jamon と Pinsa が A/B になる）と、validator への明示的な例外の了承 | 了承（OD-544-4/5 の範囲） |
| Q8 | Pinsa の個数・bake（暫定値）、jamon と同値にするか | 分ける（識別が見た目に表れる） |
| Q9 | 新ソースの本番 id、色、価格・数量、ladder の位置 | Owner（UD-F と同種） |
| Q10 | 柚子は柚子胡椒（証跡どおり）でよいか。tahini など 4 件の sauce 扱い（Owner 方針 5 で確定）に追加の制約が無いか | 証跡どおり |
| Q11 | §11.3 の 3 つの Issue 起票案の承認（起票は Owner 承認後） | 承認後に起票 |
| 既存の未決 | Design Lock §8-1（pizzadb.jp 原典確認）、pizzadb.jp の Pinsa 行の原典再確認、UD-D / F / G、OD-CS-12..19 | — |

## 13. リスク

| リスク | 内容 | 対策 |
|---|---|---|
| 発見の動線 | Pinsa を作りたい player は、チップが開いても「どの食材で生地を変えるか」を試行錯誤する。標準生地で作ると jamon が発見されるため、**ALREADY_DISCOVERED が「この食材集合は jamon」という強い手がかり**になり、Pinsa の存在に気づきにくい | Dex の調理法欄のなぞかけ、G2 固定文言（変更不可）。Owner の文言（UD-G）が効く。追加の誘導は Anti-Oracle 違反になるため作らない |
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
