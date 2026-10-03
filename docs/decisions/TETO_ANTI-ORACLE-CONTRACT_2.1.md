# Anti-Oracle Contract 2.1 — RESULT-based Identification（C-1「種類上限つき項目別 ○×」）

Status: **Owner 承認済みの設計 authority。実装済み: PR #363（main `60dc604bd8f5b67ea7a1b8d4308f9a4c85d04cd9`、Production flag `RESEARCH_IDENTIFY_ENABLED` は default OFF のまま）。** Production flag ON は §13 の別 Gate。
Path: `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`
承認日: 2026-10-03（Owner。OD-RB-1〜10）、同日追補（OD-RB-11〜14: Q-1 / Q-2a / Q-3 / Q-4、OD-RB-15〜19: Q-6〜Q-10）。**Owner Decision Q-1〜Q-10 はすべて resolved。**
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
| **OD-RB-12**（Q-2a） | sauce / cheese は**使用したもの全件**に ○×（bounded reveal を設けない）。理由: 上限つき案でも 27 recipe 合計の差は約 3 attempt（補正後 97 → 100、§15）、「チーズなし」の推論は最大 1 attempt 遅れるだけで、追加ルールの UX コストの方が大きい。RESULT は**「チーズなし」「ソースなし」と直接表示しない**（§3、INV-D7）。「なし」が推論できることは §10 の **accepted consequence**。SAUCE / CHEESE Hint の価値低下は本 Contract の実装では解決せず **#360 の scope** に残す。 |
| **OD-RB-13**（Q-3） | Notebook には RESULT で実際に開示した ○× の**判定だけ**を記録する: ○ は記録、× は記録、**既知 ✓ は今回の判定ではないので記録しない**、over-cap で非開示の topping・hidden membership は記録しない。形式は既存 schema 内で deterministic（§7）。truncate はしない。 |
| **OD-RB-14**（Q-4） | 複数の Research Target の attempt を Notebook 上で区別できるようにする。識別に使ってよいのは**すでに公開されている情報だけ**（Research Entry 番号 + unlock fact の ingredient 名）。hidden recipe identity は使用禁止。保存時の表示文字列をそのまま使い、後から再計算しない（§7）。 |
| **OD-RB-15**（Q-6） | RESULT の「今回の試作結果」は**カテゴリごとにまとめる**（ソース / チーズ / トッピング）。表現は ingredient 名 + ○/× の **compact chip** を基本とし、横幅に応じて wrap。**既知 ✓ は今回の判定ではないので RESULT パネルに混ぜない**（既知情報は Research card / Dex）。典型ケースを優先して compact にし、最悪ケースだけ高さ増加を許容。固定 px 高さは authority にしない（mobile HV で最終調整）。実装 Slice で 390×844 / 360×800 を必ず実測する。 |
| **OD-RB-16**（Q-7） | **既存 `RESEARCH_IDENTIFY_ENABLED` を再利用**し、新 flag は作らない。flag OFF = 現 Production の挙動、flag ON = Contract 2.1。**旧 picker / LOCK 方式を flag ON の別 variant として残さない**（旧方式は Production で ON になったことがなく、新方式が正式な後継）。 |
| **OD-RB-17**（Q-8） | progression / Pitz balance は**実装の blocker にしない**。実装は Production flag OFF で進めてよい。**Production ON Gate の必須条件**とする（§13）。A 方式 約 11.9 → C-1 約 3.6 attempts / recipe（約 3.3 倍速、§15）は **Production activation risk** として残す。実装完了 = Production ON ではない。 |
| **OD-RB-18**（Q-9） | **attempt 開始時に有効な Research Target** で、player がその pizza を実際に作った結果であれば、最後の在庫消費等で RESULT 時点に target が cookable でなくなっても**判定パネルを表示する**。判定の authority を RESULT 時点の cookability に依存させない（#357 AC8 / #359 Slice 1 の知見を維持）。 |
| **OD-RB-19**（Q-10） | #359 を新方式へ rewrite しない。再利用可能部分を **`main` からの新しい小 PR へ抽出**する。候補: Slice 1（`58c115d`）/ Slice 5（`a4dfec4`）/ e2e 更新（`24297f3`）/ Layout Contract（`aac83b9`）。**機械的に全 commit を cherry-pick せず、各 commit を `main` との差分で fresh audit し、Contract 2.1 でも必要な変更だけを抽出**する。旧 picker / `researchTest` / LOCK / `BakeUnusedConfirm` 等への依存が混入しないことを確認する。**Slice 2〜4 は再利用しない。** |

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
| ソース | **使った sauce の全件**に ○（∈ canonical(T)）/ ×。上限なし。**1 枚の pizza に載る sauce は 1 種類**（`APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` が `sauceIds` を 1 要素の配列で置換する）ので、ソース行は常に 1 件。複数 sauce を同時に試す前提は置かない。`known(T)` の sauce は**パネルに出さない**。 |
| チーズ | **使った cheese の全件**に ○ / ×。上限なし。`known(T)` の cheese は**パネルに出さない**。 |
| トッピング | `|U| ≤ 3`: `U` の各 topping に ○ / ×（`known(T)` の topping は**パネルに出さず**、上限にも数えない）。**`|U| ≥ 4`: 個別 membership を一切表示しない**。コピー案: 「トッピングは一度に3種類まで調べられるよ」（文言は実装前に最終調整可、意味は固定）。 |

- **表示構造（OD-RB-15）**: 見出し「今回の試作結果」の下に、カテゴリごと（ソース / チーズ / トッピング）の小見出しと、**ingredient 名 + ○/× の compact chip** を並べる。chip は横幅に応じて wrap。判定が 0 件のカテゴリは見出しごと出さない。**既知 ✓ はこのパネルに混ぜない**（研究カード / Dex に任せる）。固定 px の高さを authority にしない。典型（tomato + mozzarella + 未知 topping 3 = 5 chip）を compact に、最悪（判定 10 chip）のみ高さ増加を許容する。実装 Slice で 390×844 / 360×800 を実測し、mobile HV で最終調整する。
- **Target の有効性（OD-RB-18）**: パネルの表示可否・判定・保存は、attempt 開始時に有効だった Research Target（登録済み Research Entry、ownership 基準）で決める。**RESULT 時点の cookability に依存しない**（最後の在庫を使い切った attempt でも表示・保存する）。
- **直接の「なし」表示の禁止（OD-RB-12）**: パネルは player が実際に試した ingredient についてだけ「モッツァレラ ×」「パルミジャーノ ×」のように表示する。**「チーズなし」「ソースなし」「〜は使わない」を直接書かない**（行ごと・文言ごと）。player 自身が結果から「チーズなしでは？」と推理することは許容する（§10）。
- **表示順**は player 自身の pizza の順序（置いた順 / 種類順）で、`canonical(T)` の順序や catalog の順序を使わない。
- パネルに **○ / × の個数、「全部正解」「あと少し」等の総評、色による総括、count、進捗** を置かない。
- **標準パネルを target 非依存に同一表示できない target は、パネルの対象 population に含めない**（例: Hint 5.0 で sauce rung が RESERVED の target / no-sauce の target）。**カテゴリ行だけを条件付きで省略する設計は採用しない**: target の性質によって sauce 行だけが消えると、パネルの省略そのものが hidden property（reserved / no-sauce class）を漏らすため（INV-D4、INV-5）。現 Production の 27 recipe に該当 target はない（全 recipe がちょうど 1 つの sauce を使い、Hint 5.0 の RESERVED sauce rung に到達する recipe は存在しない: M2 条件 3）ので、**Production-27 の実装 blocker にはしない**。no-sauce 等の population を Production に追加する前に、**Scale Audit の Expansion Gate A として RESERVED / INV-D4 / INV-D7 を再設計する**（§13）。

## 4. 不変条件（Contract 2.1）

- **INV-D1 Bounded reveal（旧 INV-1 / INV-2 の置換）**: 1 attempt で開示する **topping** membership は「未知の種類 ≤ 3」。載せた topping の数で開示量が増えない（全部乗せで増えない）。sauce / cheese はカテゴリが小さい（現 Production: sauce 3 / cheese 4）ため上限なし（OD-RB-12）。
- **INV-D2 Disclosure = Persist(○) = Notebook**: 保存される ○、Notebook に書かれる判定は、RESULT に表示された内容と**完全に一致**する。表示されなかった membership は、保存も記録も、内部状態に残すことも禁止（over-cap の topping は何も保存されない）。
- **INV-D3 Verdict parity（INV-3 の再定義）**: パネルの DOM / 文言 / 保存挙動は、同一の pizza・`known(T)`・`canonical(T)` に対して **ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で byte 同一**。outcome 種別は出力に影響しない。count を出さないので、「全 ○ なのに発見されない」は「欠けている材料」か「実行（量・焼き）の問題」かを区別できない（これが parity の要）。
- **INV-D4 Panel presence は player 自身の入力だけで決まる**: パネル / カテゴリ行 / over-cap の有無は pizza・`known(T)`・outcome の許可集合だけに依存し、`canonical(T)` の中身に依存しない。
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
- **progression**: コード変更なし。発見までの attempt 数が減る（監査: 27 recipe 合計 期待 321 → 約 97、約 3.3 倍速、§15）。**実装の blocker にはせず、Production ON Gate の必須条件とする**（§13、OD-RB-17）。
- **feature flag（OD-RB-16）**: 既存 `RESEARCH_IDENTIFY_ENABLED`（Production 既定 OFF、dev / Preview ON、dev opt-out）を再利用する。OFF = 現 Production の挙動、ON = Contract 2.1。旧 picker / LOCK 方式を ON の別 variant として残さない。**Production ON は別 Gate**（§13）で、flag を変更する追加 commit / PR は禁止（OD-I-18 を継承）。

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
| 8 | Hint 5.0 H5-0 OD-H5-U1「no FREE LEAK」、OD-H5-P4-CHEESE「購入前は『なし』と言わない」、OD-H5-P4-SAUCE（RESERVED） | rung は有料。cheese / key の「なし」は購入後のみ。sauce の「なし」は Hint 5.0 の authority ではない | **直接の「なし」は表示しない**（INV-D7）。ただし player が全 cheese を試して全 × を見れば「なし」を**推論できる**。これを **accepted consequence**（§10）とし、Hint 側の改善は #360 に委譲。RESERVED / no-sauce の target はパネルの対象 population に含めない（§3、行の条件付き省略はしない） |
| 9 | Hint 5.0 OD-H5-E1（価格 sauce 10 / cheese 10 / key 10 / structure 5 / class 5） | 価格不変 | 不変（OD-RB-9）。○ の `ing:` は既存の ALREADY_KNOWN 経路（OD-I-14） |
| 10 | Issue #356 OD-I-8（cross-recipe）/ OD-D3-20・23（INCOMPLETE を ORIGINAL と同一に） | 別 recipe exact は通常 DISCOVERED、INCOMPLETE は ORIGINAL と見分けがつかない | 維持（§8、INV-D3） |
| 11 | #346 S4「Research ORIGINAL の RESULT は near/far を出さない」 | Research round は Near/Far 行なし | 維持。パネルは Near/Far ではない |
| 12 | Issue #356 OD-I-16 | cap / 回数制限 / 課金を入れない | 維持（K は回数制限ではなく**開示量の上限**） |
| 13 | `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` §5.2 | STRUCTURE は「全部で N」のみ。`meta:topping-total` は売らない | 維持（count 非開示、OD-RB-6） |
| 14 | `PROJECT_HANDOFF.md` | #356 / #357 / #358 の記述なし | 変更しない（本 PR は docs の追加のみ。handoff への反映は実装 Gate で行う） |

## 10. Accepted consequences（Q-2a、OD-RB-12）

Production の 27 recipe / 30 ingredient では（Q-2 data audit、27 recipe の実データ）:

1. **Hint 5.0 の SAUCE / CHEESE rung の価値が低下する。** sauce / cheese の項目別 ○× は topping の走査と並行して無料で進むため、SAUCE rung（10 Pitz）は 11 recipe、CHEESE rung（10 Pitz）は 22 recipe で、RESULT が同じ情報を数 attempt 以内に無料で与える（sauce は 1 attempt 1 種のため、所有する sauce が s 種なら最大 s attempt。Hint 5.0 は production で ON）。上限つき案でも消えないため（27 recipe 合計 97 → 100 attempt）、本 Contract の実装では解決しない。**改善は #360 の Design/Audit scope に残す。**
2. **「チーズなし」を player が推論できる。** 6 recipe（marinara、fugazza、pizza-bianca、pesto-tonno、puttanesca-pizza、brazilian-calabresa）は cheese を使わない。所有している cheese（この 6 recipe では 2 種）をすべて載せて全 × になれば、player は「cheese なし」を推論できる。
3. これは**直接の「cheese なし」の開示ではない**。パネルは player が実際に試した ingredient についてだけ「モッツァレラ ×」「パルミジャーノ ×」と表示する（INV-D7）。**player 自身の experiment 結果からの推論として、Contract 2.1 では許容する。**
4. sauce の「なし」は production に存在しない（全 27 recipe がちょうど 1 つの sauce を使う）。sauce は 1 枚の pizza に 1 種類しか載せられないため、1 attempt では 1 種類しか判定できない。所有する sauce が 2〜3 種の recipe（13 recipe、うち 2 recipe は unlock fact で既知）は、attempt ごとに別の sauce を試して確定する（topping の走査と並行）。cheese は複数載せられるので 1 attempt で確定する。
5. cheese の全件投入が合理的になる recipe は 22 あるが、節約は 27 recipe 合計で約 3 attempt（平均 0.1 attempt / recipe、最大 約 1 attempt: quattro-formaggi。上限つき案 100 と比較した 97）で、攻撃面は小さい。

## 11. 実装 Gate に求めるテスト契約（実装時に固定する）

- **Bounded reveal（topping）**: 任意の pizza で、開示される topping membership の数が常に ≤ 3（property test。全 topping を載せても topping 行は開示 0）。sauce / cheese は使用した全件が開示される（上限なし）。
- **Parity / INV-D6**: 同一 pizza で ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH のパネル HTML・保存結果・Notebook 行が byte 同一。料理品質（量・焼き）を変えても ○ の値と保存が変わらない。
- **Disclosure = Persist = Notebook**: 保存された `ing:` と Notebook 行が、表示された ○ / 判定と一致。over-cap で何も保存されない。× が save に現れない（save 差分は `ing:` の追加のみ）。
- **known の除外**: `known(T)` の topping は上限に数えられず、**RESULT パネルにも Notebook にも出ない**（研究カード / Dex が表示）。unlock fact も同様。
- **INV-D7（「なし」の非開示）**: cheese / sauce 行が全 × になるどんな組み合わせでも、パネル・aria・Notebook に「なし」に相当する文言が出ない。
- **Notebook 形式**: `RESEARCH_ROWS` の形式が deterministic（同じ入力で同じ文字列）。ラベルは表示文字列をそのまま保存し再計算しない。**現カタログでの最悪ケースが 200 字以内**であることを固定するテスト（カタログ拡大でこのテストが落ちたら、truncate せず schema / design decision に戻す）。retry replacement（同じ組み合わせ・別 Target で feedback が最新に置換）を固定。
- **cross-recipe**: `T` 中の別 recipe exact でパネルなし・`T` への保存なし。targetless / MATCHED / FAILED / flag OFF でパネルなし。
- **privacy scan**: DOM / aria / Notebook に hidden recipe 名・id・count・割合・「n 個中」が出ない。
- **回帰**: `INV-4`（matcher 非依存）、Hint 5.0 価格・rung 不変、Trial Notebook schema 不変、Production flag default OFF。
- **mobile**: 390×844 / 360×800 で overflow なし・CTA 到達可能（Layout Contract Gate を含む）。chip が wrap し、典型ケースが compact であること、最悪ケース（判定 10 chip）でも CTA に到達できることを実測で固定（固定 px 高さは assert しない）。
- **Target の有効性**: 最後の在庫を使い切る attempt で、パネル・`ing:` 保存・Notebook 行が欠落しない（RESULT 時点の cookability に依存しない）。
- **flag**: OFF で現 Production と byte 同一（パネルなし・picker なし）。旧 picker / `researchTest` / LOCK / `BakeUnusedConfirm` が ON / OFF どちらにも存在しない。

## 12. Owner Decision の状況

**Q-1〜Q-10 はすべて resolved**（Q-1 = OD-RB-11、Q-2 = OD-RB-12、Q-3 = OD-RB-13、Q-4 = OD-RB-14、Q-5 = OD-RB-13 / 14 と §7 に吸収、Q-6 = OD-RB-15、Q-7 = OD-RB-16、Q-8 = OD-RB-17、Q-9 = OD-RB-18、Q-10 = OD-RB-19）。
実装 Gate で確定する**実装詳細**（Owner Decision ではない）: chip の具体的な見た目と高さ（mobile HV で調整）、over-cap のコピーの最終文言、Notebook 行の区切り文字の細部。

### 12.1 #359 extraction の方針（OD-RB-19）

- #359 は rewrite せず、**`main` からの新しい小 PR へ再利用部分だけを抽出**し、その後に #359 を close する（close の時期は Owner の指示）。
- 各 commit は機械的に cherry-pick せず、`main` との差分を hunk 単位で fresh audit する。Contract 2.1 でも必要な変更だけを残す。
- 旧 picker / `researchTest` / `researchTestLocked` / `SET_RESEARCH_TEST` / `BakeUnusedConfirm` / 状態 pill / 確認ダイアログ用の入力・タイマー pause への依存が混入しないことを確認する。
- Slice 2〜4 とそれらの Codex 指摘の修正は再利用しない。

## 13. Production 有効化 Gate（OD-RB-17）

実装は Production flag OFF で進めてよい。**`RESEARCH_IDENTIFY_ENABLED` の Production ON は別 Gate**で、実装完了 = Production ON ではない。Gate の必須条件:

1. **Preview での実プレイ**（Owner の iPhone。390×844 / 360×800）。
2. **discovery attempt 数**の実測（recipe あたり。監査の想定: A 方式 約 11.9 → C-1 約 3.6）。
3. **Hint 利用状況**（SAUCE / CHEESE rung の購入が減るか。§10 の accepted consequence、#360）。
4. **Pitz 収支**と **replenishment cost** の関係（在庫補充・初回購入との釣り合い）。
5. **progression speed**（ladder の進行が約 3.3 倍速になる）。

**Production activation risk（残す）**: 発見までの attempt 数が約 3.3 倍速になるため、progression のペースと Pitz 経済（初回発見ボーナス、Hint・補充の sink）が崩れる可能性がある。flag を変更する追加 commit / PR は、この Gate を通過するまで禁止。

**Production 有効化後の記録（2026-10-03）:** PR #366 で Production ON（deploy `fbd5305`、Owner iPhone Production HV = PASS）。実機で確認した範囲と automated evidence のみの範囲は [`TETO_CONTRACT-2.1_PRODUCTION-POST-ACTIVATION-HV-CHECKLIST.md`](../reports/TETO_CONTRACT-2.1_PRODUCTION-POST-ACTIVATION-HV-CHECKLIST.md) を参照（本書の §3 / §4 / §6 / §7 は変更しない）。

### 13.1 Scale Audit の再監査 trigger（Expansion Gate）

- **Expansion Gate A（no-sauce / RESERVED population）**: no-sauce 等の population を Production へ追加する前に、RESERVED / INV-D4 / INV-D7 を再設計する（§3: カテゴリ行の条件付き省略は採用しない）。
- **53 / 172 recipe の Scale Audit**: 旧版の見積り（本書の旧 §6 の将来スケール）は sauce 複数投入の前提を含む可能性があり、**現時点で authority にしない**。拡張 population（53 / 172）を扱う前に、sauce 1 種 / attempt（§3、§15）の前提で**再監査する**（trigger の記録のみ。数値はここでは確定しない）。Production-27 の実装 blocker ではない。

## 14. Non-Goals

correct count / distance / similarity / 欠落リスト / 残数 / 候補数 / Near・Far / negative の永続化 / Notebook schema 変更 / Hint 5.0 価格・progression の変更（SAUCE / CHEESE rung の価値低下の解決は #360）/ 新 taxonomy / save migration / attempt cap・課金 / #355 の修正 / **Production flag ON・Production deploy**。

## 15. Canonical numbers（Production 27 recipe / 30 ingredient、**sauce は 1 attempt 1 種類**）

旧版（`f8194a5` 以前）の数値は「複数 sauce を 1 attempt で同時に試せる」前提を含んでいた。**実 code では 1 枚の pizza に載る sauce は 1 種類**（`APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` が `sauceIds` を 1 要素で置換、`src/state/gameReducer.ts`）なので、本節の数値を canonical とし、旧値を置換する。cheese は複数載せられるため cheese の分析は変更しない。

方法: 各 recipe をその research 可能 step の所持集合（unlock は既知）で評価した、事前知識なしの blind scan の期待 attempt 数。sauce は attempt ごとに 1 種類を順に試し、cheese は全件、topping は未知 K 種ずつ走査し、これらは並行して進む。最終の exact 構築 1 回を含む。

| 方式 | 27 recipe 合計 | 平均 / recipe | 旧値 |
|---|---|---|---|
| A（#359、1 attempt 1 食材） | **321** | 11.9 | 321（変更なし） |
| B 無制限（topping 上限なし） | **64** | 2.4 | 54 |
| **C-1 K=3（採用、cheese 全件）** | **97** | **3.6** | 93 / 3.4 |
| C-1 K=3、cheese も 1 種まで | 100 | 3.7 | 100 |
| C-1 K=2 | 121 | 4.5 | 117 |
| C-1 K=4 | 85 | 3.2 | 81 |

- A に対する速度: C-1 K=3 は **約 3.3 倍**（旧 約 3.5 倍）、B 無制限は 約 5 倍（旧 約 6 倍）。
- cheese 全件が上限つき（cheese 1 種）に対して節約する attempt は 27 recipe 合計で約 3（97 と 100）。
- recipe 個別（A / C-1 K=3）: margherita 2.0 / 2.0、funghi 4.0 / 2.0、capricciosa 12.5 / 4.4、pizza-portuguesa 13.3 / 4.5、puttanesca-pizza 21.6 / 6.8、pesto-pollo 22.5 / 5.4。
- 旧版の「D1（合計 3 種）143」は sauce 複数投入を前提にした割り当てだったため**取り下げ**（再計算しない）。「C-3（1 開示 / attempt）108」「D2（sauce / cheese を判定しない）約 +100〜130」は概算で、sauce 制約の再計算はしていない参考値。
- 53 / 172 の見積りは本節に含めない（§13.1）。
