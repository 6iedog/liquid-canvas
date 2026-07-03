# 安装

## 核心库

```bash
npm install @liquid-canvas/core
```

## 框架绑定

```bash
# React
npm install @liquid-canvas/react

# Vue
npm install @liquid-canvas/vue
```

## 可选依赖

核心库有一个可选的对等依赖：

| 包 | 需要场景 | 可选 |
|---|---------|------|
| `html2canvas` ^1.4.1 | HTML2CanvasAdapter | 是（CSS 降级无需此依赖） |

如果需要跨浏览器 WebGL 渲染，安装它：

```bash
npm install html2canvas
```

## CDN

你也可以通过 CDN 直接使用：

```html
<script type="importmap">
{
  "imports": {
    "@liquid-canvas/core": "https://esm.sh/@liquid-canvas/core"
  }
}
</script>
```
