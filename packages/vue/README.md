# @liquid-canvas/vue

Vue binding for `@liquid-canvas/core` — brings iOS Liquid Glass effects to your Vue apps.

## Install

```bash
npm install @liquid-canvas/vue
```

## Quick Start

```vue
<template>
  <Glass effect="liquid-glass" :options="options">
    <h2>Hello Glass</h2>
  </Glass>
</template>

<script setup>
import { Glass } from "@liquid-canvas/vue"
const options = { refraction: 0.6, blur: 0.3 }
</script>
```

> [📖 Documentation](https://6iedog.github.io/liquid-canvas/) &nbsp;|&nbsp; [📦 GitHub](https://github.com/6iedog/liquid-canvas) &nbsp;|&nbsp; [🐛 Issues](https://github.com/6iedog/liquid-canvas/issues)
