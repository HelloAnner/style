# 悟帆 AI 档案完整性待办

> 当前 **6/14** 完成；8 个开放项，其中 6 个 blocker。全部关闭前不得标记 `complete`。

- [x] TODO-001 `blocker`
  - 范围：shared
  - 完成：已确认系统为悟帆 AI，网站 `https://www.wufanai.com/`，并区分 Marketing/Product。
  - 负责：both
  - 完成标准：身份、版本线索和范围进入 manifest/inventory。
  - 证据：SRC-001, SRC-004–013
  - 关联请求：REQ-001 `answered`
  - 完成时间：2026-07-26

- [ ] TODO-002 `blocker`
  - 范围：light
  - 缺少：登录后 Product 关键页面的完整 light 覆盖
  - 影响：只有对话和 What’s New light，缺少同页配对、移动端和主要状态
  - 负责：both
  - 需要用户提供：允许登录态自动采集，或提供新任务/对话/设置/工作台的 light desktop+mobile 原图
  - 完成标准：关键页面/组件 light 矩阵 validated
  - 证据：SRC-003, SRC-014, SRC-032–035, SRC-042–043
  - 关联请求：REQ-002, REQ-008

- [ ] TODO-003 `blocker`
  - 范围：dark
  - 缺少：登录后 Product 关键页面的完整 dark 覆盖
  - 影响：只有新任务 dark，缺少对话、What’s New、移动端和主要状态
  - 负责：both
  - 需要用户提供：允许登录态自动采集，或提供对应 dark 配对原图
  - 完成标准：关键页面/组件 dark 矩阵 validated
  - 证据：SRC-002, SRC-024–027, SRC-040–041
  - 关联请求：REQ-003, REQ-008

- [x] TODO-004 `high`
  - 范围：shared
  - 完成：已静态分析用户源码，保存 sanitized frontend snapshot；同时归档当前线上 CSS/JS 和运行时计算样式。
  - 负责：agent
  - 完成标准：关键 Token 具备 exact-source/runtime 证据。
  - 证据：SRC-004, SRC-012–013, SRC-036–045
  - 关联请求：REQ-004 `answered`
  - 完成时间：2026-07-26

- [ ] TODO-005 `blocker`
  - 范围：shared
  - 缺少：中文实际字体策略及字体/源码/素材再发布授权确认
  - 影响：跨平台换行可能不同；公开 GitHub 可能存在权利风险
  - 负责：both
  - 需要用户提供：确认 CJK 字体与公开发布许可
  - 完成标准：字体实际加载/回退可重复，许可证归档，公开范围明确
  - 证据：SRC-008, SRC-015, SRC-040, SRC-042
  - 关联请求：REQ-005, REQ-010

- [ ] TODO-006 `blocker`
  - 范围：light | dark
  - 缺少：核心组件双主题视觉状态矩阵与动效
  - 影响：源码定义不能替代当前线上 hover/focus/error/loading/open 验证
  - 负责：both
  - 需要用户提供：登录态访问、Storybook、状态截图或录屏
  - 完成标准：核心组件两主题主要状态 validated
  - 证据：SRC-004, SRC-012–014
  - 关联请求：REQ-006, REQ-008

- [ ] TODO-007 `blocker`
  - 范围：light | dark
  - 缺少：登录后 Product mobile 视觉证据
  - 影响：只能从源码得知 768px 行为，无法证明实际布局
  - 负责：both
  - 需要用户提供：登录态 390×844 自动访问或同页双主题截图
  - 完成标准：Sidebar drawer、Chat、Composer、消息、Main Stage 在 mobile validated
  - 证据：公开 login/marketing mobile + SRC-004
  - 关联请求：REQ-007, REQ-008

- [x] TODO-008 `high`
  - 范围：shared
  - 完成：已建立页面、组件、状态、主题、资源盘点和覆盖矩阵；未覆盖单元由独立 TODO 跟踪。
  - 负责：agent
  - 完成标准：`analysis/inventory.md` 与 `coverage-matrix.md` 有实质矩阵。
  - 证据：analysis/inventory.md, analysis/coverage-matrix.md
  - 关联请求：无
  - 完成时间：2026-07-26

- [x] TODO-009 `high`
  - 范围：light | dark
  - 完成：已生成两主题独立分析、映射及 453/449 个完整运行时变量。
  - 负责：agent
  - 完成标准：light/dark/mapping 与展开 Token 完成且不混用。
  - 证据：SRC-040, SRC-042, analysis/themes/, system/themes/
  - 关联请求：无
  - 完成时间：2026-07-26

- [ ] TODO-010 `high`
  - 范围：shared
  - 缺少：所有业务子系统组件/模式、动效和可访问性均达到无关键未知
  - 影响：当前分析集中在核心壳层、聊天、登录、官网和 What’s New
  - 负责：agent
  - 需要用户提供：先关闭登录态与状态证据请求
  - 完成标准：全部必需 analysis 文档无关键 gap
  - 证据：当前 analysis/ 初版
  - 关联请求：REQ-006–009

- [x] TODO-011 `high`
  - 范围：light | dark
  - 完成：已生成聚合 Token、双主题完整 Token/CSS、Marketing Token、style guide 和 implementation。
  - 负责：agent
  - 完成标准：JSON 可解析，生成文件一致且可重建。
  - 证据：system/, examples/reference/build-tokens.py
  - 关联请求：无
  - 完成时间：2026-07-26

- [ ] TODO-012 `blocker`
  - 范围：light | dark
  - 缺少：参考实现与双主题、多视口视觉回归
  - 影响：当前只有来源 baseline，没有 archive→new system actual/diff
  - 负责：both
  - 需要用户提供：登录态 baseline/当前源码映射，并指定首个复刻验证页面
  - 完成标准：Product light/dark desktop/mobile + 核心状态可重复比较，0 未解释差异
  - 证据：现有公开 baseline SRC-016–045
  - 关联请求：REQ-008, REQ-009

- [ ] TODO-013 `high`
  - 范围：shared
  - 缺少：最终验收、无开放请求和 complete 自检
  - 影响：当前状态只能是 analyzed
  - 负责：both
  - 需要用户提供：确认授权、版本和批准偏差
  - 完成标准：acceptance 全通过、TODO/REQUEST 清零、completion report 通过
  - 证据：待补
  - 关联请求：全部 open request

- [x] TODO-014 `high`
  - 范围：shared
  - 完成：子档案 AGENTS、主动探索脚本、日志、来源/请求入口已建立。
  - 负责：agent
  - 完成标准：另一个 AI 只进入本目录可找到实现与缺口。
  - 证据：AGENTS.md, examples/reference/, sources/exploration-log.md, quality/REQUESTS.md
  - 关联请求：无
  - 完成时间：2026-07-26
