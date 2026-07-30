# EVD-010：Wufan 右侧“工作室”与文件预览源码映射

- Evidence ID：`EVD-010`
- Source：`SRC-059`
- 主题：light / dark 共用组件结构，颜色分别来自主题 Product Token
- Wufan 源码：`/Users/anner/fine/ai/corevo`
- 参考 commit：`14394dc7ca16aa13c62e8a089c6ffff4953424f3`
- 采集方式：用户授权后的只读源码分析
- 结论类型：Observed

## 源文件与哈希

| 文件 | SHA-256 | 用途 |
|---|---|---|
| `web/src/components/Workspace/Workspace.tsx` | `19ccd3d5b7311958e96d8924e300c9adde812867bcf3260be6fc9bb97c400fb1` | 工作室壳层、标签、文件操作、编辑与 HTML 渲染 |
| `web/src/components/Workspace/FilePreview.tsx` | `7db960bee7df8ab858c93eed6dca098d5aaa7bfa3556d8b3a5ecb3d8bb224814` | 加载/错误/重试、类型分流和预览渲染器 |
| `web/src/components/Workspace/FileCanvas.tsx` | `bc7e2e7a2f17fbe0d37f4b185755b09540a1fc0ed921225bed82bc0ae5b4017a` | 常驻文件画布、共享/会话文件、搜索、上传和文件管理 |
| `web/src/stores/workspaceStore.ts` | `1af6732b9ab13f62441fafe096c1ad540c1e7d3b0f24d5d3631b0662854572ab` | 标签、去重、上限、关闭和会话清理 |
| `web/src/api/platform.ts` | `c32830473b06601154e18fadc1dc75dc77eb70d4c15cf02edefdb0a828ab05ed` | 文件分享和消息反馈 API |
| `web/src/App.tsx` | `ffa0bae2ee3b303edafacea9cf8cc096e59c46f1d14ead7b36b950facf4c1375` | 桌面/移动端右侧面板布局与最大化 |

归档没有复制上述私有源码，只记录可验证哈希、行为、API 边界和重新实现的通用组件。

## 入口与容器

1. Chat Header 的画架图标切换工作室；激活态使用 emerald 色。
2. 工作室组件自己渲染标题“工作室”、文件标签数量、桌面最大化和关闭按钮。
3. 壳层 `radius 16px`，玻璃背景、细边框、panel shadow。
4. 桌面非展开模式进入主布局，面板最小宽度 `480px`；移动端固定占满主视口。
5. 桌面展开后工作室覆盖主舞台，聊天面板隐藏；移动端不显示最大化按钮。

## 标签与画布状态机

```text
工作室
  ├─ canvas（常驻，不可关闭）
  │   ├─ GET 共享文件
  │   ├─ GET 当前会话文件
  │   ├─ 搜索 / 上传 / 拖拽引用 / 右键管理
  │   └─ click file → openFile
  └─ file tab（最多 8 个）
      ├─ loading
      │   ├─ >5s → 慢加载提示
      │   ├─ 404 → session ↔ agent-shared fallback
      │   ├─ error → retry(n)
      │   └─ ready
      ├─ preview
      ├─ edit → save / cancel
      └─ html render → mobile / tablet / desktop
```

`openFile` 去重顺序：

1. `fileId`；
2. `path + level + sessionId`；
3. 没有 sessionId 时 `path + level`。

普通 file tab 最多 8 个；canvas、folder、browser-live 不计入上限。超限移除最早普通文件标签。
切换标签时暂停被隐藏标签中的 video/audio。canvas 始终挂载但可隐藏，其他非活动标签卸载。

## 文件画布

- 工具栏 `padding 12px 20px`，含标题、`120px` 搜索框与 `30×30` 上传按钮。
- 内容 `padding 20px`；共享文件、会话文件独立分组。
- 分组标题 `12px / 600 / uppercase / 0.05em`，计数徽标 `10px`。
- 文件栅格为 `repeat(auto-fill, 160px)`，gap `16px`；文件预览格 `160×160`。
- 共享文件请求 `/api/agents/{agentId}/files`，会话文件请求
  `/api/agents/{agentId}/sessions/{sessionId}/files`，可见页面每 30 秒刷新；
  页面 hidden 时停止轮询，重新可见时立即刷新。
- 上传使用 `/api/files/upload`，字段为 file/session_id/target/agent_id；前端限制 50 MB。

## 标签与 Header 精确值

| 元素 | 来源值 |
|---|---|
| 工作室 Header | height `56px`, padding-x `16px` |
| 工作室图标 | `18px` |
| 标签栏 | padding `8px 12px 0`, gap `4px` |
| 标签 | height `36px`, padding `0 12px`, gap `8px` |
| 激活标签 radius | `12px 12px 0 0` |
| 非激活标签 radius | `12px` |
| 文件名最大宽度 | `120px`, `13px` |
| 标签关闭目标 | `18×18`, radius `4px`, hover 才显示 |
| 文件 Header | padding `12px 16px`, gap `8px` |
| 文件名 | `14px / 500` |
| 文件操作 | height `32px`, padding `0 12px`, gap `6px`, radius `8px` |
| 移动端关闭目标 | `36×36`, glyph `20px` |

## 文件预览

- 文本请求 timeout `15s`；主 `agents.md` 请求最多重试 2 次。
- 加载超过 `5000ms` 显示慢加载与网络提示。
- 404 可在 session 与 agent-shared 之间 fallback；媒体也保留 fallback URL。
- HTML 同名 CSS 请求 timeout `5s`、重试 1 次；CSS 缺失不阻止 HTML 预览。
- 图片、PDF、Excel、PPT/PPTX、DOC→PDF、视频、音频、CSV、Markdown、JSON、HTML、文本和
  unsupported 分别渲染。
- DOC/DOCX 使用 `format=pdf`；缩略图使用 `thumb=true`。
- HTML 工作室渲染 iframe sandbox 为 `allow-scripts allow-same-origin`。
- HTML 渲染尺寸：mobile `375×667`、tablet `768×1024`、desktop `1280×800`。
- unsupported 显示文件名、不可预览说明和下载按钮。

## 文件操作和后端边界

- 共享内容：`/api/agents/{agentId}/files/{encodedPath}`。
- 会话内容：`/api/agents/{agentId}/sessions/{sessionId}/files/{encodedPath}`。
- 编辑保存对同一 URL 发 `PUT {"content": nextContent}`。
- 分享：`POST /api/agents/{agentId}/file-share/{encodedPath}`，body
  `{"session_id": string|null}`；复制成功显示“已复制”，2.5 秒复位。
- Markdown“新窗口”优先创建分享 URL，失败后回退受鉴权原始 URL。
- 所有逻辑路径必须逐段 encode 并在服务端重新做沙箱和租户权限校验。

## 参考实现映射

- `WufanWorkspaceFiles.tsx`：实际导出 `WufanWorkspaceStudio`；画布、标签、去重、8 标签上限、
  loading/error、预览、编辑、HTML 渲染、下载/分享/新窗口。
- `WufanRightPanel.tsx`：工作室不再套重复 Header；执行链与自动化继续复用普通右面板。
- `types.ts`：`agent-config / agent-shared / session`、文件 metadata、preview payload 和回调。
- `interaction-contract.md`：Wufan 已有 API 路径、响应结构和安全要求。
- `demo.html`：零构建验证 canvas → loading → file tab → edit/render，以及关闭标签/最大化。

## 限制

- 本轮没有取得同一工作室状态的用户原始 light/dark 截图；颜色与外层几何来自 Wufan Product
  Token 和源码，结论为 source-derived，不是像素截图 baseline。
- Excel、PPTX、PDF 的生产渲染依赖专用库。归档组件用确定性 fixture 保留视觉与状态入口，
  接入业务时必须复用项目现有解析器。
- folder、browser-live、富文本 Markdown 编辑器和右键删除/重命名未复制进当前最小聊天示例；
  它们已在状态与 API 文档中记录，若成为目标页面关键流须单独实现和验收。
