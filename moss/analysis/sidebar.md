# 左侧导航与会话列表

## 展开态容器

- width `260px`；surface `moss-sidebar-bg`；右边 1px border + 仅 inset edge shadow。
- 纵向顺序：Brand → Agent list → divider → New session → grouped sessions → footer actions → user entry。
- overflow hidden；只有 session list 纵向滚动。

`Observed · exact-source · high · light+dark · SRC-022`

## Brand

高56，padding `0 8px 0 16px`。`MOSS · 谋士` 为 18/26/600。收起按钮 32×32、radius8、icon16；tooltip top40、padding4×8、radius6、12/18/500。

`Observed · exact-source · high · SRC-023`

## Agent list

外 padding `0 12px 4px`；标签 `6px 4px 4px`、12/20 muted。Agent item min-height36、padding `7 28 7 12`、radius8、gap8、14/22；active 使用 item-active surface + 右12px的 8px active dot。头像默认16px。

`Observed · exact-source · high · SRC-024, SRC-025`

## 新会话

宽 `calc(100% - 24px)`，margin inline12；height36；padding7×12；radius8；gap8；14/22。默认透明且文字/图标为品牌橙；hover 仅浅橙 surface。Disabled opacity .6。

`Observed · exact-source · high · SRC-026`

## 会话分组

分组标签 padding `8 16 4`、高20、12/20/400、gap4。分组 `收藏/今天/昨天/更早` 独立折叠；当前会话所在组会自动展开。

会话 item：

| 属性 | 值 |
|---|---|
| min-height | 36px |
| margin | `0 12px` |
| padding | `7px 36px 7px 12px` |
| radius | 8px |
| text | 14/22；普通400，current500 |
| hover/current | item-hover / item-active |
| menu | 24×24，right6，hover/menu open 才显示 |
| unread | 8px danger dot，right18 |
| generating | 13px ring，1.5px stroke，0.8s linear |
| rename input | 1px border、radius6、padding2×6、14/20 |

看板新会话 highlight 持续3s，品牌橙13% surface + 30% inset border + 10% shadow。

`Observed · exact-source · high · SRC-027, SRC-028`

## Footer 与用户

Footer padding8×16、gap8。案例中心高38、padding8×12、radius4、0.5px蓝色边框；下面两个工具按钮高32、radius6、13px、gap8。User 区 top border、padding8；trigger height36、padding6×12、gap8、radius6；名称14/22。

`Observed · exact-source · high · SRC-029, SRC-036`

## 折叠 rail

- width48、padding `8px 0`；action 32×32/radius8，纵向以 8/12/14/16px spacer 分组。
- 顺序：展开 → Agent → 新会话 → 收藏 → 历史 → flexible space → 案例 → 文件 → 自动化 → 用户。
- Tooltip 在按钮右侧8px；flyout 在右侧16px，viewport padding12。

`Observed · exact-source · high · SRC-037, SRC-038`

## Do / Don't

- Do：统一 36px 内容 item 与 12px 边距。
- Do：当前态仅中性 surface + 字重，不加左侧彩条。
- Don't：把会话列表做成独立卡片或增加厚分割线。
- Don't：把橙色用于普通 active session；橙只给“新会话”和短时 highlight。
