/** Constants and CSS for the cut-face relief filter (see PieceReliefFilter.tsx). Pure presentation. */
export const LIGHT_AZIMUTH = 225; // light from the upper left (y points down)
export const LIGHT_ELEVATION = 50;
/** Relief at the full stage size (CSS px of blur / unitless height); both scale with `scale`. */
export const BLUR_PX = 1.1;
export const SURFACE_HEIGHT = 1.6;
/** Edge shading keeps this share of the surface colour at worst (never black). */
export const SHADE_FLOOR = 0.25;
export const SPECULAR_CONSTANT = 0.6;
export const SPECULAR_EXPONENT = 128;
/** The RESULT pizza is drawn at roughly this fraction of the stage pizza; the relief scales with it. */
export const RESULT_RELIEF_SCALE = 0.55;

export function pieceReliefFilterCss(id: string, scale: number): string {
  const px = (n: number) => `${(n * scale).toFixed(2)}px`;
  return `url(#${id}) drop-shadow(${px(1)} ${px(1.5)} ${px(2)} rgba(40, 18, 6, 0.35))`;
}

