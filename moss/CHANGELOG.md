# Changelog

## 0.2.0 — 2026-08-01

### Sources
- 追加 App shell、完整 Chat 组装、展开/折叠 Sidebar、会话列表、WorkspaceDrawer/FileGrid 来源。
- 原样保存 Chat/Sidebar/Workspace 全部非测试组件实现共110文件，并提供三个 bundle 哈希。
- 保存 sidebar/file-panel/file-icons 59个产品图标原件及逐文件哈希；来源总数增至42。

### Analysis
- 新增完整桌面对话工作台、左侧会话列表、右侧文件工作区三份专题规范和源码映射。
- 补齐 sidebar 260/48、会话 item36、header48、right panel 50%/min480/inset8、文件卡180/120等精确规则。

### Tokens / implementation
- Token 扩展 sidebar、home、chat header、right panel、workspace/file-card、breakpoint 和主题映射。
- 新增无依赖可运行组件参考：sidebar + conversation + reasoning + composer + file drawer，含基础交互。

### Validation
- Light/dark 1440×900 完整工作台参考渲染成功；JSON、来源哈希和 entrypoint 自检待最终报告记录。
- 参考实现不是来源产品 baseline，未提升为 validated/complete。

### Status / TODO
- 版本升至0.2.0，完成率73.9%，状态仍为 reusable。

### Breaking changes
- 消费入口从“思维链重点”扩展为“完整对话工作台”；实现 Agent 必须读取新增 sidebar/file-workspace 规范。

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
