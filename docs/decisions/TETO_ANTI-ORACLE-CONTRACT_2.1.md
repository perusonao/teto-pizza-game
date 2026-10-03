# Anti-Oracle Contract 2.1 — RESULT-based Identification（C-1「種類上限つき項目別 ○×」）

Status: **Owner 承認済みの設計 authority（実装前）。** 実装・src/test 変更・Production flag ON は本書では行わない。
Path: `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`
承認日: 2026-10-03（Owner。OD-RB-1〜10）、同日追補（OD-RB-11〜14: Q-1 / Q-2a / Q-3 / Q-4）。
根拠・比較・試算: [`docs/reports/TETO_DISCOVERY-3_RESULT-BASED-IDENTIFICATION_Fresh-Design-Audit.md`](../reports/TETO_DISCOVERY-3_RESULT-BASED-IDENTIFICATION_Fresh-Design-Audit.md)
基準: main `6d9d1ced98113dc42d8bd1e0688536f362431f61`（#357 merge 後）。PR #359（旧方式 A の改善）は HEAD `ad48bd6` で **HOLD**（比較対象）。

## 0. この文書の位置づけ

- **Contract 2.0** は repo 内の文書ではなく **Issue #356 §4**（Anti-Oracle Contract 2.0 / INV-1〜INV-7 / OD-I-1〜18）と、実装コメント
  （`src/logic/discovery/researchIdentify.ts`）にのみ存在した。本書が **repo 内に常駐する Contract の authority** になる（Issue 本文は編集しない）。
- 本書は 2.0 のうち **Declaration-first と 1 attempt = 1 tested ingredient を廃止**し、RESULT-based identification に置き換える。
  それ以外の禁止事項（count / distance / similarity / Near・Far / negative 永続化 / matcher を oracle にしない / Notebook schema 不変）は**維持**する。
- 既存 authority との矛盾は §9 に列挙した（fresh audit の結果）。矛盾は**本書の Owner Decision が上書きする点を明示**したうえで解消している。

## 1. Owner Decisions

| ID | 決定 |
|---|---|
| OD-RB-1 | **Research Target の選択は残す**（Dex / Research Entry →「このピザを研究する」）。○× には匿名の対象 recipe が必要。**targetless の Free Cook では ○× を出さない**。 |
| OD-RB-2 | attempt ごとの `researchTest` は**廃止**: 「今回の調査をえらぶ」/ `researchTest` / `researchTestLocked` / `SET_RESEARCH_TEST` / 「調査中：○○」/「今回は食材調査なし」/ 未使用警告 / `BakeUnusedConfirm` / LOCK lifecycle。 |
| OD-RB-3 | 今回の試作で使った **sauce / cheese は、使用したもの全件**を RESULT で項目別に ○×（OD-RB-12 で確定、bounded reveal なし）。 |
| OD-RB-4 | **topping**: 今回使った「まだ membership が判明していない topping」が **3 種類以内**なら、それぞれ ○×。既に ✓ と判明している ingredient は 3 種類に**数えない**。 |
| OD-RB-5 | 未知 topping が **4 種類以上**なら、個別 membership の ○× は**開示しない**。意味は「一度に調べられるトッピングは 3 種類まで」。これを回避するための事前 selection UI は作らない。 |
| OD-RB-6 | **count correctness を出さない**（「トッピング 3 種類 ○/×」「全部で N 種類 ○/×」等）。STRUCTURE Hint の価値を残す。 |
| OD-RB-7 | **○ は既存 `discoveryHintFacts[targetId]` の `ing:<ingredientId>` として保存**。**× は永続保存しない**（RESULT と session-only Trial Notebook のみ）。save migration なし。 |
| OD-RB-8 | **RESULT で player に実際に開示した ○× だけ**を Notebook feedback に記録する。非開示 membership を Notebook に書いてはいけない。schema は原則不変。 |
| OD-RB-9 | Hint 5.0 の ladder / pricing は変更しない。#360（Hint 重複）は別 Design/Audit Issue のまま。 |
| OD-RB-10 | **K = 3 固定**（27 recipe 専用の動的値ではなく、player-facing な game rule）。53 / 172 recipe で問題が出たら別途 balance audit。 |
| **OD-RB-11**（Q-1） | **ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH の 3 outcome すべてで**、player に実際に表示した positive ○ を `ing:<id>` として保存する。ingredient membership と料理品質 / matcher outcome は**独立した情報**として扱う（INV-D6）。 |
| **OD-RB-12**（Q-2a） | sauce / cheese は**使用したもの全件**に ○×（bounded reveal を設けない）。理由: 上限つき案でも 27 recipe 合計の差は約 7 attempt、「チーズなし」の推論は最大 1 attempt 遅れるだけで、追加ルールの UX コストの方が大きい。RESULT は**「チーズなし」「ソースなし」と直接表示しない**（§3、INV-D7）。「なし」が推論できることは §10 の **accepted consequence**。SAUCE / CHEESE Hint の価値低下は本 Contract の実装では解決せず **#360 の scope** に残す。 |
| **OD-RB-13**（Q-3） | Notebook には RESULT で実際に開示した ○× の**判定だけ**を記録する: ○ は記録、× は記録、**既知 ✓ は今回の判定ではないので記録しない**、over-cap で非開示の topping・hidden membership は記録しない。形式は既存 schema 内で deterministic（§7）。truncate はしない。 |
| **OD-RB-14**（Q-4） | 複数の Research Target の attempt を Notebook 上で区別できるようにする。識別に使ってよいのは**すでに公開されている情報だけ**（Research Entry 番号 + unlock fact の ingredient 名）。hidden recipe identity は使用禁止。保存時の表示文字列をそのまま使い、後から再計算しない（§7）。 |

## 2. 用語

- **Target `T`**: 有効な Research Target（登録済み Research Entry の匿名ラベル「？？？ピザ ①」）。recipe 名・id は出さない。
- **`canonical(T)`**: `getRecipe(T).requiredIngredients[].ingredientId`（matcher の `RECIPE_DISCOVERY_CATALOG.items` と同じ元データ。新しい membership 表は作らない）。
- **`used(pizza)`**: pizza に実際に置かれた distinct な ingredient id（sauce + topping。`pizzaUsesIngredient` と同じ sanitize 経路）。
- **`known(T)`**: 保存済み `ing:<id>`（`discoveryHintFacts[T]`）∪ 導出済みの S1 unlock fact（`researchEntryViews(...).knownExactIngredientIds` と同一）。
- **カテゴリ**: 既存の `getIngredient(id).category`（`sauce` / `cheese` / `topping`）。新 taxonomy は作らない。
- **未知 topping `U`**: `used(pizza)` の topping のうち `known(T)` に含まれないもの。**種類**で数える（同じ topping を何枚置いても 1）。
- **開示（disclosure）**: RESULT のパネルに ○ または × として実際に表示された項目。**判定（judgment）** = 開示された ○ / ×（既知 ✓ は判定ではない）。

## 3. 開示ルール（RESULT パネル「🧪 今回の試作結果」）

**表示条件**（すべて満たすとき）: feature flag ON ∧ Free Cook round ∧ 有効な Research Target ∧ outcome ∈ {`ORIGINAL`, `AMBIGUOUS`, `INCOMPLETE_MATCH`}。
**出さない**: targetless、`MATCHED`（NEW_DISCOVERY / ALREADY_DISCOVERED、= cross-recipe exact を含む）、FAILED、Lunch Rush / Dinner / 通常の recipe round。

| 行 | 内容 |
|---|---|
| ソース | **使った sauce の全件**に ○（∈ canonical(T)）/ ×。上限なし。`known(T)` の sauce は ✓。 |
| チーズ | **使った cheese の全件**に ○ / ×。上限なし。`known(T)` の cheese は ✓。 |
| トッピング | `|U| ≤ 3`: `U` の各 topping に ○ / ×、`known(T)` の topping は ✓（数えない）。**`|U| ≥ 4`: 個別 membership を一切表示しない**。コピー案: 「トッピングは一度に3種類まで調べられるよ」（文言は実装前に最終調整可、意味は固定）。 |

- **直接の「なし」表示の禁止（OD-RB-12）**: パネルは player が実際に試した ingredient についてだけ「モッツァレラ ×」「パルミジャーノ ×」のように表示する。**「チーズなし」「ソースなし」「〜は使わない」を直接書かない**（行ごと・文言ごと）。player 自身が結果から「チーズなしでは？」と推理することは許容する（§10）。
- **表示順**は player 自身の pizza の順序（置いた順 / 種類順）で、`canonical(T)` の順序や catalog の順序を使わない。
- パネルに **○ / × の個数、「全部正解」「あと少し」等の総評、色による総括、count、進捗** を置かない。
- `T` の sauce rung が Hint 5.0 で RESERVED（`isReservedRung`）の場合、ソース行は開示しない（現 Production には存在しない: M2 条件 3）。

## 4. 不変条件（Contract 2.1）

- **INV-D1 Bounded reveal（旧 INV-1 / INV-2 の置換）**: 1 attempt で開示する **topping** membership は「未知の種類 ≤ 3」。載せた topping の数で開示量が増えない（全部乗せで増えない）。sauce / cheese はカテゴリが小さい（現 Production: sauce 3 / cheese 4）ため上限なし（OD-RB-12）。
- **INV-D2 Disclosure = Persist(○) = Notebook**: 保存される ○、Notebook に書かれる判定は、RESULT に表示された内容と**完全に一致**する。表示されなかった membership は、保存も記録も、内部状態に残すことも禁止（over-cap の topping は何も保存されない）。
- **INV-D3 Verdict parity（INV-3 の再定義）**: パネルの DOM / 文言 / 保存挙動は、同一の pizza・`known(T)`・`canonical(T)` に対して **ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で byte 同一**。outcome 種別は出力に影響しない。count を出さないので、「全 ○ なのに発見されない」は「欠けている材料」か「実行（量・焼き）の問題」かを区別できない（これが parity の要）。
- **INV-D4 Panel presence は player 自身の入力だけで決まる**: パネル / over-cap の有無は pizza・`known(T)`・outcome の許可集合だけに依存し、`canonical(T)` の中身に依存しない。
- **INV-4（維持）Matcher independence**: membership は `canonical(T)` から計算する。matcher の結果を membership の oracle として使わない（outcome は「表示してよいか」の許可にのみ使う）。
- **INV-5（維持）No class leak by omission**、**INV-6'（改）Persist positive only**: 保存は ○ の `ing:` のみ。× と over-cap は何も保存しない。
- **INV-7'（改）Notebook schema 不変**: 既存の feedback `{kind, textJa}`（`textJa` ≤ 200 字）だけを使う。
- **INV-D5 execution と identity の分離**: ○ / × は membership だけ。量・焼き・配置・ソース量の失敗を ○ / × に反映せず、「× = 足りない」と読める文言を使わない。実行面は既存の recipe 非依存アドバイス（OD-D3-23）に任せる。
- **INV-D6（OD-RB-11）Membership is independent of quality and outcome**: *membership knowledge must be independent of cooking quality and matcher outcome.* ○ の判定・表示・保存は、料理の品質（量・焼き・配置・ソース量）と matcher outcome の種別（ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH）に依存しない。outcome は「パネルを出してよい場面か」の許可（MATCHED / FAILED / targetless を除外）にのみ使い、○ の値や保存の有無を変えない。
- **INV-D7（OD-RB-12）No direct "none" disclosure**: パネル・aria・Notebook・保存のどこにも「チーズなし」「ソースなし」に相当する直接表現を置かない。「なし」は player 自身の試行結果からの推論としてのみ成立する（accepted consequence、§10）。

## 5. 禁止（維持 + 追加）

維持: correct ingredient count / exact distance / similarity / missing ingredient list / remaining count / untried ingredient membership（= 載せていない材料の判定）/ candidate count / Near・Far / 「全部で N」（STRUCTURE 購入前）/ **negative の永続化** / hidden recipe name・id の表示 / bulk な自動評価（topping の上限を超えた分の判定）。
追加: ○ × の個数・割合・「n 個中 m 個」/ 総評 / topping の開示量が pizza の大きさで増える設計 / `canonical(T)` の順序の露出 / 非開示 membership の内部保持 / 「なし」の直接表示（INV-D7）。
**撤廃（2.0 → 2.1）**: Declaration-first（INV-1）/ 1 bit・1 ingredient（INV-2・OD-I-2・OD-I-7）/ 「全使用食材の一括 membership 判定」「指定していない食材の判定」の禁止 → §3 の開示（topping は上限つき、sauce / cheese は全件）に置換。

## 6. Persistence（Q-1 確定）

- ○ → `discoveryHintFacts[T]` に `ing:<id>` を追加（重複なし）。書き込み点は既存の `REGISTER_TO_DEX` の free-cook 非 MATCHED 分岐（exactly-once の phase guard を再利用）。**保存する outcome は ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH の 3 つすべてで同一**（INV-D3 / INV-D6: 保存の有無が outcome で変わると、Research card の ✓ の増減から outcome が分かる。また membership は料理品質と独立）。
- ○ の保存は「開示された ○」に限る（INV-D2）。sauce / cheese 行の ○ も含む。`known(T)` の ✓ は再保存しない。over-cap の topping は何も保存しない。
- schemaVersion 不変・新 field なし・migration なし。× / over-cap / パネルの状態は session のみ（reload で消える）。
- 旧 `researchTest` / `lastIngredientTest` 系の state は新方式で不要。`lastIngredientTest` は「開示した行のリスト」に置き換える（transient、永続化しない）。

## 7. Trial Notebook（Q-3 / Q-4 確定）

**記録するもの**: RESULT で開示した**判定（○ / ×）だけ**。**既知 ✓ は記録しない**（今回の判定ではない）。over-cap で非開示の topping、載せていない材料、hidden membership は記録しない。パネルが出ない attempt、または開示された判定が 0 件の attempt は従来どおり `feedback: null`。

**形式（既存 schema `{ kind, textJa }` の範囲内、deterministic）**:
- `kind = "RESEARCH_ROWS"`（`^[A-Z][A-Z0-9_]{0,31}$` を満たす）。
- `textJa` = `<Target 識別> <行> <行> …`（区切りは半角スペース 1 つ）。
  - **Target 識別**: RESULT / Research card に表示されたラベル文字列そのまま + `（<unlock fact の ingredient 名>）`。例 `？？？ピザ ①（チキン）`。Research Entry が 1 件のときのラベル（番号なし）はその表示のとおり。
  - **行**: `ソース: <名前><○|×> …`、`チーズ: …`、`トッピング: …`。判定が 1 件以上ある行だけを、この順序で出す。名前は player の pizza の順序（置いた順）。同じ ingredient は 1 回。
  - 例: `？？？ピザ ①（チキン） ソース: ペスト○ チーズ: モッツァレラ○ トッピング: ham× onion×`（表示名は実データの `nameJa`）。
- **Target 識別に使ってよい情報（OD-RB-14）**: すでに公開されている **Research Entry 番号**と **unlock fact の ingredient 名**だけ（unlock fact は ownership 由来で、研究カードに「✓ ○○を使う」として表示済み）。**hidden recipe の名前・id・hash・内部 id は使用禁止**。
- **再計算の禁止**: 保存時の表示文字列をそのまま使う。Notebook 表示時に Research Entry 番号や unlock 名を再計算しない（`trialRecord` の「表示時に再計算しない」原則）。Research Entry の増減で番号が変わっても、古い行は記録時の表示のまま（番号のずれは unlock 名が補う）。
- **retry replacement の制約**: Notebook の identity は attempt fingerprint（材料の組み合わせ）単位で、既存の retry 規則（OD-P3-15b）により、**同じ組み合わせを再試行すると feedback は最新の表示に置き換わる**。別の Research Target で同じ組み合わせを試した場合も同様で、**以前の Target の行は上書きされる**（最新の Target の識別が行に入るので、どの Target の結果かは常に分かる）。schema は変えないため、Target ごとの履歴は持たない。
- **文字数（audit evidence）**: 現 Production の `INGREDIENTS`（27 recipe / 30 ingredient）の最長の名前で、**sauce 3 + cheese 4 + 未知 topping 3 の判定をすべて並べ、unlock 名も最長（ジェノベーゼソース）にした最悪ケースが 126 字**（判定部分のみで約 115 字）。上限 200 字に収まる。実際の判定は recipe の特性上これより短い。
- **truncate はしない**。将来のカタログ拡大等で最悪ケースが 200 字を超える場合は、**テストで検出して schema / design decision に戻す**（§11）。切り詰めて意味を壊す設計にはしない。
- 他の Notebook 規則（fingerprint identity、`#n`、50 / 2 000 の上限、REVIVE、session-only）は不変。

## 8. 他機構との関係

- **cross-recipe exact（OD-I-8 維持）**: `T` 中に別 recipe `B` を exact に再現したら `B` は通常どおり DISCOVERED。`T` の ○× パネルも保存も出さない。
- **INCOMPLETE / AMBIGUOUS**: §3 の表示条件に含める。パネルは ORIGINAL と同一（INV-D3）。FAILED は matcher 一致後の話で ORIGINAL には来ない。
- **Hint 5.0**: ladder / 価格 / 順序は不変（OD-RB-9）。○ の `ing:` は既存どおり `hint5Ownership.known` に入り、全て既知の rung は ALREADY_KNOWN / 0 Pitz（OD-I-14）。STRUCTURE（全部で N）と SUB_CLASS は count / 分類を出さないので価値が残る。**SAUCE / CHEESE rung の価値低下は accepted consequence（§10）で、解決は #360 に委譲**。
- **Research Entry / Dex**: Research Entry は匿名ターゲットとして必須で残る。Dex / 研究カードの「わかっていること ✓」は保存済み ○ の表示になる。
- **progression**: コード変更なし。発見までの attempt 数が減る（監査: 27 recipe 合計 期待 321 → 約 93）ため、**ペース / Pitz 経済の balance audit が別途必要**（§12 Q-8）。
- **feature flag**: §12 Q-7。**Production ON は別 Gate**で、flag を変更する追加 commit / PR は禁止（OD-I-18 を継承）。

## 9. 既存 authority との矛盾監査（fresh audit）

| # | 既存 authority（場所） | 内容 | Contract 2.1 での扱い |
|---|---|---|---|
| 1 | Issue #356 §4.2 INV-1 / INV-2、§3 OD-I-2 / OD-I-7 / §4.1「全使用食材の一括 membership 判定」「指定していない食材の判定」 | Declaration-first、1 attempt = 1 食材、一括判定禁止 | **撤廃**（OD-RB-2〜5）。topping は上限つき開示、sauce / cheese は全件開示（INV-D1） |
| 2 | Issue #356 OD-I-3 | 指定食材を実際に使用していること | 不要（開示は使用した材料に対してのみ。載せていない材料は判定しない） |
| 3 | Issue #356 OD-I-9 / INV-3 | INCOMPLETE / AMBIGUOUS では識別しない。POSITIVE は plain ORIGINAL のみ | **改（OD-RB-11 で確定）**: 3 outcome で同一のパネル・同一の保存（INV-D3 / INV-D6）。count を出さないことで「構成が正解」の oracle は復活しない |
| 4 | Issue #356 OD-I-6、§15 Non-Goal「negative の永続化・**session memo**」 | negative を保存しない。session memo も Non-Goal | ×の永続保存は引き続き禁止。**session-only Notebook への × 判定の記録は Owner の OD-RB-7 / OD-RB-13 が明示的に上書き**（開示した判定に限る） |
| 5 | `src/state/trialRecord.ts` 冒頭、Near/Far Neutralization Phase 1 | Notebook の stored feedback は常に `null` | Near/Far 行を記録しない方針は維持。Research パネルの**開示した判定**に限り `feedback` を使う（schema の `{kind, textJa}` の範囲内、§7）。実装時に `trialRecord` の「常に null」コメント / テストを更新する |
| 6 | Trial Notebook OD-P3-4 / OD-P3-14 | 「見せた P2 feedback 行そのまま」を持てる。内部 outcome / recipe / hidden 回答は持たない | 整合（開示した判定のみ、outcome は記録しない） |
| 7 | #346 S3 / S4 Result「attempts add no knowledge」、OD-RX-3、AC6 | 試作は knowledge を作らない（`ing:` は購入のみ） | #356 で限定的に上書き済み。2.1 はその範囲を「RESULT で開示した ○」へ拡張（保存先は同じ `ing:`）。S4 AC6（指定なしの oracle 中立性）は「targetless / パネルなし」で維持 |
| 8 | Hint 5.0 H5-0 OD-H5-U1「no FREE LEAK」、OD-H5-P4-CHEESE「購入前は『なし』と言わない」、OD-H5-P4-SAUCE（RESERVED） | rung は有料。cheese / key の「なし」は購入後のみ。sauce の「なし」は Hint 5.0 の authority ではない | **直接の「なし」は表示しない**（INV-D7）。ただし player が全 cheese を試して全 × を見れば「なし」を**推論できる**。これを **accepted consequence**（§10）とし、Hint 側の改善は #360 に委譲。sauce の RESERVED は §3 のとおり除外 |
| 9 | Hint 5.0 OD-H5-E1（価格 sauce 10 / cheese 10 / key 10 / structure 5 / class 5） | 価格不変 | 不変（OD-RB-9）。○ の `ing:` は既存の ALREADY_KNOWN 経路（OD-I-14） |
| 10 | Issue #356 OD-I-8（cross-recipe）/ OD-D3-20・23（INCOMPLETE を ORIGINAL と同一に） | 別 recipe exact は通常 DISCOVERED、INCOMPLETE は ORIGINAL と見分けがつかない | 維持（§8、INV-D3） |
| 11 | #346 S4「Research ORIGINAL の RESULT は near/far を出さない」 | Research round は Near/Far 行なし | 維持。パネルは Near/Far ではない |
| 12 | Issue #356 OD-I-16 | cap / 回数制限 / 課金を入れない | 維持（K は回数制限ではなく**開示量の上限**） |
| 13 | `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` §5.2 | STRUCTURE は「全部で N」のみ。`meta:topping-total` は売らない | 維持（count 非開示、OD-RB-6） |
| 14 | `PROJECT_HANDOFF.md` | #356 / #357 / #358 の記述なし | 変更しない（本 PR は docs の追加のみ。handoff への反映は実装 Gate で行う） |

## 10. Accepted consequences（Q-2a、OD-RB-12）

Production の 27 recipe / 30 ingredient では（Q-2 data audit、27 recipe の実データ）:

1. **Hint 5.0 の SAUCE / CHEESE rung の価値が低下する。** sauce / cheese の全件 ○× は topping の走査と並行して無料で進むため、SAUCE rung（10 Pitz）は 11 recipe、CHEESE rung（10 Pitz）は 22 recipe で、RESULT が同じ情報を数 attempt 以内に無料で与える（Hint 5.0 は production で ON）。上限つき案でも消えないため（27 recipe 合計 93 → 100 attempt）、本 Contract の実装では解決しない。**改善は #360 の Design/Audit scope に残す。**
2. **「チーズなし」を player が推論できる。** 6 recipe（marinara、fugazza、pizza-bianca、pesto-tonno、puttanesca-pizza、brazilian-calabresa）は cheese を使わない。所有している cheese（この 6 recipe では 2 種）をすべて載せて全 × になれば、player は「cheese なし」を推論できる。
3. これは**直接の「cheese なし」の開示ではない**。パネルは player が実際に試した ingredient についてだけ「モッツァレラ ×」「パルミジャーノ ×」と表示する（INV-D7）。**player 自身の experiment 結果からの推論として、Contract 2.1 では許容する。**
4. sauce の「なし」は production に存在しない（全 27 recipe がちょうど 1 つの sauce を使う）。sauce は所有数が 2〜3 のとき 1 attempt で確定する（13 recipe、うち 2 recipe は unlock fact で既知）。
5. 全投入は 22 recipe で合理的だが、節約は平均 0.26 attempt / recipe（最大 2、27 recipe 合計約 7）で、攻撃面は小さい。

## 11. 実装 Gate に求めるテスト契約（実装時に固定する）

- **Bounded reveal（topping）**: 任意の pizza で、開示される topping membership の数が常に ≤ 3（property test。全 30 材料を載せても topping 行は開示 0）。sauce / cheese は使用した全件が開示される（上限なし）。
- **Parity / INV-D6**: 同一 pizza で ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH のパネル HTML・保存結果・Notebook 行が byte 同一。料理品質（量・焼き）を変えても ○ の値と保存が変わらない。
- **Disclosure = Persist = Notebook**: 保存された `ing:` と Notebook 行が、表示された ○ / 判定と一致。over-cap で何も保存されない。× が save に現れない（save 差分は `ing:` の追加のみ）。
- **known の除外**: `known(T)` の topping は上限に数えられず、✓ として表示されるが **Notebook には記録されない**。unlock fact も同様。
- **INV-D7（「なし」の非開示）**: cheese / sauce 行が全 × になるどんな組み合わせでも、パネル・aria・Notebook に「なし」に相当する文言が出ない。
- **Notebook 形式**: `RESEARCH_ROWS` の形式が deterministic（同じ入力で同じ文字列）。ラベルは表示文字列をそのまま保存し再計算しない。**現カタログでの最悪ケースが 200 字以内**であることを固定するテスト（カタログ拡大でこのテストが落ちたら、truncate せず schema / design decision に戻す）。retry replacement（同じ組み合わせ・別 Target で feedback が最新に置換）を固定。
- **cross-recipe**: `T` 中の別 recipe exact でパネルなし・`T` への保存なし。targetless / MATCHED / FAILED / flag OFF でパネルなし。
- **privacy scan**: DOM / aria / Notebook に hidden recipe 名・id・count・割合・「n 個中」が出ない。
- **回帰**: `INV-4`（matcher 非依存）、Hint 5.0 価格・rung 不変、Trial Notebook schema 不変、Production flag default OFF。
- **mobile**: 390×844 / 360×800 で overflow なし・CTA 到達可能（Layout Contract Gate を含む）。

## 12. 未決の設計論点（Q-5 以降。実装前に Owner が確定）

Q-1〜Q-4 は §1（OD-RB-11〜14）で**確定済み**。Q-5（Notebook の行の範囲 / 切り詰め / 複数 Target）も OD-RB-13 / OD-RB-14 と §7 に吸収したため**解消**。

| Q | 決めること | 選択肢 | 分かっていること | 影響 | 推奨 |
|---|---|---|---|---|---|
| **Q-6 RESULT パネルの mobile レイアウト** | sauce 最大 3 + cheese 最大 4 + topping 判定の見せ方 | (a) 行ごとのチップ（名前 + ○/×）を折り返し (b) 縦リスト (c) 折りたたみ | 判定のみ表示すれば最大 10 項目（✓ 既知は Notebook 同様パネルにも出さず研究カードに任せる）。現 Research ORIGINAL の RESULT は 1-screen budget で、`data-ingredient-test` の枠が既にある。典型（tomato + mozzarella + topping 3）は 5 チップ | UX: 一目で ○× が見える。実装: 既存の枠を置換、Layout Contract Gate の確認が必要 | (a) 3 行のチップ。✓ はパネルに出さない。最悪ケース（≥ 8 判定）のみ折り返しで高さが増えるのを許容し、実装 Slice で 390×844 / 360×800 を実測して確定 |
| **Q-7 feature flag** | `RESEARCH_IDENTIFY_ENABLED` を再利用するか新設か | (a) 再利用 (b) 新 flag、旧方式を残す | flag は Production 既定 OFF（dev / Preview ON、dev opt-out）。#357 の旧方式（picker 等）は main に flag OFF で存在し、Production に出たことがない | 再利用: 旧方式を同じ PR で撤去でき、flag の組み合わせが増えない。新設: 旧方式がデッドコードで残る | (a) 再利用。旧方式（picker / `researchTest` 系）は新方式の実装 PR で撤去。rollback は従来どおり flag OFF |
| **Q-8 progression / Pitz balance** | 実装前の blocker にするか | (a) blocker（実装前に audit） (b) Production 有効化 Gate の条件 | 発見までの attempt 数は 11.9 → 3.4（約 3.5 倍速、27 recipe 合計 321 → 93）。flag は Production OFF なので実装しても Production には影響しない。Hint の価格は 5〜10 Pitz、初回発見ボーナス等の経済は既存 | (a) だと実装が止まる。(b) なら Preview の実測を材料に flag ON 前に判断できる | (b)。実装は flag OFF で進め、**Production ON の Gate に balance audit（Preview の attempt 数 / Pitz 収支の実測）を必須条件として入れる** |
| **Q-9 Target が cookable でなくなった attempt** | 最後の在庫を使い切った attempt でもパネルを出すか | (a) ownership 基準（登録済み Entry） (b) cookable 基準 | #357 の `identifyDeclaredIngredient` は登録済み Entry（ownership）基準で AC8 を満たす。#359 Slice 1 の `researchResultView` も同じ | (a) なら在庫を使い切った attempt の ○ が欠落しない | (a)（既存と同じ） |
| **Q-10 PR #359 の扱いと再利用** | close のタイミング、Slice 1 / Slice 5 / Layout Contract の再利用方法 | (1) 今 close して cherry-pick (2) 実装 PR が開くまで HOLD (3) 独立して有用な commit を新しい小 PR に抽出し、その後に #359 を close | 独立して再利用できる commit: Slice 1（`58c115d` Research context を BAKE / retry 後も維持）、Slice 5（`a4dfec4` 発見成功 RESULT の CTA 整理）、e2e 更新（`24297f3`）、Layout Contract 更新（`aac83b9`）。Slice 5 側は旧方式（researchTest）のコードに依存しない。Slice 2〜4 と Codex 指摘への修正（確認ダイアログ関連）は旧方式専用で不要 | Slice 1 / 5 は Owner の Preview HV 済みの改善で、旧方式の採否と無関係に価値がある | (3)。`main` から新ブランチを切り、`58c115d` + `a4dfec4` + `24297f3` + `aac83b9`（と必要なテスト補助）を cherry-pick して小 PR にし、それが開いた後に #359 を close（ブランチは参照用に残す）。close の時期は Owner 指示まで HOLD |

## 13. Non-Goals

correct count / distance / similarity / 欠落リスト / 残数 / 候補数 / Near・Far / negative の永続化 / Notebook schema 変更 / Hint 5.0 価格・progression の変更（SAUCE / CHEESE rung の価値低下の解決は #360）/ 新 taxonomy / save migration / attempt cap・課金 / #355 の修正 / **Production flag ON・Production deploy**。
