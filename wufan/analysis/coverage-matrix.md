# 覆盖矩阵

枚举：`none | partial | observed | validated | n/a`。`observed` 表示有证据，不表示已通过复刻视觉回归。

## 页面

| 对象 | 类型 | light desktop | dark desktop | light mobile | dark mobile | 状态 | 证据 | TODO |
|---|---|---:|---:|---:|---:|---|---|---|
| Marketing 首页 | page | n/a | observed | n/a | observed | default | SRC-016–019, SRC-036–037 | TODO-012 |
| Marketing 教程 | page | n/a | observed | n/a | observed | default | SRC-020–023, SRC-038–039 | TODO-012 |
| Marketing 定价 | page | n/a | observed | n/a | observed | default | SRC-028–031, SRC-044–045 | TODO-012 |
| 登录页 | page | observed | observed | observed | observed | default | SRC-024–027, SRC-032–035, SRC-040–043 | TODO-012 |
| 新任务空状态 | page | none | observed | none | none | default | SRC-002, SRC-004 | TODO-002,003,007 |
| 对话详情 | page | observed | none | none | none | populated | SRC-003, SRC-004 | TODO-002,003,007 |
| What’s New | overlay | observed | none | none | none | default | SRC-014, SRC-013 | TODO-003,006 |
| Settings | overlay | source + local actual | source + local actual | source-derived | source + local actual | profile/subscription/tabs | SRC-061, EVD-011 | TODO-006,007 |
| Admin platform | page | source + local actual | source + local actual | source-derived | source + local actual | token/feedback/11 tabs | SRC-061, EVD-011 | TODO-006,007 |
| Showcase public | page | source only | source only | none | none | partial | SRC-004, SRC-012–013 | TODO-006,007 |
| Workspace/Dashboard | pattern | source only | source only | none | none | partial | SRC-004 | TODO-006,007 |
| Execution/Automation/Roundtable | pattern | source only | source only | none | none | partial | SRC-004 | TODO-006,007 |

## 核心组件

| 组件 | light | dark | hover/focus | disabled/loading/error | open/selected | 响应式 | 证据 |
|---|---|---|---|---|---|---|---|
| Sidebar | observed | observed | source only | partial source | observed selected | source only | SRC-002–004 |
| Chat Header | observed | observed | source only | n/a | source only | source only | SRC-002–004 |
| Empty State | none | observed | n/a | n/a | tabs observed | none | SRC-002, SRC-004 |
| InputBar | observed | observed | source only | source only | source only | source only | SRC-002–004 |
| Message Bubble | observed | source only | source only | source only | source only | source only | SRC-003–004 |
| Process Trace | observed completed | source-derived | source + local actual | six-state fixture | expanded/collapsed | source-derived | SRC-056–057, EVD-008 |
| Message Feedback | source + local actual | source-derived | source + local actual | submit disabled | selected/revoked | source-derived | SRC-058/060, EVD-009 |
| Right Panel | source + local actual | source-derived | source | skeleton/source | open/closed/switched | source-derived | SRC-004/013/058, EVD-009 |
| Workspace Studio | source + local actual | source + local actual | source + local actual | loading/slow/error fixture | canvas/tabs/maximized | source + local actual | SRC-059, EVD-010 |
| Execution Notice | source + local actual | source-derived | hover timer | success/failed/updated | enter/leave/detail | responsive local | SRC-058/060, EVD-009 |
| Account Settings | source + local actual | source + local actual | source + local actual | mock loading/content | seven tabs | source-derived local | SRC-061, EVD-011 |
| Admin nav/cards/table | source + local actual | source + local actual | source + local actual | source + fixtures | eleven tabs | source-derived local | SRC-061, EVD-011 |
| Button/Input/Login card | observed | observed | source/runtime CSS | partial | default | observed | SRC-024–027, SRC-032–035, SRC-040–043 |
| Login Mascot | observed | observed | pointer gaze exact-source | n/a | blink/float exact-source | mobile n/a（隐藏） | SRC-013, SRC-024–025, SRC-032–033, SRC-054–055, EVD-006 |
| What’s New tabs/cards | observed | none | none | none | observed | partial crop | SRC-014, SRC-013 |
| Dialog/Popover/Drawer | source only | source only | source only | source only | source only | none | SRC-004, SRC-012–013 |
| File/Code/Table/Chart | source only | source only | source only | source only | source only | partial source | SRC-004 |

## 主题基础

| 范围 | light | dark | 结论 |
|---|---|---|---|
| Product runtime CSS variables | observed 453 | observed 449 | 精确运行时集合，尚未全组件验证 |
| Product screenshots | partial | partial | 页面未成对 |
| Marketing | n/a | observed | 固定暗色独立表面 |
| desktop | partial | partial | 登录和官网较好；登录后产品不足 |
| mobile | login only | login + marketing | 登录后产品不足 |
| motion | none | partial | 仅源码/静态暂停截图 |
| accessibility | partial | partial | 尚未执行完整键盘与对比度验证 |

## 可运行参考实现

此表只描述档案内代码的本地运行覆盖，不把 actual 当成来源 baseline：

| 参考 | light desktop | dark desktop | light mobile | dark mobile | 交互 | 来源限制 |
|---|---:|---:|---:|---:|---|---|
| `examples/reference/chat-page/` | actual | actual | actual | actual | 主题、发送、drawer、trace 六态、反馈、右面板、工作室/文件预览、执行通知通过 | dark populated/mobile 及新增交互无同状态原图；EVD-007/008/009/010 |
| `examples/reference/login-mascot/` | actual | actual | n/a | n/a | 漂浮、眨眼、视线通过 | mobile 来源明确不渲染；EVD-006 |
| `examples/reference/account-admin/` | actual | actual | source-derived actual | source-derived actual | Settings 七标签、运营入口、Admin 11 标签、Token/feedback 通过 | 无真实登录态截图；mobile 为显式适配；EVD-011 |
