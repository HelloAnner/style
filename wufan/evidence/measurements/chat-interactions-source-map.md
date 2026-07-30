# EVD-009：反馈、右侧面板与执行结果通知源码映射

## 目标

补齐对话页三个可复用交互簇：

1. 点赞 / 点踩互斥状态，以及点踩原因锚定浮层；
2. 顶部工作区 / 执行链 / 自动化入口及互斥右侧面板；
3. “执行完成 / 执行异常 / 查看详情”的执行结果通知。

同时让归档过程轨迹示例可见切换
`pending / running / completed / failed / cancelled / timeout`，不再只有完成态。

## 来源与版本

- 用户指定跨系统参考：`SRC-058`，`/Users/anner/fine/ai/dev`（独立
  `corevo-platform` 仓库，并非 Wufan 源码）commit
  `9b0765cfbd47533bdd326d42140b29309d29a5eb`；
- Wufan 原生校正来源：`SRC-060`，`/Users/anner/fine/ai/corevo` commit
  `14394dc7ca16aa13c62e8a089c6ffff4953424f3`；
- 早期执行链面板结构：已登记的 `SRC-004`，`/Users/anner/fine/ai/corevo` commit
  `14394dc7ca16aa13c62e8a089c6ffff4953424f3`；
- 当前线上右侧面板宽度/类型校验：`SRC-013`。

只读分析文件与 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `MessageActions.tsx` | `f12603270597cbc0b5dc1d751f1ab25816101b0d9ba837d2b86c1552092ad9b5` |
| `DislikeModal.tsx` | `fe453f5bdf4e820db85a1625ec80bb1fb140dd70381a48c6f38302666011340e` |
| `useMessageFeedbackState.ts` | `1d6be82813ea3a95d0cef38762aa5d128c0096b86e1d90f105d45f49e00f88dc` |
| `api/feedback.ts` | `d059c1654f7abee48f9691dabedb3755e2e619b4f87c87b63cac5c56318ec492` |
| `ChatSessionHeader.tsx` | `fe19f9cbb22bec2f706a77c12148c6629d0d5bf329dcf016a10ff2ddfd4df4c0` |
| `App.tsx` | `bbea1bc5496c3a7e4ba694e9d60f03d95978485e9c828bca732bd38a4753101d` |
| `AutomationToast.tsx` | `a993bfb0a7920fab3615c75a1868bf70852dc9c887ba417d0095f27ab64ba004` |
| legacy `ChatContainer.tsx` | `436e785bb5560f66ebacb356ca2b8c46709280791213f90578610617a93fc3cf` |
| legacy `App.tsx` | `ffa0bae2ee3b303edafacea9cf8cc096e59c46f1d14ead7b36b950facf4c1375` |
| legacy `ExecutionChain.tsx` | `5848706225d06866eb0792df31bc1e31422efadfa64a7ddbde3012ef06aada89` |

Wufan 原生校正文件：

| 文件 | SHA-256 |
|---|---|
| `web/src/components/Chat/AgentMessage.tsx` | `3613879401cb85a7ad91850714f8d05d721a6868912408df4936c258597a09d3` |
| `web/src/lib/messageFeedbackTarget.ts` | `8de12d4d853c821c41cbf38b488017c55e947a20609400cc0e5187adce8dacce` |
| `web/src/api/platform.ts` | `c32830473b06601154e18fadc1dc75dc77eb70d4c15cf02edefdb0a828ab05ed` |
| `web/src/components/Automation/AutomationToast.tsx` | `5d4f8488e7f34b731a582103fad3096f450ef84af332eb3ab8dd0ea5cb9595db` |
| `web/src/App.tsx` | `ffa0bae2ee3b303edafacea9cf8cc096e59c46f1d14ead7b36b950facf4c1375` |

私有源码未复制进档案；档案保存参数、行为、哈希、重写的通用实现与脱敏 mock。

## 点赞 / 点踩

Wufan 原生 `AgentMessage` 使用 26×26/r6 的点赞/点踩按钮；点踩打开同一 action flow 内宽
`360px` 的文本面板，标题“这条哪里不对？”，没有固定原因 chip。接口使用
`PUT/DELETE /api/agents/.../feedback`，payload 为 `sentiment/content/categories`，失败会回滚
乐观状态。

用户要求复刻的固定原因选择器来自 SRC-058；归档保留它作为可插入 Wufan 的增强交互，并将
`reasons/comment` 映射为 Wufan 的 `categories/content`。以下几何只描述这一跨系统增强版：

| 语义 | 复刻规则 |
|---|---|
| action button | 24×24，r4，图标 14，hover background 150ms |
| action row | margin-top12，padding 6px 0，gap8，min-height24 |
| liked | 实心 up，隐藏 down；再次点击撤销 |
| disliked | 实心 down，隐藏 up；再次点击撤销 |
| 初次 down | 读取按钮 DOMRect 后打开原因浮层，不立即 POST |
| 浮层 | width300，gap8，viewport padding8，estimated height218，fixed z1300，p12，r8 |
| 原因 | 5 项，flex-wrap，gap 8×16，item min-width80，checkbox14/r2 |
| 文本 | 72px，p7×8，r6，14/22，maxLength500 |
| 按钮 | h32，min-width56，r6；原因和文本都空时提交禁用 |

浮层在下方不足时翻到按钮上方，水平位置夹在 8px 安全边距内；支持 Escape、点外部、
resize 和 capture scroll。归档接入 Wufan 语义后使用乐观本地状态，API 失败回滚到提交前状态。

`Observed · exact-source within cross-system enhanced-picker scope · high · SRC-058`；
Wufan 原生 API/回滚语义由 `SRC-060` 校正。

## 顶部入口与右侧面板

- legacy header 的会话级入口顺序：工作区、执行链、分享、分隔线、自动化；
- 按钮 32×32/r8/gap4；workspace active emerald、execution active amber、
  automation active violet；
- 同一入口再次点击关闭，另一入口点击时互斥切换；
- 当前源码 workspace/automation/board 使用统一 50% 固定比例与最小宽度；关闭时先把宽度
  动画到 0，再延迟约 300ms 卸载旧内容；
- 右侧抽屉内容有 8px inset，shell r16；移动端 workspace 来源行为是 fixed inset/fullscreen。

本档案保留用户明确要求的 `workspace / execution / automation` 三类入口。跨系统新源码已把
execution 从同一 header 集合中移除，因此执行链内容结构使用 SRC-004，容器与收起动效使用
SRC-013/058；这是一项有来源的跨版本组合，不声称是某个单一生产 commit 的完整截图。

`Observed · exact-source cross-version composition · medium-high · SRC-004/013/058`

## “执行完成 / 执行异常 / 查看详情”

这组交互实际来自 `AutomationToast.tsx`，不是过程轨迹正文，也不是旧版
`ExecutionChain.tsx` 面板。本档案以语义名 `WufanExecutionNotices` 单独提取：

| 参数 | 值 |
|---|---|
| region | fixed top60 right24，vertical gap8，z9999 |
| card | width340，p16×18，r14，1px subtle border |
| shadow | `0 8px 40px rgba(0,0,0,.3)`（dark source fallback） |
| enter | `translateX(40px) scale(.96)` |
| leave | `translateX(20px) scale(.97)` |
| transition | 300ms cubic-bezier(.34,1.2,.64,1) |
| timer | 5000ms；hover 暂停，mouseleave 重启 |
| status | completed → 执行完成；failed → 执行异常；其他 → 执行状态更新 |
| click | mark read → session 新页或 automation panel focus → dismiss |

`Observed · exact-source · high · SRC-058/060`

## 归档实现

- `WufanMessageFeedback.tsx`
- `WufanRightPanel.tsx`
- `WufanExecutionNotice.tsx`
- `trace-state-fixtures.ts`
- `interaction-contract.md`
- `interaction-contract.schema.json`
- `interaction-api.example.json`
- `demo.html` 右下角状态实验条

浏览器 actual：

- `examples/validation/chat-page/process-trace__light__1594x974__running-panel-execution.png`
- `examples/validation/chat-page/feedback__light__1594x974__dislike-popover.png`
- `examples/validation/chat-page/execution-notice__light__1594x974__failed.png`

## 准确范围

- 固定原因反馈和执行结果通知为跨系统 exact-source 重新实现；Wufan 原生反馈 API、
  回滚语义和 AutomationToast 由 SRC-060 校正；
- 右侧面板壳层与切换为 exact-source 跨版本组合，面板业务内容是脱敏结构样例；
- dark 使用同一组件的来源 Token，仍缺同状态用户原图；
- mobile 行为已本地运行验证，但仍缺登录后真实产品 baseline；
- 普通用户侧不展示已提交原因文本，只展示选中图标；原因展示属于管理/分析端范围。
