# 右侧智能看板（Board Panel）设计分析

来源：`SRC-043`（pages/boards 4 文件）、`SRC-044`（components/Dashboard 12 文件 + dashboard.css 6701 行）、`SRC-045`（Dashboard/inputs 14 文件）。commit `195a663d`，exact-source。

## 1. 定位与壳层

- 看板是右侧面板的第二种内容（与文件 drawer 同级），`BoardPanelDrawer` **直接复用** `WorkspaceDrawer.module.css` 的 `drawer/header/title/actions/iconBtn`，壳层几何与右 panel 规则（50% / min 480 / inset 8，见 `file-workspace.md`）完全一致。`Observed · exact-source · high`
- Header 构成：board.svg 图标 20×20 + 标题（`{agentName}看板`）+ 居中 Tab 区 + 最大化/关闭 iconBtn（复用 file-panel 的 maximize/collapse/close 图标）。
- 最大化状态与文件 drawer 共享 `workspaceMaximized`，最大化时 tab 从紧凑模式切换为完整模式。

## 2. Header 居中 Tab（dashboard.css:43-281）

- 容器绝对定位 `inset:0`，左右 `padding: 0 132px` 避开标题与操作钮，`pointer-events:none` 容器 + `auto` 内层。
- **Line 变体**（header 内）：tab 高 100%、`padding: 0 10px`、14px/22px、weight 500；active 时 weight 600、颜色与 2px 下划线均为 `var(--moss-home-title-accent)`；hover `var(--text-primary)`。
- **Segment 变体**（独立 tabbar）：高 34、padding 2、radius 6、背景字面量 `#EEF1F6`；tab 高 30、radius 4、`padding: 0 12px`、颜色 `rgba(9,30,64,0.66)`；active 背景 `var(--bg-drawer)` + 三层阴影 `0 0 2px / 0 4px 8px / 0 4px 24px 6px rgba(9,30,64,0.02/0.06/0.04)`，hover `rgba(255,255,255,0.56)`。
- 紧凑/溢出策略：紧凑 tab 宽 30px；`can-auto-collapse` 时 `max-width: 132px`；`is-dropdown` 触发器 `max-width: min(180px,100%)` + 2px accent 下划线；文字 ellipsis；隐藏 measure 行用于宽度测量。
- 图标：15×15、`background: currentColor` + mask（与思维链一致，不引入 Lucide 替代品）；自定义看板前置 5px 圆点 `var(--accent-color)`。

## 3. 查询表单（dashboard.css:284-363 + inputs/）

- 容器 `padding: 14px 16px`；12 列 grid、`gap: 12px`；label 上方排列；必填/错误用 `var(--danger)`。
- 控件 `.dashboard-input`：高 **34**、`padding: 0 8px`、radius 6、13px 字、`background: var(--input-bg)`、`border: 1px solid var(--input-border)`。
- 焦点体系全部由 `--btn-mono-bg` 派生（color-mix）：hover border 8%、focus border 10%、focus ring `0 0 0 1px` 4%、focus surface 1%。placeholder 字面量 `#B5B8BE`。
- textarea：`min-height: 82`、`padding: 9px 11px`、`line-height: 20`、resize vertical。
- 输入类型全套：Text/Textarea/Select/MultiSelect/DateRange/Range/FileUpload/CompanySearch/RemoteSearch/RegionCascader/DynamicInput（14 文件，`SRC-045`）。

## 4. 结果区与动作

- `.dashboard-content`：`flex:1`、居中（无结果时）、`padding: 8px 16px 16px`；`.has-result` 切换为左上对齐。`.dashboard-result-shell` `min-height: 360px`。
- **MOSS洞察按钮**：primary、`dashboard-result-action-*`，显现编排：delay **1s**、duration **620ms**、`cubic-bezier(0.16,1,0.3,1)`；显现后 icon/字符做 `nudge 5.6s ease-in-out infinite`，按 `--dashboard-result-action-index` 每级 stagger **80ms**。
- **保存为按钮**：高 32、`padding: 0 12px`、radius 8、`border: 1px solid var(--border-subtle)`、`background: var(--bg-secondary)`、12px/16px weight 500；hover 升级 `--border-default` + `--bg-tertiary`；focus-visible `outline: 2px solid var(--focus-ring)`；disabled 用 `--btn-mono-disabled-*`。dropdown：`padding: 4`、radius 8、`var(--dropdown-bg/border)`、`var(--shadow-lg)`、最大宽 `min(220px, 100vw-32px)`。
- 渲染器 `DashboardRenderer`：sandboxed iframe，`buildWidgetHtml` 注入 Corevo 设计系统 CSS 变量（`--bg-surface/--text-primary/--blue-600` 等 9 色板）；iframe 高度 postMessage 上报实现外滚；iframe 内流式骨架 shimmer 1.55s；PNG 导出用本地打包 html2canvas；保存快照 API 携带 `theme: light|dark`。

## 5. 流式反馈（看板特有，思维链之外第二套“进行中”语言）

- `.dashboard-stream-rail`：sticky top、高 **2px**、radius 999、轨道 `color-mix(var(--interactive-default) 44%, transparent)`；进入 `180ms ease delay 160ms`。
- glint：宽 34%、从 `left:-34%` 往复，`2.25s cubic-bezier(0.45,0,0.55,1) infinite`，渐变末端 `var(--moss-home-title-accent)`，`filter: saturate(0.78)`（刻意降饱和，勿调鲜艳）。
- query-boundary 变体：`margin: -1px 16px`，位于表单与结果分界。
- `.dashboard-result-shell.is-streaming` 叠加 `DashboardStreamSkeleton`：整版骨架 + `shimmer 1.55s ease-in-out infinite`，分 default / risk（enterprise-risk）两种变体，离场 `is-leaving` 过渡。

## 6. Loading / Empty / Error

- **DashboardLoading**（产品确认视觉，源码注释要求保留方向）：容器 `min-height: 260`、`gap: 16`、`padding: 36px 20px`；视觉 `min(240px,76vw) × 156`；“放大镜轻扫看板”——浅蓝看板插画（`#D8E8F8/#D3E2EF/#F0F5FA/#E2EDF7` 字面量），放大镜环 `#E86A45` 4px border、`2.8s ease-in-out infinite` 扫动；文案“正在查询中 / Querying”。
- **DashboardEmpty**（1340 行）：按看板类型给引导插画与文案——通用（提示填条件）、enterprise（企业洞察维度卡）、batch（批量名单）、bidding（招投标文件夹，空态视觉宽 435 / 上偏移 192）、industryChain（上中下游三节点）、companyFilter（筛选→画像流程动画，含 cascade/flow-path keyframes）、enterpriseRisk（风险扫描面板 + 标签）。
- Error：`var(--danger)`；panel message 居中 `min-height: 260`、`gap: 12`、`var(--text-tertiary)`。

## 7. 状态矩阵（源码已观察）

noAgent / listLoading / noBoards / 空表单 / 查询中 loading / waiting 骨架 / streaming（rail + skeleton + iframe shimmer）/ settling / success（结果 + 洞察/保存动作）/ error / 快照恢复（DB view state）/ 最大化↔还原 / tab 紧凑↔展开↔dropdown / 保存中 animate-pulse / 导出中。

## 8. 主题与冲突

- dashboard.css **零** `data-theme` 选择器：全部经 `globals.css` 语义变量（`--bg-drawer/--text-*/--border-*/--input-*` 等）继承双主题。`Observed · high`
- 但存在 light 偏向字面量，dark 下表现未验证（与 GAP-001 同源）：segment 底 `#EEF1F6`、segment 字 `rgba(9,30,64,0.66)`、placeholder `#B5B8BE`、loading 整套浅蓝/橙字面量、tab 阴影 `rgba(9,30,64,*)`。
- `prefers-reduced-motion`：至少 6 处媒体查询，关闭 rail/glint/nudge/shimmer/magnifier/cascade 等全部动效。看板内部另有 560/640/900/920/1180 断点（主要是 empty 插画与 overlay），属看板内容适配，不改变外层 MobileUnsupportedGuard 结论。

## 9. 复刻要点（consumption notes）

1. 看板 drawer 壳必须与文件 drawer 完全一致——直接复用同一套 module.css，不要新写壳。
2. “进行中”表达分两层：顶部 2px 低饱和 glint rail（边界级）+ 整版 shimmer 骨架（内容级）；不要替换为 spinner。
3. 表单焦点色从 `--btn-mono-bg` color-mix 派生，不要硬编码品牌蓝。
4. Loading 的“放大镜扫看板”是产品确认视觉方向（源码注释两次强调保留）。
5. iframe 结果页走 `lib/widgetTheme.buildWidgetHtml` 注入 9 色板变量；快照保存区分 light/dark 主题参数。
