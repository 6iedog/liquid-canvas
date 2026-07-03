const PREFIX = "[liquid-canvas]"

export function createLogger(debug: boolean, tag: string) {
  if (!debug) return { log: () => {}, warn: () => {}, error: () => {} }
  return {
    log: (...args: unknown[]) => console.log(PREFIX, `[${tag}]`, ...args),
    warn: (...args: unknown[]) => console.warn(PREFIX, `[${tag}]`, ...args),
    error: (...args: unknown[]) => console.error(PREFIX, `[${tag}]`, ...args),
  }
}
