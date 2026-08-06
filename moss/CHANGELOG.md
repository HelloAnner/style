# Changelog

## 0.4.0 — 2026-08-06

### Sources
- 全量补齐：common 共享组件 40、功能组件（Agent/Automation/Billing/modals/Project/Skills/superadmin/Tools）30、pages（admin 24 / superadmin 49 / auth 8 / share 12 / onboarding 4 / settings 3 / showcase / legacy / feishu / 根级文件）103、lib 样式支撑 3，共 176 个原件、20 份新 SHA-256 清单（SRC-046..065）。来源总数 65；前端非测试源码现已**全量归档**。

### Analysis
- 新增 `common-components.md`：globals.css 12 个 Token 家族地图、CorevoDesignButton/FineDesignTooltip/Select 四变体/DropdownMenu/ConfirmDialog/MossSwitch/骨架等共享组件精确规则、z-index 与圆角阶梯。
- 新增 `admin-console.md`：superadmin 壳（240 侧栏、`#F8F9FB`、3px active marker）与 fi-config-* 组件系统（卡 8/20、钮 36/10、输入 40、toggle 44×24、modal 14/420）、租户 admin 内联壳区分。
- 新增 `auth-public-pages.md`：auth `_shared.tsx` C 色板（light-only，与工作台变量隔离）、showcase parchment 变量、share 只读投影规则。
- 新增 `studio-modules.md`：四个 Studio 通则、`--studio-*` 35 变量六组、圆桌 `--rt-*`、第三套 toggle。

### Quality
- GAP-007 关闭（TODO-024 完成）。完成率 76.0%（19/25），状态仍为 reusable：dark 运行态、视觉 baseline、移动端、字体许可、状态矩阵、可访问性六个开放项不变。

### Breaking changes
- 档案范围从“对话工作台”扩展为“Moss 前端全量”；消费 Agent 必须按区域选 Token 家族（见 common-components.md §1）。

## 0.3.0 — 2026-08-06

### Sources
- 追加右侧智能看板：pages/boards（4 文件）、components/Dashboard（12 文件 + dashboard.css 6701 行）、Dashboard/inputs（14 文件），共 30 个原件及三份 SHA-256 清单（SRC-043..045）。来源总数 45，bundle 文件总数 140。
- 复查确认来源 commit 未变（195a663d），既有 42 项来源无漂移。

### Analysis
- 新增 `analysis/boards.md`：看板 drawer 壳（复用 WorkspaceDrawer module.css）、居中 tab 双变体（line/segment）与紧凑/dropdown 溢出策略、12 列查询表单与 color-mix 焦点体系、2px glint stream rail + 整版 shimmer 骨架双层流式反馈、放大镜 loading（产品确认视觉）、分类型 empty 引导、iframe 渲染器与 9 色板注入、状态矩阵、light 偏向字面量冲突清单。

### Quality
- 新增 GAP-007（对话工作台以外路由/组件未归档）与 TODO-024（范围决策，待用户确认）。
- 版本升至 0.3.0，完成率 72.0%（18/25），状态仍为 reusable。

### Breaking changes
- 消费入口扩展：看板需求必须读 `analysis/boards.md`；看板 drawer 壳禁止新写，必须复用 file drawer 几何。

## 0.2.0 — 2026-08-01

### Sources
- 追加 App shell、完整 Chat 组装、展开/折叠 Sidebar、会话列表、WorkspaceDrawer/FileGrid 来源。
- 原样保存 Chat/Sidebar/Workspace 全部非测试组件实现共110文件，并提供三个 bundle 哈希。
- 保存 sidebar/file-panel/file-icons 59个产品图标原件及逐文件哈希；来源总数增至42。

### Analysis
- 新增完整桌面对话工作台、左侧会话列表、右侧文件工作区三份专题规范和源码映射。
- 补齐 sidebar 260/48、会话 item36、header48、right panel 50%/min480/inset8、文件卡180/120等精确规则。

### Tokens / implementation
- Token 扩展 sidebar、home、chat header、right panel、workspace/file-card、breakpoint 和主题映射。
- 新增无依赖可运行组件参考：sidebar + conversation + reasoning + composer + file drawer，含基础交互。

### Validation
- Light/dark 1440×900 完整工作台参考渲染成功；JSON、来源哈希和 entrypoint 自检待最终报告记录。
- 参考实现不是来源产品 baseline，未提升为 validated/complete。

### Status / TODO
- 版本升至0.2.0，完成率73.9%，状态仍为 reusable。

### Breaking changes
- 消费入口从“思维链重点”扩展为“完整对话工作台”；实现 Agent 必须读取新增 sidebar/file-workspace 规范。

## 0.1.0 — 2026-08-01

### Sources
- 登记用户授权本地源码 `/Users/anner/fine/ai/dev`，commit `195a663d2323af7c668a1db9e0a1be442a2c2b49`。
- 原样保存 14 个前端关键源码文件及 SHA-256，未读取 `.env`，未复制凭据。

### Analysis
- 盘点 Moss 工作台、消息流、assistant frame、输入框与思维链结构。
- 将思维链拆为运行状态、过程说明、工具动作、连接线、完成折叠、自动滚动和性能生命周期。
- 分离 light/dark 精确源码值，并记录运行态固定 light 的冲突。

### Tokens / implementation
- 生成聚合 Token、双主题展开 JSON/CSS、style guide 与实现指南。
- 新增可运行的思维链参考页和 4 张双主题/双视口派生截图。

### Validation
- JSON 解析通过；参考页在 Chrome headless 的 1440×900 与 390×844、light/dark 下成功渲染。
- 参考截图不是来源产品 baseline，未用于宣称真实视觉回归通过。

### Status / TODO
- 状态设为 `reusable`，完成率 62.5%。
- 保留真实 dark、移动端、字体许可、状态矩阵和来源视觉回归缺口。

### Breaking changes
- 无，首次建档。
