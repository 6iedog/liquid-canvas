import { isHtmlInCanvasAvailable } from "./adapters/native"
import { createLogger } from "./log"
import type { AdapterType, GlassAdapter } from "./types"

export type { GlassAdapter, AdapterType }

export function detectAdapter(
  preferred: AdapterType | "auto" | undefined,
  debug = false,
): AdapterType {
  const log = createLogger(debug, "detectAdapter")

  const nativeAvailable = isHtmlInCanvasAvailable()
  const hasHtml2Canvas =
    typeof window !== "undefined" && typeof (window as any).html2canvas === "function"

  if (preferred !== undefined && preferred !== "auto") {
    if (preferred === "native" && !nativeAvailable) {
      /* User explicitly asked for native but the browser doesn't ship the   *
       * HTML-in-Canvas API. Fall back to html2canvas (or css) so the card   *
       * still renders something instead of staying transparent.             */
      const fallback = hasHtml2Canvas ? "html2canvas" : "css"
      log.log(
        `adapter manually set to "native" but HTML-in-Canvas API unavailable → falling back to "${fallback}"`,
      )
      return fallback
    }
    log.log(`adapter manually set to "${preferred}"`)
    return preferred
  }

  if (nativeAvailable) {
    log.log("HTML-in-Canvas API available → native")
    return "native"
  }

  if (hasHtml2Canvas) {
    log.log("html2canvas detected → html2canvas")
    return "html2canvas"
  }

  log.log("no HTML-in-Canvas API or html2canvas → css")
  return "css"
}
