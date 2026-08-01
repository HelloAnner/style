# 布局与响应式

## 工作台

- 展开/收起侧栏：`260px / 48px`，`200ms easeInOut`。
- Chat 最小宽 `400px`；右面板正常态固定容器 50%，最小 `480px`。
- 右面板开合宽度动画 `300ms`；最大化时 chat 降到 `.35` opacity。

`Observed · exact-source · high · desktop · SRC-015`

## 消息列

- 滚动容器：横向 padding `24px`，顶部 `24px`，底部 `32px`。
- 内容列：`max-width: 900px`，居中，消息间隔 `24px`。
- 新用户消息在已有滚动条时置顶并保留 `30px`；流式输出只在用户仍贴底时自动跟随。
- 下滑按钮：28px 圆形，距底 12px。

`Observed · exact-source · high · desktop · SRC-009`

## 思维链

宽度跟随 assistant body，最大高度 `528px`，超出内部滚动并隐藏滚动条。ActionFeed 右 padding 8px。连接线与 action attachment 均相对时间线缩进。

`Observed · exact-source · high · shared · SRC-004`

## 左右结构

展开/折叠侧栏为 260/48px。Chat 与 right panel 组成剩余宽度 group；Chat min400，right panel 50%、min480。文件/看板/自动化右 panel 外围统一 padding8，形成 inset drawer chrome。详见 [conversation-workspace.md](conversation-workspace.md)。

`Observed · exact-source · high · desktop · SRC-015`

## 侧栏与文件区

侧栏会话内容行统一36px、inline margin12。右文件网格最小卡宽180、gap1%、preview120；列表行44。详见 [sidebar.md](sidebar.md) 与 [file-workspace.md](file-workspace.md)。

## 响应式

来源 App 当前有 `MobileUnsupportedGuard`，且文档中声明的 responsive rules 文件缺失。空会话 Home 自身有 1200/760px media rules，但整页移动可达性仍未知；未发现思维链专用断点。档案参考页在 390px 隐藏工具耗时列，这是 `Recommended · recommended-extension`，不是 Moss 来源事实。真实移动行为未知并阻止 complete。
