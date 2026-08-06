# 来源索引

共同上下文：用户提供本地 Moss V2 源码 `/Users/anner/fine/ai/dev`；commit `195a663d2323af7c668a1db9e0a1be442a2c2b49`；采集于 2026-08-01；授权 `provided`；全部原样复制并以 `sources/source-code/SHA256SUMS` 校验。

| ID | 原始来源 | 本地路径 | 主题/状态 | 用途 |
|---|---|---|---|---|
| SRC-001 | `frontend/src/styles/globals.css` | `source-code/styles/globals.css` | light+dark/shared | 主题、Token、动效 |
| SRC-002 | `ThemeProvider.tsx` | `source-code/common/ThemeProvider.tsx` | shared/fixed-light | 主题运行策略 |
| SRC-003 | `ReasoningTraceSection.tsx` | `source-code/Chat/ReasoningTraceSection.tsx` | running+completed | 思维链生命周期与折叠 |
| SRC-004 | `ActionFeed.tsx` | `source-code/Chat/ActionFeed/ActionFeed.tsx` | running+completed | 时间线结构与过程节点 |
| SRC-005 | `ActionItem.tsx` | `source-code/Chat/ActionFeed/ActionItem.tsx` | 全工具状态 | 工具动作、图标、排版 |
| SRC-006 | `ToolDisplayCard.tsx` | `source-code/Chat/ActionFeed/ToolDisplayCard.tsx` | loading+completed | 特殊工具卡片 |
| SRC-007 | `AssistantMessageFrame.tsx` | `source-code/Chat/AssistantMessageFrame.tsx` | default | assistant header |
| SRC-008 | `AssistantResponseBody.tsx` | `source-code/Chat/AssistantResponseBody.tsx` | streaming+complete+empty | 正文 surface |
| SRC-009 | `MessageList.tsx` | `source-code/Chat/MessageList.tsx` | scrolling+streaming | 内容列与滚动 |
| SRC-010 | `InputBar.tsx` | `source-code/Chat/InputBar.tsx` | default+active+running+upload | Composer |
| SRC-011 | `MarkdownContent.tsx` | `source-code/Chat/MarkdownContent.tsx` | default | Markdown 排版 |
| SRC-012 | `tailwind.config.js` | `source-code/tailwind.config.js` | shared | 尺度与遗留色板 |
| SRC-013 | `frontend/index.html` | `source-code/index.html` | shared | locale、字体入口 |
| SRC-014 | `google-fonts.css` | `source-code/fonts/google-fonts.css` | shared | 字体声明 |
| SRC-015 | `App.tsx` | `source-code/App.tsx` | shell/right-panel | 工作台总布局 |
| SRC-016..021 | `components/Chat/*` | `source-code/Chat/` | conversation states | 会话组装、header、消息角色与标记 |
| SRC-022..029 | `components/Sidebar/*` | `source-code/Sidebar/` | expanded sidebar | 品牌、Agent、会话分组/状态、底部入口 |
| SRC-030..035 | `components/Workspace/*` | `source-code/Workspace/` | file drawer states | 抽屉、工具栏、网格/列表、文件预览、骨架 |
| SRC-036..038 | `components/Sidebar/*` | `source-code/Sidebar/` | user/collapsed/flyout | 用户入口、48px rail 与浮层 |
| SRC-039 | sidebar/file-panel/file icon assets | `source-code/assets/` | shared | 59 个产品图标原件；哈希见资产清单 |
| SRC-040 | 完整 Chat 非测试组件 bundle | `source-code/Chat/` | conversation | 74个实现文件与 bundle 哈希 |
| SRC-041 | 完整 Sidebar 非测试组件 bundle | `source-code/Sidebar/` | navigation | 16个实现文件与 bundle 哈希 |
| SRC-042 | 完整 Workspace 非测试组件 bundle | `source-code/Workspace/` | file drawer | 20个实现文件与 bundle 哈希 |
| SRC-043 | pages/boards bundle | `source-code/boards/` | board drawer+page | BoardPanelDrawer、BoardHomePage 等 4 文件与哈希 |
| SRC-044 | components/Dashboard bundle | `source-code/Dashboard/` | board panel states | 12 文件 + dashboard.css(6701行) 与哈希 |
| SRC-045 | Dashboard/inputs bundle | `source-code/Dashboard/inputs/` | query form controls | 14 个查询表单控件与哈希 |
| SRC-046 | components/common bundle | `source-code/components/common/` | shared vocabulary | 40 个共享组件与哈希 |
| SRC-047..054 | Agent/Automation/Billing/modals/Project/Skills/superadmin/Tools | `source-code/components/*/` | feature modules | 30 个功能组件与哈希 |
| SRC-055 | pages/admin bundle | `source-code/pages/admin/` | tenant admin | 24 文件与哈希 |
| SRC-056 | pages/superadmin bundle | `source-code/pages/superadmin/` | superadmin console | 49 文件与哈希（含 SuperAdminLayout.css 2126 行） |
| SRC-057 | pages/auth bundle | `source-code/pages/auth/` | auth light-only | 8 文件与哈希（_shared.tsx C 色板） |
| SRC-058 | pages/share bundle | `source-code/pages/share/` | public share | 12 文件与哈希 |
| SRC-059..063 | onboarding/settings/showcase/legacy/feishu | `source-code/pages/*/` | misc pages | 10 文件与哈希 |
| SRC-064 | app 级文件 | `source-code/pages/ROOT-SHA256SUMS` | app-level | SessionFilePreviewPage + components/index.ts |
| SRC-065 | lib 样式支撑 | `source-code/lib/` | widget/client theme | widgetTheme.ts、clientTheme.ts、motion.tsx |
| SRC-066 | 字体许可与哈希 | `source-code/fonts/FONT-SHA256SUMS` | font license | SIL OFL README + 114 woff2 哈希（二进制不归档） |

详细逐文件来源、SHA-256、状态范围见 `../manifest.json`；当前共66个登记项，前端非测试源码已全量归档（bundle 文件总数 316）。运行证据：EVD-001..006 为参考实现渲染；EVD-007..034 为本地 dev 真实运行采集（公开路由，dark 为派生），见 `../evidence/runtime-2026-08-06/`。

## 授权与限制

设计参数可作为用户要求的内部档案使用。Moss 品牌标识及字体二进制不因本档案自动获得再分发授权；字体文件未复制。没有归档凭据、个人数据或环境变量。
