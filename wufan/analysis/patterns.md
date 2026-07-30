# 页面与组合模式

## 1. Product 应用壳层

不变量：

- 暖白/近黑 canvas；
- 12px 外边距和面板 gap；
- 240px Sidebar；
- 56px Chat Header；
- 800px Composer / 当前生产 960px MessageList（旧本地源码为 880px）；
- 可选 Main Stage 与常驻 Chat 的双舞台关系；
- 低对比 surface、极淡 border、中等圆角。

业务可变量：导航项、任务名称、主舞台类型和内容。

## 2. 新任务页

Sidebar + Chat Header + 中央 Empty State + Composer + 建议胶囊。适用于没有历史消息的 Agent 工作入口。高饱和 Agent 形象是唯一视觉焦点，不能用普通空状态图标替代。`SRC-002`

## 3. 对话详情页

Sidebar 选中任务 + Header 上下文 + 居中 MessageList + bottom Composer。消息按角色左右区分，正文/Markdown优先，操作仅 hover 出现。`SRC-003–004`

可直接消费 `examples/reference/chat-page/`：React 页面和零构建 demo 已覆盖上述完整主路径，
并通过 light/dark desktop 与 source-derived mobile 本地运行检查。过程轨迹、反馈、右侧面板
和执行结果通知也已有独立组件；upload、plan review 等长尾状态仍未完整覆盖。
`EVD-007/008/009`

## 4. 主舞台工作模式

当文件、Dashboard、执行链、自动化等打开时，布局为 Sidebar + Main Stage + Chat；Main Stage flex 1.5、Chat flex 1。需要沉浸时 Main Stage 全屏并隐藏 Chat。新业务的“分析画布/编辑器/报表”应映射此模式，而不是另造全屏结构。

对话头部的工作区/执行链/自动化入口为互斥状态；再点当前入口关闭。当前归档实现使用桌面
50% 同舞台面板和 300ms 宽度收起，移动端 fixed inset8。右面板 open/close 是客户端 UI 状态，
不调用后端；工作室文件分别由 Wufan 共享/会话文件接口提供，executions/automations
按各自业务接口提供。`EVD-009/010`

## 5. 一轮 Agent 执行

顺序为：

```text
过程摘要 note → 0..n tool → 下一 note → 最终 response
```

运行时强制展开并显示 shine/spinner，结束后可折叠；工具状态覆盖等待、运行、完成、失败、取消、
超时。最终回答与 trace 独立。`note` 只能是允许对用户展示的摘要。`EVD-008`

## 6. 消息反馈

Wufan 原生是点赞/点踩乐观更新，点踩打开 360px 内联文本反馈面板；历史消息由自己的
`feedback` 字段回填，写入/撤销使用 PUT/DELETE。用户指定的复刻版在点踩时改用 300px
固定原因/自由文本浮层，再把 `reasons/comment` 适配到 Wufan 的 `categories/content`。
点赞和点踩互斥，已选动作再次点击撤销；普通消息不展示原因 chip。脱机演示才使用
message-scoped localStorage。`SRC-058/060, EVD-009`

## 7. 执行结果通知

执行完成/异常通过右上角 340px transient notice 告知，5s 自动关闭，hover 暂停。查看详情按
reference 路由到会话执行链或自动化面板。这不是消息内 trace，也不是右侧执行链本体。`EVD-009`

## 8. 登录/认证

Desktop 使用“品牌叙事左区 + 人格图形 + 表单右卡”；mobile 只保留表单。新业务如果复用悟帆风格，业务 Logo/文案可换，但布局比例、主题、角色图形语言、字体和表单组件应保持。

## 9. 更新中心

当前生产使用 tabbed information center + filter + feature hero + chronological feed。不能按源码 commit 中旧 560px modal 实现；应以 `SRC-013/SRC-014` 为准并补采 dark/完整 viewport。

## 10. Marketing

官网是独立品牌叙事模板：72px nav、双栏 Hero、Fraunces 大标题、抽象动画、白色 pill CTA、长滚动叙事。可用于营销/发布页面，不适用于 Product 工作台。

## 11. 业务映射原则

- 新业务聊天/Agent 页 → Product 壳层；
- 结构化分析/编辑 → Main Stage；
- 产品发布/品牌官网 → Marketing；
- 通知/更新 → 当前线上更新中心；
- 业务字段、文案、模块数量可变；视觉值和同语义组件不可变。
