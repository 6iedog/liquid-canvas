import { createLogger } from "../log"
import type { GlassAdapter, GlassOptions } from "../types"

type OriginalStyleSnapshot = Partial<CSSStyleDeclaration> & {
  WebkitBackdropFilter?: string
}

/**
 * CSS Adapter — SVG + CSS fallback.
 *
 * - frosted-glass: pure CSS `backdrop-filter: blur() saturate()` + tint
 * - liquid-glass: SVG displacement map on `backdrop-filter: url(#...)`
 *   (follows shuding/liquid-glass approach: generates a displacement map
 *   canvas from a rounded-rect SDF, applies via feDisplacementMap so only
 *   the backdrop is refracted — foreground content stays untouched)
 */

function smoothStep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

/** Rounded rectangle SDF — negative inside, positive outside */
function roundedRectSDF(x: number, y: number, w: number, h: number, r: number): number {
  const qx = Math.abs(x) - w + r
  const qy = Math.abs(y) - h + r
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - r
}

let liquidGlassFilterId: string | null = null

/**
 * Generate the SVG displacement map for liquid glass refraction.
 * Creates a hidden SVG with feImage + feDisplacementMap, and a canvas
 * that encodes the refraction offsets as R (dx) and G (dy) channels.
 */
function ensureLiquidGlassFilter(width: number, height: number, borderRadius: number): string {
  const id = "liquid-glass-css-displacement"

  /* Remove old SVG if exists */
  const oldSvg = document.getElementById(id)
  if (oldSvg) oldSvg.remove()

  /* Generate displacement map canvas */
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const w = width
  const h = height
  const r = Math.min(borderRadius, Math.min(w, h) / 2)
  const data = new Uint8ClampedArray(w * h * 4)
  const rawValues: number[] = []
  let maxScale = 0

  /* Compute displacement for each pixel using SDF */
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ix = x / w - 0.5
      const iy = y / h - 0.5

      /* SDF in normalized space (half-extents = 0.5) */
      const sx = ix * 2
      const sy = iy * 2
      const dist = roundedRectSDF(sx, sy, 1, 1, (r / w) * 2)

      /* Displacement: stronger near edges */
      const displacement = smoothStep(0.8, 0, dist - 0.15)
      const scaled = smoothStep(0, 1, displacement)

      /* Target UV after refraction */
      const targetX = ix * scaled + 0.5
      const targetY = iy * scaled + 0.5

      /* Delta in pixels */
      const dx = targetX * w - x
      const dy = targetY * h - y
      rawValues.push(dx, dy)
      maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
    }
  }

  maxScale *= 0.5
  if (maxScale < 1) maxScale = 1

  /* Encode to RGBA: R = dx, G = dy (normalized to 0-255) */
  let idx = 0
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (rawValues[idx++] / maxScale + 0.5) * 255
    data[i + 1] = (rawValues[idx++] / maxScale + 0.5) * 255
    data[i + 2] = 0
    data[i + 3] = 255
  }

  ctx.putImageData(new ImageData(data, w, h), 0, 0)

  /* Create SVG with filter */
  const svgNS = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(svgNS, "svg") as unknown as SVGSVGElement
  svg.id = id
  svg.style.cssText = "display:none;position:absolute;width:0;height:0"

  const defs = document.createElementNS(svgNS, "defs")
  const filter = document.createElementNS(svgNS, "filter")
  filter.id = `${id}-filter`
  filter.setAttribute("filterUnits", "userSpaceOnUse")
  filter.setAttribute("colorInterpolationFilters", "sRGB")
  filter.setAttribute("x", "0")
  filter.setAttribute("y", "0")
  filter.setAttribute("width", w.toString())
  filter.setAttribute("height", h.toString())

  const feImage = document.createElementNS(svgNS, "feImage")
  feImage.id = `${id}-map`
  feImage.setAttribute("width", w.toString())
  feImage.setAttribute("height", h.toString())
  feImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", canvas.toDataURL())

  const feDisplacement = document.createElementNS(svgNS, "feDisplacementMap")
  feDisplacement.setAttribute("in", "SourceGraphic")
  feDisplacement.setAttribute("in2", `${id}-map`)
  feDisplacement.setAttribute("xChannelSelector", "R")
  feDisplacement.setAttribute("yChannelSelector", "G")
  feDisplacement.setAttribute("scale", maxScale.toString())

  filter.appendChild(feImage)
  filter.appendChild(feDisplacement)
  defs.appendChild(filter)
  svg.appendChild(defs)
  document.body.appendChild(svg)

  liquidGlassFilterId = `${id}-filter`
  return liquidGlassFilterId
}

export class CSSAdapter implements GlassAdapter {
  readonly type = "css" as const
  private target: HTMLElement | null = null
  private options!: GlassOptions
  private svgElement: HTMLElement | null = null
  private originalStyles: OriginalStyleSnapshot = {}
  private _fps = 0
  private log!: ReturnType<typeof createLogger>
  private resizeObserver: ResizeObserver | null = null

  get fps(): number {
    return this._fps
  }

  async init(target: HTMLElement, options: GlassOptions): Promise<void> {
    this.target = target
    this.options = options
    this.log = createLogger(!!options.debug, "CSSAdapter")
    this.log.log(`applying CSS+SVG glass to #${target.id || target.className || "?"}`)
    this.applyStyles()

    /* Re-generate displacement map on resize (liquid-glass only) */
    this.resizeObserver = new ResizeObserver(() => {
      if (this.options.effect === "liquid-glass") {
        this.applyStyles()
      }
    })
    this.resizeObserver.observe(target)
  }

  render(_time: number): void {}

  setOptions(options: Partial<GlassOptions>): void {
    Object.assign(this.options, options)
    if (this.target) {
      this.applyStyles()
    }
  }

  markChanged(): void {}

  dispose(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
    if (this.target) {
      for (const [key, value] of Object.entries(this.originalStyles)) {
        if (value !== undefined) {
          ;(this.target.style as any)[key] = value
        }
      }
    }
    if (this.svgElement) {
      this.svgElement.remove()
      this.svgElement = null
    }
    /* Clean up liquid glass SVG if present */
    const lgSvg = document.getElementById("liquid-glass-css-displacement")
    if (lgSvg) lgSvg.remove()
    liquidGlassFilterId = null
    this.target = null
  }

  private applyStyles(): void {
    if (!this.target) return

    const el = this.target
    const o = this.options
    const isLiquid = o.effect === "liquid-glass"

    /* Snapshot original styles once */
    if (Object.keys(this.originalStyles).length === 0) {
      this.originalStyles = {
        backdropFilter: el.style.backdropFilter,
        WebkitBackdropFilter: (el.style as any).WebkitBackdropFilter,
        background: el.style.background,
        backgroundColor: el.style.backgroundColor,
        borderRadius: el.style.borderRadius,
        boxShadow: el.style.boxShadow,
        filter: el.style.filter,
        border: el.style.border,
      }
    }

    const blurPx = 10 + o.blur * 18
    const saturation = isLiquid ? 220 : 180
    const alpha = isLiquid ? 0.14 + o.tintStrength * 0.12 : 0.12 + o.tintStrength * 0.2
    const tint = isLiquid
      ? `linear-gradient(180deg, rgba(255,255,255,${alpha + 0.05}) 0%, rgba(180,205,255,${alpha}) 100%)`
      : `rgba(255,255,255,${alpha})`

    el.style.background = tint
    el.style.backgroundColor = isLiquid ? "rgba(255,255,255,0.08)" : `rgba(255,255,255,${alpha})`
    el.style.borderRadius = `${o.cornerRadius}px`
    el.style.border = `1px solid rgba(255,255,255,${isLiquid ? 0.22 : 0.16})`
    el.style.boxShadow = isLiquid
      ? `inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -12px 24px rgba(130,160,255,0.10), 0 ${o.shadowOpacity * 10}px ${o.shadowOpacity * 30}px rgba(0,0,0,0.22)`
      : `inset 0 1px 0 rgba(255,255,255,0.28), 0 ${o.shadowOpacity * 8}px ${o.shadowOpacity * 24}px rgba(0,0,0,0.2)`

    if (isLiquid) {
      /* --- Liquid Glass: SVG displacement on backdrop-filter --- */
      const rect = el.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      const filterId = ensureLiquidGlassFilter(w, h, o.cornerRadius)

      if (filterId) {
        /* backdrop-filter: displacement + blur + contrast + brightness + saturate
           This applies the refraction to the BACKDROP only, not the content */
        el.style.backdropFilter = `url(#${filterId}) blur(${blurPx * 0.3}px) contrast(1.15) brightness(1.05) saturate(1.1)`
        ;(el.style as any).WebkitBackdropFilter = `blur(${blurPx * 0.3}px) saturate(${saturation}%)`
        /* Note: Safari doesn't support url() in backdrop-filter, so WebkitBackdropFilter
           falls back to plain blur. The displacement only works in Chrome/Firefox. */
      } else {
        el.style.backdropFilter = `blur(${blurPx}px) saturate(${saturation}%)`
        ;(el.style as any).WebkitBackdropFilter = `blur(${blurPx}px) saturate(${saturation}%)`
      }
      /* Don't use filter: url() — that would distort the content too */
      el.style.filter = ""
    } else {
      /* --- Frosted Glass: pure CSS backdrop-filter --- */
      el.style.backdropFilter = `blur(${blurPx}px) saturate(${saturation}%)`
      ;(el.style as any).WebkitBackdropFilter = `blur(${blurPx}px) saturate(${saturation}%)`
      el.style.filter = ""
    }
  }
}
