# 共享组件层（components/common）与全局 Token 家族

来源：`SRC-046`（common 40 文件）、`SRC-065`（lib/widgetTheme、clientTheme、motion）、`SRC-001`（globals.css）。exact-source。

## 1. globals.css Token 家族地图（复刻时的命名空间边界）

| 家族 | 量级 | 服务区域 |
|---|---|---|
| `--bg/--text/--border/--fg` | ~120 | 全局语义基底（light/dark 双套值） |
| `--moss-*` | 87 | 品牌件：home 标题 accent、sidebar tooltip、品牌标记 |
| `--chat-*` | 51 | 对话消息流 |
| `--ch-*` | 98 | 图表（ChartRenderer 色板） |
| `--studio-*` | 70 | Studio 面板（Agent/Automation/Skills/Tools 编辑器） |
| `--rt-*` | 51 | 圆桌（Roundtable）消息 |
| `--plan-*` | 32 | 计划卡片 |
| `--upload/--file/--send` | 60 | composer 附件、文件卡、发送钮 |
| `--glass-*` | 14 | 玻璃拟态面板（骨架、浮层） |
| `--btn-*` | 22 | 按钮体系：`--btn-mono-*`（黑白主钮）、`--btn-primary-*` |
| `--danger/--warning/--info` + `-bg-soft/-border-soft` | 14+ | 状态色三件套（实色/软底/软边） |

规则：新组件只消费语义变量，不引入新字面量；字面量只允许出现在“确认 light-only 的页面”（auth/showcase，见 auth-public-pages.md）。

## 2. 核心共享组件事实

### CorevoDesignButton（“让 Moss 设计”）
- Studio 面板 header 标题右侧的统一 AI 入口；配色**跟随当前 Agent 头像渐变主色**（`extractAccentColors`，fallback `#A855F7/#EC4899`）。
- 几何：`padding 6px 14px`、12px/500、radius 8、border `1px solid {accent}30`；背景 135° 渐变 `{accent}20→{secondary}20→{accent}14`、`200% 200%` 流动 `cdBtnFlow 5s ease infinite`；hover `box-shadow 0 0 12px {accent}30`。
- 前置 16×16 radius 4 实心渐变方块 + 10px 白色星形 SVG。

### FineDesignTooltip
- Portal 挂载、四向 placement + 三向 align，默认 offset；样式固定：`padding 4px 8px`、radius 6、12px/500、z-index 1000，颜色全走 `--moss-sidebar-tooltip-bg/-fg/-shadow`（与工作台 tooltip 同源，不要另造 tooltip 样式）。

### Select（四变体）
- `compact`：h30、`padding 0 8px`、radius 6、12px；`default`：h36、`0 10px`、radius 8、13px；`underline`（Studio）：无框、15px、`border-bottom 1px solid --studio-border-input`；`card`：`padding 10px 14px`、14px、radius 10、open 时 border 变 `--accent-color`。
- 下拉：`background --studio-dropdown-bg`（Studio 语境）/ `--bg-secondary`，z-index 1000；选中标记、多选 chip（10px 字、`padding 1px 6px`、radius 4、`--hover-bg` + `--border-subtle`）。

### DropdownMenu
- 面板：z-index 1000、`--bg-secondary`、`1px solid --border-subtle`、radius 8、`box-shadow 0 4px 12px rgba(0,0,0,0.08)`（字面量）、padding 4；item：`padding 8px 12px`、radius 6、13px；danger item 用 `--danger-bg-soft/--danger`；active 用 `--moss-home-title-accent`。

### ConfirmDialog（模态体系基准）
- 遮罩 `position fixed inset 0 z-index 10000`；面板 `--modal-bg(fallback --bg-secondary)`、radius **12**、padding **24**、`--modal-shadow(fallback 0 8px 32px rgba(0,0,0,0.18))`、`1px solid --border-subtle`。
- 标题 16px/600；正文 13px `--text-secondary` line-height 1.6；按钮 `padding 8px 16px`、radius 8、13px：取消=`--bg-tertiary`+`--border-default`；确认三色调：danger=`--danger-bg-soft`+`--danger-border-soft`+`--danger`、mono=`--text-primary` 反色、accent。

### MossSwitch
- 36×20、radius 10、thumb 16；on=`--btn-mono-bg`/`--btn-mono-text`，off=`--border-default`/`--bg-secondary`；transition 0.15s。（对比 superadmin 的 fi-config-toggle 是 44×24，两套并存，按区域选用。）

### Avatar
- 圆形；agent 头像用平台渐变 `avatar.gradient`，用户头像 `--user-avatar-bg/--user-avatar-text`。

### PanelSkeletons / LoadingStates
- 骨架容器：radius 16、`--glass-bg`、`1px solid --border-subtle`、`--panel-shadow`；骨架行默认高 12；header 区 36px radius 12 块 + 14px 行。

### 其余（细节见归档原件）
- NotificationBell（314 行通知面板）、WhatsNew（300 行更新弹层）、CodeBlock（228 行，配合 lib/syntax-highlighter）、ChartRenderer（1688 行，`--ch-*` 98 个图表变量）、ExcelPreview（独立 css + worker）、AssetPreviewModal、FileContextMenu、SharePopover、ExpandableText、Collapsible、RefreshIconButton、ResizeHandle（module.css）、Icons/Logo（322 行产品内联 SVG 库）。
- Guards：AuthGuard/AdminGuard/GuestGuard/WorkspaceGuard/MobileUnsupportedGuard（移动端拦截规则的唯一权威）；ErrorBoundary（Page/Component 两级）。

## 3. lib 样式支撑

- `widgetTheme.ts`（1089 行）：iframe widget 的 HTML shell 构建，注入 Corevo 设计系统 9 色板变量，light/dark 双套；看板/工件的运行时主题权威。
- `clientTheme.ts`（38 行）、`motion.tsx`（6 行 re-export）。

## 4. 复刻要点

1. 先判断区域再选变量家族：工作台=语义基底+`--moss/--chat`，Studio=`--studio-*`，图表=`--ch-*`，圆桌=`--rt-*`。
2. 弹层三级 z-index：dropdown/tooltip 1000、modal 10000。
3. 圆角阶梯：6（小控件/tooltip）→ 8（按钮/下拉/卡片小）→ 10（segment/toggle）→ 12（modal）→ 16（骨架/大面板）。
4. 状态色必须三件套（实色 + `-bg-soft` + `-border-soft`），禁止只用一个红。
