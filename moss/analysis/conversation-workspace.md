# 完整对话工作台

## 桌面壳层

```text
App shell (100vw × 100vh)
├─ Sidebar: 260px expanded / 48px collapsed
└─ Chat + right-panel group: remaining width
   ├─ Chat: flex 1, min-width 400px
   └─ Right panel: 50% group width, min 480px, 8px inset
```

`Observed · exact-source · high · desktop · SRC-015`

右面板 `workspace|board|automation` 共用 50% 固定比例；工作区/看板可最大化。宽度变更为 300ms 自定义 ease-in-out；最大化时 chat opacity `.35`，overlay active 时 chat 禁止 pointer events。Sidebar 260↔48 使用 Framer Motion `200ms easeInOut`。

## 会话页纵向结构

1. Active session header：固定参与布局，高 48px。
2. Message scroll：占剩余高度，header 外部独立滚动。
3. Input chrome：滚动区外，底部固定布局；非 compact `0 24px 31px`。
4. 可选 overlay：Todo 位于 composer 上方；来源抽屉/圆桌为 overlay。

`Observed · exact-source · high · SRC-016, SRC-017, SRC-018`

## Header

- 高 48px；active session 内层 `padding: 0 16px`。
- 标题 14/22/400，最大 `min(520px,52vw)`；自动化 badge 10px、radius4。
- 操作按钮 32×32、radius8、间隔8；顺序：收藏 / 分享 / divider / 智能看板 / 自动化 / 我的文件。
- Active/hover 背景来源代码为 `#0b0b0b1a`；这是源码裸值例外，dark 实际视觉待验证。
- 滚动超过 4px 后 header 背景转 `bg-primary`，180ms。
- 无 active session 且无右 panel 时工具可显示 13px label；右 panel 关闭后延迟 300ms 恢复 label，避免宽度动画冲突。

`Observed · exact-source · high · SRC-018`

## 消息滚动

- `padding: 24px 24px 32px`，`scrollbar-gutter: stable both-edges`。
- 内容列 max 900px，消息间距 24px。
- 用户消息最大宽 82%；assistant 满宽。
- 最新用户消息可置顶并保留 30px；运行中的 assistant 让 spacer 归零。
- 流式增长仅在用户仍处于逻辑底部时跟随。

`Observed · exact-source · high · SRC-009, SRC-020`

## Composer

- max-width 900px；min-height 116px；radius16；0.5px border。
- 输入区 min-height60/max-height160；14/22。
- toolbar padding8；附件按钮32×32/radius10；发送34×34/radius17。
- 输入有内容/运行时发送按钮 `#DE6A43`；空态走主题中性色。
- 下方 10px 间距后显示 11/16/500 免责声明。

`Observed · exact-source · high · SRC-010, SRC-016`

## 空会话首页

- 28px 点阵；光标附近 300px 高亮 mask、320px spotlight。
- 主布局 max 1180px、左右32、gap32；标题 max800、30/38/600、居中。
- 推荐卡 max800、padding `8 16 12`、0.5px border、radius16。
- 分组 tab 高至少38、gap24；问题行 min39、14/22；最多5条，5s 自动轮换。
- 760px 下布局左右18、gap24、标题28/36、卡片radius14。

`Observed · exact-source · high · SRC-016, SRC-040`

## 右面板组合

App 在 chat 与右面板之间不加 gap；视觉间隔来自 right region 的 8px 四边 padding。Drawer 自身 radius6、0.5px border。禁止把右文件区改成贴边直角 split pane。
