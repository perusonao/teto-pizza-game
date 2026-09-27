# Dinner Mission DM-4 / DM-5 — Fresh Audit（報酬・永続化・時間・品質バランス設計）

- **Audited main:** `5a33d85`（Merge PR #254: Discovery Hint 4.0 DH4-1）
- **Audited DM-3R-2 head:** PR #252 `claude/dm-3r-2-result-detection-ioac6d` @ `d11858a`（監査時は OPEN。その後 `51e0923` で MERGED）
- **Branch:** `claude/dinner-mission-dm4-dm5-audit-0dotex`（docs / data / tools のみ）
- **Machine-readable data:**
  - 実測: `docs/reports/data/TETO_DINNER-MISSION_DM4-DM5_measure.jsonl`（144 件）
  - model 出力: `docs/reports/data/TETO_DINNER-MISSION_DM4-DM5_balance-matrix.json`
- **Tools:** `tools/dinner-dm5/measure.play.ts`、`tools/dinner-dm5/playwright.measure.config.ts`、`tools/dinner-dm5/dm5_balance_model.py`
- **STOP 判定:** **A. READY FOR OWNER DECISIONS**（§12）

**この文書の範囲。** 設計と監査だけを行った。変更していないものは次のとおり。

- `src/`、`e2e/`、CSS、save schema
- PR #252（push、merge、comment のいずれもしていない）
- Hint / DH4
- production deploy

**production 値について。** この文書の数値はすべて **Owner Decision の選択肢**。production 値ではない。

> **Update（2026-09-27、Phase 4-0）:**
> - PR #252 は **MERGED**（`51e0923`、post-merge CI green）。§9 の B-1 は解消した。
> - Owner Decision は確定し、SSOT は `docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md` §3（親 Issue #257）。この文書 §8 の OD 番号は **旧番号** で、正式ではない。
> - 証拠は次の 3 つに区分する。混同しないこと。
>   - **AUTOMATED:** 144 / 144 の scripted run（§5、§6.1）
>   - **MODEL:** KLM / Fitts による人の操作時間の仮定（§6.2、§6.3、§7.1、§7.3 の per-minute）
>   - **HUMAN:** まだ無い
> - **§7.1 の T-1（DM-A 320 s / DM-B 355 s）は MODEL の値で、人では検証していない。** Owner はこれを Human Validation の baseline として採用した（OD-DM5-2）。最終値ではない。
> - tier の閾値は Human Timing の後に決める（OD-DM5-3）。§7.1 の GOLD / SILVER の列は、model 上の例示にすぎない。

---

## 1. Fresh state（2026-09-27 に fetch）

| 項目 | 状態 |
|---|---|
| `origin/main` | `5a33d85`。過去の SHA は前提にしていない。recipes / materialShop / discoveryLadder / economy / pitzReward / efficiency は `42feec7`（Phase 0 の監査対象）から変わっていない（`git log 42feec7..origin/main -- <files>` の結果が空）。したがって Phase 0 JSON の pack / refill の値は今も有効 |
| main の Dinner | DM-1（pure core）、DM-2（runtime）、DM-3R-0、DM-3R-1 が merge 済み。`dinnerReward.ts` には報酬の **shape だけ** がある。table は `dinner-phase1-untuned`（thresholds / pitz は `null`）。`DINNER_MISSIONS` の `timeLimit.seconds` は `null` |
| PR #252（DM-3R-2） | OPEN、head `d11858a`。次を追加している。<br>・recipe-free round、自動判定（6 category）、`quality.minimumStars: null` の slot<br>・DEV / Preview でだけ有効な `?dinnerDuration` / `?dinnerMinStars`（production では START できない）<br>・attempt log（session 限り）<br>この監査は PR #252 に一切触れていない |
| DM-4 / DM-5 の Issue / PR | **存在しない**（Duplicate Gate）。open Issue 27 件と open PR 19 件を確認した |
| 関連する open Issue | ・#234: Lunch Rush の FAILED が Dex を更新する。OD-DM-11 と連動<br>・#256: 焼成失敗が確定していても CUT に進む。全モードに関係<br>・#250 / #242、PR #243（旧 DM-3）<br>・#38: Economy<br>・#224: LR Ranking 2.0 |

### 1.1 継承する authority（変更しない）

Phase 0 §17 と DM-3 Redesign から、次を前提として引き継ぐ。

- **OD-DM-7:** 中断した run は保存しない。reload / HOME での中断は報酬なし。
- **OD-DM-9:** CLEAR ＋ 時間 tier（GOLD / SILVER / BRONZE）。数値は DM-5 で決める。
- **OD-DM-10:** tier は ★ とは別の概念。
- **OD-DM-11:** Dex への記録は保留。**FAILED path では Dex を絶対に変更しない。**
- **OD-DM-14:** 数値は実プレイ時間を計測してから決める。
- **OD-DM-15:** `dinnerMissionRecords` は DM-4 で扱う。
- **OD-DM-16:** 在庫の緊張の弱さは Phase 1 では受け入れる。
- **OD-DM-18:** FREE Pitz、CT2、ranking は Dinner に付けない。
- **OD-R2:** 合格は Completion PASS かつ ★ ≥ S。S は DM-5 で決める。
- **OD-R4:** 未発見 recipe は匿名の ORIGINAL にする。

コード側でも次のことを確認した。

- `quoteDinnerReward` は FAILED を常に 0 Pitz にする。
- `dinnerClearTier` の閾値は inclusive。
- `validateDinnerRewardTable` は gold ≤ silver ≤ bronze と、非負の整数であることを検査する。

---

## 2. DM-4 監査（報酬・永続化）

| # | 論点 | 現状（コード） | 監査結果 / 選択肢 |
|---|---|---|---|
| 1 | CLEAR 時の報酬 | quote（`quoteDinnerReward`）はあるが、払い出す経路がない | **CLEAR 遷移と同じ reducer step で精算する**（§3.2）。別の CLAIM action を作ると、二重付与を防ぐ guard が 1 つ増える |
| 2 | Pitz 報酬額 | table は `null` | §7.3 の RW-A / RW-B / RW-C（OD-DM4-1） |
| 3 | Gold / Silver / Bronze | 型と判定関数はある | 閾値は §7.1（OD-DM5-1）。`bronze = limit` にすると、すべての clear が BRONZE 以上になる（`dinnerReward.ts` のコメントどおり） |
| 4 | 初回 clear bonus | `firstClear` と `repeatClear` の 2 つの schedule がある | **必要**。FREE の 1 枚あたりの Pitz（≈ 83〜130）と比べると、Dinner は 4 枚作っても pizza ごとの Pitz が 0。そのため、初回 bonus がないと「やる理由」が弱い（§7.3） |
| 5 | repeat reward | schedule はある | RW-A: 0 / RW-B: 少額 / RW-C: FREE と同等（OD-DM4-1） |
| 6 | retry | 「もう一度」で新しい run になる（PR #252） | retry は新しい run。初回かどうかは records で決めるので、retry が初回報酬を再度受け取ることはない。回数の制限は不要（在庫が消費される） |
| 7 | FAILED / TIME_UP / ABANDON | quote は常に 0。reload / HOME は ABANDONED | **0 Pitz を維持する**（DM-1 と OD-DM-7 の authority）。記録する候補は `attempts` 回数だけ（OD-DM4-4）。Pitz の慰労金は **推奨しない**。わざと失敗して稼ぐ経路になりうるうえ、INFEASIBLE は在庫不足の結果なので |
| 8 | mission clear の永続化 | なし | `dinnerMissionRecords`（§3.1） |
| 9 | best time の永続化 | なし | `bestClearMs`（単調に減少） |
| 10 | best rank の永続化 | なし | `bestTier`（単調に改善）。`null` は「tier なしの CLEAR」 |
| 11 | save の forward-compat | `writeSave` は未知の top-level key を保持する（`extractForwardCompatExtras` の `topLevel`） | ・v2 のまま bump せず、`KNOWN_SAVE_KEYS` に追加する<br>・この build が知らない mission id は forward-compat の id pattern で保持する<br>・古い build が新しい build の記録を消さないことを e2e で固定する（`save-forward-compat-3-4b.spec.ts` と同じ方式） |
| 12 | Dinner と Dex の境界 | Dinner は Dex を読むだけ（unlock のため）。書き込み（REGISTER_TO_DEX）は拒否している | OD-DM-11 は保留のまま。D-1 / D-2 の選択肢（OD-DM4-5）。**D-2 は `bestStars` を通じて progression ★（`totalStars`）を動かす** ので、OD-DM-10 との整合を明示的に判断する必要がある |
| 13 | Lunch Rush economy との整合 | LR は最大 140 Pitz / 180 s（≤ 46.7 Pitz/分） | §7.3 の per-minute 比較。repeat の上限は **「LR の per-minute を超えない」** を推奨の目安にする |
| 14 | exploit / reload / 二重報酬 | run は保存されない。Dinner は `Date.now()` の壁時計を使う | §3.3 の exploit 表 |

### 2.1 所見: 既存 economy の構造（Dinner の報酬設計を左右する事実）

- **FREE:**
  - 1 枚あたり 83（★3）/ 106（★4）/ 130（★5）Pitz。CT2 の GOOD 込み（`pitzReward.ts` / `efficiency.ts`）。
  - model 上の稼ぎは、熟練者で約 320 Pitz/分、初心者で約 94 Pitz/分（§7.3）。
- **Lunch Rush:** 最大でも 46.7 Pitz/分。**LR はすでに FREE より稼げない。** これは既存の economy の性質で、Dinner の問題ではない。
- **Dinner の在庫コスト:**
  - DM-A、DM-B とも、1 clear の refill 換算は約 12 Pitz（Phase 0 JSON）。
  - 報酬の大小に比べて、無視できるほど小さい。
- **帰結:** Dinner の報酬が収入の面で FREE と競うのは現実的ではない（RW-C でも FREE を下回る）。**Dinner の報酬は「挑戦と記録の報酬」として設計する** のが整合的。

---

## 3. DM-4 永続化と exactly-once の設計

### 3.1 保存形式（提案。まだ実装しない）

```ts
// save v2 に新しい top-level key を追加する（schemaVersion は bump しない。EP4 / I4b / HE / H3-2 と同じ前例）
dinnerMissionRecords: Record<missionId, {
  revision: number;                 // この record を最後に更新したときの mission revision
  clears: number;                   // CLEAR の回数（非負の整数）
  attempts?: number;                // OD-DM4-4 で採用した場合だけ。START の回数
  bestClearMs: number | null;       // 単調に減少
  bestTier: "GOLD" | "SILVER" | "BRONZE" | null;  // 単調に改善。null は tier なしの CLEAR か未 clear
  firstClearPaid: boolean;          // 初回報酬を払ったかどうか（一度 true になったら戻らない）
  paidTier: "GOLD" | "SILVER" | "BRONZE" | null;  // RW-A の場合、tier bonus を払った最高 tier
}>
```

- **sanitize:**
  - record ごとに行う（`sanitizeMissionBest` と同じ流儀）。
  - 壊れた record は捨て、壊れた field は既定値にする。
  - 既知の mission id はそのまま使う。未知の id でも forward-compat の pattern に合えば保持する。
- **`missionBest` は再利用しない。** LR の ranking 用で、単調増加の数値を 1 つ持つだけなので、回数や受取 flag を持てない（Phase 0 §10）。
- **revision が変わったときの扱い**（OD-DM4-3）:

  | 案 | 内容 |
  |---|---|
  | V-1（推奨） | `firstClearPaid` は保持する（再度払わない）。`bestClearMs` / `bestTier` / `paidTier` はリセットする（条件が違う記録は比べられないため） |
  | V-2 | すべて保持する |
  | V-3 | revision ごとに record を分ける |

### 3.2 exactly-once（精算の場所）

1. PR #252 の `dinnerResolve` の中で、run が `PLAYING → CLEARED` になった **その 1 回の遷移** で、次をまとめて計算する（pure 関数 `settleDinnerClear(records, run, table) → { records', payout }`）。
   - `quoteDinnerReward(outcome, table, { isFirstClear: !record.firstClearPaid })`
   - 新しい record
   - `pitzBalance + payout`
2. `dinnerRunReducer` は PLAYING 以外の state では何もしない。そのため、同じ遷移が 2 回起きることは構造的にない。加えて、backstop として `DinnerSession.settled: boolean` を持つ（LR の `lastClaimedMissionRunId` に相当）。
3. `persistProgress` の payload に `dinnerMissionRecords` を追加する。そうすれば、Pitz と record が **同じ `writeSave`** で書かれる。途中まで書かれた状態（Pitz だけ付いて record が残らない、など）は起きない。
4. FAILED / TIME_UP / INFEASIBLE / ABANDONED の遷移は、records にも Pitz にも触れない（OD-DM4-4 の `attempts` を採用する場合は START 時に +1 するだけ）。

### 3.3 exploit / 二重報酬の監査

| # | 経路 | 結果 | 対策 |
|---|---|---|---|
| X1 | CLEAR の直後、保存される前に reload する | React の effect は commit の直後に走るので、窓は非常に短い。起きても「両方失われる」だけで、二重にはならない（§3.2-3） | 不要 |
| X2 | run 中に reload して、在庫を戻す / やり直す | 在庫は各 CONFIRM_BAKE で保存済みで、run は消える（OD-DM-7）。得はしない | 既存のとおり |
| X3 | CLEAR 画面を再描画する、StrictMode で effect が二重に走る | 精算は reducer の遷移で 1 回だけ行う。effect では払わない | §3.2 |
| X4 | retry で初回報酬を再取得する | `firstClearPaid` が永続化されるので起きない | §3.1 |
| X5 | **端末の時計を戻して時間を伸ばす** | `Date.now()` の壁時計なので、tier と best time を不正に得られる。LR（ranking）にも同じ弱点がある | OD-DM4-6:<br>・**C-1:** `performance.now()` の差分で clearMs を測る（単調で、端末時計の変更の影響を受けない。iOS の suspend 中の挙動は HV で確認する）<br>・**C-2:** 受け入れる。tier bonus を小さくしておけば被害は限られる |
| X6 | 2 つの tab で同じ save を開く | last-write-wins なので、片方の進捗が消える。**Pitz が増える方向の二重付与にはならない**（あとから書いた tab の state は、先の tab の報酬を含まない）。FREE にも前からある性質 | 任意の hardening として `storage` event がある。DM-4 の範囲外 |
| X7 | 大量に置いて、在庫不足を意図的に起こす | 在庫を失うだけ。INFEASIBLE は 0 Pitz | 不要 |
| X8 | FAILED を連発して慰労金を稼ぐ | 慰労金がなければ起きない | FAILED を 0 のまま維持する（§2 の 7） |
| X9 | revision を上げた直後の再初回 | V-1 なら `firstClearPaid` を保持するので、再度は払わない | OD-DM4-3 |
| X10 | DEV / Preview の `?dinnerDuration` / `?dinnerMinStars` | production では `previewAllowed = false` で読まれない（PR #252 §4）。DM-5-2 で mission に値が入ったら、override path は mission の値より後の順位になる | DM-5-2 で「mission に値がある場合、Preview override は無視される」ことを test で固定する |

---

## 4. DM-4 implementation slices 案

| Slice | 内容 | 層 | HV | Done の条件 |
|---|---|---|---|---|
| **DM-4-0** | Owner Decision の記録（OD-DM4-*）と Issue の作成 | docs | ― | Issue が 1 つ作られる（DM-4 と DM-5 をまとめるか分けるかは Owner が決める） |
| **DM-4-1** | pure: `DinnerMissionRecord` 型、`sanitizeDinnerRecords`、`settleDinnerClear`（RW schedule、tier の差額、revision policy）。reward table はまだ `null` のまま（数値を注入する test） | `src/mission/dinner/` だけ。unwired | 不要 | unit: 初回と repeat、tier の単調性、best の単調性、revision V-1、FAILED は no-op、不正な入力 |
| **DM-4-2** | save: `KNOWN_SAVE_KEYS` への追加、load / sanitize、`persistProgress` の payload、forward-compat | `persistence.ts` | 不要 | unit（field が無い / 壊れている / 未知の id）＋ e2e（古い build の save → 新しい build → 古い build で記録が消えない） |
| **DM-4-3** | runtime: CLEAR 遷移での精算、`settled` guard、Pitz の反映。FAILED 系では何もしない | `gameReducer.ts` | 不要（UI を変えない） | reducer の test と mutation（二重精算、FAILED での払い出し、Dex への書き込み）が DETECTED になる |
| **DM-4-4** | UI: CLEAR overlay の報酬内訳、NEW BEST、tier badge（★ ではない記号）、Mission Select / Detail の best tier と best time | component、CSS | **必要**（390×844 の動画と before/after のスクリーンショット） | LC / E2E、WebKit Gate |
| DM-4-5（任意） | monotonic clock（X5 の C-1） | `useDinnerRuntime` / run | 必要（HV で background の挙動を確認する） | OD-DM4-6 で C-1 を選んだ場合だけ |
| DM-4-D（条件付き） | Dex の境界 D-2 | reducer | 要検討 | OD-DM4-5 で D-2 を選び、かつ #234 を先に決着させた場合だけ |

- DM-4-1 から DM-4-3 は、数値が決まっていなくても進められる（table は注入する）。
- production で START できるようになるのは DM-5-2 から。

---

## 5. DM-5 測定方法（恣意的な数値を避けるために）

### 5.1 何を実測し、何を仮定したか

| 区分 | 内容 | 値 / 出典 |
|---|---|---|
| **(M) 実測** | 実際の gesture で各 target を作った ★（PR #252 `d11858a` の実 runtime、Chromium、390×844 と 360×800） | 144 件。§6.1 |
| (M) | 工程ごとの操作回数（tap、drag、chip の選択、tray の page 送り、CTA） | JSONL の `ops` |
| (M) | UI の遅延の下限（自動操作での dough / cheese / topping / CUT の wall time の中央値） | 390×844 で 1.22 s、360×800 で 1.24 s（1 枚あたり） |
| **(C) コード** | BAKE の針の速さは 55 %/s。窓の中心まで 1.0〜1.27 s。1 往復で 3.64 s | `BakeOverlay.tsx` |
| (C) | ソースは 0.02 / 50 ms。見本の量 0.92 には **最低 2.3 s** 押し続ける必要がある | `sauceQuantity.ts`、`referencePizza.ts` |
| (C) | FREE / CT2 / LR の報酬式、pack と refill の価格 | `pitzReward.ts`、`efficiency.ts`、`economy.ts`、Phase 0 JSON |
| **(A) 仮定** | 人の操作時間（KLM: M = 1.35 s、touch の pointing は Fitts の法則で 0.4〜1.1 s）、作り直しの率 | `dm5_balance_model.py` の `PROFILES`。**DM-5-1 で実測値に置き換える** |

### 5.2 harness（`tools/dinner-dm5/measure.play.ts`）

- **実行環境:** PR #252 の head（DEV の dev server）で、`?dinnerDuration=900&dinnerMinStars=1` を付けて実行した。
  - S=1 なので、構成が正しいピザはすべて TARGET_PASS になり、★ が表示される。
  - `e2e/` の外に置いているので、CI では走らない。
- **実験の軸は 3 つ**（6 recipe × 2 viewport のそれぞれで回した）:
  - **配置:** CARELESS（E2E の固定の spot）と REFERENCE（見本の座標）
  - **焼き:** 窓の中心と、窓の端 +1
  - **ソース:**
    - TAPS: 16 回の瞬間 tap。急いだプレイに相当
    - SPIRAL@2.6s: 見本の量をやや超える量
    - SPIRAL@4.0s: 塗りすぎ
- **結果:** 144 / 144 がすべて TARGET_PASS。失敗も retry もなかった。

---

## 6. DM-5 実測結果

### 6.1 ★（quality）と努力の関係（実測。2 viewport を合わせた値の範囲）

| recipe | TAPS（急ぐ） | SPIRAL 2.6s、CARELESS | SPIRAL 2.6s、REFERENCE | SPIRAL 4.0s（塗りすぎ） |
|---|---|---|---|---|
| margherita | ★3 | ★4〜5 | ★4〜5 | ★4 |
| bismarck | ★3 | ★4〜5 | ★4〜5 | ★4 |
| breakfast-pizza | ★3 | ★4〜5 | ★4〜5 | ★4 |
| funghi | ★3 | ★4〜5 | ★5 | ★4 |
| melanzane-pizza | ★3 | ★4 | ★5 | ★4 |
| parmigiana-pizza | **★2** | ★4 | ★4〜5 | ★3〜4 |

所見:

1. **★ を決めるのは主にソース。** Scoring 2.0 の重みは sauce 52 / pieces 16 / recipe 12 / bake 20（`scoringV2/index.ts`）。
   - 急いで tap しただけのソースは ★3 で頭打ちになる（parmigiana は ★2）。
   - 2.3 s 以上押し続ければ ★4〜5 に届く。
2. **塗りすぎると ★ は上がらない。** 4.0 s では ★4 で頭打ち。つまり「長く丁寧にやるほど良い」わけではなく、**適量の窓** がある。
3. **焼きの精度（窓の中心か端か）は ★ に差を生まなかった。** 窓の中にさえ入ればよい。
4. **★5 は同じ操作でも ★4 / ★5 に揺れる**（viewport と run による ±1）。ソースの tick の標本化によるもの。
5. **quality と speed の trade-off は小さい。** 人にとっては、ソースを 1 回押し続ける（約 2.6 s）ほうが 16 回 tap する（≈ 5.6 s）より速い。S を上げても時間は大きく伸びず、「ソースの塗り方を知っているか」を問う gate になる。

### 6.2 1 枚あたりの時間（model。秒）

| recipe | 具の数 | chip の選択 / page 送り | EXPERT | AVERAGE | BEGINNER |
|---|---:|---|---:|---:|---:|
| margherita | 5 | 3 / 0 | 18.9 | 29.9 | 50.1 |
| bismarck | 4 | 3 / 0 | 18.3 | 29.0 | 48.9 |
| breakfast-pizza | 6 | 4 / 2 | 21.2 | 33.5 | 55.8 |
| funghi | 5 | 3 / 0 | 18.9 | 29.8 | 50.1 |
| melanzane-pizza | 7 | 4 / **6** | 23.9 | 37.7 | 62.0 |
| parmigiana-pizza | 9 | 5 / **6** | 25.7 | 40.5 | 66.3 |

AVERAGE の breakfast-pizza の内訳は次のとおり。

- plan 4.0、dough 2.8、sauce 3.5、chip 6.4、pieces 4.2、CTA 4.0、bake 2.33、CUT 3.0、result 2.0、UI 1.31
- **CUT は 3 本の drag で 1 枚あたり 2.1〜4.8 s。** DM-A / DM-B の target はすべて CUT があるので、mission 全体では 8〜19 s（約 1 割）。
- #256（焼成失敗時の CUT 省略）が採用されると、失敗したピザでこの分が短くなる。
- **mobile の tray の page 送り:** DM-B の eggplant / parmigiano は、全所持素材の tray（OD-R5）では後ろのページにある。
  - harness は一方向に送ってから戻るので、6 回になった。人は位置を覚えるので、実際はこれより少ない。
  - それでも DM-B は DM-A より約 10〜15 % 長くかかる。
- **390×844 と 360×800 の差:** 操作回数も UI の遅延（1.22 s / 1.24 s）もほぼ同じ。制限時間を viewport ごとに変える必要はない。

### 6.3 mission の clear 時間（model。秒。作り直しの期待値を含む）

| mission | EXPERT | AVERAGE | BEGINNER | 参考: Phase 0 の Σ comfortable |
|---|---:|---:|---:|---:|
| DM-A | 78.8 | 134.4 | 256.1 | 172 |
| DM-B | 89.1 | 151.7 | 285.6 | ― |

- 作り直しの率（A）は EXPERT 2 %、AVERAGE 10 %、BEGINNER 25 %。
- 1 回の作り直しは、1 枚分の時間と在庫を失う。
- 初心者の時間の大部分は plan（見本を見る）と chip 探しが占める。

---

## 7. DM-5 balance matrix（Owner の選択肢）

### 7.1 制限時間と tier の閾値（**MODEL**。秒。5 s 単位で丸めた。BRONZE = 制限時間）

| 案 | mission | 制限時間 | GOLD ≤ | SILVER ≤ | BRONZE ≤ | EXPERT | AVERAGE | BEGINNER |
|---|---|---:|---:|---:|---:|---|---|---|
| **T-1 generous**（BEGINNER の期待値 × 1.25） | DM-A | 320（5:20） | 90 | 150 | 320 | GOLD | SILVER | BRONZE |
| | DM-B | 355（5:55） | 100 | 165 | 355 | GOLD | SILVER | BRONZE |
| **T-2 standard**（BEGINNER の期待値 × 1.0） | DM-A | 255 | 85 | 135 | 255 | GOLD | SILVER | **TIME_UP（境界上）** |
| | DM-B | 285 | 100 | 150 | 285 | GOLD | BRONZE | **TIME_UP（境界上）** |
| **T-3 tight**（AVERAGE の期待値 × 1.2） | DM-A | 160 | 80 | 120 | 160 | GOLD | BRONZE | TIME_UP |
| | DM-B | 180 | 90 | 135 | 180 | GOLD | BRONZE | TIME_UP |

- **推奨: T-1。** Phase 1 の mission は EARLY band で、最初の Dinner 体験になる。
  - 初心者でも clear でき（全員 BRONZE 以上）、GOLD は熟練者の目標になる。
  - T-2 / T-3 は、中盤の mission（DM-C / DM-D）の候補として残す。
- **表示用の丸め:** DM-A 5:30 / DM-B 6:00 のように 30 s 単位にしてもよい（OD-DM5-1 の補足）。
- **注意:** これは (A) の仮定から出した値。DM-5-1 の実測で、式（倍率）は保ったまま入力を置き換える。

### 7.2 minimumStars（S）

| 案 | 通るもの（実測） | 落ちるもの | 評価 |
|---|---|---|---|
| S=2 | すべて | なし（Completion Gate だけが実質の gate） | quality の gate が無いのと同じ |
| **S=3（推奨）** | 急いだ tap でも 5 / 6 recipe が通る。ソースをきちんと塗ればすべて通る | 急いだ CARELESS の parmigiana（★2） | 雑な作りを最も難しい recipe でだけ止める。初心者にも優しい |
| S=4 | ソースを 2.3 s 以上押したものはすべて通る（塗りすぎの 4.0 s も ★4 で通る。CARELESS の parmigiana だけ ★3 で落ちることがある） | 急いだ tap はすべて落ちる | 「ソースの塗り方」を必須にする。中盤以降の mission の候補 |
| S=5 | REFERENCE ＋ 適量のソースの一部 | 同じ操作でも ★4 / ★5 に揺れる（±1） | **不公平。推奨しない** |

- S を mission ごとに変えられる形はすでにある（`quality.minimumStars` は mission の field）。
- EARLY は S=3、MID は S=4、という段階づけも可能。

### 7.3 報酬額（Pitz）の選択肢と economy の比較

| 案 | 初回 clear | repeat clear | tier の扱い | DM-A の repeat で得る net Pitz/分（model、T-2 の tier） |
|---|---|---|---|---|
| **RW-A** 改善したときだけ払う（Phase 0 の RW-3） | 150 ＋ tier（G150 / S75 / B25） | 0 | best tier が上がったときに差額を払う | 約 −6〜−9（在庫を使う分だけ損） |
| **RW-B** 少額の repeat（推奨） | 150 ＋ tier（G100 / S50 / B20） | 30 ＋ tier（G30 / S15 / B5） | repeat の schedule でも tier を払う | EXPERT 約 36 / AVERAGE 約 14（**LR の 46.7 を下回る**） |
| **RW-C** FREE と同等 | 200 ＋ tier（G150 / S75 / B25） | 240 ＋ tier（G80 / S40） | ― | EXPERT 約 234 / AVERAGE 約 119（FREE の 320 / 157 よりは下） |

比較の基準は次のとおり。

- FREE の net は EXPERT 約 320 / AVERAGE 約 157 / BEGINNER 約 94 Pitz/分。
- LR は最大 46.7 Pitz/分。
- Shop の価格は、T1 pack が 60、refill が 30。hint が 5〜40。
- Dinner 1 clear の在庫コストは約 12。

各案の評価:

- **RW-A:** インフレが最も小さい。一方で、tier の上限に達したあとは replay の動機がなくなり、repeat は在庫の分だけ損になる。
- **RW-B（推奨）:** 初回の達成感と、周回の軽い理由を両立する。repeat の per-minute は LR を超えない。
  - 初回の合計は最大 250 Pitz。T1 pack 約 4 個分で、Shop の進行を大きくは崩さない。
- **RW-C:** Dinner を稼ぎ場にする。LR（46.7 / 分）より 3〜5 倍稼げるので、**LR が完全に死に場になる**。推奨しない。
- **どの案でも:** FAILED / TIME_UP / INFEASIBLE / ABANDON は 0。FREE Pitz と CT2 は付けない（OD-DM-18）。
- **額の表示:** CLEAR 画面では「クリア報酬 ＋ tier bonus ＝ 合計」の内訳を出す。

### 7.4 在庫の圧力（inventory pressure）

- **DM-A（1 clear あたりの finite need）:** egg 2、bacon 3、mushroom 3。
  - 最初に尽きるのは **egg**（pack 10）で、1 pack で 5 clear 分。初心者は作り直しがあるので約 4 clear 分。
- **DM-B:** eggplant 6（pack 30 → 5 clear）、parmigiano 2（pack 20 → 10 clear）。
- **まとめ:**
  - 満タンの pack から始めれば、INFEASIBLE は「置きすぎ」か「作り直しを繰り返す」ことでしか起きない（Phase 0 の R-1 と OD-DM-16 を再確認した）。
  - 在庫の緊張は、LR や FREE で消耗したあとにだけ生まれる。
- **DM-5 での扱い:** 圧力を上げる手段（持ち込み枠、target の個数、k=1 素材の共有）はすべて OD-DM-16 の範囲外。Phase 1 では変えない（OD-DM5-4 で「変えない」を再確認するだけ）。

---

## 8. Owner Decisions 一覧

| OD | 決めること | 選択肢 | 推奨 |
|---|---|---|---|
| **OD-DM4-1** | 報酬の schedule | RW-A / RW-B / RW-C | **RW-B**（額は DM-5-2 で確定） |
| OD-DM4-2 | 精算の場所 | (a) CLEAR 遷移の reducer で精算する / (b) 別の CLAIM action ＋ runId guard | **(a)** |
| OD-DM4-3 | revision を上げたときの records | V-1 / V-2 / V-3 | **V-1**（初回の受取は保持し、best はリセット） |
| OD-DM4-4 | 失敗の記録 | (a) 何も記録しない / (b) `attempts` を数える（Pitz は 0） | (b)。Select に「挑戦 N 回」を出せる。Pitz は常に 0 |
| **OD-DM4-5** | Dinner と Dex の境界（OD-DM-11 の続き） | D-1: Dex には一切書かない / D-2: TARGET_PASS だけ timesMade と bestScore / ★ を更新する | **D-1**（#234 が決着するまで）。D-2 は `totalStars` を通じて progression に影響するので、#234 と一緒に決める |
| OD-DM4-6 | 時計の改ざん対策（X5） | C-1: monotonic clock / C-2: 受け入れる | **C-1** を DM-4-5 として後から入れる。RW-B なら tier bonus が小さいので、Phase 1 は C-2 でも可 |
| OD-DM4-7 | UI の tier 記号 | 🥇🥈🥉 / 金・銀・銅の皿 / 文字だけ | 🥇🥈🥉（★ と混同しない。OD-DM-10） |
| OD-DM4-8 | Issue の構成 | DM-4 と DM-5 で 1 つの Issue / 別々の Issue | **別々**（DM-4 は数値に依存しない） |
| **OD-DM5-1** | 制限時間と tier の閾値の式 | T-1 / T-2 / T-3 | **T-1**（EARLY）。値は DM-5-1 の実測で入力を置き換えて確定する |
| **OD-DM5-2** | minimumStars（S） | 2 / 3 / 4 / 5 | **S=3**（EARLY）。S=4 は MID の候補 |
| OD-DM5-3 | DM-5-1 の計測方法 | (a) Owner が iPhone で録画し、HV 動画の時刻から集計する / (b) DEV 限定の telemetry（production code の変更になる）/ (c) (a) ＋ 1〜2 人の初見プレイヤー | **(c)**。できなければ (a) |
| OD-DM5-4 | 在庫の圧力 | 変えない（OD-DM-16 を再確認）/ 調整する | **変えない** |
| OD-DM5-5 | #256（失敗時の CUT 省略）と DM-5 の順番 | #256 を先に決める / DM-5 とは独立に進める | 独立に進める。model への影響は失敗したピザの分だけ（1 枚 2〜5 s） |
| OD-DM5-6 | 数値の表示 | 秒単位 / 30 s 単位に丸める | 30 s 単位（例: 5:30） |

---

## 9. Blocker / dependency 一覧

| # | 項目 | 種類 | 影響する slice |
|---|---|---|---|
| B-1 | ~~PR #252（DM-3R-2）の merge~~ **解消（`51e0923` で MERGED、2026-09-27）** | ~~ハード~~ | DM-4-3 / 4-4、DM-5-2（run の出力、CLEAR 遷移の場所、UI、attempt log は #252 で決まる）。DM-4-1 / 4-2 は main の DM-1 の型だけでも書けるが、#252 の `dinnerRun.ts` の変更と衝突しないよう、**merge 後に着手する** |
| B-2 | OD-DM4-1〜8 の決定 | ハード | DM-4 全体。特に 4-1（schedule の形）と 4-2（record の field） |
| B-3 | OD-DM5-1〜3 ＋ DM-5-1 の人の実測 | ハード（DM-5-2 だけ） | production の START を開けること |
| B-4 | #234 / OD-DM-11 | 条件付き | OD-DM4-5 で D-2 を選んだ場合だけ |
| D-1 | #256（失敗時の CUT） | ソフト | DM-5 の時間 model の失敗分 |
| D-2 | DM-4 / DM-5 の Issue が存在しない | 手続き | Owner が Issue を作る（Duplicate Gate は確認済み） |
| D-3 | #38（Economy）/ #224（LR Ranking 2.0） | 参照 | RW の比較の基準。LR の per-minute を変えるなら、RW-B の上限の目安も見直す |
| D-4 | Hint / DH4 | 無関係 | Dinner は hint を拒否する（PR #252 R22）。影響はない |

---

## 10. DM-3R-2 merge 後にすぐ着手できるか

**DM-4: 条件付きで YES。** B-2（OD-DM4-1〜3 と 5）が決まっていれば、merge の直後に次を順に始められる。

1. DM-4-1（pure、unwired）
2. DM-4-2（save）
3. DM-4-3（runtime）

- いずれも数値を注入する形なので、DM-5 を待つ必要はない。
- DM-4-4（UI）は HV が必要。4-3 のあとに進める。

**DM-5: 部分的に YES。**

- DM-5-1（人の実測）は、PR #252 の Preview の `?dinnerDuration` / `?dinnerMinStars` で **merge 前でも計測できる**。
- 集計には `tools/dinner-dm5/dm5_balance_model.py` の `PROFILES` を実測値に置き換えるだけでよい。
- DM-5-2（mission data に値を入れ、production の START を開ける）は、DM-4-3 が merge されてから行う。先に START を開けると、報酬なしで CLEAR できる状態が本番に出てしまうため。

---

## 11. 限界（正直な注記）

- 人の操作時間（A）は文献に基づく仮定で、まだ実測していない。§7.1 の数値は、式と相対関係（profile の比、CUT の割合、DM-B と DM-A の差）が主な成果になる。確定値は DM-5-1 の後に決める。
- ★ の実測は Chromium の自動操作によるもので、指の軌跡は理想化されている。
  - 人の SPIRAL はもっとむらがあるので、★ は同じか低めに出ると考えられる。
  - S=3 の推奨は、この下振れを見込んだもの。
- WebKit では計測していない。CI の WebKit Gate は PR #252 の範囲で green なので、操作回数と UI の構造は同じと考えられる。
- tray の page 送りの回数は、harness の探し方（一方向に送ってから戻る）による上限値。

---

## 12. STOP 判定

**A. READY FOR OWNER DECISIONS**

- DM-4（報酬、永続化、exactly-once、exploit）の設計と slice の案がそろった。
- DM-5 は、実測（★ と努力の関係、操作回数、コード定数）と仮定（人の操作時間）を分けた model と balance matrix で、選択肢を提示できる状態になった。
- 次に必要なのは OD-DM4-1〜8 と OD-DM5-1〜6 の Owner 判断。production 値は確定していない。
- DM-5 の最終値は、DM-5-1 の人の実測で入力を置き換えて決める（それ自体が slice）。

production code、e2e、CSS、PR #252、Hint / DH4 は変更していない。merge と deploy もしていない。
