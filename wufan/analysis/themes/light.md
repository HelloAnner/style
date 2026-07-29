# Product Light Theme

## 核心语义

| 语义 | 精确值 |
|---|---|
| canvas / `--bg-primary` | `#FAF9F7` |
| surface / `--bg-secondary` | `#FFFFFF` |
| subdued / `--bg-tertiary` | `#F5F4F2` |
| elevated | `#FFFFFF` |
| text primary | `#1A1A1A` |
| text secondary | `#3A3A3A` |
| text tertiary | `#5A5A5A` |
| text muted | `#7A7A7A` |
| placeholder | `#9A9A9A` |
| border subtle/muted/faint | `rgba(0,0,0,.06/.04/.03)` |
| sidebar | `#FFFFFF` |
| input | `#FAFAFA` |
| user bubble | `#F0EFED` |
| agent bubble | `#FFFFFF` |
| glass | `rgba(255,255,255,.92)`, blur `8px` |
| panel shadow | `0 1px 3px rgba(0,0,0,.02), 0 4px 12px rgba(0,0,0,.015)` |
| modal backdrop | `rgba(0,0,0,.4)` |

`Observed · exact-source/runtime · high · SRC-012, SRC-042`

## 行为

- 不是冷白：canvas 必须保留 `#FAF9F7` 暖底；
- 主要 surface 用白色，次级控件用 `#F5F4F2/#F0EFED`；
- 文字不用纯黑；层级依次 1A/3A/5A/7A/9A；
- active send 为 `#18181B` 底 + 白图标；
- success 在 light 为 `#16A34A`，与 dark 的 `#22C55E` 不同；
- 登录页和聊天截图均显示极轻边框/阴影、大面积留白和紫蓝光晕。

## 已观察页面

- 登录 desktop/mobile：`SRC-032–SRC-035, SRC-042–SRC-043, SRC-054–SRC-055`；
- 登录小人 desktop：完整页与局部原图由 `SRC-054–SRC-055` 补充；SVG 几何、颜色、浮动、眨眼和视线追踪由生产包 `SRC-013` 精确还原并记录在 `EVD-006`；
- 登录后聊天 desktop：`SRC-003`；
- 对话参考 light desktop/mobile actual：`examples/validation/chat-page/`（desktop 有 SRC-003
  结构核对；mobile 仅源码行为验证）；
- What’s New 局部：`SRC-014`。

## 未完成

新任务、设置、工作台等页面缺少与 dark 相同页面/状态的 light 配对；对话虽已有 light/dark
可运行代码，但 dark 同状态原图、mobile 原图及 hover/focus/error/open 完整矩阵仍缺失。
