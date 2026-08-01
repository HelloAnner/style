# 覆盖矩阵

`observed` 表示源码精确观察；`validated` 仅表示档案参考实现已渲染，不代表来源产品视觉回归。

| 对象 | 类型 | light desktop | dark desktop | light mobile | dark mobile | states | evidence | open TODO |
|---|---|---|---|---|---|---|---|---|
| App shell | pattern | observed | partial | none | none | default/right-panel | SRC-001 | TODO-013 |
| Message list | pattern | observed | partial | partial | partial | scroll/streaming | SRC-009, EVD-001..004 | TODO-013,015 |
| Assistant frame | component | observed | observed | partial | partial | default | SRC-007 | TODO-015 |
| Reasoning trace | component | observed | observed | validated* | validated* | running/completed/collapsed/expanded | SRC-003..005, EVD-001..004 | TODO-011,015 |
| Tool action row | component | observed | observed | validated* | validated* | pending/running/streaming/completed/failed | SRC-004,005 | TODO-015 |
| Assistant body | component | observed | observed | partial | partial | empty/streaming/completed | SRC-008 | TODO-015 |
| User bubble | component | observed | observed | partial | partial | default/attachment | SRC-001,009 | TODO-015 |
| Composer | component | observed | observed | partial | partial | default/active/running/upload/error | SRC-010 | TODO-013,015 |
| Markdown | component | observed | observed | partial | partial | headings/list/code/table/file | SRC-011 | TODO-015 |
| Font loading | foundation | partial | partial | partial | partial | Inter/mono/CJK fallback | SRC-013,014 | TODO-014 |
| Reduced motion | foundation | partial | partial | partial | partial | spinner/shine only | SRC-001 | TODO-016 |

`validated*`：只验证 `examples/reference/thinking-chain.html`，不是来源产品 baseline。
