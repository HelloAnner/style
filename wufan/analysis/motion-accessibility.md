# 动效与可访问性

## 动效事实

- 全局 transition：150/200/300ms，默认曲线 `cubic-bezier(.4,0,.2,1)`；
- Sidebar 宽度：200ms easeInOut；mobile drawer：220ms easeOut；
- Message/overlay 常用 200ms opacity + 8–24px 位移；
- Whats New 旧源码：200ms scale `.96→1` + y `12→0`，当前线上版本需另采录屏；
- streaming cursor：1s infinite；skeleton：1.5s ease-in-out；
- 官网含 Lottie/抽象对象动画，静态截图通过暂停动画获得可重复结果；原始时序尚未录制。
- 登录小人漂浮为 `5s easeInOut infinite`、Y `0→-5→0px`；每 `3–7s` 随机眨眼 150ms；视线 200ms 延迟后以每帧 `.08` 插值跟随。`Observed · exact-source · high · SRC-013, EVD-006`
- 对话消息进入：opacity `0→1`、Y `20→0px`、300ms ease-out；参考实现的
  `prefers-reduced-motion` 分支会关闭该进入动效。`Observed source + Recommended explicit deviation · SRC-013, EVD-007`
- Process Trace：note y12/opacity 180ms ease-out；运行文案 shine 1.4s linear；spinner
  1s linear；chevron 150ms。`prefers-reduced-motion` 关闭循环和迁移。`SRC-057, EVD-008`
- 右面板：width/flex-basis/padding 300ms ease，关闭后延迟卸载。`SRC-058, EVD-009`
- 执行通知：x40/scale.96 进入，x20/scale.97 离开，300ms
  cubic-bezier(.34,1.2,.64,1)；5s timer，hover 暂停。`SRC-058/060, EVD-009`

`Observed · exact-source · high · SRC-004, SRC-006, SRC-012`

## reduced motion

源码明确为部分 pulse 动画实现 `prefers-reduced-motion: reduce`，但没有证据证明所有 Framer/CSS/Marketing 动画都覆盖。登录小人生产实现未包含 reduced-motion 分支；严格复刻应保留来源事实，同时记录其持续动效风险。`Observed + Unknown · medium · SRC-013, TODO-006`

## 键盘与焦点

- Chat 使用真实 button/input，mobile Sidebar 有 aria-label；
- 源码全局 `input:focus, textarea:focus, button:focus { outline:none }`，需要组件自行提供 focus-visible；
- 当前证据未验证完整键盘顺序、焦点环、dialog focus trap 和关闭后焦点恢复；
- 严格复刻时不能擅自新增不同视觉，但应把缺失焦点风险告知用户。
- 对话参考保留来源的无全局 outline 事实，没有未经批准新增 focus-visible 视觉；消费前仍需
  通过 REQ-006 补齐当前生产焦点证据。
- 点踩浮层支持 Escape、outside click 和 resize/scroll 重定位；参考源码没有完整 focus trap，
  因此仍不能称 dialog keyboard path validated。`SRC-058`

## 对比度初步风险

- dark muted `#71717A` on `#0A0A0F`、极低 alpha border 是刻意低对比；
- Marketing muted 文本 `rgba(245,242,234,.52)` 与大字号组合需逐项测；
- What’s New 浅灰日期/正文需要在原始 viewport 做对比度检查；
- 尚未完成 WCAG 数值矩阵，不得声称可访问性 validated。

## 触控与响应式

- 常见图标按钮 28/32px，低于建议 44px 触控目标；mobile 可能通过间距提供命中区，但未验证；
- 登录 mobile 已观察；登录后 Product mobile 未观察；
- hover-only 消息操作在触屏上的替代入口尚未确认。

## 后续验证

需要：主题切换录屏、官网/应用关键动效录屏、键盘全路径、focus-visible 截图、dialog focus trap、reduced-motion 自动截图、对比度脚本及移动触控验证。
