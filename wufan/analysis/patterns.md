# 页面与组合模式

## 1. Product 应用壳层

不变量：

- 暖白/近黑 canvas；
- 12px 外边距和面板 gap；
- 240px Sidebar；
- 56px Chat Header；
- 800px Composer / 880px MessageList；
- 可选 Main Stage 与常驻 Chat 的双舞台关系；
- 低对比 surface、极淡 border、中等圆角。

业务可变量：导航项、任务名称、主舞台类型和内容。

## 2. 新任务页

Sidebar + Chat Header + 中央 Empty State + Composer + 建议胶囊。适用于没有历史消息的 Agent 工作入口。高饱和 Agent 形象是唯一视觉焦点，不能用普通空状态图标替代。`SRC-002`

## 3. 对话详情页

Sidebar 选中任务 + Header 上下文 + 居中 MessageList + bottom Composer。消息按角色左右区分，正文/Markdown优先，操作仅 hover 出现。`SRC-003–004`

## 4. 主舞台工作模式

当文件、Dashboard、执行链、自动化等打开时，布局为 Sidebar + Main Stage + Chat；Main Stage flex 1.5、Chat flex 1。需要沉浸时 Main Stage 全屏并隐藏 Chat。新业务的“分析画布/编辑器/报表”应映射此模式，而不是另造全屏结构。

## 5. 登录/认证

Desktop 使用“品牌叙事左区 + 人格图形 + 表单右卡”；mobile 只保留表单。新业务如果复用悟帆风格，业务 Logo/文案可换，但布局比例、主题、角色图形语言、字体和表单组件应保持。

## 6. 更新中心

当前生产使用 tabbed information center + filter + feature hero + chronological feed。不能按源码 commit 中旧 560px modal 实现；应以 `SRC-013/SRC-014` 为准并补采 dark/完整 viewport。

## 7. Marketing

官网是独立品牌叙事模板：72px nav、双栏 Hero、Fraunces 大标题、抽象动画、白色 pill CTA、长滚动叙事。可用于营销/发布页面，不适用于 Product 工作台。

## 8. 业务映射原则

- 新业务聊天/Agent 页 → Product 壳层；
- 结构化分析/编辑 → Main Stage；
- 产品发布/品牌官网 → Marketing；
- 通知/更新 → 当前线上更新中心；
- 业务字段、文案、模块数量可变；视觉值和同语义组件不可变。
