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
