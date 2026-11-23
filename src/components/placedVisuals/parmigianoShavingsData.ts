/**
 * Geometry types of the placed parmigiano (Topping Visuals 2.0, Issues #824 / #825). A plain data module so the drawing component file exports only a component.
 *
 * Freshly shaved Parmigiano Reggiano is not grains or leaves: it is thin, flat, irregular flakes of different sizes -- broad ragged flakes, a few long thin ribbons
 * that curl a little, and tiny crumbs -- ivory and slightly translucent where they are thinnest. Three kinds are drawn:
 *   flake    a broad irregular flake (width 50..80% of its length);
 *   ribbon   a longer thin shaving whose width changes along its length (a strip, not a crescent: only a slight bend and an uneven outline);
 *   fragment a small crumb.
 */
export type ParmigianoShavingKind = "flake" | "ribbon" | "fragment";

export interface ParmigianoShaving {
  readonly kind: ParmigianoShavingKind;
  /** Centre in the 64x64 viewBox. */
  readonly cx: number;
  readonly cy: number;
  /** Length along the shaving's own axis and its widest width, in viewBox units. */
  readonly len: number;
  readonly wid: number;
  /** Rotation in degrees. */
  readonly angle: number;
  /** Ribbon bend as a fraction of the length (signed, small); 0 for flakes and fragments. */
  readonly bend: number;
  /** Ribbon only: a slow S-shaped wander of the centre line as a fraction of the length (signed); 0 otherwise. */
  readonly wobble: number;
  /** Ribbon only: ten width factors (five along the upper edge, five along the lower), so the strip is wider in one place and narrower in another; empty otherwise. */
  readonly profile: readonly number[];
  /** 0..1: how strong the outline and the shadow are (thin shavings have a fainter edge). */
  readonly edge: number;
  /** Scale (about 0.45..0.7) of the lighter, more opaque core inside a flake. */
  readonly core: number;
  /** Which of the three ivory fills the top face uses. */
  readonly fill: 0 | 1 | 2;
  /** Radial factors (about 0.8..1.2) of the flake / fragment outline vertices; empty for ribbons. They make every silhouette different. */
  readonly verts: readonly number[];
}

/**
 * How a shaving is PAINTED (V9 trial F2 / V10-1; the layout is not touched): the opacity of the ivory fill, the strength of the warm outline and of the contact shadow, whether a flake
 * carries the lighter core and the grain line, and (V10-1) a small blur of the whole drawing. `LOOK_DEFAULT` is the drawing of rev. 6 / V8-1.
 */
export interface SprinkleLook {
  readonly fillOpacity: number;
  readonly outlineScale: number;
  readonly shadowScale: number;
  readonly core: boolean;
  readonly grain: boolean;
  /** V10-1 trial: Gaussian blur of the whole drawing in CSS px (the soft-edge trial); 0 = none, and then the svg carries no `style` at all. */
  readonly edgeBlur: number;
}
export const LOOK_DEFAULT: SprinkleLook = { fillOpacity: 0.8, outlineScale: 1, shadowScale: 1, core: true, grain: true, edgeBlur: 0 };
