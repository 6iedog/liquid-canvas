---
layout: home

hero:
  name: "Liquid Canvas"
  text: "iOS Liquid Glass for the Web"
  tagline: Three-tier progressive enhancement · Native → HTML2Canvas → CSS · Framework-agnostic
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Live Demo
      link: https://github.6iedog.com/liquid-canvas/demo/
    - theme: alt
      text: GitHub
      link: https://github.com/6iedog/liquid-canvas

features:
  - icon: 🎨
    title: Three-tier Fallback
    details: Native (HTML-in-Canvas) → HTML2Canvas (WebGL) → CSS (backdrop-filter + SVG). Auto-detects browser capability and degrades gracefully.
    link: /adapters/overview
    linkText: Explore Adapters →
  - icon: ✨
    title: Liquid Glass Effect
    details: SDF-based refraction, chromatic aberration, fresnel rim glow, specular highlights. Faithful iOS-style optical simulation, not just blur.
    link: /effects/liquid-glass
    linkText: View Effect →
  - icon: 🌫️
    title: Frosted Glass Effect
    details: Clean blur + tint + saturation. Simpler and cheaper than liquid-glass when you don't need optical distortion.
    link: /effects/frosted-glass
    linkText: View Effect →
  - icon: 🧩
    title: Plugin System
    details: Register custom GLSL shader effects. Each effect ships its own fragment shader, controls, and SVG fallback.
    link: /api/core
    linkText: Core API →
  - icon: ⚛️
    title: React Binding
    details: Drop-in <Glass> component with props for all options. SSR-safe, ref-forwarding, automatic cleanup.
    link: /api/react
    linkText: React Docs →
  - icon: 💚
    title: Vue Binding
    details: Drop-in <Glass> component with v-model:options support. Composition API, auto-cleanup on unmount.
    link: /api/vue
    linkText: Vue Docs →
  - icon: ⚡
    title: Shared Snapshot Cache
    details: Multiple glass cards over the same background share one html2canvas snapshot. 6-card matrix inits in ~1s instead of ~9s.
    link: /adapters/html2canvas
    linkText: How it works →
  - icon: 🛡️
    title: Graceful Degradation
    details: Forcing adapter:"native" on unsupported browsers auto-falls-back to html2canvas. Cards never stay transparent.
    link: /adapters/native
    linkText: Native Adapter →
---
