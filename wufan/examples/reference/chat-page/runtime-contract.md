# 对话过程轨迹：后端理论数据契约

## 目标

前端需要稳定重建一轮 Agent 执行中的可展示过程：

```text
完成/运行摘要
└─ 可展示的过程正文 note
   ├─ tool call
   ├─ tool call
   └─ 下一条过程正文 note
      └─ tool call
最终回答 response
```

这里的 `note` 是产品允许展示给用户的简短过程说明，不是模型的私有思维链。后端不得把
隐藏推理、系统提示、凭据、工具原始参数或完整原始结果透传给浏览器。

## 历史快照

会话历史接口应返回已归一化的消息快照。字段名使用 snake_case；前端 adapter 再映射为
`types.ts` 的 camelCase 类型。

```json
{
  "id": "msg_assistant_01",
  "role": "assistant",
  "author": "小悟",
  "created_at": "2026-07-30T10:24:00.000Z",
  "trace": {
    "id": "trace_01",
    "status": "completed",
    "started_at": "2026-07-30T10:24:00.000Z",
    "completed_at": "2026-07-30T10:32:41.000Z",
    "duration_ms": 521000,
    "steps": [
      {
        "type": "note",
        "id": "note_01",
        "seq": 10,
        "status": "completed",
        "text": "先读取客户洞察技能完成前置约束，同时锁定三个主体。",
        "segment_id": "segment_01"
      },
      {
        "type": "tool",
        "id": "call_01",
        "seq": 11,
        "status": "completed",
        "tool_name": "read",
        "display_name": "读取文件",
        "summary": "阅读 \"skills/customer-insight/SKILL.md\"",
        "icon": "read",
        "duration_ms": 126
      }
    ],
    "sources": [
      {
        "id": "source_01",
        "title": "企业基本信息",
        "url": "https://example.com/source/1",
        "domain": "example.com"
      }
    ]
  },
  "response": {
    "format": "markdown",
    "content": "已经完成分析，结论如下……"
  }
}
```

### 必需语义

| 字段 | 规则 |
|---|---|
| `trace.status` | `pending \| running \| completed \| failed \| cancelled \| timeout` |
| `steps[].seq` | 同一 trace 内严格单调递增；决定正文与工具的视觉顺序 |
| `note.text` | 已脱敏、可公开展示的过程摘要；允许后续以同一 `id` 覆盖 |
| `tool.summary` | 面向用户的动作描述；不能由前端直接格式化原始 arguments |
| `tool.status` | `pending \| running \| streaming \| completed \| failed \| cancelled \| timeout` |
| `duration_ms` | 非负整数；整体耗时来自 execution，工具耗时来自单次调用 |
| `sources` | 最终来源列表；顶部数字由数组长度计算，不单独信任计数字段 |
| `response` | 最终回答，与 trace 独立；trace 折叠不影响最终回答展示 |

`initialExpanded` 是前端 demo 状态，不属于后端契约。完成态默认折叠；运行态强制展开。

## 流式事件

推荐 SSE 或 WebSocket 使用统一 envelope：

```json
{
  "schema_version": "wufan.chat.runtime.v1",
  "event_id": "evt_0001",
  "session_id": "session_01",
  "message_id": "msg_assistant_01",
  "execution_id": "exec_01",
  "seq": 1,
  "occurred_at": "2026-07-30T10:24:00.000Z",
  "event_type": "execution.started",
  "payload": {}
}
```

前端需要处理的最小事件集合：

| `event_type` | payload | 前端行为 |
|---|---|---|
| `execution.started` | `{started_at}` | 建立 running trace，强制展开 |
| `trace.note.upsert` | `{id, step_seq, status, text, segment_id?}` | 按 id 幂等新增/覆盖正文节点 |
| `tool.call.started` | `{id, step_seq, tool_name, display_name, summary, icon?}` | 在最近的 note 下新增 spinner 行 |
| `tool.call.updated` | `{id, status, summary?}` | 更新 streaming 文案或状态 |
| `tool.call.completed` | `{id, status, summary, duration_ms}` | 停止 spinner，切换完成/失败图标 |
| `sources.reported` | `{sources}` | 更新顶部来源入口 |
| `response.delta` | `{delta}` | 追加最终回答，不写进 note |
| `response.completed` | `{content, format}` | 用服务端最终文本校正 response |
| `execution.completed` | `{status, completed_at, duration_ms}` | 结束运行态；默认收起 trace |

完整顺序例子见 `runtime-events.example.json`。

## 合并与恢复规则

1. `event_id` 用于跨重连去重，`seq` 用于同一 execution 排序。
2. 相同实体 `id` 的事件必须按新 `seq` 覆盖旧状态；重复事件不能生成重复行。
3. 工具归属于它前面最近的 note；没有 note 的直接工具调用显示为根级工具行。
4. 重连先拉历史快照，再从 `last_event_seq + 1` 续流。
5. `execution.completed` 到达时，所有仍为 running 的工具必须由后端给出最终状态；前端只在
   断线恢复兜底时把遗留 running 标为 failed/cancelled。
6. `response.delta` 与 `trace.note.upsert` 是两个通道。最终回答不能因工具启动而迁移或丢失。
7. 时间使用 ISO 8601 UTC；展示耗时使用服务端 `duration_ms`，不依赖客户端本地时钟。

归档里的状态 fixture 覆盖 `pending / running / completed / failed / cancelled / timeout`，
入口为 `trace-state-fixtures.ts`。静态 `demo.html` 右下角也可逐一切换，不再只有完成态。

## 安全与内容边界

- `tool_name` 可以是稳定机器名；`display_name`、`summary` 必须是服务端生成的安全展示值。
- 浏览器契约不包含 `arguments`、`authorization`、Cookie、内部 URL、原始异常栈或工具原始返回。
- 如果产品需要详情面板，另设经过字段白名单的 `safe_details`，不要复用执行层 payload。
- `note.text` 必须来自专门的可展示摘要通道；不得把 provider 的 raw reasoning 字段映射到这里。
- `sources.url` 进入前端前应完成协议白名单与权限检查。

## 前端映射

| 后端 | React 类型 |
|---|---|
| `trace.steps[].type = "note"` | `WufanProcessNoteStep.kind = "note"` |
| `trace.steps[].type = "tool"` | `WufanToolCallStep.kind = "tool"` |
| `step_seq` / `seq` | `seq` |
| `tool_name` | `toolName` |
| `display_name` | `displayName` |
| `duration_ms` | `durationMs` |
| `segment_id` | `segmentId` |

契约的机器校验入口是 `runtime-contract.schema.json`。
