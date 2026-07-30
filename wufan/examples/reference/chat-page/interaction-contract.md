# 对话反馈、工作室、右侧面板与执行通知：前后端契约

本文件说明 `WufanMessageActions`、`WufanWorkspaceStudio`、
`WufanRightPanel` 与 `WufanExecutionNotices` 所需的数据边界。Wufan 的真实源码位于
`/Users/anner/fine/ai/corevo`；其中已存在的 API 路径按源码记录。固定原因选择器是用户要求从
另一套系统复刻的交互增强，前端通过适配层写入 Wufan 已有的 `categories/content` 字段。

打开面板、切换标签、展开浮层、最大化和进出场动画都是前端状态，不应为这些动作单独请求后端。

## 1. 点赞 / 点踩

### 1.1 前端交互

- 点赞立即进入乐观选中；再次点击撤销。
- 点踩第一次打开锚定浮层，不立即提交。
- 增强原因固定为：`数据不准 / 反应过慢 / 分析不深 / 废话冗长 / 答非所问`。
- 原因可多选，也可只填自由文本；两者都为空时“确定”禁用。
- 点踩提交后只保留点踩选中态；点赞、点踩互斥。
- 普通会话中不公开回显原因。原因进入管理端的“反馈闭环”列表和统计。
- 浮层宽 `300px`、距按钮 `8px`、视口安全边距 `8px`；下方放不下时翻到上方。
  `Escape`、点击外部和“取消”都关闭，resize/scroll 时重新定位。

Wufan 源码本身还有一个 `360px` 的内联文本反馈面板，标题为“这条哪里不对？”。本参考默认采用
用户指定的固定原因增强版；后端契约兼容两者。

### 1.2 Wufan 已有写入接口

有 Agent ID 时：

```http
PUT /api/agents/{agent_id}/sessions/{session_id}/messages/{message_id}/feedback
Content-Type: application/json
```

只有会话 ID 的兼容路径：

```http
PUT /api/agents/sessions/{session_id}/messages/{message_id}/feedback
Content-Type: application/json
```

点赞：

```json
{
  "sentiment": "positive",
  "content": "",
  "categories": []
}
```

点踩：

```json
{
  "sentiment": "negative",
  "content": "主体信息的更新时间不一致",
  "categories": ["数据不准", "分析不深"]
}
```

推荐返回与 Wufan 源码类型一致：

```json
{
  "id": "feedback_01",
  "sentiment": "negative",
  "content": "主体信息的更新时间不一致",
  "categories": ["数据不准", "分析不深"]
}
```

参考组件的 UI 模型通过适配器转换：

| UI 字段 | Wufan API 字段 |
|---|---|
| `choice: "thumbs_up"` | `sentiment: "positive"` |
| `choice: "thumbs_down"` | `sentiment: "negative"` |
| `reasons` | `categories` |
| `comment` | `content` |

### 1.3 撤销与历史回显

```http
DELETE /api/agents/{agent_id}/sessions/{session_id}/messages/{message_id}/feedback
DELETE /api/agents/sessions/{session_id}/messages/{message_id}/feedback
```

成功返回 `204 No Content`。服务端应以当前用户、会话和消息为唯一反馈目标；`PUT` 是覆盖，
不是累计多条当前反馈。

正式消息快照建议直接返回 Wufan 已有字段：

```json
{
  "feedback": {
    "sentiment": "negative",
    "content": "主体信息的更新时间不一致",
    "categories": ["数据不准", "分析不深"]
  }
}
```

只允许返回当前登录用户自己的反馈。聚合统计、他人反馈和管理备注不得混入普通会话响应。

校验要求：

- `sentiment` 仅允许 `positive | negative`；
- `positive` 应忽略 `content/categories`；
- `categories` 去重并按租户配置白名单校验；
- `content` trim 后建议最多 500 个 Unicode 字符；
- 服务端再次执行隐私、内容安全和消息归属校验。

## 2. 顶部入口与互斥右侧面板

前端状态：

```ts
type RightPanelType = 'none' | 'workspace' | 'execution' | 'automation';
```

点击已打开入口会关闭；点击另一入口会在同一右侧区域切换。桌面面板进入布局流并压缩聊天区；
移动端占据视口。工作室桌面可最大化，最大化时聊天区隐藏或被覆盖。

面板聚合响应可按产品后端拆成独立接口，最小形态为：

```json
{
  "execution": {
    "selected_execution_id": "exec_01",
    "items": [
      {
        "id": "exec_01",
        "task": "分析三家汽车企业并给出合作优先级建议",
        "status": "completed",
        "iterations": 3,
        "tool_calls": 4,
        "prompt_tokens": 18640,
        "completion_tokens": 4236,
        "started_at": "2026-07-30T10:24:00.000Z",
        "completed_at": "2026-07-30T10:32:41.000Z"
      }
    ]
  },
  "automation": {
    "items": [
      {
        "id": "pipeline_01",
        "display_name": "每周客户洞察摘要",
        "schedule_label": "每周一 09:00",
        "status": "active",
        "last_run_status": "completed"
      }
    ]
  }
}
```

执行实时变化复用 `runtime-contract.md` 中的 execution/tool 事件，不建立第二套冲突状态流。

## 3. Wufan“工作室”与文件预览

### 3.1 真实前端状态机

`WufanWorkspaceStudio` 对应 Wufan 源码的
`Workspace → FileCanvas → FilePreview`：

1. `canvas` 是常驻标签，不能关闭；工作室标题为“工作室”。
2. 画布分别请求共享文件和当前会话文件，支持搜索、上传、打开文件、拖拽/引用及右键文件管理。
3. 文件标签按 `file_id`，再按 `path + level + session_id` 去重；没有 session ID 时允许
   `path + level` 兜底。普通文件标签最多 8 个，超限关闭最早标签。
4. 标签切换时暂停隐藏页中的 video/audio。画布始终挂载但可隐藏；其他非活动文件预览卸载。
5. 文件 Header 支持 HTML 渲染、编辑/保存/取消、下载、新窗口和分享。
6. HTML 渲染尺寸为 `375×667 / 768×1024 / 1280×800`，iframe sandbox 为
   `allow-scripts allow-same-origin`。
7. 文本请求超时为 15 秒；加载超过 5 秒显示慢提示。404 时可在 `session` 与
   `agent-shared` 之间回退一次；失败显示错误和重试次数。
8. 类型分流为图片、PDF、Excel、PPT/PPTX、DOC→PDF、视频、音频、CSV、Markdown、
   JSON、HTML、普通文本和 unsupported。

`level` 的真实枚举：

```ts
type FileLevel = 'agent-config' | 'agent-shared' | 'session';
```

### 3.2 文件列表

共享文件：

```http
GET /api/agents/{agent_id}/files
```

会话文件：

```http
GET /api/agents/{agent_id}/sessions/{session_id}/files
```

Wufan 源码消费的响应：

```json
{
  "path": "",
  "files": [
    {
      "id": "file_01",
      "name": "客户洞察分析.md",
      "path": "客户洞察分析.md",
      "is_dir": false,
      "size": 18432,
      "modified_at": "2026-07-30T10:32:41.000Z",
      "mime_type": "text/markdown",
      "location": "session"
    }
  ]
}
```

前端归一化进入标签时补充 `level`；服务端不得返回宿主机绝对路径、对象存储凭据或内部地址。

### 3.3 内容、编辑、下载和转换

```http
GET /api/agents/{agent_id}/files/{encoded_path}
GET /api/agents/{agent_id}/sessions/{session_id}/files/{encoded_path}

PUT /api/agents/{agent_id}/files/{encoded_path}
PUT /api/agents/{agent_id}/sessions/{session_id}/files/{encoded_path}
Content-Type: application/json

{ "content": "..." }
```

DOC/DOCX 预览在内容 URL 追加 `?format=pdf`。缩略图追加 `?thumb=true`。下载沿用同一个受鉴权
内容端点，由前端的下载工具触发 `Content-Disposition` 行为。

路径必须逐段 URL encode；后端解码后重新校验并拒绝 `..`、绝对路径、软链接逃逸和跨租户访问。
PDF/音视频应支持 `Range`。HTML 只能在 sandbox iframe 中渲染；同目录 CSS 的每个请求也必须
重新鉴权。

上传：

```http
POST /api/files/upload
Content-Type: multipart/form-data

file=<binary>
session_id={session_id}
target=shared
agent_id={agent_id}
```

Wufan 前端限制单文件 50 MB；服务端必须独立执行大小、扩展名、MIME、病毒和配额校验。

分享：

```http
POST /api/agents/{agent_id}/file-share/{encoded_path}
Content-Type: application/json

{ "session_id": "session_01" }
```

```json
{
  "token": "share_token",
  "url": "/share/files/share_token",
  "file_name": "客户洞察分析.md",
  "expires_at": "2026-07-31T10:32:41.000Z"
}
```

分享按钮状态为 `idle → loading → copied → idle`，复制成功后 2.5 秒复位；失败回到 `idle`。

## 4. “执行完成 / 执行异常 / 查看详情”

`WufanExecutionNotices` 提取自 Wufan `AutomationToast`：

- 固定在 `top: 60px; right: 24px`，宽 `340px`；
- 进入：`translateX(40px) scale(.96)` 到原位；
- 离开：`translateX(20px) scale(.97)`；
- 动画 `300ms cubic-bezier(.34, 1.2, .64, 1)`；
- 5 秒自动关闭；hover 暂停，移出后重新计时；
- 点击先标记已读，再按 reference 打开详情，最后执行离场。

推荐 SSE/WebSocket 事件：

```json
{
  "event_type": "notification.created",
  "payload": {
    "id": "notice_01",
    "type": "automation_failed",
    "title": "竞品变更提醒",
    "summary": "企业信息服务暂时不可用，任务未能完成全部检索。",
    "reference_type": "automation_pipeline",
    "reference_id": "pipeline_01",
    "is_read": false,
    "created_at": "2026-07-30T10:33:00.000Z"
  }
}
```

| `type` | UI |
|---|---|
| `automation_completed` | `执行完成` |
| `automation_failed` | `执行异常` |
| `automation_run` 或未知更新 | `执行状态更新` |

建议同时提供：

```http
PATCH /api/notifications/{notification_id}
Content-Type: application/json

{ "is_read": true }
```

通知点击后的详情跳转由 `reference_type + reference_id` 决定，不能从标题文本猜测目标。
