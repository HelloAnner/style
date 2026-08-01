# Moss 对话设计风格档案

## 一句话风格定义

温暖米白/近黑画布上的低噪声 AI 工作台：以紧凑中性色时间线公开“思考 → 工具动作 → 结果”，橙色只用于品牌与发送动作。

## 状态与完成率

- 版本：`0.1.0`
- 状态：`reusable`（带明确缺口可复用，不等于完整）
- 完成率：`10/16 = 62.5%`
- 重点范围：对话、assistant 正文、输入框、**思维链/工作过程**
- Blocker：真实产品 dark 运行态、真实页面双主题截图、移动端运行态、字体许可、完整状态矩阵、视觉回归 baseline

## 主题入口

- Light：[规则](analysis/themes/light.md) · [展开 Token](system/themes/light.tokens.json) · [CSS](system/themes/light.css)
- Dark：[规则](analysis/themes/dark.md) · [展开 Token](system/themes/dark.tokens.json) · [CSS](system/themes/dark.css)
- 注意：来源 `ThemeProvider` 当前强制 light；dark 值是源码精确值但未在真实产品运行态验证。

## 视觉指纹

1. Light 画布 `#FAF9F7`，dark 画布 `#0A0A0F`；不是纯白/纯黑。
2. 内容列最大 `900px`，左右 `24px`，消息垂直间隔 `24px`。
3. Assistant 先显示 `24px` 标记、14/600 名称和 12px 弱化时间。
4. 思维链默认无外层卡片：14px 过程节点、13px 工具动作、`1.25px` 连接线。
5. 过程节点完成态为中性实心圆勾，运行态为锥形 `1s` spinner。
6. 运行文案使用中性灰 `1.4s` 扫光，不使用蓝紫“AI 发光”。
7. Assistant 正文才进入 `8px` 圆角、`16px 18px` 内边距的轻边框 surface。
8. 完成后工作过程自动收起为“已完成，耗时…⌄”；手动展开。
9. 品牌橙 `#D95E3A/#E86A45` 和发送橙 `#DE6A43` 节制使用。

## Do / Don't

- Do：保持过程说明与工具动作的层级、缩进和中性色。
- Do：运行时自动展开，完成后自动收起；历史展开内容延迟卸载。
- Don't：把思维链改成彩色卡片、代码终端、大号步骤标题或整块渐变。
- Don't：把 dark 当 light 的反色；不要声称当前 dark 已经真实运行验证。

## 实现 Agent 阅读顺序

`manifest.json` → `quality/gaps.md` → `system/style-guide.md` → `system/tokens.json` → 目标主题 → `analysis/components.md` → `analysis/patterns.md` → `system/implementation.md` → `quality/acceptance.md`

## 来源与证据

- [来源索引](sources/index.md)
- [源码快照](sources/source-code/README.md)
- [探索日志](sources/exploration-log.md)
- [思维链源码映射](evidence/measurements/thinking-chain-source-map.md)
- [可运行参考](examples/reference/thinking-chain.html)
- [双主题/双视口派生截图](examples/validation/)

## 缺口

见 [TODO](quality/TODO.md)、[请求](quality/REQUESTS.md)、[gaps](quality/gaps.md) 和 [完成报告](quality/completion-report.md)。当前不能保证整个 Moss 系统百分百严格复刻。
