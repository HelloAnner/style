# 设计系统产物规范

## 1. 目标

`system/` 是另一个 AI 实现新业务时的主要输入。它必须把分析结果转换成明确、完整、机器可读、双主题分离且可验证的设计规则，而不是仅有审美描述。

权威关系：

1. 原始来源证明事实；
2. `analysis/` 解释事实如何归纳；
3. `system/tokens.json` 定义精确值；
4. 主题展开文件提供无歧义实现输入；
5. `style-guide.md` 和 `implementation.md` 定义使用方式；
6. `quality/acceptance.md` 定义完成结果。

## 2. Token 分层

### Primitive

原始色阶、字号、空间、圆角、阴影等，例如 `color.blue.600`、`space.4`。名称可以描述值族，但必须有来源。

### Semantic

表达用途，例如：

- `color.surface.canvas`
- `color.text.primary`
- `color.border.subtle`
- `color.action.primary.background`
- `color.feedback.danger.text`
- `shadow.overlay.dialog`

实现优先使用语义 Token。名称表达用途，不写 `text.gray` 这类绑定当前颜色的名称。

### Component

只有组件存在稳定局部语义且全局语义不足时增加，例如 `button.primary.background.hover`。不要为每个 CSS 属性无意义创建组件 Token。

## 3. 双主题文件

必须生成：

- `tokens.json`：共享层、语义层、组件层及 light/dark mode；
- `tokens.css`：共享变量与明确主题作用域；
- `themes/light.tokens.json`：解析引用后的完整明色 Token；
- `themes/light.css`：完整明色变量；
- `themes/dark.tokens.json`：解析引用后的完整暗色 Token；
- `themes/dark.css`：完整暗色变量。

每个主题展开文件必须自足，不能只包含相对另一主题的差异。五种表达中的同名语义值必须一致。主题 CSS 作用域必须明确，例如 `[data-theme="light"]` / `[data-theme="dark"]`；是否兼容 `prefers-color-scheme` 按来源系统事实实现。

## 4. 最低 Token 范围

要达到 complete，按来源系统适用范围覆盖：

- `color`: primitive、surface、text、border、icon、action、feedback、overlay；
- `typography`: family、size、weight、lineHeight、letterSpacing、role；
- `space`；
- `size`: control、icon、avatar、container；
- `radius`；
- `border`: width/style；
- `shadow`；
- `opacity`；
- `zIndex`；
- `breakpoint` 与必要的 container；
- `motion`: delay、duration、easing、distance；
- 必要组件 Token。

每个关键 Token 可通过 `$extensions` 或顶层 metadata 关联主题、证据、精确性和置信度。输出给不支持元数据的工具时，不得丢失档案内的追溯信息。

## 5. Token 生成规则

- 先保留 observed 原始值，再归一；不为造出漂亮比例尺隐去例外。
- 相同字面值但语义不同可以保留两个 semantic Token。
- 不同字面值但被误判为同语义时不能强行合并。
- alias 必须可解析且无循环。
- 单位明确；零值是否带单位保持工具兼容性。
- 阴影、字体和渐变使用结构化值，CSS 只是派生表达。
- 未观察到的值不能进入权威 Token；建议值放扩展区并标 Recommended。
- 更新 Token 时同步 CSS、主题展开文件、style guide、验收和 changelog。

## 6. `style-guide.md`

必须包含：

1. 风格一句话定义；
2. 5–10 条视觉指纹；
3. light/dark 概览与主题选择；
4. 色彩、字体、空间、形状、阴影、图标和影像；
5. 栅格、容器、密度、层级和断点；
6. 组件总览和状态语法；
7. 页面模式；
8. 动效；
9. Do/Don't；
10. 品牌专属、可访问性风险和已批准偏差；
11. 证据入口和 Token 引用。

避免只写“简洁、优雅、有呼吸感”。每条高影响描述配精确值或可跳转规则。

## 7. `components.md` 与组件矩阵

组件文档应便于 AI 直接实现，推荐格式：

```md
## Button
### Anatomy
### Sizes and exact geometry
### Typography and icon rules
### Token mapping
### Variants
### Light states
### Dark states
### Content/overflow
### Responsive behavior
### Keyboard/accessibility
### Evidence and confidence
### Do/Don't
```

核心组件至少覆盖：按钮、链接、输入、选择、复选/单选/开关、表单反馈、导航、tab、面包屑、搜索、卡片、列表/表格、分页、标签、菜单、tooltip、popover、dialog、drawer、toast/alert、空/错/加载/骨架。不存在的组件用有证据的 n/a 关闭，不能默默省略。

## 8. `implementation.md`

面向实现 Agent，必须说明：

- 应先加载哪些字体/资源和许可证限制；
- 接入 Token 的顺序；
- theme attribute/class、系统偏好、持久化、SSR 和避免闪烁；
- reset、box-sizing、字体渲染等全局前提；
- 基础布局容器和断点；
- primitives → components → patterns → pages 的实现顺序；
- 如何处理新业务语义映射；
- 禁止使用的框架默认值和近似替代；
- 测试视口、浏览器、DPR、locale 和字体等待；
- 如何运行组件矩阵和视觉回归；
- 档案缺口及经用户批准的偏差。

## 9. 主题切换

如果来源支持切换，记录：

- 用户手动选择、系统偏好和默认值的优先级；
- 存储键和值；
- HTML 初始标记时机；
- 首屏避免 FOUC/主题闪烁方式；
- 图片、图标、阴影、overlay 和代码高亮是否随主题变化；
- 跨页面持久化；
- 自动化测试如何固定主题。

这些是设计系统的一部分，不能只换 CSS 背景色。

## 10. 语法和一致性验证

- 使用 JSON parser 验证全部 JSON；
- 解析 alias，检查缺失引用和循环；
- 使用 CSS parser/项目构建检查 CSS；
- 生成 light/dark 展开值并与聚合文件逐项比较；
- 扫描实现示例中的裸色值、裸间距和未授权字体；
- 检查文档 Token 名是否存在；
- 将工具、命令和结果写入完成报告。
