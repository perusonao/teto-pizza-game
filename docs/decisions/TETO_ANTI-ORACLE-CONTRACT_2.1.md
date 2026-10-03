# Anti-Oracle Contract 2.1 — RESULT-based Identification（C-1「種類上限つき項目別 ○×」）

Status: **Owner 承認済みの設計 authority（実装前）。** 実装・src/test 変更・Production flag ON は本書では行わない。
Path: `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`
承認日: 2026-10-03（Owner）。根拠・比較・試算: [`docs/reports/TETO_DISCOVERY-3_RESULT-BASED-IDENTIFICATION_Fresh-Design-Audit.md`](../reports/TETO_DISCOVERY-3_RESULT-BASED-IDENTIFICATION_Fresh-Design-Audit.md)
基準: main `6d9d1ced98113dc42d8bd1e0688536f362431f61`（#357 merge 後）。PR #359（旧方式 A の改善）は HEAD `ad48bd6` で **HOLD**（比較対象）。

## 0. この文書の位置づけ

- **Contract 2.0** は repo 内の文書ではなく **Issue #356 §4**（Anti-Oracle Contract 2.0 / INV-1〜INV-7 / OD-I-1〜18）と、実装コメント
  （`src/logic/discovery/researchIdentify.ts`）にのみ存在した。本書が **repo 内に常駐する Contract の authority** になる（Issue 本文は編集しない）。
- 本書は 2.0 のうち **Declaration-first と 1 attempt = 1 tested ingredient を廃止**し、RESULT-based identification に置き換える。
  それ以外の禁止事項（count / distance / similarity / Near・Far / negative 永続化 / matcher を oracle にしない / Notebook schema 不変）は**維持**する。
- 既存 authority との矛盾は §9 に列挙した（fresh audit の結果）。矛盾は**本書の Owner Decision が上書きする点を明示**したうえで解消している。

## 1. Owner Decisions（OD-RB-1〜10）

| ID | 決定 |
|---|---|
| OD-RB-1 | **Research Target の選択は残す**（Dex / Research Entry →「このピザを研究する」）。○× には匿名の対象 recipe が必要。**targetless の Free Cook では ○× を出さない**。 |
| OD-RB-2 | attempt ごとの `researchTest` は**廃止**: 「今回の調査をえらぶ」/ `researchTest` / `researchTestLocked` / `SET_RESEARCH_TEST` / 「調査中：○○」/「今回は食材調査なし」/ 未使用警告 / `BakeUnusedConfirm` / LOCK lifecycle。 |
| OD-RB-3 | 今回の試作で使った **sauce / cheese** は RESULT で**項目別に ○×**。 |
| OD-RB-4 | **topping**: 今回使った「まだ membership が判明していない topping」が **3 種類以内**なら、それぞれ ○×。既に ✓ と判明している ingredient は 3 種類に**数えない**。 |
| OD-RB-5 | 未知 topping が **4 種類以上**なら、個別 membership の ○× は**開示しない**。意味は「一度に調べられるトッピングは 3 種類まで」。これを回避するための事前 selection UI は作らない。 |
| OD-RB-6 | **count correctness を出さない**（「トッピング 3 種類 ○/×」「全部で N 種類 ○/×」等）。STRUCTURE Hint の価値を残す。 |
| OD-RB-7 | **○ は既存 `discoveryHintFacts[targetId]` の `ing:<ingredientId>` として保存**。**× は永続保存しない**（RESULT と session-only Trial Notebook のみ）。save migration なし。 |
| OD-RB-8 | **RESULT で player に実際に開示した ○× だけ**を Notebook feedback に記録する。非開示 membership を Notebook に書いてはいけない。schema は原則不変。 |
| OD-RB-9 | Hint 5.0 の ladder / pricing は変更しない。#360（Hint 重複）は別 Design/Audit Issue のまま。 |
| OD-RB-10 | **K = 3 固定**（27 recipe 専用の動的値ではなく、player-facing な game rule）。53 / 172 recipe で問題が出たら別途 balance audit。 |

## 2. 用語

- **Target `T`**: 有効な Research Target（登録済み Research Entry の匿名ラベル「？？？ピザ ①」）。recipe 名・id は出さない。
- **`canonical(T)`**: `getRecipe(T).requiredIngredients[].ingredientId`（matcher の `RECIPE_DISCOVERY_CATALOG.items` と同じ元データ。新しい membership 表は作らない）。
- **`used(pizza)`**: pizza に実際に置かれた distinct な ingredient id（sauce + topping。`pizzaUsesIngredient` と同じ sanitize 経路）。
- **`known(T)`**: 保存済み `ing:<id>`（`discoveryHintFacts[T]`）∪ 導出済みの S1 unlock fact（`researchEntryViews(...).knownExactIngredientIds` と同一）。
- **カテゴリ**: 既存の `getIngredient(id).category`（`sauce` / `cheese` / `topping`）。新 taxonomy は作らない。
- **未知 topping `U`**: `used(pizza)` の topping のうち `known(T)` に含まれないもの。**種類**で数える（同じ topping を何枚置いても 1）。
- **開示（disclosure）**: RESULT のパネルに ○ または × として実際に表示された項目。

## 3. 開示ルール（RESULT パネル「🧪 今回の試作結果」）

**表示条件**（すべて満たすとき）: feature flag ON ∧ Free Cook round ∧ 有効な Research Target ∧ outcome ∈ {`ORIGINAL`, `AMBIGUOUS`, `INCOMPLETE_MATCH`}。
**出さない**: targetless、`MATCHED`（NEW_DISCOVERY / ALREADY_DISCOVERED、= cross-recipe exact を含む）、FAILED、Lunch Rush / Dinner / 通常の recipe round。

| 行 | 内容 |
|---|---|
| ソース | 使った sauce それぞれに ○（∈ canonical(T)）/ ×。`known(T)` の sauce は ✓ として表示。 |
| チーズ | 使った cheese それぞれに ○ / ×（同上）。 |
| トッピング | `|U| ≤ 3`: `U` の各 topping に ○ / ×、`known(T)` の topping は ✓（数えない）。**`|U| ≥ 4`: 個別 membership を一切表示しない**。コピー案: 「トッピングは一度に3種類まで調べられるよ」（文言は実装前に最終調整可、意味は固定）。 |

- ソース / チーズ行は topping の上限の影響を受けない（カテゴリが小さい: 現 Production で sauce 3 / cheese 4）。
- **表示順**は player 自身の pizza の順序（置いた順 / 種類順）で、`canonical(T)` の順序や catalog の順序を使わない。
- パネルに **○ / × の個数、「全部正解」「あと少し」等の総評、色による総括、count、進捗** を置かない。
- `T` の sauce rung が Hint 5.0 で RESERVED（`isReservedRung`）の場合、ソース行は開示しない（現 Production には存在しない: M2 条件 3）。

## 4. 不変条件（Contract 2.1）

- **INV-D1 Bounded reveal（旧 INV-1 / INV-2 の置換）**: 1 attempt で開示する topping membership は「未知の種類 ≤ 3」。**開示量は載せた材料の数に比例しない**（全部乗せで増えない）。
- **INV-D2 Disclosure = Persist(○) = Notebook**: 保存される ○、Notebook に書かれる行は、RESULT に表示された内容と**完全に一致**する。表示されなかった membership は、保存も記録も、内部状態に残すことも禁止（over-cap の topping は何も保存されない）。
- **INV-D3 Verdict parity（INV-3 の再定義）**: パネルの DOM / 文言 / 保存挙動は、同一の pizza・`known(T)`・`canonical(T)` に対して **ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で byte 同一**。outcome 種別は出力に影響しない。count を出さないので、「全 ○ なのに発見されない」は「欠けている材料」か「実行（量・焼き）の問題」かを区別できない（これが parity の要）。
- **INV-D4 Panel presence は player 自身の入力だけで決まる**: パネル / over-cap の有無は pizza・`known(T)`・outcome の許可集合だけに依存し、`canonical(T)` の中身に依存しない。
- **INV-4（維持）Matcher independence**: membership は `canonical(T)` から計算する。matcher の結果を membership の oracle として使わない（outcome は「表示してよいか」の許可にのみ使う）。
- **INV-5（維持）No class leak by omission**、**INV-6'（改）Persist positive only**: 保存は ○ の `ing:` のみ。× と over-cap は何も保存しない。
- **INV-7'（改）Notebook schema 不変**: 既存の feedback `{kind, textJa}`（`textJa` ≤ 200 字）だけを使う。
- **INV-D5 execution と identity の分離**: ○ / × は membership だけ。量・焼き・配置・ソース量の失敗を ○ / × に反映せず、「× = 足りない」と読める文言を使わない。実行面は既存の recipe 非依存アドバイス（OD-D3-23）に任せる。

## 5. 禁止（維持 + 追加）

維持: correct ingredient count / exact distance / similarity / missing ingredient list / remaining count / untried ingredient membership（= 載せていない材料の判定）/ candidate count / Near・Far / 「全部で N」（STRUCTURE 購入前）/ **negative の永続化** / hidden recipe name・id の表示 / bulk な自動評価（上限を超えた分の判定）。
追加: ○ × の個数・割合・「n 個中 m 個」/ 総評 / 開示量が pizza の大きさで増える設計 / `canonical(T)` の順序の露出 / 非開示 membership の内部保持。
**撤廃（2.0 → 2.1）**: Declaration-first（INV-1）/ 1 bit・1 ingredient（INV-2・OD-I-2・OD-I-7）/ 「全使用食材の一括 membership 判定」「指定していない食材の判定」の禁止 → §3 の上限つき開示に置換。

## 6. Persistence

- ○ → `discoveryHintFacts[T]` に `ing:<id>` を追加（重複なし）。書き込み点は既存の `REGISTER_TO_DEX` の free-cook 非 MATCHED 分岐（exactly-once の phase guard を再利用）。**保存する outcome は ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一**（INV-D3: 保存の有無が outcome で変わると、Research card の ✓ の増減から outcome が分かる）。
- ○ の保存は「開示された ○」に限る（INV-D2）。`known(T)` の ✓ は再保存しない。
- schemaVersion 不変・新 field なし・migration なし。× / over-cap / パネルの状態は session のみ（reload で消える）。
- 旧 `researchTest` / `lastIngredientTest` 系の state は新方式で不要。`lastIngredientTest` は「開示した行のリスト」に置き換える（transient、永続化しない）。

## 7. Trial Notebook

- 既存 schema のまま、`feedback = { kind: "RESEARCH_ROWS", textJa }` に **RESULT で開示した行だけ**を 1 行で記録する（例: `？？？ピザ① ソース:ペスト○ チーズ:モッツァレラ○ トッピング:ham× onion×`）。非開示（over-cap の topping、載せていない材料）は書かない。パネルが出ない attempt は従来どおり `feedback: null`。
- 行は `T` の匿名ラベルを含める（Notebook は fingerprint 単位で、複数の Research Target を試す場合に ○× の対象が分かるため）。retry は既存規則（feedback は最新の表示に置換）。
- 200 字の上限を超える場合は、開示した項目の**末尾から切り詰める**（切り詰めた項目は「開示していない扱い」で、保存側の ○ は INV-D2 により表示された ○ と一致させる）。

## 8. 他機構との関係

- **cross-recipe exact（OD-I-8 維持）**: `T` 中に別 recipe `B` を exact に再現したら `B` は通常どおり DISCOVERED。`T` の ○× パネルも保存も出さない。
- **INCOMPLETE / AMBIGUOUS**: §3 の表示条件に含める。パネルは ORIGINAL と同一（INV-D3）。FAILED は matcher 一致後の話で ORIGINAL には来ない。
- **Hint 5.0**: ladder / 価格 / 順序は不変。○ の `ing:` は既存どおり `hint5Ownership.known` に入り、全て既知の rung は ALREADY_KNOWN / 0 Pitz（OD-I-14）。STRUCTURE（全部で N）と SUB_CLASS は count / 分類を出さないので価値が残る。sauce / cheese / key topping の rung の相対的な価値低下は**承認済みの帰結**（#360 で別途検討）。
- **Research Entry / Dex**: Research Entry は匿名ターゲットとして必須で残る。Dex / 研究カードの「わかっていること ✓」は保存済み ○ の表示になる。
- **progression**: コード変更なし。発見までの attempt 数が減る（監査: 27 recipe 合計 期待 321 → 約 93）ため、**ペース / Pitz 経済の balance audit が別途必要**（本書では決めない）。
- **feature flag**: `RESEARCH_IDENTIFY_ENABLED` を新方式のゲートとして再利用する案（Production default OFF、dev / Preview ON）。**Production ON は別 Gate**で、flag を変更する追加 commit / PR は禁止（OD-I-18 を継承）。

## 9. 既存 authority との矛盾監査（fresh audit）

| # | 既存 authority（場所） | 内容 | Contract 2.1 での扱い |
|---|---|---|---|
| 1 | Issue #356 §4.2 INV-1 / INV-2、§3 OD-I-2 / OD-I-7 / §4.1「全使用食材の一括 membership 判定」「指定していない食材の判定」 | Declaration-first、1 attempt = 1 食材、一括判定禁止 | **撤廃**（OD-RB-2〜5）。上限つき開示（INV-D1）に置換 |
| 2 | Issue #356 OD-I-3 | 指定食材を実際に使用していること | 不要（開示は使用した材料に対してのみ。載せていない材料は判定しない） |
| 3 | Issue #356 OD-I-9 / INV-3 | INCOMPLETE / AMBIGUOUS では識別しない。POSITIVE は plain ORIGINAL のみ | **改**: 3 outcome で同一のパネル・同一の保存（INV-D3）。count を出さないことで「構成が正解」の oracle は復活しない |
| 4 | Issue #356 OD-I-6、§15 Non-Goal「negative の永続化・**session memo**」 | negative を保存しない。session memo も Non-Goal | ×の永続保存は引き続き禁止。**session-only Notebook への × 行の記録は Owner の OD-RB-7 / OD-RB-8 が明示的に上書き**（開示した行に限る） |
| 5 | `src/state/trialRecord.ts` 冒頭、Near/Far Neutralization Phase 1 | Notebook の stored feedback は常に `null` | Near/Far 行を記録しない方針は維持。Research パネルの**開示行**に限り `feedback` を使う（schema の `{kind, textJa}` の範囲内）。実装時に `trialRecord` の「常に null」コメント / テストを更新する |
| 6 | Trial Notebook OD-P3-4 / OD-P3-14 | 「見せた P2 feedback 行そのまま」を持てる。内部 outcome / recipe / hidden 回答は持たない | 整合（開示行のみ、outcome は記録しない） |
| 7 | #346 S3 / S4 Result「attempts add no knowledge」、OD-RX-3、AC6 | 試作は knowledge を作らない（`ing:` は購入のみ） | #356 で限定的に上書き済み。2.1 はその範囲を「RESULT で開示した ○」へ拡張（保存先は同じ `ing:`）。S4 AC6（指定なしの oracle 中立性）は「targetless / パネルなし」で維持 |
| 8 | Hint 5.0 H5-0 OD-H5-U1「no FREE LEAK」、OD-H5-P4-CHEESE「購入前は『なし』と言わない」、OD-H5-P4-SAUCE（RESERVED） | rung は有料。cheese / key の「なし」は購入後のみ。sauce の「なし」は Hint 5.0 の authority ではない | パネルは**明示的に「チーズ：なし」を言わない**（negative の保存もしない）。ただし 4 種のチーズを全て載せて × を見れば「なし」を**推論できる**（unresolved Q-4）。sauce の RESERVED は §3 のとおり除外 |
| 9 | Hint 5.0 OD-H5-E1（価格 sauce 10 / cheese 10 / key 10 / structure 5 / class 5） | 価格不変 | 不変（OD-RB-9）。○ の `ing:` は既存の ALREADY_KNOWN 経路（OD-I-14） |
| 10 | Issue #356 OD-I-8（cross-recipe）/ OD-D3-20・23（INCOMPLETE を ORIGINAL と同一に） | 別 recipe exact は通常 DISCOVERED、INCOMPLETE は ORIGINAL と見分けがつかない | 維持（§8、INV-D3） |
| 11 | #346 S4「Research ORIGINAL の RESULT は near/far を出さない」 | Research round は Near/Far 行なし | 維持。パネルは Near/Far ではない |
| 12 | Issue #356 OD-I-16 | cap / 回数制限 / 課金を入れない | 維持（K は回数制限ではなく**開示量の上限**） |
| 13 | `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` §5.2 | STRUCTURE は「全部で N」のみ。`meta:topping-total` は売らない | 維持（count 非開示、OD-RB-6） |
| 14 | `PROJECT_HANDOFF.md` | #356 / #357 / #358 の記述なし | 変更しない（本 PR は docs の追加のみ。handoff への反映は実装 Gate で行う） |

## 10. 未決の設計論点（実装前に Owner / 実装 Gate で確定）

- **Q-1**: ○ を ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH の**全てで保存**する提案（INV-D3）の最終承認。
- **Q-2**: 「未知」の判定は `known(T)`（保存済み `ing:` + 導出 unlock fact）のみ。過去に × だった topping は未知に戻る（× は保存しないため）。それでよいか。
- **Q-3**: over-cap（未知 ≥ 4）の場合に、ソース / チーズ行は表示する（本書の案）。トッピング行のコピーの最終文言。
- **Q-4**: 4 種のチーズを全て載せて × を見ると「チーズなし」が推論できる件（OD-H5-P4-CHEESE の有料「なし」との整合）。cheese にも上限を設けるか、承認済みの帰結として受け入れるか。
- **Q-5**: Notebook の行に載せる項目の範囲と 200 字の切り詰め規則（§7）。複数 Research Target を行き来する場合の見え方。
- **Q-6**: RESULT パネルの mobile レイアウト（390×844 / 360×800。sauce 最大 3 + cheese 最大 4 + topping + ✓）。折りたたみ / チップ化。
- **Q-7**: Research round のみ `RESEARCH_IDENTIFY_ENABLED` を再利用するか、新 flag にするか。#357 で merge 済みのコード（picker 等、flag OFF）の撤去時期。
- **Q-8**: progression / Pitz 経済の balance audit（発見速度 約 3.5 倍）。
- **Q-9**: Research Target が cookable でなくなった attempt（最後の在庫消費後）でもパネルを出す（#357 AC8 と同様に ownership 基準）こと。
- **Q-10**: PR #359 の扱い（再利用: Slice 1 の Research context 維持 / Slice 5 の発見 CTA 整理 / Layout Contract 更新）。

## 11. 実装 Gate に求めるテスト契約（実装時に固定する）

- **Bounded reveal**: 任意の pizza で、開示される topping membership の数が常に ≤ 3（property test。全 30 材料を載せても topping 行は開示 0）。
- **Parity**: 同一 pizza で ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH のパネル HTML・保存結果・Notebook 行が byte 同一。
- **Disclosure = Persist = Notebook**: 保存された `ing:` と Notebook 行が、表示された ○ / 行と一致。over-cap で何も保存されない。× が save に現れない（save 差分は `ing:` の追加のみ）。
- **known の除外**: `known(T)` の topping は上限に数えられず、✓ として表示。unlock fact も同様。
- **cross-recipe**: `T` 中の別 recipe exact でパネルなし・`T` への保存なし。targetless / MATCHED / FAILED / flag OFF でパネルなし。
- **privacy scan**: DOM / aria / Notebook に hidden recipe 名・id・count・割合・「n 個中」が出ない。
- **回帰**: `INV-4`（matcher 非依存）、Hint 5.0 価格・rung 不変、Trial Notebook schema 不変、Production flag default OFF。
- **mobile**: 390×844 / 360×800 で overflow なし・CTA 到達可能。

## 12. Non-Goals

correct count / distance / similarity / 欠落リスト / 残数 / 候補数 / Near・Far / negative の永続化 / Notebook schema 変更 / Hint 5.0 価格・progression の変更 / 新 taxonomy / save migration / attempt cap・課金 / #355 の修正 / **Production flag ON・Production deploy**。
