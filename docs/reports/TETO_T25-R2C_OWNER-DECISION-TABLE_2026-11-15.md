# T25-R2c / Batch 25 Owner decision table

Date: 2026-11-15  
PR: #853 (Draft / HOLD)  
Audited PR HEAD: `3be85e502241fa342faeba24941fd7b986543747`
Re-measured `main`: `dba7d7331cad49a9dff068a9a23d79ba1cb37ee4`

This is a decision packet, not an approval record. Every cell in **Owner decision** is intentionally blank. No Research delta, duplicate exception, recipe, ingredient, ladder row, runtime change, Production switch, or Preview update is authorized by this document.

## 1. Fresh-state conclusion

- PR #853 is open, Draft, mergeable, and has no file-level conflict with `main`. GitHub reports `mergeStateStatus: UNSTABLE` only because the required CI build was still running at the start of this audit; there are no reviews and no review decision.
- The PR HEAD and base are unchanged from the requested baseline. The PR is docs/data-only: ledgers, generated verification data, the T25 preflight packet, and reports.
- T24 is now shipped on `main`. Therefore the authoritative R2c measurement is `T25-R2c.main-3c5b433a.preflight.md`: 110 recipes / 130 ingredients / 95 steps, 6 `NEEDS_OWNER`, 0 `BLOCKED`, 42 non-canonical Research IDs, and 0 canonical-order changes.
- `cucumber` is shipped by T24 and must be reused, not created again. The committed prose spec still lists it under `newIngredients`; implementation must first normalize that input without changing the pizza-salad composition.
- `chicken-tikka-pizza` remains excluded and HOLD. Nothing here approves its base, recipe, ingredient, or Research effects.

## 2. Research audit — all 42 IDs

Interpretation: “before → after” is the complete deterministic bound measured by the preflight, not a promise that every sampled order changes. `X` means an existing letter. “Prior relation” is evidence only; the old 40-ID approval is **not** automatically reused.

| recipe ID | stage | before → after | max shift | reason | prior relation | Codex recommendation |
|---|---|---|---:|---|---|---|
| `baba-ganoush-pizza` | olive-oil | none→A/B; X→X+1 | 1 | asparagi adds another olive-oil cohort member | same bound appeared in old 40 | approve |
| `baingan-bharta-pizza` | cilantro | none→A | first cohort letter | banh-mi; same old bound | approve |
| `bambino` | corn; ham | none→A/B; X→X+1 | 1 each | salad/elote share corn; banh-mi shares ham | same old bound | approve |
| `bbq-chicken-pizza` | cilantro | none→A | first cohort letter | banh-mi; same old bound | approve |
| `black-truffle-pizza` | parmigiano | none→A | first cohort letter | asparagi; same old bound | approve |
| `boscaiola` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `brazilian-catupiry-corn-pizza` | corn | none→A/B; X→X+1 | 1 | salad/elote | same old bound | approve |
| `buffalo-chicken` | buffalo-sauce; gorgonzola | none→A | first letter at either stage | cauliflower recipe shares both | same old bound | approve only with duplicate exception D-2 |
| `capricciosa` | ham | none→A | first cohort letter | banh-mi | same old bound | approve |
| `cuban-pizza` | ham | none→A/B; X→X+1 | 1 | banh-mi | same old bound | approve |
| `currywurst` | paprika-powder | none→A | first cohort letter | elote | same old bound | approve |
| `eggplant-ricotta-pizza` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `fugazza` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `goulash-pizza` | paprika-powder; sour-cream | none→A | first letter at either stage | elote | same old bound | approve |
| `grandma-pizza` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `hawaiian` | ham | none→A/B; X→X+1 | 1 | banh-mi | same old bound | approve |
| `meat-lovers` | ham | none→A/B; X→X+1 | 1 | banh-mi | same old bound | approve |
| `moussaka-style-pizza` | feta | none→A | first cohort letter | elote | same old bound | approve |
| `new-haven-apizza` | olive-oil; parmigiano | none→A | first letter at either stage | asparagi | same old bound | approve |
| `okonomiyaki-style-pizza` | mayo | none→A | first cohort letter | elote | same old bound | approve |
| `parmigiana-pizza` | parmigiano | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `peking-duck-pizza` | cucumber | none→A/B; X→X+1 | 1 | T24 cucumber is reused by pizza-salad | **new after T24; no old approval** | approve; pin independently as R-41 |
| `pesto-burrata-pizza` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `pesto-noci-pizza` | gorgonzola | none→A | first cohort letter | cauliflower recipe | same old bound | approve only with D-2 |
| `pesto-salmone` | lemon | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `pizza-alla-crudaiola` | olive-oil | none→A | first cohort letter | asparagi | same old bound | approve |
| `pizza-bianca` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `pizza-bianca-ricotta` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `pizza-cavolo-carote` | carrot; lemon; olive-oil | none→A | first letter at any stage | banh-mi/asparagi | same old bound | approve |
| `pizza-feta-eliniki` | feta; olive-oil | none→A for feta; none→A/B or X→X+1 for oil | 1 | elote/asparagi | same old bound | approve |
| `pizza-finocchi-salad` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `pizza-overload` | ham | none→A/B; X→X+1 | 1 | banh-mi | same old bound | approve |
| `pizza-portuguesa` | ham | none→A/B; X→X+1 | 1 | banh-mi | same old bound | approve |
| `pizza-radicchio-noci` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |
| `potato-mayo-pizza` | corn; mayo | none→A/B or X→X+1 for corn; none→A for mayo | 1 | salad/elote | same old bound | approve |
| `quattro-formaggi` | gorgonzola; olive-oil; parmigiano | none→A | first letter at any stage | cauliflower/asparagi | same old bound | approve only with D-2/D-3 |
| `reina-pepiada-pizza` | cilantro; mayo | none→A | first letter at either stage | banh-mi/elote | same old bound | approve |
| `shirasu-pizza` | lemon | none→A | first cohort letter | asparagi | same old bound | approve |
| `spinach-artichoke-pizza` | parmigiano | none→A | first cohort letter | asparagi | same old bound | approve |
| `taco-pizza` | lettuce | none→A..C; X→X+1..X+2 | 2 | kebab and salad both add lettuce cohorts | same old bound and sole max-2 row | approve; pin max 2 explicitly |
| `thai-chicken-pizza` | cilantro | none→A/B; X→X+1 | 1 | T24 recipe now shares cilantro with banh-mi | **new after T24; no old approval** | approve; pin independently as R-42 |
| `vongole` | olive-oil | none→A/B; X→X+1 | 1 | asparagi | same old bound | approve |

Independent canonical check: the fresh T24-based preflight reports **0 shipped recipe changes in canonical ladder order**. Recommendation: approve this zero-change invariant separately and require the implementation test to fail on any canonical change. This is not covered by approving the 42 non-canonical rows.

## 3. Duplicate exceptions

| pair | composition and process | taste / game identity | recommendation |
|---|---|---|---|
| `pizza-salad` vs `bambino` | Both use tomato sauce, mozzarella and corn. Salad uniquely adds cucumber, post-bake lettuce and yogurt sauce; bambino uniquely adds ham. Salad therefore has SAUCE→CHEESE→TOPPING→BAKE→FINISH and two liquid identities, while bambino is a conventional pre-bake ham/corn pizza. | cool/crisp/tangy salad finish versus warm savory ham/corn | **Approve D-1**. Jaccard 0.429 reflects a shared base, but three visible salad cues and FINISH create adequate play differentiation. Keep yogurt sauce as a second sauce presence, not another paint pass. |
| `buffalo-cauliflower-pizza` vs `buffalo-chicken` | Same buffalo sauce, mozzarella and gorgonzola; only cauliflower replaces chicken (ONE_DIFF, Jaccard 0.6). Both are pre-bake and use the same process. | roasted vegetable bite versus chicken; mechanically almost identical | **Approve D-2 narrowly**, provided cauliflower gets unmistakable floret art and a different landing silhouette. Reject if generic/emoji art makes it read like chicken. This is the weakest exception. |
| `pizza-asparagi-limone` vs `quattro-formaggi` | Both use mozzarella, parmigiano and olive oil. Asparagi adds post-bake asparagus and lemon; quattro adds gorgonzola/fontina and has no TOPPING/FINISH. | fresh green/citrus finish versus rich four-cheese | **Approve D-3**. Jaccard 0.429 understates the process difference: two post-bake ingredients and FINISH are strong gameplay identity. |

## 4. Ingredient and sauce proposal

Counts below are per recipe and remain gameplay calibration, not source truth. Tray icons and placed art should be dedicated SVG for every new solid ingredient; sauce chips may use dedicated simple vector marks, while the applied sauce is the existing colored field/dab renderer.

| ingredient | display / class | qty, size | selection icon → placed appearance | SVG | placement / overlap assessment |
|---|---|---|---|---|---|
| `asparagus` | アスパラガス; topping / vegetable | 2, `m` | tied green spear bundle → two diagonal spear segments with tips | required | POST_BAKE tap/drag placement; visually unique, no existing spear vegetable |
| `cauliflower` | カリフラワー; topping / vegetable | 2, `m` | cream floret head → irregular cream floret with pale-green stem | required | PRE_BAKE tap/drag; must not resemble chicken, feta or mozzarella |
| `daikon` | 大根; topping / vegetable | 2, `s` | white julienne bundle → narrow translucent white matchsticks | required | PRE_BAKE tap/drag; carrot-like shape is acceptable only with white color and crossed-stick silhouette |
| `kebab-sauce` | ケバブソース; sauce / no family | 1, no size | red-orange squeeze swirl → warm orange-red painted field (`#d86a35` proposal) | chip mark optional; no placed-piece SVG | primary sauce, existing `PAINT`, pre-bake. Distinct from tomato/buffalo by lighter, creamier orange; do not add a new gesture |
| `lime` | ライム; topping / fruit | 2, `s` | green lime wedge → bright green crescent/wedge with pale segments | required | POST_BAKE tap/drag; distinct from yellow lemon and round green toppings |
| `liver-pate` | レバーパテ; **topping / meat** | 1, `m` | brown pâté ramekin/knife smear → one compact rose-brown quenelle/smear piece | required | PRE_BAKE tap/drag as one composite piece. This resolves the staged conflict: category `sauce` would make it a primary paint layer, remove it from piece scoring, and incorrectly create a SAUCE interaction. Existing taxonomy treats composite edible units as toppings and `family` is required; therefore meat is the consistent choice. It is not a spread mechanic. |
| `yogurt-sauce` | ヨーグルトソース; sauce / no family | 1, no size | white drizzle spiral → white cool drizzle/dab presence (`#f7f3e8` proposal) | dedicated swirl/dab strongly recommended for contrast | second sauce after tomato, represented by presence/dab rather than a second full `PAINT`; apply before salad FINISH. Shape/label must distinguish it from fromage-blanc and sour-cream because color alone cannot. |

Existing `cucumber`: きゅうり; topping / vegetable; recipe count 2; shipped size `s`; reuse its existing dedicated T24 visual and `HEAVY_SQUASH` tap/drag interaction unchanged. No new row, icon, SVG, family, shop pack, or ladder material is allowed for T25.

## 5. Ladder and late placement

- Keep `banh-mi-pizza` late despite having no POST_BAKE piece **only as an explicit one-recipe exception**. The reason is catalog sequencing/content grouping, not a hidden FINISH mechanic. Its cooking flow remains DOUGH→CHEESE→TOPPING→BAKE (or includes SAUCE only if a future separately approved base is chosen); do not fabricate a POST_BAKE step to justify late placement.
- Starting after the frozen 95 shipped steps, propose six credited insertions: **96 cauliflower → buffalo-cauliflower**, **97 kebab-sauce → swedish-kebab**, **98 yogurt-sauce → pizza-salad**, **99 daikon + liver-pate → banh-mi**, **100 lime → mexican-elote**, **101 asparagus → pizza-asparagi-limone**. This follows ordinary first, then late recipes in declared train order; exact REC-04 output must be re-measured by scaffold/plan before implementation.
- Simultaneous unlocks: step 98 unlocks only pizza-salad because cucumber is already owned; step 99 intentionally unlocks daikon and liver-pate together and then banh-mi. No other simultaneous recipe unlock is expected, but the implementation preflight must enumerate it rather than assume zero.
- Hint 5.0: keep the measured rung shapes. The paired-material banh-mi step is one acquisition event but yields separate ingredient facts. No key may appear in copy, and all recipes remain permanently key-free as proposed. Re-run `alphaFamilyOnly` after final families are authored; its measured report is not pre-approved by this packet.
- Do not add `chicken-tikka-pizza`, `chicken-tikka`, or a tikka/base rung. HOLD remains absolute.

## 6. Owner decision table

Owner should enter only `承認`, `却下`, or a concrete replacement value. Blank means unapproved.

| ID | target | choices | Codex recommendation | basis | impact scope | Owner decision |
|---|---|---|---|---|---|---|
| R-00 | canonical Research | require 0 / allow changes | require and approve 0 | fresh preflight invariant | all shipped labels | |
| R-01 | old 40 Research IDs | approve table / reject selected rows | approve all 40 individually as printed in §2 | same bounds as prior evidence, freshly remeasured | display-only Research letters | |
| R-41 | peking-duck / cucumber | approve max 1 / reject | approve max 1 | T24 cucumber reuse creates the new cohort | one shipped label | |
| R-42 | thai-chicken / cilantro | approve max 1 / reject | approve max 1 | T24 recipe creates the new cohort | one shipped label | |
| D-1 | salad vs bambino | exception / change recipe / reject | exception | strong FINISH and cool-salad identity | duplicate gate | |
| D-2 | cauliflower vs chicken | exception / change recipe / reject | narrow exception with floret-art condition | only ingredient swap; art carries identity | duplicate gate, art | |
| D-3 | asparagi vs quattro | exception / change recipe / reject | exception | FINISH + asparagus/lemon distinguish it | duplicate gate | |
| I-1 | asparagus | accept §4 / replace fields / reject | accept §4 | post-bake spear identity | ingredient, Reference, SVG | |
| I-2 | cauliflower | accept §4 / replace fields / reject | accept §4 | floret identity required for D-2 | ingredient, Reference, SVG | |
| I-3 | daikon | accept §4 / replace fields / reject | accept §4 | vegetable julienne piece | ingredient, Reference, SVG | |
| I-4 | kebab-sauce | accept orange PAINT / replace / reject | accept `#d86a35`, pre-bake PAINT | existing sauce interaction | sauce profile, Reference | |
| I-5 | lime | accept §4 / replace fields / reject | accept §4 | post-bake citrus wedge | ingredient, Reference, SVG | |
| I-6 | liver-pate | topping/meat / sauce / reject | **topping/meat, one composite piece** | existing category/family/scoring rules | recipe flow, taxonomy, Reference | |
| I-7 | yogurt-sauce | second presence/dab / second paint / reject | presence/dab `#f7f3e8`, **1 dab / 0.02 cap** | smallest existing visible, presence-valid atomic deposit; see independent I-7 spec | sauce profile, Reference, art | |
| I-8 | cucumber reuse | unchanged / alter shipped T24 asset | unchanged reuse | shipped T24 authority | no new ingredient/step | |
| L-1 | banh-mi late without POST_BAKE | exception / ordinary / reject | late exception | catalog placement only; no fake FINISH | ladder/catalog | |
| L-2 | proposed steps 96–101 | accept / reorder | accept subject to REC-04 remeasurement | ordinary-first, declared late order | ladder, floors, chapters | |
| L-3 | step 99 dual material | together / split | together | one recipe, both new, one acquisition event | ladder, shop, Hint | |
| H-1 | Hint 5.0 | measured rung shapes / redesign | keep measured shapes; remeasure family report | no new Hint mechanic | Hint goldens/reports | |
| T-1 | chicken-tikka | HOLD / resume | HOLD | base-spec conflict unresolved | excluded recipe/material | |

## 7. Implementation gate after Owner response

The next Codex session may implement only the rows explicitly approved above. It must normalize cucumber as reuse, encode the 42 exact Research pins and canonical-zero gate, run preflight→scaffold→plan→claims→apply→sweep in the documented order, keep the change docs/data/content-only (no new runtime mechanic), run typecheck/lint/full tests/generated E2E, request independent Codex review, and leave the PR Draft/HOLD. Merge, Production ON, and shared Preview remain prohibited.

## 8. Re-measurement against latest main (`dba7d733`)

Owner decision cells above remain blank. Latest-main measurements do not convert recommendations into approvals.

| area | latest-main result | Owner-table consequence |
|---|---|---|
| Train Kit fix #854 | `src/trainKit` + `src/contentTrain` + Batch 24 focused suite: 66 passed, 7 skipped; the prior anchor/mutation failures no longer reproduce | verification evidence refreshed; no Owner choice removed |
| normalized R2c preflight | READY 0 / NEEDS_OWNER 6 / BLOCKED 0; canonical 0; non-canonical 42 | R-00, R-01, R-41, R-42 and all recipe Owner findings still require decisions |
| Duplicate Gate | same three hits: salad/bambino 0.429; cauliflower/chicken ONE_DIFF 0.6; asparagi/quattro 0.429 | D-1 through D-3 still require decisions |
| cucumber | shipped on main; unchanged reuse after removal from only the validation copy's `newIngredients` | I-8 still requires confirmation; implementation input must be normalized |
| I-7 yogurt | current runtime proves one starter dab is 0.02 and already presence-valid | I-7 now has a measured cap proposal; Owner must approve/reject/replace it |
| master ledger generator | latest main still fails the two `diavola-pizza-pizzadb-p5` alias reconciliation checks; PR #853 contains the docs-generator fix but it is not on main | ledger rows and generated verification must be regenerated after integrating/reapplying the docs-generator fix; do not approve stale generated artifacts |
| ladder / REC-04 / Hint family report | not derivable until approved authored values are converted to the implementation spec | L-2, L-3, H-1 require fresh post-approval measurement |

Independent I-7 specification: `docs/reports/TETO_T25-I7_YOGURT-SAUCE_PRESENCE-DAB_SPEC_2026-11-15.md`.
