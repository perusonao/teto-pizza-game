# U3 ザクロ描画 — Fresh Design 記録（暫定採用・docs-only）

Status: **Owner 暫定採用（2026-10-25）。U3 の実装は未着手。** `src/**`・CSS・テスト・golden・データは変更していない。
Tracking: #578（U3 専用の Issue は無い。重複を作らず #578 に追記）。関連: `docs/decisions/TETO_NEW-SAUCES-B_U0-GATE_2026-10-25.md`（OD-U0-4）、`docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`（共通仕様 §2 / §3 / §10.4）。
「暫定採用」は Owner の暫定方針であり、Style Lock への正式追加ではない。Style Lock への追記は U3 実装 PR で行う。

## 1. 暫定採用の内容

| 項目 | 内容 | 状態 |
|---|---|---|
| SVG | **案A'（涙形を強調した種の小山）** `pomegranate-A-prime.svg` | 暫定採用 |
| サイズ区分 | `xs`（`toppingSizeClass.ts`） | 暫定 |
| family | `fruit` | 暫定（OD-U0-4。privacy 系 gate 通過は隔離コピーで測定済み） |
| 色 | 比較シートの暫定色: 実 `#c4163f` / 輪郭 `#650d27` / 暗部 `#a50f33` / ハイライト `#ef5b79` + 白 | 暫定（Owner HV で確定） |
| `pieceVisual` 名 | 案: `pomegranate-aril`（実装 PR で確定。visual 名は食材 id と独立） | 未確定 |
| emoji（必須の文字フォールバック） | 🍇 は果物ファミリー記号のため使えない（G18）。実装 PR で他食材と重ならない文字を決める | 未決 |

案A（丸い粒）と案B（半割り）は比較対象として保持する（`pomegranate-A.svg` / `pomegranate-B.svg`）。

## 2. 所在

| 資料 | 場所 |
|---|---|
| 案A' / A / B の SVG（64×64、`id`・gradient・`defs` なし） | 本ディレクトリ `pomegranate-A-prime.svg` / `pomegranate-A.svg` / `pomegranate-B.svg` |
| 比較シート（1 枚。案A・A'・B、イクラ、トマトスライス × 生地 / 焼き色 / トマトソース / タヒニ色（仮）× 18 / 24 / 28 / 64px） | 本ディレクトリ `comparison-sheet.png` |
| Owner 向け比較ページ（iPhone で確認。private） | https://claude.ai/artifact/4aRUaJ12yVZSDNmainAS7T |
| 作図コードの出所 | 比較シート用の作業スクリプトはリポジトリ外。SVG が正本 |

トマトスライスは `IngredientGlyph.tsx` の現行ジオメトリの再現、イクラは `docs/design/references/ingredient-icons-2.0/salmon-roe.svg` を使用。18px は RESULT 相当（xs 0.7 × 0.75 × 28px × 1.2em 補正 ≈ 17.6px）、24px は xs の配置サイズ（≈ 23.5px）の概算。PC 描画（3 倍解像度）であり、iPhone 実機ではない。

## 3. Owner HV の確認項目（U3 実装 PR の HV に含める）

390×844 動画 + before/after スクリーンショット（`TETO_HUMAN-VERIFICATION-POLICY.md` 準拠）に加え、次を実機で確認する。

1. **18px（RESULT 相当）・24px（xs 配置）でイクラと区別できるか。** 構図が近い（粒の小山）。ザクロ = ルビー赤の角ばった涙形、イクラ = 橙の丸粒。色頼りだけになっていないか（グレースケールでも形で読めるか）。
2. **赤いトマトソースの上での視認性。** 暗い輪郭で粒の形が残るか。焼き色の生地の上でも確認する。
3. **タヒニ色の背景上での視認性。** ただし下記 §4 のとおりタヒニ色は仮定。
4. トマトスライス・さくらんぼ等の赤系との取り違えがないか。
5. 白ごま（U2 実装済みの描画）との並びでの区別（§5）。
6. 後乗せ（焼成フィルタなし）になる場合は、焼成前と後乗せの 2 面で確認（Style Lock §10.4）。
7. 案A' の粒が 18px で潰れて「赤い塊」になっていないか。不足なら案A / 案B に戻すか再デザイン（形・色の変更は Owner 承認が必要）。

## 4. タヒニ背景色は仮定（正式仕様ではない）

比較シートの「タヒニ色 `#dcc7a1`」は、U0 Gate の「タヒニ色が生地に近い」という記述から**置いた仮の背景色**である。リポジトリにタヒニの色定義は無く、タヒニは食材としても未実装。正式な色・仕様ではなく、Owner の承認も受けていない。タヒニ（`tahini`）の色は U3 のレシピ本体で別途決める。ザクロの視認性判定は、実際のタヒニ色が決まった後に必ず再確認する。

## 5. 依存関係: U2 の merge 後に最新 main へ追従して実装

- U2（ナス田楽・白ごま）は #578 の claim（2026-10-25、session `017mmnc1VfakCU4qCtUfTWjm`、branch `claude/u2-eggplant-dengaku-late`）で**実装中**。U2 の claim ファイルのうち U3 と重なる見込み: `src/data/ingredients.ts` / `src/components/IngredientGlyph.tsx(.test.tsx)` / `src/App.css`（HOT）/ `src/data/lateCatalog.ts` / `src/data/*.test.ts` / `src/logic/discovery/deductionGuard.gate.test.ts` の件数 pin 周辺。#667（shrimp 描画）も `IngredientGlyph.tsx` / `App.css` / `ingredients.ts` に触れる。
- 方針（Owner 指示）: **U3 は U2 が merge された後、最新 `origin/main` に追従して実装する。** U2 の branch 上や未 merge の状態では実装しない。着手時に #578 へ別途 claim を投稿する。
- U2 側の既知事項（claim 本文より）: `white-sesame` の family は `spice`、POST_BAKE、粒状の専用描画、`deductionGuard.gate` の件数 pin は spice 構成で更新される。U3 で `fruit` のザクロを足す際は、その時点の main の pin を原因分解して更新する（gate は緩和しない）。
- 共通点・差分（U2 白ごまとの比較）: どちらも小粒を散らす `xs` 級の専用 SVG で、1.2em の個別クラス補正方式に乗る。差分は色（ザクロ = 濃い赤 / 白ごま = 白〜クリーム）と family（`fruit` / `spice`）。白ごまは明度が生地・タヒニ色に近く輪郭と粒形に依存、ザクロは赤い背景で沈みやすく輪郭に依存する。

## 6. 未決のまま維持するもの

- **原典（pizzadb.jp）の確認**: 本環境から到達不可。U3 の材料・個数・焼成窓・工程タイミングは全て未確認（U0 Gate §4）。
- **タヒニの役割**: 塗る（sauce / PAINT）か、かける（ソース後乗せ）か。OD-U0-5 は未回答。
- **ザクロの投入タイミング**: 焼成前か焼成後か未確認。焼成後なら後乗せ（late catalog）扱いになり、floor・描画の確認面が変わる。
- ザクロの個数、`pieceVisual` 名、emoji、サイズ区分の最終値、ラダー位置、レシピ本体、タヒニ。
- family `fruit` のヒント絞り込み力と Hint 5.0 golden への波及（U0 Gate §7）。

## 7. 触れていないもの

U3 のレシピ本体、タヒニ、ladder、`src/**`、`App.css`、`IngredientGlyph.tsx`、`PROJECT_HANDOFF.md`（HOT）、Style Lock 本体、テスト、golden、workflow、Issue の claim、Preview、Production。
