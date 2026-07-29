# 悟帆 AI 双主题对话工作区

这是给其他系统直接参考的、可运行的悟帆对话页面代码示例。范围覆盖用户指定的完整主路径：

```text
应用壳层
├─ 左侧 Sidebar：品牌、主导航、任务分组、对话列表、用户区
└─ 中央 Chat
   ├─ Chat Header：Agent、任务标题、上下文动作
   ├─ Message List：用户/Agent、Markdown 层级、消息工具
   └─ Composer：附件、思考、模型、发送
```

## 文件

- `WufanChatPage.tsx`：可直接复制到 React 项目的完整页面组件；
- `wufan-chat.css`：明色和暗色两套独立语义值、组件几何及响应式；
- `types.ts`：页面、会话和消息类型；
- `mock-data.tsx`：完全脱敏的对话和任务示例；
- `spec.json`：供其他 Agent 读取的机器规格与证据状态；
- `demo.html`：不需要安装依赖的浏览器演示，包含主题切换、移动端 Sidebar 和发送消息交互；
- `index.ts`：公开导出入口。

## 证据与准确范围

当前线上生产包 `SRC-012/013` 晚于本地
`/Users/anner/fine/ai/corevo` 的 `14394dc`。因此本示例采用以下顺序：

1. 当前生产 bundle：Logo、Sidebar 当前导航、960px MessageList、Composer 和主题值；
2. 用户 light 对话原图 `SRC-003`：桌面 populated chat 的视觉关系；
3. 用户 dark 新任务原图 `SRC-002`：暗色应用壳层、Sidebar、Header 和 Composer；
4. 本地源码 `SRC-004`：组件解剖、消息结构、`<768px` drawer 行为和交互语义。

逐项映射见 `../../../evidence/measurements/chat-page-source-map.md`。

本示例可以称为
`exact-source reference, pass within runnable chat-page scope`，不能称为整个悟帆系统已经
`complete`。原因是目前仍缺：

- 同一 populated 对话页面的 dark 原图；
- 登录后 Product 的 mobile 原图；
- 当前生产部署对应的完整未压缩源码；
- 上传、流式输出、错误、问卷、Plan review 等全部状态的视觉配对。

Dark populated 和 mobile 在本示例中是“当前主题 Token + 当前/本地源码行为的确定性组合”，不是已有截图的像素级 baseline。

## React 使用

组件只依赖 `react`，图标以来源一致的内联线性 SVG 提供，不要求 Lucide：

```tsx
import React, { useState } from 'react';
import {
  WufanChatPage,
  type WufanTheme,
} from './wufan-chat-page';

export function App() {
  const [theme, setTheme] = useState<WufanTheme>('light');

  return (
    <WufanChatPage
      theme={theme}
      onThemeChange={setTheme}
      onSend={(value) => {
        // 接入你自己的消息 API。
        console.log(value);
      }}
    />
  );
}
```

若使用自己的数据，替换 `sessionGroups` 和 `initialMessages`。业务文案可以变化，但同语义组件不要改写 CSS 值。

## 零构建演示

直接打开 `demo.html`，或使用静态服务器：

```bash
python3 -m http.server 4174
```

访问：

- `demo.html?theme=light`
- `demo.html?theme=dark`

输入文字后按 Enter 或点击发送按钮，可以验证 active send 的主题反向规则。浏览器缩到
`390×844` 后，通过左上角按钮验证 Sidebar drawer。

## 双主题规则

主题挂在页面根节点：

```html
<main class="wufan-chat-page" data-theme="light"></main>
<main class="wufan-chat-page" data-theme="dark"></main>
```

不要用滤镜或算法反色。关键映射：

| Semantic | Light | Dark |
|---|---|---|
| canvas | `#FAF9F7` | `#0A0A0F` |
| sidebar | `#FFFFFF` | `rgba(18,18,24,.5)` |
| input | `#FAFAFA` | `#27272A` |
| user bubble | `#F0EFED` | `#1A1A20` |
| agent bubble | `#FFFFFF` | `#16161C` |
| send active | `#18181B / #FFFFFF` | `#FFFFFF / #18181B` |

完整产品变量仍以 `../../../system/themes/light.tokens.json` 和
`../../../system/themes/dark.tokens.json` 为准。

## 集成约束

- 保留 12px 应用 inset/gap、240px Sidebar 和 56px Header；
- 保留 MessageList 当前生产值 `max-width: 960px`、Composer `max-width: 800px`；
- 消息头像 32px、gap 12、bubble padding 14/radius 16、正文 14/1.6；
- Sidebar 的 mobile drawer 源码阈值为 `<768px`；
- 中文字体最终回退仍依赖目标系统，不能未经授权随包嵌入归档字体；
- 示例没有复制私有业务 store、API、会话内容、用户名或用户截图；
- 若需要全量 streaming/tool-call/file 状态，应继续参考 `SRC-004` 并补做当前生产视觉验证。

## 验证

实际渲染截图和运行时指标保存在
`../../validation/chat-page/`。验收说明会区分：

- source/runtime 参数检查；
- 本地代码功能检查；
- 有原图的 light desktop 视觉核对；
- 无同页原图的 dark/mobile 限制。
