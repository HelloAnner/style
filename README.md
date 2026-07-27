# style

可追溯、双主题、面向 AI 的设计风格档案库。

## 核心目标

每个业务系统使用一个独立子文件夹，保存原始资料、探索证据、分析规则、双主题 Token、实现指南和验收结果。另一个 AI 只需进入对应子文件夹并读取其中的 `AGENTS.md`，即可知道如何采集、补全或严格复刻该设计系统。

“参考”默认表示严格对标：业务内容可以不同，但相同语义的组件、字体、色彩、间距、布局、状态、动效和 light/dark 主题规则必须一致。

## 入口

- Agent 总入口：[`AGENTS.md`](AGENTS.md)
- 完整规范索引：[`docs/README.md`](docs/README.md)
- 主动探索机制：[`docs/03-active-exploration.md`](docs/03-active-exploration.md)
- 完整性门槛：[`docs/07-quality-completion.md`](docs/07-quality-completion.md)

## 档案

- [`wufan/`](wufan/)：当前为 `analyzed`，已完成第一轮网站/截图/源码深度分析和双主题 Token；仍有登录态覆盖与视觉回归缺口。
