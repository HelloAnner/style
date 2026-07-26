# 证据、测量与分析方法

## 1. 原件不可变与来源编号

用户提供或 Agent 合法采集的原件必须原样保存在 `sources/`。裁切、标注、重编码、脱敏、OCR、色板、测量和差图放入 `evidence/`，不得覆盖原件。

每项来源分配稳定编号 `SRC-001`、`SRC-002`。派生证据可以使用 `EVD-001`，并明确 `derivedFrom: SRC-xxx`。来源至少记录：

- 原始名称或 URL；
- 本地相对路径；
- 类型和 MIME；
- 获取时间；
- 页面/路由/组件；
- `theme: light | dark | shared | unknown`；
- viewport、DPR、设备、浏览器和状态；
- 来源/授权；
- SHA-256；
- 采集方式与限制。

链接本身不是完整归档。若权限和工具允许，应同时保留截图、快照、计算样式或源码；无法保存时记录原因。

## 2. 结论标签

关键分析结论使用：

- `Observed`：源码、设计属性、计算样式或可靠测量直接确认；
- `Inferred`：多个观察归纳；
- `Recommended`：为未覆盖场景提出的扩展；
- `Unknown`：证据不足。

同时标记：

- 精确性：`exact-source | exact-measured | inferred-system | recommended-extension | unknown`；
- 置信度：`high | medium | low`；
- 主题与断点；
- 证据编号。

示例：

```md
- `button.radius = 12px`。
  `Observed · exact-source · high · light+dark · SRC-004`
- 侧栏在 1024px 以下可能切换为抽屉。
  `Inferred · inferred-system · medium · SRC-008, SRC-009`
- 建议新增 compact table 密度。
  `Recommended · recommended-extension · low · 无来源状态`
```

## 3. 测量纪律

### 几何

- 优先计算样式和布局盒，其次是已知 DPR/缩放的原始截图。
- 截图被缩放、裁切或聊天软件压缩时，不把测得像素直接当 CSS px。
- 同时记录原始测量值和归一化 Token，不为得到整齐数列而隐藏例外。
- 验证 padding、gap、margin 的语义，不仅测两个边缘距离。
- 考虑 border、box-sizing、transform、zoom、滚动条和 subpixel positioning。

### 色彩

- 记录颜色来自哪个语义区域和状态；不要只输出“出现最多的 20 个颜色”。
- 排除字体抗锯齿、图片、视频和压缩噪声后再聚类。
- 区分实色、alpha 合成、渐变、filter、blend mode 和 overlay。
- alpha 色应同时记录前景、alpha、背景和最终显示值。
- 阴影记录每层 offset、blur、spread、color，而不是只取边缘像素。

### 字体

- 优先来源：字体文件/设计稿 → 浏览器实际加载 FontFace → CSS 声明 → 截图推断。
- 记录字体族、PostScript 名、文件、weight/style、可变轴、unicode range、fallback 和许可证。
- 检查声明字体是否真正加载；fallback 会改变换行和几何。
- 截图字体识别通常不能达到 exact-source，必须进入 gap，除非有额外证据。

### 图标与影像

- SVG 记录 viewBox、路径、stroke/fill、线帽、线连接、尺寸和对齐。
- 区分图标字体、SVG sprite、组件库、图片与 CSS 绘制图标。
- 图片记录自然尺寸、显示比例、裁切、object-fit、圆角、滤镜和主题差异。

### 动效

- 记录触发、delay、duration、easing、属性、起止值、方向和中断行为。
- 至少观察进入、稳定、退出；不能只从一帧推断。
- 检查 `prefers-reduced-motion` 或产品减弱动效设置。

## 4. 分析顺序

### 4.1 盘点

`analysis/inventory.md` 列出：

- 系统版本、路由、页面类型；
- 全局壳层；
- 页面模板；
- 组件及变体/状态；
- 双主题；
- 视口和断点；
- 字体、图标、图片和第三方依赖；
- 重复规律和局部例外。

### 4.2 覆盖矩阵

`analysis/coverage-matrix.md` 至少用表格表示：

```md
| 对象 | light desktop | dark desktop | light mobile | dark mobile | 状态覆盖 | 证据 | 结论 |
```

对象既包括页面，也包括核心组件。单元格使用 `none | partial | observed | validated | n/a`。`n/a` 必须有理由和证据。

### 4.3 基础与视觉指纹

分析颜色、字体、空间、尺寸、形状、边框、阴影、图标、影像、栅格、密度和层级。总结 5–10 个最具识别力的不变量，并给出反特征，例如“不要用大面积渐变”“不要把 1px 分割线替换为卡片阴影”。

### 4.4 主题

分别建立 light/dark 的 surface、text、border、action、feedback、overlay、shadow、icon、focus 和 state 语义表。再在 `themes/mapping.md` 做同语义映射，检查每个语义是否两边都有值。

### 4.5 组件

每个重要组件记录：

- purpose 与 anatomy；
- 精确尺寸、padding、gap、字体、图标、边框、radius、shadow；
- primitive → semantic → component Token 映射；
- light/dark 值；
- variants、density 和 size；
- default、hover、active、focus-visible、selected、disabled、loading、error、open 等状态；
- 内容长度、换行、截断、空值和溢出；
- 键盘、焦点、触控与 ARIA；
- 响应式规则；
- 证据、精确性与置信度。

### 4.6 页面模式

提炼列表、详情、工作台、设置、登录、搜索、创建/编辑、空/错/加载等模板。区分设计语言不变量、业务可变量和品牌专属元素。

## 5. 冲突处理

发现冲突时建立表格：规则、证据 A/B、环境差异、可能原因、当前决定和待验证动作。优先验证：版本、主题、断点、组件变体、浏览器、字体加载、A/B 实验和运行时覆盖。不能为了 Token 整齐而删除真实例外。

## 6. 自动提取必须抽样核验

自动颜色聚类、OCR、DOM 选择器、字体识别、截图测量和组件聚类都可能错误。每类结果至少抽样核验代表页面和两个主题。失败率明显时停止批量结论，修正脚本后重跑，并在探索日志记录。

## 7. 分析完成检查

- 每个关键规则是否有证据？
- light/dark 是否分别分析？
- 是否混入 fallback 字体或第三方默认值？
- 是否把截图显示色误当源色？
- 是否覆盖非默认状态？
- 是否解释例外和冲突？
- 是否把推断/建议清晰分离？
- 是否能由证据重做同一结论？

未通过项进入 TODO 和 gaps；需要用户资料时同时进入 REQUESTS。
