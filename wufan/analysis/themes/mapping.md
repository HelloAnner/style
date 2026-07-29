# Light / Dark 语义映射

## 基础映射

| Semantic | Light | Dark |
|---|---|---|
| canvas | `#FAF9F7` | `#0A0A0F` |
| surface.default | `#FFFFFF` | `#121218` |
| surface.subdued | `#F5F4F2` | `#16161C` |
| surface.elevated | `#FFFFFF` | `#1A1A20` |
| text.primary | `#1A1A1A` | `#FAFAFA` |
| text.secondary | `#3A3A3A` | `#E4E4E7` |
| text.tertiary | `#5A5A5A` | `#A1A1AA` |
| text.muted | `#7A7A7A` | `#71717A` |
| text.placeholder | `#9A9A9A` | `#52525B` |
| border.subtle | `rgba(0,0,0,.06)` | `rgba(255,255,255,.04)` |
| border.muted | `rgba(0,0,0,.04)` | `rgba(255,255,255,.03)` |
| sidebar | `#FFFFFF` | `rgba(18,18,24,.5)` |
| input | `#FAFAFA` | `#27272A` |
| bubble.user | `#F0EFED` | `#1A1A20` |
| bubble.agent | `#FFFFFF` | `#16161C` |
| modal.backdrop | `rgba(0,0,0,.4)` | `rgba(0,0,0,.7)` |
| send.active.bg | `#18181B` | `#FFFFFF` |
| send.active.icon | `#FFFFFF` | `#18181B` |
| feedback.success | `#16A34A` | `#22C55E` |

`Observed · exact-source/runtime · high · SRC-040, SRC-042`

## 完整机器映射

- 聚合：`../../system/tokens.json`；
- Light 453 个运行时变量：`../../system/themes/light.tokens.json`；
- Dark 449 个运行时变量：`../../system/themes/dark.tokens.json`；
- 93 个变量在两主题中完全相同；其余按 mode 独立读取。

## 主题切换

- 源码机制：`<html data-theme="light|dark">`；默认 dark；localStorage key `corevo-theme`。`Observed · exact-source · high · SRC-004`
- 当前生产登录页可通过界面按钮切换，自动化已验证两主题渲染。`Observed · high · SRC-024–035`
- 对话代码参考在同一组件树通过 `data-theme` 切换两套展开值；desktop/mobile 已本地运行，
  见 `examples/validation/chat-page/`。这不替代缺失的 dark populated/mobile 来源截图。
- 严格实现不得运行时算法反色；读取完整主题展开文件。
- 当前切换在 React mount 后读取 localStorage，理论上存在首屏闪烁窗口；复刻来源时保留事实，若优化需用户确认。

## 例外

- 登录小人的 SVG 本体、三色渐变、粉色圆点、浮动、眨眼和视线追踪在 light/dark 间共享同一组精确值；不可对其反色或随主题改色。两主题仅替换周边页面 Token。`Observed · exact-source/runtime · high · SRC-013, SRC-024–SRC-025, SRC-054–SRC-055, EVD-006`
- Marketing 页面固定暗色，使用 `system/marketing.tokens.json`，不参与此映射。
- What’s New 当前生产实现与较旧源码组件不同，应以 `SRC-013/SRC-014` 为准。
