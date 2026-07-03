# 磨砂玻璃效果

受 macOS/iOS 磨砂玻璃启发的简化效果 — 模糊 + 色调 + 饱和度增强，使用与 `liquid-glass` 相同的圆角矩形 SDF，但**没有**折射、色差、菲涅尔或镜面高光。

## 视觉特性

| 效果 | 描述 |
|------|------|
| 圆角矩形 SDF | 与 liquid-glass 相同的 SDF，用于边缘高光和 alpha 抗锯齿 |
| 高斯模糊 | 多抽头采样 |
| 磨砂色调 | 冷色蓝白偏移（比 liquid-glass 更强） |
| 顶部渐变高光 | 柔和的顶边亮度 |
| Rim 光 | SDF 距离驱动的薄边缘高光 |
| Alpha 抗锯齿边缘 | SDF 抗锯齿 alpha — 圆角外部透明，无黑框 |

> 适用于不需要 liquid-glass 光学扭曲的简洁磨砂外观。渲染开销更低（无多次采样色散、无折射计算）。

## 选项

| 参数 | 类型 | 默认值 | 范围 | 描述 |
|------|------|--------|------|------|
| `blur` | number | 0.5 | 0.0 – 1.0 | 高斯模糊强度 |
| `edgeHighlight` | number | 0.08 | 0.0 – 1.0 | 顶部渐变 + rim 光 |
| `tintStrength` | number | 0.1 | 0.0 – 1.0 | 色调不透明度 |
| `cornerRadius` | number | 24 | px | 边框圆角 |

> `refraction`、`chromaticAberration`、`specular`、`fresnel` 对本效果无效（仅 liquid-glass 使用）。传入它们无害。

## 示例

```typescript
import { glass } from "@liquid-canvas/core"

await glass("#panel", {
  effect: "frosted-glass",
  blur: 0.5,
  edgeHighlight: 0.08,
  tintStrength: 0.1,
  cornerRadius: 24,
})
```

## CSS 降级

使用 `backdrop-filter: blur() saturate(180%)` 配合 `background-color` 冷色调。不使用 SVG 置换滤镜（那是 liquid-glass 专属）。
