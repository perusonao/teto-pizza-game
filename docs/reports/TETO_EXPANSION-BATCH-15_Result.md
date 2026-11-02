# Expansion Batch 15 — Result Report（nigerian-suya-pizza）

Status: **実装・自動検証・Chromium E2E・HV 動画（390×844）まで完了。Owner の承認と iPhone Safari 実機 HV の前は merge しない。共有 Preview・Production は更新していない。**
Issue #728 / branch `claude/expansion-batch-15-nigerian-suya` / 基準 `main` `cfbb083`（#725）。`PROJECT_HANDOFF.md` は変更していない（Owner 指示）。
調査資料（別 branch `claude/teto-pizza-recipe-research-pllftj`）: `TETO_EXPANSION-NEXT-BATCH-15_Research_2026-11-02.md` / `TETO_EXPANSION-BATCH-15_Spec_Result.md` / `TETO_EXPANSION-BATCH-15_Verification_Result.md`。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達できず（接続不可）、未確認。** 根拠は 172 matrix の行 `nigerian-suya-pizza-pizzadb-p5`（比較表 p5、中継 2026-09-22、独立再取得なし、corroboration 0）のみ: 牛肉 / 玉ねぎ / ピーマン / モッツァレラ、ソース欄「その他」（`BASE_SAUCE_UNSPECIFIED`、matrix は `BLOCKED_PRODUCT_DECISION` のまま）。次は **すべて GAMEPLAY ASSUMPTION / CALIBRATION（原典の事実ではない）**:

- 個数 mozzarella 2 / beef 3 / green-pepper 1 / onion 2（非ソース 8 ピース = 8 スロットのリング。Owner 暫定承認）、焼成窓 58–78（汎用窓。Owner 暫定承認）、名称の説明文、Reference の座標、注文セリフ。
- **全食材を焼成前（TOPPING）に置く**（原典に投入タイミングの記載なし。Owner 仮承認）。
- **スヤのスパイスは食材欄に無いのでモデル化していない。存在しない工程（スパイス・下ごしらえ・炙り・蒸し・後乗せ）は追加していない**（テストで固定）。
- **NO_SAUCE は suya 限定の Owner 例外（2026-11-02）。** 「ソース欄 = その他 → NO_SAUCE」という一般則ではない。caponata・tsukimi（HOLD）、pesto-genovese（名称調査待ち）、goulash・ume-shiso 等は出荷しておらず、その旨もテストで固定した。

## 1. 内容

| 項目 | 内容 |
|---|---|
| レシピ | `nigerian-suya-pizza` ナイジェリアンスヤピザ（evidence `nigerian-suya-pizza-pizzadb-p5`）。mozzarella 2 / beef 3 / green-pepper 1 / onion 2。SAUCE 工程なし（`RECIPE_SAUCE_PROFILES = null`）。`ladderCredit:false`、`lunchRush:false`、key-free Hint（永続）、**CUT なし**（許可リスト不変）、bake 58–78、`baseRewardPitz` 100 |
| 新食材・新調理法・ladder step | **なし。** ingredients 95・ladder 73 step は不変。beef は ordinary step 58（rendang の唯一の素材）、green-pepper は 32、onion は 12 |
| Reference | jamaican と同じ配分（2/3/1/2）の 8 点リング（RT-01）を `requiredIngredients` の順に連続割当 |
| 触れていない | 採点・経済・保存形式（schema v2）・Production スイッチ・`lateCatalog.ts`・`ingredients.ts`・UI・炙り（#724/#727）・蒸す（#726）・`PROJECT_HANDOFF.md` |

## 2. 影響（Owner が見るべき点）

- **件数**: recipes 86（Pinsa gate 開）/ 85、credited 76（不変）、ingredients 95、toppings 68、ladder steps 73（不変）、第 4 章 49（Pinsa 開）/ 48。Lunch Rush のプール 25 は不変（opt-out は 52 件）。
- **step 58 は 2 レシピ同時（rendang + suya）**。
- **Research（Owner 承認済みの変更）**: beef のコホートが {nigerian-suya-pizza, rendang-pizza} になり、**suya = `？？？ピザ A（牛肉）`、rendang = `？？？ピザ B（牛肉）`**（rendang は従来 `？？？ピザ（牛肉）`）。A / B は id のハッシュ順。**全 ladder prefix で走査して、文字が変わる既存レシピは rendang のみ**（`acceptedLetterShifts: { "rendang-pizza": "-->B" }`）。ラベルは保存されない導出値。rendang を発見済みなら rendang のエントリ（と文字）は出ず、suya は A のまま。
- **「おしい」・Hint（step 58 の実プール全体で測定）**: 後述 §4。
- **保存互換**: schema v2 のまま、新 id の追加のみ（`persistence.batch15.test.ts`、rendang の Dex エントリは byte 同一）。
- **Hint 5.0**: `hint5.ladders55.json` は **+202 行・削除 0（挿入のみ）**、`hint5.alphaFamilyOnly.json` は +1 行。既存エントリは byte 同一。

## 3. 既知失敗 23 件の解消（既存 assertion を無条件に緩めていない）

事前の scratch 検証（Verification Result §4.2）で出た 23 件を、次のとおり解消した。**privacy / DH4 / Hint 5.0 / 識別系の assertion は 1 つも緩めていない**（それらの gate は無修正で通る）。

| 種別 | 件数 | 対応 |
|---|---|---|
| 件数・一覧の pin（想定どおり） | 13 | `catalogLedger`（85→86、第 4 章 +1）、`lateCatalog.bbq`、`recipes.test`（2）、`lunchRush.exclusion`（opt-out 一覧）、`progression.test`、`discoveryProgressionModel`（非 credit 一覧、multi-recipe の step 58 を late OFF でも含める）、`discoveryExpansion2.wave2`、`researchLabels.batch8a`、`cookingProfiles`（3: CUT 非適格一覧・step 一覧・id 集合）、`hint5Ladder.baseCompat`（key-free 母集団 59→60、cheese のみ 21→22）。いずれも「一覧に 1 件足す・数を 1 つ増やす」だけで、検査の内容は同じ |
| golden（生成物） | 2 | 再生成。差分は挿入のみ（§2） |
| batch manifest / validator | 5 | `B15_BATCH` を追加し、B10–B14 の `followedBy` に suya を追記。**B15 の整合テストを新規追加**（追記位置、ladder append-only、非 credit、`acceptedLetterShifts`） |
| 承認例外（B14 の moussaka と同形） | 2 | `discoveryCatalog.test`: `BATCH15_PHASE2_BLOCKED_OWNER_APPROVED = ["nigerian-suya-pizza"]`、`matcher.test`: `ownerApproved.add("nigerian-suya-pizza-pizzadb-p5")`。**suya の 1 件だけ**（他の BLOCKED 行は従来どおり「出荷されていないこと」を検査） |
| 実質的な契約変更 | 1 | `researchCohortLetter.batch10.test`: 「Batch 10 の recipe は誰も文字を持たない」という B10 時点の不変条件を、**後続の suya を除いたカタログで評価**するよう `ORDINARY` に 1 件のフィルタを足した（理由をコメントに明記）。B15 の変更そのものは `expansionBatch15.test.ts`（before / after・他レシピ不変）と `acceptedLetterShifts` で厳密に固定。それ以外は除外していない |

## 4. suya 限定の例外理由と差別化（Owner 承認）

- **Jaccard 0.4 未満の全体基準は変更していない。** suya は rendang と 0.60（beef / mozzarella / onion が共通、ソースの有無が違う）、tandoori-paneer と 0.50 で、0.4 以上の近傍はこの 2 件だけ（`expansionBatch15.test.ts` で名前つきで固定。ほかのレシピが 0.4 以上になれば失敗する）。
- テストで固定した構造的保証: **同一集合なし・部分集合なし・上位集合なし**（late catalog を含む全 RECIPES に対して）。identity にはソースが含まれ、rendang は curry-ketchup を塗る／suya は塗らない。rendang の pizza（curry-ketchup、ピーマンなし）は suya に奪われず、curry-ketchup + ピーマンは ORIGINAL。
- **step 58 時点の実プールでの「おしい」測定**（`expansionBatch15.step58.test.ts`）:
  - 実プール: 「earlier の key レシピだけ発見済み」の場合 11 → 12 件（rendang・suya 以外の未発見の非 credit 等がすでに makeable で、pool はもともと開いている）。「他を全部発見済み」の場合 {rendang} → {rendang, suya}。
  - Hint target: 前者は変化なし（OPEN_POOL のまま）。後者は従来「rendang を自動ターゲット」だったのが OPEN_POOL になる（他の multi-recipe step 32 / 62 / 66 と同じ。Research 対象を自分で選べば従来どおり hint を得られ、結果は recipe 名を含まない）。
  - 「おしい」: ピーマンを含む試作などで分類が変わるが、**変わった試作は全て strictly 近づく（または suya そのもの＝発見）。以前から一致していた試作が崩れることはない**。rendang の近傍（ソースなし・tomato・curry など 6 パターン）は前後で完全一致。結果にはレシピ名・食材名を含まない。
  - Research 表示: 他のエントリは不変（rendang B・suya A のみ）。

## 5. 検証（実行 HEAD と結果）

| 検証 | 結果 | 備考 |
|---|---|---|
| 全 Vitest（Pinsa ON） | **11,089 passed・0 failed**（13 skipped / 2 todo、593 files） | 本セッション、コミット `df6ce2b0` のソース（以降の変更は docs とスクリーンショットのみ） |
| 全 Vitest（Pinsa OFF、`TETO_PINSA_OFF=1`） | **11,081 passed・0 failed**（12 skipped / 2 todo） | 本セッション |
| `tsc -b` | エラーなし | |
| `oxlint` | exit 0（警告は変更前から存在するもののみ、新規 0） | |
| `npm run build` | 成功 | |
| Chromium E2E `e2e/b15.spec.ts`（390×844 / 360×800） | **各 2/2 passed（計 4/4）** | Shop NEW（牛肉）→ 購入 → Research（漏えいなし、`？？？ピザ A（牛肉）`）→ ソースなし → モッツァレラ → 具材 → 焼成 → NEW DISCOVERY → 図鑑（schema v2、横スクロールなし、console error なし）。もう 1 本: rendang 未発見で Research に A / B の 2 エントリ（漏えいなし）。本環境は Playwright 既定の chromium の版が合わないため、一時的な config（未コミット）で `/opt/pw-browsers/chromium` を使用 |
| WebKit E2E / CI | **未実施**（PR 作成後の CI は Owner の判断で見る。不要な再実行はしない） | |
| iPhone 実機 Safari | **未実施**（Owner の HV） | |

## 6. Visual HV 証跡（390×844 / 360×800）

- 動画（390×844、mp4、リポジトリには入れず Owner へ直接提出済み）: 通し再生（約 24 秒）と Research A / B（約 7 秒）。
- スクリーンショット: `docs/reports/screenshots/b15/`（新規レシピのため before なし）— Shop NEW、Research エントリ、ソース工程（ソースなし）、トレイ・盛り付け、NEW RECIPE、図鑑、Research A / B（各 390×844 / 360×800）。
- 実機（iPhone Safari）で Owner が確認する点: ① 牛肉（`beef-slices`）が玉ねぎ・ピーマン・モッツァレラと見分けられるか ② green-pepper のトレイ絵文字が赤い唐辛子に見える既知の件（B12 HV の指摘。既存食材の描画で本 PR では変更しない）③ 8 スロットのリングに収まるか ④ ソース工程が「選ばずに次へ」で進められること ⑤ Research A / B のラベルが匿名のままか ⑥ 横スクロールなし。

## 7. Owner に必要な確認事項

1. **iPhone Safari 実機 HV** と merge 可否（HV の結果は Owner の言葉で記録する）。
2. 共有 Preview の更新（Owner 承認が前提。今回は更新していない）。
3. **rendang の Research ラベル B 化を、既存プレイヤー（beef 購入済み・rendang 未発見）に見える変更として確認済みか**（Owner 承認済み。HV で目視確認）。
4. step 58 の pool が、「他を全部発見済み」のプレイヤーで 1 → 2 になり、rendang の自動ターゲットが OPEN_POOL になること（§4）。
5. 個数・焼成窓・説明文・注文セリフ（「牛肉とピーマンののったソースなしのピザ、おいしそう！食べてみたいな！」）は暫定。HV 後に調整するか。
6. 原典確認: pizzadb.jp をセッションのネットワーク許可に追加して個別ページを確認するか（現状は未確認のまま）。
7. #706 / #707 / #708 が merge 済みなのに open のまま、`lateCatalog.ts` のコメント（「Production は false」）と値（`true`）の食い違い、`PROJECT_HANDOFF.md` の B13 / B14 の記述が pending のまま（Owner 指示により今回は未変更）。

## 8. 実施しなかったこと

`PROJECT_HANDOFF.md`・`ingredients.ts`・UI・`lateCatalog.ts`・保存仕様・ladder の変更、新食材・新調理法・新 step の追加、炙り（#724/#727）・蒸す（#726）への干渉、Production・共有 Preview の更新、merge、不要な CI 再実行、Monitor 作成、pizzadb.jp の取得（到達不可）。
