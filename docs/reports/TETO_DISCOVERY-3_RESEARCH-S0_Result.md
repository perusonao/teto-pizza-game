# Discovery 3.0 #346 S0 — Player-facing rename (レシピ発見) Result

Base main: `fde9e2187d5946782903098aa2d48f842212caae`. Refs #346 (stays open).

## Player-facing terminology
| Where | Before | After |
|---|---|---|
| HOME lead CTA | 🎨 フリークッキングで探す | 🎨 レシピ発見 + 「持っている食材を組み合わせて、新しいレシピを発見しよう」 |
| HOME secondary CTA | 🎨 フリークッキング | 🎨 レシピ発見 |
| HOME bubble (Dex 0) | …フリークッキングで最初の1枚… | …レシピ発見で最初の1枚… |
| Pizza Select prompt / CTA | フリークッキングで…／フリークッキングで探す | レシピ発見で…／レシピ発見へ |
| Dex locked card CTA | フリークッキングで探す | レシピ発見へ |
| Cooking (no target) | 🎨 フリークッキング | 🎨 レシピ発見の試作 (PREPARE / BAKE) |
| Cooking hint / order copy | 好きな材料で自由に… | 材料を組み合わせて、新しいレシピを試してみよう |
| Shop / HintSheet / Notebook empty | フリークッキングで… | レシピ発見で… |
| Lunch Rush RESULT nav / ORDER button | フリープレイへ / フリープレイ | ピザ作りへ / 🍕 ピザを作る |
| ORIGINAL RESULT (no target) | 🎨 オリジナルピザ完成！ + 図鑑にはまだ… + near/far line | 🧪 オリジナルピザ + まだ新しいレシピは見つかっていません (same as Research ORIGINAL, without the 研究中 line) |
| Free-cook retry CTA | もう一度じゆうに作る | もう一度試す |

Kept: 「レシピを選んで作る」 (→ Pizza Select, discovered-recipe replay), S4 post-discovery CTA priority, all internal `FREE` / `freeCook` / `mission.mode` names.

## ORIGINAL contract
Every Recipe Discovery ORIGINAL (`freeCook`, with or without Research Target) now renders one fixed card. The near/far row is no longer rendered on ORIGINAL (it was a constant string, but is removed from player-facing); the 💡 hint CTA stays. ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH are byte-identical (unit-pinned with and without target, with different near-miss inputs). Execution advice (thin sauce) is recipe-independent and unchanged.

## Not changed
Matcher, reducer, save schema, Research Entry / Target / Notebook / Hint authority, `resultNearMiss` (internal, still tested), 🎨 per-slot card, sticky Hint, Changelog / Preview / Production.

## Persistence impact
None (copy + render only; no schema, no new field).

## Tests
vitest 5785 passed; `tsc -b` clean; oxlint: no new warnings. New `e2e/discovery-recipe-discovery-s0.spec.ts` (HOME fresh lead CTA; HOME → レシピ発見 → cooking → ORIGINAL RESULT; overflow / CTA reachability / oracle & old wording absent / no hidden identity) 4/4 on 390×844 and 360×800. 25 text-dependent E2E specs updated and run on both Chromium projects. WebKit left to CI.
Screenshots: `docs/reports/screenshots/discovery-3-research-s0-recipe-discovery/`. No MP4 (no dynamic change).
