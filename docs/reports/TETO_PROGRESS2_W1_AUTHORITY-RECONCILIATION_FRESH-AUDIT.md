# Progression 2.0 W1 Authority Reconciliation — Fresh Audit（PR #220 ↔ PR #221）

Status: **FACT AUDIT（docs/data only）**。どちらの W1 を正とするかは決めない。
`src/**`・PR #220・PR #221・wave authority・Owner Decision はいずれも変更していない。

Machine-readable: `docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY-RECONCILIATION.json`

## 0. 結論

1. **#221 が参照した #220 の commit は `d3a2c8f`**（PR #220 の最初の head）。#221 の 10 recipe は `d3a2c8f` の
   `first10CandidateSet` と集合一致し、新 ingredient 6種も `distinctNewIngredientIds` と一致する。#221 の最初の
   commit `1f53c16`（08:33:36Z）の時点では、#220 の head は `d3a2c8f` しか存在していなかった。
2. **食い違いは `4b777fe`（08:36:07Z）で発生した**。#221 の最初の commit から 2分31秒後。W1 は 20→11、
   first-10 は **5 recipe が抜けて 5 recipe が入った**。その後の `d315211` / `e49dab9` では first-10 は
   1件も変わっていない。
3. **原因**は、`4b777fe` が #220 の Codex P2 指摘2件をまとめて修正したこと。
   - (a) **`SAUCELESS_RECIPE_CONTRACT`**: `sauceBase.status == none` の行を W4 へ移した。
     `RECIPE_SAUCE_PROFILES` が網羅的な `Record<RecipeId, …>` で、test が各 recipe の必須 sauce を指すことを
     要求しているため。
   - (b) **identity-set overlap**: family-derived sauce を含めた完全な identity set で overlap を再計算した。
   #221 は W1 をスクリプトに**直書き**しており、#220 の成果物を読まないため、#220 が変わっても
   `--check` は PASS のまま（drift 検知なし）。18e2451 / 279b6b1 でも W1 は再同期されていない。
4. **unsupported sauce contract（`d315211`）は first-10 に影響していない**。W1 から外れたのは
   Flammkuchen（`fromage-blanc-sauce`）だけで、同行は `4b777fe` の時点で既に first-10 外だった。
   この commit 以降 W1 = first-10（予備なし）になった。
5. **「first-10 不変」という過去報告は、直前 commit 比ではすべて正しい**（d315211 は 4b777fe 比、
   e49dab9 は d315211 比）。d3a2c8f 比で不変と述べたものはない。ただし、`4b777fe` の返信は
   5/5 の入れ替えのうち 2/2 しか明示していない（§4）。0b285be の guide §1.2 が移動を
   「d315211 / e49dab9」に帰している点は **不正確**（正しくは 4b777fe）。
6. **Dry-run（#221 を e49dab9 の W1 に合わせた場合）: READY 0 / REVIEW 10 / BLOCKED 0**
   （現行は READY 1 / REVIEW 9 / BLOCKED 0）。新 ingredient は 6→7 種（capers と eggplant は共通、4種が抜けて5種が入る）。
   #221 checker のハード assert のうち6件が FAIL する（§6.6）。

## 1. 監査対象 HEAD / 再現

| 対象 | SHA | 再現 |
|---|---|---|
| PR #220 | `e49dab96bd9b26dc0f520349cf09d1160c3519f5` | `tools/progression2_content_readiness_audit.py --check` → OK (172 rows, 15 production recipes) |
| PR #221 | `279b6b17188ed3572b27c1ba91b2c4983723ddc0` | `tools/progression2_w1_authoring_audit.py --check` → PASS (10 / 6 / READY 1 / REVIEW 9 / BLOCKED 0) |
| Visual Authoring Guide | `0b285be04c2fd2b972a2526a8a038171230a62a7` | 読むだけ |
| main（両PR共通 base） | `dff233c042d2df6ee1c3a92f2d2419830aa05460` | — |

両 `--check` は各 HEAD の detached worktree で実行した。#221 の branch は main から分岐しており、
#220 の commit を1つも含まない（`merge-base(#220, #221) = dff233c`）。

## 2. タイムライン（UTC）

| 時刻 | PR | commit | W1 | first-10 | 内容 |
|---|---|---|---|---|---|
| 08:21:28 | #220 | `d3a2c8f` | 20 | **OLD**（新材料6） | 初版。PR #220 open 08:22:07 |
| 08:26:20 | #220 | — | | | Codex P2×2: identity-set overlap / sauce-less を W1 から除外 |
| **08:33:36** | #221 | `1f53c16` | — | OLD を直書き | PR #221 open 08:33:56 |
| **08:36:07** | #220 | **`4b777fe`** | 11 | **CURRENT**（新材料7） | **divergence**。P2×2 を修正 |
| 09:13:35 | #221 | `18e2451` | — | OLD のまま | REC-09 と polish-kielbasa ID の修正のみ |
| 10:03:48 | #220 | `d315211` | 10 | 変化なし | `UNSUPPORTED_SAUCE_ID_CONTRACT`。Flammkuchen W1→W4 |
| 10:16:19 | #220 | `e49dab9` | 10 | 変化なし | composition を src から導出。全 wave に sauce-profile files |
| 10:37:06 | #221 | `279b6b1` | — | OLD のまま | REC-07 link、ledger checker |
| 10:47:18 | guide | `0b285be` | — | 和集合 | 11 ingredient の visual guide、VD-01 を提起 |

## 3. generator / checker の入力 authority

| | #220 `e49dab9` | #221 `279b6b1` |
|---|---|---|
| W1 の決め方 | **計算**: FULL + READY + runtime-contract 依存なし + 新材料 ≤1 → W1。first-10 は全組合せ探索（新材料種類数 → 新材料行数 → overlap 合計の順に最適化） | **直書き**: `RECIPES` の10行リテラル |
| 読む入力 | #189 matrix、pizza/ingredient master catalog、`src/data/recipes.ts`（composition）、`ingredients.ts`、`recipeSauceProfiles.ts`（union）、`.test.ts` | #189 matrix と master evidence（evidenceId の存在と canonicalCandidateId の drift の確認のみ） |
| #220 の pin | — | `sourceRefs: "PR #220 (OPEN)"` のみで SHA なし。pin されているのは `auditedMainSha` だけ |
| sauce モデル | sauce-less / unsupported sauce は data-only ではない（W4） | `sauce=None` の行は `sauceProfileRequired: false` |
| drift 検知 | src と catalog の不一致で FAIL | **なし**。#220 がどう変わっても PASS |

**#221 の成果物が固定している authority**: PR #220 `d3a2c8f` の first-10（sauce を除いた overlap と、runtime
contract を考慮しない W1）。さらに `READY==1`、`REVIEW==9`、ingredient 6種、ledger 15件、pesto-tonno /
portuguesa / puttanesca の refs が assert で固定されている。

## 4. 「first-10 不変」報告との整合性

| 報告 | 主張 | 判定 |
|---|---|---|
| #220 thread `…lf559` 返信（4b777fe） | first-10 に hawaiian / bambino が入り、polish-kielbasa / tsukimi が抜けた | **正しいが不完全**。実際は 5 in / 5 out。aussie・bacalhau・full-english-pizza の除外と new-haven-apizza・pesto-caprese・pesto-patate の追加は書かれていない |
| #220 thread `…lgMED` 返信（d315211） | "The first-10 set is unchanged (7 new ingredients)" | **正しい**（4b777fe 比で完全一致を確認） |
| #220 comment 5812219116（e49dab9） | "Wave counts, the first-10 set and the unresolved ledger are unchanged" | **正しい**（d315211 比。UNRESOLVED.json は変更なし） |
| #221 report / PR body | 「#220 の unordered first-10 candidate set を再監査」 | 1f53c16 の時点では正しい。現在は #220 HEAD と一致しない（SHA を記載していない） |
| 0b285be §1.2 | 「d315211 / e49dab9（runtime-contract 依存の W4 移動）以前の W1 を参照した可能性が高い」 | **commit の帰属が不正確**。sauce-less の W4 移動と first-10 の入れ替えはすべて 4b777fe で起きた |

## 5. Recipe 単位の記録

凡例: OLD = #220 `d3a2c8f` の first-10（= #221）、CURRENT = #220 `e49dab9` の first-10（= W1 全体）。
"S1" は sauce-less 除外だけを適用した反実仮想、"S2" は identity overlap だけを適用した反実仮想。
いずれも d3a2c8f の W1 の20行を母集団にした（§5.3）。

### 5.1 OLD にのみ含まれる（5）: W1 → W4

| recipe | OLD | CURRENT | wave change | reason | governing evidence | #221 impact | visual-authoring impact |
|---|---|---|---|---|---|---|---|
| `aussie` | ✓ | — | W1→W4 (4b777fe) | `SAUCELESS_RECIPE_CONTRACT` **のみ**（S2 だけなら残る） | matrix `sauceBase.status=none`（"チーズ（トマトソースなし）"）。`RECIPE_SAUCE_PROFILES` は網羅的 Record | **唯一の READY（slice A）が消える**。現状でも `sauceProfileRequired:false` と「直行可能」は現行 contract と矛盾する | 新材料なし。影響なし |
| `bacalhau` | ✓ | — | W1→W4 (4b777fe) | `SAUCELESS` のみ | 同上（"チーズ"） | REVIEW 行が消え、ING-05 が orphan になる | `salt-cod` 🐟 が scope 外へ（anchovy と R1 衝突していた） |
| `full-english-pizza` | ✓ | — | W1→W4 (4b777fe) | `SAUCELESS` のみ | 同上 | ING-01 が orphan になる | `baked-beans` 🫘（Emoji 14.0、VD-04）が scope 外へ |
| `polish-kielbasa` | ✓ | — | W1→W4 (4b777fe) | **2つの原因がそれぞれ単独で除外する**。S2 では hawaiian/bambino に押し出され、`SAUCELESS` で W4 へ移る | 同上。加えて Codex P2（identity overlap） | ING-06 が orphan になる | `sauerkraut` 🥬 が scope 外へ |
| `tsukimi-pizza` | ✓ | — | W1→W4 (4b777fe) | 2つの原因がそれぞれ単独で除外する（polish-kielbasa と同じ） | 同上 | ING-04 が orphan になる | `green-onion` 🌱 が scope 外へ（rosemary と R1 衝突していた） |

### 5.2 CURRENT にのみ含まれる（5）: W1 内で first-10 に昇格（wave は W1 のまま）

| recipe | OLD | CURRENT | wave change | reason | governing evidence | #221 impact | visual-authoring impact |
|---|---|---|---|---|---|---|---|
| `hawaiian` | — (W1 内) | ✓ | W1→W1 | **どちらの原因でも単独で入る**。overlap 0.667→0.75（family-derived tomato-sauce）と、sauce-less 除外で空いた枠 | matrix identityIngredientSet（tomato-sauce を family_derived で含む） | 新規行。description / minCount / bake が未 authoring | `pineapple` 🍍（衝突なし、minCount 未 authoring） |
| `bambino` | — (W1 内) | ✓ | W1→W1 | 同上 | 同上 | 新規行。hawaiian と Jaccard 0.6（差は pineapple↔corn のみ） | `corn` 🌽 |
| `new-haven-apizza` | — (W1 内) | ✓ | W1→W1 | **sauce-less 除外だけで入る**（overlap は 0.75 のまま。olive-oil は元から listed） | matrix `sauceBase` オイル → `olive-oil`（listed） | 新規行。**W1 で初めての olive-oil（`PAINT_TEMPORARY`）**。mozzarella なし | `clam` 🐚。olive-oil 背景での検証が必要 |
| `pesto-caprese` | — (W1 内) | ✓ | W1→W1 | sauce-less 除外だけで入る（S1）。overlap も 0.667→0.75 | matrix バジル family → pesto（family_derived）。master evidence は pesto-family を **DISCOVERY/MATCHING STRESS TEST** としている | 新規行。shipped genovese（pesto + mozzarella + cherry-tomato）に近い | **`fresh-tomato` 🍅 = cherry-tomato / tomato-sauce と同じ emoji（R1 違反、VD-02）** |
| `pesto-patate` | — (W1 内) | ✓ | W1→W1 | **2つの原因が両方必要**。S1 だけでは Flammkuchen（0.667）が10枠目を取る。overlap 修正（0.667→0.75）で上回る | matrix バジル family → pesto | 新規行 | `potato` 🥔 |

### 5.3 共通（5）

| recipe | OLD | CURRENT | wave change | reason | governing evidence | #221 impact | visual-authoring impact |
|---|---|---|---|---|---|---|---|
| `parmigiana-pizza` | ✓ | ✓ | W1 維持 | overlap 0.75→0.8 のみ | family_derived tomato-sauce | ING-03 と REC-08 は不変。**`パルミジャーノチーズ`→`parmigiano` の likely_alias を #221 は拾っていない**（どちらの authority でも該当） | eggplant 🍆（authored minCount あり） |
| `pizza-portuguesa` | ✓ | ✓ | W1 維持 | 変化なし（1.0） | `オリーブ`→`black-olive` likely_alias | REC-06 は不変 | なし |
| `puttanesca-pizza` | ✓ | ✓ | W1 維持 | overlap 0.75→0.8 | `オリーブ` likely_alias、`ケッパー` genuinely_new | ING-02 と REC-07 は不変 | capers 🟢 |
| `pesto-tonno` | ✓ | ✓ | W1 維持 | 変化なし（1.0） | `オリーブ` likely_alias | REC-09 は不変。pesto-family の近接が新たに発生（caprese / patate） | なし |
| `melanzane-pizza` | ✓ | ✓ | W1 維持 | overlap 0.667→0.75 | family_derived tomato-sauce | ING-03 と REC-08 は不変 | eggplant 🍆 |

**反実仮想（d3a2c8f の W1 20行を母集団にした場合）**
- S1（sauce-less 除外のみ）: `{bambino, flammkuchen, hawaiian, melanzane, new-haven, parmigiana, pesto-caprese, pesto-tonno, portuguesa, puttanesca}`
- S2（identity overlap のみ）: `{aussie, bacalhau, bambino, full-english, hawaiian, melanzane, parmigiana, pesto-tonno, portuguesa, puttanesca}`。Codex P2 の予測（hawaiian/bambino が入り polish/tsukimi が抜ける）と一致する。
- S1 + S2 の結果は 4b777fe の実結果と完全に一致する。

### 5.4 unsupported sauce contract との関係

- OLD / CURRENT の15 recipe のどれも `UNSUPPORTED_SAUCE_ID_CONTRACT` に依存していない。OLD にのみ含まれる5件は全件が `SAUCELESS_RECIPE_CONTRACT`。
- `d315211` で W1 から外れたのは `flammkuchen` のみ（`fromage-blanc-sauce`）。4b777fe の時点で既に first-10 外（overlap 0.667 で10枠目を pesto-patate に譲っていた）だったため、**first-10 には影響しない**。
- 同時に W1 から first-10 以外の行がなくなった（W1 = first-10）。今後 W1 から1件でも外れると、代替候補は存在しない。
- 補足: d3a2c8f の W1 から sauce-less で W4 に移った行は他にもある（palmito, porchetta, salsiccia-e-friarielli, spanish-chorizo）。いずれも first-10 外。
- 補足: matrix の sauceBase rule 文言 "SAUCE step skipped, as for shipped quattro-formaggi-style" は production と一致しない（`quattro-formaggi` は `olive-oil` profile を持つ）。証拠文言の不整合として記録するだけで、判定はしない。

## 6. Dry-run: #221 を #220 `e49dab9` の W1 に rebase / regenerate した場合

前提: #221 自身の readiness 規則（未解決 ref が1つでもあれば REVIEW）と ledger の規則（新 ingredient には ING、
`オリーブ` の likely_alias には REC、eggplant family には REC-08）を、そのまま CURRENT の10件に適用した。
#221 のファイルは一切変更していない。新規 ID は `DRY-*` という暫定名で、#221 の採番ではない。

### 6.1 READY / REVIEW / BLOCKED

| | READY | REVIEW | BLOCKED |
|---|---|---|---|
| #221 HEAD（OLD） | 1（aussie） | 9 | 0 |
| **dry-run（#221 の規則を厳密に適用）** | **0** | **10** | 0 |
| dry-run + 候補 ref（§6.3） | 0 | 10 | 0 |

READY が 0 になる理由: CURRENT には新材料も likely_alias もない recipe が存在しない。
新材料を使わない portuguesa と pesto-tonno は REC-06 / REC-09 を持つ。

| recipe | refs（厳密） | 候補 ref |
|---|---|---|
| new-haven-apizza | DRY-ING-07 (clam) | — |
| hawaiian | DRY-ING-09 (pineapple) | DRY-REC-11 |
| parmigiana-pizza | ING-03, REC-08 | DRY-REC-14 |
| bambino | DRY-ING-08 (corn) | DRY-REC-11 |
| pizza-portuguesa | REC-06 | — |
| puttanesca-pizza | ING-02, REC-07 | — |
| pesto-caprese | DRY-ING-10 (fresh-tomato) | DRY-REC-12, DRY-REC-13 |
| pesto-tonno | REC-09 | DRY-REC-13 |
| pesto-patate | DRY-ING-11 (potato) | DRY-REC-13 |
| melanzane-pizza | ING-03, REC-08 | — |

### 6.2 Ingredient set

- 残る: `capers`, `eggplant`
- 外れる: `baked-beans`, `green-onion`, `salt-cod`, `sauerkraut`
- 入る: `clam`, `corn`, `fresh-tomato`, `pineapple`, `potato`
- 6種 → **7種**

### 6.3 Unresolved ledger（15件 → dry-run）

- **残る**: REC-01〜04, REC-06〜09, ING-02, ING-03
- **残るが該当 recipe がなくなる**: REC-05（"cheese-family recipes" = sauce-less。dry-run の W1 には0件）
- **orphan になるため削除が必要**: ING-01, ING-04, ING-05, ING-06（`validate_ledger_links` が FAIL するため）
- **追加（visual, AUTHORING_REQUIRED）**: DRY-ING-07 clam / 08 corn / 09 pineapple / 10 fresh-tomato / 11 potato
- **新規の evidence requirement 候補**:
  - DRY-REC-10: 新たに入る5件は description / minCount / bakeTarget の authored candidate がない。一から作成が必要（REC-01 の scope は既存の範囲で、値そのものが存在しない）。
  - DRY-REC-11（候補）: hawaiian / bambino の兄弟近接（Jaccard 0.6）。#221 は eggplant pair（0.8）に REC-08 を付けたが、OLD の aussie / tsukimi（0.6）には付けていない。この候補を採るかは規則を一貫させるかどうかの選択。
  - DRY-REC-12（候補）: pesto-caprese の `トマト`→`fresh-tomato` と、genovese（同じ pesto base）の `cherry-tomato` の区別。🍅 の emoji が衝突する。
  - DRY-REC-13（候補）: pesto family 3件と shipped genovese の discovery regression（master evidence の STRESS TEST 注記に基づく）。
  - DRY-REC-14（候補）: parmigiana の `パルミジャーノチーズ`→`parmigiano`（likely_alias）。**OLD / CURRENT のどちらでも該当する**、#221 の既存の漏れ。

### 6.4 Alias evidence

- likely_alias（dry-run）: portuguesa・puttanesca・pesto-tonno の `オリーブ`、parmigiana の `パルミジャーノチーズ`。いずれも OLD と共通。
- 新たに入る5件の token は、すべて exact_alias または phase0b_sample_canonical。**新しい `オリーブ` 型の alias は増えない**。
- 抜ける5件にも likely_alias はない。つまり alias ledger（REC-06/07/09）は authority をどちらにしても不変。

### 6.5 Visual authoring 対象（0b285be との関係）

- dry-run の対象: `capers, clam, corn, eggplant, fresh-tomato, pineapple, potato`。**すべて 0b285be の11種に含まれている**（guide の再作成は不要）。
- minCount が authored なのは capers と eggplant だけ（#221 由来）。残り5種は 0b285be でも "minCount not authored" のままで、piece 数に依存するチェック項目は評価できない。
- preflight の衝突: dry-run の scope では **fresh-tomato 🍅 の1件だけ**（cherry-tomato・tomato-sauce と同じ U+1F345）。salt-cod（anchovy）と green-onion（rosemary）の衝突、baked-beans の Emoji 14.0 問題（VD-04）は scope 外になる。
- 検証すべき背景: tomato-sauce / pesto / **olive-oil**（new-haven）。OLD では sauce-less（dough 直置き）4件分の背景が必要だった。

### 6.6 Future implementation change-map

| slice | #221 HEAD | dry-run |
|---|---|---|
| A 既存材料・ref なし | aussie | **空** |
| B 既存材料・alias review | portuguesa, pesto-tonno | 同左 |
| C 新 ingredient | baked-beans, capers, eggplant, green-onion, salt-cod, sauerkraut | capers, clam, corn, eggplant, fresh-tomato, pineapple, potato |
| D 新材料を使う recipe | bacalhau, parmigiana, puttanesca, full-english, polish-kielbasa, melanzane, tsukimi | parmigiana, puttanesca, melanzane, new-haven, hawaiian, bambino, pesto-caprese, pesto-patate |
| E Completion Gate | #218 | 同左 |

- likelyFiles の差分: e49dab9 の規則では、**全 recipe slice に `recipeSauceProfiles.ts` と `.test.ts` が必要**（#221 の slice A はこれを含まない）。test の `toHaveLength(15)` 更新は、どちらの authority でも必要。
- runtime contract slice は dry-run では不要。逆に #221 HEAD の set を e49dab9 の contract の下で実装する場合、5件に `SAUCELESS_RECIPE_CONTRACT`（profile の optional 化と test contract の変更）が必要で、data-only ではない。
- #221 checker で FAIL する assert: `READY==1`, `REVIEW==9`, `len(INGREDIENTS)==6`, `len(LEDGER)==15`, ledger link（ING-01/04/05/06 の orphan）, report 固定文（「Aussie のみ」「6種」）。

## 7. VD-01 で owner が実際に決める必要があること

本監査はいずれも決めない。事実から、決定が必要な論点を分けて示す。

1. **#221 の W1 authority をどちらにするか**: #220 `e49dab9` の計算結果（CURRENT）か、#221 が直書きしている `d3a2c8f` の first-10（OLD）か。
2. **`SAUCELESS_RECIPE_CONTRACT` を W1 の除外規則として認めるか**。aussie / bacalhau / full-english を外しているのは、この規則だけ。認めない場合は、網羅的な `RECIPE_SAUCE_PROFILES` を広げる runtime 変更が W1 の前提になる。
3. **identity-set overlap（family-derived sauce を含む）を順位付けの基準にするか**。この規則だけで polish-kielbasa / tsukimi が hawaiian / bambino に入れ替わる。
4. **#221 に #220 の SHA を pin させ、直書きではなく WAVES.json を読ませる drift guard を求めるか**。
5. **#221 にしかない4 ingredient（baked-beans / green-onion / salt-cod / sauerkraut）の扱い**。0b285be の visual 作業を後続 wave 用に残すか、W1 scope から外すか。
6. **候補 evidence（DRY-REC-11〜14）を採るか**。DRY-REC-14 は、どちらの W1 を選んでも該当する。

## 8. 変更範囲

- 追加: 本 report と `docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY-RECONCILIATION.json` のみ。
- `src/**`、PR #220 / #221 の branch、wave authority、Owner Decision は変更なし。PR は作成していない。Full CI / WebKit は実行していない。
- 実行したのは、#220 / #221 の `--check`（各 HEAD の一時 worktree）と、scratchpad 上の集計スクリプト（repo 外。入力はすべて上記 SHA の `git show` と main の matrix / src）だけ。
