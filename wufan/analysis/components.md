# 核心组件规范

> 当前能严格实现基础壳层、主题和主要聊天组件；没有视觉状态证据的部分仍标 source-only，不得声称已验证。

## 1. Logo

- 产品品牌显示“悟帆AI”，当前线上字标使用 Smiley Sans 体系；归档字体见 `SRC-008`；
- 较旧源码 `Logo.tsx` 仍输出圆环图形 + `Moss`，与当前截图冲突，不能作为当前品牌组件直接复制；
- 当前截图图标为左侧弧线/点，文字倾斜修正变量 `--wufan-logo-oblique-correction: 2deg`。

`Observed · exact-source/runtime · high · SRC-002–003, SRC-007–008, SRC-012–013`

## 2. Sidebar

### Anatomy

Logo/Header → 新任务与产品导航 → 分割线 → 任务标题/工具 → 时间分组任务列表 → 底部探索/空间 → 用户与通知。

### Geometry

- 展开 240px，收起 56px；Header 56px；主体 16px radius；
- 当前生产 Header padding `14px 14px 14px 18px`；图标按钮 28×28/radius 8；
- 当前生产导航 min-height 36、padding `0 14px`、radius 10；任务行 min-height 35、
  padding `8px 14px`、radius 8、水平 margin 8；
- 文字：导航 13/400（active 500），任务 13/400，分组 10/500/0.06em；
- 当前项使用 `--hover-bg`，不是品牌色填充；
- 图标以 16–18px、低对比 muted 为主。

### Theme

- light：白 surface、轻 shadow、黑 6% border；
- dark：半透明 `rgba(18,18,24,.5)` + 12px blur、白 4% border；
- 当前截图中的 Sidebar 导航内容比源码 commit 更新，应以截图/线上资产为当前结构。

可读实现见 `examples/reference/chat-page/`。`Observed · exact-source + screenshot · high · SRC-002–004, SRC-013, EVD-001, EVD-003, EVD-007`

## 3. Chat Header

- 高 56px、padding 0 16；当前生产对话 Header 不绘制可见底边，旧本地源码曾有 subtle border；
- 左侧 Agent 14/500 + `/` + 14px 任务图标 + 标题 13/tertiary；
- 右侧图标按钮 32×32/radius 8/gap 4；
- 激活工作区用低透明语义色；普通 hover 使用中性 hover；
- mobile 出现 32×32 hamburger。

`Observed · exact-source · high · SRC-002–004, SRC-013, EVD-007`

## 4. Empty State

- 内容居中，max-width 800；
- 大面积 radial 紫蓝光晕；
- Agent 主图为圆形/流体渐变，高饱和但孤立；
- 标题 hierarchy：问候为 secondary，主句为大号 primary；
- 能力 tabs 为低对比胶囊，active 通过微亮 surface/边框，不用强品牌底；
- Composer 位于视觉中心下方，随后是提示词胶囊。

当前仅 dark desktop 有视觉证据。`Observed · screenshot · high · SRC-002`

## 5. Composer / InputBar

### Geometry

- 外层最大宽 800；页面 padding `4px 24px 16px`；
- 容器 radius 16、1px subtle border；
- textarea 最小 24px、高度自动增长、最大 160px；
- 主截图中复合输入约 1600 physical px 宽（约 800 CSS px）；
- 左下附件/思考/模型，右下发送；placeholder 14/400；
- 快捷建议为 20px radius 胶囊，13px 文本。

### States

- empty send：中性低对比；active send 在 light 为黑底白图标、dark 为白底深图标；
- drag：全屏 overlay + 12px blur；
- file references：26px 高、radius 7；
- upload/error/loading/running/followup 状态存在源码，但缺少完整视觉截图。

完整主路径实现见 `examples/reference/chat-page/`；upload/drag/running/error 未包含在该精简参考中。

`Observed · exact-source + screenshot · high · SRC-002–004, SRC-013, EVD-002, EVD-005, EVD-007`

## 6. Message Bubble

- 行 gap 12；头像 32×32；内容 max-width 85%；
- 角色名 13/500，时间 12/muted，meta 下 margin 6；
- 气泡 padding 14、radius 16；正文 14、line-height 1.6；
- user 右对齐、`bubble.user`、无边框；Agent 左对齐、`bubble.agent`、1px muted border；
- 操作栏 margin-top 4，按钮 26×26/radius 6，hover 才出现；
- 图片附件 radius 12；文件附件 radius 10；文件引用 chip radius 8。

当前生产 MessageList `max-width: 960px`，旧本地源码为 880px。React 与零构建实现见
`examples/reference/chat-page/`。

`Observed · exact-source + light screenshot · high · SRC-003–004, SRC-013, EVD-004, EVD-007`

## 7. Login

### Desktop

- 左侧品牌叙事区 + 中央紫蓝 Agent 圆形角色 + 右侧约 420px 高卡片列；
- 卡片距视口上下 16px，右 16px，内部水平约 48px；
- H1 28/600/44.8；输入文本 14/400/22.4；主题按钮 32×32/radius 8；
- 主按钮 full width、约 44px 高、radius 10；
- light 与 dark 结构完全相同，仅通过语义 Token 映射。

### Mobile

390×844 时仅保留 Logo、表单和底部辅助动作，左侧大字/角色图隐藏。`Observed · exact-measured · high · SRC-024–027, SRC-032–035, SRC-040–043`

## 8. Login Mascot

当前桌面登录页右侧探头的紫蓝小人是独立内联 SVG，不是 PNG，也不是
`ChatContainer.tsx` 中的无眼流体头像。

### Anatomy 与几何

- 根定位：`right: clamp(384px, 28.4vw, 444px)`、`top: 52%`；
- 根变换：`translateY(-50%) scaleX(-1)`，`z-index: 1`；
- 登录面板位于 `z-index: 2`，覆盖小人右侧形成半露效果；
- SVG `240×300`，`viewBox="0 0 30 38"`，`overflow: visible`；
- 身体为 ellipse `cx=6 cy=19 rx=24 ry=19`；
- 装饰圆 `cx=14 cy=1 r=3`、`#EC4899`、opacity `.5`；
- 渐变沿 `(0,0)→(1,1)`：`#EC4899 0% → #8B5CF6 50% → #3B82F6 100%`。

### 眼睛

- 左眼：中心 `17,14`、白眼半径 `3.8`、瞳孔半径 `2.2`、默认偏移 `+1.8,-.5`；
- 右眼：中心 `25,18`、白眼半径 `3.2`、瞳孔半径 `1.8`、默认偏移 `+1.5,-.5`；
- 瞳孔 `#1A1A2E`，高光 `rgba(255,255,255,.85)`；
- 瞳孔最大位移必须限制在 `orbitR - pupilR`，禁止穿出白眼。

### 动效与响应

- 漂浮：Y `0→-5→0px`，`5s easeInOut infinite`；
- 眨眼：随机 `3–7s`，闭眼持续 `150ms`；
- 视线只响应角色左侧 ±70°，200ms 后设置目标，每帧以 `.08` 插值；
- 距离 300px 达到最大视线强度；
- mobile 来源壳层完全不渲染，不是缩小后继续显示。

### 主题与实现

SVG 自身在 light/dark 使用同一组值；主题差异由背景、光晕、面板覆盖和周围文字产生。
直接复用 `examples/reference/login-mascot/WufanLoginMascot.tsx`；完整参数见
同目录 `spec.json` 和 EVD-006。

`Observed · exact-source + paired-theme screenshot · high · SRC-013, SRC-024–025, SRC-032–033, SRC-054–055, EVD-006`

## 9. What’s New（当前线上）

`SRC-014` 显示当前版本为大型更新中心，不是较旧源码中的 560px modal：

- 顶部三 tab：What’s New、消息通知、关注动态；active 黑色 3px underline；
- 次级 filter：全部/未读，active 暖灰胶囊；右侧全读图标；
- 版本 tag 为淡珊瑚底/珊瑚字；日期右对齐 muted；
- Hero card 约 764×418 physical（截图疑似 DPR2），radius≈22 physical；
- 后续更新使用浅蓝 tag、标题 28 physical 左右、正文高行距；
- 线上生产 JS 含相同文案，优先于 commit 中旧 `WhatsNew.tsx`。

`Observed · exact screenshot + deployed source · high · SRC-013–014`

Dark、desktop 外层上下文、hover、tab 切换和滚动状态未覆盖。

## 10. Buttons 与图标

- 图标按钮：28/32px，radius 8；
- 普通按钮中性背景，hover 仅轻微 surface 变化；
- 主行动可用黑白反转；业务特定入口可用蓝/青渐变，但不泛化到所有主按钮；
- 图标 14–18px、stroke 约 2，禁止混用实心粗图标；
- active 状态使用语义色 10%–20% 背景 + 对应纯色图标。

## 11. Modal / Popover / Feedback

权威主题 Token 已覆盖 modal/dropdown/toast/plan/diff/channel 等大量变量。几何需按对应源码/线上 CSS，不可仅使用通用 modal：

- 通用旧 modal radius 20，backdrop light `.4` / dark `.7`；
- overlay shadow light `0 25px 50px -12px rgba(0,0,0,.15)`，dark alpha `.5`；
- 进入通常 200ms opacity + translate/scale；
- 当前线上 What’s New 是结构例外。
