# 10 レシピ単位のバッチ拡張計画（B10）— わさびビーフを含む案と、個別実装との工数差（docs-only）

Status: **計画と比較表のみ。runtime は実装していない**（`src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更）。実装・PR 作成・merge・Monitor 作成・Issue/PR へのコメント・claim 投稿はしていない。
基準 `main` = `08cd46d`（食材 75）。**#679（BBQ、別セッション担当）は open で、本計画は #679 の merge 後に着手する前提**。
姉妹資料: `TETO_WASABI-BEEF_FINAL-DESIGN-GATE_2026-10-27.md`、`TETO_BURRATA_FINISH-CHEESE_DESIGN-ISSUE_2026-10-27.md`。
**本書の B10 の構成は「提案」で、Owner の決定ではない。各レシピの原典（pizzadb.jp）は未確認で、本セッションは到達していない。matrix の記述を原典の事実として断定しない。すべて GAMEPLAY ASSUMPTION として扱う。**
**「推定」と書いた数値は、測定値からの類推であり測定値ではない。**

## 0. Owner 決定（2026-10-27）と範囲

10 レシピ単位のバッチ拡張計画に、わさびビーフの実装を統合する。ブッラータは別資料（FINISH のチーズ対応）。ホットハニーと #579 DRIZZLE は HOLD。バッチの対象は **172 品 matrix の未出荷行のうち、新しい機構を要さないもの**（`FULL` か `LATE_ADDITION` のみ）に限った。機構を要する行（`MULTI_SPREAD_LAYER`・`DOUGH_VARIANT`・`ENCLOSE`・`PAN_BAKE` 等）は含めない。

## 1. 構造上の制約（コードで確認したこと）

`src/data/lateCatalog.ts` の `validateLateCatalog` ほかを読んで確認した（本セッションは実装・実行はしていない）:

| # | 制約 | 帰結 |
|---|---|---|
| C1 | **late recipe は `POST_BAKE` の要件を必ず 1 つ持つ** | 焼成後に足すものが無い行は late に入れられない |
| C2 | **credited の late recipe は、late ladder step の key をちょうど 1 つ務める**（key のない late recipe は到達不能、key が重なるのも不可） | 1 つの late recipe は 1 つの late step を必要とする |
| C3 | **`ladderCredit: false` の late recipe は late 専用の材料を使えない**（`lateCatalog.ts` の検査） | 新材料を持たない late recipe は、既存の late 専用材料（白ごま等）を使えない |
| C4 | late 専用の材料は通常カタログに存在しない（OFF のカタログから消える） | **通常レシピは late 専用の材料を使えない**（通常レシピ側の検査は本セッションでは未確認。設計上の推論） |
| C5 | 通常 ladder は追記専用。通常 step が増えると late step の導出番号が +1 ずれる（互換下限 `LATE_ENTITLEMENT_FLOORS` が既存セーブを守る） | 通常と late を同時に増やすなら、floor を「出荷時の導出値」で足す（既存規則） |
| C6 | **既に late 専用の材料**: `salmon-roe`・`yuzu-kosho`・`miso-sauce`・`white-sesame`・`tahini`・`pomegranate`（main）、`bbq-sauce`・`cilantro`（#679 が merge された場合） | これらを使う行は late recipe にしかできない |

**C4 と C6 から出る重要な帰結:** 材料を「どちらの ladder に置くか」が、その材料を使える行の集合を決める。beef を late 専用にすると、beef を使う他の 8 行は通常レシピとして出せない（Final Design Gate §3 の注）。**白ごまを使う行（bulgogi・yakiniku）は late recipe にするしかなく、その場合は白ごまを `POST_BAKE` とする（U2 ナス田楽と同じ GAMEPLAY ASSUMPTION）必要がある。香菜を使う行（baingan-bharta・chicken-tikka）も同様で、本計画からは外す**（baingan は #679 の cilantro が late 専用になるため通常レシピにできず、`POST_BAKE` の記録もない）。

## 2. B10 の構成案（提案）

選定規則: 未出荷・機構不要・C1〜C6 を満たす・新材料の再利用が効く・同一性が既存レシピと衝突しない。**READY 5 + Owner の基底ソース決定を要する 5**。

| # | レシピ（id） | track | 状態（matrix） | 新材料 | 必要な Owner 決定 | 証跡の出所（matrix） |
|---|---|---|---|---|---|---|
| 1 | currywurst | 通常 | READY | curry-ketchup、paprika-powder、wurstel | なし | 比較表の標本のみ |
| 2 | cuban-pizza | 通常 | READY | mustard、pickles、swiss-cheese | なし | 比較表の標本のみ |
| 3 | goulash-pizza | 通常（**beef の導入役**） | BLOCKED（基底ソース `その他`） | beef、sour-cream（paprika-powder は #1 から） | D-B2 | 比較表の標本のみ |
| 4 | nigerian-suya-pizza | 通常 | BLOCKED（基底ソース `その他`） | なし（beef は #3 から） | D-B2 | 比較表の標本のみ |
| 5 | rendang-pizza | 通常 | BLOCKED（基底ソース `カレー`） | なし | D-B3 | 比較表の標本のみ |
| 6 | curry-pizza-japan | 通常 | BLOCKED（`カレーソース` の未解決） | なし | D-B3 | 比較表の標本のみ |
| 7 | bulgogi-pizza | late | BLOCKED（基底ソース `甘辛だれ`） | soy-sauce | D-B1、白ごま = `POST_BAKE`（U2 と同じ暫定） | 比較表の標本のみ |
| 8 | yakiniku-pizza | late | READY（`PREP_STEP` を未モデル化） | yakiniku-sauce | 炒め工程を未モデル化とする暫定（U2 のナスの前例）、白ごま = `POST_BAKE` | **個別ページ** |
| 9 | **wasabi-beef-pizza** | late | READY | wasabi（soy-sauce は #7 から、beef は #3 から） | 姉妹資料 §13 の D-W1〜D-W7 | **個別ページ** |
| 10 | mentaiko-cream-pizza | late | READY（`LATE_ADDITION`） | cod-roe、nori、fresh-cream-sauce（※ 出荷済みの `fromage-blanc-sauce` で代替できれば −1。D-B5） | D-B5 | 比較表の標本のみ（後乗せの強さは `source_profile_text`） |

**除外した主な行と理由:** philly-cheesesteak（基底の `チーズ` を mozzarella と読むと、nigerian-suya と材料集合が同一になり**衝突**。本セッションの観察）、baingan-bharta・chicken-tikka（cilantro が late 専用、§1）、peking-duck（新材料 3 で再利用先なし。READY_WITH_REVIEW）、meat-lovers（出荷済みレシピと構成が食い違う `COMPOSITION_CONFLICT_SHIPPED`）、hot-honey / burrata 系（HOLD・別資料）、tsukimi（HOLD）。

**注意（近接した集合）:** #3〜#9 は beef・mozzarella・onion を共有し、1 材料の差で並ぶ（例: rendang ⊂ bulgogi ⊂ yakiniku、rendang と suya は green-pepper の差のみ、bulgogi と wasabi-beef は白ごま↔わさびの差のみ）。識別は基底ソースの違い（`identityDimensions` に `baseSauce`）で保たれる見込みだが、**Research のコホートと Hint 5.0 / DH4 の privacy sweep に負荷がかかる**。実装前に集合衝突の機械検査と DH4 の実測が要る（本セッションは未実行）。

### 2.1 ladder の形（提案）

| 種別 | step（材料 → key recipe） | credited |
|---|---|---|
| 通常 | `[curry-ketchup, paprika-powder, wurstel]` → currywurst | ○ |
| 通常 | `[mustard, pickles, swiss-cheese]` → cuban-pizza | ○ |
| 通常 | `[beef, sour-cream]` → goulash-pizza | ○ |
| 通常 | key なし: nigerian-suya、rendang、curry-pizza-japan | **×（`ladderCredit: false`）**。新材料を持たないため step の key になれない（8a の chilean-napolitana・spanish-chorizo と同じ型） |
| late | `[soy-sauce]` → bulgogi-pizza | ○ |
| late | `[yakiniku-sauce]` → yakiniku-pizza | ○ |
| late | `[wasabi]` → wasabi-beef-pizza | ○（cohort の鍵 = wasabi） |
| late | `[fresh-cream-sauce, nori, cod-roe]` → mentaiko-cream-pizza | ○（cohort の鍵 = cod-roe） |

- **依存（重要）:** 通常レシピで beef を導入できるのは、基底ソースの Owner 決定（D-B2）を待つ行だけ（goulash・suya・rendang。**READY の通常 beef レシピは無い**）。したがって **beef を使う late 3 件（bulgogi・yakiniku・wasabi-beef）は D-B2 が決まるまで B の形では出せない**。決定が遅れる場合の退避は 2 つ: (i) 通常 READY の 2 件（currywurst・cuban）と mentaiko-cream だけを先に出す（案 D）、(ii) beef を late 専用として wasabi-beef を単独で出す（案 S。ただし beef の再利用を失う、§1 C4）。
- credited +7 / step +7 で、`ACCEPTED_MIN_SLACK`（= 1）の余裕は保たれる見込み（各 credited レシピが自前の step を持つため。**実装時に `ladderReachability.starGate` で確認**）。
- 通常 step が 3 つ増えるため、late step の導出番号は +3 ずれる。新しい late 材料の floor は「出荷時の導出値」（既存規則）。
- soy-sauce を bulgogi の step に置き、wasabi-beef の step は wasabi だけにすることで、**late step の材料数を 1〜3 に収め、解禁のコストを step ごとに 120〜360 Pitz に分散**する（T4: 材料ごとに 120 / 60 Pitz）。

## 3. 新食材数と再利用率

| 指標 | 個別（各レシピを単独で出す） | B10 |
|---|---|---|
| 新材料の延べ数 | 23（currywurst 3、cuban 3、goulash 3、suya 1、rendang 2、curry-japan 1、bulgogi 2、yakiniku 2、wasabi-beef 3、mentaiko-cream 3） | **14 種**（curry-ketchup、paprika-powder、wurstel、mustard、pickles、swiss-cheese、beef、sour-cream、soy-sauce、yakiniku-sauce、wasabi、cod-roe、nori、fresh-cream-sauce） |
| 1 レシピあたり | 2.3 | **1.4** |
| 削減 | — | **約 39%**（9 件）。D-B5 で `fromage-blanc-sauce` を使えば 13 種 |
| 最も効く材料 | — | **beef（6 レシピ: goulash・suya・rendang・bulgogi・yakiniku・wasabi-beef）**、curry-ketchup（3: currywurst・rendang・curry-japan）、soy-sauce（2: bulgogi・wasabi-beef）、paprika-powder（2: currywurst・goulash） |

集計は matrix の canonical id による機械的な計算（既存 = 現行の `ingredients.ts` + `lateCatalog.ts` + #679 の 2 材料）。rendang・curry-japan の基底ソースを curry-ketchup とする前提（D-B3）。「個別 23」は**各レシピを他と無関係に単独で見たときの新材料数**で、「個別で順に出せば再利用できる」という意味ではない。個別に出す順序によっては、**late 専用にした材料（beef を wasabi-beef で先に出す場合など）が後続の通常レシピから使えなくなる**（§1 C4）ため、個別実装は再利用の面でも不利になりうる。

## 4. バッチの形と工数差

### 4.1 測定値（直近の late catalog 単独 PR、GitHub 統計と `git show --numstat`）

| PR | files | 追加 / 削除 | 内訳（行） | open → merge |
|---|---|---|---|---|
| #662 U1 | 44 | +1019 / −81 | データ・描画 約140、新規テスト 241、他の pin 更新 約150、golden 205、e2e 188、docs 95、スクショ 9 枚 | 約 1.4 時間 |
| #669 U2 | 54 | +1149 / −100 | データ・描画 約180、新規テスト 265、他の pin 更新 約180、golden 205、e2e 199、docs 123、スクショ 18 枚 | 約 10 時間 |
| #673 U3 | 50 | +996 / −88 | データ・描画 約130、新規テスト 263、他の pin 更新 約85、golden 202、e2e 195、docs 113、スクショ 15 枚 | 約 7 時間 |

**読み取り:** ゲームの中身（データ・描画）は全体の 1〜2 割で、残りは**新規テスト・e2e・golden・Result がレシピごとに複製される分**と、**他のテストの件数 pin 更新（約 20 files、毎回ほぼ同じファイル）**。open → merge は Owner の実機 HV 待ちが支配的。

### 4.2 比較（**推定**。上の測定値からの類推。レシピ 10 件、credited 7 / 非 credited 3）

| 案 | PR 数 | files（distinct） | 差分行（推定） | Owner HV の回数 | CI / WebKit の回数 | merge 順・hot file の競合 |
|---|---|---|---|---|---|---|
| **S: 個別 ×10** | 10 | 約 470 のファイル更新（約 20 の pin ファイルを 10 回触る） | 約 10,000 | 10 | 10（WebKit の間欠失敗 #394 / #680 / #681 に 10 回当たる） | 10 本が `lateCatalog.ts`・`ingredients.ts`・`App.css`・golden を順に奪い合う。毎回、後の PR が追従 |
| **B: 1 PR** | 1 | 約 70〜90 | 約 4,500〜5,500（うち golden の自動生成 JSON 約 1,400） | 1（ただし 10 レシピ分の確認） | 1 | なし。ただし**差分が大きく、失敗の切り分けが難しい**。1 本でも HV が通らないと全体が止まる |
| **C: 2 PR（通常 6 → late 4）、推奨** | 2 | 約 50〜70 + 約 40〜60 | 約 5,000〜6,000 | 2 | 2 | 通常 → late の順（beef は通常、late は beef を使うため。C4）。2 本の間で floor・golden を追従 |
| **D: 3 PR（通常 READY 2 → 通常 決定待ち 4 → late 4）** | 3 | 各 40〜60 | 約 5,500〜6,500 | 3 | 3 | 決定が揃うのを待たずに READY 2 件を先に出せる。fixed 費が 3 回 |

**推定の根拠と限界:** 1 レシピあたりの「複製される分」は新規テスト約 260 + e2e 約 195 + Result 約 110 + golden 約 200 ≒ 約 770 行。バッチでは table 駆動のテスト（約 80/レシピ）・共通 e2e（約 70/レシピ）・Result 1 本に圧縮できる前提で計算した。**この圧縮は未実証で、前提どおりにならない場合は B・C の差分行は増える。**
**差の主因は行数ではなく、Owner の HV・CI・merge の回数**（S の 10 回対 B/C/D の 1〜3 回）。U1〜U3 の open → merge は 1.4〜10 時間で、**S は直列になるため約 14〜100 時間**（推定）。

### 4.3 バッチ固有のリスク

- **merge = 即公開**（late catalog も通常カタログも本番）。10 件が一度に公開される。**公開ゲートは新設しない**のが現在の運用（#662 の PR 本文）。バッチ用のゲートを置くかは Owner 判断（D-B6）。置かない場合、HV で 1 件でも不合格なら、そのレシピを外して出す手順が要る（late 側は `lateCatalog.ts` から外せる）。
- **DH4 の件数 pin の原因分解**（U1〜U3 は「材料だけ / レシピだけ / 両方」を分解して原因を確認した。OD-B9-15）が、14 材料では組み合わせが多い。**コミットを材料ごとに分け、各コミットで gate を回す**（bisect 可能にする）。privacy assertion と hardened guard は緩和しない。
- **Research コホート**: beef の step を共有するレシピが増えるため、コホート文字（A/B/…）の割り当てが動く。Owner 確認済みの規則は「既存の文字は動かさない」（Q7）で、本バッチでの検査項目。
- **近接した集合**（§2）の Anti-Oracle 検査。
- HV の運用（#443 が open）。10 レシピの実機確認は重い。**自動テストと動画が正式な HV 証跡になるかは Owner の方針待ち**で、本計画はそれを前提にしない。

## 5. 実装前に決める基底ソースの扱い（提案）

| ID | 論点 | 選択肢 | 助言 |
|---|---|---|---|
| D-B1 | `甘辛だれ` の行（bulgogi・eel・teriyaki・boerewors）の基底ソース id | (a) soy-sauce を共通の和風下地にする / (b) 出荷済みの miso-sauce / (c) 新規 | (a)。醤油系の行が多く、soy-sauce が wasabi-beef と共有される。miso-sauce は dengaku 用で、bulgogi・うなぎに合わせると原典から離れる |
| D-B2 | `その他` の行（goulash・suya）の基底 | (a) NO_SAUCE（ソースなし）/ (b) 既存ソース / (c) 新規 | (a) を第一候補。ただし `deductionProduction.gate` の NO_SAUCE 許可リスト・Hint の BASE 段・OD-DH4-2-9 への影響を実測してから |
| D-B3 | `カレー` の行（rendang・curry-pizza-japan・keema ほか）の基底 | (a) currywurst の `curry-ketchup` を共通のカレー下地にする / (b) 新規の curry-sauce | (a) は新材料が増えず 3 レシピに効く。ケチャップ系をカレー全般の下地にしてよいかは Owner 判断 |
| D-B4 | white-sesame を `POST_BAKE` とする（bulgogi・yakiniku が late recipe になる条件） | はい / いいえ（いいえなら 2 行を外す） | U2 と同じ暫定を延長する。原典未確認 |
| D-B5 | mentaiko-cream の白いソース | (a) 出荷済みの fromage-blanc-sauce / (b) 新規の fresh-cream-sauce | (a) で新材料 −1。原典との一致は未確認 |

## 6. Owner に決めてほしいこと

| ID | 質問 |
|---|---|
| DB-1 | B10 の構成（§2）を、バッチ計画の叩き台として承認するか。外す・差し替えたい行はあるか |
| DB-2 | バッチの形: S / B / **C（推奨）** / D のどれか |
| DB-3 | D-B1〜D-B5（基底ソース・白ごま・mentaiko の白いソース）の方針 |
| DB-4 | yakiniku の炒め工程（`PREP_STEP`）を未モデル化の暫定仕様として受け入れるか（U2 のナスの前例）。原典で炒め・漬け込みが確認されたら再分類（OD-B9-16） |
| DB-5 | 証跡が比較表の標本のみの行（10 行中 8）を、GAMEPLAY ASSUMPTION として実装準備に進めてよいか（OD-B9-17 の延長） |
| DB-6 | バッチ用の公開ゲートを置くか。置かない場合、HV 不合格の行を外す手順でよいか |
| DB-7 | 着手順: #679（BBQ）の merge 後、#578 U3 の claim（11/02）の扱い、#611 への claim 投稿の時期 |
| DB-8 | HV の運用（#443 が未決）。10 件の実機確認をどう分けるか |

## 7. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、データ、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、`docs/PROJECT_HANDOFF.md`、既存の決定記録、#679 のブランチ、Issue/PR へのコメント・クローズ。
