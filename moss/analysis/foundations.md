# 基础规则

## 字体

- UI：`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`。
- 代码：`'JetBrains Mono', 'SF Mono', Menlo, monospace`。
- 思维链：过程说明 14/22/400；工具动作 13/20/400；耗时 11/20 tabular；运行/完成标题 14/22/500。

`Observed · exact-source · high · shared · SRC-001, SRC-004, SRC-005, SRC-014`

中文实际 glyph 可能由系统 fallback 或字体 CSS 中 Noto Sans SC 覆盖；浏览器实际 FontFace 未采集。

`Unknown · unknown · low · shared · GAP-004`

## 空间与形状

共享 space：0, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32px。圆角主序列：8, 10, 12, 16, 20px。思维链有意更像无框时间线：外层无 surface、无 shadow。

`Observed · exact-source · high · shared · SRC-001, SRC-004`

## 颜色策略

中性色承担 90% 视觉层级；橙只用于品牌文字、发送按钮和少量强调；蓝用于链接/信息来源；反馈色仅用于语义状态。Light 使用暖米白，不是 `#fff` canvas；dark 使用蓝黑近黑，不是纯黑。

`Observed · exact-source · high · light+dark · SRC-001`

## 图标

思维链状态图标由内联 SVG/CSS 构成：完成 14px 圆勾，失败 14px 圆形警告，运行 15px/14px 锥形 spinner。工具种类使用 12.5–14px 产品路径，不统一缩放为同一 Lucide glyph。

侧栏、文件抽屉和文件类型使用来源导出的 SVG/PNG 资产；59 个原件与逐文件哈希保存于 `sources/source-code/assets/`。消费时应优先复用这些原件，不以 emoji 或通用 icon 猜测替换。

`Observed · exact-source · high · shared · SRC-004, SRC-005, SRC-039`

## 层级

正文 surface 有 1px subtle border；composer 用 0.5px border + 极轻阴影；思维链连接线是 `1.25px border.default`。不要用阴影替代思维链结构线。
