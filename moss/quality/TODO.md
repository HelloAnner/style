# TODO

## 已完成

- [x] TODO-001 `blocker` 创建并核验子档案 `AGENTS.md`。（2026-08-01，AGENTS.md）
- [x] TODO-002 `blocker` 登记源码 commit、授权、原件路径与 SHA-256。（2026-08-01，SRC-001..014）
- [x] TODO-003 `high` 完成前端页面/组件/主题盘点。（2026-08-01，analysis/inventory.md）
- [x] TODO-004 `blocker` 提取 light/dark exact-source Token 并分别展开 JSON/CSS。（2026-08-01，system/）
- [x] TODO-005 `blocker` 深入分析思维链 anatomy、几何、状态与生命周期。（2026-08-01，analysis/components.md）
- [x] TODO-006 `high` 分析 assistant frame、正文、消息列与 composer。（2026-08-01，analysis/components.md）
- [x] TODO-007 `high` 建立覆盖矩阵、主题映射与实现指南。（2026-08-01）
- [x] TODO-008 `high` 生成双主题思维链参考实现。（2026-08-01，examples/reference/）
- [x] TODO-009 `high` 在 1440×900 和 390×844 渲染参考实现。（2026-08-01，EVD-001..004）
- [x] TODO-010 `high` 完成 JSON、entrypoint、关键 Token 自检。（2026-08-01，check-profile.py）
- [x] TODO-017 `blocker` 完成 App shell、完整 Chat、Sidebar 与 Workspace 源码/资产追加归档。（2026-08-01，SRC-015..039）
- [x] TODO-018 `high` 深入分析展开/折叠 Sidebar、Agent 与会话分组/状态。（2026-08-01，analysis/sidebar.md）
- [x] TODO-019 `high` 深入分析会话 header、消息滚动、空首页与 composer 组合。（2026-08-01，analysis/conversation-workspace.md）
- [x] TODO-020 `high` 深入分析右侧文件 drawer、toolbar、grid/list/batch/preview/loading。（2026-08-01，analysis/file-workspace.md）
- [x] TODO-021 `high` 交付完整对话工作台可运行组件参考及交互代码。（2026-08-01，examples/reference/conversation-workspace/）
- [x] TODO-022 `high` 完成 light/dark 1440×900 完整工作台参考渲染。（2026-08-01，EVD-005, EVD-006）
- [x] TODO-023 `blocker` 原样保存 Chat/Sidebar/Workspace 全部非测试组件实现，共110个文件及 bundle 哈希。（2026-08-01，SRC-040..042）

## 开放

- [ ] TODO-011 `blocker`
  - 范围：dark
  - 缺少：来源产品真实 dark 运行态与截图。
  - 影响：源码定义 dark，但 ThemeProvider 强制 light，不能验证运行时覆盖。
  - 负责：both
  - 需要用户提供：可访问的启用 dark 构建，或同一对话页 dark 原图。
  - 完成标准：同一数据/状态至少取得 desktop + mobile dark baseline 和计算样式。
  - 证据：SRC-001, SRC-002
  - 关联请求：REQ-001

- [ ] TODO-012 `blocker`
  - 范围：light+dark
  - 缺少：来源产品思维链真实截图与视觉回归 baseline。
  - 影响：当前几何是源码事实，但无组合视觉 baseline。
  - 负责：both
  - 需要用户提供：允许只读登录采集，或上传指定状态原图。
  - 完成标准：running/collapsed/expanded/failed/long-trace 可重复比较，差异关闭。
  - 证据：待补
  - 关联请求：REQ-001

- [ ] TODO-013 `blocker`
  - 范围：shared/mobile
  - 缺少：真实移动布局和断点。
  - 影响：源码含 MobileUnsupportedGuard，响应式规则文档缺失。
  - 负责：both
  - 需要用户提供：移动支持目标构建/原图或确认移动不适用的产品证据。
  - 完成标准：真实断点前后验证消息、思维链、composer。
  - 证据：待补
  - 关联请求：REQ-002

- [ ] TODO-014 `blocker`
  - 范围：shared
  - 缺少：字体文件许可与实际加载 FontFace/CJK fallback。
  - 影响：换行、行高和文本宽度不能完整保证。
  - 负责：user
  - 需要用户提供：字体使用授权或批准使用公开 Google Fonts 版本。
  - 完成标准：字体哈希/许可证/实际 loaded face 均记录。
  - 证据：SRC-013, SRC-014
  - 关联请求：REQ-003

- [ ] TODO-015 `blocker`
  - 范围：light+dark
  - 缺少：完整 hover/focus/error/timeout/cancelled/subagent/widget 状态矩阵。
  - 影响：核心非默认状态不能严格验收。
  - 负责：agent
  - 完成标准：来源截图/计算样式与状态矩阵全部 observed 或 validated。
  - 证据：待补
  - 关联请求：REQ-001

- [ ] TODO-016 `high`
  - 范围：shared
  - 缺少：完整键盘、focus-visible、对比度与 reduced-motion 验证。
  - 影响：可访问性与减弱动效行为不完整。
  - 负责：agent
  - 完成标准：真实浏览器审计并记录来源事实/批准偏差。
  - 证据：SRC-001
  - 关联请求：无
