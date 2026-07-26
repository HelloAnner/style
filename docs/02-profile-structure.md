# 子档案结构与文件职责

## 1. 目录边界

除根目录 `docs/` 外，每个直接子文件夹是一个独立风格档案：

```text
<style-id>/
├── AGENTS.md
├── README.md
├── manifest.json
├── CHANGELOG.md
├── sources/
│   ├── index.md
│   ├── exploration-log.md
│   ├── capture-manifest.json
│   ├── screenshots/original/light/
│   ├── screenshots/original/dark/
│   ├── recordings/original/
│   ├── webpages/
│   ├── computed-styles/
│   ├── source-code/
│   ├── design-files/
│   ├── assets/fonts/
│   ├── assets/icons/
│   ├── assets/images/
│   └── notes/
├── evidence/
│   ├── light/annotated/
│   ├── light/crops/
│   ├── dark/annotated/
│   ├── dark/crops/
│   ├── measurements/
│   └── comparisons/
├── analysis/
│   ├── inventory.md
│   ├── coverage-matrix.md
│   ├── foundations.md
│   ├── themes/light.md
│   ├── themes/dark.md
│   ├── themes/mapping.md
│   ├── layout.md
│   ├── components.md
│   ├── patterns.md
│   └── motion-accessibility.md
├── system/
│   ├── tokens.json
│   ├── tokens.css
│   ├── themes/light.tokens.json
│   ├── themes/light.css
│   ├── themes/dark.tokens.json
│   ├── themes/dark.css
│   ├── style-guide.md
│   └── implementation.md
├── quality/
│   ├── TODO.md
│   ├── REQUESTS.md
│   ├── gaps.md
│   ├── acceptance.md
│   └── completion-report.md
└── examples/
    ├── reference/
    └── validation/
```

原始资料目录按实际输入创建；正式完成所需文档和系统文件不能省略。空文件和只有标题的占位文件不算完成。

## 2. 根文件职责

### `AGENTS.md`

该档案的 AI 入口。另一个 AI 即使只收到子文件夹路径，也应由它知道阅读顺序、严格复刻要求、双主题规则、当前状态读取方式和验收要求。使用 `../docs/10-profile-agent-template.md` 创建并按档案定制。

### `README.md`

面向人和 Agent 的快速入口，包含：一句话风格定义、实时状态、完成率、双主题入口、视觉指纹、Do/Don't、阅读顺序、来源和缺口链接。

### `manifest.json`

机器可读事实：ID、版本、状态、覆盖率、来源列表、入口文件、TODO 计数和最后验证信息。不能靠手工宣称替代实际文件核验。

### `CHANGELOG.md`

记录新增来源、分析结论变化、Token 变化、状态提升/回退和验证结果。发生冲突时可追溯版本。

## 3. `sources/`：不可变原件与采集记录

- `index.md`：所有来源的证据编号和上下文。
- `exploration-log.md`：每轮主动探索的工具、动作、结果、限制和生成文件。
- `capture-manifest.json`：每张截图/快照的 URL、路由、主题、视口、DPR、浏览器、状态和哈希。
- `screenshots/original/{light,dark}`：未裁切、未压缩替换的原始截图。无法确定主题时暂放 `notes/` 或标记 unknown，确认后再归档。
- `recordings/original`：原始录屏，用于动效和交互分析。
- `webpages`：合法获取的 HTML、MHTML、PDF、静态 CSS 或网页快照。
- `computed-styles`：从浏览器提取的 DOM、CSS 变量、关键元素计算样式和几何数据。
- `source-code`：用户提供或授权保存的源码原件；分析或修改副本不能覆盖它。
- `design-files`：Figma 导出、Sketch、PDF 等原件。
- `assets`：字体、图标和影像原件及许可证。

## 4. `evidence/`：派生证据

所有裁切、标注、色板、测量图、像素差图和格式转换文件都放这里，并引用原始 `SRC-*`。派生文件不能取代原件。每个文件应能从命名或旁车元数据看出主题、来源和用途。

## 5. `analysis/`：从事实到规则

- `inventory.md`：路由、页面类型、组件、状态、资源和版本盘点。
- `coverage-matrix.md`：`页面/组件 × light/dark × 视口 × 状态 × 来源` 的覆盖表。
- `foundations.md`：主题共享基础与原始测量。
- `themes/*.md`：两主题独立规则及一一映射。
- `layout.md`：容器、栅格、密度、断点、溢出与层级。
- `components.md`：组件 anatomy、精确值、变体、状态、主题和内容约束。
- `patterns.md`：页面模板和跨组件组合。
- `motion-accessibility.md`：动效参数、键盘、焦点、对比度、触控和风险。

## 6. `system/`：另一个 AI 的主要实现输入

`tokens.json` 是聚合权威 Token，包含共享层和 light/dark mode。每个主题还必须有完整展开的 JSON/CSS，使 Agent 单独读取目标主题也能实现。`style-guide.md` 汇总不变量、视觉指纹和 Do/Don't；`implementation.md` 说明精确落地、主题切换、响应式和验证方式。

## 7. `quality/`：完整性控制

- `TODO.md`：所有必需任务；清零前不能 complete。
- `REQUESTS.md`：需要用户补充的资料，含优先级、原因和提供方式。
- `gaps.md`：未知、低置信和冲突。
- `acceptance.md`：双主题、组件、页面和响应式验收标准。
- `completion-report.md`：最新自检、视觉回归环境、差异和完成判定。

三个文件应同步：gap 需要关闭动作时进入 TODO；需要用户输入时同时进入 REQUESTS；拿到证据后关闭三处对应项并保留历史。

## 8. 最低建档与正式完成

### 建档最低文件

`AGENTS.md`、`README.md`、`manifest.json`、`CHANGELOG.md`、`sources/index.md`、`sources/exploration-log.md`、`quality/TODO.md`、`quality/REQUESTS.md`、`quality/gaps.md`、`quality/completion-report.md`。

### `complete` 必需文件

除以上外，目录树中的全部 `analysis/`、`system/` 和 `quality/acceptance.md` 必须有实质内容；`capture-manifest.json` 必须有效；双主题来源和验证文件必须存在。`examples/reference` 可以不交付业务代码，但必须存在可重复验证的基准截图或等价自动化结果。

## 9. 多产品与多版本

- 不同设计语言分不同档案。
- 同一系统的轻微版本升级在原档案追加批次并升版本。
- 大改版导致 Token、组件 anatomy 或主题语言显著变化时新建 `<style-id>-v2`，不要让两套冲突规则共存于同一“当前”规范。
- 不同品牌皮肤若仅 Token 不同，可在同档案明确多品牌 mode；如果用户要求每个系统独立，则拆分档案。
