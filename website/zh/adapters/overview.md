# 适配器总览

Liquid Canvas 采用三层渐进增强策略。系统会根据浏览器能力自动选择合适的适配器。

## 检测顺序

```
1. HTML-in-Canvas API 可用  → NativeAdapter（最佳性能，实时 DOM）
2. html2canvas 已加载        → HTML2CanvasAdapter（跨浏览器，基于快照）
3. 降级                      → CSSAdapter（通用，backdrop-filter）
```

检测会检查相关原型上是否存在实验性的 HTML-in-Canvas API（`drawElementImage` / `texElementImage2D` / `requestPaint`）。见 [`isHtmlInCanvasAvailable()`](./native.md#api可用性检测)。

## 强制适配器

你可以通过 `adapter` 选项覆盖自动检测：

```typescript
glass("#el", {
  effect: "liquid-glass",
  adapter: "css", // 强制使用 CSS 降级
})
```

### 强制 `native` 时的优雅降级

若在不支持 HTML-in-Canvas API 的浏览器上显式设置 `adapter: "native"`，`detectAdapter` 会**自动降级**到 `html2canvas`（或最后的 `css`）。卡片继续渲染而不是保持透明。返回实例的 `adapterType` 反映实际使用的适配器，因此 UI badge 可以显示 `native → html2canvas`。

## 背景目标

对于浮在全屏背景上的面板，使用 `backgroundTarget` 指定背景元素作为 WebGL 纹理来源：

```typescript
await glass("#panel", {
  effect: "liquid-glass",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
})
```

Native 和 html2canvas 适配器都会捕获 `backgroundTarget` 元素并裁切/采样到卡片本地区域。CSS 适配器改用 `backdrop-filter`（不捕获纹理）。

## 对比

| 特性 | Native | HTML2Canvas | CSS |
|------|--------|-------------|-----|
| 浏览器支持 | Chrome 138+ w/ flag | 所有现代浏览器 | 所有现代浏览器 |
| WebGL 着色器 | ✅ | ✅ | ❌ |
| DOM 交互 | ✅（实时） | ⏳（快照） | ✅（实时） |
| 性能 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| 包大小 | 0 KB | +0 KB（html2canvas 作为外部依赖） | 0 KB |
| 设置方式 | 双 canvas（source + overlay） | 覆盖画布 | 内联样式 |
| backgroundTarget | ✅ 通过 `layoutsubtree` 子元素采样本地区域 | ✅ 从共享快照裁切 | ❌（使用 `backdrop-filter`） |
| 共享背景成本 | N/A（每帧上传） | 每个背景一次 `html2canvas`，跨卡片共享 | N/A |
| 在不支持浏览器上强制 | → 降级到 html2canvas | — | — |
