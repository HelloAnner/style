# Changelog

## 0.6.0 — 2026-07-30

### Sources / analysis
- 新增 Wufan 源码子集 SRC-059 与 EVD-010，记录“工作室”入口、文件画布、多标签、
  FilePreview、workspaceStore 和文件 API；私有源码原件未复制。
- 新增 SRC-060，以 Wufan `AgentMessage/platform API/AutomationToast` 校正反馈和执行通知契约；
  SRC-058 保留为用户指定的固定原因选择器跨系统参考。
- 在 `AGENTS.md` 登记 Wufan 源码绝对路径 `/Users/anner/fine/ai/corevo`，并明确
  `/Users/anner/fine/ai/dev` 只作为用户指定的独立跨系统参考。

### Implementation / contract
- 新增 `WufanWorkspaceStudio`（保留 `WufanWorkspaceFiles` 兼容导出），覆盖常驻 canvas、
  共享/会话分组、搜索、上传回调、多标签去重/上限、loading、5s 慢加载、error/retry、
  AbortSignal、编辑、HTML 渲染、下载/分享/新窗口和 12 类预览分流。
- `WufanRightPanel` 的 workspace 改为真实“工作室”组件，移除重复 Header 并增加最大化/还原。
- React 类型、机器规格和零构建 demo 同步；demo 可从文件列表进入 Markdown/CSV/JSON/
  PDF/Excel/文本/unsupported 预览。
- 后端契约改为 Wufan 已有 `/api/agents/...`：共享/会话文件列表、GET/PUT、Range、
  DOC→PDF、上传、文件分享、逻辑相对路径、跨租户校验和 HTML sandbox；反馈契约同步
  Wufan `PUT/DELETE + sentiment/content/categories`。

### Validation / status
- React bundle、零构建脚本、JSON 和两份 JSON Schema 样例校验通过；light/dark desktop
  和 dark mobile 文件列表/预览交互保存 actual。
- 新增并关闭 TODO-019；当前 11/19 完成，仍有 8 个开放 TODO、6 个 blocker 和
  8 个开放请求。档案保持 `analyzed`。

## 0.5.0 — 2026-07-30

### Sources / analysis
- 新增用户过程轨迹原图 SRC-056，以及授权参考源码子集 SRC-057/058；私有源码原件未复制。
- 新增 EVD-008/009，分别记录过程正文/工具链，以及反馈、右侧面板、执行结果通知的组件参数、
  文件哈希、版本冲突与准确边界。
- 确认“执行完成 / 执行异常 / 查看详情”实际来自 `AutomationToast`，不是过程轨迹或旧版执行链面板。

### Implementation
- 新增 `WufanReasoningTrace` 和六态 fixtures，覆盖等待、运行、完成、失败、取消、超时、
  来源、耗时、折叠、“更多”、spinner、shine 和 reduced motion。
- 新增 `WufanMessageActions`：点赞/点踩互斥、撤销、乐观状态，以及 300px 点踩原因锚定浮层。
- 新增 `WufanRightPanel`：工作区、执行链、自动化顶部入口与 300ms 互斥面板。
- 新增 `WufanExecutionNotices`：执行完成/异常、5s 自动关闭、hover 暂停、300ms 进出场与详情联动。
- 静态 demo 右下角增加可重放状态实验条；React 和零构建示例使用同一 CSS。

### Backend contract
- 新增过程轨迹历史快照、SSE/WebSocket 事件、幂等/恢复与安全边界。
- 新增反馈 POST/DELETE、viewer_feedback、面板建议快照、notification.created 与已读接口；
  附 JSON Schema 和脱敏样例。

### Validation / status
- React bundle、JSON、diff whitespace 通过；在 1594×974 light 实际点验运行态、反馈浮层、
  互斥面板、异常通知和详情路由，保存 actual。
- 新增并关闭 TODO-017/018；当前 10/18 完成，仍有 8 个开放 TODO、6 个 blocker 和
  8 个开放请求。档案保持 `analyzed`。

## 0.4.0 — 2026-07-29

### Analysis
- 新增 EVD-007，将当前生产 Sidebar、Logo、MessageList、Composer 与本地源码 anatomy 映射为可读组件。
- 修正对话 MessageList 的版本事实：当前生产为 960px，旧本地源码为 880px。
- 继续完善 Sidebar、Header、消息、主题、响应式、动效/可访问性描述，并明确 dark populated/mobile 的 baseline 限制。

### Implementation
- 新增 `examples/reference/chat-page/`：完整 React 页面、明/暗 CSS、类型、脱敏 mock、机器规格和零构建交互 demo。
- 示例覆盖左侧任务/对话列表、Chat Header、中间消息区、Composer、主题切换、发送与 mobile drawer。
- 未复制真实用户数据、私有 store/API 或含个人信息原图。

### Validation
- 在 1594×974 light/dark 和 390×844 light/dark 实际运行，保存 5 张 actual 与运行时指标。
- 主题值、240px Sidebar、56px Header、960px MessageList、800px Composer、发送状态和 280px mobile drawer 通过。
- 缺少 dark populated/mobile 来源原图，因此未伪造 baseline/diff。

### Status / TODO
- 新增并关闭 TODO-016；当前 8/16 完成，仍有 8 个开放 TODO、6 个 blocker 和 8 个开放用户请求。
- 档案保持 `analyzed`；对话主路径代码可直接消费，但不提升整个系统为 complete。

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
