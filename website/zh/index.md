# Liquid Canvas

> 为 Web 打造的 iOS 风格液态玻璃效果 — 框架无关、基于插件、三层渐进增强。

<div class="hero-actions">

```bash
npm install @liquid-canvas/core
```

<a href="/liquid-canvas/demo/" class="demo-button" target="_blank">▶ 在线演示</a>

</div>

<iframe src="/liquid-canvas/demo/" class="demo-iframe" loading="lazy" title="Liquid Canvas 在线演示"></iframe>

## 特性

- **三层降级策略** — Native (drawElementImage) → HTML2Canvas (WebGL) → CSS (backdrop-filter + SVG)
- **插件系统** — 注册自定义 GLSL 着色器效果
- **框架绑定** — React (`@liquid-canvas/react`) 和 Vue (`@liquid-canvas/vue`)
- **内置效果** — `liquid-glass`（完整 iOS 风格）和 `frosted-glass`（简化模糊 + 色调）

## 快速开始

```typescript
import { glass } from "@liquid-canvas/core"

// 最小化使用
glass("#my-element", { effect: "liquid-glass" })

// 完整配置
const inst = await glass({
  target: document.querySelector("#panel"),
  effect: "liquid-glass",
  options: {
    refraction: 0.6,
    blur: 0.3,
    chromaticAberration: 0.04,
    cornerRadius: 24,
  },
})

// 清理
inst.dispose()
```

## 浏览器支持

| 浏览器 | Native | html2canvas | CSS |
|--------|--------|-------------|-----|
| Chrome 147+ | ✅ | ✅ | ✅ |
| Chrome stable | ⏳ | ✅ | ✅ |
| Edge | ⏳ | ✅ | ✅ |
| Safari | ❌ | ✅ | ✅ |
| Firefox | ❌ | ✅ | ✅ |

## 包

| 包 | 大小 | 描述 |
|----|------|------|
| `@liquid-canvas/core` | 39 kB | 框架无关的核心引擎 |
| `@liquid-canvas/react` | 4.6 kB | React `<Glass>` 组件 |
| `@liquid-canvas/vue` | 2.7 kB | Vue `<Glass>` 组件 |

<style>
.hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 24px 0;
}
.hero-actions .demo-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 100px;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.hero-actions .demo-button:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 20px rgba(102,126,234,0.4);
}
.demo-iframe {
  width: 100%;
  height: 560px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  margin: 24px 0 32px;
  background: #0b0d12;
}
</style>
