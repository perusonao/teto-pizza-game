# M7 POSTBAKE_SAUCE — 焼成後のソース・液体の設計（#780、docs-only・設計のみ）

2026-11-10 更新 / 基準 `main` = `719428e0`。**設計案であり実装承認ではない。** DRIZZLE D1（#579、PR #776）は merge 済みだが、純粋ロジックのみ・未配線・Production OFF。Gesture Lab（PR #746）は本番未接続である。既存成果を**重複実装しない**ことを最優先にした分担を示す。

## 1. 何が M7 か【実測】
候補レシピのうち、**焼成後にソース（`category: "sauce"`）を置く**M7対象は2品である。旧案の buffalo-chicken は2026-11-10 Owner判断で焼成前PAINTに確定し、M7対象から除外する。

| レシピ | 焼成後の材料 | 他に必要な工程 | バッチ |
|---|---|---|---|
| hot-honey-pepperoni | honey（出荷済み・B20-A で焼成前の第 2 ソースとして出荷） | なし。重複ゲート X1（後乗せ軸で分離） | RB-18 |
| detroit-style-pizza | tomato-sauce（出荷済み。生地の上から後がけ） | M1 生地＋M2 天板（PAN_PROFILE） | RB-18 |

現行の制約: 後乗せ（FINISH）は**トッピング専用**（`PLACE_TOPPING` は `category !== "topping"` を拒否、`validateLateCatalog` も同様）。したがってM7対象2品はDRIZZLE D2〜D5なしでは出荷できない。buffalo-chickenは通常の焼成前PAINT経路を使い、M7では「FINISHへ入らない」回帰だけを持つ。

## 2. 既存 DRIZZLE との分担（重複させない）
| 領域 | 担当 | M7 でやること |
|---|---|---|
| 液体の型 `PostBakeLiquid`（別コレクション `postBakeLiquids`、`stage: "post"`）、軌跡の変換・量子化・間引き・タップ代替線、保存向け検証 | **DRIZZLE D1（PR #776）** | **実装しない。** そのまま使う |
| ジェスチャー（線を引く／タップ）と実機 HV | **DRIZZLE Lab（PR #746）** | 実装しない。HV の結果待ち |
| journal・在庫の原子的な消費・採点／識別（OD-DZ-3／5／6）・UI（D2〜D5） | **DRIZZLE（#579、HOLD）** | M7 の前提として**待つ**。D2〜D5 の Owner ゲートが先 |
| 許可リスト `POST_BAKE_LIQUID_INGREDIENT_IDS = ["olive-oil"]` の**拡張** | M7 | 初号機として honey、後続で detroit の tomato-sauce を検討する。buffalo-sauceは追加しない |
| レシピ側の宣言: 要件 `{ ingredientId, applicationPhase: "POST_BAKE" }` が**ソース／液体**のときの扱い（`validateLateCatalog`、Reference、Hint、識別の `late` 軸） | **M7** | 液体の許可リストに載る食材なら、後乗せ要件として許可する検証の緩和（トッピング専用の例外を 1 点追加）。OD-DZ-6（`late` 軸に液体を算入するか）の結果に従う |
| buffalo-chicken回帰 | B22 / M7 | buffalo-sauceは焼成前PAINT。POST_BAKE許可リスト・`postBakeLiquids`・FINISHへ入れない |

## 3. 設計案（DRIZZLE の Owner ゲート通過後）
1. **データ**: `hot-honey-pepperoni` のhoneyを最初のPOST_BAKE液体として宣言する。焼成前ソースと焼成後液体は別コレクション・別工程として持ち、同一ingredient IDが両方に存在しても採点・消費で二重計上しない。
2. **検証**: `validateLateCatalog` と `PLACE_TOPPING` 相当の経路に「許可リスト内の液体なら FINISH で受理」の分岐を追加（DRIZZLE D2 の journal が前提）。
3. **採点／識別**: OD-DZ-5（Reference に液体を持つか）・OD-DZ-6（`late` 軸に液体を算入するか）に従う。M7 は決定を待つだけで、独自に決めない。
4. **Hint 5.0**: ソース段（SAUCE rung）が「焼成前」のみを前提にしている可能性があり、液体を要件に含むと**漏えい判定（DH4）の再測定**が必要【未確認】。
5. **段階**: M7-0 設計 Gate（本書）→ 消費確定境界のOwner判断 → DRIZZLE D2〜D4 → M7-1 honey許可リスト＋検証 → M7-2 hot-honey-pepperoni初号機（1レシピ列車）→ M7-3 detroit-style（M1・M2後）。buffalo-chickenはB22のPAINT回帰のみ。

## 4. 必須テスト設計

### A. 二重適用
- pointer-up再発火、action replay、再confirmで同じ軌跡を二重追加しない。
- 重複liquid IDのreplace／reject規則をOwner決定どおり固定する。
- FINISH確定後の再confirmは同一stateを返す。

### B. 二重在庫消費
- post-bake honeyは`CONFIRM_BAKE`で消費0。
- Ownerが選んだ確定境界でのみ1単位消費し、再dispatch、restore settle、REGISTER、RETRYで追加消費0。
- 在庫不足時は軌跡追加と在庫減算を同じtransactionで拒否する。
- **消費確定境界（DRIZZLE commit時／FINISH confirm時）は実装前Owner判断。決定までreducer接続を開始しない。**

### C. 保存互換性
- 旧`pendingRound` JSON（postBakeLiquidsなし）は`[]`として読み、旧settle結果を変えない。
- 新フィールドはsanitize→JSON→read→settleでingredient、stage、軌跡を保持する。
- 未知liquid、巨大配列、不正座標を例外なしで拒否／縮退し、24点×4本・64KB上限を維持する。

### D. 採点・識別
- post-bake側だけに存在するhoneyがrequired ingredient presenceを満たす。
- pre-bakeとpost-bakeの両方にhoneyがあってもdistinct typeは1。
- Pieces componentへ液体を混入させない。
- 配置採点が未承認ならRecipe presenceのみとし、late identityへの算入はOwner判断まで固定しない。

### E. 工程遷移
- 成功: `BAKE → FINISH → honey DRIZZLE → confirm → CUT/RESULT`。
- failed bakeはFINISHをskipし、FINISH外のDRIZZLE actionはno-op。
- reset/retryで軌跡を消去する。
- buffalo-chickenは`SAUCE(PAINT) → ... → BAKE`で、FINISH液体工程へ入らない。

## 5. 停止条件・影響
- DRIZZLE の D2〜D5 が Owner 承認される前に M7 の実装に入らない（二重実装の防止）。
- 許可リスト拡張はmerge済みD1のテスト更新を伴うため、別PRで行う。
- 触る HOT: `lateCatalog.ts`（検証）、`gameReducer.ts`（FINISH 受理。DRIZZLE D2 と同じ領域で**直列**）。

## 6. Owner 判断
| ID | 論点 | 推奨 |
|---|---|---|
| M7-a | M7 を調理法の追加対象として台帳に維持（本書で設計済み）。実装は DRIZZLE D2〜D5 の後 | 承認（既に台帳に反映済み） |
| M7-b | 液体の許可リストの拡張対象 | honeyを初号機。tomato-sauceはM1・M2後。buffalo-sauceは対象外 |
| M7-c | 「焼成前のbaseソース」と「焼成後の液体」を別概念にするか | 別概念（DRIZZLEの`postBakeLiquids`と整合） |
| M7-d | 在庫消費の確定境界 | **Owner判断必須**: DRIZZLE commit時／FINISH confirm時。決定まで実装停止 |
| M7-e | Recipe scoringとlate identityへの算入 | presenceはRecipeへ、Piecesへは非算入。late identityはOwner判断待ち |
| M7-f | `pendingRound`のoptional fieldとschema | 旧欠落を`[]`として読む互換案。schema version維持可否は実装前確認 |
