# 设计基础

> Product 与 Marketing 是同品牌下两套表面语法，严格复刻时不得混合 Token。

## Product 应用基础

### 字体

- UI：`"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`。`Observed · exact-source/runtime · high · SRC-012, SRC-040, SRC-042`
- 代码：`JetBrains Mono`, `SF Mono`, Menlo, monospace。`Observed · exact-source · high · SRC-004, SRC-012`
- 登录页实测：H1 `28px / 600 / 44.8px`，输入文字 `14px / 400 / 22.4px`。`Observed · exact-measured · high · SRC-040, SRC-042`
- 通用界面常见：Logo 16/600、Header Agent 14/500、任务标题 13/400、消息正文 14/400/1.6、meta 12–13。`Observed · exact-source · high · SRC-004`
- 中文实际 fallback 仍依赖平台与局部 MiSans 规则；严格跨平台复刻需要固定 CJK 字体文件/规则。`Unknown · high impact · TODO-005`

### 空间比例尺

`0, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32px`，对应 `--spacing-0…10`。`Observed · exact-source/runtime · high · SRC-004, SRC-040, SRC-042`

### 圆角

- `8 / 10 / 12 / 16 / 20px`；
- 胶囊使用 `999px`；
- 常用语义：图标按钮 8、任务行/文件卡 10、局部卡片 12、消息/Input/Sidebar 16、大 modal 20。

`Observed · exact-source · high · SRC-004, SRC-012`

### 动效

- fast `.15s`、normal `.2s`、slow `.3s`；
- 默认 easing `cubic-bezier(.4,0,.2,1)`；
- Sidebar 200ms easeInOut；浮层常见 200ms，弹簧感场景会用 `[0.22,1,0.36,1]`；
- reduced-motion 仅在部分引导脉冲中明确覆盖，完整覆盖待验证。

`Observed · exact-source/runtime · high · SRC-004, SRC-012`

### 图标与头像

- 功能图标以 Lucide 线性图标和 24×24 viewBox 内联 SVG 为主，UI 常用 14/16/18px、约 2px stroke；
- Agent 头像 24/32/40px，完全圆形，使用 aurora/sunset/ocean 等多色 CSS 渐变；用户头像同尺寸、首字母、低饱和中性色；
- 高饱和颜色集中在头像、语义反馈和少量主 CTA，其余控件保持中性。

`Observed · exact-source · high · SRC-002–004`

### 层级与效果

- dark：低亮度近黑阶梯 + 极弱白色透明边框 + 12px glass blur；
- light：暖白画布 + 白色 surface + 低透明黑边框 + 8px glass blur + 极轻阴影；
- 大面积紫/蓝光晕仅作 2%–4% 氛围，不承担信息；
- 阴影在 dark 中用于浮层分离，在 light 中极克制。

详见 `themes/light.md`、`themes/dark.md` 和主题 Token。

## Marketing 官网基础

- 画布 `#050509`，正文 `#f5f2ea`，主标题白色；卡片 `#13141a/#0f1117`；
- 强调：violet `#9366ff`、blue `#546cff`、cyan `#79e4ff`、green `#57d9ad`；
- Hero 桌面：Fraunces `77.76px/400/80.8704px`；正文 Inter `18.72px/30.888px`；CTA Outfit `20px/700`、240×62、999px；
- Header 72px；页面 padding `clamp(28px,4vw,82px)`；
- 品牌以纸张白线、紫蓝柔体、编辑式 serif 与 oversized 留白形成表达。

`Observed · exact-measured/runtime · high · SRC-006, SRC-036`

权威文件：`system/marketing.tokens.json`。禁止把 Marketing 的 Fraunces、`#050509` 或 oversized 标题直接用于产品工作台组件。

## 视觉指纹

1. 暖白与近 OLED 黑组成平行主题，而不是纯黑白反色；
2. surface 之间亮度差小，边界靠极淡边框和空间建立；
3. 4/6/8/10/12/14/16 的紧凑节奏；
4. 8–20px 中等圆角，避免夸张卡通大圆角；
5. 控件低饱和，彩色只用于语义、头像和重要动作；
6. 32px 线性图标按钮与 56px Header；
7. 聊天内容中心化，输入框最大宽 800，消息最大宽 880；
8. 桌面 Sidebar 240px，页面外边距/面板 gap 均 12px；
9. 紫蓝渐变 Agent 人格图形是核心品牌触点；
10. Marketing 使用 serif 编辑感，Product 使用 Inter 工具感，二者明确分层。

## 反特征

- 不使用冷纯白 `#fff` 作为 product 画布；
- 不把 dark 主题做成简单反色；
- 不用强边框、大黑投影或高饱和铺底切割所有区域；
- 不用系统默认蓝色按钮替代现有语义；
- 不把官网超大衬线标题带入密集工作台；
- 不使用不同笔画风格的图标库混搭。
