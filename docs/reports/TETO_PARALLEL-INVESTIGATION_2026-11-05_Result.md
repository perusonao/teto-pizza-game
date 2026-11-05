# TETO 並行調査 2026-11-05 — 次期コンテンツ・食材描画・完成ピザの見た目（Result Report・調査専用）

**種類:** 調査専用。docs と画像だけを追加した。`src/`・CSS・ゲームロジック・テスト（spec）・既存 PR の HEAD は変更していない。merge・Production ON・共有 Preview の更新はしていない。
**ブランチ:** `claude/teto-pizza-investigation-8auzii`（base `main` `d85b957`）
**比較対象:** PR #759（Batch 18）HEAD `33bc275e9e3ed1491ed742375d89158495e1db98`。scratchpad の detached worktree から読み取りだけで撮影した。PR のブランチには commit も push もしていない。
**Claim:** 他セッションの claim がかかっているファイルは触っていない。該当する claim は #748（`ingredients.ts` ほか、〜11-18）、#733（`IngredientGlyph.tsx` / `beefDoneness.ts` ほか、〜11-08）、#758（`App.css` ほか、〜11-08）。本ブランチで追加したのは `docs/reports/` 配下の新規ファイルだけで、hot file との重なりはない。docs だけの調査なので、Issue に claim コメントは投稿していない。

## 0. 結論（先に要点）

| タスク | 結論 |
|---|---|
| 1 次期コンテンツ | 次期 Batch の候補を 5 案に絞った。推奨は **案A「ブラータ＋後乗せ」**。新しい素材は 1 種で、本番で動いている FINISH エンジンをそのまま使える。Jaccard はどちらのレシピも 0.33 で、全体基準の 0.4 を下回る。2 番目は **案B「ハチミツ（DRIZZLE #579 の最初の適用先）」**。蒸す・炒める・揚げるの案は、どれも工程が本番 OFF のままか、Owner 例外が要る。 |
| 2 食材描画 | 牛肉・ピーマン・大葉を除く 78 種を、トレイ／焼成前／焼成後（仕上げ）／RESULT の 4 状態、390×844 と 360×800 の 2 サイズで撮影・計測した。重要度 1 位は **同じ絵または酷似した絵**（ローズマリー🌱＝アーティチョーク🌱、オレガノ🍃＝ほうれん草🍃、無地の白い円盤チーズ 3 種、黄色い円盤チーズ 3 種）。2 位は **焼成後に白い食材が溶けたモッツァレラに溶け込むこと**。3 位は **トマトソースの上の赤い食材**（グレースケールでの明度差 ΔL が 2〜5）。360×800 に固有の問題は見つからなかった。 |
| 3 完成ピザ | 既存 10 レシピと B18 の 2 レシピとも、**具材が生地面積の 5.5〜8.8% しか覆わず、まばら**に見える（具材は 2〜8 個、1 個あたり直径の約 11%）。B18 については、**レイナ・ペピアーダでマヨネーズが白いソースの上でほぼ見えない**こと（RESULT での見える面積は 60px²）と、**バインガン・バルタが同じカレーケチャップ系の rendang / curry と見分けにくい**こと（オレンジの地＋たまねぎ ΔE20）を確認した。改善案は表示だけの変更で済むが、**サイズの変更は CUT の footprint（採点）に波及する**ので、別の Gate が必要。 |

## 1. 確認した最新状態

- `main` `d85b957`（#651）。open PR 39 件を確認した。うち今回の範囲に関係するものは #759（B18、Draft・HV 待ち）、#760（#733 牛肉・ピーマン）、#761（#758 大葉 1.35em）、#753（Style Lock V2 §12 eggplant）、#751（Fry の見た目の追補）、#746（DRIZZLE Lab）、#738/#756/#757/#762/#763（Steam）、#620（POST_BAKE / MULTI_SAUCE / ZONED の監査）、#612（原典監査）、#540（グランマ HOLD）、#478（配置の統一）、#468（モッツァレラ溶け Pilot）。
- Owner 決定の記録（再質問しない）: bulgogi / yakiniku は HOLD（2026-10-28）。caponata / tsukimi / pesto-genovese / jerusalem-mixed-grill は HOLD・候補止まり（B15〜B17 の Result）。Jaccard の全体基準 0.4 は不変で、例外は B15 / B16 / B18 だけの個別承認。B18 の OD-B18-1〜4。`#514` RESULT の具材縮尺 0.75。`#479` サイズクラスの倍率は候補 B（xs 0.7〜xl 1.3）。
- 原典（pizzadb.jp）は従来どおり到達できない。以下の具材構成は `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行、Phase 0B の中継データ）だけを根拠にしている。**個数・ソースの読み替え・焼成窓はすべて GAMEPLAY ASSUMPTION（原典の事実ではない）として扱う。**

## 2. タスク 1 — 次期コンテンツ拡張（B18 と重ならない候補）

### 2.1 方法
172 行のマトリクスから、出荷済みの 88 レシピと B18 の 2 レシピを除いた 97 行を抽出した。そのうち、新しい調理工程（後乗せ／FINISH〔本番 ON〕、DRIZZLE #579〔Lab のみ〕、蒸す #726/#755〔本番 OFF〕、炒める #696〔本番 OFF、対象は beef だけ〕、揚げる #749〔F1 のロジックのみ・未配線、対象は eggplant だけ〕、炙る #724〔本番 ON 待ち #727〕）と組み合わせられる行を優先した。全レシピ（B18 を含む 90 件）に対して、Jaccard（材料 ID の集合）と、部分集合・上位集合の関係を計算した。

### 2.2 次期 Batch 候補（5 案、推奨順）

| 案 | レシピ（matrix 行） | 新しい素材 | 調理工程 | 最大 Jaccard（最も近いレシピ） | 材料の重複 | 解禁（案） | Research への影響 | 主なリスク・Owner 判断 |
|---|---|---|---|---|---|---|---|---|
| **A（推奨）ブラータ＋後乗せ** | `pesto-burrata`（pesto・burrata・fresh-tomato・olive-oil）＋`pizza-alla-crudaiola`（olive-oil・mozzarella・burrata・fresh-tomato・arugula）。どちらも matrix で READY | burrata（cheese）1 種 | 後乗せ（FINISH、本番 ON）。burrata を POST_BAKE で置く。crudaiola は fresh-tomato と arugula も POST_BAKE（「生のせ」）。DRIZZLE が入ればオリーブオイルの仕上げにも使える | 0.33（pesto-trapanese / pollo / gamberi）／0.33（chilean-napolitana）。crudaiola をトマトソース＋油と読むと 0.43（pinsa / jamon-serrano / grandma）になり超過する | pesto は既存 9 レシピ、arugula は 4 レシピ（pinsa は POST_BAKE）、fresh-tomato は多数 | 通常 ladder の step 70（B18 の名目 69 の次）。2 レシピとも credited、あるいは片方を非 credit | burrata の新 cohort が 2 件（A/B）。正準順では既存の文字は変わらない見込み。非正準順では B15〜B18 と同様の変化が起こり得るので、取得順の全数監査（`researchLabelAudit`）が必要 | ① crudaiola のソースを「オリーブオイルのみ」とするか（Owner の暫定判断が必要。トマト込みなら 0.4 超）。② **FINISH トレイが cheese カテゴリを POST_BAKE で扱えるか未確認**（既存の POST_BAKE 9 素材はすべて topping）。③ burrata の白い絵が白い面に溶け込む問題（§3 の P2）。後乗せなら溶けたモッツァレラの上に乗らず、焼成も受けないので相性はよい |
| **B ハチミツ（DRIZZLE）** | `pesto-noci`（pesto・gorgonzola・walnut・honey、READY）＋`nashville-hot-chicken`（mozzarella・chicken・pickles・honey） | honey・walnut の 2 種 | DRIZZLE（#579。Lab #746 のみで、FINISH の液体対応は未実装）。それまでの暫定案は honey を POST_BAKE の dab として置くこと | 0.17 ／ 0.33（ソースなし、またはトマトの場合） | gorgonzola（2）、pickles（1）、chicken（多数） | step 70 = honey（nashville）、step 71 = walnut（noci）。walnut を先にすると、その step で解禁されるレシピがなくなる | honey の cohort は 1 件で文字なし、walnut も 1 件。正準順での変化は 0 の見込み | DRIZZLE の本実装に依存する。nashville のソース欄「ホットソース」の読み替えが要る（NO_SAUCE は suya 限定の例外なので、一般則にはしない）。素材が 2 種で、Shop・図鑑・アイコンの作業量が増える |
| **C 蒸す** | `frutti-di-mare`（tomato-sauce・clam・mussel・shrimp・squid） | squid 1 種 | 蒸す（あさり・ムール貝。#738 は本番 OFF、#755 は Pilot） | **0.50（pescatore）** | clam・mussel・shrimp はすべて pescatore と共通 | Steam の本番 ON の後 | squid の単独 cohort。ラベルは `？？？ピザ（イカ）` | **Jaccard の Owner 例外が必須**（前例は 0.43 / 0.60）。B12 では「命名クラスタで識別が難しい」として除外されていた。蒸すことを識別軸にするかどうかは設計判断が要る |
| **D 炒める＋後乗せ** | `pizza-de-lomo-saltado`（beef・onion・fresh-tomato を炒める、mozzarella、french-fries を後乗せ） | french-fries 1 種 | 炒める（#696 の beef の仕組みを流用）と後乗せの 2 工程。matrix に PREP_STEP と LATE_ADDITION の根拠がある | 0.44（veggie-supreme、トマト読み）。醤油と読むと 0.57（wasabi-beef） | beef の cohort（rendang / suya / goulash / wasabi-beef）は混み合っている | Prep の本番 ON の後 | beef の cohort には入らない（french-fries が最後の素材）。単独 cohort | Jaccard の例外が必須。Prep は本番 OFF。代替案は `kimchi-pizza`（pork・kimchi・green-onion・mozzarella。gochujang を新しく足せば 0.33、ただし素材が 2 種になり、Prep の対象を pork / kimchi へ広げる必要がある） |
| **E 既存素材のみ・和風の後乗せ** | `teriyaki-chicken`（甘辛だれ→soy-sauce と読む、chicken・onion・mayo と nori を後乗せ。matrix にチーズの記載なし） | 0 | 後乗せ（本番 ON） | 0.29（curry-pizza-japan） | mayo は B18 の reina と potato-mayo、nori は tarako | nori の step 68 の cohort に入る | **新しい素材がないので既存の cohort に入る**。tarako-cream の「文字なし→A/B」の変化を許可リストへ載せる必要がある（OD-544-6） | 甘辛だれを醤油ソースと読むこと（暫定）。mayo を後乗せで絞る操作（trail）が FINISH で使えるかは未確認 |

**揚げる（Fry #749）について:** 172 行の中で eggplant を使う未出荷のレシピは caponata（HOLD）しかない。Fry を新しいレシピに結び付けるには、caponata の HOLD 解除が前提になる。もう一つの道は、既存の eggplant レシピ（melanzane / parmigiana / norma など 8 件）に「揚げナス」という技法の差分を作ることだが、これは pinsa の前例と同じく技法 identity の設計判断になる。どちらも Owner 判断事項として §6 に記載した。

**除外した候補（根拠つき）:** bulgogi / yakiniku（Owner HOLD）。hot-honey-pepperoni と nduja（トマト読み）は pepperoni / salsiccia の上位集合。boerewors（0.60）。philly-cheesesteak（suya と完全に同じ集合）。thai-chicken（0.50 bbq-chicken）。chicken-tikka（0.50 baingan B18）。mentaiko-mochi（明太子＝cod-roe と読むと 0.57 tarako）。truffle（油と読むと 0.50 quattro-formaggi。クリームと読めば 0.29 で、将来の候補）。

## 3. タスク 2 — 食材描画（牛肉・ピーマン・大葉以外）

### 3.1 方法
- Free Cooking で、全食材を所持したセーブを使った。生地 → トマトソース（2 重リング）→ モッツァレラ 4 個 → 6 食材を 2 個ずつ置き、1 個目は外周 r=30%、2 個目はチーズ寄りの内周 r=13% に置いた → 焼成（62〜72） → 仕上げ画面（完成の前の、焼き上がった等倍のピザ）→ RESULT（0.75 倍）。13 グループ × 2 viewport を Chromium で撮影した（deviceScaleFactor 2）。トレイは全ページを撮った。
- 各ピースの DOM の箱から、周囲 3px のリングの中央値を背景色とし、箱の中で ΔE76 が 12 を超える画素を「見える画素」とした。この画素から、見える面積（CSS px²）・平均 ΔE・明度差 ΔL（グレースケールでの見えやすさ）を出した（`docs/reports/data/TETO_PARALLEL-INVESTIGATION-20261105_*`）。**この指標は近くのピースと配置に左右される。白いチーズの焼成後の値（2〜3px²）は、背景が溶けたチーズになって指標が崩れた結果であり、目視（下の一覧画像）で補正している。**
- 生地: 390 は 290px、360 は 273.6px。RESULT はどちらも 196px。ピースの px サイズは両 viewport で同じなので、**360×800 では生地に対する比率が約 6% 大きいだけで、固有の欠陥は見つからなかった**（指標の差は 3% 未満）。

### 3.2 改善候補（重要度順）

| 重要度 | 問題 | 該当（測定値は 390、RESULT） | 改善案（すべて描画のみ） |
|---|---|---|---|
| **P1 同じ絵・酷似した絵（識別に影響）** | 絵だけでは区別できない。図鑑・Reference・RESULT で誤認を招く | **ローズマリー🌱 とアーティチョーク🌱 が同じ絵**。**オレガノ🍃 とほうれん草🍃 が同じ絵**（ソースの柚子胡椒も🍃）。**白い円盤**: ヤギのチーズ / パニール / カトゥピリ（色差 ΔE 2.4〜6.5）、カシューチーズも近い（6.9〜9.1）。**黄色い円盤**: グラナ・パダーノ / スイスチーズ（ΔE 2.6）、パルミジャーノとの差も小さい。ミント🍀 とパセリ☘️ も酷似 | 専用 SVG にする（ローズマリーは針葉の枝、アーティチョークは断面 1/4、ほうれん草は縮れた濃緑の葉、オレガノは小葉の房）。チーズは形と模様で区別する（パニールは角切り、カトゥピリは渦巻き、ヤギは皮つきの輪切り、スイスは穴、グラナは削り片）。#417 Icons 2.0 の枠で扱う |
| **P2 焼成後に白い食材が消える** | 溶けたモッツァレラ（白い大きな塊）の上で、白い食材が背景に溶け込む | ヤギのチーズ / パニール / カトゥピリ / スイス / リコッタ（RESULT ΔE 26・ΔL 4）/ クリームチーズ（ΔE 23・ΔL 6）/ パルミジャーノ（ΔE 25・ΔL 3）。**マヨネーズ**（見える面積 76px²。白いソースの上では 60px²、§4）。白ごま（102px²） | 白い食材にだけ、薄い暖色の輪郭線か接地影を付ける（マヨネーズの dab と同じ方式）。モッツァレラ以外のチーズは、焼成でモッツァレラと同化させず、縁に焼き色を付ける |
| **P3 赤の上の赤（グレースケールで消える）** | トマトソースとの明度差が小さい | ペパロニ（焼成前 ΔE 31・**ΔL 3**）、サラミ（ΔL 2〜5）、チェリートマト（ΔL 3）、たらこ（ΔE 20・ΔL 3）、いくら（ΔL 2）、パプリカパウダー（ΔE 23）、ザクロ（ΔE 31）、エビ（RESULT ΔE 24・ΔL 4）。カレーケチャップの上のたまねぎ（ΔE 20・ΔL 2〜3、rendang / curry / tandoori / B18 の baingan） | 暗い縁取りを付ける（ペパロニは縁を濃くして脂の斑点を加える、サラミは脂の斑点、魚卵は濃い輪郭線）。たまねぎは輪の線を濃くする |
| **P4 小さすぎる（xs × RESULT 0.75 = 0.525 倍）** | RESULT で約 16〜18px | 白ごま、ケッパー、青ねぎ、パクチー、オレガノ、ローズマリー、パプリカパウダー、グラナ（16px） | RESULT での最小描画サイズ（例 20px）を設ける。**CUT の footprint にも効くので §5 の Gate が必要** |
| **P5 意味の誤読（絵文字の代用）** | 見えるが、食材として読めない | 生ハム🍥（なると）、塩ダラ🐡（フグ）、イワシ🎏（こいのぼり）、パルミット🌴、ザワークラウト🥫、ハラペーニョ🟩、サラミ🟤、松の実🌰（栗）、アーモンド🥜（落花生）、豚肉🐖・ラム🐑（動物そのもの）、ツナ🐠、ハム🍖、チキン🍗、ズッキーニ🥒（きゅうり） | #417 の段階移行の優先順位に入れる。P1 と P3 に重なる食材から先に進める |

**問題が小さい（現状維持でよい）:** ブラックオリーブ、マッシュルーム、ナス、トマト（スライス）、パイナップル、コーン、アボカド、ムール貝、しらす、いくら（RESULT）、のり（RESULT ΔL 45）、わさび。

## 4. タスク 3 — 完成ピザの見た目（既存 10 レシピ ＋ B18 の 2 レシピ）

撮影: 各レシピの構成（POST_BAKE を除く）を、外周 60%・内周 40% の 2 重リングに置いて焼成した。同じ配置則で全レシピを撮っている。数値は 390×844、`docs/reports/data/TETO_PARALLEL-INVESTIGATION-20261105_finished-pizza-metrics.json`。

| レシピ | 具材数 | 1 個の大きさ（生地に対する比） | 被覆率（焼成前） | RESULT 1 個 | RESULT 被覆 |
|---|---:|---|---:|---|---:|
| margherita | 2 | 48.6px（16.8%） | 5.5% | 36.5px（18.6%） | 6.7% |
| pepperoni | 4 | 34.9px（12.0%） | 5.6% | 26.2px（13.4%） | 6.8% |
| capricciosa | 6 | 31.4px（10.8%） | 7.0% | 23.6px | 8.5% |
| meat-lovers | 6 | 36.4px（12.5%） | 8.8% | 27.1px | 10.7% |
| veggie-supreme | 6 | 32.7px（11.3%） | 6.9% | 24.3px | 8.4% |
| pesto-vegetariana | 6 | 34.6px（11.9%） | 7.9% | 25.8px | 9.5% |
| moussaka-style | 6 | 32.9px（11.4%） | 7.3% | 24.5px | 8.8% |
| rendang | 6 | 31.8px（11.0%） | 6.5% | 23.7px | 7.9% |
| curry-pizza-japan | 6 | 32.3px（11.1%） | 7.3% | 24.2px | 8.9% |
| **baingan-bharta（B18）** | 6 | 30.2px（10.4%） | **6.1%** | 22.6px | 7.4% |
| **reina-pepiada（B18）** | 6 | 31.2px（10.7%） | 6.6% | 23.2px | 8.0% |

所見:
1. **配置密度が低い。** 具材は 2〜8 個で、生地面積の 5.5〜8.8% しか覆わない。モッツァレラ 2〜3 個は、焼成前は小さな白い粒だが、焼成後は大きな不定形の塊になる。完成品は「赤い面に点が散っている」印象になる。B18 の 2 レシピはこの範囲の下限にある。
2. **大きさ** はクラス倍率（B）と RESULT の 0.75 によって既に調整済みで、生地に対する比は 10〜14% で概ね揃っている。xs（パクチーなど）だけが 18px と小さい。
3. **チーズとの重なり。** 具材はチーズの溶けた塊より前面に描かれるので、隠れることはない（この配置では具材の約 22% がチーズの箱と重なった）。問題は重なりではなく、白い食材の同化（§3 の P2）。
4. **B18 固有の所見:**
   - **reina-pepiada**: フロマージュブランソース（白）＋溶けたモッツァレラ（白）＋マヨネーズ（白い dab）で、**マヨネーズが最も見えない**（焼成前 98px²・ΔE 28 → RESULT 60px²・ΔE 24）。アボカドとチキンははっきり見える。パクチーは 18px。
   - **baingan-bharta**: カレーケチャップ（オレンジ）の上の**たまねぎが ΔE 20・ΔL 3**で、トマトの RESULT は ΔL 1。オレンジの地・たまねぎの輪・白い塊という見た目が **rendang / curry-pizza-japan とほぼ同じ構図**になり、ナス（ΔE 64〜74）だけが識別点になっている。

### 4.1 改善案と影響範囲（保存・採点・ゲームロジック）

| 案 | 内容 | 保存 | 採点・判定 | ゲームロジック・テスト | 主な hot file |
|---|---|---|---|---|---|
| ① 白い食材の輪郭線・接地影（P2） | マヨネーズ、白いチーズ、白ごまに薄い暖色の縁を付ける | 影響なし（`pieceVisual` は保存されない） | 影響なし | IngredientGlyph のテストと見た目の golden を更新 | `IngredientGlyph.tsx`（#733 claim 〜11-08） |
| ② 赤い食材の縁取り（P3） | ペパロニ、サラミ、魚卵、たまねぎの線を濃くする | なし | なし | 同上 | 同上。ペパロニとサラミは現在絵文字・CSS 円なので、新しい SVG を作るなら `ingredients.ts`（B18 claim 〜11-18）の `pieceVisual` 追加が要る |
| ③ 見た目の量感（クラスタ表示） | 1 ピースを 2〜3 片の房として描く（たまねぎの輪 ×2、パクチー ×3 など）。**配置数・座標は変えない** | なし | **footprint 半径を変えなければ影響なし** | CUT のピースの複製、Reference や図鑑の表示、Layout の golden | `PizzaStage.tsx`（#738 open PR）・`App.css`（HOT） |
| ④ RESULT の最小サイズ（P4） | xs の RESULT 倍率に下限を設ける | なし | **影響あり**: `toppingFootprintRadiusPercent` が描画倍率を使うので、CUT の到達判定（S3）が変わり得る。描画だけ変えるなら footprint を分離する必要がある | `resultScalePreview` と S3 の footprint テスト | `PizzaStage.tsx`・`resultScalePreview.ts` |
| ⑤ 同じ絵の解消（P1） | 専用 SVG と `pieceVisual` の追加 | なし（ID は不変） | なし | アイコンの識別テスト（#733 と同じ方式） | `ingredients.ts`（B18 claim）・`IngredientGlyph.tsx`（#733 claim） |

**レシピの構成（個数）を増やして密度を上げることは採点・Reference・発見条件を変える**ので、今回の改善候補には入れていない。

## 5. 実装の優先度と並行作業の計画

| 優先 | 作業 | 依存・待ち | 並行可否 |
|---|---|---|---|
| 1 | **P1 同じ絵の解消**: ローズマリー、アーティチョーク、ほうれん草、オレガノの専用 SVG（Icons 2.0 の次スライス） | `IngredientGlyph.tsx` は #760 の merge、または #733 claim の期限（11-08）の後。`pieceVisual` の追加は `ingredients.ts` を変えるので、#759 の merge 後に rebase する | 候補 SVG の作成と比較の証跡（docs と design candidates）は**今すぐ並行できる** |
| 2 | **P2 / P3 の輪郭線と縁取り**（白い食材、赤い食材、たまねぎ）。B18 の reina のマヨネーズと baingan のたまねぎを含む | 同上。#759 の HV で Owner がマヨネーズの見え方を確認できれば、その結果を入力にする | 比較画像の作成は並行できる |
| 3 | **案A ブラータ＋後乗せ（Batch 19 候補）** の設計・影響調査 | #759（B18）の merge 後（`ingredients.ts` と `recipes.ts` が HOT）。FINISH で cheese を POST_BAKE で扱えるかを先に確認する | **読み取りだけの事前検証（FINISH の cheese 対応、Jaccard、取得順の監査）は今すぐ並行できる** |
| 4 | 白いチーズの円盤の区別（P1 の後半）、P5 の絵文字代用の置き換え | 1 の後 | 1 と同じレーン |
| 5 | 完成ピザの量感 ③ と最小サイズ ④ | `PizzaStage.tsx`（#738）と CUT footprint の Gate | 別の Owner 判断が要る |
| 6 | 案B ハチミツ（DRIZZLE） | #579 / #746 の FINISH 液体対応 | DRIZZLE の進み具合しだい |
| 7 | 案C 蒸す、案D 炒める、Fry（caponata） | 各工程の本番 ON、Jaccard の例外、HOLD の解除 | 保留 |

**並行レーン（ファイルが重ならない）:** レーン 1 は Icons（1・2・4、`IngredientGlyph.tsx` のみ、#760 の後）。レーン 2 は Content（3、data 系、#759 の後）。レーン 3 は見た目の Gate（5、`PizzaStage.tsx`、#738 の後）。今すぐ始められるのは、各レーンの docs と候補画像の作業だけ。

## 6. Owner 判断が必要な事項（まとめて提示・推奨つき）

1. **次期 Batch は案A（ブラータ＋後乗せ）で事前検証へ進めてよいか**。推奨は Yes。crudaiola のソースは「オリーブオイルのみ」を暫定案とする。トマト込みなら Jaccard 0.43 で、例外が要る。
2. **P1（同じ絵 4 組）を Icons 2.0 の次スライスにするか**。推奨は Yes。#760 の merge 後に着手する。
3. **B18（#759）の HV でマヨネーズ（reina）とたまねぎ（baingan）の見え方を確認項目に加えるか**。推奨は Yes。#759 自体の変更は求めない。
4. 揚げる工程の扱い（caponata の HOLD 解除か、既存の eggplant レシピの技法差分か）。推奨は Fry F2 / F3 の承認後に別途判断すること。

## 7. Human Verification

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `teto-visibility-main-390x844.mp4`（main。トレイの全ページ → グループ 9〔フェタ・イワシ・リコッタ・ホットドッグ・アボカド・ヤギのチーズ〕→ グループ 12〔ポルチーニ・ムール貝・リコッタサラータ・マヨネーズ・シナモン・いくら〕を、具材 → 焼成 → 仕上げ → RESULT まで） | 390×844 | 44.9 s | 0.86 MB | PASS |
| `teto-b18-finished-pizza-390x844.mp4`（PR #759 HEAD `33bc275` の読み取り専用 worktree。baingan-bharta と reina-pepiada を、生地 → ソース → チーズ → 具材 → 焼成 → RESULT〔レシピ発見〕まで） | 390×844 | 97.5 s | 1.51 MB | PASS |

Download: セッション内で直接提出した（repository には commit していない。`artifacts/review/` は gitignore 済み）。codec は H.264（yuv420p、25fps）。ffprobe で解像度・時間・サイズを確認し、抽出フレームで内容を確認した。
Video Verification: PASS

この動画で確認すること: 焼成後に白いチーズが溶けたモッツァレラに同化する様子（グループ 9）。マヨネーズ・白ごま・いくらの大きさ（グループ 12）。reina でマヨネーズが白い面に紛れること、baingan のたまねぎがオレンジの地で弱く見えること。

**注意:** すべて Chromium の自動撮影であり、**iPhone Safari での実機 HV ではない**。

### スクリーンショット（`docs/reports/screenshots/parallel-investigation-20261105/`）
- `visibility-sheet-{1,2,3}-{390x844,360x800}.jpg`: 78 食材 × トレイ／焼成前／焼成後／RESULT の一覧（改善前）。
- `visibility-g{01,02,09,10,12,13}-*` と `visibility-tray-*`: 元の画面（P1〜P4 の代表）。
- `finished-pizza-compare-{390x844,360x800}.jpg`: 12 レシピの焼成前／焼成後／RESULT の比較（改善前）。
- `finished-{main,b18}-*`: レシピ別の元の画面。
- 本調査は改善前の記録だけなので、after の画像はない。

## 8. 再現
`docs/reports/data/TETO_PARALLEL-INVESTIGATION-20261105_capture.spec.ts.txt`（e2e/ に `.spec.ts` として置き、`CAP_DIR=<出力先>` で実行する。`CAP_MODE=recipes CAP_RECIPES=<id,...>` で完成ピザを撮る）と、`..._analyze.py.txt`（計測）。spec は repo のテストとしては追加していない。

## 9. ステータス
- **完了:** タスク 1〜3 の調査・撮影・計測・Result Report・画像の commit・動画の提出。
- **未完了:** iPhone Safari での実機確認（Owner の HV）。案A の FINISH cheese 対応の実コード検証（読み取りのみで可能、次の行動）。
- **ブロッカー:** 実装に進むには #760（IngredientGlyph）、#759（ingredients / recipes）、#738（PizzaStage）の merge 順の決定と、§6 の Owner 判断が必要。
- **次の行動:** §6 の判断を受けて、レーン 1（P1 の候補 SVG 比較）とレーン 2（案A の事前検証）を別ブランチで並行して始める。
