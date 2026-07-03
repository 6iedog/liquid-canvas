# Core API 参考

## `glass()`

主要入口函数。在目标元素上创建液态玻璃效果。

### 签名

```typescript
function glass(
  targetOrConfig: string | HTMLElement | GlassInput,
  options?: Partial<GlassOptions>,
): Promise<GlassInstance>
```

### 用法

```typescript
import { glass } from "@liquid-canvas/core"

// 通过选择器
const inst1 = await glass("#my-element", { effect: "liquid-glass" })

// 通过元素
const el = document.querySelector("#my-element")
const inst2 = await glass(el, { effect: "liquid-glass" })

// 通过配置对象
const inst3 = await glass({
  target: "#my-element",
  effect: "liquid-glass",
  options: { refraction: 0.6, blur: 0.3 },
  adapter: "auto",
})
```

### GlassInput

```typescript
interface GlassInput {
  target: string | HTMLElement
  effect?: string
  options?: Partial<GlassOptions>
  adapter?: "auto" | "native" | "html2canvas" | "css"
}
```

### GlassOptions

```typescript
interface GlassOptions {
  effect: string           // 效果插件 ID
  refraction: number       // 0.0 – 1.0（仅 liquid-glass）
  blur: number             // 0.0 – 1.0
  chromaticAberration: number // 0.0 – 0.1（仅 liquid-glass）
  edgeHighlight: number    // 0.0 – 1.0
  specular: number         // 0.0 – 1.0
  fresnel: number          // 0.0 – 1.0
  cornerRadius: number     // px
  tintStrength: number     // 0.0 – 1.0
  shadowOpacity: number    // 0.0 – 1.0
  responsive: boolean      // 跟踪鼠标？（默认: true）
  adapter: "auto" | "native" | "html2canvas" | "css"
  debug?: boolean           // 启用调试日志（默认: false）
  backgroundTarget?: string | HTMLElement // WebGL 纹理来源元素
}
```

### GlassInstance

```typescript
interface GlassInstance {
  readonly element: HTMLElement
  readonly adapterType: "native" | "html2canvas" | "css"
  readonly fps: number
  setOptions(options: Partial<GlassOptions>): void
  markChanged(): void
  dispose(): void
}
```

## `registry`

插件注册表单例。

```typescript
import { registry } from "@liquid-canvas/core"

// 注册自定义插件
registry.register(myPlugin)

// 获取插件
const plugin = registry.get("liquid-glass")

// 列出所有插件
const all = registry.getAll()

// 注销
registry.unregister("my-plugin")
```

## 内置导出

```typescript
import {
  glass,
  registry,
  Engine,
  version,
  // 类型
  type GlassOptions,
  type GlassInstance,
  type AdapterType,
  type GlassAdapter,
  type GlassEffectPlugin,
  type ControlDescriptor,
  type MouseState,
} from "@liquid-canvas/core"
```

### Effects 子路径

```typescript
import { liquidGlass, frostredGlass } from "@liquid-canvas/core/effects"
```
