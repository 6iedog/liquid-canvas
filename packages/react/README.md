# @liquid-canvas/react

React binding for `@liquid-canvas/core` — brings iOS Liquid Glass effects to your React apps.

## Install

```bash
npm install @liquid-canvas/react
```

## Quick Start

```tsx
import { Glass } from "@liquid-canvas/react"

function App() {
  return (
    <Glass
      effect="liquid-glass"
      options={{ refraction: 0.6, blur: 0.3 }}
      className="my-panel"
    >
      <h2>Hello Glass</h2>
    </Glass>
  )
}
```

> [📖 Documentation](https://6iedog.github.io/liquid-canvas/) &nbsp;|&nbsp; [📦 GitHub](https://github.com/6iedog/liquid-canvas) &nbsp;|&nbsp; [🐛 Issues](https://github.com/6iedog/liquid-canvas/issues)
