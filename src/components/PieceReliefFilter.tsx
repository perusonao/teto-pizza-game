/**
 * Issue #418 (OD-418-D2 pilot): the cut-face look for a pizza parted into pieces. One SVG lighting
 * filter applied to the whole set of pieces: the pieces' own alpha is the height map, lit from the
 * upper left, so every piece edge -- whatever direction the seam runs -- gets a lit side and a
 * shaded side, instead of a flat gap. Pure presentation; reads nothing from cut/game state.
 *
 * Built so a flat surface is left exactly as it is: the diffuse term is normalised to 1 on flat
 * ground (constant = 1 / sin(elevation)), is only ever allowed to darken (softened, never black),
 * and the specular term uses a high exponent so it only fires on the lit edge slope, not on flat
 * ground.
 */
import {
  BLUR_PX,
  LIGHT_AZIMUTH,
  LIGHT_ELEVATION,
  SHADE_FLOOR,
  SPECULAR_CONSTANT,
  SPECULAR_EXPONENT,
  SURFACE_HEIGHT,
} from "./pieceRelief";

export function PieceReliefFilter({ id, scale }: { id: string; scale: number }) {
  const rad = (LIGHT_ELEVATION * Math.PI) / 180;
  const height = SURFACE_HEIGHT * scale;
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" data-piece-relief>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation={BLUR_PX * scale} result="height" />
          <feDiffuseLighting
            in="height"
            surfaceScale={height}
            diffuseConstant={1 / Math.sin(rad)}
            lightingColor="#ffffff"
            result="diffuse"
          >
            <feDistantLight azimuth={LIGHT_AZIMUTH} elevation={LIGHT_ELEVATION} />
          </feDiffuseLighting>
          <feComponentTransfer in="diffuse" result="soft">
            <feFuncR type="linear" slope={1 - SHADE_FLOOR} intercept={SHADE_FLOOR} />
            <feFuncG type="linear" slope={1 - SHADE_FLOOR} intercept={SHADE_FLOOR} />
            <feFuncB type="linear" slope={1 - SHADE_FLOOR} intercept={SHADE_FLOOR} />
          </feComponentTransfer>
          <feComposite in="soft" in2="SourceAlpha" operator="in" result="softIn" />
          <feBlend in="SourceGraphic" in2="softIn" mode="multiply" result="shaded" />
          <feSpecularLighting
            in="height"
            surfaceScale={height}
            specularConstant={SPECULAR_CONSTANT}
            specularExponent={SPECULAR_EXPONENT}
            lightingColor="#fff4d6"
            result="specular"
          >
            <feDistantLight azimuth={LIGHT_AZIMUTH} elevation={LIGHT_ELEVATION} />
          </feSpecularLighting>
          <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularIn" />
          <feComposite in="shaded" in2="specularIn" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
  );
}
