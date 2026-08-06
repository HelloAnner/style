# 认证、公开与外围页面（auth / onboarding / share / showcase / settings / 其他）

来源：`SRC-057`（auth 8 文件）、`SRC-059`（onboarding 4 文件）、`SRC-058`（share 12 文件）、`SRC-061`（showcase）、`SRC-060`（settings）、`SRC-062`（legacy）、`SRC-063`（feishu）、`SRC-064`（SessionFilePreviewPage）。exact-source。

## 1. auth：固定亮色，自设色板 C（与工作台变量体系隔离）

- `pages/auth/_shared.tsx`（491 行）是唯一权威：**导出字面量色板 `C`**，注释明确“仅服务 pages/auth 固定亮色页面，工作台弹窗不要消费”。与设计原型 `docs/frontend-platform/prototype/auth-flow.html` 对齐。
- 色板要点：页底 `#FAF9F7`（暖白纸）、卡 `#FFFFFF`、三级底 `#F5F4F2`；文字阶梯 `#1A1A1A/#3A3A3A/#5A5A5A/#7A7A7A/#9A9A9A`；input border `#E4E4E7`；主钮 `#18181B` hover `#27272A`（mono 黑钮）；error `#dc2626` + `#fef2f2/#fecaca`；success `#16a34a/#f0fdf4`；密码强度 `#f87171/#fbbf24/#22c55e`；卡阴影 `0 1px 3px 0.04 + 0 8px 24px 0.06`。
- 组件：Moss 三环 logo（28px 环 + 12px 芯 + 5px 点缀 + 18px/600 字标）、表单 label 13/500、input radius 8 / 13px、错误行 12px、卡片 radius **16**。
- 页面：CallbackPage、WorkspaceEntryPages（创建/选择/重定向，812 行）、WorkspaceInvitePages（751 行）、SuperAdminVerifyPage、AliyunWorkspaceBindPage、ExternalChannelBindPage——全部共用 _shared，保证认证域视觉绝对一致。
- dark：**设计上无 dark**，不得套反色。

## 2. onboarding（4 文件）

- `onboarding.css`（315 行）+ `onboarding-concept.css`（151 行），类前缀 `.moss-onboarding`；概念页独立样式。与 auth 同为一次性流程页，细节见原件。

## 3. share：公开分享域，消费工作台语义变量

- `SharePage`（926 行）+ `ReplayMessageList/ReplayControls/ReplayWorkspace/ShareFileWorkspace/ShareCTA/FileSharePage`：完整只读会话回放 + 文件工作区。
- 与工作台同源：`--bg-primary/--text-*/--border-*`；主钮用 `--btn-mono-*` 三件套；错误/空态全屏居中、48px 描边图标、16/600 标题 + 14 描述。
- 复刻要点：分享页 = 工作台消息流/文件区的**只读投影**，不要重新设计消息气泡，直接复用 Chat 规则。

## 4. showcase：独立营销页变量（第三套色系）

- `ShowcasePage.tsx`（729 行）内嵌 `<style>` 自定义变量：`--parchment #18181b`、`--parchment2 #3f3f46`、`--text-main/--text-sub/--border`；浅色营销排版（0.95rem/600 卡标题、`letter-spacing 0.08em` eyebrow、`#f4f4f5` chip）。
- 与 auth 一样属 light-only 字面量页面，但变量定义在组件内而非 _shared。

## 5. settings（3 文件）

- `SettingsPage`：内联样式 + 语义变量（带 zinc fallback）；分区标题行 `border-bottom 1px --border-subtle`、muted 13px 导航；头像上传 `avatarUpload.ts`。

## 6. 其他单页

- `SessionFilePreviewPage`（独立文件预览路由）、`feishu/FeishuUsageDetailPage`、`legacy/LegacyStarMigrationPage`（迁移引导，配 `LegacyStarMigrationRedirect` guard）。

## 7. 复刻要点

1. 三套色彩语境分清：**工作台语义变量**（双主题）/ **auth 的 C 色板**（light-only）/ **showcase 的 parchment 变量**（light-only）。跨语境搬运字面量是常见错误。
2. 认证域任何新页面必须基于 `_shared.tsx`，禁止另起调色板。
3. 公开域（share）遵循工作台变量，天然获得 dark 值，但运行态仍被 ThemeProvider 归一为 light（GAP-001）。
