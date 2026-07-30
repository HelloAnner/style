# 严格实现指南

## 1. 启动门禁

1. 读取 `../manifest.json`；当前不是 `complete`，必须向用户说明目标范围是否落在缺口中。
2. 确定 `surface = product | marketing`。
3. Product 再确定 `theme = light | dark`。
4. 建立业务语义 → 档案组件/Token 映射表。
5. 目标涉及未覆盖组件/状态时，先补采或取得用户对 Recommended 扩展的许可。

## 2. Product 接入

### 字体

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

代码使用 JetBrains Mono/SF Mono/Menlo。严格跨平台中文一致性尚被字体授权/回退规则阻塞；不要偷偷换成另一中文字体。

### Token

- 读取 `tokens.json` 获取共享与 mode；
- 或单独读取 `themes/<theme>.tokens.json` 的完整 `cssVariables`；
- Web 可直接加载 `themes/<theme>.css`；
- `<html data-theme="light|dark">` 是主题作用域；
- localStorage key 为 `corevo-theme`，来源默认 dark；
- 自动化测试必须在导航前设置 storage，避免先出现 dark 再切 light。

主题文件有 449/453 个当前生产运行时 CSS 变量。不得只复制摘要中的十几个颜色。

### 全局前提

```css
* { box-sizing: border-box; }
html { font-size: 16px; -webkit-font-smoothing: antialiased; }
body { margin: 0; background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; }
```

Scrollbar 8px、thumb radius4；focus 视觉需按来源组件实现，不能依赖浏览器默认。

### 实现顺序

1. 字体和图标；
2. 完整主题 Token；
3. canvas、BackgroundDecoration、层级；
4. 12px 应用布局与 Sidebar；
5. 56px Chat Header；
6. Avatar、Button、Input、Surface；
7. MessageList / MessageBubble / Composer；
8. Main Stage 与业务页面模式；
9. loading/error/empty/open/selected/hover/focus；
10. 768px mobile 行为；
11. 两主题视觉回归。

登录页需要小人时，不重新绘制：直接使用
`../examples/reference/login-mascot/WufanLoginMascot.tsx`，并读取同目录
`spec.json`。来源面板必须以 `z-index: 2` 覆盖角色；移动端不渲染。

对话页优先复用 `../examples/reference/chat-page/WufanChatPage.tsx` 与
`wufan-chat.css`，不要从旧源码重新拼装 Sidebar。零构建 `demo.html` 可用于先核对主题、
任务列表、消息区、Composer、六态工具链、反馈、右面板、工作室/文件预览与执行通知。数据接入前必须同时读：

- `runtime-contract.md`：过程快照、事件顺序、重连和安全边界；
- `interaction-contract.md`：反馈 PUT/DELETE、Wufan 文件 API、右面板数据和 notification 事件；
- `runtime-contract.schema.json` / `interaction-contract.schema.json`：机器校验。

不要把后端 raw reasoning 映射到 `note.content`；只接收服务端脱敏的展示摘要。工具行只接收
安全 `summary`，不接收 arguments/result/authorization。

## 3. Product 基准几何

- outer padding/gap 12；Sidebar 240/56；
- Main Stage flex1.5/min480；Chat flex1/min400；
- Header 56；当前生产 Message max960（旧本地源码 max880）；Composer max800；
- icon button 28/32, r8；Avatar 24/32/40；
- bubble padding14/r16/body14/1.6；
- Composer r16，textarea 24–160；
- trace summary 34；note/tool row 30；反馈 action24/r4；点踩 popover300；
- 右面板 380–560/约 50%；工作室 Header56、tab36、canvas file cell160；执行通知340；
- spacing 与 radius 只使用档案比例尺。

## 4. Marketing 接入

加载 `marketing.css`/`marketing.tokens.json` 和对应字体。Hero 必须保留 Fraunces、抽象动画、72px nav、动态 page pad 和白色 pill CTA。移动不是桌面缩放，而是单列重排。不要接入 Product light mode。

## 5. 当前版本冲突

- 用户源码 commit 早于线上部署；当前运行时优先 `SRC-012/013`；
- `WhatsNew.tsx` 源码是旧 560px modal，当前线上/截图是 tabbed updates center；
- 源码 Logo 仍含 Moss，当前视觉为悟帆 AI 字标；
- 本地 `AuthPage.tsx` 没有当前登录小人；聊天 `EmptyState` 的流体头像也不是它；
- 复刻当前产品时不得照搬这些旧组件。登录小人以 SRC-013/EVD-006/参考组件为准。

## 6. 禁止近似

- 禁止框架默认色、字体、阴影和 radius；
- 禁止将 Marketing 与 Product 变量混合；
- 禁止用系统色彩偏好代替 `data-theme`；
- 禁止用截图作背景伪装组件；
- 禁止用截图背景或普通圆形近似登录小人；
- 禁止忽略 hover/focus/loading/error/open；
- 禁止把 99% 相似度当作没有未解释差异。

## 7. 验证环境

基准自动采集：Chromium 141.0.7390.37、Playwright 1.56.1、locale zh-CN、Asia/Shanghai、DPR1、1440×900 与 390×844。用户产品截图疑似 DPR2；在用户确认前只用于结构和视觉证据。

运行 `../examples/reference/capture-public.mjs` 可重采公开页面；运行 `analyze-images.py` 可重建元数据、色板与裁切；运行 `build-tokens.py` 可从计算样式重建 Token。

## 8. 交付报告

记录档案 version/commit、surface/theme、组件映射、裸值扫描、测试环境、baseline/actual/diff、未覆盖范围、Recommended 扩展和全部批准偏差。只有目标范围无未解释差异，结论才可写 `exact within validated scope`。
