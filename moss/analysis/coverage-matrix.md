# 覆盖矩阵

`observed` 表示源码精确观察；`validated*` 仅表示档案参考实现成功渲染，不代表来源产品视觉回归。

| 对象 | 类型 | light desktop | dark desktop | light mobile | dark mobile | states | evidence | open TODO |
|---|---|---|---|---|---|---|---|---|
| App shell | pattern | observed | observed | none | none | sidebar/right-panel/maximize | SRC-015 | TODO-011,013 |
| Expanded sidebar | pattern | observed | observed | none | none | agent/current/unread/generating/hover | SRC-022..029 | TODO-012,015 |
| Collapsed sidebar | pattern | observed | observed | none | none | tooltip/flyout/disabled/active | SRC-037,038 | TODO-012,015 |
| Session header | component | observed | observed | none | none | new/active/scrolled/actions | SRC-018 | TODO-012,015 |
| Empty conversation home | pattern | observed | observed | partial | partial | tabs/rotation/hover | SRC-016 | TODO-012,013 |
| Message list | pattern | observed | observed | partial | partial | scroll/streaming | SRC-009, EVD-001..006 | TODO-012,013 |
| Assistant frame | component | observed | observed | partial | partial | default | SRC-007 | TODO-012 |
| Reasoning trace | component | observed | observed | validated* | validated* | running/completed/collapsed/expanded | SRC-003..005 | TODO-011,012,015 |
| Tool action row | component | observed | observed | validated* | validated* | pending/running/streaming/completed/failed | SRC-004,005 | TODO-015 |
| Assistant body | component | observed | observed | partial | partial | empty/streaming/completed | SRC-008,019 | TODO-015 |
| User bubble | component | observed | observed | partial | partial | default/attachment/question | SRC-020 | TODO-015 |
| Composer | component | observed | observed | partial | partial | default/active/running/upload/error | SRC-010,016 | TODO-013,015 |
| File drawer | pattern | observed | observed | none | none | scope/search/upload/batch/preview | SRC-030,031 | TODO-011,012,015 |
| File grid/list | component | observed | observed | none | none | grid/list/hover/referenced/selected/loading | SRC-032..035,039 | TODO-011,012,015 |
| Full conversation reference | validation | validated* | validated* | n/a | n/a | sidebar+chat+files | EVD-005,006 | TODO-012 |
| Font loading | foundation | partial | partial | partial | partial | Inter/mono/CJK fallback | SRC-013,014 | TODO-014 |
| Reduced motion | foundation | partial | partial | partial | partial | core CSS + home | SRC-001 | TODO-016 |

移动列的 `none/partial` 反映来源产品事实不足；不能以参考实现补成 observed。
