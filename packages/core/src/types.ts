export type AdapterType = "native" | "html2canvas" | "css"

export interface GlassOptions {
  effect: string
  refraction: number
  blur: number
  chromaticAberration: number
  edgeHighlight: number
  specular: number
  fresnel: number
  cornerRadius: number
  tintStrength: number
  shadowOpacity: number
  responsive: boolean
  adapter: AdapterType | "auto"
  debug?: boolean
  backgroundTarget?: string | HTMLElement
}

export interface MouseState {
  x: number
  y: number
  hovering: boolean
}

export interface GlassInstance {
  readonly element: HTMLElement
  readonly adapterType: AdapterType
  readonly fps: number
  setOptions(options: Partial<GlassOptions>): void
  markChanged(): void
  dispose(): void
}

export interface GlassAdapter {
  readonly type: AdapterType
  init(target: HTMLElement, options: GlassOptions): Promise<void>
  render(time: number): void
  setOptions(options: Partial<GlassOptions>): void
  markChanged(element?: HTMLElement): void
  dispose(): void
  readonly fps: number
}

export interface ControlDescriptor {
  key: string
  label: string
  type: "slider" | "color" | "toggle" | "select"
  min?: number
  max?: number
  step?: number
  default: number | boolean | string
}

export interface GlassEffectPlugin {
  id: string
  name: string
  getFragmentShader(): string
  getSVGFilter?(): { filter: string; id: string } | null
  getDefaultUniforms(): Record<string, number | number[]>
  updateUniforms?(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Record<string, number>,
    time: number,
    mouse: MouseState,
  ): void
  getControls(): ControlDescriptor[]
}
