import type { GlassEffectPlugin } from "../types"

/**
 * Liquid Glass shader — optical-glass simulation distinct from frosted glass.
 *
 * Design goals (vs. frosted-glass):
 *  - Visible refraction that follows the rounded-rect edge (NOT a circular lens)
 *  - Visible chromatic aberration (RGB split) concentrated at the edge band
 *  - Fresnel edge glow (bright rim at grazing angles)
 *  - Specular highlight (top band + mouse-following hotspot)
 *
 * All displacement magnitudes are expressed in PIXELS then converted to UV
 * via texel = 1/u_resolution. This keeps behaviour resolution-independent.
 *
 * Edge concentration: an `edgeProximity` term (1 at the rounded-rect edge,
 * decaying inward over ~25px) localises refraction/chromatic/fresnel to a
 * thin rim — preventing the "circular lens" artifact while still being
 * clearly liquid-glass.
 */

const FRAGMENT_SHADER = `precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_hover;
uniform float u_borderRadius;

uniform float u_refraction;
uniform float u_blur;
uniform float u_chromatic;
uniform float u_edgeHighlight;
uniform float u_specular;
uniform float u_fresnel;

/* ---- Rounded rectangle SDF (negative inside, positive outside) ---- */
float roundedRectSDF(vec2 uv, vec2 size, float radius) {
  vec2 center = size * 0.5;
  vec2 p = uv * size - center;
  vec2 q = abs(p) - (center - radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 coord = v_texCoord;
  vec2 texel = 1.0 / u_resolution;

  /* --- SDF: negative inside, positive outside --- */
  float sdf = roundedRectSDF(coord, u_resolution, u_borderRadius);
  float distInside = max(-sdf, 0.0);  // pixels from edge (inside only)

  /* --- Outward normal from center to current pixel --- */
  vec2 center = vec2(0.5, 0.5);
  vec2 shapeNormal = normalize(coord - center + 1e-6);

  /* --- Edge proximity: 1 at edge, decays inward over ~25px --- *
   * This localises liquid-glass signatures (refraction / chroma /  *
   * fresnel) to a thin rim so the panel does NOT become a circular *
   * lens, but still looks distinctly different from frosted glass. */
  float edgeBandPx = 25.0;
  float edgeProximity = exp(-distInside / edgeBandPx);

  /* ================ REFRACTION ================ *
   * Strong outward displacement at the edge band *
   * + subtle center warp for "liquid" feel.      */
  float edgeRefractPx = edgeProximity * u_refraction * 15.0;
  float centerWarpPx  = (1.0 - edgeProximity) * u_refraction * 3.0;
  float refractPx     = edgeRefractPx + centerWarpPx;
  vec2  refractionOffset = shapeNormal * refractPx * texel;
  vec2  sampleCoord = clamp(coord + refractionOffset, 0.0, 1.0);

  /* ================ CHROMATIC ABERRATION ================ *
   * RGB split concentrated at the edge band.              *
   * u_chromatic in [0, 0.15] -> 0..18px split at edge.    */
  float chromPx = edgeProximity * u_chromatic * 120.0;
  vec2  chromOffset = shapeNormal * chromPx * texel;

  /* ================ BLUR + CHROMA (13-tap circular Gaussian) ================ *
   * Single pass: sample R/G/B with their respective chromatic offsets so the  *
   * RGB split survives blurring.                                              */
  float blurRadius = u_blur * 6.0;
  float sigma = max(blurRadius, 0.5);
  vec3  finalColor = vec3(0.0);
  float totalWeight = 0.0;

  for (float i = -6.0; i <= 6.0; i += 1.0) {
    for (float j = -6.0; j <= 6.0; j += 1.0) {
      float d = length(vec2(i, j));
      if (d > 6.0) continue;
      float w = exp(-(d * d) / (2.0 * sigma * sigma));
      vec2 offset = vec2(i, j) * texel * sigma * 0.3;
      finalColor.r += texture2D(u_texture, clamp(sampleCoord + chromOffset + offset, 0.0, 1.0)).r * w;
      finalColor.g += texture2D(u_texture, clamp(sampleCoord + offset, 0.0, 1.0)).g * w;
      finalColor.b += texture2D(u_texture, clamp(sampleCoord - chromOffset + offset, 0.0, 1.0)).b * w;
      totalWeight += w;
    }
  }
  finalColor /= totalWeight;

  /* ================ TINT (subtle cool glass) ================ */
  vec3 tint = vec3(0.92, 0.95, 1.02);
  finalColor = mix(finalColor, finalColor * tint, 0.15);

  /* ================ FRESNEL ================ *
   * Edge glow whose intensity follows edge proximity (a 2D proxy for    *
   * grazing angle). pow(..., 2.5) keeps it tight to the rim so the      *
   * center stays clear. u_fresnel in [0, 2] gives 0..1.0 rim brightness. */
  float fresnelTerm  = pow(edgeProximity, 2.5);
  float fresnelGlow  = fresnelTerm * u_fresnel;
  finalColor += vec3(0.85, 0.92, 1.0) * fresnelGlow * 0.5;

  /* ================ SPECULAR ================ *
   * Bright top highlight band + mouse-following hotspot. */
  float topBand = exp(-coord.y * u_resolution.y / 40.0);
  float topSpec = topBand * u_specular * 0.4;
  vec2  mousePx = (coord - u_mouse) * u_resolution;
  float mouseDist2 = dot(mousePx, mousePx);
  float mouseSpec = exp(-mouseDist2 / 1600.0) * u_hover * u_specular * 0.6;
  finalColor += vec3(1.0, 0.98, 0.95) * (topSpec + mouseSpec);

  /* ================ EDGE HIGHLIGHT (rim line + top gradient) ================ */
  float rim = exp(-distInside / 3.0) * u_edgeHighlight;
  finalColor += vec3(1.0, 0.98, 0.95) * rim * 0.6;

  float topGrad = smoothstep(0.5, 0.0, coord.y) * u_edgeHighlight * 0.2;
  finalColor += vec3(0.9, 0.93, 1.0) * topGrad;

  /* ================ VIGNETTE (non-zero floor to avoid black edge) ================ */
  float vignette = mix(0.92, 1.0, smoothstep(0.0, 3.0, distInside));
  finalColor *= vignette;

  /* ================ ALPHA (SDF anti-aliased) ================ *
   * Outside the rounded rect: alpha = 0 (transparent, shows card bg).   *
   * Inside: alpha = 1. 1px smooth transition at the edge prevents jaggies. */
  float alpha = smoothstep(1.0, -1.0, sdf);

  gl_FragColor = vec4(finalColor, alpha);
}
`

export const liquidGlass: GlassEffectPlugin = {
  id: "liquid-glass",
  name: "Liquid Glass",
  getFragmentShader: () => FRAGMENT_SHADER,
  getSVGFilter: () => ({
    id: "liquid-glass-fallback",
    filter: `<feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="92" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="50" xChannelSelector="R" yChannelSelector="G"/>`,
  }),
  getDefaultUniforms: () => ({
    u_refraction: 0.6,
    u_blur: 0.3,
    u_chromatic: 0.04,
    u_edgeHighlight: 0.08,
    u_specular: 0.15,
    u_fresnel: 1.0,
  }),
  getControls: () => [
    {
      key: "refraction",
      label: "Refraction",
      type: "slider",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.6,
    },
    { key: "blur", label: "Blur", type: "slider", min: 0, max: 1, step: 0.01, default: 0.3 },
    {
      key: "chromaticAberration",
      label: "Chromatic Aberration",
      type: "slider",
      min: 0,
      max: 0.1,
      step: 0.001,
      default: 0.04,
    },
    {
      key: "edgeHighlight",
      label: "Edge Highlight",
      type: "slider",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.08,
    },
    {
      key: "specular",
      label: "Specular",
      type: "slider",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.15,
    },
    {
      key: "fresnel",
      label: "Fresnel",
      type: "slider",
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.0,
    },
  ],
  updateUniforms: (
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Record<string, number>,
    _time: number,
    _mouse: { x: number; y: number; hovering: boolean },
  ): void => {
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc !== null) {
        gl.uniform1f(loc, value)
      }
    }
  },
}
