# wufan 设计风格档案：Agent 指令

## 档案身份

- 档案 ID：`wufan`
- 机器状态的唯一来源：`manifest.json`
- 任务待办：`quality/TODO.md`
- 用户资料请求：`quality/REQUESTS.md`
- 本文件中的任何状态摘要都不能替代实时读取 manifest。

## 核心目标

当用户要求“参考/按照本档案”设计新业务时，默认要求严格复刻：业务内容、数据、字段和流程可以不同；相同语义的组件、字体、字号、字重、色彩、间距、尺寸、圆角、边框、阴影、图标、布局、状态、动效和响应式规则必须精确一致。禁止使用近似字体、相近色值、框架默认组件或肉眼估计值。只有用户明确要求近似时才可降低严格度，并记录例外。

Product 的 `light` 与 `dark` 是平行且独立的主题。必须读取对应主题 Token 和规则；禁止跨主题取值，禁止通过反色推测另一主题。支持主题切换时两主题分别实现和验收。Marketing 官网是独立的固定暗色表面，必须使用 `system/marketing.tokens.json`，不能与 Product Token 混合。

## 开始任何任务前

1. 读取 `manifest.json`，确认 version、status、coverage 和 entrypoints。
2. 读取 `README.md`。
3. 读取 `quality/TODO.md`、`quality/REQUESTS.md` 和 `quality/gaps.md`。
4. 读取 `../docs/README.md` 并按任务路由完整阅读父级专题规范。
5. 不得仅凭本文件或记忆跳过档案事实。

**当前档案已完成第一轮分析并有精确运行时 Token，但尚未 `complete`：登录后同页双主题、移动端、交互状态、版本映射和视觉回归仍有 blocker。只能在已有证据覆盖范围内实现，禁止声称整个系统已可完全复刻。**

## 若任务是严格复刻到新业务

按顺序阅读：

1. `system/style-guide.md`
2. `system/tokens.json`
3. 当前主题的 `system/themes/<theme>.tokens.json` 和 `<theme>.css`
4. `analysis/components.md`
5. `analysis/patterns.md`
6. `analysis/layout.md`
7. `system/implementation.md`
8. `quality/acceptance.md`
9. 需要核实时查看 `analysis/`、`sources/index.md` 和证据原件

目标涉及登录页紫蓝小人时，必须直接读取
`examples/reference/login-mascot/README.md`、`WufanLoginMascot.tsx` 和 `spec.json`。
禁止从截图重画，也禁止复制当前本地 `corevo` 的旧 `AuthPage.tsx` 或聊天空状态无眼头像。

上述文件已建立初版，但目标范围仍须对照覆盖矩阵。只有 manifest 为 `complete` 且目标范围已 validated，才能无条件声称严格复刻。否则先向用户说明相关缺口；用户允许带缺口继续后，仍需记录推断和偏差。

实现时先做业务语义映射，再按“资源/字体 → Token → 全局基础 → 布局 → 基础组件 → 复合组件 → 页面模式 → 业务页面 → 状态/响应式 → 双主题视觉回归”执行。不能只换颜色，不能用截图充当页面，不能用大量绝对定位硬描。

## 若任务是采集或更新本档案

- 原始资料只追加到 `sources/`，不覆盖、不删除；计算哈希并更新 `sources/index.md` 和 manifest。
- 先主动探索，再向用户提问。URL、截图、源码、录屏和设计稿按 `../docs/03-active-exploration.md` 处理。
- 每项关键结论标记 Observed/Inferred/Recommended、精确性、置信度、主题和证据。
- light/dark 分别保存截图、分析、Token、组件状态和验证。
- 每轮更新 exploration log、coverage matrix、TODO、REQUESTS、gaps、completion report 和 changelog。
- 未通过 `../docs/07-quality-completion.md` 全部门槛不得把状态设为 complete。

## 不静默优化

发现可访问性、授权或技术问题时，记录来源精确值、风险和建议方案，向用户确认。未经确认不得以“优化”为由改变设计；批准后的变化作为显式偏差，不改写来源事实。

## 验收与交付

使用相同主题、viewport、DPR、浏览器、字体、locale、状态和数据长度进行比较。保存 baseline、actual、diff 和环境。目标是 0 个未解释差异；环境抗锯齿容差必须说明，不能用宽松阈值掩盖错误。

回复时报告：档案 version/status、使用主题、实现范围、验证结果、开放 TODO、推断、授权限制和全部偏差。只有 `complete` 且目标范围验证通过，才可使用“完整、严格一致”的表述。

## 安全边界

不绕过登录/付费墙/访问控制，不执行未检查源码，不保存凭据或隐私数据，不触发删除、付款、提交等副作用。品牌 Logo、专有素材和受限字体只有明确授权才用于新业务。
