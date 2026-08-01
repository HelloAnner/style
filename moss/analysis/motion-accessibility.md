# 动效与可访问性

## 动效

| 触发 | 参数 | 证据 |
|---|---|---|
| 运行标题扫光 | `1.4s linear infinite`，180% 背景 | SRC-001,004 |
| 时间线 spinner | `1s linear infinite` | SRC-001,004,005 |
| 过程节点迁移出现 | height 0→auto, opacity 0→1, y 12→0；`180ms easeOut` | SRC-004 |
| 正文出现/段切换 | `180ms easeOut`；退出 y -12 | SRC-008 |
| 新消息 | opacity 0→1, y 20→0；`300ms easeOut` | SRC-009 |
| 完成 chevron | rotate 180°；`150ms` | SRC-003 |
| 特殊工具卡片 | x -16→0；`280ms easeOut`；shimmer 2s | SRC-006 |

## Reduced motion

`globals.css` 禁用运行标题、spinner、部分 badge 动画；但 Framer Motion 的过程节点、正文和消息入场没有统一 reduced-motion 分支。

`Observed risk · exact-source · high · shared · SRC-001, SRC-004, SRC-008, SRC-009 · GAP-006`

## 键盘与语义

- 完成折叠与“更多”使用原生 button；完成 toggle 有 title。
- 运行空态有 `role=status` / `aria-live=polite`。
- spinner 多为 `aria-hidden`，状态由文本表达。
- 思维链滚动区隐藏视觉滚动条；键盘可滚动性和 focus-visible 未做真实浏览器验证。

## 风险

- 全局 `input:focus, textarea:focus, button:focus { outline:none }`，未见统一 focus-visible 替代，存在焦点不可见风险。
- Dark 运行态不可达，无法验证对比度与 hover/focus。
- 参考移动实现隐藏耗时属于建议扩展。

严格复刻时先保留来源事实；若用户批准修复，记录偏差并补 `:focus-visible` 与完整 reduced-motion。
