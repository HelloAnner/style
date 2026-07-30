# 悟帆账户设置与运营平台参考验证

- 时间：2026-07-30
- 运行器：agent-browser 0.8.5
- locale / timezone：zh-CN / Asia/Shanghai
- 页面：`examples/reference/account-admin/demo.html`
- 状态：`pass within source-derived account/admin reference scope`

## 结果

| 范围 | 结果 | 说明 |
|---|---|---|
| Settings light desktop 1440×900 | pass | 840×600、220px 左栏、七标签、profile 与 close |
| Settings dark desktop 1440×900 | pass | 独立 dark Token、modal/backdrop 与 profile |
| Settings subscription | pass | developer 计划、五项权益、“运营平台”入口 |
| Admin token usage | pass | `/admin` 全屏壳层、11 个可见标签、默认 Token 用量、筛选/卡片/表格 |
| Admin feedback | pass | 点赞/点踩、原因 categories、自由文本和消息预览 |
| Admin dark desktop | pass | 相同结构的独立 dark 主题 |
| Settings dark mobile 390×844 | source-derived pass | 全高 modal、136px 导航；无 Wufan mobile baseline |
| Admin dark mobile 390×844 | source-derived pass | 顶部 nav 与表格横向滚动；无 Wufan mobile baseline |
| React build | pass | esbuild browser bundle，React/ReactDOM external |
| Contract schema | pass | Draft 2020-12 + formats |

浏览器 console 与 page errors 均为空。

## Actual

- `account-settings__light__1440x900__profile.png`
- `account-settings__light__1440x900__subscription-admin-entry.png`
- `account-settings__dark__1440x900__profile.png`
- `account-settings__dark__390x844__profile.png`
- `admin-platform__light__1440x900__token-usage.png`
- `admin-platform__light__1440x900__feedback.png`
- `admin-platform__dark__1440x900__feedback.png`
- `admin-platform__dark__390x844__feedback.png`

## 限制

- 没有真实登录态的 Settings/Admin 截图，不能声明像素 diff pass；
- mobile CSS 是明确标注的 source-derived 可用适配；目标源码没有这两个页面的专门 media rule；
- 所有用户、空间、会话、消息和运营指标为脱敏 fixture；
- admin `dashboard/tenants` 仍存在于源码类型与 render switch，但当前 nav 不可达，本参考没有
  把它们伪装成可见产品标签；
- 当前前端 `/tenants` 与后端 `/teams` 命名冲突写入契约，未静默选择旧前端路径。
