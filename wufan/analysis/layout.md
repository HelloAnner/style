# 布局规范

## Product 桌面

### 应用壳层

源码布局：视口高度 `100vh`、overflow hidden，外层 `padding: 12px`，面板 `gap: 12px`。`Observed · exact-source · high · SRC-004`

```text
Sidebar 240px (collapsed 56px)
+ optional Main Stage flex 1.5 / min-width 480px
+ Chat flex 1 / min-width 400px
```

- Main Stage 关闭时 Chat 占满剩余区域；
- Workspace/Dashboard/Opportunity 可全屏，Chat 隐藏；
- Sidebar、Chat、Main Stage 独立滚动；
- Sidebar 为 16px 圆角面板、1px 极淡边框；
- Header 高 56px，水平 padding 16px；
- 当前生产聊天内容最大宽 960px（旧本地源码为 880px），常见水平 padding 24px；
- Composer 外层左右 24px、下 16px，内部最大宽 800px。

### 对话右侧面板

- 顶部工作区/执行链/自动化入口互斥；
- 当前固定类面板目标宽度为同一可用舞台的 50%，归档参考限制为 380–560px；
- 右面板内容采用 8px inset，shell radius16；与 Chat 相邻时不另加 12px gap；
- 打开/关闭通过 width/flex-basis 300ms，关闭保留旧内容到动画完成再卸载；
- “执行完成/异常”通知不是布局列：fixed top60/right24，width340，z9999。

`Observed · exact-source cross-version composition · medium-high · SRC-004/013/058, EVD-009`

`Observed · exact-source · high · SRC-002–004`

### 工作室内部

- 顶部标题栏 56px；标题“工作室”，右侧为最大化与关闭；
- 标签栏 36px，常驻“文件画布”不可关闭；文件标签水平 padding12、gap4，active 顶部
  radius12，文件名最大宽 120px；
- 画布分为“共享文件”和当前会话文件两组，带搜索与上传入口；
- 文件标签最多 8 个，优先按 file id 去重，再按 path + level + session id；
- 画布常驻但非 active 时隐藏，非活动文件预览卸载；最大化时占据整个应用舞台。

`Observed · exact-source + local actual · high · SRC-059, EVD-010`

### 截图换算

`SRC-002/SRC-003` 为 3188px Retina 截图。240 CSS px Sidebar 在图中约 480 physical px，支持 DPR≈2 推断；CSS viewport 约 1594px 宽。该换算为 `Inferred · exact-measured · medium`，精确 viewport 元数据仍需用户确认。

## Product 移动

- JS 主断点：`window.innerWidth < 768`；
- Sidebar 不占布局宽度，打开时为 fixed drawer：宽 `min(280px,86vw)`、z-index 31；
- drawer overlay `rgba(0,0,0,.4)`；
- Chat Header 出现 32px 汉堡按钮；
- Workspace 在移动端 fixed full viewport；
- 归档右面板参考统一使用 fixed inset8；关闭时向右滑出；
- Chat/Main Stage min-width 降为 0。

`Observed · exact-source · high · SRC-004`

登录页已在 390×844 双主题观察，但登录后应用没有移动截图，因此响应式行为尚未视觉验证。`Unknown · TODO-007`

## Product 层级

- 背景装饰：fixed、pointer-events none；
- 主面板：relative z10；
- mobile Sidebar overlay z30 / drawer z31；
- Workspace full screen z50；
- drag overlay z50；
- What’s New 源码旧实现 z100，但当前线上实现结构不同。

## Marketing

- Header 桌面 72px；
- page/hero padding：`clamp(28px,4vw,82px)`；
- site max：`min(2080px,92vw)`；
- Hero 桌面有效宽 1324.8px，左右两栏；标题块约 610px；
- CTA 240×62；
- 移动 390px 时导航换行，Hero 变单列：视觉图形 → 标题 → 文案 → CTA；
- 首页 full-page：1440 宽时 7928px 高，390 宽时 8340px 高；
- 定价 full-page：1440×2874、390×4528。

`Observed · exact-measured/runtime · high · SRC-016–019, SRC-028–031, SRC-036–037, SRC-044–045`

## 断点现状

- Product core：768px JS breakpoint；
- 部分业务工作台存在 720/760/980/1100/1120/1180 等局部 CSS breakpoints；
- Marketing 断点定义在独立官网 CSS；
- 不得把局部业务工作台断点误当全局 breakpoint。
