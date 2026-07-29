# 悟帆对话工作区参考实现验证

- 时间：2026-07-29T00:04:40Z
- 运行器：agent-browser 0.8.5
- locale / timezone：zh-CN / Asia/Shanghai
- 页面：`examples/reference/chat-page/demo.html`
- 状态：`pass within runnable reference scope`

## 验证结果

| 范围 | 结果 | 说明 |
|---|---|---|
| Light desktop 1594×974 | pass | 12px inset/gap、240 Sidebar、56 Header、960 MessageList、800 Composer 和主题色均符合当前生产/截图证据 |
| Dark desktop 1594×974 | pass with evidence limitation | exact runtime Token 和相同组件树正确；缺 dark populated 原图，不能写 pixel-diff pass |
| Light mobile 390×844 | source-behavior pass | Header、消息、Composer 和 drawer 本地运行通过；无登录后线上 mobile baseline |
| Dark mobile 390×844 | source-behavior pass | 主题值和 responsive 组合正确；无登录后线上 mobile baseline |
| Theme toggle | pass | `light ↔ dark` 确定性切换，不使用算法反色 |
| Composer | pass | empty send disabled；输入后 active；dark 发送为白底深图标；发送后消息数 2→3 |
| Sidebar drawer | pass | 390px 时关闭在视口外，打开为 280×828、8px inset、scrim opacity 1 |

精确运行值见 `runtime-metrics.json`。

## Actual

- `chat-page__light__1594x974__populated__actual.png`
- `chat-page__dark__1594x974__populated__actual.png`
- `chat-page__light__390x844__populated__actual.png`
- `chat-page__dark__390x844__populated__actual.png`
- `chat-page__light__390x844__sidebar-open__actual.png`

## Baseline / diff 限制

- Light desktop 可与本地私有 `SRC-003` 做人工结构核对，但原图含个人信息，未复制进公开验证目录，也未生成公开 diff；
- Dark desktop 只有 `SRC-002` 的新任务空状态，不是 populated 同状态 baseline；
- 登录后 mobile 没有用户/线上原图；
- 因此本轮没有伪造 baseline 或用另一状态强行做 diff。

## 已知偏差和非目标

- mock 会话文本、用户名和任务名均为脱敏替代，属于允许变化的业务内容；
- 示例不包含上传、streaming、问卷、plan review、tool call、error 等业务状态；
- focus-visible 仍按来源保持无全局 outline；由于当前生产焦点证据不足，没有擅自增加新的视觉环；
- 中文字体仍走目标系统回退；字体授权没有关闭前不随参考组件嵌入字体文件。

## 结论

代码可以作为其他系统实现悟帆式完整对话主路径的直接参考。整体档案仍保持
`analyzed`；在取得 dark populated、登录后 mobile 和完整状态 baseline 前，不将本报告升级为
全页面双主题像素回归通过。
