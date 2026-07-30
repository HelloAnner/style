# EVD-008：对话过程轨迹源码映射

## 目标

把用户给出的已完成过程轨迹原图与其授权参考源码交叉映射为可直接消费的双主题组件，覆盖：

- 顶部“完成状态 + 总耗时 + 信息来源”；
- 每轮可展示正文；
- 归属于正文轮次的工具调用；
- 完成/运行/失败状态；
- 展开、收起、“更多”、spinner、shine 与 reduced motion；
- 历史快照和流式事件的理论数据结构。

## 来源与版本

- 原图：`SRC-056`，2072×620 physical component crop，light，expanded/completed；
- 用户指定跨系统参考源码：`SRC-057`，`/Users/anner/fine/ai/dev`（独立
  `corevo-platform` 仓库，并非 Wufan 源码）commit
  `9b0765cfbd47533bdd326d42140b29309d29a5eb`；
- 只读分析文件与 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `ReasoningTraceSection.tsx` | `00e5849c64f5f36aa89a7902190d5edde4e3f92dd58f55f1f85cfc0afadd2367` |
| `ActionFeed.tsx` | `d25d7b8bb176f926e2660b91d8d64dc631a40143aa70290a4944b664be263614` |
| `ActionItem.tsx` | `02026a6554c5a0537c705a303276b653a72d4cfb31de7ead7cdec5a7aa76331d` |
| `globals.css` | `62bf5156d2fdd0723d0e27b0869061b2298b51a3b50b4f87dba64df2bfa49d73` |
| `viewTypes.ts` | `8bee794b1226c501f9c8121ebdb9a1064e4516d566eaeb56faef15bd4340d176` |
| `runtimeEvent.ts` | `2e3c4aad47a6d0f0f92b05ff831f07150a2c994854f9e750331358bbfe2f8a9c` |

私有源码未复制进档案；档案只保存来源定位、文件哈希、可观察参数和重新实现的通用组件。

## 组件映射

| 参考组件 | 复刻组件 | 精确规则 |
|---|---|---|
| `CompletedReasoningToggle` | `.wufan-trace-summary` | h34、gap8、14/22、weight500 |
| source button | `.wufan-trace-summary__sources` | h22、px4、14/22、accent |
| `ThinkingActionCard` | `.wufan-trace-note` | min-h30、gap8、正文 14/22 |
| `ProcessNoteIconSlot` | `.wufan-trace-note__icon` | 16×30，内部 14/16 SVG |
| `PROCESS_TRACE_CONNECTOR_STYLE` | `.wufan-trace-group__connector` | left7.5、top29.5、width1.25 |
| `PROCESS_TRACE_ACTIONS_STYLE` | `.wufan-trace-tools.is-nested` | ml7.5、mt1、pl15.5 |
| `ActionItem` row | `.wufan-trace-tool` | min-h30、gap7、13/20 |
| `TimelineIconSlot` | `.wufan-trace-tool__icon` | 14×30，图标保持原始尺寸 |

`Observed · exact-source + screenshot · high · SRC-056/057`

## 图标与状态

- 正文完成：14×14 实心圆/勾，外层 16×30；
- 正文运行：15px tapered spinner；
- 工具读取：12.5×14 原始路径；
- 工具搜索：13.1413×13.0021 原始路径；
- 工具绘制/写入：12.6922×12.9905 原始路径；
- 失败：14×14 warning 原始路径；
- 工具 running/pending/streaming 使用 spinner，不用静态搜索图标。

`Observed · exact-source · high · SRC-057`

## 排版、颜色与双主题

- 完成摘要：`text-muted`；
- 正文：`text-secondary`；
- 工具：completed `text-tertiary`，running `text-muted`；
- “更多”：`text-disabled`；
- 来源：light `#2563EB`，dark `#3B82F6`；
- 连接线：light `#E4E4E7`，dark `rgba(255,255,255,.08)`；
- light/dark 文字值沿用 Product 完整主题映射，不做反色。

Light 有 SRC-056 原图；dark 是同一来源组件的 exact-source 主题 Token 映射，尚无同状态原图。

## 动效

- 新过程正文：`height 0 / opacity 0 / translateY(12px)` →
  `auto / 1 / 0`，180ms ease-out；
- 运行文案：180% background-position shine，1.4s linear infinite；
- tapered spinner：1s linear infinite；
- chevron：150ms transform；
- `prefers-reduced-motion: reduce` 关闭正文迁移、shine 与 spinner。

`Observed · exact-source · high · SRC-057`

## 数据与内容边界

参考源码最终依赖有序的过程正文、工具调用、来源和 execution 状态。本档案把它规范为
`WufanReasoningTrace.steps` 的有序 union：

- `kind: "note"`：面向用户的过程摘要；
- `kind: "tool"`：脱敏后的工具动作；
- `seq`：决定视觉顺序与归组；
- `status`：驱动图标和动画；
- `response`：最终回答，独立于 trace。

后端理论快照、事件 envelope、幂等与恢复规则见
`examples/reference/chat-page/runtime-contract.md`。`note` 不是 provider raw reasoning；
浏览器不接收工具原始参数、凭据或完整返回。

## 准确范围

### 已可精确实现

- light expanded completed 截图所示结构；
- 来源数量入口、总耗时、正文/工具层级；
- 图标几何、排版、连接线和展开交互；
- 源码定义的 running/failed/cancelled/timeout 状态；
- light/dark Token 映射和 reduced motion；
- 可运行 React 与零构建 demo。

### 仍未验证

- dark expanded completed 同状态原图；
- 真实线上 streaming 时序录屏；
- 来源 drawer；
- 文件、Widget、子智能体、Todo 等专用卡片；
- 登录后 mobile 真实产品 baseline。

因此本组件结论是
`exact-source reference, exact within validated light generic-trace scope`，不关闭整个
TODO-006/007/012，也不提升档案为 `complete`。
