# 悟帆 AI 设计风格档案

## 一句话风格定义

Product 是暖白/近黑双主题、低对比 surface、紧凑圆角和紫蓝 Agent 人格图形组成的 AI 工作空间；Marketing 是固定暗色、衬线编辑感与抽象动态艺术组成的品牌叙事表面。

## 档案状态

- 状态：`analyzed`（v0.6.0）
- 结论：已完成第一轮网站、截图、源码、运行时 CSS 和双主题 Token 深度分析；登录页小人、
  对话主路径、过程轨迹、反馈、右侧工作室/文件预览和执行结果通知已有可运行参考；
  **尚未 complete，不能对所有页面保证完全复刻**。
- 完成率与 blocker：以 `manifest.json` 和 `quality/TODO.md` 为准。

## Product Light

- 分析：`analysis/themes/light.md`
- 完整 Token：`system/themes/light.tokens.json`
- CSS：`system/themes/light.css`

## Product Dark

- 分析：`analysis/themes/dark.md`
- 完整 Token：`system/themes/dark.tokens.json`
- CSS：`system/themes/dark.css`

## Marketing

- Token：`system/marketing.tokens.json`
- CSS：`system/marketing.css`
- 注意：固定暗色，不与 Product 双主题混用。

## 可直接复用组件

- 完整对话工作区：`examples/reference/chat-page/README.md`
- 对话 React 页面：`examples/reference/chat-page/WufanChatPage.tsx`
- 对话双主题 CSS：`examples/reference/chat-page/wufan-chat.css`
- 对话零构建演示：`examples/reference/chat-page/demo.html`
- 过程轨迹：`examples/reference/chat-page/WufanReasoningTrace.tsx`
- 工具链六态：`examples/reference/chat-page/trace-state-fixtures.ts`
- 点赞/点踩与原因浮层：`examples/reference/chat-page/WufanMessageFeedback.tsx`
- 右侧面板：`examples/reference/chat-page/WufanRightPanel.tsx`
- 执行完成/异常通知：`examples/reference/chat-page/WufanExecutionNotice.tsx`
- 后端过程事件：`examples/reference/chat-page/runtime-contract.md`
- 反馈/面板/通知接口：`examples/reference/chat-page/interaction-contract.md`
- 工作室/文件预览：`examples/reference/chat-page/WufanWorkspaceFiles.tsx`
- 登录页紫蓝小人：`examples/reference/login-mascot/README.md`
- React 实现：`examples/reference/login-mascot/WufanLoginMascot.tsx`
- 机器规格：`examples/reference/login-mascot/spec.json`
- 零构建演示：`examples/reference/login-mascot/demo.html`
- 对话示例包括 Sidebar、任务/对话列表、Chat Header、Message List/Bubble、Composer、
  过程轨迹、消息反馈、右侧面板、Wufan 工作室/文件预览与执行结果通知；映射见
  `EVD-007/008/009/010`，反馈与通知的 Wufan 原生校正来源为 `SRC-060`。
- 注意：本地 `corevo` 的 `14394dc` 登录页源码不含当前小人；精确实现来自生产 bundle `SRC-013`，版本核对见 `EVD-006`。

## 视觉指纹

1. Light `#FAF9F7` / Dark `#0A0A0F`；
2. 极淡边框与细微 surface 阶梯；
3. Inter + 14px 内容排版；
4. 4–32px 紧凑 spacing；
5. 8–20px 中等圆角；
6. 240px Sidebar、56px Header、12px layout gap；
7. 低饱和控件 + 紫蓝 Agent 人格图形；登录小人使用精确 SVG、随机眨眼、漂浮和视线跟随；
8. 800px Composer / 当前生产 960px MessageList（旧本地源码为 880px）；
9. light/dark 不是反色，而是完整语义映射；
10. Marketing serif、Product sans 的明确分层。

## 实现 Agent 阅读顺序

1. `AGENTS.md`
2. `manifest.json`
3. `quality/TODO.md`、`quality/gaps.md`
4. `system/style-guide.md`
5. 目标 surface/theme Token
6. `analysis/components.md`、`analysis/layout.md`、`analysis/patterns.md`
7. `system/implementation.md`
8. `quality/acceptance.md`

## 来源

见 `sources/index.md`、`sources/capture-manifest.json` 和 `sources/exploration-log.md`。

## 关键缺口

登录后同页双主题原图、登录后移动端原图、完整状态矩阵、当前部署对应源码、字体/源码公开权和完整视觉回归。对话示例已关闭“缺少代码入口”，但不替代这些 baseline 缺口。详见 `quality/REQUESTS.md`。
