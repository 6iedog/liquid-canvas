import { glass } from "@liquid-canvas/core"
import type { GlassInstance, GlassOptions } from "@liquid-canvas/core"
import { type PropType, defineComponent, h, onMounted, onUnmounted, ref, watch } from "vue"

export const Glass = defineComponent({
  name: "Glass",
  props: {
    effect: { type: String, default: "liquid-glass" },
    options: { type: Object as PropType<Partial<GlassOptions>>, default: () => ({}) },
    adapter: {
      type: String as PropType<"auto" | "native" | "html2canvas" | "css">,
      default: "auto",
    },
  },
  setup(props, { slots, attrs }) {
    const el = ref<HTMLElement>()
    let instance: GlassInstance | null = null

    onMounted(async () => {
      if (!el.value) return
      instance = await glass(el.value, {
        effect: props.effect,
        ...props.options,
        adapter: props.adapter,
      })
    })

    onUnmounted(() => {
      instance?.dispose()
      instance = null
    })

    watch(
      () => props.options,
      (opts) => {
        instance?.setOptions(opts ?? {})
      },
      { deep: true },
    )

    return () => h("div", { ref: el, ...attrs }, slots.default?.())
  },
})

export type { GlassOptions, GlassInstance }
