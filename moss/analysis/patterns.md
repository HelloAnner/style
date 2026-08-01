# 页面与交互模式

## 对话回合

顺序固定：用户消息 → assistant header → 运行中的工作过程 → assistant 正文/widget → 错误详情 → 反馈/追问。工作过程不是正文卡片内部的一段，也不是独立侧栏。

`Observed · exact-source · high · SRC-003, SRC-007, SRC-008, SRC-009`

## 工作过程的信息层级

- Level 1：人类可读过程说明，解释“现在为什么做”。
- Level 2：缩进工具动作，解释“具体做了什么”。
- Level 3：必要时附写入进度、子智能体卡片或特殊工具卡片。
- 输出完成后把过程压缩为一行状态；用户需要审计时再展开。

该模式的辨识度来自“默认低噪声 + 按需透明”，不是始终展示完整日志。

## 流式阶段

1. 无 action/正文：`正在思考...`。
2. action 或正文出现：`正在处理中...`。
3. thinking/process note 与 tool call 按 event sequence 交错。
4. 正文出现后工作过程仍可继续，但独立于正文 surface。
5. terminal：状态 toggle 替代运行标题并自动折叠。

## 长内容

- 工作过程上限 528px，内部滚动；用户手动上滚后停止自动贴底。
- 正文 Markdown 允许表格横向滚动、代码块独立 surface。
- 消息列表流式增长时仅在用户仍贴底时跟随。

## 完整工作台组合

桌面组合固定为“导航 rail/side panel + chat + optional inset drawer”。侧栏 active session、header title 和会话内容必须指向同一会话；右侧“我的文件”是与 chat 同组的 50% 面板，不是 modal。打开文件区时保留 chat，并压缩到剩余宽度；右 panel 最大化才降低 chat opacity。

`Observed · exact-source · high · SRC-015, SRC-016, SRC-022, SRC-030`

## 文件引用闭环

侧栏/会话 header 的“我的文件”打开 drawer；默认有 session 时显示“当前会话”，否则“全部文件”。File card 的引用动作回流到 composer；未共享的全局文件先确认共享。该流程的视觉入口、scope tabs、引用状态和 composer token 应使用同一套 link/accent semantics。

## 新业务映射

任何“后台步骤、工具执行、检索、数据处理、子任务”都先映射到过程说明 + action row。只有结果需要持续阅读或交互时才使用正文卡片/特殊工具卡片。不要为业务字段新建另一套时间线视觉。
