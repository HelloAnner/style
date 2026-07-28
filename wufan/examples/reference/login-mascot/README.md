# 悟帆 AI 登录小人

这是当前悟帆登录页紫蓝小人的可直接复用实现。它不是位图素材，而是带交互的 SVG：

- `WufanLoginMascot.tsx`：React + Framer Motion 版本，默认行为与生产实现一致；
- `spec.json`：机器可读的几何、颜色、定位和动效参数；
- `demo.html`：零构建依赖的浏览器参考页，用于查看眨眼、漂浮和瞳孔跟随；
- `index.ts`：组件导出入口。

## 结论与来源

本地 `/Users/anner/fine/ai/corevo` 的当前检出版本是
`14394dc7ca16aa13c62e8a089c6ffff4953424f3`。其中
`web/src/pages/auth/AuthPage.tsx` 仍是旧版居中玻璃卡片，**没有截图中的小人**。

当前小人的精确实现来自已归档的线上生产 JS `SRC-013`，并与用户本轮提供的
完整登录页 `SRC-054` 和局部截图 `SRC-055` 交叉核对。源值映射见
`../../../evidence/measurements/login-mascot-source-map.md`。

## React 使用

项目需要 `react` 和 `framer-motion`：

```tsx
import { WufanLoginMascot } from './WufanLoginMascot';

export function LoginShell() {
  return (
    <main style={{ width: '100vw', height: '100dvh', position: 'relative' }}>
      <WufanLoginMascot />
      {/* 登录面板必须以 z-index: 2 覆盖在小人右侧，才能形成来源中的探头效果。 */}
    </main>
  );
}
```

严格复刻时不要覆盖默认 `style`。组件根节点已经包含来源定位：

```text
right: clamp(384px, 28.4vw, 444px)
top: 52%
transform: translateY(-50%) scaleX(-1)
z-index: 1
```

来源登录面板位于 `z-index: 2`，桌面宽度为
`clamp(400px, 29.4vw, 460px)`，距离右/上/下均为 `16px`。小人并非裁切成半圆，
而是由面板覆盖右侧后形成“探头”效果。

组件默认 `desktopOnly={true}`，在 `max-width: 767px` 时返回空节点，对齐来源登录壳层。
若目标系统已经在父级执行相同 mobile 分支，可显式传入 `desktopOnly={false}`，但父级仍须保证
移动端不渲染。

## 行为

- 主体 SVG：`240×300`，`viewBox="0 0 30 38"`，允许 overflow；
- 椭圆：`cx=6 cy=19 rx=24 ry=19`；
- 渐变：`#EC4899 → #8B5CF6 → #3B82F6`；
- 上下漂浮：`0 → -5 → 0px`，`5s easeInOut infinite`；
- 眨眼：随机 `3–7s` 一次，闭眼 `150ms`；
- 视线：只响应角色左侧 ±70° 范围，200ms 后更新目标，每帧按 `0.08` 插值；
- 移动端：来源登录壳层不渲染该角色，不要缩小后继续显示；
- light/dark：角色本身值相同；主题差异来自页面画布、光晕和登录面板。

## 验证

直接打开 `demo.html`，将视口设为 `1598×961`；追加 `?theme=dark` 可查看暗色上下文。
参考截图与实际渲染放在
`../../validation/login-mascot/`。当前组件的来源几何、默认姿态、眨眼、漂浮和视线跟随已验证；
完整登录页仍须按 `quality/acceptance.md` 做主题和多视口回归。

## 不要这样做

- 不要把截图裁成 PNG 当组件；
- 不要把椭圆改成普通半圆或 CSS `border-radius` 近似；
- 不要交换渐变方向；
- 不要去掉根节点的 `scaleX(-1)`；
- 不要让瞳孔超出 `orbitR - pupilR`；
- 不要在移动端强行保留；
- 不要把聊天空状态的无眼流体头像当成这个登录小人。
