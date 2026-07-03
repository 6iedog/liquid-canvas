# Vue API

## `<Glass>` Component

A Vue 3 component that wraps `glass()` in the Composition API lifecycle.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `effect` | `string` | `"liquid-glass"` | Effect plugin ID |
| `options` | `Partial<GlassOptions>` | `{}` | Effect configuration |
| `adapter` | `"auto" \| "native" \| "html2canvas" \| "css"` | `"auto"` | Adapter preference |

### Slots

| Slot | Description |
|------|-------------|
| `default` | Content inside the glass panel |

### Example

```vue
<template>
  <Glass
    effect="liquid-glass"
    :options="options"
    class="my-panel"
  >
    <h2>Title</h2>
    <p>Content inside the glass.</p>
  </Glass>
</template>

<script setup>
import { Glass } from "@liquid-canvas/vue"

const options = {
  refraction: 0.6,
  blur: 0.3,
}
</script>
```

### Reactivity

The component watches the `options` prop (deep) and calls `setOptions()` when it changes.
