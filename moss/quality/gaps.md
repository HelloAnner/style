# 已知缺口

## GAP-001 — dark 设计值与运行态冲突
- 事实：SRC-001 有完整 dark 值；SRC-002 强制所有设置为 light。
- 影响：dark 只能称 exact-source Token，不能称来源运行态 validated。
- 关闭：REQ-001 / TODO-011。

## GAP-002 — 无来源产品视觉 baseline
- 当前证据：42项来源登记/资产 + 思维链参考 EVD-001..004 + 完整工作台参考 EVD-005..006。
- 影响：不能发现运行时 CSS 覆盖、真实字体和组合差异。
- 关闭：REQ-001 / TODO-012。

## GAP-003 — 移动端未知 `closed`
- 当前证据：App 有 MobileUnsupportedGuard；响应式规则文档路径缺失。
- 影响：390px 规则仅能标 Recommended。
- 关闭：2026-08-06 定论——Guard 规则（≤960+coarse+无 hover→不支持页）即产品移动端策略；桌面窄窗不拦截；showcase 无适配实证（EVD-015/016）；superadmin 860 与看板 560-1180 内部断点记录。见 evidence/runtime-2026-08-06/README.md。

## GAP-004 — 字体许可与实际 CJK face `closed`
- 当前证据：字体 CSS 与本地 woff2 存在，但未归档二进制、未采集 FontFace loaded 状态。
- 影响：换行、字宽、视觉一致性和权利不确定。
- 关闭：2026-08-06——产品 README 声明 SIL OFL；114 woff2 SHA-256 记录（SRC-066，二进制不归档）；运行时 114 FontFace（Inter 7/JetBrains Mono 6/Noto Sans SC 101 切片）与 13 loaded face 记录。残余：OFL 全文不在仓库，需时从 Google Fonts 获取。

## GAP-005 — 状态长尾 `closed`
- 缺少：hover、focus-visible、timeout、cancelled、subagent、widget、长工具链、sidebar flyout/menu/rename、文件 batch/preview/error 的真实组合。
- 影响：核心组件状态矩阵 partial。
- 关闭：2026-08-06——analysis/state-matrix.md 全区域源码精确状态矩阵 + 公开路由运行验证（EVD-007..034）；登录态组合状态的运行验证并入 GAP-002。

## GAP-006 — 可访问性
- 事实：部分 CSS 尊重 reduced-motion；全局 focus outline 被移除，Framer Motion 分支不完整。
- 影响：键盘焦点和减弱动效行为不能验收。
- 关闭：TODO-016；修复需用户批准并记录偏差。2026-08-06 进展：focus-visible 仅存 dashboard.css(5)/SuperAdminLayout.css(2) 已记录；13 处 reduced-motion 媒体查询已清点（state-matrix.md §4）；剩余为登录态键盘审计。

## GAP-007 — 档案范围仅覆盖对话工作台，其余路由/组件未归档 `closed`
- 事实（2026-08-01 后复查，commit 195a663d 未变）：前端实际有 86 个页面文件（admin 22、superadmin 42、auth 7、share 7、boards/settings/showcase/onboarding/feishu/legacy 等）与未归档组件目录 Agent(5)、Automation(5)、Billing(2)、modals(2)、Project(3)、Skills(2)、superadmin(2)、Tools(4)；common/ 36 个共享组件中仅归档 ThemeProvider。2026-08-06 已归档右侧看板（pages/boards + Dashboard + inputs，SRC-043..045）。
- 影响：若用户要求“参考 moss”做管理后台、设置、分享页、看板、圆桌等新业务，档案无证据可严格复刻。
- 关闭：2026-08-06 用户确认全量范围，SRC-046..065 归档剩余全部组件/页面/lib 共 176 文件，并新增四份区域分析（TODO-024）。残余风险：逐文件视觉 baseline 仍缺（GAP-002），admin/superadmin 深层组件状态矩阵未展开（GAP-005）。
