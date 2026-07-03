# CSS 适配器

适用于所有浏览器的降级适配器。应用 CSS `backdrop-filter` 和可选的 SVG 滤镜叠加。

## 工作原理

```typescript
// CSSAdapter 应用：
element.style.backdropFilter = "blur(6px) saturate(180%)"
element.style.backgroundColor = "rgba(255, 255, 255, 0.12)"
element.style.borderRadius = "24px"
element.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.3), 0 2.4px 7.2px rgba(0,0,0,0.2)"
```

当效果插件提供了 SVG 滤镜（`getSVGFilter()`）时，也会一并应用：

```css
.glass-fallback {
  backdrop-filter: blur(12px) saturate(180%);
  filter: url(#liquid-glass-fallback);
  background: rgba(255, 255, 255, 0.15);
  border-radius: 24px;
}
```

## 原始样式恢复

`CSSAdapter` 会在初始化时保存原始的 `backdropFilter`、`backgroundColor`、`borderRadius`、`boxShadow` 和 `filter` 值，并在 `dispose()` 时恢复。

## 适用场景

- 作为通用降级方案
- 性能要求高时（无 WebGL 开销）
- 需要支持旧浏览器时
- 视觉效果比 WebGL 适配器简单，但仍然美观
