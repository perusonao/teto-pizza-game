# Ingredient Icons 2.0 — Pilot design contract

Status: Issue #417 Phase 1 authority for the ten-material pilot. Owner direction: unified SVG icons, gradual migration, and no OS-emoji dependency for migrated ingredients. This contract narrows and updates the applicable rules in [`TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`](./TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md); adopted art already in production remains unchanged.

Evidence: Issue #417 and playtest session 12, comment 7199433450 (2026-11-26). The comment identifies the red poisonous-mushroom appearance as the worst ambiguity and also records recurring red, green, and cheese confusion groups.

## Scope and invariants

Pilot IDs: `tomato-sauce`, `mozzarella`, `basil`, `bacon`, `mushroom`, `salmon`, `ricotta`, `hot-dog`, `pineapple`, `olive-oil`.

The icon is identification UI for Shop, Cooking Tray, Research, Hint, Notebook, RESULT ingredient list, and Dex. Pizza-surface topping rendering belongs to #824 and is not changed by this pilot. Ingredient IDs, recipe data, prices, inventory, progression, Research authority/privacy, and save schema are not icon concerns and must remain unchanged.

The rendering boundary remains `IngredientGlyph`: `ingredient.pieceVisual -> dedicated SVG`; an ingredient without `pieceVisual` renders its existing `emoji`. This permits migrated and unmigrated materials to coexist. Emoji values remain only as text/data fallback and are not rendered for a migrated ingredient.

## Geometry and drawing language

- Canvas: `viewBox="0 0 64 64"`; transparent background; no enclosing tile.
- Nominal display: 32–48 px. Minimum verification: 24 px. Tray/Shop hit targets remain at least 44 px and are not sized by the SVG.
- Safe art area: normally x/y 5–59, with a single low-opacity ground shadow allowed near y 54–60. Important silhouette features must remain visible at 24 px.
- Outline: rounded joins/caps; 2.4 px nominal, 2.0 px minimum for secondary boundaries. Use one dark, ingredient-related outline color rather than pure black.
- Fill: two or three flat tones plus at most one highlight. No gradients, filters, masks, embedded raster images, text, or details under roughly 2 px at 64 px.
- Corners: organic food shapes use rounded joins. Deliberate cut faces (cheese blocks, bacon ends) may be sharper when that geometry is the identifier.
- Reuse safety: no SVG `id`, `<defs>`, or `url(#...)`; any number of copies may share a page.
- Existing adopted SVGs take precedence over restyling. New pilot art must match their heavy outline, restrained shading, and light ground shadow.

## State ownership

The SVG describes only the ingredient. UI containers own states so every icon stays reusable:

| State | Contract |
|---|---|
| NEW | badge outside the SVG; never burn text/starbursts into art |
| locked | preserve the anonymous/secret UI; when identity is allowed, container applies lock treatment, not alternate ingredient art |
| disabled / unavailable | container opacity/filter and disabled semantics; silhouette remains recognizable |
| selected | container border/background/check treatment; do not recolor the food |
| hover / pressed | container feedback only; no identity-changing SVG swap |

Research privacy wins over visual consistency: an undiscovered ingredient or recipe must not receive a glyph if the current projection withholds its identity. The pilot only replaces already-authorized ingredient render sites.

## Family and accessibility

Family is secondary metadata. If a screen needs it, use the existing labeled filter/tab or a separate UI badge. Never force a family color onto the ingredient body, and do not add family marks inside the SVG.

All glyph SVGs are decorative (`aria-hidden="true"`, `focusable="false"`). The adjacent Japanese ingredient name, control accessible name, or existing authorized text remains the accessible identity. Color is never the only discriminator.

## Discrimination rules

- Mushroom: a brown/beige edible button-mushroom cluster, with broad caps, pale gills/stems, and no red cap or white poison spots.
- Hot-dog vs sausage: the identification icon is a side-view long sausage in a rounded bun with a mustard zigzag; sausage remains two irregular coarse-cut pieces with visible fat/grain. Silhouette, orientation, texture, and value all differ. The completed-pizza hot-dog pieces remain the existing three smooth rounds.
- Cheese system: silhouette is the primary key. Mozzarella is a tied whole ball; ricotta is a granular mound. Future parmigiano remains a jagged aged-cheese chunk, so it cannot collapse into either white silhouette.
- Red group: sauce uses a bowl/pool and spoon-like smear cue; tomato uses seeded slice anatomy; pepperoni uses compact cured-meat discs with fat flecks. Shape and internal structure must work before hue.
- Green group: basil uses two large veined leaves; capers remain round buds; oregano remains a loose flake pile. Leaf / bud / flake silhouettes must remain distinct in grayscale.
- Olive oil: bottle plus golden oil/drop cue, not an OS jar glyph and not a plain yellow circle.
- Bacon: two long waved striped rashers, not round red pieces.

## Pilot acceptance

1. Each pilot ID resolves to dedicated 64×64 SVG art through `pieceVisual`; no pilot UI renders an OS emoji.
2. At 24 px, mushroom reads as edible, hot-dog and sausage remain distinct, and mozzarella and ricotta remain distinct without relying only on color.
3. Shop, Tray, Research, Hint/Notebook, RESULT list, and Dex use the shared renderer where identity is authorized.
4. Unmigrated ingredients still render the pre-existing fallback with unchanged layout and behavior.
5. 390×844 and 360×800 before/after evidence covers the required UI surfaces; no horizontal overflow or reduced tap target is introduced.
6. Existing privacy, save, progression, economy, recipe, and finished-pizza rendering tests remain unchanged unless a test specifically pins the former pilot glyph markup. Any such pin update must be documented in the PR.

Owner HV remains the gate for expansion beyond this ten-material pilot. Automated screenshots and tests are evidence, not an Owner PASS.
