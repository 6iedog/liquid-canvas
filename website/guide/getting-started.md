# Getting Started

## Try it live

Preview the live demo directly here:

<div style="margin: 16px 0 12px; border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 16px; overflow: hidden; background: rgba(15, 23, 42, 0.04);">
  <iframe
    src="../demo/"
    title="Liquid Canvas Demo"
    style="display:block;width:100%;height:760px;border:0;background:#0b1020;"
    loading="lazy"
  ></iframe>
</div>

[Open full demo](../demo/)

## With React

```tsx
import { Glass } from "@liquid-canvas/react"

function App() {
  return (
    <Glass
      effect="liquid-glass"
      options={{ refraction: 0.6, blur: 0.3 }}
      className="my-panel"
    >
      <h2>Title</h2>
      <p>Content inside the glass panel.</p>
    </Glass>
  )
}
```

## With Vue

```vue
<template>
  <Glass effect="liquid-glass" :options="options">
    <h2>Title</h2>
    <p>Content inside the glass panel.</p>
  </Glass>
</template>

<script setup>
import { Glass } from "@liquid-canvas/vue"
const options = { refraction: 0.6, blur: 0.3 }
</script>
```