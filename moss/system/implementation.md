# 实现指南

## 1. 门禁

先读 `../manifest.json` 与 `../quality/gaps.md`。当前可精确复用源码覆盖的对话/思维链规则，但不能声称整个 Moss 或 dark 运行态已经视觉验证。

## 2. 资源

1. 加载 Inter；代码块加载 JetBrains Mono。
2. 中文环境验证实际 fallback 与换行。字体二进制未随档案分发；使用前核验 Google Fonts/组织授权。
3. 思维链产品 SVG 路径见 `../sources/source-code/Chat/ActionFeed/ActionItem.tsx`；不要随意换 icon set。

## 3. Token 接入

- 加载 `tokens.css`，根节点设置显式 `data-theme="light|dark"`。
- 若框架支持 mode，使用 `tokens.json`；否则使用完整展开主题文件。
- 不复制来源 `ThemeProvider` 的 fixed-light 行为，除非目标产品也明确只发布 light。若严格复制当前 Moss 运行行为，则固定 `light` 并把 dark 作为未启用资产。

## 4. 全局前提

`box-sizing:border-box`；body margin 0；UI font；背景/文字从目标主题取值。不要使用 Tailwind zinc 默认值覆盖 semantic Token。Focus 来源事实会清 outline，存在风险；修复需用户批准并记录偏差。

## 5. 构建顺序

1. App shell：260/48 sidebar，chat min400，right panel 50%/min480/inset8。
2. Expanded/collapsed Sidebar：Brand → Agent → New session → Groups → Footer → User。
3. Session header：48px title/actions，滚动 surface。
4. Message list：900px 内容列、24px inline/top、32px bottom、24px gap。
5. Assistant frame：24px mark、名称、时间。
6. **Reasoning trace**：状态机与 event sequence 先于视觉。
7. ActionFeed：过程节点、connector、工具缩进、528px 滚动。
8. Assistant response surface。
9. Composer：max900、min116、outer bottom31。
10. Workspace drawer：header → scope/stat/upload → search/batch/view → file grid/list/preview。
11. Markdown、附件、反馈与其他长尾组件。

## 6. 思维链最小 DOM

```html
<section class="reasoning">
  <div class="running-status">正在处理中...</div>
  <div class="process-group">
    <div class="process-note">[status icon] 人类可读过程说明</div>
    <div class="tool-actions">[tool icon] 动作短句 [duration]</div>
  </div>
</section>
```

不要把 process group 包成独立卡片。Connector 以组容器绝对定位；tool action 使用复合缩进。完成后用 toggle 替换 running status 并默认折叠。

## 7. 行为

- Running 最新消息自动展开且不可折叠。
- Terminal 自动收起；用户展开时滚到 section 起点。
- 收起 60s 后释放 DOM；最多保留 3 个展开 feed（若历史很短可保留该上限，不能无依据删除性能策略）。
- 预览清理 Markdown，按 96 code points + 句号规则截断。
- 过程内部贴底；用户手动上滚后停止自动跟随。

## 8. 可运行组件参考

- 完整工作台：`examples/reference/conversation-workspace/index.html?theme=light|dark`
- 实现拆为 `index.html`、`styles.css`、`app.js`，无外部框架依赖。
- 已实现 sidebar 折叠、会话 active 切换、文件区关闭、grid/list 和搜索；用于消费与布局回归，不是来源产品 baseline。
- 原始 React 实现见 `sources/source-code/{App.tsx,Sidebar/,Chat/,Workspace/}`；产品图标见 `sources/source-code/assets/`。

## 9. 响应式

来源无可验证移动实现。参考页在 390px 隐藏耗时只是建议，不是权威规则。目标若必须移动端，先获得来源证据；否则记录推荐扩展与偏差。禁止根级 400px min-width 造成页面横向滚动。

## 10. 验证

- 运行 `python3 examples/reference/check-profile.py`。
- 参考渲染：浏览器打开 `examples/reference/thinking-chain.html?theme=light|dark` 与 `examples/reference/conversation-workspace/index.html?theme=light|dark`。
- 正式视觉回归必须另取来源产品 baseline：1440×900 和 390×844、DPR1、zh-CN、相同数据；至少 running、completed-collapsed、expanded、failed、long trace。
- 字体 ready 后截图；diff 不得用宽松阈值掩盖结构偏差。
