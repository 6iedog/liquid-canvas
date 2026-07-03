import { defineConfig } from "vitepress"

const sharedSidebar = {
  guide: [
    { text: "Getting Started", link: "/guide/getting-started" },
    { text: "Installation", link: "/guide/installation" },
  ],
  api: [
    { text: "Core (glass)", link: "/api/core" },
    { text: "React", link: "/api/react" },
    { text: "Vue", link: "/api/vue" },
  ],
  effects: [
    { text: "Liquid Glass", link: "/effects/liquid-glass" },
    { text: "Frosted Glass", link: "/effects/frosted-glass" },
  ],
  adapters: [
    { text: "Overview", link: "/adapters/overview" },
    { text: "CSS Adapter", link: "/adapters/css" },
    { text: "HTML2Canvas Adapter", link: "/adapters/html2canvas" },
    { text: "Native Adapter", link: "/adapters/native" },
  ],
}

const zhSidebar = {
  guide: [
    { text: "快速开始", link: "/zh/guide/getting-started" },
    { text: "安装", link: "/zh/guide/installation" },
  ],
  api: [
    { text: "Core (glass)", link: "/zh/api/core" },
    { text: "React", link: "/zh/api/react" },
    { text: "Vue", link: "/zh/api/vue" },
  ],
  effects: [
    { text: "液态玻璃", link: "/zh/effects/liquid-glass" },
    { text: "磨砂玻璃", link: "/zh/effects/frosted-glass" },
  ],
  adapters: [
    { text: "总览", link: "/zh/adapters/overview" },
    { text: "CSS 适配器", link: "/zh/adapters/css" },
    { text: "HTML2Canvas 适配器", link: "/zh/adapters/html2canvas" },
    { text: "Native 适配器", link: "/zh/adapters/native" },
  ],
}

export default defineConfig({
  title: "Liquid Canvas",
  description: "iOS Liquid Glass effects for the web",
  base: "/liquid-canvas/",
  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "API", link: "/api/core" },
          { text: "Effects", link: "/effects/liquid-glass" },
          { text: "GitHub", link: "https://github.com/6iedog/liquid-canvas" },
        ],
        sidebar: [
          { text: "Guide", items: sharedSidebar.guide },
          { text: "API Reference", items: sharedSidebar.api },
          { text: "Effects", items: sharedSidebar.effects },
          { text: "Adapters", items: sharedSidebar.adapters },
        ],
        outline: { label: "On this page" },
      },
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      themeConfig: {
        nav: [
          { text: "指南", link: "/zh/guide/getting-started" },
          { text: "API", link: "/zh/api/core" },
          { text: "效果", link: "/zh/effects/liquid-glass" },
          { text: "GitHub", link: "https://github.com/6iedog/liquid-canvas" },
        ],
        sidebar: [
          { text: "指南", items: zhSidebar.guide },
          { text: "API 参考", items: zhSidebar.api },
          { text: "效果", items: zhSidebar.effects },
          { text: "适配器", items: zhSidebar.adapters },
        ],
        outline: { label: "本页内容" },
      },
    },
  },
  themeConfig: {
    socialLinks: [{ icon: "github", link: "https://github.com/6iedog/liquid-canvas" }],
  },
})
