# Progression 2.0 W1 — Content Evidence Resolution

## 結論

- 基準: `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`（2026-09-24 GitHubで最新と確認）、W1 authority PR #220 `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（OPEN）、入力 PR #221 `d028844e3a848ebf53cbc45d745784b7695dedf2`（OPEN / Final Gate）。PR #221 は read-only input として読むだけで、変更していない。
- **解決: REC-08** の1件（production matcher を read-only で実行した結果による）。
- **未解決: REC-06 / REC-07 / REC-09 / REC-10**（likely_alias。repo内の evidence は使い切った。残りは Owner Decision）、**ING-02 / 03 / 07 / 08 / 09 / 10 / 11**（すべて HUMAN_VERIFICATION_REQUIRED）。
- **変更なし: REC-01〜04**（全 recipe が継承する global）、**RT-01**（別の runtime dependency として維持）、**REC-11**（Sauce OD-S1 = A を維持）。
- 判定は **READY 0 / REVIEW 10 / BLOCKED 0**（#221 と同じ）。今すぐ READY にできる recipe はない。
- 外部取得: `pizzadb.jp` は本環境の network policy で拒否（CONNECT 403）。新しい PIZZA DB evidence は追加していない。

## Evidence の区別

| class | source | 本監査での扱い |
|---|---|---|
| PIZZA_DB_EVIDENCE | `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`（owner-relayed） | token 単位で再分類 |
| EXISTING_CATALOG | `data/recipes/ingredient_master_catalog.json` と merged canonicalizer | 分類規則として適用する。表は変更しない |
| PRODUCTION_DATA | `src/**` | read-only で import して実行するだけ（変更なし） |
| PR_221_CANDIDATE | #221 の authoring matrix | 候補として扱い、evidence とはみなさない |

## Ledger 別の結果

### REC-06 / REC-07 / REC-09 — `オリーブ → black-olive`（Pizza Portuguesa / Puttanesca / Pesto Tonno）

**UNRESOLVED — EVIDENCE_EXHAUSTED_OWNER_DECISION_REQUIRED**

- PIZZA DB: 12 行が単独の token `オリーブ` を使う（`オリーブオイル` とは区別されている）。色や品種を指定した olive token は **0件**。Phase 0B の行で canonical id が `black-olive` になっている 6 行（capricciosa など）は日本語 token が記録されていないため、元の表記を示す evidence にならない。
- Existing catalog: olive 系の topping は `black-olive` の1つだけ。canonicalizer の `LIKELY_ALIAS_TABLE` にも「confidence-flagged match, not exact」と明記されている。
- したがって olive の色は PIZZA DB evidence からは決められない。canonical として扱わない。
- 波及: #221 の3件の description candidate はいずれも「ブラックオリーブ」と明記している。OD の結果によっては文言の修正が必要になる。
- 3件とも同じ判断で決まる → **OD-OLIVE** に統合する。

### REC-10 — `パルミジャーノチーズ → parmigiano`（Parmigiana）

**UNRESOLVED — EVIDENCE_SUPPORTS_IDENTITY_RECLASSIFICATION_REVIEW_REQUIRED**

- token の中身は catalog の nameJa `パルミジャーノ` に一般的な suffix `チーズ` が付いただけ。競合する catalog id はない。
- 同じ canonicalizer は、同じパターンの `モッツァレラチーズ → モッツァレラ` を ORTHOGRAPHIC（exact）として扱っている。つまり likely_alias の区分は identity が曖昧だからではなく、表への登録位置による違い。
- それでも区分の変更は canonicalizer 表を変える判断にあたるため、**適用していない**（→ **OD-PARM**）。

### REC-08 — eggplant family discovery regression（Parmigiana / Melanzane）

**RESOLVED — RESOLVED_BY_PRODUCTION_MATCHER_EVIDENCE**

- production の `matchDiscovery` を、production 15件に W1 の10件を加えた計25 target で実行した。signature collision は **0**。W1 の10件はすべて自分自身に UNIQUE_MATCH した。1 ingredient を足し引きした近傍にも AMBIGUOUS は **0**。
- Melanzane ⊂ Parmigiana（違いは parmigiano だけ）。exact matching なので両者は別の signature になる。
- 1 ingredient 差の近傍（仕様どおりの挙動で、Owner 判断は不要。Human Feel 上の参考として記録する）:
  - Parmigiana − parmigiano → Melanzane
  - Melanzane − eggplant → Margherita
  - Melanzane + parmigiano → Parmigiana
  - Margherita + eggplant → Melanzane
- carry-forward: `rec08EggplantFamily.portableTestCases` は、recipe データを実装する slice で `src/logic/discovery` の test に移植する。既存の production test「all runtime signatures are unique」は、recipe が追加されれば自動的に区別を検証する。
- 参考: PIZZA DB の eggplant family 13行の census も記録した。W1 以外の行（caponata、alla-norma など）は後続 wave での照合用。

### ING-02 / 03 / 07 / 08 / 09 / 10 / 11 — 新 ingredient 7種の visual

**すべて HUMAN_VERIFICATION_REQUIRED（PASS は付けない）**

新 ingredient 7種の *identity* evidence は揃っている:

| ingredient | 分類 |
|---|---|
| corn / eggplant / fresh-tomato / pineapple / potato | exact_alias |
| capers | 登録済みの genuinely_new |
| clam | relay 時点で canonical（Phase 0B） |

W1 の likely_alias token は `オリーブ` と `パルミジャーノチーズ` の2つだけ。*見た目* は、非 cheese の piece を emoji だけで描画する仕様（`IngredientPieceVisual`）のため、実機での確認が必要。

| focus | 静的 finding | 実機で確認すること |
|---|---|---|
| **fresh-tomato 🍅 collision** | production の cherry-tomato（piece）および tomato-sauce（tray chip）と同じ glyph。cherry-tomato で作った Pesto Caprese は見た目が同一なのに **NO_MATCH**（production matcher で実証） | tray と pizza 上で fresh-tomato と cherry-tomato を見分けられるか |
| **eggplant 🍆 visibility** | 暗い紫の glyph。tomato-sauce の赤の上に置かれ、bake 時には roast tint がかかる | 焼成前後、reference ring、thumbnail で判別できるか |
| **clam 🐚 visibility** | #221 の候補は 🦪 OYSTER、brief は 🐚 SPIRAL SHELL。どちらも clam ではない | olive-oil / parmigiano / 🧄 garlic（淡色）の上で貝類と読めるか |
| **capers 🟢 distinguishability** | 無地の円形 glyph の仲間（⚫ black-olive、🔴 pepperoni）。区別の手がかりは色だけ | Puttanesca（⚫ と同じ pizza に載る）と tray（🔴 と並ぶ）での判別。赤緑の色覚多様性とグレースケールも含めて確認 |
| corn 🌽 / pineapple 🍍 / potato 🥔 | 同じ glyph を持つ ingredient はない | cheese 上での contrast、焼成後の判別 |

前提: 実機確認には、候補 ingredient を含む Preview build（#221 の slice B）が必要。docs だけでは実施できない。確認の方法は `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従う（390×844、動画はユーザーへ直接提出し、repo に commit しない）。

## Recipe 別の残り dependency

全 recipe がさらに REC-01〜04 を継承している。

| recipe | 本監査で解決 | 残り（recipe 固有） | 種別 |
|---|---|---|---|
| new-haven-apizza | — | ING-07 | HVR + OD-CLAM-GLYPH |
| hawaiian | — | ING-10 | HVR |
| parmigiana-pizza | REC-08 | ING-03, REC-10, RT-01 | HVR / OD-PARM / runtime |
| bambino | — | ING-08 | HVR |
| pizza-portuguesa | — | REC-06, RT-01 | OD-OLIVE / runtime |
| puttanesca-pizza | — | ING-02, REC-07, RT-01 | HVR / OD-OLIVE / runtime |
| pesto-caprese | — | ING-09 | HVR + OD-TOMATO-REPRESENTATION |
| pesto-tonno | — | REC-09 | OD-OLIVE のみ（新 ingredient なし） |
| pesto-patate | — | ING-11 | HVR |
| melanzane-pizza | REC-08 | ING-03 | HVR |

## Owner Decision が必要な項目

1. **OD-OLIVE**（REC-06/07/09）: PIZZA DB の色指定のない `オリーブ` を、game 上の表現として `black-olive` で受け入れるか（provenance は likely_alias のまま残す）、generic な olive を新設するか、保留するか。受け入れない場合は #221 の description 3件の文言も直す。
2. **OD-PARM**（REC-10）: `パルミジャーノチーズ` を likely_alias のまま残すか、`ORTHOGRAPHIC_EQUIVALENTS` へ移すか（canonicalizer 表の review）。
3. **OD-CLAM-GLYPH**（ING-07）: 🦪（#221 の候補）、🐚（brief）、その他のどれにするか。
4. **OD-TOMATO-REPRESENTATION**（ING-09）: 🍅 を共有したまま受け入れるか、区別できる表現を求めるか。emoji 以外の表現を選ぶと新しい runtime dependency になる（未登録）。
5. 既存の REC-03（#218 Completion Gate）、REC-04（Progression 2.0）は変更なし。

## READY へ進められる recipe

- **現時点ではなし**（REC-01〜04 がすべての recipe で open）。
- global を除けば、残りが1件だけの recipe:
  - **pesto-tonno**: OD-OLIVE のみ。新 ingredient も HVR も不要。
  - **hawaiian / bambino / pesto-patate / melanzane-pizza**: 各 HVR 1件のみ。
  - **new-haven-apizza / pesto-caprese**: HVR 1件に OD が1件付随する。
- RT-01 の対象（parmigiana / portuguesa / puttanesca）は、runtime slice E が完了するまで READY にならない。minCount は削っていない。

## 次の最小 content authoring slice

**Slice W1-α（docs/tooling のみ）**: OD-OLIVE と OD-PARM の判断を記録し、その結果に合わせて canonicalizer 表と #221 の description 候補を更新する。これで Pesto Tonno の recipe 固有 dependency がなくなる。Pizza Portuguesa は RT-01 だけが残り、Puttanesca / Parmigiana は HVR と RT-01 が残る。

その後の visual は、slice B（7 ingredient を入れた Preview）で HVR を1回まとめて実施するのが最小になる。fresh-tomato / eggplant / clam / capers を必ず対象に含める。

## 成果物

- `docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json` — ledger ID ごとの結果、recipe ごとの残り dependency、pin した入力の hash
- `docs/reports/data/TETO_PROGRESS2_W1_TOKEN_PROVENANCE.json` — W1 の token 分類、olive / parmigiano / eggplant の census
- `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_REGRESSION_FIXTURES.json` — production matcher の結果と移植用の test case
- `docs/reports/data/TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json` — 7 ingredient の HVR 要件
- `tools/progression2_w1_evidence_resolution.py [--check]`、`tools/w1_discovery_regression_probe.mjs`、`tools/lib/*.mjs`（Node 22 の `--experimental-strip-types` で `src/**` を read-only import する）

## Validation

- `python3 tools/progression2_w1_evidence_resolution.py --check`: PASS。pin の検証を含み、main との差分、#220 W1 集合の drift、#221 の authority 不一致、likely_alias 集合の変化、signature collision のいずれかがあれば FAIL する。
- `validate_recipe_catalog.py`: PASS（53 / 62 / 11）。`progression2_evidence_invariants.py`: 4/4 PASS。canonicalizer の self-test: 36/36 PASS。
- `src/**`、`e2e/**`、PR #220 / #221 の branch、#215 の production 実装はいずれも未変更。docs 専用の変更なので video は不要（policy §2）。
