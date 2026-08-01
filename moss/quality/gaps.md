# 已知缺口

## GAP-001 — dark 设计值与运行态冲突
- 事实：SRC-001 有完整 dark 值；SRC-002 强制所有设置为 light。
- 影响：dark 只能称 exact-source Token，不能称来源运行态 validated。
- 关闭：REQ-001 / TODO-011。

## GAP-002 — 无来源产品视觉 baseline
- 当前证据：源码 + 档案参考截图 EVD-001..004。
- 影响：不能发现运行时 CSS 覆盖、真实字体和组合差异。
- 关闭：REQ-001 / TODO-012。

## GAP-003 — 移动端未知
- 当前证据：App 有 MobileUnsupportedGuard；响应式规则文档路径缺失。
- 影响：390px 规则仅能标 Recommended。
- 关闭：REQ-002 / TODO-013。

## GAP-004 — 字体许可与实际 CJK face
- 当前证据：字体 CSS 与本地 woff2 存在，但未归档二进制、未采集 FontFace loaded 状态。
- 影响：换行、字宽、视觉一致性和权利不确定。
- 关闭：REQ-003 / TODO-014。

## GAP-005 — 状态长尾
- 缺少：hover、focus-visible、timeout、cancelled、subagent、widget、长工具链真实组合。
- 影响：核心组件状态矩阵 partial。
- 关闭：TODO-015。

## GAP-006 — 可访问性
- 事实：部分 CSS 尊重 reduced-motion；全局 focus outline 被移除，Framer Motion 分支不完整。
- 影响：键盘焦点和减弱动效行为不能验收。
- 关闭：TODO-016；修复需用户批准并记录偏差。
