# 右侧“我的文件”工作区

## Drawer

- 外部 right region padding8；drawer height100%。
- background `bg-drawer`；0.5px `border-soft`；radius6；overflow hidden。
- Light shadow `0 1px 2px rgba(9,30,64,.04)`；dark 源码仍沿用此通用阴影。

`Observed · exact-source · high · SRC-015, SRC-030, SRC-031`

## Header

padding12×16，bottom 1px border。标题 icon20 + gap8 + 16/24/600。最大化/关闭按钮各32×32/radius8，gap4，图标14；hover 使用 v11 hover surface。

## 两行工具栏

### Primary

padding `12px 16px 6px`，gap12。

- Scope segmented：height32、padding2、radius10、13/500；active elevated surface + 1px shadow/ring。
- File stat：flex1、12px secondary。
- Upload：height32、padding0×12、radius8、mono invert button；icon14、label12/16/500。

### Secondary

padding `6px 16px 12px`，gap8，左右分布。

- Search：240×30（min120）、padding0×8、gap6、radius8、1px border；icon14，text12。
- Batch：height30、padding0×8、gap6、radius10、12px。
- View toggle：height30、padding2、radius10；buttons26×26、radius8。

`Observed · exact-source · high · SRC-030, SRC-031`

## Grid cards

- Container padding `0 16 16`；CSS grid `repeat(auto-fill,minmax(180px,1fr))`；gap 1%；top aligned。
- Card padding4、radius6、0.5px border；preview height120、radius6。
- Preview icon 64×64，来自产品 file-icons；不是动态缩略图（当前 `FileCardPreview` 忽略 imageUrl）。
- Meta padding `12 12 8`；文件名14/22/400、最多2行、min-height44；size12/20 placeholder。
- Hover：translateY(-1px)、shadow `0 8px 24px rgba(9,30,64,.08)`、preview opacity .72 + saturation .88。
- Hover action popover 位于 preview top6/right6，padding3、radius6、0.5px border；动作22×22/radius4。
- Shared badge 位于 card bottom6/right-5，28×24。

`Observed · exact-source · high · SRC-032, SRC-033, SRC-039`

## List rows

- Header高30，padding0×8，11/18，bottom border。
- Row min-height44、padding0×8、gap10、bottom border。
- Columns：icon28 / name flexible / type58 / size68 / date100 / action58；selection mode 前加28并移除 action。
- Hover仅中性 surface；已引用用 left inset 2px accent。

## 状态

- Loading：8个 skeleton；网格 min172/max208、gap10、padding12×16；pulse1.5s。
- Empty/error：flex center、13px tertiary。
- Batch：17px custom checkbox、radius4；selected mono invert。
- Preview：工具栏隐藏，内容占满；back/title 规则见 CSS module。
- Scope：有 session 时默认当前会话；session/agent切换会重置；无 session 强制全部文件。

## Do / Don't

- Do：右面板作为内嵌抽屉，四周8px呼吸空间。
- Do：文件类型使用原始 product icon bundle。
- Don't：把 grid 卡改成大圆角营销卡或 masonry。
- Don't：以高饱和色填满卡片；颜色只在文件图标/状态中出现。
