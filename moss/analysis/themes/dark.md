# Dark 主题

## 核心语义

| 语义 | 值 |
|---|---|
| canvas/chat | `#0A0A0F` |
| secondary / tertiary / elevated | `#121218` / `#16161C` / `#1A1A20` |
| text primary / secondary / tertiary | `#FAFAFA` / `#E4E4E7` / `#A1A1AA` |
| muted / disabled | `#71717A` / `#52525B` |
| border subtle / default | `rgba(255,255,255,.04)` / `rgba(255,255,255,.08)` |
| user bubble / agent bubble | `#1A1A20` / `#16161C` |
| brand / send | `#E86A45` / `#DE6A43` |
| file/link | `#60A5FA` |

`Observed · exact-source · high · dark · SRC-001`

这些值是源码事实，不是从 light 反色推断。冲突：`SRC-002` 会把所有主题设置归一为 light，因此当前真实产品 dark 运行态不可达。

`Observed conflict · exact-source · high · dark · SRC-001, SRC-002 · GAP-001`

参考截图 `EVD-002`、`EVD-004` 只验证档案实现。
