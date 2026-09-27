# TETO Cooking Techniques 1.0 — Fresh Design（調理法そのものを発見する）

> **Status:** Fresh Design のみ（docs / data / tools）。production code・test・save・UI・価格・★は一切変更しない。
> Owner Decision（§18）が確定するまで、ここに書いたものは authority ではない。
>
> **Gate update（後続 commit）:** TQ-1 の Owner Decision Gate は
> `docs/design/TETO_COOKING-TECHNIQUES_1.0_OWNER-DECISION-GATE.md` を参照。本書から修正した点
> （Dinner を検出対象外に、TECHNIQUE_SLOT を派生化、SAUCE_ONLY の k≥2 抑制、scoring 案 B、append-only ladder が前提）は
> 同書 §11 に一覧がある。本書の本文は 49b0976 時点のまま残している。
>
> **Verdict: A. FRESH DESIGN READY FOR OWNER DECISIONS**（§18 の OD-TQ-1…15 と §19 の最小 slice）

| Artifact | Path |
|---|---|
| 本書（設計） | `docs/design/TETO_COOKING-TECHNIQUES_1.0_DESIGN.md` |
| 候補監査データ（機械可読、172行×候補） | `docs/design/data/TETO_COOKING-TECHNIQUES_1.0_AUDIT.json` |
| 生成テーブル（候補別 ready target / 172行の technique 割当） | `docs/design/TETO_COOKING-TECHNIQUES_1.0_ROWS.md` |
| 生成・検証ツール（決定的） | `tools/cooking_techniques_audit.py`（`--check` = 検証のみ） |

数値はすべてツールが JSON から出力したもの。本文と JSON が食い違う場合は JSON が正。

---

## 0. 結論（先に）

1. **Technique = 「新しい“やり方”を、自分の手で初めてやって完成させた」ことの記録。** Recipe Discovery は「どのピザか」（何を・どう組み合わせたか）の発見、Technique Discovery は「どう作れるか」（新しいタイミング・省略・重ね方・形）の発見。Material は「何を持っているか」。3つは別の台帳・別の演出・別の入手経路にする（§2）。
2. **Technique は Shop で買わない。** Progression（発見数 ladder）が開くのは「その操作が*できる余地*（affordance）」だけ。答え（=技法名・やり方）は開かない。プレイヤーが実際にやって PASS 完成した瞬間に発見になる（§4）。
3. ユーザー指定 10 候補の監査結果（§3）:
   - **Technique にする:** 後乗せ（POST_BAKE_FINISH）、ソースなし（NO_SAUCE）、複数 spread（DOUBLE_SPREAD）。
   - **後段の Technique:** 特殊形状（四角・舟形）、pan、包む/折る、途中のせ、逆順、区画、下ごしらえ、揚げ、折り重ね。
   - **Technique にしない:** 焼く前にのせる（= 全ピザの既定動作。BASELINE）、特殊なソース（= 材料。MATERIAL）、CUTなし（= 提供属性。identity ではない）、生地の種類・ピアディーナ（= 生地カード。MATERIAL）。
4. **重要な事実:** 「後乗せ」は 172 行中 required 8 行・candidate-only 11 行だが、Phase-2 の ready target は **2 行だけ**（BBQチキン、わさび牛）で、どちらも runtime に無い材料を 3 つずつ要る。一方 **ソースなし は runtime が既に観測できる唯一の軸**（free cook の SAUCE step は中身で gate されていない）で、ready 26 行、runtime 材料だけで作れる ready が 2 行（オージー、チリアンナポリターナ）ある。
5. **最小 slice の推奨（§19）:** TQ-1 = Technique 台帳・検出・演出・Technique Dex の最小形 ＋ パイロット技法 `NO_SAUCE` ＋ そのための 1 レシピ（オージー）。新ジェスチャーなし。後乗せは TQ-2（FINISH の gameplay と内容追加が要る）。Owner が「最初は後乗せ」を選ぶ場合の代替案も §19 に置いた。

---

## 1. Fresh audit（設計前に確認したこと）

| 確認 | 結果 |
|---|---|
| `origin/main` | `51e0923`（Merge PR #252, Dinner DM-3R-2）。作業ブランチは空だったので fast-forward 済み。 |
| 重複 | PR 検索（technique / 調理法 / 後乗せ）→ #255（DH4 172 ingredient taxonomy、docs-only、OPEN）と #74（closed）だけ。#255 は材料分類で、技法台帳・発見条件には触れない。Issue 検索は 0 件。**重複なし。** |
| 172 matrix | `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` 172行、capability 11種。読み取り専用で使用。 |
| Phase 2 | `TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json`。ready target 87 行（+ shipped 14）。**§6 / M2 は「⭐ gate で capability を無料付与し、Teto が教える」**。本設計はこの「付与して教える」を「affordance を開き、発見はプレイで」に置き換える提案（OD-TQ-1）。 |
| Discovery Ladder | `src/data/discoveryLadder.ts`。OD-REC04-1: **★は material unlock 条件にならない**、発見数で step が進む、`ProgressionStepKind` は将来 non-material step を足せる設計。→ Technique の gate はここに乗る（§10）。 |
| Signature / matcher | `src/logic/discovery/signature.ts`: 11 identity 軸。`sauceBase` は OBSERVED、`late`/`spreadLayers`/`layerOrder`/`enclosure`/`pan` 等は FIXED_BY_FLOW、`shape`/`zones` は UNAVAILABLE、`RUNTIME_SUPPORTED_CAPABILITIES = []`。ツールがこの記述の drift を検出する。 |
| Free cook | `CONFIRM_MAKING_STEP` は step の中身で gate されない → **SAUCE を空のまま次へ進める = ソースなしは今すでに作れる**。free cook は `DEFAULT_COOKING_PROFILE`（CUT なし、POST_BAKE なし）。 |
| POST_BAKE | `GamePhase` に `POST_BAKE` があり、`FINISH` は post-bake step として予約済み（gameplay なし）。 |
| Runtime content | 25 recipes / 29 ingredients / sauce 3種（tomato-sauce, olive-oil, pesto）。**ソースなしの recipe は 0**。技法 capability を要求する recipe も 0。 |
| Hint 3.0/4.0 | fact grammar `<kind>:<value>` に `tech:` / `finish:` / `shape:` / `pan:` が予約済み。save は未知 kind を保持し gameplay は無視（`persistence.ts` `discoveryHintFacts`）。DH4 §14 は「技法ヒント（D 家族）」を同じ枠に差し込める設計。 |
| Scoring 2.0 | sauce component は reference sauce がある時だけ計算（`available:false` 経路あり）。**ソースなし recipe を入れる時は、その経路で重みが正しく再配分されるかを実装監査で確認する必要がある**（未検証、§17 R-3）。 |
| Dinner (DM-3R-2) | recipe-free に作ったピザを signature で自動判定する。Technique 検出を Dinner でも行うかは OD-TQ-10。 |

---

## 2. 定義: Recipe Discovery / Technique Discovery / Material

| | Recipe Discovery | **Technique Discovery** | Material |
|---|---|---|---|
| 何を見つけるか | 「このピザ」— 材料集合＋identity 軸の完全一致 | 「このやり方」— identity 軸の*非既定値*を初めて使って完成させた | 「この材料」— 入手 |
| 単位 | recipe（25 → 101 → 172） | technique（1.0 で 3、将来 12 前後） | ingredient |
| 条件 | exact signature match ＋ そのレシピの Completion Gate PASS | その軸の非既定値を含むピザが **recipe-free Completion PASS**（一致するレシピが無くてもよい） | Shop 購入（ladder で AVAILABLE） |
| Shop で買えるか | 買えない（Hint は事実を売るが答えは売らない） | **買えない。Hint も未発見技法の中身は売らない（§8）** | 買う |
| Progression が開くもの | — | 「その操作ができる余地」（affordance slot）だけ | AVAILABLE_TO_BUY |
| 記録先 | Dex（BEST ★、timesMade） | Technique 台帳（★なし） | ownedIngredientIds / inventory |
| 演出 | 「発見した！🍕○○」 | 「新しい調理法！✋○○」 | 購入完了 |
| 繰り返しの価値 | ★/BEST 更新、Pitz | なし（一度きり）。以後その技法を使うレシピ群が探索対象になる | 在庫 |
| 失敗しても | ORIGINAL（オリジナルピザ） | 技法を使ったオリジナルピザでも発見になる | — |

一言でいうと **Recipe は「答え」、Technique は「問いの広がり」**。Technique を見つけても直接ピザは増えないが、「まだ見つけられるピザ」の空間が広がる。

**不変条件（INV-TQ-1）:** 発見済み recipe が要求する技法は、すべて発見済みである。
（recipe 発見と同時に技法も発見されるので通常は自然に成立。ロード時と書き込み時に backfill して強制する。）

---

## 3. 候補監査（172 recipe mechanic matrix 根拠）

`tools/cooking_techniques_audit.py` の出力。「required」は Phase-1 の required strength（source / catalog evidence）のみ。repo inference は candidate-only に分け、required に昇格させない。「solo」は ready target のうち他の capability を要求しないもの、「buildable」はさらに材料がすべて runtime にあるもの。

| 候補 | 対応 capability | Verdict | required | candidate-only | ready | solo | buildable | runtime 25 で該当 | runtime の軸（今日） |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 焼く前にのせる | — | **BASELINE** | 172 | 0 | 87 | 57 | 14 | 25 | 唯一のタイミング |
| **焼いた後にのせる（後乗せ）** | LATE_ADDITION (post) | **TECHNIQUE** | 8 | 11 | 2 | 2 | 0 | 0 | FIXED_BY_FLOW |
| 途中でのせる | LATE_ADDITION (mid) | TECHNIQUE_LATER | 4 | 0 | 1 | 1 | 0 | 0 | FIXED_BY_FLOW |
| **ソースなし** | — | **TECHNIQUE** | 44 | 0 | 26 | 23 | 2 | 0 | **OBSERVED** |
| **複数 spread** | MULTI_SPREAD_LAYER | **TECHNIQUE** | 17 | 10 | 9 | 9 | 2 | 0 | FIXED_BY_FLOW |
| 特殊なソース | — | **MATERIAL** | 33 | 0 | 26 | 18 | 4 | 8 | OBSERVED |
| 特殊形状：四角 | DOUGH_SHAPE_TARGET | TECHNIQUE_LATER | 4 | 0 | 1 | 0 | 0 | 0 | UNAVAILABLE |
| 特殊形状：舟形 | DOUGH_SHAPE_TARGET | TECHNIQUE_LATER | 1 | 0 | 0 | 0 | 0 | 0 | UNAVAILABLE |
| 包む・折る・かぶせる | ENCLOSE | TECHNIQUE_LATER | 5 | 0 | 3 | 1 | 0 | 0 | FIXED_BY_FLOW |
| CUTなし | — | **SERVE_ATTRIBUTE** | 1 | 0 | 0 | 0 | 0 | 0 | identity 外 |
| pan / tray | PAN_BAKE | TECHNIQUE_LATER | 8 | 0 | 3 | 0 | 0 | 0 | FIXED_BY_FLOW |
| 生地の種類（ピアディーナ等） | DOUGH_VARIANT | **MATERIAL** | 33 | 0 | 13 | 8 | 4 | 0 | FIXED_BY_FLOW |
| チーズを先に | STEP_ORDER | TECHNIQUE_LATER | 2 | 0 | 1 | 1 | 1 | 0 | FIXED_BY_FLOW |
| 区切ってのせる | ZONED_PLACEMENT | TECHNIQUE_LATER | 1 | 2 | 1 | 1 | 0 | 0 | UNAVAILABLE |
| 下ごしらえ | PREP_STEP | TECHNIQUE_LATER | 3 | 0 | 1 | 1 | 0 | 0 | FIXED_BY_FLOW |
| 揚げる | FRY_COOK | TECHNIQUE_LATER | 1 | 0 | 1 | 1 | 0 | 0 | FIXED_BY_FLOW |
| 折り重ねる | LAMINATE | TECHNIQUE_LATER | 1 | 0 | 0 | 0 | 0 | 0 | FIXED_BY_FLOW |

検証: 技法への分割は Phase-1 の capability 行数と一致する（後乗せ＋途中のせ = LATE_ADDITION 12 行、四角＋舟形 = DOUGH_SHAPE_TARGET 5 行など）。ツールが不一致で fail する。

### 3.1 候補ごとの判断

- **焼く前にのせる（BASELINE）。** 全行・全 runtime recipe の既定。発見対象にはならない。ただし、後乗せを発見した時の説明で「いつもは“焼く前”」という対比に使う。
- **後乗せ（TECHNIQUE）。** 新しい動詞ではなく**タイミング**。既存の TOPPING 操作をオーブンの後でもう一度使うだけなので、教える負荷が最小で、偶然も起きやすい。`POST_BAKE` phase と `FINISH` step がすでに予約されている。弱点は内容で、ready は BBQチキン（step 20, mid）とわさび牛（step 61, endgame）の 2 行だけ、どちらも新材料が 3 つ要る。page-8 の生サラダ系 7 行とタコピザは inference なので required に数えない（OD-TQ-12 で昇格を判断）。
- **途中のせ（LATER）。** BAKE を一度止めて再開する新しい時間操作が要る。後乗せの派生として後にする。うなぎは mode が未確定。
- **ソースなし（TECHNIQUE）。** 「省く」という発想の発見。**runtime は今すでに観測できる**（`sauceBase = []`）ので、新しい操作はゼロ。ready 26 行と数が多い（チーズ系 33、ノンソース 10、チーズ（トマトなし）1）。ただし現在の 25 レシピには該当が 0 なので、単独で入れると「発見しても行き先がない」dead technique になる。レシピを 1 つ以上同時に入れる必要がある。
- **複数 spread（TECHNIQUE）。** SAUCE 塗りを 2 回やる。「上書きではなく重ねる」という発見。runtime は現在「新しいソースが古いソースを置き換える」。ready 9 行。そのうちグランマ（tomato＋olive-oil＋garlic＋mozzarella）とスフィンチョーネは runtime 材料だけで作れる。オイルの「仕上げがけ」は後乗せと概念が重なるが、エビデンスに timing は書かれていない。そのため別技法とし、timing を捏造しない。
- **特殊なソース（MATERIAL）。** 操作は同じで、違うのは材料だけ。Technique にすると「ソースを買えば技法が増える」形になり、Shop で答えを買う構造に戻ってしまう。Recipe / Material 側に置く。
- **特殊形状（LATER）。** D3A の 8 点 doughShape では四角は作れず、判定もできない。形状判定・shape-aware CUT が要り、四角の行のほぼすべてが PAN_BAKE も要る。舟形は 1 行で BLOCKED。
- **CUTなし（SERVE_ATTRIBUTE）。** CUT は identity ではない（signature が意図的に除外している）。「切らない」を発見しても新しいピザは生まれない。包む技法などの結果として付随する属性にとどめる。runtime では New Haven Apizza だけが CUT なしだが、これはエビデンス不足の結果であり技法ではない。
- **pan（LATER）。** 「道具」。ready 3 行はすべて DOUGH_VARIANT も要る。道具自体は入手物で、技法は「型に入れて焼いて完成させた」初回、という形なら成立する。
- **生地の種類 / ピアディーナ（MATERIAL）。** Phase-1 の結論どおり、ジェスチャーは変わらない（生地カードを選ぶだけ）。材料と同じ入手物にする。ピアディーナ（`flatbread-unleavened`）は ready で、ソースなしでもある。つまり「NO_SAUCE を知っている × 平焼き生地を持っている」で発見できる、後半の良い合流点になる。

---

## 4. Technique 1.0 モデル（affordance → 試行 → 認識 → 知識）

```
[Ladder step: TECHNIQUE_SLOT]  → affordance が現れる（例: 焼成後にトレイが閉じない）
        │                         ※ 名前も説明も出ない。Technique Dex に「？？？」枠が1つ増えるだけ
        ▼
[プレイヤーが試す]             → signature のその軸が非既定値になる（OBSERVED）
        ▼
[recipe-free Completion PASS] → 初回なら TECHNIQUE_DISCOVERED（台帳に追記、演出）
        ▼                         同時に recipe exact match なら RECIPE_DISCOVERED も（§7）
[知識として定着]               → その技法を使う未発見レシピ群が「探索の新しい空間」になる
                                   Hint が該当 fact（finish:/tech:/none:sauce）を扱えるようになる（§8）
```

### 4.1 三層の分離

| 層 | 何か | 誰が開く | 保存 |
|---|---|---|---|
| **Capability（runtime 能力）** | その操作が実装されている | コード（`RUNTIME_SUPPORTED_CAPABILITIES`） | なし |
| **Affordance（そのプレイヤーに見える）** | UI にその余地が現れている | Discovery Ladder の `TECHNIQUE_SLOT` step（発見数） | 派生（Dex 発見数から毎回計算） |
| **Technique knowledge（発見済み）** | そのプレイヤーが自分でやった | プレイ（初回 PASS 完成） | `discoveredTechniqueIds` 台帳 |

### 4.2 matcher の観測ルールの変更（最小）

- Phase 2 のルール「capability が unlock されるまでは既定値を仮定する」を、**「affordance が出ている軸は OBSERVED、出ていない軸は従来どおり FIXED_BY_FLOW／既定値」**と読み替える。
- **matching は technique knowledge を条件にしない。** 未発見の技法でも、やって一致すれば recipe は発見される（技法も同時に発見される）。こうすると「技法を知っていないとレシピが見つからない」という順序依存の deadlock が構造的に起きない。
- NO_SAUCE は軸がすでに OBSERVED なので、matcher は変わらない。変わるのは検出と記録だけ。

---

## 5. Technique Dex の要否と UNKNOWN 表示

**推奨: 独立画面は作らない。Pizza Dex の中に「調理法」セクション（横一列のチップ／カード）を置く。**（OD-TQ-4）

理由: 技法は 1.0 で 3 個、将来でも 12 前後。独立画面にするほどの量がない。一方で「見えない枠がある」ことは探索の動機になるので、Dex を開いた時に常に目に入る場所に置く。

| 状態 | 表示 | 条件 |
|---|---|---|
| 非表示 | 何も出さない | affordance の ladder step にまだ届いていない（未来の技法の総数は見せない。「1/12」のような圧をかけない） |
| **UNKNOWN** | 「？？？」＋手のシルエット＋**固定の一行なぞかけ**（無料、Pitz 不要） | affordance が出た。例: 後乗せ「オーブンから出したあとも、ピザはまだ終わってない…？」、ソースなし「いつもの“ぬるもの”がなくても…？」、複数 spread「一度ぬったら、それでおしまい…？」 |
| 発見済み | 技法名、初回に作ったピザ（オリジナルなら「じぶんのピザ」）、「この調理法を使うピザ：発見 x / まだ ?」 | 台帳にある |

- 「まだ ?」の数（未発見レシピ数）を出すかは OD-TQ-5。推奨は**数を出す**（名前は出さない）。既存 Dex の未発見表示との整合は TQ-1 の Fresh Audit で確認する。
- **Recipe 側の UNKNOWN カード**には技法アイコンを**出さない**（未発見レシピの一部にだけ技法アイコンが付くと、どれが技法レシピかが漏れる。DH3 §13 の「uniform presentation」原則）。発見済み技法についても、未発見レシピのカードには出さない。技法の関与を知る手段は Hint の fact 購入だけにする（§8）。

---

## 6. 初回発見条件（検出ルール）

`detectTechniquesUsed(signature, affordances) → TechniqueId[]`（pure）。発見は次をすべて満たした時:

1. その技法の affordance が出ている（ladder step 到達）。**affordance より前にたまたまやっても発見にしない。** 例: NO_SAUCE は runtime で最初から作れるが、onboarding の最初の数回に「ソースを塗り忘れたピザ」で「新しい調理法！」を出すのは誤学習になる。
2. ピザが **recipe-free Completion PASS**（生地＋1品以上＋generic bake window。free cook と同じ `evaluateFreeCookCompletion`）。焦げ・生焼け・空のピザでは発見にしない。
3. 技法の軸が非既定値である。
   - NO_SAUCE: `sauceBase = []` かつ cheese/topping が 1 つ以上ある（空ピザは条件 2 で落ちる）。
   - 後乗せ: `late` に mode `post_bake` の ingredient が 1 つ以上ある。
   - 複数 spread: `spreadLayers.length ≥ 2`。
4. 台帳にまだ無い（exactly-once。REGISTER_TO_DEX と同じ「phase が RESULT の時だけ 1 回」の guard に乗せる）。

**対象ラウンド:** free cook（FREE）のみ推奨。Dinner（recipe-free 自動判定）も含めるかは OD-TQ-10。Lunch Rush と guided recipe round（Pizza Select から選んだ発見済みレシピ）では発見しない。guided round で使う技法は、INV-TQ-1 によってすでに発見済みのはず。

**失敗系:**

| 状況 | 結果 |
|---|---|
| 後乗せしたが焦げた | 発見なし。Teto:「なにか新しいことをしたね…焼き加減をととのえて、もう一度？」（技法名は言わない） |
| affordance 前にソースなしで完成 | 発見なし。通常の ORIGINAL。 |
| 同じ技法を 2 回目 | 何も起きない（演出なし）。 |
| 1 枚で技法 2 つを同時に初使用 | 両方発見。演出はまとめて 1 画面、最大 2 行（1.0 の技法構成では後乗せ＋複数 spread の組み合わせ等で起こりうる）。 |

---

## 7. Recipe 発見との同時発生

同じピザで技法の初回使用と recipe の NEW_DISCOVERY が重なる場合（最も気持ちいい瞬間）:

- **順序: 技法 → レシピ。** 1 つの DISCOVERED 画面の中の 2 段演出にする。「新しい調理法！✋後のせ」（約 1.5 秒）→「発見した！🍕BBQチキン」。「やり方を見つけたから、このピザにたどり着いた」という因果の順番に合わせる。
- 報酬（Pitz／⭐）は recipe 側だけに付く（§9）。技法は台帳への記録と演出だけ。
- ALREADY_DISCOVERED のレシピに技法の初回が重なることは、INV-TQ-1 により起きない（起きたら backfill 漏れ）。
- INCOMPLETE_MATCH（signature は一致したが recipe の gate で落ちた）でも、recipe-free PASS なら技法は発見される。これは正しい挙動で、技法は「やり方」だから。
- **新しい near-miss（DIMENSION_MISMATCH）:** 材料集合は target と一致するが identity 軸だけが違う場合。例: BBQチキンの材料をそろえたのに、パクチーを焼く前にのせた。このときは「材料はぴったり。でも、なにかが違う…？」と出す。**軸名は tier 1 では言わない。** 技法が未発見のままこの near-miss が 2 回続いたら tier 2 で「のせる“タイミング”かも？」（無料の Teto ヒント）。これが偶然発見の最大の導線になる（§14）。affordance が出ていない軸では DIMENSION_MISMATCH を出さない。出すと「できないこと」を示唆してしまう。

---

## 8. Hint との関係

原則: **Hint は「レシピについての事実」を売る。技法の存在ややり方そのものは売らない。**

| 状況 | Hint sheet（Pitz） | Teto（無料、試行回数で段階化） |
|---|---|---|
| 技法の affordance 前 | 技法の行を出さない（全レシピ共通で非表示なので漏れない） | 何も言わない |
| affordance あり・未発見 | **技法の行を出さない**。未発見技法の答えを Pitz で買える形にしない（OD-TQ-6） | Technique Dex のなぞかけ（固定）＋ §7 の DIMENSION_MISMATCH tier 1/2。さらに「その技法を要するレシピしか作れる候補が残っていない」状態で N 回（推奨 3）新発見がなければ、tier 3 で「焼き上がったピザに、なにかのせてみたら？」と直接的に言う。deadlock 防止の最後の砦で、Phase 2 の onboarding tier と同じ考え方 |
| 発見済み | その技法の fact 行が**全レシピに一律で**出る（例:「仕上げ：あり/なし」、`finish:<ing>`、`none:sauce`）。DH3 §13 の fact grammar と DH4 の k-anonymity をそのまま使う | 通常のヒント |

- fact id の案: `none:sauce`（既存 grammar に沿う）、`finish:<ingredientId>`（後乗せ）、`ing:<sauce>:layer-2`（複数 spread）。**いずれも DH3 H3-2 の save 検証 grammar に既に収まる**ので、保存形式の変更は不要。
- DH3 §13 の「capability の行は runtime がサポートした時に全レシピに出す」を、「**そのプレイヤーが技法を発見した時に**全レシピに出す」に強める（OD-TQ-6）。uniform 性は保ったまま、未発見技法の存在は漏れない。

---

## 9. ★ / Pitz との関係

- **技法は ★ を生まないし、★ で開かない。** OD-REC04-1（★は unlock 条件にならない）をそのまま技法にも適用する。
- ★ / BEST は従来どおり recipe の品質。技法を使う recipe では、技法部分（例: 後乗せの piece）も Scoring 2.0 の pieces / quantity で評価する。ただしそのためには Reference fixture と scoring の拡張が要る（後乗せ slice の仕事。§19）。
- **技法発見に Pitz ボーナスを付けない**（推奨、OD-TQ-7）。経済が変わると simulation の再検証が必要になる。演出と「探索空間の拡大」自体を報酬にする。
- 技法の affordance は発見数 ladder で開く。★ の多寡では開かない（下手でも広がる）。

---

## 10. Progression gate

- `ProgressionStepKind` に `"TECHNIQUE_SLOT"` を追加する（`discoveryLadder.ts` の doc が想定済みの拡張）。step `s` に到達すると、その技法の affordance が出る。
- slot の位置は既存の key-recipe ルールに合わせる。**その技法を要する ready target が、その時点の所持材料か、直後の 1〜2 step の材料で作れる位置**に置く。dead technique（発見しても行き先がない）を validator で禁止する（REC-04 の「no useless unlock」と同じ）。
- Phase 2 M2 の「最初の 12 発見は技法なし、以後 6 発見ごと」のペースは踏襲する（教える負荷の上限として。OD-TQ-8）。runtime 25 レシピの現在の ladder は 24 step なので、1.0 のパイロット技法は「発見 12 以降」のどこかになる。
- Material と技法が同じ step に来ることは許すが、演出上は別にする（材料は Shop に「入荷」、技法は Dex に「？？？」が 1 つ増えるだけ。**通知は出さない**。気付くこと自体が発見の一部）。通知を出すかは OD-TQ-9。

---

## 11. Tutorial

**原則: 事前チュートリアルなし、事後の振り返りあり。**

- 事前: 技法名もやり方も説明しない。affordance は「押してはいけなさそうに見えない」UI にする（§14）。
- 事後（発見直後）: 演出の最後に 3 コマの「いま、こうやったね」リプレイカード。例: 後乗せ = 焼く → 焼き上がり → のせた。「次からも、焼いたあとにのせられるよ」。**これが実質のチュートリアル**で、自分がやったことの言語化になる。
- 取りこぼし救済: §8 の Teto tier 3。それでも見つけられなければ、Technique Dex の UNKNOWN カードを長押しで「やり方を見る」（Pitz 不要）を出すかは OD-TQ-11（推奨: 出さない。tier 3 で十分）。
- Onboarding（Margherita）には一切混ぜない（§6 条件 1）。

---

## 12. Save schema / legacy save

**推奨: schema version は上げない。** v2 に台帳を 1 本追加する（`starterGrantClaimedRecipeIds` / `unlockedForShopIngredientIds` / `discoveryHintFacts` と同じ「予約して、無ければ空として読む」パターン）。

```ts
interface PersistentSaveV2 {
  // ...既存...
  /** Cooking Techniques 1.0: 発見済み技法 id の台帳。追記のみ（union）、resetSave 以外で減らない。 */
  discoveredTechniqueIds: string[];
}
```

| ケース | 扱い |
|---|---|
| 旧 save（フィールドなし／壊れている） | `[]` として読む |
| ロード時 backfill（INV-TQ-1） | Dex の発見済み recipe が要求する技法を union で追加する。**現在の 25 レシピは技法を要求しないので、実際には no-op**。将来、技法レシピを追加した後に旧 save を読んだ場合も、同じ規則で自然に正しくなる |
| 未知の技法 id（新しい build が書いたもの） | `writeSave` の forward-compat merge で**保持**し、gameplay では無視する（I0／P3-4B と同じ） |
| 形式 | `^[a-z][a-z0-9_]{0,31}$` 程度の id grammar。重複除去、上限（例: 64） |
| 実績リセット（UX-5）／Full Game Reset | 台帳を `[]` に戻す（Dex と同じ扱い）。affordance は発見数から派生するので、別途リセットは要らない |
| 記録しないもの | 初回日時、初回ピザ、使用回数。1.0 では台帳（id だけ）に限定する。Dex カードの「初回に作ったピザ」表示を採用する場合だけ `techniqueFirstRecipe: Record<id, recipeId | null>` を追加する（OD-TQ-13）。 |

affordance を保存しない理由: 発見数から毎回派生できるので、保存すると二重 authority になる（`materialEntitlement` が ledger 化したのは「再生成で re-lock しない」ためだった。技法 affordance でも ladder の再生成で消えないように「一度出た slot は消さない」必要があるなら、そこだけ ledger 化する。OD-TQ-14）。

---

## 13. 172 recipes への適用

ツールの per-row 表（`TETO_COOKING-TECHNIQUES_1.0_ROWS.md` §4）で、全 172 行に required 技法／candidate-only 技法／非技法タグ（MATERIAL・SERVE）を割り当てた。

- 1.0 の 3 技法（後乗せ・ソースなし・複数 spread）で開く ready target: 2 + 26 + 9（重複あり）。
- MATERIAL 扱い（生地の種類・特殊ソース）は技法台帳に入らない。材料／生地カードとして ladder で扱う。
- CUTなしは技法台帳に入らない。ENCLOSE の技法を実装する時に `cutServe` 属性として一緒に扱う。
- BLOCKED 行（85）は、技法を割り当てても target にしない（Phase 2 の規則どおり）。page-8 の生サラダ系「後乗せ」は candidate-only のまま（OD-TQ-12）。

---

## 14. 偶然発見できる設計（原則）

1. **余地は見えるが、指示はしない。** 後乗せなら、焼き上がり後にトレイが閉じずに残る。CTA は「完成！」だけ。トレイに「？」や光るアイコンを付けない。
2. **試しても損しない（可逆・低コスト）。** 後乗せの piece は完成前なら戻せる。在庫消費は既存 TOPPING と同じで、ペナルティは作らない。
3. **やった瞬間に、違いが見た目でわかる。** 後乗せの piece は焼き色が付かない（フレッシュ・つやあり）。ソースなしは生地の地色が見える。複数 spread は 2 色のマーブル。**「何か普段と違うことが起きた」という手応え**が、演出の前に来る。
4. **失敗しても次の手がかりが出る。** DIMENSION_MISMATCH near-miss（§7）。
5. **最後は必ず教える。** Teto tier 3（§8）。deadlock しない。
6. **余地は既存の操作の中にだけ作る。** 新ボタンを増やさない。後乗せ = TOPPING の再利用、ソースなし = SAUCE step を飛ばす（既存の「次へ」）、複数 spread = SAUCE 中に 2 つ目のソースを選ぶ（今は置き換わる）。

---

## 15. Player journey: 「後乗せ」

前提（例示。数値は OD で確定）: 発見数 18、所持材料に bbq-sauce / chicken / cilantro がある（mid tier。Phase-2 では BBQチキンは step 20）。後乗せの `TECHNIQUE_SLOT` に到達した直後。

### ① 発見前（affordance が出た）

- free cook で BAKE を確定すると、今までは即 RESULT だった。今回から**焼き上がったピザが作業台に戻り、下にトレイ（TOPPING カテゴリ）が開いたまま**になり、CTA は「完成！」だけ。
- Teto:「焼きたて！いい香り〜」（指示なし）。Pizza Dex の「調理法」欄に「？？？ ─ オーブンから出したあとも、ピザはまだ終わってない…？」が 1 枠増えている（通知なし）。
- 多くのプレイヤーはそのまま「完成！」を押す。**何も失わない**（1 タップ増えるだけ。OD-TQ-3 で自動完成の猶予も検討）。

### ② 試す

- 気付いたプレイヤー、または BBQチキンの材料で「材料はぴったり。でも、なにかが違う…？」（DIMENSION_MISMATCH tier 1）を 2 回見たプレイヤーが、焼き上がったピザにパクチーをドラッグする。
- パクチーは**焼き色なし・つやあり**で置かれ、置いた瞬間に小さく湯気がふわっと出る（§14-3）。

### ③ 成功

- 「完成！」→ recipe-free Completion PASS。
- signature: `late = [["post_bake", ["cilantro"]]]`（OBSERVED）、材料集合 = {bbq-sauce, chicken, cilantro, mozzarella, onion} → BBQチキンと exact match。

### ④ Technique 発見（＋同時に Recipe 発見）

1. 「✋ 新しい調理法！**後のせ**」→ 3 コマ振り返り（焼く → 焼き上がり → のせた）「焼いたあとにのせると、フレッシュなまま仕上がるよ」。
2. 続けて「🍕 発見した！**BBQチキン**」。⭐・Pitz・Dex は既存の REGISTER_TO_DEX 経路のまま。
3. Dex の「調理法」欄の後のせカード:「この調理法を使うピザ：1 / ?」。

別ルート: BBQ の材料を持っていないプレイヤーが、マルゲリータの材料でバジルを焼いた後にのせた場合。→ ORIGINAL だが「✋ 新しい調理法！後のせ」は出る。「この調理法を使うピザが、まだどこかにあるみたい」。**オリジナルピザでも技法は発見できる**（§6）。
（注: 「マルゲリータのバジル後のせ」というレシピはエビデンスに無いので、target にはしない。）

### ⑤ 新レシピ探索

- Hint sheet の全レシピに「仕上げ（焼いた後）」の行が一律に現れ、`finish:<ing>` の fact が買えるようになる。
- 未発見の後のせレシピ（1.0 の ready ではわさび牛。page-8 系は OD-TQ-12 次第）が探索対象になる。「何を焼いた後にのせる？」という新しい問いが、既存の全材料に対して生まれる。
- guided round（Pizza Select から BBQチキンを選ぶ）では、FINISH step がタブとして明示される（発見済みなので教えてよい）。

---

## 16. 他モードとのガード

- **Lunch Rush:** 発見済みレシピだけを出す（既存）。技法レシピの order でも、guided profile の FINISH step が出るだけ。技法の発見は起きない。
- **Dinner:** recipe-free で自動判定する。技法検出を行うかは OD-TQ-10（推奨: 行う。Dinner も「自由に作る」場なので）。
- **Discovery Ladder:** `TECHNIQUE_SLOT` は material step と同じ番号空間に入る。発見数の数え方（Dex）は変えない。
- **Scoring 2.0 authority:** 技法 slice ごとに Reference fixture と component の扱いを明示し、既存 25 レシピの点数が変わらないことを回帰テストで固定する（A1 以来の「authority を黙って変えない」ガード）。

---

## 17. リスク

| # | リスク | 対策 |
|---|---|---|
| R-1 | 後乗せの ready 内容が薄い（2 行、新材料 6） | TQ-2 で BBQチキンを材料 3 つとともに入れる。または OD-TQ-12 で page-8 の inference 行を昇格する（エビデンスの再確認が必要） |
| R-2 | ソースなしの誤学習（onboarding でソースを塗り忘れる） | affordance gate（§6-1）と「cheese/topping が 1 つ以上」の条件 |
| R-3 | ソースなしレシピの Scoring 2.0（sauce component が 0 点扱いになる危険） | TQ-1 の実装監査で `available:false` による重み再配分を確認し、回帰テストで固定。これが崩れるなら TQ-1 のパイロットを複数 spread に切り替える |
| R-4 | 焼成後にトレイが残ることで、全ラウンドに 1 タップ増える | 後乗せの affordance 到達後だけ。短い自動完成猶予も検討（OD-TQ-3） |
| R-5 | UNKNOWN 表示やヒントの行が技法レシピを漏らす | 一律表示（uniform）と、未発見レシピのカードに技法アイコンを出さないことで防ぐ |
| R-6 | Phase 2 M2（付与して教える）との二重 authority | OD-TQ-1 で本設計の採否を決め、採用なら Phase 2 §6 に superseded 注記を入れる（別 PR） |

---

## 18. Owner Decisions

| ID | 決めること | 推奨 |
|---|---|---|
| **OD-TQ-1** | 技法は「ladder で affordance を開き、発見はプレイ」とするか（Phase 2 M2 の「⭐ gate で付与、Teto が教える」を置き換える） | **採用** |
| **OD-TQ-2** | Technique にする候補 | 1.0: 後乗せ・ソースなし・複数 spread。LATER: 形状・pan・包む・途中のせ・逆順・区画・下ごしらえ・揚げ・折り重ね。**非技法**: 焼く前（BASELINE）、特殊ソース・生地種類／ピアディーナ（MATERIAL）、CUTなし（SERVE） |
| **OD-TQ-3** | 後乗せの affordance の出し方（焼成後にトレイを残し「完成！」だけ／自動完成猶予の有無） | トレイを残す。自動完成なし（明示タップ） |
| **OD-TQ-4** | Technique Dex の形 | Pizza Dex 内の「調理法」セクション。独立画面なし |
| **OD-TQ-5** | UNKNOWN 表示（affordance 前は非表示、後は「？？？」＋固定なぞかけ）と「使うピザ x / ?」の数表示 | 両方採用 |
| **OD-TQ-6** | Hint は未発見技法を一切売らず、技法 fact 行は「プレイヤーが発見した時」に全レシピ一律で出す | 採用 |
| **OD-TQ-7** | 技法発見の報酬（⭐・Pitz なし、演出だけ） | なし |
| **OD-TQ-8** | 技法 slot のペース（最初の 12 発見は技法なし、以後おおむね 6 発見ごと） | Phase 2 M2 のペースを踏襲 |
| **OD-TQ-9** | affordance 出現の通知 | 通知しない（Dex に枠が増えるだけ） |
| **OD-TQ-10** | 技法検出を行うラウンド | free cook ＋ Dinner。Lunch Rush と guided round は検出しない |
| **OD-TQ-11** | 最終救済（UNKNOWN カードから「やり方を見る」） | なし。Teto tier 3 で十分 |
| **OD-TQ-12** | page-8 生サラダ系・タコ・ホットハニーの「後乗せ」inference を required に昇格するか | 今は昇格しない（エビデンス再確認を別タスクで） |
| **OD-TQ-13** | save に初回ピザを記録するか | 1.0 は台帳だけ（id のみ） |
| **OD-TQ-14** | affordance を派生にするか ledger 化するか | 派生。ladder の再生成で消える可能性が出た時点で ledger 化する |
| **OD-TQ-15** | 最初のパイロット技法（§19） | **NO_SAUCE ＋ オージー**（代替: 後乗せ ＋ BBQチキン） |

---

## 19. Technique 1.0 最小 slice 提案

### TQ-0（本 PR）

設計・監査ツール・Owner Decisions。docs/data/tools のみ。

### TQ-1 — 最小 slice（推奨）: 台帳・検出・演出 ＋ パイロット `NO_SAUCE` ＋ 1 レシピ

| 項目 | 内容 |
|---|---|
| Pure | `src/data/techniques.ts`（技法 registry: id / 表示名 / なぞかけ / 検出述語）。`detectTechniquesUsed(signature, affordances)`。INV-TQ-1 backfill。 |
| Ladder | `ProgressionStepKind += "TECHNIQUE_SLOT"`。25(+1) レシピの ladder を再生成し、NO_SAUCE slot を「発見 ≥ 12」かつオージーの材料（egg / bacon / onion）が揃う位置に置く。dead-technique validator を追加。 |
| Reducer | free cook の CONFIRM_BAKE → REGISTER_TO_DEX の exactly-once 経路で `lastTechniqueDiscovery` を立て、台帳に追記する。 |
| Save | v2 に `discoveredTechniqueIds` を追加（bump なし）、forward-compat、reset。 |
| Content | **オージー**（{bacon, egg, mozzarella, onion}、ソースなし、PIZZA DB READY、review 項目なし、全材料が runtime にある）を 1 レシピ追加。Reference fixture を付け、Scoring 2.0 の no-sauce 経路を確認する（R-3）。 |
| UI | DISCOVERED の技法段（技法 → レシピの 2 段演出）、Dex の「調理法」セクション（UNKNOWN / 発見済み）。**新ジェスチャーなし。** |
| 検証 | unit（検出・exactly-once・backfill・forward-compat・既存 25 レシピの点数不変）、E2E、Human Verification（390×844 動画＋before/after スクショ。ポリシー準拠） |

TQ-1 を最小に推す理由: 「affordance → 試行 → 認識 → 知識 → 新レシピ探索」の**ループ全体を、新しい操作なしで端から端まで検証できる唯一の技法**だから。仕組みの検証と操作の検証を分けられる。

### TQ-2: 後乗せ（ユーザー例の本命）

- FINISH step の gameplay（TOPPING の再利用。焼き色なしの見た目）。
- free cook の POST_BAKE optional 化（affordance）。
- `late` 軸を OBSERVED にし、DIMENSION_MISMATCH near-miss を追加。
- Scoring 2.0 に finish piece を追加。
- Content: BBQチキン（bbq-sauce / chicken / cilantro の材料 3 つと絵を含む）。

### TQ-3: 複数 spread

SAUCE の 2 層目を追加し、グランマ・スフィンチョーネ（runtime 材料のみで作れる）を入れる。

### 代替案（OD-TQ-15 で「最初は後乗せ」を選ぶ場合）

TQ-1′ = TQ-1 の台帳・検出・演出 ＋ TQ-2 の全部。規模は約 2 slice 分で、新材料 3 つの絵が要る。Human Verification の範囲も大きくなる。

---

**STOP.** 実装は行わない。Owner Decisions（OD-TQ-1…15）の回答を待つ。
