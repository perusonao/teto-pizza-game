# Discovery 3.0 — PR-4b 前の Owner Decision Brief と post-merge dry-run（2026-10-01）

- **main:** `52d14f9`（PR-4a #327 merge。Deploy / WebKit success）。PR-4b は**未着手 / NO-GO**。brazilian-calabresa は production に未追加。
- **black-olive:** UNCERTAIN のまま（PIZZA DB の「オリーブ」からの confidence-flagged match。新しい olive 食材は作らない）。
- **placeholder の扱い:** 過去の quantity / bake / placement の placeholder は authority にしない。下の「現在の実装挙動」は、dry-run が**今のコードで**どう動くかの事実で、採用案ではない。

## A. post-merge dry-run（main `52d14f9` + 仮の 26 件目。commit なし、worktree は破棄）

| 項目 | 結果 |
|---|---|
| unit | 31 file / 44 test 失敗（PR-4a branch の dry-run と同一集合）。`tsc` 型エラー 1（`cookingProfiles.test` の step 表） |
| E2E（Chromium 390×844、全 37 spec） | 15 spec で 29 失敗、残り 22 spec は 93 passed / 0 failed |
| pool = 2 | step 12 で `[brazilian-calabresa, pizza-portuguesa]`。auto target は calabresa（材料 5 種 < 6 種） |
| A→B（portuguesa → calabresa） | pool 2 → `[calabresa, fugazza]` → `[fugazza]`、ladder count/step 12 → 13 → 13、Shop 13 → 14 → 14 |
| B→A（calabresa → portuguesa） | pool 2 → `[portuguesa]` → `[fugazza]`、count/step 12 → 12 → 13、Shop 13 → 13 → 14（**B を先に発見しても ladder も Shop も進まない**） |
| key-free Hint | ソース → 構成 → サブトッピング ①〜④（oregano / onion / sausage / black-olive）。チーズ rung なし、KEY_TOPPING なし、空 rung なし |
| Dex | 章の件数 6/9/10 → 6/10/10（calabresa は第 2 章）。index は末尾（既存の番号は不変） |
| Lunch Rush | 発見前は候補外、**発見後に候補へ入り、cookable**（`unlockCondition` なし） |
| Dinner | mission は target id を明示する定義で、calabresa を含む mission は 0 件。自動では入らない |

### 分類
- **A. MECHANICAL:** unit の件数 / 章 pin 等（31 file / 44 test のうち大半）、E2E の Dex pill `N/25`（26 件）と `rt01` の 25 枚（1 件）。
- **C. AUTHORING:** `scoringV2.noSauceParity` の snapshot、`dinnerResultDetection` の bake window 数、`cookingProfiles`（CUT eligibility と step 表）、reference の placement / quantity / bake。
- **B. SEMANTIC: 2 件（E2E）。** `e2e/discovery-hint5-ladder.spec.ts` の marinara（チーズなし）と quattro-formaggi（キートッピングなし）。seed は「W1 のみを順に遊んだ save」で、Free Cooking の **auto target が次の W1 recipe である**ことを前提にしている。26 件目が入ると auto target が calabresa（key-free）に替わり、期待した rung（`ヒント2: チーズ` / `ヒント3: キートッピング`）が出ない。PR-4a は unit の unique-next を解消したが、**この E2E の前提は未解消**（PR-4a 時は unit のみ再測定）。
  - 解消の経路は 2 つ: (1) 下の判断 1 で「W1 の recipe を先に target にする」を採用すれば、この 2 件は**無修正で通る見込み**、(2) 判断に依らず、E2E の seed を Dex カード経由（pin）にする小さな test-only PR。
- **Gate 判定:** remaining semantic = 2 → **PR-4b は NO-GO のまま**（semantic = 0 の条件を満たさない）。

## B. 判断が要る項目（現在の挙動 / 選択肢 / player-visible / 実装影響）

### 1. pool > 1 の auto-target
- **現在:** `compareHintCandidates`（key step → 材料の種類数 → 宣言順）。step 12 以降、calabresa（5 種）が portuguesa（6 種）より先で、**発見するまで auto target に居続ける**。
- **(a) 現行のまま:** ヒントは branching recipe に引かれる。W1 の進行を進めたいプレイヤーは Dex カードで選ぶ必要。実装 0。E2E 2 件は seed の pin が要る。
- **(b) credited（W1）を先に:** ヒントは常に ladder を進める recipe を指す。branching recipe は Dex カード / 自由試作で発見。実装: `compareHintCandidates` に credit 項を足す（小）、既存 E2E は無修正で通る見込み。ただし「ヒントは進行の方向を教える」ので branching の発見は自力寄りになる。
- **(c) pool > 1 では auto target を出さず、カード選択を促す:** 名前は出さない。実装: 中（Hint sheet の空状態に新種別）。
- **(d) 交互 / 無作為:** 決定性を失うので非推奨。

### 2. Dex 🎨 カード
- **現在:** DISCOVERABLE のカードに「今の材料で作れるかも」と「💡 ヒントを見る」。step 12 では 🎨 が 2 枚になる（名前は出ない）。
- **(a) 現行（2 枚とも同じ見た目）:** 「どちらが ladder の recipe か」は分からない。実装 0。
- **(b) non-credit を区別して見せる:** branching と分かってしまい、発見の驚きが減る。実装: 中。
- **(c) 🎨 は 1 枚だけ（credited）:** branching は完全に自力。実装: 小〜中。

### 3. Lunch Rush への参加
- **現在:** 発見後に候補へ入る（13 件目）。ranking の ruleset は不変、注文の分布に 1 件増える。order の台詞が必要。
- **(a) 参加:** 発見した recipe は全部使える。実装: order 1 件。
- **(b) 除外:** Rush の分布は W1 のまま。実装: flag 1 つ + 経路。
- Dinner は今は影響なし（mission が target を明示）。calabresa を含めるかは別の authoring 判断。

### 4. チーズなし
- **現在:** 材料にチーズなし（PIZZA DB の evidence）。Hint はチーズ rung が出ない（rung の欠落自体が情報、OD-D3-21 で許容）。cooking の step は DOUGH / SAUCE / TOPPING（CHEESE なし）。
- **(a) チーズなしを維持（evidence どおり）:** 上のとおり。matcher の identity は一意。
- **(b) mozzarella を足す:** evidence から外れ、identity が変わり、key-free の根拠（OD-D3-21 の検証目的）を失う。**非推奨**。

### 5. quantity
- **事実:** pack = 10 × k、k = その材料の既存の最大 minCount（sausage 3 / onion 4 / black-olive 2 / oregano 2）。これを**超える量は他 recipe の pack を変える**。reference の piece は 8 slot の ring 以内。
- **選択肢:** 各材料を k 以下で決める（例: ソース 1 + 各 1〜2）。合計 piece が少ないほど Completion Gate の partial-quantity で「足りない」判定が出にくい。**値は Owner の判断**（placeholder は採用しない）。

### 6. bake
- **事実（既存の tomato 系）:** 45–65（marinara）〜 62–82。mozzarella 系の多数は 58–78 / 60–80、puttanesca は 50–70。
- **選択肢:** 既存帯のどれに寄せるか、または専用の窓。**値は Owner の判断**。bake の窓は INCOMPLETE の助言に出さない（OD-D3-23）ので、窓が狭いほど「正しい構成なのに登録されない」失敗が説明なしで増える（known consequence）。

### 7. placement
- **事実:** reference の位置は、過去の recipe では「設計案 → 人間 review → 承認された数値をそのまま実装」で決めてきた（ring 配置、min gap、tolerance 8 / 22）。型では強制されない（test で強制）。
- **選択肢:** 実装側が候補を出し Owner が承認（推奨）、または Owner が数値を指定。**placeholder の ring 配置は採用しない**。

### 8. baseRewardPitz
- **現在:** 全 recipe 100（品質の倍率で変わる。初回発見に +50）。
- **(a) 100:** 他と同じ。W1 の経済は不変。
- **(b) 低く / 高く:** non-credit なので W1 の経済には影響しないが、Rush / FREE の Pitz に出る。

### 9. CUT eligibility / 薄い生地
- **現在:** dry-run では CUT **対象外**（`CUT_ELIGIBLE_RECIPE_IDS` に未追加）。evidence は「薄めの生地」= standard / thin / round / open-round。W1 の規則（標準の丸い生地の evidence）に従うなら対象。
- **(a) 対象にする:** 同系統（portuguesa 等）と体験が揃う。1 行だが `cookingProfiles.ts` は **#295（open）と衝突**（PR-4b の最後の別 commit、#295 の状況次第）。tab 数は 5。
- **(b) 対象外:** 衝突なし。CUT が無い recipe になる（new-haven-apizza の前例あり）。
- **(c) 保留:** PR-4b では触らず、#295 の後で別 PR。

## C. PR-4b の前提（現状）
1. B の E2E 2 件の解消（判断 1 の採用、または test-only の pin 修正）。
2. 判断 1〜9（特に 5〜7 は値の確定）。
3. その後に再 dry-run（semantic = 0 を確認）。
