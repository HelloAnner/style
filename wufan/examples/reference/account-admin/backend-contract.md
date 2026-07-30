# 账户设置与运营平台：后端契约

本契约区分三件事：前端打开/关闭 modal 是本地状态；账户和空间数据来自登录用户范围；
运营数据需要独立管理员权限。所有样例都必须脱敏。

## 1. 启动与权限能力

Wufan 当前 `GET /api/auth/me` 返回 `user` 与 `team`。为避免前端只用 plan 猜权限，推荐扩展：

```json
{
  "user": {
    "id": "user_demo_01",
    "email": "demo@example.com",
    "name": "午饭示例",
    "source": "password"
  },
  "team": {
    "id": "team_demo_01",
    "name": "午饭示例的空间",
    "plan": "developer",
    "is_personal": true
  },
  "capabilities": {
    "admin_platform": true,
    "manage_space": true,
    "manage_billing": true
  }
}
```

当前源码前端以 `team.plan === "developer"` 显示“运营平台”，而后端
`require_developer` 实际按 `ADMIN_USER_EMAILS` 白名单校验。建议由 `/api/auth/me`
返回 capability 并在 `/admin` 路由先 guard；`/api/admin/*` 仍必须独立鉴权。

错误语义：

- `401`：未登录或 token 无效；
- `403`：已登录但没有运营权限；
- `404`：资源不存在或不属于当前租户（不得泄露其他租户存在性）；
- `409`：成员/空间状态冲突；
- `422`：字段校验失败；
- `429`：管理查询或导出限流。

## 2. 账户与空间

| 用途 | 方法与路径 | 说明 |
|---|---|---|
| 当前用户/空间 | `GET /api/auth/me` | 用户、当前 team、capabilities |
| 修改个人资料 | `PATCH /api/auth/profile` | `display_name` 等 |
| 刷新 token | `POST /api/auth/refresh` | 返回新 token |
| 列出空间 | `GET /api/teams` | 当前用户已加入空间 |
| 创建空间 | `POST /api/teams` | `{name}` |
| 切换空间 | `POST /api/teams/{team_id}/switch` | 返回新 token + team |
| 空间详情/改名 | `GET/PATCH /api/teams/{team_id}` | owner/admin |
| 成员列表 | `GET /api/teams/{team_id}/members` | 当前空间成员 |
| 邀请成员 | `POST /api/teams/{team_id}/invite` | `{email,role}` |
| 移除成员 | `DELETE /api/teams/{team_id}/members/{user_id}` | owner/admin |
| 退出空间 | `POST /api/teams/{team_id}/leave` | 非最后 owner |
| 删除空间 | `DELETE /api/teams/{team_id}` | owner + 再确认 |
| 今日配额 | `GET /api/quota/status` | `quotas` + `resets_at` |
| BYOK 列表/创建 | `GET/POST /api/user-configs` | 密钥只返回 masked |
| 测试 BYOK | `POST /api/user-configs/test` | 不落库的连接检查 |
| 删除 BYOK | `DELETE /api/user-configs/{id}` | 当前用户自己的配置 |

主题与语言可作为前端 local preference；如需跨设备同步，建议增加
`GET/PUT /api/preferences`，不要与安全敏感账户字段混在一起。

## 3. 当前空间资产

资产页聚合多个业务域，至少包括：

```http
GET /api/teams/{team_id}/assets/{asset_type}
```

`asset_type` 为 `tools | skills | subagents`。自动化与卡片使用各自 API。每个返回项必须包含
稳定 `id/name/type/status`，详情按需懒加载；不得把工具 secret 返回给列表页。

## 4. 运营平台鉴权

所有 canonical admin 接口：

```http
Authorization: Bearer <JWT>
```

服务端执行：

1. 验证 token 与用户；
2. 验证 `admin_platform` 权限/管理员白名单；
3. 对自由文本筛选做长度与字符校验；
4. 对日志、消息、反馈中的内容执行最小化返回和审计；
5. 导出接口限流并记录操作者。

## 5. 运营接口

当前后端实际使用 `/teams`，但当前前端 `web/src/api/admin.ts` 的部分方法仍使用旧
`/tenants`。复刻时以下列已实现服务端路径为准，或在网关提供显式兼容别名：

| 标签 | canonical API |
|---|---|
| 消息日志 | `GET /api/admin/messages`、`GET /api/admin/messages/sessions` |
| 执行详情 | `GET /api/admin/executions/{execution_id}` |
| Token 用量 | `GET /api/admin/token-usage` |
| 性能监控 | `GET /api/admin/performance` |
| 反馈闭环 | `GET /api/admin/message-feedback` |
| MCP 接入 | `/api/admin/mcp-clients*`、`GET /api/admin/mcp-tools` |
| 问题排查 | `GET /api/admin/troubleshoot`、`GET /api/admin/errors` |
| 工具统计 | `GET /api/admin/metrics` |
| 用户活跃 | `GET /api/admin/user-activity`、`GET /api/admin/user-activity/charts` |
| 实时监控 | `GET /api/admin/realtime` |
| 系统 | `GET /api/admin/system` |
| 案例管理 | `/api/admin/showcase/cases*`、`/api/admin/showcase/collection` |
| 隐藏旧页面 | `GET /api/admin/dashboard`、`GET /api/admin/teams*` |

### Token 用量查询

```http
GET /api/admin/token-usage?start_time=...&end_time=...&user_email=...&agent_id=...&provider=...&model=...&source_type=...&page=1&page_size=50
```

响应包含 `items/summary/page/page_size/total`。正式导出建议使用异步导出任务和一次性下载 URL，
不要让 `export=true` 返回无限数据。

### 反馈闭环

```http
GET /api/admin/message-feedback?start_time=...&end_time=...&user_email=...&sentiment=negative&page=1&page_size=50
```

列表可展示用户提交的 `categories/content`，但普通对话页只能拿到当前用户自己的反馈；
管理员响应须纳入审计、访问控制和数据留存策略。

### MCP secret

创建 secret 的明文只能显示一次。后续列表仅返回 `prefix/last_used_at`，禁止再次返回原值。

## 6. 前端状态

以下动作不需要后端：

- 打开/关闭 Settings；
- 设置 tab / admin tab；
- modal 进入动画；
- 表格本地列宽与横向滚动；
- 筛选表单尚未点击查询前的编辑；
- 浏览器后退按钮的视觉 hover。

URL `/admin` 可以用 query 参数保存当前标签和筛选，但不能把 token、secret、完整消息内容写入 URL。
