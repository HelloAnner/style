# Product Dark Theme

## 核心语义

| 语义 | 精确值 |
|---|---|
| canvas / `--bg-primary` | `#0A0A0F` |
| surface / `--bg-secondary` | `#121218` |
| subdued / `--bg-tertiary` | `#16161C` |
| elevated | `#1A1A20` |
| text primary | `#FAFAFA` |
| text secondary | `#E4E4E7` |
| text tertiary | `#A1A1AA` |
| text muted | `#71717A` |
| placeholder | `#52525B` |
| border subtle/muted/faint | `rgba(255,255,255,.04/.03/.02)` |
| sidebar | `rgba(18,18,24,.5)` |
| input | `#27272A`（运行时最终 Token） |
| user bubble | `#1A1A20` |
| agent bubble | `#16161C` |
| glass | `rgba(18,18,24,.82)`, blur `12px` |
| panel shadow | `0 4px 16px rgba(0,0,0,.3), 0 8px 32px rgba(0,0,0,.2)` |
| modal backdrop | `rgba(0,0,0,.7)` |

`Observed · exact-source/runtime · high · SRC-012, SRC-040`

## 行为

- surface 差异仅 2%–4% 亮度，不能改成强对比深灰卡片；
- 边框接近不可见，只在相邻深色面间提供分离；
- active send 为白底 `#FFFFFF` + `#18181B` 图标；
- success 为 `#22C55E`；warning/error/info 分别为 `#F59E0B/#EF4444/#3B82F6`；
- 背景紫蓝光晕保持极低透明度；高饱和主要来自 Agent 头像和空状态圆球。

## 已观察页面

- 登录 desktop/mobile：`SRC-024–SRC-027, SRC-040–SRC-041`；
- 登录小人 desktop：`SRC-024–SRC-025` 观察到与 light 相同的 SVG 本体；精确共享值来自生产包 `SRC-013/EVD-006`，dark 只改变周边画布、面板与文字主题；
- 登录后新任务 desktop：`SRC-002`；
- Marketing 也是暗色，但使用独立 `#050509`/serif 系统，不能视作本 Product dark。

## 未完成

对话详情、What’s New、设置、工作台等缺少 dark 配对；登录后 mobile 及完整状态矩阵未观察。
