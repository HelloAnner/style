# Studio 编辑器与功能模块（Agent / Automation / Skills / Tools / Project / Billing / modals）

来源：`SRC-047..052`、`SRC-054`（components 各目录）、`SRC-001`（--studio-* 变量定义）。exact-source。

## 1. Studio 家族通则（AgentForm / AutomationStudio / SkillStudio / ToolStudio）

四个 Studio 是同一产品语言：左配置 + 右预览/编辑的面板页，头部右侧统一挂 `CorevoDesignButton`（见 common-components.md）。

- 变量语境：`--studio-*` 35 个变量分六组——
  - 表面：`--studio-bg/--studio-surface/--studio-surface-hover/--studio-surface-right`；
  - 文字 9 级：`--studio-text-primary/-secondary/-body/-label/-desc/-muted/-faint/-ghost/-inactive/-bright/-input/-placeholder`；
  - 输入：`--studio-border-input/--studio-border-marker`；下拉 `--studio-dropdown-bg/--studio-dropdown-shadow`；
  - 编辑器：`--studio-editor-bg/--studio-editor-border/--studio-editor-text`（代码/prompt 编辑区）；
  - pill 与 toggle：`--studio-pill-bg/--studio-pill-active`、`--studio-toggle-track-off/-mid/--studio-toggle-thumb-off/-mid`、`--studio-status-off`；
  - prompt 结构块：`--studio-prompt-block-bg/-border/-text/-title`；头像环 `--studio-avatar-ring`。
- 内联样式高频值（四 Studio 一致）：`--text-muted/--text-primary/--border-subtle/--hover-bg/--bg-tertiary` 为主；表单控件沿用工作台语义变量，`Select` 组件的 `underline` 变体（15px、底部 1px `--studio-border-input`）是 Studio 语境标志。
- 模态在 Studio 内用 `--modal-bg/--modal-border/--modal-backdrop/--modal-shadow` 四件套。

## 2. 各模块要点

### Agent（8 文件）
- `AgentForm`（504 行）：创建/编辑智能体；`SkillEditor`、`AssetBindingPanel`、`AgentSelector`、`AgentCard`（卡片选型见原件）。

### Automation（9 文件）
- `AutomationStudio`（1088 行）：自动化任务编辑器；`PipelineCreator`、`AutomationPanel/TemplatePanel`、`AutomationToast`（专用 toast，区别于全局 toast）。

### Skills（2 文件）
- `SkillStudio`（1250 行）：技能编辑器 + `SkillDraftDetailModal`（草稿详情模态）。

### Tools（4 文件）
- `ToolStudio`（1065 行）、`ToolHub`（工具市场列表）、`ToolIconPicker`（图标选择栅格）、`SecretConfigPanel`（密钥配置，表单同 Studio 语言）。

### Project（3 文件）
- `RoundtableView`（529 行）：圆桌多智能体视图——header `padding 12px 16px` + 底边线、14/600 标题、参与者行（10px muted 标签）、消息气泡 `--bg-secondary` 12px/1.5；消息流变量家族 `--rt-*`（51 个，globals.css）。
- `GraphView`（221 行）：关系图视图；`ProjectPanel` 容器。

### Billing（2 文件）
- `WorkspaceBillingBanner`（计费横幅）、`WorkspaceSalesConsultModal`（销售咨询模态，沿用 modal 四件套）。

### modals（2 文件）
- `ChangePasswordModal`、`InviteMemberModal`：工作台内模态，走 globals.css 语义变量（不用 auth 的 C 色板——auth-public-pages.md 有明确隔离规则）。

## 3. 复刻要点

1. 新 Studio 类页面：套 `--studio-*` 变量 + 左配置右预览骨架 + header 右侧 CorevoDesignButton，即与四个现有 Studio 视觉一致。
2. Studio 内下拉/选择优先用 `Select` 的 underline 变体；toggle 用 `--studio-toggle-*`（不同于 MossSwitch 与 fi-config-toggle，第三套开关）。
3. 圆桌消息走 `--rt-*`，不要复用 `--chat-*`。
4. 编辑器区域（代码/prompt）固定 `--studio-editor-*` 三色。
