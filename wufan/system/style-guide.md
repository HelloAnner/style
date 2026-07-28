# 悟帆 AI 权威风格指南

## 使用结论

当前档案已完成第一轮深度采集并达到 `analyzed`，但尚未 `complete`。基础主题和运行时 Token 可精确使用；登录后页面、双主题配对、组件状态和视觉回归仍有缺口。消费 Agent 必须先检查 `../manifest.json` 与 `../quality/TODO.md`。

## 两个表面系统

### Product

用于登录、聊天、Agent、工作台、设置与业务应用。使用：

- `tokens.json`
- `themes/light.tokens.json` / `light.css`
- `themes/dark.tokens.json` / `dark.css`

### Marketing

用于官网、教程、定价、发布叙事。固定暗色，使用：

- `marketing.tokens.json`
- `marketing.css`

**禁止混合**：Marketing 的 Fraunces 大标题、`#050509` 和 purple editorial composition 不直接进入 Product；Product 的暖白/近黑工作台 Token 不替代官网叙事。

## Product 视觉指纹

1. Light canvas `#FAF9F7`，Dark canvas `#0A0A0F`；
2. 暖白/近黑的细微 surface 阶梯；
3. 极淡 2%–6% 单像素边框；
4. Inter 工具排版，14px 正文，1.6 消息行高；
5. 4/6/8/10/12/14/16/20/24/32 空间比例；
6. 8/10/12/16/20 圆角，Sidebar/Input/气泡通常 16；
7. 56px Header、240px Sidebar、12px 外边距与 gap；
8. 线性 14–18px 图标和低饱和控制层；
9. 紫蓝渐变 Agent 头像/流体图形是主要品牌色触点；
10. 内容优先：聊天 880px、Composer 800px、操作栏 hover 才出现。

## Product 核心主题值

| Semantic | Light | Dark |
|---|---|---|
| canvas | `#FAF9F7` | `#0A0A0F` |
| surface | `#FFFFFF` | `#121218` |
| surface subdued | `#F5F4F2` | `#16161C` |
| elevated | `#FFFFFF` | `#1A1A20` |
| text primary | `#1A1A1A` | `#FAFAFA` |
| text secondary | `#3A3A3A` | `#E4E4E7` |
| text tertiary | `#5A5A5A` | `#A1A1AA` |
| text muted | `#7A7A7A` | `#71717A` |
| border subtle | `rgba(0,0,0,.06)` | `rgba(255,255,255,.04)` |
| user bubble | `#F0EFED` | `#1A1A20` |
| agent bubble | `#FFFFFF` | `#16161C` |

完整值以主题 Token 文件为准，不从此摘要手抄不完整集合。

## Product 布局

```text
viewport
└─ 12px inset
   ├─ Sidebar 240px / collapsed 56px
   ├─ 12px gap
   ├─ optional Main Stage flex 1.5, min 480px
   ├─ 12px gap
   └─ Chat flex 1, min 400px
```

移动阈值 `<768px`，Sidebar 为 `min(280px,86vw)` drawer；Workspace 可 full viewport。登录后移动视觉证据仍缺失。

## Product 组件要点

- Header：56px；图标按钮 32×32/r8；
- Sidebar：r16；Header padding 14×12；任务 13px；
- Avatar：24/32/40、圆形；
- Message：gap12、bubble padding14/r16、body14/1.6；
- Composer：max800、r16、textarea 24–160；
- MessageList：max880；
- active send：Light 深底白图标，Dark 白底深图标；
- Modal：r20；backdrop Light .4 / Dark .7。
- Login Mascot：使用 `examples/reference/login-mascot/` 的 exact-source SVG 组件；240×300、三段粉紫蓝渐变、眨眼/漂浮/视线跟随，mobile 不渲染。

详见 `../analysis/components.md`。

## Marketing 指纹

- `#050509` 黑色舞台；
- 米纸白 `#f5f2ea`；
- Fraunces oversized editorial Hero；
- 紫 `#9366ff` / 蓝 `#546cff` / cyan `#79e4ff`；
- 抽象白线、紫蓝柔体与 Lottie；
- 白底深字 pill CTA；
- 72px nav、长滚动品牌叙事。

## Do

- 直接读取精确主题 Token；
- 先映射业务语义，再组合已有组件；
- Light/Dark 分别实现和截图；
- 保留中性控制层，让业务内容成为焦点；
- 使用同笔画 Lucide/内联 SVG；
- 用 Agent 渐变形象提供品牌色；
- 按 source/screenshot 冲突说明选择当前线上规则。

## Don’t

- 不用 `#fff/#000` 粗暴替代 canvas；
- 不把主题做算法反色；
- 不使用框架默认按钮/输入；
- 不增加强边框、重阴影、过大圆角；
- 不把官网 serif 排版用于工作台；
- 不用近似字体或另一图标库；
- 不照较旧源码复刻当前 What’s New；
- 不在未覆盖范围声称完全一致。
- 不把登录小人替换成截图、普通半圆、聊天无眼头像或自绘近似 SVG。

## 证据优先级

当前线上 CSS/计算样式 `SRC-012/SRC-040/SRC-042` → 当前线上 JS/截图 `SRC-013/SRC-002/003/014` → 用户源码 commit `SRC-004` → 推断。完整来源见 `../sources/index.md`。
