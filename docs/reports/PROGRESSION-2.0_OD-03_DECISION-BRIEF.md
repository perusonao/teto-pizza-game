# Progression 2.0 — OD-03 / R-02「⭐ゲート値」Decision Brief

- 作成日: 2026-09-23
- 監査対象 `origin/main`: **`66abe43a6b1057e7d2ab8fcc8c51c8e76b97b167`**（PR #202 merge commit）
- Branch: `claude/teto-progression-od-03-brief-aysb9w`（docs-only）
- 親 Issue: #182（Progression 2.0）。前提: PR #196（Phase 3-4 authority、OD-01/OD-02 APPROVED）、PR #204（Phase 3-4 Pre-Implementation Audit、OPEN）
- 成果物:
  - 本レポート
  - `docs/reports/data/PROGRESSION-2.0_OD-03_Option-Comparison.json`（machine-readable な比較表。生成物）
  - `docs/reports/data/PROGRESSION-2.0_OD-03_option_model.py`（上記 JSON の生成・検証スクリプト。読み取り専用。`--check` で drift を検出）

> **このレポートは OD-03 を決定しない。Option に順位も付けない。推奨もしない。**
> 数値・価格・recipe/ingredient 定義・save schema は一切変更していない。`src/**`、`e2e/**`、
> `.github/**` は変更していない。PR #204/#205/#206、Issue #207 とその branch（PR #208）には触れていない。
> Option C の「上限値」は効果の大きさを示すための**例示値**であり、提案値ではない。

---

## 0. GitHub 実状態（作業開始時に確認）

| 項目 | 状態 |
|---|---|
| `origin/main` | `66abe43` Merge pull request #202（Lunch Rush を発見済みレシピに限定） |
| PR #202 | **MERGED**（2026-09-23） |
| Issue #200 | completed（PR #202 で解消） |
| PR #203 | MERGED（Issue #201 A1/A2、WebKit Gate） |
| PR #204 | **OPEN・未マージ**（Phase 3-4 Pre-Implementation Audit、docs-only）。本 brief の主な照合元 |
| PR #205 | **OPEN・未マージ**（Phase 3-4A: headless progression rule layer、未配線） |
| PR #206 | **OPEN・未マージ**（Phase 3-4B: save forward-compat） |
| PR #208 / Issue #207 | 別セッションで CI 高速化監査中。**触れていない** |

本 brief は PR #204/#205 の内容を `git show` で**読んだだけ**で、どちらの branch にも push していない。

---

## 1. 事実のまとめ（判断材料。推奨ではない）

| 項目 | 値 | 出典 |
|---|---:|---|
| Production recipe 数 | **15** | `src/data/recipes.ts` |
| Production ingredient 数 | **22**（うち無制限 starter 3: basil / mozzarella / tomato-sauce） | `src/data/ingredients.ts` |
| 15 recipe が使う ingredient 数 | 22（全 22 件を使う） | 同上 |
| Authority target recipe 数 | **101** | `docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json` |
| Authority ingredient / 全 node 数 | 105 / 128 | 同上 |
| ⭐ルール | 発見済み recipe ごとに `max(BEST, 2)` の合計 | PR #205 `src/logic/progressionStars.ts`（未マージ） |
| 15 recipe を全部 ★5 にした場合の理論上限 | **75⭐** | 15 × 5 |
| Authority 値のまま（Option A）の実際の上限 | **65⭐** | ★5 でも 13 件で止まる（13 × 5） |
| 保証最低（★1–2、2⭐/発見）で 15 件全部発見した場合 | 30⭐ | 15 × 2 |

**「約65⭐」の正体:** 65⭐ は 15 recipe の上限ではなく、「authority の gate をそのまま使った場合に、
全発見を ★5 にしても genovese（cherry-tomato ⭐76）と quattro-formaggi（gorgonzola/fontina ⭐102）に
届かず、13 件で止まる」ことによる**上限**。gate を変えて 15 件全部に届くなら、上限は 75⭐ になる。

### 1.1 Authority gate の式（検証済み）

Authority のすべての `CUMULATIVE_STARS` gate（125 node）は、次の式で**完全に再現できる**（不一致 0 件）:

```
gate(step) = 2 × ceil(0.6 × 「その Phase-2 step より前の step で到達可能になる target の数」)
```

- 式の入力は「target の総数と順序」。authority は 101 件の母集団を前提にしている
- **帰結:** 同じ式を 15 件の母集団に当てはめたものが Option B。101 件になると Option B は authority と一致する（§7）

### 1.2 現行 15 recipe の authority 上の位置

| recipe | authority seq | 必要 ingredient（authority gate） | recipe の実効 gate |
|---|---:|---|---:|
| margherita | 3 | 初期所持のみ | 0 |
| bismarck | 4 | egg ⭐2 | 2 |
| breakfast-pizza | 5 | egg ⭐2, bacon ⭐2 | 2 |
| pepperoni | 7 | pepperoni ⭐6 | 6 |
| salsiccia | 8 | sausage ⭐6 | 6 |
| meat-lovers | 9 | bacon ⭐2, ham ⭐6, pepperoni ⭐6, sausage ⭐6 | 6 |
| funghi | 11 | mushroom ⭐10 | 10 |
| capricciosa | 12 | mushroom ⭐10, oregano ⭐10, ham ⭐6, black-olive ⭐10 | 10 |
| fugazza | 14 | olive-oil ⭐14, onion ⭐2, oregano ⭐10 | 14 |
| tonno-e-cipolla | 19 | onion ⭐2, tuna ⭐18 | 18 |
| **marinara** | 24 | garlic **⭐28**, oregano ⭐10 | **28** |
| **napoletana** | 32 | anchovy **⭐40**, oregano ⭐10 | **40** |
| **pizza-bianca** | 39 | olive-oil ⭐14, rosemary **⭐48** | **48** |
| **genovese** | 64 | pesto ⭐18, cherry-tomato **⭐76** | **76** |
| **quattro-formaggi** | 92 | olive-oil ⭐14, parmigiano **⭐28**, fontina **⭐102**, gorgonzola **⭐102** | **102** |

PR #204 §4.2 の表と一致する（seq・gate・必要購入）。

---

## 2. 比較する Option の定義

| Option | 内容 | 変わる gate |
|---|---|---|
| **A** 承認済み値をそのまま維持 | authority の gate をそのまま使う。後半の recipe は content が増えるまで一時的に届かない | なし |
| **B** 現在の recipe 数で再計算 | §1.1 の式を、runtime にある recipe の母集団に当てはめて gate を出す。recipe を追加するたびに gate が変わる | 15 recipe が使う 19 件の購入 ingredient のうち、egg/bacon/onion 以外の 16 件 |
| **C** 基本は承認済み値、到達不能な gate だけ暫定 special-case | authority 値を基本にし、一部の ingredient の gate だけ暫定値で上書きする。**どこまで上書きするかで 2 通りに分かれる** | 下記 |
| └ **C1** hard lock だけを上書き | ★5 でも届かない gate だけ: cherry-tomato、fontina、gorgonzola（3 件） | 3 件 |
| └ **C2** 保証最低で届かない gate をすべて上書き | ★1–2 で届かない gate すべて: garlic、parmigiano、anchovy、rosemary、cherry-tomato、fontina、gorgonzola（7 件） | 7 件 |

**Option C の上書き値について:** 本 brief では効果を測るために、**例示として** Option B の値
（15 件の母集団に式を当てはめた値）を使った。実際の値（例: 固定値、⭐65 上限、B と同じ式）は
owner decision であり、本 brief では決めない。

**Option D について:** 検討したが**提案しない**。PR #204 §6 の「CONTENT_FIRST」（EP1/EP4 のまま
content を先に増やす）は、Phase 3-4 の loop 完成を大きく遅らせる。既存 3 案より明確に優れているとは
言えない。「B の値を save ごとに固定する（sticky）」案は B の migration 方針の 1 つとして §8 で扱う。

---

## 3. Gate 表（15 recipe が使う購入 ingredient 19 件）

| ingredient | authority seq | A（authority） | B（15 件で再計算） | B'（T1 の 3 件を足した 18 件） | C1 | C2 | 使う shipped recipe |
|---|---:|---:|---:|---:|---:|---:|---|
| egg | 4 | 2 | 2 | 2 | 2 | 2 | bismarck, breakfast |
| bacon | 5 | 2 | 2 | 2 | 2 | 2 | breakfast, meat-lovers |
| onion | 6 | 2 | 2 | 2 | 2 | 2 | fugazza, tonno |
| pepperoni | 7 | 6 | **4** | 6 | 6 | 6 | pepperoni, meat-lovers |
| sausage | 8 | 6 | **4** | 6 | 6 | 6 | salsiccia, meat-lovers |
| ham | 9 | 6 | **4** | 6 | 6 | 6 | capricciosa, meat-lovers |
| black-olive | 10 | 10 | **8** | 10 | 10 | 10 | capricciosa |
| mushroom | 11 | 10 | **8** | 10 | 10 | 10 | funghi, capricciosa |
| oregano | 12 | 10 | **8** | 10 | 10 | 10 | marinara, napoletana, fugazza, capricciosa |
| olive-oil | 14 | 14 | **10** | 14 | 14 | 14 | fugazza, bianca, 4formaggi |
| pesto | 18 | 18 | **12** | 16 | 18 | 18 | genovese |
| tuna | 19 | 18 | **12** | 16 | 18 | 18 | tonno |
| garlic | 24 | 28 | **12** | 16 | 28 | **12** | marinara |
| parmigiano | 25 | 28 | **12** | 16 | 28 | **12** | 4formaggi |
| anchovy | 32 | 40 | **14** | 18 | 40 | **14** | napoletana |
| rosemary | 39 | 48 | **16** | 18 | 48 | **16** | bianca |
| cherry-tomato | 64 | 76 | **16** | 20 | **16** | **16** | genovese |
| fontina | 91 | 102 | **18** | 22 | **18** | **18** | 4formaggi |
| gorgonzola | 92 | 102 | **18** | 22 | **18** | **18** | 4formaggi |

- 太字は authority と異なる値
- T1 = PR #204 §7 の 3-4G tranche（新しい ingredient 0 件で作れる PIZZA DB 3 件: aussie、portuguesa、brazilian-calabresa）
- 価格はどの Option でも authority のまま（60/100/140/180）。OD-03 は gate だけの問題
- **Gate の単調性（authority seq の順に gate が下がらないこと）:** A と B は保たれる。C1 は崩れる
  （rosemary 48 → cherry-tomato 16）。C2 も崩れる（tuna 18 → garlic 12）

---

## 4. 到達可能性（Pitz は無視。Margherita の周回でいつでも稼げるため）

各 Option と BEST の組み合わせで、発見できる recipe の数・最終⭐・**最初に止まる gate**:

| BEST（⭐/発見） | A | B | C1 | C2 |
|---|---|---|---|---|
| ★1（2⭐） | 10/15・20⭐・**garlic/parmigiano ⭐28** | 15/15・30⭐ | 11/15・22⭐・**garlic/parmigiano ⭐28** | 15/15・30⭐ |
| ★2（2⭐） | 10/15・20⭐・**garlic/parmigiano ⭐28** | 15/15・30⭐ | 11/15・22⭐・**garlic/parmigiano ⭐28** | 15/15・30⭐ |
| ★3（3⭐） | 11/15・33⭐・**anchovy ⭐40** | 15/15・45⭐ | 13/15・39⭐・**anchovy ⭐40**（1⭐不足） | 15/15・45⭐ |
| ★4（4⭐） | 13/15・52⭐・**cherry-tomato ⭐76** | 15/15・60⭐ | 15/15・60⭐ | 15/15・60⭐ |
| ★5（5⭐） | 13/15・65⭐・**cherry-tomato ⭐76** | 15/15・75⭐ | 15/15・75⭐ | 15/15・75⭐ |

届かない recipe:

| Option | ★1–2 | ★3 | ★4–5 |
|---|---|---|---|
| A | marinara, napoletana, pizza-bianca, genovese, quattro-formaggi | napoletana, pizza-bianca, genovese, quattro-formaggi | genovese, quattro-formaggi（**hard lock**） |
| B | なし | なし | なし |
| C1 | marinara, napoletana, pizza-bianca, quattro-formaggi | napoletana, pizza-bianca | なし |
| C2 | なし | なし | なし |

### 4.1 Lock の種類

- **SKILL_LOCK**: 既存 recipe の BEST を上げれば届く。例: A の ★2 プレイヤーは 20⭐ で止まるが、発見済み 10 件の
  BEST を上げれば最大 50⭐ まで伸ばせるので、garlic ⭐28、anchovy ⭐40、rosemary ⭐48 には届く
- **HARD_LOCK**: BEST をどれだけ上げても届かない。A の genovese（⭐76）と quattro-formaggi（⭐102）がこれに当たる。
  上限の 65⭐ を超えているため、**content（recipe）が増えるまで全プレイヤーが発見できない**

### 4.2 Option A で後半の shipped recipe に届くために必要な発見数

| recipe | gate | 必要な発見数（2⭐/発見） | 必要な発見数（5⭐/発見） | 現行 15 件で届くか（2⭐ / 5⭐） |
|---|---:|---:|---:|---|
| marinara | 28 | 14 | 6 | ✗ / ✓ |
| napoletana | 40 | 20 | 8 | ✗ / ✓ |
| pizza-bianca | 48 | 24 | 10 | ✗ / ✓ |
| genovese | 76 | 38 | 16 | ✗ / ✗ |
| quattro-formaggi | 102 | 51 | 21 | ✗ / ✗ |

genovese を ★5 のプレイヤーが発見するには、runtime に発見可能な recipe が 16 件以上必要。
★1–2 のプレイヤーなら 38 件以上必要（PR #204 §6 と一致）。

---

## 5. Margherita から始めた Progression 例

### 5.1 シミュレーションの前提

- 0⭐・0 Pitz から始める。最初に Margherita を焼く。以後は authority の seq 順に、次の recipe に必要な ingredient を買って発見する
- Pitz は承認済みの報酬表（OD-02）を使う: 1 回あたり ★1=20、★2=50、★3=80、★4=100、★5=120 Pitz。初回発見のときだけ +50
- Pitz が足りないときは Margherita を焼いて稼ぐ（grind）。価格はどの Option でも authority の値
- 各 recipe の BEST は初回に焼いたときの★で固定し、焼き直して BEST を上げることはしない（上げる場合は §4 の上の行を見る）
- 省略したもの: 在庫の消費（購入 1 回で 10 回分。発見には 1 回分しか使わない）、CT2 の手際ボーナス、Lunch Rush の収入

### 5.2 Option A（authority 値をそのまま使う）

**★3（standard）:**

```
0⭐  Margherita 発見 ─────────────────── 3⭐  (+130 Pitz)
     egg 購入(⭐2,60) → Bismarck ─────── 6⭐
     bacon(⭐2) → Breakfast ─────────── 9⭐
     pepperoni(⭐6) → Pepperoni ──────── 12⭐   ← 10⭐ 到達
     sausage(⭐6) → Salsiccia ───────── 15⭐
     ham(⭐6) → Meat Lovers ────────── 18⭐
     mushroom(⭐10) → Funghi ────────── 21⭐
     black-olive+oregano(⭐10) → Capricciosa ─ 24⭐
     onion(⭐2)+olive-oil(⭐14) → Fugazza ─ 27⭐
     tuna(⭐18) → Tonno e Cipolla ───── 30⭐   ← 28⭐ 到達
     garlic(⭐28,100) → Marinara ────── 33⭐
     ■ STOP: anchovy ⭐40 まであと 7⭐（Napoletana）
       残り: napoletana, pizza-bianca, genovese, quattro-formaggi
       次の行動: 既存 recipe の BEST を上げる（★4–5 にすれば 40/48 には届く）
       genovese（⭐76）、quattro-formaggi（⭐102）: 行動では解消しない（content 待ち）
```

**★1–2（low-score / beginner）:** Tonno e Cipolla（20⭐）で止まる。次の gate は **garlic/parmigiano ⭐28**
（あと 8⭐）。★1 のプレイヤーは Pitz が足りず、Margherita を 2 回余分に焼く（計 12 bake）。

**★5（perfect）:**

```
Margherita 5 → Bismarck 10 → Breakfast 15 → Pepperoni 20 → Salsiccia 25 → Meat Lovers 30
→ Funghi 35 → Capricciosa 40 → Fugazza 45 → Tonno 50 → Marinara 55 → Napoletana 60
→ Pizza Bianca 65⭐
■ STOP: cherry-tomato ⭐76 まであと 11⭐。これ以上⭐を増やす方法はない（全件 ★5 で上限）
```

### 5.3 Option B（15 件の母集団で再計算）

**★2（beginner）:**

```
Margherita 2 → egg(⭐2) Bismarck 4 → bacon(⭐2) Breakfast 6 → pepperoni(⭐4) Pepperoni 8
→ sausage(⭐4) Salsiccia 10 → ham(⭐4) Meat Lovers 12 → mushroom(⭐8) Funghi 14
→ black-olive+oregano(⭐8) Capricciosa 16 → onion+olive-oil(⭐10) Fugazza 18
→ tuna(⭐12) Tonno 20 → garlic(⭐12) Marinara 22 → anchovy(⭐14) Napoletana 24
→ rosemary(⭐16) Pizza Bianca 26 → pesto+cherry-tomato(⭐16) Genovese 28⭐
→ parmigiano+fontina(Margherita を 3 回余分に焼く)+gorgonzola(⭐18) Quattro Formaggi 30⭐
■ 15/15 COMPLETE。計 18 bake
```

- ★1: 15/15 COMPLETE。ただし Pitz が足りず、Margherita を 28 回余分に焼く（計 43 bake）。進行を止めるのは⭐ではなく Pitz
- ★3: 45⭐ で COMPLETE（15 bake）。★5: 75⭐ で COMPLETE
- 40⭐、48⭐、65⭐ は「全件発見したあとで BEST を上げるための目標」になる。どの gate も 18⭐ 以下なので、それより上の⭐は gate に使われない

### 5.4 Option C1（hard lock の 3 件だけ上書き）

**★2:**

```
… Tonno 20⭐ → pesto(⭐18)+cherry-tomato(⭐16*) Genovese 22⭐
■ STOP: garlic/parmigiano ⭐28 まであと 6⭐
  残り: marinara, napoletana, pizza-bianca, quattro-formaggi
```

- **順序の逆転:** 後半（seq 64）の Genovese が、前半（seq 24）の Marinara より先に発見される
- ★3: Marinara 33 → Genovese 36 → Quattro Formaggi 39⭐ で止まる（anchovy ⭐40 まで **あと 1⭐**。Napoletana と Pizza Bianca が残る）
- ★4–5: 15/15 COMPLETE

### 5.5 Option C2（保証最低で届かない 7 件を上書き）

★1–5 のどれでも 15/15 COMPLETE。発見の順番と bake 数は B と同じ（★2 で 18 bake、★1 で 43 bake）。
違いは、seq 18 以前の ingredient（pepperoni、mushroom、olive-oil、pesto、tuna など）の gate が authority のままであること。

### 5.6 ⭐マイルストーン到達表（どの発見で到達するか。✗ = 到達しない）

| Option / BEST | 10⭐ | 28⭐ | 40⭐ | 48⭐ | 65⭐ | 76⭐ | 102⭐ |
|---|---|---|---|---|---|---|---|
| A ★2 | Salsiccia | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| A ★3 | Pepperoni | Tonno | ✗ | ✗ | ✗ | ✗ | ✗ |
| A ★5 | Bismarck | Meat Lovers | Capricciosa | Tonno | Pizza Bianca | ✗ | ✗ |
| B ★2 | Salsiccia | Genovese | ✗ | ✗ | ✗ | ✗ | ✗ |
| B ★3 | Pepperoni | Tonno | Genovese | ✗ | ✗ | ✗ | ✗ |
| B ★5 | Bismarck | Meat Lovers | Capricciosa | Tonno | Pizza Bianca | ✗ | ✗ |
| C1 ★2 | Salsiccia | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| C1 ★3 | Pepperoni | Tonno | ✗ | ✗ | ✗ | ✗ | ✗ |
| C1 ★5 | Bismarck | Meat Lovers | Capricciosa | Tonno | Pizza Bianca | ✗ | ✗ |
| C2 ★2 | Salsiccia | Genovese | ✗ | ✗ | ✗ | ✗ | ✗ |
| C2 ★3 | Pepperoni | Tonno | Genovese | ✗ | ✗ | ✗ | ✗ |
| C2 ★5 | Bismarck | Meat Lovers | Capricciosa | Tonno | Pizza Bianca | ✗ | ✗ |

**読み方:** ⭐の到達そのものは、どの Option でも BEST と発見数だけで決まるので似た形になる。違うのは、
**その⭐で何が開くか**。A では 28⭐/40⭐/48⭐/76⭐/102⭐ が ingredient の gate なので、到達しないと進めない。
B と C2 では最大の gate が 18⭐ なので、28⭐ 以上は「進行の条件」ではなく「BEST を上げた結果」になる。
76⭐ と 102⭐ には、15 件ではどの Option でも到達しない（上限 75⭐）。

---

## 6. 12 項目の比較

| # | 観点 | A: authority 値のまま | B: 15 件で再計算 | C: 一部だけ暫定上書き（C1 / C2） |
|---|---|---|---|---|
| 1 | 現在の 15 件でどこまで届くか | ★1–2: 10/15（20⭐）。★3: 11/15。★4–5: 13/15（最大 65⭐） | 全 BEST で 15/15（30〜75⭐） | C1: ★1–2 11/15、★3 13/15、★4–5 15/15。C2: 全 BEST で 15/15 |
| 2 | Deadlock | **あり**。genovese と quattro-formaggi は content が増えるまで全員 hard lock。後半 3 件は ★≤3 で skill lock（BEST を上げれば解消） | なし（式の性質上、2⭐/発見で必ず次に届く） | C1: hard lock はない。★≤3 の skill lock は残る。C2: なし |
| 3 | 新規プレイヤーの体験 | 序盤（seq 1–19）は承認済みの設計どおり。★≤2 は 10 件目で止まり、BEST 上げが必要。genovese/quattro-formaggi は見えるのに作れない | 15 件全部に届く。序盤の gate は authority より低い（pepperoni 6→4 など）ので展開が速い。★1 は Pitz 待ちが長い（Margherita を 28 回余分に焼く） | C1: Genovese が Marinara より先に開くなど、順序が逆転する。C2: B とほぼ同じ体験で、序盤の gate は authority のまま |
| 4 | 既存 save への影響（cutover 時） | 既存 save は EP4 で ingredient を所有しているので、genovese/quattro-formaggi を作れる。新規プレイヤーは作れない（**cohort 間の非対称**）。⭐は `max(BEST,2) ≥ BEST` なので再ロックはない | 再ロックなし。非対称なし | 再ロックなし。非対称なし（C1 は skill lock 分だけ残る） |
| 5 | recipe 追加時の migration 負担 | gate が変わらないので save migration は**不要**。届く範囲が単調に広がる。「届かない recipe」の期待値リスト（テスト fixture）を tranche ごとに縮める | **tranche ごとに全 gate を再生成する**。gate が上がると、未購入の AVAILABLE_TO_BUY が LOCKED に戻る（例: 15→18 件で anchovy 14→18、cherry-tomato 16→20、fontina/gorgonzola 18→22）。これを許すか、save ごとに固定するかの方針が必要 | 上書きを 1 件ずつ見直し、解除条件を満たしたら authority 値に戻す。戻すときは B と同じ再ロックの問題がある（例: cherry-tomato 16→76） |
| 6 | 101 件完成時の整合性 | authority と完全に一致する。PR #196 の simulation（101/101、全 profile で COMPLETE）がそのまま成り立つ | authority の順序で content を足していけば、101 件で式が authority と**完全に一致**する（§1.1 の検証）。順序や母集団がずれると一致しない | 上書きをすべて解除すれば authority と一致する。解除し忘れると恒久的にずれる |
| 7 | 実装の複雑度 | 最も低い。PR #205 の `progressionUnlocks.ts` は authority 値をそのまま持っている。ただし 3-4E の end-of-content 表示（「今は作れない」の説明）が**必須**になる | 中〜高。runtime か build 時に母集団から gate を出す仕組み、または content の version ごとの gate 表が要る。authority との parity テストとは別に、もう 1 つ表を持つことになる | 低〜中。authority 表の上に小さな上書き表（3 件か 7 件）と、それぞれの解除条件を持つ |
| 8 | テストの複雑度 | authority との parity（PR #205 に既にある）と、「届かない recipe の集合」の固定。tranche ごとにその集合を更新する | 式の parity、母集団のサイズごとの snapshot、再ロックのテスト、tranche ごとの snapshot 更新 | authority の parity、上書き表の固定、解除条件のテスト、順序逆転（C1）の許容テスト |
| 9 | 一時ルール・負債の量 | **ルールの負債は 0**。content の負債（届かない 2 件と end-of-content UI）がある | ルール自体は恒久的な仕組み（content に連動）。負債というより、仕様そのものが変わる | 明示的な暫定ルールが 3 件（C1）か 7 件（C2）。解除 trigger の管理が要る |
| 10 | 将来 threshold を変える必要 | ない | tranche ごとに毎回変わる（101 件で authority に収束） | 上書きを解除するときに、該当 ingredient の gate が上がる |
| 11 | プレイヤーへの説明しやすさ | 「⭐N で入荷」は変わらない。ただし、⭐をどれだけ集めても届かない gate（76/102）について「今後のアップデートで追加」という説明が要る | 1 つの version の中では一貫している。update のあとで「前は⭐14 だったのに⭐18 になった」が起きる | ほとんどは一貫している。C1 の順序逆転（Genovese が先）は説明しにくい |
| 12 | 「次に何をすればいいか」の明確さ | 18⭐ までは明確。そのあと ★≤3 は「BEST を上げる」、★4–5 で 65⭐ に達すると「できることがない」 | 常に「次の ingredient を買う」か「Pitz を貯める」。15 件で完了したら「BEST を上げる」 | C1: A と同じく「BEST を上げる」段階があるが、hard lock の行き止まりはない。C2: B と同じ |

---

## 7. 各 Option で最初に到達不能になる具体的な gate

| Option | ★1–2 | ★3 | ★4 | ★5 |
|---|---|---|---|---|
| A | **garlic ⭐28 / parmigiano ⭐28**（20⭐ で止まる。Marinara / Quattro Formaggi） | **anchovy ⭐40**（33⭐。Napoletana） | **cherry-tomato ⭐76**（52⭐。Genovese） | **cherry-tomato ⭐76**（65⭐。Genovese）→ fontina/gorgonzola ⭐102 |
| B | なし | なし | なし | なし |
| C1 | **garlic ⭐28 / parmigiano ⭐28**（22⭐） | **anchovy ⭐40**（39⭐。あと 1⭐） | なし | なし |
| C2 | なし | なし | なし | なし |

「到達不能」は BEST を固定した場合の話。A と C1 の ★1–3 は、BEST を上げれば届く（skill lock）。
A の ★4–5 で止まる cherry-tomato ⭐76 と fontina/gorgonzola ⭐102 は、BEST を上げても届かない（hard lock）。

---

## 8. Migration リスク

| リスク | A | B | C1 / C2 |
|---|---|---|---|
| Cutover 時（3-4C）に既存 save が再ロックされる | なし（`max(BEST,2) ≥ BEST`。OWNED は永続） | なし | なし |
| 既存 save と新規プレイヤーの非対称 | **あり**（既存 save は EP4 で cherry-tomato/gorgonzola/fontina を所有しているので Genovese/Quattro Formaggi を作れる。新規プレイヤーは作れない） | なし | なし |
| content 追加時に gate が上がる（未購入の ingredient が LOCKED に戻る） | なし | **tranche ごとにある**。回避するには「上がることを許す」「save ごとに固定（新しい persisted state が要る）」「価格で調整」などの追加方針が必要 | 上書きを解除するときにある（C1: 3 件、C2: 7 件） |
| rollback（3-4C の revert） | EP1/EP4 に戻る。購入済みは OWNED のまま（PR #204 §7） | 同じ | 同じ |
| authority（PR #196 で承認済み）からの乖離 | なし | 19 件中 16 件の gate が変わる。**承認済みの値を変えることになる** | C1: 3 件、C2: 7 件の gate が変わる。**承認済みの値を部分的に変えることになる** |
| 実装済みコード（PR #205、未マージ）への影響 | なし（authority 値をそのまま持っている） | 母集団から gate を出す層が追加で要る | 上書き表が追加で要る |

---

## 9. 101 件完成時の状態

| Option | 101 件完成時 |
|---|---|
| A | authority そのもの。PR #196 の simulation（全 profile で 101/101 COMPLETE、最大 grind 382 bake は low-score）がそのまま成り立つ。hard lock は、genovese なら 16〜38 件、quattro-formaggi なら 21〜51 件（BEST による）の発見可能 content が揃った時点で解消する |
| B | content を authority の順序で追加していけば、101 件で**authority と完全に一致**する（§1.1 で全 125 gate を再現できることを確認した）。途中の version では gate が authority より低い。順序が変わったり、101 件以外の target が入ったりすると一致しない |
| C | 上書きをすべて解除すれば authority と一致する。解除条件（例: 「★5 で届くようになったら」か「★2 で届くようになったら」）によって、解除の時期が大きく変わる（cherry-tomato なら 16 件か 38 件） |

---

## 10. 選んだときのトレードオフ（推奨ではない）

- **A を選ぶと:** 承認済みの数値を守れて、ルールの負債も gate の変更も発生しない。その代わり、
  (1) 出荷済みの Genovese と Quattro Formaggi が、content が増えるまで新規プレイヤーには発見できなくなる、
  (2) ★≤2 のプレイヤーは 10 件目で止まり、BEST を上げないと進めない、
  (3) 既存 save と新規プレイヤーで作れる recipe が違う状態になる、
  (4) 3-4E の end-of-content 説明 UI が必須になる。
- **B を選ぶと:** 15 件すべてに、どの BEST でも届く。101 件で authority に収束する。その代わり、
  (1) 承認済みの gate 16 件を変えることになる（序盤のペースも速くなる）、
  (2) content を追加するたびに gate が上がり、未購入の ingredient が LOCKED に戻りうる。その扱いを別途決める必要がある、
  (3) gate を出す仕組みと、version ごとのテストが追加で要る。
- **C1 を選ぶと:** hard lock（上限 65⭐ を超える gate）だけを消して、残りは承認済みの値を守れる。その代わり、
  (1) ★≤3 の skill lock は残る、(2) Genovese が Marinara より先に開くなど、順序が逆転する、
  (3) 暫定ルール 3 件の解除条件と、解除時の再ロックを管理する必要がある。
- **C2 を選ぶと:** どの BEST でも 15 件に届き、seq 19 以前の gate は承認済みの値のまま。その代わり、
  (1) 暫定ルールが 7 件になる、(2) seq 順の gate の単調性が崩れる、
  (3) 解除するときの gate の上がり幅が大きい（例: anchovy 14→40、cherry-tomato 16→76）。

---

## 11. ユーザー（owner）に決めてほしい質問

1. **Hard lock を許容するか:** 出荷済みの Genovese と Quattro Formaggi を、content が増えるまで新規プレイヤーが発見できない状態（Option A）を許容しますか？
2. **Skill lock を許容するか:** ★1–2 のプレイヤーが 10/15 件（20⭐）で止まり、BEST を上げないと Marinara/Napoletana/Pizza Bianca に進めない状態（A と C1）を許容しますか？
3. **承認済みの値を変えてよいか:** PR #196 で承認した gate を変更する案（B は 16 件、C1 は 3 件、C2 は 7 件）を選ぶ場合、それは OD-01/OD-02 と同じ形の再承認として扱いますか？
4. **Gate が後から上がってよいか:** B か C を選ぶ場合、content 追加や上書きの解除で gate が上がり、未購入の ingredient が LOCKED に戻ることを許容しますか？ 許容しない場合、save ごとに固定する（新しい persisted state が要る）などの方針を選びますか？
5. **Cohort の非対称:** A の場合、既存 save（Genovese/Quattro Formaggi の ingredient を所有済み）と新規プレイヤーの差を許容しますか？
6. **C の詳細（C を選ぶ場合のみ）:** 上書きするのは C1（3 件）と C2（7 件）のどちらですか？ 上書き値はどう決めますか（B の式の値、固定値、⭐65 上限など）？ 解除条件は ★5 で届く時点と ★2 で届く時点のどちらですか？
7. **Content の順序:** 今後の recipe 追加は authority の seq 順（T1 → …）で行いますか？ B が 101 件で authority に収束するための前提であり、A の hard lock が解消する時期にも関わります。
8. **3-4E の位置づけ:** A か C1 を選ぶ場合、「今は作れない」「今後追加予定」を説明する end-of-content UI を 3-4C と同時に必須にしますか？

---

## 12. 検証とスコープ

- `python3 docs/reports/data/PROGRESSION-2.0_OD-03_option_model.py --check` → `OK`（3 回実行して出力が同じであることを確認）
- スクリプトは `src/data/recipes.ts`、`src/data/ingredients.ts`、`src/data/discoveryCatalog.ts` を直接 parse する（15 recipe / 22 ingredient を assert）。authority JSON の 125 gate を式で再現できることも assert する
- PR #204 §4.2 の到達可能性の表（保証最低 10/15、★3 11/15、★4 13/15、★5 13/15）と、本 brief の Option A の結果は一致する
- 変更したファイル: 本レポート、`docs/reports/data/` 配下の 2 ファイルだけ（docs-only）
- UI/UX/gameplay は変更していないので、Human Verification policy の対象外
