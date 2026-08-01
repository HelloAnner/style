# 完整对话工作台源码映射

| 范围 | 精确规则 | 来源 |
|---|---|---|
| App shell | sidebar 260/48、chat min400、right 50%/min480/inset8 | SRC-015 |
| Chat header | 48px、32px actions、title14/22、scrolled surface | SRC-018 |
| Thread composition | header outside scroll、composer outside scroll | SRC-016, SRC-017 |
| Message list | max900、padding24/24/32、gap24、scroll policy | SRC-009 |
| User message | max82%、padding12×16、radius6 | SRC-020 |
| Assistant/message cards | runtime state composition and ordering | SRC-019 |
| Sidebar shell | expanded anatomy and source state wiring | SRC-022 |
| Brand | 56px, title18/26/600, action32 | SRC-023 |
| Agent list | item36, padding7/28/7/12, icon16 | SRC-024,025 |
| New session | item36, brand orange, hover soft | SRC-026 |
| Session groups/items | group12/20, item36, current/unread/generating/menu | SRC-027,028 |
| Sidebar footer/user | showcase38, actions32, user36 | SRC-029,036 |
| Collapsed sidebar | rail48, action32, tooltip/flyout offsets | SRC-037,038 |
| Workspace drawer | header, scope, upload, search, batch, grid/list state | SRC-030,031 |
| File grid | grid min180, preview120, list columns, hover | SRC-032 |
| File icons | type mapping + product asset originals | SRC-033,034,039 |
| Loading | eight skeleton cards, 1.5s pulse | SRC-035 |

全部结论：`Observed · exact-source · high · desktop`。EVD-005/006 是档案参考实现渲染，不是来源产品 baseline。
