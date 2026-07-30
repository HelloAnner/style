# EVD-011：账户设置、入口与运营平台源码映射

## 来源

- Wufan 源码：`SRC-061`
- 绝对路径：`/Users/anner/fine/ai/corevo`
- commit：`14394dc7ca16aa13c62e8a089c6ffff4953424f3`
- 分析方式：只读静态分析；未启动私有服务，未读取 env、管理员白名单值、真实用户或运营数据

逐文件 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `web/src/pages/settings/SettingsPage.tsx` | `550a8fc48d9089409457f6f3301229f201e401e9b511cc320f173119cca8e6f9` |
| `web/src/pages/admin/AdminPage.tsx` | `df46c58559083b61dc31364c2290370440179c87ec54da4912099bd69b3f1b56` |
| `web/src/components/Sidebar/Sidebar.tsx` | `c7534d1ea2c5bd257e04d07216f02ab82bc797173a1cd49ac5a382a75eec1b4c` |
| `web/src/components/Sidebar/CollapsedSidebar.tsx` | `be8d35421ddba562632587c329beff9c692631a20c4d0acb0015e6ab610686ab` |
| `web/src/App.tsx` | `ffa0bae2ee3b303edafacea9cf8cc096e59c46f1d14ead7b36b950facf4c1375` |
| `web/src/api/admin.ts` | `be2ad1515d801139ffae6066a9be04c7b019e26288c5ff070f6b1a49cabeb6cd` |
| `web/src/api/platform.ts` | `c32830473b06601154e18fadc1dc75dc77eb70d4c15cf02edefdb0a828ab05ed` |

## 入口

### 展开 Sidebar

`Sidebar.UserInfo` 的整行用户信息是唯一设置触发器：

- padding `10px 12px`、gap10；
- 中号用户 Avatar；
- displayName 13px/500；
- click 设置 `initialTab=profile` 并打开 `SettingsPage`；
- 该实例传入 `onOpenAdmin`。

### 收起 Sidebar

`CollapsedSidebar` 同时提供：

- 18px gear icon button；
- 用户 Avatar；
- 两者都打开 Settings；
- 此实例没有传 `onOpenAdmin`，因此订阅页的“运营平台”不会渲染。

### 运营平台

展开 Sidebar 的链路为：

```text
UserInfo → SettingsPage → subscription → onOpenAdmin → navigate("/admin")
```

前端显示条件是 `tenant.plan === "developer" && onOpenAdmin`。后端
`require_developer` 的实际语义不是 plan，而是认证用户 email 命中 `ADMIN_USER_EMAILS`
白名单。UI 条件与后端授权源不一致；复刻不能把 developer plan 当作最终权限。

## Settings

| 语义 | 源码值 |
|---|---|
| portal | `document.body` |
| backdrop | fixed inset0, z100, p16 |
| panel | 840×600, r20, 1px modal border |
| left nav | 220px, p20×12, bg-tertiary |
| title | 15/600, p0×10, mb20 |
| group label | 11/500, p0×10, mb6 |
| nav item | p8×10, r8, gap10, 13px |
| active | hover-bg + text-primary + 500 |
| content header | p18×28；title 17/600 |
| close | 30×30/r8 |
| content scroll | p4×28×28 |
| animation | 150ms fade；scale .97→1 |

标签：

- 我的账户：个人信息、加入的空间；
- 当前空间：资产、接入 API、用量、订阅、空间管理；
- 资产内层：工具、技能、伙伴、自动化、卡片。

## Admin

`/admin` 在 AppRoutes 内、整个 SaaS AppRoutes 受 AuthGuard 保护；页面本身没有前端 developer
route guard，具体 API 依赖后端 `403`。

| 语义 | 源码值 |
|---|---|
| root | fixed inset0, z9999, bg-primary |
| header | p12×24, bg-secondary, border-bottom |
| back | p4×8, r4, 13px |
| product name | 15/600 |
| nav | gap4 |
| nav button | p6×16, r6, 13px |
| nav active | text-primary background / bg-primary text / 600 |
| main | p24, overflow auto |
| stat card | p16×20, r10 |
| panel | p16, r10 |
| table shell | r8 |
| th/td | p10×14 |

当前默认 `token_usage`。可见 nav 为：

1. 消息日志
2. Token用量
3. 性能监控
4. 反馈闭环
5. MCP接入
6. 问题排查
7. 工具统计
8. 用户活跃
9. 实时监控
10. 系统
11. 案例管理

`dashboard/tenants` 仍存在于 `Tab` 和 render switch，但没有 nav button，属于当前不可达旧代码。

## API 冲突

`web/src/api/admin.ts` 的 tenant helper 调用：

```text
/api/admin/tenants
/api/admin/tenants/{id}
```

但同 commit 后端 `core/api/routes/admin.py` 实际注册：

```text
/api/admin/teams
/api/admin/teams/{id}
```

该冲突不能静默合并。归档 `backend-contract.md` 以当前后端实际 `/teams` 为 canonical，并要求
若必须兼容旧前端，应通过明确别名或同步改造客户端。

## 可运行参考

- `examples/reference/account-admin/WufanAccountAdmin.tsx`
- `examples/reference/account-admin/wufan-account-admin.css`
- `examples/reference/account-admin/demo.html`
- `examples/reference/account-admin/backend-contract.md`
- `examples/validation/account-admin/`

desktop 值为 exact-source reimplementation；light/dark 使用 Wufan Product 独立主题 Token。
mobile 无来源截图和专用 media rule，归档的全高 modal、横向 admin nav/表格是显式
source-derived 适配。
