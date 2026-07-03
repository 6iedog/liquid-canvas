# 快速开始

## 在线体验

创建一个 HTML 文件并在浏览器中打开：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Liquid Canvas 演示</title>
  <style>
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea, #764ba2);
      font-family: system-ui, sans-serif;
      margin: 0;
    }
    #glass {
      width: 400px;
      padding: 40px;
      color: #fff;
      text-align: center;
      border-radius: 24px;
    }
    #glass h1 { margin: 0 0 12px; font-size: 24px; }
    #glass p { opacity: 0.9; line-height: 1.6; }
  </style>
</head>
<body>
  <div id="glass">
    <h1>Hello Glass</h1>
    <p>此面板使用 CSSAdapter 降级 — 无需 WebGL。</p>
  </div>

  <script type="importmap">
  {
    "imports": {
      "@liquid-canvas/core": "https://esm.sh/@liquid-canvas/core"
    }
  }
  </script>
  <script type="module">
    import { glass } from "@liquid-canvas/core"
    glass("#glass", { effect: "liquid-glass" })
  </script>
</body>
</html>
```

## 使用 React

```tsx
import { Glass } from "@liquid-canvas/react"

function App() {
  return (
    <Glass
      effect="liquid-glass"
      options={{ refraction: 0.6, blur: 0.3 }}
      className="my-panel"
    >
      <h2>标题</h2>
      <p>玻璃面板内部的内容。</p>
    </Glass>
  )
}
```

## 使用 Vue

```vue
<template>
  <Glass effect="liquid-glass" :options="options">
    <h2>标题</h2>
    <p>玻璃面板内部的内容。</p>
  </Glass>
</template>

<script setup>
import { Glass } from "@liquid-canvas/vue"
const options = { refraction: 0.6, blur: 0.3 }
</script>
```
