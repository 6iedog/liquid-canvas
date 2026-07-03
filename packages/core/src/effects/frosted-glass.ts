import type { GlassEffectPlugin } from "../types"

/**
 * Frosted Glass shader — SDF-based frosted glass panel.
 *
 * Uses the same rounded-rect SDF as liquid-glass, but WITHOUT refraction.
 * Only does: Gaussian blur + saturation + cool tint + edge highlight + vignette.
 */

const FRAGMENT_SHADER = `precision highp float;

varying vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_hover;
uniform float u_borderRadius;

uniform float u_blur;
uniform float u_edgeHighlight;

/* ---- Rounded rectangle SDF ---- */
float roundedRectDistance(vec2 coord, vec2 size, float radius) {
  vec2 center = size * 0.5;
  vec2 pixelCoord = coord * size;
  vec2 toCorner = abs(pixelCoord - center) - (center - radius);
  float outsideCorner = length(max(toCorner, 0.0));
  float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
  return outsideCorner + insideCorner - radius;
}

void main() {
  vec2 coord = v_texCoord;
  vec2 texel = 1.0 / u_resolution;

  /* --- Gaussian blur (13x13 circular) --- */
  float blurRadius = u_blur * 8.0;
  float sigma = max(blurRadius, 0.5);
  vec4 color = vec4(0.0);
  float totalWeight = 0.0;

  for (float i = -6.0; i <= 6.0; i += 1.0) {
    for (float j = -6.0; j <= 6.0; j += 1.0) {
      float dist = length(vec2(i, j));
      if (dist > 6.0) continue;
      float w = exp(-(dist * dist) / (2.0 * sigma * sigma));
      vec2 offset = vec2(i, j) * texel * sigma * 0.3;
      color += texture2D(u_texture, clamp(coord + offset, 0.0, 1.0)) * w;
      totalWeight += w;
    }
  }
  color /= totalWeight;

  /* --- Saturation boost --- */
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, 1.25);

  /* --- Cool tint --- */
  vec3 tint = vec3(0.93, 0.96, 1.03);
  color.rgb = mix(color.rgb, color.rgb * tint, 0.18);

  /* --- Edge distance for highlights (keep raw sdf for alpha) --- */
  float rawSdf = roundedRectDistance(coord, u_resolution, u_borderRadius);
  float distFromEdgeShape = max(-rawSdf, 0.0);
  float minDim = min(u_resolution.x, u_resolution.y);
  float normalizedDistance = distFromEdgeShape / minDim * minDim;

  /* --- Top gradient highlight --- */
  float topGrad = smoothstep(0.5, 0.0, coord.y) * u_edgeHighlight * 0.3;
  color.rgb += vec3(0.88, 0.92, 1.0) * topGrad;

  /* --- Rim light --- */
  float rim = exp(-normalizedDistance * 0.2) * u_edgeHighlight;
  color.rgb += vec3(1.0) * rim * 0.4;

  /* --- Vignette (non-zero floor to avoid black edge) --- */
  float vignette = mix(0.92, 1.0, smoothstep(0.0, 3.0, distFromEdgeShape));
  color.rgb *= vignette;

  /* --- Alpha: SDF anti-aliased (outside rounded rect = transparent) --- */
  float alpha = smoothstep(1.0, -1.0, rawSdf);

  gl_FragColor = vec4(color.rgb, alpha);
}
`

export const frostredGlass: GlassEffectPlugin = {
  id: "frosted-glass",
  name: "Frosted Glass",
  getFragmentShader: () => FRAGMENT_SHADER,
  getDefaultUniforms: () => ({
    u_blur: 0.5,
    u_edgeHighlight: 0.08,
  }),
  getControls: () => [
    { key: "blur", label: "Blur", type: "slider", min: 0, max: 1, step: 0.01, default: 0.5 },
    {
      key: "edgeHighlight",
      label: "Edge Highlight",
      type: "slider",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.08,
    },
  ],
  getSVGFilter: () => ({
    id: "frosted-glass-fallback",
    filter: `<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" type="saturate" values="1.8"/>
      <feComponentTransfer>
        <feFuncR type="linear" slope="0.9" intercept="0.05"/>
        <feFuncG type="linear" slope="0.92" intercept="0.05"/>
        <feFuncB type="linear" slope="0.95" intercept="0.05"/>
      </feComponentTransfer>`,
  }),
  updateUniforms: (gl, program, uniforms, _time, _mouse): void => {
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc !== null) gl.uniform1f(loc, value)
    }
  },
}
