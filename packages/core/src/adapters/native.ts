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

  /** Hidden source canvas with layoutsubtree — contains the bg child */
  private sourceCanvas: HTMLCanvasElement | null = null

  /** Child div inside source canvas that replicates the page background */
  private bgChild: HTMLDivElement | null = null
  private backgroundEl: HTMLElement | null = null

  /** WebGL overlay canvas — the glass output visible on the card */
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
  private useTexElementImage2D = false
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

    /* --- Source canvas (hidden, with layoutsubtree) --- *
     * Use setAttribute so the layoutsubtree attribute is reflected properly *
     * (property assignment may not trigger the canvas layout subtree mode).  *
     * Hide via off-screen positioning instead of opacity:0 — opacity:0 can   *
     * cause browsers to skip rendering child content, which would leave the  *
     * texture empty.                                                          */
    this.sourceCanvas = document.createElement("canvas")
    this.sourceCanvas.setAttribute("layoutsubtree", "")
    this.sourceCanvas.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;z-index:-1;overflow:hidden;left:-9999px"

    document.body.appendChild(this.sourceCanvas)

    /* --- Background child div (replicates page background inside canvas) --- */
    this.bgChild = document.createElement("div")
    this.syncBackgroundChild()
    this.sourceCanvas.appendChild(this.bgChild)

    /* --- Overlay canvas (WebGL glass output) --- */
    this.overlayCanvas = document.createElement("canvas")
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

    this.gl = this.overlayCanvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })
    if (!this.gl) {
      throw new Error("WebGL is not available")
    }

    /* Check if texElementImage2D is available (preferred path) */
    this.useTexElementImage2D = hasTexElementImage2D(this.gl)
    this.log.log(
      `texElementImage2D available: ${this.useTexElementImage2D}, ` +
        `drawElementImage available: ${typeof (this.sourceCanvas.getContext("2d") as any)?.drawElementImage === "function"}`,
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
    ;(this.sourceCanvas as any).onpaint = () => this.onSourcePaint()

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
    if (this.sourceCanvas?.parentNode) {
      this.sourceCanvas.parentNode.removeChild(this.sourceCanvas)
    }

    this.program = null
    this.texture = null
    this.vertexBuffer = null
    this.uvBuffer = null
    this.overlayCanvas = null
    this.sourceCanvas = null
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
    if (!this.target || !this.overlayCanvas || !this.sourceCanvas) return

    const rect = this.target.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))

    /* Source canvas: CSS pixels, no DPR (layoutsubtree uses canvas.width as viewport) */
    this.sourceCanvas.width = w
    this.sourceCanvas.height = h
    this.sourceCanvas.style.width = `${w}px`
    this.sourceCanvas.style.height = `${h}px`

    /* Overlay canvas: device pixels for crisp rendering */
    const dpr = window.devicePixelRatio || 1
    this.overlayCanvas.width = Math.max(1, Math.round(rect.width * dpr))
    this.overlayCanvas.height = Math.max(1, Math.round(rect.height * dpr))
  }

  /**
   * onpaint callback — fires when canvas children render.
   * Upload the bgChild element as a WebGL texture.
   */
  private onSourcePaint(): void {
    if (!this.gl || !this.texture || !this.bgChild) {
      this.log?.log("onSourcePaint skipped: missing gl/texture/bgChild")
      return
    }

    const gl = this.gl

    if (this.useTexElementImage2D) {
      /* Preferred: directly upload element as WebGL texture */
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
    } else {
      /* Fallback: draw to 2D context, then texImage2D */
      const ctx2d = this.sourceCanvas?.getContext("2d")
      if (!ctx2d || !this.sourceCanvas) {
        this.log?.log("onSourcePaint fallback: no 2d context")
        return
      }
      if (!hasDrawElementImage(ctx2d)) {
        this.log?.log("onSourcePaint fallback: drawElementImage unavailable")
        return
      }

      const w = this.sourceCanvas.width
      const h = this.sourceCanvas.height
      ctx2d.clearRect(0, 0, w, h)
      ;(ctx2d as any).drawElementImage(this.bgChild, 0, 0, w, h)

      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas)
      this.textureReady = true
      if (!this._loggedFirstPaint) {
        this._loggedFirstPaint = true
        this.log.log("first texture upload via drawElementImage+texImage2D OK")
      }
    }
  }

  private requestRepaint(): void {
    if (!this.sourceCanvas) return
    if (hasRequestPaint(this.sourceCanvas)) {
      ;(this.sourceCanvas as any).requestPaint()
    } else if ((this.sourceCanvas as any).onpaint) {
      /* Fallback: call onpaint directly (no native paint scheduling) */
      ;(this.sourceCanvas as any).onpaint()
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
