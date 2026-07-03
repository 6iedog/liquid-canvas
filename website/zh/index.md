---
layout: home

hero:
  name: "Liquid Canvas"
  text: "为 Web 打造的 iOS 液态玻璃"
  tagline: 三层渐进增强 · Native → HTML2Canvas → CSS · 框架无关
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 在线演示
      link: /demo/
    - theme: alt
      text: GitHub
      link: https://github.com/6iedog/liquid-canvas

features:
  - icon: 🎨
    title: 三层降级策略
    details: Native (HTML-in-Canvas) → HTML2Canvas (WebGL) → CSS (backdrop-filter + SVG)。自动检测浏览器能力并优雅降级。
    link: /zh/adapters/overview
    linkText: 了解适配器 →
  - icon: ✨
    title: 液态玻璃效果
    details: 基于 SDF 的折射、色差、菲涅尔边缘光、镜面高光。忠实还原 iOS 风格光学模拟，而非简单模糊。
    link: /zh/effects/liquid-glass
    linkText: 查看效果 →
  - icon: 🌫️
    title: 磨砂玻璃效果
    details: 干净的模糊 + 色调 + 饱和度。不需要光学畸变时比液态玻璃更简单、开销更低。
    link: /zh/effects/frosted-glass
    linkText: 查看效果 →
  - icon: 🧩
    title: 插件系统
    details: 注册自定义 GLSL 着色器效果。每个效果自带片段着色器、控件和 SVG 降级方案。
    link: /zh/api/core
    linkText: Core API →
  - icon: ⚛️
    title: React 绑定
    details: 开箱即用的 <Glass> 组件，props 对应所有选项。SSR 安全、ref 转发、自动清理。
    link: /zh/api/react
    linkText: React 文档 →
  - icon: 💚
    title: Vue 绑定
    details: 开箱即用的 <Glass> 组件，支持 v-model:options。组合式 API，卸载时自动清理。
    link: /zh/api/vue
    linkText: Vue 文档 →
  - icon: ⚡
    title: 共享快照缓存
    details: 同一背景上的多个玻璃卡片共享一份 html2canvas 快照。6 卡片矩阵 ~1s 初始化，而非 ~9s。
    link: /zh/adapters/html2canvas
    linkText: 工作原理 →
  - icon: 🛡️
    title: 优雅降级
    details: 在不支持的浏览器上强制 adapter:"native" 会自动回退到 html2canvas。卡片不会保持透明。
    link: /zh/adapters/native
    linkText: Native 适配器 →
---
