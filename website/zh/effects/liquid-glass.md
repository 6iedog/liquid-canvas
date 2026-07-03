# 液态玻璃效果

旗舰效果 — 基于圆角矩形 SDF 和三层折射模型，忠实还原 iOS 液态玻璃的全光学模拟。实现参考了 [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js)。

## 视觉特性

| 效果 | 描述 |
|------|------|
| 圆角矩形 SDF | 有符号距离场驱动所有边缘效果（折射、菲涅尔、rim 光） |
| 三层折射 | edge / rim / base 三层折射，向中心指数衰减 |
| 色差 | RGB 通道分离，集中在边缘薄层（像素空间偏移） |
| 菲涅尔边缘辉光 | 基于边缘邻近度的冷白色 rim 光照 |
| 镜面高光 | 顶部高光带 + 鼠标跟随热点（悬停时显现） |
| 高斯模糊 | 13 抽头圆形模糊，R/G/B 各自带色差偏移采样，避免模糊抹掉色散 |
| 冷色玻璃调色 | 微妙的蓝色调混合 |
| Alpha 抗锯齿边缘 | SDF 抗锯齿 alpha — 圆角外部透明，无黑框 |

> 与 `frosted-glass` 不同，本效果包含**折射 + 色差 + 菲涅尔 + 镜面高光**。位移集中在 ~25px 的边缘薄层，使面板跟随卡片的圆角，而不会变成圆形透镜。

## 选项

| 参数 | 类型 | 默认值 | 范围 | 描述 |
|------|------|--------|------|------|
| `refraction` | number | 0.6 | 0.0 – 1.0 | 边缘 + 中心折射强度 |
| `blur` | number | 0.3 | 0.0 – 1.0 | 高斯模糊强度 |
| `chromaticAberration` | number | 0.04 | 0.0 – 0.15 | RGB 通道分离（像素偏移 ≈ 值 × 120） |
| `edgeHighlight` | number | 0.08 | 0.0 – 1.0 | 边缘 rim 光 + 顶部渐变 |
| `specular` | number | 0.15 | 0.0 – 1.0 | 顶部镜面带 + 鼠标热点 |
| `fresnel` | number | 1.0 | 0.0 – 2.0 | 菲涅尔 rim 光强度 |

## 示例

```typescript
import { glass } from "@liquid-canvas/core"

// 基本用法 — 元素需要有自己的背景内容
await glass("#panel", {
  effect: "liquid-glass",
  refraction: 0.6,
  blur: 0.3,
  chromaticAberration: 0.04,
  edgeHighlight: 0.08,
  specular: 0.15,
  fresnel: 1.0,
  cornerRadius: 24,
})

// 在全屏背景上浮动 — 用 backgroundTarget 指定纹理来源
await glass(".glass-card", {
  effect: "liquid-glass",
  backgroundTarget: "#page-bg",
  refraction: 0.6,
  blur: 0.3,
  fresnel: 1.2,
})
```

## 与 frosted-glass 的区别

| 特性 | liquid-glass | frosted-glass |
|------|--------------|---------------|
| 折射 | ✅ SDF 驱动 | ❌ |
| 色差 | ✅ | ❌ |
| 菲涅尔 | ✅ | ❌ |
| 镜面高光 | ✅ | ❌ |
| 高斯模糊 | ✅ | ✅ |
| 调色 | ✅ 微弱冷色 | ✅ 较强 |
| 开销 | 较高（多次采样 + 色散） | 较低 |

## CSS 降级

使用 CSSAdapter 时，效果应用 `backdrop-filter: blur()` 配合 SVG `feTurbulence` + `feDisplacementMap` 滤镜（通过 `backdrop-filter: url(#filter)` 限定作用域，只扭曲背景不影响前景内容）。这产生了一个区别于普通毛玻璃的 liquid-like 降级效果。
