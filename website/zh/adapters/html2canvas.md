# HTML2Canvas 适配器

使用 `html2canvas` 捕获 `backgroundTarget` 元素，裁切到卡片本地区域，上传为 WebGL 纹理，并在覆盖画布上运行效果的片段着色器。

## 工作原理

### 双路径捕获（snapshot + crop）

`html2canvas` 非常昂贵（克隆整个 DOM、计算样式）。为保持渲染循环流畅，捕获被拆成两条路径：

1. **`takeSnapshot()`**（慢，约 300–500ms）— 将整个 `backgroundTarget` 捕获到缓存画布。仅在背景真正变化时（`markChanged()`、背景切换）运行。
2. **`cropFromSnapshot()`**（快，约 1ms）— 用 `drawImage` 从缓存快照中裁出卡片区域。可在每次 scroll / resize 时安全运行。

### 共享快照缓存（模块级）

针对**同一背景元素**的多个适配器实例在模块级共享一份快照。没有这个机制，N 个卡片在同一 `#page-bg` 上会触发 N 次独立的 `html2canvas` 调用 — 6 卡片测试矩阵会耗时约 9 秒。有了缓存，只有第一个适配器付出代价，其余瞬时命中缓存。

- 缓存键：`bgIdentity`（选择器或元素指纹）+ `version`（任一适配器的 `markChanged()` 会 bump）。
- **in-flight 合并**：当适配器 A 开始快照时，等待同一 bg+version 的适配器 B/C/D 会 await 同一个 Promise，而不是各自发起。
- `markChanged()` bump 全局版本号，使所有共享该背景的适配器的缓存失效。

### scale: 1（不用 dpr）

快照以 `scale: 1`（CSS 像素）捕获。以 `devicePixelRatio` 捕获在 retina 上产生 4 倍像素且慢 4 倍 — 而玻璃着色器本就会模糊背景，高分辨率是浪费。裁切坐标也用 CSS 像素匹配。

### 渲染循环

每帧：
1. 若 `needsFullSnapshot` 已设（且距上次快照 >500ms），运行 `takeSnapshot()`。
2. 若 `needsCrop` 已设（scroll/resize），运行 `cropFromSnapshot()`。
3. 运行 WebGL 着色器。

## 性能特征

- **某背景上的第一张卡片**：约 300–500ms（一次 `html2canvas` 调用）。
- **同一背景上的后续卡片**：约 0ms（缓存命中）。
- **scroll / resize**：每卡片约 1ms（仅 `drawImage` 裁切 + 纹理上传）。
- **每帧**：仅运行 WebGL 着色器 — 无 DOM 操作。

## 要求

```bash
npm install html2canvas
```

或通过 CDN 引入：

```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```

适配器在 `window.html2canvas` 不存在时会动态 import，因此无论 script 标签还是打包器都能工作。

## 适用场景

- 需要在所有现代浏览器中获得完整的 WebGL 着色器效果（默认的跨浏览器路径）。
- 多个玻璃卡片共享同一背景（共享缓存使第一张卡片之后近乎免费）。
- 适用于大多数场景 — 唯一成本是每个背景的初始快照。

## 示例

```typescript
await glass("#panel", {
  effect: "liquid-glass",
  adapter: "html2canvas",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
  blur: 0.3,
})
```
