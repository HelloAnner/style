# 组件规范

## 思维链 / 工作过程（最高优先级）

### Anatomy

1. 运行标题：`正在思考...` 或 `正在处理中...`。
2. 过程说明节点：状态 icon slot + 经过 Markdown 清理的自然语言预览。
3. 连接线：把过程节点与其工具动作、下一过程节点连接。
4. 工具动作：产品图标 + 动作短句 + 可选耗时/进度。
5. 子智能体附件：锚定对应工具 action，保持同一时间线。
6. 完成折叠：`已完成，耗时8s` / 失败 / 超时 / 取消 + chevron；可并列信息来源。

### 精确几何

| 项 | 值 |
|---|---|
| ActionFeed 最大高 | `528px` |
| 过程行最小高 | `30px` |
| 过程 icon slot | `16×30px` |
| 过程 icon | completed/failed `14px`；running `15px` |
| 过程文字 | `14px / 22px / 400`，上下 `4px` |
| 过程行 gap | `8px` |
| 工具行 | min-height `30px`，gap `7px` |
| 工具 icon slot | `14×30px` |
| 工具文字 | `13px / 20px / 400`，top `5px` |
| 工具耗时 | `11px / 20px`，tabular nums |
| 连接线 | left `7.5px`，top `29.5px`，width `1.25px` |
| 工具组缩进 | margin-left `7.5px` + padding-left `15.5px` |
| 思考预览上限 | 96 Unicode code points，优先完整句 |
| 完成 toggle | height `34px`，14/22/500，gap `4px` |

`Observed · exact-source · high · shared · SRC-003, SRC-004, SRC-005`

### 状态语法

- 最新且运行：自动展开、禁止用户折叠；标题按是否已有 action/正文切换思考/处理；内容变化贴底。
- 过程节点：关联 action pending/running/streaming 时 spinner；已闭合为实心圆勾；failed 为圆警告。
- 完成：自动折叠；用户可展开。折叠 60s 后卸载 DOM；LRU 最多保留 3 个展开 feed。
- 完成文案：`已完成`、`已完成，耗时Xs`、`任务执行失败/超时`、`任务已取消`。
- 无 thinking 但有直接工具：显示 `调用工具进行深度洞察...`。

### 内容规则

过程说明去 Markdown 装饰后显示。折叠预览优先在 96 字符内按 `。！？!?；;` 截完整句；无完整句才硬截；“更多”13px disabled color。工具文案必须是用户可理解动作，不直接展示原始参数/结果。

### Do / Don't

- Do：过程说明 14px > 工具 13px > 耗时 11px。
- Do：工具紧贴其触发过程节点并保留竖线。
- Don't：每一步套卡片、用彩虹状态色、显示原始 JSON、让 spinner 替换所有完成 icon。

## Assistant frame

24px agent mark；header gap 8px、margin-bottom 6px、min-height 24px；名称 14/22/600 primary；相对时间 12/20 muted。正文槽满宽。

`Observed · exact-source · high · SRC-007`

## Assistant response body

正文出现时 margin-top 8px；surface secondary；1px subtle border；radius 8px；padding `16px 18px`，生成中为 `16px 18px 34px`；正文 14/22 secondary。生成状态位于 right 14 / bottom 10，11/16、opacity .72，6px 呼吸点。

`Observed · exact-source · high · SRC-008, SRC-001`

## User message

右对齐，最大宽 82%；普通文字 `12px 16px`、radius 6px、背景 bubble.user；附件/特殊展示可移除外壳。与 assistant 使用同一 14px 主体尺度。

## Composer

非 compact 外层对齐内容列；min-height 116px；radius 16px；0.5px sender border；文本 14/22，输入区 min 60/max 160；发送按钮 34px/radius17，空态中性，内容态 `#DE6A43`；底部 11/16/500 免责声明。

`Observed · exact-source · high · SRC-010`

## Chat session header

48px 高；active session padding inline16；标题14/22/400；操作32×32/radius8/gap8。收藏紧跟标题，右侧为分享/divider/看板/自动化/文件。滚动后 surface 180ms 出现。完整规则见 [conversation-workspace.md](conversation-workspace.md)。

`Observed · exact-source · high · SRC-018`

## Sidebar / session list

260px 展开、48px 折叠；内容 item 36px、margin inline12、radius8。Active 仅中性 surface + 500 weight；unread 8px danger dot；generating 13px spinner。完整规则见 [sidebar.md](sidebar.md)。

`Observed · exact-source · high · SRC-022..029, SRC-036..038`

## Workspace drawer / file cards

Right panel 50%、min480、外 inset8。Drawer radius6/0.5px border；两行 toolbar；grid card min180、preview120；list row44。完整规则见 [file-workspace.md](file-workspace.md)。

`Observed · exact-source · high · SRC-030..035, SRC-039`
