# Moss 对话设计风格档案：Agent 指令

## 档案身份

- 档案 ID：`moss`
- 机器状态的唯一来源：`manifest.json`
- 任务待办：`quality/TODO.md`
- 用户资料请求：`quality/REQUESTS.md`
- 本文件中的状态摘要不能替代实时读取 manifest。

## 核心目标

用户要求“参考 Moss”时，默认严格复刻。业务内容可变；相同语义的组件、字体、字号、字重、颜色、间距、尺寸、圆角、边框、阴影、图标、布局、状态、动效和响应式规则必须来自本档案。禁止近似字体、相近色值、框架默认组件、肉眼估计和静默优化。

`light` 与 `dark` 是独立主题。必须读取目标主题展开 Token；禁止跨主题取值或通过反色推测。当前来源产品运行态固定 `light`，但源码定义了两套主题值；`dark` 尚未取得真实产品运行截图，因此只能按 exact-source Token 实现，不能声称已视觉验证。

## 开始任何任务前

1. 读取 `manifest.json`、`README.md`。
2. 读取 `quality/TODO.md`、`quality/REQUESTS.md`、`quality/gaps.md`。
3. 若父级规范可访问，读取 `../docs/README.md` 并按任务路由阅读完整专题规范。
4. 不得仅凭本文件或记忆跳过实时事实。

## 严格复刻顺序

1. `system/style-guide.md`
2. `system/tokens.json`
3. `system/themes/<theme>.tokens.json` 与 `<theme>.css`
4. `analysis/conversation-workspace.md`
5. `analysis/sidebar.md`
6. `analysis/file-workspace.md`
7. `analysis/components.md`（思维链为最高优先级）
8. `analysis/patterns.md` 与 `analysis/layout.md`
9. `system/implementation.md`
10. `quality/acceptance.md`
11. 需要核实时查 `sources/index.md`、`sources/source-code/` 和产品图标原件

只有 manifest 为 `complete` 且目标范围 validated，才能无条件声称严格一致。当前档案不是 complete；带缺口使用前须说明 dark 运行态、移动端和真实页面视觉回归缺口。

实现顺序：字体/产品图标 → Token → App shell → 260/48px Sidebar → 会话 header → 消息列 → assistant frame → 思维链/工具时间线 → 正文 → 116px composer → 50% inset 文件 drawer → 文件 grid/list → 状态/响应式 → 双主题比较。思维链必须保持“过程说明节点 + 细竖线 + 缩进工具动作”的层级；侧栏当前态必须保持中性；文件区必须保留 8px inset drawer，不得改成彩色卡片瀑布、日志终端、贴边 split pane 或大面积高亮。

## 采集或更新

- 原始资料只追加到 `sources/`，不覆盖或删除；更新哈希、来源索引和 manifest。
- 先主动探索，再向用户提问。
- 关键结论标记 Observed/Inferred/Recommended、精确性、置信度、主题和证据。
- light/dark 分别保存截图、分析、Token、状态和验证。
- 每轮更新 exploration log、coverage matrix、TODO、REQUESTS、gaps、completion report、CHANGELOG。
- 未通过门槛不得设为 complete。

## 验收与安全

按 `quality/acceptance.md` 在相同主题、viewport、DPR、浏览器、字体、locale、状态和数据长度下比较，输出偏差报告。目标为 0 个未解释差异。

不绕过登录或访问控制，不执行未检查源码，不保存凭据或隐私数据。品牌 Logo、字体和专有素材仅在授权明确时复用；本档案默认复制设计语言，不授予品牌素材权利。
