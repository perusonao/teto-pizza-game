# Discovery 3.0 — Progressive Recipe Reconstruction Fresh Design Audit（DESIGN / DOMAIN AUDIT・DOCS ONLY）

- audited main: `262b09fcb78d98c7b12ea4e5b51c2da1bca9d37e`（`origin/main` を fresh fetch。latest known main と一致、進んでいない）
- 種別: 設計監査のみ。実装・Issue・PR なし。No.28 は選ばない。Step 14 / Grandma は進めない・決めない。R6 / IP-2 へ進まない。型・schema は確定しない。
- 再利用（read-only・再監査なし）: 直前の Recipe Discovery Mode 監査（`c560475`, branch `claude/discovery-3-recipe-discovery-audit-gfr3n6`）の「FREE は Pizza Select を通らない」「#345 Candidate Count 契約」「OPEN_POOL 固定文言契約」。Branch Placement の A/B/C 型。Grandma は未参照。
- authority: 事実は production code（`src/…`）で確認。docs は補助。
- probe: Python の read-only 集計のみ（recipes / ingredients / ladder を正規表現で読むだけ。実ゲームの reducer は動かしていない）。一時 script は commit していない。結果の要約は `docs/reports/data/TETO_DISCOVERY-3_PROGRESSIVE-RECIPE-RECONSTRUCTION.json`。test / build / E2E / screenshot / HV は未実施（docs-only）。

---

## 0. 先に伝えること（Owner 案の前提と production の差・新しく見つかった衝突）

| # | 内容 | 根拠 |
|---|---|---|
| X1 | **「？？？ごとに ？ ？ ？ を並べる」だけで STRUCTURE（材料の総数）が無料で漏れる。** Hint 5.0 は「材料の総数」を STRUCTURE rung（5 Pitz）で売っている。Dex に未判明 slot の数を出すと、それを課金なしで先出しする。 | `hint5Ladder.ts` §Stored facts（`meta:ingredient-total`）、価格 STRUCTURE 5 |
| X2 | **「トマト系」という分類は現 taxonomy に無い。** family は topping 専用の 7 種（meat / seafood / vegetable / herb / fruit / spice / other）。トマトは `vegetable`（「野菜・きのこ系」）、トマトソースは sauce の category。sauce / cheese は family ではなく category（名前を出す rung）。 | `ingredientTaxonomy.ts:58-92`、`hintClassDisplay.ts` |
| X3 | **Dex は既に「？？？が 2 件以上なら 1 枚の集約カードにし、slot 番号も件数も DOM に出さない」（PR-4b-A D-2）。** 仮登録を per-recipe で並べる案はこの契約を意図的に上書きする。 | `DexOverlay.tsx:84-123`（`aggregateUnknown`） |
| X4 | **`DISCOVERABLE` は stock≥1 を要求するため、調理で在庫が 0 になると状態が戻る**（`KNOWN_BUT_MISSING_MATERIAL`）。仮登録を DISCOVERABLE にそのまま連動させると entry が消える。登録は ownership（`ownedIngredientIds`、減らない）に紐づけるべき。 | `recipeDiscoveryState.ts`（`stockOf`）、`CONFIRM_BAKE` が唯一の consume 点 |
| X5 | **現 production 27 recipe は全て default identity dimensions。** つまり ingredient（sauceBase 含む）が全部分かれば recipe の identity は全部分かる。「knowledge complete ≠ discovered」を分けているのは Completion Gate（各材料≥1 piece・sauce 量・bake window）だけで、薄い。 | `discoveryCatalog.ts:70`、`matcher.ts`、`freeCook.ts` |
| X6 | **既存の `discoveryHintFacts`（recipeId → fact id 配列）は、すでに「recipe 単位の knowledge ledger」として保存されている**（`ing:` / `cls:` / `meta:`）。新 knowledge の保存先として再利用できる。 | `persistence.ts:387-430, 710` |

---

## 1. Fresh state

- `origin/main` = `262b09f`（#345）。直前成果物 `c560475` は別 branch に在り、main には入っていない。
- 本 report は専用 docs branch `claude/discovery-3-progressive-recipe-audit-it595m` のみ。

---

## 2. Provisional Recipe / 仮登録

- 仮登録 entry は **recipe を DISCOVERED にしない**。名前・Dex slot 番号・材料の全体像を出さない。
- ただし「今回解禁した材料を使う」は known として扱える。**これは常に真**: 新たに登録可能になった recipe R は、直前に買った材料 m が最後の欠けだったので、必ず m ∈ R（§13）。
- 登録条件の案（**monotonic・ownership 基準**）:
  `REGISTRABLE(R)` = 未発見 ∧ R の finite 材料が全て `ownedIngredientIds` に入っている ∧ finite 材料が 1 つ以上ある。
  - stock は見ない（X4）。starter のみの recipe（margherita）は finite 0 件なので対象外 → FTU の Margherita onboarding と衝突しない。
  - `ownedIngredientIds` は減らないので、**登録集合は state から毎回導出でき、別途保存する必要がない**（§12）。
- 表示ラベルは anonymous（`？？？` ＋ 登録順の識別子）。Dex の `No.xx` は出さない（slot 番号は recipe identity）。

---

## 3. Knowledge model（型は確定しない）

`RecipeDiscoveryState`（UNKNOWN / DISCOVERABLE / KNOWN_BUT_MISSING_MATERIAL / DISCOVERED）は **「その recipe を今作れるか・発見済みか」**。
`RecipeKnowledge` は **「player がその recipe について何を知っているか」**。入力も寿命も違うので分離できる（state は ownership / stock 由来、knowledge は経験由来）。

候補 knowledge fact:

| fact | 表示 | 既存の対応物 |
|---|---|---|
| EXACT_INGREDIENT(id) | ✓ 材料名 | `ing:<id>`（Hint の名前 rung） |
| CLASS(ingredient→family) | △ 〜系（名前は出さない） | `cls:<id>`（SUB_CLASS rung。保存は id、表示は family のみ） |
| STRUCTURE | 材料の総数 | `meta:ingredient-total`（STRUCTURE rung） |
| （将来）technique / dimension fact | — | 現 production 27 では不要（X5） |

- **source**（UNLOCK / ATTEMPT / HINT）は内部属性。player-facing では **EXACT と CLASS の 2 段階の違いだけ**見せれば足りる（source 別の見た目は不要。§9）。
- EXACT は同一材料の CLASS を包含する（Hint 5.0 の M3 と同じ: 名前は分類を含意）。
- 全 fact は **「player が自分の行動（購入・試作・Hint）で得たもの」だけ**。未使用の正解材料は決して入らない。

---

## 4. Unlock → 仮登録

§2 の REGISTRABLE をそのまま使う。production ladder（25 recipe + No.27）での事実（read-only 集計）:

- ladder は 26 step（W1 の 24 + chicken + 重複 1 は集計の都合）。**1 step で新規に registrable になる recipe は 25 step 中 24 step が 1 件、Step 12（onion）だけが 2 件**（`pizza-portuguesa` と `brazilian-calabresa`）。
- 材料 1 つの購入で同時に完成する recipe 数の最大は 2（onion）。
- ただし ladder は「discovered count ≥ step」で entitle されるだけなので、**買ったが調理していない backlog** があれば、player は 3 件以上の registrable を同時に持ち得る（上限は entitled 済み未発見数）。

edge:

| ケース | 扱い案 |
|---|---|
| 1 purchase で複数 recipe が registrable | 複数 entry（§6 の attribution 問題）。件数が見える問題は §10 |
| 後から recipe が追加され、既に材料を全部持っている | 次回評価で derive され、unlock 事象なしで registrable。unlock fact は `ownedOrder`（保存済み・append-order invariant）の「R の最後に取得した材料」で導出可能 |
| 在庫 0（再購入待ち） | entry は消さない（X4）。試作はできない |
| entitle されたが未購入（KNOWN_BUT_MISSING_MATERIAL） | **登録しない**。Shop の存在から recipe の有無を逆算させない |
| 非 provisional（UNKNOWN / KNOWN_BUT_MISSING）への attribution | **しない**。それらの材料は所持外で試作に使えず、attribution は「有る」ことの漏洩になる |

---

## 5. Attempt → Knowledge と Reveal Granularity（A / B / C / D）

前提（現 matcher）: attempt の identity は ingredientSet（sauce 含む）＋ sauceBase ＋ default dims の **完全一致**。完全一致 ∧ Completion Gate 通過 → DISCOVERED、それ以外は ORIGINAL（score / Dex / Pitz に残らない）。attempt X と登録 recipe R の交差 `X∩R` が knowledge の更新材料。

- 更新条件の共通ルール案: **ORIGINAL / INCOMPLETE_MATCH の結果が出た attempt のみ**（FAILED = 生焼け・焦げは無効）。**表示しないもの**は Owner 指定どおり（距離・類似度・Near/Far・「あと 1 個」・正解数・候補数・達成率・不足リスト）。

| 案 | 内容 | 推理性 | 総当たり耐性 | feedback | Notebook 重複 | Hint 重複 | 実装 | matcher 整合 |
|---|---|---|---|---|---|---|---|---|
| A | `X∩R` の EXACT を全部判明 | 高い（自分の構成で直接分かる）。ただし推理より「分割して試す」に寄る | 弱い。§12 の probe: 完全同定まで平均 1.0〜4.1 attempt | 明快 | 重なる（Notebook の「使った材料」と突き合わせれば同じ） | **Hint の名前 rung を無料で代替** | 小（交差 1 回） | 影響なし（matcher は触らない） |
| B | 未判明の正解から 1 個だけ | 中。**どれが出るか**は player が選べない | A より強いが、平均 +1.5 attempt 程度（probe） | 「新しい発見」が 1 つずつ | 重なり弱 | Hint 名前 rung の一部 | 中（どれを選ぶかの決定規則が要る。乱択は save-scum 可、固定は catalog 順が漏れる） | 影響なし |
| C | 「新発見あり」だけ通知し、別操作で 1 個確定 | 低〜中。確定の選択に player の agency | B と同等（情報量は同じ）＋ **「新発見あり」が単独で boolean oracle** | 二段で重い | 弱 | 「確定操作」が Hint と役割衝突 | 大（別 UI/state） | 影響なし |
| D | EXACT でなく CLASS だけ | 高（family は推理の足場） | 完全同定まで平均 3.6〜9.3 attempt（heuristic）。ただし **family 集合は 1〜数回で分かる** | △ 表示は新しく作れる | 弱 | **SUB_CLASS rung（5 Pitz）を無料で代替** | 中（`hint5Class` を流用） | 影響なし |

**所見（ランキングしない）**
1. A〜D のどれも「attempt が R の membership を漏らす」点は同じ。**Near/Far を消した理由（距離で hill-climb できる）とは別の形の oracle**なので、§12 で明示的に検証した。
2. 「何も新しく分からなかった」という**無表示そのものも情報**（X∩R\known = ∅）。B / C / D でも boolean oracle が残る。完全に消せるのは reveal を attempt 単位に紐づけない設計だけ（例: 複数 attempt 後にまとめて「研究報告」。ただしこれは feedback が遅れる）。
3. A と D は Hint 5.0 の rung と責務が重なる。**既存 fact ledger に載せ、重複分は M3 規則（0 Pitz で ALREADY_KNOWN）に寄せる**と整合する（§8）。

---

## 6. 複数 provisional recipe（attribution）

例: chicken 解禁で A・B が両方 chicken を使う。attempt `{chicken, mozzarella, tomato, pesto}` が複数に部分一致する。

| 案 | 内容 | identity leak | その他 |
|---|---|---|---|
| A | 一致した全 entry を更新 | entry は anonymous なので、per-entry の更新から catalog identity は出ない。ただし **「どの entry が更新されたか」自体が R の membership 情報**（X が A だけに当たった = B は X を含まない）。entry 間比較で絞り込める | 実装は最小 |
| B | 1 entry だけ更新 | どれを選ぶかの規則が漏れ口（catalog / 登録順 / 乱択のどれでも、player が「なぜこの entry か」を推測できる）。他の entry が「当たっているのに更新されない」ので **更新されなかった = 当たっていない、とは言えなくなり** 情報は歪む | player の信頼を損なう |
| C | player が研究対象を先に選んでから試作 | 更新は選択 entry のみ。**他の entry との比較ができない**ので A より漏洩が少ない。ただし entry の選択自体は「どの recipe か」を player は知らないままなので identity は出ない | §7 |
| D | 帰属させず Notebook にだけ事実を残す | attribution 漏洩は最小。ただし「今回の試作にどれかの？？？の材料が含まれた」という boolean が残る。**Dex に何も積み上がらず**、Owner の「研究が進む」体験が弱い | Notebook が session-only なので persistence と衝突 |

candidate identity leak との関係: 現 hint target 契約（OD-4b-A-2）は「pool>1 では勝手に 1 件を選ばない（OPEN_POOL）」。**B は「勝手に選ぶ」の再導入**で契約と同じ理由で衝突する。**C は player が選ぶので契約と整合**する（選択は player の行為であって system の選択ではない）。

---

## 7. Research Target

- pool > 1 のとき、Recipe Discovery に入る前に「研究する ？？？」を選ぶ方式は成立する。既存 **Pizza Select（発見済み recipe を選んで再調理）とは別 object**（未発見 recipe の guided round 禁止 = LK-8 backstop を触らない: `canStartGuidedRound` は DISCOVERED のみ）。
- Research Target は **選択だけ**で guided 調理を開始しない。reference pizza を出さない（出すと答えが漏れる）。選択は attempt の attribution（§6-C）と Hint の対象（§8）にだけ効く。
- 既存 `HintTarget.source = "auto" | "dex"` に **第三の source（"research"）** が増える。現行は「pool>1 の Dex pin は sticky target のときだけ有効」なので、この source を持つ entry だけは pool>1 でも有効にする、という最小の緩和で足りる。**これは OPEN_POOL を解消する**（player が選ぶので arbitrary hint にならない）。
- 一覧 UI の例（`判明 2要素` 等）: 表示してよいのは **player 自身が獲得した knowledge の個数**（✓ と △ の和）。**未判明の個数・総数は出さない**（X1）。
- anonymous ラベルの順序は **登録順**（catalog / slot 順を使わない）。同一 unlock で同時に登録された entry の順は、固定の tie-break（例: `recipeKeyStep` → 材料数、Hint target の既存順序）。player が順序から recipe を推測できないよう、登録順は表示用 id としてだけ使う（保存は §12）。
- 名前・candidate count authority の過剰漏洩を避ける: 「📖 未完成レシピ」の見出しに件数を付けない（Dex の集約カードと同方針）。

---

## 8. Hint redesign

現 Hint 5.0（`hint5Ladder.ts`）: SAUCE → CHEESE → KEY_TOPPING → STRUCTURE → SUB_CLASS ①…ⓝ の **線形 ladder**。SAUCE/CHEESE/KEY は名前を出し（`ing:<id>`）、STRUCTURE は総数、SUB_CLASS は family のみ（`cls:<id>`）。価格 10/10/10/5/5。`KeyFreeHintRoles`（KEY rung なし）が既に存在し、`brazilian-calabresa`（No.26）が最初の key-free recipe。

新案「選択中の仮登録 recipe の未判明 knowledge を 1 つ増やす」との関係:

| 論点 | 所見 |
|---|---|
| 再利用できるもの | ladder 構造・価格・fact id・`ALREADY_KNOWN` 規則・STRUCTURE・SUB_CLASS 表示（`hintClassDisplay`）をそのまま使える。**attempt が得た EXACT は M3 に従い、該当 rung を 0 Pitz で完了させる**（既存規則の延長） |
| 変わる点 | rung 順が固定線形 → 「未判明のうち次の 1 つ」。ただし **選ぶ順序をどうするか**（固定順か player の選択か）が新たな設計点。固定順を維持すれば既存 gate・test の多くが生きる |
| classification を基本にするか | 現 ladder は sub-topping に対してのみ classification（名前を出さない）、sauce / cheese / key は名前。**全 rung を classification にすると sauce/cheese の名前 rung の価値が変わる**（OD-PRR-3） |
| taxonomy の精度 | topping family 7 種は 23 ingredient 分（`TOPPING_FAMILY_ROWS`）。sauce / cheese は category（3 sauce / 4 cheese）。**「トマト系」は存在しない**（X2）。新設すると cross-category で、singleton に近い（fresh-tomato・cherry-tomato・tomato-sauce）。H5-INV 系の「family が ingredient 名になってはならない」と衝突するので **新 family は作らない前提**で、トマトは「野菜・きのこ系」になる |
| Hint 後に Dex に残るもの | CLASS の △（`cls:<id>` はすでに save 済み） |
| attempt の EXACT との違い | EXACT は ✓、CLASS は △。EXACT が来たら CLASS を上書き（包含） |
| KEY_TOPPING deprecation | key-free recipe は KEY rung が無い。knowledge ledger は rung 名でなく fact 種で持つので影響しない |
| privacy / oracle contract | 対象 entry を明示する（「？？？A のヒント」）。facts は player が購入した分だけ。未使用の正解は出さない |
| 複数 entry | Research Target が必須（§7）。選択なしの Hint は pool>1 では従来の OPEN_POOL 文言のまま |

---

## 9. Dex redesign

- 「研究途中 recipe」を Dex に載せる案と、別 Research 画面にする案がある（OD-PRR-5）。**Dex に載せる場合の衝突**: D-2 の集約カード契約（X3）、slot 番号（`No.xx`）、`？` slot の数が STRUCTURE を漏らす（X1）。
- 進捗表現の案: `✓ チキン / ✓ モッツァレラ / △ 野菜系`（**列挙のみ**）＋ 末尾に固定文「ほかにも材料がある」（数なし）。**`？` を個数分並べない・`3/5` や `60%` を出さない**（Owner の方針と一致）。STRUCTURE を買った後にのみ「？」の個数を出す、という扱いなら Hint の課金価値が残る。
- ✓ / △ の 2 段階は player-facing に必要。**source（unlock / attempt / hint）の見分けは不要**（情報量が増えるだけで、player に使い道が無い）。
- 並べ方: 登録順。DISCOVERED の entry は従来の通常 card に置き換わり、research 表示は消える。

---

## 10. Candidate Count 契約の再定義

#345 の契約（現行）: PizzaSelect の prompt は kind のみ。DISCOVERABLE の **exact count を player-facing に出さない**。Dex は 2 件以上で集約カード（件数も slot も DOM に出ない）。

| | A. 内部 discovery pool の候補件数 | B. player が仮登録した ？？？ entry |
|---|---|---|
| 意味 | その時点で DISCOVERABLE な recipe の総数（UNKNOWN / KNOWN_BUT_MISSING を含めた pool 規模はさらに別） | player の獲得 knowledge として存在する entry |
| 公開 | **非公開のまま**（今後も） | **公開してよい**（player が得たもの） |
| 条件 | — | 公開してよいのは「登録した」事実のみ。**未登録の recipe の有無・総 recipe 数・残り数は含めない** |

**重要な指摘**: unlock 時に per-recipe で登録すると、**B の件数 = その時点の REGISTRABLE 件数 = A の一部（DISCOVERABLE 件数）と一致する**。つまり A の「DISCOVERABLE 件数は非公開」は、仮登録を導入した時点で事実上公開に変わる（D-2 の集約カードが隠していた数そのもの）。新契約を作るなら次の 2 つを混同しないよう明記が必要:

1. **公開するのは「登録された entry の数」であって、「pool の残り数・総数・まだ見つかっていない recipe の数」ではない**。
2. 「DISCOVERABLE 件数を隠す」契約（#345 / D-2）は **「未登録（まだ手がかりの無い）recipe の件数を隠す」へ置き換わる**。これは Owner が意図して D-2 を supersede する決定になる（OD-PRR-5 に含める）。

登録の粒度の選択肢（件数の見え方が変わる）: (R1) recipe ごとに 1 entry、(R2) unlock 事象ごとに 1 entry（同一購入で完成した複数 recipe は 1 つの ？？？ にまとめ、中の attribution は内部）、(R3) 証拠が出た時（attempt で当たった時）に初めて登録、(R4) 全体で 1 枚（現 D-2 の集約）。R2 / R3 は件数漏洩が小さいが、複数 recipe が 1 entry に混ざる knowledge の意味が曖昧になる。

---

## 11. Trial Notebook との責務分担

- **Dex = recipe についての確定 knowledge、Notebook = player が実際に試した experiment history** の分担は成立する。Notebook は元々「recipe id・target・候補・推測を持てない構造」（P3-4）で、Dex 側が「？？？A に新しいことが分かった」を持つ。
- Notebook に「今回の研究成果」を **entry 帰属付きで** 書くと、Notebook が recipe 側の情報を持つことになり P3-4 の構造不変条件を破る。**Notebook には成果の有無のみ**（「新しいことが分かった」程度）か、**何も足さない**のが安全。成果の詳細は Dex（knowledge ledger）側だけに置く。
- 逆算チェック: Notebook の「使った材料」と Dex の ✓ を player が突き合わせれば、「この材料セットで ？？？A が更新された」ことが分かる。**これは player 自身の行動と player 自身の knowledge の突合**であり、未使用の正解は含まれないので hidden target の逆算にはならない。ただし「更新なし」の attempt は X∩R\known = ∅ を意味する boolean（§5 所見 2）。
- Notebook は **session-only**（reload で消える）。knowledge を persistence する（§12）なら、Notebook との差分（reload 後は Dex だけ残る）を許容するか、Notebook も保存するかを別途決める（本 audit の範囲外）。

---

## 12. Persistence

| 項目 | 保存要否 |
|---|---|
| 仮登録（registration） | **不要**。§2 の REGISTRABLE は `ownedIngredientIds`・Dex・ladder から導出できる（monotonic）。表示順の登録順は `ownedOrder`（保存済み）から導出可能 |
| UNLOCK の ✓ | **導出可能**（`ownedOrder` の R の最後の取得材料）。保存しても冗長 |
| ATTEMPT-confirmed EXACT | **保存が必要**（導出不能・session で失うと研究成果が消える） |
| HINT の CLASS / EXACT / STRUCTURE | **すでに保存済み**（`discoveryHintFacts`） |
| knowledge の source | 内部用途（rung の ALREADY_KNOWN 判定ではなく fact 種で足りる）。**保存は必須ではない** |

最小の保存案: **既存 `discoveryHintFacts[recipeId]` に fact 種を追加する**（例: attempt 由来の EXACT は既存の `ing:<id>` と同じ id を使う。**同一 fact になるので source を分けなくてもよい**。分けたい場合のみ新 prefix）。fact id の文法（`^[a-z][a-z0-9-]{0,15}(?::…){1,2}$`）・上限 64/recipe の枠内。

save への影響:
- **schema version は上げずに済む可能性が高い**（`schemaVersion: 2` のまま、`discoveryHintFacts` は既に追加フィールド）。ただし attempt 由来の fact を **Hint の rung 完了と別扱い**にしたい場合は新フィールドが必要で、その場合 additive（旧 build は無視する）。
- backward compat: 旧 save には attempt 由来 fact が無い。導出される ✓（unlock）と合わせ、**空の knowledge から始まる**。
- unknown IDs preservation: `hintFactsFor(…, isUnknownRecipeId)` と `extractForwardCompatExtras` が **未知 recipe id の ledger を保持**する既存機構を再利用できる。attempt 由来の `ing:` に **未知の ingredient id が入る場合**（新 build の保存を旧 build が読む）の扱いは旧 build 側の sanitizer 次第（現行は文法一致なら保持）。
- forward compat: 新 build が旧 save を読むのは問題なし。旧 build が新 save を読むとき、新 fact を無視しても Dex 発見自体は壊れない。
- **注意**: ledger は recipeId をキーにするため、save に「どの recipe を研究しているか」が残る（既存 Hint でも同じ前例あり。player-facing には出ない）。
- 本 audit では schema を変更しない。

---

## 13. Unlock behavior（どの recipe を仮登録するか）

§4 のとおり、**authority は「ownership 完全一致」で ≒ 現 DISCOVERABLE の stock を外したもの**。そのまま `DISCOVERABLE` を使うと X4 で entry が消える。

- 1 purchase で複数登録: Step 12（onion）で 2 件（production 事実）。
- recipe 追加後の遡及登録: 上述（導出）。登録の「事象」（演出）を出すか静かに出すかは別決定。
- 材料が starter のみの recipe は対象外。
- **登録時の ✓ は常に正しい**（最後の欠けが m）。ただし 2 件同時登録（onion）では A・B どちらにも ✓ onion が付き、**どちらにも onion が使われていることが分かる**（これは Owner 方針で許容される knowledge）。

---

## 14. Recipe completion（knowledge complete ≠ discovered）

- matcher は ingredient 集合の完全一致 + Completion Gate（各材料 ≥1 piece・sauce 量・bake window）。**「knowledge が揃っただけでは DISCOVERED にならず、正しく調理して初めて DISCOVERED」は current matcher で成立する**（Dex 登録は `REGISTER_TO_DEX` だけ）。
- ただし **X5**: 27 recipe は default dims なので、ingredient を全部知った player は identity を全部知っている。残る障壁は「全材料を含めて、余計な材料を足さずに、sauce と bake window を満たして焼く」ことだけ。これは「発見」というより「実行」の障壁。**knowledge-complete ≠ discovered は成立するが、gate の強さは今の production では弱い**。将来 technique / dimension を持つ recipe（`no-sauce` 等）が入れば、knowledge に technique fact が加わり意味が増す。
- knowledge complete を DISCOVERED に自動昇格しない（Owner 方針）。`INCOMPLETE_MATCH`（identity は一致・gate 不合格）は既に存在し、knowledge には「全 EXACT 判明」を与えるが DISCOVERED にはしない。

---

## 15. Original Pizza の意味

- 現行: ORIGINAL は score / Dex / Pitz に残らない（`freeCook.ts`）。
- 新システムで **「研究試作」として扱う**のは、knowledge 更新が起きるなら成立する。ただし:
  - ORIGINAL の結果画面に「研究成果」を出すと、**ORIGINAL ≒ 失敗でなくなる**一方、「何も更新されなかった」ORIGINAL が再び「失敗」に見える（心理的）。更新なし時の文言は中立にする（「新しい手がかりはなかった」は boolean oracle なので、**更新有無の通知は expose しない案**と比較が必要）。
  - **オリジナル recipe の Dex 保存は今回作らない**（Owner 指定）。
- 1 つの整理: 「研究成果あり」だけを出す（なしは何も出さない）なら oracle は最小だが、player は「何も出ない=外れ」と推測できる（結局 boolean）。**完全に隠す案は無い**（§5 所見 2）。

---

## 16. Progression / C-Step への影響

- A / B / C の型（単線 / 移行 / 複数候補 = OPEN_POOL）は「同時に DISCOVERABLE な recipe が何件か」の分類だった。Step 12 のみ C（onion の 2 件）。
- Research Target があると、**C-Step は「どの recipe か分からず困る」から「並行研究を選べる」に意味が変わる**。OPEN_POOL の固定文言契約（hint を出さない）は、Research Target で「選べば hint が出る」に緩む。
- 並行研究が可能なら「複数 entry を同時に持つ」状況は C-Step だけでなく backlog（買ったが調理していない recipe）でも起きる（§4）。**C-Step は以前より重要になる（entry が 2 件並ぶ最初の設計場面）が、Research Target で扱いやすくもなる**。両方が成立する。
- OPEN_POOL / Step 12 / First C-Step の実装は **本 audit では触らない**。Step 14 / Grandma は決めない。

---

## 17. Abuse / oracle probe（read-only 集計）

**条件**（production data から）: 4 ingredient recipe（sauce 含む）を target に、player は「そこまでに ladder で entitle された材料を全部所持」とする（最悪ケース。n = 所持材料数、starter 3 + ladder 材料）。unlock で ✓ が 1 つ付いた状態から開始。attempt は ORIGINAL になる任意の部分集合、1 attempt あたり最大 K 種（K=6 / 8 を仮定。実際の上限は 8 slot ring と palette 6 slot の複合で、本 audit では確定しない）。**戦略は heuristic（最適ではない）**。結果は難易度調整ではなく「oracle が復活しているか」の確認用。

完全同定（R の全 ingredient が分かる）までの試作回数（平均 / 最大、各 300 試行）:

| recipe | n | A (K=8) | B (K=8) | D (K=8) | A (K=6) | B (K=6) | D (K=6) |
|---|---|---|---|---|---|---|---|
| pesto-pollo | 30 | 3.3 / 4 | 4.8 / 6 | 8.5 / 10 | 4.1 / 5 | 5.6 / 7 | 9.3 / 11 |
| pesto-caprese | 24 | 2.7 / 3 | 4.2 / 5 | 5.0 / 5 | 3.4 / 4 | 4.8 / 6 | 7.0 / 7 |
| napoletana | 19 | 2.2 / 3 | 3.7 / 4 | 5.0 / 5 | 2.8 / 3 | 4.2 / 5 | 6.0 / 6 |
| tonno-e-cipolla | 20 | 2.3 / 3 | 3.8 / 5 | 5.4 / 6 | 2.9 / 4 | 4.4 / 5 | 6.4 / 7 |
| hawaiian | 13 | 1.7 / 2 | 3.3 / 4 | 3.6 / 4 | 1.9 / 2 | 3.6 / 4 | 4.5 / 5 |

（C は B と同情報量。ただし「新発見あり」の boolean が先に出る。D は family のみ・exact は分離試験で絞る必要があるため回数が増える。）

**読み取れること**
1. **現行（reveal なし）は ingredient 集合の完全一致のみ**で、n=30・|R|=4 の探索空間は約 2.7 万通り（C(30,4)）。A〜D のどれも、**membership の group testing を許す**ので、試作回数は桁違いに減る（4〜10 回）。**Near/Far を消した oracle とは別形式だが、同じ効力の oracle が復活している**（A が最も強く、D が最も弱い）。
2. **n/K が効く**。所持材料が少ない序盤（breakfast-pizza: n=5 は 1 回、bambino n=12 は 2 回）は A で実質 1〜2 回で解ける。もっとも序盤は元々 guess しやすい。
3. D は family 集合が 1〜数 attempt で分かる（**Hint の SUB_CLASS rung 5 Pitz を実質無料化**）。完全同定は遅いが、**課金 rung の代替**になる。
4. 抑止に使える既存の仕組み: **finite 材料は調理で消費される**（`consumePizzaInventory`）ので、「全部入り」の試作は Pitz のコストになる。ただしコスト規模は本 audit では評価していない（価格・補充の設計に依存）。
5. もう 1 つの抑止: knowledge 更新を **完成基準を満たす試作（K を絞る）に限る**案、reveal を **試作 1 回あたり 1 個（B）** にする案。いずれも oracle を消すのではなく弱めるだけ。**oracle を完全に避ける案は、attempt から knowledge を直接得ない設計（Hint のみ）**であり、本構想の中心と衝突する。

---

## 18. Minimal Vertical Slice

1 recipe（既存 production の `pesto-pollo` または Step 12 の `pizza-portuguesa` / `brazilian-calabresa`）で、**既存 production recipe の dev/test fixture のまま通せる**。**No.28 を追加する必要はない**（分離できる）。

通す流れ:

```
material unlock（chicken 購入）
  → ？？？仮登録（REGISTRABLE で導出）
  → known material 1 つ（✓チキン）
  → Research Target 選択（pool=1 なら自動）
  → 試作（ORIGINAL）
  → knowledge 1 つ更新（§5 の A / B / D のいずれかを fixture 化）
  → Hint で classification 1 つ更新（SUB_CLASS 経由）
  → 再試作 → DISCOVERED
  → Dex 正式化（仮 entry が通常 card に置き換わる）
```

- 最小実装は `RecipeKnowledge` の **純粋 reducer（unwired）＋ attempt → X∩R の純粋関数**から始める（Notebook N1 / Hint H3-1 と同じ流儀）。UI は後。
- 複数 entry（Step 12 の onion 2 件）の検証は **2 つ目の slice**（§6 / §7 の決定が前提）。

---

## 19. Owner Decisions

最大 5 件。いずれも **この audit では決めない**。

| ID | 決めること | 選択肢 | 補足（推奨はしない／衝突点のみ） |
|---|---|---|---|
| **OD-PRR-1** | attempt から EXACT をどこまで明かすか | A 全部 / B 1 個 / C 通知＋別操作 / D classification のみ | §17: A は完全同定 2〜4 回で oracle 最強。D は SUB_CLASS 課金を代替。B/C は中間。いずれも boolean oracle が残る |
| **OD-PRR-2** | 複数 entry 時の attribution | A 全 entry / B 1 entry / C Research Target / D Notebook のみ | B は「system が勝手に選ぶ」で #345 / OPEN_POOL の契約と衝突。C は契約と整合 |
| **OD-PRR-3** | Hint を classification 基本にするか（rung の名前/分類の割り当て） | classification 基本 / 現 ladder 維持＋attempt 由来を M3 で吸収 | 「トマト系」は taxonomy に無い（X2）。新 family は作らない前提 |
| **OD-PRR-4** | knowledge を save に持つか | session-only / 既存 `discoveryHintFacts` に追記 / 新フィールド | 登録は導出可能。保存が必要なのは attempt 由来の EXACT だけ（§12） |
| **OD-PRR-5** | 仮登録の置き場所と**登録粒度**（D-2 の上書き可否を含む） | Dex に載せる / 別 Research 画面 ／ R1 per-recipe / R2 per-unlock / R3 evidence 時 / R4 集約 | X1（？ の個数が STRUCTURE を漏らす）・X3（D-2 集約契約）・§10（B の件数＝A の一部が公開になる）が全てここに集まる。**Dex に載せるなら D-2 と #345 を意図して supersede する決定が要る** |

---

## 20. この audit がしなかったこと / 限界

- reducer・UI・E2E は動かしていない。probe は静的な data の集計で、戦略は heuristic。K（1 attempt の種数上限）は仮定で、実際の上限は未確定。
- 172 recipe は再監査していない（production の 27 recipe のみ）。
- 数値（試行回数）は難易度調整の根拠ではなく、oracle の有無の確認のみ。
- No.28・Step 14・Grandma・R6・IP-2 は触れていない。
