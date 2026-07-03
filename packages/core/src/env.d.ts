interface CanvasRenderingContext2D {
  drawElementImage(element: Element, dx: number, dy: number, dw?: number, dh?: number): void
  roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radii: number | DOMPointInit | (number | DOMPointInit)[],
  ): void
}

interface HTMLCanvasElement {
  layoutSubtree: boolean
  requestPaint(): void
  onpaint: (() => void) | null
}

interface HTMLCanvasElementEventMap {
  paint: Event
}
