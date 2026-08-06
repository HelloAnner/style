# 管理控制台（superadmin + admin）设计分析

来源：`SRC-056`（pages/superadmin 49 文件）、`SRC-055`（pages/admin 24 文件）、`SRC-053`（components/superadmin）。权威样式文件：`SuperAdminLayout.css`（2126 行）+ 三个页面级 CSS。exact-source。

## 1. 壳层（fi-superadmin-*）

- 布局：`100vh` flex；页面背景**字面量 `#F8F9FB`**（light 偏向，dark 未适配——GAP-001 同类冲突）。
- 侧栏：宽 **240px**、`--bg-sidebar`、右边线 `1px solid --border-soft`；品牌区 `min-height 56`、padding `0 20px`、logo 26×26、16px/800。
- 导航：padding `18px 12px`、组间距 16；item `min-height 36`、`padding 8px 10px`、radius **10**、13px/400 `--fg-secondary`；hover `--bg-hover-v11`；active `--selected-bg` + weight 600 + 左侧 **3×18px** 圆角竖条 marker（`--fg-primary`，`border-radius 0 4px 4px 0`）；focus-visible `outline 2px var(--accent) offset -2px`。
- 滚动条：默认隐藏，hover/focus-within 时 6px 细条 `--fg-tertiary`。
- 断点 860px：壳转纵向、侧栏全宽（唯一 admin 响应式规则）。

## 2. 配置页组件系统（fi-config-*，superadmin 的“小设计系统”）

- **卡片** `.fi-config-card`：radius 8、`--bg-secondary`、`1px solid --border-subtle`、padding **20**、内部 gap 20；compact 变体、option-card（可选中卡片）同族。
- **表格** `.fi-config-table`：13px、`border-collapse: separate; border-spacing 0`；行 hover、斑马纹 `nth-child(even)`；包裹层 `.fi-config-table-wrap`。
- **按钮** `.fi-config-button`：h **36**、`padding 0 14px`、radius **10**、`--bg-tertiary` + `--border-default`、13px、transition 150ms。
- **输入** `.fi-config-input`：h **40**、`padding 0 12px`、radius 8、14px、`--input-bg/--input-border`；focus：`border-color --btn-primary-bg` + `box-shadow 0 0 0 2px --info-bg-soft`；搜索框变体 h36。
- **页内 tabs**：grid `auto-fit minmax(104px,1fr)`、gap 4、padding 4、radius 8、`--bg-tertiary`；tab h34、radius 8、13px。
- **开关** `.fi-config-toggle`：**44×24**、radius 999、padding 2、`--bg-tertiary` + `--border-default`（注意与工作台 MossSwitch 36×20 不同，两套并存按区域用）。
- **模态**：panel radius **14**、padding 20、`width min(420px, 100vw-32px)`、gap 14、`--shadow-lg`；backdrop 同族。
- **状态**：status-pill 12px + dot；text-success/text-danger；badge、alert、pagination、search-row、tool-grid 等见原件。
- 页头：page-title/subtitle、section-title/desc 层级固定。

## 3. 页面级 CSS 与结构

- `SuperAdminAgentsPage.css`（508 行）、`SuperAdminSubagentConfigPage.css`（219 行）、`SuperAdminThirdPartyIntegrationPage.css`（204 行）为页面特例；`sa-*` 前缀（如 sa-showcase-modal-panel 共享隐藏滚动条规则）。
- 结构惯例：`SuperAdminConfigShell` + `SuperAdminConfigHeader/OpsHeader` + 各 Panel/Table；`superAdminNav.ts` 路由登记；`SuperAdminSelect`、`FilterableSelect`（components/superadmin）为控制台专用下拉。

## 4. 租户 admin（pages/admin，24 文件）

- 与 superadmin **不同壳**：`AdminDashboard` 用内联样式 + `--bg-primary/--text-primary` 语义变量（带 zinc fallback：`#18181b/#71717a/#f4f4f5`），顶栏 + 左侧 nav（`.admin-nav-item`），无 fi-config 体系。
- 子模块：agents/（AdminAgentEditor、AdminCapabilityPanel、OpenIntegrationPanel）、AgentSupervision/（Automation/DashboardRecords/SessionLog/Usage 四个 Tab + usage-records.css）、asset-tabs/（Automations/Skills/Tools）、skills/（SkillCard、SkillUploadModal）。
- 惯用值：搜索框 `max-width 312`、`padding 9px 12px`、radius 8、13px；空态 `padding 48px 0` 居中 14px `--text-muted`；错误条 `--danger-*-soft` 三件套。

## 5. 复刻要点

1. 两套管理壳不要混：平台级 superadmin = `fi-superadmin + fi-config`（240 侧栏、`#F8F9FB`）；租户 admin = 内联语义变量壳。
2. 控件高度阶梯：按钮/搜索 36、输入 40、tab 34；与工作台（34 输入/32 按钮）不同，是控制台自己的阶梯。
3. `#F8F9FB` 页面底、zebra/hover 行、3px active marker 是控制台识别特征。
4. dark 主题：fi-config 组件走语义变量可继承，但壳背景字面量与 zebra 细节未验证（GAP-001）。
