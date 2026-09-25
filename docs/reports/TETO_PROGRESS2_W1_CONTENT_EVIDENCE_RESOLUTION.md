# Progression 2.0 W1 — Content Evidence Resolution

> **2026-09-25 更新（Human Visual Verification を同期）**: このレポートの「ING-02/03/07/08/09/10/11」の節と、recipe 別の表にある HVR の列、OD-CLAM-GLYPH（DEFER_TO_VISUAL_GATE）と OD-TOMATO-REPRESENTATION（TEMPORARY_SHARED_GLYPH）は、その後の W1 Ingredient Visual Gate の結果で**確定した**。7 材料すべて HUMAN_PASS。OD-CLAM-GLYPH は DEDICATED_CLAM_B、OD-TOMATO-REPRESENTATION は DEDICATED_FRESH_TOMATO_B、新たに OD-CAPERS-VISUAL を DEDICATED_CAPER_CLUSTER とした。現在の状態は `docs/reports/TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION_SYNC.md` と、生成物（ledger、owner decisions、visual requirements、`TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json`）を参照すること。以下の本文は 2026-09-24 時点の記録として残してある。

## 結論

- 基準: `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`（2026-09-24 GitHubで最新と確認）、W1 authority PR #220 `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（OPEN）、入力 PR #221 `d028844e3a848ebf53cbc45d745784b7695dedf2`（OPEN / Final Gate）。PR #221 は read-only input として読むだけで、変更していない。
- **Owner Decision（2026-09-24）を反映**: OD-OLIVE = BLACK_OLIVE_CANONICAL、OD-PARM = PARMIGIANO_CANONICAL、OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE、OD-TOMATO-REPRESENTATION = TEMPORARY_SHARED_GLYPH。
- **解決: REC-06 / REC-07 / REC-09 / REC-10**（Owner Decision による game normalization）、**REC-08**（production matcher を read-only で実行した結果による）。
- **未解決: ING-02 / 03 / 07 / 08 / 09 / 10 / 11**（すべて HUMAN_VERIFICATION_REQUIRED のまま。clam / fresh-tomato は OD を付けたうえで Preview Visual Gate へ渡す）。
- **変更なし: REC-01〜04**（全 recipe が継承する global）、**RT-01**（別の runtime dependency として維持）、**REC-11**（Sauce OD-S1 = A を維持）。recipe quantity も変更なし。
- 判定は **READY 0 / REVIEW 10 / BLOCKED 0**。recipe 固有の dependency がなくなったのは **pesto-tonno** の1件だけ。global（REC-01〜04）が open のため READY にはならない。
- 外部取得: `pizzadb.jp` は本環境の network policy で拒否（CONNECT 403）。新しい PIZZA DB evidence は追加していない。

## Evidence の区別

| class | source | 本監査での扱い |
|---|---|---|
| PIZZA_DB_EVIDENCE | `docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`（owner-relayed） | token 単位で再分類 |
| EXISTING_CATALOG | `data/recipes/ingredient_master_catalog.json` と merged canonicalizer | 分類規則として適用する。表は変更しない |
| PRODUCTION_DATA | `src/**` | read-only で import して実行するだけ（変更なし） |
| PR_221_CANDIDATE | #221 の authoring matrix | 候補として扱い、evidence とはみなさない |
| GAME_NORMALIZATION_DECISION | Owner Decision と game canonicalization rule（`TETO_PROGRESS2_W1_OWNER_DECISIONS.json`） | evidence とは別の層。PIZZA DB の事実としては記録しない |

**evidence fact と game decision の分離**: `TETO_PROGRESS2_W1_TOKEN_PROVENANCE.json` は OD 反映前と byte 単位で同一（PIZZA DB token と likely_alias disposition は書き換えていない）。merged canonicalizer の表（`LIKELY_ALIAS_TABLE` / `ORTHOGRAPHIC_EQUIVALENTS`）も変更していない。OD は game canonicalization rule としてだけ記録する。

## Ledger 別の結果

### REC-06 / REC-07 / REC-09 — `オリーブ → black-olive`（Pizza Portuguesa / Puttanesca / Pesto Tonno）

**RESOLVED — RESOLVED_BY_OWNER_DECISION_GAME_NORMALIZATION（OD-OLIVE = BLACK_OLIVE_CANONICAL、rule GCR-OLIVE-01）**

- Game decision: 色指定のない `オリーブ` を、ゲーム側の canonicalization policy として既存 ingredient `black-olive` に正規化する。token 全体に適用する policy で、W1 で適用されるのは 3 recipe。W1 以外で同じ token を持つ PIZZA DB 9行は、その wave を authoring する時点で正規化する（今回は処理しない）。
- Evidence fact（変更なし）: 以下の census のとおり、PIZZA DB は olive の色を記載していない。「PIZZA DB のオリーブは黒」という事実は記録しない（`colourIsPizzaDbFact: false`）。
- Description: #221 の3件の candidate はいずれも「ブラックオリーブ」と書いており、OD と整合する（`CONSISTENT`）。文言の修正は不要で、#221 も変更していない。

OD 前の evidence 記録（変更なし）:

- PIZZA DB: 12 行が単独の token `オリーブ` を使う（`オリーブオイル` とは区別されている）。色や品種を指定した olive token は **0件**。Phase 0B の行で canonical id が `black-olive` になっている 6 行（capricciosa など）は日本語 token が記録されていないため、元の表記を示す evidence にならない。
- Existing catalog: olive 系の topping は `black-olive` の1つだけ。canonicalizer の `LIKELY_ALIAS_TABLE` にも「confidence-flagged match, not exact」と明記されている。
- したがって olive の色は PIZZA DB evidence からは決められない（evidence としては likely_alias のまま。canonical 化は上記 OD による game 側の判断）。
- 3件とも同じ判断で決まる → **OD-OLIVE** に統合した。

### REC-10 — `パルミジャーノチーズ → parmigiano`（Parmigiana）

**RESOLVED — RESOLVED_BY_OWNER_DECISION_GAME_NORMALIZATION（OD-PARM = PARMIGIANO_CANONICAL、rule GCR-PARM-01）**

- Game decision: `パルミジャーノチーズ` を既存 ingredient `parmigiano` への game-side canonical alias として扱う。
- PIZZA DB の新しい事実としては記録しない（`newPizzaDbFactRecorded: false`）。canonicalizer 上の disposition は likely_alias のままで、`ORTHOGRAPHIC_EQUIVALENTS` へは移していない。
- Description: Parmigiana の candidate は catalog の nameJa「パルミジャーノ」を使っており、整合する（`CONSISTENT`）。

OD 前の evidence 記録（変更なし）:

- token の中身は catalog の nameJa `パルミジャーノ` に一般的な suffix `チーズ` が付いただけ。競合する catalog id はない。
- 同じ canonicalizer は、同じパターンの `モッツァレラチーズ → モッツァレラ` を ORTHOGRAPHIC（exact）として扱っている。つまり likely_alias の区分は identity が曖昧だからではなく、表への登録位置による違い。
- 区分の変更は canonicalizer 表を変える判断にあたるため、表には適用していない（OD-PARM は game 層でだけ扱う）。

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

- **OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE**（ING-07）: 🦪 と 🐚 のどちらにも確定しない（`chosenGlyph: null`）。Preview Visual Gate で両方を並べて確認する。
- **OD-TOMATO-REPRESENTATION = TEMPORARY_SHARED_GLYPH**（ING-09）: `fresh-tomato` は独立した ingredient ID のまま維持し、`cherry-tomato` へ alias しない。🍅 の共有は Preview 用の暫定 visual としてだけ許可する。実機 Visual Gate は必須で、識別性が FAIL なら専用 visual / runtime 対応へ移行する（その時点で新しい runtime dependency として登録する）。

新 ingredient 7種の *identity* evidence は揃っている:

| ingredient | 分類 |
|---|---|
| corn / eggplant / fresh-tomato / pineapple / potato | exact_alias |
| capers | 登録済みの genuinely_new |
| clam | relay 時点で canonical（Phase 0B） |

W1 の likely_alias token は `オリーブ` と `パルミジャーノチーズ` の2つだけ。*見た目* は、非 cheese の piece を emoji だけで描画する仕様（`IngredientPieceVisual`）のため、実機での確認が必要。

| focus | 静的 finding | 実機で確認すること |
|---|---|---|
| **fresh-tomato 🍅 collision** | production の cherry-tomato（piece）および tomato-sauce（tray chip）と同じ glyph。cherry-tomato で作った Pesto Caprese は見た目が同一なのに **NO_MATCH**（production matcher で実証）。OD-TOMATO-REPRESENTATION で Preview 限定の共有を許可 | tray と pizza 上で fresh-tomato と cherry-tomato を見分けられるか |
| **eggplant 🍆 visibility** | 暗い紫の glyph。tomato-sauce の赤の上に置かれ、bake 時には roast tint がかかる | 焼成前後、reference ring、thumbnail で判別できるか |
| **clam 🐚 visibility** | #221 の候補は 🦪 OYSTER、brief は 🐚 SPIRAL SHELL。どちらも clam ではない。OD-CLAM-GLYPH で判断を Gate へ持ち越し | olive-oil / parmigiano / 🧄 garlic（淡色）の上で貝類と読めるか |
| **capers 🟢 distinguishability** | 無地の円形 glyph の仲間（⚫ black-olive、🔴 pepperoni）。区別の手がかりは色だけ | Puttanesca（⚫ と同じ pizza に載る）と tray（🔴 と並ぶ）での判別。赤緑の色覚多様性とグレースケールも含めて確認 |
| corn 🌽 / pineapple 🍍 / potato 🥔 | 同じ glyph を持つ ingredient はない | cheese 上での contrast、焼成後の判別 |

前提: 実機確認には、候補 ingredient を含む Preview build（#221 の slice B）が必要。docs だけでは実施できない。確認の方法は `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従う（390×844、動画はユーザーへ直接提出し、repo に commit しない）。

## Recipe 別の残り dependency

全 recipe がさらに REC-01〜04 を継承している（すべて open）。

| recipe | 解決済み | 残り（recipe 固有） | 種別 | 関連 OD | 判定 |
|---|---|---|---|---|---|
| new-haven-apizza | — | ING-07 | HVR | OD-CLAM-GLYPH（Gate へ持ち越し）、OD-PARM | REVIEW |
| hawaiian | — | ING-10 | HVR | — | REVIEW |
| parmigiana-pizza | REC-08, REC-10 | ING-03, RT-01 | HVR / runtime | OD-PARM | REVIEW |
| bambino | — | ING-08 | HVR | — | REVIEW |
| pizza-portuguesa | REC-06 | RT-01 | runtime | OD-OLIVE | REVIEW |
| puttanesca-pizza | REC-07 | ING-02, RT-01 | HVR / runtime | OD-OLIVE | REVIEW |
| pesto-caprese | — | ING-09 | HVR | OD-TOMATO-REPRESENTATION | REVIEW |
| pesto-tonno | REC-09 | **なし** | — | OD-OLIVE | REVIEW（global のみ） |
| pesto-patate | — | ING-11 | HVR | — | REVIEW |
| melanzane-pizza | REC-08 | ING-03 | HVR | — | REVIEW |

判定のルールは #221 と同じ: recipe 固有の ref と継承した global ref がどちらも open でないときだけ READY。BLOCKED は evidence または現行 mechanic で安全に表現できない場合で、該当なし。**READY 0 / REVIEW 10 / BLOCKED 0**。

## 残っている判断・確認

1. **Preview Visual Gate（HVR）**: 7 ingredient（capers / clam / corn / eggplant / fresh-tomato / pineapple / potato）。fresh-tomato / eggplant / clam / capers は必須 focus。clam は 🦪 と 🐚 の両方を見せる。fresh-tomato は共有 🍅 で識別できるかを判定し、FAIL なら専用 visual / runtime へ移る。
2. **RT-01**（runtime slice E）: parmigiana / portuguesa / puttanesca。minCount は削っていない。
3. 既存の REC-01〜04（global）は変更なし。

## READY へ進められる recipe

- **現時点ではなし**（REC-01〜04 がすべての recipe で open）。
- recipe 固有の dependency がない: **pesto-tonno**（global が閉じれば READY の候補）。
- 残りが HVR 1件だけ: hawaiian / bambino / pesto-patate / melanzane-pizza / new-haven-apizza / pesto-caprese。
- RT-01 が残る: pizza-portuguesa（RT-01 のみ）、parmigiana / puttanesca（HVR + RT-01）。

## 次の最小 slice

Slice B（7 ingredient を入れた Preview）で Preview Visual Gate を1回まとめて実施する。OD-OLIVE / OD-PARM を content data に反映するときは、GCR-OLIVE-01 / GCR-PARM-01 のとおり `black-olive` / `parmigiano` を使う（新しい ingredient id は作らない）。

## 成果物

- `docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json` — ledger ID ごとの結果、recipe ごとの残り dependency、pin した入力の hash
- `docs/reports/data/TETO_PROGRESS2_W1_TOKEN_PROVENANCE.json` — W1 の token 分類、olive / parmigiano / eggplant の census
- `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_REGRESSION_FIXTURES.json` — production matcher の結果と移植用の test case
- `docs/reports/data/TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json` — 7 ingredient の HVR 要件、clam / fresh-tomato の OD、`previewVisualGateHandoff`
- `docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json` — Owner Decision 4件、game canonicalization rule table、description candidate の整合チェック
- `docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md` — game normalization 層の節を追加（canonicalizer 表は変更なし）
- `tools/progression2_w1_evidence_resolution.py [--check]`、`tools/w1_discovery_regression_probe.mjs`、`tools/lib/*.mjs`（Node 22 の `--experimental-strip-types` で `src/**` を read-only import する）

## Validation

- `python3 tools/progression2_w1_evidence_resolution.py --check`: PASS。出力5ファイルが byte 単位で再現する。pin 検証（main との差分、#220 W1 集合の drift、#221 の authority 不一致、likely_alias 集合の変化、signature collision）に加えて、以下の双方向 invariant を検証する:
  - W1 の likely_alias 出現（PIZZA DB から再分類した結果 = merged matrix の tokenTrace）↔ game rule の適用 ↔ #221 ledger の aliasEvidence 行
  - rule ↔ Owner Decision ↔ 解決した ledger 行。rule は evidence disposition（likely_alias）を書き換えず、canonicalizer が提案する id 以外へは向けない
  - recipe ↔ ledger link（open な行は scope の recipe だけが残りとして持ち、解決した行は scope の recipe だけが解決済みとして持つ）
  - RT-01 scope = reference ring の容量超過 recipe。REC-01〜04 / RT-01 / ING 7件は open のまま。visual に PASS はない。clam の glyph は未確定、fresh-tomato は alias なし
  - authored minCount と sauce（OD-S1 = A）が #221 と一致する。description candidate は OD と整合する（入力から再計算）。readiness は derived rule から再計算する
- `python3 tools/progression2_w1_evidence_resolution.py --self-test`: PASS。27種類の mutation（OD の値の変更、rule の削除や向け先変更、PIZZA DB fact としての記録、RT-01 / REC-01 の解決、visual PASS、clam glyph の確定、fresh-tomato の alias、quantity / sauce の変更、description の「オリーブ」「グリーンオリーブ」「チェリートマト」化、READY の強制、orphan ref など）をすべて検出した。
- `validate_recipe_catalog.py`: PASS（53 / 62 / 11）。`progression2_evidence_invariants.py`: 4/4 PASS。canonicalizer の self-test: 36/36 PASS。#221 の `progression2_w1_authoring_audit.py --check` を d028844 の一時 worktree で read-only 実行: PASS（READY 0 / REVIEW 10 / BLOCKED 0、ledger orphans 0）。
- `src/**`、`e2e/**`、PR #220 / #221 の branch、#215 の production 実装はいずれも未変更。docs 専用の変更なので video は不要（policy §2）。
