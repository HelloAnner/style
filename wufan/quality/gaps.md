# 已知缺口与冲突

## GAP-001：登录后页面没有同页双主题配对

- 现有：dark 新任务 `SRC-002`；light 对话 `SRC-003`；light What’s New `SRC-014`。
- 影响：无法证明同一页面/状态在两主题的所有组件映射。
- 关闭：登录后新任务、对话、What’s New 分别提供 light/dark 同视口截图，或授权自动化访问。
- 关联：TODO-002, TODO-003, REQ-002, REQ-003, REQ-008。

## GAP-002：登录后移动端缺失

- 现有：公开登录和 Marketing 390px；源码声明 `<768px` 行为。
- 影响：无法视觉验证 Sidebar drawer、Chat Header、Composer、消息和 Workspace。
- 关闭：授权登录态自动截图或提供 390×844 配对截图。
- 关联：TODO-007, REQ-007, REQ-008。

## GAP-003：交互状态矩阵未视觉验证

- 现有：源码/线上 CSS 定义 hover、active、loading、error、open 等；用户图仅 default/populated。
- 影响：源码值可能被线上版本覆盖，且无法证明焦点、浮层、时序。
- 关闭：登录态浏览器自动采集或 Storybook/状态截图/录屏。
- 关联：TODO-006, REQ-006, REQ-008。

## GAP-004：源码与当前线上版本冲突

- 用户源码 commit 为 2026-07-23；线上资产更新更晚。
- 当前线上 What’s New 与源码 `WhatsNew.tsx` 结构不同；源码 Logo 文案仍为 Moss。
- 当前登录小人也只存在于线上生产 bundle；本地 `AuthPage.tsx` 是旧版，聊天 `EmptyState` 的无眼流体头像不是同一组件。
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
