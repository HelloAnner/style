# 验收标准

## 环境

正式比较固定：Chrome 版本、macOS、locale zh-CN、timezone Asia/Shanghai、DPR1、字体 ready、相同内容和事件顺序。Desktop 1440×900；mobile 断点待来源确认，暂以 390×844 只作参考。

## 思维链（最高优先级）

- [ ] 来源产品 light/dark baseline 齐全。
- [ ] 运行标题 14/22/500、扫光 1.4s；reduced-motion 行为一致。
- [ ] 过程行 min 30，icon slot 16，文字 14/22；工具 13/20、icon slot 14。
- [ ] Connector left 7.5、top 29.5、width 1.25；工具缩进 7.5+15.5。
- [ ] Preview 96 code points + 句子边界；“更多”13px。
- [ ] Running 自动展开不可折叠；terminal 自动收起可展开。
- [ ] 成功、失败、超时、取消、直接工具 fallback 文案匹配。
- [ ] 528px 上限、自动贴底、用户上滚停止跟随。
- [ ] 子智能体 attachment 锚点和特殊工具卡片不破坏时间线。

## 对话与系统

- [ ] 900px 内容列、24px inline/top、32px bottom、24px 回合间距。
- [ ] Assistant header 24px mark、8px gap、6px bottom；名称 14/22/600。
- [ ] 正文 8px radius、1px border、16×18 padding、14/22。
- [ ] Composer 116px min、16px radius、0.5px border、34px send。
- [ ] Light/dark 每个 semantic Token 与展开文件一致。
- [ ] Inter/JetBrains Mono/CJK fallback 实际加载已确认。

## 状态与可访问性

- [ ] hover、focus-visible、active、disabled、loading、error 均有来源证据。
- [ ] 键盘展开/收起、滚动、屏幕阅读文本可用。
- [ ] reduced-motion 覆盖 CSS 与 Framer Motion。
- [ ] 对比度风险与批准偏差均记录。

## 视觉回归

每个主题至少 1 个 desktop + 1 个有效 mobile 页面，保存 baseline/actual/diff。结构与颜色目标 0 未解释差异；仅允许记录环境抗锯齿容差。当前所有项未正式通过，参考截图不能替代来源 baseline。
