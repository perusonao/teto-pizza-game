# PR #818 squid SVG comparison / iPhone HV runbook

Date: 2026-11-11
Target: PR #818, SVG commit `babc1cfb`
Owner decision: C (`squid-c-mantle-rings.svg`) is the first candidate, **not adopted**.
Scope: asset-only comparison. No catalog/UI wiring, Preview deployment, Production change or merge.

## 1. Authority sizes and evidence

The production CSS gives an on-pizza piece a 28 px base size. A future ingredient without a
size-class row defaults to class `m` (production multiplier 1), so 28 px is the current squid
planning size. The tray icon is fixed at 26 px. A 20 px rendering is included as the Style Lock
legibility lower bound; it is not a proposed squid production size.

- A/B/C actual-size sheet: `screenshots/squid-svg-818/squid-abc-native-size-comparison.png`
- C vs existing seafood: `screenshots/squid-svg-818/squid-c-seafood-discrimination.png`
- iPhone-width sheets: `squid-iphone-390x844.png` and `squid-iphone-360x800.png`
- iPhone-width seafood sheets: `squid-seafood-iphone-390x844.png` and
  `squid-seafood-iphone-360x800.png`
- Backgrounds: representative flat comparison colours only — light dough-like `#efd49d`, dark
  baked-dough-like `#c9904f`, cheese-like `#f3cf70`. These are not sampled production colours and
  do not reproduce the runtime bake filter.
- Existing comparisons: approved/reference shrimp, whitebait, sardine and the retained clam valve

The PNGs are deterministic rasterizations of the committed SVG files. The 28/26/20 px icons are
drawn at those native pixel dimensions; the 4x panel is inspection assistance only.

## 2. A/B/C result

| Candidate | 28 px pizza | 26 px tray | 20 px lower bound | Finding |
|---|---|---|---|---|
| A whole | Mantle and eyes are clear | Clear | Still reads as a small character | Strong whole-squid identity, but the face makes it mascot-like rather than topping-like |
| B rings | Two rings are clear | Clear | Rings remain, tentacles become a small mark | Strong cooked-topping identity, but no mantle; can read as onion rings without the label |
| **C mantle + ring** | **Upright mantle and detached ring both remain** | **Both remain** | **Mantle remains; ring is small but separate** | **Best bridge between ingredient identity and pizza topping; keep as first candidate** |

Recommendation: keep C as first candidate without adoption. Do not remove A/B until real-device
review is recorded. C does not need an asset-level 1.2em correction at the current 28/26 px
planning sizes; any CSS size correction is a later integration decision.

## 3. C discrimination and Style Lock review

### Identification

- C is identified by the tall triangular mantle plus one detached ring, not by pink colour alone.
- It is not confused with shrimp: shrimp is a single horizontal C curve; squid C is vertical with
  a detached circular element.
- It is not confused with whitebait/sardine: both references have horizontal fish silhouettes.
- Clam and squid are both warm/light coloured, but the clam is a low closed shell while C is tall.
- At 20 px the ring is the first detail to weaken. The mantle outline remains continuous on all
  four tested backgrounds. Real-device review must decide whether this is sufficient.

### Style Lock V2 checklist

| Rule | Result |
|---|---|
| `viewBox="0 0 64 64"`, transparent background | PASS |
| 2.4 px primary outline, rounded joins/caps where needed | PASS |
| contact shadow and two-tone body | PASS |
| no text, `id`, `<defs>`, gradient or `url(#...)` | PASS |
| decorative `aria-hidden="true"`, `focusable="false"` | PASS |
| recognizable at 28/26 px; family recognizable at 20 px | Browser raster PASS; real iPhone pending |
| colour-independent separation from compared seafood | PASS by silhouette; grayscale/on-device confirmation pending |

## 4. iPhone Safari HV procedure

This is an **asset HV**, not gameplay/integration HV. It cannot authorize wiring or prove the
future in-game bake filter. Use the exact PR #818 head containing this report.

1. Record device model, iOS version, Safari version, viewport and PR head SHA.
2. Use `squid-iphone-390x844.png` only on a 390 CSS px viewport and
   `squid-iphone-360x800.png` only on a 360 CSS px viewport. Open the raw image in Safari, with no
   reader/GitHub chrome, and confirm it spans the viewport width exactly with no horizontal crop,
   pinch zoom or fit-to-page reduction. The source width then equals the viewport CSS width, so
   its 28/26/20 px boxes preserve the intended CSS-pixel comparison. If this cannot be proven,
   stop; do not infer an actual-size result from the 1200 px overview sheets.
3. Inspect the native 28 px and 26 px rows first. The 1200 px sheets and enlarged row may be used
   only to explain a defect, never to pass legibility.
4. For each background, answer: (a) mantle is visible, (b) ring stays detached, (c) outline does
   not disappear, (d) C is not mistaken for a person/rocket/onion ring.
5. On the matching-width `squid-seafood-iphone-390x844.png` or
   `squid-seafood-iphone-360x800.png`, compare C against shrimp, whitebait, sardine and clam
   without reading the labels for two seconds; then check the label. Record any mistaken identity.
   The 1200 px `squid-c-seafood-discrimination.png` is an overview only and cannot pass actual-size
   iPhone identification.
6. Repeat in iPhone grayscale accessibility mode. Confirm C vs shrimp and C vs clam from silhouette.
7. Capture one screenshot of the matching viewport sheet, plus a short screen recording that moves through
   28 px → 26 px → 20 px without pinch zoom. Video stays outside the repository and is delivered
   directly to the Owner.
8. Owner records one result: `PASS C as integration candidate`, `NEEDS FIX`, or `NO-GO`. This is
   not final adoption. Final adoption requires a separately claimed wired build and the normal
   pizza/tray/BAKE/RESULT iPhone HV.

Stop conditions: the image width does not exactly match the CSS viewport; the ring merges into the mantle at 26 px; the
outline disappears on baked dough or cheese; C is repeatedly confused with shrimp/clam; or the
exact head/device facts are missing.

## 5. CI state at this report

CI run `42863158243` failed in attempts 1 and 2 before lint/Vitest/build. Both attempts ran the
unchanged `scripts/ci/test-webkit-ci.sh` self-test and produced the same 147/154 result. The seven
failures are process/apt fixture expectations in `install-with-retry.sh` tests (orphan wait/log,
lock negative controls and foreign-process survival). No SVG assertion, parsing, rasterization or
application test failed. Classification: **CI infrastructure-script compatibility failure,
reproducible on rerun, unrelated to the three SVG contents, but still a blocking CI failure**.
No further rerun and no timeout/Gate relaxation are permitted without fixing that separate owner.

## 6. Final Gate boundary

- Asset diff: three SVGs plus this report and six PNG evidence files; existing files unchanged.
- Local: XML parse PASS, forbidden SVG constructs absent, `git diff --check` PASS.
- CI: FAILED as described above.
- Independent review: required on the final report commit.
- iPhone asset HV: pending Owner.
- Result: **HOLD / not mergeable by policy**, regardless of the preferred C candidate.
