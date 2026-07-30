# 悟帆 AI 双主题对话工作区

这是给其他系统直接参考的、可运行的悟帆对话页面代码示例。范围覆盖用户指定的完整主路径：

```text
应用壳层
├─ 左侧 Sidebar：品牌、主导航、任务分组、对话列表、用户区
└─ 中央 Chat
   ├─ Chat Header：Agent、任务标题、上下文动作
   ├─ Message List：用户/Agent、Markdown 层级、消息工具
   │  ├─ Process Trace：轮次正文、工具调用、来源、状态与耗时
   │  └─ Feedback：点赞/点踩互斥、撤销、点踩原因浮层
   └─ Composer：附件、思考、模型、发送
右侧互斥面板：工作室（文件画布、多标签与预览）/ 执行链 / 自动化
右上执行通知：执行完成 / 执行异常 / 查看详情
```

## 文件

- `WufanChatPage.tsx`：可直接复制到 React 项目的完整页面组件；
- `WufanReasoningTrace.tsx`：过程轨迹组件，覆盖完成/运行/失败、正文节点、工具节点与折叠；
- `trace-state-fixtures.ts`：等待/运行/成功/失败/取消/超时六种可直接渲染 fixture；
- `WufanMessageFeedback.tsx`：消息 action row、点赞/点踩和点踩原因浮层；
- `WufanRightPanel.tsx`：工作区、执行链、自动化三类互斥右侧面板；
- `WufanWorkspaceFiles.tsx`：真实 Wufan“工作室”、常驻文件画布、多标签与文件预览状态机；
- `WufanExecutionNotice.tsx`：“执行完成/执行异常/查看详情”通知；
- `wufan-chat.css`：明色和暗色两套独立语义值、组件几何及响应式；
- `types.ts`：页面、会话和消息类型；
- `mock-data.tsx`：完全脱敏的对话和任务示例；
- `runtime-contract.md`：后端快照与流式事件的理论数据契约；
- `runtime-contract.schema.json`：上述契约的 JSON Schema；
- `runtime-events.example.json`：一轮“正文 → 工具 → 正文”的完整事件例子；
- `interaction-contract.md`：反馈、右面板和执行通知的接口/事件契约；
- `interaction-contract.schema.json`：上述交互数据的 JSON Schema；
- `interaction-api.example.json`：反馈、面板和通知的脱敏完整样例；
- `spec.json`：供其他 Agent 读取的机器规格与证据状态；
- `demo.html`：不需要安装依赖的浏览器演示，包含主题切换、移动端 Sidebar 和发送消息交互；
- `index.ts`：公开导出入口。

## 证据与准确范围

当前线上生产包 `SRC-012/013` 晚于本地
`/Users/anner/fine/ai/corevo` 的 `14394dc`。因此本示例采用以下顺序：

1. 当前生产 bundle：Logo、Sidebar 当前导航、960px MessageList、Composer 和主题值；
2. 用户 light 对话原图 `SRC-003`：桌面 populated chat 的视觉关系；
3. 用户 dark 新任务原图 `SRC-002`：暗色应用壳层、Sidebar、Header 和 Composer；
4. 本地源码 `SRC-004`：组件解剖、消息结构、`<768px` drawer 行为和交互语义。
5. 用户新增过程轨迹原图 `SRC-056` 与用户指定跨系统参考源码 `SRC-057`：完成态摘要、来源入口、
   根正文节点、缩进工具节点、连接线、图标、运行态和折叠交互。
6. 用户指定跨系统参考源码 `SRC-058`：固定原因点踩浮层、右侧面板和执行结果通知。
7. Wufan 源码 `SRC-059`（`/Users/anner/fine/ai/corevo`）：工作室入口、文件画布、
   多标签、文件预览、编辑/渲染和文件 API。
8. Wufan 源码 `SRC-060`：原生消息反馈按钮、360px 文本反馈面板、PUT/DELETE 反馈 API、
   乐观更新失败回滚，以及 Wufan 自己的 `AutomationToast`。

逐项映射见 `../../../evidence/measurements/chat-page-source-map.md`、
`../../../evidence/measurements/process-trace-source-map.md` 和
`../../../evidence/measurements/chat-interactions-source-map.md`、
`../../../evidence/measurements/file-preview-source-map.md`。

本示例可以称为
`exact-source reference, pass within runnable chat-page scope`，不能称为整个悟帆系统已经
`complete`。原因是目前仍缺：

- 同一 populated 对话页面的 dark 原图；
- 登录后 Product 的 mobile 原图；
- 当前生产部署对应的完整未压缩源码；
- 上传、流式输出、错误、问卷、Plan review 等全部状态的视觉配对。

Dark populated 和 mobile 在本示例中是“当前主题 Token + 当前/本地源码行为的确定性组合”，不是已有截图的像素级 baseline。

## React 使用

组件依赖 `react` 与 `react-dom`（点踩浮层使用 portal）；图标是内联 SVG，不要求 Lucide：

```tsx
import React, { useState } from 'react';
import {
  WufanChatPage,
  type WufanTheme,
} from './wufan-chat-page';

export function App() {
  const [theme, setTheme] = useState<WufanTheme>('light');

  return (
    <WufanChatPage
      theme={theme}
      onThemeChange={setTheme}
      onSend={(value) => {
        // 接入你自己的消息 API。
        console.log(value);
      }}
      onSourcesClick={(messageId, sources) => {
        // 打开你自己的来源抽屉。
        console.log(messageId, sources);
      }}
      onSubmitFeedback={async (feedback) => {
        const sentiment =
          feedback.choice === 'thumbs_up' ? 'positive' : 'negative';
        await fetch(
          `/api/agents/${agentId}/sessions/${feedback.sessionId}/messages/${feedback.messageId}/feedback`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sentiment,
              categories: feedback.reasons ?? [],
              content: feedback.comment ?? '',
            }),
          },
        );
      }}
      onRevokeFeedback={async (sessionId, messageId) => {
        await fetch(
          `/api/agents/${agentId}/sessions/${sessionId}/messages/${messageId}/feedback`,
          { method: 'DELETE' },
        );
      }}
    />
  );
}
```

若使用自己的数据，替换 `sessionGroups` 和 `initialMessages`。业务文案可以变化，但同语义组件不要改写 CSS 值。

过程轨迹挂在 Agent 消息的 `trace` 字段。`steps` 必须按单调递增的 `seq` 排序，
正文节点用 `kind: "note"`，工具节点用 `kind: "tool"`。工具会归入它前面最近的正文节点：

```tsx
const message: WufanMessage = {
  id: 'assistant-1',
  role: 'agent',
  author: '小悟',
  time: '10:24',
  trace: {
    id: 'trace-1',
    status: 'completed',
    durationMs: 521000,
    steps: [
      {
        id: 'note-1',
        kind: 'note',
        seq: 10,
        status: 'completed',
        content: '先读取约束，同时锁定三个主体。',
      },
      {
        id: 'tool-1',
        kind: 'tool',
        seq: 11,
        status: 'completed',
        toolName: 'read',
        displayName: '读取文件',
        summary: '阅读 "skills/customer-insight/SKILL.md"',
        icon: 'read',
      },
    ],
  },
  content: <p>这里是最终回答。</p>,
};
```

`note.content` 是允许展示给用户的过程摘要，不是模型私有推理。工具节点只接收脱敏后的
`summary`，不在生产 UI 返回或展示原始参数、凭据和完整工具结果。完整字段、事件顺序和
幂等规则见 `runtime-contract.md`。

状态不能只写进类型而不做实际渲染。可直接引用：

```tsx
import { traceStateFixtures, WufanReasoningTrace } from './wufan-chat-page';

<WufanReasoningTrace trace={traceStateFixtures.running} />
<WufanReasoningTrace trace={traceStateFixtures.failed} />
```

工具链完整状态是 `pending / running / completed / failed / cancelled / timeout`。
静态 demo 右下角也可以逐项切换。

## 反馈展示规则

- 点赞立即提交；点踩先开 300px 原因浮层，至少选择一个原因或填写评论后才能提交；
- 原因固定为“数据不准、反应过慢、分析不深、废话冗长、答非所问”；
- 提交后用户侧只显示实心图标，并隐藏相反动作；再次点击撤销；
- 已选原因不在普通消息下回显。后端/管理端如何接收和展示见 `interaction-contract.md`。

## 右侧面板与执行通知

Header 的工作室、执行链、自动化入口互斥；再次点击当前入口关闭。桌面面板进入布局流并压缩
对话区，移动端使用 `8px` inset 抽屉。关闭时保留旧内容 300ms，让宽度动画完成后再卸载。

“工作室”不是静态列表壳层。`WufanWorkspaceStudio` 同步了常驻 canvas、共享/会话文件分组、
搜索、上传回调、文件多标签、fileId/path/level/sessionId 去重、8 标签上限、加载与慢加载、
失败重试、编辑、HTML 渲染、下载、新窗口、分享和最大化。
预览按图片、PDF/DOC、Excel、PPT、音视频、CSV、Markdown、JSON、HTML、文本和 unsupported
分流。正式接入示例：

```tsx
<WufanChatPage
  theme={theme}
  workspaceFiles={{
    files,
    onLoadPreview: async (file, signal) => {
      const base = `/api/agents/${agentId}`;
      const encodedPath = file.path.split('/').map(encodeURIComponent).join('/');
      const fileUrl = file.level === 'session'
        ? `${base}/sessions/${file.sessionId}/files/${encodedPath}`
        : `${base}/files/${encodedPath}`;
      const response = await fetch(
        fileUrl,
        { signal }
      );
      if (!response.ok) throw new Error('加载失败');
      return {
        kind: file.previewKind ?? 'text',
        content: await response.text(),
      };
    },
    onDownload: (file) => {
      // 用项目现有 downloadFile 封装下载同一受鉴权文件 URL。
      downloadWorkspaceFile(file);
    },
  }}
/>
```

二进制类型通常只返回受鉴权 `inlineUrl`，文本类型返回 `content`。正式接口、Range、转换、
AbortSignal、逻辑相对路径和 iframe sandbox 约束见 `interaction-contract.md`。

`WufanExecutionNotices` 是从参考 `AutomationToast` 提取的真实
“执行完成 / 执行异常 / 查看详情”组件：340px 卡片、5s 自动关闭、hover 暂停、
300ms spring-like 进出场。点击 `session` 通知应进入会话/执行链；点击
`automation_pipeline` 通知应打开自动化面板并聚焦任务。

## 零构建演示

直接打开 `demo.html`，或使用静态服务器：

```bash
python3 -m http.server 4174
```

访问：

- `demo.html?theme=light`
- `demo.html?theme=dark`
- `demo.html?theme=light&trace=running&panel=execution&toast=failed`
- `demo.html?theme=light&panel=workspace&file=file-insight`
- `demo.html?theme=dark&panel=workspace&file=file-priority`

输入文字后按 Enter 或点击发送按钮，可以验证 active send 的主题反向规则。浏览器缩到
`390×844` 后，通过左上角按钮验证 Sidebar drawer。点击“已完成”可展开/收起过程轨迹，
点击“更多”可展开长正文节点。
右下角归档实验条可切换六种工具链状态、重放执行完成/异常通知；顶部三个入口可验证右侧面板；
点踩可验证原因、自由文本、提交禁用与互斥状态。打开“工作室”后可搜索共享/会话文件，
点文件打开新标签、切换/关闭标签、编辑、渲染 HTML、下载/分享并最大化工作室。

## 双主题规则

主题挂在页面根节点：

```html
<main class="wufan-chat-page" data-theme="light"></main>
<main class="wufan-chat-page" data-theme="dark"></main>
```

不要用滤镜或算法反色。关键映射：

| Semantic | Light | Dark |
|---|---|---|
| canvas | `#FAF9F7` | `#0A0A0F` |
| sidebar | `#FFFFFF` | `rgba(18,18,24,.5)` |
| input | `#FAFAFA` | `#27272A` |
| user bubble | `#F0EFED` | `#1A1A20` |
| agent bubble | `#FFFFFF` | `#16161C` |
| send active | `#18181B / #FFFFFF` | `#FFFFFF / #18181B` |

完整产品变量仍以 `../../../system/themes/light.tokens.json` 和
`../../../system/themes/dark.tokens.json` 为准。

## 集成约束

- 保留 12px 应用 inset/gap、240px Sidebar 和 56px Header；
- 保留 MessageList 当前生产值 `max-width: 960px`、Composer `max-width: 800px`；
- 消息头像 32px、gap 12、bubble padding 14/radius 16、正文 14/1.6；
- 轨迹摘要 14/22/500；正文节点 14/22；工具节点 13/20；
- 根节点图标槽 16×30，工具图标槽 14×30，节点 gap 8，工具 gap 7；
- 工具组 `margin-left: 7.5px; padding-left: 15.5px`，连接线 1.25px；
- 运行文案 shine 1.4s linear，tapered spinner 1s linear，新正文节点 180ms ease-out；
- 反馈 action 24×24/r4；点踩浮层 300px/p12/r8；textarea 72px；按钮 32px；
- 右面板正常宽度为同舞台约 50%，关闭宽度动画 300ms；
- 工作室 Header 56px；标签 36px、gap4；画布文件格 160px、gap16；普通文件最多 8 标签；
  loading 超过 5s 显示慢加载提示；
- 执行通知 340px/p16×18/r14，5s timer，300ms cubic-bezier(.34,1.2,.64,1)；
- Sidebar 的 mobile drawer 源码阈值为 `<768px`；
- 中文字体最终回退仍依赖目标系统，不能未经授权随包嵌入归档字体；
- 示例没有复制私有业务 store、API、会话内容、用户名或用户截图；
- `prefers-reduced-motion: reduce` 下关闭 shine、spinner 与节点迁移动画；
- 文件、看板、子智能体卡片等专用工具结果仍需继续补采，不在本轮通用轨迹范围内。

## 验证

实际渲染截图和运行时指标保存在
`../../validation/chat-page/`。验收说明会区分：

- source/runtime 参数检查；
- 本地代码功能检查；
- 有原图的 light desktop 视觉核对；
- 无同页原图的 dark/mobile 限制。
