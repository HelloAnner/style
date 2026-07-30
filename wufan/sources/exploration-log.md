# 主动探索日志

## EXP-20260726-01

- 输入：仅有空目录名称 `wufan`
- 目标：建立档案入口、完整性机制和用户请求队列
- 环境：本地文件系统
- 动作：建立 manifest、README、子档案 AGENTS、TODO、REQUESTS、gaps 和自检报告
- 新增文件：见 `CHANGELOG.md`
- 发现：当前没有 URL、截图、源码、录屏、设计稿或素材可供探索
- 限制：缺少参考系统身份和全部原始证据
- 覆盖变化：无设计覆盖
- 新增/关闭 TODO：完成 TODO-014；TODO-001 至 TODO-013 保持开放
- 需要用户：REQ-001 至 REQ-007

## EXP-20260726-02

- 输入：网站 `https://www.wufanai.com/`、用户截图 SRC-002/SRC-003/SRC-014、源码路径 `/Users/anner/fine/ai/corevo`
- 目标：完成第一轮 URL + 截图 + 源码混合主动探索，生成双主题精确 Token 和可消费规范
- 环境：macOS；Playwright 1.56.1；Chromium 141.0.7390.37；Python Pillow 12.3.0；locale zh-CN；Asia/Shanghai；自动截图 DPR1
- 安全检查：网站公开且 robots 允许公开页面；未登录、未提交表单；源码先静态检查，未执行；发现私有 Git remote、tracked env 文件和用户截图隐私，未归档 env/secret，私有资料通过本地 exclude 阻止公开推送
- 网站动作：获取 `/`、`/learn`、`/pricing`、`/login` HTML；归档当前生产 CSS/JS、Logo、品牌字体；读取 robots/sitemap；自动截取 desktop/mobile、Product login light/dark 和 Marketing fixed-dark；提取 DOM、计算样式、字体、CSS variables
- 源码动作：读取项目 AGENTS/package/config；确认 React/Vite/Tailwind/Framer/Lucide；分析 globals.css、ThemeProvider、App、Sidebar、Chat、InputBar、MessageBubble、WhatsNew、breakpoint；建立 sanitized frontend snapshot（不含 env 与 AppleDouble）
- 截图动作：原样保存三张用户图并计算哈希；推断 Retina DPR≈2；使用 Pillow 提取尺寸/色板；生成 Sidebar/Composer/Message 派生裁切
- 交叉验证：发现源码 commit 2026-07-23 早于线上资产；线上 What’s New 与 SRC-014 一致，但与源码同名组件结构冲突；当前规则以线上 CSS/JS/计算样式优先
- 新增文件：53 项来源、31 张截图、10 份计算样式、公开字体清单、source snapshot、analysis/system/quality 全套初版、可重复采集/分析/Token 脚本
- Token：Product light 453 个运行时变量、dark 449 个，93 个共享；另生成 Marketing 36 个固定暗色变量
- 覆盖变化：Marketing 首页/教程/定价 desktop+mobile observed；Product login 双主题 desktop+mobile observed；登录后 Product 仅部分 desktop
- 限制：无安全登录态；登录后同页双主题/mobile/状态矩阵缺失；源码版本落后；字体与私有资料公开授权待确认；未执行 archive→new-system 视觉回归
- 新增/关闭 TODO：关闭 TODO-001/004/008/009/011；保留 8 个开放项
- 需要用户：REQ-002/003/005/006/007/008/009/010

## EXP-20260729-01

- 输入：用户提供的完整明色登录页 SRC-054、登录小人局部图 SRC-055、源码路径 `/Users/anner/fine/ai/corevo`
- 目标：确认档案是否已有登录小人代码；恢复成其他系统可直接引用的精确组件
- 环境：macOS；源码只读静态分析；本地 `corevo` commit `14394dc7ca16aa13c62e8a089c6ffff4953424f3`；归档生产 bundle `index-ChXKQFVA.js`
- 安全检查：未读取/归档 env、凭据或业务数据；两张新图仅含公开登录 UI；用户明确要求把该组件放入 wufan 供其他系统参考
- 源码动作：检查 `web/src/pages/auth/AuthPage.tsx`、`web/src/components/Chat/ChatContainer.tsx` 和生产 bundle；确认本地登录页是旧版、聊天头像不是目标小人
- 提取动作：从 SRC-013 恢复生产符号 `La/Oa/zh/nBe`，整理 SVG、颜色、定位、眨眼、漂浮、视线约束和 mobile 隐藏规则
- 新增文件：SRC-054/055；EVD-006；`examples/reference/login-mascot/` 下 React 组件、JSON 规格、零构建演示与说明
- 覆盖变化：登录小人 light/dark desktop 从“登录页整体 observed”细化为独立组件 exact-source；移动端以来源壳层和截图证明不渲染
- 限制：本地 `corevo` 版本仍早于当前线上；完整登录页及全部登录状态的 archive→target 视觉回归仍属于 TODO-012
- 新增/关闭 TODO：新增并关闭 TODO-015；其他开放项不变
- 需要用户：无需为本组件新增请求；REQ-009/010 更新为部分已确认，整体仍 open

## EXP-20260729-02

- 输入：用户要求对话页面也提供可被其他系统完整复刻的代码例子，并明确包含左侧对话列表、
  中间对话区域、整体风格与 light/dark
- 目标：不依赖私有业务 store/API，恢复可运行的完整对话主路径，同时继续完善风格描述
- 环境：macOS；agent-browser 0.8.5；本地静态服务器；1594×974 与 390×844；
  locale zh-CN；Asia/Shanghai
- 安全检查：只读检查 `/Users/anner/fine/ai/corevo` 与已归档生产资产；不运行私有源码；
  不复制 SRC-002/003 的个人信息、对话文本或原图；使用新写的脱敏 mock
- 源码动作：分析 App/Sidebar/ChatContainer/MessageList/MessageBubble/InputBar 组件链；确认本地
  `14394dc` 与生产在 Logo、导航、Header border、MessageList 宽度和 Composer 细节存在差异
- 生产动作：从 SRC-013 恢复当前 Logo SVG、Sidebar anatomy、960px MessageList、消息与
  Composer 几何；从 SRC-012/运行时 Token 分离 light/dark
- 新增文件：EVD-007；`examples/reference/chat-page/` 下 React、CSS、types、脱敏 mock、
  spec、零构建 demo 和说明；`examples/validation/chat-page/` 下 5 张 actual、指标与报告
- 浏览器验证：1594×974 light/dark；390×844 light/dark；Sidebar drawer；theme toggle；
  Composer empty/active；发送后消息 2→3
- 覆盖变化：关闭“对话页面没有可运行代码入口”；增加 light/dark desktop/mobile 本地 actual；
  来源覆盖矩阵不将 dark populated/mobile 升级为 observed
- 限制：dark populated 和登录后 mobile 仍无来源 baseline；streaming/upload/error 等长尾状态
  未纳入精简主路径；中文字体和当前生产源码映射仍 open
- 新增/关闭 TODO：新增并关闭 TODO-016；原 8 个开放项不变
- 需要用户：REQ-002/003/005/006/007/008/009/010 保持 open

## EXP-20260730-01

- 输入：用户提供的 light 完成态过程轨迹局部图 SRC-056；用户指定独立
  `corevo-platform` 工作区 `/Users/anner/fine/ai/dev` 作为跨系统参考源码 SRC-057
- 目标：补齐对话页“每轮正文 + 每轮工具调用”的过程轨迹、完整交互动画和后端理论契约
- 环境：macOS；源码只读静态分析；参考 commit
  `9b0765cfbd47533bdd326d42140b29309d29a5eb`；本地静态 demo
- 安全检查：先读参考仓库 AGENTS/package/前端目录；不运行私有服务、不访问 env/凭据；
  不复制私有 store/API/原始工具 payload；仅记录六个 UI/协议文件的 SHA-256
- 源码动作：定位 `ReasoningTraceSection → ActionFeed → ActionItem`，核对 runtime event、
  view model、正文与工具的 eventSeq 归组、完成/运行/失败状态、来源数量和耗时
- 截图动作：原样保存 2072×620 crop 并计算哈希；与 exact-source 14/22、13/20、图标槽、
  连接线和缩进交叉测量
- 新增文件：SRC-056/057、EVD-008、`WufanReasoningTrace.tsx`、过程轨迹 CSS、
  后端快照/事件文档、JSON Schema 和事件例子；同步 React mock 与零构建 demo
- 覆盖变化：通用 process trace 的 light expanded completed 从 unknown 升为 observed；
  running/failed/animation 和 dark 为 exact-source/source-derived，尚无同状态视觉 baseline
- 限制：dark 同状态原图、真实 streaming 录屏、来源 drawer、专用工具卡片和登录后 mobile
  仍未覆盖；不关闭 TODO-006/007/012
- 新增/关闭 TODO：新增并关闭 TODO-017；原 8 个开放项不变
- 需要用户：现有 REQ-002/003/005/006/007/008/009/010 保持 open

## EXP-20260730-02

- 输入：用户补充要求点赞/点踩原因交互、右上角面板入口、真实工具链状态，以及
  “执行完成/执行异常/查看详情”组件；继续以独立 `corevo-platform` 工作区
  `/Users/anner/fine/ai/dev` 为跨系统授权参考
- 目标：把反馈、右侧面板和执行结果通知拆成其他系统可单独消费的组件，并修复归档 demo
  只有完成态、没有可见状态矩阵的问题
- 环境：macOS；agent-browser 0.8.5；本地静态服务器；1594×974；参考 commit
  `9b0765cfbd47533bdd326d42140b29309d29a5eb`
- 安全检查：只读分析私有源码；未启动私有前后端、未读取 env、凭据或真实通知/反馈数据；
  归档只保存 SHA-256、参数、脱敏 mock 和重写实现
- 源码动作：定位 `MessageActions / DislikeModal / useMessageFeedbackState / api/feedback`；
  定位 `ChatSessionHeader / App / uiStore` 的互斥右面板；确认指定文案实际来自
  `AutomationToast`，而非 process trace 或旧 ExecutionChain 面板
- 实现动作：新增 `WufanMessageActions`、`WufanRightPanel`、
  `WufanExecutionNotices`、六态 trace fixtures；静态 demo 增加状态实验条、反馈浮层、
  三类面板和成功/异常通知
- 后端契约：先记录跨系统反馈 POST/DELETE 与 viewer_feedback；在 EXP-20260730-03
  确认 Wufan 源码后，适配为 Wufan 的 PUT/DELETE 与 sentiment/content/categories；
  三类面板、notification 事件、JSON Schema 与脱敏样例同步
- 浏览器验证：running spinner/shine；execution 面板；300px 点踩浮层、空态禁用、多选提交、
  互斥/撤销；failed notice 300ms 进出场和点击打开 automation 面板
- 新增来源/证据：SRC-058、EVD-009；私有源码原件未复制
- 覆盖变化：工具链六态从“类型存在”升级为可运行 fixture/demo；反馈和通知交互升为
  exact-source；右侧面板升为 exact-source 跨版本组合
- 限制：dark/mobile 缺真实登录后同状态原图；右侧面板业务内容是脱敏结构样例；
  普通用户侧不回显反馈原因文本
- 新增/关闭 TODO：新增并关闭 TODO-018；原 8 个开放项不变
- 需要用户：现有 REQ-002/003/005/006/007/008/009/010 保持 open

## EXP-20260730-03

- 输入：用户补充要求同步 Wufan 右侧文件预览组件和相关逻辑，并确认 Wufan 源码在
  `/Users/anner/fine/ai/corevo`
- 目标：将 workspace 从静态文件行扩展为 Wufan 真实的
  “常驻文件画布 → 多标签 → 加载 → 类型预览/编辑/渲染”状态机，并写清服务端文件契约
- 环境：macOS；私有源码只读静态分析；参考 commit
  `14394dc7ca16aa13c62e8a089c6ffff4953424f3`；React esbuild 与零构建 demo
- 安全检查：未运行私有后端、未读取 env/凭据、未复制业务文件；只记录 6 个源文件 SHA-256、
  参数、脱敏 fixture 和重写组件
- 源码动作：定位 `Workspace → FileCanvas → FilePreview`，核对 `workspaceStore`
  的 canvas 常驻、fileId/path/level/sessionId 去重、8 标签限制和会话清理；核对 Wufan
  `/api/agents/...` 文件、上传、编辑和分享接口
- 实现动作：新增 `WufanWorkspaceStudio`（保留旧导出别名）；同步共享/会话分组、搜索、上传回调、
  canvas 常驻、文件标签、420ms fixture loading、5s 慢加载、错误重试、AbortSignal、编辑、下载、
  分享、新窗口、最大化和 12 类预览分流；静态 demo 增加完整可点击路径
- 后端契约：补充共享/会话文件列表、逻辑相对路径、逐段 encode、GET/PUT、Range、DOC→PDF、
  HTML sandbox、上传、分享和跨租户校验
- 新增来源/证据：SRC-059、EVD-010；私有源码原件未复制
- 原生校正：追加 SRC-060，只读核对 `AgentMessage`、`messageFeedbackTarget`、
  `api/platform`、`AutomationToast` 与 `App`；确认反馈使用 PUT/DELETE、
  `sentiment/content/categories` 和失败回滚，固定原因浮层保留为 SRC-058 跨系统增强
- 覆盖变化：右侧 workspace 从脱敏静态结构样例升级为 Wufan source-derived 交互状态机；
  Excel/PPTX/PDF 内容解析器在无依赖归档中仍使用确定性视觉 fixture
- 限制：缺同一预览状态的真实 light/dark/mobile 截图；folder/browser-live、右键重命名/删除和
  富文本 Markdown 编辑器未进入当前最小聊天示例
- 新增/关闭 TODO：新增并关闭 TODO-019；原 8 个开放项不变
- 需要用户：现有 REQ-002/003/005/006/007/008/009/010 保持 open
