> 一个基于 html-in-canvas 的渐进增强型液态玻璃效果库
> 框架无关 · 插件化 · 三阶回退（Native → html2canvas → CSS）

---

## 一、项目概述

### 1.1 定位

将 iOS Liquid Glass（液态玻璃）效果带到 Web 的开源库。核心是一个框架无关的引擎，效果通过插件注册，渲染通过 Adapter 自适应。

### 1.2 包结构（Monorepo）

```plain
@liquid-canvas/
├── core/                  # 框架无关核心引擎
│   ├── src/
│   │   ├── engine.ts          # 主引擎：生命周期、渲染循环
│   │   ├── adapter.ts         # Adapter 接口定义
│   │   ├── adapters/
│   │   │   ├── native.ts      # drawElementImage() 适配器
│   │   │   ├── html2canvas.ts # html2canvas 适配器
│   │   │   └── css.ts         # CSS backdrop-filter 适配器
│   │   ├── plugin.ts          # 插件系统
│   │   ├── effects/
│   │   │   ├── liquid-glass.ts  # 液态玻璃效果插件
│   │   │   └── frosted-glass.ts # 磨砂玻璃效果插件
│   │   └── types.ts           # 公共类型定义
│   └── package.json
├── react/                 # React 绑定
├── vue/                   # Vue 绑定
└── docs/                  # 文档站源码
```

### 1.3 三阶渐进增强策略

```plain
检测顺序：
1. 浏览器支持 drawElementImage()  → NativeAdapter（最高性能、完整功能）
2. html2canvas 已加载              → HTML2CanvasAdapter（跨浏览器、完整功能）
3. 兜底                           → CSSAdapter（仅毛玻璃模糊）
```

---

## 二、核心 API 设计

### 2.1 主入口

```typescript
// 最小使用
import { glass } from '@liquid-canvas/core'

const instance = glass('#my-element', {
  effect: 'liquid-glass',
})

// 完整配置
const instance = glass({
  target: document.querySelector('#panel'),
  effect: 'liquid-glass',
  options: {
    refraction: 0.6,
    blur: 0.3,
    chromaticAberration: 0.04,
    edgeHighlight: 0.08,
    specular: 0.15,
    fresnel: 1.0,
    cornerRadius: 24,
    tintStrength: 0.1,
    shadowOpacity: 0.3,
    responsive: true,     // 默认跟踪鼠标
    backgroundTarget: '#page-bg', // 可选：作为 WebGL 纹理来源的独立背景元素
  },
  adapter: 'auto',        // auto | native | html2canvas | css
})

// 生命周期
instance.dispose()
```

### 2.2 返回值

```typescript
interface GlassInstance {
  /** 挂载的目标元素 */
  readonly element: HTMLElement
  /** 当前使用的适配器类型 */
  readonly adapterType: 'native' | 'html2canvas' | 'css'
  /** 当前 FPS（仅 WebGL 模式下有效） */
  readonly fps: number
  /** 更新配置 */
  setOptions(options: Partial<GlassOptions>): void
  /** 手动标记内容已变更，触发重绘 */
  markChanged(): void
  /** 销毁实例，清理资源 */
  dispose(): void
}
```

---

## 三、Adapter 接口（核心抽象）

### 3.1 接口定义

```typescript
interface GlassAdapter {
  readonly type: 'native' | 'html2canvas' | 'css'

  /** 初始化 */
  init(target: HTMLElement, options: GlassOptions): Promise<void>

  /** 每帧渲染 */
  render(time: number): void

  /** 更新配置 */
  setOptions(options: Partial<GlassOptions>): void

  /** 标记内容变更 */
  markChanged(element?: HTMLElement): void

  /** 销毁 */
  dispose(): void

  /** 当前 FPS */
  readonly fps: number
}
```

### 3.2 NativeAdapter 实现要点

**依赖 API**： `<canvas layoutsubtree>`、 `drawElementImage()`、 `paint` 事件、 `texElementImage2D()`（WebGL）

**两种工作模式**：

#### 默认模式（无 backgroundTarget）

```html
<!-- 用户只需要写这个 -->
<div id="target">
  <p>Hello Glass</p>
  <button>Click</button>
</div>
```

**内部转换**（自动包裹）：

```html
<!-- NativeAdapter 自动将目标元素移入 canvas -->
<div class="glass-scene">
  <canvas layoutsubtree>
    <div id="target">
      <p>Hello Glass</p>
      <button>Click</button>
    </div>
  </canvas>
  <canvas id="glass-overlay"></canvas>
</div>
```

**渲染管道**：

```plain
paint 事件触发
  → ctx2d.clearRect()
  → ctx2d.drawElementImage(target, 0, 0)    // 将 HTML 内容绘入 2D canvas
  → WebGL 将 2D canvas 作为纹理
  → Fragment Shader 应用折射效果
  → 输出到 overlay canvas
```

#### backgroundTarget 模式

当设置 `options.backgroundTarget` 时，适配器采用不同策略：

1. **不移动目标元素**，保留在原 DOM 位置
2. 在目标元素上应用 CSS 玻璃基础样式（`backdrop-filter`、`border-radius`、`box-shadow` 等），与 CSSAdapter 一致
3. 创建 offscreen canvas，用 `drawElementImage(backgroundEl)` 捕获背景元素
4. 创建 WebGL overlay canvas 覆盖在目标元素上方
5. 将背景捕获结果作为 WebGL 纹理，应用片段着色器

该模式适用于"全屏背景上的浮动玻璃面板"场景：

```typescript
glass({
  target: '#panel',
  effect: 'liquid-glass',
  options: { backgroundTarget: '#page-bg', refraction: 0.6, blur: 0.3 },
})
```

HTML2CanvasAdapter 同样支持 `backgroundTarget`，截图目标改为 `backgroundEl`。

**关键性能优化**：

- 仅在 `paint` 事件触发时才重绘 2D canvas
- WebGL 渲染循环持续运行（requestAnimationFrame），但复用缓存的纹理
- 鼠标移动仅更新 uniform 变量，不重绘 2D canvas
- backgroundTarget 模式下不需要包裹 target，DOM 结构改动更小

### 3.3 HTML2CanvasAdapter 实现要点

**依赖**：html2canvas 库（1.4.1+），作为 peer dependency

```typescript
// 伪代码
class HTML2CanvasAdapter implements GlassAdapter {
  async init(target, options) {
    // 1. 创建与 target 等大的隐藏 canvas
    // 2. 创建 WebGL 叠加 canvas
    // 3. 启动渲染循环
  }

  async captureDOM() {
    // 使用 html2canvas 截取 target 及其内容
    const canvas = await html2canvas(target, {
      scale: window.devicePixelRatio,
      useCORS: true,
      logging: false,
    })
    // 将结果作为 WebGL 纹理上传
    this.updateTexture(canvas)
  }

  markChanged(element) {
    // 标记需要重新截取
    this.needsCapture = true
  }

  render(time) {
    if (this.needsCapture) {
      this.captureDOM()
      this.needsCapture = false
    }
    // 执行 WebGL 渲染
    this.renderShader(time)
  }
}
```

**性能优化**：

- 默认每 100ms 限流一次截取
- 支持 `data-dynamic` 属性标记高频更新元素
- 根据鼠标是否悬停动态调整截取频率

### 3.4 CSSAdapter 实现要点

最简单的回退方案，不需要 Canvas/WebGL：

```typescript
class CSSAdapter implements GlassAdapter {
  init(target, options) {
    // 在 target 上应用 CSS 样式
    Object.assign(target.style, {
      backdropFilter: `blur(${options.blur * 20}px) saturate(180%)`,
      backgroundColor: `rgba(255, 255, 255, ${0.1 + options.tintStrength * 0.2})`,
      borderRadius: `${options.cornerRadius}px`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3),
                  0 ${options.shadowOpacity * 8}px ${options.shadowOpacity * 24}px rgba(0,0,0,0.2)`,
    })
  }
  // render() 为空 — CSS 自动处理
}
```

---

## 四、插件系统

### 4.1 插件接口

```typescript
interface GlassEffectPlugin {
  /** 插件唯一标识 */
  id: string
  /** 显示名称 */
  name: string

  /** 生成 WebGL Fragment Shader（Native/HTML2Canvas 用） */
  getFragmentShader(): string

  /** 生成 SVG Filter（纯 CSS 方案用，可选） */
  getSVGFilter?(): { filter: string; id: string } | null

  /** 初始化 uniform 值 */
  getDefaultUniforms(): Record<string, number | number[]>

  /** 每帧更新 uniform（鼠标位置、时间等由引擎注入） */
  updateUniforms?(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Record<string, number>,
    time: number,
    mouse: { x: number; y: number; hovering: boolean }
  ): void

  /** 暴露给 GUI 的控制参数 */
  getControls(): ControlDescriptor[]
}

interface ControlDescriptor {
  key: string
  label: string
  type: 'slider' | 'color' | 'toggle' | 'select'
  min?: number
  max?: number
  step?: number
  default: number | boolean | string
}
```

### 4.2 插件注册

```typescript
import { registry } from '@liquid-canvas/core'
import { liquidGlass } from '@liquid-canvas/core/effects'

// 内置插件自动注册
registry.register(liquidGlass)

// 用户可以注册自定义插件
registry.register({
  id: 'my-custom-effect',
  name: '我的自定义效果',
  getFragmentShader() { return `...` },
  // ...
})

// 使用自定义插件
glass('#el', { effect: 'my-custom-effect' })
```

---

## 五、Liquid Glass 效果插件规格

这是核心效果插件，需要实现 iOS Liquid Glass 的完整光效：

### 5.1 视觉效果清单

| 效果                        | 实现方式              | 优先级 |
| :------------------------ | :---------------- | :-- |
| 边缘折射变形                    | SDF 距离场 → 折射偏移    | P0  |
| 高斯模糊（磨砂）                  | 13×13 自适应高斯采样     | P0  |
| 色差 (Chromatic Aberration) | RGB 三通道分离偏移       | P0  |
| 有机流动感                     | Simplex Noise 叠加  | P0  |
| 鼠标追踪透镜                    | uniform 传鼠标 UV 坐标 | P0  |
| 菲涅尔边缘光                    | 视角余弦映射            | P1  |
| 高光 (Specular)             | Blinn-Phong 多光源   | P1  |
| 边缘亮环                      | SDF 范围 smoothstep | P1  |
| 焦散光晕                      | Noise 驱动的焦散模拟     | P1  |
| 冷色玻璃色调                    | RGB 通道色调偏移        | P2  |

### 5.2 Fragment Shader 核心算法

```glsl
// === 输入 ===
uniform sampler2D u_texture;    // 原始 HTML 内容纹理
uniform vec2  u_resolution;     // 画布尺寸
uniform vec2  u_mouse;          // 鼠标归一化坐标
uniform float u_time;           // 运行时间
uniform float u_hover;          // 是否悬停 (0→1 平滑过渡)

// === 参数 (可通过 uniform 调节) ===
uniform float u_refraction;     // 折射强度 0.0–1.0
uniform float u_blur;           // 模糊强度 0.0–1.0
uniform float u_chromatic;      // 色差强度 0.0–1.0
uniform float u_edgeHighlight;  // 边缘高光 0.0–1.0

void main() {
  vec2 uv = v_texCoord;

  // 1. 计算鼠标到当前像素的距离（适配宽高比）
  vec2 diff = uv - u_mouse;
  diff.x *= u_resolution.x / u_resolution.y;
  float dist = length(diff);
  float dome = smoothstep(u_radius, u_radius * 0.08, dist) * u_hover;

  // 2. 有机噪声
  float n1 = simplex(uv * 6.0 + vec2(u_time * 0.55, -u_time * 0.4));
  float n2 = simplex(uv * 8.0 + vec2(-u_time * 0.3, u_time * 0.5));
  vec2 organicWarp = vec2(n1, n2) * 0.012 * dome;

  // 3. 凸透镜折射偏移
  vec2 dir = normalize(diff + 1e-6);
  vec2 refractOffset = -dir * u_refraction * 0.06 * dome;

  // 4. 涟漪
  float ripple = sin(dist * 35.0 - u_time * 2.5) * 0.003 * dome;
  vec2 rippleOffset = dir * ripple;

  // 5. 总偏移
  vec2 offset = refractOffset + organicWarp + rippleOffset;

  // 6. 色差（RGB 三通道不同偏移）
  float aberr = (0.003 + 0.007 * edge) * u_chromatic;
  vec2 uvR = clamp(uv + offset * 1.07 + dir * aberr, 0.0, 1.0);
  vec2 uvG = clamp(uv + offset, 0.0, 1.0);
  vec2 uvB = clamp(uv + offset * 0.93 - dir * aberr, 0.0, 1.0);

  vec3 color = vec3(
    texture2D(u_texture, uvR).r,
    texture2D(u_texture, uvG).g,
    texture2D(u_texture, uvB).b
  );

  // 7. 高光 + 菲涅尔 + 边缘亮环
  // ...（具体实现参考现有开源实现）

  gl_FragColor = vec4(color, 1.0);
}
```

### 5.3 CSS 回退方案

当使用 CSSAdapter 时，通过 SVG filter 模拟：

```xml
<svg style="display:none">
  <filter id="liquid-glass-fallback">
    <feTurbulence type="fractalNoise" baseFrequency="0.008"
                  numOctaves="2" seed="92" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
    <feDisplacementMap in="SourceGraphic" in2="blurred"
                       scale="50" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

CSS：

```css
.glass-fallback {
  backdrop-filter: blur(12px) saturate(180%);
  filter: url(#liquid-glass-fallback);
  background: rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 8px 32px rgba(0, 0, 0, 0.12);
}
```

---

## 六、框架绑定（辅助包）

### 6.1 React 绑定

```tsx
// @liquid-canvas/react
import { Glass } from '@liquid-canvas/react'

function Panel() {
  return (
    <Glass
      effect="liquid-glass"
      options={{ refraction: 0.6, blur: 0.3 }}
      className="my-panel"
    >
      <h2>Title</h2>
      <p>Content inside the glass.</p>
    </Glass>
  )
}
```

### 6.2 Vue 绑定

```vue
<!-- @liquid-canvas/vue -->
<template>
  <Glass effect="liquid-glass" :options="options">
    <h2>Title</h2>
    <p>Content inside the glass.</p>
  </Glass>
</template>

<script setup>
import { Glass } from '@liquid-canvas/vue'
const options = { refraction: 0.6, blur: 0.3 }
</script>
```

### 6.3 框架绑定的实现模式

框架绑定应极薄，只是将 core 的 API 映射到框架的生命周期：

```typescript
// React 示例
function Glass({ effect, options, children, ...divProps }) {
  const ref = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    const inst = glass(ref.current, { effect, options })
    instanceRef.current = inst
    return () => inst.dispose()
  }, [])

  useEffect(() => {
    instanceRef.current?.setOptions(options)
  }, [options])

  return <div ref={ref} {...divProps}>{children}</div>
}
```

---

## 七、工程配置

### 7.1 构建工具

- **打包**: tsup (基于 esbuild，快速输出 ESM/CJS)
- **TypeScript**: strict 模式
- **测试**: Vitest
- **Lint**: Biome（替代 ESLint + Prettier）

### 7.2 package.json 关键字段

```json
{
  "name": "@liquid-canvas/core",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./effects": {
      "import": "./dist/effects/index.js",
      "require": "./dist/effects/index.cjs",
      "types": "./dist/effects/index.d.ts"
    }
  },
  "sideEffects": false,
  "peerDependencies": {
    "html2canvas": "^1.4.1"
  },
  "peerDependenciesMeta": {
    "html2canvas": {
      "optional": true
    }
  }
}
```

### 7.3 开发命令

```json
{
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src/",
    "format": "biome format --write src/"
  }
}
```

---

## 八、质量要求

### 8.1 测试策略

| 层级   | 内容                   | 工具             |
| :--- | :------------------- | :------------- |
| 单元测试 | 工具函数、类型守卫、uniform 计算 | Vitest         |
| 组件测试 | Adapter 初始化、生命周期     | Vitest + jsdom |
| 视觉测试 | 截图对比（在不同浏览器上）        | Playwright     |
| 性能测试 | FPS 基准、内存泄漏检测        | 自定义 benchmark  |

### 8.2 浏览器兼容目标

| 浏览器         | Native     | html2canvas | CSS |
| :---------- | :--------- | :---------- | :-- |
| Chrome 147+ | ✅          | ✅           | ✅   |
| Chrome 稳定版  | ⏳ (待发版)    | ✅           | ✅   |
| Brave       | ✅ (需 flag) | ✅           | ✅   |
| Edge        | ⏳          | ✅           | ✅   |
| Safari      | ❌          | ✅           | ✅   |
| Firefox     | ❌          | ✅           | ✅   |

### 8.3 包体积目标

| 包               | 目标大小                  |
| :-------------- | :-------------------- |
| core (min+gzip) | < 8KB（不含 html2canvas） |
| liquid-glass 插件 | < 3KB                 |
| react 绑定        | < 1KB                 |

---

## 九、实现路线图

### Phase 1 — MVP（1-2 周）

- [ ] 项目脚手架（tsup, TypeScript, Vitest）
- [ ] `Engine` 核心类（初始化、渲染循环、生命周期）
- [ ] `GlassAdapter` 接口
- [ ] `CSSAdapter`（最简回退）
- [ ] `registry` 插件注册系统
- [ ] `liquid-glass` 效果插件（核心 shader）
- [ ] 主入口 `glass()` 函数

### Phase 2 — 跨浏览器（1 周）

- [ ] `HTML2CanvasAdapter`
- [ ] 效果插件的 SVG filter 回退
- [ ] `NativeAdapter`（接入 drawElementImage）
- [ ] Adapter 自动检测逻辑

### Phase 3 — 生态（1 周）

- [ ] React 绑定
- [ ] Vue 绑定
- [ ] 更多效果插件（frosted-glass, elastic-bulge）
- [ ] 文档站

### Phase 4 — 打磨

- [ ] Playwright 视觉测试
- [ ] 性能优化
- [ ] 发布 npm

---

## 十、关键实现参考

### 10.1 参考现有开源项目

| 项目                                                                                      | 可参考的部分                 |
| :-------------------------------------------------------------------------------------- | :--------------------- |
| [html-in-canvas.dev](https://html-in-canvas.dev/demos/liquid-glass)                     | Fragment Shader 完整实现   |
| [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js)                 | html2canvas + WebGL 架构 |
| [@ybouane/liquidglass](https://github.com/ybouane/liquidglass)                          | DOM 捕获 + 参数系统          |
| [prabinpebam/liquid-glass-for-web](https://github.com/prabinpebam/liquid-glass-for-web) | 插件化 + 材质预设             |
| [shuding/liquid-glass](https://github.com/shuding/liquid-glass)                         | SVG 滤镜回退方案             |

### 10.2 核心 Shader 参考

`html-in-canvas.dev` 的 Liquid Glass demo 中包含完整的 Fragment Shader 实现（约 120 行 GLSL），可以直接参考其：

- Simplex Noise 实现
- 透镜几何计算
- 色差偏移算法
- 高光/菲涅尔/边缘亮环的组合

该 demo 的完整 HTML 源码已存档，可作为实现参考。
