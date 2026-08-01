# Moss 对话与思维链 Style Guide

## 定义

Moss 是低噪声、可审计的 AI 工作台：温暖中性画布承载克制的消息 surface，工作过程用细时间线解释“思考与行动”，橙色只承担品牌和发送动作。

## 视觉指纹

1. Light `#FAF9F7` / dark `#0A0A0F` 画布。
2. 900px 居中对话列、24px 横向 padding、24px 回合间距。
3. Assistant 24px 标记 + 14/600 名称 + 12px 时间。
4. 思维链无外卡片；14px 过程说明、13px 工具动作、11px 耗时。
5. 1.25px 中性连接线，工具组复合缩进 23px。
6. 运行态使用 1.4s 中性文字扫光与 1s 锥形 spinner。
7. 正文 surface 8px radius、16×18px padding、1px subtle border。
8. 完成后思维链收起为 34px 状态 toggle。
9. Light 品牌橙 `#D95E3A`、dark `#E86A45`；发送均 `#DE6A43`。

## 主题

读取 `themes/<theme>.tokens.json`，不要跨主题 alias。来源运行态当前固定 light；dark 虽为源码 exact-source，但必须标记“未在来源产品真实运行验证”。

## 字体

UI 使用 Inter；代码使用 JetBrains Mono；中文 fallback 需按实际平台验证。思维链排版必须使用精确的 14/22、13/20、11/20 层级。

## 空间、形状与层级

使用 4/6/8/10/12/14/16/20/24/32px 空间序列。多数表面 radius 8–16px；思维链本身无 radius、无背景、无阴影。正文和输入框才建立 surface 层级。

## 思维链状态语法

- Waiting：`正在思考...`。
- Tool/answer active：`正在处理中...`。
- Process note running：spinner；closed：实心圆勾；failed：圆警告。
- Tool action：产品图标 + 动词短句 + 可选耗时。
- Terminal：成功/失败/超时/取消 toggle，默认收起。
- 运行时自动贴底；用户手动上滚后停止；ActionFeed 上限 528px。

## 页面模式

对话回合按“用户输入 → assistant header → 工作过程 → 正文/widget → 后操作”排列。不要把思维链放进正文卡片，也不要默认显示原始 tool JSON。

## Do

- 先写人类可读过程说明，再缩进具体动作。
- 用中性色区分层级，用橙/蓝只表达品牌或链接语义。
- 保留运行自动展开、完成自动收起和按需审计。

## Don't

- 不做蓝紫霓虹 AI glow、彩虹步骤卡或大面积渐变。
- 不把 spinner、通用 Lucide 或框架默认 timeline 替换产品图标。
- 不把 dark 由 light 反色生成。
- 不把参考页截图当来源产品 baseline。

## 风险与偏差

焦点 outline、完整 reduced-motion、dark 运行态、移动端与字体权利尚有缺口。未经用户确认，不以“优化”为由改写来源事实。

证据入口：`../sources/index.md`、`../analysis/components.md`；Token：`tokens.json`。
