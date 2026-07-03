declare module "html2canvas" {
  interface Html2CanvasOptions {
    scale?: number
    useCORS?: boolean
    logging?: boolean
  }
  export default function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions,
  ): Promise<HTMLCanvasElement>
}
