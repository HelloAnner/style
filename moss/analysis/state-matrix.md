# 交互状态矩阵（全区域，源码精确观察 + 公开路由运行验证）

采集：2026-08-06。方法：全量 CSS 选择器统计 + 69 个 tsx 内联 hover 处理器 + 公开路由运行截图（EVD-007..034）。`Observed · exact-source` 除标注外。

## 1. 状态密度分布（权威 CSS 文件）

| 文件 | :hover | :focus | disabled | active |
|---|---|---|---|---|
| globals.css | 30 | 1 | 12 | 0 |
| dashboard.css | 36 | 10 | 57 | 18 |
| SuperAdminLayout.css | 24 | 9 | 26 | 5 |
| WorkspaceDrawer.module.css | 9 | 0 | 6 | 0 |
| usage-records.css (admin) | 9 | 3 | 5 | 7 |
| SuperAdminAgentsPage.css | 8 | 1 | 3 | 1 |
| onboarding.css | 3 | 0 | 2 | 0 |
| ExcelPreview.css | 3 | 0 | 2 | 2 |

tsx 内联 `onMouseEnter/Leave` 分布于 69 个组件文件（sidebar/admin/settings 壳偏好内联悬停）。

## 2. 全局状态机制（复刻最容易漏的三层）

1. **light 归一化层**：globals.css 有一整段 `[data-theme="light"]` 覆盖，把 dark-first 写的 Tailwind 工具类（`hover:bg-zinc-800/30`、`hover:bg-zinc-700`、`hover:bg-emerald-500/30`、`hover:bg-surface-200/50`、`hover:bg-accent/10` 等）映射到 light 值。组件可以写 dark 风格类名，运行态由该层归一——**新组件禁止绕过此层直接写 light 字面量 hover**。
2. **默认焦点被移除**：`input:focus, textarea:focus, button:focus { outline: none }` + `.file-card { outline: none }`；globals **零** `:focus-visible` 规则。焦点可见性由组件自行恢复（见 §4）。
3. **file-card 状态机**：`:hover` → `border-active` + `0 2px 12px rgba(0,0,0,0.15)`；`:not(:hover)` 强制回 `border-subtle` + 无阴影（带 `!important`，防内联残留）。

## 3. 分组件状态清单

### 按钮体系
- 工作台 icon 钮（drawer/header）：30×30 radius6，hover `--bg-tertiary` + `--text-primary`，disabled opacity 0.55，`.is-active` → `--accent-color`（dashboard.css:12-40）。
- 保存为按钮：hover 升级 border/bg、focus-visible `2px var(--focus-ring)`、disabled `--btn-mono-disabled-*` 三值。
- fi-config-button（控制台）：150ms 三色 transition，disabled 同族。
- auth C 色板按钮：`#18181B` → hover `#27272A`（运行验证 EVD-025/026）。

### 输入体系
- 工作台 dashboard-input：hover border color-mix 8%、focus 10% + 1px 4% ring（boards.md §3）。
- fi-config-input：focus `--btn-primary-bg` + `0 0 0 2px --info-bg-soft`，disabled opacity 0.6。
- auth input：error 态 `#fca5a5` border + `#fef2f2` 底（运行验证）。

### 导航/选择
- superadmin nav：hover `--bg-hover-v11` / active `--selected-bg`+600+3px marker / focus-visible `2px --accent offset -2px`。
- tab（dashboard line/segment、fi-config-tab）：active 全规则见 boards.md §2 / admin-console.md §2。
- 会话 item：hover/menu 150ms；unread/generating/rename 状态见 sidebar.md。
- Select：open 时 border `--accent-color`；DropdownMenu item hover `--hover-bg`、danger `--danger-bg-soft`。

### 开关三套
- MossSwitch 36×20（0.15s）、fi-config-toggle 44×24（200ms）、`--studio-toggle-*`（Studio）。

### 卡片/列表
- rt-card：hover 浮起 + `.rt-bg-art` 显现，light/dark 分支（globals.css:1547-1556）。
- ch-icon/ch-orb：hover scale 1.06/1.08（图表装饰）。
- inline-file-ref-token：hover 显 remove 钮。
- 文件卡：见 §2.3；grid selected 态见 file-workspace.md。

### 反馈态
- loading：dashboard 放大镜（产品确认）、stream skeleton shimmer 1.55s、PanelSkeletons 玻璃卡、fi-config-loading-spinner。
- error：`--danger` + `--danger-bg-soft`/`--danger-border-soft` 三件套（全区域一致）；auth 用 C.error 族。
- empty：看板 6 类型引导插画、案例墙"暂无已发布案例"（EVD-015）、admin `padding 48px 0` 居中。

## 4. 焦点与可访问性事实（TODO-016 输入）

- `:focus-visible` 规则仅存于：dashboard.css（5 处，含保存钮/dropdown）、SuperAdminLayout.css（2 处，nav item/modal）。其余区域键盘焦点**无可见指示**——这是来源产品事实，复刻时默认保持一致；若要修复需用户批准并记录偏差（GAP-006）。
- `prefers-reduced-motion` 共 13 处媒体查询：globals（核心 CSS + home）、dashboard.css（6+，关闭 rail/glint/nudge/shimmer/magnifier/cascade）、onboarding 等。看板动效全部可减弱；framer-motion 分支不查 reduce（GAP-006）。
- 滚动条：hover 才显现（superadmin nav、showcase modal）；file-card 区 6px 细条。

## 5. 运行验证覆盖（EVD-007..034）

已真实渲染验证：showcase 完整页（desktop/mobile × light/dark-derived）、join 错误卡（含 disabled input + error banner）、share 加载底、CAS 重定向行为。登录态组件状态（会话 hover、思维链展开、看板流式、admin 表格行 hover）仍为源码观察，未运行验证 → 关联 GAP-002。
