# Cooking Sear Phase 1 — 評価用の画像・動画 INDEX（#724）

コードの状態: ブランチ `claude/teto-pizza-cooking-audit-5qhbpw`（焼き色 5 点化・長押し 2/3/4 秒の比較スイッチ込み）。撮影はすべて Playwright Chromium（dev サーバー）。**WebKit・実機 Safari では未撮影。** 既定の長押しは 4 秒のまま（比較は `?cookSear=on&cookSearMs=2000|3000|4000`）。

## まず見る（1 枚で全体が分かる）
| ファイル | 内容 |
|---|---|
| `review-sheet-390x844.png` / `review-sheet-360x800.png` | 実ゲーム画面 6 枚: ピル → 炙り画面 → 押している間 → 離した直後 → 盤面の焼き上がり → 焼成（既存フロー） |
| `stages-old-vs-new-{390x844,360x800}-actual-size.png` | 焼き色 5 段階の旧/新（実寸、ブラックオリーブ併置） |
| `stages-old-vs-new-{390x844,360x800}-zoom3x.png` | 同上の 3 倍拡大（iPhone 相当の解像度） |
| `hold-time-compare-{390x844,360x800}.png` | 長押し 2/3/4 秒設定 × 押し始めから約 0.5〜4 秒の炙り画面（量は実測、秒は撮影遅延込みの目安） |
| `video-frames-{390x844,360x800}.png` | 動画（下記）から 12 コマを抜いた静止画。動画を再生せずに内容を評価できる |

## before / after（実画面）
| ファイル | 内容 |
|---|---|
| `before-after-06-released-{vp}.png` | 炙り画面（左: 改善前の試作＝黒い斜め帯、右: 改善後＝形が残る） |
| `before-after-07-seared-on-pizza-{vp}.png` | 盤面の焼き上がり |
| `iphone-{vp}-00-before-feature-off.png` | 機能 OFF（本番既定）の同じ盤面 |
| `iphone-{vp}-01..10-*.png` | 全工程の実画面（01 ピル / 02 置いた生 / 03 待機 / 04・05 押下中 / 06 離した直後 / 07 盤面 / 08 レイアウト / 09 3 枚炙り / 10 焼成） |

## 動画（repo に commit しない・直接提出）
| ファイル | 内容 |
|---|---|
| `cooking-sear-phase1-eval-hv-390x844.mp4`（Authority、約 42 秒） | **同じ 2.0 秒の長押しを 2 秒・3 秒・4 秒設定で 3 回**（まっくろ／しっかり／こんがり）。画面の左上に「N秒設定」。指の位置は青いリング。最後は焼く → 取り出す → RESULT |
| `cooking-sear-phase1-eval-hv-360x800.mp4`（Secondary、約 42 秒） | 同じ手順 |

`raw` の素材（3 倍の元画像）は repo に入れていない。旧い画像（`../cooking-sear-phase1/`）は改善前の試作の記録で、評価には上の最新を使う。
