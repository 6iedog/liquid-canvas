import { glass } from "@liquid-canvas/core"
import type { GlassInstance, GlassOptions } from "@liquid-canvas/core"
import { createElement, useEffect, useRef } from "react"
import type { HTMLAttributes, ReactNode } from "react"

export interface GlassProps extends HTMLAttributes<HTMLDivElement> {
  effect?: string
  options?: Partial<GlassOptions>
  adapter?: "auto" | "native" | "html2canvas" | "css"
  children?: ReactNode
}

export function Glass({ effect, options, adapter, children, ...divProps }: GlassProps) {
  const ref = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<GlassInstance | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: options handled by second effect
  useEffect(() => {
    if (!ref.current) return
    const target = ref.current
    glass(target, { effect, ...options, adapter }).then((inst) => {
      instanceRef.current = inst
    })
    return () => {
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [effect, adapter])

  useEffect(() => {
    instanceRef.current?.setOptions(options ?? {})
  }, [options])

  return createElement("div", { ref, ...divProps }, children)
}

export type { GlassOptions, GlassInstance }
