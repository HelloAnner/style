# EVD-007：对话工作区源码映射

## 目标

将当前悟帆对话页面整理为可供其他系统直接引用的代码，而不复制私有业务逻辑、真实用户数据或含个人信息的原图。

## 版本判断

- 本地源码：`/Users/anner/fine/ai/corevo`，commit
  `14394dc7ca16aa13c62e8a089c6ffff4953424f3`；
- 当前生产资产：`SRC-012/013`；
- 生产包含当前“悟帆AI”Logo、导航文案和更新后的聊天几何，本地 commit 中部分组件较旧；
- 冲突时采用：生产 CSS/JS → 当前用户截图 → 本地源码结构。

`Observed · exact-source/runtime · high · SRC-003–004, SRC-012–013`

## 可读组件映射

| 参考组件 | 来源结构/符号 | 当前值 | 证据 |
|---|---|---|---|
| `WufanChatPage` | App canvas / ChatContainer | 100dvh、12px inset/gap | SRC-004, SRC-013 |
| `Sidebar` | `cvo-sidebar-inner` | 240px、r16、主题 surface | SRC-002–004, SRC-013 |
| `WufanLogo` | 当前生产内联 SVG | 精确 path/circle + 悟帆AI | SRC-013 |
| Primary nav | 当前生产 Sidebar | 36px、13px、r10、gap2 | SRC-002–003, SRC-013 |
| Session list | 当前生产 Sidebar | 35px、13px、r8、8px margin | SRC-003, SRC-013 |
| `ChatHeader` | ChatContainer header | h56、px16、14/13 文本 | SRC-002–004, SRC-013 |
| MessageList | 当前生产容器 | max 960、px24、py16、gap16 | SRC-003, SRC-013 |
| MessageBubble | MessageBubble / AgentMessage | avatar32、gap12、p14、r16、14/1.6 | SRC-003–004, SRC-013 |
| Agent avatar | 生产头像渐变集合 | nebula conic gradient | SRC-004, SRC-013 |
| Composer | InputBar / current bundle | max800、r16、textarea 24–160 | SRC-002–004, SRC-013 |
| Mobile drawer | Sidebar/App source | `<768px`、`min(280px,86vw)` | SRC-004 |

## 双主题

示例把 light/dark 作为独立变量展开，不执行算法反色：

- light：`#FAF9F7/#FFFFFF/#FAFAFA/#F0EFED`；
- dark：`#0A0A0F/rgba(18,18,24,.5)/#27272A/#1A1A20/#16161C`；
- active send 在两个主题中黑白反向；
- 边框分别使用黑 6%/4%/3% 与白 4%/3%/2%。

`Observed · exact-source/runtime · high · SRC-012, SRC-040, SRC-042`

## 脱敏与发布边界

- `mock-data.tsx` 和 `demo.html` 使用新写的通用空间信息，不包含 SRC-003 的会话文本；
- 示例不引用 `SRC-002/003` 原图；
- 没有复制 private store、API client、认证、tenant、文件上传或业务 schema；
- 只恢复页面结构、视觉 Token、通用交互和公开生产包中可观察的图形；
- 用户本轮明确要求把对话页面代码放入 wufan 供其他系统复刻；该授权仅覆盖派生的脱敏参考代码，不扩展到私有源码或原始 PII 截图的公开发布。

## 已验证与未知

### 已验证

- React 文件边界和 TypeScript 结构；
- light/dark 确定性主题切换；
- desktop Sidebar、Header、消息和 Composer 几何；
- Composer empty/active 与本地发送；
- `<768px` drawer 打开/关闭；
- 使用脱敏 mock 数据运行。

### 仍未知

- dark populated chat 的同状态像素 baseline；
- 登录后 mobile 的实际线上视觉；
- 当前生产未压缩源码的完整映射；
- streaming、upload、drag、questionnaire、plan review、error 等全部状态；
- 中文字体跨平台完全一致性。

因此结果为
`Observed · exact-source reference · pass within runnable chat-page scope`，不提升整个档案的
`analyzed` 状态。
