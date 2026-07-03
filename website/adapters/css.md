# CSS Adapter

The fallback adapter that works in every browser. Applies CSS `backdrop-filter` and an optional SVG filter overlay.

## How it works

```typescript
// CSSAdapter applies:
element.style.backdropFilter = "blur(6px) saturate(180%)"
element.style.backgroundColor = "rgba(255, 255, 255, 0.12)"
element.style.borderRadius = "24px"
element.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.3), 0 2.4px 7.2px rgba(0,0,0,0.2)"
```

When the effect plugin provides an SVG filter (`getSVGFilter()`), it's also applied:

```css
.glass-fallback {
  backdrop-filter: blur(12px) saturate(180%);
  filter: url(#liquid-glass-fallback);
  background: rgba(255, 255, 255, 0.15);
  border-radius: 24px;
}
```

## Original style restoration

`CSSAdapter` saves the original `backdropFilter`, `backgroundColor`, `borderRadius`, `boxShadow`, and `filter` values on init and restores them on `dispose()`.

## When to use

- As the universal fallback
- When performance is critical (no WebGL overhead)
- When targeting older browsers
- The visual effect is simpler than WebGL adapters but still attractive
