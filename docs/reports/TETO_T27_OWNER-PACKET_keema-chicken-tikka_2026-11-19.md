# T27 Owner 判断パケット — keema-pizza / chicken-tikka-pizza（2026-11-19、暫定値）

**これは判断資料です。** T27 の実装開始、NO_SAUCE の採用、Research の ID 別 letter 変更、canonical Gate の緩和、merge の承認ではありません（Owner 承認 #866 `6998576764`／`6998594588` の範囲）。
**すべて暫定値**: 測定は main `6954a874` で、**T26（nashville-hot-chicken-pizza／nduja-pizza／nduja）が未着地**の状態です。T26 着地後は、同じ手順で再 preflight が必要です（件数・letter・重複の値が変わりえます）。候補2件は全177レシピ・170食材・27工程の最終目標を縮小しません。

## 0. 再現条件
- 基準 main `6954a874`（116 recipes / 137 ingredients / 101 ladder steps）。
- 候補ごとの spec: `node tools/content-train/make-spec.mjs --train T27-<id> --ids <id> --out <spec>`、検査: `node tools/content-train/preflight.mjs <spec> --out <dir>`（keema は終了コード 0／NEEDS_OWNER、chicken-tikka も 0／NEEDS_OWNER、STOP なし）。
- Research の「旧→新」: `researchLetterChangesAcrossOrders([<id>], [...RECIPES, <staged row>], 40, 20261105)`（canonical 順＋ seed 20261105 の40個のランダム取得順。staged の素材は `whatIfIngredients` で有限素材として扱う）。測定コードと出力は `docs/reports/data/TETO_T26-T27_HANDOFF/t27-research.json`。標本は上限（preflight の決定的な上界）の部分集合で、**上界にない ID は観測されていません**。
- 候補の spec は staged 行から機械的に作った下書きです。Owner 判断（NO_SAUCE、重複例外、素材の定義、ID 別 Research 承認）が入るまで実装 spec ではありません。

## 1. keema-pizza

### 1-1. 現行ソースと根拠
- 証跡 id `keema-pizza-pizzadb-p2`（PIZZA DB の比較表サンプル。**原典の独立再確認はありません**）。インド／各地、生地は薄め・丸。
- 原文の素材（日本語）: ひき肉、玉ねぎ、モッツァレラチーズ、青唐辛子。ソース系統は「カレー」で**ベース未指定**。
- 正準化の結果: 玉ねぎ→`onion`、モッツァレラ→`mozzarella`。**ひき肉は未解決**（関連候補 `ground-beef`＝staged で `beef` の仮の別名）、**青唐辛子も未解決**（関連候補 `chili-oil`、曖昧）。
- staged の下書き: mozzarella 3 / onion 2 のみ。理由コード: `BASE_SAUCE_UNSPECIFIED`、`SUBSET_OF_SHIPPED_FORBIDDEN`、`UNRESOLVED_INGREDIENT`。
- **過去の判断**: 26-4 で「keema-pizza を T26 から外す」（R1 の定義、C-1）。

### 1-2. NO_SAUCE の採否（選択肢）
| 案 | 内容 | ゲーム上の理由・影響 |
|---|---|---|
| A. NO_SAUCE | ソース無しで出荷（Owner の明示例外が必要） | SAUCE の段がなく、Hint 5.0 は CHEESE から始まる。原典はカレー系ソースなので「原典と違う」が、新素材・新機構は不要。**TQ1D の G7 は発動していません** |
| B. 既存 `curry-ketchup` を PAINT で代用 | B18 の curry-pizza-japan と同じ前例（「未指定のカレー下地を curry-ketchup で代用」） | SAUCE の段が付く。ただし素材を足した下の変種では重複が悪化します（下記 1-4） |
| C. 新しいカレーソース素材 | 新しい sauce 素材 | **170食材の計画に枠がない**（計画の変更が必要）。新素材の描画・Shop も要る |
| D. 保留 | 原典の確認が済むまで出荷しない | 177レシピの目標は縮小しません（順序の問題） |

### 1-3. Research の ID 別 旧→新（標本。上限は22 ID、観測は20 ID、canonical は 0）
- canonical の順序で変わる既存レシピ: **0**（stop condition には当たりません）。
- 上限にあって観測されなかった ID: `pesto-tonno`、`supreme-pizza`（標本に出なかっただけで、上限の承認単位には含まれます）。
- 観測された変化は、すべて preflight の案（新規 letter のみ、または1つ後ろへ）の範囲内です。

| 既存レシピ | stage（共有素材の最後）と上限（preflight の案） | 許される変化 | 標本で観測した変化（旧→新） | 例（取得順） |
|---|---|---|---|---|
| `aussie` | onion: new first letter only | (none)→A | -->A | aussie + keema-pizza materials only, onion last |
| `bacalhau` | onion: new first letter only | (none)→A | -->A | bacalhau + keema-pizza materials only, onion last |
| `baingan-bharta-pizza` | onion: new first letter only | (none)→A | -->A | baingan-bharta-pizza + keema-pizza materials only, onion last |
| `bbq-chicken-pizza` | onion: new first letter only | (none)→A | -->A | bbq-chicken-pizza + keema-pizza materials only, onion last |
| `brazilian-calabresa` | onion: new first letter only | (none)→A | -->A | brazilian-calabresa + keema-pizza materials only, onion last |
| `curry-pizza-japan` | onion: later by at most 1 | (none)→A..B; X→X+1 | -->B, B->C, D->E, E->F, J->K, M->N, N->O, O->P, P->Q, S->T | every ladder material, onion last |
| `flammkuchen` | onion: new first letter only | (none)→A | -->A | flammkuchen + keema-pizza materials only, onion last |
| `fugazza` | onion: new first letter only | (none)→A | -->A | fugazza + keema-pizza materials only, onion last |
| `goulash-pizza` | onion: new first letter only | (none)→A | -->A | goulash-pizza + keema-pizza materials only, onion last |
| `nigerian-suya-pizza` | onion: new first letter only | (none)→A | -->A | nigerian-suya-pizza + keema-pizza materials only, onion last |
| `pesto-tonno` | onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `pizza-moscow` | onion: later by at most 1 | (none)→A..B; X→X+1 | B->C, F->G, N->O, O->P, P->Q, Q->R, R->S, V->W | every ladder material, onion last |
| `pizza-portuguesa` | onion: new first letter only | (none)→A | -->A | pizza-portuguesa + keema-pizza materials only, onion last |
| `polish-kielbasa` | onion: new first letter only | (none)→A | -->A | polish-kielbasa + keema-pizza materials only, onion last |
| `rendang-pizza` | onion: new first letter only | (none)→A | -->A | rendang-pizza + keema-pizza materials only, onion last |
| `south-african-boerewors` | onion: new first letter only | (none)→A | -->A | south-african-boerewors + keema-pizza materials only, onion last |
| `spanish-chorizo-pizza` | onion: later by at most 1 | (none)→A..B; X→X+1 | -->B, B->C, C->D, G->H, N->O, P->Q, Q->R, T->U | every ladder material, onion last |
| `supreme-pizza` | onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `tandoori-paneer-pizza` | onion: new first letter only | (none)→A | -->A | tandoori-paneer-pizza + keema-pizza materials only, onion last |
| `tonno-e-cipolla` | onion: new first letter only | (none)→A | -->A | tonno-e-cipolla + keema-pizza materials only, onion last |
| `veggie-supreme-pizza` | onion: new first letter only | (none)→A | -->A | veggie-supreme-pizza + keema-pizza materials only, onion last |
| `wasabi-beef-pizza` | onion: later by at most 1 | (none)→A..B; X→X+1 | -->B, B->C, H->I, M->N, O->P, Q->R, U->V | every ladder material, onion last |

### 1-4. 必要食材・配置・工程、既存実装との関係
- 下書きのまま（mozzarella 3 / onion 2）だと、出荷済みの17レシピの**部分集合**になり、重複 Gate は D-1 の例外が17件要ります（「部分集合は禁止」の規則）。
- ひき肉を入れる変種を試しました（scratch）:

| 変種 | 結果 |
|---|---|
| K1: 下書き（mozzarella 3 / onion 2、NO_SAUCE） | NEEDS_OWNER、重複17件、Research 非canonical 22 |
| K2: ＋ `beef` 2（ひき肉の代用） | NEEDS_OWNER、重複4件（nigerian-suya-pizza 0.75、rendang-pizza 0.75、wasabi-beef-pizza 0.6 ほか）、Research 非canonical 23 |
| K3: K2 ＋ `curry-ketchup`（案B） | NEEDS_OWNER、重複7件。**rendang-pizza と IDENTICAL（Jaccard 1.0）**、curry-pizza-japan・nigerian-suya と ONE_DIFF、Research 非canonical 24 |

- `beef` の絵は `beef-slices`（薄切り）で、ひき肉の見た目と合いません。`ground-beef` を別素材にすると食材が1つ増えます（計画外）。
- 配置・工程: 標準（ソース→チーズ→具）、新しい機構は不要（`mechanics: []`）。Shop の pack の変化はなし。

### 1-5. claim／PR の重複
T27 の claim はありません。T26 と同じ HOT ファイル（`recipes.ts`、`orders.ts` など）を触るため、**T26 の着地後に直列**です（Session Operations §1）。open PR との重なりは T26 と同種で、実装時に再計測します。

## 2. chicken-tikka-pizza

### 2-1. 現行ソースと根拠
- 証跡 id `chicken-tikka-pizza-pizzadb-p5`（PIZZA DB の比較表サンプル、原典の独立再確認なし）。インド／各地、薄め・丸。
- 素材: チキンティッカ、玉ねぎ、パプリカ、モッツァレラ、コリアンダー。ソース系統は「カレー」でベース未指定。
- 正準化: bell-pepper、**chicken-tikka（新規素材。調理済みの複合食材の旗あり）**、cilantro、mozzarella、onion。下書き: bell-pepper 2 / chicken-tikka 2 / cilantro 2 / mozzarella 3 / onion 2。理由コード: `BASE_SAUCE_UNSPECIFIED`、`JACCARD_OVER_0.4_EXCEPTION`、`PREPARED_COMPOSITE_INGREDIENT`。
- `chicken-tikka` は staged で「`chicken` の別名候補」ですが、別名にすると重複 Gate に当たるため新素材のまま（I-1）。

### 2-2. NO_SAUCE の採否（選択肢）
| 案 | 内容 | 影響 |
|---|---|---|
| A. NO_SAUCE | Owner の明示例外 | 下書きのまま。重複は2件（bbq-chicken-pizza 0.429、spanish-chorizo-pizza 0.5）で D-1 の例外が要る |
| B. `curry-ketchup` の PAINT で代用 | B18 の前例 | SAUCE の段が付く。重複が4件に（baingan-bharta 0.5、curry-pizza-japan 0.429、rendang 0.429、spanish-chorizo 0.429）、Research 非canonical は 29 |
| C. 新カレーソース素材 | 新素材 | 170食材の計画に枠がない |
| D. 保留 | — | 順序の問題 |

### 2-3. Research の ID 別 旧→新（標本。上限は28 ID、観測は23 ID、canonical は 0）
- 上限にあって観測されなかった ID: `brazilian-calabresa`、`pesto-tonno`、`polish-kielbasa`、`south-african-boerewors`、`supreme-pizza`。
- 観測は、すべて preflight の案の範囲内です。

| 既存レシピ | stage（共有素材の最後）と上限（preflight の案） | 許される変化 | 標本で観測した変化（旧→新） | 例（取得順） |
|---|---|---|---|---|
| `aussie` | onion: new first letter only | (none)→A | -->A | aussie + chicken-tikka-pizza materials only, onion last |
| `bacalhau` | onion: new first letter only | (none)→A | -->A | bacalhau + chicken-tikka-pizza materials only, onion last |
| `baingan-bharta-pizza` | cilantro: new first letter only; onion: new first letter only | (none)→A | -->A | baingan-bharta-pizza + chicken-tikka-pizza materials only, onion last |
| `banh-mi-pizza` | cilantro: new first letter only | (none)→A | -->A | banh-mi-pizza + chicken-tikka-pizza materials only, cilantro last |
| `bbq-chicken-pizza` | cilantro: new first letter only; onion: new first letter only | (none)→A | -->A | bbq-chicken-pizza + chicken-tikka-pizza materials only, onion last |
| `brazilian-calabresa` | onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `curry-pizza-japan` | onion: later by at most 1 | (none)→A..B; X→X+1 | -->B, A->B, B->C | curry-pizza-japan + chicken-tikka-pizza materials only, onion last |
| `flammkuchen` | onion: new first letter only | (none)→A | -->A | flammkuchen + chicken-tikka-pizza materials only, onion last |
| `fugazza` | onion: new first letter only | (none)→A | -->A | fugazza + chicken-tikka-pizza materials only, onion last |
| `goulash-pizza` | onion: new first letter only | (none)→A | -->A | goulash-pizza + chicken-tikka-pizza materials only, onion last |
| `nigerian-suya-pizza` | onion: new first letter only | (none)→A | -->A | nigerian-suya-pizza + chicken-tikka-pizza materials only, onion last |
| `pesto-tonno` | onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `pesto-vegetariana` | bell-pepper: new first letter only | (none)→A | -->A | pesto-vegetariana + chicken-tikka-pizza materials only, bell-pepper la |
| `pizza-moscow` | onion: later by at most 1 | (none)→A..B; X→X+1 | B->C, C->D | pizza-moscow + chicken-tikka-pizza materials only, onion last |
| `pizza-portuguesa` | onion: new first letter only | (none)→A | -->A | pizza-portuguesa + chicken-tikka-pizza materials only, onion last |
| `polish-kielbasa` | onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `ratatouille-pizza` | bell-pepper: new first letter only | (none)→A | -->A | ratatouille-pizza + chicken-tikka-pizza materials only, bell-pepper la |
| `reina-pepiada-pizza` | cilantro: new first letter only | (none)→A | -->A | reina-pepiada-pizza + chicken-tikka-pizza materials only, cilantro las |
| `rendang-pizza` | onion: new first letter only | (none)→A | -->A | rendang-pizza + chicken-tikka-pizza materials only, onion last |
| `south-african-boerewors` | onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `spanish-chorizo-pizza` | bell-pepper: later by at most 1; onion: later by at most 1 | (none)→A..B; X→X+1 | -->B, A->B, B->C, C->D | fugazza + chicken-tikka-pizza materials + sausage, onion last |
| `supreme-pizza` | bell-pepper: new first letter only; onion: new first letter only | (none)→A | (not observed in the sample) |  |
| `tandoori-paneer-pizza` | onion: new first letter only | (none)→A | -->A | tandoori-paneer-pizza + chicken-tikka-pizza materials only, onion last |
| `thai-chicken-pizza` | cilantro: new first letter only | (none)→A | -->A | thai-chicken-pizza + chicken-tikka-pizza materials only, cilantro last |
| `tonno-e-cipolla` | onion: new first letter only | (none)→A | -->A | tonno-e-cipolla + chicken-tikka-pizza materials only, onion last |
| `vegan-cashew-cheese-pizza` | bell-pepper: later by at most 1 | (none)→A..B; X→X+1 | -->B, A->B, B->C | pesto-vegetariana + chicken-tikka-pizza materials + cashew-cheese, bel |
| `veggie-supreme-pizza` | onion: new first letter only | (none)→A | -->A | veggie-supreme-pizza + chicken-tikka-pizza materials only, onion last |
| `wasabi-beef-pizza` | onion: later by at most 1 | (none)→A..B; X→X+1 | -->B, B->C | wasabi-beef-pizza + chicken-tikka-pizza materials only, onion last |

### 2-4. 必要食材・配置・工程
- 新素材: `chicken-tikka`（topping／meat／scatter、複合食材）。**食材が1つ増える**（138→139 の見込み。計画上は staged に枠あり）。専用の絵・色・サイズ・絵文字は未定（G18 の絵文字の重複に注意）。Shop の pack は k=2 で20の見込み（派生値）。
- 配置・工程: 標準、新しい機構は不要。Hint 5.0 の rung は CHEESE→STRUCTURE→SUB_CLASS ×4（NO_SAUCE の場合）。

### 2-5. claim／PR の重複
keema と同じ。T26 の着地後に直列。

## 3. 個別の Owner 決定表（回答は1行形式でも可）
| # | 決定 | 選択肢 | 備考 |
|---|---|---|---|
| T27-1 | keema のソース | A NO_SAUCE／B curry-ketchup 代用／C 新素材／D 保留 | B は K3 で rendang と同一になるため、素材構成とセットで決める |
| T27-2 | keema の素材構成 | K1 下書き（D-1 例外17件）／K2 beef 追加（重複4件）／別素材 `ground-beef`（食材が増える）／青唐辛子の扱い | `beef` の絵は薄切り |
| T27-3 | chicken-tikka のソース | A／B／C／D | 同上 |
| T27-4 | chicken-tikka の重複例外 | bbq-chicken-pizza・spanish-chorizo-pizza ほかの D-1 例外を認めるか | 案により件数が変わる |
| T27-5 | Research の ID 別承認 | keema 22 ID／chicken-tikka 28 ID を、各 ID の stage・方向・最大シフトで個別承認するか | 承認単位は preflight の表。**将来の letter 変更は未承認**（T26 の `hot-honey-pepperoni`→nashville の記録と同様に扱う） |
| T27-6 | ladderCredit の扱い | keema は新素材がなく key になれない（`LADDER_KEY_MATERIAL`）。credit なし（D-6）で進めるか | chicken-tikka は新素材の key |
| T27-7 | 着手の順序 | T26 着地後に T27（keema と chicken-tikka を同じ列車か別列車か） | 列車を分けても追加の承認は不要（上界は加法的） |

**採否の推奨は付けていません**（上の表は判断材料です）。Gate は緩めません。canonical に変化が出る組み合わせは STOP です。
