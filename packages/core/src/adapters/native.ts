import { createLogger } from "../log"
import { registry } from "../plugin"
import type { GlassAdapter, GlassOptions } from "../types"

/**
 * Native Adapter — uses HTML-in-Canvas API.
 *
 * Per the official API (html-in-canvas.dev/docs/api-reference/):
 *
 *  - `<canvas layoutsubtree>` opts canvas children into layout
 *  - `drawElementImage(element, ...)` renders a canvas child to 2D context
 *    (element MUST be a direct child of the canvas)
 *  - `texElementImage2D(target, level, internalformat, format, type, element)`
 *    uploads a canvas child directly as a WebGL texture (no 2D intermediate)
 *  - `onpaint` fires when child rendering changes
 *  - `requestPaint()` forces a paint event
 *
 * Architecture:
 *
 *  1. A hidden <canvas layoutsubtree> contains a child div that replicates
 *     the page background behind the target card (same bg-image, positioned
 *     to show the card's region).
 *  2. `onpaint` callback uses `texElementImage2D` (preferred) or
 *     `drawElementImage` + `texImage2D` (fallback) to get the child into WebGL.
 *  3. A glass shader runs on an overlay canvas on top of the card.
 */

function hasDrawElementImage(ctx: CanvasRenderingContext2D): boolean {
  return typeof (ctx as any).drawElementImage === "function"
}

function hasTexElementImage2D(gl: WebGLRenderingContext): boolean {
  return typeof (gl as any).texElementImage2D === "function"
}

function hasRequestPaint(canvas: HTMLCanvasElement): boolean {
  return typeof (canvas as any).requestPaint === "function"
}

/**
 * Check whether the HTML-in-Canvas API is available in this browser.
 * This is an experimental API (Chrome 2025+, behind a flag) providing
 * `drawElementImage`, `texElementImage2D`, `requestPaint`, `onpaint`, and
 * the `layoutsubtree` canvas attribute.
 *
 * When unavailable, NativeAdapter cannot capture the background and must
 * either fall back (handled by detectAdapter) or throw.
 */
export function isHtmlInCanvasAvailable(): boolean {
  const hasDrawElt =
    typeof CanvasRenderingContext2D !== "undefined" &&
    "drawElementImage" in CanvasRenderingContext2D.prototype
  const hasReqPaint =
    typeof HTMLCanvasElement !== "undefined" && "requestPaint" in HTMLCanvasElement.prototype
  const hasTexElt =
    typeof WebGLRenderingContext !== "undefined" &&
    "texElementImage2D" in WebGLRenderingContext.prototype
  // Primary path: drawElementImage + requestPaint.
  // Alt path: texElementImage2D (still needs requestPaint to trigger onpaint).
  // requestPaint has a fallback (call onpaint directly), so it's preferred but
  // not strictly required if a tex/draw API is present.
  return (hasDrawElt || hasTexElt) && hasReqPaint
}

export class NativeAdapter implements GlassAdapter {
  readonly type = "native"

  private target: HTMLElement | null = null
  private options!: GlassOptions
  private log!: ReturnType<typeof createLogger>

  /** Child div inside overlay canvas that replicates the page background.
   *  Direct child of overlayCanvas so texElementImage2D can read it. */
  private bgChild: HTMLDivElement | null = null
  private backgroundEl: HTMLElement | null = null

  /** WebGL canvas — also has layoutsubtree so bgChild participates in layout.
   *  Single-canvas architecture: WebGL context + layoutsubtree on the SAME
   *  canvas, so texElementImage2D's "direct child of canvas" constraint is
   *  satisfied and no fallback path is needed. */
  private overlayCanvas: HTMLCanvasElement | null = null
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private vertexBuffer: WebGLBuffer | null = null
  private uvBuffer: WebGLBuffer | null = null

  private resizeObserver: ResizeObserver | null = null
  private scrollHandler: (() => void) | null = null
  private _fps = 0
  private frameCount = 0
  private lastFpsTime = 0
  private rafId = 0
  private startTime = 0
  private disposed = false
  private textureReady = false
  private _loggedFirstPaint = false

  get fps(): number {
    return this._fps
  }

  async init(target: HTMLElement, options: GlassOptions): Promise<void> {
    this.target = target
    this.options = options
    this.log = createLogger(!!options.debug, "NativeAdapter")

    /* --- Pre-flight: verify HTML-in-Canvas API is available --- */
    if (!isHtmlInCanvasAvailable()) {
      const msg =
        "HTML-in-Canvas API not available in this browser. " +
        "NativeAdapter requires Chrome 138+ with the 'Experimental Web Platform Features' flag, " +
        "or a browser shipping drawElementImage/texElementImage2D/requestPaint. " +
        "Use adapter: 'html2canvas' or 'css' instead."
      this.log.error(msg)
      throw new Error(msg)
    }
    this.log.log("HTML-in-Canvas API detected, proceeding with native adapter")

    this.backgroundEl = this.resolveBackgroundTarget(options.backgroundTarget)

    /* --- Single canvas: WebGL + layoutsubtree --- *
     * overlayCanvas serves BOTH as the WebGL output surface AND as the
     * layoutsubtree canvas whose direct child (bgChild) replicates the page
     * background. This satisfies texElementImage2D's constraint that the
     * element must be a direct child of the WebGL context's own canvas.
     *
     * layoutsubtree children do NOT auto-render onto the canvas — canvas
     * pixels are controlled by the WebGL context. bgChild only participates
     * in layout so texElementImage2D can sample its rendered bitmap. */
    this.overlayCanvas = document.createElement("canvas")
    this.overlayCanvas.setAttribute("layoutsubtree", "")
    this.overlayCanvas.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "pointer-events:none",
      `border-radius:${options.cornerRadius}px`,
    ].join(";")

    if (!target.style.position) {
      target.style.position = "relative"
    }
    target.appendChild(this.overlayCanvas)

    /* --- Background child div (direct child of overlayCanvas) --- */
    this.bgChild = document.createElement("div")
    this.syncBackgroundChild()
    this.overlayCanvas.appendChild(this.bgChild)

    this.gl = this.overlayCanvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })
    if (!this.gl) {
      throw new Error("WebGL is not available")
    }

    this.log.log(
      `texElementImage2D available: ${hasTexElementImage2D(this.gl)}`,
    )

    const plugin = registry.get(options.effect)
    if (!plugin) {
      throw new Error(`Effect "${options.effect}" not registered`)
    }

    this.program = this.compileShader(plugin.getFragmentShader())
    if (!this.program) {
      throw new Error("Shader compilation failed")
    }

    this.setupGeometry()
    this.bindMouseEvents()
    this.syncSize()

    /* Create texture */
    this.texture = this.gl.createTexture()
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    /* --- onpaint callback: upload texture from child element --- */
    ;(this.overlayCanvas as any).onpaint = () => this.onSourcePaint()

    /* --- Trigger first paint --- */
    this.requestRepaint()

    /* --- Resize observer --- */
    this.resizeObserver = new ResizeObserver(() => {
      this.syncSize()
      this.syncBackgroundChild()
      this.requestRepaint()
    })
    this.resizeObserver.observe(target)
    if (this.backgroundEl && this.backgroundEl !== target) {
      this.resizeObserver.observe(this.backgroundEl)
    }

    /* --- Scroll listener: update background position on scroll --- */
    this.scrollHandler = () => {
      this.syncBackgroundChild()
      this.requestRepaint()
    }
    window.addEventListener("scroll", this.scrollHandler, { passive: true })

    this.startTime = performance.now()
    this.lastFpsTime = this.startTime
    this.rafId = requestAnimationFrame(this.renderLoop)
  }

  render(_time: number): void {}

  setOptions(options: Partial<GlassOptions>): void {
    if (!this.options) return
    Object.assign(this.options, options)
    if (this.overlayCanvas) {
      this.overlayCanvas.style.borderRadius = `${this.options.cornerRadius}px`
    }
    this.syncBackgroundChild()
    this.requestRepaint()
  }

  markChanged(): void {
    this.syncBackgroundChild()
    this.requestRepaint()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler)
      this.scrollHandler = null
    }

    if (this.target) {
      this.target.removeEventListener("mousemove", this.handleMouseMove)
      this.target.removeEventListener("mouseenter", this.handleMouseEnter)
      this.target.removeEventListener("mouseleave", this.handleMouseLeave)
    }

    if (this.gl) {
      if (this.program) this.gl.deleteProgram(this.program)
      if (this.texture) this.gl.deleteTexture(this.texture)
      if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer)
      if (this.uvBuffer) this.gl.deleteBuffer(this.uvBuffer)
    }

    if (this.overlayCanvas?.parentNode) {
      this.overlayCanvas.parentNode.removeChild(this.overlayCanvas)
    }

    this.program = null
    this.texture = null
    this.vertexBuffer = null
    this.uvBuffer = null
    this.overlayCanvas = null
    this.bgChild = null
    this.backgroundEl = null
    this.gl = null
    this.target = null
  }

  /* ================================================================
     Private helpers
  ================================================================ */

  private resolveBackgroundTarget(bg?: string | HTMLElement): HTMLElement | null {
    if (!bg) return null
    if (typeof bg === "string") return document.querySelector(bg)
    return bg
  }

  private bindMouseEvents(): void {
    if (!this.target) return
    this.target.addEventListener("mousemove", this.handleMouseMove)
    this.target.addEventListener("mouseenter", this.handleMouseEnter)
    this.target.addEventListener("mouseleave", this.handleMouseLeave)
  }

  private mouse = { x: 0.5, y: 0.5, hovering: false }

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.target) return
    const rect = this.target.getBoundingClientRect()
    this.mouse.x = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
    this.mouse.y = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
  }
  private handleMouseEnter = (): void => {
    this.mouse.hovering = true
  }
  private handleMouseLeave = (): void => {
    this.mouse.hovering = false
  }

  /**
   * Sync the background child div so it replicates the page background
   * and is positioned to show the card's region.
   *
   * The child div is sized to match the background element, with a
   * transform offset so the card's portion of the background is visible
   * inside the source canvas.
   */
  private syncBackgroundChild(): void {
    if (!this.bgChild || !this.target) return

    const bgEl = this.backgroundEl ?? document.body
    const bgStyle = getComputedStyle(bgEl)
    const bgRect = bgEl.getBoundingClientRect()
    const targetRect = this.target.getBoundingClientRect()

    const offsetX = targetRect.left - bgRect.left
    const offsetY = targetRect.top - bgRect.top

    this.bgChild.style.cssText = [
      "position:absolute",
      `width:${bgRect.width}px`,
      `height:${bgRect.height}px`,
      `background-image:${bgStyle.backgroundImage}`,
      `background-size:${bgStyle.backgroundSize}`,
      `background-position:${bgStyle.backgroundPosition}`,
      `background-repeat:${bgStyle.backgroundRepeat}`,
      `background-color:${bgStyle.backgroundColor}`,
      `transform:translate(${-offsetX}px, ${-offsetY}px)`,
      "top:0",
      "left:0",
    ].join(";")
  }

  private syncSize(): void {
    if (!this.target || !this.overlayCanvas) return

    const rect = this.target.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))

    /* Single canvas: CSS pixels (no DPR multiplier).
     * layoutsubtree uses canvas.width/height as the layout viewport, and
     * bgChild's CSS px dimensions must match this viewport 1:1. Using DPR
     * would make the layout viewport 2x the CSS size, breaking bgChild's
     * positioning. Slightly lower WebGL resolution is an acceptable
     * tradeoff for correct texture sampling. */
    this.overlayCanvas.width = w
    this.overlayCanvas.height = h
  }

  /**
   * onpaint callback — fires when canvas children render.
   * Upload the bgChild element as a WebGL texture via texElementImage2D.
   *
   * In the single-canvas architecture, bgChild is a direct child of
   * overlayCanvas (the WebGL canvas), so texElementImage2D's constraint
   * is satisfied and no fallback is needed.
   */
  private onSourcePaint(): void {
    if (!this.gl || !this.texture || !this.bgChild || !this.overlayCanvas) {
      this.log?.log("onSourcePaint skipped: missing gl/texture/bgChild/overlayCanvas")
      return
    }

    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    ;(gl as any).texElementImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.bgChild,
    )
    this.textureReady = true
    if (!this._loggedFirstPaint) {
      this._loggedFirstPaint = true
      this.log.log("first texture upload via texElementImage2D OK")
    }
  }

  private requestRepaint(): void {
    if (!this.overlayCanvas) return
    if (hasRequestPaint(this.overlayCanvas)) {
      ;(this.overlayCanvas as any).requestPaint()
    } else if ((this.overlayCanvas as any).onpaint) {
      /* Fallback: call onpaint directly (no native paint scheduling) */
      ;(this.overlayCanvas as any).onpaint()
    } else {
      this.log?.log("requestRepaint: no requestPaint and no onpaint bound")
    }
  }

  /* ================================================================
     Render loop
  ================================================================ */

  private renderLoop = (now: number): void => {
    if (this.disposed) return

    this.frameCount++
    if (now - this.lastFpsTime >= 1000) {
      this._fps = this.frameCount
      this.frameCount = 0
      this.lastFpsTime = now
    }

    /* Request a new paint each frame so onpaint fires and updates the texture */
    this.requestRepaint()

    this.draw((now - this.startTime) / 1000)
    this.rafId = requestAnimationFrame(this.renderLoop)
  }

  private draw(time: number): void {
    if (!this.gl || !this.program || !this.texture || !this.overlayCanvas) return
    if (!this.textureReady) return

    const gl = this.gl
    gl.viewport(0, 0, this.overlayCanvas.width, this.overlayCanvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0)
    gl.uniform2f(
      gl.getUniformLocation(this.program, "u_resolution"),
      this.overlayCanvas.width,
      this.overlayCanvas.height,
    )
    gl.uniform2f(gl.getUniformLocation(this.program, "u_mouse"), this.mouse.x, this.mouse.y)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_time"), time)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_hover"), this.mouse.hovering ? 1 : 0)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_refraction"), this.options.refraction ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_blur"), this.options.blur ?? 0)
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_chromatic"),
      this.options.chromaticAberration ?? 0,
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_edgeHighlight"),
      this.options.edgeHighlight ?? 0,
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_borderRadius"),
      this.options.cornerRadius ?? 0,
    )
    gl.uniform1f(gl.getUniformLocation(this.program, "u_specular"), this.options.specular ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.program, "u_fresnel"), this.options.fresnel ?? 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  /* ================================================================
     WebGL setup
  ================================================================ */

  private compileShader(fragSrc: string): WebGLProgram | null {
    if (!this.gl) return null
    const gl = this.gl

    const vertSrc = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `

    const vs = gl.createShader(gl.VERTEX_SHADER)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    if (!vs || !fs) return null

    gl.shaderSource(vs, vertSrc)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      this.log.error(gl.getShaderInfoLog(vs) ?? "vertex shader compile failed")
      return null
    }

    gl.shaderSource(fs, fragSrc)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      this.log.error(gl.getShaderInfoLog(fs) ?? "fragment shader compile failed")
      return null
    }

    const program = gl.createProgram()
    if (!program) return null
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, "a_position")
    gl.bindAttribLocation(program, 1, "a_texCoord")
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      this.log.error(gl.getProgramInfoLog(program) ?? "program link failed")
      return null
    }

    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return program
  }

  private setupGeometry(): void {
    if (!this.gl) return
    const gl = this.gl

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1])
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1])

    this.vertexBuffer = gl.createBuffer()
    this.uvBuffer = gl.createBuffer()
    if (!this.vertexBuffer || !this.uvBuffer) {
      throw new Error("Failed to create WebGL buffers")
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
  }
}
