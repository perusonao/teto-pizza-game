# #378 Option 1 — stock-blocked Research Entry guidance + Shop 「在庫なし」 (Result)

Authority: Issue #378 OD-378-1..6, `TETO_PROD27-DEADLOCK_Fresh-Audit.md`, `TETO_378_OD-378-6_Next-Pizza-CTA_Fresh-Audit.md`. Base: main `0104d50`.

## Changes
- `src/state/researchStockBlock.ts` (new, pure): `isResearchStockBlocked(recipe, {dex, ownedIngredientIds, inventory})` = registered Research Entry (`isResearchRegistrable`: every finite ingredient owned) ∧ some finite ingredient at stock < 1. Stock is the explicit cause; "cannot research" in general never qualifies. Returns one boolean (no ids/names/counts).
- `DexOverlay.tsx`: a stock-blocked Research card shows the fixed 「研究を続けるには材料の補充が必要」 and 「🛒 ショップで補充する」 (`onOpenShop`, only when wired). Cookable entries are unchanged (「このピザを研究する」, no notice).
- `ShopOverlay.tsx` + `App.css`: every OWNED row at stock 0 gets a 「在庫なし」 badge, `data-stock-state="EMPTY"` and a red outline. No filter/sort/highlight by any Research Entry; row order unchanged.
- Unchanged by design: Dex footer 「次のピザを作る」/「もう一枚作る」 (`onClose` only), Dinner 「次のピザを作る」 (`DINNER_NEXT_PIZZA`), reducer, persistence, save/schema, Discovery authority, Research Target routing, #377, #360, Expansion Slice 1, HAND 12.

## Tests
- `src/components/378.stockBlockedResearch.test.tsx` (16): sufficient stock → research CTA, no notice/Shop CTA; zero → notice + Shop CTA; predicate contract (unregistered / discovered / non-stock never true); Dex→Shop→refill→close→Dex loop with latest inventory and research CTA restored; Shop mark for owned stock 0 only (not NEW, not stock>0), same marks/order regardless of entries; privacy (no recipe name, other required ingredient names, digits, 不足/残り/種類/個); multi-entry cards read identically; footer is close-only; no persistence use.
- E2E `e2e/research-stock-blocked-378.spec.ts` (390×844 + 360×800); `discovery-research-dex.spec.ts` assertion updated (all-stock-0 save now correctly shows notice + Shop CTA instead of "no button").
- Gates on this HEAD: oxlint (0 errors; pre-existing warnings), `tsc -b`, `vite build`, full vitest 334 files / 6021 passed, Chromium E2E (discovery*, home-research-entry-parity, ingredient-shelf-shop, new spec) 100 passed / 14 pre-existing skips. WebKit not run (no layout-class change beyond a text block + badge; CI runs it on the PR).

## Privacy
Card text contains only the existing unlock fact + the fixed notice; no recipe name/No., no other ingredient name, no required/missing count. Shop mark is a property of the ingredient (owned ∧ 0), identical for every player/state.

## Human Verification (390×844 primary, 360×800 layout)
Before/after screenshots: `docs/reports/screenshots/378-stock-blocked-research/` (01 Dex card, 02 Shop chicken row, 03 Dex after refill). Video (not committed): `378-stock-blocked-research-390x844.mp4`, H.264, 390×844, 16.4 s, 322 KB — Dex research card (notice + CTA) → Shop → 在庫なし → 補充 → close → Dex with research CTA restored. Video Verification: PASS. No horizontal overflow at either viewport (asserted in E2E).

## Save/schema impact
None.
