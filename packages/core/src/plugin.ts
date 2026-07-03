import type { GlassEffectPlugin } from "./types"

class PluginRegistry {
  private plugins = new Map<string, GlassEffectPlugin>()

  register(plugin: GlassEffectPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`)
    }
    this.plugins.set(plugin.id, plugin)
  }

  get(id: string): GlassEffectPlugin | undefined {
    return this.plugins.get(id)
  }

  getAll(): GlassEffectPlugin[] {
    return Array.from(this.plugins.values())
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id)
  }
}

export const registry = new PluginRegistry()
