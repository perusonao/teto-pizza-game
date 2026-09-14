# テトのピザ屋さん（仮） Pitz Progression SSOT

Status: Phase 3C 設計確定（Final Verdict A / 実装未着手）
Owner: プロジェクト全体設計
関連ドキュメント: `PIZZA_GAME_SSOT.md`（プロジェクト全体の正典）/ `PIZZA_GAME_DATA_MODEL.md` /
`PIZZA_GAME_UI_SPEC.md` / `PIZZA_GAME_Phase3B2_Dex-Progression_Result.md`

このドキュメントは **Phase 3C（進行・収集要素の追加）** における唯一の正典（Single Source of
Truth）である。Phase 3C に関する実装・デザイン・レビューで判断に迷ったときは、まずこのファイルを
参照する。プロジェクト全体の方針（First Fun Pizza／経営要素を目的化しない）を定めた
`PIZZA_GAME_SSOT.md` と矛盾する場合は、`PIZZA_GAME_SSOT.md` を優先する。

**このドキュメントの位置づけ**

- 本ドキュメントは **設計のみ** を確定するものであり、実装（production code）は一切含まない。
- 実装は本ドキュメント確定後、Phase 3C-1 から別PRで順次着手する（本PRの対象外）。
- 既存の Phase 0〜3B（`PIZZA_GAME_SSOT.md` 第3章・第10章）の完成済み範囲・スコープは変更しない。

---

## 1. Phase 3C の目的

Phase 3B までで「1枚のピザを作る」体験（First Fun Pizza）と、作ったピザを図鑑（Dex）に
集める楽しさは確立できた。Phase 3C では、既存のゲームループ（ORDER → PREPARE → BAKE →
RESULT → DISCOVERED）を一切変更せずに、**「作り続けたくなる理由」** を追加する。

- 経営シミュレーション（在庫コスト、売上管理、従業員など）は目的にしない。
- 通貨・ショップ・ミッションは、あくまで「新しい食材・新しいレシピに出会うための
  やわらかい目標」として機能させる。プレイヤーの操作対象は最後まで「1枚のピザ」のまま。
- 既存プレイヤー（Phase 3B までの状態）に不利益（再購入要求・進捗ロストなど）を与えない。
  既存6レシピ・既存13食材は Phase 3C 導入後も **無条件で** そのまま使い続けられる
  （詳細は第5章）。

## 2. 用語定義

| 用語 | 定義 |
|---|---|
| **Pitz** | Phase 3C で追加するゲーム内通貨。ミッション達成で獲得し、食材の恒久購入にのみ使用する。 |
| **Quality（★1〜★5）** | RESULT 採点を5段階の品質評価に拡張したもの（第4章）。既存の★1〜3表示を置き換える。 |
| **Mastery（習熟度）** | 全レシピの Dex BEST ★ の合計（`totalStars`）。Dexから毎回 derived で算出し、保存しない。食材の入荷条件（LOCKED → AVAILABLE_TO_BUY）に使う（第7章）。 |
| **Mission（ミッション）** | 達成すると Pitz を得られる短い目標（第8章）。 |
| **Shop（食材ショップ）** | Pitz を消費して食材を恒久購入できる画面（第9章）。 |
| **Starter Set** | 既存6レシピ。Shop購入なしで最初から作れるレシピ群（第5章）。 |
| **Ingredient State** | 食材ごとの所持状態。`LOCKED` / `AVAILABLE_TO_BUY` / `OWNED` の3値（第6章）。 |
| **Lunch Rush** | 連続注文にPitzボーナスが付く期間限定イベント（第10章）。 |

## 3. Currency: Pitz

- Pitz はゲーム内でのみ意味を持つ架空通貨。実課金・外部送金とは一切結びつけない
  （`PIZZA_GAME_SSOT.md` 第4章「課金・アプリ内購入」非対象の方針を継承）。
- 用途は **食材の恒久購入のみ**（第9章）。消費アイテム・ガチャ・時短購入などは作らない。
- 初期所持 Pitz は 0。既存プレイヤー（Phase 3B までのセーブ相当）も 0 から開始する
  （第5章の通り、既存6レシピ・13食材は Pitz 残高に関係なく使い続けられるため、
  0スタートでも不利益にならない）。

## 4. Quality: ★1〜★5

現行 `src/logic/scoring.ts` の `ScoreBreakdown.stars`（1〜3）を、Phase 3C では **★1〜★5** の
5段階に拡張する。既存の3観点（`matchScore` / `ingredientScore` / `bakeScore` の平均 `total`）は
そのまま流用し、星への変換テーブルのみを次のように再定義する。

| total（0〜100） | Quality |
|---|---|
| 95以上 | ★5 |
| 85以上95未満 | ★4 |
| 70以上85未満 | ★3 |
| 50以上70未満 | ★2 |
| 50未満 | ★1 |

- 既存ロジックと同様に、**焼き加減が perfect ゾーンでない場合は ★5 を付けない**
  （現行の「bakeState が perfect でなければ ★3 にしない」ルールを踏襲し、
  上限を ★4 に読み替える）。狙った焼き加減で仕上げることを最高評価の必須条件にする。
- 既存の★1〜3表示（RESULTのブルーのコメント、Dexカード等）は Phase 3C 実装時に
  ★1〜5表示へ置き換える。呼び出し側の表示コンポーネントの変更が必要になるが、
  スコア計算そのもの（3観点・total算出）は変更しない。

## 5. Starter Set（既存6レシピ）/ OWNED 食材（既存13食材）

- 既存 `RECIPES`（`margherita` / `marinara` / `quattro-formaggi` / `genovese` / `bismarck` /
  `funghi`）は **Starter Set** と位置づけ、Phase 3C 導入後も Shop購入・Mastery条件
  **一切なしで** 常に注文対象・作成可能なままとする。
- 既存 `INGREDIENTS`（13種: tomato-sauce, olive-oil, pesto, mozzarella, gorgonzola,
  parmigiano, fontina, basil, garlic, oregano, cherry-tomato, egg, mushroom）は
  Phase 3C 導入時点で **全件 `OWNED`** として初期化する。
- この方針により、Phase 3C 導入前後でプレイヤー体験の連続性が保たれる
  （「今まで作れたピザが急に作れなくなる」という後退がない）。

## 6. Ingredient State: LOCKED / AVAILABLE_TO_BUY / OWNED

Phase 3C 以降に追加する食材（Starter Set に含まれない食材）は、次の3状態のいずれかを持つ。

```
LOCKED ──(totalStars がしきい値 minTotalStars 達成)──> AVAILABLE_TO_BUY ──(Pitzで購入)──> OWNED
```

| 状態 | 意味 | Shop表示 | PREPAREでの使用 |
|---|---|---|---|
| `LOCKED` | まだ存在に気づいていない食材 | 表示しない、または「？？？」のみ | 不可 |
| `AVAILABLE_TO_BUY` | 存在は見えているが未購入 | 名前・価格（Pitz）・必要Mastery達成済みを表示 | 不可 |
| `OWNED` | 購入済み・既存13食材と同様に使用可能 | 「所持済み」表示 | 可（IngredientTrayに通常表示） |

- 既存13食材は第5章の通り Phase 3C 導入時点で `OWNED` 固定であり、この状態遷移の対象外。
- 状態は一方向にのみ進む（`OWNED` → `LOCKED` に戻る「売却」「ロスト」は作らない）。

## 7. Mastery → Shop availability

**Mastery は `totalStars`（全レシピの Dex BEST ★ の合計）として定義する。レシピ別の
カウンターは持たない**（Phase 3C-3 で確定。実装は `src/logic/mastery.ts` の
`totalStars(dex)`。詳細は
`docs/reports/PIZZA_GAME_Phase3C-3_Mastery-Availability_Result.md` を参照）。

- `totalStars` は「発見済み各レシピの Dex BEST ★（`bestStars`）の合計」。未発見レシピは
  0 として扱う。
- **保存しない**。Dex（`dex: DexEntry[]`）から呼び出すたびに derived で算出する
  （第14章・第15章の通り、保存されるのは Dex 自体のみ）。
- `timesMade`（作った回数）や直近1回のスコアは `totalStars` に一切影響しない。
  影響するのは各レシピの Dex BEST（`bestStars`）の更新のみ。
- 各 `LOCKED` 食材は `unlockCondition: { minTotalStars: N }` を持ち、
  `totalStars >= N` になった時点で `LOCKED` → `AVAILABLE_TO_BUY` へ遷移する
  （特定レシピへの個別紐付けではなく、全レシピ共通の1指標に対するしきい値判定。
  第11章の #7 提案（サラミ）はこの方針の最初の適用例）。

**合計★方式（レシピ別カウンター方式ではなく）を採用する理由**:

- プレイヤーに理解しやすい（「あと★2で入荷」のように進捗を一言で示せる）
- 全レシピの上達がまんべんなく Progression に寄与する（特定1レシピの周回作業にならない）
- ★5を狙う意味が最後まで残る（★4止まりでも進むが、★5の方が早く進む）
- Dex BEST との相性がよく、新しい保存領域を増やさずに済む

**役割分離**（Progression 全体を通して厳守する）:

```
ピザを作る → Dex BEST更新 → totalStars増加 → unlockCondition達成
  → 食材が AVAILABLE_TO_BUY → Mission で Pitz を稼ぐ → Shop で購入 → OWNED
  → 必要食材が揃ったレシピが available になる
```

- **★（totalStars）** は入荷条件（`LOCKED` → `AVAILABLE_TO_BUY`）を判定するためだけに使う。
- **Pitz** は購入手段（`AVAILABLE_TO_BUY` → `OWNED`）。
- **★だけで食材が `OWNED` になることはない** — 入荷と購入は常に別ステップとして扱う。
- Mastery（`totalStars`）そのものを大きくプレイヤーに意識させる UI（プログレスバー等）は
  Phase 3C では必須要件にしない（Shop 内で「あと★◯で入荷」程度の軽い表示に留める）。

## 8. Mission → Pitz

- Mission が Pitz の **唯一の入手経路** とする（食材売却・広告視聴等の他の入手経路は作らない）。
- Mission は以下の2種類を持つ。

  1. **常設ミッション（何度でも達成可能）**: 「ピザを1枚完成させる」。RESULT確定のたびに
     達成し、Quality に応じた Pitz を得る（★1〜★5 それぞれに固定の Pitz 報酬額を割り当てる）。
     これが Phase 3C における実質的な基本収入ループになる。
  2. **一度きりのマイルストーンミッション**: 「はじめてのピザを完成させる」「図鑑を3種類
     埋める」「いずれかのレシピを Quality ★4 以上で作る」など。達成済みは記録し、
     二重には報酬を出さない。
- Mission の一覧・達成条件・報酬額は Phase 3C-5（第12章）で確定する。本ドキュメントでは
  「常設＋マイルストーンの2層構造」「唯一の Pitz 入手経路」という骨格のみを正典として定める。

## 9. Pitz → Ingredient permanent purchase（Shop）

- Shop は `AVAILABLE_TO_BUY` 状態の食材のみを購入対象として一覧表示する。
- 購入は Pitz を消費して即時 `OWNED` に遷移する **恒久購入**。再購入・消費・期限切れはない。
- Pitz残高が価格に満たない場合は購入不可（UI上でグレーアウト等）。返金・値引きは作らない。
- 購入した食材は即座に PREPARE の IngredientTray から使用可能になる。

## 10. Recipe availability derived from owned ingredients

- Starter Set 以外の新レシピ（第11章のサラミピザ等）は、**それ自体を購入する概念を持たない**。
  レシピが「作成可能かどうか」は、そのレシピの `requiredIngredients` が全て `OWNED` かどうかから
  **導出** される（レシピ専用のロック状態を別途持たない）。
- ORDER フェーズの注文候補（現行 `src/data/orders.ts` の `getNextOrder`）は、
  必須食材が全て `OWNED` であるレシピのみを対象にする。Starter Set は第5章の通り常に
  条件を満たすため、Phase 3C 導入直後は現行と全く同じ6レシピが注文対象になる。
- この「食材ownership から派生」という設計により、レシピ側のロック状態と食材側のロック状態が
  二重管理にならず、食材購入だけを唯一の解放操作として一貫させられる。

## 11. Lunch Rush

- Lunch Rush は、既存の5フェーズ状態機械（ORDER/PREPARE/BAKE/RESULT/DISCOVERED）を
  変更せずに実装する **注文レベルの期間限定イベント**。新しいフェーズは追加しない。
- 一定条件（例: 常設ミッションを一定回数達成した後、一定間隔で発生）で、連続する
  数注文（2〜3枚）が「ランチラッシュ！」として提示され、その注文群を完成させると
  Pitz 報酬にボーナス倍率がかかる。
- Lunch Rush 中もゲームオーバー・失敗状態は作らない（`PIZZA_GAME_SSOT.md` の
  「失敗してもゲームオーバーにしない」方針を継承）。時間切れがあっても、単に
  ボーナスを逃すだけで通常の ORDER に戻る。
- 発生条件・倍率・UI表現の詳細は Phase 3C-6（第12章）で確定する。

## 12. #7 レシピ提案: サラミ → サラミピザ

Shop で最初に解放される新食材として **サラミ（salami）** を推奨する。

- Unlock条件: `unlockCondition: { minTotalStars: N }`（第7章の合計★方式。全レシピ共通の
  `totalStars` に対するしきい値で判定する。特定レシピのMastery回数と個別に紐付ける方式は
  採用しない。具体的な N はレシピ実装時に確定）。
- 食材の組み合わせとしては、トマトソース・モッツァレラという既存の構成にサラミを足すだけで
  自然に理解できる、マルゲリータ／ビスマルク／フンギの延長線上にある組み合わせを意図している
  （こちらはunlock条件ではなく、レシピ設計上の意匠として維持する）。
- 新レシピ「サラミピザ」: `tomato-sauce` + `mozzarella` + `salami` という、既存の
  マルゲリータ・ビスマルク・フンギと同系統（トマト+モッツァレラ+具材1種）の構成にする。
  実在するピザとして自然な組み合わせであり、架空の食材・組み合わせを避ける方針
  （`PIZZA_GAME_SSOT.md` 第1章）に沿う。
- 新食材1種・新レシピ1種のみという最小構成で、Phase 3C の Shop/Mastery/Pitz ループを
  最初に実証する「最初の一歩」として位置づける。具体的な価格・Mastery しきい値の
  最終値・`bakeTarget` はレシピ実装時（Phase 3C-6）に確定する。

## 13. Phase 3C の対象外（Out of Scope）

- 食材の売却・消費・スタミナ制などのネガティブな経済要素
- ガチャ・ランダム排出・時間経過による自動収益
- オンラインランキング・SNS共有・サーバー同期（`PIZZA_GAME_SSOT.md` 第4章を継承）
- Starter Set 6レシピ・既存13食材への変更（第5章の通り、Phase 3C 導入で後退させない）
- 実課金・アプリ内課金とPitzの交換

## 14. Persistence: localStorage

- Phase 3C で新たに永続化するデータ: Pitz残高 / Dex（発見済みレシピ + 第15章のBEST品質）/
  食材の所持状態（`OWNED` になった食材ID一覧）/ 達成済みマイルストーンミッションのID一覧。
  Mastery（`totalStars`）は永続化しない — 第7章の通り Dex BEST から毎回 derived で
  算出するため、保存領域を別途持たない。
- 既存の `GameState`（現在のピザの中身・進行中フェーズ等、1プレイ中のみ有効な状態）は
  従来通り永続化しない。ページリロードでリセットされて良いのは「今作っている途中の
  ピザ」のみとし、進捗（Dex/Pitz/所持食材/Mastery/ミッション）はリロードをまたいで残す。
- 保存キーは1つの名前空間にまとめ、スキーマにバージョン番号を持たせる
  （例: `{ version: 1, pitz, dex, ownedIngredientIds, completedMissionIds }`。Mastery
  （`totalStars`）は上記の通り derived のためスキーマに含めない）。
  将来のスキーマ変更時は `version` を見て移行またはデフォルト値でフォールバックし、
  壊れた/旧形式のデータで例外を投げてゲームが起動不能にならないようにする。
- 具体的なキー名・移行コードは Phase 3C-1（第15章）で確定する。本章では
  「何を永続化するか」「1プレイ中の状態は対象外」「バージョン管理する」という
  方針のみを正典として定める。

## 15. Dex BEST

- 現行 `GameState.dex` は `string[]`（発見済みレシピIDの配列）のみを持つ。
  Phase 3C では、発見済みレシピごとに **そのレシピで過去に達成した最高 Quality（★1〜5）**
  を追加で記録する（"BEST" 表記）。
- Dex カード（`DexOverlay`）には、既存の「発見済み/未発見」表示に加えて
  `BEST ★★★★☆` のような最高品質表示を追加する。再挑戦して更新した場合のみ更新し、
  下がることはない（記録は単調増加）。
- `REGISTER_TO_DEX` 相当のロジックは、初回発見時の追加に加えて「既存の BEST より
  高い Quality だった場合のみ更新する」比較処理が必要になる（Phase 3C-2で実装）。

## 16. Implementation Roadmap: Phase 3C-1〜3C-6

本ドキュメント確定後、以下の順で実装する（各フェーズは別PR、レビュー・確認を経てから
次フェーズへ進む）。

| Phase | 内容 |
|---|---|
| **3C-1** | Pitz残高・localStorage永続化の基盤実装（第14章）。スキーマ定義・保存/読み込み・
  バージョン管理。ゲームプレイ・UIの見た目は変更しない土台づくり。 |
| **3C-2** | Dex BEST（第15章）。`GameState.dex` をレシピ別 BEST Quality を持つ形に拡張し、
  `DexOverlay` に BEST 表示を追加。 |
| **3C-3** | Quality ★1〜5 化（第4章）。`scoring.ts` の星変換ロジックを5段階に拡張し、
  RESULT・Dex 表示を更新。 |
| **3C-4** | Shop UI（第9章）。`AVAILABLE_TO_BUY` 食材をPitzで恒久購入するShop画面を実装
  （`LOCKED`/`AVAILABLE_TO_BUY`/`OWNED` の状態導出ロジック自体はPhase 3C-3で先行実装済み）。 |
| **3C-5** | Mission（第8章）。常設/マイルストーンミッション、Mission→Pitz付与ロジックを実装
  （Mastery=`totalStars`はPhase 3C-3で先行実装済み。レシピ別カウンターは採用しない）。 |
| **3C-6** | サラミ食材・サラミピザレシピ（第12章）+ Lunch Rush（第11章）。Shop/Mastery/Pitz
  ループの最初の実コンテンツと、期間限定ボーナスイベントを実装。 |

各フェーズの完了条件（Definition of Done）は、着手時に本ドキュメントを参照しつつ
フェーズ単位の Result レポート（`docs/reports/PIZZA_GAME_Phase3C-*_Result.md`）側で定める。

注記: 実際の実装順序は上表の当初想定と異なり、Quality ★1-5化 + Dex BESTがPhase 3C-1、
localStorage永続化基盤がPhase 3C-2、Mastery（`totalStars`）とIngredient/Recipe
availabilityがPhase 3C-3として先行して完了している。実行順序・実装内容の正典は
各 `docs/reports/PIZZA_GAME_Phase3C-*_Result.md` とし、上表は設計時点のロードマップ
（残タスクの見取り図）として扱う。

---

## 改訂履歴

- v1.0: Phase 3C Progression Design 初版確定（Final Verdict A: PITZ PROGRESSION SSOT READY TO
  COMMIT）。design/docs のみ。production code・tests・workflow の変更は含まない。
- v1.1: Phase 3C-3 実装（PR #17）を受けて、Mastery の正式定義を「レシピ別★4以上達成回数」から
  「`totalStars`（全レシピの Dex BEST ★ の合計、derived・非永続化）」に更新。第2・7・12・14・16章
  を実装（`src/logic/mastery.ts` / `src/state/progression.ts`）と一致するよう修正。
  詳細は `docs/reports/PIZZA_GAME_Phase3C-3_Mastery-Availability_Result.md` を参照。
