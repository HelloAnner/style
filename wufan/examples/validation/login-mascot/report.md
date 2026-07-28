# 登录小人组件验证

- 验证时间：2026-07-29（UTC `2026-07-28T23:00:47Z`）
- 来源：SRC-013、SRC-024–025、SRC-032–033、SRC-054–055、EVD-006
- 实现：`../../reference/login-mascot/`
- 环境：agent-browser 0.8.5、HeadlessChrome 151.0.7922.34、macOS、DPR1
- 结论：**组件范围通过；完整登录页视觉回归仍未完成。**

## 通过项

- Light `1598×961`：根盒 `x=914, y=349.71875, 240×300`，与生产公式
  `right: clamp(384px, 28.4vw, 444px); top: 52%` 一致；
- SVG 属性：`240×300`、`viewBox="0 0 30 38"`；
- 生产三段渐变、ellipse、粉色装饰圆、左右不同尺寸眼睛、瞳孔与高光均存在；
- 鼠标移动后瞳孔坐标改变，且受白眼可用半径约束；
- 运行时观察到随机眨眼状态；
- Dark `1440×900`：组件保持同一 SVG 值，画布切换为 `#0A0A0F`；
- Mobile `390×844`：小人 `display: none`，面板占满 viewport。

## 产物

- Light actual：`login-mascot__light__1598x961__default__actual.png`
- Dark actual：`login-mascot__dark__1440x900__default__actual.png`
- 结构化运行结果：`runtime-metrics.json`

## 未声称的范围

本轮没有把整个登录页标为视觉回归通过。SRC-054/055 是带动态时刻的产品截图，
而本地 demo 只渲染小人与必要遮挡上下文，不包含 slogan、Logo 和表单。因为动效相位、
鼠标位置和周边内容不同，未生成误导性的整页像素 diff。完整登录页 baseline/actual/diff
仍由 TODO-012 约束。
