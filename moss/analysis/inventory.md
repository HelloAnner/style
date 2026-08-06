# 前端盘点

## 版本与技术栈

- Moss V2 frontend，React 18 + Vite 5 + Tailwind 3 + Framer Motion 11 + Lucide。
- 来源 commit：`195a663d2323af7c668a1db9e0a1be442a2c2b49`。
- 全局样式权威：`SRC-001`；组件多为 Tailwind 布局 + inline semantic CSS variables。

`Observed · exact-source · high · shared · SRC-001, SRC-012`

## 页面与壳层

主要类型：工作台对话、空会话首页、会话详情、工作区/智能看板右抽屉、管理、设置、公开分享、onboarding。工作台壳为 `260/48px sidebar + flex chat + 可选 50% right panel`；对话最小宽 `400px`。

深入范围现覆盖完整桌面对话工作台：App shell、展开/折叠侧栏、Agent 切换、分组会话列表、active/unread/generating/rename 状态、会话 header、消息流、用户/assistant 消息、思维链/工具动作、Markdown 正文、输入框、右侧文件抽屉、scope/search/upload/batch/grid/list/preview/loading；以及右侧智能看板：drawer 壳、tab、查询表单、流式反馈、loading/empty/error、iframe 渲染（见 `boards.md`）。管理、设置、分享、圆桌仍仅盘点。

`Observed · exact-source · high · desktop · SRC-009, SRC-010`

## 核心组件

- `AssistantMessageFrame`：标记/名称/相对时间/正文槽。
- `ReasoningTraceSection`：运行/完成折叠状态、来源链接、DOM 生命周期。
- `ActionFeed`：运行标题、过程说明节点、工具动作、子智能体 attachment、自动滚动。
- `ActionItem`：工具语义文案、状态图标、耗时、写入进度、特殊卡片。
- `AssistantResponseBody`：Markdown surface、streaming 状态、widget。
- `MessageList`：900px 内容列、消息间距、置顶/跟底、下滑按钮。
- `InputBar`：116px composer、附件、发送/停止、AI 免责声明。
- `Sidebar`：260px 展开容器；品牌、Agent、新会话、分组会话、底部工具、用户入口。
- `CollapsedSidebar`：48px rail、32px actions、右侧 tooltip/flyout。
- `ChatSessionHeader`：48px 标题与右侧 utility actions。
- `WorkspaceDrawer`：右侧文件 scope、工具栏、grid/list/batch/preview。
- `FileGrid`：180px minimum grid card、120px preview、44px list row。

## 主题与资源

- `globals.css` 定义 dark（`:root` 与 `[data-theme=dark]`）和 light。
- `ThemeProvider` 把运行态固定为 light；暗色 API 保留但会归一为 light。
- 字体声明：Inter 正文，JetBrains Mono 代码；HTML 引入 `/fonts/google-fonts.css`。字体二进制未归档。
- 图标：思维链主要使用产品内联 SVG/CSS spinner，不应替换为任意 Lucide。

## 状态

已观察源码状态：thinking、processing、pending、running、streaming、completed、failed、timeout、cancelled、collapsed/expanded、正文生成中、空运行、tool card loading。Hover/focus 的真实视觉与触摸行为未完整验证。
