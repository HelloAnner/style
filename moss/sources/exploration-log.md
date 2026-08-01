# 主动探索日志

## EXP-20260801-01
- 输入：用户授权本地源码 `/Users/anner/fine/ai/dev`
- 目标：创建 Moss 对话与系统风格档案，重点分析思维链。
- 环境：macOS；`rg`/`find`/`shasum`；Python 3；Playwright CLI + Google Chrome；PI model `gpt-5.6-sol`。
- 安全检查：阅读根与前端 package scripts；源仓库 frontend 工作区无未提交改动；未读取 `.env`；未安装依赖；未执行源应用脚本。
- 动作：枚举前端入口/页面/Chat 组件；反查 theme → token → component；读取思维链、消息、输入、Markdown、主题文件；复制 14 个关键原件；计算 SHA-256。
- 发现：默认设计有完整 light/dark CSS 值，但 `ThemeProvider` 强制运行态 light；思维链由过程说明节点与缩进工具动作构成，运行时展开、完成后收起。
- 新增：`sources/source-code/`、`evidence/measurements/thinking-chain-source-map.md`、`system/` 与分析文档。
- 限制：登录态与后端数据阻止真实页面无副作用采集；dark 无真实产品运行态；移动端规则文档在源码所述路径缺失。
- 覆盖变化：desktop/light 源码规则 observed；dark 源码 Token observed；核心思维链状态 partial。
- TODO：TODO-011 至 TODO-016 保持开放。
- 需要用户：REQ-001 至 REQ-003。

## EXP-20260801-02
- 输入：SRC-001 至 SRC-014。
- 目标：产生可消费参考并检查双主题/双视口渲染。
- 环境：Google Chrome（Playwright `--channel chrome`）；locale `zh-CN`；timezone `Asia/Shanghai`；DPR 1；1440×900、390×844。
- 动作：基于 exact-source Token 编写 `examples/reference/thinking-chain.html`；分别以 light/dark 渲染并截图。
- 新增：`examples/validation/thinking-chain__*` 共 4 张。
- 发现：参考实现双主题和两视口可稳定渲染；移动窄屏隐藏耗时列能避免拥挤，但这是 Recommended 扩展，不是来源事实。
- 限制：截图是档案参考实现，不是 Moss 产品 baseline，不能关闭真实视觉回归缺口。
- 覆盖变化：参考实现 validated；来源产品仍 partial。
