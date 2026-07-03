# Native 适配器

使用实验性的 **HTML-in-Canvas API**（`drawElementImage` / `texElementImage2D` / `requestPaint` / `<canvas layoutsubtree>`）实现原生 HTML 捕获。这是性能最高的路径，因为它不克隆 DOM，完全在浏览器渲染管线中运行。

## 工作原理

Native 适配器采用**双 Canvas 架构**，将背景采样与玻璃渲染解耦：

1. **Source canvas**（隐藏，带 `<canvas layoutsubtree>` 属性）：
   - 包含一个子 `<div>`，复制目标卡片背后的页面背景（相同的 `background-image`、`background-size`、`background-position`，通过 transform 偏移让卡片区域在 source canvas 中可见）。
   - `layoutsubtree` 属性让 canvas 子元素参与布局。
   - `onpaint` 在子元素渲染内容变化时触发。
   - `requestPaint()` 强制触发 paint 事件。
2. **Overlay canvas**（可见，覆盖在目标上）：
   - 在 WebGL 中运行效果的片段着色器。
   - 读取从 source canvas 上传的纹理。

### 纹理上传路径

适配器优先使用 `texElementImage2D`（将子元素直接上传为 WebGL 纹理，无 2D 中间步骤）。不可用时回退到 `drawElementImage`（将子元素渲染到 2D 上下文）+ `texImage2D`（上传 canvas）。

### 背景同步

在 init、resize 和 scroll 时，`syncBackgroundChild()` 更新子 div 的尺寸和 transform，使 source canvas 始终显示卡片当前区域的页面背景。随后调用 `requestPaint()` 触发新的纹理上传。

## API 可用性检测

适配器导出 `isHtmlInCanvasAvailable()` 并在 `init()` 开头调用。若 API 缺失，抛出明确的错误说明要求。`detectAdapter` 也会参考此函数 — 见[适配器总览](./overview.md)。

## 优雅降级

若在不支持的浏览器上显式设置 `adapter: "native"`，`detectAdapter` 会**自动降级**到 `html2canvas`（或最后的 `css`），而不是让卡片保持透明。Demo 卡片上的 badge 会显示 `native → html2canvas`，让降级可见。

## 浏览器支持

HTML-in-Canvas API 是实验性的（2025 年）：
- Chrome 138+ 需开启 `Experimental Web Platform Features` flag
- 其他浏览器：尚未实现

## 适用场景

- 仅 Chrome 的应用（Electron、Chrome kiosk、内部工具）
- 需要最高性能（无 DOM 克隆开销）
- 希望玻璃中反映实时 DOM 交互（鼠标移动、悬停状态）

## 示例

```typescript
await glass("#panel", {
  effect: "liquid-glass",
  adapter: "native",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
  blur: 0.3,
})
```
