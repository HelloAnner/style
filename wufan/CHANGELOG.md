# Changelog

## 0.3.0 — 2026-07-29

### Sources
- 新增用户提供的 1598×961@2x 明色登录页和登录小人局部原图（SRC-054/055）。
- 重新核对 `/Users/anner/fine/ai/corevo`：当前 `14394dc` 的 `AuthPage.tsx` 不含新版小人；精确实现存在于已归档生产 bundle SRC-013。

### Analysis
- 新增 EVD-006，恢复登录小人的 SVG 几何、三段渐变、双眼、眨眼、漂浮、视线跟随和面板覆盖关系。
- 登录小人 light/dark desktop 已有来源证据；mobile 明确为不渲染，而非缩小。

### Implementation
- 新增 `examples/reference/login-mascot/`：React + Framer Motion 组件、机器规格、零构建交互演示和使用说明。
- 新增登录小人独立验证入口，防止消费 Agent 误用旧登录页或聊天页流体头像。

### Status / TODO
- 新增并关闭 TODO-015；当前 7/15 完成，仍有 8 个开放 TODO、6 个 blocker 和 8 个开放用户请求。
- 档案保持 `analyzed`；本次只完成登录小人组件范围，不提升整体状态。

## 0.2.0 — 2026-07-26

### Sources
- 登记网站、三张用户截图、用户源码、公开生产 CSS/JS、字体和自动采集结果，共 53 项来源。
- 保存 31 张原始截图和 10 份计算样式；私有/含个人信息资料暂不进入 public Git。

### Analysis
- 区分 Product 双主题与 Marketing 固定暗色两套表面。
- 完成 inventory、coverage、foundations、theme mapping、layout、components、patterns、motion/accessibility 初版。
- 发现用户源码 commit 落后于当前线上版本，What’s New/Logo 存在版本冲突。

### Tokens / implementation
- 生成 Product light 453 / dark 449 个完整运行时变量及 CSS；93 个共享值。
- 生成 Marketing 36 个独立 Token。
- 新增 style guide、implementation、acceptance 和可重复主动探索脚本。

### Status / TODO
- 状态从 `intake` 提升为 `analyzed`。
- 完成 6/14；仍有 8 个开放 TODO、6 个 blocker 和 8 个用户请求。

## 0.1.0 — 2026-07-26

- 新增子档案 `AGENTS.md`，声明严格复刻和双主题规则。
- 新增主动探索日志与用户请求队列。
- 根据新版档案规范更新 manifest 和完整性计数。
- 档案仍为 `intake`；尚无任何设计来源。

## 0.0.1 — 2026-07-26

- 初始化 `wufan` 档案。
- 状态设为 `intake`。
- 建立完整性待办；尚无风格来源或分析结论。
