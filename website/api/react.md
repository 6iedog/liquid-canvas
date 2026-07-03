# React API

## `<Glass>` Component

A React component that wraps `glass()` in the component lifecycle.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `effect` | `string` | `"liquid-glass"` | Effect plugin ID |
| `options` | `Partial<GlassOptions>` | `{}` | Effect configuration |
| `adapter` | `"auto" \| "native" \| "html2canvas" \| "css"` | `"auto"` | Adapter preference |
| `children` | `ReactNode` | — | Content inside the glass panel |
| *(HTML div props)* | — | — | Any additional div attributes |

### Example

```tsx
import { Glass } from "@liquid-canvas/react"

function Panel() {
  return (
    <Glass
      effect="liquid-glass"
      options={{ refraction: 0.6, blur: 0.3 }}
      className="my-panel"
      style={{ width: 400, padding: 40 }}
    >
      <h2>Title</h2>
      <p>Content inside the glass.</p>
    </Glass>
  )
}
```

### Re-rendering

The component re-applies `setOptions()` when the `options` prop changes. The effect is initialized once on mount and disposed on unmount.
