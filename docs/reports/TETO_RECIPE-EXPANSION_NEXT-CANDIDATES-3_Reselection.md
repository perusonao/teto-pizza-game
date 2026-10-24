# Recipe Expansion — 次の実装候補の再選定（Batch 9 ブロッカー確定後、docs-only）

基準 `origin/main` = `485c515`（2026-10-23）。レシピ・ladder・golden は `70aa262` 以降動いていない（差分は #645 Pinsa docs、#646/#647 CI・test）。
範囲: 調査と設計のみ。`src/` `e2e/` workflow は未変更。実装 PR・CI 再実行・merge・デプロイなし。pizzadb.jp は到達不可（403）のため原典は repo の 172 証跡行のみで、**未確認事項は推測で埋めない**（Owner のページ共有を優先）。
前提: `docs/decisions/TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md`（第 2 版）、`TETO_RECIPE-EXPANSION_NEXT-BATCH-2_Fresh-Audit.md`。

## 1. 前提の変化

| 項目 | 内容 |
|---|---|
| **月見 = 実装保留** | DH4 gate が月見入りで 1 件 fail（`expected 'attr:group:other' not to match /:other$/`、13/14 pass）。OD-DH4-2-9 の緩和は禁止。step 56 は予約しない |
| 柚子えび = 保留継続 | 原典確認（焼成前 / 後）まで |
| `green-onion` 仕様 | family = herb、小口切りの輪、`xs`（OD-B9-3）は維持。**月見以外のレシピで先に導入できる** |
| #578 claim | 代理 release 投稿済み（#578 comment 6373041313）。**新しい実装 claim は未投稿** |

## 2. 再選定の基準（制約）

| 軸 | 基準 |
|---|---|
| 原典 | 証跡の質を区別する: ◎ 個別ページ出典あり（`/pizzas/<名>/`）、○ 比較表のみ。いずれも工程タイミング・個数は repo に無い → **Owner のページ共有で補う** |
| 既存 gate（DH4 OD-DH4-2-9 ほか） | `other` 家族（egg / nuts / sweets）の食材を含むレシピは、月見と同じ抵触の恐れがある（**一般則としては未証明。原因の特定は未実施**）。`other` を含まない候補を優先し、含む候補は実装前に同じ scratch 検証（Owner 承認が要る）を前提とする |
| 新工程 | `FULL`（`requiredCapabilities` 空）のみ。後乗せ・複数ソース・生地・天板・下ごしらえ等は P3 以降 |
| 重複 | 識別集合が既存 62 件のどれとも不一致（再計算済み） |
| 保留 | 月見・柚子えびは除外 |

## 3. 絞り込み（172 → 候補）

FULL かつ blocker 無し・新食材 ≥1 の 8 件（前回 audit）から、保留 2 件を除いた 6 件＋ソース不明（`BASE_SAUCE_UNSPECIFIED`）の材料 0 の 2 件:

| 候補 | 新食材 | 原典の質 | `other` 家族 | 判定 |
|---|---|---|---|---|
| **sichuan-eggplant** 四川風ナスピザ | `doubanjiang`（sauce）+ `green-onion`（herb、決定済み） | ◎ `/pizzas/sichuan-eggplant/` ＋ 比較表 p14 | **なし**（eggplant 野菜 / garlic herb / green-onion herb / mozzarella） | **第 1 候補** |
| **caponata** カポナータ / **jamaican-jerk-chicken** | **0** | ○ 比較表 p2 / p3 | なし | **第 2 候補（条件付き）**: ソース欄が「その他」で下地が不明。**Owner がページ内容を共有して「ソース無し」と確認できた場合のみ** NO_SAUCE にできる（推測では決めない） |
| eggplant-dengaku ナス田楽 | `miso-sauce`（sauce）+ `white-sesame` | ○ 比較表 p6 | **白ごまの family が未決**（種実なら `other` 側に入り抵触の恐れ） | 第 3 |
| eggplant-tahini ナスとタヒニ | `tahini`（sauce）+ `pomegranate`（fruit） | ○ 比較表 p5 | なし | 第 4（タヒニ色が生地に近い → 視認性の追加作業） |
| currywurst / cuban-pizza | 3 | ○ | なし | 見送り（新食材 3） |
| peking-duck | 4（PREPARED_COMPOSITE） | ◎ | なし | 見送り（新食材 4） |
| tsukimi / yuzu-shrimp | — | — | egg = other | **保留（Owner 判断）** |

見送り・P3 以降の分類（Pinsa / 生地 / 後乗せ / 複数ソース / ZONED 等）は前回 audit §6 のまま変更なし。

## 4. 第 1 候補: 四川風ナスピザ（`sichuan-eggplant-pizza`）

### 4.1 証跡（`TETO_PIZZADB_172_MASTER-EVIDENCE.json`）
食材欄: ナス / 豆板醤 / にんにく / 青ねぎ / モッツァレラチーズ。ソース欄「ホットソース」（matrix は `doubanjiang` を sauce として導出、status `listed`）。生地「薄めの生地」。出典 `https://pizzadb.jp/pizzas/sichuan-eggplant/`（個別ページ）、比較表 `…/compare/world-pizzas/page/14/` が 1 件裏付け。中継 2026-09-22、独立再取得なし。**個数・焼成窓・工程タイミング・下ごしらえの記載は repo に無い。**

### 4.2 仕様案（暫定）
| 項目 | 内容 | 状態 |
|---|---|---|
| id / 名 | `sichuan-eggplant-pizza` / 四川風ナスピザ。discovery target = evidence id `sichuan-eggplant-pizza` | 提案 |
| 材料 | doubanjiang 1（SAUCE の PAINT）/ mozzarella 2 / eggplant 3 / garlic 1 / green-onion 2（非ソース 8 片 = リング 8） | **暫定** |
| 焼成窓 | 58–78 | 暫定 |
| 工程 | SAUCE → CHEESE → TOPPING → BAKE（`pesto-*` と同型）。CUT なし、credited、`lunchRush:false`、key-free | 提案 |
| `doubanjiang` | `category: "sauce"`, `placement: "spread"`, 既存 PAINT。色は暗い赤褐色が候補（`#8a2b1c`: トマト `#c73b2e` との素の色差 ΔE≈22、生地との差は α0.46 で ≈26–30。`#a8321f` はトマトに近すぎ ΔE≈10 で不可）。**色は Owner / 実機 HV で確定** | 仮 |
| `green-onion` | OD-B9-3 の仕様どおり（herb・小口切りの輪・`xs`）。月見の保留に依存しない | 決定済み |
| ladder | 通常 step（実装時の次番号）に `["doubanjiang","green-onion"]`（2 材料 1 step = 8b の shiso+whitebait と同形）、key = このレシピ。credited | 提案。番号は予約しない |
| Research | コホート = step の最後の材料。単独 step なので文字なし。既存エントリの文字は動かない | 導出 |
| 図鑑 | 通常 63。章 4 は 27→28（導出表示） | 導出 |
| Hint 5.0 / DH4 | key-free。golden 追記専用。sauce 5 種目（DH4 audit の `category` 4→5）。**`other` 家族の食材を含まない**ため月見型の抵触は想定しにくいが、**未検証** | 要検証 |
| 不確実な点 | ①青ねぎが焼成後の仕上げか（月見と同じ疑い）②豆板醤を炒める下ごしらえがあるか（matrix は prep 空）③ナスの調理法 | 原典（Owner 共有）で確認 |

### 4.3 着手条件
S1 Owner が `https://pizzadb.jp/pizzas/sichuan-eggplant/` の該当箇所を共有: 材料の一致、**青ねぎの投入タイミング**、豆板醤の使い方（塗る / 炒める）、焼成条件。焼成後なら後乗せ（P3 以降）、炒めるなら下ごしらえ（新工程）で**通常 ladder 不可**。
S2 DH4 gate の事前検証: **実施済み**（`TETO_RECIPE-EXPANSION_SICHUAN-EGGPLANT_DH4-Preflight.md`。production gate 14/14 pass、旧ガード件数ピンのみ 1 fail）。
S3 新しい実装 claim の投稿（#578 の代理 release 済み）。S4 Owner の着手 GO。

## 5. 必要な Owner 判断

1. **月見**: 恒久見送り / OD-DH4-2-9 改訂 / `other` 再分類（決定記録 §5.5）。いずれも gate 緩和ではない形での判断。
2. **次の実装候補**: 第 1 = 四川風ナス（推奨）、または材料 0 の caponata / jamaican（ページ共有で「ソース無し」が確認できた場合）。
3. **原典**: 四川風ナス（個別ページ）と caponata / jamaican（比較表 p2 / p3）の該当箇所の共有。柚子えび・月見は保留中。
4. **DH4 事前検証の追加承認**（四川風ナスで同じ scratch 検証をしてよいか）。
5. **`white-sesame` の family**（田楽を進める場合のみ。`other` 側に入る分類は DH4 の追加検証が前提）。

## 6. 実施しなかったこと
コード・テスト・e2e・workflow の変更、実装 PR、CI 再実行、他セッションのブランチ変更、claim の新規投稿、pizzadb.jp の再取得、四川風ナス等の DH4 事前検証、merge・デプロイ。
