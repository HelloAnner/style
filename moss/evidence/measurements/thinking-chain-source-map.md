# 思维链源码证据映射

| 规则 | 源文件/定位 | 证据 | 精确性 |
|---|---|---|---|
| 运行自动展开、完成自动收起 | `ReasoningTraceSection.tsx` state/effects | SRC-003 | exact-source |
| 完成 toggle 34px、14/22/500 | `CompletedReasoningToggle` | SRC-003 | exact-source |
| 历史 DOM 60s 释放、LRU=3 | constants + toggle | SRC-003 | exact-source |
| 最大高 528px | `ActionFeed.MAX_HEIGHT` | SRC-004 | exact-source |
| 过程行 30px、icon slot 16px、文字 14/22 | `ThinkingActionCard` | SRC-004 | exact-source |
| 预览 96 code points、按句截断 | preview helpers | SRC-004 | exact-source |
| 连接线 left 7.5/top 29.5/width 1.25 | `PROCESS_TRACE_CONNECTOR_STYLE` | SRC-004 | exact-source |
| 工具缩进 7.5 + 15.5px | `PROCESS_TRACE_ACTIONS_STYLE` | SRC-004 | exact-source |
| 工具行 13/20、slot 14px、gap 7px | `ActionItem.renderRow` | SRC-005 | exact-source |
| 自定义产品图标路径 | `timelineIconPaths` | SRC-005 | exact-source |
| spinner/扫光与 reduced-motion | globals CSS lines ~1740–1863 | SRC-001 | exact-source |
| light/dark text/border/surface | theme blocks | SRC-001 | exact-source |

派生可视化：`EVD-001..004`。它们验证本档案参考实现，不替代来源产品截图。
