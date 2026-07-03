import type { GlassAdapter } from "./adapter"
import { detectAdapter } from "./adapter"
import { CSSAdapter } from "./adapters/css"
import { HTML2CanvasAdapter } from "./adapters/html2canvas"
import { NativeAdapter } from "./adapters/native"
import { createLogger } from "./log"
import { registry } from "./plugin"
import type { AdapterType, GlassInstance, GlassOptions, MouseState } from "./types"

const DEFAULT_OPTIONS: GlassOptions = {
  effect: "liquid-glass",
  refraction: 0.6,
  blur: 0.3,
  chromaticAberration: 0.04,
  edgeHighlight: 0.08,
  specular: 0.15,
  fresnel: 1.0,
  cornerRadius: 24,
  tintStrength: 0.1,
  shadowOpacity: 0.3,
  responsive: true,
  adapter: "auto",
  debug: false,
}

export class Engine {
  readonly element: HTMLElement
  readonly adapterType: AdapterType
  private adapter!: GlassAdapter
  private options: GlassOptions
  private animFrameId: number | null = null
  private startTime = 0
  private _fps = 0
  private frameCount = 0
  private lastFpsTime = 0
  private mouse: MouseState = { x: 0.5, y: 0.5, hovering: false }
  private disposed = false
  private log!: ReturnType<typeof createLogger>

  constructor(targetOrSelector: string | HTMLElement, userOptions: Partial<GlassOptions> = {}) {
    this.element =
      typeof targetOrSelector === "string"
        ? (document.querySelector(targetOrSelector) as HTMLElement)
        : targetOrSelector

    if (!this.element) {
      throw new Error("Target element not found")
    }

    this.options = { ...DEFAULT_OPTIONS }
    for (const key of Object.keys(userOptions) as (keyof GlassOptions)[]) {
      const val = userOptions[key]
      if (val !== undefined) (this.options as any)[key] = val
    }
    this.log = createLogger(!!this.options.debug, "Engine")
    this.adapterType = detectAdapter(this.options.adapter, !!this.options.debug)

    this.log.log(
      `init target="#${this.element.id || this.element.className || "?"}" effect="${this.options.effect}" adapter=${this.adapterType}`,
    )
  }

  async init(): Promise<void> {
    const plugin = registry.get(this.options.effect)
    if (!plugin) {
      this.log.error(`plugin "${this.options.effect}" not found`)
      throw new Error(`Effect "${this.options.effect}" not registered`)
    }

    this.adapter = this.createAdapter()
    this.log.log(`adapter created: ${this.adapterType}`)

    await this.adapter.init(this.element, this.options)
    this.log.log("adapter init complete, starting render loop")

    this.startTime = performance.now()
    this.lastFpsTime = this.startTime
    this.loop(this.startTime)

    if (this.options.responsive) {
      this.element.addEventListener("mousemove", this.onMouseMove)
      this.element.addEventListener("mouseenter", this.onMouseEnter)
      this.element.addEventListener("mouseleave", this.onMouseLeave)
    }
  }

  get fps(): number {
    return this._fps
  }

  setOptions(options: Partial<GlassOptions>): void {
    Object.assign(this.options, options)
    this.adapter.setOptions(this.options)
  }

  markChanged(): void {
    this.adapter.markChanged()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    this.element.removeEventListener("mousemove", this.onMouseMove)
    this.element.removeEventListener("mouseenter", this.onMouseEnter)
    this.element.removeEventListener("mouseleave", this.onMouseLeave)

    this.adapter.dispose()
  }

  private createAdapter(): GlassAdapter {
    switch (this.adapterType) {
      case "css":
        return new CSSAdapter()
      case "html2canvas":
        return new HTML2CanvasAdapter()
      case "native":
        return new NativeAdapter()
      default:
        return new CSSAdapter()
    }
  }

  private loop = (now: number): void => {
    if (this.disposed) return

    const elapsed = now - this.startTime
    this.adapter.render(elapsed)

    this.frameCount++
    if (now - this.lastFpsTime >= 1000) {
      this._fps = this.frameCount
      this.frameCount = 0
      this.lastFpsTime = now
    }

    this.animFrameId = requestAnimationFrame(this.loop)
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.element.getBoundingClientRect()
    this.mouse = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      hovering: true,
    }
  }

  private onMouseEnter = (): void => {
    this.mouse.hovering = true
  }

  private onMouseLeave = (): void => {
    this.mouse.hovering = false
  }
}
