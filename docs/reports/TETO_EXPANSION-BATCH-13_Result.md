# Expansion Batch 13 — Result Report（potato-mayo-pizza + mayo、Issue #708）

Status: **実装完了。自動ゲートの結果は §6。Owner の承認（§8）と実機 HV の前は merge しない。共有 Preview・Production は更新していない。**
基準 `origin/main` = `c914b59`（#709 Squash merge 後）。branch `claude/teto-pizza-708-audit-o5taup`。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）は未確認。** 172 matrix 行 `potato-mayo-pizza-pizzadb-p3` の材料集合（bacon / corn / mayo / mozzarella / potato）だけが根拠で、source のソース欄は「ホワイトソース → unspecified」（`BASE_SAUCE_UNSPECIFIED`）。次はすべて GAMEPLAY ASSUMPTION / CALIBRATION:
個数（8 ピース = 8 スロットのリング）、焼成窓 58–78（汎用窓）、色、絵文字、SVG の形、size class `s`、NO_SAUCE。
NO_SAUCE は **Owner 決定（2026-10-30）により、この 1 行に限る暫定例外**。他の `BASE_SAUCE_UNSPECIFIED` 行へは波及しない（テストで「ソース基底なし・ソース材料を含まない」を固定）。

## 1. 実装内容

| 項目 | 内容 |
|---|---|
| レシピ | `potato-mayo-pizza` / じゃがマヨピザ。**mozzarella 2 / potato 2 / bacon 1 / corn 1 / mayo 2**（合計 8）。`RECIPE_SAUCE_PROFILES` = `null`（NO_SAUCE、SAUCE 工程なし）。CHEESE → TOPPING → BAKE。`lunchRush:false`、CUT なし、key-free Hint、credited、焼成窓 58–78、報酬 100 |
| 新食材 `mayo` | topping / **scatter** / `nameJa` マヨネーズ / family **`spice`**（L1 のみ、`other` ではない）/ size class **`s`** / 専用 SVG `mayo-zigzag`（Style Lock v2 M1 絞り出しジグザグ、輪郭 `#7a6548`・本体 `#fff6dc`）/ 絵文字 🧴（G18 で他と重複なし。暫定） |
| ladder | **通常 step 65**（追記専用）= `[mayo]`、key = `potato-mayo-pizza`、T4（初回 120 / 補充 60 Pitz、k=2 → 1 パック 20 個）、星ゲートなし。step 1–64 凍結。late の導出番号は +1（66–72）、`LATE_ENTITLEMENT_FLOORS` は不変 |
| batch | `B13_BATCH`（`recipeBatchManifest.ts`）。既存の `B12_BATCH`（#711）・`B12B_BATCH`（#709）は維持し、それぞれの `followedBy` に追記しただけ |
| 採点 | `referencePizza.ts` に 8 点リングの Reference を 1 件追加（`computeMechanicalSauceReference` は NO_SAUCE で `sauce: null`） |

## 2. Duplicate Gate（main `c914b59`）

- 識別集合 `{bacon, corn, mayo, mozzarella, potato}`: 現行 75 レシピ（ordinary）と完全一致・部分集合・上位集合なし（`expansionBatch13.test.ts` が全レシピと総当たりで固定）。最も近い `pesto-patate` は対称差 3。
- `mayo` は src に存在しなかった（新規）。HOLD（月見・ブラータ系・ホットハニー・Pinsa/生地・後乗せ・下ごしらえ・複数ソース）に該当しない。
- 他の open PR とのファイル重なりなし（#709 / #711 は main に取り込み済み）。#715 は #708 の merge 後まで未着手。

## 3. 保存互換（schema v2 維持）

migration なし。新 ID を追加するだけ。`persistence.batch13.test.ts` で固定: 新 ID の保存・再保存の往復、旧セーブは新材料・新レシピを自動取得しない、未知の ID は再保存で順序ごと保持（ロールバック安全）、Batch 12 の材料・レシピは保持、既存の entitlement は不変。

## 4. Research / Hint / ladder への影響

- **Research ラベル**: `mayo` は step 65 の唯一の材料 → 単独 cohort → ラベル `？？？ピザ（マヨネーズ）`（文字なし）。**既存レシピのラベルのずれは 0**（`acceptedLetterShifts` なし。`expansionBatch13.test.ts` が全 cohort を前後比較）。
- **Hint 5.0**: `hint5.ladders55.json` は**挿入のみ**（削除 0 行、`potato-mayo-pizza` の 1 件）。`hint5.alphaFamilyOnly.json` は `spice` 2→3 人で既存値が動く（Issue の想定どおり）。key-free は 57→58、cheese のみ 20→21。
- **DH4**: audit JSON（`TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`）を再生成。旧 DH4-2A の漏えいカウントが 211→225（プライバシーの `toEqual([])` は全状態で成立し、動いたのは LEGACY カウントのみ。#709 までと同じ扱い）。
- `hint5Production.gate.test.ts` の synthetic「spice = capers 単独」は、`mayo` を herb に振り替える対象に追加（検証する性質は不変）。

## 5. 既存テストの追従（意味は弱めていない）

件数 pin（recipes 84 / Pinsa OFF 83、credited 75、ingredients 94、toppings 67、ladder 72、第 4 章 47 / 46、spice 棚 5、Lunch Rush opt-out 51）、late ステップ番号 +1、`materialShop` の全 offer、`cookingProfiles` の工程表、各 batch の `followedBy`、承認例外の配列（`discoveryCatalog.test` / `matcher.test`）。
**注意（Owner 確認）: `catalogShelf.test.ts`** — 62 件の設計マスターカタログ（`data/recipes/ingredient_master_catalog.json`）は `mayo` を `category: sauce` / `placementType: spread` / `mechanicDependency: postBakeFinishing`（焼成後ドリズル）としている。JSON（設計 authority）は変更していない。代わりにテスト側に「id と値で固定した例外（mayo: snapshot sauce / runtime spice）」を追加し、他の重複 ID は従来どおり `ingredientShelf()` と一致を要求する。JSON を実装に合わせて直すか、この例外のままにするかは Owner 判断。

## 6. 自動ゲート（最終コミットで再実行した結果は PR 本文に記載）

| ゲート | 結果 |
|---|---|
| `tsc -b` / `oxlint` | exit 0 / exit 0 |
| Vitest Pinsa OFF（`TETO_PINSA_OFF=1`） | 565 files・10,773 passed・0 failed |
| Vitest Pinsa ON | §9 に最終値（全体並列実行で出た負荷由来のタイムアウト 7 件は、該当 6 ファイルの単独実行で 222/222 passed。タイムアウト値は変更していない） |
| `npm run build` | 成功 |
| E2E（Chromium 390×844・360×800） | 新規 `e2e/b13.spec.ts` 2/2、既存の依存 6 本 + `b12` + `batch12-supreme-norma` と合わせて 38/38 passed |
| WebKit | CI で確認（ローカルに WebKit なし） |

## 7. Human Verification（Authority Viewport 390×844、Secondary 360×800）

- 撮影: Playwright Chromium、390×844 / 360×800、スクリーンショット 14 枚 `docs/reports/screenshots/b13/`。動画（H.264、390×844、39 秒）は repo に commit せず Owner へ直接提出。
- 画面で確認した点: Shop の NEW 行（マヨネーズ・スパイス・薬味系）、トレイのチップ、ピザ上の配置、はみ出しなし（`noOverflow` を各工程で検証）。
- 形: 初版（左右対称 3 山）は 20px で「M/W」の字に見えたため、傾けた不規則な 5 折れ + 始点の膨らみに変更した。最終判断は実機 HV。
- **実機 iPhone Safari HV は未実施（Owner）**。確認項目: マヨネーズのチップ・ピザ上の形が文字に見えないか、mozzarella / cream-cheese / ricotta / ricotta-salata との識別（白系の食材が多い）、名称「じゃがマヨピザ」、調理（チーズ工程でモッツァレラ、ソース工程は何も選ばない）から RESULT まで、画面のはみ出し。
- **実機での注意**: 発見の判定は材料 ID の集合の完全一致。ソースを 1 つでも塗る、モッツァレラを入れない、他の材料を足す、と「オリジナルピザ」になる（supreme-pizza での実機失敗と同じ型）。

## 8. Owner 判断が必要な点

1. 両 matrix 行は `BLOCKED_PRODUCT_DECISION`。NO_SAUCE を 1 行に限り許可する承認例外の記録（Issue #708 の 2026-10-30 の決定済み）。matrix 上、source は `mayo` をスプレッド層（`spreadLayers`）としているが、Owner 決定により scatter topping で実装した。
2. `mayo` の絵文字 🧴、色、SVG の形、size class `s` の実機確認。
3. マスターカタログの `mayo`（sauce / spread / postBakeFinishing）と実装（topping / scatter / spice）の食い違いの扱い（§5）。

## 9. 最終検証（最終コミット）

（PR 本文に記載）
