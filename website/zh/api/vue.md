# Vue API

## `<Glass>` 组件

将 `glass()` 封装到 Composition API 生命周期中的 Vue 3 组件。

### Props

| Prop | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `effect` | `string` | `"liquid-glass"` | 效果插件 ID |
| `options` | `Partial<GlassOptions>` | `{}` | 效果配置 |
| `adapter` | `"auto" \| "native" \| "html2canvas" \| "css"` | `"auto"` | 适配器偏好 |

### 插槽

| 插槽 | 描述 |
|------|------|
| `default` | 玻璃面板内的内容 |

### 示例

```vue
<template>
  <Glass
    effect="liquid-glass"
    :options="options"
    class="my-panel"
  >
    <h2>标题</h2>
    <p>玻璃内部的内容。</p>
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

### 响应式

组件会深度监听 `options` prop，发生变化时调用 `setOptions()`。
