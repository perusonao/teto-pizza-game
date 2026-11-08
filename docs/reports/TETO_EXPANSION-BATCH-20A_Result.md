# Expansion Batch 20-A — Result Report（#790、暫定仕様・原典未確認）

**状態:** 実装 PR（Draft にしない・merge は Owner 判断）。**merge・Production ON・共有 Preview の更新はしていない。** iPhone Safari の実機 HV は未実施（Owner の HV）。
**ブランチ:** `claude/b20a-pesto-noci-790`（main `4ba05597` 基準）。**担当 session:** `session_016YrGi1AJW3sF49Uzak3yaN`。
**根拠:** Owner の最終承認（2026-11-08、B20-A 実装 GO）、承認表 [`TETO_B20A_Owner-Decision-Table_2026-11-08.md`](https://github.com/perusonao/teto-pizza-game/blob/claude/b20a-owner-decision-table/docs/reports/TETO_B20A_Owner-Decision-Table_2026-11-08.md)（branch `claude/b20a-owner-decision-table`、`f3925e94`）。別セッションの同名の表（`claude/teto-pizza-b20-a-m48qbl`）とも 10 ID・測定は一致。

## 1. 実装内容

| 項目 | 内容 |
|---|---|
| 新レシピ（1） | `pesto-noci-pizza`（ペスト・ノーチピザ、暫定）／pesto 1（PAINT・主ソース）・honey 1（第 2 ソース層）・gorgonzola 2・walnut 3／焼成窓 58–78／`ladderCredit` あり／key-free Hint／CUT なし／Lunch Rush なし／全材料が焼成前（FINISH なし）／mozzarella は追加していない |
| 新食材（2） | `honey`（はちみつ、sauce・spread、色 `#e8a93a`、チップの絵文字 🐝、専用絵なし）、`walnut`（くるみ、topping・scatter、size `s`、色 `#9a6a3c`、専用絵は #777 の `WalnutGlyph`（raw）を**変更せず再利用**、`pieceVisual: "walnut-kernel"`、絵文字 🥥 はテキスト代替のみ） |
| ladder | 通常 step **71**（honey＋walnut、key = `pesto-noci-pizza`、星ゲートなし）。step 1–70 は凍結。late の導出番号は +1（72–78）、`LATE_ENTITLEMENT_FLOORS` は不変 |
| honey の第 2 ソース層 | 既存工程（B19 の pesto＋olive-oil と同型。`RECIPE_SAUCE_PROFILES` は主ソース pesto のみ、honey は存在判定）で**表現できた**（停止条件に該当せず）。E2E で pesto → honey の 2 層を塗り、NEW DISCOVERY まで通ることを 390×844・360×800 で確認 |
| 描画 | `IngredientGlyph.tsx` は `walnut-kernel` で `WalnutGlyph` をそのまま返す（二重の `<svg>` にしない）。`App.css` は既存の共有 1.2em グループに 1 セレクタを追加（PROVISIONAL、実寸 HV で調整） |
| 追加ファイル | `expansionBatch20.test.ts`、`persistence.batch20.test.ts`、`e2e/b20a.spec.ts`、本レポート、`docs/reports/screenshots/b20a/` |

## 2. Owner 確定事項との対応と、変更点（1 件）

| Owner 確定事項 | 実装 |
|---|---|
| honey は焼成前の第 2 ソース層／mozzarella 追加なし | そのとおり（テストで固定: 材料集合に mozzarella がない、`pesto-noci-pizza + mozzarella` は ORIGINAL） |
| walnut の family は `other` | **`spice` に変更**（下記） |
| walnut SVG は #777 の再利用／暫定の数量・名前・焼成条件／原典未確認の注記／食材とレシピは 1 PR | そのとおり |
| Research: 既存 10 ID の非正準順の変化のみ許容、正準順 0 | そのとおり（`expansionBatch20.test.ts` で固定。§3） |

### walnut の family を `other` から `spice` に変更した理由（Owner の再選択、2026-11-08）
- `other` にすると、**既存のプライバシーゲート `deductionProduction.gate`「『その他』は到達不能」（OD-DH4-2-9）が失敗する**。`pesto-noci-pizza` ではくるみが唯一のトッピング＝Rule W の予約材料になり、`attr:family:other` が答えとして出るため（既存の other 材料 egg・almond・pine-nuts は予約にならず通っていた）。`spice` に変えるとゲートは 17/17 で通る【実測】。
- 実装中に見つかった Owner 確定事項どうしの衝突のため、Owner に確認し、`spice`（当初の暫定案）の指示を得た。承認表 I-4 の最終決定からの変更。承認表の測定（Hint の形・出荷済み ladder 91 品の差分 0）は `spice` と `other` で同一。
- 副作用（実測・すべて測定用 golden／レポートで、ゲートではない）: `hint5.alphaFamilyOnly.json` の `eggplant-dengaku-pizza` 94→117、`wasabi-beef-pizza` 666→801（spice の候補が 1 つ増えたため、family のみの割り当て数が増える＝推測しにくくなる方向）と新レシピの行（5）、`deductionHint.audit` の候補数が +1（category／spice の group）。

## 3. 検証

| 検査 | 結果 |
|---|---|
| 重複ゲート | 最大 Jaccard **0.167**（genovese）、同一・部分・上位・1 材料差 **0**、例外なし |
| Research（正準順） | 既存ラベルの変化 **0**（全 ladder prefix、通常カタログ・全カタログ、late 含む） |
| Research（非正準順） | 変化する既存レシピは **承認済みの 10 ID と完全一致**（genovese・pesto-burrata-pizza・pesto-caprese・pesto-patate・pesto-pollo・pesto-salmone・pesto-tonno・pesto-trapanese・pesto-vegetariana・quattro-formaggi）。全て文字の変化のみ、文字の喪失（`->-`）なし。未承認 ID が出れば失敗するテスト |
| Hint 5.0 | key-free の対象（SAUCE, CHEESE, STRUCTURE, SUB_CLASS）。SAUCE の段は {pesto, honey}、CHEESE の段は {gorgonzola}。出荷済み 91 品の ladder は golden と一致（`hint5.ladders55.json` は新レシピの行の**挿入のみ**、既存行の変更 0） |
| 保存安全性 | schema v2 のまま。新 ID は既存の保存に存在せず、旧保存は所有順・Dex 項目がバイト単位で不変、未知 ID は rollback でも保持、Research ラベルは保存されない（`persistence.batch20.test.ts`） |
| `tsc -b` | エラーなし |
| `oxlint` | 既存ファイルの警告のみ。本変更のファイルに警告・エラーなし |
| `npm run build` | 成功 |
| 全 Vitest（Pinsa 開） | **639 files pass / 1 skipped、11710 tests pass、失敗 0**（13 skipped・2 todo は既存）。最終コード状態で実行 |
| 全 Vitest（`TETO_PINSA_OFF=1`） | **638 files pass / 2 skipped、11696 tests pass、失敗 0**（18 skipped・2 todo）。最終コード状態で実行 |
| Chromium E2E（`e2e/b20a.spec.ts`、390×844・360×800） | 2/2 通過（Shop NEW×2 → 購入 → Research（漏えいなし、`？？？ピザ（くるみ）`）→ pesto → honey の 2 層塗り → ゴルゴンゾーラ → くるみ → 焼成 → NEW DISCOVERY → Dex、横スクロールなし、console error なし） |
| WebKit（全 shard）・CI・Codex | PR 上の結果（§6） |

### 既存テストの更新（意味は弱めていない）
step 番号・件数・id リスト・golden への挿入に限る。主なもの: late の導出番号 +1（`expansionBatch11.s1`・`12b`・`18`・`19`、`lateCatalog.late4`・`bbq`、`materialEntitlement.*`、`materialShop`）、ordinary step 数 70→71（13・14・16・17・18、`researchLabels.batch8a`、`materialEntitlement.batch6`）、`catalogLedger`（recipes 93、credited 81、ingredients 100、toppings 69、ladder 78、chapter 4 = 56 / Pinsa 閉 55、shelf: sauce 16・spice 7）、`catalogShelf`・`largeCatalogFixtures`（sauce 16）、`progression`・`recipes.test`・`cookingProfiles`・`discoveryCatalog`（2 ソースの先例）・`lunchRush.exclusion`・`hint5Ladder.baseCompat`・`hint5Production.gate`（合成カタログの再割当に walnut を追加）・`IngredientGlyph.test`。
golden の再生成は理由と範囲を確認した上で: `hint5.ladders55.json`（挿入のみ）、`hint5.alphaFamilyOnly.json`・`DH4-1 AUDIT`（§2 の副作用）、`src/data/staged/__golden__/*`（§5）。`lateCatalog.offSurface.json`（先頭 66 件の digest）は**不変**。

## 4. 変更前後の実画面（Chromium。**iPhone Safari 実機は未確認**）
`docs/reports/screenshots/b20a/`: `b20a-shop-before-after-390x844.png`（main の Shop と、honey／walnut の NEW 行。before の保存は発見数が少なく、Shop の状態は同一ではない）、`b20a-flow-after-{390x844,360x800}.png`（ソース・トレイ → ソース塗り後 → くるみのトレイ → 盛り付け → NEW RECIPE → Dex）と個別の画像。動画（390×844）は repo に含めない・Owner の HV 用に別途。

## 5. 他セッションのファイルへの最小の編集（B19 の先例どおり、PR に統合）
- `src/data/staged/**`（T-FX の claim、〜11/21）: 出荷により staged の in-flight 予約（`pesto-noci-pizza`／`honey`／`walnut`）が出荷済みになるため、テストの期待値と golden のみ更新した（`stagedCatalog.test.ts`・`stagedIsolation.test.ts` の数値 3 行と、`__golden__` の再生成）。データ・判定ロジックは未変更。測定値の変化: 依存 383→376、WAITS_IN_FLIGHT 9→2、残り 350→343 など（honey／walnut の待ちが解消）。**T-FX の担当は、この merge 後に基準値を確認してほしい**（#780 に通知）。
- `src/components/walnutGlyph/WalnutGlyph.test.tsx`（#777）: 「どこからも import されない」を「`IngredientGlyph.tsx` だけが import する」に更新（配線のため）。コンポーネント本体は未変更。

## 6. CI・Codex
PR 作成後に追記。

## 7. 視認性の懸念・未解決事項
- **honey のチップの絵文字 🐝**: 🍯 は miso-sauce が使用中（G18: 絵文字は一意）のため暫定。蜂の絵が「はちみつ」に見えるかは実機 HV の項目。色 `#e8a93a` は pesto の上に塗ると黄緑に見える（塗り後の画像）。
- **walnut**: 1.2em の共有ルールに追加した（PROVISIONAL）。トレイ 26px・ピザ上・RESULT で読めるかは実寸 HV（#777 の Result は 17.6px で細部が潰れ、焼成チーズ上は外線で読む設計）。#777 の `baked` 状態は未使用（IngredientGlyph は焼き加減を知らない）。
- **Hint の副作用**: §2 の alpha レポートの数値変化（spice の候補が 1 つ増える）。
- **未実施**: iPhone Safari の実機 HV、390×844 の HV 動画（Owner 提出）、`PROJECT_HANDOFF.md` の更新（HOT ドキュメント。claim 範囲外のため触れていない）。
- **claim**: 本 PR 作成後、#790 に claim 更新（PR 番号）を投稿。#774・#417 の残存 claim は代行 release 済み。
