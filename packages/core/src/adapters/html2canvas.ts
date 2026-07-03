import type { GlassAdapter, GlassOptions } from "../types"

/**
 * HTML2Canvas Adapter — screenshot-based backdrop capture.
 *
 * Performance strategy:
 *  - html2canvas is VERY expensive (clones entire DOM, computes styles).
 *    Calling it every frame causes severe lag.
 *  - Instead: capture the background ONCE into a cached "snapshot canvas".
 *    Re-capture only when the background actually changes (markChanged, bg switch).
 *  - On scroll/resize: just re-crop from the cached snapshot (fast drawImage).
 *  - Every frame: only WebGL shader runs — no DOM operations.
 *
 * SHARED SNAPSHOT CACHE:
 *  Multiple adapter instances targeting the SAME background element share a
 *  single html2canvas snapshot at module level. Without this, N cards over the
 *  same #page-bg trigger N independent html2canvas calls (each ~1-2s) — the
 *  test page's 6-card matrix would take ~9s. With the cache, only the first
 *  adapter pays the cost; the rest hit the cache instantly.
 */

async function resolveHtml2Canvas(): Promise<any> {
  if (typeof (window as any).html2canvas === "function") {
    return (window as any).html2canvas
  }
  const mod = await import("html2canvas")
  return mod.default || mod
}

/* ---- Module-level shared snapshot cache ---- *
 * key = bgIdentity (selector or element fingerprint)                      *
 * value = { canvas, time, scrollX, scrollY, version, inFlight }           *
 * `version` is bumped by ANY adapter's markChanged() — all adapters that  *
 * share the same bg see the invalidation.                                 *
 * `inFlight` is a Promise during an ongoing html2canvas call so multiple  *
 * adapters requesting a snapshot simultaneously coalesce into ONE call.   */
interface SharedSnapshot {
  canvas: HTMLCanvasElement
  time: number
  scrollX: number
  scrollY: number
  version: number
  bgIdentity: string
}
interface InFlightEntry {
  bgIdentity: string
  version: number
  promise: Promise<SharedSnapshot | null>
}
let _sharedSnapshot: SharedSnapshot | null = null
let _sharedSnapshotVersion = 0
const _inFlight: InFlightEntry[] = []

function getBgIdentity(el: HTMLElement | null): string {
  if (!el) return "__body__"
  if (el.id) return `#${el.id}`
  /* Fall back to a fingerprint of tag + position so distinct elements differ */
  const r = el.getBoundingClientRect()
  return `${el.tagName.toLowerCase()}@${r.left | 0},${r.top | 0}`
}

/**
 * Get a shared snapshot for the given background element.
 * - If cache hit (same bgIdentity + same version): return immediately.
 * - If an html2canvas call is already in flight for this bg+version: await it.
 * - Otherwise: start a new html2canvas call, register it in flight, and cache
 *   the result when it resolves.
 */
async function getSharedSnapshot(bgEl: HTMLElement | null): Promise<SharedSnapshot | null> {
  const bgIdentity = getBgIdentity(bgEl)
  const version = _sharedSnapshotVersion

  /* Cache hit? */
  if (
    _sharedSnapshot &&
    _sharedSnapshot.bgIdentity === bgIdentity &&
    _sharedSnapshot.version === version
  ) {
    return _sharedSnapshot
  }

  /* Already in flight for this bg+version? Coalesce. */
  const inflight = _inFlight.find((e) => e.bgIdentity === bgIdentity && e.version === version)
  if (inflight) {
    return inflight.promise
  }

  /* Start a new snapshot. The Promise resolves with a SharedSnapshot or null */
  const promise = (async () => {
    const source = bgEl ?? document.body
    /* scale: 1 (NOT dpr). html2canvas at dpr=2 produces 4x pixels and is 4x
     * slower; the glass shader blurs anyway so high-res is wasted. */
    const html2canvas = await resolveHtml2Canvas()
    const canvas = await html2canvas(source, {
      scale: 1,
      useCORS: true,
      logging: false,
      backgroundColor: null,
    })

    const entry: SharedSnapshot = {
      canvas,
      time: performance.now(),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      version: _sharedSnapshotVersion,
      bgIdentity,
    }
    /* Only commit if version still matches (a markChanged may have bumped it) */
    if (entry.version === _sharedSnapshotVersion) {
      _sharedSnapshot = entry
    }
    /* Remove from in-flight list */
    const idx = _inFlight.findIndex((e) => e.bgIdentity === bgIdentity && e.version === version)
    if (idx >= 0) _inFlight.splice(idx, 1)
    return entry.version === _sharedSnapshotVersion ? entry : null
  })()

  _inFlight.push({ bgIdentity, version, promise })
  return promise
}

function invalidateSharedSnapshot(): void {
  _sharedSnapshotVersion++
  _sharedSnapshot = null
}

export class HTML2CanvasAdapter implements GlassAdapter {
  readonly type = "html2canvas"

  private target: HTMLElement | null = null
  private backgroundEl: HTMLElement | null = null
  private options!: GlassOptions

  /** Cached full snapshot of the background element (expensive to create) */
  private snapshotCanvas: HTMLCanvasElement | null = null
  /** When the snapshot was taken — used to detect staleness */
  private snapshotTime = 0
  /** Scroll position when snapshot was taken */
  private snapshotScrollX = 0
  private snapshotScrollY = 0

  /** Cropped region of the snapshot for the card's current position (fast) */
  private captureCanvas: HTMLCanvasElement | null = null

  /** WebGL overlay canvas — the glass output visible on the card */
  private overlayCanvas: HTMLCanvasElement | null = null
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private vertexBuffer: WebGLBuffer | null = null
  private uvBuffer: WebGLBuffer | null = null

  private resizeObserver: ResizeObserver | null = null
  private scrollHandler: (() => void) | null = null

  /** Flags */
  private needsFullSnapshot = true
  private needsCrop = true
  private textureReady = false

  private _fps = 0
  private frameCount = 0
  private lastFpsTime = 0
  private rafId = 0
  private startTime = 0
  private mouse = { x: 0.5, y: 0.5, hovering: false }
  private disposed = false

  get fps(): number {
    return this._fps
  }

  async init(target: HTMLElement, options: GlassOptions): Promise<void> {
    this.target = target
    this.options = options
    this.backgroundEl = this.resolveBackgroundTarget(options.backgroundTarget)

    this.captureCanvas = document.createElement("canvas")
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

    this.gl = this.overlayCanvas.getContext("webgl", { alpha: true })
    if (!this.gl) {
      throw new Error("WebGL is not available")
    }

    const { registry } = await import("../plugin")
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

    this.texture = this.gl.createTexture()
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    this.resizeObserver = new ResizeObserver(() => {
      this.syncSize()
      this.needsCrop = true
    })
    this.resizeObserver.observe(target)
    if (this.backgroundEl && this.backgroundEl !== target) {
      this.resizeObserver.observe(this.backgroundEl)
    }

    /* Scroll: just need to re-crop, NOT a full html2canvas snapshot */
    this.scrollHandler = () => {
      this.needsCrop = true
    }
    window.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true })

    this.startTime = performance.now()
    this.lastFpsTime = this.startTime

    /* Take the initial snapshot asynchronously */
    void this.takeSnapshot()

    this.rafId = requestAnimationFrame(this.renderLoop)
  }

  render(_time: number): void {}

  setOptions(options: Partial<GlassOptions>): void {
    if (!this.options) return
    Object.assign(this.options, options)
    if (this.overlayCanvas) {
      this.overlayCanvas.style.borderRadius = `${this.options.cornerRadius}px`
    }
  }

  markChanged(): void {
    /* Background content changed — invalidate the shared cache so ALL adapters
     * sharing this background re-snapshot, and flag this instance to re-snap. */
    invalidateSharedSnapshot()
    this.needsFullSnapshot = true
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
      window.removeEventListener("scroll", this.scrollHandler, { capture: true } as any)
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

    this.gl = null
    this.program = null
    this.texture = null
    this.vertexBuffer = null
    this.uvBuffer = null
    this.overlayCanvas = null
    this.captureCanvas = null
    this.snapshotCanvas = null
    this.target = null
    this.backgroundEl = null
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

  private syncSize(): void {
    if (!this.target || !this.overlayCanvas || !this.captureCanvas) return
    const rect = this.target.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    this.captureCanvas.width = w
    this.captureCanvas.height = h
    this.overlayCanvas.width = Math.max(1, Math.round(rect.width * dpr))
    this.overlayCanvas.height = Math.max(1, Math.round(rect.height * dpr))
  }

  /**
   * Take a full html2canvas snapshot of the background element.
   * Delegates to the module-level shared cache: when multiple cards share the
   * same background, only ONE html2canvas call runs; the rest await the same
   * Promise and receive the same canvas.
   */
  private async takeSnapshot(): Promise<void> {
    if (!this.target) return

    try {
      const entry = await getSharedSnapshot(this.backgroundEl)
      if (!entry) {
        this.needsFullSnapshot = true
        return
      }
      this.snapshotCanvas = entry.canvas
      this.snapshotTime = entry.time
      this.snapshotScrollX = entry.scrollX
      this.snapshotScrollY = entry.scrollY
      this.needsFullSnapshot = false
      this.needsCrop = true
    } catch {
      this.needsFullSnapshot = true
    }
  }

  /**
   * Crop the card's region from the cached snapshot.
   * This is a FAST drawImage operation — safe to run every frame if needed.
   *
   * NOTE: shared snapshot is captured at scale:1 (CSS pixels), so crop coords
   * are in CSS pixels — no dpr multiplier needed on the source side.
   */
  private cropFromSnapshot(): void {
    if (!this.target || !this.captureCanvas || !this.snapshotCanvas) return

    const source = this.backgroundEl ?? this.target
    const sourceRect = source.getBoundingClientRect()
    const targetRect = this.target.getBoundingClientRect()

    /* Snapshot was captured at scale:1 (CSS pixels). Crop in CSS pixels. */
    const sx = Math.max(0, Math.round(targetRect.left - sourceRect.left))
    const sy = Math.max(0, Math.round(targetRect.top - sourceRect.top))
    const sw = Math.max(1, Math.round(targetRect.width))
    const sh = Math.max(1, Math.round(targetRect.height))

    const ctx = this.captureCanvas.getContext("2d")
    if (!ctx) return

    const cw = Math.max(1, Math.round(targetRect.width))
    const ch = Math.max(1, Math.round(targetRect.height))
    this.captureCanvas.width = cw
    this.captureCanvas.height = ch
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(this.snapshotCanvas, sx, sy, sw, sh, 0, 0, cw, ch)

    this.updateTexture(this.captureCanvas)
    this.needsCrop = false
    this.textureReady = true
  }

  private updateTexture(source: HTMLCanvasElement): void {
    if (!this.gl || !this.texture) return
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
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

    /* Full snapshot only when needed (background changed) */
    if (this.needsFullSnapshot && now - this.snapshotTime > 500) {
      void this.takeSnapshot()
    }

    /* Re-crop from snapshot when position changed (scroll/resize) */
    if (this.needsCrop && this.snapshotCanvas) {
      this.cropFromSnapshot()
    }

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

  private compileShader(fragmentSrc: string): WebGLProgram | null {
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
      console.error("[Html2CanvasAdapter] Vertex shader compile error:", gl.getShaderInfoLog(vs))
      return null
    }

    gl.shaderSource(fs, fragmentSrc)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("[Html2CanvasAdapter] Fragment shader compile error:", gl.getShaderInfoLog(fs))
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
      console.error("[Html2CanvasAdapter] Program link error:", gl.getProgramInfoLog(program))
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
