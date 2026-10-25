# 新ソース Phase B — 原典タイミング証跡 記録テンプレート（eggplant-dengaku / eggplant-tahini / yuzu-shrimp）

Docs-only。コード・`src/**`・テスト・golden・データ JSON は変更しない。**このファイルは「記入欄」であり、原典の内容を含まない。**
空欄・`TBD` を「焼成前」「確認済み」と読み替えない（原典未確認事項を確定扱いしない）。
形式は PR #587（`TETO_PIZZADB_TIMING-EVIDENCE_shirasu-ikura.md`、`recipeRows[].sourceTimingEvidence`）に合わせている。
#587 は未 merge のため、本テンプレートは `sourceTimingEvidence` キーを**参照するだけ**で、`TETO_PIZZADB_172_MASTER-EVIDENCE.json` には書かない（#587 と競合させない）。
記入された結果の JSON 反映は、#587 の取り込み後に別の docs/data PR で行う。

関連: `docs/decisions/TETO_NEW-SAUCES-B_U0-GATE_2026-10-25.md`（U0 Gate 結果と Owner 判断欄）、Issue #578。

## 0. 記入ルール

1. **取得者・取得日・受領者・独立確認の有無を必ず書く。** Owner 本人の取得でも、Claude Code が独立再取得していなければ `independentlyVerified: false` のまま（#587 の定義と同じ: false = Claude Code による独立再取得が未実施）。
2. **原文として受け取った短い引用だけを `quotes` に入れる。** それ以外は `relayedSummaries`（要約）。要約を引用扱いにしない。
3. **原典に書かれていないことは `notStatedInSource` に書く。** 「書かれていない」と「焼成前」は同義ではない。書かれていない材料の既定値はこの PR では決めない（Owner 判断欄）。
4. **ゲーム側の設計値（個数・焼成窓・ピース数）は `gameDesignValues` に分け、原典と混ぜない。** 原典に個数がなければ「GAMEPLAY CALIBRATION」と明記する。
5. 引用の `timing` は次の語彙に限る: `pre_bake`（焼成前）/ `post_bake`（焼成後）/ `during_bake`（焼成中）/ `pre_cook_prep`（下ごしらえ: 焼く・揚げる・炒める等）/ `unspecified`（時機の記載なし）。
6. 判定欄（§3）は、記入された証跡から機械的に分類先を示すだけ。**分類を Owner が承認するまで実装には使わない。**

## 1. 確認項目（Owner / 到達できる環境で原典ページを開いて確認するもの）

pizzadb.jp は Claude Code の環境（プロキシ CONNECT 403）から到達できない。以下は**未確認**。

### 1.1 eggplant-dengaku（ナス田楽ピザ）
- 証跡 id: `eggplant-dengaku-pizza-pizzadb-p6`（比較表 p6 のみ。個別ページ URL は repo に記録なし）
- matrix の材料: ナス / 味噌だれ / モッツァレラ / 白ごま（ソース欄「甘辛だれ」）

| # | 確認項目 | 影響する判断 |
|---|---|---|
| D-1 | 個別ページの URL（slug） | 証跡の出典 |
| D-2 | 味噌だれは何か（味噌そのもの / 砂糖・みりん入りのたれ）。生地に塗るか、具に絡めるか | `miso-sauce` の id・表示名・sauce 分類 |
| D-3 | ナスは事前に焼く・揚げる・炒めるか（下ごしらえの有無） | 通常 ladder か、下ごしらえ工程（`PREP_STEP`）か |
| D-4 | 白ごまを載せる時機（焼成前 / 焼成後） | 通常 ladder か、後乗せ（FINISH / late catalog）か。`white-sesame` の family |
| D-5 | モッツァレラの有無と時機 | 材料集合・識別 |
| D-6 | 材料の過不足（他にあるか） | 識別集合・衝突 |
| D-7 | 個数・オーブン温度・焼成時間（記載があれば） | 記載がなければ GAMEPLAY CALIBRATION と明記 |

### 1.2 eggplant-tahini（ナスとタヒニのピザ）
- 証跡 id: `eggplant-tahini-pizza-pizzadb-p5`（比較表 p5 のみ）
- matrix の材料: ナス / タヒニ / ザクロ / パセリ（チーズなし）。証跡の `taxonomyNote` は「タヒニは topping/drizzle としてソース欄の記載どおり」

| # | 確認項目 | 影響する判断 |
|---|---|---|
| T-1 | 個別ページの URL（slug） | 証跡の出典 |
| T-2 | タヒニは生地に塗るか、焼成後にかける（drizzle）か | sauce（PAINT）か、後乗せ（ソース後乗せ）か |
| T-3 | ナスは事前に焼く・揚げる・炒めるか | 通常 ladder か下ごしらえ工程か |
| T-4 | ザクロ（種）を載せる時機 | 通常 ladder か後乗せか。ザクロの描画 |
| T-5 | パセリを載せる時機 | 同上 |
| T-6 | チーズが本当に無いか | 識別集合・工程（CHEESE 工程の有無） |
| T-7 | 個数・オーブン温度・焼成時間 | GAMEPLAY CALIBRATION の根拠 |

### 1.3 yuzu-shrimp（柚子えびピザ）
- 証跡 id: `yuzu-shrimp-pizza`（個別ページ `https://pizzadb.jp/pizzas/yuzu-shrimp/` ＋ 比較表 p15 で 1 件裏付け）
- matrix の材料: エビ / 柚子胡椒 / モッツァレラ / 大葉（ソース欄「その他」）

| # | 確認項目 | 影響する判断 |
|---|---|---|
| Y-1 | 柚子胡椒を生地に塗るか、焼成後にのせるか | sauce（PAINT）か後乗せか |
| Y-2 | 大葉の時機（ikura の中継では大葉が焼成後。同一ページ内での扱い） | 通常 ladder か後乗せか |
| Y-3 | エビの扱い（生のまま載せて焼く / 事前に加熱） | 通常 ladder か下ごしらえか |
| Y-4 | 柚子胡椒の色（緑 / 赤） | 描画色（赤はトマトと同色で不可） |
| Y-5 | モッツァレラの有無と時機 | 材料集合 |
| Y-6 | 個数・オーブン温度・焼成時間 | GAMEPLAY CALIBRATION の根拠 |

## 2. 記入欄（#587 `sourceTimingEvidence` 形式）

各レシピについて、下の形で記入する。**未記入の項目は `TBD` のまま残す。** 値を推測で埋めない。

```jsonc
{
  "<evidence id>": {
    "individualPageUrl": "TBD",
    "retrievedBy": "TBD",                 // 例: Owner / ChatGPT
    "retrievedOn": "TBD",                 // YYYY-MM-DD
    "receivedBy": "TBD",                  // 例: Claude Code (relayed via the Owner ...)
    "independentlyVerified": false,       // Claude Code が再取得していなければ false のまま
    "independentlyVerifiedNote": "TBD",   // #587 の定義文に合わせる
    "quotes": [
      // { "text": "<原文の短い引用>", "applies": ["<canonical ingredient id>"], "timing": "pre_bake|post_bake|during_bake|pre_cook_prep|unspecified" }
    ],
    "relayedSummaries": [
      // { "ingredient": "<id>", "summary": "<中継された要約。引用ではない>" }
    ],
    "notStatedInSource": [
      // { "ingredient": "<id>", "note": "投入時機の明記を確認できず" }
    ],
    "notReceived": [
      // "<受け取っていない情報: 例 分量・温度・焼成時間>"
    ],
    "gameDesignValues": {
      "note": "GAMEPLAY CALIBRATION, not source",
      "counts": {},
      "bakeTarget": "TBD",
      "pieces": "TBD",
      "currentGameTiming": "none (not implemented)"
    }
  }
}
```

対象の `<evidence id>`: `eggplant-dengaku-pizza-pizzadb-p6` / `eggplant-tahini-pizza-pizzadb-p5` / `yuzu-shrimp-pizza`。

## 3. 証跡から分類先を示す判定表（記入後に使う。Owner 承認まで実装に使わない）

| 記入された証跡 | 分類先（案） | 扱い |
|---|---|---|
| ソースを生地に塗る、かつ全トッピングが焼成前（または仕上げの記載なし）、かつ下ごしらえの記載なし | 既存工程だけで可能 → 通常 ladder | 該当 U 単位の実装 PR（別途 Owner 承認） |
| 白ごま・ザクロ・大葉などが**焼成後** | 後乗せ（FINISH / late catalog）。通常 ladder には入れない | late catalog 側の候補として再分類。E5 の公開ゲートに従う |
| ソース（柚子胡椒・タヒニ等）が**焼成後にかけるもの** | ソース後乗せ（#579 / #518 前提） | 実装不可。再分類 |
| ナス・エビを**事前に焼く・揚げる・炒める** | 下ごしらえ工程（`PREP_STEP`） | 通常 ladder に入れない。新工程 Epic で再分類 |
| 材料に過不足 | 識別集合が変わる | 衝突・Research・ladder・DH4 を再検証してから再判定 |
| 記載なし（`unspecified` / `notStatedInSource`） | **確定しない** | Owner が既定を決めるまで保留。`shirasu-pizza` の前例（出荷は焼成前のまま・暫定扱い）を自動適用しない |

## 4. 既存の関連証跡（要約。すべて独立再取得なし）

- 3 レシピとも `verifiedAt: 2026-09-22 (relayed, not independently re-fetched)`。個数・焼成窓・工程タイミングの記録なし（`evidenceGaps: []` だが、これは「ギャップ無し」の意味ではなく、工程情報が元々評価対象外だったことを示す）。
- #587（未 merge）の中継: ikura-salmon のページは「いくらと大葉は焼成後に載せ」。**柚子えびの大葉が同じ扱いかは未確認**。
- #612（未 merge）の原典監査は出荷済み 45 件が対象で、この 3 件は含まれない。
