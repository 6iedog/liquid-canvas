# React API

## `<Glass>` 组件

将 `glass()` 封装到组件生命周期中的 React 组件。

### Props

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `effect` | `string` | `"liquid-glass"` | 效果插件 ID |
| `options` | `Partial<GlassOptions>` | `{}` | 效果配置 |
| `adapter` | `"auto" \| "native" \| "html2canvas" \| "css"` | `"auto"` | 适配器偏好 |
| `children` | `ReactNode` | — | 玻璃面板内的内容 |
| *(HTML div 属性)* | — | — | 其他 div 属性 |

### 示例

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
      <h2>标题</h2>
      <p>玻璃内部的内容。</p>
    </Glass>
  )
}
```

### 重新渲染

当 `options` prop 变化时，组件会重新调用 `setOptions()`。效果在挂载时初始化一次，在卸载时销毁。
