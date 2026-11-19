/**
 * Geometry types of the placed parmigiano (Topping Visuals 2.0, Issues #824 / #825). A plain data module so the drawing component file exports only a component.
 *
 * Freshly shaved Parmigiano Reggiano is not grains or leaves: it is thin, flat, irregular flakes of different sizes -- broad ragged flakes, a few long thin ribbons
 * that curl a little, and tiny crumbs -- ivory and slightly translucent where they are thinnest. Three kinds are drawn:
 *   flake    a broad irregular flake (width 50..80% of its length);
 *   ribbon   a long thin ribbon with a slight bend (a curl seen from above);
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
  /** Ribbon bend as a fraction of the length (signed); 0 for flakes and fragments. */
  readonly bend: number;
  /** Which of the three ivory fills the top face uses. */
  readonly fill: 0 | 1 | 2;
  /** Radial factors (about 0.8..1.2) of the flake / fragment outline vertices; empty for ribbons. They make every silhouette different. */
  readonly verts: readonly number[];
}
