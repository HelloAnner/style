# 运行时采集批次 runtime-2026-08-06

## 采集上下文

- 来源：本地 `vite dev`（commit `195a663d`，未登录，后端 API 离线）。
- 浏览器：Chromium via Playwright 1.56.1，headless，DPR 1，zh-CN。
- 视口：desktop 1440×900、mobile 390×844。
- **dark 截图为派生证据**：产品 ThemeProvider 强制 light；dark 是采集脚本在页面加载后手动设置 `documentElement.dataset.theme='dark'` 得到的 token 应用结果，**不是产品 dark 运行态**（GAP-001 仍未关闭）。
- 截图与 `capture-report.json`（计算样式 + 字体 + 最终 URL + 页面错误）逐文件 SHA-256 见 `SHA256SUMS`。

## 逐路由结论（Observed · local-runtime）

| 路由 | 结果 | 结论 |
|---|---|---|
| `/login`、`/register` | 302 跳 `/api/v1/auth/cas/login`（后端离线→空白） | 该部署登录走 CAS SSO 重定向；前端登录表单不在此部署呈现 |
| `/superadmin/verify`、`/workspace/create` | 同上（带 redirect 参数） | 未认证统一 CAS 拦截 |
| `/showcase` | **完整渲染** | 真实 baseline：导航（MOSS·谋士 + 5 链接 + 登录/免费注册黑钮）、CASE LIBRARY eyebrow、CJK 大标题（Noto Sans SC 实载）、"全部" pill、空案例墙；mobile 390px 导航**无适配**（竖排溢出） |
| `/join/invalid-token-probe` | **完整渲染错误态** | 真实 baseline：auth C 色板实锤——`#FAF9F7` 页底、白卡 radius16、禁用输入条、`#fef2f2/#dc2626` 错误横幅；**强制 dark 下卡片保持全亮**（auth light-only 实锤） |
| `/share/invalid-token-probe` | 停留在加载背景 | `#FAF9F7` 全屏画布为 share 加载底；API 离线无法推进到错误态 |

## 字体事实（TODO-014 关闭依据）

- 运行时声明 114 个 FontFace：Inter 7、JetBrains Mono 6、Noto Sans SC **101**（unicode-range 切片，CJK fallback）。
- showcase 实际 loaded 13 个 face（Inter 正文 + Noto Sans SC 标题）；JetBrains Mono 声明未用（代码场景才加载）。
- 字体为 Google Fonts 镜像自托管（`/fonts/google/`），产品 README 声明 SIL Open Font License；二进制未归档，114 个 woff2 的 SHA-256 已记录（`sources/source-code/fonts/FONT-SHA256SUMS`）。

## 移动端事实（TODO-013 关闭依据）

- `MobileUnsupportedGuard` 权威规则：`innerWidth ≤ 960` **且** coarse pointer **且**无 hover 能力 → 展示"移动端不支持"页（`--bg-primary` 全屏 + pill 标签 + 20/600 标题 + 14 说明）。
- 桌面窄窗（≤960 但有 hover/精确指针）**不拦截**。
- 公开页（showcase）无 Guard 但无移动适配（390px 导航溢出，见截图）。
- superadmin 壳有 860px 断点转纵向；看板内容有 560–1180 内部断点。工作台本体（sidebar/chat/drawer）无任何响应式规则——移动端策略就是"不支持"。

## 局限

- 登录态页面（工作台、admin、看板运行态）无法在无凭据下采集，仍为 GAP-002。
- dark 截图为派生，已逐文件标注，不得作为产品 dark baseline 引用。
