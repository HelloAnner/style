# 悟帆账户设置与运营平台参考

本目录是从 Wufan 自身源码 `/Users/anner/fine/ai/corevo`（commit
`14394dc7ca16aa13c62e8a089c6ffff4953424f3`）只读提取并重写的可运行参考。它没有复制
私有 store、真实用户/租户数据或密钥。

## 真实入口

```text
展开 Sidebar
└─ 底部用户行 → SettingsPage(initialTab="profile")

收起 Sidebar
├─ 齿轮按钮 → SettingsPage
└─ 用户头像 → SettingsPage

SettingsPage
└─ 订阅
   └─ 开发者版 + onOpenAdmin 存在 → “运营平台”
      └─ navigate("/admin") → AdminPage
```

注意两项源码事实：

1. 收起 Sidebar 创建 `SettingsPage` 时没有传 `onOpenAdmin`，因此它的订阅页不会出现
   “运营平台”；只有展开 Sidebar 的设置实例具备这条入口。
2. 前端仅以当前空间 `plan === "developer"` 决定是否展示入口，但后端所有
   `/api/admin/*` 通过 `require_developer` 按管理员邮箱白名单鉴权。复刻时必须以后端
   `403` 为最终权限结论，不能只相信前端计划字段。

## 页面结构

账户设置是 portal modal：

- backdrop `z100`，light alpha `.4` / dark alpha `.7`；
- panel `840×600`、radius20、1px modal border；
- 左栏 `220px`、padding `20px 12px`；
- 内容 Header `18px 28px`，正文 `4px 28px 28px`；
- 进入 `150ms` fade + `scale(.97→1)`；
- “我的账户”：个人信息、加入的空间；
- “当前空间”：资产、接入 API、用量、订阅、空间管理。

运营平台是独立全屏 `/admin`：

- fixed inset0、`z9999`、Product 主题背景；
- Header `12px 24px`，底部 1px border；
- 返回 + “运营平台”在左，11 个可见标签在右；
- active 标签为 `text-primary` 底、`bg-primary` 字；
- Main padding24；
- 卡片 `p16×20/r10`，表格 `th/td 10px 14px`、外壳 r8。

源码的 `dashboard` 与 `tenants` 类型/渲染仍存在，但当前导航不提供入口；默认标签是
`token_usage`。当前可见顺序为：

`消息日志 / Token用量 / 性能监控 / 反馈闭环 / MCP接入 / 问题排查 / 工具统计 /
用户活跃 / 实时监控 / 系统 / 案例管理`。

## 文件

- `WufanAccountAdmin.tsx`：账户设置、运营平台和入口壳层；
- `types.ts`：页面与数据类型；
- `mock-data.ts`：脱敏确定性数据；
- `wufan-account-admin.css`：light/dark、精确 desktop 几何和标注的 mobile 适配；
- `backend-contract.md`：账户与运营 API、鉴权和错误语义；
- `backend-contract.schema.json`：样例数据 Schema；
- `backend-api.example.json`：脱敏接口样例；
- `spec.json`：机器可读几何、入口和证据；
- `demo.html`：零构建交互演示。

## React 使用

```tsx
import { useState } from 'react';
import {
  WufanAccountSettings,
  WufanAdminPlatform,
  accountUserFixture,
  accountSpacesFixture,
  accountQuotaFixture,
  accountAssetFixture,
  adminMockData,
} from './account-admin';
import './account-admin/wufan-account-admin.css';

export function AccountEntry() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  if (adminOpen) {
    return (
      <WufanAdminPlatform
        theme="light"
        data={adminMockData}
        onClose={() => setAdminOpen(false)}
      />
    );
  }

  return (
    <>
      <button onClick={() => setSettingsOpen(true)}>午饭示例</button>
      <WufanAccountSettings
        isOpen={settingsOpen}
        theme="light"
        user={accountUserFixture}
        currentSpace={accountSpacesFixture[0]}
        spaces={accountSpacesFixture}
        quotas={accountQuotaFixture}
        assets={accountAssetFixture}
        showAdminEntry
        onClose={() => setSettingsOpen(false)}
        onOpenAdmin={() => setAdminOpen(true)}
      />
    </>
  );
}
```

生产接入时，`showAdminEntry` 应由服务端返回的显式 capability（例如
`capabilities.admin_platform === true`）决定，并且 `/admin` 路由还应有前端 guard；
后端仍须独立执行白名单/RBAC 校验。

## 准确范围

- desktop 几何、标签、入口、主题 Token、动效和后台公共卡片/表格来自 `SRC-061/EVD-011`；
- 后台业务数据、账户和邮箱均为脱敏 mock；
- mobile 在目标源码没有专门 media rule 或来源截图，本参考的窄屏全高 modal、横向 nav
  是明确标注的 source-derived 可用适配，不是像素 baseline；
- 当前源码中 admin 前端使用旧 `/tenants` 命名，而后端实现为 `/teams`；契约以服务端已实现
  `/teams` 为 canonical，并单独记录兼容问题。

整个 `wufan` 档案仍为 `analyzed`，不能由本组件的本地通过推导为全站 `complete`。
