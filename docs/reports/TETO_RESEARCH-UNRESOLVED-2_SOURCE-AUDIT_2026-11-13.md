# Research 未解消 2 品 — 原典照合と Owner 決定表

Date: 2026-11-13

Base: `main` `81974d02`

Scope: docs-only / identity 未確定 / 実装 HOLD

## 1. 結論

`jerusalem-mixed-grill-pizza` と `mentaiko-mochi-pizza` は、原典により名称・生地・主要具材までは確認できた。しかし、前者の `Other` ソースをゲーム内の具体的な sauce ID または `NO_SAUCE` に変換する根拠と、後者の `White sauce` を既存 sauce ID に変換する根拠はない。したがって両 recipe identity は未確定のまま維持し、Owner 決定前の実装を HOLD とする。

この文書は候補を比較するための判断材料であり、recipe ID、ingredient ID、family、工程、個数を承認しない。

## 2. 証拠の扱い

- **原典確認**: PIZZA DB の recipe/tag ページに明記された値。
- **補助確認**: 店舗メニュー等に存在する一般的な実例。PIZZA DB 行の identity を上書きしない。
- **推論**: ゲーム内既存データとの比較。Owner 決定の代用にしない。
- 取得日はいずれも 2026-11-13。ページが将来更新され得るため、採用時には再取得する。

## 3. `jerusalem-mixed-grill-pizza`

### 3.1 原典確認

PIZZA DB の英語 recipe ページは次を明記する。

| Field | Source value |
|---|---|
| Name | Jerusalem Mixed Grill Pizza |
| Origin | Israel / Jerusalem |
| Dough | Thin crust |
| Sauce style | Other |
| Flavor | Spicy |
| Toppings | chicken, onion, cumin, parsley |

Source: https://pizzadb.jp/en/pizzas/jerusalem-mixed-grill/

日本語の country/tag ページも鶏肉、玉ねぎ、クミン、パセリと、メオラヴ由来であることを相互確認する。

- https://pizzadb.jp/countries/israel/
- https://pizzadb.jp/toppings/cumin/

### 3.2 未確認事項

- `Other` が sauce を塗ることを意味するのか、肉の下味・油・スパイスだけを意味するのかは原典にない。
- tomato / tahini / olive-oil / `NO_SAUCE` のいずれも原典から確定できない。
- cheese は原典の topping 一覧にない。しかし「記載なし」をゲーム上の `noCheese` または別食材の確定根拠にはしない。
- turmeric はページ内の Teto note に調理助言として現れるが、topping list にはない。ingredient identity に追加しない。

### 3.3 ゲーム側の判断材料

- `cumin` は既存 staged。新規食材として扱わない。
- 現行 preflight は sauce/cheese がないため `NO_SAUCE_DECISION` と `TQ1D_G7_CHEESE_FIRST` を報告している。
- 原典忠実度が最も高い状態は「specific sauce 未確認」。`NO_SAUCE` は原典の翻訳ではなく明示的な GAMEPLAY 決定になる。

## 4. `mentaiko-mochi-pizza`

### 4.1 原典確認

PIZZA DB の recipe index/recommend と mentaiko/mochi tag ページを合わせると次を確認できる。各行の出典を分け、tag ページだけから dough / sauce を導いたものではない。

| Field | Source value | Source page |
|---|---|---|
| Display concept | 和風明太子もちピザ | mentaiko / mochi tag pages |
| Origin | Japan / various regions | mentaiko / mochi tag pages |
| Dough | thin | recipe index/recommend listing |
| Sauce style | White sauce | recipe index/recommend listing |
| Ingredients | mentaiko, mochi, mayo, nori, shiso | mentaiko / mochi tag pages |
| Character | spicy cod roe + sliced mochi; nori and shiso finish | mentaiko / mochi tag pages |

Sources:

- https://pizzadb.jp/toppings/mentaiko/
- https://pizzadb.jp/toppings/mochi/
- https://pizzadb.jp/en/recommend/

補助例として、PIZZA LITTLE PARTY の英語メニューは `Mentaiko and Mochi Pizza` を `mayo sauce` 欄に掲載する。これは mayo-base の実在例だが、PIZZA DB の `White sauce` を mayo と同一視する根拠にはしない。

Source: https://www.litopa.com/wp-content/themes/ltp/pdf/englishmenu202509.pdf (menu table, p.1)

### 4.2 `mentaiko` と既存 `cod-roe` の ID 判断材料

| Option | Evidence / advantage | Blocking risk |
|---|---|---|
| A. `mentaiko` を新規 ID | 原典は辛子明太子を明示。既存 `cod-roe`（表示「たらこ」）との辛味 identity を保持できる | 170 食材固定目標に対する追加承認が必要。未承認では登録禁止 |
| B. 既存 `cod-roe` に統合 | ID 増加なし、魚卵の見た目・familyを再利用できる | `tarako-cream-pizza` の非辛味「たらこ」と意味が衝突し、原典の辛子明太子を失う |
| C. recipe を保留 | identity 誤確定と170超過を防ぐ | recipe は未出荷のまま |

監査上の結論は **C（Owner 決定まで保留）**。A/Bのいずれもこの文書では採用しない。特に `cod-roe` 再利用を「同じ魚卵だから」と推測確定してはならない。

### 4.3 `mochi` family 適合性

意味上、mochi は肉・魚介・野菜・ハーブ・スパイス・チーズのどれでもない。既存 taxonomy の `other` が最も自然だが、現在の `deductionProduction.gate` は `other` を到達不能としており、survey preflight は `DH4_OTHER_UNREACHABLE` で STOP している。

| Candidate | Semantic fit | Current gameplay fit | Verdict |
|---|---:|---:|---|
| `other` | high | fail (`DH4_OTHER_UNREACHABLE`) | taxonomy/gate のOwner判断なしに採用不可 |
| `spice` | none | reachable | walnut等の例外を機械的に横展開しない |
| `cheese` | none | reachable | 伸びる性質だけで food identity を変えない |
| new family | potentially high | unknown | HOT/taxonomy拡張となるため本PR外 |

結論: 現行 family には意味と到達性を同時に満たす選択肢がない。`mochi` を無理に既存 family へ割り当てず HOLD とする。

### 4.4 その他の未確認事項

- PIZZA DB の `White sauce` を `mayo`、`fresh-cream-sauce`、`fromage-blanc-sauce` のどれに対応させるか。
- mayo が sauce interaction か topping/scatter か。
- mentaiko、nori、shiso の投入時期。PIZZA DB説明は nori/shiso を仕上げとするが、mentaiko の時期は確定しない。
- ingredient counts、bake window、ladder step、Research letter shift。

## 5. Owner 決定表

| Decision | Choices | Audit recommendation | Until decided |
|---|---|---|---|
| OD-RU2-1 Jerusalem base | specific existing sauce / new sauce / explicit `NO_SAUCE` / remain unresolved | remain unresolved; source says only `Other` | implementation HOLD |
| OD-RU2-2 Jerusalem cheese policy | no cheese / add a cheese for gameplay / redesign gate | do not infer from omission | implementation HOLD |
| OD-RU2-3 Mentaiko ID | new `mentaiko` / reuse `cod-roe` / defer recipe | defer; do not collapse spicy mentaiko into tarako silently | ingredient registration prohibited |
| OD-RU2-4 Mentaiko base | mayo / existing white sauce / new white sauce / unresolved | unresolved; source mappings disagree in granularity | implementation HOLD |
| OD-RU2-5 Mochi family | `other` + gate decision / another approved family / new family / defer | `other` is semantically closest, but current gate blocks it | implementation HOLD |
| OD-RU2-6 Finish timing | nori+shiso only / include mentaiko / another staged plan | preserve only the source-backed nori+shiso fact; decide mechanics separately | no process identity |

## 6. Gate

- No ingredient was added; no recipe identity was finalized.
- `src/data/staged/**`, runtime, HOT, #833 claim area, ledger and R2c files are unchanged.
- Both rows remain `BLOCKED_PRODUCT_DECISION` / implementation HOLD.
