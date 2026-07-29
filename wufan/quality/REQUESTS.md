# 悟帆 AI 用户资料请求

> Agent 已先完成公开网站自动截图、计算样式、字体归档、源码静态分析、生产资产分析和截图测量。以下仅保留无法在无登录/无授权条件下自行关闭的问题。

## REQ-001 `answered`
- 优先级：blocker
- 请求：确认目标系统身份和 URL
- 回答：悟帆 AI，`https://www.wufanai.com/`
- 关闭：TODO-001

## REQ-002 `open`
- 优先级：blocker
- 请求：补充登录后新任务、对话、设置/工作台的 light 原图
- 已主动尝试：采集公开登录 light desktop/mobile；分析用户 light 对话与 What’s New；读取源码/生产 CSS
- 原因：现有 light 页面不能与 dark 同页比较
- 最省力方式：优先通过 REQ-008 授权自动采集；否则上传同一 viewport 原图
- 收到后：补齐 TODO-002

## REQ-003 `open`
- 优先级：blocker
- 请求：补充与 light 完全对应的 dark 登录后原图
- 已主动尝试：采集公开登录 dark；分析用户 dark 新任务；读取完整 dark runtime Token
- 原因：缺对话、What’s New 和工作台 dark 配对
- 最省力方式：优先通过 REQ-008；否则上传同页同 viewport 原图
- 收到后：补齐 TODO-003

## REQ-004 `answered`
- 优先级：high
- 请求：源码或可验证运行时值
- 回答：用户提供 `/Users/anner/fine/ai/corevo`；Agent 另归档线上 CSS/JS 和计算样式
- 关闭：TODO-004

## REQ-005 `open`
- 优先级：blocker
- 请求：确认 Product 中文字体策略及字体公开再发布许可
- 已主动尝试：下载网页公开字体/CSS，确认 Inter/JetBrains/Smiley/MiSans 声明和运行状态
- 原因：Inter 不含完整 CJK；系统 fallback 会导致换行差异，字体公开仓库授权尚未全部核验
- 最省力方式：说明线上指定中文字体，以及是否允许把归档字体放入 public repo
- 收到后：关闭 TODO-005 字体部分

## REQ-006 `open`
- 优先级：blocker
- 请求：提供核心交互状态与动效证据
- 已主动尝试：从源码/线上 CSS 提取 hover/active/loading/error/open 和 motion 参数
- 原因：当前线上版本可能覆盖源码，静态图不能证明 focus、浮层和时序
- 最省力方式：通过 REQ-008 自动采集；或提供 Storybook/状态截图/录屏
- 收到后：补齐 TODO-006

## REQ-007 `open`
- 优先级：blocker
- 请求：提供登录后 Product 的 mobile 视图
- 已主动尝试：自动采集 Marketing/Login 390×844；源码确认 Product `<768px` 规则
- 原因：无法视觉验证登录后 Sidebar drawer、Chat、Composer 和 Workspace
- 最省力方式：通过 REQ-008；或提供 390×844 light/dark 原图
- 收到后：补齐 TODO-007

## REQ-008 `open`
- 优先级：blocker
- 请求：提供安全的登录态主动探索方式
- 已主动尝试：无凭据访问 `/login`、`/app`；只读采集公开页面，未提交表单
- 原因：登录后应用是当前最大证据缺口
- 最省力方式：任选一种：①测试账号；②可复用且已脱敏的 Playwright storage state；③本地可运行的 mock/demo 启动方式。不要直接在对话中发送生产密码
- 安全范围：只读浏览/截图，不提交、删除、付款或改数据
- 收到后：自动补采双主题 × desktop/mobile × 核心状态
- 关联：TODO-002,003,006,007,012

## REQ-009 `open`
- 优先级：high
- 请求：确认与当前线上部署对应的源码版本
- 已主动尝试：对比 commit、线上资产和 What’s New 文案/结构
- 原因：commit `14394dc` 的 WhatsNew/Logo 早于当前生产实现
- 最省力方式：提供当前生产 commit/branch，或确认“线上资产为当前真相源”
- 收到后：关闭版本冲突 GAP-004
- 本轮进展：登录小人已确认只存在于当前生产 bundle，不在本地 `14394dc` 的旧 `AuthPage.tsx`；该组件暂以线上资产为真相源，其他版本冲突仍未关闭。
- 对话进展：Sidebar/消息/Composer 的当前几何也以线上 `SRC-012/013` 为真相源，本地源码仅用于一致的 anatomy 与 mobile 行为；版本请求仍需关闭。

## REQ-010 `open`
- 优先级：blocker（公开发布）
- 请求：确认哪些用户原图和私有源码可以推送到 public GitHub
- 已主动尝试：扫描秘密；对私有源码仅做 sanitized frontend snapshot；使用 `.git/info/exclude` 防止误推送
- 原因：两张截图含用户名/会话内容，源码 remote 为私有企业仓库且无许可证
- 最省力方式：选择：A 全部允许公开；B 截图先脱敏、源码不公开；C 原件和源码都仅本地保留，GitHub 只发布分析、Token 和公开网页证据
- 收到后：确定 Git 发布范围并关闭 GAP-006/TODO-005 权利部分
- 本轮进展：用户明确要求把登录小人实现放入 wufan 供其他系统参考；SRC-054/055 无个人数据，组件由公开生产 bundle SRC-013 恢复。该小人范围可发布，其他私有源码和含个人信息原图仍待整体确认。
- 对话进展：用户进一步明确要求完整对话页面（含左侧对话列表、中间消息区）提供明/暗代码例子给其他系统复刻。已按该授权发布派生的脱敏参考代码和本地 actual；没有发布 SRC-002/003 原图、真实会话内容或私有业务源码。整体原件/私有源码授权仍 open。
