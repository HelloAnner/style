# 已知缺口与冲突

## GAP-001：登录后页面没有同页双主题配对

- 现有：dark 新任务 `SRC-002`；light 对话 `SRC-003`；light What’s New `SRC-014`。
- 进展：`examples/reference/chat-page/` 已用当前生产 Token/结构生成 light/dark populated
  actual，解决“没有代码例子”的消费缺口；它不是 dark 来源 baseline。
- 影响：无法证明同一页面/状态在两主题的所有组件映射。
- 关闭：登录后新任务、对话、What’s New 分别提供 light/dark 同视口截图，或授权自动化访问。
- 关联：TODO-002, TODO-003, REQ-002, REQ-003, REQ-008。

## GAP-002：登录后移动端缺失

- 现有：公开登录和 Marketing 390px；源码声明 `<768px` 行为。
- 进展：对话参考已在 390×844 验证 closed/open drawer、消息和 Composer，证明代码可运行；
  仍不能替代真实登录后 mobile 视觉证据。
- 影响：无法视觉验证 Sidebar drawer、Chat Header、Composer、消息和 Workspace。
- 关闭：授权登录态自动截图或提供 390×844 配对截图。
- 关联：TODO-007, REQ-007, REQ-008。

## GAP-003：交互状态矩阵未视觉验证

- 现有：源码/线上 CSS 定义 hover、active、loading、error、open 等；用户图仅 default/populated。
- 进展：过程轨迹已有六态可运行 fixture；点赞/点踩、原因浮层、右面板、执行完成/异常通知已在
  light desktop 本地实际交互验证。它们缩小了缺口，但不能替代真实产品两主题/移动状态矩阵。
- 影响：源码值可能被线上版本覆盖，且无法证明焦点、浮层、时序。
- 关闭：登录态浏览器自动采集或 Storybook/状态截图/录屏。
- 关联：TODO-006, REQ-006, REQ-008。

## GAP-004：源码与当前线上版本冲突

- 用户源码 commit 为 2026-07-23；线上资产更新更晚。
- 当前线上 What’s New 与源码 `WhatsNew.tsx` 结构不同；源码 Logo 文案仍为 Moss。
- 当前登录小人也只存在于线上生产 bundle；本地 `AuthPage.tsx` 是旧版，聊天 `EmptyState` 的无眼流体头像不是同一组件。
- 当前生产 MessageList 为 960px，本地旧源码为 880px；对话参考已选择生产值并在 EVD-007
  记录，不静默混用。
- 当前新源码 Header 已不含旧 execution 入口；本轮用户要求保留执行链，因此右面板入口/内容
  明确记录为 SRC-004/013/058 跨版本组合，而不是伪装成单一 commit 当前截图。
- 当前决定：复刻当前产品时优先 `SRC-012/013/014`；源码用于仍一致的 Token/anatomy。
- 登录小人范围已通过 EVD-006 和 `examples/reference/login-mascot/` 单独恢复，不再依赖旧源码猜测。
- 关闭：提供与当前部署完全对应的源码 commit/构建映射。
- 关联：REQ-009。

## GAP-005：字体跨平台与许可证

- 已归档网页字体和 CSS，但产品中文 fallback、字体子集以及公开再发布许可证未全部核验。
- 影响：换行/字宽可能不同；公共 GitHub 发布可能有权利风险。
- 关闭：确认字体许可与目标平台 CJK 字体策略。
- 关联：TODO-005, REQ-005。

## GAP-006：用户原图和私有源码的公开发布权限

- `SRC-002/003` 含用户名和会话内容；`SRC-004` 来自私有企业 Git remote 且未发现许可证。
- 当前处理：本地保存，但通过 `.git/info/exclude` 阻止误推送到公开仓库。
- 例外：用户本轮明确要求公开复用登录小人；SRC-054/055 无个人数据，组件由公开 SRC-013 恢复，因此该组件与两张登录 UI 图可进入公开档案。
- 例外：用户明确要求其他系统可复用完整对话代码；派生参考仅含公开生产可观察样式、
  脱敏 mock 和通用交互，可以进入公开档案。SRC-002/003 原图和私有业务实现仍不进入。
- 例外：用户明确指定独立 `corevo-platform` 工作区 `/Users/anner/fine/ai/dev` 作为过程轨迹、
  反馈和通知的跨系统参考；Wufan 工作室改以 `/Users/anner/fine/ai/corevo` 为准。档案只保存
  逐文件哈希、参数与重写的通用组件，未复制私有源码或业务 payload。
- 影响：GitHub clone 暂时拿不到这些原件/源码；本地档案可用。
- 关闭：用户明确选择公开原件、先脱敏，或仅保留分析/公开生产资产。
- 关联：REQ-010。

## GAP-007：Marketing 没有 light theme

- 官网实际观察为固定 dark；模拟 `prefers-color-scheme` 不能产生稳定主题。
- 决定：作为 Marketing surface 的 `n/a`，不拿 Product light 补齐。
- 若用户确认官网也应有 light，再新增 blocker。

## GAP-008：可访问性和动效未完成

- focus-visible、dialog trap、对比度、触控目标、reduced-motion 和官网动画时序尚未系统验证。
- 关联：TODO-006, TODO-012。

## GAP-009：初次自动截图不稳定

- `SRC-046–053` 在 Lottie/页面稳定前截取，仅保留追溯，已由 `SRC-016+` 重采替代。
- 这些文件不得用于主题或布局结论。

## GAP-010：Settings/Admin 只有源码与归档 actual

- 已完成：SRC-061/EVD-011 只读源码映射、双主题可运行参考和 1440/390 actual。
- 缺少：真实登录态 Settings/Admin 的 light/dark desktop/mobile 同状态截图。
- 影响：desktop 几何可称 exact-source reimplementation，但不能称像素回归通过；mobile 仅为
  明确标注的 source-derived 适配。
- 关闭：提供登录态截图/录屏，或授权自动化采集这些页面。
- 关联：TODO-003, TODO-006, TODO-007, TODO-012, REQ-003, REQ-006, REQ-007, REQ-008。

## GAP-011：Admin 入口与接口存在 commit 内冲突

- 展开 Sidebar 的 Settings 有 `onOpenAdmin`，收起 Sidebar 的 Settings 没有；
- 前端以 developer plan 显示入口，后端 `require_developer` 按 email 白名单；
- admin 前端 tenant helper 使用 `/tenants`，同 commit 后端使用 `/teams`。
- 当前归档：显式记录差异；推荐 capability + route guard；后端路径为 canonical。
- 关闭：源码统一入口、能力模型和 API 命名，并提供部署 commit/接口兼容策略。
