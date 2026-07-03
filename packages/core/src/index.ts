import { frostredGlass } from "./effects/frosted-glass"
import { liquidGlass } from "./effects/liquid-glass"
import { Engine } from "./engine"
import { registry } from "./plugin"
import type { GlassInstance, GlassOptions } from "./types"

registry.register(liquidGlass)
registry.register(frostredGlass)

export interface GlassInput {
  target: string | HTMLElement
  effect?: string
  options?: Partial<GlassOptions>
  adapter?: "auto" | "native" | "html2canvas" | "css"
}

export async function glass(
  targetOrConfig: string | HTMLElement | GlassInput,
  options?: Partial<GlassOptions>,
): Promise<GlassInstance> {
  let target: string | HTMLElement
  let opts: Partial<GlassOptions> = {}

  if (typeof targetOrConfig === "object" && "target" in targetOrConfig) {
    target = targetOrConfig.target
    opts = {
      effect: targetOrConfig.effect,
      ...targetOrConfig.options,
    }
    if (targetOrConfig.adapter !== undefined) opts.adapter = targetOrConfig.adapter
  } else {
    target = targetOrConfig as string | HTMLElement
    opts = options ?? {}
  }

  const engine = new Engine(target, opts)
  await engine.init()
  return engine
}

export { registry } from "./plugin"
export { Engine } from "./engine"
export type {
  GlassOptions,
  GlassInstance,
  AdapterType,
  GlassAdapter,
  GlassEffectPlugin,
  ControlDescriptor,
  MouseState,
} from "./types"
export const version = "0.2.4"
