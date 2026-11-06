# WebKit 360×800: 調理画面の横はみ出し — Result（Issue #764 / PR #765）

- 起点: PR #759 の HEAD `33bc275` の新しい E2E が WebKit 360×800 だけで失敗した件。Owner 判断（PR #759 comment 6663668627、案1）により、別の Issue・PR で調査し最小限の修正を行った。
- 状態: **Draft・未 merge**。全 Gate が通っても merge は別途 Owner の判断を待つ。Production・共有 Preview は触っていない。
- 本番コードの変更: `src/App.css` に 17 行を追加しただけ。トレイの列の決め方、チップの最小幅、名前の省略はいずれも main のまま。

## 1. 原因（CI の WebKit で特定。推測ではない）
`e2e/cooking-screen-sideways.spec.ts` は、画面から右にはみ出した要素を、DOM の深い順に一覧で出力する。修正前の HEAD `f938de2`（run 42068308943、WebKit 360×800）の出力は次のとおり。

| 要素 | 位置（左–右） | 幅 | 補足 |
|---|---|---:|---|
| `button.ingredient-chip`「ジェノベーゼソース」 | 269–386 | 117px | 108px の列からはみ出す |
| `span.ingredient-chip__name`「ジェノベーゼソース」 | 277–378 | 101px | `white-space: nowrap`。Chromium では 86px |
| `button.ingredient-chip`「カレーケチャップ」 | 269–386 | 117px | |

- `.ingredient-tray { grid-template-columns: repeat(3, 1fr) }` の `1fr` は `minmax(auto, 1fr)` と同じ意味になる。そのため、列はチップの最小幅（折り返さない名前の幅）まで広がる。
- WebKit では和文の字幅が広い。3 列の最小幅の合計が 336px のトレイを超え、`.game-screen--cooking` の `scrollWidth` が 386px（画面は 360px）になって、画面全体が横にスクロールした。
- 通常のトマトソースの流れでも同じように失敗するので、**Batch 18 より前からある問題**である。390×844 では合計がトレイに収まるため起きない。
- 推定: 実機の iPhone SE / mini（幅 375）も、字幅が WebKit に近ければ同じ条件になる。これは実機では未確認。

## 2. 修正（案D、`7ce5937`）
```css
@media (max-width: 389px) {
  .prepare-dock .ingredient-chip { padding-left: 3px; padding-right: 3px; }   /* 6px → 3px */
  .prepare-dock .ingredient-chip__name { font-size: 10px; }                   /* 11px → 10px */
}
```
- 390px 未満でだけ、名前を 1px 小さく、チップの左右の余白を 3px 狭くする。WebKit の字幅でも、最も長いソースの行が 336px のトレイに約 330px で収まる。
- **390×844 は何も変わらない**（比較画像の 3・4 枚目が同一）。名前はどの幅でも全文表示される。

### 採用しなかった案
| 案 | 結果 | 不採用の理由 |
|---|---|---|
| A（列を均等幅 `minmax(0, 1fr)` にし、はみ出す名前を省略。`a4dc3f9`） | はみ出しは 0 | 「フロマージュブランソース」（Batch 18 レイナのソース）が 390×844 を含むすべてのブラウザで「…」になる |
| C（列幅を中身に合わせて伸縮 `minmax(0, auto)`） | はみ出しは 0、名前は全文表示 | すべてのトレイで列幅が不均等になり、ページ送りのたびにチップ幅が変わる。最小限の修正ではない |

## 3. 検査（削除・緩和なし）
`e2e/cooking-screen-sideways.spec.ts`（新規）は、Free Cooking を生地 → ソース → チーズ → 具材 → 焼成の順に進める。各工程で、**ソース・チーズ・具材の全ページ**について、調理画面が横にスクロールしないこと（`scrollWidth ≤ clientWidth`、`scrollLeft = 0`）、ページ全体に横はみ出しがないことを assert する。

- ソースは、通常のトマトソースと、Batch 18 が使う 2 種（カレーケチャップ、フロマージュブランソース）の 3 通り。
- 対象 viewport は 360×800 と 390×844。
- 失敗した場合は、はみ出した要素の一覧を出力する。

## 4. 結果
| 項目 | 結果 |
|---|---|
| CI `7ce5937`（11 本） | **全成功**: build、classify、layout-chromium、Layout Contract Gate、WebKit 390×844 / 360×800 の 6 shard、WebKit Gate |
| Codex `7ce5937` | 指摘 0 件 |
| CI `f938de2`（修正前、spec のみ） | WebKit 360×800 で 3/3 失敗（§1 の要素一覧）。390×844 は合格 |
| CI `a4dc3f9`（案A） | 1 回目は `pilot-e-ingredient-icons`（WebKit 390 shard 3/3）が失敗。同じジョブを 1 回だけ再実行して合格（#394 系のページ送りの間欠失敗と判断。PR comment 6671895446 に記録） |
| Chromium（ローカル） | #764 spec 6/6。tray / layout / 1-screen 系と `pilot-e` で 181 件合格。layout-contract 13 件合格。App.css を読む Vitest 11 ファイル・136 件合格 |
| WebKit の字幅を Chromium で再現 | チップ名に `letter-spacing: 1.7px` を足し、「ジェノベーゼソース」を CI の実測値（約 101px）に合わせた。main は 360×800 で 3/3 失敗（`scrollWidth` 388、スワイプで 28px ずれる）、案D は 6/6 合格 |

## 5. Human Verification
**スクリーンショット**（`docs/reports/screenshots/webkit-360-cooking-overflow/`）
- `compare-{tomato,curry-ketchup}.png`: 左から、360×800 修正前（WebKit 相当の字幅で 28px 横にずれる）、360×800 修正後、390×844 修正前、390×844 修正後。
- 個別の画像: `before|after-webkitwidth-*-360x800.png`、`before|after-*-390x844.png`。

**動画**（リポジトリには commit せず、セッション内で直接提出）
| 動画 | Viewport | 長さ | サイズ | Codec | Verification |
|---|---|---:|---:|---|---|
| `issue764-390x844-after-tomato.mp4` | 390×844 | 34.0s | 0.45MB | H.264 High | PASS |
| `issue764-390x844-after-curry-ketchup.mp4` | 390×844 | 33.4s | 0.46MB | H.264 High | PASS |
| `issue764-360x800-before-vs-after-tomato.mp4` | 360×800 ×2（左右並べ） | 20.5s | 0.34MB | H.264 High | PASS |
| `issue764-360x800-before-vs-after-curry-ketchup.mp4` | 360×800 ×2（左右並べ） | 19.9s | 0.34MB | H.264 High | PASS |

Video Verification: PASS（ffprobe で形式を確認し、最後までデコードできた）

動画で確認すること:
- 390×844: 修正後の生地 → ソース → チーズ → 具材 → 焼成で、トレイと操作バーが画面内に収まり、名前が全文表示されていること。
- 360×800 の比較: 左（修正前）はソース工程で横にスワイプすると画面が 28px ずれる。右（修正後）はずれず、名前が 10px で全文表示されている。

**注意**
- このコンテナでは WebKit を取得できない（ネットワークポリシー）。そのため、比較動画と比較画像は Chromium で WebKit の字幅を再現したもの。
- 実際の WebKit で修正前後を確かめた根拠は、CI の `f938de2`（失敗）と `7ce5937`（成功）。
- iPhone Safari 実機での HV は未実施（Owner が行う）。

## 6. 衝突と次の手順
- `src/App.css`（HOT）の変更箇所は、#761（`.ingredient-glyph--shiso-leaf`）とも #468（`.pizza-cheese--mozzarella`）とも重ならない。
- この PR を Owner が承認して merge した後に、#759 に main を取り込み、HEAD 固定での CI・Codex と B18 HV をやり直す。
