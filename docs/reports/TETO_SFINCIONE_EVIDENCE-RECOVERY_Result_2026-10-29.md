# Sfincione — Evidence Recovery & Design Lock Gate（調査・docs-only）

Date: 2026-10-29 / Audited main: `3bc4ba63da4f7d38ea45ae1b477db18ab40f2b1f`
Branch: `claude/sfincione-evidence-recovery-p242j2`（`claude/sfincione-stage-1a-owner-record-p242j2` @ `9b95f63` から分岐。既存ブランチは未改変）
関連: `docs/design/TETO_SFINCIONE_STAGE-1A_DETAILED-DESIGN_2026-10-29.md` / `docs/decisions/TETO_SFINCIONE_STAGE-1A_OWNER-DECISION-RECORD_AND_GATE-CHECKLIST_2026-10-29.md`

> **本書は HOLD 解除でも実装承認でもない。** matrix の証跡分類は変更していない。DH4 / Hint 5.0 の privacy sweep は未実施のため、証跡が揃っても実装 READY にはしない。
> **原典（PIZZA DB）は今回も直接確認できていない。** 以下の代替資料を「原典を確認した」根拠として扱わない。

## 1. 調査方法と限界

- 原典: `https://pizzadb.jp/compare/world-pizzas/page/4/` を WebFetch で再試行 → `getaddrinfo ENOTFOUND`（セッションのネットワーク許可ドメイン外）。前回は `curl` が CONNECT 403。**認証・アクセス制御の迂回は行っていない。** 到達にはセッション設定で `pizzadb.jp` を許可する必要がある。
- 代替資料: **WebSearch のみ**。WebFetch は他ホスト（giallozafferano / sanvitoweb / gourmettraveller / wikipedia）も全て `ENOTFOUND` で、**各ページ本文は開けていない**。以下は検索結果に付いた**要約文**に基づく（ページ本文の引用ではない）。したがって信頼度は全て「中以下」で、ページ本文での再確認が望ましい。
- 確認日: 2026-10-29（全項目）。

## 2. 情報源の区分

| 区分 | 資料 | URL | 内容（要約ベース） | 信頼度 |
|---|---|---|---|---|
| **一次（原典）** | PIZZA DB 比較表 / 個別ページ | `https://pizzadb.jp/compare/world-pizzas/page/4/` | **取得不能**（403 / ENOTFOUND） | — |
| repo 内の中継記録 | 172 matrix・master evidence | `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` | `onion, anchovy, oregano, olive-oil`、`sauceFamily: トマトソース`、`doughStyle: null`、corroboration 1、`verifiedAt` 2026-09-22 Phase 0B relay | 中継（独立再取得なし） |
| 独立二次（地域情報） | itPalermo「Lo sfincione palermitano e la variante bagherese」 | `https://palermo.italiani.it/scopricitta/lo-sfincione-palermitano-e-la-variante-bagherese/` | パレルモ版とバゲリア版の違い | 中（要約のみ確認） |
| 独立二次（メディア） | Gambero Rosso「Lo sfincione bianco di Bagheria…」 | `https://www.gamberorosso.it/attualita/sfincione-bianco-bagheria/` | バゲリア版は白（トマトなし）、起源の議論 | 中（要約のみ） |
| 独立二次（観光公式系） | Visit Sicily「Sfincione di Bagheria」 | `https://www.visitsicily.info/en/ricetta/sfincione-of-bagheria/` | バゲリア版の材料 | 中（要約のみ） |
| 独立二次 | Franco Ristorante「palermitano o bagherese: differenze」 | `https://francoristorante.it/sfincione-palermitano-o-bagherese-quali-sono-le-differenze/` | 形・トマト・チーズの違い | 低〜中（店舗ブログ） |
| 二次（レシピ） | Sicily Addict「Sfincione palermitano: la ricetta originale」 | `https://www.sicilyaddict.it/blogs/blog/sfincione-palermitano-la-ricetta-originale-dello-street-food-siciliano` | 厚さ約 2 cm、30×40 天板、玉ねぎ・caciocavallo・パン粉・焼成前の olive oil | 中（レシピ。個人差あり） |
| 二次（レシピ） | Cookist / Cuocicuoci / tavolartegusto ほか | `https://www.cookist.it/sfincione-palermitano-la-ricetta/` ほか | 180–250 °C、二次発酵、天板 | 中 |
| 二次（レシピ） | America's Test Kitchen「Classic Sicilian Pizza」 | `https://www.americastestkitchen.com/recipes/12666-classic-sicilian-pizza` | 玉ねぎ＋アンチョビをソースに煮込む、provolone 代用 | 中（米国流の翻案。原型とは別と明記されうる） |
| 二次（レシピ） | San Pellegrino | `https://www.sanpellegrino.com/node/736` | トマト缶 700 g、薄切り玉ねぎ、pecorino、サンヴィート修道院説 | 中 |
| 二次（背景） | Tasting Table / Sicilian Food Culture | `https://sicilianfoodculture.com/sfincione-why-the-sicilian-pizza-is-actually-not-a-pizza/` | 語源 spongia、厚いスポンジ状、トマトは後世、修道院説は伝承 | 低〜中（起源は資料間で不一致） |

分類: 上表の「二次」はすべて**独立した二次資料**。**ゲーム上の仮定**（olive-oil の PAINT_TEMPORARY、丸型、個数、焼成窓）は資料ではなく設計判断で、§4 で分離する。

## 3. 5 項目の裏付け状況

| 項目 | 代替資料から言えること | 裏付け | 注意 |
|---|---|---|---|
| **1 材料** | パレルモ版の定番: トマト（ソース）・玉ねぎ・**caciocavallo（チーズ）**・**パン粉**・オレガノ・EVOO。アンチョビは「入れることもある」（検索要約）〜多くのレシピで使用（ATK は煮込み）。バゲリア版は tuma / ricotta・玉ねぎ・アンチョビ・パン粉（トマトなし） | **部分的** | PIZZA DB 行の `onion, anchovy, oregano, olive-oil`（チーズ・パン粉なし）とは**チーズとパン粉で食い違う**。PIZZA DB が簡略表記なのか別の流儀なのかは原典でしか分からない |
| **2 トマトソース** | **パレルモ版にはトマトソースが主要材料**。バゲリア版は「rigorosamente bianco e senza pomodoro」 | **部分的〜支持** | `sauceFamily: トマトソース` の派生はパレルモ版なら整合。ただし PIZZA DB がどちらの版かは未確認で、**白い版である可能性は残る** |
| **3 オリーブオイルの工程** | 玉ねぎを油で蒸し煮し、**焼成前**に「generoso filo d'olio extravergine」を掛ける（複数レシピ）。生地・天板にも油を使う | **部分的** | 「焼成前に掛ける」は支持。ただし**ソースのように塗る層ではなく振りかけ**であり、`PAINT_TEMPORARY` は GAMEPLAY ASSUMPTION のまま。焼成後の追い油の有無は資料により異なり得る（未確認） |
| **4 生地の形状・厚み** | **パレルモ版: 長方形の天板、厚さ約 2 cm、スポンジ状（語源 spongia）**。バゲリア版: 丸型で高め | **支持（ただし暫定案と相違）** | 標準丸型・薄めの生地とは**相違**。丸型はバゲリア版（トマトなし）に対応する |
| **5 名称・地域** | パレルモ起源の街角フード。修道院（サンヴィート）説は伝承で、資料間で不一致。クリスマス〜12/8 に作る。パレルモ版（赤）とバゲリア版（白）の 2 系統。Phase 0B の「siciliana / sfincione の三者関係」も同種の曖昧さ | **支持（起源は不確実）** | PIZZA DB のページが示す版・名称範囲は未確認 |

## 4. 暫定設計との照合

| 暫定案 | 資料の裏付け | 区分 |
|---|---|---|
| tomato-sauce ×1 | パレルモ版で支持 | 材料は資料、**個数は GAMEPLAY CALIBRATION** |
| olive-oil ×1（焼成前 PAINT_TEMPORARY） | 焼成前の振りかけは支持 | 在否は資料、**PAINT_TEMPORARY・1 層は ASSUMPTION** |
| onion ×4 / anchovy ×2 / oregano ×1 | 3 種とも言及あり（anchovy は流儀により任意） | 材料は資料、**個数は CALIBRATION** |
| **チーズなし** | **資料と食い違う**（caciocavallo / pecorino / provolone が通例）。PIZZA DB 行には記載なし | **ゲーム上の簡略化**（PIZZA DB 行に従う）。パン粉も未採用 |
| **標準丸型** | **資料と相違**（パレルモ版は厚さ約 2 cm の長方形）。丸型はトマトなしのバゲリア版 | **ゲーム上の簡略化。原典との相違を明示すること** |
| CUT なし | 資料に CUT の規定はなし（角切りで提供）。丸型 CUT は意味を持たない | ゲーム判断 |
| 焼成窓 60〜80 | 資料は実温・実時間（180–250 °C、20–30 分）で、ゲーム値に変換できない | **完全に ASSUMPTION**（中央値を動かさない制約から） |
| FREE のみ | 資料なし | 運用判断（Lunch Rush 除外は Owner 方針） |

追加の相違: ATK 等では玉ねぎとアンチョビを**ソースに煮込む**が、ゲームは**トッピング**として置く。これは既存の onion・anchovy 系レシピと同様の簡略化。

**構造上の含意（重要）:** 原典のパレルモ版を忠実にするなら「厚い長方形の天板」であり、Square Dough の領域（`pan: tray`、grandma と同系統）に入る。その場合 (a) `PAN_TRAY_RECIPE_IDS` への追加と OD-544-2 の改訂、(b) Dinner Mission で識別不能になる、(c) 四角生地まわりの未完了項目への依存、が新たに生じる。丸型で進めるなら、トマト入りの料理に**白い版の形**を当てはめる折衷になる。どちらを取るかは Owner の判断事項。

## 5. Design Lock 判定（A / B / C）

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **A** | 現行 HOLD 維持 | 過去の Owner 判断（「根拠確認まで保留」）に忠実。原典が未読のままでの前進を避けられる | 前進がない |
| **B** | 代替証跡を条件に、**Owner に HOLD 解除を「提案」** | 材料・トマト・焼成前の油はパレルモ版で支持され、保留理由の一部（トマトが派生値）は軽減される | 保留の条件は「根拠確認」で、**原典そのもの**が未読。代替資料は PIZZA DB 行の内容（チーズなし・生地不明）を確認しない。丸型 vs 長方形の相違が未決 |
| **C** | GAMEPLAY ASSUMPTION として別枠の計画を継続 | docs 上の準備を進められる（現在のStage 1a設計がこれに当たる） | HOLD を事実上迂回する形にならないよう、実装・解除と明確に分離する必要 |

**推奨: A を正式状態として維持しつつ、B を「Owner への条件付き提案」として用意する（解除自体は Owner 判断）。C は docs 準備に限る。**
理由: ① 保留理由の核（原典の確認）は未達で、代替資料は独立した補強にとどまる ② 代替資料は設計と**相違**を示す（厚い長方形・チーズ）ため、「裏付けが揃った」とは言えない ③ B の提案に必要な条件が明確（§6）。過去の Owner 判断は上書きしない。

## 6. Design Lock 解除（B）に不足する条件

1. PIZZA DB の個別ページを**直接確認**（Owner、または `pizzadb.jp` を許可した環境、または ChatGPT 取得 + 出典・日付の記録）。確認項目: 材料（チーズ・パン粉の有無）、トマト、油の位置、生地、版（パレルモ / バゲリア）。
2. 原典と代替資料の相違（チーズ・生地）に対する **Owner の簡略化方針**（丸型で進める／長方形＝天板で進める／保留継続）。
3. 簡略化が「原典の再現」ではなく GAMEPLAY ASSUMPTION であることを説明文・docs に残す方針の承認。
4. Owner による保留解除の明示的記録（Design Lock §8-7 / Addendum §7 の更新根拠）。
5. 複数ソース例外の個別追加（OD-544-2 の「grandma 限定」の改訂）と案 B の SAUCE 段の個別承認。

## 7. DH4 / Hint 5.0 の残る Gate（変更なし）

privacy sweep は**未実施**（`src` 変更が前提）。残る項目は Owner Decision Record §3 / §4 のとおり: `MULTI_SAUCE_RECIPE_IDS` 追加、SAUCE 段（案 B）の個別承認、DH4 guard の k≥2、near-miss の tie 条件、production gate、Anti-Oracle §15 の複数ソース再計算（OD-544-8、未実施）、golden の append-only、既存 72 レシピの回帰。**証跡が揃っても、これらが完了するまで実装 READY にしない。**

## 8. 評価

**Stage 1a: CONDITIONAL（維持）。** 材料・トマト・焼成前の油は独立資料（パレルモ版）で部分的に支持されるが、原典は未読で、チーズと厚い長方形の生地という相違が新たに明確になった。
