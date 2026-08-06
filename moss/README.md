# Moss 前端全量设计档案

## 一句话风格定义

温暖米白/近黑画布上的低噪声 AI 工作台：260px 中性会话侧栏、900px 对话列、可审计思维链与 50% inset 文件抽屉，共同形成紧凑、可操作的桌面协作界面。

## 状态与完成率

- 版本：`0.4.0`
- 状态：`reusable`（带明确缺口可复用，不等于完整）
- 完成率：`19/25 = 76.0%`
- 深入范围：主题、App shell、展开/折叠侧栏、Agent/会话列表、会话 header、消息与思维链、composer、空会话首页、右侧“我的文件”抽屉、grid/list/batch/search/loading、右侧智能看板；共享组件层、superadmin/tenant admin 控制台、auth/onboarding/share/showcase/settings、Agent/Automation/Skills/Tools Studio、圆桌/图谱——前端非测试源码已全量归档。
- Blocker：真实产品 dark 运行态、来源产品登录态截图/计算样式、移动端、字体许可、完整交互状态视觉回归。

## 最重要的入口

- [完整对话工作台](analysis/conversation-workspace.md)
- [左侧导航与会话列表](analysis/sidebar.md)
- [右侧文件工作区](analysis/file-workspace.md)
- [思维链与组件](analysis/components.md)
- [右侧智能看板](analysis/boards.md)
- [共享组件层与 Token 家族](analysis/common-components.md)
- [管理控制台](analysis/admin-console.md)
- [认证/公开/外围页面](analysis/auth-public-pages.md)
- [Studio 与功能模块](analysis/studio-modules.md)
- [Style Guide](system/style-guide.md)
- [实现指南](system/implementation.md)
- [聚合 Token](system/tokens.json)
- [可运行组件参考](examples/reference/conversation-workspace/index.html)

## 主题入口

- Light：[规则](analysis/themes/light.md) · [展开 Token](system/themes/light.tokens.json) · [CSS](system/themes/light.css)
- Dark：[规则](analysis/themes/dark.md) · [展开 Token](system/themes/dark.tokens.json) · [CSS](system/themes/dark.css)
- 来源 `ThemeProvider` 当前强制 light；dark 是 exact-source 设计值，但未在来源产品运行态验证。

## 视觉指纹

1. Light canvas `#FAF9F7`，sidebar `#F2F1ED`；dark canvas `#0A0A0F`，sidebar/drawer `#18181B`。
2. Sidebar 展开/折叠 `260/48px`；item 统一36px、左右12px、radius8。
3. Chat min400；消息列 max900、左右/顶部24、回合间24。
4. Active header 48px；utility action 32×32、radius8、gap8。
5. 思维链无外卡片：14px 过程节点、13px 工具动作、1.25px 连接线。
6. Assistant 正文 8px radius、`16px 18px`、1px subtle border。
7. Composer min116、radius16、发送34px；橙 `#DE6A43` 只承担发送/品牌动作。
8. Right panel 占 group 50%、min480，外 inset8；drawer radius6、0.5px border。
9. 文件 grid card min180、preview120；list row44；颜色集中在原始文件图标。

## Do / Don't

- Do：严格保持 sidebar → chat → inset drawer 的层级与比例。
- Do：当前会话仅用中性 active surface；“新会话”才使用橙色。
- Do：保持思维链“过程说明 + 连接线 + 缩进工具动作”。
- Don't：把文件区做成全贴边 split pane、大圆角卡片墙或彩色 dashboard。
- Don't：把 dark 当 light 反色，或把参考截图冒充来源产品 baseline。

## 来源与证据

- [65 个来源登记项](sources/index.md)
- [源码与59个产品图标快照](sources/source-code/README.md)
- [工作台源码映射](evidence/measurements/conversation-workspace-source-map.md)
- [探索日志](sources/exploration-log.md)
- [参考截图](examples/validation/)

## 缺口

见 [TODO](quality/TODO.md)、[请求](quality/REQUESTS.md)、[gaps](quality/gaps.md) 与 [完成报告](quality/completion-report.md)。当前能深度复用完整桌面对话工作台的源码精确规则，但不能保证来源产品运行像素级完全一致。
