# Changelog

## 0.1.0 — 2026-08-01

### Sources
- 登记用户授权本地源码 `/Users/anner/fine/ai/dev`，commit `195a663d2323af7c668a1db9e0a1be442a2c2b49`。
- 原样保存 14 个前端关键源码文件及 SHA-256，未读取 `.env`，未复制凭据。

### Analysis
- 盘点 Moss 工作台、消息流、assistant frame、输入框与思维链结构。
- 将思维链拆为运行状态、过程说明、工具动作、连接线、完成折叠、自动滚动和性能生命周期。
- 分离 light/dark 精确源码值，并记录运行态固定 light 的冲突。

### Tokens / implementation
- 生成聚合 Token、双主题展开 JSON/CSS、style guide 与实现指南。
- 新增可运行的思维链参考页和 4 张双主题/双视口派生截图。

### Validation
- JSON 解析通过；参考页在 Chrome headless 的 1440×900 与 390×844、light/dark 下成功渲染。
- 参考截图不是来源产品 baseline，未用于宣称真实视觉回归通过。

### Status / TODO
- 状态设为 `reusable`，完成率 62.5%。
- 保留真实 dark、移动端、字体许可、状态矩阵和来源视觉回归缺口。

### Breaking changes
- 无，首次建档。
