# 悟帆 AI 资料与界面盘点

## 当前版本判断

- 目标系统：悟帆 AI，公开入口 `https://www.wufanai.com/`。`Observed · exact-source · high · SRC-001`
- 用户源码：`/Users/anner/fine/ai/corevo`，commit `14394dc7ca16aa13c62e8a089c6ffff4953424f3`，2026-07-23。前端为 React 18 + TypeScript + Vite + Tailwind + Framer Motion + Lucide。`Observed · exact-source · high · SRC-004`
- 当前线上应用资产为 `index-CjeRCaxU.css` / `index-ChXKQFVA.js`，文件时间晚于源码 commit；What’s New 截图中的“消息通知/关注动态/悟帆 AI 1.0”存在于线上 JS，但不在源码 commit 的同名组件实现中。因此当前视觉值优先级：线上 CSS/计算样式 → 用户截图 → 源码 commit。`Observed · exact-source · high · SRC-012, SRC-013, SRC-014, SRC-004`

## 两类视觉表面

### A. Marketing（官网）

固定暗色、编辑式品牌页面，与产品应用不能共用背景/排版 Token：

- `/`：品牌首页，黑色舞台、衬线大标题、紫蓝抽象动画、白色胶囊 CTA；
- `/learn`：教程；
- `/pricing`：定价；
- 桌面 1440×900 与移动 390×844 均已自动截图；
- 官网未观察到产品级 light/dark 切换，模拟系统色彩方案不会形成可靠主题变化。

证据：`SRC-005–SRC-010, SRC-016–SRC-023, SRC-028–SRC-031, SRC-036–SRC-039, SRC-044–SRC-045`。

### B. Application（登录与登录后产品）

- `/login`：公开登录页，light/dark、桌面/移动均已自动采集；
- 登录后新任务空状态：dark 桌面截图；
- 登录后对话状态：light 桌面截图；
- What’s New：light 局部截图；
- 源码路由：`/`、`/s/:sessionId`、`/admin`、`/showcase`、`/preview/file`、`/share/:token`、`/file/:token`；
- 登录后主要布局：Sidebar + 可选 Main Stage + Chat；移动端 Sidebar 变抽屉。

证据：`SRC-002–SRC-004, SRC-011–SRC-014, SRC-024–SRC-027, SRC-032–SRC-035, SRC-040–SRC-043`。

## 页面模式

| 页面/模式 | 证据 | 主题 | 状态 |
|---|---|---|---|
| 官网首页 | SRC-016–019 | fixed dark | desktop/mobile default |
| 官网教程 | SRC-020–023 | fixed dark | desktop/mobile default |
| 官网定价 | SRC-028–031 | fixed dark | desktop/mobile default |
| 登录 | SRC-024–027, SRC-032–035 | light + dark | desktop/mobile default |
| 新任务空状态 | SRC-002 | dark | desktop default |
| 对话详情 | SRC-003 | light | desktop populated |
| What’s New | SRC-014 | light | component crop/default |
| 主舞台/Workspace/Dashboard | SRC-004 | 双主题源码 | 无完整运行截图 |
| 自动化/执行链/圆桌/设置/管理 | SRC-004, SRC-012–013 | 双主题源码 | 无完整视觉矩阵 |

## 产品组件盘点

### 全局与导航

- 240px 展开 Sidebar、56px 收起 Sidebar；
- Logo、折叠按钮、新任务、自动化、AI 员工、价值中心；
- 任务分组、搜索/筛选、任务行、空间入口、用户区；
- Header：Agent 名、任务标题、收藏和工作区操作。

### 聊天

- EmptyState、渐变 Agent 头像、问候标题与能力 tabs；
- MessageList、用户/Agent 消息、Markdown、代码、附件、操作栏；
- 复合 InputBar、附件、模型选择、思考模式、快速提示胶囊、发送；
- loading、streaming、questionnaire、plan review、todo、error 等源码状态。

### 浮层与工具

- dialog、drawer、popover、tooltip、toast、文件选择器；
- What’s New、Settings、Share；
- Workspace、Dashboard、Execution Chain、Automation、Project/Graph、Roundtable；
- 文件卡片、图表、代码块、表格、状态反馈。

## 资源盘点

- 产品主 UI：`Inter`，回退到 Apple/system/Segoe UI；代码：`JetBrains Mono`；中文因 Inter 不含 CJK 会使用声明或系统回退。`Observed · exact-source · high · SRC-012, SRC-040, SRC-042`
- 品牌字标：Smiley Sans Landing 文件已归档。`SRC-008`
- 官网 Hero：Fraunces；CTA：Outfit；正文：Inter。`Observed · exact-measured · high · SRC-036`
- 产品图标：Lucide + 内联 SVG；Agent 头像为 10 组 CSS 渐变。`Observed · exact-source · high · SRC-004`
- 已归档 12 个公开网页字体文件及 CSS，但再发布许可证仍待核验。`SRC-015`

## 尚未覆盖

登录后应用的移动端、同一页面双主题配对、hover/focus/disabled/loading/error/open 状态、完整设置/工作区/看板/圆桌等页面、主题切换录屏和视觉回归尚未完成。详见 `coverage-matrix.md`、`quality/gaps.md` 与 `quality/REQUESTS.md`。
