# CUT-S2 Owner HV — Preview page (Issue #288)

Preview-only page for cutting a 6-slice pizza with a real finger and reading CutQuality beside the current cutScore.
Shadow only: no `GameState`, reducer, save, ScoringV2, stars, Dex, Pitz, Lunch Rush, Dinner or ranking is touched.

- **Open:** `<Preview URL>/?cuthv=1` (Preview or DEV builds only). Any other value, or a production build, opens the normal game.
- **What it is:** the real `PizzaStage` CUT gesture layer (same stage size, rim-to-rim line, duplicate/limit gates), with its own throw-away state.
- **Shown after 「切り終わる」:** Q with uniformity zero-side 0.6 and 0.4 (every other tolerance and the weights unchanged: centre 4/20, sliver 0.2,
  provisional weights), uniformity under both, center, validity, count, current `evaluateCut` cutScore, sliver count / pieces.
- **Records:** per trial the instructed style (丁寧 / 普通 / 雑), the Owner's self-rating, both Q values, cutScore and the committed lines, under the
  Preview-only key `teto-pizza-preview-cuthv-v1` (survives reload; never the game save). The final screen has 「結果をコピー」 and a select-all text box.
- **Isolation:** `src/main.tsx` dynamically imports `src/preview/cutHvBoot` only behind `import.meta.env.DEV || VITE_PREVIEW_MODE`;
  `src/preview/cutHvIsolation.gate.test.ts` builds production and Preview bundles and proves the page, key, query name and CSS are absent from production.
- **Layout (e2e/cut-hv-preview.spec.ts, real Chromium):** 390x844 and 360x800, no horizontal overflow and no vertical scroll while cutting and while rating;
  rating buttons >= 44px; screenshots in `docs/reports/screenshots/cut-s2-hv/`.
- **Not decided here:** uniformity zero-side 0.6 vs 0.4, weights, sliver, centre tolerance, S3/S4.
