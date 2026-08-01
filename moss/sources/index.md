# 来源索引

共同上下文：用户提供本地 Moss V2 源码 `/Users/anner/fine/ai/dev`；commit `195a663d2323af7c668a1db9e0a1be442a2c2b49`；采集于 2026-08-01；授权 `provided`；全部原样复制并以 `sources/source-code/SHA256SUMS` 校验。

| ID | 原始来源 | 本地路径 | 主题/状态 | 用途 |
|---|---|---|---|---|
| SRC-001 | `frontend/src/styles/globals.css` | `source-code/styles/globals.css` | light+dark/shared | 主题、Token、动效 |
| SRC-002 | `ThemeProvider.tsx` | `source-code/common/ThemeProvider.tsx` | shared/fixed-light | 主题运行策略 |
| SRC-003 | `ReasoningTraceSection.tsx` | `source-code/Chat/ReasoningTraceSection.tsx` | running+completed | 思维链生命周期与折叠 |
| SRC-004 | `ActionFeed.tsx` | `source-code/Chat/ActionFeed/ActionFeed.tsx` | running+completed | 时间线结构与过程节点 |
| SRC-005 | `ActionItem.tsx` | `source-code/Chat/ActionFeed/ActionItem.tsx` | 全工具状态 | 工具动作、图标、排版 |
| SRC-006 | `ToolDisplayCard.tsx` | `source-code/Chat/ActionFeed/ToolDisplayCard.tsx` | loading+completed | 特殊工具卡片 |
| SRC-007 | `AssistantMessageFrame.tsx` | `source-code/Chat/AssistantMessageFrame.tsx` | default | assistant header |
| SRC-008 | `AssistantResponseBody.tsx` | `source-code/Chat/AssistantResponseBody.tsx` | streaming+complete+empty | 正文 surface |
| SRC-009 | `MessageList.tsx` | `source-code/Chat/MessageList.tsx` | scrolling+streaming | 内容列与滚动 |
| SRC-010 | `InputBar.tsx` | `source-code/Chat/InputBar.tsx` | default+active+running+upload | Composer |
| SRC-011 | `MarkdownContent.tsx` | `source-code/Chat/MarkdownContent.tsx` | default | Markdown 排版 |
| SRC-012 | `tailwind.config.js` | `source-code/tailwind.config.js` | shared | 尺度与遗留色板 |
| SRC-013 | `frontend/index.html` | `source-code/index.html` | shared | locale、字体入口 |
| SRC-014 | `google-fonts.css` | `source-code/fonts/google-fonts.css` | shared | 字体声明 |

## 授权与限制

设计参数可作为用户要求的内部档案使用。Moss 品牌标识及字体二进制不因本档案自动获得再分发授权；字体文件未复制。没有归档凭据、个人数据或环境变量。
