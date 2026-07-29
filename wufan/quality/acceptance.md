# 悟帆 AI 严格复刻验收

> 当前为验收规范，不代表全部已通过。逐项附 baseline、actual、diff 后才能勾选。

## 启动与范围

- [ ] 记录使用的档案 version/commit、surface、theme 和目标页面。
- [ ] manifest 为 complete，或用户已明确接受当前缺口。
- [ ] 业务语义映射到已有 Token/组件，没有未说明自创视觉值。

## Product 基础

- [ ] Light canvas 精确为 `#FAF9F7`，Dark 为 `#0A0A0F`。
- [ ] 加载真实 Inter/代码字体，验证无意外 fallback；中文策略已确认。
- [ ] 使用完整主题展开 Token，没有跨主题引用。
- [ ] spacing 仅来自 0/4/6/8/10/12/14/16/20/24/32。
- [ ] radius 仅来自 8/10/12/16/20 或明确 pill。
- [ ] 边框、glass、shadow 使用主题精确值。
- [ ] 图标体系、尺寸、stroke 与 Lucide/来源内联 SVG 一致。

## Product 布局

- [ ] Desktop outer padding/gap 12、Sidebar 240/56、Header 56。
- [ ] Main Stage/Chat 比例和 min-width 正确。
- [ ] 当前生产 Message max960（若复刻旧 `14394dc` 才为 880）、Composer max800。
- [ ] `<768px` Sidebar drawer、overlay、mobile Header 和 full-screen Workspace 正确。
- [ ] 长文本、滚动、空数据、溢出和窄屏不破坏结构。

## Product 组件

- [ ] Sidebar anatomy、任务层级、active、hover 与底部用户区一致。
- [ ] Empty State 的渐变人格形象、tabs、标题和 Composer 一致。
- [ ] Message 的 32px avatar、12px gap、14px padding、16px radius、14/1.6 正确。
- [ ] Composer empty/active/upload/drag/running/error 状态完整。
- [ ] 图标按钮 28/32/r8，发送按钮 light/dark 反向正确。
- [ ] dialog/popover/drawer/tooltip/toast 的 overlay、层级、进入/退出与焦点正确。
- [ ] 当前 What’s New 使用线上 tabbed 结构，而非旧源码 modal。
- [ ] 登录小人直接使用 exact-source SVG：240×300、正确面板覆盖、三段渐变、双眼、随机眨眼、5s 漂浮与受限视线跟随；mobile 不渲染。
- [ ] 对话工作区直接核对 `examples/reference/chat-page/`：Sidebar/任务列表、Header、Message、Composer 和 light/dark 变量无静默改值。

## 状态与交互

- [ ] light/dark 的 default、hover、focus-visible、active、selected 分别验收。
- [ ] disabled、loading、error、empty、open/closed 分别验收。
- [ ] 键盘顺序、焦点恢复、Esc、dialog trap 可用。
- [ ] reduced-motion 不保留危险或不必要循环动效。
- [ ] 触控目标和 hover-only 功能有移动替代。

## Marketing

- [ ] 使用独立 marketing Token，不混入 Product mode。
- [ ] 画布 `#050509`、纸白 `#f5f2ea`、Fraunces Hero 和 Outfit CTA 正确。
- [ ] Header 72px、page pad clamp、Hero 双栏/移动单列正确。
- [ ] 抽象对象动画、白线、紫蓝强调和白色 pill CTA 一致。

## 视觉回归

- [ ] 主题、viewport、DPR、浏览器、字体、locale、数据和滚动位置与 baseline 一致。
- [ ] 每个目标保存 baseline、actual、diff 和指标。
- [ ] Light desktop/mobile 均通过。
- [ ] Dark desktop/mobile 均通过。
- [ ] 核心组件状态矩阵通过。
- [ ] 0 个未解释差异；环境抗锯齿容差单独记录。

## 权利与偏差

- [ ] Logo、字体、源码和素材有明确使用/发布权。
- [ ] 没有真实用户数据、凭据或未授权业务文案。
- [ ] 所有可访问性修正、技术替代和 Recommended 扩展已获用户批准。
